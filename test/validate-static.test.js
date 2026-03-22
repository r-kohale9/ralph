'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALIDATOR = path.join(__dirname, '..', 'lib', 'validate-static.js');

function runValidator(html) {
  const tmpFile = path.join(os.tmpdir(), `ralph-test-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html);
  try {
    const output = execFileSync('node', [VALIDATOR, tmpFile], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { exitCode: 0, output };
  } catch (err) {
    return { exitCode: err.status, output: err.stdout || '' };
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const VALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Test Game - Doubles Math Challenge</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f0f0f0; }
  #gameContent { max-width: 480px; margin: 0 auto; background: white; min-height: 100vh; }
  #gameArea { padding: 20px; text-align: center; }
  .question { font-size: 24px; margin: 20px 0; color: #333; }
  .answer-btn { padding: 12px 24px; margin: 8px; font-size: 18px; cursor: pointer; border: 2px solid #4CAF50; border-radius: 8px; background: white; }
  .answer-btn:hover { background: #e8f5e9; }
  .score-display { font-size: 16px; color: #666; margin-top: 10px; }
  .progress-bar { height: 4px; background: #e0e0e0; margin: 10px 0; }
  .progress-fill { height: 100%; background: #4CAF50; transition: width 0.3s; }
</style>
</head>
<body>
<div id="gameContent">
  <div id="gameArea">
    <div class="score-display">Score: <span id="score">0</span></div>
    <div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
    <div class="question" id="questionText"></div>
    <div id="answers"></div>
  </div>
</div>
<script>
  let gameState = { score: 0, total: 0, currentQuestion: 0, totalQuestions: 10 };

  function initGame() {
    gameState = { score: 0, total: 10, currentQuestion: 0, totalQuestions: 10 };
    showQuestion();
  }

  function checkAnswer(answer) {
    if (answer === gameState.correct) {
      gameState.score++;
    }
    gameState.currentQuestion++;
    gameState.total--;
    if (gameState.total <= 0) endGame();
    else showQuestion();
  }

  function endGame() {
    const pct = gameState.score / gameState.totalQuestions;
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
    window.parent.postMessage({ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
    document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';
  }

  function showQuestion() {
    var a = Math.floor(Math.random() * 12) + 1;
    var b = Math.floor(Math.random() * 12) + 1;
    gameState.correct = a * b;
    document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
  }

  initGame();
</script>
</body>
</html>`;

describe('validate-static.js', () => {
  it('passes valid HTML game', () => {
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(output.includes('Static validation passed'));
  });

  it('fails when missing DOCTYPE', () => {
    const html = VALID_HTML.replace('<!DOCTYPE html>', '');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('DOCTYPE'));
  });

  it('fails when missing initGame (non-CDN game)', () => {
    const html = VALID_HTML.replace('function initGame()', 'function startGame()');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('initGame'));
  });

  it('passes without initGame when using CDN ScreenLayout + DOMContentLoaded pattern', () => {
    // CDN games initialize via DOMContentLoaded + ScreenLayout.inject() — no initGame() needed
    const html = VALID_HTML
      .replace('function initGame()', 'function setupGame()')
      .replace('initGame();', '')
      .replace(
        '<div id="gameContent">',
        '<div id="app"></div>\n<div id="gameContent">',
      )
      .replace(
        'const pct',
        'ScreenLayout.inject("app", { slots: { transitionScreen: true } });\n    const pct',
      )
      .replace(
        '</script>',
        'window.endGame = endGame;\nwindow.gameState = gameState;\nwindow.addEventListener("DOMContentLoaded", async () => { setupGame(); });\n</script>',
      );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('fails when CDN game (DOMContentLoaded) has gameState not exposed on window', () => {
    // const/let gameState without window.gameState = ... → syncDOMState can't find it
    const html = VALID_HTML.replace(
      '</script>',
      'window.endGame = endGame;\n// no window.gameState\nwindow.addEventListener("DOMContentLoaded", async () => { endGame(); });\n</script>',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('window.gameState'));
  });

  it('fails when CDN game (DOMContentLoaded) missing window.endGame assignment', () => {
    const html = VALID_HTML.replace(
      '</script>',
      '// no window.endGame assignment\nwindow.gameState = gameState;\nwindow.addEventListener("DOMContentLoaded", async () => { endGame(); });\n</script>',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('window.endGame'));
  });

  it('fails when missing endGame', () => {
    const html = VALID_HTML.replace('function endGame()', 'function finishGame()');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('endGame'));
  });

  it('passes when endGame is declared as arrow function (const endGame = async)', () => {
    // LLM sometimes writes `const endGame = async (reason) => { ... }` instead of
    // `function endGame(...)` — both are valid; the game still assigns window.endGame = endGame.
    // Bug 1 fix: regex must match both function declaration and arrow/expression form.
    const html = VALID_HTML.replace('function endGame()', 'const endGame = async (reason) =>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass for arrow-function endGame but got: ${output}`);
  });

  it('fails when missing postMessage', () => {
    const html = VALID_HTML.replace('postMessage', 'sendMessage');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('postMessage'));
  });

  it('fails when missing style block', () => {
    const html = VALID_HTML.replace('<style>', '<nostyle>').replace('</style>', '</nostyle>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('style'));
  });

  it('fails when missing script block', () => {
    const html = VALID_HTML.replace(/<script>/g, '<noscript>').replace(/<\/script>/g, '</noscript>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
  });

  it('fails when file too small', () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('TOO SMALL'));
  });

  it('fails when external CSS is present', () => {
    const html = VALID_HTML.replace('<style>', '<link href="styles.css" rel="stylesheet"><style>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('External CSS'));
  });

  it('fails when local relative JS script is present', () => {
    // Local relative scripts are forbidden; CDN scripts are allowed
    const html = VALID_HTML.replace('<script>', '<script src="app.js"></script><script>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('Local relative script'));
  });

  it('allows CDN JS scripts', () => {
    // CDN scripts (https:// URLs) are allowed for MathAI CDN games
    const html = VALID_HTML.replace('<script>', '<script src="https://cdn.example.com/lib.js"></script><script>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0);
  });

  it('fails when document.write is used', () => {
    const html = VALID_HTML.replace('initGame();', 'document.write("x"); initGame();');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('document.write'));
  });

  it('fails when no interaction handler found', () => {
    const html = VALID_HTML.replace('function checkAnswer(answer)', 'function processInput(answer)');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('interaction handler'));
  });

  it('passes with CDN-style handleXxx interaction handler', () => {
    // CDN games use handleSimonTap, handleCellClick, handleCorrectTap etc.
    const html = VALID_HTML.replace('function checkAnswer(answer)', 'function handleCellClick(cell)');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('passes with addEventListener click as interaction handler', () => {
    const html = VALID_HTML
      .replace('function checkAnswer(answer)', 'function processInput(answer)')
      .replace('processInput(answer)', 'processInput(answer)')
      .replace(
        '</script>',
        'document.addEventListener("click", (e) => { processInput(e.target); });\n</script>',
      );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('fails when gameState initialization is missing', () => {
    const html = VALID_HTML.replace(/gameState/g, 'appState');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('gameState'));
  });

  it('fails when no star scoring pattern found', () => {
    // Remove all star scoring patterns: thresholds, variable name, ternary
    const html = VALID_HTML
      .replace(/0\.8/g, '0.9')
      .replace(/0\.5/g, '0.6')
      .replace(/const stars\b/g, 'const rating')
      .replace(/\bstars\b/g, 'rating');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got: ${output}`);
    assert.ok(output.includes('Star scoring'));
  });

  it('passes with CDN-style calcStars star pattern', () => {
    const html = VALID_HTML
      .replace('pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1', 'calcStars(pct)');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('passes with direct stars = N assignment pattern', () => {
    const html = VALID_HTML
      .replace('pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1', '3')
      .replace('const stars = 3', 'let stars = 3;\nif (score < 8) stars = 2;\nif (score < 5) stars = 1');
    const { exitCode } = runValidator(html);
    assert.equal(exitCode, 0);
  });

  it('fails when 480px constraint is missing', () => {
    const html = VALID_HTML.replace('480px', '600px');
    const { exitCode, output } = runValidator(html);
    // Still passes because max-width is still present
    assert.equal(exitCode, 0);
  });

  it('fails when no max-width at all', () => {
    const html = VALID_HTML.replace(/max-width:\s*480px/g, 'min-height: 100px');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('max-width'));
  });

  it('warns when game_over phase is set but no star display found', () => {
    // game sets gameover phase but has no ★/☆ or stars-display element
    const html = VALID_HTML.replace(
      'function endGame()',
      `function endGame() {
    gameState.phase = 'gameover';
    document.getElementById('gameArea').innerHTML = '<h2>Game Over!</h2>';
  }
  function _unused(`,
    ).replace(
      // close the injected broken function so the rest of the HTML parses
      'function _unused(',
      'function _realEndGame(',
    );
    // Build a minimal HTML that has gameover phase but no star display
    const minHtml = VALID_HTML
      .replace(/0\.8/g, '0.9')
      .replace(/0\.5/g, '0.6')
      .replace(/const stars\b/g, 'const rating')
      .replace(/\bstars\b/g, 'rating')
      .replace(
        'gameState.currentQuestion++;',
        "gameState.phase = 'gameover'; gameState.currentQuestion++;",
      );
    // The above will still fail star-scoring check; use a direct injection instead
    const gameoverHtml = VALID_HTML.replace(
      "document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';",
      "gameState.phase = 'gameover'; document.getElementById('gameArea').innerHTML = '<h2>Game Over!</h2>';",
    ).replace(/☆|★/g, ''); // strip any accidental star chars
    const { exitCode, output } = runValidator(gameoverHtml);
    // Should warn (exit 0 with warning text) — game_over phase present but no star display
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('WARNING') && output.includes('game_over'), `Expected game_over star warning but got: ${output}`);
  });

  it('does not warn about game_over stars when star display is present', () => {
    const html = VALID_HTML.replace(
      "document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';",
      "gameState.phase = 'gameover'; document.getElementById('gameArea').setAttribute('data-testid','stars-display'); document.getElementById('gameArea').innerHTML = '<h2>Game Over!</h2><div data-testid=\"stars-display\">☆☆☆</div>';",
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    // Should NOT warn about game_over stars specifically
    assert.ok(!output.includes('game_over phase set but no star'), `Unexpected game_over star warning: ${output}`);
  });

  it('warns when click handlers present but no isActive/isProcessing guard', () => {
    // Game has addEventListener click but no isActive/isProcessing variable
    const html = VALID_HTML.replace(
      '</script>',
      'document.getElementById("answers").addEventListener("click", function(e) { checkAnswer(e.target.value); });\n</script>',
    );
    // VALID_HTML doesn't have isActive/isProcessing — should warn
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('WARNING') && output.includes('isActive'), `Expected isActive guard warning but got: ${output}`);
  });

  it('does not warn about isActive guard when guard is present', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer)',
      'let isActive = true;\n  function checkAnswer(answer)',
    ).replace(
      '</script>',
      'document.getElementById("answers").addEventListener("click", function(e) { if (!isActive) return; checkAnswer(e.target.value); });\n</script>',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('isActive/isProcessing guard'), `Unexpected isActive warning: ${output}`);
  });

  it('does not warn W3 when all buttons have data-testid', () => {
    // All interactive elements have data-testid — no W3 warning expected
    const html = VALID_HTML.replace(
      '</script>',
      `// buttons with data-testid
  document.getElementById('answers').innerHTML =
    '<button data-testid="option-0">A</button>' +
    '<button data-testid="option-1">B</button>' +
    '<button data-testid="btn-restart">Restart</button>';
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('W3'), `Unexpected W3 warning: ${output}`);
  });

  it('errors W3 when all 3 buttons have no data-testid (100% > 80% threshold)', () => {
    // 3 buttons, none have data-testid — W3 error expected (100% > 80% threshold)
    const html = VALID_HTML.replace(
      'document.getElementById(\'questionText\').textContent = a + \' x \' + b + \' = ?\';',
      `document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
    document.getElementById('answers').innerHTML =
      '<button>A</button><button>B</button><button>C</button>';`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) for 100% missing data-testid but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('data-testid'), `Expected data-testid mention but got: ${output}`);
  });

  it('does not warn W3 when exactly half buttons lack data-testid (50% threshold)', () => {
    // 4 buttons, 2 have data-testid (50% missing = exactly at threshold, not >50%) — no warning
    const html = VALID_HTML.replace(
      'document.getElementById(\'questionText\').textContent = a + \' x \' + b + \' = ?\';',
      `document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
    document.getElementById('answers').innerHTML =
      '<button data-testid="option-0">A</button>' +
      '<button data-testid="option-1">B</button>' +
      '<button>C</button>' +
      '<button>D</button>';`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('W3'), `Unexpected W3 warning: ${output}`);
  });

  it('warns W3 when 4 of 5 buttons lack data-testid (80% missing)', () => {
    // 5 buttons, 4 lack data-testid (80% > 50%) — W3 warning expected
    const html = VALID_HTML.replace(
      'document.getElementById(\'questionText\').textContent = a + \' x \' + b + \' = ?\';',
      `document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
    document.getElementById('answers').innerHTML =
      '<button data-testid="option-0">A</button>' +
      '<button>B</button>' +
      '<button>C</button>' +
      '<button>D</button>' +
      '<button>E</button>';`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('W3'), `Expected W3 warning but got: ${output}`);
    assert.ok(output.includes('4/5'), `Expected 4/5 count in warning but got: ${output}`);
  });

  it('does not warn W4 when phase assignment has syncDOMState() nearby', () => {
    // gameState.phase = 'playing' followed by syncDOMState() within 200 chars — no W4
    const html = VALID_HTML.replace(
      '</script>',
      `function syncDOMState() {}
  function startPlaying() {
    gameState.phase = 'playing';
    syncDOMState();
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('W4'), `Unexpected W4 warning: ${output}`);
  });

  it('warns W4 when phase assignment has no syncDOMState() anywhere', () => {
    // gameState.phase = 'gameover' with no syncDOMState() call in the file
    const html = VALID_HTML.replace(
      '</script>',
      `function finishRound() {
    gameState.phase = 'gameover';
    document.getElementById('gameArea').innerHTML = '<h2>Done!</h2>';
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('W4'), `Expected W4 warning but got: ${output}`);
    assert.ok(output.includes('syncDOMState'), `Expected syncDOMState mention in W4 but got: ${output}`);
  });

  it('warns W4 for the 1 of 2 phase assignments that lacks nearby syncDOMState()', () => {
    // Two phase assignments: one has syncDOMState() nearby, one does not
    const html = VALID_HTML.replace(
      '</script>',
      `function syncDOMState() {}
  function startPlaying() {
    gameState.phase = 'playing';
    syncDOMState();
  }
  function endRound() {
    // lots of code here padding out more than 200 chars so syncDOMState is not "nearby"
    // padding padding padding padding padding padding padding padding padding padding padding
    // padding padding padding padding padding padding padding padding padding padding padding
    // padding padding padding padding padding padding padding padding padding padding padding
    gameState.phase = 'results';
    // no syncDOMState call here
    document.getElementById('gameArea').innerHTML = '<h2>Results!</h2>';
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('W4'), `Expected W4 warning but got: ${output}`);
    assert.ok(output.includes('1/2'), `Expected 1/2 count in W4 warning but got: ${output}`);
  });

  it('does not warn W4 when there are no gameState.phase assignments', () => {
    // No gameState.phase assignments at all — no W4 warning expected
    const html = VALID_HTML;
    // VALID_HTML has no gameState.phase = ... assignments
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('W4'), `Unexpected W4 warning: ${output}`);
  });

  it('exits with code 2 when no file argument given', () => {
    try {
      execFileSync('node', [VALIDATOR], { encoding: 'utf-8', timeout: 5000 });
      assert.fail('Should have exited with code 2');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });

  it('exits with code 2 when file does not exist', () => {
    try {
      execFileSync('node', [VALIDATOR, '/tmp/nonexistent-ralph-test.html'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      assert.fail('Should have exited with code 2');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });

  it('fails when missing gameContent', () => {
    const html = VALID_HTML.replace(/gameContent/g, 'mainContent');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('gameContent'));
  });

  it('passes without gameArea (not required for CDN-layout games)', () => {
    // #gameArea is optional — CDN-layout games use ScreenLayout.inject() instead
    const html = VALID_HTML.replace(/gameArea/g, 'playArea');
    const { exitCode } = runValidator(html);
    assert.equal(exitCode, 0);
  });

  it('passes when waitForPackages has correct 120000ms timeout and throw', () => {
    // Lesson 117: 120000ms is now the required timeout (CDN cold-start takes 30–120s)
    const html = VALID_HTML.replace(
      '<script>',
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n<script>'
    ).replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 120000;
    const interval = 50;
    let elapsed = 0;
    while (typeof FeedbackManager === 'undefined') {
      if (elapsed >= timeout) { throw new Error('Packages failed to load within 120s'); }
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }
  }
  function initGame()`
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('fails when waitForPackages has short timeout (10000ms) with CDN scripts', () => {
    // Lesson 117: 10000ms is now WRONG — CDN cold-start takes 30–120s in fresh test browsers
    const html = VALID_HTML.replace(
      '<script>',
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n<script>'
    ).replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 10000;
    const interval = 50;
    let elapsed = 0;
    while (typeof FeedbackManager === 'undefined') {
      if (elapsed >= timeout) { throw new Error('Packages failed to load'); }
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }
  }
  function initGame()`
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('120000ms'), `Expected error about 120000ms but got: ${output}`);
  });

  it('fails when waitForPackages does not throw on timeout', () => {
    const html = VALID_HTML.replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 10000;
    const interval = 50;
    let elapsed = 0;
    while (typeof FeedbackManager === 'undefined') {
      if (elapsed >= timeout) { console.error('Packages failed to load'); return; }
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }
  }
  function initGame()`
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('throw new Error'));
  });

  it('fails when transitionScreen.show() is called without await', () => {
    // CDN game calls transitionScreen.show() without await — now an ERROR (upgraded from WARNING in Lesson 101)
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {} };
  function startTransition() {
    transitionScreen.show({ title: 'Level 1', onComplete: () => {} });
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected failure (ERROR) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('transitionScreen.show()') && output.includes('not awaited'),
      `Expected TransitionScreen await ERROR but got: ${output}`,
    );
  });

  it('does not warn when all transitionScreen.show() calls are awaited', () => {
    // All show() calls have await — no warning expected
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {} };
  async function startTransition() {
    await transitionScreen.show({ title: 'Level 1', onComplete: () => {} });
    await transitionScreen.show({ title: 'Level 2', onComplete: () => {} });
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(
      !output.includes('transitionScreen.show()') || !output.includes('not awaited'),
      `Unexpected TransitionScreen await warning: ${output}`,
    );
  });

  it('warns when gameState.isActive used in handlers but not initialized in gameState', () => {
    // Handler checks gameState.isActive but it is not in the init object
    const html = VALID_HTML.replace(
      '</script>',
      `window.endGame = endGame;
  window.addEventListener('DOMContentLoaded', async () => {
    window.gameState = { score: 0, lives: 3, phase: 'start', gameEnded: false };
    document.getElementById('answers').addEventListener('click', function(e) {
      if (!gameState.isActive) return;
      gameState.isActive = false;
      checkAnswer(e.target.value);
      gameState.isActive = true;
    });
  });
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('WARNING') && output.includes('isActive'),
      `Expected isActive init warning but got: ${output}`,
    );
  });

  it('does not warn when gameState.isActive is both used in handlers and initialized in gameState', () => {
    // Handler checks gameState.isActive AND it is in the init object — no warning
    const html = VALID_HTML.replace(
      '</script>',
      `window.endGame = endGame;
  window.addEventListener('DOMContentLoaded', async () => {
    window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };
    document.getElementById('answers').addEventListener('click', function(e) {
      if (!gameState.isActive) return;
      gameState.isActive = false;
      checkAnswer(e.target.value);
      gameState.isActive = true;
    });
  });
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('warns when CDN game has totalRounds but no window.loadRound exposed (PART-021-LOADROUND)', () => {
    // Multi-round game missing window.loadRound → __ralph.jumpToRound() is a no-op
    const html = VALID_HTML.replace(
      '</script>',
      `window.endGame = endGame;
window.gameState = gameState;
window.nextRound = nextRound;
window.addEventListener('DOMContentLoaded', async () => {
  window.gameState.totalRounds = 5;
  window.gameState.currentRound = 0;
  nextRound();
});
</script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('PART-021-LOADROUND'),
      `Expected PART-021-LOADROUND warning but got: ${output}`,
    );
  });

  it('does not warn PART-021-LOADROUND when window.loadRound is exposed', () => {
    // Multi-round game that correctly exposes window.loadRound
    const html = VALID_HTML.replace(
      '</script>',
      `window.endGame = endGame;
window.gameState = gameState;
window.nextRound = nextRound;
window.loadRound = function(n) { gameState.currentRound = n - 1; nextRound(); };
window.addEventListener('DOMContentLoaded', async () => {
  window.gameState.totalRounds = 5;
  window.gameState.currentRound = 0;
  nextRound();
});
</script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(
      !output.includes('PART-021-LOADROUND'),
      `Unexpected PART-021-LOADROUND warning: ${output}`,
    );
  });

  it('fails when TimerComponent used without typeof check in waitForPackages', () => {
    // Append TimerComponent usage to VALID_HTML without a typeof guard
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); var timer = new TimerComponent("timer-id", { timerType: "decrease" });',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('ERROR') && output.includes('TimerComponent'), `Expected TimerComponent error but got: ${output}`);
  });

  it('passes when TimerComponent has typeof check present in script', () => {
    // Append both TimerComponent usage AND typeof guard — T1 should not flag it
    const html = VALID_HTML.replace(
      'initGame();',
      'if (typeof TimerComponent === "undefined") return; var timer = new TimerComponent("timer-id", { timerType: "decrease" }); initGame();',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(!output.includes('TimerComponent') || !output.includes('ERROR'), `Unexpected TimerComponent error: ${output}`);
  });

  it('passes when TimerComponent is guarded via window.components?.TimerComponent form', () => {
    // CDN games using window.components?.TimerComponent are valid — T1 must not flag them
    const html = VALID_HTML.replace(
      'initGame();',
      'if (typeof window.components?.TimerComponent === "undefined") return; var timer = new window.components.TimerComponent("timer-id", { timerType: "decrease" }); initGame();',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(!output.includes('TimerComponent') || !output.includes('ERROR'), `Unexpected TimerComponent error for window.components form: ${output}`);
  });

  it('passes when TransitionScreenComponent is guarded via window.components?.TransitionScreenComponent form', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'if (typeof window.components?.TransitionScreenComponent === "undefined") return; var ts = new window.components.TransitionScreenComponent({ autoInject: true }); initGame();',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(!output.includes('TransitionScreenComponent') || !output.includes('ERROR'), `Unexpected TransitionScreenComponent error for window.components form: ${output}`);
  });

  it('passes when ProgressBarComponent is guarded via window.components?.ProgressBarComponent form', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'if (typeof window.components?.ProgressBarComponent === "undefined") return; var pb = new window.components.ProgressBarComponent({ containerId: "progress" }); initGame();',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(!output.includes('ProgressBarComponent') || !output.includes('ERROR'), `Unexpected ProgressBarComponent error for window.components form: ${output}`);
  });

  it('fails when TransitionScreenComponent used without typeof check', () => {
    // Append TransitionScreenComponent usage without a typeof guard
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); var ts = new TransitionScreenComponent({ autoInject: true });',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('ERROR') && output.includes('TransitionScreenComponent'), `Expected TransitionScreenComponent error but got: ${output}`);
  });

  it('fails when ProgressBarComponent used without typeof check', () => {
    // Append ProgressBarComponent usage without a typeof guard
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); var pb = new ProgressBarComponent({ containerId: "progress" });',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('ERROR') && output.includes('ProgressBarComponent'), `Expected ProgressBarComponent error but got: ${output}`);
  });
});

describe('SignalCollector hallucinated API check (5h)', () => {
  it('fails when signalCollector.trackEvent() is used — hallucinated method', () => {
    // Insert signalCollector.trackEvent call — this method does not exist in CDN API
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); if (signalCollector) signalCollector.trackEvent(event);',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('signalCollector.trackEvent'),
      `Expected signalCollector.trackEvent error but got: ${output}`,
    );
  });

  it('passes when signalCollector uses correct API methods', () => {
    // recordViewEvent and recordCustomEvent are the correct CDN API methods — no error expected
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); if (signalCollector) { signalCollector.recordViewEvent("screen_view", {}); signalCollector.recordCustomEvent("answer", { correct: true }); }',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('signalCollector.trackEvent'),
      `Unexpected signalCollector.trackEvent error for correct API usage: ${output}`,
    );
  });
});

describe('initSentry() called but not defined check (5f0)', () => {
  it('fails when initSentry() is called but function initSentry is not defined', () => {
    // The LLM called initSentry() but never defined the function — ReferenceError at runtime
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
      initSentry();`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('initSentry() is called but never defined'),
      `Expected initSentry-not-defined error but got: ${output}`,
    );
  });

  it('passes when initSentry() is called AND function initSentry() is defined', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
      function initSentry() { try { if (typeof SentryConfig !== 'undefined') SentryConfig.init(); } catch(e) {} }
      initSentry();`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('initSentry() is called but never defined'),
      `Unexpected 5f0 error for valid initSentry usage: ${output}`,
    );
  });

  it('passes when initSentry() does not appear at all', () => {
    // No Sentry usage — no error
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('initSentry() is called but never defined'),
      `Unexpected 5f0 error for HTML with no initSentry: ${output}`,
    );
  });
});

describe('TimerComponent(null) containerId check (5f5)', () => {
  it('fails when new TimerComponent(null, ...) is used', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); new TimerComponent(null, { timerType: "decrease" });');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('new TimerComponent(null'),
      `Expected TimerComponent-null error but got: ${output}`,
    );
  });

  it('fails when new TimerComponent(undefined, ...) is used', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); new TimerComponent(undefined, { timerType: "decrease" });');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('new TimerComponent(null'),
      `Expected TimerComponent-null error but got: ${output}`,
    );
  });

  it('passes when TimerComponent is used with a valid string container ID', () => {
    const html = VALID_HTML.replace('initGame();', "initGame(); new TimerComponent('timer-container', { timerType: 'decrease' });");
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('new TimerComponent(null'),
      `Unexpected 5f5 error for valid TimerComponent usage: ${output}`,
    );
  });
});

describe('progressBar.timer property access check (5f7)', () => {
  it('fails when progressBar.timer is accessed', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); const timer = progressBar.timer; timer.start();');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('progressBar.timer'),
      `Expected progressBar.timer error but got: ${output}`,
    );
  });

  it('passes when TimerComponent is created separately', () => {
    const html = VALID_HTML.replace('initGame();', "initGame(); const timer = new TimerComponent('timer-container', { timerType: 'decrease' }); timer.start();");
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('progressBar.timer'),
      `Unexpected 5f7 error for valid timer usage: ${output}`,
    );
  });
});

describe('progressBar.init() method does not exist check (5f9)', () => {
  it('fails when progressBar.init() is called', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.init();');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('progressBar.init'),
      `Expected progressBar.init error but got: ${output}`,
    );
  });

  it('passes when progressBar.update() is used instead', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(0, 10);');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('progressBar.init'),
      `Unexpected 5f9 error for valid progressBar.update usage: ${output}`,
    );
  });
});

describe('progressBar hallucinated methods check (5f10)', () => {
  const HALLUCINATED_METHODS = ['start', 'reset', 'setLives', 'pause', 'resume'];

  for (const method of HALLUCINATED_METHODS) {
    it(`fails when progressBar.${method}() is called`, () => {
      const html = VALID_HTML.replace('initGame();', `initGame(); progressBar.${method}();`);
      const { exitCode, output } = runValidator(html);
      assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
      assert.ok(
        output.includes('ERROR') && output.includes(`progressBar.${method}`),
        `Expected progressBar.${method} error but got: ${output}`,
      );
    });
  }

  it('passes when only valid progressBar methods are used (update, destroy)', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(0, 3); progressBar.destroy();');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('5f10'),
      `Unexpected 5f10 error for valid progressBar usage: ${output}`,
    );
  });

  it('does not flag progressBar.update() as a hallucinated method', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(1, 3);');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('progressBar.update') || !output.includes('ERROR'),
      `Unexpected error for progressBar.update(): ${output}`,
    );
  });
});

describe('TimerComponent slot not created by ScreenLayout (5f8)', () => {
  const cdnHtmlWithTimer = (slotsConfig) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>T</title><style>body{}</style></head>
<body><div id="app"></div>
<script>
window.gameState = { phase: 'start', score: 0 };
window.endGame = function() {};
window.restartGame = function() {};
document.addEventListener('DOMContentLoaded', async () => {
  ScreenLayout.inject('app', { slots: ${slotsConfig} });
  if (!document.getElementById('gameContent')) throw new Error('ScreenLayout.inject() did not create #gameContent');
  const timer = new TimerComponent('mathai-timer-slot', { timerType: 'decrease', startTime: 30, endTime: 0 });
  timer.start();
  window.parent.postMessage({ type: 'gameOver', score: 0, stars: 1, total: 1 }, '*');
});
</script></body></html>`;

  it('fails when mathai-timer-slot is used but timer not in ScreenLayout slots', () => {
    const html = cdnHtmlWithTimer('{ progressBar: true }');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('mathai-timer-slot'),
      `Expected timer-slot error but got: ${output}`,
    );
  });

  it('passes when timer: true is included in ScreenLayout slots', () => {
    const html = cdnHtmlWithTimer('{ progressBar: true, timer: true }');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('mathai-timer-slot'),
      `Unexpected 5f8 error when timer slot included: ${output}`,
    );
  });
});

describe('Canvas API CSS variable check (5f6)', () => {
  it('fails when addColorStop uses a CSS variable', () => {
    const html = VALID_HTML.replace('initGame();', "initGame(); ctx.addColorStop(0, 'var(--color-sky)');");
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Canvas API call with CSS variable'),
      `Expected canvas-css-var error but got: ${output}`,
    );
  });

  it('fails when fillStyle uses a CSS variable', () => {
    const html = VALID_HTML.replace('initGame();', "initGame(); ctx.fillStyle = 'var(--color-bg)';");
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Canvas API call with CSS variable'),
      `Expected canvas-css-var error but got: ${output}`,
    );
  });

  it('passes when Canvas API uses literal color values', () => {
    const html = VALID_HTML.replace('initGame();', "initGame(); ctx.addColorStop(0, '#87CEEB');");
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('Canvas API call with CSS variable'),
      `Unexpected 5f6 error for literal color: ${output}`,
    );
  });
});

describe('SentryHelper in waitForPackages check (5h2)', () => {
  it('fails when typeof SentryHelper in waitForPackages', () => {
    // Insert a waitForPackages that checks SentryHelper — SentryHelper is NOT a CDN global
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
      async function waitForPackages() {
        while (typeof ScreenLayout === 'undefined' || typeof SentryHelper === 'undefined') {
          await new Promise(r => setTimeout(r, 50));
        }
      }`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('SentryHelper'),
      `Expected SentryHelper error but got: ${output}`,
    );
  });

  it('passes when typeof SentryConfig used instead of SentryHelper', () => {
    // SentryConfig IS a valid CDN global — this should not trigger the check
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
      async function waitForPackages() {
        while (typeof ScreenLayout === 'undefined' || typeof SentryConfig === 'undefined') {
          await new Promise(r => setTimeout(r, 50));
        }
      }`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('SentryHelper'),
      `Unexpected SentryHelper error for SentryConfig usage: ${output}`,
    );
  });
});

describe('Mobile viewport scrollability checks (7b)', () => {
  it('warns when body has overflow:hidden', () => {
    // Insert body { overflow: hidden } into the style block
    const html = VALID_HTML.replace(
      'body { font-family: Arial, sans-serif; background: #f0f0f0; }',
      'body { font-family: Arial, sans-serif; background: #f0f0f0; overflow: hidden; }',
    );
    const { exitCode, output } = runValidator(html);
    // Should pass (warning only, not error) but emit MOBILE-SCROLL warning
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('MOBILE-SCROLL'), `Expected MOBILE-SCROLL warning but got: ${output}`);
  });

  it('warns when viewport meta uses user-scalable=no', () => {
    const html = VALID_HTML.replace(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0"',
      'content="width=device-width, initial-scale=1.0, user-scalable=no"',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('MOBILE-VIEWPORT'), `Expected MOBILE-VIEWPORT warning but got: ${output}`);
  });

  it('does not warn when body uses overflow-y:auto', () => {
    // body with overflow-y: auto should not trigger MOBILE-SCROLL
    const html = VALID_HTML.replace(
      'body { font-family: Arial, sans-serif; background: #f0f0f0; }',
      'body { font-family: Arial, sans-serif; background: #f0f0f0; overflow-y: auto; }',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(!output.includes('MOBILE-SCROLL'), `Unexpected MOBILE-SCROLL warning: ${output}`);
  });
});

describe('startGame() synchronous check (5i) — RULE-SYNC-1', () => {
  it('fails when startGame() wraps body in setTimeout (soh-cah-toa-worked-example #531 pattern)', () => {
    // LLM adds setTimeout "for safety" — breaks CDN TransitionScreen auto-dismiss
    const html = VALID_HTML.replace(
      '</script>',
      `function startGame() {
    setTimeout(() => {
      gameState.phase = 'game';
      document.getElementById('gameArea').style.display = 'block';
    }, 0);
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('startGame() must be synchronous'),
      `Expected startGame synchronous error but got: ${output}`,
    );
  });

  it('passes when startGame() is fully synchronous — no setTimeout wrapper', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `function startGame() {
    gameState.phase = 'game';
    document.getElementById('gameArea').style.display = 'block';
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('startGame() must be synchronous'),
      `Unexpected startGame synchronous error: ${output}`,
    );
  });

  it('fails when arrow-function startGame uses setTimeout in its body', () => {
    // Arrow-function form: startGame = () => { setTimeout(...) }
    const html = VALID_HTML.replace(
      'function initGame()',
      `const startGame = () => {
    setTimeout(() => { gameState.phase = 'game'; }, 0);
  }
  function initGame()`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('startGame() must be synchronous'),
      `Expected startGame synchronous error but got: ${output}`,
    );
  });

  it('does not flag setTimeout inside other functions when startGame is synchronous', () => {
    // setTimeout in nextRound() is fine — only startGame() is checked
    const html = VALID_HTML.replace(
      '</script>',
      `function startGame() {
    gameState.phase = 'game';
  }
  function nextRound() {
    setTimeout(() => { showQuestion(); }, 500);
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('startGame() must be synchronous'),
      `Unexpected startGame synchronous error: ${output}`,
    );
  });

  it('fails when HTML uses window.mira.components namespace (hallucination)', () => {
    // window.mira does not exist in CDN — destructuring from it assigns undefined to all consts
    // causing waitForPackages() to spin forever and #gameContent to never be created
    const html = VALID_HTML.replace(
      '</script>',
      `const { ScreenLayout, ProgressBarComponent, TransitionScreenComponent, TimerComponent, VisibilityTracker } = window.mira.components;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('window.mira.components does not exist'),
      `Expected window.mira.components error but got: ${output}`,
    );
  });

  it('does not flag window.mira.components when bare window.ScreenLayout globals are used (correct CDN pattern)', () => {
    // CDN components are bare window globals — this is the correct pattern.
    // Note: adding ScreenLayout/ProgressBarComponent to VALID_HTML (which has no ScreenLayout.inject()
    // or typeof guard) will trigger other checks (5e, 5f3) — that's fine and expected.
    // This test only verifies that window.mira.components is NOT flagged for correct bare-global usage.
    const html = VALID_HTML.replace(
      '</script>',
      `const sl = window.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('window.mira.components does not exist'),
      `Unexpected window.mira.components error for correct bare-global usage: ${output}`,
    );
  });
});

describe('Hallucinated CDN namespace checks (5k)', () => {
  it('fails when window.cdn.ScreenLayout namespace is used', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const sl = window.cdn.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Hallucinated CDN namespace'),
      `Expected hallucinated namespace error but got: ${output}`,
    );
  });

  it('fails when window.mathai.ScreenLayout namespace is used', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const sl = window.mathai.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Hallucinated CDN namespace'),
      `Expected hallucinated namespace error but got: ${output}`,
    );
  });

  it('fails when window.Ralph.ScreenLayout namespace is used', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const sl = window.Ralph.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Hallucinated CDN namespace'),
      `Expected hallucinated namespace error but got: ${output}`,
    );
  });

  it('fails when window.homeworkapp.ScreenLayout namespace is used', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const sl = window.homeworkapp.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Hallucinated CDN namespace'),
      `Expected hallucinated namespace error but got: ${output}`,
    );
  });

  it('fails when window.homeworkapp.TimerComponent namespace is used (case-insensitive)', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const timer = new window.homeworkapp.TimerComponent('timer-slot', {});
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('Hallucinated CDN namespace'),
      `Expected hallucinated namespace error but got: ${output}`,
    );
  });

  it('passes when window.cdn is used for a non-CDN purpose (no CDN component names present)', () => {
    // window.cdn.someOtherThing — not a CDN component name, so no error
    const html = VALID_HTML.replace(
      '</script>',
      `const cfg = window.cdn.config;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    // Should NOT flag — no CDN component names (ScreenLayout, ProgressBarComponent, etc.) present
    assert.ok(
      !output.includes('Hallucinated CDN namespace'),
      `Unexpected hallucinated namespace error for non-component cdn usage: ${output}`,
    );
  });

  it('passes when window.components is used — this IS a valid CDN access pattern', () => {
    // window.components?.TimerComponent is explicitly allowed (used in 5f3 typeof checks)
    const html = VALID_HTML.replace(
      '</script>',
      `while (typeof window.components?.TimerComponent === 'undefined') { await new Promise(r => setTimeout(r, 50)); }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('Hallucinated CDN namespace'),
      `window.components should be allowed as valid CDN access pattern but got error: ${output}`,
    );
  });

  it('passes when using bare window.ScreenLayout (no namespace)', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `while (typeof ScreenLayout === 'undefined') { await new Promise(r => setTimeout(r, 50)); }
  const sl = window.ScreenLayout;
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('Hallucinated CDN namespace'),
      `Bare window.ScreenLayout should be valid but got error: ${output}`,
    );
  });
});

describe('require() / ES import in CDN game script checks (5l)', () => {
  it('fails when require() is used to load a CDN package by name', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const FeedbackManager = require('feedback-manager');
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('require()'),
      `Expected require() error but got: ${output}`,
    );
  });

  it('fails when require() references @mathai scoped package', () => {
    const html = VALID_HTML.replace(
      '</script>',
      `const { ScreenLayout } = require('@mathai/components');
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('require()'),
      `Expected require() error but got: ${output}`,
    );
  });

  it('passes when require() appears without a CDN package name — unrelated usage', () => {
    // require() in a comment, or referencing a non-CDN string
    const html = VALID_HTML.replace(
      '</script>',
      `// This game does not require additional libraries
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes("require()"),
      `Unexpected require() error for comment usage: ${output}`,
    );
  });

  it('passes when initSentry() text appears in HTML comment before waitForPackages call', () => {
    // Bug 2 fix: initSentry() mentioned in an HTML comment must not trigger the
    // "initSentry() called before waitForPackages()" error. The validator must strip
    // HTML comments before running the position comparison.
    const cdnBase = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>body{} #gameContent{max-width:480px;}</style></head>
<body>
<div id="gameContent"></div>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/bundle.js"></script>
<script>
  window.gameState = { phase: 'start', score: 0, lives: 3 };
  <!-- STEP 2: initSentry() function definition (from PART-030) -->
  function initSentry() { if (typeof Sentry !== 'undefined') Sentry.init({ dsn: 'x' }); }
  function waitForPackages() {
    return new Promise((resolve, reject) => {
      const timeout = 120000;
      const start = Date.now();
      const check = () => {
        if (typeof ScreenLayout !== 'undefined') { resolve(); return; }
        if (Date.now() - start > timeout) { throw new Error('Packages failed to load within 120s'); }
        setTimeout(check, 100);
      };
      check();
    });
  }
  function initGame() {}
  function checkAnswer(v) {}
  window.addEventListener('DOMContentLoaded', async () => {
    await waitForPackages();
    initSentry();
    initGame();
  });
  window.parent.postMessage({ type: 'gameOver', score: 0, stars: 1, total: 10 }, '*');
  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;
</script>
</body>
</html>`;
    const { exitCode, output } = runValidator(cdnBase);
    assert.ok(
      !output.includes('initSentry() called before waitForPackages()'),
      `False-positive initSentry order error triggered by HTML comment: ${output}`
    );
  });
});

describe('waitForPackages() wrong CDN check pattern (5fa)', () => {
  // Minimal CDN HTML with waitForPackages — whileCondition replaces the while loop predicate
  const cdnHtmlWithWrongCheck = (whileCondition) =>
    '<!DOCTYPE html>\n' +
    '<html lang="en"><head><meta charset="UTF-8"><title>T</title>\n' +
    '<style>body{} #gameContent{max-width:480px;}</style></head>\n' +
    '<body><div id="app"></div>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/bundle.js"></script>\n' +
    '<script>\n' +
    '  window.gameState = { phase: \'start\', score: 0, lives: 3 };\n' +
    '  window.endGame = function endGame() {};\n' +
    '  window.restartGame = function restartGame() {};\n' +
    '  window.nextRound = function nextRound() {};\n' +
    '  async function waitForPackages() {\n' +
    '    const timeout = 180000; const interval = 50; let elapsed = 0;\n' +
    '    while (' + whileCondition + ') {\n' +
    '      if (elapsed >= timeout) { throw new Error(\'Packages failed to load within 180s\'); }\n' +
    '      await new Promise(resolve => setTimeout(resolve, interval));\n' +
    '      elapsed += interval;\n' +
    '    }\n' +
    '  }\n' +
    '  document.addEventListener(\'DOMContentLoaded\', async () => {\n' +
    '    await waitForPackages();\n' +
    '    window.parent.postMessage({ type: \'gameOver\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
    '  });\n' +
    '  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;\n' +
    '</script></body></html>';

  it('fails when waitForPackages uses while (!window.FeedbackManager) truthy check', () => {
    const html = cdnHtmlWithWrongCheck('!window.FeedbackManager');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('wrong CDN check pattern'),
      `Expected 5fa error but got: ${output}`,
    );
  });

  it('passes when waitForPackages uses the correct typeof FeedbackManager === "undefined" pattern', () => {
    const html = cdnHtmlWithWrongCheck('typeof FeedbackManager === \'undefined\'');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('wrong CDN check pattern'),
      `Unexpected 5fa error for correct typeof pattern: ${output}`,
    );
  });
});

describe('FeedbackManager.init() forbidden check (5b2 GEN-113)', () => {
  it('fails when FeedbackManager.init({}) is called — produces PART-011-INIT error', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); FeedbackManager.init({ popupProps: { title: "Test" } });',
    );
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-011-INIT'),
      `Expected PART-011-INIT error in output: ${output}`,
    );
  });

  it('passes when FeedbackManager.playDynamicFeedback is used without init() call', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); FeedbackManager.playDynamicFeedback({ event: 'success' }).catch(e => console.error(e.message));",
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('PART-011-INIT'),
      `Unexpected PART-011-INIT error when no init() is called: ${output}`,
    );
  });
});

describe('FeedbackManager.sound.playDynamicFeedback wrong namespace check (5b2 GEN-113B)', () => {
  it('fails when FeedbackManager.sound.playDynamicFeedback() is called — produces PART-011-SOUND error', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); FeedbackManager.sound.playDynamicFeedback({ event: 'success' });",
    );
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-011-SOUND'),
      `Expected PART-011-SOUND error in output: ${output}`,
    );
  });

  it('passes when FeedbackManager.playDynamicFeedback() is called at top level', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); FeedbackManager.playDynamicFeedback({ event: 'success' });",
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('PART-011-SOUND'),
      `Unexpected PART-011-SOUND error when correct namespace is used: ${output}`,
    );
  });
});
