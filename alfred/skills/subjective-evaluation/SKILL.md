# Skill: Subjective Evaluation

## Purpose

Generate games with **open-ended, AI-evaluated answers** (textarea-style questions such as "Explain what a variable is") by wiring up `MathAIHelpers.SubjectiveEvaluation.evaluate()` with the correct package load order, prompt shape, loading states, and error handling.

## When to use

Every time a spec calls for a question whose correctness cannot be checked by a string compare, numeric compare, set match, or rule function — i.e. any open-ended response requiring AI judgment.

**Use when:**
- Question type is free-text explanation, reasoning, or description
- Spec describes answers evaluated on a rubric rather than a fixed key
- Interaction pattern is P7 textarea (Subjective variant)

**Do NOT use for:**
- MCQ / tap-select — use PART-013 (fixed answer)
- Numeric input with a known value — use PART-013
- Rule-based validation ("any even number", "sum ≥ 10") — use PART-014 (function)
- True/false questions — use PART-013

## Owner

Maintainer: **Gen Quality slot** (reviews prompt rules, API shape, validator coverage) + **Education slot** (reviews evaluation rubrics and feedback tone).
Deletion trigger: retire when `MathAIHelpers.SubjectiveEvaluation` is replaced by a new evaluation API.

## Reads

- `warehouse/parts/PART-015-validation-llm.md` — canonical PART spec (code + verification) — **ALWAYS**
- `warehouse/packages/helpers/subjective-evaluation/usage.html` — working reference implementation — **ON-DEMAND**
- `warehouse/mathai-game-builder/workflows/checklists/subjective-evaluation.md` — full integration checklist (deep reference) — **ON-DEMAND**
- `skills/feedback/SKILL.md` — audio feedback integration for evaluation results — **ALWAYS** (if feedback_prompt is used)
- `skills/interaction/SKILL.md` — P7 textarea pattern — **ON-DEMAND**
- `skills/data-contract/SKILL.md` — `recordAttempt` shape for LLM validation — **ALWAYS**
- `reference/api.md` — full API parameter table + response shape + package URLs — **ALWAYS during code generation**
- `reference/prompts.md` — how to write evaluation_prompt and feedback_prompt — **ALWAYS during code generation**

## Input

- Game spec indicating subjective question(s) with rubric/criteria
- Bloom level (affects feedback tone — see `skills/pedagogy/SKILL.md`)
- Question text + criteria for correct / incorrect / gibberish / idk (if applicable)

## Output

Generated HTML includes:
1. Correct package load order (FeedbackManager → Components → Helpers)
2. `validateAnswerLLM(userAnswer, question, rubric)` async function
3. Textarea + submit button with 5 loading states
4. `recordAttempt` call with `validationType: 'llm'` and evaluation/feedback fields
5. Optional audio feedback via `FeedbackManager.playDynamicFeedback()`
6. Try/catch with graceful fallback, button always re-enabled

---

## Procedure

### Step 1 — Confirm spec requires subjective evaluation

Check the spec. If the answer type is anything other than free-text-needs-AI-judgment, STOP and use the correct PART (013 fixed / 014 function). Never use subjective evaluation for questions that have a deterministic answer — it costs an LLM call and is non-deterministic.

### Step 2 — Load packages in the mandatory order

The three scripts MUST load in this exact order. Helpers depends on Components which depends on FeedbackManager.

```html
<!-- 1. FeedbackManager — MUST be first -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components — MUST be second -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers — MUST be third (contains SubjectiveEvaluation) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**Access path:** `MathAIHelpers.SubjectiveEvaluation.evaluate()` — only via the `MathAIHelpers` namespace. There is no standalone `subjectiveEvaluation()` global.

### Step 3 — Wait for packages before initializing

Script tags load asynchronously. Use `waitForPackages()` before touching `FeedbackManager.init()` or `MathAIHelpers.SubjectiveEvaluation`:

```javascript
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof MathAIHelpers === 'undefined' || !MathAIHelpers.SubjectiveEvaluation) {
    await new Promise(r => setTimeout(r, 50));
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init({ sound: { sounds: [] }, stream: { streams: [] } });
});
```

### Step 4 — Build the textarea + button

Use P7 textarea (interaction skill). Button must have a spinner child so loading state is visible:

```html
<textarea id="answer-input" placeholder="Type your answer..."></textarea>
<button class="submit-btn" id="submit-btn">
  <span class="spinner"></span>
  <span id="btn-text">Submit Answer</span>
</button>
```

### Step 5 — Write the `validateAnswerLLM` wrapper

Use exactly this shape (from PART-015). Do not invent alternate parameters:

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

### Step 6 — Wire the submit handler with 5 loading states

| State | Button | Text |
|-------|--------|------|
| 1. Idle | enabled | "Submit Answer" |
| 2. Evaluating | disabled | "Evaluating..." |
| 3. Generating audio | disabled | "Generating Audio..." |
| 4. Playing feedback | disabled | "Playing Feedback..." |
| 5. Complete / error | enabled | "Submit Answer" |

Every exit path — success, no-feedback, error — must return to State 5. See `reference/api.md` for the full handler template.

### Step 7 — Call `recordAttempt` with LLM-specific fields

```javascript
recordAttempt({
  userAnswer: answer,
  correct: result.correct,
  question: currentQuestion,
  correctAnswer: currentRubric,
  validationType: 'llm',
  evaluation: result.evaluation,
  feedback: result.feedback
});
```

`validationType: 'llm'` is how the data contract distinguishes AI-evaluated rounds from fixed/function validation — gauge and analytics depend on it. See `skills/data-contract/SKILL.md`.

### Step 8 — Play feedback audio (optional)

If `result.feedback` is non-empty and the game uses audio:

```javascript
if (result.feedback) {
  btnText.textContent = 'Playing Feedback...';
  try {
    await FeedbackManager.playDynamicFeedback({
      audio_content: result.feedback,
      subtitle: result.feedback
    });
  } catch (e) { /* non-blocking — feedback.md constraint 8 */ }
}
```

Follow `skills/feedback/SKILL.md` constraint 8: audio failure is non-blocking; wrap in plain try/catch, never `Promise.race`.

### Step 9 — Verify

Run the checklist in `warehouse/parts/PART-015-validation-llm.md` § Verification. Every item must pass before the game is considered complete.

---

## Constraints

1. **CRITICAL — `components` array is mandatory.** `MathAIHelpers.SubjectiveEvaluation.evaluate()` takes `{ components: [...] }`. Passing `{ question, answer, rubric }` at the top level is a hallucinated shape and will fail at runtime.
   - ✅ `evaluate({ components: [{ component_id, evaluation_prompt }], timeout: 30000 })`
   - ❌ `evaluate({ question, answer, rubric })`
   - ❌ `evaluate({ component_id: 'q1', evaluation_prompt: '...' })` (missing array wrapper)

2. **CRITICAL — Access only via `MathAIHelpers` namespace.** There is no standalone `subjectiveEvaluation()` global and no standalone script URL.
   - ✅ `await MathAIHelpers.SubjectiveEvaluation.evaluate({...})`
   - ❌ `<script src=".../subjective-evaluation/index.js">` (does not exist)
   - ❌ `await subjectiveEvaluation({...})`

3. **CRITICAL — Package load order: FeedbackManager → Components → Helpers.** Helpers reads from Components which reads from FeedbackManager. Wrong order = `MathAIHelpers.SubjectiveEvaluation is undefined`.

4. **CRITICAL — Button must always re-enable.** On success, no-feedback path, API error, audio error — every branch ends with `submitBtn.disabled = false` and `btnText.textContent = 'Submit Answer'`. A stuck "Evaluating..." button is a P0 bug.

5. **CRITICAL — Try/catch required.** The API is a network call; it can time out or fail. Per RULE-002/003, every async call to `evaluate()` is wrapped in try/catch with a fallback return.

6. **CRITICAL — Validate empty input before API call.** `answer.trim() === ''` → show message, do not call the API. Wastes an LLM call and produces nonsense evaluation.

7. **STANDARD — Timeout: 30000ms (30s).** Default is correct for evaluation. Shorter truncates normal responses; longer makes failures feel broken.

8. **STANDARD — Use `{{evaluation}}` in `feedback_prompt`.** This is the ONLY variable the feedback prompt can reference. Do not invent `{{answer}}`, `{{question}}`, etc.

9. **STANDARD — Evaluation prompt must embed question, answer, and rubric.** The API does not know them otherwise. Template-interpolate them into the prompt string.

10. **STANDARD — `recordAttempt` uses `validationType: 'llm'`.** Not `'subjective'`, not `'ai'`. The data contract specifies `'llm'`.

11. **STANDARD — Use `FeedbackManager.playDynamicFeedback()` for feedback audio.** Do not call `new Audio()` or hit the TTS endpoint directly — `playDynamicFeedback` handles caching, streaming, subtitles, and stop-on-tap.

12. **ADVISORY — Prefer deterministic validation when possible.** If the question can be answered with a keyword match or range check, use PART-013/014. Subjective evaluation is slower, costs an LLM call, and introduces judgment variance.

## Defaults

- **`timeout`:** 30000 (30s)
- **`component_id`:** `'q_' + gameState.currentRound` (or `'q1'` for single-question games)
- **`feedback_prompt`:** present by default — students benefit from contextual feedback on open-ended answers
- **Audio feedback:** enabled when `result.feedback` is non-empty AND the game has audio capability (per archetype)
- **Loading text sequence:** `Submit Answer → Evaluating... → Generating Audio... → Playing Feedback... → Submit Answer`
- **Correctness derivation:** `evaluation.toLowerCase().includes('correct') && !evaluation.toLowerCase().includes('incorrect')` — used unless the rubric returns a different vocabulary (e.g., "correct / incorrect / gibberish / idk" — then derive explicitly)

## Anti-patterns

1. **Calling with flat top-level fields.**
   ```javascript
   // ❌ WRONG — throws or returns undefined
   await MathAIHelpers.SubjectiveEvaluation.evaluate({
     question, answer: userAnswer, rubric
   });
   ```

2. **Loading a standalone subjective-evaluation script.**
   ```html
   <!-- ❌ WRONG — this URL does not exist -->
   <script src=".../packages/helpers/subjective-evaluation/index.js"></script>
   ```

3. **No loading state.** Button stays enabled while API is in-flight → student double-submits → two concurrent evaluations → inconsistent state.

4. **Button not re-enabled on error.** `catch` logs the error but forgets `submitBtn.disabled = false` → game is permanently stuck.

5. **No try/catch around `evaluate()`.** Network blip throws an unhandled promise rejection, round never completes.

6. **Calling the API with empty input.** Wastes a call and the model produces nonsense. Always `answer.trim() === ''` guard first.

7. **Wrapping `playDynamicFeedback` in `Promise.race`.** Violates `skills/feedback/SKILL.md` constraint 8 and trips validator `5e0-FEEDBACK-RACE-FORBIDDEN`. Use plain `try { await ... } catch {}`.

8. **Hardcoding evaluation logic locally.** If the spec's rubric changes, the game must be rebuilt. Always route through the API.

9. **Skipping `recordAttempt` because "there's no right answer".** Gauge needs every attempt logged, including LLM-judged ones. Use `validationType: 'llm'`.

10. **Using `{{student_answer}}`, `{{question}}`, or other invented placeholders in `feedback_prompt`.** Only `{{evaluation}}` is substituted.

11. **Changing package load order to "fix" a lottie error.** The order is fixed. If lottie double-registers, it is a package bug, not a skill bug.
