# PART-026: Anti-Patterns (Common Mistakes)

**Category:** REFERENCE | **Condition:** Always loaded as verification checklist (not a code-generating part) | **Dependencies:** PART-002, PART-003

---

## Purpose

Critical mistakes that LLMs commonly make when generating game HTML. Avoid ALL of these.

## Anti-Pattern 1: Manual Timer Implementation

```javascript
// WRONG - Do NOT create custom timers
let seconds = 60;
setInterval(() => {
  seconds--;
  document.getElementById("timer").textContent = seconds;
}, 1000);
```

**Correct:** Use `TimerComponent` from PART-006.

## Anti-Pattern 2: Direct Audio Creation

```javascript
// WRONG - Do NOT use new Audio()
const sound = new Audio("correct.mp3");
sound.play();
```

**Correct:** Use `FeedbackManager.sound.play()` from PART-017.

## Anti-Pattern 0: Hallucinated or Relative Script URLs

```html
<!-- WRONG: Relative paths — these files do NOT exist on disk -->
<script src="../../../warehouse/packages/timer-component.js"></script>
<script src="../../../warehouse/packages/progress-bar-component.js"></script>
<script src="../../../warehouse/packages/signal-collector.js"></script>

<!-- WRONG: Invented CDN domains — none of these exist -->
<script src="https://cdn.homeworkapp.ai/packages/FeedbackManager.js"></script>
<script src="https://cdn.homeworkapp.ai/packages/Components.js"></script>
<script src="https://cdn.homeworkapp.ai/packages/Helpers.js"></script>
<script src="https://cdn.homeworkapp.ai/sentry/helpers/sentry/index.js"></script>
<script src="https://cdn.homeworkapp.ai/packages/mathai-widgets/latest/MathAIWidgets.js"></script>
```

**The game has exactly 4 script URLs. Copy them verbatim — never invent alternatives:**

| What it loads | Exact URL |
|---------------|-----------|
| SentryConfig | `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js` |
| FeedbackManager | `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js` |
| Components | `https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js` |
| Helpers | `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js` |

**These 3 bundles expose ALL game classes.** There are no separate script files per class:

| Class | Comes from |
|-------|-----------|
| `FeedbackManager` | `feedback-manager/index.js` |
| `TimerComponent` | `components/index.js` |
| `ProgressBarComponent` | `components/index.js` |
| `TransitionScreenComponent` | `components/index.js` |
| `ScreenLayout` | `components/index.js` |
| `VisibilityTracker` | `helpers/index.js` |
| `SignalCollector` | `helpers/index.js` |

## Anti-Pattern 3: Wrong Package Loading Order

```html
<!-- WRONG ORDER -->
<script src=".../components/index.js"></script>
<script src=".../feedback-manager/index.js"></script>
```

**Correct:** FeedbackManager FIRST, then Components, then Helpers (PART-002).

## Anti-Pattern 4: Missing waitForPackages

```javascript
// WRONG - Packages may not be loaded yet
window.addEventListener("DOMContentLoaded", async () => {
  await FeedbackManager.init(); // May throw "FeedbackManager is not defined"
});
```

**Correct:** Always call `waitForPackages()` first (PART-003).

## Anti-Pattern 5: Using SubtitleComponent.show() Directly

```javascript
// WRONG - SubtitleComponent is internal to FeedbackManager
SubtitleComponent.show({ text: "Great job!" });
```

**Correct:** Pass subtitle as prop to `FeedbackManager.sound.play(id, { subtitle: '...' })`.

## Anti-Pattern 6: No Timeout on Package Loading

```javascript
// WRONG - Hangs forever if CDN is down
async function waitForPackages() {
  while (typeof FeedbackManager === "undefined") {
    await new Promise((r) => setTimeout(r, 50));
  }
}
```

**Correct:** Always include 10-second timeout (PART-003).

## Anti-Pattern 7: Hardcoded Colors

```css
/* WRONG - Hardcoded values */
.correct {
  background: #219653;
}
.incorrect {
  background: #e35757;
}
```

**Correct:** Use CSS variables: `var(--mathai-green)`, `var(--mathai-red)` (PART-020).

## Anti-Pattern 8: Non-Global onclick Handlers

```javascript
// WRONG - Function defined inside DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
  function handleClick() {
    /* ... */
  } // Not accessible from HTML onclick
});
```

**Correct:** Define functions at global scope (RULE-001).

## Anti-Pattern 9: Missing VisibilityTracker

```javascript
// WRONG - Timer keeps running when tab is hidden
const timer = new TimerComponent(...);
timer.start();
// No VisibilityTracker = timer never pauses
```

**Correct:** Always create VisibilityTracker with onInactive/onResume (PART-005).

## Anti-Pattern 10: Raw Object Logging

```javascript
// WRONG - Objects don't display properly in some environments
console.log("State:", gameState);
```

**Correct:** `console.log('State:', JSON.stringify(gameState, null, 2))` (RULE-004).

## Anti-Pattern 11: Multiple Script/Style Blocks

```html
<!-- WRONG - Multiple blocks -->
<style>
  /* block 1 */
</style>
<style>
  /* block 2 */
</style>
<script>
  /* block 1 */
</script>
<script>
  /* block 2 */
</script>
```

**Correct:** Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007).

## Anti-Pattern 12: Using 100vh Instead of 100dvh

```css
/* WRONG - Doesn't account for mobile safe areas */
.page-center {
  min-height: 100vh;
}
```

**Correct:** Use `100dvh` for mobile safe-area awareness (PART-021).

## Anti-Pattern 13: Game HTML Outside ScreenLayout

```html
<!-- WRONG - Game content as sibling of #app, outside the layout wrapper -->
<div id="app"></div>
<div id="game-screen">
  <div class="game-grid">...</div>
</div>
```

**Correct:** Use `<template>` + cloneNode into `#gameContent` after `ScreenLayout.inject()` (PART-025).

## Anti-Pattern 14: Grid Without Pixel Max-Width

```css
/* WRONG - Grid expands to full viewport width on desktop */
.game-grid {
  max-width: 100%;
}
```

**Correct:** Always set a pixel cap: `max-width: 360px; margin: 0 auto;` (PART-027).

## Anti-Pattern 15: Wrong API for Dynamic Audio (TTS)

```javascript
// WRONG - 'dynamic' is not a registered sound ID, causes permission popup with no audio
await FeedbackManager.sound.play("dynamic", { text: "Great job!" });
```

**Correct:** `await FeedbackManager.playDynamicFeedback({ audio_content: '...', subtitle: '...' })` (PART-017).

## Anti-Pattern 16: ProgressBar update() with Current Round Instead of Completed

```javascript
// WRONG - On a totalRounds=1 game, this shows "1/1" = 100% at game start
progressBar.update(gameState.currentRound, lives); // currentRound starts at 1
```

**Correct:** Pass rounds COMPLETED (0 at start): `progressBar.update(0, lives)` (PART-023).

## Anti-Pattern 17: Grid Cells Without overflow:hidden

```css
/* WRONG - Pseudo-elements (diagonal lines, badges) escape cell boundaries */
.grid-cell {
  /* no overflow rule */
}
```

**Correct:** Always add `overflow: hidden` to grid cells that use `::before`/`::after` pseudo-elements.

## Anti-Pattern 18: Using `sound.register()` Instead of `sound.preload()`

```javascript
// WRONG - register() does not exist on FeedbackManager.sound
await FeedbackManager.sound.register('correct_tap', 'https://cdn.mathai.ai/.../audio.mp3');
await FeedbackManager.sound.register('wrong_tap', 'https://cdn.mathai.ai/.../audio.mp3');
```

**Correct:** Use `preload()` with an array of `{id, url}` objects — a single batch call:
```javascript
await FeedbackManager.sound.preload([
  { id: 'correct_tap', url: 'https://cdn.mathai.ai/.../audio.mp3' },
  { id: 'wrong_tap', url: 'https://cdn.mathai.ai/.../audio.mp3' }
]);
```

## Anti-Pattern 19: Using `sound.stopAll()` in VisibilityTracker

```javascript
// WRONG - stopAll() destroys audio state, resume() has nothing to work with
onInactive: () => {
  FeedbackManager.sound.stopAll();
}
```

**Correct:** Use `sound.pause()` / `sound.resume()` to preserve audio state across tab switches (PART-005).

## Anti-Pattern 20: Inline Stub/Polyfill for CDN Packages

```html
<!-- WRONG - Defining a stub class prevents the real CDN package from loading -->
<script>
  window.SignalCollector =
    window.SignalCollector ||
    class SignalCollector {
      constructor(opts) {
        this.opts = opts;
      }
      startProblem() {}
      endProblem() {}
      // ... stub methods
    };
</script>
```

The real CDN script checks `if (window.SignalCollector)` and skips initialization if it already exists. A stub will shadow the real package permanently.

**Correct:** Never define inline stubs, polyfills, or fallback classes for CDN packages (FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector, ProgressBarComponent, TransitionScreenComponent, ScreenLayout). These are loaded via `<script>` tags (PART-002) and awaited by `waitForPackages()` (PART-003). If a package isn't available, `waitForPackages()` will timeout after 10s — that's the correct error path.

## Anti-Pattern 21: Self-Recursive window.loadRound

```javascript
// WRONG — Infinite recursion → "Maximum call stack size exceeded"
// In sloppy mode, unqualified loadRound() resolves to window.loadRound (the wrapper itself)
window.loadRound = function(n) {
  gameState.currentRound = n - 1;
  loadRound();  // ← calls window.loadRound → calls itself → stack overflow
};
```

**Correct:** Call the game's render function directly — never call `loadRound()` from inside `window.loadRound`:
```javascript
// RIGHT — calls renderRound (or renderQuestion, displayRound, etc.)
window.loadRound = function(n) {
  gameState.currentRound = n - 1;
  gameState.gameEnded = false;
  gameState.isProcessing = false;
  renderRound();  // ← the actual render function, NOT loadRound
};
```

Also never call `nextRound()` from `window.loadRound` — `nextRound` increments `currentRound` before rendering, causing a double-increment.

## Anti-Pattern 22: Setting gameState.startTime Before Preview Ends

```javascript
// WRONG — startTime set during init, before preview screen finishes
function setupGame() {
  gameState.startTime = Date.now();  // Too early! Preview hasn't ended yet
  gameState.isActive = true;
  showPreviewScreen();
}
```

**Correct:** Set `startTime` in `startGameAfterPreview()`, AFTER preview completes:
```javascript
function startGameAfterPreview(previewData) {
  gameState.startTime = Date.now();  // Correct — preview is done
  gameState.isActive = true;
  renderRound();
}
```

## Anti-Pattern 23: Using new Audio() for Preview Audio

```javascript
// WRONG — preview audio bypasses FeedbackManager
const previewAudio = new Audio(content.previewAudio);
previewAudio.play();
```

**Correct:** Use `FeedbackManager.sound.preload()` and `FeedbackManager.sound.play()` for all audio including preview.

## Anti-Pattern 24: Not Tracking Preview Duration

```javascript
// WRONG — preview duration not recorded
previewScreen.show({ onComplete: function() { startGame(); } });
```

**Correct:** Record preview duration in `duration_data.preview[]`:
```javascript
previewScreen.show({
  onComplete: function(previewData) {
    gameState.duration_data.preview = gameState.duration_data.preview || [];
    gameState.duration_data.preview.push({ duration: previewData.duration });
    startGameAfterPreview(previewData);
  }
});
```

## Anti-Pattern 25: Video Without Controls

```html
<!-- WRONG — user cannot play the video -->
<video src="instruction.mp4" playsinline></video>
```

**Correct:** Always include `controls` + `playsinline` + `controlsList="nofullscreen"`:
```html
<video src="instruction.mp4" controls playsinline webkit-playsinline
       preload="auto" controlsList="nofullscreen"></video>
```

## Anti-Pattern 26: Autoplay Video

```html
<!-- WRONG — autoplay is blocked by browser policies, fails silently -->
<video src="instruction.mp4" autoplay controls playsinline></video>
```

**Correct:** User must explicitly tap play:
```html
<video src="instruction.mp4" controls playsinline controlsList="nofullscreen"></video>
```

## Anti-Pattern 27: Black Video Background

```css
/* WRONG — dark background clashes with app theme, hides dark video content */
.video-container { background: #000; }
```

**Correct:** White background per production `VideoPart.tsx` pattern:
```css
.video-wrapper { background: white; border-radius: 12px; overflow: hidden; }
```

## Anti-Pattern 28: Forced Aspect Ratio on Video

```css
/* WRONG — forces video into unnatural proportions, causes black bars */
.video-container { aspect-ratio: 9 / 16; width: 100%; height: 400px; }
.video-container video { object-fit: contain; }
```

**Correct:** Let video determine its own natural dimensions:
```css
.video-wrapper { width: 100%; }
.video-wrapper video { width: 100%; display: block; }
```

## Anti-Pattern 29: Video in Play Area

```html
<!-- WRONG — video inside interactive click/tap zone -->
<div id="gameContent">
  <div class="game-play-area">
    <video src="instruction.mp4" controls></video>
    <div class="options-container"><!-- clickable options --></div>
  </div>
</div>
```

**Correct:** Video in instruction area, interaction elements in play area:
```html
<div id="gameContent">
  <div class="instruction-area">
    <p class="instruction-text">Watch the pattern</p>
    <div class="video-wrapper">
      <video src="instruction.mp4" controls playsinline controlsList="nofullscreen"></video>
    </div>
  </div>
  <div class="game-play-area">
    <div class="options-container"><!-- clickable options --></div>
  </div>
</div>
```

## Anti-Pattern 30: new Audio() for Content Audio

```javascript
// WRONG — new Audio() violates RULE-006 and cannot be tracked in DOM
var audio = new Audio('instruction.mp3');
audio.play();
```

**Correct:** Use `<audio>` element in DOM with custom UI (PART-041):
```html
<audio id="gameAudio" preload="auto"><source src="instruction.mp3" type="audio/mpeg"></audio>
```
```javascript
document.getElementById('gameAudio').play();
```

## Anti-Pattern 31: Native Controls on Content Audio

```html
<!-- WRONG — native controls look different per browser, don't match app design -->
<audio src="instruction.mp3" controls></audio>
```

**Correct:** Hidden `<audio>` with custom play/pause icon + progress bar matching `RenderAudioBlock.tsx`:
```html
<div class="audio-player">
  <img class="audio-play-btn" src=".../play-icon-yellow.svg" onclick="toggleAudioPlayback()" />
  <div class="audio-progress-track"><div class="audio-progress-fill"></div></div>
  <audio id="gameAudio" preload="auto"><source src="instruction.mp3"></audio>
</div>
```

## Anti-Pattern 32: Promise.race Around FeedbackManager Calls

```javascript
// WRONG — 800ms ceiling wins over normal 1–3s TTS; round advances while audio still plays
function audioRace(p) {
  return Promise.race([ p, new Promise(r => setTimeout(r, 800)) ]);
}
await audioRace(FeedbackManager.sound.play('correct_sound_effect', { sticker }));
```

Symptom: rounds advance before feedback / VO finishes. Validator rule: `5e0-FEEDBACK-RACE-FORBIDDEN`.

**Correct:** Plain `await` inside `try/catch`. FeedbackManager already bounds resolution internally (see PART-017) — `sound.play` resolves within audio-duration + 1.5s, `playDynamicFeedback` within 60s. Any template-level race is either redundant or bug-inducing.

```javascript
// RIGHT
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker });
  await FeedbackManager.playDynamicFeedback({ audio_content, subtitle, sticker });
} catch (e) { /* non-blocking per feedback SKILL Rule 8 */ }
```

## Anti-Pattern 33: Custom Lives / Hearts Display Duplicating ProgressBar

```javascript
// WRONG — custom hearts strip inside #gameContent renders a second row of hearts
// on top of the ProgressBarComponent's built-in lives strip
injectGameHTML('<div class="lives-row" id="lives-row" data-testid="lives-row"></div>' + ...);
function renderLivesRow() {
  var row = document.getElementById('lives-row');
  var html = '';
  for (var i = 0; i < gameState.totalLives; i++) {
    var lost = i >= gameState.lives;
    html += '<span class="heart' + (lost ? ' lost' : '') + '">\u2764\uFE0F</span>';
  }
  row.innerHTML = html;
}
renderLivesRow();                                        // paints custom hearts
progressBar.update(gameState.roundsCompleted, gameState.lives);  // paints CDN hearts
```

Symptom: two rows of hearts visible on-screen (one in the ProgressBar header, one inside `#gameContent`). Validator rule: `5e0-LIVES-DUP-FORBIDDEN`.

**Root cause:** `ProgressBarComponent` constructor with `totalLives >= 1` already renders a hearts strip in `#mathai-progress-slot` and updates it on every `progressBar.update(round, lives)` call. Any additional game-owned element with a class/id matching `lives-*` / `hearts-*` / `heart` or any custom `renderLives*` / `updateLives*` / `renderHearts*` function paints a second, redundant hearts row.

**Correct:** Do NOT inject a custom lives container, do NOT define a custom hearts renderer, do NOT emit `<span class="heart">` glyph elements in game HTML. The authoritative path is `progressBar.update(roundsCompleted, Math.max(0, gameState.lives))` — it owns the entire lives strip.

```javascript
// RIGHT — no custom hearts DOM; ProgressBar owns the lives strip
progressBar.update(gameState.roundsCompleted, Math.max(0, gameState.lives));
```

If your spec needs a dramatic heart-break animation on wrong answer, target the CDN ProgressBar's rendered hearts (`.mathai-progress-heart` or similar — consult `warehouse/packages/components/progress-bar/index.js`) with a one-shot CSS class; do NOT replicate the hearts in your own DOM.

**Source incident:** `scale-it-up-ratios` (2026-04-17) — injected `#lives-row` with a per-heart `<span class="heart">` loop and a `renderLivesRow()` function, producing a duplicate hearts row above the question alongside the ProgressBar's header strip.

## Verification

- [ ] All 4 script `src` URLs use `storage.googleapis.com/test-dynamic-assets/...` — no relative paths, no `cdn.homeworkapp.ai`, no invented domains
- [ ] No `new Audio()` anywhere
- [ ] No `setInterval` for timer purposes
- [ ] No `SubtitleComponent.show()` calls
- [ ] No hardcoded color hex values for game feedback
- [ ] Package loading order is correct
- [ ] `waitForPackages()` has timeout
- [ ] All onclick handlers reference global functions
- [ ] VisibilityTracker present when timer or audio used
- [ ] VisibilityTracker `onInactive` uses `sound.pause()` NOT `sound.stopAll()`
- [ ] VisibilityTracker timer calls pass `{ fromVisibilityTracker: true }` flag
- [ ] Audio preloading uses `sound.preload([{id, url}])` NOT `sound.register(id, url)`
- [ ] Single style/script block only
- [ ] Uses `100dvh` not `100vh`
- [ ] All game HTML inside `#gameContent` (not sibling of `#app`) when using ScreenLayout
- [ ] Grids have pixel max-width (e.g. 360px), not just `max-width: 100%`
- [ ] Dynamic audio uses `playDynamicFeedback()`, not `sound.play('dynamic', ...)`
- [ ] `progressBar.update()` first param is rounds COMPLETED (0 at start), not current round
- [ ] Grid cells with pseudo-elements have `overflow: hidden`
- [ ] Count-up timers (`timerType: 'increase'`) without a time limit use a large `endTime` (e.g. `100000`), never `0` or omitted
- [ ] `gameState` declared as `window.gameState = {...}`, NOT `const gameState = {...}`
- [ ] `testPause`/`testResume` use `visibilityTracker.triggerInactive()`/`triggerResume()` — NOT `simulatePause()` (doesn't exist)
- [ ] Progress bar slot uses `position: absolute; top: 0` to sit at y=0 (no gap above it)
- [ ] `restartGame()` recreates `timer` and `visibilityTracker` (they were nulled by `endGame()`)
- [ ] Transition screens use either `duration` OR `buttons` — never both together
- [ ] No inline stub/polyfill/fallback classes for CDN packages (SignalCollector, FeedbackManager, TimerComponent, etc.)
- [ ] **Every end condition has a code path to `endGame()`** — no dead-end game states where the player is stuck
- [ ] **`setupGame()` sets `gameState.startTime = Date.now()` and `gameState.isActive = true`** — without these, attempts produce NaN and endGame exits immediately
- [ ] **`setupGame()` calls `timer.start()`** when timer exists — without this, timer stays at 00:00
- [ ] **`setupGame()` calls `trackEvent('game_start', 'game')`**
- [ ] VisibilityTracker `onInactive`/`onResume` fire `trackEvent('game_paused'/'game_resumed')`
- [ ] CSS variables use `--mathai-*` prefix consistently — not `--game-*` or `--stack-*`
- [ ] If using ScreenLayout (PART-025), do NOT also write manual HTML from PART-021 (double-nested layout)
- [ ] `window.parent.postMessage({ type: 'game_ready' }, '*')` sent AFTER `window.addEventListener('message', handlePostMessage)` — parent harness waits for this before sending content
- [ ] If `<video>` present: has `controls`, `playsinline`, `controlsList="nofullscreen"` — no `autoplay`
- [ ] If `<video>` present: wrapper has `background: white` (not black), no forced `aspect-ratio`
- [ ] No custom lives / hearts DOM or custom heart renderer when `ProgressBarComponent` has `totalLives >= 1` — ProgressBar owns the lives strip (validator rule `5e0-LIVES-DUP-FORBIDDEN`; PART-023; PART-026 Anti-Pattern 33)
- [ ] If `<video>` present: video is in instruction/question area, NOT inside interactive play area
- [ ] If `<audio>` present: NO `autoplay`, NO native `controls` (use custom UI per PART-041)
- [ ] If `<audio>` present: custom play/pause icon + progress bar with CDN SVGs
- [ ] If `<audio>` present: audio player in instruction/question area, NOT inside interactive play area
- [ ] No `new Audio()` anywhere (RULE-006)
- [ ] No `Promise.race` wrapping `FeedbackManager.sound.play` / `playDynamicFeedback` / `audioRace` helper (PART-017 Anti-Pattern 32, validator rule `5e0-FEEDBACK-RACE-FORBIDDEN`)
