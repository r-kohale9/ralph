# PART-039: Preview Screen (Persistent Wrapper)

**Category:** CONDITIONAL | **Condition:** Every game UNLESS spec sets `previewScreen: false` | **Dependencies:** PART-002, PART-017, PART-025

---

## Opt-out (`previewScreen: false`)

When the spec declares a top-level `previewScreen: false`, this part **does not apply**:

- `PreviewScreenComponent` MUST NOT be instantiated, imported, or referenced.
- `ScreenLayout.inject()` MUST NOT pass `previewScreen: true` in its `slots` — omit the key entirely.
- `DOMContentLoaded` calls the first TransitionScreen (level/round intro) directly; it does NOT call `setupGame()` / `showPreviewScreen()`.
- The `fallbackContent.previewInstruction` / `previewAudioText` / `showGameOnPreview` fields are NOT required and SHOULD be omitted.
- All invariants below (wrapper persistence, no DOM re-parenting, `destroy()`-once, standalone-fallback gate) are irrelevant because the wrapper is never mounted.

Existing pre-PART-039 templates (e.g. `make-x`, `estimate-it`, `keep-track`) demonstrate the no-preview initial-screen pattern.

---

## Overview

The PreviewScreenComponent is a **persistent wrapper** for the entire game session. It is NOT a transient screen that hides when the game starts — it stays visible from page load until `endGame()`.

It has two states:

| State | Description |
|-------|-------------|
| **`preview`** | Initial state. Blue progress bar (audio/5s timer), instruction text, non-interactable game underneath, "Skip & show options" button. |
| **`game`** | After skip or timer-complete. Game becomes interactable, skip button hidden, progress bar mirrors the game's TimerComponent (orange for decreasing timers) or hides. |

The header bar (back button, avatar, question label, score, star) is **fixed at top** and visible in BOTH states.

The instruction area and the game content share a **single scroll area** below the fixed header — there is NO nested scrolling.

---

## ScreenLayout Configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,                  // default when spec previewScreen !== false
    transitionScreen: true                // For multi-round games
  }
});
```

When `previewScreen: true`, ScreenLayout creates the preview wrapper structure with `.game-stack` (containing `#gameContent` and `#mathai-transition-slot`) **inside** the wrapper. No DOM moves at runtime.

## Instantiation (in DOMContentLoaded)

```javascript
const previewScreen = new PreviewScreenComponent({
  slotId: 'mathai-preview-slot'
});
```

## show() Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `instruction` | string | `''` | HTML string with rich content (bold, images, video) |
| `audioUrl` | string\|null | `null` | URL of preview audio. If null, runtime TTS fallback is used |
| `showGameOnPreview` | boolean | `false` | If true, the game is rendered in its initial state (non-interactable) underneath the preview overlay. If false, the area below the instruction is blank white space |
| `timerConfig` | object\|null | `null` | `{ type: 'decrease' \| 'increase', startTime, endTime }` — describes the game's TimerComponent |
| `timerInstance` | TimerComponent\|null | `null` | Reference to the game's TimerComponent for header sync in game state |
| `onComplete` | function | — | Called with `previewData` when preview transitions to game state |
| `onPreviewInteraction` | function | — | Called when `setPreviewData()` is invoked |

**Note:** `questionLabel`, `score`, and `showStar` are read automatically from the `game_init` postMessage payload — do NOT pass them in `show()` config.

---

## Two-State Behavior

### Preview State

- Header progress bar: blue `#D7FFFF`, animates from full to empty over the audio duration (or 5 seconds if no audio)
- Instruction HTML rendered in scrollable body
- Game stack is hidden by default; if `showGameOnPreview: true`, game stack is visible but covered by a transparent `pointer-events: auto` overlay (blocks all interaction)
- Skip button is fixed at the bottom

### Game State

Triggered by:
- Skip button click
- Audio finishes / 5s timer elapses

Effects:
- Overlay removed (game becomes interactable)
- Skip button removed
- Game stack revealed (if it was hidden)
- Header bar persists with new progress/timer behavior:

| Game Timer Type | Header Display |
|-----------------|----------------|
| `'decrease'` | Cadmium yellow `rgba(255,246,0,0.2)` progress bar synced with TimerComponent + timer text centered on bar |
| `'increase'` | No progress bar fill (hidden); timer text centered in header |
| none (`timerConfig: null`) | No progress bar, no timer text |

The PreviewScreen does NOT own the timer — it READS from the game's TimerComponent each frame via `requestAnimationFrame` and mirrors the value visually. The game still calls `timer.start()`, `timer.pause()`, etc.

---

## Game Flow Integration

**CRITICAL ordering rule:** The game DOM (everything inside `#gameContent`) MUST be rendered BEFORE `previewScreen.show()` is called. The preview overlay sits on top of `.game-stack`, so an empty `#gameContent` produces an empty preview area. Initialize round data, render the grid/cards/UI, and clear inputs FIRST, then call `previewScreen.show()` as the last step of `setupGame()`.

```javascript
// In game_init handler:
const content = gameState.content;

// 1. Render game UI into #gameContent FIRST (so preview overlay covers real content)
injectGameHTML();
renderInitialState(); // populate cells, clear inputs, reset state

// 2. THEN show preview — overlay covers the rendered game
previewScreen.show({
  instruction: content.previewInstruction || fallbackContent.previewInstruction,
  audioUrl: content.previewAudio || fallbackContent.previewAudio || null,
  showGameOnPreview: content.showGameOnPreview === true,   // default false
  timerConfig: timer ? { type: 'decrease', startTime: 60, endTime: 0 } : null,
  timerInstance: timer || null,
  onComplete: function(previewData) {
    startGameAfterPreview(previewData);
  }
});
```

## startGameAfterPreview()

**CRITICAL:** `gameState.startTime` must NOT be set until preview ends.

```javascript
function startGameAfterPreview(previewData) {
  gameState.previewResult = previewData;

  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (typeof timer !== 'undefined' && timer.start) timer.start();
  trackEvent('game_start', 'game');

  if (typeof signalCollector !== 'undefined') {
    signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });
  }

  renderRound(); // start first question
}
```

**Important:** Game code MUST NOT manage its own header bar. The preview header (with avatar, label, score, star, and timer text) is the ONLY header. Do not create a duplicate header inside `#gameContent`.

---

## Audio URL Sources (3 layers)

1. **Build time (pipeline):** After HTML is approved, the pipeline calls the TTS API and patches `fallbackContent.previewAudio` with a CDN URL.
2. **Content set (runtime):** `game_init` payload provides `content.previewAudio` from the content set, which overrides fallbackContent.
3. **Runtime fallback (component):** If no audio URL is provided, the component auto-generates audio from the instruction text. If TTS fails, falls back to a 5s silent timer.

## Content Fields in fallbackContent

```javascript
const fallbackContent = {
  previewInstruction: '<p>Instruction text here...</p>',
  previewAudioText: 'Narration text for TTS generation',
  previewAudio: 'https://cdn.mathai.ai/.../<generated-audio-hash>.mp3',
  showGameOnPreview: false,   // optional, default false
  rounds: [...]
};
```

---

## VisibilityTracker Integration

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: function() { previewScreen.pause(); },
  onResume:  function() { previewScreen.resume(); }
});
```

In **preview state**, pause/resume controls audio + the preview progress bar.
In **game state**, pause/resume controls the header timer sync rAF (the game's TimerComponent is paused/resumed by the game code itself).

---

## DOMContentLoaded — Direct call to setupGame()

**CRITICAL:** DOMContentLoaded must call `setupGame()` directly. Do NOT show a TransitionScreen ("Let's go!", "I'm ready!") before the preview — the preview screen IS the first screen the user sees.

```javascript
// WRONG
transitionScreen.show({ title: "Let's go!", buttons: [{ text: "Start", action: setupGame }] });

// RIGHT
setupGame();
```

The TransitionScreen component is still used for between-round transitions, victory, and game-over screens — these now appear inside the preview wrapper (the header remains visible during them).

---

## Audio Permission

The preview screen always waits for audio permission before starting the timer/audio, even when no audio is configured. This prevents the FeedbackManager permission popup from covering the preview when the timer starts.

---

## Restart Behavior

The preview screen is shown **once per session**. When the player clicks "Play Again":

- The game's `restartGame()` function resets game state and starts a new round
- It MUST NOT call `previewScreen.show()` or `showPreviewScreen()` again
- The PreviewScreenComponent stays in `'game'` state throughout
- The component enforces this internally: if `show()` is called a second time, it auto-skips to game state and fires `onComplete` synchronously with `{ duration: 0, skippedRepeat: true }`

Typical restart flow:
```javascript
function restartGame() {
  // ... preserve session history, reset state, recreate components ...

  // Start gameplay directly — no preview
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();
  trackEvent('game_start', 'game');
  showLevelTransition(); // or renderRound() — the first gameplay entry point
}
```

Do NOT call `setupGame()` from `restartGame()` if `setupGame()` ends with `showPreviewScreen()`. Either split `setupGame` into reset + preview, or call the reset portion only on restart.

---

## Methods

| Method | Description |
|--------|-------------|
| `show(config)` | Enter preview state with config |
| `switchToGame()` | (Internal) Transition to game state. Called by `skip()` or timer-complete. Game code reacts via `onComplete` callback. |
| `pause()` | Pause audio + progress bar (preview state) or timer sync (game state) |
| `resume()` | Resume |
| `skip()` | Skip preview, transition to game state |
| `setPreviewData(key, value)` | Store user interaction data from preview content |
| `getState()` | Returns current state: `'idle'`, `'preview'`, or `'game'` |
| `destroy()` | Full cleanup. Call in `endGame()`. |

`hide()` does NOT exist — the preview wrapper is persistent. Use `destroy()` only in `endGame()` cleanup.

---

## Verification Checklist

- [ ] `ScreenLayout.inject()` includes `previewScreen: true`
- [ ] `PreviewScreenComponent` instantiated in DOMContentLoaded
- [ ] `previewScreen.show()` called in `game_init` handler
- [ ] `previewScreen.show()` does NOT pass `questionLabel`, `score`, or `showStar` (read from game_init payload)
- [ ] `previewScreen.show()` passes `timerConfig` and `timerInstance` if game has a TimerComponent
- [ ] Game code does NOT call `previewScreen.hide()` — method removed
- [ ] `startGameAfterPreview()` sets `gameState.startTime` AFTER preview ends
- [ ] `gameState.duration_data.preview[]` populated with `{ duration }`
- [ ] VisibilityTracker wired to `pause()`/`resume()`
- [ ] `endGame()` calls `previewScreen.destroy()`
- [ ] No `new Audio()` for preview audio (must use FeedbackManager)
- [ ] Preview audio preloaded via `FeedbackManager.sound.preload()`
- [ ] Game does NOT render its own header bar inside `#gameContent` (preview header is the only header)
- [ ] Game DOM is rendered into `#gameContent` BEFORE `previewScreen.show()` is called (otherwise preview overlay covers empty space when `showGameOnPreview: true`)
- [ ] `gameState.previewResult` included in `game_complete` payload if interactive
- [ ] Standalone `setTimeout` fallback inside DOMContentLoaded gates on `previewScreen && previewScreen.isActive()` before running any `startGame()` / `showRoundIntro()` / `injectGameHTML()`. The fallback exists only to recover from `waitForPackages()` timeout; it MUST abort when a live preview is mounted. `gameState.phase === 'start_screen'` alone is NOT a sufficient gate because preview does not mutate `gameState.phase`.
