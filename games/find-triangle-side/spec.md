# Find the Missing Side — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 3 (Apply) for the skill `find-side`: given a right triangle with one acute angle and one known side, the learner must (1) identify which trig ratio to use, then (2) compute the unknown side. The two-step decomposition is intentional — it prevents learners from guessing the number without understanding the rationale. Step 1 is MCQ (select ratio: sin / cos / tan). Step 2 is typed numeric input (PART-014, function validation, tolerance ±0.15). An SVG right-triangle diagram is rendered per round. If step 1 is answered incorrectly, an elaborated worked-example panel reveals the correct reasoning before step 2 is unlocked. No lives are deducted on step 1 errors — only on step 2 errors. This design targets the most common misconception: knowing the formula but applying the wrong ratio (e.g., using sin when cos is correct). Session-planner prerequisite: learner has completed `soh-cah-toa-worked-example` (compute-ratio skill) before this game. Interaction type: `two-step-ratio-plus-typed`.

---

## 1. Game Identity

- **Title:** Find the Missing Side
- **Game ID:** game_find_triangle_side
- **Type:** standard
- **Description:** Students identify the correct trig ratio (sin/cos/tan) for a given angle and known side, then compute the missing side using typed numeric input. 5 rounds with distinct triangle configurations. Two-step interaction: ratio selection (MCQ) followed by computation (typed). Targets Grade 10 / NCERT Ex 8.1 / CC HSG-SRT.C.8. Prerequisite: soh-cah-toa-worked-example.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                     |
| -------- | ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                                |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                                |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                                |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                                |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                              |
| PART-006 | TimerComponent                | NO              | No timer — applying a trig ratio requires careful reasoning. Time pressure contradicts the two-step pedagogical goal.                                                            |
| PART-007 | Game State Object             | YES             | Custom fields: lives, step, selectedRatio, wrongOnStep2, isProcessing                                                                                                            |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                                |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                                |
| PART-010 | Event Tracking                | YES             | Custom events: ratio_correct, ratio_incorrect, side_correct, side_incorrect, life_lost, round_complete                                                                           |
| PART-011 | End Game & Metrics            | YES             | Star logic: 3★ = 0 step-2 errors; 2★ = 1 step-2 error; 1★ = 2 step-2 errors; 0★ = 3+ errors or game over                                                                      |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                                |
| PART-013 | Validation Fixed              | YES             | Step 1 MCQ: string equality check (selected ratio === correctRatio)                                                                                                              |
| PART-014 | Validation Function           | YES             | Step 2 typed numeric: `Math.abs(parseFloat(userAnswer) - correctAnswer) <= tolerance`                                                                                           |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                                |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                                |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup.                                                                                                          |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                                |
| PART-019 | Results Screen UI             | YES             | Custom metrics: rounds completed, step-2 errors, accuracy                                                                                                                       |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                                |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                                |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                                |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 5, totalLives: 3                                                                                                                                                    |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over                                                                                                                                               |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                   |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                           |
| PART-027 | Play Area Construction        | YES             | Layout: two-panel (step-1 panel / step-2 panel) with SVG triangle diagram above both panels. Only one panel visible at a time — toggle via CSS hidden class.                    |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with angle, givenSide, givenValue, targetSide, correctRatio, correctAnswer, tolerance, svgConfig, distractors, explanationOnWrongRatio, explanationOnWrongAnswer |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                                                                |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                                                                |
| PART-031 | API Helper                    | NO              | —                                                                                                                                                                                |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                                                                |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                                                                |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                         |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                    |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                           |

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
  lives: 3,                     // Lives remaining — deducted only on step-2 (computation) errors
  totalLives: 3,
  step: 1,                      // Current step within a round: 1 = ratio selection, 2 = computation
  selectedRatio: null,          // 'sin' | 'cos' | 'tan' — the ratio the learner selected in step 1
  wrongOnStep2: 0,              // Total computation errors across all rounds
  isProcessing: false           // Guard against double-submit
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
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
      "items": {
        "type": "object",
        "properties": {
          "angle": {
            "type": "number",
            "description": "The acute angle in degrees (e.g., 30, 45, 60). Always use standard angles so the ratio value is memorable."
          },
          "givenSide": {
            "type": "string",
            "enum": ["hypotenuse", "opposite", "adjacent"],
            "description": "Which side is known"
          },
          "givenValue": {
            "type": "number",
            "description": "The numeric length of the known side"
          },
          "targetSide": {
            "type": "string",
            "enum": ["hypotenuse", "opposite", "adjacent"],
            "description": "Which side the learner must find"
          },
          "correctRatio": {
            "type": "string",
            "enum": ["sin", "cos", "tan"],
            "description": "The trig ratio that directly relates the angle to both the given side and the target side"
          },
          "correctAnswer": {
            "type": "number",
            "description": "The numeric answer for the target side, rounded to 2 decimal places"
          },
          "tolerance": {
            "type": "number",
            "description": "Accepted margin of error for typed numeric answer (typically 0.15 for 2-decimal answers)"
          },
          "distractors": {
            "type": "array",
            "items": { "type": "string", "enum": ["sin", "cos", "tan"] },
            "minItems": 2,
            "maxItems": 2,
            "description": "The two incorrect ratio options for step 1"
          },
          "svgConfig": {
            "type": "object",
            "description": "Parameters for rendering the SVG right triangle diagram",
            "properties": {
              "labelA": { "type": "string", "description": "Label for the acute angle vertex (where θ is placed)" },
              "labelB": { "type": "string", "description": "Label for the right-angle vertex" },
              "labelC": { "type": "string", "description": "Label for the third vertex" },
              "hypotenuseLabel": { "type": "string", "description": "Text shown on the hypotenuse side (e.g., '10' or '?')" },
              "oppositeLabel": { "type": "string", "description": "Text shown on the opposite side (e.g., '?' or '7.07')" },
              "adjacentLabel": { "type": "string", "description": "Text shown on the adjacent side (e.g., '8' or '?')" }
            },
            "required": ["labelA", "labelB", "labelC", "hypotenuseLabel", "oppositeLabel", "adjacentLabel"]
          },
          "explanationOnWrongRatio": {
            "type": "string",
            "description": "Elaborated feedback shown when the learner picks the wrong ratio in step 1. Must name the correct ratio AND explain which sides it connects to the given angle. E.g., 'cos uses Adjacent and Hypotenuse — cos(θ) = Adjacent/Hypotenuse. Since we know the hypotenuse and want the adjacent side, we use cos.'"
          },
          "explanationOnWrongAnswer": {
            "type": "string",
            "description": "Elaborated feedback shown when the learner types the wrong number in step 2. Must show the full substitution: ratio × givenValue = correctAnswer."
          },
          "hint": {
            "type": "string",
            "description": "One-line hint shown below the input field from the start of step 2. Reminds the learner of the formula, e.g., 'opposite = sin(θ) × hypotenuse'"
          }
        },
        "required": ["angle", "givenSide", "givenValue", "targetSide", "correctRatio", "correctAnswer", "tolerance", "distractors", "svgConfig", "explanationOnWrongRatio", "explanationOnWrongAnswer", "hint"]
      },
      "minItems": 5,
      "maxItems": 5,
      "description": "Exactly 5 rounds. Each round uses a different triangle configuration. No two rounds should have the same correctRatio — vary between sin, cos, tan, and include at least 2 different angles."
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
    // ROUND 1: sin — find opposite given hypotenuse
    // θ = 30°, hypotenuse = 10 → opposite = sin(30°) × 10 = 5
    // Misconception: learner uses cos (gives adjacent, not opposite)
    // ============================================================
    {
      angle: 30,
      givenSide: 'hypotenuse',
      givenValue: 10,
      targetSide: 'opposite',
      correctRatio: 'sin',
      correctAnswer: 5,
      tolerance: 0.15,
      distractors: ['cos', 'tan'],
      svgConfig: {
        labelA: 'A (30°)',
        labelB: 'B (90°)',
        labelC: 'C',
        hypotenuseLabel: '10',
        oppositeLabel: '?',
        adjacentLabel: '8.66'
      },
      explanationOnWrongRatio:
        'sin uses Opposite and Hypotenuse — sin(θ) = Opposite / Hypotenuse. ' +
        'We know the hypotenuse (10) and need the opposite side, so sin is correct.',
      explanationOnWrongAnswer:
        'opposite = sin(30°) × hypotenuse = 0.5 × 10 = 5. ' +
        'sin(30°) = 0.5 is a standard value to memorise.',
      hint: 'opposite = sin(θ) × hypotenuse'
    },

    // ============================================================
    // ROUND 2: cos — find adjacent given hypotenuse
    // θ = 60°, hypotenuse = 8 → adjacent = cos(60°) × 8 = 4
    // Misconception: learner uses sin (gives opposite, not adjacent)
    // ============================================================
    {
      angle: 60,
      givenSide: 'hypotenuse',
      givenValue: 8,
      targetSide: 'adjacent',
      correctRatio: 'cos',
      correctAnswer: 4,
      tolerance: 0.15,
      distractors: ['sin', 'tan'],
      svgConfig: {
        labelA: 'A (60°)',
        labelB: 'B (90°)',
        labelC: 'C',
        hypotenuseLabel: '8',
        oppositeLabel: '6.93',
        adjacentLabel: '?'
      },
      explanationOnWrongRatio:
        'cos uses Adjacent and Hypotenuse — cos(θ) = Adjacent / Hypotenuse. ' +
        'We know the hypotenuse (8) and need the adjacent side, so cos is correct.',
      explanationOnWrongAnswer:
        'adjacent = cos(60°) × hypotenuse = 0.5 × 8 = 4. ' +
        'cos(60°) = 0.5 is the same value as sin(30°) — complementary angles share ratio values.',
      hint: 'adjacent = cos(θ) × hypotenuse'
    },

    // ============================================================
    // ROUND 3: tan — find opposite given adjacent
    // θ = 45°, adjacent = 7 → opposite = tan(45°) × 7 = 7
    // Misconception: learner uses sin (needs hypotenuse, not adjacent)
    // ============================================================
    {
      angle: 45,
      givenSide: 'adjacent',
      givenValue: 7,
      targetSide: 'opposite',
      correctRatio: 'tan',
      correctAnswer: 7,
      tolerance: 0.15,
      distractors: ['sin', 'cos'],
      svgConfig: {
        labelA: 'A (45°)',
        labelB: 'B (90°)',
        labelC: 'C',
        hypotenuseLabel: '9.90',
        oppositeLabel: '?',
        adjacentLabel: '7'
      },
      explanationOnWrongRatio:
        'tan uses Opposite and Adjacent — tan(θ) = Opposite / Adjacent. ' +
        'We know the adjacent side (7) and need the opposite side. ' +
        'sin and cos both require the hypotenuse, which is not given here — tan is the only choice.',
      explanationOnWrongAnswer:
        'opposite = tan(45°) × adjacent = 1 × 7 = 7. ' +
        'tan(45°) = 1 because opposite = adjacent in a 45-45-90 triangle.',
      hint: 'opposite = tan(θ) × adjacent'
    },

    // ============================================================
    // ROUND 4: sin — find hypotenuse given opposite (rearranged)
    // θ = 30°, opposite = 6 → hypotenuse = opposite / sin(30°) = 6 / 0.5 = 12
    // Harder: formula must be rearranged (sin → divide, not multiply)
    // Misconception: learner multiplies instead of divides
    // ============================================================
    {
      angle: 30,
      givenSide: 'opposite',
      givenValue: 6,
      targetSide: 'hypotenuse',
      correctRatio: 'sin',
      correctAnswer: 12,
      tolerance: 0.15,
      distractors: ['cos', 'tan'],
      svgConfig: {
        labelA: 'A (30°)',
        labelB: 'B (90°)',
        labelC: 'C',
        hypotenuseLabel: '?',
        oppositeLabel: '6',
        adjacentLabel: '10.39'
      },
      explanationOnWrongRatio:
        'sin uses Opposite and Hypotenuse — sin(θ) = Opposite / Hypotenuse. ' +
        'We know the opposite (6) and need the hypotenuse. Rearrange: hypotenuse = opposite / sin(θ).',
      explanationOnWrongAnswer:
        'hypotenuse = opposite / sin(30°) = 6 / 0.5 = 12. ' +
        'When the hypotenuse is unknown, divide (not multiply) by the ratio value.',
      hint: 'hypotenuse = opposite ÷ sin(θ)'
    },

    // ============================================================
    // ROUND 5: cos — find hypotenuse given adjacent (rearranged)
    // θ = 45°, adjacent = 5 → hypotenuse = adjacent / cos(45°) = 5 / 0.707 ≈ 7.07
    // Harder: formula rearranged + non-integer answer
    // Misconception: learner multiplies (gives 3.54) instead of divides
    // ============================================================
    {
      angle: 45,
      givenSide: 'adjacent',
      givenValue: 5,
      targetSide: 'hypotenuse',
      correctRatio: 'cos',
      correctAnswer: 7.07,
      tolerance: 0.15,
      distractors: ['sin', 'tan'],
      svgConfig: {
        labelA: 'A (45°)',
        labelB: 'B (90°)',
        labelC: 'C',
        hypotenuseLabel: '?',
        oppositeLabel: '5',
        adjacentLabel: '5'
      },
      explanationOnWrongRatio:
        'cos uses Adjacent and Hypotenuse — cos(θ) = Adjacent / Hypotenuse. ' +
        'We know the adjacent (5) and need the hypotenuse. Rearrange: hypotenuse = adjacent / cos(θ).',
      explanationOnWrongAnswer:
        'hypotenuse = adjacent / cos(45°) = 5 / 0.707 ≈ 7.07. ' +
        'cos(45°) = √2/2 ≈ 0.707. Dividing gives a larger number than the given side — this is correct because the hypotenuse is always the longest side.',
      hint: 'hypotenuse = adjacent ÷ cos(θ)'
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) has three layers rendered at all times; visibility is toggled via `hidden` class:

```
┌──────────────────────────────────────────────────┐
│  #triangle-diagram  (SVG — always visible)       │
│  Right triangle: angle label, side labels, ?     │
│  The "?" mark rotates to the targetSide each     │
│  round. Known side shows its numeric value.      │
├──────────────────────────────────────────────────┤
│  #step1-panel  (ratio selection MCQ)             │
│  Heading: "Which trig ratio relates angle θ,    │
│  the [givenSide] and the [targetSide]?"          │
│  Three buttons: sin θ  |  cos θ  |  tan θ        │
│  (rendered with data-ratio attribute)            │
│                                                  │
│  #ratio-feedback  (hidden by default)            │
│  Shows explanationOnWrongRatio after wrong       │
│  step-1 answer; "Continue" button advances to   │
│  step 2 regardless (no life deducted).           │
├──────────────────────────────────────────────────┤
│  #step2-panel  (hidden until step 1 done)        │
│  Heading: "Now calculate: [targetSide] = ?"      │
│  Sub-heading: hint text (always visible here)   │
│  Input: <input type="number" id="answer-input"> │
│  Submit: <button id="btn-submit">Check</button>  │
│                                                  │
│  #answer-feedback  (hidden by default)           │
│  Shows explanationOnWrongAnswer after wrong      │
│  step-2 answer; life deducted; "Try Again"       │
│  button allows retry (same round).               │
└──────────────────────────────────────────────────┘
```

**SVG right triangle specification:**

The triangle must be rendered inline as an `<svg>` element within `#triangle-diagram`. Use a fixed coordinate system: right angle always at bottom-right (B), reference angle θ at bottom-left (A), and the remaining vertex at top-right (C).

```
C
|\
|  \
|    \  ← hypotenuse (AC)
|      \
B───────A (θ)
 adjacent
```

- Label θ at vertex A with a small arc and the degree value.
- Label the right angle at B with a small square symbol.
- Place side labels at the midpoints of each side.
- The "unknown" side (targetSide) shows "?" in a distinct color (orange, `#f97316`).
- The known side shows its numeric value in the default text color.
- The third side (neither given nor target) shows a computed label from svgConfig.

The SVG must be generated from the `svgConfig` fields in the content — it is NOT static. The `renderRound()` function must update the SVG text labels each round.

---

## 6. Game Flow

### 6.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

### 6.2 renderRound(roundNumber)

```
1. Load round data: const round = gameState.content.rounds[roundNumber - 1]
2. Update SVG diagram: set hypotenuseLabel, oppositeLabel, adjacentLabel in SVG text nodes
3. Set step to 1: gameState.step = 1; gameState.selectedRatio = null
4. Show #step1-panel, hide #step2-panel, hide #ratio-feedback, hide #answer-feedback
5. Update ratio button labels (always "sin θ", "cos θ", "tan θ" — not shuffled; ratio names are fixed vocabulary)
6. Update progress bar
```

### 6.3 handleRatioSelection(selectedRatio)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. gameState.selectedRatio = selectedRatio
3. if (selectedRatio === round.correctRatio):
   - Track event: ratio_correct
   - Hide #step1-panel, advance to step 2: show #step2-panel
   - Clear input field; focus #answer-input
   - gameState.step = 2
   - gameState.isProcessing = false
4. else:
   - Track event: ratio_incorrect
   - Show #ratio-feedback with explanationOnWrongRatio text
   - Disable ratio buttons (prevent re-selection)
   - Show "Continue to calculation →" button inside #ratio-feedback
   - gameState.isProcessing = false
   - NOTE: no life deducted on wrong ratio. The feedback is instructional.
```

### 6.4 handleRatioFeedbackContinue()

```
1. Hide #ratio-feedback; hide #step1-panel
2. Show #step2-panel; focus #answer-input
3. gameState.step = 2
```

### 6.5 handleAnswerSubmit()

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. const userAnswer = parseFloat(document.getElementById('answer-input').value.trim())
3. if (isNaN(userAnswer)): show validation error "Please enter a number"; gameState.isProcessing = false; return
4. const isCorrect = Math.abs(userAnswer - round.correctAnswer) <= round.tolerance
5. if (isCorrect):
   - Track event: side_correct
   - gameState.score += 10
   - Show brief correct confirmation in #answer-feedback ("Correct! [targetSide] = [correctAnswer]")
   - After 1200ms: advance to next round or end game
   - gameState.isProcessing = false
6. else:
   - Track event: side_incorrect
   - gameState.wrongOnStep2++
   - gameState.lives--
   - Deduct life from progress bar
   - Show #answer-feedback with explanationOnWrongAnswer text + "Try Again" button
   - if (gameState.lives <= 0): after 1500ms call endGame(false) — game over
   - gameState.isProcessing = false
```

### 6.6 End Game

```
- If all 5 rounds complete: endGame(true) — victory
- Star calculation:
  - 3★: wrongOnStep2 === 0
  - 2★: wrongOnStep2 === 1
  - 1★: wrongOnStep2 === 2
  - 0★: wrongOnStep2 >= 3 or game over
- Results screen shows: rounds completed, step-2 errors, star rating
```

---

## 7. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions.
4. **Do NOT leave both `#step1-panel` and `#step2-panel` visible simultaneously** — exactly one must be visible at all times during active game play.
5. **Do NOT hardcode SVG side labels** — they must be set dynamically in `renderRound()` from `svgConfig`.
6. **Do NOT deduct a life on wrong ratio (step 1)** — only step 2 errors cost a life. Lives deduction in step 1 contradicts the pedagogical design.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleRatioSelection` or `handleAnswerSubmit` twice.
8. **Do NOT forget to clear and focus `#answer-input`** in `renderRound()` — stale values from the previous round cause incorrect validation.
9. **Do NOT use `parseInt` for the answer** — answers are decimal numbers; always use `parseFloat`.
10. **Do NOT render the input in step 1 or the ratio buttons in step 2** — each panel must contain only its own controls.

---

## 8. Test Scenarios (for test generation guidance)

The test generator (PART-035) must cover all of the following cases:

### Category: game-flow
- **start-screen**: Page loads, start button is visible, phase is `start`.
- **game-start**: Clicking play transitions to `playing` phase; round 1 renders with SVG diagram and step-1 ratio buttons.
- **correct-ratio-advances-to-step2**: Selecting the correct ratio hides step-1 panel and shows step-2 panel with input field.
- **wrong-ratio-shows-feedback**: Selecting a wrong ratio shows `#ratio-feedback` with elaborated text; ratio buttons become disabled.
- **continue-after-wrong-ratio**: Clicking "Continue" after wrong ratio dismisses feedback and shows step-2 panel.
- **correct-answer-advances-round**: Typing correct answer and submitting advances to next round.
- **wrong-answer-deducts-life**: Typing wrong answer deducts one life from progress bar and shows `#answer-feedback`.
- **complete-5-rounds**: Completing all 5 rounds triggers victory transition to results screen.
- **game-over-on-3-lives-lost**: Losing 3 lives triggers game-over transition screen.
- **results-screen**: Results screen shows star rating and rounds completed.

### Category: scoring
- **3-star-zero-errors**: No step-2 errors → 3 stars.
- **2-star-one-error**: Exactly 1 step-2 error → 2 stars.
- **score-increments**: Score increases by 10 for each correct answer.

### Category: lives
- **lives-start-at-3**: At game start, `data-lives="3"`.
- **wrong-answer-reduces-lives**: After 1 step-2 error, `data-lives="2"`.

---

## 9. Curriculum Alignment

| Curriculum | Standard | Alignment |
|-----------|----------|-----------|
| NCERT Class 10 | Ch 8, Section 8.1, Ex 8.1 Q1–Q7 | Rounds 1–3 (direct formula); Rounds 4–5 (rearranged formula) |
| Common Core | HSG-SRT.C.8 | "Use trig ratios and Pythagorean theorem to solve right triangles in applied problems" |

**Session-planner prerequisite:** `compute-ratio` skill (soh-cah-toa-worked-example game) must be completed before `find-side` (this game).

**Session-planner successor:** `real-world-application` skill (trig-real-world game) — word problems that require the same computation in a contextualised setting.

---

## 10. Pedagogical Progression: soh-cah-toa-worked-example → find-triangle-side

**soh-cah-toa-worked-example** (compute-ratio, Bloom L3 procedural):
- The learner is given the ratio type and must compute its value or apply it to find a side.
- All three sub-phases (example, faded, practice) show the ratio name up front — the learner never has to *choose* which ratio to use.
- Cognitive demand: execute a pre-identified procedure.

**find-triangle-side** (find-side, Bloom L3 Apply → border of L4 Analyze):
- The learner is given a triangle with a known side and angle. They must *identify* which ratio relates those two sides, then *compute* the unknown side.
- The two-step structure forces explicit ratio selection before computation — preventing the "right answer for the wrong reason" failure mode.
- Cognitive demand: select the appropriate procedure (Apply), not just execute it.

**Why this is a genuine Bloom's step up:**
- In worked-example, the procedure is handed to the learner. In find-triangle-side, the learner must recognise the problem structure and *decide* which procedure to apply.
- This distinction is the Apply vs. Understand boundary: Apply requires the learner to use a procedure in a new situation (a triangle with a different given/target side pair each round), not just repeat it in the same context.
- The two hardest rounds (4 and 5) require rearranging the formula (divide instead of multiply), which adds a reasoning step that is absent in soh-cah-toa-worked-example.
- Together, the two games form a complete L2→L3 scaffold: understand the definition (worked-example) → apply it to find an unknown (find-triangle-side).
