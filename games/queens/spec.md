# Game Design: Queens

## Identity
- **Game ID:** queens
- **Title:** Queens
- **Class/Grade:** Class 4–5 (Grade 4–5, ~9–11 years old). Explicitly set by the creator — DO NOT widen to 5–8.
- **Math Domain:** Logical reasoning & spatial geometry — multi-constraint reasoning on a coloured grid.
- **Topic:** Place 5 queens on a **5×5** coloured board so that no two share a row, column, coloured region, or touch on a diagonal. Multi-constraint deduction, mark-the-impossible reasoning, and externalising working memory with ✖ marks.
- **Bloom Level:** L4 Analyze — multi-constraint reasoning. Student must intersect four simultaneous constraints (row, column, region, diagonal) to deduce safe placements.
- **Archetype:** #6 Board Puzzle — single board solved as a whole; multi-puzzle session (3 puzzles).
- **NCERT Reference:**
  - Class 4 — *Tick Tick Tick* (logical reasoning, working with grids and patterns)
  - Class 5 — *Does it look the same?* (symmetry, spatial reasoning) and *Mapping your way* (grid coordinates, spatial planning)
  - General logical-reasoning content not anchored to a single chapter — consistent with Class 4–5 math-Olympiad-style puzzles.
- **Pattern:** P8 (Click-to-Toggle) with a tri-state cycle (empty → ✖ → ♛/👑 → empty). NOT drag-and-drop. Step 4 (Build) runs as a `[SUB-AGENT]` (no main-context override needed; no CDN library beyond the standard CDN core).
- **Input:** Single-tap on grid cells. No keyboard, no drag, no submit button (auto-validates each queen placement). One per-puzzle Reset button. No hints.

## One-Line Concept
The student places 5 queens on a 5×5 coloured grid such that no two queens share a row, column, coloured region, or touch on a diagonal — using ✖ marks as a free working-memory scaffold and learning to read four simultaneous constraints.

## Why 5×5 (grade-appropriate sizing)
The original concept described a 7×7 grid; for Class 4–5 the grid is shrunk to **5×5** to keep the cognitive load tractable for ~9–11 year olds. A 5×5 board with 5 regions and the same four constraints retains the full multi-constraint reasoning experience while shortening the deduction chain (≤ 25 cells, ≤ 5 queens) so a typical session completes in ≤ 15 minutes and trial-and-error within 2 lives is recoverable. Cell size on a 375 px viewport is ~65 px (well above the 44 px touch-target minimum), giving generous hit area for younger fingers.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Multi-constraint reasoning | Hold four simultaneous rules (row / column / region / diagonal) and deduce which cells remain safe. | queens-board |
| Region recognition | Identify which coloured region a cell belongs to and reason about region-mates. | queens-board |
| Diagonal-adjacency awareness | See the eight neighbours of a placed queen and recognise the four diagonal corners as the new constraint. | queens-board |
| Mark-the-impossible deduction | Use the ✖ mark to externalise "this cell is now forbidden" reasoning so working-memory load stays manageable. | queens-board |
| Hypothesis testing | Place a queen, observe constraint propagation, retreat (untap) and try again — without losing a life on retract. | queens-board |

## Core Mechanic

### Type A: "Queens Board" (one round per stage; three stages = three puzzles)

1. **What the student sees**
   - A **5×5 grid** of cells (25 cells total), each painted with one of 5 distinct colours. Cells of the same colour form a **coloured region** (a connected polyomino partitioning the board into 5 regions of varying shape, every region of size ≥ 1 and the 5 regions together tiling the whole board, total cells = 25).
   - **Numbered rules panel** above the board (numbering style depends on stage — see below).
   - A **lives indicator** (♥ × 2 shared across the whole session) in the header.
   - A **puzzle progress chip** ("Puzzle 1 of 3") in the header.
   - A **Reset Puzzle** secondary button (clears all marks/queens on the current puzzle without refunding lives).
   - **No timer** (L4 deserves deliberation; concept explicitly states no timer).
   - **No hints button.**
2. **What the student does** (input type: tap-to-toggle, tri-state cycle)
   - Single-tap any cell to cycle its state: **empty → ✖ (mark) → ♛/👑 (queen) → empty**.
   - The ✖ mark is unlimited and free — the central scaffold for externalising working memory. Marks cost no life and trigger no audio attack.
   - Placing a queen (cycling from ✖ to ♛/👑) auto-validates against the four rules using priority order: **row > column > region > diagonal**.
3. **What counts as correct**
   - The puzzle is **solved** when 5 queens are placed simultaneously satisfying all four constraints — i.e. exactly one queen per row, one per column, one per coloured region, and no two queens diagonally adjacent.
   - **Each puzzle has a unique pre-validated solution.** No procedural generation — partitions are hand-authored and confirmed by build-time exhaustive search to admit exactly one valid queen placement.
   - A **safe placement** (queen does not violate any rule) does not solve the puzzle by itself — it just stays on the board and the student moves on.
   - An **attacking placement** (queen violates ≥ 1 rule the moment it is placed) is **rejected**: the queen reverts to empty (canonical), the violated rule is announced via voice, the offending queens (the new queen and the queen it attacks) flash red, the lives counter decrements by 1.
4. **What feedback plays**
   - **Safe placement** (queen placed with no violation, board not yet solved): soft chime SFX (fire-and-forget, no sticker, ~150 ms), no TTS. The queen glyph (♛ or 👑) settles into the cell with a subtle scale-in.
   - **Mark / unmark / cycle empty**: soft tap SFX (fire-and-forget, no sticker), no TTS. Pure ambient — never blocks input.
   - **Attacking placement** (queen rejected): wrong-answer SFX awaited (~1.5 s floor) with sad sticker, then awaited dynamic TTS naming the violated rule per the priority order (row > column > region > diagonal). Sample TTS lines:
     - Row attack: "Two queens cannot be in the same row."
     - Column attack: "Two queens cannot be in the same column."
     - Region attack: "Two queens cannot be in the same coloured region."
     - Diagonal attack: "Queens cannot touch corners — that's a diagonal neighbour."
     The new queen (the one the student just placed) and the attacking queen flash red for ~600 ms in sync with the SFX. After the awaited audio finishes, the new queen reverts to empty and the lives counter visibly decrements (heart pop animation). Input stays blocked (`isProcessing = true`) for the duration of the awaited audio; cleared in `loadRound()` / on the next tick after audio resolves.
   - **Puzzle solved** (all 5 queens placed correctly): per-cell celebration glow propagates across the board, awaited round-complete SFX with celebration sticker → awaited dynamic TTS ("Brilliant! All five queens are safe.") → auto-advance to the next puzzle's transition screen (Round 2 or Round 3) or, on Puzzle 3, to the Victory / Stars Collected screen.
   - **Lives reach 0** (last life lost): the wrong-answer SFX completes (CASE 8 — wrong SFX must play before game over), then the Game Over screen renders with `game_complete` posted before audio. The Game Over copy uses the L4 / Class 4–5 emotional-safety register: "Tough puzzle! Take a breath and try again." (never "you failed", "wrong", or "game over" copy in the body.)
   - **Reset Puzzle** tap: soft confirm SFX (fire-and-forget). All marks/queens on the current puzzle clear instantly. Lives are NOT refunded. Voice line: none (silent reset).

## Rounds & Progression

Three puzzles per session, one per stage, each cosmetically distinct so the student visibly graduates through palettes and rule-numbering style. **All three stages share the same core mechanic and constraint set; only the visual / cosmetic surface and rule-text style change.** The mechanical difficulty is paced via region geometry (see "Difficulty knobs" below).

### Stage 1: Vivid Palette + ♛ glyph + emoji-numbered rules (Round 1, "Puzzle 1")
- Round type: queens-board
- **Palette (vivid, high saturation; 5 colours):**
  - R1 `#E63946` (vivid red)
  - R2 `#F4A261` (warm orange)
  - R3 `#F1C453` (saturated yellow)
  - R4 `#2A9D8F` (vivid teal)
  - R5 `#3D8BFD` (vivid blue)
- **Glyph:** ♛ (U+265B BLACK CHESS QUEEN). Solid silhouette, ~70% of cell width.
- **Rule-numbering style:** emoji-numbered (1️⃣ 2️⃣ 3️⃣ 4️⃣).
- **Difficulty knob:** "first-exposure" geometry — regions are large, contiguous, and roughly rectangular (no snake-shapes). Solution requires 1–2 explicit deductions; brute-force trial-and-error is feasible within the 2-life budget.
- **Expected solve time:** 1–3 minutes.
- **Target first-solve rate:** ~80 % (Stage 1 is the on-ramp; we want most students to clear Puzzle 1 with both lives intact).

### Stage 2: Pastel Palette + 👑 glyph + emoji rules (Round 2, "Puzzle 2")
- Round type: queens-board
- **Palette (pastel, soft saturation; 5 colours):**
  - R1 `#FFB3B3` (pastel red)
  - R2 `#FFD6A5` (pastel orange)
  - R3 `#FDFFB6` (pastel yellow)
  - R4 `#CAFFBF` (pastel green)
  - R5 `#9BF6FF` (pastel cyan)
- **Glyph:** 👑 (U+1F451 CROWN). The crown emoji renders cleanly on Android Color Emoji and Apple Color Emoji.
- **Rule-numbering style:** emoji-numbered (1️⃣ 2️⃣ 3️⃣ 4️⃣) — same as Stage 1; the rule-number style change happens at Stage 3.
- **Difficulty knob:** "mid-stretch" geometry — regions are more irregular (one region of size 3 placed off-axis; one region "L-shapes" to force a non-trivial deduction). Solution requires ~2–3 explicit deductions; trial-and-error costs more lives than Stage 1 but is still survivable on 2 lives if the student uses ✖ marks to scaffold.
- **Expected solve time:** 2–5 minutes.
- **Target first-solve rate:** ~60 %.

### Stage 3: Muted Palette + 👑 glyph + plain "1. 2. 3. 4." numbering (Round 3, "Puzzle 3")
- Round type: queens-board
- **Palette (muted, low-saturation greyscale-tinted; 5 colours):**
  - R1 `#C97B6F` (muted brick)
  - R2 `#C9A372` (muted ochre)
  - R3 `#7FA593` (muted sage)
  - R4 `#7B92A5` (muted slate)
  - R5 `#9483A8` (muted plum)
- **Glyph:** 👑 (U+1F451 CROWN).
- **Rule-numbering style:** plain numerals "1. 2. 3. 4." — the visual maturity step graduates the surface to a final, less-decorated form.
- **Difficulty knob:** "mastery" geometry — regions are highly irregular (one region of size 2 forcing a tightly-constrained queen, two regions interlock such that diagonal-touch is the load-bearing rule). Solution requires ≥ 3 explicit deductions; pure trial-and-error WILL exhaust lives.
- **Expected solve time:** 3–7 minutes.
- **Target first-solve rate:** ~40 % (Stage 3 is the mastery gate; only students who genuinely reason through marks should clear it).

### Stage summary

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Grid size | 5×5 | 5×5 | 5×5 |
| Queens | 5 | 5 | 5 |
| Regions | 5 | 5 | 5 |
| Palette family | Vivid | Pastel | Muted |
| Glyph | ♛ (U+265B) | 👑 (U+1F451) | 👑 (U+1F451) |
| Rule numbering | 1️⃣ 2️⃣ 3️⃣ 4️⃣ | 1️⃣ 2️⃣ 3️⃣ 4️⃣ | 1. 2. 3. 4. |
| Region geometry | Large rectangular blobs | Mid-irregular, one L-shape | Highly irregular, ≥ 1 size-2 region |
| Deductions required | 1–2 | 2–3 | ≥ 3 |
| Expected solve time | 1–3 min | 2–5 min | 3–7 min |
| Target first-solve rate | ~80 % | ~60 % | ~40 % |
| Cognitive demand | First exposure | Mid-stretch | Mastery gate |

**Round-set cycling (MANDATORY):** The runtime round-set-cycles `fallbackContent.rounds`. A student plays Set A on first attempt, Set B after Try-Again / Play-Again, Set C on the next restart, then back to A. The spec authors **three full sets (A, B, C) × 3 rounds each = 9 round objects total**. Each set has different region partitions and a different unique canonical solution per puzzle, but parallel difficulty (Set A's Stage-1 puzzle ≈ Set B's Stage-1 puzzle ≈ Set C's Stage-1 puzzle in deduction count and expected solve time). Each round object carries `set: 'A' | 'B' | 'C'`. `setIndex` rotates on restart and persists across restarts within the session — it is NOT cleared in `resetGameState`. (See "Lives semantics" below for the parallel rule on lives.)

## Game Parameters
- **Rounds:** 3 per session (one puzzle per stage).
- **totalRounds:** 3.
- **Timer:** None (`timer: false`). L4 Analyze deserves deliberation; concept explicitly states no timer. PART-006 NOT included.
- **Lives:** 2 — **shared across the whole 3-puzzle session, not per round.** This is non-standard. `totalLives: 2`. A wrong placement on Puzzle 1 carries over: a student who burns 1 life on Puzzle 1 starts Puzzle 2 with 1 life remaining. If lives reach 0 mid-session (in Puzzle 1, 2, or 3), the session ends in Game Over regardless of how many puzzles were solved.
- **Lives semantics (explicit):**
  - Lives are decremented ONLY on attacking placements. Mark/unmark, cycle-back-to-empty, and Reset-Puzzle do NOT cost lives.
  - Lives are NOT refunded between puzzles.
  - Lives are NOT refunded on Reset-Puzzle.
  - Lives ARE reset to 2 on Try-Again / Play-Again (full session restart).
- **retryPreservesInput:** N/A (multi-round game; multi-round Try-Again uses TransitionScreen retry — see PART-050 Try Again flow).
- **autoShowStar:** `true` (default end-of-game beat handled by PART-050 / Stars Collected onMounted).
- **Star rating:** see "Scoring" below.
- **Input:** Tap-to-toggle (P8) on grid cells; tap on Reset-Puzzle button. No drag, no keyboard, no submit button.
- **Feedback:** FeedbackManager (PART-017). Per-placement constraint validation. Per-puzzle solve celebration. Per-session Game Over only if lives reach 0.
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships). The 3-slide carousel at end-of-game shows each puzzle's solved state — the correct 5-cell queen placement on the 5×5 coloured board, with each queen drawn at its solved position. (See "AnswerComponent payload shape" below for the per-round `answer` schema.)

## Scoring
- **Points:** +1 per puzzle solved. A puzzle is "solved" iff all 5 queens are placed satisfying all four rules (i.e. the student successfully completes Puzzle N before lives reach 0). Max 3 points per session.
- **Stars (creator-specified, NOT default 90/66/33):**
  - **3⭐** = all 3 puzzles solved AND both lives still intact at end-of-session (perfect run).
  - **2⭐** = all 3 puzzles solved with 0 or 1 lives intact, **OR** 2 puzzles solved (regardless of lives).
  - **1⭐** = exactly 1 puzzle solved.
  - **0⭐** = no puzzles solved.
- **Lives:** 2, shared across the session. Lost on attacking placement only. At 0 → Game Over screen.
- **Partial credit:** None. Each puzzle is binary (solved / not solved). The "lives intact" component of 3⭐ is a generosity-tightening conjunction — see Star Generosity Audit.

### Star Generosity Audit

(Authored per spec-creation skill expectation that L4 mastery games not give 3⭐ for free. Heuristic: 3⭐ should require demonstrated mastery — not survival.)

| Outcome scenario | Puzzles solved | Lives at end | Stars (per spec) | Generosity verdict |
|------------------|---------------|--------------|------------------|--------------------|
| Solved all 3, never attacked | 3 | 2 | **3⭐** | TIGHT — perfect-run only. Correct for L4 mastery. |
| Solved all 3, lost 1 life total | 3 | 1 | **2⭐** | TIGHT — one mistake demotes from 3⭐. Reflects L4 mastery vs L4 survival distinction. |
| Solved all 3, lost both lives but never reached 0 (i.e. 2 attacking placements that didn't end the game) | 3 | 0 | **2⭐** | TIGHT — same as above. |
| Solved 2, never reached 0 lives (game ran out of puzzles or Try-Again pulled mid-Puzzle 3) | 2 | any | **2⭐** | NEUTRAL — 2/3 puzzles is meaningful progress, 2⭐ is fair. |
| Solved 2, then 0 lives reached on Puzzle 3 | 2 | 0 | **2⭐** | NEUTRAL. |
| Solved 1, then 0 lives reached on Puzzle 2 or 3 | 1 | 0 | **1⭐** | NEUTRAL. |
| Solved 0, 0 lives reached on Puzzle 1 | 0 | 0 | **0⭐** | TIGHT — Game Over, 0 stars. Routes through `game_over` not `victory`. |

**Verdict:** The star rule is appropriately tight for L4 Analyze. 3⭐ requires both completion AND no errors — this is the standard L4 mastery bar. 2⭐ is the broad middle band (covers most successful sessions). 1⭐ acknowledges partial success. 0⭐ is reserved for the genuine no-progress case. **No generosity inflation detected.**

## Flow

**Shape:** Multi-round (default).

**Changes from default:**
- None.

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
│   ─ "Puzzle 1 of 3" + audio                                              │
│   ─ tap to begin                                                         │
│                                                                          │
│              │                                                           │
│              ▼                                                           │
│   Gameplay: Puzzle 1 (5×5)                                               │
│   ─ tap-to-toggle cells                                                  │
│   ─ on attack: SFX + TTS (rule named) + life lost                        │
│   ─ on solve: round-complete SFX + TTS                                   │
│   ─ if lives = 0: Game Over branch ──────────────┐                       │
│              │                                   │                       │
│              ▼                                   │                       │
│   Round 2 transition ─ "Puzzle 2 of 3"           │                       │
│              │                                   │                       │
│              ▼                                   │                       │
│   Gameplay: Puzzle 2 (5×5)                       │                       │
│              │                                   │                       │
│   if lives = 0 ──────────────────────────────────┤                       │
│              │                                   │                       │
│              ▼                                   │                       │
│   Round 3 transition ─ "Puzzle 3 of 3"           │                       │
│              │                                   │                       │
│              ▼                                   │                       │
│   Gameplay: Puzzle 3 (5×5)                       │                       │
│              │                                   │                       │
│   if lives = 0 ──────────────────────────────────┤                       │
│              │                                   │                       │
│              ▼                                   ▼                       │
│   Victory (TransitionScreen)              Game Over (TransitionScreen)   │
│   ─ stars rendered                        ─ "Tough puzzle! Try again."   │
│   ─ game_complete posted                  ─ game_complete posted         │
│   ─ AnswerComponent (3 slides)            ─ Try Again CTA                │
│   ─ Stars Collected screen                                               │
│   ─ Next CTA                                                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Feedback

| Event | Behavior |
|-------|----------|
| Mark / unmark / cycle empty | Soft tap SFX (fire-and-forget, ~50 ms). No sticker, no TTS, no input block. CASE 9. |
| Safe queen placement (no violation, board not solved) | Soft chime SFX (fire-and-forget, ~150 ms). Queen glyph scale-in animation. No TTS, no input block. |
| Attacking queen placement (≥ 1 violation) | `isProcessing = true` BEFORE any await. Wrong SFX awaited with sad sticker → awaited dynamic TTS naming the violated rule per priority (row > column > region > diagonal). Offending queens flash red ~600 ms. After audio: queen reverts to empty, life decrements with heart-pop animation. `isProcessing` cleared on next tick. CASE 7 (single-step). |
| Puzzle solved (all 5 queens correct) | Per-cell celebration glow propagates. Round-complete SFX awaited with celebration sticker → awaited dynamic TTS ("Brilliant! All five queens are safe.") → progressBar.update fires FIRST, then audio, then auto-advance to next round transition or Victory. CASE 6. |
| Reset Puzzle tapped | Soft confirm SFX (fire-and-forget). All marks/queens clear. Lives NOT refunded. No TTS, no input block. |
| Lives reach 0 mid-puzzle | Wrong-answer SFX completes first (CASE 8), THEN Game Over screen renders with `game_complete` posted before game-over audio. |
| All 3 puzzles solved (Victory) | Timer N/A. Results / Victory screen renders FIRST (stars, AnswerComponent carousel). `game_complete` posted BEFORE end-game audio. Then victory SFX + VO. CASE 11. |
| Stars Collected (after Victory) | `sound_stars_collected` awaited → `show_star` postMessage → setTimeout reveals Next via `floatingBtn.setMode('next')`. Per `default-transition-screens.md` § 4. |
| Try Again (from Game Over) | All audio stopped, all state resets including lives → 2, queens cleared, marks cleared, currentRound → 1, `setIndex` rotates A → B → C → A. Returns to Round 1 transition. CASE 13. |
| Tab switch / screen lock | Timer N/A. Static & stream audio paused. VisibilityTracker's PopupComponent renders the pause overlay (autoShowPopup default; do NOT build a custom overlay). CASE 14. |
| Tab restored | Audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues. CASE 15. |
| Audio failure (any audio call rejects) | Try/catch swallows; visual feedback (red flash, glyph reveal, sticker) still renders. Game continues. CASE 16. |

**Voice-line priority for attack feedback:**
When a queen placement violates more than one rule simultaneously (e.g. same row AND same diagonal), the TTS announces ONLY the highest-priority violated rule. Order: **row > column > region > diagonal.** Implementation: in the attack-detection function, check rules in this order and return the first hit; the TTS payload selects the matching rule string from the round's `rule_messages` map.

**Rule wording (Class 4–5 register, short and concrete):**
1. Two queens cannot be in the same row.
2. Two queens cannot be in the same column.
3. Two queens cannot be in the same coloured region.
4. Two queens cannot touch corners (no diagonal neighbour).

These four strings are stored in `fallbackContent` per round (under `rule_messages`) so they can be tweaked per set if needed without code changes; in practice all 9 rounds share the same wording.

## Content Structure (fallbackContent)

**Top-level fields:**
- `previewInstruction` — HTML, full instruction shown on PART-039 preview overlay.
- `previewAudioText` — plain-text narration for preview TTS (patched at deploy time).
- `previewAudio` — `null` (filled at deploy time by TTS pipeline).
- `showGameOnPreview` — `false` (puzzle should not be visible behind preview).
- `totalRounds` — `3`.
- `totalLives` — `2`. **Shared across the entire session, NOT per round.** No mid-session refund.
- `answerComponent` — `true` (default; not opted out).
- `rounds[]` — 9 round objects (3 sets × 3 rounds), with `set: 'A' | 'B' | 'C'` on every entry.

### Per-round payload shape

Each round object carries the data needed to render one puzzle and validate placements:

```js
{
  set: 'A' | 'B' | 'C',
  id: 'A_r1_p1' | 'A_r2_p2' | 'A_r3_p3' | 'B_r1_p1' | ... ,  // globally unique
  round: 1 | 2 | 3,                  // round index within a set
  stage: 1 | 2 | 3,                  // === round (one stage per round)
  type: 'queens-board',
  size: 5,                            // grid is always 5×5
  // 5×5 region map: regions[r][c] is an integer 0..4 naming the coloured region of cell (r, c).
  // Authored by hand and verified at build time to admit exactly one valid queen placement.
  regions: [[0,0,1,1,2],
            [0,0,1,2,2],
            [0,3,3,2,2],
            [3,3,4,4,2],
            [3,3,4,4,4]],
  // Cosmetic skin per stage. paletteHex carries the 5 hex strings indexed 0..4 to match `regions`.
  paletteHex: ['#E63946','#F4A261','#F1C453','#2A9D8F','#3D8BFD'],
  glyph: '♛',                    // '♛' for stage 1 ; '👑' for stages 2-3
  ruleNumberingStyle: 'emoji' | 'plain',
  ruleMessages: {
    row:      'Two queens cannot be in the same row.',
    column:   'Two queens cannot be in the same column.',
    region:   'Two queens cannot be in the same coloured region.',
    diagonal: 'Two queens cannot touch corners (no diagonal neighbour).'
  },
  // Pre-validated unique solution. Each entry is the column index of the queen in that row.
  // e.g. solution: [1, 3, 0, 2, 4] places queens at (0,1),(1,3),(2,0),(3,2),(4,4).
  solution: [1, 3, 0, 2, 4],
  // The same solution as an array of {r,c} pairs. Authored redundantly for AnswerComponent
  // convenience; build-time validator asserts solution and answer.queens describe the same set.
  answer: {
    queens: [
      { r: 0, c: 1 }, { r: 1, c: 3 }, { r: 2, c: 0 },
      { r: 3, c: 2 }, { r: 4, c: 4 }
    ]
  },
  // Misconception tags for each constraint type. Used by recordAttempt to record WHICH rule
  // the student violated on each attacking placement (one tag per attack event).
  misconception_tags: {
    row:      'row-constraint-overlooked',
    column:   'column-constraint-overlooked',
    region:   'region-constraint-overlooked',
    diagonal: 'diagonal-adjacency-overlooked'
  }
}
```

**Misconception tags (named, real misconceptions for multi-constraint reasoning at L4):**
- `row-constraint-overlooked` — student placed two queens in the same row; failed to track row-coverage as queens accumulate.
- `column-constraint-overlooked` — student placed two queens in the same column; failed to track column-coverage.
- `region-constraint-overlooked` — student placed two queens in the same coloured region; misread or did not register region boundaries.
- `diagonal-adjacency-overlooked` — student placed a queen diagonally adjacent to an existing queen; the diagonal-touch rule is the most commonly missed constraint at first exposure.

(Each attacking placement records one of these four tags, selected by the rule that fired in priority order — i.e. an attack that violates row-AND-diagonal records `row-constraint-overlooked` because row > diagonal in priority.)

### Round-set cycling — 9 round objects total

The spec authors **three full sets (A, B, C) × 3 rounds = 9 round objects**. The build step copies these verbatim into `fallbackContent.rounds`. Each set has different region partitions and a different unique solution per puzzle, but parallel difficulty (Set A's Stage-1 ≈ Set B's Stage-1 ≈ Set C's Stage-1 etc.). Build-time validator (exhaustive search) asserts each `regions` partition admits exactly one valid 5-queen placement equal to the round's `solution`.

```js
const fallbackContent = {
  previewInstruction:
    '<p>Place 5 queens on the coloured grid so that:</p>' +
    '<ol>' +
      '<li>No two queens are in the same row.</li>' +
      '<li>No two queens are in the same column.</li>' +
      '<li>No two queens are in the same coloured region.</li>' +
      '<li>No two queens touch corners (no diagonal neighbour).</li>' +
    '</ol>' +
    '<p>Tap a cell to mark it with ✖, tap again to place a queen, tap once more to clear. ' +
    'Marks are free. You have <b>2 lives</b> across all 3 puzzles.</p>',
  previewAudioText:
    'Place five queens on the coloured grid so no two share a row, a column, ' +
    'a coloured region, or touch corners. Tap a cell to mark it with a cross, ' +
    'tap again to place a queen. You have two lives across all three puzzles.',
  previewAudio: null,
  showGameOnPreview: false,
  totalRounds: 3,
  totalLives: 2,                     // shared across the whole session
  answerComponent: true,

  rounds: [
    // ── Set A — 3 rounds ──
    { set: 'A', id: 'A_r1_p1', round: 1, stage: 1, type: 'queens-board', size: 5,
      // Stage-1 vivid palette, large rectangular regions; pre-validated unique solution.
      regions:  /* hand-authored 5x5, vivid Stage-1 layout — see Pre-Generation §A.1 */ null,
      paletteHex: ['#E63946','#F4A261','#F1C453','#2A9D8F','#3D8BFD'],
      glyph: '♛', ruleNumberingStyle: 'emoji',
      ruleMessages: { row: 'Two queens cannot be in the same row.',
                      column: 'Two queens cannot be in the same column.',
                      region: 'Two queens cannot be in the same coloured region.',
                      diagonal: 'Two queens cannot touch corners (no diagonal neighbour).' },
      solution: /* [c0..c4] — unique pre-validated */ null,
      answer:   { queens: /* matching {r,c} list */ null },
      misconception_tags: { row: 'row-constraint-overlooked',
                            column: 'column-constraint-overlooked',
                            region: 'region-constraint-overlooked',
                            diagonal: 'diagonal-adjacency-overlooked' }
    },
    { set: 'A', id: 'A_r2_p2', round: 2, stage: 2, type: 'queens-board', size: 5,
      regions:  /* hand-authored Stage-2 layout, mid-irregular — Pre-Generation §A.2 */ null,
      paletteHex: ['#FFB3B3','#FFD6A5','#FDFFB6','#CAFFBF','#9BF6FF'],
      glyph: '👑', ruleNumberingStyle: 'emoji',
      ruleMessages: { /* same as above */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same as above */ }
    },
    { set: 'A', id: 'A_r3_p3', round: 3, stage: 3, type: 'queens-board', size: 5,
      regions:  /* hand-authored Stage-3 layout, highly irregular — Pre-Generation §A.3 */ null,
      paletteHex: ['#C97B6F','#C9A372','#7FA593','#7B92A5','#9483A8'],
      glyph: '👑', ruleNumberingStyle: 'plain',
      ruleMessages: { /* same as above */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same as above */ }
    },

    // ── Set B — 3 rounds (parallel difficulty to Set A; different regions / solutions) ──
    { set: 'B', id: 'B_r1_p1', round: 1, stage: 1, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §B.1 */ null,
      paletteHex: ['#E63946','#F4A261','#F1C453','#2A9D8F','#3D8BFD'],
      glyph: '♛', ruleNumberingStyle: 'emoji',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    },
    { set: 'B', id: 'B_r2_p2', round: 2, stage: 2, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §B.2 */ null,
      paletteHex: ['#FFB3B3','#FFD6A5','#FDFFB6','#CAFFBF','#9BF6FF'],
      glyph: '👑', ruleNumberingStyle: 'emoji',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    },
    { set: 'B', id: 'B_r3_p3', round: 3, stage: 3, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §B.3 */ null,
      paletteHex: ['#C97B6F','#C9A372','#7FA593','#7B92A5','#9483A8'],
      glyph: '👑', ruleNumberingStyle: 'plain',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    },

    // ── Set C — 3 rounds (parallel difficulty to Set A; different regions / solutions) ──
    { set: 'C', id: 'C_r1_p1', round: 1, stage: 1, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §C.1 */ null,
      paletteHex: ['#E63946','#F4A261','#F1C453','#2A9D8F','#3D8BFD'],
      glyph: '♛', ruleNumberingStyle: 'emoji',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    },
    { set: 'C', id: 'C_r2_p2', round: 2, stage: 2, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §C.2 */ null,
      paletteHex: ['#FFB3B3','#FFD6A5','#FDFFB6','#CAFFBF','#9BF6FF'],
      glyph: '👑', ruleNumberingStyle: 'emoji',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    },
    { set: 'C', id: 'C_r3_p3', round: 3, stage: 3, type: 'queens-board', size: 5,
      regions:  /* Pre-Generation §C.3 */ null,
      paletteHex: ['#C97B6F','#C9A372','#7FA593','#7B92A5','#9483A8'],
      glyph: '👑', ruleNumberingStyle: 'plain',
      ruleMessages: { /* same */ },
      solution: null, answer: { queens: null },
      misconception_tags: { /* same */ }
    }
  ]
};
```

**Pre-Generation step (game-planning Step 3):** Before Step 4 (Build), the orchestrator generates the 9 `regions` partitions and their unique solutions and writes them into `games/queens/pre-generation/regions.md`. Each partition is verified by exhaustive search (a 5×5 board with the 4 constraints has a tiny search space — 5! = 120 row-permutations × column-checks — that completes in microseconds). The build step in Step 4 inlines the resulting tables into `fallbackContent.rounds`.

### AnswerComponent payload shape

Each round's `answer` is rendered by `renderAnswerForRound(round, container)` as a non-interactive 5×5 board:
- The board is painted with the round's `paletteHex` according to `regions`.
- The 5 queen glyphs (round's `glyph`) are placed at each `answer.queens[i]` position.
- No tap handlers, no ✖ marks, no lives indicator — pure solved-state visual recap.
- Cells NOT containing a queen render plain (no glyph).
- The carousel shows 3 slides (one per stage). Slide title: "Puzzle 1 — Vivid", "Puzzle 2 — Pastel", "Puzzle 3 — Muted". Slide subtitle (small, optional): "Two queens cannot touch corners — that's the rule most students miss." (or similar — one-liner per stage focusing on the load-bearing rule for that stage's geometry).

## Visual / Theme

- **Layout:** PART-021 standard mobile layout. Header (lives + puzzle counter) on top, board centered, Reset button below board.
- **Board sizing on a 375 px-wide viewport:** with 16 px outer padding, 343 px is available for the board. A 5×5 grid means ~68 px cells with 0 px gap, or ~65 px cells with 1 px gridline. **Both clear the 44 px touch-target minimum with generous margin (>20 px headroom).** Region boundaries render as 1 px coloured gridlines so region shapes read clearly without sacrificing hit area.
- **Cell hit area:** the entire cell is the tap target. No nested tap target inside the cell.
- **Glyph rendering:** ♛ (U+265B) and 👑 (U+1F451) both have native fallbacks on Android and iOS. Test on a real budget Android (Pixel 4a or equivalent). Fallback: if 👑 fails to render as colour-emoji on a particular device, both stages 2 and 3 fall back to ♛ (the spec author allows this graceful degradation; the visual graduation is then carried by the palette-only).
- **Mark glyph:** ✖ (U+2716 HEAVY MULTIPLICATION X) rendered at ~40 % cell width in dark grey (`#444`). High-contrast, region-colour-agnostic.
- **Constraint-violation flash:** offending queens flash red (`#E63946`) at full opacity for 600 ms (3 cycles of 200 ms ease-in-out). NOT continuous animation — momentary feedback only (mobile rule #14).
- **Region boundary lines:** thin (1 px) in `--mathai-color-border` between cells of different regions. Same-region cells have NO inner border.
- **Reset button:** PART-022 secondary style, ~120 px wide × 44 px tall, below the board. Tappable, never obscured by Floating Button (we are not using PART-050 — see below).
- **Lives indicator:** 2 hearts in the header. Filled hearts for remaining lives, outline for spent. Heart-pop animation on life loss (~400 ms).
- **No FloatingButton (PART-050):** the game has no Submit / Check / Done CTA — placement auto-validates, solve auto-detects, and round-advance is automatic on solve. PART-050 is therefore NOT included in the PART flag set. **However**, end-of-game still posts `next_ended` per the standard archetype-6-without-FloatingButton path: TransitionScreen's onDismiss fires `show_star`, then `floatingBtn.setMode('next')` is replaced with the TransitionScreen Next CTA (per default-transition-screens.md § 4 Stars Collected). Validator note: archetype 6 lists PART-050 as conditional ("if spec's flow has an explicit Check CTA — auto-detect-on-solve variants skip it"); we are the auto-detect variant.
- **Mobile compliance:** all rules in mobile/SKILL.md apply. `viewport meta` correct, `100dvh`, `overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: manipulation` on all cells and the Reset button, `-webkit-` prefixes paired with standard properties, no `gap` on flex (margin-based spacing or grid `gap` only).

## Out of Scope

- **No procedural region generation** — partitions are pre-validated and hand-authored; the build step inlines them. Future work: a build-time generator that produces and uniqueness-validates new region partitions per session.
- **No hints** — the creator explicitly says "no hints". The ✖ mark IS the hint mechanism (student-driven externalisation), not an LLM-generated hint.
- **No undo of past attacks** — once a life is lost, it stays lost until Try-Again. (Reset Puzzle clears the board but does not refund.)
- **No leaderboard / streak tracking across sessions** — single-session game.
- **No timer / speed scoring** — L4 deserves deliberation. PART-006 NOT included.
- **No drag-and-drop variant** — interaction pattern is locked to P8 click-to-toggle. (A drag variant would require placing queens by dragging from a "queen pool"; out of scope.)
- **No multiplayer / two-player race** — single player only.
- **No region-colour personalization** — palettes are fixed per stage.
- **No sound mute / volume controls beyond the platform-standard mute toggle** — handled by FeedbackManager and the harness.

## Decision-Points / Open Items

(For the creator and spec-review to confirm before Step 4 / Build.)

1. **Lives = 2 SHARED across whole session is non-standard.** The default for L4 is "None or 5"; archetype 6 (Board Puzzle) defaults to 0. The creator explicitly chose 2 shared. **Confirm:** keep 2 shared (the L4 mastery framing supports a tight life budget). Spec-review should verify this is intentional and not a typo for "2 per puzzle".
2. **Region partitions are hand-authored, not generated.** We need 9 unique-solution 5×5 partitions (3 per stage × 3 sets) of varying difficulty. The `pre-generation/` step (game-planning Step 3) must produce these and write them to `games/queens/pre-generation/regions.md` BEFORE Step 4. **Confirm:** this is acceptable, and that the parallel-difficulty constraint across sets is enforceable (i.e. Set A's Stage-1 puzzle ≈ Set B's Stage-1 ≈ Set C's Stage-1 in deduction count).
3. **Glyph fallback for 👑 on devices without colour emoji.** Spec author proposes graceful fallback to ♛ for stages 2–3 if 👑 fails to render. **Confirm:** acceptable, or should the build force a webfont (e.g. Twemoji) to guarantee the crown renders cross-device?
4. **AnswerComponent slide subtitle.** Spec author proposes a one-liner per stage focusing on the load-bearing rule for that stage's geometry (e.g. Stage 3 subtitle: "Two queens cannot touch corners — that's the rule most students miss."). **Confirm:** acceptable wording, or should the subtitle be neutral / mechanical ("Stage 3 — muted palette" only)?
5. **Stage-1 first-solve target is 80 %.** This is the on-ramp; we want most students to clear Puzzle 1. **Confirm:** acceptable target. If gauge data shows < 60 % during pilot, Stage 1 difficulty should be reduced (region geometry simplified further).
6. **Star rule conjunction (3⭐ requires both 3-of-3 AND 2 lives intact).** This is creator-specified and tighter than the default 90/66/33 thresholds. **Confirm:** the tight 3⭐ bar is appropriate for L4 mastery (the spec author thinks yes — see Star Generosity Audit).
7. **No PART-050 FloatingButton** — flow auto-evaluates on placement, no Submit CTA. **Confirm with build step:** archetype 6 lists PART-050 as conditional; we are skipping it. End-of-game Next CTA is the TransitionScreen's own button per default-transition-screens.md § 4. Validator should NOT trip GEN-FLOATING-BUTTON-NEXT-MISSING because we are not using FloatingButton anywhere in the flow.

## Defaults Applied

(Decisions NOT specified by the creator and filled by a default. Per spec-creation Step 3, `answerComponent` is silently `true` and is NOT listed here.)

- **Grid size 5×5 (down from concept's 7×7):** explicit creator instruction during this iteration ("make the grid size simple enough for 4-5 grade kid, like 4×4 or 5×5"). Spec author chose 5×5 over 4×4 because 4×4 is too constrained for a 4-queen + region + diagonal puzzle (very few unique-solution partitions exist). 5×5 is the smallest size that comfortably admits 9 distinct interesting partitions across three stages.
- **Pre-generation step:** defaulted to "hand-authored partitions, build-time exhaustive uniqueness check" (creator did not specify how the 9 region partitions are produced).
- **Stage-1 / 2 / 3 expected solve times:** defaulted to 1–3, 2–5, 3–7 minutes respectively (creator specified no timer and "deliberation"; spec author provides ranges so testing has a target band, calibrated to the smaller 5×5 board).
- **First-solve rate targets per stage (80 / 60 / 40 %):** defaulted by spec author per pedagogy.md L4 70–85 % overall target tightened by stage to reflect mastery progression. Bumped Stage-1 target up from 75 % to 80 % to reflect the easier 5×5 board.
- **Mark glyph (✖, U+2716):** defaulted (creator said "✖" as a glyph; spec author picked U+2716 specifically for its bold appearance).
- **Reset Puzzle button placement:** defaulted to "below the board, secondary style, 120 × 44 px" (creator said "reset per puzzle clears marks/queens but does not refund lives" — placement was unspecified).
- **AnswerComponent slide subtitle wording:** defaulted to "load-bearing rule of the stage" (see Decision-Points #4).
- **Heart-pop animation on life loss:** defaulted to ~400 ms (creator specified "voice line on attack" but not the visual animation).
- **`autoShowStar`:** defaulted to `true` (creator did not specify; PART-050 standard is true).
- **`previewScreen`:** defaulted to `true` (creator did not specify; PART-039 standard is true).
- **Bloom level L4:** explicitly stated by the creator. NOT defaulted.
- **Lives = 2 shared:** explicitly stated by the creator. NOT defaulted.
- **No timer:** explicitly stated by the creator. NOT defaulted.
- **Star rule (3 / 2 / 1 / 0):** explicitly stated by the creator. NOT defaulted.

## Warnings

- **WARNING: Grid resized from concept's 7×7 to 5×5 for grade-appropriateness.** The creator's revision instruction during spec drafting was "make the grid size simple enough for 4-5 grade kid, like 4×4 or 5×5". 5×5 was chosen as the more puzzle-rich of the two options. All cell counts (queens=5, regions=5, palette colours=5) and dimensions follow from this. The mechanical and pedagogical character of the game is preserved.
- **WARNING: Lives are SHARED across the entire session, not per puzzle.** This is non-standard for archetype 6 (Board Puzzle defaults to lives = 0) and for L4 (defaults to "None or 5"). The creator explicitly specified "Lives = 2 shared". Spec-review must confirm this is intentional and that the build step's `gameState.lives` variable is decremented at the session level (not reset between rounds). In particular, `resetGameState()` (the per-round reset called between Puzzle 1 → 2 and 2 → 3) MUST NOT touch `lives`. Lives are only reset on full session restart (Try-Again / Play-Again).
- **WARNING: Star rule does not match the platform default 90/66/33 % thresholds.** The creator specified a custom rule (3⭐ = 3 puzzles + 2 lives intact; 2⭐ = 3 + 0–1 lives OR 2 puzzles; 1⭐ = 1 puzzle; 0⭐ = none). This is creator intent and the Star Generosity Audit confirms it is tight-but-fair for L4. Build step must implement `getStars()` per these exact rules — not the default thresholds.
- **WARNING: Region partitions are hand-authored — they are a content dependency.** If the pre-generation step is skipped or its output is incomplete, the game cannot ship. Step 4 (Build) must read `games/queens/pre-generation/regions.md` and inline the 9 partitions; if the file is missing, fail fast with a clear error.
- **WARNING: Glyph 👑 (U+1F451) is a colour emoji.** On devices without colour-emoji support, it may render as a black-and-white outline or a missing-glyph box. The spec author proposes graceful fallback to ♛ for stages 2–3 (see Decision-Points #3). If the creator wants guaranteed visual graduation, the build step should embed a Twemoji webfont — but that adds ~50 KB to the HTML and requires a network round-trip on first load (mobile rule #29: HTML under 500 KB is ADVISORY).
- **WARNING: Voice-line priority order (row > column > region > diagonal) is creator-specified.** Spec-review must confirm. A common alternative ordering would be "diagonal first" (because it is the load-bearing rule that students miss most often) — but creator chose row-first, which matches reading order and is more predictable for the student.
- **WARNING: No PART-050 FloatingButton.** Per archetype 6 (Board Puzzle), PART-050 is conditional on having a Check CTA; we have none (auto-detect-on-solve variant). The end-of-game Next is owned by the Stars Collected TransitionScreen's own CTA per default-transition-screens.md § 4. Validator GEN-FLOATING-BUTTON-NEXT-MISSING should NOT trip because we never call `floatingBtn` anywhere in the flow. Spec-review should confirm this is the right interpretation.
- **WARNING: No procedural generation — same 3 sets (A/B/C) cycle forever.** A determined student who plays through 4+ times will see Set A again. This is acceptable for a 3-puzzle session at L4 (replay value is bounded by archetype design, not session length). If a future iteration wants procedural generation, see Out-of-Scope.
