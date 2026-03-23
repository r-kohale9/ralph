# Trig Session — SOH-CAH-TOA

**Target concept:** Right-triangle trigonometry (sin/cos/tan definitions and applications)
**Standard:** NCERT Ch 8 §8.1-8.2, Ch 9 §9.1 / CC HSG-SRT.C.6, C.7, C.8
**Total time:** ~15–20 minutes
**Prerequisite:** Basic geometry (right angle, triangle sides), ratio/fraction arithmetic

---

## Session Sequence (prerequisite-ordered)

| Game # | Game ID | Bloom Level | Interaction Type | Status | Build |
|--------|---------|-------------|-----------------|--------|-------|
| 1 | `name-the-sides` | L1 Remember | Diagram labeling — assign Hyp/Opp/Adj labels to 3 triangle sides | APPROVED | #557 APPROVED (iter=3) |
| 2 | `soh-cah-toa-worked-example` | L2 Understand | Worked example sub-phases (example→faded→practice) + MCQ | APPROVED | #544 APPROVED |
| 3 | `find-triangle-side` | L3 Apply | Two-step: select ratio (MCQ) + compute missing side (typed input) | APPROVED | #549 APPROVED |
| 4 | `which-ratio` | L2–L3 Understand→Apply | MCQ + worked example panel on first wrong attempt | active — #558 queued | — |
| 5 | `compute-it` | L3 Apply | Typed numeric input — standard angle values + side computation | planned | — |
| 6 | `real-world-problem` | L4 Analyze | Word-problem-three-step: read diagram → select ratio → compute in context units | spec draft complete (2026-03-23) | — |

**Note on ordering:** The sequence above is strict. A learner who cannot label sides (Game 1) will fail at ratio recognition (Game 2). A learner who does not know which ratio to use (Game 2) will fail at computation (Game 3). Do not build or deploy out of order.

---

## Design Rationale

### Game 1 — name-the-sides (L1 Remember)

The most common failure mode when learning SOH-CAH-TOA is not the mnemonic — learners memorize "SOH" quickly — it is the spatial reasoning required to apply it: which physical side of *this specific triangle, in this specific orientation, relative to this specific angle* is the "opposite"?

This game forces that spatial reasoning explicitly. The triangle is rotated across 9 rounds (standard position → 45°/90°/135° rotations → two-angle rounds where Opp/Adj swap depending on reference angle). A learner who only memorizes a visual pattern will fail at rotation rounds. The game targets the misconception at source.

Interaction: 3 MCQ button rows per side (no custom SVG drag — CSS-drawn triangle with labeled side indicators + button rows). This is simpler to generate reliably while still requiring active label assignment.

### Game 2 — soh-cah-toa-worked-example (L2 Understand)

The "worked example effect" (Sweller & Cooper, 1985) is one of the most replicated findings in educational psychology: studying worked examples reduces cognitive load and produces faster skill acquisition than equivalent practice alone. This game implements the full progression: full worked example → completion problem (faded) → independent practice.

The PART-036 WorkedExampleComponent from the CDN enables step-by-step reveal. Sub-phases: `example` → `faded` → `practice`. The test harness uses `jumpToRound()` and sub-phase targeting. Build #544 established this as a working pattern in the pipeline.

This game is conceptually upstream of `find-triangle-side` (Game 3): it establishes *why* SOH-CAH-TOA works (ratio definition, which sides relate to which angle) before any computation is required.

### Game 3 — find-triangle-side (L3 Apply)

Two-step interaction: step 1 selects the correct ratio (MCQ: sin/cos/tan), step 2 types the computed answer. The decomposition is deliberate — it prevents learners from getting the right numerical answer for the wrong reason (a common issue with pure typed-input games where a learner could guess or use a calculator without understanding ratio selection).

Approved at build #549. 9 rounds, 3 difficulty levels (direct formula → rearrangement → Pythagorean check). Works with `find-triangle-side` spec in the warehouse.

### Game 4 — which-ratio (L2–L3 Understand→Apply)

Bridges ratio recognition (Game 2) and computation (Game 3). Given a triangle with two sides labeled and an angle marked, identify which ratio (sin/cos/tan) relates those two specific sides to that angle. First incorrect attempt reveals a worked-example panel with SOH-CAH-TOA reference card highlighted — the game is explicitly scaffolded, not penalized.

No lives in this game. The pedagogy: "learning mode, not drilling mode." Learners are allowed to fail and see the explanation. Stars are earned by accuracy, not by avoiding failure.

### Game 5 — compute-it (L3 Apply)

Pure computational fluency: given angle + ratio type, compute the value. Standard angles only (0°, 30°, 45°, 60°, 90°) per NCERT Class 10 syllabus. Three levels: direct lookup → multiplication (sin(30°) × 10) → rearrangement (cos(30°) = adj/hyp, find adj).

Misconception targeted: degrees vs. radians confusion (sin(30) ≈ -0.988 in radians vs. sin(30°) = 0.5 in degrees). Feedback explicitly names the error.

### Game 6 — real-world-problem (L4 Analyze)

Transfer to novel context — the hardest Bloom level in the session. A word problem (ladder, ramp, flagpole, or cable) with a diagram. Three explicit steps: (1) read the diagram and identify what is known/unknown, (2) select correct ratio, (3) compute in context units. This decomposition forces the learner to construct the triangle model from a word description, not just execute a formula they are handed.

Spec draft complete 2026-03-23: 714 lines, 4 rounds (ladder/ramp/flagpole/cable), word-problem-three-step interaction, cognitive-demand test category, no new CDN parts. Ready to queue after which-ratio #560 approves.

---

## Misconceptions Targeted

| Misconception | Targeted By |
|--------------|-------------|
| "Opposite" and "Adjacent" are visual positions, not angle-relative | Game 1 — rotation rounds force geometric reasoning |
| SOH-CAH-TOA is just a mnemonic, not a ratio definition | Game 2 — worked example shows the derivation |
| sin(θ) means the angle has value θ (confusing ratio with angle) | Game 2 + Game 3 |
| Using the formula right-side up vs. upside down (opp/hyp vs hyp/opp) | Game 3 — explicit step 1 ratio selection before computation |
| Degrees vs. radians (sin(30) ≠ 0.5 in radians) | Game 5 — feedback names the error explicitly |
| Cannot map a word problem to a triangle diagram | Game 6 — step 1 always requires explicit known/unknown identification |
| sin and cos are interchangeable (co-function confusion) | Game 4 level 3 — sin(90°-θ) = cos θ distractors |

---

## Curriculum Alignment

### NCERT Class 10

| NCERT Section | Topic | Games |
|--------------|-------|-------|
| Ch 8 §8.1 | Trigonometric Ratios (side definitions) | Games 1, 2 |
| Ch 8 §8.2 | Standard Angle Values (0°, 30°, 45°, 60°, 90°) | Game 5 |
| Ch 8 §8.3 | Complementary Angle Identities (sin(90°-θ) = cos θ) | Game 4 level 3 |
| Ch 9 §9.1 | Heights and Distances (angle of elevation/depression) | Game 6 |

### Common Core HS-G-SRT

| Standard | Topic | Games |
|----------|-------|-------|
| HSG-SRT.C.6 | Side ratios in right triangles from angle similarity | Games 1, 2 |
| HSG-SRT.C.7 | Sine and cosine of complementary angles | Game 4 level 3 |
| HSG-SRT.C.8 | Trig ratios + Pythagorean theorem for applied problems | Games 3, 6 |

---

## Build Log

| Build | Game | Status | Key Finding |
|-------|------|--------|------------|
| #544 | soh-cah-toa-worked-example | APPROVED | PART-036 sub-phase pattern (example→faded→practice) works in pipeline; contract 0/2 across all iterations approved at final review (timing artefact, not game logic) |
| #545 | quadratic-formula-worked-example | FAILED | prompts.js line 550 taught wrong postMessage field names (Lesson 169, commit 9eff5e6) |
| #546 | quadratic-formula-worked-example | APPROVED | MCQ shuffle + trackEvent fix at review-fix-1; CDN timing stall early-exit confirmed; CT8 rule derived |
| #549 | find-triangle-side | APPROVED | Two-step MCQ + typed input pattern works; 9 rounds, 3 levels |
| #550 | name-the-sides | FAILED | GEN-114: window.loadRound missing — jumpToRound() was a silent no-op, data-phase stuck at 'results' after endGame(); 0/6 × 3 iterations |
| #552 | name-the-sides | FAILED | GEN-115: contract-fix T1 regression → early-review rejection at iter=0 |
| #553 | name-the-sides | FAILED | GEN-116: interactionType=drag false-positive from prohibition text → 0 passing all batches |
| #554 | name-the-sides | KILLED | GEN-117: transitionScreen.hide() missing → #gameContent display:none → all isVisible() fail; killed at iter=0 |
| #555 | name-the-sides | FAILED (infra) | APPROVED by reviewer — failed post-approval EACCES (warehouse/game/ owned root:root); infra fixed with chown |
| #556 | name-the-sides | FAILED | GEN-118: startGame() called transitionScreen.hide() but never showed #gameContent; game-flow 0/3 all iters |
| #557 | name-the-sides | APPROVED | GEN-116+117+118 compound fix resolved init failure class; iter=3; trig session Game 1 complete |
| #558 | which-ratio | queued | Trig session Game 4 — first build; GEN-114/115/116/117/118 all active |
| — | real-world-problem | spec draft complete (2026-03-23) | 714-line spec: 4 rounds (ladder/ramp/flagpole/cable), word-problem-three-step interaction, cognitive-demand test category, no new CDN parts. Ready to queue after which-ratio #560 approves and soh-cah-toa-worked-example #544 confirmed. |

---

## Session Planner JSON (target output format)

When the Session Planner is implemented, this session should be producible from:

```json
{
  "curriculum": "NCERT",
  "grade": 10,
  "topic": "trigonometry",
  "concept_node_order": [
    { "node": "side-labels", "game": "name-the-sides", "spec": "specs/trig/name-the-sides.md" },
    { "node": "ratio-definition", "game": "soh-cah-toa-worked-example", "spec": "specs/trig/soh-cah-toa-worked-example.md" },
    { "node": "find-missing-side", "game": "find-triangle-side", "spec": "specs/trig/find-triangle-side.md" },
    { "node": "ratio-recognition", "game": "which-ratio", "spec": "specs/trig/which-ratio.md" },
    { "node": "standard-values", "game": "compute-it", "spec": "specs/trig/compute-it.md" },
    { "node": "word-problems", "game": "real-world", "spec": "specs/trig/real-world.md" }
  ],
  "ncert_alignment": "Ch8 §8.1-8.3, Ch9 §9.1",
  "session_count": 2,
  "total_minutes": 18
}
```
