# Eval: Subjective Evaluation

## Version

v1 — 2026-04-20 — initial cases covering API shape, loading order, loading states, error handling, anti-patterns, prompt quality.

## Setup

Context files that must be loaded before running:

- `skills/subjective-evaluation/SKILL.md`
- `skills/subjective-evaluation/reference/api.md`
- `skills/subjective-evaluation/reference/prompts.md`
- `skills/feedback/SKILL.md` (audio feedback integration)
- `skills/data-contract/SKILL.md` (`recordAttempt` shape + `validationType: 'llm'`)
- `warehouse/parts/PART-015-validation-llm.md` (canonical PART)

## Success Criteria

A generated game using subjective evaluation:

1. Calls `MathAIHelpers.SubjectiveEvaluation.evaluate()` with the correct `{ components: [...] }` shape.
2. Loads the three packages in the mandatory order (FeedbackManager → Components → Helpers).
3. Button is disabled during evaluation and re-enabled on every exit path.
4. Errors do not leave the UI in a stuck state.
5. `recordAttempt` is called with `validationType: 'llm'`.

## Ship-Readiness Gate

All P0 cases must PASS. All P1 cases must PASS or PARTIAL with documented reason.

---

## Cases

### Case 1: Happy-path subjective evaluation

**Priority:** P0
**Type:** happy-path
**Judge:** auto + llm
**Input:** Spec: "One open-ended question: 'What do you know about variables?' Rubric: accept partial explanations; reject irrelevant answers."
**Expect:**
- [ ] HTML loads `feedback-manager/index.js`, then `components/index.js`, then `helpers/index.js` in that order
- [ ] HTML contains `await MathAIHelpers.SubjectiveEvaluation.evaluate(`
- [ ] The `evaluate()` call wraps its arguments in `{ components: [ ... ] }`
- [ ] Each component has both `component_id` and `evaluation_prompt`
- [ ] A `<textarea>` and a submit `<button>` exist in the play area
- [ ] [LLM] The `evaluation_prompt` interpolates the question text and the student answer
- [ ] [LLM] The `evaluation_prompt` specifies an allowed output vocabulary (e.g. "correct / incorrect / idk")
**Why:** Confirms the core API shape + package order is correct for the standard case.

### Case 2: Flat-parameter anti-shape must not be generated

**Priority:** P0
**Type:** negative
**Judge:** auto
**Input:** Same spec as Case 1.
**Expect:**
- [ ] HTML does NOT contain `evaluate({ question:` (anti-pattern: flat params)
- [ ] HTML does NOT contain `evaluate({ answer:` at the top level
- [ ] HTML does NOT contain a `<script src` ending in `/subjective-evaluation/index.js` (standalone script does not exist)
- [ ] HTML does NOT call `subjectiveEvaluation(` as a bare global (must be `MathAIHelpers.SubjectiveEvaluation.evaluate`)
**Why:** The model's prior training contains hallucinated API shapes; this case catches regressions.

### Case 3: Loading states and button re-enable

**Priority:** P0
**Type:** edge-case
**Judge:** auto + llm
**Input:** Same spec as Case 1, plus: "student may submit multiple times, must not double-submit."
**Expect:**
- [ ] Submit button is disabled (`submitBtn.disabled = true`) before the `evaluate()` call
- [ ] Button is re-enabled on the success path
- [ ] Button is re-enabled inside a `catch` block on the error path
- [ ] Button is re-enabled after audio feedback playback (success and error)
- [ ] [LLM] Button text transitions through at least: "Evaluating..." → "Submit Answer"
- [ ] No code path leaves the button disabled (verify: every branch out of the submit handler flips `disabled = false`)
**Why:** The most common production bug — button stuck on "Evaluating..." after a network error.

### Case 4: Error handling with fallback

**Priority:** P0
**Type:** error-handling
**Judge:** auto
**Input:** Same spec as Case 1.
**Expect:**
- [ ] The `evaluate()` call is inside a `try { ... } catch` block
- [ ] The `catch` block returns or sets a fallback (e.g., `{ correct: false, feedback: 'Evaluation failed...' }`)
- [ ] The `catch` block re-enables the submit button
- [ ] Input is validated with `answer.trim()` (or equivalent) and rejected if empty BEFORE calling `evaluate()`
- [ ] [LLM] Error path does not crash the round — game can continue or retry
**Why:** RULE-002/003 compliance; prevents silent stuck games.

### Case 5: recordAttempt wiring and data contract

**Priority:** P0
**Type:** cross-skill
**Judge:** auto
**Input:** Same spec as Case 1.
**Expect:**
- [ ] `recordAttempt(` is called after evaluation completes
- [ ] The call includes `validationType: 'llm'` (not `'subjective'`, not `'ai'`)
- [ ] The call includes `userAnswer`, `correct`, `question`, `evaluation`, `feedback` fields
- [ ] `correct` is derived from `result.evaluation` (boolean), not hardcoded
**Why:** Gauge and analytics filter LLM rounds by `validationType`; wrong value breaks downstream queries.

### Case 6: Feedback prompt uses only `{{evaluation}}`

**Priority:** P1
**Type:** edge-case
**Judge:** auto + llm
**Input:** Spec with a feedback_prompt that the model is tempted to parameterize with `{{student_answer}}`.
**Expect:**
- [ ] `feedback_prompt` (if present) contains `{{evaluation}}`
- [ ] `feedback_prompt` does NOT contain `{{student_answer}}`, `{{question}}`, `{{answer}}`, or other invented placeholders (any such token inside `feedback_prompt` is a literal string, not a variable)
- [ ] Any question/answer values inside `feedback_prompt` are interpolated at code-generation time with template literals (backticks), not `{{...}}`
- [ ] [LLM] Feedback prompt instructs the model not to reveal the correct answer
**Why:** `{{evaluation}}` is the only variable the API substitutes; hallucinated placeholders appear as literal `{{student_answer}}` text in the LLM output.

### Case 7: Audio feedback via FeedbackManager (no Promise.race)

**Priority:** P1
**Type:** cross-skill
**Judge:** auto
**Input:** Spec: "Subjective question with spoken feedback."
**Expect:**
- [ ] Audio feedback uses `FeedbackManager.playDynamicFeedback(` (not `new Audio(`, not direct `fetch` to `/generate-audio`)
- [ ] The call includes `audio_content` AND `subtitle` fields
- [ ] The `playDynamicFeedback` call is NOT wrapped in `Promise.race` or a custom `audioRace` helper (feedback skill constraint 8)
- [ ] Audio failure is handled with a plain `try { await ... } catch {}` and does not block round advancement
**Why:** Cross-skill integration with feedback skill; validator rule `5e0-FEEDBACK-RACE-FORBIDDEN`.

### Case 8: Empty input guard

**Priority:** P1
**Type:** edge-case
**Judge:** auto
**Input:** Same spec as Case 1.
**Expect:**
- [ ] Submit handler trims the answer: `const answer = input.value.trim()`
- [ ] If trimmed answer is empty, the handler returns early and does NOT call `evaluate()`
- [ ] User gets a visible indication (alert, inline message, or disabled submit) that empty input is rejected
**Why:** An empty API call wastes an LLM request and produces nonsense evaluation text.

### Case 9: Should reject subjective evaluation when a fixed answer exists

**Priority:** P1
**Type:** negative
**Judge:** llm
**Input:** Spec: "Question 'What is 5 + 7?'. Answer: 12. Evaluate the student answer."
**Expect:**
- [ ] [LLM] Skill recognizes this is a fixed-answer question and refuses to use subjective evaluation
- [ ] [LLM] Skill routes to PART-013 (fixed answer) or PART-014 (function) instead
- [ ] Generated HTML does NOT call `MathAIHelpers.SubjectiveEvaluation.evaluate()` for the 5+7 question
**Why:** Subjective evaluation is slower and non-deterministic; it must not be used when a deterministic check works.

### Case 10: waitForPackages guards init

**Priority:** P1
**Type:** edge-case
**Judge:** auto
**Input:** Same spec as Case 1.
**Expect:**
- [ ] A `waitForPackages` (or equivalent) async function exists that awaits `FeedbackManager` and `MathAIHelpers.SubjectiveEvaluation` being defined
- [ ] The `DOMContentLoaded` handler awaits `waitForPackages()` BEFORE calling `FeedbackManager.init()`
- [ ] The `DOMContentLoaded` handler does not reference `MathAIHelpers.SubjectiveEvaluation` synchronously
**Why:** Script tags load asynchronously; without the wait, `MathAIHelpers` may be undefined at init time.
