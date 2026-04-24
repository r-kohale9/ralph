# Skill: Signal Collector

## Purpose

Define exactly when and how games call SignalCollector methods — initialization, view events, custom events, seal, pause/resume, and restart — so every game captures complete interaction analytics without the builder guessing.

## When to use

Every game generation. This skill is not optional. SignalCollector is auto-loaded via the Helpers CDN package.

## Owner

Maintainer: Gen Quality slot (reviews integration rules) + Analytics slot (reviews event coverage).
Deletion trigger: retire when SignalCollector is replaced by a different capture system.

## Reads

- `skills/data-contract/` — game_complete schema, postMessage protocol — **ALWAYS**
- `skills/feedback/SKILL.md` — seal() must happen before game_complete; visibility pause/resume coordination — **ON-DEMAND**
- `alfred/parts/PART-042.md` — canonical brief reference — **ON-DEMAND**

## Input

- Game archetype (determines which view events are needed)
- Whether game has multi-step rounds (affects recordViewEvent frequency)

## Output

SignalCollector integration baked into generated game code. The builder reads this skill and implements all integration points by default.

## Reference Files

**MANDATORY:** When generating game code, ALWAYS read `reference/signalcollector-api.md` — it contains the exact constructor options, method signatures, view event types, and data-signal-id rules. Without it, the builder will call nonexistent methods (trackEvent, reset) that crash at runtime.

| File | Contents | When to read |
|------|----------|-------------|
| [signalcollector-api.md](reference/signalcollector-api.md) | Constructor options, all method signatures, view event types, custom event types, data-signal-id markup rules, wire format overview | **ALWAYS during code generation** |
| [lifecycle-and-flushing.md](reference/lifecycle-and-flushing.md) | Init sequence, signalConfig handling from game_init, startFlushing trigger, seal() dual-track behavior, restart re-instantiation, unload safety | **ALWAYS during code generation** |
| [view-event-patterns.md](reference/view-event-patterns.md) | Copy-paste patterns for each viewType (screen_transition, content_render, feedback_display, component_state, overlay_toggle, visual_update) with game-specific examples | ON-DEMAND |

---

## Integration Points

### POINT 1: Initialization (DOMContentLoaded)

After `waitForPackages()`, before game starts. Construct with 4 required args. Assign to `window.signalCollector`. Do NOT set `flushUrl` or `playId` here — those come from signalConfig in game_init.

```javascript
const signalCollector = new SignalCollector({
  sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
  studentId: window.gameVariableState?.studentId || null,
  gameId: gameState.gameId || null,
  contentSetId: gameState.contentSetId || null
});
window.signalCollector = signalCollector;
```

### POINT 2: signalConfig from game_init

In `handlePostMessage` for `game_init`, extract `signalConfig` from `event.data.data`. Assign all 6 properties with `||` fallback, then call `startFlushing()`.

```javascript
var sc = gameState.signalConfig = d.signalConfig || {};
if (signalCollector && sc.flushUrl) {
  signalCollector.flushUrl = sc.flushUrl;
  signalCollector.playId = sc.playId || null;
  signalCollector.gameId = sc.gameId || signalCollector.gameId;
  signalCollector.sessionId = sc.sessionId || signalCollector.sessionId;
  signalCollector.contentSetId = sc.contentSetId || signalCollector.contentSetId;
  signalCollector.studentId = sc.studentId || signalCollector.studentId;
  signalCollector.startFlushing();
}
```

### POINT 3: recordViewEvent on Every Visible DOM Change

**MANDATORY RULE:** Every function that modifies the DOM in a way that changes what is visible on screen **must** call `signalCollector.recordViewEvent()`. This includes screen transitions, content renders, cell selections, feedback display, overlay toggles, timer-driven reshuffles, and any other visible mutation. See `reference/view-event-patterns.md` for copy-paste patterns.

**Why:** All subsequent input events automatically include a `view_context` field with the last recorded view state. If recordViewEvent is skipped, replay narration has gaps and input events lack context.

### POINT 4: recordCustomEvent on Game Outcomes

Fire after the game logic processes the outcome:

```javascript
signalCollector.recordCustomEvent('round_solved', {
  round: gameState.currentRound,
  correct: isCorrect,
  answer: userAnswer,
  correct_answer: currentRound.answer
});
```

Standard custom events: `round_solved`, `hint_requested`, `visibility_hidden`, `visibility_visible`, `scaffold_opened`.

### POINT 5: Pause/Resume with VisibilityTracker

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    signalCollector.pause();
    signalCollector.recordCustomEvent('visibility_hidden', {});
    timer.pause();
  },
  onResume: () => {
    signalCollector.resume();
    signalCollector.recordCustomEvent('visibility_visible', {});
    timer.resume();
  }
});
```

### POINT 6: endGame — DO NOT call seal() if game has a Try Again button

**Default pattern (games with restart):** Do NOT call `seal()` in `endGame()`. The game's results/game-over screen has a "Try Again" / "Play Again" button — the iframe stays alive. Calling `seal()` removes all DOM listeners and cannot be undone, breaking the restart path. Let the unload handlers (pagehide/beforeunload) handle the final flush automatically when the iframe is actually destroyed (tab close, navigation, parent destroys frame).

```javascript
function endGame(outcome) {
  // ... set gameState.isActive = false, syncDOM, compute metrics ...

  // Get event count + metadata WITHOUT sealing
  var metadata = signalCollector.getMetadata();

  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: gameMetrics,
      attempts: gameState.attempts,
      completedAt: Date.now(),
      signal_event_count: signalCollector.getInputEvents().length,
      signal_metadata: metadata
    }
  }, '*');
}
```

**Only call `seal()` in the rare case of a terminal game with NO restart path** — e.g. a single-play assessment that never shows a replay button. In that case, call `seal()` before `game_complete` and use the returned `{ event_count, metadata }`.

**Signal data streams to GCS via batch flushing — never included in postMessage payload.**

### POINT 7: Reset in restartGame

Call `signalCollector.reset()` in `restartGame()`. This flushes buffered events from the previous play (via sendBeacon), clears the buffer, and continues with the same listeners and batch numbering. No re-instantiation needed.

```javascript
function restartGame() {
  signalCollector.reset();
  // ... reset gameState, syncDOM, showStartScreen
}
```

**Do NOT call `seal()` anywhere in a restartable game.** `seal()` is irreversible — it removes all DOM listeners. Use `reset()` on restart, and let unload handlers handle true iframe destruction.

### POINT 8: data-signal-id Markup

Add `data-signal-id` to all interactive elements for clear identification in signal events:

```html
<button data-signal-id="option-a" class="option">63</button>
<input data-signal-id="answer-input" type="text" inputmode="numeric">
<button data-signal-id="submit-button" class="submit-btn">Submit</button>
<button data-signal-id="hint-button" class="hint-btn">Hint</button>
```

Target identification priority: `data-signal-id` > `id` > `tag.className` > tag name.

---

## Constraints

1. **CRITICAL** — Never instantiate with empty constructor. Must pass `{ sessionId, studentId, gameId, contentSetId }`. (GEN-UX-005)
2. **CRITICAL** — Never define inline SignalCollector stub/class. Shadows the real CDN package. (Forbidden pattern)
3. **CRITICAL** — All 6 signalConfig properties must be assigned in game_init handler. (GEN-PM-SIGNALCONFIG)
4. **CRITICAL** — Do NOT call `seal()` in restartable games. `seal()` removes all DOM listeners irreversibly. Use `reset()` on restart; unload handlers auto-flush on true iframe destruction.
5. **CRITICAL** — Call `.reset()` in restartGame, never `seal()` + re-instantiate. (GEN-SIGNAL-RESET)
6. **CRITICAL** — `typeof SignalCollector` guard in `waitForPackages()`. CDN may load after DOMContentLoaded.
7. **STANDARD** — `recordViewEvent()` on every visible DOM change. Replay narration and view_context depend on it.
8. **STANDARD** — `data-signal-id` on all interactive elements. Enables clear target identification in replay analysis.
9. **ADVISORY** — `containerSelector` defaults to `'body'` — usually correct. Only override if game needs a specific container.

## Defaults

- `containerSelector`: `'body'` (captures all events including transition screens, ready buttons, overlays)
- `flushIntervalMs`: `5000` (do not change)
- Flushing does not start until `flushUrl` is set from signalConfig
- Unload handlers (`pagehide`, `beforeunload`, `visibilitychange`) are registered automatically in constructor

## Anti-patterns

1. `new SignalCollector()` with no args — produces invalid analytics payloads, fails GEN-UX-005.
2. `window.SignalCollector = class {...}` — inline polyfill shadows CDN package; real class never loads.
3. `signalCollector.trackEvent()` — this method does NOT exist on SignalCollector; crashes at runtime with ReferenceError. Use `recordViewEvent()` / the documented API in `reference/signalcollector-api.md`.
4. `seal()` + `new SignalCollector()` in restartGame — causes batch number collision in GCS. Use `reset()` instead.
5. Calling `seal()` in `endGame()` of a restartable game — permanently removes DOM listeners, breaks the Try Again flow. Unload handlers already cover iframe destruction.
6. Calling `seal()` then `reset()` — seal's listener removal cannot be undone; reset() on a sealed collector is a no-op.
7. Missing signalConfig property assignments — partial analytics, broken GCS paths.
8. Skipping `recordViewEvent` on DOM changes — replay narration has gaps, input events lack view_context.
9. Starting `signalCollector.startFlushing()` before `flushUrl` is set — silently does nothing.
