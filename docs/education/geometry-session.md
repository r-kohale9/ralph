# Geometry Session — Angles, Triangles, Quadrilaterals

**Created:** 2026-03-23
**Author:** Education Implementation Slot
**Status:** Session plan complete — no game specs yet

**Session goal:** Build visual + classificatory fluency in foundational 2D geometry: angle types, triangle classification, quadrilateral properties, and angle-sum computation. Bloom Levels L1 (Remember) → L3 (Apply).

**NCERT alignment:**
- Class 7 Ch 5 (Lines and Angles) + Ch 6 (The Triangle and Its Properties)
- Class 8 Ch 3 (Understanding Quadrilaterals)
- Class 9 Ch 6 (Lines and Angles) + Ch 7 (Triangles) + Ch 8 (Quadrilaterals)

**Prerequisite session:** Statistics Session (stats-identify-class, stats-mean-direct)
**Successor session:** Fractions / Algebra (TBD)

---

## Research Sources

> **Source A:** Padmavathy, R.D. (2015) "Diagnostic of Errors Committed By 9th Grade Students in Solving Problems in Geometry", IJRE Vol. 4(1). Study of 900 Class 9 students (India) found: 59% lack angle-related concepts; 65% cannot answer application problems in triangles and quadrilaterals; students confuse supplementary and complementary angles; concept error was the most common error type (82.8%). Direct basis for Game 1 distractor design and Game 4 misconception targeting.
> URL: https://www.raijmr.com/ijre/wp-content/uploads/2017/11/IJRE_2015_vol04_issue_01_05.pdf

> **Source B:** Biber, Tuna & Korkmaz (2013) "The Mistakes and Misconceptions of 8th Grade Students on the Subject of Angles", ERIC EJ1108200. 30 students; only 43% could accurately answer angle geometry questions. Key findings: (1) students focus on physical appearances alone, not geometric properties; (2) confusion between supplementary (180°) and complementary (90°) pairs; (3) incorrect generalisation — properties valid for one angle type applied to all. Directly informs Game 1 distractor choice (complementary vs. supplementary) and Game 4 angle-sum questions.
> URL: https://files.eric.ed.gov/fulltext/EJ1108200.pdf

> **Source C:** Ozkan & Bal (2017) "Analysis of the Misconceptions of 7th Grade Students on Polygons and Specific Quadrilaterals", Eurasian Journal of Educational Research 67, pp. 161–182. Found 31% misconception rate for quadrilaterals — the highest of all geometry content areas in the Myanmar/Turkey comparative studies. Key finding: students use prototype-based recognition (a rectangle must have a horizontal base; a square is not a rectangle because it is "too equal") rather than property-based definitions. Directly informs Game 3 distractor design: non-canonical orientations + class-inclusion traps (square as special rectangle).
> URL: https://www.researchgate.net/publication/315899162

> **Source D:** CPP/BSCS RESPeCT (2017) "Misconceptions Related to Angles", Day 3 PD Leader Guide — 4th Grade. Documents the "larger space = larger angle" perceptual illusion: students conclude an angle is larger when its arms are longer (larger area between them), even if both angles are congruent. Prescribes remedy: vary arm lengths of same angle type in stimulus items. Used in Game 1 round design — all angle stimuli use varying arm lengths to prevent perceptual shortcuts.
> URL: https://www.cpp.edu/respect/resources/documents_4th/pdlg/3.5-misconceptions-related-to-angles.pdf

> **Source E:** NCERT Class 7 Ch 5 (Lines and Angles) + Ch 6 (Triangle Properties), via studiestoday.com / vedantu.com. Ch 5: acute, obtuse, right, straight, reflex angles; complementary and supplementary pairs. Ch 6: classification of triangles by sides (equilateral, isosceles, scalene) and by angles (acute, right, obtuse); angle sum property (∠A + ∠B + ∠C = 180°); exterior angle property. NCERT Class 9 Ch 6 + 7 + 8 extend to formal proofs. The four games target the conceptual layer that precedes proof-writing.
> URL: https://www.vedantu.com/cbse/important-questions-class-7-maths-chapter-6, https://byjus.com/ncert-solutions-class-9-maths/chapter-8-quadrilaterals/

---

## Session Sequence (prerequisite-ordered)

| Game # | Game ID | Bloom Level | Interaction Type | Grade Level | Status |
|--------|---------|-------------|-----------------|-------------|--------|
| 1 | `geo-angle-id` | L1 Remember | Visual MCQ — classify angle from diagram | Class 6–7 | planned |
| 2 | `geo-triangle-sort` | L1–L2 Remember→Understand | Dual-axis classification (sides + angles) | Class 7 | planned |
| 3 | `geo-quad-match` | L2 Understand | Property MCQ — identify quadrilateral from property list | Class 8–9 | planned |
| 4 | `geo-angle-sum` | L3 Apply | Computation MCQ — find missing angle using sum property | Class 7–9 | planned |

**Ordering rationale:** Angle vocabulary (Game 1) is a prerequisite for triangle classification by angles (Game 2). Both are prerequisites for quadrilateral property reasoning (Game 3). Angle-sum computation (Game 4) requires knowing the angle types (Game 1) and that a triangle has 3 angles (Game 2). A learner cannot compute a missing quadrilateral angle without first understanding quadrilateral types (Game 3).

---

## Game 1 — geo-angle-id (L1 Remember)

**Concept:** Angle identification — acute / obtuse / right / straight / reflex
**NCERT chapter:** Class 7 Ch 5 §5.3 (Types of Angles); Class 9 Ch 6 §6.1 (Basic Terms and Definitions)
**Grade level:** Class 6–7 entry level, Class 9 review

### Interaction Pattern

Visual MCQ. Each round displays a CSS-drawn angle (two arms meeting at a vertex) with a marked arc. The learner selects from 5 options: Acute / Right / Obtuse / Straight / Reflex. No typed input — pure recognition game.

**Why MCQ here:** Angle identification is pure categorisation (Bloom L1). The task is not to compute a value — it is to map a visual percept to a label. MCQ with all 5 types as options maximises the diagnostic signal: a learner who confuses obtuse with reflex has a different gap than one who confuses acute with right.

**9 rounds, 3 difficulty tiers:**
- Easy (rounds 1–3): prototypical orientations, arms of equal length — right angle at standard NE orientation, clear 45° acute, clear 120° obtuse
- Medium (rounds 4–6): non-canonical orientations — right angle rotated 45°, straight angle not horizontal, obtuse angle with very short arms (testing the "space" misconception)
- Hard (rounds 7–9): reflex angles (180°–360°), angles near-boundary (88° vs 92°, requires measuring arc not guessing), straight angle disguised as two collinear rays

**Round data notes:** Each round: `{ angleDegrees, label, orientation, armLengthRatio, distractors[] }`. The `armLengthRatio` field is critical — hard rounds use asymmetric arms (ratio 0.4:1.0) to defeat the "larger space" perceptual shortcut (Source D).

### Misconceptions Targeted

| Misconception | Source | Round design |
|---------------|--------|-------------|
| "Longer arms = larger angle" (perceptual size illusion) | CPP/BSCS Source D | Medium/Hard rounds: vary arm length, keep angle constant |
| Reflex angles are "not real angles" — students stop at 180° | Source B (Biber et al., only 43% accuracy) | Rounds 7–9 are all reflex |
| Right angle only recognised in standard (vertical/horizontal) orientation | Source D — "salience of the prototypical right angle" | Medium round: right angle rotated 45° |
| Obtuse angles not seen as angles when very obtuse (160°+) | Source C (ENAD 2021 6th grade study) | Hard round 8: 165° obtuse, short arms |
| Confusing straight angle with a line | Padmavathy Source A | Hard round 9: straight angle explicitly labelled at a point |

### Spec Notes

- CSS-drawn only. No SVG required — two `div` arms positioned via CSS `transform: rotate()` + a `div` arc indicator. This is within reliable generation range (no external SVG assets needed).
- All 5 answer options always visible as buttons. Correct answer randomised by position each round.
- `isProcessing` guard required — same as stats-mean-direct pattern.
- Timer: 30 seconds per round (visual identification is fast; 45s is too generous).
- 3 lives. Star threshold: 9/9 = 3★, 6-8 = 2★, 3-5 = 1★, 0-2 = 0★.

---

## Game 2 — geo-triangle-sort (L1–L2 Remember→Understand)

**Concept:** Triangle classification — by sides (equilateral / isosceles / scalene) and by angles (acute-angled / right-angled / obtuse-angled)
**NCERT chapter:** Class 7 Ch 6 §6.1–6.2 (Classification of Triangles); Class 9 Ch 7 (Triangles — congruence extends this)
**Grade level:** Class 7 primary, Class 9 review

### Interaction Pattern

Two-step MCQ. Step 1: classify by sides. Step 2: classify by angles. Both steps are on the same screen — a CSS-drawn triangle with labelled sides and a marked angle. The learner must answer both before advancing.

**Why two-step:** The critical pedagogical insight is that these two classification axes are independent. A right-angled triangle can be isosceles (45-45-90) or scalene (30-60-90). A learner who treats "right triangle" and "isosceles" as mutually exclusive has a class-inclusion gap. The two-step interaction forces simultaneous reasoning on both axes in every round, making the independence explicit.

**9 rounds, 3 difficulty tiers:**
- Easy (rounds 1–3): clearly distinct types — equilateral (all 60°), scalene-right (30-60-90), isosceles-obtuse (40-40-100)
- Medium (rounds 4–6): boundary cases — isosceles-right (45-45-90, forces class-inclusion reasoning), equilateral verified by angles not side tick marks
- Hard (rounds 7–9): scalene-obtuse, scalene-acute with close side lengths, and a degenerate near-equilateral (59-61-60) to test precision

**Round data:** `{ sideLengths: [a, b, c], angles: [A, B, C], correctSideClass, correctAngleClass, distractors }`. Sides labelled with tick marks; angles labelled with arcs. Correct answers are both required; partial credit: wrong on either = wrong answer for the round.

### Misconceptions Targeted

| Misconception | Source | Round design |
|---------------|--------|-------------|
| A square / equilateral triangle is not isosceles ("too equal") — class inclusion failure | Ozkan & Bal Source C | Medium round 5: equilateral identified as also isosceles in explanation |
| Right triangle cannot be isosceles | Class-inclusion research (van Hiele level 2) | Medium round 4: 45-45-90 — both labels must be selected |
| A triangle with two equal angles is always equilateral | Prototype thinking | Medium round 6: isosceles-acute 50-50-80 |
| Scalene means "all angles different AND all obtuse" | Intuitive thinking (Source: IJESRT 2019) | Hard round 7: scalene-acute |
| Triangle cannot have an obtuse angle because "it would collapse" | Intuitive thinking from visual prototypes | Easy round 3: obtuse isosceles explicitly correct |

### Spec Notes

- Two MCQ button rows rendered simultaneously. Each row has 3 options. Both rows required per round.
- Validation: `correctSideClass === selectedSide && correctAngleClass === selectedAngle`.
- CDN pattern: closest approved spec is `find-triangle-side` (two-step interaction). Borrow the step 1 / step 2 state machine from that spec — but here both steps are MCQ (no typed input).
- Timer: 40 seconds per round (two classification decisions required).

---

## Game 3 — geo-quad-match (L2 Understand)

**Concept:** Quadrilateral properties — rectangle / rhombus / square / parallelogram / trapezoid
**NCERT chapter:** Class 8 Ch 3 §3.3–3.5 (Understanding Quadrilaterals: Types and Properties); Class 9 Ch 8 §8.3–8.4 (Types of Quadrilaterals + Properties of a Parallelogram)
**Grade level:** Class 8–9

### Interaction Pattern

Property-to-shape MCQ. Each round presents a list of 2–3 properties (e.g., "All sides equal; Opposite angles equal; Diagonals bisect each other at right angles") and asks: which quadrilateral has ALL of these properties? 5 options: Rectangle / Rhombus / Square / Parallelogram / Trapezoid.

**Why property-to-shape (not shape-to-property):** Prototype-based recognition is the dominant misconception for quadrilaterals (Source C: 31% misconception rate, highest of all geometry areas). Presenting properties instead of a picture forces the learner to reason from defining attributes, not from visual appearance. A rotated square still matches "all sides equal + all angles 90°" even if it looks like a diamond.

**9 rounds, 3 difficulty tiers:**
- Easy (rounds 1–3): one unambiguous property per round ("Has exactly one pair of parallel sides" → Trapezoid; "All angles = 90°, all sides equal" → Square)
- Medium (rounds 4–6): 2 properties that narrow to one shape but require class-inclusion reasoning ("All angles 90° + opposite sides equal" → Rectangle, not Square, because the square is a special case — but here, which is the PRIMARY classification when these two hold without specifying equal sides?)
- Hard (rounds 7–9): 3 properties with class-inclusion traps ("Opposite sides parallel + all sides equal" → Rhombus OR Square — both correct — distractor trap forces "Rhombus" as the most general answer when sides-equal is given without specifying right angles)

**Round data:** `{ properties: [string, string?, string?], correctAnswer, distractors[], misconceptionTag }`. The `misconceptionTag` field drives test categories (prototype-recognition / class-inclusion / property-intersection).

### Misconceptions Targeted

| Misconception | Source | Round design |
|---------------|--------|-------------|
| Square is not a rectangle ("a rectangle must be longer than wide") | Ozkan & Bal Source C — prototype figure dependency | Medium rounds: include "All angles 90°" without mandating unequal sides |
| Rhombus is a "tilted square" — not a distinct type | Prototype + visual appearance | Round 5: rhombus properties without any orientation cue |
| Parallelogram diagonals are equal | Incorrect generalisation from rectangle (Source B) | Hard round: diagonal equality NOT in property list → tests whether students assume it |
| Trapezoid must have one horizontal + one slanted side | Prototype thinking | Round 2: "exactly one pair of parallel sides" → Trapezoid, in a non-canonical orientation |
| Every quadrilateral is a parallelogram | Overgeneralisation | Easy round 3: trapezoid properties that explicitly exclude parallel second pair |

### Spec Notes

- Properties displayed as a styled `<ul>` inside a card. No diagram — pure text-to-classification.
- 5 option buttons (more than the usual 4). The PART-022 game-buttons pattern supports up to 5; confirm in spec.
- Closest approved spec template: `stats-identify-class` (identify-the-right-category from a description). This is the same interaction pattern applied to geometry.
- Timer: 45 seconds per round (reading 3 properties + reasoning).
- 3 lives.

---

## Game 4 — geo-angle-sum (L3 Apply)

**Concept:** Interior angle sum property — triangle (180°) and quadrilateral (360°) — find the missing angle
**NCERT chapter:** Class 7 Ch 6 §6.5 (Angle Sum Property of a Triangle); Class 8 Ch 3 §3.2 (Angle Sum of a Polygon); Class 9 Ch 6 Ex 6.3 (angle sum with parallel lines)
**Grade level:** Class 7 (triangle sum) + Class 8 (quadrilateral sum) + Class 9 (combined with exterior angle)

### Interaction Pattern

Computation MCQ. A diagram shows a triangle or quadrilateral with n-1 angles labelled. One angle is labelled "?". The learner selects the correct value of ? from 4 options.

**Why MCQ (not typed):** The computation is single-step arithmetic (180 − a − b, or 360 − a − b − c). Typed input would test arithmetic accuracy, not conceptual understanding. MCQ distractors are designed to catch the specific conceptual errors — forgetting to use 180° vs 360°, applying the triangle rule to a quadrilateral, and sign errors. MCQ reveals which error a learner is making; typed input only reveals correct/incorrect.

**9 rounds, 3 difficulty tiers:**
- Easy (rounds 1–3): triangle angle sum — 2 angles given, find third (e.g., 60° + 70° + ? = 180° → ? = 50°)
- Medium (rounds 4–6): quadrilateral angle sum — 3 angles given, find fourth (e.g., 90° + 80° + 110° + ? = 360° → ? = 80°); and triangle with one angle as an expression (e.g., one angle = 2x, another = x + 10°, find x)
- Hard (rounds 7–9): exterior angle property (exterior angle of triangle = sum of two non-adjacent interior angles); angle sum in a combined figure (triangle + quadrilateral sharing a side)

**Distractor design per round:**
- Distractor 1: Apply 180° rule to a quadrilateral (or 360° rule to a triangle) — wrong total
- Distractor 2: Subtract one angle instead of two (off-by-one angle in sum)
- Distractor 3: Arithmetic error (carry error in subtraction)
- Correct answer: matches the correct sum property

**Round data:** `{ figure: 'triangle'|'quadrilateral', givenAngles: [a, b], missingAngle, correctAnswer, distractors: [d1, d2, d3], misconceptionTag }`.

### Misconceptions Targeted

| Misconception | Source | Round design |
|---------------|--------|-------------|
| Triangle angle sum = 360° (confusing with quadrilateral) | Padmavathy Source A — 65% cannot answer triangle/quadrilateral application problems | Distractor 1 in all easy rounds |
| Supplementary = two angles summing to 90° (not 180°) | Biber et al. Source B + Padmavathy Source A (59% angle confusion) | Medium round 5: uses supplementary relationship explicitly |
| Exterior angle = 180° − interior (treating as supplementary pair, not the two non-adjacent sum) | NCERT Class 7 Ch 6 exterior angle property | Hard rounds 7–9 |
| Missing angle = 180° − one angle only (forgets one given angle) | Padmavathy — defective algorithm (78.1% error rate) | Distractor 2 in all rounds |
| Angle sum depends on triangle size (larger triangle has larger total) | Classic misconception documented in angle research | Not testable in MCQ directly — addressed in pedagogical note in spec |

### Spec Notes

- CSS-drawn triangle/quadrilateral with angle labels. Angles rendered as `<span>` labels inside positioned `<div>` arms; angle arcs in CSS. No external SVG.
- The quadrilateral in medium rounds is a parallelogram (easiest to draw in CSS as a transformed rectangle).
- Closest approved spec template: `stats-mean-direct` (given data, compute value, select MCQ answer). Same computation-to-MCQ pattern, different content domain.
- Timer: 45 seconds per round.
- 3 lives.

---

## Full Misconceptions Coverage Table

| Misconception | Game | NCERT Chapter | Research Source |
|---------------|------|---------------|-----------------|
| Larger arms = larger angle (perceptual size illusion) | Game 1 | Cl 7 Ch 5 | CPP/BSCS 2017 |
| Reflex angles are "not real" / stop at 180° | Game 1 | Cl 7 Ch 5 | Biber et al. 2013 |
| Right angle only recognised at standard orientation | Game 1 | Cl 7 Ch 5 | ENAD 2021 |
| Equilateral triangle is not isosceles (class inclusion) | Game 2 | Cl 7 Ch 6 | Ozkan & Bal 2017 |
| Right triangle cannot be isosceles | Game 2 | Cl 7 Ch 6 | van Hiele level 2 |
| Square is not a rectangle | Game 3 | Cl 8 Ch 3 | Ozkan & Bal 2017 |
| Rhombus is a "tilted square" not a distinct type | Game 3 | Cl 8 Ch 3 | Ozkan & Bal 2017 |
| Parallelogram diagonals are always equal | Game 3 | Cl 9 Ch 8 | Biber et al. 2013 |
| Triangle angle sum = 360° (confusion with quad) | Game 4 | Cl 7 Ch 6 | Padmavathy 2015 |
| Supplementary = 90° (not 180°) | Game 4 | Cl 7 Ch 5 | Padmavathy + Biber |
| Missing angle = 180° minus one angle only | Game 4 | Cl 7 Ch 6 | Padmavathy 2015 |
| Exterior angle = supplementary to interior angle | Game 4 | Cl 7 Ch 6 | NCERT Ch 6 §6.5 |

---

## Curriculum Alignment

### NCERT

| Chapter | Section | Topic | Games |
|---------|---------|-------|-------|
| Class 7 Ch 5 | §5.3 | Types of angles (acute/obtuse/right/straight/reflex) | Game 1 |
| Class 7 Ch 5 | §5.4 | Complementary, supplementary, adjacent, linear pair | Game 1 (hard), Game 4 |
| Class 7 Ch 6 | §6.1–6.2 | Triangle classification (sides + angles) | Game 2 |
| Class 7 Ch 6 | §6.5 | Angle sum property of triangle | Game 4 (easy + medium) |
| Class 7 Ch 6 | §6.6 | Exterior angle property | Game 4 (hard) |
| Class 8 Ch 3 | §3.2 | Angle sum of a polygon (quadrilateral = 360°) | Game 4 (medium) |
| Class 8 Ch 3 | §3.3–3.5 | Types of quadrilaterals + properties | Game 3 |
| Class 9 Ch 6 | §6.1–6.3 | Lines + angles — parallel lines, transversals | Game 1 (extension) |
| Class 9 Ch 7 | §7.1–7.2 | Triangles — congruence (extends Game 2) | Game 2 (hard) |
| Class 9 Ch 8 | §8.3–8.4 | Parallelogram properties | Game 3 (medium + hard) |

### Common Core (US Alignment)

| Standard | Topic | Game |
|----------|-------|------|
| CCSS 4.G.A.1 | Draw + identify angles; identify right, acute, obtuse | Game 1 |
| CCSS 4.MD.C.5 | Angles as turns; degrees as a unit | Game 1 |
| CCSS 7.G.A.2 | Triangles from conditions — angle conditions | Game 2 |
| CCSS 7.G.B.5 | Use angle facts (supplementary, vertical, adjacent) | Game 4 |
| CCSS 8.G.A.5 | Angle sum and exterior angle of triangles | Game 4 (hard) |
| CCSS HSG.CO.C.11 | Parallelogram properties | Game 3 |

---

## Session Predecessor / Successor Links

**Predecessor:** Statistics Session (stats-identify-class, stats-mean-direct, stats-median, stats-mode)
- Prerequisite from stats: data identification and classification skills (Bloom L1) carry over to geometry classification tasks
- No mathematical dependency — geometry session is independent content but same Bloom progression

**Successor:** Fractions Session (planned — TBD) OR Algebra: Linear Equations (NCERT Class 8 Ch 2)
- Geometry session's angle-sum computation (Game 4 hard: solve for x in `2x + 40° = 180°`) is a direct bridge to linear equations
- Recommended: queue Algebra/Linear Equations session immediately after Geometry, using Game 4 hard rounds as the prerequisite check

**Within-session order (strict):** Game 1 → Game 2 → Game 3 → Game 4. Do not build or deploy out of order.

---

## CDN Interaction Pattern Mapping

| Game | Pattern Name | Closest Approved Template |
|------|-------------|--------------------------|
| geo-angle-id | visual-mcq-5-options | `stats-identify-class` (MCQ from diagram/description) |
| geo-triangle-sort | dual-step-mcq | `find-triangle-side` (two-step MCQ state machine) |
| geo-quad-match | property-to-class-mcq | `stats-identify-class` (classify from property list) |
| geo-angle-sum | computation-mcq | `stats-mean-direct` (compute value → MCQ) |

All four games use proven CDN patterns. No new interaction patterns required.

---

## Session Planner JSON (target output format)

```json
{
  "curriculum": "NCERT",
  "grades": [7, 8, 9],
  "topic": "geometry-foundations",
  "bloomRange": "L1-L3",
  "concept_node_order": [
    {
      "node": "angle-types",
      "game": "geo-angle-id",
      "ncert": "Cl7 Ch5 §5.3",
      "misconceptions": ["size-illusion", "reflex-not-real", "orientation-dependency"],
      "template": "stats-identify-class",
      "estimatedMinutes": 5
    },
    {
      "node": "triangle-classification",
      "game": "geo-triangle-sort",
      "ncert": "Cl7 Ch6 §6.1-6.2",
      "misconceptions": ["class-inclusion-equilateral", "right-isosceles-impossible"],
      "template": "find-triangle-side",
      "estimatedMinutes": 6
    },
    {
      "node": "quadrilateral-properties",
      "game": "geo-quad-match",
      "ncert": "Cl8 Ch3 §3.3-3.5",
      "misconceptions": ["square-not-rectangle", "prototype-recognition", "diagonal-equality"],
      "template": "stats-identify-class",
      "estimatedMinutes": 7
    },
    {
      "node": "angle-sum-computation",
      "game": "geo-angle-sum",
      "ncert": "Cl7 Ch6 §6.5, Cl8 Ch3 §3.2",
      "misconceptions": ["triangle-sum-360", "supplementary-90", "one-angle-subtraction"],
      "template": "stats-mean-direct",
      "estimatedMinutes": 6
    }
  ],
  "totalMinutes": 24,
  "sessionCount": 1,
  "predecessor": "statistics-session",
  "successor": "algebra-linear-equations"
}
```

---

## Build Order and Notes

**Do not queue any game until Statistics Session is approved.** The stats session (4 games) is in-flight. Once stats-median and stats-mode are approved, this geometry session becomes the next build target.

**First build target:** `geo-angle-id` — simplest interaction (pure MCQ), no two-step state machine required. Spec can be generated directly from `stats-identify-class` as the template.

**Spec generation readiness per game:**

| Game | Template spec ready? | Spec writing can start? | Notes |
|------|---------------------|------------------------|-------|
| geo-angle-id | Yes (`stats-identify-class` approved) | Yes — after stats-mode approved | CSS angle drawing is the only new element |
| geo-triangle-sort | Yes (`find-triangle-side` approved) | Yes — after geo-angle-id approved | Two-step MCQ pattern already proven |
| geo-quad-match | Yes (`stats-identify-class` approved) | Yes — after geo-triangle-sort approved | Property list instead of diagram |
| geo-angle-sum | Yes (`stats-mean-direct` approved) | Yes — after geo-quad-match approved | CSS diagram + computation MCQ proven |

**CSS drawing note (applies to Games 1, 2, 4):** All angle/triangle/quadrilateral diagrams should use CSS `transform: rotate()` on `div` elements — no SVG, no canvas, no external image assets. This is within reliable generation range for the pipeline. The `find-triangle-side` spec (build #549) already demonstrated CSS triangles work.
