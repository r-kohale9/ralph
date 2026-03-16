'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContract,
  validateGameStateContract,
  validatePostMessageContract,
  validateScoringContract,
  validateInitGameContract,
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
      const html = VALID_HTML
        .replace('let gameState = { score: 0, total: 10, currentQuestion: 0, totalQuestions: 10 };', 'let gameState = {};')
        .replace('gameState = { score: 0', 'gameState.score = 0; gameState = { score: 0');
      const errors = validateGameStateContract(html);
      // Should find gameState init (the empty one) but score is set via assignment
      assert.equal(errors.filter(e => e.includes('"score"')).length, 0);
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
        "{ type: 'gameOver', stars: stars, total: gameState.totalQuestions }"
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some(e => e.includes('score')));
    });

    it('fails when postMessage is missing stars', () => {
      const html = VALID_HTML.replace(
        "{ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }",
        "{ type: 'gameOver', score: gameState.score, total: gameState.totalQuestions }"
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some(e => e.includes('stars')));
    });

    it('fails when postMessage is missing total', () => {
      const html = VALID_HTML.replace(
        "{ type: 'gameOver', score: gameState.score, stars: stars, total: gameState.totalQuestions }",
        "{ type: 'gameOver', score: gameState.score, stars: stars }"
      );
      const errors = validatePostMessageContract(html);
      assert.ok(errors.some(e => e.includes('total')));
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
      assert.ok(errors.some(e => e.includes('endGame function body')));
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
      assert.ok(errors.some(e => e.includes('initGame function body')));
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
        encoding: 'utf-8', timeout: 5000,
      });
      assert.fail('Should have exited with code 2');
    } catch (err) {
      assert.equal(err.status, 2);
    }
  });
});
