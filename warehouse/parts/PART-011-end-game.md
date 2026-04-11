# PART-011: End Game & Metrics

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-007, PART-009, PART-010, PART-042

---

## Code

```javascript
// Helper — compute per-round try counts (deduplicated)
function computeTriesPerRound(attempts) {
  var rounds = {};
  attempts.forEach(function(a) {
    var r = a.metadata.round;
    rounds[r] = (rounds[r] || 0) + 1;
  });
  return Object.keys(rounds).map(function(r) {
    return { round: Number(r), triesCount: rounds[r] };
  });
}

function endGame() {
  if (!gameState.isActive) return;
  gameState.isActive = false;
  gameState.duration_data.currentTime = new Date().toISOString();

  const correct = gameState.attempts.filter(a => a.correct).length;
  const total = gameState.attempts.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeTaken = timer ? timer.getTimeTaken() : Math.round((Date.now() - gameState.startTime) / 1000);
  const stars = accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy > 0 ? 1 : 0;

  const metrics = {
    accuracy,
    time: timeTaken,
    stars,
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: gameState.totalLives || 1,
    tries: computeTriesPerRound(gameState.attempts)
  };

  // If game has restart mechanism, include session history
  if (gameState.sessionHistory && gameState.sessionHistory.length > 0) {
    metrics.sessionHistory = [
      ...gameState.sessionHistory,
      { totalLives: gameState.totalLives || 1, tries: computeTriesPerRound(gameState.attempts) }
    ];
  }

  console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
  console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

  trackEvent('game_end', 'game', { metrics });

  // Seal SignalCollector — fires sendBeacon to flush all events to GCS, stops flush timer, detaches listeners (PART-042)
  if (signalCollector) signalCollector.seal();

  // Show results (PART-019)
  showResults(metrics);

  // Send to platform (PART-008)
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics,
      attempts: gameState.attempts,
      completedAt: Date.now()
    }
  }, '*');

  // Cleanup (RULE-005)
  if (timer) { timer.destroy(); timer = null; }
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

## Placement

Global scope function (RULE-001).

## Mandatory Metrics

| Field | Type | Description |
|-------|------|-------------|
| `accuracy` | number | 0-100 percentage |
| `time` | number | Seconds taken |
| `stars` | number | 0-3 star rating |
| `attempts` | array | Full attempt history (from PART-009) |
| `duration_data` | object | Full timing breakdown |
| `totalLives` | integer | Initial lives count. Default `1` for non-lives games. |
| `tries` | array | Per-round attempt count: `[{round: 1, triesCount: 2}, ...]` |
| `sessionHistory` | array (optional) | Present when game has restart mechanism. Each entry: `{totalLives, tries}` for that session. |

## Star Calculation (Default — Accuracy-Based)

| Accuracy | Stars |
|----------|-------|
| >= 80% | 3 |
| >= 50% | 2 |
| >= 1% | 1 |
| 0% | 0 |

Default thresholds are codified in `contracts/metrics.schema.json` → `star_thresholds`.

### Override: Lives-Based Stars

For games with lives (e.g., queens, puzzle games), stars can be calculated from remaining lives instead. **If overriding, the template MUST document the formula in Section 8 (Functions):**

```javascript
// Lives-based example (document in template):
const stars = lives >= 3 ? 3 : lives >= 2 ? 2 : lives >= 1 ? 1 : 0;
```

**Do not mix formulas** — use either accuracy-based OR lives-based, not both.

## CRITICAL: Every Code Path Must Reach endGame()

The `endGame()` function exists in every game, but it only works if something **calls** it. Every game must have at least one — often multiple — triggers:

| End Condition | Where to Call endGame() |
|--------------|------------------------|
| All rounds completed | Inside `nextRound()` — when `currentRound >= totalRounds` |
| Timer expires | Inside `timer.onEnd` callback |
| All lives lost | Inside the life-decrement logic — when `lives <= 0` |
| User quits | Inside quit/give-up button handler |

**Anti-pattern:** Having `endGame()` defined but never called. This happens when:
- `nextRound()` increments the round but never checks `>= totalRounds`
- Timer `onEnd` callback is missing or empty
- Lives reach 0 but the game just freezes instead of ending
- Transition screen after the final round shows "Continue" but has no `endGame()` path

**Every game template must explicitly document in Section 7 (Game Flow) exactly which code paths call `endGame()`, and the verification checklist must confirm each path works.**

## Rules

- Guard against double-call: `if (!gameState.isActive) return`
- Set `duration_data.currentTime` to ISO timestamp
- Log metrics with `JSON.stringify` (RULE-004)
- Fire `game_end` trackEvent BEFORE signal sealing
- Flush deferred `endProblem` before sealing (PART-042)
- Seal SignalCollector before postMessage — `seal()` performs final flush to GCS, detaches listeners, and is idempotent
- Call `showResults()` to display results screen (PART-019)
- Send postMessage with `metrics`, `attempts`, `completedAt` BEFORE cleanup (PART-008). Signal data is streamed to GCS via batch flushing — NOT included in postMessage.
- Cleanup ALL components LAST (RULE-005)
- Data stays readable after seal — console inspection works on game complete screen

## Contracts

Must conform to `contracts/metrics.schema.json`.

## Restart Game Pattern

If the game supports restarting (via TransitionScreen "Try again!" button), the `restartGame()` function must handle the fact that `endGame()` nulls `timer` and `visibilityTracker`. Recreate them:

```javascript
function restartGame() {
  // Push session snapshot BEFORE resetting (for sessionHistory in metrics)
  if (!gameState.sessionHistory) gameState.sessionHistory = [];
  gameState.sessionHistory.push({
    totalLives: gameState.totalLives || 1,
    tries: computeTriesPerRound(gameState.attempts)
  });

  // Reset gameState
  window.gameState.currentRound = 0;
  window.gameState.score = 0;
  window.gameState.attempts = [];
  window.gameState.events = [];
  window.gameState.isActive = true;
  window.gameState.startTime = Date.now();
  // Reset duration_data...

  // Recreate destroyed components (endGame nulls these)
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    gameId: gameState.gameId || null
  });
  window.signalCollector = signalCollector;
  timer = new TimerComponent('timer-container', { /* same config as initial */ });
  visibilityTracker = new VisibilityTracker({ /* same config as initial */ });

  // Re-render first round
  renderRound();
}
```

**Anti-pattern:** Calling `timer.start()` or `visibilityTracker.destroy()` in `restartGame` without null-checking — they were set to `null` by `endGame()`.

## Verification

- [ ] `endGame` function exists in global scope
- [ ] Guards against double-call (`if (!gameState.isActive) return`)
- [ ] Sets `gameState.isActive = false`
- [ ] Sets `duration_data.currentTime`
- [ ] Calculates accuracy, time, stars
- [ ] Logs `'Final Metrics:'` with JSON.stringify
- [ ] Logs `'Attempt History:'` with JSON.stringify
- [ ] Fires `game_end` trackEvent before signal sealing
- [ ] Flushes deferred `endProblem` before sealing
- [ ] Calls `signalCollector.seal()` before postMessage (final flush to GCS)
- [ ] Calls `showResults(metrics)`
- [ ] Sends `game_complete` postMessage with `metrics`, `attempts`, `completedAt`
- [ ] Signal data is NOT in postMessage (streamed to GCS via batch flushing)
- [ ] Destroys timer (if exists)
- [ ] Destroys visibilityTracker
- [ ] Stops all audio and streams
- [ ] `metrics.totalLives` set (default `1` for non-lives games)
- [ ] `metrics.tries` computed via `computeTriesPerRound(gameState.attempts)`
- [ ] `computeTriesPerRound` helper exists in global scope
- [ ] Restart pattern pushes `{totalLives, tries}` to `gameState.sessionHistory` before reset
- [ ] Restart pattern recreates SignalCollector
