# SignalCollector v3.0.0 & Game Event Protocol

> Comprehensive reference for the signal capture system and game iframe communication protocol.
> Last updated: 2026-04-01

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [PostMessage Protocol](#postmessage-protocol)
3. [SignalCollector API](#signalcollector-api)
4. [Flush Architecture](#flush-architecture)
5. [Seal: Dual-Track Final Flush](#seal-dual-track-final-flush)
6. [Sentry Auto-Bootstrap](#sentry-auto-bootstrap)
7. [Reliability Measures](#reliability-measures)
8. [Event Wire Format](#event-wire-format)
9. [T1 Validation Rules](#t1-validation-rules)
10. [Evolution: v2 → v3 Changes](#evolution-v2--v3-changes)
11. [MCP Tools for Signal Analysis](#mcp-tools-for-signal-analysis)
12. [File Reference](#file-reference)

---

## Architecture Overview

**Key principle:** Metrics flow via postMessage. Signal data streams to GCS via batch flushing — never included in postMessage.

### Lifecycle Timeline

```
 PARENT                          GAME IFRAME                        GCS
   │                                │                                │
   │  1. Creates <iframe>           │                                │
   │──────────────────────────────► │                                │
   │                                │                                │
   │                          2. DOMContentLoaded fires              │
   │                             ├─ waitForPackages()                │
   │                             ├─ FeedbackManager.init()           │
   │                             ├─ new SignalCollector(...)         │
   │                             ├─ addEventListener('message',...)  │
   │                             │                                   │
   │  3. game_ready              │                                   │
   │◄────────────────────────────│  postMessage({type:'game_ready'}) │
   │                             │                                   │
   │  4. game_init               │                                   │
   │  postMessage({              │                                   │
   │    type:'game_init',        │                                   │
   │    data: {                  │                                   │
   │      content,               │                                   │
   │      signalConfig: {        │                                   │
   │        flushUrl, playId,    │                                   │
   │        gameId, sessionId,   │                                   │
   │        contentSetId,        │                                   │
   │        studentId            │                                   │
   │      }                      │                                   │
   │    }                        │                                   │
   │────────────────────────────►│                                   │
   │                             │                                   │
   │                          5. handlePostMessage receives game_init│
   │                             ├─ set signalCollector.flushUrl     │
   │                             ├─ set signalCollector.playId       │
   │                             ├─ signalCollector.startFlushing()  │
   │                             ├─ setupGame() with real content    │
   │                             │                                   │
   │                       ══════╪═══ GAMEPLAY PHASE ════════════════╪══
   │                             │                                   │
   │                          6. User interacts (click/type/drag)    │
   │                             ├─ Auto-captured by event listeners │
   │                             ├─ recordViewEvent() on DOM changes │
   │                             ├─ recordCustomEvent() on game evts │
   │                             │                                   │
   │                          7. Every 5s: _flush() interval fires   │
   │                             ├─ <100 events + <30s old? → skip   │
   │                             ├─ ≥100 events OR ≥30s old? → send │
   │                             │────────── batch POST ────────────►│
   │                             │◄───────── 200 OK ────────────────│
   │                             ├─ splice sent events from buffer   │
   │                             │                                   │
   │                          8. Tab hidden (visibilitychange)       │
   │                             │────────── _flush() via fetch ───►│
   │                             │                                   │
   │                       ══════╪═══ GAME END ═════════════════════╪══
   │                             │                                   │
   │                          9. endGame() called (victory or loss)  │
   │                             ├─ signalCollector.seal()           │
   │                             │   ├─ stopFlushing()               │
   │                             │   ├─ _sendBeaconAll() ──────────►│ sendBeacon (survives
   │                             │   │   (50-event chunks)           │  iframe destruction)
   │                             │   └─ _flush(true) ──────────────►│ fetch bonus (confirmed
   │                             │       (bypasses MIN_FLUSH_SIZE)   │  delivery if alive)
   │                             │                                   │
   │  10. game_complete          │                                   │
   │◄────────────────────────────│  postMessage({                    │
   │   metrics: {accuracy,       │    type:'game_complete',          │
   │     time, stars, attempts,  │    data: {metrics, attempts,      │
   │     tries, duration_data}   │      completedAt}                 │
   │                             │  })                               │
   │                             │                                   │
   │  11. Parent may destroy     │                                   │
   │      iframe at any time     │                                   │
   │──────────── X ──────────────│                                   │
   │                             │                                   │
   │                       (pagehide/beforeunload fire)              │
   │                             │── _sendBeaconAll() ─────────────►│ last-resort safety net
   │                             │                                   │
```

### When Each Flush Path Triggers

| Trigger                     | Method                              | Survives iframe kill?      | Confirmed delivery?        |
| --------------------------- | ----------------------------------- | -------------------------- | -------------------------- |
| Every 5s interval           | `_flush()` via fetch                | No                         | Yes (splice on 200 OK)     |
| Tab hidden / minimized      | `_flush()` via fetch                | No                         | Yes                        |
| `seal()` called (game end)  | `_sendBeaconAll()` + `_flush(true)` | sendBeacon: Yes. fetch: No | sendBeacon: No. fetch: Yes |
| `pagehide` (iframe removed) | `_sendBeaconAll()`                  | Yes                        | No                         |
| `beforeunload` (tab close)  | `_sendBeaconAll()`                  | Yes                        | No                         |
| fetch fails 3x              | Events kept in buffer               | —                          | Retried next interval      |
| sendBeacon rejected (quota) | `postMessage` fallback to parent    | —                          | Depends on parent          |

---

## PostMessage Protocol

### Message Flow

```
Game → Parent:   game_ready
Parent → Game:   game_init  { content, signalConfig }
Game → Parent:   game_complete  { metrics, attempts, completedAt }
```

### 1. `game_ready` (Game → Parent)

Sent after DOMContentLoaded, after the message listener is registered.

```javascript
window.addEventListener('message', handlePostMessage);
window.parent.postMessage({ type: 'game_ready' }, '*');
```

**Timing rule:** Must fire AFTER `addEventListener('message', ...)` so the game is already listening when `game_init` arrives.

### 2. `game_init` (Parent → Game)

```javascript
{
  type: 'game_init',
  data: {
    gameId: 'game_1234567890_abc',
    content: { /* per inputSchema */ },
    context: { /* student performance history */ },
    goals: { /* target metrics */ },
    signalConfig: {
      flushUrl: 'https://asia-south1-mathai-449208.cloudfunctions.net/write-to-gcs',
      playId: 'play_uuid_123',
      gameId: 'game_...',           // optional override
      sessionId: 'ses_...',         // optional override
      contentSetId: 'cset_...',     // optional override
      studentId: 'stu_...'          // optional override
    }
  }
}
```

### 3. `game_complete` (Game → Parent)

```javascript
{
  type: 'game_complete',     // exact string — not 'complete', 'completed', 'game-complete'
  data: {
    metrics: {
      accuracy: 75,          // 0-100
      time: 45,              // seconds
      stars: 2,              // 0-3
      attempts: [...],
      duration_data: {...},
      totalLives: 1,
      tries: [{ round: 1, triesCount: 2 }, ...]
    },
    attempts: [...],
    completedAt: Date.now()
  }
}
```

**Rules:**

- Must fire on ALL endGame paths (victory AND game-over)
- Must fire AFTER `signalCollector.seal()`
- Never guard behind an if-victory condition
- Signal data NOT included — it streams to GCS separately

### API Calls on Game Completion

When `endGame()` fires, these network requests happen in order:

```
endGame()
  │
  ├─ 1. signalCollector.seal()
  │     ├─ sendBeacon POST ──► write-to-gcs cloud function (50-event chunks)
  │     └─ fetch POST ────────► write-to-gcs cloud function (200-event chunks, 3x retry)
  │
  ├─ 2. postMessage({ type: 'game_complete', data: { metrics, attempts, completedAt } })
  │     └─► Parent app saves metrics and attempts
  │
  ├─ 3. (only if sendBeacon rejected)
  │     postMessage({ type: 'signal_collector_fallback', payload })
  │     └─► Parent app forwards signal data to GCS
  │
  └─ 4. (after parent destroys iframe)
        pagehide/beforeunload → sendBeacon POST ──► write-to-gcs (last-resort, skipped if already sent)
```

**Cloud function:**

| Field        | Value                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL          | `https://asia-south1-mathai-449208.cloudfunctions.net/write-to-gcs`                                                                                               |
| Method       | POST                                                                                                                                                              |
| Content-Type | `application/json`                                                                                                                                                |
| Payload      | `{ path: "signal-events/{studentId}/{sessionId}/{gameId}/{contentSetId}/{playId}/batch-{N}.json", data: { batch_number, events, event_count, flushed_at, ... } }` |
| Destination  | GCS bucket                                                                                                                                                        |

**What the parent app does** (outside ralph repo):

- Receives `game_complete` → saves metrics, attempts, and session record
- Receives `signal_collector_fallback` → forwards failed signal batches to GCS
- May destroy iframe at any time after receiving `game_complete`

---

## SignalCollector API

### Constructor

```javascript
var sc = new SignalCollector({
  sessionId: 'ses_123',
  studentId: 'stu_456',
  gameId: 'game_789', // preferred (also accepts templateId for backward compat)
  contentSetId: 'cset_abc',
  // flushUrl and playId set later from signalConfig in game_init
});
window.signalCollector = sc;
```

| Option              | Default            | Description                                 |
| ------------------- | ------------------ | ------------------------------------------- |
| `sessionId`         | `null`             | Session identifier                          |
| `studentId`         | `null`             | Student identifier                          |
| `gameId`            | `null`             | Game identifier (also accepts `templateId`) |
| `contentSetId`      | `null`             | Content set identifier                      |
| `flushUrl`          | GCS cloud function | Batch upload endpoint                       |
| `playId`            | `null`             | Unique play session ID for GCS path dedup   |
| `containerSelector` | `'body'`           | CSS selector for event delegation           |
| `flushIntervalMs`   | `5000`             | Milliseconds between batch flushes          |

### Active Methods

| Method                          | Returns                     | Description                                               |
| ------------------------------- | --------------------------- | --------------------------------------------------------- |
| `recordViewEvent(type, data)`   | —                           | Screen transitions, content renders, visual updates       |
| `recordCustomEvent(type, data)` | —                           | Game-specific events (round_solved, hint_requested)       |
| `seal()`                        | `{ event_count, metadata }` | Final flush via sendBeacon, detach listeners. Idempotent. |
| `pause()`                       | —                           | Pause all event recording                                 |
| `resume()`                      | —                           | Resume recording                                          |
| `startFlushing()`               | —                           | Start periodic batch uploads (5s interval)                |
| `stopFlushing()`                | —                           | Stop periodic uploads                                     |
| `getInputEvents()`              | `Array`                     | Copy of buffered events                                   |
| `getMetadata()`                 | `Object`                    | Collector metadata                                        |
| `getCurrentView()`              | `Object\|null`              | Last recorded view state                                  |
| `debug()`                       | `Object`                    | Log and return full debug summary                         |

### View Event Types

```
view:screen_transition    — phase changes (intro → gameplay → results)
view:content_render       — new question/round rendered
view:feedback_display     — correct/wrong feedback shown
view:component_state      — timer, score, lives updated
view:overlay_toggle       — modal/overlay shown/hidden
view:visual_update        — multi-input or drag state change
```

### Custom Event Examples

```javascript
signalCollector.recordCustomEvent('round_solved', { round: 3, correct: true, time_ms: 4200 });
signalCollector.recordCustomEvent('hint_requested', { round: 3, hint_type: 'visual' });
signalCollector.recordCustomEvent('visibility_hidden', {});
```

---

## Flush Architecture

### Thresholds

```
MIN_FLUSH_SIZE  = 100 events    — don't flush small batches
MAX_FLUSH_AGE_MS = 30,000ms     — but never hold events > 30s
CHUNK_SIZE      = 200 events    — max per fetch request (~120KB)
FLUSH_INTERVAL  = 5,000ms       — check every 5 seconds
```

### Decision Flow

```
_flush() called every 5s
    │
    ├─ _flushInProgress? → skip (prevent re-entrant calls)
    ├─ no flushUrl? → skip
    ├─ 0 events? → skip
    ├─ < 100 events AND oldest < 30s? → skip (wait for more)
    │
    └─ Take first 200 events → build payload → fetch POST
         │
         ├─ Success → splice events from buffer → drain remaining
         └─ Failure → retry 3x with exponential backoff (1s, 2s, 4s)
                        └─ All retries failed → Sentry error, keep in buffer
```

### GCS Path Structure

```
signal-events/{studentId}/{sessionId}/{gameId}/{contentSetId}/{playId}/batch-{N}.json
```

### Batch Payload

```javascript
{
  path: "signal-events/stu_456/ses_123/game_789/cset_abc/play_uuid/batch-1.json",
  data: {
    batch_number: 1,
    session_id: "ses_123",
    student_id: "stu_456",
    game_id: "game_789",
    content_set_id: "cset_abc",
    play_id: "play_uuid",
    events: [ /* event objects */ ],
    event_count: 147,
    flushed_at: 1740483927341
  }
}
```

### Why MIN_FLUSH_SIZE Matters

Without it, a student reading a question generates ~1 event per 5s interval (a single `pointermove` or `visibilitychange`). This creates many tiny HTTP requests. With the threshold:

- **High activity** (rapid clicking/typing): batches of 100-200, unchanged behavior
- **Low activity** (reading): events accumulate, one batch every ~30s
- **No data loss**: MAX_FLUSH_AGE_MS guarantees flush within 30s even at 1 event
- **`seal()` unaffected**: uses sendBeacon directly, bypasses this guard

---

## Seal: Dual-Track Final Flush

`seal()` is designed for iframe deployment where the parent may destroy the frame immediately after `game_complete`.

```
seal()
  │
  ├─ 1. stopFlushing()                    — clear the 5s interval
  ├─ 2. _sealed = true
  ├─ 3. _sendBeaconAll()                  — SYNCHRONOUS: 50-event chunks via sendBeacon
  │      ├─ sendBeacon succeeds            — data survives iframe destruction
  │      ├─ sendBeacon rejected (quota)    — fallback to postMessage to parent
  │      └─ both fail                      — Sentry error, data may be lost
  ├─ 4. _flush()                           — ASYNC BONUS: fetch with retry (if iframe survives)
  ├─ 5. _removeAllListeners()              — detach all DOM handlers
  └─ return { event_count, metadata }      — synchronous return
```

**Chunk sizing:**

- sendBeacon: 50 events (~30KB) — safe for browser quota limits
- fetch: 200 events (~120KB) — standard batch size

**Idempotent:** second `seal()` call returns immediately.

---

## Sentry Auto-Bootstrap

SignalCollector initializes Sentry automatically with a 3-case strategy:

```
Case 1: window.Sentry.isInitialized() → reuse existing SDK
Case 2: window.Sentry exists but not initialized → call Sentry.init()
Case 3: Sentry not loaded → inject CDN script dynamically → init
```

**CDN:** `https://browser.sentry-cdn.com/10.23.0/bundle.min.js`

**Events captured:**
| Event | Severity | When |
|-------|----------|------|
| `flush_failed_after_3_retries` | error | All 3 fetch retries failed |
| `sendBeacon_rejected` | warning | Browser quota exceeded during seal |
| `sendBeacon_and_postMessage_both_failed` | error | Both fallback paths failed |
| `emergency_cap_hit` | warning | 10,000 events buffered (OOM risk) |
| `no_container_found` | warning | Bad containerSelector |

**Scope tags:** `signal_collector_version`, `game_id`, `play_id`

**Error queue:** Errors captured before Sentry loads are queued and flushed once ready.

---

## Reliability Measures

### Unload Handlers (3 redundant paths)

| Handler            | Fires When                            | Action             | Why                                            |
| ------------------ | ------------------------------------- | ------------------ | ---------------------------------------------- |
| `pagehide`         | iframe removed, tab close, navigation | `_sendBeaconAll()` | Primary — works on iOS Safari + Android        |
| `beforeunload`     | tab close, navigation                 | `_sendBeaconAll()` | Desktop fallback                               |
| `visibilitychange` | tab switch, minimize                  | `_flush()` (fetch) | Network still alive, prefer confirmed delivery |

### Concurrency Protection

- **`_flushInProgress` flag** — prevents re-entrant `_flush()` calls from interval + visibility overlap
- **Single `setInterval`** — `startFlushing()` returns immediately if timer exists
- **`_sealed` flag** — blocks all recording and flushing after `seal()`
- **`!gameState.isActive` guard** — prevents double `endGame()` calls

### Memory Safety

- **Emergency cap:** 10,000 events max — oldest dropped if exceeded (Sentry warning)
- **Splice-on-success:** uploaded events removed from `_events` array immediately
- **Listener cleanup:** all DOM listeners tracked and removed on `seal()`
- **Passive listeners:** all event handlers use `{ passive: true }` — zero scroll jank

### Network Resilience

- **10s fetch timeout** via AbortController
- **3 retries** with exponential backoff (1s → 2s → 4s)
- **Events retained on failure** — retried on next interval
- **sendBeacon fallback** — survives iframe destruction when fetch can't complete

### Throttling

- `pointermove`: max 1 event per 500ms
- `touchmove`: max 1 event per 500ms

---

## Event Wire Format

```javascript
{
  event_id: "uuid-v4",
  student_id: "stu_456",
  session_id: "ses_123",
  template_id: "game_789",              // wire name kept for data pipeline compat

  timestamp_ms: 1740483927341,
  session_elapsed_ms: 47341,

  event_type: "pointerdown",            // or keydown, input, view:content_render, custom:round_solved, etc.
  event_target: "option-b",             // data-signal-id > id > tag.class
  target_context: {
    text_content: "63",                 // visible text (max 100 chars)
    data_attrs: { value: "63" }         // data-* attributes
  },
  event_data: { x, y, pointer_type, pressure, button, scroll_x, scroll_y },

  view_context: {                       // last recordViewEvent snapshot
    screen: "gameplay",
    content_snapshot: { question_text: "...", round: 2 },
    components: { timer: { value: 42, state: "running" } },
    timestamp_ms: 1740483925000
  },
  device_context: {
    device_type: "mobile",
    is_mobile: true,
    screen_size: "390x844",
    input_method: "touch",
    orientation: "portrait",
    pixel_ratio: 3,
    touch_points: 5,
    platform: "iPhone"
  }
}
```

**Wire compat note:** The field is `template_id` in the event record (not `game_id`) for backward compatibility with existing data pipelines. The constructor accepts `gameId` (preferred) or `templateId`.

---

## T1 Validation Rules

These are enforced by `lib/validate-static.js` during the build pipeline:

| Rule                   | What it checks                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **GEN-UX-005**         | SignalCollector instantiated with `{ sessionId, studentId, gameId, contentSetId }` — not empty                           |
| **GEN-PM-READY**       | `game_ready` postMessage sent after initialization                                                                       |
| **GEN-PM-001**         | `game_complete` postMessage with exact type string and nested data                                                       |
| **GEN-PM-DUAL-PATH**   | `game_complete` fires on both victory and game-over paths                                                                |
| **Signal API**         | Only v3 methods used: `recordViewEvent`, `recordCustomEvent`, `seal`, `pause`, `resume`, `startFlushing`, `stopFlushing` |
| **Forbidden patterns** | `new SignalCollector()` with no args is a T1 failure                                                                     |

---

## MCP Tools for Signal Analysis

Two MCP tools in `lib/mcp.js` consume signal data from GCS for session analysis.

### `query_game_sessions`

Query game session submissions from claude-core. Returns session data with game metadata and content set details.

| Param        | Type   | Required | Description                         |
| ------------ | ------ | -------- | ----------------------------------- |
| `game_id`    | string | Yes      | Game ID to filter by                |
| `session_id` | string | No       | Narrow to specific session          |
| `user_id`    | string | No       | Narrow to specific student          |
| `limit`      | number | No       | Max results (default: 50, max: 200) |

**Internal API calls:**

- `GET /api/sessions?game_id=...` — fetch session records
- `GET /api/games/{game_id}` — fetch game metadata
- `GET /api/content-sets/{id}` — fetch content set details (for each unique contentSetId in sessions)

**Returns:** `{ game, contentSets, sessions, sessionCount }`

**Example prompts:**

- "Show me all sessions for the doubles game"
- "How did student stu_abc perform in their last 10 sessions of doubles?"
- "Find session ses_xyz for game doubles — what content set was used?"

### `generate_replay_summary`

Fetch all raw signal event batches and game HTML for a session. Returns a merged events timeline so you can narrate what the student did step-by-step.

| Param        | Type   | Required | Description                     |
| ------------ | ------ | -------- | ------------------------------- |
| `game_id`    | string | Yes      | Game ID (e.g. "doubles")        |
| `session_id` | string | Yes      | Session ID from SignalCollector |
| `user_id`    | string | Yes      | Student/user ID                 |

**How it works:**

1. Lists all files in GCS at `signal-events/{user_id}/{session_id}/{game_id}/`
2. Finds the latest `play_id` by most recent file update time
3. Downloads all batch JSON files for that play
4. Sorts by `batch_number`, merges all events into a single timeline
5. Fetches game metadata via `/api/games/{game_id}`
6. Fetches game HTML from the game URL (if available)

**GCS bucket:** `test-dynamic-assets`

**Returns:** `{ signal_events: { total_events, total_batches, play_id, events }, game, game_html }`

The response includes OUTPUT_INSTRUCTIONS that guide rendering a visual widget with:

- Session summary stat cards
- Per-round cards with pair chips and observations
- Interaction timeline with timestamped events
- Behavioural observations

**Example prompts:**

- "Replay what student stu_abc did in session ses_xyz of the doubles game"
- "Generate a step-by-step narration of this doubles session: game_id=doubles, session_id=ses_xyz, user_id=stu_abc"
- "Show me a visual timeline of how the student played through this session"

---

## File Reference

| File                                                                | Purpose                                           |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `warehouse/packages/helpers/signal-collector/index.js`              | Source of truth — v3.0.0 implementation           |
| `warehouse/packages/helpers/signal-collector/usage.html`            | Interactive demo                                  |
| `warehouse/mathai-game-builder/components/signal-collector.md`      | API reference for game generation                 |
| `warehouse/mathai-game-builder/examples/signal-capture-patterns.md` | Copy-paste integration patterns                   |
| `warehouse/mathai-game-builder/examples/QUICK-REFERENCE.md`         | Quick reference for generation                    |
| `warehouse/parts/PART-004-initialization.md`                        | Game init sequence                                |
| `warehouse/parts/PART-010-event-tracking.md`                        | Signal recording patterns                         |
| `warehouse/parts/PART-011-end-game.md`                              | Seal + game_complete flow                         |
| `warehouse/parts/PART-012-debug.md`                                 | Debug helper integration                          |
| `warehouse/verification-checklist.md`                               | Build verification items                          |
| `warehouse/contracts/postmessage-in.schema.json`                    | game_init schema                                  |
| `warehouse/contracts/postmessage-out.schema.json`                   | game_complete schema                              |
| `lib/validate-static.js`                                            | T1 validation rules                               |
| `lib/prompts.js`                                                    | CDN constraints + signal API rules for generation |
