# PART-023: ProgressBar Component

**Category:** MANDATORY | **Condition:** Game has multiple rounds with visible progress | **Dependencies:** PART-002, PART-025

---

> ⚠️ **v2 Update:** ProgressBar now requires ScreenLayout v2 `sections` API (not the deprecated `slots` API). Use a `createProgressBar()` helper for init and restart.

## Code

### Lives game (totalLives > 0)

```javascript
// Helper — creates/recreates ProgressBarComponent (call at init and restart)
function createProgressBar() {
  if (progressBar) progressBar.destroy();
  progressBar = new ProgressBarComponent({
    slotId: 'mathai-progress-slot',
    totalRounds: gameState.totalRounds,
    totalLives: gameState.totalLives,
    showLives: true                // hearts visible (default)
  });
}

createProgressBar();
progressBar.update(0, gameState.lives);

// After each round completes
gameState.currentRound++;
progressBar.update(gameState.currentRound, gameState.lives);
```

### No-lives game (gameState.totalLives === 0 or archetype has no lives mechanic)

```javascript
// Helper — creates/recreates ProgressBarComponent for a no-lives game
function createProgressBar() {
  if (progressBar) progressBar.destroy();
  progressBar = new ProgressBarComponent({
    slotId: 'mathai-progress-slot',
    totalRounds: gameState.totalRounds,
    totalLives: 0,                 // MUST be 0, not a placeholder like totalRounds
    showLives: false               // MANDATORY for no-lives games — hides the hearts strip
  });
}

createProgressBar();
progressBar.update(0, 0);          // second arg is lives — pass 0 for no-lives games
```

### Forbidden — using `totalRounds` as a placeholder for `totalLives`

```javascript
// ❌ Forbidden — renders 3 hearts that never decrement
progressBar = new ProgressBarComponent({
  totalRounds: gameState.totalRounds,
  totalLives: gameState.totalRounds  // wrong shape; the hearts strip becomes meaningless
});

// ❌ Forbidden — passing a non-zero totalLives without showLives:false hides nothing
progressBar = new ProgressBarComponent({
  totalRounds: 3,
  totalLives: 3   // showLives defaults to true → hearts render even though no lives mechanic
});
```

**Rule of thumb.** `showLives` is *not* optional. Pick exactly one of:
- Lives game: `totalLives: <N>` AND `showLives: true` (or omit — default).
- No-lives game: `totalLives: 0` AND `showLives: false`.

Validator rule `PROGRESSBAR-NO-LIVES-MUST-HIDE` fails the build if a game's `gameState.totalLives === 0` (or the archetype has no lives mechanic) and the ProgressBar is instantiated with `showLives !== false`.

## Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `autoInject` | boolean | No | `true` | Auto-inject into progress slot |
| `totalRounds` | number | Yes | — | Total rounds in game |
| `totalLives` | number | Yes | — | Total hearts to display. Pass `0` for no-lives games. |
| `slotId` | string | No | `'mathai-progress-slot'` | Container element ID |
| `labelFormat` | string | No | `'Round {current}/{total}'` | Label template |
| `showLives` | boolean | **Conditional** | `true` | Show hearts. **MUST be `false` if `totalLives === 0` or the archetype has no lives mechanic.** Default `true` only applies when `totalLives > 0`. |
| `showTrack` | boolean | No | `true` | Show progress bar track |
| `showLabel` | boolean | No | `true` | Show round label |

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `update(roundsCompleted, lives)` | number, number | Update progress display |
| `destroy()` | — | Cleanup when game ends or restarts |

## CRITICAL: update() Parameter Is Rounds COMPLETED — Progress MUST Start at 0

**Symptom of the bug:** on first render the bar shows "1/N" (or the first segment already filled), making it feel like the player has already completed one round before they even started. This is always caused by passing `1` (or `currentRound` when `currentRound` is 1-indexed) to `update()` at init instead of `0`.

```javascript
// WRONG — passing currentRound (1) on a totalRounds=1 game shows "1/1" = 100% complete
progressBar.update(1, lives);  // Shows full bar immediately!

// WRONG — skipping the init update() call; component may paint 1/N by default on first render
progressBar = new ProgressBarComponent({ totalRounds: 5, totalLives: 3 });
// (no update() call here — BAD)

// CORRECT — pass 0 at game start (0 rounds completed yet)
progressBar = new ProgressBarComponent({ totalRounds: 5, totalLives: 3 });
progressBar.update(0, lives);  // MANDATORY — forces "Round 0/5" on first paint

// After round 1 is done:
progressBar.update(1, lives);  // Now shows "Round 1/5"
```

**Rule:** the very next line after `new ProgressBarComponent(...)` MUST be `progressBar.update(0, gameState.totalLives)`. Same after `createProgressBar()` is re-called on restart / postMessage.

## createProgressBar() Helper — Required Pattern

Always use a helper function because ProgressBar needs to be recreated:
- At init (totalRounds/totalLives from content)
- On `handlePostMessage` (new content may have different totalRounds)
- On `restartGame()` (reset progress)

```javascript
function createProgressBar() {
  if (progressBar) progressBar.destroy();
  progressBar = new ProgressBarComponent({
    slotId: 'mathai-progress-slot',
    totalRounds: gameState.totalRounds,
    totalLives: gameState.totalLives
  });
}
```

## Display Specs

- **Label format:** "Round X/Y" (X = roundsCompleted param)
- **Lives format:** filled hearts (❤️) for remaining, empty (🤍) for lost
- **Progress bar:** Blue (#2563eb) fill, smooth 0.5s transition
- **Bar height:** 12px, border-radius 1rem

## CRITICAL: ProgressBar Owns the Lives Display — No Custom Hearts DOM

When `totalLives >= 1`, `ProgressBarComponent` already renders a hearts strip inside `#mathai-progress-slot` and updates it on every `progressBar.update(round, lives)` call. The game code MUST NOT render its own hearts anywhere.

**Forbidden in game HTML / JS:**
- `<div class="lives-row">` / `<div id="lives-row">` / `<span class="heart">` — any element with `class` or `id` matching `lives-*`, `hearts-*`, `lives-strip`, `hearts-strip`, `lives-container`, `hearts-container`, `lives-display`, `livesRow`, `heartsRow`, `heart` as a single-class element.
- Functions named `renderLivesRow`, `renderLives`, `renderHearts`, `updateLivesDisplay`, `updateLivesRow`, `updateHearts`, `buildLives`, `injectLives`, etc.
- Heart glyph characters (❤️ `\u2764\uFE0F`, 🤍 `\u{1F90D}`, 🩷 `\u{1FA77}`, ♡ `\u2661`, ♥ `\u2665`) emitted inside an innerHTML assignment or DOM-build string targeting any element other than the CDN ProgressBar's own markup.

**Why:** two hearts rows visible on-screen is the bug. Validator rule `5e0-LIVES-DUP-FORBIDDEN` blocks this at build time. See PART-026 Anti-Pattern 33 for the full WRONG/RIGHT example.

**If your spec needs a heart-break animation:** target the CDN-rendered heart element (inspect `warehouse/packages/components/progress-bar/index.js` for the exact class) with a one-shot CSS class — do NOT build a parallel hearts DOM.

## Requires ScreenLayout v2

ProgressBar requires ScreenLayout v2 with `progressBar: true`:

```javascript
ScreenLayout.inject('app', {
  sections: { questionText: true, progressBar: true, playArea: true, transitionScreen: true }
});
```

## Verification

- [ ] `createProgressBar()` helper exists (called at init and restart)
- [ ] `ProgressBarComponent` instantiated with `totalRounds` and `totalLives`
- [ ] `progressBar.update(0, lives)` called at init (NOT 1)
- [ ] `update()` called after each round with correct completed count
- [ ] `destroy()` called before recreation in `createProgressBar()`
- [ ] ScreenLayout v2 has `sections.progressBar: true`
- [ ] ProgressBar recreated on `handlePostMessage` and `restartGame()`
- [ ] No custom lives / hearts DOM or custom heart renderer in game HTML — `ProgressBarComponent` owns the lives strip (validator rule `5e0-LIVES-DUP-FORBIDDEN`; PART-026 Anti-Pattern 33)

## Source Code

Full ProgressBarComponent implementation: `warehouse/packages/components/progress-bar/index.js`
