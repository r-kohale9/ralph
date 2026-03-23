'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline-utils.js extractGameFeatures()
//
// Verifies that the spec-derived gameFeatures block correctly detects all
// lifecycle variants: unlimited-lives, multi-level, timer scoring, accuracy
// scoring, single-round, learn/recall two-phase games.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractGameFeatures } = require('../lib/pipeline-utils');

// ─── associations spec fixture (unlimited lives, accuracy scoring, 3 rounds, learn/recall) ───

const ASSOCIATIONS_SPEC = `
## 1. Game Identity
- **Description:** Paired-recall memory game. Phase 1: learn emoji-name pairs shown sequentially. Phase 2: match emojis to names from multiple choices. Unlimited lives, scored by accuracy percentage. 3 rounds of increasing difficulty.

## 3. Game State
const gameState = {
  totalRounds: 3,
  phase: 'idle', // 'idle' | 'learn' | 'recall' | 'feedback'
  exposureDuration: 3000,
};

## 2. Parts Selected
| PART-023 | ProgressBar Component | YES | totalRounds: 3, totalLives: 0 (no lives display) |

## Custom star logic
accuracy-based (100%->3, >=60%->2, >=30%->1, <30%->0)
`;

// ─── rapid-challenge spec fixture (3 lives, 9 rounds, 3 levels, avg-time scoring) ───

const RAPID_CHALLENGE_SPEC = `
## 1. Game Identity
- **Description:** A timed multiple-choice quiz. Correct answers advance; wrong answers lose a life. 9 rounds across 3 levels (3 rounds per level), 3 lives. Stars based on average time per round.

## 3. Game State
const gameState = {
  totalRounds: 9,
  lives: 3,
  totalLives: 3,
  level: 1,
};

## Custom star logic
avg time/round <3s = 3★, <5s = 2★, >=5s = 1★, game-over = 0★
`;

// ─── single-round arcade fixture ────────────────────────────────────────────

const SINGLE_ROUND_SPEC = `
## 1. Game Identity
- **Description:** Quick one-round challenge. 1 round total, 3 lives. Stars based on lives remaining.
totalRounds: 1
lives: 3
`;

// ─── total-time-scoring fixture ──────────────────────────────────────────────

const TOTAL_TIME_SPEC = `
## Scoring
Stars based on total time to complete the game.
totalRounds: 5
lives: 3
Stars: total time < 60s = 3★, < 90s = 2★, else 1★
`;

// ─── extractGameFeatures — associations (unlimited lives, accuracy, learn/recall) ─

describe('extractGameFeatures — associations (unlimited lives, accuracy scoring, learn/recall)', () => {
  let features;
  it('runs without throwing', () => {
    features = extractGameFeatures(ASSOCIATIONS_SPEC);
  });

  it('detects unlimitedLives: true', () => {
    assert.equal(features.unlimitedLives, true);
  });

  it('detects hasLives: false', () => {
    assert.equal(features.hasLives, false);
  });

  it('detects totalLives: 0', () => {
    assert.equal(features.totalLives, 0);
  });

  it('detects totalRounds: 3', () => {
    assert.equal(features.totalRounds, 3);
  });

  it('detects singleRound: false', () => {
    assert.equal(features.singleRound, false);
  });

  it('detects accuracyScoring: true', () => {
    assert.equal(features.accuracyScoring, true);
  });

  it('detects timerScoring: false', () => {
    assert.equal(features.timerScoring, false);
  });

  it('detects hasLearnPhase: true', () => {
    assert.equal(features.hasLearnPhase, true);
  });

  it('detects hasTwoPhases: true', () => {
    assert.equal(features.hasTwoPhases, true);
  });

  it('detects hasLevels: false (only rounds, no levels)', () => {
    assert.equal(features.hasLevels, false);
  });
});

// ─── extractGameFeatures — rapid-challenge (3 lives, 3 levels, avg-time) ────

describe('extractGameFeatures — rapid-challenge (3 lives, 3 levels, avg-time scoring)', () => {
  let features;
  it('runs without throwing', () => {
    features = extractGameFeatures(RAPID_CHALLENGE_SPEC);
  });

  it('detects unlimitedLives: false', () => {
    assert.equal(features.unlimitedLives, false);
  });

  it('detects hasLives: true', () => {
    assert.equal(features.hasLives, true);
  });

  it('detects totalLives: 3', () => {
    assert.equal(features.totalLives, 3);
  });

  it('detects totalRounds: 9', () => {
    assert.equal(features.totalRounds, 9);
  });

  it('detects singleRound: false', () => {
    assert.equal(features.singleRound, false);
  });

  it('detects hasLevels: true', () => {
    assert.equal(features.hasLevels, true);
  });

  it('detects totalLevels: 3', () => {
    assert.equal(features.totalLevels, 3);
  });

  it('detects timerScoring: true', () => {
    assert.equal(features.timerScoring, true);
  });

  it('detects accuracyScoring: false', () => {
    assert.equal(features.accuracyScoring, false);
  });

  it('detects hasLearnPhase: false', () => {
    assert.equal(features.hasLearnPhase, false);
  });

  it('detects hasTwoPhases: false', () => {
    assert.equal(features.hasTwoPhases, false);
  });
});

// ─── extractGameFeatures — single-round game ─────────────────────────────────

describe('extractGameFeatures — single-round game', () => {
  let features;
  it('runs without throwing', () => {
    features = extractGameFeatures(SINGLE_ROUND_SPEC);
  });

  it('detects singleRound: true', () => {
    assert.equal(features.singleRound, true);
  });

  it('detects totalRounds: 1', () => {
    assert.equal(features.totalRounds, 1);
  });

  it('detects hasLives: true', () => {
    assert.equal(features.hasLives, true);
  });

  it('detects unlimitedLives: false', () => {
    assert.equal(features.unlimitedLives, false);
  });
});

// ─── extractGameFeatures — total-time scoring ────────────────────────────────

describe('extractGameFeatures — total-time scoring', () => {
  let features;
  it('runs without throwing', () => {
    features = extractGameFeatures(TOTAL_TIME_SPEC);
  });

  it('detects timerScoring: true', () => {
    assert.equal(features.timerScoring, true);
  });

  it('detects accuracyScoring: false', () => {
    assert.equal(features.accuracyScoring, false);
  });
});

// ─── extractGameFeatures — DOM snapshot integration ──────────────────────────

describe('extractGameFeatures — DOM snapshot with learn/recall phase classes', () => {
  const minSpec = `
## Game
totalRounds: 5
lives: 2
`;
  const domWithLearnPhase = `<div id="app" data-phase="learn-phase"><div class="recall-phase">...</div></div>`;

  it('detects hasTwoPhases from DOM snapshot when spec is silent', () => {
    const features = extractGameFeatures(minSpec, domWithLearnPhase);
    assert.equal(features.hasTwoPhases, true);
  });
});

// ─── extractGameFeatures — empty / minimal spec ───────────────────────────────

describe('extractGameFeatures — empty spec returns safe defaults', () => {
  it('handles empty string without throwing', () => {
    const features = extractGameFeatures('');
    assert.equal(typeof features.unlimitedLives, 'boolean');
    assert.equal(typeof features.hasLives, 'boolean');
    assert.equal(typeof features.timerScoring, 'boolean');
    assert.equal(typeof features.accuracyScoring, 'boolean');
    assert.equal(typeof features.singleRound, 'boolean');
    assert.equal(typeof features.hasTwoPhases, 'boolean');
    assert.equal(typeof features.hasLearnPhase, 'boolean');
    assert.equal(typeof features.hasLevels, 'boolean');
  });
});

// ─── extractGameFeatures — export check ──────────────────────────────────────

describe('extractGameFeatures — module export', () => {
  it('is exported from pipeline-utils', () => {
    const utils = require('../lib/pipeline-utils');
    assert.equal(typeof utils.extractGameFeatures, 'function');
  });
});
