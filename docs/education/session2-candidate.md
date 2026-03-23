# Session 2 — Curriculum Area Candidates

**Created:** 2026-03-23
**Author:** Education Implementation Slot
**Purpose:** Identify the highest-value next curriculum area to build a complete learning session for, following the SOH-CAH-TOA trig session.

---

## Context

Session 1 (SOH-CAH-TOA) has 6 games, Bloom L1–L4, covering NCERT Class 10 Ch 8-9. As of 2026-03-23:
- 3 games approved (name-the-sides #557, soh-cah-toa-worked-example #544, find-triangle-side #549)
- 1 active (which-ratio #561)
- 2 planned (compute-it, real-world-problem)

Session 2 should validate the Session Planner architecture in a second domain — proving that the session design methodology is not trig-specific but generalizable.

**Session Planner readiness criteria:**
- Trig session proves the pattern library. Session 2 validates it in a new domain.
- Pattern library needs: at least 3 different curriculum areas with approved session games before Session Planner becomes a real project.
- The best Session 2 candidate is one where (a) the curriculum structure is clear, (b) proven interaction patterns map directly to the learning tasks, (c) NCERT alignment is unambiguous.

---

## Top 3 Candidates

### Candidate A: Quadratic Equations (NCERT Class 10 Ch 4)

**What the learner achieves:** Given a quadratic ax² + bx + c = 0, identify the method (factorisation/completing the square/formula), apply it, and check discriminant.

**NCERT alignment:**
- Ch 4 §4.1: Standard form identification
- Ch 4 §4.2: Solution by factorisation
- Ch 4 §4.3: Completing the square
- Ch 4 §4.4: Quadratic formula (discriminant, nature of roots)

**Interaction patterns needed:**
- L1: MCQ — "Is this a quadratic equation?" (identify standard form)
- L2: MCQ + worked example — discriminant value → nature of roots (real/equal/imaginary)
- L3: Typed numeric — factorisation (find two factors whose product = c, sum = b)
- L3: Typed expression — apply quadratic formula (typed with LLM validation for expression form, or typed numeric for final root values)
- L4: Word problem — "Width of a garden path is x, area = 60 m². Find x." Map to quadratic, solve.

**Proven patterns that apply directly:**
- Worked example sub-phases (example→faded→practice) — proven in soh-cah-toa-worked-example #544
- Typed numeric input — proven in find-triangle-side #549
- MCQ + worked example on wrong — proven pattern from which-ratio
- Word-problem-three-step — being proven in real-world-problem

**New pattern required:** Typed expression validation (factored form: "(x+2)(x-3)") — requires PART-014 function validation or PART-015 LLM validation. PART-014 can handle numeric root values. Factored form string matching is harder. Workaround: ask for the two roots as separate typed inputs (avoids expression parsing entirely).

**Estimated session:** 5 games, ~20 minutes, Bloom L1→L4.

**Risk:** Medium. The factorisation step requires recognising factor pairs — this cannot be done by MCQ alone at L3 without trivializing it. The workaround (two separate typed numeric roots) is feasible but needs a spec decision.

---

### Candidate B: Statistics — Mean, Median, Mode (NCERT Class 10 Ch 14)

**What the learner achieves:** Given a data set or frequency table, compute mean/median/mode; choose the right measure of central tendency for a given data description.

**NCERT alignment:**
- Ch 14 §14.1: Mean of grouped data (direct method, assumed mean, step deviation)
- Ch 14 §14.2: Median of grouped data (cumulative frequency, formula)
- Ch 14 §14.3: Mode of grouped data (modal class, formula)
- Ch 14 §14.4: Empirical relationship between the three

**Interaction patterns needed:**
- L1: MCQ — identify the modal class from a frequency table
- L2: Adjuster or typed numeric — compute class mark (midpoint) from class interval
- L3: Typed numeric — direct method mean from a frequency table (Σfx / Σf)
- L3: Typed numeric — median from cumulative frequency (l + ((n/2 - cf)/f) × h)
- L3: Typed numeric — mode from modal class (l + ((f₁-f₀)/(2f₁-f₀-f₂)) × h)
- L4: MCQ analysis — "Which measure is most appropriate here?" (skewed vs symmetric data)

**Proven patterns that apply directly:**
- Typed numeric — proven in multiple games
- MCQ — proven everywhere
- Worked example sub-phases — proven in soh-cah-toa-worked-example

**New pattern required:** Table rendering (frequency distribution table). Current CDN has no table component. A frequency table displayed as inline HTML (a `<table>` element rendered in the play area from inputSchema data) is achievable without new CDN parts — it is just inline HTML. The data entry interaction (clicking a row to select it, or reading a value from a specific cell) requires no drag-and-drop — the learner reads the table and types. This is feasible.

**Estimated session:** 5-6 games, ~25 minutes, Bloom L1→L4.

**Risk:** Low-medium. The core interaction (read table, compute, type answer) is well within the current CDN's capabilities. The main risk is table rendering complexity in HTML generation — a frequency table with 6 rows and 4 columns must be rendered dynamically from inputSchema, which requires careful spec'ing of the data structure.

**Prerequisite:** Basic arithmetic (fractions, multiplication) assumed. No trig prereqs. Available to a broader learner population than trig.

---

### Candidate C: Linear Equations in Two Variables (NCERT Class 9 Ch 4 / Class 10 Ch 3)

**What the learner achieves:** Plot a linear equation, identify solutions from a graph, solve a pair of simultaneous equations by substitution and elimination, interpret the solution geometrically.

**NCERT alignment:**
- Class 9 Ch 4: Solutions of linear equations, graphing (two variables)
- Class 10 Ch 3 §3.1-3.2: Pair of linear equations — graphical and algebraic solution
- Class 10 Ch 3 §3.3-3.4: Substitution, elimination, cross-multiplication
- Class 10 Ch 3 §3.5: Consistency and number of solutions

**Interaction patterns needed:**
- L1: MCQ — "Is (2, 3) a solution of 2x + y = 7?"
- L2: Typed numeric — find the y-intercept or x-intercept of a given equation
- L3: Two-step MCQ + typed — method selection (substitution/elimination) + solve
- L3: Typed numeric (two inputs) — find x and y for a simultaneous system
- L4: Word problem — "5 pens and 7 notebooks cost ₹79. 7 pens and 5 notebooks cost ₹77. Find each price."
- (Optional) L2: Graph reading — read a coordinate off a graph image (requires coordinate plane CDN — NOT available without new PART)

**Proven patterns that apply directly:**
- MCQ — proven
- Typed numeric — proven
- Word-problem-three-step — being proven in real-world-problem

**New pattern required:** Graph reading (tap a coordinate on a plotted line). This requires a Canvas or SVG coordinate plane — not available in current CDN (see interaction-patterns.md "Patterns Requiring New CDN Parts"). Without this, the graphing sub-session cannot be built. The algebraic sub-session (substitution + elimination + word problems) is buildable without graphs.

**Risk:** Medium-high. The full session requires graphing interaction that the CDN cannot support. A reduced session (algebraic methods only, no graphing) is buildable but incomplete from a NCERT alignment perspective.

**Estimated session (algebraic only):** 4 games, ~18 minutes, Bloom L1→L3.

---

## Rationale Summary

| | Candidate A (Quadratics) | Candidate B (Statistics) | Candidate C (Linear Equations) |
|--|--|--|--|
| Pattern coverage with current CDN | High (minor workaround for factored form) | High (table rendering feasible in HTML) | Medium (graphing blocked) |
| NCERT alignment completeness | Full (Ch 4) | Full (Ch 14) | Partial without graphing |
| Bloom L4 achievable? | Yes (word problem) | Yes (measure selection) | Yes for algebra, no for graphing |
| Prerequisite breadth (wider audience) | Medium (algebra prereq) | High (any Class 9+ learner) | Medium (algebra prereq) |
| Validates session architecture? | Yes — same structure as trig | Yes — and tests table-rendering pattern | Yes — but blocked area reduces generalizability |
| Session Planner value | High | High | Medium |

---

## Recommendation: Candidate B — Statistics (Mean, Median, Mode)

**Rationale:**

1. **No new CDN parts required.** The frequency table is rendered as inline HTML from inputSchema — this is a data representation challenge, not a CDN challenge. Every interaction (read value, compute, type answer) uses proven parts. The trig session already has one word-problem game; Statistics adds a table-reading pattern that is genuinely new interaction coverage without infrastructure risk.

2. **Broadest prerequisite coverage.** Statistics (Class 10 Ch 14) requires only basic arithmetic. It is accessible to every Class 9-10 learner, not just those who have completed trig. This maximizes the learner population the session can serve.

3. **Tests a different formula application pattern.** The trig session tests ratio selection then computation. Statistics tests formula selection (which of three measures to compute) and then multi-step arithmetic (Σfx/Σf requires summing products, not just one multiplication). This is genuinely new cognitive territory.

4. **Validates the Session Planner's generalisation claim.** The Session Planner thesis requires the architecture to work across curriculum areas, not just trig. Statistics uses tables, not triangles. The interaction patterns are the same (worked example, typed numeric, MCQ analysis) but the domain is completely different. If the session architecture holds in Statistics, it is not trig-specific.

5. **L4 is achievable without new CDN.** "Which measure is most appropriate?" (skewed data → median; categorical data → mode; symmetric data → mean) is an L4 Analyze question that can be answered with MCQ + worked-example-on-wrong — the same pattern proven by which-ratio.

**Estimated interaction patterns needed:**

| Pattern | Status |
|---------|--------|
| MCQ (frequency table reading, modal class identification) | Proven |
| Typed numeric (class mark, mean, median, mode computation) | Proven |
| Worked example sub-phases (direct method mean) | Proven |
| Inline HTML frequency table (rendered from inputSchema) | New — but achievable inline, no CDN part |
| MCQ + worked example on wrong (measure appropriateness) | Proven (which-ratio) |

**One new pattern this session would prove:** Inline tabular data rendered dynamically from inputSchema. This is high value for the pattern library — many NCERT topics (probability, polynomials, coordinate geometry exercises) involve tabular data.

**Prerequisite alignment:**
- NCERT Class 10 Ch 14 follows Class 9 Ch 14 (basic statistics: mean/median/mode of ungrouped data). The Session 2 games can assume ungrouped data concepts are known.
- No trig or geometry prereqs.
- Arithmetic prereq: multiplication, division, fractions — assumed from Class 7-8.

**Estimated session:** 5-6 games, ~22 minutes, Bloom L1→L4.

| Game # | Game ID (proposed) | Bloom Level | Interaction Type |
|--------|-------------------|-------------|-----------------|
| 1 | `stats-identify-class` | L1 Remember | MCQ — identify modal class, class width, class mark |
| 2 | `stats-mean-direct` | L2–L3 Understand→Apply | Worked example (direct method mean from frequency table) |
| 3 | `stats-median` | L3 Apply | Typed numeric — median from cumulative frequency formula |
| 4 | `stats-mode` | L3 Apply | Typed numeric — mode from modal class formula |
| 5 | `stats-which-measure` | L4 Analyze | MCQ + worked example on wrong — choose appropriate measure given data description |

**Next step:** Write spec for Game 1 (`stats-identify-class`) — the lowest-Bloom game in the sequence, following the strict build-in-order rule.
