<!--
  SKILL: Apply trigonometry to real-world problems (height, distance, slope)
  BLOOM LEVEL: L4 — Analyze
  CURRICULUM: NCERT Class 10 Ch 9 §9.1 (Heights and Distances), CC HSG-SRT.C.8
  SESSION POSITION: Game 5 of 5 (prerequisite-ordered — capstone)
  MISCONCEPTION TARGETED: Transformation failure — students understand the word problem but cannot
    convert it to a right-triangle diagram and label sides. 45.6% of errors occur at transformation stage.
    (Arhin & Hokor 2021 — Analysis of High School Students' Errors in Solving Trigonometry Problems)
  SOURCE: https://www.mathsciteacher.com/download/analysis-of-high-school-students-errors-in-solving-trigonometry-problems-11076.pdf
  STANDARD: HSG-SRT.C.6 — Understand that by similarity, side ratios in right triangles are
    properties of the angles in the triangle, leading to definitions of trigonometric ratios for acute angles.
  NCERT: Ch 9 §9.1 Heights and Distances — tower height, shadow, river width, kite string, ramp slope.
    16 questions (6 easy, 5 moderate, 5 long). 12 marks in CBSE Class 10 board exam.
  REAL-WORLD CONTEXTS: tower height (tan 45°=h/30), kite string (100×sin60°=50√3m), ramp slope (sin θ=rise/hyp)
  SESSION ID: trigonometry-class10-20260322-7j6biw
  GENERATED: Phase 5 — Session Planner spec generation, 2026-03-23
-->

# Real-World Trig Problem — Session Variant (Trig Class 10, Game 5 of 5 — Capstone)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. Omit `FeedbackManager.init()` entirely. Do NOT call `FeedbackManager.sound` or `FeedbackManager.playDynamicFeedback` — all audio calls are omitted in this game (same pattern as find-triangle-side build #549).

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 4 (Analyze) for the skill `real-world-application`: given a word problem, the learner must (1) identify which physical side of the embedded right triangle is the known quantity relative to the reference angle, (2) select the correct trig ratio (sin/cos/tan), and (3) compute the missing measurement in context units. Session position: Game 5 of 5 — capstone of the trig session. Prerequisites: all four preceding games (name-the-sides → which-ratio → soh-cah-toa-worked-example → find-triangle-side). Target misconception: transformation failure — 45.6% of students cannot convert a word problem into a right-triangle diagram (Arhin & Hokor 2021). Real-world contexts from NCERT Ch 9 §9.1: tower height (tan 45° = h/30 → h=30 m), kite string (100 × sin 60° = 50√3 m), ramp slope (sin θ = rise/hyp). The three-step decomposition forces the learner to construct a mental model from the word description rather than pattern-match to a formula. Step 1: diagram labeling MCQ (opposite/adjacent/hypotenuse). Step 2: ratio selection MCQ (sin/cos/tan). Step 3: typed numeric input (PART-014, tolerance ±0.15). Lives deducted only on step-3 errors. NCERT alignment: Ch 9 §9.1 — 16 questions, 12 board-exam marks. Interaction type: `word-problem-three-step`.

---

## 1. Game Identity

- **Title:** Real-World Trig Problems
- **Game ID:** game_real_world_trig
- **Bloom Level:** L4 Analyze
- **Type:** standard
- **Description:** Students read a word problem (tower height, kite string, ramp, shadow), identify which sides of the embedded right triangle are known and unknown, select the correct trig ratio, then compute the answer in context units. 4 rounds using NCERT Ch 9 real-world contexts: tower at 45° elevation (tan), kite string at 60° (sin), ramp incline (sin), shadow length (tan). Difficulty increases from direct formula to rearranged formula. Three-step interaction: diagram labeling (MCQ) → ratio selection (MCQ) → computation (typed). Targets NCERT Class 10 Ch 9 §9.1 (Heights and Distances) / CC HSG-SRT.C.8 / Bloom L4 Analyze. Addresses transformation failure misconception (Arhin & Hokor 2021 — 45.6% error rate). Session position: Game 5 of 5 (capstone). Prerequisite: find-triangle-side (Game 4).

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                     |
| -------- | ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                                |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                                |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                                |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                                |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                              |
| PART-006 | TimerComponent                | NO              | No timer — problem setup requires careful reading and reasoning. Time pressure contradicts the L4 Analyze pedagogical goal.                                                      |
| PART-007 | Game State Object             | YES             | Custom fields: lives, step, selectedKnownSide, selectedRatio, wrongOnStep3, isProcessing                                                                                         |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                                |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                                |
| PART-010 | Event Tracking                | YES             | Custom events: diagram_correct, diagram_incorrect, ratio_correct, ratio_incorrect, compute_correct, compute_incorrect, life_lost, round_complete                                  |
| PART-011 | End Game & Metrics            | YES             | Star logic: 3★ = 0 step-3 errors; 2★ = 1 step-3 error; 1★ = 2 step-3 errors; 0★ = 3+ errors or game over                                                                       |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                                |
| PART-013 | Validation Fixed              | YES             | Steps 1 and 2 MCQ: string equality check (selected option === correctAnswer)                                                                                                     |
| PART-014 | Validation Function           | YES             | Step 3 typed numeric: `Math.abs(parseFloat(userAnswer) - correctAnswer) <= tolerance`                                                                                            |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                                |
| PART-016 | StoriesComponent              | NO              | Word problem text is rendered inline in the play area — not via StoriesComponent, which is designed for sequential narrative cards, not problem setup.                           |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup.                                                                                                           |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                                |
| PART-019 | Results Screen UI             | YES             | Custom metrics: rounds completed, step-3 errors, accuracy                                                                                                                        |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                                |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                                |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                                |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 4, totalLives: 3                                                                                                                                                    |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over                                                                                                                                               |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                   |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                           |
| PART-027 | Play Area Construction        | YES             | Layout: word-problem card at top (always visible) + SVG triangle diagram (always visible) + three sequential step panels toggled via CSS hidden class. One step panel at a time. |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with scenario, diagramConfig, knownSideOptions, correctKnownSide, correctRatio, correctAnswer, tolerance, unit, ratioDistractors, explanations, hint         |
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
  totalRounds: 4,
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
  lives: 3,                      // Lives remaining — deducted only on step-3 (computation) errors
  totalLives: 3,
  step: 1,                       // Current step within a round: 1 = diagram label, 2 = ratio select, 3 = compute
  selectedKnownSide: null,       // 'opposite' | 'adjacent' | 'hypotenuse' — step 1 selection
  selectedRatio: null,           // 'sin' | 'cos' | 'tan' — step 2 selection
  wrongOnStep3: 0,               // Total computation errors across all rounds
  isProcessing: false            // Guard against double-submit
};

window.gameState = gameState;    // MANDATORY: test harness reads window.gameState

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
          "scenario": {
            "type": "string",
            "description": "The word problem text in plain English. Must include: real-world context, what is known (value + unit), what is asked (measurement + unit), and the angle in degrees. E.g., 'A 10 m ladder leans against a wall, making a 60° angle with the ground. How high up the wall does it reach?'"
          },
          "diagramConfig": {
            "type": "object",
            "description": "Parameters for rendering the SVG right triangle diagram with context labels (not generic Opp/Adj/Hyp — use the actual nouns from the scenario)",
            "properties": {
              "angleLabel": {
                "type": "string",
                "description": "Degree value shown at the reference angle vertex, e.g., '60°'"
              },
              "angleVertex": {
                "type": "string",
                "enum": ["bottom-left", "bottom-right"],
                "description": "Which vertex holds the reference angle"
              },
              "hypotenuseLabel": {
                "type": "string",
                "description": "Context label for the hypotenuse side, e.g., 'ladder (10 m)' or 'cable (?)'"
              },
              "oppositeLabel": {
                "type": "string",
                "description": "Context label for the opposite side, e.g., 'wall height (?)' or 'pole (5 m)'"
              },
              "adjacentLabel": {
                "type": "string",
                "description": "Context label for the adjacent side, e.g., 'ground' or 'shadow (12 m)'"
              },
              "unknownSideIndicator": {
                "type": "string",
                "enum": ["hypotenuse", "opposite", "adjacent"],
                "description": "Which side shows the '?' marker in orange"
              }
            },
            "required": ["angleLabel", "angleVertex", "hypotenuseLabel", "oppositeLabel", "adjacentLabel", "unknownSideIndicator"]
          },
          "knownSideOptions": {
            "type": "array",
            "items": { "type": "string", "enum": ["opposite", "adjacent", "hypotenuse"] },
            "minItems": 3,
            "maxItems": 3,
            "description": "All three options shown in step-1 MCQ. The learner picks which describes the known (given) side relative to the reference angle."
          },
          "correctKnownSide": {
            "type": "string",
            "enum": ["opposite", "adjacent", "hypotenuse"],
            "description": "Which side label correctly describes the known quantity relative to the reference angle"
          },
          "correctRatio": {
            "type": "string",
            "enum": ["sin", "cos", "tan"],
            "description": "The trig ratio that directly relates the reference angle to the known side and the unknown side"
          },
          "ratioDistractors": {
            "type": "array",
            "items": { "type": "string", "enum": ["sin", "cos", "tan"] },
            "minItems": 2,
            "maxItems": 2,
            "description": "The two incorrect ratio options for step 2"
          },
          "correctAnswer": {
            "type": "number",
            "description": "Numeric answer for the unknown measurement, rounded to 2 decimal places"
          },
          "tolerance": {
            "type": "number",
            "description": "Accepted margin of error for typed numeric answer (typically 0.15)"
          },
          "unit": {
            "type": "string",
            "description": "The unit label displayed next to the answer input and in feedback, e.g., 'm', 'ft', 'cm'"
          },
          "explanationOnWrongDiagram": {
            "type": "string",
            "description": "Feedback shown when the learner misidentifies the known side in step 1. Must name the angle, identify which physical object in the scenario is opposite/adjacent/hypotenuse, and state the correct answer. E.g., 'The ladder is the hypotenuse — it is the slanted side opposite the right angle (where wall meets ground).'"
          },
          "explanationOnWrongRatio": {
            "type": "string",
            "description": "Feedback shown when the learner picks the wrong ratio in step 2. Must state which two sides are involved using scenario nouns, name the correct ratio, and show the formula. E.g., 'We know the hypotenuse (ladder = 10 m) and want the opposite (wall height). sin = Opposite / Hypotenuse — so sin is correct.'"
          },
          "explanationOnWrongAnswer": {
            "type": "string",
            "description": "Feedback shown when the learner types the wrong number in step 3. Must show the full substitution with scenario nouns and numeric values. E.g., 'wall height = sin(60°) × ladder = 0.866 × 10 = 8.66 m'"
          },
          "hint": {
            "type": "string",
            "description": "One-line hint shown below the input field from the start of step 3. Uses scenario nouns, e.g., 'wall height = sin(θ) × ladder length'"
          }
        },
        "required": [
          "scenario", "diagramConfig", "knownSideOptions", "correctKnownSide",
          "correctRatio", "ratioDistractors", "correctAnswer", "tolerance", "unit",
          "explanationOnWrongDiagram", "explanationOnWrongRatio", "explanationOnWrongAnswer", "hint"
        ]
      },
      "minItems": 4,
      "maxItems": 4,
      "description": "Exactly 4 rounds. Each round uses a distinct real-world scenario. Cover at least 3 different trig ratios across the 4 rounds. Difficulty increases: rounds 1-2 direct formula (multiply), rounds 3-4 rearranged formula (divide) or less common configuration."
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
    // ROUND 1: sin — ladder against wall (direct formula)
    // Scenario: 10 m ladder, 60° from ground → find wall height
    // Known: hypotenuse (ladder = 10 m). Unknown: opposite (wall height).
    // Correct: sin(60°) × 10 = 0.866 × 10 = 8.66 m
    // Misconception targeted: confusing hypotenuse with adjacent —
    //   learners often picture the ladder as a vertical side, making
    //   the wall the "hypotenuse" in their mental model.
    // ============================================================
    {
      scenario: 'A 10 m ladder leans against a vertical wall, making an angle of 60° with the ground. How high up the wall does the ladder reach?',
      diagramConfig: {
        angleLabel: '60°',
        angleVertex: 'bottom-left',
        hypotenuseLabel: 'ladder (10 m)',
        oppositeLabel: 'wall height (?)',
        adjacentLabel: 'ground',
        unknownSideIndicator: 'opposite'
      },
      knownSideOptions: ['opposite', 'adjacent', 'hypotenuse'],
      correctKnownSide: 'hypotenuse',
      correctRatio: 'sin',
      ratioDistractors: ['cos', 'tan'],
      correctAnswer: 8.66,
      tolerance: 0.15,
      unit: 'm',
      explanationOnWrongDiagram:
        'The ladder is the hypotenuse — it is the slanted side, and it is opposite the right angle ' +
        '(the wall meets the ground at 90°). The wall height is the side opposite the 60° angle. ' +
        'The section of ground between the wall base and ladder foot is the adjacent side.',
      explanationOnWrongRatio:
        'We know the hypotenuse (ladder = 10 m) and want the opposite side (wall height). ' +
        'sin uses Opposite and Hypotenuse: sin(θ) = Opposite / Hypotenuse. So sin is correct. ' +
        'cos would give the ground distance, not the wall height.',
      explanationOnWrongAnswer:
        'wall height = sin(60°) × ladder = 0.866 × 10 = 8.66 m. ' +
        'sin(60°) = √3/2 ≈ 0.866. The wall height is shorter than the ladder — correct.',
      hint: 'wall height = sin(60°) × ladder length'
    },

    // ============================================================
    // ROUND 2: cos — wheelchair ramp (direct formula)
    // Scenario: 8 m ramp, 30° angle of elevation → find horizontal distance covered
    // Known: hypotenuse (ramp = 8 m). Unknown: adjacent (horizontal run).
    // Correct: cos(30°) × 8 = 0.866 × 8 = 6.93 m
    // Misconception targeted: using sin when the adjacent (not opposite)
    //   is wanted — the common error after seeing "angle of elevation."
    // ============================================================
    {
      scenario: 'A wheelchair ramp is 8 m long and makes an angle of 30° with the ground. What is the horizontal distance covered by the ramp?',
      diagramConfig: {
        angleLabel: '30°',
        angleVertex: 'bottom-left',
        hypotenuseLabel: 'ramp (8 m)',
        oppositeLabel: 'vertical rise',
        adjacentLabel: 'horizontal run (?)',
        unknownSideIndicator: 'adjacent'
      },
      knownSideOptions: ['opposite', 'adjacent', 'hypotenuse'],
      correctKnownSide: 'hypotenuse',
      correctRatio: 'cos',
      ratioDistractors: ['sin', 'tan'],
      correctAnswer: 6.93,
      tolerance: 0.15,
      unit: 'm',
      explanationOnWrongDiagram:
        'The ramp is the hypotenuse — the slanted surface opposite the right angle. ' +
        'The horizontal run is adjacent to the 30° angle (it lies along the ground). ' +
        'The vertical rise is opposite the 30° angle.',
      explanationOnWrongRatio:
        'We know the hypotenuse (ramp = 8 m) and want the adjacent side (horizontal run). ' +
        'cos uses Adjacent and Hypotenuse: cos(θ) = Adjacent / Hypotenuse. So cos is correct. ' +
        'sin would give the vertical rise instead.',
      explanationOnWrongAnswer:
        'horizontal run = cos(30°) × ramp = 0.866 × 8 ≈ 6.93 m. ' +
        'cos(30°) = √3/2 ≈ 0.866. The run is shorter than the ramp — correct for a 30° slope.',
      hint: 'horizontal run = cos(30°) × ramp length'
    },

    // ============================================================
    // ROUND 3: tan — flagpole shadow (direct formula, but tan required)
    // Scenario: flagpole casts a 12 m shadow, sun angle 45° → find flagpole height
    // Known: adjacent (shadow = 12 m). Unknown: opposite (flagpole height).
    // Correct: tan(45°) × 12 = 1 × 12 = 12 m
    // Misconception targeted: trying to use sin or cos when the
    //   hypotenuse (line of sight to sun) is not given — tan is the
    //   only valid choice when only opp and adj are involved.
    // ============================================================
    {
      scenario: 'A flagpole casts a shadow 12 m long when the sun is at an angle of elevation of 45°. How tall is the flagpole?',
      diagramConfig: {
        angleLabel: '45°',
        angleVertex: 'bottom-left',
        hypotenuseLabel: 'line of sight (not given)',
        oppositeLabel: 'flagpole height (?)',
        adjacentLabel: 'shadow (12 m)',
        unknownSideIndicator: 'opposite'
      },
      knownSideOptions: ['opposite', 'adjacent', 'hypotenuse'],
      correctKnownSide: 'adjacent',
      correctRatio: 'tan',
      ratioDistractors: ['sin', 'cos'],
      correctAnswer: 12,
      tolerance: 0.15,
      unit: 'm',
      explanationOnWrongDiagram:
        'The shadow is the adjacent side — it lies along the ground next to the 45° angle. ' +
        'The flagpole is the opposite side — it stands vertically, opposite the 45° angle. ' +
        'The line from the tip of the shadow to the top of the pole (the sun\'s line of sight) ' +
        'would be the hypotenuse, but it is not given in this problem.',
      explanationOnWrongRatio:
        'We know the adjacent side (shadow = 12 m) and want the opposite side (flagpole height). ' +
        'The hypotenuse is not given, so sin and cos cannot be used — both require the hypotenuse. ' +
        'tan uses Opposite and Adjacent: tan(θ) = Opposite / Adjacent. So tan is the only valid choice.',
      explanationOnWrongAnswer:
        'flagpole height = tan(45°) × shadow = 1 × 12 = 12 m. ' +
        'tan(45°) = 1 because opposite = adjacent in a 45-45-90 triangle. ' +
        'The flagpole and its shadow are equal in length.',
      hint: 'flagpole height = tan(45°) × shadow length'
    },

    // ============================================================
    // ROUND 4: sin rearranged — cable supporting a pole
    // Scenario: 5 m vertical pole supported by a cable at 30° from ground
    //   → find cable length (hypotenuse, unknown)
    // Known: opposite (pole = 5 m). Unknown: hypotenuse (cable).
    // Correct: cable = pole / sin(30°) = 5 / 0.5 = 10 m (rearranged — divide)
    // Misconception targeted: multiplying instead of dividing when the
    //   hypotenuse is the unknown and the formula must be rearranged.
    //   A learner who multiplies gets 5 × 0.5 = 2.5, shorter than the
    //   pole — which is impossible (hypotenuse is always the longest side).
    // ============================================================
    {
      scenario: 'A 5 m vertical pole is supported by a cable anchored to the ground. The cable makes an angle of 30° with the ground. How long is the cable?',
      diagramConfig: {
        angleLabel: '30°',
        angleVertex: 'bottom-left',
        hypotenuseLabel: 'cable (?)',
        oppositeLabel: 'pole (5 m)',
        adjacentLabel: 'ground',
        unknownSideIndicator: 'hypotenuse'
      },
      knownSideOptions: ['opposite', 'adjacent', 'hypotenuse'],
      correctKnownSide: 'opposite',
      correctRatio: 'sin',
      ratioDistractors: ['cos', 'tan'],
      correctAnswer: 10,
      tolerance: 0.15,
      unit: 'm',
      explanationOnWrongDiagram:
        'The pole is the opposite side — it stands vertically, opposite the 30° angle at the cable anchor. ' +
        'The cable is the hypotenuse — the slanted side connecting the anchor to the top of the pole. ' +
        'The ground between the anchor and the pole base is the adjacent side.',
      explanationOnWrongRatio:
        'We know the opposite side (pole = 5 m) and want the hypotenuse (cable). ' +
        'sin uses Opposite and Hypotenuse: sin(θ) = Opposite / Hypotenuse. ' +
        'Rearranged: Hypotenuse = Opposite / sin(θ). So sin is correct.',
      explanationOnWrongAnswer:
        'cable = pole / sin(30°) = 5 / 0.5 = 10 m. ' +
        'sin(30°) = 0.5. When the hypotenuse is unknown, DIVIDE the opposite by sin(θ). ' +
        'Multiplying (5 × 0.5 = 2.5) gives a shorter result than the pole — impossible, ' +
        'since the hypotenuse is always the longest side of a right triangle.',
      hint: 'cable length = pole height ÷ sin(30°)'
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) has four persistent layers rendered in vertical order; step panels toggle via `hidden` class. `#problem-card` and `#triangle-diagram` are always visible during active play:

```
┌──────────────────────────────────────────────────────┐
│  #problem-card  (always visible during play)         │
│  Word problem text, styled as a card/callout box.    │
│  Large readable font. Key values bolded.             │
│  E.g., "A **10 m** ladder leans at **60°** ..."     │
├──────────────────────────────────────────────────────┤
│  #triangle-diagram  (SVG — always visible)           │
│  Right triangle with context labels from scenario.   │
│  Nouns replace generic Opp/Adj/Hyp labels.           │
│  Unknown side shows "?" in orange (#f97316).         │
│  Reference angle labeled with arc and degree value.  │
│  Right-angle marker (small square) at 90° vertex.   │
├──────────────────────────────────────────────────────┤
│  #step1-panel  (visible at round start)              │
│  Step indicator: "Step 1 of 3 — Identify the known  │
│  side"                                               │
│  Heading: "Which side is the KNOWN quantity         │
│  relative to the [angle]° angle?"                   │
│  Three buttons:  Opposite  |  Adjacent  |  Hypotenuse│
│  (data-side attribute on each)                      │
│                                                      │
│  #diagram-feedback  (hidden by default)              │
│  Shows explanationOnWrongDiagram after wrong step-1  │
│  "Continue →" button inside panel. No life deducted. │
├──────────────────────────────────────────────────────┤
│  #step2-panel  (hidden until step 1 complete)        │
│  Step indicator: "Step 2 of 3 — Select the ratio"   │
│  Heading: "Which trig ratio connects the known       │
│  [correctKnownSide] to the unknown side?"           │
│  Three buttons:  sin θ  |  cos θ  |  tan θ           │
│  (data-ratio attribute on each)                     │
│                                                      │
│  #ratio-feedback  (hidden by default)                │
│  Shows explanationOnWrongRatio after wrong step-2   │
│  "Continue to calculation →" button. No life deducted│
├──────────────────────────────────────────────────────┤
│  #step3-panel  (hidden until step 2 complete)        │
│  Step indicator: "Step 3 of 3 — Calculate"          │
│  Heading: "Calculate the unknown measurement."      │
│  Sub-heading: hint text (always visible in step 3)  │
│  Input: <input type="number" id="answer-input">     │
│  Unit label: [unit] displayed inline after input    │
│  Submit: <button id="btn-submit">Check</button>     │
│                                                      │
│  #answer-feedback  (hidden by default)               │
│  Shows explanationOnWrongAnswer after wrong step-3  │
│  Life deducted. "Try Again" button — same round.    │
└──────────────────────────────────────────────────────┘
```

**SVG right triangle specification:**

Render inline as an `<svg>` element within `#triangle-diagram`. Same fixed coordinate system as `find-triangle-side`:

```
C (top)
|\
|  \
|    \  ← hypotenuse (AC)
|      \
B───────A (reference angle θ)
 adjacent
```

- `diagramConfig.angleVertex` determines whether θ is at bottom-left (A) or bottom-right.
- Label the reference angle with a small arc and the degree value (e.g., "60°").
- Label the right angle with a small square marker at the 90° corner.
- Side labels use context nouns from `diagramConfig` (e.g., "ladder (10 m)"), NOT generic "hypotenuse/opposite/adjacent".
- The unknown side shows "?" in orange (#f97316) alongside its context noun.
- All SVG text elements must be set dynamically in `renderRound()` from `diagramConfig` — never hardcoded.

---

## 6. Game Flow

### 6.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

### 6.2 renderRound(roundNumber)

```
1. Load round data: const round = gameState.content.rounds[roundNumber - 1]
2. Update #problem-card: set innerHTML to round.scenario (bold key numbers and nouns)
3. Update SVG diagram: set context labels from diagramConfig; mark unknown side with "?"
4. Reset step state: gameState.step = 1; gameState.selectedKnownSide = null; gameState.selectedRatio = null
5. Show #step1-panel; hide #step2-panel, #step3-panel, #diagram-feedback, #ratio-feedback, #answer-feedback
6. Update step indicator text: "Step 1 of 3 — Identify the known side"
7. Update progress bar
```

### 6.3 handleDiagramSelection(selectedSide)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. gameState.selectedKnownSide = selectedSide
3. if (selectedSide === round.correctKnownSide):
   - Track event: diagram_correct
   - Hide #step1-panel; show #step2-panel
   - Update step indicator: "Step 2 of 3 — Select the trig ratio"
   - gameState.step = 2; gameState.isProcessing = false
4. else:
   - Track event: diagram_incorrect
   - Show #diagram-feedback with explanationOnWrongDiagram text
   - Disable side buttons (prevent re-selection)
   - Show "Continue →" button inside #diagram-feedback
   - gameState.isProcessing = false
   - NOTE: no life deducted on wrong diagram identification.
```

### 6.4 handleDiagramFeedbackContinue()

```
1. Hide #diagram-feedback; hide #step1-panel
2. Show #step2-panel
3. Update step indicator: "Step 2 of 3 — Select the trig ratio"
4. gameState.step = 2
```

### 6.5 handleRatioSelection(selectedRatio)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. gameState.selectedRatio = selectedRatio
3. if (selectedRatio === round.correctRatio):
   - Track event: ratio_correct
   - Hide #step2-panel; show #step3-panel
   - Clear input field; focus #answer-input
   - Update step indicator: "Step 3 of 3 — Calculate the answer"
   - gameState.step = 3; gameState.isProcessing = false
4. else:
   - Track event: ratio_incorrect
   - Show #ratio-feedback with explanationOnWrongRatio text
   - Disable ratio buttons
   - Show "Continue to calculation →" button inside #ratio-feedback
   - gameState.isProcessing = false
   - NOTE: no life deducted on wrong ratio selection.
```

### 6.6 handleRatioFeedbackContinue()

```
1. Hide #ratio-feedback; hide #step2-panel
2. Show #step3-panel; focus #answer-input
3. Update step indicator: "Step 3 of 3 — Calculate the answer"
4. gameState.step = 3
```

### 6.7 handleAnswerSubmit()

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. const userAnswer = parseFloat(document.getElementById('answer-input').value.trim())
3. if (isNaN(userAnswer)): show "Please enter a number"; gameState.isProcessing = false; return
4. const isCorrect = Math.abs(userAnswer - round.correctAnswer) <= round.tolerance
5. if (isCorrect):
   - Track event: compute_correct
   - gameState.score += 10
   - Show brief correct confirmation in #answer-feedback:
     "Correct! Answer = [correctAnswer] [unit]"
   - After 1200ms: advance to next round or call endGame(true)
   - gameState.isProcessing = false
6. else:
   - Track event: compute_incorrect
   - gameState.wrongOnStep3++
   - gameState.lives--
   - Deduct life from progress bar
   - Show #answer-feedback with explanationOnWrongAnswer + "Try Again" button
   - if (gameState.lives <= 0): after 1500ms call endGame(false)
   - gameState.isProcessing = false
```

### 6.8 End Game

```
- If all 4 rounds complete: endGame(true) — victory
- Star calculation:
  - 3★: wrongOnStep3 === 0
  - 2★: wrongOnStep3 === 1
  - 1★: wrongOnStep3 === 2
  - 0★: wrongOnStep3 >= 3 or game over
- Results screen shows: rounds completed, step-3 errors, star rating
```

---

## 7. Anti-Patterns to Avoid (PART-026)

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — must be at module scope immediately after the `gameState` declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions.
4. **Do NOT show more than one step panel at a time** — exactly one of `#step1-panel`, `#step2-panel`, `#step3-panel` must be visible during active play. `#problem-card` and `#triangle-diagram` are always visible.
5. **Do NOT use generic side labels in the SVG** — context nouns from `diagramConfig` (e.g., "ladder", "wall height") must replace the generic Opp/Adj/Hyp labels. Generic labels defeat the L4 Analyze goal — the learner must connect the scenario to the triangle, not read labels that already give the answer away.
6. **Do NOT deduct a life on wrong step-1 or step-2 answers** — only step-3 (computation) errors cost a life.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleDiagramSelection`, `handleRatioSelection`, or `handleAnswerSubmit` twice.
8. **Do NOT forget to clear and focus `#answer-input`** in `renderRound()` — stale values from the previous round cause incorrect validation.
9. **Do NOT use `parseInt` for the answer** — answers are decimal numbers; always use `parseFloat`.
10. **Do NOT hardcode SVG labels** — all labels, angle positions, and unknown-side markers must be set dynamically in `renderRound()` from `diagramConfig`.
11. **Do NOT advance past step 1 without a correct OR continued diagram answer** — the learner must either answer correctly or explicitly click "Continue" after seeing feedback. Same rule applies for the step 2→3 transition. Skipping a step entirely removes the L4 cognitive demand.
12. **Do NOT label the SVG sides with the geometric term and the context noun simultaneously in step 1** — showing "opposite (pole)" in the diagram while asking "which side is opposite?" trivializes step 1. Use only the context noun (e.g., "pole (5 m)") in the diagram; the geometric label is the learner's answer.
13. **`FeedbackManager.sound` and `playDynamicFeedback` must NOT be called (PART-017=NO).** Omit all audio calls. This game produces no sound — same pattern as find-triangle-side (build #549), soh-cah-toa-worked-example (build #544), and name-the-sides (build #557).

---

## 8. Test Scenarios (for test generation guidance)

The test generator (PART-035) MUST cover all of the following cases.

**Critical enforcement:** Tests that only check `data-phase='results'` do NOT satisfy this spec. The three-step sequence must be explicitly verified. A test that jumps directly to the computation step without passing through diagram labeling and ratio selection is not testing the L4 Analyze cognitive demand.

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with `#problem-card` visible, `#triangle-diagram` visible, and `#step1-panel` visible with three side-selection buttons.
- **step1-correct-advances-to-step2**: Selecting the correct known-side option hides `#step1-panel` and shows `#step2-panel` with ratio buttons; `#step3-panel` remains hidden.
- **step1-wrong-shows-feedback**: Selecting an incorrect side shows `#diagram-feedback` with explanatory text; side buttons become disabled; `#step2-panel` remains hidden.
- **step1-continue-after-wrong**: Clicking "Continue" after wrong step-1 dismisses `#diagram-feedback` and shows `#step2-panel`; `#step1-panel` is hidden.
- **step2-correct-advances-to-step3**: Selecting the correct ratio hides `#step2-panel` and shows `#step3-panel` with numeric input, unit label, and hint text; `#step1-panel` remains hidden.
- **step2-wrong-shows-feedback**: Selecting incorrect ratio shows `#ratio-feedback`; ratio buttons become disabled; `#step3-panel` remains hidden.
- **step2-continue-after-wrong**: Clicking "Continue" after wrong step-2 shows `#step3-panel`.
- **step3-correct-advances-round**: Typing the correct answer (within tolerance) and submitting shows correct confirmation, then advances to the next round (or triggers victory if round 4 complete).
- **step3-wrong-deducts-life**: Typing wrong answer deducts one life; `data-lives` decrements; `#answer-feedback` shows explanatory text with "Try Again" button.
- **complete-4-rounds**: Completing all 4 rounds sets `data-phase="results"` (via victory transition).
- **game-over-on-3-lives-lost**: Accumulating 3 step-3 errors triggers `data-phase="game-over"`.
- **results-screen**: Results screen shows star rating and rounds-completed count.

### Category: scoring

- **3-star-zero-errors**: No step-3 errors across all 4 rounds → 3 stars displayed.
- **2-star-one-error**: Exactly 1 step-3 error → 2 stars.
- **score-increments**: `window.gameState.score` increases by 10 for each correct step-3 answer.

### Category: lives

- **lives-start-at-3**: At game start, `data-lives="3"`.
- **wrong-step3-reduces-lives**: After 1 step-3 error, `data-lives="2"`.
- **step1-errors-do-not-reduce-lives**: Wrong step-1 selection does NOT change `data-lives`. Assert `data-lives` remains at its pre-step-1 value after a wrong diagram answer.
- **step2-errors-do-not-reduce-lives**: Wrong step-2 selection does NOT change `data-lives`. Assert `data-lives` remains unchanged after a wrong ratio answer.

### Category: cognitive-demand (CRITICAL — must not be omitted or weakened)

These tests verify that the L4 Analyze sequence is structurally enforced, not just cosmetically present:

- **step2-not-visible-before-step1-complete**: At game start (step 1), `#step2-panel` must not be visible. Assert `#step2-panel` has the `hidden` class or `display: none`.
- **step3-not-visible-before-step2-complete**: At step 1 completion (transition to step 2), `#step3-panel` must still not be visible. Assert `#step3-panel` remains hidden.
- **answer-input-not-visible-at-step1**: `#answer-input` must not be visible in step 1. Learner cannot submit a numeric answer without completing steps 1 and 2.
- **diagram-labels-are-context-nouns**: SVG text content in `#triangle-diagram` should include at least one context noun from the scenario (e.g., "ladder" for round 1). Assert that SVG text does NOT consist exclusively of the generic terms "opposite", "adjacent", "hypotenuse".

---

## 9. Curriculum Alignment

| Curriculum | Standard | Alignment |
|-----------|----------|-----------|
| NCERT Class 10 | Ch 9 §9.1 (Heights and Distances) | All 4 rounds — angle-of-elevation and angle-of-depression problems with real objects |
| NCERT Class 10 | Ch 8 §8.1 Ex 8.1 Q1–Q7 | Rounds 1–2 (direct formula); Rounds 3–4 (rearranged formula or tan with no hypotenuse) |
| Common Core | HSG-SRT.C.8 | "Use trig ratios and the Pythagorean theorem to solve right triangles in applied problems" |

**Session-planner prerequisite skills (all must be complete):**

| Game | Skill | Why required |
|------|-------|-------------|
| name-the-sides | Label hyp/opp/adj relative to a reference angle | Step 1 of this game requires exactly this skill |
| soh-cah-toa-worked-example | Understand the ratio definition | Step 2 requires recognizing which ratio applies |
| find-triangle-side | Select ratio + compute when triangle is given | Step 2 + Step 3 of this game; the difference is that here the triangle must be extracted from words |
| which-ratio | Identify ratio from side labels | Reinforces step 2 under varied presentation |
| compute-it | Standard-angle values (sin/cos/tan of 30°/45°/60°) | Step 3 requires computing with these values without a calculator |

**Session-planner position:** Game 6 of 6 in the SOH-CAH-TOA session. This is the terminal game — transfer to novel context. No game in the session follows this one.

---

## 10. Pedagogical Progression: find-triangle-side → real-world-trig

**find-triangle-side** (Bloom L3 Apply):
- Triangle is drawn; sides are labeled with geometric terms (opposite/adjacent/hypotenuse).
- Learner's job: identify which ratio to use, then compute.
- The triangle model is provided — learner does not construct it.
- Cognitive demand: select the right procedure and execute it.

**real-world-trig** (Bloom L4 Analyze):
- Triangle is embedded in a word problem. Sides carry real-world nouns (ladder, shadow, pole), not geometric labels.
- Step 1 forces the learner to decide which physical object plays which geometric role (opposite/adjacent/hypotenuse) relative to the named angle.
- Step 2 then selects the ratio — same as find-triangle-side step 1.
- Step 3 computes — same as find-triangle-side step 2.
- **The new cognitive demand is step 1** — constructing the triangle model from a word description. This is the L3→L4 boundary.

**Why three steps are required for L4:**
A two-step version (skip step 1, go straight to ratio selection) would reduce this game to find-triangle-side with a word problem wrapper. The cognitive demand of L4 Analyze requires the learner to explicitly decode the problem structure. Collapsing the "which side is known?" and "which ratio?" decisions into one MCQ lets a learner bypass the analysis by guessing the ratio name without ever constructing the triangle model.

**Target misconceptions addressed:**

| Misconception | Round | Step where caught |
|--------------|-------|------------------|
| Ladder is a vertical side, not the hypotenuse | 1 | Step 1 feedback |
| "Horizontal distance" is the hypotenuse, not adjacent | 2 | Step 1 feedback |
| Using sin or cos when the hypotenuse is not given | 3 | Step 2 feedback |
| Multiply instead of divide when hypotenuse is the unknown | 4 | Step 3 feedback |

---

## 11. CDN Compliance Notes

- **No new CDN parts required.** All interaction is achievable with PART-013 (fixed MCQ validation), PART-014 (function validation for typed numeric), PART-022 (option buttons), PART-023 (progress bar), PART-024 (transition screens), and inline JS/CSS.
- **No drag-and-drop.** Step 1 uses three MCQ buttons, not draggable labels onto the SVG. Drag-and-drop on SVG hit areas is not supported by any current CDN part (see interaction-patterns.md). MCQ button rows achieve the same cognitive demand without the CDN dependency.
- **SVG rendered inline.** The triangle diagram is an inline `<svg>` block with text elements updated dynamically by `renderRound()`. Same pattern used in `find-triangle-side` (approved build #549).
- **Calculator button is NOT included.** Rounds 1–4 use standard angles (30°, 45°, 60°) whose trig values are taught in Game 5 (`compute-it`). Include a collapsible reference panel showing: "sin(30°)=0.5, cos(30°)=0.866, sin(60°)=0.866, cos(60°)=0.5, tan(45°)=1." (`compute-it` is not yet approved; panel is required until it is.)
- **No `FeedbackManager.init()`.** As in all approved trig session games (find-triangle-side #549, soh-cah-toa-worked-example #544, name-the-sides #557).
- **Tolerance is ±0.15** throughout. Matches find-triangle-side tolerance. Accommodates learners who use rounded trig values (e.g., sin(60°) = 0.87 instead of 0.866) and get answers like 8.7 instead of 8.66.
- **Three-step panel layout uses inline CSS toggle** (adding/removing `hidden` class). No CDN panel-switching part is needed.
