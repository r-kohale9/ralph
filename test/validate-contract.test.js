'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContract,
  validateGameStateContract,
  validatePostMessageContract,
  validateScoringContract,
  validateInitGameContract,
  validateCalcStarsContract,
  validateSignalCollectorContract,
} = require('../lib/validate-contract');

const VALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Test</title>
<style>#gameContent { max-width: 480px; }</style>
</head>
<body>
<div id="gameContent"><div id="gameArea"></div></div>
<script>
let gameState = { score: 0, total: 10, currentQuestion: 0, totalQuestions: 10 };

function initGame() {
  gameState = { score: 0, total: 10, currentQuestion: 0, totalQuestions: 10 };
  showQuestion();
}

function checkAnswer(answer) {
  if (answer === gameState.correct) gameState.score++;
  gameState.currentQuestion++;
  if (gameState.currentQuestion >= gameState.totalQuestions) endGame();
}

function endGame() {
  const pct = gameState.score / gameState.totalQuestions;
  const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : pct > 0 ? 1 : 0;
  window.parent.postMessage({ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }, '*');
}

function showQuestion() {}
initGame();
</script>
</body>
</html>`;

const CDN_HTML_NESTED = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><div id="app"></div>
<script>
let gameState = { score: 0, phase: 'playing' };
window.gameState = gameState;
function calcStars() { return 3; }
window.calcStars = calcStars;
function computeTriesPerRound(attempts) { return []; }
var signalCollector = null;
window.signalCollector = signalCollector;
function handlePostMessage(event) {
  if (event.data.type === 'game_init') {
    var signalConfig = event.data.data.signalConfig || {};
    if (signalCollector && signalConfig.flushUrl) {
      signalCollector.flushUrl = signalConfig.flushUrl;
      signalCollector.playId = signalConfig.playId || null;
      signalCollector.gameId = signalConfig.gameId || signalCollector.gameId;
      signalCollector.sessionId = signalConfig.sessionId || signalCollector.sessionId;
      signalCollector.contentSetId = signalConfig.contentSetId || signalCollector.contentSetId;
      signalCollector.studentId = signalConfig.studentId || signalCollector.studentId;
      signalCollector.startFlushing();
    }
  }
}
async function endGame() {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  var totalLives = gameState.totalLives || 1;
  var tries = computeTriesPerRound(gameState.attempts);
  const metrics = { score: gameState.score, accuracy: 100, time: 30, stars: calcStars(), totalLives: totalLives, tries: tries, attempts: [], duration_data: {} };
  var signalResult = signalCollector ? signalCollector.seal() : { event_count: 0, metadata: {} };
  window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts: gameState.attempts, completedAt: Date.now(), signal_event_count: signalResult.event_count, signal_metadata: signalResult.metadata } }, '*');
}
window.endGame = endGame;
function initGame() { gameState = { score: 0, phase: 'playing' }; }
</script></body></html>`;

describe('validate-contract', () => {
  describe('validateContract (full)', () => {
    it('passes valid HTML game', () => {
      const errors = validateContract(VALID_HTML);
      assert.equal(errors.length, 0, `Unexpected errors: ${errors.join(', ')}`);
    });
  });

  describe('validateGameStateContract', () => {
    it('passes when gameState has score field', () => {
      const errors = validateGameStateContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('fails when gameState is missing', () => {
      const html = VALID_HTML.replace(/let gameState = \{[^}]+\}/, 'let data = {}');
      const errors = validateGameStateContract(html);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].includes('gameState'));
    });

    it('allows score set in initGame instead of declaration', () => {
      const html = VALID_HTML.replace(
        'let gameState = { score: 0, total: 10, currentQuestion: 0, totalQuestions: 10 };',
        'let gameState = {};',
      ).replace('gameState = { score: 0', 'gameState.score = 0; gameState = { score: 0');
      const errors = validateGameStateContract(html);
      // Should find gameState init (the empty one) but score is set via assignment
      assert.equal(errors.filter((e) => e.includes('"score"')).length, 0);
    });
  });

  describe('validatePostMessageContract', () => {
    it('passes when gameOver postMessage has all required fields', () => {
      const errors = validatePostMessageContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('fails when postMessage is missing score', () => {
      const html = VALID_HTML.replace(
        "{ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }",
        "{ type: 'gameOver', stars: stars, total: gameState.totalQuestions }",
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some((e) => e.includes('score')));
    });

    it('fails when postMessage is missing stars', () => {
      const html = VALID_HTML.replace(
        "{ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }",
        "{ type: 'gameOver', score: gameState.score, total: gameState.totalQuestions }",
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some((e) => e.includes('stars')));
    });

    it('fails when postMessage is missing total', () => {
      const html = VALID_HTML.replace(
        "{ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }",
        "{ type: 'gameOver', score: gameState.score, stars: stars }",
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some((e) => e.includes('total')));
    });
  });

  describe('validateScoringContract', () => {
    it('passes when endGame computes stars and calls postMessage', () => {
      const errors = validateScoringContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('fails when endGame body not found', () => {
      const html = VALID_HTML.replace('function endGame()', 'function finishGame()');
      const errors = validateScoringContract(html);
      assert.ok(errors.some((e) => e.includes('endGame function body')));
    });
  });

  describe('validateInitGameContract', () => {
    it('passes when initGame resets state', () => {
      const errors = validateInitGameContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('fails when initGame body not found', () => {
      const html = VALID_HTML.replace('function initGame()', 'function startGame()');
      const errors = validateInitGameContract(html);
      assert.ok(errors.some((e) => e.includes('initGame function body')));
    });
  });

  describe('validateCalcStarsContract', () => {
    it('passes when calcStars is not defined (no requirement)', () => {
      const errors = validateCalcStarsContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('passes when calcStars is defined and exposed on window', () => {
      const html = VALID_HTML.replace(
        'function endGame()',
        'function calcStars(pct) { return pct >= 0.8 ? 3 : 1; }\nwindow.calcStars = calcStars;\nfunction endGame()',
      );
      const errors = validateCalcStarsContract(html);
      assert.equal(errors.length, 0);
    });

    it('fails when calcStars is defined but not exposed on window', () => {
      const html = VALID_HTML.replace(
        'function endGame()',
        'function calcStars(pct) { return pct >= 0.8 ? 3 : 1; }\nfunction endGame()',
      );
      const errors = validateCalcStarsContract(html);
      assert.ok(
        errors.some((e) => e.includes('calcStars') && e.includes('window')),
        `Expected calcStars window error, got: ${errors.join(', ')}`,
      );
    });
  });

  describe('validatePostMessageContract — CDN game_complete format', () => {
    const CDN_HTML_FLAT = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><div id="app"></div>
<script>
let gameState = { score: 0, phase: 'playing' };
window.gameState = gameState;
async function endGame() {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  window.parent.postMessage({ type: 'game_complete', score: gameState.score, stars: 3, total: 10 }, '*');
}
window.endGame = endGame;
function initGame() { gameState = { score: 0, phase: 'playing' }; }
</script></body></html>`;

    it('passes CDN game with nested data.metrics structure', () => {
      const errors = validatePostMessageContract(CDN_HTML_NESTED);
      assert.equal(
        errors.length,
        0,
        `Unexpected errors for nested CDN payload: ${errors.join(', ')}`,
      );
    });

    it('fails CDN game with flat payload structure', () => {
      const errors = validatePostMessageContract(CDN_HTML_FLAT);
      assert.ok(
        errors.some((e) => e.includes('flat payload')),
        `Expected flat payload error, got: ${errors.join(', ')}`,
      );
    });

    it('fails CDN game missing duration_data', () => {
      const html = CDN_HTML_NESTED.replace(/duration_data\s*:\s*\{\}/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('duration_data')),
        `Expected duration_data error, got: ${errors.join(', ')}`,
      );
    });

    it('fails CDN game missing completedAt', () => {
      const html = CDN_HTML_NESTED.replace(/completedAt:\s*Date\.now\(\)/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('completedAt')),
        `Expected completedAt error, got: ${errors.join(', ')}`,
      );
    });

    it('warns CDN game missing totalLives', () => {
      const html = CDN_HTML_NESTED.replace(/totalLives:\s*totalLives,/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('totalLives') && e.includes('WARNING')),
        `Expected totalLives warning, got: ${errors.join(', ')}`,
      );
    });

    it('warns CDN game missing tries', () => {
      const html = CDN_HTML_NESTED.replace(/tries:\s*tries,/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('tries') && e.includes('WARNING')),
        `Expected tries warning, got: ${errors.join(', ')}`,
      );
    });

    it('fails CDN game with SignalCollector but missing signal_event_count', () => {
      const html = CDN_HTML_NESTED.replace(/signal_event_count:\s*signalResult\.event_count,?\s*/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('signal_event_count')),
        `Expected signal_event_count error, got: ${errors.join(', ')}`,
      );
    });

    it('fails CDN game with SignalCollector but missing signal_metadata', () => {
      const html = CDN_HTML_NESTED.replace(/signal_metadata:\s*signalResult\.metadata/, '');
      const errors = validatePostMessageContract(html);
      assert.ok(
        errors.some((e) => e.includes('signal_metadata')),
        `Expected signal_metadata error, got: ${errors.join(', ')}`,
      );
    });
  });

  describe('validateSignalCollectorContract', () => {
    it('returns empty when no SignalCollector used', () => {
      const errors = validateSignalCollectorContract(VALID_HTML);
      assert.equal(errors.length, 0);
    });

    it('passes when SignalCollector is properly integrated', () => {
      const html = CDN_HTML_NESTED;
      const errors = validateSignalCollectorContract(html);
      assert.equal(errors.length, 0, `Unexpected errors: ${errors.join(', ')}`);
    });

    it('fails when startFlushing() is missing', () => {
      const html = CDN_HTML_NESTED.replace(/signalCollector\.startFlushing\(\);/, '');
      const errors = validateSignalCollectorContract(html);
      assert.ok(
        errors.some((e) => e.includes('startFlushing')),
        `Expected startFlushing error, got: ${errors.join(', ')}`,
      );
    });

    it('warns when signalConfig/flushUrl not referenced', () => {
      const html = CDN_HTML_NESTED
        .replace(/signalConfig/g, 'cfg')
        .replace(/flushUrl/g, 'endpoint');
      const errors = validateSignalCollectorContract(html);
      assert.ok(
        errors.some((e) => e.includes('WARNING') && (e.includes('signalConfig') || e.includes('flushUrl'))),
        `Expected signalConfig/flushUrl warning, got: ${errors.join(', ')}`,
      );
    });
  });
});

describe('validate-contract CLI', () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const VALIDATOR = path.join(__dirname, '..', 'lib', 'validate-contract.js');

  function runValidator(html) {
    const tmpFile = path.join(os.tmpdir(), `ralph-contract-test-${Date.now()}.html`);
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

  it('exits 0 for valid HTML', () => {
    const { exitCode } = runValidator(VALID_HTML);
    assert.equal(exitCode, 0);
  });

  it('exits 1 for invalid HTML', () => {
    const html = VALID_HTML.replace(/gameState/g, 'appData');
    const { exitCode } = runValidator(html);
    assert.equal(exitCode, 1);
  });

  it('exits 2 when no file argument given', () => {
    try {
      execFileSync('node', [VALIDATOR], { encoding: 'utf-8', timeout: 5000 });
      assert.fail('Should have exited with code 2');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });

  it('exits 2 when file does not exist', () => {
    try {
      execFileSync('node', [VALIDATOR, '/tmp/nonexistent-contract.html'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      assert.fail('Should have exited with code 2');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });
});
