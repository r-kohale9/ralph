# Lifecycle, Flushing, and Game Integration

## Initialization Sequence

SignalCollector is initialized as part of the DOMContentLoaded boot sequence, after all CDN packages are loaded:

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Wait for all CDN packages
  await waitForPackages();

  // 2. Initialize FeedbackManager (do NOT call unlock() after)
  await FeedbackManager.init();

  // 3. Create SignalCollector
  const signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    gameId: gameState.gameId || null,
    contentSetId: gameState.contentSetId || null
  });
  window.signalCollector = signalCollector;

  // 4. Create other components (timer, visibility tracker, etc.)
  // ...

  // 5. Register message listener BEFORE game_ready
  window.addEventListener('message', handlePostMessage);
  window.parent.postMessage({ type: 'game_ready' }, '*');

  // 6. Fallback: if no game_init arrives within 1000ms, start with fallbackContent
  setTimeout(function() {
    if (gameState.phase === 'start_screen' && !gameState.isActive) {
      setupGame();
    }
  }, 1000);
});
```

**Ordering constraints:**
- `waitForPackages()` must resolve before `new SignalCollector()`
- `FeedbackManager.init()` must complete before game starts
- Message listener must be registered before `game_ready` postMessage
- `flushUrl` and `playId` are NOT set here — they come from signalConfig

---

## signalConfig from game_init

The parent harness sends `game_init` with a `signalConfig` object containing the cloud function URL and identity overrides. Handle it in the postMessage listener:

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  gameState.phase = 'playing';  // FIRST LINE — data-contract rule

  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};

  // Assign all 6 properties with fallback
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }

  setupGame();
}
```

**All 6 properties must be assigned** (GEN-PM-SIGNALCONFIG):
1. `flushUrl` — cloud function URL for batch uploads
2. `playId` — unique play session ID for GCS deduplication
3. `gameId` — optional override of constructor gameId
4. `sessionId` — optional override of constructor sessionId
5. `contentSetId` — optional override of constructor contentSetId
6. `studentId` — optional override of constructor studentId

---

## Flushing Behavior (What the Builder Needs to Know)

The builder does NOT manage flushing — just call `startFlushing()` once after setting `flushUrl`.

- Events batch every 5s when `flushUrl` is set
- Small batches (<100 events AND <30s old) are deferred to avoid tiny HTTP requests
- Tab hidden triggers an immediate flush automatically
- Unload handlers (`pagehide`, `beforeunload`) fire sendBeacon automatically — even if `seal()` was never called
- Events retained on network failure, retried on next interval
- Emergency cap: drops oldest events if buffer exceeds 10,000 (OOM protection)

**GCS path per batch:**
```
signal-events/{studentId}/{sessionId}/{gameId}/{contentSetId}/{playId}/batch-{N}.json
```

---

## endGame — no seal() for restartable games

**Default pattern:** games have a "Try Again" button on the results/game-over screen. The iframe stays alive. Do NOT call `seal()` in `endGame()` — it removes all DOM listeners irreversibly and breaks the restart flow. Use `getMetadata()` + `getInputEvents().length` for the game_complete summary fields instead. Unload handlers (pagehide/beforeunload) automatically fire sendBeacon when the iframe is actually destroyed (tab close, parent removes frame).

```javascript
function endGame(outcome) {
  gameState.isActive = false;
  gameState.gameEnded = true;
  gameState.phase = outcome === 'victory' ? 'results' : 'game_over';
  syncDOM();

  // ... calculate metrics, show results screen ...

  // Get summary WITHOUT sealing (listeners stay attached for restart)
  var metadata = signalCollector.getMetadata();
  var eventCount = signalCollector.getInputEvents().length;

  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: { accuracy, time, stars, attempts: gameState.attempts, duration_data },
      attempts: gameState.attempts,
      completedAt: Date.now(),
      signal_event_count: eventCount,
      signal_metadata: metadata
    }
  }, '*');
}
```

**When to use `seal()` instead:** only for terminal-play games with no restart path (e.g. single-shot assessments that never show a replay button). In that case, `seal()` returns `{ event_count, metadata }` for the postMessage payload and removes listeners since the iframe won't be reused.

**Signal data streams to GCS separately — NEVER included in postMessage payload.** Only `signal_event_count` and `signal_metadata` are included as summary fields.

### seal() mechanics (for reference)

1. Stops the flush interval
2. **Synchronous:** fires `sendBeacon()` in 50-event chunks — survives iframe destruction
3. **Async bonus:** attempts `fetch` with 3 retries (confirmed delivery if iframe survives)
4. Detaches all DOM event listeners (**irreversible**)
5. Returns synchronously: `{ event_count, metadata }`. Idempotent.

---

## game_complete Must Fire on BOTH Paths

`game_complete` postMessage must fire on **both** victory and game-over:

```javascript
// Victory path
if (gameState.currentRound >= gameState.totalRounds) {
  endGame('victory');
}

// Game-over path (lives games)
if (gameState.lives <= 0) {
  endGame('game_over');
}
```

Never guard `game_complete` behind an if-victory condition.

---

## Restart: reset() Pattern

When the student taps "Try Again", call `signalCollector.reset()`. This flushes buffered events from the previous play (via sendBeacon), clears the buffer, and continues with the same listeners, identity, and batch numbering. No re-instantiation needed.

```javascript
function restartGame() {
  // Stop any playing audio
  FeedbackManager.sound.stopAll();
  FeedbackManager._stopCurrentDynamic();

  // Reset SignalCollector for new play (flushes previous events, keeps listeners)
  signalCollector.reset();

  // Reset all gameState fields
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.isActive = false;
  gameState.gameEnded = false;
  gameState.isProcessing = false;
  gameState.phase = 'start_screen';
  if (gameState.lives !== undefined) gameState.lives = gameState.totalLives;
  syncDOM();

  showStartScreen();
}
```

**Key:** `reset()` must happen BEFORE `showStartScreen()` so the collector captures the start screen transition with a clean buffer.

**Do NOT call `seal()` anywhere in a restartable game.** `seal()` removes all DOM listeners irreversibly. Use `reset()` on restart. Unload handlers handle true iframe destruction.

### reset() vs seal() — when to use which

| Scenario | Method | Why |
|----------|--------|-----|
| Student taps "Try Again" | `reset()` | iframe stays alive, same play session continues |
| Game end with Try Again button (default) | neither | unload handlers auto-flush on true destruction; listeners stay ready for restart |
| Terminal single-play game (no restart) | `seal()` | iframe won't be reused, need sendBeacon safety |
| Tab close / navigate away | (automatic) | unload handlers fire sendBeacon automatically |

---

## VisibilityTracker Integration

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    signalCollector.pause();
    signalCollector.recordCustomEvent('visibility_hidden', {});
    timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    signalCollector.resume();
    signalCollector.recordCustomEvent('visibility_visible', {});
    timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
});
```

---

## Ordering Rules Summary

| What | Must happen | Before |
|------|-----------|--------|
| `waitForPackages()` | resolve | `new SignalCollector()` |
| `new SignalCollector()` | construct | any `recordViewEvent` / `recordCustomEvent` call |
| signalConfig 6-property assign | complete | `startFlushing()` |
| message listener registered | registered | `game_ready` postMessage |
| `signalCollector.reset()` (restart) | complete | `showStartScreen()` |
| `seal()` (terminal games only) | complete | `game_complete` postMessage |
