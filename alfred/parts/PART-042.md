### PART-042: SignalCollector
**Purpose:** Atomic interaction capture — every click, tap, drag, keystroke — with batch flushing to GCS.
**Condition:** Every game that needs interaction analytics (all standard archetypes).
**API (constructor):** `new SignalCollector({ sessionId, studentId, gameId, contentSetId })`
**API (view events):** `signalCollector.recordViewEvent(viewType, viewData)` — on every visible DOM change
**API (custom events):** `signalCollector.recordCustomEvent(name, data)` — game-specific outcomes
**API (lifecycle):** `.seal()` (in endGame), `.pause()` / `.resume()` (VisibilityTracker), `.startFlushing()` (after signalConfig)
**Key rules:**
- NEVER define inline stub/polyfill — shadows real CDN class
- Do NOT call `seal()` in restartable games — it irreversibly removes DOM listeners. `seal()` is only for terminal single-play games.
- Call `.reset()` in `restartGame()` — flushes previous events, continues with same listeners
- All 6 signalConfig properties assigned from `game_init` before `startFlushing()`
