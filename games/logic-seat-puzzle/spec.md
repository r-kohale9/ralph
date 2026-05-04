# Game Design: Logic Seating Puzzle — Who Sits Where?

## Identity
- **Game ID:** logic-seat-puzzle
- **Title:** Who Sits Where?
- **Class/Grade:** Class 4–6 (ages ~9–12). Explicitly set by the creator.
- **Math Domain:** Pre-algebra reasoning / Logic / Reading-as-math — translating sentences into spatial constraints, intersecting multiple constraints, hypothesis-and-test.
- **Topic:** Drag-and-drop deduction. Drop named character chips onto numbered seats around a table so that every clue ("Anu sits between Priya and Ravi", "Neha is across from Anu", "Ravi sits to the left of Anu", "X is NOT next to Y", "X is at the head of the table") is simultaneously satisfied.
- **Bloom Level:** L4 Analyze — multi-constraint reasoning. The student holds 2–4 partial restrictions in mind, intersects them, places a hypothesis, and reads which clues fail to refine the next move.
- **Archetype:** #6 Board Puzzle — a single arrangement to solve per round; whole arrangement is checked at once via a CHECK button. Seven puzzles per session across three stages.
- **NCERT Reference:**
  - Class 4 — *Tick Tick Tick* (logical reasoning, working with patterns and grids).
  - Class 5 — *Mapping your way* (grid coordinates, spatial planning); *Does it look the same?* (spatial reasoning).
  - Class 6 — *Knowing our Numbers* (interpretation of conditions on quantities) and the general logic-puzzle enrichment material in the NCERT Exemplar.
  - General logical-reasoning content not anchored to a single chapter — consistent with Class 4–6 math-Olympiad-style puzzles.
- **Pattern:** **P6 Drag-and-Drop** — chip dragged from the pool onto a numbered seat; drop on an occupied seat swaps the previous occupant back into the pool; chip can be dragged out of a seat back into the pool. **REQUIRES `@dnd-kit/dom@beta` via `https://esm.sh/@dnd-kit/dom@beta`.** Per the table in the project root `CLAUDE.md`, **Step 4 (Build) MUST run in `[MAIN CONTEXT]`** so the orchestrator can call `mcp__context7__query-docs` while writing the HTML. A sub-agent without context7 access will silently hand-roll a substitute (native `pointerdown`) which `validate-static.js` rule `GEN-DND-KIT` is meant to catch — but the routing rule prevents the mistake at the source.
- **Input:** Drag-and-drop (chip → seat / seat → pool / chip → occupied seat with swap). Single CHECK button (PART-050 FloatingButton) below the table — the only commit affordance. After CHECK, the FloatingButton reskins to NEXT (no retry — single-attempt scoring). No keyboard. No hint button. No reset (drag chips back to the pool to reset manually).

## One-Line Concept
The student drops named character chips onto numbered seats so that every clue is satisfied simultaneously, then taps CHECK to test the whole arrangement at once — learning to read sentences as spatial constraints, intersect them, and recover from partial-wrong arrangements informed by which clues failed.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Constraint translation | Read a single sentence ("X sits between Y and Z") and translate it into a precise spatial restriction on the seating diagram. | seating-puzzle |
| Constraint combination | Hold 2–4 partial restrictions in working memory, find the clue that pins down the most-constrained seat, and propagate to unlock the rest. | seating-puzzle |
| Hypothesis-and-test | Place a chip on a guess, see which clues' seats glow red after CHECK, and use the failure as information for the next session of the same kind of puzzle. | seating-puzzle |
| Distractor rejection (Stage 3) | Notice that the pool has more characters than seats, identify which character is never named in any clue, and set them aside before solving. | seating-puzzle |
| Negation reasoning (Stage 3) | Process "X is NOT next to Y" and use it to eliminate candidate seats rather than to fix one. | seating-puzzle |

## Core Mechanic

### Type A: "Seating Puzzle" (one round per puzzle; seven puzzles total across three stages)

1. **What the student sees**
   - A small **top-down diagram of a table** rendered as a centred ellipse / rounded rectangle (depending on stage geometry), with **numbered seats** around its perimeter (4, 5, or 6 depending on stage). Each seat is a clear circular slot labelled with a big numeral (`1`, `2`, …) and is a valid drop-zone.
   - A **clue panel** above the table containing 2–5 short numbered clue strings (one per line, each with a small numeral marker like `1.` / `2.` / `3.`).
   - A **chip pool** below the table — a row (or 2-row grid on Stage 3) of character chips. Each chip has a friendly avatar emoji (👧 👦 🧒 etc.) and a short name underneath (Anu, Ravi, Priya, Neha, Meera, Bobby, Tara). Chips are draggable. The pool is itself a valid drop-zone (drag a chip back from a seat to "unseat" them).
   - A **CHECK button** (PART-050 FloatingButton, PART-022 styling) below the chip pool, dimmed (`opacity: 0.6; pointer-events: none`) until **every required SEAT is filled** (NOT every chip — chips can be left in the pool, see Stage 3 distractor mechanic).
   - A **puzzle progress chip** ("Puzzle N of 7") in the header.
   - **No timer** in the gameplay header (creator brief: "this is a thinking game, and a clock would push students toward guessing"). PART-006 NOT included.
   - **No lives** indicator. The header is uncluttered — just `Puzzle N of 7` and the platform mute toggle.
   - **No hint button.** No retry button. The puzzle is the puzzle.

2. **What the student does** (input: drag-and-drop, P6 via `@dnd-kit/dom@beta`)
   - **Drag a chip from the pool onto an empty seat** → chip "snaps" into the seat (small scale-in animation). The chip's pool-slot becomes empty.
   - **Drag a chip from the pool onto an occupied seat** → the previous occupant swaps back to its original pool-slot (or any free pool-slot if its original is taken); the new chip lands in the seat.
   - **Drag a chip out of a seat back into the pool** → seat becomes empty; chip returns to a free pool-slot.
   - **Drag a chip from a seat onto another seat** → if the destination is empty, just moves; if occupied, swaps the two chips' seats.
   - **CHECK button** (PART-050 FloatingButton): tappable only when all required seats are filled. Tapping commits the arrangement for evaluation.

3. **What counts as correct**
   - All clues for the round are evaluated **at once** when CHECK is tapped. The arrangement is correct iff **every clue** is satisfied. There is no per-clue partial credit on a CHECK — the puzzle is binary (solved / not solved).
   - **Each puzzle has a unique pre-validated solution** — pre-generated and verified by exhaustive search of all character-to-seat permutations. The clues are authored to be solvable AND uniquely-solvable.
   - In Stage 3 puzzles (with one distractor character), the distractor is the character whose name does NOT appear in any clue. The unique solution is the unique permutation of the **remaining** characters into seats that satisfies every clue.

4. **What feedback plays**
   - **Drag start (pickup)**: soft tap SFX (fire-and-forget, ~50 ms), no sticker, no TTS, never blocks input. CASE 9.
   - **Drag drop (legal placement, no swap)**: soft snap SFX (fire-and-forget, ~80 ms), no sticker, no TTS. Chip's scale-in animation (~150 ms).
   - **Drag drop (legal placement with swap-back)**: same soft snap SFX as above (the swap is silent UI — the previous chip animates back to its pool slot).
   - **Drag drop (cancelled — released over no valid drop-zone)**: chip animates back to its origin (~200 ms, ease-out). No SFX.
   - **CHECK tap, all clues satisfied** → `gameState.isProcessing = true` BEFORE await. Per-seat green flash propagates around the table (~600 ms total, staggered ~80 ms per seat). Awaited round-complete SFX (`correct_sound_effect`, 1500 ms floor) with celebration sticker → awaited dynamic TTS ("Yes! That's the right seating."). `progressBar.update(currentRound, lives)` (lives = 0; bar shows N/7) bumps **FIRST**, then audio, then auto-advance to the next round's transition (or to Victory after Round 7). CASE 6.
   - **CHECK tap, ≥ 1 clue violated** → `gameState.isProcessing = true` BEFORE await. **Every seat that participates in any violated clue glows red** for ~1500 ms (3 cycles of 500 ms ease-in-out at `#E63946`). Awaited wrong-answer SFX (`incorrect_sound_effect`, 1500 ms floor) with sad sticker → awaited dynamic TTS ("Oh no — that's not quite right!"). After audio, the CHECK FloatingButton **reskins to NEXT** (`floatingBtn.setMode('next')` with copy `Next puzzle →`). The student cannot retry the same round — tapping NEXT auto-advances to the next round's transition (or to Victory after Round 7). The arrangement is left visible (chips stay where the student placed them) until NEXT is tapped, so the student can see which seats glow red against their guess. CASE 7-style single-step wrong, but the round terminates rather than re-prompting.
   - **No mid-round dynamic TTS** during dragging. Drag/drop is pure ambient SFX. Only the CHECK commit triggers explanatory feedback.
   - **No lives** lost — the wrong CHECK does not decrement anything. The wrong is **informational**, not punishing. The student walks away from a wrong CHECK knowing exactly which clues their arrangement violated.

## Rounds & Progression

Seven puzzles per session across three stages. Each stage adds a structural difficulty knob (more seats, the "head of the table" anchor, a distractor character, a negation clue). All seven puzzles share the same core mechanic; only seat count, character count, clue count, clue grammar, and pool size change.

### Stage 1: Translate (Rounds 1–2) — 4 seats, 4 chars, 2–3 simple clues
- Round type: `seating-puzzle`.
- **Table shape:** rounded square, 4 seats — `1` (top), `2` (right), `3` (bottom), `4` (left). "Across from" pairs: `1↔3`, `2↔4`. "Next to" pairs: `1-2`, `2-3`, `3-4`, `4-1` (each seat is next to two neighbours).
- **Pool:** 4 chips, 4 seats — every chip is seated in the solution.
- **Clue count:** 2–3 clues per puzzle.
- **Clue grammar used:**
  - "X sits in seat N." (REQUIRED — at least one seat-pin per Stage-1 puzzle, to break rotational symmetry; see "Stage-1 absolute anchor" under Clue Grammar Reference.)
  - "X sits next to Y."
  - "X is across from Y."
  - "X sits to the left of Y." (See "Left/right anchoring" below.)
- **Difficulty knob:** "first-exposure" geometry — small board, no negations, no distractor, no "between" clue. The seat-pin clue serves double duty as an explicit "place this chip on this seat" step that introduces dragging mechanics before relational reasoning takes over. Most students should solve both rounds on first CHECK.
- **Expected solve time:** 30–90 seconds per puzzle.
- **Target first-CHECK rate:** ~85% (Stage 1 is the on-ramp).

### Stage 2: Combine (Rounds 3–5) — 5 seats, 5 chars, 3–4 clues, includes "between" and "head of the table"
- Round type: `seating-puzzle`.
- **Table shape:** elongated rectangle / oval with a clearly-marked **head** at the top (seat `1` is the head, larger and slightly offset). Seats `2`/`3` on the right side, `4`/`5` on the left side, mirrored. "Across from" pairs: `2↔4`, `3↔5`. The head (`1`) has no "across from" partner (it's the head — explicitly anchored). "Next to" pairs: `1-2`, `1-4`, `2-3`, `4-5`, plus `3` and `5` are at the foot but **not next to each other** (no foot seat in this layout — the foot side is open).
- **Pool:** 5 chips, 5 seats — every chip is seated.
- **Clue count:** 3–4 clues per puzzle.
- **Clue grammar used (additive over Stage 1):**
  - All Stage-1 grammar PLUS:
  - "X sits between Y and Z." (X is in a seat with Y on one side and Z on the other; either order. Cannot apply to the head — the head only has ONE neighbour-in-line on each side via seats 2 and 4 sequentially, which counts as "between" if Y/Z map to seats 2 and 4.)
  - "X is at the head of the table." (Pins X to seat 1.)
- **Difficulty knob:** "mid-stretch" — 5 seats means one more degree of freedom; "between" is a 3-name constraint that requires the student to find the seat with two qualifying neighbours; the "head" anchor is usually the load-bearing clue that pins one chip and unlocks the rest.
- **Expected solve time:** 1–3 minutes per puzzle.
- **Target first-CHECK rate:** ~65%.

### Stage 3: Reject (Rounds 6–7) — 6 seats, 7 chars (1 distractor), 4–5 clues including a negation
- Round type: `seating-puzzle`.
- **Table shape:** rectangular / elongated oval, 6 seats around the perimeter — seats `1` and `4` are at the head and foot respectively (seat `1` larger, seat `4` smaller-but-equivalent — Stage 3 has both a head AND a foot, distinct from Stage 2). Seats `2`/`3` on the right side, `5`/`6` on the left side, mirrored. "Across from" pairs: `1↔4`, `2↔6`, `3↔5`. "Next to" pairs: `1-2`, `1-6`, `2-3`, `3-4`, `4-5`, `5-6` (the head and foot each have two neighbours; the side seats each have two neighbours).
- **Pool:** **7 chips, 6 seats — one chip is a distractor** never named in any clue. The student must identify the distractor (whose name appears in none of the clues), leave them in the pool, and seat the remaining 6.
- **Clue count:** 4–5 clues per puzzle.
- **Clue grammar used (additive over Stage 2):**
  - All Stage-1 and Stage-2 grammar PLUS:
  - "X is NOT next to Y." (Negation — eliminates candidate seats rather than fixing one. Used in **at least one of the two Stage-3 puzzles** per set.)
- **Difficulty knob:** "mastery" — the distractor recognition is a meta-step before solving; the negation clue requires elimination reasoning rather than direct placement; with 6 seats the search space is meaningfully larger (`6! = 720` arrangements ignoring distractor; `7P6 = 5040` if the student tries all chips). The CHECK button enables only when **all 6 seats are filled** (NOT when all 7 chips are placed — chips can be left in the pool).
- **Expected solve time:** 2–5 minutes per puzzle.
- **Target first-CHECK rate:** ~45% (Stage 3 is the mastery gate).

### Stage summary

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Rounds | 2 (R1–R2) | 3 (R3–R5) | 2 (R6–R7) |
| Seats | 4 | 5 (with head) | 6 (with head + foot) |
| Chips in pool | 4 | 5 | 7 (1 distractor) |
| Clue count | 2–3 | 3–4 | 4–5 |
| Clue types | seat-pin (req), next-to, across-from, left-of | + between, head-of-table | + NOT-next-to (negation) |
| Distractor mechanic | No | No | Yes — 1 unmentioned chip |
| Expected solve time | 30–90 s | 1–3 min | 2–5 min |
| Target first-CHECK rate | ~85% | ~65% | ~45% |
| Cognitive demand | Translate one clue at a time | Combine 3–4 clues, anchor first | Reject distractor, eliminate via negation |

**Round-set cycling (MANDATORY — validator GEN-ROUNDSETS-MIN-3):** The runtime round-set-cycles `fallbackContent.rounds`. A student plays Set A on first attempt, Set B after Play-Again, Set C on the next replay, then back to A. The spec authors **three full sets (A, B, C) × 7 rounds each = 21 round objects total**. Each set has different character names AND different clues AND different unique solutions per puzzle, but **parallel difficulty** (Set A's Round 3 ≈ Set B's Round 3 ≈ Set C's Round 3 in seat count, clue count, and deduction depth). Each round object carries `set: 'A' | 'B' | 'C'`. `setIndex` rotates on restart and persists across restarts within the session.

## Game Parameters
- **Rounds:** 7 per session.
- **totalRounds:** 7.
- **Timer:** None (`timer: false`). Creator brief: "this is a thinking game, and a clock would push students toward guessing." PART-006 NOT included. No `responseTimes` collected for star scoring (single-attempt accuracy only).
- **Lives:** 0 (`totalLives: 0`). Creator brief: "There are no lives. Students play through all 7 rounds regardless of how many they get wrong." No game-over screen — the only terminal screen is Victory. **Wrong CHECK does not lose a life and does not end the session.** The session always reaches Round 7 unless the player walks away.
- **retryPreservesInput:** N/A (multi-round game; flag ignored). No retry on the same round — wrong CHECK terminates the round and reskins CHECK → NEXT.
- **autoShowStar:** `true` (default; star animation fires at canonical PART-050 spot via Stars Collected `onMounted`).
- **Star rating (creator-specified, single-attempt accuracy by FIRST-CHECK count, NOT default 90/66/33):**
  - **3⭐** = all 7 rounds solved on first CHECK (perfect run).
  - **2⭐** = 5 or 6 of 7 rounds solved on first CHECK.
  - **1⭐** = fewer than 5 rounds solved on first CHECK, but the student finished all 7 rounds (i.e. tapped CHECK or NEXT on every round).
  - **0⭐** = walked away before Round 7 (session ended without reaching the Victory screen).
- **Input:** Drag-and-drop (P6) on chips and seats; single tap on the CHECK / NEXT FloatingButton. No keyboard, no number input, no voice input.
- **Feedback:** PART-017 FeedbackManager. Per-CHECK whole-arrangement validation. Per-puzzle solve celebration. No game-over screen (no lives).
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships). The 7-slide carousel at end-of-game shows each round's solved seating arrangement — the correct chip in each seat, with the clues listed beneath. Stage-3 slides also show the distractor chip pinned to the pool with a small "(not used)" caption. (See "AnswerComponent payload shape" below.)
- **PARTs Used:** PART-001/004/005/007/008/009/010/042 (core), PART-017 (FeedbackManager — sound + TTS), PART-019 (results), PART-021 (mobile layout), PART-023 (ProgressBar with 7 segments, no hearts), PART-024 (TransitionScreen — Welcome, per-round intros, Victory, Stars Collected), PART-025 (ScreenLayout), PART-027 (Play Area), PART-033 (drag interaction; combined with `@dnd-kit/dom@beta` per the project P6 contract), PART-039 (PreviewScreen), PART-050 (FloatingButton — CHECK in-round, NEXT after CHECK, end-of-game Next), PART-051 (AnswerComponent — answer carousel after Victory).

## Scoring
- **Points:** +1 per round solved on first CHECK. Max 7 points per session. `gameState.score = number of rounds where the FIRST CHECK was correct`. (A round where the student CHECKs and gets a wrong arrangement contributes 0 points — there is no second CHECK on the same round.)
- **Stars:** computed from FIRST-CHECK count and completion state per the rubric above. Implementation:
  ```js
  function getStars() {
    var firstCheckCorrect = gameState.attempts.filter(function (a) {
      return a.isCorrect && a.attemptNumber === 1; // attemptNumber is 1 for the only CHECK on each round
    }).length;
    if (gameState.currentRound < gameState.totalRounds) return 0; // walked away before Round 7
    if (firstCheckCorrect === 7) return 3;
    if (firstCheckCorrect >= 5) return 2;
    return 1; // completed all 7 with < 5 first-CHECK correct
  }
  ```
  (Note: every round records exactly one attempt — the single CHECK or the implicit "wrong + NEXT" path. `attemptNumber` is always 1.)
- **Lives:** None. Wrong CHECK does not decrement anything. Game cannot end on lives = 0 (no game-over path).
- **Partial credit:** None. Each round is binary (correct on first CHECK / not). The "completed all 7" component of 1⭐ is the floor reward for finishing the session even with low accuracy; walking away before Round 7 demotes to 0⭐.

### Star Generosity Audit

(Per spec-creation skill expectation that L4 mastery games not give 3⭐ for free.)

| Outcome scenario | Rounds completed | First-CHECK correct | Stars (per spec) | Generosity verdict |
|------------------|------------------|---------------------|------------------|--------------------|
| Solved all 7 on first CHECK | 7 | 7 | **3⭐** | TIGHT — perfect-run only. Correct for L4 mastery. |
| Solved 6 on first CHECK | 7 | 6 | **2⭐** | TIGHT — one mistake demotes from 3⭐. |
| Solved 5 on first CHECK | 7 | 5 | **2⭐** | TIGHT — same as above. |
| Solved 4 on first CHECK | 7 | 4 | **1⭐** | NEUTRAL — completed but low accuracy. |
| Solved 0 on first CHECK | 7 | 0 | **1⭐** | NEUTRAL — completion floor. The student saw all 7 puzzles, didn't bail. |
| Walked away on Round 4 | 3 | any | **0⭐** | TIGHT — quitting is the only path to 0⭐. |

**Verdict:** The star rule is appropriately tight for L4. 3⭐ requires a flawless 7-of-7. The 1⭐ floor for completing all 7 even with 0 first-CHECK correct is a deliberate generosity to reward persistence — it is not a difficulty failure, it is the "you stuck with it" star. **No generosity inflation detected.**

## Clue Grammar Reference

These exact phrasings are the literal strings the game will render in the clue panel and feed into TTS where applicable. Use them verbatim. (Capitalization, punctuation, and spacing are part of the contract.)

| # | Grammar | Example | Used in stages |
|---|---------|---------|----------------|
| 1 | `X sits next to Y.` | `Anu sits next to Ravi.` | 1, 2, 3 |
| 2 | `X is across from Y.` | `Neha is across from Anu.` | 1, 2, 3 |
| 3 | `X sits to the left of Y.` | `Ravi sits to the left of Anu.` | 1, 2, 3 |
| 4 | `X sits between Y and Z.` | `Anu sits between Priya and Ravi.` | 2, 3 |
| 5 | `X is at the head of the table.` | `Meera is at the head of the table.` | 2, 3 |
| 6 | `X is NOT next to Y.` | `Bobby is NOT next to Tara.` | 3 (≥ 1 of the two Stage-3 rounds per set) |
| 7 | `X sits in seat N.` | `Anu sits in seat 1.` | 1 (REQUIRED — see "Stage-1 absolute anchor" below); permitted in 2/3 if helpful |

### Stage-1 absolute anchor (CRITICAL — uniqueness depends on it)

The Stage-1 4-cycle table topology has **full rotational symmetry**: every relational clue (`next to`, `across from`, `left of`) is rotation-invariant on a 4-cycle, so any Stage-1 puzzle authored with **only** relational clues will admit at least 4 valid solutions (the original plus 3 rotations) and CANNOT satisfy the spec's "unique pre-validated solution" guarantee. (Stage 2 and Stage 3 break rotational symmetry via the `head of the table` clue and head/foot seats.)

**Therefore Stage-1 puzzles MUST contain at least one absolute-position clue using grammar #7 (`X sits in seat N.`)** to pin one chip to a specific seat number, breaking the symmetry. Pre-Generation Step 3 MUST enforce this: each of the 6 Stage-1 puzzles (Sets A/B/C × Rounds 1–2) authors at least one `seat N` clue.

The seat numerals (`1`, `2`, `3`, `4`) are already rendered visibly on each seat (per Visual / Theme: "a clear circular slot labelled with a big numeral"), so the `seat N` clue is well-defined for the student. The PreviewScreen's existing wording ("Read the clues, then drag each friend onto a seat") already presumes the student can identify a numbered seat.

### Semantics — what each clue means

These are the load-bearing definitions the game depends on. The build step MUST implement evaluators that match these exactly.

- **`X sits next to Y.`** — symmetric. Seats X and Y are immediate neighbours on the seat-adjacency graph for the current table shape (see per-stage adjacency lists above). Order does not matter; `X next to Y` ≡ `Y next to X`.
- **`X is across from Y.`** — symmetric. Seats X and Y are on the "across from" pair list for the current table shape (Stage 1: `1↔3`, `2↔4`. Stage 2: `2↔4`, `3↔5` — head has no across-from partner. Stage 3: `1↔4`, `2↔6`, `3↔5`).
- **`X sits to the left of Y.`** — **directional**. Y must be in a seat, and X must be in the seat that is **immediately to Y's left from the viewer's POV** (i.e. as the student looking at the diagram on the screen sees it). Concretely: for each seat `s` on the table, define `leftNeighbour(s)` as the seat that appears to the viewer's left of `s` going around the table's perimeter; then `X to the left of Y` is satisfied iff seat(X) === `leftNeighbour(seat(Y))`. **Anchoring is from the viewer's POV (NOT the seated character's POV)** — see "Left/right anchoring" below for the full explanation and the per-stage `leftNeighbour` map.
- **`X sits between Y and Z.`** — symmetric in Y/Z. Seat(X) must be adjacent to both seat(Y) and seat(Z), AND seat(Y) and seat(Z) must NOT be adjacent to each other (i.e. X is genuinely the middle of a 3-in-a-row segment, not just a corner where Y and Z happen to also be neighbours). Equivalent: in the seat-adjacency graph, `seat(Y)–seat(X)–seat(Z)` is a path of length 2 with no shortcut edge `seat(Y)–seat(Z)`.
- **`X is at the head of the table.`** — pins X to the head seat (Stage 2: seat 1; Stage 3: seat 1). Stage 1 has no head — this clue is never used in Stage 1.
- **`X is NOT next to Y.`** — symmetric. Seats X and Y are NOT immediate neighbours on the seat-adjacency graph. Distinct from "X is across from Y" — across-from seats are not next to each other and so trivially satisfy "NOT next to", which is fine: a NOT-next-to clue is a weak constraint that mostly eliminates rather than pins.
- **`X sits in seat N.`** — absolute position pin. `seat(X) === N`. N is one of the seat numerals rendered on the table for the current stage (Stage 1: 1–4; Stage 2: 1–5; Stage 3: 1–6). Strongest possible clue; one is required per Stage-1 puzzle to break rotational symmetry.

### Left/right anchoring (CRITICAL — game depends on it)

**"Left" and "right" are anchored from the VIEWER's point of view** — i.e. as the student looking at the diagram on their screen sees it. NOT from the perspective of the character sitting in the chair. This is the more intuitive convention for kids reading a top-down diagram (the character at seat 1 at the top would have their own left/right reversed if anchored to their POV, which is confusing).

**Per-stage `leftNeighbour(s)` maps** (going **clockwise** around the table from the viewer's POV — i.e. the seat to the viewer's left of `s` is the seat **counter-clockwise** of `s`, which when traversing clockwise comes BEFORE `s`):

- **Stage 1 (4 seats: 1=top, 2=right, 3=bottom, 4=left):**
  - `leftNeighbour(1) = 2` (viewer sees seat 2 to the left of seat 1 at the top — going counter-clockwise from 1 → 2)
  - `leftNeighbour(2) = 3`
  - `leftNeighbour(3) = 4`
  - `leftNeighbour(4) = 1`
  - In other words: `leftNeighbour(s) = (s mod 4) + 1` for s in 1..4.
- **Stage 2 (5 seats: 1=head/top, 2/3 right side, 4/5 left side — clockwise traversal from head: 1 → 2 → 3 → 5 → 4 → 1):**
  - `leftNeighbour(1) = 2`
  - `leftNeighbour(2) = 3`
  - `leftNeighbour(3) = 5`
  - `leftNeighbour(5) = 4`
  - `leftNeighbour(4) = 1`
- **Stage 3 (6 seats: 1=head/top, 2/3 right side, 4=foot/bottom, 5/6 left side — clockwise traversal from head: 1 → 2 → 3 → 4 → 5 → 6 → 1):**
  - `leftNeighbour(1) = 2`
  - `leftNeighbour(2) = 3`
  - `leftNeighbour(3) = 4`
  - `leftNeighbour(4) = 5`
  - `leftNeighbour(5) = 6`
  - `leftNeighbour(6) = 1`

**Clarification for the student:** the PreviewScreen explicitly says "Left and right are from YOUR view, looking at the picture" so children don't have to guess. (See PreviewScreen instruction text below.)

## Flow

**Shape:** Multi-round (default).

**Changes from default:**
- No game-over branch (no lives). The only terminal path is Victory.
- After a wrong CHECK, the FloatingButton reskins from CHECK → NEXT in-round (no retry on the same round). Per-round structure is "load → drag → CHECK → (correct OR wrong) → next round transition or Victory".
- The star rule (single-attempt accuracy) replaces the default 90/66/33 thresholds.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Preview Screen (PART-039)                                              │
│   ─ instruction text + audio                                             │
│   ─ "Start" CTA                                                          │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   Welcome / Round 1 transition (PART-024)                                │
│   ─ "Puzzle 1 of 7" + audio                                              │
│   ─ tap to begin                                                         │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   Gameplay: Puzzle N (drag chips, CHECK button dimmed until all          │
│              required seats filled)                                      │
│   ─ on drag: ambient SFX                                                 │
│   ─ on CHECK tap (correct):                                              │
│        per-seat green flash → SFX + TTS awaited → progressBar bumps      │
│        → auto-advance to next round transition or Victory                │
│   ─ on CHECK tap (wrong):                                                │
│        red glow on seats in violated clues → SFX + TTS awaited →         │
│        FloatingBtn reskins to NEXT (no retry) → student taps NEXT →      │
│        progressBar bumps → next round transition or Victory              │
│                                                                          │
│              │ (after Round 7, regardless of correctness)                │
│              ▼                                                           │
│   Victory (TransitionScreen)                                             │
│   ─ stars rendered (3 / 2 / 1)                                           │
│   ─ game_complete posted BEFORE end-game audio                           │
│   ─ "Claim Stars" CTA (always)                                           │
│   ─ "Play Again" CTA (only if 1–2 stars)                                 │
│                                                                          │
│              │ Claim Stars                                               │
│              ▼                                                           │
│   Stars Collected (TransitionScreen, auto-advance)                       │
│   ─ sound_stars_collected awaited → show_star postMessage →              │
│     setTimeout reveals AnswerComponent                                   │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   AnswerComponent carousel (PART-051)                                    │
│   ─ 7 slides, one per round                                              │
│   ─ each slide: solved seating diagram + clue list                       │
│   ─ Stage-3 slides also show the distractor chip in the pool with        │
│     "(not used)" caption                                                 │
│   ─ FloatingBtn 'next' revealed                                          │
│                                                                          │
│              │ Next                                                      │
│              ▼                                                           │
│   next_ended postMessage → exit                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Feedback

| Event | Behavior |
|-------|----------|
| Preview | PART-039 screen on game start. Instruction text + audio (see PreviewScreen wording below). |
| Welcome | TransitionScreen with "Welcome to Who Sits Where?" + welcome VO, tap to continue. |
| Round N intro | TransitionScreen "Puzzle N of 7", auto-advance after round-intro SFX + VO (sequential, awaited). |
| Drag start (chip pickup) | Soft tap SFX (fire-and-forget, ~50 ms). No sticker, no TTS, never blocks input. CASE 9. |
| Drag drop (chip → empty seat) | Soft snap SFX (fire-and-forget, ~80 ms). Chip scale-in animation (~150 ms). No TTS. |
| Drag drop (chip → occupied seat, swap) | Same soft snap SFX. Previous occupant animates back to its pool slot. No TTS. |
| Drag drop (chip → pool, unseat) | Same soft snap SFX. Seat becomes empty. Chip animates into its pool slot. No TTS. |
| Drag cancelled (released over no drop-zone) | Chip animates back to origin (~200 ms ease-out). No SFX. |
| All required seats filled | CHECK FloatingButton transitions from dimmed to enabled (PART-022 enabled style; no SFX, no animation flourish — pure visual state change). |
| CHECK tap (correct arrangement) | `gameState.isProcessing = true` BEFORE await. Per-seat green flash propagates around the table (~600 ms total, staggered). `progressBar.update(currentRound, 0)` bumps **FIRST**. `await sound.play('correct_sound_effect', { sticker, minDuration: 1500 })`. `await playDynamicFeedback({ feedback_type: 'correct', audio_content: 'Yes! That\'s the right seating.', subtitle: 'Yes! That\'s the right seating.' })`. Auto-advance to next round transition or Victory. CASE 6. |
| CHECK tap (wrong arrangement) | `gameState.isProcessing = true` BEFORE await. Every seat that participates in any violated clue glows red (~1500 ms, 3 cycles 500 ms ease-in-out at `#E63946`). `await sound.play('incorrect_sound_effect', { sticker, minDuration: 1500 })`. `await playDynamicFeedback({ feedback_type: 'incorrect', audio_content: 'Oh no — that\'s not quite right!', subtitle: 'Oh no — that\'s not quite right!' })`. After audio resolves: FloatingButton reskins to NEXT (`floatingBtn.setMode('next')` with copy `Next puzzle →`). Chips stay where the student placed them. `isProcessing` cleared on next tick. Student taps NEXT to advance — no second CHECK. CASE 7-style single-step wrong, but round terminates. |
| NEXT tap (after wrong CHECK) | Soft confirm SFX (fire-and-forget). `progressBar.update(currentRound, 0)` bumps. Auto-advance to next round transition (or Victory after Round 7). |
| Complete all 7 rounds (Victory) | Victory TransitionScreen with stars (computed per rubric above). `game_complete` postMessage sent BEFORE end-game audio. Buttons: `Play Again` (only if 1–2 stars), `Claim Stars` (always). CASE 11. |
| (No Game Over event) | Lives = 0 — there is no `game_over` screen. Walking away before Round 7 simply leaves the session uncompleted; on next launch the harness surfaces 0⭐ for that incomplete attempt. |
| Stars Collected | Auto-mounted celebration screen after Claim Stars. `await sound.play('victory_sound_effect')` → `postMessage({type:'show_star'})` → setTimeout(showAnswerCarousel, 1500). Per `default-transition-screens.md` § 4. |
| Correct Answers carousel | PART-051 AnswerComponent, 7 slides (one per round). Each slide: solved seating diagram with the correct chip in each seat, the round's clue list listed beneath. Stage-3 slides also pin the distractor chip to a "Not used" pool slot. FloatingButton 'next' revealed; tap → `next_ended` postMessage → exit. |
| Try Again / Play Again (from Victory) | All audio stopped, all state resets, currentRound → 1, `setIndex` rotates A → B → C → A. Returns to Round 1 transition. CASE 13. |
| Tab switch / screen lock | Static & stream audio paused. VisibilityTracker's PopupComponent renders the pause overlay (`autoShowPopup` default; do NOT build a custom overlay). CASE 14. |
| Tab restored | Audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues. CASE 15. |
| Audio failure (any audio call rejects) | Try/catch swallows; visual feedback (green/red flash, sticker) still renders. Game continues. CASE 16. |

**Voice-over / SFX moments — minimised per concept:**
- Round transitions (PART-024 default SFX + VO).
- CHECK correct (SFX + TTS, "Yes! That's the right seating.").
- CHECK wrong (SFX + TTS, "Oh no — that's not quite right!").
- Drag pickup / drop (soft ambient SFX only, no TTS).
- Victory and Stars Collected (PART-024 / PART-051 default SFX).
- **No background music.** Audio is silent during gameplay drag interaction.
- **No per-clue voice-over** when the student first sees a puzzle. Clues are READ — the game is a reading-as-math exercise; reading them aloud would defeat the comprehension goal.

## PreviewScreen (PART-039) Instruction Text

**`previewInstruction` (HTML, kid-readable, pre-Class-6 vocabulary, 1–2 short sentences plus a small list):**

```html
<p><b>Read the clues.</b> Drag each friend onto a seat so all the clues are true at the same time. Then tap <b>CHECK</b>.</p>
<p style="font-size:0.9em;color:#666;">Tip: <b>Left</b> and <b>right</b> are from <b>your</b> view, looking at the picture.</p>
```

**`previewAudioText` (plain-text narration for TTS, ~12 seconds at normal pace):**

```
Read the clues, then drag each friend onto a seat so that every clue is true at the same time. When all the seats are full, tap CHECK. Left and right are from your view, looking at the picture.
```

**`showGameOnPreview`:** `false` (the puzzle should not be visible behind the preview overlay; the student should see the instruction first).

## AnswerComponent Payload Shape

Each round's `answer` is rendered by `renderAnswerForRound(round, container)` as a non-interactive solved seating diagram:
- The table for that round's stage geometry is drawn (4-seat / 5-seat / 6-seat layout).
- Each seat shows the correct chip's avatar + name, fixed in place (no drag).
- Beneath the table, the round's clue list is repeated verbatim (so the student can re-read each clue against the solved arrangement).
- For Stage 3 rounds, the distractor chip is rendered separately in a small "Not used" pool slot below the clues, with a faint `(not used)` caption.

**Per-round `answer` payload schema:**

```js
answer: {
  // Map seat number → chip ID. e.g. { 1: 'anu', 2: 'ravi', 3: 'priya', 4: 'neha' }.
  seating: { '1': 'anu', '2': 'ravi', '3': 'priya', '4': 'neha' },
  // Optional, Stage 3 only: the chip ID that is NOT seated (the distractor).
  distractor: null  // or e.g. 'bobby' for Stage 3 rounds
}
```

**AnswerComponent slide count:** 7 slides (one per round), regardless of stage. Slide titles: "Puzzle 1", "Puzzle 2", … "Puzzle 7". Optional small slide subtitle (one-liner per stage, focusing on the load-bearing reasoning move):
- Stage 1 slides (Puzzles 1–2): subtitle "Reading one clue at a time."
- Stage 2 slides (Puzzles 3–5): subtitle "Two clues together pin one seat."
- Stage 3 slides (Puzzles 6–7): subtitle "Find the friend with no clue, set them aside, then solve."

(Per Decision-Points #3 below — confirm slide subtitle wording with the orchestrator before Step 4.)

## Content Structure (fallbackContent)

**Top-level fields:**
- `previewInstruction` — HTML, full instruction shown on PART-039 preview overlay (see above).
- `previewAudioText` — plain-text narration for preview TTS (patched at deploy time).
- `previewAudio` — `null` (filled at deploy time by TTS pipeline).
- `showGameOnPreview` — `false`.
- `totalRounds` — `7`.
- `totalLives` — `0` (no lives).
- `answerComponent` — `true` (default; not opted out).
- `rounds[]` — **21 round objects** (3 sets × 7 rounds), with `set: 'A' | 'B' | 'C'` on every entry.

### Per-round payload shape

Each round object carries the data needed to render one puzzle, validate placements, and render the answer slide:

```js
{
  set: 'A' | 'B' | 'C',
  id: 'A_r1' | 'A_r2' | ... | 'C_r7',  // globally unique
  round: 1 | 2 | 3 | 4 | 5 | 6 | 7,    // round index within a set
  stage: 1 | 2 | 3,                     // 1 (R1-R2) | 2 (R3-R5) | 3 (R6-R7)
  type: 'seating-puzzle',

  // Table geometry (driven by stage, but inlined for build-step simplicity).
  // seats: array of seat numbers in the order they should be rendered around the table.
  seats: [1, 2, 3, 4],   // length 4 for stage 1, 5 for stage 2, 6 for stage 3
  // adjacency: map seat → array of adjacent seat numbers (for "next to" / "between" / "NOT next to" eval).
  adjacency: {
    '1': [2, 4],
    '2': [1, 3],
    '3': [2, 4],
    '4': [1, 3]
  },
  // acrossFrom: map seat → seat (or null if no across pair, e.g. head in stage 2).
  acrossFrom: { '1': 3, '2': 4, '3': 1, '4': 2 },
  // leftNeighbour: map seat → seat (the seat immediately to the viewer's left of this seat).
  leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 1 },
  // headSeat: the seat number of the head, or null if no head (stage 1).
  headSeat: null,         // 1 for stages 2 and 3

  // Characters and chips.
  // chips: ordered list of chip objects available in the pool for this round.
  // For stage 3, length === seats.length + 1 (one distractor); for stages 1-2, length === seats.length.
  chips: [
    { id: 'anu',   name: 'Anu',   avatar: '👧' },
    { id: 'ravi',  name: 'Ravi',  avatar: '👦' },
    { id: 'priya', name: 'Priya', avatar: '🧒' },
    { id: 'neha',  name: 'Neha',  avatar: '👧' }
  ],

  // Clues (the literal strings rendered to the student AND the structured form for evaluation).
  // Each clue is { text, kind, args }. text is the verbatim string per Clue Grammar Reference.
  // kind is one of: 'next-to', 'across-from', 'left-of', 'between', 'head-of-table',
  //                  'not-next-to', 'seat-pin'.
  // args is the chip IDs (and/or seat numbers, for 'seat-pin') referenced by the clue,
  // in the order they appear in the text. For 'seat-pin', args = [chipId, seatNumber].
  clues: [
    { text: 'Anu sits next to Ravi.',     kind: 'next-to',      args: ['anu', 'ravi'] },
    { text: 'Neha is across from Anu.',   kind: 'across-from',  args: ['neha', 'anu'] }
  ],

  // Pre-validated unique solution. Map seat number → chip ID.
  // Build-time validator (exhaustive permutation search) asserts this is the UNIQUE assignment
  // satisfying all clues.
  solution: { '1': 'anu', '2': 'ravi', '3': 'priya', '4': 'neha' },

  // Same data as `solution` plus distractor info, for AnswerComponent convenience.
  // Build-time validator asserts answer.seating === solution.
  answer: {
    seating: { '1': 'anu', '2': 'ravi', '3': 'priya', '4': 'neha' },
    distractor: null  // chip ID of the unused chip, ONLY for stage 3 rounds; null otherwise
  },

  // Misconception tags — one per clue kind that could be violated. Used by recordAttempt to record
  // which clue type the student violated on a wrong CHECK.
  misconception_tags: {
    'next-to':       'next-to-constraint-overlooked',
    'across-from':   'across-from-constraint-overlooked',
    'left-of':       'left-right-orientation-confused',
    'between':       'between-constraint-misread',
    'head-of-table': 'head-anchor-overlooked',
    'not-next-to':   'negation-clue-misread',
    'seat-pin':      'absolute-seat-pin-overlooked'
  }
}
```

**Misconception tags (named, real misconceptions for constraint-translation reasoning at L4):**
- `next-to-constraint-overlooked` — student placed two chips that should be adjacent in non-adjacent seats; failed to track adjacency.
- `across-from-constraint-overlooked` — student placed two chips that should be across in non-across seats; misread the "across" geometry of the table.
- `left-right-orientation-confused` — student swapped the directional left-of clue (often anchored from the seated character's POV instead of the viewer's POV); the most common Stage-1 misconception.
- `between-constraint-misread` — student placed X next to either Y or Z but not both, OR placed X next to both but Y and Z are themselves adjacent (so X is at a corner, not a true between); the Stage-2 stumbling block.
- `head-anchor-overlooked` — student didn't pin X to the head seat, leaving the head free for someone else; usually indicates the student didn't read the "head" clue first (which is the load-bearing clue in most Stage-2 puzzles).
- `negation-clue-misread` — student treated "X is NOT next to Y" as "X IS next to Y" or ignored the negation entirely; the Stage-3 trap.
- `distractor-not-recognised` (Stage 3 only, recorded when the student seats all 7 chips so CHECK never enables, OR places the distractor in a seat) — student didn't notice the pool has more chips than seats; the Stage-3 meta-step.
- `absolute-seat-pin-overlooked` — student violated an `X sits in seat N` clue (placed X in a different seat). Common Stage-1 misconception when the student fixates on relational clues and skims past the pin.

(Per CHECK, the build step records the WORST violated clue's misconception tag (priority order: `seat-pin > head-of-table > between > left-of > across-from > not-next-to > next-to`) — `seat-pin` and `head-of-table` are absolute anchors whose violation typically cascades; next-to is the weakest. If multiple clues are violated, only the highest-priority tag is recorded for that round; this matches the queens spec's voice-line priority pattern.)

### Round-set cycling — 21 round objects total

The spec authors **three full sets (A, B, C) × 7 rounds = 21 round objects**. The build step copies these verbatim into `fallbackContent.rounds`. Each set has different chip names (drawn from a small bank of grade-appropriate Indian first names) AND different clue compositions AND different unique solutions per puzzle, but **parallel difficulty** (Set A's Round 3 ≈ Set B's Round 3 ≈ Set C's Round 3 in seat count, clue count, deduction depth). Build-time validator (exhaustive permutation search) asserts each round's `clues` admit exactly one valid `solution`.

```js
const fallbackContent = {
  previewInstruction:
    '<p><b>Read the clues.</b> Drag each friend onto a seat so all the clues are true ' +
    'at the same time. Then tap <b>CHECK</b>.</p>' +
    '<p style="font-size:0.9em;color:#666;">Tip: <b>Left</b> and <b>right</b> are from ' +
    '<b>your</b> view, looking at the picture.</p>',
  previewAudioText:
    'Read the clues, then drag each friend onto a seat so that every clue is true at ' +
    'the same time. When all the seats are full, tap CHECK. Left and right are from your ' +
    'view, looking at the picture.',
  previewAudio: null,
  showGameOnPreview: false,
  totalRounds: 7,
  totalLives: 0,                     // no lives — wrong CHECK does not penalise
  answerComponent: true,

  rounds: [
    // ── Set A — 7 rounds ──
    // Stage 1 (R1-R2): 4 seats, 4 chars, 2-3 clues, no head, no distractor, no negation.
    { set: 'A', id: 'A_r1', round: 1, stage: 1, type: 'seating-puzzle',
      seats: [1, 2, 3, 4],
      adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 4], '4': [1, 3] },
      acrossFrom:    { '1': 3, '2': 4, '3': 1, '4': 2 },
      leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 1 },
      headSeat: null,
      chips: [ /* 4 chips for set A round 1 — see Pre-Generation §A.1 */ null ],
      clues: [ /* 2-3 clues, kinds in {next-to, across-from, left-of} — Pre-Generation §A.1 */ null ],
      solution: /* { seatNum: chipId } unique pre-validated — Pre-Generation §A.1 */ null,
      answer:   { seating: null, distractor: null },
      misconception_tags: { /* full map per the schema above */ }
    },
    { set: 'A', id: 'A_r2', round: 2, stage: 1, type: 'seating-puzzle',
      seats: [1, 2, 3, 4],
      adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 4], '4': [1, 3] },
      acrossFrom:    { '1': 3, '2': 4, '3': 1, '4': 2 },
      leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 1 },
      headSeat: null,
      chips: [ /* Pre-Generation §A.2 */ null ],
      clues: [ /* Pre-Generation §A.2 */ null ],
      solution: null, answer: { seating: null, distractor: null },
      misconception_tags: { /* same */ }
    },

    // Stage 2 (R3-R5): 5 seats, 5 chars, 3-4 clues, head, includes "between" and "head of table".
    { set: 'A', id: 'A_r3', round: 3, stage: 2, type: 'seating-puzzle',
      seats: [1, 2, 3, 5, 4],   // clockwise from head
      adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 5], '5': [3, 4], '4': [1, 5] },
      acrossFrom:    { '2': 4, '4': 2, '3': 5, '5': 3, '1': null },
      leftNeighbour: { '1': 2, '2': 3, '3': 5, '5': 4, '4': 1 },
      headSeat: 1,
      chips: [ /* 5 chips — Pre-Generation §A.3 */ null ],
      clues: [ /* 3-4 clues including head-of-table and/or between — Pre-Generation §A.3 */ null ],
      solution: null, answer: { seating: null, distractor: null },
      misconception_tags: { /* same */ }
    },
    { set: 'A', id: 'A_r4', round: 4, stage: 2, type: 'seating-puzzle',
      seats: [1, 2, 3, 5, 4],
      adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 5], '5': [3, 4], '4': [1, 5] },
      acrossFrom:    { '2': 4, '4': 2, '3': 5, '5': 3, '1': null },
      leftNeighbour: { '1': 2, '2': 3, '3': 5, '5': 4, '4': 1 },
      headSeat: 1,
      chips: [ /* Pre-Generation §A.4 */ null ],
      clues: [ /* Pre-Generation §A.4 */ null ],
      solution: null, answer: { seating: null, distractor: null },
      misconception_tags: { /* same */ }
    },
    { set: 'A', id: 'A_r5', round: 5, stage: 2, type: 'seating-puzzle',
      seats: [1, 2, 3, 5, 4],
      adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 5], '5': [3, 4], '4': [1, 5] },
      acrossFrom:    { '2': 4, '4': 2, '3': 5, '5': 3, '1': null },
      leftNeighbour: { '1': 2, '2': 3, '3': 5, '5': 4, '4': 1 },
      headSeat: 1,
      chips: [ /* Pre-Generation §A.5 */ null ],
      clues: [ /* Pre-Generation §A.5 */ null ],
      solution: null, answer: { seating: null, distractor: null },
      misconception_tags: { /* same */ }
    },

    // Stage 3 (R6-R7): 6 seats, 7 chips (1 distractor), 4-5 clues, head + foot,
    // includes negation in >= 1 of the two rounds.
    { set: 'A', id: 'A_r6', round: 6, stage: 3, type: 'seating-puzzle',
      seats: [1, 2, 3, 4, 5, 6],
      adjacency:     { '1': [2, 6], '2': [1, 3], '3': [2, 4], '4': [3, 5], '5': [4, 6], '6': [1, 5] },
      acrossFrom:    { '1': 4, '4': 1, '2': 6, '6': 2, '3': 5, '5': 3 },
      leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 1 },
      headSeat: 1,
      chips: [ /* 7 chips, 1 of which is a distractor — Pre-Generation §A.6 */ null ],
      clues: [ /* 4-5 clues, distractor never named — Pre-Generation §A.6 */ null ],
      solution: null,                          // assigns 6 chips to 6 seats
      answer:   { seating: null, distractor: /* chipId */ null },
      misconception_tags: { /* full map including 'distractor-not-recognised' */ }
    },
    { set: 'A', id: 'A_r7', round: 7, stage: 3, type: 'seating-puzzle',
      seats: [1, 2, 3, 4, 5, 6],
      adjacency:     { '1': [2, 6], '2': [1, 3], '3': [2, 4], '4': [3, 5], '5': [4, 6], '6': [1, 5] },
      acrossFrom:    { '1': 4, '4': 1, '2': 6, '6': 2, '3': 5, '5': 3 },
      leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 1 },
      headSeat: 1,
      chips: [ /* Pre-Generation §A.7 */ null ],
      clues: [ /* Pre-Generation §A.7 — INCLUDES at least one not-next-to negation */ null ],
      solution: null, answer: { seating: null, distractor: null },
      misconception_tags: { /* same */ }
    },

    // ── Set B — 7 rounds (parallel difficulty to Set A; different chip names + clues + solutions) ──
    { set: 'B', id: 'B_r1', round: 1, stage: 1, type: 'seating-puzzle', /* mirror of A_r1 */ },
    { set: 'B', id: 'B_r2', round: 2, stage: 1, type: 'seating-puzzle', /* mirror of A_r2 */ },
    { set: 'B', id: 'B_r3', round: 3, stage: 2, type: 'seating-puzzle', /* mirror of A_r3 */ },
    { set: 'B', id: 'B_r4', round: 4, stage: 2, type: 'seating-puzzle', /* mirror of A_r4 */ },
    { set: 'B', id: 'B_r5', round: 5, stage: 2, type: 'seating-puzzle', /* mirror of A_r5 */ },
    { set: 'B', id: 'B_r6', round: 6, stage: 3, type: 'seating-puzzle', /* mirror of A_r6 */ },
    { set: 'B', id: 'B_r7', round: 7, stage: 3, type: 'seating-puzzle', /* mirror of A_r7 */ },

    // ── Set C — 7 rounds (parallel difficulty to Set A; different chip names + clues + solutions) ──
    { set: 'C', id: 'C_r1', round: 1, stage: 1, type: 'seating-puzzle', /* mirror of A_r1 */ },
    { set: 'C', id: 'C_r2', round: 2, stage: 1, type: 'seating-puzzle', /* mirror of A_r2 */ },
    { set: 'C', id: 'C_r3', round: 3, stage: 2, type: 'seating-puzzle', /* mirror of A_r3 */ },
    { set: 'C', id: 'C_r4', round: 4, stage: 2, type: 'seating-puzzle', /* mirror of A_r4 */ },
    { set: 'C', id: 'C_r5', round: 5, stage: 2, type: 'seating-puzzle', /* mirror of A_r5 */ },
    { set: 'C', id: 'C_r6', round: 6, stage: 3, type: 'seating-puzzle', /* mirror of A_r6 */ },
    { set: 'C', id: 'C_r7', round: 7, stage: 3, type: 'seating-puzzle', /* mirror of A_r7 */ }
  ]
};
```

### Worked sample puzzles (one per stage)

These three samples are fully-authored, hand-verified-unique puzzles that the build step can use to:
1. Seed the first three rounds of Set A (or use as Set A test fixtures pending Pre-Generation Step 3 producing the full 21).
2. Validate the round schema and `evaluateClues()` implementation end-to-end.
3. Anchor `validate-static.js` / `validate-contract.js` integration tests.

Each sample's `solution` was verified by exhaustive permutation search (manually performed by the spec author; build-step Pre-Generation Step 3 MUST re-verify with code).

**Sample 1 — Stage 1, `A_r1` (4 seats, 4 chips, 3 clues, includes seat-pin):**

```js
{
  set: 'A', id: 'A_r1', round: 1, stage: 1, type: 'seating-puzzle',
  seats: [1, 2, 3, 4],
  adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 4], '4': [1, 3] },
  acrossFrom:    { '1': 3, '2': 4, '3': 1, '4': 2 },
  leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 1 },
  headSeat: null,
  chips: [
    { id: 'anu',   name: 'Anu',   avatar: '👧' },
    { id: 'ravi',  name: 'Ravi',  avatar: '👦' },
    { id: 'priya', name: 'Priya', avatar: '🧒' },
    { id: 'neha',  name: 'Neha',  avatar: '👧' }
  ],
  clues: [
    { text: 'Anu sits in seat 1.',           kind: 'seat-pin',    args: ['anu', 1] },
    { text: 'Ravi is across from Anu.',      kind: 'across-from', args: ['ravi', 'anu'] },
    { text: 'Priya sits to the left of Ravi.', kind: 'left-of',   args: ['priya', 'ravi'] }
  ],
  solution: { '1': 'anu', '2': 'neha', '3': 'ravi', '4': 'priya' },
  answer:   { seating: { '1': 'anu', '2': 'neha', '3': 'ravi', '4': 'priya' }, distractor: null },
  misconception_tags: {
    'next-to':       'next-to-constraint-overlooked',
    'across-from':   'across-from-constraint-overlooked',
    'left-of':       'left-right-orientation-confused',
    'seat-pin':      'absolute-seat-pin-overlooked'
  }
}
```

**Sample 2 — Stage 2, `A_r3` (5 seats, 5 chips, 4 clues, includes head-of-table and between):**

```js
{
  set: 'A', id: 'A_r3', round: 3, stage: 2, type: 'seating-puzzle',
  seats: [1, 2, 3, 5, 4],
  adjacency:     { '1': [2, 4], '2': [1, 3], '3': [2, 5], '5': [3, 4], '4': [1, 5] },
  acrossFrom:    { '2': 4, '4': 2, '3': 5, '5': 3, '1': null },
  leftNeighbour: { '1': 2, '2': 3, '3': 5, '5': 4, '4': 1 },
  headSeat: 1,
  chips: [
    { id: 'meera', name: 'Meera', avatar: '👧' },
    { id: 'anu',   name: 'Anu',   avatar: '👧' },
    { id: 'ravi',  name: 'Ravi',  avatar: '👦' },
    { id: 'priya', name: 'Priya', avatar: '🧒' },
    { id: 'neha',  name: 'Neha',  avatar: '👧' }
  ],
  clues: [
    { text: 'Meera is at the head of the table.', kind: 'head-of-table', args: ['meera'] },
    { text: 'Anu sits next to Meera.',            kind: 'next-to',       args: ['anu', 'meera'] },
    { text: 'Ravi sits between Anu and Priya.',   kind: 'between',       args: ['ravi', 'anu', 'priya'] },
    { text: 'Neha sits to the left of Meera.',    kind: 'left-of',       args: ['neha', 'meera'] }
  ],
  solution: { '1': 'meera', '2': 'neha', '3': 'priya', '4': 'anu', '5': 'ravi' },
  answer:   { seating: { '1': 'meera', '2': 'neha', '3': 'priya', '4': 'anu', '5': 'ravi' }, distractor: null },
  misconception_tags: {
    'next-to':       'next-to-constraint-overlooked',
    'across-from':   'across-from-constraint-overlooked',
    'left-of':       'left-right-orientation-confused',
    'between':       'between-constraint-misread',
    'head-of-table': 'head-anchor-overlooked'
  }
}
```

**Sample 3 — Stage 3, `A_r6` (6 seats, 7 chips with 1 distractor, 5 clues, includes negation):**

```js
{
  set: 'A', id: 'A_r6', round: 6, stage: 3, type: 'seating-puzzle',
  seats: [1, 2, 3, 4, 5, 6],
  adjacency:     { '1': [2, 6], '2': [1, 3], '3': [2, 4], '4': [3, 5], '5': [4, 6], '6': [1, 5] },
  acrossFrom:    { '1': 4, '4': 1, '2': 6, '6': 2, '3': 5, '5': 3 },
  leftNeighbour: { '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 1 },
  headSeat: 1,
  chips: [
    { id: 'meera', name: 'Meera', avatar: '👧' },
    { id: 'anu',   name: 'Anu',   avatar: '👧' },
    { id: 'ravi',  name: 'Ravi',  avatar: '👦' },
    { id: 'priya', name: 'Priya', avatar: '🧒' },
    { id: 'neha',  name: 'Neha',  avatar: '👧' },
    { id: 'bobby', name: 'Bobby', avatar: '👦' },
    { id: 'tara',  name: 'Tara',  avatar: '🧒' }   // distractor — never named in clues
  ],
  clues: [
    { text: 'Meera is at the head of the table.', kind: 'head-of-table', args: ['meera'] },
    { text: 'Anu is across from Meera.',          kind: 'across-from',   args: ['anu', 'meera'] },
    { text: 'Ravi sits between Bobby and Anu.',   kind: 'between',       args: ['ravi', 'bobby', 'anu'] },
    { text: 'Priya is NOT next to Anu.',          kind: 'not-next-to',   args: ['priya', 'anu'] },
    { text: 'Neha sits to the left of Anu.',      kind: 'left-of',       args: ['neha', 'anu'] }
  ],
  solution: { '1': 'meera', '2': 'bobby', '3': 'ravi', '4': 'anu', '5': 'neha', '6': 'priya' },
  answer:   { seating: { '1': 'meera', '2': 'bobby', '3': 'ravi', '4': 'anu', '5': 'neha', '6': 'priya' }, distractor: 'tara' },
  misconception_tags: {
    'next-to':                'next-to-constraint-overlooked',
    'across-from':            'across-from-constraint-overlooked',
    'left-of':                'left-right-orientation-confused',
    'between':                'between-constraint-misread',
    'head-of-table':          'head-anchor-overlooked',
    'not-next-to':            'negation-clue-misread',
    'distractor-not-recognised': 'distractor-not-recognised'
  }
}
```

(All three samples cover the three difficulty stages — A6 / G2 / G3 sample-coverage requirement satisfied. Pre-Generation Step 3 produces the remaining 18 puzzles using the same schema and uniqueness-validation method.)

**Pre-Generation step (game-planning Step 3):** Before Step 4 (Build), the orchestrator generates the **21 puzzles** (chips + clues + unique solution per round) and writes them into `games/logic-seat-puzzle/pre-generation/puzzles.md`. For each puzzle:
1. Author the chip pool (4 / 5 / 7 chips depending on stage).
2. Author the clues using only the grammar in the Clue Grammar Reference. **For Stage 1, every puzzle MUST include at least one `X sits in seat N.` clue** (grammar #7) to break the 4-cycle's rotational symmetry — without it, the puzzle CANNOT be unique-solvable. For Stage 3, ensure exactly one chip is never named in any clue (the distractor) AND ≥ 1 of the two Stage-3 rounds includes a `not-next-to` negation clue.
3. Run exhaustive permutation search (`P(seats, chips)` = `4!=24` / `5!=120` / `6P7=5040`) to enumerate ALL arrangements satisfying the clues.
4. Assert exactly ONE arrangement satisfies all clues. If 0 → clues are unsatisfiable; revise. If ≥ 2 → puzzle is ambiguous; add a clue or rephrase.
5. Record the unique arrangement as `solution` and (matching) `answer.seating`. For Stage 3, record the unmentioned chip as `answer.distractor`.

The build step in Step 4 inlines the resulting tables into `fallbackContent.rounds`.

**Chip name bank (suggested, Class 4–6 grade-appropriate, gender-mixed, no overloaded mythological names):** Anu, Ravi, Priya, Neha, Meera, Bobby, Tara, Rohan, Kavya, Arjun, Diya, Kabir. Use 4 / 5 / 7 distinct names per round; vary across sets so Set A uses one name combination, Set B another, Set C another. Avatars from a small palette: 👧 👦 🧒 🧑 (gender-neutral for older kids). Same chip ID may appear across sets but the per-round chip pool is regenerated — no in-spec assumption that "Anu" is always girl-coded etc.

## Visual / Theme

- **Layout:** PART-021 standard mobile layout. Header (puzzle counter "Puzzle N of 7" + ProgressBar with 7 segments, no hearts) on top. Clue panel below header. Table centred. Chip pool below table. CHECK FloatingButton (PART-050) anchored at the bottom edge.
- **Table sizing on a 375 px-wide viewport:**
  - Stage 1 (4 seats, square layout): ~280 px × 280 px table area, seats are ~64 px diameter circles at the 4 corners — clears 44 px touch-target with margin.
  - Stage 2 (5 seats, head + 4 sides): ~280 px wide × ~320 px tall (taller due to head), seats are ~60 px diameter.
  - Stage 3 (6 seats, head + foot + 4 sides): ~280 px × ~320 px, seats are ~56 px diameter — still clears 44 px (with 12 px headroom) for children's fingers.
- **Chip sizing in pool:** ~64 px wide × ~80 px tall (avatar 40 px + name text below). Pool arranged in a single row for Stage 1/2, 2 rows × 4-wide for Stage 3 (7 chips fit comfortably).
- **Seat hit area:** the entire seat circle is the drop-zone. No nested drop target inside.
- **Drag visual:** chip lifts ~4 px on pickup with a subtle shadow; ghost chip follows the touch/cursor; original chip slot in the pool greys out (`opacity: 0.3`) while the chip is "in flight"; over a valid drop-zone the seat highlights with a thin cyan ring (`#3D8BFD`, 2 px).
- **Constraint-violation flash (wrong CHECK):** seats in violated clues glow red (`#E63946`) at full opacity, 3 cycles of 500 ms ease-in-out (~1500 ms total). NOT continuous animation — momentary feedback only (mobile rule #14).
- **Solve celebration (correct CHECK):** per-seat green flash (`#2A9D8F`) propagates around the table clockwise, ~80 ms stagger per seat, ~600 ms total.
- **Head/foot indicators:** Stage 2 head seat (1) is rendered ~10% larger than the other seats with a small 👑 emoji watermark at top. Stage 3 head AND foot seats are similarly sized larger; the foot watermark is a small ⌒ (or a subtle "(foot)" text label — final choice deferred to build-step visual review).
- **Clue numbering:** plain numerals "1." "2." "3." in a clean sans-serif at 16 px (mobile rule #35). No emoji-numbered variants (this game is reading-as-math; emoji numbers compete with the clue text for attention).
- **CHECK button:** PART-050 FloatingButton, large (~280 px × 56 px), bottom-anchored, primary style. Dimmed when not all required seats are filled. Reskins to NEXT (`Next puzzle →` copy) after a wrong CHECK.
- **No timer indicator** (PART-006 not used).
- **No lives indicator** (`totalLives: 0`).
- **Mobile compliance:** all rules in `mobile/SKILL.md` apply. `viewport meta` correct, `100dvh`, `overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: manipulation` on the CHECK button (NOT on the table or chip pool — see mobile rule #16). **`touch-action: none` is set ONLY on draggable chip elements** (mobile rule #22), never on seats, the table, or the pool wrapper. Active-drag scroll suppression handled by document-level `touchmove + preventDefault` keyed on drag state. `-webkit-` prefixes paired with standard properties, no `gap` on flex (margin / grid-gap only). Touch targets 44 px+ (chips ~64 px, seats ~56 px+, CHECK button ~56 px tall).
- **CRITICAL — `@dnd-kit/dom@beta` integration:** Step 4 (Build) MUST run in `[MAIN CONTEXT]` per the project root `CLAUDE.md` table. The HTML imports `https://esm.sh/@dnd-kit/dom@beta`. Pointer + touch sensors enabled. Drop-zones registered for each seat AND for the pool (so a chip can be dragged back to the pool). `validate-static.js` rule `GEN-DND-KIT` enforces use of `@dnd-kit/dom@beta` and rejects hand-rolled `pointerdown`/`touchstart` substitutes.

## Out of Scope

- **No procedural clue generation** — puzzles are pre-validated and hand-authored; the build step inlines them. Future work: a build-time generator that produces and uniqueness-validates new clue sets per session.
- **No hints** — the creator explicitly says "no hint button". The CHECK feedback (red-glowing seats showing which clues failed) IS the hint mechanism.
- **No retry on the same round** — wrong CHECK terminates the round and reskins CHECK → NEXT. A second play (Try Again from Victory) loads a different set, not the same set.
- **No undo button** — the student manually drags chips back to the pool to "undo".
- **No leaderboard / streak tracking across sessions** — single-session game.
- **No timer / speed scoring** — concept explicitly states no timer. PART-006 NOT included.
- **No tap-to-place fallback** — interaction pattern is locked to P6 drag-and-drop. (A tap-to-place variant would be useful for accessibility but is out of scope for v1.)
- **No background music / audio loops** — concept brief: "minimal SFX". Audio reserved for round transitions, CHECK feedback, and end-of-game.
- **No per-clue voice-over** during gameplay — clues are READ; reading them aloud defeats the comprehension goal.
- **No multiplayer / two-player race** — single player only.
- **No character-pool personalization beyond the bank named above** — chip names are fixed per-round in the spec.
- **No language toggle** — clue text is English only. (Future bilingual support possible per pedagogy/indian-curriculum.md.)
- **No sound mute / volume controls beyond the platform-standard mute toggle** — handled by FeedbackManager and the harness.

## Decision-Points / Open Items

(For the orchestrator and spec-review to confirm before Step 4 / Build.)

1. **Left/right anchoring is from the VIEWER's POV, not the seated character's POV.** This is a load-bearing design decision. The PreviewScreen explicitly explains it ("Left and right are from your view, looking at the picture"). Spec-review should confirm this convention is acceptable for the Class 4–6 audience and that the alternative (seated-character POV) is not preferred. The viewer-POV convention is more intuitive for top-down diagrams; seated-character POV would require a 180° mental flip for the head-of-table chip.
2. **PreviewScreen wording.** Spec author drafted: "Read the clues. Drag each friend onto a seat so all the clues are true at the same time. Then tap CHECK." plus a left/right tip. Spec-review should confirm this is short-enough and pre-Class-6-readable. Alternative drafts welcome.
3. **AnswerComponent slide subtitle wording.** Spec author proposes a one-liner per stage focusing on the load-bearing reasoning move (e.g. Stage 3 subtitle: "Find the friend with no clue, set them aside, then solve."). Spec-review should confirm this wording or replace with neutral / mechanical text ("Stage 3 puzzle" only).
4. **Stage 2 layout — 5 seats with head only (no foot).** Spec author chose seats 1=head, 2/3 right, 5/4 left, with the foot side OPEN (no seat at the bottom). This is the standard "round table with one head" layout. Alternative: 5 seats in a regular pentagon (no head). The "head" is needed for the "X is at the head of the table" clue, so Stage 2 needs a clearly-marked head — the open-foot rectangle conveys this best on a small mobile screen. Confirm with build-step visual review.
5. **Stage 3 layout — 6 seats with head AND foot.** Spec author chose seats 1=head/top, 4=foot/bottom, 2/3 right side, 5/6 left side. This gives a clean rectangular layout with two anchored seats. Confirm with build-step visual review.
6. **Distractor mechanic CHECK enable rule.** CHECK enables when **all SEATS are filled** (NOT when all chips are placed). This is critical for Stage 3 — the distractor is supposed to remain in the pool. Spec-review should explicitly confirm this rule is correctly stated and that the build step's `isCheckable()` predicate counts filled seats, not placed chips.
7. **Pre-generation step output format.** Spec author proposes `games/logic-seat-puzzle/pre-generation/puzzles.md` with one section per round (21 sections) listing chips, clues, and solution. The build step inlines the data. Confirm format before Step 3 / Step 4.
8. **Chip name bank — gender-mixed Indian first names.** Spec author chose Anu, Ravi, Priya, Neha, Meera, Bobby, Tara, Rohan, Kavya, Arjun, Diya, Kabir. Spec-review should confirm cultural-fit and that no name is overloaded (e.g. "Bobby" is a nickname; replace if it feels off-register for the audience).
9. **Star rule — 1⭐ floor for completing all 7 even at 0 first-CHECK correct.** Creator-specified. Spec author thinks this is appropriate generosity (rewards persistence) but spec-review should confirm. Alternative: 0⭐ for < some threshold of first-CHECK correct.
10. **No retry on the same round — single CHECK per round.** Creator-specified ("no retries"). Spec-review should confirm this is the intended player experience and that the wrong CHECK → NEXT flow (with chips left visible against red-glow seats) is the desired information-not-punishment moment.
11. **Step 4 (Build) MUST run in `[MAIN CONTEXT]`** per the project root `CLAUDE.md` table for Pattern P6. The orchestrator MUST route accordingly. Spec-review should verify this routing decision is recorded in the orchestration step plan.

## Defaults Applied

(Decisions NOT specified by the creator and filled by a default. Per spec-creation Step 3, `answerComponent` is silently `true` and is NOT listed here.)

- **Pre-generation step:** defaulted to "hand-authored chip pools and clue sets, build-time exhaustive uniqueness check via permutation search" (creator did not specify how the 21 puzzles are produced).
- **Stage 1 / 2 / 3 expected solve times:** defaulted to 30–90 s, 1–3 min, 2–5 min respectively (creator specified no timer and "deliberation"; spec author provides ranges so testing has a target band).
- **First-CHECK rate targets per stage (85% / 65% / 45%):** defaulted by spec author per pedagogy.md L4 70–85% overall target tightened by stage to reflect mastery progression. Stage-1 target deliberately above the 70–85% band because Stage 1 is the on-ramp.
- **Table shapes per stage** (Stage 1 = rounded square, Stage 2 = oval with head only, Stage 3 = rectangle with head and foot): defaulted (creator described "small top-down diagram of a table" without per-stage geometry).
- **Adjacency, across-from, and leftNeighbour maps per stage:** defaulted by spec author to match the chosen table shapes (concept silent on the exact graph).
- **Stage-1 absolute-position clue grammar (`X sits in seat N.`):** added by spec-review to break rotational symmetry on the 4-cycle Stage-1 table (without it, every Stage-1 puzzle has ≥ 4 solutions and cannot satisfy the "unique pre-validated solution" guarantee). The creator did not specify seat-pin clues; spec-review treats this as a load-bearing structural addition rather than a discretionary default. See "Stage-1 absolute anchor" under Clue Grammar Reference.
- **Left/right anchoring from VIEWER's POV:** defaulted by spec author. Concept mentions "to the left of Anu" but does not specify whose left. Spec author chose viewer-POV as the more intuitive convention for top-down diagrams; flagged in Decision-Points #1 for confirmation.
- **PreviewScreen wording:** drafted by spec author per concept's "instruction is intuitive" framing.
- **AnswerComponent slide subtitle wording:** defaulted to per-stage one-liner focusing on the load-bearing reasoning move (see Decision-Points #3).
- **Chip avatars and chip name bank:** defaulted by spec author (concept gave examples Anu, Ravi, Priya, Neha, Meera, Bobby; spec author added Tara, Rohan, Kavya, Arjun, Diya, Kabir for cross-set variety).
- **CHECK-enabled rule (all SEATS filled, not all chips placed):** defaulted by spec author per concept's distractor mechanic; flagged in Decision-Points #6.
- **No retry on the same round — wrong CHECK reskins to NEXT:** drafted by spec author per concept's "no retries" + the natural single-attempt scoring rubric.
- **`autoShowStar`:** defaulted to `true` (creator did not specify; PART-050 standard is true).
- **`previewScreen`:** defaulted to `true` (creator did not specify; PART-039 standard is true).
- **Round-set size 21 (3 sets × 7 rounds):** defaulted per spec-creation skill GEN-ROUNDSETS-MIN-3 validator rule (mandatory for multi-round games).
- **Misconception tag set and per-CHECK priority order:** defaulted by spec author per pedagogy/misconceptions.md style; flagged so spec-review can confirm tags are real misconceptions.

(Explicitly NOT defaulted — creator-specified — and so NOT listed above:)

- **Bloom level L4 Analyze:** explicitly inferred from creator brief ("multi-constraint reasoning", "hold partial answers in mind").
- **No lives:** explicitly stated by the creator.
- **No timer:** explicitly stated by the creator.
- **7 rounds across 3 stages (R1-R2 / R3-R5 / R6-R7):** explicitly stated by the creator.
- **Stage difficulty knobs (translate / combine / reject; seat counts 4/5/6; chip counts 4/5/7):** explicitly stated by the creator.
- **Star rule (3 / 2 / 1 / 0 by first-CHECK count):** explicitly stated by the creator.
- **No retries on the same round:** explicitly stated by the creator.
- **Drag-and-drop interaction with swap-back-to-pool:** explicitly stated by the creator.
- **Single CHECK button enabled when seats are filled:** explicitly stated by the creator.
- **Wrong CHECK → red-glow seats in violated clues + "Oh no" message:** explicitly stated by the creator.
- **Distractor mechanic in Stage 3:** explicitly stated by the creator.
- **Negation clue ("X is NOT next to Y") in Stage 3:** explicitly stated by the creator.
- **Minimal SFX, no music:** explicitly stated by the creator.

## Warnings

- **WARNING: P6 drag-and-drop interaction REQUIRES `@dnd-kit/dom@beta`. Step 4 (Build) MUST run in `[MAIN CONTEXT]`** per the project root `CLAUDE.md` table. A sub-agent without context7 access will silently hand-roll a substitute (native `pointerdown`) which `validate-static.js` rule `GEN-DND-KIT` is meant to catch — but routing the step correctly prevents the mistake at the source. Orchestrator MUST verify this routing before Step 4.
- **WARNING: No lives, no timer, single-attempt scoring is non-standard for L4 Analyze.** Defaults for L4 are "None or 5" lives and no timer, so no-timer matches; but no-lives-AND-no-retry-AND-1⭐-floor-for-completion is a creator-specific scoring shape. Spec-review must confirm the build step's `getStars()` implements the exact rubric (3⭐ = 7/7 first-CHECK, 2⭐ = 5–6/7, 1⭐ = completed all 7, 0⭐ = walked away) and not the default 90/66/33 thresholds.
- **WARNING: No game-over screen.** Lives = 0 means no `game_over` phase exists. The session always reaches Victory unless the player walks away (which is handled by the harness's session-incomplete path, not a game-internal screen). Build step must NOT generate a `game_over` TransitionScreen — including one would be a CRITICAL violation of game-archetypes constraint #5 ("Lives = 0 means no game_over screen").
- **WARNING: Single CHECK per round (no retry on the same round) terminates the round with chips visible against red-glow seats.** This is creator-intended (informational wrong, not punishing) but is non-standard relative to the typical "wrong → retry on same round" pattern. Build step must implement: wrong CHECK → SFX+TTS awaited → FloatingButton.setMode('next') with copy `Next puzzle →` → student taps NEXT → progressBar bumps → next round transition. NEVER re-enable CHECK on the same round.
- **WARNING: CHECK-enabled rule is "all SEATS filled" NOT "all chips placed".** This is critical for Stage 3 (the distractor must stay in the pool). The build step's `isCheckable()` predicate must count filled seats, not placed chips. A naïve "all chips placed" rule would prevent the student from ever CHECKing on Stage 3 (since the distractor cannot be seated).
- **WARNING: Left/right anchoring from the VIEWER's POV.** Spec author chose viewer-POV per the more intuitive convention for top-down diagrams. The PreviewScreen explicitly explains it. If spec-review wants the alternative (seated-character POV), the `leftNeighbour` maps in this spec ALL flip and the PreviewScreen tip changes. Confirm before Step 4.
- **WARNING: Distractor mechanic + negation clue + 6 seats in Stage 3 is a steep difficulty cliff.** The 45% first-CHECK target reflects this. If gauge data shows < 30% during pilot, Stage 3 difficulty should be reduced (drop the distractor on Round 6, keep only on Round 7; or move the negation clue out of Round 6).
- **WARNING: Pre-generation step is a content dependency.** If `games/logic-seat-puzzle/pre-generation/puzzles.md` is missing or incomplete, the game cannot ship. Step 4 (Build) must read the pre-generation file and inline the 21 puzzles; if the file is missing, fail fast with a clear error.
- **WARNING: 21 round objects (3 × 7) is at the upper end of authoring overhead.** Each round needs chips + clues + a unique-solution validation pass. Spec-review should confirm this scope is acceptable; if not, the spec could drop to 2 sets (14 round objects), but that violates the GEN-ROUNDSETS-MIN-3 validator rule.
- **WARNING: No procedural generation — same 3 sets (A/B/C) cycle forever.** A determined student who plays through 4+ times will see Set A again. This is acceptable for a 7-round session at L4 (replay value bounded by archetype design). If a future iteration wants procedural generation, see Out-of-Scope.
- **WARNING: Voice-over priority for wrong CHECK is single line "Oh no — that's not quite right!" — does NOT name the violated clue.** This is intentional (the red-glow seats are the signal; voice-over re-reading the clue would defeat the read-it-yourself goal). If spec-review wants per-clue TTS feedback ("Anu is not next to Ravi — that clue is broken"), this changes the feedback contract significantly. Default chosen: short generic TTS, visual signal carries the diagnostic information.
