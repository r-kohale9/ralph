# PART-004: Initialization Block

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-003

---

## Code

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // {{PART-010: SignalCollector — ALWAYS}}
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null
    });
    window.signalCollector = signalCollector;

    // {{IF PART-006 selected: TimerComponent creation here}}

    // {{PART-005: VisibilityTracker — ALWAYS}}

    window.addEventListener('message', handlePostMessage);

    setupGame();
  } catch (error) {
    console.error('Initialization failed:', error);
  }
});
```

## Rules

- Must be `async`
- Call order: `waitForPackages()` FIRST -> `FeedbackManager.init()` SECOND -> SignalCollector -> Timer (if any) -> VisibilityTracker -> postMessage listener -> `setupGame()`
- SignalCollector created BEFORE Timer (so VisibilityTracker can pause/resume it)
- Timer created BEFORE VisibilityTracker (so VisibilityTracker can reference it)
- Entire block wrapped in try/catch
- This is the ONLY code inside DOMContentLoaded — game logic functions go in global scope (RULE-001)

## Anti-Patterns

```javascript
// WRONG: Missing try/catch
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init(); // If this throws, nothing catches it
});

// WRONG: Game logic functions inside DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  function handleClick() { ... } // NOT accessible from onclick
});
```

## Verification

- [ ] `DOMContentLoaded` listener exists
- [ ] Handler is `async`
- [ ] `waitForPackages()` called first
- [ ] `FeedbackManager.init()` called second
- [ ] SignalCollector created and assigned to `window.signalCollector`
- [ ] VisibilityTracker created
- [ ] `handlePostMessage` listener registered
- [ ] `setupGame()` called last
- [ ] Wrapped in try/catch
