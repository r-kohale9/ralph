# Spec Instructions: Game 4 — find-triangle-side

**Session ID:** `trigonometry-class10-20260322-7j6biw`
**Position in session:** 4 of 5
**Skill taught:** Find an unknown side length using a trig ratio
**Bloom level:** L3 — Apply
**Curriculum standard:** NCERT Class 10 Ch 8 §8.2, CC HSG-SRT.C.8
**Estimated time:** 5 minutes
**Template spec:** `games/find-triangle-side/spec.md`
**Template status:** template_exists

---

## Template Spec Reference

Copy from `games/find-triangle-side/spec.md`.

### Preserve Unchanged (DO NOT MODIFY)

- All CDN `<script>` import blocks (`storage.googleapis.com/test-dynamic-assets/...`)
- All `ScreenLayout.inject()` call structure and slot names
- All `data-phase`, `data-testid`, `data-lives` attribute names
- All `postMessage` field names and phase transition logic
- All `WindowPackages.init()` setup and package list
- All `PART-xxx` sub-phase definitions and event wiring
- All `waitForPackages()` timeout and error handling
- All `window.__initError` assignment patterns

### Substitute (CHANGE these values)

- **Round data:** Replace the problem instances, numbers, and answer choices with new values appropriate for this skill.
- **Context labels:** Use grade-appropriate real-world context from the curriculum research.
- **NCERT citation:** Update to `NCERT Class 10 Ch 8 §8.2, CC HSG-SRT.C.8`.
- **Pedagogical rationale comment:** Replace the template's rationale comment with the one below.
- **Game title and intro text:** Update to match this skill.

### Pedagogical Rationale Comment to Embed

```
<!--
  SKILL: Find an unknown side length using a trig ratio
  BLOOM LEVEL: L3 — Apply
  CURRICULUM: NCERT Class 10 Ch 8 §8.2, CC HSG-SRT.C.8
  SESSION POSITION: Game 4 of 5 (prerequisite-ordered)
-->
```

### Misconception This Game Addresses

> **Students confuse the co-function relationship: they believe cos A = cosecant A (the co-prefix creates a false association). Research finds 64% of students hold misconceptions about trigonometric functions and 77% about inverse trigonometric functions.**
> Source: Ancheta (2022) — An Error Analysis of Students' Misconceptions and Skill Deficits in Pre-Calculus Subjects, JETT Vol 13(5) — https://jett.labosfor.com/index.php/jett/article/download/1064/681/5186

## Novelty Check

This game is novel relative to others in this session because: **Computation task (Bloom L3 Apply) — learner performs the arithmetic; builds on earlier classification games.**

## Evidence to Embed as Comments

- Standard: `HSG-SRT.C.6 — Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle, leading to definitions of trigonometric ratios for acute angles.`
- NCERT: Ch 8 — Introduction to Trigonometry §8.1 — Trigonometric Ratios (pp. 181–190) — Exercise 8.1 (11 questions: 7 short, 3 long, 1 reasoning). Q1: Find sin A, cos A, sin C, cos C for right triangle with AB=24, BC=7 — tests relative labelling. Q11: True/False including 'sin θ = 4/3 for some θ' — directly targets the >1 misconception.
- NCERT: Ch 8 — Introduction to Trigonometry §8.2 — Trigonometric Ratios of Some Specific Angles (pp. 190–195) — Exercise 8.2 (14 questions). Standard angle values: 0°, 30°, 45°, 60°, 90°. Common student error: memorising table without understanding derivation from equilateral/isosceles triangles — causes errors under non-standard orientations.
- NCERT: Ch 8 — Introduction to Trigonometry §8.3 — Trigonometric Ratios of Complementary Angles (pp. 195–199) — Exercise 8.3 (7 questions). Key identity: sin(90°-A) = cos A. NCERT proof uses the same right triangle with both acute angles as reference — directly addresses the angle-relativity misconception.
- NCERT: Ch 9 — Some Applications of Trigonometry §9.1 — Heights and Distances — 16 questions (6 easy, 5 moderate, 5 long). Contexts: tower height, angle of elevation/depression, shadow length. Real-world application layer — prerequisite is fluency with Ch 8 ratios. 12 marks assigned from Unit 5 Trigonometry in CBSE Class 10 board exam.
- Misconception source: Ancheta (2022) — An Error Analysis of Students' Misconceptions and Skill Deficits in Pre-Calculus Subjects, JETT Vol 13(5) — https://jett.labosfor.com/index.php/jett/article/download/1064/681/5186

---

_Review this file, then write `spec.md` in this directory using the template as the structural base._