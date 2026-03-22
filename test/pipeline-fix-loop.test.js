'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline-fix-loop.js helper functions
//
// Covers: isCdnTimingFailure, tokenOverlap, CDN_TIMING_HINT
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
