# PART-008: PostMessage Protocol

**Category:** MANDATORY | **Condition:** Every game (games are templates) | **Dependencies:** PART-007

---

## Code — Ready Signal (sent after initialization)

Every game MUST notify the parent frame that it is ready to receive content. This is sent **once**, after the game has finished initializing (packages loaded, DOM ready, listener registered).

```javascript
// Inside DOMContentLoaded, AFTER registering the message listener:
window.addEventListener('message', handlePostMessage);

// Signal to parent harness that game is ready to receive content
window.parent.postMessage({ type: 'game_ready' }, '*');
```

**Why this is required:** The parent harness (iframe host) waits for `game_ready` before sending `game_init` with content. Without this signal, the harness never sends content and the game falls back to hardcoded test data.

**Timing:** `game_ready` must fire AFTER `window.addEventListener('message', handlePostMessage)` so the game is already listening when `game_init` arrives in response.

## Code — Receiver

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};
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

**CRITICAL: SignalCollector setup in handlePostMessage** — The code above includes the complete pattern with all 6 signalCollector property assignments from signalConfig (PART-010). This is MANDATORY for every game. Without it, signal events accumulate in memory but never flush to GCS. See PART-010 "Batch Flushing" for details.

**Note:** `setupGame()` is called BOTH here and in DOMContentLoaded (PART-004). This is intentional:
- First call (DOMContentLoaded): uses fallback content for standalone testing
- Second call (postMessage): uses real content from platform

`setupGame()` must handle being called multiple times — it resets all state fields (see PART-004's setupGame template). The second call overwrites the first completely.

## Code — Sender (called in endGame)

```javascript
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: {
      accuracy: accuracy,
      time: timeTaken,
      stars: stars,
      attempts: gameState.attempts,
      duration_data: gameState.duration_data
    },
    events: gameState.events,
    completedAt: Date.now()
  }
}, '*');
```

## Placement

- `game_ready` postMessage: Inside DOMContentLoaded, after `window.addEventListener('message', handlePostMessage)` — fires once
- `handlePostMessage`: Global scope function (RULE-001)
- Listener registered in PART-004: `window.addEventListener('message', handlePostMessage)`
- Sender called inside `endGame()` (PART-011)

## Standalone Testing Fallback

Games MUST work without postMessage for local testing. In `setupGame()`:

```javascript
function setupGame() {
  if (!gameState.content) {
    // Fallback content for standalone testing
    gameState.content = {{HARDCODED_TEST_CONTENT}};
  }
  // Initialize game with gameState.content...
}
```

## Contracts

- Ready signal: `{ type: 'game_ready' }` (game → parent)
- Incoming message: `contracts/postmessage-in.schema.json` (parent → game)
- Outgoing message: `contracts/postmessage-out.schema.json` (game → parent)

## Verification

- [ ] `game_ready` postMessage sent after initialization — `window.parent.postMessage({ type: 'game_ready' }, '*')`
- [ ] `game_ready` fires AFTER `window.addEventListener('message', handlePostMessage)` (listener must be registered first)
- [ ] `handlePostMessage` function exists in global scope
- [ ] Checks `event.data?.type === 'game_init'`
- [ ] Extracts content and stores in `gameState.content`
- [ ] Calls `setupGame()` after receiving content
- [ ] `window.parent.postMessage` called in endGame with `type: 'game_complete'`
- [ ] Fallback content exists in `setupGame()` for standalone testing
