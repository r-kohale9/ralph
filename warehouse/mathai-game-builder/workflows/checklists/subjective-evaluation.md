# Subjective Evaluation Integration Checklist

## When to Use

Use subjective evaluation when questions have no fixed answer and require AI-powered evaluation (e.g., "Explain what variables are", "Describe your approach").

**DO NOT use for:**
- Fixed answer questions (use regular validation)
- Multiple choice questions
- True/false questions
- Numeric answer questions

## Prerequisites

- [ ] Phase 1 completed (packages loaded, FeedbackManager initialized)
- [ ] Question type is subjective (open-ended, no fixed answer)
- [ ] User provides textarea or text input for answer

## Critical Rules

⚠️ **Package Loading Order (MANDATORY):**

SubjectiveEvaluation is **ONLY available via Helpers package**. Do NOT use standalone script.

```html
<!-- 1. FeedbackManager MUST load first -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load second -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load third (includes SubjectiveEvaluation) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

<script>
  // Access via MathAIHelpers namespace
  await MathAIHelpers.SubjectiveEvaluation.evaluate({ ... });
</script>
```

❌ **NEVER use standalone subjective-evaluation script:**
```html
<!-- ❌ WRONG - This script does not exist -->
<script src=".../subjective-evaluation/index.js"></script>
```

⚠️ **API Endpoints (ONLY THESE):**

- **Subjective Evaluation:** `https://asia-south1-mathai-449208.cloudfunctions.net/subjective-evaluation`
- **TTS for Audio Feedback:** `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text={text}`

❌ **NEVER:**

- Load subjective-evaluation package before FeedbackManager
- Use custom evaluation endpoints
- Hardcode evaluation logic (always use API)
- Skip loading state management
- Forget to re-enable button after completion/error

## Implementation Checklist

### Phase 1: Setup & Package Loading

**HTML Structure:**

- [ ] Load helpers package (FeedbackManager → Components → Helpers)
- [ ] **CRITICAL:** SubjectiveEvaluation is ONLY available in Helpers package
- [ ] **CRITICAL:** Use `MathAIHelpers.SubjectiveEvaluation.evaluate()` to access
- [ ] Create textarea for user answer
- [ ] Create submit button with loading states
- [ ] Add loading spinner CSS/HTML

**Button HTML Pattern:**

```html
<button class="submit-btn" id="submit-btn">
  <span class="spinner"></span>
  <span id="btn-text">Submit Answer</span>
</button>
```

**CSS for Loading Spinner:**

```css
.spinner {
  display: none;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.submit-btn:disabled .spinner {
  display: block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Phase 2: Evaluation Logic

**🚨 CRITICAL: Prompts MUST be tailored to the specific game concept. Never ship the generic example verbatim.**

Each call to `SubjectiveEvaluation.evaluate` takes two prompts that serve very different purposes. Design them deliberately.

**⚠️ Template variables — the ONLY supported one is `{{evaluation}}`**

- `{{evaluation}}` is the sole variable the helper substitutes at runtime. It is only available in `feedback_prompt` and resolves to the label produced by `evaluation_prompt`.
- There is **NO** `{{student_answer}}`, `{{userAnswer}}`, `{{question}}`, or any other placeholder. Anything else in double-braces will be sent to the LLM as literal text.
- The student's answer (and any other dynamic context: question text, expected answer, difficulty, etc.) **must be embedded into the prompt string by your game code at call time**, using normal JavaScript string interpolation (template literals / concatenation) **before** calling `evaluate()`.

#### 2a. `evaluation_prompt` — Classification (drives UI color)

**Purpose:** Produce a **single lowercase label** that the UI uses to render visual feedback (green background for correct, red for incorrect, amber/grey for partial or gibberish). This is NOT shown to the user.

**Rules:**

- [ ] Output MUST be ONE WORD from a fixed, game-specific label set
- [ ] Instruct the LLM explicitly: "Respond with only one word: ..."
- [ ] Forbid explanations, punctuation, or extra tokens
- [ ] Keep the label set small (typically 2–4 values): e.g. `correct` / `incorrect`, or `correct` / `partial` / `incorrect` / `gibberish`
- [ ] Include the question context and correct answer(s) inside the prompt so the LLM can judge
- [ ] Embed the student's answer **via JS interpolation** (e.g. `` `Student said: "${answer}"` ``) — NOT a template placeholder
- [ ] Sanitize the interpolated answer (trim, escape embedded backticks/quotes) to avoid breaking the prompt
- [ ] Labels MUST match what the UI switch-case / CSS classes expect — agree on the set before writing CSS

**Template (build the string inline, at call time):**

```javascript
const question = "<QUESTION TEXT>";
const expected = "<EXPECTED IDEA / CORRECT ANSWER>";
const answer = answerInput.value.trim();

const evaluationPrompt = `
You are evaluating a student's response for a <GAME CONCEPT> activity.

Question: "${question}"
Expected idea / correct answer: "${expected}"
Student's answer: "${answer}"

Classify the student's answer into EXACTLY ONE of these labels:
- correct     → matches the expected idea (allow paraphrasing / synonyms)
- partial     → shows understanding but is incomplete or partly wrong
- incorrect   → a clear, on-topic but wrong answer
- gibberish   → empty, nonsense, random characters, or off-topic

Respond with ONLY the single lowercase label. No punctuation. No explanation.
`.trim();
```

Pass `evaluationPrompt` into the component: `{ component_id: "q1", evaluation_prompt: evaluationPrompt, ... }`.

**Using the label in the UI (green/red/etc.):**

```javascript
const evaluation = result.data[0].evaluation.trim().toLowerCase();

const colorMap = {
  correct:   { bg: "#d1fae5", border: "#10b981" }, // green
  partial:   { bg: "#fef3c7", border: "#f59e0b" }, // amber
  incorrect: { bg: "#fee2e2", border: "#ef4444" }, // red
  gibberish: { bg: "#e5e7eb", border: "#6b7280" }, // grey
};

answerBox.style.background = colorMap[evaluation]?.bg ?? "#e5e7eb";
answerBox.style.borderColor = colorMap[evaluation]?.border ?? "#6b7280";
answerBox.dataset.evaluation = evaluation; // for CSS hooks
```

#### 2b. `feedback_prompt` — Human text (shown + spoken via TTS)

**Purpose:** Produce natural language that is **displayed to the learner AND played aloud via dynamic audio (TTS)**. It receives the label from `evaluation_prompt` through the `{{evaluation}}` template variable so the tone can adapt.

**Rules:**

- [ ] MUST reference `{{evaluation}}` so the feedback tone aligns with the classification (celebrate on `correct`, nudge on `partial`, correct gently on `incorrect`, re-prompt on `gibberish`)
- [ ] Output is plain spoken-style prose — NO markdown, NO bullet points, NO emoji, NO code blocks (TTS will read them literally)
- [ ] Keep it short: 1–2 sentences (≈ 15–35 words) so audio stays under ~10 seconds
- [ ] Second-person voice ("you"), friendly tutor tone, age-appropriate for the learner
- [ ] Tailor wording to the game concept (reference the actual concept, not generic "answer")
- [ ] Do NOT repeat the label verbatim — translate it into encouragement / explanation
- [ ] Avoid numbers-as-digits when possible (say "three" not "3") for smoother TTS

**Template (build the string inline, at call time):**

```javascript
// `{{evaluation}}` stays as a literal placeholder — the helper substitutes it.
// `${question}` and `${answer}` are interpolated NOW by your game code.
const feedbackPrompt = `
The student is working on a <GAME CONCEPT> activity.
Question: "${question}"
Student's answer: "${answer}"
Evaluation label: {{evaluation}}

Write 1–2 short, spoken-style sentences directly to the student:
- If {{evaluation}} is "correct": celebrate briefly and reinforce the key idea.
- If {{evaluation}} is "partial": acknowledge what is right, then nudge toward what is missing.
- If {{evaluation}} is "incorrect": gently correct and hint at the right idea without giving the full answer.
- If {{evaluation}} is "gibberish": kindly ask them to try again with a real answer.

Plain prose only. No markdown, no bullets, no emojis. This text will be read aloud by text-to-speech.
`.trim();
```

> Reminder: only `{{evaluation}}` is a real template variable. `${question}` / `${answer}` are JavaScript interpolations that happen before the string is sent to the API.

**Wiring display + audio together:**

```javascript
const { evaluation, feedback } = result.data[0];

// 1. Color the answer box from evaluation label (see 2a)
applyEvaluationColor(evaluation);

// 2. Show feedback text AND speak it — same string for both
await FeedbackManager.playDynamicFeedback({
  audio_content: feedback,  // TTS reads this
  subtitle: feedback,       // visible subtitle stays in sync
});
```

#### 2c. Prompt QA checklist (per game)

- [ ] Label set in `evaluation_prompt` matches the UI color map keys exactly
- [ ] `evaluation_prompt` explicitly says "respond with only one word"
- [ ] The student's answer is embedded via **JS interpolation (`${...}`)** — NOT as a `{{...}}` placeholder
- [ ] The only `{{...}}` placeholder anywhere in either prompt is `{{evaluation}}` (inside `feedback_prompt`)
- [ ] `feedback_prompt` contains the literal string `{{evaluation}}`
- [ ] `feedback_prompt` forbids markdown / emoji (TTS-safe)
- [ ] Both prompts name the specific game concept (not generic)
- [ ] Dry-run with 4 sample answers (correct / partial / incorrect / gibberish) → each returns the right label AND TTS-safe feedback

**API Call Pattern:**

```javascript
// CRITICAL: Use MathAIHelpers namespace
const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
  components: [
    {
      component_id: "q1",
      evaluation_prompt: "Evaluation criteria...",
      feedback_prompt: "Based on {{evaluation}}, provide feedback",
    },
  ],
  onStart: () => {
    // Called when request starts
  },
  onComplete: (response) => {
    // Called when evaluation completes
    console.log(response.data[0].evaluation);
    console.log(response.data[0].feedback);
  },
  onError: (error) => {
    // Called on error
    console.error(error);
  },
  timeout: 30000, // 30 seconds
});
```

### Phase 3: Loading State Management

**Button States:**

- [ ] **State 1 (Idle):** Button enabled, text "Submit Answer"
- [ ] **State 2 (Evaluating):** Button disabled, text "Evaluating..."
- [ ] **State 3 (Generating Audio):** Button disabled, text "Generating Audio..." (if using audio)
- [ ] **State 4 (Playing):** Button disabled, text "Playing Feedback..." (if using audio)
- [ ] **State 5 (Complete):** Button enabled, text "Submit Answer"

**State Management Code:**

```javascript
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");

// State 1: Idle
submitBtn.disabled = false;
btnText.textContent = "Submit Answer";

// State 2: Evaluating
submitBtn.disabled = true;
btnText.textContent = "Evaluating...";

// State 3: Generating Audio
btnText.textContent = "Generating Audio...";

// State 4: Playing
btnText.textContent = "Playing Feedback...";

// State 5: Complete
submitBtn.disabled = false;
btnText.textContent = "Submit Answer";
```

### Phase 4: Audio Feedback Integration (Optional)

**If using audio feedback with FeedbackManager:**

- [ ] Initialize FeedbackManager before using subjective evaluation
- [ ] Get feedback text from evaluation result
- [ ] Fetch audio from TTS API
- [ ] Add stream using `FeedbackManager.stream.addFromResponse()`
- [ ] Play stream with subtitle option
- [ ] Handle complete callback to re-enable button
- [ ] Handle error callback to re-enable button

**Audio Integration Pattern:**

```javascript
// 1. Call subjective evaluation (via MathAIHelpers namespace)
const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
  components: [
    {
      component_id: "q1",
      evaluation_prompt: "...",
      feedback_prompt: "...",
    },
  ],
});

// 2. Get feedback text
const feedback = result.data[0].feedback;

// 3. Update button state
btnText.textContent = "Generating Audio...";

// 4. Play dynamic feedback (handles both cached and streaming automatically)
try {
  await FeedbackManager.playDynamicFeedback({
    audio_content: feedback,
    subtitle: feedback, // Shows text synchronized with audio
  });

  // 5. Re-enable button after feedback completes
  submitBtn.disabled = false;
  btnText.textContent = "Submit Answer";
} catch (err) {
  console.error("Feedback error:", err);
  submitBtn.disabled = false;
  btnText.textContent = "Submit Answer";
}
```

### Phase 5: Error Handling

**Input Validation:**

- [ ] Validate answer is not empty before submission
- [ ] Trim whitespace from answer
- [ ] Show user-friendly validation message
- [ ] Prevent API call for invalid input

**API Error Handling:**

- [ ] Handle network errors gracefully
- [ ] Handle timeout errors (default 30 seconds)
- [ ] Handle API response errors
- [ ] Show user-friendly error messages
- [ ] Always re-enable button on error
- [ ] Log errors to console for debugging

**Error Handling Pattern:**

```javascript
submitBtn.addEventListener("click", async function () {
  const answer = answerInput.value.trim();

  // Input validation
  if (!answer) {
    alert("Please enter an answer");
    return;
  }

  submitBtn.disabled = true;
  btnText.textContent = "Evaluating...";

  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [
        {
          component_id: "q1",
          evaluation_prompt: `Evaluate: "${answer}"`,
          feedback_prompt: "Based on {{evaluation}}, provide feedback",
        },
      ],
      timeout: 30000,
    });

    // Process result...
  } catch (error) {
    console.error("Evaluation error:", error);
    alert("Error evaluating answer. Please try again.");
    submitBtn.disabled = false;
    btnText.textContent = "Submit Answer";
  }
});
```

## Verification Checklist

### Setup Verification

- [ ] Helpers package loads without errors (FeedbackManager → Components → Helpers)
- [ ] FeedbackManager loads BEFORE Helpers package
- [ ] `MathAIHelpers.SubjectiveEvaluation.evaluate` function is available
- [ ] **VERIFY:** `MathAIHelpers` object exists in console
- [ ] **VERIFY:** `MathAIHelpers.SubjectiveEvaluation` object exists
- [ ] No console errors on page load
- [ ] Button and textarea elements exist

### Evaluation Verification

- [ ] Submit empty answer → validation message appears, API not called
- [ ] Submit valid answer → "Evaluating..." appears
- [ ] Evaluation completes in < 10 seconds
- [ ] `result.data[0].evaluation` contains evaluation text
- [ ] `result.data[0].feedback` contains feedback text (if feedback_prompt provided)
- [ ] Button re-enables after completion

### Loading State Verification

- [ ] Button shows spinner when disabled
- [ ] Button text changes through all states correctly
- [ ] Button is disabled during entire flow
- [ ] Button re-enables only after completion or error
- [ ] Loading states are visually clear to user

### Audio Feedback Verification (If Using)

- [ ] "Generating Audio..." appears after evaluation
- [ ] TTS API returns valid audio response
- [ ] Stream is added to FeedbackManager without errors
- [ ] "Playing Feedback..." appears during playback
- [ ] Audio plays correctly
- [ ] Subtitle text appears and matches feedback
- [ ] Subtitle disappears when audio completes
- [ ] Stream is removed from FeedbackManager after playback
- [ ] Button re-enables after audio completes

### Error Handling Verification

- [ ] Network error → error message appears, button re-enables
- [ ] Timeout error → error message appears, button re-enables
- [ ] API error → error message appears, button re-enables
- [ ] Audio error → fallback (alert/text), button re-enables
- [ ] All errors logged to console

### Edge Cases Verification

- [ ] Very long answer (500+ characters) → evaluates correctly
- [ ] Special characters (@#$%^&*) → evaluates correctly
- [ ] Answer with line breaks → evaluates correctly
- [ ] Multiple rapid submissions → blocked (button disabled)
- [ ] Submit during audio playback → blocked (button disabled)
- [ ] Submit with only whitespace → validation message appears

### API Endpoint Verification

- [ ] **Subjective Evaluation API:** `https://asia-south1-mathai-449208.cloudfunctions.net/subjective-evaluation`
- [ ] **TTS API:** `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio`
- [ ] **NO custom endpoints used**
- [ ] **NO placeholder/fabricated URLs**

## Anti-Patterns

```javascript
// ❌ WRONG - Using standalone subjective-evaluation script (does not exist)
<script src=".../subjective-evaluation/index.js"></script>

// ❌ WRONG - Calling subjectiveEvaluation directly (must use namespace)
const result = await subjectiveEvaluation({ ... }); // Wrong!

// ❌ WRONG - Not handling loading states
submitBtn.addEventListener('click', async function() {
  const result = await subjectiveEvaluation({ ... });
  // Button never disabled, no loading indication
});

// ❌ WRONG - Not re-enabling button on error
try {
  const result = await subjectiveEvaluation({ ... });
} catch (error) {
  console.error(error);
  // Button stays disabled forever
}

// ❌ WRONG - Using wrong API endpoint
fetch('/api/evaluate'); // Wrong!

// ❌ WRONG - No input validation
submitBtn.addEventListener('click', async function() {
  const answer = answerInput.value; // No trim, no validation
  const result = await subjectiveEvaluation({ ... });
});

// ❌ WRONG - Not cleaning up stream after playback
FeedbackManager.stream.play('feedback_stream', {
  complete: () => {
    // Missing: FeedbackManager.stream.remove('feedback_stream');
  }
});
```

## Correct Patterns

```javascript
// ✅ CORRECT - Full implementation with all states
submitBtn.addEventListener("click", async function () {
  const answer = answerInput.value.trim();

  // ✅ Input validation
  if (!answer) {
    alert("Please enter an answer");
    return;
  }

  // ✅ Loading state
  submitBtn.disabled = true;
  btnText.textContent = "Evaluating...";

  try {
    // ✅ Call subjective evaluation (via MathAIHelpers namespace)
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [
        {
          component_id: "q1",
          evaluation_prompt: `Evaluate: "${answer}"`,
          feedback_prompt: "Based on {{evaluation}}, provide feedback",
        },
      ],
      timeout: 30000,
    });

    const feedback = result.data[0].feedback;

    if (feedback) {
      // ✅ Audio feedback with loading states
      btnText.textContent = "Generating Audio...";

      try {
        await FeedbackManager.playDynamicFeedback({
          audio_content: feedback,
          subtitle: feedback,
        });

        // ✅ Clean up and reset
        submitBtn.disabled = false;
        btnText.textContent = "Submit Answer";
      } catch (err) {
        console.error(err);
        submitBtn.disabled = false;
        btnText.textContent = "Submit Answer";
      }
    } else {
      // ✅ No audio, just reset
      submitBtn.disabled = false;
      btnText.textContent = "Submit Answer";
    }
  } catch (error) {
    // ✅ Error handling
    console.error("Evaluation error:", error);
    alert("Error evaluating answer. Please try again.");
    submitBtn.disabled = false;
    btnText.textContent = "Submit Answer";
  }
});
```

## Testing Checklist

### Basic Functionality

- [ ] Test with evaluation_prompt only (no feedback)
- [ ] Test with evaluation_prompt + feedback_prompt
- [ ] Test with audio feedback integration
- [ ] Test with multiple questions/components
- [ ] Test timeout behavior (set short timeout)

### User Experience

- [ ] Button states are clear and intuitive
- [ ] Loading spinner is visible
- [ ] Feedback is displayed clearly
- [ ] Audio and subtitle are synchronized
- [ ] Error messages are user-friendly

### Performance

- [ ] Evaluation completes in < 10 seconds
- [ ] Audio generation starts immediately after evaluation
- [ ] No memory leaks on multiple submissions
- [ ] Stream cleanup works correctly

### Cross-Browser

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Quick Reference

**Package URLs (LOAD IN ORDER):**

```
1. FeedbackManager: https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js
2. Components:      https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js
3. Helpers Bundle:  https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js
```

**Access Pattern:**

```javascript
// ONLY via MathAIHelpers namespace
await MathAIHelpers.SubjectiveEvaluation.evaluate({ ... });
```

**API Endpoints:**

```
Evaluation: https://asia-south1-mathai-449208.cloudfunctions.net/subjective-evaluation
TTS: https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text={text}
```

**Key Patterns:**

- SubjectiveEvaluation is ONLY available in Helpers package (use `MathAIHelpers.SubjectiveEvaluation.evaluate()`)
- **`evaluation_prompt` → ONE-WORD label** (e.g. `correct` / `partial` / `incorrect` / `gibberish`) used to drive UI color (green/red/amber/grey). Must tell the LLM "respond with only one word".
- **`feedback_prompt` → human sentence** shown on screen AND spoken via TTS. Must reference `{{evaluation}}`, be plain prose (no markdown/emoji), 1–2 sentences.
- Tailor both prompts to the specific game concept — never ship the generic template verbatim.
- Label set in `evaluation_prompt` MUST match the keys in the UI color map / CSS classes.
- Always handle loading states (5 states: idle, evaluating, generating, playing, complete)
- Always re-enable button on complete OR error
- Always clean up streams after playback
- Always validate input before API call
- Timeout: Default 30 seconds (30000ms)

## Reference

- Full API: [Subjective Evaluation Package Documentation]
- FeedbackManager: [components/feedback-manager.md](../../components/feedback-manager.md)
- Validation Types: [reference/validation-types.md](../../reference/validation-types.md)
