# Session 3 — Curriculum Area Plan

**Created:** 2026-03-23
**Author:** Education Implementation Slot
**Purpose:** Select the highest-value curriculum area for Session 3, following Session 1 (SOH-CAH-TOA trig) and Session 2 (Statistics: mean, median, mode).

---

## Context

Session 1 (SOH-CAH-TOA, 5 games, Bloom L2→L4) — APPROVED, all games through the build pipeline.
Session 2 (Statistics: mean/median/mode/measure selection, 4 games, Bloom L1→L3) — all 4 specs written, first build pending human review of `stats-identify-class`.

Session 3 must (a) cover a new NCERT Class 10 area, (b) validate the session architecture across a third domain, and (c) require no new CDN parts.

**Session Planner gate:** Three sessions across distinct domains = Session Planner becomes a real project. Session 3 is the gate.

---

## Candidate A: Probability (NCERT Class 10 Chapter 15)

### Curriculum scope

Chapter 15 is the only chapter on probability in Class 10 NCERT. It follows Class 9 Chapter 15 (experimental probability) and introduces theoretical (classical) probability. The chapter is self-contained and shorter than most algebra chapters — NCERT exercises total 30 questions across two exercises.

**Key skills (NCERT Ch 15):**
- §15.1: Recall experimental probability; define theoretical probability
- §15.2: Theoretical probability formula: P(E) = favourable outcomes / total equally likely outcomes
- Sample space enumeration: coins, dice, playing cards, coloured balls in bags
- Complementary events: P(E) + P(not-E) = 1
- Identifying impossible events (P = 0) and certain events (P = 1)
- Multi-step problems: set up sample space → identify favourable outcomes → compute ratio → simplify

**Subtopics mapped to interaction opportunities:**

| Subtopic | Bloom Level | Interaction |
|----------|-------------|-------------|
| Identify equally likely vs non-equally likely outcomes | L1 Remember | MCQ: "Are these outcomes equally likely?" |
| Enumerate sample space (coin, die, cards) | L2 Understand | MCQ: list S, identify which matches |
| Compute P(E) for single-step events | L2–L3 Apply | Typed numeric: fraction, auto-simplified |
| Apply complementary rule: P(not-E) | L2 Apply | Typed numeric: 1 – P(E) |
| Multi-step: two-dice / two-coin sample space | L3 Apply | Typed numeric with worked example scaffold |
| Classify event by probability range (impossible/unlikely/certain) | L4 Analyze | MCQ + justification |

### Primary misconceptions (from research)

**Equiprobability bias** (highest frequency, ~30–40% of errors): Students assume all outcomes of any random event are equally likely. Classic form: "There are three outcomes when two coins are tossed — HH, HT, TT — each has probability 1/3." This ignores that HT can happen two ways (HT and TH). NCERT explicitly addresses this in Exercise 15.1 Q25.

**Gambler's fallacy**: Students believe past outcomes influence future independent events. "I got heads five times — tails is overdue." Persistent and hard to dislodge with purely procedural instruction.

**Sample space counting errors**: For multi-step experiments (two dice, two coins), students list outcomes by type not by ordered pair. They count (H, T) and (T, H) as one outcome, shrinking the sample space and inflating probabilities.

**P(certain event) = 1 confusion**: Students write P(E) = 1/1 = 1 for impossible events when the denominator is the number of outcomes and the numerator is zero — arithmetic confusion, not conceptual.

**Cards sample space**: Students assume 52 cards but don't account for suits correctly. "A deck has 52 cards; there are 4 kings — P(king) = 4/52" is correct, but "P(red king) = 2/52" is frequently computed as 2/26 (only red cards counted in denominator) — incorrect denominator selection.

### CDN compatibility

All interactions are feasible with proven CDN parts:
- MCQ (equally likely identification, event classification): proven
- Typed numeric with fraction input (P = 3/8 etc.): proven in find-triangle-side and stats games
- Worked example sub-phases (two-dice enumeration): proven in soh-cah-toa-worked-example
- Inline enumerated list (sample space display as comma-separated outcomes): achievable as inline HTML, no new PART

**No new CDN parts required.**

### Bloom progression

Recommended: L1 → L2 → L3 → L3 → L4

| Game # | Proposed ID | Bloom | Interaction |
|--------|------------|-------|-------------|
| 1 | `prob-identify-sample-space` | L1 Remember | MCQ — identify correct sample space for a given experiment |
| 2 | `prob-single-event` | L2–L3 Apply | Typed numeric — P(E) = favourable/total, single-step (coins, dice, coloured balls) |
| 3 | `prob-complementary` | L2 Apply | Typed numeric — given P(E), compute P(not-E); identify impossible/certain events by MCQ |
| 4 | `prob-two-step` | L3 Apply | Worked example + typed numeric — two-dice or two-coin sample space, enumerate all outcomes, compute P |
| 5 | `prob-real-world` | L4 Analyze | MCQ analysis — given a word problem, identify correct vs incorrect probability reasoning (addresses equiprobability bias directly) |

**Estimated session:** 5 games, ~20–25 minutes.

### Risk assessment

**Risk: Medium.**
- The chapter is conceptually lighter than Statistics (fewer formulae, no multi-step arithmetic). This makes L3 harder to sustain — the "Apply" level is limited to enumeration and ratio computation.
- Two-step experiments (two-dice) are L3 but the hardest part is sample space enumeration, which is difficult to scaffold with typed numeric alone. A worked example is required.
- Playing card problems (52-card deck) require the learner to know card suits — this is domain knowledge, not math. Some learners will not have it. Safer to use dice and coloured balls in all games.
- Complementary events are conceptually simple; a full game at L2 may feel too thin. Combine with impossible/certain event identification to give the game enough cognitive weight.
- Chapter is short (30 NCERT questions). All meaningful skills fit in 5 games with no filler.

---

## Candidate B: Arithmetic Progressions (NCERT Class 10 Chapter 5)

### Curriculum scope

Chapter 5 is one of the longest algebra chapters in Class 10 NCERT. It builds on Class 8 pattern recognition and feeds directly into Class 11 sequences and series. It is heavily weighted in board exams — typically 3 questions from this chapter in the CBSE paper, under Unit 3 Algebra (20 marks total).

**Key skills (NCERT Ch 5):**
- §5.1–5.2: Identify AP from a sequence (constant common difference d = a₂ − a₁)
- §5.3: nth term formula: aₙ = a + (n − 1)d
- §5.4: Sum of first n terms: Sₙ = n/2 × [2a + (n − 1)d], or Sₙ = n/2 × (a + l) when last term l is known
- Arithmetic mean: b = (a + c)/2 for a, b, c in AP
- Reverse problems: find a, d, or n given constraints (e.g., "the 17th term is 7 more than twice the 8th term — find the AP")
- Word problems: rows of seats, stacking blocks, ladder rungs, salary increments

**Subtopics mapped to interaction opportunities:**

| Subtopic | Bloom Level | Interaction |
|----------|-------------|-------------|
| Identify whether a sequence is AP (check constant d) | L1 Remember | MCQ: "Is this sequence an AP? What is d?" |
| Find nth term using aₙ = a + (n–1)d | L2–L3 Apply | Typed numeric: given a, d, n → find aₙ |
| Find n given aₙ: reverse the formula | L3 Apply | Typed numeric: solve for n (always a positive integer) |
| Find sum Sₙ | L3 Apply | Typed numeric: substitute into Sₙ formula |
| Reverse sum problem: given Sₙ, find n or d | L3–L4 Apply/Analyze | Typed numeric: solve quadratic sub-step (n² arises when solving for n) |
| Word problems: real-world AP | L4 Apply/Analyze | Word problem three-step: identify a, d → write AP → compute answer |

### Primary misconceptions (from research)

**Off-by-one in (n − 1)d**: Students write aₙ = a + nd instead of a + (n − 1)d. This is the single most common computational error. The 1st term a₁ = a + (1 − 1)d = a confirms the correct formula, but students often use the incorrect form under time pressure.

**Sign of d**: When d is negative (decreasing AP), students treat d as positive and get increasingly wrong answers from term 3 onward. They compute a + nd rather than a + (n − 1)(−d).

**Counting terms vs counting intervals**: In the sequence 2, 5, 8, ..., 29, students count "29 − 2 = 27, divided by 3 = 9 terms" missing that there are 10 terms (the count is intervals + 1). This is structurally identical to the fencepost error.

**Sum formula confusion**: Two forms of Sₙ exist. Students mix them: applying n/2 × (a + l) when l (last term) is unknown, or applying n/2 × [2a + (n − 1)d] with an error in the 2a coefficient (writing a instead).

**Reverse sum problems**: When asked "find n such that Sₙ = 120", substituting the Sₙ formula yields a quadratic in n. Students who haven't completed Chapter 4 (Quadratic Equations) will not know how to solve it. This creates a prerequisite dependency that Probability does not have.

### CDN compatibility

All interactions are feasible with proven CDN parts:
- MCQ (identify AP, identify d): proven
- Typed numeric (aₙ, Sₙ, n, d): proven
- Worked example sub-phases (nth term derivation): proven
- Word problem three-step: proven pattern from real-world-problem game

**No new CDN parts required.**

### Bloom progression

Recommended: L1 → L2 → L3 → L3 → L4

| Game # | Proposed ID | Bloom | Interaction |
|--------|------------|-------|-------------|
| 1 | `ap-identify` | L1 Remember | MCQ — identify if sequence is AP; find common difference d |
| 2 | `ap-nth-term` | L2–L3 Apply | Worked example + typed numeric — nth term formula; includes negative d case |
| 3 | `ap-find-n` | L3 Apply | Typed numeric — given aₙ, find n (reverse formula); addresses off-by-one |
| 4 | `ap-sum` | L3 Apply | Typed numeric — compute Sₙ; both formula forms practiced |
| 5 | `ap-real-world` | L4 Apply/Analyze | Word problem — set up a and d from context, compute target term or sum |

**Estimated session:** 5 games, ~22–25 minutes.

### Risk assessment

**Risk: Low-medium.**
- All skills map cleanly to typed numeric input. No new interaction pattern is needed.
- The prerequisite dependency for reverse-sum problems (quadratic sub-step) is real but avoidable by constraining game 4 to forward Sₙ problems and leaving reverse-sum out of scope.
- The session tests a fundamentally different cognitive pattern than Sessions 1 and 2: formula application with algebraic substitution, rather than ratio reasoning (trig) or formula selection with multi-step arithmetic (statistics). This is genuinely new territory for the pattern library.
- AP word problems are among the most common NCERT exam questions — building this session has high immediate exam-prep value.
- Bloom L4 is achievable via word problem (L4 Apply in Bloom 2001 taxonomy), which is the same pattern proven by `real-world-problem`.

---

## Comparison Table

| Criterion | Candidate A: Probability | Candidate B: Arithmetic Progressions |
|-----------|--------------------------|--------------------------------------|
| NCERT chapter | Ch 15 (short, 30 Qs) | Ch 5 (long, exam-heavy, 20-mark unit) |
| Bloom L4 achievable without new CDN | Yes (misconception analysis MCQ) | Yes (word problem) |
| New interaction patterns needed | None | None |
| Primary misconception addressability | High (equiprobability bias directly testable in MCQ) | High (off-by-one directly testable in typed numeric) |
| Prerequisite dependency | Low (arithmetic only) | Medium (avoid reverse-sum to sidestep quadratic dep) |
| Exam weight (CBSE board) | Low-medium (typically 1–2 marks, short Qs) | High (3 Qs × ~4 marks = ~12 marks from this unit) |
| Pattern library value | Moderate (probability domain, no new patterns) | Moderate (algebraic substitution domain, no new patterns) |
| Natural follow-on to Session 2 | Yes (statistics → probability is canonical) | No (AP is standalone from statistics) |
| Chapter length / content density | Short — risk of thin L3 | Long — risk of over-speccing; easily scoped to 5 games |
| Teacher familiarity (India, CBSE) | Moderate | Very high — AP is exam-critical year after year |
| Session Planner pattern library value | Proves MCQ + ratio domain | Proves algebraic substitution + word problem domain |

---

## Recommendation: Candidate B — Arithmetic Progressions

**Primary reason: Exam-criticality and misconception density.**

Arithmetic Progressions carries significantly more exam weight than Probability in CBSE Class 10. The chapter contributes to Unit 3 Algebra (20 marks total), and AP alone typically accounts for 3 questions (~12 marks) in the CBSE board paper. Probability contributes 1–2 marks. For a learner using Ralph to prepare for board exams, a well-executed AP session delivers disproportionate impact.

**Secondary reason: Misconception addressability.**

The two highest-frequency AP errors — off-by-one in the (n−1)d formula and sign-of-d confusion — are both directly testable with typed numeric input. A game that generates questions spanning n = 1, n = 2, and n = mid-sequence will surface the off-by-one error immediately, and feedback can correct it in-session. Equiprobability bias (Probability's primary misconception) is a conceptual error that requires metacognitive reflection — harder to address through a typed-answer game format.

**Third reason: Algebraic substitution is a new domain for the pattern library.**

Session 1 tested ratio reasoning (trig). Session 2 tested formula selection + multi-step arithmetic (statistics). AP tests formula substitution + algebraic manipulation. These are genuinely different cognitive patterns. Building AP means the pattern library covers three distinct cognitive domains, which is the minimum needed to justify the Session Planner as a general architecture.

**Why Probability is deferred, not rejected:**

Probability is a strong candidate for Session 4. The natural curriculum sequence is Statistics (S2) → Probability (S4) with AP (S3) in between. This mirrors the NCERT chapter order (Ch 14 Statistics, Ch 15 Probability). By the time Session 4 is planned, `stats-identify-class` will have gone through the build pipeline and the table-rendering pattern will be proven — which is useful context for any future probability game that displays sample space tables.

---

## Session 3 Game List (Arithmetic Progressions)

| Game # | Proposed ID | Bloom Level | Interaction Type | Primary Misconception Targeted |
|--------|------------|-------------|-----------------|-------------------------------|
| 1 | `ap-identify` | L1 Remember | MCQ — is this an AP? what is d? | None (identification only) |
| 2 | `ap-nth-term` | L2–L3 Apply | Worked example + typed numeric — compute aₙ | Off-by-one in (n−1)d; negative d sign error |
| 3 | `ap-find-n` | L3 Apply | Typed numeric — given aₙ and a, d → find n | Off-by-one; fencepost counting |
| 4 | `ap-sum` | L3 Apply | Typed numeric — compute Sₙ using both formula forms | Sum formula confusion (a vs 2a coefficient) |
| 5 | `ap-real-world` | L4 Apply/Analyze | Word problem three-step — real context → identify AP → compute | Variable role confusion (n vs aₙ) |

**Scope constraint for spec writing:**
- Game 4 (`ap-sum`) restricts to forward Sₙ problems (given a, d, n → find Sₙ). No reverse-sum problems (avoids quadratic prerequisite from Ch 4).
- Game 3 (`ap-find-n`) restricts to cases where n is a positive integer by construction (guaranteed by question generation). Fractional/invalid n is a distractor in wrong-answer choices, not the answer.

---

## Next Steps (after human approval)

1. Write spec for Game 1: `ap-identify` — lowest Bloom in sequence.
2. Apply all 18 anti-pattern rules (from stats-identify-class lessons) from the start — do not wait for first build to identify violations.
3. Cross-reference AP-specific gen rules needed: number sequence display (comma-separated inline), arithmetic check validation (verify d is constant before labelling as AP).

---

## Sources Consulted

1. GeeksforGeeks — NCERT Class 10 Ch 15 Probability notes (subtopics, formula, event types)
2. BYJU'S — CBSE Class 10 Ch 15 Probability notes (experimental vs theoretical, complementary events)
3. CBSE Academic — NCERT Solutions Class 10 Ch 15 (Exercise 15.1 Q25: equiprobability fallacy)
4. Vedantu — NCERT Solutions Class 10 Ch 14 Probability (common misconceptions checklist)
5. ALLEN — NCERT Solutions Class 10 Ch 5 Arithmetic Progressions (subtopics, formula derivations)
6. BYJU'S — NCERT Solutions Class 10 Ch 5 AP (exam weight: Unit 3 = 20 marks, ~3 Qs from AP)
7. Sapub Journal — "Identifying Students' Specific Misconceptions in Learning Probability" (Brunei, Years 10–11): equiprobability bias 30%, gambler's fallacy, sample space enumeration errors
8. ERIC / Khazanov & Prado — "Correcting Students' Misconceptions about Probability": equiprobability bias, representativeness, outcome orientation — three primary targets
9. Academia.edu / Makonye — "Grade 10 Errors in Probability": sample space construction errors, tree diagram misuse
10. LearnConnected — AP Formula Class 10 CBSE (formula variants, common board exam question types)
