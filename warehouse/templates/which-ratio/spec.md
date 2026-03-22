# Which Ratio? — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 2 (Understand) for the skill `which-ratio`: given a right triangle with two sides labeled and angle θ marked, the learner must identify WHICH trig function (sin/cos/tan) equals the ratio of those two sides. This is pure definition recall — no computation. The three-button MCQ (sin θ / cos θ / tan θ) forces recall of the SOH-CAH-TOA mnemonic directly. On the first incorrect attempt, a worked-example panel expands showing the full SOH-CAH-TOA reference card with the correct mapping highlighted. On the second incorrect attempt the game advances to the next round with a soft note — no lives are deducted at all (this is a learning game, not a drill). The 5 rounds cover all three ratios and include both "given two sides, name the ratio" and "given the ratio name, identify the correct pair of sides" question formats, targeting the two primary misconceptions: (1) confusing sin and cos because both involve the hypotenuse; (2) forgetting that tan uses opposite/adjacent and does NOT involve the hypotenuse. Interaction type: `ratio-identification-mcq`.

---

## 1. Game Identity

- **Title:** Which Ratio?
- **Game ID:** game_which_ratio
- **Type:** standard
- **Description:** Students identify the correct trig ratio (sin/cos/tan) given a labeled right triangle diagram. 5 rounds covering all three ratios. MCQ interaction: 3 buttons per round. Worked-example panel reveals on first wrong attempt; round skipped on second wrong attempt. No lives deducted — this is a learning-first game. Stars based on first-attempt accuracy. Targets Grade 10 / NCERT Chapter 8 Section 8.1 / CC HSG-SRT.C.6. Prerequisite: name-the-sides (side labeling). Session successor: compute-it (value computation).

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                  |
| -------- | ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                             |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                             |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                             |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                             |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                           |
| PART-006 | TimerComponent                | NO              | No timer — ratio identification is a definition-recall task. Time pressure contradicts the worked-example pedagogical goal.                                                   |
| PART-007 | Game State Object             | YES             | Custom fields: attemptsThisRound, wrongFirstAttempt, totalFirstAttemptCorrect, isProcessing                                                                                   |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                             |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                             |
| PART-010 | Event Tracking                | YES             | Custom events: ratio_correct_first, ratio_correct_second, ratio_skipped, worked_example_shown, round_complete                                                                 |
| PART-011 | End Game & Metrics            | YES             | Star logic: 5★ = 5 first-attempt correct; 4★ = 4; 3★ = 3; 2★ = 2; 1★ = 1; 0★ = 0. No game-over state (no lives system).                                                   |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                             |
| PART-013 | Validation Fixed              | YES             | MCQ: string equality check (selected ratio === correctRatio)                                                                                                                  |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                             |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                             |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                             |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Visual feedback only.                                                                                  |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                             |
| PART-019 | Results Screen UI             | YES             | Custom metrics: first-attempt accuracy, rounds completed, worked-example panels triggered                                                                                     |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                             |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                             |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                             |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 5, totalLives: 0 (no lives — progress bar shows rounds only, no hearts)                                                                                         |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory only (no game-over — the game cannot end in failure)                                                                                                  |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                        |
| PART-027 | Play Area Construction        | YES             | Layout: triangle diagram (SVG inline) above MCQ question panel; worked-example panel hidden by default, slides in below question on first wrong attempt                       |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with questionType, correctRatio, distractors, svgConfig, questionText, workedExampleHtml, feedbackOnSkip                                                  |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                                                             |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                                                             |
| PART-031 | API Helper                    | NO              | —                                                                                                                                                                             |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                                                             |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                                                             |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                      |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                 |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                        |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 5,
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
  attemptsThisRound: 0,         // 0, 1, or 2 attempts within current round
  wrongFirstAttempt: 0,         // Total rounds where first attempt was wrong
  totalFirstAttemptCorrect: 0,  // Total rounds answered correctly on first attempt
  isProcessing: false           // Guard against double-submit
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
```

**IMPORTANT — No lives system:** This game has NO lives and NO game-over state. The progress bar shows only round progress (5 segments), no hearts. `totalLives` in the ProgressBar config must be `0` or omitted. Never deduct lives in this game.

---

## 4. Input Schema (External Variables)

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "questionType": {
            "type": "string",
            "enum": ["name-the-ratio", "identify-the-sides"],
            "description": "name-the-ratio: given two labeled sides, pick the ratio name. identify-the-sides: given the ratio name, pick which pair of sides it uses (expressed as a ratio of labels)."
          },
          "questionText": {
            "type": "string",
            "description": "The full question shown above the triangle. For name-the-ratio: 'Which trig ratio equals [numeratorSide]/[denominatorSide] for angle θ?' For identify-the-sides: 'Which ratio equals [functionName] θ?'"
          },
          "correctRatio": {
            "type": "string",
            "enum": ["sin", "cos", "tan"],
            "description": "The correct trig function. Used as the correct answer value for name-the-ratio rounds."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 3,
            "maxItems": 3,
            "description": "Exactly 3 MCQ option strings shown on the buttons. For name-the-ratio: always ['sin θ', 'cos θ', 'tan θ']. For identify-the-sides: always ['O/H', 'A/H', 'O/A']."
          },
          "correctOption": {
            "type": "string",
            "description": "The exact string from options[] that is the correct answer. Must match one of the options strings exactly."
          },
          "svgConfig": {
            "type": "object",
            "description": "Parameters for rendering the inline SVG right triangle.",
            "properties": {
              "highlightedSides": {
                "type": "array",
                "items": { "type": "string", "enum": ["opposite", "adjacent", "hypotenuse"] },
                "minItems": 2,
                "maxItems": 2,
                "description": "The two sides relevant to this round's ratio. These sides are drawn in a highlight color (orange, #f97316). The third side is drawn in a muted color."
              },
              "oppositeLabel": {
                "type": "string",
                "description": "Label displayed on the opposite side. Either a letter (e.g. 'O') or a numeric value (e.g. '3'). For identify-the-sides rounds, always 'O'."
              },
              "adjacentLabel": {
                "type": "string",
                "description": "Label displayed on the adjacent side. Either 'A' or a numeric value."
              },
              "hypotenuseLabel": {
                "type": "string",
                "description": "Label displayed on the hypotenuse. Either 'H' or a numeric value."
              },
              "angleLabel": {
                "type": "string",
                "description": "Label shown at the reference angle vertex. Always 'θ'."
              }
            },
            "required": ["highlightedSides", "oppositeLabel", "adjacentLabel", "hypotenuseLabel", "angleLabel"]
          },
          "workedExampleHtml": {
            "type": "string",
            "description": "HTML string injected into the worked-example panel on first wrong attempt. Must show the SOH-CAH-TOA reference card with the correct ratio highlighted. Must include: (1) the mnemonic row for the correct ratio in bold/highlighted; (2) the definition written out (e.g., sin θ = Opposite / Hypotenuse); (3) a one-sentence explanation of why the highlighted sides match the correct ratio for this round."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when the round is skipped after two wrong attempts. E.g., 'This one was tricky — sin uses Opposite and Hypotenuse (SOH). We'll come back to it.'"
          }
        },
        "required": ["questionType", "questionText", "correctRatio", "options", "correctOption", "svgConfig", "workedExampleHtml", "feedbackOnSkip"]
      },
      "minItems": 5,
      "maxItems": 5,
      "description": "Exactly 5 rounds. Round distribution: at least one round per ratio (sin, cos, tan). Mix of questionType: rounds 1-3 are name-the-ratio; rounds 4-5 are identify-the-sides. No two consecutive rounds should test the same ratio."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: name-the-ratio — sin
    // Triangle: opposite=3, hypotenuse=5 labeled. Which ratio = 3/5?
    // Misconception: learner picks cos (also uses H, but pairs with A)
    // ============================================================
    {
      questionType: 'name-the-ratio',
      questionText: 'Which trig ratio equals 3/5 for angle θ?',
      correctRatio: 'sin',
      options: ['sin θ', 'cos θ', 'tan θ'],
      correctOption: 'sin θ',
      svgConfig: {
        highlightedSides: ['opposite', 'hypotenuse'],
        oppositeLabel: '3',
        adjacentLabel: 'A',
        hypotenuseLabel: '5',
        angleLabel: 'θ'
      },
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">SOH-CAH-TOA Reference</p>
          <div class="we-row we-highlighted">
            <span class="we-mnemonic">SOH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition"><strong>sin θ = Opposite / Hypotenuse</strong></span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">CAH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">cos θ = Adjacent / Hypotenuse</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">TOA</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">tan θ = Opposite / Adjacent</span>
          </div>
          <p class="we-explanation">The ratio 3/5 uses the <strong>Opposite (3)</strong> over the <strong>Hypotenuse (5)</strong> — that is the definition of <strong>sin θ</strong>.</p>
        </div>
      `,
      feedbackOnSkip: "This one was tricky — sin uses Opposite over Hypotenuse (SOH). We'll come back to it."
    },

    // ============================================================
    // ROUND 2: name-the-ratio — cos
    // Triangle: adjacent=4, hypotenuse=5 labeled. Which ratio = 4/5?
    // Misconception: learner picks sin (also uses H, but pairs with O)
    // ============================================================
    {
      questionType: 'name-the-ratio',
      questionText: 'Which trig ratio equals 4/5 for angle θ?',
      correctRatio: 'cos',
      options: ['sin θ', 'cos θ', 'tan θ'],
      correctOption: 'cos θ',
      svgConfig: {
        highlightedSides: ['adjacent', 'hypotenuse'],
        oppositeLabel: 'O',
        adjacentLabel: '4',
        hypotenuseLabel: '5',
        angleLabel: 'θ'
      },
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">SOH-CAH-TOA Reference</p>
          <div class="we-row we-muted">
            <span class="we-mnemonic">SOH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">sin θ = Opposite / Hypotenuse</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-mnemonic">CAH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition"><strong>cos θ = Adjacent / Hypotenuse</strong></span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">TOA</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">tan θ = Opposite / Adjacent</span>
          </div>
          <p class="we-explanation">The ratio 4/5 uses the <strong>Adjacent (4)</strong> over the <strong>Hypotenuse (5)</strong> — that is the definition of <strong>cos θ</strong>. Note: sin also uses the hypotenuse, but sin pairs it with the <em>opposite</em> side.</p>
        </div>
      `,
      feedbackOnSkip: "This one was tricky — cos uses Adjacent over Hypotenuse (CAH), not sin. We'll come back to it."
    },

    // ============================================================
    // ROUND 3: name-the-ratio — tan
    // Triangle: opposite=3, adjacent=4 labeled. Which ratio = 3/4?
    // Misconception: learner picks sin (confuses — thinks any O ratio is sin)
    // Key insight: tan does NOT involve the hypotenuse at all
    // ============================================================
    {
      questionType: 'name-the-ratio',
      questionText: 'Which trig ratio equals 3/4 for angle θ?',
      correctRatio: 'tan',
      options: ['sin θ', 'cos θ', 'tan θ'],
      correctOption: 'tan θ',
      svgConfig: {
        highlightedSides: ['opposite', 'adjacent'],
        oppositeLabel: '3',
        adjacentLabel: '4',
        hypotenuseLabel: 'H',
        angleLabel: 'θ'
      },
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">SOH-CAH-TOA Reference</p>
          <div class="we-row we-muted">
            <span class="we-mnemonic">SOH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">sin θ = Opposite / Hypotenuse</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">CAH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">cos θ = Adjacent / Hypotenuse</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-mnemonic">TOA</span>
            <span class="we-arrow">→</span>
            <span class="we-definition"><strong>tan θ = Opposite / Adjacent</strong></span>
          </div>
          <p class="we-explanation">The ratio 3/4 uses <strong>Opposite (3)</strong> over <strong>Adjacent (4)</strong> — no hypotenuse involved. That is the definition of <strong>tan θ</strong>. Tan is the only trig ratio that does not use the hypotenuse.</p>
        </div>
      `,
      feedbackOnSkip: "This one was tricky — tan uses Opposite over Adjacent (TOA), and does NOT involve the hypotenuse. We'll come back to it."
    },

    // ============================================================
    // ROUND 4: identify-the-sides — cos
    // Question type flipped: "Which ratio expression equals cos θ?"
    // Options are side-pair strings: O/H, A/H, O/A
    // Correct: A/H
    // Misconception: learner picks O/H (confuses sin and cos)
    // ============================================================
    {
      questionType: 'identify-the-sides',
      questionText: 'Which ratio expression equals cos θ?',
      correctRatio: 'cos',
      options: ['O/H', 'A/H', 'O/A'],
      correctOption: 'A/H',
      svgConfig: {
        highlightedSides: ['adjacent', 'hypotenuse'],
        oppositeLabel: 'O',
        adjacentLabel: 'A',
        hypotenuseLabel: 'H',
        angleLabel: 'θ'
      },
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">SOH-CAH-TOA Reference</p>
          <div class="we-row we-muted">
            <span class="we-mnemonic">SOH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">sin θ = O/H (Opposite over Hypotenuse)</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-mnemonic">CAH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition"><strong>cos θ = A/H (Adjacent over Hypotenuse)</strong></span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">TOA</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">tan θ = O/A (Opposite over Adjacent)</span>
          </div>
          <p class="we-explanation"><strong>cos θ = Adjacent / Hypotenuse = A/H.</strong> The "C" in CAH stands for Cosine; the "A" for Adjacent (numerator); the "H" for Hypotenuse (denominator). Memory tip: Cosine starts with "C" — Adjacent starts with "A" — the ratio is A over H.</p>
        </div>
      `,
      feedbackOnSkip: "This one was tricky — cos θ = Adjacent/Hypotenuse = A/H (CAH). O/H belongs to sin. We'll come back to it."
    },

    // ============================================================
    // ROUND 5: identify-the-sides — sin
    // Question type flipped: "Which ratio expression equals sin θ?"
    // Options: O/H, A/H, O/A
    // Correct: O/H
    // Misconception: learner picks A/H (confuses sin and cos again — comes last to reinforce)
    // ============================================================
    {
      questionType: 'identify-the-sides',
      questionText: 'Which ratio expression equals sin θ?',
      correctRatio: 'sin',
      options: ['O/H', 'A/H', 'O/A'],
      correctOption: 'O/H',
      svgConfig: {
        highlightedSides: ['opposite', 'hypotenuse'],
        oppositeLabel: 'O',
        adjacentLabel: 'A',
        hypotenuseLabel: 'H',
        angleLabel: 'θ'
      },
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">SOH-CAH-TOA Reference</p>
          <div class="we-row we-highlighted">
            <span class="we-mnemonic">SOH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition"><strong>sin θ = O/H (Opposite over Hypotenuse)</strong></span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">CAH</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">cos θ = A/H (Adjacent over Hypotenuse)</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-mnemonic">TOA</span>
            <span class="we-arrow">→</span>
            <span class="we-definition">tan θ = O/A (Opposite over Adjacent)</span>
          </div>
          <p class="we-explanation"><strong>sin θ = Opposite / Hypotenuse = O/H.</strong> Both sin and cos involve the hypotenuse — the difference is the numerator: sin uses the Opposite side (O), cos uses the Adjacent side (A). Memory tip: SOH — Sine, Opposite, Hypotenuse.</p>
        </div>
      `,
      feedbackOnSkip: "This one was tricky — sin θ = Opposite/Hypotenuse = O/H (SOH). A/H belongs to cos. We'll come back to it."
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) has three layers; visibility is toggled via the `hidden` class:

```
┌──────────────────────────────────────────────────────┐
│  #triangle-diagram  (SVG — always visible per round) │
│  Right triangle, angle θ at bottom-left              │
│  Two sides highlighted (orange) = ratio being tested │
│  Third side in muted color                           │
│  Side labels: letters (O/A/H) or numbers per round   │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)         │
│  Heading: questionText (from content)                │
│                                                      │
│  Three MCQ buttons (data-option attribute):          │
│  [ sin θ ]   [ cos θ ]   [ tan θ ]                  │
│     — or for identify-the-sides rounds —             │
│  [ O/H  ]   [ A/H  ]   [ O/A  ]                    │
│                                                      │
│  #correct-feedback  data-testid="correct-feedback"   │
│  (hidden by default)                                 │
│  Brief green confirmation: "Correct! sin θ = O/H"   │
│  Auto-advances after 1000ms                         │
├──────────────────────────────────────────────────────┤
│  #worked-example-panel  (hidden by default)          │
│  data-testid="worked-example-panel"                  │
│  Appears after FIRST wrong attempt only.             │
│  Contains workedExampleHtml injected from content.   │
│  Two buttons:                                        │
│    [Got it — try again]  data-testid="got-it-btn"   │
│      → allows second attempt                        │
│    [Skip this round]     data-testid="skip-round-btn"│
│      → advances immediately                         │
└──────────────────────────────────────────────────────┘
```

**SVG right triangle specification:**

The triangle is rendered as an inline `<svg>` element within `#triangle-diagram`. Use a fixed coordinate system. Right angle always at bottom-right (B), reference angle θ at bottom-left (A), and the remaining vertex at top-right (C).

```
C
|\
|  \
|    \  ← hypotenuse (AC)
|      \
B───────A (θ)
 adjacent
```

- Vertex A (bottom-left): the reference angle θ. Mark with a small arc and label "θ".
- Vertex B (bottom-right): the right angle. Mark with a small square symbol.
- Vertex C (top-right): the opposite vertex.
- `opposite` side = the vertical leg BC (left side of the triangle).
- `adjacent` side = the horizontal leg AB (bottom of the triangle).
- `hypotenuse` = the diagonal AC.
- Place side labels at the midpoint of each side, offset slightly outward.
- Sides listed in `svgConfig.highlightedSides` are drawn in orange (`#f97316`) and their labels shown in bold orange.
- The third (non-highlighted) side is drawn in a muted gray (`#94a3b8`) with its label in the same muted gray.
- The SVG must be re-rendered each round by calling `renderTriangle(round)` which sets SVG element attributes and text nodes from `svgConfig`.

**Do NOT use a static SVG.** The `renderRound()` function must call `renderTriangle(round)` to update all SVG labels and stroke colors dynamically from `svgConfig`.

---

## 6. Game Flow

### 6.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

```javascript
function startGame() {
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.currentRound = 0;
  transitionScreen.hide();
  renderRound(1);
}
```

### 6.2 renderRound(roundNumber)

```
1. const round = gameState.content.rounds[roundNumber - 1]
2. gameState.currentRound = roundNumber
3. gameState.attemptsThisRound = 0
4. gameState.isProcessing = false
5. Update SVG: call renderTriangle(round) to set side labels + highlight colors
6. Set questionText heading: document.getElementById('question-text').textContent = round.questionText
7. Render option buttons: clear #option-buttons, create 3 buttons from round.options[]
   Each button: data-option="<option string>", textContent = option string
   Each button MUST ALSO have: `data-testid="option-N"` (N=0,1,2, positional index) AND `data-value="<option string>"` (exact option text).
   Tests use `data-testid` as the stable selector since option text varies by round type (sin θ / O/H / etc).
8. Show #question-panel, hide #correct-feedback, hide #worked-example-panel
9. Enable all option buttons (remove disabled attribute)
10. Update progress bar: progressBar.setRound(roundNumber)
```

### 6.3 handleOptionClick(selectedOption)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedOption === round.correctOption)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'ratio_correct_first' : 'ratio_correct_second'
   - if (attemptsThisRound === 1): gameState.totalFirstAttemptCorrect++; gameState.score += 20
   - else: gameState.score += 10  (partial credit for correct on second attempt)
   - Show #correct-feedback with text "Correct! [round.correctOption] = [round.correctRatio] θ"
   - After 1000ms: hide #correct-feedback; advance round
   - gameState.isProcessing = false

7. else (wrong):
   - Track event: 'ratio_incorrect'
   - if (attemptsThisRound === 1):
       — Show worked example: inject round.workedExampleHtml into #worked-example-panel
       — Show #worked-example-panel with animation (slide down or fade in)
       — Enable "Got it — try again" and "Skip this round" buttons
       — gameState.isProcessing = false
       — (wait for user action on worked example panel)
   - else (attemptsThisRound === 2):
       — Track event: 'ratio_skipped'
       — Show brief skip note: inject round.feedbackOnSkip into a #skip-note element
       — After 1500ms: hide everything, advance round
       — gameState.isProcessing = false
```

### 6.4 handleWorkedExampleGotIt()

```
1. Hide #worked-example-panel
2. Re-enable option buttons (remove disabled attribute)
3. gameState.isProcessing = false
   (attemptsThisRound remains at 1, so next click is the second attempt)
```

### 6.5 handleWorkedExampleSkip()

```
1. Track event: 'ratio_skipped'
2. Hide #worked-example-panel
3. gameState.wrongFirstAttempt++
4. Show #skip-note with round.feedbackOnSkip for 1500ms
5. After 1500ms: advance round
```

### 6.6 Advance Round

```
function advanceRound() {
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame(true);  // always victory — no game-over state
  } else {
    renderRound(gameState.currentRound + 1);
  }
}
```

### 6.7 End Game

```
- Always calls endGame(true) — victory screen. No game-over.
- Star calculation based on totalFirstAttemptCorrect (out of 5):
  - 5/5 → 5★ (shown as "★★★★★ — Perfect!")
  - 4/5 → 4★
  - 3/5 → 3★
  - 2/5 → 2★
  - 1/5 → 1★
  - 0/5 → 0★ ("Keep practicing!")
- Results screen shows: first-attempt accuracy, rounds completed (always 5), star rating.
- score: accumulated from correct answers (20 pts first attempt, 10 pts second attempt).
```

---

## 7. CDN Implementation Patterns (MANDATORY)

### 7.1 Package Loading

```html
<!-- In <head>: -->
<script src="https://unpkg.com/@hw-app/cdn-games@latest/dist/bundle.js"></script>
```

### 7.2 waitForPackages

```javascript
function waitForPackages(callback) {
  const required = ['ScreenLayout', 'TransitionScreenComponent', 'ProgressBarComponent', 'FeedbackManager'];
  const maxWait = 10000;
  const interval = 100;
  let elapsed = 0;

  const check = setInterval(() => {
    const allLoaded = required.every(name => typeof window[name] !== 'undefined');
    if (allLoaded) {
      clearInterval(check);
      callback();
    } else if (elapsed >= maxWait) {
      clearInterval(check);
      console.error('Required packages failed to load:', required.filter(n => typeof window[n] === 'undefined'));
    }
    elapsed += interval;
  }, interval);
}
```

### 7.3 DOMContentLoaded Initialization

```javascript
document.addEventListener('DOMContentLoaded', () => {
  waitForPackages(() => {
    // Initialize CDN components
    visibilityTracker = new VisibilityTracker({ /* popupProps */ });
    progressBar = new ProgressBarComponent({
      totalRounds: 5,
      totalLives: 0,   // NO lives display — omit hearts
      container: document.getElementById('progress-bar-container')
    });
    transitionScreen = new TransitionScreenComponent({
      screens: {
        start: { /* start screen config */ },
        victory: { /* victory screen config */ }
      },
      onStart: startGame
    });

    // Expose on window AFTER definitions
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.nextRound = nextRound;
    // REQUIRED for test harness __ralph.jumpToRound() — without this, mechanics tests cannot jump to specific rounds
    window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); };

    // Load content (injected by pipeline or fallback)
    gameState.content = window.__gameContent || fallbackContent;

    transitionScreen.show('start');
  });
});
```

### 7.4 FeedbackManager (sound only — NO init)

```javascript
// Correct answer:
FeedbackManager.sound('correct');
FeedbackManager.playDynamicFeedback('correct', gameState.score);

// Wrong answer:
FeedbackManager.sound('incorrect');
```

**NEVER call `FeedbackManager.init()`.** Only call `.sound()` and `.playDynamicFeedback()`.

---

## 8. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests. Use `.sound()` and `.playDynamicFeedback()` only.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions. Also add `window.loadRound = function(n) { ... }` — required for test harness `__ralph.jumpToRound()`.
4. **Do NOT use a static SVG** — the triangle must be re-rendered by `renderTriangle(round)` each round. Hard-coded label text that doesn't change between rounds is a bug.
5. **Do NOT deduct lives** — this game has no lives system. Never call `progressBar.loseLife()` or decrement any lives variable. The game always ends in victory after 5 rounds.
6. **Do NOT show a game-over screen** — there is no game-over in this game. `endGame()` always calls `transitionScreen.show('victory')`.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — buttons must be disabled when the worked-example panel is shown, to prevent the learner from making a second attempt before reading the explanation.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — if buttons stay disabled the learner cannot make their second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — they must be generated dynamically from `round.options[]` each round, because options differ between `name-the-ratio` and `identify-the-sides` rounds.
13. **Do NOT omit `data-testid` on option buttons** — each button must have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"` (positional) AND `data-value="<option string>"`. Tests use `data-testid` as the stable selector since button text varies by round.
14. **Do NOT omit `data-testid` on worked-example panel elements** — the panel container must have `data-testid="worked-example-panel"`, the got-it button must have `data-testid="got-it-btn"`, the skip button must have `data-testid="skip-round-btn"`, and the correct-feedback element must have `data-testid="correct-feedback"`. Tests cannot click these elements without stable selectors.
11. **Do NOT inject `workedExampleHtml` as textContent** — use `innerHTML` to preserve the HTML structure of the worked-example card.
12. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale attempt counts from the previous round will cause the worked-example panel to not appear on the first wrong attempt of the new round.

---

## 9. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with SVG and 3 option buttons.
- **correct-first-attempt-advances**: Selecting the correct option on first attempt shows `#correct-feedback` then auto-advances to round 2 after 1000ms.
- **wrong-first-attempt-shows-worked-example**: Selecting a wrong option on first attempt shows `#worked-example-panel` with the SOH-CAH-TOA reference card. Option buttons are disabled.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#worked-example-panel` and re-enables option buttons for a second attempt.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round after the skip note fades.
- **correct-second-attempt-advances**: Selecting the correct option on second attempt (after worked example shown) shows `#correct-feedback` then advances.
- **wrong-second-attempt-skips**: Selecting wrong option on second attempt advances the round with `feedbackOnSkip` note (no further worked-example panel).
- **name-the-ratio-buttons**: For rounds 1–3 (questionType = name-the-ratio), the 3 buttons show 'sin θ', 'cos θ', 'tan θ'.
- **identify-the-sides-buttons**: For rounds 4–5 (questionType = identify-the-sides), the 3 buttons show 'O/H', 'A/H', 'O/A'.
- **complete-5-rounds**: Completing all 5 rounds (any combination of correct/skip) transitions to `data-phase="results"` (victory).
- **no-game-over**: Confirm that no game-over transition screen ever appears, regardless of answer choices.
- **svg-updates-per-round**: SVG triangle labels update correctly between rounds (round 1 vs round 4 have different side labels).

### Category: scoring

- **perfect-score**: 5 correct on first attempt → 5★, score = 100.
- **partial-score-4**: 4 correct first attempt → 4★.
- **partial-score-3**: 3 correct first attempt → 3★.
- **second-attempt-partial-credit**: Correct on second attempt adds 10 points (not 20) to score.
- **score-displayed-on-results**: Results screen shows the correct star count and score.

### Category: state-sync

- **data-phase-playing**: After game start, `document.getElementById('app').dataset.phase === 'playing'`.
- **data-round-updates**: `data-round` increments each round.
- **window-gamestate-accessible**: `window.gameState.currentRound` reflects the active round number at all times.

---

## 10. Curriculum Alignment

| Curriculum  | Standard      | Alignment                                                                                     |
| ----------- | ------------- | --------------------------------------------------------------------------------------------- |
| NCERT Class 10 | Ch 8, Section 8.1 | Rounds 1–3: direct ratio identification; Rounds 4–5: reverse identification (given name, find sides) |
| Common Core | HSG-SRT.C.6   | "Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle" |
| Common Core | HSG-SRT.C.7   | Rounds 4–5 lay groundwork for co-function relationships (sin θ = cos(90°-θ))                 |

**Session-planner prerequisite:** `triangle-parts` skill (name-the-sides game) must be completed before `which-ratio` (this game). A learner who cannot identify which side is Opposite vs Adjacent will fail at ratio selection.

**Session-planner successor:** `compute-ratio` skill (compute-it game) — given an angle and ratio type, compute the decimal value. This game provides the definition recall; compute-it adds the numerical lookup and arithmetic.

---

## 11. Pedagogical Progression: name-the-sides → which-ratio → compute-it

**name-the-sides** (triangle-parts, Bloom L1 Remember):
- The learner sees a triangle with angle θ marked and must label each side (Opposite / Adjacent / Hypotenuse) by tapping or clicking.
- Cognitive demand: recall and recognise the side names relative to the reference angle.

**which-ratio** (ratio-definition, Bloom L2 Understand — THIS GAME):
- The learner sees a labeled triangle and must identify which trig function name maps to the ratio of two given sides.
- Cognitive demand: interpret the meaning of the ratio symbol — connecting the SOH-CAH-TOA mnemonic to the geometric relationship.
- Worked-example panel on first wrong attempt provides the SOH-CAH-TOA reference card in context, not as an abstract table.

**compute-it** (compute-ratio, Bloom L3 Apply):
- The learner is given an angle value and a ratio type and must compute the decimal value using the standard angle table.
- Cognitive demand: apply the ratio definition to produce a numerical result.

**Why which-ratio is a genuine Bloom's L2 step:**
- In name-the-sides, the learner assigns one label per side (pure recognition, no relationship).
- In which-ratio, the learner must interpret the *relationship* between two sides and map it to the correct function symbol — this is Understand (L2), not just Remember (L1).
- The two question types (name-the-ratio and identify-the-sides) test the same definition in both directions, confirming genuine understanding rather than surface pattern matching.
- The primary misconception — confusing sin and cos because both use the hypotenuse — requires understanding the *distinguishing feature* (sin uses the opposite numerator; cos uses the adjacent numerator), not just recalling a keyword.

---

## 12. Worked-Example Panel CSS

The `workedExampleHtml` content uses class names that must be styled in the game's CSS. Include these styles:

```css
.worked-example-card {
  background: #f0f9ff;       /* light blue background */
  border: 2px solid #0ea5e9; /* sky blue border */
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 12px;
}

.we-title {
  font-weight: 700;
  font-size: 1rem;
  color: #0369a1;
  margin: 0 0 10px 0;
  text-align: center;
  letter-spacing: 0.05em;
}

.we-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #e0f2fe;
}

.we-row:last-of-type {
  border-bottom: none;
}

.we-highlighted {
  background: #fff7ed;       /* warm highlight for the correct row */
  border-radius: 6px;
  padding: 6px 8px;
  margin: 2px 0;
}

.we-muted {
  opacity: 0.55;
}

.we-mnemonic {
  font-weight: 800;
  font-size: 1.1rem;
  color: #7c3aed;            /* purple for SOH/CAH/TOA */
  min-width: 40px;
}

.we-highlighted .we-mnemonic {
  color: #c2410c;            /* orange for highlighted row mnemonic */
}

.we-arrow {
  color: #64748b;
  font-size: 0.9rem;
}

.we-definition {
  color: #1e293b;
  font-size: 0.95rem;
}

.we-explanation {
  margin-top: 12px;
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.5;
  background: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  border-left: 3px solid #f97316;
}
```

The worked-example panel (`#worked-example-panel`) itself must have:

```css
#worked-example-panel {
  display: none;             /* hidden by default */
  margin-top: 16px;
  animation: slideDown 0.25s ease-out;
}

#worked-example-panel.visible {
  display: block;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Toggle visibility with: `panel.classList.add('visible')` / `panel.classList.remove('visible')` (not `style.display` directly), so the CSS animation fires on each appearance.
