# PART-009: Attempt Tracking

**Category:** MANDATORY | **Condition:** Every game with user answers | **Dependencies:** PART-007

---

## Code

```javascript
function recordAttempt(data) {
  const attempt = {
    attempt_timestamp: new Date().toISOString(),
    time_since_start_of_game: (Date.now() - gameState.startTime) / 1000,
    input_of_user: data.userAnswer,
    attempt_number: gameState.attempts.length + 1,
    correct: data.correct,
    metadata: {
      round: gameState.currentRound,
      question: data.question,
      correctAnswer: data.correctAnswer,
      validationType: data.validationType || 'fixed'
    }
  };

  gameState.attempts.push(attempt);
  gameState.duration_data.attempts.push({
    startTime: new Date().toISOString(),
    time_to_first_attempt: (Date.now() - gameState.startTime) / 1000,
    duration: 0
  });

  console.log('Attempt:', JSON.stringify(attempt, null, 2));
}
```

## Placement

Global scope function (RULE-001). Called from game-specific answer handler.

## Mandatory Fields

| Field | Type | Description |
|-------|------|-------------|
| `attempt_timestamp` | string (ISO) | When attempt was made |
| `time_since_start_of_game` | number | Seconds from game start |
| `input_of_user` | any | What user submitted (any structure) |
| `attempt_number` | number | Sequential: 1, 2, 3... |
| `correct` | boolean | Whether answer was correct |
| `metadata.round` | number | Current round number |
| `metadata.question` | string/any | The question content |
| `metadata.correctAnswer` | any | The correct answer |
| `metadata.validationType` | string | 'fixed', 'function', or 'llm' |

## Usage

```javascript
// Call from game-specific answer handler:
recordAttempt({
  userAnswer: selectedOption,
  correct: isCorrect,
  question: currentQuestion.text,
  correctAnswer: currentQuestion.answer,
  validationType: 'fixed'
});
```

## Contract

Must conform to `contracts/attempt.schema.json`.

## Verification

- [ ] `recordAttempt` function exists in global scope
- [ ] Creates attempt object with all mandatory fields
- [ ] Pushes to `gameState.attempts`
- [ ] Pushes to `gameState.duration_data.attempts`
- [ ] Logs attempt with `JSON.stringify`
- [ ] `attempt_number` increments correctly
