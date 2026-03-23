# Quadratic Formula: Worked Example — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements the Worked Example → Faded Example → Independent Practice progression (Sweller & Cooper, 1985). Each of 3 rounds covers one quadratic equation type. Within each round there are 3 sub-phases: (1) **Example phase** — full 4-step worked solution shown step by step, learner clicks "Got It"; (2) **Faded phase** — same problem structure with Step 3 (Apply Formula) blanked out, learner picks from MCQ; (3) **Practice phase** — a new similar problem with no scaffolding, learner picks the root(s) from MCQ. No lives lost during Example or Faded phases — errors in Faded phase show the correct step and allow retry. Lives are deducted only in the Practice phase. This implements the cognitive load theory gradient: full scaffolding → partial scaffolding → independent. The faded step is always Step 3 (applying x = (−b ± √discriminant) / 2a) — the step where learners most commonly make sign errors or forget the ±. Interaction type: `worked-example-mcq`.

---

## 1. Game Identity

- **Title:** Quadratic Formula: Worked Example
- **Game ID:** game_quadratic_formula_worked_example
- **Type:** standard
- **Description:** Students learn to solve quadratic equations using the quadratic formula through a scaffolded sequence: first a fully worked 4-step example, then a faded problem (Step 3 — apply formula — blanked out), then an independent MCQ practice problem. 3 rounds covering (1) simple a=1 with two distinct positive roots, (2) a≠1 with one positive and one negative root, (3) perfect square discriminant with a repeated root. Lives matter only in the independent practice phase. Stars based on accuracy in the practice phase. Targets Grade 10 / NCERT Ch.4 / CC HSA-REI.B.4b.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                      |
| -------- | ----------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                                 |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                                 |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                                 |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                                 |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                               |
| PART-006 | TimerComponent                | NO              | No timer — this is a learning-first game, not speed-drill. Time pressure would contradict the worked-example pedagogical goal.                                                    |
| PART-007 | Game State Object             | YES             | Custom fields: lives, subPhase, roundEquation, workedExampleStepIndex, fadedAnswered, practiceAnswered, wrongInPractice, isProcessing                                             |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                                 |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                                 |
| PART-010 | Event Tracking                | YES             | Custom events: example_advanced, faded_correct, faded_incorrect, practice_correct, practice_incorrect, life_lost, round_complete                                                  |
| PART-011 | End Game & Metrics            | YES             | Star logic: 3★ = 0 practice errors across all 3 rounds; 2★ = 1 practice error; 1★ = 2 practice errors; 0★ = 3+ errors or game over                                               |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                                 |
| PART-013 | Validation Fixed              | YES             | MCQ: string equality check (option value === correctAnswer)                                                                                                                       |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                                 |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                                 |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                                 |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Visual feedback only.                                                                                      |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                                 |
| PART-019 | Results Screen UI             | YES             | Custom metrics: rounds completed, practice errors, accuracy                                                                                                                       |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                                 |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                                 |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                                 |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 3, totalLives: 3 (lives apply to practice phase only)                                                                                                                |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over                                                                                                                                                |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                    |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                            |
| PART-027 | Play Area Construction        | YES             | Layout: three-panel sub-phase display (example panel / faded MCQ / practice MCQ) with phase indicator header                                                                      |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with equation, exampleSteps, fadedQuestion, practiceQuestion                                                                                                  |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                                                                 |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                                                                 |
| PART-031 | API Helper                    | NO              | —                                                                                                                                                                                 |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                                                                 |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                                                                 |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                          |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                     |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                            |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 3,
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
  lives: 3,                         // Lives remaining (deducted only in practice phase)
  totalLives: 3,
  subPhase: 'example',              // 'example' | 'faded' | 'practice' — sub-phase within each round
  roundEquation: '',                // e.g. 'x²−5x+6=0' — label for current round
  workedExampleStepIndex: 0,        // Which step of the worked example is currently shown (0-based)
  fadedAnswered: false,             // Whether the faded question has been answered correctly
  practiceAnswered: false,          // Whether the practice question has been answered correctly
  wrongInPractice: 0,               // Total wrong practice attempts across all rounds
  isProcessing: false               // Guard against double-submit
};

window.gameState = gameState;       // MANDATORY: test harness reads window.gameState

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
          "equationLabel": {
            "type": "string",
            "description": "Human-readable equation shown as round label, e.g. 'x²−5x+6=0'"
          },
          "equationCoefficients": {
            "type": "string",
            "description": "Coefficient identification string shown in step 1, e.g. 'a=1, b=−5, c=6'"
          },
          "misconceptionTargeted": {
            "type": "string",
            "description": "Brief description of the misconception this round targets (for display in feedback)"
          },
          "exampleProblem": {
            "type": "object",
            "description": "The fully worked example shown in the Example phase",
            "properties": {
              "question": {
                "type": "string",
                "description": "Problem statement, e.g. 'Solve x²−5x+6=0 using the quadratic formula.'"
              },
              "coefficientLine": {
                "type": "string",
                "description": "Coefficient identification line, e.g. 'Identify: a=1, b=−5, c=6'"
              },
              "steps": {
                "type": "array",
                "description": "Ordered list of 4 solution steps shown one at a time",
                "items": {
                  "type": "object",
                  "properties": {
                    "label": { "type": "string", "description": "Short label, e.g. 'Step 1: Identify a, b, c'" },
                    "text": { "type": "string", "description": "Full explanation text for this step" },
                    "formula": { "type": "string", "description": "Formula or expression to show highlighted below the text" }
                  },
                  "required": ["label", "text", "formula"]
                },
                "minItems": 4,
                "maxItems": 4
              },
              "answer": {
                "type": "string",
                "description": "The final answer, e.g. 'x = 2  or  x = 3'"
              }
            },
            "required": ["question", "coefficientLine", "steps", "answer"]
          },
          "fadedQuestion": {
            "type": "object",
            "description": "The faded problem — same structure as the example but with Step 3 (Apply Formula) replaced by an MCQ",
            "properties": {
              "question": {
                "type": "string",
                "description": "Problem statement — same equation type but different coefficients"
              },
              "coefficientLine": {
                "type": "string",
                "description": "Coefficient identification line for the faded problem"
              },
              "shownSteps": {
                "type": "array",
                "description": "Steps 1 and 2 shown to the learner (completed steps before the blank)",
                "items": {
                  "type": "object",
                  "properties": {
                    "label": { "type": "string" },
                    "text": { "type": "string" },
                    "formula": { "type": "string" }
                  },
                  "required": ["label", "text", "formula"]
                },
                "minItems": 2,
                "maxItems": 2
              },
              "blankStepPrompt": {
                "type": "string",
                "description": "The question asked at the blank step, e.g. 'Apply the formula — which expression gives the roots?'"
              },
              "correctAnswer": {
                "type": "string",
                "description": "The correct MCQ answer for the blank step (the formula application expression)"
              },
              "distractors": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 2,
                "maxItems": 2,
                "description": "Two wrong MCQ options — chosen to probe the specific sign/formula misconception"
              },
              "afterBlankSteps": {
                "type": "array",
                "description": "Step 4 (simplify) shown after the blank is filled correctly",
                "items": {
                  "type": "object",
                  "properties": {
                    "label": { "type": "string" },
                    "text": { "type": "string" },
                    "formula": { "type": "string" }
                  },
                  "required": ["label", "text", "formula"]
                },
                "minItems": 1,
                "maxItems": 1
              },
              "answer": {
                "type": "string",
                "description": "Final answer shown after the blank step is completed"
              }
            },
            "required": ["question", "coefficientLine", "shownSteps", "blankStepPrompt", "correctAnswer", "distractors", "answer"]
          },
          "practiceQuestion": {
            "type": "object",
            "description": "Independent practice — a new problem, no scaffolding, MCQ with 3 options for the root(s)",
            "properties": {
              "question": {
                "type": "string",
                "description": "Full problem statement, e.g. 'Solve x²−7x+10=0. What are the roots?'"
              },
              "coefficientLine": {
                "type": "string",
                "description": "Coefficient identification line shown as a reminder (read-only)"
              },
              "hint": {
                "type": "string",
                "description": "Hint shown after a wrong answer — references the worked example and faded example"
              },
              "correctAnswer": {
                "type": "string",
                "description": "The correct MCQ answer (the roots as a string, e.g. 'x = 2  or  x = 5')"
              },
              "distractors": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 2,
                "maxItems": 2,
                "description": "Two wrong MCQ options — chosen to probe the specific misconception"
              },
              "explanationOnWrong": {
                "type": "string",
                "description": "Elaborated feedback shown after a wrong answer — explains which misconception was triggered"
              },
              "explanationOnCorrect": {
                "type": "string",
                "description": "Brief confirmation shown after a correct answer — reinforces the correct reasoning"
              }
            },
            "required": ["question", "coefficientLine", "hint", "correctAnswer", "distractors", "explanationOnWrong", "explanationOnCorrect"]
          }
        },
        "required": ["equationLabel", "equationCoefficients", "misconceptionTargeted", "exampleProblem", "fadedQuestion", "practiceQuestion"]
      },
      "minItems": 3,
      "maxItems": 3,
      "description": "Exactly 3 rounds: Round 1 = simple a=1 positive roots, Round 2 = a≠1 mixed roots, Round 3 = double root"
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
    // ROUND 1: x²−5x+6=0 (a=1, b=−5, c=6)
    // Roots: x=2 or x=3  |  Discriminant: 25−24=1
    // Misconception targeted: forgetting to consider BOTH roots (the ± in the formula)
    // ============================================================
    {
      equationLabel: 'x²−5x+6=0',
      equationCoefficients: 'a=1, b=−5, c=6',
      misconceptionTargeted: 'Calculating only the + branch of ±√discriminant and missing the second root',

      exampleProblem: {
        question: 'Solve x²−5x+6=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=1, b=−5, c=6',
        steps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Read off the coefficients from ax²+bx+c=0. The coefficient of x² is a, the coefficient of x is b, and the constant term is c.',
            formula: 'a = 1,  b = −5,  c = 6'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'The discriminant tells us how many real roots exist. Δ = b²−4ac. Substitute the values.',
            formula: 'Δ = (−5)² − 4(1)(6) = 25 − 24 = 1'
          },
          {
            label: 'Step 3: Apply the quadratic formula',
            text: 'Since Δ = 1 > 0, there are two distinct real roots. Substitute into x = (−b ± √Δ) / 2a.',
            formula: 'x = (−(−5) ± √1) / (2×1) = (5 ± 1) / 2'
          },
          {
            label: 'Step 4: Simplify both roots',
            text: 'Evaluate both branches of the ± separately. Both are valid roots of the equation.',
            formula: 'x = (5+1)/2 = 3   or   x = (5−1)/2 = 2'
          }
        ],
        answer: 'x = 3  or  x = 2'
      },

      fadedQuestion: {
        question: 'Solve x²−6x+8=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=1, b=−6, c=8',
        shownSteps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Read off the coefficients from x²−6x+8=0.',
            formula: 'a = 1,  b = −6,  c = 8'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'Compute Δ = b²−4ac.',
            formula: 'Δ = (−6)² − 4(1)(8) = 36 − 32 = 4'
          }
        ],
        blankStepPrompt: 'Step 3: Apply the formula — which expression gives the roots of x²−6x+8=0?',
        correctAnswer: 'x = (6 ± √4) / 2',
        distractors: [
          'x = (−6 ± √4) / 2',
          'x = (6 ± √4) / 4'
        ],
        afterBlankSteps: [
          {
            label: 'Step 4: Simplify both roots',
            text: '√4 = 2. Evaluate both branches.',
            formula: 'x = (6+2)/2 = 4   or   x = (6−2)/2 = 2'
          }
        ],
        answer: 'x = 4  or  x = 2'
      },

      practiceQuestion: {
        question: 'Solve x²−7x+10=0. What are the roots?',
        coefficientLine: 'a=1, b=−7, c=10  →  Δ = 49−40 = 9',
        hint: 'Δ = b²−4ac = 49−40 = 9. Apply x = (−b ± √9) / 2a = (7 ± 3) / 2. Calculate both branches.',
        correctAnswer: 'x = 5  or  x = 2',
        distractors: [
          'x = 5  only',
          'x = 7  or  x = −10'
        ],
        explanationOnWrong: 'Δ = (−7)²−4(1)(10) = 49−40 = 9. So x = (7 ± 3)/2. The + branch gives x=(7+3)/2=5 and the − branch gives x=(7−3)/2=2. Both roots are valid — the ± means there are TWO roots, not one. If you chose "x=5 only", you forgot the second branch. If you chose "x=7 or x=−10", those are not related to the formula — always use x=(−b±√Δ)/2a.',
        explanationOnCorrect: 'Correct! Δ=9, so x=(7±3)/2 gives x=5 or x=2. Always evaluate BOTH branches of ± to find all roots.'
      }
    },

    // ============================================================
    // ROUND 2: 2x²+3x−2=0 (a=2, b=3, c=−2)
    // Roots: x=1/2 or x=−2  |  Discriminant: 9+16=25
    // Misconception targeted: sign error on −b when b is positive, or dividing by 2 instead of 2a
    // ============================================================
    {
      equationLabel: '2x²+3x−2=0',
      equationCoefficients: 'a=2, b=3, c=−2',
      misconceptionTargeted: 'Sign error: writing +b instead of −b in the numerator, or dividing by 2 (forgetting the a in 2a)',

      exampleProblem: {
        question: 'Solve 2x²+3x−2=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=2, b=3, c=−2',
        steps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Match coefficients to ax²+bx+c=0. Note that b=3 is positive and c=−2 is negative.',
            formula: 'a = 2,  b = 3,  c = −2'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'Compute Δ = b²−4ac. Take care with the sign of c.',
            formula: 'Δ = (3)² − 4(2)(−2) = 9 + 16 = 25'
          },
          {
            label: 'Step 3: Apply the quadratic formula',
            text: 'Since b=3, −b=−3. The denominator is 2a=2×2=4. Substitute carefully.',
            formula: 'x = (−3 ± √25) / (2×2) = (−3 ± 5) / 4'
          },
          {
            label: 'Step 4: Simplify both roots',
            text: 'Evaluate both branches. One root is positive, one is negative.',
            formula: 'x = (−3+5)/4 = 2/4 = 1/2   or   x = (−3−5)/4 = −8/4 = −2'
          }
        ],
        answer: 'x = 1/2  or  x = −2'
      },

      fadedQuestion: {
        question: 'Solve 3x²+5x−2=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=3, b=5, c=−2',
        shownSteps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Read off coefficients from 3x²+5x−2=0.',
            formula: 'a = 3,  b = 5,  c = −2'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'Compute Δ = b²−4ac. Note c=−2 is negative, so −4ac = −4(3)(−2) = +24.',
            formula: 'Δ = (5)² − 4(3)(−2) = 25 + 24 = 49'
          }
        ],
        blankStepPrompt: 'Step 3: Apply the formula — which expression gives the roots of 3x²+5x−2=0?',
        correctAnswer: 'x = (−5 ± √49) / 6',
        distractors: [
          'x = (5 ± √49) / 6',
          'x = (−5 ± √49) / 3'
        ],
        afterBlankSteps: [
          {
            label: 'Step 4: Simplify both roots',
            text: '√49 = 7. The denominator is 2a = 2×3 = 6. Evaluate both branches.',
            formula: 'x = (−5+7)/6 = 2/6 = 1/3   or   x = (−5−7)/6 = −12/6 = −2'
          }
        ],
        answer: 'x = 1/3  or  x = −2'
      },

      practiceQuestion: {
        question: 'Solve 2x²+x−6=0. What are the roots?',
        coefficientLine: 'a=2, b=1, c=−6  →  Δ = 1+48 = 49',
        hint: 'Δ = 1²−4(2)(−6) = 1+48 = 49. Apply x = (−1 ± 7) / 4. Remember: denominator is 2a = 4, not 2.',
        correctAnswer: 'x = 3/2  or  x = −2',
        distractors: [
          'x = 3/2  or  x = 2',
          'x = −3/2  or  x = −2'
        ],
        explanationOnWrong: 'Δ = 1²−4(2)(−6) = 49, so √Δ=7. The formula gives x=(−1±7)/(2×2)=(−1±7)/4. The + branch: (−1+7)/4=6/4=3/2. The − branch: (−1−7)/4=−8/4=−2. If you chose "x=3/2 or x=2", you may have divided by 2 instead of 2a=4. If you chose "−3/2 or −2", you used +b=+1 instead of −b=−1 in the numerator.',
        explanationOnCorrect: 'Correct! Δ=49, x=(−1±7)/4 gives x=3/2 or x=−2. Always use −b (negate b) and divide by 2a (twice the a coefficient).'
      }
    },

    // ============================================================
    // ROUND 3: x²−4x+4=0 (a=1, b=−4, c=4)
    // Roots: x=2 (double root)  |  Discriminant: 16−16=0
    // Misconception targeted: expecting two different roots when Δ=0; not recognising the double root
    // ============================================================
    {
      equationLabel: 'x²−4x+4=0',
      equationCoefficients: 'a=1, b=−4, c=4',
      misconceptionTargeted: 'When Δ=0, both ± branches give the same root — learners often expect two different answers',

      exampleProblem: {
        question: 'Solve x²−4x+4=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=1, b=−4, c=4',
        steps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Match coefficients. Both b and c are positive here — take care with signs.',
            formula: 'a = 1,  b = −4,  c = 4'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'Compute Δ = b²−4ac. When Δ=0 the formula gives exactly one (repeated) root.',
            formula: 'Δ = (−4)² − 4(1)(4) = 16 − 16 = 0'
          },
          {
            label: 'Step 3: Apply the quadratic formula',
            text: 'Since Δ=0, √Δ=0. The ± term disappears — there is only one value.',
            formula: 'x = (−(−4) ± √0) / (2×1) = (4 ± 0) / 2'
          },
          {
            label: 'Step 4: Simplify — both branches are equal',
            text: 'Both the + and − branches give the same result. This is called a double root or repeated root.',
            formula: 'x = (4+0)/2 = 2   and   x = (4−0)/2 = 2   →   x = 2 (double root)'
          }
        ],
        answer: 'x = 2 (double root)'
      },

      fadedQuestion: {
        question: 'Solve x²−6x+9=0 using the quadratic formula.',
        coefficientLine: 'Identify: a=1, b=−6, c=9',
        shownSteps: [
          {
            label: 'Step 1: Identify a, b, c',
            text: 'Read off coefficients from x²−6x+9=0.',
            formula: 'a = 1,  b = −6,  c = 9'
          },
          {
            label: 'Step 2: Calculate the discriminant',
            text: 'Compute Δ = b²−4ac. Is this another perfect square?',
            formula: 'Δ = (−6)² − 4(1)(9) = 36 − 36 = 0'
          }
        ],
        blankStepPrompt: 'Step 3: Apply the formula — which expression gives the root of x²−6x+9=0?',
        correctAnswer: 'x = (6 ± √0) / 2',
        distractors: [
          'x = (6 ± √0) / 4',
          'x = (−6 ± √0) / 2'
        ],
        afterBlankSteps: [
          {
            label: 'Step 4: Simplify — double root',
            text: '√0=0 so ± disappears. Both branches equal the same value.',
            formula: 'x = (6+0)/2 = 3   and   x = (6−0)/2 = 3   →   x = 3 (double root)'
          }
        ],
        answer: 'x = 3 (double root)'
      },

      practiceQuestion: {
        question: 'Solve x²−8x+16=0. What is the root?',
        coefficientLine: 'a=1, b=−8, c=16  →  Δ = 64−64 = 0',
        hint: 'Δ = 64−64 = 0. When Δ=0, √0=0 and x = (−b ± 0) / 2a = −b/2a. Compute −(−8)/(2×1).',
        correctAnswer: 'x = 4 (double root)',
        distractors: [
          'x = 4  or  x = −4',
          'x = 2  or  x = 8'
        ],
        explanationOnWrong: 'Δ = (−8)²−4(1)(16) = 64−64 = 0. Since Δ=0, x = (8±0)/2 = 4. There is only ONE distinct root: x=4. It is a double root — the parabola touches the x-axis at exactly one point. If you chose "x=4 or x=−4", you may have confused √Δ with √16; the discriminant Δ=0, not 16. If you chose "x=2 or x=8", those multiply to 16 and add to 10, not 8 — always use the formula rather than guessing factors.',
        explanationOnCorrect: 'Correct! Δ=0 means exactly one root: x=(8±0)/2=4. This is the double root — the parabola y=x²−8x+16 just touches the x-axis at x=4.'
      }
    }
  ]
};
```

**Content verification table:**

| Round | Equation      | Example Answer        | Faded Answer          | Practice Answer       |
|-------|---------------|-----------------------|-----------------------|-----------------------|
| 1     | x²−5x+6=0    | x=3 or x=2           | x=4 or x=2           | x=5 or x=2           |
| 2     | 2x²+3x−2=0  | x=1/2 or x=−2        | x=1/3 or x=−2        | x=3/2 or x=−2        |
| 3     | x²−4x+4=0   | x=2 (double root)    | x=3 (double root)    | x=4 (double root)    |

All arithmetic verified:
- Round 1 example: Δ=(−5)²−4(1)(6)=25−24=1; x=(5±1)/2 → x=3 or x=2 ✓
- Round 1 faded: Δ=(−6)²−4(1)(8)=36−32=4; x=(6±2)/2 → x=4 or x=2 ✓
- Round 1 practice: Δ=(−7)²−4(1)(10)=49−40=9; x=(7±3)/2 → x=5 or x=2 ✓
- Round 2 example: Δ=(3)²−4(2)(−2)=9+16=25; x=(−3±5)/4 → x=2/4=1/2 or x=−8/4=−2 ✓
- Round 2 faded: Δ=(5)²−4(3)(−2)=25+24=49; x=(−5±7)/6 → x=2/6=1/3 or x=−12/6=−2 ✓
- Round 2 practice: Δ=(1)²−4(2)(−6)=1+48=49; x=(−1±7)/4 → x=6/4=3/2 or x=−8/4=−2 ✓
- Round 3 example: Δ=(−4)²−4(1)(4)=16−16=0; x=(4±0)/2=2 ✓
- Round 3 faded: Δ=(−6)²−4(1)(9)=36−36=0; x=(6±0)/2=3 ✓
- Round 3 practice: Δ=(−8)²−4(1)(16)=64−64=0; x=(8±0)/2=4 ✓

---

## 5. Screens & HTML Structure

### Body HTML

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">

    <!-- Phase indicator header — shows which sub-phase is active -->
    <div class="phase-header" id="phase-header">
      <div class="phase-badge" id="phase-badge">Step 1 of 3: Worked Example</div>
      <div class="equation-label" id="equation-label">Round 1: x²−5x+6=0</div>
    </div>

    <!-- =========================================================
         SUB-PHASE 1: WORKED EXAMPLE PANEL
         Shown when gameState.subPhase === 'example'
         ========================================================= -->
    <div id="example-panel" class="sub-phase-panel">
      <div class="panel-title">Study this example — no answer required</div>

      <div class="problem-statement" id="example-problem-text"></div>
      <div class="coefficient-info" id="example-coefficient-info"></div>

      <!-- Step-by-step reveal: only one step visible at a time -->
      <div class="steps-container" id="example-steps-container">
        <!-- Steps injected here by renderExampleStep() -->
        <!-- Each step: <div class="step-card active|pending" id="step-N"> -->
        <!--               <div class="step-label">Step N: ...</div> -->
        <!--               <div class="step-text">...</div> -->
        <!--               <div class="step-formula">...</div> -->
        <!--             </div> -->
      </div>

      <div class="example-answer hidden" id="example-answer">
        <strong>Answer:</strong> <span id="example-answer-value"></span>
      </div>

      <!-- Navigation: "Next Step" until all steps revealed, then "Got It → Next" -->
      <div class="example-nav">
        <button class="game-btn btn-primary" id="btn-example-next" onclick="advanceExampleStep()">Next Step →</button>
        <button class="game-btn btn-primary hidden" id="btn-example-done" onclick="completeExample()">Got It — Try It Yourself!</button>
      </div>
    </div>

    <!-- =========================================================
         SUB-PHASE 2: FADED EXAMPLE (partial scaffold MCQ)
         Shown when gameState.subPhase === 'faded'
         ========================================================= -->
    <div id="faded-panel" class="sub-phase-panel hidden">
      <div class="panel-title">Now try the same structure with new numbers</div>
      <div class="faded-hint">Steps 1 and 2 are done for you. Fill in the missing Step 3.</div>

      <div class="problem-statement" id="faded-problem-text"></div>
      <div class="coefficient-info" id="faded-coefficient-info"></div>

      <!-- Completed steps shown (read-only) -->
      <div class="steps-container" id="faded-shown-steps"></div>

      <!-- Blank step MCQ -->
      <div class="faded-blank" id="faded-blank">
        <div class="blank-prompt" id="faded-blank-prompt"></div>
        <div class="mcq-options" id="faded-options" role="group" aria-label="Faded MCQ options">
          <!-- Buttons injected: <button class="game-btn btn-option" id="faded-opt-0" onclick="handleFadedAnswer('...')">...</button> -->
        </div>
        <div class="feedback-area hidden" id="faded-feedback"></div>
      </div>

      <!-- After-blank steps (shown after correct answer) -->
      <div class="steps-container hidden" id="faded-after-steps"></div>

      <!-- Faded answer shown after completion -->
      <div class="faded-answer hidden" id="faded-answer">
        <strong>Answer:</strong> <span id="faded-answer-value"></span>
      </div>

      <button class="game-btn btn-primary hidden" id="btn-faded-done" onclick="completeFaded()">Next: Practice Problem</button>
    </div>

    <!-- =========================================================
         SUB-PHASE 3: INDEPENDENT PRACTICE (MCQ, no scaffolding)
         Shown when gameState.subPhase === 'practice'
         ========================================================= -->
    <div id="practice-panel" class="sub-phase-panel hidden">
      <div class="panel-title">Now try it on your own</div>
      <div class="practice-note">This question is similar to the example. No hints — lives count here!</div>

      <div class="problem-statement" id="practice-problem-text"></div>
      <div class="coefficient-info" id="practice-coefficient-info"></div>

      <div class="mcq-options" id="practice-options" role="group" aria-label="Practice MCQ options">
        <!-- Buttons injected: <button class="game-btn btn-option" id="practice-opt-0" onclick="handlePracticeAnswer('...')">...</button> -->
      </div>

      <div class="feedback-area hidden" id="practice-feedback"></div>

      <button class="game-btn btn-primary hidden" id="btn-practice-next" onclick="nextRound()">
        <!-- Text updated by renderPracticePanel() -->
        Next Round
      </button>
    </div>

  </div>
</template>
```

### Results Screen

```html
<!-- PART-019 standard results screen with custom metric rows -->
<div id="results-screen" class="hidden">
  <div class="results-container">
    <div class="results-title" id="results-title">Game Complete!</div>
    <div class="stars-display" id="stars-display"></div>
    <div class="results-metrics">
      <div class="metric-row">
        <span class="metric-label">Rounds Completed</span>
        <span class="metric-value" id="metric-rounds">0 / 3</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Practice Accuracy</span>
        <span class="metric-value" id="metric-accuracy">0%</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Wrong in Practice</span>
        <span class="metric-value" id="metric-wrong">0</span>
      </div>
    </div>
    <button class="game-btn btn-primary" id="btn-play-again" onclick="restartGame()">Play Again</button>
  </div>
</div>
```

---

## 6. CSS

```css
/* ================================================================
   Base layout — from PART-020, PART-021
   ================================================================ */
:root {
  --mathai-primary: #4f46e5;
  --mathai-primary-light: #818cf8;
  --mathai-success: #22c55e;
  --mathai-error: #ef4444;
  --mathai-warning: #f59e0b;
  --mathai-surface: #f8fafc;
  --mathai-surface-alt: #e2e8f0;
  --mathai-text: #1e293b;
  --mathai-text-muted: #64748b;
  --mathai-border: #cbd5e1;
  --mathai-example-bg: #eff6ff;     /* Blue-tinted — signals learning mode */
  --mathai-faded-bg: #f0fdf4;       /* Green-tinted — signals partial completion */
  --mathai-practice-bg: #fefce8;    /* Yellow-tinted — signals test mode */
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--mathai-surface);
  color: var(--mathai-text);
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.page-center {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* ================================================================
   Phase header — shows current sub-phase context
   ================================================================ */
.phase-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--mathai-border);
  background: white;
}

.phase-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--mathai-primary);
  padding: 2px 10px;
  border-radius: 999px;
  background: #eef2ff;
  border: 1px solid var(--mathai-primary-light);
}

.equation-label {
  font-size: 14px;
  color: var(--mathai-text-muted);
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

/* ================================================================
   Sub-phase panels — each phase has a distinct background tint
   ================================================================ */
.sub-phase-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 16px 24px;
  overflow-y: auto;
}

.sub-phase-panel.hidden { display: none !important; }

#example-panel { background: var(--mathai-example-bg); }
#faded-panel   { background: var(--mathai-faded-bg); }
#practice-panel { background: var(--mathai-practice-bg); }

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--mathai-text);
  text-align: center;
}

.faded-hint, .practice-note {
  font-size: 13px;
  color: var(--mathai-text-muted);
  text-align: center;
  font-style: italic;
}

/* ================================================================
   Problem statement and coefficient info
   ================================================================ */
.problem-statement {
  font-size: 15px;
  line-height: 1.5;
  background: white;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid var(--mathai-border);
  font-weight: 500;
}

.coefficient-info {
  font-size: 13px;
  color: var(--mathai-text-muted);
  background: white;
  border-radius: 8px;
  padding: 10px 14px;
  border: 1px solid var(--mathai-border);
  font-family: 'Courier New', monospace;
  line-height: 1.6;
}

/* ================================================================
   Step cards — worked example steps
   ================================================================ */
.steps-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-card {
  background: white;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1.5px solid var(--mathai-border);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.step-card.active {
  border-color: var(--mathai-primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
}

.step-card.completed {
  border-color: var(--mathai-success);
  opacity: 0.85;
}

.step-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--mathai-primary);
  margin-bottom: 6px;
}

.step-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--mathai-text);
}

.step-formula {
  margin-top: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--mathai-primary);
  background: #eef2ff;
  border-radius: 6px;
  padding: 8px 12px;
  font-weight: 600;
}

/* ================================================================
   Worked example answer and navigation
   ================================================================ */
.example-answer, .faded-answer {
  background: white;
  border: 2px solid var(--mathai-success);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--mathai-success);
  font-weight: 600;
  text-align: center;
  font-family: 'Courier New', monospace;
}

.example-nav {
  display: flex;
  justify-content: center;
}

/* ================================================================
   Faded blank area
   ================================================================ */
.faded-blank {
  background: white;
  border: 2px dashed var(--mathai-warning);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blank-prompt {
  font-size: 14px;
  font-weight: 600;
  color: var(--mathai-text);
  text-align: center;
}

/* ================================================================
   MCQ option buttons
   ================================================================ */
.mcq-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-option {
  width: 100%;
  padding: 14px 16px;
  border-radius: 10px;
  border: 2px solid var(--mathai-border);
  background: white;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: var(--mathai-text);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}

.btn-option:hover:not(:disabled) {
  border-color: var(--mathai-primary);
  background: #eef2ff;
  transform: translateY(-1px);
}

.btn-option.selected-correct {
  border-color: var(--mathai-success);
  background: #f0fdf4;
  color: var(--mathai-success);
  cursor: default;
}

.btn-option.selected-wrong {
  border-color: var(--mathai-error);
  background: #fef2f2;
  color: var(--mathai-error);
  cursor: default;
}

.btn-option:disabled { opacity: 0.6; cursor: default; }

/* ================================================================
   Feedback area
   ================================================================ */
.feedback-area {
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
}

.feedback-area.correct {
  background: #f0fdf4;
  border: 1.5px solid var(--mathai-success);
  color: #166534;
}

.feedback-area.wrong {
  background: #fef2f2;
  border: 1.5px solid var(--mathai-error);
  color: #991b1b;
}

.feedback-area.hidden { display: none !important; }

/* ================================================================
   Standard game buttons (from PART-022)
   ================================================================ */
.game-btn {
  border: none;
  border-radius: 10px;
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  width: 100%;
}

.game-btn:active { transform: scale(0.98); }

.btn-primary {
  background: var(--mathai-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.btn-primary:hover { background: #4338ca; }
.btn-primary.hidden { display: none !important; }
.btn-secondary { background: var(--mathai-surface-alt); color: var(--mathai-text); }

/* ================================================================
   Progress bar area (PART-023)
   ================================================================ */
#progress-bar-container {
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid var(--mathai-border);
}

/* ================================================================
   Results screen (PART-019)
   ================================================================ */
#results-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--mathai-surface);
}

.results-container {
  width: 100%;
  max-width: 380px;
  background: white;
  border-radius: 20px;
  padding: 32px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  text-align: center;
}

.results-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--mathai-text);
}

.stars-display {
  font-size: 36px;
  letter-spacing: 6px;
}

.results-metrics {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--mathai-surface);
  border-radius: 8px;
  font-size: 14px;
}

.metric-label { color: var(--mathai-text-muted); font-weight: 500; }
.metric-value { font-weight: 700; color: var(--mathai-text); }

.hidden { display: none !important; }
```

---

## 7. Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (from PART-030) -->
<script>
function initSentry() {
  if (typeof SentryConfig === 'undefined') return;
  try {
    SentryConfig.init({
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      environment: 'production',
      release: 'quadratic-formula-worked-example@1.0.0'
    });
  } catch (e) { console.warn('Sentry init failed', e); }
}
</script>

<!-- STEP 3: Sentry SDK v10.23.0 (3 scripts, NO integrity attribute) -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- STEP 4: Initialize on load -->
<script>window.addEventListener('load', initSentry);</script>

<!-- STEP 5–7: Game packages (exact URLs, in this order) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## 8. Game Flow

1. **Page loads** → DOMContentLoaded fires
   - `waitForPackages()` polls until FeedbackManager, Components, Helpers are available
   - `VisibilityTracker` created
   - `ScreenLayout.inject()` called (injects progress bar + transition screen containers)
   - `ProgressBar` created (totalRounds: 3, totalLives: 3)
   - `TransitionScreen` created (screens: start, victory, game-over)
   - `TransitionScreen.show('start')` — shows the start screen

2. **Start screen** → learner taps "Start" button
   - `setupGame()` called
   - `gameState.content` loaded from postMessage data or `fallbackContent`
   - `gameState.startTime = Date.now()`, `gameState.isActive = true`
   - `trackEvent('game_start', 'game')`
   - `TransitionScreen.hide()` → `#game-screen` shown
   - `renderRound(0)` called — renders Round 1, Example phase

3. **Example phase** (`subPhase === 'example'`):
   - `renderRound(roundIndex)` sets `gameState.subPhase = 'example'`, shows `#example-panel`, hides others
   - Updates `#phase-badge`, `#equation-label`, `#example-problem-text`, `#example-coefficient-info`
   - Calls `renderExamplePanel(round)` — renders first step card `.active`; all later step cards pending
   - `#btn-example-next` visible; `#btn-example-done` hidden
   - **User taps "Next Step →"** → `advanceExampleStep()`:
     - Marks current step card as `.completed`
     - `gameState.workedExampleStepIndex++`
     - If more steps remain: renders next step card as `.active`
     - If all 4 steps shown: reveals `#example-answer`, hides `#btn-example-next`, shows `#btn-example-done`
   - **User taps "Got It — Try It Yourself!"** → `completeExample()`:
     - `trackEvent('example_advanced', 'example', { round: gameState.currentRound })`
     - `gameState.subPhase = 'faded'`
     - `renderFadedPanel(round)` called

4. **Faded phase** (`subPhase === 'faded'`):
   - `renderFadedPanel()` shows `#faded-panel`, hides `#example-panel` and `#practice-panel`
   - Updates `#phase-badge` to "Step 2 of 3: Fill the Gap"
   - Renders `#faded-problem-text`, `#faded-coefficient-info`, `#faded-shown-steps` (Steps 1 and 2 read-only)
   - Renders `#faded-blank` with `#faded-blank-prompt` and 3 MCQ buttons (shuffled)
   - **User taps an option** → `handleFadedAnswer(selectedValue)`:
     - If `gameState.isProcessing` → return (guard against double-tap)
     - `gameState.isProcessing = true`
     - Compare `selectedValue` to `fadedQuestion.correctAnswer`
     - **Correct**: marks button `.selected-correct`, shows `#faded-feedback` with success message, disables all buttons, reveals `#faded-after-steps` and `#faded-answer`, shows `#btn-faded-done`, `trackEvent('faded_correct', 'faded', ...)`
     - **Wrong**: marks button `.selected-wrong`, shows `#faded-feedback` with hint text (shows correct formula — no life lost), re-enables remaining buttons after 2000ms delay, `trackEvent('faded_incorrect', 'faded', ...)`
     - `gameState.isProcessing = false`
   - **User taps "Next: Practice Problem"** → `completeFaded()`:
     - `gameState.subPhase = 'practice'`
     - `renderPracticePanel(round)` called

5. **Practice phase** (`subPhase === 'practice'`):
   - `renderPracticePanel()` shows `#practice-panel`, hides others
   - Updates `#phase-badge` to "Step 3 of 3: Your Turn!"
   - Renders `#practice-problem-text`, `#practice-coefficient-info`
   - Renders 3 MCQ buttons (shuffled: correctAnswer + 2 distractors)
   - **User taps an option** → `handlePracticeAnswer(selectedValue)`:
     - If `gameState.isProcessing` → return
     - `gameState.isProcessing = true`
     - `recordAttempt({...})`
     - Compare `selectedValue` to `practiceQuestion.correctAnswer`
     - **Correct**:
       - Marks button `.selected-correct`
       - Shows `#practice-feedback` with `.correct` class and `explanationOnCorrect` text
       - Disables all buttons
       - `gameState.score++`
       - `progressBar.update(gameState.currentRound + 1, gameState.lives)`
       - `trackEvent('practice_correct', 'practice', ...)`
       - Shows `#btn-practice-next` (text: "Next Round" or "See Results" on last round)
     - **Wrong**:
       - Marks button `.selected-wrong`
       - `gameState.lives--`, `gameState.wrongInPractice++`
       - Shows `#practice-feedback` with `.wrong` class and `explanationOnWrong` text
       - If `gameState.lives <= 0` → after 2000ms delay, calls `endGame('game-over')`
       - Else: re-enables remaining buttons after 2000ms delay
       - `progressBar.update(gameState.currentRound + 1, gameState.lives)`
       - `trackEvent('practice_incorrect', 'practice', ...), trackEvent('life_lost', 'practice', ...)`
     - `gameState.isProcessing = false`
   - **User taps "Next Round"** → `nextRound()`:
     - `gameState.currentRound++`
     - If `gameState.currentRound >= gameState.totalRounds` → `endGame('victory')`
     - Else → `renderRound(gameState.currentRound)` (back to Example phase)

6. **End conditions — ALL paths that call endGame():**
   - **Victory:** All 3 practice questions answered correctly (or with errors but lives > 0) → `nextRound()` detects `currentRound >= totalRounds` → `endGame('victory')`
   - **Game Over:** `lives` drops to 0 during practice phase → `endGame('game-over')`
   - Both paths call `endGame()` which calculates metrics, sends postMessage, shows results

7. **Results screen:**
   - Stars: 3★ = 0 wrongInPractice, 2★ = 1 wrongInPractice, 1★ = 2 wrongInPractice, 0★ = game-over
   - Accuracy = (3 - wrongInPractice) / 3 × 100 (clamped to [0, 100])
   - `postMessage` sent with standard game_complete payload

---

## 9. Functions

### Global Scope (RULE-001 — all onclick handlers must be in global scope)

**setupGame()**
- Read `gameState.content` from postMessage data or `fallbackContent`
- Set `gameState.startTime = Date.now()`
- Set `gameState.isActive = true`
- Set `gameState.currentRound = 0`, `gameState.lives = 3`, `gameState.score = 0`, `gameState.wrongInPractice = 0`
- `trackEvent('game_start', 'game')`
- `renderRound(0)`

**renderRound(roundIndex)**
- Get round data: `const round = gameState.content.rounds[roundIndex]`
- Set `gameState.subPhase = 'example'`
- Set `gameState.roundEquation = round.equationLabel`
- Set `gameState.workedExampleStepIndex = 0`
- Set `gameState.fadedAnswered = false`
- Set `gameState.practiceAnswered = false`
- Set `gameState.isProcessing = false`
- Update `#equation-label`: `Round ${roundIndex + 1}: ${round.equationLabel}`
- Call `renderExamplePanel(round)`
- Show `#example-panel`, hide `#faded-panel`, hide `#practice-panel`

**renderExamplePanel(round)**
- Update `#phase-badge`: `Step 1 of 3: Worked Example`
- Set `#example-problem-text` innerHTML to `round.exampleProblem.question`
- Set `#example-coefficient-info` innerHTML to `round.exampleProblem.coefficientLine`
- Clear `#example-steps-container`
- Render ONLY the first step card (index 0) as `.active`; store remaining 3 steps for progressive reveal
- Hide `#example-answer`
- Show `#btn-example-next`, hide `#btn-example-done`

**advanceExampleStep()**
- Get current round: `const round = gameState.content.rounds[gameState.currentRound]`
- Mark current step card (index `gameState.workedExampleStepIndex`) as `.completed`
- `gameState.workedExampleStepIndex++`
- If `gameState.workedExampleStepIndex < round.exampleProblem.steps.length`:
  - Append next step card as `.active` to `#example-steps-container`
- Else (all 4 steps shown):
  - Set `#example-answer-value` to `round.exampleProblem.answer`
  - Remove `.hidden` from `#example-answer`
  - Hide `#btn-example-next`
  - Show `#btn-example-done`

**completeExample()**
- `trackEvent('example_advanced', 'example', { round: gameState.currentRound, equation: gameState.roundEquation })`
- `gameState.subPhase = 'faded'`
- `renderFadedPanel(gameState.content.rounds[gameState.currentRound])`
- Hide `#example-panel`, show `#faded-panel`

**renderFadedPanel(round)**
- Update `#phase-badge`: `Step 2 of 3: Fill the Gap`
- Set `#faded-problem-text` innerHTML to `round.fadedQuestion.question`
- Set `#faded-coefficient-info` innerHTML to `round.fadedQuestion.coefficientLine`
- Render shown steps into `#faded-shown-steps` (Steps 1 and 2 as read-only `.completed` step cards)
- Set `#faded-blank-prompt` innerHTML to `round.fadedQuestion.blankStepPrompt`
- Build MCQ options: shuffle `[correctAnswer, ...distractors]`, inject 3 buttons into `#faded-options`
  - Each button: `id="faded-opt-{i}"`, `onclick="handleFadedAnswer('${optionValue}')"`
  - Button text is the option value (formula string)
- Hide `#faded-feedback`, `#faded-after-steps`, `#faded-answer`, `#btn-faded-done`

**handleFadedAnswer(selectedValue)**
- If `gameState.isProcessing` → return
- `gameState.isProcessing = true`
- Disable all buttons in `#faded-options`
- `const round = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = selectedValue === round.fadedQuestion.correctAnswer`
- Mark selected button: add `.selected-correct` or `.selected-wrong`
- If correct:
  - Show `#faded-feedback` with `.correct` class: `"Correct! ${round.fadedQuestion.correctAnswer}"`
  - Reveal `#faded-after-steps` (render `afterBlankSteps` as completed step cards)
  - Reveal `#faded-answer` with `round.fadedQuestion.answer`
  - Show `#btn-faded-done`
  - `trackEvent('faded_correct', 'faded', { round: gameState.currentRound, attempt: selectedValue })`
  - `gameState.isProcessing = false`
- If wrong:
  - Show `#faded-feedback` with `.wrong` class: `"Not quite — the correct formula application is: ${round.fadedQuestion.correctAnswer}. Remember: use −b in the numerator and 2a in the denominator."`
  - `trackEvent('faded_incorrect', 'faded', { round: gameState.currentRound, attempt: selectedValue })`
  - After 2000ms: re-enable remaining (non-selected-wrong) buttons; `gameState.isProcessing = false`
  - (No life lost — faded phase is scaffolded learning, not assessed)

**completeFaded()**
- `gameState.subPhase = 'practice'`
- `renderPracticePanel(gameState.content.rounds[gameState.currentRound])`
- Hide `#faded-panel`, show `#practice-panel`

**renderPracticePanel(round)**
- Update `#phase-badge`: `Step 3 of 3: Your Turn!`
- Set `#practice-problem-text` innerHTML to `round.practiceQuestion.question`
- Set `#practice-coefficient-info` innerHTML to `round.practiceQuestion.coefficientLine`
- Build MCQ options: shuffle `[correctAnswer, ...distractors]`, inject 3 buttons into `#practice-options`
  - Each button: `id="practice-opt-{i}"`, `onclick="handlePracticeAnswer('${optionValue}')"`
- Hide `#practice-feedback`, hide `#btn-practice-next`
- Update `#btn-practice-next` text:
  - If `gameState.currentRound < gameState.totalRounds - 1`: "Next Round"
  - If last round: "See Results"

**handlePracticeAnswer(selectedValue)**
- If `gameState.isProcessing` → return
- `gameState.isProcessing = true`
- Disable all buttons in `#practice-options`
- `const round = gameState.content.rounds[gameState.currentRound]`
- `const isCorrect = selectedValue === round.practiceQuestion.correctAnswer`
- Mark selected button: `.selected-correct` or `.selected-wrong`
- `recordAttempt({ question: round.practiceQuestion.question, answer: selectedValue, correct: isCorrect, round: gameState.currentRound })`
- If correct:
  - Show `#practice-feedback` with `.correct` class and `round.practiceQuestion.explanationOnCorrect`
  - `gameState.score++`
  - `progressBar.update(gameState.currentRound + 1, gameState.lives)`
  - `trackEvent('practice_correct', 'practice', { round: gameState.currentRound })`
  - Show `#btn-practice-next`
  - `gameState.isProcessing = false`
- If wrong:
  - `gameState.lives--`
  - `gameState.wrongInPractice++`
  - Show `#practice-feedback` with `.wrong` class and `round.practiceQuestion.explanationOnWrong`
  - `progressBar.update(gameState.currentRound + 1, gameState.lives)`
  - `trackEvent('practice_incorrect', 'practice', { round: gameState.currentRound, attempt: selectedValue })`
  - `trackEvent('life_lost', 'practice', { lives_remaining: gameState.lives })`
  - If `gameState.lives <= 0`:
    - After 2000ms → `endGame('game-over')`
    - `gameState.isProcessing = false`
    - return
  - Else: After 2000ms: re-enable remaining buttons; `gameState.isProcessing = false`

**nextRound()**
- `gameState.currentRound++`
- If `gameState.currentRound >= gameState.totalRounds`:
  - `endGame('victory')`
- Else:
  - `renderRound(gameState.currentRound)`

**endGame(reason)**
- `gameState.isActive = false`
- `gameState.isProcessing = false`
- Calculate stars:
  - `const w = gameState.wrongInPractice`
  - `stars = reason === 'game-over' ? 0 : (w === 0 ? 3 : w === 1 ? 2 : 1)`
- Calculate accuracy:
  - `const attempted = Math.min(gameState.currentRound + 1, gameState.totalRounds)`
  - `const accuracy = attempted === 0 ? 0 : Math.round(((attempted - gameState.wrongInPractice) / attempted) * 100)`
- Build metrics object: `{ stars, accuracy, rounds_completed: gameState.currentRound, wrong_in_practice: gameState.wrongInPractice, duration_ms: Date.now() - gameState.startTime }`
- `trackEvent('game_end', 'game', metrics)`
- Send postMessage: `{ type: 'game_complete', gameState, metrics }`
- `showResults(metrics, reason)`
- Cleanup: `visibilityTracker?.stop()`, `progressBar?.destroy()`

**showResults(metrics, reason)**
- Hide `#game-screen`
- Show `#results-screen`
- Set `#results-title`: reason === 'game-over' ? 'Game Over' : 'Well Done!'
- Set `#stars-display`: `'★'.repeat(metrics.stars) + '☆'.repeat(3 - metrics.stars)`
- Set `#metric-rounds`: `${gameState.currentRound} / ${gameState.totalRounds}`
- Set `#metric-accuracy`: `${metrics.accuracy}%`
- Set `#metric-wrong`: `${gameState.wrongInPractice}`

**restartGame()**
- Reset `gameState`: lives=3, score=0, currentRound=0, wrongInPractice=0, subPhase='example', isActive=false, attempts=[], events=[]
- Hide `#results-screen`
- `transitionScreen.show('start')`

**handlePostMessage(event)**
- From PART-008
- On `game_init` message: store `event.data.content` in `gameState.content`, call `setupGame()`

**recordAttempt(data)**
- From PART-009
- Pushes `{ attempt_timestamp: Date.now(), time_since_start: Date.now() - gameState.startTime, input_of_user: data.answer, correct: data.correct, attempt_number: gameState.attempts.length + 1, ...data }` to `gameState.attempts`

**trackEvent(type, target, data)**
- From PART-010
- Pushes `{ type, target, timestamp: Date.now(), ...data }` to `gameState.events`

### Inside DOMContentLoaded (PART-004)

```javascript
document.addEventListener('DOMContentLoaded', () => {
  waitForPackages(() => {
    // 1. Create VisibilityTracker (PART-005)
    visibilityTracker = new VisibilityTracker({
      onInactive: () => trackEvent('visibility_inactive', 'game'),
      onResume: () => trackEvent('visibility_resume', 'game')
    });

    // 2. Inject ScreenLayout (PART-025) — MUST happen before ProgressBar and TransitionScreen
    ScreenLayout.inject({ progressBar: true, transitionScreen: true });

    // 3. ProgressBar (PART-023)
    progressBar = new ProgressBar({ totalRounds: 3, totalLives: 3 });

    // 4. TransitionScreen (PART-024)
    transitionScreen = new TransitionScreen({
      screens: {
        start: {
          title: 'Quadratic Formula',
          subtitle: 'Solve ax²+bx+c=0 step by step',
          body: 'Each round: see a worked example → fill a gap → solve on your own.',
          buttonText: 'Start'
        },
        victory: {
          title: 'Well Done!',
          subtitle: 'You solved all three quadratic equations.',
          buttonText: 'Play Again',
          onButton: restartGame
        },
        'game-over': {
          title: 'Game Over',
          subtitle: 'You ran out of lives in the practice phase.',
          buttonText: 'Try Again',
          onButton: restartGame
        }
      },
      onStart: setupGame
    });

    transitionScreen.show('start');

    // 5. PostMessage listener (PART-008)
    window.addEventListener('message', handlePostMessage);

    // 6. Expose mandatory window globals (required by test harness)
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.nextRound = nextRound;
  });
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = () => console.log(JSON.stringify(gameState, null, 2));
window.debugRound = (i) => renderRound(Math.min(i, gameState.totalRounds - 1));
window.skipToPhase = (phase) => {
  if (!gameState.isActive) return;
  const round = gameState.content.rounds[gameState.currentRound];
  if (phase === 'faded') { gameState.subPhase = 'faded'; renderFadedPanel(round); hide('#example-panel'); show('#faded-panel'); }
  if (phase === 'practice') { gameState.subPhase = 'practice'; renderPracticePanel(round); hide('#faded-panel'); show('#practice-panel'); }
};
```

---

## 10. Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event      | Target | When Fired            |
| ---------- | ------ | --------------------- |
| game_start | game   | setupGame() completes |
| game_end   | game   | endGame() fires       |

### Game-Specific Events

| Event              | Target   | When Fired                                  | Data                                              |
| ------------------ | -------- | ------------------------------------------- | ------------------------------------------------- |
| example_advanced   | example  | User taps "Got It" on worked example        | `{ round, equation }`                             |
| faded_correct      | faded    | User selects correct faded MCQ answer       | `{ round, attempt }`                              |
| faded_incorrect    | faded    | User selects wrong faded MCQ answer         | `{ round, attempt }`                              |
| practice_correct   | practice | User selects correct practice MCQ answer    | `{ round }`                                       |
| practice_incorrect | practice | User selects wrong practice MCQ answer      | `{ round, attempt }`                              |
| life_lost          | practice | Life deducted for wrong practice answer     | `{ lives_remaining }`                             |
| round_complete     | round    | User taps Next Round after correct practice | `{ round, equation, wrong_in_practice_this_round }` |

---

## 11. Scaffold Points

| Point                | Function              | When                                      | What Can Be Injected                                                             |
| -------------------- | --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| before_example       | renderRound()         | New round starts, before example renders  | Pre-example tip: "This round covers [equationLabel] — watch the sign of b and c" |
| after_example_step   | advanceExampleStep()  | Each step revealed                        | Emphasis animation, formula highlighting                                         |
| after_faded_wrong    | handleFadedAnswer()   | Wrong faded MCQ answer                   | Additional hint pointing to the −b or 2a misconception                           |
| after_practice_wrong | handlePracticeAnswer()| Wrong practice MCQ answer                | Deeper worked example replay; specific sign-error explanation                    |
| on_game_over         | endGame()             | Lives = 0                                 | Encouragement message, offer to replay from round 1                              |

---

## 12. Feedback Triggers

> FeedbackManager is NOT initialized (PART-017 excluded). All feedback is visual-only (text + color). No audio permission popup risk.

| Moment               | Trigger Function       | Feedback Type                  | Notes                                                        |
| -------------------- | ---------------------- | ------------------------------ | ------------------------------------------------------------ |
| Faded correct        | handleFadedAnswer()    | Green text panel               | "Correct!" + formula reinforcement                           |
| Faded wrong          | handleFadedAnswer()    | Red text panel + formula hint  | Shows correct answer — no life lost                          |
| Practice correct     | handlePracticeAnswer() | Green text panel + explanation | Shows `explanationOnCorrect` — reinforces the reasoning      |
| Practice wrong       | handlePracticeAnswer() | Red text panel + explanation   | Shows `explanationOnWrong` — targets specific misconception  |
| Round complete       | nextRound()            | Phase resets to blue example   | Visual cue: background color shifts to example-blue          |
| Game over            | endGame()              | Red results screen             | Title: "Game Over"                                           |
| Victory              | endGame()              | Stars + accuracy metric        | Title: "Well Done!"                                          |

---

## 13. Visual Specifications

- **Layout:** Vertical flex stack, max-width 480px, min-height 100dvh. Phase header fixed at top, sub-phase panel scrollable below.
- **Color palette:**
  - Example phase: blue-tinted background (`#eff6ff`) — signals learning mode
  - Faded phase: green-tinted background (`#f0fdf4`) — signals partial completion / almost there
  - Practice phase: yellow-tinted background (`#fefce8`) — signals test mode / on your own
  - Correct feedback: green border + green text (`#166534` on `#f0fdf4`)
  - Wrong feedback: red border + red text (`#991b1b` on `#fef2f2`)
- **Typography:** System sans-serif for prose; `Courier New` monospace for formulas, equations, and math expressions
- **Step cards:** White background, rounded corners (10px), `1.5px solid` border; active step has primary-color border + subtle shadow; completed steps have success-color border + reduced opacity
- **MCQ buttons:** Full-width, white background, monospace font, 2px border. On hover: primary border + very light primary tint. Selected correct: green border + green tint. Selected wrong: red border + red tint.
- **Phase badge:** Pill shape (border-radius 999px), uppercase small text, primary color
- **Equation label:** Monospace font in phase header to clearly render math notation
- **Transitions:** Sub-phase panel switches are instant (class toggle); step reveals have no animation (clarity over flash)
- **Responsive:** Single-column layout works on all mobile screen sizes. Touch targets minimum 44×44px.

---

## 14. Test Scenarios (for Playwright)

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario specifies exact selectors, exact actions, and exact assertions.
> Fallback content is used (round 1 = x²−5x+6=0, round 2 = 2x²+3x−2=0, round 3 = x²−4x+4=0).

### Scenario: Complete game — all correct, full Example → Faded → Practice flow

```
SETUP: Page loaded, game ready (gameState.isActive === true after setupGame())

ROUND 1 — Example phase (x²−5x+6=0):
  ASSERT: #example-panel is visible, #faded-panel is hidden, #practice-panel is hidden
  ASSERT: #phase-badge text contains "Worked Example"
  ASSERT: #equation-label text contains "x²−5x+6=0"
  ACTION: click #btn-example-next                          (reveal step 2)
  ACTION: click #btn-example-next                          (reveal step 3)
  ACTION: click #btn-example-next                          (reveal step 4)
  ASSERT: #example-answer is visible
  ASSERT: #example-answer-value text contains "x = 3"
  ASSERT: #btn-example-done is visible
  ASSERT: #btn-example-next has class "hidden"
  ACTION: click #btn-example-done

ROUND 1 — Faded phase:
  ASSERT: #faded-panel is visible, #example-panel is hidden
  ASSERT: #phase-badge text contains "Fill the Gap"
  ASSERT: #faded-blank is visible
  ACTION: find button in #faded-options whose text equals "x = (6 ± √4) / 2", click it
  ASSERT: that button has class "selected-correct"
  ASSERT: #faded-feedback is visible and has class "correct"
  ASSERT: #faded-after-steps is visible
  ASSERT: #faded-answer is visible
  ASSERT: #btn-faded-done is visible
  ACTION: click #btn-faded-done

ROUND 1 — Practice phase:
  ASSERT: #practice-panel is visible, #faded-panel is hidden
  ASSERT: #phase-badge text contains "Your Turn"
  ACTION: find button in #practice-options whose text equals "x = 5  or  x = 2", click it
  ASSERT: that button has class "selected-correct"
  ASSERT: #practice-feedback is visible and has class "correct"
  ASSERT: #btn-practice-next is visible
  ASSERT: gameState.score == 1
  ASSERT: gameState.wrongInPractice == 0
  ACTION: click #btn-practice-next

ROUND 2 — Example phase (2x²+3x−2=0):
  ASSERT: #example-panel is visible
  ASSERT: #equation-label text contains "2x²+3x−2=0"
  ACTION: click #btn-example-next, click #btn-example-next, click #btn-example-next
  ASSERT: #btn-example-done is visible
  ACTION: click #btn-example-done

ROUND 2 — Faded phase:
  ACTION: find button in #faded-options whose text equals "x = (−5 ± √49) / 6", click it
  ASSERT: button has class "selected-correct"
  ACTION: click #btn-faded-done

ROUND 2 — Practice phase:
  ACTION: find button in #practice-options whose text equals "x = 3/2  or  x = −2", click it
  ASSERT: button has class "selected-correct"
  ASSERT: gameState.score == 2
  ACTION: click #btn-practice-next

ROUND 3 — Example phase (x²−4x+4=0):
  ASSERT: #equation-label text contains "x²−4x+4=0"
  ACTION: click #btn-example-next, click #btn-example-next, click #btn-example-next
  ASSERT: #example-answer-value text contains "double root"
  ACTION: click #btn-example-done

ROUND 3 — Faded phase:
  ACTION: find button in #faded-options whose text equals "x = (6 ± √0) / 2", click it
  ASSERT: button has class "selected-correct"
  ACTION: click #btn-faded-done

ROUND 3 — Practice phase:
  ACTION: find button in #practice-options whose text equals "x = 4 (double root)", click it
  ASSERT: button has class "selected-correct"
  ASSERT: gameState.score == 3
  ASSERT: gameState.wrongInPractice == 0
  ASSERT: #btn-practice-next text contains "See Results"
  ACTION: click #btn-practice-next

ASSERT: #results-screen is visible
ASSERT: #game-screen is hidden
ASSERT: #results-title text contains "Well Done"
ASSERT: #stars-display text equals "★★★"
ASSERT: #metric-accuracy text equals "100%"
ASSERT: #metric-wrong text equals "0"
ASSERT: gameState.isActive == false
ASSERT: postMessage sent with type "game_complete" and metrics.stars == 3
```

### Scenario: Wrong faded answer — no life lost, can retry

```
SETUP: Page loaded, game on Round 1 faded phase (completeExample() called)

ACTION: find a WRONG button in #faded-options (not "x = (6 ± √4) / 2"), click it
ASSERT: that button has class "selected-wrong"
ASSERT: #faded-feedback is visible and has class "wrong"
ASSERT: #faded-feedback text contains "x = (6 ± √4) / 2"   (shows correct answer)
ASSERT: gameState.lives == 3                                   (NO life deducted in faded phase)
ASSERT: #btn-faded-done is hidden
ASSERT: that wrong button is disabled after click

WAIT: 2000ms (re-enable delay)
ASSERT: remaining non-selected buttons are re-enabled (not disabled)

ACTION: click the correct button ("x = (6 ± √4) / 2")
ASSERT: that button has class "selected-correct"
ASSERT: #faded-feedback now has class "correct"
ASSERT: #btn-faded-done is visible
```

### Scenario: Wrong practice answer — life lost, elaborated feedback shown

```
SETUP: Page loaded, game on Round 1 practice phase (completeFaded() called)

ACTION: find button in #practice-options whose text is NOT "x = 5  or  x = 2", click it
ASSERT: that button has class "selected-wrong"
ASSERT: #practice-feedback is visible and has class "wrong"
ASSERT: #practice-feedback text contains "0.707" OR contains "both" OR contains "±"   (part of explanationOnWrong)
ASSERT: gameState.lives == 2                                   (1 life deducted)
ASSERT: gameState.wrongInPractice == 1
ASSERT: #btn-practice-next is hidden

WAIT: 2000ms
ASSERT: remaining non-selected buttons are re-enabled

ACTION: click button whose text equals "x = 5  or  x = 2"
ASSERT: button has class "selected-correct"
ASSERT: gameState.score == 1
ASSERT: #btn-practice-next is visible
```

### Scenario: Game over when lives reach 0

```
SETUP: Page loaded, game at Round 1 practice phase, gameState.lives artificially set to 1

ACTION: click a wrong practice button
ASSERT: gameState.lives == 0
WAIT: 2000ms
ASSERT: #results-screen is visible
ASSERT: #results-title text contains "Game Over"
ASSERT: #stars-display text equals "☆☆☆"
ASSERT: gameState.isActive == false
ASSERT: postMessage sent with type "game_complete" and metrics.stars == 0
```

### Scenario: Round 3 — double root recognised correctly

```
SETUP: Page loaded, game navigated to Round 3 (x²−4x+4=0)

ROUND 3 — Example phase:
  ASSERT: #equation-label text contains "x²−4x+4=0"
  ACTION: click #btn-example-next (reveal step 2: Δ = 16−16 = 0)
  ACTION: click #btn-example-next (reveal step 3: x = (4 ± 0) / 2)
  ACTION: click #btn-example-next (reveal step 4: x = 2, double root)
  ASSERT: #example-answer-value text contains "double root"
  ASSERT: #btn-example-done is visible
  ACTION: click #btn-example-done

ROUND 3 — Faded phase:
  ASSERT: #faded-shown-steps contains text "Δ = ... = 0"
  ACTION: find button in #faded-options whose text equals "x = (6 ± √0) / 2", click it
  ASSERT: button has class "selected-correct"
  ASSERT: #faded-after-steps is visible
  ASSERT: #faded-answer-value text contains "double root"
  ACTION: click #btn-faded-done

ROUND 3 — Practice phase:
  ACTION: find button in #practice-options whose text equals "x = 4 (double root)", click it
  ASSERT: button has class "selected-correct"
  ASSERT: #practice-feedback text contains "Δ=0"
```

### Scenario: Phase indicator updates correctly as sub-phases advance

```
SETUP: Page loaded, game on Round 2 (2x²+3x−2=0), example phase

ASSERT: #phase-badge text contains "Step 1 of 3"
ASSERT: #phase-badge text contains "Worked Example"
ASSERT: #equation-label text contains "2x²+3x−2=0"

[advance to faded phase]
ASSERT: #phase-badge text contains "Step 2 of 3"
ASSERT: #phase-badge text contains "Fill the Gap"

[advance to practice phase]
ASSERT: #phase-badge text contains "Step 3 of 3"
ASSERT: #phase-badge text contains "Your Turn"
```

### Scenario: Restart from results screen resets to round 1

```
SETUP: Complete all 3 rounds to reach results screen

ACTION: click #btn-play-again
ASSERT: #results-screen is hidden
ASSERT: Start screen (TransitionScreen) is visible

ACTION: click Start button
ASSERT: #example-panel is visible
ASSERT: #equation-label text contains "x²−5x+6=0"
ASSERT: gameState.currentRound == 0
ASSERT: gameState.lives == 3
ASSERT: gameState.score == 0
ASSERT: gameState.wrongInPractice == 0
```

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, `<meta charset="UTF-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- [ ] Package scripts in correct order (PART-002): feedback-manager → components → helpers
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `#game-screen` element exists
- [ ] `#results-screen` element exists, hidden by default (`class="hidden"`)
- [ ] `#example-panel`, `#faded-panel`, `#practice-panel` exist inside `#game-screen`
- [ ] `#phase-badge`, `#equation-label` exist in `#phase-header`
- [ ] `#faded-options`, `#practice-options` exist as MCQ containers
- [ ] `#example-steps-container`, `#faded-shown-steps`, `#faded-after-steps` exist

### Functional

- [ ] `waitForPackages()` defined, checks FeedbackManager + Components + Helpers
- [ ] DOMContentLoaded calls init sequence: waitForPackages → ScreenLayout.inject → ProgressBar → TransitionScreen → window.addEventListener('message', ...) → window.endGame/restartGame/nextRound
- [ ] `window.gameState = gameState` set immediately after gameState declaration (CRITICAL)
- [ ] `window.endGame = endGame`, `window.restartGame = restartGame`, `window.nextRound = nextRound` set in DOMContentLoaded
- [ ] `handlePostMessage` registered and handles `game_init` to populate `gameState.content`
- [ ] `setupGame()` uses `fallbackContent` when `gameState.content` is null
- [ ] `FeedbackManager.init()` is NOT called anywhere in the file (CRITICAL — triggers audio popup)
- [ ] `recordAttempt` produces correct attempt shape with all required fields
- [ ] `trackEvent` fires at: example_advanced, faded_correct, faded_incorrect, practice_correct, practice_incorrect, life_lost
- [ ] `endGame()` sends postMessage with `type: 'game_complete'` before showing results
- [ ] `endGame()` stops visibilityTracker and destroys progressBar
- [ ] **Every end condition calls endGame():**
  - [ ] All 3 rounds' practice phases answered → `nextRound()` detects `currentRound >= totalRounds` → `endGame('victory')`
  - [ ] Lives reach 0 in practice phase → `endGame('game-over')`
- [ ] Debug functions on window: `debugGame`, `debugRound`, `skipToPhase`
- [ ] `showResults()` populates all metric fields: title, stars, rounds, accuracy, wrong count
- [ ] Fallback content defines exactly 3 rounds with all required fields

### Sub-Phase Logic

- [ ] `#example-panel` only visible when `subPhase === 'example'`
- [ ] `#faded-panel` only visible when `subPhase === 'faded'`
- [ ] `#practice-panel` only visible when `subPhase === 'practice'`
- [ ] `#btn-example-next` hides after all 4 example steps shown; `#btn-example-done` appears instead
- [ ] Example steps revealed one at a time; previous steps marked `.completed`, new step marked `.active`
- [ ] Faded MCQ buttons disabled immediately on selection; re-enabled after 2000ms if wrong
- [ ] `#faded-after-steps` and `#faded-answer` hidden until correct faded answer selected
- [ ] `#btn-faded-done` hidden until correct faded answer selected
- [ ] Practice MCQ buttons disabled immediately on selection
- [ ] Wrong practice answer deducts 1 life; wrong faded answer does NOT deduct a life
- [ ] `#btn-practice-next` hidden until correct practice answer; shows "See Results" on last round
- [ ] `isProcessing` flag prevents double-submit on all three MCQ handlers

### Math Content

- [ ] Round 1 faded correctAnswer is exactly: `x = (6 ± √4) / 2`
- [ ] Round 1 practice correctAnswer is exactly: `x = 5  or  x = 2`
- [ ] Round 2 faded correctAnswer is exactly: `x = (−5 ± √49) / 6`
- [ ] Round 2 practice correctAnswer is exactly: `x = 3/2  or  x = −2`
- [ ] Round 3 faded correctAnswer is exactly: `x = (6 ± √0) / 2`
- [ ] Round 3 practice correctAnswer is exactly: `x = 4 (double root)`
- [ ] MCQ option button text matches correctAnswer exactly (string equality used for validation)
- [ ] Distractors probe the specific misconception for each round (sign error, wrong denominator, wrong discriminant interpretation)

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded hex colors outside `:root`
- [ ] Example panel has blue-tinted background (`#eff6ff`)
- [ ] Faded panel has green-tinted background (`#f0fdf4`)
- [ ] Practice panel has yellow-tinted background (`#fefce8`)
- [ ] Max-width 480px, uses `100dvh` not `100vh`
- [ ] Buttons use `.game-btn` with `.btn-primary` class
- [ ] MCQ buttons use `.btn-option` class with formula/monospace text
- [ ] Active step card has primary-color border and shadow
- [ ] ProgressBar shows correct lives and round count
- [ ] `.hidden` class uses `!important` to prevent specificity overrides
- [ ] `#equation-label` uses monospace font (`Courier New`) for clear math display

### Rules Compliance

- [ ] RULE-001: `advanceExampleStep`, `completeExample`, `handleFadedAnswer`, `completeFaded`, `handlePracticeAnswer`, `nextRound`, `restartGame` all in global scope (not inside event handlers)
- [ ] RULE-002: No async functions (none needed — all logic is synchronous)
- [ ] RULE-004: All console.log calls use `JSON.stringify` for objects
- [ ] RULE-005: Cleanup in `endGame()` — visibilityTracker stopped, progressBar destroyed
- [ ] RULE-006: No `new Audio()`, no `setInterval` for timing (use `setTimeout` for delays only)
- [ ] RULE-007: Single HTML file, no external CSS/JS beyond the approved CDN URLs

### Game-Specific

- [ ] Each round's MCQ options are shuffled (correct answer not always first button)
- [ ] Faded answer and after-steps hidden until correct faded selection
- [ ] Practice `explanationOnWrong` references the specific misconception (sign of b, denominator 2a, double root)
- [ ] `workedExampleStepIndex` resets to 0 on each new round
- [ ] `fadedAnswered` and `practiceAnswered` flags reset on each new round
- [ ] Round 3 double-root scenario correctly shows "double root" in answer displays
- [ ] All 9 equations (3 rounds × 3 sub-problems) use arithmetically verified correct answers
