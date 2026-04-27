# Game Design: Queens — 7-Queens Coloured-Region Puzzle

## Identity
- **Game ID:** queens
- **Title:** Queens — Place 7 Queens Safely
- **Class/Grade:** Class 5-8 (Grade 5-8) — DECISION-POINT: flagged in Defaults Applied; source concept silent on grade. Logic/constraint-satisfaction puzzles fit upper-primary through lower-secondary.
- **Math Domain:** Logical Reasoning / Constraint Satisfaction (combinatorics, spatial logic)
- **Topic:** N-Queens style constraint propagation on a coloured-region board. Student applies four simultaneous non-attack rules (same row, same column, same coloured region, nearest-diagonal) to place 7 queens on a 7×7 board partitioned into 7 contiguous coloured regions.
- **Bloom Level:** L4 Analyze — students must hold 4 independent constraints in mind, mark forbidden cells (✖), and systematically test queen placements. Each placement either preserves the invariant or violates it; students must analyse the board globally.
- **Archetype:** Board Puzzle (#6) — each round is a single 7×7 board solved as a whole. Multiple puzzles (3) of varying visual complexity; solving the board = completing the round. Uses Pattern P8 (Click-to-Toggle) with a 3-state cycle.
- **NCERT Alignment:** NCERT Class 6 Math "Playing with Numbers" (logical reasoning, puzzle appendix); Class 7 "Practical Geometry" (grid-based thinking). Problem-solving skill transfer aligns with "Ganit Mela" / Math Olympiad preparation. DECISION-POINT: confirm NCERT mapping with Education slot.

## One-Line Concept
Students tap cells on a 7×7 coloured grid to cycle each cell through empty → ✖ → ♛ → empty, placing 7 queens so that no two queens share a row, column, coloured region, or diagonal-neighbour cell; 2 lives forgive 2 mistakes.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Constraint propagation | Eliminate cells from consideration based on existing queens (mark ✖). | All rounds |
| Multi-constraint reasoning | Hold 4 simultaneous non-attack rules and combine them. | All rounds |
| Region-aware spatial reasoning | Recognise contiguous coloured regions and treat them as equivalence classes. | All rounds |
| Systematic elimination | Use the ✖ mark as working memory to avoid re-examining cells. | Stage 2, 3 |
| Recovery from near-misses | On a mis-placement, analyse which constraint was violated and adjust. | Stage 2, 3 |

---

## Core Mechanic

Single interaction pattern: **Pattern P8 — Click-to-Toggle with a tri-state cycle**. Every cell on the 7×7 grid cycles through three visual states on each tap:

```
empty  →  ✖ (marked)  →  ♛ (queen)  →  empty  →  ...
```

Constraint evaluation fires on the transition **empty → marked_x** or **marked_x → queen**. Only a queen placement can deduct a life; marking ✖ and removing a queen never deducts.

### Type A: "Starter Board" (Stage 1 — Round 1, B1)
1. **Student sees:** 7×7 grid with 7 thickly-outlined coloured regions (purple, pink, yellow, gray, green, cyan, orange). Status header showing Q1, timer (none — no PART-006), hearts=2, progress star 0/3. An instructions banner below the grid states the 4 rules verbatim with the glyphs "1⃣ 2⃣ 3⃣ 4⃣" and the copy "Tap on a block to mark ✖, tap again to place ♛ and tap again to reset."
2. **Student does:** Taps cells to cycle state. Each queen placement is immediately validated against the 4 rules; if it attacks another queen, a life is deducted, the queen flashes red, and the cell reverts to empty (consumed a life but does not stay placed).
3. **Correct criterion:** 7 non-attacking queens placed (one per row, one per column, one per region, no two diagonally adjacent).
4. **Feedback:** Safe placement — green seat flash + soft place SFX (fire-and-forget). Attacking placement — red flash + life-lost SFX (awaited 1500ms min) + attack-reason TTS (fire-and-forget) + cell reverts to empty. Board solved — awaited all_correct SFX + celebration sticker + fire-and-forget TTS ("Great analysis! 7 queens placed safely.") → advance to next round.

### Type B: "Crown Variant" (Stage 2 — Round 2, B2)
1. **Student sees:** Same 7×7 grid but regions recoloured (light pink, purple, orange, light green + 3 complementary) and queen glyph changes from ♛ to 👑 visually while internal logic is identical. The rules banner still uses 1⃣–4⃣ glyphs.
2. **Student does:** Identical tri-state tap interaction.
3. **Correct criterion:** Identical to Type A — 7 queens with no mutual attacks.
4. **Feedback:** Identical to Type A.

### Type C: "Plain Rules Variant" (Stage 3 — Round 3, B3)
1. **Student sees:** Same 7×7 grid, regions recoloured again (light gray, light lime, purple, light cyan + 3 complements), queen glyph 👑. The rules banner prints rules as plain "1." "2." "3." "4." (no emoji glyphs), testing the student's recognition of the rules under different surface presentation.
2. **Student does:** Identical interaction.
3. **Correct criterion:** Identical to Types A and B.
4. **Feedback:** Identical.

---

## Rounds & Progression

### Stage 1: Starter (Round 1 — B1)
- Round type: Type A.
- Board: 7×7, pre-validated solvable partition 1.
- Colour palette: purple (#9B51E0), pink (#F06292), yellow (#FFDE49), gray (#B0BEC5), green (#81C784), cyan (#4DD0E1), orange (#F2994A).
- Rules copy: uses 1⃣ 2⃣ 3⃣ 4⃣ emoji glyphs.
- Queen glyph: ♛.
- Cognitive demand: Apply rules mechanically to a small number of candidate cells; region shapes are geometrically obvious.

### Stage 2: Crown Variant (Round 2 — B2)
- Round type: Type B.
- Board: 7×7, pre-validated solvable partition 2.
- Colour palette: light pink (#FCE4EC), purple (#CE93D8), orange (#FFB74D), light green (#AED581), + pale yellow (#FFF59D), pale blue (#90CAF9), beige (#D7CCC8).
- Rules copy: uses 1⃣ 2⃣ 3⃣ 4⃣ emoji glyphs.
- Queen glyph: 👑.
- Cognitive demand: Student maps the same rules onto a subtly different palette. Regions are irregular; colour recognition under a new palette tests whether the rule internalisation is colour-agnostic.

### Stage 3: Plain Rules (Round 3 — B3)
- Round type: Type C.
- Board: 7×7, pre-validated solvable partition 3.
- Colour palette: light gray (#ECEFF1), light lime (#E6EE9C), purple (#BA68C8), light cyan (#B2EBF2), + peach (#FFCC80), rose (#F8BBD0), sand (#FFE082).
- Rules copy: rules printed as plain "1." "2." "3." "4." (no emoji glyphs).
- Queen glyph: 👑.
- Cognitive demand: Without emoji scaffolding, the student must recall which rule is which; region shapes are more complex (some snake across the board).

### Summary Table
| Dimension | Stage 1 (R1, B1) | Stage 2 (R2, B2) | Stage 3 (R3, B3) |
|-----------|------------------|-------------------|-------------------|
| Board size | 7×7 | 7×7 | 7×7 |
| Regions | 7 | 7 | 7 |
| Queen glyph | ♛ | 👑 | 👑 |
| Rule numbering | 1⃣ 2⃣ 3⃣ 4⃣ | 1⃣ 2⃣ 3⃣ 4⃣ | 1. 2. 3. 4. |
| Palette | vivid | pastel | muted |
| Expected solve time | 2-4 min | 3-5 min | 4-7 min |
| Target first-solve rate | 65-80% | 50-70% | 40-60% |

---

## Game Parameters
- **Rounds:** 3 — matches the three B1/B2/B3 puzzle instances described in the concept.
- **Timer:** None — L4 analyze tasks and the source concept's "00:03" display is purely decorative per the screenshot; we default to no timer for this cognitive task. Flagged in Warnings.
- **Lives:** 2 (shared across the entire session — concept says "heart with value 2"). A life is deducted only on an attacking queen placement.
- **Star rating:**
  - **3 stars** = all 3 puzzles solved with 0 lives lost
  - **2 stars** = 2-3 puzzles solved OR 3 solved with 1 life lost
  - **1 star** = 1 puzzle solved
  - **0 stars** = 0 puzzles solved (reached results via game_over)
- **Input:** Tap on grid cells (Pattern P8 Click-to-Toggle, tri-state cycle). Reset button per puzzle. No drag, no text input.
- **Feedback:** FeedbackManager handles all audio. Per-tap marks/unmarks get a soft tap SFX (fire-and-forget). Queen placement fires: (a) safe → light place SFX, (b) attacking → life-lost SFX (awaited 1500ms min) + TTS explaining which rule was violated. Board solved → awaited all_correct SFX + TTS.

---

## Scoring
- **Points:** +1 per puzzle solved (no partial credit).
- **Stars:** Computed from (solves, lives_remaining): 3 solves + 2 lives = 3★, 3 solves + 1 life = 2★, 3 solves + 0 lives = 2★, 2 solves = 2★, 1 solve = 1★, 0 solves = 0★.
- **Lives:** 2 total, deducted only on attacking queen placements. Lives = 0 → game_over (no more rounds; show game-over transition).
- **Partial credit:** None for scoring; telemetry captures per-puzzle (queens placed, life-losing placements, time, ✖ marks used) so analytics can distinguish deliberate strategy from random guessing.

---

## Flow

**Shape:** Multi-round (default).
**Changes from default:**
- Lives = 2 shared across all 3 rounds (not per-round). Game_over fires mid-session if lives reach 0.
- Wrong (attacking) placement does NOT advance a round — the queen reverts, a life is consumed, and the student continues on the same puzzle.
- A round completes only on puzzle-solve (7 safe queens) — it cannot "fail" to the next round; it either solves or exhausts lives into game_over.

```
[Preview Screen (PART-039)]
        |
        v
[Welcome / Level Screen]
        |
        v
[Round N Transition: "Puzzle N"]
        |
        v
[Gameplay: 7x7 coloured grid; tri-state tap cycle empty → ✖ → ♛ → empty]
        |
        | tap empty cell      ──────→ cell becomes ✖ (mark), soft SFX, no life change
        | tap ✖ cell          ──────→ cell becomes ♛ (queen), immediate validation
        |                             ├── safe: stays, green flash, place SFX
        |                             └── attacking: red flash, life--, reverts to empty,
        |                                            wrong SFX (1500ms) + TTS attack reason
        | tap ♛ cell          ──────→ cell becomes empty, soft deselect SFX, no life change
        |
        v
[Check: 7 queens placed? && zero attacks?]
        |
        +--> YES → Correct feedback (all green, all_correct SFX + TTS)
        |           |
        |           v
        |     [If N < 3: Round N+1 Transition]
        |     [If N == 3: Victory / Results]
        |
        +--> NO, lives > 0 → continue same puzzle
        +--> NO, lives == 0 → Game Over transition → Results

(Game Over path is reachable. Replay resets to Puzzle 1 with lives = 2.)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Cell tap empty → ✖ | Fire-and-forget soft tap SFX (`sound_bubble_select`). No sticker, no TTS. Cell renders ✖ glyph. |
| Cell tap ✖ → ♛ (safe) | Input blocked briefly (`isProcessing = true`). Cell renders ♛ glyph on green background. Fire-and-forget soft place SFX (`tap_sound`). After ~300ms reset `isProcessing = false`. `recordAttempt` NOT called per-tap — only on puzzle-solve or life-loss. |
| Cell tap ✖ → ♛ (attacking) | Input blocked. Cell flashes red for ~300ms with queen glyph visible. Life-- ; `progressBar.update(currentRound, lives)`. Awaited wrong SFX (`incorrect_sound_effect`) wrapped in Promise.all 1500ms min + sad sticker. Fire-and-forget TTS with attack-reason subtitle (≤60 chars): e.g. "Two queens in the same row!" or "Queens share a colour!" Cell reverts to empty after audio settles. `recordAttempt` captures {row, col, violated_rule, lives_remaining}. Input re-enabled. |
| Cell tap ♛ → empty | Fire-and-forget soft deselect SFX (`sound_bubble_deselect`). Cell clears. No life change, no recordAttempt. |
| 7 queens placed safely (puzzle solved) | `progressBar.update(roundsCompleted+1, lives)` FIRST. Awaited all_correct SFX (Promise.all 1500ms min) + celebration sticker. Fire-and-forget TTS: "Great analysis! 7 queens placed." `recordAttempt` captures final board + queens_placed=7 + lives_remaining. `trackEvent('round_complete', ...)`. If N < 3 → next round transition. If N == 3 → victory. |
| Last life lost (lives reach 0) | Wrong SFX + TTS as per "attacking" row (MUST play before game_over per feedback rules). Then `endGame(false)` → Game Over transition. |
| All 3 puzzles solved | Victory screen (PART-024) with stars + metrics. `game_complete` postMessage sent BEFORE victory audio. |
| Reset button (per-puzzle) | Clears all marks + queens on current puzzle. Lives are NOT restored. Fire-and-forget tap SFX. |
| Visibility hidden | `VisibilityTracker` auto-shows its built-in pause popup (do NOT build a custom overlay). Audio + any in-flight animation pauses. |
| Visibility restored | `VisibilityTracker` dismisses popup. State continues. |

### Attack-rule identification (for TTS feedback)

On an attacking queen placement, check the rules in this order and use the first violated rule for the TTS subtitle:

1. Same row — `"Two queens in the same row!"`
2. Same column — `"Two queens in the same column!"`
3. Same coloured region — `"Queens share the same colour!"`
4. Diagonal neighbour — `"Queens touch on a diagonal!"`

(If multiple rules are violated, report the first in priority order above. TTS subtitle under 60 characters.)

---

## Content Structure (fallbackContent)

Region grids are 7×7 arrays of integers 0–6 (each int = one of the 7 region colours for that puzzle). Solutions are arrays of `{row, col}` where queens belong; the game validates any student-placed queen set against the 4 rules, not against the solution — solutions are carried only as hints (optional) and as post-hoc verification that the puzzle is solvable.

```js
const fallbackContent = {
  previewInstruction: '<p><b>Place 7 queens safely!</b><br>Tap a cell to mark <b>✖</b>, tap again to place <b>♛</b>, tap once more to clear.<br>No two queens may share a <b>row</b>, <b>column</b>, <b>colour</b>, or touch on a <b>diagonal</b>.</p>',
  previewAudioText: 'Place seven queens on the board so no two share a row, column, colour, or diagonal. Tap a cell to mark an X, tap again to place a queen, tap once more to clear. You have two lives.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ========================================================
    // ROUND 1 — B1 Starter. Vivid palette, queen glyph ♛, rules with 1⃣2⃣3⃣4⃣.
    // Region IDs 0..6: purple, pink, yellow, gray, green, cyan, orange.
    // ========================================================
    {
      round: 1,
      stage: 1,
      type: "A",
      variant: "B1",
      queenGlyph: "♛",
      rulesStyle: "emoji",            // 1⃣ 2⃣ 3⃣ 4⃣
      palette: ["#9B51E0","#F06292","#FFDE49","#B0BEC5","#81C784","#4DD0E1","#F2994A"],
      paletteNames: ["purple","pink","yellow","gray","green","cyan","orange"],
      regions: [
        [3,0,0,0,1,2,2],
        [3,3,0,1,1,1,2],
        [3,3,0,0,1,2,2],
        [3,3,4,0,1,5,2],
        [3,3,4,4,5,5,2],
        [3,4,4,5,5,6,6],
        [3,4,5,5,6,6,6]
      ],
      solution: [
        { row: 0, col: 1 },
        { row: 1, col: 3 },
        { row: 2, col: 5 },
        { row: 3, col: 0 },
        { row: 4, col: 2 },
        { row: 5, col: 4 },
        { row: 6, col: 6 }
      ],
      misconception_tags: {
        "ignores-region-rule":     "Student places two queens in different rows/cols/diags but same colour region.",
        "adjacent-diagonal-miss":  "Student places queens 1 row and 1 col apart (diagonal touch).",
        "row-column-confusion":    "Student double-checks column but forgets row, places 2 queens in same row."
      }
    },

    // ========================================================
    // ROUND 2 — B2 Crown Variant. Pastel palette, queen glyph 👑, rules still 1⃣2⃣3⃣4⃣.
    // ========================================================
    {
      round: 2,
      stage: 2,
      type: "B",
      variant: "B2",
      queenGlyph: "👑",
      rulesStyle: "emoji",
      palette: ["#FCE4EC","#CE93D8","#FFB74D","#AED581","#FFF59D","#90CAF9","#D7CCC8"],
      paletteNames: ["light-pink","purple","orange","light-green","pale-yellow","pale-blue","beige"],
      regions: [
        [0,0,0,0,0,1,1],
        [2,2,0,0,0,1,1],
        [2,2,2,3,3,1,1],
        [4,2,2,3,3,3,3],
        [4,4,4,4,5,5,3],
        [6,6,6,4,5,5,5],
        [6,6,6,4,5,5,5]
      ],
      solution: [
        { row: 0, col: 3 },
        { row: 1, col: 6 },
        { row: 2, col: 2 },
        { row: 3, col: 5 },
        { row: 4, col: 1 },
        { row: 5, col: 4 },
        { row: 6, col: 0 }
      ],
      misconception_tags: {
        "palette-confusion":       "Student confuses pastel regions with each other (e.g. pale-yellow vs beige).",
        "crown-ignored-rules":     "Student assumes new glyph = new rules and places queens at column distance.",
        "stage1-solution-reused":  "Student tries Stage-1 solution pattern on Stage-2 board."
      }
    },

    // ========================================================
    // ROUND 3 — B3 Plain Rules. Muted palette, queen glyph 👑, rules "1. 2. 3. 4." (no emoji).
    // ========================================================
    {
      round: 3,
      stage: 3,
      type: "C",
      variant: "B3",
      queenGlyph: "👑",
      rulesStyle: "plain",            // 1. 2. 3. 4.
      palette: ["#ECEFF1","#E6EE9C","#BA68C8","#B2EBF2","#FFCC80","#F8BBD0","#FFE082"],
      paletteNames: ["light-gray","light-lime","purple","light-cyan","peach","rose","sand"],
      regions: [
        [1,1,1,0,0,0,2],
        [1,1,1,0,0,0,2],
        [1,3,3,3,0,2,2],
        [1,4,4,3,3,3,2],
        [4,4,4,6,3,5,5],
        [4,6,6,6,5,5,5],
        [4,6,6,6,6,5,5]
      ],
      solution: [
        { row: 0, col: 4 },
        { row: 1, col: 1 },
        { row: 2, col: 6 },
        { row: 3, col: 3 },
        { row: 4, col: 0 },
        { row: 5, col: 5 },
        { row: 6, col: 2 }
      ],
      misconception_tags: {
        "no-emoji-rule-forgetting": "Without emoji numbering, student forgets which rule is which and tests only rows/cols.",
        "snake-region-miss":        "Student misreads a snaking region (e.g. region 4 or 6) as two separate colours.",
        "late-diagonal-check":      "Student checks all other rules before diagonals and places adjacent-diagonal queens."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 5-8** (creator did not specify). IMC Level 2 source suggests Class 6-8. DECISION-POINT for Education slot.
- **Bloom Level:** defaulted to **L4 Analyze** based on 4-simultaneous-constraint reasoning and the need to decompose violations. Concept silent on Bloom level.
- **Archetype:** **Board Puzzle (#6)**, Pattern P8 (Click-to-Toggle) with tri-state cycle. Explicitly listed as a canonical Queens example in `game-archetypes.md`.
- **Rounds:** **3** — matches the three B1/B2/B3 variants in the source concept.
- **Lives:** **2**, shared across all 3 rounds. Matches the concept's heart indicator "2". Lives are decremented only on attacking queen placement (not on ✖ marks or queen-removal taps).
- **Timer:** **None**. The concept's header shows "00:03" but in the screenshots it is a static decorative number rather than a live countdown. L4 Analyze default = no timer.
- **Input:** **Tap-based tri-state cycle** per concept: empty → ✖ → ♛ → empty.
- **Feedback style:** **FeedbackManager** with per-tap fire-and-forget SFX, awaited wrong/all_correct SFX (Promise.all 1500ms min), fire-and-forget TTS on violations with attack-reason subtitle.
- **Scaffolding:** **None beyond the ✖ mark**. The ✖ mark is itself the primary scaffold — it lets the student mark forbidden cells without committing and losing a life. No additional hints or retries beyond re-tapping a queen to remove it.
- **Region partitions:** **Pre-validated hardcoded** (3 instances, one per variant). Each region partition has been Python-verified (Apr 2026 session) to be (a) a partition of all 49 cells, (b) 7 contiguous regions, (c) admits a valid 7-queens solution under the 4 attack rules. Procedural generation is NOT used at runtime (too risky — see Warnings).
- **Queen attack definition — "nearest diagonals":** defaulted to **diagonal neighbours only** (i.e. the 4 cells at `(r±1, c±1)`), not full diagonal lines. This matches the concept's "nearest diagonals" phrasing — standard chess N-Queens uses full diagonals, but the concept explicitly restricts to nearest cells.
- **Star thresholds:** 3 puzzles + 2 lives = 3★; 3 puzzles + any lives loss = 2★; 2 puzzles = 2★; 1 puzzle = 1★; 0 = 0★.
- **Preview screen:** included (default `previewScreen: true`, PART-039).
- **Game-over path:** **included** (lives > 0, so game_over screen is reachable when lives reach 0).

---

## Warnings

- **WARNING — Pre-validated puzzles, not procedurally generated.** Procedurally generating a solvable 7-queens coloured-region puzzle at runtime is non-trivial (region partition must be valid AND admit a solution under 4 rules). All 3 puzzles are hardcoded in `fallbackContent.regions[N]` and were Python-verified to be solvable. Risk: if a content set overrides `regions` without re-verifying solvability, the player could face an unsolvable puzzle. DECISION-POINT: content-set validation pipeline should re-verify solvability when overriding `regions`.
- **WARNING — "Nearest diagonals" semantics.** The concept uses the phrase "nearest diagonals" which differs from standard N-Queens (full diagonals). Spec uses **nearest only** (the 4 cells at `(r±1, c±1)`). All 3 solutions are validated under this rule. If Education slot interprets "nearest diagonals" as full diagonals, the solutions remain valid (they happen to also satisfy the stricter rule), but the gameplay would become harder. DECISION-POINT: confirm with Education slot.
- **WARNING — Lives semantics differ from typical Lives Challenge.** Source concept says "lose a life every time a queen attacks another queen". Spec implements: queen placement that attacks is deducted AND the queen reverts to empty (not left on the board). The alternative — leaving the attacking queen placed and requiring the student to manually remove it — matches a different interpretation. Spec chose auto-revert for lower cognitive friction. DECISION-POINT: confirm with Education slot.
- **WARNING — Timer not implemented.** Concept's header shows "00:03" but this is interpreted as a decorative static display (since the source describes it as purely visual in a single screenshot frame, with no countdown behavior specified). Default for L4 Analyze is no timer. DECISION-POINT: confirm whether a timer should be added (if so, PART-006 would need to be included).
- **WARNING — Bloom-lives compatibility.** Pedagogy defaults say L4 Analyze = 0 or 5 lives. Spec uses 2 because the source concept dictates 2. Acceptable deviation; flagged for transparency.
- **WARNING — Glyph variation per variant.** Rounds use different queen glyphs (♛ vs 👑) and rule numbering styles (emoji vs plain). This is a surface-variation pattern and does not change gameplay logic — but pipeline validators may flag inconsistent glyph usage. The variance is deliberate and should be preserved.
- **WARNING — Region colour contrast.** The three palettes include some low-contrast colours (e.g. pastels in B2). Ensure region borders are visibly thick (≥2px) and distinct from cell-border thin lines so regions remain clear even with low-contrast fills. Mobile skill CRITICAL rule on contrast applies.
- **WARNING — Tri-state cycle onboarding.** The cycle empty→✖→♛→empty is non-standard; student first-time users must read the preview carefully. Preview copy is verbose by design (mentions ✖, ♛, tap-to-clear). DECISION-POINT: consider adding a one-cell demo animation inside the preview (future enhancement).
- **WARNING — 44px touch target on 7×7 grid.** On a 375px viewport, 7 columns = ~53px each (minus grid border) which passes 44px. On smaller phones (360px) cells are ~51px, still above 44px. DECISION-POINT: verify on 320px landscape (iPhone SE portrait) — may need to reduce side padding.
- **WARNING — Single tap-then-revert on attack may feel punitive.** After a wrong queen placement, the cell reverts to empty (not ✖). The student may then tap the same cell again (cycling back through ✖→♛) and repeat the mistake. Spec does NOT auto-mark violated cells as ✖ to preserve simplicity. DECISION-POINT: consider auto-marking attacking cells as ✖ after revert (scaffolding upgrade).
