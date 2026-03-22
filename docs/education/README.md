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

**Input:** "Students should understand right-triangle trigonometry" (NCERT Class 10, grade-appropriate)

**Output:** A session plan (5 games, prerequisite-ordered, 15-20 minutes total) + all game specs generated + all games built and approved + session deployed.

The pipeline for this:

```
1. Topic Decomposition
   LLM reads topic + curriculum → Concept Node Graph (prerequisite DAG)

2. Node → Game Mapping
   For each node: use existing approved game OR generate new spec

3. ZPD Ordering
   Sort games by Bloom level, respecting prerequisite edges

4. Session Chunking
   Distribute games across sessions (target 15-20 min per session)

5. Output
   session_plan.json + spec.md files (one per new game) → Ralph pipeline
```

The Session Planner API endpoint (`POST /api/session-plan`) was prototyped in commit 725713b. The data layer (concept node graph, curriculum alignment table) is described in `docs/rnd-educational-interactions.md` §4-5.

---

## 8. Current Status

| Session | Games | Status |
|---------|-------|--------|
| SOH-CAH-TOA (trig) | 5 games | name-the-sides active; find-triangle-side APPROVED #549; soh-cah-toa-worked-example APPROVED #544; which-ratio planned; compute-it planned; real-world planned |

See [trig-session.md](trig-session.md) for the full session plan, build log, and design rationale.

See [interaction-patterns.md](interaction-patterns.md) for the interaction type taxonomy and Bloom level mapping.

See `docs/rnd-educational-interactions.md` for the full 945-line pedagogical analysis: Bloom mapping, ZPD scaffolding analysis, spaced repetition, worked example research, curriculum alignment (NCERT + Common Core), and Session Planner pipeline proposal.
