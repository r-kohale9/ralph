# Scale It Up — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Scale It Up
- **Game ID:** scale-it-up
- **Type:** standard
- **Description:** Ratio intuition game for Grade 5 (Skills 3-5). Kid sees a real-world ratio, then predicts what happens when quantities change. Type A rounds: fill in the missing value when a ratio is scaled up. Type B rounds: judge whether a changed scenario keeps or breaks the outcome, then identify what changed. 10 rounds, 3 lives, 3 stages. Progresses from simple ×2/×3 scaling to additive traps and subtle proportional breaks.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                    |
| -------- | ----------------------------- | --------------- | --------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                               |
| PART-002 | Package Scripts               | YES             | —                                                               |
| PART-003 | waitForPackages               | YES             | —                                                               |
| PART-004 | Initialization Block          | YES             | —                                                               |
| PART-005 | VisibilityTracker             | YES             | Default popupProps                                              |
| PART-006 | TimerComponent                | NO              | No timer — self-paced                                           |
| PART-007 | Game State Object             | YES             | Custom: lives, totalLives, roundType, stage, selectedFollowUp  |
| PART-008 | PostMessage Protocol          | YES             | —                                                               |
| PART-009 | Attempt Tracking              | YES             | —                                                               |
| PART-010 | Event Tracking & SignalCollector | YES           | Custom events: answer_correct, answer_wrong, life_lost, stage_change, followup_select |
| PART-011 | End Game & Metrics            | YES             | Stars: 9-10=3, 6-8=2, 1-5=1                                   |
| PART-012 | Debug Functions               | YES             | —                                                               |
| PART-013 | Validation Fixed              | YES             | Type B: "same" or "different" answer                            |
| PART-014 | Validation Function           | YES             | Type A: missing value = base component × multiplier             |
| PART-015 | Validation LLM                | NO              | —                                                               |
| PART-016 | StoriesComponent              | NO              | —                                                               |
| PART-017 | Feedback Integration          | YES             | Audio + subtitle on correct/incorrect                           |
| PART-018 | Case Converter                | NO              | —                                                               |
| PART-019 | Results Screen UI             | YES             | Custom: Lives Left metric row                                   |
| PART-020 | CSS Variables & Colors        | YES             | —                                                               |
| PART-021 | Screen Layout CSS             | YES             | —                                                               |
| PART-022 | Game Buttons                  | YES             | Type A: submit/retry/next. Type B: same/different + follow-up   |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 10, totalLives: 3                                  |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over, level (stage 2, stage 3)   |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                  |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating                     |
| PART-027 | Play Area Construction        | YES             | Layout: scenario cards + input field (A) / choice buttons (B)   |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with type/context/ratio data                |
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
  gameId: 'scale-it-up',
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
  lives: 3,                // Current remaining lives
  totalLives: 3,           // Starting lives (for metrics)
  roundType: null,          // "A" or "B" — current round type
  stage: 1,                 // 1=Easy scaling, 2=Traps + mixed, 3=Full prediction
  typeBPhase: null,          // null | "choice" | "followup" — tracks Type B multi-step
  selectedFollowUp: null,   // Which follow-up option was picked in Type B
  pendingEndProblem: null,   // Deferred SignalCollector endProblem
  sessionHistory: []        // For multi-session tracking
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
          "skill": { "type": "integer", "enum": [3, 4, 5] },
          "context": { "type": "string", "description": "Real-world scenario name" },
          "emoji1": { "type": "string" },
          "emoji2": { "type": "string" },
          "thing1": { "type": "string", "description": "Name of first quantity" },
          "thing2": { "type": "string", "description": "Name of second quantity" },
          "baseRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2,
            "description": "[a, b] — the original ratio"
          },
          "multiplier": {
            "type": "integer",
            "description": "Type A: how many times the ratio is scaled"
          },
          "missingPosition": {
            "type": "string",
            "enum": ["first", "second"],
            "description": "Type A only — which value is hidden in the scaled scenario"
          },
          "scenarioA": {
            "type": "string",
            "description": "Natural-language description of the first scene"
          },
          "scenarioB": {
            "type": "string",
            "description": "Natural-language description of the second scene"
          },
          "correctAnswer": {
            "type": "string",
            "description": "Type B only: 'same' or 'different'"
          },
          "changedRatio": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 2,
            "maxItems": 2,
            "description": "Type B only — the ratio in Scene B (may or may not match)"
          },
          "followUpOptions": {
            "type": "array",
            "description": "Type B (different only) — 2 explanations for what changed",
            "items": {
              "type": "object",
              "properties": {
                "text": { "type": "string" },
                "correct": { "type": "boolean" }
              }
            }
          },
          "trapType": {
            "type": "string",
            "enum": ["none", "additive", "one-side", "both-changed"],
            "description": "Which distractor pattern is used (for analytics)"
          },
          "voiceOver": {
            "type": "object",
            "properties": {
              "correct": { "type": "string" },
              "incorrect": { "type": "string" }
            }
          }
        },
        "required": ["type", "skill", "context", "emoji1", "emoji2", "thing1", "thing2", "baseRatio", "scenarioA", "scenarioB"]
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
    // --- Stage 1: Easy scaling (Rounds 1-3) — Type A only, ×2/×3, ratios with 1 ---
    {
      type: "A", skill: 3,
      context: "Mom's Chai",
      emoji1: "\ud83c\udf75", emoji2: "\ud83e\uddca",
      thing1: "spoons of tea", thing2: "spoons of sugar",
      baseRatio: [2, 1],
      multiplier: 3,
      missingPosition: "second",
      scenarioA: "Mom's chai recipe: 2 spoons of tea and 1 spoon of sugar.",
      scenarioB: "Bigger pot: 6 spoons of tea and ___ spoons of sugar?",
      voiceOver: {
        correct: "That's right! 2 tea to 1 sugar — tripled it means 6 tea to 3 sugar.",
        incorrect: "The recipe is 2 tea to 1 sugar. If tea tripled to 6, sugar triples too: 1\u00d73 = 3."
      }
    },
    {
      type: "A", skill: 3,
      context: "Building Blocks",
      emoji1: "\ud83d\udfe5", emoji2: "\ud83d\udfe6",
      thing1: "red blocks", thing2: "blue blocks",
      baseRatio: [3, 1],
      multiplier: 2,
      missingPosition: "second",
      scenarioA: "Tower pattern: 3 red blocks for every 1 blue block.",
      scenarioB: "Bigger tower: 6 red blocks and ___ blue blocks?",
      voiceOver: {
        correct: "Yes! For every 3 red, 1 blue. Doubled: 6 red, 2 blue.",
        incorrect: "3 red to 1 blue. Red doubled to 6, so blue doubles too: 1\u00d72 = 2."
      }
    },
    {
      type: "A", skill: 5,
      context: "Flower Garden",
      emoji1: "\ud83c\udf37", emoji2: "\ud83c\udf3b",
      thing1: "tulips", thing2: "sunflowers",
      baseRatio: [1, 4],
      multiplier: 3,
      missingPosition: "first",
      scenarioA: "Garden row: 1 tulip for every 4 sunflowers.",
      scenarioB: "Bigger garden: ___ tulips and 12 sunflowers?",
      voiceOver: {
        correct: "Perfect! 4 sunflowers tripled to 12, so 1 tulip triples to 3.",
        incorrect: "Sunflowers went from 4 to 12 — that's \u00d73. So tulips: 1\u00d73 = 3."
      }
    },
    // --- Stage 2: Traps + mixed (Rounds 4-7) — A + B, larger multipliers, additive traps ---
    {
      type: "B", skill: 4,
      context: "Park Animals",
      emoji1: "\ud83d\udc26", emoji2: "\ud83d\udc3f\ufe0f",
      thing1: "birds", thing2: "squirrels",
      baseRatio: [3, 1],
      changedRatio: [5, 3],
      correctAnswer: "different",
      scenarioA: "Small park bench: 3 birds and 1 squirrel.",
      scenarioB: "Big park: 5 birds and 3 squirrels.",
      trapType: "additive",
      followUpOptions: [
        { text: "Too many squirrels compared to birds", correct: true },
        { text: "Not enough animals total", correct: false }
      ],
      voiceOver: {
        correct: "Good eye! Both had 2 more birds than squirrels, but the 'for every' rule changed from 3:1 to 5:3.",
        incorrect: "The difference is still 2 more birds — but the ratio changed! Small park was 3 birds per squirrel, big park is different."
      }
    },
    {
      type: "A", skill: 3,
      context: "Rice and Dal",
      emoji1: "\ud83c\udf5a", emoji2: "\ud83e\uded8",
      thing1: "jars of rice", thing2: "jars of dal",
      baseRatio: [2, 3],
      multiplier: 3,
      missingPosition: "second",
      scenarioA: "Kitchen shelf: 2 jars of rice for every 3 jars of dal.",
      scenarioB: "Bigger kitchen: 6 jars of rice and ___ jars of dal?",
      voiceOver: {
        correct: "Right! 2 rice to 3 dal — tripled: 6 rice and 9 dal.",
        incorrect: "Rice tripled from 2 to 6. So dal triples too: 3\u00d73 = 9."
      }
    },
    {
      type: "B", skill: 4,
      context: "Bead Necklace",
      emoji1: "\ud83d\udfe1", emoji2: "\u26ab",
      thing1: "gold beads", thing2: "black beads",
      baseRatio: [2, 1],
      changedRatio: [4, 3],
      correctAnswer: "different",
      scenarioA: "Bracelet pattern: 2 gold beads for every 1 black bead.",
      scenarioB: "Necklace: 4 gold beads and 3 black beads.",
      trapType: "additive",
      followUpOptions: [
        { text: "Too many black beads for the gold ones", correct: true },
        { text: "Not enough beads in total", correct: false }
      ],
      voiceOver: {
        correct: "Both had 1 more gold than black. But the bracelet was 2:1 and the necklace is 4:3 — different rule!",
        incorrect: "Same difference (1 more gold), but the 'for every' pattern changed. Bracelet: 2 gold per 1 black. Necklace doesn't match."
      }
    },
    {
      type: "A", skill: 5,
      context: "Classroom Setup",
      emoji1: "\ud83e\udea8", emoji2: "\ud83e\ude91",
      thing1: "tables", thing2: "chairs",
      baseRatio: [1, 4],
      multiplier: 4,
      missingPosition: "second",
      scenarioA: "Small classroom: 1 table for every 4 chairs.",
      scenarioB: "Big classroom: 4 tables and ___ chairs?",
      voiceOver: {
        correct: "Yes! 1 table to 4 chairs — four times bigger: 4 tables and 16 chairs.",
        incorrect: "Tables went from 1 to 4 — that's \u00d74. So chairs: 4\u00d74 = 16."
      }
    },
    // --- Stage 3: Full prediction (Rounds 8-10) — A + B, subtle traps ---
    {
      type: "A", skill: 5,
      context: "Lemonade Stand",
      emoji1: "\ud83c\udf4b", emoji2: "\ud83d\udca7",
      thing1: "spoons of sugar", thing2: "cups of water",
      baseRatio: [2, 5],
      multiplier: 3,
      missingPosition: "first",
      scenarioA: "Lemonade recipe: 2 spoons of sugar for every 5 cups of water.",
      scenarioB: "Big batch: ___ spoons of sugar for 15 cups of water?",
      voiceOver: {
        correct: "Perfect! Water tripled from 5 to 15, so sugar triples: 2\u00d73 = 6.",
        incorrect: "5 cups became 15 cups — that's \u00d73. So sugar: 2\u00d73 = 6 spoons."
      }
    },
    {
      type: "B", skill: 4,
      context: "Paint Mixing",
      emoji1: "\u2b1c", emoji2: "\ud83d\udfe6",
      thing1: "white scoops", thing2: "blue scoops",
      baseRatio: [1, 3],
      changedRatio: [2, 4],
      correctAnswer: "different",
      scenarioA: "Sky-blue paint: 1 white scoop for every 3 blue scoops.",
      scenarioB: "Ava's mix: 2 white scoops and 4 blue scoops.",
      trapType: "both-changed",
      followUpOptions: [
        { text: "Too much white paint — it would be lighter", correct: true },
        { text: "Not enough paint to fill the bucket", correct: false }
      ],
      voiceOver: {
        correct: "Both sides changed, but not by the same amount! 1:3 doubled would be 2:6, not 2:4. Too much white!",
        incorrect: "If white doubled to 2, blue should double to 6. Ava only used 4 blue — the ratio broke."
      }
    },
    {
      type: "A", skill: 3,
      context: "Garden Planting",
      emoji1: "\ud83c\udf31", emoji2: "\ud83c\udf3a",
      thing1: "seedlings", thing2: "flowers",
      baseRatio: [3, 4],
      multiplier: 3,
      missingPosition: "second",
      scenarioA: "Garden plan: 3 seedlings for every 4 flowers.",
      scenarioB: "Bigger garden: 9 seedlings and ___ flowers?",
      voiceOver: {
        correct: "Yes! 3 seedlings to 4 flowers — tripled: 9 seedlings and 12 flowers.",
        incorrect: "Seedlings tripled from 3 to 9. So flowers triple too: 4\u00d73 = 12."
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

    <!-- Scenario A Card (always shown) -->
    <div class="scenario-card scenario-a" id="scenario-a-card">
      <div class="scenario-header">
        <span class="scenario-tag">Original</span>
        <span class="scenario-context" id="scenario-context"></span>
      </div>
      <p class="scenario-text" id="scenario-a-text"></p>
      <div class="ratio-display" id="ratio-display-a">
        <span class="ratio-item"><span id="ratio-a-num1" class="ratio-number">2</span> <span id="ratio-a-emoji1"></span> <span id="ratio-a-thing1" class="ratio-thing"></span></span>
        <span class="ratio-separator">for every</span>
        <span class="ratio-item"><span id="ratio-a-num2" class="ratio-number">1</span> <span id="ratio-a-emoji2"></span> <span id="ratio-a-thing2" class="ratio-thing"></span></span>
      </div>
    </div>

    <!-- Scenario B Card (always shown) -->
    <div class="scenario-card scenario-b" id="scenario-b-card">
      <div class="scenario-header">
        <span class="scenario-tag tag-b">Scaled Up</span>
      </div>
      <p class="scenario-text" id="scenario-b-text"></p>
    </div>

    <!-- Type A: Number Input Area -->
    <div class="type-a-input hidden" id="type-a-input">
      <div class="input-prompt" id="input-prompt">What's the missing number?</div>
      <div class="input-row single-input">
        <div class="input-group">
          <input type="number" class="game-input" id="input-a-field" data-signal-id="input-a-field" placeholder="?" inputmode="numeric" min="1" max="50" />
        </div>
      </div>
    </div>

    <!-- Type B: Follow-up Options (shown after "Different" is chosen correctly) -->
    <div class="followup-area hidden" id="followup-area">
      <p class="followup-prompt">What changed?</p>
      <div class="followup-options" id="followup-options">
        <button class="followup-btn" id="followup-0" data-signal-id="followup-0" onclick="handleFollowUpSelect(0)"></button>
        <button class="followup-btn" id="followup-1" data-signal-id="followup-1" onclick="handleFollowUpSelect(1)"></button>
      </div>
    </div>

    <!-- Feedback Section (shared) -->
    <div class="feedback-section hidden" id="feedback-area">
      <p id="feedback-text" class="feedback-text"></p>
    </div>
  </div>

  <!-- Type A Buttons (input-based) -->
  <div class="btn-container hidden" id="type-a-buttons">
    <button class="game-btn btn-secondary" id="btn-reset" data-signal-id="btn-reset" onclick="resetInputs()">Reset</button>
    <button class="game-btn btn-primary" id="btn-submit" data-signal-id="btn-submit" onclick="handleTypeASubmit()">Submit</button>
    <button class="game-btn btn-secondary hidden" id="btn-retry" data-signal-id="btn-retry" onclick="handleRetry()">Retry</button>
    <button class="game-btn btn-primary hidden" id="btn-next" data-signal-id="btn-next" onclick="nextRound()">Next</button>
  </div>

  <!-- Type B Buttons (same/different choice) -->
  <div class="btn-container hidden" id="type-b-buttons">
    <button class="game-btn btn-same" id="btn-same" data-signal-id="btn-same" onclick="handleTypeBAnswer('same')">Same outcome</button>
    <button class="game-btn btn-different" id="btn-different" data-signal-id="btn-different" onclick="handleTypeBAnswer('different')">Different outcome</button>
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
  gap: 14px;
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

/* === Scenario Cards === */
.scenario-card {
  background: var(--mathai-white);
  border-radius: var(--mathai-border-radius-card);
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.scenario-a {
  border: 2px solid var(--mathai-purple);
}

.scenario-b {
  border: 2px solid var(--mathai-orange);
}

.scenario-b.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
}

.scenario-b.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
}

.scenario-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.scenario-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--mathai-purple);
  background: #F3ECFF;
  padding: 3px 10px;
  border-radius: 12px;
}

.scenario-tag.tag-b {
  color: var(--mathai-orange);
  background: #FFF5EB;
}

.scenario-context {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  font-weight: 500;
}

.scenario-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
  line-height: 1.5;
  text-align: center;
}

/* === Ratio Display (inside Scenario A) === */
.ratio-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: #F9F5FF;
  border-radius: 12px;
}

.ratio-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--mathai-font-size-body);
  font-weight: 500;
}

.ratio-number {
  font-size: 22px;
  font-weight: 700;
  color: var(--mathai-purple);
}

.ratio-separator {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  font-style: italic;
}

.ratio-thing {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
}

/* === Type A: Number Input === */
.type-a-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.input-prompt {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-text-primary);
  text-align: center;
}

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

/* === Follow-Up Area (Type B) === */
.followup-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: fadeIn 0.3s ease;
}

.followup-prompt {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-text-primary);
}

.followup-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 360px;
}

.followup-btn {
  padding: 14px 20px;
  font-size: var(--mathai-font-size-body);
  font-weight: 500;
  font-family: var(--mathai-font-family);
  text-align: left;
  background: var(--mathai-white);
  border: 2px solid var(--mathai-border-gray);
  border-radius: var(--mathai-border-radius-card);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-text-primary);
  line-height: 1.4;
}

.followup-btn:hover:not(:disabled) {
  border-color: var(--mathai-purple);
  background: #F9F5FF;
}

.followup-btn.selected {
  border-color: var(--mathai-purple);
  background: #F3ECFF;
  font-weight: 600;
}

.followup-btn.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
}

.followup-btn.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
}

.followup-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
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
  background: var(--mathai-orange);
  flex: 1;
  max-width: 200px;
}
.btn-different:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(242, 153, 74, 0.4);
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
   - Show start TransitionScreen: title="Scale It Up!", subtitle="Can you predict what happens when ratios grow?", button="Let's go!"
   - On button click -> `startPlaying()`

3. **startPlaying()** runs:
   - `transitionScreen.hide()`
   - Show `#game-screen`
   - `renderRound()`

4. **renderRound()** runs:
   - Flush deferred `pendingEndProblem`
   - Get current round data from content
   - Determine stage: rounds 0-2 = Easy, 3-6 = Traps + mixed, 7-9 = Full prediction
   - If stage changed, show level transition screen (auto-dismiss 2s)
   - Update round label and stage badge
   - Start SignalCollector problem
   - Populate Scenario A card: context, text, ratio display
   - Populate Scenario B card: text
   - Reset scenario-b-card classes (remove correct/incorrect)
   - If `type === "A"` -> show `#type-a-input` + `#type-a-buttons`, hide `#type-b-buttons`
   - If `type === "B"` -> hide `#type-a-input`, show `#type-b-buttons`, hide `#type-a-buttons`
   - Hide `#followup-area` and `#feedback-area`
   - RecordViewEvent

5. **Type A interaction (Fill the blank):**
   - Kid sees scenario A (ratio) + scenario B (scaled, with blank)
   - Kid types the missing number, clicks Submit -> `handleTypeASubmit()`
   - Compute correct answer based on `missingPosition` and `multiplier`
   - If correct: green highlight on input + scenario B card, score++, show Next
   - If incorrect: red highlight, lives--, show Retry (or endGame if lives=0)
   - Record attempt + defer endProblem

6. **Type B interaction (Will it work? — two phases):**
   - **Phase 1 (choice):** Kid sees scenario A + scenario B, taps "Same outcome" or "Different outcome" -> `handleTypeBAnswer(answer)`
   - If answer is "same" AND correct: green highlight on scenario B, show feedback, score++, auto-advance 1.5s
   - If answer is "different" AND correct: show `#followup-area` with 2 options -> enter Phase 2
   - If answer is wrong: red highlight, lives--, show feedback, auto-advance 1.5s (or endGame)
   - **Phase 2 (follow-up):** Kid clicks a follow-up option -> `handleFollowUpSelect(index)`
   - The follow-up is NOT scored (it's explanatory, not penalized). After selecting, show feedback + auto-advance.
   - Record attempt for Phase 1 result + defer endProblem

7. **End conditions — EVERY path that calls endGame():**
   - **All 10 rounds completed** -> `nextRound()` calls `endGame()` when `currentRound >= totalRounds`
   - **All lives lost** -> `handleTypeASubmit()` or `handleTypeBAnswer()` calls `endGame()` when `lives <= 0`
   - `endGame()` calculates metrics, shows results/game-over TransitionScreen, sends postMessage, cleans up

---

## 9. Functions

### Global Scope (RULE-001)

**setupGame()**

- If `!gameState.content` -> `gameState.content = fallbackContent`
- Reset: `gameState.currentRound = 0`, `score = 0`, `lives = 3`, `stage = 1`, `attempts = []`, `events = []`, `pendingEndProblem = null`, `typeBPhase = null`, `selectedFollowUp = null`
- `gameState.startTime = Date.now()`
- `gameState.isActive = true`
- `gameState.duration_data.startTime = new Date().toISOString()`
- `progressBar.update(0, gameState.lives)`
- `trackEvent('game_start', 'game')`
- Show start transition:
  ```javascript
  transitionScreen.show({
    icons: ['\ud83d\udcc8'],
    iconSize: 'large',
    title: 'Scale It Up!',
    subtitle: 'Can you predict what happens when ratios grow?',
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
- `gameState.typeBPhase = null`
- `gameState.selectedFollowUp = null`
- Compute stage: `const newStage = gameState.currentRound < 3 ? 1 : gameState.currentRound < 7 ? 2 : 3`
- If `newStage !== gameState.stage`:
  ```javascript
  gameState.stage = newStage;
  const stageNames = { 1: 'Easy', 2: 'Traps', 3: 'Predict' };
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

- Update round label: `'Round ' + (gameState.currentRound + 1) + ' of ' + gameState.totalRounds`
- Update stage badge
- Start signalCollector problem:
  ```javascript
  if (signalCollector) {
    signalCollector.startProblem('round_' + gameState.currentRound, {
      type: roundData.type,
      skill: roundData.skill,
      context: roundData.context,
      baseRatio: roundData.baseRatio
    });
  }
  ```
- Populate Scenario A:
  - `scenario-context` = roundData.context
  - `scenario-a-text` = roundData.scenarioA
  - `ratio-a-num1` = baseRatio[0], `ratio-a-num2` = baseRatio[1]
  - `ratio-a-emoji1` = emoji1, `ratio-a-emoji2` = emoji2
  - `ratio-a-thing1` = thing1, `ratio-a-thing2` = thing2
- Populate Scenario B:
  - `scenario-b-text` = roundData.scenarioB
  - Remove correct/incorrect classes from `#scenario-b-card`
- Hide `#feedback-area`, `#followup-area`
- If `roundData.type === 'A'`:
  - Show `#type-a-input`, show `#type-a-buttons`
  - Hide `#type-b-buttons`
  - Clear input, remove classes, enable, focus
  - Show `#btn-submit` and `#btn-reset`, hide `#btn-retry` and `#btn-next`
- If `roundData.type === 'B'`:
  - Hide `#type-a-input`, hide `#type-a-buttons`
  - Show `#type-b-buttons`
  - Enable both Same/Different buttons
  - `gameState.typeBPhase = 'choice'`
- RecordViewEvent:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        round: gameState.currentRound,
        type: roundData.type,
        skill: roundData.skill,
        context: roundData.context,
        trigger: 'round_start'
      },
      components: {
        progress: { current: gameState.currentRound, total: gameState.totalRounds }
      }
    });
  }
  ```

**async handleTypeASubmit()**

- If `!gameState.isActive` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const val = parseInt(document.getElementById('input-a-field').value)`
- If `isNaN(val)`: show feedback "Type a number!" return
- Compute correct answer:
  ```javascript
  const correctVal = roundData.missingPosition === 'second'
    ? roundData.baseRatio[1] * roundData.multiplier
    : roundData.baseRatio[0] * roundData.multiplier;
  ```
- `const isCorrect = val === correctVal`
- Mark input with correct/incorrect class, disable it
- If correct:
  - `gameState.score++`
  - `document.getElementById('scenario-b-card').classList.add('correct')`
  - Show feedback: voiceOver.correct with `correct-text` class
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'A', val })`
  - Show `#btn-next`, hide `#btn-submit`, `#btn-reset`
  - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }`
- Else:
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - `document.getElementById('scenario-b-card').classList.add('incorrect')`
  - Show feedback: voiceOver.incorrect with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'A', val })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - If lives > 0: show `#btn-retry`, hide `#btn-submit`, `#btn-reset`. Else: hide all type-a-buttons.
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: val,
    correct: isCorrect,
    question: roundData.scenarioB,
    correctAnswer: correctVal,
    validationType: 'function'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)`

**async handleTypeBAnswer(answer)**

- If `!gameState.isActive || gameState.typeBPhase !== 'choice'` return
- Disable both Same/Different buttons
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = answer === roundData.correctAnswer`
- If correct:
  - `gameState.score++`
  - `document.getElementById('scenario-b-card').classList.add('correct')`
  - `trackEvent('answer_correct', 'game', { round: gameState.currentRound, type: 'B', answer })`
  - If answer is "different" AND `roundData.followUpOptions`:
    - `gameState.typeBPhase = 'followup'`
    - Show `#followup-area`
    - Populate followup buttons with `roundData.followUpOptions[0].text` and `[1].text`
    - Enable followup buttons, remove any selected/correct/incorrect classes
    - Hide `#type-b-buttons`
    - `try { await FeedbackManager.sound.play('correct_tap'); } catch(e) { ... }`
    - **return** (don't auto-advance — wait for follow-up)
  - Else (answer is "same" and correct):
    - Show feedback: voiceOver.correct with `correct-text` class
    - `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- Else (incorrect):
  - `gameState.lives--`
  - `progressBar.update(gameState.currentRound, gameState.lives)`
  - `document.getElementById('scenario-b-card').classList.add('incorrect')`
  - Show feedback: voiceOver.incorrect with `incorrect-text` class
  - `trackEvent('answer_wrong', 'game', { round: gameState.currentRound, type: 'B', answer })`
  - If `gameState.lives <= 0`: `trackEvent('life_lost', 'game', { livesRemaining: 0 })`
  - `try { await FeedbackManager.sound.play('wrong_tap', { subtitle: roundData.voiceOver.incorrect }); } catch(e) { ... }`
- Record attempt:
  ```javascript
  recordAttempt({
    userAnswer: answer,
    correct: isCorrect,
    question: 'Does "' + roundData.scenarioB + '" follow the same rule as "' + roundData.scenarioA + '"?',
    correctAnswer: roundData.correctAnswer,
    validationType: 'fixed'
  });
  ```
- Defer endProblem
- If `gameState.lives <= 0` -> `setTimeout(() => endGame(), 1500)` return
- `setTimeout(() => nextRound(), 1500)`

**async handleFollowUpSelect(index)**

- If `gameState.typeBPhase !== 'followup'` return
- `const roundData = gameState.content.rounds[gameState.currentRound]`
- `const option = roundData.followUpOptions[index]`
- `gameState.selectedFollowUp = index`
- Disable all followup buttons
- Mark selected button: `document.getElementById('followup-' + index).classList.add(option.correct ? 'correct' : 'incorrect')`
- If wrong, also highlight the correct one:
  ```javascript
  if (!option.correct) {
    const correctIdx = roundData.followUpOptions.findIndex(o => o.correct);
    document.getElementById('followup-' + correctIdx).classList.add('correct');
  }
  ```
- Show feedback: voiceOver.correct with `correct-text` class (follow-up is explanatory, not penalized)
- `trackEvent('followup_select', 'game', { round: gameState.currentRound, selected: index, correct: option.correct })`
- `try { await FeedbackManager.sound.play('correct_tap', { subtitle: roundData.voiceOver.correct }); } catch(e) { ... }`
- `setTimeout(() => nextRound(), 2000)`

**handleRetry()**

- Clear `#input-a-field`, remove correct/incorrect classes, enable it, focus
- Remove correct/incorrect from `#scenario-b-card`
- Hide `#feedback-area`
- Show `#btn-submit` and `#btn-reset`, hide `#btn-retry` and `#btn-next`
- `if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'retry', round: gameState.currentRound } })`

**resetInputs()**

- Clear `#input-a-field`, remove correct/incorrect classes, focus

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
  const stars = correct >= 9 ? 3 : correct >= 6 ? 2 : correct > 0 ? 1 : 0;
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
      gameId: 'scale-it-up',
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

| Event           | Target | When Fired                              | Data                                                  |
| --------------- | ------ | --------------------------------------- | ----------------------------------------------------- |
| answer_correct  | game   | User answers correctly (Type A or B)    | `{ round, type, val }` or `{ round, type, answer }`  |
| answer_wrong    | game   | User answers incorrectly                | `{ round, type, val/answer }`                         |
| life_lost       | game   | Lives reach 0                           | `{ livesRemaining: 0 }`                              |
| stage_change    | game   | Player enters new stage                 | `{ stage, name }`                                    |
| followup_select | game   | User picks follow-up explanation        | `{ round, selected, correct }`                       |

### SignalCollector Events

| Event              | Function              | Signal Type        | Content Snapshot Keys                              |
| ------------------ | --------------------- | ------------------ | -------------------------------------------------- |
| content_render     | renderRoundContent()  | recordViewEvent    | round, type, skill, context, trigger               |
| visual_update      | handleRetry()         | recordViewEvent    | type: 'retry', round                               |
| screen_transition  | showResults()         | recordViewEvent    | screen: 'results', metrics                         |
| visibility_hidden  | VisibilityTracker     | recordCustomEvent  | {}                                                 |
| visibility_visible | VisibilityTracker     | recordCustomEvent  | {}                                                 |

---

## 11. Scaffold Points

| Point            | Function              | When                        | What Can Be Injected                                    |
| ---------------- | --------------------- | --------------------------- | ------------------------------------------------------- |
| after_incorrect  | handleTypeASubmit()   | Type A wrong answer         | "Remember: multiply, don't add!" + step-by-step hint   |
| after_incorrect  | handleTypeBAnswer()   | Type B wrong answer         | Visual grouping animation showing the 'for every' rule  |
| before_round     | renderRound()         | New round starts            | Context preview, strategy tip                           |
| on_retry         | handleRetry()         | User retries Type A         | Worked example with arrows showing ×multiplier          |
| stage_transition | renderRound()         | Stage changes               | Stage goal + new mechanic introduction                  |
| on_followup      | handleFollowUpSelect()| User selects follow-up      | Extended explanation with visual breakdown               |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point has a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 12. Feedback Triggers

| Moment              | Trigger Function      | Feedback Type               | Notes                                |
| ------------------- | --------------------- | --------------------------- | ------------------------------------ |
| Correct answer (A)  | handleTypeASubmit()   | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Correct answer (B)  | handleTypeBAnswer()   | sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Incorrect answer (A)| handleTypeASubmit()   | sound + subtitle            | 'wrong_tap' + voiceOver.incorrect    |
| Incorrect answer (B)| handleTypeBAnswer()   | sound + subtitle            | 'wrong_tap' + voiceOver.incorrect    |
| Follow-up selected  | handleFollowUpSelect()| sound + subtitle            | 'correct_tap' + voiceOver.correct    |
| Game complete (3★)  | endGame()             | celebration transition      | Victory screen with stars            |
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
  - Primary: `--mathai-purple` (#9B51E0) — scenario A card accent, ratio numbers
  - Secondary: `--mathai-orange` (#F2994A) — scenario B card accent, "Different outcome" button
  - Success: `--mathai-green` (#219653) — correct feedback, "Same outcome" button, primary buttons
  - Error: `--mathai-red` (#E35757) — incorrect feedback
  - Info: `--mathai-blue` (#2563eb) — input focus, secondary buttons
  - Background: `--mathai-cream` (#FFF8F0)
  - Text: `--mathai-text-primary` (#4a4a4a)
- **Typography:** Inter, title 24px, body 16px, label 14px, ratio numbers 22px bold purple
- **Spacing:** Container padding 16px, card padding 16-20px, gap 14px
- **Interactive states:**
  - Buttons: hover lifts 2px with colored shadow, disabled 0.6 opacity
  - Input: focus blue border, correct green bg, incorrect red bg
  - Scenario B card: correct green border+bg, incorrect red border+bg
  - Follow-up options: hover purple border, selected purple bg, correct green, incorrect red
- **Transitions:** 0.2s ease for all interactions, 0.3s fadeIn for feedback/followup
- **Responsive:** Max-width 480px, cream background extends full screen behind

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers

```
SETUP: Page loaded, transition screen shown, click "Let's go!" button via TransitionScreen
ACTIONS:
  Round 1 (Type A, [2,1] x3, missing=second): type "3" in #input-a-field, click #btn-submit, click #btn-next
  Round 2 (Type A, [3,1] x2, missing=second): type "2" in #input-a-field, click #btn-submit, click #btn-next
  Round 3 (Type A, [1,4] x3, missing=first): type "3" in #input-a-field, click #btn-submit, click #btn-next
  --- stage transition 2s ---
  Round 4 (Type B, different): click #btn-different, click #followup-0, wait 2000ms
  Round 5 (Type A, [2,3] x3, missing=second): type "9" in #input-a-field, click #btn-submit, click #btn-next
  Round 6 (Type B, different): click #btn-different, click #followup-0, wait 2000ms
  Round 7 (Type A, [1,4] x4, missing=second): type "16" in #input-a-field, click #btn-submit, click #btn-next
  --- stage transition 2s ---
  Round 8 (Type A, [2,5] x3, missing=first): type "6" in #input-a-field, click #btn-submit, click #btn-next
  Round 9 (Type B, different): click #btn-different, click #followup-0, wait 2000ms
  Round 10 (Type A, [3,4] x3, missing=second): type "12" in #input-a-field, click #btn-submit, click #btn-next
ASSERT:
  gameState.score === 10
  Victory transition screen shown OR #results-screen is visible
  accuracy display shows "100%"
  stars display shows 3 stars
```

### Scenario: Type A — submit incorrect answer

```
SETUP: Page loaded, click "Let's go!", on Round 1 (Type A, [2,1] x3, missing=second, correct=3)
ACTIONS:
  type "5" in #input-a-field
  click #btn-submit
ASSERT:
  #input-a-field has .incorrect class
  #scenario-b-card has .incorrect class
  #feedback-area is visible
  #feedback-text has .incorrect-text class
  gameState.lives === 2
  gameState.attempts[0].correct === false
  #btn-retry is visible
  #btn-submit has .hidden class
  progressBar shows 2 lives remaining
```

### Scenario: Type A — retry after incorrect

```
SETUP: Continue from incorrect scenario above
ACTIONS:
  click #btn-retry
ASSERT:
  #input-a-field value is ""
  #input-a-field does NOT have .correct or .incorrect class
  #scenario-b-card does NOT have .correct or .incorrect class
  #feedback-area has .hidden class
  #btn-submit is visible
  #btn-retry has .hidden class
ACTIONS:
  type "3" in #input-a-field
  click #btn-submit
ASSERT:
  #input-a-field has .correct class
  #scenario-b-card has .correct class
  #btn-next is visible
```

### Scenario: Type B — answer "Same" correctly

```
SETUP: Page loaded, advance to a round where correctAnswer is "same" (modify fallback to include one)
NOTE: The fallback content has no "same" Type B rounds, so this tests with custom content.
This scenario verifies the "same" path works — auto-advance after 1.5s, no follow-up shown.
ACTIONS:
  click #btn-same
ASSERT:
  #scenario-b-card has .correct class
  #feedback-text has .correct-text class
  #followup-area has .hidden class
  gameState.score increased by 1
  auto-advances after 1500ms
```

### Scenario: Type B — answer "Different" correctly (with follow-up)

```
SETUP: Page loaded, advance to Round 4 (Type B, correctAnswer=different)
ACTIONS:
  click #btn-different
ASSERT:
  #scenario-b-card has .correct class
  #followup-area is visible (NOT hidden)
  #followup-0 text matches first followUpOption text
  #followup-1 text matches second followUpOption text
  #type-b-buttons has .hidden class
ACTIONS:
  click #followup-0
ASSERT:
  #followup-0 has .correct class (it is the correct option)
  #feedback-area is visible
  #feedback-text has .correct-text class
  gameState.events includes { type: 'followup_select', ... }
  auto-advances after 2000ms
```

### Scenario: Type B — answer incorrectly (same when different)

```
SETUP: Page loaded, advance to Round 4 (Type B, correctAnswer=different)
ACTIONS:
  click #btn-same
ASSERT:
  #scenario-b-card has .incorrect class
  #feedback-text has .incorrect-text class
  #followup-area has .hidden class (no follow-up on wrong answer)
  gameState.lives decreased by 1
  auto-advances after 1500ms
```

### Scenario: Reset clears input (Type A)

```
SETUP: Page loaded, on a Type A round, user has typed a value
ACTIONS:
  type "5" in #input-a-field
  click #btn-reset
ASSERT:
  #input-a-field value is ""
  no .correct or .incorrect classes on input
```

### Scenario: Game ends after all rounds

```
SETUP: Complete all 10 rounds correctly (use actions from Scenario 1)
ASSERT:
  gameState.isActive === false
  game_complete postMessage sent
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
  Round 1 (Type A, correct=3): type "99" in #input-a-field, click #btn-submit — lives: 2
  wait for retry, click #btn-retry
  type "99" in #input-a-field, click #btn-submit — lives: 1 (second attempt, same round)
  wait for retry, click #btn-retry
  type "99" in #input-a-field, click #btn-submit — lives: 0
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
  TransitionScreen shows "Stage 2: Traps!" for ~2 seconds
  Then auto-dismisses and Round 4 renders
  stage-badge shows "Stage 2: Traps"
ACTIONS:
  Complete rounds 4-7 correctly
ASSERT:
  TransitionScreen shows "Stage 3: Predict!" for ~2 seconds
  Then Round 8 renders
  stage-badge shows "Stage 3: Predict"
```

### Scenario: Scenario cards render correctly

```
SETUP: Page loaded, Round 1 loaded (Type A)
ASSERT:
  #scenario-context text is "Mom's Chai"
  #scenario-a-text contains "2 spoons of tea and 1 spoon of sugar"
  #ratio-a-num1 text is "2"
  #ratio-a-num2 text is "1"
  #scenario-b-text contains "6 spoons of tea" and "___"
  #type-a-input is visible
  #type-b-buttons has .hidden class
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
- [ ] `#scenario-a-card` and `#scenario-b-card` exist
- [ ] `#type-a-input` area exists with `#input-a-field`
- [ ] `#followup-area` exists with `#followup-0` and `#followup-1` buttons
- [ ] Both button containers exist: `#type-a-buttons`, `#type-b-buttons`
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
- [ ] **Every end condition actually calls endGame()** — rounds complete (nextRound) AND lives=0 (handleTypeASubmit + handleTypeBAnswer) (PART-011)
- [ ] `endGame()` calls `signalCollector.seal()` before postMessage (PART-010)
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals (PART-012)
- [ ] `showResults()` populates all fields including lives (PART-019)
- [ ] `progressBar.update()` first param is COMPLETED rounds (0 at start), second is remaining lives (PART-023)
- [ ] Stage transitions use `transitionScreen.show({ duration: 2000 })` — NO buttons (PART-024)
- [ ] Start/end transitions use buttons — NO duration (PART-024)
- [ ] InputSchema defined with fallback content of 10 rounds (PART-028)
- [ ] Play area has scenario cards + interactive areas + feedback section (PART-027)
- [ ] No anti-patterns present (PART-026)

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors for feedback states (PART-020)
- [ ] Correct feedback: green border+bg. Incorrect: red border+bg (PART-020)
- [ ] Max-width 480px, uses `100dvh` not `100vh` (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` classes (PART-022)
- [ ] Only one action button visible at a time in type-a-buttons container (PART-022)
- [ ] `.hidden { display: none !important; }` utility class used for show/hide (PART-022)
- [ ] ProgressBar slot at top of layout (PART-023)
- [ ] Scenario A card has purple border, Scenario B has orange border (game-specific)
- [ ] Ratio display inside Scenario A shows "for every" with emoji + number (game-specific)
- [ ] Follow-up options are full-width stacked buttons (game-specific)

### Rules Compliance

- [ ] RULE-001: All onclick handlers (`handleTypeASubmit`, `handleTypeBAnswer`, `handleFollowUpSelect`, `resetInputs`, `handleRetry`, `nextRound`) defined at global scope
- [ ] RULE-002: All async functions (`handleTypeASubmit`, `handleTypeBAnswer`, `handleFollowUpSelect`, `testAudio`, DOMContentLoaded callback) have `async` keyword
- [ ] RULE-003: All async calls wrapped in try/catch (FeedbackManager.sound.play, waitForPackages, FeedbackManager.init, preload)
- [ ] RULE-004: All logging uses `JSON.stringify(obj, null, 2)` — no raw objects
- [ ] RULE-005: Cleanup in endGame: `visibilityTracker.destroy()`, `FeedbackManager.sound.stopAll()`, `FeedbackManager.stream.stopAll()`
- [ ] RULE-006: No `new Audio()`, no `setInterval` for timers, no `SubtitleComponent.show()`, no `sound.register()`
- [ ] RULE-007: Single file, no external CSS/JS except PART-002 CDN packages

### Game-Specific

- [ ] Both round types (A and B) render correctly and handle user input
- [ ] Type A: Single number input, validates against `baseComponent × multiplier`
- [ ] Type A: Supports both `missingPosition: "first"` and `"second"`
- [ ] Type B: Two-phase flow — Phase 1 (same/different choice), Phase 2 (follow-up if "different" correct)
- [ ] Type B follow-up: NOT penalized — purely explanatory
- [ ] Type B follow-up: Highlights correct option green even if wrong one selected
- [ ] Type B "same" correct: No follow-up shown, auto-advances after 1.5s
- [ ] Type B incorrect: No follow-up shown, loses life, auto-advances after 1.5s
- [ ] Scenario A always shows ratio display ("for every X, Y")
- [ ] Scenario B text contains the blank "___" for Type A
- [ ] Star calculation: 9-10 correct = 3★, 6-8 = 2★, 1-5 = 1★ (not percentage-based)
- [ ] Lives system: wrong answers decrement lives, lives=0 triggers endGame
- [ ] Stage progression: rounds 0-2 = Easy, 3-6 = Traps, 7-9 = Predict
- [ ] `trapType` field tracked in content for analytics (additive, one-side, both-changed)

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json (mandatory + game-specific fields)
- [ ] Attempts match contracts/attempt.schema.json (timestamp, time_since_start, input, attempt_number, correct, metadata)
- [ ] Metrics match contracts/metrics.schema.json (accuracy 0-100, time in seconds, stars 0-3, attempts, duration_data, totalLives, tries)
- [ ] duration_data matches contracts/duration-data.schema.json (startTime ISO, attempts array, inActiveTime, totalInactiveTime)
- [ ] postMessage out matches contracts/postmessage-out.schema.json (type: 'game_complete', data: { metrics, attempts, completedAt })
- [ ] postMessage in handles contracts/postmessage-in.schema.json (type: 'game_init', data: { gameId, content, signalConfig })
