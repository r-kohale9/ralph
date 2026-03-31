# Same Rule? — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Same Rule?
- **Game ID:** same-rule
- **Type:** standard
- **Description:** Compare two real-world scenes and decide if they follow the same "for every" relationship. 10 rounds across 3 stages (easy matches, additive traps, kid leads). No lives — low-stakes exploratory. Star rating at end based on accuracy.
- **Learning Goal:** Ratio Intuition for Grade 5 (Skills 1 + 2). The kid anchors the habit of thinking "for every X of this, there are Y of that" when looking at two related quantities. They learn that this "for every" description is more useful than "how many more" — because only the "for every" rule tells you whether two situations match.

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | — |
| PART-002 | Package Scripts | YES | — |
| PART-003 | waitForPackages | YES | — |
| PART-004 | Initialization Block | YES | — |
| PART-005 | VisibilityTracker | YES | popupProps: default |
| PART-006 | TimerComponent | NO | No timer in this game |
| PART-007 | Game State Object | YES | Custom fields: scenes, rule, currentStage, correctCount |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | — |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: same_different_answer, rule_check, round_complete |
| PART-011 | End Game & Metrics | YES | Star logic: 8-10 correct → 3 stars, 5-7 → 2 stars, 1-4 → 1 star |
| PART-012 | Debug Functions | YES | — |
| PART-013 | Validation Fixed | NO | — |
| PART-014 | Validation Function | YES | Rule: check same/different + rule numbers |
| PART-015 | Validation LLM | NO | — |
| PART-016 | StoriesComponent | NO | — |
| PART-017 | Feedback Integration | YES | Audio: correct_tap, wrong_tap. Stickers: correct/incorrect GIFs, trophy Lottie. Dynamic TTS for trap explanations + end-game. |
| PART-018 | Case Converter | NO | — |
| PART-019 | Results Screen UI | YES | Custom metrics: correct count, star rating |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | — |
| PART-022 | Game Buttons | YES | Same Rule / Different Rule buttons + Check button |
| PART-023 | ProgressBar Component | YES | totalRounds: 10, totalLives: 0 (no lives) |
| PART-024 | TransitionScreen Component | YES | Screens: start, stage-transition, victory |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | — |
| PART-027 | Play Area Construction | YES | Layout: stacked scenes + buttons/sentence builder |
| PART-028 | InputSchema Patterns | YES | Schema type: rounds with scenes + rules |
| PART-029 | Story-Only Game | NO | — |
| PART-030 | Sentry Error Tracking | YES | — |
| PART-033 | Interaction Patterns | YES | Patterns: buttons (same/different), number-picker (rule builder) |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | — |
| PART-035 | Test Plan Generation | YES (POST_GEN) | — |
| PART-037 | Playwright Testing | YES (POST_GEN) | — |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'same-rule',            // GEN-GAMEID: MUST be first property
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,               // GEN-ENDGAME-GUARD: used by endGame() guard
  phase: 'start',                 // start | playing-judge | playing-rule | feedback | transition | results
  isProcessing: false,            // Prevents overlapping click handlers during feedback
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
  currentStage: 1,                // 1=easy matches, 2=additive traps, 3=kid leads
  correctCount: 0,                // Total correct answers (used for star calculation)
  sameDifferentAnswer: null,      // 'same' or 'different' — kid's judgment
  ruleAnswer: { item1Count: null, item2Count: null },  // kid's rule numbers from sentence builder
  roundData: null,                // Current round's content data
};

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
let signalCollector = null;
```

---

## 4. Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SameRuleGameContent",
  "description": "Content schema for the 'Same Rule?' ratio intuition game",
  "type": "object",
  "required": ["gameId", "rounds"],
  "properties": {
    "gameId": {
      "type": "string",
      "const": "same-rule"
    },
    "rounds": {
      "type": "array",
      "minItems": 10,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["roundNumber", "type", "sceneA", "sceneB", "rule", "isTrap", "stage"],
        "properties": {
          "roundNumber": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10
          },
          "type": {
            "type": "string",
            "enum": ["same", "different"],
            "description": "Whether the two scenes follow the same 'for every' rule"
          },
          "sceneA": {
            "$ref": "#/$defs/scene"
          },
          "sceneB": {
            "$ref": "#/$defs/scene"
          },
          "rule": {
            "type": "object",
            "required": ["item1Count", "item1Name", "item2Count", "item2Name"],
            "properties": {
              "item1Count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 9
              },
              "item1Name": {
                "type": "string",
                "description": "Name of the first item type (e.g., 'cookies')"
              },
              "item2Count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 9
              },
              "item2Name": {
                "type": "string",
                "description": "Name of the second item type (e.g., 'glasses of milk')"
              }
            },
            "additionalProperties": false
          },
          "isTrap": {
            "type": "boolean",
            "description": "Whether this round is an additive trap (same difference, different ratio)"
          },
          "trapExplanation": {
            "type": "string",
            "description": "Explanation text for additive trap rounds, used for TTS dynamic feedback"
          },
          "stage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3,
            "description": "Stage 1 = easy matches, Stage 2 = additive traps, Stage 3 = kid leads (states rule first)"
          }
        },
        "additionalProperties": false,
        "if": {
          "properties": { "isTrap": { "const": true } }
        },
        "then": {
          "required": ["trapExplanation"]
        }
      }
    }
  },
  "additionalProperties": false,
  "$defs": {
    "scene": {
      "type": "object",
      "required": ["item1", "count1", "item2", "count2", "description"],
      "properties": {
        "item1": {
          "type": "string",
          "description": "Name of the first item type in the scene"
        },
        "count1": {
          "type": "integer",
          "minimum": 1,
          "maximum": 36,
          "description": "Count of the first item"
        },
        "item2": {
          "type": "string",
          "description": "Name of the second item type in the scene"
        },
        "count2": {
          "type": "integer",
          "minimum": 1,
          "maximum": 36,
          "description": "Count of the second item"
        },
        "description": {
          "type": "string",
          "description": "Natural-language label describing the scene"
        }
      },
      "additionalProperties": false
    }
  }
}
```

**Exposed content shape:**
```json
{
  "gameId": "same-rule",
  "rounds": [
    {
      "roundNumber": 1,
      "type": "same",
      "sceneA": { "item1": "cookies", "count1": 2, "item2": "glasses of milk", "count2": 1, "description": "..." },
      "sceneB": { "item1": "cookies", "count1": 4, "item2": "glasses of milk", "count2": 2, "description": "..." },
      "rule": { "item1Count": 2, "item1Name": "cookies", "item2Count": 1, "item2Name": "glasses of milk" },
      "isTrap": false,
      "stage": 1
    }
  ]
}
```

---

## 5. Fallback Content

All 10 rounds verified — each round has valid scenes, correct type classification, and proper stage assignments.

```javascript
const fallbackContent = {
  "gameId": "same-rule",
  "rounds": [
    {
      "roundNumber": 1,
      "type": "same",
      "sceneA": {
        "item1": "cookies",
        "count1": 2,
        "item2": "glasses of milk",
        "count2": 1,
        "description": "Ria's snack plate: 2 cookies and 1 glass of milk."
      },
      "sceneB": {
        "item1": "cookies",
        "count1": 4,
        "item2": "glasses of milk",
        "count2": 2,
        "description": "Ria's party plate: 4 cookies and 2 glasses of milk."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "cookies",
        "item2Count": 1,
        "item2Name": "glasses of milk"
      },
      "isTrap": false,
      "stage": 1
    },
    {
      "roundNumber": 2,
      "type": "same",
      "sceneA": {
        "item1": "red flowers",
        "count1": 3,
        "item2": "yellow flowers",
        "count2": 1,
        "description": "A small flower bed with 3 red flowers and 1 yellow flower."
      },
      "sceneB": {
        "item1": "red flowers",
        "count1": 6,
        "item2": "yellow flowers",
        "count2": 2,
        "description": "A bigger flower bed with 6 red flowers and 2 yellow flowers."
      },
      "rule": {
        "item1Count": 3,
        "item1Name": "red flowers",
        "item2Count": 1,
        "item2Name": "yellow flowers"
      },
      "isTrap": false,
      "stage": 1
    },
    {
      "roundNumber": 3,
      "type": "different",
      "sceneA": {
        "item1": "orange fish",
        "count1": 4,
        "item2": "blue fish",
        "count2": 2,
        "description": "A small fish tank with 4 orange fish and 2 blue fish."
      },
      "sceneB": {
        "item1": "orange fish",
        "count1": 4,
        "item2": "blue fish",
        "count2": 5,
        "description": "A bigger tank with 4 orange fish and 5 blue fish."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "orange fish",
        "item2Count": 1,
        "item2Name": "blue fish"
      },
      "isTrap": false,
      "stage": 1
    },
    {
      "roundNumber": 4,
      "type": "different",
      "sceneA": {
        "item1": "birds",
        "count1": 3,
        "item2": "squirrels",
        "count2": 1,
        "description": "A park bench with 3 birds and 1 squirrel."
      },
      "sceneB": {
        "item1": "birds",
        "count1": 5,
        "item2": "squirrels",
        "count2": 3,
        "description": "A bigger park with 5 birds and 3 squirrels."
      },
      "rule": {
        "item1Count": 3,
        "item1Name": "birds",
        "item2Count": 1,
        "item2Name": "squirrels"
      },
      "isTrap": true,
      "trapExplanation": "Both times there were 2 more birds than squirrels. But the 'for every' rule changed! In the small park it was 'for every 3 birds, 1 squirrel.' In the big park it's different.",
      "stage": 2
    },
    {
      "roundNumber": 5,
      "type": "same",
      "sceneA": {
        "item1": "jars of rice",
        "count1": 2,
        "item2": "jars of dal",
        "count2": 3,
        "description": "A kitchen shelf with 2 jars of rice and 3 jars of dal."
      },
      "sceneB": {
        "item1": "jars of rice",
        "count1": 4,
        "item2": "jars of dal",
        "count2": 6,
        "description": "A bigger shelf with 4 jars of rice and 6 jars of dal."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "jars of rice",
        "item2Count": 3,
        "item2Name": "jars of dal"
      },
      "isTrap": true,
      "trapExplanation": "The difference changed — but the 'for every' rule stayed the same! For every 2 jars of rice, there are 3 jars of dal. That's what matters.",
      "stage": 2
    },
    {
      "roundNumber": 6,
      "type": "different",
      "sceneA": {
        "item1": "gold beads",
        "count1": 2,
        "item2": "black beads",
        "count2": 1,
        "description": "A friendship bracelet with 2 gold beads and 1 black bead."
      },
      "sceneB": {
        "item1": "gold beads",
        "count1": 4,
        "item2": "black beads",
        "count2": 3,
        "description": "A necklace with 4 gold beads and 3 black beads."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "gold beads",
        "item2Count": 1,
        "item2Name": "black beads"
      },
      "isTrap": true,
      "trapExplanation": "Both had 1 more gold bead than black. But look at the pattern — the bracelet was 'for every 2 gold, 1 black.' The necklace doesn't follow that rule.",
      "stage": 2
    },
    {
      "roundNumber": 7,
      "type": "same",
      "sceneA": {
        "item1": "tables",
        "count1": 1,
        "item2": "chairs",
        "count2": 4,
        "description": "A small classroom with 1 table and 4 chairs."
      },
      "sceneB": {
        "item1": "tables",
        "count1": 3,
        "item2": "chairs",
        "count2": 12,
        "description": "A bigger classroom with 3 tables and 12 chairs."
      },
      "rule": {
        "item1Count": 1,
        "item1Name": "tables",
        "item2Count": 4,
        "item2Name": "chairs"
      },
      "isTrap": true,
      "trapExplanation": "Way more extra chairs in the big room! But the rule is the same — for every 1 table, there are 4 chairs. The difference changed, the rule didn't.",
      "stage": 2
    },
    {
      "roundNumber": 8,
      "type": "different",
      "sceneA": {
        "item1": "sunflowers",
        "count1": 6,
        "item2": "pots",
        "count2": 3,
        "description": "A garden display with 6 sunflowers in 3 pots."
      },
      "sceneB": {
        "item1": "sunflowers",
        "count1": 9,
        "item2": "pots",
        "count2": 3,
        "description": "A larger display with 9 sunflowers in 3 pots."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "sunflowers",
        "item2Count": 1,
        "item2Name": "pots"
      },
      "isTrap": false,
      "stage": 3
    },
    {
      "roundNumber": 9,
      "type": "same",
      "sceneA": {
        "item1": "spoons of sugar",
        "count1": 2,
        "item2": "cups of water",
        "count2": 5,
        "description": "A lemonade recipe showing 2 spoons of sugar and 5 cups of water."
      },
      "sceneB": {
        "item1": "spoons of sugar",
        "count1": 4,
        "item2": "cups of water",
        "count2": 10,
        "description": "A bigger batch: 4 spoons of sugar and 10 cups of water."
      },
      "rule": {
        "item1Count": 2,
        "item1Name": "spoons of sugar",
        "item2Count": 5,
        "item2Name": "cups of water"
      },
      "isTrap": false,
      "stage": 3
    },
    {
      "roundNumber": 10,
      "type": "same",
      "sceneA": {
        "item1": "red threads",
        "count1": 3,
        "item2": "white threads",
        "count2": 2,
        "description": "A weaving pattern with 3 red threads and 2 white threads."
      },
      "sceneB": {
        "item1": "red threads",
        "count1": 9,
        "item2": "white threads",
        "count2": 6,
        "description": "A larger weaving with 9 red threads and 6 white threads."
      },
      "rule": {
        "item1Count": 3,
        "item1Name": "red threads",
        "item2Count": 2,
        "item2Name": "white threads"
      },
      "isTrap": false,
      "stage": 3
    }
  ]
};
```

### Content Generation Guide

The game receives content via `postMessage` (`game_init` -> `event.data.data.content`). To generate different difficulty levels, vary these parameters:

| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| Rounds | 10 | 10 | 10 |
| Same/Different split | 7 same, 3 different | 5 same, 5 different | 4 same, 6 different |
| Additive traps | 1-2 rounds | 3-4 rounds | 5-6 rounds |
| Ratio complexity | Ratios with 1 (1:2, 2:1, 1:3) | Ratios without 1 (2:3, 3:4) | Larger ratios (3:5, 4:7) |
| Multiplier range | x2 only | x2, x3 | x2, x3, x4 |
| Stage 3 rounds | 2 | 3 | 3 |

**Content constraints (MUST be enforced):**
- All ratios must use whole numbers 1-9.
- "Same" rounds must have sceneB = sceneA ratio multiplied by an integer multiplier (e.g., 2:3 scaled by x2 = 4:6).
- "Different" rounds must NOT have equivalent ratios between sceneA and sceneB.
- Additive trap rounds: the absolute difference between the two quantities is the same in both scenes, but the ratio is different.
- Swap trap rounds: the order of quantities is reversed (e.g., sceneA is 2:3, sceneB is 3:2).
- Contexts should be familiar real-world scenarios (food, nature, classroom, crafts, recipes, sports equipment).
- Each content set should use unique contexts — do not repeat the same item pairings across rounds within a set.
- Stage progression must be maintained: Stage 1 rounds first (easy matches), Stage 2 rounds next (additive traps), Stage 3 rounds last (kid states rule first).

---

## 6. Screens & HTML Structure

### Body HTML (uses `<template>` for ScreenLayout compatibility — PART-025)

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Scene A -->
    <div class="scene-card scene-a" id="scene-a">
      <div class="scene-illustration" id="scene-a-illustration"></div>
      <p class="scene-label" id="scene-a-label"></p>
    </div>

    <!-- Scene B (slides in after Scene A) -->
    <div class="scene-card scene-b" id="scene-b" style="display:none;">
      <div class="scene-illustration" id="scene-b-illustration"></div>
      <p class="scene-label" id="scene-b-label"></p>
    </div>

    <!-- Same/Different buttons -->
    <div class="btn-container" id="judge-buttons" style="display:none;">
      <button class="game-btn btn-primary" id="btn-same" data-signal-id="btn-same" onclick="handleJudgment('same')">Same Rule</button>
      <button class="game-btn btn-secondary" id="btn-different" data-signal-id="btn-different" onclick="handleJudgment('different')">Different Rule</button>
    </div>

    <!-- Sentence Builder (for stating the rule) -->
    <div class="sentence-builder" id="sentence-builder" style="display:none;">
      <p class="builder-label">For every</p>
      <div class="builder-row">
        <input type="number" id="rule-input-1" class="rule-input" min="1" max="9" data-signal-id="rule-input-1">
        <span class="item-name" id="item1-name"></span>
      </div>
      <p class="builder-label">there are</p>
      <div class="builder-row">
        <input type="number" id="rule-input-2" class="rule-input" min="1" max="9" data-signal-id="rule-input-2">
        <span class="item-name" id="item2-name"></span>
      </div>
      <button class="game-btn btn-primary" id="btn-check" data-signal-id="btn-check" onclick="handleRuleCheck()">Check</button>
    </div>

    <!-- Feedback area -->
    <div class="feedback-area" id="feedback-area" style="display:none;">
      <p class="feedback-text" id="feedback-text"></p>
    </div>
  </div>

  <div id="results-screen" class="game-block">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title">Game Complete!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Score</span>
          <span class="metric-value" id="result-score">0/10</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span class="metric-value" id="result-accuracy">0%</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="restart-button" onclick="restartGame()">Play Again</button>
    </div>
  </div>
</template>
```

---

## 7. CSS

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
  --mathai-font-size-small: 12px;
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-light-gray);
  color: var(--mathai-text-primary);
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

/* === Scene Cards === */
.scene-card {
  width: 100%;
  max-width: 340px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: all 0.4s ease;
}

.scene-illustration {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--mathai-light-blue);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 40px;
}

.scene-label {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
  line-height: 1.5;
  text-align: center;
}

/* Scene A compresses when Scene B appears */
.scene-card.compressed {
  padding: 12px;
}
.scene-card.compressed .scene-illustration {
  aspect-ratio: 2/1;
}

/* Scene B slide-in animation */
.scene-b {
  animation: slideInUp 0.5s ease forwards;
}
@keyframes slideInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === Buttons (PART-022) === */
.btn-container {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
}

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
  flex: 1;
}

.btn-primary {
  background: var(--mathai-green);
  color: var(--mathai-white);
}
.btn-primary:hover { filter: brightness(0.9); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: var(--mathai-light-gray);
  color: var(--mathai-text-primary);
  border: 2px solid var(--mathai-border-gray);
}
.btn-secondary:hover { background: var(--mathai-light-gray); }

/* Selected button state */
.game-btn.selected {
  outline: 3px solid var(--mathai-blue);
  outline-offset: 2px;
}

/* === Sentence Builder === */
.sentence-builder {
  width: 100%;
  max-width: 340px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease forwards;
}

.builder-label {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-gray);
  margin-bottom: 8px;
  text-align: center;
}

.builder-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.rule-input {
  width: 60px;
  height: 48px;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 12px;
  text-align: center;
  font-size: var(--mathai-font-size-title);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  color: var(--mathai-text-primary);
  outline: none;
  transition: border-color 0.2s ease;
}
.rule-input:focus {
  border-color: var(--mathai-blue);
}

.item-name {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-text-primary);
}

/* === Feedback Area === */
.feedback-area {
  width: 100%;
  max-width: 340px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.feedback-text {
  font-size: var(--mathai-font-size-body);
  line-height: 1.5;
  color: var(--mathai-text-primary);
}

.feedback-area.correct {
  border-left: 4px solid var(--mathai-green);
  background: var(--mathai-light-green);
}

.feedback-area.incorrect {
  border-left: 4px solid var(--mathai-red);
  background: var(--mathai-light-red);
}

/* === Results Screen (PART-019 + GEN-RESULTS-FIXED) === */
#results-screen {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: var(--mathai-light-gray);
  overflow-y: auto;
}

.results-card {
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.results-title {
  font-size: var(--mathai-font-size-title);
  margin-bottom: 24px;
  color: var(--mathai-text-primary);
}

.stars-display {
  font-size: 40px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-label {
  color: var(--mathai-gray);
  font-size: var(--mathai-font-size-label);
}

.metric-value {
  font-weight: 700;
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
}
```

---

## 8. Game Flow

### Round Types & Stage Progression

The game has 3 stages with different interaction flows:

- **Stage 1 (Rounds 1-3) — Easy Matches:** Both scenes shown, kid judges same/different, then states the rule. Builds confidence with "for every" language.
- **Stage 2 (Rounds 4-7) — Additive Traps:** Same flow as Stage 1, but scenes are designed to break the "how many more" habit. Some pairs have the same difference but different ratios. Trap rounds include an extra TTS explanation after feedback.
- **Stage 3 (Rounds 8-10) — Kid Leads:** Kid sees ONE scene first, states the rule, THEN the second scene appears and they judge. Flips from recognition to generation.

### Flow Steps

1. **Page loads** -> DOMContentLoaded fires
   - waitForPackages()
   - FeedbackManager.init()
   - Audio preload: correct_tap, wrong_tap (PART-017)
   - SignalCollector created (PART-010) and assigned to `window.signalCollector`
   - ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })
   - Clone `<template id="game-template">` into `#gameContent`
   - ProgressBar created (totalRounds: 10, totalLives: 0)
   - TransitionScreen created
   - VisibilityTracker created
   - Show start transition screen

2. **startGame()** runs (from start screen button):
   - Set gameState.startTime = Date.now()
   - Set gameState.isActive = true
   - Set gameState.gameEnded = false
   - Set gameState.phase = 'playing-judge'; syncDOMState()
   - Set duration_data.startTime = new Date().toISOString()
   - trackEvent('game_start', 'game')
   - Call setupRound()

3. **setupRound()** runs:
   - Get roundData = gameState.content.rounds[gameState.currentRound]
   - Set gameState.roundData = roundData
   - Set gameState.currentStage = roundData.stage
   - Set gameState.sameDifferentAnswer = null
   - Set gameState.ruleAnswer = { item1Count: null, item2Count: null }
   - Set gameState.isProcessing = false
   - Start signal collection for this round
   - **If Stage 3 (kid leads):**
     - Show Scene A only (Scene B hidden)
     - Show sentence builder with item names from roundData.rule
     - Set gameState.phase = 'playing-rule'; syncDOMState()
     - Kid states the rule first, then handleRuleCheck() reveals Scene B and judge buttons
   - **If Stage 1 or 2:**
     - Show Scene A with label
     - After 800ms pause: add `.compressed` class to Scene A, slide in Scene B, show judge buttons
     - Set gameState.phase = 'playing-judge'; syncDOMState()
   - Update progressBar.update(gameState.currentRound, 0)
   - Show #game-screen, ensure #results-screen hidden
   - trackEvent('round_start', 'game', { round, stage })
   - Record view event for content render

4. **handleJudgment(choice)** — kid taps Same Rule or Different Rule:
   - If !gameState.isActive -> return
   - If gameState.isProcessing -> return
   - gameState.isProcessing = true
   - gameState.sameDifferentAnswer = choice
   - Highlight selected button (.selected class)
   - const isCorrect = (choice === gameState.roundData.type)
   - trackEvent('same_different_answer', 'game', { choice, correct: isCorrect, round: gameState.currentRound + 1 })
   - **If correct:**
     - Play correct audio with sticker
     - If trap round (roundData.isTrap): play dynamic TTS with trapExplanation
   - **If wrong:**
     - Play wrong audio with sticker
     - If trap round: play dynamic TTS with trapExplanation (educational even when wrong)
   - Record attempt for judgment phase
   - **If Stage 3:** judgment already happened after rule check, so proceed to feedback + nextRound()
   - **If Stage 1 or 2:** show sentence builder, set phase = 'playing-rule'

5. **handleRuleCheck()** — kid taps Check on sentence builder:
   - If gameState.isProcessing -> return
   - gameState.isProcessing = true
   - Read values from rule-input-1 and rule-input-2
   - gameState.ruleAnswer = { item1Count: parseInt(val1), item2Count: parseInt(val2) }
   - const ruleCorrect = (ruleAnswer.item1Count === roundData.rule.item1Count && ruleAnswer.item2Count === roundData.rule.item2Count)
   - trackEvent('rule_check', 'game', { answer: gameState.ruleAnswer, correct: ruleCorrect, round: gameState.currentRound + 1 })
   - **If correct:**
     - Play correct audio with sticker: "That's it! For every {item1Count} {item1Name}, {item2Count} {item2Name}!"
     - Show grouping animation in scenes (items visually cluster into "for every" groups)
     - Increment gameState.correctCount
   - **If wrong:**
     - Play wrong audio with sticker: "Not quite. The rule is: for every {item1Count} {item1Name}, {item2Count} {item2Name}."
     - Show correct grouping gently (no harsh red X)
   - Record attempt for rule phase
   - **If Stage 3 and this is the first check (pre-judgment):**
     - After correct rule: slide in Scene B, show judge buttons, set phase = 'playing-judge'
     - After wrong rule: still show correct rule, then slide in Scene B + judge buttons
     - gameState.isProcessing = false
     - return (do not call nextRound yet — wait for judgment)
   - **If Stage 1/2 (post-judgment rule check):**
     - Show feedback area with summary
     - trackEvent('round_complete', 'game', { round, judgmentCorrect, ruleCorrect })
     - Record round outcome via `signalCollector.recordCustomEvent('round_solved', ...)`
     - After 1500ms delay -> nextRound()

6. **nextRound()**:
   - gameState.currentRound++
   - If gameState.currentRound >= gameState.totalRounds -> endGame()
   - Else:
     - Check if stage changed: if new roundData.stage !== gameState.currentStage, show stage transition screen
     - Record screen transition
     - Reset UI: hide Scene B, hide sentence builder, hide feedback area, hide judge buttons
     - setupRound()

7. **endGame()** (all 10 rounds completed):
   - Guard: if (gameState.gameEnded) return; gameState.gameEnded = true; gameState.isActive = false; (GEN-ENDGAME-GUARD)
   - Set gameState.phase = 'results'; syncDOMState()
   - gameState.duration_data.currentTime = new Date().toISOString()
   - Calculate stars: 8-10 correct -> 3 stars, 5-7 -> 2 stars, 1-4 -> 1 star
   - const accuracy = Math.round((gameState.correctCount / gameState.totalRounds) * 100)
   - End-game TTS with trophy:
     ```javascript
     try {
       await FeedbackManager.playDynamicFeedback({
         audio_content: `You spotted the for-every rule ${gameState.correctCount} out of 10 times!`,
         subtitle: `You spotted the for-every rule ${gameState.correctCount} out of 10 times!`,
         sticker: { url: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json', type: 'Lottie' }
       });
     } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
     ```
   - Seal SignalCollector (PART-010): `if (signalCollector) signalCollector.seal()`
   - Update results screen: #result-score, #result-accuracy, #stars-display
   - Show #results-screen, hide #game-screen
   - Send postMessage (signal data streamed to GCS — not included), cleanup

8. **restartGame()** — Reset all state, recreate components, show start screen:
   - Reset all gameState fields to defaults (currentRound=0, score=0, correctCount=0, etc.)
   - gameState.phase = 'start'; syncDOMState()
   - Recreate SignalCollector (endGame destroyed it via seal)
   - Recreate VisibilityTracker
   - Recreate ProgressBar (totalRounds: 10, totalLives: 0)
   - Show start transition screen

---

## 9. Functions

### Global Scope (RULE-001)

**syncDOMState()**
- Set `#app` dataset attributes from gameState: `data-phase`, `data-round`, `data-score`, `data-stage`
- Called immediately after every `gameState.phase` assignment (GEN-SYNCDOMESTATE)

**startGame()**
- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set gameState.gameEnded = false
- Set gameState.phase = 'playing-judge'; syncDOMState()
- Set duration_data.startTime = new Date().toISOString()
- trackEvent('game_start', 'game')
- setupRound()

**setupRound()**
- Get roundData = gameState.content.rounds[gameState.currentRound]
- Set gameState.roundData = roundData
- Set gameState.currentStage = roundData.stage
- Set gameState.sameDifferentAnswer = null
- Set gameState.ruleAnswer = { item1Count: null, item2Count: null }
- Set gameState.isProcessing = false
- Reset UI elements: hide scene-b, judge-buttons, sentence-builder, feedback-area
- Populate Scene A: set scene-a-label text from roundData.sceneA.description, populate scene-a-illustration with item counts
- Populate item names in sentence builder: set item1-name text from roundData.rule.item1Name, item2-name from roundData.rule.item2Name
- Clear rule inputs
- **If Stage 3:**
  - Show Scene A only
  - Show sentence builder (kid states the rule first)
  - Set gameState.phase = 'playing-rule'; syncDOMState()
- **If Stage 1 or 2:**
  - Show Scene A
  - After 800ms timeout:
    - Add `.compressed` class to scene-a
    - Populate Scene B: set scene-b-label from roundData.sceneB.description, populate scene-b-illustration
    - Show scene-b (with slide-in animation)
    - Show judge-buttons
    - Set gameState.phase = 'playing-judge'; syncDOMState()
- progressBar.update(gameState.currentRound, 0)
- Show #game-screen, ensure #results-screen hidden
- trackEvent('round_start', 'game', { round: gameState.currentRound + 1, stage: roundData.stage })
- Record view event for content render:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        question_text: `Compare scenes: ${roundData.sceneA.description} vs ${roundData.sceneB.description}`,
        round: gameState.currentRound + 1,
        stage: roundData.stage,
        type: roundData.type,
        trigger: 'round_start'
      },
      components: {
        progress: { current: gameState.currentRound, total: gameState.totalRounds }
      }
    });
  }
  ```

**async handleJudgment(choice)**
- If !gameState.isActive -> return
- If gameState.isProcessing -> return
- gameState.isProcessing = true
- gameState.sameDifferentAnswer = choice
- Add .selected class to the tapped button, remove from the other
- const isCorrect = (choice === gameState.roundData.type)
- trackEvent('same_different_answer', 'game', { choice, correct: isCorrect, round: gameState.currentRound + 1 })
- **If correct:**
  ```javascript
  try {
    await FeedbackManager.sound.play('correct_tap', {
      subtitle: `**Correct!** ${choice === 'same' ? 'Both scenes follow the same rule!' : 'The scenes follow different rules!'}`,
      sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif', duration: 2, type: 'IMAGE_GIF' }
    });
  } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
  ```
  - If trap round (roundData.isTrap && roundData.trapExplanation):
    ```javascript
    try {
      await FeedbackManager.playDynamicFeedback({
        audio_content: roundData.trapExplanation,
        subtitle: roundData.trapExplanation
      });
    } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
    ```
- **If wrong:**
  ```javascript
  try {
    await FeedbackManager.sound.play('wrong_tap', {
      subtitle: `**Not quite.** The scenes actually follow ${gameState.roundData.type === 'same' ? 'the same' : 'different'} rules.`,
      sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif', duration: 2, type: 'IMAGE_GIF' }
    });
  } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
  ```
  - If trap round: play dynamic TTS with trapExplanation (educational even when wrong)
- Record visual update:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'judgment',
        choice: choice,
        correct: isCorrect,
        trigger: 'user_action'
      }
    });
  }
  ```
- recordAttempt({ input_of_user: { action: 'judgment', choice }, correct: isCorrect, metadata: { round: gameState.currentRound + 1, question: `Same or different rule?`, correctAnswer: gameState.roundData.type, validationType: 'function' } })
- **If Stage 3:** This is the second interaction (judgment comes after rule). Proceed directly:
  - Show feedback summary
  - trackEvent('round_complete', 'game', { round: gameState.currentRound + 1 })
  - Record round outcome via `signalCollector.recordCustomEvent('round_solved', ...)`
  - After 1500ms -> nextRound()
- **If Stage 1/2:** Judgment is first interaction. Now show sentence builder:
  - Show sentence-builder
  - Hide judge-buttons
  - Set gameState.phase = 'playing-rule'; syncDOMState()
  - gameState.isProcessing = false

> **Note:** Because handleJudgment uses `await`, it must be declared `async` (RULE-002). The onclick handler fires it as fire-and-forget. The `isProcessing` guard serializes interactions so feedback audio/stickers from one action complete before the next is processed.

**async handleRuleCheck()**
- If gameState.isProcessing -> return
- gameState.isProcessing = true
- Read values: const val1 = parseInt(document.getElementById('rule-input-1').value); const val2 = parseInt(document.getElementById('rule-input-2').value)
- If isNaN(val1) || isNaN(val2): show feedback "Please fill in both numbers", gameState.isProcessing = false, return
- gameState.ruleAnswer = { item1Count: val1, item2Count: val2 }
- const ruleCorrect = (val1 === gameState.roundData.rule.item1Count && val2 === gameState.roundData.rule.item2Count)
- trackEvent('rule_check', 'game', { answer: gameState.ruleAnswer, correct: ruleCorrect, round: gameState.currentRound + 1 })
- **If correct:**
  ```javascript
  try {
    await FeedbackManager.sound.play('correct_tap', {
      subtitle: `**That's it!** For every ${gameState.roundData.rule.item1Count} ${gameState.roundData.rule.item1Name}, ${gameState.roundData.rule.item2Count} ${gameState.roundData.rule.item2Name}!`,
      sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif', duration: 2, type: 'IMAGE_GIF' }
    });
  } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
  ```
  - gameState.correctCount++
  - Show grouping animation: items in both scenes visually cluster into "for every" groups with a soft glow
- **If wrong:**
  ```javascript
  try {
    await FeedbackManager.sound.play('wrong_tap', {
      subtitle: `**Not quite.** The rule is: for every ${gameState.roundData.rule.item1Count} ${gameState.roundData.rule.item1Name}, ${gameState.roundData.rule.item2Count} ${gameState.roundData.rule.item2Name}.`,
      sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif', duration: 2, type: 'IMAGE_GIF' }
    });
  } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
  ```
  - Show correct grouping gently (animate items into correct groups, no harsh feedback)
- Record feedback display:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('feedback_display', {
      screen: 'gameplay',
      content_snapshot: {
        feedback_type: ruleCorrect ? 'correct' : 'incorrect',
        message: ruleCorrect ? 'Rule correct!' : 'Rule incorrect.',
        round: gameState.currentRound + 1,
        user_rule: gameState.ruleAnswer,
        correct_rule: gameState.roundData.rule
      }
    });
  }
  ```
- recordAttempt({ input_of_user: { action: 'rule_check', rule: gameState.ruleAnswer }, correct: ruleCorrect, metadata: { round: gameState.currentRound + 1, question: `For every ___ ${gameState.roundData.rule.item1Name}, there are ___ ${gameState.roundData.rule.item2Name}`, correctAnswer: gameState.roundData.rule, validationType: 'function' } })
- **If Stage 3 and this is the first check (pre-judgment — sameDifferentAnswer is null):**
  - After rule feedback delay (1000ms):
    - Populate Scene B labels and illustration from roundData.sceneB
    - Show scene-b with slide-in animation
    - Add .compressed to scene-a
    - Show judge-buttons
    - Hide sentence-builder
    - Set gameState.phase = 'playing-judge'; syncDOMState()
    - gameState.isProcessing = false
  - return (do not call nextRound — wait for judgment)
- **If Stage 1/2 (post-judgment rule check) or Stage 3 post-judgment:**
  - Record round outcome:
    ```javascript
    if (signalCollector) {
      signalCollector.recordCustomEvent('round_solved', { correct: ruleCorrect, round: gameState.currentRound + 1 });
    }
    ```
  - trackEvent('round_complete', 'game', { round: gameState.currentRound + 1, judgmentCorrect: gameState.sameDifferentAnswer === gameState.roundData.type, ruleCorrect })
  - After 1500ms delay -> nextRound()

**nextRound()**
- gameState.currentRound++
- If gameState.currentRound >= gameState.totalRounds -> endGame()
- Else:
  - const nextRoundData = gameState.content.rounds[gameState.currentRound]
  - const stageChanged = (nextRoundData.stage !== gameState.currentStage)
  - Record screen transition:
    ```javascript
    if (signalCollector) {
      signalCollector.recordViewEvent('screen_transition', {
        screen: stageChanged ? 'stage_transition' : 'gameplay',
        metadata: { transition_from: 'gameplay' }
      });
    }
    ```
  - **If stageChanged:**
    - const stageNames = { 1: 'Easy Matches', 2: 'Additive Traps', 3: 'You Lead!' }
    - const stageDescs = { 1: 'Both scenes follow the same rule.', 2: 'Watch out — same difference does not mean same rule!', 3: 'State the rule first, then judge!' }
    - transitionScreen.show({ icons: ['🔍'], iconSize: 'normal', title: `Stage ${nextRoundData.stage}: ${stageNames[nextRoundData.stage]}`, subtitle: stageDescs[nextRoundData.stage], buttons: [{ text: 'Continue', type: 'primary', action: () => { setupRound(); } }] })
  - **Else:**
    - setupRound()

**async endGame()**
- if (gameState.gameEnded) return  // GEN-ENDGAME-GUARD: use gameEnded, NOT isActive
- gameState.gameEnded = true
- gameState.isActive = false
- gameState.phase = 'results'; syncDOMState()
- gameState.duration_data.currentTime = new Date().toISOString()
- const totalTime = Math.round((Date.now() - gameState.startTime) / 1000)
- const accuracy = Math.round((gameState.correctCount / gameState.totalRounds) * 100)
- Calculate stars:
  ```javascript
  let stars = 1;
  if (gameState.correctCount >= 8) stars = 3;
  else if (gameState.correctCount >= 5) stars = 2;
  ```
- End-game TTS with trophy sticker:
  ```javascript
  try {
    await FeedbackManager.playDynamicFeedback({
      audio_content: `You spotted the for-every rule ${gameState.correctCount} out of 10 times!`,
      subtitle: `You spotted the for-every rule ${gameState.correctCount} out of 10 times!`,
      sticker: { url: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json', type: 'Lottie' }
    });
  } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
  ```
- Update results screen:
  ```javascript
  document.getElementById('result-score').textContent = `${gameState.correctCount}/10`;
  document.getElementById('result-accuracy').textContent = `${accuracy}%`;
  const starsDisplay = document.getElementById('stars-display');
  starsDisplay.innerHTML = Array(3).fill(0).map((_, i) => `<span class="${i < stars ? 'star-filled' : 'star-empty'}">${i < stars ? '⭐' : '☆'}</span>`).join('');
  ```
- Show #results-screen, hide #game-screen
- Seal SignalCollector (fires sendBeacon to flush all events to GCS, stops flush timer, detaches listeners):
  ```javascript
  if (signalCollector) signalCollector.seal();
  ```
- Send postMessage (signal data streamed to GCS via batch flushing — NOT included in postMessage):
  ```javascript
  const payload = {
    type: 'game_end',
    data: {
      gameId: gameState.gameId,
      score: gameState.correctCount,
      totalRounds: gameState.totalRounds,
      accuracy,
      stars,
      totalTime,
      attempts: gameState.attempts,
      events: gameState.events,
      duration_data: gameState.duration_data
    }
  };
  window.parent.postMessage(payload, '*');
  ```
- trackEvent('game_end', 'game', { score: gameState.correctCount, stars, accuracy, totalTime })

**restartGame()**
- gameState.currentRound = 0
- gameState.score = 0
- gameState.correctCount = 0
- gameState.currentStage = 1
- gameState.sameDifferentAnswer = null
- gameState.ruleAnswer = { item1Count: null, item2Count: null }
- gameState.roundData = null
- gameState.attempts = []
- gameState.events = []
- gameState.startTime = null
- gameState.isActive = false
- gameState.gameEnded = false
- gameState.isProcessing = false
- gameState.phase = 'start'; syncDOMState()
- gameState.duration_data = { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null }
- Recreate SignalCollector (endGame destroyed it via seal):
  ```javascript
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    gameId: gameState.gameId || null,
    contentSetId: gameState.contentSetId || null
  });
  window.signalCollector = signalCollector;
  ```
- Recreate visibilityTracker (endGame destroyed it):
  ```javascript
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
  ```
- progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 0, slotId: 'mathai-progress-slot' })
- progressBar.update(0, 0)
- transitionScreen.show({ icons: ['🔍'], iconSize: 'large', title: 'Same Rule?', subtitle: 'Compare scenes and find the for-every pattern!', buttons: [{ text: "I'm ready!", type: 'primary', action: () => startGame() }] })

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

### Audio Flow per Interaction

- **Judgment tap (Same/Different):** `await FeedbackManager.sound.play('correct_tap'/'wrong_tap')` with subtitle + sticker
  - Correct subtitle examples: "Correct! Both scenes follow the same rule!"
  - Wrong subtitle examples: "Not quite. The scenes actually follow different rules."
- **Rule check (Check button):** `await FeedbackManager.sound.play('correct_tap'/'wrong_tap')` with subtitle + sticker
  - Correct subtitle: "That's it! For every 2 cookies, 1 glass of milk!"
  - Wrong subtitle: "Not quite. The rule is: for every 2 cookies, 1 glass of milk."
- **Additive trap explanation (after judgment on trap rounds):** `await FeedbackManager.playDynamicFeedback()` with trapExplanation text as TTS
- **End game:** `await FeedbackManager.playDynamicFeedback()` with trophy sticker — "You spotted the for-every rule X out of 10 times!"

---

## 11. Audio Sequence Table

| # | Moment | Trigger | Audio Type | Content / Sound ID | Await? | Notes |
|---|--------|---------|------------|--------------------|--------|-------|
| 1 | Scene A appears | Round start | SFX | Scene reveal chime (ambient) | No | Cheerful, inviting |
| 2 | Scene B slides in | After Scene A settles | SFX | Slide-in whoosh (ambient) | No | Smooth transition |
| 3 | Same/Different tap — correct | Kid taps correct answer | SFX + Sticker | `await FeedbackManager.sound.play('correct_tap')` + correct sticker | Yes | Show subtitle with rule confirmation |
| 4 | Same/Different tap — wrong | Kid taps wrong answer | SFX + Sticker | `await FeedbackManager.sound.play('wrong_tap')` + incorrect sticker | Yes | Show subtitle with gentle correction |
| 5 | Number input interaction | Kid types in rule input | SFX | Light tick (ambient) | No | Subtle tactile feedback |
| 6 | Check rule — correct | Kid taps Check, answer correct | SFX + Sticker | `await FeedbackManager.sound.play('correct_tap')` + correct sticker | Yes | Grouping animation plays alongside |
| 7 | Check rule — wrong | Kid taps Check, answer wrong | SFX + Sticker | `await FeedbackManager.sound.play('wrong_tap')` + incorrect sticker | Yes | Correct grouping shown gently |
| 8 | Additive trap explanation | After correct/wrong on trap round | TTS + SFX | `await FeedbackManager.playDynamicFeedback()` with explanation text | Yes | Insight bell before TTS |
| 9 | Round transition | After feedback dismissed | SFX | Light swoosh (ambient) | No | Clean forward momentum |
| 10 | Game end — 3 stars | All rounds complete, 8-10 correct | TTS + Sticker | `await FeedbackManager.playDynamicFeedback()` + trophy sticker | Yes | Celebratory jingle |
| 11 | Game end — 2 stars | All rounds complete, 5-7 correct | TTS + Sticker | `await FeedbackManager.playDynamicFeedback()` + trophy sticker | Yes | Upbeat encouraging tune |
| 12 | Game end — 1 star | All rounds complete, 1-4 correct | TTS + Sticker | `await FeedbackManager.playDynamicFeedback()` + trophy sticker | Yes | Warm gentle tone |

---

## 12. Review Findings

- **Warning -- Completeness:** The original Sound Design table used descriptive names (e.g., "soft reveal chime") but did not map to actual PART-017 audio IDs. The Feedback Integration section (Section 10) provides this mapping with concrete `correct_tap` / `wrong_tap` sound IDs and sticker URLs.

- **Info -- Interaction:** Stage 3 rounds change the interaction flow (kid states rule FIRST, then judges). In Stage 3: Step 1 = Scene A only (no Scene B yet), Step 2 = sentence builder (kid states the "for every" rule), Step 3 = Scene B appears + Same/Different buttons, Step 4 = feedback. This is fully documented in the Game Flow (Section 8) and Functions (Section 9).

- **Info -- No Lives:** This game uses no lives (totalLives: 0). The ProgressBar shows round progress only. Star rating is based purely on correctCount at game end, not lives remaining.

- **Info -- Additive Traps:** Rounds 4-7 are "additive trap" rounds where the absolute difference between quantities is the same in both scenes but the ratio differs. These rounds always trigger an extra TTS explanation (trapExplanation) after feedback, regardless of whether the kid answered correctly or incorrectly, since the educational insight is valuable either way.
