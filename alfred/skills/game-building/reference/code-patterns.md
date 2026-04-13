# Required Code Patterns

Every game MUST implement all patterns below. Each section either references a PART (for full API details) or defines a game-building-specific rule not covered by any PART.

**Convention:** "Per PART-NNN" means the full code, constructor options, methods, and verification checklist live in `parts/PART-NNN.md`. This file only adds game-building-specific usage rules.

---

## Standalone fallback pattern (CRITICAL)

Every game listens for `game_init` from a parent window. When running standalone (local server, Playwright tests, preview), there is no parent — `game_init` never arrives — and the game stays on a blank start screen forever.

**Required pattern:** After `postMessage('game_ready')`, add a fallback timer. If no `game_init` arrives within 1000ms, call `setupGame()` directly with fallbackContent.

```javascript
window.addEventListener('message', handlePostMessage);
try { window.parent.postMessage({ type: 'game_ready' }, '*'); } catch (e) {}

// CRITICAL: standalone fallback — no parent means no game_init
setTimeout(function() {
  if (gameState.phase === 'start_screen' && !gameState.isActive) {
    setupGame();
  }
}, 1000);
```

**Why CRITICAL:** Without this, the game is untestable locally and unrenderable in standalone preview. This bug appeared in TWO consecutive Alfred-built games (Scale It Up v2 and Match Up) before being added here.

---

---

## Component References (WHAT lives in PARTs)

### gameState
Per PART-007. Game-building rules:
- Every field in data-contract.md Section 1 marked Required MUST be present.
- `window.gameState = gameState;` -- test harness reads this global.
- Lives games add `lives` and `totalLives` fields.
- See `parts/PART-007.md` for full field list and code.

### waitForPackages
Per PART-003. Game-building rules:
- Must resolve before any CDN component is used (FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector).
- Game MUST NOT block on missing packages after timeout -- proceed gracefully.
- See `parts/PART-003.md` for full implementation.

### handlePostMessage
Per PART-008. Game-building rules:
- `gameState.phase = 'playing'` MUST be the FIRST assignment inside `game_init` case. No logic before it.
- The `message` listener MUST be registered BEFORE `game_ready` is sent.
- See `parts/PART-008.md` for full protocol.

### recordAttempt
Per PART-009. Game-building rules:
- All 12 fields from data-contract.md Section 2 must be present in every attempt.
- Track `gameState.roundStartTime = Date.now()` when each round renders so `response_time_ms` is accurate.
- See `parts/PART-009.md` for field list and code.

### trackEvent
Per PART-010. Game-building rules:
- Canonical events that MUST fire: `game_start`, `game_end`, `answer_submitted`, `round_complete`.
- See `parts/PART-010.md` for event schemas.

### endGame
Per PART-011. Game-building rules:
- `gameState.phase` assignment BEFORE `syncDOM()` call (GEN-PHASE-SEQUENCE).
- `game_complete` postMessage fires on BOTH victory and game-over paths (GEN-PM-DUAL-PATH).
- `accuracy` is integer 0-100, not float 0.0-1.0.
- `completedAt` is sibling of `metrics`, not nested inside.
- `gameState.gameEnded` guard prevents double-fire.
- See `parts/PART-011.md` for full code and metrics fields.

### FeedbackManager Integration
Per PART-017 and `skills/feedback/SKILL.md`. Game-building rules:
- **CDN script:** `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`
- **Init:** `await FeedbackManager.init()` in DOMContentLoaded
- **Preload:** `await FeedbackManager.sound.preload([...])` with exact SFX URLs from `feedback/reference/feedbackmanager-api.md`
- **Static SFX:** `await FeedbackManager.sound.play(id, {sticker: STICKER_URL})` — sticker is a string URL. Awaited for terminal moments, fire-and-forget for mid-round
- **Dynamic VO:** `await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` — all VO is dynamic TTS, never preloaded
- **Sequential audio (transitions, end-game, SFX+TTS):** Always `await` first audio before starting second. Never fire both simultaneously. Use `audioStopped` flag to prevent second audio if CTA tapped during first:
  ```javascript
  var audioStopped = false;
  ctaButton.onclick = function() { audioStopped = true; FeedbackManager.sound.stopAll(); FeedbackManager._stopCurrentDynamic(); proceed(); };
  try {
    await FeedbackManager.sound.play('rounds_sound_effect', {sticker});
    if (audioStopped) return;
    await FeedbackManager.playDynamicFeedback({audio_content: 'Round 3', subtitle: 'Round 3', sticker});
  } catch(e) {}
  ```
- **Stop:** `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()` on CTA taps
- **Pause/Resume:** `FeedbackManager.sound.pause()/resume()` + `FeedbackManager.stream.pauseAll()/resumeAll()` on visibility change
- Subtitle under 60 chars. Never use "wrong" -- use "Not quite," "Close," "Almost."
- See `skills/feedback/SKILL.md` for all 17 behavioral cases and `feedback/reference/feedbackmanager-api.md` for CDN URLs.

### ScreenLayout.inject
Per PART-025. Game-building rules:
- MUST be called to create the layout scaffold. Without it, `#gameContent` never exists.
- Use v2 `sections` API, NOT deprecated `slots` API.
- See `parts/PART-025.md` for full options.

### TransitionScreen
Per PART-024. Game-building rules:
- `transitionScreen.show()` takes ONE argument -- an options object (GEN-TRANSITION-API).
- `icons` array must contain emoji strings only, never SVG/HTML/paths (GEN-TRANSITION-ICONS).
- ALL `transitionScreen.show()` calls MUST be awaited (returns a Promise).
- See `parts/PART-024.md` for full API.

### ProgressBarComponent
Per PART-023. Game-building rules:
- CDN ProgressBarComponent renders round counter + lives. Do NOT render these yourself.
- `totalLives` must be >= 1 (GEN-PROGRESSBAR-LIVES). Passing 0 causes division-by-zero.
- `slotId` must be exactly `'mathai-progress-slot'` (GEN-UX-003).
- Call `progressBar.update(currentRound, Math.max(0, lives))` after each answer (LP-PROGRESSBAR-CLAMP).
- First arg to `update()` is rounds COMPLETED, not totalRounds (GEN-112).
- Never wrap `destroy()` in `setTimeout` -- synchronous only (GEN-PROGRESSBAR-DESTROY).
- See `parts/PART-023.md` for constructor options and createProgressBar helper.

### Debug Functions
Per PART-012. See `parts/PART-012.md`.

### SignalCollector
Per PART-042. Game-building rules:
- `restartGame` must call `signalCollector.reset()` — do NOT seal + re-instantiate (GEN-SIGNAL-RESET).
- See `parts/PART-042.md` for full API.

---

## Game-Building Procedures (HOW to wire components together)

### syncDOM

```javascript
function syncDOM() {
  var app = document.getElementById('app');
  if (!app) return;
  app.setAttribute('data-phase', gameState.phase);
  app.setAttribute('data-score', gameState.score);
  // Lives games: app.setAttribute('data-lives', gameState.lives);
  // Recommended: app.setAttribute('data-round', gameState.currentRound);
}
```

**Mandatory call sites -- syncDOM MUST be called immediately after every gameState change:**
phase change, score change, lives change, round advance. At minimum 3 calls (GEN-PHASE-MCQ).
**Target:** Always `#app`. Never `document.body`. Test harness reads `#app[data-phase]`.

### Initialization Sequence

```javascript
// 1. Register listener FIRST (so game_init is not missed)
window.addEventListener('message', handlePostMessage);
// 2. Signal ready AFTER listener
window.parent.postMessage({ type: 'game_ready' }, '*');
// 3. Wait for CDN packages, then init
waitForPackages().then(function() {
  initVisibilityTracker();
  syncDOM();
  render();
});
```

### startGame

```javascript
function startGame() {
  if (gameState.isActive) return;
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.duration_data.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.isProcessing = false;
  gameState.gameEnded = false;
  gameState.phase = 'gameplay';
  // Lives games: gameState.lives = gameState.totalLives;
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  syncDOM();
  render();
}
window.startGame = startGame;
```

### Answer Handler Sequence

The core game loop MUST follow this order:
1. Guard: `if (gameState.isProcessing || gameState.gameEnded) return;` then `isProcessing = true`
2. Evaluate correctness
3. `recordAttempt()` (per PART-009 -- all 12 fields)
4. `trackEvent('answer_submitted', ...)` (per PART-010)
5. Update score/lives, `syncDOM()`
6. Visual feedback (selected-wrong/selected-correct classes, correct-reveal)
7. FeedbackManager audio (per `skills/feedback/SKILL.md`):
   - **Single-step correct/wrong (DEFAULT):** `await FeedbackManager.sound.play(id, {sticker})` → `await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` — both awaited sequentially. Dynamic TTS ALWAYS plays with context-aware explanation.
   - **Multi-step mid-round match:** `FeedbackManager.sound.play(id, {sticker}).catch(...)` — fire-and-forget. NO dynamic TTS, NO subtitle. SFX + sticker only.
   - Last-life wrong: skip wrong SFX, go to game-over
8. `isProcessing = false`, `trackEvent('round_complete')`, check end conditions, advance round

### resetGame (restartGame)

Must reset ALL mutable state: `phase`, `currentRound`, `score`, `attempts`, `events`, `duration_data`, `isActive`, `isProcessing`, `gameEnded`, plus game-specific fields (GEN-RESTART-RESET). Lives games reset `lives`. Then `syncDOM()` + `render()`.

```javascript
window.restartGame = resetGame;  // REQUIRED -- replay tests call this
```

### Window Exposures

```javascript
window.gameState = gameState;       // test harness reads state
window.endGame = endGame;           // test harness calls this
window.restartGame = resetGame;     // replay tests
window.startGame = startGame;       // test harness triggers start
window.nextRound = nextRound;       // test harness advances rounds (GEN-WINDOW-NEXTROUNDEXPOSED)
```

All five MUST be assigned (GEN-WINDOW-EXPOSE).

### getRounds with Fallback

```javascript
function getRounds() {
  if (gameState.content && gameState.content.rounds &&
      gameState.content.rounds.length >= gameState.totalRounds) {
    return gameState.content.rounds;
  }
  return fallbackContent.rounds;
}
```

`fallbackContent` MUST contain a complete set of rounds matching the spec schema. Never empty.

### getStars

```javascript
function getStars(score) {
  var total = gameState.totalRounds;
  if (score >= Math.ceil(total * 0.9)) return 3;
  if (score >= Math.ceil(total * 0.6)) return 2;
  if (score >= 1) return 1;
  return 0;
}
```

### Keyboard Handling (Input-Based Games)

If the game uses text/number input instead of MCQ:
- Use `inputmode="numeric" pattern="[0-9]*"` and `font-size: 16px` (prevents iOS zoom).
- Enter key submits via `keydown` listener.
- Keep question visible on keyboard open via `visualViewport` resize listener.
- Blur input after answer processed to dismiss keyboard.

---

## Gen Rules (pipeline-enforced, not in any PART)

### State Management

| Rule | Requirement |
|------|-------------|
| GEN-ENDGAME-GUARD | endGame guard must check `gameState.gameEnded`, NOT `!gameState.isActive` |
| GEN-RESTART-PHASE | restartGame sets phase to `'start_screen'`, not `'playing'` |
| GEN-RESTART-RESET | restartGame resets ALL mutable fields including game-specific ones |
| GEN-ROUND-INDEX | `currentRound` is 0-based in logic, 1-based in display only |
| GEN-FLIP-RESET | Per-round counters reset at start of each round |
| GEN-GAMEID | `gameState.gameId` must be the FIRST field in the object literal |
| GEN-CORRECT-ANSWER-EXPOSURE | `gameState.correctAnswer` set BEFORE `syncDOM()` in each round |

### Round Lifecycle

Every `loadRound` must begin with: (1) `isProcessing = false`, (2) `isActive = true`, (3) `syncDOM()`.

### DOM / CSS

| Rule | Requirement |
|------|-------------|
| GEN-RESULTS-FIXED | Results screen uses `position: fixed` full-viewport overlay with `z-index: 100` |
| GEN-RESULTS-DOM | `#results-screen` element must exist in DOM (test harness queries it) |
| GEN-RESULTS-ROUNDS | Results screen displays rounds completed count |
| RULE-RESULTS-1 | `showResults()` populates `#results-screen` directly, never via `transitionScreen.show()` |
| GEN-HIDDEN-CLASS | `.hidden { display: none !important; }` must be defined if `.hidden` is used |
| GEN-HIDE-SHOW | `hide()`/`show()` helpers take DOM elements, NOT selector strings |
| GEN-MOBILE-STACK | Main layout uses `flex-direction: column` (portrait mobile) |
| GEN-DOM-CACHE | Cache DOM refs at init. No `getElementById` inside per-round render |
| GEN-CANVAS-001 | Canvas uses `max-width: 100%; height: auto` for responsive sizing |
| GEN-CSS-TOKENS | Feedback colors use `--mathai-success`, `--mathai-error`, `--mathai-warning` only |
| GEN-UX-004 | Never use `alert()`, `confirm()`, or `prompt()` |
