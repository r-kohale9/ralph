# PART-008: PostMessage Protocol

**Category:** MANDATORY | **Condition:** Every game (games are templates) | **Dependencies:** PART-007

---

## Code — Receiver

```javascript
function handlePostMessage(event) {
  if (event.data?.type === 'game_init') {
    const { gameId, content, context, goals } = event.data.data;
    gameState.content = content;
    setupGame();
  }
}
```

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

- Incoming message: `contracts/postmessage-in.schema.json`
- Outgoing message: `contracts/postmessage-out.schema.json`

## Verification

- [ ] `handlePostMessage` function exists in global scope
- [ ] Checks `event.data?.type === 'game_init'`
- [ ] Extracts content and stores in `gameState.content`
- [ ] Calls `setupGame()` after receiving content
- [ ] `window.parent.postMessage` called in endGame with `type: 'game_complete'`
- [ ] Fallback content exists in `setupGame()` for standalone testing
