# PART-004: Initialization Block

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-003

---

## Code

```javascript
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // {{PART-010: SignalCollector — ALWAYS}}
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || "session_" + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      gameId: gameState.gameId,
      contentSetId: gameState.contentSetId,
    });
    window.signalCollector = signalCollector;
    // Flushing starts when game_init arrives with signalConfig.flushUrl
    // {{IF PART-025 selected: ScreenLayout.inject() + clone template into #gameContent HERE}}

    // {{IF PART-006 selected: TimerComponent creation here}}

    // {{PART-005: VisibilityTracker — ALWAYS}}

    window.addEventListener("message", handlePostMessage);

    setupGame();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
});
```

## setupGame() — CRITICAL Requirements

`setupGame()` is called from two places: DOMContentLoaded (with fallback content) and `handlePostMessage` (with real content). It MUST:

```javascript
function setupGame() {
  if (!gameState.content) {
    gameState.content = fallbackContent; // PART-008 fallback
  }

  // MANDATORY: Set these fields — other parts depend on them
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.duration_data.startTime = new Date().toISOString();

  // Start timer (if exists) — without this, timer stays at 00:00
  if (timer) timer.start();

  trackEvent("game_start", "game");

  // Render first round
  renderRound();
}
```

**If `setupGame()` does not set `gameState.startTime = Date.now()`, then `recordAttempt()` produces NaN times.**
**If `setupGame()` does not call `timer.start()`, the timer stays at 00:00 forever.**
**If `setupGame()` does not set `gameState.isActive = true`, `endGame()` exits immediately.**

## Rules

- Must be `async`
- Call order: `waitForPackages()` FIRST → `FeedbackManager.init()` SECOND → SignalCollector → ScreenLayout.inject (if any) → Timer (if any) → VisibilityTracker → postMessage listener → `setupGame()`
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
- [ ] ScreenLayout.inject() called before ProgressBar/TransitionScreen (if using PART-025)
- [ ] TimerComponent created (if PART-006) with correct `endTime`
- [ ] VisibilityTracker created with `onInactive`/`onResume` callbacks
- [ ] `handlePostMessage` listener registered
- [ ] `setupGame()` called last
- [ ] Wrapped in try/catch
- [ ] **`setupGame()` sets `gameState.startTime = Date.now()`**
- [ ] **`setupGame()` sets `gameState.isActive = true`**
- [ ] **`setupGame()` calls `timer.start()` (if timer exists)**
- [ ] **`setupGame()` calls `trackEvent('game_start', 'game')`**
