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
- **First arg is a progression counter — DEFAULT POLICY: rounds attempted, NOT rounds correct.** The counter increments on EVERY round (correct OR wrong), so by the final round of an N-round game the bar reads `N/N`. Why: the bar represents "where am I in the game", not score. A correct-only counter shows `8/10` on the last round of a 10-round game where the student got 2 wrong — bar disagrees with the round-intro label and feels mis-numbered. Score is tracked separately via `gameState.score` (drives `previewScreen.setScore`), not by the progress bar. The component renders `progress / totalRounds` internally. Alternative policies (points, section progress, etc.) are allowed only with explicit spec opt-in.
- Entering round N: reflects current progression state (e.g. `update(state.progress, livesLeft)`) — do NOT compute from the round index. Idempotent no-op if state hasn't changed since the last update.
- **Round-complete bump — fires AFTER feedback resolves, JUST BEFORE the round-change UI** (`nextRound()`, `endGame('victory')`, `endGame('game_over')`, or any awaited round-change transition). Sequence per round: (1) submit + state mutations (score / lives), (2) **await feedback SFX/VO** — bar still at previous progress, (3) `gameState.progress++` (default policy bumps on every round), (4) `update(state.progress, Math.max(0, gameState.lives))`, (5) round-change UI fires. The bar visibly advances *as the round changes*, not at submit. The bump MUST still precede the round-change UI — that's what guarantees Victory paints `N/N` and not `N-1/N` (matching-doubles regression, April 2026). Bumping at submit (before feedback) is also wrong — the bar jumps to the next round while feedback for the previous round is still playing, making the game feel ahead of itself.
- After wrong feedback with lives remaining: bump `state.progress` (default policy increments on every round) AND decrement `livesLeft`, then a single `update(state.progress, livesLeft)` reflects both changes — fired after feedback resolves, before the next round renders.
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
