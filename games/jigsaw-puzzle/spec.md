# Game Design: Jigsaw Puzzle

## One-Line Concept

Kid drags colored polyomino pieces onto a grid to complete the puzzle — tests spatial reasoning and shape fitting.

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Spatial reasoning | Visualize where a piece fits on the grid by its shape | 1-4 |
| Shape recognition | Identify polyomino shapes (L, T, S, I, etc.) | 1-3 |
| Problem solving | Use trial, error, and elimination to place all pieces | 2-4 |

---

## Core Mechanic

1. Kid sees an empty grid (3×3, 4×3, or 4×4) and 3-4 colored polyomino pieces in a bank below
2. Each piece is a connected group of cells (like Tetris pieces but with 3-4 cells)
3. Kid drags a piece from the bank onto the grid
4. If the piece fits in the position (cells are empty and within bounds), it snaps into place
5. If the position is wrong, the piece bounces back to the bank
6. When all pieces are placed and the grid is complete, the round is done
7. Pieces can be dragged off the grid back to the bank to try a different arrangement

---

## 5 Rounds Across 3 Stages

### Stage 1: Small grid, few pieces (Rounds 1-2)
- 3×3 grid, 3 pieces (3 cells each = 9 total cells)
- Pieces are simple shapes (L-shape, line, corner)
- Each piece has a distinct color (yellow, purple, orange)
- Low ambiguity — each piece has only one valid placement

### Stage 2: Larger grid (Rounds 3-4)
- 4×3 grid, 3 pieces (4 cells each = 12 total cells)
- Pieces are more complex (T-shape, S-shape, zigzag)
- Multiple possible positions per piece — requires more spatial reasoning
- Same 3 colors (yellow, purple, orange)

### Stage 3: Full grid (Round 5)
- 4×4 grid, 4 pieces (4 cells each = 16 total cells)
- 4 pieces including a new green color
- Highest spatial complexity — 4 pieces to coordinate

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Grid size | 3×3 | 4×3 | 4×4 |
| Pieces | 3 | 3 | 4 |
| Cells per piece | 3 | 4 | 4 |
| Piece complexity | Simple (L, line) | Medium (T, S, zigzag) | Complex |
| Colors | 3 | 3 | 4 |

---

## Interaction Pattern

**P6 — Drag-and-Drop (Pick & Place)**

- Drag pieces from the bank onto the grid
- Pieces snap to grid cells on valid drop
- Invalid drop → piece bounces back to bank
- Pieces on grid can be dragged back to bank to rearrange
- No rotation — pieces are placed in their original orientation

---

## Game Parameters

- **Rounds:** 5
- **Timer:** None
- **Lives:** None (no penalty for wrong placement — piece just bounces back)
- **Star rating:** 3 stars = 5 rounds completed, 2 stars = 3-4, 1 star = 1-2
- **Input:** Drag-and-drop only (P6)
- **Feedback:** Fire-and-forget SFX per correct piece placement. Awaited SFX + TTS on round complete ("Puzzle complete!"). Bounce-back animation on wrong placement.
