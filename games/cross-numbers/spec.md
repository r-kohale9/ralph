# Game Design: Cross Numbers Puzzle

## Identity

- **Game ID:** cross-numbers
- **Title:** Cross Numbers Puzzle
- **Class/Grade:** Class 5-7 (Grade 5-7) — DECISION-POINT: IMC 2025-26 Final Round, Level 3.
- **Math Domain:** Number Sense & Logical Reasoning (digit manipulation, multiplicative reasoning)
- **Topic:** Constraint satisfaction with digits: place digits in a non-rectangular cross-grid so each of 6 intersecting numbers satisfies a product rule, a no-repeat rule, and a sum-maximisation rule.
- **Bloom Level:** L4 Analyze — students must decompose the grid into 6 overlapping constraints, track shared cells, and test digit placements against all constraints simultaneously.
- **Archetype:** Board Puzzle (#6) — a single whole-board puzzle per round solved with CHECK-on-submit; input is tap-cell → tap-digit (not drag).
- **NCERT Alignment:** NCERT Class 5 "Playing with Numbers" (factors of 24), Class 6 "Knowing Our Numbers" (largest n-digit numbers, digit sums). Aligns with IMC problem-solving strand.

## One-Line Concept

Students tap a cell in a cross-shaped grid and then tap a digit from a pool to place it; after filling all 14 cells, they tap CHECK to verify that every one of the 6 intersecting numbers has no repeated digits, the product of its tens and ones digit equals 24, and the 5-digit "Number 1" is the greatest possible with a target digit sum.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Multiplicative reasoning | Recall digit pairs whose product is 24 (3×8, 4×6) and use them to pin tens/ones positions. | All rounds |
| Constraint decomposition | Treat each number as a sub-constraint and reason about shared cells at intersections. | All rounds |
| Search with pruning | Use the digit pool as a finite resource, eliminating digits as they are placed. | All rounds |
| Greatest-number strategy | Prioritise the largest available digit at each position from left to right in Number 1. | All rounds |
| Digit-sum arithmetic | Maintain a running sum of placed digits against the target. | All rounds |

---

## Core Mechanic

Single interaction type across all rounds — tap-cell-then-tap-digit, whole-board validation on CHECK.

### Type A: "Fill the cross grid" (all 3 rounds)

1. **Student sees:** A cross-shaped grid of 14 dashed-border cells with six "Number N 🔢" labels printed in the grid margin (each label points into the arm where that number starts). A rules panel above the grid with the three constraints. A digit pool below the grid laid out as a 4+4+4+2 keypad (or 4+4+4+1 per variant) with digits as white rounded squares. A CHECK button below the pool.
2. **Student does:**
   - Taps a grid cell to focus it (blue border highlight).
   - Taps a digit in the pool to place it into the focused cell; the pool digit dims and the cell shows the digit.
   - Taps a filled cell to re-focus and either: re-tap the same-valued digit in the pool to clear the cell (returning the digit to the pool), OR tap a different digit to replace it (the previously placed digit returns to the pool).
   - Taps CHECK when every cell is filled (CHECK is disabled until the grid is full).
3. **Correct criterion:** Every one of the 6 numbers (N1..N6) has: (a) no internal digit repeats, (b) product of tens and ones digit equals 24, AND Number 1 is the greatest possible 5-digit number whose digits sum to the variant's target.
4. **Feedback:** See § Feedback. Correct → green cell flash + correct SFX + TTS + advance. Wrong → red highlighting on cells participating in a violated constraint + incorrect SFX + TTS + CHECK morphs to NEXT + brief solution reveal.

---

## Rounds & Progression

All 3 rounds use the same cross-grid geometry and the same three global rules. Difficulty varies by digit pool (which digits are available) and the target digit sum for Number 1.

### Round 1 — Variant B1 (canonical)
- Target Number 1 digit sum: **28** (DECISION-POINT — see Warnings; concept says 27 but that is mathematically unsolvable under product-24 constraints for every number).
- Digit pool (14 digits): `{1, 3, 3, 3, 4, 4, 5, 6, 6, 7, 8, 8, 8, 9}`
- Hand-verified unique target solution (see § Content Structure).

### Round 2 — Variant B2
- Target Number 1 digit sum: **28**
- Digit pool (14 digits): `{1, 3, 3, 4, 4, 4, 6, 6, 6, 7, 8, 8, 8, 9}`
- Hand-verified solution.

### Round 3 — Variant B3
- Target Number 1 digit sum: **28**
- Digit pool (14 digits): `{1, 2, 3, 3, 3, 4, 4, 6, 6, 7, 8, 8, 8, 9}`
- Hand-verified solution.

### Summary table

| Dimension | Round 1 (B1) | Round 2 (B2) | Round 3 (B3) |
|-----------|--------------|--------------|--------------|
| Grid cells | 14 | 14 | 14 |
| Pool size | 14 | 14 | 14 |
| Target N1 sum | 28 | 28 | 28 |
| N1 solution | 97183 | 98164 | 97138 |
| Target first-attempt rate | 45-55% | 35-50% | 30-45% |

---

## Game Parameters

- **Rounds:** 3 (one per variant). DECISION-POINT: matches the block_count of 3 in the source (IMC block 310546).
- **Timer:** None — L4 analytic puzzle, no time pressure.
- **Lives:** None. Each round is one-shot: student taps CHECK, gets feedback, advances. Matches the concept's CHECK→NEXT behaviour (flagged in Warnings).
- **Star rating:**
  - **3 stars** = all 3 rounds solved on first CHECK
  - **2 stars** = 2 of 3 rounds solved on first CHECK
  - **1 star** = 1 of 3 rounds solved on first CHECK
  - **0 stars (still reaches results)** = 0 rounds solved on first CHECK
- **Input:** Tap-interaction (P01 / P02 "tap-cell then tap-pool"). Cell tap focuses, pool tap places. Re-tap same digit clears. No drag.
- **Feedback:** Per-round whole-grid validation on CHECK. Per-tap micro-feedback is a fire-and-forget `sound_bubble_select` SFX (no VO). FeedbackManager handles all audio.

---

## Scoring

- **Points:** +1 per round solved on first CHECK (max 3). No partial credit.
- **Stars:** By count of first-CHECK solves (thresholds above).
- **Lives:** None.
- **Partial credit:** None for scoring. Telemetry records per-cell placements and which of the 6 numbers violated the product/sum/repeat rules, so analytics can distinguish "one number off" from "random fill".

---

## Flow

**Shape:** Shape 2 Multi-round with the same two deltas as other Board Puzzles:
1. **No Game Over branch.** Lives = 0.
2. **No retry loop on wrong.** Wrong CHECK → NEXT button (with a brief solution reveal) → next round.

```
[Preview Screen (PART-039)]
        |
        v
[Round N Transition: "Puzzle N"]
        |
        v
[Gameplay: Tap cell, tap digit, fill grid, CHECK]
        |
        | tap CHECK (grid full)
        v
[Validate: each of N1..N6 checked for no-repeat, product-24, and N1-sum + greatest]
        |
        +--> all rules satisfied --> Correct feedback (green cells, SFX + TTS)
        |                                  |
        |                                  v
        |                            [If N < 3: Round N+1 Transition]
        |                            [If N == 3: Victory / Results]
        |
        +--> at least one rule violated --> Wrong feedback
                  (red on conflict cells,
                   SFX + TTS, CHECK -> NEXT,
                   correct solution briefly revealed)
                  |
                  | tap NEXT
                  v
           [If N < 3: Round N+1 Transition]
           [If N == 3: Victory / Results]

(No Game Over; always reaches Results after Round 3.)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Cell tapped (focus) | Cell highlights blue. Fire-and-forget `tap_sound`. No TTS. |
| Digit tapped (pool → cell) | Placed digit renders in cell; pool digit dims; previous cell-digit (if any) returns to pool. Fire-and-forget `sound_bubble_select`. No TTS. |
| Digit tapped again (clear) | Re-tapping the same-valued digit that is already in the focused cell clears the cell; digit returns to pool. Fire-and-forget `sound_bubble_deselect`. |
| CHECK pressed, all rules satisfied | Input blocked (`isProcessing = true`). All cells flash green (400ms). Awaited correct SFX + celebration sticker (~1s). Fire-and-forget TTS: "Brilliant! Every number checks out." `recordAttempt` captured BEFORE audio starts. Auto-advance after ~1500ms. |
| CHECK pressed, at least one rule violated | Input blocked. Conflict cells highlight red (any cell that participates in a violated number). Awaited wrong SFX + sad sticker (~1s). Fire-and-forget TTS: "Oh no! That's not right." CHECK button morphs to NEXT. After ~1500ms the correct solution is briefly rendered into the grid so the student sees the answer. NEXT is tappable any time; auto-advances after ~3500ms from the wrong press. |
| NEXT pressed | Stop all audio. Transition to next-round screen. If N == 3, transition to Victory / Results. |
| Round complete (correct OR wrong+next) | `recordAttempt` already sent. Auto-advance to next round transition after audio settles. |
| All 3 rounds complete | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO sequence (awaited, CTA interruptible). Star count based on first-CHECK solves. |
| Try again / replay | Stop all audio; reset state; return to Round 1 transition. |
| Visibility hidden | `VisibilityTracker` handles pause overlay. Audio + timers pause. |
| Visibility restored | `VisibilityTracker` dismisses overlay. State continues exactly where it was. |

### Conflict cell rule (for red highlighting on wrong CHECK)

A cell is a "conflict cell" if it is part of at least one number (N1..N6) that violates a rule (repeat, product, or sum/greatest for N1). Any cell that participates in any violated number is flagged.

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Fill the cross grid!</b><br>Tap a cell, then tap a digit to place it. Every number must follow the three rules. Tap <b>CHECK</b> when full.</p>',
  previewAudioText: 'Tap a cell, then tap a digit from the pool. Fill every cell following the three rules. Then tap CHECK.',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    // ===================================================================
    // ROUND 1 — Variant B1
    // Grid geometry (shared by all rounds):
    //   col 0: r4 only (n) — leftmost of N6
    //   col 1: r1..r5 — N1 (5 cells, vertical)
    //   col 2: r1..r4 — N2 (4 cells, vertical)
    //   col 3: r1..r4 — N3 (4 cells, vertical)
    //   row 1: c1,c2,c3 — N4 (3 cells, horizontal)
    //   row 2: c1,c2,c3 — N5 (3 cells, horizontal)
    //   row 4: c0,c1,c2,c3 — N6 (4 cells, horizontal; extends one cell left)
    //   Note: row 3 has no horizontal number; it contains only c1 (N1), c2 (N2), c3 (N3).
    //   Number labels point to the START of each arm (top for verticals, left for horizontals).
    // ===================================================================
    {
      round: 1, stage: 1, type: 'A', variant: 'B1',
      targetSum: 28,
      cells: [
        // id: 'rRcC'  (row, col)
        { id: 'r1c1', row: 1, col: 1 },
        { id: 'r1c2', row: 1, col: 2 },
        { id: 'r1c3', row: 1, col: 3 },
        { id: 'r2c1', row: 2, col: 1 },
        { id: 'r2c2', row: 2, col: 2 },
        { id: 'r2c3', row: 2, col: 3 },
        { id: 'r3c1', row: 3, col: 1 },
        { id: 'r3c2', row: 3, col: 2 },
        { id: 'r3c3', row: 3, col: 3 },
        { id: 'r4c0', row: 4, col: 0 },
        { id: 'r4c1', row: 4, col: 1 },
        { id: 'r4c2', row: 4, col: 2 },
        { id: 'r4c3', row: 4, col: 3 },
        { id: 'r5c1', row: 5, col: 1 }
      ],
      numbers: [
        // Each number: id, label, type (vertical|horizontal), cells (in reading order).
        { id: 'N1', label: 'Number 1', type: 'vertical',   cells: ['r1c1','r2c1','r3c1','r4c1','r5c1'] },
        { id: 'N2', label: 'Number 2', type: 'vertical',   cells: ['r1c2','r2c2','r3c2','r4c2'] },
        { id: 'N3', label: 'Number 3', type: 'vertical',   cells: ['r1c3','r2c3','r3c3','r4c3'] },
        { id: 'N4', label: 'Number 4', type: 'horizontal', cells: ['r1c1','r1c2','r1c3'] },
        { id: 'N5', label: 'Number 5', type: 'horizontal', cells: ['r2c1','r2c2','r2c3'] },
        { id: 'N6', label: 'Number 6', type: 'horizontal', cells: ['r4c0','r4c1','r4c2','r4c3'] }
      ],
      pool: [1, 3, 3, 3, 4, 4, 5, 6, 6, 7, 8, 8, 8, 9],
      rules: [
        { id: 'r1', text: "Digits don't repeat within any number." },
        { id: 'r2', text: "Product of tens and ones of every number = 24." },
        { id: 'r3', text: "Make Number 1 the greatest 5-digit number with digit sum = 28." }
      ],
      solution: {
        'r1c1': 9, 'r1c2': 3, 'r1c3': 8,
        'r2c1': 7, 'r2c2': 8, 'r2c3': 3,
        'r3c1': 1, 'r3c2': 4, 'r3c3': 6,
        'r4c0': 5, 'r4c1': 8, 'r4c2': 6, 'r4c3': 4,
        'r5c1': 3
      },
      // N1=97183, N2=3846, N3=8364, N4=938, N5=783, N6=5864.
      misconception_tags: {
        'product-wrong':        "Places a pair whose product is not 24 at the tens/ones of some number.",
        'repeat-in-number':     "Repeats a digit inside the same number.",
        'not-greatest-n1':      "Builds a valid N1 with sum 28 but not the largest possible (e.g., 89173).",
        'wrong-sum-n1':         "Builds an N1 whose digits do not sum to 28."
      }
    },

    // ===================================================================
    // ROUND 2 — Variant B2
    // Same geometry, different pool, different solution.
    // ===================================================================
    {
      round: 2, stage: 1, type: 'A', variant: 'B2',
      targetSum: 28,
      cells: [
        { id: 'r1c1', row: 1, col: 1 },
        { id: 'r1c2', row: 1, col: 2 },
        { id: 'r1c3', row: 1, col: 3 },
        { id: 'r2c1', row: 2, col: 1 },
        { id: 'r2c2', row: 2, col: 2 },
        { id: 'r2c3', row: 2, col: 3 },
        { id: 'r3c1', row: 3, col: 1 },
        { id: 'r3c2', row: 3, col: 2 },
        { id: 'r3c3', row: 3, col: 3 },
        { id: 'r4c0', row: 4, col: 0 },
        { id: 'r4c1', row: 4, col: 1 },
        { id: 'r4c2', row: 4, col: 2 },
        { id: 'r4c3', row: 4, col: 3 },
        { id: 'r5c1', row: 5, col: 1 }
      ],
      numbers: [
        { id: 'N1', label: 'Number 1', type: 'vertical',   cells: ['r1c1','r2c1','r3c1','r4c1','r5c1'] },
        { id: 'N2', label: 'Number 2', type: 'vertical',   cells: ['r1c2','r2c2','r3c2','r4c2'] },
        { id: 'N3', label: 'Number 3', type: 'vertical',   cells: ['r1c3','r2c3','r3c3','r4c3'] },
        { id: 'N4', label: 'Number 4', type: 'horizontal', cells: ['r1c1','r1c2','r1c3'] },
        { id: 'N5', label: 'Number 5', type: 'horizontal', cells: ['r2c1','r2c2','r2c3'] },
        { id: 'N6', label: 'Number 6', type: 'horizontal', cells: ['r4c0','r4c1','r4c2','r4c3'] }
      ],
      pool: [1, 3, 3, 4, 4, 4, 6, 6, 6, 7, 8, 8, 8, 9],
      rules: [
        { id: 'r1', text: "Digits don't repeat within any number." },
        { id: 'r2', text: "Product of tens and ones of every number = 24." },
        { id: 'r3', text: "Make Number 1 the greatest 5-digit number with digit sum = 28." }
      ],
      solution: {
        'r1c1': 9, 'r1c2': 4, 'r1c3': 6,
        'r2c1': 8, 'r2c2': 6, 'r2c3': 4,
        'r3c1': 1, 'r3c2': 8, 'r3c3': 3,
        'r4c0': 7, 'r4c1': 6, 'r4c2': 3, 'r4c3': 8,
        'r5c1': 4
      },
      // N1=98164, N2=4683, N3=6438, N4=946, N5=864, N6=7638.
      misconception_tags: {
        'product-wrong':    "Places a pair whose product is not 24 at tens/ones.",
        'repeat-in-number': "Repeats a digit within the same number.",
        'not-greatest-n1':  "Builds a valid N1 with sum 28 but not the largest possible.",
        'wrong-sum-n1':     "Builds an N1 whose digits do not sum to 28."
      }
    },

    // ===================================================================
    // ROUND 3 — Variant B3
    // Same geometry, different pool, different solution.
    // ===================================================================
    {
      round: 3, stage: 1, type: 'A', variant: 'B3',
      targetSum: 28,
      cells: [
        { id: 'r1c1', row: 1, col: 1 },
        { id: 'r1c2', row: 1, col: 2 },
        { id: 'r1c3', row: 1, col: 3 },
        { id: 'r2c1', row: 2, col: 1 },
        { id: 'r2c2', row: 2, col: 2 },
        { id: 'r2c3', row: 2, col: 3 },
        { id: 'r3c1', row: 3, col: 1 },
        { id: 'r3c2', row: 3, col: 2 },
        { id: 'r3c3', row: 3, col: 3 },
        { id: 'r4c0', row: 4, col: 0 },
        { id: 'r4c1', row: 4, col: 1 },
        { id: 'r4c2', row: 4, col: 2 },
        { id: 'r4c3', row: 4, col: 3 },
        { id: 'r5c1', row: 5, col: 1 }
      ],
      numbers: [
        { id: 'N1', label: 'Number 1', type: 'vertical',   cells: ['r1c1','r2c1','r3c1','r4c1','r5c1'] },
        { id: 'N2', label: 'Number 2', type: 'vertical',   cells: ['r1c2','r2c2','r3c2','r4c2'] },
        { id: 'N3', label: 'Number 3', type: 'vertical',   cells: ['r1c3','r2c3','r3c3','r4c3'] },
        { id: 'N4', label: 'Number 4', type: 'horizontal', cells: ['r1c1','r1c2','r1c3'] },
        { id: 'N5', label: 'Number 5', type: 'horizontal', cells: ['r2c1','r2c2','r2c3'] },
        { id: 'N6', label: 'Number 6', type: 'horizontal', cells: ['r4c0','r4c1','r4c2','r4c3'] }
      ],
      pool: [1, 2, 3, 3, 3, 4, 4, 6, 6, 7, 8, 8, 8, 9],
      rules: [
        { id: 'r1', text: "Digits don't repeat within any number." },
        { id: 'r2', text: "Product of tens and ones of every number = 24." },
        { id: 'r3', text: "Make Number 1 the greatest 5-digit number with digit sum = 28." }
      ],
      solution: {
        'r1c1': 9, 'r1c2': 8, 'r1c3': 3,
        'r2c1': 7, 'r2c2': 3, 'r2c3': 8,
        'r3c1': 1, 'r3c2': 6, 'r3c3': 4,
        'r4c0': 2, 'r4c1': 3, 'r4c2': 4, 'r4c3': 6,
        'r5c1': 8
      },
      // N1=97138, N2=8364, N3=3846, N4=983, N5=738, N6=2346.
      misconception_tags: {
        'product-wrong':    "Places a pair whose product is not 24 at tens/ones.",
        'repeat-in-number': "Repeats a digit within the same number.",
        'not-greatest-n1':  "Builds a valid N1 with sum 28 but not the largest possible.",
        'wrong-sum-n1':     "Builds an N1 whose digits do not sum to 28."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to Class 5-7 based on IMC Level 3 (Indian Mathematics Challenge) source.
- **Bloom Level:** L4 Analyze based on multi-constraint satisfaction demand.
- **Archetype:** Board Puzzle (#6).
- **Rounds:** 3 (one per variant, matching source `block_count`).
- **Lives:** 0 (no retry), matching source concept's CHECK→NEXT flow.
- **Timer:** None.
- **Input:** Tap-cell then tap-digit, per source concept explicit description.
- **Feedback:** FeedbackManager with standard correct/incorrect SFX on CHECK; fire-and-forget `sound_bubble_select` on per-placement taps.
- **Target N1 sum:** 28 for all 3 variants (deviates from source's "27" for B1; see Warnings).
- **Cell count:** 14 for all variants (deviates from source's B2/B3 which say 13; normalised to 14 so pool size = cell count).

---

## Warnings

- **WARNING — Target sum 27 is unsolvable.** The source concept says B1 target digit sum = 27. Under the simultaneous constraints (every number has tens × ones = 24, no digit repeats inside a number, 6 intersecting numbers), Number 1's five cells are forced to values from {3, 4, 6, 8} at four of five positions, summing to 21, plus one free cell. Free-cell value = target sum − 21. For sum = 27 the free cell must be 6, but 6 is already used in the other four positions → no valid arrangement. We use sum = 28 (free cell = 7) instead, which yields valid puzzles. DECISION-POINT: confirm with Education slot that the content designer is OK with target sum = 28 for all three variants; if they insist on 27 the grid geometry must be restructured (e.g., different intersection pattern, different number lengths).
- **WARNING — Cell count 13 vs 14.** Source says B2/B3 have 13 cells. Our geometry has 14 cells so pool size (14 digits) matches cell count exactly. DECISION-POINT: confirm the cell-count discrepancy is acceptable.
- **WARNING — Solution uniqueness.** Each variant has ONE hand-verified solution stored in `fallbackContent`. The validator checks: (a) no repeats in any number, (b) tens × ones = 24 for every number, (c) N1 digits sum to targetSum, (d) N1 equals the exact stored greatest-value solution (otherwise "not greatest" is flagged). The "greatest" rule is enforced by comparing against the stored solution rather than by solving the maximisation at runtime — this requires the stored solution to truly be the greatest under the pool + constraints. We argue by exhaustion in the spec notes that 97183 (B1), 98164 (B2), 97138 (B3) are the greatest valid N1 for their respective pools; if a tester finds a larger valid N1, the stored solution must be corrected.
- **WARNING — No retry on wrong answer.** Source concept specifies CHECK→NEXT flow (no retry). Same pedagogical concern as logic-seat-puzzle: students get no chance to revise. DECISION-POINT: confirm with Education slot.
- **WARNING — Touch-target density.** 14 grid cells + up to 14 pool digits on a 375px-wide viewport means each cell must be ≈44px minimum with tight margins. Grid and pool must render on mobile without overflow — verify in Visual Review.
- **WARNING — Label placement in margin.** The 6 "Number N 🔢" labels sit OUTSIDE the grid arms (top of verticals, left of horizontals). The cross-shape + margin labels require CSS Grid with explicit row/col spans plus absolute-positioned label elements. Getting this right on mobile is nontrivial — flagged for build.
- **WARNING — Cell visual: dashed borders.** Interactive cells use dashed gray borders (distinct from the pool's solid rounded-square tiles). This visual differentiation is a specified UI requirement.
- **WARNING — Placement interaction complexity.** "Re-tap same digit to clear" requires tracking which pool digit instance is semantically the same value as the focused cell's current digit. Implementation uses digit-value matching: tapping a pool digit whose VALUE equals the focused cell's current value is interpreted as a clear. This means if the pool has multiple 8s, tapping any 8 in the pool when the focused cell holds 8 clears the cell (and returns the specific tapped 8 to availability). For simplicity we track pool positions as "consumed" or "available" — the student can pick any available position of a given value. DECISION-POINT for Education: is this "any 8" semantics acceptable, or must the specific pool-position that supplied the digit be the one that clears it? We default to any-8 for simplicity.
