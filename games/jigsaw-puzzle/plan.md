# Jigsaw Puzzle — Pre-Generation Plan

**One-liner:** Kid drags colored polyomino pieces from a bank onto an empty grid; pieces snap on valid fit, bounce back on invalid fit; 5 rounds across 3 stages of increasing grid size and complexity.

**Archetype:** P6 Drag-and-Drop (Pick & Place). **Shape:** 2 (Multi-round). **Rounds:** 5. **Lives:** none. **Timer:** none.

---

## 1. Screen Flow

```
Preview ──tap──▶ Welcome ──tap──▶ Round-N Intro ──auto(1500ms)──▶ Gameplay (Round N)
                                       ▲                              │
                                       │                              │ all pieces placed correctly
                                       │                              ▼
                                       │                        Round-Complete Feedback
                                       │                        (awaited SFX + "Puzzle complete!" TTS, 2000ms)
                                       │                              │
                                       └──── if N < 5 ────────────────┤
                                                                      │ if N == 5
                                                                      ▼
                                                               Victory (1-3 stars)
                                                                      │
                                                     ┌────────────────┼───────────────┐
                                                     │ "Play Again"                   │ "Claim Stars"
                                                     │ (only if <3★)                  ▼
                                                     ▼                       Stars-Collected transition
                                             "Ready to improve?"                     │ auto
                                             (tap → restart Round 1)                 ▼
                                                                                    exit
```

**No Game Over branch** — the game has no lives; wrong placements bounce back without penalty. Victory is always reached once the student completes Round 5.

### Screens enumerated
| # | Screen | Type | Buttons | Exit |
|---|--------|------|---------|------|
| 1 | Preview | splash | [Start] | tap Start → Welcome |
| 2 | Welcome | transition | [Let's Go] | tap → Round-1 Intro |
| 3 | Round-N Intro (N=1..5) | transition, no buttons | — | auto after 1500ms → Gameplay |
| 4 | Gameplay (Round N) | gameplay | — | all pieces placed → Round-Complete |
| 5 | Round-Complete Feedback | inline on gameplay screen | — | after 2000ms → next Round-N Intro OR Victory |
| 6 | Victory | transition | [Play Again] (if <3★), [Claim Stars] | tap |
| 7 | "Ready to improve your score?" | transition | [I'm ready] | tap → Gameplay Round 1 |
| 8 | "Yay, stars collected!" | transition, no buttons | — | auto after sound → exit |

---

## 2. Round-by-Round Breakdown

Coordinates are `(row, col)`, 0-indexed, row 0 = top, col 0 = left. Pieces have **fixed orientation** (no rotation). Each piece is listed with its target anchor cell on the grid and the set of cells it occupies (anchor cell first).

### Round 1 — Stage 1 (3×3 grid, 3 pieces, 3 cells each)
- **Grid:** 3 rows × 3 cols = 9 cells.
- **Target grid state:** all 9 cells filled, contiguous coverage.
- **Pieces:**
  | Piece | Color | Shape (cells, relative) | Target cells (absolute) |
  |-------|-------|-------------------------|-------------------------|
  | P1 | yellow (#FFD93D) | L-tromino: (0,0),(1,0),(1,1) | (0,0),(1,0),(1,1) |
  | P2 | purple (#8B5CF6) | I-tromino (horizontal): (0,0),(0,1),(0,2) | (0,1→0,2 blocked) → use (2,0),(2,1),(2,2) [bottom row] |
  | P3 | orange (#FB923C) | L-tromino mirrored: (0,0),(0,1),(1,1) | (0,1),(0,2),(1,2) |
- **Resolved target grid:**
  ```
  Y O O
  Y Y O
  P P P
  ```

### Round 2 — Stage 1 (3×3 grid, 3 pieces, 3 cells each)
- **Grid:** 3×3.
- **Pieces:**
  | Piece | Color | Shape (relative) | Target (absolute) |
  |-------|-------|------------------|-------------------|
  | P1 | yellow | I-tromino vertical: (0,0),(1,0),(2,0) | (0,0),(1,0),(2,0) |
  | P2 | purple | L-tromino: (0,0),(0,1),(1,1) | (0,1),(0,2),(1,2) |
  | P3 | orange | L-tromino: (0,0),(1,0),(1,1) | (1,1),(2,1),(2,2) — plus (2,1) covers… |
- **Resolved target grid (corrected to 9 cells):**
  ```
  Y P P
  Y . P
  Y O O  → adjust: P3 covers (1,1),(2,1),(2,2); final:
  Y P P
  Y O P
  Y O O
  ```
  Pieces: P1 yellow column 0; P2 purple (0,1),(0,2),(1,2); P3 orange (1,1),(2,1),(2,2). Total = 9.

### Round 3 — Stage 2 (4×3 grid, 3 pieces, 4 cells each)
- **Grid:** 4 rows × 3 cols = 12 cells.
- **Pieces (tetrominoes, fixed orientation):**
  | Piece | Color | Shape (relative) | Target (absolute) |
  |-------|-------|------------------|-------------------|
  | P1 | yellow | T-tetromino: (0,0),(0,1),(0,2),(1,1) | (0,0),(0,1),(0,2),(1,1) |
  | P2 | purple | S-tetromino: (0,1),(0,2),(1,0),(1,1) | (1,0),(2,0),(2,1),(1,2)… simpler: L-tet (0,0),(1,0),(2,0),(2,1) → target (1,0),(2,0),(3,0),(3,1) |
  | P3 | orange | L-tet mirrored: (0,0),(0,1),(0,2),(1,0) → target (1,2),(2,2),(3,2),(2,1) — resolve as J-piece at (1,2),(2,1),(2,2),(3,2) |
- **Resolved target grid:**
  ```
  Y Y Y
  P Y O
  P O O
  P P O
  ```
  (P1 yellow T at top; P2 purple L in col 0 rows 1-3 plus (3,1); P3 orange J covering (1,2),(2,1),(2,2),(3,2).)

### Round 4 — Stage 2 (4×3 grid, 3 pieces, 4 cells each)
- **Grid:** 4×3.
- **Pieces:**
  | Piece | Color | Shape (relative) | Target (absolute) |
  |-------|-------|------------------|-------------------|
  | P1 | yellow | I-tet vertical: (0,0),(1,0),(2,0),(3,0) | (0,0),(1,0),(2,0),(3,0) |
  | P2 | purple | Z-tet: (0,0),(0,1),(1,1),(1,2) | (0,1),(0,2),(1,2),(2,2) — adjusted to non-overlap: (0,1),(0,2),(1,1),(1,2) square |
  | P3 | orange | Square + tail: (0,0),(1,0),(1,1),(2,0) → target (2,1),(3,1),(3,2),(2,2) |
- **Resolved target grid:**
  ```
  Y P P
  Y P P
  Y O O
  Y O O
  ```
  (P1 column 0; P2 2×2 square top-right; P3 2×2 square bottom-right. Visually two stacked squares + one column — valid 4-tet decomposition.)

### Round 5 — Stage 3 (4×4 grid, 4 pieces, 4 cells each, 4 colors)
- **Grid:** 4 rows × 4 cols = 16 cells.
- **Pieces:**
  | Piece | Color | Shape (relative) | Target (absolute) |
  |-------|-------|------------------|-------------------|
  | P1 | yellow (#FFD93D) | Square: (0,0),(0,1),(1,0),(1,1) | (0,0),(0,1),(1,0),(1,1) |
  | P2 | purple (#8B5CF6) | T-tet: (0,0),(0,1),(0,2),(1,1) | (0,2),(0,3),(1,2),(1,3) → use square | (0,2),(0,3),(1,2),(1,3) |
  | P3 | orange (#FB923C) | L-tet: (0,0),(1,0),(2,0),(2,1) | (2,0),(3,0),(3,1),(2,1) → square (2,0),(2,1),(3,0),(3,1) |
  | P4 | green (#10B981) | Square: (0,0),(0,1),(1,0),(1,1) | (2,2),(2,3),(3,2),(3,3) |
- **Resolved target grid:**
  ```
  Y Y P P
  Y Y P P
  O O G G
  O O G G
  ```

**Design note for game-building:** If any shape/target combination above fails to tile the grid perfectly, swap to the simplest tetromino decomposition that does (prefer 2×2 squares and I-tets). The coverage constraint — 100% of cells filled, zero overlap — is what must hold; the exact shape set is guidance.

---

## 3. Scoring and Lives Logic

- **Lives:** none. Wrong drops have no state cost; piece bounces back. Kid may rearrange freely (pieces already on grid can be dragged back to bank).
- **Score unit:** 1 point per round completed (all pieces correctly placed). Max = 5.
- **Star thresholds:**
  | Stars | Rounds completed |
  |-------|------------------|
  | 3 ★   | 5 (all rounds) |
  | 2 ★   | 3 or 4 |
  | 1 ★   | 1 or 2 |
  | 0 ★   | 0 |
- **Victory is always reached** at Round 5 end (no game-over). If kid abandons, stars reflect rounds completed so far.
- **Progress bar:** 5 segments; advances 1 segment on each round-complete event (during the 2000ms round-complete feedback window). Visible on all non-Preview screens. Top of game body, below preview header.

---

## 4. Feedback Patterns per Interaction

| Event | Trigger | Feedback | Timing | API call |
|-------|---------|----------|--------|----------|
| Piece picked up | pointerdown on bank piece | Piece follows pointer; bank slot shows faded outline | immediate | CSS class `.piece-dragging` |
| Valid drop (correct cell set empty + in-bounds) | pointerup over grid with all piece cells valid | Piece snaps to grid cells (80ms ease-out translate); fire-and-forget `sound_piece_place` | snap 80ms | `FeedbackManager.sound.play('sound_piece_place')` (fire-and-forget) |
| Invalid drop (out of bounds, overlap, or partial off-grid) | pointerup over grid with any cell invalid | Piece bounce-back animation to bank slot (250ms cubic-bezier(.5,1.5,.5,1)); fire-and-forget `sound_bounce_back` | 250ms | `FeedbackManager.sound.play('sound_bounce_back')` (fire-and-forget) |
| Piece dragged off grid | pointerdown on a grid-placed piece, drag to bank area | Grid cells clear; piece returns to bank slot; no sound | immediate | — |
| Round complete (grid fully covered) | after valid drop that fills last empty cells | Awaited SFX `sound_round_complete` + TTS "Puzzle complete!"; progress bar segment animates fill; 500ms celebratory pulse on grid | 2000ms total | `await FeedbackManager.playDynamicFeedback({audio_content:'sound_round_complete', subtitle:'Puzzle complete!', sticker:'sparkle'})` |
| Round-N intro | after round-complete settles | Round-N transition screen with "Round N" SFX | 1500ms auto | `FeedbackManager.sound.play('sound_round_intro')` |
| Victory | after Round 5 complete | Star count reveal + `sound_game_victory` → `vo_victory_stars_N` | awaited | canonical victory flow |

**No heartBreak / life-lost animations** — lives system is absent.

---

## 5. Drag-and-Drop Interaction Details

### Hit-testing
- Grid cells rendered as absolutely-positioned `<div>`s with `data-row` / `data-col`.
- On pointermove while dragging, read `document.elementFromPoint(clientX, clientY)` relative to the piece's **anchor cell position** (top-left cell of piece bounding box).
- For each cell in the piece's shape array, compute `(anchorRow + dr, anchorCol + dc)` and check: (a) in-bounds `0 ≤ r < rows, 0 ≤ c < cols`, (b) grid cell is empty OR occupied by the same piece (when rearranging).
- Highlight preview: during drag, show faint ghost tint on the cells the piece would occupy; green tint if valid, red tint if invalid.

### Snap-to-grid
- On pointerup, if all computed cells are valid: animate piece element from current pointer position to the grid cell rect's top-left using 80ms CSS transform. Mark those grid cells occupied (`data-piece-id`, background color = piece color). Set piece's DOM parent to the grid container with absolute positioning locked to the anchor cell.
- Use `translate3d` for smooth GPU-accelerated snap.

### Bounce-back animation
- On pointerup with invalid drop: 250ms animation with `cubic-bezier(.5,1.5,.5,1)` (slight overshoot) returning piece to its original bank slot rect.
- During bounce-back, piece pointer-events are disabled to prevent mid-animation grabs.
- On animation end, piece is re-parented to its bank slot and pointer-events re-enabled.

### Edge cases
- If pointerup happens outside both grid and bank: bounce back to bank slot.
- If piece dragged back to bank from grid: grid cells clear immediately (no snap animation), piece returns to its original bank slot with a 120ms translate.
- Prevent scroll during drag: `touch-action: none` on grid and bank containers.
- Pointer events (not mouse/touch separately): single pointerdown/move/up listener set on the document during drag.

---

## 6. Layout Strategy — Mobile 375×667 Viewport

Available game body after preview header (56px) + progress bar (24px) = **587px vertical** × **375px horizontal**. Use 16px side padding → usable width **343px**.

### Stage 1 (3×3 grid)
- **Cell size:** 80×80 px → grid = 240×240 px, centered horizontally (margin-left 51px).
- **Grid area:** top offset 40px from progress bar → rect (51, 120, 291, 360).
- **Piece bank:** below grid at top 400px, height 160px, width 343px. 3 pieces laid horizontally, each in a 100×140 slot with 14px gutter.
- **Piece cell size in bank:** 32×32 px (scales up to 80×80 on grab for visual consistency with grid cell size).

### Stage 2 (4×3 grid, rounds 3-4)
- **Cell size:** 72×72 px → grid = 216×288 px (3 cols × 4 rows), centered (margin-left 79px).
- **Grid area:** top 100px → rect (79, 100, 295, 388).
- **Piece bank:** top 410px, height 170px, width 343px. 3 slots 100×150 each.
- **Piece cell in bank:** 30×30 px.

### Stage 3 (4×4 grid, round 5)
- **Cell size:** 64×64 px → grid = 256×256 px, centered (margin-left 59px).
- **Grid area:** top 100px → rect (59, 100, 315, 356).
- **Piece bank:** top 380px, height 190px, width 343px. 4 slots 76×170 each with 8px gutter (4 × 76 + 3 × 8 = 328, centered in 343 → margin 7px).
- **Piece cell in bank:** 28×28 px.

### Common styling
- Grid cells: 2px border `#E5E7EB`, background `#F9FAFB`, border-radius 4px.
- Placed pieces: solid color fill (palette above), 2px border same color darker 15%, border-radius 4px on outer edges only (via individual cell rounding at shape corners).
- Bank slot: 1px dashed `#D1D5DB` border, border-radius 8px, background `#FFFFFF`.
- Piece dragging state: `transform: scale(1.05)`, `box-shadow: 0 8px 16px rgba(0,0,0,.2)`, `z-index: 100`.
- Ghost highlight on grid during drag: `background: rgba(34,197,94,.25)` valid, `rgba(239,68,68,.25)` invalid.

### Accessibility / touch targets
- Bank pieces minimum 100×140 hit region (exceeds 44×44 min).
- Grid cells minimum 64×64 (exceeds 44×44 min).
- High contrast between all 4 piece colors and neutral grid background.
