# Ratio Explorer — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Ratio Explorer
- **Game ID:** equivalent-ratios
- **Type:** standard
- **Description:** Equivalent ratios game for Grade 5 covering all 5 testable skills: identify equivalent pairs (Type A), generate by multiplying both sides (Type B), find the missing value (Type C), complete a ratio table row (Type D), and choose the equivalent from MCQ options with distractors (Type E). 10 rounds, 3 lives, 3 stages of increasing difficulty. Only whole-number multipliers (x2–x5), values up to 50, part-to-part ratios.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                    |
| -------- | ----------------------------- | --------------- | --------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                               |
| PART-002 | Package Scripts               | YES             | —                                                               |
| PART-003 | waitForPackages               | YES             | —                                                               |
| PART-004 | Initialization Block          | YES             | —                                                               |
| PART-005 | VisibilityTracker             | YES             | Default popupProps                                              |
| PART-006 | TimerComponent                | NO              | No timer — practice-paced game                                  |
| PART-007 | Game State Object             | YES             | Custom: lives, totalLives, roundType, stage                    |
| PART-008 | PostMessage Protocol          | YES             | —                                                               |
| PART-009 | Attempt Tracking              | YES             | —                                                               |
| PART-010 | Event Tracking & SignalCollector | YES           | Custom events: answer_correct, answer_wrong, life_lost, stage_change |
| PART-011 | End Game & Metrics            | YES             | Stars: 80%->3, 50%->2, >0%->1                                  |
| PART-012 | Debug Functions               | YES             | —                                                               |
| PART-013 | Validation Fixed              | YES             | Type A (same/different), Type E (MCQ letter)                    |
| PART-014 | Validation Function           | YES             | Type B (both = base * mult), Type C (missing = other * mult), Type D (table cell = pattern) |
| PART-015 | Validation LLM                | NO              | —                                                               |
| PART-016 | StoriesComponent              | NO              | —                                                               |
| PART-017 | Feedback Integration          | YES             | Audio + subtitle on correct/incorrect                           |
| PART-018 | Case Converter                | NO              | —                                                               |
| PART-019 | Results Screen UI             | YES             | Custom: Lives Left metric row                                   |
| PART-020 | CSS Variables & Colors        | YES             | —                                                               |
| PART-021 | Screen Layout CSS             | YES             | —                                                               |
| PART-022 | Game Buttons                  | YES             | Varies per round type (see Section 5)                           |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 10, totalLives: 3                                  |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over, level (stage 2, stage 3)   |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                  |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating                     |
| PART-027 | Play Area Construction        | YES             | Layout: cards (A/E) + input fields (B/C) + table (D)           |
| PART-028 | InputSchema Patterns          | YES             | Schema type: questions with round types                         |
| PART-029 | Story-Only Game               | NO              | —                                                               |
| PART-030 | Sentry Error Tracking         | YES             | —                                                               |
| PART-031 | API Helper                    | NO              | —                                                               |
| PART-032 | AnalyticsManager              | NO              | —                                                               |
| PART-033 | Interaction Patterns          | NO              | —                                                               |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | —                                                               |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | —                                                               |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | —                                                               |
| PART-038 | InteractionManager            | NO              | —                                                               |

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
  gameId: 'equivalent-ratios',
  contentSetId: null,
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
  roundType: null,         // "A" | "B" | "C" | "D" | "E" — current round type
  stage: 1,                // 1=Warm-up, 2=Practice, 3=Challenge
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
          "type": { "type": "string", "enum": ["A", "B", "C", "D", "E"] },
          "skill": { "type": "integer", "minimum": 1, "maximum": 5 },
          "emoji1": { "type": "string" },
          "emoji2": { "type": "string" },
          "baseRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2,
            "description": "The original ratio [a, b]"
          },
          "multiplier": {
            "type": "integer",
            "description": "Types B/C/D/E — the multiplier used"
          },
          "comparisonRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2,
            "description": "Type A only — the ratio to compare"
          },
          "correctAnswer": {
            "type": "string",
            "description": "Type A: 'same'|'different'. Type E: 'A'|'B'|'C'|'D'."
          },
          "missingPosition": {
            "type": "string",
            "enum": ["first", "second"],
            "description": "Type C only — which value is hidden in the equivalent pair"
          },
          "tableData": {
            "type": "object",
            "description": "Type D only — ratio table with one blank",
            "properties": {
              "row1Label": { "type": "string" },
              "row2Label": { "type": "string" },
              "row1Values": { "type": "array", "items": { "type": ["integer", "null"] } },
              "row2Values": { "type": "array", "items": { "type": ["integer", "null"] } },
              "blankRow": { "type": "integer", "enum": [1, 2] },
              "blankCol": { "type": "integer" },
              "correctValue": { "type": "integer" }
            }
          },
          "mcqOptions": {
            "type": "array",
            "description": "Type E only — 4 ratio options",
            "items": {
              "type": "object",
              "properties": {
                "label": { "type": "string" },
                "ratio": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 },
                "trap": { "type": "string", "enum": ["none", "additive", "swap", "one-side"] }
              }
            }
          },
          "voiceOver": {
            "type": "object",
            "properties": {
              "correct": { "type": "string" },
              "incorrect": { "type": "string" }
            }
          }
        },
        "required": ["type", "skill", "emoji1", "emoji2", "baseRatio"]
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
    // --- Stage 1: Warm-up (rounds 1-3) — Skills 1 & 2, x2, small values ---
    {
      type: "A", skill: 1,
      emoji1: "\ud83c\udf4e", emoji2: "\ud83c\udf4a",
      baseRatio: [1, 2],
      comparisonRatio: [2, 4],
      correctAnswer: "same",
      voiceOver: {
        correct: "Yes! Both sides multiplied by 2. Same ratio!",
        incorrect: "Look \u2014 1\u00d72=2 and 2\u00d72=4. They match!"
      }
    },
    {
      type: "A", skill: 1,
      emoji1: "\ud83c\udfbe", emoji2: "\u26bd",
      baseRatio: [1, 3],
      comparisonRatio: [4, 6],
      correctAnswer: "different",
      voiceOver: {
        correct: "Good eye! 1\u00d74=4 but 3\u00d74=12, not 6. Different!",
        incorrect: "Adding 3 to each doesn't keep the ratio. 1:3 is not 4:6."
      }
    },
    {
      type: "B", skill: 2,
      emoji1: "\ud83d\udc31", emoji2: "\ud83d\udc36",
      baseRatio: [2, 3],
      multiplier: 2,
      voiceOver: {
        correct: "Nice! 2\u00d72=4 and 3\u00d72=6. Perfect!",
        incorrect: "Multiply BOTH sides by 2: 2\u00d72=4 and 3\u00d72=6."
      }
    },
    // --- Stage 2: Practice (rounds 4-7) — Skills 1-4, x2/x3 ---
    {
      type: "C", skill: 3,
      emoji1: "\ud83c\udf53", emoji2: "\ud83c\udf4c",
      baseRatio: [3, 4],
      multiplier: 3,
      missingPosition: "second",
      voiceOver: {
        correct: "Exactly! 3\u00d73=9, so 4\u00d73=12.",
        incorrect: "3 became 9 \u2014 that's \u00d73. So 4\u00d73=12."
      }
    },
    {
      type: "D", skill: 4,
      emoji1: "\ud83c\udf39", emoji2: "\ud83c\udf3b",
      baseRatio: [2, 3],
      multiplier: 2,
      tableData: {
        row1Label: "\ud83c\udf39 Red",
        row2Label: "\ud83c\udf3b Yellow",
        row1Values: [2, 4, 6, null],
        row2Values: [3, 6, 9, 12],
        blankRow: 1,
        blankCol: 3,
        correctValue: 8
      },
      voiceOver: {
        correct: "That's right! The pattern is +2 each time: 2, 4, 6, 8.",
        incorrect: "Look at row 1: 2, 4, 6, ___. Each goes up by 2, so it's 8."
      }
    },
    {
      type: "B", skill: 2,
      emoji1: "\ud83d\ude80", emoji2: "\ud83c\udf1f",
      baseRatio: [4, 5],
      multiplier: 3,
      voiceOver: {
        correct: "Great! 4\u00d73=12 and 5\u00d73=15.",
        incorrect: "Did you add 3 instead of multiply? 4\u00d73=12 and 5\u00d73=15."
      }
    },
    {
      type: "C", skill: 3,
      emoji1: "\ud83d\udc1d", emoji2: "\ud83c\udf3a",
      baseRatio: [2, 5],
      multiplier: 3,
      missingPosition: "first",
      voiceOver: {
        correct: "Yes! 5\u00d73=15, so 2\u00d73=6.",
        incorrect: "5 became 15 \u2014 that's \u00d73. So 2\u00d73=6."
      }
    },
    // --- Stage 3: Challenge (rounds 8-10) — All skills, x3/x4/x5, traps ---
    {
      type: "E", skill: 5,
      emoji1: "\ud83c\udf81", emoji2: "\ud83c\udf88",
      baseRatio: [3, 5],
      multiplier: 2,
      correctAnswer: "A",
      mcqOptions: [
        { label: "A", ratio: [6, 10], trap: "none" },
        { label: "B", ratio: [6, 8], trap: "additive" },
        { label: "C", ratio: [5, 3], trap: "swap" },
        { label: "D", ratio: [9, 12], trap: "one-side" }
      ],
      voiceOver: {
        correct: "Right! 3\u00d72=6 and 5\u00d72=10. That's the match!",
        incorrect: "Check each option: 3\u00d72=6 and 5\u00d72=10. Only A works!"
      }
    },
    {
      type: "D", skill: 4,
      emoji1: "\ud83c\udf52", emoji2: "\ud83c\udf47",
      baseRatio: [3, 4],
      multiplier: 3,
      tableData: {
        row1Label: "\ud83c\udf52 Cherry",
        row2Label: "\ud83c\udf47 Grape",
        row1Values: [3, 6, 9, 12],
        row2Values: [4, 8, null, 16],
        blankRow: 2,
        blankCol: 2,
        correctValue: 12
      },
      voiceOver: {
        correct: "Correct! The pattern is +4 each time: 4, 8, 12, 16.",
        incorrect: "Row 2 goes: 4, 8, ___, 16. Each step adds 4, so it's 12."
      }
    },
    {
      type: "E", skill: 5,
      emoji1: "\ud83c\udf1f", emoji2: "\ud83c\udf19",
      baseRatio: [4, 3],
      multiplier: 4,
      correctAnswer: "C",
      mcqOptions: [
        { label: "A", ratio: [8, 7], trap: "additive" },
        { label: "B", ratio: [3, 4], trap: "swap" },
        { label: "C", ratio: [16, 12], trap: "none" },
        { label: "D", ratio: [12, 12], trap: "one-side" }
      ],
      voiceOver: {
        correct: "Yes! 4\u00d74=16 and 3\u00d74=12. Option C is equivalent!",
        incorrect: "Multiply both by the same number: 4\u00d74=16, 3\u00d74=12. That's option C."
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
      <div id="stage-badge" class="stage-badge">Stage 1: Warm-up</div>
      <h2 id="question-prompt" class="question-prompt"></h2>
    </div>

    <!-- Type A: Identify — Two ratio cards, "Same or Different?" -->
    <div class="type-a-area hidden" id="type-a-area">
      <div class="rule-card" id="rule-card-a">
        <p class="rule-text">For every <span id="rule-a-num1" class="ratio-number">1</span> <span id="rule-a-emoji1"></span>, there are <span id="rule-a-num2" class="ratio-number">2</span> <span id="rule-a-emoji2"></span></p>
      </div>
      <div class="comparison-card" id="comparison-card">
        <p class="comparison-text">For every <span id="comp-num1" class="ratio-number">2</span> <span id="comp-emoji1"></span>, there are <span id="comp-num2" class="ratio-number">4</span> <span id="comp-emoji2"></span></p>
      </div>
    </div>

    <!-- Type B: Generate — Rule card + multiplier badge + two inputs -->
    <div class="type-b-area hidden" id="type-b-area">
      <div class="rule-card" id="rule-card-b">
        <p class="rule-text">For every <span id="rule-b-num1" class="ratio-number">2</span> <span id="rule-b-emoji1"></span>, there are <span id="rule-b-num2" class="ratio-number">3</span> <span id="rule-b-emoji2"></span></p>
      </div>
      <div class="multiplier-badge" id="multiplier-badge">&times;2</div>
      <div class="input-row">
        <div class="input-group">
          <input type="number" class="game-input" id="input-b-field1" data-signal-id="input-b-field1" placeholder="?" inputmode="numeric" />
          <span class="input-emoji" id="input-b-emoji1"></span>
        </div>
        <div class="input-group">
          <input type="number" class="game-input" id="input-b-field2" data-signal-id="input-b-field2" placeholder="?" inputmode="numeric" />
          <span class="input-emoji" id="input-b-emoji2"></span>
        </div>
      </div>
    </div>

    <!-- Type C: Missing Value — Ratio equation with one blank -->
    <div class="type-c-area hidden" id="type-c-area">
      <div class="ratio-equation">
        <div class="ratio-pair">
          <span id="ratio-c-a" class="ratio-value">3</span>
          <span class="ratio-colon">:</span>
          <span id="ratio-c-b" class="ratio-value">4</span>
        </div>
        <span class="equals-sign">=</span>
        <div class="ratio-pair">
          <span id="ratio-c-c" class="ratio-value">9</span>
          <span class="ratio-colon">:</span>
          <span id="ratio-c-d" class="ratio-value">?</span>
        </div>
      </div>
      <div class="input-row single-input">
        <div class="input-group">
          <input type="number" class="game-input" id="input-c-field" data-signal-id="input-c-field" placeholder="?" inputmode="numeric" />
        </div>
      </div>
    </div>

    <!-- Type D: Ratio Table — Grid with one blank cell -->
    <div class="type-d-area hidden" id="type-d-area">
      <div class="ratio-table-container">
        <table class="ratio-table" id="ratio-table">
          <thead>
            <tr id="table-header-row"></tr>
          </thead>
          <tbody>
            <tr id="table-row1"></tr>
            <tr id="table-row2"></tr>
          </tbody>
        </table>
      </div>
      <div class="input-row single-input">
        <div class="input-group">
          <input type="number" class="game-input" id="input-d-field" data-signal-id="input-d-field" placeholder="?" inputmode="numeric" />
        </div>
      </div>
    </div>

    <!-- Type E: MCQ — Target ratio + 4 option cards -->
    <div class="type-e-area hidden" id="type-e-area">
      <div class="rule-card" id="rule-card-e">
        <p class="rule-text">Which ratio is equivalent to <span id="rule-e-num1" class="ratio-number">3</span> <span id="rule-e-emoji1"></span> : <span id="rule-e-num2" class="ratio-number">5</span> <span id="rule-e-emoji2"></span> ?</p>
      </div>
      <div class="mcq-grid" id="mcq-grid">
        <button class="mcq-option" id="mcq-A" data-signal-id="mcq-A" onclick="handleMCQSelect('A')">
          <span class="mcq-label">A</span>
          <span class="mcq-ratio" id="mcq-ratio-A">6 : 10</span>
        </button>
        <button class="mcq-option" id="mcq-B" data-signal-id="mcq-B" onclick="handleMCQSelect('B')">
          <span class="mcq-label">B</span>
          <span class="mcq-ratio" id="mcq-ratio-B">6 : 8</span>
        </button>
        <button class="mcq-option" id="mcq-C" data-signal-id="mcq-C" onclick="handleMCQSelect('C')">
          <span class="mcq-label">C</span>
          <span class="mcq-ratio" id="mcq-ratio-C">5 : 3</span>
        </button>
        <button class="mcq-option" id="mcq-D" data-signal-id="mcq-D" onclick="handleMCQSelect('D')">
          <span class="mcq-label">D</span>
          <span class="mcq-ratio" id="mcq-ratio-D">9 : 12</span>
        </button>
      </div>
    </div>

    <!-- Feedback Section (shared by all types) -->
    <div class="feedback-section hidden" id="feedback-area">
      <p id="feedback-text" class="feedback-text"></p>
    </div>
  </div>

  <!-- Type A Buttons -->
  <div class="btn-container hidden" id="type-a-buttons">
    <button class="game-btn btn-same" id="btn-same" data-signal-id="btn-same" onclick="handleTypeAAnswer('same')">Same ratio!</button>
    <button class="game-btn btn-different" id="btn-different" data-signal-id="btn-different" onclick="handleTypeAAnswer('different')">Different ratio!</button>
  </div>

  <!-- Type B/C/D Buttons (input-based rounds) -->
  <div class="btn-container hidden" id="input-buttons">
    <button class="game-btn btn-secondary" id="btn-reset" data-signal-id="btn-reset" onclick="resetInputs()">Reset</button>
    <button class="game-btn btn-primary" id="btn-submit" data-signal-id="btn-submit" onclick="handleSubmit()">Submit</button>
    <button class="game-btn btn-secondary hidden" id="btn-retry" data-signal-id="btn-retry" onclick="handleRetry()">Retry</button>
    <button class="game-btn btn-primary hidden" id="btn-next" data-signal-id="btn-next" onclick="nextRound()">Next</button>
  </div>

  <!-- Type E Buttons (MCQ — submit selected option) -->
  <div class="btn-container hidden" id="type-e-buttons">
    <button class="game-btn btn-primary" id="btn-confirm" data-signal-id="btn-confirm" onclick="handleMCQSubmit()" disabled>Confirm</button>
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

.question-prompt {
  font-size: 18px;
  font-weight: 600;
  color: var(--mathai-text-primary);
  margin-top: 4px;
}

/* === Rule Card (shared by A, B, E) === */
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
  transition: all 0.3s ease;
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

/* === Multiplier Badge (Type B) === */
.type-b-area {
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

/* === Input Row (shared by B, C, D) === */
.input-row {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
}

.input-row.single-input {
  gap: 0;
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
  transition: border-color 0.2s ease, background 0.2s ease;
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

/* === Ratio Equation (Type C) === */
.type-c-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.ratio-equation {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 28px;
  font-weight: 700;
}

.ratio-pair {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--mathai-white);
  padding: 12px 20px;
  border-radius: var(--mathai-border-radius-card);
  border: 2px solid var(--mathai-border-gray);
}

.ratio-value {
  color: var(--mathai-purple);
  font-size: 28px;
  font-weight: 700;
  min-width: 32px;
  text-align: center;
}

.ratio-value.blank {
  color: var(--mathai-blue);
  border-bottom: 3px dashed var(--mathai-blue);
  padding-bottom: 2px;
}

.ratio-colon {
  color: var(--mathai-gray);
  font-weight: 400;
}

.equals-sign {
  color: var(--mathai-gray);
  font-size: 28px;
}

/* === Ratio Table (Type D) === */
.type-d-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.ratio-table-container {
  width: 100%;
  max-width: 360px;
  overflow-x: auto;
}

.ratio-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--mathai-white);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.ratio-table th, .ratio-table td {
  padding: 12px 16px;
  text-align: center;
  border: 1px solid var(--mathai-border-gray);
  font-size: 18px;
  font-weight: 600;
}

.ratio-table th {
  background: var(--mathai-light-gray);
  color: var(--mathai-gray);
  font-size: var(--mathai-font-size-small);
  font-weight: 500;
}

.ratio-table td.blank-cell {
  background: var(--mathai-light-blue);
  color: var(--mathai-blue);
  font-weight: 700;
  border: 2px dashed var(--mathai-blue);
}

.ratio-table td.blank-cell.correct {
  background: var(--mathai-light-green);
  border-color: var(--mathai-green);
  color: var(--mathai-green);
}

.ratio-table td.blank-cell.incorrect {
  background: var(--mathai-light-red);
  border-color: var(--mathai-red);
  color: var(--mathai-red);
}

.ratio-table td.label-cell {
  text-align: left;
  font-size: var(--mathai-font-size-label);
  background: #FAFAFA;
}

/* === MCQ Grid (Type E) === */
.type-e-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mcq-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 360px;
  margin: 0 auto;
  width: 100%;
}

.mcq-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--mathai-white);
  border: 2px solid var(--mathai-border-gray);
  border-radius: var(--mathai-border-radius-card);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--mathai-font-family);
}

.mcq-option:hover:not(:disabled) {
  border-color: var(--mathai-purple);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(155, 81, 224, 0.15);
}

.mcq-option.selected {
  border-color: var(--mathai-purple);
  background: #F3ECFF;
  box-shadow: 0 0 0 3px rgba(155, 81, 224, 0.2);
}

.mcq-option.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
}

.mcq-option.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
}

.mcq-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.mcq-label {
  font-size: var(--mathai-font-size-small);
  font-weight: 600;
  color: var(--mathai-gray);
  background: var(--mathai-light-gray);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mcq-ratio {
  font-size: 20px;
  font-weight: 700;
  color: var(--mathai-text-primary);
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

<!-- STEP 2: Sentry SDK v10.23.0 (3 scripts, NO integrity attribute) -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- STEP 3-5: Game packages (exact URLs, in this order) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - `waitForPackages()` — waits for FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector
   - `FeedbackManager.init()`
   - Preload audio: correct_tap, wrong_tap
   - `SignalCollector` creation
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `#game-template` content into `#gameContent`
   - `ProgressBarComponent` creation (totalRounds: 10, totalLives: 3)
   - `TransitionScreenComponent` creation
   - `VisibilityTracker` creation
   - Register `handlePostMessage` listener
   - Send `game_ready` postMessage
   - `setupGame()`

2. **setupGame()** runs:
   - Load content from `gameState.content` or `fallbackContent`
   - Reset state: currentRound=0, score=0, lives=3, stage=1, attempts=[], events=[], pendingEndProblem=null
   - Set `gameState.startTime = Date.now()`, `gameState.isActive = true`
   - Set `gameState.duration_data.startTime = new Date().toISOString()`
   - `progressBar.update(0, 3)`
   - `trackEvent('game_start', 'game')`
   - Show start TransitionScreen: title="Ratio Explorer", subtitle="Can you spot and build equivalent ratios?", button="Let's go!"
   - On button click -> `startPlaying()`

3. **startPlaying()** runs:
   - `transitionScreen.hide()`
   - Show `#game-screen`
   - `renderRound()`

4. **renderRound()** runs:
   - Flush deferred `pendingEndProblem`
   - Get current round data from content
   - Determine stage from round number (0-2=Warm-up, 3-6=Practice, 7-9=Challenge)
   - If stage changed, show level transition screen (auto-dismiss 2s)
   - Update round label and stage badge
   - Set question prompt based on type
   - Start SignalCollector problem
   - Hide all type areas, then show the one matching `roundData.type`
   - Call appropriate render function: `renderTypeA/B/C/D/E(roundData)`
   - Show matching button container, hide others
   - SignalCollector `recordViewEvent('content_render', ...)`

5. **Type A interaction (Same or Different?):**
   - `renderTypeA()`: Populate rule card + comparison card with ratio values and emojis
   - Kid clicks "Same ratio!" or "Different ratio!" -> `handleTypeAAnswer(answer)`
   - Compare answer to `roundData.correctAnswer` (fixed validation)
   - If correct: green highlight on comparison card, show feedback, score++, play correct_tap
   - If incorrect: red highlight, show feedback, lives--, play wrong_tap
   - Record attempt + defer endProblem
   - If lives <= 0 -> `endGame()` after 1.5s
   - Else -> `nextRound()` after 1.5s

6. **Type B interaction (Generate equivalent ratio):**
   - `renderTypeB()`: Show rule card + multiplier badge + two empty input fields
   - Kid fills both inputs, clicks Submit -> `handleSubmit()` (dispatches to `handleTypeBSubmit()`)
   - Validate: field1 === baseRatio[0] * multiplier AND field2 === baseRatio[1] * multiplier
   - Mark each input independently as correct/incorrect
   - If both correct: score++, show Next
   - If any wrong: lives--, show Retry (or endGame if lives=0)
   - Record attempt + defer endProblem

7. **Type C interaction (Find missing value):**
   - `renderTypeC()`: Show ratio equation a:b = c:? or a:b = ?:d
   - Kid types the missing number, clicks Submit -> `handleSubmit()` (dispatches to `handleTypeCSubmit()`)
   - Validate: if missingPosition="second", answer === baseRatio[1] * multiplier. If "first", answer === baseRatio[0] * multiplier.
   - Show correct/incorrect feedback on input
   - Record attempt + defer endProblem

8. **Type D interaction (Complete ratio table):**
   - `renderTypeD()`: Build table from `tableData`, mark blank cell with "?" styling
   - Kid types the missing value, clicks Submit -> `handleSubmit()` (dispatches to `handleTypeDSubmit()`)
   - Validate: answer === tableData.correctValue
   - Show correct/incorrect on blank cell
   - Record attempt + defer endProblem

9. **Type E interaction (MCQ — choose equivalent ratio):**
   - `renderTypeE()`: Show target ratio card + 4 MCQ option cards
   - Kid clicks an option -> `handleMCQSelect(label)` selects/deselects it, enables Confirm
   - Kid clicks Confirm -> `handleMCQSubmit()`
   - Validate: selectedOption === roundData.correctAnswer (fixed)
   - Highlight correct option green, wrong selection red
   - Record attempt + defer endProblem
   - Auto-advance after 1.5s

10. **End conditions — EVERY path that calls endGame():**
    - **All 10 rounds completed** -> `nextRound()` calls `endGame()` when `currentRound >= totalRounds`
    - **All lives lost** -> any answer handler calls `endGame()` when `lives <= 0`
    - `endGame()` calculates metrics, shows results/game-over TransitionScreen, sends postMessage, cleans up

---

## 9. Functions

### Global Scope (RULE-001)

**setupGame()**

- If `!gameState.content` -> `gameState.content = fallbackContent`
- Reset: `gameState.currentRound = 0`, `score = 0`, `lives = 3`, `stage = 1`, `attempts = []`, `events = []`, `pendingEndProblem = null`, `sessionHistory = []`
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
    title: 'Ratio Explorer',
    subtitle: 'Can you spot and build equivalent ratios?',
    buttons: [{ text: "Let's go!", type: 'primary', action: () => startPlaying() }]
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
  const stageNames = { 1: 'Warm-up', 2: 'Practice', 3: 'Challenge' };
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
- Update stage badge: `document.getElementById('stage-badge').textContent = 'Stage ' + gameState.stage + ': ' + stageNames[gameState.stage]`
- Set question prompt based on type:
  - A: "Same ratio or different?"
  - B: "Multiply both sides to make an equivalent ratio!"
  - C: "Find the missing number!"
  - D: "Complete the ratio table!"
  - E: "Which ratio is equivalent?"
- Start signalCollector problem:
  ```javascript
  if (signalCollector) {
    signalCollector.startProblem('round_' + gameState.currentRound, {
      type: roundData.type,
      skill: roundData.skill,
      baseRatio: roundData.baseRatio,
      stage: gameState.stage
    });
  }
  ```
- Hide all type areas: `['type-a-area', 'type-b-area', 'type-c-area', 'type-d-area', 'type-e-area'].forEach(id => document.getElementById(id).classList.add('hidden'))`
- Hide all button containers: `['type-a-buttons', 'input-buttons', 'type-e-buttons'].forEach(id => document.getElementById(id).classList.add('hidden'))`
- Hide feedback area
- Dispatch to render function + show matching buttons:
  ```javascript
  if (roundData.type === 'A') {
    renderTypeA(roundData);
    document.getElementById('type-a-buttons').classList.remove('hidden');
  } else if (roundData.type === 'E') {
    renderTypeE(roundData);
    document.getElementById('type-e-buttons').classList.remove('hidden');
  } else {
    // B, C, D all use input-buttons
    if (roundData.type === 'B') renderTypeB(roundData);
    else if (roundData.type === 'C') renderTypeC(roundData);
    else if (roundData.type === 'D') renderTypeD(roundData);
    document.getElementById('input-buttons').classList.remove('hidden');
    showButton('btn-submit');
  }
  ```
- RecordViewEvent:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        round: gameState.currentRound,
        type: roundData.type,
        skill: roundData.skill,
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

- Show `#type-a-area`
- Populate rule card A: `rule-a-num1` = baseRatio[0], `rule-a-num2` = baseRatio[1], `rule-a-emoji1/2` = emoji1/2
- Populate comparison card: `comp-num1` = comparisonRatio[0], `comp-num2` = comparisonRatio[1], `comp-emoji1/2` = emoji1/2
- Remove correct/incorrect classes from comparison card
- Enable both Same/Different buttons

**renderTypeB(roundData)**

- Show `#type-b-area`
- Populate rule card B: `rule-b-num1` = baseRatio[0], `rule-b-num2` = baseRatio[1], `rule-b-emoji1/2` = emoji1/2
- Set multiplier badge: `'\u00d7' + roundData.multiplier`
- Set input emojis: `input-b-emoji1/2` = emoji1/2
- Clear inputs, remove correct/incorrect classes, enable inputs
- Focus first input

**renderTypeC(roundData)**

- Show `#type-c-area`
- Set `ratio-c-a` = baseRatio[0], `ratio-c-b` = baseRatio[1]
- If `missingPosition === 'second'`:
  - `ratio-c-c` = baseRatio[0] * multiplier
  - `ratio-c-d` text = "?", add class `blank`
- If `missingPosition === 'first'`:
  - `ratio-c-c` text = "?", add class `blank`
  - `ratio-c-d` = baseRatio[1] * multiplier
- Clear input-c-field, remove feedback classes, enable input, focus it

**renderTypeD(roundData)**

- Show `#type-d-area`
- `const td = roundData.tableData`
- Build table header: empty corner cell + column indices ("1", "2", "3", "4")
- Build row 1: label cell `td.row1Label` + value cells from `td.row1Values` (null = "?" with `blank-cell` class)
- Build row 2: label cell `td.row2Label` + value cells from `td.row2Values` (null = "?" with `blank-cell` class)
- Clear input-d-field, remove feedback classes, enable input, focus it

**renderTypeE(roundData)**

- Show `#type-e-area`
- Populate rule card E: `rule-e-num1` = baseRatio[0], `rule-e-num2` = baseRatio[1], `rule-e-emoji1/2` = emoji1/2
- Reset `gameState.selectedMCQ = null`
- For each option in `roundData.mcqOptions`:
  ```javascript
  const btn = document.getElementById('mcq-' + option.label);
  btn.disabled = false;
  btn.classList.remove('selected', 'correct', 'incorrect');
  document.getElementById('mcq-ratio-' + option.label).textContent = option.ratio[0] + ' : ' + option.ratio[1];
  ```
- Disable Confirm button until selection

**handleMCQSelect(label)**

- If `!gameState.isActive` return
- Remove `.selected` from all mcq-option buttons
- Add `.selected` to clicked button
- `gameState.selectedMCQ = label`
- Enable `#btn-confirm`
- `trackEvent('tap', 'mcq', { label })`

**async handleTypeAAnswer(answer)**

- If `!gameState.isActive` return
- Disable both Type A buttons
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = answer === roundData.correctAnswer`
- `const compCard = document.getElementById('comparison-card')`
- If correct:
  - `compCard.classList.add('correct')`
  - `gameState.score++`
  - Show feedback: voiceOver.correct with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'A', answer })`
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }`
- Else:
  - `compCard.classList.add('incorrect')`
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Show feedback: voiceOver.incorrect with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'A', answer })`
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }`
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
- Defer endProblem: `gameState.pendingEndProblem = { id: 'round_' + gameState.currentRound, outcome: isCorrect ? 'correct' : 'incorrect' }`
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)` return
- `setTimeout(() => nextRound(), 1500)`

**handleSubmit()**

Dispatch based on current round type:
```javascript
function handleSubmit() {
  const roundData = gameState.content.rounds[gameState.currentRound];
  if (roundData.type === 'B') handleTypeBSubmit();
  else if (roundData.type === 'C') handleTypeCSubmit();
  else if (roundData.type === 'D') handleTypeDSubmit();
}
```

**async handleTypeBSubmit()**

- If `!gameState.isActive` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const val1 = parseInt(document.getElementById('input-b-field1').value)`
- `const val2 = parseInt(document.getElementById('input-b-field2').value)`
- If `isNaN(val1) || isNaN(val2)`: show feedback "Please fill in both numbers!" return
- `const correct1 = val1 === roundData.baseRatio[0] * roundData.multiplier`
- `const correct2 = val2 === roundData.baseRatio[1] * roundData.multiplier`
- `const isCorrect = correct1 && correct2`
- Mark each input: `input-b-field1/2` gets `correct` or `incorrect` class
- Disable inputs
- If correct:
  - `gameState.score++`
  - Show feedback: voiceOver.correct with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'B', val1, val2 })`
  - showButton('btn-next')
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Build partial hint: if `correct1 && !correct2` -> "First number correct! Check the second." Else if `!correct1 && correct2` -> "Second number correct! Check the first." Else -> voiceOver.incorrect
  - Show feedback with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'B', val1, val2, correct1, correct2 })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - If lives > 0: showButton('btn-retry'). Else: hide all input buttons.
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: feedbackMsg }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: val1 + ':' + val2,
    correct: isCorrect,
    question: roundData.baseRatio.join(':') + ' \u00d7' + roundData.multiplier,
    correctAnswer: (roundData.baseRatio[0] * roundData.multiplier) + ':' + (roundData.baseRatio[1] * roundData.multiplier),
    validationType: 'function'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)`

**async handleTypeCSubmit()**

- If `!gameState.isActive` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const val = parseInt(document.getElementById('input-c-field').value)`
- If `isNaN(val)`: show feedback "Type a number!" return
- Compute correct answer:
  ```javascript
  const correctVal = roundData.missingPosition === 'second'
    ? roundData.baseRatio[1] * roundData.multiplier
    : roundData.baseRatio[0] * roundData.multiplier;
  ```
- `const isCorrect = val === correctVal`
- Mark input-c-field with correct/incorrect class, disable it
- If correct:
  - `gameState.score++`
  - Update the "?" display in the equation to show the correct number
  - Show feedback with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'C', val })`
  - showButton('btn-next')
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Show feedback: voiceOver.incorrect with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'C', val })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - If lives > 0: showButton('btn-retry'). Else: hide all.
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: val,
    correct: isCorrect,
    question: roundData.baseRatio.join(':') + ' = ' + (roundData.missingPosition === 'second' ? (roundData.baseRatio[0] * roundData.multiplier) + ':?' : '?:' + (roundData.baseRatio[1] * roundData.multiplier)),
    correctAnswer: correctVal,
    validationType: 'function'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)`

**async handleTypeDSubmit()**

- If `!gameState.isActive` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const val = parseInt(document.getElementById('input-d-field').value)`
- If `isNaN(val)`: show feedback "Type a number!" return
- `const isCorrect = val === roundData.tableData.correctValue`
- Mark blank table cell with correct/incorrect class; update cell text to show submitted value
- Disable input
- If correct:
  - `gameState.score++`
  - Show feedback with `correct-text`
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'D', val })`
  - showButton('btn-next')
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Show feedback with `incorrect-text`
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'D', val })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - If lives > 0: showButton('btn-retry'). Else: hide all.
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: val,
    correct: isCorrect,
    question: 'Table: fill blank at row ' + roundData.tableData.blankRow + ' col ' + roundData.tableData.blankCol,
    correctAnswer: roundData.tableData.correctValue,
    validationType: 'function'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)`

**async handleMCQSubmit()**

- If `!gameState.isActive || !gameState.selectedMCQ` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = gameState.selectedMCQ === roundData.correctAnswer`
- Disable all MCQ buttons
- Highlight correct option green: `document.getElementById('mcq-' + roundData.correctAnswer).classList.add('correct')`
- If wrong, highlight selected red: `document.getElementById('mcq-' + gameState.selectedMCQ).classList.add('incorrect')`
- Disable Confirm button
- If correct:
  - `gameState.score++`
  - Show feedback: voiceOver.correct with `correct-text`
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'E', selected: gameState.selectedMCQ })`
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - Show feedback: voiceOver.incorrect with `incorrect-text`
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'E', selected: gameState.selectedMCQ, correct: roundData.correctAnswer })`
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: gameState.selectedMCQ,
    correct: isCorrect,
    question: 'Which is equivalent to ' + roundData.baseRatio.join(':') + '?',
    correctAnswer: roundData.correctAnswer,
    validationType: 'fixed'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)` return
- `setTimeout(() => nextRound(), 1500)`

**handleRetry()**

- `const roundData = gameState.content.rounds[gameState.currentRound]`
- If type B: clear both inputs, remove correct/incorrect classes, enable inputs, focus first
- If type C: clear input-c-field, remove classes, enable, focus
- If type D: clear input-d-field, remove classes from input AND blank table cell, enable, focus
- Show `#btn-submit` and `#btn-reset`, hide `#btn-retry` and `#btn-next`
- `if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'retry', round: gameState.currentRound } })`

**resetInputs()**

- `const roundData = gameState.content.rounds[gameState.currentRound]`
- If type B: clear `input-b-field1` and `input-b-field2`, remove classes, focus first
- If type C: clear `input-c-field`, remove classes, focus
- If type D: clear `input-d-field`, remove classes, focus

**nextRound()**

- `gameState.currentRound++`
- `progressBar.update(gameState.currentRound, gameState.lives)`
- If `gameState.currentRound >= gameState.totalRounds` -> `endGame()` return
- `renderRound()`

**showButton(buttonId)**

```javascript
function showButton(buttonId) {
  const container = document.getElementById('input-buttons');
  container.querySelectorAll('.game-btn').forEach(btn => btn.classList.add('hidden'));
  document.getElementById(buttonId).classList.remove('hidden');
}
```

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
- Build metrics:
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
- `console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2))`
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
    data: { metrics, attempts: gameState.attempts, completedAt: Date.now() }
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
- `if (signalCollector) signalCollector.recordViewEvent('screen_transition', { screen: 'results', content_snapshot: { metrics } })`

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

**validateAnswer(userAnswer, correctAnswer)** — Fixed validation (PART-013)

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  if (Array.isArray(correctAnswer)) {
    const userSorted = [...userAnswer].map(String).sort();
    const correctSorted = [...correctAnswer].map(String).sort();
    return JSON.stringify(userSorted) === JSON.stringify(correctSorted);
  }
  return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
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
      gameId: 'equivalent-ratios',
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
| answer_correct | game   | User answers correctly (any type)       | `{ round, type, answer/val/val1+val2/selected }`     |
| answer_wrong   | game   | User answers incorrectly                | `{ round, type, ... }` (type-specific data)           |
| life_lost      | game   | Lives reach 0                           | `{ livesRemaining: 0 }`                              |
| stage_change   | game   | Player enters new stage                 | `{ stage, name }`                                    |
| tap            | mcq    | User clicks MCQ option (Type E)         | `{ label }`                                          |

### SignalCollector Events

| Event              | Function              | Signal Type        | Content Snapshot Keys                              |
| ------------------ | --------------------- | ------------------ | -------------------------------------------------- |
| content_render     | renderRoundContent()  | recordViewEvent    | round, type, skill, baseRatio, trigger             |
| visual_update      | handleRetry()         | recordViewEvent    | type: 'retry', round                               |
| screen_transition  | showResults()         | recordViewEvent    | screen: 'results', metrics                         |
| visibility_hidden  | VisibilityTracker     | recordCustomEvent  | {}                                                 |
| visibility_visible | VisibilityTracker     | recordCustomEvent  | {}                                                 |

---

## 11. Scaffold Points

| Point            | Function              | When                        | What Can Be Injected                                    |
| ---------------- | --------------------- | --------------------------- | ------------------------------------------------------- |
| after_incorrect  | handleTypeAAnswer()   | Type A wrong answer         | "Remember: multiply, don't add!" visual hint            |
| after_incorrect  | handleTypeBSubmit()   | Type B wrong answer         | Partial credit hint, additive-vs-multiplicative scaffold |
| after_incorrect  | handleTypeCSubmit()   | Type C wrong answer         | Step-by-step: "What times what gives...?" prompt        |
| after_incorrect  | handleTypeDSubmit()   | Type D wrong answer         | Table pattern highlight, arrow annotations              |
| after_incorrect  | handleMCQSubmit()     | Type E wrong answer         | Highlight why each distractor fails                     |
| before_round     | renderRound()         | New round starts            | Difficulty preview, strategy tip                        |
| on_retry         | handleRetry()         | User retries B/C/D          | Worked example, step-by-step breakdown                  |
| stage_transition | renderRound()         | Stage changes               | Stage goal description, new skill introduction          |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point has a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 12. Feedback Triggers

| Moment              | Trigger Function      | Feedback Type               | Notes                                |
| ------------------- | --------------------- | --------------------------- | ------------------------------------ |
| Correct answer      | handleTypeAAnswer()   | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Correct answer      | handleTypeB/C/D/E     | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Incorrect answer    | handleTypeAAnswer()   | sound + subtitle            | 'wrong_tap' + voiceOver.incorrect    |
| Incorrect answer    | handleTypeB/C/D/E     | sound + subtitle            | 'wrong_tap' + hint or voiceOver      |
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
  - Primary: `--mathai-purple` (#9B51E0) — rule card accent, multiplier badge, ratio numbers
  - Secondary: `--mathai-orange` (#F2994A) — comparison card accent
  - Success: `--mathai-green` (#219653) — correct feedback, Same button, primary buttons
  - Error: `--mathai-red` (#E35757) — incorrect feedback, Different button
  - Info: `--mathai-blue` (#2563eb) — blank/missing value highlights, input focus
  - Background: `--mathai-cream` (#FFF8F0)
  - Text: `--mathai-text-primary` (#4a4a4a)
- **Typography:** Inter, title 24px, body 16px, label 14px, ratio numbers 22px/28px bold purple
- **Spacing:** Container padding 16px, card padding 20px, gap between elements 16px
- **Interactive states:**
  - Buttons: hover lifts 2px with colored shadow, disabled 0.6 opacity
  - Inputs: focus blue border, correct green bg, incorrect red bg
  - Comparison card: correct green border+bg, incorrect red border+bg
  - MCQ cards: hover purple border, selected purple bg+shadow, correct green, incorrect red
  - Table blank cell: dashed blue border, correct green, incorrect red
- **Transitions:** 0.2s ease for all interactions, 0.3s fadeIn for feedback
- **Responsive:** Max-width 480px, cream background extends full screen behind

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers

```
SETUP: Page loaded, transition screen shown, click "Let's go!" button via TransitionScreen
ACTIONS:
  Round 1 (Type A, same): click #btn-same
  wait 1500ms for auto-advance
  Round 2 (Type A, different): click #btn-different
  wait 1500ms
  Round 3 (Type B, [2,3] x2): type "4" in #input-b-field1, type "6" in #input-b-field2, click #btn-submit, click #btn-next
  --- stage transition 2s ---
  Round 4 (Type C, [3,4] x3, missing=second): type "12" in #input-c-field, click #btn-submit, click #btn-next
  Round 5 (Type D, table blank row1 col3 = 8): type "8" in #input-d-field, click #btn-submit, click #btn-next
  Round 6 (Type B, [4,5] x3): type "12" in #input-b-field1, type "15" in #input-b-field2, click #btn-submit, click #btn-next
  Round 7 (Type C, [2,5] x3, missing=first): type "6" in #input-c-field, click #btn-submit, click #btn-next
  --- stage transition 2s ---
  Round 8 (Type E, [3,5], correct=A): click #mcq-A, click #btn-confirm
  wait 1500ms
  Round 9 (Type D, table blank row2 col2 = 12): type "12" in #input-d-field, click #btn-submit, click #btn-next
  Round 10 (Type E, [4,3], correct=C): click #mcq-C, click #btn-confirm
  wait 1500ms
ASSERT:
  gameState.score === 10
  Victory transition screen shown OR #results-screen is visible
  accuracy display shows "100%"
  stars display shows 3 stars
```

### Scenario: Type A — submit incorrect answer (same when different)

```
SETUP: Page loaded, click "Let's go!", arrive at Round 2 (Type A, correctAnswer=different)
ACTIONS:
  click #btn-same
ASSERT:
  #comparison-card has .incorrect class
  #feedback-area is visible
  #feedback-text has .incorrect-text class
  gameState.lives === 2
  gameState.attempts[1].correct === false
  progressBar shows 2 lives remaining
```

### Scenario: Type B — submit partially correct answer

```
SETUP: Page loaded, advance to Round 3 (Type B, baseRatio=[2,3], multiplier=2)
ACTIONS:
  type "4" in #input-b-field1
  type "5" in #input-b-field2
  click #btn-submit
ASSERT:
  #input-b-field1 has .correct class
  #input-b-field2 has .incorrect class
  #feedback-area is visible
  #feedback-text has .incorrect-text class
  #feedback-text contains "First number correct"
  #btn-retry is visible
  #btn-submit has .hidden class
  gameState.lives === 2
```

### Scenario: Type B — retry after incorrect

```
SETUP: Continue from partially correct scenario above
ACTIONS:
  click #btn-retry
ASSERT:
  #input-b-field1 value is ""
  #input-b-field2 value is ""
  #input-b-field1 does NOT have .correct or .incorrect class
  #input-b-field2 does NOT have .correct or .incorrect class
  #btn-submit is visible
  #btn-retry has .hidden class
ACTIONS:
  type "4" in #input-b-field1
  type "6" in #input-b-field2
  click #btn-submit
ASSERT:
  #input-b-field1 has .correct class
  #input-b-field2 has .correct class
  #btn-next is visible
```

### Scenario: Type C — find missing value (second position)

```
SETUP: Page loaded, advance to Round 4 (Type C, baseRatio=[3,4], multiplier=3, missingPosition=second)
ACTIONS:
  Verify ratio equation shows "3 : 4 = 9 : ?"
  type "12" in #input-c-field
  click #btn-submit
ASSERT:
  #input-c-field has .correct class
  #feedback-area is visible
  #feedback-text has .correct-text class
  #btn-next is visible
  gameState.attempts[last].correct === true
```

### Scenario: Type D — complete ratio table

```
SETUP: Page loaded, advance to Round 5 (Type D, table with blank at row1 col3, correctValue=8)
ACTIONS:
  Verify table shows row1 = [2, 4, 6, ?] and row2 = [3, 6, 9, 12]
  type "8" in #input-d-field
  click #btn-submit
ASSERT:
  .blank-cell has .correct class
  .blank-cell text shows "8"
  #feedback-text has .correct-text class
  #btn-next is visible
```

### Scenario: Type E — select correct MCQ option

```
SETUP: Page loaded, advance to Round 8 (Type E, baseRatio=[3,5], correctAnswer=A)
ACTIONS:
  click #mcq-A
ASSERT:
  #mcq-A has .selected class
  #btn-confirm is not disabled
ACTIONS:
  click #btn-confirm
ASSERT:
  #mcq-A has .correct class
  #feedback-text has .correct-text class
  gameState.attempts[last].correct === true
  auto-advances after 1500ms
```

### Scenario: Type E — select incorrect MCQ option

```
SETUP: Page loaded, advance to Round 8 (Type E, baseRatio=[3,5], correctAnswer=A)
ACTIONS:
  click #mcq-B
  click #btn-confirm
ASSERT:
  #mcq-B has .incorrect class
  #mcq-A has .correct class (always show correct answer)
  #feedback-text has .incorrect-text class
  gameState.lives decreased by 1
```

### Scenario: Reset clears all input (Type B)

```
SETUP: Page loaded, on a Type B round, user has typed values
ACTIONS:
  type "5" in #input-b-field1
  type "7" in #input-b-field2
  click #btn-reset
ASSERT:
  #input-b-field1 value is ""
  #input-b-field2 value is ""
  no .correct or .incorrect classes on inputs
```

### Scenario: Game ends after all rounds

```
SETUP: Complete all 10 rounds correctly (use actions from Scenario 1)
ASSERT:
  gameState.isActive === false
  game_complete postMessage sent
  metrics.accuracy === 100
  metrics.stars === 3
  metrics.attempts.length === 10
  each attempt has: attempt_timestamp, time_since_start_of_game, input_of_user, correct, attempt_number
  metrics.duration_data is valid object
  metrics.tries has 10 entries
```

### Scenario: Game over — all lives lost

```
SETUP: Page loaded, start game
ACTIONS:
  Round 1: click #btn-different (wrong — correct is "same") — lives: 2
  wait 1500ms
  Round 2: click #btn-same (wrong — correct is "different") — lives: 1
  wait 1500ms
  Round 3: type "99" in #input-b-field1, type "99" in #input-b-field2, click #btn-submit — lives: 0
ASSERT:
  gameState.isActive === false
  gameState.lives === 0
  Game Over transition screen shown with title "Game Over!"
  game_complete postMessage sent
  metrics.livesRemaining === 0
```

### Scenario: Stage transitions show correctly

```
SETUP: Page loaded, start game, complete rounds 1-3 correctly
ACTIONS:
  After Round 3 completes, nextRound() triggers stage 2
ASSERT:
  TransitionScreen shows "Stage 2: Practice!" for ~2 seconds
  Then auto-dismisses and Round 4 renders
  stage-badge shows "Stage 2: Practice"
ACTIONS:
  Complete rounds 4-7 correctly
ASSERT:
  TransitionScreen shows "Stage 3: Challenge!" for ~2 seconds
  Then Round 8 renders
  stage-badge shows "Stage 3: Challenge"
```

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order: Sentry config -> Sentry SDK -> FeedbackManager -> Components -> Helpers (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `<div id="app"></div>` is the only structural div in body (PART-025)
- [ ] `<template id="game-template">` contains all game HTML
- [ ] `#game-screen` element exists inside template
- [ ] `#results-screen` element exists inside template, hidden by default
- [ ] All 5 type areas exist: `#type-a-area`, `#type-b-area`, `#type-c-area`, `#type-d-area`, `#type-e-area`
- [ ] All 3 button containers exist: `#type-a-buttons`, `#input-buttons`, `#type-e-buttons`
- [ ] All interactive elements have `data-signal-id` attributes

### Functional

- [ ] `waitForPackages()` checks FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] Audio preloaded with `FeedbackManager.sound.preload([...])` — NOT `register()` (PART-017)
- [ ] SignalCollector created with sessionId, studentId, gameId, contentSetId (PART-010)
- [ ] `ScreenLayout.inject()` called BEFORE ProgressBar/TransitionScreen (PART-025)
- [ ] Template content cloned into `#gameContent` after ScreenLayout.inject (PART-025)
- [ ] ProgressBar created with totalRounds: 10, totalLives: 3 (PART-023)
- [ ] TransitionScreen created with autoInject: true (PART-024)
- [ ] VisibilityTracker created with onInactive + onResume using `sound.pause()` NOT `sound.stopAll()` (PART-005)
- [ ] `handlePostMessage` registered and handles `game_init` (PART-008)
- [ ] `game_ready` postMessage sent after listener registered (PART-008)
- [ ] `setupGame()` has fallback content for standalone testing (PART-008)
- [ ] `recordAttempt()` produces correct attempt shape with metadata (PART-009)
- [ ] `trackEvent()` fires at all interaction points (PART-010)
- [ ] SignalCollector `startProblem`/`endProblem` called for every round (PART-010)
- [ ] `endGame()` calculates metrics, logs, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition actually calls endGame()** — rounds complete (nextRound) AND lives=0 (all 5 answer handlers) (PART-011)
- [ ] `endGame()` calls `signalCollector.seal()` before postMessage (PART-010)
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals (PART-012)
- [ ] `showResults()` populates all fields including lives (PART-019)
- [ ] `progressBar.update()` called with rounds COMPLETED (0 at start), not current round index (PART-023)
- [ ] `progressBar.update()` first param is completed rounds, second is remaining lives (PART-023)
- [ ] Stage transitions use `transitionScreen.show({ duration: 2000 })` — NO buttons (PART-024)
- [ ] Start/end transitions use buttons — NO duration (PART-024)
- [ ] InputSchema defined with fallback content of at least 10 rounds (PART-028)
- [ ] Play area has clear question/interactive/feedback sections (PART-027)
- [ ] No anti-patterns present (PART-026)

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors for feedback states (PART-020)
- [ ] Correct feedback: green border+bg. Incorrect: red border+bg. Selected: purple or yellow (PART-020)
- [ ] Max-width 480px, uses `100dvh` not `100vh` (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` classes (PART-022)
- [ ] Only one action button visible at a time in input-buttons container (PART-022)
- [ ] `.hidden { display: none !important; }` utility class used for show/hide (PART-022)
- [ ] ProgressBar slot at top of layout (PART-023)
- [ ] MCQ grid is 2x2 with equal-sized cards (game-specific)
- [ ] Ratio equation uses large, clear number display (game-specific)
- [ ] Ratio table is responsive within 360px max-width (game-specific)

### Rules Compliance

- [ ] RULE-001: All onclick handlers (`handleTypeAAnswer`, `handleMCQSelect`, `handleSubmit`, `resetInputs`, `handleRetry`, `nextRound`, `handleMCQSubmit`) defined at global scope
- [ ] RULE-002: All async functions (`handleTypeAAnswer`, `handleTypeBSubmit`, `handleTypeCSubmit`, `handleTypeDSubmit`, `handleMCQSubmit`, `testAudio`, DOMContentLoaded callback) have `async` keyword
- [ ] RULE-003: All async calls wrapped in try/catch (FeedbackManager.sound.play, waitForPackages, FeedbackManager.init, preload)
- [ ] RULE-004: All logging uses `JSON.stringify(obj, null, 2)` — no raw objects
- [ ] RULE-005: Cleanup in endGame: `visibilityTracker.destroy()`, `FeedbackManager.sound.stopAll()`, `FeedbackManager.stream.stopAll()`
- [ ] RULE-006: No `new Audio()`, no `setInterval` for timers, no `SubtitleComponent.show()`, no `sound.register()`
- [ ] RULE-007: Single file, no external CSS/JS except PART-002 CDN packages

### Game-Specific

- [ ] All 5 round types (A/B/C/D/E) render correctly and handle user input
- [ ] Type A: "Same ratio!" and "Different ratio!" buttons work, comparison card highlights
- [ ] Type B: Two input fields, partial feedback per field, multiplier badge shown
- [ ] Type C: Ratio equation displays correctly with "?" in the right position based on `missingPosition`
- [ ] Type D: Table builds dynamically from `tableData`, blank cell marked with dashed blue border
- [ ] Type E: 4 MCQ cards in 2x2 grid, selection highlights purple, Confirm enabled only after selection
- [ ] Only whole-number multipliers (2-5) used in content
- [ ] All values in content are ≤ 50
- [ ] Lives system: incorrect answers decrement lives, lives=0 triggers endGame
- [ ] Stage progression: rounds 1-3 = Warm-up, 4-7 = Practice, 8-10 = Challenge
- [ ] handleSubmit() correctly dispatches to handleTypeB/C/DSubmit() based on roundType
- [ ] handleRetry() resets the correct input fields for the current round type

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json (mandatory + game-specific fields)
- [ ] Attempts match contracts/attempt.schema.json (timestamp, time_since_start, input, attempt_number, correct, metadata)
- [ ] Metrics match contracts/metrics.schema.json (accuracy 0-100, time in seconds, stars 0-3, attempts, duration_data, totalLives, tries)
- [ ] duration_data matches contracts/duration-data.schema.json (startTime ISO, attempts array, inActiveTime, totalInactiveTime)
- [ ] postMessage out matches contracts/postmessage-out.schema.json (type: 'game_complete', data: { metrics, attempts, completedAt })
- [ ] postMessage in handles contracts/postmessage-in.schema.json (type: 'game_init', data: { gameId, content, signalConfig })
