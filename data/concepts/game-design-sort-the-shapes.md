# Game Design: Sort the Shapes

## One-Line Concept

Kid drags shape cards into the correct category bucket — tests geometry classification through physical sorting.

---

## Interaction Pattern

**P6 — Drag-and-Drop (Pick & Place)** only. Pick up a shape card, drag it into a labeled bucket, snap or bounce back.

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Shape classification | Sort shapes by number of sides, symmetry, or type | 2-4 |
| Property recognition | Identify properties like "has 4 equal sides" or "has no straight edges" | 2-3 |
| Spatial reasoning | Distinguish similar shapes (rhombus vs rectangle) | 3-4 |

---

## Core Mechanic

1. Kid sees a **bank of shape cards** at the top (3-5 cards per round)
2. Below the bank are **2 or 3 labeled buckets** (e.g., "Triangles" and "Quadrilaterals")
3. Kid **drags** each shape card into the correct bucket
4. On drop:
   - **Correct bucket:** Card snaps into place, fire-and-forget correct SFX
   - **Wrong bucket:** Card bounces back to the bank, wrong SFX, life lost
5. When all cards are placed correctly: round complete, awaited SFX + TTS feedback

---

## 8 Rounds Across 3 Stages

### Stage 1: Two obvious buckets (Rounds 1-3)
- 2 buckets with clearly different categories
- Round 1: "Circles" vs "Not Circles" — 4 cards (circle, oval, square, triangle)
- Round 2: "Has Straight Edges" vs "Has Curved Edges" — 4 cards
- Round 3: "Triangles" vs "Rectangles" — 4 cards (right triangle, equilateral, square, rectangle)
- 3-4 cards per round

### Stage 2: Three buckets + similar shapes (Rounds 4-6)
- 3 buckets, shapes are more similar
- Round 4: "3 sides" vs "4 sides" vs "5+ sides" — 5 cards
- Round 5: "Square" vs "Rectangle" vs "Other Quadrilateral" — 5 cards (square, rectangle, parallelogram, rhombus, trapezoid)
- Round 6: "Regular" vs "Irregular" — 5 cards (regular pentagon, irregular pentagon, equilateral triangle, scalene triangle, regular hexagon)

### Stage 3: Property-based sorting (Rounds 7-8)
- Buckets labeled by properties, not shape names
- Round 7: "All sides equal" vs "Not all sides equal" — 5 cards
- Round 8: "Has right angles" vs "No right angles" — 5 cards
- Requires analyzing properties, not just recognizing names

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Buckets | 2 | 3 | 2 (property-based) |
| Cards per round | 3-4 | 5 | 5 |
| Category clarity | Obvious (circle vs not) | Similar shapes | Property analysis |
| Shape variety | Basic (circle, square, triangle) | Extended (parallelogram, trapezoid) | Mixed with tricky cases |

---

## DnD Behavior Requirements

| Behavior | Spec |
|----------|------|
| Pick up | Pointer down on card, card lifts with slight scale (1.05x) |
| Drag | Card follows pointer, semi-transparent (opacity 0.8) |
| Drop zone highlight | Bucket highlights when card is over it (border glow) |
| Correct drop | Card snaps into bucket, shrinks into bucket list |
| Wrong drop | Card animates back to bank (snap-back), red flash on bucket |
| Already placed | Cards in buckets are non-interactive (cannot re-drag) |
| Touch CSS | `touch-action: none` on all draggable cards |

---

## Game Parameters

- **Rounds:** 8
- **Timer:** None
- **Lives:** 3 (each wrong drop = lose a life)
- **Star rating:** 3 stars = 7-8 correct rounds, 2 stars = 5-6, 1 star = 1-4
- **Input:** Drag-and-drop only (P6)
- **Feedback:** Fire-and-forget SFX per card drop. Awaited SFX + TTS on round complete.
- **Layout:** Bank of cards (horizontal scroll if needed) at top. Buckets below (side by side, equal width).
