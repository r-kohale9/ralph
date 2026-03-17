# PART-015: Validation — LLM Subjective

**Category:** CONDITIONAL | **Condition:** Open-ended answers requiring AI evaluation | **Dependencies:** PART-003

---

## Code

```javascript
async function validateAnswerLLM(userAnswer, question, rubric) {
  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      question: question,
      answer: userAnswer,
      rubric: rubric
    });
    return result;
  } catch (error) {
    console.error('LLM validation error:', JSON.stringify({ error: error.message }, null, 2));
    return { correct: false, feedback: 'Evaluation failed. Please try again.' };
  }
}
```

## When to Use

- "Explain why 12 is divisible by 3"
- "Describe the pattern you see"
- Any open-ended question where correctness can't be checked by string/function

## Rules

- Access via `MathAIHelpers.SubjectiveEvaluation.evaluate()` (NOT as standalone import)
- Always async with try/catch (RULE-002, RULE-003)
- Show loading state while evaluating (spinner, "Evaluating..." text)
- Must include `rubric` for consistent evaluation
- Returns `{ correct: boolean, feedback: string }`

## Loading State Pattern

```javascript
async function handleSubmitAnswer() {
  const answer = document.getElementById('answer-input').value;
  document.getElementById('submit-btn').disabled = true;
  document.getElementById('loading-indicator').style.display = 'block';

  const result = await validateAnswerLLM(answer, currentQuestion, currentRubric);

  document.getElementById('loading-indicator').style.display = 'none';
  document.getElementById('submit-btn').disabled = false;

  recordAttempt({
    userAnswer: answer,
    correct: result.correct,
    question: currentQuestion,
    correctAnswer: currentRubric,
    validationType: 'llm'
  });
}
```

## Verification

- [ ] `validateAnswerLLM` function exists (async)
- [ ] Uses `MathAIHelpers.SubjectiveEvaluation.evaluate()`
- [ ] Wrapped in try/catch
- [ ] Returns fallback on error
- [ ] Loading state shown during evaluation
- [ ] `rubric` provided for each question

## Deep Reference

`mathai-game-builder/workflows/checklists/subjective-evaluation.md`
