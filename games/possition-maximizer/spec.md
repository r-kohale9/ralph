# Game Design: Position Maximizer

## Identity
- **Game ID:** position-maximizer
- **Title:** Position Maximizer
- **Class/Grade:** Grades 6–8 (Class 6–8, NCERT "Knowing Our Numbers" / "Playing With Numbers" extension)
- **Math Domain:** Number System — Place Value
- **Topic:** Multi-number place-value optimization (magnitude reasoning across three numbers formed on a shared cross-grid)
- **Bloom Level:** L4 Analyze
- **Archetype:** Board Puzzle (#6) — Standalone shape (a single cross-grid IS the game; no sequential rounds).

## One-Line Concept
The student drags 3 digit tiles into 3 empty slots of a cross-shaped grid that forms three numbers (5-digit, 4-digit, 3-digit), committing a single placement that maximizes the sum of all three — forcing explicit reasoning about how each slot's place value weights the same digit differently.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Place-value magnitude reasoning | Recognize that the same digit contributes 1×, 10×, 100×, 1000×, or 10,000× depending on its position | A (Cross-grid puzzle) |
| Multi-number optimization | Compare the weighted contribution of a digit across three different numbers simultaneously | A (Cross-grid puzzle) |
| Shared-cell reasoning | Reason about intersection cells that contribute to two numbers at once (a digit at the shared intersection counts in both N2 and N3) | A (Cross-grid puzzle) |
| Deliberate commitment | Treat a single Submit as a high-stakes decision, using free rearrangement before locking in | A (Cross-grid puzzle) |

## Core Mechanic

### Type A: "Cross-Grid Digit Placement"

1. **What the student sees**
   - A cross-shaped grid holding three numbers simultaneously:
     - **Number 1 (vertical, 5 digits, top-to-bottom):** ten-thousands, thousands, hundreds, tens, ones.
     - **Number 2 (horizontal, 4 digits, left-to-right):** thousands, hundreds, tens, ones.
     - **Number 3 (vertical-right, 3 digits, top-to-bottom):** hundreds, tens, ones.
   - **Two shared intersection cells:**
     - The **middle cell** (row 3 of N1 = col 2 of N2): belongs to N1's thousands place AND N2's hundreds place. This cell is PRE-FILLED.
     - The **top-right cell** (col 4 of N2 = top of N3): belongs to N2's ones place AND N3's hundreds place. This cell is EMPTY.
   - Cells are drawn in two visual states:
     - **Solid border, filled background:** pre-filled cell — digit is fixed and non-interactive.
     - **Dashed border, empty interior:** empty drop slot waiting for a tile.
   - A **tile tray** below the grid holds 3 digit tiles (one per empty slot).
   - A **Submit** button at the bottom is disabled until all 3 slots are filled.
   - The three numbers are labelled visually (N1 / N2 / N3) with an on-screen "Goal: maximise N1 + N2 + N3" prompt.

2. **What the student does (input type)**
   - Drag a digit tile from the tray into any empty dashed slot (PART-033 drag-and-drop).
   - Tap a filled slot to return its tile to the tray (free rearrangement, no cost).
   - Rearrange freely; nothing is evaluated during placement.
   - Once all 3 slots are filled, the Submit button becomes active.
   - Tap Submit to commit.

3. **What counts as correct**
   - The placement is correct if and only if the resulting N1 + N2 + N3 equals the **maximum achievable sum** for the given tiles and fixed cells.
   - Any other placement — even one that is "close" — is wrong. No partial credit.

4. **What feedback plays (details in Feedback section)**
   - **Correct Submit:** SFX + celebration sticker (awaited), then dynamic TTS with subtitle: "Perfect! You placed 9 in the ten-thousands slot — that contributes 90,000 to the sum." 1 star awarded. Game ends in Victory state.
   - **Wrong Submit:** SFX + sad sticker (awaited), then dynamic TTS with subtitle giving a worked-example hint that names the specific misplacement and its magnitude cost: "Not quite. You placed 9 in the ones place, contributing only 9. In the ten-thousands slot it would have contributed 90,000." Single life lost → Game Over (0 stars).

## Rounds & Progression

### Stage 1: The Round (single puzzle)
- **Round count:** 1 (this is a Board Puzzle / Standalone — the cross-grid IS the game).
- **Interaction type:** A — Cross-grid digit placement.
- **Difficulty parameters:**
  - 3 empty slots with sharply contrasting place-value weights: ten-thousands (×10,000), thousands (×1,000), and a shared intersection slot worth ×101 (×1 in N2 + ×100 in N3).
  - 3 digit tiles with distinct magnitudes forcing a clear priority ordering (one big digit, one medium, one small).
  - One "tempting trap" — the top-right shared slot is visually salient (intersection of two numbers) and weighs ×101, which is bigger than the thousands slot's ×1,000 *only if the student miscounts*. This pulls students who reason on "number of contributions" rather than "magnitude".

Because this is a standalone (1-round) game, there is no stage table to compare across — the difficulty is a single carefully-chosen configuration.

## Game Parameters
- **Rounds:** 1 (exactly one puzzle; single commitment)
- **Timer:** None
- **Lives:** 1 (one Submit, no retries)
- **Star rating:**
  - 1 star = exact maximum sum achieved on Submit
  - 0 stars = any non-maximum placement
  - (No 2-star or 3-star tiers — the game is 1-star max by design)
- **Input:** Drag-and-drop tiles (PART-033) + tap-to-return on filled slots + tap Submit button.
- **Feedback:** Single-step style (SFX → dynamic TTS with subtitle + sticker, awaited) using FeedbackManager (PART-017). Wrong-answer TTS is a worked-example hint that quantifies the magnitude cost of the specific misplacement.

## Scoring
- **Points:** 1 point if N1 + N2 + N3 equals the computed maximum; 0 points otherwise.
- **Stars:**
  - 1 star = 1 point (correct maximum)
  - 0 stars = 0 points (any wrong placement)
- **Lives:** 1 life. Lost on a wrong Submit. At 0 lives → Game Over screen (standalone shape: no retry flow).
- **Partial credit:** None. Off-by-one placements, "almost-maximum" sums, and "got two of three right" all score 0 stars. This is a deliberate pedagogical choice — place-value optimization is a single analytical decision, not a series of independent parts.

## Flow

**Shape:** Standalone (`totalRounds: 1`).

```
┌──────────┐ tap    ┌────────────┐ submit  ┌──────────────────┐
│ Preview  ├───────▶│ Game (Q1)  ├────────▶│ Feedback 2s      ├──▶ Game End
│ 🔊 prev  │        │ 🔊 prompt  │         │ ✓ / ✗            │    {stars, correct,
└──────────┘        │ no progress│         │ stars auto-given │     livesLeft}
                    │ bar        │         │ lives decr if ✗  │    → host resumes
                    └────────────┘         └──────────────────┘
```

**Changes from default:** None (pure Shape 1 Standalone — Preview → Game → Feedback → Game End; no Welcome, no Round-N intro, no Victory/Game-Over screens, no retry, no Play Again, no Claim Stars). Stars are awarded automatically at feedback end. The 1-life counter is tracked internally for the `game_complete` payload but is not rendered as a progress bar (standalone shape has no progress bar).

## Feedback
| Event | Behavior |
|-------|----------|
| Tile dragged onto empty slot | Soft snap SFX (fire-and-forget); tile visually locks into slot; submit button re-evaluates its enabled state. |
| Tile returned from filled slot (tap) | Deselect SFX (fire-and-forget); tile returns to tray; slot reverts to empty dashed state; submit button disables if fewer than 3 slots now filled. |
| Invalid drag (drop outside any slot) | No SFX; tile springs back to tray position (standard drag-cancel). |
| All 3 slots filled | Submit button transitions from disabled to enabled with a subtle highlight; no audio. |
| Submit tapped with correct (maximum) placement | `recordAttempt({ correct: true, … })`. Input blocked. Correct-answer SFX with celebration sticker (awaited). Then dynamic TTS with subtitle + sticker (awaited): "Perfect! Placing 9 in the ten-thousands slot adds 90,000 — the biggest possible jump." 1 star animation. `game_complete` postMessage with `{ correct: true, stars: 1, livesLeft: 1 }` sent BEFORE audio. Game End fires after feedback. |
| Submit tapped with wrong placement | `recordAttempt({ correct: false, … })`. Input blocked. Wrong-answer SFX with sad sticker (awaited). Then dynamic TTS with subtitle + sticker (awaited): a worked-example hint naming the highest-magnitude error, e.g. "Not quite! You placed 9 in the ones place, contributing 9. The ten-thousands slot would have contributed 90,000." Lives decrement to 0. Standalone shape: no retry, no Game Over screen — the Feedback screen itself is terminal. `game_complete` postMessage with `{ correct: false, stars: 0, livesLeft: 0 }` sent BEFORE audio. Game End fires after feedback. |
| Visibility hidden (tab switch) | All audio pauses; "Game Paused" overlay; drag in progress is cancelled. |
| Visibility restored | Audio resumes; overlay dismisses; state preserved. |

**Tone:** Warm on correct ("Perfect!"), gentle redirect on wrong ("Not quite!" — never "wrong", "fail", "lose"). Even though this is a high-stakes single-shot game, the wrong-answer VO emphasizes *what the student learned* about magnitude, not that they "failed".

## Content Structure (fallbackContent)

Preview fields are included (previewScreen defaults to `true`).

The round object describes a single cross-grid configuration. The pipeline computes `maxSum` at load time and marks the specific placement that produces it as correct; any other total is wrong.

Grid coordinate system (row, col) — rows 0–4 top to bottom, columns 0–3 left to right:

| Coord | Belongs to | Place value | State |
|-------|-----------|-------------|-------|
| (0, 0) | N1 | ten-thousands (×10,000) | **Empty** (slot S1) |
| (1, 0) | N2 | thousands (×1,000) | **Empty** (slot S2) |
| (1, 1) | N1 thousands AND N2 hundreds | ×1,000 + ×100 | Fixed = 7 |
| (1, 2) | N2 | tens (×10) | Fixed = 8 |
| (1, 3) | N2 ones AND N3 hundreds | ×1 + ×100 | **Empty** (slot S3) |
| (2, 1) | N1 | hundreds (×100) | Fixed = 6 |
| (2, 3) | N3 | tens (×10) | Fixed = 7 |
| (3, 1) | N1 | tens (×10) | Fixed = 3 |
| (3, 3) | N3 | ones (×1) | Fixed = 6 |
| (4, 1) | N1 | ones (×1) | Fixed = 3 |

(Any (row, col) not listed is a structure-only empty cell — no border, no interaction.)

Tile tray contains digits: **9, 2, 2**.

Slot weights (contribution per unit of digit value to the sum N1+N2+N3):
- S1 (N1 ten-thousands): 10,000
- S2 (N2 thousands): 1,000
- S3 (N2 ones + N3 hundreds shared): 1 + 100 = 101

Maximum-sum placement (correct):
- S1 ← 9 → contributes 90,000
- S2 ← 2 → contributes 2,000
- S3 ← 2 → contributes 202
- Fixed-cell sum (N1: 7,000+600+30+3; N2: 700+80; N3: 70+6) = 7,633 + 780 + 76 = 8,489
- **Max sum = 90,000 + 2,000 + 202 + 8,489 = 100,691**

The two tiles with digit 2 are interchangeable between S2 and S3 — both orderings yield the same maximum. All other assignments are strictly less, so the game evaluates by comparing the submitted total against `maxSum` rather than by exact-slot match.

```js
const fallbackContent = {
  previewInstruction: '<p><strong>Place the 3 digit tiles into the empty slots to make the biggest total!</strong></p><p>Add Number&nbsp;1 + Number&nbsp;2 + Number&nbsp;3. Think about which slot is worth the most before you submit — you only get one try.</p>',
  previewAudioText: 'Place three digit tiles into the empty slots on the cross grid. You want to make the biggest total when you add all three numbers together. Each slot is worth a different amount, so think carefully about where each digit goes. You only get one chance to submit.',
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: "A",
      puzzleId: "cross-9-2-2",
      prompt: "Place the 3 tiles to make N1 + N2 + N3 as big as possible.",
      grid: {
        numbers: {
          N1: { orientation: "vertical",   length: 5, cells: [[0,0],[1,1],[2,1],[3,1],[4,1]], label: "Number 1 (5 digits)" },
          N2: { orientation: "horizontal", length: 4, cells: [[1,0],[1,1],[1,2],[1,3]],       label: "Number 2 (4 digits)" },
          N3: { orientation: "vertical",   length: 3, cells: [[1,3],[2,3],[3,3]],             label: "Number 3 (3 digits)" }
        },
        fixed: {
          "1,1": 7,   // shared N1-thousands + N2-hundreds
          "1,2": 8,   // N2 tens
          "2,1": 6,   // N1 hundreds
          "2,3": 7,   // N3 tens
          "3,1": 3,   // N1 tens
          "3,3": 6,   // N3 ones
          "4,1": 3    // N1 ones
        },
        slots: [
          { id: "S1", coord: [0,0], belongsTo: ["N1"],        placeValues: { N1: 10000 },             weight: 10000 },
          { id: "S2", coord: [1,0], belongsTo: ["N2"],        placeValues: { N2: 1000  },             weight: 1000  },
          { id: "S3", coord: [1,3], belongsTo: ["N2","N3"],   placeValues: { N2: 1, N3: 100 },        weight: 101   }
        ]
      },
      tiles: [9, 2, 2],
      maxSum: 100691,
      fixedBase: 8489,
      correctAnswer: { S1: 9, S2: 2, S3: 2 },    // one canonical max placement; 2s are interchangeable between S2/S3
      evaluation: "max-sum",                      // engine compares submitted total to maxSum; any placement hitting 100691 is correct
      // Worked-example hint templates — the engine picks the one matching the student's highest-magnitude error
      wrongHints: {
        "9-in-S3": "Not quite! You placed 9 in a slot worth 101, contributing 909. In the ten-thousands slot it would have contributed 90,000.",
        "9-in-S2": "Not quite! You placed 9 in the thousands slot, contributing 9,000. In the ten-thousands slot it would have contributed 90,000.",
        "2-in-S1": "Not quite! You placed 2 in the ten-thousands slot, contributing only 20,000. The 9 there would have contributed 90,000.",
        "default": "Not quite! The biggest digit belongs in the slot with the biggest place value — the ten-thousands slot of Number 1."
      },
      correctHint: "Perfect! Placing 9 in the ten-thousands slot adds 90,000 — the biggest jump possible. Maximum sum: 100,691.",
      misconception_tags: {
        "9-in-S3":   "intersection-overweighting",   // student assumes a shared/intersection cell is automatically worth more because it "counts twice"
        "9-in-S2":   "magnitude-error",              // off-by-factor-of-10: picks thousands instead of ten-thousands
        "2-in-S1":   "fill-the-first-blank",         // student places first-picked tile in first slot without comparing magnitudes
        "2-in-S2-and-9-in-S3": "intersection-overweighting",
        "any-other-nonmax": "partial-application"    // student optimized within one number but not across all three
      }
    }
  ]
};
```

**Misconception glossary (for this game):**
- `magnitude-error` — student off by a factor of 10 in ranking place values (picks thousands instead of ten-thousands).
- `intersection-overweighting` — student assumes a cell at a shared intersection is automatically higher-value because it "contributes to two numbers". It *is* higher than either contribution alone, but for this board 101 ≪ 10,000, so this reasoning still loses.
- `fill-the-first-blank` — student drops the first tile they pick into the first empty slot they see rather than comparing slot weights.
- `partial-application` — student maximized one number (e.g. got N1 as big as possible) but did not reason about all three sums simultaneously.

## Defaults Applied
- **Bloom Level:** defaulted to L4 Analyze (creator described "multi-number place-value optimization" and "reasoning across three place-value systems at once" — these are analysis verbs; creator did not state a Bloom level explicitly).
- **Archetype:** defaulted to Board Puzzle (#6), Standalone shape (creator did not name an archetype; the single-board / no-sequential-rounds / solve-the-grid description matches Board Puzzle; 1-round + no-retry matches Standalone).
- **Grade band:** creator said "Grades 6–8"; defaulted NCERT alignment to "Knowing Our Numbers" (Class 6) and "Playing With Numbers" (Class 6) as the nearest curriculum anchors (creator did not name a chapter).
- **Lives UI rendering:** defaulted to "not shown on gameplay screen" (Standalone shape has no progress bar; creator did not specify where to render the 1-life counter). Lives are still tracked internally and reported in the `game_complete` payload.
- **Feedback style:** defaulted to single-step SFX → dynamic TTS + sticker + subtitle, awaited (per feedback skill default for single-commit games; creator described worked-example hints on wrong, which is compatible).
- **Timer:** defaulted to None (creator said "no timer" — honoured; timer default would have been None anyway for Board Puzzle).
- **Language:** English (creator did not request Hindi or bilingual).
- **Accessibility:** defaulted to platform standard (touch-only, 44×44 px minimum targets with 8 px spacing between adjacent slots/tiles, high-contrast dashed vs solid borders, `--mathai-*` CSS variables for all colors).
- **PART flags:** defaulted to Board Puzzle base set + PART-033 for drag-and-drop tile interaction (creator described drag-and-drop explicitly): PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-017, PART-019, PART-025, PART-027, PART-033, PART-042. PART-023 (progress bar) omitted per Standalone shape. PART-006 (timer) omitted (no timer).
- **Tile tray contents:** defaulted to digits {9, 2, 2} to produce (a) a clear maximum and (b) a "tempting trap" at the shared intersection slot (creator described the puzzle conceptually but did not fix the tile values).
- **Specific empty slots:** defaulted to (a) N1 ten-thousands, (b) N2 thousands, (c) N2-ones/N3-hundreds intersection (creator's rough grid diagram showed more dashed cells than the "3 empty slots" count; resolved by picking the three slots that produce the sharpest place-value magnitude contrast — see Warnings).
- **Preview screen:** defaulted to included (`previewScreen` omitted, which equals `true` per spec-creation skill).
- **Fixed cell digits:** defaulted to the exact values from the creator's grid (N1: 7,6,3,3 in thousands/hundreds/tens/ones of fixed positions; N2: 7 hundreds, 8 tens; N3: 7 tens, 6 ones), matching the screenshot verbatim.
- **Evaluation mode:** defaulted to "compare submitted total to `maxSum`" rather than exact-slot-match, since the two digit-2 tiles are interchangeable between S2 and S3 — multiple placements yield the true maximum and all should score 1 star.

## Warnings
- **WARNING — Grid ambiguity resolved by design choice:** The creator's rough ASCII diagram visually depicts more than 3 dashed cells (the conventions of dashed vs solid are inconsistent across the diagram), but the prose states exactly "3 empty slots" and "3 digit tiles". Resolved by picking the 3 slots that (a) match the "3 tiles" count and (b) produce the sharpest pedagogical contrast (×10,000 vs ×1,000 vs ×101). If the creator intended a different 3 slots, this spec's tile set and max-sum will need to be recomputed.
- **WARNING — 1 life + 1 round + 1 star is an unusual scoring structure:** Deviates from the platform default of 3-star/multi-round/multi-life. Kept per creator's explicit design (single high-stakes commitment). Pedagogical risk: a student who makes one magnitude error ends the game with 0 stars and no recovery path. The worked-example wrong-answer hint is the ONLY scaffolding — ensure the hint is concrete and actionable (done: hint names the digit, the slot's contribution, and the missed contribution in rupees-precise terms).
- **WARNING — Round count < 5 (single-round game):** Violates the spec-creation skill's "unusual round count" warning (< 5 rounds). Kept per creator's explicit "1 round" design. Consider offering a follow-up game in the same session that lets students practice magnitude reasoning over multiple rounds before they meet this single-shot challenge.
- **WARNING — Bloom L4 with single commitment and no retry:** Analysis tasks typically warrant more time and retries (pedagogy skill Section: "L4 requires time, not speed"). The no-retry design is high-stakes; mitigated by (a) unlimited free rearrangement before Submit, (b) no timer, and (c) a worked-example hint on wrong. Still, this is harsher than typical L4 scaffolding — confirm creator intent.
- **WARNING — Emotional-safety tone on wrong:** "Game Over with 0 stars after one mistake" is an emotionally heavy outcome. Wrong-answer VO copy is framed as "Not quite! Here's what that digit would have contributed…" (gentle redirect, teaching, no "fail"/"lose" vocabulary). Game End payload uses `correct: false, stars: 0` but the UI copy on the final screen MUST say something encouraging — recommended: "Good effort — place value is tricky! Here's what to remember…"
- **WARNING — Standalone shape + lives tracking:** The Standalone shape's lives-UI is flagged in `shapes.md` as "deferred / TBD". This spec defaults to "do not render lives on the gameplay screen" (the game ends after one submit regardless), but an engineer implementing this needs to be aware that the lives counter exists in `gameState` for the `game_complete` payload, not as a visible HUD element.
- **WARNING — Shared-cell correctness logic:** The intersection cell S3 contributes to BOTH N2 and N3. The engine must sum N1 + N2 + N3 *after* the placement, NOT compare per-number subtotals (a student can lower N2 by 7 and raise N3 by 700 simultaneously, and still win). The evaluation field is `"max-sum"` to make this explicit to the builder.
