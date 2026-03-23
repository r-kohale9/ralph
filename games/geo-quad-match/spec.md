# Geo: Match That Quadrilateral — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 2 (Understand) for the skill `geo-quad-match`: given a CSS-drawn quadrilateral diagram, the learner selects its correct name; or given a name + property list, the learner selects the matching CSS diagram; or given a property list, the learner names the quadrilateral. Tier 1 (R1–R3): name → diagram matching (given name + key property, pick CSS shape). Tier 2 (R4–R6): diagram → name matching (given CSS shape, pick name from 4 options). Tier 3 (R7–R9): property → name (given a property list, pick the quadrilateral name). This alternating structure requires genuine Bloom L2 reasoning — the learner must translate between three representations (visual, verbal-name, property-list) of the same concept. The 4-button MCQ explicitly targets the documented hierarchy-confusion misconceptions (square-is-not-a-rectangle, square-is-not-a-rhombus, kite-vs-rhombus, parallelogram exclusion). Worked-example panel on first wrong attempt. Stars by first-attempt accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. No lives — learning mode.
>
> **RESEARCH SOURCES (fetched 2026-03-23):**
> - Source A: Fujita, T. & Jones, K. (2007) "Learners' understanding of the definitions and hierarchical classification of quadrilaterals: Towards a theoretical framing", ResearchGate / ZDM. 263 learners; main finding: students cannot accept a square as a special rectangle or that a rhombus can also be called a parallelogram — hierarchical inclusion is the primary difficulty. URL: https://www.researchgate.net/publication/242118122
> - Source B: Avcu, R. & Avcu, S. (2014) "Personal Figural Concepts and Classifications About Quadrilaterals", ERIC EJ1023780. 57 pre-service teachers: majority could not accept the hierarchical relationships (square is both rectangle and rhombus); prototypical images over-rode definitions. URL: https://files.eric.ed.gov/fulltext/EJ1023780.pdf
> - Source C: Ozkan, M. & Bal, A.P. (2017) "Analysis of the Misconceptions of 7th Grade Students on Polygons and Specific Quadrilaterals", EJER Vol.67. 229 7th-graders across 5 schools; students drew prototype figures for all quadrilaterals; highest misconception rate on parallelogram (square-vs-parallelogram confusion); trapezoid was the least-known type. URL: https://www.ejer.com.tr
> - Source D: Satır, S. & Kurtuluş, A. (2024) "Examination of Seventh Grade Students' Van Hiele Geometric Thinking Levels and Their Mistakes on Quadrilaterals", DergiPark. 10 seventh-grade students: square positioned on vertex not recognised; misconception that all side lengths of trapezoid must differ; equal side lengths erroneously imply equal diagonals. URL: https://dergipark.org.tr/tr/download/article-file/3433273
> - Source E: NCERT Class 8 Ch 3 (Understanding Quadrilaterals). Explicit hierarchy: Trapezium → Kite → Parallelogram → Rectangle / Rhombus → Square. Properties of each type taught formally: parallel sides, equal sides, right angles, diagonal properties. URL: https://ncert.nic.in/textbook/pdf/hemh103.pdf
> - Source F: Maths No Problem Blog (2021) "Maths Misconceptions: Squares and Rectangles". Practical teacher resource documenting the 'square is not a rectangle' misconception and its prevalence across K-8; recommends property-based teaching over prototype-name teaching. URL: https://mathsnoproblem.com/blog/teaching-tips/maths-misconceptions-squares-and-rectangles

---

## 1. Game Identity

- **Title:** Match That Quadrilateral
- **Game ID:** geo-quad-match
- **Type:** standard
- **Description:** Students classify and match CSS-drawn quadrilaterals (parallelogram, rectangle, rhombus, square, trapezium, kite) through three interaction modes. Tier 1 (R1–R3): given a quadrilateral name + key property, pick the correct CSS shape from 4 CSS diagrams. Tier 2 (R4–R6): given a CSS shape, pick the correct name from 4 option buttons. Tier 3 (R7–R9): given a property list (e.g. "4 equal sides, 4 right angles"), pick the correct quadrilateral name from 4 options. MCQ interaction: 4 option buttons per round (or 4 CSS diagram tiles for Tier 1). No lives — learning mode. Worked-example panel on first wrong attempt; round auto-advances on second wrong attempt. Stars by first-attempt accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. Targets Class 8 (NCERT Ch 3). Prerequisite: geo-triangle-sort (Game 2).

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                   |
| -------- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                              |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                              |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                              |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                              |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                            |
| PART-006 | TimerComponent                | NO              | No timer — property matching is a reasoning task. Time pressure contradicts the worked-example pedagogical goal.                                                               |
| PART-007 | Game State Object             | YES             | Custom fields: attemptsThisRound, totalFirstAttemptCorrect, isProcessing, gameEnded                                                                                            |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                              |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                              |
| PART-010 | Event Tracking                | YES             | Custom events: quad_correct_first, quad_correct_second, quad_incorrect, quad_skipped, worked_example_shown, round_complete                                                     |
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
| PART-022 | Game Buttons                  | YES             | 4 option buttons per round (correct label + 3 distractors); Tier 1: 4 CSS shape tiles as clickable options                                                                     |
| PART-023 | ProgressBar Component         | YES             | `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 9, totalLives: 0 })` — no lives display (learning mode)                                              |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory only (no game_over)                                                                                                                                    |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                 |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                         |
| PART-027 | Play Area Construction        | YES             | Layout: CSS-drawn quad diagram (or 4 diagram tiles for Tier 1) + question label + 4 MCQ buttons; worked-example panel hidden by default, slides in below question on first wrong attempt |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with quadShape, correctLabel, tier, mode, options, misconceptionTag, explanationHtml, feedbackOnSkip                                                       |
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
  gameId: 'geo-quad-match',
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
          "quadShape": {
            "type": "object",
            "description": "CSS rendering data for the quadrilateral. Contains clipPath (string: CSS clip-path polygon() value as percentages defining the shape), bgColor (string: CSS background color for the shape fill, default '#dbeafe'), borderColor (string: optional border/outline color). For Tier 1 rounds (mode='name-to-diagram'), this is the CORRECT shape — the other 3 distractorShapes[] objects are the CSS shapes for the 3 wrong diagram options. For Tier 2 and 3 rounds, this is the shape shown in the diagram panel.",
            "properties": {
              "clipPath": { "type": "string" },
              "bgColor": { "type": "string" },
              "label": { "type": "string", "description": "Human-readable label for this shape tile (used in Tier 1 only for accessibility)" }
            },
            "required": ["clipPath", "bgColor"]
          },
          "distractorShapes": {
            "type": "array",
            "description": "Only used in Tier 1 (mode='name-to-diagram'). Exactly 3 CSS shape objects (same structure as quadShape) representing the wrong diagram options. Must be visually distinct from quadShape.",
            "items": {
              "type": "object",
              "properties": {
                "clipPath": { "type": "string" },
                "bgColor": { "type": "string" },
                "label": { "type": "string" }
              }
            }
          },
          "correctLabel": {
            "type": "string",
            "enum": ["Parallelogram", "Rectangle", "Rhombus", "Square", "Trapezium", "Kite"],
            "description": "The correct quadrilateral name. For Tier 1 (mode='name-to-diagram'): this is the name shown in the question (along with keyProperty). For Tier 2 (mode='diagram-to-name'): this is the correct answer button label. For Tier 3 (mode='property-to-name'): this is the correct answer button label."
          },
          "tier": {
            "type": "number",
            "enum": [1, 2, 3],
            "description": "Difficulty tier. 1 = name-to-diagram (R1–R3). 2 = diagram-to-name (R4–R6). 3 = property-to-name (R7–R9)."
          },
          "mode": {
            "type": "string",
            "enum": ["name-to-diagram", "diagram-to-name", "property-to-name"],
            "description": "Interaction mode. 'name-to-diagram': given name + keyProperty, pick the correct CSS diagram from 4 shape tiles. 'diagram-to-name': given CSS diagram, pick the correct name from 4 text buttons. 'property-to-name': given a property list string, pick the correct name from 4 text buttons."
          },
          "keyProperty": {
            "type": "string",
            "description": "Used in Tier 1 (name-to-diagram) only. A short defining property shown alongside the name in the question. E.g. for 'Trapezium': 'exactly one pair of parallel sides'. Max 12 words. Drives the question text: 'A [correctLabel] has [keyProperty]. Which shape below is a [correctLabel]?'"
          },
          "propertyList": {
            "type": "string",
            "description": "Used in Tier 3 (property-to-name) only. Full property description shown to the learner. E.g. '4 equal sides, 4 right angles, diagonals equal and bisect at 90°'. Should include 2–4 properties. This IS the question stimulus — no shape diagram is shown in Tier 3."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. For Tier 2 and Tier 3: text labels (one is correctLabel, 3 are distractor names). For Tier 1: NOT used as text buttons — Tier 1 uses 4 CSS shape tiles instead (quadShape + 3 distractorShapes). Still provide 4 label strings for Tier 1 (used as aria-label attributes on the shape tiles and for the validation check)."
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["square-not-rectangle", "square-not-rhombus", "rhombus-not-parallelogram", "kite-vs-rhombus", "trapezium-not-parallelogram", "parallelogram-prototype", "none"],
            "description": "Primary misconception this round targets. square-not-rectangle: Sources A+B+F — students reject square as a type of rectangle. square-not-rhombus: Sources A+B — students reject square as a type of rhombus. rhombus-not-parallelogram: Source B — students do not see rhombus as a parallelogram. kite-vs-rhombus: Source E (NCERT) — kite and rhombus confused (both have equal sides but adjacency vs. opposite). trapezium-not-parallelogram: Sources C+D — trapezium treated as unrelated to parallelogram family. parallelogram-prototype: Sources C+D — students only recognise the 'tilted Z' parallelogram prototype, not rectangles/squares as parallelograms. none: no primary misconception targeted."
          },
          "explanationHtml": {
            "type": "string",
            "description": "HTML string injected into the explanation panel on first wrong attempt. Must include: (1) the correct label clearly stated with definition; (2) the key property that identifies this quadrilateral; (3) why the chosen distractor does NOT fit; (4) one memory cue or hierarchy note."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when round auto-advances after second wrong attempt. Names correct label and one defining property. Max 20 words."
          }
        },
        "required": ["quadShape", "correctLabel", "tier", "mode", "options", "misconceptionTag", "explanationHtml", "feedbackOnSkip"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. R1–R3: Tier 1 (name-to-diagram). R4–R6: Tier 2 (diagram-to-name). R7–R9: Tier 3 (property-to-name). Distribution: R1=Trapezium, R2=Parallelogram, R3=Kite, R4=Rectangle, R5=Rhombus, R6=Square, R7=Square (4 equal+4 right angles), R8=Rhombus (4 equal sides, perpendicular diagonals), R9=Parallelogram (opposite sides parallel and equal)."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Field names in each round object MUST match the inputSchema: `quadShape`, `distractorShapes` (Tier 1 only), `correctLabel`, `tier`, `mode`, `keyProperty` (Tier 1 only), `propertyList` (Tier 3 only), `options`, `misconceptionTag`, `explanationHtml`, `feedbackOnSkip`.

```javascript
// FIELD NAMES PER SCHEMA: quadShape (object), distractorShapes (array, Tier 1 only),
// correctLabel (string), tier (number), mode (string), keyProperty (string, Tier 1),
// propertyList (string, Tier 3), options (array of 4 strings), misconceptionTag (string),
// explanationHtml (string), feedbackOnSkip (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: TRAPEZIUM — Tier 1 (name-to-diagram)
    // Given name "Trapezium" + keyProperty "exactly one pair of parallel sides",
    // pick the correct CSS shape from 4 shape tiles.
    // Target misconception: trapezium-not-parallelogram
    // Source C (Ozkan 2017): trapezoid was least-known type among 7th graders.
    // Source D (Satır 2024): students had misconceptions about trapezoid definitions.
    // Correct shape: trapezium (top shorter than bottom, one pair parallel).
    // Distractor shapes: rectangle (2 pairs parallel — looks like trapezium to some),
    //   kite (no parallel sides — pure visual confusion), parallelogram (2 pairs parallel — prototype confusion)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(20% 10%, 80% 10%, 100% 90%, 0% 90%)',
        bgColor: '#dbeafe',
        label: 'Trapezium'
      },
      distractorShapes: [
        { clipPath: 'polygon(0% 10%, 100% 10%, 100% 90%, 0% 90%)', bgColor: '#fef9c3', label: 'Rectangle' },
        { clipPath: 'polygon(50% 5%, 90% 50%, 50% 95%, 10% 50%)', bgColor: '#fce7f3', label: 'Kite' },
        { clipPath: 'polygon(20% 10%, 100% 10%, 80% 90%, 0% 90%)', bgColor: '#dcfce7', label: 'Parallelogram' }
      ],
      correctLabel: 'Trapezium',
      tier: 1,
      mode: 'name-to-diagram',
      keyProperty: 'exactly one pair of parallel sides',
      options: ['Trapezium', 'Rectangle', 'Kite', 'Parallelogram'],
      misconceptionTag: 'trapezium-not-parallelogram',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Trapezium</strong></p>
          <div class="exp-definition"><strong>Trapezium</strong> — a quadrilateral with exactly ONE pair of parallel sides. The top and bottom edges are parallel; the left and right edges are not parallel to each other.</div>
          <div class="exp-reason"><strong>How to spot it:</strong> Look for a shape with one horizontal pair of parallel sides and two non-parallel "slanted" sides. A trapezium often looks like a truncated triangle — wider at the bottom, narrower at the top.</div>
          <div class="exp-wrong"><strong>Why not Parallelogram?</strong> A parallelogram has TWO pairs of parallel sides (both pairs of opposite sides). A trapezium has only ONE pair. That is the key difference.</div>
        </div>
      `,
      feedbackOnSkip: 'Trapezium has exactly one pair of parallel sides — top and bottom only.'
    },

    // ============================================================
    // ROUND 2: PARALLELOGRAM — Tier 1 (name-to-diagram)
    // Given name "Parallelogram" + keyProperty "two pairs of parallel sides, opposite sides equal",
    // pick the correct CSS shape from 4 shape tiles.
    // Target misconception: parallelogram-prototype
    // Source C (Ozkan 2017): students draw prototype "tilted Z" shape only.
    // Source B (Avcu 2014): students do not see rectangles or squares as parallelograms.
    // Correct shape: tilted parallelogram (classic skewed shape).
    // Distractor shapes: trapezium (only 1 pair parallel), rhombus (all equal sides — different), square (equal+right)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(20% 10%, 100% 10%, 80% 90%, 0% 90%)',
        bgColor: '#dbeafe',
        label: 'Parallelogram'
      },
      distractorShapes: [
        { clipPath: 'polygon(20% 10%, 80% 10%, 100% 90%, 0% 90%)', bgColor: '#fef9c3', label: 'Trapezium' },
        { clipPath: 'polygon(50% 5%, 97% 50%, 50% 95%, 3% 50%)', bgColor: '#fce7f3', label: 'Rhombus' },
        { clipPath: 'polygon(10% 10%, 90% 10%, 90% 90%, 10% 90%)', bgColor: '#dcfce7', label: 'Square' }
      ],
      correctLabel: 'Parallelogram',
      tier: 1,
      mode: 'name-to-diagram',
      keyProperty: 'two pairs of parallel sides, opposite sides equal',
      options: ['Parallelogram', 'Trapezium', 'Rhombus', 'Square'],
      misconceptionTag: 'parallelogram-prototype',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Parallelogram</strong></p>
          <div class="exp-definition"><strong>Parallelogram</strong> — a quadrilateral where BOTH pairs of opposite sides are parallel and equal in length. Opposite angles are also equal.</div>
          <div class="exp-reason"><strong>How to spot it:</strong> The top and bottom edges are parallel AND the left and right edges are parallel. The shape "leans" to one side — it is like a rectangle that has been pushed sideways.</div>
          <div class="exp-wrong"><strong>Why not Trapezium?</strong> A trapezium has only ONE pair of parallel sides. The parallelogram shown here has TWO pairs of parallel sides — its opposite sides are parallel, making it a parallelogram.</div>
        </div>
      `,
      feedbackOnSkip: 'Parallelogram has two pairs of opposite parallel sides — the "leaning" shape.'
    },

    // ============================================================
    // ROUND 3: KITE — Tier 1 (name-to-diagram)
    // Given name "Kite" + keyProperty "two pairs of equal adjacent sides",
    // pick the correct CSS shape from 4 shape tiles.
    // Target misconception: kite-vs-rhombus
    // Source E (NCERT Class 8): kite explicitly contrasted with rhombus.
    // A kite has two pairs of ADJACENT (touching) equal sides; a rhombus has all four sides equal.
    // Correct shape: kite (elongated diamond, asymmetric diagonals).
    // Distractor shapes: rhombus (all sides equal — symmetric diamond, most common confusion),
    //   square (all equal + right angles), parallelogram
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(50% 5%, 90% 40%, 50% 95%, 10% 40%)',
        bgColor: '#dbeafe',
        label: 'Kite'
      },
      distractorShapes: [
        { clipPath: 'polygon(50% 5%, 97% 50%, 50% 95%, 3% 50%)', bgColor: '#fef9c3', label: 'Rhombus' },
        { clipPath: 'polygon(10% 10%, 90% 10%, 90% 90%, 10% 90%)', bgColor: '#fce7f3', label: 'Square' },
        { clipPath: 'polygon(20% 10%, 100% 10%, 80% 90%, 0% 90%)', bgColor: '#dcfce7', label: 'Parallelogram' }
      ],
      correctLabel: 'Kite',
      tier: 1,
      mode: 'name-to-diagram',
      keyProperty: 'two pairs of equal adjacent sides',
      options: ['Kite', 'Rhombus', 'Square', 'Parallelogram'],
      misconceptionTag: 'kite-vs-rhombus',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Kite</strong></p>
          <div class="exp-definition"><strong>Kite</strong> — a quadrilateral with two pairs of equal ADJACENT (next-to-each-other) sides. The two pairs share a vertex. A kite looks like a diamond that is taller than it is wide.</div>
          <div class="exp-reason"><strong>Kite vs Rhombus:</strong> A rhombus has ALL FOUR sides equal and looks like a symmetric diamond. A kite has TWO pairs of adjacent sides equal — one pair is shorter and one pair is longer. This makes the kite elongated, not symmetric top-to-bottom.</div>
          <div class="exp-wrong"><strong>Why not Rhombus?</strong> A rhombus is symmetric — all four sides are the same length. The kite shown is NOT symmetric top-to-bottom: the upper two sides are shorter than the lower two sides. That asymmetry is the kite's defining visual feature.</div>
        </div>
      `,
      feedbackOnSkip: 'Kite: two pairs of equal adjacent sides — asymmetric top-to-bottom diamond.'
    },

    // ============================================================
    // ROUND 4: RECTANGLE — Tier 2 (diagram-to-name)
    // Given a CSS rectangle diagram, pick the correct name from 4 options.
    // Target misconception: square-not-rectangle
    // Sources A+B+F: the most prevalent quadrilateral misconception —
    // students do not accept a square as a rectangle and often confuse
    // non-square rectangles with parallelograms.
    // Distractors: Square (students over-apply the square label to any right-angle shape),
    //   Parallelogram (students see rectangle as a "type" of parallelogram loosely),
    //   Rhombus (less likely, but included to force property reasoning)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(0% 20%, 100% 20%, 100% 80%, 0% 80%)',
        bgColor: '#dbeafe',
        label: 'Rectangle'
      },
      correctLabel: 'Rectangle',
      tier: 2,
      mode: 'diagram-to-name',
      options: ['Rectangle', 'Square', 'Parallelogram', 'Rhombus'],
      misconceptionTag: 'square-not-rectangle',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Rectangle</strong></p>
          <div class="exp-definition"><strong>Rectangle</strong> — a parallelogram with FOUR RIGHT ANGLES. Opposite sides are equal and parallel. The shape here is longer than it is tall — so the opposite sides are NOT all equal in length.</div>
          <div class="exp-reason"><strong>Why not Square?</strong> A square is a SPECIAL rectangle where all four sides are ALSO equal. This shape has two longer sides and two shorter sides — not all four sides are equal — so it is a rectangle but NOT a square.</div>
          <div class="exp-wrong"><strong>Key hierarchy:</strong> All squares ARE rectangles (every square has 4 right angles). But not all rectangles are squares (this one is not). The rectangle is the broader category; the square is the more specific type.</div>
        </div>
      `,
      feedbackOnSkip: 'Rectangle: 4 right angles, opposite sides equal — longer than a square.'
    },

    // ============================================================
    // ROUND 5: RHOMBUS — Tier 2 (diagram-to-name)
    // Given a CSS rhombus diagram, pick the correct name from 4 options.
    // Target misconception: square-not-rhombus + rhombus-not-parallelogram
    // Source A (Fujita 2007): students cannot accept that square is a rhombus.
    // Source B (Avcu 2014): students do not see rhombus as a parallelogram type.
    // Distractors: Square (students confuse rotated square with rhombus — they look similar),
    //   Kite (both are diamond-shaped — kite-vs-rhombus confusion),
    //   Parallelogram (rhombus IS a parallelogram but students treat as separate)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(50% 5%, 97% 50%, 50% 95%, 3% 50%)',
        bgColor: '#dbeafe',
        label: 'Rhombus'
      },
      correctLabel: 'Rhombus',
      tier: 2,
      mode: 'diagram-to-name',
      options: ['Rhombus', 'Square', 'Kite', 'Parallelogram'],
      misconceptionTag: 'rhombus-not-parallelogram',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Rhombus</strong></p>
          <div class="exp-definition"><strong>Rhombus</strong> — a parallelogram with ALL FOUR SIDES EQUAL. Opposite angles are equal. Diagonals bisect each other at RIGHT ANGLES (perpendicular).</div>
          <div class="exp-reason"><strong>Rhombus vs Square:</strong> A square is a SPECIAL rhombus that also has 4 right angles. This shape does NOT have right angles at its corners — the corners are pointed (acute and obtuse), not square. So it is a rhombus but NOT a square.</div>
          <div class="exp-wrong"><strong>Why not Kite?</strong> A kite has two pairs of adjacent equal sides — one pair short, one pair long. A rhombus has ALL FOUR sides equal. In this symmetric diamond, all four sides are the same length — that is the rhombus.</div>
        </div>
      `,
      feedbackOnSkip: 'Rhombus: all 4 sides equal, diagonals perpendicular — diamond with pointed corners.'
    },

    // ============================================================
    // ROUND 6: SQUARE — Tier 2 (diagram-to-name)
    // Given a CSS square diagram (oriented normally), pick the correct name from 4 options.
    // Target misconception: square-not-rectangle + square-not-rhombus
    // Source A (Fujita 2007): many students at analysis level cannot accept square as
    // a special rectangle. This round tests explicit square recognition.
    // Distractors: Rectangle (students treat square and rectangle as the same),
    //   Rhombus (square rotated = rhombus in student thinking — Source D),
    //   Parallelogram (square is technically a parallelogram — hierarchy confusion)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(15% 15%, 85% 15%, 85% 85%, 15% 85%)',
        bgColor: '#dbeafe',
        label: 'Square'
      },
      correctLabel: 'Square',
      tier: 2,
      mode: 'diagram-to-name',
      options: ['Square', 'Rectangle', 'Rhombus', 'Parallelogram'],
      misconceptionTag: 'square-not-rectangle',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Square</strong></p>
          <div class="exp-definition"><strong>Square</strong> — a quadrilateral with FOUR EQUAL SIDES and FOUR RIGHT ANGLES. It is simultaneously: a rectangle (4 right angles), a rhombus (4 equal sides), and a parallelogram (2 pairs of parallel sides).</div>
          <div class="exp-reason"><strong>The hierarchy:</strong> Square is the MOST SPECIFIC type. A square is a special rectangle (it has all 4 right angles PLUS all 4 sides equal). A square is also a special rhombus (all 4 sides equal PLUS all 4 angles are 90°). When all conditions are met, we use the most specific name: Square.</div>
          <div class="exp-wrong"><strong>Why not Rectangle?</strong> This shape IS also a rectangle — but "Rectangle" is the less specific name. All 4 sides are equal here, which makes it the special case: a Square. We always prefer the most specific accurate name.</div>
        </div>
      `,
      feedbackOnSkip: 'Square: all 4 sides equal AND all 4 angles 90° — the most specific quadrilateral.'
    },

    // ============================================================
    // ROUND 7: SQUARE — Tier 3 (property-to-name)
    // Property list: "4 equal sides, 4 right angles, diagonals equal and bisect at 90°"
    // Pick the correct name from 4 options (no diagram shown).
    // Target misconception: square-not-rhombus
    // Source A (Fujita 2007): 44% of learners studied answered "rhombus" for a shape
    // with all sides equal — not checking the right-angle property.
    // Distractors: Rhombus (4 equal sides matches, but no right angles in a rhombus),
    //   Rectangle (4 right angles + equal diagonals, but sides not all equal in a non-square rect),
    //   Parallelogram (broadest type — students fall back to this as a "safe" answer)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(15% 15%, 85% 15%, 85% 85%, 15% 85%)',
        bgColor: '#dbeafe',
        label: 'Square'
      },
      correctLabel: 'Square',
      tier: 3,
      mode: 'property-to-name',
      propertyList: '4 equal sides, 4 right angles, diagonals equal and bisect each other at 90°',
      options: ['Square', 'Rhombus', 'Rectangle', 'Parallelogram'],
      misconceptionTag: 'square-not-rhombus',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Square</strong></p>
          <div class="exp-definition"><strong>Square</strong> — the only quadrilateral with BOTH: all 4 sides equal AND all 4 angles equal to 90°. When you see both of those properties together, it must be a Square.</div>
          <div class="exp-reason"><strong>Eliminate using properties:</strong> Rhombus has 4 equal sides but angles are NOT all 90° (they are acute and obtuse). Rectangle has 4 right angles but NOT all 4 sides equal. Parallelogram has neither all-equal sides nor all-right angles guaranteed. Only Square satisfies ALL three listed properties simultaneously.</div>
          <div class="exp-wrong"><strong>Why not Rhombus?</strong> A rhombus does have 4 equal sides — that matches. But the property list also says "4 right angles". A rhombus does NOT have right angles (it has pointed acute and obtuse corners). Adding "4 right angles" to a rhombus gives you a Square.</div>
        </div>
      `,
      feedbackOnSkip: '4 equal sides + 4 right angles + equal diagonals bisecting at 90° = Square.'
    },

    // ============================================================
    // ROUND 8: RHOMBUS — Tier 3 (property-to-name)
    // Property list: "4 equal sides, opposite angles equal, diagonals bisect at 90° but NOT equal"
    // Pick the correct name from 4 options (no diagram shown).
    // Target misconception: square-not-rhombus (distinguishing rhombus from square)
    // Source A (Fujita 2007): the critical property separating rhombus from square is
    // that rhombus diagonals are NOT equal — students rarely know this.
    // Distractors: Square (4 equal sides matches — students who ignored "not equal diagonals"),
    //   Kite (both have perpendicular diagonals — this is the key kite-vs-rhombus property),
    //   Parallelogram (rhombus IS a parallelogram — students may over-generalise)
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(50% 5%, 97% 50%, 50% 95%, 3% 50%)',
        bgColor: '#dbeafe',
        label: 'Rhombus'
      },
      correctLabel: 'Rhombus',
      tier: 3,
      mode: 'property-to-name',
      propertyList: '4 equal sides, opposite angles equal (but NOT 90°), diagonals bisect each other at 90° but diagonals are NOT equal in length',
      options: ['Rhombus', 'Square', 'Kite', 'Parallelogram'],
      misconceptionTag: 'square-not-rhombus',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Rhombus</strong></p>
          <div class="exp-definition"><strong>Rhombus</strong> — all 4 sides equal, opposite angles equal but the angles are NOT 90°. Diagonals bisect each other at right angles (90°) but the two diagonals have DIFFERENT lengths.</div>
          <div class="exp-reason"><strong>The decisive clue:</strong> "Angles NOT 90°" immediately rules out Square and Rectangle. "Diagonals bisect at 90°" is shared by rhombus and square — but "diagonals NOT equal" rules out Square (a square has equal diagonals). "All 4 sides equal" rules out Kite (kite has two pairs of adjacent equal sides, not all four equal).</div>
          <div class="exp-wrong"><strong>Why not Square?</strong> A square has 4 equal sides AND 4 right angles AND equal diagonals. The property list here says "NOT 90° angles" and "NOT equal diagonals" — those two exclusions rule out Square. What remains is Rhombus.</div>
        </div>
      `,
      feedbackOnSkip: 'Rhombus: 4 equal sides, perpendicular diagonals, but angles NOT 90° and diagonals NOT equal.'
    },

    // ============================================================
    // ROUND 9: PARALLELOGRAM — Tier 3 (property-to-name)
    // Property list: "opposite sides parallel and equal, opposite angles equal, diagonals bisect each other (but NOT at 90° and NOT equal)"
    // Pick the correct name from 4 options (no diagram shown).
    // Target misconception: rhombus-not-parallelogram + parallelogram-prototype
    // Source B (Avcu 2014): students treat parallelogram as a separate standalone category,
    // not recognising that rhombus/rectangle/square are special parallelograms.
    // This round uses the BASE CASE parallelogram (no extra constraints) to anchor the hierarchy.
    // Distractors: Rectangle (has parallel sides but also right angles — not stated here),
    //   Rhombus (has parallel sides but also all-equal sides — not stated here),
    //   Trapezium (only one pair parallel — contradicts "both pairs parallel")
    // ============================================================
    {
      quadShape: {
        clipPath: 'polygon(20% 10%, 100% 10%, 80% 90%, 0% 90%)',
        bgColor: '#dbeafe',
        label: 'Parallelogram'
      },
      correctLabel: 'Parallelogram',
      tier: 3,
      mode: 'property-to-name',
      propertyList: 'opposite sides parallel and equal in length, opposite angles equal, consecutive angles add to 180°, diagonals bisect each other (but NOT at 90° and NOT necessarily equal)',
      options: ['Parallelogram', 'Rectangle', 'Rhombus', 'Trapezium'],
      misconceptionTag: 'rhombus-not-parallelogram',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Parallelogram</strong></p>
          <div class="exp-definition"><strong>Parallelogram</strong> — two pairs of opposite parallel sides; opposite sides equal; opposite angles equal; consecutive angles supplementary (add to 180°). The MOST GENERAL special quadrilateral category.</div>
          <div class="exp-reason"><strong>Why not Rectangle or Rhombus?</strong> Rectangle is a parallelogram WITH 4 right angles — the property list does not say right angles. Rhombus is a parallelogram WITH all sides equal — the property list does not say all sides equal. When neither of those extra constraints applies, the name is simply Parallelogram.</div>
          <div class="exp-wrong"><strong>Why not Trapezium?</strong> A trapezium has only ONE pair of parallel sides. The property list says BOTH pairs of opposite sides are parallel. One pair vs. two pairs is the definitive difference between trapezium and parallelogram.</div>
        </div>
      `,
      feedbackOnSkip: 'Parallelogram: both pairs of opposite sides parallel and equal — the base case of the family.'
    }
  ]
};
```

---

## 5. CSS Quadrilateral Diagram (MANDATORY)

The quadrilateral diagram is drawn entirely in CSS — no SVG, no canvas, no external images. Use a single `div` element with `clip-path: polygon(...)` to form the shape. For Tier 1 (name-to-diagram), four shape tiles are shown simultaneously as clickable options. For Tier 2 and Tier 3, one shape tile is shown as the question stimulus.

### Diagram Structure (Tier 2 and Tier 3 — single diagram panel)

```html
<div id="quad-diagram" class="quad-diagram-container">
  <!-- Quadrilateral body — clip-path set dynamically from round.quadShape.clipPath -->
  <div class="quad-body" id="quad-body"></div>
</div>
```

### Tile Structure (Tier 1 — four clickable shape tiles)

```html
<div id="shape-tiles-panel" class="shape-tiles-panel">
  <!-- 4 clickable shape tiles — generated dynamically each Tier 1 round -->
  <!-- Each tile is a button wrapping a .quad-body div -->
  <button class="shape-tile-btn option-btn"
          data-testid="option-0"
          data-value="Trapezium"
          aria-label="Trapezium">
    <div class="quad-body-tile" style="clip-path: polygon(20% 10%, 80% 10%, 100% 90%, 0% 90%); background: #dbeafe;"></div>
  </button>
  <!-- ... option-1, option-2, option-3 ... -->
</div>
```

### CSS Quadrilateral Rendering Rules

For Tier 2 and 3: the diagram body is drawn by setting `clip-path` from `round.quadShape.clipPath`:
```javascript
const body = document.getElementById('quad-body');
body.style.clipPath = round.quadShape.clipPath;
body.style.background = round.quadShape.bgColor || '#dbeafe';
```

For Tier 1: generate four tile buttons. The tile order is randomised each round — the correct tile (quadShape) is inserted at a random position among the three distractorShapes:
```javascript
function renderTier1Tiles(round) {
  const tilesPanel = document.getElementById('shape-tiles-panel');
  tilesPanel.innerHTML = '';
  // Build array of 4 shapes (correct + 3 distractors), shuffle order
  const allShapes = [
    { ...round.quadShape, isCorrect: true },
    ...round.distractorShapes.map(s => ({ ...s, isCorrect: false }))
  ];
  shuffleArray(allShapes); // Fisher-Yates shuffle
  allShapes.forEach((shape, idx) => {
    const btn = document.createElement('button');
    btn.className = 'shape-tile-btn option-btn';
    btn.setAttribute('data-testid', `option-${idx}`);
    btn.setAttribute('data-value', shape.label); // aria-value is the shape name
    btn.setAttribute('aria-label', shape.label);
    const tile = document.createElement('div');
    tile.className = 'quad-body-tile';
    tile.style.clipPath = shape.clipPath;
    tile.style.background = shape.bgColor;
    btn.appendChild(tile);
    btn.addEventListener('click', () => handleOptionClick(shape.label));
    tilesPanel.appendChild(btn);
  });
}
```

**IMPORTANT:** For Tier 1, the correct answer is `round.correctLabel` (e.g. 'Trapezium'). The `data-value` attribute on the correct tile button MUST equal `round.correctLabel`. Validation: `selectedLabel === round.correctLabel`.

### Clip-Path Values per Quadrilateral Type

| Shape | clip-path polygon() | Visual notes |
|-------|---------------------|--------------|
| **Trapezium** | `polygon(20% 10%, 80% 10%, 100% 90%, 0% 90%)` | Top narrower than bottom, one pair parallel |
| **Parallelogram** | `polygon(20% 10%, 100% 10%, 80% 90%, 0% 90%)` | Leaning rectangle, both pairs parallel |
| **Rectangle** | `polygon(0% 20%, 100% 20%, 100% 80%, 0% 80%)` | Standard right-angle rectangle, landscape |
| **Square** | `polygon(15% 15%, 85% 15%, 85% 85%, 15% 85%)` | Equal-side square, upright |
| **Rhombus** | `polygon(50% 5%, 97% 50%, 50% 95%, 3% 50%)` | Symmetric diamond, all equal sides |
| **Kite** | `polygon(50% 5%, 90% 40%, 50% 95%, 10% 40%)` | Asymmetric diamond — taller below mid-point than above |

These clip-path values MUST be used consistently across all rounds where a shape appears (as the question diagram or as a Tier 1 tile option). Do not invent new values for a shape that already appears in this table.

### CSS

```css
.quad-diagram-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 16px;
}

.quad-body {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #dbeafe;
  /* clip-path set dynamically per round */
}

.shape-tiles-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 auto 16px;
  max-width: 340px;
}

.shape-tile-btn {
  background: white;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.shape-tile-btn:hover {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #bfdbfe;
}

.shape-tile-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quad-body-tile {
  width: 90px;
  height: 90px;
  /* clip-path and background set dynamically */
}
```

**Tier visibility rules:**
- Tier 1 rounds: show `#shape-tiles-panel`, hide `#quad-diagram` panel, hide text option buttons
- Tier 2 rounds: show `#quad-diagram`, hide `#shape-tiles-panel`, show text option buttons
- Tier 3 rounds: hide BOTH `#quad-diagram` AND `#shape-tiles-panel`, show text option buttons only (stimulus is propertyList text)

---

## 6. Play Area Layout

The play area (`#gameContent`) has four layers; visibility is toggled per tier:

```
┌──────────────────────────────────────────────────────┐
│  #quad-diagram-panel  (Tier 2 only)                  │
│  CSS-drawn quadrilateral: clip-path polygon()         │
│  Updated dynamically each round via JS               │
│  Hidden for Tier 1 (tiles shown instead)             │
│  Hidden for Tier 3 (no diagram — property text only) │
├──────────────────────────────────────────────────────┤
│  #shape-tiles-panel  (Tier 1 only)                   │
│  2×2 grid of 4 clickable CSS shape tiles             │
│  Generated dynamically with shuffled order           │
│  Hidden for Tier 2 and Tier 3                        │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)         │
│  Question text — driven by round.mode:               │
│    Tier 1: "A [name] has [keyProperty]. Which shape  │
│            below is a [name]?"                       │
│    Tier 2: "What is the name of this shape?"         │
│    Tier 3: [propertyList text displayed as question] │
│            + "Which quadrilateral has these          │
│              properties?"                            │
│                                                      │
│  Four MCQ buttons (.option-btn) — Tier 2 and Tier 3: │
│  [ Option A ]  [ Option B ]  [ Option C ]  [ Option D ] │
│  data-testid="option-0/1/2/3", data-value="<label>" │
│  min-height: 44px; min-width: 44px (accessibility)  │
│  (For Tier 1: buttons are the shape tile buttons     │
│   in #shape-tiles-panel — no text buttons shown)     │
│                                                      │
│  #feedback-text                                      │
│  aria-live="polite" role="status"                    │
│  data-testid="feedback-text"                         │
│  (hidden by default — brief correct/skip message)   │
├──────────────────────────────────────────────────────┤
│  #explanation-panel  (hidden by default)             │
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

**Tier mode indicator:** Each round shows a small mode indicator above the stimulus (e.g., "Find the shape", "Name this shape", "Name from properties") so the learner knows which direction the matching goes.

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

5. Set tier/mode visibility:
     if (round.mode === 'name-to-diagram'):
       — hide #quad-diagram-panel, show #shape-tiles-panel, hide text #option-buttons
       — set question text: "A [round.correctLabel] has [round.keyProperty]. Which shape below is a [round.correctLabel]?"
       — call renderTier1Tiles(round)
     if (round.mode === 'diagram-to-name'):
       — show #quad-diagram-panel, hide #shape-tiles-panel, show text #option-buttons
       — set quad-body clip-path from round.quadShape.clipPath and bgColor
       — set question text: "What is the name of this shape?"
       — render 4 text option buttons from round.options[]
     if (round.mode === 'property-to-name'):
       — hide #quad-diagram-panel, hide #shape-tiles-panel, show text #option-buttons
       — set question text: [round.propertyList] + "\nWhich quadrilateral has these properties?"
       — render 4 text option buttons from round.options[]

6. Show mode indicator label:
     'name-to-diagram' → "Find the shape"
     'diagram-to-name' → "Name this shape"
     'property-to-name' → "Name from properties"

7. For text buttons (Tier 2 and 3): each button MUST have ALL of:
     class="option-btn"
     data-testid="option-N"    (N = 0, 1, 2, 3 — positional index)
     data-value="<label>"      (exact string matching correctLabel format)
     textContent = label string
   CSS: min-height: 44px; min-width: 44px

8. Hide #feedback-text, hide #explanation-panel
9. Enable all option buttons (remove disabled attribute)
10. progressBar.setRound(roundNumber)
11. syncDOMState()
```

### 7.3 handleOptionClick(selectedLabel)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedLabel === round.correctLabel)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'quad_correct_first' : 'quad_correct_second'
   - if (attemptsThisRound === 1): gameState.totalFirstAttemptCorrect++; gameState.score += 20
   - else: gameState.score += 10  (partial credit for correct on second attempt)
   - FeedbackManager.sound('correct')
   - FeedbackManager.playDynamicFeedback('correct', gameState.score)
   - syncDOMState()
   - Show #feedback-text: "Correct! " + round.correctLabel
     (aria-live="polite" ensures screen-reader announcement)
   - After 1200ms: hide #feedback-text; advanceRound()
   - gameState.isProcessing = false

7. else (wrong):
   - Track event: 'quad_incorrect'
   - FeedbackManager.sound('incorrect')
   - if (attemptsThisRound === 1):
       — inject round.explanationHtml into #explanation-panel via innerHTML
       — show #explanation-panel (panel.classList.add('visible'))
       — enable got-it-btn and skip-round-btn
       — gameState.isProcessing = false
       — (wait for user action — do NOT auto-advance)
   - else (attemptsThisRound === 2):
       — Track event: 'quad_skipped'
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
1. Track event: 'quad_skipped'
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
    7–9  → 3★   "Excellent! You matched all the quadrilaterals correctly."
    5–6  → 2★   "Well done! You matched most quadrilaterals correctly."
    0–4  → 1★   "Keep practising! Quadrilateral properties get clearer over time."
- Send postMessage game_complete:
    window.parent.postMessage({
      type: 'game_complete',
      gameId: 'geo-quad-match',
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
- transitionScreen.show({
    title: 'Matched!',
    subtitle: 'You matched all 9 quadrilaterals.',
    icons: ['◆'],
    buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
  })
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
      title: 'Match That Quadrilateral',
      subtitle: 'Find shapes, name shapes, or name from properties — 9 rounds',
      icons: ['◆'],
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

### 8.5 nextRound() helper

```javascript
function nextRound() {
  if (gameState.currentRound < gameState.totalRounds) {
    renderRound(gameState.currentRound + 1);
  }
}
window.nextRound = nextRound;
```

---

## 9. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests. Use `.sound()` and `.playDynamicFeedback()` only.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions. Also add `window.loadRound = function(n) { ... }` — required for test harness `__ralph.jumpToRound()`.
4. **Do NOT use a static diagram** — the quad-body clip-path and shape tiles MUST be redrawn each round from `round.quadShape` and `round.distractorShapes`. A diagram that does not update each round is a bug.
5. **Do NOT deduct lives** — this game is learning mode. `progressBar` is initialised with `totalLives: 0`. Never call `progressBar.loseLife()` or decrement `gameState.lives`.
6. **Do NOT show a game_over transition screen** — `endGame(false)` should never be called. The only endGame call is `endGame(true)` after all 9 rounds complete.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — disable them when the panel shows; re-enable only when "Got it" is clicked.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — buttons must be re-enabled for the second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — generate from `round.options[]` each round for Tier 2 and Tier 3. Options vary per round.
11. **Do NOT omit `data-testid` on option buttons** — each button (text OR shape tile) must have `data-testid="option-0"`, `"option-1"`, `"option-2"`, `"option-3"` (positional) AND `data-value="<label string>"`.
12. **Do NOT omit `data-testid` on explanation panel elements** — `data-testid="explanation-panel"` on container, `data-testid="got-it-btn"`, `data-testid="skip-round-btn"`, `data-testid="feedback-text"`.
13. **Do NOT inject `explanationHtml` as textContent** — use `innerHTML`.
14. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale counts cause the explanation panel to not appear on the first wrong attempt.
15. **Do NOT use `style.display` to toggle the explanation panel** — use `panel.classList.add('visible')` / `panel.classList.remove('visible')` so the CSS slideDown animation fires.
16. **Do NOT show the diagram panel in Tier 3 rounds** — Tier 3 (property-to-name) has NO diagram. Only the propertyList text is the stimulus. Showing a diagram in Tier 3 gives away the answer.
17. **Do NOT show text option buttons in Tier 1 rounds** — Tier 1 (name-to-diagram) uses CSS shape tiles as the answer options, not text buttons. Mixing both is confusing.
18. **Do NOT hardcode the question text** — derive it from `round.mode` and `round.keyProperty` / `round.propertyList` each round.
19. **Do NOT use the same clip-path value for two different quadrilateral types** — refer to the clip-path table in Section 5. Visually identical shapes as distractor tiles defeat the pedagogical goal.
20. **Do NOT shuffle Tier 1 tile order deterministically (e.g., always correct tile first)** — randomise the position of the correct tile among the four tiles each round so the correct option is not always in the same position.
21. **Do NOT omit the `nextRound()` function and `window.nextRound` assignment** — the test harness calls `window.nextRound()` to advance rounds. Missing this breaks all test cases that test round progression.
22. **Do NOT forget to update the mode indicator label each round** — "Find the shape" / "Name this shape" / "Name from properties" must update when the tier changes (R3→R4 transition and R6→R7 transition).

---

## 10. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 (Tier 1) renders with 4 CSS shape tiles and question text referencing "Trapezium".
- **correct-first-attempt-advances**: Selecting the correct option on first attempt shows `#feedback-text` then auto-advances to round 2 after 1200ms.
- **wrong-first-attempt-shows-explanation**: Selecting a wrong option on first attempt shows `#explanation-panel`. Option buttons are disabled while panel is visible.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#explanation-panel` and re-enables option buttons.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round.
- **complete-9-rounds**: Completing all 9 rounds transitions to `data-phase="results"` (victory). No game-over path.
- **no-game-over**: Confirm no game_over transition screen ever appears regardless of answer choices.
- **no-lives-deducted**: Confirm `window.gameState.lives === 0` throughout all 9 rounds.
- **tier-transition-r3-to-r4**: After completing round 3 (Tier 1, shape tiles), round 4 shows a quad diagram + text option buttons (Tier 2). Shape tiles panel is hidden.
- **tier-transition-r6-to-r7**: After completing round 6 (Tier 2, diagram), round 7 shows no diagram + text option buttons (Tier 3). Both diagram and shape-tiles panels are hidden.

### Category: mechanics

- **three-star-threshold**: Answering ≥7/9 correctly on first attempt → 3★.
- **two-star-threshold**: Answering 5 or 6 of 9 correctly on first attempt → 2★.
- **one-star-threshold**: Answering <5/9 correctly on first attempt → 1★.
- **second-attempt-partial-credit**: Correct on second attempt adds 10 points (not 20).
- **isprocessing-guard**: Rapid double-click does not fire two evaluations.
- **tier1-shape-tiles-visible**: In Tier 1 rounds (R1–R3), 4 CSS shape tile buttons are visible with `data-testid="option-0/1/2/3"`.
- **tier2-text-buttons-visible**: In Tier 2 rounds (R4–R6), 4 text option buttons visible, diagram panel visible.
- **tier3-no-diagram**: In Tier 3 rounds (R7–R9), `#quad-diagram-panel` is hidden and `#shape-tiles-panel` is hidden; only text option buttons and property text are shown.
- **question-text-updates-per-mode**: Round 1 question contains "Trapezium"; round 4 question contains "name of this shape"; round 7 stimulus contains property text.

### Category: state-sync

- **data-phase-playing**: After game start, `document.getElementById('app').dataset.phase === 'playing'`.
- **data-round-updates**: `data-round` increments each round (1 through 9).
- **window-gamestate-accessible**: `window.gameState.currentRound` reflects the active round number.
- **total-rounds-is-9**: `window.gameState.totalRounds === 9`.
- **lives-always-zero**: `window.gameState.lives === 0` at all times (learning mode).

### Category: contract

- **option-buttons-have-data-testid**: All four option buttons (or shape tiles) have `data-testid="option-0"` through `"option-3"`.
- **option-buttons-have-data-value**: All buttons have `data-value` matching a label string exactly.
- **explanation-panel-testid**: Element with `data-testid="explanation-panel"` exists in the DOM.
- **got-it-btn-testid**: Element with `data-testid="got-it-btn"` exists in the DOM.
- **skip-round-btn-testid**: Element with `data-testid="skip-round-btn"` exists in the DOM.
- **feedback-text-testid**: Element with `data-testid="feedback-text"` exists in the DOM.
- **window-endgame-defined**: `typeof window.endGame === 'function'`.
- **window-loadround-defined**: `typeof window.loadRound === 'function'`.
- **no-feedbackmanager-init**: HTML source does not contain `FeedbackManager.init(`.
- **quad-body-present**: In Tier 2 rounds, element `#quad-body` exists and has a non-empty clip-path.

---

## 11. Curriculum Alignment

| Curriculum     | Standard/Reference     | Alignment                                                                                                         |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| NCERT Class 8  | Ch 3 §3.4.1            | Trapezium — exactly one pair of parallel sides. R1 (Tier 1) and R9 indirect. |
| NCERT Class 8  | Ch 3 §3.4.2            | Kite — two pairs of adjacent equal sides; diagonal properties. R3 (Tier 1). |
| NCERT Class 8  | Ch 3 §3.4.3–3.4.6      | Parallelogram, rectangle, rhombus, square — full hierarchy. All 9 rounds. |
| NCERT Class 8  | Ch 3 §3.5              | Square as special case of rectangle AND rhombus. R6 (Tier 2), R7 (Tier 3). |
| Common Core    | CCSS 5.G.B.3           | Understand that attributes belonging to a category of two-dimensional figures also belong to all subcategories. Directly addressed in R7–R9 property reasoning. |
| Common Core    | CCSS 5.G.B.4           | Classify two-dimensional figures in a hierarchy based on properties. Tier 3 (property-to-name) directly aligned. |
| Common Core    | CCSS 3.G.A.1           | Recognise rhombuses, rectangles, squares as examples of quadrilaterals. Tier 2 direct recognition. |

**Session prerequisite:** `geo-triangle-sort` (Game 2) — dual-axis classification skill (angle type AND side type simultaneously) is directly extended in this game. A learner who has practised classifying triangles by two axes simultaneously is prepared to map property lists to quadrilateral names.

**Session successor:** `geo-angle-sum` (Game 4) — computes missing angles using the quadrilateral angle sum (360°). Requires quadrilateral vocabulary and property knowledge built in this game.

---

## 12. Misconception Coverage Table

| Misconception | Tag | Rounds | Research Source | Design Response |
|---------------|-----|--------|-----------------|-----------------|
| A square is NOT a rectangle — students treat as mutually exclusive | `square-not-rectangle` | R4, R6, R7 | Fujita & Jones 2007 (Source A); Avcu 2014 (Source B); Maths No Problem 2021 (Source F) | R4: distractor "Square" when correct="Rectangle"; R6: distractor "Rectangle" when correct="Square" + explanationHtml explains hierarchy; R7: property list with "4 right angles" forces square vs rectangle reasoning |
| A square is NOT a rhombus — students reject the identification | `square-not-rhombus` | R5, R7, R8 | Fujita & Jones 2007 (Source A — 44% students in study); Satır & Kurtuluş 2024 (Source D) | R5: distractor "Square" when correct="Rhombus"; R7/R8: Tier 3 property lists explicitly distinguish square from rhombus via right-angle + diagonal-length properties |
| Rhombus is NOT a parallelogram — treated as separate category | `rhombus-not-parallelogram` | R5, R9 | Avcu 2014 (Source B — pre-service teachers also affected); Cybulski 2024 | R5: distractor "Parallelogram" for rhombus; R9: distractors include "Rhombus" when correct = "Parallelogram" (base case) |
| Kite and rhombus are confused (both are diamond-shaped) | `kite-vs-rhombus` | R3, R5, R8 | NCERT Class 8 Ch 3 (Source E — explicit contrast); Ozkan 2017 (Source C) | R3 (Tier 1): shape tile of rhombus as distractor for kite; R5: kite as distractor for rhombus; R8: kite as distractor in property-to-name round |
| Trapezium is not related to the parallelogram family | `trapezium-not-parallelogram` | R1, R9 | Ozkan 2017 (Source C — highest misconception for trapezoid); Satır 2024 (Source D) | R1 (Tier 1): parallelogram as distractor shape tile for trapezium; R9: trapezium as distractor for parallelogram (one pair vs two pairs of parallel sides) |
| Only the "tilted Z" prototype is a parallelogram (rectangles excluded) | `parallelogram-prototype` | R2, R4, R9 | Ozkan 2017 (Source C); Avcu 2014 (Source B) | R2 (Tier 1): shows prototypical "leaning" parallelogram with explanationHtml noting rectangle/square are also parallelograms; R4: distractor "Parallelogram" for rectangle; R9: learner must identify base-case parallelogram from property list alone |

---

## 13. Worked-Example Panel CSS (MANDATORY)

The `explanationHtml` content uses `.exp-card`, `.exp-title`, `.exp-definition`, `.exp-reason`, `.exp-wrong` — the same class names as `geo-triangle-sort` and `geo-angle-id`. These must be styled:

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
    event: eventName,           // 'quad_correct_first' | 'quad_correct_second' | 'quad_incorrect' | 'quad_skipped'
    roundNumber: gameState.currentRound,
    selectedLabel: selectedLabel,
    correctLabel: round.correctLabel,
    tier: round.tier,
    mode: round.mode,
    misconceptionTag: round.misconceptionTag,
    score: gameState.score,
    timestamp: Date.now()
  }
}, '*');

// Send on game end:
window.parent.postMessage({
  type: 'game_complete',
  gameId: 'geo-quad-match',
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
**Description:** Clicking the play button transitions to playing phase with round 1 (Tier 1).
**Steps:** Click the play/start button.
**Assert:** `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND 4 shape tile buttons with `data-testid="option-0/1/2/3"` are visible.

### TC-003: game-flow / correct-first-attempt-advances
**Description:** Correct first attempt shows feedback and advances to round 2.
**Steps:** Start game. On round 1 (Trapezium), click the shape tile button with `data-value="Trapezium"`.
**Assert:** `[data-testid="feedback-text"]` becomes visible with content containing "Correct". After 1200ms, `window.gameState.currentRound === 2`.

### TC-004: game-flow / wrong-first-attempt-shows-explanation
**Description:** Wrong first attempt reveals worked-example panel with buttons disabled.
**Steps:** Start game. On round 1, click any shape tile where `data-value !== "Trapezium"`.
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

### TC-011: mechanics / tier-mode-transition
**Description:** Question type changes correctly across tier transitions.
**Steps:** Start game and observe the interface on rounds 1, 4, and 7.
**Assert:** Round 1: shape tiles visible, text option buttons hidden, question contains "Trapezium". Round 4: diagram panel visible, text option buttons visible, question contains "name of this shape". Round 7: no diagram, no tiles, text option buttons visible, propertyList text visible.

### TC-012: contract / no-feedbackmanager-init
**Description:** Game HTML never calls FeedbackManager.init().
**Steps:** Load game page source.
**Assert:** `document.body.innerHTML` does not contain the string `'FeedbackManager.init('`.

---

## 16. Pedagogical Progression: geo-angle-id → geo-triangle-sort → geo-quad-match → geo-angle-sum

**geo-angle-id** (Bloom L1 — Remember):
- Learner identifies angle types (Acute / Right / Obtuse / Straight / Reflex) from CSS diagrams.
- Output: angle vocabulary; prerequisite for triangle and quadrilateral classification.

**geo-triangle-sort** (Bloom L1–L2 — Remember→Understand):
- Tier 1: angle classification of triangles; Tier 2: side classification; Tier 3: both simultaneously.
- Output: dual-axis property reasoning; prerequisite for multi-property quadrilateral matching.

**geo-quad-match** (Bloom L2 — Understand — THIS GAME):
- Three interaction modes across 9 rounds: name → shape (Tier 1), shape → name (Tier 2), property list → name (Tier 3).
- Explicitly targets the five documented hierarchy-confusion misconceptions: square-not-rectangle, square-not-rhombus, rhombus-not-parallelogram, kite-vs-rhombus, trapezium-not-parallelogram.
- Research basis: Fujita & Jones (2007) document that hierarchical inclusion is the primary difficulty. Students at Van Hiele Level 1 (Analysis) can list properties but cannot accept subclass relations (a square IS a rectangle). This game's Tier 3 property-to-name rounds require exactly this reasoning: "which quadrilateral has ALL of these properties, i.e., is the most specific subclass?"

**geo-angle-sum** (Bloom L3 — Apply):
- Computes missing angles using quadrilateral angle sum (360°).
- Requires complete quadrilateral vocabulary and property knowledge from this game.

**Why the three-tier structure matters (research basis):**
- Source A (Fujita 2007): hierarchical classification is harder than simple name recognition. Tier 1 (name→diagram) builds recognition; Tier 2 (diagram→name) reverses it; Tier 3 (property→name) requires the logical inference step that students most commonly fail.
- Source B (Avcu 2014): pre-service teachers still have hierarchy confusion — even older learners need explicit property-to-class reasoning practice.
- Source C (Ozkan 2017): trapezoid was the least-known type (highest misconception rate) — it appears in R1 (first Tier 1 round) as the priority target.
- Source D (Satır 2024): a square placed on its vertex is not recognised by analysis-level students — NCERT property definitions are more reliable than visual recognition alone.
- Sources A+B+F: the "square is not a rectangle" misconception persists into adulthood. R4 (correct=Rectangle, distractor=Square), R6 (correct=Square, distractor=Rectangle), and R7 (property reasoning) all directly challenge this.

---

## 17. Spec Checklist

- [x] FeedbackManager.init() excluded (PART-017=NO)
- [x] TimerComponent excluded (PART-006=NO) — property matching is a reasoning task; time pressure contradicts worked-example goal
- [x] gameId first field in gameState
- [x] window.gameState, window.endGame, window.restartGame, window.nextRound all assigned
- [x] ProgressBarComponent with slotId: 'mathai-progress-slot', totalLives: 0
- [x] TransitionScreen: start + victory only (no game_over path — learning mode)
- [x] syncDOMState() at all phase transitions (start_screen → playing → results)
- [x] game_complete VICTORY only (no game_over — correct for no-lives game)
- [x] 6 research sources cited inline (Sources A–F)
- [x] Anti-Patterns section included (22 items)
- [x] 12 test cases (TC-001–TC-012)
- [x] CSS quadrilaterals drawn with clip-path: polygon() — no SVG, no canvas
- [x] 9 rounds across 3 tiers (R1–R3 name-to-diagram, R4–R6 diagram-to-name, R7–R9 property-to-name)
- [x] Tier 1 uses CSS shape tile buttons (2×2 grid), Tier 2/3 use text option buttons
- [x] Tier 3 hides diagram entirely — property list text is the sole stimulus
- [x] Mode indicator label shown per round ("Find the shape" / "Name this shape" / "Name from properties")
- [x] Misconception coverage table (6 misconceptions, all 6 sources cited)
- [x] Curriculum alignment table (NCERT Class 8 + Common Core)
- [x] Fallback content with all 9 rounds fully specified
- [x] Clip-path reference table for all 6 quadrilateral types
- [ ] Human review before queuing
