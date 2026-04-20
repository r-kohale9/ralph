# Subjective Evaluation — API Reference

**MANDATORY:** Read this during code generation. Without it, URLs and parameter names will be hallucinated and fail at runtime.

## Package URLs (exact — no variations)

Load in this exact order in `<head>`:

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

`SubjectiveEvaluation` is bundled inside the Helpers package. There is **no** standalone `subjective-evaluation/index.js` script URL.

## Access path

```javascript
MathAIHelpers.SubjectiveEvaluation.evaluate(options)
```

The `subjectiveEvaluation(...)` global does **not** exist. Always use the `MathAIHelpers` namespace.

## `evaluate(options)` parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `components` | `Array<Component>` | Yes | One entry per evaluation target. At least one. |
| `components[].component_id` | `string` | Yes | Unique ID for this evaluation. Example: `'q_1'`, `'q_' + gameState.currentRound`. |
| `components[].evaluation_prompt` | `string` | Yes | Prompt describing what to evaluate. Must embed the question, the student answer, and the rubric. |
| `components[].feedback_prompt` | `string` | No | Prompt to produce student-facing feedback. Use `{{evaluation}}` to reference the evaluation result. |
| `onStart` | `function` | No | Fired when the request starts. |
| `onProgress` | `(componentResult) => void` | No | Fired for each component as it completes. |
| `onComplete` | `(response) => void` | No | Fired once on success with the full response. |
| `onError` | `(error) => void` | No | Fired once on failure. |
| `timeout` | `number` | No | Milliseconds before the request is aborted. Default `30000`. |

## Return shape

```typescript
{
  success: boolean,
  data: [
    {
      component_id: string,
      evaluation: string,   // e.g. "correct", "incorrect", "partially correct"
      feedback: string      // only populated if feedback_prompt was provided
    }
  ]
}
```

- `evaluation` — whatever vocabulary your prompt asks for. If the prompt says "return one of correct/incorrect/gibberish/idk", that is what comes back.
- `feedback` — missing/empty string when `feedback_prompt` was not supplied.

## Deriving `correct: boolean` from `evaluation`

The API returns free text, not a boolean. Your wrapper must derive correctness based on the rubric vocabulary:

```javascript
// Standard rubric ("correct" / "incorrect" / "partially correct")
const isCorrect = evaluation.toLowerCase().includes('correct')
  && !evaluation.toLowerCase().includes('incorrect');

// Custom rubric (e.g. correct / incorrect / gibberish / idk)
const isCorrect = evaluation.toLowerCase().trim() === 'correct';
```

## Canonical wrapper (PART-015)

```javascript
async function validateAnswerLLM(userAnswer, question, rubric) {
  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [{
        component_id: 'q_' + gameState.currentRound,
        evaluation_prompt: `Question: "${question}"\nStudent answer: "${userAnswer}"\nRubric: ${rubric}\n\nEvaluate whether the answer is correct, partially correct, or incorrect.`,
        feedback_prompt: 'Based on {{evaluation}}, provide short constructive feedback for the student.'
      }],
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
    console.error('LLM validation error:', JSON.stringify({ error: error.message }));
    return { correct: false, evaluation: '', feedback: 'Evaluation failed. Please try again.' };
  }
}
```

## Canonical submit handler (with all 5 loading states)

```javascript
async function handleSubmitAnswer() {
  const answer = document.getElementById('answer-input').value.trim();
  if (!answer) {
    alert('Please enter an answer');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  submitBtn.disabled = true;           // State 2
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

    if (result.feedback) {
      btnText.textContent = 'Generating Audio...';   // State 3
      try {
        btnText.textContent = 'Playing Feedback...'; // State 4
        await FeedbackManager.playDynamicFeedback({
          audio_content: result.feedback,
          subtitle: result.feedback
        });
      } catch (audioErr) {
        console.error('Feedback audio error:', audioErr);
        // Non-blocking — continue
      }
    }
  } catch (error) {
    console.error('Submission error:', error);
  } finally {
    submitBtn.disabled = false;                      // State 5
    btnText.textContent = 'Submit Answer';
  }
}
```

## Loading order — why it matters

| If you load … | What happens |
|---------------|--------------|
| Components before FeedbackManager | Components tries to register SubtitleComponent again → duplicate-registration error |
| Helpers before Components | `MathAIHelpers.SubjectiveEvaluation` is undefined (Helpers depends on Components) |
| Any order, but reference `MathAIHelpers` synchronously in `DOMContentLoaded` | Race: scripts are async; global may not exist yet → use `waitForPackages()` |

## `waitForPackages` helper

```javascript
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
  while (typeof MathAIHelpers === 'undefined' || !MathAIHelpers.SubjectiveEvaluation) {
    await new Promise(r => setTimeout(r, 50));
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init({ sound: { sounds: [] }, stream: { streams: [] } });
});
```

## Underlying endpoints (informational — do NOT call directly)

The Helpers package talks to:

- Evaluation: `https://asia-south1-mathai-449208.cloudfunctions.net/subjective-evaluation`
- TTS (used internally by `playDynamicFeedback`): `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text={text}`

Never `fetch()` these directly from the game. Always go through `MathAIHelpers.SubjectiveEvaluation.evaluate()` and `FeedbackManager.playDynamicFeedback()`.

## Minimum verification checklist

- [ ] All three scripts loaded in order (FeedbackManager → Components → Helpers)
- [ ] `waitForPackages()` awaits before `FeedbackManager.init()`
- [ ] `MathAIHelpers.SubjectiveEvaluation.evaluate` exists at runtime (console check)
- [ ] Call wraps `components: [...]` array (never flat parameters)
- [ ] Every component has `component_id` + `evaluation_prompt`
- [ ] `feedback_prompt`, if present, uses only `{{evaluation}}` as a variable
- [ ] Call wrapped in try/catch with fallback return
- [ ] Button disabled immediately on submit, re-enabled on all exit paths (success/no-feedback/error/audio-error)
- [ ] Input trimmed and non-empty before API call
- [ ] `recordAttempt` called with `validationType: 'llm'` + evaluation + feedback fields
- [ ] Audio feedback uses `FeedbackManager.playDynamicFeedback()` (not `new Audio()`, not direct `fetch` to TTS)
