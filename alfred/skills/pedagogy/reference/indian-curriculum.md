# Indian Curriculum Specifics

## NCERT/CBSE Alignment

**[SUGGESTED]** The primary target is NCERT textbooks for Classes 4-8 (CBSE board). Every game spec should reference the specific NCERT chapter and exercise it aligns to. (Tagging note: no hard validator enforces NCERT chapter references; creators may target other boards or skip explicit chapter mapping.)

| Class | Key math domains (NCERT) | Bloom levels typically appropriate |
|-------|-------------------------|-----------------------------------|
| Class 4 | Number sense, basic operations, shapes, patterns, measurement | L1, L2 |
| Class 5 | Fractions intro, factors/multiples, area/perimeter, data handling | L1, L2 |
| Class 6 | Integers, fractions operations, ratio/proportion, geometry intro, data handling | L2, L3 |
| Class 7 | Rational numbers, algebraic expressions, triangles, data handling, congruence | L2, L3 |
| Class 8 | Linear equations, quadrilaterals, data handling, squares/cubes, comparing quantities | L3, L4 |

## NCERT Chapter Mapping (Key Topics)

When creating a spec, verify the topic exists in the stated class's NCERT textbook:

| Topic | NCERT Class | Chapter (approx) | Common game types |
|-------|-------------|-------------------|-------------------|
| Addition/subtraction facts | 4 | Ch 3-4 | Speed Blitz, MCQ Quiz |
| Multiplication tables | 4-5 | Ch 4-5 | Speed Blitz, Memory Match |
| Fractions comparison | 5-6 | Ch 7 (Class 5), Ch 7 (Class 6) | Sort/Classify, MCQ Quiz |
| Fractions operations | 6-7 | Ch 2 (Class 7) | Lives Challenge, Construction |
| Integers | 6-7 | Ch 6 (Class 6), Ch 1 (Class 7) | MCQ Quiz, Lives Challenge |
| Ratio and proportion | 6 | Ch 12 | MCQ Quiz, Lives Challenge |
| Algebraic expressions | 7-8 | Ch 12 (Class 7), Ch 9 (Class 8) | Construction, Lives Challenge |
| Triangles and properties | 7 | Ch 6 | Sort/Classify, MCQ Quiz |
| Data handling (mean, median, mode) | 7-8 | Ch 3 (Class 7), Ch 5 (Class 8) | MCQ Quiz, Sort/Classify |
| Linear equations | 8 | Ch 2 | Lives Challenge, Worked Example |
| Quadrilaterals | 8 | Ch 3 | Sort/Classify, Board Puzzle |

## Common Misconceptions Specific to Indian Students

These are misconceptions observed in Indian classrooms. They overlap with universal misconceptions but have specific cultural/pedagogical roots:

| Misconception | Root cause | Prevalence |
|--------------|-----------|------------|
| "Multiply means make bigger" | Over-generalization from whole numbers; breaks with fractions | Very high in Class 5-6 during fractions unit |
| Subtraction is commutative (a - b = b - a) | Not corrected early; students rearrange to avoid borrowing | High in Class 4-5 |
| = sign means "the answer is" not "both sides are equal" | Taught procedurally: 3 + 4 = ___; not relationally: ___ = 3 + 4 | Very high across all classes |
| Larger denominator = larger fraction | Whole-number ordering transferred to fractions | Very high in Class 5-6 |
| Area requires a formula; no area without a formula | Over-reliance on formula sheets; counting squares not connected to formulas | High in Class 5-7 |
| Zero has no role in multiplication | "Adding zero doesn't change anything" generalized to "zero doesn't matter" | Moderate in Class 4-5 |
| Variables are labels (3a = 3 apples) | Common instructional shortcut in Indian textbooks ("let a = apples") | Very high in Class 6-7 |
| Geometry is about identifying shapes, not properties | Assessment focuses on "name this shape" not "what properties does this shape have" | High in Class 5-7 |
| Statistics = calculating mean | Mode and median under-taught; mean dominates instruction time | High in Class 7-8 |

## Hindi/English Math Vocabulary

**[SUGGESTED]** Many Indian students learn math in English at school but think about it in Hindi. When writing game text, use English terms but be aware of Hindi equivalents for common confusions:

| English | Hindi (Devanagari) | Hindi (transliterated) | Notes |
|---------|-------------------|----------------------|-------|
| Triangle | त्रिभुज | tribhuj | Literally "three-angled" -- this helps students remember angle sum |
| Rectangle | आयत | aayat | |
| Square | वर्ग | varg | Also means "class/category" -- can confuse |
| Circle | वृत्त | vritt | |
| Perimeter | परिमाप | parimaap | Literally "around-measurement" -- helpful for understanding |
| Area | क्षेत्रफल | kshetraphal | Literally "field-result" |
| Fraction | भिन्न / अंश | bhinn / ansh | "bhinn" = different, "ansh" = part |
| Numerator | अंश | ansh | Same word as "fraction" -- confusing for students |
| Denominator | हर | har | |
| Ratio | अनुपात | anupaat | |
| Proportion | समानुपात | samaanupaat | "sam" (equal) + "anupaat" (ratio) |
| Mean | माध्य / औसत | maadhya / ausat | "ausat" (average) is more commonly known |
| Median | माध्यिका | maadhyika | Rarely used in Hindi-medium; students often don't know this term |
| Mode | बहुलक | bahulak | "Most frequent" -- the Hindi is more descriptive than "mode" |
| Equation | समीकरण | samikaran | Literally "making equal" -- useful for teaching = sign meaning |
| Variable | चर | char | "That which changes" |
| Hypotenuse | कर्ण | karn | Also means "ear" in everyday Hindi |
| Right angle | समकोण | samkon | "sam" (equal/right) + "kon" (angle) |
| Parallel | समांतर | samaantar | |
| Perpendicular | लम्ब | lamb | |

**Usage rule:** Game text is in English. But when a student is stuck on a term, the hint/scaffolding may include: "This is the karn (hypotenuse) -- the longest side of a right triangle." Use Hindi terms as bridges, not replacements.

## Regional Board Considerations

While NCERT/CBSE is the primary target, be aware:

- **Maharashtra SSC (Marathi medium):** Geometry is taught earlier; statistics is introduced later. Topic ordering differs from NCERT.
- **Karnataka SSLC (Kannada medium):** Similar to NCERT but with different exercise numbering. Proofs are emphasized earlier.
- **Tamil Nadu State Board:** Algebra is introduced earlier (Class 6 vs NCERT Class 7).

For now, always design to NCERT sequencing. Flag in the spec if a game targets a non-NCERT sequence.
