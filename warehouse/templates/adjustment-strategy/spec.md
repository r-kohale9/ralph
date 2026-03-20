# Adjustment Strategy — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Adjustment Strategy
- **Game ID:** game_adjustment_strategy
- **Type:** standard
- **Description:** Two numbers are shown with independent +/− buttons. The user adjusts numbers to make mental addition easier (e.g., 47+33 → 50+30), then types the sum in an input field and taps Check. The answer is always the original sum. 9 rounds across 3 levels (3 rounds per level), 3 lives. Stars based on average time per level.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                          |
| -------- | ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                     |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                     |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                     |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                     |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                   |
| PART-006 | TimerComponent                | YES             | timerType: 'increase', startTime: 0, autoStart: false, format: 'min'                                                                                  |
| PART-007 | Game State Object             | YES             | Custom fields: lives, numberA, numberB, correctAnswer, deltaA, deltaB, roundStartTime, levelStartTime, levelTimes, level, wrongAttempts, isProcessing |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                     |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                     |
| PART-010 | Event Tracking                | YES             | Custom events: adjust_number, reset_adjustments, check_answer, correct_answer, wrong_answer, round_complete, level_complete, life_lost                |
| PART-011 | End Game & Metrics            | YES             | Custom star logic: avg time/level <15s = 3★, <25s = 2★, ≥25s = 1★, game-over = 0★                                                                     |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                     |
| PART-013 | Validation Fixed              | YES             | Rule: parseInt(input) === numberA + numberB                                                                                                           |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                     |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                     |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                     |
| PART-017 | Feedback Integration          | NO              | Extension — specific audio URLs used directly                                                                                                         |

> **CRITICAL: Do NOT call FeedbackManager.init(). Use FeedbackManager.sound.play() and FeedbackManager.playDynamicFeedback() directly. Calling FeedbackManager.init() shows a blocking audio permission popup that prevents game initialization and causes ALL tests to fail non-deterministically.**
| PART-018 | Case Converter                | NO              | —                                                                                                                                                     |
| PART-019 | Results Screen UI             | YES             | Custom metrics: time, rounds completed, avg time/level, wrong attempts, accuracy                                                                      |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                     |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                     |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                     |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 9, totalLives: 3                                                                                                                         |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, level-transition, victory, game-over                                                                                                  |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                        |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                |
| PART-027 | Play Area Construction        | YES             | Layout: two-number adjuster + input + check button                                                                                                    |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with numberA, numberB, correctAnswer                                                                                              |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  |                                                                                                                                                       |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  |                                                                                                                                                       |
| PART-037 | Playwright Testing            | YES (POST_GEN)  |                                                                                                                                                       |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 9,
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
  lives: 3,
  totalLives: 3,
  numberA: 0,                // Original first number
  numberB: 0,                // Original second number
  correctAnswer: 0,          // numberA + numberB
  deltaA: 0,                 // Current adjustment delta for number A
  deltaB: 0,                 // Current adjustment delta for number B
  roundStartTime: null,      // Timestamp when current round started
  levelStartTime: null,      // Timestamp when current level started
  levelTimes: [],            // Array of time (ms) per completed level
  level: 1,                  // Current level (1-3), 3 rounds per level
  wrongAttempts: 0,
  isProcessing: false
};

let timer = null;
let visibilityTracker = null;
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
          "numberA": {
            "type": "integer",
            "description": "First number to add"
          },
          "numberB": {
            "type": "integer",
            "description": "Second number to add"
          },
          "correctAnswer": {
            "type": "integer",
            "description": "numberA + numberB"
          }
        },
        "required": ["numberA", "numberB", "correctAnswer"]
      },
      "minItems": 9,
      "description": "9 rounds across 3 levels (3 rounds each). Difficulty increases per level."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

**Level 1 (Rounds 1-3):** Two-digit numbers, sums under 100. Numbers close to round numbers encourage adjustment.
**Level 2 (Rounds 4-6):** Two-digit numbers, sums 100-130. Larger values require more strategic adjustment.
**Level 3 (Rounds 7-9):** Bigger two-digit numbers, sums 130-160. Numbers benefit from rounding to nearest ten.

```javascript
const fallbackContent = {
  rounds: [
    // === LEVEL 1: Easy — sums under 100 ===

    // Round 1: 47 + 33 = 80 (adjust → 50 + 30)
    // Verify: 47 + 33 = 80 ✓
    { numberA: 47, numberB: 33, correctAnswer: 80 },

    // Round 2: 28 + 14 = 42 (adjust → 30 + 12)
    // Verify: 28 + 14 = 42 ✓
    { numberA: 28, numberB: 14, correctAnswer: 42 },

    // Round 3: 56 + 25 = 81 (adjust → 60 + 21)
    // Verify: 56 + 25 = 81 ✓
    { numberA: 56, numberB: 25, correctAnswer: 81 },

    // === LEVEL 2: Medium — sums 100-130 ===

    // Round 4: 36 + 84 = 120 (adjust → 40 + 80)
    // Verify: 36 + 84 = 120 ✓
    { numberA: 36, numberB: 84, correctAnswer: 120 },

    // Round 5: 67 + 45 = 112 (adjust → 70 + 42)
    // Verify: 67 + 45 = 112 ✓
    { numberA: 67, numberB: 45, correctAnswer: 112 },

    // Round 6: 49 + 73 = 122 (adjust → 50 + 72)
    // Verify: 49 + 73 = 122 ✓
    { numberA: 49, numberB: 73, correctAnswer: 122 },

    // === LEVEL 3: Hard — sums 130-160 ===

    // Round 7: 78 + 56 = 134 (adjust → 80 + 54)
    // Verify: 78 + 56 = 134 ✓
    { numberA: 78, numberB: 56, correctAnswer: 134 },

    // Round 8: 83 + 69 = 152 (adjust → 80 + 72)
    // Verify: 83 + 69 = 152 ✓
    { numberA: 83, numberB: 69, correctAnswer: 152 },

    // Round 9: 95 + 47 = 142 (adjust → 100 + 42)
    // Verify: 95 + 47 = 142 ✓
    { numberA: 95, numberB: 47, correctAnswer: 142 }
  ]
};
```

**Verification:**

| Round | Level | A   | B   | A+B | ✓   |
| ----- | ----- | --- | --- | --- | --- |
| 1     | 1     | 47  | 33  | 80  | ✓   |
| 2     | 1     | 28  | 14  | 42  | ✓   |
| 3     | 1     | 56  | 25  | 81  | ✓   |
| 4     | 2     | 36  | 84  | 120 | ✓   |
| 5     | 2     | 67  | 45  | 112 | ✓   |
| 6     | 2     | 49  | 73  | 122 | ✓   |
| 7     | 3     | 78  | 56  | 134 | ✓   |
| 8     | 3     | 83  | 69  | 152 | ✓   |
| 9     | 3     | 95  | 47  | 142 | ✓   |

---

## 5. Screens & HTML Structure

### Body HTML

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <div id="timer-container"></div>

    <div class="instruction-area">
      <p class="instruction-text">Check the list, think smart, and adjust wisely.</p>
      <p class="instruction-text-sub">Remember — this is a timed game!</p>
      <p class="instruction-text-sub">Clear all <strong>3 levels</strong> with an average speed of less than <strong>15 seconds</strong> per level to earn 3 stars.</p>
    </div>

    <div class="reset-row">
      <button class="reset-btn" id="btn-reset" onclick="resetAdjustments()">↻ Reset</button>
    </div>

    <div class="adjuster-container" id="adjuster-container">
      <!-- Number A adjuster -->
      <div class="number-adjuster" id="adjuster-a">
        <div class="adj-top-area" id="adj-a-top">
          <button class="adj-btn adj-minus" onclick="adjustNumber('a', -1)">−</button>
        </div>
        <div class="number-box" id="number-box-a">
          <span class="original-number" id="original-a">0</span>
          <span class="delta-badge hidden" id="delta-badge-a"></span>
        </div>
        <div class="adj-bottom-area" id="adj-a-bottom">
          <button class="adj-btn adj-plus" onclick="adjustNumber('a', 1)">+</button>
        </div>
      </div>

      <!-- Operator -->
      <span class="operator-sign">+</span>

      <!-- Number B adjuster -->
      <div class="number-adjuster" id="adjuster-b">
        <div class="adj-top-area" id="adj-b-top">
          <button class="adj-btn adj-minus" onclick="adjustNumber('b', -1)">−</button>
        </div>
        <div class="number-box" id="number-box-b">
          <span class="original-number" id="original-b">0</span>
          <span class="delta-badge hidden" id="delta-badge-b"></span>
        </div>
        <div class="adj-bottom-area" id="adj-b-bottom">
          <button class="adj-btn adj-plus" onclick="adjustNumber('b', 1)">+</button>
        </div>
      </div>
    </div>

    <div class="answer-area" id="answer-area">
      <input type="number" class="answer-input" id="answer-input" placeholder="?" oninput="onInputChange()" />
      <button class="game-btn btn-primary check-btn hidden" id="btn-check" onclick="checkAnswer()">✓ Check</button>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display: none;">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title" id="results-title">Great Job!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Time</span>
          <span class="metric-value" id="result-time">0:00</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Avg Time/Level</span>
          <span class="metric-value" id="result-avg-time">0.0s</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Rounds Completed</span>
          <span class="metric-value" id="result-rounds">0/9</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Wrong Attempts</span>
          <span class="metric-value" id="result-wrong">0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span class="metric-value" id="result-accuracy">0%</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" onclick="restartGame()">Play Again</button>
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
  --mathai-light-green: #EAFBF1;
  --mathai-red: #E35757;
  --mathai-light-red: #FDECEC;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #EBF0FF;
  --mathai-gray: #828282;
  --mathai-light-gray: #F2F2F2;
  --mathai-white: #FFFFFF;
  --mathai-black: #1A1A2E;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 12px;
  --mathai-border-radius-card: 12px;
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-white);
  color: var(--mathai-black);
  -webkit-font-smoothing: antialiased;
}

/* === Game Block === */
.game-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 16px;
}

/* === Instruction Area === */
.instruction-area {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
}

.instruction-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  line-height: 1.5;
  margin-bottom: 4px;
}

.instruction-text strong { font-weight: 700; }

.instruction-text-sub {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  line-height: 1.4;
  margin-bottom: 4px;
}

.instruction-text-sub strong { font-weight: 700; color: var(--mathai-black); }

/* === Reset Row === */
.reset-row {
  width: 100%;
  max-width: 340px;
  display: flex;
  justify-content: flex-end;
}

.reset-btn {
  background: var(--mathai-light-gray);
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: var(--mathai-font-size-label);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  color: var(--mathai-black);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover { background: #E8E8E8; }

/* === Adjuster Container === */
.adjuster-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 8px 0;
}

.operator-sign {
  font-size: 20px;
  font-weight: 600;
  color: var(--mathai-gray);
  align-self: center;
  margin-top: -8px; /* align with number box vertically */
}

/* === Number Adjuster (vertical stack: minus area → number → plus area) === */
.number-adjuster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 80px;
}

/* === Adj Top/Bottom Areas === */
.adj-top-area, .adj-bottom-area {
  width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* When showing adjusted value, the area displays value + small icon */
.adj-top-area.has-value,
.adj-bottom-area.has-value {
  font-size: 18px;
  font-weight: 700;
}

.adj-top-area.has-value { color: var(--mathai-black); }
.adj-bottom-area.has-value { color: var(--mathai-black); }

/* Adjusted value display (replaces button when active) */
.adjusted-value-display {
  font-size: 18px;
  font-weight: 700;
  color: var(--mathai-black);
  display: flex;
  align-items: center;
  gap: 4px;
}

.adjusted-value-display .adj-icon {
  font-size: 14px;
  font-weight: 600;
}

.adjusted-value-display .adj-icon.minus { color: var(--mathai-red); }
.adjusted-value-display .adj-icon.plus { color: var(--mathai-green); }

/* === Adj Buttons === */
.adj-btn {
  width: 80px;
  height: 36px;
  border: 1.5px solid #E0E0E0;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  font-family: var(--mathai-font-family);
  background: var(--mathai-white);
  color: var(--mathai-gray);
}

.adj-minus {
  border-color: #F5D5D5;
  background: #FFF5F5;
  color: var(--mathai-red);
}

.adj-minus:hover { background: var(--mathai-light-red); border-color: var(--mathai-red); }

.adj-plus {
  border-color: #D5F0D5;
  background: #F5FFF5;
  color: var(--mathai-green);
}

.adj-plus:hover { background: var(--mathai-light-green); border-color: var(--mathai-green); }

/* === Number Box === */
.number-box {
  width: 80px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #E0E0E0;
  border-radius: 10px;
  background: var(--mathai-white);
  position: relative;
}

.original-number {
  font-size: 28px;
  font-weight: 700;
  color: var(--mathai-black);
}

/* === Delta Badge (positioned top-right of number box) === */
.delta-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 24px;
  height: 20px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.delta-badge.positive {
  background: var(--mathai-green);
  color: var(--mathai-white);
}

.delta-badge.negative {
  background: var(--mathai-red);
  color: var(--mathai-white);
}

/* === Answer Area === */
.answer-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.answer-input {
  width: 80px;
  height: 52px;
  border: 2px solid #E0E0E0;
  border-radius: 10px;
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  font-family: var(--mathai-font-family);
  color: var(--mathai-black);
  outline: none;
  transition: border-color 0.2s ease;
  -moz-appearance: textfield;
}

.answer-input::-webkit-outer-spin-button,
.answer-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.answer-input:focus {
  border-color: #E8D98A;
  box-shadow: 0 0 0 2px rgba(232, 217, 138, 0.3);
}

.answer-input::placeholder {
  color: var(--mathai-gray);
  font-weight: 400;
}

/* === Check Button === */
.check-btn {
  max-width: 200px;
  padding: 10px 32px;
  font-size: var(--mathai-font-size-body);
  border-radius: 24px;
  background: var(--mathai-blue);
}

.check-btn:hover { filter: brightness(0.9); }

/* === Buttons (PART-022) === */
.game-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 12px;
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  width: 100%;
  max-width: 340px;
}

.btn-primary { background: var(--mathai-green); color: var(--mathai-white); }
.btn-primary:hover { filter: brightness(0.9); }

/* === Results Screen (PART-019) === */
.results-card {
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.results-title { font-size: var(--mathai-font-size-title); margin-bottom: 24px; color: var(--mathai-black); }
.stars-display { font-size: 40px; margin-bottom: 16px; display: flex; justify-content: center; gap: 8px; }
.results-metrics { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.metric-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--mathai-light-gray); }
.metric-label { color: var(--mathai-gray); font-size: var(--mathai-font-size-label); }
.metric-value { font-weight: 700; font-size: var(--mathai-font-size-body); color: var(--mathai-black); }

/* === Utility === */
.hidden { display: none !important; }
```

---

## 7. Game Flow

1. **Page loads** → DOMContentLoaded fires
   - waitForPackages(), FeedbackManager.init()
   - Register sounds (correct_tap, wrong_tap)
   - ScreenLayout.inject, clone template
   - TimerComponent (increase, no autoStart)
   - ProgressBarComponent (totalRounds: 9, totalLives: 3)
   - TransitionScreen, VisibilityTracker
   - Show start transition screen

2. **startGame()** from start screen:
   - Set startTime, isActive, start timer
   - progressBar.update(0, lives)
   - trackEvent('game_start')
   - showLevelTransition(1)

3. **showLevelTransition(level):**
   - transitionScreen.show with level info
   - Button action → startLevel()

4. **startLevel():**
   - gameState.levelStartTime = Date.now()
   - loadRound()

5. **loadRound():**
   - Get round data, set numberA, numberB, correctAnswer
   - Reset deltaA=0, deltaB=0
   - gameState.roundStartTime = Date.now()
   - Render number adjusters with original values
   - Clear input, hide Check button

6. **User interaction loop:**
   - Tap +/− on number A or B → adjustNumber(which, direction)
     - Update deltaA or deltaB by ±1
     - Update UI: show adjusted value on +/− area, show delta badge
     - The other number is NOT affected (independent adjustments)
   - Tap "Reset" → resetAdjustments()
     - Reset deltaA=0, deltaB=0, clear input, update UI
   - Type answer in input → onInputChange()
     - If input non-empty → show Check button
     - If input empty → hide Check button
   - Tap "Check" → checkAnswer()
     - If parseInt(input) === correctAnswer → CORRECT
       - Play correct sound + dynamic audio ("Correct! Try to be faster next time.")
       - After 400ms → roundComplete()
     - Else → WRONG
       - Lose 1 life
       - Play wrong sound + dynamic audio ("Not quite. Check your calculations and try again!")
       - Clear input, hide Check button (adjustments stay)
       - If lives <= 0 → endGame('game_over')
       - Else → user retries same round

7. **roundComplete():**
   - currentRound++, score++
   - progressBar.update
   - If currentRound % 3 === 0 AND currentRound < totalRounds:
     - Record level time: levelTimes.push(Date.now() - levelStartTime)
     - level++
     - showLevelTransition(level)
   - Else if currentRound >= totalRounds:
     - Record level time
     - endGame('victory')
   - Else → loadRound()

8. **endGame(reason):**
   - isActive = false, timer.pause()
   - Calculate avg time per level from levelTimes
   - Stars: avg <15s = 3★, <25s = 2★, ≥25s = 1★, game-over = 0★
   - Dynamic audio, results, postMessage, cleanup

---

## 8. Functions

### Global Scope (RULE-001)

**startGame()**
- gameState.startTime = Date.now()
- gameState.isActive = true
- gameState.duration_data.startTime = new Date().toISOString()
- timer.start()
- progressBar.update(0, gameState.lives)
- trackEvent('game_start', 'game')
- showLevelTransition(1)

**showLevelTransition(level)**
- gameState.level = level
- const levelNames = ['Level 1', 'Level 2', 'Level 3']
- const levelSubtitles = ['Easy — Small numbers', 'Medium — Bigger sums', 'Hard — Challenge mode']
- transitionScreen.show({ icons: ['🧮'], iconSize: 'large', title: levelNames[level - 1], subtitle: levelSubtitles[level - 1], buttons: [{ text: level === 1 ? "Let's go!" : 'Next Level', type: 'primary', action: () => startLevel() }] })

**startLevel()**
- gameState.levelStartTime = Date.now()
- loadRound()

**loadRound()**
- const round = gameState.content.rounds[gameState.currentRound]
- gameState.numberA = round.numberA
- gameState.numberB = round.numberB
- gameState.correctAnswer = round.correctAnswer
- gameState.deltaA = 0
- gameState.deltaB = 0
- gameState.isProcessing = false
- gameState.roundStartTime = Date.now()
- renderAdjusters()
- clearAnswerArea()

**renderAdjusters()**
- document.getElementById('original-a').textContent = gameState.numberA
- document.getElementById('original-b').textContent = gameState.numberB
- updateAdjusterUI('a')
- updateAdjusterUI('b')

**updateAdjusterUI(which)**
- const delta = which === 'a' ? gameState.deltaA : gameState.deltaB
- const original = which === 'a' ? gameState.numberA : gameState.numberB
- const topArea = document.getElementById(`adj-${which}-top`)
- const bottomArea = document.getElementById(`adj-${which}-bottom`)
- const badge = document.getElementById(`delta-badge-${which}`)
-
- If delta === 0:
  - // Show default buttons, hide badge
  - topArea.innerHTML = `<button class="adj-btn adj-minus" onclick="adjustNumber('${which}', -1)">−</button>`
  - bottomArea.innerHTML = `<button class="adj-btn adj-plus" onclick="adjustNumber('${which}', 1)">+</button>`
  - badge.className = 'delta-badge hidden'
  - badge.textContent = ''
- Else if delta < 0:
  - // Minus area shows adjusted value with "−" prefix
  - topArea.innerHTML = `<div class="adjusted-value-display"><span class="adj-icon minus">−</span> <strong>${original + delta}</strong></div>`
  - // Plus area keeps its button
  - bottomArea.innerHTML = `<button class="adj-btn adj-plus" onclick="adjustNumber('${which}', 1)">+</button>`
  - // Badge shows red negative delta
  - badge.className = 'delta-badge negative'
  - badge.textContent = `${delta}`
- Else if delta > 0:
  - // Minus area keeps its button
  - topArea.innerHTML = `<button class="adj-btn adj-minus" onclick="adjustNumber('${which}', -1)">−</button>`
  - // Plus area shows adjusted value with "+" prefix
  - bottomArea.innerHTML = `<div class="adjusted-value-display"><span class="adj-icon plus">+</span> <strong>${original + delta}</strong></div>`
  - // Badge shows green positive delta
  - badge.className = 'delta-badge positive'
  - badge.textContent = `+${delta}`

**adjustNumber(which, direction)**
- If !gameState.isActive || gameState.isProcessing → return
- If which === 'a':
  - gameState.deltaA += direction
- Else:
  - gameState.deltaB += direction
- updateAdjusterUI(which)
- trackEvent('adjust_number', 'adjuster', { which, direction, deltaA: gameState.deltaA, deltaB: gameState.deltaB, adjustedA: gameState.numberA + gameState.deltaA, adjustedB: gameState.numberB + gameState.deltaB })

**resetAdjustments()**
- If !gameState.isActive || gameState.isProcessing → return
- gameState.deltaA = 0
- gameState.deltaB = 0
- updateAdjusterUI('a')
- updateAdjusterUI('b')
- clearAnswerArea()
- trackEvent('reset_adjustments', 'game', { round: gameState.currentRound + 1 })

**clearAnswerArea()**
- const input = document.getElementById('answer-input')
- input.value = ''
- document.getElementById('btn-check').classList.add('hidden')

**onInputChange()**
- const input = document.getElementById('answer-input')
- const checkBtn = document.getElementById('btn-check')
- If input.value.trim() !== '':
  - checkBtn.classList.remove('hidden')
- Else:
  - checkBtn.classList.add('hidden')

**async checkAnswer()**
- If !gameState.isActive || gameState.isProcessing → return
- gameState.isProcessing = true
- const input = document.getElementById('answer-input')
- const userAnswer = parseInt(input.value.trim(), 10)
- If isNaN(userAnswer):
  - gameState.isProcessing = false
  - return
-
- trackEvent('check_answer', 'input', { userAnswer, correctAnswer: gameState.correctAnswer, round: gameState.currentRound + 1 })
-
- If userAnswer === gameState.correctAnswer:
  - // CORRECT
  - try { await FeedbackManager.sound.play('correct_tap'); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
  - try { await FeedbackManager.playDynamicFeedback({ audio_content: getCorrectPhrase(), subtitle: getCorrectPhrase() }); } catch(e) {}
  - trackEvent('correct_answer', 'input', { userAnswer, round: gameState.currentRound + 1 })
  - recordAttempt({ input_of_user: { action: 'check_answer', answer: userAnswer, deltaA: gameState.deltaA, deltaB: gameState.deltaB }, correct: true, metadata: { round: gameState.currentRound + 1, question: `${gameState.numberA} + ${gameState.numberB}`, correctAnswer: gameState.correctAnswer, validationType: 'fixed' } })
  - setTimeout(() => roundComplete(), 400)
- Else:
  - // WRONG — lose life, retry same round
  - gameState.lives--
  - gameState.wrongAttempts++
  - progressBar.update(gameState.currentRound, gameState.lives)
  - try { await FeedbackManager.sound.play('wrong_tap'); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
  - try { await FeedbackManager.playDynamicFeedback({ audio_content: 'Not quite. Check your calculations and try again!', subtitle: 'Not quite. Try again!' }); } catch(e) {}
  - trackEvent('wrong_answer', 'input', { userAnswer, correctAnswer: gameState.correctAnswer, round: gameState.currentRound + 1 })
  - trackEvent('life_lost', 'game', { livesRemaining: gameState.lives })
  - recordAttempt({ input_of_user: { action: 'check_answer', answer: userAnswer, deltaA: gameState.deltaA, deltaB: gameState.deltaB }, correct: false, metadata: { round: gameState.currentRound + 1, question: `${gameState.numberA} + ${gameState.numberB}`, correctAnswer: gameState.correctAnswer, validationType: 'fixed' } })
  - // Clear input only, keep adjustments
  - input.value = ''
  - document.getElementById('btn-check').classList.add('hidden')
  - If gameState.lives <= 0:
    - setTimeout(() => endGame('game_over'), 800)
  - Else:
    - gameState.isProcessing = false

**getCorrectPhrase()**
- const phrases = ['Correct! Try to be faster next time.', 'Well done!', 'Great job!', 'Nice work!', 'Excellent!', 'Perfect!']
- return phrases[Math.floor(Math.random() * phrases.length)]

**roundComplete()**
- gameState.currentRound++
- gameState.score++
- progressBar.update(gameState.currentRound, gameState.lives)
- trackEvent('round_complete', 'game', { round: gameState.currentRound, livesRemaining: gameState.lives })
- // Check for level transition (every 3 rounds)
- If gameState.currentRound % 3 === 0 && gameState.currentRound < gameState.totalRounds:
  - gameState.levelTimes.push(Date.now() - gameState.levelStartTime)
  - gameState.level++
  - trackEvent('level_complete', 'game', { level: gameState.level - 1, levelTime: gameState.levelTimes[gameState.levelTimes.length - 1] })
  - showLevelTransition(gameState.level)
- Else if gameState.currentRound >= gameState.totalRounds:
  - gameState.levelTimes.push(Date.now() - gameState.levelStartTime)
  - trackEvent('level_complete', 'game', { level: gameState.level, levelTime: gameState.levelTimes[gameState.levelTimes.length - 1] })
  - endGame('victory')
- Else:
  - loadRound()

**async endGame(reason)**
- gameState.isActive = false
- if (timer) timer.pause()
- const totalTime = Math.round((Date.now() - gameState.startTime) / 1000)
- const avgTimePerLevel = gameState.levelTimes.length > 0 ? gameState.levelTimes.reduce((a, b) => a + b, 0) / gameState.levelTimes.length / 1000 : 0
- const correctAttempts = gameState.attempts.filter(a => a.correct).length
- const totalAttempts = gameState.attempts.length
- const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0
- let stars = 0
- if (reason === 'victory'):
  - stars = avgTimePerLevel < 15 ? 3 : avgTimePerLevel < 25 ? 2 : 1
- else:
  - stars = 0
- const metrics = { accuracy, time: totalTime, avgTimePerLevel: Math.round(avgTimePerLevel * 10) / 10, stars, attempts: gameState.attempts, duration_data: { ...gameState.duration_data, currentTime: new Date().toISOString() }, roundsCompleted: gameState.currentRound, wrongAttempts: gameState.wrongAttempts, livesRemaining: gameState.lives, levelTimes: gameState.levelTimes.map(t => Math.round(t / 100) / 10), reason }
- console.log('Final Metrics:', JSON.stringify(metrics, null, 2))
- trackEvent('game_end', 'game', { reason, roundsCompleted: gameState.currentRound, accuracy, stars, time: totalTime, avgTimePerLevel })
- If reason === 'victory':
  - try { await FeedbackManager.playDynamicFeedback({ audio_content: `Amazing! You completed all levels with an average of ${Math.round(avgTimePerLevel * 10) / 10} seconds per level!`, subtitle: 'All levels done!' }); } catch(e) {}
- Else:
  - try { await FeedbackManager.playDynamicFeedback({ audio_content: 'Oh no, you ran out of lives! Better luck next time!', subtitle: 'Out of lives!' }); } catch(e) {}
- showResults(metrics, reason)
- window.parent.postMessage({ type: 'game_complete', data: { metrics, events: gameState.events, completedAt: Date.now() } }, '*')
- if (timer) { timer.destroy(); timer = null; }
- if (progressBar) { progressBar.destroy(); progressBar = null; }
- if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
- try { FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll(); } catch(e) {}

**showResults(metrics, reason)**
- document.getElementById('game-screen').style.display = 'none'
- document.getElementById('results-screen').style.display = 'flex'
- document.getElementById('results-title').textContent = reason === 'victory' ? 'Great Job!' : 'Game Over'
- document.getElementById('result-time').textContent = formatTime(metrics.time)
- document.getElementById('result-avg-time').textContent = `${metrics.avgTimePerLevel}s`
- document.getElementById('result-rounds').textContent = `${gameState.currentRound}/${gameState.totalRounds}`
- document.getElementById('result-wrong').textContent = gameState.wrongAttempts
- document.getElementById('result-accuracy').textContent = `${metrics.accuracy}%`
- const starsDisplay = document.getElementById('stars-display')
- starsDisplay.innerHTML = ''
- for (let i = 0; i < 3; i++) { starsDisplay.innerHTML += i < metrics.stars ? '⭐' : '☆'; }

**formatTime(seconds)**
- const mins = Math.floor(seconds / 60)
- const secs = seconds % 60
- return `${mins}:${secs.toString().padStart(2, '0')}`

**restartGame()**
- Reset all gameState fields: currentRound=0, score=0, attempts=[], events=[], lives=3, wrongAttempts=0, levelTimes=[], level=1, deltaA=0, deltaB=0, isProcessing=false, isActive=false, startTime=null, levelStartTime=null, roundStartTime=null
- gameState.duration_data = { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null }
- Recreate timer: timer = new TimerComponent('timer-container', { timerType: 'increase', format: 'min', startTime: 0, autoStart: false })
- Recreate progressBar: progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 9, totalLives: 3, slotId: 'mathai-progress-slot' })
- Recreate visibilityTracker with same handlers
- document.getElementById('results-screen').style.display = 'none'
- document.getElementById('game-screen').style.display = 'flex'
- transitionScreen.show({ icons: ['🧮'], iconSize: 'large', title: 'Adjustment Strategy', subtitle: 'Adjust numbers to add faster!', buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }] })

**handlePostMessage(event)**
- if (!event.data || event.data.type !== 'game_init') return
- try: gameState.content = event.data.data.content
- catch(e): console.error('PostMessage error:', JSON.stringify({ error: e.message }, null, 2))

**recordAttempt(data)**
- Standard attempt shape from PART-009:
- gameState.attempts.push({ ...data, attempt_number: gameState.attempts.length + 1, attempt_timestamp: new Date().toISOString(), time_since_start: gameState.startTime ? Date.now() - gameState.startTime : 0 })
- gameState.duration_data.attempts.push({ timestamp: new Date().toISOString(), input: data.input_of_user })

**trackEvent(type, target, data = {})**
- Standard event tracking from PART-010:
- gameState.events.push({ type, target, data, timestamp: new Date().toISOString(), timeSinceStart: gameState.startTime ? Date.now() - gameState.startTime : 0 })

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    try {
      await FeedbackManager.sound.register('correct_tap', 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740724945201.mp3');
      await FeedbackManager.sound.register('wrong_tap', 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740725080819.mp3');
    } catch(e) { console.error('Sound registration error:', JSON.stringify({ error: e.message }, null, 2)); }

    const layout = ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
    const gameContent = document.getElementById('gameContent');
    const template = document.getElementById('game-template');
    gameContent.appendChild(template.content.cloneNode(true));

    timer = new TimerComponent('timer-container', { timerType: 'increase', format: 'min', startTime: 0, autoStart: false });
    progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 9, totalLives: 3, slotId: 'mathai-progress-slot' });
    transitionScreen = new TransitionScreenComponent({ autoInject: true });
    visibilityTracker = new VisibilityTracker({
      onInactive: () => { if (timer && timer.isRunning) timer.pause(); try { FeedbackManager.sound.stopAll(); } catch(e) {} gameState.duration_data.inActiveTime.push({ start: Date.now() }); },
      onResume: () => { if (timer && timer.isPaused && gameState.isActive) timer.resume(); const last = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1]; if (last && !last.end) { last.end = Date.now(); gameState.duration_data.totalInactiveTime += (last.end - last.start); } }
    });

    if (!gameState.content) gameState.content = fallbackContent;
    window.addEventListener('message', handlePostMessage);

    transitionScreen.show({ icons: ['🧮'], iconSize: 'large', title: 'Adjustment Strategy', subtitle: 'Adjust numbers to add faster!', buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }] });
  } catch(e) { console.error('Init error:', JSON.stringify({ error: e.message }, null, 2)); }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = () => { console.log('Game State:', JSON.stringify({ currentRound: gameState.currentRound, totalRounds: gameState.totalRounds, lives: gameState.lives, score: gameState.score, level: gameState.level, numberA: gameState.numberA, numberB: gameState.numberB, deltaA: gameState.deltaA, deltaB: gameState.deltaB, correctAnswer: gameState.correctAnswer, wrongAttempts: gameState.wrongAttempts, isActive: gameState.isActive, levelTimes: gameState.levelTimes }, null, 2)); };
window.debugAudio = () => { console.log('FeedbackManager available:', typeof FeedbackManager !== 'undefined'); };
window.testAudio = async (id) => { try { await FeedbackManager.sound.play(id || 'correct_tap'); } catch(e) { console.error(JSON.stringify({ error: e.message }, null, 2)); } };
window.testPause = () => { if (timer) timer.pause(); };
window.testResume = () => { if (timer && gameState.isActive) timer.resume(); };
```

---

## 9. Event Schema

### Game Lifecycle Events

| Event      | Target | When Fired  |
| ---------- | ------ | ----------- |
| game_start | game   | startGame() |
| game_end   | game   | endGame()   |

### Game-Specific Events

| Event             | Target   | When Fired                | Data                                                       |
| ----------------- | -------- | ------------------------- | ---------------------------------------------------------- |
| adjust_number     | adjuster | User taps +/− on a number | { which, direction, deltaA, deltaB, adjustedA, adjustedB } |
| reset_adjustments | game     | User taps Reset           | { round }                                                  |
| check_answer      | input    | User taps Check           | { userAnswer, correctAnswer, round }                       |
| correct_answer    | input    | Answer matches sum        | { userAnswer, round }                                      |
| wrong_answer      | input    | Answer doesn't match      | { userAnswer, correctAnswer, round }                       |
| round_complete    | game     | Round advances            | { round, livesRemaining }                                  |
| level_complete    | game     | Level's 3 rounds done     | { level, levelTime }                                       |
| life_lost         | game     | Wrong answer              | { livesRemaining }                                         |

---

## 10. Scaffold Points

| Point               | Function              | When                   | What Can Be Injected                              |
| ------------------- | --------------------- | ---------------------- | ------------------------------------------------- |
| after_wrong_answer  | checkAnswer()         | Wrong answer submitted | Hint about adjustment strategy, show expected sum |
| before_round        | loadRound()           | New round starts       | Strategy tip ("Try rounding to nearest 10")       |
| on_level_transition | showLevelTransition() | New level              | Difficulty preview                                |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 11. Feedback Triggers

| Moment           | Trigger               | Feedback Type                                |
| ---------------- | --------------------- | -------------------------------------------- |
| Correct answer   | checkAnswer()         | registered sound (correct_tap) + dynamic TTS |
| Wrong answer     | checkAnswer()         | registered sound (wrong_tap) + dynamic TTS   |
| Victory          | endGame('victory')    | dynamic TTS with avg time                    |
| Game over        | endGame('game_over')  | dynamic TTS                                  |
| Level transition | showLevelTransition() | transition screen (visual only)              |

**Important:** No red/green background change on correct/incorrect. Feedback is audio-only (registered sounds + dynamic TTS).

### Sound Registration

```javascript
await FeedbackManager.sound.register('correct_tap', 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740724945201.mp3');
await FeedbackManager.sound.register('wrong_tap', 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740725080819.mp3');
```

---

## 12. Visual Specifications

- **Layout:** Vertical stack — instruction → reset row → adjuster pair → input + check
- **Adjuster pair:** Two number adjusters side-by-side with "+" operator between them
- **Each adjuster:** Vertical stack: [−button/adjusted-value] → [number box with delta badge] → [+button/adjusted-value]
- **Number box:** 80px × 60px, border-radius 10px, 28px bold number
- **−button:** Light red background (#FFF5F5), red border (#F5D5D5), 80px × 36px
- **+button:** Light green background (#F5FFF5), green border (#D5F0D5), 80px × 36px
- **Delta badge:** Pill shape, top-right of number box. Green for positive, red for negative.
- **Adjusted value:** Replaces the +/− button area when delta ≠ 0. Shows icon (+ or −) and the adjusted number in bold.
- **Input field:** 80px × 52px, centered, number-only, "?" placeholder, yellow border on focus
- **Check button:** Blue (#2563eb), rounded pill (24px radius), appears only when input has a value
- **Reset button:** Gray, top-right aligned, "↻ Reset"
- **No background color change** on correct/incorrect — only audio feedback

---

## 13. Test Scenarios

### Scenario: Complete game with all correct (9 rounds, 3 levels)

```
SETUP: Start screen → click "Let's go!" → Level 1 transition → click "Let's go!"
ACTIONS:
  // Round 1: 47 + 33 = 80
  type "80" in #answer-input
  click #btn-check
  → correct sound plays, advance after 400ms
  // Round 2: 28 + 14 = 42
  type "42" in #answer-input, click #btn-check
  // Round 3: 56 + 25 = 81
  type "81" in #answer-input, click #btn-check
  → Level 2 transition screen appears
  click "Next Level"
  // Round 4: 36 + 84 = 120
  type "120", click #btn-check
  // Round 5: 67 + 45 = 112
  type "112", click #btn-check
  // Round 6: 49 + 73 = 122
  type "122", click #btn-check
  → Level 3 transition
  click "Next Level"
  // Round 7: 78 + 56 = 134
  type "134", click #btn-check
  // Round 8: 83 + 69 = 152
  type "152", click #btn-check
  // Round 9: 95 + 47 = 142
  type "142", click #btn-check
ASSERT:
  gameState.score == 9, results visible, 3 stars if avg <15s per level
```

### Scenario: Use adjustment aid then answer

```
SETUP: Round 1 (47 + 33), game active
ACTIONS:
  click adj-plus on number A 3 times → deltaA = +3, adjusted = 50, badge "+3"
  click adj-minus on number B 3 times → deltaB = -3, adjusted = 30, badge "-3"
  type "80" in #answer-input
  click #btn-check
ASSERT:
  correct sound plays
  gameState.deltaA == 3, gameState.deltaB == -3 (recorded in attempt)
  advance to round 2
```

### Scenario: Wrong answer → lose life, retry same round

```
SETUP: Round 1, 47 + 33 = 80
ACTIONS:
  type "75" in #answer-input
  click #btn-check
ASSERT:
  wrong sound plays, dynamic audio "Not quite..."
  gameState.lives == 2
  input cleared, Check button hidden
  still on round 1 (gameState.currentRound == 0)
  adjustments preserved (if any were made)
```

### Scenario: Adjust numbers independently

```
SETUP: Round 1, 47 + 33
ACTIONS:
  click adj-minus on number A once → deltaA = -1, adjusted A shows 46
  click adj-plus on number B once → deltaB = +1, adjusted B shows 34
ASSERT:
  number A: badge "-1", top area shows "− 46"
  number B: badge "+1", bottom area shows "+ 34"
  numbers are independently adjusted
```

### Scenario: Reset clears adjustments and input

```
SETUP: Round 1, user has adjusted both numbers and typed in input
ACTIONS:
  click adj-plus on A 3 times, click adj-minus on B 2 times
  type "80" in input
  click #btn-reset
ASSERT:
  deltaA == 0, deltaB == 0
  both adjusters show original buttons (no adjusted values, no badges)
  input cleared, Check button hidden
```

### Scenario: Level transitions appear every 3 rounds

```
SETUP: Complete rounds 1-3
ASSERT:
  After round 3 correct, Level 2 transition screen shows
  After clicking "Next Level", round 4 loads
  After round 6, Level 3 transition shows
```

### Scenario: Game over after 3 wrong answers

```
SETUP: 3 wrong attempts on same or different rounds
ACTIONS:
  type "99" → Check → wrong (lives=2)
  type "88" → Check → wrong (lives=1)
  type "77" → Check → wrong (lives=0)
ASSERT:
  lives == 0, game over screen shows, 0 stars
```

### Scenario: Check button visibility

```
SETUP: Round loaded, input empty
ASSERT:
  #btn-check has class "hidden"
ACTIONS:
  type "5" in input
ASSERT:
  #btn-check does NOT have class "hidden"
ACTIONS:
  clear input (backspace)
ASSERT:
  #btn-check has class "hidden" again
```

### Scenario: Star rating based on avg time per level

```
ASSERT:
  avg < 15s/level = 3★
  avg 15-25s/level = 2★
  avg ≥ 25s/level = 1★
  game over = 0★
```

### Scenario: ProgressBar + timer

```
ASSERT:
  "0/9 rounds completed" + 3 hearts at start
  timer counting up
  updates after each round and life loss
```

### Scenario: Restart resets everything

```
ACTIONS: click restart
ASSERT: all state reset, level=1, transition screen shows
```

---

## 14. Verification Checklist

### Structural
- [ ] DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in order (PART-002)
- [ ] Single style + single script (RULE-007)
- [ ] #app, #game-screen, #results-screen, #timer-container

### Functional
- [ ] waitForPackages with 10s timeout (PART-003)
- [ ] Init sequence correct (PART-004)
- [ ] VisibilityTracker (PART-005)
- [ ] TimerComponent increase (PART-006)
- [ ] PostMessage handling (PART-008)
- [ ] Fallback content (PART-008)
- [ ] recordAttempt shape (PART-009)
- [ ] trackEvent (PART-010)
- [ ] endGame metrics+cleanup (PART-011)
- [ ] Debug functions (PART-012)
- [ ] showResults (PART-019)
- [ ] No anti-patterns (PART-026)

### Design & Layout
- [ ] CSS variables (PART-020)
- [ ] ScreenLayout (PART-021)
- [ ] 480px max, 100dvh (PART-021)
- [ ] game-btn + btn-primary (PART-022)
- [ ] ProgressBar: 9 rounds, 3 lives (PART-023)
- [ ] update() with rounds COMPLETED (PART-023)
- [ ] TransitionScreen: start, level transitions, victory, game-over (PART-024)
- [ ] ScreenLayout.inject before components (PART-025)
- [ ] Template cloneNode (PART-025)

### Rules
- [ ] RULE-001: Global scope — all onclick handlers global
- [ ] RULE-002: async keyword on all async functions
- [ ] RULE-003: try/catch on all async calls
- [ ] RULE-004: JSON.stringify in all logging
- [ ] RULE-005: Cleanup in endGame (timer, progressBar, visibilityTracker, FeedbackManager)
- [ ] RULE-006: No new Audio(), setInterval for timer, SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific
- [ ] Two numbers displayed with independent +/− buttons
- [ ] Each click adjusts by ±1 (independent — adjusting A does NOT affect B)
- [ ] Delta > 0: adjusted value shown below (+ area), green badge with "+N"
- [ ] Delta < 0: adjusted value shown above (− area), red badge with "-N"
- [ ] Delta = 0: default +/− buttons, no badge
- [ ] Reset button resets both deltas to 0, clears input
- [ ] Input field with "?" placeholder, number-only
- [ ] Check button appears only when input is non-empty
- [ ] Correct answer = original numberA + numberB (not adjusted values)
- [ ] No red/green background change — audio-only feedback
- [ ] Wrong answer: lose life, clear input, retry same round (adjustments preserved)
- [ ] 9 rounds, 3 levels (3 per level), 3 lives
- [ ] Level transition screens between levels (after rounds 3 and 6)
- [ ] Stars: avg time per level <15s = 3★, <25s = 2★, ≥25s = 1★, game-over = 0★
- [ ] Level time tracked from startLevel() to level completion
- [ ] isProcessing prevents interaction during feedback
- [ ] All fallback sums verified correct
- [ ] `window.gameState`, restartGame recreates components
- [ ] Transition screens use buttons

### Contract Compliance
- [ ] gameState, attempts, metrics, duration_data, postMessage schemas