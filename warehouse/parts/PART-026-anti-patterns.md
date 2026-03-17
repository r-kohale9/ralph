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
  document.getElementById('timer').textContent = seconds;
}, 1000);
```

**Correct:** Use `TimerComponent` from PART-006.

## Anti-Pattern 2: Direct Audio Creation

```javascript
// WRONG - Do NOT use new Audio()
const sound = new Audio('correct.mp3');
sound.play();
```

**Correct:** Use `FeedbackManager.sound.play()` from PART-017.

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
window.addEventListener('DOMContentLoaded', async () => {
  await FeedbackManager.init(); // May throw "FeedbackManager is not defined"
});
```

**Correct:** Always call `waitForPackages()` first (PART-003).

## Anti-Pattern 5: Using SubtitleComponent.show() Directly

```javascript
// WRONG - SubtitleComponent is internal to FeedbackManager
SubtitleComponent.show({ text: 'Great job!' });
```

**Correct:** Pass subtitle as prop to `FeedbackManager.sound.play(id, { subtitle: '...' })`.

## Anti-Pattern 6: No Timeout on Package Loading

```javascript
// WRONG - Hangs forever if CDN is down
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
}
```

**Correct:** Always include 10-second timeout (PART-003).

## Anti-Pattern 7: Hardcoded Colors

```css
/* WRONG - Hardcoded values */
.correct { background: #219653; }
.incorrect { background: #E35757; }
```

**Correct:** Use CSS variables: `var(--mathai-green)`, `var(--mathai-red)` (PART-020).

## Anti-Pattern 8: Non-Global onclick Handlers

```javascript
// WRONG - Function defined inside DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  function handleClick() { /* ... */ } // Not accessible from HTML onclick
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
console.log('State:', gameState);
```

**Correct:** `console.log('State:', JSON.stringify(gameState, null, 2))` (RULE-004).

## Anti-Pattern 11: Multiple Script/Style Blocks

```html
<!-- WRONG - Multiple blocks -->
<style>/* block 1 */</style>
<style>/* block 2 */</style>
<script>/* block 1 */</script>
<script>/* block 2 */</script>
```

**Correct:** Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007).

## Anti-Pattern 12: Using 100vh Instead of 100dvh

```css
/* WRONG - Doesn't account for mobile safe areas */
.page-center { min-height: 100vh; }
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
.game-grid { max-width: 100%; }
```

**Correct:** Always set a pixel cap: `max-width: 360px; margin: 0 auto;` (PART-027).

## Anti-Pattern 15: Wrong API for Dynamic Audio (TTS)

```javascript
// WRONG - 'dynamic' is not a registered sound ID, causes permission popup with no audio
await FeedbackManager.sound.play('dynamic', { text: 'Great job!' });
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
.grid-cell { /* no overflow rule */ }
```

**Correct:** Always add `overflow: hidden` to grid cells that use `::before`/`::after` pseudo-elements.

## Anti-Pattern 18: Inline Stub/Polyfill for CDN Packages

```html
<!-- WRONG - Defining a stub class prevents the real CDN package from loading -->
<script>
  window.SignalCollector = window.SignalCollector || class SignalCollector {
    constructor(opts) { this.opts = opts; }
    startProblem() {}
    endProblem() {}
    // ... stub methods
  };
</script>
```

The real CDN script checks `if (window.SignalCollector)` and skips initialization if it already exists. A stub will shadow the real package permanently.

**Correct:** Never define inline stubs, polyfills, or fallback classes for CDN packages (FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector, ProgressBarComponent, TransitionScreenComponent, ScreenLayout). These are loaded via `<script>` tags (PART-002) and awaited by `waitForPackages()` (PART-003). If a package isn't available, `waitForPackages()` will timeout after 10s — that's the correct error path.

## Verification

- [ ] No `new Audio()` anywhere
- [ ] No `setInterval` for timer purposes
- [ ] No `SubtitleComponent.show()` calls
- [ ] No hardcoded color hex values for game feedback
- [ ] Package loading order is correct
- [ ] `waitForPackages()` has timeout
- [ ] All onclick handlers reference global functions
- [ ] VisibilityTracker present when timer or audio used
- [ ] Single style/script block only
- [ ] Uses `100dvh` not `100vh`
- [ ] All game HTML inside `#gameContent` (not sibling of `#app`) when using ScreenLayout
- [ ] Grids have pixel max-width (e.g. 360px), not just `max-width: 100%`
- [ ] Dynamic audio uses `playDynamicFeedback()`, not `sound.play('dynamic', ...)`
- [ ] `progressBar.update()` first param is rounds COMPLETED (0 at start), not current round
- [ ] Grid cells with pseudo-elements have `overflow: hidden`
- [ ] Count-up timers (`timerType: 'increase'`) without a time limit use a large `endTime` (e.g. `100000`), never `0` or omitted
- [ ] `gameState` declared as `window.gameState = {...}`, NOT `const gameState = {...}`
- [ ] `testPause`/`testResume` call `timer.pause()`/`timer.resume()` directly — NOT `visibilityTracker.simulatePause()`
- [ ] Progress bar slot uses `position: absolute; top: 0` to sit at y=0 (no gap above it)
- [ ] `restartGame()` recreates `timer` and `visibilityTracker` (they were nulled by `endGame()`)
- [ ] Transition screens use either `duration` OR `buttons` — never both together
- [ ] No inline stub/polyfill/fallback classes for CDN packages (SignalCollector, FeedbackManager, TimerComponent, etc.)
