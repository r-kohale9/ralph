# Difficulty Tuning

## The 70-85% Target

**[SUGGESTED]** Optimal learning happens when students succeed 70-85% of the time (Vygotsky's Zone of Proximal Development, validated by modern learning science). Below 70%, students disengage from frustration. Above 85%, they disengage from boredom.

This means:
- **If a game's pass rate is below 70%**: the game is too hard. Reduce difficulty or add scaffolding.
- **If a game's pass rate is above 85%**: the game is too easy. Increase difficulty or reduce scaffolding.
- **Target first-attempt success rate per stage**: Stage 1 = 90%, Stage 2 = 75%, Stage 3 = 60%.

The overall blended rate should land at ~75% for a well-calibrated game.

## Difficulty Calibration Across Stages

Every game has 3 stages (default). Each stage must be harder than the previous one. Here's what "harder" means:

| Transition | What changes | What does NOT change |
|-----------|-------------|---------------------|
| Stage 1 to Stage 2 | ONE difficulty dimension increases | Core mechanic, interaction type, visual layout |
| Stage 2 to Stage 3 | ONE additional dimension increases, OR the Stage 2 dimension increases further | Same as above |

**[SUGGESTED]** Never change more than one dimension at a stage boundary. The student should feel "same game, harder problems" -- not "different game."

## What Makes a Question Hard -- by Domain

### Number Sense

| Easier | Harder | Dimension |
|--------|--------|-----------|
| Single digits | Multi-digit (3+) | Magnitude |
| Round numbers (10, 20, 100) | Non-round (17, 83, 146) | Regularity |
| No carrying/borrowing | Carrying/borrowing required | Procedural load |
| Addition/subtraction | Multiplication/division | Operation complexity |
| One operation | Multiple operations | Step count |

### Fractions

| Easier | Harder | Dimension |
|--------|--------|-----------|
| Same denominator | Different denominators | LCD required |
| Unit fractions (1/n) | Non-unit fractions | Numerator complexity |
| Proper fractions | Improper fractions / mixed numbers | Representation |
| Visual (pie chart) | Abstract (bare numbers) | Representation mode |
| Halves, quarters, thirds | Fifths, sevenths, ninths | Denominator familiarity |

### Geometry

| Easier | Harder | Dimension |
|--------|--------|-----------|
| Regular/standard orientation | Rotated/tilted shapes | Spatial orientation |
| One property to check | Multiple properties to check | Feature count |
| Labeled measurements | Unlabeled (must measure or infer) | Information given |
| Familiar shapes (square, circle) | Composite or irregular shapes | Shape complexity |
| 2D | 3D (nets, cross-sections) | Dimensionality |

### Statistics

| Easier | Harder | Dimension |
|--------|--------|-----------|
| Small data set (5 values) | Large data set (10+) | Set size |
| All positive integers | Includes decimals, negatives, repeats | Data type |
| One measure (just mean) | Compare measures (mean vs median) | Conceptual load |
| Pre-sorted data | Unsorted data | Prerequisite step |
| Clear mode (one value dominates) | Bimodal or no mode | Ambiguity |

### Algebra

| Easier | Harder | Dimension |
|--------|--------|-----------|
| One-step equation (x + 3 = 7) | Two-step (2x + 3 = 7) | Step count |
| Positive coefficients | Negative coefficients | Sign complexity |
| Integer solutions | Fractional solutions | Solution type |
| One variable | Expression simplification (multiple like terms) | Term count |
| No parentheses | Parentheses requiring distribution | Structural complexity |

## Adaptive Difficulty (Future)

Currently not implemented. When implemented, the rule is: if the student gets 3 consecutive correct, skip to next stage. If the student gets 3 consecutive wrong, drop to previous stage. Never drop below Stage 1. This is simple binary adaptation, not sophisticated -- but it's better than nothing.
