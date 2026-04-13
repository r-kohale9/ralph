# PART-042: SignalCollector

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-003, PART-004, PART-007

---

## Purpose

SignalCollector captures every atomic user interaction and computes problem-level signals (Tier 2-4). This PART defines the API surface and placement only — behavioral rules and integration patterns live in the skill.

## Constructor

```javascript
signalCollector = new SignalCollector({
  sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
  studentId: window.gameVariableState?.studentId || null,
  gameId: gameState.gameId,
  contentSetId: gameState.contentSetId
});
window.signalCollector = signalCollector;
```

## Method Summary

| Method | Purpose |
|--------|---------|
| `recordViewEvent(viewType, viewData)` | Record any visible DOM change (screen swap, content render, feedback, visual update) |
| `recordCustomEvent(type, data)` | Record game-specific events not captured by automatic listeners |
| `reset()` | Reset for new play ("Try Again") — flushes previous events, clears buffer, keeps listeners |
| `seal()` | Finalize at true game end (iframe destruction) — fires sendBeacon, detaches listeners |
| `pause()` | Pause signal collection (use with VisibilityTracker) |
| `resume()` | Resume signal collection |
| `startFlushing()` | Start periodic batch-streaming to `flushUrl` |
| `stopFlushing()` | Stop periodic flushing (called automatically by `seal()`) |

## Placement

Inside `DOMContentLoaded`, after `FeedbackManager.init()`, before Timer creation. See PART-004 for exact position in the initialization block.

## Key Rules

1. **NEVER define an inline stub/polyfill** — shadows the CDN class. `waitForPackages()` (PART-003) handles the loading wait.
2. **Do NOT call `seal()` in restartable games** — `seal()` irreversibly removes all DOM listeners. Use `getMetadata()` + `getInputEvents().length` for `signal_event_count` / `signal_metadata` in `game_complete`. Unload handlers auto-flush on true iframe destruction. `seal()` is only for terminal single-play games (no Try Again).
3. **Call `reset()` in `restartGame()`** — flushes previous events, continues with same listeners and batch numbering. Do NOT seal + re-instantiate.
4. **All 6 `signalConfig` properties assigned from `game_init` before `startFlushing()`** — flushUrl, playId, gameId, sessionId, contentSetId, studentId.
5. **`recordViewEvent()` on every visible DOM change** — every function that modifies what is on screen must call it.
6. **`data-signal-id` on all interactive elements** — buttons, inputs, draggables, tap targets.

## Verification

- [ ] No inline SignalCollector stub/polyfill/fallback class defined anywhere
- [ ] Created in PART-004 after `FeedbackManager.init()`, before Timer
- [ ] Assigned to `window.signalCollector`
- [ ] All 6 signalConfig properties set in `handlePostMessage` before `startFlushing()`
- [ ] `recordViewEvent()` called in every DOM-modifying function
- [ ] `data-signal-id` attributes on interactive elements
- [ ] `seal()` is NOT called in `endGame()` for restartable games (only in terminal single-play games)
- [ ] Integrated with VisibilityTracker for pause/resume (PART-005)

## Cross-Reference

For complete view event patterns, lifecycle rules, and integration points, see `skills/signal-collector/SKILL.md`.
