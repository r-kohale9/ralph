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
          'contract tests check data.metrics.stars etc. ' +
          'Use: postMessage({ type: "game_complete", data: { metrics, attempts: gameState.attempts, completedAt: Date.now() } }, "*")'
      );
    }

    // ── Schema field checks (per warehouse/contracts/metrics.schema.json) ────
    // Only fire when game has proper nested data.metrics structure
    if (hasDataMetrics) {
      // Required metrics fields (metrics.schema.json → required)
      const requiredMetricsFields = [
        { field: 'accuracy', pattern: /accuracy\s*[,:]/, desc: 'accuracy (0-100 percentage)' },
        { field: 'time', pattern: /\btime\s*[,:]/, desc: 'time (seconds taken)' },
        { field: 'stars', pattern: /stars\s*[,:]/, desc: 'stars (0-3 rating)' },
        { field: 'attempts', pattern: /attempts\s*[,:]/, desc: 'attempts (full attempt history array)' },
        { field: 'duration_data', pattern: /duration_data\s*[,:]/, desc: 'duration_data (timing breakdown object)' },
      ];

      for (const { field, pattern, desc } of requiredMetricsFields) {
        if (!pattern.test(html)) {
          errors.push(
            `CONTRACT: game_complete metrics missing required field "${field}" — ` +
              `metrics must include ${desc} per metrics.schema.json`
          );
        }
      }

      // Required data-level field (postmessage-out.schema.json → data.completedAt)
      if (!/completedAt\s*:/.test(html)) {
        errors.push(
          'CONTRACT: game_complete data missing required field "completedAt" — ' +
            'must include completedAt: Date.now() in the data object per postmessage-out.schema.json'
        );
      }

      // Recommended fields (WARNING, not ERROR)
      if (!/totalLives\s*[,:]/.test(html)) {
        errors.push(
          'CONTRACT WARNING: game_complete metrics missing recommended field "totalLives" — ' +
            'should include totalLives (integer, default 1) for lives-based scoring'
        );
      }
      if (!/\btries\s*[,:]/.test(html)) {
        errors.push(
          'CONTRACT WARNING: game_complete metrics missing recommended field "tries" — ' +
            'should include tries (per-round attempt count array) for analytics'
        );
      }

      // SignalCollector fields — required when SignalCollector is used
      const hasSignalCollector = /signalCollector/i.test(html);
      if (hasSignalCollector) {
        if (!/signal_event_count/.test(html)) {
          errors.push(
            'CONTRACT: game_complete missing "signal_event_count" — ' +
              'when SignalCollector is used, game_complete data must include signal_event_count from seal() result'
          );
        }
        if (!/signal_metadata/.test(html)) {
          errors.push(
            'CONTRACT: game_complete missing "signal_metadata" — ' +
              'when SignalCollector is used, game_complete data must include signal_metadata from seal() result'
          );
        }
      }
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

function validateFeedbackManagerContract(html) {
  const errors = [];

  // Only validate if FeedbackManager is referenced anywhere
  const usesFeedback = /FeedbackManager/.test(html);
  if (!usesFeedback) return errors;

  // ── 1. FeedbackManager.init() must be called ──────────────────────────────
  const hasInit = /FeedbackManager\.init\s*\(/.test(html);
  if (!hasInit) {
    errors.push(
      'CONTRACT: FeedbackManager is used but FeedbackManager.init() is never called — ' +
        'init() is required before any feedback (loads SubtitleComponent + StickerComponent)'
    );
  }

  // ── 2. No sound.register() — must use sound.preload() ────────────────────
  const hasRegister = /FeedbackManager\.sound\.register\s*\(/.test(html);
  if (hasRegister) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.register() does not exist — ' +
        'use FeedbackManager.sound.preload([{id, url}, ...]) instead'
    );
  }

  // ── 3. If sound.play() is used, sound.preload() must also be present ─────
  const hasSoundPlay = /FeedbackManager\.sound\.play\s*\(/.test(html);
  const hasPreload = /FeedbackManager\.sound\.preload\s*\(/.test(html);
  if (hasSoundPlay && !hasPreload) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.play() is called but sound.preload() is never called — ' +
        'sounds must be preloaded with preload([{id, url}]) before play()'
    );
  }

  // ── 4. No new Audio() — must use FeedbackManager ─────────────────────────
  const hasNewAudio = /new\s+Audio\s*\(/.test(html);
  if (hasNewAudio) {
    errors.push(
      'CONTRACT: new Audio() detected — use FeedbackManager.sound.play(id) instead. ' +
        'Direct Audio construction bypasses subtitle/sticker integration and visibility pause/resume'
    );
  }

  // ── 5. No direct SubtitleComponent.show() calls ──────────────────────────
  const hasDirectSubtitle = /SubtitleComponent\.show\s*\(/.test(html);
  if (hasDirectSubtitle) {
    errors.push(
      'CONTRACT: SubtitleComponent.show() called directly — ' +
        'pass subtitle as a prop in sound.play() or playDynamicFeedback() instead'
    );
  }

  // ── 6. playDynamicFeedback must be top-level, not on sound ────────────────
  const hasSoundDynamic = /FeedbackManager\.sound\.playDynamicFeedback\s*\(/.test(html);
  if (hasSoundDynamic) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.playDynamicFeedback() is wrong — ' +
        'playDynamicFeedback() is a top-level method: FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})'
    );
  }

  // ── 7. sound.play() must not pass audio_content or text (TTS confusion) ──
  // Detect: sound.play('id', { ... audio_content: ... }) or sound.play('id', { ... text: ... })
  const soundPlayWithTTS = /FeedbackManager\.sound\.play\s*\([^)]*\{[^}]*(audio_content|(?<!\w)text)\s*:/s.test(html);
  if (soundPlayWithTTS) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.play() does not accept audio_content/text params — ' +
        'for TTS use FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})'
    );
  }

  // ── 8. sound.play() must not use onComplete callback ─────────────────────
  const hasOnComplete = /sound\.play\s*\([^)]*onComplete\s*:/s.test(html);
  if (hasOnComplete) {
    errors.push(
      'CONTRACT: sound.play() does not support onComplete callback — ' +
        'sound.play() returns a Promise; use: await sound.play(id, opts); nextAction();'
    );
  }

  // ── 9. VisibilityTracker must use sound.pause(), not sound.stopAll() ─────
  const hasStopAll = /FeedbackManager\.sound\.stopAll\s*\(/.test(html);
  if (hasStopAll) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.stopAll() destroys audio state — ' +
        'use FeedbackManager.sound.pause() in onInactive and FeedbackManager.sound.resume() in onResume'
    );
  }

  // ── 10. If sound.pause() is used, sound.resume() should also exist ───────
  const hasSoundPause = /FeedbackManager\.sound\.pause\s*\(/.test(html);
  const hasSoundResume = /FeedbackManager\.sound\.resume\s*\(/.test(html);
  if (hasSoundPause && !hasSoundResume) {
    errors.push(
      'CONTRACT: FeedbackManager.sound.pause() found but sound.resume() is missing — ' +
        'add FeedbackManager.sound.resume() in the VisibilityTracker onResume handler'
    );
  }

  // ── 11. stream.pauseAll() / stream.resumeAll() pairing ───────────────────
  const hasStreamPause = /FeedbackManager\.stream\.pauseAll\s*\(/.test(html);
  const hasStreamResume = /FeedbackManager\.stream\.resumeAll\s*\(/.test(html);
  if (hasStreamPause && !hasStreamResume) {
    errors.push(
      'CONTRACT: FeedbackManager.stream.pauseAll() found but stream.resumeAll() is missing — ' +
        'add FeedbackManager.stream.resumeAll() in the VisibilityTracker onResume handler'
    );
  }
  if (!hasStreamPause && hasStreamResume) {
    errors.push(
      'CONTRACT: FeedbackManager.stream.resumeAll() found but stream.pauseAll() is missing — ' +
        'add FeedbackManager.stream.pauseAll() in the VisibilityTracker onInactive handler'
    );
  }

  return errors;
}

function validateSignalCollectorContract(html) {
  const errors = [];

  // Only validate if SignalCollector is referenced
  const usesSignalCollector = /signalCollector/i.test(html);
  if (!usesSignalCollector) return errors;

  // ── 1. startFlushing() must be called ─────────────────────────────────────
  // Without startFlushing(), events accumulate in memory but never flush to GCS
  if (!/\.startFlushing\s*\(/.test(html)) {
    errors.push(
      'CONTRACT: SignalCollector is used but startFlushing() is never called — ' +
        'events will accumulate in memory but never flush to GCS. ' +
        'Call signalCollector.startFlushing() after configuring flushUrl from game_init signalConfig'
    );
  }

  // ── 2. signalConfig / flushUrl reference (WARNING) ────────────────────────
  // game_init handler should configure flushUrl from signalConfig
  if (!/signalConfig/.test(html) && !/flushUrl/.test(html)) {
    errors.push(
      'CONTRACT WARNING: SignalCollector is used but no "signalConfig" or "flushUrl" reference found — ' +
        'game_init handler should configure signalCollector.flushUrl from event.data.data.signalConfig'
    );
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
  errors.push(...validateFeedbackManagerContract(html));
  errors.push(...validateSignalCollectorContract(html));

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
  validateFeedbackManagerContract,
  validateSignalCollectorContract,
  EVENT_SCHEMAS,
  GAME_STATE_SCHEMA,
};
