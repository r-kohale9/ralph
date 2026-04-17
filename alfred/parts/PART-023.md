### PART-023: ProgressBar Component (v2)

**Source of truth:** `warehouse/parts/PART-023-progress-bar.md`

**Purpose:** Round counter + lives display, rendered inside the game body under the preview header.

**Constructor:**
```js
const progressBar = new ProgressBarComponent({
  slotId: 'mathai-progress-slot',   // EXACT value — never 'previewProgressBar', never 'progress-bar-container'
  totalRounds: gameState.totalRounds,
  totalLives: gameState.totalLives  // MUST be >= 1
});
```

**Methods:** `update(roundsCompleted, livesRemaining)`, `show()`, `hide()`, `destroy()`. No `.init()` / `.start()` / `.reset()` exist.

**update() semantics:**
- First arg is rounds **completed**, NOT the current round number.
- On start: `update(0, totalLives)`.
- Entering round N: reflects prior state → typically `update(N-1, livesLeft)` (already satisfied by the previous correct feedback).
- After correct feedback on round N: `update(N, livesLeft)`.
- After wrong feedback with lives remaining: `update(roundsCompleted, livesLeft-1)` (hearts decrement only; round count unchanged).
- On restart entry: `update(0, totalLives)` (reset).
- Second arg MUST be clamped: `Math.max(0, lives)` — a negative value throws RangeError inside the heart renderer.

**Lifecycle — `createProgressBar()` helper:**

Required at three call sites: init (DOMContentLoaded), `handlePostMessage('game_init')`, and `restartGame()`. Each call MUST destroy the existing instance synchronously before constructing a new one.

```js
function createProgressBar() {
  try { if (progressBar) progressBar.destroy(); } catch(e) {}
  progressBar = new ProgressBarComponent({
    slotId: 'mathai-progress-slot',
    totalRounds: gameState.totalRounds,
    totalLives: Math.max(1, gameState.totalLives)
  });
  progressBar.show();
  progressBar.update(0, gameState.totalLives);
}
```

`destroy()` is synchronous. Never wrap in `setTimeout` (GEN-PROGRESSBAR-DESTROY).

**Slot creation:**
- Preview-wrapper mode (`slots: { previewScreen: true, progressBar: true, transitionScreen: true }`) — ScreenLayout creates `#mathai-progress-slot` at the top of `.game-stack`. `progressBar: true` is REQUIRED in `slots` or the slot won't exist.
- Sections mode (`sections: { progressBar: true, ... }`) — ScreenLayout creates the slot in the 4-section layout.
- Never create `#mathai-progress-slot` manually in game HTML.

**Invariants:**
- Game MUST NOT render its own round counter or lives/hearts display. ProgressBar owns both.
- `totalLives >= 1`. Passing 0 causes division-by-zero in the heart renderer.
- `#previewProgressBar` (inside preview header) is a **different** element — the audio countdown strip owned by PreviewScreenComponent. Never use it as `slotId`.

**Shape-specific visibility:**
- Standalone (`totalRounds: 1`): call `progressBar.hide()` (bar hidden for entire session).
- Multi-round (`N ≥ 2`) / Sectioned: `show()` + visible on every screen except Preview.

See `warehouse/parts/PART-023-progress-bar.md` for full detail.

## Verification Checklist

- [ ] `createProgressBar()` helper exists (called at init and restart)
- [ ] `ProgressBarComponent` instantiated with `totalRounds` and `totalLives`
- [ ] `progressBar.update(0, lives)` called at init (NOT 1)
- [ ] `update()` called after each round with correct completed count
- [ ] `destroy()` called before recreation in `createProgressBar()`
- [ ] ScreenLayout has `progressBar: true` in slots (preview-wrapper) or sections (legacy)
- [ ] ProgressBar recreated on `handlePostMessage` and `restartGame()`
- [ ] No custom lives / hearts DOM or custom heart renderer in game HTML — `ProgressBarComponent` owns the lives strip (validator rule `5e0-LIVES-DUP-FORBIDDEN`; PART-026 Anti-Pattern 33)
