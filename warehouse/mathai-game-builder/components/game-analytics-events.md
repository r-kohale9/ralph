# Game Analytics Events

Standard analytics events for games created with mathai-game-builder. These events track the complete question-answering lifecycle and are automatically sent to Mixpanel, Amplitude, and CleverTap with `harness: true`.

## Overview

**7 Required Events** (added in Phase 2 - Validation):
1. `question_submitted` - User submits answer
2. `question_evaluation_complete` - Validation completes
3. `question_timed_out` - Timer expires (for timed questions)
4. `show_submit_button` - Submit button becomes visible
5. `hide_submit_button` - Submit button is hidden
6. `next_btn_clicked` - Next button clicked
7. `show_image_not_loaded_popup` - Images fail to load

**All events automatically include:**
- `harness: true`
- `mathai_platform` (web/ios/android)
- `region` (from config)
- `current_href` (page URL)

> **Note:** These 7 analytics events are sent to Mixpanel/Amplitude/CleverTap via AnalyticsManager. The [SignalCollector](signal-collector.md) captures raw input events (clicks, keystrokes, drags) and problem-level signals separately — they go into the `game_complete` postMessage payload and `api.submitResults()` for backend processing. Both systems operate orthogonally.

---

## Event Details

### 1. question_submitted

**When**: User submits their answer by clicking submit button or pressing enter.

**Trigger Point**: Inside the `handleSubmit()` or `submitAnswer()` function, RIGHT BEFORE validation runs.

**Properties**:
```javascript
analytics.track('question_submitted', {
  question_number: currentQuestionIndex + 1,    // 1-based index
  question_text: currentQuestion.text,          // Question prompt
  user_answer: userAnswer,                      // What user entered
  attempt_number: attempts.length + 1,          // Current attempt (1, 2, 3...)
  time_taken: Date.now() - questionStartTime,   // Milliseconds
  has_timer: !!timer,                           // Boolean
  time_remaining: timer ? timer.getTimeLeft() : null
});
```

**Example Code**:
```javascript
function submitAnswer() {
  const userAnswer = getUserInput();
  const timeTaken = Date.now() - questionStartTime;

  // Track submission BEFORE validation
  analytics.track('question_submitted', {
    question_number: currentQuestionIndex + 1,
    question_text: currentQuestion.text,
    user_answer: userAnswer,
    attempt_number: currentAttempts + 1,
    time_taken: timeTaken,
    has_timer: !!timer,
    time_remaining: timer ? timer.getTimeLeft() : null
  });

  // Then run validation
  const isCorrect = validateAnswer(userAnswer);
  // ...
}
```

---

### 2. question_evaluation_complete

**When**: RIGHT AFTER validation logic finishes (correct/incorrect determined).

**Trigger Point**: After `validateAnswer()` returns, before showing feedback.

**Properties**:
```javascript
analytics.track('question_evaluation_complete', {
  question_number: currentQuestionIndex + 1,
  is_correct: isCorrect,                        // Boolean
  user_answer: userAnswer,
  correct_answer: currentQuestion.answer,
  validation_type: 'exact_match',               // 'exact_match', 'function', 'subjective'
  attempt_number: attempts.length,
  total_attempts: attempts.length,
  time_taken: Date.now() - questionStartTime,
  score_awarded: scoreAwarded                   // Points given (if applicable)
});
```

**Example Code**:
```javascript
function submitAnswer() {
  const userAnswer = getUserInput();

  analytics.track('question_submitted', { /* ... */ });

  // Validate
  const isCorrect = validateAnswer(userAnswer);
  const scoreAwarded = isCorrect ? 10 : 0;

  // Track evaluation complete
  analytics.track('question_evaluation_complete', {
    question_number: currentQuestionIndex + 1,
    is_correct: isCorrect,
    user_answer: userAnswer,
    correct_answer: currentQuestion.answer,
    validation_type: 'exact_match',
    attempt_number: currentAttempts + 1,
    total_attempts: currentAttempts + 1,
    time_taken: Date.now() - questionStartTime,
    score_awarded: scoreAwarded
  });

  // Show feedback
  showFeedback(isCorrect);
}
```

---

### 3. question_timed_out

**When**: Timer reaches zero before user submits answer.

**Trigger Point**: In timer's `onEnd` callback.

**Properties**:
```javascript
analytics.track('question_timed_out', {
  question_number: currentQuestionIndex + 1,
  question_text: currentQuestion.text,
  timer_duration: timerDuration,                // Total time allowed (seconds)
  attempts_made: attempts.length,               // How many attempts before timeout
  had_answer: !!getUserInput()                  // Did user type something?
});
```

**Example Code**:
```javascript
// In Phase 1, when creating timer
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 60,
  autoStart: true,
  onEnd: () => {
    // Track timeout
    analytics.track('question_timed_out', {
      question_number: currentQuestionIndex + 1,
      question_text: currentQuestion.text,
      timer_duration: 60,
      attempts_made: currentAttempts,
      had_answer: !!getUserInput()
    });

    // Handle timeout (mark as incorrect, move to next, etc.)
    handleTimeout();
  }
});
```

**Note**: Only track if the game has timed questions. Not all games need this event.

---

### 4. show_submit_button

**When**: Submit button becomes visible/enabled (after user provides input or meets conditions).

**Trigger Point**: When submit button is shown/enabled in the UI.

**Properties**:
```javascript
analytics.track('show_submit_button', {
  question_number: currentQuestionIndex + 1,
  trigger: 'input_provided',                    // Why shown: 'input_provided', 'option_selected', 'timer_started'
  has_value: !!getUserInput()                   // Is there user input?
});
```

**Example Code**:
```javascript
function handleInput(event) {
  const value = event.target.value.trim();

  if (value.length > 0 && submitBtn.disabled) {
    // Enable submit button
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';

    // Track button shown
    analytics.track('show_submit_button', {
      question_number: currentQuestionIndex + 1,
      trigger: 'input_provided',
      has_value: true
    });
  }
}
```

---

### 5. hide_submit_button

**When**: Submit button is hidden/disabled (after submission, during transitions, etc.).

**Trigger Point**: When submit button is hidden/disabled in the UI.

**Properties**:
```javascript
analytics.track('hide_submit_button', {
  question_number: currentQuestionIndex + 1,
  trigger: 'answer_submitted',                  // Why hidden: 'answer_submitted', 'question_change', 'timeout'
  was_correct: isCorrect                        // If hidden after submission
});
```

**Example Code**:
```javascript
function submitAnswer() {
  const userAnswer = getUserInput();
  const isCorrect = validateAnswer(userAnswer);

  // Hide/disable submit button
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.5';

  // Track button hidden
  analytics.track('hide_submit_button', {
    question_number: currentQuestionIndex + 1,
    trigger: 'answer_submitted',
    was_correct: isCorrect
  });

  // Show feedback
  showFeedback(isCorrect);
}
```

---

### 6. next_btn_clicked

**When**: User clicks "Next" button to proceed to next question.

**Trigger Point**: In next button's click handler, BEFORE actually moving to next question.

**Properties**:
```javascript
analytics.track('next_btn_clicked', {
  question_number: currentQuestionIndex + 1,    // Question leaving
  was_correct: currentQuestionCorrect,          // Did they get it right?
  attempts_used: currentAttempts,               // How many attempts
  time_spent: Date.now() - questionStartTime,   // Time on this question
  next_question_number: currentQuestionIndex + 2 // Where going (1-based)
});
```

**Example Code**:
```javascript
function handleNextClick() {
  // Track next click BEFORE moving
  analytics.track('next_btn_clicked', {
    question_number: currentQuestionIndex + 1,
    was_correct: currentQuestionCorrect,
    attempts_used: currentAttempts,
    time_spent: Date.now() - questionStartTime,
    next_question_number: currentQuestionIndex + 2
  });

  // Move to next question
  currentQuestionIndex++;
  showQuestion(currentQuestionIndex);
  questionStartTime = Date.now();
}
```

---

### 7. show_image_not_loaded_popup

**When**: Image fails to load (network error, broken URL, CDN issue).

**Trigger Point**: In image's `onerror` event handler.

**Properties**:
```javascript
analytics.track('show_image_not_loaded_popup', {
  question_number: currentQuestionIndex + 1,
  image_url: imgElement.src,                    // Failed URL
  image_type: 'question_image',                 // 'question_image', 'option_image', 'diagram'
  error_time: Date.now(),
  retry_available: true                         // Can user retry?
});
```

**Example Code**:
```javascript
function showQuestion() {
  const questionImg = document.createElement('img');
  questionImg.src = currentQuestion.imageUrl;

  questionImg.onerror = function() {
    // Track image load failure
    analytics.track('show_image_not_loaded_popup', {
      question_number: currentQuestionIndex + 1,
      image_url: this.src,
      image_type: 'question_image',
      error_time: Date.now(),
      retry_available: true
    });

    // Show error popup
    showImageErrorPopup();
  };

  questionImg.onload = function() {
    // Image loaded successfully
    container.appendChild(questionImg);
  };
}
```

---

## Complete Integration Example

```javascript
// ========== GAME INITIALIZATION ==========
let analytics = null;
let currentQuestionIndex = 0;
let currentAttempts = 0;
let questionStartTime = Date.now();
let currentQuestionCorrect = false;

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Initialize analytics
  analytics = new AnalyticsManager();
  await analytics.init();
  window.analyticsManager = analytics;

  // Identify user from postMessage
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GAME_DATA' && event.data.student) {
      const student = event.data.student;
      analytics.identify({
        id: student.id,
        mobile: student.mobile,
        name: student.name,
        email: student.email
      });
    }
  });

  startGame();
});

// ========== QUESTION DISPLAY ==========
function showQuestion(index) {
  currentQuestionIndex = index;
  currentAttempts = 0;
  questionStartTime = Date.now();
  currentQuestionCorrect = false;

  const question = questions[index];

  // Display question
  questionText.textContent = question.text;

  // Handle question image
  if (question.imageUrl) {
    const img = document.createElement('img');
    img.src = question.imageUrl;

    img.onerror = function() {
      // 7. Track image load failure
      analytics.track('show_image_not_loaded_popup', {
        question_number: index + 1,
        image_url: this.src,
        image_type: 'question_image',
        error_time: Date.now(),
        retry_available: true
      });
      showImageErrorPopup();
    };

    questionImgContainer.appendChild(img);
  }

  // Start timer if needed
  if (timer) {
    timer.start();
  }
}

// ========== INPUT HANDLING ==========
function handleInput(event) {
  const value = event.target.value.trim();

  if (value.length > 0 && submitBtn.disabled) {
    // 4. Show submit button
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';

    analytics.track('show_submit_button', {
      question_number: currentQuestionIndex + 1,
      trigger: 'input_provided',
      has_value: true
    });
  }
}

// ========== ANSWER SUBMISSION ==========
function submitAnswer() {
  const userAnswer = getUserInput();
  currentAttempts++;

  // 1. Track submission BEFORE validation
  analytics.track('question_submitted', {
    question_number: currentQuestionIndex + 1,
    question_text: questions[currentQuestionIndex].text,
    user_answer: userAnswer,
    attempt_number: currentAttempts,
    time_taken: Date.now() - questionStartTime,
    has_timer: !!timer,
    time_remaining: timer ? timer.getTimeLeft() : null
  });

  // Validate answer
  const isCorrect = validateAnswer(userAnswer);
  currentQuestionCorrect = isCorrect;
  const scoreAwarded = isCorrect ? 10 : 0;

  // 2. Track evaluation complete AFTER validation
  analytics.track('question_evaluation_complete', {
    question_number: currentQuestionIndex + 1,
    is_correct: isCorrect,
    user_answer: userAnswer,
    correct_answer: questions[currentQuestionIndex].answer,
    validation_type: 'exact_match',
    attempt_number: currentAttempts,
    total_attempts: currentAttempts,
    time_taken: Date.now() - questionStartTime,
    score_awarded: scoreAwarded
  });

  // 5. Hide submit button
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.5';

  analytics.track('hide_submit_button', {
    question_number: currentQuestionIndex + 1,
    trigger: 'answer_submitted',
    was_correct: isCorrect
  });

  // Show feedback
  showFeedback(isCorrect);
}

// ========== TIMER TIMEOUT ==========
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 60,
  autoStart: true,
  onEnd: () => {
    // 3. Track timeout
    analytics.track('question_timed_out', {
      question_number: currentQuestionIndex + 1,
      question_text: questions[currentQuestionIndex].text,
      timer_duration: 60,
      attempts_made: currentAttempts,
      had_answer: !!getUserInput()
    });

    handleTimeout();
  }
});

// ========== NEXT QUESTION ==========
function handleNextClick() {
  // 6. Track next click
  analytics.track('next_btn_clicked', {
    question_number: currentQuestionIndex + 1,
    was_correct: currentQuestionCorrect,
    attempts_used: currentAttempts,
    time_spent: Date.now() - questionStartTime,
    next_question_number: currentQuestionIndex + 2
  });

  // Move to next
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    showQuestion(currentQuestionIndex);
  } else {
    completeGame();
  }
}
```

---

## Event Lifecycle

**Typical question flow:**

1. **Question Displayed** → User sees question
2. **User Types Input** → `show_submit_button` (4)
3. **User Clicks Submit** → `question_submitted` (1)
4. **Validation Runs** → `question_evaluation_complete` (2)
5. **Feedback Shown** → `hide_submit_button` (5)
6. **User Clicks Next** → `next_btn_clicked` (6)
7. **Repeat for next question**

**For timed questions:**
- If timer expires before submit → `question_timed_out` (3)

**For questions with images:**
- If image fails to load → `show_image_not_loaded_popup` (7)

---

## Best Practices

1. **Track in Order**: Submit → Evaluate → Hide button → Next click
2. **Always Include Context**: Question number, attempt number, time taken
3. **Don't Track Too Early**: Wait for actual user action, not just button render
4. **Handle Edge Cases**: Check if analytics initialized before tracking
5. **Be Consistent**: Use same property names across all questions
6. **Track Failures**: Image errors, timeouts, validation failures

---

## Verification Checklist

Before marking Phase 2 complete, verify:

```
[ ] question_submitted tracked in submit handler (BEFORE validation)
[ ] question_evaluation_complete tracked AFTER validation
[ ] question_timed_out tracked in timer.onEnd (if timed questions)
[ ] show_submit_button tracked when button enabled
[ ] hide_submit_button tracked when button disabled
[ ] next_btn_clicked tracked in next button handler
[ ] show_image_not_loaded_popup tracked in img.onerror
[ ] All events include question_number (1-based)
[ ] All events include relevant context properties
[ ] Analytics instance exists (window.analyticsManager)
[ ] User identified from postMessage data
```

---

## Notes

- All events automatically include `harness: true` (no need to add manually)
- Platform filtering controlled by CDN config (no game changes needed)
- Events sent to Mixpanel, Amplitude, and CleverTap simultaneously
- Use `analytics.track()` - never directly call Mixpanel/Amplitude APIs
- Check `if (analytics)` before tracking to handle graceful degradation

---

**See Also:**
- [analytics-manager.md](analytics-manager.md) - Package documentation
- [phase-2-validation.md](../workflows/phase-2-validation.md) - Validation workflow
- [mathai-client-events.md](/home/rk/Projects/Dev/HomeworkApp/claude/claude-packages/helpers/analytics/mathai-client-events.md) - All mathai-client events
