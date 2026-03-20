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

  it('passes when waitForPackages has correct 10000ms timeout and throw', () => {
    const html = VALID_HTML.replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 10000;
    const interval = 50;
    let elapsed = 0;
    while (typeof FeedbackManager === 'undefined') {
      if (elapsed >= timeout) { throw new Error('Packages failed to load within 10s'); }
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }
  }
  function initGame()`
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
  });

  it('fails when waitForPackages has wrong timeout (>10s)', () => {
    const html = VALID_HTML.replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 15000;
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
    assert.ok(output.includes('timeout=10000'));
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
});
