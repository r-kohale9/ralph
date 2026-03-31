# Assembly Book: Match Up!

---

## 1. Game Identity

```
- Title: Match Up!
- Game ID: ratio-match-up
- Type: standard
- Description: See a ratio in a real-world context and either judge whether a second ratio is equivalent (Type A) or produce an equivalent ratio by filling in missing numbers (Type B). 10 rounds, 3 stages, 3 lives.
- Learning goal: Equivalent Ratios (Grade 5)
- Skills covered: 1 (identify equivalent ratios) & 2 (generate equivalent ratios)
- Grade: 5
- Bloom level: L2 Understand → L3 Apply
```

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | — |
| PART-002 | Package Scripts | YES | — |
| PART-003 | waitForPackages | YES | — |
| PART-004 | Initialization Block | YES | — |
| PART-005 | VisibilityTracker | YES | popupProps: default |
| PART-006 | TimerComponent | NO | No timer |
| PART-007 | Game State Object | YES | Custom fields: lives, roundType, ruleRatio, multiplier |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | — |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: type_a_answer, type_b_submit, round_complete |
| PART-011 | End Game & Metrics | YES | Star logic: 80%→3★, 50%→2★, >0%→1★ |
| PART-012 | Debug Functions | YES | — |
| PART-014 | Validation Function | YES | Type A: same/different check. Type B: check both input values |
| PART-017 | Feedback Integration | YES | Audio: correct_tap, wrong_tap, partial_correct_attempt1. Stickers: correct/incorrect/partial_correct GIFs, trophy Lottie. Dynamic TTS for explanations. |
| PART-019 | Results Screen UI | YES | — |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | — |
| PART-022 | Game Buttons | YES | Same Ratio/Different Ratio + Submit |
| PART-023 | ProgressBar Component | YES | totalRounds: 10, totalLives: 3 |
| PART-024 | TransitionScreen Component | YES | Screens: start, stage-transition, victory, game-over |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | — |
| PART-027 | Play Area Construction | YES | Layout: rule card + comparison/input area |
| PART-028 | InputSchema Patterns | YES | — |
| PART-030 | Sentry Error Tracking | YES | — |
| PART-033 | Interaction Patterns | YES | Patterns: buttons (same/different), number-inputs (Type B) |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | — |
| PART-035 | Test Plan Generation | YES (POST_GEN) | — |
| PART-037 | Playwright Testing | YES (POST_GEN) | — |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY:
  gameId: 'ratio-match-up',
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,
  phase: 'start',  // start | playing-typeA | playing-typeB | feedback | transition | results | gameover
  isProcessing: false,
  content: null,
  duration_data: { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null },

  // GAME-SPECIFIC:
  lives: 3,
  totalLives: 3,
  roundData: null,           // Current round content
  currentStage: 1,           // 1=Easy, 2=Mixed, 3=Hard
};
```

---

## 4. Input Schema

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
            "description": "Type A = Same or Different judgment, Type B = Make It Match (fill both values)"
          },
          "stage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3,
            "description": "Difficulty stage (1=Easy, 2=Mixed, 3=Hard)"
          },
          "context": {
            "type": "object",
            "properties": {
              "item1Emoji": { "type": "string", "description": "Emoji for first quantity (e.g., 🍎)" },
              "item1Name": { "type": "string", "description": "Name for first quantity (e.g., apples)" },
              "item2Emoji": { "type": "string", "description": "Emoji for second quantity (e.g., 🍊)" },
              "item2Name": { "type": "string", "description": "Name for second quantity (e.g., oranges)" }
            },
            "required": ["item1Emoji", "item1Name", "item2Emoji", "item2Name"]
          },
          "ruleRatio": {
            "type": "object",
            "properties": {
              "a": { "type": "integer", "minimum": 1, "maximum": 9 },
              "b": { "type": "integer", "minimum": 1, "maximum": 9 }
            },
            "required": ["a", "b"],
            "description": "The base ratio — 'For every A item1, there are B item2'"
          },
          "multiplier": {
            "type": "integer",
            "minimum": 2,
            "maximum": 5,
            "description": "The multiplier for equivalent ratio (Type B instruction, Type A scaling factor)"
          },
          "comparisonRatio": {
            "type": "object",
            "properties": {
              "a": { "type": "integer", "minimum": 1, "maximum": 45 },
              "b": { "type": "integer", "minimum": 1, "maximum": 45 }
            },
            "required": ["a", "b"],
            "description": "Type A only: the comparison ratio shown to the student"
          },
          "isEquivalent": {
            "type": "boolean",
            "description": "Type A only: whether comparisonRatio is equivalent to ruleRatio"
          },
          "distractorType": {
            "type": "string",
            "enum": ["additive", "swap", "one-side", "none"],
            "description": "Type A only: what kind of distractor is used (if different)"
          },
          "correctAnswer": {
            "type": "object",
            "properties": {
              "a": { "type": "integer" },
              "b": { "type": "integer" }
            },
            "required": ["a", "b"],
            "description": "Type B only: the correct values (ruleRatio × multiplier)"
          },
          "feedbackCorrect": { "type": "string", "description": "TTS text for correct answer" },
          "feedbackWrong": { "type": "string", "description": "TTS text for wrong answer" }
        },
        "required": ["roundType", "stage", "context", "ruleRatio", "multiplier", "feedbackCorrect", "feedbackWrong"]
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
      "context": { "item1Emoji": "🍎", "item1Name": "apples", "item2Emoji": "🍊", "item2Name": "oranges" },
      "ruleRatio": { "a": 1, "b": 2 },
      "multiplier": 2,
      "comparisonRatio": { "a": 2, "b": 4 },
      "isEquivalent": true,
      "distractorType": "none",
      "feedbackCorrect": "Yes! Both sides were multiplied by 2, so 1:2 and 2:4 are the same ratio.",
      "feedbackWrong": "Look again — 1 times 2 is 2, and 2 times 2 is 4. Both sides doubled, so they match!"
    },
    {
      "roundType": "typeA",
      "stage": 1,
      "context": { "item1Emoji": "🐶", "item1Name": "dogs", "item2Emoji": "🐱", "item2Name": "cats" },
      "ruleRatio": { "a": 1, "b": 3 },
      "multiplier": 2,
      "comparisonRatio": { "a": 2, "b": 5 },
      "isEquivalent": false,
      "distractorType": "one-side",
      "feedbackCorrect": "Right! The dogs doubled but the cats didn't triple correctly — 2:5 is not the same as 1:3.",
      "feedbackWrong": "Check carefully — 1 times 2 is 2, but 3 times 2 is 6, not 5. Only one side was scaled correctly."
    },
    {
      "roundType": "typeA",
      "stage": 1,
      "context": { "item1Emoji": "⭐", "item1Name": "stars", "item2Emoji": "🌙", "item2Name": "moons" },
      "ruleRatio": { "a": 2, "b": 1 },
      "multiplier": 2,
      "comparisonRatio": { "a": 4, "b": 2 },
      "isEquivalent": true,
      "distractorType": "none",
      "feedbackCorrect": "Correct! Both sides multiplied by 2 — 2:1 becomes 4:2. Same ratio!",
      "feedbackWrong": "Both numbers doubled: 2 times 2 is 4, and 1 times 2 is 2. They do match!"
    },
    {
      "roundType": "typeA",
      "stage": 2,
      "context": { "item1Emoji": "🎨", "item1Name": "paintbrushes", "item2Emoji": "🖍️", "item2Name": "crayons" },
      "ruleRatio": { "a": 2, "b": 3 },
      "multiplier": 2,
      "comparisonRatio": { "a": 5, "b": 6 },
      "isEquivalent": false,
      "distractorType": "additive",
      "feedbackCorrect": "Good eye! 5:6 was made by adding 3 to each, not multiplying. That changes the ratio!",
      "feedbackWrong": "This is an additive trap — someone added 3 to both numbers instead of multiplying. 2 times 2 is 4, not 5."
    },
    {
      "roundType": "typeB",
      "stage": 2,
      "context": { "item1Emoji": "🌹", "item1Name": "roses", "item2Emoji": "🌻", "item2Name": "sunflowers" },
      "ruleRatio": { "a": 3, "b": 2 },
      "multiplier": 2,
      "correctAnswer": { "a": 6, "b": 4 },
      "feedbackCorrect": "Perfect! 3 times 2 is 6 roses, and 2 times 2 is 4 sunflowers. Both sides multiplied by 2!",
      "feedbackWrong": "Remember — multiply BOTH numbers by 2. 3 times 2 is 6, and 2 times 2 is 4."
    },
    {
      "roundType": "typeA",
      "stage": 2,
      "context": { "item1Emoji": "⚽", "item1Name": "soccer balls", "item2Emoji": "🏀", "item2Name": "basketballs" },
      "ruleRatio": { "a": 3, "b": 4 },
      "multiplier": 3,
      "comparisonRatio": { "a": 9, "b": 12 },
      "isEquivalent": true,
      "distractorType": "none",
      "feedbackCorrect": "Yes! Both sides multiplied by 3 — 3:4 becomes 9:12. Same ratio!",
      "feedbackWrong": "Check: 3 times 3 is 9, and 4 times 3 is 12. Both sides tripled, so they match."
    },
    {
      "roundType": "typeB",
      "stage": 2,
      "context": { "item1Emoji": "🧁", "item1Name": "cupcakes", "item2Emoji": "🍪", "item2Name": "cookies" },
      "ruleRatio": { "a": 2, "b": 5 },
      "multiplier": 3,
      "correctAnswer": { "a": 6, "b": 15 },
      "feedbackCorrect": "Nice! 2 times 3 is 6 cupcakes, and 5 times 3 is 15 cookies. Both sides multiplied by 3!",
      "feedbackWrong": "Did you add 3 instead of multiply? Multiply BOTH sides: 2 times 3 is 6, and 5 times 3 is 15."
    },
    {
      "roundType": "typeA",
      "stage": 3,
      "context": { "item1Emoji": "🌳", "item1Name": "oak trees", "item2Emoji": "🌲", "item2Name": "pine trees" },
      "ruleRatio": { "a": 3, "b": 5 },
      "multiplier": 4,
      "comparisonRatio": { "a": 7, "b": 9 },
      "isEquivalent": false,
      "distractorType": "additive",
      "feedbackCorrect": "Correct! 7:9 was made by adding 4, not multiplying. The real equivalent would be 12:20.",
      "feedbackWrong": "This is tricky — adding 4 to each gives 7:9, but multiplying by 4 gives 12:20. Adding changes the ratio!"
    },
    {
      "roundType": "typeB",
      "stage": 3,
      "context": { "item1Emoji": "📏", "item1Name": "rulers", "item2Emoji": "✏️", "item2Name": "pencils" },
      "ruleRatio": { "a": 4, "b": 7 },
      "multiplier": 5,
      "correctAnswer": { "a": 20, "b": 35 },
      "feedbackCorrect": "Amazing! 4 times 5 is 20 rulers, and 7 times 5 is 35 pencils. Both sides multiplied by 5!",
      "feedbackWrong": "Multiply BOTH numbers by 5. 4 times 5 is 20, and 7 times 5 is 35. Don't add — multiply!"
    },
    {
      "roundType": "typeA",
      "stage": 3,
      "context": { "item1Emoji": "🔵", "item1Name": "blue marbles", "item2Emoji": "🔴", "item2Name": "red marbles" },
      "ruleRatio": { "a": 5, "b": 3 },
      "multiplier": 3,
      "comparisonRatio": { "a": 3, "b": 5 },
      "isEquivalent": false,
      "distractorType": "swap",
      "feedbackCorrect": "Sharp! 3:5 is just 5:3 flipped around — the numbers are swapped, so it's a different ratio.",
      "feedbackWrong": "Look closely — 3:5 has the numbers reversed from 5:3. Swapping the order changes the ratio!"
    }
  ]
}
```

---

## 6. Content Generation Guide

| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| Rounds | 10 | 10 | 10 |
| Type A / Type B split | 7A / 3B | 5A / 5B | 4A / 6B |
| Multiplier range | x2 only | x2, x3 | x3, x4, x5 |
| Ratio complexity | Ratios with 1 (1:2, 2:1, 1:3) | Ratios without 1 (2:3, 3:4) | Larger (3:5, 4:7) up to 9 |
| Distractor types | Simple (one-side only) | Additive + one-side | Additive + swap + close values |
| Contexts | Food, animals | Crafts, recipes, sports | Nature, classroom, abstract |

### Constraints

- All values must be ≤ 45 (max 9 x 5)
- Type B: `correctAnswer = ruleRatio.a * multiplier, ruleRatio.b * multiplier`
- Type A equivalent: `comparisonRatio = ruleRatio * multiplier`
- Type A different: `comparisonRatio` must NOT be a valid multiple of `ruleRatio`
- Additive distractors: same difference (a-b) but different ratio
- `feedbackCorrect` must mention the specific multiplier ("Both sides multiplied by 3!")
- `feedbackWrong` must diagnose the likely error type

### Stage Breakdown

| Stage | Rounds | Types | Multipliers | Ratio complexity |
|-------|--------|-------|-------------|-----------------|
| 1 (Easy) | 1-3 | Type A only | x2 | Ratios with 1 (1:2, 1:3, 2:1) |
| 2 (Mixed) | 4-7 | A + B | x2, x3 | Ratios without 1 (2:3, 3:4) |
| 3 (Hard) | 8-10 | A + B | x3, x4, x5 | Ratios without 1, additive traps close to correct |

### Round Types

**Type A: "Same or Different?" (Skill 1 — Identify)**

The kid sees two ratios side by side in the same real-world context and decides if they're equivalent.

- Rule card: "For every 2 🍎, there are 3 🍊"
- Comparison card: "For every 6 🍎, there are 9 🍊"
- Two buttons: "Same ratio!" / "Different ratio!"
- If Different: no follow-up needed

Key distractors:
- Additive trap: 2:3 → 5:6 (added 3 to each)
- Swap trap: 2:3 → 3:2 (reversed)
- One-side trap: 2:3 → 4:3 (only first doubled)

**Type B: "Make It Match!" (Skill 2 — Generate)**

The kid sees a ratio and a multiplier instruction, then fills in both values of the equivalent ratio.

- Rule card: "For every 3 🌹, there are 2 🌻"
- Instruction: "Make it x4 bigger!"
- Two input fields: ___ 🌹 and ___ 🌻
- Submit button

Key design:
- Both fields must be filled (kid produces BOTH numbers)
- Validates each field independently — can get partial credit feedback ("First number correct! Check the second.")
- Additive trap shown as hint on wrong answer: "Did you add 4 instead of multiply by 4?"

### Partial Credit (Type B)

On partial correct (one field right, one wrong), the kid sees which field was correct, gets the partial_correct sound+sticker, and must re-enter both fields. This counts as one attempt. If wrong on retry, it costs a life and moves to next round.

---

## 7. Screens & HTML Structure

Game HTML is placed inside a `<template>` element and cloned into `#gameContent` after `ScreenLayout.inject()` runs, per PART-025 requirements.

```html
<div id="app"></div>
<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Rule Card -->
    <div class="rule-card" id="rule-card">
      <p class="rule-text">For every <span class="rule-count" id="rule-a"></span> <span id="rule-emoji-1"></span> <span id="rule-item1"></span>, there are <span class="rule-count" id="rule-b"></span> <span id="rule-emoji-2"></span> <span id="rule-item2"></span></p>
    </div>

    <!-- Type A: Comparison Card + Buttons -->
    <div id="type-a-area" style="display:none;">
      <div class="comparison-card" id="comparison-card">
        <p class="comparison-text">For every <span class="comp-count" id="comp-a"></span> <span id="comp-emoji-1"></span> <span id="comp-item1"></span>, there are <span class="comp-count" id="comp-b"></span> <span id="comp-emoji-2"></span> <span id="comp-item2"></span></p>
      </div>
      <div class="btn-container">
        <button class="game-btn btn-primary" id="btn-same-ratio" data-signal-id="btn-same" onclick="handleTypeAAnswer(true)">Same ratio!</button>
        <button class="game-btn btn-secondary" id="btn-diff-ratio" data-signal-id="btn-different" onclick="handleTypeAAnswer(false)">Different ratio!</button>
      </div>
    </div>

    <!-- Type B: Multiplier Badge + Two Inputs -->
    <div id="type-b-area" style="display:none;">
      <div class="multiplier-badge" id="multiplier-badge">x<span id="multiplier-value"></span></div>
      <p class="instruction-text">Make it match!</p>
      <div class="input-row">
        <input type="number" id="input-a" class="ratio-input" min="1" max="45" data-signal-id="input-a">
        <span id="input-emoji-1" class="input-emoji"></span>
        <span id="input-item1" class="input-label"></span>
      </div>
      <div class="input-row">
        <input type="number" id="input-b" class="ratio-input" min="1" max="45" data-signal-id="input-b">
        <span id="input-emoji-2" class="input-emoji"></span>
        <span id="input-item2" class="input-label"></span>
      </div>
      <button class="game-btn btn-primary" id="btn-submit" data-signal-id="btn-submit" onclick="handleTypeBSubmit()">Submit</button>
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

---

## 8. Game Flow

1. **Page loads** → `DOMContentLoaded`: call `waitForPackages()`, then `FeedbackManager.init()`, preload audio (correct_tap, wrong_tap, partial_correct_attempt1), initialize `SignalCollector`, inject `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })`, clone `#game-template` content into `#gameContent`, create `ProgressBar({ totalRounds: 10, totalLives: 3 })`, create `TransitionScreen`, initialize `VisibilityTracker`, show start transition screen.

2. **Start screen callback** → `startGame()`: set `gameState.isActive = true`, `gameState.startTime = Date.now()`, `gameState.phase = 'playing-typeA'` or `'playing-typeB'`, call `setupRound()`.

3. **setupRound():**
   - Get `roundData = gameState.content.rounds[gameState.currentRound]`
   - Set `gameState.roundData = roundData`
   - Set `gameState.currentStage = roundData.stage`
   - Display rule card: populate `#rule-a`, `#rule-b`, `#rule-emoji-1`, `#rule-emoji-2`, `#rule-item1`, `#rule-item2` from `roundData.ruleRatio` and `roundData.context`
   - If `roundData.roundType === 'typeA'`:
     - Show `#type-a-area`, hide `#type-b-area`
     - Populate comparison card: `#comp-a`, `#comp-b`, `#comp-emoji-1`, `#comp-emoji-2`, `#comp-item1`, `#comp-item2` from `roundData.comparisonRatio` and `roundData.context`
     - Set `gameState.phase = 'playing-typeA'`
   - If `roundData.roundType === 'typeB'`:
     - Show `#type-b-area`, hide `#type-a-area`
     - Set multiplier badge: `#multiplier-value` = `roundData.multiplier`
     - Populate input labels: `#input-emoji-1`, `#input-emoji-2`, `#input-item1`, `#input-item2` from `roundData.context`
     - Clear input fields
     - Set `gameState.phase = 'playing-typeB'`
   - Hide feedback area
   - Update `progressBar.update(gameState.currentRound, gameState.lives)` (round = rounds COMPLETED, starts at 0)

4. **handleTypeAAnswer(sameChosen):**
   - Guard: if `gameState.isProcessing` return
   - Set `gameState.isProcessing = true`
   - Determine: `correct = (sameChosen === roundData.isEquivalent)`
   - Record attempt via PART-009
   - If correct:
     - `await FeedbackManager.sound.play('correct_tap', { subtitle: 'Correct!', sticker: CORRECT_STICKER_URL })`
     - `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackCorrect, subtitle: roundData.feedbackCorrect })`
     - `gameState.score++`
   - If wrong:
     - `await FeedbackManager.sound.play('wrong_tap', { subtitle: 'Not quite!', sticker: INCORRECT_STICKER_URL })`
     - `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackWrong, subtitle: roundData.feedbackWrong })`
     - `gameState.lives--`
   - Track event: `type_a_answer`
   - If `gameState.lives <= 0` → `handleGameOver()`
   - Else → `nextRound()`
   - Set `gameState.isProcessing = false`

5. **handleTypeBSubmit():**
   - Guard: if `gameState.isProcessing` return
   - Set `gameState.isProcessing = true`
   - Read `inputA = parseInt(document.getElementById('input-a').value)`
   - Read `inputB = parseInt(document.getElementById('input-b').value)`
   - Validate: if either is NaN or empty, show "Please fill in both fields" and return
   - `aCorrect = (inputA === roundData.correctAnswer.a)`
   - `bCorrect = (inputB === roundData.correctAnswer.b)`
   - Record attempt via PART-009
   - If both correct:
     - `await FeedbackManager.sound.play('correct_tap', { subtitle: 'Perfect!', sticker: CORRECT_STICKER_URL })`
     - `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackCorrect, subtitle: roundData.feedbackCorrect })`
     - `gameState.score++`
     - Track event: `type_b_submit` with result `correct`
     - `nextRound()`
   - If partial (one correct, one wrong):
     - Determine which field: `partialMsg = aCorrect ? 'First number correct! Check the second.' : 'Second number correct! Check the first.'`
     - `await FeedbackManager.sound.play('partial_correct_attempt1', { subtitle: partialMsg, sticker: PARTIAL_CORRECT_STICKER_URL })`
     - Track event: `type_b_submit` with result `partial`
     - Clear the wrong field, keep the correct one
     - Set `gameState.isProcessing = false` — allow retry (same round, no life lost yet)
     - Return (do NOT call nextRound)
   - If both wrong:
     - `await FeedbackManager.sound.play('wrong_tap', { subtitle: 'Try again!', sticker: INCORRECT_STICKER_URL })`
     - `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackWrong, subtitle: roundData.feedbackWrong })`
     - `gameState.lives--`
     - Track event: `type_b_submit` with result `incorrect`
     - If `gameState.lives <= 0` → `handleGameOver()`
     - Else → `nextRound()`
   - Set `gameState.isProcessing = false`

6. **nextRound():**
   - `gameState.currentRound++`
   - Update `progressBar.update(gameState.currentRound, gameState.lives)`
   - Track event: `round_complete`
   - Check stage transition: if new round crosses stage boundary (round 3→4 or round 7→8), show stage-transition screen via `TransitionScreen`
   - If `gameState.currentRound >= gameState.totalRounds` → `endGame()`
   - Else → `setupRound()`

7. **handleGameOver():**
   - Set `gameState.gameEnded = true`, `gameState.phase = 'gameover'`
   - `await FeedbackManager.playDynamicFeedback({ audio_content: 'Oh no! All lives lost!', subtitle: 'Game Over' })`
   - Show game-over transition screen via `TransitionScreen`
   - After transition callback → `showResults()`

8. **endGame():**
   - Set `gameState.gameEnded = true`, `gameState.phase = 'results'`
   - Calculate stars: `accuracy = gameState.score / gameState.totalRounds`
     - `accuracy >= 0.8` → 3 stars
     - `accuracy >= 0.5` → 2 stars
     - `accuracy > 0` → 1 star
     - else → 0 stars
   - `await FeedbackManager.playDynamicFeedback({ audio_content: 'Great job! You scored ' + gameState.score + ' out of ' + gameState.totalRounds + '!', subtitle: 'Well done!', sticker: TROPHY_LOTTIE_URL })`
   - Seal SignalCollector: `if (signalCollector) signalCollector.seal()` (PART-010)
   - Show victory transition screen via `TransitionScreen`
   - After transition callback → `showResults()`
   - Post metrics via PART-008 postMessage (signal data streamed to GCS — not included)

9. **showResults():**
   - Hide `#game-screen`, show `#results-screen`
   - Populate `#result-score`, `#result-lives`, `#result-accuracy`, `#stars-display`

10. **restartGame():**
    - Full reset: `gameState.currentRound = 0`, `gameState.score = 0`, `gameState.lives = 3`, `gameState.attempts = []`, `gameState.events = []`, `gameState.gameEnded = false`, `gameState.isActive = false`, `gameState.isProcessing = false`
    - Hide results screen, show start transition screen

---

## 9. Functions

### setupRound()

```javascript
function setupRound() {
  const rd = gameState.content.rounds[gameState.currentRound];
  gameState.roundData = rd;
  gameState.currentStage = rd.stage;

  // Populate rule card
  document.getElementById('rule-a').textContent = rd.ruleRatio.a;
  document.getElementById('rule-b').textContent = rd.ruleRatio.b;
  document.getElementById('rule-emoji-1').textContent = rd.context.item1Emoji;
  document.getElementById('rule-emoji-2').textContent = rd.context.item2Emoji;
  document.getElementById('rule-item1').textContent = rd.context.item1Name;
  document.getElementById('rule-item2').textContent = rd.context.item2Name;

  // Hide feedback
  document.getElementById('feedback-area').style.display = 'none';

  if (rd.roundType === 'typeA') {
    gameState.phase = 'playing-typeA';
    document.getElementById('type-a-area').style.display = '';
    document.getElementById('type-b-area').style.display = 'none';

    // Populate comparison card
    document.getElementById('comp-a').textContent = rd.comparisonRatio.a;
    document.getElementById('comp-b').textContent = rd.comparisonRatio.b;
    document.getElementById('comp-emoji-1').textContent = rd.context.item1Emoji;
    document.getElementById('comp-emoji-2').textContent = rd.context.item2Emoji;
    document.getElementById('comp-item1').textContent = rd.context.item1Name;
    document.getElementById('comp-item2').textContent = rd.context.item2Name;

    // Enable buttons
    document.getElementById('btn-same-ratio').disabled = false;
    document.getElementById('btn-diff-ratio').disabled = false;
  } else {
    gameState.phase = 'playing-typeB';
    document.getElementById('type-a-area').style.display = 'none';
    document.getElementById('type-b-area').style.display = '';

    // Multiplier badge
    document.getElementById('multiplier-value').textContent = rd.multiplier;

    // Input labels
    document.getElementById('input-emoji-1').textContent = rd.context.item1Emoji;
    document.getElementById('input-emoji-2').textContent = rd.context.item2Emoji;
    document.getElementById('input-item1').textContent = rd.context.item1Name;
    document.getElementById('input-item2').textContent = rd.context.item2Name;

    // Clear inputs
    document.getElementById('input-a').value = '';
    document.getElementById('input-b').value = '';
    document.getElementById('btn-submit').disabled = false;
  }

  // Update progress bar (round = rounds COMPLETED, starts at 0)
  progressBar.update(gameState.currentRound, gameState.lives);
}
```

### handleTypeAAnswer(sameChosen)

```javascript
async function handleTypeAAnswer(sameChosen) {
  if (gameState.isProcessing || gameState.gameEnded) return;
  gameState.isProcessing = true;

  const rd = gameState.roundData;
  const correct = (sameChosen === rd.isEquivalent);

  // Disable buttons
  document.getElementById('btn-same-ratio').disabled = true;
  document.getElementById('btn-diff-ratio').disabled = true;

  // Record attempt (PART-009)
  gameState.attempts.push({
    round: gameState.currentRound,
    roundType: 'typeA',
    userAnswer: sameChosen ? 'same' : 'different',
    correctAnswer: rd.isEquivalent ? 'same' : 'different',
    isCorrect: correct,
    timestamp: Date.now()
  });

  if (correct) {
    await FeedbackManager.sound.play('correct_tap', {
      subtitle: 'Correct!',
      sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
    });
    await FeedbackManager.playDynamicFeedback({
      audio_content: rd.feedbackCorrect,
      subtitle: rd.feedbackCorrect
    });
    gameState.score++;
  } else {
    await FeedbackManager.sound.play('wrong_tap', {
      subtitle: 'Not quite!',
      sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif'
    });
    await FeedbackManager.playDynamicFeedback({
      audio_content: rd.feedbackWrong,
      subtitle: rd.feedbackWrong
    });
    gameState.lives--;
  }

  // Track event (PART-010)
  gameState.events.push({ type: 'type_a_answer', round: gameState.currentRound, correct, timestamp: Date.now() });

  if (gameState.lives <= 0) {
    await handleGameOver();
  } else {
    nextRound();
  }

  gameState.isProcessing = false;
}
```

### handleTypeBSubmit()

```javascript
async function handleTypeBSubmit() {
  if (gameState.isProcessing || gameState.gameEnded) return;
  gameState.isProcessing = true;

  const rd = gameState.roundData;
  const inputA = parseInt(document.getElementById('input-a').value);
  const inputB = parseInt(document.getElementById('input-b').value);

  // Validate non-empty
  if (isNaN(inputA) || isNaN(inputB)) {
    document.getElementById('feedback-area').style.display = '';
    document.getElementById('feedback-text').textContent = 'Please fill in both fields.';
    gameState.isProcessing = false;
    return;
  }

  const aCorrect = (inputA === rd.correctAnswer.a);
  const bCorrect = (inputB === rd.correctAnswer.b);

  // Record attempt (PART-009)
  gameState.attempts.push({
    round: gameState.currentRound,
    roundType: 'typeB',
    userAnswer: { a: inputA, b: inputB },
    correctAnswer: rd.correctAnswer,
    aCorrect,
    bCorrect,
    isCorrect: aCorrect && bCorrect,
    timestamp: Date.now()
  });

  if (aCorrect && bCorrect) {
    // Both correct
    document.getElementById('btn-submit').disabled = true;
    await FeedbackManager.sound.play('correct_tap', {
      subtitle: 'Perfect!',
      sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif'
    });
    await FeedbackManager.playDynamicFeedback({
      audio_content: rd.feedbackCorrect,
      subtitle: rd.feedbackCorrect
    });
    gameState.score++;
    gameState.events.push({ type: 'type_b_submit', round: gameState.currentRound, result: 'correct', timestamp: Date.now() });
    gameState.isProcessing = false;
    nextRound();
  } else if (aCorrect || bCorrect) {
    // Partial — one correct, one wrong
    const partialMsg = aCorrect
      ? 'First number correct! Check the second.'
      : 'Second number correct! Check the first.';
    await FeedbackManager.sound.play('partial_correct_attempt1', {
      subtitle: partialMsg,
      sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-51.gif'
    });
    gameState.events.push({ type: 'type_b_submit', round: gameState.currentRound, result: 'partial', timestamp: Date.now() });

    // Clear the wrong field, keep the correct one
    if (!aCorrect) document.getElementById('input-a').value = '';
    if (!bCorrect) document.getElementById('input-b').value = '';

    // Show feedback hint
    document.getElementById('feedback-area').style.display = '';
    document.getElementById('feedback-text').textContent = partialMsg;

    // Allow retry — do NOT call nextRound, do NOT lose a life
    gameState.isProcessing = false;
    return;
  } else {
    // Both wrong
    document.getElementById('btn-submit').disabled = true;
    await FeedbackManager.sound.play('wrong_tap', {
      subtitle: 'Not quite!',
      sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif'
    });
    await FeedbackManager.playDynamicFeedback({
      audio_content: rd.feedbackWrong,
      subtitle: rd.feedbackWrong
    });
    gameState.lives--;
    gameState.events.push({ type: 'type_b_submit', round: gameState.currentRound, result: 'incorrect', timestamp: Date.now() });

    if (gameState.lives <= 0) {
      gameState.isProcessing = false;
      await handleGameOver();
    } else {
      gameState.isProcessing = false;
      nextRound();
    }
  }
}
```

### nextRound()

```javascript
function nextRound() {
  gameState.currentRound++;
  progressBar.update(gameState.currentRound, gameState.lives);
  gameState.events.push({ type: 'round_complete', round: gameState.currentRound - 1, timestamp: Date.now() });

  // Check stage transitions
  const prevStage = gameState.content.rounds[gameState.currentRound - 1]?.stage;
  const nextStage = gameState.content.rounds[gameState.currentRound]?.stage;

  if (gameState.currentRound >= gameState.totalRounds) {
    endGame();
    return;
  }

  if (prevStage && nextStage && prevStage !== nextStage) {
    // Show stage transition screen
    const stageNames = { 1: 'Easy', 2: 'Mixed', 3: 'Hard' };
    transitionScreen.show('stage-transition', {
      title: 'Stage ' + nextStage + ': ' + stageNames[nextStage],
      subtitle: 'Get ready!',
      callback: () => setupRound()
    });
  } else {
    setupRound();
  }
}
```

### handleGameOver()

```javascript
async function handleGameOver() {
  gameState.gameEnded = true;
  gameState.phase = 'gameover';

  await FeedbackManager.playDynamicFeedback({
    audio_content: 'Oh no! All lives lost!',
    subtitle: 'Game Over'
  });

  transitionScreen.show('game-over', {
    title: 'Game Over',
    subtitle: 'You scored ' + gameState.score + ' out of ' + gameState.totalRounds,
    callback: () => showResults()
  });
}
```

### endGame()

```javascript
async function endGame() {
  gameState.gameEnded = true;
  gameState.phase = 'results';

  const accuracy = gameState.score / gameState.totalRounds;
  let stars = 0;
  if (accuracy >= 0.8) stars = 3;
  else if (accuracy >= 0.5) stars = 2;
  else if (accuracy > 0) stars = 1;

  gameState.stars = stars;

  await FeedbackManager.playDynamicFeedback({
    audio_content: 'Great job! You scored ' + gameState.score + ' out of ' + gameState.totalRounds + '!',
    subtitle: 'Well done!',
    sticker: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json'
  });

  // Seal SignalCollector — fires sendBeacon to flush all events to GCS, stops flush timer, detaches listeners (PART-010)
  if (signalCollector) signalCollector.seal();

  transitionScreen.show('victory', {
    title: 'Victory!',
    subtitle: stars + ' Stars!',
    callback: () => showResults()
  });

  // Post metrics (PART-008) — signal data streamed to GCS via batch flushing, NOT included in postMessage
  window.parent.postMessage({
    type: 'GAME_COMPLETE',
    payload: {
      gameId: gameState.gameId,
      score: gameState.score,
      totalRounds: gameState.totalRounds,
      stars: stars,
      accuracy: Math.round(accuracy * 100),
      lives: gameState.lives,
      attempts: gameState.attempts,
      events: gameState.events,
      duration: Date.now() - gameState.startTime
    }
  }, '*');
}
```

### showResults()

```javascript
function showResults() {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = '';

  const accuracy = Math.round((gameState.score / gameState.totalRounds) * 100);
  document.getElementById('result-score').textContent = gameState.score + '/' + gameState.totalRounds;
  document.getElementById('result-lives').textContent = gameState.lives;
  document.getElementById('result-accuracy').textContent = accuracy + '%';

  // Render stars
  const starsDisplay = document.getElementById('stars-display');
  starsDisplay.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('span');
    star.className = i < gameState.stars ? 'star filled' : 'star empty';
    star.textContent = i < gameState.stars ? '★' : '☆';
    starsDisplay.appendChild(star);
  }
}
```

### restartGame()

```javascript
function restartGame() {
  // Full reset
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.attempts = [];
  gameState.events = [];
  gameState.gameEnded = false;
  gameState.isActive = false;
  gameState.isProcessing = false;
  gameState.phase = 'start';
  gameState.roundData = null;
  gameState.currentStage = 1;
  gameState.startTime = null;

  // Recreate SignalCollector (endGame destroyed it via seal)
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    gameId: gameState.gameId || null,
    contentSetId: gameState.contentSetId || null
  });
  window.signalCollector = signalCollector;

  // Hide results, show start transition
  document.getElementById('results-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = '';

  transitionScreen.show('start', {
    title: 'Match Up!',
    subtitle: 'Compare ratios and make them match!',
    callback: () => startGame()
  });
}
```

---

## 10. Feedback Integration

### Audio Preload

```
correct_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3
wrong_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3
partial_correct_attempt1: https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/45389c85-82d1-47af-ab9c-37327f9df527.mp3
```

Note: `partial_correct_attempt1` is needed for Type B rounds where one field is correct but the other isn't.

### Stickers

```
correct: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif (IMAGE_GIF)
incorrect: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif (IMAGE_GIF)
partial_correct: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-51.gif (IMAGE_GIF)
trophy: https://cdn.mathai.ai/mathai-assets/lottie/trophy.json (Lottie)
```

### Audio Flow

**Type A (Same/Different):**
- Correct: `await FeedbackManager.sound.play('correct_tap', { subtitle, sticker: correct })` → then `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackCorrect, subtitle: roundData.feedbackCorrect })`
- Wrong: `await FeedbackManager.sound.play('wrong_tap', { subtitle, sticker: incorrect })` → then `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackWrong, subtitle: roundData.feedbackWrong })`

**Type B (Make It Match):**
- Both correct: `await FeedbackManager.sound.play('correct_tap', { subtitle, sticker: correct })` → then `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackCorrect, subtitle: roundData.feedbackCorrect })`
- Partial (one field correct): `await FeedbackManager.sound.play('partial_correct_attempt1', { subtitle: partialMsg, sticker: partial_correct })` — no dynamic TTS, allow retry
- Both wrong: `await FeedbackManager.sound.play('wrong_tap', { subtitle, sticker: incorrect })` → then `await FeedbackManager.playDynamicFeedback({ audio_content: roundData.feedbackWrong, subtitle: roundData.feedbackWrong })`

**End game:** `await FeedbackManager.playDynamicFeedback({ audio_content: scoreMsg, subtitle: 'Well done!', sticker: trophy })`

**IMPORTANT:** Use `FeedbackManager.playDynamicFeedback()` for TTS — NOT `FeedbackManager.sound.play('dynamic', ...)`. See PART-026 anti-patterns.

---

## 11. Audio Sequence Table

| # | Moment | Trigger | Audio Type | Content / Sound ID | Await? | Notes |
|---|--------|---------|------------|-------------------|--------|-------|
| 1 | Type A correct | handleTypeAAnswer (correct) | Static | correct_tap | Awaited | With correct sticker + subtitle |
| 2 | Type A explanation | handleTypeAAnswer (after #1) | Dynamic TTS | Multiplicative link explanation | Awaited | Sequential after #1 |
| 3 | Type A wrong | handleTypeAAnswer (wrong) | Static | wrong_tap | Awaited | With incorrect sticker |
| 4 | Type A wrong explanation | handleTypeAAnswer (after #3) | Dynamic TTS | Mismatch explanation | Awaited | Sequential after #3 |
| 5 | Type B all correct | handleTypeBSubmit (both correct) | Static | correct_tap | Awaited | With correct sticker |
| 6 | Type B correct explanation | handleTypeBSubmit (after #5) | Dynamic TTS | Multiplication confirmation | Awaited | Sequential after #5 |
| 7 | Type B partial | handleTypeBSubmit (one correct) | Static | partial_correct_attempt1 | Awaited | With partial_correct sticker |
| 8 | Type B both wrong | handleTypeBSubmit (both wrong) | Static | wrong_tap | Awaited | With incorrect sticker |
| 9 | Type B wrong explanation | handleTypeBSubmit (after #8) | Dynamic TTS | Additive trap hint | Awaited | Sequential after #8 |
| 10 | End game | endGame | Dynamic TTS | Score summary | Awaited | With trophy sticker |

---

## 12. Review Findings

### Warning — Completeness — No audio URLs or sticker URLs specified

**What the spec says:** Voice-Over Strategy describes feedback text but no audio implementation details.

**Problem:** The pipeline cannot generate audio feedback without knowing which PART-017 sound IDs to preload and play. Voice-over text is described but not mapped to `sound.play()` or `playDynamicFeedback()`.

**Suggested fix:** Added Feedback Integration section with PART-017 standard audio URLs, sticker URLs, and audio flow per round type. (RESOLVED)

### Warning — Completeness — No input schema defined

**What the spec says:** Game Structure table lists rounds, lives, stages, but no parameterized content structure.

**Problem:** The pipeline cannot generate content sets without knowing the exact JSON shape the game expects.

**Suggested fix:** Added Input Schema section with full JSON schema definition. (RESOLVED)

### Warning — Completeness — No content set generation guidance

**What the spec says:** Stage Breakdown table shows difficulty progression but no content generation instructions.

**Problem:** Content generator doesn't know what dimensions to vary or what constraints to enforce across difficulty levels.

**Suggested fix:** Added Content Set Generation Guide with specific parameters per difficulty. (RESOLVED)

### Info — Interaction — Type B partial credit feedback unclear

**What the spec says:** "Validates each field independently — can get partial credit feedback"

**Problem:** The spec mentions partial credit but doesn't define exactly what happens: does the kid get another attempt? Does it cost a life? Is it the same round or next?

**Suggested fix:** Clarified: on partial correct (one field right, one wrong), the kid sees which field was correct, gets the partial_correct sound+sticker, and must re-enter both fields. This counts as one attempt. If wrong on retry, it costs a life and moves to next round. (RESOLVED)

### Info — API Usage — Dynamic audio API

**What the spec says:** N/A (preventive note).

**Problem:** Common mistake is to use `FeedbackManager.sound.play('dynamic', { text })` which does not work. The correct API is `FeedbackManager.playDynamicFeedback({ audio_content, subtitle, sticker })`.

**Resolution:** All function specs in Section 9 use the correct `playDynamicFeedback()` API. (RESOLVED)
