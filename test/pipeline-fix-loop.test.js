'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline-fix-loop.js helper functions
//
// Covers: isCdnTimingFailure, tokenOverlap, CDN_TIMING_HINT, detectCdnTimingStall
// No LLM calls, no filesystem access — pure unit tests.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isCdnTimingFailure,
  CDN_TIMING_HINT,
  tokenOverlap,
  deterministicTriage,
  detectRenderingMismatch,
  isInitFailure,
  getMatchingLessons,
  LESSON_PATTERNS,
  verifyE8MergeIntegrity,
  shouldSuppressGlobalFix,
  detectCdnTimingStall,
} = require('../lib/pipeline-fix-loop');

// ─── Sample HTML fixtures ────────────────────────────────────────────────────

const CDN_HTML = `<!DOCTYPE html>
<html>
<head><title>CDN Game</title></head>
<body>
<div id="app"></div>
<script>
async function waitForPackages() {
  const start = Date.now();
  while (typeof ScreenLayout === 'undefined') {
    if (Date.now() - start >= 120000) throw new Error('Packages failed to load within 120s');
    await new Promise(r => setTimeout(r, 200));
  }
}
</script>
</body>
</html>`;

const PLAIN_HTML = `<!DOCTYPE html>
<html>
<head><title>Simple Game</title></head>
<body>
<div id="app"></div>
<script>
// No CDN dependency — pure vanilla JS game
function startGame() {}
</script>
</body>
</html>`;

// ─── tokenOverlap tests ──────────────────────────────────────────────────────

describe('tokenOverlap', () => {
  it('returns 1.0 for identical strings', () => {
    const s = 'start button never appears timeout exceeded waiting';
    assert.equal(tokenOverlap(s, s), 1.0);
  });

  it('returns 0 for completely different strings', () => {
    const a = 'star calculation wrong incorrect value';
    const b = 'lives counter purple elephant banana';
    const sim = tokenOverlap(a, b);
    assert.ok(sim < 0.1, `Expected near-zero similarity, got ${sim}`);
  });

  it('returns high similarity for near-identical strings', () => {
    const a = '[game-flow.spec.js] start button never appears — locator.click: Timeout 30000ms exceeded';
    const b = '[game-flow.spec.js] start button never appears — locator.click: Timeout 30000ms exceeded waiting for element';
    const sim = tokenOverlap(a, b);
    assert.ok(sim >= 0.7, `Expected similarity >= 0.7, got ${sim}`);
  });

  it('handles empty strings', () => {
    assert.equal(tokenOverlap('', ''), 1);
    assert.equal(tokenOverlap('hello world', ''), 0);
    assert.equal(tokenOverlap('', 'hello world'), 0);
  });

  it('returns moderate similarity for related but different CDN errors', () => {
    const a = 'start button never appears — locator.click: Timeout 30000ms exceeded';
    const b = 'start button never appears — TimeoutError waiting for element to be visible';
    const sim = tokenOverlap(a, b);
    // Both contain "start button never appears" tokens — should have some similarity
    // (exact ratio depends on unique tokens; threshold kept loose at 0.20)
    assert.ok(sim >= 0.20, `Expected similarity >= 0.20, got ${sim}`);
  });
});

// ─── isCdnTimingFailure tests ─────────────────────────────────────────────────

describe('isCdnTimingFailure', () => {
  it('returns false for empty errors array', () => {
    assert.equal(isCdnTimingFailure([], CDN_HTML), false);
  });

  it('returns false when html has no waitForPackages', () => {
    const errors = [
      'start button never appears — locator.click: Timeout 30000ms exceeded',
    ];
    assert.equal(isCdnTimingFailure(errors, PLAIN_HTML), false);
  });

  it('returns false when html is empty string', () => {
    const errors = ['locator.click: Timeout 30000ms exceeded'];
    assert.equal(isCdnTimingFailure(errors, ''), false);
  });

  it('returns false when errors do not match CDN timing patterns', () => {
    const errors = [
      'calcStars returned 1 instead of 0 for game_over outcome',
      'gameState.stars incorrect value expected 2 received 0',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), false);
  });

  it('returns true for single timing error with CDN html', () => {
    const errors = [
      'start button never appears — locator.click: Timeout 30000ms exceeded',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns true for "first UI element never appears" pattern', () => {
    const errors = [
      'first UI element never appears — TimeoutError waiting for element to become visible',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns true for toBeVisible timeout pattern', () => {
    const errors = [
      '[game-flow.spec.js] game loads start screen — Error: expect(locator).toBeVisible: Timeout 30000ms exceeded',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns true for "Timeout exceeded waiting" pattern', () => {
    const errors = [
      'Timeout 30000ms exceeded waiting for element to be visible',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns true for "waiting for ... to be visible" pattern', () => {
    const errors = [
      'locator waiting for #start-button to be visible — timeout 30000ms',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns true for 2 similar CDN timing errors (happy path for early-exit)', () => {
    const errors = [
      '[game-flow.spec.js] start button never appears — locator.click: Timeout 30000ms exceeded',
      '[game-flow.spec.js] start button never appears — locator.click: Timeout 30000ms exceeded after retry',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('returns false for 2 errors where second does NOT match timing pattern', () => {
    const errors = [
      'start button never appears — locator.click: Timeout 30000ms exceeded',
      'calcStars returned 1 instead of 0 — assertion failed',
    ];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), false);
  });

  it('returns false for 2 dissimilar CDN timing errors (different failures — fixes may be working)', () => {
    // Two timing errors but with very different tokens — likely different failures
    const errors = [
      'start button never appears — locator.click: Timeout 30000ms exceeded',
      'level transition banner zebra purple unicorn completely unrelated error banana',
    ];
    // Even if the second doesn't match timing patterns, the first check (allMatchTiming) will catch it
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), false);
  });

  it('returns true for 3 identical CDN timing errors across iterations', () => {
    const err = '[game-flow.spec.js] game initializes — TimeoutError: waiting for locator("#start-btn") to be visible';
    const errors = [err, err, err];
    assert.equal(isCdnTimingFailure(errors, CDN_HTML), true);
  });

  it('CDN_TIMING_HINT mentions key guidance', () => {
    assert.ok(CDN_TIMING_HINT.includes('CDN timing failure'), 'hint should mention CDN timing failure');
    assert.ok(CDN_TIMING_HINT.includes('waitForPackages'), 'hint should mention waitForPackages');
    assert.ok(CDN_TIMING_HINT.includes('timeout'), 'hint should mention timeout');
  });
});

// ─── deterministicTriage tests ───────────────────────────────────────────────

describe('deterministicTriage', () => {
  it('returns null for empty failures', () => {
    assert.equal(deterministicTriage([]), null);
  });

  it('returns fix_html when all failures have window.__ralph not defined', () => {
    const failures = [
      'Cannot read properties of undefined (reading __ralph) — harness missing',
      'window.__ralph is not defined',
    ];
    assert.equal(deterministicTriage(failures), 'fix_html');
  });

  it('returns skip_tests when all failures are visibilityState redefinition', () => {
    const failures = [
      'Cannot redefine property: visibilityState',
      'Cannot redefine property: visibilityState',
    ];
    assert.equal(deterministicTriage(failures), 'skip_tests');
  });

  it('returns null for mixed failures', () => {
    const failures = [
      'window.__ralph is not defined',
      'calcStars returned wrong value',
    ];
    assert.equal(deterministicTriage(failures), null);
  });
});

// ─── detectRenderingMismatch tests ──────────────────────────────────────────

describe('detectRenderingMismatch', () => {
  it('returns false for empty array', () => {
    assert.equal(detectRenderingMismatch([]), false);
  });

  it('returns true when >3 failures contain toBeVisible', () => {
    const failures = [
      'expect(locator).toBeVisible — element not visible',
      'expect(locator).toBeVisible — element not visible',
      'expect(locator).toBeVisible — element not visible',
      'expect(locator).toBeVisible — element not visible',
    ];
    assert.equal(detectRenderingMismatch(failures), true);
  });

  it('returns false when only 3 failures contain toBeVisible', () => {
    const failures = [
      'expect(locator).toBeVisible — element not visible',
      'expect(locator).toBeVisible — element not visible',
      'expect(locator).toBeVisible — element not visible',
    ];
    assert.equal(detectRenderingMismatch(failures), false);
  });

  it('returns false for non-visibility failures', () => {
    const failures = [
      'calcStars wrong value',
      'game_over phase not set',
    ];
    assert.equal(detectRenderingMismatch(failures), false);
  });
});

// ─── isInitFailure tests ─────────────────────────────────────────────────────

describe('isInitFailure', () => {
  it('returns false when passed > 0', () => {
    assert.equal(isInitFailure(['gameState is not defined'], 1), false);
  });

  it('returns false when no failures', () => {
    assert.equal(isInitFailure([], 0), false);
  });

  it('returns true for gameState undefined failure with 0 passed', () => {
    assert.equal(isInitFailure(['gameState is not defined — ReferenceError'], 0), true);
  });

  it('returns true for waitForPhase timeout with 0 passed', () => {
    assert.equal(isInitFailure(['waitForPhase timeout exceeded 30000ms'], 0), true);
  });

  it('returns false for non-init failures with 0 passed', () => {
    assert.equal(isInitFailure(['calcStars returned 1 instead of 0'], 0), false);
  });
});

// ─── getMatchingLessons tests ─────────────────────────────────────────────────

describe('getMatchingLessons', () => {
  it('returns empty array for empty text', () => {
    assert.deepEqual(getMatchingLessons(''), []);
  });

  it('returns lesson for FeedbackManager.sound pattern', () => {
    const lessons = getMatchingLessons('FeedbackManager.sound.playDynamicFeedback is not a function');
    assert.ok(lessons.length > 0, 'should match FeedbackManager lesson');
    assert.ok(lessons[0].includes('Lesson 115'), 'should reference Lesson 115');
  });

  it('returns lesson for window.gameState pattern', () => {
    const lessons = getMatchingLessons('window.gameState undefined syncDOMState data-phase never set');
    assert.ok(lessons.length > 0, 'should match gameState lesson');
  });

  it('returns at most MAX_LESSON_HINTS lessons', () => {
    // Use a text that matches many patterns
    const text = 'FeedbackManager.sound isProcessing TransitionScreen window.gameState waitForPhase timeout cdn.mathai.ai';
    const lessons = getMatchingLessons(text);
    assert.ok(lessons.length <= 3, `Expected at most 3 lessons, got ${lessons.length}`);
  });

  it('LESSON_PATTERNS is an array', () => {
    assert.ok(Array.isArray(LESSON_PATTERNS));
    assert.ok(LESSON_PATTERNS.length > 0);
  });
});

// ─── verifyE8MergeIntegrity tests ────────────────────────────────────────────

const CDN_SCRIPT_A = 'https://cdn.mathai.ai/packages/screen-layout@2.0.0/dist/index.js';
const CDN_SCRIPT_B = 'https://cdn.mathai.ai/packages/feedback-manager@1.0.0/dist/index.js';

const ORIGINAL_HTML_WITH_CDNS = `<!DOCTYPE html>
<html>
<head>
  <script src="${CDN_SCRIPT_A}"></script>
  <script src="${CDN_SCRIPT_B}"></script>
</head>
<body>
<div id="gameContent"></div>
<script>
function startGame() {}
window.gameState = {};
</script>
</body>
</html>`;

describe('verifyE8MergeIntegrity', () => {
  it('returns valid when merged HTML has the same CDN scripts', () => {
    // Merged HTML retains both CDN src tags and has a new script block
    const mergedHtml = `<!DOCTYPE html>
<html>
<head>
  <script src="${CDN_SCRIPT_A}"></script>
  <script src="${CDN_SCRIPT_B}"></script>
</head>
<body>
<div id="gameContent"></div>
<script>
function startGame() { console.log('fixed'); }
window.gameState = { phase: 'start' };
</script>
</body>
</html>`;

    const result = verifyE8MergeIntegrity(ORIGINAL_HTML_WITH_CDNS, mergedHtml);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingScripts, []);
    assert.equal(result.originalCount, 2);
    assert.equal(result.mergedCount, 2);
  });

  it('returns invalid when merged HTML is missing one CDN script', () => {
    // LLM dropped CDN_SCRIPT_B during the merge
    const mergedHtml = `<!DOCTYPE html>
<html>
<head>
  <script src="${CDN_SCRIPT_A}"></script>
</head>
<body>
<div id="gameContent"></div>
<script>
function startGame() {}
window.gameState = {};
</script>
</body>
</html>`;

    const result = verifyE8MergeIntegrity(ORIGINAL_HTML_WITH_CDNS, mergedHtml);
    assert.equal(result.valid, false);
    assert.equal(result.missingScripts.length, 1);
    assert.equal(result.missingScripts[0], CDN_SCRIPT_B);
    assert.equal(result.originalCount, 2);
    assert.equal(result.mergedCount, 1);
  });

  it('returns valid when merged HTML has extra CDN scripts beyond the original', () => {
    const EXTRA_CDN = 'https://cdn.mathai.ai/packages/extra-lib@1.0.0/dist/index.js';
    const mergedHtml = `<!DOCTYPE html>
<html>
<head>
  <script src="${CDN_SCRIPT_A}"></script>
  <script src="${CDN_SCRIPT_B}"></script>
  <script src="${EXTRA_CDN}"></script>
</head>
<body>
<div id="gameContent"></div>
<script>
function startGame() {}
window.gameState = {};
</script>
</body>
</html>`;

    const result = verifyE8MergeIntegrity(ORIGINAL_HTML_WITH_CDNS, mergedHtml);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingScripts, []);
    assert.equal(result.originalCount, 2);
    assert.equal(result.mergedCount, 3);
  });

  it('returns invalid when mergedHtml is empty', () => {
    const result = verifyE8MergeIntegrity(ORIGINAL_HTML_WITH_CDNS, '');
    assert.equal(result.valid, false);
    assert.equal(result.missingScripts.length, 2);
    assert.equal(result.originalCount, 2);
    assert.equal(result.mergedCount, 0);
  });

  it('returns valid when original has no CDN src scripts and merged has none', () => {
    const result = verifyE8MergeIntegrity(PLAIN_HTML, PLAIN_HTML);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingScripts, []);
    assert.equal(result.originalCount, 0);
    assert.equal(result.mergedCount, 0);
  });
});

// ─── shouldSuppressGlobalFix tests ───────────────────────────────────────────

describe('shouldSuppressGlobalFix', () => {
  it('skips global fix when ≥80% of categories have passing tests (6/7 = 86%)', () => {
    const categoryResults = {
      'game-flow': { passed: 3, failed: 0 },
      'contract': { passed: 2, failed: 0 },
      'scoring': { passed: 1, failed: 0 },
      'lives': { passed: 2, failed: 0 },
      'accessibility': { passed: 1, failed: 0 },
      'edge-cases': { passed: 1, failed: 0 },
      'timing': { passed: 0, failed: 2 },
    };
    const result = shouldSuppressGlobalFix(categoryResults, new Set());
    assert.equal(result.suppress, true);
    assert.equal(result.passingCategories, 6);
    assert.equal(result.totalCategories, 7);
  });

  it('runs global fix when <80% of categories have passing tests (3/5 = 60%)', () => {
    const categoryResults = {
      'game-flow': { passed: 3, failed: 0 },
      'contract': { passed: 2, failed: 0 },
      'scoring': { passed: 1, failed: 0 },
      'lives': { passed: 0, failed: 3 },
      'timing': { passed: 0, failed: 2 },
    };
    const result = shouldSuppressGlobalFix(categoryResults, new Set());
    assert.equal(result.suppress, false);
    assert.equal(result.passingCategories, 3);
    assert.equal(result.totalCategories, 5);
  });

  it('skips global fix at exactly 80% boundary (4/5 categories)', () => {
    const categoryResults = {
      'game-flow': { passed: 3, failed: 0 },
      'contract': { passed: 2, failed: 0 },
      'scoring': { passed: 1, failed: 0 },
      'lives': { passed: 1, failed: 0 },
      'timing': { passed: 0, failed: 2 },
    };
    const result = shouldSuppressGlobalFix(categoryResults, new Set());
    assert.equal(result.suppress, true);
    assert.equal(result.passingCategories, 4);
    assert.equal(result.totalCategories, 5);
  });

  it('runs global fix at 75% (3/4 categories — below 80% threshold)', () => {
    const categoryResults = {
      'game-flow': { passed: 3, failed: 0 },
      'contract': { passed: 2, failed: 0 },
      'scoring': { passed: 1, failed: 0 },
      'lives': { passed: 0, failed: 3 },
    };
    const result = shouldSuppressGlobalFix(categoryResults, new Set());
    assert.equal(result.suppress, false);
    assert.equal(result.passingCategories, 3);
    assert.equal(result.totalCategories, 4);
  });

  it('excludes deleted spec batches from the calculation', () => {
    // 'timing' is deleted — only 4 categories count; 4/4 = 100% passing
    const categoryResults = {
      'game-flow': { passed: 3, failed: 0 },
      'contract': { passed: 2, failed: 0 },
      'scoring': { passed: 1, failed: 0 },
      'lives': { passed: 1, failed: 0 },
      'timing': { passed: 0, failed: 0 },
    };
    const deleted = new Set(['timing']);
    const result = shouldSuppressGlobalFix(categoryResults, deleted);
    assert.equal(result.suppress, true);
    assert.equal(result.passingCategories, 4);
    assert.equal(result.totalCategories, 4);
  });

  it('returns suppress=false when categoryResults is empty', () => {
    const result = shouldSuppressGlobalFix({}, new Set());
    assert.equal(result.suppress, false);
    assert.equal(result.totalCategories, 0);
  });

  it('returns suppress=false when all categories have 0 passing tests', () => {
    const categoryResults = {
      'game-flow': { passed: 0, failed: 5 },
      'contract': { passed: 0, failed: 3 },
    };
    const result = shouldSuppressGlobalFix(categoryResults, new Set());
    assert.equal(result.suppress, false);
    assert.equal(result.passingCategories, 0);
    assert.equal(result.totalCategories, 2);
  });
});

// ─── detectCdnTimingStall tests ──────────────────────────────────────────────

// Shared CDN timing failure objects used across tests
const CDN_STALL_FAILURE_A = {
  testName: '[game-flow.spec.js] game loads start screen',
  error: 'locator.click: Timeout 30000ms exceeded',
  errorMessage: 'start button never appears — locator.click: Timeout 30000ms exceeded',
};
const CDN_STALL_FAILURE_B = {
  testName: '[game-flow.spec.js] game initializes correctly',
  error: 'TimeoutError: waiting for element to be visible',
  errorMessage: 'start button never appears — TimeoutError: waiting for element to become visible',
};
const NON_CDN_FAILURE = {
  testName: '[scoring.spec.js] calcStars returns correct stars',
  error: 'Expected 2 received 0',
  errorMessage: 'calcStars returned 0 instead of 2 for game_over outcome',
};

describe('detectCdnTimingStall', () => {
  it('returns false when failures array is empty', () => {
    assert.equal(detectCdnTimingStall([], [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B]), false);
  });

  it('returns false when failures has only 1 item (could be coincidence)', () => {
    assert.equal(detectCdnTimingStall([CDN_STALL_FAILURE_A], [CDN_STALL_FAILURE_A]), false);
  });

  it('returns false when prevFailures is null (first iteration — no prior data)', () => {
    assert.equal(detectCdnTimingStall([CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B], null), false);
  });

  it('returns false when prevFailures is empty array (no prior data)', () => {
    assert.equal(detectCdnTimingStall([CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B], []), false);
  });

  it('returns true when identical CDN timing errors appear across 2 iterations (happy path)', () => {
    const failures = [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B];
    const prevFailures = [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('returns true for "packages failed to load" pattern across iterations', () => {
    const failures = [
      { error: 'Packages failed to load within 120s', errorMessage: 'CDN packages failed to load — timeout exceeded' },
      { error: 'Packages failed to load within 120s', errorMessage: 'CDN packages failed to load — timeout exceeded' },
    ];
    const prevFailures = [
      { error: 'Packages failed to load within 120s', errorMessage: 'CDN packages failed to load — timeout exceeded' },
      { error: 'Packages failed to load within 120s', errorMessage: 'CDN packages failed to load — timeout exceeded' },
    ];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('returns true for "cdn-timing-early-exit" pattern across iterations', () => {
    const failures = [
      { error: 'cdn-timing-early-exit', errorMessage: 'CDN slot cdn-timing-early-exit mathai-slot never appeared' },
      { error: 'cdn-timing-early-exit', errorMessage: 'CDN slot cdn-timing-early-exit mathai-slot never appeared' },
    ];
    const prevFailures = [
      { error: 'cdn-timing-early-exit', errorMessage: 'CDN slot cdn-timing-early-exit mathai-slot never appeared' },
      { error: 'cdn-timing-early-exit', errorMessage: 'CDN slot cdn-timing-early-exit mathai-slot never appeared' },
    ];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('returns true for "waitForPackages timeout" pattern across iterations', () => {
    const failures = [
      { error: 'waitForPackages timeout exceeded', errorMessage: 'waitForPackages timeout: CDN took too long' },
      { error: 'waitForPackages timeout exceeded', errorMessage: 'waitForPackages timeout: CDN took too long' },
    ];
    const prevFailures = [
      { error: 'waitForPackages timeout exceeded', errorMessage: 'waitForPackages timeout: CDN took too long' },
      { error: 'waitForPackages timeout exceeded', errorMessage: 'waitForPackages timeout: CDN took too long' },
    ];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('returns false when current errors are NOT CDN timing patterns (HTML bug being fixed)', () => {
    const failures = [NON_CDN_FAILURE, { ...NON_CDN_FAILURE, testName: '[scoring.spec.js] test 2', errorMessage: 'lives counter decremented wrong value' }];
    const prevFailures = [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B];
    assert.equal(detectCdnTimingStall(failures, prevFailures), false);
  });

  it('returns false when errors differ across iterations (HTML bug being fixed — fixes are working)', () => {
    // Different errors suggest the fix loop IS making progress — do not break early
    const failures = [
      CDN_STALL_FAILURE_A,
      { testName: '[game-flow.spec.js] round 2', error: 'stars calculation wrong', errorMessage: 'calcStars returned 1 expected 2' },
    ];
    const prevFailures = [
      CDN_STALL_FAILURE_A,
      CDN_STALL_FAILURE_B,
    ];
    // One failure matches CDN pattern but the other is a scoring error — allMatchTiming = false
    assert.equal(detectCdnTimingStall(failures, prevFailures), false);
  });

  it('returns false when CDN errors match pattern but previous iteration had different errors (no stall — iter 1 was different)', () => {
    const failures = [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B];
    const prevFailures = [
      { error: 'stars calculation wrong', errorMessage: 'calcStars returned 0 expected 2 — completely different error' },
      { error: 'lives counter banana purple elephant unrelated', errorMessage: 'unrelated failure not matching CDN' },
    ];
    // CDN patterns match current, but token similarity vs prev is too low
    assert.equal(detectCdnTimingStall(failures, prevFailures), false);
  });

  it('returns true for near-identical CDN errors (slight wording variation still >75% similar)', () => {
    const failures = [
      { error: 'locator.click: Timeout 30000ms exceeded waiting for start button', errorMessage: 'start button never appears — locator.click: Timeout 30000ms exceeded waiting for element to be visible' },
      { error: 'TimeoutError: waiting for start button to be visible', errorMessage: 'start button never appears — TimeoutError: waiting for element to become visible timeout 30000ms' },
    ];
    const prevFailures = [
      { error: 'locator.click: Timeout 30000ms exceeded waiting for start button', errorMessage: 'start button never appears — locator.click: Timeout 30000ms exceeded waiting for element to be visible' },
      { error: 'TimeoutError: waiting for start button to be visible', errorMessage: 'start button never appears — TimeoutError: waiting for element to become visible timeout 30000ms' },
    ];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('works with failure objects that only have testName (no error/errorMessage fields)', () => {
    const failures = [
      { testName: 'start button never appears Timeout 30000ms exceeded' },
      { testName: 'game loads start screen Timeout 30000ms exceeded waiting for element' },
    ];
    const prevFailures = [
      { testName: 'start button never appears Timeout 30000ms exceeded' },
      { testName: 'game loads start screen Timeout 30000ms exceeded waiting for element' },
    ];
    assert.equal(detectCdnTimingStall(failures, prevFailures), true);
  });

  it('returns false for undefined failures input', () => {
    assert.equal(detectCdnTimingStall(undefined, [CDN_STALL_FAILURE_A, CDN_STALL_FAILURE_B]), false);
  });
});
