# SignalCollector

Raw input event capture and problem-level signal computation for MathAI games.

**Package Type:** CDN package (loaded via Helpers)
**Global:** `window.SignalCollector`
**Auto-loaded:** Yes — included in the Helpers package. No extra script tag needed.

## Overview

SignalCollector captures every atomic user interaction (clicks, taps, drags, keystrokes) and computes problem-level signals across three tiers:

- **Tier 2 (Process):** How the student solved it — timing, interaction sequence, self-corrections
- **Tier 3 (Engagement):** How engaged they were — hesitations, frustration, flow
- **Tier 4 (Context):** What surrounded it — position in session, time of day, error streaks

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
    templateId: gameState.gameId,
    gameId: gameState.gameId,
    contentSetId: gameState.contentSetId
  });
  window.signalCollector = signalCollector;
  // Flushing starts when game_init arrives with signalConfig.flushUrl
});
```

### Receiving signal config from harness

The parent harness sends a `game_init` postMessage that includes `signalConfig` with the cloud function URL and metadata. Handle it in your postMessage listener:

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};

  // Configure SignalCollector with harness-provided metadata
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }
}
```

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerSelector` | string | `'body'` | CSS selector for event delegation target. Default `body` captures all events including transition screens and overlays. |
| `maxBufferSize` | number | `5000` | Max events in ring buffer |
| `throttleMs` | number | `500` | **Hardcoded** — throttle interval for pointermove is always 500ms. This option is ignored. |
| `sessionId` | string | `null` | Session identifier |
| `studentId` | string | `null` | Student identifier |
| `templateId` | string | `null` | Game template identifier (e.g., gameId) |
| `hesitationThresholdMs` | number | `3000` | Pause duration to count as hesitation |
| `frustrationClickMs` | number | `1000` | Time window for detecting rapid clicks |
| `frustrationClickCount` | number | `3` | Clicks in window to flag frustration |
| `flushIntervalMs` | number | `5000` | **Hardcoded** — flush interval is always 5000ms. This option is ignored. |
| `flushUrl` | string | `null` | Cloud function URL for batch uploads. If null, flushing is disabled. Typically set from `signalConfig.flushUrl` received via `game_init`. |
| `playId` | string | `null` | UUID for this game play session. Set from `signalConfig.playId`. |
| `gameId` | string | `null` | Game identifier. Used in GCS batch path. |
| `contentSetId` | string | `null` | Content set identifier. Used in GCS batch path. |

## Methods

### Problem Lifecycle

#### `startProblem(problemId, problemData)`

Call when a new question/round begins. Starts tracking input events for this problem.

```javascript
signalCollector.startProblem('round_1', {
  text: '38 + 25',
  correct_answer: 63,
  difficulty: 0.35
});
```

#### `endProblem(problemId, outcome)` → `signals`

Call after validation completes. Computes and returns Tier 2-4 signals.

```javascript
const signals = signalCollector.endProblem('round_1', {
  correct: true,
  answer: 63
});
// signals = { time_to_first_interaction_ms, phase_times, ... }
```

#### `updateCurrentAnswer(answer)`

Update the current answer state for the active problem. Use for multi-input games (e.g., Kakuro grid, drag-and-drop matching) where the answer is not a single input field value.

```javascript
// Single-input games: current_answer is auto-captured from input element value
// Multi-input games: call this after each user change
gameState.userValues[cellKey] = value;
signalCollector.updateCurrentAnswer(gameState.userValues);
// e.g., {"1-1": 3, "1-2": 7, "2-1": 1} — student's work in progress, NOT the correct answer
```

**Note:** `current_answer` tracks the student's live work-in-progress, not the correct answer. The correct answer is separate — pass it via `startProblem(problemData)` and `endProblem(outcome)`.

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

**Trigger field values:**
- `'round_start'` — initial content render at round/problem start
- `'user_action'` — content changed because user did something
- `'timer_reshuffle'` — content changed by game timer (no user action)

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

**Effect on input events:** After calling `recordViewEvent`, all subsequent input events automatically include a `view_context` field with the last recorded view state. This means every click/tap/key knows what screen and content was visible when it happened.

#### `getCurrentView()` → `Object|null`

Returns the current view state (last set by `recordViewEvent`), or null if never called.

### Data Access

#### `getInputEvents()` → `Array`

Returns copy of the raw input events buffer.

#### `getProblemSignals(problemId)` → `Object|null`

Returns computed Tier 2-4 signals for a specific completed problem.

#### `getAllProblemSignals()` → `Object`

Returns map of all completed problem signals: `{ problemId: signals, ... }`

#### `getMetadata()` → `Object`

Returns collection metadata: version, counts, truncation flag, device context.

### Batch Flushing

#### `startFlushing()`

Start periodic batch-streaming of new events directly to the cloud function via `fetch()`. Events accumulated since the last flush are sent every `flushIntervalMs` (default 5s). Requires `flushUrl` to be set (no-op otherwise). Each batch is written to GCS at `signal-events/{studentId}/{sessionId}/{gameId}/{contentSetId}/{playId}/batch-{N}.json`.

```javascript
signalCollector.startFlushing();
```

#### `stopFlushing()`

Stop periodic flushing. Called automatically by `seal()`.

```javascript
signalCollector.stopFlushing();
```

**Note:** `seal()` automatically performs a final flush and stops the timer, so you don't need to call `stopFlushing()` manually before `seal()`.

### Lifecycle

#### `seal()` → `{ events, signals, metadata }`

Finalize the collector at game end. Performs a **final flush** of any remaining events, stops the flush timer, detaches listeners, computes final signals, returns the complete payload. **Idempotent** — calling again returns the cached payload. Data stays readable after seal; all write methods warn and no-op.

```javascript
const payload = signalCollector.seal();
window.parent.postMessage({ type: 'game_complete', data: { ...payload } }, '*');
```

#### `pause()` / `resume()`

Pause/resume signal collection mid-game (use with VisibilityTracker for tab switches).

#### `debug()` → `Object`

Log and return debug summary of current state.

## Input Event Schema

Each captured event:

```javascript
{
  // Identity
  event_id: "uuid-v4",
  student_id: "stu_456",
  session_id: "ses_123",
  problem_id: "round_1",
  template_id: "game_1234567890_abc",

  // Timing
  timestamp_ms: 1740483927341,
  session_elapsed_ms: 47341,
  problem_elapsed_ms: 3841,

  // The Event
  event_type: "pointerdown",          // pointerdown, pointerup, pointermove, keydown, keyup, input, change, focus, blur, dragstart, dragend, drop, custom:*, view:*
  event_target: "option-b",           // from data-signal-id, id, or className (string)
  target_context: {                   // enriched context for narration (null if no text/data)
    text_content: "63",               // visible text of clicked element (max 100 chars)
    data_attrs: { value: "63" }       // data-* attributes (excluding data-signal-id)
  },
  event_data: {                       // type-specific (see Event Data by Type below)
    x: 340, y: 120,
    pointer_type: "touch",
    pressure: 0.5,
    button: 0,
    scroll_x: 0,
    scroll_y: 120
  },

  // Context
  problem_state: {
    state: "working",                  // reading, working, submitted, idle
    problem_text: "38 + 25",
    current_answer: "6",               // live student answer (from input value or updateCurrentAnswer())
    scaffolds_visible: [],
    difficulty_params: 0.35
  },
  view_context: {                      // last recorded visual state (set by recordViewEvent, null until first call)
    screen: "gameplay",
    content_snapshot: { type: "grid_generated", grid_index: 2, pairs_visible: ["3+7", "2+5"] },
    components: { timer: { value: 42, state: "running" } },
    timestamp_ms: 1740483925000        // when view was last set
  },
  device_context: {
    device_type: "tablet",             // "tablet" or "desktop"
    screen_size: "1024x768",
    input_method: "touch",             // "touch" or "mouse"
    orientation: "landscape",          // "landscape" or "portrait"
    pixel_ratio: 2
  }
}
```

**Event Data by Type:**

```javascript
// Pointer events (pointerdown, pointerup, pointermove)
event_data: {
  x: 340, y: 120,              // click/tap coordinates
  pointer_type: "touch",        // "mouse", "touch", "pen"
  pressure: 0.5,
  button: 0,
  scroll_x: 0, scroll_y: 120   // viewport scroll position at event time
}

// Keyboard events (keydown, keyup)
event_data: {
  key: "3",                     // actual key pressed (e.g., "3", "Backspace", "Enter")
  key_code: "Digit3",           // key code
  is_modifier: false,
  is_input_field: true,
  is_delete: false
}

// Input/change events (input, change)
event_data: {
  value: "63",                  // actual current value of the input
  value_length: 2,
  input_type: "text"
}

// Drag events (dragstart, dragend, drop)
event_data: { x: 340, y: 120 }

// Focus/blur events
event_data: {}
```

**`current_answer` behavior:**
- **Single-input games:** Auto-captured from the target element's `.value` when interacting with an input/textarea
- **Multi-input games:** Use `updateCurrentAnswer()` to push the full answer state (e.g., grid values object)
- Tracks student's **work in progress**, not the correct answer
```

**Target Identification Priority:**
1. `data-signal-id` attribute (explicit, game-defined) — use this for important elements
2. `id` attribute
3. `tag.className` (first 2 classes)
4. Tag name fallback

## Problem Signal Schema (Tier 2-4)

Returned by `endProblem()` and available in `seal().signals[problemId]`:

```javascript
{
  // Identity
  problem_event_id: "uuid-v4",
  student_id: "stu_456",
  session_id: "ses_123",
  problem_id: "round_1",

  // The Problem (pass-through from startProblem's problemData)
  problem_definition: {
    text: "38 + 25",
    correct_answer: 63,
    concept_target: "compensation_strategy",
    difficulty_params: { adjustment_size: 2, sum_range: "50-75" },
    misconception_targets: ["M1", "M3"],
    representation: "numerical_with_scratch"
  },

  // Tier 1: Response — WHAT the student did
  response: {
    final_answer: 63,
    is_correct: true,
    answer_history: ["65", "63"],
    answer_change_count: 1,
    submitted_or_timed_out: "submitted"
  },

  // Tier 2: Process — HOW they solved it
  process: {
    time_to_first_interaction_ms: 2800,
    total_response_time_ms: 14200,
    time_at_each_phase: {
      reading: 2800,
      working: 9400,
      reviewing: 2000
    },
    scratch_work: {
      entries: ["40", "65", "63"],
      entry_timestamps_ms: [4200, 8100, 12800],
      erasures: [],
      spatial_layout: [{ value: "40", position: { x: 150, y: 200 } }]
    },
    scaffold_interactions: {
      available: ["number_line", "hint"],
      used: ["number_line"],
      time_of_use: [5200],
      help_requested: false
    },
    interaction_sequence: [
      { action: "click", value: "option-c", time_ms: 2800 },
      { action: "click", value: "option-b", time_ms: 7800 }
    ],
    self_corrections: [
      { before: "65", after: "63", change_index: 1 }
    ]
  },

  // Tier 3: Engagement — HOW engaged they were
  engagement: {
    hesitation_points: [
      { phase: "working", duration_ms: 5000, after_action: "click:option-c" }
    ],
    interaction_velocity: {
      mean_time_between_actions_ms: 2850,
      variance_ms: 120000,
      trend: "stable"
    },
    frustration_indicators: {
      rapid_repeated_clicks: 0,
      delete_cycles: 0,
      long_pauses: 1
    },
    flow_indicators: {
      response_time_relative_to_baseline: 1.05,
      accuracy_trend_last_5: [1, 1, 0, 1, 1],
      voluntary_continuation: null
    }
  },

  // Tier 4: Context — WHAT surrounded it
  context: {
    problem_position_in_session: 3,
    problems_since_last_error: 2,
    problems_since_last_scaffold: 1,
    current_difficulty_level: 0.35,
    session_time_elapsed_ms: 47341,
    time_of_day: "14:30",
    day_of_week: "Tuesday"
  }
}
```

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

## Integration with game flow

Call `endProblem()` after validation, but do **not** merge signals into attempt_history — they are kept separate:

```javascript
function completeRound(isCorrect) {
  // End signal collection (signals stored internally, not in attempt_history)
  signalCollector.endProblem('round_' + currentRound, {
    correct: isCorrect,
    answer: userAnswer
  });

  // Build attempt entry WITHOUT signals
  attemptHistory.push({
    attempt_number: currentRound,
    // ... existing fields ...
    metadata: {
      // ... existing metadata (no signals here) ...
    }
  });
}
```

## Integration with game_complete

Use `seal()` to finalize and include signal data in the submission payload:

```javascript
const payload = signalCollector.seal();

window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: gameMetrics,
    attempts: attemptHistory,
    ...payload  // { events, signals, metadata }
  }
}, '*');
```

After seal, data stays readable for console inspection on the game complete screen.

## Performance Notes

- All listeners are `{ passive: true }` — zero impact on scrolling/interactions
- `pointermove` throttled to 100ms intervals
- Ring buffer caps memory at ~500KB (5000 events x ~100 bytes)
- Event delegation — single listener per event type on container
- No `JSON.stringify` on hot path
- Keyboard capture records actual key + key code (enables replay and LLM narration)

## Best Practices

1. **Add `data-signal-id` to important elements** — options, inputs, buttons, scaffolds
2. **Call `startProblem` before rendering each question** — captures reading time
3. **Call `endProblem` after validation** — computes accurate phase timing
4. **Integrate with VisibilityTracker** — pause/resume on tab switch
5. **Initialize after `waitForPackages()`** — SignalCollector class must be loaded first
