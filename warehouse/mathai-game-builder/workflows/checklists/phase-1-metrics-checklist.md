# Phase 1 Metrics Checklist - Attempt History Logging

## When to Use

**MANDATORY for Phase 1 completion** - Verify metrics and attempt history are properly logged at game end.

## Critical Rule

⚠️ **Console logging must be present for debugging and verification**

## Checklist Items

**Output and verify metrics checklist:**

```
📋 Phase 1 Metrics Checklist - End of Gameplay Logging:

[ ] Exact metrics object structure is created (console.log('Final Metrics:', {accuracy, time, stars, attempts, timeBreakdown}))
[ ] Attempt history is created (e.g., console.log('Attempt History:', attemptHistory))
[ ] All required metrics captured (accuracy, time, stars, attempts, timeBreakdown)
[ ] Game session payload submitted via api.submitResults (POST /api/analytics/game-sessions)
[ ] **MANDATORY:** Duration calculated from timer.getCurrentTime() differences only
[ ] **MANDATORY:** metrics.attempts equals roundState.attemptNumber (current retry count + 1, e.g., 1 = no retries, 2 = 1 retry, etc.)
[ ] **MANDATORY:** Read examples/attempt-history-examples.md and verify attempt history schema matches the documented structure
[ ] **MANDATORY:** Verify attempt history follows the exact MANDATORY structure documented in examples/attempt-history-examples.md
```

**Process and verify each checklist item, then output verified checklist:**

```
📋 Phase 1 Metrics Checklist - VERIFIED:

[✅/❌] Exact metrics object structure logged (console.log('Final Metrics:', {accuracy, time, stars, attempts, timeBreakdown}))
[✅/❌] Attempt history logged to console (e.g., console.log('Attempt History:', attemptHistory))
[✅/❌] All required metrics captured (accuracy, time, stars, attempts, timeBreakdown)
[✅/❌] Game session payload submitted via api.submitResults (POST /api/analytics/game-sessions)
[✅/❌] **MANDATORY:** time equals window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0)
[✅/❌] **MANDATORY:** metrics.attempts equals roundState.attemptNumber (verified current retry count + 1)
[✅/❌] **MANDATORY:** Read examples/attempt-history-examples.md and verified attempt history schema matches the documented structure
[✅/❌] **MANDATORY:** Verified attempt history follows the exact MANDATORY structure documented in examples/attempt-history-examples.md
```

## Required Console Logging

**MANDATORY pattern for end of game - EXACT METRICS STRUCTURE:**

```javascript
// ✅ CORRECT - At end of gameplay
function submitGame() {
  // Calculate final metrics - EXACT structure required
  const metrics = {
    accuracy: calculateAccuracy(),        // required: number (0-1 or 0-100)
    time: calculateRoundDuration(),       // required: duration from timer.getCurrentTime() differences
    stars: calculateStars(),             // required: number (1-3 or 0-3)
    retries: currentRetryCount, // required: number (actual retry count: 0 = no retries, 1 = 1 retry, etc.)
    timeBreakdown: window.gameVariableState.timerElapsedTimes // required: array of session times
  };

  // Log metrics to console - EXACT format required
  console.log('Final Metrics:', metrics);

  // Log attempt history
  console.log('Attempt History:', attemptHistory);

  // Show game complete UI
  showResults(results);
}
```

**REQUIRED METRICS OBJECT STRUCTURE:**
```javascript
const metrics = {
  accuracy: number,      // REQUIRED: accuracy percentage
  time: number,         // REQUIRED: duration from timer.getCurrentTime() differences
  stars: number,        // REQUIRED: star rating
  retries: number,      // REQUIRED: retry count (0 = no retries, 1 = 1 retry, etc.)
  timeBreakdown: number[] // REQUIRED: array of individual session times
};
```

**Verification:**
- [ ] EXACT `console.log('Final Metrics:', metrics)` present at game end
- [ ] `metrics` object has EXACTLY these five properties: accuracy, time, stars, retries, timeBreakdown
- [ ] accuracy, time, stars, retries are numbers (no undefined, null, or NaN)
- [ ] `time` equals window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0) (sum of all sessions)
- [ ] `timeBreakdown` equals window.gameVariableState.timerElapsedTimes (array of session times)
- [ ] `console.log('Attempt History:', attemptHistory)` also present
- [ ] Network tab shows POST to `/api/analytics/game-sessions` with correct payload
- [ ] Logging happens BEFORE game completion UI is shown

## Required Metrics

**Minimum metrics to capture:**
- [ ] `accuracy` - Percentage correct (0-1 or 0-100)
- [ ] `time` - Overall game time from window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0)
- [ ] `stars` - Star rating (1-3 or 0-3)
- [ ] `retries` - Retry count (0 = no retries, 1 = 1 retry, 2 = 2 retries, etc.)
- [ ] `timeBreakdown` - Array of individual session times from window.gameVariableState.timerElapsedTimes

**Optional metrics (game-specific):**
- [ ] `hints_used` - Number of hints requested
- [ ] `speed_score` - Speed bonus calculation
- [ ] `streak` - Longest correct answer streak
- [ ] `confidence` - Self-reported confidence level

## Time Breakdown Structure

**MANDATORY timeBreakdown schema:**

```javascript
"timeBreakdown": [
  15.3,  // First timer session (seconds)
  23.7,  // Second timer session (seconds)
  8.9    // Third timer session (seconds)
  // ... etc for each timer reset
]
```

**Time Breakdown Requirements:**
- **Array of numbers** representing elapsed time for each timer session
- **Values in seconds** from window.gameVariableState.timerElapsedTimes
- **time field is sum of timeBreakdown array**
- **Both time and timeBreakdown come from window.gameVariableState.timerElapsedTimes**

## Attempt History Structure

**Required attempt history format with MANDATORY structure:**

```javascript
const attemptHistory = [
  {
    // Root level - attempt constants
    attempt_number: 1,                              // REQUIRED: retry attempt number (not array index)
    start_timestamp: "2024-01-01T10:00:00Z",       // REQUIRED: attempt start time
    end_timestamp: "2024-01-01T10:00:45Z",         // REQUIRED: attempt end time
    duration: 45.7,                                // REQUIRED: from timer.getCurrentTime() differences
    overall_correctness: 0.8,                       // REQUIRED: attempt accuracy (0-1)
    lives_lost: 0,                                 // OPTIONAL: lives lost in attempt
    help_taken: 1,                                 // OPTIONAL: help taken in attempt

    // Metadata - all content and context data
    metadata: {
      round_number: 1,                             // REQUIRED: which round in game sequence
      level_number: 1,                             // REQUIRED: which level this belongs to
      jump_states: ["normal", "jumped"],           // OPTIONAL: jump states during attempt

      // Content visible to user
      content_visible: {
        goal: "Complete all math problems",
        pairs: [{id: 1, left: "5 + 3", right: "?"}],
        adjustment_options: ["easy", "medium", "hard"]
      },

      // Content user can interact with
      content_interactive: {
        input_pairs: [{id: 1, type: "text", placeholder: "Enter answer"}],
        interactive_elements: ["input_1", "submit_btn"]
      },

      // Other interactive content (helpers, not evaluated)
      other_interactive_content: {
        calculator_button: {enabled: true, used: false},
        hint_button: {enabled: true, used: true, hint_count: 2},
        reference_materials: {opened: true, time_spent: 15.3}
      },

      // Content user interacted with (EXCLUDES submit button)
      content_interacted: [
        {
          interaction_order: 1,
          pair_id: 1,
          input_values: ["8"],
          timestamp: "2024-01-01T10:00:02Z",
          correctness: true,
          element_type: "input_field"
        }
      ],

      // Single question object (not array)
      question: {
        question_number: 1,
        question: "What is 5 + 3?",
        correct_answer: "8",
        user_answer: "8",
        was_correct: true,
        time_spent: 2.1,
        question_type: "single_interaction_single_correctness"
      }
    }
  }
];
```

**MANDATORY attempt history structure validation:**
- [✅/❌] `attempt_number` present (retry attempts, not array index)
- [✅/❌] `start_timestamp` and `end_timestamp` present and valid ISO timestamps
- [✅/❌] `duration` calculated from timer.getCurrentTime() differences only
- [✅/❌] `overall_correctness` present (round-level accuracy)
- [✅/❌] `metadata` present with all required fields
- [✅/❌] `metadata.round_number` and `metadata.level_number` present
- [✅/❌] `metadata.question` is single object (not array)
- [✅/❌] Submit button interactions excluded from `content_interacted`

**Attempt-based verification:**
- [ ] Each attempt history item represents one complete attempt
- [ ] attempt_number represents retry attempts (not sequential array index)
- [ ] Duration calculated from timer differences between attempt start/end
- [ ] Content tracking separated into visible, interactive, and interacted
- [ ] Helper content tracked separately in other_interactive_content

## Console Output Verification

**Browser console testing:**

1. **Open game in browser**
2. **Play through complete game**
3. **Check console output at game end:**

```
Expected console output:
Final Metrics: {accuracy: 0.85, time: 47.9, stars: 3, retries: 1, timeBreakdown: [15.3, 23.7, 8.9]}
Attempt History: [{attempt_number: 1, start_timestamp: "2024-01-01T10:00:00Z", end_timestamp: "2024-01-01T10:00:45Z", duration: 45.7, overall_correctness: 0.8, metadata: {round_number: 1, level_number: 1, ...}}, {...}]
```

**Verification checklist:**
- [ ] Console output appears when game ends
- [ ] "Final Metrics:" label is present
- [ ] Metrics object is readable and complete
- [ ] "Attempt History:" label is present
- [ ] Attempt history shows attempt-based structure (not question-based)
- [ ] Each attempt history item has attempt_number, timestamps, duration, metadata
- [ ] No JavaScript errors in console
- [ ] Output format is consistent and parseable

## Final Verification

**Code Search:**
- [ ] Search for `console.log` - should find metrics and attempt history logging
- [ ] Search for `submitGame` or game completion function - verify logging placement
- [ ] Search for `Final Metrics` - should find the exact console.log statement
- [ ] Search for `Attempt History` - should find the exact console.log statement
- [ ] Search for `calculateRoundDuration` - should find timer-based duration calculation

**Browser Testing:**
- [ ] Open game, complete gameplay
- [ ] Open browser DevTools → Console tab
- [ ] Verify expected output appears
- [ ] Copy console output for verification
- [ ] Confirm metrics.time equals window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b,0)
- [ ] Confirm attempt history structure matches attempt-based schema
- [ ] Confirm submission attempt succeeded via `api.submitResults`

**Checklist Completion:**
- [ ] All required console logging is present
- [ ] Output format is readable and consistent
- [ ] Metrics capture all required data
- [ ] Attempt history is complete and well-structured
- [ ] **MANDATORY:** Attempt history structure validation passed (attempt_number, timestamps, duration, metadata with round/level data)
- [ ] **MANDATORY:** Duration calculated from timer.getCurrentTime() differences only
- [ ] **MANDATORY:** Submit button interactions excluded from content_interacted
- [ ] [DYNAMIC] All custom metrics properly logged to console (WPM, score, combo bonuses, etc.)
- [ ] No console errors during gameplay

## Reference

- Phase 1 workflow: [phase-1-core-gameplay.md](../phase-1-core-gameplay.md)
- Attempt history examples: [attempt-history-examples.md](../../examples/attempt-history-examples.md)
- Debugging functions: [debug-functions.md](../../reference/debug-functions.md)
- Error messages: [error-messages.md](../../reference/error-messages.md)
