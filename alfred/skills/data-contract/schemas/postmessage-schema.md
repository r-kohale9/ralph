# postMessage Schema

Per **PART-008** (PostMessage Protocol). See `parts/PART-008.md` for the full protocol — game_ready, game_init, game_complete message formats.

## Alfred-specific rules (cross-PART, not in PART-008 alone)

### game_complete MUST be nested (CRITICAL)

```javascript
// WRONG — flat structure, platform receives undefined metrics
window.parent.postMessage({
  type: 'game_complete',
  metrics: { accuracy: 70 },  // platform reads event.data.data.metrics — misses this
  completedAt: Date.now()
}, '*');

// RIGHT — nested under data
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: { accuracy: 70, time: 45, stars: 2, attempts: gameState.attempts, duration_data: gameState.duration_data, totalLives: gameState.lives, tries: triesArray },
    completedAt: Date.now()
  }
}, '*');
```

### game_init handler — phase MUST be first line (CRITICAL)

Per GEN-PHASE-INIT: `gameState.phase = 'gameplay'` must be the VERY FIRST LINE in the game_init handler, before any content processing. Test harness calls `waitForPhase('gameplay')` immediately after sending game_init.

### Dual-path firing (GEN-PM-DUAL-PATH)

game_complete MUST fire on BOTH paths: `endGame(false)` (all rounds done → results) AND `endGame(true)` (lives exhausted → game_over). A single endGame function handles both.

### Required metrics fields

Per PART-008 + Alfred data requirements: `accuracy` (integer 0-100), `time` (seconds), `stars` (0-3), `attempts` (full array), `duration_data`, `totalLives`, `tries`. See PART-008 for recommended fields.

### previewResult field (PART-039)

The `data` object in `game_complete` SHOULD include `previewResult: gameState.previewResult || null`. Required when the preview was interactive (any `setPreviewData()` call during the preview phase). Shape:

```javascript
previewResult: {
  duration: number,           // ms the preview was visible
  skippedRepeat?: boolean,    // true if show() was called a second time and auto-skipped
  interactions?: object       // key/value bag populated via setPreviewData()
}
```

Populate in `startGameAfterPreview(previewData)` by `gameState.previewResult = previewData`, then include in the payload built by `postGameComplete`. See PART-039.
