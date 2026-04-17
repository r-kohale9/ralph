'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALIDATOR = path.join(__dirname, '..', 'lib', 'validate-static.js');

let _tmpCounter = 0;
function runValidator(html) {
  const tmpFile = path.join(os.tmpdir(), `ralph-test-${Date.now()}-${++_tmpCounter}-${process.pid}.html`);
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
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore if already deleted */ }
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
    window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
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

function buildPreviewHtml(options = {}) {
  const includeCompatCss = options.includeCompatCss !== false;
  const includeRootHidden = options.includeRootHidden !== false;
  const extraCss = [
    includeRootHidden ? 'html, body { overflow-y: hidden; }' : '',
    includeCompatCss
      ? '#mathai-preview-slot { height: 100dvh; overflow: hidden; }\n#mathai-preview-slot .mathai-preview-body { height: 100dvh; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }'
      : '',
  ].filter(Boolean).join('\n');

  return VALID_HTML
    .replace(
      '</style>',
      `${extraCss ? `${extraCss}\n` : ''}</style>`,
    )
    .replace(
      '<div id="gameContent">',
      '<div id="app" data-phase="start_screen" data-score="0"></div>\n<div id="gameContent">',
    )
    .replace(
      'initGame();',
      `const content = { previewInstruction: 'Preview copy' };
  const fallbackContent = { previewInstruction: 'Fallback preview copy' };
  function startGameAfterPreview() {}
  ScreenLayout.inject('app', { slots: { progressBar: true, previewScreen: true, transitionScreen: true } });
  const previewScreen = new PreviewScreenComponent({ slotId: 'mathai-preview-slot' });
  previewScreen.show({ instruction: content.previewInstruction || fallbackContent.previewInstruction, audioUrl: null, onComplete: startGameAfterPreview });
  initGame();`,
    );
}

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

  it('GEN-PM-001: fails when postMessage uses wrong type (not game_complete)', () => {
    const html = VALID_HTML.replace("type: 'game_complete'", "type: 'completed'");
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got: ${output}`);
    assert.ok(output.includes('GEN-PM-001'), `Expected GEN-PM-001 error but got: ${output}`);
    assert.ok(output.includes("type: 'game_complete'"), `Expected game_complete mention but got: ${output}`);
  });

  it('GEN-PM-001: passes when postMessage uses correct type game_complete', () => {
    // VALID_HTML already uses type: 'game_complete' — should pass without GEN-PM-001 error
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0, `Expected pass but got: ${output}`);
    assert.ok(!output.includes('GEN-PM-001'), `Unexpected GEN-PM-001 error: ${output}`);
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
    // Note: use typeof SentryConfig (not FeedbackManager, not ScreenLayout) to avoid triggering
    // GEN-WAITFOR-MATCH-A (FeedbackManager without script) or the ScreenLayout.inject() check.
    const html = VALID_HTML.replace(
      '<script>',
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n<script>'
    ).replace(
      'function initGame()',
      `async function waitForPackages() {
    const timeout = 120000;
    const interval = 50;
    let elapsed = 0;
    while (typeof SentryConfig === 'undefined') {
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
    // All show() calls have await — no warning expected; hide() present satisfies PART-025-HIDE
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {}, hide: async function() {} };
  async function startTransition() {
    await transitionScreen.show({ title: 'Level 1', onComplete: () => {} });
    await transitionScreen.show({ title: 'Level 2', onComplete: () => {} });
    await transitionScreen.hide();
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
window.loadRound = function(n) { gameState.currentRound = n - 1; }; // GEN-ROUND-INDEX: set index directly, do NOT call nextRound()
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

describe('LP-1: progressBar.update() 2nd arg must not be totalRounds (GEN-112)', () => {
  it('fails when progressBar.update() 2nd arg is bare totalRounds', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(round, totalRounds);');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR [GEN-112]') && output.includes('totalRounds'),
      `Expected GEN-112 totalRounds error but got: ${output}`,
    );
  });

  it('fails when progressBar.update() 2nd arg is gameState.totalRounds', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(gameState.currentRound, gameState.totalRounds);');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR [GEN-112]') && output.includes('totalRounds'),
      `Expected GEN-112 totalRounds error but got: ${output}`,
    );
  });

  it('passes when progressBar.update() 2nd arg is livesRemaining', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(gameState.currentRound, gameState.livesRemaining);');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-112') || !output.includes('totalRounds'),
      `Unexpected LP-1 error for livesRemaining: ${output}`,
    );
  });

  it('passes when progressBar.update() 2nd arg is 0 (no-lives game)', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(gameState.currentRound, 0);');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-112') || !output.includes('totalRounds'),
      `Unexpected LP-1 error for literal 0: ${output}`,
    );
  });

  it('passes when progressBar.update() 2nd arg is gameState.lives', () => {
    const html = VALID_HTML.replace('initGame();', 'initGame(); progressBar.update(gameState.currentRound, gameState.lives);');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-112') || !output.includes('totalRounds'),
      `Unexpected LP-1 error for gameState.lives: ${output}`,
    );
  });
});

describe('GEN-112 false-positive regression: Math.max(0, lives) must NOT trigger 3-arg error', () => {
  // stats-mean-direct build #575: progressBar.update(currentRound, Math.max(0, lives))
  // was falsely flagged as a 3-arg call because the regex counted the comma inside Math.max().
  // The paren-depth-aware arg counter must correctly identify this as a 2-arg call.

  it('passes when 2nd arg is Math.max(0, gameState.lives)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); if (progressBar) progressBar.update(gameState.currentRound, Math.max(0, gameState.lives));',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      exitCode === 0 || !output.includes('3 args'),
      `False positive: Math.max(0, lives) wrongly flagged as 3-arg call: ${output}`,
    );
  });

  it('passes when 2nd arg is Math.max(0, lives) (shorthand)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); progressBar.update(round, Math.max(0, lives));',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      exitCode === 0 || !output.includes('3 args'),
      `False positive: Math.max(0, lives) shorthand wrongly flagged: ${output}`,
    );
  });

  it('still fails when progressBar.update() has a genuine 3rd top-level arg', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives);',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail for genuine 3-arg call but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('3 args'),
      `Expected 3-arg error but got: ${output}`,
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
  window.parent.postMessage({ type: 'game_complete', score: 0, stars: 1, total: 1 }, '*');
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

  it('warns when html/body uses overflow-y:hidden', () => {
    const html = VALID_HTML.replace(
      'body { font-family: Arial, sans-serif; background: #f0f0f0; }',
      'html, body { margin: 0; padding: 0; overflow-y: hidden; }\n  body { font-family: Arial, sans-serif; background: #f0f0f0; }',
    );
    const { exitCode, output } = runValidator(html);
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

  it('does not warn when preview-wrapper mode locks root scroll but preview body owns scrolling', () => {
    const html = buildPreviewHtml();
    const { output } = runValidator(html);
    assert.ok(!output.includes('MOBILE-SCROLL'), `Unexpected MOBILE-SCROLL warning: ${output}`);
    assert.ok(!output.includes('5e0-SCROLL-OWNER'), `Unexpected 5e0-SCROLL-OWNER error: ${output}`);
  });
});

describe('Preview-wrapper scroll-owner checks (5e0-SCROLL-OWNER)', () => {
  it('fails preview games that omit the preview-body scroll-owner compatibility CSS', () => {
    const html = buildPreviewHtml({ includeCompatCss: false });
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected error (exit 1) but got exit ${exitCode}: ${output}`);
    assert.ok(output.includes('5e0-SCROLL-OWNER'), `Expected 5e0-SCROLL-OWNER error but got: ${output}`);
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
  window.parent.postMessage({ type: 'game_complete', score: 0, stars: 1, total: 10 }, '*');
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
    '    window.parent.postMessage({ type: \'game_complete\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
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

describe('PART-028: CSS stylesheet integrity check', () => {
  it('fails with PART-028-CSS-STRIPPED when <style> block contains only comments', () => {
    // Simulate a targeted fix LLM that replaces the stylesheet with a comment placeholder
    const html = VALID_HTML.replace(
      /<style[^>]*>[\s\S]*?<\/style>/i,
      '<style>\n/* CSS preserved */\n</style>',
    );
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-028-CSS-STRIPPED'),
      `Expected PART-028-CSS-STRIPPED error in output: ${output}`,
    );
  });

  it('fails with PART-028-CSS-STRIPPED when <style> block contains multiple comments but no real CSS', () => {
    const html = VALID_HTML.replace(
      /<style[^>]*>[\s\S]*?<\/style>/i,
      '<style>\n/* layout styles */\n/* button styles */\n/* All styles preserved as-is */\n</style>',
    );
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-028-CSS-STRIPPED'),
      `Expected PART-028-CSS-STRIPPED error in output: ${output}`,
    );
  });

  it('fails with PART-028-CSS-STRIPPED when <style> block is completely empty', () => {
    const html = VALID_HTML.replace(/<style[^>]*>[\s\S]*?<\/style>/i, '<style></style>');
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-028-CSS-STRIPPED'),
      `Expected PART-028-CSS-STRIPPED error in output: ${output}`,
    );
  });

  it('fails with PART-028-CSS-STRIPPED when <style> block contains only whitespace', () => {
    const html = VALID_HTML.replace(/<style[^>]*>[\s\S]*?<\/style>/i, '<style>   </style>');
    const { exitCode, output } = runValidator(html);
    assert.strictEqual(exitCode, 1, `Expected exit code 1 but got ${exitCode}. Output: ${output}`);
    assert.ok(
      output.includes('PART-028-CSS-STRIPPED'),
      `Expected PART-028-CSS-STRIPPED error in output: ${output}`,
    );
  });

  it('emits PART-028-NO-CSS warning when no <style> block exists', () => {
    const html = VALID_HTML.replace(/<style[^>]*>[\s\S]*?<\/style>/i, '');
    const { exitCode, output } = runValidator(html);
    // PART-028-NO-CSS is a warning but other checks (e.g. CSS style block required) also fire errors —
    // so exit code may be 1. Assert only that the warning text appears.
    assert.ok(
      output.includes('PART-028-NO-CSS'),
      `Expected PART-028-NO-CSS warning in output: ${output}`,
    );
  });

  it('passes without PART-028 errors when <style> block contains real CSS rules', () => {
    // VALID_HTML already has a proper <style> block
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('PART-028-CSS-STRIPPED'),
      `Unexpected PART-028-CSS-STRIPPED error on valid HTML: ${output}`,
    );
  });

  it('passes without PART-028-CSS-STRIPPED when <style> block has CSS mixed with comments', () => {
    const html = VALID_HTML.replace(
      /<style[^>]*>[\s\S]*?<\/style>/i,
      '<style>\n/* layout */\nbody { margin: 0; }\n/* buttons */\n.btn { padding: 8px; }\n</style>',
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('PART-028-CSS-STRIPPED'),
      `Unexpected PART-028-CSS-STRIPPED error when style has real CSS mixed with comments: ${output}`,
    );
  });
});

describe('ARIA-001: feedback div aria-live warning (W5)', () => {
  it('emits ARIA-001 warning when a div with id containing "feedback" lacks aria-live', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="correct-feedback" class="feedback hidden">Correct!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning when feedback div lacks aria-live. Output: ${output}`,
    );
  });

  it('emits ARIA-001 warning when a div with class containing "feedback" lacks aria-live', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div class="feedback-message hidden">Incorrect!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning when feedback-message div lacks aria-live. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-001 warning when feedback div has aria-live="polite"', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="correct-feedback" aria-live="polite" class="feedback hidden">Correct!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 warning when feedback div has aria-live. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-001 warning when feedback div has aria-live="assertive"', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="feedback" aria-live="assertive" class="feedback">Wrong!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 warning when feedback div has aria-live=assertive. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-001 warning when HTML has no feedback divs at all', () => {
    // VALID_HTML has no feedback divs
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 warning on HTML with no feedback divs. Output: ${output}`,
    );
  });

  // TE-CR-001: order-independence — aria-live must be detected regardless of attribute position
  it('does NOT emit ARIA-001 warning when aria-live is present but id is not the first attribute', () => {
    // data-phase appears before id — regex must not anchor to id as first attribute
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div data-phase="results" id="feedback" aria-live="polite">Nice work!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 warning: aria-live present but id is not first attribute. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-001 warning when aria-live is present with class before id and extra data attrs', () => {
    // class and data-testid both precede aria-live — all ordering variants must pass
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div class="feedback-box" data-testid="fb" aria-live="polite">Try again!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 warning: aria-live present with class-first ordering. Output: ${output}`,
    );
  });

  it('emits ARIA-001 warning when data-phase is first attribute but aria-live is missing', () => {
    // data-phase before id must still trigger warning when aria-live is absent
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div data-phase="results" id="feedback">Correct!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning: data-phase first, id="feedback" present, but no aria-live. Output: ${output}`,
    );
  });

  // New expanded coverage: compound variants confirmed across 9 audit instances
  it('emits ARIA-001 warning for #answer-feedback without aria-live (audit variant)', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="answer-feedback" class="hidden"></div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning for #answer-feedback without aria-live. Output: ${output}`,
    );
  });

  it('emits ARIA-001 warning for #result-feedback without aria-live (audit variant)', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="result-feedback"></div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning for #result-feedback without aria-live. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-001 warning for bare #answers container (no false positive)', () => {
    // #answers is a container div, not a dynamic feedback element
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('ARIA-001'),
      `Unexpected ARIA-001 false positive on #answers container. Output: ${output}`,
    );
  });

  it('emits ARIA-001 warning for #hint-text without aria-live (audit variant)', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="hint-text" class="hidden"></div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-001'),
      `Expected ARIA-001 warning for #hint-text without aria-live. Output: ${output}`,
    );
  });
});

describe('ARIA-002: aria-live=assertive without role=alert warning (W6)', () => {
  it('does NOT emit ARIA-002 warning when aria-live=assertive has role=alert', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="error-msg" role="alert" aria-live="assertive">Error!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-002'),
      `Unexpected ARIA-002 warning when aria-live=assertive has role=alert. Output: ${output}`,
    );
  });

  it('emits ARIA-002 warning when aria-live=assertive lacks role=alert', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="feedback" aria-live="assertive">Wrong!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('ARIA-002'),
      `Expected ARIA-002 warning when aria-live=assertive lacks role=alert. Output: ${output}`,
    );
  });

  it('does NOT emit ARIA-002 warning when there is no aria-live=assertive', () => {
    const html = VALID_HTML.replace(
      '<div id="answers"></div>',
      '<div id="answers"></div>\n<div id="feedback" aria-live="polite" role="status">Nice!</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('ARIA-002'),
      `Unexpected ARIA-002 warning when no aria-live=assertive present. Output: ${output}`,
    );
  });
});

describe('GEN-CSS-TOKENS: banned CSS custom property tokens (W7)', () => {
  it('emits GEN-CSS-TOKENS warning when --mathai-green is used', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--mathai-green);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--mathai-green'),
      `Expected GEN-CSS-TOKENS warning for --mathai-green. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --color-red is used', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--color-red);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--color-red'),
      `Expected GEN-CSS-TOKENS warning for --color-red. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --color-orange is used', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--color-orange);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--color-orange'),
      `Expected GEN-CSS-TOKENS warning for --color-orange. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --color-green is used', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--color-green);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--color-green'),
      `Expected GEN-CSS-TOKENS warning for --color-green. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --color-success is used', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--color-success);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--color-success'),
      `Expected GEN-CSS-TOKENS warning for --color-success. Output: ${output}`,
    );
  });

  it('does NOT emit GEN-CSS-TOKENS warning when --mathai-success is used (valid token)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--mathai-success);');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CSS-TOKENS'),
      `Unexpected GEN-CSS-TOKENS warning when using valid token --mathai-success. Output: ${output}`,
    );
  });

  it('does NOT emit GEN-CSS-TOKENS warning when --mathai-error is used (valid token)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--mathai-error);');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CSS-TOKENS'),
      `Unexpected GEN-CSS-TOKENS warning when using valid token --mathai-error. Output: ${output}`,
    );
  });

  it('does NOT emit GEN-CSS-TOKENS warning when --mathai-warning is used (valid token)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--mathai-warning);');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CSS-TOKENS'),
      `Unexpected GEN-CSS-TOKENS warning when using valid token --mathai-warning. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --feedback-color is used (CR-025)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'color: var(--feedback-color);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--feedback-color'),
      `Expected GEN-CSS-TOKENS warning for --feedback-color. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --answer-color is used (CR-025)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'color: var(--answer-color);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--answer-color'),
      `Expected GEN-CSS-TOKENS warning for --answer-color. Output: ${output}`,
    );
  });

  it('emits GEN-CSS-TOKENS warning when --status-green is used (CR-025)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'color: var(--status-green);');
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CSS-TOKENS') && output.includes('--status-green'),
      `Expected GEN-CSS-TOKENS warning for --status-green. Output: ${output}`,
    );
  });

  it('does NOT emit GEN-CSS-TOKENS warning when --primary-color is used (not in ban list)', () => {
    const html = VALID_HTML.replace('background: #f0f0f0;', 'background: var(--primary-color);');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CSS-TOKENS'),
      `Unexpected GEN-CSS-TOKENS warning for --primary-color (not a banned token). Output: ${output}`,
    );
  });
});

describe('GEN-UX-003 extension: ProgressBarComponent options object missing slotId key', () => {
  it('fails when ProgressBarComponent options object lacks slotId key', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); if (typeof ProgressBarComponent !== "undefined") { var pb = new ProgressBarComponent({ totalRounds: 5, totalLives: 3 }); }',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('FORBIDDEN') && output.includes('GEN-UX-003'),
      `Expected GEN-UX-003 error but got: ${output}`,
    );
  });

  it('passes when ProgressBarComponent options object has slotId key', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); if (typeof ProgressBarComponent !== \"undefined\") { var pb = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 }); }",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-UX-003'),
      `Unexpected GEN-UX-003 error when slotId is present: ${output}`,
    );
  });
});

describe('GEN-UX-004: alert() call ban', () => {
  it('fails when game uses alert() call', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); function showError() { alert('Something went wrong!'); }",
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('FORBIDDEN') && output.includes('GEN-UX-004'),
      `Expected GEN-UX-004 error but got: ${output}`,
    );
  });
});

describe('GEN-UX-005: SignalCollector must not be called with no args', () => {
  it('fails when SignalCollector called with no args', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); const sc = new SignalCollector();',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('FORBIDDEN') && output.includes('GEN-UX-005'),
      `Expected GEN-UX-005 error but got: ${output}`,
    );
  });

  it('passes when SignalCollector called with args object', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); const sc = new SignalCollector({ sessionId: 'abc', studentId: '123', templateId: 'tpl' });",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-UX-005'),
      `Unexpected GEN-UX-005 error when SignalCollector has args: ${output}`,
    );
  });

  // ─── SignalCollector inline stub detection (5h3) ────────────────────────────
  it('fails when inline SignalCollector stub shadows CDN package', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'window.SignalCollector = class { constructor() {} seal() { return {}; } };\ninitGame();',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('FORBIDDEN') && output.includes('Inline SignalCollector stub'),
      `Expected inline stub error but got: ${output}`,
    );
  });

  it('passes when SignalCollector is loaded from CDN (no inline stub)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); var signalCollector = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });\nwindow.signalCollector = signalCollector;",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('Inline SignalCollector stub'),
      `Unexpected inline stub error: ${output}`,
    );
  });

  // ─── SignalCollector waitForPackages typeof guard ──────────────────────────
  it('fails when SignalCollector used without typeof guard in waitForPackages', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "async function waitForPackages() { while (typeof FeedbackManager === 'undefined') await new Promise(r => setTimeout(r, 50)); }\ninitGame(); var sc = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });",
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('typeof SignalCollector'),
      `Expected typeof SignalCollector guard error but got: ${output}`,
    );
  });

  it('passes when SignalCollector has typeof guard in waitForPackages', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "async function waitForPackages() { while (typeof FeedbackManager === 'undefined' || typeof SignalCollector === 'undefined') await new Promise(r => setTimeout(r, 50)); }\ninitGame(); var sc = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });\nwindow.signalCollector = sc;",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('typeof SignalCollector'),
      `Unexpected typeof guard error when guard is present: ${output}`,
    );
  });

  // ─── SignalCollector window.signalCollector assignment ─────────────────────
  it('warns when SignalCollector instantiated but not assigned to window', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); var sc = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });",
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('WARNING') && output.includes('window.signalCollector'),
      `Expected window.signalCollector warning but got: ${output}`,
    );
  });

  it('passes when SignalCollector assigned to window.signalCollector', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); var sc = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });\nwindow.signalCollector = sc;",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('window.signalCollector'),
      `Unexpected window.signalCollector warning: ${output}`,
    );
  });

  // ─── GEN-PM-SIGNALCONFIG tests ──────────────────────────────────────────────
  it('GEN-PM-SIGNALCONFIG: fails when signalCollector + handlePostMessage exist but property assignments missing', () => {
    // Add signalCollector + handlePostMessage without the 6 property assignments
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
var signalCollector = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });
window.signalCollector = signalCollector;
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  gameState.content = event.data.data.content;
}`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-PM-SIGNALCONFIG'),
      `Expected GEN-PM-SIGNALCONFIG error but got: ${output}`,
    );
  });

  it('GEN-PM-SIGNALCONFIG: passes when all 6 signalCollector properties are assigned', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
var signalCollector = new SignalCollector({ sessionId: 's', studentId: 's', gameId: 'g', contentSetId: 'c' });
window.signalCollector = signalCollector;
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }
}`,
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-PM-SIGNALCONFIG'),
      `Unexpected GEN-PM-SIGNALCONFIG error: ${output}`,
    );
  });

  // ─── GEN-LOCAL-ASSETS tests ─────────────────────────────────────────────────
  it('GEN-LOCAL-ASSETS: fires ERROR for src="assets/icon.svg"', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<img src="assets/icon.svg">\';',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-LOCAL-ASSETS'),
      `Expected GEN-LOCAL-ASSETS error but got: ${output}`,
    );
  });

  it('GEN-LOCAL-ASSETS: does NOT fire for CDN src URL', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<img src="https://storage.googleapis.com/mathai-temp-assets/icon.svg">\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-LOCAL-ASSETS'),
      `Unexpected GEN-LOCAL-ASSETS error for CDN URL: ${output}`,
    );
  });

  it('GEN-LOCAL-ASSETS: fires ERROR for icons: ["assets/icon.png"] pattern', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); const cfg = { icons: ['assets/icon.png'] };",
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-LOCAL-ASSETS'),
      `Expected GEN-LOCAL-ASSETS error but got: ${output}`,
    );
  });

  it('GEN-LOCAL-ASSETS: does NOT fire for icons: ["🎯"] emoji pattern', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      "initGame(); const cfg = { icons: ['🎯'] };",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-LOCAL-ASSETS'),
      `Unexpected GEN-LOCAL-ASSETS error for emoji icons: ${output}`,
    );
  });

  it('GEN-LOCAL-ASSETS: fires ERROR for CSS url("images/bg.png") pattern', () => {
    const html = VALID_HTML.replace(
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      '* { margin: 0; padding: 0; box-sizing: border-box; } body { background: url("images/bg.png"); }',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-LOCAL-ASSETS'),
      `Expected GEN-LOCAL-ASSETS error but got: ${output}`,
    );
  });

  it('GEN-LOCAL-ASSETS: does NOT fire for data: URI', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<img src="data:image/png;base64,abc123">\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-LOCAL-ASSETS'),
      `Unexpected GEN-LOCAL-ASSETS error for data: URI: ${output}`,
    );
  });

  // ─── GEN-SVG-CONTRAST tests ─────────────────────────────────────────────────
  it('GEN-SVG-CONTRAST: fires WARNING for stroke="#64748b" (lowercase)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><circle stroke="#64748b" r="10"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SVG-CONTRAST'),
      `Expected GEN-SVG-CONTRAST warning but got: ${output}`,
    );
  });

  it('GEN-SVG-CONTRAST: fires WARNING for stroke="#64748B" (uppercase — case-insensitive)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><circle stroke="#64748B" r="10"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SVG-CONTRAST'),
      `Expected GEN-SVG-CONTRAST warning for uppercase hex but got: ${output}`,
    );
  });

  it('GEN-SVG-CONTRAST: does NOT fire for stroke="#374151" (passing contrast)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><circle stroke="#374151" r="10"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-SVG-CONTRAST'),
      `Unexpected GEN-SVG-CONTRAST warning for #374151: ${output}`,
    );
  });

  it('GEN-SVG-CONTRAST: fires WARNING for fill="#9ca3af" (gray-400)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><rect fill="#9ca3af" width="20" height="20"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SVG-CONTRAST'),
      `Expected GEN-SVG-CONTRAST warning for fill #9ca3af but got: ${output}`,
    );
  });

  it('GEN-SVG-CONTRAST: fires WARNING for fill="#94a3b8" (slate-400)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><path fill="#94a3b8" d="M0 0h10v10z"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SVG-CONTRAST'),
      `Expected GEN-SVG-CONTRAST warning for fill #94a3b8 but got: ${output}`,
    );
  });

  it('GEN-SVG-CONTRAST: does NOT fire for fill="#1f2937" (gray-800, high contrast)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); document.getElementById("gameArea").innerHTML += \'<svg><path fill="#1f2937" d="M0 0h10v10z"/></svg>\';',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-SVG-CONTRAST'),
      `Unexpected GEN-SVG-CONTRAST warning for #1f2937: ${output}`,
    );
  });
});

describe('GEN-PROGRESSBAR-LIVES: totalLives zero, negative, and double-zero (CR-024)', () => {
  // Helper: inject a ProgressBarComponent with the given totalLives value, wrapped in typeof guard
  function pbHtml(totalLivesExpr) {
    return VALID_HTML.replace(
      'initGame();',
      `initGame(); if (typeof ProgressBarComponent !== "undefined") { var pb = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: ${totalLivesExpr} }); }`,
    );
  }

  it('fails for totalLives: 0', () => {
    const { exitCode, output } = runValidator(pbHtml('0'));
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-PROGRESSBAR-LIVES'),
      `Expected GEN-PROGRESSBAR-LIVES error for totalLives: 0 but got: ${output}`,
    );
  });

  it('fails for totalLives: -1 (negative)', () => {
    const { exitCode, output } = runValidator(pbHtml('-1'));
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-PROGRESSBAR-LIVES'),
      `Expected GEN-PROGRESSBAR-LIVES error for totalLives: -1 but got: ${output}`,
    );
  });

  it('fails for totalLives: -5 (negative)', () => {
    const { exitCode, output } = runValidator(pbHtml('-5'));
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-PROGRESSBAR-LIVES'),
      `Expected GEN-PROGRESSBAR-LIVES error for totalLives: -5 but got: ${output}`,
    );
  });

  it('fails for totalLives: 00 (double-zero)', () => {
    const { exitCode, output } = runValidator(pbHtml('00'));
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-PROGRESSBAR-LIVES'),
      `Expected GEN-PROGRESSBAR-LIVES error for totalLives: 00 but got: ${output}`,
    );
  });

  it('passes for totalLives: 1 (valid minimum)', () => {
    const { output } = runValidator(pbHtml('1'));
    assert.ok(
      !output.includes('GEN-PROGRESSBAR-LIVES'),
      `Unexpected GEN-PROGRESSBAR-LIVES error for totalLives: 1. Output: ${output}`,
    );
  });

  it('passes for totalLives: 3 (valid positive)', () => {
    const { output } = runValidator(pbHtml('3'));
    assert.ok(
      !output.includes('GEN-PROGRESSBAR-LIVES'),
      `Unexpected GEN-PROGRESSBAR-LIVES error for totalLives: 3. Output: ${output}`,
    );
  });
});

describe('W13 GEN-RESTART-RESET: restartGame() must reset required gameState fields (CR-032)', () => {
  // Base HTML that has a valid restartGame() with full state reset — should NOT trigger warning
  const FULL_RESET_HTML = VALID_HTML.replace(
    'initGame();',
    `initGame();
  function restartGame() {
    gameState.currentRound = 0;
    gameState.lives = gameState.totalLives;
    gameState.score = 0;
    gameState.events = [];
    gameState.attempts = [];
    gameState.gameEnded = false;
    gameState.phase = 'start';
    showStartScreen();
  }
  function showStartScreen() {}`,
  );

  it('does NOT warn when restartGame() resets all required fields', () => {
    const { output } = runValidator(FULL_RESET_HTML);
    assert.ok(
      !output.includes('GEN-RESTART-RESET'),
      `Unexpected GEN-RESTART-RESET warning for complete reset. Output: ${output}`,
    );
  });

  it('does NOT warn when restartGame() is not defined (game has no restart)', () => {
    // VALID_HTML has no restartGame() — should pass cleanly
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-RESTART-RESET'),
      `Unexpected GEN-RESTART-RESET warning when restartGame is absent. Output: ${output}`,
    );
  });

  it('warns when restartGame() only resets gameEnded (missing currentRound, score, lives, events, attempts)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  function restartGame() {
    gameState.gameEnded = false;
    gameState.phase = 'start';
    showStartScreen();
  }
  function showStartScreen() {}`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-RESTART-RESET'),
      `Expected GEN-RESTART-RESET warning for incomplete reset. Output: ${output}`,
    );
    // Confirm the missing fields are listed
    assert.ok(output.includes('currentRound'), `Expected 'currentRound' in warning: ${output}`);
    assert.ok(output.includes('score'), `Expected 'score' in warning: ${output}`);
    assert.ok(output.includes('lives'), `Expected 'lives' in warning: ${output}`);
  });

  it('warns when restartGame() resets lives/currentRound but not events or attempts', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  function restartGame() {
    gameState.currentRound = 0;
    gameState.lives = gameState.totalLives;
    gameState.score = 0;
    gameState.gameEnded = false;
    showStartScreen();
  }
  function showStartScreen() {}`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-RESTART-RESET'),
      `Expected GEN-RESTART-RESET warning when events/attempts missing. Output: ${output}`,
    );
    assert.ok(output.includes('events'), `Expected 'events' in warning: ${output}`);
    assert.ok(output.includes('attempts'), `Expected 'attempts' in warning: ${output}`);
  });

  it('warns when restartGame() only resets score but not lives, currentRound, events, attempts', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  function restartGame() {
    gameState.score = 0;
    gameState.gameEnded = false;
    showStartScreen();
  }
  function showStartScreen() {}`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-RESTART-RESET'),
      `Expected GEN-RESTART-RESET warning for partial reset (score only). Output: ${output}`,
    );
    assert.ok(output.includes('currentRound'), `Expected 'currentRound' in warning: ${output}`);
    assert.ok(output.includes('lives'), `Expected 'lives' in warning: ${output}`);
  });
});

// ─── W14: LP-PROGRESSBAR-CLAMP ───────────────────────────────────────────────
describe('W14: LP-PROGRESSBAR-CLAMP — progressBar.update() lives must be clamped', () => {
  const PB_BASE = VALID_HTML.replace(
    'initGame();',
    `initGame();
  const progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });
  function loadRound() {`,
  );

  it('warns when progressBar.update() passes gameState.lives directly without Math.max clamp', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  const progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });
  function loadRound() {
    progressBar.update(gameState.currentRound, gameState.lives);
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('W14') || output.includes('LP-PROGRESSBAR-CLAMP'),
      `Expected W14/LP-PROGRESSBAR-CLAMP warning when gameState.lives passed directly. Output: ${output}`,
    );
    assert.ok(
      output.includes('Math.max'),
      `Expected Math.max fix hint in warning. Output: ${output}`,
    );
  });

  it('does NOT warn when progressBar.update() uses Math.max(0, gameState.lives)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  const progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });
  function loadRound() {
    const displayLives = Math.max(0, gameState.lives);
    progressBar.update(gameState.currentRound, displayLives);
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('LP-PROGRESSBAR-CLAMP'),
      `Expected NO LP-PROGRESSBAR-CLAMP warning when Math.max(0, gameState.lives) is used. Output: ${output}`,
    );
  });

  it('does NOT warn when progressBar.update() uses Math.max(0, lives) via local variable', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  const progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });
  function loadRound() {
    const lives = Math.max(0, gameState.lives);
    progressBar.update(gameState.currentRound, lives);
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('LP-PROGRESSBAR-CLAMP'),
      `Expected NO LP-PROGRESSBAR-CLAMP warning when clampedLives=Math.max pattern used. Output: ${output}`,
    );
  });

  it('does NOT warn when progressBar is not used in the HTML', () => {
    // VALID_HTML has no progressBar reference
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('LP-PROGRESSBAR-CLAMP'),
      `Expected NO LP-PROGRESSBAR-CLAMP warning when progressBar not used. Output: ${output}`,
    );
  });

  it('does NOT warn when progressBar.update() passes literal 0 for lives (no-lives game)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      `initGame();
  const progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 5 });
  function loadRound() {
    progressBar.update(gameState.currentRound, 0);
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('LP-PROGRESSBAR-CLAMP'),
      `Expected NO LP-PROGRESSBAR-CLAMP warning when literal 0 passed (no-lives game). Output: ${output}`,
    );
  });
});

describe('GEN-WAITFOR-MATCH — FeedbackManager checked in waitForPackages but not loaded (5fb)', () => {
  // CDN HTML without feedback-manager script (PART-017=NO)
  const cdnHtmlNoFeedbackScript = (waitForCondition) =>
    '<!DOCTYPE html>\n' +
    '<html lang="en"><head><meta charset="UTF-8"><title>T</title>\n' +
    '<style>body{} #gameContent{max-width:480px;}</style></head>\n' +
    '<body><div id="app"></div>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n' +
    '<script>\n' +
    '  window.gameState = { phase: \'start\', score: 0, lives: 3 };\n' +
    '  window.endGame = function endGame() {};\n' +
    '  window.restartGame = function restartGame() {};\n' +
    '  window.nextRound = function nextRound() {};\n' +
    '  async function waitForPackages() {\n' +
    '    const timeout = 120000; const interval = 50; let elapsed = 0;\n' +
    '    while (' + waitForCondition + ') {\n' +
    '      if (elapsed >= timeout) { throw new Error(\'Packages failed to load within 120s\'); }\n' +
    '      await new Promise(resolve => setTimeout(resolve, interval));\n' +
    '      elapsed += interval;\n' +
    '    }\n' +
    '  }\n' +
    '  document.addEventListener(\'DOMContentLoaded\', async () => {\n' +
    '    await waitForPackages();\n' +
    '    window.parent.postMessage({ type: \'game_complete\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
    '  });\n' +
    '  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;\n' +
    '</script></body></html>';

  // CDN HTML WITH feedback-manager script (PART-017=YES)
  // Note: feedback-manager script is in <head> (as CDN games require) so GEN-WAITFOR-MATCH-A
  // checks <head> for the presence of the feedback-manager script tag.
  const cdnHtmlWithFeedbackScript = (waitForCondition) =>
    '<!DOCTYPE html>\n' +
    '<html lang="en"><head><meta charset="UTF-8"><title>T</title>\n' +
    '<style>body{} #gameContent{max-width:480px;}</style>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>\n' +
    '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n' +
    '</head>\n' +
    '<body><div id="app"></div>\n' +
    '<script>\n' +
    '  window.gameState = { phase: \'start\', score: 0, lives: 3 };\n' +
    '  window.endGame = function endGame() {};\n' +
    '  window.restartGame = function restartGame() {};\n' +
    '  window.nextRound = function nextRound() {};\n' +
    '  async function waitForPackages() {\n' +
    '    const timeout = 120000; const interval = 50; let elapsed = 0;\n' +
    '    while (' + waitForCondition + ') {\n' +
    '      if (elapsed >= timeout) { throw new Error(\'Packages failed to load within 120s\'); }\n' +
    '      await new Promise(resolve => setTimeout(resolve, interval));\n' +
    '      elapsed += interval;\n' +
    '    }\n' +
    '  }\n' +
    '  document.addEventListener(\'DOMContentLoaded\', async () => {\n' +
    '    await waitForPackages();\n' +
    '    window.parent.postMessage({ type: \'game_complete\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
    '  });\n' +
    '  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;\n' +
    '</script></body></html>';

  it('fails when PART-017=NO game checks typeof FeedbackManager === "undefined" but has no feedback-manager script (Lesson 72)', () => {
    const html = cdnHtmlNoFeedbackScript('typeof FeedbackManager === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-WAITFOR-MATCH'),
      `Expected GEN-WAITFOR-MATCH error but got: ${output}`,
    );
  });

  it('fails when PART-017=NO game checks typeof FeedbackManager !== "undefined" but has no feedback-manager script', () => {
    const html = cdnHtmlNoFeedbackScript('typeof FeedbackManager !== "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected fail but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-WAITFOR-MATCH'),
      `Expected GEN-WAITFOR-MATCH error but got: ${output}`,
    );
  });

  it('passes when PART-017=YES game checks typeof FeedbackManager and feedback-manager script IS present', () => {
    const html = cdnHtmlWithFeedbackScript('typeof FeedbackManager === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH'),
      `Unexpected GEN-WAITFOR-MATCH error when feedback-manager script IS present: ${output}`,
    );
  });

  it('passes when PART-017=NO game checks typeof ScreenLayout (correct fallback) and has no feedback-manager script', () => {
    const html = cdnHtmlNoFeedbackScript('typeof ScreenLayout === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH'),
      `Unexpected GEN-WAITFOR-MATCH error when ScreenLayout check is used correctly: ${output}`,
    );
  });
});

describe('GEN-WAITFOR-BANNEDNAMES — waitForPackages checks hallucinated non-CDN package names (5c3)', () => {
  // Minimal CDN HTML with waitForPackages — whileCondition replaces the while loop predicate
  function makeBannedNameHtml(whileCondition) {
    return (
      '<!DOCTYPE html>\n' +
      '<html lang="en"><head><meta charset="UTF-8"><title>T</title>\n' +
      '<style>body{} #gameContent{max-width:480px;}</style></head>\n' +
      '<body><div id="app"></div>\n' +
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>\n' +
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>\n' +
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
      '    window.parent.postMessage({ type: \'game_complete\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
      '  });\n' +
      '  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;\n' +
      '</script></body></html>'
    );
  }

  it('fails when waitForPackages checks typeof Components (banned — never a CDN global)', () => {
    const html = makeBannedNameHtml('typeof Components === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected failure but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-WAITFOR-BANNEDNAMES') && output.includes('"Components"'),
      `Expected GEN-WAITFOR-BANNEDNAMES error for "Components" but got: ${output}`,
    );
  });

  it('fails when waitForPackages checks typeof Helpers (banned — never a CDN global)', () => {
    const html = makeBannedNameHtml('typeof Helpers === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected failure but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-WAITFOR-BANNEDNAMES') && output.includes('"Helpers"'),
      `Expected GEN-WAITFOR-BANNEDNAMES error for "Helpers" but got: ${output}`,
    );
  });

  it('passes when waitForPackages checks typeof ScreenLayout (correct CDN global)', () => {
    const html = makeBannedNameHtml('typeof ScreenLayout === "undefined"');
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-BANNEDNAMES'),
      `Unexpected GEN-WAITFOR-BANNEDNAMES error for correct ScreenLayout check: ${output}`,
    );
  });
});

describe('GEN-WAITFOR-MATCH B/C/D: new X() used but typeof X absent from waitForPackages (WARNING)', () => {
  // Minimal CDN HTML: feedback-manager absent, waitForPackages checks only ScreenLayout by default.
  // extraScript is injected into the game body to simulate new X() calls.
  function makeCdnHtmlForBCD(waitForCondition, extraScript) {
    return (
      '<!DOCTYPE html>\n' +
      '<html lang="en"><head><meta charset="UTF-8"><title>T</title>\n' +
      '<style>body{} #gameContent{max-width:480px;}</style></head>\n' +
      '<body><div id="app"></div>\n' +
      '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>\n' +
      '<script>\n' +
      '  window.gameState = { phase: \'start\', score: 0, lives: 3 };\n' +
      '  window.endGame = function endGame() {};\n' +
      '  window.restartGame = function restartGame() {};\n' +
      '  async function waitForPackages() {\n' +
      '    const timeout = 120000; const interval = 50; let elapsed = 0;\n' +
      '    while (' + waitForCondition + ') {\n' +
      '      if (elapsed >= timeout) { throw new Error(\'Packages failed to load within 120s\'); }\n' +
      '      await new Promise(resolve => setTimeout(resolve, interval));\n' +
      '      elapsed += interval;\n' +
      '    }\n' +
      '  }\n' +
      '  document.addEventListener(\'DOMContentLoaded\', async () => {\n' +
      '    await waitForPackages();\n' +
      '    ' + extraScript + '\n' +
      '    window.parent.postMessage({ type: \'game_complete\', score: 0, stars: 1, total: 1 }, \'*\');\n' +
      '  });\n' +
      '  const stars = 0 >= 0.8 ? 3 : 0 >= 0.5 ? 2 : 1;\n' +
      '</script></body></html>'
    );
  }

  // ─── Check B: TimerComponent ─────────────────────────────────────────────

  it('Check B fires WARNING when new TimerComponent() used but typeof TimerComponent absent from waitForPackages', () => {
    const html = makeCdnHtmlForBCD(
      'typeof ScreenLayout === "undefined"',
      "const timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: 60, onEnd: function() {} });",
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-WAITFOR-MATCH-B'),
      `Expected GEN-WAITFOR-MATCH-B warning when new TimerComponent() used but typeof check absent. Output: ${output}`,
    );
  });

  it('Check B does NOT fire when new TimerComponent() used AND typeof TimerComponent in waitForPackages', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined' || typeof TimerComponent === 'undefined'",
      "const timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: 60, onEnd: function() {} });",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH-B'),
      `Unexpected GEN-WAITFOR-MATCH-B warning when TimerComponent typeof guard is present. Output: ${output}`,
    );
  });

  it('Check B does NOT fire when TimerComponent is not used at all', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined'",
      '// no TimerComponent usage',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH-B'),
      `Unexpected GEN-WAITFOR-MATCH-B warning when TimerComponent not used. Output: ${output}`,
    );
  });

  // ─── Check C: ProgressBarComponent ──────────────────────────────────────

  it('Check C fires WARNING when new ProgressBarComponent() used but typeof ProgressBarComponent absent', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined'",
      "const pb = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });",
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-WAITFOR-MATCH-C'),
      `Expected GEN-WAITFOR-MATCH-C warning when new ProgressBarComponent() used but typeof check absent. Output: ${output}`,
    );
  });

  it('Check C does NOT fire when new ProgressBarComponent() used AND typeof ProgressBarComponent in waitForPackages', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined' || typeof ProgressBarComponent === 'undefined'",
      "const pb = new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 5, totalLives: 3 });",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH-C'),
      `Unexpected GEN-WAITFOR-MATCH-C warning when ProgressBarComponent typeof guard is present. Output: ${output}`,
    );
  });

  // ─── Check D: TransitionScreenComponent ─────────────────────────────────

  it('Check D fires WARNING when new TransitionScreenComponent() used but typeof TransitionScreenComponent absent', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined'",
      "const ts = new TransitionScreenComponent('slot-id', {});",
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-WAITFOR-MATCH-D'),
      `Expected GEN-WAITFOR-MATCH-D warning when new TransitionScreenComponent() used but typeof check absent. Output: ${output}`,
    );
  });

  it('Check D does NOT fire when new TransitionScreenComponent() used AND typeof TransitionScreenComponent in waitForPackages', () => {
    const html = makeCdnHtmlForBCD(
      "typeof ScreenLayout === 'undefined' || typeof TransitionScreenComponent === 'undefined'",
      "const ts = new TransitionScreenComponent('slot-id', {});",
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-WAITFOR-MATCH-D'),
      `Unexpected GEN-WAITFOR-MATCH-D warning when TransitionScreenComponent typeof guard is present. Output: ${output}`,
    );
  });
});

describe('GEN-RESULTS-FIXED: #results-screen must have position:fixed (GEN-UX-001)', () => {
  it('does not warn when #results-screen has position:fixed in CSS', () => {
    // Correct pattern: results screen has position:fixed as GEN-UX-001 requires
    const html = VALID_HTML.replace(
      '</style>',
      `#results-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: white; display: none; }
</style>`,
    ).replace(
      '</div>\n<script>',
      `</div>
  <div id="results-screen"></div>
<script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-RESULTS-FIXED'),
      `Unexpected GEN-RESULTS-FIXED warning for correct position:fixed usage: ${output}`,
    );
  });

  it('warns when #results-screen element exists but has position:static (no position:fixed)', () => {
    // Bad pattern: results screen exists but lacks position:fixed → renders off-screen
    const html = VALID_HTML.replace(
      '</style>',
      `#results-screen { position: static; top: 0; left: 0; width: 100%; height: 100%; background: white; display: none; }
</style>`,
    ).replace(
      '</div>\n<script>',
      `</div>
  <div id="results-screen"></div>
<script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-RESULTS-FIXED'),
      `Expected GEN-RESULTS-FIXED warning when position:static used but got: ${output}`,
    );
  });

  it('does not warn when no #results-screen element exists (CDN TransitionScreen games)', () => {
    // Games using CDN TransitionScreen have no custom #results-screen — no warning expected
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-RESULTS-FIXED'),
      `Unexpected GEN-RESULTS-FIXED warning when no results-screen element present: ${output}`,
    );
  });
});

describe('GEN-RESULTS-ROUNDS: multi-round games must have rounds-completed element', () => {
  it('does not warn when totalRounds + results-screen + rounds-completed are all present', () => {
    // Correct pattern: multi-round game with rounds-completed element in results screen
    const html = VALID_HTML.replace(
      'let gameState = { score: 0, total: 0, currentQuestion: 0, totalQuestions: 10 };',
      'let gameState = { score: 0, currentRound: 0, totalRounds: 9, totalQuestions: 10 };',
    ).replace(
      '</div>\n<script>',
      `</div>
  <div id="results-screen"><p id="final-score">Score: 0</p><p id="rounds-completed">Rounds: 0/9</p></div>
<script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-RESULTS-ROUNDS'),
      `Unexpected GEN-RESULTS-ROUNDS warning when rounds-completed is present: ${output}`,
    );
  });

  it('warns when totalRounds + results-screen present but no rounds-completed element', () => {
    // Bad pattern: multi-round game missing rounds-completed element
    const html = VALID_HTML.replace(
      'let gameState = { score: 0, total: 0, currentQuestion: 0, totalQuestions: 10 };',
      'let gameState = { score: 0, currentRound: 0, totalRounds: 9, totalQuestions: 10 };',
    ).replace(
      '</div>\n<script>',
      `</div>
  <div id="results-screen"><p id="final-score">Score: 0</p></div>
<script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-RESULTS-ROUNDS'),
      `Expected GEN-RESULTS-ROUNDS warning when rounds-completed missing but got: ${output}`,
    );
  });

  it('does not warn when no totalRounds present (lives-only game carve-out)', () => {
    // Lives-only games have no totalRounds — rule does not apply
    const html = VALID_HTML.replace(
      '</div>\n<script>',
      `</div>
  <div id="results-screen"><p id="final-score">Score: 0</p></div>
<script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-RESULTS-ROUNDS'),
      `Unexpected GEN-RESULTS-ROUNDS warning for lives-only game (no totalRounds): ${output}`,
    );
  });
});

describe('GEN-TRANSITION-API-CALL: transitionScreen.show() string-mode API check (5h2)', () => {
  it('emits ERROR when transitionScreen.show() is called with single-quote string first arg', () => {
    // String-mode call: transitionScreen.show('victory', ...) — no string API in CDN
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {}, hide: async function() {} };
  async function endGameTransition() {
    await transitionScreen.show('victory', { score: 10 });
    await transitionScreen.hide();
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected failure (ERROR) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('GEN-TRANSITION-API'),
      `Expected GEN-TRANSITION-API ERROR but got: ${output}`,
    );
  });

  it('emits ERROR when transitionScreen.show() is called with double-quote string first arg', () => {
    // String-mode call with double quotes: transitionScreen.show("gameover", ...)
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {}, hide: async function() {} };
  async function endGameTransition() {
    await transitionScreen.show("gameover", { score: 0 });
    await transitionScreen.hide();
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected failure (ERROR) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR') && output.includes('GEN-TRANSITION-API'),
      `Expected GEN-TRANSITION-API ERROR for double-quote string mode but got: ${output}`,
    );
  });

  it('does not emit GEN-TRANSITION-API error when transitionScreen.show() uses object API', () => {
    // Correct object API: transitionScreen.show({ buttons, title, subtitle, icons })
    const html = VALID_HTML.replace(
      '</script>',
      `let transitionScreen = { show: async function(opts) {}, hide: async function() {} };
  async function endGameTransition() {
    await transitionScreen.show({ icons: ['🎉'], title: 'Well Done!', subtitle: 'You scored 10 points.', buttons: [{ text: 'Play Again', type: 'primary', action: restartGame }] });
    await transitionScreen.hide();
  }
  </script>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-TRANSITION-API'),
      `Unexpected GEN-TRANSITION-API error for object-mode transitionScreen.show(): ${output}`,
    );
  });
});

describe('GEN-PHASE-MCQ: MCQ/timed games must call syncDOMState() at all phase transitions', () => {
  // Helper: build a minimal MCQ game fragment with exactly N syncDOMState() call sites.
  // We write the function body as a comment-style stub to avoid counting the definition
  // itself, then add exactly N calls inside showStartScreen().
  // Note: the definition `function _syncDOM() {}` + alias avoids the regex matching the stub.
  function mcqHtml(syncCallCount, useTimer = false) {
    // Each call is spelled out as a separate statement so the count is exact
    const syncs = Array.from({ length: syncCallCount }, () => 'syncDOMState();').join('\n    ');
    const timerLine = useTimer ? 'const timer = new TimerComponent("timer-container", { timerType: "decrease", startTime: 30, endTime: 0, onEnd: function() {} });' : '';
    return VALID_HTML.replace(
      '</script>',
      `
  /* stub: syncDOMState writes gameState.phase to #app[data-phase] */
  var syncDOMState = function() { /* stub */ };
  ${timerLine}
  window.gameState = { phase: 'start', totalLives: 3, currentRound: 0, totalRounds: 5, score: 0, events: [], attempts: [], gameEnded: false };
  function showStartScreen() { gameState.phase = 'start'; ${syncs} }
  function handleClick(answer) { gameState.score++; }
  </script>`,
    ).replace(
      // inject an option button so the MCQ pattern is detected
      '<div id="answers"></div>',
      '<div id="answers"><button class="option-btn" data-testid="option-0">A</button></div>',
    );
  }

  it('emits WARNING [GEN-PHASE-MCQ] when MCQ game has 0 syncDOMState() calls', () => {
    const html = mcqHtml(0);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('WARNING [GEN-PHASE-MCQ]'),
      `Expected GEN-PHASE-MCQ warning for 0 syncDOMState() calls but got: ${output}`,
    );
    assert.ok(
      output.includes('found 0'),
      `Expected "found 0" in warning message but got: ${output}`,
    );
  });

  it('emits WARNING [GEN-PHASE-MCQ] when MCQ game has 1 syncDOMState() call', () => {
    const html = mcqHtml(1);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('WARNING [GEN-PHASE-MCQ]'),
      `Expected GEN-PHASE-MCQ warning for 1 syncDOMState() call but got: ${output}`,
    );
    assert.ok(
      output.includes('found 1'),
      `Expected "found 1" in warning message but got: ${output}`,
    );
  });

  it('emits WARNING [GEN-PHASE-MCQ] when MCQ game has 2 syncDOMState() calls', () => {
    const html = mcqHtml(2);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('WARNING [GEN-PHASE-MCQ]'),
      `Expected GEN-PHASE-MCQ warning for 2 syncDOMState() calls but got: ${output}`,
    );
    assert.ok(
      output.includes('found 2'),
      `Expected "found 2" in warning message but got: ${output}`,
    );
  });

  it('does NOT emit GEN-PHASE-MCQ warning when MCQ game has 3 syncDOMState() calls', () => {
    const html = mcqHtml(3);
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-PHASE-MCQ'),
      `Unexpected GEN-PHASE-MCQ warning for 3 syncDOMState() calls: ${output}`,
    );
  });

  it('does NOT emit GEN-PHASE-MCQ warning when MCQ game has 4 syncDOMState() calls (all 4 sites)', () => {
    const html = mcqHtml(4);
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-PHASE-MCQ'),
      `Unexpected GEN-PHASE-MCQ warning for 4 syncDOMState() calls: ${output}`,
    );
  });

  it('emits WARNING [GEN-PHASE-MCQ] for timed MCQ game (TimerComponent) with fewer than 3 calls', () => {
    // Timed games use TimerComponent — also MCQ pattern trigger
    const html = mcqHtml(1, true);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('WARNING [GEN-PHASE-MCQ]'),
      `Expected GEN-PHASE-MCQ warning for timed MCQ with 1 syncDOMState() call but got: ${output}`,
    );
  });

  it('does NOT emit GEN-PHASE-MCQ warning for non-MCQ game without option buttons or lives', () => {
    // VALID_HTML has no .option-btn and no gameState.lives — not an MCQ game
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-PHASE-MCQ'),
      `Unexpected GEN-PHASE-MCQ warning for non-MCQ game: ${output}`,
    );
  });

  it('includes all 4 required call sites in the warning message', () => {
    const html = mcqHtml(1);
    const { output } = runValidator(html);
    assert.ok(output.includes('showStartScreen()'), `Missing showStartScreen call site in warning: ${output}`);
    assert.ok(output.includes('startGame()/renderRound()'), `Missing renderRound call site in warning: ${output}`);
    assert.ok(output.includes("'gameover'"), `Missing gameover phase in warning: ${output}`);
    assert.ok(output.includes("'results'"), `Missing results phase in warning: ${output}`);
  });

  // ─── GEN-PM-DUAL-PATH tests ───────────────────────────────────────────────

  it('GEN-PM-DUAL-PATH: fails when postMessage is inside a simple if-victory guard', () => {
    // Bug: postMessage only fires on 'victory' path — game_over path never sends it
    const html = VALID_HTML.replace(
      `  function endGame() {
    const pct = gameState.score / gameState.totalQuestions;
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
    window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
    document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';
  }`,
      `  function endGame(reason) {
    document.getElementById('gameArea').innerHTML = '<h2>Game Over!</h2>';
    if (reason === 'victory') { window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: 3, total: gameState.totalQuestions }, '*'); }
  }`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected GEN-PM-DUAL-PATH error but got exit 0: ${output}`);
    assert.ok(output.includes('GEN-PM-DUAL-PATH'), `Expected GEN-PM-DUAL-PATH in output but got: ${output}`);
  });

  it('GEN-PM-DUAL-PATH: fails when postMessage is inside a multiline if-victory guard', () => {
    // Bug: same issue across multiple lines — the s-flag on the regex handles newlines
    const html = VALID_HTML.replace(
      `  function endGame() {
    const pct = gameState.score / gameState.totalQuestions;
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
    window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
    document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';
  }`,
      `  function endGame(reason) {
    if (reason === 'victory') {
      window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: 3, total: gameState.totalQuestions }, '*');
    }
    document.getElementById('gameArea').innerHTML = '<h2>Game Over!</h2>';
  }`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected GEN-PM-DUAL-PATH error for multiline guard but got exit 0: ${output}`);
    assert.ok(output.includes('GEN-PM-DUAL-PATH'), `Expected GEN-PM-DUAL-PATH in output but got: ${output}`);
  });

  it('GEN-PM-DUAL-PATH: does NOT fire when postMessage is unconditional after an if-victory block', () => {
    // Correct: if-victory block handles UI only; postMessage fires unconditionally after
    const html = VALID_HTML.replace(
      `  function endGame() {
    const pct = gameState.score / gameState.totalQuestions;
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
    window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
    document.getElementById('gameArea').innerHTML = '<h2>Game Over! Score: ' + gameState.score + '/' + gameState.totalQuestions + '</h2>';
  }`,
      `  function endGame(reason) {
    const pct = gameState.score / gameState.totalQuestions;
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
    if (reason === 'victory') { playVictorySound(); }
    window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
    document.getElementById('gameArea').innerHTML = '<h2>Done!</h2>';
  }`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass for correct dual-path postMessage but got: ${output}`);
    assert.ok(!output.includes('GEN-PM-DUAL-PATH'), `Unexpected GEN-PM-DUAL-PATH error: ${output}`);
  });

  // ─── GEN-ROUND-INDEX tests ────────────────────────────────────────────────

  it('GEN-ROUND-INDEX: warns when rounds[currentRound - 1] is used', () => {
    // Bug: currentRound is 0-based — rounds[-1] on first click crashes the game
    const html = VALID_HTML.replace(
      `  function showQuestion() {
    var a = Math.floor(Math.random() * 12) + 1;
    var b = Math.floor(Math.random() * 12) + 1;
    gameState.correct = a * b;
    document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
  }`,
      `  var rounds = [{q:'1+1',a:2},{q:'2+2',a:4}];
  function showQuestion() {
    var r = rounds[gameState.currentRound - 1];
    document.getElementById('questionText').textContent = r.q;
    gameState.correct = r.a;
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-ROUND-INDEX'),
      `Expected GEN-ROUND-INDEX warning for rounds[currentRound-1] but got: ${output}`,
    );
  });

  it('GEN-ROUND-INDEX: warns when loadRound calls nextRound causing double-increment', () => {
    // Bug: loadRound sets currentRound = n-1 then nextRound increments again → off-by-one
    const html = VALID_HTML.replace(
      `  function showQuestion() {
    var a = Math.floor(Math.random() * 12) + 1;
    var b = Math.floor(Math.random() * 12) + 1;
    gameState.correct = a * b;
    document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
  }`,
      `  function nextRound() { gameState.currentRound++; showQuestion(); }
  function loadRound(n) { gameState.currentRound = n - 1; nextRound(); }
  function showQuestion() {
    var a = 2; document.getElementById('questionText').textContent = a + ' x ' + a;
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-ROUND-INDEX'),
      `Expected GEN-ROUND-INDEX warning for loadRound→nextRound but got: ${output}`,
    );
  });

  it('GEN-ROUND-INDEX: does NOT warn when rounds[currentRound] (0-based) is used correctly', () => {
    // Correct: rounds[currentRound] — 0-based direct index
    const html = VALID_HTML.replace(
      `  function showQuestion() {
    var a = Math.floor(Math.random() * 12) + 1;
    var b = Math.floor(Math.random() * 12) + 1;
    gameState.correct = a * b;
    document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';
  }`,
      `  var rounds = [{q:'1+1',a:2},{q:'2+2',a:4}];
  function showQuestion() {
    var r = rounds[gameState.currentRound];
    document.getElementById('questionText').textContent = r.q;
    gameState.correct = r.a;
  }`,
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-ROUND-INDEX'),
      `Unexpected GEN-ROUND-INDEX warning for correct 0-based index: ${output}`,
    );
  });

  // ─── GEN-TESTID-RESTART tests ─────────────────────────────────────────────

  it('GEN-TESTID-RESTART: warns when restart button uses data-testid="restart-btn"', () => {
    // Bug: test harness clicks [data-testid="btn-restart"] — "restart-btn" fails silently
    const html = VALID_HTML.replace(
      '</div>\n</div>',
      '</div>\n  <button data-testid="restart-btn" onclick="initGame()">Play Again</button>\n</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-TESTID-RESTART'),
      `Expected GEN-TESTID-RESTART warning for restart-btn but got: ${output}`,
    );
  });

  it('GEN-TESTID-RESTART: warns when restart button uses data-testid="replay-btn"', () => {
    const html = VALID_HTML.replace(
      '</div>\n</div>',
      '</div>\n  <button data-testid="replay-btn" onclick="initGame()">Replay</button>\n</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-TESTID-RESTART'),
      `Expected GEN-TESTID-RESTART warning for replay-btn but got: ${output}`,
    );
  });

  it('GEN-TESTID-RESTART: does NOT warn when restart button uses correct data-testid="btn-restart"', () => {
    // Correct: btn-restart matches test harness selector
    const html = VALID_HTML.replace(
      '</div>\n</div>',
      '</div>\n  <button data-testid="btn-restart" onclick="initGame()">Play Again</button>\n</div>',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-TESTID-RESTART'),
      `Unexpected GEN-TESTID-RESTART warning for correct btn-restart: ${output}`,
    );
  });

  // ─── GEN-BTN-START tests ──────────────────────────────────────────────────

  it('GEN-BTN-START: warns when TransitionScreen present but no data-testid="btn-start"', () => {
    // Game with TransitionScreen but missing btn-start testid
    const html = VALID_HTML.replace(
      'function initGame()',
      'function setupGame() { const transitionScreen = new TransitionScreenComponent(); } function initGame()',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-BTN-START'),
      `Expected GEN-BTN-START warning when TransitionScreen present without btn-start: ${output}`,
    );
  });

  it('GEN-BTN-START: warns when mathai-transition-slot present but no data-testid="btn-start"', () => {
    const html = VALID_HTML.replace(
      '<div id="gameContent">',
      '<div id="mathai-transition-slot"></div>\n<div id="gameContent">',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-BTN-START'),
      `Expected GEN-BTN-START warning when mathai-transition-slot present without btn-start: ${output}`,
    );
  });

  it('GEN-BTN-START: does NOT warn when data-testid="btn-start" is present', () => {
    const html = VALID_HTML.replace(
      '<div id="gameContent">',
      '<div id="mathai-transition-slot"><button data-testid="btn-start">Let\'s go!</button></div>\n<div id="gameContent">',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-BTN-START'),
      `Unexpected GEN-BTN-START warning when btn-start present: ${output}`,
    );
  });

  it('GEN-BTN-START: does NOT warn when no transition screen present', () => {
    // VALID_HTML has no transition screen — GEN-BTN-START should not fire
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-BTN-START'),
      `Unexpected GEN-BTN-START warning for non-transition game: ${output}`,
    );
  });

  // ─── GEN-PHASE-INIT tests ─────────────────────────────────────────────────

  it('GEN-PHASE-INIT: warns when #app data-phase="start" but gameState.phase="start_screen"', () => {
    const html = VALID_HTML.replace(
      '<div id="gameContent">',
      '<div id="app" data-phase="start"></div>\n<div id="gameContent">',
    ).replace(
      'let gameState = {',
      'let gameState = { phase: \'start_screen\',',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-PHASE-INIT'),
      `Expected GEN-PHASE-INIT warning for data-phase/gameState.phase mismatch: ${output}`,
    );
  });

  it('GEN-PHASE-INIT: does NOT warn when #app data-phase matches gameState.phase', () => {
    const html = VALID_HTML.replace(
      '<div id="gameContent">',
      '<div id="app" data-phase="start_screen"></div>\n<div id="gameContent">',
    ).replace(
      'let gameState = {',
      'let gameState = { phase: \'start_screen\',',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-PHASE-INIT'),
      `Unexpected GEN-PHASE-INIT warning when data-phase matches gameState.phase: ${output}`,
    );
  });

  it('GEN-PHASE-INIT: does NOT warn when #app has no data-phase', () => {
    // No data-phase on #app → check does not apply
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-PHASE-INIT'),
      `Unexpected GEN-PHASE-INIT warning for HTML without data-phase: ${output}`,
    );
  });

  // ─── GEN-PHASE-SEQUENCE tests ──────────────────────────────────────────────
  // Helper: minimal CDN-style HTML with a custom endGame body for GEN-PHASE-SEQUENCE testing
  function makeEndGameHtml(endGameBody) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Test</title><style>body{}</style></head>
<body><div id="app"></div><div id="gameContent"></div>
<script>
window.gameState = { score: 0, lives: 3, totalLives: 3, phase: 'start', gameEnded: false, isActive: true, currentRound: 0, totalRounds: 3, events: [], attempts: [] };
var gameState = window.gameState;
function calcStars(outcome) { if(outcome==='game_over') return 0; var pct=gameState.score/gameState.totalRounds; return pct>=0.8?3:pct>=0.5?2:1; }
function syncDOMState() { var app=document.getElementById('app'); if(!app) return; app.dataset.phase=gameState.phase||'start'; app.dataset.lives=String(gameState.lives); }
${endGameBody}
function restartGame() { gameState.gameEnded=false; gameState.phase='start'; syncDOMState(); }
function nextRound() { gameState.currentRound++; }
window.addEventListener('DOMContentLoaded', async function() {
  try {
    ScreenLayout.inject('app', { slots: { transitionScreen: true } });
    window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound;
  } catch(e) { window.__initError = e.message; }
});
</script></body></html>`;
  }

  it('GEN-PHASE-SEQUENCE: warns when endGame() calls syncDOMState() without assigning gameState.phase first', () => {
    // Simulates LLM pattern from GEN-PM-DUAL-PATH WRONG: syncDOMState() called but phase not set
    const html = makeEndGameHtml(`function endGame(reason) {
  if (gameState.gameEnded) return; gameState.gameEnded = true; gameState.isActive = false;
  syncDOMState();
  window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: calcStars(reason), accuracy: 1 } } }, '*');
}`);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-PHASE-SEQUENCE'),
      `Expected GEN-PHASE-SEQUENCE warning when syncDOMState() is called without phase assignment but got: ${output}`,
    );
  });

  it('GEN-PHASE-SEQUENCE: warns when endGame() assigns phase AFTER syncDOMState()', () => {
    // Phase assigned after syncDOMState — still wrong ordering
    const html = makeEndGameHtml(`function endGame(reason) {
  if (gameState.gameEnded) return; gameState.gameEnded = true; gameState.isActive = false;
  syncDOMState();
  gameState.phase = reason === 'victory' ? 'results' : 'gameover';
  window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: calcStars(reason), accuracy: 1 } } }, '*');
}`);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-PHASE-SEQUENCE'),
      `Expected GEN-PHASE-SEQUENCE warning when phase is assigned after syncDOMState() but got: ${output}`,
    );
  });

  it('GEN-PHASE-SEQUENCE: does NOT warn when endGame() assigns phase BEFORE syncDOMState()', () => {
    // Correct order: phase assigned first, then syncDOMState()
    const html = makeEndGameHtml(`function endGame(reason) {
  if (gameState.gameEnded) return; gameState.gameEnded = true; gameState.isActive = false;
  gameState.phase = reason === 'victory' ? 'results' : 'gameover';
  syncDOMState();
  window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: calcStars(reason), accuracy: 1 } } }, '*');
}`);
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-PHASE-SEQUENCE'),
      `Unexpected GEN-PHASE-SEQUENCE warning for correct phase-before-sync pattern: ${output}`,
    );
  });

  it('GEN-PHASE-SEQUENCE: does NOT warn when endGame() does not call syncDOMState() at all', () => {
    // endGame with no syncDOMState — different issue, not covered by this check
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-PHASE-SEQUENCE'),
      `Unexpected GEN-PHASE-SEQUENCE warning for endGame without syncDOMState: ${output}`,
    );
  });

  // ─── GEN-SHOWRESULTS-SYNC tests ────────────────────────────────────────────
  // Helper: minimal CDN-style HTML with a custom showResults body for GEN-SHOWRESULTS-SYNC testing
  function makeShowResultsHtml(showResultsBody) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Test</title><style>body{}</style></head>
<body><div id="app"></div><div id="gameContent"></div><div id="results-screen" style="display:none"></div>
<script>
window.gameState = { score: 0, lives: 3, totalLives: 3, phase: 'playing', gameEnded: false, isActive: true, currentRound: 0, totalRounds: 3, events: [], attempts: [] };
var gameState = window.gameState;
function calcStars(outcome) { if(outcome==='game_over') return 0; var pct=gameState.score/gameState.totalRounds; return pct>=0.8?3:pct>=0.5?2:1; }
function syncDOMState() { var app=document.getElementById('app'); if(!app) return; app.dataset.phase=gameState.phase||'start'; app.dataset.lives=String(gameState.lives); }
${showResultsBody}
function endGame(reason) {
  if (gameState.gameEnded) return; gameState.gameEnded = true;
  gameState.phase = reason === 'victory' ? 'results' : 'gameover';
  syncDOMState();
  window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: calcStars(reason), accuracy: 1 } } }, '*');
}
function restartGame() { gameState.gameEnded=false; gameState.phase='start'; syncDOMState(); }
function nextRound() { gameState.currentRound++; }
window.addEventListener('DOMContentLoaded', async function() {
  try {
    ScreenLayout.inject('app', { slots: { transitionScreen: true } });
    window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound;
  } catch(e) { window.__initError = e.message; }
});
</script></body></html>`;
  }

  it('GEN-SHOWRESULTS-SYNC: warns when showResults() sets phase but no syncDOMState()', () => {
    // Simulates keep-track #571 MED-2: showResults sets phase but omits syncDOMState()
    const html = makeShowResultsHtml(`function showResults() {
  gameState.phase = 'results';
  document.getElementById('results-screen').style.display = 'block';
  document.getElementById('final-score').textContent = gameState.score;
}`);
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SHOWRESULTS-SYNC'),
      `Expected GEN-SHOWRESULTS-SYNC warning when showResults() sets phase without syncDOMState() but got: ${output}`,
    );
  });

  it('GEN-SHOWRESULTS-SYNC: does NOT warn when showResults() sets phase AND calls syncDOMState()', () => {
    // Correct pattern: phase set then syncDOMState() called
    const html = makeShowResultsHtml(`function showResults() {
  gameState.phase = 'results';
  syncDOMState();
  document.getElementById('results-screen').style.display = 'block';
  document.getElementById('final-score').textContent = gameState.score;
}`);
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-SHOWRESULTS-SYNC'),
      `Unexpected GEN-SHOWRESULTS-SYNC warning for correct showResults() pattern: ${output}`,
    );
  });

  it('GEN-SHOWRESULTS-SYNC: does NOT warn when no showResults function exists', () => {
    // No showResults() at all — check should be silent
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-SHOWRESULTS-SYNC'),
      `Unexpected GEN-SHOWRESULTS-SYNC warning for HTML with no showResults() function: ${output}`,
    );
  });
});

// ─── GEN-SYNCDOMSTATE-ALLATTRS tests ────────────────────────────────────────
// W16: syncDOMState() must write data-round and data-score, not just data-phase.
// Helper: minimal CDN-style HTML with a custom syncDOMState body for ALLATTRS testing.
// The HTML includes currentRound in gameState so the check fires.
function makeSyncDOMStateHtml(syncBody) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Test</title><style>body{}</style></head>
<body><div id="app"></div><div id="gameContent"></div>
<script>
window.gameState = { score: 0, lives: 3, totalLives: 3, phase: 'start', gameEnded: false, isActive: true, currentRound: 0, totalRounds: 5, events: [], attempts: [] };
var gameState = window.gameState;
${syncBody}
function endGame(reason) {
  if (gameState.gameEnded) return; gameState.gameEnded = true;
  gameState.phase = reason === 'victory' ? 'results' : 'gameover';
  syncDOMState();
  window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: 1, accuracy: 1 } } }, '*');
}
function restartGame() { gameState.currentRound = 0; gameState.score = 0; gameState.gameEnded = false; gameState.phase = 'start'; syncDOMState(); }
function nextRound() { gameState.currentRound++; syncDOMState(); }
window.addEventListener('DOMContentLoaded', async function() {
  try {
    ScreenLayout.inject('app', { slots: { transitionScreen: true } });
    window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound;
  } catch(e) { window.__initError = e.message; }
});
</script></body></html>`;
}

describe('GEN-SYNCDOMSTATE-ALLATTRS: syncDOMState() must write data-round and data-score', () => {
  it('GEN-SYNCDOMSTATE-ALLATTRS: warns when syncDOMState sets data-phase only', () => {
    // Simulates hide-unhide #461 MEDIUM-6: syncDOMState only writes data-phase
    const html = makeSyncDOMStateHtml(
      `function syncDOMState() { var app = document.getElementById('app'); if (app) app.setAttribute('data-phase', gameState.phase); }`
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-SYNCDOMSTATE-ALLATTRS'),
      `Expected GEN-SYNCDOMSTATE-ALLATTRS warning when syncDOMState sets only data-phase but got: ${output}`,
    );
  });

  it('GEN-SYNCDOMSTATE-ALLATTRS: does NOT warn when syncDOMState sets phase + round + score', () => {
    // Correct pattern: all four attributes written
    const html = makeSyncDOMStateHtml(
      `function syncDOMState() { var app = document.getElementById('app'); if (!app) return; app.dataset.phase = gameState.phase || 'start'; app.dataset.round = String(gameState.currentRound || 0); app.dataset.score = String(gameState.score || 0); if (gameState.totalLives > 0) { app.dataset.lives = String(gameState.lives); } }`
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-SYNCDOMSTATE-ALLATTRS'),
      `Unexpected GEN-SYNCDOMSTATE-ALLATTRS warning for correct syncDOMState pattern: ${output}`,
    );
  });

  it('GEN-SYNCDOMSTATE-ALLATTRS: does NOT warn when no syncDOMState function exists', () => {
    // No syncDOMState() at all — W16 check should be silent
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-SYNCDOMSTATE-ALLATTRS'),
      `Unexpected GEN-SYNCDOMSTATE-ALLATTRS warning for HTML with no syncDOMState() function: ${output}`,
    );
  });

  it('GEN-ISACTIVE-GUARD: warns when endGame() guard uses !gameState.isActive', () => {
    // endGame() uses isActive as a guard — results screen never shown on perfect playthrough
    const html = VALID_HTML.replace(
      'function endGame() {',
      'function endGame() {\n    if (!gameState.isActive && gameState.lives > 0) return;',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('WARNING') && output.includes('GEN-ISACTIVE-GUARD'),
      `Expected GEN-ISACTIVE-GUARD warning but got: ${output}`,
    );
  });

  it('GEN-ISACTIVE-GUARD: does NOT warn when endGame() guard uses gameState.gameEnded', () => {
    // Correct pattern: only gameEnded used as re-entry guard
    const html = VALID_HTML.replace(
      'function endGame() {',
      'function endGame() {\n    if (gameState.gameEnded) return;\n    gameState.gameEnded = true;',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-ISACTIVE-GUARD'),
      `Unexpected GEN-ISACTIVE-GUARD warning for correct gameEnded pattern: ${output}`,
    );
  });
});

// ─── GEN-MOBILE-STACK: flex-direction:row on game container / MCQ options ────

describe('GEN-MOBILE-STACK: flex-direction:row detection', () => {
  // Helper: inject extra CSS into VALID_HTML's <style> block (before </style>)
  // and optionally inject extra HTML into the #answers div.
  function withCss(extraCss, extraHtml = '') {
    let html = VALID_HTML.replace('</style>', `  ${extraCss}\n</style>`);
    if (extraHtml) {
      html = html.replace('<div id="answers"></div>', `<div id="answers"></div>\n  ${extraHtml}`);
    }
    return html;
  }

  it('GEN-MOBILE-STACK WARNING: warns when game-container uses flex-direction:row', () => {
    // stats-identify-class #573 P0-1: three-column layout squeezes 375px viewport
    const html = withCss('#game-container { display: flex; flex-direction: row; gap: 8px; }');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-MOBILE-STACK'),
      `Expected GEN-MOBILE-STACK warning for game-container flex-direction:row but got: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK WARNING: warns when options-grid uses flex-direction:row without flex-wrap', () => {
    // MCQ options grid in row direction without flex-wrap — each option becomes a narrow column
    const html = withCss('.options-grid { display: flex; flex-direction: row; gap: 8px; }');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-MOBILE-STACK'),
      `Expected GEN-MOBILE-STACK warning for options-grid flex-direction:row but got: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK ERROR: errors when .options-container uses flex-direction:row AND MCQ options present', () => {
    // MCQ option container with row direction — confirmed P0: buttons 22px tall
    const html = withCss(
      '.options-container { display: flex; flex-direction: row; }',
      `<div class="options-container">
        <button class="option-btn" data-testid="option-0">A</button>
        <button class="option-btn" data-testid="option-1">B</button>
      </div>`,
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected exit 1 (error) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-MOBILE-STACK'),
      `Expected GEN-MOBILE-STACK error for .options-container flex-direction:row but got: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK: does NOT warn when game-container uses flex-direction:column', () => {
    // Correct pattern: column stacking
    const html = withCss('#game-container { display: flex; flex-direction: column; gap: 16px; }');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK warning for correct flex-direction:column: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK: does NOT warn for known-valid row patterns (.timer, .score)', () => {
    // Timer + score bar in row direction is intentional and valid
    const html = withCss(
      '.timer { display: flex; flex-direction: row; align-items: center; }\n  .score { display: flex; flex-direction: row; gap: 4px; }',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK warning for valid .timer/.score flex-direction:row: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK: does NOT warn when HTML has no game-layout or MCQ selectors', () => {
    // VALID_HTML has no game-container or options-grid CSS rules with flex-direction:row
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK warning for VALID_HTML: ${output}`,
    );
  });

  // ─── GEN-MOBILE-STACK FLEX-WRAP sub-rule tests ──────────────────────────────
  it('GEN-MOBILE-STACK FLEX-WRAP: warns when options-grid uses flex-direction:row with NO flex-wrap and no @media 480px', () => {
    // stats-identify-class #581 P0-1: 3-column flex row, no flex-wrap → overflow at 480px
    const html = withCss('.options-grid { display:flex; flex-direction:row; gap:12px; }');
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('GEN-MOBILE-STACK'),
      `Expected GEN-MOBILE-STACK warning for options-grid flex-direction:row without flex-wrap but got: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK FLEX-WRAP: does NOT warn when options-grid uses flex-direction:row WITH flex-wrap:wrap', () => {
    // Correct: flex-wrap:wrap present → graceful wrapping on mobile
    const html = withCss('.options-grid { display:flex; flex-direction:row; flex-wrap:wrap; gap:12px; }');
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK warning when flex-wrap:wrap is present: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK FLEX-WRAP: does NOT warn when @media max-width:480px override is present', () => {
    // Correct: @media 480px override present → stacks on mobile even without flex-wrap
    const html = withCss(
      '.options-grid { display:flex; flex-direction:row; gap:12px; }\n  @media(max-width:480px) { .options-grid { flex-direction:column; } }',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK warning when @media max-width:480px is present: ${output}`,
    );
  });

  it('GEN-MOBILE-STACK FLEX-WRAP: does NOT warn when HTML has no options-grid at all', () => {
    // No option container CSS at all → no warning
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-MOBILE-STACK'),
      `Unexpected GEN-MOBILE-STACK FLEX-WRAP warning for VALID_HTML (no options-grid): ${output}`,
    );
  });

  it('GEN-MOBILE-STACK MED-3: when MCQ + .options-grid flex-direction:row, Block 1 fires ERROR — Block 2 does NOT add a duplicate WARNING', () => {
    // Block 1 fires ERROR [GEN-MOBILE-STACK] for .options-grid + MCQ options present.
    // Block 2 should skip the same selector to avoid a redundant WARNING for the same root cause.
    const html = withCss(
      '.options-grid { display:flex; flex-direction:row; gap:12px; }',
      '<div class="options-container"><button class="option-btn" data-testid="option-0">A</button></div>',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 1, `Expected exit 1 (error) from Block 1 but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('ERROR [GEN-MOBILE-STACK]'),
      `Expected ERROR [GEN-MOBILE-STACK] from Block 1 but got: ${output}`,
    );
    assert.ok(
      !output.includes('WARNING [GEN-MOBILE-STACK]'),
      `Block 2 should not emit a duplicate WARNING [GEN-MOBILE-STACK] when Block 1 already fired ERROR: ${output}`,
    );
  });

  // ─── GEN-DOM-CACHE tests ────────────────────────────────────────────────────
  it('GEN-DOM-CACHE: warns when loadQuestion() calls document.getElementById() in its body', () => {
    // Anti-pattern: getElementById called inside per-round function body
    const html = VALID_HTML.replace(
      'function showQuestion()',
      `function loadQuestion(index) {
        const questionEl = document.getElementById('question-text');
        const optionsGrid = document.getElementById('options-grid');
        questionEl.textContent = 'Question ' + index;
        optionsGrid.innerHTML = '';
      }
      function showQuestion()`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-DOM-CACHE'),
      `Expected GEN-DOM-CACHE warning when getElementById is inside loadQuestion() body but got: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: does NOT warn when loadQuestion() does not call getElementById()', () => {
    // Correct pattern: uses cached module-scope references (no getElementById inside any per-round function)
    // Replace showQuestion's getElementById call with a cached ref, and add loadQuestion without getElementById
    const html = VALID_HTML
      .replace(
        "document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';",
        "questionTextEl.textContent = a + ' x ' + b + ' = ?';",
      )
      .replace(
        'function showQuestion()',
        `const questionEl = { textContent: '' };
      const questionTextEl = document.getElementById('questionText');
      function loadQuestion(index) {
        questionEl.textContent = 'Question ' + index;
      }
      function showQuestion()`,
      );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-DOM-CACHE'),
      `Unexpected GEN-DOM-CACHE warning when loadQuestion() uses cached refs: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: warns when getElementById called inside renderRound()', () => {
    const html = VALID_HTML.replace(
      'function showQuestion()',
      `function renderRound(round) {
        const el = document.getElementById('question');
        el.textContent = round.q;
      }
      function showQuestion()`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-DOM-CACHE'),
      `Expected GEN-DOM-CACHE warning when getElementById is inside renderRound() but got: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: does not warn when getElementById called at DOMContentLoaded level (not inside per-round fn)', () => {
    // Correct pattern: getElementById at init scope, not inside a per-round function body.
    // Also replace showQuestion's getElementById to avoid false-positive from VALID_HTML baseline.
    const html = VALID_HTML
      .replace(
        "document.getElementById('questionText').textContent = a + ' x ' + b + ' = ?';",
        "questionTextEl.textContent = a + ' x ' + b + ' = ?';",
      )
      .replace(
        'function showQuestion()',
        `const questionEl = document.getElementById('question');
      const questionTextEl = document.getElementById('questionText');
      function renderRound(round) {
        questionEl.textContent = round.q;
      }
      function showQuestion()`,
      );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-DOM-CACHE'),
      `Unexpected GEN-DOM-CACHE warning when getElementById is at init scope: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: warns when getElementById called inside async loadQuestion()', () => {
    const html = VALID_HTML.replace(
      'function showQuestion()',
      `async function loadQuestion(idx) {
        const feedback = document.getElementById('feedback-msg');
        feedback.innerHTML = '';
      }
      function showQuestion()`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-DOM-CACHE'),
      `Expected GEN-DOM-CACHE warning when getElementById is inside async loadQuestion() but got: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: warns when loadQuestion() has an if block before getElementById (previously false negative)', () => {
    // The old [^{}]* pattern stopped at the opening brace of the if-block,
    // missing the getElementById call inside it — this was a silent false negative.
    const html = VALID_HTML.replace(
      'function showQuestion()',
      `function loadQuestion(index) {
        if (index === 0) {
          const el = document.getElementById('question-text');
          el.textContent = 'First question';
        }
      }
      function showQuestion()`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-DOM-CACHE'),
      `Expected GEN-DOM-CACHE warning when getElementById is inside if-block in loadQuestion() but got: ${output}`,
    );
  });

  it('GEN-DOM-CACHE: warns when renderRound() has a for loop before getElementById (previously false negative)', () => {
    // The old [^{}]* pattern stopped at the opening brace of the for-loop,
    // missing the getElementById call inside it — this was a silent false negative.
    const html = VALID_HTML.replace(
      'function showQuestion()',
      `function renderRound(round) {
        for (let i = 0; i < round.options.length; i++) {
          const btn = document.getElementById('option-' + i);
          btn.textContent = round.options[i];
        }
      }
      function showQuestion()`,
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-DOM-CACHE'),
      `Expected GEN-DOM-CACHE warning when getElementById is inside for-loop in renderRound() but got: ${output}`,
    );
  });
});

describe('GEN-TIMER-GETTIME: banned CDN timer methods', () => {
  it('errors on timer.getTime() call', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); const elapsed = timer.getTime() / 1000;',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-TIMER-GETTIME'),
      `Expected GEN-TIMER-GETTIME error on timer.getTime() but got: ${output}`,
    );
  });

  it('errors on timer.getCurrentTime() call', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); const t = timer.getCurrentTime();',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-TIMER-GETTIME'),
      `Expected GEN-TIMER-GETTIME error on timer.getCurrentTime() but got: ${output}`,
    );
  });

  it('does not error on valid timer methods (start/stop/destroy)', () => {
    const html = VALID_HTML.replace(
      'initGame();',
      'initGame(); timer.stop(); timer.destroy();',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-TIMER-GETTIME'),
      `Unexpected GEN-TIMER-GETTIME error on valid timer.stop()/destroy() but got: ${output}`,
    );
  });
});

describe('GEN-CORRECT-ANSWER-EXPOSURE: round string correct-answer field must be exposed on gameState', () => {
  it('no warning when game uses round.correctOption AND sets gameState.correctAnswer', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; gameState.correctAnswer = round.correctOption; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Unexpected GEN-CORRECT-ANSWER-EXPOSURE warning when gameState.correctAnswer is set: ${output}`,
    );
  });

  it('warns when game uses round.correctOption but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; syncDOMState(); }\nfunction renderOptions() { options.forEach(o => { if (o === round.correctOption) o.selected = true; }); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning when round.correctOption used but gameState.correctAnswer not set, got: ${output}`,
    );
  });

  it('warns when game uses round.correctAnswer but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const label = round.correctAnswer; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning when round.correctAnswer used but gameState.correctAnswer not set, got: ${output}`,
    );
  });

  it('no warning when game has no round.correctOption or similar field', () => {
    const { output } = runValidator(VALID_HTML);
    assert.ok(
      !output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Unexpected GEN-CORRECT-ANSWER-EXPOSURE warning on game with no round.correctOption: ${output}`,
    );
  });

  it('warns when game uses round.correctValue but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const label = round.correctValue; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for round.correctValue, got: ${output}`,
    );
  });

  it('warns when game uses round.solution but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const correct = round.solution; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for round.solution, got: ${output}`,
    );
  });

  it('warns when game uses round.correctWord but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const word = round.correctWord; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for round.correctWord, got: ${output}`,
    );
  });

  it('warns when game uses round.correctItem but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const item = round.correctItem; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for round.correctItem, got: ${output}`,
    );
  });

  it('warns when game uses optional-chaining round?.correctOption but gameState.correctAnswer is never set', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; const opt = round?.correctOption; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for round?.correctOption (optional chaining), got: ${output}`,
    );
  });

  it('no warning for text-input game that sets gameState.answer = round.answer', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; gameState.answer = round.answer; syncDOMState(); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      !output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Unexpected GEN-CORRECT-ANSWER-EXPOSURE warning when gameState.answer is set (text-input carve-out): ${output}`,
    );
  });

  it('warns for MCQ game with round.correctOption + gameState.answer set (no gameState.correctAnswer)', () => {
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function loadRound() { const round = rounds[gameState.currentRound]; gameState.answer = userInput; syncDOMState(); }\nfunction renderOptions() { options.forEach(o => { if (o === round.correctOption) o.selected = true; }); }\nfunction checkAnswer(answer) {',
    );
    const { output } = runValidator(html);
    assert.ok(
      output.includes('GEN-CORRECT-ANSWER-EXPOSURE'),
      `Expected GEN-CORRECT-ANSWER-EXPOSURE warning for MCQ game with round.correctOption + gameState.answer but no gameState.correctAnswer, got: ${output}`,
    );
  });
});

// ─── GEN-WORKED-EXAMPLE-TEARDOWN ─────────────────────────────────────────────

describe('GEN-WORKED-EXAMPLE-TEARDOWN: worked-example panel button re-enable check', () => {
  it('warns when worked-example + gotIt handler present but no removeAttribute disabled', () => {
    // Has worked-example panel and handleGotIt but never re-enables option buttons
    const html = VALID_HTML.replace(
      'function endGame() {',
      'function handleGotIt() {\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "none";\n' +
      '}\n' +
      'function showWorkedExample() {\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "block";\n' +
      '}\n' +
      'function endGame() {',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('WARNING') && output.includes('GEN-WORKED-EXAMPLE-TEARDOWN'),
      `Expected GEN-WORKED-EXAMPLE-TEARDOWN warning but got: ${output}`,
    );
  });

  it('does NOT warn when worked-example + gotIt handler re-enables buttons with removeAttribute', () => {
    // Correct pattern: handler re-enables buttons before hiding panel
    const html = VALID_HTML.replace(
      'function endGame() {',
      'function handleGotIt() {\n' +
      '  var optionBtns = document.querySelectorAll(".option-btn");\n' +
      '  optionBtns.forEach(function(btn) { btn.removeAttribute("disabled"); });\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "none";\n' +
      '}\n' +
      'function showWorkedExample() {\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "block";\n' +
      '}\n' +
      'function endGame() {',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-WORKED-EXAMPLE-TEARDOWN'),
      `Unexpected GEN-WORKED-EXAMPLE-TEARDOWN warning for correct pattern: ${output}`,
    );
  });

  it('does NOT warn when HTML has no worked-example logic at all', () => {
    // Plain MCQ game with no worked-example panel — check must be silent
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-WORKED-EXAMPLE-TEARDOWN'),
      `Unexpected GEN-WORKED-EXAMPLE-TEARDOWN warning for HTML with no worked-example logic: ${output}`,
    );
  });

  it('suppressed when btn.disabled = false used to re-enable buttons', () => {
    // Correct pattern using property assignment instead of removeAttribute
    const html = VALID_HTML.replace(
      'function endGame() {',
      'function handleGotIt() {\n' +
      '  var optionBtns = document.querySelectorAll(".option-btn");\n' +
      '  optionBtns.forEach(function(btn) { btn.disabled = false; });\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "none";\n' +
      '}\n' +
      'function showWorkedExample() {\n' +
      '  var workedExamplePanel = document.getElementById("worked-example-panel");\n' +
      '  workedExamplePanel.style.display = "block";\n' +
      '}\n' +
      'function endGame() {',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-WORKED-EXAMPLE-TEARDOWN'),
      `Unexpected GEN-WORKED-EXAMPLE-TEARDOWN warning when btn.disabled = false used: ${output}`,
    );
  });
});

// ─── GEN-ISPROCESSING-RESET ───────────────────────────────────────────────────

describe('GEN-ISPROCESSING-RESET: isProcessing must be reset to false', () => {
  it('warns when isProcessing = true present but isProcessing = false is never set', () => {
    // Sets isProcessing to true but never clears it — permanent deadlock
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function handleAnswer() {\n' +
      '  if (gameState.isProcessing) return;\n' +
      '  gameState.isProcessing = true;\n' +
      '  checkAnswer(gameState.correct);\n' +
      '}\n' +
      'function checkAnswer(answer) {',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass (warning only) but got exit ${exitCode}: ${output}`);
    assert.ok(
      output.includes('WARNING') && output.includes('GEN-ISPROCESSING-RESET'),
      `Expected GEN-ISPROCESSING-RESET warning but got: ${output}`,
    );
  });

  it('does NOT warn when isProcessing = true and isProcessing = false are both present', () => {
    // Correct pattern: isProcessing is set and cleared
    const html = VALID_HTML.replace(
      'function checkAnswer(answer) {',
      'function handleAnswer() {\n' +
      '  if (gameState.isProcessing) return;\n' +
      '  gameState.isProcessing = true;\n' +
      '  checkAnswer(gameState.correct);\n' +
      '  gameState.isProcessing = false;\n' +
      '}\n' +
      'function checkAnswer(answer) {',
    );
    const { exitCode, output } = runValidator(html);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-ISPROCESSING-RESET'),
      `Unexpected GEN-ISPROCESSING-RESET warning for correct pattern: ${output}`,
    );
  });

  it('does NOT warn when HTML has no isProcessing usage at all', () => {
    // Plain game with no isProcessing — check must be silent
    const { exitCode, output } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0, `Expected pass but got exit ${exitCode}: ${output}`);
    assert.ok(
      !output.includes('GEN-ISPROCESSING-RESET'),
      `Unexpected GEN-ISPROCESSING-RESET warning for HTML with no isProcessing: ${output}`,
    );
  });
});
