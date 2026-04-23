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

### next_ended (PART-050) — end-of-game navigation signal

After a game ends and the player has viewed the victory / game_over TransitionScreen + tapped the FloatingButton Next button, the game MUST post a `next_ended` message:

```javascript
window.parent.postMessage({ type: 'next_ended' }, '*');
```

- Fires ONCE per game session, AFTER `game_complete`, in response to the user clicking Next.
- Does NOT replace `game_complete` — host listens for both. `game_complete` carries metrics; `next_ended` is a pure navigation signal the host uses to decide iframe teardown / advance to the next worksheet item.
- Minimal payload — only `type` is required. Future optional fields (e.g. `data.viewedResultsMs`) may be added without breaking compatibility.
- Sent from the `floatingBtn.on('next', ...)` handler. See PART-050's "Next flow" section for the canonical handler shape.

Validator rules: `GEN-FLOATING-BUTTON-NEXT-MISSING`, `GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE` — both fire when a FloatingButton-using game reaches end-game without the Next + `next_ended` wiring.

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
