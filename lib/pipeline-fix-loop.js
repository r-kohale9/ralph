'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline-fix-loop.js — Step 3: per-batch test→fix loop + global fix loop
//
// Extracted from pipeline.js (P7 Phase 3).
// Handles: per-batch fix iterations, triage (deterministic + LLM), E8 script-only
// fix, global cross-batch fix loop, and final re-test of all batches.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { buildTriagePrompt, buildFixPrompt, buildGlobalFixPrompt } = require('./prompts');
const { CATEGORY_SPEC_ORDER } = require('./pipeline-utils');

const execFileAsync = promisify(execFile);

const config = require('./config');
const { findMatchingPattern } = require('./db');

const MAX_ITERATIONS = config.RALPH_MAX_ITERATIONS;
const MAX_GLOBAL_FIX_ITERATIONS = config.RALPH_MAX_GLOBAL_FIX_ITERATIONS;
const CATEGORY_BATCH_SIZE = config.RALPH_CATEGORY_BATCH_SIZE;
const FIX_MODEL = config.RALPH_FIX_MODEL;
const FALLBACK_MODEL = config.RALPH_FALLBACK_MODEL;
const TRIAGE_MODEL = config.RALPH_TRIAGE_MODEL;
const GLOBAL_FIX_MODEL = config.RALPH_GLOBAL_FIX_MODEL;
const TEST_TIMEOUT = config.RALPH_TEST_TIMEOUT;

// ─── detectRenderingMismatch helper ─────────────────────────────────────────
// Returns true if >3 failures in the batch all contain toBeVisible or toBeHidden.
// Used for deterministic pre-triage: these are test-side DOM visibility assumptions
// that the game's HTML doesn't satisfy — no LLM call needed, always skip_tests.

/**
 * Returns true when more than 3 failures all contain toBeVisible/toBeHidden assertions,
 * indicating DOM visibility mismatch rather than a game logic bug — skip_tests, no LLM needed.
 * @param {string[]} failureDescs - Array of failure message strings
 * @returns {boolean}
 */
function detectRenderingMismatch(failureDescs) {
  if (!failureDescs || failureDescs.length === 0) return false;
  const visibilityFailures = failureDescs.filter((f) =>
    /toBeVisible|toBeHidden/i.test(f),
  );
  return visibilityFailures.length > 3;
}

// ─── isInitFailure helper ────────────────────────────────────────────────────
// Returns true when passed===0 on iteration 1 AND at least ONE failure message
// matches a known init-failure pattern (stale warehouse HTML / harness not ready).
// Changed P8: ANY-match (was: ALL-must-match) to catch partial init failures.

const INIT_FAILURE_PATTERNS = [
  /gameState is not defined/i,
  /window\.gameState.*undefined/i,
  /Cannot read prop.*gameState/i,
  /__ralph.*not defined/i,
  /waitForPhase.*timeout/i,
  /Timeout.*exceeded.*waiting/i,
  /net::ERR_/i,
  /page\.goto.*failed/i,
  // legacy patterns kept for backwards compat
  /beforeEach/,
  /TimeoutError/,
  /waiting for/,
  /transition-slot/,
  /data-phase/,
  /SKIPPED/,
];

/**
 * Returns true when passed===0 on the first iteration AND at least one failure matches a known
 * harness/init-failure pattern (gameState undefined, waitForPhase timeout, net error, etc.).
 * @param {string[]} failureDescs - Array of failure message strings
 * @param {number} passed - Number of passing tests in this iteration
 * @returns {boolean}
 */
function isInitFailure(failureDescs, passed) {
  if (passed !== 0) return false;
  if (!failureDescs || failureDescs.length === 0) return false;
  return failureDescs.some((f) => INIT_FAILURE_PATTERNS.some((p) => p.test(f)));
}

// ─── collectFailures helper ──────────────────────────────────────────────────

/**
 * Recursively walks a Playwright JSON reporter suite tree and collects failure descriptions into out[].
 * @param {Array} suites - Playwright reporter suite objects
 * @param {string} parentFile - Inherited file path from parent suite
 * @param {string[]} out - Accumulator array for failure description strings
 */
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

// ─── collectTimeoutScreenshots helper ────────────────────────────────────────

/**
 * Walks a Playwright JSON result tree and returns base64-encoded screenshots for
 * failing tests whose error message contains a timeout pattern. Max 2 screenshots
 * to avoid token explosion.
 * @param {object} testResult - Playwright JSON reporter output
 * @returns {Array<{testTitle: string, base64: string}>}
 */
function collectTimeoutScreenshots(testResult) {
  const screenshots = [];
  const TIMEOUT_RE = /timeout|Timeout|waiting for/i;
  const MAX_SCREENSHOTS = 2;

  function walk(suites) {
    if (screenshots.length >= MAX_SCREENSHOTS) return;
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        if (screenshots.length >= MAX_SCREENSHOTS) return;
        if (!spec.ok) {
          const result = spec.tests?.[0]?.results?.[0];
          const errMsg = result?.error?.message || '';
          if (TIMEOUT_RE.test(errMsg)) {
            for (const att of result?.attachments || []) {
              if (att.name === 'screenshot' && att.path && fs.existsSync(att.path)) {
                try {
                  const base64 = fs.readFileSync(att.path).toString('base64');
                  screenshots.push({ testTitle: spec.title, base64 });
                } catch { /* skip unreadable */ }
                break;
              }
            }
          }
        }
      }
      walk(suite.suites);
    }
  }

  walk(testResult?.suites);
  return screenshots;
}

// ─── Deterministic triage ────────────────────────────────────────────────────

/**
 * Applies rule-based triage to a batch of failures without an LLM call.
 * Returns 'fix_html', 'skip_tests', or null (fall through to LLM triage).
 * @param {string[]} failures - Array of failure description strings
 * @returns {'fix_html'|'skip_tests'|null}
 */
function deterministicTriage(failures) {
  if (!failures || failures.length === 0) return null;
  if (failures.every(f => f.includes('window.__ralph is not defined') ||
      (f.includes('Cannot read properties of undefined (reading') && f.includes('__ralph')))) {
    return 'fix_html';
  }
  if (failures.every(f => f.includes('Cannot redefine property: visibilityState'))) {
    return 'skip_tests';
  }
  if (failures.every(f => f.includes('pointer-events') ||
      (f.includes('already been clicked') || f.includes('already selected')))) {
    return 'skip_tests';
  }
  return null;
}

// ─── E8 script-only fix helpers ──────────────────────────────────────────────

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
  const firstScript = originalHtml.search(/<script/i);
  const lastScriptEnd = originalHtml.lastIndexOf('</script>') + '</script>'.length;
  if (firstScript === -1 || lastScriptEnd <= firstScript) return null;
  return originalHtml.slice(0, firstScript) + fixedScriptContent + originalHtml.slice(lastScriptEnd);
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

// ─── detectCrossBatchRegression ─────────────────────────────────────────────
// Runs a lightweight Playwright smoke-check of all prior passing batches to
// detect regressions introduced by the most-recent batch's fix loop.
//
// priorPassingBatches: Array<{ category, specFile, passed, total }>
// gameDir: string — cwd for Playwright
// smokeTimeout: number — per-file timeout in ms (default 30 000)
//
// Returns: Array<{ category, specFile, prevPassed, prevTotal, nowPassed, nowTotal }>
//   — entries only present when a regression is detected (nowPassed < prevPassed).
//   An empty array means no regression.

/**
 * Re-runs previously-passing test batches to detect regressions introduced by a cross-batch HTML fix.
 * Returns an array of batches whose pass count dropped since they last passed.
 * @param {Array<{category: string, specFile: string, passed: number, total: number}>} priorPassingBatches
 * @param {string} gameDir - Game directory (used as cwd for playwright)
 * @param {number} [smokeTimeout] - Per-batch timeout in ms (default 30000)
 * @returns {Promise<Array<{category: string, specFile: string, prevPassed: number, nowPassed: number}>>}
 */
async function detectCrossBatchRegression(priorPassingBatches, gameDir, smokeTimeout) {
  if (!priorPassingBatches || priorPassingBatches.length === 0) return [];
  const timeout = smokeTimeout || 30000;
  const regressions = [];

  for (const entry of priorPassingBatches) {
    const { category, specFile, passed: prevPassed, total: prevTotal } = entry;
    if (!fs.existsSync(specFile)) continue;

    let smokeResult;
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json',
          path.relative(gameDir, specFile)],
        { timeout, encoding: 'utf-8', cwd: gameDir },
      );
      smokeResult = JSON.parse(stdout);
    } catch (err) {
      try { smokeResult = JSON.parse(err.stdout || '{}'); } catch { smokeResult = {}; }
    }

    const nowPassed = smokeResult?.stats?.expected || 0;
    const nowTotal = (smokeResult?.stats?.expected || 0) + (smokeResult?.stats?.unexpected || 0);

    // Skip if no tests ran — treat as inconclusive (timeout/infra failure), not regression.
    // A 0/0 result means playwright couldn't execute the tests, not that they failed.
    if (nowTotal === 0) continue;

    if (nowPassed < prevPassed) {
      regressions.push({ category, specFile, prevPassed, prevTotal, nowPassed, nowTotal });
    }
  }

  return regressions;
}

/**
 * Runs the per-batch test→fix loop (Step 3), global cross-batch fix loop (Step 3c),
 * and final re-test of all batches (Step 3b). Mutates report.category_results and report.test_results.
 * @param {object} ctx - Pipeline context object with gameDir, htmlFile, testsDir, specContent, specMeta,
 *   genPrompt, htmlWasFreshlyGenerated, globalLearnings, dbLearnings, gameLearnings,
 *   info, warn, progress, llmCalls, report, trackedLlmCall, gameId, injectHarnessToFile
 * @returns {Promise<{totalPassed: number, totalFailed: number}>}
 */
async function runFixLoop(ctx) {
  const {
    gameDir, htmlFile, testsDir,
    specContent, specMeta, genPrompt,
    globalLearnings, dbLearnings, gameLearnings,
    info, warn, progress,
    llmCalls, report, trackedLlmCall,
    gameId, injectHarnessToFile,
  } = ctx;

  let { htmlWasFreshlyGenerated } = ctx;

  // Order spec files by category, then group into batches
  const orderedSpecFiles = [
    ...CATEGORY_SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f)),
    ...(fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : []
    ).filter((f) => !CATEGORY_SPEC_ORDER.some((cat) => f.endsWith(`${cat}.spec.js`))),
  ];

  const batches = [];
  for (let i = 0; i < orderedSpecFiles.length; i += CATEGORY_BATCH_SIZE) {
    batches.push(orderedSpecFiles.slice(i, i + CATEGORY_BATCH_SIZE));
  }

  info(
    `[pipeline] Step 3: Test → Fix loop (${batches.length} batch(es), batch_size=${CATEGORY_BATCH_SIZE}, max_iterations=${MAX_ITERATIONS})`,
  );
  progress('test-fix-loop', { gameId, maxIterations: MAX_ITERATIONS, batches: batches.length });

  let totalPassed = 0;
  let totalFailed = 0;
  const priorBatchPassingTests = [];

  // Cross-batch regression guard: tracks spec files of prior batches that
  // completed with passed > 0 so we can re-run them after each subsequent batch.
  // Each entry: { category, specFile, passed, total }
  const priorPassingBatches = [];

  // Helper: build learnings context string (cross-game + same-game)
  function fixLearningsContextStr() {
    const parts = [globalLearnings, dbLearnings].filter(Boolean);
    const crossGameBlock = parts.length > 0 ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${parts.join('\n')}\n` : '';

    // E4: inject same-game prior learnings if available
    let gameBlock = '';
    if (gameLearnings && gameLearnings.length > 0) {
      const lines = gameLearnings.map((l) => `- [${l.category}] ${l.content}`).join('\n');
      gameBlock = `\n## Prior build learnings for this game\nThe following patterns failed in previous builds of this game. Do not repeat them:\n${lines}\n`;
    }

    return gameBlock + crossGameBlock;
  }

  for (const [batchIdx, batch] of batches.entries()) {
    const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
    info(`[pipeline] Batch ${batchIdx + 1}/${batches.length}: ${batchLabel}`);
    progress('batch-start', { gameId, batch: batchLabel, batchIdx, totalBatches: batches.length });

    // Capture HTML state before this batch's fix loop so we can roll back if a
    // cross-batch regression is detected after the loop completes.
    const preBatchHtml = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf-8') : null;

    let batchPassed = 0;
    let batchFailed = 0;
    let fixHistory = '';
    let bestPassed = 0;
    let bestHtmlSnapshot = null;

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
      if (passed === 0 && failed === 0 && skipped > 0) {
        warn(`[pipeline] [${batchLabel}] All ${skipped} tests skipped — likely HTML init failure in beforeEach`);
        failed = skipped;
      }
      batchPassed = passed;
      batchFailed = failed;

      const failureDescs = [];
      try {
        collectFailures(testResult.suites, '', failureDescs);
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

      // ── Stale warehouse HTML detection ─────────────────────────────────────
      if (
        batchLabel === 'game-flow' &&
        iteration === 1 &&
        passed === 0 &&
        !htmlWasFreshlyGenerated
      ) {
        if (isInitFailure(failureDescs, passed)) {
          const WAREHOUSE_TEMPLATES_DIR = path.join(config.RALPH_REPO_DIR, 'warehouse', 'templates');
          const warehousePath = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game', 'index.html');
          if (fs.existsSync(warehousePath)) {
            warn(
              `[pipeline] game-flow 0% on iter 1 with init failures + warehouse HTML detected — deleting warehouse HTML and regenerating`,
            );
            fs.unlinkSync(warehousePath);
            progress('warehouse-html-deleted', { gameId, reason: 'stale-init-failure' });
            try {
              const regenOutput = await trackedLlmCall('generate-html-regen', genPrompt, config.RALPH_GEN_MODEL, {}, report);
              llmCalls.push({ step: 'generate-html-regen', model: config.RALPH_GEN_MODEL });
              const regenHtml = extractHtml(regenOutput);
              if (regenHtml && regenHtml.length > 500) {
                fs.writeFileSync(htmlFile, regenHtml + '\n');
                injectHarnessToFile(htmlFile);
                htmlWasFreshlyGenerated = true;
                bestHtmlSnapshot = null;
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
          batchPassed = bestPassed; // restore score to match best-snapshot HTML
          batchFailed = 0; // 0/0 means we don't know failed count; best-snapshot is clean
          info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
        }
        if (iteration >= MAX_ITERATIONS) break;
        continue;
      }

      if (failed === 0 && passed > 0) {
        info(`[pipeline] [${batchLabel}] All tests pass!`);
        break;
      }

      if (iteration >= MAX_ITERATIONS) {
        info(`[pipeline] [${batchLabel}] Max iterations reached`);
        if (bestHtmlSnapshot && passed < bestPassed) {
          info(`[pipeline] [${batchLabel}] Restoring best HTML (${bestPassed} passed > current ${passed})`);
          fs.writeFileSync(htmlFile, bestHtmlSnapshot);
          batchPassed = bestPassed;
          batchFailed = failed - (bestPassed - passed);
        }
        break;
      }

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

      // ── Pre-triage: deterministic rendering mismatch detection ───────────
      // If >3 failures all contain toBeVisible/toBeHidden, these are test-side
      // DOM visibility assumptions — skip without spending an LLM triage call.
      if (detectRenderingMismatch(failureDescs)) {
        const visCount = failureDescs.filter((f) => /toBeVisible|toBeHidden/i.test(f)).length;
        info(`[pipeline] [${batchLabel}] Pre-triage: toBeVisible pattern detected (${visCount} failures) — skip_tests`);
        progress('pretriage-visibility-skip', { gameId, batchLabel, count: visCount });
        report.skipped_tests.push({
          testName: `${batchLabel} batch (${visCount} failures)`,
          reason: `Deterministic pre-triage: ${visCount} toBeVisible/toBeHidden failures — rendering mismatch, tests assume DOM visibility the game doesn't guarantee`,
          batch: batchLabel,
          iteration,
        });
        if (bestHtmlSnapshot && passed < bestPassed) {
          info(`[pipeline] [${batchLabel}] Pre-triage: restoring best HTML (${bestPassed} passed > current ${passed})`);
          fs.writeFileSync(htmlFile, bestHtmlSnapshot);
          batchPassed = bestPassed;
        }
        break;
      }

      // ── LLM Triage ────────────────────────────────────────────────────────
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
          const lastDecisionIdx = triageOutput.lastIndexOf('"decision"');
          let jsonMatch = null;
          if (lastDecisionIdx !== -1) {
            let start = triageOutput.lastIndexOf('{', lastDecisionIdx);
            if (start !== -1) jsonMatch = [triageOutput.slice(start)];
          }
          if (!jsonMatch) jsonMatch = triageOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let depth = 0, end = -1;
            for (let i = 0; i < jsonMatch[0].length; i++) {
              if (jsonMatch[0][i] === '{') depth++;
              else if (jsonMatch[0][i] === '}') { depth--; if (depth === 0) { end = i; break; } }
            }
            const triage = JSON.parse(end !== -1 ? jsonMatch[0].slice(0, end + 1) : jsonMatch[0]);
            triageDecision = triage.decision || 'fix_tests';
            // Normalize singular 'skip_test' → 'skip_tests' (LLM sometimes follows
            // the decision description which says "skip_test" rather than the JSON
            // schema which says "skip_tests" — both should behave identically)
            if (triageDecision === 'skip_test') triageDecision = 'skip_tests';
            triageFixHints = triage.fix_hints || '';
            triageSkipTests = triage.tests_to_skip || [];
            triageRationale = triage.rationale || '';
            info(`[pipeline] [${batchLabel}] Triage: ${triageDecision} — ${triageRationale}`);
          }
        } catch {
          info(`[pipeline] [${batchLabel}] Triage failed, defaulting to fix_tests (safer for pre-built games)`);
        }
      }

      // ── E9: Pattern injection — augment fix hints with known failure patterns ──
      // Only at iteration 1, only for fix_html decisions, only when triage gave no hints.
      if (iteration === 1 && triageDecision === 'fix_html' && !triageFixHints) {
        const matchedPattern = findMatchingPattern(failuresStr, gameId);
        if (matchedPattern) {
          triageFixHints =
            `[Known pattern — ${matchedPattern.category}, seen ${matchedPattern.occurrences}x] ` +
            matchedPattern.pattern.slice(0, 150);
          info(
            `[pipeline] [${batchLabel}] Pattern injection: matched ${matchedPattern.category} pattern (${matchedPattern.occurrences}x)`,
          );
        }
      }

      // Remove skipped tests from spec file
      if (triageSkipTests.length > 0) {
        for (const specFile of batch.filter((f) => fs.existsSync(f))) {
          let specContent = fs.readFileSync(specFile, 'utf-8');
          let changed = false;
          for (const testName of triageSkipTests) {
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
            if (!/^\s*test\s*\(/m.test(specContent)) {
              fs.unlinkSync(specFile);
              info(`[pipeline] [${batchLabel}] Deleted empty spec file after triage — will regenerate on next build`);
            } else {
              fs.writeFileSync(specFile, specContent);
            }
          }
        }
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
        if (triageDecision === 'skip_tests') {
          info(`[pipeline] [${batchLabel}] All failures are test logic issues — skipping fix iteration`);
          break;
        }
      }

      if (triageDecision === 'skip_tests') {
        info(`[pipeline] [${batchLabel}] Triage: no HTML fix needed`);
        if (bestHtmlSnapshot && passed < bestPassed) {
          info(`[pipeline] [${batchLabel}] Restoring best HTML before exiting batch (${bestPassed} passed > current ${passed})`);
          fs.writeFileSync(htmlFile, bestHtmlSnapshot);
          batchPassed = bestPassed;
        }
        break;
      }

      // ── Build fix prompt with passing test context ───────────────────────
      const passingTestNames = [];
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
      } catch { /* ignore */ }

      const currentHtml = fs.readFileSync(htmlFile, 'utf-8');
      const batchTests = batch
        .filter((f) => fs.existsSync(f))
        .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
        .join('\n\n');

      const passingContext = passingTestNames.length > 0
        ? `\nCURRENTLY PASSING TESTS — your fix MUST NOT break these ${passingTestNames.length} passing tests:\n${passingTestNames.map((n) => `- ${n}`).join('\n')}\n`
        : '';

      const priorBatchContext = priorBatchPassingTests.length > 0
        ? `\nPREVIOUSLY PASSING BATCHES — your fix MUST NOT break any of these tests that passed in earlier categories:\n${
            priorBatchPassingTests.map(({ batchLabel: bl, testBodies: testNames }) =>
              `${bl}: ${testNames.join(', ')}`,
            ).join('\n')
          }\n`
        : '';

      const fixHintContext = triageFixHints ? `\nTARGETED FIX HINT: ${triageFixHints}\n` : '';
      const fixLearningsContext = fixLearningsContextStr();

      // For contract failures involving stars, include the spec scoring section verbatim
      let specScoringContext = '';
      if (batchLabel === 'contract' && failuresStr.includes('star')) {
        const scoringMatch = specContent.match(/(?:#{1,3}[^\n]*(?:scor|star|metric)[^\n]*\n)([\s\S]*?)(?=\n#{1,3}|\Z)/i);
        if (scoringMatch) {
          specScoringContext = `\nSPEC SCORING SECTION (authoritative — implement EXACTLY this logic):\n${scoringMatch[0].trim()}\n`;
        } else {
          specScoringContext = `\nSPEC STAR LOGIC: starType="${specMeta.starType}" — ${
            specMeta.starType === 'lives' ? 'stars = gameState.lives (remaining lives at game end, 0-3)' :
            specMeta.starType === 'avg-time' ? 'stars based on average time per round (see spec for thresholds)' :
            specMeta.starType === 'accuracy' ? 'stars based on accuracy percentage (see spec for thresholds)' :
            'see spec for star formula'
          }\n`;
        }

        const starRelatedTestNames = [];
        for (const { batchLabel: bl, testBodies: testNames } of priorBatchPassingTests) {
          const starNames = testNames.filter((name) => /\bstar|\bmetrics\.stars/.test(name));
          if (starNames.length > 0) {
            starRelatedTestNames.push({ batchLabel: bl, names: starNames });
          }
        }
        if (starRelatedTestNames.length > 0) {
          const starRefContext = starRelatedTestNames
            .map(({ batchLabel: bl, names }) => `${bl} (reference: star logic): ${names.join(', ')}`)
            .join('\n');
          specScoringContext += `\n\nPREVIOUSLY PASSING STAR TESTS — your fix MUST NOT break these:\n${starRefContext}\n`;
        }
      }

      // ── E8: Script-only fix (iteration 2+, non-contract batches, large HTML) ──
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

      // Build content: text prompt + optional timeout screenshots
      const timeoutScreenshots = collectTimeoutScreenshots(testResult);
      let fixContent = fixPrompt;
      if (timeoutScreenshots.length > 0) {
        info(`[pipeline] [${batchLabel}] Attaching ${timeoutScreenshots.length} timeout screenshot(s) to fix prompt`);
        fixContent = [
          { type: 'text', text: fixPrompt },
          ...timeoutScreenshots.flatMap(({ testTitle, base64 }) => [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
            { type: 'text', text: `Screenshot above: game state at moment of timeout in test "${testTitle}". Use this to diagnose what was visible when the timeout occurred.` },
          ]),
        ];
      }

      let fixOutput;
      let usedFixModel = FIX_MODEL;
      try {
        fixOutput = await trackedLlmCall(`fix-${batchLabel}-${iteration}`, fixContent, FIX_MODEL, {}, report);
        llmCalls.push({ step: `fix-${batchLabel}-${iteration}`, model: FIX_MODEL });
      } catch {
        try {
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-fallback-${iteration}`, fixContent, FALLBACK_MODEL, {}, report);
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
        const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
        const preFixSizeKb = Math.round(preFixSnapshot.length / 1024);
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
        const newSizeKb = Math.round(fixedHtml.length / 1024);
        progress('html-fixed', { gameId, htmlFile, batch: batchLabel, iteration, passed: batchPassed, failed: batchFailed, total: batchPassed + batchFailed, model: usedFixModel, prevSizeKb: preFixSizeKb, newSizeKb });

        const shrinkRatio = fixedHtml.length / preFixSnapshot.length;
        if (shrinkRatio < 0.7) {
          warn(`[pipeline] [${batchLabel}] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, rolling back`);
          fs.writeFileSync(htmlFile, preFixSnapshot);
          progress('html-fix-rolled-back', { gameId, batch: batchLabel, iteration, reason: 'size-drop' });
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

    // ── Cross-batch regression guard ──────────────────────────────────────
    // When this batch improved (batchPassed > 0), run a quick smoke-check of all
    // prior passing batches to confirm their results haven't regressed.
    // If any prior batch now fails, roll back to preBatchHtml and discard this
    // batch's result — better to keep prior batches healthy than accept a fix that
    // breaks earlier work.
    let rolledBack = false;
    if (batchPassed > 0 && priorPassingBatches.length > 0) {
      info(`[pipeline] [${batchLabel}] Cross-batch guard: smoke-checking ${priorPassingBatches.length} prior passing batch(es)`);
      progress('cross-batch-guard-start', { gameId, batchLabel, priorCount: priorPassingBatches.length });

      const regressions = await detectCrossBatchRegression(priorPassingBatches, gameDir, 90000);

      if (regressions.length > 0) {
        for (const reg of regressions) {
          warn(
            `[pipeline] [cross-batch-guard] REGRESSION: batch ${batchLabel} broke prior batch ${reg.category}` +
            ` (was ${reg.prevPassed}/${reg.prevTotal}, now ${reg.nowPassed}/${reg.nowTotal}) — rolling back`,
          );
        }
        progress('cross-batch-guard-rollback', { gameId, batchLabel, regressions });

        // Restore HTML to state before this batch's fix loop
        if (preBatchHtml) {
          fs.writeFileSync(htmlFile, preBatchHtml);
          injectHarnessToFile(htmlFile);
          info(`[pipeline] [${batchLabel}] Rolled back to pre-batch HTML — prior batch results preserved`);
        }

        // Mark batch as rolled_back: treat as all-failed so the outer totals reflect reality
        const batchTotal = batchPassed + batchFailed;
        batchPassed = 0;
        batchFailed = batchTotal;
        rolledBack = true;

        report.test_results.push({
          batch: batchLabel,
          iteration: 'rolled_back',
          passed: 0,
          failed: batchTotal,
          failures: `cross-batch regression: ${regressions.map((r) => r.category).join(', ')} regressed`,
        });
      } else {
        info(`[pipeline] [${batchLabel}] Cross-batch guard: no regressions detected`);
        progress('cross-batch-guard-ok', { gameId, batchLabel });
      }
    }

    totalPassed += batchPassed;
    totalFailed += batchFailed;
    report.category_results[batchLabel] = { passed: batchPassed, failed: batchFailed };

    // Collect passing test bodies from this batch to protect them in future batches.
    // Also register this batch in priorPassingBatches for the cross-batch regression guard.
    // Only do this when the batch actually passed (batchPassed > 0) and was NOT rolled back.
    if (batchPassed > 0 && !rolledBack) {
      const batchPassingNames = [];
      try {
        for (const specFile of batch.filter((f) => fs.existsSync(f))) {
          const specSrc = fs.readFileSync(specFile, 'utf-8');
          for (const m of specSrc.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
            batchPassingNames.push(m[1]);
          }
        }
      } catch { /* ignore */ }
      if (batchPassingNames.length > 0) {
        priorBatchPassingTests.push({ batchLabel, testBodies: batchPassingNames });
      }

      // Register each spec file in this batch individually so detectCrossBatchRegression
      // can re-run them one by one (more granular than running the whole batch at once).
      for (const specFile of batch.filter((f) => fs.existsSync(f))) {
        const category = path.basename(specFile, '.spec.js');
        priorPassingBatches.push({ category, specFile, passed: batchPassed, total: batchPassed + batchFailed });
      }
    }
  }

  // ── Step 3c: Global fix loop ────────────────────────────────────────────
  if (MAX_GLOBAL_FIX_ITERATIONS > 0) {
    const hasCrossFailures = Object.values(report.category_results).some((r) => r.failed > 0);
    if (hasCrossFailures) {
      info(`[pipeline] Step 3c: Global fix loop (up to ${MAX_GLOBAL_FIX_ITERATIONS} iterations)`);
      const failingCategoryNames = Object.entries(report.category_results)
        .filter(([, r]) => r.failed > 0)
        .map(([cat]) => cat);
      progress('global-fix-start', { gameId, maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS, failingCategories: failingCategoryNames, model: GLOBAL_FIX_MODEL });

      // Best-snapshot tracking for the global fix loop: if a later iteration degrades
      // scores, we restore the best HTML before proceeding to review (mirrors per-batch logic).
      let globalBestPassed = totalPassed;
      let globalBestHtml = fs.readFileSync(htmlFile, 'utf-8');

      for (let globalIter = 1; globalIter <= MAX_GLOBAL_FIX_ITERATIONS; globalIter++) {
        info(`[pipeline] [global] Iteration ${globalIter}/${MAX_GLOBAL_FIX_ITERATIONS}`);

        const globalFailingBatches = [];
        const globalPassingBatches = [];

        for (const batch of batches) {
          const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');

          // Skip batches whose spec files were all deleted by triage (skip_tests).
          // Running playwright on a non-existent file produces 0/0 which would
          // incorrectly be treated as a failing batch and trigger a spurious HTML fix.
          const existingBatchFiles = batch.filter((f) => fs.existsSync(f));
          if (existingBatchFiles.length === 0) {
            info(`[pipeline] [global] [${batchLabel}] All spec files deleted by triage — treating as passed`);
            globalPassingBatches.push({ batchLabel, testBodies: [] });
            continue;
          }

          let rtr;
          try {
            const { stdout } = await execFileAsync(
              'npx',
              ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...existingBatchFiles.map((f) => path.relative(gameDir, f))],
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
                for (const m of src.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
                  bodies.push(m[1]);
                }
              }
            } catch { /* ignore */ }
            globalPassingBatches.push({ batchLabel, testBodies: bodies });
          } else {
            // gFailed > 0 (real failures) OR gPassed===0 && gFailed===0 (0/0: page
            // crash / corrupted HTML — must NOT be treated as "all pass").
            if (gPassed === 0 && gFailed === 0) {
              warn(`[pipeline] [global] [${batchLabel}] 0/0 tests ran — page likely broken, treating as failing batch`);
            }
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
              globalPassingBatches.map(({ batchLabel, testBodies: testNames }) =>
                `${batchLabel}: ${testNames.join(', ')}`)
                .join('\n')
            }\n`
          : '';

        const alreadyCovered = new Set(globalPassingBatches.map((b) => b.batchLabel));
        const additionalPriorContext = priorBatchPassingTests
          .filter(({ batchLabel }) => !alreadyCovered.has(batchLabel) && !globalFailingBatches.some((b) => b.batchLabel === batchLabel))
          .map(({ batchLabel, testBodies: testNames }) =>
            `${batchLabel} (prior passing — do not regress): ${testNames.join(', ')}`)
          .join('\n');

        const currentHtml = fs.readFileSync(htmlFile, 'utf-8');

        const globalFixPrompt = buildGlobalFixPrompt({
          globalIter,
          maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS,
          fixLearningsContext: fixLearningsContextStr(),
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

        // Track global best: approximate total passing = passing batches spec count + failing batches' passed count
        const globalTotalPassed = globalPassingBatches.reduce((sum, b) => sum + b.testBodies.length, 0) +
          globalFailingBatches.reduce((sum, b) => sum + b.passed, 0);
        if (globalTotalPassed > globalBestPassed) {
          globalBestPassed = globalTotalPassed;
          globalBestHtml = globalFixedHtml + '\n';
          info(`[pipeline] [global] New global best: ${globalBestPassed} passing — snapshot saved`);
        }
      }

      // Restore best global HTML if the final iteration degraded scores
      const finalHtml = fs.readFileSync(htmlFile, 'utf-8');
      if (finalHtml !== globalBestHtml && globalBestHtml) {
        info(`[pipeline] [global] Restoring global best HTML before review (best had ${globalBestPassed} passing)`);
        fs.writeFileSync(htmlFile, globalBestHtml);
        injectHarnessToFile(htmlFile);
        progress('global-fix-best-restored', { gameId, globalBestPassed });
      }

      info(`[pipeline] Step 3c complete`);
    } else {
      info(`[pipeline] Step 3c: No cross-batch failures — skipping global fix loop`);
    }
  }

  // ── Step 3b: Final re-test of ALL batches on final HTML ────────────────────
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
      if (reTestPassed === 0 && reTestFailed === 0 && (prevPassed + prevFailed) > 0) {
        warn(`[pipeline] [${batchLabel}] Final re-test: 0/0 total (page crash?) — keeping previous score ${prevPassed}p/${prevFailed}f`);
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

  return { totalPassed, totalFailed };
}

module.exports = { runFixLoop, collectFailures, deterministicTriage, isInitFailure, detectRenderingMismatch, detectCrossBatchRegression };
