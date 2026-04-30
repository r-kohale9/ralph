# Misconception-Aware Distractor Design

## What is a misconception tag?

**[MANDATORY]** A misconception tag is a short, named identifier for a specific wrong belief that leads to a specific wrong answer. It is NOT a random wrong number. Every distractor in every game must exist because a real student would pick it for a real reason. (Tagging note: enforced by data-contract — every distractor must carry misconception_tag/name/explanation; spec-review FAILs on missing tags.)

Format: `MISCONCEPTION-DOMAIN-NUMBER` (e.g., `MISC-FRAC-01`, `MISC-GEO-03`).

Every distractor carries:
- `misconception_tag`: the identifier (e.g., `MISC-FRAC-01`)
- `misconception_name`: human-readable name (e.g., "adds numerators and denominators separately")
- `misconception_explanation`: the feedback shown when this distractor is selected (e.g., "When adding fractions with different denominators, you can't just add the tops and bottoms separately. You need a common denominator first.")

## How to design distractors

For each question, follow this process:

1. **Identify the correct answer** and the procedure to reach it.
2. **List the 2-3 most common wrong procedures** a student would follow for this specific problem. Each wrong procedure is one misconception.
3. **Compute the wrong answer** that each misconception produces. That wrong answer is your distractor.
4. **Name the misconception** and write the explanation that corrects it.
5. **If you need a 4th option**, use a computational error distractor (right procedure, arithmetic mistake) -- tag it `MISC-CALC-01` ("careless calculation error").

Never (all **[MANDATORY]** — distractor design rules enforced by spec-review):
- Use random wrong numbers as distractors
- Use distractors that no student would ever pick (e.g., a negative number when all options should be positive)
- Use the same misconception twice in one question
- Use "none of the above" (it teaches nothing when selected)

## Distractor Template

For each question in the content set, provide:

```
Question: What is 2/3 + 1/4?

Correct answer: 11/12
  Procedure: LCD = 12, convert to 8/12 + 3/12 = 11/12

Distractor A: 3/7
  Tag: MISC-FRAC-01
  Name: "adds numerators and denominators separately"
  Explanation: "When adding fractions with different denominators, you can't add tops and bottoms separately (2+1)/(3+4). You need to find a common denominator first."

Distractor B: 3/12
  Tag: MISC-FRAC-02
  Name: "finds common denominator but doesn't convert numerators"
  Explanation: "Good -- you found 12 as the common denominator. But you also need to adjust the numerators: 2/3 becomes 8/12, not 2/12."

Distractor C: 8/12
  Tag: MISC-FRAC-03
  Name: "converts only the first fraction"
  Explanation: "You correctly converted 2/3 to 8/12, but forgot to convert 1/4 to 3/12 before adding."
```

## Misconception Taxonomy by Domain

These are the most common misconceptions per math domain. Use these as a starting checklist when designing distractors. This list is not exhaustive -- add domain-specific misconceptions as they are discovered.

### Number Sense (Class 4-6)

| Tag | Name | Example error |
|-----|------|--------------|
| MISC-NUM-01 | Ignores place value in comparison | Thinks 89 > 102 because "89 looks bigger" |
| MISC-NUM-02 | Treats digits independently | 34 + 27 = 511 (3+2=5, 4+7=11) |
| MISC-NUM-03 | Confuses multiplication with repeated addition count | 4 x 3 = 7 (adds instead of multiplying) |
| MISC-NUM-04 | Subtraction direction reversal | 23 - 17 = 14 (subtracts smaller digit from larger in each column: 7-3, 2-1) |
| MISC-NUM-05 | Zero as "nothing" in multiplication | 30 x 4 = 12 (ignores the zero) |

### Fractions (Class 5-7)

| Tag | Name | Example error |
|-----|------|--------------|
| MISC-FRAC-01 | Adds numerators and denominators separately | 2/3 + 1/4 = 3/7 |
| MISC-FRAC-02 | Finds LCD but doesn't convert numerators | 2/3 + 1/4 = 3/12 |
| MISC-FRAC-03 | Converts only one fraction to LCD | 2/3 + 1/4 = 8/12 + 1/4 |
| MISC-FRAC-04 | Cross-multiplies for addition | 2/3 + 1/4 = (2x4 + 1x3) / (3x4) = 11/12 (correct by accident, but wrong method -- watch for cases where it fails) |
| MISC-FRAC-05 | Larger denominator = larger fraction | Thinks 1/8 > 1/3 because 8 > 3 |
| MISC-FRAC-06 | Cancels digits instead of factors | 16/64 = 1/4 "by cancelling the 6" (correct answer, wrong reason) |
| MISC-FRAC-07 | Treats mixed number as separate whole and fraction | 2 1/3 = 2.13 |

### Geometry (Class 6-8)

| Tag | Name | Example error |
|-----|------|--------------|
| MISC-GEO-01 | Confuses area and perimeter | Uses P = l+b for area |
| MISC-GEO-02 | Forgets to halve for triangle area | A = base x height (no /2) |
| MISC-GEO-03 | Angle sum confusion | Triangle angles sum to 360 (confuses with quadrilateral) |
| MISC-GEO-04 | Confuses radius and diameter | Uses diameter in area formula: A = pi x d^2 |
| MISC-GEO-05 | Identifies shape by appearance not properties | Tilted square is "a diamond, not a square" |
| MISC-GEO-06 | Confuses complementary and supplementary | Complementary = 180 degrees |
| MISC-GEO-07 | Hypotenuse confusion in Pythagoras | Adds all three sides squared: a^2 + b^2 + c^2 |

### Statistics (Class 6-8)

| Tag | Name | Example error |
|-----|------|--------------|
| MISC-STAT-01 | Confuses mean, median, and mode | Calculates mean when asked for median |
| MISC-STAT-02 | Forgets to sort before finding median | Takes middle value of unsorted list |
| MISC-STAT-03 | Divides by wrong count for mean | Divides sum by number of distinct values, not total values |
| MISC-STAT-04 | Thinks mode must be unique | Says "no mode" when two values tie |
| MISC-STAT-05 | Range as single value vs difference | Range = highest value (forgets to subtract lowest) |
| MISC-STAT-06 | Confuses frequency with value | "The mode is 5" when 5 is the frequency, not the value |

### Algebra (Class 6-8)

| Tag | Name | Example error |
|-----|------|--------------|
| MISC-ALG-01 | Distributes addition over multiplication | (a + b) x c = ac + b |
| MISC-ALG-02 | Sign error in negative operations | -3 - 5 = -2 or +8 |
| MISC-ALG-03 | Moves term without changing sign | x + 3 = 7 becomes x = 7 + 3 |
| MISC-ALG-04 | Treats variable as label not quantity | 3a + 2b = 5ab |
| MISC-ALG-05 | Applies operation to one side only | x + 3 = 7 becomes x + 3 - 3 = 7 (forgets to subtract from right) |
| MISC-ALG-06 | Exponent misconception | (a + b)^2 = a^2 + b^2 |
| MISC-ALG-07 | Coefficient invisibility | x means 0x, not 1x |

## Using misconception data for analytics

**[MANDATORY]** Every `recordAttempt` call must include:
- `selected_option`: what the student picked
- `correct_answer`: what was right
- `misconception_tag`: which misconception the selected distractor targets (null if correct)

This enables: "42% of Class 6 students in this school believe you add fractions by adding numerators and denominators separately" -- the single most actionable insight the pipeline can produce.
