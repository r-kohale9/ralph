### PART-023: ProgressBar Component

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

**Methods:** `update(progress, livesRemaining)`, `show()`, `hide()`, `destroy()`. No `.init()` / `.start()` / `.reset()` exist.

**update() semantics:**
- **INVARIANT — starts at 0:** The first `progressBar.update()` call on the initial flow path MUST be `update(0, totalLives)` — the progression counter begins at 0 when the game starts, never at 1. Validator rule `5e0-PROGRESSBAR-START-ONE` blocks any first-call whose first arg is not literal `0`.
- **First arg is a game-specific progression counter**, NOT the 1-indexed current round number. What it counts — rounds completed, correct answers, points earned, section progress — is defined per game. The component renders `progress / totalRounds` internally.
- Entering round N: reflects current progression state (e.g. `update(state.progress, livesLeft)`) — do NOT compute from the round index. Idempotent no-op if state hasn't changed since the last update.
- **Round-complete bump — MUST be the first action in the round-complete handler, BEFORE any awaited SFX/subtitle/VO, BEFORE `nextRound`, BEFORE `endGame('victory')`:** increment the counter in state first, then `update(state.progress, Math.max(0, gameState.lives))`. Firing the bar bump synchronously when the round's progression metric changes keeps the visual fill in sync with the locked state. On the final round this paints the full bar *before* the victory screen renders — otherwise the bar sticks at the pre-bump value on victory (matching-doubles regression, April 2026). Same ordering principle as `recordAttempt`-before-feedback-audio: UI/data events update first, audio/transitions play second.
- After wrong feedback with lives remaining: `update(state.progress, livesLeft-1)` (hearts decrement; progress changes only if the game's metric counts wrong answers).
- On restart entry: `update(0, totalLives)` (reset to the start-at-0 invariant).
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
- [ ] `progressBar.update(0, lives)` called at init (NOT 1) — first-call invariant, enforced by `5e0-PROGRESSBAR-START-ONE`
- [ ] `update(state.progress, lives)` called as the FIRST action in the round-complete handler (counter bumped in state first, before awaited round-complete SFX, before `nextRound`/`endGame`) — final round must paint the full bar on Victory, not the pre-bump value
- [ ] `destroy()` called before recreation in `createProgressBar()`
- [ ] ScreenLayout has `progressBar: true` in slots (preview-wrapper) or sections (legacy)
- [ ] ProgressBar recreated on `handlePostMessage` and `restartGame()`
- [ ] No custom lives / hearts DOM or custom heart renderer in game HTML — `ProgressBarComponent` owns the lives strip (validator rule `5e0-LIVES-DUP-FORBIDDEN`; PART-026 Anti-Pattern 33)
