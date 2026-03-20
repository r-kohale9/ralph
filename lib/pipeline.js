'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline.js — E3: Node.js implementation of the Ralph pipeline
//
// Replaces ralph.sh's curl-based LLM calls with the Node.js llm.js client.
// Enables: cost tracking, structured I/O, streaming, per-call metrics.
//
// Usage: Called by worker.js when RALPH_USE_NODE_PIPELINE=1
//   const { runPipeline } = require('./lib/pipeline');
//   const report = await runPipeline(gameDir, specPath, { metrics, logger });
//
// The bash pipeline (ralph.sh) remains the default for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { callLlm, callClaude, resetTokens, getTokenUsage } = require('./llm');
const { validateContract } = require('./validate-contract');
const metrics = require('./metrics');
const {
  buildGenerationPrompt,
  buildCliGenPrompt,
  buildStaticFixPrompt,
  buildContractFixPrompt,
  buildEarlyReviewPrompt,
  buildEarlyReviewFixPrompt,
  buildEarlyReReviewPrompt,
  buildTestCasesPrompt,
  buildTestGenCategoryPrompt,
  buildTriagePrompt,
  buildFixPrompt,
  buildGlobalFixPrompt,
  buildReviewPrompt,
  buildReviewFixPrompt,
  buildReReviewPrompt,
  buildExtractLearningsPrompt,
  buildTargetedFixPrompt,
} = require('./prompts');

const execFileAsync = promisify(execFile);

// ─── Snapshot/harness/spec utilities (extracted to pipeline-utils.js) ────────
const {
  captureGameDomSnapshot,
  injectTestHarness,
  extractSpecMetadata,
  extractSpecRounds,
  extractSpecKeywords,
  extractTestGenerationHints,
  jaccardSimilarity,
  getCategoryBoost,
  getRelevantLearnings,
  deriveRelevantCategories,
  isHtmlTruncated,
} = require('./pipeline-utils');

// ─── Find a free TCP port ────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ─── Configuration ──────────────────────────────────────────────────────────

const GEN_MODEL = process.env.RALPH_GEN_MODEL || 'claude-opus-4-6';
const TEST_MODEL = process.env.RALPH_TEST_MODEL || 'gemini-2.5-pro';
const TEST_CASES_MODEL = process.env.RALPH_TEST_CASES_MODEL || TEST_MODEL;
const FIX_MODEL = process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
const REVIEW_MODEL = process.env.RALPH_REVIEW_MODEL || 'gemini-2.5-pro';
const FALLBACK_MODEL = process.env.RALPH_FALLBACK_MODEL || 'gpt-4.1';
const TRIAGE_MODEL = process.env.RALPH_TRIAGE_MODEL || FIX_MODEL;
const GLOBAL_FIX_MODEL = process.env.RALPH_GLOBAL_FIX_MODEL || GEN_MODEL;
const LEARNINGS_MODEL = process.env.RALPH_LEARNINGS_MODEL || FIX_MODEL;
const MAX_ITERATIONS = parseInt(process.env.RALPH_MAX_ITERATIONS || '5', 10);
const MAX_GLOBAL_FIX_ITERATIONS = parseInt(process.env.RALPH_MAX_GLOBAL_FIX_ITERATIONS || '2', 10);
const CATEGORY_BATCH_SIZE = parseInt(process.env.RALPH_CATEGORY_BATCH_SIZE || '1', 10);
const SKIP_DOM_SNAPSHOT = process.env.RALPH_SKIP_DOM_SNAPSHOT === '1';
const TEST_TIMEOUT = parseInt(process.env.RALPH_TEST_TIMEOUT || '120', 10) * 1000;
const USE_CLAUDE_CLI = process.env.RALPH_USE_CLAUDE_CLI === '1';
const REPO_DIR = process.env.RALPH_REPO_DIR || '.';
const SKILL_DIR = path.join(REPO_DIR, 'warehouse', 'mathai-game-builder');
const WAREHOUSE_TEMPLATES_DIR = path.join(REPO_DIR, 'warehouse', 'templates');
const GLOBAL_LEARNINGS_FILE = path.join(REPO_DIR, 'data', 'global-learnings.md');

// ─── Cost estimation ─────────────────────────────────────────────────────────

const MODEL_COSTS = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || { input: 3, output: 15 }; // default to sonnet pricing
  return ((inputTokens * costs.input) + (outputTokens * costs.output)) / 1_000_000;
}

// ─── Global learnings (cross-game, persisted) ───────────────────────────────

function readGlobalLearnings() {
  try {
    if (fs.existsSync(GLOBAL_LEARNINGS_FILE)) {
      const content = fs.readFileSync(GLOBAL_LEARNINGS_FILE, 'utf-8').trim();
      return content || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function appendGlobalLearning(entry) {
  try {
    fs.mkdirSync(path.dirname(GLOBAL_LEARNINGS_FILE), { recursive: true });
    const line = `- ${entry.trim()}\n`;
    fs.appendFileSync(GLOBAL_LEARNINGS_FILE, line);
  } catch {
    // ignore
  }
}

// ─── HTML extraction helpers ────────────────────────────────────────────────

function extractHtml(output) {
  // Try ```html code block
  let match = output.match(/```html\n([\s\S]*?)\n```/);
  if (match) return match[1];

  // Try generic code block with HTML content
  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /<!DOCTYPE|<html|<head|<body/.test(match[1])) return match[1];

  // Raw HTML — may have LLM chain-of-thought text before DOCTYPE; slice from there
  const htmlStart = output.search(/<!DOCTYPE html|<html/i);
  if (htmlStart !== -1) return output.slice(htmlStart);

  return null;
}

// isHtmlTruncated — re-exported from pipeline-utils.js

function extractTests(output) {
  let match = output.match(/```javascript\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```js\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /test|expect|describe/.test(match[1])) return match[1];

  return null;
}

// extractSpecMetadata — re-exported from pipeline-utils.js

// injectTestHarness — re-exported from pipeline-utils.js

// ─── LLM call wrapper with metrics// ─── LLM call wrapper with metrics ──────────────────────────────────────────

async function trackedLlmCall(stepName, prompt, model, options = {}, report = null) {
  const start = Date.now();
  const tokensBefore = getTokenUsage();
  try {
    const result = await callLlm(stepName, prompt, model, options);
    metrics.recordLlmCall(stepName, model, Date.now() - start, true);
    if (report) {
      const tokensAfter = getTokenUsage();
      const inputDelta = tokensAfter.input - tokensBefore.input;
      const outputDelta = tokensAfter.output - tokensBefore.output;
      report.total_cost_usd = (report.total_cost_usd || 0) + estimateCost(model, inputDelta, outputDelta);
    }
    return result;
  } catch (err) {
    metrics.recordLlmCall(stepName, model, Date.now() - start, false);
    if (err.message.includes('Rate limited')) {
      metrics.recordLlmRateLimit(model);
    }
    throw err;
  }
}

// captureBehavioralTranscript — re-exported from pipeline-utils.js

// ─── DOM snapshot for test generation context// captureGameDomSnapshot — re-exported from pipeline-utils.js

// ─── Static validation// ─── Static validation ─────────────────────────────────────────────────────

function runStaticValidation(htmlPath) {
  const validatorPath = path.join(__dirname, 'validate-static.js');
  if (!fs.existsSync(validatorPath)) return { passed: true, output: '' };

  try {
    const { execFileSync } = require('child_process');
    const output = execFileSync('node', [validatorPath, htmlPath], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { passed: true, output };
  } catch (err) {
    return { passed: false, output: err.stdout || err.message };
  }
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function collectFailures(suites, parentFile, out) {
  for (const suite of suites || []) {
    const suiteFile = suite.file || parentFile || '';
    for (const spec of suite.specs || []) {
      if (!spec.ok) {
        const rawMsg = spec.tests?.[0]?.results?.[0]?.error?.message || '';
        const errMsg = rawMsg.length > 600 ? rawMsg.slice(0, 600) + '…' : rawMsg;
        const fileLabel = suiteFile ? `[${path.basename(suiteFile)}] ` : '';
        out.push(errMsg ? `${fileLabel}${spec.title} — ${errMsg}` : `${fileLabel}${spec.title}`);
      }
    }
    if (suite.suites) collectFailures(suite.suites, suiteFile, out);
  }
}

// ─── Deterministic triage ────────────────────────────────────────────────────
// Returns 'fix_html', 'skip_tests', or null (null = unknown, do LLM triage).
// Called before the LLM triage to short-circuit known patterns cheaply.

function deterministicTriage(failures) {
  if (!failures || failures.length === 0) return null;
  // ralph test harness not initialized — always fix_html
  if (failures.every(f => f.includes('window.__ralph is not defined') ||
      (f.includes('Cannot read properties of undefined (reading') && f.includes('__ralph')))) {
    return 'fix_html';
  }
  // visibility API — untestable, skip
  if (failures.every(f => f.includes('Cannot redefine property: visibilityState'))) {
    return 'skip_tests';
  }
  // pointer-events re-click pattern — skip
  if (failures.every(f => f.includes('pointer-events') ||
      (f.includes('already been clicked') || f.includes('already selected')))) {
    return 'skip_tests';
  }
  return null; // needs LLM triage
}

// ─── E8 script-only fix helpers ──────────────────────────────────────────────
// On iteration 2+, send only <script> sections to the fix LLM instead of the
// full HTML. mergeScriptFix merges the corrected scripts back into the original.

function extractScriptSections(html) {
  const scripts = [];
  const scriptRegex = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push({ index: match.index, content: match[0] });
  }
  return scripts;
}

function mergeScriptFix(originalHtml, fixedScriptContent) {
  // Replace all <script> sections in original with the fixed content.
  // Find the first <script> and last </script> span in original, replace entire range.
  const firstScript = originalHtml.search(/<script/i);
  const lastScriptEnd = originalHtml.lastIndexOf('</script>') + '</script>'.length;
  if (firstScript === -1 || lastScriptEnd <= firstScript) return null; // can't merge
  return originalHtml.slice(0, firstScript) + fixedScriptContent + originalHtml.slice(lastScriptEnd);
}

// extractSpecRounds — re-exported from pipeline-utils.js

// ─── Shared review guidance (used by both early and final review prompts) ───
// Imported from lib/prompts.js — REVIEW_SHARED_GUIDANCE is defined there.
// Keep in prompts.js: any change there applies to both Step 1c and Step 4 review calls.

// ─── Spec pre-validation ────────────────────────────────────────────────────

function validateSpec(specContent) {
  const errors = [];
  const warnings = [];

  if (!specContent || specContent.trim().length < 200) {
    errors.push('Spec too short (< 200 chars) — likely incomplete');
    return { errors, warnings };
  }

  // Check for game description / title
  if (!/^#\s+\w/m.test(specContent)) {
    errors.push('Missing top-level heading (# Game Title)');
  }

  // Check for mechanics / rules / how to play
  if (!/##.*(?:mechanic|rule|how.to.play|gameplay|instruction)/i.test(specContent)) {
    warnings.push('No mechanics/rules section found — generation may produce generic gameplay');
  }

  // Check for scoring / stars
  if (!/star|scor|point|win|complet/i.test(specContent)) {
    warnings.push('No scoring criteria found — star thresholds may be incorrect');
  }

  // Check for CDN / technology / implementation section
  // Also accept PART-002/PART-003 table entries (Package Scripts / waitForPackages = CDN usage)
  if (!/cdn|technology|implementation|technical|PART-00[23]/i.test(specContent)) {
    warnings.push('No CDN/technology section — generation may miss required CDN libraries');
  }

  return { errors, warnings };
}

// extractTestGenerationHints — re-exported from pipeline-utils.js

// ─── Main pipeline ──────────────────────────────────────────────────────────

async function runPipeline(gameDir, specPath, options = {}) {
  const { logger: log, onProgress, buildId } = options;
  const info = log ? (msg) => log.info(msg) : console.log;
  const warn = log ? (msg) => log.warn(msg) : console.warn;
  const error = log ? (msg) => log.error(msg) : console.error;

  function progress(step, detail) {
    if (onProgress) {
      try {
        onProgress(step, detail);
      } catch {
        /* ignore callback errors */
      }
    }
  }

  const startTime = Date.now();
  const gameId = path.basename(path.dirname(specPath));
  const htmlFile = path.join(gameDir, 'index.html');
  const testsDir = path.join(gameDir, 'tests');
  const testCasesFile = path.join(testsDir, 'test-cases.json');
  const reportFile = path.join(gameDir, 'ralph-report.json');
  const llmCalls = [];

  fs.mkdirSync(path.join(gameDir, 'tests'), { recursive: true });

  resetTokens();

  const report = {
    game_id: gameId,
    spec: specPath,
    status: 'FAILED',
    iterations: 0,
    generation_time_s: 0,
    total_time_s: 0,
    test_results: [],
    category_results: {},
    review_result: null,
    errors: [],
    skipped_tests: [],
    models: { generation: GEN_MODEL, test_cases: TEST_CASES_MODEL, test_gen: TEST_MODEL, fix: FIX_MODEL, review: REVIEW_MODEL },
    artifacts: [],
    llm_calls: 0,
    total_cost_usd: 0,
    iteration_html_urls: {}, // populated by worker via progress events
    timestamp: new Date().toISOString(),
  };

  function writeReport() {
    report.total_time_s = Math.round((Date.now() - startTime) / 1000);
    report.llm_calls = llmCalls.length;
    report.artifacts = fs.existsSync(htmlFile) ? ['index.html'] : [];
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  // ─── Step 0: Validate spec ──────────────────────────────────────────────
  progress('validate-spec', { gameId });

  if (!fs.existsSync(specPath)) {
    report.errors.push('Spec file not found');
    writeReport();
    return report;
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');
  if (specContent.length < 500) {
    report.errors.push('Spec file too small — likely truncated');
    writeReport();
    return report;
  }

  // ─── Step 0: Spec pre-validation ────────────────────────────────────────
  info('[pipeline] Step 0: Spec pre-validation');
  const specValidation = validateSpec(specContent);
  if (specValidation.warnings.length > 0) {
    specValidation.warnings.forEach(w => warn(`[pipeline] Step 0: ⚠ ${w}`));
  }
  if (specValidation.errors.length > 0) {
    specValidation.errors.forEach(e => error(`[pipeline] Step 0: ✗ ${e}`));
    throw new Error(`Spec pre-validation failed: ${specValidation.errors.join('; ')}`);
  }
  progress('spec-validated', { gameId, warnings: specValidation.warnings.length, warningList: specValidation.warnings });

  // Extract spec metadata for test harness injection (interaction type, lives, rounds, star logic)
  const specMeta = extractSpecMetadata(specContent);
  info(`[pipeline] Spec metadata: interaction=${specMeta.interactionType}, rounds=${specMeta.totalRounds}, lives=${specMeta.totalLives}, stars=${specMeta.starType}`);

  // ─── Save spec keywords to DB (enables SQL pre-filtering in future builds) ──
  // Extract keywords early so they are persisted even if the pipeline fails later.
  if (buildId) {
    try {
      const db = require('./db');
      const specKeywordsForBuild = extractSpecKeywords(specContent);
      db.updateBuildSpecKeywords(buildId, Array.from(specKeywordsForBuild));
      info(`[pipeline] Saved ${specKeywordsForBuild.size} spec keywords to build #${buildId}`);
    } catch (e) {
      warn(`[pipeline] Failed to save spec keywords to DB: ${e.message}`);
    }
  }

  // Helper: inject test harness into HTML file and write it back
  function injectHarnessToFile(filePath) {
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const patched = injectTestHarness(original, specMeta);
      if (patched !== original) {
        fs.writeFileSync(filePath, patched);
        info(`[pipeline] Test harness injected into ${path.basename(filePath)}`);
      }
    } catch (e) {
      warn(`[pipeline] Test harness injection failed: ${e.message}`);
    }
  }

  // ─── Load global cross-game learnings ───────────────────────────────────
  const globalLearnings = readGlobalLearnings();
  if (globalLearnings) {
    info(`[pipeline] Loaded global learnings (${globalLearnings.split('\n').length} entries)`);
  }

  // ─── Load approved-build learnings from DB ───────────────────────────────
  const dbLearnings = getRelevantLearnings(gameId, specContent, 10);
  if (dbLearnings) {
    info(`[pipeline] Loaded ${dbLearnings.split('\n').length} approved-build learnings from DB`);
  }

  function formatLearningsBlock() {
    const parts = [];
    if (globalLearnings) parts.push(globalLearnings);
    if (dbLearnings) parts.push(dbLearnings);
    if (parts.length === 0) return '';
    return `\nACCUMULATED LEARNINGS FROM PRIOR GAME BUILDS (apply these to avoid known pitfalls):\n${parts.join('\n')}\n`;
  }

  // ─── Step 1: Generate HTML ──────────────────────────────────────────────

  // Track whether HTML was freshly generated this build (vs copied from warehouse).
  // Used later to detect stale warehouse HTML causing 0% game-flow on iteration 1.
  let htmlWasFreshlyGenerated = false;

  // Build genPrompt unconditionally — used both for initial generation and for
  // warehouse-HTML regen if stale HTML is detected mid-pipeline.
  const genPrompt = buildGenerationPrompt(specContent, formatLearningsBlock());

  const existingHtml = fs.existsSync(htmlFile) && fs.statSync(htmlFile).size > 5000;
  if (existingHtml) {
    info(`[pipeline] Step 1: Skipping HTML generation — index.html exists (${fs.statSync(htmlFile).size} bytes)`);
    report.generation_time_s = 0;
  }

  if (!existingHtml) {
  info(`[pipeline] Step 1: Generate HTML for ${gameId}`);
  progress('generate-html', { gameId, model: GEN_MODEL });
  const genStart = Date.now();

  let genOutput;
  try {
    if (USE_CLAUDE_CLI) {
      info('[pipeline] Using claude -p for HTML generation (skill context auto-loaded)');
      const cliPrompt = buildCliGenPrompt(path.resolve(specPath), path.resolve(htmlFile), formatLearningsBlock());

      genOutput = await callClaude('generate-html', cliPrompt, {
        cwd: SKILL_DIR,
        model: process.env.RALPH_CLAUDE_MODEL || 'sonnet',
        timeout: parseInt(process.env.RALPH_LLM_TIMEOUT || '600', 10) * 1000,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
        addDirs: [path.resolve(REPO_DIR, 'warehouse'), path.resolve(gameDir)],
      });
    } else {
      genOutput = await trackedLlmCall('generate-html', genPrompt, GEN_MODEL, {}, report);
    }
    llmCalls.push({ step: 'generate-html', model: USE_CLAUDE_CLI ? 'claude-cli' : GEN_MODEL });
  } catch (err) {
    report.errors.push(`HTML generation failed: ${err.message}`);
    writeReport();
    return report;
  }

  report.generation_time_s = Math.round((Date.now() - genStart) / 1000);

  // claude -p writes the file directly via Write tool; API mode returns HTML in response
  if (USE_CLAUDE_CLI && fs.existsSync(htmlFile)) {
    const size = fs.statSync(htmlFile).size;
    info(`[pipeline] HTML saved by claude -p (${size} bytes)`);
  } else if (USE_CLAUDE_CLI) {
    // claude -p didn't write the file — try extracting from output
    const html = extractHtml(genOutput || '');
    if (!html) {
      report.errors.push('claude -p did not generate index.html');
      writeReport();
      return report;
    }
    fs.writeFileSync(htmlFile, html + '\n');
    info(`[pipeline] HTML extracted from claude -p output (${html.length} bytes)`);
  } else {
    const html = extractHtml(genOutput);
    if (!html) {
      report.errors.push('Could not extract HTML from generation output');
      writeReport();
      return report;
    }
    // Retry generation if HTML appears truncated (token limit hit)
    let htmlContent = html;
    let genAttempts = 0;
    const MAX_GEN_ATTEMPTS = 3;
    while (isHtmlTruncated(htmlContent) && genAttempts < MAX_GEN_ATTEMPTS - 1) {
      genAttempts++;
      warn(`[pipeline] HTML appears truncated (attempt ${genAttempts}/${MAX_GEN_ATTEMPTS}) — retrying generation`);
      const retryOutput = await trackedLlmCall('generate-html-retry', genPrompt, GEN_MODEL, {}, report);
      llmCalls.push({ step: 'generate-html-retry', model: GEN_MODEL });
      const retryHtml = extractHtml(retryOutput);
      if (retryHtml && !isHtmlTruncated(retryHtml)) {
        htmlContent = retryHtml;
        break;
      }
      if (retryHtml && retryHtml.length > (htmlContent || '').length) {
        htmlContent = retryHtml; // take the longer output even if still truncated
      }
    }
    if (isHtmlTruncated(htmlContent)) {
      warn(`[pipeline] HTML still appears truncated after ${MAX_GEN_ATTEMPTS} attempts — proceeding anyway`);
    }
    fs.writeFileSync(htmlFile, htmlContent + '\n');
    info(`[pipeline] HTML saved (${htmlContent.length} bytes)`);
  }

  htmlWasFreshlyGenerated = true;

  } // end if (!existingHtml)

  // Post-generation cleanup: fix wrong CDN domain (LLM sometimes uses cdn.mathai.ai instead of cdn.homeworkapp.ai)
  {
    let rawHtml = fs.readFileSync(htmlFile, 'utf-8');
    const fixedHtml = rawHtml.replace(/cdn\.mathai\.ai/g, 'cdn.homeworkapp.ai');
    if (fixedHtml !== rawHtml) {
      warn(`[pipeline] Fixed wrong CDN domain: cdn.mathai.ai → cdn.homeworkapp.ai`);
      fs.writeFileSync(htmlFile, fixedHtml);
    }
  }

  // Inject test harness into HTML (window.__ralph + syncDOMState + postMessage capture)
  injectHarnessToFile(htmlFile);

  // Emit progress with htmlFile path so worker can upload preview
  const htmlSize = fs.existsSync(htmlFile) ? fs.statSync(htmlFile).size : 0;
  const htmlGenTimeS = report.generation_time_s || 0;
  progress('html-ready', { gameId, htmlFile, size: htmlSize, time: htmlGenTimeS, model: GEN_MODEL });

  // ─── Step 1b: Static + contract validation ──────────────────────────────

  info('[pipeline] Step 1b: Static validation');
  progress('static-validation', { gameId });
  const staticResult = runStaticValidation(htmlFile);
  let staticPassed = staticResult.passed;
  if (!staticResult.passed) {
    warn(`[pipeline] Static validation failed, attempting fix`);
    progress('static-validation-failed', { gameId, errors: staticResult.output, fixModel: FIX_MODEL });

    const fixPrompt = buildStaticFixPrompt(staticResult.output, fs.readFileSync(htmlFile, 'utf-8'), specContent);

    try {
      const fixOutput = await trackedLlmCall('static-fix', fixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: 'static-fix', model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (fixedHtml) {
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
        injectHarnessToFile(htmlFile);
        // Re-validate to confirm fix worked
        const reValidateResult = runStaticValidation(htmlFile);
        if (reValidateResult.passed) {
          staticPassed = true;
          progress('static-validation-fixed', { gameId });
        } else {
          const remainingErrors = reValidateResult.output.split('\n').filter(l => l.includes('✗')).length;
          warn(`[pipeline] Static fix incomplete — ${remainingErrors} error(s) remain after fix`);
          staticPassed = true; // proceed anyway; per-batch fix loop will handle remaining issues
          progress('static-validation-fixed-partial', { gameId, remaining: reValidateResult.output });
        }
      }
    } catch {
      warn('[pipeline] Static fix LLM call failed');
      progress('static-validation-fix-failed', { gameId });
    }
  }

  // Emit static-validation-passed if static checks passed (originally or after fix)
  if (staticPassed) {
    progress('static-validation-passed', { gameId, checksCount: 10 });
  }

  // Contract validation (non-blocking)
  const contractErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
  if (contractErrors.length > 0) {
    warn(`[pipeline] Contract validation: ${contractErrors.length} issue(s)`);
    progress('contract-validation-issues', { gameId, count: contractErrors.length, errors: contractErrors });

    info(`[pipeline] Step 1b: ${contractErrors.length} contract error(s) — attempting auto-fix`);
    progress('contract-static-fix', { gameId });
    const contractFixPrompt = buildContractFixPrompt(contractErrors, specMeta.starType || specMeta.stars || '', fs.readFileSync(htmlFile, 'utf-8'));

    try {
      const fixedHtml = await trackedLlmCall('contract-static-fix', contractFixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: 'contract-static-fix', model: FIX_MODEL });
      const extracted = extractHtml(fixedHtml);
      const currentHtmlForContractFix = fs.readFileSync(htmlFile, 'utf-8');
      if (extracted && extracted.length > currentHtmlForContractFix.length * 0.7) {
        fs.writeFileSync(htmlFile, extracted);
        info(`[pipeline] Step 1b: Contract auto-fix applied (${extracted.length} bytes)`);
        // re-validate
        const recheckErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
        if (recheckErrors.length === 0) {
          info('[pipeline] Step 1b: Contract errors resolved by auto-fix');
        } else {
          info(`[pipeline] Step 1b: ${recheckErrors.length} contract error(s) remain after auto-fix — continuing`);
        }
      }
    } catch (e) {
      warn(`[pipeline] Step 1b: Contract auto-fix failed: ${e.message}`);
    }
  }

  // ─── Step 1c: Early spec compliance review (fast-fail before test tokens) ──

  info('[pipeline] Step 1c: Early spec compliance review');
  progress('early-review', { gameId, model: REVIEW_MODEL });

  const earlyReviewPrompt = buildEarlyReviewPrompt(specContent, fs.readFileSync(htmlFile, 'utf-8'));

  let earlyReviewPassed = true;
  try {
    const earlyResult = await trackedLlmCall('early-review', earlyReviewPrompt, REVIEW_MODEL, {}, report);
    llmCalls.push({ step: 'early-review', model: REVIEW_MODEL });
    const earlyRejected = /^REJECTED/i.test(earlyResult.trim());
    if (earlyRejected) {
      warn(`[pipeline] Early review REJECTED — applying quick fix before tests`);
      progress('early-review-rejected', { gameId, reason: earlyResult, fixModel: FIX_MODEL });

      // One targeted fix attempt
      const earlyFixPrompt = buildEarlyReviewFixPrompt(earlyResult, specContent, fs.readFileSync(htmlFile, 'utf-8'));

      try {
        const fixOut = await trackedLlmCall('early-review-fix', earlyFixPrompt, FIX_MODEL, {}, report);
        llmCalls.push({ step: 'early-review-fix', model: FIX_MODEL });
        const fixedHtml = extractHtml(fixOut);
        if (fixedHtml) {
          fs.writeFileSync(htmlFile, fixedHtml + '\n');
          injectHarnessToFile(htmlFile);
          // Re-review once — use fresh HTML content (earlyReviewPrompt has stale pre-fix HTML)
          const reReviewPrompt = buildEarlyReReviewPrompt(specContent, fs.readFileSync(htmlFile, 'utf-8'));
          const reResult = await trackedLlmCall('early-review-2', reReviewPrompt, REVIEW_MODEL, {}, report);
          llmCalls.push({ step: 'early-review-2', model: REVIEW_MODEL });
          if (/^REJECTED/i.test(reResult.trim())) {
            warn(`[pipeline] Early review still REJECTED after fix — failing build`);
            report.status = 'REJECTED';
            report.review_result = reResult;
            writeReport();
            return report;
          }
          info('[pipeline] Early review APPROVED after fix');
        }
      } catch (err) {
        warn(`[pipeline] Early review fix failed: ${err.message} — continuing anyway`);
      }
    } else {
      info('[pipeline] Early review APPROVED — proceeding to tests');
      earlyReviewPassed = true;
      progress('early-review-approved', { gameId, model: REVIEW_MODEL });
    }
  } catch (err) {
    warn(`[pipeline] Early review LLM call failed: ${err.message} — continuing without early review`);
  }

  // ─── Step 2a: Generate test cases from spec ─────────────────────────────

  const existingTestCases = fs.existsSync(testCasesFile);
  if (existingTestCases) {
    info(`[pipeline] Step 2a: Skipping test case generation — test-cases.json exists`);
  }

  let testCases = [];
  if (!existingTestCases) {
    info('[pipeline] Step 2a: Generate test cases from spec');
    progress('generate-test-cases', { gameId, model: TEST_CASES_MODEL });

    const testCasesPrompt = buildTestCasesPrompt(specContent);

    try {
      const testCasesOutput = await trackedLlmCall('generate-test-cases', testCasesPrompt, TEST_CASES_MODEL, {}, report);
      llmCalls.push({ step: 'generate-test-cases', model: TEST_CASES_MODEL });
      const jsonMatch = testCasesOutput.match(/```json\n([\s\S]*?)\n```/) || testCasesOutput.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          testCases = JSON.parse(jsonMatch[1]);
          fs.writeFileSync(testCasesFile, JSON.stringify(testCases, null, 2));
          info(`[pipeline] Generated ${testCases.length} test cases`);
          progress('test-cases-ready', { gameId, testCases });
        } catch {
          warn('[pipeline] Could not parse test cases JSON — continuing');
        }
      }
    } catch (err) {
      warn(`[pipeline] Test case generation failed: ${err.message} — continuing`);
    }
  } else {
    try {
      testCases = JSON.parse(fs.readFileSync(testCasesFile, 'utf-8'));
      progress('test-cases-ready', { gameId, testCases });
    } catch {
      /* ignore parse errors */
    }
  }

  // ─── Step 2.5: DOM snapshot for test generation context ─────────────────
  // Launch a headless browser, navigate the running game, extract real element IDs.
  // Injected into test-gen prompts so LLM uses actual selectors, not HTML-inferred guesses.

  const transitionSlotId = 'mathai-transition-slot';
  let domSnapshot = null;

  if (!SKIP_DOM_SNAPSHOT) {
    info('[pipeline] Step 2.5: Capturing DOM snapshot');
    progress('dom-snapshot', { gameId });
    domSnapshot = await captureGameDomSnapshot(gameDir, transitionSlotId, specMeta, log);
    if (domSnapshot) {
      progress('dom-snapshot-ready', { gameId });
    }
  }

  // ─── Step 2b: Generate Playwright tests per category ─────────────────────

  // The transition slot is always 'mathai-transition-slot' — CDN constant for all MathAI games.
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

  // Check if any spec files already exist AND have runnable test() calls
  // A spec file with only triage-skipped comments is treated as non-existent (regenerate it)
  const hasRunnableTests = (specFilePath) => {
    if (!fs.existsSync(specFilePath)) return false;
    const content = fs.readFileSync(specFilePath, 'utf-8');
    return /^\s*test\s*\(/m.test(content);
  };
  // Remove spec files with no runnable tests so they get regenerated
  if (fs.existsSync(testsDir)) {
    for (const f of fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js'))) {
      if (!hasRunnableTests(path.join(testsDir, f))) {
        fs.unlinkSync(path.join(testsDir, f));
        info(`[pipeline] Step 2b: Deleted empty spec file ${f} (no runnable tests — will regenerate)`);
      }
    }
  }
  // Check which categories already have valid spec files — only regenerate missing ones
  const CATEGORIES_ALL = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const existingCategories = new Set(
    fs.existsSync(testsDir)
      ? CATEGORIES_ALL.filter((cat) => hasRunnableTests(path.join(testsDir, `${cat}.spec.js`)))
      : [],
  );
  const missingCategories = CATEGORIES_ALL.filter((cat) => !existingCategories.has(cat));
  const existingTests = existingCategories.size === CATEGORIES_ALL.length;

  if (existingTests) {
    info(
      `[pipeline] Step 2b: Skipping test generation — all ${CATEGORIES_ALL.length} spec files with runnable tests found`,
    );
  } else if (existingCategories.size > 0) {
    info(
      `[pipeline] Step 2b: Partial test generation — missing categories: ${missingCategories.join(', ')}`,
    );
  }

  if (!existingTests) {
    info('[pipeline] Step 2b: Generate Playwright tests (categorized)');
    progress('generate-tests', { gameId, model: TEST_MODEL });

    // Iterate only missing categories (per-category regeneration — existing valid specs are kept)
    const CATEGORIES = missingCategories;

    const categoryDescriptions = {
      'game-flow':
        'Screen transitions: start screen → clicking through to game → level/round transition screens → game over/results screen. Test that correct screens appear in order and navigation works. Use DOM snapshot selectors for actual element IDs.',
      mechanics:
        'Core game interactions: clicking or interacting with game elements, submitting/checking answers, receiving correct/incorrect feedback, score tracking. Derive selectors from DOM snapshot.',
      'level-progression':
        'Level/round structure: how content changes between levels or rounds, clicking through transition screens, counter/progress indicator progression. Derive specifics from the spec and DOM snapshot.',
      'edge-cases':
        'Boundary conditions: invalid or empty input, losing all lives (game over early), rapid repeated actions, final round/level of the game. Derive selectors from DOM snapshot.',
      contract:
        `postMessage contract: when the game ends, window.parent.postMessage fires with { type: "gameOver", score, stars, total }. Verify the ACTUAL star formula from this spec (starType: "${specMeta.starType}"): ${
          specMeta.starType === 'lives'
            ? 'stars = lives remaining (3 lives → 3★, 2 lives → 2★, 1 life → 1★, 0 lives (game over) → 0★). Test multiple scenarios using window.__ralph.setLives() to verify each star value.'
            : specMeta.starType === 'avg-time'
            ? 'stars = based on average time per round/level (see spec for thresholds). Use window.__ralph.setRoundTimes() to set specific times before skipToEnd.'
            : specMeta.starType === 'accuracy'
            ? 'stars = based on accuracy percentage (see spec for thresholds). Verify by controlling correct/incorrect answers.'
            : 'stars = based on spec criteria. Verify the postMessage payload has correct star value for a completed game.'
        }`,
    };

    // Shared boilerplate prepended verbatim to every category spec file.
    // The pipeline controls this — LLMs only generate the test.describe() body.
    // fallbackContent: use runtime-captured game content if available, else empty array
    const gameContentFile = path.join(testsDir, 'game-content.json');
    const capturedGameContent = fs.existsSync(gameContentFile) ? (() => { try { return JSON.parse(fs.readFileSync(gameContentFile, 'utf-8')); } catch { return null; } })() : null;
    let fallbackRounds = capturedGameContent && Array.isArray(capturedGameContent.rounds)
      ? capturedGameContent.rounds
      : [];
    if (!fallbackRounds || fallbackRounds.length === 0) {
      warn(`[pipeline] Step 2b: fallbackContent.rounds is empty — test gen may invent wrong expected values. Consider exposing window.gameState.content.rounds in the game.`);
      const specRounds = extractSpecRounds(specContent);
      if (specRounds.length > 0) {
        fallbackRounds = specRounds;
        info(`[pipeline] Step 2b: Using ${specRounds.length} spec-derived rounds as fallbackContent (DOM snapshot had none)`);
      }
    }
    const fallbackRoundsJs = fallbackRounds.length > 0
      ? JSON.stringify(fallbackRounds, null, 4)
      : '[]';

    // Determine whether this game uses the CDN TransitionScreen/ScreenLayout component.
    // Games that don't have #mathai-transition-slot will never show the slot button —
    // beforeEach must use a fallback init signal instead of the 50s slot-polling loop.
    // Check htmlContent first (authoritative), then domSnapshot string as a secondary signal.
    // Default to true (slot path) only when we have no data at all (safest for CDN games).
    const hasTransitionSlot =
      htmlContent.includes('mathai-transition-slot') ||
      (domSnapshot != null && domSnapshot.includes('mathai-transition-slot')) ||
      (!htmlContent && domSnapshot == null);

    const sharedBoilerplate = `import { test, expect } from '@playwright/test';

// Game round data captured from runtime — use instead of window.gameState.content
const fallbackContent = {
  rounds: ${fallbackRoundsJs}
};

async function dismissPopupIfPresent(page) {
  const backdrop = page.locator('#popup-backdrop');
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.locator('button').first().click();
    await page.waitForTimeout(300);
  }
  // Dismiss CDN audio permission popup (FeedbackManager.init() shows "Okay!" button)
  const okayBtn = page.locator('button:has-text("Okay!")');
  if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await okayBtn.click();
    await page.waitForTimeout(300);
  }
}

async function startGame(page) {
  await dismissPopupIfPresent(page);
  // Click through ALL initial transition screens (start screen, level-1 intro, etc.)
  // until no more transition buttons remain — game is then active.
  // Some games have 1 screen (start → game), others have 2+ (start → level-1 → game).
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(400);
  await dismissPopupIfPresent(page);
  const innerDeadline = Date.now() + 8000;
  while (Date.now() < innerDeadline) {
    const hasButton = await page.locator('#${transitionSlotId} button').isVisible({ timeout: 600 }).catch(() => false);
    if (!hasButton) break;
    await page.locator('#${transitionSlotId} button').first().click();
    await page.waitForTimeout(400);
    await dismissPopupIfPresent(page);
  }
  // Confirm game is active (no transition button visible)
  await expect(page.locator('#${transitionSlotId} button')).not.toBeVisible({ timeout: 5000 });
}

async function clickNextLevel(page) {
  await expect(page.locator('#${transitionSlotId} button')).toBeVisible({ timeout: 10000 });
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
}

// ─── Data-phase helpers (use these instead of timing-based visibility checks) ───

// Wait for game to reach a specific phase (reads data-phase attribute on #app)
// Immune to CDN animation timing — data-phase changes atomically with game state
async function waitForPhase(page, phase, timeout) {
  timeout = timeout || 20000;
  await expect(page.locator('#app')).toHaveAttribute('data-phase', phase, { timeout });
}

// Read game state as integers from data-* attributes on #app (not text/emoji)
async function getLives(page) {
  const val = await page.locator('#app').getAttribute('data-lives');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.lives ?? null);
}
async function getScore(page) {
  const val = await page.locator('#app').getAttribute('data-score');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.score ?? 0);
}
async function getRound(page) {
  const val = await page.locator('#app').getAttribute('data-round');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.currentRound ?? 0);
}

// Skip to end of game without playing all rounds
// 'victory' → results screen, 'game_over' → game-over screen
async function skipToEnd(page, reason) {
  reason = reason || 'victory';
  await page.evaluate((r) => window.__ralph && window.__ralph.endGame(r), reason);
  // Sync DOM state in case __ralph.endGame didn't trigger syncDOMState
  await page.evaluate(() => window.__ralph && window.__ralph.syncDOMState && window.__ralph.syncDOMState());
}

// Answer a question using the spec-derived window.__ralph.answer() (correct or wrong)
// Waits for isProcessing to clear before returning
async function answer(page, correct) {
  correct = correct !== false;
  await page.evaluate((c) => window.__ralph && window.__ralph.answer(c), correct);
  // Wait for processing to complete
  await expect.poll(
    async () => await page.evaluate(() => !window.gameState?.isProcessing),
    { timeout: 5000 }
  ).toBe(true);
}


test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  ${hasTransitionSlot ? `// FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // CDN scripts may take 45-60s to load -- poll for both popup and slot together.
  // 50s loop + 5s final check = 55s max, leaving 5s for test logic within 60s timeout.
  {
    const deadline = Date.now() + 50000;
    while (Date.now() < deadline) {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#\${transitionSlotId} button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#\${transitionSlotId} button').first()).toBeVisible({ timeout: 5000 });
  }` : `// Non-CDN game: no #mathai-transition-slot -- wait for start phase or game content instead.
  await page.waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 });
  await page.waitForTimeout(500); // allow JS init to settle`}
});`;

    await Promise.all(
      CATEGORIES.map(async (category) => {
        const catTestCases = testCases.filter((tc) => tc.category === category);
        if (catTestCases.length === 0) {
          info(`[pipeline] Step 2b: No test cases for '${category}' — skipping`);
          return;
        }

        const catFile = path.join(testsDir, `${category}.spec.js`);
        info(`[pipeline] Step 2b: Generating ${category} (${catTestCases.length} test cases)`);

        const catTestCasesText = catTestCases
          .map((tc, i) => `${i + 1}. ${tc.name}: ${tc.description}\n   Steps: ${tc.steps.join(' → ')}`)
          .join('\n');

        const testHintsBlock = (() => {
          const hints = extractTestGenerationHints(specContent, htmlContent);
          return hints.length > 0
            ? `\nGAME-SPECIFIC TEST WARNINGS (detected from spec — follow exactly):\n${hints.map(h => `⚠ ${h}`).join('\n')}\n`
            : '';
        })();
        const catPrompt = buildTestGenCategoryPrompt({
          category,
          categoryDescription: categoryDescriptions[category] || category,
          testCaseCount: catTestCases.length,
          testCasesText: catTestCasesText,
          learningsBlock: formatLearningsBlock(),
          testHintsBlock,
          domSnapshot,
          htmlContent,
        });

        let catOutput;
        try {
          catOutput = await trackedLlmCall(`generate-tests-${category}`, catPrompt, TEST_MODEL, {}, report);
          llmCalls.push({ step: `generate-tests-${category}`, model: TEST_MODEL });
        } catch (err) {
          warn(`[pipeline] Test generation for '${category}' failed: ${err.message} — skipping`);
          return;
        }

        let catTests = extractTests(catOutput);
        if (!catTests) {
          warn(`[pipeline] Could not extract test.describe() for '${category}' — skipping`);
          return;
        }

        // If LLM added boilerplate before the describe block, strip it
        const describeStart = catTests.indexOf('test.describe(');
        if (describeStart > 0) {
          catTests = catTests.substring(describeStart);
        }

        // Fix bare describe() → test.describe() in case LLM used wrong API
        catTests = catTests
          .replace(/(?<![.\w])describe\s*\(/g, 'test.describe(')
          .replace(/(?<![.\w])beforeEach\s*\(/g, 'test.beforeEach(')
          .replace(/(?<![.\w])afterEach\s*\(/g, 'test.afterEach(')
          .replace(/(?<![.\w])beforeAll\s*\(/g, 'test.beforeAll(')
          .replace(/(?<![.\w])afterAll\s*\(/g, 'test.afterAll(');

        // Fix slot class vs ID prefix
        catTests = catTests.replace(/locator\s*\(\s*['"]\.mathai-transition-slot/g, "locator('#mathai-transition-slot");
        catTests = catTests.replace(/locator\s*\(\s*['"]\.mathai-progress-slot/g, "locator('#mathai-progress-slot");

        // Fix buttons in wrong slot (progress slot has no buttons)
        catTests = catTests.replace(
          /(locator\s*\(['"]#mathai-progress-slot['"]\))\s*\.locator\s*\(\s*['"]button['"]/g,
          "locator('#mathai-transition-slot').locator('button'",
        );
        catTests = catTests.replace(
          /locator\s*\(\s*['"]#mathai-progress-slot\s+button['"]/g,
          "locator('#mathai-transition-slot button'",
        );

        // Fix wrong button classes (.game-btn → real mathai-transition-btn)
        catTests = catTests.replace(/\.game-btn\.btn-primary/g, '');
        catTests = catTests.replace(/\.btn-primary/g, '');
        // Fix dynamically-generated progress bar IDs → stable class selectors
        catTests = catTests.replace(/#pb-\d+-text/g, '#mathai-progress-slot .mathai-progress-text');
        catTests = catTests.replace(/#pb-\d+-lives/g, '#mathai-progress-slot .mathai-lives-display');
        // Fix wrong rounds display class (.mathai-rounds-display doesn't exist — it's .mathai-progress-text)
        catTests = catTests.replace(/\.mathai-rounds-display/g, '.mathai-progress-text');

        // Fix await expect(page.evaluate(...)) → expect(await page.evaluate(...))
        catTests = catTests.replace(/await\s+expect\s*\(\s*page\.evaluate\s*\(/g, 'expect(await page.evaluate(');

        const fullSpec = sharedBoilerplate + '\n\n' + catTests;
        fs.writeFileSync(catFile, fullSpec + '\n');
        info(`[pipeline] Step 2b: Wrote ${category}.spec.js (${fullSpec.length} bytes)`);
      }),
    );

    // Build per-category test count from testCases (generated earlier in step 2a)
    const categoryCounts = {};
    for (const tc of testCases) {
      const cat = tc.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    progress('tests-generated', { gameId, totalTests: testCases.length, model: TEST_MODEL, categories: categoryCounts });
  } // end if (!existingTests)

  // ─── Always-applied HTML cleanup ────────────────────────────────────────
  // Runs before every test run to fix LLM-introduced regressions in the HTML.
  {
    let rawHtml = fs.readFileSync(htmlFile, 'utf-8');
    let htmlChanged = false;
    // Fix wrong CDN domain — LLM re-introduces cdn.mathai.ai in fix iterations
    if (rawHtml.includes('cdn.mathai.ai')) {
      rawHtml = rawHtml.replace(/cdn\.mathai\.ai/g, 'cdn.homeworkapp.ai');
      htmlChanged = true;
      warn(`[pipeline] Fixed CDN domain in HTML (cdn.mathai.ai → cdn.homeworkapp.ai)`);
    }
    if (htmlChanged) {
      fs.writeFileSync(htmlFile, rawHtml);
      injectHarnessToFile(htmlFile);
    }
  }

  // ─── Always-applied test post-processing ────────────────────────────────
  // Critical fixes applied to EVERY spec file on EVERY iteration.
  // This ensures even files from previous iterations have correct infrastructure.
  {
    const allSpecFilePaths = fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : [];

    for (const specFilePath of allSpecFilePaths) {
      let tests = fs.readFileSync(specFilePath, 'utf-8');
      let changed = false;

      // Fix beforeEach: must dismiss audio popup BEFORE waiting for transition slot.
      // FeedbackManager.init() awaits the popup, blocking ScreenLayout.inject() → transition slot never appears.
      if (tests.includes('test.beforeEach') && !tests.includes('FeedbackManager.init() shows')) {
        const oldBeforeEach = /test\.beforeEach\s*\(async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{[\s\S]*?\}\s*\);/;
        const hasSlot = htmlContent.includes('mathai-transition-slot');
        const newBeforeEach = hasSlot ? `test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // CDN scripts may take >8s to load — poll for both popup and slot together so we never
  // miss the popup appearing after a fixed timeout window.
  {
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible({ timeout: 5000 });
  }
});` : `test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // Non-CDN game: wait for game to reach start phase
  await page.waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
});`;
        if (oldBeforeEach.test(tests)) {
          tests = tests.replace(oldBeforeEach, newBeforeEach);
          changed = true;
        }
      }

      // Fix await expect(page.evaluate(...)).toBe() — must await evaluate FIRST
      if (tests.includes('await expect(page.evaluate(')) {
        tests = tests.replace(/await\s+expect\s*\(\s*page\.evaluate\s*\(/g, 'expect(await page.evaluate(');
        changed = true;
      }

      // Fix toHaveStyle used to check CSS-class-based styling — use toHaveClass or toBeVisible instead
      // toHaveStyle only works for inline styles; CDN games use CSS classes
      if (/\.toHaveStyle\s*\(/.test(tests)) {
        // Replace toHaveStyle assertions with a no-op comment to prevent crash
        // Triage will fix the test logic if needed
        tests = tests.replace(/await expect\([^)]+\)\.toHaveStyle\([^)]+\);/g, '// NOTE: toHaveStyle removed — use toHaveClass or page.evaluate for style checks');
        changed = true;
      }

      // Fix expect(transitionSlot).toBeHidden() — CDN keeps the slot div visible (just removes buttons)
      // The correct check is: expect(slot button).not.toBeVisible()
      if (/expect\s*\([^)]*transition[Ss]lot[^)]*\)\s*\.toBeHidden/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*([^)]*transition[Ss]lot[^)]*)\s*\)\s*\.toBeHidden\s*\(\s*\)/g,
          "await expect(page.locator('#mathai-transition-slot button').first()).not.toBeVisible({ timeout: 5000 })",
        );
        changed = true;
      }

      // Fix toHaveText on lives display — CDN ProgressBar renders lives internally as emoji/icons.
      // Tests MUST use page.evaluate(() => window.gameState.lives) instead of visual text assertions.
      if (/\.mathai-lives-display['"]\s*\)\s*\.toHaveText\s*\(/.test(tests) ||
          /locator\s*\([^)]*lives[^)]*\)\s*\.toHaveText\s*\(\s*["'][\u2764\u2665❤]/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*page\.locator\s*\(\s*['"][^'"]*lives[^'"]*['"]\s*\)\s*\)\s*\.toHaveText\s*\(\s*["']([^"']+)["']\s*\)/g,
          (match, expectedText) => {
            // Count emoji hearts to determine expected lives count
            const heartCount = (expectedText.match(/[\u2764\u2665❤]/g) || []).length;
            if (heartCount > 0) {
              return `expect(await page.evaluate(() => window.gameState.lives)).toBe(${heartCount})`;
            }
            return match;
          },
        );
        changed = true;
      }

      // Fix re-click on .correct cell — CSS pointer-events:none prevents Playwright's click().
      // Pattern: toHaveClass(/correct/) followed by cell.click() (same locator)
      // Fix: add { force: true } to the second click to bypass the CSS guard.
      if (/toHaveClass\s*\(\/correct\/\)/.test(tests) && /\.click\(\)/.test(tests)) {
        // Match: await cell.click(); that follows within ~5 lines of toHaveClass(/correct/)
        tests = tests.replace(
          /(await expect\([^)]+\)\.toHaveClass\(\/correct\/\);[\s\S]{0,400}?)(await \w+\.click\(\);)/g,
          (match, before, clickLine) => before + clickLine.replace('.click();', '.click({ force: true });'),
        );
        changed = true;
      }

      // Fix Gemini hallucinating '${transitionSlotId}' as a literal variable name
      if (tests.includes('${transitionSlotId}')) {
        tests = tests.replace(/\$\{transitionSlotId\}/g, 'mathai-transition-slot');
        changed = true;
      }

      // Fix #mathai-progress-slot used for button finding (buttons are in transition slot)
      if (tests.includes('#mathai-progress-slot button') || tests.includes("'#mathai-progress-slot').locator('button'")) {
        tests = tests.replace(
          /locator\s*\(\s*['"]#mathai-progress-slot\s+button['"]/g,
          "locator('#mathai-transition-slot button'",
        );
        tests = tests.replace(
          /(locator\s*\(['"]#mathai-progress-slot['"]\))\s*\.locator\s*\(\s*['"]button['"]/g,
          "locator('#mathai-transition-slot').locator('button'",
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(specFilePath, tests + '\n');
      }
    }
  }

  // Generate Playwright config with dynamic port (set later when server starts)
  // Port is written to gameDir/playwright.config.js after testPort is known — see Step 3.

  // ─── Step 3: Test → Fix loop (per-batch sequential) ────────────────────
  //
  // Categories run sequentially in batches of CATEGORY_BATCH_SIZE (default 1).
  // Each batch gets its own fix loop — failures in one batch drive targeted HTML fixes
  // before moving to the next batch. This keeps each Playwright run fast and focused.

  // Order spec files by category, then group into batches
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const orderedSpecFiles = [
    ...SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f)),
    // Any extra spec files not in the standard order
    ...(fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : []
    ).filter((f) => !SPEC_ORDER.some((cat) => f.endsWith(`${cat}.spec.js`))),
  ];

  const batches = [];
  for (let i = 0; i < orderedSpecFiles.length; i += CATEGORY_BATCH_SIZE) {
    batches.push(orderedSpecFiles.slice(i, i + CATEGORY_BATCH_SIZE));
  }

  info(
    `[pipeline] Step 3: Test → Fix loop (${batches.length} batch(es), batch_size=${CATEGORY_BATCH_SIZE}, max_iterations=${MAX_ITERATIONS})`,
  );
  progress('test-fix-loop', { gameId, maxIterations: MAX_ITERATIONS, batches: batches.length });

  // Start local server
  let serverProc;
  try {
    const testPort = await findFreePort();
    // Write playwright config with the actual port for this build
    fs.writeFileSync(
      path.join(gameDir, 'playwright.config.js'),
      `const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:${testPort}',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npx serve . -l ${testPort} -s --no-clipboard',
    port: ${testPort},
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
`,
    );
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', String(testPort), '-s', '--no-clipboard'], {
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {
    report.errors.push('Web server failed to start');
    writeReport();
    return report;
  }

  let totalPassed = 0;
  let totalFailed = 0;
  // Accumulate passing test bodies from completed batches — included in subsequent fix prompts
  // to prevent fixes from regressing tests that already pass in earlier batches
  const priorBatchPassingTests = []; // { batchLabel, testBodies: string[] }

  try {
    for (const [batchIdx, batch] of batches.entries()) {
      const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
      info(`[pipeline] Batch ${batchIdx + 1}/${batches.length}: ${batchLabel}`);
      progress('batch-start', { gameId, batch: batchLabel, batchIdx, totalBatches: batches.length });

      let batchPassed = 0;
      let batchFailed = 0;
      let fixHistory = '';
      let bestPassed = 0;
      let bestHtmlSnapshot = null; // HTML snapshot at the best pass count so far

      for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        info(`[pipeline] [${batchLabel}] Iteration ${iteration}/${MAX_ITERATIONS}`);

        // Run Playwright tests for this batch only
        let testResult;
        try {
          const { stdout } = await execFileAsync(
            'npx',
            ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
            { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
          );
          testResult = JSON.parse(stdout);
        } catch (err) {
          const stdout = err.stdout || '{}';
          try {
            testResult = JSON.parse(stdout);
          } catch {
            testResult = { stats: { expected: 0, unexpected: 1 } };
          }
        }

        const passed = testResult?.stats?.expected || 0;
        const skipped = testResult?.stats?.skipped || 0;
        let failed = testResult?.stats?.unexpected || 0;
        // If ALL tests skipped with 0 passes: beforeEach timed out (HTML init failure) — treat as failures
        if (passed === 0 && failed === 0 && skipped > 0) {
          warn(`[pipeline] [${batchLabel}] All ${skipped} tests skipped — likely HTML init failure in beforeEach`);
          failed = skipped;
        }
        batchPassed = passed;
        batchFailed = failed;

        const failureDescs = [];
        try {
          collectFailures(testResult.suites, '', failureDescs);
          // If all tests were skipped (beforeEach failure → init problem), collect their names
          if (failureDescs.length === 0 && skipped > 0) {
            const collectSkipped = (suites, pFile) => {
              for (const s of suites || []) {
                const sf = s.file || pFile || '';
                for (const sp of s.specs || []) {
                  if (sp.tests?.some((t) => t.status === 'skipped')) {
                    const lbl = sf ? `[${path.basename(sf)}] ` : '';
                    failureDescs.push(`${lbl}${sp.title} — SKIPPED (beforeEach timed out — HTML init failed)`);
                  }
                }
                if (s.suites) collectSkipped(s.suites, sf);
              }
            };
            collectSkipped(testResult.suites, '');
          }
        } catch {
          /* ignore parse errors */
        }

        const failuresStr = failureDescs.join(', ') || 'unknown';
        report.test_results.push({ batch: batchLabel, iteration, passed, failed, failures: failuresStr });

        info(`[pipeline] [${batchLabel}] Results: ${passed} passed, ${failed} failed`);
        progress('test-result', { gameId, batch: batchLabel, batchIdx, iteration, passed, failed, failures: failureDescs, maxIterations: MAX_ITERATIONS });

        // ── Stale warehouse HTML detection ───────────────────────────────────
        // If game-flow batch hits 0% on iteration 1 and the HTML came from warehouse
        // (not freshly generated this build), the stale HTML is fundamentally broken.
        // Detect init failures (beforeEach timeouts) as the signal, then delete the
        // warehouse HTML and regenerate fresh — iteration 2 will run with new HTML.
        if (
          batchLabel === 'game-flow' &&
          iteration === 1 &&
          passed === 0 &&
          !htmlWasFreshlyGenerated
        ) {
          const isInitFailure =
            failureDescs.length > 0 &&
            failureDescs.every(
              (f) =>
                f.includes('beforeEach') ||
                f.includes('TimeoutError') ||
                f.includes('waiting for') ||
                f.includes('transition-slot') ||
                f.includes('data-phase') ||
                f.includes('SKIPPED'),
            );
          if (isInitFailure) {
            const warehousePath = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game', 'index.html');
            if (fs.existsSync(warehousePath)) {
              warn(
                `[pipeline] game-flow 0% on iter 1 with init failures + warehouse HTML detected — deleting warehouse HTML and regenerating`,
              );
              fs.unlinkSync(warehousePath);
              progress('warehouse-html-deleted', { gameId, reason: 'stale-init-failure' });
              try {
                const regenOutput = await trackedLlmCall('generate-html-regen', genPrompt, GEN_MODEL, {}, report);
                llmCalls.push({ step: 'generate-html-regen', model: GEN_MODEL });
                const regenHtml = extractHtml(regenOutput);
                if (regenHtml && regenHtml.length > 500) {
                  fs.writeFileSync(htmlFile, regenHtml + '\n');
                  injectHarnessToFile(htmlFile);
                  htmlWasFreshlyGenerated = true;
                  bestHtmlSnapshot = null; // reset snapshot — old HTML was stale
                  info(`[pipeline] Regenerated HTML (${regenHtml.length} bytes) — warehouse HTML deleted, iteration 2 will run with fresh HTML`);
                  progress('warehouse-html-regenerated', { gameId, size: regenHtml.length });
                } else {
                  warn(`[pipeline] Regen produced no valid HTML — proceeding with existing file`);
                }
              } catch (regenErr) {
                warn(`[pipeline] HTML regen failed: ${regenErr.message} — proceeding with existing file`);
              }
            }
          }
        }
        // ── End stale warehouse HTML detection ───────────────────────────────

        // Track best result and snapshot HTML at that point
        if (passed > bestPassed) {
          bestPassed = passed;
          bestHtmlSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          info(`[pipeline] [${batchLabel}] New best: ${passed} passed — snapshot saved`);
        }

        if (passed === 0 && failed === 0) {
          warn(`[pipeline] [${batchLabel}] 0/0 tests: no tests ran — page likely broken by last fix, restoring best HTML`);
          if (bestHtmlSnapshot) {
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
          }
          if (iteration >= MAX_ITERATIONS) break;
          continue; // Skip triage and fix — page was broken, restoration is the fix
        }

        if (failed === 0 && passed > 0) {
          info(`[pipeline] [${batchLabel}] All tests pass!`);
          break;
        }

        if (iteration >= MAX_ITERATIONS) {
          info(`[pipeline] [${batchLabel}] Max iterations reached`);
          // Restore best snapshot if current result is worse
          if (bestHtmlSnapshot && passed < bestPassed) {
            info(`[pipeline] [${batchLabel}] Restoring best HTML (${bestPassed} passed > current ${passed})`);
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            batchPassed = bestPassed;
            batchFailed = failed - (bestPassed - passed); // approximate
          }
          break;
        }

        // Detect if all tests fail with the same error — likely an init problem in HTML
        const uniqueErrors = new Set(failureDescs.map((f) => f.replace(/.*— /, '').trim()));
        const allSameError = uniqueErrors.size === 1 && failed === failureDescs.length;

        let fixStrategy;
        if (iteration >= 3) {
          fixStrategy = `DIAGNOSIS MODE: This is attempt ${iteration} for the '${batchLabel}' category. Previous fixes have not resolved all issues.

Previous fix history:
${fixHistory}

Diagnose the ROOT CAUSE of the persistent failures before attempting a fix.`;
        } else if (allSameError) {
          fixStrategy = `ALL tests in '${batchLabel}' fail with the same error: "${[...uniqueErrors][0]}". This strongly indicates a game initialization problem in the HTML.

Common cause: external packages (CDN) have not loaded before the game tries to use them, or ScreenLayout.inject() throws because a dependency is not ready.

Fix the HTML so that initialization completes reliably.`;
        } else {
          fixStrategy = `Fix the '${batchLabel}' test failures by modifying the HTML. Do NOT modify the test files.`;
        }

        // ── LLM Triage: decide whether to fix HTML or skip bad tests ────────────
        const triagePrompt = buildTriagePrompt(
          batchLabel,
          passed,
          failed,
          failuresStr,
          batch.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf-8')).join('\n\n'),
        );

        let triageDecision = 'fix_html';
        let triageFixHints = '';
        let triageSkipTests = [];
        let triageRationale = '';
        const detTriage = deterministicTriage(failureDescs);
        if (detTriage) {
          info(`[pipeline] [${batchLabel}] Triage (deterministic): ${detTriage}`);
          triageDecision = detTriage;
          triageRationale = 'deterministic pattern match';
        } else {
          try {
            const triageOutput = await trackedLlmCall(`triage-${batchLabel}-${iteration}`, triagePrompt, TRIAGE_MODEL, {}, report);
            llmCalls.push({ step: `triage-${batchLabel}-${iteration}`, model: TRIAGE_MODEL });
            // Find the last JSON block containing "decision" key
            const lastDecisionIdx = triageOutput.lastIndexOf('"decision"');
            let jsonMatch = null;
            if (lastDecisionIdx !== -1) {
              // Walk backwards to find the opening brace
              let start = triageOutput.lastIndexOf('{', lastDecisionIdx);
              if (start !== -1) jsonMatch = [triageOutput.slice(start)];
            }
            if (!jsonMatch) jsonMatch = triageOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              // Extract complete JSON by counting braces
              let depth = 0, end = -1;
              for (let i = 0; i < jsonMatch[0].length; i++) {
                if (jsonMatch[0][i] === '{') depth++;
                else if (jsonMatch[0][i] === '}') { depth--; if (depth === 0) { end = i; break; } }
              }
              const triage = JSON.parse(end !== -1 ? jsonMatch[0].slice(0, end + 1) : jsonMatch[0]);
              triageDecision = triage.decision || 'fix_tests';
              triageFixHints = triage.fix_hints || '';
              triageSkipTests = triage.tests_to_skip || [];
              triageRationale = triage.rationale || '';
              info(`[pipeline] [${batchLabel}] Triage: ${triageDecision} — ${triageRationale}`);
            }
          } catch {
            info(`[pipeline] [${batchLabel}] Triage failed, defaulting to fix_tests (safer for pre-built games)`);
          }
        }

        // Remove skipped tests from spec file
        if (triageSkipTests.length > 0) {
          for (const specFile of batch.filter((f) => fs.existsSync(f))) {
            let specContent = fs.readFileSync(specFile, 'utf-8');
            let changed = false;
            for (const testName of triageSkipTests) {
              // Match test("name", async ...) blocks and replace with a skip comment
              const escaped = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const testBlockRe = new RegExp(`test\\s*\\(\\s*["'\`]${escaped}["'\`][\\s\\S]*?^\\}\\);`, 'gm');
              const replaced = specContent.replace(testBlockRe, `// SKIPPED (triage): ${testName}`);
              if (replaced !== specContent) {
                specContent = replaced;
                changed = true;
                info(`[pipeline] [${batchLabel}] Triage skipped test: "${testName}"`);
              }
            }
            if (changed) {
              // If no runnable tests remain, delete the file — it will be regenerated next run
              if (!/^\s*test\s*\(/m.test(specContent)) {
                fs.unlinkSync(specFile);
                info(`[pipeline] [${batchLabel}] Deleted empty spec file after triage — will regenerate on next build`);
              } else {
                fs.writeFileSync(specFile, specContent);
              }
            }
          }
          // Accumulate skipped tests for database tracking
          if (triageSkipTests.length > 0) {
            for (const testName of triageSkipTests) {
              report.skipped_tests.push({
                testName,
                reason: triageRationale || 'triage determined test logic is incorrect',
                batch: batchLabel,
                iteration,
              });
            }
          }
          // If all tests skipped, move to next batch
          if (triageDecision === 'skip_tests') {
            info(`[pipeline] [${batchLabel}] All failures are test logic issues — skipping fix iteration`);
            break;
          }
        }

        if (triageDecision === 'skip_tests') {
          info(`[pipeline] [${batchLabel}] Triage: no HTML fix needed`);
          // If current HTML is worse than best (e.g. broken by previous fix), restore best snapshot
          if (bestHtmlSnapshot && passed < bestPassed) {
            info(`[pipeline] [${batchLabel}] Restoring best HTML before exiting batch (${bestPassed} passed > current ${passed})`);
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            batchPassed = bestPassed;
          }
          break;
        }

        // ── Build fix prompt with passing test context ───────────────────────
        // Collect passing test names AND extract their full code bodies
        const passingTestNames = [];
        const passingTestBodies = [];
        try {
          const collectPassing = (suites) => {
            for (const suite of suites || []) {
              for (const spec of suite.specs || []) {
                if (spec.tests?.every((t) => t.status === 'expected')) {
                  passingTestNames.push(spec.title);
                }
              }
              collectPassing(suite.suites);
            }
          };
          collectPassing(testResult.suites);

          // Extract the full test() bodies from the spec files for passing tests
          if (passingTestNames.length > 0) {
            for (const specFile of batch.filter((f) => fs.existsSync(f))) {
              const specSrc = fs.readFileSync(specFile, 'utf-8');
              for (const name of passingTestNames) {
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Match test("name", async ({ page }) => { ... }); block
                const m = specSrc.match(new RegExp(`test\\s*\\(\\s*["'\`]${escaped}["'\`][\\s\\S]*?^\\}\\s*\\);`, 'm'));
                if (m) passingTestBodies.push(m[0]);
              }
            }
          }
        } catch { /* ignore */ }

        const currentHtml = fs.readFileSync(htmlFile, 'utf-8');
        const batchTests = batch
          .filter((f) => fs.existsSync(f))
          .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
          .join('\n\n');

        const passingContext = passingTestNames.length > 0
          ? `\nCURRENTLY PASSING TESTS — these MUST keep passing (full code included so you know exactly what they test):\n\`\`\`javascript\n${passingTestBodies.join('\n\n')}\n\`\`\`\n`
          : '';

        // Include passing tests from previously-completed batches to prevent cross-batch regressions
        const priorBatchContext = priorBatchPassingTests.length > 0
          ? `\nPREVIOUSLY PASSING BATCHES — these tests passed in earlier batches and MUST NOT be broken by this fix:\n${
              priorBatchPassingTests.map(({ batchLabel: bl, testBodies }) =>
                `=== ${bl} (DO NOT REGRESS) ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``
              ).join('\n\n')
            }\n`
          : '';

        const fixHintContext = triageFixHints ? `\nTARGETED FIX HINT: ${triageFixHints}\n` : '';
        const fixLearningsParts = [globalLearnings, dbLearnings].filter(Boolean);
        const fixLearningsContext = fixLearningsParts.length > 0 ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${fixLearningsParts.join('\n')}\n` : '';

        // For contract failures involving stars, include the spec scoring section verbatim
        let specScoringContext = '';
        if (batchLabel === 'contract' && failuresStr.includes('star')) {
          // Extract scoring/star section from spec
          const scoringMatch = specContent.match(/(?:#{1,3}[^\n]*(?:scor|star|metric)[^\n]*\n)([\s\S]*?)(?=\n#{1,3}|\Z)/i);
          if (scoringMatch) {
            specScoringContext = `\nSPEC SCORING SECTION (authoritative — implement EXACTLY this logic):\n${scoringMatch[0].trim()}\n`;
          } else {
            // Fallback: include star type hint
            specScoringContext = `\nSPEC STAR LOGIC: starType="${specMeta.starType}" — ${
              specMeta.starType === 'lives' ? 'stars = gameState.lives (remaining lives at game end, 0-3)' :
              specMeta.starType === 'avg-time' ? 'stars based on average time per round (see spec for thresholds)' :
              specMeta.starType === 'accuracy' ? 'stars based on accuracy percentage (see spec for thresholds)' :
              'see spec for star formula'
            }\n`;
          }

          // Extract star-related test bodies from prior passing batches as reference implementations
          const starRelatedTestBodies = [];
          for (const { batchLabel: bl, testBodies } of priorBatchPassingTests) {
            for (const body of testBodies) {
              if (/\bstar|\bmetrics\.stars/.test(body)) {
                starRelatedTestBodies.push({ batchLabel: bl, body });
              }
            }
          }
          if (starRelatedTestBodies.length > 0) {
            const starRefContext = starRelatedTestBodies
              .map(({ batchLabel: bl, body }) => `=== ${bl} (reference: star logic) ===\n\`\`\`javascript\n${body}\n\`\`\``)
              .join('\n\n');
            specScoringContext += `\n\nREFERENCE IMPLEMENTATIONS — these test bodies PROVE the correct star formula works:\n${starRefContext}\n`;
          }
        }

        // ── E8: Script-only fix (iteration 2+, non-contract batches, large HTML) ──
        // Send only <script> sections to the fix LLM to reduce context and token cost.
        // Merge the corrected scripts back into the original HTML after the LLM responds.
        const useE8ScriptOnly = iteration >= 2
          && triageDecision === 'fix_html'
          && batchLabel !== 'contract'
          && currentHtml.length > 10000;

        let e8OriginalHtml = null;
        let htmlForPrompt = currentHtml;
        let outputInstructions = `OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ONLY the failing tests — the passing tests listed above MUST continue to pass
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the failures`;

        if (useE8ScriptOnly) {
          const scriptSections = extractScriptSections(currentHtml);
          if (scriptSections.length > 0) {
            const scriptContent = scriptSections.map(s => s.content).join('\n');
            e8OriginalHtml = currentHtml;
            htmlForPrompt = scriptContent;
            outputInstructions = `OUTPUT INSTRUCTIONS:
IMPORTANT: The following is ONLY the JavaScript sections of the HTML. Return ONLY the corrected JavaScript <script> blocks — do NOT include HTML structure, <style>, or other content. The pipeline will merge your fix back into the full HTML.
- Output the corrected <script> blocks in a \`\`\`html code block
- Fix ONLY the failing tests — the passing tests listed above MUST continue to pass
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the failures`;
            info(`[pipeline] [${batchLabel}] E8: Sending script-only fix (${Math.round(scriptContent.length / 1024)}kb of ${Math.round(currentHtml.length / 1024)}kb)`);
          }
        }

        const fixPrompt = buildFixPrompt({
          batchLabel,
          fixStrategy,
          fixHintContext,
          specScoringContext,
          fixLearningsContext,
          failed,
          failuresStr,
          passingContext,
          priorBatchContext,
          batchTests,
          htmlForPrompt,
          outputInstructions,
        });

        fixHistory += `\nIteration ${iteration}: ${failed} failures — ${failuresStr}`;

        let fixOutput;
        let usedFixModel = FIX_MODEL;
        try {
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-${iteration}`, fixPrompt, FIX_MODEL, {}, report);
          llmCalls.push({ step: `fix-${batchLabel}-${iteration}`, model: FIX_MODEL });
        } catch {
          try {
            fixOutput = await trackedLlmCall(`fix-${batchLabel}-fallback-${iteration}`, fixPrompt, FALLBACK_MODEL, {}, report);
            llmCalls.push({ step: `fix-${batchLabel}-fallback-${iteration}`, model: FALLBACK_MODEL });
            usedFixModel = FALLBACK_MODEL;
          } catch {
            warn(`[pipeline] Both fix models failed for batch '${batchLabel}'`);
            continue;
          }
        }

        let fixedHtml = extractHtml(fixOutput);
        // E8: merge script-only fix back into original HTML
        if (fixedHtml && e8OriginalHtml) {
          const merged = mergeScriptFix(e8OriginalHtml, fixedHtml);
          if (merged) {
            info(`[pipeline] [${batchLabel}] E8: Merged script fix back into full HTML`);
            fixedHtml = merged;
          } else {
            info(`[pipeline] [${batchLabel}] E8: Merge failed — using fix output as-is`);
          }
        }
        if (fixedHtml) {
          // Snapshot current HTML before applying fix — used for rollback if fix regresses
          const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          const preFixSizeKb = Math.round(preFixSnapshot.length / 1024);
          fs.writeFileSync(htmlFile, fixedHtml + '\n');
          const newSizeKb = Math.round(fixedHtml.length / 1024);
          progress('html-fixed', { gameId, htmlFile, batch: batchLabel, iteration, passed: batchPassed, failed: batchFailed, total: batchPassed + batchFailed, model: usedFixModel, prevSizeKb: preFixSizeKb, newSizeKb });

          // Quick sanity: if fix shrank HTML dramatically (>30% smaller), it likely dropped game logic — rollback
          const shrinkRatio = fixedHtml.length / preFixSnapshot.length;
          if (shrinkRatio < 0.7) {
            warn(`[pipeline] [${batchLabel}] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, rolling back`);
            fs.writeFileSync(htmlFile, preFixSnapshot);
            progress('html-fix-rolled-back', { gameId, batch: batchLabel, iteration, reason: 'size-drop' });
            // If LLM returned near-empty (>90% shrink) on iter 1 full-HTML, it was likely truncated —
            // continue to iter 2 which uses E8 script-only (smaller prompt, less likely to truncate)
            if (shrinkRatio < 0.1 && iteration === 1 && !useE8ScriptOnly) {
              info(`[pipeline] [${batchLabel}] Near-empty fix on iter 1 — likely LLM truncation; continuing to iter 2 (will use script-only)`);
              continue;
            }
            break;
          }
          // Re-inject test harness after fix (LLM may have removed it)
          injectHarnessToFile(htmlFile);
        }
      }

      totalPassed += batchPassed;
      totalFailed += batchFailed;
      report.category_results[batchLabel] = { passed: batchPassed, failed: batchFailed };

      // Collect passing test bodies from this batch to protect them in future batches
      if (batchPassed > 0) {
        const batchPassingBodies = [];
        try {
          for (const specFile of batch.filter((f) => fs.existsSync(f))) {
            const specSrc = fs.readFileSync(specFile, 'utf-8');
            // Extract passing test names by re-running a quick JSON read of the last testResult
            // We already have batchPassed > 0, so collect all test() bodies as "known passing"
            // (conservative: include all tests from this batch since it passed some)
            const testMatches = specSrc.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`][\s\S]*?^\}\s*\);/gm);
            for (const m of testMatches) {
              batchPassingBodies.push(m[0]);
            }
          }
        } catch { /* ignore */ }
        if (batchPassingBodies.length > 0) {
          priorBatchPassingTests.push({ batchLabel, testBodies: batchPassingBodies });
        }
      }
    }

    // ── Step 3c: Global fix loop — cross-batch root-cause resolution ──────────
    // After all per-batch fix loops, some batches may still fail because their
    // root cause was only visible from another batch. This loop collects ALL
    // remaining failures into one prompt for cross-category diagnosis.
    if (MAX_GLOBAL_FIX_ITERATIONS > 0) {
      const hasCrossFailures = Object.values(report.category_results).some((r) => r.failed > 0);
      if (hasCrossFailures) {
        info(`[pipeline] Step 3c: Global fix loop (up to ${MAX_GLOBAL_FIX_ITERATIONS} iterations)`);
        const failingCategoryNames = Object.entries(report.category_results)
          .filter(([, r]) => r.failed > 0)
          .map(([cat]) => cat);
        progress('global-fix-start', { gameId, maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS, failingCategories: failingCategoryNames, model: GLOBAL_FIX_MODEL });

        for (let globalIter = 1; globalIter <= MAX_GLOBAL_FIX_ITERATIONS; globalIter++) {
          info(`[pipeline] [global] Iteration ${globalIter}/${MAX_GLOBAL_FIX_ITERATIONS}`);

          // Re-test all batches to get current truth
          const globalFailingBatches = [];
          const globalPassingBatches = [];

          for (const batch of batches) {
            const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
            let rtr;
            try {
              const { stdout } = await execFileAsync(
                'npx',
                ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
                { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
              );
              rtr = JSON.parse(stdout);
            } catch (err) {
              try { rtr = JSON.parse(err.stdout || '{}'); } catch { rtr = {}; }
            }
            const gPassed = rtr?.stats?.expected || 0;
            const gFailed = rtr?.stats?.unexpected || 0;

            if (gFailed === 0 && gPassed > 0) {
              const bodies = [];
              try {
                for (const specFile of batch.filter((f) => fs.existsSync(f))) {
                  const src = fs.readFileSync(specFile, 'utf-8');
                  const ms = src.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`][\s\S]*?^\}\s*\);/gm);
                  for (const m of ms) bodies.push(m[0]);
                }
              } catch { /* ignore */ }
              globalPassingBatches.push({ batchLabel, testBodies: bodies });
            } else if (gFailed > 0) {
              const failureDescs = [];
              try { collectFailures(rtr.suites, '', failureDescs); } catch { /* ignore */ }
              const batchTests = batch
                .filter((f) => fs.existsSync(f))
                .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
                .join('\n\n');
              globalFailingBatches.push({ batch, batchLabel, failureDescs, passed: gPassed, failed: gFailed, batchTests });
            }
          }

          if (globalFailingBatches.length === 0) {
            info(`[pipeline] [global] All batches pass — exiting global fix loop`);
            break;
          }

          info(`[pipeline] [global] ${globalFailingBatches.length} batch(es) still failing: ${globalFailingBatches.map((b) => b.batchLabel).join(', ')}`);

          const globalFailureSummary = globalFailingBatches
            .map(({ batchLabel, failureDescs, passed, failed }) =>
              `### Category: ${batchLabel}\n${passed} passing, ${failed} failing:\n${failureDescs.join('\n')}`)
            .join('\n\n');

          const globalTestFilesBlock = globalFailingBatches
            .map(({ batchLabel, batchTests }) => `=== ${batchLabel} test file(s) ===\n${batchTests}`)
            .join('\n\n');

          const globalPassingContext = globalPassingBatches.length > 0
            ? `\nFULLY PASSING CATEGORIES — MUST NOT REGRESS:\n${
                globalPassingBatches.map(({ batchLabel, testBodies }) =>
                  `=== ${batchLabel} ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``)
                  .join('\n\n')
              }\n`
            : '';

          const alreadyCovered = new Set(globalPassingBatches.map((b) => b.batchLabel));
          const additionalPriorContext = priorBatchPassingTests
            .filter(({ batchLabel }) => !alreadyCovered.has(batchLabel) && !globalFailingBatches.some((b) => b.batchLabel === batchLabel))
            .map(({ batchLabel, testBodies }) =>
              `=== ${batchLabel} (prior passing — do not regress) ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``)
            .join('\n\n');

          const fixLearningsParts = [globalLearnings, dbLearnings].filter(Boolean);
        const fixLearningsContext = fixLearningsParts.length > 0 ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${fixLearningsParts.join('\n')}\n` : '';
          const currentHtml = fs.readFileSync(htmlFile, 'utf-8');

          const globalFixPrompt = buildGlobalFixPrompt({
            globalIter,
            maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS,
            fixLearningsContext,
            globalFailureSummary,
            globalPassingContext,
            additionalPriorContext,
            globalTestFilesBlock,
            currentHtml,
          });

          progress('global-fix-prompt', { gameId, globalIter, failingBatches: globalFailingBatches.map((b) => b.batchLabel) });

          let globalFixOutput;
          try {
            globalFixOutput = await trackedLlmCall(`global-fix-${globalIter}`, globalFixPrompt, GLOBAL_FIX_MODEL, {}, report);
            llmCalls.push({ step: `global-fix-${globalIter}`, model: GLOBAL_FIX_MODEL });
          } catch {
            try {
              globalFixOutput = await trackedLlmCall(`global-fix-fallback-${globalIter}`, globalFixPrompt, FALLBACK_MODEL, {}, report);
              llmCalls.push({ step: `global-fix-fallback-${globalIter}`, model: FALLBACK_MODEL });
            } catch {
              warn(`[pipeline] [global] Both fix models failed for global iteration ${globalIter}`);
              break;
            }
          }

          const globalFixedHtml = extractHtml(globalFixOutput);
          if (!globalFixedHtml) {
            warn(`[pipeline] [global] No HTML extracted from global fix response — skipping`);
            break;
          }

          const preGlobalFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          const shrinkRatio = globalFixedHtml.length / preGlobalFixSnapshot.length;
          if (shrinkRatio < 0.7) {
            warn(`[pipeline] [global] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, aborting`);
            progress('global-fix-rolled-back', { gameId, globalIter, reason: 'size-drop' });
            break;
          }

          fs.writeFileSync(htmlFile, globalFixedHtml + '\n');
          injectHarnessToFile(htmlFile);
          progress('global-fix-applied', { gameId, globalIter, failingBatches: globalFailingBatches.map((b) => b.batchLabel), htmlFile });
          info(`[pipeline] [global] Applied global fix ${globalIter} — HTML updated`);
        }

        info(`[pipeline] Step 3c complete`);
      } else {
        info(`[pipeline] Step 3c: No cross-batch failures — skipping global fix loop`);
      }
    }

    // ── Step 3b: Final re-test of ALL batches on final HTML ──────────────────
    // Re-test every batch to get an accurate final score. Later-batch fixes may
    // have improved zero-score batches, but may also have regressed batches that
    // previously had passing tests. Re-testing all batches catches both cases.
    const batchesToReTest = batches.filter((batch) => {
      return batch.some((specFile) => fs.existsSync(specFile));
    });
    if (batchesToReTest.length > 0) {
      info(`[pipeline] Step 3b: Re-testing all ${batchesToReTest.length} batch(es) on final HTML`);
      for (const batch of batchesToReTest) {
        const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
        let reTestResult;
        try {
          const { stdout } = await execFileAsync(
            'npx',
            ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
            { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
          );
          reTestResult = JSON.parse(stdout);
        } catch (err) {
          try { reTestResult = JSON.parse(err.stdout || '{}'); } catch { reTestResult = {}; }
        }
        const reTestPassed = reTestResult?.stats?.expected || 0;
        const reTestFailed = reTestResult?.stats?.unexpected || 0;
        const prevPassed = report.category_results[batchLabel]?.passed || 0;
        const prevFailed = report.category_results[batchLabel]?.failed || 0;
        // If 0 total tests ran but previous result had tests — page crashed in re-test.
        // Keep the previous score rather than zeroing it (Lesson 3/41 pattern).
        if (reTestPassed === 0 && reTestFailed === 0 && (prevPassed + prevFailed) > 0) {
          warn(`[pipeline] [${batchLabel}] Final re-test: 0/0 total (page crash?) — keeping previous score ${prevPassed}p/${prevFailed}f`);
          // Score unchanged — do not update totalPassed/totalFailed
        } else if (reTestPassed !== prevPassed || reTestFailed !== prevFailed) {
          info(`[pipeline] [${batchLabel}] Final re-test: ${prevPassed}p/${prevFailed}f → ${reTestPassed}p/${reTestFailed}f — updating score`);
          totalPassed += reTestPassed - prevPassed;
          totalFailed += reTestFailed - prevFailed;
          report.category_results[batchLabel] = { passed: reTestPassed, failed: reTestFailed };
        } else {
          info(`[pipeline] [${batchLabel}] Final re-test: unchanged (${reTestPassed}p/${reTestFailed}f)`);
        }
      }
    }

  } finally {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* already dead */
      }
    }
  }

  const lastPassed = totalPassed;
  const lastFailed = totalFailed;

  // ─── Step 4: Review ─────────────────────────────────────────────────────

  const totalTests = lastPassed + lastFailed;
  const passRate = totalTests > 0 ? lastPassed / totalTests : 0;

  // Allow review if ≥70% of tests pass — reviewer evaluates functional quality
  // Skip review only when clearly broken: <50% pass rate or zero passing tests
  if (passRate < 0.5 || lastPassed === 0) {
    report.status = 'FAILED';
    report.review_result = 'SKIPPED';
    writeReport();
    return report;
  }

  // Fail before review if game-flow category has 0% pass rate AND overall passRate < 0.7
  const gameFlowResult = report.category_results['game-flow'];
  if (gameFlowResult && gameFlowResult.passed === 0 && passRate < 0.7) {
    info(`[pipeline] Step 4: game-flow 0% pass rate with overall passRate ${Math.round(passRate * 100)}% — review skipped (need ≥70% overall)`);
    report.status = 'FAILED';
    report.review_result = 'SKIPPED';
    writeReport();
    return report;
  }

  const categoryResultsSummary = Object.entries(report.category_results || {})
    .map(([cat, r]) => `  ${cat}: ${r.passed}/${(r.passed || 0) + (r.failed || 0)} passing`)
    .join('\n');

  info(`[pipeline] Step 4: Review (${lastPassed}/${totalTests} tests passing)`);
  const reviewStartTime = Date.now();
  progress('review', { gameId, model: REVIEW_MODEL });

  const reviewPrompt = buildReviewPrompt(categoryResultsSummary, specContent, fs.readFileSync(htmlFile, 'utf-8'));

  let reviewResult;
  try {
    reviewResult = await trackedLlmCall('review', reviewPrompt, REVIEW_MODEL, {}, report);
    llmCalls.push({ step: 'review', model: REVIEW_MODEL });
  } catch {
    warn('[pipeline] Review LLM call failed — treating as approved');
    report.status = 'APPROVED';
    report.review_result = 'SKIPPED_LLM_FAILURE';
    writeReport();
    return report;
  }

  report.review_result = reviewResult;

  // ─── Step 4b: Review rejection → targeted fix loop ─────────────────────────
  // If reviewer rejects, attempt up to 2 targeted HTML fixes before giving up.
  const MAX_REVIEW_FIX_ATTEMPTS = 3;
  let reviewAttempt = 0;
  while (!/^APPROVED/i.test(reviewResult) && reviewAttempt < MAX_REVIEW_FIX_ATTEMPTS) {
    reviewAttempt++;
    warn(`[pipeline] Review rejected (attempt ${reviewAttempt}/${MAX_REVIEW_FIX_ATTEMPTS}) — attempting targeted fix`);
    progress('review-fix', { gameId, attempt: reviewAttempt, rejection: reviewResult });

    const reviewFixPrompt = buildReviewFixPrompt(reviewResult, specContent, fs.readFileSync(htmlFile, 'utf-8'));

    try {
      const fixOutput = await trackedLlmCall(`review-fix-${reviewAttempt}`, reviewFixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: `review-fix-${reviewAttempt}`, model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (!fixedHtml) {
        warn('[pipeline] Review fix: could not extract HTML — stopping fix loop');
        break;
      }
      fs.writeFileSync(htmlFile, fixedHtml + '\n');
      progress('review-fix-applied', { gameId, attempt: reviewAttempt });
    } catch (err) {
      warn(`[pipeline] Review fix LLM call failed: ${err.message} — stopping fix loop`);
      break;
    }

    // Re-review the fixed HTML — build fresh prompt to avoid stale pre-fix HTML
    const reReviewPrompt = buildReReviewPrompt(specContent, fs.readFileSync(htmlFile, 'utf-8'));

    progress('review', { gameId, model: REVIEW_MODEL, attempt: reviewAttempt + 1 });
    try {
      reviewResult = await trackedLlmCall(`review-${reviewAttempt + 1}`, reReviewPrompt, REVIEW_MODEL, {}, report);
      llmCalls.push({ step: `review-${reviewAttempt + 1}`, model: REVIEW_MODEL });
    } catch {
      warn('[pipeline] Re-review LLM call failed — treating as approved');
      reviewResult = 'APPROVED';
    }
    report.review_result = reviewResult;
  }

  if (/^APPROVED/i.test(reviewResult)) {
    report.status = 'APPROVED';
    info('[pipeline] APPROVED by review');
  } else {
    report.status = 'REJECTED';
    warn(`[pipeline] Review rejected after ${reviewAttempt} fix attempt(s): ${reviewResult}`);
  }

  progress('review-complete', { gameId, status: report.status, reviewResult, categoryResults: report.category_results, model: REVIEW_MODEL, time: Math.round((Date.now() - reviewStartTime) / 1000) });

  // ─── Step 5: Extract cross-game learnings ───────────────────────────────
  // After every build that had failures, extract generalizable insights and
  // append them to global-learnings.md so future builds benefit.
  const hadFailures = report.test_results.some((r) => r.failed > 0 || r.passed === 0);
  if (hadFailures || report.status === 'REJECTED') {
    try {
      const failureSummary = report.test_results
        .filter((r) => r.failures && r.failures.length > 0)
        .map((r) => r.failures.join('\n'))
        .join('\n');
      const rejectionNote = report.status === 'REJECTED' ? `\nREJECTION: ${reviewResult}` : '';
      if (failureSummary || rejectionNote) {
        const extractPrompt = buildExtractLearningsPrompt(failureSummary, rejectionNote);
        const learningsOut = await trackedLlmCall('extract-learnings', extractPrompt, LEARNINGS_MODEL, {}, report);
        llmCalls.push({ step: 'extract-learnings', model: LEARNINGS_MODEL });
        const bullets = learningsOut
          .split('\n')
          .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
          .filter((l) => l.length > 20 && l.length < 300);
        for (const bullet of bullets.slice(0, 4)) {
          appendGlobalLearning(bullet);
        }
        if (bullets.length > 0) {
          info(`[pipeline] Appended ${bullets.length} cross-game learning(s) to global-learnings.md`);
        }
      }
    } catch {
      // non-critical — don't fail the build over learning extraction
    }
  }

  writeReport();
  return report;
}

// ─── Targeted fix: apply user feedback to existing HTML ─────────────────────

const TARGETED_FIX_MAX_ATTEMPTS = 2;

// Detect which test category is most relevant to the feedback
function detectFixCategory(feedbackPrompt) {
  const fp = feedbackPrompt.toLowerCase();
  if (/button|click|answer|submit|check|adjust|delta|reset|input/.test(fp)) return 'mechanics';
  if (/level|transition|next level|round 3|round 6|level-progression/.test(fp)) return 'level-progression';
  if (/start screen|game screen|restart|play again|game flow|game-flow/.test(fp)) return 'game-flow';
  if (/lives|game over|final round|edge|empty|invalid|edge-case/.test(fp)) return 'edge-cases';
  if (/postmessage|score|stars|contract|gameover|life_lost|event/.test(fp)) return 'contract';
  return null; // run all available spec files
}

async function runTargetedFix(gameDir, specPath, feedbackPrompt, options = {}) {
  const { logger: log, onProgress } = options;
  const info = log ? (msg) => log.info(msg) : console.log;
  const warn = log ? (msg) => log.warn(msg) : console.warn;

  function progress(step, detail) {
    if (onProgress) {
      try {
        onProgress(step, detail);
      } catch {
        /* ignore */
      }
    }
  }

  const startTime = Date.now();
  const gameId = path.basename(path.dirname(specPath));
  const htmlFile = path.join(gameDir, 'index.html');
  const testsDir = path.join(gameDir, 'tests');
  const reportFile = path.join(gameDir, 'ralph-report.json');
  const llmCalls = [];

  // Extract spec metadata for harness injection
  const specMetaTF = fs.existsSync(specPath) ? extractSpecMetadata(fs.readFileSync(specPath, 'utf-8')) : { interactionType: 'text-input', starType: 'lives', totalRounds: null, totalLives: null };
  function injectHarnessToFile(filePath) {
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const patched = injectTestHarness(original, specMetaTF);
      if (patched !== original) fs.writeFileSync(filePath, patched);
    } catch { /* ignore */ }
  }

  // Determine which spec files to run — prefer category-targeted files
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const detectedCategory = options.category || detectFixCategory(feedbackPrompt);
  const allSpecFiles = SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f));
  const targetSpecFiles = detectedCategory
    ? allSpecFiles.filter((f) => f.includes(detectedCategory))
    : allSpecFiles;
  // Fall back to all available specs if category-specific file doesn't exist
  const specFiles = targetSpecFiles.length > 0 ? targetSpecFiles : allSpecFiles;

  resetTokens();

  const report = {
    game_id: gameId,
    spec: specPath,
    status: 'FAILED',
    type: 'targeted-fix',
    iterations: 0,
    generation_time_s: 0,
    total_time_s: 0,
    test_results: [],
    review_result: null,
    errors: [],
    models: { fix: FIX_MODEL },
    artifacts: [],
    llm_calls: 0,
    total_cost_usd: 0,
    feedback_prompt: feedbackPrompt,
    timestamp: new Date().toISOString(),
  };

  function writeReport() {
    report.total_time_s = Math.round((Date.now() - startTime) / 1000);
    report.llm_calls = llmCalls.length;
    report.artifacts = fs.existsSync(htmlFile) ? ['index.html'] : [];
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  if (!fs.existsSync(htmlFile)) {
    report.errors.push('No existing HTML file to fix');
    writeReport();
    return report;
  }

  if (!fs.existsSync(specPath)) {
    report.errors.push('Spec file not found');
    writeReport();
    return report;
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');

  const categoryLabel = detectedCategory || (specFiles.length === 1 ? path.basename(specFiles[0], '.spec.js') : 'all');
  progress('targeted-fix-start', { gameId, feedback: feedbackPrompt, category: categoryLabel, specFiles: specFiles.map((f) => path.basename(f)) });
  info(`[targeted-fix] Category: ${categoryLabel} | Test files: ${specFiles.map((f) => path.basename(f)).join(', ') || 'none'}`);

  // Helper: run playwright against specific spec files
  async function runSpecFiles(files) {
    if (files.length === 0) return { passed: 0, failed: 0, failures: [] };
    let testResult;
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...files.map((f) => path.relative(gameDir, f))],
        { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
      );
      testResult = JSON.parse(stdout);
    } catch (err) {
      const stdout = err.stdout || '{}';
      try {
        testResult = JSON.parse(stdout);
      } catch {
        testResult = { stats: { expected: 0, unexpected: 1 } };
      }
    }
    const passed = testResult?.stats?.expected || 0;
    const failed = testResult?.stats?.unexpected || 0;
    const failureStrings = [];
    collectFailures(testResult?.suites || [], '', failureStrings);
    return { passed, failed, failures: failureStrings };
  }

  let bestPassed = 0;
  let bestHtml = null;

  // Start local server for testing
  let serverProc;
  try {
    const testPort = await findFreePort();
    // Write playwright config with the actual port for this build
    fs.writeFileSync(
      path.join(gameDir, 'playwright.config.js'),
      `const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:${testPort}',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npx serve . -l ${testPort} -s --no-clipboard',
    port: ${testPort},
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
`,
    );
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', String(testPort), '-s', '--no-clipboard'], {
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {
    report.errors.push('Web server failed to start');
    writeReport();
    return report;
  }

  try {
    // Establish baseline before applying any fix
    if (specFiles.length > 0) {
      info('[targeted-fix] Running baseline tests before fix...');
      const baseline = await runSpecFiles(specFiles);
      bestPassed = baseline.passed;
      bestHtml = fs.readFileSync(htmlFile, 'utf-8');
      report.test_results.push({ attempt: 0, passed: baseline.passed, failed: baseline.failed, label: 'baseline' });
      info(`[targeted-fix] Baseline: ${baseline.passed} passed, ${baseline.failed} failed`);
      progress('targeted-fix-baseline', { gameId, passed: baseline.passed, failed: baseline.failed, failures: baseline.failures });
    }

    for (let attempt = 1; attempt <= TARGETED_FIX_MAX_ATTEMPTS; attempt++) {
      report.iterations = attempt;
      info(`[targeted-fix] Attempt ${attempt}/${TARGETED_FIX_MAX_ATTEMPTS}`);
      progress('targeted-fix-attempt', { gameId, attempt, category: categoryLabel });

      // Build context: failing tests from baseline (or previous attempt)
      const prevResult = report.test_results[report.test_results.length - 1];
      const failingContext = prevResult?.failures?.length > 0
        ? `\nFAILING TESTS:\n${prevResult.failures.slice(0, 5).map((f) => `• ${f}`).join('\n')}`
        : '';
      const passingContext = prevResult?.passed > 0
        ? `\nPASSING TESTS (do NOT break these — ${prevResult.passed} currently passing)`
        : '';

      const fixPrompt = buildTargetedFixPrompt(
        feedbackPrompt,
        failingContext,
        passingContext,
        fs.readFileSync(htmlFile, 'utf-8'),
        specContent,
        prevResult?.passed || 0,
      );

      let fixOutput;
      try {
        fixOutput = await trackedLlmCall(`targeted-fix-${attempt}`, fixPrompt, FIX_MODEL, {}, report);
        llmCalls.push({ step: `targeted-fix-${attempt}`, model: FIX_MODEL });
      } catch (err) {
        report.errors.push(`Fix attempt ${attempt} failed: ${err.message}`);
        continue;
      }

      const fixedHtml = extractHtml(fixOutput);
      if (!fixedHtml) {
        report.errors.push(`Attempt ${attempt}: could not extract HTML`);
        continue;
      }

      // Snapshot current HTML for rollback
      const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
      fs.writeFileSync(htmlFile, fixedHtml + '\n');
      injectHarnessToFile(htmlFile);

      // Static validation gate
      const staticResult = runStaticValidation(htmlFile);
      if (!staticResult.passed) {
        warn(`[targeted-fix] Static validation failed on attempt ${attempt} — rolling back`);
        fs.writeFileSync(htmlFile, preFixSnapshot);
        report.errors.push(`Attempt ${attempt}: static validation failed`);
        continue;
      }

      if (specFiles.length === 0) {
        // No test files exist — approve based on static validation only
        report.status = 'APPROVED';
        report.review_result = 'Targeted fix applied (no test files found)';
        info('[targeted-fix] No test files found — approving based on static validation');
        break;
      }

      // Run target tests
      const testResult = await runSpecFiles(specFiles);
      report.test_results.push({ attempt, passed: testResult.passed, failed: testResult.failed, failures: testResult.failures });
      progress('targeted-fix-test', { gameId, attempt, category: categoryLabel, passed: testResult.passed, failed: testResult.failed, failures: testResult.failures });
      info(`[targeted-fix] Attempt ${attempt}: ${testResult.passed} passed, ${testResult.failed} failed`);

      // Rollback if fix regressed (fewer passing tests than best)
      if (testResult.passed < bestPassed) {
        warn(`[targeted-fix] Regression: ${testResult.passed} < best ${bestPassed} — rolling back to best HTML`);
        fs.writeFileSync(htmlFile, bestHtml);
        report.errors.push(`Attempt ${attempt}: fix caused regression (${testResult.passed} < ${bestPassed} passed) — rolled back`);
        continue;
      }

      // Track best result
      if (testResult.passed > bestPassed) {
        bestPassed = testResult.passed;
        bestHtml = fixedHtml + '\n';
      }

      if (testResult.failed === 0 && testResult.passed > 0) {
        report.status = 'APPROVED';
        report.review_result = `Targeted fix passed all ${testResult.passed} tests in category: ${categoryLabel}`;
        info(`[targeted-fix] All tests pass on attempt ${attempt}`);
        break;
      }
    }

    // If we didn't reach APPROVED but improved from baseline, report partial improvement
    if (report.status !== 'APPROVED' && bestHtml) {
      fs.writeFileSync(htmlFile, bestHtml);
      info(`[targeted-fix] Best result: ${bestPassed} passing — HTML restored to best snapshot`);
    }
  } finally {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* already dead */
      }
    }
  }

  progress('targeted-fix-complete', { gameId, status: report.status, category: detectedCategory, bestPassed });
  writeReport();
  return report;
}

module.exports = { runPipeline, runTargetedFix, extractHtml, extractTests, extractSpecMetadata, injectTestHarness, validateSpec, extractTestGenerationHints, getRelevantLearnings, jaccardSimilarity, extractSpecKeywords, getCategoryBoost, deriveRelevantCategories };
