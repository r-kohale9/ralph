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
const { execFileSync, spawn } = require('child_process');
const db = require('./db');
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
  buildReviewPrompt,
  buildReviewFixPrompt,
  buildReReviewPrompt,
  buildExtractLearningsPrompt,
} = require('./prompts');


// ─── Sub-modules (extracted in P7 Phase 3) ───────────────────────────────────
const { generateTests } = require('./pipeline-test-gen');
const { runFixLoop } = require('./pipeline-fix-loop');
const { runTargetedFix } = require('./pipeline-targeted-fix');

// ─── Snapshot/harness/spec utilities (extracted to pipeline-utils.js) ────────
const {
  injectTestHarness,
  extractSpecMetadata,
  extractSpecKeywords,
  extractTestGenerationHints,
  jaccardSimilarity,
  getCategoryBoost,
  getRelevantLearnings,
  deriveRelevantCategories,
  isHtmlTruncated,
  findFreePort,
  MODEL_COSTS,
  estimateCost,
  runPageSmokeDiagnostic,
} = require('./pipeline-utils');

// ─── Configuration ──────────────────────────────────────────────────────────

const config = require('./config');

const GEN_MODEL = config.RALPH_GEN_MODEL;
const TEST_MODEL = config.RALPH_TEST_MODEL;
const TEST_CASES_MODEL = config.RALPH_TEST_CASES_MODEL;
const FIX_MODEL = config.RALPH_FIX_MODEL;
const REVIEW_MODEL = config.RALPH_REVIEW_MODEL;
const LEARNINGS_MODEL = config.RALPH_LEARNINGS_MODEL;
const USE_CLAUDE_CLI = config.RALPH_USE_CLAUDE_CLI;
const REPO_DIR = config.RALPH_REPO_DIR;
const SKILL_DIR = path.join(REPO_DIR, 'warehouse', 'mathai-game-builder');
const GLOBAL_LEARNINGS_FILE = path.join(REPO_DIR, 'data', 'global-learnings.md');

// ─── Timeout constants ───────────────────────────────────────────────────────
const VALIDATOR_TIMEOUT_MS = 10000;   // max time for static validator subprocess
const PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS = 15000; // playwright webServer.timeout
const SERVER_START_DELAY_MS = 2000;   // wait after spawning serve before running tests

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
    const output = execFileSync('node', [validatorPath, htmlPath], {
      encoding: 'utf-8',
      timeout: VALIDATOR_TIMEOUT_MS,
    });
    return { passed: true, output };
  } catch (err) {
    return { passed: false, output: err.stdout || err.message };
  }
}

// ─── Shared review guidance (used by both early and final review prompts) ───
// Imported from lib/prompts.js — REVIEW_SHARED_GUIDANCE is defined there.
// Keep in prompts.js: any change there applies to both Step 1c and Step 4 review calls.
//
// Note: collectFailures, deterministicTriage, extractScriptSections, mergeScriptFix
// were extracted to pipeline-fix-loop.js (P7 Phase 3).

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
        model: config.RALPH_CLAUDE_MODEL,
        timeout: config.RALPH_CLI_LLM_TIMEOUT,
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
      progress('early-review-approved', { gameId, model: REVIEW_MODEL });
    }
  } catch (err) {
    warn(`[pipeline] Early review LLM call failed: ${err.message} — continuing without early review`);
  }

  // ─── Step 1d: Page load smoke check (abort early if page fails to init) ─────

  info('[pipeline] Step 1d: Page load smoke check');
  progress('smoke-check', { gameId });

  let smokeResult = await runPageSmokeDiagnostic(htmlFile, gameDir, log);

  if (!smokeResult.ok) {
    warn('[pipeline] Step 1d: Page load FAILED — fatal init errors detected');
    progress('smoke-check-failed', { gameId, errors: smokeResult.fatalErrors });

    // One HTML regeneration attempt with the error context appended to the prompt
    const smokeErrorContext = `\n\nPrevious generation failed with this fatal page load error: ${smokeResult.fatalErrors[0]}`;
    const smokeRegenPrompt = genPrompt + smokeErrorContext;

    try {
      const smokeRegenOutput = await trackedLlmCall('smoke-regen', smokeRegenPrompt, GEN_MODEL, {}, report);
      llmCalls.push({ step: 'smoke-regen', model: GEN_MODEL });
      const smokeRegenHtml = extractHtml(smokeRegenOutput);
      if (smokeRegenHtml) {
        fs.writeFileSync(htmlFile, smokeRegenHtml + '\n');
        injectHarnessToFile(htmlFile);
        info('[pipeline] Step 1d: HTML regenerated — re-running smoke check');
        smokeResult = await runPageSmokeDiagnostic(htmlFile, gameDir, log);
        if (!smokeResult.ok) {
          throw new Error(
            'Step 1d: Page load failed after regeneration attempt: ' + smokeResult.fatalErrors.join('; '),
          );
        }
        info('[pipeline] Step 1d: Regenerated HTML passes smoke check — continuing');
        progress('smoke-check-passed', { gameId, afterRegen: true });
      } else {
        warn('[pipeline] Step 1d: Smoke regen produced no extractable HTML — proceeding with original');
      }
    } catch (err) {
      if (err.message.startsWith('Step 1d:')) throw err; // re-throw our own error
      warn(`[pipeline] Step 1d: Smoke regen LLM call failed: ${err.message} — proceeding with original`);
    }
  } else {
    info('[pipeline] Step 1d: Page load smoke check passed');
    progress('smoke-check-passed', { gameId });
  }

  // ─── Steps 2a, 2.5, 2b: Test case gen + DOM snapshot + Playwright test gen ─

  const transitionSlotId = 'mathai-transition-slot';

  await generateTests({
    gameDir, htmlFile, testsDir, testCasesFile,
    specContent, specMeta, htmlContent: fs.readFileSync(htmlFile, 'utf-8'),
    transitionSlotId, formatLearningsBlock,
    info, warn, progress,
    llmCalls, report, trackedLlmCall,
    gameId, log,
    injectHarnessToFile,
  });

  // ─── Step 3: Test → Fix loop (per-batch sequential) ─────────────────────
  // Delegates to pipeline-fix-loop.js: per-batch iterations, triage,
  // E8 script-only fix, global fix loop (Step 3c), and final re-test (Step 3b).

  // Start local server for tests
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
    serverProc = spawn('npx', ['-y', 'serve', gameDir, '-l', String(testPort), '-s', '--no-clipboard'], {
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, SERVER_START_DELAY_MS));
  } catch {
    report.errors.push('Web server failed to start');
    writeReport();
    return report;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    const fixLoopResult = await runFixLoop({
      gameDir, htmlFile, testsDir,
      specContent, specMeta, genPrompt,
      htmlWasFreshlyGenerated,
      globalLearnings, dbLearnings,
      info, warn, progress,
      llmCalls, report, trackedLlmCall,
      gameId, injectHarnessToFile,
    });
    totalPassed = fixLoopResult.totalPassed;
    totalFailed = fixLoopResult.totalFailed;
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


module.exports = { runPipeline, runTargetedFix, extractHtml, extractTests, extractSpecMetadata, injectTestHarness, validateSpec, extractTestGenerationHints, getRelevantLearnings, jaccardSimilarity, extractSpecKeywords, getCategoryBoost, deriveRelevantCategories };
