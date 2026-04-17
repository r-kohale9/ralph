# Required Code Patterns

Every game MUST implement all patterns below. Each section either references a PART (for full API details) or defines a game-building-specific rule not covered by any PART.

**Convention:** "Per PART-NNN" means the full code, constructor options, methods, and verification checklist live in `parts/PART-NNN.md`. This file only adds game-building-specific usage rules.

---

## Standalone fallback pattern (CRITICAL)

Every game listens for `game_init` from a parent window. When running standalone (local server, Playwright tests, preview), there is no parent — `game_init` never arrives — and the game stays on a blank start screen forever.

**Required pattern:** Add a fallback timer that runs **independently of `waitForPackages()`**. The fallback must be able to fire even if CDN packages never load.

```javascript
// Inside DOMContentLoaded, AFTER registering the message listener and sending game_ready:

// 1. Start waitForPackages (may take up to 180s if CDN is down)
waitForPackages().then(function(loaded) {
  // ... init CDN components ...
  setupGame();
});

// 2. Standalone fallback — runs INDEPENDENTLY, not nested inside waitForPackages
//    Builds fallback layout if ScreenLayout didn't load, then starts the game.
setTimeout(function() {
  if (!gameState.isActive && !gameState.gameEnded) {
    if (!document.getElementById('gameContent')) {
      buildFallbackLayout();
      // ... populate slots with innerHTML ...
    }
    gameState.content = fallbackContent;
    gameState.totalRounds = fallbackContent.rounds.length;
    setupGame();
    startGame();
  }
}, 2000);
```

**Why CRITICAL:** Without this, the game is untestable locally and unrenderable in standalone preview. This bug appeared in THREE Alfred-built games before being corrected.

**Anti-pattern (CRITICAL):** Never nest the standalone fallback inside `waitForPackages().then(...)`. If CDN packages fail to load, `waitForPackages` blocks for 180s — the standalone fallback never fires, and Playwright tests time out waiting for the game to start. The fallback MUST be a top-level `setTimeout` that runs regardless of CDN availability.

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
- **CRITICAL — Minimum Feedback Duration:** `sound.play()` can resolve BEFORE audio finishes. ALL answer-feedback calls (`sound_life_lost`, `sound_correct`, `wrong_tap`, `correct_tap`, `sound_incorrect`, `all_correct`, `all_incorrect_*`, `partial_correct_*`) MUST use `Promise.all` with a 1500ms floor: `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ]);` — guarantees audio fully plays before round advance / tile reset / game-over. Does NOT apply to VO or transition audio. Validator rule `5e0-FEEDBACK-MIN-DURATION`. See PART-026 Anti-Pattern 34.
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
- **No `Promise.race` on FeedbackManager calls (CRITICAL).** Package already bounds resolution (`sound.play` → audio-duration + 1.5s guard; `playDynamicFeedback` → 60s streaming / 3s TTS API). Plain `await FeedbackManager.sound.play(...)` / `await FeedbackManager.playDynamicFeedback(...)` inside `try/catch` is the only correct pattern — "non-blocking" means `try/catch`, NOT `Promise.race`. A helper like `audioRace(p) => Promise.race([p, setTimeout(r, 800)])` truncates normal TTS (1–3s) and causes phase/round transitions to fire before audio ends. Validator rule `5e0-FEEDBACK-RACE-FORBIDDEN` blocks any such race. See PART-017 + PART-026 Anti-Pattern 32.
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
- **Every transition screen MUST play audio** (SFX ± dynamic VO). No silent transitions. Fire via the `onMounted` callback: `onMounted: () => FeedbackManager.sound.play('<id>', { sticker })`. Approved IDs per PART-024: `vo_game_start`, `sound_game_complete`, `sound_game_over`, `vo_level_start_N`, `vo_motivation`.
- **`stars:` and `icons:` are mutually exclusive.** TransitionScreenComponent renders them into the same `.mathai-ts-icons` DOM element — `stars:` always wins, so any `icons: [...]` emoji silently disappears. Pick one per screen: Victory passes `stars: N`; Game Over / Round Intro / Motivation / Stars Collected pass `icons: ['<emoji>']`. Do NOT pass both. `test/content-match.test.js` fails the build if you do.
- **CRITICAL: `show()` Promise resolves IMMEDIATELY (next rAF after `onMounted` fires) — NOT when a button is tapped, NOT after a `duration`.** `duration` and `persist` are documented in the options table but the CDN component does NOT implement either — `show()` never reads them. Code after `await transitionScreen.show(...)` runs before the student interacts with the screen. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. If you put continuation code after `await show()`, the screen flashes for one frame then gets replaced. For auto-dismiss screens (round intro), fire audio + `hide()` + continuation inside the `onMounted` IIFE. Validator rule `5e2-TS-PERSIST-FALLTHROUGH` blocks the anti-pattern.
- **Audio + render sequence for Victory / Game Over:** `await transitionScreen.show({ content: metricsHTML, buttons: [...], onMounted: () => FeedbackManager.sound.play(...) })`. The `onMounted` fires the audio after DOM mounts. If a button click should interrupt audio, call `FeedbackManager.sound.stopAll()` in the `action` handler. The button `action` callback MUST contain `transitionScreen.hide()` AND all game-flow continuation (`restartGame()`, `showMotivation()`, etc.).
- Button labels come from `pre-generation/screens.md` verbatim. See "Plan → build contract" in `flow-implementation.md`.
- See `parts/PART-024.md` for full API.

### ProgressBarComponent
Per PART-023. Game-building rules:
- CDN ProgressBarComponent renders round counter + lives. Do NOT render these yourself.
- **CRITICAL: No custom lives/hearts DOM or renderer.** When `totalLives >= 1`, ProgressBar already paints the hearts strip inside `#mathai-progress-slot`. Any game-owned element with `class`/`id` matching `lives-row`, `lives-strip`, `lives-container`, `lives-display`, `hearts-row`, `hearts-strip`, `hearts-container`, `livesRow`, `heartsRow`, or a single-class `heart` — or any function named `renderLivesRow`, `renderLives`, `renderHearts`, `updateLivesDisplay`, `updateLivesRow`, `updateHearts`, `buildLives`, `injectLives` — paints a **second** hearts row on top of the CDN strip (symptom: two rows of hearts visible on-screen). Validator rule `5e0-LIVES-DUP-FORBIDDEN` blocks this. Emit heart glyphs (❤️ 🤍 🩷 ♡ ♥) ONLY through the CDN ProgressBar, never via your own `innerHTML` strings or `<span class="heart">` loops. For a heart-break animation, target the CDN-rendered heart class with a one-shot CSS class — do NOT replicate the hearts in your own DOM. See PART-023 and PART-026 Anti-Pattern 33.
- `totalLives` must be >= 1 (GEN-PROGRESSBAR-LIVES). Passing 0 causes division-by-zero.
- `slotId` must be exactly `'mathai-progress-slot'` (GEN-UX-003). **Do NOT use `'previewProgressBar'`** or `'progress-bar-container'` — those are different things (see ID disambiguation below).
- **ID disambiguation.** `#previewProgressBar` is the audio countdown strip **inside the preview header** (~4px tall, populated by PreviewScreenComponent during preview state — it animates full → empty as preview audio plays). `#mathai-progress-slot` is a **separate** element ScreenLayout creates at the top of `.game-stack` for the round counter + lives bar. Two different elements, two different purposes. If you instantiate ProgressBarComponent with `slotId: 'previewProgressBar'`, the round bar mounts into the countdown strip and crushes the whole header row.
- `ScreenLayout.inject` slots MUST include `progressBar: true` for the slot to be created in preview-wrapper mode (`slots: { previewScreen: true, progressBar: true, transitionScreen: true }`).
- **`update(roundsCompleted, livesRemaining)`** — first arg is rounds **completed**, not the current round number. On start: `update(0, totalLives)`. Entering round N: `update(N-1, livesLeft)`. After correct feedback on round N: `update(N, livesLeft)`. After wrong feedback: `update(roundsCompleted, livesLeft-1)` (hearts decrement only). On restart: `update(0, totalLives)`.
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

### PreviewScreen
Per PART-039. Game-building rules:
- **Default ON, opt-out via spec.** Every game includes the preview UNLESS the spec declares top-level `previewScreen: false`. When enabled (the default), `ScreenLayout.inject` must include `slots: { previewScreen: true, ... }` and the rules below apply. When opted out: OMIT the `previewScreen` key from `slots` entirely, do NOT instantiate `PreviewScreenComponent`, do NOT emit any `#mathai-preview-slot` / `.mathai-preview-body` references, and have `DOMContentLoaded` call the first TransitionScreen (level/round intro) directly — no `setupGame()` / `showPreviewScreen()`. Existing pre-PART-039 templates (`make-x`, `estimate-it`, `keep-track`) show the no-preview initial-screen pattern. The rest of this section applies only to the enabled case.
- **Single source of instructions — STRICT.** The how-to-play copy is delivered ONCE via `content.previewInstruction` + `content.previewAudioText`. Gameplay screens (the DOM inside `#gameContent`) MUST NOT render ANY of the following:
  - A static instruction / prompt banner repeating or paraphrasing the preview instruction (e.g. "Find the two tiles...", "Tap two tiles...", "Select the correct answer").
  - Any element with a class/id containing `instruction`, `help-text`, `prompt-text`, `task-text`, `directions`, `how-to-play`.
  - Verbs like "Find", "Tap", "Select", "Choose", "Click", "Drag" as a heading/banner inside `#gameContent`. The preview already said it.
  A per-round *prompt* is allowed ONLY when it carries round-specific information that is NOT in the preview (e.g. "What is 3 × 4?" — the question itself; "Match the shapes below" after a round-type change screen). Generic how-to-play restated in different words is NOT distinct — it duplicates.
  When in doubt: omit the gameplay banner. Players already heard/read the preview. If the round-type change is material, convey it via a Round-N-intro TransitionScreen, not a banner.
- Instantiated in DOMContentLoaded with `{ slotId: 'mathai-preview-slot' }` only. Do NOT pass `autoInject`, `gameContentId`, `previewContent`, `questionLabel`, `score`, or `showStar`.
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview, timerConfig, timerInstance, onComplete })` is called as the LAST step of `setupGame()` — after `#gameContent` has been rendered.
- Preview audio URL sourced from `content.previewAudio || fallbackContent.previewAudio || null`. Never hardcode.
- **Audio URL source hierarchy** (PART-039 layer order): `content.previewAudio` → `fallbackContent.previewAudio` → runtime TTS fallback using `previewAudioText` → 5s silent timer. The component handles the TTS fallback internally when `audioUrl` is null; you do NOT need to generate TTS yourself at runtime. Deploy step patches `fallbackContent.previewAudio` with a CDN URL from `previewAudioText` TTS.
- **`previewScreen.isActive()`** returns `true` while the preview overlay is mounted (between `show()` and `switchToGame()`). Use this in any timed fallback (setTimeout, requestIdleCallback, race-guards) that might otherwise fire during a live preview. Preview does NOT mutate `gameState.phase`, so `phase === 'start_screen'` stays true for the entire preview — `isActive()` is the authoritative signal. See `html-template.md` rule 11 (standalone-fallback gate).
- `onComplete` callback receives `previewData` and must call `startGameAfterPreview(previewData)` — see pattern below.
- `endGame()` calls `previewScreen.destroy()`.
- `restartGame()` must NOT call `previewScreen.show()` or `setupGame()` — preview is once per session.
- `hide()` does NOT exist. Do not call it.
- VisibilityTracker's `onInactive`/`onResume` must also invoke `previewScreen.pause()`/`previewScreen.resume()`. Canonical wiring:
  ```javascript
  visibilityTracker = new VisibilityTracker({
    onInactive: function() {
      try { FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); } catch(e) {}
      try { if (previewScreen) previewScreen.pause(); } catch(e) {}
    },
    onResume: function() {
      try { FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); } catch(e) {}
      try { if (previewScreen) previewScreen.resume(); } catch(e) {}
    }
  });
  ```
- See `parts/PART-039.md` for full API and `warehouse/parts/PART-039-preview-screen.md` for authoritative spec.

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
   - **Single-step correct/wrong (DEFAULT):** `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ])` → `await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` ��� SFX wrapped in Promise.all for minimum duration, then dynamic TTS awaited sequentially. Dynamic TTS ALWAYS plays with context-aware explanation.
   - **Multi-step mid-round match:** `FeedbackManager.sound.play(id, {sticker}).catch(...)` — fire-and-forget. NO dynamic TTS, NO subtitle. SFX + sticker only.
   - Last-life wrong: skip wrong SFX, go to game-over
8. `isProcessing = false`, `trackEvent('round_complete')`, check end conditions, advance round

### resetGame (restartGame)

Must reset ALL mutable state: `phase`, `currentRound`, `score`, `attempts`, `events`, `duration_data`, `isActive`, `isProcessing`, `gameEnded`, plus game-specific fields (GEN-RESTART-RESET). Lives games reset `lives`. Then `syncDOM()` + `render()`.

```javascript
window.restartGame = resetGame;  // REQUIRED -- replay tests call this
```

**Do NOT call `previewScreen.show()` or `setupGame()` from `restartGame()`.** Preview is shown once per session. Split the reset portion from the preview portion of `setupGame()` — `restartGame` reruns only the reset + first-round entry.

### Preview screen integration (setupGame + startGameAfterPreview)

Canonical trio per PART-039. Game DOM MUST be rendered into `#gameContent` BEFORE `previewScreen.show()` is called; `gameState.startTime` is set in `startGameAfterPreview`, NOT in `setupGame`.

```javascript
function setupGame() {
  var content = gameState.content || fallbackContent;
  // 1. Render initial round UI into #gameContent FIRST
  injectGameHTML();
  renderInitialState();

  // 2. Show preview LAST
  previewScreen.show({
    instruction: content.previewInstruction || fallbackContent.previewInstruction,
    audioUrl: content.previewAudio || fallbackContent.previewAudio || null,
    showGameOnPreview: content.showGameOnPreview === true,
    timerConfig: timer ? { type: 'decrease', startTime: 60, endTime: 0 } : null,
    timerInstance: timer || null,
    onComplete: function(previewData) { startGameAfterPreview(previewData); }
  });
}

function startGameAfterPreview(previewData) {
  gameState.previewResult = previewData;
  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (timer && timer.start) timer.start();
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  if (signalCollector) signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });

  renderRound(); // first gameplay entry
}
```

**Restart path** (no preview):
```javascript
function restartGame() {
  resetGameState();               // reset all fields per GEN-RESTART-RESET
  if (signalCollector) signalCollector.reset();
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  renderRound();  // or showLevelTransition() for sectioned games
}
```

`endGame()` must call `previewScreen.destroy()` as part of cleanup.

### Wrapper persistence — showVictory / showGameOver pattern (CRITICAL)

Victory, Game Over, Play Again, and Try Again render **inside** the preview wrapper. The header (avatar, score, star) stays visible; the preview slot is never hidden or detached. Mount results via `TransitionScreenComponent.show(...)` into `mathai-transition-slot` (a sibling of `#gameContent` inside `.game-stack`). Do NOT create a top-level `#results-screen` overlay, do NOT call `previewScreen.destroy()` at this point, do NOT set `style.display='none'` on `mathai-preview-slot`, and do NOT re-parent `#gameContent`.

**Results mounting rule (PART-024):** pass the results metrics HTML via `transitionScreen.show({ content: metricsHTML, persist: true, buttons: [...] })`. `content` is rendered inside the transition card; `persist: true` keeps it visible until a button is tapped. Never create a sibling `<div id="results-screen">` overlay and never hide the preview wrapper to make room for it.

**All user-visible strings come from `pre-generation/screens.md`, not from this file.** The snippets below show *structure*; **title, subtitle, button labels (count + order), sticker/icon emoji, and audio id** for each transition are copied verbatim from the corresponding Elements table in `screens.md`. Do NOT invent extra buttons, do NOT rename buttons, do NOT alter titles/subtitles. Template variables in screens.md (`N`, `M`, `[Title]`, numeric examples like `"Round 1"`) are matched via placeholder — your HTML can concatenate `'Round ' + roundNum` and still match. `test/content-match.test.js` enforces this and fails the build on drift.

**Default transition screens** — `game_over`, `motivation`, `victory`, `stars_collected` have canonical templates in `alfred/skills/game-planning/reference/default-transition-screens.md`. The planner copies those verbatim into `screens.md`; game-building reads screens.md and emits the matching `transitionScreen.show(...)`. Short summary of the structural defaults (strings live in the planning doc):
- **Game Over** → `icons: ['😔']`, title "Game Over", subtitle "You ran out of lives!", single `Try Again` button.
- **Motivation** → no icons, title "Ready to improve your score? ⚡", single `I'm ready! 🙌` button.
- **Victory** → `stars: gameState.stars`, title "Victory 🎉", per-game subtitle, buttons depend on stars: `Claim Stars` alone for 3★, `Play Again` + `Claim Stars` (horizontal) otherwise.
- **Stars Collected** → no icons/stars/subtitle/buttons, two-line title via `styles: { title: { whiteSpace: 'pre-line' } }`, auto-dismiss via `duration: 2500`.

```javascript
async function showVictory() {
  gameState.phase = 'results';
  gameState.isActive = false;
  syncDOM();
  progressBar.update(totalRounds, gameState.livesLeft);
  await transitionScreen.show({
    title: /* from screens.md */ 'Victory!',
    stars: getStars(),
    // Buttons: copy verbatim from screens.md Elements table for the victory screen.
    // Include conditional rules (e.g. "Play Again only if stars < 3") if screens.md states them.
    buttons: [
      // { text: '<exact label from screens.md>', type: 'primary', action: () => { transitionScreen.hide(); /* route per screens.md exit condition */ } }
    ],
    onMounted: () => FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })
  });
}

async function showGameOver() {
  gameState.phase = 'game_over';
  gameState.isActive = false;
  syncDOM();
  await transitionScreen.show({
    title: /* from screens.md */ 'Game Over',
    // Buttons: copy verbatim from screens.md. Do NOT add an Exit/Cancel/Skip unless screens.md lists one.
    buttons: [
      // { text: '<exact label from screens.md>', type: 'primary', action: () => { transitionScreen.hide(); /* route per screens.md exit condition */ } }
    ],
    onMounted: () => FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })
  });
}

// ONE endGame — the only place destroy() fires.
function endGame(won) {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  trackEvent('game_end', { won: won, score: gameState.score, stars: getStars() });
  postGameComplete(won);          // includes previewResult: gameState.previewResult || null
  previewScreen.destroy();        // EXACTLY ONCE, HERE
}
```

### Preview timer sync

When the game has a `TimerComponent`, pass `timerConfig` + `timerInstance` into `previewScreen.show()`. The PreviewScreen reads the game's TimerComponent each frame via `requestAnimationFrame` and mirrors it in the header — the game still owns `timer.start()` / `timer.pause()`. Game CSS MUST NOT override `.mathai-preview-header .mathai-timer-*` classes.

### Audio permission gate

The preview's internal timer does not start until `FeedbackManager.init()` resolves and audio permission is granted. `gameState.startTime` MUST remain `null` while `previewScreen.getState() === 'preview'`; it is set only in `startGameAfterPreview()` after `onComplete` fires.

### Preview audio — no `new Audio()`

All preview audio flows through `FeedbackManager.sound.preload([{id, url}])` at init and `FeedbackManager.sound.play(id)` at runtime. `new Audio(` anywhere in game code is a fail — preview audio specifically, and game audio generally, must route through FeedbackManager.

### onPreviewInteraction

Only needed for interactive preview content (e.g. video, tap-to-reveal). Default omit. If used, callback receives `(key, value)` from `setPreviewData()` and the resulting data is available on `previewData` in `onComplete`.

### game_complete payload — previewResult

When building the `game_complete` postMessage payload, include `previewResult: gameState.previewResult || null`. Required when preview was interactive. See `data-contract.md` for full schema.

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
