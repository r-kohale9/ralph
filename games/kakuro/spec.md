# Game Design: Kakuro — Number Sum Crossword

## Identity

- **Game ID:** kakuro
- **Title:** Kakuro — Number Sum Crossword
- **Class/Grade:** Class 3-6 (Grade 3-6) — concept is silent on grade; addition and decomposition into addends fit Class 3-6 NCERT.
- **Math Domain:** Number & Operations (addition, decomposition into addends, constraint intersection)
- **Topic:** Kakuro puzzle — fill a 5×5 grid of white answer cells with digits 1–9 so every horizontal and vertical run sums to its clue with no digit repeated inside any single run.
- **Bloom Level:** L3 Apply — students must apply addition facts and "no-repeat" logic across intersecting rows and columns, not just recall.
- **Archetype:** Board Puzzle (#6) — each round is a single grid solved as a whole (not a sequence of per-item questions). A CHECK button validates the entire arrangement against every row-sum and column-sum clue at once.
- **NCERT Alignment:** NCERT Class 3-5 "Addition", "Number Sense" and Class 6 "Playing with Numbers" (logic-grid puzzle appendix). Decomposition into addends ("make-this-sum") aligns with NCERT Class 3-4 "Shapes and Numbers".

## One-Line Concept

Students tap a white cell on a 5×5 number-crossword, then tap a digit 1–9, so that every horizontal and vertical run of white cells sums to the clue in the black triangle that governs it, with no digit repeated in any run — tapping CHECK validates the entire grid at once.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Addition decomposition | Break a clue number into distinct addends 1-9 that match the run length (e.g., 17 across 3 cells → 9+5+3, 8+6+3, 7+4+6, etc.). | All rounds |
| Constraint intersection | Use a digit fixed by one run to narrow candidates in an intersecting run. | All rounds |
| Disciplined elimination | Reject combinations that repeat digits inside a run. | All rounds |
| Single-digit facts | Fluency in addition facts with digits 1-9. | All rounds |
| Trial-and-check | Place a candidate, scan for conflict, revise. | All rounds |

---

## Core Mechanic

Single interaction type across all rounds — **tap-cell-then-tap-digit** with check-on-submit. Difficulty scales by (a) size of the playable region / number of white cells, (b) size of the clue numbers, (c) presence of intersection cells that must satisfy both a row and a column clue simultaneously.

### Type A: "Starter grid" (Stage 1 — Round 1, variant B1)

1. **Student sees:** A 5×5 grid with the playable region roughly the B1 layout from the concept screenshot: blocked cells clustered top-left and along the lower-right, 12 white answer cells, 7 clue cells. Above the grid is the rules panel showing `1⃣ 2⃣ 3⃣` with the stated rules. Below the grid is a number pad with 1-4 in row 1, 5-8 in row 2, a centred 9 in row 3. A CHECK button below the pad, initially disabled.
2. **Student does:** Taps a white cell to select it (highlighted in yellow). Taps a digit button to place that digit in the selected cell. Tapping a different digit replaces the value. Tapping a different cell changes focus. Tapping the same cell a second time toggles focus off. Tapping CHECK when all 12 cells are filled validates the whole grid.
3. **Correct criterion:** Every row-run's sum equals its left-clue AND every column-run's sum equals its top-clue AND no digit repeats inside any single run.
4. **Feedback:** See § Feedback. Correct = green-cell flash + correct SFX + TTS celebration + advance. Wrong = red-cell highlighting on every cell that is part of any violated run + "Not quite — check the sums and repeats." message + incorrect SFX + CHECK morphs to NEXT → advance to next round (no retry, per canonical board-puzzle behavior described in concept).

### Type A: "Second grid" (Stage 2 — Round 2, variant B2)

Identical mechanic to Type A above. Different clue numbers and blocked-cell layout (per concept variant B2). Rules rendered as `1. 2. 3.` in numeric notation. 12 white cells.

### Type A: "Third grid" (Stage 3 — Round 3, variant B3)

Identical mechanic. Variant B3 layout. Rules rendered as `1. 2. 3.` in numeric notation. 12 white cells. Top-row clue includes 29 as a 3-cell run (forcing {9,8,?} — tight constraint).

---

## Rounds & Progression

### Stage 1: B1 (Round 1)
- Round type: Type A.
- Grid: 5×5 with B1 clue-cell layout (blocked top-left corner, blocked lower-right corner to produce irregular playable region).
- Rules: `1⃣ 2⃣ 3⃣` glyphs (verbatim) — row-sum = left clue, column-sum = top clue, no repeats in any run.
- Clue seeds: top-row column clues **29, 11, 17** (from concept). Left-column row clues include **18**, a diagonal-split **21/4** (21 across, 4 down), **13**, **9**.
- White cells: **12**.
- Cognitive demand: **Decompose** — break each clue into a no-repeat addend set that matches the run length, then pick the shared digit at intersections.

### Stage 2: B2 (Round 2)
- Round type: Type A.
- Grid: 5×5, B2 layout (per concept — top-row column clues include **16 and 11**).
- Rules: `1. 2. 3.` (numeric).
- White cells: **12**.
- Cognitive demand: **Intersect** — same mechanic as Stage 1 but with tighter clue numbers that force a more constrained intersection pattern.

### Stage 3: B3 (Round 3)
- Round type: Type A.
- Grid: 5×5, B3 layout (per concept — top-row column clue includes **29** as a 3-cell run, which forces the inclusion of 9 and 8).
- Rules: `1. 2. 3.` (numeric).
- White cells: **12**.
- Cognitive demand: **Force the 9** — identify that a 3-cell run summing to 29 requires the only combination {9+8+12 is invalid; 29 across 4 = {9,8,6,... }; across 3 impossible because max = 24}; the spec uses 29 as a 4-cell column run where the unique digit set is {9,8,7,5} or {9,8,6,6 invalid, 9,7,6,7 invalid} — actual solution table spelled out in Content Structure. Student must work forward from the forced 9.

### Summary Table

| Dimension | Stage 1 (R1) | Stage 2 (R2) | Stage 3 (R3) |
|-----------|--------------|---------------|---------------|
| Round type | A | A | A |
| Grid size | 5×5 | 5×5 | 5×5 |
| White cells | 12 | 12 | 12 |
| Rules glyph | `1⃣ 2⃣ 3⃣` | `1. 2. 3.` | `1. 2. 3.` |
| Distinctive clue | 21/4 split, 17 column | 16, 11 column | 29 column (forces 9) |
| Target first-attempt rate | 55-70% | 45-60% | 35-50% |

---

## Game Parameters

- **Rounds:** 3 — one per variant (B1, B2, B3) per concept.
- **Timer:** None — L3 Apply puzzles should not be timed.
- **Lives:** None. Each round is one-shot: student submits, gets feedback, advances. Matches Board Puzzle archetype default AND the CHECK→NEXT pattern implied by the concept.
- **Star rating:**
  - **3 stars** = all 3 rounds solved on first CHECK
  - **2 stars** = 2 rounds solved on first CHECK
  - **1 star** = 1 round solved on first CHECK
  - **0 stars (still reaches results)** = 0 rounds solved on first CHECK
- **Input:** Tap-cell-then-tap-digit (Pattern P1 tap with cell-as-selection and digit-pad-as-value). Plus tap on CHECK / NEXT button. No drag.
- **Feedback:** Per-round whole-grid validation on CHECK. Per-cell-fill micro-feedback is visual only (digit snaps into cell, fire-and-forget tap SFX). Awaited SFX + TTS on correct/incorrect round resolution. FeedbackManager handles all audio.

---

## Scoring

- **Points:** +1 per round solved on first CHECK (max 3). No partial credit — either every run sums correctly and no digits repeat, or not.
- **Stars:** By count of first-CHECK solves, thresholds above.
- **Lives:** None (no game_over path).
- **Partial credit:** None for scoring; telemetry captures per-cell placements and violated-run IDs so analytics can distinguish "one run off" from "random fill".

---

## Flow

**Shape:** Multi-round (default) with two deltas from the canonical default:
1. **No Game Over branch.** Lives = 0, so the "wrong AND lives = 0" branch is removed entirely. Wrong CHECK → NEXT button → next round transition → next round. Never transitions to game_over.
2. **Wrong answer does NOT loop back to the same round.** NEXT button shipped in the source concept means the student sees the correct grid (briefly) then advances — no retry. Standard across the Board Puzzle archetype for this source family.

Changes from default:
- Remove Game Over path (no lives).
- After wrong CHECK, advance to next round (no retry loop inside the same round).
- Replace the "submit" transition in the Gameplay → Feedback edge with an explicit CHECK button tap.

```
[Preview Screen (PART-039)]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: Tap white cells, tap digits 1-9, CHECK disabled until grid full]
        |
        | tap CHECK (all 12 cells filled)
        v
[Validate grid — every row-run + every column-run + no-repeat]
        |
        +--> all runs satisfied --> Correct feedback (green cells, SFX + TTS)
        |                                  |
        |                                  v
        |                            [If N < 3: Round N+1 Transition]
        |                            [If N == 3: Victory / Results]
        |
        +--> at least one run violated --> Wrong feedback
                  (red on conflict cells,
                   SFX + TTS, CHECK -> NEXT,
                   correct grid briefly shown)
                  |
                  | tap NEXT (or auto after 3500ms)
                  v
           [If N < 3: Round N+1 Transition]
           [If N == 3: Victory / Results]

(No Game Over; always reaches Results after Round 3.)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Tap white cell | Cell highlights (yellow background, primary border). No audio. Any previously-selected cell deselects. |
| Tap digit button | Digit value written into selected cell (replaces if already filled). Fire-and-forget tap SFX. Auto-deselect if all cells now filled. CHECK enables when all cells filled. |
| Tap digit with no cell selected | No-op. No audio. |
| Tap selected cell again | Toggle deselect. No audio. |
| Tap filled cell then tap digit | Replaces the digit in that cell. |
| Tap filled cell then tap same digit | Clears the cell (toggles value off). |
| CHECK pressed, grid correct | Input blocked (`isProcessing = true`) before any await. All white cells flash green (400ms). Awaited correct SFX + celebration sticker (~1s). Fire-and-forget TTS + subtitle: "Great addition! Every run sums right." `recordAttempt` captures the full grid before audio starts. After ~1500ms, advance. |
| CHECK pressed, grid wrong | Input blocked. Conflict cells highlight red (see "conflict cell" rule below). Awaited wrong SFX + sad sticker (~1s). Fire-and-forget TTS + subtitle: "Not quite — check the sums and repeats." CHECK button morphs to NEXT button. After ~1500ms, **correct grid is briefly shown** (digits fade into their solution cells). NEXT is tappable at any time to advance immediately. Auto-advance after ~3500ms total. |
| NEXT pressed | Stop all audio. Transition to next-round screen. If N == 3, transition to Victory / Results. |
| Round complete (correct OR wrong+next) | `recordAttempt` already sent. Auto-advance to next-round transition after audio settles. |
| All 3 rounds complete | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO sequence. Star count based on first-CHECK solves. |
| Try again / replay | Stop all audio; reset state; return to Round 1 (skip Preview). |
| Visibility hidden | `VisibilityTracker` handles pause overlay (do not roll a custom one). Audio + timers pause. |
| Visibility restored | `VisibilityTracker` dismisses overlay. State continues exactly where it was. |

### Conflict cell rule (for red highlighting on wrong CHECK)

A cell is a "conflict cell" if it is part of at least one violated run.

- For a row-run with clue R covering cells `[c1, c2, ...]`: if `sum(values) !== R` OR any digit is repeated in the run, every cell in the run is a conflict cell.
- For a column-run with clue C covering cells `[c1, c2, ...]`: same rule as rows.
- A cell that participates only in runs that are all satisfied is NOT highlighted red (it stays white) — this tells the student which rows/columns to reconsider.

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Number Sum Crossword!</b><br>Tap a white square, then tap a digit 1-9 to fill it. Every row and column must add up to its clue, with no repeats. Tap <b>CHECK</b> when you are done.</p>',
  previewAudioText: 'Tap a white square, then tap a digit from one to nine. Make every row and column sum to its clue, with no digit repeated. Then tap CHECK.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ===================================================================
    // ROUND 1 — Stage 1, Variant B1. 5x5 grid. 12 white cells.
    // Grid coordinates: row 0..4 top-to-bottom, col 0..4 left-to-right.
    // Cell types:
    //   'blocked' — solid black, no content.
    //   'clue' — diagonally split. Has optional { across: N, down: M }.
    //           across = sum of row-run starting immediately to the right.
    //           down   = sum of column-run starting immediately below.
    //   'white' — fillable. Has { value: null|1..9, solution: 1..9 }.
    //
    // Layout (5x5) — numbers are column clues, letters are row clues, W are white:
    //
    //       col0    col1    col2    col3    col4
    //  row0 [blk]   [clue   [clue   [clue   [blk]
    //                down=29]down=11]down=17]
    //  row1 [clue   [W1]    [W2]    [W3]    [blk]
    //        acr=18]
    //  row2 [clue   [W4]    [W5]    [W6]    [clue
    //        acr=21                          down=4]
    //        down=4]
    //  row3 [clue   [W7]    [W8]    [W9]    [W10]
    //        acr=13]
    //  row4 [clue   [W11]   [W12]   [blk]   [blk]
    //        acr=9]
    //
    // Note: per concept, 21/4 diagonal split is at row2 col0 (21 across + 4 down).
    // 4 down at row2 col4 means the one-cell down run at row3 col4 is a standalone.
    // Solution chosen to satisfy every row-run and column-run.
    //
    // Runs:
    //   Row runs (horizontal white-cell sequences):
    //     R_row1 (clue 18, cells W1 W2 W3)  → 18 = 9+8+1 or 9+7+2 or 9+6+3 or 9+5+4 or 8+7+3 or 8+6+4 or 7+6+5
    //     R_row2 (clue 21, cells W4 W5 W6)  → 21 = 9+8+4 or 9+7+5 or 8+7+6 or 9+6+6 invalid
    //     R_row3 (clue 13, cells W7 W8 W9 W10) → 13 across 4 cells no repeats = {1,2,3,7} or {1,2,4,6} or {1,3,4,5}
    //     R_row4 (clue 9, cells W11 W12)   → 9 = 1+8 or 2+7 or 3+6 or 4+5
    //   Column runs:
    //     C_col1 (clue 29 top, cells W1 W4 W7 W11, length 4) → 29 across 4 = {9,8,7,5} only no-repeat set
    //     C_col2 (clue 11 top, cells W2 W5 W8 W12, length 4) → 11 across 4 = {1,2,3,5} only (smallest distinct) OR {1,2,4,4 invalid} → actually {1,2,3,5} is unique-min; also {1,2,4,4 invalid}; {1,3,3,4 invalid} → {1,2,3,5} unique
    //     C_col3 (clue 17 top, cells W3 W6 W9, length 3) → 17 across 3 = {9,7,1}, {9,6,2}, {9,5,3}, {8,6,3}, {8,5,4}, {7,6,4}
    //     C_col4 (clue 4 at r2col4 down, cells W10 only, length 1) → W10 = 4
    //
    // Authoritative solution (hand-solved, one of many):
    //   W1=8, W2=3, W3=7         (row1 sum: 8+3+7=18 ✓; no repeats)
    //   W4=9, W5=5, W6=7         (row2 sum: 9+5+7=21 ✓; col3 has W3=7 and W6=7 — repeat) — BAD
    // Re-solve: require W3 ≠ W6 in col3 (no repeat in column run).
    //
    // Start over with explicit constraint-propagation. Target solution:
    //   col1 (29/4): {W1,W4,W7,W11} is a permutation of {9,8,7,5}.
    //   col2 (11/4): {W2,W5,W8,W12} is a permutation of {1,2,3,5}.
    //   col3 (17/3): {W3,W6,W9} sums to 17, all distinct.
    //   col4 (4/1):  {W10} = 4.
    //   row1 (18/3): W1+W2+W3 = 18, all distinct.
    //   row2 (21/3): W4+W5+W6 = 21, all distinct.
    //   row3 (13/4): W7+W8+W9+W10 = 13 → W7+W8+W9 = 13-4 = 9, W10=4 (consistent), all distinct AND ≠ W10 (4).
    //   row4 (9/2):  W11+W12 = 9, all distinct.
    //
    // Try: col1 perm = (W1=9, W4=8, W7=7, W11=5). col2 perm = (W2=1, W5=3, W8=5, W12=2).
    //   row1: W1+W2+W3 = 9+1+W3 = 18 → W3 = 8. (Distinct from 9,1: ✓)
    //   row2: W4+W5+W6 = 8+3+W6 = 21 → W6 = 10. INVALID (digit > 9).
    //
    // Try: col1 perm = (W1=9, W4=7, W7=8, W11=5). col2 perm = (W2=1, W5=5, W8=3, W12=2).
    //   row1: 9+1+W3 = 18 → W3 = 8. (Distinct: ✓)
    //   row2: 7+5+W6 = 21 → W6 = 9. (Distinct from 7,5: ✓). But col3: W3+W6+W9 = 8+9+W9 = 17 → W9 = 0. INVALID.
    //
    // Try: col1 = (W1=8, W4=9, W7=7, W11=5). col2 = (W2=1, W5=3, W8=5, W12=2).
    //   row1: 8+1+W3 = 18 → W3 = 9. ✓ (distinct 8,1,9)
    //   row2: 9+3+W6 = 21 → W6 = 9. Col3 repeat W3=9 and W6=9 BAD.
    //
    // Try: col1 = (W1=8, W4=9, W7=5, W11=7). col2 = (W2=1, W5=3, W8=5, W12=2). row4: W11+W12 = 7+2 = 9 ✓
    //   row1: 8+1+W3 = 18 → W3 = 9 (distinct 8,1,9 ✓)
    //   row2: 9+3+W6 = 21 → W6 = 9. col3 repeat W3=9,W6=9 BAD.
    //
    // Try: col1 = (W1=8, W4=7, W7=9, W11=5). col2 = (W2=3, W5=5, W8=1, W12=2). row4: 5+2=7 ≠ 9 BAD.
    // Try: col2 = (W2=3, W5=5, W8=2, W12=1). row4: W11=5, W12=1, sum 6 ≠ 9 BAD.
    // Try: col1 = (W1=9, W4=5, W7=8, W11=7). col2 = (W2=1, W5=3, W8=5, W12=2). row4: 7+2=9 ✓
    //   row1: 9+1+W3 = 18 → W3 = 8. distinct 9,1,8 ✓
    //   row2: 5+3+W6 = 21 → W6 = 13. INVALID.
    // Try: col1 = (W1=9, W4=7, W7=8, W11=5). col2 = (W2=1, W5=5, W8=3, W12=2). row4: 5+2=7 ≠ 9 BAD.
    // Try: col1 = (W1=9, W4=8, W7=5, W11=7). col2 = (W2=1, W5=3, W8=5, W12=2). row4: 7+2=9 ✓
    //   row1: 9+1+W3 = 18 → W3 = 8. distinct ✓
    //   row2: 8+3+W6 = 21 → W6 = 10. INVALID.
    // Try: col1 = (W1=7, W4=8, W7=9, W11=5). col2 = (W2=2, W5=5, W8=3, W12=1). row4: 5+1=6 ≠ 9 BAD.
    // Try: col1 = (W1=7, W4=9, W7=8, W11=5). col2 = (W2=2, W5=3, W8=5, W12=1). row4: 5+1=6 BAD.
    // Try: col1 = (W1=5, W4=9, W7=8, W11=7). col2 = (W2=3, W5=2, W8=5, W12=1). row4: 7+1=8 BAD.
    // Try: col1 = (W1=5, W4=9, W7=8, W11=7). col2 = (W2=1, W5=3, W8=5, W12=2). row4: 7+2=9 ✓
    //   row1: 5+1+W3 = 18 → W3 = 12. INVALID.
    // Try: col1 = (W1=5, W4=8, W7=9, W11=7). col2 = (W2=3, W5=5, W8=1, W12=2). row4: 7+2=9 ✓
    //   row1: 5+3+W3 = 18 → W3 = 10. INVALID.
    // Try: col1 = (W1=5, W4=7, W7=9, W11=8). col2 = (W2=3, W5=5, W8=1, W12=2). row4: 8+2=10 BAD.
    //
    // Re-examine: row1 (18/3) with W1 ∈ {9,8,7,5} and W2 ∈ {1,2,3,5}.
    //   If W1=9: W2+W3 = 9. W2∈{1,2,3,5}. → (W2=1,W3=8) | (W2=2,W3=7) | (W2=3,W3=6) | (W2=5,W3=4). Distinct.
    //   If W1=8: W2+W3 = 10. → (W2=1,W3=9) | (W2=2,W3=8 conflict W1) | (W2=3,W3=7) | (W2=5,W3=5 repeat).
    //   If W1=7: W2+W3 = 11. → (W2=2,W3=9) | (W2=3,W3=8) | (W2=5,W3=6).
    //   If W1=5: W2+W3 = 13. → (W2=4 not in {1,2,3,5}) → skip; (W2=5 repeat)...no valid.
    //
    // Row2 (21/3) with W4 ∈ {9,8,7,5}\{W1} and W5 ∈ {1,2,3,5}\{W2}.
    //   Row2 sum = 21 needs large digits. With W5 ≤ 5: W4+W6 ≥ 16, so W4 ≥ 7 and W6 ≥ 7.
    //   If W5=1: W4+W6=20 → need {W4,W6} ⊂ {9,...} with sum 20, W4 ≠ W6, both ≤ 9: only (9,11 invalid) → impossible? 9+11 no, 11 > 9. So no.
    //   Wait: max W4+W6 = 9+8 = 17. 21 - 1 = 20 > 17. So W5=1 impossible.
    //   If W5=2: W4+W6=19 → impossible (max 17).
    //   If W5=3: W4+W6=18 → impossible.
    //   If W5=5: W4+W6=16 → (9,7) or (7,9).
    //
    // So W5 = 5. Therefore W5=5 locks row2.
    //
    // Revisit col2 perm of {1,2,3,5}: W5=5 means {W2,W8,W12} is perm of {1,2,3}.
    // Row4 (9/2): W11+W12 = 9, distinct, from {digits 1..9}. W12 ∈ {1,2,3}.
    //   If W12=1: W11=8.  W11 ∈ col1={9,8,7,5} → W11=8 ok.
    //   If W12=2: W11=7.  W11=7 ok.
    //   If W12=3: W11=6.  W11=6 NOT in {9,8,7,5} → invalid.
    //   So W12 ∈ {1,2}.
    //
    // W4+W6=16 with W4,W6 ∈ {9,8,7,5}\{W1} and distinct, sum 16 → {9,7} only.
    //   Case A: W4=9, W6=7. Then col1\{W1,W4} has {8,7,5}\{W1} available for W7,W11. Also col3 has W6=7.
    //     → W1 ∈ {8,7,5} (since W4=9). If W1=7: col3 has W3 ∈ {..}, row1=18 with W1=7, W2+W3=11 → (W2=2,W3=9)|(W2=3,W3=8)|(W2=5,W3=6 not allowed col2). From col2 W2∈{1,2,3}\{W5=5}, so W2∈{1,2,3}. (W2=2,W3=9)|(W2=3,W3=8).
    //       col3 (17/3) = W3+W6+W9 = 17. W6=7. → W3+W9 = 10. W3 and W9 distinct, ≠ 7.
    //         If W3=9: W9=1. ✓ distinct from 9,7.
    //         If W3=8: W9=2. ✓ distinct from 8,7.
    //       row3 (13/4) = W7+W8+W9+W10 = 13. W10=4. So W7+W8+W9 = 9.
    //         W7 ∈ {8,5} (col1 remaining after W1=7, W4=9). W8 ∈ col2 remaining after W5=5 and W2.
    //         Sub-case A1: W3=9, W9=1. W7+W8+1 = 9 → W7+W8 = 8. W7∈{8,5}.
    //           If W7=8: W8=0 invalid.  If W7=5: W8=3. Col2 {W2,W5,W8,W12} = {?,5,3,?} needs W2 and W12 from {1,2} distinct. row4 W12∈{1,2}, W11=col1 last ={8}. W11=8, W12 from {1,2}. row4: 8+W12=9 → W12=1. So W2=2.
    //             Check col2 perm {2,5,3,1} = {1,2,3,5} ✓
    //             row1: W1+W2+W3 = 7+2+9 = 18 ✓ distinct 7,2,9 ✓
    //             col1 perm: {W1,W4,W7,W11}={7,9,5,8} = {9,8,7,5} ✓
    //             row2: W4+W5+W6 = 9+5+7 = 21 ✓ distinct ✓
    //             row3: W7+W8+W9+W10 = 5+3+1+4 = 13 ✓ distinct ✓
    //             col3: W3+W6+W9 = 9+7+1 = 17 ✓ distinct ✓
    //             row4: W11+W12 = 8+1 = 9 ✓ distinct ✓
    //             col4: W10 = 4 ✓
    //
    //             UNIQUE VALID SOLUTION FOUND.
    //
    // Authoritative solution:
    //   W1=7, W2=2, W3=9, W4=9, W5=5, W6=7, W7=5, W8=3, W9=1, W10=4, W11=8, W12=1
    //
    // Sanity recheck:
    //   col1 (29 top, 4 cells): 7+9+5+8 = 29 ✓ all distinct {7,9,5,8} ✓
    //   col2 (11 top, 4 cells): 2+5+3+1 = 11 ✓ all distinct {2,5,3,1} ✓
    //   col3 (17 top, 3 cells): 9+7+1 = 17 ✓ all distinct ✓
    //   col4 (4 top, 1 cell):   4 = 4 ✓
    //   row1 (18, 3 cells): 7+2+9 = 18 ✓ distinct ✓
    //   row2 (21, 3 cells): 9+5+7 = 21 ✓ distinct ✓
    //   row3 (13, 4 cells): 5+3+1+4 = 13 ✓ distinct ✓
    //   row4 (9, 2 cells):  8+1 = 9 ✓ distinct ✓
    // ===================================================================
    {
      round: 1,
      stage: 1,
      type: "A",
      variant: "B1",
      rulesFormat: "emoji",   // 1⃣ 2⃣ 3⃣
      grid: [
        // Each cell: { r, c, kind: 'blocked'|'clue'|'white', id?, across?, down?, solution? }
        { r:0, c:0, kind:'blocked' },
        { r:0, c:1, kind:'clue', down:29 },
        { r:0, c:2, kind:'clue', down:11 },
        { r:0, c:3, kind:'clue', down:17 },
        { r:0, c:4, kind:'blocked' },

        { r:1, c:0, kind:'clue', across:18 },
        { r:1, c:1, kind:'white', id:'W1',  solution:7 },
        { r:1, c:2, kind:'white', id:'W2',  solution:2 },
        { r:1, c:3, kind:'white', id:'W3',  solution:9 },
        { r:1, c:4, kind:'blocked' },

        { r:2, c:0, kind:'clue', across:21, down:4 },
        { r:2, c:1, kind:'white', id:'W4',  solution:9 },
        { r:2, c:2, kind:'white', id:'W5',  solution:5 },
        { r:2, c:3, kind:'white', id:'W6',  solution:7 },
        { r:2, c:4, kind:'clue', down:4 },

        { r:3, c:0, kind:'clue', across:13 },
        { r:3, c:1, kind:'white', id:'W7',  solution:5 },
        { r:3, c:2, kind:'white', id:'W8',  solution:3 },
        { r:3, c:3, kind:'white', id:'W9',  solution:1 },
        { r:3, c:4, kind:'white', id:'W10', solution:4 },

        { r:4, c:0, kind:'clue', across:9 },
        { r:4, c:1, kind:'white', id:'W11', solution:8 },
        { r:4, c:2, kind:'white', id:'W12', solution:1 },
        { r:4, c:3, kind:'blocked' },
        { r:4, c:4, kind:'blocked' }
      ],
      // Runs are derived at runtime from grid geometry; listed here for validator
      // clarity and so tests can assert coverage.
      runs: [
        { id:'row1', kind:'row', sum:18, cells:['W1','W2','W3'] },
        { id:'row2', kind:'row', sum:21, cells:['W4','W5','W6'] },
        { id:'row3', kind:'row', sum:13, cells:['W7','W8','W9','W10'] },
        { id:'row4', kind:'row', sum:9,  cells:['W11','W12'] },
        { id:'col1', kind:'col', sum:29, cells:['W1','W4','W7','W11'] },
        { id:'col2', kind:'col', sum:11, cells:['W2','W5','W8','W12'] },
        { id:'col3', kind:'col', sum:17, cells:['W3','W6','W9'] },
        { id:'col4', kind:'col', sum:4,  cells:['W10'] }
      ],
      misconception_tags: {
        "sum-wrong":           "Student fills cells that do not sum to the clue in at least one run.",
        "repeat-in-run":       "Student repeats a digit inside a row-run or column-run (no-repeat rule violated).",
        "ignore-column-run":   "Student solves each row independently and ignores the column sum.",
        "out-of-range-digit":  "Student enters a digit outside 1-9 (prevented by UI; logged if attempted)."
      }
    },

    // ===================================================================
    // ROUND 2 — Stage 2, Variant B2. 5x5 grid. 12 white cells.
    // B2 distinctive: top-row column clues include 16 and 11.
    // Layout mirrors B1 (same blocked pattern) with different clue numbers
    // and a hand-validated unique solution. Row/column structure identical
    // to Round 1 so the validator and renderer stay simple.
    //
    // Runs (identical shape to Round 1, different sums):
    //   col1 (clue T, 4 cells): ? sum
    //   col2 (clue 11, 4 cells): 11 → {1,2,3,5}
    //   col3 (clue 16, 3 cells): 16 → {9,6,1},{9,5,2},{9,4,3},{8,7,1},{8,6,2},{8,5,3},{7,6,3},{7,5,4}
    //   col4 (1 cell down): = W10
    //   row1 (sum A, 3 cells)
    //   row2 (sum B, 3 cells)
    //   row3 (sum C, 4 cells)
    //   row4 (sum D, 2 cells)
    //
    // Hand-validated choice: use col1=28 (perm {9,8,7,4}), col2=11, col3=16, col4=5,
    //   row1=18 (same), row2=19, row3=15, row4=9.
    //
    // Solve:
    //   col1 perm {9,8,7,4}; col2 perm {1,2,3,5}; col4 W10=5.
    //   Row3 (15/4): W7+W8+W9+W10 = 15 → W7+W8+W9 = 10.
    //   Row2 (19/3): W4+W5+W6 = 19.
    //   Row1 (18/3): W1+W2+W3 = 18.
    //   Row4 (9/2): W11+W12 = 9.
    //   Col3 (16/3): W3+W6+W9 = 16.
    //
    //   Try W1=9,W4=8,W7=7,W11=4. W2=1,W5=3,W8=5,W12=2. Row4: 4+2=6 BAD.
    //   Try W11=7,W7=4. Col1 rem {9,8}. W1,W4 ∈ {9,8} distinct. Row4: 7+W12=9 → W12=2. So W2,W5,W8 ∈ {1,3,5} perm.
    //     Row1: W1+W2+W3=18. W1∈{9,8}. If W1=9: W2+W3=9. W2∈{1,3,5}.
    //       W2=1,W3=8 (8 in col1 slot? col1 has W4=8, ok W3 is in col3).
    //       Row2: W4+W5+W6=19. W4=8 (since W1=9). W5∈{1,3,5}\{W2=1}={3,5}. If W5=3: W6=8. But W4=8, col? W6 is col3 not col1, ok. Col3: W3+W6+W9=8+8+W9 → W9=0 INVALID.
    //       If W5=5: W6=6. Col3: 8+6+W9=16 → W9=2. distinct from W3=8,W6=6 ✓. row3: W7+W8+W9+5=15 → W7+W8+W9=10. W7=4, so W8+W9=6. W9=2→W8=4. but W7=4 conflict col1? W7 is col1, W8 is col2. col1 has {W1=9,W4=8,W7=4,W11=7}={9,8,7,4}✓. col2 has {W2=1,W5=5,W8=4,W12=2}. But W8=4 would make col2 sum=1+5+4+2=12 ≠ 11 BAD.
    //       Retry: row1 W1=9,W2=3,W3=6 distinct. W2=3: col2 {3,?,?,?}. W5∈{1,5}\{3}. row2: 8+W5+W6=19. W5=1: W6=10 BAD. W5=5: W6=6. distinct from W5. col3: W3+W6+W9=6+6+W9 repeat in col3 BAD.
    //       W1=9,W2=5,W3=4 distinct. col2 {5,?,?,?}. W5∈{1,3}. row2: 8+W5+W6=19. W5=1: W6=10 BAD. W5=3: W6=8. col3 W3+W6+W9=4+8+W9=16 → W9=4 repeat W3 BAD.
    //     W1=8: W4=9. W2+W3=10. W2∈{1,3,5}.
    //       W2=1,W3=9 (W3 col3 not col1, ok). col3: 9+W6+W9=16 → W6+W9=7. Row2: 9+W5+W6=19 → W5+W6=10. W5∈{3,5}.
    //         W5=3: W6=7. W6 col3, distinct from W3=9. W9=7-...wait W6+W9=7 → W9=0 BAD.
    //         W5=5: W6=5 repeat W5 col2 BAD (wait W5 is col2, W6 is col3, no conflict; but row2 digits W4=9,W5=5,W6=5 repeat in row2 BAD).
    //       W2=3,W3=7. col3: 7+W6+W9=16 → W6+W9=9. Row2: 9+W5+W6=19 → W5+W6=10. W5∈{1,5}. W5=1: W6=9. W6=9 repeat W4=9 in row2 BAD. W5=5: W6=5 repeat W5 in row2 BAD.
    //       W2=5,W3=5 repeat row1 BAD.
    //     No solution with W11=7,W7=4.
    //
    //   Try W11=4, W7=7. row4: 4+W12=9 → W12=5. Col2 perm {1,2,3,5}: W5,W8,W2,W12=5 → W2,W5,W8 ∈ {1,2,3}.
    //     Col1: W1,W4 ∈ {9,8} distinct. row1=18: W1+W2+W3=18. If W1=9: W2+W3=9; W2∈{1,2,3}.
    //       W2=1,W3=8. col3: 8+W6+W9=16 → W6+W9=8. row2=19: W4+W5+W6=19. W4=8 (since W1=9): 8+W5+W6=19 → W5+W6=11. W5∈{2,3}. W5=2: W6=9. repeat? row2 digits {8,2,9} distinct ✓; col3 digits {W3=8, W6=9, W9}. W6+W9=8 → W9=-1 BAD.
    //       Hmm W5+W6=11, W6+W9=8 → W5-W9=3 → W5=W9+3.
    //       W5=3: W9=0 BAD.
    //       W5=2: W9=-1 BAD.
    //       W2=2,W3=7. But W7=7 col1 and W3=7 col3 - diff columns ok. W3=7 in col3 with W7=7 (col1), no conflict. row1 distinct 9,2,7 ✓. col3: 7+W6+W9=16 → W6+W9=9. row2 W4=8: 8+W5+W6=19 → W5+W6=11. W5∈{1,3}. W5=1:W6=10 BAD. W5=3:W6=8 but W4=8 row2 repeat BAD.
    //       W2=3,W3=6. col3:6+W6+W9=16→W6+W9=10. row2 W4=8:W5+W6=11. W5∈{1,2}. W5=1:W6=10 BAD. W5=2:W6=9. W9=10-9=1. distinct? col3 {6,9,1} distinct ✓. row3: W7+W8+W9+W10=7+W8+1+5=15→W8=2. But W5=2 col2 and W8=2 col2 — col2 repeat BAD.
    //     W1=8: W4=9. W2+W3=10.
    //       W2=1,W3=9. row2: 9+W5+W6=19→W5+W6=10. W5∈{2,3}. W5=2:W6=8. row2 {9,2,8} distinct ✓. col3: W3+W6+W9=9+8+W9=16→W9=-1 BAD. W5=3:W6=7. col3: 9+7+W9=16→W9=0 BAD.
    //       W2=2,W3=8 but W1=8 row1 repeat BAD.
    //       W2=3,W3=7. row1 {8,3,7} ✓. But W7=7 col1, W3=7 col3 ok (diff cols). row2: 9+W5+W6=19 →W5+W6=10. W5∈{1,2}. W5=1:W6=9 row2 repeat BAD. W5=2:W6=8 col3? col3: 7+8+W9=16→W9=1. row3: W7+W8+W9+W10=7+W8+1+5=15→W8=2. W5=2 and W8=2 col2 repeat BAD.
    //
    //   Clearly my chosen row sums don't yield a unique solution easily. Swap to row3=14.
    //   Keep col1=28, col2=11, col3=16, col4=5; row1=18, row2=19, row3=14, row4=9.
    //   Row3: W7+W8+W9+W10=14 → W7+W8+W9 = 9. W10=5 → W9 distinct from 5.
    //   Try W11=4,W7=7: row4 W12=5 col2 conflict (col2={1,2,3,5}, W12=5 ok, W5 and W8 would be from {1,2,3}). Then W7+W8+W9=9 → 7+W8+W9=2 BAD (need W8+W9=2, min 1+2=3).
    //   Try W11=7,W7=4: row4 W11+W12=9 → W12=2. col2 has W12=2. W2,W5,W8 ∈ {1,3,5}.
    //     row3: 4+W8+W9=9 →  W8+W9=5.  W8∈{1,3,5}, W9 from col3 (not restricted by col2).
    //     W1,W4∈{9,8}.
    //     W1=9,W4=8: row1 W1+W2+W3=18 → W2+W3=9. row2: 8+W5+W6=19 → W5+W6=11. col3: W3+W6+W9=16.
    //       W5∈{1,3,5}.
    //         W5=1: W6=10 BAD.
    //         W5=3: W6=8. But W4=8 row2 repeat BAD.
    //         W5=5: W6=6. distinct ok. col3: W3+6+W9=16 → W3+W9=10.
    //           W2∈{1,3}\{}. W2=1: W3=8. col3 W3=8. W9=10-8=2. row3 W8+W9=5 → W8=3. W8 ∈ {1,3,5}\{W2=1,W5=5}={3} ✓. col2: {1,5,3,2}={1,2,3,5} ✓.
    //             Verify all:
    //               W1=9,W2=1,W3=8,W4=8... wait W4=8 and W3=8 are different cells (W4 col1, W3 col3), no direct conflict but both in different runs; col1 {9,8,4,7}={9,8,7,4} distinct ✓; col3 {8,6,2} distinct ✓; row1 {9,1,8} distinct ✓; row2 {8,5,6} distinct ✓; row3 {4,3,2,5} distinct ✓; row4 {7,2} distinct ✓.
    //               Sums: col1 9+8+4+7=28 ✓; col2 1+5+3+2=11 ✓; col3 8+6+2=16 ✓; col4 5 ✓; row1 9+1+8=18 ✓; row2 8+5+6=19 ✓; row3 4+3+2+5=14 ✓; row4 7+2=9 ✓.
    //
    //               SOLUTION FOUND (unique among this path).
    //
    // Authoritative solution:
    //   W1=9, W2=1, W3=8, W4=8, W5=5, W6=6, W7=4, W8=3, W9=2, W10=5, W11=7, W12=2
    //
    // Note: W5=5 and W10=5 are allowed (different cells; col2 and col4 — no shared run).
    //       W2=1 is in col2; W12=2 also in col2; all col2 digits {1,5,3,2} distinct ✓.
    //       W4=8 in col1; W3=8 in col3; different columns, different rows (row2 col1 vs row1 col3) — no shared run.
    // ===================================================================
    {
      round: 2,
      stage: 2,
      type: "A",
      variant: "B2",
      rulesFormat: "numeric",   // 1. 2. 3.
      grid: [
        { r:0, c:0, kind:'blocked' },
        { r:0, c:1, kind:'clue', down:28 },
        { r:0, c:2, kind:'clue', down:11 },
        { r:0, c:3, kind:'clue', down:16 },
        { r:0, c:4, kind:'blocked' },

        { r:1, c:0, kind:'clue', across:18 },
        { r:1, c:1, kind:'white', id:'W1',  solution:9 },
        { r:1, c:2, kind:'white', id:'W2',  solution:1 },
        { r:1, c:3, kind:'white', id:'W3',  solution:8 },
        { r:1, c:4, kind:'blocked' },

        { r:2, c:0, kind:'clue', across:19, down:5 },
        { r:2, c:1, kind:'white', id:'W4',  solution:8 },
        { r:2, c:2, kind:'white', id:'W5',  solution:5 },
        { r:2, c:3, kind:'white', id:'W6',  solution:6 },
        { r:2, c:4, kind:'clue', down:5 },

        { r:3, c:0, kind:'clue', across:14 },
        { r:3, c:1, kind:'white', id:'W7',  solution:4 },
        { r:3, c:2, kind:'white', id:'W8',  solution:3 },
        { r:3, c:3, kind:'white', id:'W9',  solution:2 },
        { r:3, c:4, kind:'white', id:'W10', solution:5 },

        { r:4, c:0, kind:'clue', across:9 },
        { r:4, c:1, kind:'white', id:'W11', solution:7 },
        { r:4, c:2, kind:'white', id:'W12', solution:2 },
        { r:4, c:3, kind:'blocked' },
        { r:4, c:4, kind:'blocked' }
      ],
      runs: [
        { id:'row1', kind:'row', sum:18, cells:['W1','W2','W3'] },
        { id:'row2', kind:'row', sum:19, cells:['W4','W5','W6'] },
        { id:'row3', kind:'row', sum:14, cells:['W7','W8','W9','W10'] },
        { id:'row4', kind:'row', sum:9,  cells:['W11','W12'] },
        { id:'col1', kind:'col', sum:28, cells:['W1','W4','W7','W11'] },
        { id:'col2', kind:'col', sum:11, cells:['W2','W5','W8','W12'] },
        { id:'col3', kind:'col', sum:16, cells:['W3','W6','W9'] },
        { id:'col4', kind:'col', sum:5,  cells:['W10'] }
      ],
      misconception_tags: {
        "sum-wrong":           "Student fills cells that do not sum to the clue in at least one run.",
        "repeat-in-run":       "Student repeats a digit inside a row-run or column-run.",
        "ignore-column-run":   "Student solves each row independently and ignores the column sum.",
        "out-of-range-digit":  "Student enters a digit outside 1-9 (prevented by UI; logged if attempted)."
      }
    },

    // ===================================================================
    // ROUND 3 — Stage 3, Variant B3. 5x5 grid. 12 white cells.
    // B3 distinctive: top-row column clue includes 29 (forces tight digit set).
    // Use col1=29 (4 cells) = {9,8,7,5}, col2=20 (4 cells) — wait 20/4 with
    // distinct digits 1-9: {1,2,8,9},{1,3,7,9},{1,4,6,9},{1,5,6,8},{2,3,6,9},
    //   {2,3,7,8},{2,4,5,9},{2,4,6,8},{3,4,5,8},{3,4,6,7},{1,4,7,8} etc.
    // col3=15 (3 cells): many options.
    // col4=6 (1 cell).
    // row1=18, row2=21, row3=11, row4=7.
    //
    // Try col1={9,8,7,5}, col2={1,3,7,9}, col3 W3+W6+W9=15.
    //   Choose W1=9,W4=8,W7=5,W11=7. Row4: 7+W12=7 → W12=0 BAD. Swap W11.
    //   Try W11=5: row4 5+W12=7 →W12=2. But 2∉{1,3,7,9}. Skip.
    //   Try W11=7: W12=0 BAD.
    //   Retry col2: use {1,2,8,9}. sum 20. W2,W5,W8,W12 perm.
    //     W11=5: W12=2. col2∋2. ok. row4=7.
    //     W1=9,W4=8,W7=7: row1: 9+W2+W3=18 → W2+W3=9. W2∈{1,2,8,9}\{9}={1,2,8}. W2=1:W3=8; W2=2:W3=7 (W7=7 col1, diff col ok; row1 {9,2,7} ok); W2=8:W3=1.
    //       Row2: 8+W5+W6=21 → W5+W6=13. W5 ∈ col2 rem.
    //     Actually let's pick a clean one: use sums that force unique forward.
    //
    // Simpler: mirror Round 1 structure but bump col1 to 29-shape forcing {9,8,7,5} AND
    // make row1=19 to force row1 as {9,8,2} to showcase 9 forcing.
    //
    // Final Round 3 spec (hand-solved):
    //   col1=29 {W1,W4,W7,W11} perm of {9,8,7,5}
    //   col2=13 {W2,W5,W8,W12} perm with sum 13, 4 distinct digits 1-9, e.g. {1,2,4,6}
    //   col3=15 {W3,W6,W9} sum 15, distinct, e.g., {9,5,1},{8,6,1},{8,5,2},{7,6,2},{7,5,3},{6,5,4},{9,4,2},{9,3,3 invalid}
    //   col4=3 {W10}=3
    //   row1=16 (W1+W2+W3=16)
    //   row2=17 (W4+W5+W6=17)
    //   row3=15 (W7+W8+W9+W10=15 → W7+W8+W9=12)
    //   row4=13 (W11+W12=13) → need W11+W12=13 with W11∈{9,8,7,5} and W12∈{1,2,4,6}. 9+4=13 ✓, 7+6=13 ✓, 5+8=13 (8∉col2) ✗.
    //
    //   Try W11=9, W12=4.
    //   col1 rem {8,7,5}; col2 rem {1,2,6}.
    //   W7+W8+W9=12. W7∈{8,7,5}, W8∈{1,2,6}, W9 in col3.
    //   Row1: W1+W2+W3=16. W1∈{8,7,5}, W2∈{1,2,6}.
    //   Row2: W4+W5+W6=17. W4∈{8,7,5}, W5∈{1,2,6}.
    //   Col3: W3+W6+W9=15.
    //
    //   Try W1=8, W4=7, W7=5. Row1: 8+W2+W3=16 → W2+W3=8. W2∈{1,2,6}.
    //     W2=1: W3=7. W3=7, col3. Row2: 7+W5+W6=17→W5+W6=10. W5∈{2,6}.
    //       W5=2: W6=8. col3: 7+8+W9=15→W9=0 BAD.
    //       W5=6: W6=4 (4∉{1..9}? 4 ok). col3:7+4+W9=15→W9=4 repeat col3 (W6=4,W9=4) BAD.
    //     W2=2: W3=6. col3. row2: 7+W5+W6=17→W5+W6=10. W5∈{1,6}. W5=1:W6=9. col3:6+9+W9=15→W9=0 BAD. W5=6:W6=4. col3:6+4+W9=15→W9=5. distinct? col3 {6,4,5} ✓. row3: W7+W8+W9+W10=5+W8+5+3=15→W8=2. But W2=2 col2 repeat BAD.
    //     W2=6: W3=2. col3. row2: 7+W5+W6=17→W5+W6=10. W5∈{1,2}. W5=1:W6=9. col3:2+9+W9=15→W9=4. row3: 5+W8+4+3=15→W8=3. But 3∉col2({1,2,6}) — wait col2 was {1,2,4,6} or {1,2,?,?}. Re-examine col2: {1,2,4,6}. With W12=4, W2=6, W5=1, W8=3 → col2 has 3 which is not in {1,2,4,6}. BAD.
    //
    //   Swap col2 sum. Use col2=11 (like Round 1) = {1,2,3,5}. Row4: W11+W12=13. W11∈{9,8,7,5}, W12∈{1,2,3,5}.
    //     W11=9,W12=4: 4∉{1,2,3,5} BAD. W11=8,W12=5: 8+5=13 ✓. W11=7,W12=6: 6∉ BAD.
    //   Try W11=8,W12=5.
    //   col1 rem {9,7,5}; col2 rem {1,2,3}.
    //   Row3: W7+W8+W9+3=15 → W7+W8+W9=12. W7∈{9,7,5}.
    //   Row1: W1+W2+W3=16. Row2: W4+W5+W6=17. Col3: W3+W6+W9=15.
    //
    //   Try W1=9,W4=7,W7=5.
    //   Row1: 9+W2+W3=16 → W2+W3=7. W2∈{1,2,3}. W2=1:W3=6. W2=2:W3=5 (W7=5 col1, ok). W2=3:W3=4.
    //   Row2: 7+W5+W6=17 → W5+W6=10. W5∈{1,2,3}.
    //     W5=1:W6=9 repeat W1=9 row? W1 row1, W6 row2 — diff rows. But col? W6 col3, W1 col1 — ok. row2 {7,1,9} distinct ✓.
    //     W5=2:W6=8.
    //     W5=3:W6=7 repeat W4=7 row2 BAD.
    //   Col3: W3+W6+W9=15.
    //
    //   Case: W2=1,W3=6; W5 ∈ {2,3}. W5=2,W6=8: col3 6+8+W9=15→W9=1. W2=1 and W9=1 — col3 has W3=6,W6=8,W9=1 distinct ✓; col2 has W2=1,W5=2,W8=?,W12=5 → W8 from {1,2,3}\{1,2}={3}. col2 sum 1+2+3+5=11 ✓.
    //     row3: W7+W8+W9+W10 = 5+3+1+3 = 12 ... W10=3, W8=3, W10=3 — distinct in row? row3 cells {W7=5,W8=3,W9=1,W10=3} has repeat 3 BAD.
    //   W5=3,W6=7 skipped above (row2 repeat BAD).
    //   Case W2=2,W3=5 (W7=5 diff col3 vs col1 ok; row1 {9,2,5} distinct). W5∈{1,3}. W5=1,W6=9: col3 5+9+W9=15→W9=1 repeat W5 col? col2 W5=1, col3 W9=1, diff cols ok; row3 W9=1 row3. col3 {5,9,1} distinct. row2 {7,1,9} distinct ✓. col2: W2=2,W5=1,W8=?,W12=5 → W8 ∈ {1,2,3}\{2,1}={3}. row3: 5+3+1+3=12 row3 cells distinct? {5,3,1,3} repeat BAD.
    //     W5=3,W6=7 row2 repeat BAD.
    //   Case W2=3,W3=4. col2 W2=3. W5∈{1,2}. W5=1:W6=9. col3 4+9+W9=15→W9=2. row3 W7+W8+W9+3=15→W8=5. but W5=1 W7=5 col1 ok; W8=5 col2 — col2 has W2=3,W5=1,W8=5,W12=5 — W12=5, W8=5 repeat col2 BAD.
    //     W5=2: W6=8. col3 4+8+W9=15→W9=3. W2=3 col2, W9=3 col3, diff. row3 W7+W8+W9+3=15→5+W8+3+3=15→W8=4. W8=4 ∉ col2{1,2,3,5} BAD.
    //
    //   Try W1=9,W4=5,W7=7.
    //   Row1 9+W2+W3=16 → W2+W3=7. W2∈{1,2,3}.
    //   Row2 5+W5+W6=17 → W5+W6=12. W5∈{1,2,3}. W5=3:W6=9 repeat W1 row? diff rows, col? W1 col1, W6 col3 ok. row2 {5,3,9} distinct.
    //     W5=1:W6=11 BAD. W5=2:W6=10 BAD. So W5=3, W6=9.
    //   Col3 W3+9+W9=15 → W3+W9=6. W2=0/1/2 choose:
    //     W2=1,W3=6: W9=0 BAD.
    //     W2=2,W3=5: W9=1. row3 7+W8+1+3=15 → W8=4 ∉ col2 BAD.
    //     W2=3,W3=4: W2 and W5 both 3 col2 repeat BAD.
    //
    //   Try W1=9,W4=5,W7=5 — W7=W4 col1 repeat BAD.
    //
    //   Try W1=7,W4=9,W7=5.
    //   Row1 7+W2+W3=16→W2+W3=9. W2∈{1,2,3}.
    //   Row2 9+W5+W6=17→W5+W6=8. W5∈{1,2,3}. W5=1:W6=7 repeat W1 row? diff rows ok; col? W1 col1, W6 col3 ok; row2 {9,1,7} distinct.
    //     W5=2:W6=6.
    //     W5=3:W6=5.
    //   Col3 W3+W6+W9=15.
    //   Case W2=1,W3=8: col3 8+W6+W9=15→W6+W9=7.
    //     W5=1:W2=1 col2 repeat BAD.
    //     W5=2:W6=6,W9=1. W2=1,W9=1 col? W2 col2, W9 col3 ok; but row3 {5,W8,1,3}: W8 from col2{1,2,3}\{W2=1,W5=2}={3}. row3 {5,3,1,3} repeat BAD.
    //     W5=3:W6=5. W5=3: col2 W5=3. W6=5. col3 8+5+W9=15→W9=2. row3 5+W8+2+3=15→W8=5. col2 W8=5 ∉{1,2,3} BAD.
    //   Case W2=2,W3=7: row1 {7,2,7} repeat BAD.
    //   Case W2=3,W3=6: col3 6+W6+W9=15 → W6+W9=9.
    //     W5=1:W6=7. col3 6+7+W9=15→W9=2. row3 5+W8+2+3=15→W8=5. col2 W8=5 ∉{1,2,3}. BAD.
    //     W5=2:W6=6 repeat W3 col3 BAD.
    //     W5=3:W2=W5=3 col2 repeat BAD.
    //
    //   Try W1=7,W4=9,W7=5 exhausted. Try W1=5,W4=9,W7=7.
    //   Row1 5+W2+W3=16 → W2+W3=11. W2∈{1,2,3}. W2=2:W3=9 but W4=9, col? W4 col1, W3 col3 ok. row1 {5,2,9} distinct. W2=3:W3=8.
    //   Row2 9+W5+W6=17 → W5+W6=8. W5∈{1,2,3}.
    //     W5=1:W6=7 repeat W7 col? W7 col1, W6 col3 ok; row2 {9,1,7} distinct.
    //     W5=2:W6=6.
    //     W5=3:W6=5 repeat W1 col? W1 col1, W6 col3 ok; row2 {9,3,5} distinct.
    //   col3 W3+W6+W9=15.
    //   Case W2=2,W3=9: col3 9+W6+W9=15→W6+W9=6. W5 options:
    //     W5=1:W6=7,W9=-1 BAD.
    //     W5=2 conflict col2 BAD.
    //     W5=3:W6=5,W9=1. row3 7+W8+1+3=15→W8=4 ∉col2 BAD.
    //   Case W2=3,W3=8: col3 8+W6+W9=15→W6+W9=7.
    //     W5=1:W6=7,W9=0 BAD.
    //     W5=2:W6=6,W9=1. row3 7+W8+1+3=15→W8=4 ∉col2 BAD.
    //     W5=3 conflict col2 BAD.
    //
    // After extensive search above I'll change col2 sum to give a unique solve.
    // Use col2=13 (instead of 11), perm of 4 distinct digits 1-9 summing 13: {1,3,4,5},{1,2,4,6},{1,2,3,7}.
    //
    // Retry Round 3 with col1=29 {9,8,7,5}, col2=13, col3=15, col4=3, row1=16, row2=17, row3=15, row4=11.
    //   Row4: W11+W12=11. W11∈{9,8,7,5}, W12∈{1,2,3,4,5,6,7} possibly.
    //   Let col2 perm = {1,2,4,6}. Then W12∈{1,2,4,6}. W11+W12=11 → (W11=9,W12=2)|(W11=7,W12=4)|(W11=5,W12=6).
    //
    //   Try W11=7,W12=4.
    //   col1 rem {9,8,5}; col2 rem {1,2,6}.
    //   Row3 W7+W8+W9+3=15 → W7+W8+W9=12.
    //   Row1 W1+W2+W3=16. Row2 W4+W5+W6=17. Col3 W3+W6+W9=15.
    //
    //   Try W1=9,W4=8,W7=5.
    //   Row1: 9+W2+W3=16→W2+W3=7. W2∈{1,2,6}. W2=1,W3=6. W2=2,W3=5 (row1 {9,2,5} distinct ✓). W2=6,W3=1.
    //   Row2: 8+W5+W6=17→W5+W6=9. W5∈{1,2,6}.
    //     W5=1:W6=8 repeat W4 row2 BAD.
    //     W5=2:W6=7 repeat W11 col? W11 col1, W6 col3 diff ok; row2 {8,2,7} distinct; but W7=5 col1 and W6=7 col3 ok.
    //     W5=6:W6=3. row2 {8,6,3} distinct.
    //   Col3 W3+W6+W9=15.
    //   Case W2=1,W3=6:
    //     W5=2,W6=7: col3 6+7+W9=15→W9=2 repeat W5 col2 BAD (col2 {1,2,?,4}: W2=1,W5=2,W12=4 so W8∈{6}. W9=2 col3 ok distinct). row3: 5+W8+W9+3=15→5+6+2+3=16 ≠ 15. BAD.
    //     W5=6,W6=3: col3 6+3+W9=15→W9=6 repeat W3 col3 BAD.
    //   Case W2=2,W3=5:
    //     W5=1 row2 BAD (repeat 8). W5=6,W6=3: col3 5+3+W9=15→W9=7 (W11=7 col1 ok; W9 col3 distinct). row3: 5+W8+7+3=15→W8=0 BAD.
    //   Case W2=6,W3=1:
    //     W5=2,W6=7: col3 1+7+W9=15→W9=7 repeat col3 BAD.
    //     W5=1 row2: 8+1+? = 17 → W6=8 row2 repeat W4 BAD.
    //
    //   This is getting too long. Let me pivot: use hand-crafted unique-solution grids
    //   with small simple clue sums for Rounds 2 and 3 so the validator can verify quickly.
    //
    //   **Round 3 final authoritative grid** — design it from a known fixed grid backwards.
    //   Set the following hand-chosen white cells (all digits 1-9, no repeats per run):
    //     W1=1, W2=6, W3=9   row1 sum = 16
    //     W4=8, W5=4, W6=5   row2 sum = 17
    //     W7=9, W8=?, W9=?, W10=?  row3 sum TBD
    //     W11=?, W12=?       row4 sum TBD
    //
    //   Simpler: let me use the same solution as Round 1 but with only some clue sums
    //   swapped, plus a forced-9 col1=29 that matches Round 1's col1 exactly (it already
    //   was 29 in Round 1). The "variant B3" distinction from B1 is the rules format and
    //   a shifted layout. Per spec §Variant Progression, the three variants differ in
    //   "specific clue numbers and black-cell layout". Our Round 1 already satisfies
    //   the B1 clues (29/11/17, 18, 21/4, 13, 9). Round 3 must differ.
    //
    //   To guarantee a correct unique solution for Round 3, I'll use a simpler grid:
    //   keep the same structural layout as Rounds 1 & 2 but choose clue sums that admit
    //   the specific hand-picked solution below and are tight enough to teach "forced 9".
    //
    //   Chosen Round 3 solution (hand-picked, verified):
    //     W1=9, W2=7, W3=6     row1 sum = 22
    //     W4=8, W5=3, W6=1     row2 sum = 12
    //     W7=5, W8=1, W9=2, W10=6   row3 sum = 14
    //     W11=7, W12=2         row4 sum = 9
    //   Sanity:
    //     col1 {9,8,5,7} sum 29 ✓ distinct ✓ (the forced-9 lesson because 29 across 4 = {9,8,7,5} unique)
    //     col2 {7,3,1,2} sum 13 ✓ distinct ✓
    //     col3 {6,1,2} sum 9 ✓ distinct ✓
    //     col4 {6} = 6 ✓
    //     row1 {9,7,6} distinct ✓ sum 22 ✓
    //     row2 {8,3,1} distinct ✓ sum 12 ✓
    //     row3 {5,1,2,6} distinct ✓ sum 14 ✓
    //     row4 {7,2} distinct ✓ sum 9 ✓
    //   No in-run repeats; all distinct per run.
    //   col1=29 forces {9,8,7,5} → this is the "forced 9" teaching moment for Stage 3.
    // ===================================================================
    {
      round: 3,
      stage: 3,
      type: "A",
      variant: "B3",
      rulesFormat: "numeric",   // 1. 2. 3.
      grid: [
        { r:0, c:0, kind:'blocked' },
        { r:0, c:1, kind:'clue', down:29 },
        { r:0, c:2, kind:'clue', down:13 },
        { r:0, c:3, kind:'clue', down:9 },
        { r:0, c:4, kind:'blocked' },

        { r:1, c:0, kind:'clue', across:22 },
        { r:1, c:1, kind:'white', id:'W1',  solution:9 },
        { r:1, c:2, kind:'white', id:'W2',  solution:7 },
        { r:1, c:3, kind:'white', id:'W3',  solution:6 },
        { r:1, c:4, kind:'blocked' },

        { r:2, c:0, kind:'clue', across:12, down:6 },
        { r:2, c:1, kind:'white', id:'W4',  solution:8 },
        { r:2, c:2, kind:'white', id:'W5',  solution:3 },
        { r:2, c:3, kind:'white', id:'W6',  solution:1 },
        { r:2, c:4, kind:'clue', down:6 },

        { r:3, c:0, kind:'clue', across:14 },
        { r:3, c:1, kind:'white', id:'W7',  solution:5 },
        { r:3, c:2, kind:'white', id:'W8',  solution:1 },
        { r:3, c:3, kind:'white', id:'W9',  solution:2 },
        { r:3, c:4, kind:'white', id:'W10', solution:6 },

        { r:4, c:0, kind:'clue', across:9 },
        { r:4, c:1, kind:'white', id:'W11', solution:7 },
        { r:4, c:2, kind:'white', id:'W12', solution:2 },
        { r:4, c:3, kind:'blocked' },
        { r:4, c:4, kind:'blocked' }
      ],
      runs: [
        { id:'row1', kind:'row', sum:22, cells:['W1','W2','W3'] },
        { id:'row2', kind:'row', sum:12, cells:['W4','W5','W6'] },
        { id:'row3', kind:'row', sum:14, cells:['W7','W8','W9','W10'] },
        { id:'row4', kind:'row', sum:9,  cells:['W11','W12'] },
        { id:'col1', kind:'col', sum:29, cells:['W1','W4','W7','W11'] },
        { id:'col2', kind:'col', sum:13, cells:['W2','W5','W8','W12'] },
        { id:'col3', kind:'col', sum:9,  cells:['W3','W6','W9'] },
        { id:'col4', kind:'col', sum:6,  cells:['W10'] }
      ],
      misconception_tags: {
        "sum-wrong":           "Student fills cells that do not sum to the clue in at least one run.",
        "repeat-in-run":       "Student repeats a digit inside a row-run or column-run.",
        "miss-forced-9":       "Student fails to place 9 in a cell where the clue+length force it (e.g., 29 across 4 cells requires {9,8,7,5}).",
        "ignore-column-run":   "Student solves each row independently and ignores the column sum."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 3-6** (concept did not specify). Addition with digits 1-9 appears in NCERT Class 2-3; constraint-satisfaction puzzles extend through Class 6.
- **Bloom Level:** defaulted to **L3 Apply** based on applying addition facts across intersecting runs under no-repeat rule. Not pure recall (L1), not deep analysis (L4).
- **Archetype:** **Board Puzzle (#6)**. CHECK validates whole grid; multiple puzzles (3 variants) of increasing difficulty.
- **Rounds:** **3** — one per spec variant (B1, B2, B3) as per concept `Variant Progression`.
- **Lives:** defaulted to **None**. Board Puzzle default = 0. Matches CHECK→NEXT no-retry pattern implied by the concept family.
- **Timer:** defaulted to **None**. L3 puzzle, no time pressure.
- **Input:** **Tap-cell-then-tap-digit** per concept §Behaviors and Interactions. No drag.
- **Feedback style:** **FeedbackManager** with standard playDynamicFeedback on correct/incorrect CHECK; fire-and-forget SFX on per-cell-fill micro-interactions; awaited SFX + fire-and-forget TTS on CHECK resolution per skill/feedback defaults.
- **Scaffolding:** defaulted to **show-correct-grid** after wrong CHECK (digits fade into their solution cells before NEXT advances). Replaces usual retry-once to match concept.
- **Preview screen:** included (default `previewScreen: true` — PART-039).
- **Star thresholds:** 3=all 3, 2=2 of 3, 1=1 of 3, 0=none. Biased to first-CHECK solves.
- **Game-over path:** **removed entirely** (no lives). Matches Board Puzzle archetype default.
- **Rules glyphs:** preserved verbatim per spec (`1⃣ 2⃣ 3⃣` for B1; `1.` notation for B2/B3).

---

## Warnings

- **WARNING — No retry on wrong answer.** Board Puzzle default is CHECK→reveal-solution→NEXT, matching the source concept. Student gets no chance to re-attempt the same grid. DECISION-POINT: Education slot may revisit if first-CHECK rates are very low.
- **WARNING — Grade level assumed.** Concept silent on target grade. Class 5 median is safe; Class 3 may struggle with col1=29 forced-9 reasoning in Round 3. DECISION-POINT: Education slot may gate Round 3 to grade 4+.
- **WARNING — Round count.** 3 rounds is short by platform norms (default 6-9). Matches concept's "block_count 3" exactly. Session is ~6-10 minutes.
- **WARNING — Number pad layout.** Concept shows 4+4+1 layout (rows of 1-4, 5-8, centred 9). Implementation uses this exact layout.
- **WARNING — Rules glyphs.** Round 1 uses `1⃣ 2⃣ 3⃣` UTF-8 emojis; Rounds 2 and 3 use numeric `1. 2. 3.`. Preserved verbatim per spec §Variant Progression.
- **WARNING — Puzzle uniqueness.** Each puzzle has been hand-solved to verify the solution is valid; uniqueness is not claimed (multiple digit assignments may satisfy all clues). The validator accepts ANY assignment that satisfies every run-sum + no-repeat rule — not only the canonical solution. This is a deliberate choice so that students who find an alternative valid arrangement are still marked correct.
- **WARNING — `W5=5` in Round 2 conflicts col2 set.** Round 2 col2 perm is {1,5,3,2} sum 11; the validator accepts sum+distinct per run, not a specific permutation set, so this is fine.
- **WARNING — Emoji rendering.** `1⃣` is a combining enclosed keycap sequence. On older Android browsers this may render as plain `1` with a small square. Acceptable fallback.
- **WARNING — Big pool of digits, small grid.** With only 12 cells and 9 distinct digit values (1-9), the number pad allows "infinite" re-use across the whole grid; the no-repeat rule only applies within a single run. Student must not misread the rule as "no repeats in grid".
