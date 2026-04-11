# PART-010: Event Tracking

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-007

---

## Event Tracking (trackEvent)

The `trackEvent` function pushes game-level events to `gameState.events`. This is a simple, synchronous event logging system — always present in every game.

### Code

```javascript
function trackEvent(type, target, data = {}) {
  gameState.events.push({
    type,
    target,
    timestamp: Date.now(),
    ...data
  });
}
```

### Placement

Global scope function (RULE-001).

### Standard Event Types

| Type | When to Fire | Example Call |
|------|-------------|-------------|
| `game_start` | `setupGame()` begins | `trackEvent('game_start', 'game')` |
| `game_end` | `endGame()` called | `trackEvent('game_end', 'game', { metrics })` |
| `question_shown` | Round renders | `trackEvent('question_shown', 'game', { round, question })` |
| `tap` | User clicks/taps | `trackEvent('tap', 'btn-submit', { position: {x,y} })` |
| `input_change` | User types | `trackEvent('input_change', 'answer-input', { value })` |
| `drag_start` | Drag begins | `trackEvent('drag_start', 'tile-5', { position })` |
| `drag_end` | Drag ends | `trackEvent('drag_end', 'tile-5', { dropTarget, position })` |
| `game_paused` | Tab loses focus | `trackEvent('game_paused', 'system')` |
| `game_resumed` | User resumes | `trackEvent('game_resumed', 'system')` |

### Rules

- Fire `game_start` at beginning of `setupGame()`
- Fire `game_end` in `endGame()` before cleanup
- Fire game-specific events at every user interaction point
- Always include `target` (the element or system that triggered it)

### Verification

- [ ] `trackEvent` function exists in global scope
- [ ] `game_start` fires in `setupGame()`
- [ ] `game_end` fires in `endGame()`
- [ ] Events push to `gameState.events[]`

> **Note:** For atomic interaction capture (SignalCollector), see **PART-042**.
