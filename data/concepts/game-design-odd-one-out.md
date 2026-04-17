# Game Design: Odd One Out

## One-Line Concept

Kid sees 4 items and taps the one that doesn't belong to the group — tests classification and category reasoning.

---

## Interaction Pattern

**P1 — Tap-Select (Single)** only. One tap = one evaluation = round done.

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Classification | Identify which item does not share a common property | 1-3 |
| Category reasoning | Explain why 3 items belong together | 2-4 |
| Visual discrimination | Spot subtle differences in shape, color, size | 1-2 |

---

## Core Mechanic

1. Kid sees 4 items displayed in a 2x2 grid (large tap targets, 44px+ each)
2. 3 items share a common property (e.g., all are fruits, all are even numbers, all have 4 sides)
3. 1 item is the "odd one out" — it does NOT share the property
4. Kid taps the odd item
5. Correct = green highlight + SFX + TTS feedback explaining the category ("These are all fruits, but a car is not a fruit!")
6. Wrong = red flash on tapped item + reveal correct answer + TTS explanation

---

## 10 Rounds Across 3 Stages

### Stage 1: Visual categories (Rounds 1-3)
- Categories based on obvious visual properties: color, shape, size
- Example: 3 red objects + 1 blue object
- Example: 3 circles + 1 triangle
- Distractor is visually distinct

### Stage 2: Conceptual categories (Rounds 4-7)
- Categories based on meaning: animals vs objects, fruits vs vegetables, odd vs even
- Example: Dog, Cat, Fish, Chair — chair is odd (not an animal)
- Example: 2, 4, 6, 9 — 9 is odd (not even)
- Distractors may share visual similarity with the group

### Stage 3: Tricky categories (Rounds 8-10)
- Multiple possible categories — kid must find the PRIMARY grouping
- Example: Apple, Banana, Orange, Basketball — all are round, but basketball is not a fruit
- Example: 12, 15, 18, 22 — 22 is odd (others are multiples of 3)
- Requires deeper analysis

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Category type | Visual (color/shape) | Conceptual (meaning) | Multi-attribute |
| Distractor similarity | Low (clearly different) | Medium | High (shares some traits) |
| Items shown as | Images/icons | Mix of images + numbers | Numbers or text |

---

## Game Parameters

- **Rounds:** 10
- **Timer:** None
- **Lives:** 3 (wrong answer = lose a life, 0 lives = game over)
- **Star rating:** 3 stars = 9-10 correct, 2 stars = 6-8, 1 star = 1-5
- **Input:** Tap only (P1 — single tap on one of 4 options)
- **Feedback:** Correct/wrong SFX + sticker + TTS voice-over explaining the category
- **Layout:** 2x2 grid of large, tappable cards (images or text)
