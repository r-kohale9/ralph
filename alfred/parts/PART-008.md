### PART-008: PostMessage Protocol
**Purpose:** Communication between game (iframe) and parent harness via `window.postMessage`.
**Inbound:** `game_init` — delivers `content` + `signalConfig` to the game template.
**Outbound:** `game_ready` (after init), `game_complete` (with metrics/attempts at end).
**Key rules:**
- `game_ready` must fire AFTER `addEventListener('message', handlePostMessage)`
- `handlePostMessage` filters for `event.data.type === 'game_init'`, then calls `setupGame()`
- If PART-042: on `game_init`, configure SignalCollector with `signalConfig.flushUrl` and call `startFlushing()`
