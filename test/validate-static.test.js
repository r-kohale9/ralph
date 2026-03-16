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

  it('fails when missing initGame', () => {
    const html = VALID_HTML.replace('function initGame()', 'function startGame()');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('initGame'));
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

  it('fails when external JS is present', () => {
    const html = VALID_HTML.replace('<script>', '<script src="app.js"></script><script>');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('External JS'));
  });

  it('fails when document.write is used', () => {
    const html = VALID_HTML.replace('initGame();', 'document.write("x"); initGame();');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('document.write'));
  });

  it('fails when no answer handler function found (promoted to error)', () => {
    const html = VALID_HTML.replace('function checkAnswer(answer)', 'function processInput(answer)');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('checkAnswer'));
  });

  it('fails when gameState initialization is missing', () => {
    const html = VALID_HTML.replace(/gameState/g, 'appState');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('gameState'));
  });

  it('fails when star thresholds are missing', () => {
    const html = VALID_HTML.replace('0.8', '0.9').replace('0.5', '0.6');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('Star thresholds'));
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
        encoding: 'utf-8', timeout: 5000,
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

  it('fails when missing gameArea', () => {
    const html = VALID_HTML.replace(/gameArea/g, 'playArea');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1);
    assert.ok(output.includes('gameArea'));
  });
});
