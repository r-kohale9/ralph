# Pre-Generation Plan: Cross Numbers Puzzle

**Game ID:** cross-numbers
**Archetype:** Board Puzzle (#6) — Shape 2 (Multi-round)
**Bloom:** L4 Analyze
**Interaction:** Tap-cell then tap-digit (P01 + P02 composite). No drag.
**Rounds:** 3 (one per variant — B1, B2, B3)
**Lives:** None
**Timer:** None
**PreviewScreen:** YES (mandatory per PART-039)

---

## 1. Screen Flow

```
PreviewScreen wrapper (persistent: header bar + progress-bar slot)
   │
   ▼
Preview overlay (instruction + audio + skip CTA)
   │ skip / audio-end
   ▼
Round 1 transition ("Puzzle 1", sticker, rounds_sfx) — auto-advance
   │
   ▼
Gameplay Round 1 (data-phase="gameplay")
   • Rules panel (3 rules)
   • Cross grid (14 cells, dashed borders, number-labels in margin)
   • Digit pool (14 digits, 4+4+4+2 or 4+4+4+1 keypad)
   • CHECK button (disabled until every cell is filled)
   │ tap CHECK (grid full)
   ▼
Whole-grid validator runs:
   • each number: no internal repeats
   • each number: tens × ones = 24
   • N1: digit sum == targetSum AND N1 exactly matches stored greatest solution
   │
   ├── all satisfied → Correct feedback (green flash, SFX, TTS, recordAttempt) → advance
   └── any violated → Wrong feedback (red on conflict cells, SFX, TTS,
                     CHECK→NEXT, solution-reveal, recordAttempt) → advance on NEXT or auto
   │
   ▼
Round 2 transition ("Puzzle 2") → Gameplay Round 2 → Validate → ...
   │
   ▼
Round 3 transition ("Puzzle 3") → Gameplay Round 3 → Validate
   │
   ▼
Victory screen (stars 0..3, CTA: Play Again / Claim Stars)
   │
   ├── Play Again (stars<3) → Motivation → restartGame (no preview, no welcome)
   └── Claim Stars → Stars Collected → game_exit postMessage → endGame
```

**Shape:** Shape 2 Multi-round.

**Changes from canonical default:**
1. No Game Over branch (lives = 0).
2. Wrong answer does not loop back — CHECK→NEXT, brief solution reveal, advance.
3. Submit is an explicit CHECK button (disabled until grid is full).

**Entry/exit triggers:**

| Screen | data-phase | Entry | Exit |
|---|---|---|---|
| PreviewScreen (preview state) | `start` | DOMContentLoaded → setupGame → previewScreen.show() | skip / audio-finish → onComplete → startGameAfterPreview |
| PreviewScreen wrapper | — | startGameAfterPreview | endGame → previewScreen.destroy |
| Round N transition | `round_intro` | before each round (N=1..3) | rounds_sfx completion + ~900ms |
| Gameplay | `gameplay` | transition auto-complete → renderRound | CHECK tap with grid full |
| Inline correct feedback | `gameplay` | validator pass | auto ~1500ms |
| Inline wrong feedback | `feedback_wrong` | validator fail | NEXT tap OR auto ~3500ms |
| Victory | `results` | after round 3 feedback | Claim Stars → Stars Collected; Play Again → Motivation |
| Stars Collected | `results` | Claim Stars | auto 2500ms → endGame + game_exit |
| Motivation | `results` | Play Again | "I'm ready" → restartGame |

---

## 2. Round-by-Round Breakdown

Three rounds, same geometry, different pool and target solution (see `spec.md` § Content Structure).

| Round | Variant | Pool size | Target sum | Stored N1 | Distinctness |
|-------|---------|-----------|------------|-----------|--------------|
| 1 | B1 | 14 | 28 | 97183 | all 6 numbers' digits distinct within each number |
| 2 | B2 | 14 | 28 | 98164 | same |
| 3 | B3 | 14 | 28 | 97138 | same |

Each round presents the SAME rules panel (3 rules) and SAME grid shape; only `pool` and `solution` change.

### Cell & number geometry (fixed across all 3 rounds)

Coordinate grid (5 rows × 4 columns), with active cells only at these positions:

```
  col:     0     1     2     3
  r1:            [·]   [·]   [·]      ← row 1: N4
  r2:            [·]   [·]   [·]      ← row 2: N5
  r3:            [·]   [·]   [·]      ← row 3: (no horizontal — just spacers for N1, N2, N3)
  r4:     [·]   [·]   [·]   [·]       ← row 4: N6 (extends one cell left)
  r5:            [·]                  ← row 5: N1 bottom only

  Verticals:
    N1 (col 1): r1,r2,r3,r4,r5 — 5 cells
    N2 (col 2): r1,r2,r3,r4   — 4 cells
    N3 (col 3): r1,r2,r3,r4   — 4 cells
  Horizontals:
    N4 (row 1): c1,c2,c3       — 3 cells
    N5 (row 2): c1,c2,c3       — 3 cells
    N6 (row 4): c0,c1,c2,c3    — 4 cells (leftmost = unique to N6)
```

Total distinct cells = 14.

Number labels in margins (rendered OUTSIDE the cells):
- N1 label above r1c1 (top of col 1).
- N2 label above r1c2 (top of col 2).
- N3 label above r1c3 (top of col 3).
- N4 label to the left of r1c1 (left of row 1).
- N5 label to the left of r2c1 (left of row 2).
- N6 label to the left of r4c0 (left of row 4, leftmost cell).

Reading order: verticals = top→bottom, horizontals = left→right. Tens digit is the second-to-last cell, ones is the last cell.

### Digit pool rendering

Pool laid out as a keypad below the grid. 14 digits arranged as 4 columns, 3 rows of 4 + 1 row of 2 (or similar). Each digit button is a white rounded square (~44×44px). When a digit is placed in a cell, its pool button dims (`opacity: 0.3`, `pointer-events: none`). Returning a digit to the pool re-enables the matching pool position (first available position of that value).

Pool state tracking: `gameState.poolAvailable` is an array of 14 objects `{ idx, value, available: true|false }`. When placing a digit of value V in a cell, mark the first `{value: V, available: true}` position as `available: false`. When clearing a cell, mark the first `{value: V, available: false}` of that value back to `available: true`.

### Cell interaction state

- `gameState.focusedCell`: cell id (e.g., `'r3c2'`) or null.
- `gameState.cellValues`: map of cellId → digit value (number 0-9) or null.
- `gameState.isGridFull`: boolean, derived each placement.

Interaction table:

| User action | Effect |
|---|---|
| Tap empty cell | Set focusedCell. Render blue focus border. |
| Tap filled cell | Set focusedCell (same visual). |
| Tap focused cell again | No-op (keep focus). |
| Tap pool digit (available) while cell focused, cell empty | Place digit in cell. Mark pool slot unavailable. Play `sound_bubble_select`. |
| Tap pool digit (available) while cell focused, cell already filled | Replace: clear current cell value (return old digit's first-matching pool slot to available), place new digit (mark its slot unavailable). |
| Tap pool digit (available) whose value == focused cell's current value | Clear focused cell, return digit to pool. Play `sound_bubble_deselect`. |
| Tap pool digit (not available) | No-op. |
| Tap CHECK (enabled — grid full) | Run validator. |

---

## 3. Scoring and Lives

- Points = count of first-CHECK solves.
- Stars:
  - 3 stars = all 3 rounds solved on first CHECK
  - 2 stars = 2/3 solved on first
  - 1 star = 1/3 solved on first
  - 0 stars = 0 solved on first (still reaches Results)
- No lives, no game-over.

`gameState.firstCheckSolves` is incremented only on correct first CHECK for each round. Wrong CHECKs do not loop; student still reaches Results after 3 rounds.

---

## 4. Feedback Patterns (per skill/feedback/SKILL.md)

| Case | Event | Await? | Sticker | SFX | TTS |
|------|-------|--------|---------|-----|-----|
| Case 3 | Cell tapped | F&F | — | `tap_sound` | none |
| Case 3 | Pool digit placed | F&F | — | `sound_bubble_select` | none |
| Case 3 | Pool digit cleared | F&F | — | `sound_bubble_deselect` | none |
| Case 4 | Correct CHECK | awaited | `STICKER_CORRECT` | `correct_sound_effect` | F&F dynamic: "Brilliant! Every number checks out." |
| Case 5 | Wrong CHECK | awaited | `STICKER_WRONG` | `incorrect_sound_effect` | F&F dynamic: "Oh no! That's not right." |
| Case 9 | Round intro | awaited | `STICKER_ROUND` | `rounds_sound_effect` | none |
| Case 11 | Victory | awaited | stars-based sticker | `victory_sfx` or `game_complete_sfx` | awaited dynamic |
| Case 11 | Motivation | awaited | `STICKER_RESTART` | `rounds_sound_effect` | awaited dynamic |
| Case 11 | Stars collected | awaited | `STICKER_VICTORY` | `victory_sound_effect` | none |

Audio preload list: `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `victory_sound_effect`, `game_complete_sound_effect`, `tap_sound`, `sound_bubble_select`, `sound_bubble_deselect`, `new_cards`.

---

## 5. State Management

```js
var gameState = {
  gameId: 'cross-numbers',
  phase: 'start_screen',
  currentRound: 0,
  totalRounds: 3,
  score: 0,
  correctAnswer: null,        // per-round solution map
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  isProcessing: false,
  gameEnded: false,
  content: null,
  stars: 0,
  firstCheckSolves: 0,
  roundsCompleted: 0,
  roundStartTime: null,
  responseTimes: [],
  previewResult: null,
  // per-round state
  focusedCell: null,                // string cellId
  cellValues: {},                   // cellId → number
  poolAvailable: [],                // array of { idx, value, available }
  currentRoundData: null,
  isGridFull: false,
  validationResult: null,
  placementLog: [],                 // list of { ts, cellId, value, action }
  duration_data: { startTime, preview, attempts, evaluations, inActiveTime, totalInactiveTime }
};
```

`syncDOM` writes `data-phase`, `data-score`, `data-round` to `#app`.

---

## 6. Key Functions (expected surface)

- `waitForPackages()` (PART-003)
- `preloadAllAudio()`
- `handlePostMessage(evt)` (PART-008)
- `setupGame()` — inject HTML → renderInitialState → show preview LAST
- `injectGameHTML()` — rules panel + grid + pool + CHECK
- `renderInitialState()` — paint round 1 scaffold non-interactively
- `buildRoundDOM(round, interactive)` — populate rules, grid cells, pool digits
- `renderGridHTML(round)` — cross-shape layout with labels
- `renderPoolHTML(round)` — keypad layout
- `onCellTap(cellId)` — focus handler
- `onPoolTap(poolIdx)` — place/clear handler
- `evaluateGridFull()` — enables/disables CHECK
- `validateGrid(round)` — returns `{ pass, violatedNumberIds, conflictCellIds }`
- `validateNumber(num, cellValues, targetSum, storedSolution)` — per-number check
- `onCheckTap()` — entrypoint for submit
- `handleCorrectOutcome(round)` / `handleWrongOutcome(round, result)`
- `revealSolution(round)` — paint the stored greatest N1 solution briefly
- `advanceAfterFeedback()`
- `showRoundIntro(n)`, `enterGameplay(n)`, `renderRound()`
- `showVictory()`, `showMotivation()`, `showStarsCollected()`, `endGame(won)`, `restartGame()`
- `postGameComplete(won)` (recordAttempt + game_complete)
- `recordAttempt(params)`, `trackEvent(type, data)`
- `getStars()` — map firstCheckSolves to 0..3
- `window.startGame`, `window.nextRound`, `window.restartGame`, `window.endGame`, `window.solveCurrentRound` (debug)

---

## 7. Validator Detail

Input: `round` object + `gameState.cellValues` map.

Steps:
1. For each number N in `round.numbers`: extract its digit sequence by reading `cellValues[cellId]` in cell order. If any cell is null, validation fails with all cells conflict-flagged.
2. Per-number checks:
   - **No-repeat:** digits within the number are pairwise distinct.
   - **Product-24:** `tens = digits[len-2]`, `ones = digits[len-1]`. tens * ones == 24.
3. N1 sum check: sum of N1 digits == `round.targetSum`.
4. N1 greatest check: N1 numeric value (digits joined as integer) == `numericFromSolution(round.solution, round.numbers.N1.cells)`.
5. `conflictCellIds` = set union of cells from every number that failed any check.
6. `pass` iff all checks pass.

For the greatest check, the stored solution is the reference greatest value (hand-verified in spec).

---

## 8. Archetype confirmation

Confirms archetype #6 Board Puzzle:
- Structure: whole-board submit per round.
- Interaction: tap-based.
- Scoring: +1 per first-CHECK solve.
- Screens: `start` → `gameplay` → `results`. No `game_over` (no lives).
- PART flags: PART-001 (CDN core), PART-003 (waitForPackages), PART-004 (init), PART-005 (visibility), PART-007 (state), PART-008 (postMessage), PART-009 (recordAttempt), PART-010 (events), PART-017 (FeedbackManager), PART-019 (results), PART-021 (mobile), PART-023 (progress bar), PART-024 (transitions), PART-025 (screen layout), PART-027 (play area), PART-039 (preview screen), PART-042 (signals).

Confidence: HIGH (matches logic-seat-puzzle and other Board Puzzles shipped).
