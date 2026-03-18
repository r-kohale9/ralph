# PART-015: Validation — LLM Subjective

**Category:** CONDITIONAL | **Condition:** Open-ended answers requiring AI evaluation | **Dependencies:** PART-003

---

## Code

```javascript
async function validateAnswerLLM(userAnswer, question, rubric) {
  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [
        {
          component_id: 'q_' + gameState.currentRound,
          evaluation_prompt: `Question: "${question}"\nStudent answer: "${userAnswer}"\nRubric: ${rubric}\n\nEvaluate whether the answer is correct, partially correct, or incorrect.`,
          feedback_prompt: 'Based on {{evaluation}}, provide short constructive feedback for the student.'
        }
      ],
      timeout: 30000
    });

    const componentResult = result.data[0];
    const isCorrect = componentResult.evaluation?.toLowerCase().includes('correct')
      && !componentResult.evaluation?.toLowerCase().includes('incorrect');

    return {
      correct: isCorrect,
      evaluation: componentResult.evaluation,
      feedback: componentResult.feedback || ''
    };
  } catch (error) {
    console.error('LLM validation error:', JSON.stringify({ error: error.message }, null, 2));
    return { correct: false, evaluation: '', feedback: 'Evaluation failed. Please try again.' };
  }
}
```

## API Reference

**Access:** `MathAIHelpers.SubjectiveEvaluation.evaluate()` (loaded via Helpers package)

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `components` | array | Yes | Array of component objects to evaluate |
| `components[].component_id` | string | Yes | Unique ID for this evaluation component |
| `components[].evaluation_prompt` | string | Yes | Prompt describing what to evaluate |
| `components[].feedback_prompt` | string | No | Prompt to generate feedback. Use `{{evaluation}}` to reference the evaluation result |
| `onStart` | function | No | Called when request starts |
| `onProgress` | function | No | Called with each component result |
| `onComplete` | function | No | Called with full response on success |
| `onError` | function | No | Called with error object on failure |
| `timeout` | number | No | Timeout in ms (default: 30000) |

**Returns:** `{ data: [{ evaluation: string, feedback: string }] }`

- `evaluation` — the AI's evaluation of the answer
- `feedback` — constructive feedback (only if `feedback_prompt` was provided)

## When to Use

- "Explain why 12 is divisible by 3"
- "Describe the pattern you see"
- Any open-ended question where correctness can't be checked by string/function

## Loading State Pattern

```javascript
async function handleSubmitAnswer() {
  const answer = document.getElementById('answer-input').value.trim();
  if (!answer) return;

  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  submitBtn.disabled = true;
  btnText.textContent = 'Evaluating...';

  try {
    const result = await validateAnswerLLM(answer, currentQuestion, currentRubric);

    recordAttempt({
      userAnswer: answer,
      correct: result.correct,
      question: currentQuestion,
      correctAnswer: currentRubric,
      validationType: 'llm',
      evaluation: result.evaluation,
      feedback: result.feedback
    });

    // Optional: Play audio feedback with the AI's feedback text
    if (result.feedback) {
      btnText.textContent = 'Playing Feedback...';
      await FeedbackManager.playDynamicFeedback({
        audio_content: result.feedback,
        subtitle: result.feedback
      });
    }
  } catch (error) {
    console.error('Submission error:', JSON.stringify({ error: error.message }, null, 2));
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Submit Answer';
  }
}
```

## Rules

- Access via `MathAIHelpers.SubjectiveEvaluation.evaluate()` (from Helpers package)
- Always async with try/catch (RULE-002, RULE-003)
- Show loading state while evaluating (disable button, show "Evaluating..." text)
- Must include clear `evaluation_prompt` with the question, answer, and rubric
- Use `feedback_prompt` with `{{evaluation}}` variable for constructive feedback
- Always re-enable submit button on completion AND on error
- Validate input is not empty before calling the API

## Anti-Patterns

```javascript
// WRONG — This API shape does not exist
await MathAIHelpers.SubjectiveEvaluation.evaluate({
  question: question,
  answer: userAnswer,
  rubric: rubric
});

// WRONG — Missing components array wrapper
await MathAIHelpers.SubjectiveEvaluation.evaluate({
  component_id: 'q1',
  evaluation_prompt: '...'
});

// CORRECT — components array with component_id + evaluation_prompt
await MathAIHelpers.SubjectiveEvaluation.evaluate({
  components: [
    { component_id: 'q1', evaluation_prompt: '...', feedback_prompt: '...' }
  ],
  timeout: 30000
});
```

## Verification

- [ ] `validateAnswerLLM` function exists (async)
- [ ] Uses `MathAIHelpers.SubjectiveEvaluation.evaluate()` with `components` array
- [ ] Each component has `component_id` and `evaluation_prompt`
- [ ] Wrapped in try/catch
- [ ] Returns fallback on error
- [ ] Loading state shown during evaluation (button disabled + text change)
- [ ] Button re-enabled on both success and error
- [ ] Input validated (not empty) before API call

## Deep Reference

`mathai-game-builder/workflows/checklists/subjective-evaluation.md`
