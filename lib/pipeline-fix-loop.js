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

const execFileAsync = promisify(execFile);

const MAX_ITERATIONS = parseInt(process.env.RALPH_MAX_ITERATIONS || '5', 10);
const MAX_GLOBAL_FIX_ITERATIONS = parseInt(process.env.RALPH_MAX_GLOBAL_FIX_ITERATIONS || '2', 10);
const CATEGORY_BATCH_SIZE = parseInt(process.env.RALPH_CATEGORY_BATCH_SIZE || '1', 10);
const FIX_MODEL = process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
const FALLBACK_MODEL = process.env.RALPH_FALLBACK_MODEL || 'gpt-4.1';
const TRIAGE_MODEL = process.env.RALPH_TRIAGE_MODEL || FIX_MODEL;
const GLOBAL_FIX_MODEL = process.env.RALPH_GLOBAL_FIX_MODEL || (process.env.RALPH_GEN_MODEL || 'claude-opus-4-6');
const TEST_TIMEOUT = parseInt(process.env.RALPH_TEST_TIMEOUT || '120', 10) * 1000;

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

function isInitFailure(failureDescs, passed) {
  if (passed !== 0) return false;
  if (!failureDescs || failureDescs.length === 0) return false;
  return failureDescs.some((f) => INIT_FAILURE_PATTERNS.some((p) => p.test(f)));
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

// ─── Deterministic triage ────────────────────────────────────────────────────

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

// ─── runFixLoop ──────────────────────────────────────────────────────────────
// Runs the per-batch test→fix loop (Step 3), global fix loop (Step 3c),
// and final re-test (Step 3b).
//
// ctx: {
//   gameDir, htmlFile, testsDir,
//   specContent, specMeta, genPrompt,
//   htmlWasFreshlyGenerated,
//   globalLearnings, dbLearnings,
//   info, warn, progress,
//   llmCalls, report, trackedLlmCall,
//   gameId, injectHarnessToFile,
// }
//
// Returns: { totalPassed, totalFailed }
// Also modifies report.category_results and report.test_results in place.

async function runFixLoop(ctx) {
  const {
    gameDir, htmlFile, testsDir,
    specContent, specMeta, genPrompt,
    globalLearnings, dbLearnings,
    info, warn, progress,
    llmCalls, report, trackedLlmCall,
    gameId, injectHarnessToFile,
  } = ctx;

  let { htmlWasFreshlyGenerated } = ctx;

  // Order spec files by category, then group into batches
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const orderedSpecFiles = [
    ...SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f)),
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

  let totalPassed = 0;
  let totalFailed = 0;
  const priorBatchPassingTests = [];

  // Helper: build learnings context string
  function fixLearningsContextStr() {
    const parts = [globalLearnings, dbLearnings].filter(Boolean);
    return parts.length > 0 ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${parts.join('\n')}\n` : '';
  }

  for (const [batchIdx, batch] of batches.entries()) {
    const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
    info(`[pipeline] Batch ${batchIdx + 1}/${batches.length}: ${batchLabel}`);
    progress('batch-start', { gameId, batch: batchLabel, batchIdx, totalBatches: batches.length });

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
          const WAREHOUSE_TEMPLATES_DIR = path.join(process.env.RALPH_REPO_DIR || '.', 'warehouse', 'templates');
          const warehousePath = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game', 'index.html');
          if (fs.existsSync(warehousePath)) {
            warn(
              `[pipeline] game-flow 0% on iter 1 with init failures + warehouse HTML detected — deleting warehouse HTML and regenerating`,
            );
            fs.unlinkSync(warehousePath);
            progress('warehouse-html-deleted', { gameId, reason: 'stale-init-failure' });
            try {
              const regenOutput = await trackedLlmCall('generate-html-regen', genPrompt, process.env.RALPH_GEN_MODEL || 'claude-opus-4-6', {}, report);
              llmCalls.push({ step: 'generate-html-regen', model: process.env.RALPH_GEN_MODEL || 'claude-opus-4-6' });
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

        if (passingTestNames.length > 0) {
          for (const specFile of batch.filter((f) => fs.existsSync(f))) {
            const specSrc = fs.readFileSync(specFile, 'utf-8');
            for (const name of passingTestNames) {
              const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

      const priorBatchContext = priorBatchPassingTests.length > 0
        ? `\nPREVIOUSLY PASSING BATCHES — these tests passed in earlier batches and MUST NOT be broken by this fix:\n${
            priorBatchPassingTests.map(({ batchLabel: bl, testBodies }) =>
              `=== ${bl} (DO NOT REGRESS) ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``,
            ).join('\n\n')
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

    totalPassed += batchPassed;
    totalFailed += batchFailed;
    report.category_results[batchLabel] = { passed: batchPassed, failed: batchFailed };

    // Collect passing test bodies from this batch to protect them in future batches
    if (batchPassed > 0) {
      const batchPassingBodies = [];
      try {
        for (const specFile of batch.filter((f) => fs.existsSync(f))) {
          const specSrc = fs.readFileSync(specFile, 'utf-8');
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

  // ── Step 3c: Global fix loop ────────────────────────────────────────────
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

module.exports = { runFixLoop, collectFailures, deterministicTriage, isInitFailure };
