# Session Plan: Trigonometry — Prerequisite-Ordered Session

**Session ID:** `trigonometry-class10-20260322-7j6biw`
**Generated:** 2026-03-22 23:12:29 UTC
**Concept:** trigonometry
**Grade level:** Class 10
**Estimated total time:** 24 minutes
**Bloom range:** L1 → L4
**Research complete:** Yes

---

## Standard Statement

> HSG-SRT.C.6 — Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle, leading to definitions of trigonometric ratios for acute angles.

## Prerequisite Chain

- 7.RP.A.2 — Recognize and represent proportional relationships between quantities (Grade 7)
- HSG-SRT.A.3 — Use the properties of similarity transformations to establish the AA criterion for two triangles to be similar (Grade 9)
- Pythagoras theorem — calculate missing sides in right-angled triangles (NCERT Ch 6 §6.5, Grade 9)

## Game Sequence

| Position | Game ID | Bloom L | Bloom Label | Template Spec | Misconception Addressed | Minutes |
|----------|---------|---------|-------------|---------------|------------------------|---------|
| 1 | name-the-sides | 1 | Remember | name-the-sides | Students treat 'opposite' and 'adjacent' as absolute triangl… | 4 min |
| 2 | which-ratio | 2 | Understand | which-ratio | Students use the wrong ratio for the required measurement: s… | 4 min |
| 3 | soh-cah-toa-worked-example | 3 | Apply | soh-cah-toa-worked-example | Students assume 'sin', 'cos', 'tan' are products (i.e., 'sin… | 5 min |
| 4 | find-triangle-side | 3 | Apply | find-triangle-side | Students confuse the co-function relationship: they believe … | 5 min |
| 5 | real-world-problem | 4 | Analyze | real-world-problem | Students make transformation errors: they understand the pro… | 6 min |

**Total:** 5 games, 24 minutes

## Misconceptions Addressed

1. **Students treat 'opposite' and 'adjacent' as absolute triangle properties rather than angle-relative labels. When the reference angle changes (e.g., switching from angle A to angle C in the same triangle), they keep the same side as 'opposite', producing inverted ratios.** — Source: Msi, Matsepe & Sehowa (2026) — Errors in trigonometric proof-related reasoning tasks: Insights from Grade 10 learners, Eastern Cape (https://www.researchgate.net/publication/401706057_Errors_in_trigonometric_proof-related_reasoning_tasks_Insights_from_Grade_10_learners_at_a_rural_Eastern_Cape_school)
2. **Students use the wrong ratio for the required measurement: selecting sin when tan is needed (e.g., using sin 45° to find a horizontal width, when the ratio required is opposite/adjacent = tan 45°). Root cause: memorising SOH-CAH-TOA as a mnemonic without understanding which sides are known vs unknown.** — Source: Syifa & Kurniawati (2026) — Student Error in Grade X on the Concept of Trigonometry Using a Hermeneutic Phenomenological Study, Jurnal Pendidikan Matematika 16(2): 182–196 (https://www.researchgate.net/publication/395418861_Student_Error_in_Grade_X_on_the_Concept_of_Trigonometry_Using_a_Hermeneutic_Phenomenological_Study)
3. **Students assume 'sin', 'cos', 'tan' are products (i.e., 'sin × A') rather than functions of an angle. This surfaces as errors like treating sin A + sin B = sin(A+B). Confirmed by NCERT Ch 8 Remark: 'sin A is not the product of sin and A — sin separated from A has no meaning.'** — Source: NCERT Class 10 Mathematics Textbook Chapter 8 (official PDF, §8.1 Remark) (https://ncert.nic.in/textbook/pdf/jemh108.pdf)
4. **Students confuse the co-function relationship: they believe cos A = cosecant A (the co-prefix creates a false association). Research finds 64% of students hold misconceptions about trigonometric functions and 77% about inverse trigonometric functions.** — Source: Ancheta (2022) — An Error Analysis of Students' Misconceptions and Skill Deficits in Pre-Calculus Subjects, JETT Vol 13(5) (https://jett.labosfor.com/index.php/jett/article/download/1064/681/5186)
5. **Students make transformation errors: they understand the problem statement but cannot convert it into the correct trigonometric model (e.g., failing to draw and label the right triangle from a word problem about heights and distances). 45.6% of errors occur at processing/transformation stage.** — Source: Arhin & Hokor (2021) — Analysis of High School Students' Errors in Solving Trigonometry Problems, Journal of Mathematics and Science Teacher 1(1), em003 (https://www.mathsciteacher.com/download/analysis-of-high-school-students-errors-in-solving-trigonometry-problems-11076.pdf)
6. **Students believe sin θ can be greater than 1 (e.g., sin θ = 4/3 for some angle θ). NCERT Ex 8.1 Q11 explicitly tests this misconception: 'sin θ = 4/3 for some angle θ' — the correct answer is False, because sin θ = opposite/hypotenuse and hypotenuse is always the longest side.** — Source: NCERT Class 10 Chapter 8 Exercise 8.1 Q11(v) — Jagranjosh NCERT Solutions (https://www.jagranjosh.com/articles/ncert-solutions-for-class-10-maths-chapter-8-introduction-to-trigonometry-1729148180-1)

## NCERT References

- Ch 8 — Introduction to Trigonometry §8.1 — Trigonometric Ratios (pp. 181–190): Exercise 8.1 (11 questions: 7 short, 3 long, 1 reasoning). Q1: Find sin A, cos A, sin C, cos C for right triangle with AB=24, BC=7 — tests relative labelling. Q11: True/False including 'sin θ = 4/3 for some θ' — directly targets the >1 misconception.
- Ch 8 — Introduction to Trigonometry §8.2 — Trigonometric Ratios of Some Specific Angles (pp. 190–195): Exercise 8.2 (14 questions). Standard angle values: 0°, 30°, 45°, 60°, 90°. Common student error: memorising table without understanding derivation from equilateral/isosceles triangles — causes errors under non-standard orientations.
- Ch 8 — Introduction to Trigonometry §8.3 — Trigonometric Ratios of Complementary Angles (pp. 195–199): Exercise 8.3 (7 questions). Key identity: sin(90°-A) = cos A. NCERT proof uses the same right triangle with both acute angles as reference — directly addresses the angle-relativity misconception.
- Ch 9 — Some Applications of Trigonometry §9.1 — Heights and Distances: 16 questions (6 easy, 5 moderate, 5 long). Contexts: tower height, angle of elevation/depression, shadow length. Real-world application layer — prerequisite is fluency with Ch 8 ratios. 12 marks assigned from Unit 5 Trigonometry in CBSE Class 10 board exam.

## Engineer Instructions

1. Review each `spec-instructions.md` in the per-game subdirectories.
2. Phase 3 (spec generator) will fill each `spec.md` from its `spec-instructions.md`. Until Phase 3 ships, write `spec.md` manually using the instructions file as a guide.
3. Queue builds in order using `POST /api/build`. **Build-in-order rule:** do not queue game N+1 until game N is APPROVED.
4. Template specs are in `games/<templateSpecId>/spec.md` — preserve ALL CDN sections unchanged.

---

_Generated by Session Planner v1 — Phase 2 (writeSessionDirectory). Spec generation (Phase 3) is next._