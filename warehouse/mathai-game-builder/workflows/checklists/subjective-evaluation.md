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

**Prompt Writing:**

- [ ] Write clear `evaluation_prompt` with evaluation criteria
- [ ] Write `feedback_prompt` using `{{evaluation}}` variable
- [ ] Test prompts with sample answers
- [ ] Verify prompts produce relevant feedback

**Example Prompts:**

```javascript
{
  component_id: "q1",
  evaluation_prompt: "Evaluate this answer about variables: '{{student_answer}}'. Is it correct, partially correct, or incorrect?",
  feedback_prompt: "Based on {{evaluation}}, provide short constructive feedback for the student."
}
```

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
- Use `{{evaluation}}` in feedback_prompt to reference evaluation result
- Always handle loading states (5 states: idle, evaluating, generating, playing, complete)
- Always re-enable button on complete OR error
- Always clean up streams after playback
- Always validate input before API call
- Timeout: Default 30 seconds (30000ms)

## Reference

- Full API: [Subjective Evaluation Package Documentation]
- FeedbackManager: [components/feedback-manager.md](../../components/feedback-manager.md)
- Validation Types: [reference/validation-types.md](../../reference/validation-types.md)
