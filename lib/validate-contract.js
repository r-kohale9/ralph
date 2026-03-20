#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// validate-contract.js — T2 Contract validation layer
//
// JSON Schema validation of game artifacts against warehouse contracts:
//   - gameState object shape
//   - postMessage event payloads
//   - Game metrics/scoring
//
// Bridges the gap between T1 static checks and Playwright functional tests.
// Validates that HTML games conform to warehouse integration contracts.
//
// Usage: node validate-contract.js <path-to-index.html>
// Exit 0 = pass, Exit 1 = failures found
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');

// ─── Contract schemas ────────────────────────────────────────────────────────

// gameState must contain these fields with correct types
const GAME_STATE_SCHEMA = {
  required: ['score'],
  properties: {
    score: 'number',
    total: 'number',
    currentQuestion: 'number',
    totalQuestions: 'number',
    stars: 'number',
    completed: 'boolean',
  },
};

// postMessage payloads must match one of these event schemas
const EVENT_SCHEMAS = {
  gameOver: {
    required: ['type', 'score', 'stars', 'total'],
    properties: {
      type: { type: 'string', const: 'gameOver' },
      score: { type: 'number' },
      stars: { type: 'number', minimum: 0, maximum: 3 },
      total: { type: 'number', minimum: 1 },
    },
  },
  gameReady: {
    required: ['type'],
    properties: {
      type: { type: 'string', const: 'gameReady' },
    },
  },
  gameProgress: {
    required: ['type', 'progress'],
    properties: {
      type: { type: 'string', const: 'gameProgress' },
      progress: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
};

// ─── Validators ──────────────────────────────────────────────────────────────

function validateGameStateContract(html) {
  const errors = [];

  // Extract gameState initialization pattern — accept both let/var/const and window.gameState =
  const stateMatch =
    html.match(/(?:let|var|const)\s+gameState\s*=\s*(\{[^}]+\})/) ||
    html.match(/window\.gameState\s*=\s*(\{[^}]+\})/);
  if (!stateMatch) {
    errors.push('CONTRACT: gameState initialization not found');
    return errors;
  }

  const stateStr = stateMatch[1];

  // Check required fields exist in the initial state object
  for (const field of GAME_STATE_SCHEMA.required) {
    const fieldPattern = new RegExp(`['"]?${field}['"]?\\s*:`);
    if (!fieldPattern.test(stateStr)) {
      // Also check if it's set elsewhere (e.g., in initGame)
      const assignPattern = new RegExp(`gameState\\.${field}\\s*=`);
      if (!assignPattern.test(html)) {
        errors.push(`CONTRACT: gameState missing required field "${field}"`);
      }
    }
  }

  return errors;
}

function validatePostMessageContract(html) {
  const errors = [];

  // Check for game_complete postMessage (CDN game format)
  const hasGameComplete = /['"]game_complete['"]/.test(html);

  if (hasGameComplete) {
    // CDN games must use nested data structure: { type: 'game_complete', data: { metrics, ... } }
    // A flat payload (score/stars at top level) means contract tests will fail on data.metrics checks.

    // Check that postMessage is called with 'game_complete' type
    const hasPostMessageCall =
      /(?:window\.parent|parent)\.postMessage\s*\(/.test(html) ||
      /postMessage\s*\(/.test(html);

    if (!hasPostMessageCall) {
      errors.push(
        'CONTRACT: game_complete string found but no postMessage() call detected'
      );
    }

    // Check for nested data.metrics structure (required by contract tests)
    // The payload must have: data: { metrics: { ... } } — NOT flat top-level fields
    const hasDataMetrics =
      /data\s*:\s*\{[^}]*metrics/.test(html) || /metrics\s*,/.test(html) || /metrics\s*\}/.test(html);

    const hasFlatPayload =
      // Flat: postMessage({ type: 'game_complete', score: ..., stars: ... })
      // i.e. type + score + stars at the same nesting level without a 'data' wrapper
      /postMessage\s*\(\s*\{[^}]*type\s*:\s*['"]game_complete['"][^}]*score\s*:/s.test(html);

    if (hasFlatPayload && !hasDataMetrics) {
      errors.push(
        'CONTRACT: game_complete postMessage uses flat payload structure — ' +
          'contract tests check data.metrics.stars, data.events etc. ' +
          'Use: postMessage({ type: "game_complete", data: { metrics, attempts, ...signalPayload, completedAt } }, "*")'
      );
    }

    return errors;
  }

  // Legacy gameOver event (non-CDN games)
  const postMessagePattern = /(?:window\.parent|parent)\.postMessage\s*\(\s*(\{[^}]+\})/g;
  let match;
  let foundGameOver = false;

  while ((match = postMessagePattern.exec(html)) !== null) {
    const payloadStr = match[1];

    if (/type\s*:\s*['"]gameOver['"]/.test(payloadStr)) {
      foundGameOver = true;
      const schema = EVENT_SCHEMAS.gameOver;
      for (const field of schema.required) {
        if (field === 'type') continue;
        const fieldPattern = new RegExp(`['"]?${field}['"]?\\s*:`);
        if (!fieldPattern.test(payloadStr)) {
          errors.push(`CONTRACT: gameOver postMessage missing required field "${field}"`);
        }
      }
    }
  }

  if (!foundGameOver) {
    // No game_complete and no gameOver found
    if (!/postMessage/s.test(html)) {
      errors.push('CONTRACT: No gameOver/game_complete postMessage event found');
    } else if (!/['"]gameOver['"]/.test(html)) {
      errors.push('CONTRACT: No gameOver/game_complete postMessage event found');
    }
  }

  return errors;
}

function validateScoringContract(html) {
  const errors = [];

  // endGame must compute stars
  const endGameMatch = html.match(/function\s+endGame\s*\([^)]*\)\s*\{([\s\S]*?)(?=\nfunction\s|\n\s*$|<\/script>)/);
  if (!endGameMatch) {
    errors.push('CONTRACT: endGame function body not found');
    return errors;
  }

  const endGameBody = endGameMatch[1];

  // Must reference stars computation
  if (!/stars?\s*[=:]/.test(endGameBody) && !/stars/.test(endGameBody)) {
    errors.push('CONTRACT: endGame does not compute star rating');
  }

  // Must call postMessage
  if (!/postMessage/.test(endGameBody)) {
    errors.push('CONTRACT: endGame does not call postMessage');
  }

  return errors;
}

function validateInitGameContract(html) {
  const errors = [];

  // CDN games use DOMContentLoaded + ScreenLayout.inject() instead of initGame()
  const isCdnGame = /ScreenLayout\.inject/.test(html) && /DOMContentLoaded/.test(html);
  if (isCdnGame) return errors;

  // initGame must reset gameState
  const initMatch = html.match(/function\s+initGame\s*\([^)]*\)\s*\{([\s\S]*?)(?=\nfunction\s|\n\s*$)/);
  if (!initMatch) {
    errors.push('CONTRACT: initGame function body not found');
    return errors;
  }

  const initBody = initMatch[1];

  // Must reset score to 0
  if (!/score\s*[:=]\s*0/.test(initBody) && !/gameState\s*=/.test(initBody)) {
    errors.push('CONTRACT: initGame does not reset score');
  }

  return errors;
}

function validateCalcStarsContract(html) {
  const errors = [];

  // If calcStars is defined as a function, it must be exposed on window
  // Contract tests call: page.evaluate(() => window.calcStars(...))
  const hasCalcStarsFunction = /function\s+calcStars\s*\(/.test(html);
  if (hasCalcStarsFunction) {
    const hasWindowCalcStars =
      /window\.calcStars\s*=/.test(html) || /window\['calcStars'\]\s*=/.test(html);
    if (!hasWindowCalcStars) {
      errors.push(
        'CONTRACT: calcStars function defined but not exposed on window — ' +
          'contract tests call window.calcStars(); add: window.calcStars = calcStars;'
      );
    }
  }

  return errors;
}

// ─── Main validation ─────────────────────────────────────────────────────────

function validateContract(html) {
  const errors = [];

  errors.push(...validateGameStateContract(html));
  errors.push(...validatePostMessageContract(html));
  errors.push(...validateScoringContract(html));
  errors.push(...validateInitGameContract(html));
  errors.push(...validateCalcStarsContract(html));

  return errors;
}

// ─── CLI mode ────────────────────────────────────────────────────────────────
if (require.main === module) {
  const htmlPath = process.argv[2];
  if (!htmlPath) {
    console.error('Usage: node validate-contract.js <path-to-index.html>');
    process.exit(2);
  }

  if (!fs.existsSync(htmlPath)) {
    console.error(`File not found: ${htmlPath}`);
    process.exit(2);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const errors = validateContract(html);

  if (errors.length > 0) {
    console.log(`\nCONTRACT VALIDATION FAILED — ${errors.length} error(s):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    process.exit(1);
  } else {
    console.log('Contract validation passed');
    process.exit(0);
  }
}

module.exports = {
  validateContract,
  validateGameStateContract,
  validatePostMessageContract,
  validateScoringContract,
  validateInitGameContract,
  validateCalcStarsContract,
  EVENT_SCHEMAS,
  GAME_STATE_SCHEMA,
};
