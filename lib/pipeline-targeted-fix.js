'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline-targeted-fix.js — Targeted fix: apply user feedback to existing HTML
//
// Extracted from pipeline.js (P7 Phase 3).
// Called by worker.js when a Slack feedback reply triggers a fix job.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const { callLlm, callClaude, resetTokens, getTokenUsage, isClaudeModel } = require('./llm');
const metrics = require('./metrics');
const { buildTargetedFixPrompt } = require('./prompts');
const {
  injectTestHarness,
  extractSpecMetadata,
  findFreePort,
  spawnServeProcess,
  estimateCost,
  CATEGORY_SPEC_ORDER,
  buildPlaywrightConfig,
} = require('./pipeline-utils');

const execFileAsync = promisify(execFile);

// ─── Configuration (mirrors pipeline.js) ────────────────────────────────────

const config = require('./config');

const FIX_MODEL = config.RALPH_FIX_MODEL;
const TEST_TIMEOUT = config.RALPH_TEST_TIMEOUT;
const REPO_DIR = config.RALPH_REPO_DIR;
const WAREHOUSE_PACKAGES_DIR = path.resolve(REPO_DIR, 'warehouse', 'packages');

const TARGETED_FIX_MAX_ATTEMPTS = 2;

// ─── Timeout constants ───────────────────────────────────────────────────────
const VALIDATOR_TIMEOUT_MS = 10000;   // max time for static validator subprocess
const SERVER_START_DELAY_MS = 2000;   // wait after spawning serve before running tests

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

const USE_CLAUDE_CLI = config.RALPH_USE_CLAUDE_CLI;

async function trackedClaudeCall(stepName, prompt, model, options = {}, report = null) { // eslint-disable-line no-unused-vars
  const start = Date.now();
  try {
    const result = await callClaude(stepName, prompt, { model, ...options });
    metrics.recordLlmCall(stepName, 'claude-cli', Date.now() - start, true);
    return result;
  } catch (err) {
    metrics.recordLlmCall(stepName, 'claude-cli', Date.now() - start, false);
    throw err;
  }
}

// ─── HTML extraction ─────────────────────────────────────────────────────────

function extractHtml(output) {
  let match = output.match(/```html\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /<!DOCTYPE|<html|<head|<body/.test(match[1])) return match[1];

  const htmlStart = output.search(/<!DOCTYPE html|<html/i);
  if (htmlStart !== -1) return output.slice(htmlStart);

  return null;
}

// ─── Static validation ───────────────────────────────────────────────────────

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

// ─── collectFailures helper ──────────────────────────────────────────────────

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

// ─── Detect which test category is most relevant to the feedback ─────────────

/**
 * Infers the most likely test category from a feedback prompt string using keyword matching.
 * Returns a category name to restrict which spec files are run, or null to run all.
 * @param {string} feedbackPrompt
 * @returns {'mechanics'|'level-progression'|'game-flow'|'edge-cases'|'contract'|null}
 */
function detectFixCategory(feedbackPrompt) {
  const fp = feedbackPrompt.toLowerCase();
  if (/button|click|answer|submit|check|adjust|delta|reset|input/.test(fp)) return 'mechanics';
  if (/level|transition|next level|round 3|round 6|level-progression/.test(fp)) return 'level-progression';
  if (/start screen|game screen|restart|play again|game flow|game-flow/.test(fp)) return 'game-flow';
  if (/lives|game over|final round|edge|empty|invalid|edge-case/.test(fp)) return 'edge-cases';
  if (/postmessage|score|stars|contract|gameover|life_lost|event/.test(fp)) return 'contract';
  return null; // run all available spec files
}

// ─── runTargetedFix ──────────────────────────────────────────────────────────
/**
 * Applies a user feedback prompt to the existing game HTML using targeted LLM fix + test verification.
 * Up to TARGETED_FIX_MAX_ATTEMPTS iterations: fix HTML → run relevant tests → re-fix if still failing.
 * @param {string} gameDir - Game directory containing index.html and tests/
 * @param {string} specPath - Path to the Markdown spec file
 * @param {string} feedbackPrompt - User-supplied feedback describing what to fix
 * @param {{logger?: object, onProgress?: function, fixCdnDomainsInFile?: function, fixCdnPathsInFile?: function}} [options]
 * @returns {Promise<object>} Fix report with status, iterations, test_results
 */
async function runTargetedFix(gameDir, specPath, feedbackPrompt, options = {}) {
  const { logger: log, onProgress, fixCdnDomainsInFile, fixCdnPathsInFile } = options;
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
  const detectedCategory = options.category || detectFixCategory(feedbackPrompt);
  const allSpecFiles = CATEGORY_SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f));
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
  // T1 re-validation: track errors from the most recent failed T1 check so they
  // can be injected into the next attempt's fix prompt as context.
  // Reset to null after any successful T1 pass or after 2 consecutive T1 failures
  // (graceful degradation — don't block Playwright indefinitely).
  let pendingT1ErrorContext = null;
  let consecutiveT1Failures = 0;

  // Start local server for testing
  let serverProc;
  try {
    const testPort = await findFreePort();
    // Write playwright config with the actual port for this build
    fs.writeFileSync(path.join(gameDir, 'playwright.config.js'), buildPlaywrightConfig(testPort));
    serverProc = spawnServeProcess(gameDir, testPort);
    await new Promise((r) => setTimeout(r, SERVER_START_DELAY_MS));
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

      const useFileRefTargeted = USE_CLAUDE_CLI && isClaudeModel(FIX_MODEL);
      const fixPrompt = buildTargetedFixPrompt(
        feedbackPrompt,
        failingContext,
        passingContext,
        useFileRefTargeted ? undefined : fs.readFileSync(htmlFile, 'utf-8'),
        specContent,
        prevResult?.passed || 0,
        useFileRefTargeted ? htmlFile : undefined,
        pendingT1ErrorContext,
      );

      let fixOutput;
      try {
        fixOutput = useFileRefTargeted
          ? await trackedClaudeCall(`targeted-fix-${attempt}`, fixPrompt, FIX_MODEL, { cwd: gameDir, addDirs: [WAREHOUSE_PACKAGES_DIR] }, report)
          : await trackedLlmCall(`targeted-fix-${attempt}`, fixPrompt, FIX_MODEL, {}, report);
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
      if (fixCdnDomainsInFile) fixCdnDomainsInFile(htmlFile, log); // LLM may re-introduce wrong CDN domains
      if (fixCdnPathsInFile) fixCdnPathsInFile(htmlFile, log); // fix wrong-path CDN URLs (unpkg.com/@mathai, etc.)
      injectHarnessToFile(htmlFile);

      // ── T1 static validation gate ──────────────────────────────────────────
      // Re-run T1 validation on the patched HTML before Playwright.
      // Purpose: catch structural regressions (CSS stripping, missing CDN init,
      // banned patterns) introduced by the fix LLM before they reach Playwright,
      // which asserts DOM state and will not catch rendering/styling issues.
      // Root cause: name-the-sides #557 and which-ratio #560 CSS stripping.
      //
      // If T1 ERRORS are found:
      //   - Roll back the patched HTML
      //   - Inject T1 error text into the next attempt's fix prompt
      //   - Track consecutive T1 failures; after 2 failures, proceed to Playwright
      //     (graceful degradation — don't block the pipeline indefinitely)
      const staticResult = runStaticValidation(htmlFile);
      if (!staticResult.passed) {
        consecutiveT1Failures++;
        if (consecutiveT1Failures <= 2) {
          warn(`[targeted-fix] T1 static validation failed on attempt ${attempt} (consecutive T1 failures: ${consecutiveT1Failures}) — rolling back`);
          progress('targeted-fix-t1-failed', { gameId, attempt, consecutiveT1Failures, output: staticResult.output?.slice(0, 300) });
          fs.writeFileSync(htmlFile, preFixSnapshot);
          report.errors.push(`Attempt ${attempt}: T1 static validation failed (errors: ${staticResult.output?.slice(0, 200) || 'unknown'})`);
          // Capture T1 errors for injection into the next attempt's prompt
          pendingT1ErrorContext = staticResult.output
            ? staticResult.output.slice(0, 800)
            : 'T1 static validation failed — check for CSS stripping, missing CDN init, or banned patterns';
          continue;
        } else {
          // Graceful degradation: T1 still failing after 2 consecutive attempts.
          // Log the failure but proceed to Playwright — do not break the pipeline.
          warn(`[targeted-fix] T1 re-validation failed after ${consecutiveT1Failures} consecutive attempts — proceeding to Playwright (graceful degradation)`);
          progress('targeted-fix-t1-graceful-degrade', { gameId, attempt, consecutiveT1Failures });
          report.errors.push(`Attempt ${attempt}: T1 re-validation failed after 2 attempts — proceeding to Playwright`);
          // Clear context so it doesn't persist into any subsequent attempts
          pendingT1ErrorContext = null;
        }
      } else {
        // T1 passed — reset consecutive failure counter and clear pending context
        consecutiveT1Failures = 0;
        pendingT1ErrorContext = null;
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

module.exports = { runTargetedFix, detectFixCategory };
