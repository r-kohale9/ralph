# PART-031: API Helper & Session Tracking

**Category:** CONDITIONAL | **Condition:** Game submits results to backend API | **Dependencies:** PART-002, PART-011

---

## Purpose

Submit completed game sessions to the MathAI backend. Handles request timeouts, error callbacks, and runtime configuration.

## Availability

API Helper is available via the Helpers package (`MathAIHelpers.APIHelper`). Loaded automatically when Helpers package is included.

## Configuration

```javascript
const api = new MathAIHelpers.APIHelper();

// Optional: Configure endpoint
api.configure({
  baseUrl: 'https://api.mathai.example.com',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Optional: Error handler
api.onError((error) => {
  console.error('API Error:', JSON.stringify({ message: error.message }, null, 2));
});
```

## Submit Results

```javascript
async function submitToBackend() {
  try {
    await api.submitResults({
      session_id: gameState.sessionId,
      game_id: gameState.gameId,
      content_set_id: gameState.contentSetId || null,
      user_id: gameState.userId || null,
      metrics: {
        accuracy: metrics.accuracy,
        time: metrics.time,
        stars: metrics.stars,
        retries: metrics.retries || 0,
        timeBreakdown: metrics.timeBreakdown || []
      },
      attempts: gameState.attempts,
      completed_at: Date.now()
    });
    console.log('Results submitted to backend');
  } catch (error) {
    console.error('Failed to submit results:', JSON.stringify({ error: error.message }, null, 2));
  }
}
```

## Payload Shape

```javascript
{
  session_id: string,          // Unique session identifier
  game_id: string,             // Game identifier
  content_set_id: string,      // Content set used (from game_init)
  user_id: string,             // Student identifier (from game_init)
  metrics: {
    accuracy: number,          // 0-1 range
    time: number,              // Total time in seconds
    stars: number,             // 1-3 star rating
    retries: number,           // Retry count
    timeBreakdown: number[]    // Per-session times
  },
  attempts: Array<{
    attempt_number: number,
    start_timestamp: string,   // ISO string
    end_timestamp: string,     // ISO string
    duration: number,
    overall_correctness: number,
    metadata: {
      round_number: number,
      question: {
        question_number: number,
        question: string,
        correct_answer: any,
        user_answer: any,
        was_correct: boolean,
        time_spent: number
      }
    }
  }>,
  completed_at: number         // Timestamp ms
}
```

## Integration with endGame

```javascript
function endGame() {
  // ... calculate metrics (PART-011) ...

  // Submit via postMessage (always)
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'game_complete',
      data: { metrics, attempts: gameState.attempts, events: gameState.events }
    }, '*');
  }

  // Submit to backend API (if configured)
  if (typeof MathAIHelpers !== 'undefined' && MathAIHelpers.APIHelper) {
    submitToBackend();
  }
}
```

## Verification

- [ ] API Helper instantiated from Helpers package
- [ ] `submitResults` called with correct payload shape
- [ ] Error handler registered via `onError`
- [ ] Backend submission happens alongside postMessage (not instead of)
- [ ] Try/catch wraps all API calls
