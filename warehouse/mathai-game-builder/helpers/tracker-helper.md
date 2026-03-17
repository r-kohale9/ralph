# Tracker Helper

## Overview

The Tracker Helper provides session management and attempt tracking for games. It records user interactions, maintains session state, and generates analytics summaries. This is a **POC (Proof of Concept) implementation** that stores data locally in memory.

**Current Status:** POC Version - Replace with actual backend integration in production.

**Location:** `/assets/game-template/helpers/tracker-helper.js`

## Purpose

- Track game sessions with unique IDs
- Record each question attempt with outcomes
- Calculate session statistics (accuracy, duration)
- Provide data for teacher/parent replay
- Enable analytics and adaptive learning

## Methods

### `startSession()`

Initialize a new tracking session. Call this at the beginning of each game.

**Parameters:** None

**Returns:** Undefined

**Example:**
```javascript
// When game loads
window.addEventListener('load', () => {
  tracker.startSession();
  console.log('Session started:', tracker.getSessionId());
});
```

**What it does:**
- Generates unique session ID
- Records start timestamp
- Clears previous attempt data
- Logs session start to console

**Session ID Format:** `session_1699123456789_a1b2c3d4e`
- Timestamp for uniqueness
- Random string for collision prevention

### `recordAttempt(attemptData)`

Record a single question attempt with all relevant details.

**Parameters:**
```javascript
{
  questionNumber: number,     // Question sequence number
  question: string,           // Question text
  selectedAnswer: string,     // User's answer
  correctAnswer: string,      // Correct answer
  correct: boolean,           // Whether answer was correct
  timestamp: number           // When attempt was made (Date.now())
}
```

**Returns:** Undefined

**Example:**
```javascript
function checkAnswer(userAnswer) {
  const correct = userAnswer === currentQuestion.answer;

  tracker.recordAttempt({
    questionNumber: currentQuestionIndex + 1,
    question: currentQuestion.text,
    selectedAnswer: userAnswer,
    correctAnswer: currentQuestion.answer,
    correct: correct,
    timestamp: Date.now()
  });

  if (correct) {
    showCorrectFeedback();
  } else {
    showIncorrectFeedback();
  }
}
```

**What it does:**
- Validates session is started
- Adds session ID and attempt number
- Stores attempt in session array
- Logs attempt to console

**Error Handling:**
```javascript
if (!sessionId) {
  console.error('❌ Cannot record attempt: Session not started. Call tracker.startSession() first.');
  return;
}
```

### `getAttempts()`

Retrieve all attempts for the current session.

**Returns:** `Array` - Copy of attempts array (safe to modify)

**Example:**
```javascript
// When game completes
function showResults() {
  const attempts = tracker.getAttempts();

  attempts.forEach((attempt, index) => {
    console.log(`Q${attempt.questionNumber}: ${attempt.correct ? '✓' : '✗'}`);
  });

  // Send to backend
  api.submitResults({
    attempts: attempts,
    sessionId: tracker.getSessionId()
  });
}
```

**Attempt Structure:**
```javascript
{
  sessionId: "session_1699123456789_a1b2c3d4e",
  attemptNumber: 1,
  questionNumber: 1,
  question: "What is 5 + 3?",
  selectedAnswer: "8",
  correctAnswer: "8",
  correct: true,
  timestamp: 1699123456789
}
```

### `getSummary()`

Calculate session statistics and analytics.

**Returns:** `Object` - Session summary with metrics

**Example:**
```javascript
const summary = tracker.getSummary();
console.log(summary);
// {
//   sessionId: "session_1699123456789_a1b2c3d4e",
//   totalAttempts: 10,
//   correctAttempts: 8,
//   incorrectAttempts: 2,
//   accuracy: 0.8,              // 80%
//   duration: 245000,           // 245 seconds in ms
//   startTime: 1699123456789
// }
```

**Calculated Metrics:**
- `totalAttempts` - Number of questions answered
- `correctAttempts` - Number answered correctly
- `incorrectAttempts` - Number answered incorrectly
- `accuracy` - Percentage correct (0-1 range)
- `duration` - Total session time in milliseconds
- `startTime` - When session started

**Usage for Scoring:**
```javascript
function calculateFinalScore() {
  const summary = tracker.getSummary();

  const baseScore = summary.correctAttempts * 10;
  const accuracyBonus = summary.accuracy >= 0.8 ? 20 : 0;
  const speedBonus = summary.duration < 180000 ? 10 : 0;  // < 3 minutes

  return baseScore + accuracyBonus + speedBonus;
}
```

### `getSessionId()`

Get the current session identifier.

**Returns:** `string | null` - Session ID or null if not started

**Example:**
```javascript
const sessionId = tracker.getSessionId();

if (sessionId) {
  console.log('Active session:', sessionId);
} else {
  console.log('No active session');
  tracker.startSession();
}
```

**Usage in API calls:**
```javascript
await api.submitResults({
  sessionId: tracker.getSessionId(),
  results: tracker.getSummary()
});
```

### `clearSession()`

Clear all session data. Useful for testing or starting fresh.

**Parameters:** None

**Returns:** Undefined

**Example:**
```javascript
// Reset for new game
function restartGame() {
  tracker.clearSession();
  tracker.startSession();
  resetGameState();
  loadFirstQuestion();
}
```

**Usage in testing:**
```javascript
// Test scenario
beforeEach(() => {
  tracker.clearSession();
  tracker.startSession();
});

test('records correct attempts', () => {
  tracker.recordAttempt({
    questionNumber: 1,
    question: "2 + 2",
    selectedAnswer: "4",
    correctAnswer: "4",
    correct: true,
    timestamp: Date.now()
  });

  expect(tracker.getAttempts().length).toBe(1);
});
```

## Usage Examples

### Complete Game Flow

```javascript
// 1. Initialize on load
window.addEventListener('load', () => {
  tracker.startSession();
  console.log('📊 Session started:', tracker.getSessionId());
  loadFirstQuestion();
});

// 2. Record each attempt
function submitAnswer(userAnswer) {
  const correct = validateAnswer(userAnswer, currentQuestion.correctAnswer);

  tracker.recordAttempt({
    questionNumber: currentQuestionNumber,
    question: currentQuestion.text,
    selectedAnswer: userAnswer,
    correctAnswer: currentQuestion.correctAnswer,
    correct: correct,
    timestamp: Date.now()
  });

  if (correct) {
    moveToNextQuestion();
  } else {
    showIncorrectFeedback();
  }
}

// 3. Get summary at end
function endGame() {
  const summary = tracker.getSummary();

  console.log('📊 Game Summary:', JSON.stringify(summary, null, 2));

  displayResults(summary);
  submitToBackend(summary);
}
```

### Real-Time Progress Display

```javascript
function updateProgressBar() {
  const summary = tracker.getSummary();

  const progressPercent = (summary.correctAttempts / summary.totalAttempts) * 100;
  const accuracyPercent = summary.accuracy * 100;

  document.getElementById('progress').style.width = `${progressPercent}%`;
  document.getElementById('accuracy').textContent = `${accuracyPercent.toFixed(1)}%`;
  document.getElementById('correct').textContent = summary.correctAttempts;
  document.getElementById('total').textContent = summary.totalAttempts;
}

// Call after each attempt
tracker.recordAttempt(attemptData);
updateProgressBar();
```

### Adaptive Difficulty

```javascript
function getNextQuestionDifficulty() {
  const summary = tracker.getSummary();

  // Adjust difficulty based on performance
  if (summary.totalAttempts < 3) {
    return 'easy';  // Start easy
  }

  if (summary.accuracy >= 0.8) {
    return 'hard';  // Doing well, increase challenge
  } else if (summary.accuracy >= 0.5) {
    return 'medium';  // Moderate performance
  } else {
    return 'easy';  // Struggling, make it easier
  }
}

// Use when selecting next question
const difficulty = getNextQuestionDifficulty();
const nextQuestion = selectQuestion(difficulty);
```

### Detailed Attempt Review

```javascript
function showAttemptHistory() {
  const attempts = tracker.getAttempts();

  const historyHTML = attempts.map(attempt => `
    <div class="attempt ${attempt.correct ? 'correct' : 'incorrect'}">
      <span class="question-num">Q${attempt.questionNumber}</span>
      <span class="question-text">${attempt.question}</span>
      <span class="answer">Your answer: ${attempt.selectedAnswer}</span>
      ${!attempt.correct ? `<span class="correct-answer">Correct: ${attempt.correctAnswer}</span>` : ''}
      <span class="result">${attempt.correct ? '✓' : '✗'}</span>
    </div>
  `).join('');

  document.getElementById('history').innerHTML = historyHTML;
}
```

### Integration with Event Tracking

```javascript
// Use Tracker for attempts, eventTracker for detailed interactions
function handleUserAction(action, target, data) {
  // Record low-level event
  eventTracker.track(action, target, data);

  // If it's an answer submission, record attempt too
  if (action === 'submit_answer') {
    tracker.recordAttempt({
      questionNumber: data.questionNumber,
      question: data.question,
      selectedAnswer: data.answer,
      correctAnswer: data.correctAnswer,
      correct: data.correct,
      timestamp: Date.now()
    });
  }
}
```

## POC Implementation Details

### Current Storage

```javascript
// In-memory storage (lost on page refresh)
let sessionId = null;
let sessionStartTime = null;
let attempts = [];
```

**Limitations:**
- Data lost on refresh
- Not persisted to backend
- No cross-device sync
- No offline support

### Production Migration

**Add localStorage persistence:**
```javascript
function saveToLocalStorage() {
  localStorage.setItem('tracker_session', JSON.stringify({
    sessionId,
    sessionStartTime,
    attempts
  }));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('tracker_session');
  if (saved) {
    const data = JSON.parse(saved);
    sessionId = data.sessionId;
    sessionStartTime = data.sessionStartTime;
    attempts = data.attempts;
  }
}
```

**Add backend sync:**
```javascript
// Send to backend immediately or in batches
recordAttempt(attemptData) {
  const attempt = {
    sessionId,
    attemptNumber: attempts.length + 1,
    ...attemptData
  };

  attempts.push(attempt);

  // Send to backend
  api.post('/attempts/record', attempt).catch(error => {
    console.error('Failed to sync attempt:', error);
    // Store in queue for retry
  });
}
```

## Console Output

The tracker provides helpful console logging:

**On session start:**
```
📊 Tracking session started: session_1699123456789_a1b2c3d4e
```

**On attempt recorded:**
```
📝 Attempt recorded: {
  sessionId: "session_1699123456789_a1b2c3d4e",
  attemptNumber: 1,
  questionNumber: 1,
  question: "What is 5 + 3?",
  selectedAnswer: "8",
  correctAnswer: "8",
  correct: true,
  timestamp: 1699123456789
}
```

**On session cleared:**
```
🗑️ Session data cleared
```

**On load:**
```
✅ Tracker Helper loaded (POC version)
```

## Best Practices

1. **Always start session on game load**
   ```javascript
   window.addEventListener('load', () => {
     tracker.startSession();
   });
   ```

2. **Record every attempt immediately**
   ```javascript
   // ✅ Good - Record right away
   const correct = checkAnswer(userAnswer);
   tracker.recordAttempt({ /* ... */ });

   // ❌ Bad - Waiting to record later
   const correct = checkAnswer(userAnswer);
   // ... lots of code ...
   // Might forget to record!
   ```

3. **Use getSummary for statistics**
   ```javascript
   // ✅ Good - Use calculated summary
   const summary = tracker.getSummary();
   console.log(`Accuracy: ${summary.accuracy * 100}%`);

   // ❌ Bad - Manual calculation (error-prone)
   const correct = attempts.filter(a => a.correct).length;
   const accuracy = correct / attempts.length;
   ```

4. **Include timestamp in attempts**
   ```javascript
   tracker.recordAttempt({
     // ... other fields ...
     timestamp: Date.now()  // Always include!
   });
   ```

5. **Check session exists before recording**
   ```javascript
   if (!tracker.getSessionId()) {
     console.error('No session active!');
     tracker.startSession();
   }
   tracker.recordAttempt(attemptData);
   ```

## Status: POC Implementation

This helper is currently a **proof of concept**:

**Current:**
- In-memory storage
- Console logging only
- No persistence
- Local session only

**Production Needs:**
- Backend synchronization
- localStorage backup
- Offline queue
- Error recovery
- Session resumption
- Cross-device support

## Related Documentation

- [API Helper](./api-helper.md) - Backend communication
- [Case Converter](./case-converter.md) - Data format conversion
- [Architecture](../reference/architecture.md) - Event tracking system
- [Event Tracking System](../reference/architecture.md#event-tracking-system) - Low-level event tracking
