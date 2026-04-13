### PART-010: Event Tracking
**Purpose:** Game-level event logging — pushes events to `gameState.events[]`.
**API:** `trackEvent(type, target, data)` — pushes to `gameState.events[]`
**Key rules:**
- Standard events: `game_start`, `game_end`, `question_shown`, `tap`, `input_change`, `drag_start`, `drag_end`, `game_paused`, `game_resumed`
- Fire `game_start` at beginning of `setupGame()`
- Fire `game_end` in `endGame()` before cleanup
