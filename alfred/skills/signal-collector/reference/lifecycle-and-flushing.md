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

## seal() at Game End

`seal()` implements a dual-track final flush designed for iframe deployment where the parent may destroy the frame immediately:

1. Stops the flush interval
2. **Synchronous:** fires `sendBeacon()` in 50-event chunks — survives iframe destruction
3. If sendBeacon rejected (browser quota): falls back to `postMessage` to parent
4. **Async bonus:** attempts `fetch` with 3 retries (confirmed delivery if iframe survives)
5. Detaches all DOM event listeners
6. Returns synchronously: `{ event_count, metadata }`

**Idempotent** — second call is a no-op, returns immediately.

```javascript
function endGame(outcome) {
  gameState.isActive = false;
  gameState.gameEnded = true;
  gameState.phase = outcome === 'victory' ? 'results' : 'game_over';
  syncDOM();

  // ... calculate metrics, show results screen ...

  // seal() BEFORE game_complete
  const result = signalCollector.seal();

  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: { accuracy, time, stars, attempts: gameState.attempts, duration_data },
      attempts: gameState.attempts,
      completedAt: Date.now(),
      signal_event_count: result.event_count,
      signal_metadata: result.metadata
    }
  }, '*');
}
```

**Signal data streams to GCS separately — NEVER included in postMessage payload.** Only `signal_event_count` and `signal_metadata` are included as summary fields.

---

## game_complete Must Fire on BOTH Paths

`seal()` + `game_complete` must fire on **both** victory and game-over:

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

## Restart: Re-instantiation Pattern

`seal()` marks the collector as permanently closed. All subsequent calls to `recordViewEvent`, `recordCustomEvent`, `pause`, `resume` are silently ignored. `restartGame()` must create a fresh instance:

```javascript
function restartGame() {
  // Stop any playing audio
  FeedbackManager.sound.stopAll();
  FeedbackManager._stopCurrentDynamic();

  // Re-instantiate SignalCollector (sealed collector is dead)
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    gameId: gameState.gameId || null,
    contentSetId: gameState.contentSetId || null
  });
  window.signalCollector = signalCollector;

  // Re-apply signalConfig if available
  if (gameState.signalConfig && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }

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

**Key:** Re-instantiation must happen BEFORE `showStartScreen()` so the new collector captures the start screen transition.

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
| `seal()` | complete | `game_complete` postMessage |
| `new SignalCollector()` (restart) | construct | `showStartScreen()` |
