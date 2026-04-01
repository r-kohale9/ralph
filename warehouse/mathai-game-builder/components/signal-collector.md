# SignalCollector v3

Raw input event capture for MathAI games. Captures every atomic user interaction (clicks, taps, touch gestures, drags, keystrokes) and flushes batches to GCS reliably — including on mobile and in iframes.

**Package Type:** CDN package (loaded via Helpers)
**Global:** `window.SignalCollector`
**Auto-loaded:** Yes — included in the Helpers package. No extra script tag needed.

## Loading

SignalCollector loads automatically with the Helpers package. Add it to `waitForPackages()`:

```javascript
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof TimerComponent === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof VisibilityTracker === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof SignalCollector === 'undefined') await new Promise(r => setTimeout(r, 50));
  console.log('All packages loaded');
}
```

## Initialization

Initialize after `waitForPackages()`, before game starts:

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  const signalCollector = new SignalCollector({
    sessionId: gameState.sessionId,
    studentId: gameState.studentId,
    gameId: gameState.gameId,
    contentSetId: gameState.contentSetId
  });
  window.signalCollector = signalCollector;
  // Flushing starts when game_init arrives with signalConfig.flushUrl
});
```

### Receiving signal config from harness

The parent harness sends a `game_init` postMessage that includes `signalConfig` with the cloud function URL, identity overrides (`gameId`, `sessionId`, `contentSetId`, `studentId`), and play metadata. Handle it in your postMessage listener:

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};

  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }
}
```

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerSelector` | string | `'body'` | CSS selector for event delegation target |
| `sessionId` | string | `null` | Session identifier |
| `studentId` | string | `null` | Student identifier |
| `gameId` | string | `null` | Game identifier. Also accepts `templateId` for backward compatibility. Used in GCS batch path and event `template_id` field. |
| `flushUrl` | string | `null` | Cloud function URL for batch uploads. If null, flushing is disabled. Typically set from `signalConfig.flushUrl`. |
| `playId` | string | `null` | UUID for this game play session. Used in GCS path + server deduplication. |
| `contentSetId` | string | `null` | Content set identifier. Used in GCS batch path. |

## Methods

### Custom Events

#### `recordCustomEvent(type, data)`

Record game-specific events not captured by automatic listeners.

```javascript
signalCollector.recordCustomEvent('hint_requested', { hint_number: 1 });
signalCollector.recordCustomEvent('scaffold_opened', { scaffold: 'number_line' });
```

### View Events

**MANDATORY RULE: Every function that modifies the DOM in a way that changes what is visible on screen must call `recordViewEvent()`.** This includes showing/hiding elements, updating text content, swapping screens, rendering new questions, highlighting cells, displaying feedback, and any timer-driven content swap.

#### `recordViewEvent(viewType, viewData)`

Record a visual state change. Call this every time a DOM modification changes visible content on screen.

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewType` | string | `'screen_transition'`, `'content_render'`, `'feedback_display'`, `'component_state'`, `'overlay_toggle'`, `'visual_update'` |
| `viewData.screen` | string | Current visible screen: `'ready'`, `'gameplay'`, `'transition'`, `'results'`, `'complete'` |
| `viewData.content_snapshot` | object | What content is currently displayed (game-specific) |
| `viewData.components` | object | State of UI components: `{ timer: { value, state }, progress: { current, total }, lives }` |
| `viewData.metadata` | object | Additional context: `{ trigger: 'user_action' \| 'timer_reshuffle' \| 'round_start', transition_from }` |

**View Event Types:**

| viewType | When to emit | Key data |
|---|---|---|
| `screen_transition` | Screen swap (ready→gameplay→results) | `screen`, `metadata.transition_from` |
| `content_render` | Content displayed — round start, timer reshuffle, auto-advance | `content_snapshot`, `metadata.trigger` |
| `feedback_display` | Correct/incorrect feedback shown | `content_snapshot.feedback_type`, `message` |
| `component_state` | Timer/progress/scaffold state change | `components.timer`, `components.progress` |
| `overlay_toggle` | Modal/transition screen show/hide | `content_snapshot.overlay`, `visible` |
| `visual_update` | Every game-specific visual change: cell selection, number entry, option highlight, grid mutation, drag state | `content_snapshot.type` + game-specific |

```javascript
// Screen transition
signalCollector.recordViewEvent('screen_transition', {
  screen: 'gameplay',
  metadata: { transition_from: 'ready' }
});

// Content render (with trigger for auto-changing games)
signalCollector.recordViewEvent('content_render', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'grid_generated',
    grid_index: 3,
    pairs_visible: ['3+7', '2+5', '8+1'],
    trigger: 'timer_reshuffle'
  },
  components: { timer: { value: 45, state: 'running' } }
});

// Visual update (cell selection, number entry, etc.)
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'cell_selected',
    selected_cell: { row: 1, col: 2 },
    user_values: { '1-1': 1 },
    cells_filled: 1
  }
});

// Feedback display
signalCollector.recordViewEvent('feedback_display', {
  screen: 'gameplay',
  content_snapshot: {
    feedback_type: 'correct',
    message: 'Great job!',
    audio_id: 'correct'
  }
});
```

**Effect on input events:** After calling `recordViewEvent`, all subsequent input events automatically include a `view_context` field with the last recorded view state. Every click/tap/key knows what screen and content was visible when it happened.

#### `getCurrentView()` → `Object|null`

Returns the current view state (last set by `recordViewEvent`), or null if never called.

### Data Access

#### `getInputEvents()` → `Array`

Returns copy of the raw input events buffer.

#### `getMetadata()` → `Object`

Returns collection metadata: version, counts, device context, identifiers.

### Batch Flushing

Events accumulate in memory and are uploaded in batches of up to 200 events (~120KB). On success, uploaded events are spliced from memory. On failure, events are retained and retried (up to 3 retries with exponential backoff). After a successful batch, remaining backlog is drained immediately without waiting for the next interval.

**GCS path per batch:** `signal-events/{studentId}/{sessionId}/{gameId}/{contentSetId}/{playId}/batch-{N}.json`

#### `startFlushing()`

Start periodic batch upload every 5s. Requires `flushUrl` to be set. Safe to call multiple times — only one interval is ever active.

```javascript
signalCollector.startFlushing();
```

#### `stopFlushing()`

Stop periodic flushing. Called automatically by `seal()`.

### Lifecycle

#### `seal()` → `{ event_count, metadata }`

Finalize the collector at game end.

**Synchronous-first design** — critical for iframe deployment where the parent may destroy the iframe immediately:

1. Stops the flush interval
2. **Immediately** calls `sendBeacon()` in 50-event chunks (~30KB each) — survives iframe destruction
3. Sends `postMessage` to parent for any `sendBeacon` chunk that was rejected
4. Also attempts `fetch` with 3 retries in background (bonus path if iframe survives)
5. Detaches all listeners
6. Returns synchronously: `{ event_count, metadata }`

Idempotent — second call is a no-op.

```javascript
const result = signalCollector.seal();
window.parent.postMessage({ type: 'game_complete', data: result }, '*');
```

**Unload safety (registered automatically in constructor):**
- `pagehide` → sendBeacon all buffered events (fires on iframe removal, tab close, navigation — primary mobile signal)
- `beforeunload` → sendBeacon all buffered events (desktop fallback)
- `visibilitychange` → fetch-based flush when page is hidden (tab switch, window minimize)

These run automatically even if `seal()` was never called (e.g., game crash, parent destroys iframe without calling seal).

#### `pause()` / `resume()`

Pause/resume signal collection mid-game (use with VisibilityTracker for tab switches).

#### `debug()` → `Object`

Log and return debug summary of current state.

### Backward Compatibility Stubs

These methods are retained as empty no-ops for backward compatibility with older game HTML. They do nothing and are safe to call:

- `startProblem()` — no-op
- `endProblem()` — returns `null`
- `updateCurrentAnswer()` — no-op
- `markReviewing()` — no-op
- `recordScratchWork()` — no-op
- `recordScratchErasure()` — no-op
- `recordScaffoldUse()` — no-op
- `requestHelp()` — no-op
- `getProblemSignals()` — returns `null`
- `getAllProblemSignals()` — returns `{}`

## Input Event Schema

Each captured event:

```javascript
{
  // Identity
  event_id: "uuid-v4",
  student_id: "stu_456",
  session_id: "ses_123",
  template_id: "game_1234567890_abc",

  // Timing
  timestamp_ms: 1740483927341,
  session_elapsed_ms: 47341,

  // The Event
  event_type: "pointerdown",          // pointerdown, pointerup, pointermove, keydown, keyup,
                                      // input, change, focus, blur, dragstart, dragend, drop,
                                      // touchstart, touchmove, touchend, touchcancel,
                                      // custom:*, view:*
  event_target: "option-b",           // from data-signal-id, id, or className
  target_context: {
    text_content: "63",               // visible text of clicked element (max 100 chars)
    data_attrs: { value: "63" }       // data-* attributes (excluding data-signal-id)
  },
  event_data: { ... },               // type-specific (see below)

  // Context
  view_context: {
    screen: "gameplay",
    content_snapshot: { type: "grid_generated", grid_index: 2 },
    components: { timer: { value: 42, state: "running" } },
    timestamp_ms: 1740483925000
  },
  device_context: {
    device_type: "mobile",            // "mobile", "tablet", or "desktop"
    is_mobile: true,
    screen_size: "390x844",
    input_method: "touch",
    orientation: "portrait",
    pixel_ratio: 3,
    touch_points: 5,
    platform: "iPhone"               // from navigator.userAgentData.platform
  }
}
```

**Event Data by Type:**

```javascript
// Pointer events (pointerdown, pointerup, pointermove)
event_data: { x, y, pointer_type, pressure, button, scroll_x, scroll_y }

// Touch events (touchstart, touchmove, touchend, touchcancel)
event_data: {
  touches_count: 2,                  // total touches currently on screen
  changed_touches: [                 // touches that changed in this event
    { x: 150, y: 300, id: 0 },
    { x: 280, y: 350, id: 1 }
  ],
  target_touches_count: 1           // touches on this specific target
}

// Keyboard events (keydown, keyup)
event_data: { key, key_code, is_modifier, is_input_field, is_delete }

// Input/change events
event_data: { value, value_length, input_type }

// Drag events (dragstart, dragend, drop)
event_data: { x, y }

// Focus/blur
event_data: {}
```

**Target Identification Priority:**
1. `data-signal-id` attribute (explicit, game-defined) — use this for important elements
2. `id` attribute
3. `tag.className` (first 2 classes)
4. Tag name fallback

## Integration with VisibilityTracker

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    signalCollector.pause();
    signalCollector.recordCustomEvent('visibility_hidden', {});
  },
  onResume: () => {
    signalCollector.resume();
    signalCollector.recordCustomEvent('visibility_visible', {});
  }
});
```

## Integration with game_complete

```javascript
const result = signalCollector.seal();

window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: gameMetrics,
    attempts: attemptHistory,
    signal_event_count: result.event_count,
    signal_metadata: result.metadata
  }
}, '*');
```

## Performance Notes

- All listeners are `{ passive: true }` — zero impact on scrolling/interactions
- `pointermove` and `touchmove` throttled to 500ms intervals
- Events spliced from memory after confirmed upload — no unbounded growth
- Emergency cap: drops oldest events if buffer exceeds 10,000 (network failure scenario)
- Single `setInterval` — no duplicate flush timers
- Event delegation — single listener per event type on container

## Error Tracking (Sentry)

SignalCollector auto-bootstraps Sentry if not already loaded. No manual Sentry setup needed.

**Bootstrap behavior:**
1. If `window.Sentry` exists and is initialized → reuses it, sets tags
2. If `window.Sentry` exists but not initialized → initializes with `SentryConfig` or hardcoded DSN
3. If `window.Sentry` does not exist → dynamically loads Sentry SDK from CDN, then initializes

**What gets reported to Sentry:**

| Event | Level | Trigger |
|-------|-------|---------|
| Flush failed after 3 retries | error | Network failure, server error |
| sendBeacon rejected | warning | Browser quota exceeded |
| sendBeacon + postMessage both failed | error | Data may be lost |
| Emergency cap hit (10,000 events) | warning | Prolonged network failure (once per session) |
| No container found | warning | Bad `containerSelector` |

**Breadcrumbs** (attached to Sentry events for context):
- `flush_started` — when `startFlushing()` is called
- `flush_success` — after each successful batch upload
- `seal` — when `seal()` is called

**Scope tags** (set once): `signal_collector_version`, `game_id`, `play_id`

**Respects `SentryConfig.enabled`** — if `SentryConfig` package sets `enabled: false`, all events are dropped via `beforeSend`.

## Best Practices

1. **Add `data-signal-id` to important elements** — options, inputs, buttons, scaffolds
2. **Call `recordViewEvent()` for every visible DOM change** — powers narration and replay
3. **Set `flushUrl`, `gameId`, `sessionId`, `contentSetId`, `studentId` from `signalConfig` in `game_init`** — harness provides runtime overrides
4. **Call `seal()` at game end** — triggers synchronous sendBeacon before iframe may be destroyed
5. **Integrate with VisibilityTracker** — pause/resume on tab switch
