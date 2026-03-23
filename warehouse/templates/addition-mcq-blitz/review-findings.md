# Review Findings — Addition MCQ Blitz

## Step 1 — Game Understanding

1. **Math concept:** Two-operand addition (single to double digits).
2. **Core mechanic:** A complete equation with a missing sum (e.g. "34 + 47 = ?") is shown. The student selects the correct sum from 4 options. The mechanic forces active computation, not passive recognition.
3. **One round walkthrough:** Question renders with 4 option cards → 30s countdown starts → student taps a card → selection is locked, timer stops → if correct: green highlight, score++, 1.2s delay, advance → if wrong: red on tapped card, green on correct card, life lost, 1.4s delay, advance or game over.
4. **States a user can be in:**
   - Awaiting first interaction (game just loaded or round just rendered)
   - Option selected / feedback showing (locked, waiting for setTimeout)
   - Timer expired / feedback showing (locked, waiting for setTimeout)
   - Results screen (game over or all rounds complete)

---

## Step 2 — Concept Check

All 10 fallback questions verified correct:
- 12+15=27 ✓, 34+47=81 ✓, 56+38=94 ✓, 23+19=42 ✓, 67+25=92 ✓
- 48+36=84 ✓, 71+18=89 ✓, 15+49=64 ✓, 83+14=97 ✓, 29+53=82 ✓

Distractors are plausible (close to correct answer), difficulty is appropriate for practice. A student cannot reliably bypass the concept — guessing with 4 options and a 3-life limit is risky.

---

## Findings

---

### ⚠️ Warning · Interaction — Redundant `timer.start()` in `setupGame()` immediately overridden by `renderRound()`

**What the spec says:** "`setupGame()` → timer.start() → renderRound()" and "`renderRound()` → timer.stop() → timer.updateConfig({ seconds: 30 }) → timer.start()`"

**Problem:** `setupGame()` calls `timer.start()` as part of its own sequence, then immediately calls `renderRound()`. The very first thing `renderRound()` does is `timer.stop()` — which halts the timer that was just started. Then it resets and restarts the timer. This means the timer fires a brief tick (potentially triggering an `onEnd` callback race) or at minimum causes an unnecessary start/stop cycle on initialization. On slower devices, there is a non-zero chance the timer fires `onEnd` between the `setupGame` start and the `renderRound` stop, which would call `handleTimerExpiry()` before any question is rendered — leaving `gameState.selectedOption` at `null` and trying to operate on `gameState.content.questions[0]` which may not yet be rendered.

**Suggested fix:** Remove `timer.start()` from `setupGame()`. Timer management (stop, reset, start) should live entirely in `renderRound()`, which is the function responsible for setting up each question. `setupGame()` should initialize state and call `renderRound()` — `renderRound()` is what arms the timer for the first question.

---

### ⚠️ Warning · Interaction — `recordViewEvent` called on sealed SignalCollector inside `showResults()`

**What the spec says:** In `endGame()`: "Flush deferred endProblem → `signalCollector.seal()` → `showResults(metrics)` → `postMessage game_complete`". Inside `showResults()`: "`signalCollector?.recordViewEvent('screen_transition', { screen: 'results', ... })`"

**Problem:** `signalCollector.seal()` is called in `endGame()` before `showResults()` is invoked. `seal()` detaches all listeners and finalises the signal payload. The `signalPayload` variable is captured from `seal()`'s return value before `showResults()` runs. When `showResults()` then calls `recordViewEvent(...)` on the now-sealed collector, the event is recorded into a buffer that has already been finalized and transmitted — it will not appear in the payload sent to the platform. The results screen transition event is silently lost.

**Suggested fix:** Move the `signalCollector.recordViewEvent('screen_transition', ...)` call to just before `seal()` in `endGame()`, not inside `showResults()`. Alternatively, remove it from `showResults()` entirely and add it explicitly in `endGame()` between the deferred `endProblem` flush and the `seal()` call.

---

### ℹ️ Info · Completeness — `gameState.gameId` not declared in initial state object

**What the spec says:** Section 5 Game State declares the full `window.gameState` object. `gameId` is not listed. In `handlePostMessage`: `if (gameId) gameState.gameId = gameId`.

**Problem:** `gameId` is dynamically added to `gameState` at runtime via postMessage but never declared in the initial state definition in Section 5. This makes the spec incomplete as a reference document — a reader cannot tell from Section 5 alone what fields `gameState` may contain.

**Suggested fix:** Add `gameId: null` to the game-specific fields in Section 5's `window.gameState` declaration, with a comment that it is populated from the `game_init` postMessage.

---

## Summary Table

| # | Severity | Category | Title |
|---|----------|----------|-------|
| 1 | ⚠️ Warning | Interaction | Redundant `timer.start()` in `setupGame()` immediately overridden by `renderRound()` |
| 2 | ⚠️ Warning | Interaction | `recordViewEvent` called on sealed SignalCollector inside `showResults()` |
| 3 | ℹ️ Info | Completeness | `gameState.gameId` not declared in initial state object |

**VERDICT: Needs revision — 0 Critical, 2 Warnings**
