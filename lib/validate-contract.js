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

  // Extract gameState initialization pattern
  const stateMatch = html.match(/(?:let|var|const)\s+gameState\s*=\s*(\{[^}]+\})/);
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

  // Find all postMessage calls
  const postMessagePattern = /(?:window\.parent|parent)\.postMessage\s*\(\s*(\{[^}]+\})/g;
  let match;
  let foundGameOver = false;

  while ((match = postMessagePattern.exec(html)) !== null) {
    const payloadStr = match[1];

    // Check for gameOver event
    if (/type\s*:\s*['"]gameOver['"]/.test(payloadStr)) {
      foundGameOver = true;

      // Validate required fields for gameOver
      const schema = EVENT_SCHEMAS.gameOver;
      for (const field of schema.required) {
        if (field === 'type') continue; // already matched
        const fieldPattern = new RegExp(`['"]?${field}['"]?\\s*:`);
        if (!fieldPattern.test(payloadStr)) {
          errors.push(`CONTRACT: gameOver postMessage missing required field "${field}"`);
        }
      }
    }
  }

  if (!foundGameOver) {
    // Check for postMessage with gameOver type using any format
    if (!/postMessage.*gameOver/s.test(html) && !/['"]gameOver['"]/s.test(html)) {
      errors.push('CONTRACT: No gameOver postMessage event found');
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

// ─── Main validation ─────────────────────────────────────────────────────────

function validateContract(html) {
  const errors = [];

  errors.push(...validateGameStateContract(html));
  errors.push(...validatePostMessageContract(html));
  errors.push(...validateScoringContract(html));
  errors.push(...validateInitGameContract(html));

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
    errors.forEach(e => console.log(`  ✗ ${e}`));
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
  EVENT_SCHEMAS,
  GAME_STATE_SCHEMA,
};
