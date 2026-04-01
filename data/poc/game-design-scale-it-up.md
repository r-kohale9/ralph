# Game-Specific Template: Scale It Up

> **Assembly Book** -- An LLM reading ONLY this file should produce a working HTML file.

---

## 1. Game Identity

- **Title:** Scale It Up
- **Game ID:** scale-it-up
- **Type:** standard
- **Description:** See a real-world ratio, then predict what happens when quantities change -- fill in the missing number (Type A) or judge whether a changed ratio still works (Type B). 10 rounds, 3 stages, 3 lives.

### Target Skills (ratio-intuition-grade5)

| Skill | Description | Round Type |
|-------|-------------|------------|
| 3 | Predict that scaling both preserves the outcome | Type A -- fill in the blank |
| 4 | Predict that changing only one side breaks the outcome | Type B -- "Will it work?" yes/no |
| 5 | Apply the "for every" rule at a new size | Type A -- fill in the blank |

### Core Mechanic -- Two Round Types

**Type A: "Fill the blank" (Skills 3 & 5)**
1. Kid sees a scene with a stated ratio: "Mom's chai: for every 2 spoons tea, 1 spoon sugar"
2. A scaled-up scenario appears with ONE missing value: "Bigger pot: 6 spoons tea, ___ spoons sugar?"
3. Kid types the missing number (integer 1-36)
4. Correct = kept the ratio. Feedback explains why.

**Additive trap variant** (Skill 5): The "obvious wrong" answer is the additive one. E.g., "2 tea : 1 sugar -> 6 tea : ?" -- the additive mistake is 5 (added 4 to both) but correct is 3 (x3).

**Type B: "Will it work?" (Skill 4)**
1. Kid sees a scene with a stated ratio: "Sky-blue paint: for every 1 white, 3 blue"
2. Someone makes a change -- only one side changes: "Ava uses 1 white and 5 blue"
3. Kid taps: "Same outcome" or "Different outcome"
4. If "Different": kid explains what changed -- picks from 2 options (e.g., "too much blue" vs "not enough white")
5. Feedback confirms: changing one side without scaling the other breaks the outcome.

### Progression & Difficulty

| Dimension | Stage 1 (Rounds 1-3) | Stage 2 (Rounds 4-7) | Stage 3 (Rounds 8-10) |
|-----------|---------|---------|---------|
| Multiplier | x2, x3 | x3, x4 | x2-x4 |
| Ratio complexity | a:1 or 1:b | a:b (no 1) | any 1-9 |
| Round types | A only | A + B | A + B |
| Trap sophistication | None | Additive traps | Subtle proportional traps |

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | -- |
| PART-002 | Package Scripts | YES | -- |
| PART-003 | waitForPackages | YES | -- |
| PART-004 | Initialization Block | YES | -- |
| PART-005 | VisibilityTracker | YES | popupProps: default |
| PART-006 | TimerComponent | NO | No timer |
| PART-007 | Game State Object | YES | Custom fields: lives, roundType, baseRatio, multiplier, scaledValues |
| PART-008 | PostMessage Protocol | YES | -- |
| PART-009 | Attempt Tracking | YES | -- |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: type_a_answer, type_b_judgment, type_b_reason, round_complete, life_lost |
| PART-011 | End Game & Metrics | YES | Star logic: 9-10->3 stars, 6-8->2 stars, 1-5->1 star |
| PART-012 | Debug Functions | YES | -- |
| PART-014 | Validation Function | YES | Type A: number match. Type B: same/different check + reason |
| PART-017 | Feedback Integration | YES | Audio: correct_tap, wrong_tap. Stickers: correct/incorrect GIFs, trophy Lottie. Dynamic TTS for explanations. |
| PART-019 | Results Screen UI | YES | Metrics: score, lives, accuracy |
| PART-020 | CSS Variables & Colors | YES | -- |
| PART-021 | Screen Layout CSS | YES | -- |
| PART-022 | Game Buttons | YES | Same Outcome/Different Outcome + Submit (Type A) |
| PART-023 | ProgressBar Component | YES | totalRounds: 10, totalLives: 3 |
| PART-024 | TransitionScreen Component | YES | Screens: start, stage-transition, victory, game-over |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | -- |
| PART-027 | Play Area Construction | YES | Layout: ratio card + scaled scenario + input/buttons |
| PART-028 | InputSchema Patterns | YES | -- |
| PART-030 | Sentry Error Tracking | YES | -- |
| PART-033 | Interaction Patterns | YES | Patterns: number-input (Type A), buttons (Type B judgment + reason) |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | -- |
| PART-035 | Test Plan Generation | YES (POST_GEN) | -- |
| PART-037 | Playwright Testing | YES (POST_GEN) | -- |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'scale-it-up',
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,
  phase: 'start',  // start | playing-typeA | playing-typeB-judge | playing-typeB-reason | feedback | transition | results | gameover
  isProcessing: false,
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
  currentStage: 1,
  roundData: null,          // Current round's content object
};

let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
```

---

## 4. Input Schema

### Schema Definition

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "minItems": 10,
      "maxItems": 10,
      "items": {
        "type": "object",
        "properties": {
          "roundType": {
            "type": "string",
            "enum": ["typeA", "typeB"],
            "description": "Type A = fill-in-blank (Skills 3,5), Type B = will-it-work yes/no (Skill 4)"
          },
          "stage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3
          },
          "context": {
            "type": "object",
            "properties": {
              "scenario": { "type": "string", "description": "Real-world scenario description (e.g., 'Mom's chai recipe')" },
              "item1Name": { "type": "string", "description": "Name of first quantity (e.g., 'spoons of tea')" },
              "item2Name": { "type": "string", "description": "Name of second quantity (e.g., 'spoons of sugar')" }
            },
            "required": ["scenario", "item1Name", "item2Name"]
          },
          "baseRatio": {
            "type": "object",
            "properties": {
              "a": { "type": "integer", "minimum": 1, "maximum": 9 },
              "b": { "type": "integer", "minimum": 1, "maximum": 9 }
            },
            "required": ["a", "b"],
            "description": "The original ratio: 'For every A [item1], B [item2]'"
          },
          "multiplier": {
            "type": "integer",
            "minimum": 2,
            "maximum": 4,
            "description": "The scaling factor applied"
          },
          "scaledValues": {
            "type": "object",
            "properties": {
              "a": { "type": "integer", "description": "Scaled first value (shown to student)" },
              "b": { "type": "integer", "description": "Scaled second value (shown or blank)" }
            },
            "required": ["a", "b"],
            "description": "Type A: one value shown + one blank. Type B: both shown (may be non-proportional)"
          },
          "blankField": {
            "type": "string",
            "enum": ["a", "b"],
            "description": "Type A only: which field is blank (the student fills this in)"
          },
          "correctAnswer": {
            "type": "integer",
            "description": "Type A: the correct number for the blank. Type B: not used."
          },
          "isProportional": {
            "type": "boolean",
            "description": "Type B only: whether the scaled values maintain the ratio (same outcome = true)"
          },
          "breakReason": {
            "type": "string",
            "description": "Type B only (when isProportional=false): why the ratio broke"
          },
          "reasonOptions": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 2,
            "maxItems": 2,
            "description": "Type B only (when isProportional=false): two reason choices for the student"
          },
          "correctReasonIndex": {
            "type": "integer",
            "minimum": 0,
            "maximum": 1,
            "description": "Type B only: index of correct reason in reasonOptions"
          },
          "feedbackCorrect": { "type": "string" },
          "feedbackWrong": { "type": "string" }
        },
        "required": ["roundType", "stage", "context", "baseRatio", "multiplier", "scaledValues", "feedbackCorrect", "feedbackWrong"]
      }
    }
  },
  "required": ["rounds"]
}
```

---

## 5. Fallback Content

```json
{
  "rounds": [
    {
      "roundType": "typeA",
      "stage": 1,
      "context": {
        "scenario": "Snack time! For every batch of cookies, you need some glasses of milk.",
        "item1Name": "cookies",
        "item2Name": "glasses of milk"
      },
      "baseRatio": { "a": 2, "b": 1 },
      "multiplier": 2,
      "scaledValues": { "a": 4, "b": 2 },
      "blankField": "b",
      "correctAnswer": 2,
      "feedbackCorrect": "That's right! 2 cookies : 1 milk. x2 means 4 cookies : 2 milk. You multiplied both sides by 2!",
      "feedbackWrong": "Not quite. The ratio is 2 cookies for every 1 milk. If cookies doubled to 4, milk must double too: 1 x 2 = 2."
    },
    {
      "roundType": "typeA",
      "stage": 1,
      "context": {
        "scenario": "Planting flowers! For every row, you plant some seeds.",
        "item1Name": "rows",
        "item2Name": "seeds"
      },
      "baseRatio": { "a": 1, "b": 3 },
      "multiplier": 3,
      "scaledValues": { "a": 3, "b": 9 },
      "blankField": "b",
      "correctAnswer": 9,
      "feedbackCorrect": "Yes! 1 row : 3 seeds. x3 means 3 rows : 9 seeds. Every row still gets 3 seeds!",
      "feedbackWrong": "Remember, 1 row needs 3 seeds. With 3 rows, you need 3 x 3 = 9 seeds, not 6. Multiply, don't add!"
    },
    {
      "roundType": "typeA",
      "stage": 1,
      "context": {
        "scenario": "Building a tower! For every layer, you use some blocks.",
        "item1Name": "layers",
        "item2Name": "blocks"
      },
      "baseRatio": { "a": 1, "b": 4 },
      "multiplier": 2,
      "scaledValues": { "a": 2, "b": 8 },
      "blankField": "b",
      "correctAnswer": 8,
      "feedbackCorrect": "Correct! 1 layer : 4 blocks. x2 means 2 layers : 8 blocks. Each layer still uses 4 blocks!",
      "feedbackWrong": "Think again. 1 layer uses 4 blocks. For 2 layers, multiply: 4 x 2 = 8 blocks, not 5 or 6."
    },
    {
      "roundType": "typeA",
      "stage": 2,
      "context": {
        "scenario": "Mom's special recipe: for every few spoons of flour, add some spoons of sugar.",
        "item1Name": "spoons of flour",
        "item2Name": "spoons of sugar"
      },
      "baseRatio": { "a": 2, "b": 3 },
      "multiplier": 3,
      "scaledValues": { "a": 6, "b": 9 },
      "blankField": "b",
      "correctAnswer": 9,
      "feedbackCorrect": "Right! 2 flour : 3 sugar. x3 gives 6 flour : 9 sugar. Both sides tripled!",
      "feedbackWrong": "Careful! 2 flour : 3 sugar. If flour went from 2 to 6 (x3), sugar must also x3: 3 x 3 = 9, not 7."
    },
    {
      "roundType": "typeB",
      "stage": 2,
      "context": {
        "scenario": "Mixing paint: for every scoop of white, add some scoops of blue to get sky-blue.",
        "item1Name": "scoops of white",
        "item2Name": "scoops of blue"
      },
      "baseRatio": { "a": 1, "b": 3 },
      "multiplier": 3,
      "scaledValues": { "a": 3, "b": 5 },
      "isProportional": false,
      "breakReason": "Blue was not scaled properly -- should be 9 but only 5 were used.",
      "reasonOptions": [
        "Too little blue paint -- should be 9 scoops",
        "Too much white paint -- should be 1 scoop"
      ],
      "correctReasonIndex": 0,
      "feedbackCorrect": "Good eye! 1 white : 3 blue. With 3 white, you need 3 x 3 = 9 blue, not 5. The colour would be wrong!",
      "feedbackWrong": "Look closely. White went from 1 to 3 (x3). Blue should also x3: 3 x 3 = 9. But only 5 blue were used -- that's not enough!"
    },
    {
      "roundType": "typeA",
      "stage": 2,
      "context": {
        "scenario": "Making friendship bracelets: for every few red beads, add some yellow beads.",
        "item1Name": "red beads",
        "item2Name": "yellow beads"
      },
      "baseRatio": { "a": 3, "b": 4 },
      "multiplier": 3,
      "scaledValues": { "a": 9, "b": 12 },
      "blankField": "a",
      "correctAnswer": 9,
      "feedbackCorrect": "Yes! 3 red : 4 yellow. x3 means 9 red : 12 yellow. The pattern stays the same!",
      "feedbackWrong": "Think about it: 4 yellow became 12 yellow (x3). So red must also x3: 3 x 3 = 9 red, not 7."
    },
    {
      "roundType": "typeB",
      "stage": 2,
      "context": {
        "scenario": "Making trail mix: for every cup of nuts, add some cups of raisins.",
        "item1Name": "cups of nuts",
        "item2Name": "cups of raisins"
      },
      "baseRatio": { "a": 2, "b": 3 },
      "multiplier": 4,
      "scaledValues": { "a": 8, "b": 7 },
      "isProportional": false,
      "breakReason": "Raisins were increased additively (+4) instead of multiplicatively (x4).",
      "reasonOptions": [
        "Raisins should be 12, not 7 -- they added 4 instead of multiplying by 4",
        "Nuts should be 6, not 8 -- they used too many nuts"
      ],
      "correctReasonIndex": 0,
      "feedbackCorrect": "Exactly! 2 nuts : 3 raisins. Nuts x4 = 8. Raisins should also x4: 3 x 4 = 12, not 3 + 4 = 7. That's the additive trap!",
      "feedbackWrong": "Look at nuts: 2 x 4 = 8. Now raisins should also x4: 3 x 4 = 12. But 7 was used -- someone added 4 instead of multiplying. The mix would taste different!"
    },
    {
      "roundType": "typeA",
      "stage": 3,
      "context": {
        "scenario": "Planning a garden: for every row of tomatoes, plant some rows of basil.",
        "item1Name": "rows of tomatoes",
        "item2Name": "rows of basil"
      },
      "baseRatio": { "a": 3, "b": 2 },
      "multiplier": 4,
      "scaledValues": { "a": 12, "b": 8 },
      "blankField": "b",
      "correctAnswer": 8,
      "feedbackCorrect": "Right! 3 tomato rows : 2 basil rows. x4 gives 12 tomato : 8 basil. The companion planting ratio holds!",
      "feedbackWrong": "3 tomato : 2 basil. Tomatoes went to 12 (x4). Basil must also x4: 2 x 4 = 8, not 6. Multiply, don't add!"
    },
    {
      "roundType": "typeB",
      "stage": 3,
      "context": {
        "scenario": "Lemonade stand: for every cup of lemon juice, add some cups of water.",
        "item1Name": "cups of lemon juice",
        "item2Name": "cups of water"
      },
      "baseRatio": { "a": 2, "b": 5 },
      "multiplier": 3,
      "scaledValues": { "a": 6, "b": 15 },
      "isProportional": true,
      "feedbackCorrect": "Correct! 2 lemon : 5 water. Both x3 gives 6 lemon : 15 water. It'll taste the same -- perfect lemonade!",
      "feedbackWrong": "Check the math: 2 x 3 = 6 lemon, 5 x 3 = 15 water. Both sides multiplied by the same number, so the taste stays the same!"
    },
    {
      "roundType": "typeB",
      "stage": 3,
      "context": {
        "scenario": "Setting up a classroom: for every table, arrange some chairs.",
        "item1Name": "tables",
        "item2Name": "chairs"
      },
      "baseRatio": { "a": 3, "b": 7 },
      "multiplier": 2,
      "scaledValues": { "a": 6, "b": 12 },
      "isProportional": false,
      "breakReason": "Chairs should be 14 (7x2) but only 12 were placed -- 2 chairs short.",
      "reasonOptions": [
        "Not enough chairs -- should be 14, not 12",
        "Too many tables -- should be 5, not 6"
      ],
      "correctReasonIndex": 0,
      "feedbackCorrect": "Sharp! 3 tables : 7 chairs. x2 means 6 tables : 14 chairs. Only 12 chairs means some kids won't have seats!",
      "feedbackWrong": "Tables doubled: 3 x 2 = 6. Chairs should also double: 7 x 2 = 14. But only 12 chairs were set up -- that's 2 short!"
    }
  ]
}
```

---

## 6. Content Generation Guide

| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| Rounds | 10 | 10 | 10 |
| Type A / Type B split | 8A / 2B | 6A / 4B | 5A / 5B |
| Multiplier range | x2 only | x2, x3 | x2, x3, x4 |
| Ratio complexity | Ratios with 1 (a:1, 1:b) | Ratios without 1 (2:3, 3:4) | Any (up to 9:9) |
| Blank field | Always b (second value) | Mix a and b | Mix a and b |
| Type B traps | Simple (one side unchanged) | Additive changes | Both sides change non-proportionally |
| Contexts | Simple (food, animals) | Recipes, crafts | Abstract scenarios, multi-step |

### Constraints

- All base ratio values 1-9, all scaled values must be <= 36 (max 9 x 4)
- Type A: `correctAnswer = baseRatio[blankField] x multiplier`
- Type B proportional: `scaledValues = baseRatio x multiplier` exactly
- Type B non-proportional: at least one side must not match `baseRatio x multiplier`
- `feedbackCorrect` must explain the multiplicative relationship
- `feedbackWrong` must diagnose the likely misconception (additive thinking)
- Each content set should use unique, non-repeating contexts

---

## 7. Screens & HTML Structure

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Context/Scenario -->
    <p class="scenario-text" id="scenario-text"></p>

    <!-- Base Ratio Card -->
    <div class="ratio-card" id="ratio-card">
      <p class="ratio-text">For every <span class="ratio-count" id="base-a"></span> <span id="base-item1"></span>, there are <span class="ratio-count" id="base-b"></span> <span id="base-item2"></span></p>
    </div>

    <!-- Type A: Scaled scenario with blank -->
    <div id="type-a-area" style="display:none;">
      <div class="scaled-card">
        <p class="scaled-text" id="scaled-text-a"></p>
        <div class="input-row">
          <span id="scaled-label"></span>
          <input type="number" id="answer-input" class="ratio-input" min="1" max="36" data-signal-id="answer-input">
          <span id="scaled-unit"></span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-submit-a" data-signal-id="btn-submit" onclick="handleTypeASubmit()">Submit</button>
    </div>

    <!-- Type B: Changed scenario + Same/Different -->
    <div id="type-b-area" style="display:none;">
      <div class="scaled-card">
        <p class="scaled-text" id="scaled-text-b"></p>
      </div>
      <div class="btn-container" id="judgment-buttons">
        <button class="game-btn btn-primary" id="btn-same-outcome" data-signal-id="btn-same" onclick="handleTypeBJudgment(true)">Same outcome</button>
        <button class="game-btn btn-secondary" id="btn-diff-outcome" data-signal-id="btn-different" onclick="handleTypeBJudgment(false)">Different outcome</button>
      </div>
      <!-- Reason selection (shown after "Different" is chosen correctly) -->
      <div id="reason-area" style="display:none;">
        <p class="reason-prompt">Why is it different?</p>
        <button class="game-btn btn-secondary reason-btn" id="reason-0" data-signal-id="reason-0" onclick="handleReasonChoice(0)"></button>
        <button class="game-btn btn-secondary reason-btn" id="reason-1" data-signal-id="reason-1" onclick="handleReasonChoice(1)"></button>
      </div>
    </div>

    <!-- Feedback -->
    <div class="feedback-area" id="feedback-area" style="display:none;">
      <p class="feedback-text" id="feedback-text"></p>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display:none;">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title">Game Complete!</h2>
      <div class="results-metrics">
        <div class="metric-row"><span class="metric-label">Score</span><span class="metric-value" id="result-score">0/10</span></div>
        <div class="metric-row"><span class="metric-label">Lives</span><span class="metric-value" id="result-lives">0</span></div>
        <div class="metric-row"><span class="metric-label">Accuracy</span><span class="metric-value" id="result-accuracy">0%</span></div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="restart-button" onclick="restartGame()">Play Again</button>
    </div>
  </div>
</template>
```

**IMPORTANT (PART-025):** Game HTML must be placed inside `#gameContent`. Use the `<template id="game-template">` element and clone its content into `#gameContent` after `ScreenLayout.inject()` runs during DOMContentLoaded.

---

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - waitForPackages()
   - FeedbackManager.init()
   - Audio preload: correct_tap, wrong_tap (PART-017)
   - SignalCollector created and assigned to window.signalCollector (PART-010)
   - ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })
   - Clone `#game-template` content into `#gameContent`
   - ProgressBar created (totalRounds: 10, totalLives: 3)
   - TransitionScreen created
   - VisibilityTracker created
   - window.addEventListener('message', handlePostMessage)
   - Show start transition screen

2. **Start screen shows:**
   - Title: "Scale It Up"
   - Subtitle: "See a ratio, then predict what happens when quantities change!"
   - Button: "Start!" -> calls startGame()

3. **startGame():**
   - Set gameState.isActive = true, gameState.startTime = Date.now()
   - Load content from gameState.content or fallbackContent
   - gameState.currentRound = 0
   - trackEvent('game_start', 'game')
   - Call setupRound()

4. **setupRound():**
   - Get roundData = content.rounds[gameState.currentRound]
   - Store in gameState.roundData
   - Display scenario text from roundData.context.scenario
   - Display base ratio card: "For every [a] [item1], there are [b] [item2]"
   - If roundType === 'typeA':
     - Show #type-a-area, hide #type-b-area
     - Show the scaled card with one value displayed and one blank
     - The blankField ('a' or 'b') determines which is hidden; the other is shown
     - Show the input field with appropriate label and unit
     - Show Submit button
     - Set phase = 'playing-typeA'
   - If roundType === 'typeB':
     - Show #type-b-area, hide #type-a-area
     - Show the scaled card with BOTH values displayed
     - Show Same outcome / Different outcome buttons
     - Hide #reason-area
     - Set phase = 'playing-typeB-judge'
   - Update progressBar.update(gameState.currentRound, gameState.lives)
   - Hide feedback area
   - Record screen transition view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('content_render', {
         screen: 'gameplay',
         content_snapshot: {
           type: roundData.roundType,
           round: gameState.currentRound + 1,
           stage: roundData.stage,
           base_ratio: roundData.baseRatio,
           trigger: 'round_start'
         },
         components: {
           progress: { current: gameState.currentRound + 1, total: gameState.totalRounds }
         }
       });
     }
     ```

5. **handleTypeASubmit():**
   - isProcessing guard: if (gameState.isProcessing) return; gameState.isProcessing = true
   - Read answer-input value (parseInt)
   - If empty or NaN: show "Enter a number", isProcessing = false, return
   - Compare with roundData.correctAnswer
   - recordAttempt({ userAnswer, correct, question: roundData.context.scenario, correctAnswer: roundData.correctAnswer, validationType: 'function' })
   - **If correct:**
     ```javascript
     const sound = FeedbackManager.sound;
     await sound.play('correct_tap', {
       subtitle: roundData.feedbackCorrect,
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
     });
     await FeedbackManager.playDynamicFeedback({
       audio_content: roundData.feedbackCorrect,
       subtitle: roundData.feedbackCorrect
     });
     ```
     - gameState.score++
     - trackEvent('type_a_answer', 'game', { correct: true, answer: userAnswer, round: gameState.currentRound + 1 })
   - **If wrong:**
     ```javascript
     const sound = FeedbackManager.sound;
     await sound.play('wrong_tap', {
       subtitle: roundData.feedbackWrong,
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif'
     });
     await FeedbackManager.playDynamicFeedback({
       audio_content: roundData.feedbackWrong,
       subtitle: roundData.feedbackWrong
     });
     ```
     - gameState.lives--
     - trackEvent('type_a_answer', 'game', { correct: false, answer: userAnswer, round: gameState.currentRound + 1 })
     - trackEvent('life_lost', 'game', { lives: gameState.lives, round: gameState.currentRound + 1 })
     - progressBar.update(gameState.currentRound, gameState.lives)
   - Record round outcome:
     ```javascript
     if (signalCollector) {
       signalCollector.recordCustomEvent('round_solved', {
         round: gameState.currentRound + 1,
         correct: isCorrect,
         answer: userAnswer
       });
     }
     ```
   - Lives check: if (gameState.lives <= 0) handleGameOver() else nextRound()
   - gameState.isProcessing = false

6. **handleTypeBJudgment(sameChosen):**
   - isProcessing guard: if (gameState.isProcessing) return; gameState.isProcessing = true
   - correct = (sameChosen === roundData.isProportional)
   - trackEvent('type_b_judgment', 'game', { sameChosen, correct, round: gameState.currentRound + 1 })
   - **If correct AND !isProportional (correctly identified "Different"):**
     ```javascript
     const sound = FeedbackManager.sound;
     await sound.play('correct_tap', {
       subtitle: 'Correct! Now tell me why it is different.',
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
     });
     ```
     - Hide #judgment-buttons
     - Show #reason-area with roundData.reasonOptions[0] and roundData.reasonOptions[1] as button text
     - Set phase = 'playing-typeB-reason'
     - gameState.isProcessing = false
     - RETURN (do not advance round yet -- wait for reason selection)
   - **If correct AND isProportional (correctly identified "Same"):**
     ```javascript
     const sound = FeedbackManager.sound;
     await sound.play('correct_tap', {
       subtitle: roundData.feedbackCorrect,
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
     });
     await FeedbackManager.playDynamicFeedback({
       audio_content: roundData.feedbackCorrect,
       subtitle: roundData.feedbackCorrect
     });
     ```
     - gameState.score++
     - recordAttempt({ userAnswer: 'same', correct: true, question: roundData.context.scenario, correctAnswer: 'same', validationType: 'function' })
   - **If wrong:**
     ```javascript
     const sound = FeedbackManager.sound;
     await sound.play('wrong_tap', {
       subtitle: roundData.feedbackWrong,
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif'
     });
     await FeedbackManager.playDynamicFeedback({
       audio_content: roundData.feedbackWrong,
       subtitle: roundData.feedbackWrong
     });
     ```
     - gameState.lives--
     - trackEvent('life_lost', 'game', { lives: gameState.lives, round: gameState.currentRound + 1 })
     - progressBar.update(gameState.currentRound, gameState.lives)
     - recordAttempt({ userAnswer: sameChosen ? 'same' : 'different', correct: false, question: roundData.context.scenario, correctAnswer: roundData.isProportional ? 'same' : 'different', validationType: 'function' })
   - Record round outcome via `signalCollector.recordCustomEvent('round_solved', ...)`
   - Lives check: if (gameState.lives <= 0) handleGameOver() else nextRound()
   - gameState.isProcessing = false

7. **handleReasonChoice(index):**
   - isProcessing guard
   - trackEvent('type_b_reason', 'game', { chosenIndex: index, correctIndex: roundData.correctReasonIndex, round: gameState.currentRound + 1 })
   - **If index === roundData.correctReasonIndex (correct reason):**
     ```javascript
     await FeedbackManager.playDynamicFeedback({
       audio_content: roundData.feedbackCorrect,
       subtitle: roundData.feedbackCorrect,
       sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
     });
     ```
     - gameState.score++
     - recordAttempt({ userAnswer: 'different_reason_' + index, correct: true, question: roundData.context.scenario, correctAnswer: 'different_reason_' + roundData.correctReasonIndex, validationType: 'function' })
   - **If wrong reason:**
     - Show the correct reason text via feedback
     ```javascript
     const correctReason = roundData.reasonOptions[roundData.correctReasonIndex];
     await FeedbackManager.playDynamicFeedback({
       audio_content: 'The correct reason is: ' + correctReason,
       subtitle: 'The correct reason is: ' + correctReason
     });
     ```
     - gameState.score++ (judgment was correct -- wrong reason does NOT cost a life or prevent scoring)
     - recordAttempt({ userAnswer: 'different_reason_' + index, correct: false, question: roundData.context.scenario, correctAnswer: 'different_reason_' + roundData.correctReasonIndex, validationType: 'function' })
   - Record round outcome via `signalCollector.recordCustomEvent('round_solved', ...)`
   - nextRound()
   - gameState.isProcessing = false

8. **nextRound():**
   - gameState.currentRound++
   - trackEvent('round_complete', 'game', { round: gameState.currentRound, score: gameState.score })
   - If gameState.currentRound >= gameState.totalRounds: endGame()
   - Else:
     - Check for stage transition (round 3 -> stage 2, round 7 -> stage 3)
     - If stage changed: show stage-transition screen via TransitionScreen, then setupRound()
     - Else: setupRound()

9. **handleGameOver():**
   - Seal SignalCollector: `if (signalCollector) signalCollector.seal()`
   - gameState.gameEnded = true
   - gameState.isActive = false
   ```javascript
   await FeedbackManager.playDynamicFeedback({
     audio_content: 'Keep practicing! Ratios get easier with practice!',
     subtitle: 'Keep practicing! Ratios get easier with practice!'
   });
   ```
   - Show game-over transition screen with "Try Again" button -> restartGame()
   - Record screen transition view event
   - Send postMessage with game results (PART-008)

10. **endGame():**
    - Seal SignalCollector: `if (signalCollector) signalCollector.seal()`
    - gameState.gameEnded = true
    - gameState.isActive = false
    - Calculate stars: 9-10 correct -> 3 stars, 6-8 -> 2 stars, 1-5 -> 1 star
    - Calculate accuracy: (score / totalRounds * 100).toFixed(0) + '%'
    - Update results screen: #result-score, #result-lives, #result-accuracy, #stars-display
    ```javascript
    await FeedbackManager.playDynamicFeedback({
      audio_content: 'Great work! You scaled ' + gameState.score + ' out of 10 correctly!',
      subtitle: 'Great work! You scaled ' + gameState.score + ' out of 10 correctly!',
      sticker: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json'
    });
    ```
    - Show results screen (hide game screen)
    - progressBar.update(gameState.totalRounds, gameState.lives)
    - Record screen transition view event
    - Send postMessage with game results (PART-008)

11. **restartGame():**
    - Full reset: score=0, lives=3, currentRound=0, currentStage=1, attempts=[], events=[], gameEnded=false
    - Clear answer-input value
    - Hide results screen and game-over screen
    - Show start transition screen
    - On start button click -> startGame()

---

## 9. Functions

### Global Scope (RULE-001)

All functions are defined in the global scope. No modules, no classes, no IIFE.

**DOMContentLoaded handler:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();

    // PART-017: Init feedback
    FeedbackManager.init();
    const sound = FeedbackManager.sound;
    sound.register('correct_tap', 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3');
    sound.register('wrong_tap', 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3');
    await sound.preload(['correct_tap', 'wrong_tap']);

    // PART-010: SignalCollector
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      gameId: gameState.gameId,
      contentSetId: gameState.contentSetId || null
    });
    window.signalCollector = signalCollector;
    // Flushing starts when game_init arrives with signalConfig.flushUrl

    // PART-025: ScreenLayout
    ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });

    // Clone game template into #gameContent
    const template = document.getElementById('game-template');
    const gameContent = document.getElementById('gameContent');
    gameContent.appendChild(template.content.cloneNode(true));

    // PART-023: ProgressBar
    progressBar = new ProgressBar({
      totalRounds: 10,
      totalLives: 3,
      container: document.querySelector('.progress-bar-slot')
    });

    // PART-024: TransitionScreen
    transitionScreen = new TransitionScreen({
      container: document.querySelector('.transition-screen-slot')
    });

    // PART-005: VisibilityTracker
    visibilityTracker = new VisibilityTracker({ gameState });

    // PostMessage listener (PART-008)
    window.addEventListener('message', handlePostMessage);

    // Show start screen
    transitionScreen.show('start', {
      title: 'Scale It Up',
      subtitle: 'See a ratio, then predict what happens when quantities change!',
      buttonText: 'Start!',
      onStart: () => startGame()
    });

  } catch (err) {
    console.error('Init error:', err);
    if (window.Sentry) Sentry.captureException(err);
  }
});
```

**startGame()**
- Set gameState.isActive = true
- Set gameState.startTime = Date.now()
- Load content: if (gameState.content) use it, else use fallbackContent
- gameState.currentRound = 0
- gameState.score = 0
- gameState.lives = 3
- gameState.currentStage = 1
- gameState.gameEnded = false
- trackEvent('game_start', 'game')
- Hide transition screen
- Show #game-screen
- setupRound()

**setupRound()**
- Get roundData = content.rounds[gameState.currentRound]
- gameState.roundData = roundData
- gameState.currentStage = roundData.stage
- Clear previous state: hide feedback area, clear answer-input, hide reason-area
- Set #scenario-text textContent = roundData.context.scenario
- Set #base-a textContent = roundData.baseRatio.a
- Set #base-b textContent = roundData.baseRatio.b
- Set #base-item1 textContent = roundData.context.item1Name
- Set #base-item2 textContent = roundData.context.item2Name
- Record content_render view event (see Section 8 step 4)
- If roundData.roundType === 'typeA':
  - Show #type-a-area, hide #type-b-area
  - Build scaled text: show the known value, leave blank for blankField
  - If blankField === 'b': show scaledValues.a with item1Name, input for item2Name
  - If blankField === 'a': input for item1Name, show scaledValues.b with item2Name
  - Set #scaled-label and #scaled-unit accordingly
  - Clear and focus #answer-input
  - gameState.phase = 'playing-typeA'
- If roundData.roundType === 'typeB':
  - Hide #type-a-area, show #type-b-area
  - Build scaled text showing both scaledValues.a + item1 and scaledValues.b + item2
  - Show #judgment-buttons, hide #reason-area
  - gameState.phase = 'playing-typeB-judge'
- progressBar.update(gameState.currentRound, gameState.lives) -- round = rounds COMPLETED (starts at 0)
- Record content_render view event (see Section 8 step 4)

**handleTypeASubmit()**
- See Section 8 step 5 for full logic and audio code blocks.

**handleTypeBJudgment(sameChosen)**
- See Section 8 step 6 for full logic and audio code blocks.

**handleReasonChoice(index)**
- See Section 8 step 7 for full logic and audio code blocks.
- IMPORTANT: Wrong reason does NOT cost a life. The judgment was correct (the kid knew it was "Different"). Only wrong judgment costs a life.

**nextRound()**
- See Section 8 step 8 for full logic.
- Stage transitions occur at round boundaries:
  - After round 3 (index 2 -> 3): if new stage !== old stage, show stage-transition screen
  - After round 7 (index 6 -> 7): if new stage !== old stage, show stage-transition screen
- Stage transition screen:
  ```javascript
  transitionScreen.show('stage-transition', {
    title: 'Stage ' + newStage,
    subtitle: getStageSubtitle(newStage),
    buttonText: 'Continue',
    onStart: () => { transitionScreen.hide(); setupRound(); }
  });
  ```

**getStageSubtitle(stage)**
- Stage 2: "Bigger numbers and trickier changes ahead!"
- Stage 3: "Can you spot the subtle traps?"

**handleGameOver()**
- See Section 8 step 9 for full logic.

**endGame()**
- See Section 8 step 10 for full logic.

**restartGame()**
- See Section 8 step 11 for full logic.

**handlePostMessage(event)** (PART-008)
- If event.data.type === 'game_init':
  - gameState.content = event.data.data.content
  - gameState.signalConfig = event.data.data.signalConfig || {}
  - Configure SignalCollector flushing:
    ```javascript
    if (signalCollector && gameState.signalConfig.flushUrl) {
      signalCollector.flushUrl = gameState.signalConfig.flushUrl;
      signalCollector.playId = gameState.signalConfig.playId || null;
      signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
      signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
      signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
      signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
      signalCollector.startFlushing();
    }
    ```
- If event.data.type === 'START_GAME': startGame()

**trackEvent(name, category, data)** (PART-010)
- Push to gameState.events array with timestamp
- If signalCollector: signalCollector.recordCustomEvent(name, data)

**recordAttempt(attemptData)** (PART-009)
- Push to gameState.attempts with timestamp, duration, round info

---

## 10. Feedback Integration (PART-017)

### Audio Preload

```
correct_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3
wrong_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3
```

### Stickers

```
correct: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif (IMAGE_GIF)
incorrect: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif (IMAGE_GIF)
trophy: https://cdn.mathai.ai/mathai-assets/lottie/trophy.json (Lottie)
```

### Audio Flow

**Type A (Fill-in-blank):**
- Correct: `await sound.play('correct_tap', { subtitle: feedbackCorrect, sticker: correct_gif })` -> then `await FeedbackManager.playDynamicFeedback({ audio_content: feedbackCorrect, subtitle: feedbackCorrect })`
- Wrong: `await sound.play('wrong_tap', { subtitle: feedbackWrong, sticker: incorrect_gif })` -> life lost -> then `await FeedbackManager.playDynamicFeedback({ audio_content: feedbackWrong, subtitle: feedbackWrong })`

**Type B (Will it work?):**
- Correct judgment (Same, when isProportional): `await sound.play('correct_tap', { subtitle: feedbackCorrect, sticker: correct_gif })` -> `await FeedbackManager.playDynamicFeedback({ audio_content: feedbackCorrect, subtitle: feedbackCorrect })`
- Correct judgment (Different, when !isProportional): `await sound.play('correct_tap', { subtitle: 'Correct! Now tell me why.', sticker: correct_gif })` -> show reason buttons -> wait for reason choice
- Correct reason: `await FeedbackManager.playDynamicFeedback({ audio_content: feedbackCorrect, subtitle: feedbackCorrect, sticker: correct_gif })`
- Wrong reason: `await FeedbackManager.playDynamicFeedback({ audio_content: 'The correct reason is: ' + correctReason, subtitle: ... })` (no life lost, still scores)
- Wrong judgment: `await sound.play('wrong_tap', { subtitle: feedbackWrong, sticker: incorrect_gif })` -> life lost -> `await FeedbackManager.playDynamicFeedback({ audio_content: feedbackWrong, subtitle: feedbackWrong })`

**End game:** `await FeedbackManager.playDynamicFeedback({ audio_content: 'Great work! You scaled X out of 10 correctly!', subtitle: ..., sticker: trophy_lottie })`

**CRITICAL:** Use `FeedbackManager.playDynamicFeedback()` for TTS, NOT `sound.play('dynamic', ...)`. See game-spec-learnings Issue 4.

---

## 11. Audio Sequence Table

| # | Moment | Trigger | Audio Type | Content / Sound ID | Await? | Notes |
|---|--------|---------|------------|-------------------|--------|-------|
| 1 | Type A correct | handleTypeASubmit (correct) | Static | correct_tap | Awaited | With correct sticker + subtitle |
| 2 | Type A explanation | handleTypeASubmit (after #1) | Dynamic TTS | Round-specific feedbackCorrect | Awaited | Sequential after #1 via playDynamicFeedback |
| 3 | Type A wrong | handleTypeASubmit (wrong) | Static | wrong_tap | Awaited | With incorrect sticker, life lost |
| 4 | Type A wrong explanation | handleTypeASubmit (after #3) | Dynamic TTS | Error diagnosis (feedbackWrong) | Awaited | Sequential after #3 via playDynamicFeedback |
| 5 | Type B correct judgment | handleTypeBJudgment (correct) | Static | correct_tap | Awaited | With correct sticker |
| 6 | Type B correct reason | handleReasonChoice (correct, "Different" path) | Dynamic TTS | feedbackCorrect explanation | Awaited | Only for "Different outcome" path via playDynamicFeedback |
| 7 | Type B wrong judgment | handleTypeBJudgment (wrong) | Static | wrong_tap | Awaited | With incorrect sticker, life lost |
| 8 | Type B wrong explanation | handleTypeBJudgment (after #7) | Dynamic TTS | feedbackWrong explanation | Awaited | Sequential after #7 via playDynamicFeedback |
| 9 | Game over | handleGameOver (0 lives) | Dynamic TTS | "Keep practicing! Ratios get easier!" | Awaited | Via playDynamicFeedback |
| 10 | Victory | endGame (completed) | Dynamic TTS | Score summary | Awaited | With trophy sticker via playDynamicFeedback |

---

## 12. Review Findings

### Resolved: Audio/sticker URLs specified
Added Feedback Integration section (Section 10) with standard PART-017 URLs for correct_tap, wrong_tap, correct/incorrect GIFs, and trophy Lottie.

### Resolved: Input schema defined
Added full JSON schema (Section 4) covering all fields for both Type A and Type B rounds.

### Resolved: Content generation guide added
Added Content Set Generation Guide (Section 6) with easy/medium/hard dimension tables and constraints.

### Resolved: Type B wrong reason consequence clarified
Wrong reason selection does NOT cost an additional life. The judgment was correct (kid knew it was "Different"). Only wrong judgment (Same vs. Different) costs a life. Wrong reason still awards the score point (judgment was correct). The correct reason is shown via `playDynamicFeedback()` for learning.

### Resolved: Number input range expanded
Input range changed to 1-36 (not 1-9) for Type A answers. Base ratio values remain 1-9, but with multipliers up to x4, the answer can be as large as 9 x 4 = 36.

### Info: Difference from "Same Rule?" game

| Same Rule? | Scale It Up |
|------------|-------------|
| Recognition (see pattern, classify) | Prediction (compute what comes next) |
| Binary choice + rule verification | Fill-in-blank + yes/no judgment |
| No penalty for wrong | Lives system adds stakes |
| "Is this the same pattern?" | "What number keeps the pattern?" |
| Passive: both scenes visible | Active: must produce the answer |

Together, the two games form a complete ratio intuition unit: recognize -> predict -> apply.
