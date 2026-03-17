# PART-023: ProgressBar Component

**Category:** CONDITIONAL | **Condition:** Game has multiple rounds with visible progress | **Dependencies:** PART-002, PART-021

---

## Code

```javascript
const progressBar = new ProgressBarComponent({
  autoInject: true,
  totalRounds: {{NUMBER}},
  totalLives: {{NUMBER}},
  slotId: 'mathai-progress-slot'  // Optional — default slot
});

// Update during gameplay — IMPORTANT: first param is ROUNDS COMPLETED (0-based), not current round
progressBar.update(roundsCompleted, remainingLives);

// Cleanup
progressBar.destroy();
```

## Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `autoInject` | boolean | No | `true` | Auto-inject into progress slot |
| `totalRounds` | number | Yes | — | Total rounds in game |
| `totalLives` | number | Yes | — | Total hearts to display |
| `slotId` | string | No | `'mathai-progress-slot'` | Container element ID |

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `update(roundsCompleted, lives)` | number, number | Update progress display. **`roundsCompleted` = how many rounds the player has finished (0 at start, totalRounds at end).** |
| `destroy()` | — | Cleanup when game ends |

## CRITICAL: update() Parameter Is Rounds COMPLETED

```javascript
// WRONG — passing currentRound (1) on a totalRounds=1 game shows "1/1" = 100% complete
progressBar.update(1, lives);  // Shows full bar immediately!

// CORRECT — pass 0 at game start (0 rounds completed yet)
progressBar.update(0, lives);  // Shows "0/1 rounds completed"

// After round 1 is done:
progressBar.update(1, lives);  // Now shows "1/1 rounds completed"
```

**Typical usage pattern:**
```javascript
// At game start:
progressBar.update(0, totalLives);

// After each round completes:
gameState.currentRound++;
progressBar.update(gameState.currentRound, remainingLives);
```

## Display Specs

- **Text format:** "X/Y rounds completed" (X = roundsCompleted param)
- **Lives format:** filled hearts for remaining, empty for lost
- **Progress bar:** Blue (#2563eb) fill, smooth 0.5s transition
- **Bar height:** 12px, border-radius 1rem
- **Container:** #f8f8f8 background, 16px 24px padding, bottom border

## Requires ScreenLayout Slot

If using ProgressBar, the ScreenLayout must have `slots.progressBar: true`:

```javascript
ScreenLayout.inject('app', {
  slots: { progressBar: true, transitionScreen: false }
});
```

## Verification

- [ ] `ProgressBarComponent` instantiated with totalRounds and totalLives
- [ ] `update()` called after each round with correct values
- [ ] `destroy()` called in endGame cleanup
- [ ] ScreenLayout has progressBar slot enabled
