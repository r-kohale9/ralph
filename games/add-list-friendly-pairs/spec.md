# Game Design: Equivalent Fractions Matching

## Identity

- **Game ID:** add-list-friendly-pairs
- **Title:** Equivalent Fractions Matching
- **Class/Grade:** Class 3-5
- **Math Domain:** Fractions / Part-Whole Reasoning
- **Topic:** Matching a symbolic fraction (e.g. 1/2) to the correct shaded-shape area model across three shapes (circle, rectangle, hexagon) with partial shaded fills.
- **Bloom Level:** L2 Understand — students translate a symbolic fraction into a matching visual area model.
- **Archetype:** Single-MCQ Tap (#1) — each round is a single question with one correct tap from three cards.
- **NCERT Alignment:** NCERT Class 3 "Fractional Numbers" (halves, thirds, quarters); Class 4 "Play with Patterns / Fractional Numbers"; Class 5 "Tenths and Hundredths" reinforcement of area models.

> **Note on source data:** The upstream worksheet labels this chunk "Add list with friendly pairs", but the captured block describes an **Equivalent Fractions Matching** screen. We build B1 (Equivalent Fractions Matching) as the canonical game. B2 (Shape Pattern Completion) and B3 (Ordering by Size) are noted as future variants; this spec ships B1 as nine rounds of fraction-matching, optionally sprinkling two shape-pattern rounds in Stage 3 to honour the variant note while keeping a single tap interaction.

## One-Line Concept

Students see a large target fraction and three cards showing shaded-shape area models; they tap the card whose shaded portion equals the target fraction.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Fraction-as-area | Read a symbolic fraction as "shaded parts / total parts" of a shape. | All rounds |
| Unit recognition | Identify halves, thirds, quarters, sixths, eighths visually. | All rounds |
| Equivalence | Recognize that 2/4 and 1/2 are the same area. | Stage 2-3 |
| Visual discrimination | Tell 3/4 from 2/3 from 2/4 when shapes differ (circle vs rectangle vs hexagon). | All rounds |
| Pattern continuation | (Stage 3 optional) Pick the shape completing a repeating colour-shape pattern. | Round 8 |

---

## Core Mechanic

Single interaction across all rounds: **tap one of three answer cards.** Difficulty scales by (a) fraction family — halves/quarters → thirds/sixths → eighths/mixed, (b) distractor similarity (same denominator different numerator → different denominator same shape → equivalent-but-different form), (c) shape variety (circle, rectangle, hexagon).

### Type A: "Simple halves and quarters" (Stage 1 — Rounds 1-3)
1. **Student sees:** Large target fraction (e.g. 1/2) in question area. Three cards in one row with shaded-shape area models.
2. **Student does:** Taps the card matching the target fraction.
3. **Correct criterion:** Tapped card's shaded portion equals the target fraction.
4. **Feedback:** Green highlight on correct card. Wrong = red highlight + correct card flashes green. Life -1 on wrong.

### Type B: "Thirds, sixths, and mixed denominators" (Stage 2 — Rounds 4-6)
Same tap mechanic. Distractors are now shapes with the same denominator but a different numerator (e.g. target 2/3, distractors 1/3 and 3/3).

### Type C: "Equivalence and eighths" (Stage 3 — Rounds 7-9)
Same mechanic. Includes at least one equivalent-fraction round (target 1/2 with options 2/4, 3/6, 3/4 — two are equivalent but only 2/4 is shown as `2/4` visually). Round 8 swaps in a **shape-pattern-completion** sub-variant: student sees a horizontal repeating pattern (square, circle, triangle, square, circle, ?) and taps the card showing the completing shape — honours B2 variant without changing the tap interaction.

---

## Rounds & Progression

| R | Stage/Type | Target | Correct | Distractors | Shape for correct |
|---|------------|--------|---------|-------------|-------------------|
| 1 | S1 / A | 1/2 | 1/2 | 1/3, 1/4 | Rectangle (2x1, left half shaded) |
| 2 | S1 / A | 1/4 | 1/4 | 1/2, 3/4 | Circle (4 quadrants, 1 shaded) |
| 3 | S1 / A | 3/4 | 3/4 | 1/4, 2/4 | Rectangle (2x2, 3 shaded) |
| 4 | S2 / B | 2/3 | 2/3 | 1/3, 3/3 | Hexagon (6 triangles, 4 shaded = 2/3 via pairing) — falls back to rectangle (3 cols, 2 shaded) |
| 5 | S2 / B | 3/6 | 3/6 | 2/6, 4/6 | Hexagon (6 triangles, 3 shaded) |
| 6 | S2 / B | 2/4 | 2/4 | 1/4, 3/4 | Rectangle (2x2, 2 shaded diagonal) |
| 7 | S3 / C | 1/2 | 2/4 (equivalent) | 3/4, 1/3 | Rectangle 2x2, 2 shaded — equivalence round |
| 8 | S3 / pattern | "Continue: □ ○ △ □ ○ ?" | △ | □, ○ | Pattern card |
| 9 | S3 / C | 5/8 | 5/8 | 3/8, 6/8 | Rectangle (2x4, 5 shaded) |

**Total rounds: 9**. Distribution 3+3+3.

---

## Game Parameters

- **Rounds:** 9
- **Timer:** None (Bloom L2 area-model reasoning is not time-pressured)
- **Lives:** 3 (red hearts) per source concept
- **Star rating:**
  - 3 stars = 8-9 correct on first try
  - 2 stars = 5-7 correct on first try
  - 1 star = 1-4 correct on first try
  - 0 stars = 0 correct on first try
- **Input:** Single tap on one of three cards (Pattern P1 / tap-interaction)
- **Feedback:** Per-tap evaluation. Awaited SFX on correct/incorrect. Fire-and-forget TTS with context-aware subtitle.

---

## Scoring

- **Points:** +1 per round solved on first attempt (max 9)
- **Stars:** Thresholds above
- **Lives:** Start at 3; -1 per wrong answer; game_over at 0 lives remaining
- **Partial credit:** None

---

## Flow

Default multi-round flow with lives:

```
[Preview Screen (PART-039)]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: target fraction + 3 cards]
        |
        | tap a card
        v
[Evaluate]
        +--> correct --> Correct feedback --> (N<9 → Round N+1; N==9 → Victory)
        +--> wrong   --> Wrong feedback + lives-=1
                        --> (lives==0 → Game Over; else → Round N+1)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Card tapped, correct | Green highlight on tapped card 400ms. Awaited correct SFX + celebrate sticker (Promise.all 1500ms floor). Fire-and-forget TTS: "Exactly! That's [fraction-text] shaded." Advance to next round after SFX. |
| Card tapped, wrong | Red highlight on tapped card. Correct card flashes green (`.correct-reveal`). Awaited wrong SFX + sad sticker (1500ms floor). Fire-and-forget TTS: "Not quite — [fraction-text] looks like this." lives -=1. Advance to next round or game_over. |
| Round N intro | TransitionScreen "Round N" with rounds SFX and sticker. Auto-advance. |
| Victory | Screen renders FIRST, game_complete postMessage BEFORE audio, then awaited victory SFX + VO. |
| Game Over | Screen renders, game_complete BEFORE audio, awaited game-over SFX + VO. |
| Visibility hidden/restored | VisibilityTracker handles pause overlay (popupProps, never custom). |

---

## Content Structure (fallbackContent)

The HTML ships a 9-round `fallbackContent.rounds` array. Each round carries:
- `round` (1-9)
- `stage` (1-3)
- `type` ("A" | "B" | "C" | "pattern")
- `prompt` ("Choose the picture that matches the fraction." or pattern prompt for Round 8)
- `target` — for fraction rounds: `{ num, den, displayText }`; for pattern round: `{ patternText: "□ ○ △ □ ○ ?", patternTokens: ['sq','ci','tr','sq','ci'] }`
- `options` — array of 3 card descriptors:
  - Fraction card: `{ id, kind: 'fraction', shape: 'rect' | 'circle' | 'hex', num, den, layout: { cols, rows? } }`
  - Pattern card: `{ id, kind: 'pattern', token: 'sq' | 'ci' | 'tr' }`
- `correctId` — id of the correct option
- `misconception_tags` map

---

## Defaults Applied

- **Class/Grade:** Class 3-5 (common grades for simple fraction area models in NCERT)
- **Rounds:** 9 (MCQ archetype default)
- **Lives:** 3 (per source concept's heart count)
- **Bloom:** L2 Understand
- **Timer:** None
- **Preview screen:** YES (PART-039 default-on)
- **TransitionScreen for Victory/Game Over/Motivation/Stars Collected:** default templates per `default-transition-screens.md`
- **Shape colours:** yellow for hexagon, blue for rectangle/square, pink/rose for circle (matches source-concept screenshot palette). All through `--mathai-*` variables.

---

## Warnings

- **WARNING — Equivalence round (R7).** Round 7 has correct `2/4` for target `1/2`. Students who literally match `num=1,den=2` will miss. The TTS on wrong explicitly says "2/4 is the same as 1/2" to teach equivalence. This is the single "challenge" round; all others are direct matches.
- **WARNING — Pattern round (R8).** Round 8 swaps the question content to a shape pattern. The tap interaction is identical, so no code branch is needed beyond a different card renderer inside the same handler.
- **WARNING — Hexagon rendering.** Inline SVG hexagon with 6 equilateral triangles. To keep fill math exact, each triangle is its own `<polygon>` inside a single `<svg viewBox="0 0 100 100">`. Shaded triangles use `--mathai-yellow`; unshaded white with a light grey border.
- **WARNING — Card contrast.** Cards are white with a 1px border; shaded shape fills must provide sufficient contrast even on budget Android at low brightness. Use `--mathai-yellow` (#FFDE49), `--mathai-blue` (#667eea), and `#EB5B8A` (pink) — all from the palette.
