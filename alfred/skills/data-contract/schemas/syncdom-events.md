# syncDOM, Events, and Platform Contracts

This file covers cross-PART integration rules — things that span multiple PARTs and aren't in any single PART file.

## syncDOM Contract

Per **PART-007** (gameState) + test harness requirements:

- Target: `document.getElementById('app')` — NEVER `document.body`
- Required attributes: `data-phase`, `data-score`
- Conditional: `data-lives` (lives-based games), `data-round` (all games)
- Call after EVERY state change (phase, score, lives, round)
- HTML init: `<div id="app" data-phase="start_screen" data-score="0" data-lives="3"></div>`

See PART-007 for field definitions. See `parts/PART-007.md`.

## trackEvent Contract

Per **PART-010** (Event Tracking). See `parts/PART-010.md`.

Alfred requires these canonical events:
- `game_start` — with totalRounds
- `game_end` — with score, lives, stars, rounds_played
- `answer_submitted` — with round, correct, response_time_ms

## Debug Functions

Per **PART-012** (Debug Functions). See `parts/PART-012.md`.

Required on window: `debugGame`, `debugAudio`, `testAudio`, `testPause`, `testResume`.

## SignalCollector

Per **PART-042** (SignalCollector). See `parts/PART-042.md`.

Alfred-specific rules:
- All 6 properties must be assigned from signalConfig: `playId`, `gameId`, `sessionId`, `contentSetId`, `studentId`, `flushUrl`
- `signalConfig` extracted from `event.data.config.signalConfig` in game_init handler
- `seal()` called in endGame BEFORE game_complete postMessage
- game_complete data must include `signal_event_count` and `signal_metadata` from seal() result
- `restartGame` must call `signalCollector.reset()` — do NOT seal + re-instantiate — per GEN-SIGNAL-RESET

## FeedbackManager Contract Rules

Per **PART-017** (FeedbackManager). See `parts/PART-017.md`.

Alfred-specific integration rules (cross-PART, tested by validate-contract.js):

| ID | Rule | Severity |
|----|------|----------|
| FM-1 | `FeedbackManager.init()` required before any feedback calls (when PART-017=YES) | CRITICAL |
| FM-2 | `new Audio()` forbidden — use FeedbackManager only | CRITICAL |
| FM-3 | Direct `SubtitleComponent.show()` forbidden — use `playDynamicFeedback` | CRITICAL |
| FM-4 | `playDynamicFeedback` is on `FeedbackManager`, NOT `FeedbackManager.sound` | CRITICAL |
| FM-5 | `sound.play()` must NOT pass `audio_content` or `text` params | CRITICAL |
| FM-6 | `sound.play()` must NOT use `onComplete` callback (returns Promise) | STANDARD |
| FM-7 | `sound.stopAll()` forbidden — use `pause()`/`resume()` | CRITICAL |
| FM-8 | `sound.pause()` requires paired `sound.resume()` | STANDARD |
| FM-9 | `stream.pauseAll()`/`stream.resumeAll()` must be paired | STANDARD |
| FM-10 | `PreviewScreenComponent` requires `duration_data.preview` | STANDARD |
| FM-11 | `calcStars` must be exposed on `window` | CRITICAL |

For FeedbackManager API details (constructor, methods, parameters), see PART-017.
