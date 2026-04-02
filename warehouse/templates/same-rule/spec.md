# Same Rule? — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Same Rule?
- **Game ID:** game_same_rule
- **Type:** standard
- **Description:** Compare two real-world scenes and decide if they follow the same "for every" relationship. 10 rounds across 3 stages: easy matches, additive trap rounds (break the "how many more" habit), and kid-led generation rounds. No lives — low-stakes exploratory learning. Star rating based on accuracy and additive trap performance.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                 |
| -------- | ----------------------------- | --------------- | ---------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                            |
| PART-002 | Package Scripts               | YES             | —                                                                            |
| PART-003 | waitForPackages               | YES             | —                                                                            |
| PART-004 | Initialization Block          | YES             | —                                                                            |
| PART-005 | VisibilityTracker             | YES             | popupProps: default. onInactive: signalCollector.pause + sound.stopAll. onResume: signalCollector.resume |
| PART-006 | TimerComponent                | NO              | No time pressure — exploratory learning                                      |
| PART-007 | Game State Object             | YES             | Custom fields: phase, userChoice, ruleNumA, ruleNumB, additiveTrapCorrect, ruleCommitted, pendingEndProblem |
| PART-008 | PostMessage Protocol          | YES             | —                                                                            |
| PART-009 | Attempt Tracking              | YES             | —                                                                            |
| PART-010 | Event Tracking                | YES             | Custom events: choice_made, rule_submitted, rule_committed, round_correct, round_incorrect. SignalCollector: startProblem per round, deferred endProblem, recordViewEvent on all DOM changes, seal() in endGame |
| PART-011 | End Game & Metrics            | YES             | Custom star logic: 3★ = 8-10 correct AND ≥3/4 trap rounds; 2★ = 5-7 correct; 1★ = 1-4 correct |
| PART-012 | Debug Functions               | YES             | —                                                                            |
| PART-013 | Validation Fixed              | NO              | —                                                                            |
| PART-014 | Validation Function           | YES             | Rules: userChoice must match round.answer AND ruleNumA/ruleNumB must match round.rule |
| PART-015 | Validation LLM                | NO              | —                                                                            |
| PART-016 | StoriesComponent              | NO              | —                                                                            |
| PART-017 | Feedback Integration          | YES             | Audio for correct/incorrect, scene reveals, round transitions               |
| PART-018 | Case Converter                | NO              | —                                                                            |
| PART-019 | Results Screen UI             | YES             | Custom metrics: score, accuracy, trap rounds correct                        |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                            |
| PART-021 | Screen Layout CSS             | YES             | —                                                                            |
| PART-022 | Game Buttons                  | YES             | —                                                                            |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 10, totalLives: 0 (no lives)                                   |
| PART-024 | TransitionScreen Component    | YES             | Screens: start                                                               |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                               |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                       |
| PART-027 | Play Area Construction        | YES             | Layout: stacked scene cards + choice buttons + sentence builder              |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds array with scene pairs                                   |
| PART-029 | Story-Only Game               | NO              | —                                                                            |
| PART-030 | Sentry Error Tracking         | YES             | SentryConfig-based, SDK v10.23.0                                             |
| PART-031 | API Helper                    | NO              | —                                                                            |
| PART-032 | AnalyticsManager              | NO              | —                                                                            |
| PART-033 | Interaction Patterns          | NO              | —                                                                            |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                     |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                       |
| PART-038 | InteractionManager            | YES             | Suppress taps during scene animations and feedback display                   |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'game_same_rule',
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  gameEnded: false,
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null,
  },

  // GAME-SPECIFIC:
  phase: 'idle',            // 'idle' | 'presenting' | 'choosing' | 'building' | 'feedback'
  userChoice: null,         // 'same' | 'different' | null
  ruleNumA: 1,              // Current value of thingA number picker (1-9)
  ruleNumB: 1,              // Current value of thingB number picker (1-9)
  additiveTrapCorrect: 0,   // Count of additive trap rounds answered correctly
  ruleCommitted: false,     // Stage 3 only: whether kid has committed their rule before seeing Scene B

  // SIGNAL COLLECTOR (PART-010):
  pendingEndProblem: null,  // { id, outcome } — deferred endProblem for SignalCollector
};

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
let signalCollector = null;
let interactionManager = null;
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
          "stage": { "type": "integer", "minimum": 1, "maximum": 3 },
          "sceneA": {
            "type": "object",
            "properties": {
              "label": { "type": "string" },
              "thingA": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "nameSingular": { "type": "string" },
                  "emoji": { "type": "string" },
                  "count": { "type": "integer", "minimum": 1 }
                },
                "required": ["name", "nameSingular", "emoji", "count"]
              },
              "thingB": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "nameSingular": { "type": "string" },
                  "emoji": { "type": "string" },
                  "count": { "type": "integer", "minimum": 1 }
                },
                "required": ["name", "nameSingular", "emoji", "count"]
              }
            },
            "required": ["label", "thingA", "thingB"]
          },
          "sceneB": {
            "type": "object",
            "properties": {
              "label": { "type": "string" },
              "thingA": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "nameSingular": { "type": "string" },
                  "emoji": { "type": "string" },
                  "count": { "type": "integer", "minimum": 1 }
                },
                "required": ["name", "nameSingular", "emoji", "count"]
              },
              "thingB": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "nameSingular": { "type": "string" },
                  "emoji": { "type": "string" },
                  "count": { "type": "integer", "minimum": 1 }
                },
                "required": ["name", "nameSingular", "emoji", "count"]
              }
            },
            "required": ["label", "thingA", "thingB"]
          },
          "answer": { "type": "string", "enum": ["same", "different"] },
          "rule": {
            "type": "object",
            "properties": {
              "numA": { "type": "integer", "minimum": 1, "maximum": 9 },
              "numB": { "type": "integer", "minimum": 1, "maximum": 9 }
            },
            "required": ["numA", "numB"]
          },
          "isAdditiveTrap": { "type": "boolean" },
          "trapExplanation": { "type": ["string", "null"] },
          "correctFeedback": { "type": "string" }
        },
        "required": ["stage", "sceneA", "sceneB", "answer", "rule", "isAdditiveTrap", "correctFeedback"]
      }
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Pre-defined 10 rounds across 3 stages. Verified: all rules are simplest-form ratios, additive traps have matching differences but different ratios (or vice versa), Stage 3 rounds have Scene A presented before Scene B.

```javascript
const fallbackContent = {
  rounds: [
    // === STAGE 1: Easy Matches (Rounds 1-3) ===
    // Round 1 — Cookies and Milk
    {
      stage: 1,
      sceneA: {
        label: "Ria's snack plate: 2 cookies and 1 glass of milk",
        thingA: { name: 'cookies', nameSingular: 'cookie', emoji: '🍪', count: 2 },
        thingB: { name: 'glasses of milk', nameSingular: 'glass of milk', emoji: '🥛', count: 1 },
      },
      sceneB: {
        label: "Ria's party plate: 4 cookies and 2 glasses of milk",
        thingA: { name: 'cookies', nameSingular: 'cookie', emoji: '🍪', count: 4 },
        thingB: { name: 'glasses of milk', nameSingular: 'glass of milk', emoji: '🥛', count: 2 },
      },
      answer: 'same',
      rule: { numA: 2, numB: 1 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: "That's it! For every 2 cookies, 1 glass of milk — same rule, just bigger!",
    },
    // Round 2 — Flowers in a Garden
    {
      stage: 1,
      sceneA: {
        label: 'A small flower bed: 3 red flowers and 1 yellow flower',
        thingA: { name: 'red flowers', nameSingular: 'red flower', emoji: '🌺', count: 3 },
        thingB: { name: 'yellow flowers', nameSingular: 'yellow flower', emoji: '🌼', count: 1 },
      },
      sceneB: {
        label: 'A bigger flower bed: 6 red flowers and 2 yellow flowers',
        thingA: { name: 'red flowers', nameSingular: 'red flower', emoji: '🌺', count: 6 },
        thingB: { name: 'yellow flowers', nameSingular: 'yellow flower', emoji: '🌼', count: 2 },
      },
      answer: 'same',
      rule: { numA: 3, numB: 1 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: 'For every 3 red flowers, 1 yellow flower — the garden grew, but the pattern stayed!',
    },
    // Round 3 — Fish in a Tank
    {
      stage: 1,
      sceneA: {
        label: 'A small fish tank: 4 orange fish and 2 blue fish',
        thingA: { name: 'orange fish', nameSingular: 'orange fish', emoji: '🐠', count: 4 },
        thingB: { name: 'blue fish', nameSingular: 'blue fish', emoji: '🐟', count: 2 },
      },
      sceneB: {
        label: 'A bigger tank: 4 orange fish and 5 blue fish',
        thingA: { name: 'orange fish', nameSingular: 'orange fish', emoji: '🐠', count: 4 },
        thingB: { name: 'blue fish', nameSingular: 'blue fish', emoji: '🐟', count: 5 },
      },
      answer: 'different',
      rule: { numA: 2, numB: 1 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: "The small tank had 'for every 2 orange, 1 blue' — but the big tank doesn't follow that rule!",
    },

    // === STAGE 2: The Additive Trap (Rounds 4-7) ===
    // Round 4 — Birds and Squirrels in a Park
    {
      stage: 2,
      sceneA: {
        label: 'A park bench: 3 birds and 1 squirrel',
        thingA: { name: 'birds', nameSingular: 'bird', emoji: '🐦', count: 3 },
        thingB: { name: 'squirrels', nameSingular: 'squirrel', emoji: '🐿️', count: 1 },
      },
      sceneB: {
        label: 'A bigger park: 5 birds and 3 squirrels',
        thingA: { name: 'birds', nameSingular: 'bird', emoji: '🐦', count: 5 },
        thingB: { name: 'squirrels', nameSingular: 'squirrel', emoji: '🐿️', count: 3 },
      },
      answer: 'different',
      rule: { numA: 3, numB: 1 },
      isAdditiveTrap: true,
      trapExplanation:
        "Both times there were 2 more birds than squirrels. But the 'for every' rule changed! In the small park it was 'for every 3 birds, 1 squirrel.' In the big park it's different.",
      correctFeedback: "The difference was the same (2 more birds), but the 'for every' rule changed!",
    },
    // Round 5 — Rice and Dal Jars
    {
      stage: 2,
      sceneA: {
        label: 'A kitchen shelf: 2 jars of rice and 3 jars of dal',
        thingA: { name: 'jars of rice', nameSingular: 'jar of rice', emoji: '🍚', count: 2 },
        thingB: { name: 'jars of dal', nameSingular: 'jar of dal', emoji: '🫘', count: 3 },
      },
      sceneB: {
        label: 'A bigger shelf: 4 jars of rice and 6 jars of dal',
        thingA: { name: 'jars of rice', nameSingular: 'jar of rice', emoji: '🍚', count: 4 },
        thingB: { name: 'jars of dal', nameSingular: 'jar of dal', emoji: '🫘', count: 6 },
      },
      answer: 'same',
      rule: { numA: 2, numB: 3 },
      isAdditiveTrap: true,
      trapExplanation:
        "The difference changed — but the 'for every' rule stayed the same! For every 2 jars of rice, there are 3 jars of dal. That's what matters.",
      correctFeedback: "The difference changed (1 → 2), but the 'for every' rule held — for every 2 rice, 3 dal!",
    },
    // Round 6 — Beads on a Necklace
    {
      stage: 2,
      sceneA: {
        label: 'A friendship bracelet: 2 gold beads and 1 black bead',
        thingA: { name: 'gold beads', nameSingular: 'gold bead', emoji: '🟡', count: 2 },
        thingB: { name: 'black beads', nameSingular: 'black bead', emoji: '⚫', count: 1 },
      },
      sceneB: {
        label: 'A necklace: 4 gold beads and 3 black beads',
        thingA: { name: 'gold beads', nameSingular: 'gold bead', emoji: '🟡', count: 4 },
        thingB: { name: 'black beads', nameSingular: 'black bead', emoji: '⚫', count: 3 },
      },
      answer: 'different',
      rule: { numA: 2, numB: 1 },
      isAdditiveTrap: true,
      trapExplanation:
        "Both had 1 more gold bead than black. But look at the pattern — the bracelet was 'for every 2 gold, 1 black.' The necklace doesn't follow that rule.",
      correctFeedback: "Same difference (1 more gold), but different 'for every' rule!",
    },
    // Round 7 — Tables and Chairs
    {
      stage: 2,
      sceneA: {
        label: 'A small classroom: 1 table and 4 chairs',
        thingA: { name: 'tables', nameSingular: 'table', emoji: '🪑', count: 1 },
        thingB: { name: 'chairs', nameSingular: 'chair', emoji: '💺', count: 4 },
      },
      sceneB: {
        label: 'A bigger classroom: 3 tables and 12 chairs',
        thingA: { name: 'tables', nameSingular: 'table', emoji: '🪑', count: 3 },
        thingB: { name: 'chairs', nameSingular: 'chair', emoji: '💺', count: 12 },
      },
      answer: 'same',
      rule: { numA: 1, numB: 4 },
      isAdditiveTrap: true,
      trapExplanation:
        "Way more extra chairs in the big room! But the rule is the same — for every 1 table, there are 4 chairs. The difference changed, the rule didn't.",
      correctFeedback: 'The difference jumped from 3 to 9, but the rule held — for every 1 table, 4 chairs!',
    },

    // === STAGE 3: Kid Leads (Rounds 8-10) ===
    // Round 8 — Sunflowers and Pots
    {
      stage: 3,
      sceneA: {
        label: 'A garden display: 6 sunflowers in 3 pots',
        thingA: { name: 'sunflowers', nameSingular: 'sunflower', emoji: '🌻', count: 6 },
        thingB: { name: 'pots', nameSingular: 'pot', emoji: '🪴', count: 3 },
      },
      sceneB: {
        label: 'Another display: 9 sunflowers in 3 pots',
        thingA: { name: 'sunflowers', nameSingular: 'sunflower', emoji: '🌻', count: 9 },
        thingB: { name: 'pots', nameSingular: 'pot', emoji: '🪴', count: 3 },
      },
      answer: 'different',
      rule: { numA: 2, numB: 1 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: "Scene A was 'for every 2 sunflowers, 1 pot' — but Scene B has 3 sunflowers per pot. Different rule!",
    },
    // Round 9 — Sugar and Water for Lemonade
    {
      stage: 3,
      sceneA: {
        label: 'A lemonade recipe: 2 spoons of sugar and 5 cups of water',
        thingA: { name: 'spoons of sugar', nameSingular: 'spoon of sugar', emoji: '🥄', count: 2 },
        thingB: { name: 'cups of water', nameSingular: 'cup of water', emoji: '💧', count: 5 },
      },
      sceneB: {
        label: 'A bigger batch: 4 spoons of sugar and 10 cups of water',
        thingA: { name: 'spoons of sugar', nameSingular: 'spoon of sugar', emoji: '🥄', count: 4 },
        thingB: { name: 'cups of water', nameSingular: 'cup of water', emoji: '💧', count: 10 },
      },
      answer: 'same',
      rule: { numA: 2, numB: 5 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: 'For every 2 spoons of sugar, 5 cups of water — doubled the recipe, same taste!',
    },
    // Round 10 — Threads on a Loom
    {
      stage: 3,
      sceneA: {
        label: 'A weaving pattern: 3 red threads and 2 white threads',
        thingA: { name: 'red threads', nameSingular: 'red thread', emoji: '🔴', count: 3 },
        thingB: { name: 'white threads', nameSingular: 'white thread', emoji: '⚪', count: 2 },
      },
      sceneB: {
        label: 'A bigger loom: 9 red threads and 6 white threads',
        thingA: { name: 'red threads', nameSingular: 'red thread', emoji: '🔴', count: 9 },
        thingB: { name: 'white threads', nameSingular: 'white thread', emoji: '⚪', count: 6 },
      },
      answer: 'same',
      rule: { numA: 3, numB: 2 },
      isAdditiveTrap: false,
      trapExplanation: null,
      correctFeedback: "For every 3 red threads, 2 white threads — the loom got bigger but the pattern stayed!",
    },
  ],
};
```

---

## 5. Screens & HTML Structure

### Body HTML

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Stage label -->
    <p class="stage-label" id="stage-label" data-signal-id="stage-label"></p>

    <!-- Instruction text -->
    <p class="instruction-text" id="instruction-text" data-signal-id="instruction-text">
      Do these two scenes follow the same rule?
    </p>

    <!-- Scene A -->
    <div class="scene-card" id="scene-a-container" style="display: none" data-signal-id="scene-a">
      <div class="scene-badge">Scene A</div>
      <div class="scene-items" id="scene-a-items"></div>
      <p class="scene-label" id="scene-a-label"></p>
    </div>

    <!-- Scene B -->
    <div class="scene-card" id="scene-b-container" style="display: none" data-signal-id="scene-b">
      <div class="scene-badge">Scene B</div>
      <div class="scene-items" id="scene-b-items"></div>
      <p class="scene-label" id="scene-b-label"></p>
    </div>

    <!-- Choice Buttons -->
    <div class="choice-area" id="choice-area" style="display: none" data-signal-id="choice-area">
      <button
        class="game-btn btn-choice"
        id="btn-same"
        data-signal-id="btn-same"
        onclick="handleChoice('same')"
      >
        Same Rule
      </button>
      <button
        class="game-btn btn-choice"
        id="btn-different"
        data-signal-id="btn-different"
        onclick="handleChoice('different')"
      >
        Different Rule
      </button>
    </div>

    <!-- Sentence Builder -->
    <div class="sentence-builder" id="sentence-builder" style="display: none" data-signal-id="sentence-builder">
      <p class="builder-title" id="builder-title">What's the "for every" rule?</p>
      <div class="builder-row">
        <span class="builder-text">For every</span>
        <div class="number-stepper" id="stepper-a">
          <button class="stepper-btn" id="picker-a-minus" data-signal-id="picker-a-minus" onclick="handlePickerChange('a', -1)">−</button>
          <span class="stepper-value" id="picker-a-value">1</span>
          <button class="stepper-btn" id="picker-a-plus" data-signal-id="picker-a-plus" onclick="handlePickerChange('a', 1)">+</button>
        </div>
        <span class="builder-thing" id="thing-a-name"></span>
      </div>
      <div class="builder-row">
        <span class="builder-text">there are</span>
        <div class="number-stepper" id="stepper-b">
          <button class="stepper-btn" id="picker-b-minus" data-signal-id="picker-b-minus" onclick="handlePickerChange('b', -1)">−</button>
          <span class="stepper-value" id="picker-b-value">1</span>
          <button class="stepper-btn" id="picker-b-plus" data-signal-id="picker-b-plus" onclick="handlePickerChange('b', 1)">+</button>
        </div>
        <span class="builder-thing" id="thing-b-name"></span>
      </div>
      <!-- Stage 3 only: commit rule before seeing Scene B -->
      <button
        class="game-btn btn-primary"
        id="btn-commit-rule"
        style="display: none"
        data-signal-id="btn-commit-rule"
        onclick="handleCommitRule()"
      >
        I see the rule!
      </button>
    </div>

    <!-- Check Button (standalone, bottom) -->
    <button
      class="game-btn btn-primary"
      id="btn-check"
      style="display: none"
      data-signal-id="btn-check"
      onclick="handleCheck()"
    >
      Check
    </button>

    <!-- Feedback -->
    <div class="feedback-container" id="feedback-container" style="display: none" data-signal-id="feedback">
      <div class="feedback-icon" id="feedback-icon"></div>
      <p class="feedback-text" id="feedback-text"></p>
      <div class="feedback-explanation" id="feedback-explanation" style="display: none"></div>
      <button class="game-btn btn-primary" id="btn-next" data-signal-id="btn-next" onclick="nextRound()">
        Next
      </button>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display: none">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title" id="results-title">Game Complete!</h2>
      <p class="results-subtitle" id="results-subtitle"></p>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Score</span>
          <span class="metric-value" id="result-score">0/10</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span class="metric-value" id="result-accuracy">0%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Trap Rounds</span>
          <span class="metric-value" id="result-traps">0/4</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="btn-restart" onclick="restartGame()">
        Play Again
      </button>
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
  --mathai-light-green: #eafbf1;
  --mathai-red: #e35757;
  --mathai-light-red: #fdecec;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #ebf0ff;
  --mathai-gray: #828282;
  --mathai-light-gray: #f2f2f2;
  --mathai-white: #ffffff;
  --mathai-black: #1a1a2e;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 12px;
  --mathai-border-radius-card: 12px;
}

/* === Reset === */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-light-gray);
  color: var(--mathai-black);
  -webkit-font-smoothing: antialiased;
}

/* === Game Block === */
.game-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

/* === Stage Label === */
.stage-label {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

/* === Instruction Text === */
.instruction-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  text-align: center;
  line-height: 1.4;
  font-weight: 500;
  max-width: 340px;
}

/* === Scene Cards === */
.scene-card {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: var(--mathai-border-radius-card);
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.scene-card.slide-in {
  animation: slideIn 0.4s ease forwards;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scene-card.compress {
  transform: scale(0.92);
}

.scene-badge {
  display: inline-block;
  background: var(--mathai-light-blue);
  color: var(--mathai-blue);
  font-size: var(--mathai-font-size-small);
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 20px;
  margin-bottom: 10px;
}

.scene-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  padding: 12px 0;
  min-height: 48px;
}

.item-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.item-group + .item-group {
  margin-left: 8px;
}

.item-emoji {
  font-size: 28px;
  line-height: 1;
}

/* Grouping animation — applied during feedback */
.item-group.grouped {
  background: var(--mathai-light-green);
  box-shadow: 0 0 0 2px var(--mathai-green);
}

.scene-label {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  text-align: center;
  line-height: 1.4;
  margin-top: 8px;
}

/* === Choice Buttons === */
.choice-area {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 360px;
}

.btn-choice {
  flex: 1;
  padding: 14px 8px;
  border: 2px solid var(--mathai-light-gray);
  border-radius: var(--mathai-border-radius-card);
  background: var(--mathai-white);
  color: var(--mathai-black);
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
}

.btn-choice:hover {
  border-color: var(--mathai-blue);
  background: var(--mathai-light-blue);
}

.btn-choice.selected {
  border-color: var(--mathai-blue);
  background: var(--mathai-light-blue);
  color: var(--mathai-blue);
  font-weight: 700;
}

.btn-choice.correct {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
  color: var(--mathai-green);
}

.btn-choice.incorrect {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
  color: var(--mathai-red);
}

.btn-choice:disabled {
  cursor: default;
  opacity: 0.6;
}

/* === Sentence Builder === */
.sentence-builder {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: var(--mathai-border-radius-card);
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  animation: slideIn 0.3s ease forwards;
}

.builder-title {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-black);
  text-align: center;
  margin-bottom: 12px;
}

.builder-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.builder-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-gray);
  font-weight: 500;
}

.builder-thing {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  font-weight: 600;
}

/* Number Stepper */
.number-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 2px solid var(--mathai-light-gray);
  border-radius: 8px;
  overflow: hidden;
}

.stepper-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--mathai-light-gray);
  color: var(--mathai-black);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--mathai-font-family);
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover {
  background: #e0e0e0;
}

.stepper-btn:active {
  background: #d0d0d0;
}

.stepper-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.stepper-value {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  color: var(--mathai-blue);
  background: var(--mathai-white);
}

.number-stepper.locked {
  border-color: var(--mathai-gray);
  opacity: 0.6;
}

.number-stepper.locked .stepper-btn {
  cursor: default;
  pointer-events: none;
}

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
  max-width: 360px;
}

.btn-primary {
  background: var(--mathai-green);
  color: var(--mathai-white);
}

.btn-primary:hover {
  filter: brightness(0.9);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: default;
}

/* === Feedback Container === */
.feedback-container {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: var(--mathai-border-radius-card);
  padding: 20px 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  animation: slideIn 0.3s ease forwards;
}

.feedback-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.feedback-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  line-height: 1.5;
  margin-bottom: 12px;
  font-weight: 500;
}

.feedback-explanation {
  background: var(--mathai-light-blue);
  border-left: 4px solid var(--mathai-blue);
  padding: 12px;
  border-radius: 0 8px 8px 0;
  margin-bottom: 12px;
  text-align: left;
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-black);
  line-height: 1.5;
}

/* === Results Card (PART-019) === */
.results-card {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stars-display {
  font-size: 40px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.results-title {
  font-size: var(--mathai-font-size-title);
  margin-bottom: 8px;
  color: var(--mathai-black);
}

.results-subtitle {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  margin-bottom: 24px;
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
  color: var(--mathai-black);
}

/* === Utility === */
.hidden {
  display: none !important;
}
```

---

## 7. Game Flow

1. **Page loads** → DOMContentLoaded fires
   - waitForPackages(), FeedbackManager.init()
   - **SignalCollector init** (PART-010): `new SignalCollector({ sessionId, studentId, templateId })`
   - ScreenLayout.inject, clone template
   - ProgressBarComponent (totalRounds: 10, totalLives: 0)
   - TransitionScreen, VisibilityTracker (with signalCollector.pause/resume)
   - InteractionManager.init()
   - Show start transition screen

2. **startGame()** from start screen:
   - Load content from gameState.content or fallbackContent
   - Reset all game-specific state fields
   - Set startTime, isActive, duration_data.startTime
   - progressBar.update(0, 0)
   - trackEvent('game_start')
   - **recordViewEvent('screen_transition')** — ready → gameplay
   - Call showRound()

3. **showRound()** — renders the current round:
   - **Flush deferred endProblem** from previous round (if pending)
   - **signalCollector.startProblem()** for current round
   - Get current round data from content
   - Update stage label, instruction text
   - Reset UI: hide choice area, builder, feedback, check button
   - Reset gameState.userChoice, ruleNumA, ruleNumB, ruleCommitted
   - Render Scene A items (emojis in groups)
   - Show Scene A with slide-in animation
   - **recordViewEvent('content_render')** — round start
   - **If Stage 1-2:**
     - After 800ms delay, show Scene B with slide-in animation
     - Compress Scene A slightly
     - After 400ms, show choice buttons
     - Set phase = 'choosing'
   - **If Stage 3:**
     - Update instruction: "Look at Scene A. What's the 'for every' rule?"
     - Show sentence builder with "I see the rule!" button visible
     - Pre-fill thing names in builder
     - Set phase = 'building'

4. **Stage 1-2 interaction loop:**
   - Kid taps Same Rule or Different Rule → handleChoice()
     - Highlight selected button, dim other
     - Store userChoice
     - Show sentence builder (pre-fill thing names)
     - Show Check button
     - Set phase = 'building'
     - trackEvent('choice_made')
   - Kid adjusts number pickers → handlePickerChange()
     - Increment/decrement within 1-9 range
     - Update display, update thing name (singular/plural)
   - Kid taps Check → handleCheck()

5. **Stage 3 interaction loop:**
   - Kid adjusts pickers and taps "I see the rule!" → handleCommitRule()
     - Lock pickers (disabled, grey)
     - Set ruleCommitted = true
     - Render Scene B items
     - Show Scene B with slide-in animation
     - Show choice buttons
     - trackEvent('rule_committed')
     - Set phase = 'choosing'
   - Kid taps Same or Different → handleChoice()
     - Highlight selected button
     - Show Check button
     - trackEvent('choice_made')
   - Kid taps Check → handleCheck()

6. **handleCheck() — validate and show feedback:**
   - Determine correctness:
     - choiceCorrect = (userChoice === round.answer)
     - ruleCorrect = (ruleNumA === round.rule.numA && ruleNumB === round.rule.numB)
     - roundCorrect = choiceCorrect && ruleCorrect
   - recordAttempt with all data
   - If roundCorrect: score++, additiveTrapCorrect++ if isAdditiveTrap
   - If roundCorrect AND isAdditiveTrap: additiveTrapCorrect++
   - progressBar.update(currentRound + 1, 0)
   - **Defer endProblem** with outcome
   - showFeedback(roundCorrect, choiceCorrect, ruleCorrect, round)

7. **showFeedback(roundCorrect, choiceCorrect, ruleCorrect, round):**
   - Hide check button, choice area, builder
   - Set phase = 'feedback'
   - **If roundCorrect:**
     - Green checkmark icon, correctFeedback text
     - Animate grouping on both scenes (add .grouped class to item-groups)
     - Play correct sound
   - **If wrong:**
     - Gentle feedback icon
     - If choice wrong: show what the correct answer was
     - If rule wrong: show the correct "for every" numbers
     - Show correct grouping animation gently
     - Play soft incorrect sound
   - **If additive trap round and wrong:** show trapExplanation in callout box
   - Show feedback container with Next button
   - trackEvent('round_correct' or 'round_incorrect')
   - **recordViewEvent('feedback_display')**

8. **nextRound():**
   - currentRound++
   - If currentRound >= totalRounds → endGame()
   - Else → showRound()

9. **endGame():** (PART-011)
   - isActive = false, gameEnded = true
   - Stars calculation:
     - If score >= 8 AND additiveTrapCorrect >= 3 → 3 stars
     - If score >= 5 → 2 stars
     - If score >= 1 → 1 star
     - Else → 0 stars
   - trackEvent('game_end') BEFORE signal sealing
   - **Flush deferred endProblem** (PART-010)
   - **signalCollector.seal()** → signalPayload
   - **recordViewEvent('screen_transition')** — gameplay → results
   - showResults, postMessage with ...signalPayload
   - Cleanup: progressBar, visibilityTracker

---

## 8. Functions

### Global Scope (RULE-001)

**delay(ms)** — utility

- `return new Promise(resolve => setTimeout(resolve, ms))`

**getThingName(thing, num)** — singular/plural helper

- `return num === 1 ? thing.nameSingular : thing.name`

**renderScene(containerId, scene)** — populate scene with emoji groups

- Clear container
- Create .item-group div for thingA, append count × emoji spans
- Create .item-group div for thingB, append count × emoji spans
- Append both groups to container

**startGame()**

- const content = gameState.content || fallbackContent
- gameState.content = content
- gameState.currentRound = 0
- gameState.score = 0
- gameState.attempts = []
- gameState.events = []
- gameState.additiveTrapCorrect = 0
- gameState.userChoice = null
- gameState.ruleNumA = 1
- gameState.ruleNumB = 1
- gameState.ruleCommitted = false
- gameState.phase = 'idle'
- gameState.pendingEndProblem = null
- gameState.startTime = Date.now()
- gameState.isActive = true
- gameState.duration_data.startTime = new Date().toISOString()
- progressBar.update(0, 0)
- trackEvent('game_start', 'game')
- if (signalCollector) signalCollector.recordViewEvent('screen_transition', { screen: 'gameplay', metadata: { transition_from: 'start' } })
- showRound()

**async showRound()**

- // Flush deferred endProblem from previous round
- if (signalCollector && gameState.pendingEndProblem) { signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome); gameState.pendingEndProblem = null; }
- const roundIndex = gameState.currentRound
- const round = gameState.content.rounds[roundIndex]
- const roundNumber = roundIndex + 1
- // Start signal collection for this round
- if (signalCollector) { signalCollector.startProblem('round_' + roundNumber, { round_number: roundNumber, stage: round.stage, answer: round.answer, is_additive_trap: round.isAdditiveTrap }) }
- // Reset UI
- gameState.userChoice = null
- gameState.ruleNumA = 1
- gameState.ruleNumB = 1
- gameState.ruleCommitted = false
- document.getElementById('picker-a-value').textContent = '1'
- document.getElementById('picker-b-value').textContent = '1'
- document.getElementById('choice-area').style.display = 'none'
- document.getElementById('sentence-builder').style.display = 'none'
- document.getElementById('btn-check').style.display = 'none'
- document.getElementById('btn-commit-rule').style.display = 'none'
- document.getElementById('feedback-container').style.display = 'none'
- document.getElementById('scene-b-container').style.display = 'none'
- document.getElementById('scene-a-container').style.display = 'none'
- // Remove old selection classes
- document.getElementById('btn-same').classList.remove('selected', 'correct', 'incorrect')
- document.getElementById('btn-different').classList.remove('selected', 'correct', 'incorrect')
- document.getElementById('btn-same').disabled = false
- document.getElementById('btn-different').disabled = false
- document.getElementById('stepper-a').classList.remove('locked')
- document.getElementById('stepper-b').classList.remove('locked')
- // Enable stepper buttons
- document.querySelectorAll('.stepper-btn').forEach(btn => btn.disabled = false)
- // Remove grouping classes
- document.querySelectorAll('.item-group').forEach(g => g.classList.remove('grouped'))
- // Update stage label
- const stageLabels = { 1: 'Stage 1 — Easy Matches', 2: 'Stage 2 — The Additive Trap', 3: 'Stage 3 — You Lead!' }
- document.getElementById('stage-label').textContent = stageLabels[round.stage] || ''
- // Render Scene A
- renderScene('scene-a-items', round.sceneA)
- document.getElementById('scene-a-label').textContent = round.sceneA.label
- document.getElementById('scene-a-container').style.display = ''
- document.getElementById('scene-a-container').classList.add('slide-in')
- // Pre-fill thing names in builder
- document.getElementById('thing-a-name').textContent = round.sceneA.thingA.name
- document.getElementById('thing-b-name').textContent = round.sceneA.thingB.name
- // SignalCollector view event
- if (signalCollector) signalCollector.recordViewEvent('content_render', { screen: 'gameplay', content_snapshot: { round: roundNumber, stage: round.stage, scene_a_label: round.sceneA.label, trigger: 'round_start' }, components: { progress: { current: gameState.currentRound, total: gameState.totalRounds } } })
- if (round.stage === 3) {
    // Stage 3: show builder immediately, Scene B hidden
    document.getElementById('instruction-text').textContent = "Look at Scene A. What's the 'for every' rule?"
    await delay(600)
    document.getElementById('sentence-builder').style.display = ''
    document.getElementById('btn-commit-rule').style.display = ''
    document.getElementById('builder-title').textContent = "What's the 'for every' rule for Scene A?"
    gameState.phase = 'building'
  } else {
    // Stage 1-2: show both scenes, then choice
    document.getElementById('instruction-text').textContent = 'Do these two scenes follow the same rule?'
    await delay(800)
    renderScene('scene-b-items', round.sceneB)
    document.getElementById('scene-b-label').textContent = round.sceneB.label
    document.getElementById('scene-b-container').style.display = ''
    document.getElementById('scene-b-container').classList.add('slide-in')
    document.getElementById('scene-a-container').classList.add('compress')
    if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'scene_b_revealed', round: roundNumber } })
    await delay(400)
    document.getElementById('choice-area').style.display = ''
    gameState.phase = 'choosing'
  }

**handleChoice(choice)** (onclick handler — global scope)

- if (gameState.phase !== 'choosing' || !gameState.isActive) return
- gameState.userChoice = choice
- // Highlight selected button
- document.getElementById('btn-same').classList.toggle('selected', choice === 'same')
- document.getElementById('btn-different').classList.toggle('selected', choice === 'different')
- trackEvent('choice_made', 'choice-btn', { choice, round: gameState.currentRound + 1 })
- if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'choice_made', choice } })
- const round = gameState.content.rounds[gameState.currentRound]
- if (round.stage === 3) {
    // Stage 3: choice after rule commit — show Check button
    document.getElementById('btn-check').style.display = ''
  } else {
    // Stage 1-2: show sentence builder after choice
    document.getElementById('sentence-builder').style.display = ''
    document.getElementById('builder-title').textContent = "What's the 'for every' rule?"
    document.getElementById('btn-check').style.display = ''
    gameState.phase = 'building'
  }

**handlePickerChange(picker, delta)** (onclick handler — global scope)

- if (gameState.phase !== 'building' || !gameState.isActive) return
- const key = picker === 'a' ? 'ruleNumA' : 'ruleNumB'
- const newVal = Math.max(1, Math.min(9, gameState[key] + delta))
- gameState[key] = newVal
- document.getElementById('picker-' + picker + '-value').textContent = newVal
- // Update thing name for singular/plural
- const round = gameState.content.rounds[gameState.currentRound]
- const thing = picker === 'a' ? round.sceneA.thingA : round.sceneA.thingB
- document.getElementById('thing-' + picker + '-name').textContent = getThingName(thing, newVal)

**handleCommitRule()** (onclick handler — global scope, Stage 3 only)

- if (!gameState.isActive || gameState.ruleCommitted) return
- gameState.ruleCommitted = true
- // Lock pickers
- document.querySelectorAll('.stepper-btn').forEach(btn => btn.disabled = true)
- document.getElementById('stepper-a').classList.add('locked')
- document.getElementById('stepper-b').classList.add('locked')
- document.getElementById('btn-commit-rule').style.display = 'none'
- trackEvent('rule_committed', 'sentence-builder', { ruleNumA: gameState.ruleNumA, ruleNumB: gameState.ruleNumB, round: gameState.currentRound + 1 })
- if (signalCollector) signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'rule_committed', ruleNumA: gameState.ruleNumA, ruleNumB: gameState.ruleNumB } })
- // Reveal Scene B
- const round = gameState.content.rounds[gameState.currentRound]
- renderScene('scene-b-items', round.sceneB)
- document.getElementById('scene-b-label').textContent = round.sceneB.label
- document.getElementById('scene-b-container').style.display = ''
- document.getElementById('scene-b-container').classList.add('slide-in')
- document.getElementById('scene-a-container').classList.add('compress')
- document.getElementById('instruction-text').textContent = 'Now — does Scene B follow the same rule?'
- await delay(400)
- document.getElementById('choice-area').style.display = ''
- gameState.phase = 'choosing'

**async handleCheck()** (onclick handler — global scope)

- if (!gameState.isActive) return
- if (!gameState.userChoice) return // No choice made
- gameState.phase = 'feedback'
- const round = gameState.content.rounds[gameState.currentRound]
- const choiceCorrect = gameState.userChoice === round.answer
- const ruleCorrect = gameState.ruleNumA === round.rule.numA && gameState.ruleNumB === round.rule.numB
- const roundCorrect = choiceCorrect && ruleCorrect
- // Record attempt
- recordAttempt({
    input_of_user: {
      action: 'check',
      choice: gameState.userChoice,
      ruleNumA: gameState.ruleNumA,
      ruleNumB: gameState.ruleNumB,
    },
    correct: roundCorrect,
    metadata: {
      round: gameState.currentRound + 1,
      stage: round.stage,
      expectedChoice: round.answer,
      expectedRuleA: round.rule.numA,
      expectedRuleB: round.rule.numB,
      choiceCorrect,
      ruleCorrect,
      isAdditiveTrap: round.isAdditiveTrap,
      validationType: 'function',
    },
  })
- if (roundCorrect) {
    gameState.score++
    if (round.isAdditiveTrap) gameState.additiveTrapCorrect++
  }
- progressBar.update(gameState.currentRound + 1, 0)
- // Defer endProblem
- gameState.pendingEndProblem = { id: 'round_' + (gameState.currentRound + 1), outcome: { correct: roundCorrect, answer: { choice: gameState.userChoice, ruleA: gameState.ruleNumA, ruleB: gameState.ruleNumB } } }
- if (signalCollector) signalCollector.recordCustomEvent(roundCorrect ? 'round_correct' : 'round_incorrect', { round: gameState.currentRound + 1, stage: round.stage, choiceCorrect, ruleCorrect, isAdditiveTrap: round.isAdditiveTrap })
- await showFeedback(roundCorrect, choiceCorrect, ruleCorrect, round)

**async showFeedback(roundCorrect, choiceCorrect, ruleCorrect, round)**

- // Hide interactive elements
- document.getElementById('btn-check').style.display = 'none'
- document.getElementById('choice-area').style.display = 'none'
- document.getElementById('sentence-builder').style.display = 'none'
- // Show choice correctness on buttons briefly
- document.getElementById('btn-same').classList.add(round.answer === 'same' ? 'correct' : 'incorrect')
- document.getElementById('btn-different').classList.add(round.answer === 'different' ? 'correct' : 'incorrect')
- document.getElementById('btn-same').disabled = true
- document.getElementById('btn-different').disabled = true
- document.getElementById('choice-area').style.display = ''
- const feedbackIcon = document.getElementById('feedback-icon')
- const feedbackText = document.getElementById('feedback-text')
- const feedbackExplanation = document.getElementById('feedback-explanation')
- feedbackExplanation.style.display = 'none'
- if (roundCorrect) {
    feedbackIcon.textContent = '✅'
    feedbackText.textContent = round.correctFeedback
    // Animate grouping on scenes
    document.querySelectorAll('.item-group').forEach(g => g.classList.add('grouped'))
    try { await FeedbackManager.playDynamicFeedback({ audio_content: 'correct!', subtitle: '' }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
  } else {
    feedbackIcon.textContent = '💡'
    let explanation = ''
    if (!choiceCorrect && !ruleCorrect) {
      explanation = 'The answer was "' + (round.answer === 'same' ? 'Same Rule' : 'Different Rule') + '" — and the rule is: for every ' + round.rule.numA + ' ' + getThingName(round.sceneA.thingA, round.rule.numA) + ', there are ' + round.rule.numB + ' ' + getThingName(round.sceneA.thingB, round.rule.numB) + '.'
    } else if (!choiceCorrect) {
      explanation = 'Your rule was right! But it was actually "' + (round.answer === 'same' ? 'Same Rule' : 'Different Rule') + '." Look again at how the two scenes compare.'
    } else {
      explanation = 'Good eye on ' + (round.answer === 'same' ? 'Same' : 'Different') + ' Rule! But the "for every" rule is: for every ' + round.rule.numA + ' ' + getThingName(round.sceneA.thingA, round.rule.numA) + ', there are ' + round.rule.numB + ' ' + getThingName(round.sceneA.thingB, round.rule.numB) + '.'
    }
    feedbackText.textContent = explanation
    try { await FeedbackManager.playDynamicFeedback({ audio_content: 'not quite', subtitle: '' }); } catch(e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
  }
- // Show additive trap explanation if applicable
- if (round.isAdditiveTrap && round.trapExplanation) {
    feedbackExplanation.textContent = round.trapExplanation
    feedbackExplanation.style.display = ''
  }
- document.getElementById('feedback-container').style.display = ''
- trackEvent(roundCorrect ? 'round_correct' : 'round_incorrect', 'game', { round: gameState.currentRound + 1, choiceCorrect, ruleCorrect })
- if (signalCollector) signalCollector.recordViewEvent('feedback_display', { screen: 'gameplay', content_snapshot: { feedback_type: roundCorrect ? 'correct' : 'incorrect', round: gameState.currentRound + 1, stage: round.stage, choiceCorrect, ruleCorrect } })

**nextRound()** (onclick handler — global scope)

- gameState.currentRound++
- if (gameState.currentRound >= gameState.totalRounds) {
    endGame()
  } else {
    showRound()
  }

**async endGame()**

- if (gameState.gameEnded) return
- gameState.gameEnded = true
- gameState.isActive = false
- gameState.phase = 'idle'
- gameState.duration_data.currentTime = new Date().toISOString()
- const correctAttempts = gameState.attempts.filter(a => a.correct).length
- const totalAttempts = gameState.attempts.length
- const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0
- // Star calculation
- let stars = 0
- if (gameState.score >= 8 && gameState.additiveTrapCorrect >= 3) {
    stars = 3
  } else if (gameState.score >= 5) {
    stars = 2
  } else if (gameState.score >= 1) {
    stars = 1
  }
- const metrics = {
    accuracy,
    stars,
    attempts: gameState.attempts,
    duration_data: { ...gameState.duration_data, currentTime: new Date().toISOString() },
    score: gameState.score,
    totalRounds: gameState.totalRounds,
    additiveTrapCorrect: gameState.additiveTrapCorrect,
    totalTrapRounds: 4,
  }
- console.log('Final Metrics:', JSON.stringify(metrics, null, 2))
- console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2))
- trackEvent('game_end', 'game', { score: gameState.score, accuracy, stars, additiveTrapCorrect: gameState.additiveTrapCorrect })
- // Flush deferred endProblem before sealing (PART-010)
- if (signalCollector && gameState.pendingEndProblem) { signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome); gameState.pendingEndProblem = null; }
- // Seal SignalCollector (PART-010)
- const signalPayload = signalCollector ? signalCollector.seal() : { events: [], signals: {}, metadata: {} }
- if (gameState.score >= 8) {
    try { await FeedbackManager.playDynamicFeedback({ audio_content: "Amazing! You really understand the 'for every' rule!", subtitle: 'Incredible!' }); } catch(e) {}
  } else if (gameState.score >= 5) {
    try { await FeedbackManager.playDynamicFeedback({ audio_content: "Good job! You're getting the hang of it!", subtitle: 'Nice work!' }); } catch(e) {}
  } else {
    try { await FeedbackManager.playDynamicFeedback({ audio_content: "Keep practicing! The 'for every' pattern will click soon!", subtitle: 'Keep going!' }); } catch(e) {}
  }
- if (signalCollector) signalCollector.recordViewEvent('screen_transition', { screen: 'results', metadata: { transition_from: 'gameplay', stars, score: gameState.score } })
- showResults(metrics)
- window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*')
- if (progressBar) { progressBar.destroy(); progressBar = null; }
- if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
- try { FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll(); } catch(e) {}

**showResults(metrics)**

- document.getElementById('game-screen').style.display = 'none'
- document.getElementById('results-screen').style.display = 'flex'
- document.getElementById('results-title').textContent = metrics.stars >= 3 ? "You're a Ratio Detective!" : metrics.stars >= 2 ? 'Great Pattern Spotting!' : 'Keep Exploring!'
- document.getElementById('results-subtitle').textContent = "You spotted the 'for every' rule " + metrics.score + ' out of 10 times!'
- document.getElementById('result-score').textContent = metrics.score + '/' + metrics.totalRounds
- document.getElementById('result-accuracy').textContent = metrics.accuracy + '%'
- document.getElementById('result-traps').textContent = metrics.additiveTrapCorrect + '/' + metrics.totalTrapRounds
- const starsDisplay = document.getElementById('stars-display')
- starsDisplay.innerHTML = ''
- for (let i = 0; i < 3; i++) { starsDisplay.innerHTML += i < metrics.stars ? '⭐' : '☆'; }

**restartGame()** (onclick handler — global scope)

- gameState.gameEnded = false
- gameState.currentRound = 0
- gameState.score = 0
- gameState.attempts = []
- gameState.events = []
- gameState.isActive = false
- gameState.startTime = null
- gameState.phase = 'idle'
- gameState.userChoice = null
- gameState.ruleNumA = 1
- gameState.ruleNumB = 1
- gameState.additiveTrapCorrect = 0
- gameState.ruleCommitted = false
- gameState.pendingEndProblem = null
- gameState.duration_data = { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null }
- // Recreate SignalCollector
- signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(), studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null })
- window.signalCollector = signalCollector
- // Recreate progressBar
- progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 0, slotId: 'mathai-progress-slot' })
- // Recreate visibilityTracker
- visibilityTracker = new VisibilityTracker({
    onInactive: () => {
      if (signalCollector) signalCollector.pause();
      try { FeedbackManager.sound.stopAll(); } catch(e) {}
      gameState.duration_data.inActiveTime.push({ start: Date.now() });
    },
    onResume: () => {
      if (signalCollector) signalCollector.resume();
      const last = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
      if (last && !last.end) { last.end = Date.now(); gameState.duration_data.totalInactiveTime += (last.end - last.start); }
    }
  })
- document.getElementById('results-screen').style.display = 'none'
- document.getElementById('game-screen').style.display = 'flex'
- transitionScreen.show({ icons: ['⚖️'], iconSize: 'large', title: 'Same Rule?', subtitle: "Compare scenes and find the 'for every' pattern!", buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }] })

**handlePostMessage(event)**

- if (!event.data || event.data.type !== 'game_init') return
- try: gameState.content = event.data.data.content
- catch(e): console.error('PostMessage error:', JSON.stringify({ error: e.message }, null, 2))

**recordAttempt(data)**

- Standard attempt shape from PART-009:
- gameState.attempts.push({ ...data, attempt_number: gameState.attempts.length + 1, attempt_timestamp: new Date().toISOString(), time_since_start: gameState.startTime ? Date.now() - gameState.startTime : 0 })
- gameState.duration_data.attempts.push(new Date().toISOString())

**trackEvent(type, target, data = {})**

- Standard event tracking from PART-010:
- gameState.events.push({ type, target, data, timestamp: new Date().toISOString() })

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // Sentry initialization (PART-030)
    try {
      const sentryConfig = new SentryConfig({
        gameId: 'game_same_rule',
        version: '1.0.0',
      });
      Sentry.init(sentryConfig.getConfig());
    } catch (e) {
      console.error('Sentry init error:', JSON.stringify({ error: e.message }, null, 2));
    }

    // SignalCollector init (PART-010)
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null,
    });
    window.signalCollector = signalCollector;

    // InteractionManager init (PART-038)
    interactionManager = new InteractionManager();

    const layout = ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
    const gameContent = document.getElementById('gameContent');
    const template = document.getElementById('game-template');
    gameContent.appendChild(template.content.cloneNode(true));

    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: 10,
      totalLives: 0,
      slotId: 'mathai-progress-slot',
    });
    transitionScreen = new TransitionScreenComponent({ autoInject: true });
    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        if (signalCollector) signalCollector.pause();
        try {
          FeedbackManager.sound.stopAll();
        } catch (e) {}
        gameState.duration_data.inActiveTime.push({ start: Date.now() });
      },
      onResume: () => {
        if (signalCollector) signalCollector.resume();
        const last = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (last && !last.end) {
          last.end = Date.now();
          gameState.duration_data.totalInactiveTime += last.end - last.start;
        }
      },
    });

    if (!gameState.content) gameState.content = fallbackContent;
    window.addEventListener('message', handlePostMessage);
    window.parent.postMessage({ type: 'game_ready' }, '*');

    transitionScreen.show({
      icons: ['⚖️'],
      iconSize: 'large',
      title: 'Same Rule?',
      subtitle: "Compare scenes and find the 'for every' pattern!",
      buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }],
    });
  } catch (e) {
    console.error('Init error:', JSON.stringify({ error: e.message }, null, 2));
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = () => {
  console.log(
    'Game State:',
    JSON.stringify(
      {
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        score: gameState.score,
        phase: gameState.phase,
        userChoice: gameState.userChoice,
        ruleNumA: gameState.ruleNumA,
        ruleNumB: gameState.ruleNumB,
        ruleCommitted: gameState.ruleCommitted,
        additiveTrapCorrect: gameState.additiveTrapCorrect,
        isActive: gameState.isActive,
        pendingEndProblem: gameState.pendingEndProblem,
      },
      null,
      2,
    ),
  );
};
window.debugAudio = () => {
  console.log('FeedbackManager available:', typeof FeedbackManager !== 'undefined');
};
window.testAudio = async (id) => {
  try {
    await FeedbackManager.playDynamicFeedback({ audio_content: id || 'test', subtitle: '' });
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }, null, 2));
  }
};
window.testPause = () => {
  // No timer in this game
  console.log('No timer — game has no time pressure');
};
window.testResume = () => {
  console.log('No timer — game has no time pressure');
};
window.debugSignals = () => {
  if (signalCollector) {
    console.log('Signal Debug:', JSON.stringify(signalCollector.debug(), null, 2));
  } else {
    console.log('SignalCollector not initialized');
  }
};

// Window exposure block
window.handleChoice = handleChoice;
window.handlePickerChange = handlePickerChange;
window.handleCommitRule = handleCommitRule;
window.handleCheck = handleCheck;
window.nextRound = nextRound;
window.restartGame = restartGame;
window.startGame = startGame;
```

---

## 9. Event Schema

### Game Lifecycle Events

| Event      | Target | When Fired  |
| ---------- | ------ | ----------- |
| game_start | game   | startGame() |
| game_end   | game   | endGame()   |

### Game-Specific Events

| Event           | Target           | When Fired                           | Data                                   |
| --------------- | ---------------- | ------------------------------------ | -------------------------------------- |
| choice_made     | choice-btn       | Kid taps Same Rule or Different Rule | { choice, round }                      |
| rule_committed  | sentence-builder | Stage 3: kid taps "I see the rule!"  | { ruleNumA, ruleNumB, round }          |
| round_correct   | game             | Check validates — correct            | { round, choiceCorrect, ruleCorrect }  |
| round_incorrect | game             | Check validates — incorrect          | { round, choiceCorrect, ruleCorrect }  |

### SignalCollector View Events

| View Type         | When Emitted                                                            | Key Data                                      |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| screen_transition | startGame (start→gameplay), endGame (gameplay→results)                  | screen, metadata.transition_from              |
| content_render    | showRound — new round starts                                            | round, stage, scene_a_label, trigger          |
| visual_update     | Scene B revealed, choice made, rule committed                           | type (scene_b_revealed/choice_made/rule_committed) |
| feedback_display  | showFeedback — after validation                                         | feedback_type, round, stage, choiceCorrect, ruleCorrect |

### SignalCollector Problem Lifecycle

| Method                | When Called                                               | Data                                         |
| --------------------- | --------------------------------------------------------- | -------------------------------------------- |
| startProblem          | showRound() — after flush                                 | 'round_N' with round_number, stage, answer   |
| endProblem (deferred) | showRound() / endGame() — flush from pendingEndProblem    | correct, answer (choice + rule values)       |
| recordCustomEvent     | handleCheck — round_correct or round_incorrect            | round, stage, choiceCorrect, ruleCorrect     |
| seal()                | endGame() — before postMessage                            | Returns { events, signals, metadata }        |

---

## 10. Scaffold Points

| Point            | Function       | When                          | What Can Be Injected                              |
| ---------------- | -------------- | ----------------------------- | ------------------------------------------------- |
| after_incorrect  | showFeedback() | Kid answers incorrectly       | Enhanced explanation, visual grouping highlight    |
| before_round     | showRound()    | New round starts              | Difficulty preview, strategy tip for trap rounds   |
| after_trap_wrong | showFeedback() | Kid falls for additive trap   | Extra worked example, side-by-side comparison      |
| on_stage_change  | showRound()    | Moving to stage 2 or 3        | Stage introduction, new mechanic explanation       |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 11. Feedback Triggers

| Moment              | Trigger Function | Feedback Type           | Notes                              |
| ------------------- | ---------------- | ----------------------- | ---------------------------------- |
| Scene A appears     | showRound()      | subtle slide-in         | CSS animation only, no audio       |
| Scene B slides in   | showRound()      | slide-in animation      | CSS animation only                 |
| Correct answer      | showFeedback()   | dynamic TTS + grouping  | "correct!" + items group visually  |
| Incorrect answer    | showFeedback()   | dynamic TTS             | "not quite" — gentle, not punishing |
| Trap explanation    | showFeedback()   | visual callout          | Blue-bordered explanation box      |
| Game end (3★)       | endGame()        | dynamic TTS celebration | Celebratory message                |
| Game end (2★)       | endGame()        | dynamic TTS encouraging | "Good job!" energy                 |
| Game end (1★)       | endGame()        | dynamic TTS supportive  | "Keep going!" energy               |

### Audio Pattern

This game uses `FeedbackManager.playDynamicFeedback()` exclusively (no pre-registered sound IDs). All audio is TTS-generated from text content. No `FeedbackManager.sound.preload()` needed.

---

## 12. Visual Specifications

- **Layout:** Vertical stack of scene cards, max-width 360px, centered, 12px gap between sections
- **Color palette:** CSS variables throughout. Scene cards white with light shadow. Choice buttons white with blue highlight on selection. Feedback green/blue accents.
- **Typography:** var(--mathai-font-family), title 24px, body 16px, label 14px, small 12px
- **Spacing:** Container padding 12px 16px, scene card padding 16px, builder padding 16px
- **Interactive states:** Choice buttons — border highlight on hover, blue fill on selected, green/red on correct/incorrect result. Stepper buttons — hover darken, disabled opacity 0.3. Locked steppers — grey border, reduced opacity.
- **Transitions:** Scene cards slide in (translateY 20px→0, 0.4s ease). Sentence builder slides in (0.3s). Feedback slides in (0.3s). Scene A compresses (scale 0.92) when Scene B appears.
- **Emojis:** 28px font-size, centered in flex-wrap groups with 4px gap within groups, 8px gap between groups
- **Responsive:** Max-width 480px wrapper, 100dvh, all elements scale within container. Touch targets minimum 44px.

---

## 13. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers

```
SETUP: Page loaded, TransitionScreen start dismissed, gameState.isActive === true
ACTIONS:
  // Round 1 (Stage 1): Same Rule, rule 2:1
  Wait for #scene-a-container visible AND #scene-b-container visible AND #choice-area visible
  Click #btn-same
  Wait for #sentence-builder visible
  Click #picker-a-plus (value → 2)
  // picker-b stays at 1
  Click #btn-check
  Wait for #feedback-container visible
  Click #btn-next

  // Round 2 (Stage 1): Same Rule, rule 3:1
  Wait for #scene-a-container visible AND #scene-b-container visible
  Click #btn-same
  Click #picker-a-plus twice (value → 3)
  Click #btn-check
  Click #btn-next

  // Round 3 (Stage 1): Different Rule, rule 2:1
  Wait for #scene-a-container visible AND #scene-b-container visible
  Click #btn-different
  Click #picker-a-plus (value → 2)
  Click #btn-check
  Click #btn-next

  // Round 4 (Stage 2, trap): Different Rule, rule 3:1
  Click #btn-different
  Click #picker-a-plus twice (value → 3)
  Click #btn-check
  Click #btn-next

  // Round 5 (Stage 2, trap): Same Rule, rule 2:3
  Click #btn-same
  Click #picker-a-plus (value → 2)
  Click #picker-b-plus twice (value → 3)
  Click #btn-check
  Click #btn-next

  // Round 6 (Stage 2, trap): Different Rule, rule 2:1
  Click #btn-different
  Click #picker-a-plus (value → 2)
  Click #btn-check
  Click #btn-next

  // Round 7 (Stage 2, trap): Same Rule, rule 1:4
  Click #btn-same
  Click #picker-b-plus three times (value → 4)
  Click #btn-check
  Click #btn-next

  // Round 8 (Stage 3): rule 2:1, Different Rule
  Wait for #sentence-builder visible AND #btn-commit-rule visible
  Click #picker-a-plus (value → 2)
  Click #btn-commit-rule
  Wait for #scene-b-container visible AND #choice-area visible
  Click #btn-different
  Click #btn-check
  Click #btn-next

  // Round 9 (Stage 3): rule 2:5, Same Rule
  Click #picker-a-plus (value → 2)
  Click #picker-b-plus four times (value → 5)
  Click #btn-commit-rule
  Click #btn-same
  Click #btn-check
  Click #btn-next

  // Round 10 (Stage 3): rule 3:2, Same Rule
  Click #picker-a-plus twice (value → 3)
  Click #picker-b-plus (value → 2)
  Click #btn-commit-rule
  Click #btn-same
  Click #btn-check
ASSERT:
  gameState.score == 10
  gameState.additiveTrapCorrect == 4
  #results-screen is visible
  #result-score text is "10/10"
  #result-accuracy text is "100%"
  #result-traps text is "4/4"
  stars display shows 3 stars
  signalCollector.seal() was called
  postMessage data includes events, signals, metadata keys
```

### Scenario: Stage 1 round — correct Same Rule choice

```
SETUP: Page loaded, game started, round 1 active (Stage 1)
ACTIONS:
  Wait for #scene-a-container visible
  Wait for #scene-b-container visible
  Wait for #choice-area visible
  Click #btn-same
ASSERT:
  #btn-same has class .selected
  #btn-different does NOT have class .selected
  gameState.userChoice == 'same'
  #sentence-builder is visible
  #btn-check is visible
  #thing-a-name text is 'cookies'
  #thing-b-name text is 'glasses of milk'
```

### Scenario: Incorrect choice on round 1

```
SETUP: Page loaded, game started, round 1
ACTIONS:
  Click #btn-different
  Click #picker-a-plus (value → 2)
  Click #btn-check
ASSERT:
  #feedback-container visible
  #feedback-icon text is '💡' (not ✅)
  gameState.attempts[0].correct == false
  gameState.score == 0
  #btn-different has class .incorrect
  #btn-same has class .correct
```

### Scenario: Incorrect rule numbers on round 1

```
SETUP: Page loaded, game started, round 1
ACTIONS:
  Click #btn-same
  Click #picker-a-plus four times (value → 5)
  Click #picker-b-plus two times (value → 3)
  Click #btn-check
ASSERT:
  gameState.attempts[0].correct == false
  gameState.attempts[0].metadata.choiceCorrect == true
  gameState.attempts[0].metadata.ruleCorrect == false
  #feedback-container visible
  feedback text mentions correct rule numbers
```

### Scenario: Additive trap round with trap explanation

```
SETUP: Play through rounds 1-3 correctly, now on round 4 (Stage 2 additive trap)
ACTIONS:
  // Round 4: Birds and Squirrels, answer is 'different'
  Click #btn-same (WRONG — falling for the trap)
  Click #picker-a-plus twice (value → 3)
  Click #btn-check
ASSERT:
  gameState.attempts[3].correct == false
  gameState.additiveTrapCorrect == 0
  #feedback-explanation is visible
  #feedback-explanation text contains "2 more birds than squirrels"
  #feedback-explanation text contains "for every"
```

### Scenario: Stage 3 round — full flow with rule commit

```
SETUP: Play through rounds 1-7 correctly, now on round 8 (Stage 3)
ACTIONS:
  Wait for #scene-a-container visible
  // Scene B should NOT be visible yet
  Assert #scene-b-container is NOT visible
  Assert #choice-area is NOT visible
  Assert #sentence-builder is visible
  Assert #btn-commit-rule is visible
  // Fill rule: 2 sunflowers per 1 pot
  Click #picker-a-plus (value → 2)
  Click #btn-commit-rule
ASSERT:
  #scene-b-container is now visible
  #choice-area is now visible
  .number-stepper has class .locked
  stepper buttons are disabled
  gameState.ruleCommitted == true
ACTIONS:
  Click #btn-different
  Click #btn-check
ASSERT:
  gameState.attempts[7].correct == true
  gameState.score == 8
```

### Scenario: Number picker bounds (1-9)

```
SETUP: Page loaded, sentence builder visible
ACTIONS:
  Click #picker-a-minus (try to go below 1)
ASSERT:
  #picker-a-value text is still '1'
  gameState.ruleNumA == 1
ACTIONS:
  Click #picker-a-plus 8 times (value → 9)
  Click #picker-a-plus (try to go above 9)
ASSERT:
  #picker-a-value text is '9'
  gameState.ruleNumA == 9
```

### Scenario: Thing name updates singular/plural with picker

```
SETUP: Round 1 active, sentence builder visible
ACTIONS:
  // picker-a starts at 1
  Assert #thing-a-name text is 'cookie' (singular)
  Click #picker-a-plus (value → 2)
ASSERT:
  #thing-a-name text is 'cookies' (plural)
ACTIONS:
  Click #picker-a-minus (value → 1)
ASSERT:
  #thing-a-name text is 'cookie' (singular)
```

### Scenario: Game ends after all 10 rounds

```
SETUP: Complete all 10 rounds (any mix of correct/incorrect)
ASSERT:
  gameState.isActive == false
  gameState.gameEnded == true
  game_complete postMessage sent
  metrics contains: score, totalRounds, stars, accuracy, additiveTrapCorrect, totalTrapRounds, attempts, duration_data
  postMessage data includes ...signalPayload (events, signals, metadata from SignalCollector)
```

### Scenario: Star rating logic

```
ASSERT:
  10 correct + 4/4 traps → 3 stars
  8 correct + 3/4 traps → 3 stars
  8 correct + 2/4 traps → 2 stars (not enough traps for 3★)
  7 correct → 2 stars
  5 correct → 2 stars
  4 correct → 1 star
  0 correct → 0 stars
```

### Scenario: Restart resets everything

```
SETUP: Game completed, results screen visible
ACTIONS:
  Click #btn-restart
ASSERT:
  #results-screen is hidden
  #game-screen is visible
  gameState.score == 0
  gameState.currentRound == 0
  gameState.additiveTrapCorrect == 0
  gameState.userChoice == null
  gameState.ruleCommitted == false
  gameState.pendingEndProblem == null
  signalCollector recreated (new instance)
  progressBar, visibilityTracker recreated
  transition screen shows
```

### Scenario: PostMessage game_init loads custom content

```
SETUP: Page loaded
ACTIONS:
  Send postMessage { type: 'game_init', data: { content: { rounds: [/* custom 10 rounds */] } } }
ASSERT:
  gameState.content.rounds.length == 10
  gameState.content matches sent data
```

### Scenario: VisibilityTracker pauses/resumes SignalCollector

```
SETUP: Game active
ACTIONS:
  Trigger visibility change (tab hidden)
ASSERT:
  signalCollector.pause() called
  FeedbackManager.sound.stopAll() called
  duration_data.inActiveTime has new entry with start timestamp
ACTIONS:
  Trigger visibility change (tab visible)
ASSERT:
  signalCollector.resume() called
  duration_data.inActiveTime last entry has end timestamp
  duration_data.totalInactiveTime is updated
```

---

## 14. Verification Checklist

### Structural

- [ ] DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002)
- [ ] Single style + single script (RULE-007)
- [ ] #app, #game-screen, #results-screen
- [ ] `<template id="game-template">` wraps game content
- [ ] `data-signal-id` on stage-label, instruction-text, scene-a, scene-b, choice-area, btn-same, btn-different, sentence-builder, picker buttons, btn-commit-rule, btn-check, feedback, btn-next, btn-restart

### Functional

- [ ] waitForPackages with 10s timeout (PART-003)
- [ ] Init sequence correct (PART-004)
- [ ] VisibilityTracker with signalCollector.pause/resume (PART-005)
- [ ] No TimerComponent — game has no timer (PART-006: NO)
- [ ] PostMessage handling (PART-008)
- [ ] Fallback content with 10 rounds of verified data (PART-008)
- [ ] recordAttempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] `gameId: 'game_same_rule'` is first property in gameState
- [ ] `gameEnded` flag in gameState, checked/set in endGame, reset in restartGame
- [ ] `window.parent.postMessage({ type: 'game_ready' }, '*')` after message listener registration
- [ ] Sentry initialized via SentryConfig in DOMContentLoaded (PART-030)
- [ ] Window exposure block: handleChoice, handlePickerChange, handleCommitRule, handleCheck, nextRound, restartGame, startGame
- [ ] endGame: double-call guard via gameEnded, flush deferred endProblem → seal SignalCollector → show results → postMessage with signalPayload → cleanup (PART-011)
- [ ] Debug functions on window (PART-012)
- [ ] Validation function: userChoice matches answer AND ruleNumA/ruleNumB match rule (PART-014)
- [ ] showResults populates all fields (PART-019)
- [ ] No anti-patterns (PART-026)
- [ ] InteractionManager initialized (PART-038)

### SignalCollector (PART-010)

- [ ] `signalCollector` variable declared at top level
- [ ] SignalCollector initialized in DOMContentLoaded after FeedbackManager.init()
- [ ] `window.signalCollector` assigned
- [ ] `gameState.pendingEndProblem` field in gameState
- [ ] `startProblem('round_N')` called in showRound() after flushing previous
- [ ] Deferred `endProblem` pattern: pendingEndProblem set in handleCheck
- [ ] Flush in showRound() before startProblem
- [ ] Flush in endGame() before seal()
- [ ] `seal()` called in endGame AFTER flush, BEFORE postMessage
- [ ] `...signalPayload` spread in postMessage data
- [ ] `recordViewEvent('screen_transition')` in startGame and endGame
- [ ] `recordViewEvent('content_render')` in showRound (round start)
- [ ] `recordViewEvent('feedback_display')` in showFeedback
- [ ] `recordViewEvent('visual_update')` in showRound (scene B revealed), handleChoice, handleCommitRule
- [ ] `recordCustomEvent('round_correct')` / `recordCustomEvent('round_incorrect')` in handleCheck
- [ ] `signalCollector.pause()` in VisibilityTracker onInactive
- [ ] `signalCollector.resume()` in VisibilityTracker onResume
- [ ] SignalCollector recreated in restartGame()
- [ ] `window.debugSignals` function attached
- [ ] **No inline SignalCollector stub** (Anti-Pattern 18)

### Design & Layout

- [ ] CSS variables (PART-020)
- [ ] Gameplay feedback uses correct colors — green/blue/red for correct/info/incorrect (PART-020)
- [ ] `.page-center` / `.game-wrapper` / `.game-stack` layout structure (PART-021)
- [ ] 480px max, 100dvh (PART-021)
- [ ] game-btn + btn-primary (PART-022)
- [ ] ProgressBar: 10 rounds, 0 lives (PART-023)
- [ ] update() with rounds COMPLETED (PART-023)
- [ ] TransitionScreen: start screen (PART-024)
- [ ] ScreenLayout.inject before components (PART-025)
- [ ] Template cloneNode (PART-025)

### Rules

- [ ] RULE-001: All onclick handlers (handleChoice, handlePickerChange, handleCommitRule, handleCheck, nextRound, restartGame) in global scope + window exposure block
- [ ] RULE-002: All async functions have async keyword (showRound, handleCommitRule, handleCheck, showFeedback, endGame)
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame: progressBar, visibilityTracker, audio
- [ ] RULE-006: No new Audio(), setInterval for timer, SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific

- [ ] Scene A renders emoji items grouped by thingA and thingB
- [ ] Scene B hidden initially in Stage 3, visible in Stages 1-2
- [ ] Choice buttons: #btn-same and #btn-different with .selected class on tap
- [ ] Sentence builder shows after choice (stages 1-2) or before Scene B (stage 3)
- [ ] Number pickers bounded 1-9, steppers with − and + buttons
- [ ] Thing names update singular/plural based on picker value (getThingName helper)
- [ ] Stage 3 "I see the rule!" button locks pickers and reveals Scene B
- [ ] Locked steppers show .locked class, stepper-btn disabled
- [ ] Validation checks BOTH choice AND rule numbers
- [ ] additiveTrapCorrect incremented only when trap round answered correctly
- [ ] Star rating: 3★ requires score≥8 AND trapCorrect≥3; 2★ requires score≥5; 1★ requires score≥1
- [ ] Trap explanation shown in .feedback-explanation for all additive trap rounds (correct or incorrect)
- [ ] Grouping animation (.grouped class) on item-groups during correct feedback
- [ ] Choice buttons show .correct/.incorrect classes during feedback
- [ ] Results subtitle: "You spotted the 'for every' rule X out of 10 times!"
- [ ] Results show trap round score (X/4)
- [ ] progressBar.update called with (roundsCompleted, 0) — no lives
- [ ] Dynamic audio uses FeedbackManager.playDynamicFeedback, not new Audio()
- [ ] `window.gameState`, restartGame recreates all components + signalCollector
- [ ] Phase machine prevents double-taps: handleChoice checks phase === 'choosing'

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
- [ ] postMessage data includes ...signalPayload (events, signals, metadata from SignalCollector)
