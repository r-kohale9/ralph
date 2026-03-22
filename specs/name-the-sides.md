# Name the Sides — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 2 (Understand) for the skill `side-labels`: given a right triangle with a clearly marked reference angle, the learner identifies which side is the hypotenuse, which is opposite to the angle, and which is adjacent. This is a conceptual prerequisite — a learner who cannot label sides cannot select the correct trig ratio. The interaction is deliberately non-numeric: no formulas, no calculation, no timer in rounds 1-6. The difficulty progression (standard orientation → rotated → two-angle comparison) forces the learner to reason from the geometric relationship, not memorise a visual pattern. Interaction type: `label-assignment-dropdown`. Session-planner position: FIRST game in the trig sequence. Successor: `soh-cah-toa-worked-example` (ratio-definition, Bloom L2-L3).

> **SIMPLIFICATION NOTE — No custom SVG interaction.** Ralph's pipeline cannot reliably generate custom click-on-SVG-side interactions. This game uses a simplified but educationally equivalent interaction: a static CSS-drawn right triangle is shown (using borders/transforms), and the three sides are listed below the diagram as "Side A," "Side B," "Side C" with a dropdown (or 3 MCQ buttons) next to each. The learner assigns "Hypotenuse," "Opposite," or "Adjacent" to each side. This preserves the full conceptual demand — the learner still must reason about each side's geometric role — without requiring a custom SVG CDN component.

---

## 1. Game Identity

- **Title:** Name the Sides
- **Game ID:** game_name_the_sides
- **Type:** standard
- **Description:** Students identify the hypotenuse, opposite side, and adjacent side of a right triangle relative to a given reference angle. 9 rounds with three difficulty tiers. No lives system — on first incorrect attempt an explanatory panel reveals the correct definition; on second incorrect attempt the round is skipped. No timer in rounds 1-6; optional 20-second timer in rounds 7-9. Targets Grade 10 / NCERT Ch 8 Section 8.1 / CC HSG-SRT.C.6. Prerequisite: none (first game in trig session). Successor: soh-cah-toa-worked-example.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                     |
| -------- | ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                                |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                                |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                                |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                                |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                              |
| PART-006 | TimerComponent                | NO              | No timer in rounds 1-6. Rounds 7-9 may show a 20s countdown as stretch challenge, but TimerComponent from CDN is NOT used — a simple JS setInterval timer is implemented inline. Do NOT import TimerComponent. |
| PART-007 | Game State Object             | YES             | Custom fields: wrongAttemptsThisRound, skippedRounds, assignedLabels, isProcessing                                                                                               |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                                |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                                |
| PART-010 | Event Tracking                | YES             | Custom events: label_correct, label_incorrect, round_skipped, round_complete                                                                                                     |
| PART-011 | End Game & Metrics            | YES             | Star logic: 3★ = 0 skipped rounds; 2★ = 1-2 skipped rounds; 1★ = 3-4 skipped rounds; 0★ = 5+ skipped rounds                                                                    |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                                |
| PART-013 | Validation Fixed              | YES             | String equality: each side's assigned label === correct label for that side                                                                                                      |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                                |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                                |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                                |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup.                                                                                                           |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                                |
| PART-019 | Results Screen UI             | YES             | Custom metrics: rounds completed, skipped rounds, correct on first attempt                                                                                                       |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                                |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                                |
| PART-022 | Game Buttons                  | YES             | Label buttons: "Hypotenuse", "Opposite", "Adjacent" rendered as clickable chips; selected state highlighted                                                                      |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 9, totalLives: 0 (no lives system — progress bar shows rounds only)                                                                                                 |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory (no game-over — game always completes all 9 rounds)                                                                                                      |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                   |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                           |
| PART-027 | Play Area Construction        | YES             | Layout: triangle diagram (CSS-drawn) + side-labeling panel below. The diagram shows the triangle shape + angle arc + side labels (A, B, C). The panel lists three rows, one per side, each with 3 MCQ buttons. |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with triangleConfig, referenceAngleLabel, sides[3], correctLabels                                                                                            |
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
  totalRounds: 9,
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
  wrongAttemptsThisRound: 0,    // Resets to 0 at start of each round
  skippedRounds: 0,             // Total rounds where second attempt was wrong (skipped)
  assignedLabels: {             // Current assignment state: { sideA: null, sideB: null, sideC: null }
    sideA: null,                // null | 'hypotenuse' | 'opposite' | 'adjacent'
    sideB: null,
    sideC: null
  },
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
          "roundNumber": {
            "type": "number",
            "description": "1-9. Used to select tier: 1-3 = standard orientation, 4-6 = rotated/two-triangle (same angle), 7-9 = two-triangle different angles."
          },
          "tier": {
            "type": "string",
            "enum": ["single-standard", "single-rotated", "two-triangles-same-angle", "two-triangles-different-angles"],
            "description": "Determines which diagram variant is rendered. Rounds 1-3 use single-standard. Rounds 4-6 use single-rotated. Rounds 7-9 use two-triangles-different-angles."
          },
          "triangleConfig": {
            "type": "object",
            "description": "Parameters for rendering the CSS right triangle diagram.",
            "properties": {
              "orientation": {
                "type": "string",
                "enum": ["standard", "rotated-90", "rotated-45", "flipped-horizontal"],
                "description": "Visual orientation of the triangle. 'standard' = right angle at bottom-right, hypotenuse going up-left. 'rotated-90' = right angle at top-right, hypotenuse going down-left. 'rotated-45' = right angle at bottom-left, reference angle at bottom-right. 'flipped-horizontal' = mirror of standard."
              },
              "referenceAngle": {
                "type": "string",
                "enum": ["A", "B"],
                "description": "Which vertex is the reference angle for this round. For two-triangle rounds, the primary triangle uses this value."
              },
              "angleDegrees": {
                "type": "number",
                "description": "The degree value of the reference angle (e.g. 30, 45, 60). Displayed inside the angle arc."
              },
              "vertexLabels": {
                "type": "object",
                "description": "Labels for the three vertices of the triangle.",
                "properties": {
                  "rightAngle": { "type": "string", "description": "Label for the right-angle vertex (always shown with a square symbol). E.g. 'C'." },
                  "referenceVertex": { "type": "string", "description": "Label for the reference angle vertex (shown with arc). E.g. 'A'." },
                  "thirdVertex": { "type": "string", "description": "Label for the third vertex. E.g. 'B'." }
                },
                "required": ["rightAngle", "referenceVertex", "thirdVertex"]
              },
              "sideLabels": {
                "type": "object",
                "description": "Display labels for the three sides shown on the diagram (e.g. 'Side 1', 'AB', 'BC'). Must match the sideKeys in correctLabels.",
                "properties": {
                  "sideA": { "type": "string", "description": "Label displayed on side A in the diagram. E.g. 'AB'." },
                  "sideB": { "type": "string", "description": "Label displayed on side B in the diagram. E.g. 'BC'." },
                  "sideC": { "type": "string", "description": "Label displayed on side C in the diagram. E.g. 'AC'." }
                },
                "required": ["sideA", "sideB", "sideC"]
              }
            },
            "required": ["orientation", "referenceAngle", "angleDegrees", "vertexLabels", "sideLabels"]
          },
          "secondTriangleConfig": {
            "type": "object",
            "description": "Only present for tier 'two-triangles-different-angles'. Same schema as triangleConfig but for the second triangle shown side-by-side. The second triangle has a DIFFERENT reference angle vertex, showing the learner that 'opposite' and 'adjacent' switch roles.",
            "properties": {
              "orientation": { "type": "string" },
              "referenceAngle": { "type": "string" },
              "angleDegrees": { "type": "number" },
              "vertexLabels": { "type": "object" },
              "sideLabels": { "type": "object" }
            }
          },
          "correctLabels": {
            "type": "object",
            "description": "The correct label for each side relative to the reference angle.",
            "properties": {
              "sideA": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] },
              "sideB": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] },
              "sideC": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] }
            },
            "required": ["sideA", "sideB", "sideC"]
          },
          "secondTriangleCorrectLabels": {
            "type": "object",
            "description": "Correct labels for the second triangle (only present when secondTriangleConfig is present).",
            "properties": {
              "sideA": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] },
              "sideB": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] },
              "sideC": { "type": "string", "enum": ["hypotenuse", "opposite", "adjacent"] }
            }
          },
          "explanationOnFirstWrong": {
            "type": "string",
            "description": "Shown in a panel after the learner's first incorrect submission. Must explain all three definitions in terms of the reference angle — NOT just the one the learner got wrong. E.g.: 'Remember: the Hypotenuse is always the longest side (opposite the right angle). The Opposite is the side directly across from angle A. The Adjacent is the side touching angle A (but not the hypotenuse).'"
          },
          "skipMessage": {
            "type": "string",
            "description": "Short message shown when the round is skipped after two wrong attempts. Summarises the correct answer. E.g.: 'No problem — AB is Hypotenuse (longest side), BC is Opposite (across from A), AC is Adjacent (next to A).'"
          },
          "hint": {
            "type": "string",
            "description": "One-line prompt shown above the labeling panel throughout the round. E.g.: 'Angle A is your reference — label each side relative to angle A.'"
          }
        },
        "required": ["roundNumber", "tier", "triangleConfig", "correctLabels", "explanationOnFirstWrong", "skipMessage", "hint"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. Rounds 1-3: single-standard orientation. Rounds 4-6: single-rotated orientation (different orientations per round — rotated-90, rotated-45, flipped-horizontal). Rounds 7-9: two-triangles-different-angles (side-by-side, different reference angle vertices, same triangle shape)."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    // ==========================================================
    // ROUND 1: single-standard — right angle at bottom-right, angle A at bottom-left
    // Tier: single-standard
    // Reference: angle A (bottom-left)
    // AB = hypotenuse (longest side, opposite right angle at C)
    // BC = opposite (directly across from A)
    // AC = adjacent (touching A, not hypotenuse)
    // ==========================================================
    {
      roundNumber: 1,
      tier: 'single-standard',
      triangleConfig: {
        orientation: 'standard',
        referenceAngle: 'A',
        angleDegrees: 30,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      explanationOnFirstWrong:
        'Hypotenuse: the longest side, always opposite the right angle (AC here is NOT the hypotenuse — AB is, because it faces the right angle at C). ' +
        'Opposite: the side directly across from your reference angle A — that is BC. ' +
        'Adjacent: the side touching angle A that is NOT the hypotenuse — that is AC.',
      skipMessage: 'AB = Hypotenuse (longest side, faces the right angle). BC = Opposite (faces angle A). AC = Adjacent (touches angle A).',
      hint: 'Angle A is your reference. Label each side relative to angle A.'
    },

    // ==========================================================
    // ROUND 2: single-standard — same layout, angle at bottom-left, 45°
    // Different angle value — shows that definitions do not depend on angle size
    // ==========================================================
    {
      roundNumber: 2,
      tier: 'single-standard',
      triangleConfig: {
        orientation: 'standard',
        referenceAngle: 'A',
        angleDegrees: 45,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      explanationOnFirstWrong:
        'The angle value (45°) does not change the definitions. ' +
        'Hypotenuse: AB (opposite the right angle at C — always the longest side). ' +
        'Opposite: BC (the side facing angle A, not touching it). ' +
        'Adjacent: AC (the side next to angle A, between A and the right angle).',
      skipMessage: 'AB = Hypotenuse, BC = Opposite (faces A), AC = Adjacent (touches A). Angle size never changes these definitions.',
      hint: 'The definitions depend on position, not angle size. Angle A is your reference.'
    },

    // ==========================================================
    // ROUND 3: single-standard — reference angle is B (bottom-right area), not A
    // Swaps opposite and adjacent compared to rounds 1-2 to prevent positional memorisation
    // Triangle: right angle at C, reference angle now at B
    // AB = hypotenuse (still longest side, faces right angle C)
    // AC = opposite (faces angle B)
    // BC = adjacent (touches angle B, not hypotenuse)
    // ==========================================================
    {
      roundNumber: 3,
      tier: 'single-standard',
      triangleConfig: {
        orientation: 'standard',
        referenceAngle: 'B',
        angleDegrees: 60,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'B', thirdVertex: 'A' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'adjacent', sideC: 'opposite' },
      explanationOnFirstWrong:
        'Now angle B is the reference — this changes which side is opposite and which is adjacent! ' +
        'Hypotenuse: AB is still the longest side (opposite the right angle at C — that never changes). ' +
        'Opposite: AC faces angle B directly (across the triangle from B). ' +
        'Adjacent: BC touches angle B and goes to the right angle C.',
      skipMessage: 'AB = Hypotenuse. AC = Opposite (faces angle B). BC = Adjacent (touches angle B). Changing the reference angle swaps Opposite and Adjacent.',
      hint: 'Angle B is your reference this time — does that change which side is Opposite?'
    },

    // ==========================================================
    // ROUND 4: single-rotated (rotated-90) — triangle rotated 90°
    // Right angle at top-right, reference angle A at bottom-right
    // Forces learner to reason geometrically, not from visual memory
    // AB = hypotenuse (longest, faces right angle)
    // BC = adjacent (touches A, between A and right angle B... wait — vertices relabeled for rotation)
    // Layout: A at bottom, B at top-left, C at top-right (right angle)
    // AB = hypotenuse (faces right angle C)
    // AC = adjacent (touches A, goes to right angle C)
    // BC = opposite (faces A, across from it)
    // ==========================================================
    {
      roundNumber: 4,
      tier: 'single-rotated',
      triangleConfig: {
        orientation: 'rotated-90',
        referenceAngle: 'A',
        angleDegrees: 30,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      explanationOnFirstWrong:
        'The triangle has been rotated — but the rules have not changed. ' +
        'Hypotenuse: AB is still the longest side (it faces the right angle at C, even though it is now pointing diagonally). ' +
        'Opposite: BC is across from angle A. ' +
        'Adjacent: AC is next to angle A (it is the short side connecting A to the right angle at C).',
      skipMessage: 'Rotation does not change the rules. AB = Hypotenuse (faces the right angle). BC = Opposite (faces A). AC = Adjacent (touches A).',
      hint: 'The triangle is rotated — but Hypotenuse, Opposite, and Adjacent still depend on angle A. Look for the right angle square.'
    },

    // ==========================================================
    // ROUND 5: single-rotated (flipped-horizontal)
    // Reference angle A at bottom-right (not bottom-left as in standard)
    // AB = hypotenuse (longest, faces right angle C at top-left)
    // BC = opposite (faces A)
    // AC = adjacent (touches A)
    // ==========================================================
    {
      roundNumber: 5,
      tier: 'single-rotated',
      triangleConfig: {
        orientation: 'flipped-horizontal',
        referenceAngle: 'A',
        angleDegrees: 45,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      explanationOnFirstWrong:
        'The triangle is now a mirror image of the standard position. ' +
        'Hypotenuse: AB still faces the right angle at C — it is the longest side regardless of flip. ' +
        'Opposite: BC faces angle A from across the triangle. ' +
        'Adjacent: AC runs along the bottom from A to the right angle at C.',
      skipMessage: 'Flipping the triangle does not change the labels. AB = Hypotenuse. BC = Opposite. AC = Adjacent (always relative to angle A).',
      hint: 'The triangle is mirrored — find the right-angle square first, then locate angle A.'
    },

    // ==========================================================
    // ROUND 6: single-rotated (rotated-45)
    // Reference angle at B — tests both rotation AND reference-angle switch
    // Right angle at C (top), A at bottom-left, B at bottom-right
    // AB = hypotenuse (faces right angle C)
    // AC = opposite (faces angle B)
    // BC = adjacent (touches angle B)
    // ==========================================================
    {
      roundNumber: 6,
      tier: 'single-rotated',
      triangleConfig: {
        orientation: 'rotated-45',
        referenceAngle: 'B',
        angleDegrees: 60,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'B', thirdVertex: 'A' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'adjacent', sideC: 'opposite' },
      explanationOnFirstWrong:
        'Two things changed: the triangle is rotated AND angle B (not A) is the reference. ' +
        'Hypotenuse: AB faces the right angle at C — always the longest side. ' +
        'Adjacent: BC touches angle B directly (it runs from B to the right angle at C). ' +
        'Opposite: AC is the side across from angle B (it does not touch angle B at all).',
      skipMessage: 'AB = Hypotenuse. BC = Adjacent (touches B). AC = Opposite (faces B). When both orientation AND reference angle change, focus on the right-angle square first.',
      hint: 'Angle B is the reference and the triangle is rotated. Find the right angle square first.'
    },

    // ==========================================================
    // ROUND 7: two-triangles-different-angles
    // Triangle 1: reference angle A. Triangle 2: reference angle B (same shape).
    // Learner labels sides for BOTH triangles.
    // Triangle 1 (ref A): AB=hyp, BC=opp, AC=adj
    // Triangle 2 (ref B): AB=hyp, AC=opp, BC=adj
    // Shows that swapping the reference angle swaps opposite and adjacent.
    // ==========================================================
    {
      roundNumber: 7,
      tier: 'two-triangles-different-angles',
      triangleConfig: {
        orientation: 'standard',
        referenceAngle: 'A',
        angleDegrees: 30,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      secondTriangleConfig: {
        orientation: 'standard',
        referenceAngle: 'B',
        angleDegrees: 60,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'B', thirdVertex: 'A' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      secondTriangleCorrectLabels: { sideA: 'hypotenuse', sideB: 'adjacent', sideC: 'opposite' },
      explanationOnFirstWrong:
        'Look at both triangles: they are identical in shape, but the highlighted angle is different. ' +
        'For angle A (left triangle): BC is Opposite (faces A), AC is Adjacent (touches A). ' +
        'For angle B (right triangle): AC is Opposite (faces B), BC is Adjacent (touches B). ' +
        'The Hypotenuse (AB) is always the same — it always faces the right angle. Opposite and Adjacent switch when the reference angle switches.',
      skipMessage: 'Left (ref A): AB=Hyp, BC=Opp, AC=Adj. Right (ref B): AB=Hyp, BC=Adj, AC=Opp. The hypotenuse never changes — but Opp and Adj flip when you change the reference angle.',
      hint: 'Two triangles, two reference angles. Label sides for each separately — Opposite and Adjacent will switch!'
    },

    // ==========================================================
    // ROUND 8: two-triangles-different-angles, rotated variant
    // Same concept as Round 7 but triangle 2 is rotated-90
    // Triangle 1 (ref A, standard): AB=hyp, BC=opp, AC=adj
    // Triangle 2 (ref A, rotated-90): AB=hyp, BC=opp, AC=adj
    // (Same reference angle, different visual orientation — shows rotation-invariance)
    // ==========================================================
    {
      roundNumber: 8,
      tier: 'two-triangles-different-angles',
      triangleConfig: {
        orientation: 'standard',
        referenceAngle: 'A',
        angleDegrees: 45,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      secondTriangleConfig: {
        orientation: 'rotated-90',
        referenceAngle: 'B',
        angleDegrees: 45,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'B', thirdVertex: 'A' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      secondTriangleCorrectLabels: { sideA: 'hypotenuse', sideB: 'adjacent', sideC: 'opposite' },
      explanationOnFirstWrong:
        'Left triangle uses angle A — right triangle is rotated AND uses angle B. ' +
        'Left (ref A): AB is the hypotenuse (faces right angle C). BC faces angle A = Opposite. AC touches angle A = Adjacent. ' +
        'Right (ref B, rotated): AB is still the hypotenuse (faces right angle C, even after rotation). BC touches angle B = Adjacent. AC faces angle B = Opposite.',
      skipMessage: 'Left: AB=Hyp, BC=Opp, AC=Adj. Right: AB=Hyp, BC=Adj, AC=Opp. Rotation changes how the triangle looks but NOT which sides are Hyp/Opp/Adj.',
      hint: 'One triangle is rotated. Find the right-angle square first, then apply the definitions for each reference angle.'
    },

    // ==========================================================
    // ROUND 9: two-triangles-different-angles, hardest variant
    // Flipped-horizontal + different reference angles + 60° angles
    // Triangle 1 (ref B, flipped): AB=hyp, AC=opp, BC=adj
    // Triangle 2 (ref A, rotated-45): AB=hyp, BC=opp, AC=adj
    // ==========================================================
    {
      roundNumber: 9,
      tier: 'two-triangles-different-angles',
      triangleConfig: {
        orientation: 'flipped-horizontal',
        referenceAngle: 'B',
        angleDegrees: 60,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'B', thirdVertex: 'A' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      secondTriangleConfig: {
        orientation: 'rotated-45',
        referenceAngle: 'A',
        angleDegrees: 30,
        vertexLabels: { rightAngle: 'C', referenceVertex: 'A', thirdVertex: 'B' },
        sideLabels: { sideA: 'AB', sideB: 'BC', sideC: 'AC' }
      },
      correctLabels: { sideA: 'hypotenuse', sideB: 'adjacent', sideC: 'opposite' },
      secondTriangleCorrectLabels: { sideA: 'hypotenuse', sideB: 'opposite', sideC: 'adjacent' },
      explanationOnFirstWrong:
        'This is the hardest round: different orientations AND different reference angles. ' +
        'Strategy: (1) Find the right-angle square — the side facing it is always the Hypotenuse. (2) Find the reference angle arc. (3) The side facing the reference angle = Opposite. (4) The remaining side touching the reference angle = Adjacent. ' +
        'Left (ref B, flipped): AB=Hypotenuse, AC=Opposite (faces B), BC=Adjacent (touches B). ' +
        'Right (ref A, rotated): AB=Hypotenuse, BC=Opposite (faces A), AC=Adjacent (touches A).',
      skipMessage: 'Left: AB=Hyp, AC=Opp, BC=Adj (ref B). Right: AB=Hyp, BC=Opp, AC=Adj (ref A). Rule: Hypotenuse faces right angle. Opposite faces reference angle. Adjacent touches reference angle.',
      hint: 'Hardest round! Different shapes, different reference angles. Find the right-angle square first, then the reference angle arc.'
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) shows two zones: the triangle diagram zone and the labeling panel. For two-triangle rounds, two diagrams are shown side-by-side above a wider labeling panel.

```
┌────────────────────────────────────────────────────────────────┐
│  #hint-bar                                                     │
│  "Angle A is your reference — label each side relative to A." │
├────────────────────────────────────────────────────────────────┤
│  #diagram-zone  (single triangle OR two triangles side-by-side)│
│                                                                │
│  Single triangle example (standard orientation):              │
│                                                                │
│       B                                                        │
│       |\ ← hypotenuse                                         │
│       |  \                                                     │
│  opp→ |    \                                                   │
│       |      \                                                 │
│       C──────A (arc = θ)                                       │
│          adj                                                   │
│                                                                │
│  Triangle drawn with CSS (borders/transform) — NOT SVG.        │
│  Right-angle marker: small square at vertex C.                 │
│  Angle arc: small curved line at reference angle vertex.       │
│  Vertex labels (A, B, C) placed near each corner.             │
│  Side labels (AB, BC, AC) placed at midpoints.                 │
├────────────────────────────────────────────────────────────────┤
│  #label-panel  (one row per side)                              │
│                                                                │
│  Triangle 1 — Label the sides relative to angle A:            │
│                                                                │
│  Side AB: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│  Side BC: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│  Side AC: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│                                                                │
│  (For two-triangle rounds, Triangle 2 section appears below)  │
│  Triangle 2 — Label the sides relative to angle B:            │
│  Side AB: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│  Side BC: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│  Side AC: [ Hypotenuse ] [ Opposite ] [ Adjacent ]            │
│                                                                │
│  [ Check Answers ]  (disabled until all sides labeled)        │
├────────────────────────────────────────────────────────────────┤
│  #feedback-panel  (hidden by default)                          │
│                                                                │
│  On first wrong attempt: explanation text + "Try Again" btn    │
│  On second wrong attempt: skip message + "Next Round →" btn   │
│                                                                │
│  Correct state: brief "Correct! ✓" + auto-advance after 1s   │
└────────────────────────────────────────────────────────────────┘
```

**CSS triangle construction (NO SVG):**

Draw the right triangle using a `<div>` with CSS borders (transparent trick) or the `clip-path` property. The triangle div must have `id="triangle-shape-1"` (and `id="triangle-shape-2"` for two-triangle rounds). Vertex labels and side labels are absolutely-positioned `<span>` elements inside a relative-positioned container div.

```
Recommended CSS triangle approach using borders:
.triangle-shape {
  width: 0;
  height: 0;
  border-left: 120px solid transparent;
  border-right: 0px solid transparent;
  border-bottom: 100px solid #3b82f6;  /* blue fill */
}

Alternatively use clip-path on a filled rectangle:
.triangle-shape {
  width: 120px;
  height: 100px;
  background: #3b82f6;
  clip-path: polygon(0% 100%, 100% 100%, 0% 0%);
}
```

The right-angle marker is a 10×10px bordered square positioned at the right-angle vertex. The reference angle arc is a `<span>` with `border-radius: 50%` on a quarter-circle, positioned at the reference vertex.

The exact pixel positions of vertex labels and side labels are derived from the `orientation` field:
- `standard`: A at bottom-left, B at top-left, C at bottom-right
- `rotated-90`: A at bottom-right, B at top-right, C at top-left
- `rotated-45`: A at bottom-right, B at bottom-left, C at top-center
- `flipped-horizontal`: A at bottom-right, B at top-right, C at bottom-left

---

## 6. Game Flow

### 6.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

### 6.2 renderRound(roundNumber)

```
1. Load round data: const round = gameState.content.rounds[roundNumber - 1]
2. Reset state: gameState.wrongAttemptsThisRound = 0; gameState.assignedLabels = { sideA: null, sideB: null, sideC: null }
3. Render triangle diagram(s) per round.tier and round.triangleConfig (+ round.secondTriangleConfig if present)
4. Populate #hint-bar with round.hint
5. Render #label-panel rows — one row per side per triangle. For two-triangle rounds, render two sections with distinct headings ("Triangle 1 — angle A" / "Triangle 2 — angle B")
6. Disable "Check Answers" button — it only activates when all required dropdowns/buttons have a selection
7. Hide #feedback-panel
8. Update progress bar: gameState.currentRound = roundNumber
9. For rounds 7-9 (tier = 'two-triangles-different-angles'): also initialise assignedLabels2 = { sideA: null, sideB: null, sideC: null } for second triangle
```

### 6.3 handleLabelSelection(triangleIndex, sideKey, selectedLabel)

```
1. Guard: if (gameState.isProcessing) return
2. Update gameState.assignedLabels[sideKey] = selectedLabel (or assignedLabels2 for triangleIndex=2)
3. Highlight selected button; deselect others in the same row
4. Check if all required sides are assigned — if yes, enable "Check Answers" button
```

### 6.4 handleCheckAnswers()

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Validate each assigned label against round.correctLabels (and round.secondTriangleCorrectLabels if present)
3. const allCorrect = every sideKey: assignedLabels[sideKey] === round.correctLabels[sideKey]
   (and for two-triangle: also every sideKey2: assignedLabels2[sideKey2] === round.secondTriangleCorrectLabels[sideKey2])
4. if (allCorrect):
   - Track event: label_correct
   - gameState.score += 10
   - Show brief correct confirmation in #feedback-panel ("All sides correctly labeled!")
   - After 1200ms: advance to next round or end game
   - gameState.isProcessing = false
5. else (wrong):
   - Track event: label_incorrect
   - gameState.wrongAttemptsThisRound++
   - if (gameState.wrongAttemptsThisRound === 1):
     * Show #feedback-panel with round.explanationOnFirstWrong
     * Show "Try Again" button — clears selections and lets learner retry same round
     * gameState.isProcessing = false
   - else (gameState.wrongAttemptsThisRound >= 2):
     * Track event: round_skipped
     * gameState.skippedRounds++
     * Show #feedback-panel with round.skipMessage
     * Show "Next Round →" button — advances to next round (no score awarded)
     * gameState.isProcessing = false
```

### 6.5 handleTryAgain()

```
1. Hide #feedback-panel
2. Clear all label selections (deselect all buttons in #label-panel)
3. Reset gameState.assignedLabels = { sideA: null, sideB: null, sideC: null }
4. (and assignedLabels2 if two-triangle round)
5. Disable "Check Answers" button
6. NOTE: wrongAttemptsThisRound is NOT reset — it carries the count of attempts
```

### 6.6 End Game

```
- All 9 rounds complete: endGame(true) — always victory (no game-over state)
- Star calculation (based on skippedRounds):
  - 3★: skippedRounds === 0
  - 2★: skippedRounds <= 2
  - 1★: skippedRounds <= 4
  - 0★: skippedRounds >= 5
- Results screen shows: rounds completed (always 9), skipped rounds, correct-on-first-attempt count, star rating
```

---

## 7. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions.
4. **Do NOT use TimerComponent from CDN** — it is not needed for rounds 1-6. For rounds 7-9 optional timer, implement a simple `setInterval` inline. Do not import or instantiate TimerComponent.
5. **Do NOT use drag-and-drop** — use MCQ buttons (3 per row) for label assignment. Drag-drop is unreliable in Playwright tests and not required for this game's learning objective.
6. **Do NOT hard-code side labels or correct answers** — all triangle content must be rendered from `gameState.content.rounds[i]`. The `renderRound()` function must re-build the diagram and panel from data each round.
7. **Do NOT leave "Check Answers" enabled when not all sides are labeled** — it must be disabled until `assignedLabels` has non-null values for every side (6 sides for two-triangle rounds).
8. **Do NOT deduct lives** — this game has no lives system. The `totalLives` in the progress bar config must be 0 (progress bar shows round progress only). Do NOT render a lives indicator.
9. **Do NOT skip to next round on first wrong attempt** — the first wrong attempt must show `explanationOnFirstWrong` and a "Try Again" button. Only on the second wrong attempt does `skipMessage` appear and the round skip.
10. **Do NOT show game-over screen** — there is no game-over state. All 9 rounds always complete. endGame() is always called with `true`.
11. **Do NOT use SVG for the triangle** — use CSS borders or `clip-path` only. SVG interaction logic introduces unreliable click targets in Playwright.
12. **Do NOT reuse the same `assignedLabels` object for the second triangle** — two-triangle rounds require a separate `assignedLabels2` object. Mixing them causes incorrect validation.

---

## 8. Test Scenarios (for test generation guidance)

The test generator (PART-035) must cover all of the following cases:

### Category: game-flow
- **start-screen**: Page loads, start button visible, phase is `start`.
- **game-start**: Clicking Play transitions to `playing` phase; round 1 renders with triangle diagram and 3 rows of label buttons.
- **all-sides-assigned-enables-check**: Selecting a label for each side enables the "Check Answers" button; it is disabled until then.
- **correct-labels-advance-round**: Selecting all correct labels and clicking "Check Answers" shows success and auto-advances after 1.2s.
- **wrong-first-attempt-shows-explanation**: Selecting any wrong label and clicking "Check Answers" shows `#feedback-panel` with explanation text and "Try Again" button.
- **try-again-clears-selections**: Clicking "Try Again" clears all label selections and disables "Check Answers" again.
- **wrong-second-attempt-skips-round**: After two wrong attempts, clicking "Check Answers" shows skip message and "Next Round" button.
- **next-round-button-advances**: Clicking "Next Round" from skip state moves to the next round.
- **complete-all-9-rounds**: Completing (or skipping) all 9 rounds triggers victory transition to results screen.
- **results-screen**: Results screen shows star rating and rounds completed count.
- **no-game-over**: There is no game-over screen — the game always reaches results.

### Category: scoring
- **3-star-no-skips**: 0 skipped rounds → 3 stars.
- **2-star-two-skips**: 2 skipped rounds → 2 stars.
- **score-increments**: Score increases by 10 per correct round (not per skip).
- **skip-no-score**: Skipping a round does not increase score.

### Category: two-triangle-rounds
- **two-panels-visible**: Rounds 7-9 show two diagram panels and two sets of label rows.
- **independent-labeling**: Selecting a label in Triangle 1's panel does not affect Triangle 2's panel.
- **both-triangles-must-be-complete**: "Check Answers" remains disabled until all 6 sides (3 per triangle) are labeled.
- **both-triangles-validated**: If Triangle 1 is fully correct but Triangle 2 has an error, the attempt is still counted as wrong.

### Category: diagram
- **diagram-rendered**: Triangle shape is visible in the DOM (element with id="triangle-shape-1" exists and is visible).
- **hint-text-matches**: `#hint-bar` text matches `round.hint` for the current round.
- **reference-angle-labeled**: The reference angle vertex label (e.g. "A") is present in the diagram for each round.

---

## 9. postMessage Payload Schema

```javascript
// Sent by endGame() via PART-008 PostMessage Protocol
{
  type: 'GAME_COMPLETE',
  gameId: 'game_name_the_sides',
  score: Number,          // 0–90 (10 per correctly labeled round, 0 for skipped)
  stars: Number,          // 0–3
  totalRounds: 9,
  roundsCompleted: 9,     // Always 9 — game never exits early
  skippedRounds: Number,  // Rounds where second attempt was wrong (0–9)
  correctOnFirstAttempt: Number,  // Rounds correct on the very first "Check Answers" click
  durationMs: Number,     // Time from game start to endGame call
  events: Array           // Full event log from gameState.events
}
```

---

## 10. Curriculum Alignment

| Curriculum | Standard | Alignment |
|-----------|----------|-----------|
| NCERT Class 10 | Ch 8, Section 8.1 (Introduction) | Full — labeling hyp/opp/adj is explicitly taught in 8.1 before any formula |
| Common Core | HSG-SRT.C.6 | "Understand that by similarity, side ratios in right triangles are properties of the angles" — requires knowing which sides are which first |

**Session-planner position:** FIRST game in the trig sequence. No prerequisite. Must be completed before:
- `soh-cah-toa-worked-example` (ratio-definition, Bloom L2-L3) — cannot select SOH/CAH/TOA without knowing side names
- `find-triangle-side` (find-side, Bloom L3) — cannot choose correct ratio without side labels

**Bloom's Taxonomy level:** L2 Understand — the learner must hold the geometric definition of each term in working memory and apply it to a visually varying stimulus. This is higher than L1 recall (memorising "hypotenuse = longest side") because the task requires applying the definition under visual variation (rotation, reference angle switch).

---

## 11. Pedagogical Progression: Where name-the-sides Fits

```
name-the-sides (this game) — Bloom L2 Understand
  │  Concept: which side is which relative to a reference angle
  │  Interaction: label-assignment-dropdown
  │  Misconception targeted: rotation blindness + reference-angle confusion
  ▼
soh-cah-toa-worked-example — Bloom L2-L3
  │  Concept: sin = opp/hyp, cos = adj/hyp, tan = opp/adj (with worked examples)
  │  Interaction: worked-example-mcq
  ▼
find-triangle-side — Bloom L3 Apply
     Concept: select correct trig ratio, compute missing side
     Interaction: two-step-ratio-plus-typed
```

**Why this progression is a genuine Bloom's step up at each stage:**
- `name-the-sides` requires understanding definitions, not formulas. No numbers. No calculation.
- `soh-cah-toa-worked-example` requires understanding ratio definitions (still L2) and then applying them in a scaffolded numeric context (L3 procedural — execute a pre-identified procedure).
- `find-triangle-side` requires choosing the correct procedure (L3 Apply — select which ratio, then compute), pushing the boundary toward L4 Analyze.

Without `name-the-sides` as a foundation, learners who struggle with `soh-cah-toa-worked-example` often have a side-labeling gap — they cannot tell which sides the ratio connects to. This game eliminates that gap explicitly before any formula appears.
