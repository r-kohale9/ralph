# Geo: Identify the Angle Type — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 1 (Remember) for the skill `geo-angle-id`: given a CSS-drawn angle diagram, the learner must classify it as Acute / Right / Obtuse / Straight / Reflex. This is pure visual recognition — no computation is required. The five-button MCQ (one option per angle type) forces recall of the defining degree range for each type. On the first incorrect attempt, a worked-example panel expands showing the Angle Type Reference Card with the correct range highlighted. On the second incorrect attempt the round advances (no lives system — learning mode). Stars awarded by accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. 9 rounds across 3 difficulty tiers address five documented misconceptions from CPP/BSCS and Biber et al. Interaction type: `angle-classification-mcq`. NCERT alignment: Class 7 Ch 5 §5.3; Class 9 Ch 6 §6.1.
>
> **RESEARCH SOURCES (geometry-session.md, 2026-03-23):**
> - Source A: Padmavathy, R.D. (2015) "Diagnostic of Errors Committed By 9th Grade Students in Solving Problems in Geometry", IJRE Vol. 4(1). 900 Class 9 students (India); 59% lack angle-related concepts; concept error was the most common type (82.8%). URL: https://www.raijmr.com/ijre/wp-content/uploads/2017/11/IJRE_2015_vol04_issue_01_05.pdf
> - Source B: Biber, Tuna & Korkmaz (2013) "The Mistakes and Misconceptions of 8th Grade Students on the Subject of Angles", ERIC EJ1108200. 30 students; only 43% could accurately answer angle geometry questions. Students focus on physical appearance, not geometric properties; confusion between supplementary (180°) and complementary (90°) pairs. URL: https://files.eric.ed.gov/fulltext/EJ1108200.pdf
> - Source C: Ozkan & Bal (2017) "Analysis of the Misconceptions of 7th Grade Students on Polygons and Specific Quadrilaterals", Eurasian Journal of Educational Research 67, pp. 161–182. Prototype-based recognition documented. URL: https://www.researchgate.net/publication/315899162
> - Source D: CPP/BSCS RESPeCT (2017) "Misconceptions Related to Angles", Day 3 PD Leader Guide — 4th Grade. "Larger space = larger angle" perceptual illusion; arm-length variation as remedy. URL: https://www.cpp.edu/respect/resources/documents_4th/pdlg/3.5-misconceptions-related-to-angles.pdf
> - Source E: NCERT Class 7 Ch 5 (Lines and Angles) + Class 9 Ch 6 §6.1. Acute (0°–90°), right (90°), obtuse (90°–180°), straight (180°), reflex (180°–360°). URL: https://www.vedantu.com/cbse/important-questions-class-7-maths-chapter-6

---

## 1. Game Identity

- **Title:** Name That Angle
- **Game ID:** geo-angle-id
- **Type:** standard
- **Description:** Students identify the angle type (Acute / Right / Obtuse / Straight / Reflex) from a CSS-drawn angle diagram. 9 rounds across 3 difficulty tiers — prototypical orientations (R1–R3), rotated/non-standard orientations (R4–R6), and mixed arm-length variation with near-boundary and reflex angles (R7–R9). MCQ interaction: 4 option buttons per round drawn from the angle's correct label plus 3 research-based distractors. No lives — learning mode. Worked-example panel reveals on first wrong attempt; round auto-advances on second wrong attempt. Stars by first-attempt accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. Targets Class 6–7 primary, Class 9 review. NCERT Ch 5 Class 7 + Ch 6 Class 9.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                   |
| -------- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                              |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                              |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                              |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                              |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                            |
| PART-006 | TimerComponent                | NO              | No timer — angle identification is a visual recognition task. Time pressure contradicts the worked-example pedagogical goal.                                                   |
| PART-007 | Game State Object             | YES             | Custom fields: attemptsThisRound, totalFirstAttemptCorrect, isProcessing, gameEnded                                                                                            |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                              |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                              |
| PART-010 | Event Tracking                | YES             | Custom events: angle_correct_first, angle_correct_second, angle_incorrect, angle_skipped, worked_example_shown, round_complete                                                 |
| PART-011 | End Game & Metrics            | YES             | Star logic: ≥7/9 first-attempt correct = 3★; ≥5/9 = 2★; else 1★. No game-over path — learning mode (no lives). Victory path only.                                           |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                              |
| PART-013 | Validation Fixed              | YES             | MCQ: string equality check (selectedOption === round.correctLabel)                                                                                                             |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                              |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                              |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                              |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Visual feedback only.                                                                                   |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                              |
| PART-019 | Results Screen UI             | YES             | Custom metrics: first-attempt accuracy, rounds completed                                                                                                                       |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                              |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                              |
| PART-022 | Game Buttons                  | YES             | 4 option buttons per round (correct label + 3 distractors)                                                                                                                     |
| PART-023 | ProgressBar Component         | YES             | `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 9, totalLives: 0 })` — no lives display (learning mode)                                              |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory only (no game_over)                                                                                                                                    |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                 |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                         |
| PART-027 | Play Area Construction        | YES             | Layout: CSS-drawn angle diagram above question label above 4 MCQ buttons; worked-example panel hidden by default, slides in below question on first wrong attempt              |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with angleDegrees, correctLabel, distractors, orientation, armLengthRatio, misconceptionTag, explanationHtml, feedbackOnSkip                               |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                                                              |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                                                              |
| PART-031 | API Helper                    | NO              | —                                                                                                                                                                              |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                                                              |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                                                              |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                       |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                  |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                         |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY FIRST FIELD — gameId must be the FIRST key in this object literal:
  gameId: 'geo-angle-id',
  phase: 'start_screen',           // 'start_screen' | 'playing' | 'results'
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 9,
  lives: 0,                        // No lives — learning mode
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
  attemptsThisRound: 0,             // 0, 1, or 2 attempts within current round
  totalFirstAttemptCorrect: 0,      // Total rounds answered correctly on first attempt
  isProcessing: false,              // Guard against double-submit
  gameEnded: false                  // Prevent post-endGame state mutations
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
```

**No lives system:** This game has NO lives — it is a learning mode game. Players always complete all 9 rounds regardless of wrong answers. Star rating is purely based on first-attempt accuracy. `endGame(false)` is never called. There is no game_over transition screen. The `ProgressBarComponent` is initialised with `totalLives: 0`.

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
          "angleDegrees": {
            "type": "number",
            "description": "The actual angle measure in degrees. Used to draw the CSS angle diagram and verify the correct answer. Must match correctLabel: Acute 0–89, Right 90, Obtuse 91–179, Straight 180, Reflex 181–359."
          },
          "correctLabel": {
            "type": "string",
            "enum": ["Acute", "Right", "Obtuse", "Straight", "Reflex"],
            "description": "The correct angle type. Must match angleDegrees range."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. One is correctLabel; 3 are distractors chosen from the remaining 4 angle types. Order must be randomised each round so correct answer is not always in the same position."
          },
          "orientation": {
            "type": "number",
            "description": "Rotation in degrees applied to the entire angle diagram (the vertex stays fixed, both arms rotate together). 0 = standard horizontal-base orientation. Tier 1 (R1–R3): 0. Tier 2 (R4–R6): 30–135 (non-standard). Tier 3 (R7–R9): varied."
          },
          "armLengthRatio": {
            "type": "string",
            "description": "CSS length ratio for the two arms as 'baseArm:otherArm' in relative units. '1.0:1.0' = equal arms. Tier 1 (R1–R3): '1.0:1.0'. Tier 2 (R4–R6): '0.6:1.0' or '1.0:0.6' to probe the arm-length illusion. Tier 3 (R7–R9): '0.4:1.0' or '1.0:0.4' (maximum asymmetry)."
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["arm-length-illusion", "complementary-supplementary-confusion", "orientation-dependence", "property-vs-appearance", "reflex-not-real", "none"],
            "description": "Primary misconception this round targets. arm-length-illusion = Source D: student may judge angle by arm length not arc. complementary-supplementary-confusion = Source B: student confuses 90° and 180° thresholds. orientation-dependence = Source D: student only recognises type in canonical orientation. property-vs-appearance = Sources B+C: student uses visual appearance not degree range. reflex-not-real = Source B: student does not recognise >180° as a valid angle. none = no primary misconception targeted."
          },
          "explanationHtml": {
            "type": "string",
            "description": "HTML string injected into the explanation panel on first wrong attempt. Must include: (1) correct label clearly stated with degree range; (2) the actual angleDegrees value; (3) why the chosen type does NOT fit; (4) one visual/memory cue for the correct type."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when round auto-advances after second wrong attempt. Name correct label and degree value. Max 20 words."
          }
        },
        "required": ["angleDegrees", "correctLabel", "options", "orientation", "armLengthRatio", "misconceptionTag", "explanationHtml", "feedbackOnSkip"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds across 3 tiers. R1–R3: Tier 1 (standard orientation, equal arms). R4–R6: Tier 2 (rotated/non-standard). R7–R9: Tier 3 (mixed arm-length, near-boundary, reflex). Distribution by correctLabel: R1=Acute, R2=Obtuse, R3=Right, R4=Straight, R5=Acute, R6=Obtuse, R7=Right, R8=Reflex, R9=Reflex."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Field names in each round object MUST match the inputSchema: `angleDegrees`, `correctLabel`, `options`, `orientation`, `armLengthRatio`, `misconceptionTag`, `explanationHtml`, `feedbackOnSkip`.

```javascript
// FIELD NAMES PER SCHEMA: angleDegrees (number), correctLabel (string), options (array of 4 strings),
// orientation (number), armLengthRatio (string), misconceptionTag (string),
// explanationHtml (string), feedbackOnSkip (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: ACUTE — Tier 1 (prototypical, standard orientation)
    // 45°, horizontal base, equal arms
    // Target misconception: none (baseline)
    // Distractors: Right (complementary-supplementary confusion),
    //   Obtuse (property-vs-appearance — looks "medium"),
    //   Reflex (reflex-not-real probe)
    // ============================================================
    {
      angleDegrees: 45,
      correctLabel: 'Acute',
      options: ['Acute', 'Right', 'Obtuse', 'Reflex'],
      orientation: 0,
      armLengthRatio: '1.0:1.0',
      misconceptionTag: 'none',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Acute</strong></p>
          <div class="exp-definition"><strong>Acute angle</strong> — any angle strictly between 0° and 90°. This angle is <strong>45°</strong>.</div>
          <div class="exp-reason"><strong>Why Acute?</strong> 45° is less than 90°. The arc is clearly less than a right-angle corner. Any angle that fits entirely "inside" a right angle is acute.</div>
          <div class="exp-wrong"><strong>Why not Right?</strong> A right angle is exactly 90° — it looks like a perfect corner (like the corner of a book). 45° is half of that.</div>
        </div>
      `,
      feedbackOnSkip: 'This is 45° — less than 90°, so it is Acute.'
    },

    // ============================================================
    // ROUND 2: OBTUSE — Tier 1 (prototypical, standard orientation)
    // 120°, horizontal base, equal arms
    // Target misconception: none (baseline)
    // Distractors: Straight (complementary-supplementary confusion),
    //   Acute (property-vs-appearance), Reflex (reflex-not-real)
    // ============================================================
    {
      angleDegrees: 120,
      correctLabel: 'Obtuse',
      options: ['Acute', 'Obtuse', 'Straight', 'Reflex'],
      orientation: 0,
      armLengthRatio: '1.0:1.0',
      misconceptionTag: 'none',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Obtuse</strong></p>
          <div class="exp-definition"><strong>Obtuse angle</strong> — any angle strictly between 90° and 180°. This angle is <strong>120°</strong>.</div>
          <div class="exp-reason"><strong>Why Obtuse?</strong> 120° is greater than 90° (wider than a right angle corner) but less than 180° (not yet a straight line). The arms are "spread open" past a right angle but have not reached a flat line.</div>
          <div class="exp-wrong"><strong>Why not Straight?</strong> A straight angle is exactly 180° — both arms form a single straight line. 120° still has a clear "opening" between the arms; it is not flat.</div>
        </div>
      `,
      feedbackOnSkip: 'This is 120° — between 90° and 180°, so it is Obtuse.'
    },

    // ============================================================
    // ROUND 3: RIGHT — Tier 1 (prototypical, standard orientation)
    // 90°, horizontal base, equal arms, small square corner marker
    // Target misconception: complementary-supplementary-confusion
    // Distractors: Acute (complement confusion), Obtuse, Straight
    // ============================================================
    {
      angleDegrees: 90,
      correctLabel: 'Right',
      options: ['Acute', 'Right', 'Obtuse', 'Straight'],
      orientation: 0,
      armLengthRatio: '1.0:1.0',
      misconceptionTag: 'complementary-supplementary-confusion',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Right</strong></p>
          <div class="exp-definition"><strong>Right angle</strong> — exactly 90°. Marked with a small square symbol at the vertex. This angle is <strong>90°</strong>.</div>
          <div class="exp-reason"><strong>Why Right?</strong> The small square in the corner is the universal symbol for a right angle. Two lines that form a right angle are perpendicular — like the corner of a square or the edge of a door frame.</div>
          <div class="exp-wrong"><strong>Why not Acute?</strong> Acute angles are less than 90° — they are "sharper" than this. A right angle is the boundary: exactly 90°, marked by the square symbol.</div>
        </div>
      `,
      feedbackOnSkip: 'The square corner marker confirms this is exactly 90° — a Right angle.'
    },

    // ============================================================
    // ROUND 4: STRAIGHT — Tier 2 (non-canonical: labelled at a point)
    // 180°, appears as two collinear rays from a single vertex
    // Target misconception: property-vs-appearance (looks like a line not an angle)
    // Source A: Padmavathy — confusing straight angle with a line
    // Distractors: Obtuse, Reflex, Right
    // ============================================================
    {
      angleDegrees: 180,
      correctLabel: 'Straight',
      options: ['Right', 'Obtuse', 'Straight', 'Reflex'],
      orientation: 30,
      armLengthRatio: '1.0:1.0',
      misconceptionTag: 'property-vs-appearance',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Straight</strong></p>
          <div class="exp-definition"><strong>Straight angle</strong> — exactly 180°. Both arms form a single straight line with the vertex in the middle. This angle is <strong>180°</strong>.</div>
          <div class="exp-reason"><strong>Why Straight?</strong> Even though it looks like a line, a straight angle IS an angle — it has a vertex and two rays pointing in opposite directions. The arc spanning 180° confirms this.</div>
          <div class="exp-wrong"><strong>Why not Obtuse?</strong> Obtuse angles are between 90° and 179°. A straight angle is the maximum of the "non-reflex" range — exactly at the straight-line boundary (180°).</div>
        </div>
      `,
      feedbackOnSkip: 'Two collinear rays from a vertex = 180° = Straight angle.'
    },

    // ============================================================
    // ROUND 5: ACUTE — Tier 2 (rotated, short-arm illusion)
    // 35°, rotated 75°, short base arm (0.5:1.0) — arm-length illusion
    // Target misconception: arm-length-illusion (Source D)
    // Distractors: Obtuse (space illusion — looks bigger due to short arm),
    //   Right, Reflex
    // ============================================================
    {
      angleDegrees: 35,
      correctLabel: 'Acute',
      options: ['Acute', 'Right', 'Obtuse', 'Reflex'],
      orientation: 75,
      armLengthRatio: '0.5:1.0',
      misconceptionTag: 'arm-length-illusion',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Acute</strong></p>
          <div class="exp-definition"><strong>Acute angle</strong> — any angle between 0° and 90°. This angle is <strong>35°</strong>.</div>
          <div class="exp-reason"><strong>Why Acute?</strong> The angle is determined by the arc between the arms — NOT by how long the arms are. Even with one short arm, the opening between them is only 35°, well under 90°.</div>
          <div class="exp-wrong"><strong>Arm-length trap:</strong> When one arm is shorter, the space between the arm tips looks larger. But arm length does NOT affect the angle. Only the arc measure matters.</div>
        </div>
      `,
      feedbackOnSkip: 'Arm length does not change the angle. The arc shows 35° — Acute.'
    },

    // ============================================================
    // ROUND 6: OBTUSE — Tier 2 (rotated 110°, very short base arm)
    // 150°, rotated, armLengthRatio 0.4:1.0 — near-boundary obtuse
    // Target misconception: orientation-dependence + arm-length-illusion
    // Source D: students fail obtuse when arms are short and orientation is non-standard
    // Distractors: Straight (overestimate), Reflex (overestimate), Acute
    // ============================================================
    {
      angleDegrees: 150,
      correctLabel: 'Obtuse',
      options: ['Acute', 'Obtuse', 'Straight', 'Reflex'],
      orientation: 110,
      armLengthRatio: '0.4:1.0',
      misconceptionTag: 'orientation-dependence',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Obtuse</strong></p>
          <div class="exp-definition"><strong>Obtuse angle</strong> — between 90° and 180°. This angle is <strong>150°</strong>.</div>
          <div class="exp-reason"><strong>Why Obtuse?</strong> The diagram is rotated and one arm is short, but the arc still shows an opening wider than 90° and not yet flat at 180°. 150° is clearly obtuse by its arc — not its orientation or arm length.</div>
          <div class="exp-wrong"><strong>Why not Straight?</strong> Straight = exactly 180°. At 150° the arms are still visibly open — they have not yet collapsed into a single line.</div>
        </div>
      `,
      feedbackOnSkip: 'Rotated + short arm does not change the type. Arc shows 150° — Obtuse.'
    },

    // ============================================================
    // ROUND 7: RIGHT — Tier 3 (rotated 45°, asymmetric arms)
    // 90°, rotated 45° (diagonal orientation), armLengthRatio 0.6:1.0
    // Target misconception: orientation-dependence (Source D — right angle only
    // recognised in vertical/horizontal orientation)
    // Distractors: Acute, Obtuse, Straight
    // ============================================================
    {
      angleDegrees: 90,
      correctLabel: 'Right',
      options: ['Acute', 'Right', 'Obtuse', 'Straight'],
      orientation: 45,
      armLengthRatio: '0.6:1.0',
      misconceptionTag: 'orientation-dependence',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Right</strong></p>
          <div class="exp-definition"><strong>Right angle</strong> — exactly 90°. This angle is <strong>90°</strong> — rotated 45° from the standard position, with unequal arms.</div>
          <div class="exp-reason"><strong>Why Right?</strong> A right angle is 90° regardless of how it is drawn or which way it is rotated. The small square marker at the vertex is the definitive symbol — it does not have to be "horizontal + vertical" to be a right angle.</div>
          <div class="exp-wrong"><strong>Orientation trap:</strong> Many students only recognise right angles when one arm points up and one arm points sideways. But a rotated right angle is still 90°. Look for the square marker, not the direction.</div>
        </div>
      `,
      feedbackOnSkip: 'The square marker confirms 90° even when rotated. This is a Right angle.'
    },

    // ============================================================
    // ROUND 8: REFLEX — Tier 3 (reflex, 220°)
    // 220°, standard base orientation but arc sweeps the "large" side
    // Target misconception: reflex-not-real (Source B — students stop at 180°)
    // Distractors: Obtuse (seeing the minor 140° angle instead), Straight, Acute
    // ============================================================
    {
      angleDegrees: 220,
      correctLabel: 'Reflex',
      options: ['Obtuse', 'Straight', 'Reflex', 'Acute'],
      orientation: 0,
      armLengthRatio: '1.0:1.0',
      misconceptionTag: 'reflex-not-real',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Reflex</strong></p>
          <div class="exp-definition"><strong>Reflex angle</strong> — any angle greater than 180° and less than 360°. This angle is <strong>220°</strong> — the arc sweeps the larger region between the arms.</div>
          <div class="exp-reason"><strong>Why Reflex?</strong> The arc in the diagram goes around the "big" side. Reflex angles are real angles — they appear in clocks (the "past-six" position), in polygon interiors, and in real engineering contexts.</div>
          <div class="exp-wrong"><strong>Why not Obtuse?</strong> Obtuse angles are between 90° and 180°. The minor angle formed by these arms is 140° (obtuse) but the arc shown measures the MAJOR region — 220°. Always follow the arc direction.</div>
        </div>
      `,
      feedbackOnSkip: 'The arc shows the major region: 220° > 180°, so this is Reflex.'
    },

    // ============================================================
    // ROUND 9: REFLEX — Tier 3 (reflex, 300°, rotated, asymmetric arms)
    // 300°, rotated 60°, armLengthRatio 0.4:1.0 — hardest round
    // Target misconception: reflex-not-real + arm-length-illusion combined
    // Source B: Biber et al. — only 43% accuracy on reflex; students reject large angles
    // Distractors: Obtuse (minor 60° arc confusion), Acute, Straight
    // ============================================================
    {
      angleDegrees: 300,
      correctLabel: 'Reflex',
      options: ['Acute', 'Obtuse', 'Straight', 'Reflex'],
      orientation: 60,
      armLengthRatio: '0.4:1.0',
      misconceptionTag: 'reflex-not-real',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Reflex</strong></p>
          <div class="exp-definition"><strong>Reflex angle</strong> — greater than 180°, less than 360°. This angle is <strong>300°</strong>. The minor angle between the arms is only 60° (Acute), but the arc shown sweeps the major region.</div>
          <div class="exp-reason"><strong>Why Reflex?</strong> When the arc goes the "long way round", the angle is reflex. 300° is the reflex partner of the 60° acute angle formed by the same two arms. Always identify which region the arc labels.</div>
          <div class="exp-wrong"><strong>Why not Acute?</strong> The minor gap between the arms is 60° (Acute), but this diagram marks the MAJOR arc — 300°. The same two arms create two supplementary-to-reflex angle pairs: 60° and 300°. The arc tells you which one is asked.</div>
        </div>
      `,
      feedbackOnSkip: 'Major arc shown = 300° > 180°. The minor gap is only 60°, but the arc says Reflex.'
    }
  ]
};
```

---

## 5. CSS Angle Diagram (MANDATORY)

The angle diagram is drawn entirely in CSS — no SVG, no canvas, no external images. Use `div` elements positioned relative to a vertex point.

### Diagram Structure

```html
<div id="angle-diagram" class="angle-diagram-container">
  <!-- Vertex point -->
  <div class="vertex"></div>
  <!-- Base arm (horizontal by default) -->
  <div class="arm arm-base"></div>
  <!-- Second arm (rotated by angleDegrees) -->
  <div class="arm arm-other"></div>
  <!-- Arc indicator (CSS border-radius circle clipped to show only the arc sector) -->
  <div class="arc-indicator"></div>
  <!-- Right-angle square marker (only for correctLabel === 'Right') -->
  <div class="right-angle-marker" id="right-angle-marker"></div>
</div>
```

### CSS Diagram Rendering Rules

The entire `#angle-diagram` container is rotated by `round.orientation` degrees to achieve non-standard orientations:
```javascript
document.getElementById('angle-diagram').style.transform = `rotate(${round.orientation}deg)`;
```

The second arm is rotated from the base arm by `round.angleDegrees`:
```javascript
document.querySelector('.arm-other').style.transform = `rotate(${round.angleDegrees}deg)`;
```

Arm lengths are set from `round.armLengthRatio` (e.g., `'0.6:1.0'` means base arm = 60% of max, other arm = 100%):
```javascript
const [baseRatio, otherRatio] = round.armLengthRatio.split(':').map(Number);
const maxArmLength = 80; // px — base unit
document.querySelector('.arm-base').style.width = `${Math.round(baseRatio * maxArmLength)}px`;
document.querySelector('.arm-other').style.width = `${Math.round(otherRatio * maxArmLength)}px`;
```

The right-angle square marker is shown ONLY when `round.correctLabel === 'Right'`:
```javascript
document.getElementById('right-angle-marker').style.display =
  round.correctLabel === 'Right' ? 'block' : 'none';
```

For reflex angles (`angleDegrees > 180`), the arc indicator must sweep the major region. Use a CSS technique with two half-circles or a conic-gradient to show the reflex arc.

### CSS

```css
.angle-diagram-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 16px;
}

.vertex {
  position: absolute;
  left: 50%;
  bottom: 50%;
  transform: translate(-50%, 50%);
  width: 8px;
  height: 8px;
  background: #1e293b;
  border-radius: 50%;
  z-index: 10;
}

.arm {
  position: absolute;
  left: 50%;
  bottom: 50%;
  height: 3px;
  background: #1e293b;
  transform-origin: left center;
  border-radius: 2px;
}

.arm-base {
  transform: rotate(0deg);
}

/* .arm-other rotation set dynamically via JS */

.arc-indicator {
  position: absolute;
  left: 50%;
  bottom: 50%;
  transform: translate(-50%, 50%);
  width: 60px;
  height: 60px;
  border: 3px solid #3b82f6;
  border-radius: 50%;
  /* Clip to show only the arc sector — JS sets clip-path based on angleDegrees */
  background: rgba(59, 130, 246, 0.08);
  z-index: 5;
}

.right-angle-marker {
  position: absolute;
  left: calc(50% + 4px);
  bottom: calc(50% + 4px);
  width: 14px;
  height: 14px;
  border-left: none;
  border-bottom: none;
  border-top: 2.5px solid #1e293b;
  border-right: 2.5px solid #1e293b;
  display: none; /* shown only for Right angles */
}
```

---

## 6. Play Area Layout

The play area (`#gameContent`) has three layers; visibility is toggled via the `hidden` class:

```
┌──────────────────────────────────────────────────────┐
│  #angle-diagram-panel  (always visible per round)    │
│  CSS-drawn angle: two arms + arc + optional square   │
│  Updated dynamically each round via JS               │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)         │
│  Heading: "What type of angle is this?"              │
│                                                      │
│  Four MCQ buttons (.option-btn):                     │
│  [ Option A ]  [ Option B ]  [ Option C ]  [ Option D ] │
│  data-testid="option-0/1/2/3", data-value="<label>"  │
│  min-height: 44px; min-width: 44px (accessibility)   │
│                                                      │
│  #feedback-text                                      │
│  aria-live="polite" role="status"                    │
│  data-testid="feedback-text"                         │
│  (hidden by default — brief correct/skip message)    │
├──────────────────────────────────────────────────────┤
│  #explanation-panel  (hidden by default)              │
│  data-testid="explanation-panel"                     │
│  Appears after FIRST wrong attempt only.             │
│  Contains round.explanationHtml injected via         │
│  innerHTML. Two buttons:                             │
│    [Got it — try again]  data-testid="got-it-btn"   │
│      → re-enables buttons for second attempt        │
│    [Skip this round]  data-testid="skip-round-btn"  │
│      → auto-advances round (no life deduction)      │
└──────────────────────────────────────────────────────┘
```

**Degree display:** Each round shows the `round.angleDegrees` value as a small label below the diagram (e.g., "Angle: 45°"). This is intentional — the task is not to estimate degrees but to map degrees to the correct classification vocabulary.

---

## 7. Game Flow

### 7.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

```javascript
function startGame() {
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.phase = 'playing';   // GEN-PHASE-001 MANDATORY
  syncDOMState();                // GEN-PHASE-001 MANDATORY — must be called AFTER phase is set
  transitionScreen.hide();
  renderRound(1);
}
```

### 7.2 renderRound(roundNumber)

```
1. const round = gameState.content.rounds[roundNumber - 1]
2. gameState.currentRound = roundNumber
3. gameState.attemptsThisRound = 0
4. gameState.isProcessing = false
5. Draw angle diagram:
     a. Set container rotation: angle-diagram.style.transform = `rotate(${round.orientation}deg)`
     b. Set arm-other rotation: arm-other.style.transform = `rotate(${round.angleDegrees}deg)`
     c. Set arm lengths from round.armLengthRatio
     d. Show/hide right-angle-marker based on round.correctLabel === 'Right'
     e. Update degree label: document.getElementById('degree-label').textContent = `Angle: ${round.angleDegrees}°`
6. Render option buttons: clear #option-buttons, create 4 buttons from round.options[]
   Each button MUST have ALL of:
     class="option-btn"
     data-testid="option-N"    (N = 0, 1, 2, 3 — positional index)
     data-value="<label>"      (exact string: "Acute", "Right", "Obtuse", "Straight", or "Reflex")
     textContent = label string
   CSS: min-height: 44px; min-width: 44px
7. Hide #feedback-text, hide #explanation-panel
8. Enable all option buttons (remove disabled attribute)
9. progressBar.setRound(roundNumber)
10. syncDOMState()
```

### 7.3 handleOptionClick(selectedLabel)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedLabel === round.correctLabel)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'angle_correct_first' : 'angle_correct_second'
   - if (attemptsThisRound === 1): gameState.totalFirstAttemptCorrect++; gameState.score += 20
   - else: gameState.score += 10  (partial credit for correct on second attempt)
   - FeedbackManager.sound('correct')
   - FeedbackManager.playDynamicFeedback('correct', gameState.score)
   - syncDOMState()
   - Show #feedback-text: "Correct! " + round.correctLabel + " — " + round.angleDegrees + "°"
     (aria-live="polite" ensures screen-reader announcement)
   - After 1200ms: hide #feedback-text; advanceRound()
   - gameState.isProcessing = false

7. else (wrong):
   - Track event: 'angle_incorrect'
   - FeedbackManager.sound('incorrect')
   - if (attemptsThisRound === 1):
       — inject round.explanationHtml into #explanation-panel via innerHTML
       — show #explanation-panel (panel.classList.add('visible'))
       — enable got-it-btn and skip-round-btn
       — gameState.isProcessing = false
       — (wait for user action — do NOT auto-advance)
   - else (attemptsThisRound === 2):
       — Track event: 'angle_skipped'
       — hide #explanation-panel
       — show #feedback-text with round.feedbackOnSkip for 1500ms, then advanceRound()
       — gameState.isProcessing = false
       — NOTE: NO life deduction — learning mode has no lives
```

### 7.4 handleWorkedExampleGotIt()

```
1. Hide #explanation-panel (panel.classList.remove('visible'))
2. Re-enable option buttons (remove disabled attribute)
3. gameState.isProcessing = false
   (attemptsThisRound remains at 1, so next click is the second attempt)
```

### 7.5 handleWorkedExampleSkip()

```
1. Track event: 'angle_skipped'
2. Hide #explanation-panel (panel.classList.remove('visible'))
3. Show #feedback-text with round.feedbackOnSkip for 1500ms, then advanceRound()
4. NOTE: NO life deduction — learning mode
```

### 7.6 advanceRound()

```javascript
function advanceRound() {
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame(true);   // completed all 9 rounds — always victory
  } else {
    renderRound(gameState.currentRound + 1);
  }
}
```

### 7.7 endGame(isVictory)

```
- isVictory is ALWAYS true in this game (no game_over path)
- Set gameState.gameEnded = true; gameState.isActive = false
- Set gameState.phase = 'results'
- syncDOMState()   — MANDATORY
- Star calculation from totalFirstAttemptCorrect (out of 9):
    7–9  → 3★   "Excellent! You recognised every angle type correctly."
    5–6  → 2★   "Well done! You identified most angle types correctly."
    0–4  → 1★   "Keep practising! Angles become easier with time."
- Send postMessage game_complete:
    window.parent.postMessage({
      type: 'game_complete',
      gameId: 'geo-angle-id',
      score: gameState.score,
      stars: starsEarned,
      firstAttemptAccuracy: Math.round((gameState.totalFirstAttemptCorrect / gameState.totalRounds) * 100),
      roundsCompleted: gameState.currentRound,
      livesRemaining: 0,
      isVictory: true,
      duration: Date.now() - gameState.startTime,
      attempts: gameState.attempts,
      events: gameState.events
    }, '*')
- transitionScreen.show({ title: 'Well done!', subtitle: 'You completed all 9 angle rounds.', icons: ['📐'], buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }] })
```

### 7.8 restartGame()

Called by `TransitionScreenComponent` when the player clicks the restart button. Also exposed as `window.restartGame` for tests.

```javascript
function restartGame() {
  // 1. Reset all gameState fields to their initial values
  gameState.currentRound = 0;
  gameState.lives = 0;                   // no-lives learning mode
  gameState.score = 0;
  gameState.totalFirstAttemptCorrect = 0;
  gameState.gameEnded = false;
  gameState.isActive = false;
  gameState.isProcessing = false;
  gameState.attemptsThisRound = 0;
  gameState.events = [];
  gameState.attempts = [];
  gameState.startTime = null;

  // 2. Set phase back to start and sync DOM
  gameState.phase = 'start_screen';
  syncDOMState();                        // GEN-PHASE-001 MANDATORY

  // 3. Hide the transition screen and begin fresh
  transitionScreen.hide();
  startGame();
}
```

---

## 8. CDN Implementation Patterns (MANDATORY)

### 8.0 syncDOMState() — MANDATORY (GEN-PHASE-001)

Every phase change MUST call `syncDOMState()` immediately after setting `gameState.phase`.

```javascript
// Define syncDOMState BEFORE any function that calls it
function syncDOMState() {
  const app = document.getElementById('app');
  if (!app) return;
  app.dataset.phase = gameState.phase;
  app.dataset.lives = gameState.lives;
  app.dataset.score = gameState.score || 0;
  app.dataset.round = gameState.currentRound;
}
```

**Phase transitions (all MANDATORY):**
- Page loads → `gameState.phase = 'start_screen'` → `syncDOMState()` (initial state — before transitionScreen.show({...start...}))
- `startGame()` → `gameState.phase = 'playing'` → `syncDOMState()` (before transitionScreen.hide())
- `endGame(true)` → `gameState.phase = 'results'` → `syncDOMState()` (before transitionScreen.show({...victory...}))

### 8.1 Package Loading

```html
<!-- In <head>: -->
<script src="https://unpkg.com/@hw-app/cdn-games@latest/dist/bundle.js"></script>
```

### 8.2 waitForPackages

```javascript
function waitForPackages(callback) {
  const required = ['ScreenLayout', 'TransitionScreenComponent', 'ProgressBarComponent', 'FeedbackManager'];
  const maxWait = 180000;
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

### 8.3 DOMContentLoaded Initialization

```javascript
document.addEventListener('DOMContentLoaded', () => {
  waitForPackages(() => {
    // Initialize CDN components
    visibilityTracker = new VisibilityTracker({ /* popupProps */ });
    progressBar = new ProgressBarComponent({
      slotId: 'mathai-progress-slot',
      totalRounds: 9,
      totalLives: 0   // No lives — learning mode
    });
    transitionScreen = new TransitionScreenComponent({
      onRestart: restartGame
    });

    // Expose on window AFTER definitions
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.nextRound = nextRound;
    // REQUIRED for test harness __ralph.jumpToRound()
    window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); };

    // Load content (injected by pipeline or fallback)
    gameState.content = window.__gameContent || fallbackContent;

    // Initial phase sync BEFORE showing start screen
    gameState.phase = 'start_screen';
    syncDOMState();

    transitionScreen.show({
      title: 'Name That Angle',
      subtitle: 'Acute, Right, Obtuse, Straight or Reflex? — 9 rounds',
      icons: ['📐'],
      buttons: [{ label: 'Play', action: 'restart', style: 'primary' }]
    });
  });
});
```

### 8.4 FeedbackManager (sound only — NO init)

```javascript
// Correct answer:
FeedbackManager.sound('correct');
FeedbackManager.playDynamicFeedback('correct', gameState.score);

// Wrong answer:
FeedbackManager.sound('incorrect');
```

**NEVER call `FeedbackManager.init()`.** Only call `.sound()` and `.playDynamicFeedback()`.

---

## 9. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests. Use `.sound()` and `.playDynamicFeedback()` only.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions. Also add `window.loadRound = function(n) { ... }` — required for test harness `__ralph.jumpToRound()`.
4. **Do NOT use static HTML for the angle diagram** — the diagram MUST be redrawn each round from `round.angleDegrees`, `round.orientation`, and `round.armLengthRatio`. A diagram that does not change between rounds is a bug.
5. **Do NOT deduct lives** — this game is learning mode. `progressBar` is initialised with `totalLives: 0`. Never call `progressBar.loseLife()` or decrement `gameState.lives`.
6. **Do NOT show a game_over transition screen** — `endGame(false)` should never be called. The only endGame call is `endGame(true)` after all 9 rounds complete.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — disable them when the panel shows; re-enable only when "Got it" is clicked.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — buttons must be re-enabled for the second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — generate from `round.options[]` each round. Options vary per round (each round has a specific set of 4 labels from the 5 types).
11. **Do NOT omit `data-testid` on option buttons** — each button must have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"`, `data-testid="option-3"` (positional) AND `data-value="<label string>"`.
12. **Do NOT omit `data-testid` on explanation panel elements** — `data-testid="explanation-panel"` on container, `data-testid="got-it-btn"`, `data-testid="skip-round-btn"`, `data-testid="feedback-text"`.
13. **Do NOT inject `explanationHtml` as textContent** — use `innerHTML`.
14. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale counts cause the explanation panel to not appear.
15. **Do NOT use `style.display` to toggle the explanation panel** — use `panel.classList.add('visible')` / `panel.classList.remove('visible')` so the CSS slideDown animation fires.
16. **Do NOT show the right-angle square marker on non-right angles** — the marker is only shown when `round.correctLabel === 'Right'`.

---

## 10. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with angle diagram and 4 option buttons.
- **correct-first-attempt-advances**: Selecting the correct option on first attempt shows `#feedback-text` then auto-advances to round 2 after 1200ms.
- **wrong-first-attempt-shows-explanation**: Selecting a wrong option on first attempt shows `#explanation-panel`. Option buttons are disabled while panel is visible.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#explanation-panel` and re-enables option buttons.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round.
- **correct-second-attempt-advances**: Selecting correct on second attempt advances after 1200ms.
- **wrong-second-attempt-auto-advances**: Second wrong attempt auto-advances the round with `feedbackOnSkip` note.
- **complete-9-rounds**: Completing all 9 rounds transitions to `data-phase="results"` (victory). No game-over path.
- **no-game-over**: Confirm no game_over transition screen ever appears regardless of answer choices.
- **no-lives-deducted**: Confirm `window.gameState.lives === 0` throughout all 9 rounds.

### Category: mechanics

- **three-star-threshold**: Answering ≥7/9 correctly on first attempt → 3★.
- **two-star-threshold**: Answering 5 or 6 of 9 correctly on first attempt → 2★.
- **one-star-threshold**: Answering <5/9 correctly on first attempt → 1★.
- **second-attempt-partial-credit**: Correct on second attempt adds 10 points (not 20).
- **isprocessing-guard**: Rapid double-click does not fire two evaluations.
- **diagram-updates-each-round**: Angle diagram reflects `round.angleDegrees` and `round.orientation` for every round.

### Category: state-sync

- **data-phase-playing**: After game start, `document.getElementById('app').dataset.phase === 'playing'`.
- **data-round-updates**: `data-round` increments each round (1 through 9).
- **window-gamestate-accessible**: `window.gameState.currentRound` reflects the active round number.
- **total-rounds-is-9**: `window.gameState.totalRounds === 9`.
- **lives-always-zero**: `window.gameState.lives === 0` at all times (learning mode).

### Category: contract

- **option-buttons-have-data-testid**: All four option buttons have `data-testid="option-0"` through `"option-3"`.
- **option-buttons-have-data-value**: All buttons have `data-value` matching an angle type string exactly.
- **explanation-panel-testid**: Element with `data-testid="explanation-panel"` exists in the DOM.
- **got-it-btn-testid**: Element with `data-testid="got-it-btn"` exists in the DOM.
- **skip-round-btn-testid**: Element with `data-testid="skip-round-btn"` exists in the DOM.
- **feedback-text-testid**: Element with `data-testid="feedback-text"` exists in the DOM.
- **window-endgame-defined**: `typeof window.endGame === 'function'`.
- **window-loadround-defined**: `typeof window.loadRound === 'function'`.
- **no-feedbackmanager-init**: HTML source does not contain `FeedbackManager.init(`.
- **degree-label-present**: Element showing the degree value (e.g., "Angle: 45°") is present in the DOM each round.

---

## 11. Curriculum Alignment

| Curriculum     | Standard/Reference     | Alignment                                                                                                         |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| NCERT Class 7  | Ch 5 §5.3              | Angle types: acute (0°–90°), right (90°), obtuse (90°–180°), straight (180°), reflex (180°–360°). All 9 rounds. |
| NCERT Class 7  | Ch 5 §5.4              | Complementary (sum = 90°) and supplementary (sum = 180°) — addressed via distractors in R3, R4 misconceptions.   |
| NCERT Class 9  | Ch 6 §6.1              | Basic terms and definitions: angles, types — Class 9 review use case.                                            |
| Common Core    | CCSS 4.G.A.1           | Draw and identify angles; identify right, acute, obtuse angles.                                                   |
| Common Core    | CCSS 4.MD.C.5          | Angles as turns; degrees as a unit of measure.                                                                    |

**Session prerequisite:** None — this is the first game in the Geometry Session. No prior geometry knowledge required beyond knowing what an angle is (two rays from a vertex).

**Session successor:** `geo-triangle-sort` (Game 2) — triangle classification by angles (acute-angled / right-angled / obtuse-angled) directly requires the vocabulary from this game.

---

## 12. Misconception Coverage Table

| Misconception | Tag | Rounds | Research Source | Design Response |
|---------------|-----|--------|-----------------|-----------------|
| Larger arms = larger angle (perceptual size illusion) | `arm-length-illusion` | R5, R9 | CPP/BSCS 2017 Source D | Asymmetric arm ratios (0.4:1.0, 0.5:1.0); degree label shown to anchor judgment |
| Right angle only recognised at standard (H/V) orientation | `orientation-dependence` | R6, R7 | CPP/BSCS Source D | R7: right angle rotated 45°; square marker present to confirm type |
| Obtuse angles not recognised in non-standard orientation with short arms | `orientation-dependence` | R6 | Biber et al. Source B | R6: 150° rotated 110° + 0.4:1.0 arm ratio |
| Straight angle confused with a line (not an angle) | `property-vs-appearance` | R4 | Padmavathy Source A | R4: 180° with arc shown + vertex point labelled |
| Reflex angles are "not real" — students stop at 180° | `reflex-not-real` | R8, R9 | Biber et al. Source B | Two dedicated reflex rounds; explanationHtml explains major vs minor arc |
| Complementary (90°) / supplementary (180°) boundary confusion | `complementary-supplementary-confusion` | R3 | Biber + Padmavathy | R3: correct = Right (90°); distractor = Acute probes this threshold |

---

## 13. Worked-Example Panel CSS (MANDATORY)

The `explanationHtml` content uses `.exp-card`, `.exp-title`, `.exp-definition`, `.exp-reason`, `.exp-wrong` — the same class names as `stats-identify-class`. These must be styled:

```css
.exp-card {
  background: #f0f9ff;
  border: 2px solid #0ea5e9;
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 4px;
}

.exp-title {
  font-weight: 700;
  font-size: 1rem;
  color: #0369a1;
  margin: 0 0 10px 0;
  text-align: center;
}

.exp-definition {
  font-size: 0.93rem;
  color: #1e293b;
  margin-bottom: 8px;
  line-height: 1.4;
}

.exp-reason {
  font-size: 0.92rem;
  color: #334155;
  margin-bottom: 8px;
  line-height: 1.4;
  background: #fff7ed;
  border-left: 3px solid #f97316;
  padding: 6px 10px;
  border-radius: 4px;
}

.exp-wrong {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.4;
  margin-top: 4px;
}
```

The explanation panel (`#explanation-panel`) itself:

```css
#explanation-panel {
  display: none;
  margin-top: 16px;
  animation: slideDown 0.25s ease-out;
}

#explanation-panel.visible {
  display: block;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Toggle with `panel.classList.add('visible')` / `panel.classList.remove('visible')`.

---

## 14. PostMessage Protocol

```javascript
// Send on every answer attempt:
window.parent.postMessage({
  type: 'game_event',
  payload: {
    event: eventName,           // 'angle_correct_first' | 'angle_correct_second' | 'angle_incorrect' | 'angle_skipped'
    roundNumber: gameState.currentRound,
    selectedLabel: selectedLabel,
    correctLabel: round.correctLabel,
    angleDegrees: round.angleDegrees,
    misconceptionTag: round.misconceptionTag,
    score: gameState.score,
    timestamp: Date.now()
  }
}, '*');

// Send on game end:
window.parent.postMessage({
  type: 'game_complete',
  gameId: 'geo-angle-id',
  score: gameState.score,
  stars: starsEarned,
  firstAttemptAccuracy: Math.round((gameState.totalFirstAttemptCorrect / gameState.totalRounds) * 100),
  roundsCompleted: gameState.currentRound,
  livesRemaining: 0,
  isVictory: true,
  duration: Date.now() - gameState.startTime,
  attempts: gameState.attempts,
  events: gameState.events
}, '*');
```

---

## 15. Test Assertions (Section 15 — 12 Test Cases)

### TC-001: game-flow / start-screen
**Description:** Page loads and shows start screen with correct phase.
**Steps:** Navigate to game URL. Do not click anything.
**Assert:** `document.getElementById('app').dataset.phase === 'start'` AND start button is visible.

### TC-002: game-flow / game-start
**Description:** Clicking the play button transitions to playing phase with round 1.
**Steps:** Click the play/start button.
**Assert:** `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND 4 buttons with `data-testid="option-0/1/2/3"` are visible.

### TC-003: game-flow / correct-first-attempt-advances
**Description:** Correct first attempt shows feedback and advances to round 2.
**Steps:** Start game. On round 1 (45° Acute), click the button with `data-value="Acute"`.
**Assert:** `[data-testid="feedback-text"]` becomes visible with content containing "Correct". After 1200ms, `window.gameState.currentRound === 2`.

### TC-004: game-flow / wrong-first-attempt-shows-explanation
**Description:** Wrong first attempt reveals worked-example panel with buttons disabled.
**Steps:** Start game. On round 1, click any button where `data-value !== "Acute"`.
**Assert:** `[data-testid="explanation-panel"]` is visible. All `[data-testid^="option-"]` buttons are disabled.

### TC-005: game-flow / got-it-enables-second-attempt
**Description:** Clicking "Got it — try again" hides explanation panel and re-enables buttons.
**Steps:** Round 1, wrong answer. Then click `[data-testid="got-it-btn"]`.
**Assert:** `[data-testid="explanation-panel"]` is hidden. All option buttons are enabled. `window.gameState.attemptsThisRound === 1`.

### TC-006: game-flow / skip-advances-round
**Description:** "Skip this round" from explanation panel advances to next round without life deduction.
**Steps:** Round 1, wrong answer. Panel appears. Click `[data-testid="skip-round-btn"]`.
**Assert:** `window.gameState.currentRound === 2` (after delay). `window.gameState.lives === 0` (unchanged).

### TC-007: game-flow / no-lives-deducted
**Description:** Lives remain 0 throughout all 9 rounds regardless of wrong answers.
**Steps:** Start game. Answer wrong on every round (skip or second wrong attempt for each).
**Assert:** `window.gameState.lives === 0` after every round. No game_over screen appears.

### TC-008: game-flow / complete-9-rounds
**Description:** Completing all 9 rounds transitions to results (victory).
**Steps:** Complete rounds 1–9 (any combination of correct/skip).
**Assert:** `data-phase === 'results'` AND victory transition screen is visible. No game_over screen ever shown.

### TC-009: mechanics / three-star-threshold
**Description:** ≥7 first-attempt correct answers → 3★ on results screen.
**Steps:** Answer correctly first attempt on rounds 1–7, then skip rounds 8–9.
**Assert:** Results screen shows 3★.

### TC-010: mechanics / one-star-threshold
**Description:** <5 first-attempt correct → 1★.
**Steps:** Skip all 9 rounds (wrong twice each).
**Assert:** Results screen shows 1★.

### TC-011: state-sync / data-round-updates
**Description:** `data-round` on `#app` increments correctly each round.
**Steps:** Start game. Complete rounds 1–3.
**Assert:** After round 1 renders: `app.dataset.round === '1'`. After round 2: `=== '2'`. After round 3: `=== '3'`.

### TC-012: contract / no-feedbackmanager-init
**Description:** Game HTML never calls FeedbackManager.init().
**Steps:** Load game page source.
**Assert:** `document.body.innerHTML` does not contain the string `'FeedbackManager.init('`.

---

## 16. Pedagogical Progression: geo-angle-id → geo-triangle-sort → geo-quad-match → geo-angle-sum

**geo-angle-id** (Bloom L1 — Remember — THIS GAME):
- Learner sees a CSS-drawn angle and must select the correct type from Acute / Right / Obtuse / Straight / Reflex.
- Cognitive demand: recall the degree range of each type and map a visual percept to a label.
- Primary misconceptions targeted: arm-length illusion (Source D), orientation-dependence (Source D), reflex-not-real (Source B), property-vs-appearance (Sources B+C), complementary-supplementary confusion (Sources A+B).

**geo-triangle-sort** (Bloom L1–L2 — Remember→Understand):
- Learner classifies a triangle on two independent axes: by sides (equilateral/isosceles/scalene) AND by angles (acute-angled/right-angled/obtuse-angled). The angle classification step directly requires geo-angle-id vocabulary.

**geo-quad-match** (Bloom L2 — Understand):
- Learner matches a property list to a quadrilateral type. No angle drawing — pure property reasoning.

**geo-angle-sum** (Bloom L3 — Apply):
- Learner computes missing angles using triangle (180°) and quadrilateral (360°) angle sum properties. Requires knowing angle type names and recognising right angles.

**Why L1 visual classification comes first (research basis):**
- Biber et al. (Source B): only 43% accuracy on angle questions; students use physical appearance, not geometric properties. This game trains property-based thinking (degree range) before computation begins.
- Padmavathy (Source A): 59% of Class 9 students lack angle-related concepts — the most fundamental gap in the geometry curriculum. A dedicated L1 recognition game directly addresses this before any computation practice.
- CPP/BSCS (Source D): arm-length and orientation illusions must be explicitly counteracted through varied stimuli — this spec includes both asymmetric arms and rotated orientations in Tiers 2 and 3 precisely for this purpose.
