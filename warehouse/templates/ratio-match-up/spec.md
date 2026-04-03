# Match Up! — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Match Up!
- **Game ID:** ratio-match-up
- **Type:** standard
- **Description:** Equivalent ratios game for Grade 5. Kids judge whether two explicit ratios are equivalent (Type A) or produce both values of an equivalent ratio using multiplication (Type B). Progresses from simple x2 multipliers to x3-x5 with additive-trap distractors. 10 rounds, 3 lives, 3 stages.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                    |
| -------- | ----------------------------- | --------------- | --------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                               |
| PART-002 | Package Scripts               | YES             | —                                                               |
| PART-003 | waitForPackages               | YES             | —                                                               |
| PART-004 | Initialization Block          | YES             | —                                                               |
| PART-005 | VisibilityTracker             | YES             | Default popupProps                                              |
| PART-006 | TimerComponent                | NO              | No timer in this game                                           |
| PART-007 | Game State Object             | YES             | Custom: lives, totalLives, roundType, stage, currentMultiplier  |
| PART-008 | PostMessage Protocol          | YES             | —                                                               |
| PART-009 | Attempt Tracking              | YES             | —                                                               |
| PART-010 | Event Tracking & SignalCollector | YES          | Custom events: answer_correct, answer_wrong, life_lost, stage_change |
| PART-011 | End Game & Metrics            | YES             | Stars: 80%->3, 50%->2, >0%->1                                  |
| PART-012 | Debug Functions               | YES             | —                                                               |
| PART-013 | Validation Fixed              | YES             | Type A: "same" or "different" fixed answer                      |
| PART-014 | Validation Function           | YES             | Type B: validate both fields = base * multiplier                |
| PART-015 | Validation LLM                | NO              | —                                                               |
| PART-016 | StoriesComponent              | NO              | —                                                               |
| PART-017 | Feedback Integration          | YES             | Audio + sticker on correct/incorrect + results celebration      |
| PART-018 | Case Converter                | NO              | —                                                               |
| PART-019 | Results Screen UI             | YES             | —                                                               |
| PART-020 | CSS Variables & Colors        | YES             | —                                                               |
| PART-021 | Screen Layout CSS             | YES             | —                                                               |
| PART-022 | Game Buttons                  | YES             | Type A: two choice buttons. Type B: submit/retry/next           |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 10, totalLives: 3                                  |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over, level (stage 2, stage 3)   |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                  |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating                     |
| PART-027 | Play Area Construction        | YES             | Layout: option cards (Type A) + dual input fields (Type B)      |
| PART-028 | InputSchema Patterns          | YES             | Schema type: questions with round types                         |
| PART-029 | Story-Only Game               | NO              | —                                                               |
| PART-030 | Sentry Error Tracking         | YES             | —                                                               |
| PART-031 | API Helper                    | NO              | —                                                               |
| PART-032 | AnalyticsManager              | NO              | —                                                               |
| PART-033 | Interaction Patterns          | NO              | —                                                               |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | —                                                               |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | —                                                               |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | —                                                               |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null
  },

  // GAME-SPECIFIC:
  lives: 3,               // Current remaining lives
  totalLives: 3,          // Starting lives (for metrics)
  roundType: null,         // "A" or "B" — current round type
  stage: 1,                // 1=Easy, 2=Mixed, 3=Hard
  pendingEndProblem: null,  // Deferred SignalCollector endProblem
  sessionHistory: []       // For multi-session tracking
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
```

---

## 4. Input Schema

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["A", "B"] },
          "emoji1": { "type": "string" },
          "emoji2": { "type": "string" },
          "baseRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2
          },
          "comparisonRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2,
            "description": "Type A only — the ratio to compare against"
          },
          "correctAnswer": {
            "type": "string",
            "enum": ["same", "different"],
            "description": "Type A only — whether comparisonRatio is equivalent"
          },
          "multiplier": {
            "type": "integer",
            "description": "Type B only — multiply baseRatio by this"
          },
          "distractorType": {
            "type": "string",
            "enum": ["none", "additive", "swap", "one-side"],
            "description": "Type A only — which distractor pattern is used (for analytics)"
          },
          "voiceOver": {
            "type": "object",
            "properties": {
              "correct": { "type": "string" },
              "incorrect": { "type": "string" }
            }
          }
        },
        "required": ["type", "emoji1", "emoji2", "baseRatio"]
      }
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    // --- Stage 1: Easy (rounds 1-3) — Type A only, x2, ratios with 1 ---
    {
      type: "A",
      emoji1: "\ud83c\udf4e", emoji2: "\ud83c\udf4a",
      baseRatio: [1, 2],
      comparisonRatio: [2, 4],
      correctAnswer: "same",
      distractorType: "none",
      voiceOver: {
        correct: "Yes! Both sides were multiplied by 2, so it's the same ratio.",
        incorrect: "Look again \u2014 1 times 2 is 2, and 2 times 2 is 4. Same ratio!"
      }
    },
    {
      type: "A",
      emoji1: "\ud83c\udf53", emoji2: "\ud83c\udf4c",
      baseRatio: [2, 1],
      comparisonRatio: [4, 2],
      correctAnswer: "same",
      distractorType: "none",
      voiceOver: {
        correct: "Correct! Multiply both by 2 and you get 4 and 2.",
        incorrect: "Check it \u2014 2 times 2 is 4, 1 times 2 is 2. They match!"
      }
    },
    {
      type: "A",
      emoji1: "\ud83c\udfbe", emoji2: "\u26bd",
      baseRatio: [1, 3],
      comparisonRatio: [4, 6],
      correctAnswer: "different",
      distractorType: "additive",
      voiceOver: {
        correct: "Good eye! 1 times 4 is 4, but 3 times 4 would be 12, not 6. Different ratio!",
        incorrect: "Not quite \u2014 adding 3 to each doesn't keep the ratio. 1:3 is not the same as 4:6."
      }
    },
    // --- Stage 2: Mixed (rounds 4-7) — A + B, x2/x3, ratios without 1 ---
    {
      type: "A",
      emoji1: "\ud83c\udf39", emoji2: "\ud83c\udf3b",
      baseRatio: [2, 3],
      comparisonRatio: [6, 9],
      correctAnswer: "same",
      distractorType: "none",
      voiceOver: {
        correct: "Yes! Both sides multiplied by 3. 2\u00d73=6 and 3\u00d73=9.",
        incorrect: "Look \u2014 2 times 3 is 6, and 3 times 3 is 9. That's the same ratio!"
      }
    },
    {
      type: "B",
      emoji1: "\ud83d\udc31", emoji2: "\ud83d\udc36",
      baseRatio: [3, 2],
      multiplier: 2,
      voiceOver: {
        correct: "Nice! 3 times 2 is 6, and 2 times 2 is 4. Perfect match!",
        incorrect: "Remember, multiply BOTH sides by 2. 3\u00d72=6 and 2\u00d72=4."
      }
    },
    {
      type: "A",
      emoji1: "\ud83c\udf1f", emoji2: "\ud83c\udf19",
      baseRatio: [3, 4],
      comparisonRatio: [6, 7],
      correctAnswer: "different",
      distractorType: "one-side",
      voiceOver: {
        correct: "Right! The stars doubled to 6, but 4 doubled would be 8, not 7.",
        incorrect: "The first number doubled, but the second didn't. 3:4 is not the same as 6:7."
      }
    },
    {
      type: "B",
      emoji1: "\ud83c\udf52", emoji2: "\ud83c\udf47",
      baseRatio: [2, 5],
      multiplier: 3,
      voiceOver: {
        correct: "Great! 2 times 3 is 6, and 5 times 3 is 15.",
        incorrect: "Hmm, did you add 3 instead of multiply? 2\u00d73=6 and 5\u00d73=15."
      }
    },
    // --- Stage 3: Hard (rounds 8-10) — A + B, x3/x4/x5, additive traps ---
    {
      type: "A",
      emoji1: "\ud83c\udf81", emoji2: "\ud83c\udf88",
      baseRatio: [3, 5],
      comparisonRatio: [7, 9],
      correctAnswer: "different",
      distractorType: "additive",
      voiceOver: {
        correct: "Sharp! 3+4=7 and 5+4=9, but adding isn't multiplying. Different ratio!",
        incorrect: "Careful \u2014 they added 4 to each, not multiplied. 3:5 is not 7:9."
      }
    },
    {
      type: "B",
      emoji1: "\ud83d\ude80", emoji2: "\ud83c\udf1f",
      baseRatio: [4, 3],
      multiplier: 4,
      voiceOver: {
        correct: "Awesome! 4 times 4 is 16, and 3 times 4 is 12. Nailed it!",
        incorrect: "Multiply BOTH by 4: 4\u00d74=16 and 3\u00d74=12."
      }
    },
    {
      type: "B",
      emoji1: "\ud83d\udc1d", emoji2: "\ud83c\udf3a",
      baseRatio: [2, 3],
      multiplier: 5,
      voiceOver: {
        correct: "Perfect! 2 times 5 is 10, and 3 times 5 is 15. You're a ratio master!",
        incorrect: "Multiply both by 5: 2\u00d75=10, 3\u00d75=15. You've got this!"
      }
    }
  ]
};
```

---

## 5. Screens & HTML Structure

### Root Layout

```html
<div id="app"></div>

<template id="game-template">
  <!-- Game Screen -->
  <div id="game-screen" class="game-block">
    <!-- Question Section -->
    <div class="question-section">
      <div id="round-label" class="round-label">Round 1 of 10</div>
      <div id="stage-badge" class="stage-badge">Stage 1: Easy</div>
    </div>

    <!-- Rule Card -->
    <div class="rule-card" id="rule-card">
      <p class="rule-text">For every <span id="rule-num1" class="ratio-number">2</span> <span id="rule-emoji1"></span>, there are <span id="rule-num2" class="ratio-number">3</span> <span id="rule-emoji2"></span></p>
    </div>

    <!-- Type A: Comparison Card (hidden for Type B) -->
    <div class="comparison-card hidden" id="comparison-area">
      <p class="comparison-text">For every <span id="comp-num1" class="ratio-number">6</span> <span id="comp-emoji1"></span>, there are <span id="comp-num2" class="ratio-number">9</span> <span id="comp-emoji2"></span></p>
    </div>

    <!-- Type B: Multiplier + Input Fields (hidden for Type A) -->
    <div class="production-area hidden" id="production-area">
      <div class="multiplier-badge" id="multiplier-badge">&times;2</div>
      <div class="input-row">
        <div class="input-group">
          <input type="number" class="game-input" id="input-field1" data-signal-id="input-field1" placeholder="?" inputmode="numeric" />
          <span class="input-emoji" id="input-emoji1"></span>
        </div>
        <div class="input-group">
          <input type="number" class="game-input" id="input-field2" data-signal-id="input-field2" placeholder="?" inputmode="numeric" />
          <span class="input-emoji" id="input-emoji2"></span>
        </div>
      </div>
    </div>

    <!-- Feedback Section -->
    <div class="feedback-section hidden" id="feedback-area">
      <p id="feedback-text" class="feedback-text"></p>
    </div>
  </div>

  <!-- Type A Buttons -->
  <div class="btn-container" id="type-a-buttons">
    <button class="game-btn btn-same" id="btn-same" data-signal-id="btn-same" onclick="handleTypeAAnswer('same')">Same ratio!</button>
    <button class="game-btn btn-different" id="btn-different" data-signal-id="btn-different" onclick="handleTypeAAnswer('different')">Different ratio!</button>
  </div>

  <!-- Type B Buttons -->
  <div class="btn-container hidden" id="type-b-buttons">
    <button class="game-btn btn-secondary" id="btn-reset" data-signal-id="btn-reset" onclick="resetInputs()">Reset</button>
    <button class="game-btn btn-primary" id="btn-submit" data-signal-id="btn-submit" onclick="handleTypeBSubmit()">Submit</button>
    <button class="game-btn btn-secondary hidden" id="btn-retry" data-signal-id="btn-retry" onclick="handleRetry()">Retry</button>
    <button class="game-btn btn-primary hidden" id="btn-next" data-signal-id="btn-next" onclick="nextRound()">Next</button>
  </div>

  <!-- Results Screen -->
  <div id="results-screen" style="display:none;">
    <div class="results-container">
      <h2 id="results-title">Game Complete!</h2>
      <div id="stars-display" class="stars-display"></div>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span id="result-score" class="metric-value">0%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Time</span>
          <span id="result-time" class="metric-value">0s</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Correct</span>
          <span id="result-correct" class="metric-value">0/0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Lives Left</span>
          <span id="result-lives" class="metric-value">0</span>
        </div>
      </div>
      <button class="game-btn btn-primary" onclick="location.reload()">Play Again</button>
    </div>
  </div>
</template>
```

---

## 6. CSS

```css
/* === CSS Variables (PART-020) === */
:root {
  --mathai-green: #219653;
  --mathai-light-green: #D9F8D9;
  --mathai-red: #E35757;
  --mathai-light-red: #FFD9D9;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #EBF0FF;
  --mathai-gray: #828282;
  --mathai-light-gray: #F2F2F2;
  --mathai-border-gray: #E0E0E0;
  --mathai-white: #FFFFFF;
  --mathai-text-primary: #4a4a4a;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 13px;
  --mathai-font-size-button: 16px;
  --mathai-orange: #F2994A;
  --mathai-purple: #9B51E0;
  --mathai-border-radius-card: 16px;
  --mathai-border-radius-button: 12px;
  --mathai-padding-small: 8px;
  --mathai-cream: #FFF8F0;
}

/* === Reset === */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-cream);
  color: var(--mathai-text-primary);
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0;
  overflow-x: hidden;
}

.game-block {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* === Question Section === */
.question-section {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.round-label {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  font-weight: 500;
}

.stage-badge {
  display: inline-block;
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-purple);
  font-weight: 600;
  background: #F3ECFF;
  padding: 4px 12px;
  border-radius: 20px;
  align-self: center;
}

/* === Rule Card === */
.rule-card {
  background: var(--mathai-white);
  border: 2px solid var(--mathai-purple);
  border-radius: var(--mathai-border-radius-card);
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(155, 81, 224, 0.1);
}

.rule-text {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
}

.ratio-number {
  font-size: 22px;
  font-weight: 700;
  color: var(--mathai-purple);
}

/* === Comparison Card (Type A) === */
.comparison-card {
  background: #FFFDE7;
  border: 2px solid var(--mathai-orange);
  border-radius: var(--mathai-border-radius-card);
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(242, 153, 74, 0.1);
}

.comparison-text {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
}

.comparison-card.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
}

.comparison-card.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
}

/* === Production Area (Type B) === */
.production-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.multiplier-badge {
  font-size: 28px;
  font-weight: 800;
  color: var(--mathai-white);
  background: var(--mathai-purple);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(155, 81, 224, 0.3);
}

.input-row {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
}

.input-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.game-input {
  width: 80px;
  height: 56px;
  font-size: 24px;
  font-weight: 700;
  font-family: var(--mathai-font-family);
  text-align: center;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s ease;
  background: var(--mathai-white);
  color: var(--mathai-text-primary);
}

.game-input:focus {
  border-color: var(--mathai-blue);
}

.game-input.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
}

.game-input.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
}

.input-emoji {
  font-size: 24px;
}

/* === Feedback Section === */
.feedback-section {
  text-align: center;
  padding: 12px;
  border-radius: 12px;
  animation: fadeIn 0.3s ease;
}

.feedback-text {
  font-size: var(--mathai-font-size-body);
  font-weight: 500;
  line-height: 1.5;
}

.feedback-text.correct-text {
  color: var(--mathai-green);
}

.feedback-text.incorrect-text {
  color: var(--mathai-red);
}

/* === Buttons === */
.btn-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: var(--mathai-padding-small) 16px;
  flex-wrap: wrap;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.game-btn {
  padding: 14px 28px;
  font-size: var(--mathai-font-size-button);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  border: none;
  border-radius: var(--mathai-border-radius-button);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-white);
}

.game-btn:active { transform: translateY(0); }
.game-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary { background: var(--mathai-green); }
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

.btn-secondary { background: var(--mathai-blue); }
.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

.btn-same {
  background: var(--mathai-green);
  flex: 1;
  max-width: 200px;
}
.btn-same:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

.btn-different {
  background: var(--mathai-red);
  flex: 1;
  max-width: 200px;
}
.btn-different:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(227, 87, 87, 0.4);
}

.btn-same.selected { box-shadow: 0 0 0 3px var(--mathai-green), 0 6px 20px rgba(33, 150, 83, 0.4); }
.btn-different.selected { box-shadow: 0 0 0 3px var(--mathai-red), 0 6px 20px rgba(227, 87, 87, 0.4); }

.btn-same:disabled, .btn-different:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* === Results Screen === */
.results-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stars-display {
  font-size: 40px;
  letter-spacing: 8px;
}

.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--mathai-white);
  border-radius: var(--mathai-border-radius-card);
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-row:last-child { border-bottom: none; }

.metric-label {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
}

.metric-value {
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  color: var(--mathai-text-primary);
}

/* === Utilities === */
.hidden { display: none !important; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() { /* PART-030 code */ }
</script>

<!-- STEP 3: Sentry SDK v10.23.0 (3 scripts, NO integrity attribute) -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- STEP 4: Initialize on load -->
<script>window.addEventListener('load', initSentry);</script>

<!-- STEP 5-7: Game packages (exact URLs, in this order) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - `waitForPackages()` — waits for FeedbackManager, MathAIComponents, MathAIHelpers
   - `FeedbackManager.init()` — initializes audio system
   - Preload audio: correct_tap, wrong_tap
   - `SignalCollector` creation
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `#game-template` content into `#gameContent`
   - `ProgressBar` creation (totalRounds: 10, totalLives: 3)
   - `TransitionScreen` creation
   - `VisibilityTracker` creation
   - Register `handlePostMessage` listener
   - Send `game_ready` postMessage
   - `setupGame()`

2. **setupGame()** runs:
   - Load content from `gameState.content` or `fallbackContent`
   - Reset state: currentRound=0, score=0, lives=3, stage=1, attempts=[], events=[]
   - Set `gameState.startTime = Date.now()`, `gameState.isActive = true`
   - Set `gameState.duration_data.startTime = new Date().toISOString()`
   - `progressBar.update(0, 3)`
   - `trackEvent('game_start', 'game')`
   - Show start TransitionScreen: title="Match Up!", subtitle="Compare ratios and find equivalents!", button="I'm ready!"
   - On button click -> `startPlaying()`

3. **startPlaying()** runs:
   - Hide transition screen
   - Show `#game-screen`
   - `renderRound()`

4. **renderRound()** runs:
   - Flush deferred `pendingEndProblem`
   - Get current round data from content
   - Determine stage from round number (1-3=Easy, 4-7=Mixed, 8-10=Hard)
   - If stage changed, show level transition screen (auto-dismiss 2s)
   - Update round label and stage badge
   - Start SignalCollector problem
   - If `type === "A"` -> `renderTypeA(roundData)`
   - If `type === "B"` -> `renderTypeB(roundData)`
   - SignalCollector `recordViewEvent('content_render', ...)`

5. **Type A interaction (Same or Different?):**
   - `renderTypeA()`: Show rule card + comparison card, show Type A buttons, hide Type B buttons
   - Kid clicks "Same ratio!" or "Different ratio!" -> `handleTypeAAnswer(answer)`
   - Compare answer to `roundData.correctAnswer` using fixed validation
   - If correct: green highlight on comparison card, show feedback, score++, play correct audio
   - If incorrect: red highlight, show feedback, lives--, play wrong audio
   - If lives <= 0 -> `endGame()`
   - Else: after 1.5s delay -> `nextRound()`

6. **Type B interaction (Make It Match!):**
   - `renderTypeB()`: Show rule card + multiplier badge + input fields, show Type B buttons, hide Type A buttons
   - Kid fills both inputs and clicks Submit -> `handleTypeBSubmit()`
   - Validate: field1 === baseRatio[0] * multiplier AND field2 === baseRatio[1] * multiplier
   - Partial feedback: mark each field independently as correct/incorrect
   - If both correct: show feedback, score++, play correct audio, show Next button
   - If any wrong: show feedback with hint, lives--, play wrong audio, show Retry button
   - If lives <= 0 -> `endGame()`

7. **End conditions — EVERY path that calls endGame():**
   - **All 10 rounds completed** -> `nextRound()` calls `endGame()` when `currentRound >= totalRounds`
   - **All lives lost** -> `handleTypeAAnswer()` or `handleTypeBSubmit()` calls `endGame()` when `lives <= 0`
   - `endGame()` calculates metrics, shows results screen or game-over TransitionScreen, sends postMessage, cleans up

---

## 9. Functions

### Global Scope (RULE-001)

**setupGame()**

- If `!gameState.content` -> `gameState.content = fallbackContent`
- Reset: `gameState.currentRound = 0`, `score = 0`, `lives = 3`, `stage = 1`, `attempts = []`, `events = []`, `pendingEndProblem = null`
- `gameState.startTime = Date.now()`
- `gameState.isActive = true`
- `gameState.duration_data.startTime = new Date().toISOString()`
- `progressBar.update(0, gameState.lives)`
- `trackEvent('game_start', 'game')`
- Show start transition:
  ```javascript
  transitionScreen.show({
    icons: ['\ud83d\udcca'],
    iconSize: 'large',
    title: 'Match Up!',
    subtitle: 'Compare ratios and find equivalents!',
    buttons: [{ text: "I'm ready!", type: 'primary', action: () => startPlaying() }]
  });
  ```

**startPlaying()**

- `transitionScreen.hide()`
- `document.getElementById('game-screen').style.display = 'flex'`
- `renderRound()`

**renderRound()**

- Flush deferred endProblem:
  ```javascript
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }
  ```
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `gameState.roundType = roundData.type`
- Compute stage: `const newStage = gameState.currentRound < 3 ? 1 : gameState.currentRound < 7 ? 2 : 3`
- If `newStage !== gameState.stage`:
  ```javascript
  gameState.stage = newStage;
  const stageNames = { 1: 'Easy', 2: 'Mixed', 3: 'Hard' };
  trackEvent('stage_change', 'game', { stage: newStage, name: stageNames[newStage] });
  transitionScreen.show({
    icons: ['\ud83c\udf1f'],
    iconSize: 'normal',
    title: 'Stage ' + newStage + ': ' + stageNames[newStage] + '!',
    titleStyles: { color: '#270F63', fontSize: '36px' },
    duration: 2000
  });
  setTimeout(() => renderRoundContent(roundData), 2100);
  return;
  ```
- Else: `renderRoundContent(roundData)`

**renderRoundContent(roundData)**

- Update round label: `document.getElementById('round-label').textContent = 'Round ' + (gameState.currentRound + 1) + ' of ' + gameState.totalRounds`
- Update stage badge
- Start signalCollector problem:
  ```javascript
  if (signalCollector) {
    signalCollector.startProblem('round_' + gameState.currentRound, {
      type: roundData.type,
      baseRatio: roundData.baseRatio,
      stage: gameState.stage
    });
  }
  ```
- Set rule card emojis and numbers from `roundData.baseRatio`, `roundData.emoji1`, `roundData.emoji2`
- Hide feedback area
- If `roundData.type === 'A'` -> `renderTypeA(roundData)`
- Else -> `renderTypeB(roundData)`
- SignalCollector recordViewEvent:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        round: gameState.currentRound,
        type: roundData.type,
        baseRatio: roundData.baseRatio,
        trigger: 'round_start'
      },
      components: {
        progress: { current: gameState.currentRound, total: gameState.totalRounds }
      }
    });
  }
  ```

**renderTypeA(roundData)**

- Show `#comparison-area`, hide `#production-area`
- Set comparison card emojis and numbers from `roundData.comparisonRatio`
- Remove any correct/incorrect classes from comparison card
- Show `#type-a-buttons`, hide `#type-b-buttons`
- Enable both buttons (remove disabled)

**renderTypeB(roundData)**

- Hide `#comparison-area`, show `#production-area`
- Set multiplier badge text: `'\u00d7' + roundData.multiplier`
- Set input emojis from `roundData.emoji1`, `roundData.emoji2`
- Clear input fields, remove correct/incorrect classes
- Show `#type-b-buttons`, hide `#type-a-buttons`
- Show `#btn-submit` and `#btn-reset`, hide `#btn-retry` and `#btn-next`
- Focus first input field

**async handleTypeAAnswer(answer)**

- If `!gameState.isActive` return
- Disable both Type A buttons
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = answer === roundData.correctAnswer` (fixed validation)
- `const compCard = document.getElementById('comparison-area')`
- If correct:
  - `compCard.classList.add('correct')`
  - `gameState.score++`
  - Show feedback: correct voiceOver text with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, answer })`
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }`
- Else:
  - `compCard.classList.add('incorrect')`
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Show feedback: incorrect voiceOver text with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, answer })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: answer,
    correct: isCorrect,
    question: 'Is ' + roundData.baseRatio.join(':') + ' same as ' + roundData.comparisonRatio.join(':') + '?',
    correctAnswer: roundData.correctAnswer,
    validationType: 'fixed'
  });
  ```
- Defer endProblem:
  ```javascript
  gameState.pendingEndProblem = {
    id: 'round_' + gameState.currentRound,
    outcome: isCorrect ? 'correct' : 'incorrect'
  };
  ```
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)` return
- `setTimeout(() => nextRound(), 1500)`

**async handleTypeBSubmit()**

- If `!gameState.isActive` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const val1 = parseInt(document.getElementById('input-field1').value)`
- `const val2 = parseInt(document.getElementById('input-field2').value)`
- If `isNaN(val1) || isNaN(val2)`: show feedback "Please fill in both numbers!" and return
- `const correct1 = val1 === roundData.baseRatio[0] * roundData.multiplier`
- `const correct2 = val2 === roundData.baseRatio[1] * roundData.multiplier`
- `const isCorrect = correct1 && correct2`
- Mark each input field:
  ```javascript
  document.getElementById('input-field1').classList.add(correct1 ? 'correct' : 'incorrect');
  document.getElementById('input-field2').classList.add(correct2 ? 'correct' : 'incorrect');
  ```
- Disable inputs
- If `isCorrect`:
  - `gameState.score++`
  - Show feedback: correct voiceOver text with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, val1, val2 })`
  - Show `#btn-next`, hide `#btn-submit`, `#btn-retry`, `#btn-reset`
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Build partial feedback:
    - If `correct1 && !correct2`: "First number correct! Check the second."
    - If `!correct1 && correct2`: "Second number correct! Check the first."
    - Else: voiceOver.incorrect or "Did you add instead of multiply? Multiply BOTH sides by the same number."
  - Show feedback with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, val1, val2, correct1, correct2 })`
  - If `gameState.lives <= 0`:
    - `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - Show `#btn-retry`, hide `#btn-submit`, `#btn-reset`
  - If lives > 0: show retry. Else: hide retry too.
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: feedbackMsg }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: val1 + ':' + val2,
    correct: isCorrect,
    question: roundData.baseRatio.join(':') + ' x' + roundData.multiplier,
    correctAnswer: (roundData.baseRatio[0] * roundData.multiplier) + ':' + (roundData.baseRatio[1] * roundData.multiplier),
    validationType: 'function'
  });
  ```
- Defer endProblem:
  ```javascript
  gameState.pendingEndProblem = {
    id: 'round_' + gameState.currentRound,
    outcome: isCorrect ? 'correct' : 'incorrect'
  };
  ```
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)`

**handleRetry()**

- Clear input fields, remove correct/incorrect classes
- Enable inputs
- Show `#btn-submit` and `#btn-reset`, hide `#btn-retry` and `#btn-next`
- Focus first input
- `if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'retry', round: gameState.currentRound } })`

**resetInputs()**

- Clear both input fields
- Remove correct/incorrect classes from inputs
- Focus first input

**nextRound()**

- `gameState.currentRound++`
- `progressBar.update(gameState.currentRound, gameState.lives)`
- If `gameState.currentRound >= gameState.totalRounds` -> `endGame()` return
- `renderRound()`

**endGame()**

- `if (!gameState.isActive) return`
- `gameState.isActive = false`
- `gameState.duration_data.currentTime = new Date().toISOString()`
- Flush pending endProblem
- Calculate metrics:
  ```javascript
  const correct = gameState.attempts.filter(a => a.correct).length;
  const total = gameState.attempts.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeTaken = Math.round((Date.now() - gameState.startTime) / 1000);
  const stars = accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy > 0 ? 1 : 0;
  ```
- Build metrics object:
  ```javascript
  const metrics = {
    accuracy,
    time: timeTaken,
    stars,
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: gameState.totalLives,
    tries: computeTriesPerRound(gameState.attempts),
    livesRemaining: gameState.lives
  };
  ```
- `console.log('Final Metrics:', JSON.stringify(metrics, null, 2))`
- `trackEvent('game_end', 'game', { metrics })`
- `if (signalCollector) signalCollector.seal()`
- If `gameState.lives <= 0`:
  ```javascript
  transitionScreen.show({
    icons: ['\ud83d\ude14'],
    iconSize: 'large',
    title: 'Game Over!',
    subtitle: 'All lives lost! You got ' + correct + ' out of ' + gameState.currentRound + ' correct.',
    buttons: [{ text: 'See Results', type: 'primary', action: () => showResults(metrics) }]
  });
  ```
- Else:
  ```javascript
  transitionScreen.show({
    stars: stars,
    title: stars === 3 ? 'Amazing!' : stars === 2 ? 'Great job!' : 'Good effort!',
    subtitle: correct + ' out of ' + gameState.totalRounds + ' correct!',
    buttons: [{ text: 'Claim Stars', type: 'primary', action: () => showResults(metrics) }]
  });
  ```
- PostMessage:
  ```javascript
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics,
      attempts: gameState.attempts,
      completedAt: Date.now()
    }
  }, '*');
  ```
- Cleanup:
  ```javascript
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
  ```

**computeTriesPerRound(attempts)**

```javascript
function computeTriesPerRound(attempts) {
  var rounds = {};
  attempts.forEach(function(a) {
    var r = a.metadata.round;
    rounds[r] = (rounds[r] || 0) + 1;
  });
  return Object.keys(rounds).map(function(r) {
    return { round: Number(r), triesCount: rounds[r] };
  });
}
```

**showResults(metrics)**

- `transitionScreen.hide()`
- `document.getElementById('game-screen').style.display = 'none'`
- `document.getElementById('result-score').textContent = metrics.accuracy + '%'`
- `document.getElementById('result-time').textContent = metrics.time + 's'`
- `document.getElementById('result-correct').textContent = gameState.attempts.filter(a => a.correct).length + '/' + gameState.attempts.length`
- `document.getElementById('result-lives').textContent = gameState.lives`
- `document.getElementById('stars-display').textContent = '\u2b50'.repeat(metrics.stars) + '\u2606'.repeat(3 - metrics.stars)`
- `document.getElementById('results-screen').style.display = 'block'`

**showButton(buttonId, containerId)**

```javascript
function showButton(buttonId, containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.game-btn').forEach(btn => btn.classList.add('hidden'));
  document.getElementById(buttonId).classList.remove('hidden');
}
```

**recordAttempt(data)**

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

**trackEvent(type, target, data)**

```javascript
function trackEvent(type, target, data) {
  gameState.events.push({
    type: type,
    target: target,
    timestamp: Date.now(),
    ...(data || {})
  });
}
```

**handlePostMessage(event)**

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }
  setupGame();
}
```

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    try {
      await FeedbackManager.sound.preload([
        { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
        { id: 'wrong_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
      ]);
    } catch(e) { console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2)); }

    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      gameId: 'ratio-match-up',
      contentSetId: null
    });
    window.signalCollector = signalCollector;

    const layout = ScreenLayout.inject('app', {
      slots: { progressBar: true, transitionScreen: true }
    });

    const gameContent = document.getElementById('gameContent');
    const template = document.getElementById('game-template');
    gameContent.appendChild(template.content.cloneNode(true));

    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: 10,
      totalLives: 3,
      slotId: 'mathai-progress-slot'
    });

    transitionScreen = new TransitionScreenComponent({ autoInject: true });

    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        const inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
        trackEvent('game_paused', 'system');
      },
      onResume: () => {
        const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (lastInactive && !lastInactive.end) {
          lastInactive.end = Date.now();
          gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
        }
        if (signalCollector) {
          signalCollector.resume();
          signalCollector.recordCustomEvent('visibility_visible', {});
        }
        FeedbackManager.sound.resume();
        FeedbackManager.stream.resumeAll();
        trackEvent('game_resumed', 'system');
      },
      popupProps: {
        title: 'Game Paused',
        description: 'Click Resume to continue.',
        primaryText: 'Resume'
      }
    });

    window.addEventListener('message', handlePostMessage);
    window.parent.postMessage({ type: 'game_ready' }, '*');

    setupGame();
  } catch (error) {
    console.error('Initialization failed:', JSON.stringify({ error: error.message }, null, 2));
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = function() {
  console.log('Game State:', JSON.stringify(gameState, null, 2));
};

window.debugAudio = function() {
  console.log('Audio State:', JSON.stringify({
    sound: FeedbackManager.sound.getState(),
    stream: FeedbackManager.stream.getState()
  }, null, 2));
};

window.testAudio = async function(id) {
  console.log('Testing audio:', id);
  try {
    await FeedbackManager.sound.play(id);
  } catch (e) {
    console.error('Audio test failed:', JSON.stringify({ error: e.message }, null, 2));
  }
};

window.testPause = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerInactive();
  } else {
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  }
  console.log(JSON.stringify({ event: 'testPause', paused: true }));
};

window.testResume = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerResume();
  } else {
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
  console.log(JSON.stringify({ event: 'testResume', resumed: true }));
};

window.debugSignals = function() {
  if (!signalCollector) {
    console.log('SignalCollector not initialized');
    return;
  }
  console.log('=== Signal Collector Debug ===');
  signalCollector.debug();
  console.log('Input events:', signalCollector.getInputEvents().length);
  console.log('Current view:', JSON.stringify(signalCollector.getCurrentView(), null, 2));
  console.log('Metadata:', JSON.stringify(signalCollector.getMetadata(), null, 2));
};
```

---

## 10. Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event        | Target | When Fired              |
| ------------ | ------ | ----------------------- |
| game_start   | game   | setupGame() completes   |
| game_end     | game   | endGame() fires         |
| game_paused  | system | VisibilityTracker fires |
| game_resumed | system | VisibilityTracker fires |

### Game-Specific Events

| Event          | Target | When Fired                              | Data                                                  |
| -------------- | ------ | --------------------------------------- | ----------------------------------------------------- |
| answer_correct | game   | User answers correctly (Type A or B)    | `{ round, answer }` or `{ round, val1, val2 }`       |
| answer_wrong   | game   | User answers incorrectly                | `{ round, answer }` or `{ round, val1, val2, correct1, correct2 }` |
| life_lost      | game   | Lives reach 0                           | `{ livesRemaining: 0 }`                              |
| stage_change   | game   | Player enters new stage                 | `{ stage, name }`                                    |

### SignalCollector Events

| Event            | Function              | Signal Type        | Content Snapshot Keys                              |
| ---------------- | --------------------- | ------------------ | -------------------------------------------------- |
| content_render   | renderRoundContent()  | recordViewEvent    | round, type, baseRatio, trigger                    |
| visual_update    | handleRetry()         | recordViewEvent    | type: 'retry', round                               |
| round_solved     | handleTypeAAnswer/handleTypeBSubmit | recordCustomEvent | round, correct, answer                |
| visibility_hidden| VisibilityTracker     | recordCustomEvent  | {}                                                 |
| visibility_visible| VisibilityTracker    | recordCustomEvent  | {}                                                 |

---

## 11. Scaffold Points

| Point            | Function              | When                        | What Can Be Injected                                    |
| ---------------- | --------------------- | --------------------------- | ------------------------------------------------------- |
| after_incorrect  | handleTypeAAnswer()   | Type A wrong answer         | Multiplicative reasoning hint, visual highlight          |
| after_incorrect  | handleTypeBSubmit()   | Type B wrong answer         | Partial credit hint, additive-vs-multiplicative scaffold |
| before_round     | renderRound()         | New round starts            | Difficulty preview, strategy tip                         |
| on_retry         | handleRetry()         | User retries Type B         | Worked example, step-by-step breakdown                   |
| stage_transition | renderRound()         | Stage changes               | Stage goal description, new mechanic introduction        |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point has a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 12. Feedback Triggers

| Moment              | Trigger Function      | Feedback Type               | Notes                                |
| ------------------- | --------------------- | --------------------------- | ------------------------------------ |
| Correct answer      | handleTypeAAnswer()   | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Correct answer      | handleTypeBSubmit()   | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Incorrect answer    | handleTypeAAnswer()   | sound + subtitle            | 'wrong_tap' + voiceOver.incorrect    |
| Incorrect answer    | handleTypeBSubmit()   | sound + subtitle            | 'wrong_tap' + partial hint           |
| Game complete (3 stars) | endGame()          | celebration transition      | Victory screen with stars            |
| Game over (0 lives) | endGame()             | game-over transition        | Encouragement subtitle               |

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
const FEEDBACK_IDS = {
  correct: 'correct_tap',
  incorrect: 'wrong_tap'
};
```

---

## 13. Visual Specifications

- **Layout:** Flex column, max-width 480px, centered. `100dvh` not `100vh`.
- **Color palette:**
  - Primary: `--mathai-purple` (#9B51E0) — rule card accent, multiplier badge
  - Secondary: `--mathai-orange` (#F2994A) — comparison card accent
  - Success: `--mathai-green` (#219653) — correct feedback, "Same ratio!" button
  - Error: `--mathai-red` (#E35757) — incorrect feedback, "Different ratio!" button
  - Background: `--mathai-cream` (#FFF8F0)
  - Text: `--mathai-text-primary` (#4a4a4a)
- **Typography:** Inter, title 24px, body 16px, label 14px, ratio numbers 22px bold purple
- **Spacing:** Container padding 16px, card padding 20px, gap between cards 16px
- **Interactive states:**
  - Buttons: hover lifts 2px with colored shadow, disabled 0.6 opacity
  - Inputs: focus blue border, correct green bg, incorrect red bg
  - Comparison card: correct green border+bg, incorrect red border+bg
- **Transitions:** 0.2s ease for all interactions, 0.3s fadeIn for feedback
- **Responsive:** Max-width 480px, cream background extends full screen behind

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers (Type A rounds)

```
SETUP: Page loaded, transition screen shown, click "I'm ready!" button
ACTIONS:
  Round 1 (Type A, same): click #btn-same
  wait 1500ms for auto-advance
  Round 2 (Type A, same): click #btn-same
  wait 1500ms
  Round 3 (Type A, different): click #btn-different
  wait 1500ms
  Round 4 (Type A, same): click #btn-same
  wait 1500ms
  Round 5 (Type B): type "6" in #input-field1, type "4" in #input-field2, click #btn-submit, click #btn-next
  Round 6 (Type A, different): click #btn-different
  wait 1500ms
  Round 7 (Type B): type "6" in #input-field1, type "15" in #input-field2, click #btn-submit, click #btn-next
  Round 8 (Type A, different): click #btn-different
  wait 1500ms
  Round 9 (Type B): type "16" in #input-field1, type "12" in #input-field2, click #btn-submit, click #btn-next
  Round 10 (Type B): type "10" in #input-field1, type "15" in #input-field2, click #btn-submit, click #btn-next
ASSERT:
  gameState.score === 10
  #results-screen is visible OR victory transition screen shown
  accuracy display shows "100%"
  stars display shows 3 stars
```

### Scenario: Type A — submit incorrect answer (same when different)

```
SETUP: Page loaded, click "I'm ready!", on Round 3 (Type A, correctAnswer=different)
ACTIONS:
  click #btn-same
ASSERT:
  #comparison-area has .incorrect class
  #feedback-area is visible
  #feedback-text has .incorrect-text class
  gameState.lives === 2
  gameState.attempts.length >= 3
  gameState.attempts[2].correct === false
  progressBar shows 2 lives remaining
```

### Scenario: Type B — submit correct answer

```
SETUP: Page loaded, advance to Round 5 (Type B, baseRatio=[3,2], multiplier=2)
ACTIONS:
  type "6" in #input-field1
  type "4" in #input-field2
  click #btn-submit
ASSERT:
  #input-field1 has .correct class
  #input-field2 has .correct class
  #feedback-text has .correct-text class
  #btn-next is visible
  #btn-submit has .hidden class
  #btn-retry has .hidden class
  gameState.score increases by 1
```

### Scenario: Type B — submit partial correct (first right, second wrong)

```
SETUP: Page loaded, advance to Round 5 (Type B, baseRatio=[3,2], multiplier=2)
ACTIONS:
  type "6" in #input-field1
  type "5" in #input-field2
  click #btn-submit
ASSERT:
  #input-field1 has .correct class
  #input-field2 has .incorrect class
  #feedback-text contains "First number correct"
  #feedback-text has .incorrect-text class
  #btn-retry is visible (if lives > 0)
  #btn-submit has .hidden class
  gameState.lives decremented by 1
```

### Scenario: Type B — reset clears input

```
SETUP: Page loaded, advance to Round 5 (Type B), user has typed values
ACTIONS:
  type "6" in #input-field1
  type "4" in #input-field2
  click #btn-reset
ASSERT:
  #input-field1 value is ""
  #input-field2 value is ""
  no .correct or .incorrect classes on inputs
  #btn-submit is visible
```

### Scenario: Game over — all lives lost

```
SETUP: Page loaded, click "I'm ready!"
ACTIONS:
  Round 1: click #btn-different (wrong — correctAnswer is "same") — lives=2
  wait 1500ms
  Round 2: click #btn-different (wrong — correctAnswer is "same") — lives=1
  wait 1500ms
  Round 3: click #btn-same (wrong — correctAnswer is "different") — lives=0
ASSERT:
  gameState.lives === 0
  gameState.isActive === false
  game-over transition screen shown with "Game Over!" title
  game_complete postMessage sent
  metrics.livesRemaining === 0
```

### Scenario: Stage transitions appear

```
SETUP: Page loaded, complete rounds 1-3 correctly
ACTIONS:
  After round 3, advance to round 4
ASSERT:
  stage transition screen appears with "Stage 2: Mixed!"
  transition auto-dismisses after ~2 seconds
  gameState.stage === 2
  stage_change event fired with { stage: 2, name: 'Mixed' }
```

### Scenario: Game ends after all 10 rounds

```
SETUP: Complete all 10 rounds (mix of correct/incorrect, keep at least 1 life)
ASSERT:
  gameState.isActive === false
  game_complete postMessage sent
  metrics.accuracy is calculated correctly
  metrics.stars matches accuracy thresholds (>=80%=3, >=50%=2, >0%=1)
  metrics.attempts.length >= 10
  each attempt has: attempt_timestamp, time_since_start_of_game, input_of_user, correct, attempt_number
  metrics.tries array has entry per round
  metrics.livesRemaining >= 1
```

### Scenario: PostMessage game_init loads custom content

```
SETUP: Page loaded
ACTIONS:
  Send postMessage { type: 'game_init', data: { content: { rounds: [...customRounds] } } }
ASSERT:
  gameState.content.rounds matches sent content
  Game renders first round from custom content
```

### Scenario: Debug functions work

```
SETUP: Page loaded, game started
ACTIONS:
  call window.debugGame()
  call window.debugAudio()
  call window.debugSignals()
ASSERT:
  console.log outputs contain JSON-stringified game state
  No errors thrown
```

### Scenario: Visibility pause/resume

```
SETUP: Page loaded, game active
ACTIONS:
  call window.testPause()
ASSERT:
  game_paused event tracked
  audio paused
ACTIONS:
  call window.testResume()
ASSERT:
  game_resumed event tracked
  duration_data.inActiveTime has entry with start and end
```

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (Sentry config -> Sentry SDK -> FeedbackManager -> Components -> Helpers)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `<div id="app"></div>` exists for ScreenLayout injection
- [ ] `<template id="game-template">` contains all game HTML
- [ ] `#game-screen` element exists inside template
- [ ] `#results-screen` element exists inside template, hidden by default
- [ ] All interactive elements have `data-signal-id` attributes

### Functional

- [ ] `waitForPackages()` defined and checks FeedbackManager, MathAIComponents, MathAIHelpers (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] Audio preloaded: correct_tap, wrong_tap (PART-017)
- [ ] SignalCollector created after FeedbackManager.init (PART-010)
- [ ] ScreenLayout.inject() called before ProgressBar/TransitionScreen (PART-025)
- [ ] Template content cloned into #gameContent after ScreenLayout.inject
- [ ] VisibilityTracker created with onInactive + onResume (PART-005)
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] game_ready postMessage sent after listener registered
- [ ] setupGame has fallback content for standalone testing (PART-008)
- [ ] recordAttempt produces correct attempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] endGame calculates metrics, logs, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition calls endGame():** rounds complete (nextRound), lives lost (handleTypeAAnswer, handleTypeBSubmit)
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals (PART-012)
- [ ] showResults populates all fields (PART-019)
- [ ] InputSchema defined with fallback content (PART-028)
- [ ] No anti-patterns present (PART-026)

### SignalCollector

- [ ] SignalCollector initialized AFTER FeedbackManager.init, BEFORE VisibilityTracker
- [ ] `window.signalCollector = signalCollector` set
- [ ] `startProblem()` called at start of each round in renderRoundContent()
- [ ] Deferred `endProblem` pattern: set `pendingEndProblem` after answer, flush at next renderRound() and in endGame()
- [ ] `recordViewEvent('content_render', ...)` called in renderRoundContent()
- [ ] `recordViewEvent('visual_update', ...)` called in handleRetry()
- [ ] `recordCustomEvent('round_solved', ...)` called after each answer
- [ ] `seal()` called in endGame() before postMessage
- [ ] SignalCollector paused/resumed in VisibilityTracker callbacks
- [ ] `signalConfig` handled in handlePostMessage for flush configuration

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors (PART-020)
- [ ] Gameplay feedback uses correct colors — green/red/blue/gray (PART-020)
- [ ] Max-width 480px, uses 100dvh not 100vh (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` / `.btn-same` / `.btn-different` classes (PART-022)
- [ ] Only one set of action buttons visible at a time (Type A or Type B) (PART-022)
- [ ] ProgressBar created with totalRounds=10, totalLives=3 (PART-023)
- [ ] TransitionScreen shows start, victory, game-over, and level screens (PART-024)
- [ ] ScreenLayout.inject() called before ProgressBar/TransitionScreen (PART-025)
- [ ] Rule card has purple accent border
- [ ] Comparison card has orange/yellow accent
- [ ] Multiplier badge is circular purple with white text
- [ ] Input fields side-by-side with emoji labels below

### Rules Compliance

- [ ] RULE-001: All onclick handlers (handleTypeAAnswer, handleTypeBSubmit, resetInputs, handleRetry, nextRound) in global scope
- [ ] RULE-002: handleTypeAAnswer and handleTypeBSubmit are async
- [ ] RULE-003: All FeedbackManager calls in try/catch
- [ ] RULE-004: All console.log uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame (visibilityTracker.destroy, FeedbackManager.sound.stopAll, FeedbackManager.stream.stopAll)
- [ ] RULE-006: No new Audio(), no setInterval, no SubtitleComponent.show()
- [ ] RULE-007: Single file — one `<style>` in `<head>`, one `<script>` in `<body>`, no external CSS/JS except CDN packages

### Game-Specific

- [ ] Type A rounds show rule card + comparison card + Same/Different buttons
- [ ] Type B rounds show rule card + multiplier badge + two input fields + Submit/Reset/Retry/Next buttons
- [ ] Type A: clicking Same or Different validates against correctAnswer
- [ ] Type B: both input fields validated independently — partial credit feedback
- [ ] Type B: "First number correct! Check the second." / "Second number correct! Check the first."
- [ ] Type B: additive trap hint on wrong answer ("Did you add instead of multiply?")
- [ ] Lives decrement on wrong answer, game ends at 0 lives
- [ ] Stage progression: rounds 1-3 = Easy, 4-7 = Mixed, 8-10 = Hard
- [ ] Stage transition screen shown when stage changes (auto-dismiss 2s)
- [ ] Stars: accuracy >= 80% = 3 stars, >= 50% = 2 stars, > 0% = 1 star, 0% = 0 stars
- [ ] ProgressBar updates after every round and life loss
- [ ] Retry on Type B only — clears inputs, re-enables fields, does NOT give back a life

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json (attempt_timestamp, time_since_start_of_game, input_of_user, correct, attempt_number, metadata)
- [ ] Metrics match contracts/metrics.schema.json (accuracy, time, stars, attempts, duration_data, totalLives, tries)
- [ ] postMessage out matches contracts/postmessage-out.schema.json (type: 'game_complete', data: { metrics, attempts, completedAt })
