# Education Slot — R&D Intuition and Approach

**Created:** March 22, 2026
**Maintained by:** Education Implementation Slot (mandatory active slot — see CLAUDE.md Rule 14)

---

## 1. The Problem

67% of current warehouse games are Bloom L1 recall only. They test whether a learner can remember a fact or execute a single step, not whether they understand it.

The pattern is: present a question → learner picks an answer → correct/wrong feedback → next question. This is a drill loop. A learner can complete these games by pattern-matching or luck without any genuine cognitive engagement with the underlying concept.

Current Bloom distribution across 18 warehouse games:

```
Remember   ████████████ 67%  (12 of 18 games)
Understand ██           11%  (2 games)
Apply      ████         22%  (4 games)
Analyze    ██           11%  (2 games)
Evaluate   —             0%
Create     —             0%
```

This distribution is a pipeline bias, not a pedagogical choice. Drill games are easier to generate reliably — they have simple, predictable interaction patterns. Higher-order games are harder to spec and harder to validate, so they have not been built.

---

## 2. The Goal

Move the game library toward Bloom L2-L4 — games that require learners to *do* something with knowledge, not just recall it.

- **L2 (Understand):** Can the learner explain the relationship? ("Which ratio uses the opposite and hypotenuse?")
- **L3 (Apply):** Can the learner use the procedure in a new instance? ("Given angle 30° and hyp=10, find opposite.")
- **L4 (Analyze):** Can the learner break down a novel problem and choose the right approach? ("This word problem — what's the triangle, what's known, what ratio applies?")

A well-designed session for any topic should have at least 3 games targeting different Bloom levels. The learner moves from recognition → understanding → application → analysis across the session.

---

## 3. The Approach: Complete Learning Sessions

Rather than isolated games, build **complete learning sessions** — prerequisite-ordered sequences of 4-6 games that take a learner from zero to competency on one concept.

A session is superior to isolated games because:

1. **Prerequisites are guaranteed.** Game 3 (Apply) can assume Game 1 (Remember) and Game 2 (Understand) are complete. Without prerequisite ordering, learners arrive at procedural games without the conceptual foundation to use them.
2. **The learner experiences progression.** Moving from labeling sides → recognizing ratios → computing values → solving word problems is a coherent learning arc. Each game feels like a step forward.
3. **Ralph can eventually generate sessions autonomously.** The long-term vision is: teacher inputs "students should understand right-triangle trigonometry" → Ralph generates a session plan (5 games, prerequisite-ordered, 15-20 minutes) + builds and approves all games → session ready to deploy. Sessions are the primitive that makes this possible.

---

## 4. What Success Looks Like

A learner completes the session and can independently apply the concept in a new context — a problem they have not seen before.

Measured by:

- Does the last game in the sequence (the hardest, highest-Bloom game) have a >80% first-attempt pass rate for learners who completed games 1 through N-1?
- Does each game require the learner to **produce** the target cognitive operation, not just recognize the correct answer? (Recognition — picking from a list — is weaker evidence of understanding than production — constructing an answer from scratch.)
- Does the test harness actually enforce the cognitive demand? A game that claims to be L3 (Apply) but whose tests only check that the correct button was clicked is not validating the cognitive operation.

---

## 5. How We Pick the Next Game to Build

Always build the lowest-Bloom unbuilt game in the session sequence first.

Rationale: approving Game 1 is a prerequisite for Game 2's build. Game 2's spec references concepts taught in Game 1. Game 2's difficulty curve assumes the learner knows what Game 1 taught. If Game 1 is not approved, we cannot verify that Game 2's prerequisite assumptions are correct.

The sequence is strict: 1 → 2 → 3 → 4 → 5. Build in order. Do not skip ahead.

---

## 6. How We Measure Quality

After each game is approved:

1. **Bloom level check:** Does the game actually require the target cognitive operation, or is it secretly a drill in disguise? A game labeled "Apply" that only shows MCQ options is not Apply — it's Understand at best.
2. **Production vs. recognition check:** Does the learner construct the answer (typed input, diagram labeling, two-step MCQ where step 1 requires explicit reasoning) or just pick from a list?
3. **Test harness enforcement check:** Do the Playwright tests actually test the cognitive demand? Tests that only check `data-phase='results'` and star count do not validate that the learner demonstrated the target skill.
4. **Misconception coverage:** Does the game target at least one documented misconception for the concept? (See session plans for the misconception list per game.)

---

## 7. The Long-Term Vision: Session Planner

### The Problem (Deeper)

Writing a spec is the hardest part of using Ralph. A good spec takes 2-4 hours of expert time: curriculum research, Bloom level decisions, interaction design, CDN compliance, test hook wiring. This bottleneck means Ralph can only build games as fast as a human can write specs for them. That does not scale.

There is also a quality risk: specs written by different people make different pedagogical decisions — different Bloom levels, different difficulty curves, different misconception targeting — without a coherent theory connecting them. The result is a library of games that are individually functional but collectively incoherent as a learning path.

The Session Planner removes both constraints.

---

### The Thesis

**A teacher should be able to describe a learning goal in plain language and receive a complete, approved, deployable game session — without writing a single line of spec.**

The key insight is that spec-writing is mostly retrieval and templating, not invention. Given:
- A clear learning objective ("student can compute a missing triangle side using sin/cos/tan")
- A curriculum standard to align to (NCERT Ch 8, CC HSG-SRT.C.6)
- A library of proven interaction patterns (label-assignment, ratio-select, numeric-input, worked-example)
- A library of approved game specs as examples

...the spec for any new game in that space is largely deterministic. The decisions have already been made by the pedagogy research and the approved games. A well-prompted LLM can fill in the template.

---

### The Constraints

The Session Planner cannot work without these being true first:

1. **Ralph must be reliable enough** that a generated spec has a >70% first-attempt approval rate. If Ralph fails most specs, the Session Planner produces a queue of broken builds, not a deployable session. This is why pipeline R&D comes first.

2. **The interaction pattern library must be proven.** The LLM generating specs needs to pick from patterns that are known to work in Ralph. A pattern that looks correct but fails CDN compliance 80% of the time is useless as a template. This is what the education slot is verifying — one pattern at a time.

3. **There must be enough approved specs as few-shot examples.** LLMs generating specs need reference examples. A spec generated without examples tends to hallucinate CDN-incompatible mechanics, wrong test hook names, or Bloom levels that don't match the interaction type. Each approved game in a session is a reference example for future games in the same domain.

4. **The curriculum mapping must be grounded.** The LLM deciding "what games are needed for topic X" cannot invent the prerequisite DAG from scratch. It needs curriculum alignment data (NCERT chapter structure, Common Core progression) to ground its decisions. Without it, it will suggest games in the wrong order, or miss critical prerequisite concepts.

---

### The E2E User Flow

A teacher opens Ralph and types:

> **"My Class 9 students need to understand trigonometric ratios. By the end they should be able to find a missing side using sin, cos, or tan."**

Ralph responds:

> **Session Plan: "SOH-CAH-TOA — Right Triangle Trigonometry"**
> 5 games · ~20 minutes · Bloom L1 → L3
>
> 1. Name the Sides (5 min, L1) — label hyp/opp/adj relative to a reference angle
> 2. Which Ratio? (4 min, L2) — choose sin/cos/tan given what's known and wanted
> 3. SOH-CAH-TOA Worked Example (5 min, L2) — follow a stepped procedure with scaffolding
> 4. Find the Missing Side (5 min, L3) — compute numerically with calculator, ±0.15 tolerance
> 5. Real-World Problem (5 min, L4) — given a word problem, identify the triangle and compute
>
> *Prerequisites detected: Pythagorean theorem (assumed known), angle vocabulary (assumed known)*
> *Curriculum: NCERT Class 9 Ch 8, CC HSG-SRT.C.6*
>
> **Build this session? [Yes / Adjust / Cancel]**

Teacher clicks Yes. Ralph queues 5 builds sequentially. Each game is generated, tested, and approved by the existing pipeline. 2-3 hours later, all 5 games are live and linked as a session.

The teacher never writes a spec. The teacher never knows what CDN constraints are.

---

### The Procedure (High Level, Not Final Architecture)

The Session Planner is a multi-step process, not a single LLM call. Each step has a narrow job:

**Step 1 — Goal parsing:** Extract topic, grade level, target cognitive outcome from the teacher's input. Map to a curriculum standard. This is classification + lookup, not generation.

**Step 2 — Prerequisite analysis:** Given the standard, identify what concepts must be known before this one. Generate the prerequisite DAG. This requires curriculum knowledge — either grounded in curriculum data or a model fine-tuned on it.

**Step 3 — Session design:** Decide how many games, at what Bloom levels, in what order, with which interaction patterns. This is the pedagogically richest step — it requires reasoning about ZPD, cognitive load, and misconception targeting. It benefits most from a large, reasoning-capable model.

**Step 4 — Spec generation (one per game):** For each game in the plan, generate a full spec using the closest approved game as a template. This is mostly template-filling with domain-specific content — a faster, cheaper step if the right template is provided.

**Step 5 — Build loop:** Feed each spec into the existing Ralph pipeline. No changes to Ralph.

The key principle is that each step reduces ambiguity so the next step has less to invent. By Step 4, the spec generator is not deciding Bloom levels, interaction type, CDN mechanics, or test hook names — all of that is already decided by Steps 1-3 and constrained by the template. The generator is filling in: what does the triangle look like, what are the answer options, what is the difficulty progression.

---

### Why We Are Not Building This Yet

The bottleneck is Step 3 (session design) and Step 4 (spec generation). Both require:

- A pattern library with enough coverage that any common interaction type has a proven example
- Enough approved specs across enough topic areas that the few-shot examples are close to the new game
- A reliable-enough Ralph pipeline that generated specs don't fail 60% of the time

We currently have strong coverage in one topic area (trig) and 4 proven patterns. That is not enough. The education slot is building toward 15-20 proven patterns across 3-4 curriculum areas. At that point, the Session Planner becomes a genuine project, not a research hypothesis.

---

## 8. Current Status

| Session | Games | Status |
|---------|-------|--------|
| SOH-CAH-TOA (trig) | 6 games | name-the-sides APPROVED #557; find-triangle-side APPROVED #549; soh-cah-toa-worked-example APPROVED #544; which-ratio active — #560 queued; compute-it planned; real-world-problem spec draft complete (2026-03-23) — 714 lines, 4 rounds (ladder/ramp/flagpole/cable), cognitive-demand test category, no new CDN parts |

See [trig-session.md](trig-session.md) for the full session plan, build log, and design rationale.

See [interaction-patterns.md](interaction-patterns.md) for the interaction type taxonomy and Bloom level mapping.

See `docs/rnd-educational-interactions.md` for the full 945-line pedagogical analysis: Bloom mapping, ZPD scaffolding analysis, spaced repetition, worked example research, curriculum alignment (NCERT + Common Core), and Session Planner pipeline proposal.
