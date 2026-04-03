# Assembly Book: Word Problem Workshop

---

## 1. Game Identity

```
- Title: Word Problem Workshop
- Game ID: word-problem-workshop
- Type: standard
- Description: See a math expression, then write a real-world word problem that matches it. The game evaluates whether your word problem correctly represents the expression using AI — there is no single "right answer." 10 rounds across 3 stages (simple operations, multi-step, mixed operations). No lives — low-stakes exploratory. Star rating at end based on total points earned.
- Learning Goal: Mathematical Reasoning & Communication for Grade 4. The kid builds the habit of connecting abstract math expressions to real-world situations. They learn that math lives in everyday life and that the same expression can tell many different stories.
- Skills covered: 1 (translating math expressions to word problems) & 2 (demonstrating understanding of operation meaning)
- Grade: 4
- Bloom level: L3 Apply → L5 Evaluate
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
| PART-006 | TimerComponent | NO | No timer — low-stakes exploratory |
| PART-007 | Game State Object | YES | Custom fields: wordProblemText, evaluationResult, feedbackText, totalPoints |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | — |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: game_ready, word_problem_submit, evaluation_complete, round_complete |
| PART-011 | End Game & Metrics | YES | Star logic based on totalPoints (see Section 8) |
| PART-012 | Debug Functions | YES | — |
| PART-013 | Validation Fixed | NO | — |
| PART-014 | Validation Function | NO | No deterministic check — primary evaluation is 100% LLM |
| PART-015 | Validation LLM | YES | **PRIMARY** evaluation via `subjectiveEvaluation()` — evaluates word problem correctness AND quality |
| PART-016 | StoriesComponent | NO | — |
| PART-017 | Feedback Integration | YES | Audio: correct_tap, wrong_tap. Stickers: correct/incorrect GIFs, trophy Lottie. Dynamic TTS for evaluation feedback + end-game. |
| PART-018 | Case Converter | NO | — |
| PART-019 | Results Screen UI | YES | Custom metrics: total points, correct problems, best round |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | — |
| PART-022 | Game Buttons | YES | Submit Word Problem button |
| PART-023 | ProgressBar Component | YES | totalRounds: 10, totalLives: 0 (no lives) |
| PART-024 | TransitionScreen Component | YES | Screens: start, stage-transition, victory |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | — |
| PART-027 | Play Area Construction | YES | Layout: expression card + word problem textarea + feedback area |
| PART-028 | InputSchema Patterns | YES | Schema type: rounds with expressions + operations + rubrics |
| PART-029 | Story-Only Game | NO | — |
| PART-030 | Sentry Error Tracking | YES | — |
| PART-033 | Interaction Patterns | YES | Patterns: textarea (word problem), buttons |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | — |
| PART-035 | Test Plan Generation | YES (POST_GEN) | — |
| PART-037 | Playwright Testing | YES (POST_GEN) | — |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'word-problem-workshop',    // GEN-GAMEID: MUST be first property
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,               // GEN-ENDGAME-GUARD: used by endGame() guard
  phase: 'start',                 // start | writing | evaluating | feedback | transition | results
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
  currentStage: 1,                // 1=simple operations, 2=multi-step, 3=mixed operations
  totalPoints: 0,                 // Accumulated points (max 3 per round = 30 total)
  wordProblemText: '',            // Kid's written word problem for current round
  evaluationResult: null,         // 'correct_match' | 'partial_match' | 'no_match' — determined by LLM
  feedbackText: '',               // LLM-generated feedback for current round
  roundData: null,                // Current round's content data
  correctCount: 0,                // Running total of fully correct (correct_match) rounds
  partialCount: 0,                // Running total of partial_match rounds
  contentSetId: null,             // Set from game_init postMessage
  signalConfig: null,             // Set from game_init postMessage (flushUrl, playId, etc.)
  sessionHistory: [],             // Accumulated per-session results for restart tracking
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
  "title": "WordProblemWorkshopContent",
  "description": "Content schema for the 'Word Problem Workshop' game",
  "type": "object",
  "required": ["gameId", "rounds"],
  "properties": {
    "gameId": {
      "type": "string",
      "const": "word-problem-workshop"
    },
    "rounds": {
      "type": "array",
      "minItems": 10,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["roundNumber", "stage", "expression", "expressionDisplay", "result", "operation", "rubric", "exampleWordProblem", "hints"],
        "properties": {
          "roundNumber": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10
          },
          "stage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3,
            "description": "Stage 1 = simple operations, Stage 2 = multi-step, Stage 3 = mixed operations"
          },
          "expression": {
            "type": "string",
            "description": "The math expression in code form (e.g., '3 * 4 + 2')"
          },
          "expressionDisplay": {
            "type": "string",
            "description": "The math expression in display form with proper symbols (e.g., '3 x 4 + 2 = 14')"
          },
          "result": {
            "type": "number",
            "description": "The numerical result of the expression"
          },
          "operation": {
            "type": "string",
            "enum": ["addition", "subtraction", "multiplication", "division", "multi-step", "mixed"],
            "description": "The primary operation type for this round"
          },
          "rubric": {
            "type": "string",
            "description": "LLM rubric describing what a correct word problem for THIS expression looks like. Must mention the specific operations, quantities, and relationships that should be present."
          },
          "exampleWordProblem": {
            "type": "string",
            "description": "One example of a correct word problem for this expression. Shown as a hint if the kid struggles."
          },
          "hints": {
            "type": "object",
            "required": ["thinkAbout", "revealExplanation"],
            "properties": {
              "thinkAbout": {
                "type": "string",
                "description": "A gentle nudge about what the expression means (shown if the kid gets partial_match or no_match)"
              },
              "revealExplanation": {
                "type": "string",
                "description": "Full explanation of what the expression means in real-world terms, shown via TTS feedback"
              }
            },
            "additionalProperties": false
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

**Exposed content shape:**
```json
{
  "gameId": "word-problem-workshop",
  "rounds": [
    {
      "roundNumber": 1,
      "stage": 1,
      "expression": "5 + 3",
      "expressionDisplay": "5 + 3 = 8",
      "result": 8,
      "operation": "addition",
      "rubric": "A correct word problem must describe a situation where 5 things and 3 things are combined to make 8. The two quantities must be clearly 5 and 3. Accept any real-world context (food, animals, toys, etc.) as long as the joining/combining action matches addition.",
      "exampleWordProblem": "Tom had 5 apples. His friend gave him 3 more apples. How many apples does Tom have now?",
      "hints": {
        "thinkAbout": "Think about putting two groups together. What has 5 of something and then gets 3 more?",
        "revealExplanation": "5 plus 3 means starting with 5 things and adding 3 more, giving you 8 total. For example: 5 apples plus 3 apples equals 8 apples."
      }
    }
  ]
}
```

---

## 5. Fallback Content

All 10 rounds verified — each round has a valid expression, correct result, appropriate rubric, and proper stage assignments.

```javascript
const fallbackContent = {
  "gameId": "word-problem-workshop",
  "rounds": [
    {
      "roundNumber": 1,
      "stage": 1,
      "expression": "5 + 3",
      "expressionDisplay": "5 + 3 = 8",
      "result": 8,
      "operation": "addition",
      "rubric": "A correct word problem must describe a situation where 5 things and 3 things are combined to make 8 total. The two quantities must be clearly 5 and 3. The action must represent addition (joining, combining, getting more). Accept any real-world context.",
      "exampleWordProblem": "Tom had 5 apples. His friend gave him 3 more. How many apples does Tom have now?",
      "hints": {
        "thinkAbout": "Think about putting two groups together. What has 5 of something and then gets 3 more?",
        "revealExplanation": "5 plus 3 means starting with 5 things and adding 3 more to get 8 total."
      }
    },
    {
      "roundNumber": 2,
      "stage": 1,
      "expression": "12 - 4",
      "expressionDisplay": "12 - 4 = 8",
      "result": 8,
      "operation": "subtraction",
      "rubric": "A correct word problem must describe a situation where you start with 12 things and 4 are removed/lost/given away, leaving 8. The starting quantity must be 12 and the amount removed must be 4. The action must represent subtraction (taking away, losing, giving away, eating, etc.).",
      "exampleWordProblem": "Maria had 12 stickers. She gave 4 to her sister. How many stickers does Maria have left?",
      "hints": {
        "thinkAbout": "Think about starting with a group and taking some away. What starts at 12 and loses 4?",
        "revealExplanation": "12 minus 4 means starting with 12 things and taking 4 away, leaving 8."
      }
    },
    {
      "roundNumber": 3,
      "stage": 1,
      "expression": "6 * 3",
      "expressionDisplay": "6 x 3 = 18",
      "result": 18,
      "operation": "multiplication",
      "rubric": "A correct word problem must describe a situation with 6 groups of 3 things each (or 3 groups of 6 things) totaling 18. The word problem must clearly show equal groups or repeated addition. Accept either 6 groups of 3 OR 3 groups of 6 since multiplication is commutative.",
      "exampleWordProblem": "There are 6 bags with 3 oranges in each bag. How many oranges are there in total?",
      "hints": {
        "thinkAbout": "Think about equal groups. What has 6 sets of 3 things each?",
        "revealExplanation": "6 times 3 means 6 groups with 3 in each group, which gives 18 total."
      }
    },
    {
      "roundNumber": 4,
      "stage": 1,
      "expression": "20 / 4",
      "expressionDisplay": "20 / 4 = 5",
      "result": 5,
      "operation": "division",
      "rubric": "A correct word problem must describe a situation where 20 things are split equally into 4 groups (giving 5 each) OR split into groups of 4 (giving 5 groups). The starting quantity must be 20 and the divisor must be 4. The action must represent fair sharing or equal grouping.",
      "exampleWordProblem": "A teacher has 20 pencils to share equally among 4 students. How many pencils does each student get?",
      "hints": {
        "thinkAbout": "Think about sharing equally. If you have 20 things and split them into 4 equal groups, how many in each group?",
        "revealExplanation": "20 divided by 4 means splitting 20 things into 4 equal groups of 5 each."
      }
    },
    {
      "roundNumber": 5,
      "stage": 2,
      "expression": "3 * 4 + 2",
      "expressionDisplay": "3 x 4 + 2 = 14",
      "result": 14,
      "operation": "multi-step",
      "rubric": "A correct word problem must describe a two-step situation: first, 3 groups of 4 things (or 4 groups of 3), then adding 2 more. The final total must be 14. The order of operations matters — the multiplication must happen conceptually before the addition. Accept stories where someone has equal groups of items and then gets a few extra.",
      "exampleWordProblem": "Sara bought 3 packs of 4 stickers each. Then she found 2 more stickers on the ground. How many stickers does Sara have now?",
      "hints": {
        "thinkAbout": "This has two parts: first multiply 3 times 4, then add 2 more. What story has equal groups plus some extra?",
        "revealExplanation": "3 times 4 equals 12, then adding 2 more makes 14. Think of it as 3 groups of 4 plus 2 extra."
      }
    },
    {
      "roundNumber": 6,
      "stage": 2,
      "expression": "5 * 6 - 3",
      "expressionDisplay": "5 x 6 - 3 = 27",
      "result": 27,
      "operation": "multi-step",
      "rubric": "A correct word problem must describe a two-step situation: first, 5 groups of 6 things (totaling 30), then 3 are removed. The final answer must be 27. The multiplication must conceptually happen before the subtraction. Accept stories where someone starts with equal groups and then loses/uses some.",
      "exampleWordProblem": "A bakery made 5 trays of 6 cupcakes each. 3 cupcakes fell on the floor. How many cupcakes are left?",
      "hints": {
        "thinkAbout": "First figure out 5 groups of 6 (that's 30), then take away 3. What story works for that?",
        "revealExplanation": "5 times 6 equals 30, then subtracting 3 gives 27. Think of equal groups where a few get removed."
      }
    },
    {
      "roundNumber": 7,
      "stage": 2,
      "expression": "24 / 6 + 5",
      "expressionDisplay": "24 / 6 + 5 = 9",
      "result": 9,
      "operation": "multi-step",
      "rubric": "A correct word problem must describe a two-step situation: first, 24 things are divided into 6 equal groups (giving 4 each), then 5 more are added. The final answer must be 9. The division must conceptually happen before the addition. Accept stories involving sharing/splitting followed by receiving more.",
      "exampleWordProblem": "Mom divided 24 cookies equally among 6 children. Then grandma gave each child 5 more cookies. How many cookies does each child have now?",
      "hints": {
        "thinkAbout": "First split 24 into 6 equal parts (that's 4 each), then add 5 more. What real-life situation fits?",
        "revealExplanation": "24 divided by 6 equals 4, then adding 5 gives 9. Think of sharing equally and then getting more."
      }
    },
    {
      "roundNumber": 8,
      "stage": 3,
      "expression": "4 * 5 + 3 * 2",
      "expressionDisplay": "(4 x 5) + (3 x 2) = 26",
      "result": 26,
      "operation": "mixed",
      "rubric": "A correct word problem must describe a situation with TWO separate groups: 4 groups of 5 things AND 3 groups of 2 things, combined for a total of 26. Both multiplication parts must be clearly represented. Accept stories involving two types of items or two separate purchases/collections.",
      "exampleWordProblem": "A store has 4 shelves with 5 big books each and 3 shelves with 2 small books each. How many books are there in total?",
      "hints": {
        "thinkAbout": "This expression has two parts added together: 4 groups of 5 AND 3 groups of 2. Think of two different kinds of groups combined.",
        "revealExplanation": "4 times 5 equals 20, and 3 times 2 equals 6. Together that's 26. Think of two separate groups of items added together."
      }
    },
    {
      "roundNumber": 9,
      "stage": 3,
      "expression": "50 - 3 * 8",
      "expressionDisplay": "50 - (3 x 8) = 26",
      "result": 26,
      "operation": "mixed",
      "rubric": "A correct word problem must describe a situation where you start with 50 things, then remove 3 groups of 8 (removing 24 total), leaving 26. The multiplication (3 groups of 8 removed) must happen before the subtraction conceptually. Order of operations matters. Accept stories involving a starting amount where groups of items are taken away.",
      "exampleWordProblem": "A jar had 50 marbles. Three friends each took 8 marbles. How many marbles are left in the jar?",
      "hints": {
        "thinkAbout": "Start with 50, then remove 3 groups of 8. That's 24 taken away, leaving 26. What scenario works?",
        "revealExplanation": "3 times 8 equals 24. 50 minus 24 equals 26. Think of starting with a large number and removing equal groups."
      }
    },
    {
      "roundNumber": 10,
      "stage": 3,
      "expression": "36 / 4 + 2 * 7",
      "expressionDisplay": "(36 / 4) + (2 x 7) = 23",
      "result": 23,
      "operation": "mixed",
      "rubric": "A correct word problem must describe a situation with TWO parts: 36 things divided into 4 groups (giving 9) AND 2 groups of 7 things (14), combined for a total of 23. Both the division and multiplication must be clearly represented as separate actions that combine. Accept stories with two distinct activities whose results are added.",
      "exampleWordProblem": "A teacher shared 36 crayons equally among 4 tables. Then she gave each table 2 packs of 7 markers. How many coloring supplies does one table have now?",
      "hints": {
        "thinkAbout": "Two things happen: 36 split into 4 groups (that's 9) AND 2 groups of 7 (that's 14). Together that's 23.",
        "revealExplanation": "36 divided by 4 is 9, and 2 times 7 is 14. Adding them gives 23. Think of two separate actions whose totals combine."
      }
    }
  ]
};
```

### Content Generation Guide

Generate **3 content sets**: one Easy, one Medium, one Hard. Each set contains 10 rounds.

The game receives content via `postMessage` (`game_init` -> `event.data.data.content`). To generate different difficulty levels, vary these parameters:

| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| Rounds | 10 | 10 | 10 |
| Stage 1 rounds | 4 | 3 | 2 |
| Stage 2 rounds | 3 | 4 | 4 |
| Stage 3 rounds | 3 | 3 | 4 |
| Number range | 1–20 | 5–50 | 10–100 |
| Operations (Stage 1) | Single: +, -, x, / | Single: +, -, x, / | Single: +, -, x, / |
| Operations (Stage 2) | 2-step: a*b+c | 2-step: a*b-c, a/b+c | 2-step: a*b-c, a/b+c |
| Operations (Stage 3) | 2 operations combined | 3+ operations | 3+ operations + parentheses |

**Content constraints (MUST be enforced):**
- `result` must exactly match the evaluated `expression` with standard order of operations.
- `expressionDisplay` must use `x` instead of `*` for multiplication and show the result after `=`.
- `rubric` must describe what a correct word problem looks like for THAT specific expression, mentioning the specific quantities and operations. No generic rubrics.
- `exampleWordProblem` must be a verified-correct word problem for the expression.
- `hints.revealExplanation` must walk through the expression step-by-step with specific numbers.
- Contexts should be familiar real-world scenarios: food, school, shopping, sports, crafts, animals.
- Each content set should use varied contexts — do not repeat the same context within a set.
- Stage progression must be maintained: Stage 1 first, then Stage 2, then Stage 3.
- Division expressions MUST result in whole numbers (no remainders).
- Stage 3 `expressionDisplay` MUST use parentheses to make grouping explicit when order of operations would change the result if read left-to-right (e.g., `(4 x 5) + (3 x 2) = 26` not `4 x 5 + 3 x 2 = 26`). This removes ambiguity for Grade 4 students who may not yet know PEMDAS/BODMAS.

---

## 5b. Package Script Order (PART-002)

Scripts MUST be loaded in this exact order in the `<head>`:

```html
<!-- Sentry (PART-030) — must be first -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.min.js" crossorigin="anonymous"></script>

<!-- Package Scripts (PART-002) — use bundle files, NOT individual component files -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**CRITICAL — Correct global names exported by these bundles:**

| Bundle | Globals exported to `window` |
|--------|------------------------------|
| `feedback-manager/index.js` | `FeedbackManager` |
| `components/index.js` | `ScreenLayout`, `ScreenLayoutComponent`, `ProgressBarComponent`, `TransitionScreenComponent`, `TimerComponent`, `PopupComponent`, `SubtitleComponent`, `StickerComponent`, `StoriesComponent` |
| `helpers/index.js` | `VisibilityTracker`, `SignalCollector`, `subjectiveEvaluation`, `createEvaluator`, `APIHelper`, `InteractionManager` |

**Common mistakes to avoid:**
- Do NOT use individual component URLs like `components/screen-layout.js` — they don't exist. Use the bundle `components/index.js`.
- Do NOT use `helpers/visibility-tracker/index.js` or `helpers/signal-collector/index.js` directly — use the bundle `helpers/index.js`.
- The TransitionScreen constructor is `TransitionScreenComponent` (NOT `TransitionScreen`).
- The ScreenLayout constructor is `ScreenLayout` (alias: `ScreenLayoutComponent`).
- The subjective evaluation function is `subjectiveEvaluation` (global function, NOT `MathAIHelpers.SubjectiveEvaluation`).

---

## 6. Screens & HTML Structure

### Body HTML (uses `<template>` for ScreenLayout compatibility — PART-025)

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Expression Card -->
    <div class="expression-card" id="expression-card">
      <p class="expression-label">Write a word problem for:</p>
      <div class="expression-display" id="expression-display"></div>
      <p class="expression-hint-text" id="expression-hint-text"></p>
    </div>

    <!-- Word Problem Input Area -->
    <div class="writing-area" id="writing-area">
      <label class="input-label" for="word-problem-input">Your word problem:</label>
      <textarea id="word-problem-input" class="word-problem-input" rows="4" maxlength="500" placeholder="Write a real-world story that matches this math expression..." data-signal-id="word-problem-input"></textarea>
      <div class="char-count"><span id="char-count">0</span>/500</div>
      <p class="inline-error" id="writing-error" style="display:none;"></p>
      <button class="game-btn btn-primary" id="btn-submit-problem" data-signal-id="btn-submit-problem" onclick="handleProblemSubmit()">
        <span id="btn-submit-text">Submit Word Problem</span>
      </button>
    </div>

    <!-- Feedback Area (shown after evaluation) -->
    <div class="feedback-area" id="feedback-area" style="display:none;">
      <div class="evaluation-badge" id="evaluation-badge"></div>
      <div class="feedback-section">
        <p class="feedback-label">The expression</p>
        <p class="feedback-value" id="feedback-expression"></p>
      </div>
      <div class="feedback-section">
        <p class="feedback-label">Your word problem</p>
        <p class="feedback-user-problem" id="feedback-user-problem"></p>
      </div>
      <div class="feedback-section" id="llm-feedback-section">
        <p class="feedback-label">Feedback</p>
        <p class="feedback-reasoning" id="feedback-reasoning"></p>
      </div>
      <div class="feedback-section">
        <p class="feedback-label">Points this round</p>
        <p class="feedback-points" id="feedback-points"></p>
      </div>
      <div class="feedback-hint" id="feedback-hint" style="display:none;">
        <p class="hint-label">💡 Tip:</p>
        <p class="hint-text" id="hint-text"></p>
      </div>
      <div class="feedback-example" id="feedback-example" style="display:none;">
        <p class="example-label">📝 Example word problem:</p>
        <p class="example-text" id="example-text"></p>
      </div>
      <button class="game-btn btn-primary feedback-next-btn" id="btn-next-round" data-signal-id="btn-next-round" onclick="handleNextRound()" style="display:none;">Next Round →</button>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display:none;">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title">Game Complete!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Total Points</span>
          <span class="metric-value" id="result-points">0/30</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Perfect Matches</span>
          <span class="metric-value" id="result-correct">0/10</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Partial Matches</span>
          <span class="metric-value" id="result-partial">0/10</span>
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
  --mathai-orange: #F2994A;
  --mathai-light-orange: #FFF3E0;
  --mathai-purple: #7C3AED;
  --mathai-light-purple: #F3E8FF;
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

/* === App Container (PART-021 — ScreenLayout handles injection, but fallback constraint) === */
#app {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
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

/* === Expression Card === */
.expression-card {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  text-align: center;
  animation: fadeIn 0.4s ease;
}

.expression-label {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  margin-bottom: 12px;
  font-weight: 500;
}

.expression-display {
  font-size: clamp(20px, 5vw, 36px);
  font-weight: 800;
  color: var(--mathai-purple);
  background: var(--mathai-light-purple);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  font-family: 'Courier New', Courier, monospace;
  letter-spacing: 2px;
  overflow-wrap: break-word;
  word-break: break-word;
}

.expression-hint-text {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  font-style: italic;
  line-height: 1.4;
}

/* === Writing Area === */
.writing-area {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease;
}

.input-label {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.word-problem-input {
  width: 100%;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 12px;
  padding: 12px;
  font-size: var(--mathai-font-size-body);
  font-family: var(--mathai-font-family);
  color: var(--mathai-text-primary);
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  line-height: 1.5;
  margin-bottom: 4px;
}
.word-problem-input:focus {
  border-color: var(--mathai-purple);
}

.char-count {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  text-align: right;
  margin-bottom: 12px;
}

/* === Inline Error === */
.inline-error {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-red);
  margin-bottom: 8px;
  line-height: 1.4;
}

/* === Buttons (PART-022) === */
.game-btn {
  width: 100%;
  padding: 14px 32px;
  border: none;
  border-radius: 12px;
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
}

.btn-primary {
  background: var(--mathai-green);
  color: var(--mathai-white);
}
.btn-primary:hover { filter: brightness(0.9); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.feedback-next-btn {
  margin-top: 16px;
  animation: slideInUp 0.3s ease;
}

/* === Evaluation Badge === */
.evaluation-badge {
  width: 100%;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  margin-bottom: 16px;
  animation: slideInUp 0.3s ease;
}

.evaluation-badge.correct-match {
  background: var(--mathai-light-green);
  border-left: 4px solid var(--mathai-green);
  color: var(--mathai-green);
}
.evaluation-badge.partial-match {
  background: var(--mathai-light-orange);
  border-left: 4px solid var(--mathai-orange);
  color: var(--mathai-orange);
}
.evaluation-badge.no-match {
  background: var(--mathai-light-red);
  border-left: 4px solid var(--mathai-red);
  color: var(--mathai-red);
}

/* === Feedback Area === */
.feedback-area {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease;
}

.feedback-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--mathai-light-gray);
}
.feedback-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.feedback-label {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.feedback-value {
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  color: var(--mathai-purple);
}

.feedback-user-problem {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
  line-height: 1.5;
  font-style: italic;
}

.feedback-reasoning {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
  line-height: 1.5;
}

.feedback-points {
  font-size: var(--mathai-font-size-title);
  font-weight: 700;
  color: var(--mathai-green);
}

.feedback-hint {
  background: var(--mathai-light-blue);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

.hint-label {
  font-size: var(--mathai-font-size-label);
  font-weight: 700;
  color: var(--mathai-blue);
  margin-bottom: 4px;
}

.hint-text {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-text-primary);
  line-height: 1.4;
}

.feedback-example {
  background: var(--mathai-light-purple);
  border-radius: 12px;
  padding: 12px;
  margin-top: 8px;
}

.example-label {
  font-size: var(--mathai-font-size-label);
  font-weight: 700;
  color: var(--mathai-purple);
  margin-bottom: 4px;
}

.example-text {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-text-primary);
  line-height: 1.4;
  font-style: italic;
}

/* === Results Screen (PART-019) === */
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

/* === Animations === */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 8. Game Flow

### Stage Progression

- **Stage 1 (Rounds 1-4) — Simple Operations:** Single-operation expressions (+, -, x, /). Numbers are small (1-20). The kid learns the basic connection between each operation and its real-world meaning.
- **Stage 2 (Rounds 5-7) — Multi-Step:** Two-operation expressions (e.g., 3 x 4 + 2). The kid must build a story with two connected steps. Requires understanding order of operations.
- **Stage 3 (Rounds 8-10) — Mixed Operations:** Complex expressions with 2+ different operations combined (e.g., 4 x 5 + 3 x 2). The kid must construct multi-part stories. Tests deeper understanding.

### Scoring

Each round awards up to 3 points based ENTIRELY on LLM evaluation:
- **Evaluation tiers (all determined by `subjectiveEvaluation()`):**
  - ✅ **Correct match** — word problem correctly represents the expression: **3 points**
  - 🔶 **Partial match** — word problem captures the general idea but has errors in quantities or operations: **1 point**
  - ❌ **No match** — word problem does not represent the expression or is incoherent: **0 points**

**Max total: 30 points (10 rounds x 3 points)**

**Star calculation:**
- 24-30 points → ⭐⭐⭐ (3 stars)
- 15-23 points → ⭐⭐ (2 stars)
- 1-14 points → ⭐ (1 star)

### Flow Steps

1. **Page loads** → DOMContentLoaded fires:
   - `waitForPackages([FeedbackManager, ScreenLayout, ProgressBarComponent, TransitionScreenComponent, VisibilityTracker, SignalCollector, subjectiveEvaluation])` — checks these globals exist before proceeding (10s timeout, fallback on failure)
   - `FeedbackManager.init()`
   - Audio preload: `correct_tap`, `wrong_tap`
   - SignalCollector created (PART-010) and assigned to `window.signalCollector`
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `<template id="game-template">` into `#gameContent`
   - `progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 0, slotId: 'mathai-progress-slot' })`
   - `transitionScreen = new TransitionScreenComponent({ slotId: 'mathai-transition-slot' })`
   - VisibilityTracker created
   - Attach `input` listener on `#word-problem-input` to update `#char-count`
   - Register `window.addEventListener('message', handlePostMessage)` for game_init
   - Show start transition screen (with start button disabled until content is loaded)
   - Set a 3-second fallback timer: if no `game_init` arrives, load `fallbackContent`
   - **Fire `game_ready` event and postMessage to parent:**
     ```javascript
     trackEvent('game_ready', 'game', { timestamp: new Date().toISOString() });
     window.parent.postMessage({ type: 'game_ready' }, '*');
     console.log('Game ready — waiting for game_init postMessage');
     ```

2. **handlePostMessage(event)** — receives content and signal config from parent:
   - If `event.data.type === 'game_init'`:
     ```javascript
     gameState.content = event.data.data.content || fallbackContent;
     gameState.contentSetId = event.data.data.contentSetId || null;
     gameState.signalConfig = event.data.data.signalConfig || null;

     // Configure SignalCollector flush (PART-010 v3)
     if (signalCollector && gameState.signalConfig) {
       if (gameState.signalConfig.flushUrl) signalCollector.flushUrl = gameState.signalConfig.flushUrl;
       if (gameState.signalConfig.playId) signalCollector.playId = gameState.signalConfig.playId;
       if (gameState.signalConfig.sessionId) signalCollector.sessionId = gameState.signalConfig.sessionId;
       if (gameState.signalConfig.studentId) signalCollector.studentId = gameState.signalConfig.studentId;
       signalCollector.startFlushing();
     }
     ```
   - Enable start button on transition screen
   - Record view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('screen_transition', {
         screen: 'start',
         metadata: { transition_from: 'loading', content_loaded: true }
       });
     }
     ```

3. **startGame()** (from start screen button):
   - If `!gameState.content`: load fallbackContent
   - Set `gameState.startTime = Date.now()`
   - Set `gameState.isActive = true`, `gameState.gameEnded = false`
   - Set `gameState.phase = 'writing'`; `syncDOMState()`
   - Set `duration_data.startTime = new Date().toISOString()`
   - `trackEvent('game_start', 'game')`
   - Call `setupRound()`

4. **setupRound()**:
   - Get `roundData = gameState.content.rounds[gameState.currentRound]`
   - Set `gameState.roundData = roundData`
   - Set `gameState.currentStage = roundData.stage`
   - Reset round state: `gameState.wordProblemText = ''`, `gameState.evaluationResult = null`, `gameState.feedbackText = ''`
   - Set `gameState.isProcessing = false`
   - Populate expression card:
     - `#expression-display`: `roundData.expressionDisplay`
     - `#expression-hint-text`: Stage-specific hint text:
       - Stage 1: `"Think of a real-life situation with this operation."`
       - Stage 2: `"This has two steps — your story needs two parts!"`
       - Stage 3: `"This combines multiple operations — build a story with different actions!"`
   - Clear `#word-problem-input`, reset `#char-count` to 0
   - Show `#expression-card` and `#writing-area`; hide `#feedback-area`, `#feedback-hint`, `#feedback-example`, `#writing-error`
   - Enable `#btn-submit-problem`, reset text to "Submit Word Problem"
   - Set `gameState.phase = 'writing'`; `syncDOMState()`
   - `progressBar.update(gameState.currentRound, 0)`
   - Show `#game-screen`, ensure `#results-screen` hidden
   - `trackEvent('round_start', 'game', { round: gameState.currentRound + 1, stage: roundData.stage, expression: roundData.expression })`
   - Record view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('content_render', {
         screen: 'gameplay',
         content_snapshot: {
           expression: roundData.expressionDisplay,
           round: gameState.currentRound + 1,
           stage: roundData.stage,
           operation: roundData.operation,
           trigger: 'round_start'
         },
         components: {
           progress: { current: gameState.currentRound, total: gameState.totalRounds }
         }
       });
     }
     ```

5. **handleProblemSubmit()** — kid taps "Submit Word Problem":
   - Guard: `if (!gameState.isActive || gameState.isProcessing) return`
   - `gameState.isProcessing = true`
   - Read `wordProblem = document.getElementById('word-problem-input').value.trim()`
   - If `wordProblem.length < 10`: set `#writing-error` text to "Please write at least a sentence describing a real-world situation.", show `#writing-error`, `gameState.isProcessing = false`, return
   - Hide `#writing-error` (clear any previous error)
   - `gameState.wordProblemText = wordProblem`
   - `trackEvent('word_problem_submit', 'game', { wordProblem, round: gameState.currentRound + 1, expression: gameState.roundData.expression })`
   - Set `gameState.phase = 'evaluating'`; `syncDOMState()`
   - Disable `#btn-submit-problem`, change text to "Evaluating..."
   - **Wrap the rest in try/catch/finally to ensure isProcessing reset (PART-015 pattern):**
   - **try:**
     - **LLM Evaluation (PART-015 — PRIMARY evaluation):**
       ```javascript
       const result = await validateWordProblemLLM(
         wordProblem,
         gameState.roundData.expression,
         gameState.roundData.expressionDisplay,
         gameState.roundData.result,
         gameState.roundData.rubric
       );
       gameState.evaluationResult = result.tier;  // 'correct_match' | 'partial_match' | 'no_match'
       gameState.feedbackText = result.feedback;
       ```
     - **Calculate round points:**
       ```javascript
       let roundPoints = 0;
       if (gameState.evaluationResult === 'correct_match') roundPoints = 3;
       else if (gameState.evaluationResult === 'partial_match') roundPoints = 1;
       gameState.totalPoints += roundPoints;
       if (gameState.evaluationResult === 'correct_match') gameState.correctCount++;
       if (gameState.evaluationResult === 'partial_match') gameState.partialCount++;
       ```
     - `trackEvent('evaluation_complete', 'game', { wordProblem, tier: gameState.evaluationResult, feedback: result.feedback, roundPoints, round: gameState.currentRound + 1 })`
     - **Play audio + sticker based on evaluation:**
       ```javascript
       var CORRECT_STICKER = { url: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif', type: 'IMAGE_GIF' };
       var INCORRECT_STICKER = { url: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif', type: 'IMAGE_GIF' };
       if (gameState.evaluationResult === 'correct_match') {
         try { await FeedbackManager.sound.play('correct_tap', { sticker: CORRECT_STICKER }); } catch (e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
       } else {
         try { await FeedbackManager.sound.play('wrong_tap', { sticker: INCORRECT_STICKER }); } catch (e) { console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2)); }
       }
       ```
     - **Show feedback area:**
       - `#evaluation-badge`:
         - correct_match: class `correct-match`, text "✅ Perfect Match! Your word problem nails it."
         - partial_match: class `partial-match`, text "🔶 Almost! Your story is close but needs adjustment."
         - no_match: class `no-match`, text "❌ Not quite. This doesn't match the expression."
       - `#feedback-expression`: `roundData.expressionDisplay`
       - `#feedback-user-problem`: kid's word problem text
       - `#feedback-reasoning`: LLM feedback text (`result.feedback`)
       - `#feedback-points`: `${roundPoints}/3 points`
       - If `evaluationResult !== 'correct_match'`:
         - Show `#feedback-hint` with `roundData.hints.thinkAbout`
         - Show `#feedback-example` with `roundData.exampleWordProblem`
     - Hide `#expression-card`, `#writing-area`
     - Show `#feedback-area`
     - Show `#btn-next-round`
     - Record feedback display view event:
       ```javascript
       if (signalCollector) {
         signalCollector.recordViewEvent('feedback_display', {
           screen: 'gameplay',
           content_snapshot: {
             feedback_type: gameState.evaluationResult,
             round_points: roundPoints,
             llm_feedback: result.feedback,
             round: gameState.currentRound + 1,
             trigger: 'user_action'
           }
         });
       }
       ```
     - **Play dynamic TTS with API feedback (evaluation-controlled):**
       ```javascript
       try {
         const feedbackText = result.feedback || gameState.roundData.hints.revealExplanation;
         await FeedbackManager.playDynamicFeedback({
           audio_content: feedbackText,
           subtitle: feedbackText
         });
       } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
       ```
     - Record attempt:
       ```javascript
       recordAttempt({
         input_of_user: { wordProblem: gameState.wordProblemText },
         correct: gameState.evaluationResult === 'correct_match',
         metadata: {
           round: gameState.currentRound + 1,
           expression: gameState.roundData.expressionDisplay,
           result: gameState.roundData.result,
           evaluationTier: gameState.evaluationResult,
           roundPoints: roundPoints,
           validationType: 'subjective',
           llmFeedback: result.feedback
         }
       });
       ```
     - Record round outcome:
       ```javascript
       if (signalCollector) {
         signalCollector.recordCustomEvent('round_solved', {
           correct: gameState.evaluationResult === 'correct_match',
           round: gameState.currentRound + 1,
           evaluationTier: gameState.evaluationResult,
           roundPoints: roundPoints
         });
       }
       ```
     - Set `gameState.phase = 'feedback'`; `syncDOMState()`
   - **catch (error):**
     - Log error: `console.error('Word problem evaluation failed:', error)`
     - Report to Sentry if available:
       ```javascript
       if (typeof Sentry !== 'undefined') {
         Sentry.captureException(error, { tags: { phase: 'word-problem-evaluation', component: 'SubjectiveEvaluation', severity: 'high' } });
       }
       ```
     - **CRITICAL — Ensure game never gets stuck:** If the try block threw before showing the feedback UI, show a minimal fallback:
       ```javascript
       if (document.getElementById('feedback-area').style.display === 'none') {
         // Fallback: award 0 points (graceful degradation)
         const roundPoints = 0;

         document.getElementById('evaluation-badge').className = 'evaluation-badge partial-match';
         document.getElementById('evaluation-badge').textContent = '⚠️ We couldn\'t evaluate your word problem this time.';
         document.getElementById('feedback-expression').textContent = gameState.roundData.expressionDisplay;
         document.getElementById('feedback-user-problem').textContent = gameState.wordProblemText;
         document.getElementById('feedback-reasoning').textContent = 'The evaluation service is temporarily unavailable. Your word problem was saved!';
         document.getElementById('feedback-points').textContent = roundPoints + '/3 points';

         // Show hint and example as learning opportunity
         document.getElementById('hint-text').textContent = gameState.roundData.hints.thinkAbout;
         document.getElementById('feedback-hint').style.display = '';
         document.getElementById('example-text').textContent = gameState.roundData.exampleWordProblem;
         document.getElementById('feedback-example').style.display = '';

         document.getElementById('expression-card').style.display = 'none';
         document.getElementById('writing-area').style.display = 'none';
         document.getElementById('feedback-area').style.display = '';
         document.getElementById('btn-next-round').style.display = '';

         recordAttempt({
           input_of_user: { wordProblem: gameState.wordProblemText },
           correct: false,
           metadata: {
             round: gameState.currentRound + 1,
             expression: gameState.roundData.expressionDisplay,
             result: gameState.roundData.result,
             evaluationTier: 'error',
             roundPoints: 0,
             validationType: 'subjective',
             llmFeedback: '',
             error: error.message
           }
         });
       }
       ```
     - Set `gameState.phase = 'feedback'`; `syncDOMState()`
   - **finally:**
     - Re-enable `#btn-submit-problem`, change text back to "Submit Word Problem"
     - `gameState.isProcessing = false`

6. **handleNextRound()** — kid taps "Next Round →":
   - Hide `#btn-next-round`
   - Call `nextRound()`

7. **nextRound()**:
   - `gameState.currentRound++`
   - `progressBar.update(gameState.currentRound, 0)`
   - `trackEvent('round_complete', 'game', { round: gameState.currentRound })`
   - If `gameState.currentRound >= gameState.totalRounds` → `endGame()`
   - Else:
     - Check stage transition: `const nextStage = gameState.content.rounds[gameState.currentRound].stage`
     - Record screen transition:
       ```javascript
       if (signalCollector) {
         signalCollector.recordViewEvent('screen_transition', {
           screen: nextStage !== gameState.currentStage ? 'stage_transition' : 'gameplay',
           metadata: { transition_from: 'gameplay' }
         });
       }
       ```
     - If stage changed:
       ```javascript
       const stageNames = { 1: 'Simple Operations', 2: 'Multi-Step', 3: 'Mixed Operations' };
       const stageDescs = { 1: 'One operation — build a simple story!', 2: 'Two steps — your story needs two parts!', 3: 'Multiple operations — create a complex story!' };
       transitionScreen.show({
         icons: ['✏️'],
         iconSize: 'normal',
         title: 'Stage ' + nextStage + ': ' + stageNames[nextStage],
         subtitle: stageDescs[nextStage],
         buttons: [{ text: 'Continue', type: 'primary', action: function() { setupRound(); } }]
       });
       ```
     - Else: `setupRound()`

8. **endGame()** (all 10 rounds completed):
   - Guard: `if (gameState.gameEnded) return`; `gameState.gameEnded = true`; `gameState.isActive = false`
   - Set `gameState.phase = 'results'`; `syncDOMState()`
   - `gameState.duration_data.currentTime = new Date().toISOString()`
   - Calculate stars and metrics:
     ```javascript
     const timeTaken = Math.round((Date.now() - gameState.startTime) / 1000);
     const accuracy = gameState.totalRounds > 0 ? Math.round((gameState.correctCount / gameState.totalRounds) * 100) : 0;
     let stars = 1;
     if (gameState.totalPoints >= 24) stars = 3;
     else if (gameState.totalPoints >= 15) stars = 2;

     const metrics = {
       accuracy,
       time: timeTaken,
       stars,
       attempts: gameState.attempts,
       duration_data: gameState.duration_data,
       totalLives: 1,  // No lives in this game — default 1 per PART-011
       tries: computeTriesPerRound(gameState.attempts),
       totalPoints: gameState.totalPoints,
       correctCount: gameState.correctCount,
       partialCount: gameState.partialCount
     };

     // Track session history for restart
     if (gameState.sessionHistory.length > 0) {
       metrics.sessionHistory = [
         ...gameState.sessionHistory,
         { totalLives: 1, tries: computeTriesPerRound(gameState.attempts) }
       ];
     }
     ```
   - End-game TTS with trophy:
     ```javascript
     try {
       await FeedbackManager.playDynamicFeedback({
         audio_content: 'You scored ' + gameState.totalPoints + ' out of 30 points! You got ' + gameState.correctCount + ' perfect matches out of 10 rounds!',
         subtitle: gameState.totalPoints + '/30 points — ' + stars + ' stars!',
         sticker: { url: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json', type: 'Lottie' }
       });
     } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
     ```
   - Seal SignalCollector: `if (signalCollector) signalCollector.seal()`
   - Update results screen:
     ```javascript
     document.getElementById('result-points').textContent = gameState.totalPoints + '/30';
     document.getElementById('result-correct').textContent = gameState.correctCount + '/10';
     document.getElementById('result-partial').textContent = gameState.partialCount + '/10';
     var starsDisplay = document.getElementById('stars-display');
     starsDisplay.innerHTML = '';
     for (var i = 0; i < 3; i++) {
       starsDisplay.innerHTML += '<span class="' + (i < stars ? 'star-filled' : 'star-empty') + '">' + (i < stars ? '⭐' : '☆') + '</span>';
     }
     ```
   - Show `#results-screen`, hide `#game-screen`
   - Send postMessage (PART-011 v3 format):
     ```javascript
     console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
     console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

     window.parent.postMessage({
       type: 'game_complete',
       data: {
         metrics,
         attempts: gameState.attempts,
         completedAt: Date.now()
       }
     }, '*');
     ```
   - `trackEvent('game_end', 'game', { metrics })`
   - Cleanup:
     ```javascript
     if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
     FeedbackManager.sound.stopAll();
     FeedbackManager.stream.stopAll();
     ```

9. **restartGame()** — Full reset:
   - Save session history before reset:
     ```javascript
     gameState.sessionHistory.push({
       totalLives: 1,
       tries: computeTriesPerRound(gameState.attempts)
     });
     var savedSessionHistory = gameState.sessionHistory.slice();
     var savedContentSetId = gameState.contentSetId;
     var savedSignalConfig = gameState.signalConfig;
     var savedContent = gameState.content;
     ```
   - Reset all gameState fields to defaults (`currentRound=0, totalPoints=0, correctCount=0, partialCount=0`, etc.)
   - Restore preserved state:
     ```javascript
     gameState.sessionHistory = savedSessionHistory;
     gameState.contentSetId = savedContentSetId;
     gameState.signalConfig = savedSignalConfig;
     gameState.content = savedContent;
     ```
   - `gameState.phase = 'start'`; `syncDOMState()`
   - Recreate SignalCollector:
     ```javascript
     signalCollector = new SignalCollector({
       sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
       studentId: window.gameVariableState?.studentId || null,
       gameId: gameState.gameId || null,
       contentSetId: gameState.contentSetId || null
     });
     window.signalCollector = signalCollector;

     if (gameState.signalConfig) {
       if (gameState.signalConfig.flushUrl) signalCollector.flushUrl = gameState.signalConfig.flushUrl;
       if (gameState.signalConfig.playId) signalCollector.playId = gameState.signalConfig.playId;
       if (gameState.signalConfig.sessionId) signalCollector.sessionId = gameState.signalConfig.sessionId;
       if (gameState.signalConfig.studentId) signalCollector.studentId = gameState.signalConfig.studentId;
       signalCollector.startFlushing();
     }
     ```
   - Recreate VisibilityTracker:
     ```javascript
     visibilityTracker = new VisibilityTracker({
       onInactive: function() {
         var inactiveStart = Date.now();
         gameState.duration_data.inActiveTime.push({ start: inactiveStart });
         if (signalCollector) {
           signalCollector.pause();
           signalCollector.recordCustomEvent('visibility_hidden', {});
         }
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
   - `progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 0, slotId: 'mathai-progress-slot' })`
   - `progressBar.update(0, 0)`
   - Show start transition screen:
     ```javascript
     transitionScreen.show({
       icons: ['✏️'],
       iconSize: 'large',
       title: 'Word Problem Workshop',
       subtitle: 'Turn math expressions into real-world stories!',
       buttons: [{ text: "I'm ready!", type: 'primary', action: function() { startGame(); } }]
     });
     ```

---

## 9. Functions

### Global Scope (RULE-001)

**syncDOMState()**
- Set `#app` dataset attributes: `data-phase`, `data-round`, `data-score`, `data-stage`, `data-points`
- Called immediately after every `gameState.phase` assignment

**handlePostMessage(event)** — as described in Flow Step 2

**startGame()** — as described in Flow Step 3

**setupRound()** — as described in Flow Step 4

**async handleProblemSubmit()** — as described in Flow Step 5 (wrapped in try/catch/finally)

**handleNextRound()** — as described in Flow Step 6

**nextRound()** — as described in Flow Step 7

**async endGame()** — as described in Flow Step 8

**restartGame()** — as described in Flow Step 9

**computeTriesPerRound(attempts)** — PART-011 v3 helper:
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

**async validateWordProblemLLM(wordProblem, expression, expressionDisplay, expectedResult, rubric)** — PART-015 (PRIMARY EVALUATION):
```javascript
async function validateWordProblemLLM(wordProblem, expression, expressionDisplay, expectedResult, rubric) {
  try {
    var result = await subjectiveEvaluation({
      components: [
        {
          component_id: 'wp_' + gameState.currentRound,
          evaluation_prompt: 'Math expression: "' + expressionDisplay + '" (result = ' + expectedResult + ')\nStudent\'s word problem: "' + wordProblem + '"\nRubric: ' + rubric + '\n\nEvaluate whether the student\'s word problem correctly represents the given math expression.\n\nBe GENEROUS and BROAD in your evaluation — this is a Grade 4 student being creative. Accept any word problem that demonstrates understanding of the math, even if:\n- The items are different types (e.g., "5 apples and 3 oranges = 8 fruits" for 5+3=8 is CORRECT)\n- The wording is informal, uses slang, or has minor grammar/spelling mistakes\n- The story is silly, fantastical, or uses unusual scenarios\n- The student describes the result explicitly (e.g., "together they had 8") rather than posing it as a question\n- The student uses names, places, or cultural references\n\nWhat matters is:\n1. The correct quantities from the expression appear in the story\n2. The relationship between quantities matches the operation (addition = combining/joining/getting more, subtraction = removing/losing/giving away, multiplication = equal groups/repeated sets, division = sharing equally/splitting)\n3. The math works out to the correct result\n\nReturn ONLY one of these three words — nothing else, no quotes, no explanation:\ncorrect_match\npartial_match\nno_match\n\n- correct_match: the word problem correctly represents the expression (quantities and operation meaning are right)\n- partial_match: captures the general idea but has a clear math error (wrong number, wrong operation)\n- no_match: does not represent the expression at all, or is incoherent/irrelevant',
          feedback_prompt: 'You are a friendly math tutor helping a Grade 4 student learn to write word problems.\n\nMath expression: "' + expressionDisplay + '"\nStudent\'s word problem: "' + wordProblem + '"\nEvaluation: {{evaluation}}\n\nProvide a short (2-3 sentence) encouraging feedback:\n- If "correct_match": Praise their creativity and point out what made their word problem work well (specific quantities, correct operation meaning)\n- If "partial_match": Acknowledge what they got right, then gently explain what needs to change (e.g., wrong quantity, wrong operation meaning)\n- If "no_match": Be kind and encouraging, explain what the expression means in simple terms, and suggest what kind of real-world situation could match it\n\nKeep it warm and age-appropriate for a Grade 4 student. Use simple language.'
        }
      ],
      onComplete: function(response) {
        console.log('Subjective evaluation complete:', JSON.stringify(response, null, 2));
      },
      onError: function(error) {
        console.error('Subjective evaluation error:', JSON.stringify({ error: error.message }, null, 2));
      },
      timeout: 30000
    });

    // Guard against malformed API response
    if (!result || !result.data || !result.data[0]) {
      console.error('Subjective evaluation returned malformed response:', JSON.stringify(result, null, 2));
      return { tier: 'no_match', evaluation: '', feedback: 'We couldn\'t evaluate your word problem this time. Keep trying — writing word problems gets easier with practice!' };
    }

    var componentResult = result.data[0];
    var evalText = (componentResult.evaluation || '').trim().toLowerCase().replace(/[^a-z_]/g, '');

    // Normalize evaluation to expected tiers (use includes for robustness —
    // LLM may return extra text around the tier keyword)
    var tier = 'no_match';
    if (evalText.includes('correct_match')) tier = 'correct_match';
    else if (evalText.includes('partial_match')) tier = 'partial_match';

    return {
      tier: tier,
      evaluation: componentResult.evaluation || '',
      feedback: componentResult.feedback || ''
    };
  } catch (error) {
    console.error('LLM validation error:', JSON.stringify({ error: error.message }, null, 2));
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, { tags: { phase: 'llm-evaluation', component: 'SubjectiveEvaluation', severity: 'high' } });
    }
    return { tier: 'no_match', evaluation: '', feedback: 'We couldn\'t evaluate your word problem this time. Keep trying — writing word problems gets easier with practice!' };
  }
}
```

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

- **Word problem evaluated — correct_match:** `await FeedbackManager.sound.play('correct_tap', { sticker: CORRECT_STICKER })` then TTS with LLM feedback
- **Word problem evaluated — partial_match:** `await FeedbackManager.sound.play('wrong_tap', { sticker: INCORRECT_STICKER })` then TTS with LLM feedback
- **Word problem evaluated — no_match:** `await FeedbackManager.sound.play('wrong_tap', { sticker: INCORRECT_STICKER })` then TTS with LLM feedback (falls back to `revealExplanation`)
- **End game:** `await FeedbackManager.playDynamicFeedback()` with trophy sticker — announces total points and breakdown

---

## 11. Audio Sequence Table

| # | Moment | Trigger | Audio Type | Content / Sound ID | Await? | Notes |
|---|--------|---------|------------|--------------------|--------|-------|
| 1 | Word problem — correct_match | handleProblemSubmit (correct_match) | Static + Sticker | `await FeedbackManager.sound.play('correct_tap', { sticker: CORRECT_STICKER })` | ✅ Awaited | ✅ badge shown; correct GIF sticker |
| 2 | Word problem — partial_match | handleProblemSubmit (partial_match) | Static + Sticker | `await FeedbackManager.sound.play('wrong_tap', { sticker: INCORRECT_STICKER })` | ✅ Awaited | 🔶 badge shown; incorrect GIF sticker |
| 3 | Word problem — no_match | handleProblemSubmit (no_match) | Static + Sticker | `await FeedbackManager.sound.play('wrong_tap', { sticker: INCORRECT_STICKER })` | ✅ Awaited | ❌ badge shown; incorrect GIF sticker |
| 4 | Evaluation feedback TTS | After evaluation complete | Dynamic TTS | `await FeedbackManager.playDynamicFeedback()` with `result.feedback` (fallback: `revealExplanation`) | ✅ Awaited* | Personalized LLM feedback; streaming may resolve early |
| 5 | Game end | endGame() | Dynamic TTS + Sticker | `await FeedbackManager.playDynamicFeedback()` + trophy sticker | ✅ Awaited* | Points breakdown TTS; streaming may resolve early |

**Notes:**
- Rows 1-3 and 4 are sequential within the same handler — sound plays first, then TTS.
- No overlapping audio risk — each audio moment is guarded by `isProcessing`.

---

## 12. Review Findings

- **Info — First fully-subjective evaluation game:** Unlike "Estimate It!" which uses hybrid validation (deterministic accuracy + LLM reasoning), this game uses `subjectiveEvaluation()` as the **sole and primary** evaluation mechanism. There is no deterministic check — the LLM determines correctness, partial-correctness, and provides feedback. This makes the game a pure showcase of the subjective evaluation pipeline.

- **Info — Three-tier evaluation:** The LLM returns one of three tiers (`correct_match`, `partial_match`, `no_match`) instead of a binary correct/incorrect. This allows nuanced scoring (3/1/0 points) that rewards students who are close but not perfect, encouraging iteration and learning.

- **Info — Subjective Evaluation API:** Uses `subjectiveEvaluation()` global function from the subjective-evaluation package (NOT `MathAIHelpers.SubjectiveEvaluation`). The API controls BOTH evaluation (clean verdict: `"correct_match"` / `"partial_match"` / `"no_match"`) AND feedback (personalized response generated via `feedback_prompt` with `{{evaluation}}` substitution). The TTS audio plays the API's feedback text, falling back to `revealExplanation` only if the API response has no feedback.

- **Info — No deterministic fallback:** Because the primary evaluation IS the LLM, there is no "correct answer" to compare against. If the API fails, the game gracefully awards 0 points and shows the example word problem + hint as a learning fallback. The kid is never stuck.

- **Info — No lives:** This game uses no lives (totalLives: 0, reported as 1 per PART-011 convention). The ProgressBar shows round progress only. The creative nature of the task encourages exploration without fear of failure.

- **Info — Evaluation loading state:** When the LLM evaluates the word problem, the Submit button is disabled and shows "Evaluating..." text. This prevents double-submission and gives visual feedback that processing is happening. The button is re-enabled on both success and error via try/catch/finally (PART-015 rules).

- **Warning — LLM latency:** The `validateWordProblemLLM` call via `subjectiveEvaluation()` may take 2-10 seconds depending on API load. The 30-second timeout covers worst-case scenarios. If the API fails, a graceful fallback message is shown and the kid gets 0 points (no crash). Uses `onComplete`/`onError` callbacks for logging.

- **Warning — LLM evaluation reliability:** Since the LLM is the ONLY evaluation, prompt engineering is critical. The evaluation_prompt is intentionally GENEROUS — it accepts creative, informal, and unconventional word problems as long as the quantities, operation, and result are mathematically correct (e.g., "5 apples and 3 oranges = 8 fruits" is valid for 5+3=8). The prompt instructs the LLM to return ONLY the tier keyword with no extra text. The `tier` normalization in `validateWordProblemLLM` uses `includes()` matching and strips non-alpha characters for robustness — if the LLM adds quotes, punctuation, or explanation around the tier keyword, it still parses correctly. Defaults to `no_match` only for truly unrecognizable responses.

- **Info — Example word problem as fallback:** When the evaluation is not `correct_match`, the game shows both a thinking hint (`thinkAbout`) and a complete example word problem (`exampleWordProblem`). This ensures the kid always sees what a correct answer looks like, even when the LLM evaluation service fails.

- **Info — Content generation safety:** Division expressions MUST result in whole numbers (no remainders). Multi-step expressions must follow standard order of operations. The `result` field must exactly match the evaluated expression — content validators should programmatically verify this.

- **Info — SignalCollector v3 compliance:** Uses `recordViewEvent()` for content_render, screen_transition, and feedback_display. Uses `recordCustomEvent()` for round_solved and visibility events. Calls `startFlushing()` after game_init, `seal()` in endGame. No deprecated v2 methods. PostMessage uses `game_complete` type with PART-011 v3 metrics format including `tries` and `totalLives`.

- **Info — User-paced feedback:** After evaluation, the kid sees the full feedback card and taps "Next Round →" when ready. No auto-advance timer — the kid controls the pace, which is important since the feedback contains the LLM evaluation, hints, and example word problem.

- **Info — `game_ready` event:** After DOMContentLoaded initialization completes (packages loaded, ScreenLayout injected, components created), the game fires `trackEvent('game_ready', ...)` and sends `window.parent.postMessage({ type: 'game_ready' }, '*')`. This signals to the parent iframe that the game is ready to receive `game_init` with content.

- **Info — Play Again replays same content:** `restartGame()` preserves and reuses the same content. For varied replay experiences, the parent should send a new content set via `game_init` postMessage on restart. With fallback content, the kid may recall example word problems shown during the first play — this is an acceptable tradeoff for a practice game, since even recalling a correct example reinforces understanding of operation meaning.

- **Info — Stage 3 parentheses:** Stage 3 expressions use explicit parentheses in `expressionDisplay` (e.g., `(4 x 5) + (3 x 2) = 26`) to remove order-of-operations ambiguity for Grade 4 students. The underlying `expression` field retains the raw form for the LLM rubric. Content generators MUST add parentheses to Stage 3 `expressionDisplay` whenever the result would differ if the expression were evaluated left-to-right.
