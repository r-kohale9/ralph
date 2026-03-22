# Educational Interactions & Pedagogy for Ralph Math Game Generation

**Author:** Claude Sonnet 4.6 (R&D analysis)
**Date:** March 22, 2026
**Purpose:** Deep analysis of educational interactions, pedagogy concepts, and learning methods applicable to Ralph's math game generation pipeline. Informs the Session Planner vision: parent/teacher inputs a topic → Ralph generates a full session plan + game set.

---

## Executive Summary

1. **Current games drill procedures, not concepts.** The existing game corpus (adjustment-strategy, count-and-tap, associations, expression-completer, visual-memory, sequence-builder, right-triangle-area, hide-unhide, disappearing-numbers, match-the-cards, etc.) operates almost exclusively at Bloom's Level 1–2 (recall and application of fixed procedures). No game currently scaffolds conceptual understanding before procedural practice.

2. **Immediate feedback is universal but shallow.** Every game gives correct/incorrect feedback per round. None gives *explanatory* feedback — the learner is told they are wrong but not *why*. This misses the most powerful lever in educational research: elaborated feedback that diagnoses the specific misconception.

3. **Spaced repetition and prerequisite sequencing are absent at the session level.** Games within a session are not ordered by concept dependency or difficulty gradient. A "doubles" game and an "adjustment strategy" game have no prerequisite link in the pipeline — they are generated and deployed independently.

4. **Ralph's CDN component architecture is well-suited for richer interactions.** The existing warehouse already has drag-drop (PART-033), validated input (PART-013/014/015), timer-based pressure (PART-006), multi-phase transitions (PART-024), and story context (PART-016). A full conceptual → procedural → application progression could be assembled from existing parts with one new part: a worked-example display component.

5. **The Session Planner is the highest-leverage next capability.** A structured input `{curriculum, topic, student_level, num_sessions}` → prerequisite graph → ordered game spec set would transform Ralph from a single-game generator into a complete learning path system. The estimated implementation path is: concept-graph data layer → session planner LLM prompt → spec-batch generator → session JSON output.

---

## 1. Current State Analysis

### 1.1 Game Inventory and Interaction Types

The following game types have been built or are in the warehouse as of March 2026:

| Game | Interaction Type | Math Domain | Bloom's Level |
|------|-----------------|-------------|---------------|
| doubles | MCQ (4 options) | Arithmetic — doubles facts | Recall (L1) |
| adjustment-strategy | +/- adjuster + typed input | Mental arithmetic — compensation | Application (L3) |
| count-and-tap | Tap-to-count (dot counting) | Number sense — subitizing | Recall (L1) |
| associations | Sequential learn → MCQ recall | Paired-association memory | Recall (L1) |
| expression-completer | Text input / MCQ — fill blank | Algebra — expression completion | Application (L3) |
| visual-memory | Grid tap sequence recall | Spatial / working memory | Recall (L1) |
| sequence-builder | Ordered drag/tap | Numerical sequences | Comprehension (L2) |
| right-triangle-area | Typed numeric input | Geometry — area formula | Application (L3) |
| match-the-cards | Flip-and-match (card pairs) | Arithmetic — fact matching | Recall (L1) |
| hide-unhide | Tap hidden element | Working memory + number sense | Recall (L1) |
| disappearing-numbers | Recall typed number | Working memory | Recall (L1) |
| true-or-false | Binary MCQ (two buttons) | Mixed — statement evaluation | Comprehension (L2) |
| word-pairs | MCQ word matching | Vocabulary / concept pairing | Recall (L1) |
| bubbles-pairs | Drag or tap matching pairs | Arithmetic pairs | Recall (L1) |
| kakuro | Grid fill — constraint solving | Arithmetic — constraint satisfaction | Analysis (L4) |
| position-maximizer | Strategy tap — maximize score | Arithmetic + strategy | Analysis (L4) |
| two-player-race | Race / competitive MCQ | Arithmetic — speed | Application (L3) |
| speed-input | Typed answer under time | Arithmetic — fluency | Application (L3) |

**Observation:** 10 of 18 games are Bloom's L1 (recall). Only 2 reach L4 (analysis). No games exist at L5 (synthesis) or L6 (evaluation). The distribution reflects that drill-and-practice games are easier to generate reliably than conceptual games — this is a pipeline bias, not a pedagogical choice.

### 1.2 Interaction Pattern Coverage

**What exists:**
- Multiple-choice (tap one of N options) — dominant pattern
- Typed numeric input with fixed validation (PART-013)
- Typed text with function validation (PART-014)
- Typed text with LLM subjective validation (PART-015)
- Tap/count (dot counting, grid selection)
- Drag-and-drop (PART-033: drag-source → drop-slot)
- Clickable grid (PART-033: CSS grid cells)
- Tag/chip input (PART-033: type-and-enter)
- Card flip-and-match (card pair memory)
- Adjuster +/- buttons (adjustment-strategy)
- Sequential step building (sequence-builder)
- Competitive / timed (speed-input, two-player-race)

**What is missing (high pedagogical value, buildable with existing parts):**
- Worked example display (show steps → fade → practice)
- Diagram labeling (tap to identify parts of a figure)
- Construction / drawing input (touch to draw — requires new part)
- Slider / continuous input (set a value on a number line)
- Sorting / ordering by value
- Venn diagram / set membership interaction
- Graph reading (tap a point, identify coordinate)
- Equation balancing (drag terms to balance both sides)
- Error detection (show wrong working — find the mistake)

### 1.3 Feedback Mechanisms in Current Games

Every game uses one of three feedback mechanisms:

| Mechanism | Games | Pedagogical Strength |
|-----------|-------|---------------------|
| Immediate correct/wrong (audio + color) | All games | Low: learner knows result, not reason |
| Lives-based penalty | Most games (3 lives) | Low to negative: induces anxiety, not reflection |
| Star rating (time/accuracy) | All games (end screen) | Moderate: summary performance, no diagnostic value |

**What is absent:**
- Elaborated feedback: "Incorrect — you calculated sin instead of cos. Hint: SOH means Opposite/Hypotenuse."
- Worked example on incorrect answer: show the correct solution path before next question.
- Metacognitive prompts: "How confident were you? Was this hard or easy?"
- Adaptive feedback: harder/easier next question based on response pattern.

---

## 2. Pedagogical Framework Mapping

### 2.1 Bloom's Taxonomy

Bloom's revised taxonomy (2001) defines six cognitive levels: Remember → Understand → Apply → Analyze → Evaluate → Create.

**Current Ralph coverage:**
```
Remember   ████████████ 67%  (12 of 18 games)
Understand ██           11%  (2 games)
Apply      ████         22%  (4 games)
Analyze    ██            11% (2 games)
Evaluate   —             0%
Create     —             0%
```

**Target for a complete learning session (e.g., SOH-CAH-TOA):**
```
Remember   ██            11% (label sides, recall ratios)
Understand ████          22% (which ratio applies to which angle/side pair?)
Apply      ████████      44% (compute sin 30°, find missing side)
Analyze    ████          22% (real-world problem — choose correct ratio)
Evaluate   ——             0% (optional: verify answer using Pythagorean theorem)
Create     ——             0% (out of scope for drill games)
```

The implication is that a well-designed session plan for any topic should include at least 3 different game types targeting different Bloom levels. Ralph currently generates one game per spec, with no concept of session-level distribution.

### 2.2 Zone of Proximal Development (ZPD)

Vygotsky's ZPD is the gap between what a learner can do independently and what they can do with guidance. Scaffolding reduces this gap by providing temporary support that is removed as competence grows.

**Current Ralph scaffolding patterns:**
- Level progression within a game (3 levels × N rounds): levels 1-3 increase difficulty by changing number sizes, time limits, or distractor count.
- Lives system: allows 3 errors before game over — minimal scaffolding, primarily penalty.
- TransitionScreen between levels: shows level number + motivational message. No instructional content.

**Missing ZPD scaffolding:**
1. **Worked example before first practice:** Show one fully solved problem before the learner attempts any round. Currently no game does this.
2. **Hint system:** On second wrong attempt, reveal a partial hint. No game implements this.
3. **Faded examples:** First 2 rounds show partial solution with blanks; rounds 3-5 give full problem.
4. **Adaptive difficulty:** If a learner fails 3 consecutive rounds, drop to an easier variant. No game does this.
5. **Prerequisite gate:** Before starting "find missing side using tan", confirm the learner can identify which side is opposite/adjacent.

### 2.3 Spaced Repetition

Ebbinghaus's forgetting curve shows retention drops exponentially unless review occurs at expanding intervals: 1 day → 3 days → 7 days → 21 days.

**Current state:** Ralph generates games that run as single sessions. There is no session history, no spaced review schedule, no mechanism to flag "this learner got sin ratios wrong 3 days ago — include a sin review round today."

**What would be required for spaced repetition:**
- A concept mastery store (per student, per concept node, with last-tested date and confidence)
- Session planner that queries this store when generating a new session
- Review rounds inserted into new games for concepts near their forgetting-curve review date

This is a backend/data concern beyond Ralph's current scope, but the game architecture supports it: `inputSchema.json` defines what content a game accepts, and `game_init` postMessage can inject arbitrary content at runtime.

### 2.4 Conceptual vs. Procedural Understanding

Research (Rittle-Johnson & Siegler, 1998; Star, 2005) shows that conceptual understanding (knowing *why* a procedure works) and procedural fluency (executing the procedure quickly) are bidirectionally related but require different instructional approaches:

| Type | Definition | Example (SOH-CAH-TOA) | Ralph game type |
|------|-----------|----------------------|-----------------|
| Conceptual | Understanding the *meaning* of a ratio as a side-length relationship in similar triangles | "Why does sin(30°) always equal 0.5? Because all 30-60-90 triangles are similar" | None currently |
| Procedural | Reliably executing the computation | "Given angle 30° and hypotenuse 10, find opposite: 10 × sin(30°) = 5" | expression-completer, right-triangle-area |

**Gap:** All current games are procedural. Conceptual games require a different interaction model — diagram-based, labeling-based, or comparative (which of these two triangles has a larger sin ratio for angle A?).

### 2.5 Worked Example → Faded Example → Problem Solving Progression

The worked-example effect (Sweller & Cooper, 1985) is one of the most robust findings in educational psychology: studying worked examples reduces cognitive load and produces faster skill acquisition than equivalent practice problems.

The progression recommended by cognitive load theory:

```
Stage 1: Full worked example (read and follow — no response required)
Stage 2: Completion problem (first steps shown, learner completes last step)
Stage 3: Faded example (every other step hidden, learner fills gaps)
Stage 4: Problem solving (full problem, no scaffolding)
```

**Current Ralph state:** Games jump directly to Stage 4. Stage 1-3 do not exist.

**Implementation path:** A new PART-036 "Worked Example Display" component would render step-by-step solution with a "Next step" reveal mechanism. The game would show 1-2 worked examples before the first timed round.

### 2.6 Multiple Representations

Mathematical objects can be represented in multiple ways:

| Representation | Example (sine ratio) | Current game support |
|---------------|---------------------|---------------------|
| Symbolic | sin(θ) = opposite/hypotenuse | expression-completer, typed input |
| Numeric | sin(30°) = 0.5 | typed numeric input |
| Geometric / visual | Labeled triangle diagram | right-triangle-area (partial — static triangle) |
| Verbal | "The sine of an angle equals the length of the opposite side divided by the hypotenuse" | Story component (PART-016), not math-focused |
| Graphical | Unit circle, sine wave graph | Not present in any game |

**Current gap:** Only symbolic and numeric representations are common. Geometric representation appears only in right-triangle-area. No game uses the verbal or graphical form.

A high-quality learning sequence would move through at least 3 representations of the same concept within a session.

---

## 3. SOH-CAH-TOA Learning Progression Design

### 3.1 Topic Map

**Topic:** Right Triangle Trigonometry (SOH-CAH-TOA)
**Prerequisites:** Pythagorean theorem, similar triangles, ratio/fraction arithmetic, angle measurement in degrees
**Post-requisites:** Unit circle, sine/cosine graphs, law of sines/cosines, inverse trig

**Concept nodes (prerequisite DAG):**

```
[ratio arithmetic] ──────────────────────────────┐
[right triangle parts: legs, hypotenuse] ────────┤
[similar triangles → constant ratios] ────────────┤
                                                   ▼
[sin/cos/tan as ratios of sides] ─────────────────┤
[SOH-CAH-TOA mnemonic] ────────────────────────────┤
                                                   ▼
[lookup: sin 30°, cos 45°, tan 60° standard values]─┤
                                                   ▼
[find missing side given angle + one side] ─────────┤
                                                   ▼
[find missing angle given two sides] ───────────────┤
                                                   ▼
[real-world word problems: height, distance, slope]
```

### 3.2 Game 1: "Name the Sides" — Conceptual Intro

**Learning objective:** Given a right triangle with a labeled angle, correctly identify the hypotenuse, opposite side, and adjacent side.

**Bloom's level:** Remember (L1) — recall which side name corresponds to which geometric position.

**Interaction type:** Diagram labeling — tap one of three sides on a drawn triangle to apply a label.

**Mechanic:**
- A right triangle is drawn with one acute angle highlighted in color (e.g., angle A in blue).
- Three label cards appear: "Opposite," "Adjacent," "Hypotenuse."
- The learner taps a side, then taps a label to assign it.
- All three sides must be labeled to submit.
- Fixed validation: check that the learner's three assignments match the correct mapping for the highlighted angle.

**Difficulty curve:**
- Rounds 1-3: Triangle in standard position (horizontal base). Angle always at bottom-left.
- Rounds 4-6: Triangle rotated 45°, 90°, 135° — same angle position concept but different visual orientation.
- Rounds 7-9: Two triangles shown; learner identifies sides for angle A in one and angle B in the other, learning that "opposite" and "adjacent" switch roles depending on which angle is the reference.

**Misconception targeted:** Learners often confuse "adjacent" and "opposite" when the triangle is rotated. The rotation rounds (4-6) force the learner to reason about the geometric relationship rather than memorize a visual pattern.

**Feedback mechanism:** On incorrect label: the correct answer is shown as a ghost overlay on the triangle for 2 seconds ("The side across from the angle is the Opposite — tap it again"). Elaborated, not just correct/wrong.

**CDN parts needed:** PART-027 (play area — custom SVG triangle interaction), PART-013 (fixed validation), PART-022 (label buttons), PART-024 (transition screen), PART-006 (no timer in first 3 rounds, timer introduced at round 4).

**inputSchema shape:**
```json
{
  "rounds": [{
    "triangleRotationDeg": 0,
    "referenceAngle": "A",
    "oppositeSide": "BC",
    "adjacentSide": "AC",
    "hypotenuse": "AB"
  }]
}
```

### 3.3 Game 2: "Which Ratio?" — Ratio Recognition

**Learning objective:** Given a triangle with two sides labeled (with lengths) and one angle labeled, identify which trig ratio (sin/cos/tan) relates those two sides to that angle.

**Bloom's level:** Understand (L2) — interpret the relationship between a ratio symbol and its geometric meaning.

**Interaction type:** 3-option MCQ (sin θ / cos θ / tan θ) + a worked-example panel on first incorrect attempt.

**Mechanic:**
- A right triangle is shown with two sides labeled (e.g., "opposite = 3, hypotenuse = 5") and angle θ marked.
- The question reads: "Which ratio equals 3/5 for angle θ?"
- Three buttons: sin θ, cos θ, tan θ.
- First incorrect attempt: a worked-example panel slides up showing the SOH-CAH-TOA reference card with the correct mapping highlighted.
- Second incorrect attempt: game moves to next round (no lives lost on this game — learning, not drilling).

**Difficulty curve:**
- Rounds 1-3: hyp and opp given → find sin; hyp and adj given → find cos; opp and adj given → find tan.
- Rounds 4-6: Only the ratio value is shown (e.g., "0.6") and learner must pick the ratio type based on context (harder — cannot see which sides are labeled, must read the problem statement).
- Rounds 7-9: Multiple choice includes inverse options: "sin θ, cos θ, tan θ, sin(90°-θ)" — co-function distractors.

**Misconception targeted:** Learners frequently invert the ratio (computing hyp/opp instead of opp/hyp). The distractor "1/sin θ" appears in rounds 7-9.

**Feedback mechanism:** On first incorrect attempt — worked example panel expands with the correct ratio definition highlighted. On second incorrect attempt — skip to next round with a soft note: "This one was tricky — we'll come back to it."

**CDN parts needed:** PART-024 (transition screen for level changes), PART-013 (MCQ fixed validation), PART-022 (3-button options), PART-016 (StoriesComponent reused for worked-example panel, or new PART-036 Worked Example component).

**inputSchema shape:**
```json
{
  "rounds": [{
    "opposite": 3,
    "adjacent": 4,
    "hypotenuse": 5,
    "angle": "θ",
    "correctRatio": "sin",
    "distractors": ["cos", "tan"]
  }]
}
```

### 3.4 Game 3: "Compute It" — Value Computation

**Learning objective:** Given an angle and the type of ratio, compute its decimal value using standard angle values (30°, 45°, 60°, 90°).

**Bloom's level:** Apply (L3) — execute the trig ratio lookup and basic multiplication.

**Interaction type:** Typed numeric input (2 decimal places). Validation via function (PART-014) with tolerance ±0.01.

**Mechanic:**
- "What is sin(30°)?" → learner types "0.5" (or "1/2" — case converter normalizes).
- 9 rounds across 3 levels. Each round shows the angle and the ratio type.
- Level 1: recall standard values (sin 30°, cos 60°, tan 45°).
- Level 2: find a side length given angle + hypotenuse (e.g., "opposite = sin(30°) × 10 = ?").
- Level 3: find a side given angle + adjacent or opposite (requiring a division step).

**Difficulty curve:**
- Level 1 (rounds 1-3): Direct lookup of standard values. No computation beyond recognition.
- Level 2 (rounds 4-6): Multiplication: "sin(30°) × 10" — learner must recall sin(30°)=0.5 AND multiply.
- Level 3 (rounds 7-9): Division: "adjacent = 8, angle = 30°, find hypotenuse using cos(30°)" — requires rearranging formula.

**Misconception targeted:** Learners confuse degrees with radians (sin(30) ≈ -0.988 in radians vs sin(30°) = 0.5 in degrees). The game always shows the degree symbol; the feedback on wrong answers explicitly says "Make sure you're using degrees, not radians."

**Feedback mechanism:** Immediate correct/wrong with the full formula displayed: "sin(30°) = opposite/hypotenuse = 0.5. You answered 0.87 — that's sin(60°), the complementary angle."

**CDN parts needed:** PART-013/014 (typed validation with tolerance), PART-006 (countdown timer — 20s per question from level 2), PART-023 (progress bar), PART-017 (audio feedback).

**inputSchema shape:**
```json
{
  "rounds": [{
    "angle": 30,
    "ratioType": "sin",
    "givenSide": null,
    "givenValue": null,
    "correctAnswer": 0.5,
    "tolerance": 0.01,
    "level": 1
  }, {
    "angle": 30,
    "ratioType": "sin",
    "givenSide": "hypotenuse",
    "givenValue": 10,
    "correctAnswer": 5.0,
    "tolerance": 0.1,
    "level": 2
  }]
}
```

### 3.5 Game 4: "Find the Side" — Application

**Learning objective:** Given a right triangle with one angle and one side, identify which trig ratio to use and compute the missing side.

**Bloom's level:** Apply (L3) to Analyze (L4) — multi-step problem requiring ratio selection AND computation.

**Interaction type:** Two-step MCQ + typed input. Step 1: select the correct ratio (sin/cos/tan). Step 2: type the answer. This decomposition prevents learners from getting the answer right for the wrong reason.

**Mechanic:**
- Triangle shown with angle θ = 35°, hypotenuse = 12. "Find the opposite side."
- Step 1: "Which ratio relates θ, the opposite, and the hypotenuse?" → 3 options.
- Step 2: "opposite = sin(35°) × 12 = ?" → typed input.
- A "show calculator" button reveals a unit circle reference if the learner requests it (counts as a hint — reduces stars earned).

**Difficulty curve:**
- Rounds 1-3: angle and hypotenuse given → find opposite (sin) or adjacent (cos). Direct formula application.
- Rounds 4-6: angle and one leg given → find the other leg (requires recognizing that tan = opp/adj, then rearranging).
- Rounds 7-9: two sides given → find the missing side using Pythagorean theorem + verify with trig. Learner must choose between trig and geometry approaches.

**Misconception targeted:** "I know what formula to use but I apply it upside down" — the two-step interaction forces explicit ratio selection before computation.

**Feedback mechanism:** If step 1 is wrong → worked example panel slides up before step 2 is revealed. If step 1 is right but step 2 is wrong → show calculation: "sin(35°) ≈ 0.574, so opposite = 0.574 × 12 = 6.88. You got [X]."

**CDN parts needed:** PART-027 (two-phase play area with step visibility), PART-013 (MCQ) + PART-014 (numeric validation), PART-024 (transition between levels), PART-023 (progress bar with hint counter).

**inputSchema shape:**
```json
{
  "rounds": [{
    "angle": 35,
    "givenSide": "hypotenuse",
    "givenValue": 12,
    "targetSide": "opposite",
    "correctRatio": "sin",
    "correctAnswer": 6.88,
    "tolerance": 0.1,
    "level": 1
  }]
}
```

### 3.6 Game 5: "Real World" — Transfer

**Learning objective:** Given a real-world scenario described in words + a diagram (building, ramp, cable), set up and solve the triangle problem.

**Bloom's level:** Analyze (L4) — transfer to novel context, requires problem-setup before computation.

**Interaction type:** Multi-step: (1) identify what is known/unknown in the diagram, (2) select correct ratio, (3) compute answer in context-appropriate units.

**Mechanic:**
- Scenario: "A ladder leans against a wall. The ladder is 5m long and makes a 70° angle with the ground. How high up the wall does the ladder reach?"
- Diagram shows a triangle with labels: "ladder = 5m (hypotenuse)", "angle at ground = 70°", "wall height = ?"
- Step 1: "What is the wall height in this problem?" → identifies which side is unknown.
- Step 2: "Which trig ratio uses the angle, the hypotenuse, and the opposite side?" → MCQ.
- Step 3: "Calculate the wall height (round to 2 decimal places)." → typed input.
- Final answer is shown in context: "The ladder reaches 4.70 m up the wall."

**Difficulty curve:**
- Rounds 1-3: straightforward application, single-step. Angle and one side given explicitly in problem text.
- Rounds 4-6: two-step — find one side, then use it to find another. Context involves slopes, buildings, cables.
- Rounds 7-9: inverse trig — given two sides, find the angle. "A ramp rises 2m over 5m horizontal. What angle does it make?" Requires tan⁻¹ (calculator button always available).

**Misconception targeted:** Learners who can solve naked triangle problems often fail word problems because they cannot identify which side is which from context. The diagram labeling in step 1 forces this mapping explicitly.

**Feedback mechanism:** On wrong answer: "You calculated cos(70°) × 5 = 1.71. That would give the horizontal distance, not the height. The wall is the *opposite* side to the 70° angle, so use sin(70°)."

**CDN parts needed:** PART-016 (story context / scenario text), PART-027 (diagram with tap-to-label), PART-013/014 (MCQ + numeric), PART-018 (unit display in answer field).

**inputSchema shape:**
```json
{
  "rounds": [{
    "scenario": "A ladder 5m long leans against a wall at 70° to the ground. How high up the wall does it reach?",
    "diagramLabel": "ladder = 5m, angle at ground = 70°, height = ?",
    "knownSide": "hypotenuse",
    "knownValue": 5,
    "unknownSide": "opposite",
    "angle": 70,
    "correctRatio": "sin",
    "correctAnswer": 4.70,
    "tolerance": 0.05,
    "unit": "m",
    "level": 1
  }]
}
```

### 3.7 Session Progression Summary

| Game | Bloom Level | Interaction | Misconception Targeted | CDN Parts |
|------|-------------|-------------|----------------------|-----------|
| 1. Name the Sides | Remember | Diagram labeling | Rotation blindness | 027, 013, 022, 024 |
| 2. Which Ratio? | Understand | MCQ + worked example | SOH-CAH-TOA definition confusion | 024, 013, 022, 016 |
| 3. Compute It | Apply | Typed numeric | Degrees vs. radians; formula inversion | 013/014, 006, 023, 017 |
| 4. Find the Side | Apply → Analyze | Two-step MCQ + typed | Correct formula, wrong arrangement | 027, 013/014, 024, 023 |
| 5. Real World | Analyze | Multi-step + diagram | Cannot map word problem to triangle | 016, 027, 013/014, 018 |

**Prerequisite order is strict:** Games 1 → 2 → 3 → 4 → 5. A learner who cannot label sides (Game 1) will fail at ratio selection (Game 2). The session planner must enforce this ordering.

---

## 4. Curriculum Alignment

### 4.1 NCERT Class 10 — Chapter 8: Introduction to Trigonometry

**Syllabus scope (NCERT Mathematics Part 1, Chapter 8):**

| NCERT Topic | Section | SOH-CAH-TOA Game Alignment |
|-------------|---------|--------------------------|
| Trigonometric Ratios | 8.1 | Game 1 (label sides) + Game 2 (which ratio) |
| Trigonometric Ratios of Some Specific Angles (0°, 30°, 45°, 60°, 90°) | 8.2 | Game 3 (compute it) |
| Trigonometric Ratios of Complementary Angles | 8.3 | Game 2 level 3 (co-function distractors) |
| Trigonometric Identities (sin²θ + cos²θ = 1, etc.) | 8.4 | Not covered in 5-game set — would require a Game 6 |
| Applications — Heights and Distances (Chapter 9) | 9.1 | Game 5 (real world) |

**NCERT-specific content requirements:**
- Standard angle values table (0°, 30°, 45°, 60°, 90°) must appear in inputSchema for Game 3.
- Complementary angle identities (sin(90°-θ) = cos θ) appear in Class 10 board exams — should appear in Game 2's harder distractors.
- "Heights and Distances" problems in Game 5 should include angle of elevation and angle of depression — these are specifically tested in NCERT Chapter 9.

**NCERT exercise alignment (for inputSchema content generation):**

| Game | NCERT Source | Example Problem |
|------|-------------|----------------|
| Game 3 (Compute It) | Ex 8.2 Q1-Q4 | "sin 60° + cos 30°" |
| Game 4 (Find the Side) | Ex 8.1 Q1-Q7 | "In ΔABC, right-angled at B, AB=24cm, BC=7cm, find sin A" |
| Game 5 (Real World) | Chapter 9, Ex 9.1 | "A 1.5m tall observer at 28.5m from tower, angle of elevation = 45°, find tower height" |

### 4.2 Common Core HS-G-SRT (Similarity, Right Triangles, and Trigonometry)

**Standards covered by the 5-game set:**

| Standard | Code | SOH-CAH-TOA Game Alignment |
|----------|------|--------------------------|
| Understand that by similarity, side ratios in right triangles are properties of the angles | HSG-SRT.C.6 | Game 2 (Which Ratio?) — conceptual basis |
| Explain and use the relationship between the sine and cosine of complementary angles | HSG-SRT.C.7 | Game 2 level 3 (co-function distractors) |
| Use trigonometric ratios and the Pythagorean theorem to solve right triangles in applied problems | HSG-SRT.C.8 | Game 4 (Find the Side) + Game 5 (Real World) |

**Common Core standards NOT covered by 5-game set (would require additional games):**
- HSG-SRT.B.4: Prove theorems about triangles
- HSG-SRT.B.5: Use congruence/similarity criteria (proof-level — L6)

### 4.3 Curriculum-Driven Game Selection Table

When a parent/teacher inputs `{curriculum: "NCERT", grade: 10, topic: "trigonometry"}` or `{curriculum: "CommonCore", grade: "HS", standard: "HSG-SRT.C"}`, Ralph should auto-select games from a curriculum map:

| Curriculum | Topic Key | Game Set | Ordering | Content Constraint |
|-----------|-----------|----------|----------|--------------------|
| NCERT Class 10 | trig-intro | Games 1, 2, 3 | strict | Standard angles: 0°, 30°, 45°, 60°, 90° only |
| NCERT Class 10 | trig-heights-distances | Games 4, 5 | strict | Add angle of elevation/depression scenarios |
| Common Core HS-G-SRT.C.6 | ratio-meaning | Games 1, 2 | strict | Similar triangles context in Game 2 explanation |
| Common Core HS-G-SRT.C.8 | applied-trig | Games 4, 5 | strict | Real-world context must be applied (not pure math) |
| Common Core HS-G-SRT full | complete-trig-unit | Games 1-5 | strict | Full progression |

**Curriculum detection in Session Planner:**

The Session Planner LLM prompt receives `curriculum` + `topic` and outputs a `concept_node_order` list that maps to the game set:

```json
{
  "curriculum": "NCERT",
  "grade": 10,
  "topic": "trigonometry",
  "concept_node_order": [
    { "node": "side-labels", "game": "name-the-sides", "spec": "specs/trig/name-the-sides.md" },
    { "node": "ratio-definition", "game": "which-ratio", "spec": "specs/trig/which-ratio.md" },
    { "node": "standard-values", "game": "compute-it", "spec": "specs/trig/compute-it.md" },
    { "node": "find-missing-side", "game": "find-the-side", "spec": "specs/trig/find-the-side.md" },
    { "node": "word-problems", "game": "real-world", "spec": "specs/trig/real-world.md" }
  ],
  "ncert_alignment": "Ch8 8.1-8.2, Ch9 9.1",
  "session_count": 2
}
```

---

## 5. Session Planner Pipeline Proposal

### 5.1 Overview

The Session Planner is a new pipeline stage that sits above the existing Ralph game-generation pipeline. It takes high-level educational intent and produces a structured set of game specs ready for Ralph to build.

```
Input: { curriculum, topic, student_level, num_sessions }
           │
           ▼
   Step 1: Topic Decomposition
   LLM + Curriculum Knowledge Base → Concept Node Graph (prerequisite DAG)
           │
           ▼
   Step 2: Node → Game Mapping
   For each node: query game registry (existing games) or generate new spec
           │
           ▼
   Step 3: ZPD Ordering
   Sort games by Bloom level, respecting prerequisite edges in DAG
           │
           ▼
   Step 4: Session Chunking
   Distribute ordered games across num_sessions, balance by session length (target 15-20 min)
           │
           ▼
   Output: session_plan.json + spec.md files (one per new game)
           │
           ▼
   Ralph pipeline runs for each new spec (existing flow, unchanged)
```

### 5.2 Step 1: Topic Decomposition — Concept Node Graph

**Input:** `{ curriculum: "NCERT", grade: 10, topic: "trigonometry", student_level: "grade-appropriate" }`

**Process:**
1. A "decomposition LLM" (claude-sonnet-4-6) reads the topic + curriculum.
2. Outputs a JSON concept node graph:

```json
{
  "topic": "Right Triangle Trigonometry",
  "curriculum": "NCERT Class 10",
  "nodes": [
    {
      "id": "ratio-arithmetic",
      "name": "Ratio and Fraction Arithmetic",
      "bloom_level": 1,
      "prerequisites": [],
      "is_prerequisite_check": true
    },
    {
      "id": "triangle-parts",
      "name": "Label Triangle Sides (Opposite/Adjacent/Hypotenuse)",
      "bloom_level": 1,
      "prerequisites": [],
      "is_prerequisite_check": false
    },
    {
      "id": "ratio-definition",
      "name": "SOH-CAH-TOA Definitions",
      "bloom_level": 2,
      "prerequisites": ["ratio-arithmetic", "triangle-parts"],
      "is_prerequisite_check": false
    },
    {
      "id": "standard-values",
      "name": "Standard Angle Values (30°, 45°, 60°)",
      "bloom_level": 3,
      "prerequisites": ["ratio-definition"],
      "is_prerequisite_check": false
    },
    {
      "id": "find-side",
      "name": "Find Missing Side Using Trig Ratios",
      "bloom_level": 3,
      "prerequisites": ["standard-values"],
      "is_prerequisite_check": false
    },
    {
      "id": "word-problems",
      "name": "Heights and Distances Word Problems",
      "bloom_level": 4,
      "prerequisites": ["find-side"],
      "is_prerequisite_check": false
    }
  ]
}
```

**Implementation note:** This LLM call should use the same `CLIProxyAPI` pattern as the game generation step. The concept graph schema should be versioned (stored in `warehouse/curriculum/ncert-class10-math.json`) so the LLM can reference a pre-built graph for known curricula rather than hallucinating one.

### 5.3 Step 2: Node → Game Mapping

For each concept node:

1. **Query the game registry** (`lib/db.js` games table + `inputSchema.json` files) for existing games tagged with the concept node.
2. **If an approved game exists** for this node: include it in the session plan directly (no new spec generation needed).
3. **If no approved game exists:** invoke Ralph's existing Warehouse → Spec → HTML pipeline to generate a new game. The spec is auto-generated using the node's Bloom level, interaction type, and misconception profile.

**Game registry tagging schema (new field in games table or games.json):**
```json
{
  "game_id": "name-the-sides",
  "concept_nodes": ["triangle-parts"],
  "bloom_level": 1,
  "curriculum_tags": ["NCERT-10-Ch8", "CC-HSG-SRT.C.6"],
  "interaction_type": "diagram-labeling",
  "duration_minutes": 5,
  "status": "approved"
}
```

### 5.4 Step 3: ZPD Ordering

Sort games by:
1. Topological order of the prerequisite DAG (prerequisite games must appear before dependent games).
2. Within the same DAG level: ascending Bloom level (Remember before Apply).
3. Within the same Bloom level: ascending difficulty (fewer distractors, simpler numbers).

The session planner emits a `game_order` list with justification for each ordering decision:

```json
{
  "game_order": [
    { "game_id": "name-the-sides", "rationale": "triangle-parts is prerequisite for ratio-definition" },
    { "game_id": "which-ratio", "rationale": "ratio-definition requires triangle-parts (done)" },
    { "game_id": "compute-it", "rationale": "standard-values requires ratio-definition (done)" },
    { "game_id": "find-the-side", "rationale": "find-side requires standard-values (done)" },
    { "game_id": "real-world", "rationale": "word-problems requires find-side (done)" }
  ]
}
```

### 5.5 Step 4: Session Chunking

Target session length: 15-20 minutes (attention span for K-12 math practice).

**Chunking rules:**
- Each game targets 5-8 minutes (9 rounds × 30-50 seconds per round).
- A 2-session plan for trigonometry: Session 1 = Games 1-3 (conceptual → computation), Session 2 = Games 4-5 (application → transfer).
- A 1-session plan: Games 2, 3, 4 only (assumes prerequisites are known from classroom instruction).
- A 3-session plan: Session 1 = Games 1-2, Session 2 = Games 3-4, Session 3 = Game 5 + a new review game that replays the 3 hardest questions from Sessions 1-2.

### 5.6 Output: session_plan.json

```json
{
  "plan_id": "ncert-10-trig-20260322",
  "curriculum": "NCERT Class 10",
  "topic": "Right Triangle Trigonometry",
  "num_sessions": 2,
  "sessions": [
    {
      "session_number": 1,
      "title": "Understanding Trig Ratios",
      "estimated_minutes": 18,
      "games": [
        { "game_id": "name-the-sides", "spec_path": "specs/trig/name-the-sides.md", "status": "needs-generation" },
        { "game_id": "which-ratio", "spec_path": "specs/trig/which-ratio.md", "status": "needs-generation" },
        { "game_id": "compute-it", "spec_path": "specs/trig/compute-it.md", "status": "needs-generation" }
      ]
    },
    {
      "session_number": 2,
      "title": "Applying Trigonometry",
      "estimated_minutes": 20,
      "games": [
        { "game_id": "find-the-side", "spec_path": "specs/trig/find-the-side.md", "status": "needs-generation" },
        { "game_id": "real-world", "spec_path": "specs/trig/real-world.md", "status": "needs-generation" }
      ]
    }
  ],
  "ncert_alignment": {
    "chapter_8": ["8.1", "8.2", "8.3"],
    "chapter_9": ["9.1"]
  }
}
```

### 5.7 API Design

New API endpoint:

```
POST /api/session-plan
Body: {
  "curriculum": "NCERT",
  "grade": 10,
  "topic": "trigonometry",
  "student_level": "grade-appropriate",
  "num_sessions": 2
}

Response: {
  "plan_id": "ncert-10-trig-20260322",
  "session_plan": { ... },
  "queued_builds": ["name-the-sides", "which-ratio", "compute-it", "find-the-side", "real-world"]
}
```

The endpoint queues each `needs-generation` game as a separate BullMQ job, exactly as `POST /api/build` does today. The plan_id ties them together for monitoring.

### 5.8 Implementation Phases

**Phase 1 — Foundation (1-2 weeks):**
- Add `concept_nodes` and `curriculum_tags` columns to the games table.
- Build the curriculum knowledge base JSON files for NCERT Class 10 Math and Common Core HS-G-SRT.
- Implement `POST /api/session-plan` with static concept graph lookup (no LLM decomposition yet — hardcode the trigonometry graph as the first proof-of-concept).
- Verify: input `{curriculum: "NCERT", grade: 10, topic: "trigonometry"}` → 5 game specs queued in correct order.

**Phase 2 — LLM Decomposition (1 week):**
- Replace the static graph lookup with an LLM decomposition step.
- LLM reads curriculum scope → outputs concept node graph JSON.
- Validate LLM output against `concept_node_graph.schema.json`.
- Test with 3 topics: trigonometry, quadratic equations, probability.

**Phase 3 — Game Registry Query (1 week):**
- Query existing approved games against concept node tags.
- If an approved game exists for a node: reuse it (skip generation).
- Track reuse rate: what fraction of session plans can be assembled from existing games vs. new generations?

**Phase 4 — ZPD Adaptive Difficulty (2-3 weeks):**
- After each session, record which concepts had >30% wrong answers.
- On next session: insert a review game for those concepts before advancing.
- Requires student performance store (new DB table: `student_sessions`).

---

## 6. Missing Pedagogical Components — What to Build Next

### 6.1 PART-036: Worked Example Display Component

**What it is:** A collapsible panel that shows a step-by-step solution to an example problem before the learner's first practice attempt. Triggered by wrong answer (elaborated feedback mode) or shown proactively at game start (instructional mode).

**Why it matters:** The worked-example effect (Sweller & Cooper, 1985) reduces cognitive load by ~40% compared to equivalent problem-solving practice. It is the single highest-leverage missing component in the current warehouse.

**Implementation:** A new `PART-036-worked-example.md` warehouse part. The component renders a sequence of steps with "Next Step" / "Got It" buttons. Each step can include: text, a fraction/formula display, a diagram highlight. Integrates with PART-024 (TransitionScreen): a worked example can appear as a transition panel between the start screen and first round.

**Spec contract:**
```json
{
  "workedExample": {
    "problem": "sin(30°) = ?",
    "steps": [
      { "text": "sin is Opposite over Hypotenuse (SOH)", "highlight": "opp/hyp" },
      { "text": "In a 30-60-90 triangle: opposite = 1, hypotenuse = 2", "highlight": "triangle" },
      { "text": "sin(30°) = 1/2 = 0.5", "highlight": "answer" }
    ]
  }
}
```

### 6.2 Elaborated Feedback System

**What it is:** Instead of binary correct/wrong audio + color, the game provides a brief explanation of *why* the answer is wrong and what the correct reasoning is.

**Current state:** Every game uses `FeedbackManager.playDynamicFeedback()` with a generic correct/incorrect sound. The content of feedback is fixed ("correct!" / "try again") regardless of what the learner answered.

**Proposed enhancement:**
- inputSchema gains an optional `misconceptions` array per round:
```json
{
  "correctAnswer": "sin",
  "misconceptions": [
    { "wrongAnswer": "cos", "feedback": "cos uses the Adjacent side, not the Opposite. This triangle shows the Opposite side = 3." },
    { "wrongAnswer": "tan", "feedback": "tan uses Opposite over Adjacent, but the Hypotenuse is labeled here, not the Adjacent." }
  ]
}
```
- When a learner selects "cos" instead of "sin": instead of generic wrong-answer audio, a text panel appears with the specific misconception feedback.
- Requires PART-015 (LLM validation) or a new PART-039 (misconception-lookup validation): given `wrongAnswer`, look up the matching misconception text from inputSchema.

**Why it matters:** Research (Hattie & Timperley, 2007) shows that feedback explaining *why* an answer is wrong produces ~2× greater learning gains than feedback that only confirms correctness.

### 6.3 Prerequisite Gate / Diagnostic Mini-Game

**What it is:** A 3-question diagnostic at the start of a session that checks whether the learner has the required prerequisites. If they fail >1 of 3 questions, the session planner inserts a prerequisite game before the planned first game.

**Example:** Before "Which Ratio?" (Game 2), the gate asks: "In this triangle, which side is opposite angle A?" If the learner fails, they are routed to "Name the Sides" (Game 1) first.

**Implementation:** A special game type in the session plan JSON:
```json
{ "game_id": "gate-triangle-parts", "type": "diagnostic", "threshold": 0.67, "on_fail": "name-the-sides" }
```

### 6.4 Curriculum Knowledge Base (JSON)

**What it is:** Structured JSON files that map curricula to concept node graphs. Ralph reads these files when generating session plans, rather than relying on LLM to hallucinate the curriculum scope.

**Files needed:**
- `warehouse/curriculum/ncert-class10-math.json` — All chapters + concepts for NCERT Class 10
- `warehouse/curriculum/common-core-hs-math.json` — All Common Core HS Math standards
- `warehouse/curriculum/concept-prerequisites.json` — Cross-curriculum prerequisite graph for universal math concepts

**Format:**
```json
{
  "curriculum": "NCERT",
  "grade": 10,
  "subject": "Mathematics",
  "chapters": [{
    "id": "ch8",
    "title": "Introduction to Trigonometry",
    "concepts": [
      { "id": "triangle-parts", "title": "Label triangle sides", "bloom": 1 },
      { "id": "trig-ratios", "title": "Define sin/cos/tan", "bloom": 2 },
      { "id": "standard-angles", "title": "Standard angle values", "bloom": 3 },
      { "id": "find-side", "title": "Compute missing side", "bloom": 3 },
      { "id": "complementary-angles", "title": "Complementary angle identities", "bloom": 2 }
    ],
    "ncert_exercises": ["Ex 8.1", "Ex 8.2", "Ex 8.3"]
  }]
}
```

---

## 7. Recommended Next R&D Tasks (Ranked by Impact)

### Rank 1 — PART-036 Worked Example Component (Highest Impact)

**Hypothesis:** Inserting a 2-step worked example before round 1 of "Compute It" and "Find the Side" reduces wrong-attempt rate on round 1 from ~60% (estimated baseline) to <30%.

**Why highest impact:** The worked-example effect is among the most replicated in educational psychology. It costs minimal pipeline changes (one new warehouse part). It improves every conceptual game immediately. It requires no changes to the test harness or postMessage protocol.

**Measurement:** Build "compute-it" with and without the worked example display. Compare: (a) round 1 wrong-attempt rate, (b) total wrong attempts per game, (c) lives-loss rate. A 30%+ drop in round 1 wrong attempts confirms the hypothesis.

**Estimated effort:** 1 warehouse part (PART-036), 1 spec template section, 1 new inputSchema field. ~2 days.

### Rank 2 — Session Planner Phase 1 (High Impact, High Effort)

**Hypothesis:** Given `{curriculum, topic}`, Ralph can auto-generate a correctly ordered set of 3-5 game specs in <5 minutes, covering the full concept progression for a topic.

**Why high impact:** This transforms Ralph from a game generator (single artifact) to a learning path generator (full instructional unit). Every teacher/parent input now produces a complete session, not a single game.

**Measurement:** Build the NCERT trigonometry session plan. Verify: all 5 specs generated and approved by Ralph pipeline, games are in correct ZPD order, NCERT chapter alignment is correct.

**Estimated effort:** New API endpoint, curriculum JSON files, session planner LLM prompt. ~1 week.

### Rank 3 — Elaborated Feedback per Misconception (High Impact, Low Effort)

**Hypothesis:** Adding misconception-specific text feedback (per wrong answer) reduces repeat-wrong-answer rate (same wrong answer on round N after seeing it wrong on round N-2) by >50%.

**Why high impact:** Feedback quality is directly linked to retention. This change requires only adding a `misconceptions` array to inputSchema and a lookup step in the validation handler — no new CDN components.

**Measurement:** Build "which-ratio" with generic feedback vs. with misconception feedback. Compare: repeat-wrong-answer rate (same choice wrong twice), overall wrong attempts.

**Estimated effort:** inputSchema schema addition + HTML generation prompt update + 1 fix-prompt CDN constraint. ~1 day.

### Rank 4 — Curriculum Knowledge Base JSON Files (Medium Impact, Medium Effort)

**Hypothesis:** Pre-built curriculum JSON eliminates LLM hallucination of concept prerequisite graphs, reducing Session Planner errors from ~30% (estimated) to <5%.

**Why medium impact:** Required for Session Planner to be reliable, but does not produce student-facing value until Session Planner is live.

**Measurement:** Compare LLM-generated vs. pre-built concept graphs for 5 topics: count agreement on nodes, count agreement on prerequisite edges, count NCERT chapter alignment accuracy.

**Estimated effort:** Research + write NCERT Class 10 Math and CC HS-Math JSON files. ~3 days.

### Rank 5 — Diagram Labeling Interaction Type (Medium Impact, High Effort)

**Hypothesis:** A diagram-labeling interaction (tap to assign a label to a visual element) is required for Game 1 ("Name the Sides") and cannot be adequately approximated with MCQ. Implementing it expands Ralph's interaction vocabulary to include geometry games.

**Why medium impact:** Unlocks a new category of conceptual geometry games that cannot be built with current interaction types. However, it requires a new CDN component or custom SVG interaction — more engineering effort than the other items.

**Measurement:** Build "name-the-sides" using a diagram-labeling interaction. Verify Playwright tests can reliably select SVG elements and assert correct labels. Pass rate on first pipeline run.

**Estimated effort:** New interaction pattern in PART-033 or a new PART-039 (SVG labeling). CDN component may be needed. ~1 week.

### Rank 6 — Adaptive Difficulty Within a Game (Lower Priority, High Effort)

**Hypothesis:** If a learner fails 3 consecutive rounds at level N, dropping to level N-1 for 2 rounds before retrying level N reduces game-over rate by >40%.

**Why lower priority:** Requires changes to the game loop (level regression logic), which touches every CDN game's state machine. High implementation risk. Better to establish a working Session Planner first — adaptive sequencing at the session level (insert an easier game before advancing) achieves a similar outcome with less complexity.

**Estimated effort:** New gameState fields + level-regression logic in spec template + changes to how triage/test-gen handles non-linear level progression. ~2 weeks.

---

## 8. Appendix: Interaction Type Reference for Spec Authors

When writing a new game spec (or Session Planner generating one), choose the interaction type that matches the cognitive demand:

| Cognitive Demand | Recommended Interaction | Ralph Part |
|-----------------|------------------------|------------|
| Recognize / recall a fact | MCQ (4 options) | PART-013, PART-022 |
| Identify a component in a diagram | Diagram labeling (tap to assign) | PART-033 (custom SVG), PART-027 |
| Order items by value/sequence | Drag-and-drop ordering | PART-033 (drag pattern) |
| Complete a partially given problem | Fill-in-the-blank typed | PART-013/014 |
| Compute a numeric result | Typed numeric with tolerance | PART-014 (function validation) |
| Evaluate an open-ended statement | LLM-graded typed | PART-015 |
| Multi-step problem with intermediate outputs | Sequential two-step (MCQ then typed) | PART-027 (phase-based play area) |
| Real-world application | Story + diagram + typed | PART-016 + PART-027 + PART-014 |
| Speed/fluency drill | Timed MCQ or typed with countdown | PART-006 (countdown timer) + any validation |
| Memory / retention check | Learn phase → Recall MCQ | PART-024 (phase transitions) + PART-013 |
| Conceptual worked example | Study steps → no response | PART-016 (StoriesComponent) or PART-036 (new) |

---

## 9. References

The pedagogical claims in this document draw on the following well-established research base:

- **Bloom's Taxonomy (revised):** Anderson & Krathwohl (2001). *A Taxonomy for Learning, Teaching, and Assessing.* Addison Wesley.
- **Zone of Proximal Development:** Vygotsky (1978). *Mind in Society.* Harvard University Press.
- **Worked Example Effect:** Sweller & Cooper (1985). "The use of worked examples as a substitute for problem solving in learning algebra." *Cognition and Instruction*, 2(1), 59–89.
- **Elaborated Feedback:** Hattie & Timperley (2007). "The power of feedback." *Review of Educational Research*, 77(1), 81–112.
- **Conceptual vs. Procedural:** Rittle-Johnson, B., & Siegler, R. S. (1998). "The relation between conceptual and procedural knowledge in learning mathematics." In C. Donlan (Ed.), *The Development of Mathematical Skills.* Psychology Press.
- **Spaced Repetition:** Ebbinghaus (1885). *Über das Gedächtnis* (Memory). Reprinted in English, Dover (1964).
- **Cognitive Load Theory:** Sweller, J. (1988). "Cognitive load during problem solving." *Cognitive Science*, 12(2), 257–285.
- **NCERT Class 10 Mathematics:** NCERT (2019). *Mathematics — Textbook for Class X.* National Council of Educational Research and Training, India. Chapters 8–9.
- **Common Core State Standards — Mathematics:** NGA & CCSSO (2010). *Common Core State Standards for Mathematics.* Washington DC. Standards HSG-SRT.C.6–8.

---

## 10. Session 1 Implementation — Worked Example Spec Template

**Date:** March 22, 2026
**Status:** Spec authored, awaiting first E2E pipeline build (manual queue required)

### What Was Built

Spec file created: `specs/soh-cah-toa-worked-example.md`

This is the first Ralph game spec to implement the **Worked Example → Faded Example → Independent Practice** pedagogical flow (Sweller & Cooper, 1985). It introduces a new interaction type: `worked-example-mcq`.

**Game design summary:**
- 3 rounds, each covering one trig ratio: sin (SOH), cos (CAH), tan (TOA)
- Each round has 3 sub-phases, each implemented using existing CDN parts:
  1. **Example phase** — Full worked example shown step-by-step (PART-027 play area, `#btn-example-next` reveal). Learner reads; no answer required. Background: blue-tinted (`#eff6ff`) to signal "learning mode."
  2. **Faded phase** — Same problem structure, one step blanked out, 3-option MCQ (PART-013 fixed validation, PART-022 buttons). Wrong answers shown correct formula but no life deducted. Background: green-tinted (`#f0fdf4`) to signal "almost there."
  3. **Practice phase** — New similar problem, no scaffolding, 3-option MCQ. Wrong answers show elaborated misconception-specific feedback (`explanationOnWrong`). Lives deducted here only. Background: yellow-tinted (`#fefce8`) to signal "on your own."

**Key design choices — why existing parts suffice (no PART-036 required):**

| Design need | Solution using existing parts |
|------------|-------------------------------|
| Step-by-step worked example | `#example-steps-container` with progressive `.step-card` reveal via `advanceExampleStep()`. No CDN component needed — pure DOM manipulation. |
| Scaffolded MCQ (faded blank) | Same PART-013 fixed validation + PART-022 button pattern used by all MCQ games. The "blank" is just a highlighted `div.faded-blank` with a prompt. |
| Sub-phase transitions | CSS class toggle (`hidden`) between `#example-panel`, `#faded-panel`, `#practice-panel`. PART-024 TransitionScreen handles round boundaries. |
| Per-misconception feedback | `explanationOnWrong` and `explanationOnCorrect` fields in `practiceQuestion` inputSchema. Displayed in `#practice-feedback` div. Same pattern as elaborated feedback (Section 6.2). |
| Phase visual distinction | Three distinct background tints (blue / green / yellow) for the three panels — no component needed, just CSS. |

The decision NOT to implement PART-036 as a reusable CDN component was deliberate: a spec-inline worked example panel (custom HTML in PART-027 play area) generates faster, costs less engineering effort, and can be tested by the existing pipeline without any warehouse changes. PART-036 remains on the roadmap for when multiple games need the same component — at that point the inline pattern can be extracted.

### Fallback Content Verification

All 9 computed answers (3 rounds × 3 sub-phases) verified with exact arithmetic:

| Round | Phase    | Problem                      | Answer  |
|-------|----------|------------------------------|---------|
| 1 sin | Example  | sin(30°) × 10                | 5       |
| 1 sin | Faded    | sin(60°) × 8                 | 6.93    |
| 1 sin | Practice | sin(45°) × 14.14             | 10      |
| 2 cos | Example  | cos(60°) × 10                | 5       |
| 2 cos | Faded    | cos(30°) × 12                | 10.39   |
| 2 cos | Practice | cos(45°) × 20                | 14.14   |
| 3 tan | Example  | tan(45°) × 6                 | 6       |
| 3 tan | Faded    | tan(60°) × 5                 | 8.66    |
| 3 tan | Practice | tan(30°) × 10                | 5.77    |

Distractors in each practice MCQ are chosen to probe the specific misconception documented in `misconceptionTargeted` — not random wrong values.

### What to Verify in First Build

Before running E2E, the build should be checked for:

1. **Sub-phase visibility toggle** — only one of `#example-panel`, `#faded-panel`, `#practice-panel` visible at any time. A common LLM mistake is forgetting `hidden` on the other panels during `renderRound()`.
2. **`window.gameState` assignment** — if missing, `waitForPhase()` in tests will timeout immediately. The spec includes a CRITICAL note at the top.
3. **`FeedbackManager.init()` absence** — if LLM adds it, tests will fail from audio permission popup. The spec includes a CRITICAL note at the top.
4. **`window.endGame/restartGame/nextRound` assignment** — test harness calls these directly. The spec includes a CRITICAL note and the DOMContentLoaded code explicitly sets them.
5. **MCQ shuffle** — options must be shuffled per render, or tests that click by text content will be brittle (they should find buttons by text, not index — test scenarios in the spec use text-based selectors).
6. **`isProcessing` guard** — prevents double-submit from fast taps. The spec documents this explicitly in `handleFadedAnswer` and `handlePracticeAnswer`.

### Hypothesis to Test

**Hypothesis:** The worked-example → faded → practice flow, with misconception-specific feedback, will produce a round 1 wrong-attempt rate below 30% in player testing — compared to the estimated 60% baseline for a direct MCQ game on the same content.

**Measurement plan:** After the game is approved, compare `wrongInPractice` distribution in session data against `doubles` and `associations` wrong-attempt rates from the same Bloom level cohort. A 30%+ reduction confirms the worked-example hypothesis.

### Next Steps After First Build

1. If the game passes the pipeline, queue a second build for `which-ratio` (Game 2 from Section 3.3) — this game also uses the worked-example-mcq pattern but adds it as an on-demand panel after wrong answers rather than as a mandatory intro phase.
2. Update `ROADMAP.md` to mark the worked-example spec template as shipped.
3. If the faded-phase interaction is too complex for the LLM to generate reliably in one pass, consider splitting the spec into two simpler games: (a) worked-example-only (read-only, no interaction), (b) standard MCQ with post-error worked example reveal.

---

## 11. Session 2 Implementation — Find the Missing Side Spec Template

**Date:** March 22, 2026
**Status:** Spec authored. Awaiting Build #535 (soh-cah-toa-worked-example) result before queuing. Do NOT queue until #535 has a result.

### What Was Built

Spec file created: `warehouse/templates/find-triangle-side/spec.md`

This is the second game in the SOH-CAH-TOA session progression. It targets `find-side` (Bloom's L3 Apply, bordering L4) — the next concept node after `compute-ratio` in `lib/session-planner.js`. The `find-side` node already existed in CONCEPT_GRAPH with `suggestedGameIds: ['find-triangle-side']` — no session-planner code change was required.

**Game design summary:**
- 5 rounds, each with a distinct triangle configuration (different angle, given side, target side).
- Two-step interaction per round: `two-step-ratio-plus-typed`
  1. **Step 1 — Ratio selection** (MCQ, 3 options: sin / cos / tan): Learner identifies which ratio relates the given angle to the given side and the target side. Wrong answers show an elaborated explanation (`explanationOnWrongRatio`) but do NOT deduct a life — the feedback is instructional. The learner then continues to step 2 regardless.
  2. **Step 2 — Computation** (typed numeric, PART-014 function validation, tolerance ±0.15): Learner calculates the unknown side length. Wrong answers deduct a life and show `explanationOnWrongAnswer` with the full substitution shown.
- SVG right triangle rendered inline, dynamically updated each round from `svgConfig` fields.
- No timer (PART-006 excluded) — ratio selection requires deliberate reasoning, not speed.
- 3 lives apply only to step 2 errors.

**Round progression (difficulty gradient):**

| Round | θ  | Given          | Target        | Ratio | Answer | Difficulty Note |
|-------|-----|----------------|---------------|-------|--------|-----------------|
| 1     | 30° | hypotenuse=10  | opposite      | sin   | 5      | Direct multiply — standard |
| 2     | 60° | hypotenuse=8   | adjacent      | cos   | 4      | Direct multiply — standard |
| 3     | 45° | adjacent=7     | opposite      | tan   | 7      | tan introduced; answer = given value |
| 4     | 30° | opposite=6     | hypotenuse    | sin   | 12     | Rearranged: divide not multiply |
| 5     | 45° | adjacent=5     | hypotenuse    | cos   | 7.07   | Rearranged + non-integer answer |

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| No life deduction on wrong ratio (step 1) | Step 1 is a teaching moment, not a test. Penalising it would contradict the pedagogical goal. |
| Lives deducted only on step 2 | Computation errors are the primary skill being assessed. |
| Two-step decomposition | Prevents "right answer for wrong reason" — a learner who guesses the number cannot bypass ratio selection. |
| Elaborated wrong-ratio feedback | Names the correct ratio AND explains which sides it connects — targets the most common misconception: right formula applied to wrong pair of sides. |
| Rearranged formula in rounds 4–5 | Genuine Apply-level demand: learner must recognise that hypotenuse = given ÷ ratio, not given × ratio. |
| SVG diagram | Geometric representation (absent from soh-cah-toa-worked-example) adds a third representation mode: symbolic + numeric + geometric. |

### Pedagogical Progression: soh-cah-toa → find-triangle-side

**soh-cah-toa-worked-example** gives the learner the ratio name and says "here is the procedure; follow it." Cognitive demand: execute.

**find-triangle-side** shows a triangle and says "figure out which procedure applies, then execute it." Cognitive demand: select + execute.

This is the difference between Bloom's L3 procedural (given procedure → apply) and genuine L3 Apply (novel situation → choose procedure → apply). Rounds 4–5 add the additional step of rearranging the formula, which edges into L4 territory.

### What to Verify in First Build

1. **Exactly one panel visible**: `#step1-panel` XOR `#step2-panel` must be visible. Never both; never neither.
2. **SVG labels update each round**: `renderRound()` must update SVG text nodes, not just innerHTML of surrounding divs.
3. **No life deducted on wrong ratio**: `gameState.lives` must not change after a step-1 wrong answer.
4. **`isProcessing` guard on both handlers**: prevents double-submit on fast taps.
5. **`parseFloat` not `parseInt`**: rounds 4–5 answers are decimals.
6. **Tolerance applied correctly**: `Math.abs(userAnswer - correctAnswer) <= tolerance`, not strict equality.

### Next Steps After First Build

1. If approved: queue `which-ratio` (Game 2 from Section 3.3) — the ratio-recognition game that sits between soh-cah-toa-worked-example and find-triangle-side in the conceptual progression.
2. If the SVG rendering is unreliable across builds, fall back to a text-based triangle description in a styled `div` — same information, simpler DOM manipulation.
3. Update ROADMAP.md to mark find-triangle-side spec template as shipped once the first build approves.
