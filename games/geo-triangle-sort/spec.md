# Geo: Sort That Triangle — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Levels 1 and 2 (Remember → Understand) for the skill `geo-triangle-sort`: given a CSS-drawn triangle, the learner classifies it by angle type (acute-angled / right-angled / obtuse-angled), by side type (equilateral / isosceles / scalene), or by both simultaneously. Tier 1 (R1–R3) targets angle classification only (L1 recall of degree ranges learned in geo-angle-id). Tier 2 (R4–R6) targets side classification only (L1 recall of equal-side definitions). Tier 3 (R7–R9) requires dual-axis classification (e.g., "right isosceles", "obtuse scalene") — this is L2 Understand, as learners must coordinate two independent classification systems and recognise that the same triangle is simultaneously a member of both an angle class and a side class. The 4-button MCQ forces recall of vocabulary and explicitly targets six documented misconceptions from research. Worked-example panel on first wrong attempt. Stars awarded by first-attempt accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. No lives — learning mode.
>
> **RESEARCH SOURCES (geometry-session.md, 2026-03-23):**
> - Source A: Lapinid, M.R. (2021) "Students' Geometric Thinking on Triangles: Much Improvement is Needed", Infinity Journal. 30 Grade 9 students; more than half at van Hiele visualisation level; misconceptions on class inclusion — especially that isosceles right triangles and obtuse triangles are not recognised as such. URL: https://www.academia.edu/60644995/
> - Source B: Altıparmak & Gürcan (2021) "Examination of 4th Grade Students' Definitions for Square, Rectangle and Triangle", ERIC EJ1319163. 156 students: 151 of 156 do NOT see equilateral triangles as a subtype of isosceles — the most prevalent misconception found. Only 23/156 drew isosceles triangle correctly. URL: https://files.eric.ed.gov/fulltext/EJ1319163.pdf
> - Source C: Si & Cutugno (2002) "Misconceptions about triangle in Elementary school", Unipa/GRIM. 77 students aged 11–12: 59% draw equilateral prototype; 31% only recognise equilateral-shaped figures as triangles; strong horizontal-base prototype; negligible use of formal classification rules. URL: https://sites.unipa.it/grim/SiCutugnoSpa.PDF
> - Source D: Bočková & Pavlovičová (2024) "Some misconceptions of 9th Grade students about triangles", HAL CERME13. 760 ninth-grade students: 59% do not know triangle inequality; isosceles + equilateral confusion persists through Grade 9; horizontal-base orientation stereotype. URL: https://hal.science/hal-04418359v1/document
> - Source E: NCERT Class 7 Ch 6 (The Triangle and its Properties). Classification by sides (scalene, isosceles, equilateral) and by angles (acute-angled, obtuse-angled, right-angled) are both taught explicitly. Two special triangles (equilateral, isosceles) receive extended treatment in §6.6. URL: https://sathee.iitk.ac.in/ncert-books/class-07/mathematics/chapter-6-the-triangle-and-its-properties/

---

## 1. Game Identity

- **Title:** Sort That Triangle
- **Game ID:** geo-triangle-sort
- **Type:** standard
- **Description:** Students classify CSS-drawn triangles by angle type (acute-angled / right-angled / obtuse-angled), by side type (equilateral / isosceles / scalene), or by both — depending on the tier. 9 rounds across 3 difficulty tiers. Tier 1 (R1–R3): classify by angles only (4 options: Acute-angled, Right-angled, Obtuse-angled + 1 side-class distractor). Tier 2 (R4–R6): classify by sides only (4 options: Equilateral, Isosceles, Scalene + 1 angle-class distractor). Tier 3 (R7–R9): classify by BOTH — question asks "What is the best full description?" with 4 combined-label options (e.g. "Right Isosceles", "Acute Scalene"). MCQ interaction: 4 option buttons per round. No lives — learning mode. Worked-example panel on first wrong attempt; round auto-advances on second wrong attempt. Stars by first-attempt accuracy: ≥7/9 = 3★, ≥5/9 = 2★, else 1★. Targets Class 6–7 primary, Class 9 review. NCERT Ch 6 Class 7.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                   |
| -------- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                              |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                              |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                              |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                              |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                            |
| PART-006 | TimerComponent                | NO              | No timer — triangle classification is a visual reasoning task. Time pressure contradicts the worked-example pedagogical goal.                                                   |
| PART-007 | Game State Object             | YES             | Custom fields: attemptsThisRound, totalFirstAttemptCorrect, isProcessing, gameEnded                                                                                            |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                              |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                              |
| PART-010 | Event Tracking                | YES             | Custom events: triangle_correct_first, triangle_correct_second, triangle_incorrect, triangle_skipped, worked_example_shown, round_complete                                     |
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
| PART-027 | Play Area Construction        | YES             | Layout: CSS-drawn triangle diagram above question label above 4 MCQ buttons; worked-example panel hidden by default, slides in below question on first wrong attempt            |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with trianglePoints, correctLabel, tier, classificationAxis, distractors, misconceptionTag, explanationHtml, feedbackOnSkip                               |
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
  gameId: 'geo-triangle-sort',
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
          "trianglePoints": {
            "type": "string",
            "description": "CSS clip-path polygon() coordinates defining the triangle as percentages, e.g. '50% 0%, 0% 100%, 100% 100%'. The three vertices encode both the angle type and the side proportions. Must be consistent with correctLabel. Use the specific clip-path values defined in Section 5 for each round."
          },
          "correctLabel": {
            "type": "string",
            "description": "The correct classification label. Tier 1 values: 'Acute-angled', 'Right-angled', 'Obtuse-angled'. Tier 2 values: 'Equilateral', 'Isosceles', 'Scalene'. Tier 3 values: compound labels — 'Right Isosceles', 'Acute Scalene', 'Obtuse Isosceles', 'Acute Isosceles', 'Obtuse Scalene', 'Right Scalene'. Must match trianglePoints geometry."
          },
          "tier": {
            "type": "number",
            "enum": [1, 2, 3],
            "description": "Difficulty tier. 1 = classify by angles only (R1–R3). 2 = classify by sides only (R4–R6). 3 = classify by BOTH angles AND sides (R7–R9)."
          },
          "classificationAxis": {
            "type": "string",
            "enum": ["angles", "sides", "both"],
            "description": "What property the learner is asked to classify. 'angles': Tier 1 rounds. 'sides': Tier 2 rounds. 'both': Tier 3 rounds. Drives the question text: Tier 1 → 'What type of triangle is this? (by angles)', Tier 2 → 'What type of triangle is this? (by sides)', Tier 3 → 'What is the best full description of this triangle?'."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. One is correctLabel; 3 are distractors. For Tier 1: drawn from the 3 angle labels + 1 side-class label as a distractor. For Tier 2: drawn from the 3 side labels + 1 angle-class label as a distractor. For Tier 3: all 4 are compound labels (angle+side combinations), one correct. Order must be randomised each round."
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["equilateral-is-isosceles", "prototype-dependence", "obtuse-not-a-triangle", "horizontal-base-only", "right-angle-corner-only", "scalene-looks-wrong", "none"],
            "description": "Primary misconception this round targets. equilateral-is-isosceles: Source B — students do not see equilateral as a subtype of isosceles. prototype-dependence: Sources C+D — student only recognises equilateral-shaped (pointing-up, roughly equal sides) figures as triangles or as a given type. obtuse-not-a-triangle: Sources A+C — student rejects wide obtuse or nearly-flat triangles as 'not a proper triangle'. horizontal-base-only: Sources C+D — student only classifies correctly when base is horizontal (bottom). right-angle-corner-only: Source A — student only sees right angle when one arm is horizontal and one is vertical. scalene-looks-wrong: Source C — student thinks all triangles must have at least 2 equal sides. none: no primary misconception targeted."
          },
          "explanationHtml": {
            "type": "string",
            "description": "HTML string injected into the explanation panel on first wrong attempt. Must include: (1) the correct label clearly stated with definition; (2) the key property that makes this triangle that type; (3) why the chosen distractor does NOT fit; (4) one visual/memory cue for the correct type."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when round auto-advances after second wrong attempt. Name correct label and one defining property. Max 20 words."
          }
        },
        "required": ["trianglePoints", "correctLabel", "tier", "classificationAxis", "options", "misconceptionTag", "explanationHtml", "feedbackOnSkip"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. R1–R3: Tier 1 (angle classification). R4–R6: Tier 2 (side classification). R7–R9: Tier 3 (both). Distribution: R1=Acute-angled, R2=Right-angled, R3=Obtuse-angled, R4=Equilateral, R5=Isosceles, R6=Scalene, R7=Right Isosceles, R8=Obtuse Scalene, R9=Acute Isosceles."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Field names in each round object MUST match the inputSchema: `trianglePoints`, `correctLabel`, `tier`, `classificationAxis`, `options`, `misconceptionTag`, `explanationHtml`, `feedbackOnSkip`.

```javascript
// FIELD NAMES PER SCHEMA: trianglePoints (string), correctLabel (string), tier (number),
// classificationAxis (string), options (array of 4 strings), misconceptionTag (string),
// explanationHtml (string), feedbackOnSkip (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: ACUTE-ANGLED — Tier 1 (angles only, prototypical)
    // All three angles < 90°. Standard equilateral-ish upright shape.
    // 60°-60°-60° equilateral (all acute). Prototypical "textbook" triangle.
    // Target misconception: none (baseline)
    // Distractors: Right-angled (confusion with 90° threshold),
    //   Obtuse-angled (misidentify as wide), Isosceles (axis confusion distractor)
    // ============================================================
    {
      trianglePoints: '50% 5%, 5% 95%, 95% 95%',
      correctLabel: 'Acute-angled',
      tier: 1,
      classificationAxis: 'angles',
      options: ['Acute-angled', 'Right-angled', 'Obtuse-angled', 'Isosceles'],
      misconceptionTag: 'none',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Acute-angled</strong></p>
          <div class="exp-definition"><strong>Acute-angled triangle</strong> — all three interior angles are less than 90°. In this triangle all three angles are 60°.</div>
          <div class="exp-reason"><strong>How to check:</strong> Look at each corner of the triangle. If every corner is "sharper" than a right angle (less than 90°), the triangle is acute-angled. This upright, roughly equal-sided shape is the most common example.</div>
          <div class="exp-wrong"><strong>Why not Right-angled?</strong> A right-angled triangle has exactly one corner that is a perfect square corner (90°). None of the three corners here is a right angle — all are 60°.</div>
        </div>
      `,
      feedbackOnSkip: 'All three angles are 60° — all less than 90° — so this is Acute-angled.'
    },

    // ============================================================
    // ROUND 2: RIGHT-ANGLED — Tier 1 (angles only, prototypical)
    // Exactly one 90° angle. Standard right triangle, horizontal base,
    // vertical right-angle leg. Right-angle square marker shown.
    // Target misconception: right-angle-corner-only
    // Source A (Lapinid 2021): students only recognise right angle when
    // legs are exactly H/V — this round uses a standard H/V to introduce vocab,
    // then R7 (Tier 3) will test a rotated right angle.
    // Distractors: Acute-angled, Obtuse-angled, Scalene (axis confusion)
    // ============================================================
    {
      trianglePoints: '5% 95%, 5% 10%, 95% 95%',
      correctLabel: 'Right-angled',
      tier: 1,
      classificationAxis: 'angles',
      options: ['Acute-angled', 'Right-angled', 'Obtuse-angled', 'Scalene'],
      misconceptionTag: 'right-angle-corner-only',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Right-angled</strong></p>
          <div class="exp-definition"><strong>Right-angled triangle</strong> — exactly one interior angle is 90°. The small square symbol in one corner is the universal marker for a right angle.</div>
          <div class="exp-reason"><strong>How to check:</strong> Look for the square corner marker. If one corner has the small square, the triangle is right-angled. In this triangle the square is at the bottom-left corner.</div>
          <div class="exp-wrong"><strong>Why not Acute-angled?</strong> Acute-angled means ALL angles are less than 90°. Here, one angle is exactly 90° — not less than 90° — so acute-angled does not apply.</div>
        </div>
      `,
      feedbackOnSkip: 'The square corner marker confirms a 90° angle — this is Right-angled.'
    },

    // ============================================================
    // ROUND 3: OBTUSE-ANGLED — Tier 1 (angles only, prototypical)
    // One angle > 90°. Wide flat triangle with an obvious obtuse angle.
    // Horizontal base, apex shifted left to create a wide obtuse angle at top-left.
    // Target misconception: obtuse-not-a-triangle
    // Source C (Si & Cutugno 2002): students with rigid equilateral prototype
    // may reject this wide shape as "not a real triangle" or call it "a line".
    // Distractors: Acute-angled (underestimate angle), Right-angled, Equilateral (axis confusion)
    // ============================================================
    {
      trianglePoints: '8% 85%, 92% 85%, 20% 20%',
      correctLabel: 'Obtuse-angled',
      tier: 1,
      classificationAxis: 'angles',
      options: ['Acute-angled', 'Right-angled', 'Obtuse-angled', 'Equilateral'],
      misconceptionTag: 'obtuse-not-a-triangle',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Obtuse-angled</strong></p>
          <div class="exp-definition"><strong>Obtuse-angled triangle</strong> — exactly one interior angle is greater than 90° (between 90° and 180°). A triangle can only ever have ONE obtuse angle — the other two must be acute.</div>
          <div class="exp-reason"><strong>How to check:</strong> Find the "widest-looking" corner. If it is clearly wider than a right-angle square corner, the triangle is obtuse-angled. The wide, flat shape of this triangle is a clue — the top-left angle is noticeably wider than 90°.</div>
          <div class="exp-wrong"><strong>Why not Acute-angled?</strong> Acute-angled means ALL three angles are less than 90°. Here one angle is clearly greater than 90° — it is visibly wider than a right angle corner.</div>
        </div>
      `,
      feedbackOnSkip: 'The wide top-left corner is greater than 90° — this triangle is Obtuse-angled.'
    },

    // ============================================================
    // ROUND 4: EQUILATERAL — Tier 2 (sides only, prototypical)
    // All three sides equal. Upright standard equilateral shape.
    // Target misconception: equilateral-is-isosceles
    // Source B (Altıparmak & Gürcan 2021): 151 of 156 students do NOT
    // recognise equilateral as a subtype of isosceles — they treat them as
    // mutually exclusive. This round targets the equilateral concept directly.
    // Correct = Equilateral (NOT Isosceles, even though equilateral IS isosceles).
    // The question asks for the MOST SPECIFIC correct label.
    // Distractors: Isosceles (the equilateral-is-isosceles confusion), Scalene, Acute-angled (axis)
    // ============================================================
    {
      trianglePoints: '50% 5%, 6% 93%, 94% 93%',
      correctLabel: 'Equilateral',
      tier: 2,
      classificationAxis: 'sides',
      options: ['Equilateral', 'Isosceles', 'Scalene', 'Acute-angled'],
      misconceptionTag: 'equilateral-is-isosceles',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Equilateral</strong></p>
          <div class="exp-definition"><strong>Equilateral triangle</strong> — all three sides are equal in length, and all three angles are 60°. The tick marks on all three sides show they are equal.</div>
          <div class="exp-reason"><strong>How to check:</strong> Count the tick marks on the sides. Three tick marks all matching = equilateral. One pair matching + one different = isosceles. No matches = scalene.</div>
          <div class="exp-wrong"><strong>Why not Isosceles?</strong> An isosceles triangle has EXACTLY TWO equal sides. An equilateral triangle has THREE equal sides — it is a special case. We call it "Equilateral" (the more specific name), not just "Isosceles".</div>
        </div>
      `,
      feedbackOnSkip: 'Three equal sides (three matching tick marks) — this is Equilateral.'
    },

    // ============================================================
    // ROUND 5: ISOSCELES — Tier 2 (sides only, non-standard orientation)
    // Exactly two equal sides. Rotated/tilted — base is NOT horizontal.
    // Target misconception: horizontal-base-only
    // Source C + D: students only recognise isosceles when the two equal sides
    // form an upright "tent" with a horizontal base — this round tilts the triangle.
    // Distractors: Equilateral (2-equal confused with 3-equal), Scalene, Right-angled (axis)
    // ============================================================
    {
      trianglePoints: '10% 10%, 90% 50%, 10% 90%',
      correctLabel: 'Isosceles',
      tier: 2,
      classificationAxis: 'sides',
      options: ['Equilateral', 'Isosceles', 'Scalene', 'Right-angled'],
      misconceptionTag: 'horizontal-base-only',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Isosceles</strong></p>
          <div class="exp-definition"><strong>Isosceles triangle</strong> — exactly two sides are equal in length. The two equal sides are marked with matching tick marks. The base angles (opposite the equal sides) are also equal.</div>
          <div class="exp-reason"><strong>Orientation trap:</strong> This triangle is rotated — the "base" is on the left side, not at the bottom. An isosceles triangle is still isosceles no matter which way it is turned. Always look for the two matching tick marks, not the orientation.</div>
          <div class="exp-wrong"><strong>Why not Equilateral?</strong> Equilateral means ALL three sides are equal. Here only two sides are equal (two matching tick marks, one different tick mark) — that makes it isosceles, not equilateral.</div>
        </div>
      `,
      feedbackOnSkip: 'Two equal sides (two matching tick marks) regardless of rotation — Isosceles.'
    },

    // ============================================================
    // ROUND 6: SCALENE — Tier 2 (sides only, prototype-busting shape)
    // All three sides different. Irregular, non-equilateral, non-isosceles.
    // Target misconception: scalene-looks-wrong
    // Source C (Si & Cutugno): students think triangles must have at least 2
    // equal sides; scalene "looks wrong" or "is not a real triangle type".
    // Distractors: Isosceles (most-guessed for unequal-looking), Equilateral, Obtuse-angled (axis)
    // ============================================================
    {
      trianglePoints: '20% 10%, 95% 40%, 5% 95%',
      correctLabel: 'Scalene',
      tier: 2,
      classificationAxis: 'sides',
      options: ['Isosceles', 'Scalene', 'Equilateral', 'Obtuse-angled'],
      misconceptionTag: 'scalene-looks-wrong',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Scalene</strong></p>
          <div class="exp-definition"><strong>Scalene triangle</strong> — all three sides are different lengths. No two sides are equal, so there are no matching tick marks — each side has a different number of tick marks (or none).</div>
          <div class="exp-reason"><strong>Key check:</strong> Can you find any two sides that look the same length? If you cannot — if all three look different — it is scalene. Scalene triangles are very common. Not all triangles need to have equal sides.</div>
          <div class="exp-wrong"><strong>Why not Isosceles?</strong> Isosceles requires EXACTLY two equal sides with matching tick marks. In this triangle all three sides are different lengths — there are no matching pairs.</div>
        </div>
      `,
      feedbackOnSkip: 'All three sides different (no matching tick marks) — this is Scalene.'
    },

    // ============================================================
    // ROUND 7: RIGHT ISOSCELES — Tier 3 (both axes, rotated)
    // One 90° angle + two equal sides (the two legs of the right angle are equal).
    // Triangle rotated 45° — the right angle is NOT at a bottom corner.
    // Target misconception: right-angle-corner-only (Source A: rotated right angle not recognised)
    // Distractors: Right Scalene (correct angle-type, wrong side-type),
    //   Acute Isosceles (correct side-type, wrong angle-type),
    //   Obtuse Isosceles (wrong on both)
    // ============================================================
    {
      trianglePoints: '50% 5%, 95% 95%, 5% 95%',
      correctLabel: 'Right Isosceles',
      tier: 3,
      classificationAxis: 'both',
      options: ['Right Isosceles', 'Right Scalene', 'Acute Isosceles', 'Obtuse Isosceles'],
      misconceptionTag: 'right-angle-corner-only',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Right Isosceles</strong></p>
          <div class="exp-definition"><strong>Right Isosceles triangle</strong> — exactly one 90° angle (shown by the square marker) AND exactly two equal sides. The two legs meeting at the right angle are the equal sides.</div>
          <div class="exp-reason"><strong>How to verify both axes:</strong> (1) Angles: spot the square corner marker — that confirms right-angled. (2) Sides: look for two tick marks that match — that confirms isosceles. Both conditions are true at the same time.</div>
          <div class="exp-wrong"><strong>Why not Right Scalene?</strong> Right Scalene would mean a right angle + all three sides different. Here two sides are equal (the two legs of the right angle), so "Isosceles" is correct for the sides axis, not "Scalene".</div>
        </div>
      `,
      feedbackOnSkip: 'Square corner = Right-angled; two equal legs = Isosceles. This is a Right Isosceles triangle.'
    },

    // ============================================================
    // ROUND 8: OBTUSE SCALENE — Tier 3 (both axes, wide irregular shape)
    // One angle > 90°, all three sides different. Irregular flat-ish triangle.
    // Target misconception: prototype-dependence
    // Source C (Si & Cutugno): wide, irregular triangles rejected as "not triangles";
    // students who rely on the equilateral prototype are most likely to answer incorrectly.
    // Distractors: Obtuse Isosceles (correct angle, wrong sides),
    //   Acute Scalene (wrong angle, correct sides),
    //   Right Scalene (wrong angle, correct sides)
    // ============================================================
    {
      trianglePoints: '5% 70%, 95% 80%, 40% 15%',
      correctLabel: 'Obtuse Scalene',
      tier: 3,
      classificationAxis: 'both',
      options: ['Obtuse Isosceles', 'Obtuse Scalene', 'Acute Scalene', 'Right Scalene'],
      misconceptionTag: 'prototype-dependence',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Obtuse Scalene</strong></p>
          <div class="exp-definition"><strong>Obtuse Scalene triangle</strong> — one angle greater than 90° (obtuse-angled) AND all three sides different lengths (scalene).</div>
          <div class="exp-reason"><strong>Check each axis separately:</strong> (1) Angles: find the widest corner — it is clearly wider than 90°, so the triangle is obtuse-angled. (2) Sides: the three sides all have different tick marks (or lengths) — no two sides match, so it is scalene. Combine: Obtuse Scalene.</div>
          <div class="exp-wrong"><strong>Why not Obtuse Isosceles?</strong> Obtuse Isosceles would require two equal sides. Look at the tick marks on the three sides — all are different. No equal pairs means scalene, not isosceles.</div>
        </div>
      `,
      feedbackOnSkip: 'Wide obtuse corner + three unequal sides — this is Obtuse Scalene.'
    },

    // ============================================================
    // ROUND 9: ACUTE ISOSCELES — Tier 3 (both axes, non-standard tall shape)
    // All angles < 90°, exactly two equal sides. Tall narrow isosceles triangle.
    // NOT the equilateral-looking prototype — apex is very high and narrow.
    // Target misconception: prototype-dependence + equilateral-is-isosceles
    // Source B + C: narrow isosceles rejected in favour of equilateral label;
    // students who only know the "tent" prototype may misclassify.
    // Distractors: Equilateral (prototype confusion — looks like equilateral to some),
    //   Acute Scalene (right sides type, wrong, because two sides ARE equal),
    //   Obtuse Isosceles (correct sides type, wrong angle-type)
    // ============================================================
    {
      trianglePoints: '50% 2%, 20% 98%, 80% 98%',
      correctLabel: 'Acute Isosceles',
      tier: 3,
      classificationAxis: 'both',
      options: ['Acute Isosceles', 'Equilateral', 'Acute Scalene', 'Obtuse Isosceles'],
      misconceptionTag: 'equilateral-is-isosceles',
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Acute Isosceles</strong></p>
          <div class="exp-definition"><strong>Acute Isosceles triangle</strong> — all three angles are less than 90° (acute-angled) AND exactly two sides are equal (isosceles). The two equal sides are the tall "legs" going up to the apex.</div>
          <div class="exp-reason"><strong>Check each axis:</strong> (1) Angles: all three corners are clearly "sharp" — all less than 90°, so acute-angled. (2) Sides: the two tall sides going to the apex have matching tick marks; the base is shorter and different — so two equal sides = isosceles.</div>
          <div class="exp-wrong"><strong>Why not Equilateral?</strong> Equilateral means ALL three sides equal. Here the base is visibly shorter than the two legs — only two sides match (the legs), not all three. That makes it isosceles, not equilateral.</div>
        </div>
      `,
      feedbackOnSkip: 'All angles sharp (acute) + two equal legs — this is Acute Isosceles.'
    }
  ]
};
```

---

## 5. CSS Triangle Diagram (MANDATORY)

The triangle diagram is drawn entirely in CSS — no SVG, no canvas, no external images. Use a single `div` element with `clip-path: polygon(...)` to form the triangle shape, plus overlay `div` elements for tick marks (side equality markers) and the right-angle square marker.

### Diagram Structure

```html
<div id="triangle-diagram" class="triangle-diagram-container">
  <!-- Triangle body — clip-path set dynamically from round.trianglePoints -->
  <div class="triangle-body" id="triangle-body"></div>
  <!-- Tick mark overlays (side equality markers) — set dynamically per round -->
  <div class="tick-marks-layer" id="tick-marks-layer"></div>
  <!-- Right-angle square marker (only for right-angled rounds) -->
  <div class="right-angle-marker" id="triangle-right-angle-marker" style="display:none;"></div>
</div>
```

### CSS Triangle Rendering Rules

The triangle body is drawn by setting `clip-path` from `round.trianglePoints`:
```javascript
const body = document.getElementById('triangle-body');
body.style.clipPath = `polygon(${round.trianglePoints})`;
```

The right-angle square marker is shown ONLY when `round.correctLabel` contains 'Right' (either 'Right-angled' in Tier 1 or 'Right Isosceles' / 'Right Scalene' in Tier 3):
```javascript
const hasRightAngle = round.correctLabel.includes('Right');
document.getElementById('triangle-right-angle-marker').style.display = hasRightAngle ? 'block' : 'none';
```

Tick marks (side equality indicators) are drawn using small line elements positioned along each side. The number of tick marks on each side encodes equality:
- **Equilateral:** all three sides get one tick mark (same count = all equal)
- **Isosceles:** two sides get one tick mark, one side gets two tick marks
- **Scalene:** three sides get one, two, and three tick marks respectively (all different counts = all unequal)
- **Tier 1 rounds (angles only):** no tick marks shown — classification is by angles alone

```javascript
// Tick mark generation per round.classificationAxis and round.correctLabel
function setTickMarks(round) {
  const layer = document.getElementById('tick-marks-layer');
  layer.innerHTML = '';
  if (round.classificationAxis === 'angles') return; // No tick marks in Tier 1
  // For sides and both: draw tick marks based on side-type
  const sideType = round.correctLabel.includes('Equilateral') ? 'equilateral'
    : (round.correctLabel.includes('Isosceles') ? 'isosceles' : 'scalene');
  drawTickMarks(layer, round.trianglePoints, sideType);
}
```

The `drawTickMarks(layer, trianglePoints, sideType)` function parses the three vertex coordinates from the polygon string, computes midpoints of each side, and renders small `div` lines rotated perpendicular to each side:
- Parse vertices from `trianglePoints` string (split on `,` to get `x1% y1%`, `x2% y2%`, `x3% y3%`)
- For each of the 3 sides, compute midpoint and angle
- Create a `div.tick-mark` at each midpoint, rotated to match the side angle, with count matching the scheme above
- Each tick mark is 8px wide × 2px high with `border-top: 2px solid #1e293b`; stack additional tick marks offset by 4px for 2-tick and 3-tick sides

### CSS

```css
.triangle-diagram-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 16px;
}

.triangle-body {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #dbeafe;
  border: none;
  /* clip-path set dynamically from round.trianglePoints */
  clip-path: polygon(50% 5%, 5% 95%, 95% 95%);
}

.tick-marks-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tick-mark {
  position: absolute;
  transform-origin: center center;
  /* width, height, transform set dynamically */
}

.tick-mark-line {
  width: 10px;
  height: 2px;
  background: #1e293b;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

#triangle-right-angle-marker {
  position: absolute;
  width: 14px;
  height: 14px;
  border-top: 2.5px solid #1e293b;
  border-right: 2.5px solid #1e293b;
  display: none;
  /* Position is set dynamically to the right-angle vertex of each round */
}
```

**Right-angle marker positioning:** For rounds with a right angle, compute the vertex coordinate that forms 90° (from `trianglePoints`) and position the marker at that vertex, rotated to align with the two sides meeting there.

---

## 6. Play Area Layout

The play area (`#gameContent`) has three layers; visibility is toggled via the `hidden` class:

```
┌──────────────────────────────────────────────────────┐
│  #triangle-diagram-panel  (always visible per round)  │
│  CSS-drawn triangle: clip-path polygon + tick marks   │
│  + optional right-angle square marker                 │
│  Updated dynamically each round via JS                │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)          │
│  Question text — driven by classificationAxis:        │
│    Tier 1: "What type of triangle is this? (by angles)" │
│    Tier 2: "What type of triangle is this? (by sides)"  │
│    Tier 3: "What is the best full description?"        │
│                                                       │
│  Four MCQ buttons (.option-btn):                      │
│  [ Option A ]  [ Option B ]  [ Option C ]  [ Option D ] │
│  data-testid="option-0/1/2/3", data-value="<label>"  │
│  min-height: 44px; min-width: 44px (accessibility)    │
│                                                       │
│  #feedback-text                                       │
│  aria-live="polite" role="status"                     │
│  data-testid="feedback-text"                          │
│  (hidden by default — brief correct/skip message)     │
├──────────────────────────────────────────────────────┤
│  #explanation-panel  (hidden by default)               │
│  data-testid="explanation-panel"                      │
│  Appears after FIRST wrong attempt only.              │
│  Contains round.explanationHtml injected via          │
│  innerHTML. Two buttons:                              │
│    [Got it — try again]  data-testid="got-it-btn"    │
│      → re-enables buttons for second attempt         │
│    [Skip this round]  data-testid="skip-round-btn"   │
│      → auto-advances round (no life deduction)       │
└──────────────────────────────────────────────────────┘
```

**Tier label display:** Each round shows a small tier indicator above the triangle (e.g., "By angles", "By sides", "Full description") so the learner knows what axis is being tested. This is driven by `round.classificationAxis`.

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
5. Draw triangle diagram:
     a. Set triangle-body clip-path: triangle-body.style.clipPath = `polygon(${round.trianglePoints})`
     b. Set tick marks: setTickMarks(round) — based on classificationAxis + correctLabel side-type
     c. Show/hide right-angle marker: based on round.correctLabel.includes('Right')
        Position marker at the right-angle vertex (compute from trianglePoints)
6. Set question text based on round.classificationAxis:
     'angles' → "What type of triangle is this? (by angles)"
     'sides'  → "What type of triangle is this? (by sides)"
     'both'   → "What is the best full description of this triangle?"
7. Set tier indicator label above diagram:
     tier 1 → "By angles"
     tier 2 → "By sides"
     tier 3 → "Full description"
8. Render option buttons: clear #option-buttons, create 4 buttons from round.options[]
   Each button MUST have ALL of:
     class="option-btn"
     data-testid="option-N"    (N = 0, 1, 2, 3 — positional index)
     data-value="<label>"      (exact string matching correctLabel format)
     textContent = label string
   CSS: min-height: 44px; min-width: 44px
9. Hide #feedback-text, hide #explanation-panel
10. Enable all option buttons (remove disabled attribute)
11. progressBar.setRound(roundNumber)
12. syncDOMState()
```

### 7.3 handleOptionClick(selectedLabel)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedLabel === round.correctLabel)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'triangle_correct_first' : 'triangle_correct_second'
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
   - Track event: 'triangle_incorrect'
   - FeedbackManager.sound('incorrect')
   - if (attemptsThisRound === 1):
       — inject round.explanationHtml into #explanation-panel via innerHTML
       — show #explanation-panel (panel.classList.add('visible'))
       — enable got-it-btn and skip-round-btn
       — gameState.isProcessing = false
       — (wait for user action — do NOT auto-advance)
   - else (attemptsThisRound === 2):
       — Track event: 'triangle_skipped'
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
1. Track event: 'triangle_skipped'
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
    7–9  → 3★   "Excellent! You classified every triangle correctly."
    5–6  → 2★   "Well done! You identified most triangle types correctly."
    0–4  → 1★   "Keep practising! Triangle classification gets easier with time."
- Send postMessage game_complete:
    window.parent.postMessage({
      type: 'game_complete',
      gameId: 'geo-triangle-sort',
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
    title: 'Well done!',
    subtitle: 'You sorted all 9 triangles.',
    icons: ['🔺'],
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
      title: 'Sort That Triangle',
      subtitle: 'By angles, sides, or both — 9 rounds',
      icons: ['🔺'],
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
4. **Do NOT use static HTML for the triangle diagram** — the diagram MUST be redrawn each round from `round.trianglePoints`, `round.classificationAxis`, and `round.correctLabel`. A diagram that does not update each round is a bug.
5. **Do NOT deduct lives** — this game is learning mode. `progressBar` is initialised with `totalLives: 0`. Never call `progressBar.loseLife()` or decrement `gameState.lives`.
6. **Do NOT show a game_over transition screen** — `endGame(false)` should never be called. The only endGame call is `endGame(true)` after all 9 rounds complete.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — disable them when the panel shows; re-enable only when "Got it" is clicked.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — buttons must be re-enabled for the second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — generate from `round.options[]` each round. Options vary per round (each round has a specific set of 4 labels).
11. **Do NOT omit `data-testid` on option buttons** — each button must have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"`, `data-testid="option-3"` (positional) AND `data-value="<label string>"`.
12. **Do NOT omit `data-testid` on explanation panel elements** — `data-testid="explanation-panel"` on container, `data-testid="got-it-btn"`, `data-testid="skip-round-btn"`, `data-testid="feedback-text"`.
13. **Do NOT inject `explanationHtml` as textContent** — use `innerHTML`.
14. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale counts cause the explanation panel to not appear.
15. **Do NOT use `style.display` to toggle the explanation panel** — use `panel.classList.add('visible')` / `panel.classList.remove('visible')` so the CSS slideDown animation fires.
16. **Do NOT show tick marks in Tier 1 (angles-only) rounds** — tick marks are only drawn when `classificationAxis` is `'sides'` or `'both'`. Showing side markers in Tier 1 gives away the side type and reduces cognitive demand.
17. **Do NOT show the right-angle square marker on non-right-angle rounds** — check `round.correctLabel.includes('Right')` before showing the marker.
18. **Do NOT hardcode the question text** — derive it from `round.classificationAxis` each round: `'angles'` → angle question, `'sides'` → sides question, `'both'` → full description question.
19. **Do NOT mix up the correctLabel format across tiers** — Tier 1 labels have a hyphen ("Acute-angled"), Tier 2 labels are single words ("Equilateral"), Tier 3 labels are two words without a hyphen ("Right Isosceles"). The string equality check `selectedLabel === round.correctLabel` is case-sensitive and format-sensitive.
20. **Do NOT omit the tier indicator label** — show "By angles", "By sides", or "Full description" above the diagram so the learner knows which axis is being tested.

---

## 10. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with triangle diagram and 4 option buttons.
- **correct-first-attempt-advances**: Selecting the correct option on first attempt shows `#feedback-text` then auto-advances to round 2 after 1200ms.
- **wrong-first-attempt-shows-explanation**: Selecting a wrong option on first attempt shows `#explanation-panel`. Option buttons are disabled while panel is visible.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#explanation-panel` and re-enables option buttons.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round.
- **correct-second-attempt-advances**: Selecting correct on second attempt advances after 1200ms.
- **wrong-second-attempt-auto-advances**: Second wrong attempt auto-advances the round with `feedbackOnSkip` note.
- **complete-9-rounds**: Completing all 9 rounds transitions to `data-phase="results"` (victory). No game-over path.
- **no-game-over**: Confirm no game_over transition screen ever appears regardless of answer choices.
- **no-lives-deducted**: Confirm `window.gameState.lives === 0` throughout all 9 rounds.
- **tier-transition-r3-to-r4**: After completing round 3 (Tier 1, angles), round 4 shows Tier 2 (sides) question text and tick marks appear on the triangle.
- **tier-transition-r6-to-r7**: After completing round 6 (Tier 2, sides), round 7 shows Tier 3 (both) question text with compound-label options.

### Category: mechanics

- **three-star-threshold**: Answering ≥7/9 correctly on first attempt → 3★.
- **two-star-threshold**: Answering 5 or 6 of 9 correctly on first attempt → 2★.
- **one-star-threshold**: Answering <5/9 correctly on first attempt → 1★.
- **second-attempt-partial-credit**: Correct on second attempt adds 10 points (not 20).
- **isprocessing-guard**: Rapid double-click does not fire two evaluations.
- **diagram-updates-each-round**: Triangle diagram (clip-path) changes each round to reflect `round.trianglePoints`.
- **tick-marks-absent-tier1**: In Tier 1 rounds (R1–R3), no tick marks are visible on the triangle.
- **tick-marks-present-tier2**: In Tier 2 rounds (R4–R6), tick marks are visible on the triangle sides.
- **right-angle-marker-present-r2**: In round 2 (Right-angled), right-angle square marker is visible.
- **right-angle-marker-absent-r1**: In round 1 (Acute-angled), right-angle square marker is NOT visible.
- **question-text-by-axis**: Round 1 shows angle-classification question; round 4 shows sides-classification question; round 7 shows full-description question.

### Category: state-sync

- **data-phase-playing**: After game start, `document.getElementById('app').dataset.phase === 'playing'`.
- **data-round-updates**: `data-round` increments each round (1 through 9).
- **window-gamestate-accessible**: `window.gameState.currentRound` reflects the active round number.
- **total-rounds-is-9**: `window.gameState.totalRounds === 9`.
- **lives-always-zero**: `window.gameState.lives === 0` at all times (learning mode).

### Category: contract

- **option-buttons-have-data-testid**: All four option buttons have `data-testid="option-0"` through `"option-3"`.
- **option-buttons-have-data-value**: All buttons have `data-value` matching a label string exactly.
- **explanation-panel-testid**: Element with `data-testid="explanation-panel"` exists in the DOM.
- **got-it-btn-testid**: Element with `data-testid="got-it-btn"` exists in the DOM.
- **skip-round-btn-testid**: Element with `data-testid="skip-round-btn"` exists in the DOM.
- **feedback-text-testid**: Element with `data-testid="feedback-text"` exists in the DOM.
- **window-endgame-defined**: `typeof window.endGame === 'function'`.
- **window-loadround-defined**: `typeof window.loadRound === 'function'`.
- **no-feedbackmanager-init**: HTML source does not contain `FeedbackManager.init(`.
- **triangle-body-present**: Element `#triangle-body` exists in the DOM each round.

---

## 11. Curriculum Alignment

| Curriculum     | Standard/Reference     | Alignment                                                                                                         |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| NCERT Class 7  | Ch 6 §6.1              | Classification by sides (scalene, isosceles, equilateral) and by angles (acute, obtuse, right-angled). All 9 rounds. |
| NCERT Class 7  | Ch 6 §6.6              | Two special triangles: equilateral and isosceles — extended properties. R4 (equilateral), R5 (isosceles), R7/R9 (tier 3). |
| NCERT Class 7  | Ch 6 §6.5              | Angle sum property (sum = 180°) — implicit in all rounds: obtuse-angled triangle can only have one obtuse angle. |
| NCERT Class 6  | Ch 12 §12.3            | Preliminary triangle types — scalene, isosceles, equilateral introduced. This game reinforces and extends. |
| Common Core    | CCSS 4.G.A.2           | Classify two-dimensional figures based on properties (right angles, acute, obtuse). Tier 1 directly aligned. |
| Common Core    | CCSS 5.G.B.4           | Classify two-dimensional figures in a hierarchy based on properties. Tier 3 (dual classification) directly aligned. |

**Session prerequisite:** `geo-angle-id` (Game 1) — learners must know the vocabulary Acute / Right / Obtuse before attempting Tier 1 rounds of this game. The angle classification in Tier 1 directly re-uses the vocabulary trained in geo-angle-id.

**Session successor:** `geo-quad-match` (Game 3) — property matching for quadrilaterals builds directly on the two-axis classification skill trained in Tier 3.

---

## 12. Misconception Coverage Table

| Misconception | Tag | Rounds | Research Source | Design Response |
|---------------|-----|--------|-----------------|-----------------|
| Equilateral triangle is NOT isosceles — students treat as mutually exclusive | `equilateral-is-isosceles` | R4, R9 | Altıparmak & Gürcan 2021, Source B (151/156 students) | R4: distractor is "Isosceles" when correct = "Equilateral"; explanationHtml explains equilateral is the MORE SPECIFIC label. R9: distractor is "Equilateral" when correct = "Acute Isosceles" |
| Only equilateral-shaped (upright, equal-sided) figures are recognised as triangles | `prototype-dependence` | R3, R8 | Si & Cutugno 2002 Source C; Bočková 2024 Source D | R3: wide obtuse triangle; R8: irregular flat scalene — both break the equilateral prototype |
| Obtuse-angled triangle is "not a real triangle" — too flat or wide | `obtuse-not-a-triangle` | R3 | Si & Cutugno 2002 Source C; Lapinid 2021 Source A | R3: wide obtuse with explanationHtml confirming it is valid |
| Triangle must have a horizontal base to classify correctly | `horizontal-base-only` | R5 | Si & Cutugno 2002 Source C; Bočková 2024 Source D | R5: isosceles triangle rotated so base is on the left — teaches orientation-invariance |
| Right angle only recognised when one arm is horizontal and one is vertical | `right-angle-corner-only` | R2, R7 | Lapinid 2021 Source A | R2: standard H/V (baseline); R7: right isosceles (Tier 3) — right angle from both classification axes simultaneously |
| Scalene is wrong / unusual — triangles must have at least 2 equal sides | `scalene-looks-wrong` | R6 | Si & Cutugno 2002 Source C | R6: irregular scalene with explanationHtml normalising scalene as common |

---

## 13. Worked-Example Panel CSS (MANDATORY)

The `explanationHtml` content uses `.exp-card`, `.exp-title`, `.exp-definition`, `.exp-reason`, `.exp-wrong` — the same class names as `geo-angle-id`. These must be styled:

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
    event: eventName,           // 'triangle_correct_first' | 'triangle_correct_second' | 'triangle_incorrect' | 'triangle_skipped'
    roundNumber: gameState.currentRound,
    selectedLabel: selectedLabel,
    correctLabel: round.correctLabel,
    tier: round.tier,
    classificationAxis: round.classificationAxis,
    misconceptionTag: round.misconceptionTag,
    score: gameState.score,
    timestamp: Date.now()
  }
}, '*');

// Send on game end:
window.parent.postMessage({
  type: 'game_complete',
  gameId: 'geo-triangle-sort',
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
**Steps:** Start game. On round 1 (Acute-angled triangle), click the button with `data-value="Acute-angled"`.
**Assert:** `[data-testid="feedback-text"]` becomes visible with content containing "Correct". After 1200ms, `window.gameState.currentRound === 2`.

### TC-004: game-flow / wrong-first-attempt-shows-explanation
**Description:** Wrong first attempt reveals worked-example panel with buttons disabled.
**Steps:** Start game. On round 1, click any button where `data-value !== "Acute-angled"`.
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

### TC-011: mechanics / tier-question-text
**Description:** Question text changes correctly across tiers.
**Steps:** Start game and observe question text on rounds 1, 4, and 7.
**Assert:** Round 1 question contains "by angles"; round 4 question contains "by sides"; round 7 question contains "full description" (case-insensitive).

### TC-012: contract / no-feedbackmanager-init
**Description:** Game HTML never calls FeedbackManager.init().
**Steps:** Load game page source.
**Assert:** `document.body.innerHTML` does not contain the string `'FeedbackManager.init('`.

---

## 16. Pedagogical Progression: geo-angle-id → geo-triangle-sort → geo-quad-match → geo-angle-sum

**geo-angle-id** (Bloom L1 — Remember):
- Learner sees a CSS-drawn angle and selects the correct type from Acute / Right / Obtuse / Straight / Reflex.
- Output: angle vocabulary + property-based (not appearance-based) classification habit.
- This is the direct prerequisite for geo-triangle-sort Tier 1.

**geo-triangle-sort** (Bloom L1–L2 — Remember→Understand — THIS GAME):
- Tier 1 (L1): re-applies angle vocabulary from geo-angle-id to whole triangles — "acute-angled" = all angles < 90°.
- Tier 2 (L1): adds side vocabulary (equilateral / isosceles / scalene) — new recall targets.
- Tier 3 (L2): requires coordinating BOTH classification axes simultaneously — this is genuine Understand-level reasoning. The learner must see the same triangle as simultaneously satisfying two independent class definitions (a right-angled AND an isosceles triangle). This dual-inclusion recognition is the L2 cognitive demand.
- Research basis: Lapinid 2021 (Source A) documents that many students reach Grade 9 without grasping class inclusion for triangles. Tier 3 directly addresses this.

**geo-quad-match** (Bloom L2 — Understand):
- Learner matches a property list to a quadrilateral type — extends the two-axis classification skill from triangles to quadrilaterals.

**geo-angle-sum** (Bloom L3 — Apply):
- Learner computes missing angles using triangle (180°) and quadrilateral (360°) angle sum properties.
- Requires all vocabulary from geo-angle-id and geo-triangle-sort as prerequisites.

**Why the three-tier structure of this game matters (research basis):**
- Source B (Altıparmak & Gürcan 2021): 97% of 4th-grade students could NOT see equilateral as a special case of isosceles. This requires explicit instruction at Tier 2 level before dual classification in Tier 3 is attempted.
- Source C (Si & Cutugno 2002): prototype-dependent recognition (equilateral = "real" triangle) must be broken before irregular shapes (obtuse scalene) can be classified. Tiers 2 and 3 progressively include non-prototypical shapes.
- Source D (Bočková 2024): misconceptions persist through Grade 9. Even older students have horizontal-base dependence. Non-standard orientations in Tier 2 (R5) directly address this.
- Source E (NCERT Class 7 Ch 6): both classification axes are formally introduced in the same chapter — the game mirrors this structure with Tier 1 (angles) → Tier 2 (sides) → Tier 3 (both), matching the pedagogical sequence of the NCERT curriculum.

---

## 17. Spec Checklist

- [x] FeedbackManager.init() excluded (PART-017=NO)
- [x] TimerComponent excluded (PART-006=NO) — visual classification task; time pressure contradicts worked-example goal
- [x] gameId first field in gameState
- [x] window.gameState, window.endGame, window.restartGame, window.nextRound all assigned
- [x] ProgressBarComponent with slotId: 'mathai-progress-slot', totalLives: 0
- [x] TransitionScreen: start + victory only (no game_over path — learning mode)
- [x] syncDOMState() at all phase transitions (start_screen → playing → results)
- [x] game_complete dual-path: spec has VICTORY only (no game_over — correct for no-lives game)
- [x] 5 research sources cited inline (Sources A–E)
- [x] Anti-Patterns section included (20 items)
- [x] 12 test cases (TC-001–TC-012)
- [x] CSS triangle drawn with clip-path: polygon() — no SVG, no canvas
- [x] 9 rounds across 3 tiers (R1–R3 angles, R4–R6 sides, R7–R9 both)
- [x] Tick marks for side equality shown only in Tier 2 and 3
- [x] Right-angle marker shown only for rounds where correctLabel contains 'Right'
- [x] Question text driven by classificationAxis per round
- [x] Tier label indicator shown above diagram per round
- [x] Misconception coverage table (6 misconceptions, all 5 sources cited)
- [x] Curriculum alignment table (NCERT + Common Core)
- [x] Fallback content with all 9 rounds fully specified
- [ ] Human review before queuing
