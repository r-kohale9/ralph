# Answer Validation Types

Games support three validation approaches, each suited for different types of questions and answers.

---

## 1. Fixed Answer

**Definition:** One specific correct answer (can be single value or array)

**Use When:**
- There is exactly one correct answer
- The answer is objective and deterministic
- No multiple valid solutions exist

### Single Value Example

**Question:** "What is 5 × 3?"
**Correct Answer:** 15 (only this value is correct)

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  // Simple equality check
  const correct = userAnswer === correctAnswer;

  return correct;
}

// Usage
const isCorrect = validateAnswer(userInput, 15);
```

### Fixed Array Example

**Question:** "List all prime numbers less than 10"
**Correct Answer:** [2, 3, 5, 7] (ONLY this array is correct)

```javascript
// Array validation - order matters
function checkArrayAnswer(user, correct) {
  return JSON.stringify(user) === JSON.stringify(correct);
}

// Usage
const isCorrect = checkArrayAnswer(userInput, [2, 3, 5, 7]);
```

### Set Answer Example (Order Doesn't Matter)

**Question:** "Select all even digits"
**Correct Answer:** [0, 2, 4, 6, 8] (any order is acceptable)

```javascript
// Set validation - order doesn't matter
function checkSetAnswer(user, correct) {
  const userSet = new Set(user);
  return user.length === correct.length &&
         correct.every((v) => userSet.has(v));
}

// Usage
const isCorrect = checkSetAnswer([2, 4, 0, 6, 8], [0, 2, 4, 6, 8]); // true
```

### Edge Case Handling

Always handle common edge cases with fixed answers:

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  // Trim whitespace
  const trimmed = String(userAnswer).trim();

  // Case-insensitive comparison (for text answers)
  const userLower = trimmed.toLowerCase();
  const correctLower = String(correctAnswer).toLowerCase();

  return userLower === correctLower;
}

// Examples that should all be correct:
// "Paris", " Paris ", "PARIS", "paris" all match correctAnswer: "Paris"
```

---

## 2. Function-Based

**Definition:** Multiple different valid answers that follow a rule or pattern

**Use When:**
- There are multiple valid solutions
- Answers must satisfy a specific condition or rule
- The validation logic can be expressed as a function

### Sum Example

**Question:** "Tap numbers that sum to 10"
**Valid Answers:** [3,7], [6,4], [2,3,5], [1,2,3,4], etc. (ANY combination that sums to 10)

```javascript
function validateSum(tappedNumbers, targetSum) {
  const sum = tappedNumbers.reduce((a, b) => a + b, 0);
  return sum === targetSum;
}

// Usage
const isCorrect = validateSum([3, 7], 10); // true
const isCorrect = validateSum([6, 4], 10); // true
const isCorrect = validateSum([2, 3, 5], 10); // true
```

### Range Example

**Question:** "Enter a number between 1 and 10"
**Valid Answers:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

```javascript
function validateRange(userAnswer, min, max) {
  const num = Number(userAnswer);
  return !isNaN(num) && num >= min && num <= max;
}

// Usage
const isCorrect = validateRange(5, 1, 10); // true
const isCorrect = validateRange(11, 1, 10); // false
```

### Pattern Matching Example

**Question:** "Enter an even number"
**Valid Answers:** Any even number (2, 4, 6, 8, 10, ...)

```javascript
function validateEven(userAnswer) {
  const num = Number(userAnswer);
  return !isNaN(num) && num % 2 === 0;
}

// Usage
const isCorrect = validateEven(4); // true
const isCorrect = validateEven(7); // false
```

### Complete Function-Based Implementation

```javascript
function checkTapSum(tappedNumbers, targetSum) {
  const sum = tappedNumbers.reduce((a, b) => a + b, 0);
  const correct = sum === targetSum;

  // Track attempt with validation type
  tracker.addAttempt({
    questionNumber: currentQuestion,
    question: `Tap numbers that sum to ${targetSum}`,
    userAnswer: tappedNumbers,
    correctAnswer: targetSum,
    correct: correct,
    validationType: "function",
    timestamp: Date.now(),
    responseTime: timeElapsed
  });

  return correct;
}
```

---

## 3. LLM-Based (Subjective Evaluation)

**Definition:** Subjective or open-ended answers that require AI evaluation

**Use When:**
- The answer is subjective or requires interpretation
- Multiple valid explanations exist
- Human-like reasoning is needed to evaluate correctness
- Text quality or explanation depth matters

**Implementation:** Use the SubjectiveEvaluation package for AI-powered evaluation with optional audio feedback. See [workflows/checklists/subjective-evaluation.md](../workflows/checklists/subjective-evaluation.md) for complete integration guide.

### Open-Ended Example

**Question:** "Explain why 12 is even"
**Valid Answers:**
- "12 is even because it's divisible by 2"
- "Because 12 ÷ 2 = 6 with no remainder"
- "It ends in 2, which is an even digit"
- Many other valid explanations...

```javascript
// LLM validation requires backend evaluation
const attempt = {
  validationType: "llm",
  requiresBackendValidation: true,
  questionNumber: currentQuestion,
  question: "Explain why 12 is even",
  userAnswer: userExplanation,
  timestamp: Date.now()
};

// Add to tracker
tracker.addAttempt(attempt);

// Send to backend for evaluation
// Backend will use LLM to evaluate quality/correctness
```

### Explanation Example

**Question:** "Describe three ways to make 10 using addition"
**Expected:** Open-ended answers with multiple strategies

```javascript
const attempt = {
  validationType: "llm",
  requiresBackendValidation: true,
  questionNumber: currentQuestion,
  question: "Describe three ways to make 10 using addition",
  userAnswer: userText,
  correctAnswer: "Various valid strategies exist",
  timestamp: Date.now()
};

tracker.addAttempt(attempt);
```

### Important Notes

**LLM Validation Characteristics:**
- Uses SubjectiveEvaluation package (API-based)
- Requires network connection
- May take 3-10 seconds to process
- Provides rich feedback on answer quality
- Suitable for creative or explanatory tasks
- Can generate dynamic audio feedback with subtitles

**Implementation with SubjectiveEvaluation Package:**

See [workflows/checklists/subjective-evaluation.md](../workflows/checklists/subjective-evaluation.md) for complete implementation guide.

**Quick Example:**

> ⚠️ Both prompts MUST be customised per game concept. See [workflows/checklists/subjective-evaluation.md § Phase 2](../workflows/checklists/subjective-evaluation.md#phase-2-evaluation-logic) for the full design rules.
> - `evaluation_prompt` → returns a **single lowercase label** (e.g. `correct` / `partial` / `incorrect` / `gibberish`) used to color the UI.
> - `feedback_prompt` → uses `{{evaluation}}` to produce **plain spoken-style prose** that is shown on screen AND played via TTS.
> - **`{{evaluation}}` is the ONLY template variable.** The student's answer, the question, and any other dynamic context must be embedded into the prompt string via JavaScript interpolation (`${...}`) BEFORE calling `evaluate()`. There is no `{{userAnswer}}` / `{{student_answer}}` placeholder — those would be sent to the LLM as literal text.

```javascript
// Build prompts at call time — student's answer is interpolated via ${}, NOT a template variable.
const question = "<QUESTION>";
const expected = "<EXPECTED>";
const answer = answerInput.value.trim();

const evaluationPrompt = `
Question: "${question}"
Expected: "${expected}"
Student's answer: "${answer}"

Classify as exactly one of: correct, partial, incorrect, gibberish.
Respond with ONLY the single lowercase label. No punctuation. No explanation.
`.trim();

const feedbackPrompt = `
Question: "${question}"
Student's answer: "${answer}"
Evaluation label: {{evaluation}}

Write 1–2 short spoken-style sentences to the student, tone adapted to {{evaluation}}.
Plain prose only. No markdown, no emojis. This text will be read aloud.
`.trim();

// Call subjective evaluation (via MathAIHelpers namespace)
const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
  components: [
    {
      component_id: "q1",
      evaluation_prompt: evaluationPrompt, // → one-word label, drives UI color
      feedback_prompt: feedbackPrompt,     // → sentence for screen + TTS
    },
  ],
});

// Get evaluation and feedback
const evaluation = result.data[0].evaluation.trim().toLowerCase(); // e.g. "correct"
const feedback = result.data[0].feedback;                          // sentence for screen + TTS

// Paint UI from evaluation label
answerBox.dataset.evaluation = evaluation; // CSS: [data-evaluation="correct"] { background:#d1fae5; }

// Play audio feedback with synced subtitle
await FeedbackManager.playDynamicFeedback({
  audio_content: feedback,
  subtitle: feedback,
});
```

**Legacy Implementation (Manual Tracking):**
```javascript
// Mark for backend validation (if not using SubjectiveEvaluation package)
const attempt = {
  validationType: "llm",
  requiresBackendValidation: true,
  userAnswer: explanation,
  // ... other fields
};

// Game continues, validation happens async
// Backend will evaluate and provide feedback
```

---

## When to Use Each Type

### Decision Tree

```
Does the question have ONE specific correct answer?
├─ YES → Use Fixed Answer
└─ NO → Are there MULTIPLE valid answers following a rule?
    ├─ YES → Use Function-Based
    └─ NO → Is the answer subjective or open-ended?
        ├─ YES → Use LLM-Based
        └─ NO → Reconsider question design
```

### Quick Reference

| Validation Type | Number of Valid Answers | Evaluation Method | Example |
|----------------|-------------------------|-------------------|---------|
| **Fixed Answer** | Exactly one | Equality check | "What is 5 × 3?" → 15 |
| **Function-Based** | Multiple (rule-based) | Function logic | "Numbers that sum to 10" → [3,7], [6,4], etc. |
| **LLM-Based** | Many (subjective) | AI evaluation | "Explain why 12 is even" → Various explanations |

### Complexity Guide

**Simplest:** Fixed Answer
- Quick to implement
- Fast validation
- Clear right/wrong

**Medium:** Function-Based
- Requires validation function
- Still fast validation
- Multiple valid paths

**Most Complex:** LLM-Based
- Requires backend integration
- Slower validation
- Rich, nuanced feedback

---

## Best Practices

### Always Handle Edge Cases

```javascript
// For Fixed Answer
function validateAnswer(user, correct) {
  // Trim whitespace
  const cleaned = String(user).trim();
  // Case insensitive
  return cleaned.toLowerCase() === String(correct).toLowerCase();
}
```

### Track Validation Type

```javascript
tracker.addAttempt({
  // ... other fields
  validationType: "fixed", // or "function" or "llm"
  // This helps with analytics and replay
});
```

### Provide Clear Feedback

Different validation types may warrant different feedback:

- **Fixed Answer:** "Correct! The answer is 15" or "Incorrect. Try again."
- **Function-Based:** "Great! Your numbers sum to 10" or "Not quite. Check your sum."
- **LLM-Based:** "Good explanation! You mentioned..." or "Your answer could be improved by..."

---

## Examples in Practice

### Math Quiz (Fixed Answer)
```javascript
// Question: "What is 7 × 8?"
const isCorrect = validateAnswer(userInput, 56);
```

### Number Puzzle (Function-Based)
```javascript
// Question: "Select numbers that multiply to 24"
const isCorrect = validateProduct(selectedNumbers, 24);
```

### Concept Explanation (LLM-Based)
```javascript
// Question: "Why do we carry in addition?"
const attempt = {
  validationType: "llm",
  requiresBackendValidation: true,
  userAnswer: explanationText
};
```

---

## Related Documentation

- [Phase 2: Input Evaluation & Validation](../workflows/phase-2-validation.md)
- [SKILL.md - Answer Validation Types Section](../SKILL.md)
