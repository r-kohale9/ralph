# SignalCollector API

Production API reference for SignalCollector v3.0.0 — raw input event capture for MathAI games.

## CDN Loading

SignalCollector loads automatically with the Helpers package. No extra script tag needed. Add it to `waitForPackages()`:

```javascript
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof TimerComponent === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof VisibilityTracker === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof SignalCollector === 'undefined') await new Promise(r => setTimeout(r, 50));
  console.log('All packages loaded');
}
```

## Constructor

```javascript
const signalCollector = new SignalCollector({
  sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
  studentId: window.gameVariableState?.studentId || null,
  gameId: gameState.gameId || null,
  contentSetId: gameState.contentSetId || null
});
window.signalCollector = signalCollector;
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionId` | string | `null` | Session identifier |
| `studentId` | string | `null` | Student identifier |
| `gameId` | string | `null` | Game identifier. Also accepts `templateId` for backward compat. Wire format uses `template_id`. |
| `contentSetId` | string | `null` | Content set identifier |
| `containerSelector` | string | `'body'` | CSS selector for event delegation target |
| `flushUrl` | string | `null` | Cloud function URL for batch uploads. Set from `signalConfig.flushUrl` in game_init. |
| `playId` | string | `null` | UUID for this game play session. Set from `signalConfig.playId` in game_init. |
| `flushIntervalMs` | number | `5000` | Milliseconds between batch flushes. Do not change. |

## Active Methods

### `recordViewEvent(viewType, viewData)`

Record a visual state change. **Call every time a DOM modification changes visible content.**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewType` | string | One of 6 types (see table below) |
| `viewData.screen` | string | Current visible screen: `'ready'`, `'gameplay'`, `'transition'`, `'results'`, `'complete'` |
| `viewData.content_snapshot` | object | What content is currently displayed (game-specific) |
| `viewData.components` | object | State of UI components: `{ timer: { value, state }, progress: { current, total }, lives }` |
| `viewData.metadata` | object | Additional context: `{ trigger: 'user_action' | 'timer_reshuffle' | 'round_start', transition_from }` |

**Effect:** After calling `recordViewEvent`, all subsequent auto-captured input events include a `view_context` field with the last recorded view state. Every click/tap/key knows what screen and content was visible.

### `recordCustomEvent(type, data)`

Record game-specific events not captured by automatic listeners.

```javascript
signalCollector.recordCustomEvent('round_solved', { round: 3, correct: true, time_ms: 4200 });
signalCollector.recordCustomEvent('hint_requested', { round: 3, hint_type: 'visual' });
```

### `reset()`

Reset the collector for a new play session (e.g. "Try Again"). Flushes buffered events via sendBeacon, clears the buffer, and continues with the same listeners, identity, and batch numbering. Use instead of `seal()` + `new SignalCollector()` when the iframe stays alive.

### `seal()` -> `{ event_count, metadata }`

Finalize the collector at game end. Fires `sendBeacon` immediately (survives iframe destruction), then attempts `fetch` with retry as bonus path. Detaches all DOM listeners. Returns synchronously. Idempotent — second call is a no-op. **Only use when the iframe is about to be destroyed — not for restart.**

### `startFlushing()` / `stopFlushing()`

Start/stop periodic batch upload (every 5s). Requires `flushUrl` to be set. `startFlushing()` is safe to call multiple times — only one interval is ever active. `stopFlushing()` is called automatically by `seal()`.

### `pause()` / `resume()`

Pause/resume signal collection mid-game. Use with VisibilityTracker for tab switches.

### `getInputEvents()` -> `Array`

Returns copy of the raw input events buffer.

### `getMetadata()` -> `Object`

Returns collection metadata: version, counts, device context, identifiers.

### `getCurrentView()` -> `Object|null`

Returns the current view state (last set by `recordViewEvent`), or null if never called.

### `debug()` -> `Object`

Log and return full debug summary of current state.

---

## View Event Types

| viewType | When to emit | Key data |
|----------|-------------|----------|
| `screen_transition` | Screen swap (ready -> gameplay -> results) | `screen`, `metadata.transition_from` |
| `content_render` | Content displayed — round start, timer reshuffle, auto-advance | `content_snapshot`, `metadata.trigger` |
| `feedback_display` | Correct/incorrect feedback shown | `content_snapshot.feedback_type`, `message` |
| `component_state` | Timer/progress/scaffold state change | `components.timer`, `components.progress` |
| `overlay_toggle` | Modal/transition screen show/hide | `content_snapshot.overlay`, `visible` |
| `visual_update` | Cell selection, number entry, option highlight, grid mutation, drag state | `content_snapshot.type` + game-specific |

## Custom Event Types (Standard)

| Type | When to emit | Data fields |
|------|-------------|-------------|
| `round_solved` | After answer handler processes result | `round`, `correct`, `answer`, `correct_answer` |
| `hint_requested` | Student taps hint button | `round`, `hint_type`, `hint_number` |
| `visibility_hidden` | Tab switch / screen lock | `{}` |
| `visibility_visible` | Tab returns | `{}` |
| `scaffold_opened` | Student opens scaffold UI | `scaffold`, `round` |

---

## data-signal-id Rules

Add `data-signal-id` to all interactive elements for clear identification in signal events.

**Target identification priority:**
1. `data-signal-id` attribute (explicit, game-defined) — use for important elements
2. `id` attribute
3. `tag.className` (first 2 classes)
4. Tag name fallback

```html
<div class="game-play-area">
  <div data-signal-id="question-text" class="question">What is 38 + 25?</div>
  <button data-signal-id="option-a" class="option">53</button>
  <button data-signal-id="option-b" class="option">63</button>
  <input data-signal-id="answer-input" type="text" inputmode="numeric">
  <button data-signal-id="submit-button" class="submit-btn">Submit</button>
  <button data-signal-id="hint-button" class="hint-btn">Hint</button>
</div>
```

---

## Backward Compatibility Stubs (No-ops)

These methods exist for backward compatibility with older game HTML. They do nothing and are safe to call:

`startProblem()`, `endProblem()`, `updateCurrentAnswer()`, `markReviewing()`, `recordScratchWork()`, `recordScratchErasure()`, `recordScaffoldUse()`, `requestHelp()`, `getProblemSignals()`, `getAllProblemSignals()`

---

## Automatic Event Capture

SignalCollector automatically captures these events with no code needed:

- **Pointer:** `pointerdown`, `pointerup`, `pointermove` (throttled 500ms)
- **Touch:** `touchstart`, `touchmove`, `touchend`, `touchcancel`
- **Keyboard:** `keydown`, `keyup`
- **Form:** `input`, `change`, `focus`, `blur`
- **Drag/drop:** `dragstart`, `dragend`, `drop`

All listeners use `{ passive: true }` — zero impact on scrolling/interactions.

## Input Event Schema (Wire Format)

Each captured event includes:

```javascript
{
  event_id: "uuid-v4",
  student_id: "stu_456",
  session_id: "ses_123",
  template_id: "game_789",            // wire name for backward compat (not gameId)

  timestamp_ms: 1740483927341,
  session_elapsed_ms: 47341,

  event_type: "pointerdown",          // or keydown, input, view:*, custom:*
  event_target: "option-b",           // from data-signal-id > id > tag.class
  target_context: {
    text_content: "63",               // visible text (max 100 chars)
    data_attrs: { value: "63" }       // data-* attributes
  },
  event_data: { ... },               // type-specific (coordinates, key codes, etc.)

  view_context: {                     // last recordViewEvent snapshot
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
