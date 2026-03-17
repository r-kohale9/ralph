# API Helper

## Overview

The API Helper provides a simple interface for communicating with the MathAI Core API. It submits completed game sessions, handles request timeouts, and allows runtime configuration of the endpoint and headers.

**Location:** `/assets/game-template/helpers/api-helper.js`

## Purpose

- Submit game results to backend
- Fetch student data
- Handle API errors gracefully
- Provide configurable endpoint settings

## Methods

### `submitResults(payload)`

Submit a completed game session to the backend.

**Payload shape:**
```javascript
{
  session_id: string,          // Tracker session identifier
  game_id: string,             // Game identifier
  content_set_id?: string,     // Optional content set identifier
  user_id?: string,            // Optional learner identifier
  metrics: {                   // Final metrics object (must match backend schema)
    accuracy: number,       // Overall correctness (0-1) for the attempt
    time: number,           // Overall game time from window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0)
    stars: number,          // Star rating based on accuracy (1-3)
    retries: number,        // Retry count (0 = no retries, 1 = 1 retry, etc.)
    timeBreakdown: number[] // Array of individual session times from window.gameVariableState.timerElapsedTimes
  },
  attempts: Array<{           // Attempt history
    // Root level - attempt constants
    attempt_number: number,     // Retry attempt number (not array index)
    start_timestamp: string,    // Attempt start time (ISO string)
    end_timestamp: string,      // Attempt end time (ISO string)
    duration: number,           // Attempt duration from timer differences
    overall_correctness: number,// Attempt accuracy (0-1)
    lives_lost: number,         // Lives lost in attempt
    help_taken: number,         // Help taken in attempt

    // Metadata - all content and context data
    metadata: {
      round_number: number,     // Which round in game sequence
      level_number: number,     // Which level this belongs to
      jump_states: string[],    // Jump states during round

      // Content visible to user
      content_visible: {
        goal: string,
        pairs: Array<{id: number, left: string, right: string}>,
        adjustment_options: string[]
      },

      // Content user can interact with
      content_interactive: {
        input_pairs: Array<{id: number, type: string, placeholder?: string}>,
        interactive_elements: string[]
      },

      // Other interactive content (helpers, not evaluated)
      other_interactive_content: {
        hint_button?: {enabled: boolean, used: boolean, hint_count: number},
        calculator_button?: {enabled: boolean, used: boolean},
        reference_materials?: {opened: boolean, time_spent: number}
      },

      // Content user interacted with (EXCLUDES submit button)
      content_interacted: Array<{
        interaction_order: number,
        element_id?: string,
        pair_id?: number,
        input_values: any[],
        timestamp: string,
        correctness: boolean|null,
        element_type: string
      }>,

      // Single question object (not array)
      question: {
        question_number: number,
        question: string,
        correct_answer: any,
        user_answer: any,
        was_correct: boolean,
        time_spent: number,
        question_type: string
      }
    }
  }>,
  completed_at: number,        // Completion timestamp (ms since epoch)

  // Optional: Signal data (when SignalCollector is active — separate from attempts)
  problem_signals?: Object,    // Tier 2-4 signals per problem from SignalCollector.getAllProblemSignals()
                               // Shape: { "round_1": { time_to_first_interaction_ms, phase_times, ... }, ... }
  input_events?: Array<{       // Raw input events from SignalCollector.seal().events
    event_id: string,
    student_id: string,
    session_id: string,
    problem_id: string,
    template_id: string,
    timestamp_ms: number,
    session_elapsed_ms: number,
    problem_elapsed_ms: number,
    event_type: string,            // Input: pointerdown, keydown, input, etc. View: view:screen_transition, view:content_render, view:visual_update, etc. Custom: custom:*
    event_target: string,
    event_data: object,            // Type-specific: pointer has {x,y,scroll_x,scroll_y}, keyboard has {key,key_code}, input has {value}, view has {screen, content_snapshot, components, metadata}
    problem_state: {             // Problem context at event time
      state: string,             // reading, working, submitted, idle
      problem_text: string|null,
      current_answer: any,       // student's live work-in-progress (auto from input.value or updateCurrentAnswer())
      scaffolds_visible: string[],
      difficulty_params: any
    },
    view_context: {              // last recorded visual state (set by recordViewEvent, null until first call)
      screen: string,            // "ready", "gameplay", "results", etc.
      content_snapshot: object,  // Game-specific visible content
      components: object,        // Timer, progress, lives state
      timestamp_ms: number       // When view was last set
    } | null,
    device_context: {
      device_type: string,       // "tablet" or "desktop"
      screen_size: string,       // "1024x768"
      input_method: string,      // "touch" or "mouse"
      orientation: string,       // "landscape" or "portrait"
      pixel_ratio: number
    }
  }>,
  signal_metadata?: {          // Collection metadata from SignalCollector.getMetadata()
    collector_version: string,
    session_id: string,
    student_id: string,
    template_id: string,
    total_events_captured: number,
    events_truncated: boolean,
    buffer_max_size: number,
    problems_tracked: number,
    device_context: object
  }
}
```

**Returns:** `Promise<any>` – Parsed JSON response (if any) from the core API.

**Example:**
```javascript
await api.submitResults({
  session_id: tracker.getSessionId(),
  game_id: 'game_math_drill_v1',
  content_set_id: currentContentSetId,
  user_id: currentStudentId,
  metrics: {
    accuracy: 0.8,     // overallCorrectness from attempt history
    time: 45.7,        // window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0) - sum of all sessions
    stars: 2,          // calculated: accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1
    retries: 0,        // retry count (0 = no retries, 1 = 1 retry, etc.)
    timeBreakdown: [15.3, 23.7, 6.7]  // window.gameVariableState.timerElapsedTimes - array of session times
  },
  attempts: [{
    attempt_number: 1,
    start_timestamp: "2024-01-01T10:00:00Z",
    end_timestamp: "2024-01-01T10:00:45Z",
    duration: 45.7,
    overall_correctness: 0.8,
    lives_lost: 0,
    help_taken: 0,
    metadata: {
      round_number: 1,
      level_number: 1,
      jump_states: ["normal"],
      content_visible: { /* ... */ },
      content_interactive: { /* ... */ },
      other_interactive_content: { /* ... */ },
      content_interacted: [ /* ... */ ],
      question: { /* ... */ }
    }
  }],
  completed_at: Date.now()
});
```

### `getStudentData()`

Retrieve current student information from backend.

**Returns:** `Promise<Object | null>` - Student data when implemented. Currently returns `null` (placeholder).

### `onError(callback)`

Register an error handler for API failures.

**Parameters:**
- `callback: Function` - Error handler function

**Example:**
```javascript
api.onError((error) => {
  console.error('API Error:', error);
  // Show user-friendly error message
  showNotification('Connection error. Please try again.');
});
```

### `configure(newConfig)`

Update API configuration settings.

**Parameters:**
```javascript
{
  baseUrl: string,      // API base URL
  timeout: number,      // Request timeout in ms
  headers: Object       // Additional headers
}
```

**Example:**
```javascript
api.configure({
  baseUrl: 'https://api.mathai.prod.com',
  timeout: 15000
});
```

### `getConfig()`

Get current API configuration.

**Returns:** `Object` - Current configuration

**Example:**
```javascript
const config = api.getConfig();
console.log(config);
// {
//   baseUrl: 'https://api.mathai.example.com',
//   timeout: 10000,
//   headers: { 'Content-Type': 'application/json' }
// }
```

## Usage Examples

### Result Submission with Fallback

```javascript
// When game completes
async function handleGameComplete() {
  const summary = tracker.getSummary();
  const attempts = tracker.getAttempts();
  const sessionId = tracker.getSessionId();
  const completedAt = Date.now();

  const metrics = buildMetrics(summary, attempts, completedAt);
  const attemptHistory = buildAttemptHistory(attempts, summary.startTime, completedAt);

  await api.submitResults({
    session_id: sessionId,
    game_id: currentGameId,
    content_set_id: currentContentSetId,
    user_id: currentStudentId,
    metrics,
    attempts: attemptHistory,
    completed_at: completedAt
  });
}
```

### Error Handling

```javascript
// Set up error handler on game load
window.addEventListener('load', () => {
  api.onError((error) => {
    // Log error details
    console.error('API Error:', {
      message: error.message,
      name: error.name
    });

    // Show user notification
    showErrorMessage('Connection problem. Your progress is saved locally.');
  });
});
```

### Configuration

```javascript
// Configure for production environment
if (window.location.hostname === 'mathai.production.com') {
  api.configure({
    baseUrl: 'https://api.mathai.production.com',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0'
    }
  });
}
```

## Integration with Attempt State

API Helper works with the new attempt history structure:

```javascript
// Complete workflow
async function submitGameResults() {
  const endTime = Date.now();
  const duration = calculateRoundDuration(); // From timer.getCurrentTime() differences
  const overallCorrectness = roundState.question.was_correct ? 1.0 : 0.0;

  // Create attempt history
  const attemptHistory = [{
    attempt_number: roundState.attemptNumber,
    start_timestamp: new Date(roundState.roundStartTime).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    duration: duration,
    overall_correctness: overallCorrectness,
    lives_lost: roundState.livesLost,
    help_taken: roundState.helpTaken,
    metadata: {
      round_number: roundState.roundNumber,
      level_number: roundState.levelNumber,
      jump_states: roundState.jumpStates,
      content_visible: roundState.contentVisible,
      content_interactive: roundState.contentInteractive,
      other_interactive_content: roundState.otherInteractiveContent,
      content_interacted: roundState.contentInteracted,
      question: roundState.question
    }
  }];

  // Calculate metrics for the API payload
  // - accuracy: taken from attempt history overall_correctness
  // - time: sum of all timer sessions from window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0)
  // - stars: calculated based on accuracy thresholds (90%+ = 3 stars, 70%+ = 2 stars, etc.)
  // - retries: retry count (0 = no retries, 1 = 1 retry, etc.)
  // - timeBreakdown: array of individual session times from window.gameVariableState.timerElapsedTimes
  const metrics = {
    accuracy: Number(overallCorrectness.toFixed(4)),  // From attempt history overall_correctness
    time: (window.gameVariableState && window.gameVariableState.timerElapsedTimes) ? window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0) : 0, // Sum of all timer sessions
    stars: overallCorrectness >= 0.9 ? 3 : overallCorrectness >= 0.7 ? 2 : overallCorrectness > 0 ? 1 : 0, // Star calculation
    retries: roundState.attemptNumber - 1,            // Retry count (attempts - 1, since attempts start at 1)
    timeBreakdown: (window.gameVariableState && window.gameVariableState.timerElapsedTimes) ? window.gameVariableState.timerElapsedTimes : [] // Array of individual session times
  };

  await api.submitResults({
    session_id: tracker.getSessionId(),
    game_id: gameConfig?.gameId || 'standalone_game',
    content_set_id: gameConfig?.contentSetId || null,
    user_id: gameConfig?.userId || null,
    metrics,
    attempts: attemptHistory,
    completed_at: endTime
  });

  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'game_complete',
      data: { metrics, attempts: attemptHistory }
    }, '*');
  }
}
```

## Implementation Details

- Requests default to `POST ${config.baseUrl}/api/analytics/game-sessions`
- `fetch` is wrapped with an `AbortController` to enforce the configured timeout
- Payloads are JSON-encoded; additional headers can be merged via `api.configure({ headers: { ... } })`
- When the response contains JSON it is returned to the caller, otherwise `null` is returned
- A registered `api.onError` callback is invoked for network or HTTP failures, allowing games to surface user-friendly messaging
- Games can override `baseUrl`, `endpoint`, `timeout`, or headers at runtime (e.g., using values supplied in the `game_init` message)

## Best Practices

1. **Always handle errors** - Use try/catch or `.catch()`
2. **Set up error handler** - Call `api.onError()` on game load
3. **Check response** - Verify API returned expected data
4. **Provide feedback** - Show loading states and error messages
5. **Log for debugging** - Use console.log for development

## Related Documentation

- [Tracker Helper](./tracker-helper.md) - Session and attempt tracking
- [Case Converter](./case-converter.md) - Data format conversion
- [Architecture](../reference/architecture.md) - System overview
