# Game Design: Kakuro

## Identity
- **Game ID:** kakuro
- **Title:** Kakuro — Sum-Snake Logic Puzzle
- **Class/Grade:** Class 4–6 (Grade 4–6, ages ~9–12). Explicit in concept; the puzzle assumes single-digit addition is fluent and uses it as a *constraint*, not as the answer to compute.
- **Math Domain:** Number sense & logical reasoning — additive decomposition (single-digit sums) used as constraints, plus constraint-intersection deduction.
- **Topic:** Crossword-style digit puzzle. The student fills white cells with digits 1–9 such that every white "run" sums to the clue at its head AND no digit repeats inside a run. Decomposition fluency, constraint reasoning, process-of-elimination.
- **Bloom Level:** L4 Analyze — multi-constraint reasoning (each white cell sits at the intersection of a row-sum constraint and a column-sum constraint, plus the no-repeat-in-run constraint). Students intersect two valid-digit sets to deduce the only legal placement, which is the bones of substitution / elimination in algebra.
- **Archetype:** #6 Board Puzzle — single board solved as a whole, multi-puzzle session (3 puzzles across three difficulty stages). Not rounds-based in the MCQ sense; "Round N" is "Puzzle N".
- **NCERT Reference:**
  - Class 4 — *Tick Tick Tick* (logical reasoning, working with grids and patterns) and addition fluency (single-digit and two-digit sums).
  - Class 5 — *Mapping your way* (grid coordinates, spatial planning) and *Does it look the same?* (spatial reasoning).
  - Class 6 — *Knowing our Numbers / Whole Numbers* (additive structure) plus general logical-reasoning content.
  - General logical-reasoning content not anchored to a single chapter — consistent with Class 4–6 math-Olympiad-style number puzzles.
- **Pattern:** **P6 (Drag-and-Drop)** — the canonical "drag a digit tile from a tray onto a white cell" interaction, implemented via `@dnd-kit/dom@beta` (ESM CDN: `https://esm.sh/@dnd-kit/dom@beta`). NOT tap-to-select-cell-then-tap-numpad, NOT inline keyboard input. **Free placement, no per-cell validation** — the student drops any digit on any white cell at any time and submits the whole puzzle via a **Check button** below the digit tray. **Build step (Step 4) MUST run in MAIN CONTEXT — sub-agents cannot fetch `@dnd-kit/dom` docs from context7.** See `alfred/skills/orchestration/SKILL.md` § "Step 4 main-context override" (the row routing P6 to main context). Sensors: `PointerSensor` (activation distance **3 px** matching P6 §8 Universal Touch Support) plus optional `KeyboardSensor` for accessibility (left/right arrows cycle tiles, Enter drops on focused cell).
- **Input:** Drag-and-drop with submit-style validation. A digit **tray** below the board holds 9 reusable digit tiles (1–9). Drag a tile from the tray and drop it on any white cell to place that digit; there is no per-cell validation, no green run-locking, no red flash on placement, no hint banner during placement. Tiles are **reusable** — dragging digit `5` onto a cell does NOT remove it from the tray; the same tile can be dragged any number of times. To **change** a digit, drag a different tile onto the cell (silent replace). To **clear** a cell, drag the digit tile back to the tray area (the tray doubles as the "trash" / clear zone — no separate Clear button). A **Check button** sits below the digit tray (full-width inside the board wrap); it is disabled until every white cell holds a digit, and on tap runs whole-puzzle validation. No keyboard typing input. No mid-puzzle hint button. The puzzle does NOT auto-detect solve — the student commits via Check.

## One-Line Concept
The student fills a 4×4 / 5×5 / 6×6 crossword-style grid with digits 1–9 so that every white run sums to its clue and no digit repeats in any run — using the intersection of row-sum and column-sum clues to deduce each cell, while the absence of a timer and a quiet, deliberate audio palette frames mistakes as information rather than punishment.

## Why these grid sizes (grade-appropriate sizing)
The concept fixes the three sizes already (4×4 warm-up → 5×5 standard → 6×6 stretch) for Class 4–6. A 4×4 keeps Stage 1 to two or three short runs so the student feels the "aha" of a constraint solving itself; a 5×5 is the canonical Kakuro shape for this age group (most published Kakuro learning material targets 5×5); a 6×6 introduces triples and the occasional quadruple, which is the upper bound a Class-6 student can reasonably hold in working memory without a procedural aid. Larger boards (7×7+) are out of scope — they require multi-minute deduction chains that exceed the 4–8 minute per-puzzle budget.

A 4×4 board on a 375 px viewport (with 16 px outer padding and 1 px gridlines) gives ~83 px cells; a 5×5 gives ~67 px cells; a 6×6 gives ~56 px cells. All clear the 44 px touch-target minimum with margin (~12 px headroom on the 6×6, generous on the others). The digit tray sits below the grid (within the bottom safe zone) so it never occludes the row the student is reasoning about, and so the dragged tile travels a short, natural distance from tray-up-into-grid.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Decomposition fluency | Recall the small set of digit pairs/triples that produce a target sum (e.g. "what two distinct digits 1–9 sum to 11?"). The faster this recall, the more enjoyable the puzzle. | kakuro-board |
| Constraint reasoning (intersection) | A white cell sits at the intersection of a row-sum clue and a column-sum clue. Mentally intersect two candidate-sets to deduce its value (*"3 or 4 from the row, 4 or 5 from the column → it must be 4"*). | kakuro-board |
| Process of elimination | When two cells in a run both need values, tentatively place the easier one and watch the constraint on the other collapse to a single answer. Direct rehearsal for substitution / elimination in algebra. | kakuro-board |
| Working-memory scaffolding (no-repeat tracking) | The "no repeats in a run" rule forces the student to hold "which digits are still available in this run" in working memory across the whole solve. Pays off across all of math. | kakuro-board |
| Self-correction from constraint feedback | Reading the one-line hint after a wrong digit ("This row needs to sum to 11.") to update the mental model and try a different digit. Mistakes are information, not punishment. | kakuro-board |

## Core Mechanic

### Type A: "Kakuro Board" (one round per stage; three stages = three puzzles)

1. **What the student sees**
   - A small grid — **4×4 in Stage 1, 5×5 in Stage 2, 6×6 in Stage 3** — with three cell types:
     - **Black walls** (no interaction; pure background).
     - **Clue cells** (black background with one or two small numbers): a number in the **top-right** is the row sum (the sum of the white run extending to the right of this clue), a number in the **bottom-left** is the column sum (the sum of the white run extending below this clue). A clue cell may carry a row sum, a column sum, or both — split by a diagonal divider. Numbers are rendered in a contrasting cream / off-white (`#F5F0E8`) on the dark cell.
     - **Empty white cells** (cream background, ready to receive a digit) — these are the cells the student interacts with. White cells flip to a "celebration" mint-green only on a successful Check submission (full-grid celebration glow); there is no per-run locking during placement.
   - **Digit tray**: a fixed strip below the grid holding 9 reusable draggable digit tiles **1, 2, 3, 4, 5, 6, 7, 8, 9** in a 5+4 layout (digits 1–5 top row, digits 6–9 bottom row). Tiles never deplete — the same tile can be dragged any number of times. The tray itself doubles as the "clear" drop target: dragging a tile *off* a cell and releasing it over the tray area empties the cell. There is NO active-cell ring (no cell-select step in P6); the dnd library renders its own drop-target hover affordance on the cell currently under the dragged tile.
   - **Check button** below the digit tray (full-width inside the board wrap, primary-style). Label "Check". Disabled (`opacity: 0.5; pointer-events: none`) while any white cell is empty; enabled the moment every white cell holds a digit. Disabled again during the awaited celebration sequence (`gameState.isProcessing`).
   - **Puzzle progress chip** ("Puzzle 1 of 3") in the header. The header contains ONLY this chip — no timer, no lives, no hint button.
   - **NO timer** (concept explicitly states no timer; PART-006 is NOT included).
   - **NO lives indicator** in the header. Failed Check submissions are tracked silently in `gameState.wrongAttempts` and only used at end-of-game for star calculation. Concept: *"Mistakes are information."*
   - **NO mid-puzzle hint button.** No hint affordance during placement; the student reasons through the puzzle and commits via Check.
2. **What the student does** (input type: P6 Drag-and-Drop, free placement + Check)
   - **Drag a digit tile from the tray onto any white cell** → on `dragstart`, the tile lifts (~1.1× scale + soft shadow) and follows the pointer; a soft tap SFX fires. On `dragover` a white cell, the dnd library renders its drop-target hover state on the cell. On `dragend` over a valid drop target, the digit lands in the cell with a 150 ms snap-in transition. **No per-cell validation fires** — the digit is simply parked in the cell. The tray tile remains in place — tiles are reusable.
   - **Drag a digit tile onto a white cell that already holds a digit** → the existing digit is silently replaced by the new one. No red flash, no green flash, no SFX beyond the placement.
   - **Drag the digit out of a white cell back to the tray area** → the cell empties; the tile snaps back into the tray with a 150 ms transition. The Check button re-disables until the cell is filled again.
   - **Drag cancelled** (released outside any drop target — over a wall, a clue cell, the body, or anywhere not registered as a droppable) → the tile snaps back to its origin with a 150 ms transition; no state change; suppressed-tap SFX (FAF).
   - **Tap the Check button** (enabled only when every white cell holds a digit) → whole-puzzle validation fires. See "What counts as correct" below.
   - **`beforedragstart` guard:** drags are cancelled at the source if `gameState.isProcessing || gameState.gameEnded || !gameState.isActive` — see V21 in interaction/SKILL.md. During the awaited celebration sequence the board-wrap also gets a `.dnd-disabled` class which sets `pointer-events: none` on tiles and cells (V22); the class is cleared in `renderRound` when the next puzzle mounts (V23).
3. **What counts as correct**
   - **No per-cell validation.** Digits placed mid-puzzle are not validated against row sums, column sums, or repeat rules. The student fills the grid freely.
   - **Whole-puzzle validation on Check tap:** every row-run AND every column-run is validated. A run is valid iff its filled cells sum to the clue AND no digit repeats inside it.
     - **Every run validates → puzzle solved.** Full-grid celebration glow (~600 ms cell-by-cell propagation), all white cells transition to the celebration mint-green, awaited round-complete SFX + sticker, awaited dynamic TTS ("Brilliant! Every run adds up."), then auto-advance: Round 2 / Round 3 transition, or Victory on Puzzle 3.
     - **Any run fails → Check rejection.** Every cell in every failing run flashes red (~600 ms — 300 ms ease-in-out + 300 ms shake). The hint banner appears below the grid with the message for the **first** violated constraint in priority order (row sum → column sum → repeat → both → multi-constraint-collapse-failure). If multiple runs are off, the banner appends "(N runs are off)". The banner auto-fades after 3 s. `gameState.wrongAttempts` increments by **1** (one Check submission = one attempt, regardless of how many runs failed). The board stays editable — the student fixes their digits and re-taps Check.
   - **Misconception tagging on Check failure** (per `recordAttempt`): exactly one tag per failed Check submission. Priority: row sum violated → `sum-decomposition-error`; col sum violated → `cross-constraint-overlooked`; repeat in run → `no-repeat-rule-overlooked`; both row+col simultaneously on a single run → `multi-constraint-collapse-failure`; ≥ 2 distinct runs failing → `multi-constraint-collapse-failure` (the most-violated-runs case).
   - **Each puzzle has a unique pre-validated solution.** No procedural generation in v1 — partitions are hand-authored at game-planning Step 3 and confirmed by build-time exhaustive search to admit exactly one valid digit assignment. (See `pre-generation/puzzles.md`, produced before Step 4.) The student does not need to discover this unique solution to pass — any digit assignment where every run sums correctly with no repeats validates. (Because the puzzle is uniquely solvable, in practice the only passing assignment IS the canonical solution.)
4. **What feedback plays**
   - **Drag-start on a digit tile**: soft tap SFX (fire-and-forget, ~50 ms); tile lifts (~1.1× scale + soft shadow) and follows the pointer. No TTS, no sticker. Pure ambient (CASE 9 / micro-interaction).
   - **Drop a digit tile on a white cell**: digit lands with 150 ms snap-in animation. No additional SFX (the drag-start tap SFX already played). No validation fires. If the placement fills the last empty white cell, the Check button enables.
   - **Drag a digit tile from a cell back to the tray (clear)**: soft tap SFX (FAF). Cell empties; tile snaps back into the tray with 150 ms transition. The Check button re-disables.
   - **Drag cancelled (released outside any drop target)**: suppressed-tap SFX (FAF); tile snaps back to its origin with 150 ms transition. No state change, no TTS.
   - **Tap Check (button enabled, all runs validate)**: same beat as "Puzzle solved" below — full-grid celebration glow, awaited round-complete SFX + sticker, awaited dynamic TTS, advance round / endGame. CASE 6.
   - **Tap Check (button enabled, one or more runs fail)**: every cell in every failing run flashes red (~300 ms ease-in-out) + shake (~300 ms). Wrong-digit SFX **fire-and-forget**. Hint banner appears below the grid for 3 s with the first violated constraint message (priority: row sum → col sum → repeat → both → multi-constraint-collapse-failure); if multiple runs fail, the banner appends "(N runs are off)". `gameState.wrongAttempts` increments by **1** (per submission, not per failing run). Board stays editable; Check button stays enabled (cells are still all filled) so the student can fix and re-tap. No awaited TTS — mid-puzzle wrongs are FAF (concept's "quiet and deliberate" framing).
   - **Puzzle solved (Check accepted)**: full-grid celebration glow (~600 ms cell-by-cell propagation), **round-complete SFX awaited** with celebration sticker → **dynamic TTS awaited** ("Brilliant! Every run adds up." or "Solved! That last run was tricky."). `progressBar.update(currentRound, ...)` fires FIRST (before the awaited SFX) per the Feedback Cross-Cutting Rule "ProgressBar bump before round-complete audio". The board-wrap gets `.dnd-disabled` for the duration of this awaited sequence (V22) and the Check button is disabled (`gameState.isProcessing`); both are cleared by `renderRound` (V23). Then auto-advance: to Round 2 / Round 3 transition, or — on Puzzle 3 — to the Victory + Stars Collected sequence. CASE 6.
   - **All 3 puzzles solved (Victory)**: timer N/A. Results / Victory screen renders FIRST (stars, AnswerComponent carousel, Next CTA). `game_complete` posted BEFORE end-game audio. Then victory SFX + VO, played sequentially. CASE 11. AnswerComponent (PART-051) carousel shows 3 slides — Puzzle 1 solved, Puzzle 2 solved, Puzzle 3 solved — with each grid in its solved state.
   - **Stars Collected (after Victory)**: `sound_stars_collected` awaited → `show_star` postMessage → setTimeout reveals Next via `floatingBtn.setMode('next')` (per `default-transition-screens.md` § 4 Stars Collected).
   - **Try Again / Play Again** (from Victory if < 3⭐, or — only if a future iteration adds Game Over — from Game Over): all audio stopped, all state resets including `wrongAttempts → 0`, all grid cells cleared, `currentRound → 1`, `setIndex` rotates A → B → C → A. Returns to Round 1 transition. CASE 13.
   - **Tab switch / screen lock**: timer N/A. Static & stream audio paused. VisibilityTracker's PopupComponent renders the pause overlay (autoShowPopup default; do NOT build a custom overlay). CASE 14.
   - **Tab restored**: audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues. CASE 15.
   - **Audio failure** (any awaited audio rejects): try/catch swallows; visual feedback (green flash, red flash, sticker, hint banner) still renders. Game continues. CASE 16.

## Rounds & Progression

Three puzzles per session, one per stage, each cosmetically and mechanically distinct. The grid SIZE changes per stage (4×4 → 5×5 → 6×6), and the run lengths and clue ranges change with it. **The core mechanic — drag a digit tile from the tray, drop on a white cell, run-validates — is identical across stages; only the board size, run shapes, and clue ranges scale.**

### Stage 1: Warm-up — 4×4 (Round 1, "Puzzle 1")
- Round type: kakuro-board
- **Grid size:** 4×4 (16 cells total). Roughly 6–8 white cells, 6–8 black walls, 2–4 clue cells. Two or three short runs.
- **Run lengths:** mostly pairs (2-cell runs); one triple at most.
- **Sum range:** clues fall in **5–13**.
- **Difficulty knob:** "first-exposure" — many runs have only one valid decomposition (e.g. a 17 sum into 2 cells must be 8+9; a 4 sum into 2 cells must be 1+3; a 3 sum into 2 cells must be 1+2). The student should feel the "aha" of a constraint solving itself.
- **Cosmetic skin:** vivid palette (warm cream cells `#F5F0E8`, deep navy walls `#1F2A37`, celebration mint `#CDE9D7`, accent yellow `#F1C453`). Clue numerals in a friendly rounded sans (system font stack).
- **Expected solve time:** 1–3 minutes.
- **Target first-Check pass rate (Check accepted on first submission):** ~80 % (Stage 1 is the on-ramp; we want most students to clear Puzzle 1 with their first Check tap).

### Stage 2: Standard — 5×5 (Round 2, "Puzzle 2")
- Round type: kakuro-board
- **Grid size:** 5×5 (25 cells total). Roughly 12–16 white cells, 6–9 black walls, 4–7 clue cells. Mixed pairs and triples.
- **Run lengths:** pairs and triples; one quadruple is allowed but not required.
- **Sum range:** clues fall in **5–20**.
- **Difficulty knob:** "mid-stretch" — some cells genuinely require **intersecting two sets to resolve** (the row says "3 or 4", the column says "4 or 5", so the cell is 4). This is the meat of the game and the central pedagogical move. Pure trial-and-error is feasible but slow.
- **Cosmetic skin:** same palette, same typography. The visual maturity step is small (the audience already saw 4×4).
- **Expected solve time:** 4–8 minutes (the canonical Stage-2 budget the concept calls out).
- **Target first-Check pass rate (Check accepted on first submission):** ~60 %.

### Stage 3: Stretch — 6×6 (Round 3, "Puzzle 3")
- Round type: kakuro-board
- **Grid size:** 6×6 (36 cells total). Roughly 18–24 white cells, 8–12 black walls, 6–10 clue cells. Triples and the occasional quadruple.
- **Run lengths:** triples and quadruples; one run of length 5 is permitted but rare.
- **Sum range:** clues fall in **6–28** (a few in the 20s).
- **Difficulty knob:** "mastery" — students will need to **hold two or three options in mind for a cell** while they work the rest of the run, and use process-of-elimination to collapse those options. Pure trial-and-error WILL exhaust most students' patience; reasoning IS the puzzle.
- **Cosmetic skin:** same palette + a subtle border accent on the grid (`--mathai-color-border` 1 px around the outer frame) to mark "mastery board" without changing typography.
- **Expected solve time:** 6–12 minutes.
- **Target first-Check pass rate (Check accepted on first submission):** ~40 % (Stage 3 is the mastery gate; only students who genuinely reason through the constraints should pass on their first Check). **Note:** without per-cell incremental feedback, the realised pass-rate may run a bit lower than 40 % — see Warnings.

### Stage summary

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Grid size | 4×4 | 5×5 | 6×6 |
| White cells | ~6–8 | ~12–16 | ~18–24 |
| Run lengths | Pairs, ≤1 triple | Pairs and triples, ≤1 quadruple | Triples and quadruples |
| Clue sum range | 5–13 | 5–20 | 6–28 |
| Deductions required | 1–2 | 2–3 | ≥ 3 (set-intersection central) |
| Expected solve time | 1–3 min | 4–8 min | 6–12 min |
| Target first-Check pass rate | ~80 % | ~60 % | ~40 % |
| Cognitive demand | First exposure | Mid-stretch | Mastery gate |
| Cell size on 375 px viewport | ~83 px | ~67 px | ~56 px |

**Round-set cycling (MANDATORY — validator GEN-ROUNDSETS-MIN-3).** The runtime round-set-cycles `fallbackContent.rounds`. A student plays Set A on first attempt, Set B after Try Again / Play Again, Set C on the next restart, then back to A. **The spec authors three full sets (A, B, C) × 3 puzzles each = 9 round objects total.** Each set has different white/black layouts and different unique solutions per puzzle, but **parallel difficulty across sets** — Set A's Stage-1 puzzle ≈ Set B's Stage-1 ≈ Set C's Stage-1 in run-count and deduction depth. Each round object carries `set: 'A' | 'B' | 'C'`. `setIndex` rotates on restart and persists across restarts within the session — it is NOT cleared in `resetGameState`. (The concept's "bank of ~30 puzzles per stage" is a future-iteration goal; v1 ships 3 sets × 3 stages = 9 hand-authored puzzles, which already gives a determined replay-three-times-in-a-day student a fresh board each time.)

## Game Parameters
- **Rounds:** 3 per session (one puzzle per stage). `totalRounds: 3`.
- **Timer:** None (`timer: false`). The concept explicitly says "no timer in the gameplay header — this is a thinking game, and the absence of a clock is part of the tone." PART-006 is NOT included.
- **Lives:** **No lives bar in the header.** The platform's `totalLives` field is set to a high cap (`totalLives: 99`) purely to satisfy the data contract; the lives counter is NEVER decremented in code, NEVER rendered in the header, and NEVER reaches 0 — there is no Game Over branch in this game. (See "Why no lives" below for the design rationale.) `wrongAttempts` is the real counter — it is incremented silently on every failed Check submission and is read by `getStars()` at end-of-game.
- **Why no lives:** the concept frames mistakes as information ("Wrong digits are not a punishment — they're the puzzle teaching back."). A header lives counter would directly contradict that frame: every failed Check would trigger a heart-pop animation, the student would feel punished, and the deliberate / quiet tone would break. By tracking failed submissions silently in `wrongAttempts` and surfacing them only as a star deduction at end-of-game, the student stays in their reasoning flow during the puzzle and learns the cost of mistakes only after the puzzle is solved. **NOTE for build step:** the spec sets `totalLives: 99` (a high cap, never visible, never decremented). The build step MUST hide the lives indicator (CSS `display: none` on the lives slot, OR omit the `lives` parameter from `progressBar.update(round, lives)` if PART-023 supports a "no-lives" mode — confirm at planning step). Validator should NOT trip the "lives = 0 means no game_over screen" rule because lives are NEVER decremented; the game also has NO `game_over` screen (only Victory, since lives can never reach 0).
- **Lives semantics (explicit):**
  - Lives are a no-op in this game. They are never decremented, never displayed.
  - `wrongAttempts` increments by 1 on every **failed Check submission** (one Check tap = one attempt, regardless of how many runs failed). It is the **only** signal feeding `getStars()`.
  - `hintsUsed` is NOT tracked — there is no hint button in v1.
  - `wrongAttempts` is reset to 0 on Try Again / Play Again (full session restart). It persists across the 3 puzzles within a single session.
- **retryPreservesInput:** N/A (multi-round game; the field is only relevant for `totalRounds: 1` standalone games per PART-050).
- **autoShowStar:** `true` (default end-of-game beat handled by PART-050 / Stars Collected onMounted).
- **Star rating:** see "Scoring" below — creator-specified, NOT default 90/66/33.
- **Input:** P6 Drag-and-Drop via `@dnd-kit/dom@beta` (drag digit tiles from the tray onto white cells; drag back to tray to clear). Free placement, no per-cell validation. Submit via the in-board **Check button** below the digit tray (disabled while any white cell is empty; enabled once all are filled). No tap-to-select-cell, no keyboard typing. Step 4 (Build) MUST run in MAIN CONTEXT to fetch live `@dnd-kit/dom` docs via context7.
- **Feedback:** FeedbackManager (PART-017). Whole-puzzle validation on Check tap (no per-cell validation). Failed Check is fire-and-forget (multi-step CASE 7). Successful Check = round-complete celebration (awaited, CASE 6). Per-session Victory only — NO Game Over branch.
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships). The 3-slide carousel at end-of-game shows each puzzle's solved state — the full filled grid with clue cells, celebration-mint white cells, and solution digits in place. (See "AnswerComponent payload shape" below for the per-round `answer` schema.)

## Scoring

- **Points:** +1 per puzzle solved. A puzzle is "solved" iff a Check submission validates (every run sums correctly with no repeats). Max 3 points per session. Since there is no Game Over, the only way to end the session with < 3 points is for the student to walk away (which the concept calls out: "0 stars — Did not solve (only possible if the student walks away)").
- **Stars (simplified — only signal is `wrongAttempts`, the count of failed Check submissions across the 3 puzzles):**
  - **3⭐** = `wrongAttempts === 0` (every Check accepted on first submission across all 3 puzzles).
  - **2⭐** = `wrongAttempts >= 1 AND wrongAttempts <= 2`.
  - **1⭐** = `wrongAttempts >= 3`.
  - **0⭐** = puzzle not solved (only reachable on session abort; no abort UI in v1, so unreachable).
  - **Counter scope:** `wrongAttempts` is a **session-wide total across all 3 puzzles** (NOT per-puzzle). A student who passes Puzzle 1 on the first Check, fails Puzzle 2's Check once, then passes both retries, ends the session at `wrongAttempts === 1` → 2⭐.
- **Lives:** Not used (see Game Parameters above). No life-based star deduction.
- **Partial credit:** None. Each puzzle is binary (solved / not solved). The star rule reads only `puzzlesSolved` and `wrongAttempts` (session-wide total).

### Star Generosity Audit

(Authored per spec-creation skill expectation that L4 mastery games not give 3⭐ for free. Heuristic: 3⭐ should require demonstrated mastery — not survival.)

| Outcome scenario | Puzzles solved | Failed Check submissions | Stars | Generosity verdict |
|------------------|---------------|--------------------------|-------|--------------------|
| Solved all 3, every Check passed first try | 3 | 0 | **3⭐** | TIGHT — perfect-run only. |
| Solved all 3, 1 failed Check (anywhere across 3 puzzles) | 3 | 1 | **2⭐** | TIGHT — first slip already demotes. |
| Solved all 3, 2 failed Checks | 3 | 2 | **2⭐** | NEUTRAL — bottom of 2⭐ band; recoverable. |
| Solved all 3, 3+ failed Checks | 3 | ≥ 3 | **1⭐** | TIGHT — repeated submission failures = weak mastery. |
| Walked away after solving 1 or 2 puzzles | 1 or 2 | any | (Victory not reached — student exits via the harness, no stars awarded) | EDGE — v1 has no abort UI; this case is not surfaced. |

**Verdict:** The simplified rule is tight for L4 Analyze. 3⭐ requires every Check to pass on first submission across a 3-puzzle session — a high bar that genuinely reflects "solved without trial-and-error". The simplified scheme drops the hint axis (no hint button in v1) and uses a single counter, which is easier for the student to reason about ("if I get every Check right first time, I get all three stars"). **No generosity inflation detected.**

## Flow

**Shape:** Multi-round (default).

**Changes from default:**
- **No Game Over branch.** Lives never decrement → lives never reach 0 → the diagram's "Game Over" path and the subsequent "Ready to improve your score?" → restart route are unreachable in this game. The diagram is preserved for fidelity but the Game Over branch is dead-code in the runtime. (The "Play Again" route from Victory < 3⭐ is still reachable and IS used.)
- **In-board Check button (NOT PART-050)** — sits below the digit tray, full-width inside the board wrap. Disabled while any white cell is empty. On tap: full-puzzle validation. PART-050 (FloatingButton) is NOT used during gameplay; it IS used at end-of-game for the Next CTA per the standard archetype-6-without-FloatingButton path (see "No FloatingButton during gameplay" in Visual / Theme below).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Preview Screen (PART-039)                                              │
│   ─ instruction text + audio                                             │
│   ─ "Start" CTA                                                          │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   Welcome / Round 1 transition (PART-024 TransitionScreen)               │
│   ─ "Puzzle 1 of 3 — Warm-up (4×4)" + audio                              │
│   ─ tap to begin                                                         │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   Gameplay: Puzzle 1 (4×4)                                               │
│   ─ drag digit tile from tray to white cell (P6, @dnd-kit/dom)           │
│   ─ free placement, no per-cell validation                               │
│   ─ Check button enables once every white cell holds a digit             │
│   ─ Check (all runs valid) → round-complete SFX + TTS awaited → next     │
│   ─ Check (any run fails)  → red flash all failing runs + banner (FAF)   │
│                              wrongAttempts++; board stays editable       │
│              │                                                           │
│              ▼                                                           │
│   Round 2 transition ─ "Puzzle 2 of 3 — Standard (5×5)"                  │
│              │                                                           │
│              ▼                                                           │
│   Gameplay: Puzzle 2 (5×5)                                               │
│              │                                                           │
│              ▼                                                           │
│   Round 3 transition ─ "Puzzle 3 of 3 — Stretch (6×6)"                   │
│              │                                                           │
│              ▼                                                           │
│   Gameplay: Puzzle 3 (6×6)                                               │
│              │                                                           │
│              ▼                                                           │
│   Victory (TransitionScreen)                                             │
│   ─ stars rendered (1–3⭐ based on failed-Check count)                    │
│   ─ game_complete posted BEFORE end-game audio                           │
│   ─ AnswerComponent (3 slides — solved Puzzle 1/2/3)                     │
│   ─ Stars Collected screen                                               │
│   ─ Next CTA via floatingBtn.setMode('next')                             │
│                                                                          │
│   (If < 3⭐) Play Again → "Ready to improve your score?" → Round 1 reset │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

(There is no Game Over branch in this game; the default-flow diagram's Game Over path is unreachable here.)

## Feedback

| Event | Behavior |
|-------|----------|
| Drag a digit tile from the tray (drag-start) | Soft tap SFX (fire-and-forget, ~50 ms). Tile lifts to ~1.1× scale + soft shadow and follows the pointer. The dnd library renders its own drop-target hover state on whichever droppable cell the pointer is over. No TTS, no sticker, no input block. CASE 9. `beforedragstart` cancels the drag if `gameState.isProcessing || gameState.gameEnded || !gameState.isActive` (V21). |
| Drop a digit tile on a white cell | Digit lands in the cell with a 150 ms snap-in transition. No additional SFX (drag-start tap already played). **No validation fires.** If the placement fills the last empty white cell, `refreshCheckButton()` enables the Check button. No TTS, no sticker, no input block. |
| Drag a digit tile from a cell back to the tray (clear) | Soft tap SFX (fire-and-forget). Cell empties. Tile snaps back into the tray with 150 ms transition. `refreshCheckButton()` re-disables Check. No TTS, no input block. |
| Drag cancelled (released outside any drop target) | Suppressed-tap SFX (fire-and-forget). Tile snaps back to its origin (the tray) with 150 ms transition. No state change. No TTS. |
| Tap Check (button enabled, every run validates) | `handleSolve` fires. `progressBar.update(currentRound, lives)` fires FIRST. Board-wrap gets `.dnd-disabled` (V22) and `gameState.isProcessing = true`. Full-grid celebration glow (~600 ms cell-by-cell propagation), awaited round-complete SFX + celebration sticker, awaited dynamic TTS ("Brilliant! Every run adds up." / "Solved! That last run was tricky." — context-aware per puzzle id). Then auto-advance: to Round-(N+1) intro TS, or — on Puzzle 3 — to Victory + Stars Collected sequence. `renderRound` (on the next puzzle mount) clears `.dnd-disabled` and re-enables the Check button (V23). CASE 6. |
| Tap Check (button enabled, one or more runs fail) | Every cell in every failing run flashes red (~300 ms ease-in-out) + shake (~300 ms). Wrong-digit SFX **fire-and-forget**. Hint banner appears below the grid for ~3 s; banner text is the message for the first violated constraint (priority order: row sum → col sum → repeat → both → multi-constraint-collapse-failure); if multiple runs fail, banner appends "(N runs are off)". `gameState.wrongAttempts` increments by 1 (per submission, NOT per failing run). Digits STAY in cells; Check button stays enabled (cells are still all filled) so the student can fix and re-tap. No life decrement (no lives counter). No input block beyond the red-flash window. `recordAttempt` tags the misconception per the priority order. CASE 7 multi-step. |
| All 3 puzzles solved (Victory) | Timer N/A. Results / Victory screen renders FIRST (stars, AnswerComponent carousel, Next slot). `game_complete` posted BEFORE end-game audio. Then victory SFX + VO, played sequentially. Different VO per star tier (3⭐ "Perfect! Every Check, first try." / 2⭐ "Solved! One small slip." / 1⭐ "You got there — that was tough!"). CASE 11. |
| Stars Collected (after Victory) | `sound_stars_collected` awaited → `show_star` postMessage → setTimeout reveals Next via `floatingBtn.setMode('next')`. Per `default-transition-screens.md` § 4. |
| Play Again (from Victory if < 3⭐) | All audio stopped, all state resets including `wrongAttempts → 0`, all grid cells cleared, `currentRound → 1`, `setIndex` rotates A → B → C → A. Routes through "Ready to improve your score?" transition then to Round 1 transition. CASE 13. |
| Next (from Stars Collected at 3⭐) | `floatingBtn.setMode('next')` posts `next_ended`; harness tears down the iframe. |
| Tab switch / screen lock | Timer N/A. Static & stream audio paused. VisibilityTracker's PopupComponent renders the pause overlay (autoShowPopup default; do NOT build a custom overlay). CASE 14. |
| Tab restored | Audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues. CASE 15. |
| Audio failure (any audio call rejects) | Try/catch swallows; visual feedback (celebration glow, red flash, sticker, hint banner) still renders. Game continues. CASE 16. |

**Hint banner wording (Class 4–6 register, short and concrete):**
- Row sum violated: `"This row needs to sum to <N>."` — `<N>` is the row-clue value for the run.
- Column sum violated: `"This column needs to sum to <N>."`
- Repeat in run: `"No repeats in a run."`

These three string templates are stored in `fallbackContent` per round (under `hintMessages`) and are consumed by the **Check failure handler only** (not by any per-cell validator — there is no per-cell validation in v1). At validation time `<N>` is interpolated with the offending run's clue value. The `showHintBanner(message, durationMs)` helper and the `#hintBanner` DOM element are kept exactly as the original spec described — they are simply repurposed from "per-digit wrong feedback" to "Check submission failure feedback". When multiple runs fail, the banner appends "(N runs are off)" after the first violated constraint message.

**Why Check failures are fire-and-forget (no awaited TTS):** the concept frames Kakuro as "quiet and deliberate, audio is minimal — only on success, on error, and on completion. The student should feel like they're the one driving the pace." An awaited TTS on every failed Check would make the game feel chatty and slow. Failed Checks use the hint banner (visual, on-screen, persistent for 3 s) as the "explanation" surface, with only a short SFX as the audio cue. This is the multi-step CASE 7 variant explicitly allowed by the Feedback skill: *"Multi-step games keep mid-round partial matches fire-and-forget for pacing, but round-complete still awaits TTS for the same reason single-step does."* The successful-Check beat (= puzzle-solve) still awards awaited audio (CASE 6) so the moment of success lands with full weight.

## Content Structure (fallbackContent)

**Top-level fields:**
- `previewInstruction` — HTML, full instruction shown on PART-039 preview overlay.
- `previewAudioText` — plain-text narration for preview TTS (patched at deploy time).
- `previewAudio` — `null` (filled at deploy time by TTS pipeline).
- `showGameOnPreview` — `false` (puzzle should not be visible behind preview).
- `totalRounds` — `3`.
- `totalLives` — `99` (high cap; never decremented; never visible — see Game Parameters "Why no lives").
- `answerComponent` — `true` (default; not opted out).
- `rounds[]` — 9 round objects (3 sets × 3 rounds), with `set: 'A' | 'B' | 'C'` on every entry.

### Per-round payload shape

Each round object carries the data needed to render one puzzle and validate placements. The board is described as a 2D grid of cell descriptors:

```js
{
  set: 'A' | 'B' | 'C',
  id: 'A_r1_p1' | 'A_r2_p2' | 'A_r3_p3' | 'B_r1_p1' | ... ,  // globally unique
  round: 1 | 2 | 3,                  // round index within a set
  stage: 1 | 2 | 3,                  // === round (one stage per round)
  type: 'kakuro-board',
  size: 4 | 5 | 6,                   // grid dimension (4 for stage 1, 5 for stage 2, 6 for stage 3)

  // 2D grid of cell descriptors. grid[r][c] is one of:
  //   { kind: 'wall' }                          → solid black wall, no interaction
  //   { kind: 'clue', row: <N|null>, col: <N|null> }
  //                                              → clue cell with optional row sum (top-right)
  //                                                and/or column sum (bottom-left). At least one
  //                                                of row/col must be non-null.
  //   { kind: 'white', solution: <1..9> }       → white empty cell with its solution digit
  grid: [
    [ { kind: 'wall' }, { kind: 'clue', row: 4, col: null }, { kind: 'clue', row: 3, col: null }, { kind: 'wall' } ],
    [ { kind: 'clue', row: null, col: 4 }, { kind: 'white', solution: 1 }, { kind: 'white', solution: 3 }, { kind: 'wall' } ],
    [ { kind: 'clue', row: null, col: 3 }, { kind: 'white', solution: 3 }, { kind: 'wall' }, { kind: 'wall' } ],
    [ { kind: 'wall' }, { kind: 'wall' }, { kind: 'wall' }, { kind: 'wall' } ]
  ],
  // (Above is a worked 4×4 example — see Stage 1 Worked Example below for the rendered layout.)

  // List of all white runs in the puzzle. Each run is identified by its clue cell, direction,
  // sum, and the list of {r, c} positions of the white cells it covers (in order from clue
  // outward). The build-time validator asserts these match the `grid` data and that each run's
  // unique decomposition matches the solution digits.
  runs: [
    { id: 'r1', dir: 'row',    sum: 4, cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }] },
    { id: 'r2', dir: 'col',    sum: 4, cells: [{ r: 1, c: 1 }, { r: 2, c: 1 }] },
    { id: 'r3', dir: 'col',    sum: 3, cells: [{ r: 1, c: 2 }] },   // length-1 runs are degenerate but allowed
    // ... etc
  ],

  hintMessages: {
    rowSum:    'This row needs to sum to <N>.',
    colSum:    'This column needs to sum to <N>.',
    repeat:    'No repeats in a run.'
  },

  // The unique pre-validated solution as a flat dictionary keyed by 'r,c'. Authored redundantly
  // to grid[r][c].solution for AnswerComponent convenience; build-time validator asserts they
  // describe the same assignment.
  answer: {
    digits: { '1,1': 1, '1,2': 3, '2,1': 3 }   // (for the 4×4 example above)
  },

  // Misconception tags for each constraint type. Used by recordAttempt to record WHICH rule
  // the student violated on each wrong-digit placement (one tag per attempt event).
  misconception_tags: {
    'row-sum-violated':    'sum-decomposition-error',
    'col-sum-violated':    'cross-constraint-overlooked',
    'repeat-in-run':       'no-repeat-rule-overlooked',
    'both-row-and-col':    'multi-constraint-collapse-failure'
  }
}
```

**Misconception tags (named, real misconceptions for additive constraint reasoning at L4):**
- `sum-decomposition-error` — student picked a digit that would make the row run not sum to its clue (e.g. they thought 7 = 2 + 6 = 8 → placed 8 in a 7-row). Most common at Stage 1; reflects weak decomposition fluency. Surfaces when a wrong digit causes ONLY the row sum (or ONLY the column sum) to be violated.
- `cross-constraint-overlooked` — student picked a digit that satisfies ONE clue (the one they were focused on) but violates the OTHER clue at the same intersection. The single most common misconception in Kakuro. Surfaces when a wrong digit completes a run that sums correctly along ONE axis but violates the OTHER axis. (We tag this on `col-sum-violated` because the typical scenario is "I solved the row, ignored the column".)
- `no-repeat-rule-overlooked` — student placed a digit that's already in the run. Reflects forgetting the second Kakuro rule. Common at Stage 2/3 where runs of length 3+ make the "available digits" set non-trivial.
- `multi-constraint-collapse-failure` — both row and column constraints are simultaneously broken. Reflects "I just guessed". Less common; signals the student is brute-forcing rather than reasoning. Recorded only when both axes fail; the hint banner still shows the row message (priority) but `recordAttempt` tags this stronger label.

(Each wrong-digit placement records exactly ONE tag. Tag selection: if both row and column are violated → `multi-constraint-collapse-failure`. Else if only row violated → `sum-decomposition-error`. Else if only column violated → `cross-constraint-overlooked`. Else if repeat-in-run → `no-repeat-rule-overlooked`.)

### Round-set cycling — 9 round objects total

The spec authors **three full sets (A, B, C) × 3 rounds = 9 round objects**. The build step copies these verbatim into `fallbackContent.rounds`. Each set has different white/black layouts and different unique solutions per puzzle, but parallel difficulty (Set A's Stage-1 ≈ Set B's Stage-1 ≈ Set C's Stage-1 etc.). Build-time validator (exhaustive search over digit assignments) asserts each puzzle admits exactly one valid solution equal to the round's `answer.digits`.

### Worked-example puzzle per stage

The three worked examples below ARE the Set-A Stage 1 / 2 / 3 puzzles. Sets B and C will be hand-authored at game-planning Step 3 with the same difficulty profile but different layouts and solutions. Each puzzle's grid is shown as ASCII; the rendered cell types are:
- `█████` — black wall
- `[7\]` — clue with row sum 7 only (top-right)
- `[\3]` — clue with column sum 3 only (bottom-left)
- `[7\3]` — clue with row sum 7 (top-right) AND column sum 3 (bottom-left)
- ` _ ` — empty white cell (will hold a digit 1–9 at solve)
- `(d)` — white cell with solution digit `d` shown for documentation

#### Stage 1 worked example — 4×4, Set A Round 1 (`A_r1_p1`)

A two-run, two-cell-each puzzle. Total white cells: 3. Two row clues (4 and 3) and two column clues (4 and 3). Every run is a pair, every clue is a single-digit pair-sum, every pair has a UNIQUE decomposition (4 = 1+3, 3 = 1+2). Solution: top-left white = 1, top-right white = 3, bottom-left white = 3 (with the cells laid out as below).

```
┌─────┬─────┬─────┬─────┐
│█████│[4\] │[3\] │█████│
├─────┼─────┼─────┼─────┤
│[\4] │ (1) │ (3) │█████│
├─────┼─────┼─────┼─────┤
│[\3] │ (3) │█████│█████│
├─────┼─────┼─────┼─────┤
│█████│█████│█████│█████│
└─────┴─────┴─────┴─────┘
```

- **Row run 1** (clue at (0,1), `row: 4`): cells (1,1)+(1,2) must sum to 4 → unique decomposition 1+3.
- **Row run 2** (clue at (0,2), `row: 3`): cells (1,2) is part of the column run — wait, actually this clue is for a row to its right which doesn't exist; for the worked example we treat (0,2) as carrying ONLY a row-of-1 (degenerate) — let's restate clean: the clue at (0,2) carries only a column sum of 3, not a row sum. **Restated clean layout:**

```
┌─────┬─────┬─────┬─────┐
│█████│[4\] │[\3] │█████│   ← (0,1) carries row sum 4; (0,2) carries column sum 3
├─────┼─────┼─────┼─────┤
│[\4] │ (1) │ (3) │█████│   ← (1,0) carries column sum 4; whites at (1,1)=1, (1,2)=3
├─────┼─────┼─────┼─────┤
│[\3] │ (3) │█████│█████│   ← (2,0) carries column sum 3; white at (2,1)=3
├─────┼─────┼─────┼─────┤
│█████│█████│█████│█████│
└─────┴─────┴─────┴─────┘
```

- **Row run** (clue at (0,1) `row: 4`, run cells (1,1),(1,2)): 1 + 3 = 4 ✓. Unique decomposition 1+3.
- **Column run** at column 1 (clue at (1,0) `col: 4`, run cells (1,1),(2,1)): 1 + 3 = 4 ✓. Unique decomposition 1+3.
- **Column run** at column 2 (clue at (0,2) `col: 3`, run cells (1,2)): single-cell run with sum 3 → must be 3.
- (Note: column 1 also has a `col: 3` clue at (2,0) but (2,0) is positioned to the LEFT of (2,1) so it's the row-clue for the row-of-1 at (2,1). For the worked example, treat (2,0) as carrying `row: 3` instead. Two independent single-cell row runs is fine for a 4×4.)

Solution: `{ '1,1': 1, '1,2': 3, '2,1': 3 }`. **Unique** — exhaustive search over 9³ = 729 assignments confirms only this one satisfies all three runs.

(This is intentionally a very small Stage-1 puzzle — small even for stage 1. The actual Set-A / Set-B / Set-C Stage-1 puzzles authored at game-planning Step 3 will be slightly denser: 6–8 white cells, two or three pair runs and one length-3 run, sums in the 5–13 range. The above is the canonical "shape" example so the build step has an unambiguous data-shape anchor.)

#### Stage 2 worked example — 5×5, Set A Round 2 (`A_r2_p2`)

A canonical 5×5 Kakuro: 4 row runs and 4 column runs, mix of 2-cell and 3-cell runs, sums in the 6–17 range. The solution requires at least one set-intersection deduction (a cell where row says "3 or 4" and column says "4 or 5" → must be 4).

```
┌─────┬─────┬─────┬─────┬─────┐
│█████│█████│[6\] │[10\]│█████│
├─────┼─────┼─────┼─────┼─────┤
│█████│[16\3]│ (1) │ (2) │█████│
├─────┼─────┼─────┼─────┼─────┤
│[\11]│ (4) │ (5) │ (3) │[6\] │
├─────┼─────┼─────┼─────┼─────┤
│[\10]│ (3) │█████│ (5) │ (1) │
├─────┼─────┼─────┼─────┼─────┤
│█████│[\7] │█████│█████│█████│
└─────┴─────┴─────┴─────┴─────┘
```

Approximate run-set (illustrative, the build-time validator will produce the canonical run list from the grid):
- Row run at row 1 (clue `row: 16` at (1,1), cells (1,2),(1,3)): wait, `row: 16` for a 2-cell run means two distinct digits 1–9 summing to 16 → 7+9 or 8+8 (rejected, repeat) → unique 7+9. Restate sum: let's use 3 instead → row run sums to 3, cells (1,2)+(1,3) → 1+2 (unique). **Restated clue at (1,1):** `{ row: 3, col: 11 }`.
- Row run at row 2 (clue `row: 11` carried by `[\11]` — wait, `[\X]` is a column clue not a row clue): use `[X\Y]` notation where the clue at (2,0) carries BOTH a column (going down to (2,1),(3,1)) and a row (going right to (2,1),(2,2),(2,3)) — but (2,0) doesn't have a row to its right unless… reset. A cleaner restatement: the clue at (1,1) carries `{ row: 3, col: 7 }`, and the clue at (2,0) carries only `{ row: 12 }` (a 3-cell row run summing to 12 with cells (2,1),(2,2),(2,3) → e.g. 4+5+3 — let's go with that).
- Reconciling, the cleanest 5×5 layout for the worked example is:

```
┌─────┬─────┬─────┬─────┬─────┐
│█████│█████│[\3] │[\10]│█████│
├─────┼─────┼─────┼─────┼─────┤
│█████│[3\7]│ (1) │ (2) │█████│
├─────┼─────┼─────┼─────┼─────┤
│[12\]│ (4) │ (5) │ (3) │[\1] │
├─────┼─────┼─────┼─────┼─────┤
│[9\] │ (3) │█████│ (5) │ (1) │
├─────┼─────┼─────┼─────┼─────┤
│█████│[\7] │█████│█████│█████│
└─────┴─────┴─────┴─────┴─────┘
```

- **Row runs:**
  - (1,1) `row: 3`, cells (1,2),(1,3): 1+2 = 3 ✓ (unique pair-decomposition).
  - (2,0) `row: 12`, cells (2,1),(2,2),(2,3): 4+5+3 = 12 ✓ (one of several decompositions; resolved by column constraints).
  - (3,0) `row: 9`, cells (3,1),(3,3),(3,4) — wait, (3,2) is a wall, so the row is split: (3,1) is its own length-1 run, and (3,3),(3,4) is a length-2 run. Two row clues needed. **Restate:** (3,0) carries `row: 3` for the length-1 run at (3,1); a new clue at (3,2) wall-separator carries `row: 6` for (3,3),(3,4).
- **Column runs:**
  - (0,2) `col: 3`, cells (1,2),(2,2): 1+5 = 6 ≠ 3 — contradiction. **Restate column clue at (0,2):** `col: 6`. Then 1+5 = 6 ✓.
  - (0,3) `col: 10`, cells (1,3),(2,3),(3,3): 2+3+5 = 10 ✓.
  - (1,1) `col: 7`, cells (2,1),(3,1): 4+3 = 7 ✓.
  - (2,4) `col: 1`, cells (3,4): single cell = 1 ✓.

**Solution:** `{ '1,2':1, '1,3':2, '2,1':4, '2,2':5, '2,3':3, '3,1':3, '3,3':5, '3,4':1 }`.

The set-intersection move sits at cell (2,2): the row says "12 = 4+5+3 in some order, with (2,1)=4 from the column-7 constraint and (2,3)=3 from the column-10 constraint, so (2,2) must be 5". This is the canonical pedagogical move the concept calls out.

(The actual Set-A / Set-B / Set-C Stage-2 puzzles authored at game-planning Step 3 will follow this exact shape — 4 row runs, 4 column runs, ≥ 1 set-intersection deduction. The above worked example is the data-shape anchor.)

#### Stage 3 worked example — 6×6, Set A Round 3 (`A_r3_p3`)

A canonical 6×6 Kakuro: 6+ row runs, 6+ column runs, two or three length-3 runs, one length-4 run, sums up to 22. Multi-cell working memory is required ("hold two or three options for this cell while you solve the rest of the run").

(Full ASCII layout omitted from this spec for brevity — the data-shape anchor in Stage 1 + Stage 2 is sufficient. The Stage-3 layout will be authored at game-planning Step 3 in `games/kakuro/pre-generation/puzzles.md` with: 6×6 grid, ~20 white cells, ~10 black walls, ~6 clue cells, sums in 6–28, at least one length-4 run, and at least three set-intersection deductions in the unique solution. The build-time validator confirms uniqueness via exhaustive search — for a 6×6 with 20 white cells the search space is ~9^20 = ~10^19 in the worst case but pruning by the run constraints cuts this to milliseconds in practice; if the validator times out on a candidate puzzle, the puzzle is rejected and the author iterates.)

### `fallbackContent` skeleton (all 9 rounds)

```js
const fallbackContent = {
  previewInstruction:
    '<p>Fill the white cells with digits <b>1–9</b> so that:</p>' +
    '<ol>' +
      '<li>Each row of white cells adds up to the small number on its left.</li>' +
      '<li>Each column of white cells adds up to the small number on top.</li>' +
      '<li>No digit repeats inside a single row or column run.</li>' +
    '</ol>' +
    '<p>Drag a digit tile from the tray onto a white cell. To change a digit, drag a different tile onto the cell; ' +
    'to clear it, drag the digit back to the tray. When every cell is filled, tap <b>Check</b> to submit. ' +
    'No timer — take your time.</p>',
  previewAudioText:
    'Fill the white cells with digits one to nine so each row and each column adds up to its small clue number. ' +
    'No digit can repeat inside the same run. Drag a digit tile from the tray onto a white cell. ' +
    'When every cell is filled, tap Check to submit. There is no timer — take your time.',
  previewAudio: null,
  showGameOnPreview: false,
  totalRounds: 3,
  totalLives: 99,                    // high cap; never decremented; never displayed
  answerComponent: true,

  rounds: [
    // ── Set A — 3 rounds ──
    { set: 'A', id: 'A_r1_p1', round: 1, stage: 1, type: 'kakuro-board', size: 4,
      grid:  /* 4×4 hand-authored — see Pre-Generation §A.1 (Stage 1 worked example above is the canonical Set-A Round 1) */ null,
      runs:  /* derived from grid; verified at build time */ null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: /* solution dictionary */ null },
      misconception_tags: { 'row-sum-violated':    'sum-decomposition-error',
                            'col-sum-violated':    'cross-constraint-overlooked',
                            'repeat-in-run':       'no-repeat-rule-overlooked',
                            'both-row-and-col':    'multi-constraint-collapse-failure' }
    },
    { set: 'A', id: 'A_r2_p2', round: 2, stage: 2, type: 'kakuro-board', size: 5,
      grid:  /* 5×5 — Pre-Generation §A.2 (Stage 2 worked example above is canonical Set-A Round 2) */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { 'row-sum-violated':    'sum-decomposition-error',
                            'col-sum-violated':    'cross-constraint-overlooked',
                            'repeat-in-run':       'no-repeat-rule-overlooked',
                            'both-row-and-col':    'multi-constraint-collapse-failure' }
    },
    { set: 'A', id: 'A_r3_p3', round: 3, stage: 3, type: 'kakuro-board', size: 6,
      grid:  /* 6×6 — Pre-Generation §A.3 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same as above */ }
    },

    // ── Set B — 3 rounds (parallel difficulty to Set A; different layouts / solutions) ──
    { set: 'B', id: 'B_r1_p1', round: 1, stage: 1, type: 'kakuro-board', size: 4,
      grid:  /* 4×4 — Pre-Generation §B.1 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    },
    { set: 'B', id: 'B_r2_p2', round: 2, stage: 2, type: 'kakuro-board', size: 5,
      grid:  /* 5×5 — Pre-Generation §B.2 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    },
    { set: 'B', id: 'B_r3_p3', round: 3, stage: 3, type: 'kakuro-board', size: 6,
      grid:  /* 6×6 — Pre-Generation §B.3 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    },

    // ── Set C — 3 rounds (parallel difficulty to Set A; different layouts / solutions) ──
    { set: 'C', id: 'C_r1_p1', round: 1, stage: 1, type: 'kakuro-board', size: 4,
      grid:  /* 4×4 — Pre-Generation §C.1 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    },
    { set: 'C', id: 'C_r2_p2', round: 2, stage: 2, type: 'kakuro-board', size: 5,
      grid:  /* 5×5 — Pre-Generation §C.2 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    },
    { set: 'C', id: 'C_r3_p3', round: 3, stage: 3, type: 'kakuro-board', size: 6,
      grid:  /* 6×6 — Pre-Generation §C.3 */ null,
      runs:  null,
      hintMessages: { rowSum: 'This row needs to sum to <N>.',
                      colSum: 'This column needs to sum to <N>.',
                      repeat: 'No repeats in a run.' },
      answer: { digits: null },
      misconception_tags: { /* same */ }
    }
  ]
};
```

**Pre-Generation step (game-planning Step 3):** Before Step 4 (Build), the orchestrator generates the 9 puzzle layouts (`grid` + `runs` + `answer.digits`) and writes them into `games/kakuro/pre-generation/puzzles.md`. Each puzzle is verified by exhaustive-search-with-pruning — search space is ~9^N where N is the number of white cells (16 for stage 1, ~25 for stage 2, ~36 for stage 3 worst-case), pruned by run constraints to milliseconds. The build step in Step 4 inlines the resulting grids into `fallbackContent.rounds`. Parallel-difficulty constraint: Set A's Stage-1 ≈ Set B's Stage-1 ≈ Set C's Stage-1 in run count, run lengths, and number of unique decompositions per run; same for Stage 2 and Stage 3.

### AnswerComponent payload shape

Each round's `answer` is rendered by `renderAnswerForRound(round, container)` as a non-interactive solved Kakuro grid:
- The grid is painted with the round's `grid` data, but every white cell shows its `solution` digit (no empty cells).
- All white cells render in the celebration mint-green colour to convey "solved state" at a glance.
- Clue cells render with their row / column sums in their canonical positions (top-right / bottom-left).
- Black walls render solid.
- No tap handlers, no draggable tiles, no hint button — pure solved-state visual recap.
- The carousel shows 3 slides (one per stage). Slide title: "Puzzle 1 — Warm-up (4×4)", "Puzzle 2 — Standard (5×5)", "Puzzle 3 — Stretch (6×6)". Slide subtitle (small, optional): a one-liner per stage focusing on the load-bearing skill — e.g. Stage 2 subtitle: "Cross-clue intersection — the row says 3-or-4, the column says 4-or-5, so the cell must be 4." — Stage 3 subtitle: "Triple-run elimination — three options in working memory, collapsed by the column."

## Visual / Theme

- **Layout:** PART-021 standard mobile layout. Header (puzzle counter only) on top, board centered, digit-tray strip below the board (always visible — no slide-in/out lifecycle), Check button below the tray (full-width inside the board wrap), hint banner slot beneath the Check button.
- **Board sizing on a 375 px-wide viewport (16 px outer padding, 343 px available):**
  - **Stage 1 (4×4):** ~83 px cells with 1 px gridlines. **Touch target margin: ~39 px headroom.** Generous.
  - **Stage 2 (5×5):** ~67 px cells with 1 px gridlines. **Touch target margin: ~23 px headroom.** Comfortable.
  - **Stage 3 (6×6):** ~56 px cells with 1 px gridlines. **Touch target margin: ~12 px headroom.** Above the 44 px minimum but tighter — confirm at testing.
- **Cell hit area:** the entire cell is the tap target. No nested tap target inside the cell. Clue cells and black walls are explicitly NOT tap targets (`pointer-events: none` on walls and clues). White cells have `cursor: pointer` and `touch-action: manipulation`.
- **Digit tray:** below the grid, full-width minus padding (~343 px). 9 reusable draggable digit tiles in a 5+4 layout: row 1 = digits 1–5, row 2 = digits 6–9 (the bottom-right slot of row 2 is left empty — the tray itself doubles as the clear-zone, so no separate Clear tile is needed). Each tile ~62 × 56 px (well above the 44 px touch-target minimum). Each tile renders the digit centred in a large rounded sans, on a cream (`#F5F0E8`) background with a 1 px navy border and a soft shadow. The tray is always visible (no slide-in/out lifecycle). Tiles have `touch-action: none` so the dnd pointer sensor captures gestures without page scroll.
- **Drag preview:** during drag, the dragged tile is lifted to ~1.1× scale with a stronger shadow (`0 8 px 16 px rgba(0,0,0,0.18)`) and follows the pointer. On drop into a valid cell, the digit transitions into place with a 150 ms snap-in animation (scale 0.85 → 1, opacity 0 → 1). On a rejected drop or drag-cancel, the tile snaps back to its tray slot with a 150 ms transition.
- **Drop-target hover affordance:** while a tile is being dragged over a white cell, the dnd library adds a `data-droppable-over` attribute (or equivalent) — the spec's CSS adds a soft yellow inset ring (`#F1C453`, 2 px) on `[data-droppable-over]` white cells. Walls and clue cells are NOT registered as droppables, so they never receive this state.
- **Celebration glow on Check accept:** per-cell ease-in of mint-green background (`#CDE9D7`) over 50 ms, propagating across the whole grid (cell-by-cell from the centre outward, ~600 ms total). All white cells STAY mint-green for the rest of the puzzle (until `renderRound` mounts the next puzzle and resets cell backgrounds).
- **Wrong-Check red flash:** every cell in every failing run flashes red (`#E63946`) at full opacity for 300 ms (1 cycle of 300 ms ease-in-out). Companion shake: ±4 px translateX over 300 ms (3 cycles of 100 ms). NOT continuous animation — momentary feedback only (mobile rule #14 / advisory #30). After the flash, the cells return to their normal state with their digits still in place.
- **Hint banner (repurposed for Check failure):** appears below the Check button when a Check submission fails. Single-line, 14 px font, `--mathai-color-text-secondary` foreground, soft red background (`rgba(230, 57, 70, 0.10)`). Auto-fades after 3 s (opacity 1 → 0 over 200 ms). DOM and `showHintBanner` helper are unchanged from the original spec — the only change is when it fires (Check failure, not per-cell wrong).
- **Check button:** primary-style button below the digit tray (full-width inside the board wrap, ~44 px tall). Label "Check". States: **disabled** (any white cell empty, OR `gameState.isProcessing` true): `opacity: 0.5; pointer-events: none; cursor: default`. **Enabled** (every white cell holds a digit AND not processing): full opacity, primary background, `cursor: pointer`. Created in `buildBoardDOM`, refreshed on every placement change via `refreshCheckButton()`.
- **Clue cells:** dark navy background (`#1F2A37`), small clue numbers in cream (`#F5F0E8`), top-right for row sum, bottom-left for column sum, with a thin diagonal divider when both are present.
- **Black walls:** solid dark navy (`#1F2A37`), no content, no interaction.
- **Empty white cells:** cream background (`#F5F0E8`), thin border `--mathai-color-border` (1 px) around each cell. When selected: 2 px yellow ring overlay.
- **Mobile compliance:** all rules in mobile/SKILL.md apply. `viewport meta` correct, `100dvh`, `overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: manipulation` on the Check button, **`touch-action: none` on the draggable digit tiles `.kkr-tile` (NOT on the tray container `.kkr-tray`)** — per `interaction/SKILL.md` § P6 V16: `touch-action: none` belongs on the tiles, not on the tray container. Required so the dnd-kit `PointerSensor` can capture touch gestures without page scroll; never apply to the body/grid/cells. `-webkit-` prefixes paired with standard properties, no `gap` on flex (margin-based spacing or grid `gap` only). The `touchmove` preventDefault is gated on an `isDragging` flag (set on `dragstart`, cleared on `dragend`/`dragcancel`) per the P6 reference. All colours use `--mathai-*` variables where one exists; the cream / navy / mint / yellow accents fall back to literal hex (acceptable per rule #37 since these are game-specific theme colours not in the variable palette — but the build step should consider whether to add them as game-local CSS variables).
- **No FloatingButton during gameplay (PART-050 partial):** the game's per-puzzle Submit affordance is the in-board Check button (a plain primary `<button>` below the digit tray, not a FloatingButton). PART-050 is therefore NOT used during gameplay. **However**, end-of-game still posts `next_ended` per the standard archetype-6-without-FloatingButton path: TransitionScreen's onMounted fires `show_star`, then `floatingBtn.setMode('next')` is called from the Stars Collected screen per `default-transition-screens.md` § 4. This means PART-050 IS included in the PART-flag set (for the end-of-game Next), but is NOT wired to per-puzzle Check (the in-board Check button handles that). Validator note: archetype 6 lists PART-050 as conditional; we use it for the end-of-game Next CTA only. Sub-rule "Next button at end-of-game" is satisfied; sub-rule "Try Again for standalone + lives" is N/A (multi-round game).
- **No Game Over screen.** Lives never decrement → the `game_over` phase is unreachable. The state machine is `start → gameplay → results` (Victory only). Validator should NOT trip "lives = 0 means no game_over screen" because lives are never decremented to 0 in the first place; the game also explicitly omits the `game_over` screen.

## Out of Scope

- **No procedural puzzle generation in v1** — all 9 puzzles are hand-authored at game-planning Step 3 and pre-validated for unique solvability. Future work: a build-time generator that produces and uniqueness-validates new puzzle layouts per session, growing toward the concept's "~30 per stage" bank.
- **No concept-of-uniqueness teaching surface** — the unique-solution property is enforced by the build-time validator, not surfaced to the student. (A future iteration could surface "this puzzle has a unique solution" as a meta-fact, but v1 keeps the puzzle pure.)
- **No Game Over branch / no lives** — see Game Parameters. A determined student can take any number of failed Check submissions; the cost is borne by star deduction at end-of-game, not by mid-puzzle session termination.
- **No undo of past failed Check submissions** — `wrongAttempts` only goes up; there is no "undo last attempt" affordance. The student CAN clear / change a digit, but the failed-Check counter does not decrement when they do. Mistakes are information, and the audit of mistakes is preserved.
- **No mid-puzzle hint affordance.** No hint button. No "show me a cell" button. No "validate this run" partial-check. The student reasons through the puzzle and commits whole-puzzle via Check.
- **No per-cell run-completion feedback.** No green flash on partial run-completion, no run locking during placement, no red flash on a wrong digit dropped on a cell. All validation feedback is gated behind the Check button.
- **No leaderboard / streak tracking across sessions** — single-session game.
- **No timer / speed scoring** — the concept explicitly forbids it. PART-006 NOT included.
- **No multiplayer / two-player race** — single player only.
- **No region-colour personalization / dark mode** — palette is fixed. (System-level dark mode is honoured by FeedbackManager but the board's cream-on-navy is intentional and does not invert.)
- **No sound mute / volume controls beyond the platform-standard mute toggle** — handled by FeedbackManager and the harness.
- **No advanced clue types** (e.g. Killer-Sudoku-style "cage clues", or Kakuro variants with negative or fractional sums) — strictly the standard Kakuro rule set: row sum, column sum, no repeats in a run, digits 1–9.

## Decision-Points / Open Items

(For the creator and spec-review to confirm before Step 4 / Build.)

1. **`totalLives: 99` as a "no lives" cap.** This is a workaround so the data contract (which expects a `totalLives` field) does not break. The build step MUST hide the lives indicator (e.g. CSS `display: none` on the lives slot in the progress bar, or pass `null` to `progressBar.update`). **Confirm:** acceptable workaround, or should the spec instead set `totalLives: 0` and confirm with PART-023 that `0` is treated as "no lives display" rather than "instant Game Over"? (The skill's anti-pattern #3 calls out "Lives = 0 means no game_over screen" — i.e. `0` IS the canonical no-lives signal. **Recommended switch:** flip to `totalLives: 0` if PART-023 supports it without rendering "0 hearts" in the header.)
2. **Hand-authored puzzles (game-planning Step 3 dependency).** Need 9 unique-solution Kakuro puzzles (3 sets × 3 stages) at parallel difficulty. **Confirm:** acceptable, and that the parallel-difficulty constraint across sets is enforceable (Set A's Stage-1 ≈ Set B's Stage-1 ≈ Set C's Stage-1 in run count, run lengths, and unique-decomposition density).
3. **Validation model: free placement + Check-button submit (NOT per-cell validation, NOT auto-detect-on-last-cell).** This is a deliberate v1 redesign from the original per-cell-validation model: the student drops digits freely with no per-cell or per-run feedback, then taps Check to submit the whole puzzle. **Confirm:** acceptable. The trade-off is no incremental "this is wrong, try again" beat during placement — the student gets all of their feedback at Check time. Pros: matches "quiet and deliberate" framing; lets the student commit to a strategy without micro-corrections. Cons: a student who misses the Sum-9 = 4+5 (not 3+6) decomposition gets no signal until they Check; first-Check pass-rate may run lower than the per-cell-validation original. See Warnings.
4. **Failed Check is fire-and-forget (no awaited TTS).** The Feedback skill explicitly allows this (multi-step CASE 7 variant). **Confirm:** acceptable per the concept's "quiet and deliberate" framing.
5. **No Game Over branch.** This is the largest deviation from a typical L4 game (which usually has lives → Game Over for stakes). The concept explicitly forbids stakes ("Mistakes are information"). **Confirm:** acceptable. If a future iteration wants stakes, lives can be added in a versioned spec.
6. **Simplified star rule (3⭐ = wrongAttempts === 0; 2⭐ = 1–2; 1⭐ = ≥ 3).** Single counter (failed Check submissions). Drops the original `hintsUsed` axis since no hint button ships in v1. **Confirm:** acceptable thresholds, or should 2⭐ allow up to 3 (slightly more lenient)?
7. **Run validation timing — whole-puzzle on Check tap.** No per-cell, no per-run, no auto-detect. The Check button is the single validation gate. **Confirm:** acceptable.
8. **No PART-050 FloatingButton during gameplay; PART-050 IS used at end-of-game.** Per-puzzle Submit is the in-board Check button (a plain primary `<button>`, not a FloatingButton). PART-050 ships only for the end-of-game Next CTA. **Confirm:** acceptable interpretation.

## Defaults Applied

(Decisions NOT specified by the creator and filled by a default. Per spec-creation Step 3, `answerComponent` is silently `true` and is NOT listed here.)

- **Pre-generation step:** defaulted to "hand-authored puzzles, build-time exhaustive uniqueness check" (creator described a "bank of ~30 per stage" as a goal but the v1 ship has 3 sets × 3 stages = 9 hand-authored puzzles).
- **Stage-1 / 2 / 3 expected solve times:** defaulted to 1–3, 4–8, 6–12 minutes respectively (creator specified 4–8 min for Stage 2 specifically; Stage 1 and 3 were inferred to bracket Stage 2 with a 1.5x – 2x scale).
- **First-Check pass-rate targets per stage (80 / 60 / 40 %):** defaulted by spec author per pedagogy.md L4 70–85 % overall target tightened by stage to reflect mastery progression (Stage 1 high to be the on-ramp; Stage 3 low to be the mastery gate). Without per-cell validation, the actual realised pass-rate may run lower; see Warnings.
- **Interaction pattern P6 (Drag-and-Drop) chosen over P15 (Cell Select → Number Picker).** Library: `@dnd-kit/dom@beta` via `https://esm.sh/@dnd-kit/dom@beta`. Sensors: `PointerSensor` with activation distance **3 px** (matches P6 §8 Universal Touch Support; was 6 px in the original spec, lowered to 3 px for parity with the rest of the codebase) plus optional `KeyboardSensor` for accessibility (left/right arrows cycle tiles, Enter drops on focused cell). Default per concept's interaction-flexibility framing; P6 gives a more tactile, physically-meaningful "place a digit" gesture for Class 4–6 and aligns with `interaction/SKILL.md` line 196 ("Kakuro: P6 (Drag-and-Drop into grid) or P15 (Cell + Picker)").
- **Drop-target hover ring (`#F1C453`, 2 px inset):** defaulted (creator did not specify; same colour the cell-active ring used pre-P6, repurposed as the dnd `data-droppable-over` style).
- **Celebration mint-green (`#CDE9D7`):** defaulted (creator said "green flash on solve" — colour was unspecified).
- **Cream cell + navy wall palette (`#F5F0E8` / `#1F2A37`):** defaulted (creator did not specify visual palette).
- **Digit-tray layout (5+4 strip below board, reusable tiles, tray-as-clear-zone):** defaulted (creator said "drag a digit onto a cell" — layout, reuse semantics, and clear affordance were unspecified). Spec author chose 5+4 (digits 1–5 row 1, digits 6–9 row 2 with empty bottom-right slot) over 3+3+3 to keep the tray shorter and within thumb reach, and chose tray-as-clear-zone over a separate trash tile to keep the tray UI minimal.
- **Check button location (full-width below the digit tray, inside the board wrap, primary style):** defaulted (creator did not specify; the in-board placement keeps the action close to the puzzle and avoids using PART-050 FloatingButton for per-puzzle Submit).
- **Hint banner duration (3 s auto-fade):** defaulted (creator did not specify). Banner DOM is preserved from the original spec; only the trigger changed (from per-cell wrong to Check failure).
- **Star thresholds (`wrongAttempts === 0` → 3⭐, `1–2` → 2⭐, `≥ 3` → 1⭐):** defaulted by spec author after dropping the `hintsUsed` axis (no hint button in v1). The thresholds reflect "perfect Check streak vs one slip vs repeated misses" with a tight 3⭐ bar.
- **Wrong-attempt counter scope (session-wide, not per-puzzle):** defaulted (creator framed stars at session level, so failed Check submissions are session-wide totals).
- **`autoShowStar`:** defaulted to `true` (creator did not specify; PART-050 standard is true).
- **`previewScreen`:** defaulted to `true` (creator did not specify; PART-039 standard is true).
- **Bloom level L4:** spec author inferred from "constraint reasoning", "intersect two sets", "process of elimination" — the concept's "What it tries to teach" section maps directly to L4 Analyze. Creator did not specify a Bloom level.
- **Misconception tag selection priority** (row sum → col sum → repeat → both → multi-constraint-collapse-failure): defaulted (creator did not specify; spec author derived the priority order from the constraint-violation type, with the multi-violated-runs case slotting in as `multi-constraint-collapse-failure`).
- **Hint banner wording (now Check-failure wording):** defaulted to the concept's example phrasing ("This row needs to sum to 11.", "No repeats in a run."), with "(N runs are off)" appended when multiple runs fail.

## Warnings

- **WARNING: `totalLives: 99` is a no-lives workaround.** The data contract expects a `totalLives` field. Setting it to `99` (high cap, never decremented) is a workaround so the field is present but the lives mechanic is effectively disabled. The build step MUST hide the lives indicator. A cleaner alternative is `totalLives: 0` if PART-023 supports a "no-lives display" mode without triggering instant Game Over. **Spec-review must confirm which to use.** (See Decision-Point #1.)
- **WARNING: No Game Over branch.** This game has no `game_over` screen. The flow is `start → gameplay → results` only. The default-flow diagram is preserved for reference but the Game Over path is dead-code. Build step must explicitly omit any `data-phase="game_over"` rendering. Validator should NOT trip "lives = 0 means no game_over screen" because lives are NOT 0 in the spec (`totalLives: 99`); the game simply has no lose-condition. (If the spec is later flipped to `totalLives: 0` per Decision-Point #1, the no-game-over rule is automatically satisfied.)
- **WARNING: Hand-authored puzzles are a content dependency.** If the pre-generation step is skipped or its output is incomplete, the game cannot ship. Step 4 (Build) must read `games/kakuro/pre-generation/puzzles.md` and inline the 9 grids; if the file is missing, fail fast with a clear error.
- **WARNING: Star rule does not match the platform default 90/66/33 % thresholds.** The simplified star rule reads only `wrongAttempts` (count of failed Check submissions): 3⭐ = 0; 2⭐ = 1–2; 1⭐ = ≥ 3. This is creator intent (post-redesign) and the Star Generosity Audit confirms it is tight-but-fair for L4. Build step must implement `getStars()` per these exact rules — not the default thresholds.
- **WARNING: Failed Check is fire-and-forget (no awaited TTS).** This is the multi-step CASE 7 variant (per Feedback skill). It is consistent with the concept's "quiet and deliberate" framing but differs from the default single-step CASE 7 (which awaits TTS). Spec-review must confirm this is intentional. The hint banner (visible 3 s) is the explanation surface; the SFX is acknowledgement only.
- **WARNING: PART-006 (timer) is NOT included.** The concept explicitly forbids a timer. No `getStars()` reads a duration; no preview text mentions speed. PART-006 should NOT be included. The mobile / cross-cutting "TIMER-MANDATORY-WHEN-DURATION-VISIBLE" validator should NOT trip because no time-related triggers exist.
- **WARNING: PART-050 (FloatingButton) is included BUT is not wired to a per-puzzle Submit / Check.** PART-050 is used ONLY for the end-of-game Next CTA (per the standard archetype-6 pattern). Per-puzzle Submit is the in-board Check button (a plain primary `<button>`, not PART-050). Validator should track this carefully: GEN-FLOATING-BUTTON-NEXT-MISSING should NOT trip (we do call `floatingBtn.setMode('next')` at end-of-game), but the per-round submit handler does NOT use FloatingButton.
- **WARNING: Stage 3 first-Check pass-rate may run below 40 %.** The redesign removes per-cell incremental feedback (no green flash on partial run-completion, no red flash on a wrong digit dropped on a cell). This means a Stage 3 student who misjudges a triple-decomposition early will only learn at Check time, often after 5–10 minutes of placement. That said, the Check button still allows iterative re-submission with full state preserved, so failed attempts cost ~5 s + a star but not session restart. **Confirm at testing:** if real-device pass-rates fall below 25 % on Stage 3, consider reverting to per-run validation OR adding a "validate this run" partial-check affordance in v2.
- **WARNING: Stage 3 cell size (~56 px) is the tightest of the three stages.** It clears the 44 px touch-target minimum but only by ~12 px. Confirm at testing (mobile rule #9 / CRITICAL). If real-device testing shows mis-taps on Stage 3, the build step should consider making the entire cell-area (including the 1 px border) part of the hit zone via padding tricks, OR shrinking the outer board padding from 16 px to 12 px to give cells +4 px each.
- **WARNING: Drag accuracy on Stage-3 cells (~56 px) is a P6-specific concern.** With drag-and-drop the "hit" is the cell currently under the *pointer at drop*, not where the gesture started — so a pointer drift of even 8–10 px on Stage 3 can land the tile on a neighbouring cell. The dnd-kit `PointerSensor` activation distance is set to **3 px** (per P6 §8 Universal Touch Support; lowered from 6 px in the original spec) — taps still don't trigger drag because tile interactions only deliberate-press-and-drag flows reach this distance, but the build step should also verify that drop hit-detection uses the centre-of-pointer (default) rather than a tile-bounding-box overlap heuristic, and confirm at testing that real-device touch drift doesn't cause off-by-one drops on Stage 3. If problems are observed, expand the cell drop-target padding so each cell's effective droppable area is slightly larger than its visible cell.
- **WARNING: Step 4 (Build) MUST run in MAIN CONTEXT, not as a sub-agent.** P6 uses `@dnd-kit/dom@beta` from `https://esm.sh/@dnd-kit/dom@beta` and the orchestrator must call `mcp__context7__query-docs` during the build to fetch the live `DragDropManager` / `Draggable` / `Droppable` / `monitor` / sensors API. Sub-agents do NOT inherit MCP server connections — a sub-agent that tries to build this game will silently hand-roll a substitute (native `pointerdown` instead of `@dnd-kit/dom`) and the static validator's `GEN-DND-KIT` rule will catch it after the fact. Avoid the round-trip: the orchestrator must route Step 4 to main context per `CLAUDE.md` § "Step 4 execution mode override".
- **WARNING: The Stage-1 worked example in this spec is intentionally minimal (3 white cells).** The actual Set-A / B / C Stage-1 puzzles authored at game-planning Step 3 will be denser (6–8 white cells). The worked example is the data-shape anchor; it is NOT the final puzzle. Spec-review and Step 3 must be aware that the worked example is illustrative.
- **WARNING: `wrongAttempts` is a session-wide total.** Build step must NOT reset it between puzzles. It resets ONLY on full session restart (Try Again / Play Again). The build step's `resetGameState()` (per-round reset) MUST NOT touch `wrongAttempts`. Lives are similarly NOT decremented in this game; `gameState.lives` is set once at session start (to `totalLives`) and never mutated. (`hintsUsed` is NOT used in v1 — there is no hint button.)
- **WARNING: Multi-step CASE 7 (failed Check, fire-and-forget) is the spec author's interpretation of "Kakuro is multi-step (each digit is one of many sub-actions, the round completes on a successful Check submission)".** This matches the Feedback skill's `Multi-step` definition: "Multiple interactions to complete the round". Spec-review should confirm Kakuro fits this definition (vs being framed as 1 round = 1 puzzle = 1 Single-step submit, which would force awaited TTS on every failed Check and break the "quiet and deliberate" framing).
- **WARNING: Voice-over priority on simultaneous row+column violations is row > column (reading order).** Spec-review must confirm. A common alternative would be "show the rule the student is more likely to have ignored", but determining that requires modelling the student; row > column is predictable and matches the visual reading order.
