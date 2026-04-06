# Game Spec: Adjustment Strategy

> Assembly book for HTML generation. An LLM reading ONLY this file must be able to produce the correct, working HTML with zero ambiguity.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — Button IDs required.** The adjuster buttons MUST have IDs `btn-a-minus`, `btn-a-plus`, `btn-b-minus`, `btn-b-plus` in both the initial HTML template and in every `updateAdjusterUI()` innerHTML rebuild. Tests select buttons by these IDs. Missing IDs after a UI update cause all mechanics tests to fail.

---

## 1. Game Identity

- **Title:** Adjustment Strategy
- **Game ID:** game_1742306400_adj9strat
- **Type:** standard
- **Description:** A mental addition strategy game where players adjust two addends to "friendlier" numbers (e.g., 47+33 → 50+30), then type the original sum. Reinforces number sense and compensation strategy across 9 rounds in 3 levels.

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | — |
| PART-002 | Package Scripts | YES | — |
| PART-003 | waitForPackages | YES | — |
| PART-004 | Initialization Block | YES | See DOMContentLoaded sequence in Section 9 |
| PART-005 | VisibilityTracker | YES | popupProps: title="Game Paused", description="Click Resume to continue.", primaryText="Resume" |
| PART-006 | TimerComponent | YES | timerType='increase', format='min', startTime=0, endTime=100000, autoStart=false |
| PART-007 | Game State Object | YES | Custom fields: lives, totalLives, numberA, numberB, correctAnswer, deltaA, deltaB, roundStartTime, levelStartTime, levelTimes, level, wrongAttempts, isProcessing, pendingEndProblem |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | validationType: 'fixed' |
| PART-010 | Event Tracking | YES | Custom events: adjustment_made, answer_checked, life_lost, level_complete |
| PART-011 | End Game & Metrics | YES | Custom star logic: time-based per level average (see Section 8) |
| PART-012 | Debug Functions | YES | — |
| PART-013 | Validation Fixed | YES | parseInt(input) === numberA + numberB |
| PART-014 | Validation Function | NO | — |
| PART-015 | Validation LLM | NO | — |
| PART-016 | StoriesComponent | NO | — |
| PART-017 | Feedback Integration | YES | Audio preloaded in init; correct_tap and wrong_tap; TTS for game complete |
| PART-018 | Case Converter | NO | — |
| PART-019 | Results Screen UI | YES | Custom metric rows: Level, Lives remaining |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | CSS only — ScreenLayout.inject() generates the HTML structure |
| PART-022 | Game Buttons | YES | Check button (custom, not standard Submit); Reset button top-right |
| PART-023 | ProgressBar Component | YES | totalRounds=9, totalLives=3, slotId='mathai-progress-slot' |
| PART-024 | TransitionScreen Component | YES | Screens: start, level-transition, victory, game-over |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | Verification checklist, not code-generating |
| PART-027 | Play Area Construction | YES | Layout: two-column adjuster + answer input |
| PART-028 | InputSchema Patterns | YES | Schema type: rounds array with numberA, numberB, correctAnswer |
| PART-029 | Story-Only Game | NO | — |
| PART-030 | Sentry Error Tracking | YES | Error monitoring for every game; DSN from SentryConfig package |
| PART-031 | API Helper | NO | — |
| PART-032 | AnalyticsManager | NO | — |
| PART-033 | Interaction Patterns | NO | No drag-drop, no grid interaction, no tag input |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | Serializes Section 4 to inputSchema.json |
| PART-035 | Test Plan Generation | YES (POST_GEN) | Generates tests.md after HTML |
| PART-037 | Playwright Testing | YES (POST_GEN) | Ralph loop generates tests + fix cycle |
| PART-038 | InteractionManager | NO | — |

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
  lives: 3,              // Remaining lives (lose one per wrong answer)
  totalLives: 3,         // Starting lives (always 3)
  numberA: 0,            // First addend from content (original, unchanged)
  numberB: 0,            // Second addend from content (original, unchanged)
  correctAnswer: 0,      // numberA + numberB, set at round load
  deltaA: 0,             // User's current adjustment to numberA (can be negative)
  deltaB: 0,             // User's current adjustment to numberB (can be negative)
  roundStartTime: null,  // ms timestamp when current round started
  levelStartTime: null,  // ms timestamp when current level started
  levelTimes: [],        // ms elapsed per completed level (max 3 entries)
  level: 1,              // Current level (1-3)
  wrongAttempts: 0,      // Wrong attempts on current round (for retry loop)
  isProcessing: false,   // Prevent double-submit during async feedback
  pendingEndProblem: null // Deferred SignalCollector endProblem (PART-010)
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
```

---

## 4. Input Schema (External Variables)

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "minItems": 9,
      "maxItems": 9,
      "items": {
        "type": "object",
        "properties": {
          "numberA": { "type": "integer", "description": "First addend" },
          "numberB": { "type": "integer", "description": "Second addend" },
          "correctAnswer": { "type": "integer", "description": "numberA + numberB (the original sum)" }
        },
        "required": ["numberA", "numberB", "correctAnswer"]
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
    // Level 1 (rounds 0-2)
    { numberA: 47, numberB: 33, correctAnswer: 80 },
    { numberA: 28, numberB: 14, correctAnswer: 42 },
    { numberA: 56, numberB: 25, correctAnswer: 81 },
    // Level 2 (rounds 3-5)
    { numberA: 36, numberB: 84, correctAnswer: 120 },
    { numberA: 67, numberB: 45, correctAnswer: 112 },
    { numberA: 49, numberB: 73, correctAnswer: 122 },
    // Level 3 (rounds 6-8)
    { numberA: 78, numberB: 56, correctAnswer: 134 },
    { numberA: 83, numberB: 69, correctAnswer: 152 },
    { numberA: 95, numberB: 47, correctAnswer: 142 }
  ]
};
```

---

## 5. Screens & HTML Structure

The game uses ScreenLayout (PART-025). The `<body>` contains only `<div id="app"></div>` and a `<template id="game-template">`. All game HTML is placed inside the template and cloned into `#gameContent` after `ScreenLayout.inject()`. There is NO static game HTML in `<body>` outside of these two elements.

### Body structure (before inject)

```html
<div id="app"></div>

<template id="game-template">
  <!-- Game screen: active during gameplay -->
  <div id="game-screen" class="game-block" style="display:none;">

    <!-- Reset button: top-right corner, always visible during gameplay -->
    <div class="reset-row">
      <button class="btn-reset" id="btn-reset" onclick="resetAdjustments()">&#8635; Reset</button>
    </div>

    <!-- Level/round label -->
    <div class="level-label" id="level-label">Level 1 &middot; Round 1</div>

    <!-- Two number adjusters side by side, with + between -->
    <div class="adjusters-row" id="adjusters-row">

      <!-- Number A adjuster -->
      <!-- CRITICAL: The minus and plus buttons for each adjuster MUST have the IDs shown below.
           Tests locate these buttons by ID (#btn-a-minus, #btn-a-plus, #btn-b-minus, #btn-b-plus).
           These IDs must be present both in the initial HTML template AND re-injected by updateAdjusterUI(). -->
      <div class="number-adjuster" id="adjuster-a">
<<<<<<< Updated upstream
        <div class="adj-top-area" id="adj-a-top">
          <button class="adj-btn adj-minus" id="btn-a-minus" onclick="adjustNumber('a', -1)">−</button>
        </div>
        <div class="number-box" id="number-box-a">
          <span class="original-number" id="original-a">0</span>
          <span class="delta-badge hidden" id="delta-badge-a"></span>
        </div>
        <div class="adj-bottom-area" id="adj-a-bottom">
          <button class="adj-btn adj-plus" id="btn-a-plus" onclick="adjustNumber('a', 1)">+</button>
        </div>
=======
        <!-- Top area: shows adj-minus button (delta=0 or delta>0); shows adj-label-minus (delta<0) -->
        <div class="adj-top" id="adj-top-a"></div>
        <!-- Number box with optional delta badge -->
        <div class="number-box-wrap">
          <div class="number-box" id="number-box-a" data-signal-id="number-box-a">
            <span id="number-a-display">47</span>
          </div>
          <span class="delta-badge hidden" id="delta-badge-a"></span>
        </div>
        <!-- Bottom area: shows adj-plus button (delta=0 or delta<0); shows adj-label-plus (delta>0) -->
        <div class="adj-bottom" id="adj-bottom-a"></div>
>>>>>>> Stashed changes
      </div>

      <!-- Plus sign between the two adjusters -->
      <div class="plus-sign">+</div>

      <!-- Number B adjuster -->
      <div class="number-adjuster" id="adjuster-b">
<<<<<<< Updated upstream
        <div class="adj-top-area" id="adj-b-top">
          <button class="adj-btn adj-minus" id="btn-b-minus" onclick="adjustNumber('b', -1)">−</button>
        </div>
        <div class="number-box" id="number-box-b">
          <span class="original-number" id="original-b">0</span>
          <span class="delta-badge hidden" id="delta-badge-b"></span>
        </div>
        <div class="adj-bottom-area" id="adj-b-bottom">
          <button class="adj-btn adj-plus" id="btn-b-plus" onclick="adjustNumber('b', 1)">+</button>
        </div>
=======
        <div class="adj-top" id="adj-top-b"></div>
        <div class="number-box-wrap">
          <div class="number-box" id="number-box-b" data-signal-id="number-box-b">
            <span id="number-b-display">33</span>
          </div>
          <span class="delta-badge hidden" id="delta-badge-b"></span>
        </div>
        <div class="adj-bottom" id="adj-bottom-b"></div>
>>>>>>> Stashed changes
      </div>

    </div><!-- /.adjusters-row -->

    <!-- Instruction text -->
    <div class="instruction-text">What is the sum?</div>

    <!-- Answer area: input + Check button -->
    <div class="answer-area" id="answer-area">
      <input
        type="number"
        id="answer-input"
        class="answer-input"
        placeholder="?"
        autocomplete="off"
        inputmode="numeric"
        data-signal-id="answer-input"
        oninput="onInputChange()"
      >
      <button
        class="btn-check hidden"
        id="btn-check"
        onclick="checkAnswer()"
        data-signal-id="btn-check"
      >Check</button>
    </div>

    <!-- Timer container (populated by TimerComponent) -->
    <div id="timer-container" style="margin-top:8px;text-align:center;"></div>

  </div><!-- /#game-screen -->

  <!-- Results screen: shown after endGame() -->
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
          <span class="metric-label">Level Reached</span>
          <span id="result-level" class="metric-value">1</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Lives Left</span>
          <span id="result-lives" class="metric-value">3</span>
        </div>
      </div>
      <button onclick="restartGame()" class="game-btn btn-secondary" style="margin-top:16px;">Play Again</button>
    </div>
  </div><!-- /#results-screen -->

</template>
```

### Adjuster rendering rules

Each adjuster column has three zones: top, number-box, bottom.

**When delta = 0 (initial state):**
- Top area (`adj-top`): renders `<button class="adj-btn adj-minus" onclick="adjustNumber('a', -1)">−</button>`
- Number box: shows original number (e.g., 47)
- Bottom area (`adj-bottom`): renders `<button class="adj-btn adj-plus" onclick="adjustNumber('a', 1)">+</button>`
- Delta badge: hidden

**When delta < 0 (e.g., deltaA = -3, adjustedA = 44):**
- Top area: renders `<div class="adj-label adj-label-minus" onclick="adjustNumber('a', -1)" style="cursor:pointer;"><span class="adj-label-icon">&#8595;</span> 44</div>` (clickable — clicking continues decreasing delta)
- Number box: still shows original 47 (unchanged)
- Bottom area: renders `<button class="adj-btn adj-plus" onclick="adjustNumber('a', 1)">+</button>`
- Delta badge: class `delta-badge negative`, text `-3`

**When delta > 0 (e.g., deltaA = +3, adjustedA = 50):**
- Top area: renders `<button class="adj-btn adj-minus" onclick="adjustNumber('a', -1)">−</button>`
- Number box: still shows original 47 (unchanged)
- Bottom area: renders `<div class="adj-label adj-label-plus" onclick="adjustNumber('a', 1)" style="cursor:pointer;"><span class="adj-label-icon">&#8593;</span> 50</div>` (clickable — clicking continues increasing delta)
- Delta badge: class `delta-badge positive`, text `+3`

The number displayed in the number-box (via `#number-a-display` / `#number-b-display`) is ALWAYS the original numberA/numberB. It never changes as the user adjusts.

`updateAdjusterUI(which)` is called after every `adjustNumber()` call and on `renderAdjusters()`. It rebuilds the innerHTML of `adj-top-{which}` and `adj-bottom-{which}` and updates the delta badge. When delta != 0, the label div carries an `onclick` to continue adjusting in the same direction — no separate button is rendered alongside it.

---

## 6. CSS

```css
/* ===================== BASE LAYOUT (PART-021) ===================== */
html, body {
  height: 100%;
  margin: 0;
  background: #f6f6f6;
  font-family: var(--mathai-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
}

.page-center {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100dvh;
  box-sizing: border-box;
}

.game-wrapper {
  width: 100vw;
  max-width: var(--mathai-game-max-width, 480px);
  box-sizing: border-box;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 100dvh;
  padding-top: 54px;
  position: relative;
}

.game-stack {
  display: flex;
  flex-direction: column;
  gap: var(--mathai-stack-gap, 10px);
  padding: 0 10px 20px 10px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

.game-block {
  padding: var(--mathai-stack-gap, 10px);
  margin-bottom: var(--mathai-stack-gap, 10px);
  background: transparent;
  border-radius: 8px;
  box-sizing: border-box;
}

.content-fill {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - 54px);
  box-sizing: border-box;
}

#mathai-progress-slot,
.mathai-progress-slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

@media (min-width: 520px) {
  .game-wrapper { width: 100%; }
}

/* ===================== BUTTONS (PART-022) ===================== */
.btn-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: var(--mathai-padding-small, 10px);
  flex-wrap: wrap;
}

.game-btn {
  padding: 14px 32px;
  font-size: var(--mathai-font-size-button, 16px);
  font-weight: 600;
  font-family: var(--mathai-font-family, system-ui);
  border: none;
  border-radius: var(--mathai-border-radius-button, 10px);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-white, #ffffff);
}

.game-btn:active { transform: translateY(0); }
.game-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary {
  background: var(--mathai-green, #219653);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

.btn-secondary {
  background: var(--mathai-blue, #667eea);
}
.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.hidden { display: none !important; }

/* ===================== RESET BUTTON ===================== */
.reset-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.btn-reset {
  background: transparent;
  border: 1.5px solid #ccc;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset:hover {
  background: #f0f0f0;
  border-color: #aaa;
}

/* ===================== LEVEL LABEL ===================== */
.level-label {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--mathai-level-text, #270F63);
  margin-bottom: 12px;
  letter-spacing: 0.02em;
}

/* ===================== ADJUSTERS ROW ===================== */
.adjusters-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 8px 0 16px;
}

.plus-sign {
  font-size: 28px;
  font-weight: 700;
  color: var(--mathai-primary, #270f36);
  flex-shrink: 0;
  margin-top: 6px;
}

/* ===================== SINGLE ADJUSTER ===================== */
.number-adjuster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* Top and bottom areas: fixed height so layout does not shift */
.adj-top,
.adj-bottom {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
}

/* Adjuster buttons */
.adj-btn {
  width: 80px;
  height: 36px;
  border-radius: 8px;
  border: 1.5px solid;
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.adj-minus {
  background: #FFF5F5;
  border-color: #F5D5D5;
  color: #c0392b;
}
.adj-minus:hover {
  background: #FFE8E8;
  border-color: #e88;
}
.adj-minus:active { transform: scale(0.96); }

.adj-plus {
  background: #F5FFF5;
  border-color: #D5F0D5;
  color: #219653;
}
.adj-plus:hover {
  background: #E5FFE5;
  border-color: #8d8;
}
.adj-plus:active { transform: scale(0.96); }

/* Adjusted-value display labels (shown when delta != 0 in that direction) */
.adj-label {
  width: 80px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  gap: 4px;
  user-select: none;
}

.adj-label-minus {
  background: #FFF5F5;
  color: #c0392b;
  border: 1.5px solid #F5D5D5;
}

.adj-label-plus {
  background: #F5FFF5;
  color: #219653;
  border: 1.5px solid #D5F0D5;
}

.adj-label-icon {
  font-size: 12px;
}

/* ===================== NUMBER BOX ===================== */
.number-box-wrap {
  position: relative;
  display: inline-block;
}

.number-box {
  width: 80px;
  height: 60px;
  border: 2.5px solid #ddd;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--mathai-primary, #270f36);
  background: #fff;
  transition: border-color 0.2s ease;
}

/* ===================== DELTA BADGE ===================== */
.delta-badge {
  position: absolute;
  top: -8px;
  right: -10px;
  min-width: 26px;
  height: 20px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-sizing: border-box;
  pointer-events: none;
  white-space: nowrap;
}

.delta-badge.positive {
  background: #D5F0D5;
  color: #219653;
  border: 1px solid #adc;
}

.delta-badge.negative {
  background: #FFD9D9;
  color: #c0392b;
  border: 1px solid #eaa;
}

/* ===================== INSTRUCTION ===================== */
.instruction-text {
  text-align: center;
  font-size: 15px;
  color: var(--mathai-gray, #666666);
  margin-bottom: 12px;
}

/* ===================== ANSWER AREA ===================== */
.answer-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.answer-input {
  width: 80px;
  height: 52px;
  border: 2.5px solid #E0E0E0;
  border-radius: 10px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  color: var(--mathai-primary, #270f36);
  outline: none;
  transition: border-color 0.2s ease;
  /* Remove browser spinner arrows on number input */
  -moz-appearance: textfield;
}
.answer-input::-webkit-outer-spin-button,
.answer-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.answer-input:focus {
  border-color: #E8D98A;
  box-shadow: 0 0 0 3px rgba(232, 217, 138, 0.3);
}

/* Check button: blue, pill shape */
.btn-check {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 24px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.btn-check:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
}
.btn-check:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===================== RESULTS SCREEN ===================== */
.results-container {
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  margin: 0 auto;
}

.results-container h2 {
  font-size: 26px;
  color: var(--mathai-primary, #270f36);
  margin: 0 0 12px;
}

.stars-display {
  font-size: 36px;
  margin: 12px 0;
  letter-spacing: 4px;
}

.results-metrics {
  background: #f8f8f8;
  border-radius: 12px;
  padding: 16px 20px;
  margin: 16px 0;
  text-align: left;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}
.metric-row:last-child { border-bottom: none; }

.metric-label {
  font-size: 14px;
  color: var(--mathai-gray, #666);
}
.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--mathai-primary, #270f36);
}
```

---

## 7. Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() {
  if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled) {
    Sentry.init({
      dsn: SentryConfig.dsn,
      environment: SentryConfig.environment,
      release: "adjustment-strategy@1.0.0",
      tracesSampleRate: SentryConfig.tracesSampleRate,
      sampleRate: SentryConfig.sampleRate,
      maxBreadcrumbs: 50,
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured",
        "Script error.",
        "Load failed",
        "Failed to fetch",
      ],
    });
  }

  window.addEventListener("error", (event) => {
    Sentry.captureException(event.error || new Error(event.message), {
      tags: { errorType: "unhandled", severity: "critical" },
      contexts: {
        errorEvent: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
        },
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    Sentry.captureException(
      event.reason || new Error("Unhandled promise rejection"),
      {
        tags: { errorType: "unhandled-promise", severity: "critical" },
      },
    );
  });

  window.verifySentry = function () {
    const checks = {
      sdkLoaded: typeof Sentry !== 'undefined',
      configLoaded: typeof SentryConfig !== 'undefined',
      initialized: typeof Sentry !== 'undefined' && Sentry.getClient() !== undefined,
      dsn: typeof Sentry !== 'undefined' ? Sentry.getClient()?.getDsn()?.toString() : null,
      configVersion: typeof SentryConfig !== 'undefined' ? SentryConfig.version : null,
      replayEnabled: typeof SentryConfig !== 'undefined' ? SentryConfig.captureReplay : null
    };
    console.log("Sentry Status:", JSON.stringify(checks, null, 2));
    return checks;
  };

  window.testSentry = function () {
    try {
      throw new Error("Test error from testSentry()");
    } catch (error) {
      Sentry.captureException(error, { tags: { test: true } });
      console.log("Test error sent to Sentry. Check dashboard.");
    }
  };
}
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

1. **Page loads** → DOMContentLoaded fires
<<<<<<< Updated upstream
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
   - Stars: if reason === 'victory': avg <15s = 3★, <25s = 2★, ≥25s = 1★. If reason === 'game_over': **always 0★, no formula**
   - Dynamic audio, results, postMessage (MUST include `duration_data` and `attempts` in metrics), cleanup

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

> **CRITICAL — Button IDs must survive every UI update:**
> When using `innerHTML` to rebuild the top/bottom areas, you MUST include `id="btn-${which}-minus"` and `id="btn-${which}-plus"` on the reconstructed buttons. Tests locate buttons by ID (`#btn-a-plus`, `#btn-a-minus`, `#btn-b-plus`, `#btn-b-minus`). If `innerHTML` is used without re-injecting these IDs, Playwright will fail to find the buttons after any adjustment because the original DOM node is replaced with a new one lacking the ID.
>
> **Preferred pattern:** Use `setAttribute`/`classList.toggle` to update values in-place so button DOM nodes (and their IDs) are preserved. Only use `innerHTML` if you always include `id="btn-${which}-minus"` / `id="btn-${which}-plus"` in the injected markup.

- const delta = which === 'a' ? gameState.deltaA : gameState.deltaB
- const original = which === 'a' ? gameState.numberA : gameState.numberB
- const topArea = document.getElementById(`adj-${which}-top`)
- const bottomArea = document.getElementById(`adj-${which}-bottom`)
- const badge = document.getElementById(`delta-badge-${which}`)
-
- If delta === 0:
  - // Show default buttons (with IDs), hide badge
  - topArea.innerHTML = `<button class="adj-btn adj-minus" id="btn-${which}-minus" onclick="adjustNumber('${which}', -1)">−</button>`
  - bottomArea.innerHTML = `<button class="adj-btn adj-plus" id="btn-${which}-plus" onclick="adjustNumber('${which}', 1)">+</button>`
  - badge.className = 'delta-badge hidden'
  - badge.textContent = ''
- Else if delta < 0:
  - // Minus area shows adjusted value with "−" prefix
  - topArea.innerHTML = `<div class="adjusted-value-display"><span class="adj-icon minus">−</span> <strong>${original + delta}</strong></div>`
  - // Plus area keeps its button (WITH id)
  - bottomArea.innerHTML = `<button class="adj-btn adj-plus" id="btn-${which}-plus" onclick="adjustNumber('${which}', 1)">+</button>`
  - // Badge shows red negative delta
  - badge.className = 'delta-badge negative'
  - badge.textContent = `${delta}`
- Else if delta > 0:
  - // Minus area keeps its button (WITH id)
  - topArea.innerHTML = `<button class="adj-btn adj-minus" id="btn-${which}-minus" onclick="adjustNumber('${which}', -1)">−</button>`
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
  - // CRITICAL: Reset isProcessing BEFORE scheduling roundComplete.
  - // If isProcessing stays true across the setTimeout, the next round's loadRound() resets it, but
  - // any rapid user interaction during the 400ms window gets blocked. Worse: if FeedbackManager
  - // await throws and isProcessing is never reset, the game permanently locks all input.
  - gameState.isProcessing = false
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
- // CRITICAL: postMessage MUST include duration_data and attempts inside metrics.
- // The contract validator checks: metrics.duration_data (with startTime, attempts, inActiveTime),
- // metrics.attempts (array of attempt objects). Both must be non-null — never omit them.
- // metrics already contains duration_data and attempts (see metrics object construction above).
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
=======
   - `waitForPackages()` — waits for FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector
   - `FeedbackManager.init()`
   - `FeedbackManager.sound.preload([{id:'correct_tap', url:'...'}, {id:'wrong_tap', url:'...'}])`
   - `signalCollector = new SignalCollector({...})`; `window.signalCollector = signalCollector`
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `#game-template` content into `#gameContent`
   - `timer = new TimerComponent('timer-container', { timerType:'increase', format:'min', startTime:0, endTime:100000, autoStart:false, onEnd:() => endGame('complete') })`
   - `progressBar = new ProgressBarComponent({ autoInject:true, totalRounds:9, totalLives:3, slotId:'mathai-progress-slot' })`
   - `transitionScreen = new TransitionScreenComponent({ autoInject:true })`
   - `visibilityTracker = new VisibilityTracker({...})`
   - `window.addEventListener('message', handlePostMessage)`
   - `setupGame()` — sets fallback content, then shows start transition screen

2. **`setupGame()`** runs:
   - If `!gameState.content`, sets `gameState.content = fallbackContent`
   - Sets `gameState.startTime = Date.now()`, `isActive = true`
   - Resets `currentRound = 0`, `score = 0`, `attempts = []`, `events = []`
   - Resets `lives = 3`, `level = 1`, `levelTimes = []`, `deltaA = 0`, `deltaB = 0`, `isProcessing = false`, `pendingEndProblem = null`
   - Sets `gameState.duration_data.startTime = new Date().toISOString()`
   - Calls `trackEvent('game_start', 'game')`
   - Shows start transition screen: icon '➕', title "Let's go!", button "Let's go!" → `startGame()`
   - NOTE: timer is NOT started here; `startGame()` starts it after user clicks

3. **`startGame()`** (called from transition button):
   - Calls `timer.start()`
   - Sets `gameState.levelStartTime = Date.now()`
   - Shows `#game-screen` (sets `style.display = 'block'`)
   - Hides `#results-screen`
   - Calls `loadRound()`

4. **`loadRound()`** (called at each new round):
   - Flushes deferred `endProblem` if `gameState.pendingEndProblem` exists
   - Gets `roundData = gameState.content.rounds[gameState.currentRound]`
   - Sets `gameState.numberA`, `numberB`, `correctAnswer = numberA + numberB`
   - Resets `deltaA = 0`, `deltaB = 0`, `wrongAttempts = 0`, `isProcessing = false`, `roundStartTime = Date.now()`
   - Sets level: `gameState.level = Math.floor(gameState.currentRound / 3) + 1`
   - Updates `#level-label` text: "Level {level} · Round {(currentRound % 3) + 1}"
   - Updates `#number-a-display` text to `numberA`; `#number-b-display` text to `numberB`
   - Calls `renderAdjusters()` (resets adj-top/bottom to default buttons, hides badges)
   - Calls `clearAnswerArea()` (clears input, hides btn-check)
   - Calls `progressBar.update(gameState.currentRound, gameState.lives)`
   - Calls `signalCollector.startProblem('round_' + currentRound, {...})`
   - Calls `signalCollector.recordViewEvent('content_render', {...})`
   - Calls `trackEvent('question_shown', 'game', { round, numberA, numberB, correctAnswer })`

5. **User adjusts numbers** (optional before answering):
   - Clicks `adj-btn.adj-minus` or `adj-btn.adj-plus` inside an adjuster → `adjustNumber('a'|'b', -1|1)`
   - `adjustNumber(which, direction)`: increments/decrements `deltaA` or `deltaB` by 1
   - Calls `updateAdjusterUI(which)` to re-render that adjuster column
   - Records view event and trackEvent

6. **User types answer** → `onInputChange()`:
   - If `input.value.trim() !== ''`: removes `.hidden` from `#btn-check`
   - Else: adds `.hidden` to `#btn-check`

7. **User clicks Check** → `checkAnswer()` (async):
   - Guards: `if (gameState.isProcessing) return`; sets `isProcessing = true`
   - Reads `parseInt(document.getElementById('answer-input').value, 10)` → `userAnswer`
   - Validates: `userAnswer === gameState.correctAnswer` (the original sum, NOT adjusted values)
   - Calls `recordAttempt({...})`
   - Disables input, hides btn-check
   - **If correct:**
     - `gameState.score++`
     - Sets `pendingEndProblem`
     - `await FeedbackManager.sound.play('correct_tap', { subtitle: getCorrectPhrase() })`
     - Sets `isProcessing = false`
     - Calls `roundComplete()`
   - **If incorrect:**
     - `gameState.lives--`
     - `gameState.wrongAttempts++`
     - `trackEvent('life_lost', ...)`
     - `progressBar.update(gameState.currentRound, gameState.lives)`
     - Sets `pendingEndProblem`
     - `await FeedbackManager.sound.play('wrong_tap', { subtitle: 'Not quite! Try again.' })`
     - If `lives <= 0`: sets `isProcessing = false`, calls `endGame('game_over')`, returns
     - Else: clears input (`input.value = ''`), re-enables input (`input.disabled = false`), sets `isProcessing = false` (allows retry on same round)

8. **`roundComplete()`**:
   - `gameState.currentRound++`
   - If `currentRound % 3 === 0` AND `currentRound < 9` (level boundary):
     - `gameState.levelTimes.push(Date.now() - levelStartTime)`
     - `gameState.level++`
     - `gameState.levelStartTime = Date.now()`
     - Calls `trackEvent('level_complete', 'game', { level: gameState.level - 1 })`
     - Calls `showLevelTransition(gameState.level)` and returns
   - If `currentRound >= 9` (all rounds done):
     - `gameState.levelTimes.push(Date.now() - levelStartTime)`
     - Calls `endGame('complete')` and returns
   - Else: calls `loadRound()`

9. **`showLevelTransition(level)`**:
   - Hides `#game-screen`
   - Calls `transitionScreen.show({ icons:['🎯'], iconSize:'normal', title:'Level '+level+'!', titleStyles:{color:'#270F63', fontSize:'36px'}, duration:2000 })` — uses `duration` ONLY, no buttons
   - After 2000ms (via `setTimeout`): sets `gameState.levelStartTime = Date.now()`, shows `#game-screen`, calls `loadRound()`

10. **End conditions that call `endGame(reason)`:**
    - All 9 rounds completed correctly → `endGame('complete')` from `roundComplete()`
    - Lives reach 0 → `endGame('game_over')` from `checkAnswer()`

11. **`endGame(reason)`** (async):
    - Guard: `if (!gameState.isActive) return`; sets `isActive = false`
    - Calculates time-based stars (see Section 8)
    - Calls `showResults(metrics, reason)` — shows results screen, hides game screen
    - Shows victory or game-over transition screen
    - Sends `game_complete` postMessage
    - Cleans up timer, visibilityTracker, progressBar, audio

---

## 9. Functions

### `waitForPackages()` — copy exactly from PART-003

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();
  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: FeedbackManager');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: TimerComponent');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: VisibilityTracker');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof SignalCollector === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: SignalCollector');
      await new Promise(r => setTimeout(r, 50));
    }
    console.log('All packages loaded');
  } catch (error) {
    console.error('Package loading failed:', error);
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Failed to load. Please refresh.</div>';
    throw error;
  }
}
```

### `trackEvent(type, target, data = {})` — copy exactly from PART-010

```javascript
function trackEvent(type, target, data = {}) {
  gameState.events.push({
    type,
    target,
    timestamp: Date.now(),
    ...data
  });
}
```

### `recordAttempt(data)` — copy exactly from PART-009

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

### `handlePostMessage(event)` — from PART-008

```javascript
function handlePostMessage(event) {
  if (event.data?.type === 'game_init') {
    const { gameId, content, context, goals } = event.data.data;
    gameState.content = content;
    if (gameState.gameId) gameState.gameId = gameId;
    setupGame();
  }
}
```

### `setupGame()`

```javascript
function setupGame() {
  if (!gameState.content) {
    gameState.content = fallbackContent;
  }

  // MANDATORY from PART-004:
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.duration_data.startTime = new Date().toISOString();

  // Game-specific resets:
  gameState.lives = 3;
  gameState.level = 1;
  gameState.levelTimes = [];
  gameState.deltaA = 0;
  gameState.deltaB = 0;
  gameState.wrongAttempts = 0;
  gameState.isProcessing = false;
  gameState.pendingEndProblem = null;

  trackEvent('game_start', 'game');

  // Show start transition screen — user must click to begin
  // timer.start() is called in startGame() after this button is clicked
  transitionScreen.show({
    icons: ['\u2795'],
    iconSize: 'large',
    title: "Let's go!",
    subtitle: 'Adjust the numbers to make addition easier.',
    buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }]
  });
}
```

### `startGame()`

```javascript
function startGame() {
  if (timer) timer.start();
  gameState.levelStartTime = Date.now();
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('results-screen').style.display = 'none';
  loadRound();
}
```

### `loadRound()`

```javascript
function loadRound() {
  // Flush deferred endProblem from previous round (PART-010 deferred pattern)
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }

  const roundData = gameState.content.rounds[gameState.currentRound];
  gameState.numberA = roundData.numberA;
  gameState.numberB = roundData.numberB;
  gameState.correctAnswer = roundData.numberA + roundData.numberB;
  gameState.deltaA = 0;
  gameState.deltaB = 0;
  gameState.wrongAttempts = 0;
  gameState.roundStartTime = Date.now();
  gameState.isProcessing = false;

  const levelNumber = Math.floor(gameState.currentRound / 3) + 1;
  gameState.level = levelNumber;
  const roundInLevel = (gameState.currentRound % 3) + 1;

  document.getElementById('level-label').textContent =
    'Level ' + levelNumber + ' \u00b7 Round ' + roundInLevel;

  // Update number displays
  document.getElementById('number-a-display').textContent = roundData.numberA;
  document.getElementById('number-b-display').textContent = roundData.numberB;

  renderAdjusters();
  clearAnswerArea();

  progressBar.update(gameState.currentRound, gameState.lives);

  if (signalCollector) {
    signalCollector.startProblem('round_' + gameState.currentRound, {
      round_number: gameState.currentRound,
      question_text: roundData.numberA + ' + ' + roundData.numberB,
      correct_answer: gameState.correctAnswer,
      difficulty: levelNumber === 1 ? 'easy' : levelNumber === 2 ? 'medium' : 'hard'
    });
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        question_text: roundData.numberA + ' + ' + roundData.numberB,
        round: gameState.currentRound,
        level: levelNumber,
        trigger: 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: gameState.currentRound, total: 9 }
      }
    });
  }

  trackEvent('question_shown', 'game', {
    round: gameState.currentRound,
    numberA: roundData.numberA,
    numberB: roundData.numberB,
    correctAnswer: gameState.correctAnswer
  });
}
```

### `renderAdjusters()`

```javascript
function renderAdjusters() {
  updateAdjusterUI('a');
  updateAdjusterUI('b');
}
```

### `updateAdjusterUI(which)`

```javascript
function updateAdjusterUI(which) {
  const delta = which === 'a' ? gameState.deltaA : gameState.deltaB;
  const originalNumber = which === 'a' ? gameState.numberA : gameState.numberB;
  const adjustedValue = originalNumber + delta;

  const topEl = document.getElementById('adj-top-' + which);
  const bottomEl = document.getElementById('adj-bottom-' + which);
  const badgeEl = document.getElementById('delta-badge-' + which);

  // Top area: minus button when delta >= 0; clickable label when delta < 0
  if (delta < 0) {
    topEl.innerHTML =
      '<div class="adj-label adj-label-minus" onclick="adjustNumber(\'' + which + '\', -1)" style="cursor:pointer;">' +
      '<span class="adj-label-icon">\u2193</span> ' + adjustedValue +
      '</div>';
  } else {
    topEl.innerHTML =
      '<button class="adj-btn adj-minus" onclick="adjustNumber(\'' + which + '\', -1)">\u2212</button>';
  }

  // Bottom area: plus button when delta <= 0; clickable label when delta > 0
  if (delta > 0) {
    bottomEl.innerHTML =
      '<div class="adj-label adj-label-plus" onclick="adjustNumber(\'' + which + '\', 1)" style="cursor:pointer;">' +
      '<span class="adj-label-icon">\u2191</span> ' + adjustedValue +
      '</div>';
  } else {
    bottomEl.innerHTML =
      '<button class="adj-btn adj-plus" onclick="adjustNumber(\'' + which + '\', 1)">+</button>';
  }

  // Delta badge: show only when delta != 0
  if (delta === 0) {
    badgeEl.className = 'delta-badge hidden';
    badgeEl.textContent = '';
  } else if (delta > 0) {
    badgeEl.className = 'delta-badge positive';
    badgeEl.textContent = '+' + delta;
  } else {
    badgeEl.className = 'delta-badge negative';
    badgeEl.textContent = String(delta); // e.g., "-3"
  }
}
```

### `adjustNumber(which, direction)`

```javascript
function adjustNumber(which, direction) {
  if (gameState.isProcessing) return;
  if (which === 'a') {
    gameState.deltaA += direction;
  } else {
    gameState.deltaB += direction;
  }
  const delta = which === 'a' ? gameState.deltaA : gameState.deltaB;
  const originalNumber = which === 'a' ? gameState.numberA : gameState.numberB;
  const adjustedValue = originalNumber + delta;

  updateAdjusterUI(which);

  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'adjustment_made',
        which: which,
        delta: delta,
        adjustedValue: adjustedValue
      }
    });
  }

  trackEvent('adjustment_made', 'adjuster-' + which, {
    delta: delta,
    adjusted: adjustedValue,
    direction: direction
  });
}
```

### `resetAdjustments()`

```javascript
function resetAdjustments() {
  if (gameState.isProcessing) return;
  gameState.deltaA = 0;
  gameState.deltaB = 0;
  renderAdjusters();
  trackEvent('tap', 'btn-reset', {});
}
```

### `clearAnswerArea()`

```javascript
function clearAnswerArea() {
  const input = document.getElementById('answer-input');
  input.value = '';
  input.disabled = false;
  document.getElementById('btn-check').classList.add('hidden');
}
```

### `onInputChange()`

```javascript
function onInputChange() {
  const input = document.getElementById('answer-input');
  const hasValue = input.value.trim() !== '';
  const btnCheck = document.getElementById('btn-check');
  if (hasValue) {
    btnCheck.classList.remove('hidden');
  } else {
    btnCheck.classList.add('hidden');
  }
  trackEvent('input_change', 'answer-input', { value: input.value });
}
```

### `checkAnswer()` (async, global scope — RULE-001)

```javascript
async function checkAnswer() {
  if (gameState.isProcessing) return;
  gameState.isProcessing = true;

  const input = document.getElementById('answer-input');
  const userAnswer = parseInt(input.value, 10);

  if (isNaN(userAnswer)) {
    gameState.isProcessing = false;
    return;
  }

  // Validation (PART-013 fixed): the answer is always the ORIGINAL sum
  const isCorrect = userAnswer === gameState.correctAnswer;
  const questionText = gameState.numberA + ' + ' + gameState.numberB;

  recordAttempt({
    userAnswer: userAnswer,
    correct: isCorrect,
    question: questionText,
    correctAnswer: gameState.correctAnswer,
    validationType: 'fixed'
  });

  if (signalCollector) {
    signalCollector.recordCustomEvent('answer_checked', {
      correct: isCorrect,
      userAnswer: userAnswer,
      correctAnswer: gameState.correctAnswer
    });
  }

  // Disable input during feedback
  input.disabled = true;
  document.getElementById('btn-check').classList.add('hidden');

  if (isCorrect) {
    gameState.score++;
    gameState.pendingEndProblem = {
      id: 'round_' + gameState.currentRound,
      outcome: { correct: true, answer: userAnswer }
    };

    if (signalCollector) {
      signalCollector.recordViewEvent('feedback_display', {
        screen: 'gameplay',
        content_snapshot: { feedback_type: 'correct', message: getCorrectPhrase() }
      });
    }

    try {
      await FeedbackManager.sound.play('correct_tap', {
        subtitle: getCorrectPhrase()
      });
    } catch (e) {
      console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2));
    }

    gameState.isProcessing = false;
    roundComplete();

  } else {
    gameState.lives--;
    gameState.wrongAttempts++;
    gameState.pendingEndProblem = {
      id: 'round_' + gameState.currentRound,
      outcome: { correct: false, answer: userAnswer }
    };

    trackEvent('life_lost', 'game', {
      lives: gameState.lives,
      round: gameState.currentRound
    });

    progressBar.update(gameState.currentRound, gameState.lives);

    if (signalCollector) {
      signalCollector.recordViewEvent('feedback_display', {
        screen: 'gameplay',
        content_snapshot: { feedback_type: 'incorrect', message: 'Not quite! Try again.' }
      });
    }

    try {
      await FeedbackManager.sound.play('wrong_tap', {
        subtitle: 'Not quite! Try again.'
      });
    } catch (e) {
      console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2));
    }

    if (gameState.lives <= 0) {
      gameState.isProcessing = false;
      endGame('game_over');
      return;
    }

    // Allow retry on same round: re-enable input, clear value
    input.value = '';
    input.disabled = false;
    gameState.isProcessing = false;
  }
}
```

### `getCorrectPhrase()`

```javascript
function getCorrectPhrase() {
  const phrases = [
    'Great job! That\'s right!',
    'Correct! Well done!',
    'Excellent strategy!',
    'Perfect! Keep going!'
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
```

### `roundComplete()`

```javascript
function roundComplete() {
  gameState.currentRound++;

  // Level boundary: every 3 rounds (at round indices 3 and 6)
  if (gameState.currentRound % 3 === 0 && gameState.currentRound < 9) {
    gameState.levelTimes.push(Date.now() - gameState.levelStartTime);
    const nextLevel = gameState.level + 1;
    trackEvent('level_complete', 'game', { level: gameState.level });
    showLevelTransition(nextLevel);
    return;
  }

  // All rounds complete
  if (gameState.currentRound >= 9) {
    gameState.levelTimes.push(Date.now() - gameState.levelStartTime);
    endGame('complete');
    return;
  }

  // Same level, next round
  loadRound();
}
```

### `showLevelTransition(level)`

```javascript
function showLevelTransition(level) {
  document.getElementById('game-screen').style.display = 'none';

  if (signalCollector) {
    signalCollector.recordViewEvent('overlay_toggle', {
      screen: 'transition',
      content_snapshot: {
        overlay: 'transition_screen',
        visible: true,
        title: 'Level ' + level + '!'
      }
    });
  }

  // Use duration only (no buttons) — auto-advance after 2000ms (PART-024 rule)
  transitionScreen.show({
    icons: ['\uD83C\uDFAF'],
    iconSize: 'normal',
    title: 'Level ' + level + '!',
    titleStyles: { color: '#270F63', fontSize: '36px' },
    duration: 2000
  });

  // After 2000ms the transition auto-hides; show game-screen and load next round
  setTimeout(function() {
    gameState.levelStartTime = Date.now();
    document.getElementById('game-screen').style.display = 'block';
    loadRound();
  }, 2000);
}
```

### `endGame(reason)` (async)

Star logic (time-based, per-level average):
- Collect `gameState.levelTimes` (array of ms per completed level, max 3 entries)
- Average seconds = `(sum of levelTimes) / levelTimes.length / 1000`
- Stars: `< 15s` → 3, `< 25s` → 2, `>= 25s` → 1, `reason === 'game_over'` → 0

```javascript
async function endGame(reason) {
  if (!gameState.isActive) return;
  gameState.isActive = false;
  gameState.duration_data.currentTime = new Date().toISOString();

  const correct = gameState.attempts.filter(a => a.correct).length;
  const total = gameState.attempts.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeTaken = timer ? timer.getTimeTaken() : Math.round((Date.now() - gameState.startTime) / 1000);

  // Time-based star calculation (custom — overrides PART-011 default)
  let stars;
  if (reason === 'game_over') {
    stars = 0;
  } else {
    const levelTimesMs = gameState.levelTimes;
    let avgSec = 0;
    if (levelTimesMs.length > 0) {
      const totalMs = levelTimesMs.reduce(function(a, b) { return a + b; }, 0);
      avgSec = totalMs / levelTimesMs.length / 1000;
    }
    stars = avgSec < 15 ? 3 : avgSec < 25 ? 2 : 1;
  }

  const metrics = {
    accuracy: accuracy,
    time: timeTaken,
    stars: stars,
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    levelTimes: gameState.levelTimes,
    livesRemaining: gameState.lives
  };

  console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
  console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

  trackEvent('game_end', 'game', { metrics: metrics });

  // Flush deferred endProblem before sealing (PART-010)
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }

  // Seal SignalCollector (PART-010)
  const signalPayload = signalCollector ? signalCollector.seal() : { events: [], signals: {}, metadata: {} };

  // Show results screen (PART-019)
  showResults(metrics, reason);

  // Show end transition screen
  if (reason === 'game_over') {
    transitionScreen.show({
      icons: ['\uD83D\uDE14'],
      iconSize: 'large',
      title: 'Game Over!',
      subtitle: 'You ran out of lives.',
      buttons: [{ text: 'Try again!', type: 'primary', action: function() { restartGame(); } }]
    });
  } else {
    // Victory: TTS then show victory transition
    try {
      await FeedbackManager.playDynamicFeedback({
        audio_content: 'Great job! You scored ' + accuracy + ' percent!',
        subtitle: 'Great job! You scored ' + accuracy + '%!'
      });
    } catch (e) {
      console.error('TTS error:', JSON.stringify({ error: e.message }, null, 2));
    }
    transitionScreen.show({
      stars: stars,
      title: 'Well done!',
      subtitle: 'You completed all ' + gameState.totalRounds + ' rounds!',
      buttons: [{ text: 'Claim Stars', type: 'primary', action: function() { claimStars(); } }]
    });
  }

  // Send to platform (PART-008)
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: metrics,
      attempts: gameState.attempts,
      events: signalPayload.events,
      signals: signalPayload.signals,
      metadata: signalPayload.metadata,
      completedAt: Date.now()
    }
  }, '*');

  // Cleanup (RULE-005)
  if (timer) { timer.destroy(); timer = null; }
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  if (progressBar) { progressBar.destroy(); progressBar = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

### `claimStars()`

```javascript
function claimStars() {
  transitionScreen.show({
    icons: ['\uD83C\uDF89'],
    iconSize: 'large',
    title: 'Stars Claimed!',
    persist: true
  });
}
```

### `showResults(metrics, reason)` — from PART-019 with custom fields

```javascript
function showResults(metrics, reason) {
  document.getElementById('result-score').textContent = metrics.accuracy + '%';
  document.getElementById('result-time').textContent = formatTime(metrics.time);
  const correctCount = gameState.attempts.filter(function(a) { return a.correct; }).length;
  document.getElementById('result-correct').textContent = correctCount + '/' + gameState.attempts.length;
  document.getElementById('stars-display').textContent =
    '\u2B50'.repeat(metrics.stars) + '\u2606'.repeat(3 - metrics.stars);
  document.getElementById('result-level').textContent = gameState.level;
  document.getElementById('result-lives').textContent = Math.max(0, gameState.lives);
  document.getElementById('results-title').textContent =
    reason === 'game_over' ? 'Game Over!' : 'Game Complete!';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'block';
}
```

### `formatTime(seconds)`

```javascript
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}
```

### `restartGame()` — recreates destroyed components (PART-011 restart pattern)

```javascript
function restartGame() {
  // Reset all state
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.lives = 3;
  gameState.level = 1;
  gameState.levelTimes = [];
  gameState.deltaA = 0;
  gameState.deltaB = 0;
  gameState.wrongAttempts = 0;
  gameState.isProcessing = false;
  gameState.pendingEndProblem = null;
  gameState.duration_data = {
    startTime: new Date().toISOString(),
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null
  };

  // Recreate destroyed components (endGame nulled them)
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    templateId: gameState.gameId || null
  });
  window.signalCollector = signalCollector;

  timer = new TimerComponent('timer-container', {
    timerType: 'increase',
    format: 'min',
    startTime: 0,
    endTime: 100000,
    autoStart: false,
    onEnd: function() { endGame('complete'); }
  });

  progressBar = new ProgressBarComponent({
    autoInject: true,
    totalRounds: 9,
    totalLives: 3,
    slotId: 'mathai-progress-slot'
  });

  visibilityTracker = new VisibilityTracker({
    onInactive: function() {
      const inactiveStart = Date.now();
      gameState.duration_data.inActiveTime.push({ start: inactiveStart });
      if (signalCollector) {
        signalCollector.pause();
        signalCollector.recordCustomEvent('visibility_hidden', {});
      }
      if (timer) timer.pause({ fromVisibilityTracker: true });
      FeedbackManager.sound.pause();
      FeedbackManager.stream.pauseAll();
      trackEvent('game_paused', 'system');
    },
    onResume: function() {
      const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
      if (lastInactive && !lastInactive.end) {
        lastInactive.end = Date.now();
        gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
      }
      if (signalCollector) {
        signalCollector.resume();
        signalCollector.recordCustomEvent('visibility_visible', {});
      }
      if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
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

  // Show game, hide results
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('results-screen').style.display = 'none';

  timer.start();
  gameState.levelStartTime = Date.now();
  trackEvent('game_start', 'game');
  loadRound();
}
```

### DOMContentLoaded block (PART-004)
>>>>>>> Stashed changes

```javascript
window.addEventListener('DOMContentLoaded', async function() {
  try {
    // 1. Wait for packages
    await waitForPackages();

    // 2. Init FeedbackManager
    await FeedbackManager.init();

    // 3. Preload sounds (PART-017) — use preload() array, NOT register()
    try {
      await FeedbackManager.sound.preload([
        { id: 'correct_tap', url: 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740724945201.mp3' },
        { id: 'wrong_tap',   url: 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740725080819.mp3' }
      ]);
    } catch (e) {
      console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2));
    }

    // 4. Create SignalCollector (PART-010) — BEFORE timer
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null
    });
    window.signalCollector = signalCollector;

    // 5. Inject ScreenLayout (PART-025) — BEFORE ProgressBar and TransitionScreen
    ScreenLayout.inject('app', {
      slots: { progressBar: true, transitionScreen: true }
    });

    // 6. Clone game template into #gameContent (PART-025 pattern)
    var gameContentEl = document.getElementById('gameContent');
    var templateEl = document.getElementById('game-template');
    gameContentEl.appendChild(templateEl.content.cloneNode(true));

    // 7. Create TimerComponent (PART-006) — count-up, no autoStart, large endTime
    timer = new TimerComponent('timer-container', {
      timerType: 'increase',
      format: 'min',
      startTime: 0,
      endTime: 100000,
      autoStart: false,
      onEnd: function() { endGame('complete'); }
    });

    // 8. Create ProgressBarComponent (PART-023)
    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: 9,
      totalLives: 3,
      slotId: 'mathai-progress-slot'
    });

    // 9. Create TransitionScreenComponent (PART-024)
    transitionScreen = new TransitionScreenComponent({
      autoInject: true
    });

    // 10. Create VisibilityTracker (PART-005) — AFTER timer
    visibilityTracker = new VisibilityTracker({
      onInactive: function() {
        var inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        if (timer) timer.pause({ fromVisibilityTracker: true });
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
        trackEvent('game_paused', 'system');
      },
      onResume: function() {
        var lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (lastInactive && !lastInactive.end) {
          lastInactive.end = Date.now();
          gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
        }
        if (signalCollector) {
          signalCollector.resume();
          signalCollector.recordCustomEvent('visibility_visible', {});
        }
        if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
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

    // 11. Register postMessage listener
    window.addEventListener('message', handlePostMessage);

    // 12. Run setupGame — sets fallback content and shows start transition screen
    setupGame();

  } catch (error) {
    console.error('Initialization failed:', JSON.stringify({ error: error.message }, null, 2));
  }
});
```

### Debug functions (PART-012) — copy exactly

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
    if (timer) timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  }
  console.log(JSON.stringify({ event: 'testPause', timerPaused: true }));
};

window.testResume = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerResume();
  } else {
    if (timer && timer.isPaused) timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
  console.log(JSON.stringify({ event: 'testResume', timerResumed: true }));
};

window.debugSignals = function() {
  if (!signalCollector) {
    console.log('SignalCollector not initialized');
    return;
  }
  console.log('=== Signal Collector Debug ===');
  signalCollector.debug();
  console.log('Input events:', signalCollector.getInputEvents().length);
  console.log('Problem signals:', JSON.stringify(signalCollector.getAllProblemSignals(), null, 2));
  console.log('Current view:', JSON.stringify(signalCollector.getCurrentView(), null, 2));
  console.log('Metadata:', JSON.stringify(signalCollector.getMetadata(), null, 2));
};
```

---

## 10. Event Schema

### Game Lifecycle Events (automatic — PART-010)

| Event | Target | When Fired |
|-------|--------|------------|
| `game_start` | `game` | `setupGame()` and `restartGame()` |
| `game_end` | `game` | `endGame()` fires |
| `game_paused` | `system` | VisibilityTracker onInactive |
| `game_resumed` | `system` | VisibilityTracker onResume |

### Game-Specific Events

| Event | Target | When Fired | Data |
|-------|--------|------------|------|
| `question_shown` | `game` | `loadRound()` | `{ round, numberA, numberB, correctAnswer }` |
| `adjustment_made` | `adjuster-a` or `adjuster-b` | `adjustNumber()` | `{ delta, adjusted, direction }` |
| `life_lost` | `game` | Wrong answer in `checkAnswer()` | `{ lives, round }` |
| `level_complete` | `game` | `roundComplete()` at level boundary | `{ level }` |
| `input_change` | `answer-input` | `onInputChange()` | `{ value }` |
| `tap` | `btn-reset` | `resetAdjustments()` | `{}` |

---

## 11. Scaffold Points

| Point | Function | When | What Can Be Injected |
|-------|----------|------|---------------------|
| `after_incorrect` | `checkAnswer()` | Wrong answer | Hint: "Try rounding numberA to nearest 10" |
| `before_round` | `loadRound()` | New round starts | Strategy tip for this specific combination |
| `on_level_transition` | `showLevelTransition()` | Level boundary reached | Encouragement, difficulty preview |

---

## 12. Feedback Triggers

| Moment | Trigger Function | Feedback Type | Notes |
|--------|-----------------|---------------|-------|
| Correct answer | `checkAnswer()` | `correct_tap` + subtitle | `getCorrectPhrase()` varied text; NO color change |
| Incorrect answer | `checkAnswer()` | `wrong_tap` + subtitle | "Not quite! Try again."; NO color change |
| Game complete (victory) | `endGame('complete')` | TTS `playDynamicFeedback` + victory transition | Reports accuracy % |
| Game over | `endGame('game_over')` | Game-over transition | No audio |

### Sound URLs (exact — preloaded in DOMContentLoaded)

```javascript
{ id: 'correct_tap', url: 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740724945201.mp3' }
{ id: 'wrong_tap',   url: 'https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1740725080819.mp3' }
```

**CRITICAL: Use `FeedbackManager.sound.preload([...])` — NOT `sound.register()` (does not exist).**

**NO background color change on correct or incorrect answer — audio-only feedback.**

---

## 13. Visual Specifications

- **Layout:** Vertical flex stack inside max-width 480px wrapper. Adjusters row: horizontal flex, two `.number-adjuster` columns (80px wide each) with `.plus-sign` (28px) between. No grid, no drag-drop.
- **Number box:** 80×60px, border-radius 10px, 28px bold, white background, `#ddd` border. Displays original number only — never changes.
- **Adj buttons:** 80×36px, border-radius 8px. Minus: `#FFF5F5` bg, `#F5D5D5` border, `#c0392b` text. Plus: `#F5FFF5` bg, `#D5F0D5` border, `#219653` text.
- **Adj labels (when delta != 0):** Same dimensions and colors as buttons but non-interactive. Show adjusted value with directional arrow icon.
- **Delta badge:** Position absolute top-right of number-box-wrap. Height 20px, min-width 26px, border-radius 10px, 11px bold. Positive: `#D5F0D5` bg, `#219653` text. Negative: `#FFD9D9` bg, `#c0392b` text. Hidden when delta=0.
- **Answer input:** 80×52px, border-radius 10px, 22px bold, `?` placeholder, `#E0E0E0` border. Focus: `#E8D98A` border + yellow glow. Spinner arrows removed.
- **Check button:** `#2563eb` bg, pill border-radius 24px, 16px bold white. Hidden until input has value.
- **Reset button:** Top-right of play area, ghost style (transparent bg, `#ccc` border, 20px radius, 13px gray text).
- **NO color change on correct/incorrect** — only audio feedback.
- **Level label:** `#270F63`, 14px, 600 weight, centered.
- **Results screen:** White card, centered, star display (emoji ⭐/☆), metrics table, "Play Again" blue button.
- **Transitions:** CSS transitions 0.2s ease on buttons and borders.
- **Responsive:** 480px max-width, 100dvh height, mobile-first.

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop (PART-037) to generate `tests/game.spec.js`. Every action uses real selectors. Every assertion is exact.

### Scenario: Complete game with all correct answers (fallback content)

```
SETUP: Page loaded, game ready (waitForGameReady returns true)
ACTIONS:
  wait for transition screen to show (start screen)
  click button with text "Let's go!"   (starts game via startGame())
  wait for #game-screen to be visible
  -- Round 0: numberA=47, numberB=33, correctAnswer=80 --
  fill #answer-input with "80"
  wait for #btn-check to not have class "hidden"
  click #btn-check
  wait 2500ms
  -- Round 1: numberA=28, numberB=14, correctAnswer=42 --
  fill #answer-input with "42"
  click #btn-check
  wait 2500ms
  -- Round 2: numberA=56, numberB=25, correctAnswer=81 --
  fill #answer-input with "81"
  click #btn-check
  wait 2500ms
  wait 2500ms (level 2 transition auto-hides after 2000ms)
  -- Round 3: numberA=36, numberB=84, correctAnswer=120 --
  fill #answer-input with "120"
  click #btn-check
  wait 2500ms
  -- Round 4: numberA=67, numberB=45, correctAnswer=112 --
  fill #answer-input with "112"
  click #btn-check
  wait 2500ms
  -- Round 5: numberA=49, numberB=73, correctAnswer=122 --
  fill #answer-input with "122"
  click #btn-check
  wait 2500ms
  wait 2500ms (level 3 transition auto-hides)
  -- Round 6: numberA=78, numberB=56, correctAnswer=134 --
  fill #answer-input with "134"
  click #btn-check
  wait 2500ms
  -- Round 7: numberA=83, numberB=69, correctAnswer=152 --
  fill #answer-input with "152"
  click #btn-check
  wait 2500ms
  -- Round 8: numberA=95, numberB=47, correctAnswer=142 --
  fill #answer-input with "142"
  click #btn-check
  wait 4000ms (TTS + victory transition)
ASSERT:
  gameState.score == 9
  gameState.lives == 3
  gameState.isActive == false
  #results-screen is visible
  #game-screen is hidden
  #result-score text == "100%"
  #stars-display contains 3 stars
```

### Scenario: Submit incorrect answer — life lost, retry same round

```
SETUP: Page loaded, start screen shown
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
  fill #answer-input with "999"
  click #btn-check
  wait 2500ms
ASSERT:
  gameState.lives == 2
  gameState.currentRound == 0   (still on round 0)
  gameState.attempts.length == 1
  gameState.attempts[0].correct == false
  gameState.attempts[0].input_of_user == 999
  #answer-input value == ""     (cleared for retry)
  #answer-input disabled == false  (re-enabled for retry)
  gameState.isProcessing == false
```

### Scenario: Lose all 3 lives — game over

```
SETUP: Page loaded, start screen shown
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
  fill #answer-input with "999"
  click #btn-check
  wait 2500ms
  fill #answer-input with "999"
  click #btn-check
  wait 2500ms
  fill #answer-input with "999"
  click #btn-check
  wait 2500ms
ASSERT:
  gameState.lives == 0
  gameState.isActive == false
  #results-screen is visible
  #results-title text == "Game Over!"
  #stars-display contains 0 stars (3 empty stars)
  game_complete postMessage was sent
  postMessage data.metrics.stars == 0
```

### Scenario: Adjust numbers then submit — answer must still be original sum

```
SETUP: Page loaded, start screen shown
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
  -- Round 0: 47+33=80; adjust A up by 3 to make 50 --
  click button.adj-btn.adj-plus inside #adjuster-a   (first click)
  click button.adj-btn.adj-plus inside #adjuster-a   (second click)
  click button.adj-btn.adj-plus inside #adjuster-a   (third click)
ASSERT (mid-scenario):
  gameState.deltaA == 3
  #delta-badge-a textContent == "+3"
  #delta-badge-a does NOT have class "hidden"
  #delta-badge-a has class "positive"
  #adj-bottom-a contains element with class "adj-label-plus" (not a button)
  #adj-top-a contains button with class "adj-minus" (still a button)
ACTIONS (continued):
  fill #answer-input with "80"   (original sum — NOT 83 = 50+33)
  click #btn-check
  wait 2500ms
ASSERT:
  gameState.score == 1
  gameState.attempts[0].correct == true
  gameState.attempts[0].input_of_user == 80
  gameState.attempts[0].metadata.correctAnswer == 80
```

### Scenario: Reset clears adjustments

```
SETUP: Page loaded, start screen shown, game started
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
  click button.adj-btn.adj-plus inside #adjuster-a
  click button.adj-btn.adj-plus inside #adjuster-a
  click button.adj-btn.adj-minus inside #adjuster-b
ASSERT (mid-scenario):
  gameState.deltaA == 2
  gameState.deltaB == -1
ACTIONS (continued):
  click #btn-reset
ASSERT:
  gameState.deltaA == 0
  gameState.deltaB == 0
  #delta-badge-a has class "hidden"
  #delta-badge-b has class "hidden"
  #adj-top-a contains button.adj-minus (delta=0, shows minus button in top)
  #adj-bottom-a contains button.adj-plus (delta=0, shows plus button in bottom)
  #adj-top-b contains button.adj-minus
  #adj-bottom-b contains button.adj-plus
```

### Scenario: Check button hidden until input has value

```
SETUP: Page loaded, start screen shown
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
ASSERT:
  #btn-check has class "hidden"
ACTIONS:
  fill #answer-input with "8"
ASSERT:
  #btn-check does NOT have class "hidden"
ACTIONS:
  clear #answer-input (fill with "")
ASSERT:
  #btn-check has class "hidden"
```

### Scenario: Level 2 transition fires after round 3

```
SETUP: Page loaded, start screen shown
ACTIONS:
  click button with text "Let's go!"
  wait for #game-screen to be visible
  fill #answer-input with "80"; click #btn-check; wait 2500ms
  fill #answer-input with "42"; click #btn-check; wait 2500ms
  fill #answer-input with "81"; click #btn-check; wait 2500ms
ASSERT (immediately after round 2 correct):
  #game-screen style.display == "none"  (hidden while transition shows)
  gameState.level == 2
  gameState.currentRound == 3
ASSERT (after 2500ms):
  #game-screen is visible again
  #number-a-display text == "36"  (round 3: numberA=36)
  #number-b-display text == "84"
```

### Scenario: Metrics shape in game_complete postMessage

```
SETUP: Complete all 9 rounds correctly (see Scenario 1)
ASSERT (on game_complete postMessage):
  data.metrics.accuracy == 100
  data.metrics.stars is integer between 0 and 3
  data.metrics.time > 0
  data.attempts is array with length 9
  data.events is array
  each attempt has fields: attempt_timestamp, time_since_start_of_game, input_of_user, attempt_number, correct, metadata
  each attempt.metadata has: round, question, correctAnswer, validationType
  each attempt.metadata.validationType == "fixed"
```

### Scenario: Sentry integration fully configured (PART-030)

```
SETUP: Page loaded, game ready
ACTIONS:
  (none — check on load)
ASSERT (via verifySentryIntegration helper):
  SentryConfig package loaded (window.SentryConfig !== undefined)
  Sentry SDK loaded (window.Sentry !== undefined)
  initSentry() function defined
  Sentry initialized (verifySentry().initialized === true)
  DSN present (verifySentry().dsn is truthy)
  Script order: SentryConfig → SDK → game packages
  No integrity attribute on SDK scripts
  All 3 SDK scripts loaded (bundle.tracing.replay.feedback, captureconsole, browserprofiling)
  verifySentry() debug function exists
  testSentry() debug function exists
```

### Scenario: No Sentry console errors on load (PART-030)

```
SETUP: Collect console errors from page load
ACTIONS:
  Load page, wait for game ready
ASSERT:
  No "Sentry initialization failed" in console errors
  No "SentryConfig is not defined" in console errors
  No "Sentry is not defined" in console errors
```

### Scenario: Global Sentry error handlers registered (PART-030)

```
SETUP: Page loaded
ACTIONS:
  Trigger a test error via page.evaluate(() => window.testSentry())
ASSERT:
  testSentry() executes without throwing
  Console shows "Test error sent to Sentry"
```

---

## 15. Verification Checklist

### Structural
- [ ] `<!DOCTYPE html>` present
- [ ] `<meta charset="UTF-8">` present
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0">` present
- [ ] SentryConfig script loaded FIRST, before Sentry SDK scripts (PART-030)
- [ ] Sentry SDK v10.23.0 — all 3 scripts: bundle.tracing.replay.feedback, captureconsole, browserprofiling (PART-030)
- [ ] No `integrity` attribute on Sentry SDK scripts (PART-030)
- [ ] Game packages in correct order after Sentry: FeedbackManager → Components → Helpers (PART-002)
- [ ] All 3 package script URLs use exact `storage.googleapis.com/test-dynamic-assets/...` paths
- [ ] No invented or hallucinated CDN URLs (PART-026 #0)
- [ ] Single `<style>` block in `<head>` (RULE-007)
- [ ] Single `<script>` block in `<body>` with no `src` attribute (RULE-007)
- [ ] `<div id="app"></div>` exists in `<body>` (for ScreenLayout.inject)
- [ ] `<template id="game-template">` exists in `<body>`
- [ ] `#game-screen` inside template, `style="display:none;"` initially
- [ ] `#results-screen` inside template, `style="display:none;"` initially
- [ ] `#timer-container` inside `#game-screen`
- [ ] `#adjusters-row` with `#adjuster-a` and `#adjuster-b` inside `#game-screen`
- [ ] `#adj-top-a`, `#adj-bottom-a` inside `#adjuster-a`
- [ ] `#adj-top-b`, `#adj-bottom-b` inside `#adjuster-b`
- [ ] `#number-box-a` with `#number-a-display` inside `#adjuster-a`
- [ ] `#number-box-b` with `#number-b-display` inside `#adjuster-b`
- [ ] `#delta-badge-a` and `#delta-badge-b` exist, have class `hidden` initially
- [ ] `#answer-input` type="number" inside `#game-screen`
- [ ] `#btn-check` inside `#game-screen`, has class `hidden` initially
- [ ] `#btn-reset` inside `#game-screen`

### Functional
- [ ] `waitForPackages()` checks all four: FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector (PART-003)
- [ ] `waitForPackages()` has 10s timeout and shows fallback UI on failure (PART-003)
- [ ] DOMContentLoaded calls in order: waitForPackages → FeedbackManager.init → sound.preload → SignalCollector → ScreenLayout.inject → clone template → TimerComponent → ProgressBarComponent → TransitionScreenComponent → VisibilityTracker → postMessage listener → setupGame (PART-004)
- [ ] `ScreenLayout.inject()` called BEFORE creating ProgressBar and TransitionScreen (PART-025)
- [ ] Template cloned into `#gameContent` after inject (PART-025)
- [ ] `setupGame()` sets `gameState.startTime`, `isActive`, `currentRound`, `score`, `attempts`, `events`, `duration_data.startTime` (PART-004)
- [ ] `setupGame()` does NOT call `timer.start()` — `startGame()` does it after transition button click
- [ ] `startGame()` calls `timer.start()` (PART-006)
- [ ] `handlePostMessage()` in global scope, handles `game_init`, calls `setupGame()` (PART-008)
- [ ] Fallback content (9 rounds) set in `setupGame()` when `!gameState.content` (PART-008)
- [ ] `recordAttempt()` in global scope, produces correct attempt shape (PART-009)
- [ ] `trackEvent()` in global scope, pushes to `gameState.events` (PART-010)
- [ ] `signalCollector.startProblem()` called at each `loadRound()` (PART-010)
- [ ] Deferred `endProblem` pattern used via `gameState.pendingEndProblem` (PART-010)
- [ ] `signalCollector.recordViewEvent()` called in: `loadRound`, `adjustNumber`, `checkAnswer`, `showLevelTransition` (PART-010)
- [ ] `data-signal-id` attributes on `#number-box-a`, `#number-box-b`, `#answer-input`, `#btn-check` (PART-010)
- [ ] `endGame()` guards against double-call with `if (!gameState.isActive) return` (PART-011)
- [ ] `endGame()` flushes `pendingEndProblem` before `signalCollector.seal()` (PART-011)
- [ ] `endGame()` calls `showResults(metrics, reason)` (PART-019)
- [ ] `endGame()` sends `game_complete` postMessage with metrics, attempts, events, signals, metadata, completedAt (PART-008, PART-011)
- [ ] Star calculation is time-based: <15s avg/level=3★, <25s=2★, ≥25s=1★, game_over=0★ (custom PART-011)
- [ ] `showResults()` populates: result-score, result-time, result-correct, stars-display, result-level, result-lives, results-title (PART-019)
- [ ] All 6 debug functions on `window`: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals (PART-012)
- [ ] `testPause()` uses `visibilityTracker.triggerInactive()` (PART-012)
- [ ] `testResume()` uses `visibilityTracker.triggerResume()` (PART-012)
- [ ] `progressBar.update()` called with rounds COMPLETED (0 at start, not current round index 1) (PART-023)
- [ ] `progressBar.destroy()` called in `endGame()` cleanup (PART-023)
- [ ] Start transition: `transitionScreen.show({...buttons:[{text:"Let's go!", action:startGame}]})` (PART-024)
- [ ] Level transitions: `duration: 2000` ONLY — no `buttons` combined with `duration` (PART-024)
- [ ] Victory transition: `stars:` field + `buttons` with `claimStars()` (PART-024)
- [ ] Game-over transition: `icons: ['😔']` + `buttons` with `restartGame()` (PART-024)
- [ ] `restartGame()` recreates SignalCollector, TimerComponent, ProgressBarComponent, VisibilityTracker (PART-011)
- [ ] All game HTML inside `#gameContent` — no game elements as sibling of `#app` (PART-025, PART-026 #13)
- [ ] No static game HTML directly in `<body>` or inside `#app` (PART-025)
- [ ] `initSentry()` defined and called on load (PART-030)
- [ ] Sentry SDK scripts loaded in correct order (PART-030)

### Game-Specific
<<<<<<< Updated upstream
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
- [ ] Stars: avg time per level <15s = 3★, <25s = 2★, ≥25s = 1★, game-over = 0★ — **CRITICAL: if reason === 'game_over', stars MUST be 0 regardless of levelTimes. Never apply the time formula when reason !== 'victory'.**
- [ ] Level time tracked from startLevel() to level completion
- [ ] isProcessing prevents interaction during feedback
- [ ] All fallback sums verified correct
- [ ] `window.gameState`, restartGame recreates components
- [ ] Transition screens use buttons
=======
- [ ] `adjustNumber(which, direction)` increments/decrements `deltaA`/`deltaB` by exactly 1
- [ ] `updateAdjusterUI(which)` re-renders adj-top and adj-bottom based on current delta
- [ ] When delta=0: adj-top has `button.adj-minus`, adj-bottom has `button.adj-plus`, no badge
- [ ] When delta<0: adj-top has `.adj-label.adj-label-minus` (adjusted value), adj-bottom has `button.adj-plus`, badge is red negative
- [ ] When delta>0: adj-top has `button.adj-minus`, adj-bottom has `.adj-label.adj-label-plus` (adjusted value), badge is green positive
- [ ] Number box `#number-a-display` / `#number-b-display` always shows original number (never changes with delta)
- [ ] Answer validation: `parseInt(input) === gameState.correctAnswer` (original sum, NOT adjusted values)
- [ ] Correct answer: no color change on number boxes or input (audio-only feedback) — CRITICAL
- [ ] Wrong answer: no color change on number boxes or input (audio-only feedback) — CRITICAL
- [ ] Wrong answer: lives decrement, progress bar updates, input cleared (`value='', disabled=false`), retry same round
- [ ] `#btn-check` shows only when input is non-empty; hidden initially and after each load
- [ ] 9 rounds across 3 levels (rounds 0-2 = level 1, 3-5 = level 2, 6-8 = level 3)
- [ ] Level transitions at `currentRound === 3` and `currentRound === 6` (after incrementing in roundComplete)
- [ ] `gameState.levelTimes` records 3 entries (one per level) in ms
- [ ] `gameState.levelStartTime` reset in `startGame()` and in `setTimeout` inside `showLevelTransition()`

### Design & Layout
- [ ] CSS uses `var(--mathai-*)` variables for brand colors (PART-020)
- [ ] `adj-minus` button: `#FFF5F5` bg, `#F5D5D5` border, `#c0392b` color
- [ ] `adj-plus` button: `#F5FFF5` bg, `#D5F0D5` border, `#219653` color
- [ ] Delta badge: `.positive` = green; `.negative` = red; `.hidden` when delta=0
- [ ] Answer input: 80×52px, 22px bold, focus border `#E8D98A` with glow
- [ ] Check button: `#2563eb` bg, 24px border-radius pill
- [ ] Number box: 80×60px, 28px bold
- [ ] Reset button: ghost style, top-right of game screen
- [ ] ScreenLayout provides max-width 480px wrapper (PART-021/025)
- [ ] Uses `100dvh` not `100vh` (PART-021)
- [ ] Progress bar slot: `position: absolute; top: 0` (PART-021)
- [ ] Timer inside `#timer-container` (PART-006)
- [ ] Count-up timer with `endTime: 100000` (PART-006 rule)

### Rules Compliance
- [ ] RULE-001: All HTML onclick handlers (`adjustNumber`, `onInputChange`, `checkAnswer`, `resetAdjustments`, `restartGame`, `claimStars`) in global scope
- [ ] RULE-002: All functions using `await` have `async` keyword (`checkAnswer`, `endGame`, `waitForPackages`, DOMContentLoaded handler, `testAudio`)
- [ ] RULE-003: All async calls wrapped in try/catch (`FeedbackManager.init`, `sound.preload`, `sound.play`, `playDynamicFeedback`)
- [ ] RULE-004: All logging uses `JSON.stringify` — no raw objects in `console.log`/`console.error`
- [ ] RULE-005: `endGame()` destroys timer, visibilityTracker, progressBar; calls `sound.stopAll()` and `stream.stopAll()`
- [ ] RULE-006: No `new Audio()`, no `setInterval` for timing, no `SubtitleComponent.show()`, no `sound.register()`
- [ ] RULE-007: Single file — no external CSS links, no external JS files (except PART-002 CDN packages)

### Anti-Pattern Checks (PART-026)
- [ ] No hallucinated script URLs — only `storage.googleapis.com/test-dynamic-assets/...` and `browser.sentry-cdn.com/10.23.0/...`
- [ ] No `sound.register()` — uses `sound.preload([{id, url}])`
- [ ] No `SubtitleComponent.show()` — uses subtitle prop in `sound.play()`
- [ ] No `setInterval`/`setTimeout` for timing except the 2000ms level-transition delay
- [ ] VisibilityTracker `onInactive` uses `sound.pause()` NOT `sound.stopAll()` (PART-026 #19)
- [ ] VisibilityTracker timer calls pass `{ fromVisibilityTracker: true }` (PART-026)
- [ ] `gameState` declared as `window.gameState = {...}` NOT `const gameState = {...}` (PART-026)
- [ ] Count-up timer uses `endTime: 100000` (PART-026 / PART-006 rule)
- [ ] No inline stub/polyfill for CDN packages (PART-026 #20)
- [ ] `progressBar.update()` first param is rounds COMPLETED (PART-026 #16)
- [ ] Level transition uses `duration` only, no `duration + buttons` mix (PART-026 / PART-024)
- [ ] `restartGame()` recreates timer and visibilityTracker (PART-026 / PART-011)
>>>>>>> Stashed changes

### Contract Compliance
- [ ] `gameState` matches `contracts/game-state.schema.json`
- [ ] `gameState.duration_data` matches `contracts/duration-data.schema.json`
- [ ] Each attempt matches `contracts/attempt.schema.json`
- [ ] Metrics object matches `contracts/metrics.schema.json`
- [ ] Outgoing postMessage matches `contracts/postmessage-out.schema.json`
- [ ] `handlePostMessage` handles `contracts/postmessage-in.schema.json` shape

---

*End of spec — Adjustment Strategy*
