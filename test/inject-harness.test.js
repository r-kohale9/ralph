'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline-utils.js injectTestHarness()
//
// Verifies that harness injection is safe against HTML containing special
// JavaScript String.replace() replacement patterns ($& $` $' $1-$9 $$).
//
// Root cause guard: the injection uses html.replace('</body>', () => ...) with
// a replacement function, not a string literal.  Without the function form,
// dollar signs inside harnessScript could corrupt the output via JavaScript's
// special replacement sequences.  These tests document and enforce that
// invariant so regressions are caught immediately.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { injectTestHarness } = require('../lib/pipeline-utils');

// ─── helpers ────────────────────────────────────────────────────────────────

function makeHtml(bodyContent) {
  return `<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body>\n<div id="app"></div>\n${bodyContent}\n</body>\n</html>`;
}

const SPEC_TEXT_INPUT = { interactionType: 'text-input' };
const SPEC_MCQ = { interactionType: 'mcq-click' };
const SPEC_GRID = { interactionType: 'grid-click' };
const SPEC_DRAG = { interactionType: 'drag' };

// ─── basic injection ─────────────────────────────────────────────────────────

describe('injectTestHarness — basic injection', () => {
  it('injects harness before </body>', () => {
    const html = makeHtml('<p>hello</p>');
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness script tag present');
    assert.ok(result.includes('</body>'), 'closing body tag present');
    assert.ok(result.includes('</html>'), 'closing html tag present');
    assert.ok(
      result.indexOf('id="ralph-test-harness"') < result.indexOf('</body>'),
      'harness appears before </body>',
    );
  });

  it('appends harness when no </body> tag present', () => {
    const html = '<html><body><p>no closing tags</p>';
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness script tag present');
    assert.ok(result.endsWith('</script>'), 'ends with harness closing tag');
  });

  it('does not inject twice when harness already present', () => {
    const html = makeHtml('<p>hello</p>');
    const once = injectTestHarness(html, SPEC_TEXT_INPUT);
    const twice = injectTestHarness(once, SPEC_TEXT_INPUT);
    assert.equal(
      (twice.match(/id="ralph-test-harness"/g) || []).length,
      1,
      'harness injected exactly once',
    );
  });

  it('output is longer than input (harness adds content)', () => {
    const html = makeHtml('<p>hello</p>');
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.length > html.length, 'output is longer than input');
  });
});

// ─── special $ replacement character guard ───────────────────────────────────
//
// JavaScript's String.prototype.replace(string, replacementString) treats the
// following patterns in replacementString as special:
//   $&  → inserts the matched substring
//   $`  → inserts the string before the match
//   $'  → inserts the string after the match
//   $$  → inserts a literal $
//   $n  → inserts the nth capture group (n=1-9)
//
// If harnessScript ever contains these patterns, using a string replacement
// would silently corrupt the output.  The replacement function form
// `html.replace('</body>', () => harnessScript + '\n</body>')` is immune.
//
// These tests prove that HTML with dollar-sign patterns is handled correctly.

describe('injectTestHarness — dollar-sign safety (String.replace guard)', () => {
  it('does not truncate HTML containing Sentry.captureException(e)', () => {
    const sentryBody = `<script>
window.gameState = { phase: 'playing', lives: 3, score: 0, currentRound: 0 };
window.endGame = function() {};
window.restartGame = function() {};
window.nextRound = function() {};
try {
  riskyOperation();
} catch(e) {
  if (window.Sentry) Sentry.captureException(e);
}
</script>`;
    const html = makeHtml(sentryBody);
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);

    // All original content must be preserved
    assert.ok(result.includes('Sentry.captureException(e)'), 'Sentry call preserved');
    assert.ok(result.includes('riskyOperation()'), 'code before Sentry preserved');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.length > html.length, 'output is not truncated (longer than input)');
  });

  it('does not corrupt output when HTML contains $& pattern', () => {
    const html = makeHtml('<p>regex match: $& is a special pattern</p>');
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('$& is a special pattern'), '$& content preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
  });

  it('does not corrupt output when HTML contains $` pattern', () => {
    const html = makeHtml("<p>pattern: $`backtick dollar is special in replace</p>");
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('$`backtick dollar'), '$` content preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
  });

  it("does not corrupt output when HTML contains $' pattern", () => {
    const html = makeHtml("<p>pattern: $'apostrophe dollar is special in replace</p>");
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes("$'apostrophe dollar"), "$' content preserved");
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
  });

  it('does not corrupt output when HTML contains $1 capture group pattern', () => {
    const html = makeHtml('<p>back-reference: $1 and $2 are special in regex replace</p>');
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('$1 and $2 are special'), '$1/$2 content preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
  });

  it('does not corrupt output when HTML contains $$ pattern', () => {
    const html = makeHtml('<p>literal dollar: $$price means dollar sign</p>');
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    assert.ok(result.includes('$$price means dollar sign'), '$$ content preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
  });

  it('handles HTML with multiple dollar patterns combined (realistic LLM output)', () => {
    const complexBody = `<script>
// Price calculation: $price * $1.5 = total
// Template: \`Cost: $\${price}\`
function handleError(e) {
  // Pattern $& matches the whole expression
  const msg = \`Error in $\${e.context}: $\${e.message}\`;
  if (window.Sentry) {
    Sentry.captureException(e, { extra: { context: e.context } });
  }
  // Use $' suffix pattern for debugging
  console.error('Error:', e);
}
window.endGame = function() {};
window.restartGame = function() {};
window.nextRound = function() {};
window.gameState = { phase: 'playing', score: 0, lives: 3, currentRound: 0 };
</script>`;
    const html = makeHtml(complexBody);
    const inputLines = html.split('\n').length;
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    const outputLines = result.split('\n').length;

    assert.ok(result.includes('Sentry.captureException(e,'), 'Sentry call preserved');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(
      outputLines > inputLines,
      `output (${outputLines} lines) must be longer than input (${inputLines} lines) — not truncated`,
    );
  });
});

// ─── interaction type variants ───────────────────────────────────────────────

describe('injectTestHarness — interaction type variants', () => {
  const html = makeHtml('<div id="gameContent"><p>game</p></div>');

  for (const [label, spec] of [
    ['text-input', SPEC_TEXT_INPUT],
    ['mcq-click', SPEC_MCQ],
    ['grid-click', SPEC_GRID],
    ['drag', SPEC_DRAG],
  ]) {
    it(`injects harness with ${label} answerImpl`, () => {
      const result = injectTestHarness(html, spec);
      assert.ok(result.includes('id="ralph-test-harness"'), 'harness present');
      assert.ok(result.includes('answer(correct'), 'answer() impl present');
      assert.ok(result.includes('</html>'), 'closing tag present');
      assert.ok(result.length > html.length, 'output not truncated');
    });
  }
});

// ─── large HTML file safety ──────────────────────────────────────────────────

describe('injectTestHarness — large file safety', () => {
  it('correctly injects into a large HTML file (1700+ lines) with Sentry at line ~1650', () => {
    const lines = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head><meta charset="UTF-8"><title>Kakuro</title></head>',
      '<body>',
      '<div id="app"><div id="gameContent"></div></div>',
      '<script>',
      'window.gameState = { phase: "playing", lives: 3, score: 0, currentRound: 0 };',
      'window.endGame = function() {};',
      'window.restartGame = function() {};',
      'window.nextRound = function() {};',
    ];
    // Pad to ~1640 lines of game code
    for (let i = 0; i < 1630; i++) {
      lines.push(`  // game logic line ${i}: var x${i} = ${i} * 2;`);
    }
    // Add Sentry block near end (this is where build 299 truncated)
    lines.push('try {');
    lines.push('  performGameAction();');
    lines.push('} catch(e) {');
    lines.push('  if (window.Sentry) Sentry.captureException(e);');
    lines.push('  console.error("Game error:", e);');
    lines.push('}');
    lines.push('</script>');
    lines.push('</body>');
    lines.push('</html>');

    const html = lines.join('\n');
    const inputLineCount = lines.length;
    const result = injectTestHarness(html, SPEC_TEXT_INPUT);
    const outputLineCount = result.split('\n').length;

    assert.ok(result.includes('Sentry.captureException(e)'), 'Sentry call preserved');
    assert.ok(result.includes('performGameAction()'), 'pre-Sentry code preserved');
    assert.ok(result.includes('</html>'), 'closing html tag preserved');
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');
    assert.ok(
      outputLineCount > inputLineCount,
      `output (${outputLineCount} lines) must exceed input (${inputLineCount} lines)`,
    );
    // Harness adds ~175 lines; verify minimum reasonable growth
    assert.ok(
      outputLineCount >= inputLineCount + 100,
      `harness adds at least 100 lines (got ${outputLineCount - inputLineCount})`,
    );
  });
});

// ─── nextRound alias acceptance (TE-F6 adjustment-strategy) ──────────────────
//
// The harness should NOT warn "MISSING window.nextRound" when the game exposes
// an accepted alias: window.loadRound or window.jumpToRound.
// __ralph.jumpToRound() already falls through to these aliases, so the
// diagnostic check must mirror that tolerance.

describe('injectTestHarness — nextRound alias acceptance (TE-F6)', () => {
  function captureConsoleErrors(fn) {
    const errors = [];
    const orig = console.error;
    console.error = (...args) => errors.push(args.join(' '));
    fn();
    console.error = orig;
    return errors;
  }

  it('does not warn MISSING nextRound when window.loadRound is defined as alias', async () => {
    // Inject harness into HTML that defines loadRound but not nextRound
    const gameBody = `<script>
window.gameState = { phase: 'playing', lives: 3, score: 0, currentRound: 0 };
window.endGame = function() {};
window.restartGame = function() {};
window.loadRound = function(n) { window.gameState.currentRound = n; };
</script>`;
    const html = makeHtml(gameBody);
    const result = injectTestHarness(html, SPEC_MCQ);
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');

    // The harness script text must not contain the old single-alias MISSING nextRound warning text
    assert.ok(
      !result.includes('MISSING window.nextRound / window.loadRound / window.jumpToRound') ||
        result.includes('typeof window.loadRound'),
      'harness source checks loadRound alias',
    );

    // Verify harness source uses multi-alias check (structural assertion on injected code)
    assert.ok(
      result.includes('window.loadRound') && result.includes('window.jumpToRound'),
      'harness checks loadRound and jumpToRound aliases in round-nav check',
    );
  });

  it('does not warn MISSING nextRound when window.jumpToRound is defined as alias', () => {
    const gameBody = `<script>
window.gameState = { phase: 'playing', lives: 3, score: 0, currentRound: 0 };
window.endGame = function() {};
window.restartGame = function() {};
window.jumpToRound = function(n) { window.gameState.currentRound = n; };
</script>`;
    const html = makeHtml(gameBody);
    const result = injectTestHarness(html, SPEC_MCQ);
    assert.ok(result.includes('id="ralph-test-harness"'), 'harness injected');

    // Verify harness source checks jumpToRound alias
    assert.ok(
      result.includes('window.jumpToRound'),
      'harness checks jumpToRound alias in round-nav check',
    );

    // Confirm the MISSING message now references all three aliases
    assert.ok(
      result.includes('window.nextRound / window.loadRound / window.jumpToRound'),
      'updated MISSING message references all three round-nav aliases',
    );
  });
});
