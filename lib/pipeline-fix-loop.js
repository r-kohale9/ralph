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
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const { buildTriagePrompt, buildFixPrompt, buildGlobalFixPrompt, buildScriptDiff } = require('./prompts');
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

// ─── runStaticValidationLocal ────────────────────────────────────────────────
// Runs T1 static validator on an HTML string (written to a temp file).
// Returns { passed: boolean, checks: string[] } where checks is the list of
// error check names that fired (e.g. 'missing-gameContent', 'missing-window-endGame').
// Used to detect T1 regressions introduced by fix-loop HTML patches.

const VALIDATOR_TIMEOUT_MS = 10000;
const STATIC_VALIDATOR_PATH = path.join(__dirname, 'validate-static.js');

/**
 * Runs T1 static validation against an HTML string.
 * Writes content to a temp file, runs validate-static.js, parses error check names from output.
 * @param {string} html - HTML content to validate
 * @returns {{ passed: boolean, checks: string[] }} checks is list of error check IDs that fired
 */
function runStaticValidationLocal(html) {
  if (!fs.existsSync(STATIC_VALIDATOR_PATH)) return { passed: true, checks: [] };
  const tmpPath = path.join(require('os').tmpdir(), `ralph-t1-check-${Date.now()}.html`);
  try {
    fs.writeFileSync(tmpPath, html, 'utf-8');
    let output = '';
    try {
      output = execFileSync('node', [STATIC_VALIDATOR_PATH, tmpPath], {
        encoding: 'utf-8',
        timeout: VALIDATOR_TIMEOUT_MS,
      });
      // Passed — extract any warning check names if needed (no errors)
      return { passed: true, checks: [] };
    } catch (err) {
      output = err.stdout || err.message || '';
      // Extract check IDs from error lines — they appear as [check-name] in validator output
      const checks = [];
      for (const m of output.matchAll(/\[([a-z][a-z0-9-]+)\]/gi)) {
        checks.push(m[1]);
      }
      return { passed: false, checks };
    }
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

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

// ─── isCdnTimingFailure helper ───────────────────────────────────────────────
// Returns true when:
//   (a) the HTML contains `waitForPackages` (confirming this is a CDN game)
//   (b) every error in the errors array matches a timeout/visibility-never-appeared pattern
//   (c) when 2+ errors are provided, consecutive errors share >60% token overlap
//       (indicating the same failure repeated, not a different problem)
//
// When all three conditions hold the HTML structure is likely correct — only the
// CDN cold-start timing is causing failures.  The fix loop cannot help; skip remaining
// iterations and emit a CDN_TIMING_HINT instead of burning LLM calls.
//
// CDN_TIMING_HINT text is intentionally simple so the fix prompt builder can inject
// it as a targeted fix hint — it directs the human/next-build to increase timeout.

const CDN_TIMING_PATTERNS = [
  /start button never appears/i,
  /first ui element never appears/i,
  /locator\.click.*timeout/i,
  /locator\.fill.*timeout/i,
  /locator\.waitfor.*timeout/i,
  /waitforselector.*timeout/i,
  /waitForFunction.*timeout/i,
  /page\.waitfor.*timeout/i,
  /toBeVisible.*timeout/i,
  /TimeoutError.*waiting for/i,
  /Timeout.*exceeded.*waiting/i,
  /waiting for.*to be visible/i,
  /waiting for.*click/i,
  /element.*not.*visible.*timeout/i,
  /element.*to become.*visible/i,
];

const CDN_TIMING_HINT =
  'CDN timing failure — start button / UI element did not appear within timeout. ' +
  'HTML structure is correct (waitForPackages present). ' +
  'Fix: increase beforeEach page.waitForFunction timeout or add explicit wait after startGame().';

/**
 * Returns the Jaccard token-overlap ratio (0..1) between two error strings.
 * Used to determine whether consecutive iterations show the same failure pattern.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function tokenOverlap(a, b) {
  const toTokens = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const setA = toTokens(a);
  const setB = toTokens(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Returns true when the given error strings look like CDN timing failures
 * (timeout/visibility patterns) AND the HTML has the waitForPackages guard,
 * AND (when 2+ errors) consecutive errors are sufficiently similar (>60% tokens).
 *
 * @param {string[]} errors - Collected per-iteration failureDescs strings (one per iteration)
 * @param {string} html - Current HTML content of the game file
 * @returns {boolean}
 */
function isCdnTimingFailure(errors, html) {
  if (!errors || errors.length === 0) return false;
  if (!html || !html.includes('waitForPackages')) return false;

  // All accumulated error strings must contain at least one CDN timing pattern
  const allMatchTiming = errors.every((err) =>
    CDN_TIMING_PATTERNS.some((re) => re.test(err)),
  );
  if (!allMatchTiming) return false;

  // If we have 2+ iterations of errors, check that consecutive pairs are similar
  // (>60% token overlap) — if errors are diverging, fixes may be making progress
  if (errors.length >= 2) {
    for (let i = 0; i < errors.length - 1; i++) {
      const sim = tokenOverlap(errors[i], errors[i + 1]);
      if (sim < 0.60) return false;
    }
  }

  return true;
}

// ─── detectCdnTimingStall helper ─────────────────────────────────────────────
// Detects when the fix loop is burning iterations on CDN timing failures rather
// than fixable HTML bugs. Operates on per-iteration failure object arrays
// (each object has testName, error, errorMessage fields).
//
// Returns true when ALL of the following hold:
//   (a) at least 2 failures in the current batch
//   (b) both current and previous failure sets are non-empty
//   (c) failure messages in current batch match CDN timing patterns
//   (d) similarity score >75% between current and previous failure messages
//       (indicating identical failures across iterations — not improvements)
//
// When true, the fix loop cannot help — CDN cold-start latency is the root cause,
// not a bug in the HTML. Breaking early saves 2-4 LLM fix calls.
// (Lesson 143 / R&D: CDN timing early-exit heuristic)

const STALL_CDN_TIMING_PATTERNS = [
  /cdn-timing-early-exit/i,
  /packages failed to load/i,
  /waitForPackages.*timeout/i,
  /start button.*never appear/i,
  /CDN.*never loaded/i,
  /mathai-slot.*never appeared/i,
  /start button never appears/i,
  /first ui element never appears/i,
  /locator\.click.*timeout/i,
  /locator\.fill.*timeout/i,
  /locator\.waitfor.*timeout/i,
  /waitforselector.*timeout/i,
  /waitForFunction.*timeout/i,
  /page\.waitfor.*timeout/i,
  /toBeVisible.*timeout/i,
  /TimeoutError.*waiting for/i,
  /Timeout.*exceeded.*waiting/i,
  /waiting for.*to be visible/i,
  /waiting for.*click/i,
  /element.*not.*visible.*timeout/i,
  /element.*to become.*visible/i,
];

/**
 * Extracts a single combined error string from a failure object.
 * Prefers errorMessage, falls back to error, then testName.
 * @param {{ testName?: string, error?: string, errorMessage?: string }} failure
 * @returns {string}
 */
function failureToText(failure) {
  return [failure.errorMessage, failure.error, failure.testName]
    .filter(Boolean)
    .join(' ');
}

/**
 * Detects when the fix loop is burning iterations on CDN timing failures that
 * cannot be fixed by patching the HTML.
 *
 * @param {Array<{testName?: string, error?: string, errorMessage?: string}>} failures - Current iteration failures
 * @param {Array<{testName?: string, error?: string, errorMessage?: string}>} prevFailures - Previous iteration failures
 * @returns {boolean} true if CDN timing stall detected — break the fix loop
 */
function detectCdnTimingStall(failures, prevFailures) {
  // Need both current and previous iteration data to confirm the stall is persistent
  if (!failures || failures.length < 2) return false;
  if (!prevFailures || prevFailures.length === 0) return false;

  // All failures in the current batch must match CDN timing patterns
  const allMatchTiming = failures.every((f) => {
    const text = failureToText(f);
    return STALL_CDN_TIMING_PATTERNS.some((re) => re.test(text));
  });
  if (!allMatchTiming) return false;

  // Compute average token similarity between current and previous failure sets.
  // Combine all failure texts per iteration into a single string, then compare.
  // If similarity >75%, the failures are identical — fixes are not helping.
  const currentText = failures.map(failureToText).join(' ');
  const prevText = prevFailures.map(failureToText).join(' ');
  const sim = tokenOverlap(currentText, prevText);

  return sim > 0.75;
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

// ─── LESSON_PATTERNS — error-to-lesson lookup table (R&D #56) ────────────────
// Maps known test failure message substrings (regex) to pipeline lesson hints.
// getMatchingLessons(text) returns up to MAX_LESSON_HINTS matching lesson strings.
// Inject into fix prompts so the fix LLM is aware of documented failure patterns.

const MAX_LESSON_HINTS = 3;

const LESSON_PATTERNS = [
  {
    pattern: /packages failed to load/i,
    lesson:
      'Lesson 117: waitForPackages() MUST use 120000ms (2 min) timeout that THROWS — CDN cold-start takes 30-120s; 10s guarantees failure. Fix: if(elapsed>=timeout){throw new Error(\'Packages failed to load within 120s\')}',
  },
  {
    pattern: /FeedbackManager\.sound\.playDynamicFeedback/i,
    lesson:
      'Lesson 115: WRONG NAMESPACE — call FeedbackManager.playDynamicFeedback({...}) NOT FeedbackManager.sound.playDynamicFeedback(). The .sound sub-object does NOT have this method; calling it throws a synchronous TypeError that leaves isProcessing=true permanently and deadlocks the round lifecycle.',
  },
  {
    pattern: /isProcessing|scheduleNextRound/i,
    lesson:
      'Lesson 59/CDN: isProcessing=true SILENTLY BLOCKS clicks (early return only). Reset gameState.isProcessing=false at START of endGame() and BEFORE showLevelTransition(). Also reset before setTimeout(() => roundComplete(), delay) — not inside it.',
  },
  {
    pattern: /TransitionScreen|transitionScreen\.show|hasButton|start button/i,
    lesson:
      'Lesson 118 / RULE-008: ALL transitionScreen.show({...}) calls MUST use await. Unawaited calls corrupt CDN component state — subsequent show() calls hang with button visibility:hidden. Reject if ANY show() call is missing await.',
  },
  {
    pattern: /window\.gameState|syncDOMState|data-phase.*never set/i,
    lesson:
      'Lesson 40: window.gameState MUST be on window — syncDOMState() reads window.gameState; if declared as const/let (not on window), data-phase is NEVER set and ALL waitForPhase() calls timeout. Use window.gameState = gameState at global scope.',
  },
  {
    pattern: /waitForPhase.*timeout|data-phase.*timeout/i,
    lesson:
      'Lesson 50: Every gameState.phase = assignment MUST be immediately followed by syncDOMState(). Without this, data-phase on #app is never updated and waitForPhase() timeouts. Also check Lesson 68: phase names are normalized — game_over→gameover, start_screen→start, game_complete→results.',
  },
  {
    pattern: /ScreenLayout\.inject|slots:/i,
    lesson:
      'Lesson 69: ScreenLayout.inject() requires slots: wrapper — CORRECT: ScreenLayout.inject(\'app\', { slots: { progressBar: true, transitionScreen: true } }). Without slots:, ScreenLayout runs without error but never creates #gameContent.',
  },
  {
    pattern: /#gameContent.*missing|missing.*#gameContent|gameContent.*not found/i,
    lesson:
      'Lesson 69 / smoke-regen: Missing #gameContent means ScreenLayout.inject() failed silently. Check: (1) slots: wrapper present, (2) ScreenLayout imported and loaded, (3) SCREENLAYOUT GUARD: after inject(), add if(!document.getElementById(\'gameContent\')){throw new Error(\'ScreenLayout.inject() did not create #gameContent\')}',
  },
  {
    pattern: /typeof TimerComponent|TimerComponent.*undefined|Container with id \[object/i,
    lesson:
      'Lesson 98: TimerComponent IS in CDN bundle but loads AFTER ScreenLayout/FeedbackManager. Add "|| typeof TimerComponent === \'undefined\'" to waitForPackages() condition. CONSTRUCTOR: new TimerComponent(\'container-id\', {...}) — first arg MUST be element ID string, NOT DOM element and NOT options object.',
  },
  {
    pattern: /window\.endGame.*undefined|window\.restartGame.*undefined|window\.nextRound.*undefined/i,
    lesson:
      'Lesson 33: CDN games define endGame/restartGame/nextRound inside DOMContentLoaded closure — NOT on window. Add window.endGame=endGame, window.restartGame=restartGame, window.nextRound=nextRound at global scope OUTSIDE DOMContentLoaded.',
  },
  {
    pattern: /gameState\.phase.*game_init|game_init.*phase.*playing/i,
    lesson:
      'Lesson 34: game_init handler MUST set gameState.phase = \'playing\' as FIRST action. All game-flow tests call waitForPhase(page, \'playing\') after firing game_init — if phase is not set immediately, all tests timeout.',
  },
  {
    pattern: /calcStars|stars.*game_over|game_over.*stars.*0/i,
    lesson:
      'Lesson 59 / CDN: calcStars() MUST have explicit: if(outcome===\'game_over\') return 0. Without this, time-based formula applies to game_over paths and returns stars=1 instead of 0. Contract validator expects stars=0 for all game_over outcomes.',
  },
  {
    pattern: /FeedbackManager\.init\(\)|audio.*popup|popup.*audio/i,
    lesson:
      'Lesson 51/67: FeedbackManager.init() shows blocking audio popup in Playwright tests. ONLY call when PART-017=YES. Never call it when PART-017=NO — it causes 100% non-deterministic test failures from popup race condition.',
  },
  {
    pattern: /popup-backdrop|backdrop.*overlay|overlay.*intercept/i,
    lesson:
      'Lesson 58: #popup-backdrop from VisibilityTracker persists after onResume with position:fixed; z-index:9999, intercepting all clicks. Fix: in onResume AND restartGame() add: const bd=document.getElementById(\'popup-backdrop\'); if(bd){bd.style.display=\'none\'; bd.style.pointerEvents=\'none\';}',
  },
  {
    pattern: /window\.gameState\.content|fallbackContent|content.*null.*test gen/i,
    lesson:
      'CDN constraint: window.gameState.content MUST be pre-populated with fallback round data BEFORE await waitForPackages(). DOM snapshot reads window.gameState.content synchronously — if only set on game_init, snapshot captures null and test gen gets corrupted fallback data.',
  },
  {
    pattern: /\.resolves\.toBe|\.resolves\.toEqual.*await/i,
    lesson:
      'Lesson 77: NEVER use .resolves on an already-awaited value. WRONG: expect(await page.evaluate(...)).resolves.toBe(3). RIGHT: expect(await page.evaluate(...)).toBe(3). .resolves expects a Promise; applying it to a resolved value throws TypeError.',
  },
  {
    pattern: /cdn\.mathai\.ai|cdn\.homeworkapp\.ai.*404/i,
    lesson:
      'Lesson 38/26: CDN domain MUST be storage.googleapis.com/test-dynamic-assets — NEVER cdn.mathai.ai or cdn.homeworkapp.ai (both 404/403). Fix: replace all CDN script src values with https://storage.googleapis.com/test-dynamic-assets/packages/{helpers,components,feedback-manager}/index.js',
  },
  {
    pattern: /Sentry\.captureConsoleIntegration|captureConsoleIntegration is not a function/i,
    lesson:
      'Lesson 76: Sentry.captureConsoleIntegration() is NOT in the base bundle — it requires a separate plugin. OMIT integrations entirely: call initSentry() with no integrations argument or pass []. Calling captureConsoleIntegration throws TypeError and crashes init before #gameContent is created.',
  },
];

/**
 * Returns up to MAX_LESSON_HINTS lesson hint strings that match patterns found in text.
 * Used to inject known pipeline lessons into fix prompts.
 * @param {string} text - Combined error message + triage decision text to match against
 * @returns {string[]} Array of lesson hint strings (max MAX_LESSON_HINTS entries)
 */
function getMatchingLessons(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  for (const entry of LESSON_PATTERNS) {
    if (entry.pattern.test(text)) {
      matches.push(entry.lesson);
      if (matches.length >= MAX_LESSON_HINTS) break;
    }
  }
  return matches;
}

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

// ─── verifyE8MergeIntegrity ───────────────────────────────────────────────────
// Before accepting an E8-merged result, verify that all CDN <script src="...">
// tags from the original HTML are still present in the merged HTML.
// If scripts went missing the merged HTML will produce a blank page.
//
// Returns: { valid, missingScripts, originalCount, mergedCount }
//   valid          — true when merged has at least as many CDN src tags as original
//                    AND all original CDN URLs are present in merged
//   missingScripts — array of CDN URL strings that are in original but not in merged
//   originalCount  — number of <script src="..."> tags in original
//   mergedCount    — number of <script src="..."> tags in merged

function verifyE8MergeIntegrity(originalHtml, mergedHtml) {
  function extractSrcUrls(html) {
    const urls = [];
    const re = /<script[^>]+\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      urls.push(m[1]);
    }
    return urls;
  }

  const originalUrls = extractSrcUrls(originalHtml || '');
  const mergedUrls = extractSrcUrls(mergedHtml || '');
  const mergedSet = new Set(mergedUrls);
  const missingScripts = originalUrls.filter((url) => !mergedSet.has(url));

  const originalCount = originalUrls.length;
  const mergedCount = mergedUrls.length;
  const valid = missingScripts.length === 0 && mergedCount >= originalCount;

  return { valid, missingScripts, originalCount, mergedCount };
}

// ─── capturePageConsoleErrors ────────────────────────────────────────────────
// Launches a headless Chromium browser, navigates to a local HTML file, and
// collects console errors and uncaught page errors that surface within 3 seconds.
// Used to diagnose 0/0 test results (page crash after a fix regression).
// Returns up to 5 deduplicated error strings. Returns [] on any failure.

/**
 * Captures browser console errors from a local HTML file by launching Chromium headlessly.
 * Used to diagnose post-fix page crashes that produce 0/0 test results.
 * @param {string} htmlPath - Absolute path to the HTML file to diagnose
 * @returns {Promise<string[]>} Up to 5 deduplicated error strings, or [] on failure
 */
async function capturePageConsoleErrors(htmlPath) {
  let browser;
  try {
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message || String(err));
    });

    const fileUrl = `file://${htmlPath}`;
    await page.goto(fileUrl, { timeout: 5000 }).catch(() => {});
    // Wait up to 3 seconds for errors to surface
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Deduplicate and cap at 5
    const seen = new Set();
    const deduped = [];
    for (const e of errors) {
      const key = e.slice(0, 200);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
      if (deduped.length >= 5) break;
    }
    return deduped;
  } catch {
    return [];
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
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
      if (err.stderr) warn(`[pipeline] Playwright stderr: ${err.stderr.slice(0, 500)}`);
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
    trackedClaudeCall,
    useClaudeCli, isClaudeModel,
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

  // Track batches where triage deleted ALL spec files — these should not trigger
  // the global fix loop since there is nothing left to test.
  const deletedSpecBatches = new Set();

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
    let lastBrokenPageErrors = [];
    // Track HTML from the start of the previous iteration for diff-based fix prompts (iteration 2+)
    let prevIterHtml = null;
    // CDN timing early-exit: accumulate per-iteration failure strings to detect
    // repeated timeout/visibility failures that the fix loop cannot resolve.
    const cdnTimingErrorHistory = [];
    // detectCdnTimingStall: track failure objects from the previous iteration so
    // detectCdnTimingStall() can compare across iterations without requiring
    // waitForPackages in HTML (catches CDN stalls in games that use other CDN loading patterns).
    let prevIterFailureObjects = null;
    // Consecutive 0/0 counter: if Playwright returns 0 passed + 0 failed twice in a
    // row the page is structurally broken and restoring the best snapshot each time
    // won't help — break after 2 consecutive 0/0 results regardless of bestPassed.
    let consecutiveZeroCount = 0;

    // Capture T1 error checks on the initial HTML before the fix loop runs.
    // After each fix, re-run T1 and compare — if the fix introduces NEW T1 errors,
    // discard it and restore the best snapshot to prevent CDN init corruption (Pattern 1).
    let originalT1Checks = [];
    if (fs.existsSync(htmlFile)) {
      try {
        const originalHtml = fs.readFileSync(htmlFile, 'utf-8');
        const t1Initial = runStaticValidationLocal(originalHtml);
        originalT1Checks = t1Initial.checks;
      } catch {
        // T1 capture failure must not block the fix loop
      }
    }

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
        if (err.stderr) warn(`[pipeline] Playwright stderr: ${err.stderr.slice(0, 500)}`);
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
        consecutiveZeroCount++;
        warn(`[pipeline] [${batchLabel}] 0/0 tests: no tests ran — page likely broken by last fix, restoring best HTML (consecutive 0/0: ${consecutiveZeroCount})`);
        // Only capture browser errors for post-fix regressions (not the very first run)
        if (iteration > 1 || bestPassed > 0) {
          info(`[pipeline] [${batchLabel}] Capturing browser console errors from broken HTML for next fix prompt`);
          lastBrokenPageErrors = await capturePageConsoleErrors(htmlFile);
          if (lastBrokenPageErrors.length > 0) {
            info(`[pipeline] [${batchLabel}] Captured ${lastBrokenPageErrors.length} browser error(s): ${lastBrokenPageErrors[0].slice(0, 100)}...`);
          } else {
            info(`[pipeline] [${batchLabel}] No browser console errors captured from broken HTML`);
          }
        }
        if (bestHtmlSnapshot) {
          fs.writeFileSync(htmlFile, bestHtmlSnapshot);
          batchPassed = bestPassed; // restore score to match best-snapshot HTML
          batchFailed = 0; // 0/0 means we don't know failed count; best-snapshot is clean
          info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
        } else {
          // No good snapshot to restore (category was already at 0 passed in iter 1).
          // Continuing fix iterations won't help — break immediately to avoid 2 wasted LLM calls.
          warn(`[pipeline] [${batchLabel}] 0/0 with no best snapshot (category never passed) — aborting fix loop for this category`);
          break;
        }
        // If 0/0 has occurred 2+ times consecutively the page is structurally broken and
        // restoring the best snapshot each time will not help — break to save iterations.
        if (consecutiveZeroCount >= 2) {
          warn(`[pipeline] [${batchLabel}] 2 consecutive 0/0 results — page structurally broken, aborting fix loop for this category`);
          break;
        }
        if (iteration >= MAX_ITERATIONS) break;
        continue;
      }
      // Tests actually ran — reset the consecutive zero counter
      consecutiveZeroCount = 0;

      if (failed === 0 && passed > 0) {
        info(`[pipeline] [${batchLabel}] All tests pass!`);
        lastBrokenPageErrors = []; // clear stale errors on success
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

      // ── CDN timing early-exit heuristic (Lesson 143 / R&D) ─────────────────
      // Accumulate error string for this iteration into CDN timing history.
      // After iteration 1 completes with failures, check if ALL accumulated errors
      // look like CDN timing failures (timeout/visibility, identical across iterations).
      // If so, skip remaining fix iterations — the fix loop cannot help CDN cold-start
      // failures and would burn 2-4 LLM calls with zero benefit.
      cdnTimingErrorHistory.push(failuresStr);
      // Build failure objects from this iteration's failureDescs for detectCdnTimingStall()
      const currentIterFailureObjects = failureDescs.map((desc) => ({ error: desc }));
      if (iteration >= 2) {
        const currentHtmlForCdn = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf-8') : '';
        // isCdnTimingFailure: requires waitForPackages in HTML, checks accumulated string history
        // detectCdnTimingStall: object-based cross-iteration comparison, no HTML requirement
        const cdnStallViaString = isCdnTimingFailure(cdnTimingErrorHistory, currentHtmlForCdn);
        const cdnStallViaObjects = detectCdnTimingStall(currentIterFailureObjects, prevIterFailureObjects);
        if (cdnStallViaString || cdnStallViaObjects) {
          info(
            `[pipeline] [${batchLabel}] CDN timing stall detected across ${cdnTimingErrorHistory.length} iterations — skipping remaining fix iterations (method: ${cdnStallViaString ? 'string-history' : 'object-comparison'})`,
          );
          progress('cdn-timing-stall-detected', {
            gameId,
            batchLabel,
            iterations: cdnTimingErrorHistory.length,
            method: cdnStallViaString ? 'string-history' : 'object-comparison',
            hint: CDN_TIMING_HINT,
          });
          report.skipped_tests.push({
            testName: `${batchLabel} batch (CDN timing stall after ${cdnTimingErrorHistory.length} iterations)`,
            reason: CDN_TIMING_HINT,
            batch: batchLabel,
            iteration,
          });
          if (bestHtmlSnapshot && passed < bestPassed) {
            info(`[pipeline] [${batchLabel}] CDN stall exit: restoring best HTML (${bestPassed} passed > current ${passed})`);
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            batchPassed = bestPassed;
          }
          break;
        }
      }
      // Save current iteration's failure objects as previous for next iteration's comparison
      prevIterFailureObjects = currentIterFailureObjects;

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
          // If all spec files were deleted by triage, record this batch as deleted so
          // the global fix loop trigger does not fire for it (no spec = nothing to fix).
          const anySpecStillExists = batch.some((f) => fs.existsSync(f));
          if (!anySpecStillExists) {
            batchFailed = 0;
            deletedSpecBatches.add(batchLabel);
            info(`[pipeline] [${batchLabel}] All spec files deleted by triage — resetting batchFailed to 0, marking as deleted`);
          }
          break;
        }
      }

      // If triage skipped tests and ALL spec files are now empty/deleted, skip the fix.
      // This prevents a wasted fix LLM call + 0/0 guard trip when a "mixed" triage
      // verdict skips the only remaining test in a batch.
      if (triageSkipTests.length > 0 && !batch.some((f) => fs.existsSync(f))) {
        info(`[pipeline] [${batchLabel}] All spec files empty after triage skip — skipping fix, marking batch as deleted`);
        batchFailed = 0;
        deletedSpecBatches.add(batchLabel);
        break;
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

      // Compute script diff for iteration 2+ (diff from previous iteration's HTML to current)
      const scriptDiffContext = (iteration >= 2 && prevIterHtml)
        ? buildScriptDiff(prevIterHtml, currentHtml)
        : null;

      // Snapshot current HTML before the fix so next iteration can diff against it
      prevIterHtml = currentHtml;

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

      // ── R&D #56: Inject matching pipeline lessons into fix prompt ────────────
      const lessonHints = getMatchingLessons(failuresStr + ' ' + (triageFixHints || ''));
      const lessonHintsContext = lessonHints.length > 0
        ? `\nKNOWN PATTERNS (from pipeline lessons-learned):\n${lessonHints.map((l) => `- ${l}`).join('\n')}\n`
        : '';

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

      const brokenPageErrorContext = lastBrokenPageErrors.length > 0
        ? `\nPREVIOUS FIX BROKE THE PAGE — browser errors captured:\n${lastBrokenPageErrors.map((e) => `- ${e}`).join('\n')}\nThese errors occurred after the last fix attempt. Your current fix must not cause these errors.\n`
        : '';

      // Reset broken-page errors now that we've consumed them for this prompt
      lastBrokenPageErrors = [];

      // Use @file_path reference when: USE_CLAUDE_CLI=1, FIX_MODEL is Claude, and NOT in E8 script-only mode
      // (E8 sends only script sections, not the full file — @file_path can't be used for partial content)
      const useFileRefFix = useClaudeCli && isClaudeModel && isClaudeModel(FIX_MODEL) && !e8OriginalHtml;
      const fixPrompt = buildFixPrompt({
        batchLabel,
        fixStrategy,
        fixHintContext,
        specScoringContext,
        fixLearningsContext,
        lessonHintsContext,
        failed,
        failuresStr,
        passingContext,
        priorBatchContext,
        batchTests,
        htmlForPrompt: useFileRefFix ? undefined : htmlForPrompt,
        htmlPath: useFileRefFix ? htmlFile : undefined,
        outputInstructions,
        brokenPageErrorContext,
        scriptDiffContext,
      });

      fixHistory += `\nIteration ${iteration}: ${failed} failures — ${failuresStr}`;

      // Build content: text prompt + optional timeout screenshots
      // Note: timeout screenshots only work with callLlm (multimodal API) — not callClaude CLI
      const timeoutScreenshots = useFileRefFix ? [] : collectTimeoutScreenshots(testResult);
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
        if (useFileRefFix && trackedClaudeCall) {
          fixOutput = await trackedClaudeCall(`fix-${batchLabel}-${iteration}`, fixContent, FIX_MODEL, { cwd: gameDir }, report);
        } else {
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-${iteration}`, fixContent, FIX_MODEL, {}, report);
        }
        llmCalls.push({ step: `fix-${batchLabel}-${iteration}`, model: FIX_MODEL });
      } catch {
        try {
          // Fallback always uses callLlm (FALLBACK_MODEL may not be Claude)
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-fallback-${iteration}`, fixContent instanceof Array ? fixContent[0].text : fixContent, FALLBACK_MODEL, {}, report);
          llmCalls.push({ step: `fix-${batchLabel}-fallback-${iteration}`, model: FALLBACK_MODEL });
          usedFixModel = FALLBACK_MODEL;
        } catch {
          warn(`[pipeline] Both fix models failed for batch '${batchLabel}'`);
          // If we have no passing snapshot to fall back on, there is nothing to
          // restore — further iterations will retry on the same broken HTML.
          // Break immediately to avoid 2+ wasted LLM calls on unchanged state.
          if (bestPassed === 0) {
            warn(`[pipeline] [${batchLabel}] Both models failed + no best snapshot — aborting fix loop for this category`);
            break;
          }
          continue;
        }
      }

      let fixedHtml = extractHtml(fixOutput);
      // E8: merge script-only fix back into original HTML
      if (fixedHtml && e8OriginalHtml) {
        const merged = mergeScriptFix(e8OriginalHtml, fixedHtml);
        if (merged) {
          // Integrity check: ensure CDN <script src> tags were not dropped by the merge
          const integrityResult = verifyE8MergeIntegrity(e8OriginalHtml, merged);
          if (!integrityResult.valid) {
            warn(
              `[pipeline] [${batchLabel}] E8 merge integrity check failed — missing ${integrityResult.missingScripts.length} CDN scripts: ${integrityResult.missingScripts.join(', ')}. Falling back to full HTML fix.`
            );
            progress('e8-integrity-failed', {
              gameId,
              batch: batchLabel,
              iteration,
              missingScripts: integrityResult.missingScripts,
              originalCount: integrityResult.originalCount,
              mergedCount: integrityResult.mergedCount,
            });
            // Don't apply the broken merge — leave fixedHtml as the LLM's raw script output
            // so the subsequent T1 regression guard and size-drop guard can still run,
            // and the next iteration will attempt a full HTML fix instead.
            fixedHtml = null;
          } else {
            info(`[pipeline] [${batchLabel}] E8: Merged script fix back into full HTML`);
            fixedHtml = merged;
          }
        } else {
          info(`[pipeline] [${batchLabel}] E8: Merge failed — using fix output as-is`);
        }
      }
      if (fixedHtml) {
        // ── T1 regression guard: check for NEW static errors introduced by this fix ──
        // If the fix LLM corrupts CDN init (e.g., removes ScreenLayout.inject() call,
        // breaks waitForPackages), T1 will fire new errors not present in the original HTML.
        // Discard the fix and restore bestHtmlSnapshot to prevent CDN init corruption (Pattern 1).
        let t1RegressionDetected = false;
        if (originalT1Checks !== null) {
          try {
            const t1After = runStaticValidationLocal(fixedHtml);
            if (!t1After.passed) {
              const newT1Checks = t1After.checks.filter((c) => !originalT1Checks.includes(c));
              if (newT1Checks.length > 0) {
                warn(`[pipeline] [${batchLabel}] Fix iteration ${iteration} introduced ${newT1Checks.length} new T1 error(s): ${newT1Checks.join(', ')} — discarding fix`);
                progress('t1-regression-detected', { gameId, batch: batchLabel, iteration, newChecks: newT1Checks });
                t1RegressionDetected = true;
                if (bestHtmlSnapshot) {
                  fs.writeFileSync(htmlFile, bestHtmlSnapshot);
                  info(`[pipeline] [${batchLabel}] T1 regression: restored best HTML snapshot (${bestPassed} passed)`);
                }
              }
            }
          } catch {
            // T1 check failure must not block the fix loop
          }
        }
        if (t1RegressionDetected) continue;

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
    // Also trigger the global fix loop when any category returned 0/0 (no tests ran).
    // A 0/0 result means the page was likely broken — must not be treated as passing.
    // Exclude batches where triage deleted all spec files — those have nothing to fix.
    const hasCrossFailures = Object.entries(report.category_results).some(
      ([cat, r]) => !deletedSpecBatches.has(cat) && (r.failed > 0 || (r.passed === 0 && r.failed === 0)),
    );
    if (hasCrossFailures) {
      // ── Global fix suppression: ≥80% categories passing ──────────────────
      // When ≥80% of non-deleted categories have at least 1 passing test, skip the global
      // fix loop entirely. The global fix rewrites the entire game HTML and risks regressing
      // the already-passing categories (Lesson 148: build #531 soh-cah-toa-worked-example —
      // 6/7 categories passed, global fix fired, regressed everything to 0/11).
      // Instead fall through to the final re-test (Step 3b) which will surface the true scores.
      const suppressionResult = shouldSuppressGlobalFix(report.category_results, deletedSpecBatches);
      if (suppressionResult.suppress) {
        info(
          `[pipeline] Step 3c: Skipping global fix — ${suppressionResult.passingCategories}/${suppressionResult.totalCategories} categories passing (≥80% threshold). Global fix risks regressing passing categories.`,
        );
        progress('global-fix-suppressed', {
          gameId,
          passingCategories: suppressionResult.passingCategories,
          totalCategories: suppressionResult.totalCategories,
          reason: 'high_pass_rate',
        });
      } else {
        info(`[pipeline] Step 3c: Global fix loop (up to ${MAX_GLOBAL_FIX_ITERATIONS} iterations)`);
        const failingCategoryNames = Object.entries(report.category_results)
          .filter(([cat, r]) => !deletedSpecBatches.has(cat) && (r.failed > 0 || (r.passed === 0 && r.failed === 0)))
          .map(([cat]) => cat);
        progress('global-fix-start', { gameId, maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS, failingCategories: failingCategoryNames, model: GLOBAL_FIX_MODEL });

      // Best-snapshot tracking for the global fix loop: if a later iteration degrades
      // scores, we restore the best HTML before proceeding to review (mirrors per-batch logic).
      let globalBestPassed = totalPassed;
      let globalBestHtml = fs.readFileSync(htmlFile, 'utf-8');

      // Regression guard: track which batches were passing before each global fix was applied,
      // and the HTML at that point. If a previously-passing batch regresses to 0/0 after the
      // global fix, we roll back to preGlobalFixHtml and capture console errors for the next prompt.
      let preGlobalFixHtml = null;
      let previousPassingBatchLabels = new Set();
      let lastGlobalBrokenPageErrors = [];

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
            if (err.stderr) warn(`[pipeline] Playwright stderr: ${err.stderr.slice(0, 500)}`);
            try { rtr = JSON.parse(err.stdout || '{}'); } catch { rtr = {}; }
          }
          const gPassed = rtr?.stats?.expected || 0;
          const gFailed = rtr?.stats?.unexpected || 0;

          if (gPassed === 0 && gFailed === 0) {
            // 0/0: Playwright didn't run any tests — treat as inconclusive (infra/startup
            // issue, resource exhaustion, or spec parse error). Do NOT trigger an HTML fix:
            // the HTML may be fine; the issue is the test runner itself. Keep the score from
            // the per-batch loop for this batch (same approach as detectCrossBatchRegression).
            warn(`[pipeline] [global] [${batchLabel}] 0/0 tests ran — treating as inconclusive, keeping per-batch score`);
          } else if (gFailed === 0 && gPassed > 0) {
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
            // gFailed > 0: real test failures — apply LLM fix.
            const failureDescs = [];
            try { collectFailures(rtr.suites, '', failureDescs); } catch { /* ignore */ }
            const batchTests = batch
              .filter((f) => fs.existsSync(f))
              .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
              .join('\n\n');
            globalFailingBatches.push({ batch, batchLabel, failureDescs, passed: gPassed, failed: gFailed, batchTests });
          }
        }

        // ── Regression guard: detect if global fix broke previously-passing batches ────
        // If a batch was passing before the global fix was applied (tracked in
        // previousPassingBatchLabels) and now returns 0/0, the fix broke the page.
        // Roll back to the pre-fix HTML and capture console errors for the next prompt.
        if (preGlobalFixHtml !== null) {
          const regressedBatches = globalFailingBatches.filter(
            (b) => b.passed === 0 && b.failed === 0 && previousPassingBatchLabels.has(b.batchLabel),
          );
          if (regressedBatches.length > 0) {
            warn(
              `[pipeline] [global] Global fix broke the page (${regressedBatches.length}/${globalFailingBatches.length} batches regressed to 0/0) — rolling back`,
            );
            info(`[pipeline] [global] Capturing browser console errors from broken HTML`);
            lastGlobalBrokenPageErrors = await capturePageConsoleErrors(htmlFile);
            if (lastGlobalBrokenPageErrors.length > 0) {
              info(`[pipeline] [global] Captured ${lastGlobalBrokenPageErrors.length} browser error(s): ${lastGlobalBrokenPageErrors[0].slice(0, 100)}...`);
            } else {
              info(`[pipeline] [global] No browser console errors captured from broken HTML`);
            }
            // Restore the HTML that was in place before the breaking global fix
            fs.writeFileSync(htmlFile, preGlobalFixHtml);
            injectHarnessToFile(htmlFile);
            progress('global-fix-rolled-back', { gameId, globalIter, reason: '0/0-regression', regressedBatches: regressedBatches.map((b) => b.batchLabel) });
            // Don't attempt another fix this iteration — move to next global iteration
            // Reset preGlobalFixHtml so we track from the restored state
            preGlobalFixHtml = null;
            previousPassingBatchLabels = new Set();
            continue;
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

        const globalBrokenPageErrorContext = lastGlobalBrokenPageErrors.length > 0
          ? `\nPREVIOUS GLOBAL FIX BROKE THE PAGE — browser errors captured:\n${lastGlobalBrokenPageErrors.map((e) => `- ${e}`).join('\n')}\nThese errors occurred after the last global fix attempt. Your fix must not cause these errors.\n`
          : '';
        // Consume the errors now that they're included in the prompt
        lastGlobalBrokenPageErrors = [];

        // Use @file_path reference for global fix when: USE_CLAUDE_CLI=1 and GLOBAL_FIX_MODEL is Claude
        const useFileRefGlobal = useClaudeCli && isClaudeModel && isClaudeModel(GLOBAL_FIX_MODEL);
        const globalFixPrompt = buildGlobalFixPrompt({
          globalIter,
          maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS,
          fixLearningsContext: fixLearningsContextStr(),
          globalFailureSummary,
          globalPassingContext,
          additionalPriorContext,
          globalTestFilesBlock,
          currentHtml: useFileRefGlobal ? undefined : currentHtml,
          htmlPath: useFileRefGlobal ? htmlFile : undefined,
          brokenPageErrorContext: globalBrokenPageErrorContext,
        });

        progress('global-fix-prompt', { gameId, globalIter, failingBatches: globalFailingBatches.map((b) => b.batchLabel) });

        let globalFixOutput;
        try {
          if (useFileRefGlobal && trackedClaudeCall) {
            globalFixOutput = await trackedClaudeCall(`global-fix-${globalIter}`, globalFixPrompt, GLOBAL_FIX_MODEL, { cwd: gameDir }, report);
          } else {
            globalFixOutput = await trackedLlmCall(`global-fix-${globalIter}`, globalFixPrompt, GLOBAL_FIX_MODEL, {}, report);
          }
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

        // Save pre-fix state for regression guard on the next iteration
        preGlobalFixHtml = preGlobalFixSnapshot;
        previousPassingBatchLabels = new Set(globalPassingBatches.map((b) => b.batchLabel));

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
      } // end else (suppression check)
    } else {
      info(`[pipeline] Step 3c: No cross-batch failures — skipping global fix loop`);
    }
  }

  // ── Step 3b: Final re-test of ALL batches on final HTML ────────────────────
  const batchesToReTest = batches.filter((batch) => {
    return batch.some((specFile) => fs.existsSync(specFile));
  });

  // Remove fully-deleted batches from the pass/fail totals.
  // When triage deletes all spec files in a batch (skip_tests), the per-batch loop
  // already counted those tests as failures. Step 3b won't re-test deleted batches,
  // so without this correction the passRate at Step 4 would count them as failures,
  // causing passRate < 0.5 and failing the build before review even when all remaining
  // tests pass.
  for (const batch of batches) {
    if (batch.some((f) => fs.existsSync(f))) continue; // has surviving files — will be re-tested
    const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
    const prev = report.category_results[batchLabel] || { passed: 0, failed: 0 };
    if (prev.passed > 0 || prev.failed > 0) {
      info(`[pipeline] [${batchLabel}] All spec files deleted by triage — removing ${prev.failed} skipped test(s) from total count`);
      totalPassed -= prev.passed;
      totalFailed -= prev.failed;
      report.category_results[batchLabel] = { passed: 0, failed: 0 };
    }
  }

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
        if (err.stderr) warn(`[pipeline] Playwright stderr: ${err.stderr.slice(0, 500)}`);
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

  return { totalPassed, totalFailed, deletedSpecBatches };
}

// ─── shouldSuppressGlobalFix ──────────────────────────────────────────────────
// Pure helper that determines whether the global fix loop should be suppressed
// based on the per-category pass rate. Extracted for unit testing.
//
// Returns { suppress: true, passingCategories, totalCategories } when ≥80% of
// non-deleted categories have at least 1 passing test; otherwise { suppress: false }.
//
// Lesson 148: build #531 soh-cah-toa-worked-example — 6/7 categories passed,
// global fix fired, rewrote entire HTML, regressed all categories to 0/11.

/**
 * Determines whether the global fix loop should be suppressed.
 * @param {Object} categoryResults - report.category_results map: { [category]: { passed, failed } }
 * @param {Set<string>} deletedSpecBatches - Set of batch labels whose spec files were deleted by triage
 * @returns {{ suppress: boolean, passingCategories: number, totalCategories: number }}
 */
function shouldSuppressGlobalFix(categoryResults, deletedSpecBatches) {
  const nonDeletedEntries = Object.entries(categoryResults || {})
    .filter(([cat]) => !(deletedSpecBatches || new Set()).has(cat));
  const totalCategories = nonDeletedEntries.length;
  if (totalCategories === 0) return { suppress: false, passingCategories: 0, totalCategories: 0 };
  const passingCategories = nonDeletedEntries.filter(([, r]) => r.passed > 0).length;
  const suppress = passingCategories / totalCategories >= 0.8;
  return { suppress, passingCategories, totalCategories };
}

module.exports = { runFixLoop, collectFailures, deterministicTriage, isInitFailure, detectRenderingMismatch, detectCrossBatchRegression, getMatchingLessons, LESSON_PATTERNS, isCdnTimingFailure, CDN_TIMING_HINT, tokenOverlap, verifyE8MergeIntegrity, shouldSuppressGlobalFix, detectCdnTimingStall };
