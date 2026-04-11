### PART-004: Initialization Block
**Purpose:** DOMContentLoaded handler — the boot sequence for every game.
**Flow:** `waitForPackages()` -> `FeedbackManager.init()` -> SignalCollector creation (PART-042) -> ScreenLayout inject -> Timer (if needed) -> VisibilityTracker -> register postMessage listener -> `setupGame()`
**Key rules:**
- `setupGame()` must set `gameState.isActive = true`, `gameState.startTime = Date.now()`
- Must fire `trackEvent('game_start', 'game')` at start of `setupGame()`
- Must send `window.parent.postMessage({ type: 'game_ready' }, '*')` after registering message listener
