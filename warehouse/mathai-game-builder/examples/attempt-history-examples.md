# Attempt History Examples

This document provides comprehensive examples of the new attempt history structure, showing different question types and interaction patterns.

## Overview

The new attempt history structure tracks complete attempts rather than individual question attempts. Each attempt history item represents one complete game attempt with all associated content, interactions, and outcomes.

## Key Changes from Previous Structure

- **Attempt-based vs Question-based**: Each item represents a complete attempt, not individual question attempts
- **Attempt duration**: Uses `timer.getCurrentTime()` differences for each attempt
- **Metrics time**: Uses `window.gameVariableState.timerElapsedTimes.reduce()` for overall game time
- **Content organization**: All content data moved to `metadata` section
- **Interaction tracking**: Detailed sequence of user interactions (excluding submit button)
- **Retry semantics**: `attempt_number` represents retry attempts, not array index

## Schema Structure

```javascript
attemptHistory = [
  {
    // Root level - attempt constants
    attempt_number: number,     // Retry attempt number
    start_timestamp: string,    // Attempt start time (ISO)
    end_timestamp: string,      // Attempt end time (ISO)
    duration: number,           // Attempt duration from timer.getCurrentTime() differences
    overall_correctness: number,// Attempt accuracy (0-1)
    lives_lost: number,         // Lives lost in attempt
    help_taken: number,         // Help taken in attempt

    // Metadata - all content and context data
    metadata: {
      round_number: number,     // Which round in sequence
      level_number: number,     // Which level this belongs to
      jump_states: string[],    // Jump states during attempt

      content_visible: { /* goal, pairs, options */ },
      content_interactive: { /* inputs, buttons */ },
      other_interactive_content: { /* helpers */ },
      content_interacted: [ /* interaction sequence */ ],
      question: { /* single question object */ }
    }
  }
]
```

## Example 1: Single Interaction, Single Correctness

**Scenario**: Text input field where user types an answer (like a math problem)

```javascript
{
  attempt_number: 1,
  start_timestamp: "2024-01-01T10:00:00Z",
  end_timestamp: "2024-01-01T10:00:12Z",
  duration: 12.5,
  overall_correctness: 1.0,
  lives_lost: 0,
  help_taken: 0,

  metadata: {
    round_number: 1,
    level_number: 1,
    jump_states: ["normal"],

    content_visible: {
      goal: "Solve the math problem",
      pairs: [
        { id: 1, left: "5 + 3 =", right: "?" }
      ],
      adjustment_options: []
    },

    content_interactive: {
      input_pairs: [
        { id: 1, type: "text", placeholder: "Enter your answer" }
      ],
      interactive_elements: ["input_1", "submit_btn"]
    },

    other_interactive_content: {
      hint_button: { enabled: true, used: false, hint_count: 0 },
      calculator_button: { enabled: false, used: false }
    },

    content_interacted: [
      {
        interaction_order: 1,
        pair_id: 1,
        input_values: ["8"],
        timestamp: "2024-01-01T10:00:08Z",
        correctness: true,
        element_type: "input_field"
      }
    ],

    question: {
      question_number: 1,
      question: "What is 5 + 3?",
      correct_answer: "8",
      user_answer: "8",
      was_correct: true,
      time_spent: 8.2,
      question_type: "single_interaction_single_correctness"
    }
  }
}
```

## Example 2: Multiple Interactions, Single Correctness

**Scenario**: Multiple choice question with 4 options where only 1 is correct

```javascript
{
  attempt_number: 1,
  start_timestamp: "2024-01-01T10:00:00Z",
  end_timestamp: "2024-01-01T10:00:08Z",
  duration: 8.3,
  overall_correctness: 1.0,
  lives_lost: 0,
  help_taken: 1,

  metadata: {
    round_number: 2,
    level_number: 1,
    jump_states: ["normal"],

    content_visible: {
      goal: "Choose the correct answer",
      pairs: [
        { id: 1, left: "What is 5 + 3?", right: null }
      ],
      adjustment_options: [],
      options: [
        { id: "a", text: "6", is_correct: false },
        { id: "b", text: "7", is_correct: false },
        { id: "c", text: "8", is_correct: true },
        { id: "d", text: "9", is_correct: false }
      ]
    },

    content_interactive: {
      interactive_elements: ["option_a", "option_b", "option_c", "option_d"]
    },

    other_interactive_content: {
      hint_button: { enabled: true, used: true, hint_count: 1 },
      calculator_button: { enabled: false, used: false }
    },

    content_interacted: [
      {
        interaction_order: 1,
        element_id: "hint_button",
        input_values: ["click"],
        timestamp: "2024-01-01T10:00:03Z",
        correctness: null,
        element_type: "hint_button"
      },
      {
        interaction_order: 2,
        element_id: "option_a",
        input_values: ["click"],
        timestamp: "2024-01-01T10:00:05Z",
        correctness: false,
        element_type: "multiple_choice_option"
      },
      {
        interaction_order: 3,
        element_id: "option_c",
        input_values: ["click"],
        timestamp: "2024-01-01T10:00:07Z",
        correctness: true,
        element_type: "multiple_choice_option"
      }
    ],

    question: {
      question_number: 1,
      question: "What is 5 + 3?",
      correct_answer: "c",
      user_answer: "c",
      was_correct: true,
      time_spent: 7.1,
      question_type: "multiple_interactions_single_correctness",
      interaction_attempts: 2
    }
  }
}
```

## Example 3: Multiple Interactions, Multiple Correctness

**Scenario**: Select all even numbers from a list (multiple correct answers)

```javascript
{
  attempt_number: 2,  // This is retry attempt 2
  start_timestamp: "2024-01-01T10:00:00Z",
  end_timestamp: "2024-01-01T10:00:25Z",
  duration: 25.8,
  overall_correctness: 0.75,
  lives_lost: 1,
  help_taken: 2,

  metadata: {
    round_number: 3,
    level_number: 2,
    jump_states: ["normal", "retry"],

    content_visible: {
      goal: "Select all even numbers",
      pairs: [
        { id: 1, left: "Numbers: 1, 2, 3, 4, 5, 6", right: null }
      ],
      instruction: "Click on all the even numbers",
      options: [
        { id: "num_1", text: "1", is_correct: false },
        { id: "num_2", text: "2", is_correct: true },
        { id: "num_3", text: "3", is_correct: false },
        { id: "num_4", text: "4", is_correct: true },
        { id: "num_5", text: "5", is_correct: false },
        { id: "num_6", text: "6", is_correct: true }
      ]
    },

    content_interactive: {
      interactive_elements: ["num_1", "num_2", "num_3", "num_4", "num_5", "num_6"]
    },

    other_interactive_content: {
      lives_indicator: { total: 3, remaining: 2, lost: 1 },
      help_button: { enabled: true, used: true, help_count: 2 },
      progress_bar: { enabled: true, updated: true }
    },

    content_interacted: [
      {
        interaction_order: 1,
        element_id: "num_2",
        input_values: ["select"],
        timestamp: "2024-01-01T10:00:05Z",
        correctness: true,
        element_type: "multi_select_option"
      },
      {
        interaction_order: 2,
        element_id: "num_4",
        input_values: ["select"],
        timestamp: "2024-01-01T10:00:08Z",
        correctness: true,
        element_type: "multi_select_option"
      },
      {
        interaction_order: 3,
        element_id: "num_1",
        input_values: ["select"],
        timestamp: "2024-01-01T10:00:10Z",
        correctness: false,
        element_type: "multi_select_option"
      },
      {
        interaction_order: 4,
        element_id: "help_button",
        input_values: ["click"],
        timestamp: "2024-01-01T10:00:15Z",
        correctness: null,
        element_type: "help_button"
      },
      {
        interaction_order: 5,
        element_id: "num_6",
        input_values: ["select"],
        timestamp: "2024-01-01T10:00:20Z",
        correctness: true,
        element_type: "multi_select_option"
      }
    ],

    question: {
      question_number: 1,
      question: "Select all even numbers from: 1, 2, 3, 4, 5, 6",
      correct_answer: ["num_2", "num_4", "num_6"],
      user_answer: ["num_2", "num_4", "num_1"],
      was_correct: false,
      time_spent: 25.8,
      question_type: "multiple_interactions_multiple_correctness",
      selections_correct: 2,
      selections_incorrect: 1,
      selections_missed: 1
    }
  }
}
```

## Example 4: Failed Attempt with Retry

**Scenario**: User fails an attempt and retries (attempt_number = 2)

```javascript
{
  attempt_number: 2,
  start_timestamp: "2024-01-01T10:01:00Z",
  end_timestamp: "2024-01-01T10:01:30Z",
  duration: 30.2,
  overall_correctness: 0.0,
  lives_lost: 3,
  help_taken: 5,

  metadata: {
    round_number: 1,
    level_number: 1,
    jump_states: ["retry", "struggling"],

    content_visible: {
      goal: "Complete the pattern",
      pairs: [
        { id: 1, left: "1, 3, 5, ?", right: "7" }
      ],
      adjustment_options: ["show-hint", "reduce-options"]
    },

    content_interactive: {
      input_pairs: [
        { id: 1, type: "text", placeholder: "Next number in pattern" }
      ],
      interactive_elements: ["input_1", "hint_btn", "help_btn"]
    },

    other_interactive_content: {
      hint_button: { enabled: true, used: true, hint_count: 3 },
      help_button: { enabled: true, used: true, help_count: 2 },
      lives_indicator: { total: 3, remaining: 0, lost: 3 }
    },

    content_interacted: [
      {
        interaction_order: 1,
        pair_id: 1,
        input_values: ["9"],
        timestamp: "2024-01-01T10:01:05Z",
        correctness: false,
        element_type: "input_field"
      },
      {
        interaction_order: 2,
        element_id: "hint_btn",
        input_values: ["click"],
        timestamp: "2024-01-01T10:01:10Z",
        correctness: null,
        element_type: "hint_button"
      },
      {
        interaction_order: 3,
        pair_id: 1,
        input_values: ["11"],
        timestamp: "2024-01-01T10:01:15Z",
        correctness: false,
        element_type: "input_field"
      },
      {
        interaction_order: 4,
        element_id: "help_btn",
        input_values: ["click"],
        timestamp: "2024-01-01T10:01:20Z",
        correctness: null,
        element_type: "help_button"
      },
      {
        interaction_order: 5,
        pair_id: 1,
        input_values: ["13"],
        timestamp: "2024-01-01T10:01:25Z",
        correctness: false,
        element_type: "input_field"
      }
    ],

    question: {
      question_number: 1,
      question: "What is the next number in the pattern: 1, 3, 5, ?",
      correct_answer: "7",
      user_answer: "13",
      was_correct: false,
      time_spent: 30.2,
      question_type: "single_interaction_single_correctness",
      interaction_attempts: 3
    }
  }
}
```

## Timer Duration Calculation

The system uses different timer methods for different purposes:

### Attempt History Duration (Individual Attempts)
Each attempt calculates its duration using `timer.getCurrentTime()` differences:

```javascript
function calculateRoundDuration() {
  if (!timer) return 0;
  const currentTimerValue = timer.getCurrentTime();
  const attemptDuration = currentTimerValue - roundState.roundStartTimerValue;
  return Math.max(0, attemptDuration);
}
```

**Key Points:**
- Duration is calculated from `timer.getCurrentTime()` differences
- `window.gameVariableState.timerElapsedTimes` array is NOT used for attempt duration
- Attempt start timer value is captured when attempt begins
- Duration represents actual time spent in that specific attempt

### Metrics Time (Overall Game)
The metrics object uses `window.gameVariableState.timerElapsedTimes` for overall game time:

```javascript
const metrics = {
  time: window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0), // Sum of all sessions
  timeBreakdown: window.gameVariableState.timerElapsedTimes // Array of session times
};
```

**Key Points:**
- `time` = sum of all timer sessions (overall game time)
- `timeBreakdown` = array of individual session times
- Both come from the same `window.gameVariableState.timerElapsedTimes` array

## Interaction Tracking Rules

1. **Include user actions**: Clicks, selections, text input
2. **Exclude submit button**: Submit actions are not tracked in `content_interacted`
3. **Include helper actions**: Hint button clicks, calculator usage, etc.
4. **Track sequence**: `interaction_order` shows chronological sequence
5. **Correctness evaluation**: `null` for helpers, `true`/`false` for evaluated actions

## Attempt vs Question Attempts

- **Attempt**: Complete game session (may include retries)
- **Question attempts**: Individual tries within an attempt (tracked in question metadata)
- **attempt_number**: Counts retry attempts of the entire attempt
- **interaction_attempts**: Counts tries on a specific question (in question metadata)

## Retry Count vs Attempt History Length

The system distinguishes between two different "attempt" concepts:

### Retry Count (metrics.retries)
- **What it is**: How many times the user has retried this game round
- **Source**: `roundState.attemptNumber - 1` (converted from attempt number to retry count)
- **Example**: User fails round 1, retries → retry count = 1
- **Purpose**: Shows persistence/persistence level

### Attempt History Array Length
- **What it is**: Number of attempt history entries submitted
- **Source**: `attemptHistory.length`
- **Example**: Single submission with current attempt → length = 1
- **Purpose**: Number of historical records in this payload

**Note**: Since we submit one attempt history entry per game completion, these values are often the same, but they represent different concepts.

This structure provides comprehensive tracking of user behavior while maintaining clear separation between attempt-level and question-level data.

## Signal Data (Separate from Attempt History)

When SignalCollector is active (see [components/signal-collector.md](../components/signal-collector.md)), signal data is sent as **separate top-level fields** in the game_complete payload — NOT merged into attempt_history:

```javascript
const payload = signalCollector.seal();
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: { /* ... */ },
    attempts: attemptHistory,   // standard attempt history (no signals)
    ...payload                  // { events, signals, metadata }
  }
}, '*');
```

**Key points:**
- `seal()` finalizes the collector and returns `{ events, signals, metadata }`
- Signals are **separate** from attempt_history — never merged into `attempt.metadata`
- `signals` is a map: `{ "round_1": { Tier 2-4 signals }, "round_2": { ... } }`
- `events` contains all captured events from the flat event log, including:
  - Input events (`pointerdown`, `keydown`, etc.) — what the student DID
  - View events (`view:screen_transition`, `view:content_render`, `view:visual_update`, etc.) — what the student SAW
  - Custom events (`custom:*`) — game-specific events
- Input events include `view_context` showing what was on screen when the interaction happened
- See [examples/signal-capture-patterns.md](signal-capture-patterns.md) Pattern 5 for game_complete, Pattern 9 for view events
