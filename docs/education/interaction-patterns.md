# Interaction Pattern Taxonomy

**Purpose:** Catalog the interaction patterns available for Ralph game generation, their Bloom level mappings, and which are buildable with current CDN parts vs. requiring new infrastructure.

**Source:** Derived from `docs/rnd-educational-interactions.md` (March 22, 2026 pedagogical analysis, 945 lines).

---

## Bloom Level Reference

| Level | Name | What the learner does | Example |
|-------|------|----------------------|---------|
| L1 | Remember | Recall a fact or execute a single memorized step | "What is sin(30°)?" → "0.5" |
| L2 | Understand | Explain a relationship or interpret meaning | "Which ratio uses opp and hyp?" → recognizes sin |
| L3 | Apply | Use a procedure in a new instance | Given angle + side, compute missing side |
| L4 | Analyze | Decompose a problem and select the right approach | Word problem → identify triangle → select ratio → compute |
| L5 | Evaluate | Judge or verify (e.g., check a peer's solution) | "Is this calculation correct? If not, find the error." |
| L6 | Create | Produce something new (proof, design, model) | "Construct a triangle with these properties" |

---

## Patterns in Production (Ralph can generate these today)

| Pattern | CDN Parts | Bloom Levels | Warehouse Examples |
|---------|-----------|-------------|-------------------|
| **MCQ (tap one of N options)** | PART-022, PART-013 | L1–L2 | doubles, associations, true-or-false |
| **Typed numeric input** | PART-013 (fixed tolerance) | L1–L3 | right-triangle-area, speed-input |
| **Typed text with function validation** | PART-014 | L2–L3 | expression-completer |
| **Typed text with LLM subjective validation** | PART-015 | L2–L4 | — (rare, slow) |
| **Tap/count (dot counting, grid selection)** | PART-027, custom | L1 | count-and-tap, visual-memory |
| **Drag-and-drop (source → drop slot)** | PART-033 | L1–L2 | bubbles-pairs |
| **Clickable grid (CSS grid cells)** | PART-033 | L1–L2 | visual-memory |
| **Tag/chip input (type-and-enter)** | PART-033 | L2 | — |
| **Card flip-and-match (memory pairs)** | custom | L1 | match-the-cards |
| **Adjuster +/- buttons** | custom | L2–L3 | adjustment-strategy |
| **Sequential step building** | custom | L2 | sequence-builder |
| **Competitive timed MCQ** | PART-006 + PART-022 | L1–L3 | two-player-race, speed-input |
| **Worked example sub-phases (example→faded→practice)** | PART-036 | L2–L3 | soh-cah-toa-worked-example, quadratic-formula |
| **Two-step MCQ + typed input** | PART-013, PART-014 | L3–L4 | find-triangle-side |
| **Diagram labeling (MCQ button rows per side)** | PART-022, custom CSS | L1–L2 | name-the-sides |

---

## Patterns Planned or Buildable Without New CDN Parts

These patterns require only inline JS + CSS within the game HTML, using existing CDN layout components for structure:

| Pattern | How to Build | Bloom Levels | First Target Game |
|---------|-------------|-------------|------------------|
| **MCQ + worked example panel on wrong answer** | MCQ buttons (PART-022) + inline JS reveal of a hidden `<div class="worked-example">` on first incorrect | L2 | which-ratio |
| **Two-step MCQ (select ratio → compute value)** | Two sequential `<section>` blocks, step 2 revealed after step 1 correct | L3–L4 | find-triangle-side (DONE) |
| **Sorting / ordering by value** | Drag handles (PART-033) or tap-to-reorder inline JS | L2 | — |
| **Error detection ("find the mistake")** | Show a worked solution with one wrong step; MCQ asks which step is wrong | L4 | — |
| **Confidence rating before answer** | Star-tap before submitting (no CDN part needed — inline radio buttons) | L1–L2 metacognitive | — |
| **Slider / number line input** | `<input type="range">` with inline validation | L2–L3 | — |
| **Completion problem (fill one missing step)** | PART-036 faded sub-phase already supports this | L2–L3 | soh-cah-toa-worked-example (DONE) |

---

## Patterns Requiring New CDN Parts or External Infrastructure

| Pattern | Why It Requires New Infrastructure | Bloom Levels | Priority |
|---------|------------------------------------|-------------|----------|
| **SVG diagram labeling (tap a side of a drawn shape)** | Requires hit-testing on SVG paths — not supported by any current PART; CSS-drawn triangles with button rows are the workaround | L1–L2 | medium (workaround exists) |
| **Equation balancing (drag terms)** | Requires a two-pan balance UI with constrained drag — PART-033 drag is source→slot, not constrained balance | L3–L4 | high (algebra sessions) |
| **Graph reading (tap a coordinate)** | Requires a Canvas or SVG coordinate plane with tap-point detection | L3–L4 | medium |
| **Construction / drawing input** | Touch path recording — no CDN part; would require new PART-034 or similar | L5–L6 | low (out of scope) |
| **Adaptive difficulty (auto-adjust on failure streak)** | Requires session state across rounds + spec-time content branching; current inputSchema is static | L2–L4 | high (high value, complex) |
| **Spaced repetition review rounds** | Requires a per-student concept mastery store (database) and session planner that queries it | L1–L4 | high (long-term) |
| **Venn diagram / set membership** | Requires a two-circle SVG with drag-in/drag-out detection | L3–L4 | low |

---

## Bloom Coverage by Interaction Pattern

```
L1 (Remember):
  MCQ, tap/count, card-match, clickable grid, drag-and-drop (basic),
  typed recall, diagram labeling (basic)

L2 (Understand):
  MCQ + worked example, sorting/ordering, adjuster, sequential building,
  diagram labeling (angle-relative), completion problem (faded example),
  worked example sub-phases, which-ratio MCQ

L3 (Apply):
  Typed numeric (formula execution), two-step MCQ+typed,
  worked example practice sub-phase, compute-it,
  MCQ+worked example at harder rounds

L4 (Analyze):
  Multi-step word problem (diagram read → ratio select → compute),
  error detection ("find the mistake"), two-step MCQ+typed at hard rounds,
  strategy games (position-maximizer, kakuro)

L5–L6 (Evaluate / Create):
  Not currently supported. Requires drawing/construction input or
  proof-building interfaces not available in CDN.
```

---

## Pattern Selection Guide for New Specs

When writing a new spec, choose the interaction pattern by Bloom level target:

| Target Bloom | Recommended Pattern | Avoid |
|-------------|--------------------|----|
| L1 only | MCQ (4 options), typed recall | Two-step interactions (overkill, higher failure rate) |
| L2 | MCQ + worked example on wrong, sorting, diagram labeling | Pure typed input (no conceptual scaffolding) |
| L3 | Typed numeric + immediate formula feedback, two-step MCQ+typed | MCQ alone (can guess without computing) |
| L4 | Multi-step with explicit decomposition steps, error detection | Single-step MCQ (removes analysis requirement) |

**Key principle:** A game that claims a high Bloom level but only uses MCQ is not delivering that Bloom level — the learner is recognizing, not producing. L3+ games must require the learner to construct an answer, not pick one.

---

## CDN Parts Reference (abbreviated)

| PART | Component | Key Use |
|------|-----------|---------|
| PART-006 | TimerComponent | Countdown timer; adds time pressure from L2 onward |
| PART-013 | Fixed validation (numeric/text) | MCQ and typed input with tolerance |
| PART-014 | Function validation | Custom validation logic for typed input |
| PART-015 | LLM subjective validation | Open-ended text answers |
| PART-016 | StoriesComponent | Story/scenario context text |
| PART-017 | Audio feedback | Correct/wrong sounds |
| PART-022 | Option buttons (MCQ) | N-button choice rows |
| PART-023 | ProgressBarComponent | Visual progress; hint counter |
| PART-024 | TransitionScreen | Level transition screens |
| PART-027 | Play area / custom interaction | Custom SVG, diagram, two-phase interactions |
| PART-033 | Drag-and-drop | Drag-source → drop-slot, grid cells, tag input |
| PART-036 | WorkedExampleComponent | Step-by-step reveal; sub-phases example→faded→practice |

Full CDN part reference: see `docs/rnd-educational-interactions.md` §1.2 and the warehouse spec files.

---

## L3/L4 Bloom Gap Analysis — Approved Builds (2026-03-23)

**L3 (Apply) — approved games demonstrating this level:**

- `find-triangle-side` (build #549) — two-step MCQ + typed numeric input: learner first selects the ratio (MCQ), then computes the missing side length (typed input with ±tolerance). This is the only approved game that forces computation rather than recognition. The two-step structure prevents guessing: a correct MCQ answer alone does not advance the round.

**L4 (Analyze) — approved games demonstrating this level:**

- None. `real-world-problem` (Bloom L4) has a spec ready but has not been built yet. No approved game currently requires the learner to decompose a novel problem, identify the triangle setup, and choose an approach before computing.

**Gap and consequence:**

The pattern library has strong coverage for L1–L2 (MCQ, diagram-labeling, worked-example sub-phases) and one proven L3 pattern (two-step MCQ + typed input from `find-triangle-side`). L4 is entirely unproven in production. The multi-step word-problem pattern — diagram-read → ratio-select → numeric-compute — exists in the `real-world-problem` spec but has never been approved. Until that build ships, any L4 game in a new session will be authored without a working reference example, increasing generation failure risk. The Session Planner Phase 4 NCERT research step should not generate L4 specs until at least one L4 build is approved.

*Source: games/index.md cross-referenced against docs/education/interaction-patterns.md — 2026-03-23*

---

## Statistics Session 2 Patterns (2026-03-23)

Four games specced: `stats-identify-class` (L1), `stats-mean-direct` (L2–L3), `stats-median` (L3), `stats-mode` (L3). All specs written 2026-03-23. Awaiting human approval before first builds.

### Session Progression

| Position | Game ID | Title | Bloom | Skill |
|----------|---------|-------|-------|-------|
| Game 1 | `stats-identify-class` | Which Measure? | L1 Remember | Given a dataset and real-world context, classify which measure of central tendency (Mean/Median/Mode) is most appropriate. No computation. |
| Game 2 | `stats-mean-direct` | Mean Machine | L2–L3 Apply | Compute arithmetic mean of a 5–7 number dataset (sum ÷ count) and select from 4 MCQ options. |
| Game 3 | `stats-median` | Middle Ground | L3 Apply | Find median of a 5–7 number dataset (sort, pick middle or average two middles) and select from 4 MCQ options. |
| Game 4 | `stats-mode` | Most Common | L3 Apply | Find mode of ungrouped dataset (Easy/Medium) or compute mode from grouped frequency table using NCERT formula (Hard), and select from 4 MCQ options. |

**Bloom progression rationale:** L1 first forces learners to think about *why* each measure exists before computing any of them. Games 2–4 then require computation (L3), moving from the simplest algorithm (mean: one formula) to sorting-dependent (median) to formula-from-table (mode). The empirical relationship 3×Median = Mode + 2×Mean (NCERT Ch 14) is implicitly reinforced across the session.

**NCERT alignment:** Class 9 Ch 14 §14.2 (mean, ungrouped) → Class 10 Ch 14 §14.3 (median, ungrouped) → Class 10 Ch 13 §13.3 (mode, grouped). Note: stats-mean-direct targets Ch 9 scope (ungrouped direct method); grouped-data mean (direct method, Σfx/Σf) is not yet specced and would be Session 3 if added.

---

### Pattern: 3-Option MCQ with Worked-Example Reveal (stats-identify-class)

**Interaction type ID:** `measure-classification-mcq`
**Used by:** `stats-identify-class`
**Bloom level:** L1 Remember

**Structure:**
- Dataset displayed as a list or table (5–10 items, string or numeric)
- 1–2 sentence real-world context above the dataset explaining why a central tendency measure is needed
- 3 fixed MCQ buttons: `[Mean] [Median] [Mode]` — always in that order, always all 3 present
- On **first wrong attempt**: a worked-example panel slides in below the question. Panel contains the "Measure Selector" reference card with the correct measure highlighted and the specific reason it fits this dataset
- On **second wrong attempt**: round is skipped (one life deducted, soft note shown via `feedbackOnSkip`)
- No timer (time pressure contradicts the worked-example pedagogical goal)

**Lives variant:** 3 lives but deducted only on second wrong attempt (skip). First wrong attempt is free — showing the explanation is the pedagogical action. Game can end in game_over if lives reach 0.

**Distractor strategy:** The 3 options are always Mean/Median/Mode — no numeric distractors. The wrong-choice is made plausible by context design:
- Round targets `M1` (outlier case): salary data with one extreme value — learner incorrectly picks Mean
- Round targets `M2` (categorical): shoe size or blood group — learner incorrectly picks Mean or Median
- Round targets `M3` (skewed): house prices — learner incorrectly picks Mean

**Misconception tags (4 used):** `always-use-mean`, `mean-ignores-outlier`, `mean-for-categorical`, `mode-vs-median-ordered`

**Data requirements:** Each round must have a `misconceptionTag` field (`M1` | `M2` | `M3` | `M-none`) and an `explanationHtml` field for the worked-example panel.

**Star logic:** ≥7/9 first-attempt correct = 3★; ≥5/9 = 2★; <5 = 1★.

**Key spec decisions:**
- No timer on this game only — worked-example requires reflection time
- PART-017 (FeedbackManager.init) excluded — audio popup risk
- The worked-example panel is inline HTML (hidden div), not a CDN component

**When to reuse this pattern:** Any L1 classification task where three named concepts are always all valid options (learner chooses which applies) AND the main pedagogical value is in explaining the wrong answer, not penalizing it. Particularly suited to "which tool/method/measure?" questions at the start of a session.

---

### Pattern: 4-Option MCQ with Computation Distractors + Timer (stats-mean-direct, stats-median, stats-mode)

**Interaction type IDs:** `mean-computation-mcq`, `median-computation-mcq`, `mode-computation-mcq`
**Used by:** `stats-mean-direct`, `stats-median`, `stats-mode`
**Bloom level:** L2–L3 Apply

**Structure:**
- Dataset displayed in a styled card (numbers in a box, or frequency table HTML `<table>` for grouped mode)
- Question text above the 4-button MCQ grid
- 4 MCQ option buttons arranged in a 2×2 grid
- Immediate feedback on selection (correct/wrong text shown briefly, then auto-advance)
- Timer: **45 seconds per round** (PART-006 TimerComponent, destroyed and recreated on restart)
- On timeout: life deducted, round skips

**Timer rationale:** 45 seconds allows mental calculation for a 5–7 number dataset without feeling rushed. For mean: sum 5–7 numbers and divide (10–20 seconds). For median: sort 5–7 numbers and pick middle (15–25 seconds). For mode: scan 7–9 numbers for most frequent (10–15 seconds). 45s is above the 95th-percentile completion time for each task.

**Lives system (all 3 games):** 3 lives. Life deducted on wrong answer OR timeout. Game-over when lives reach 0 before round 9. Victory requires completing all 9 rounds with ≥1 life remaining.

**Distractor strategy — per game:**

| Game | D1 (most common error) | D2 | D3 |
|------|----------------------|----|----|
| `stats-mean-direct` | Sum without dividing (forget ÷n) | Median of the dataset | Mode (when repeated values present) or off-by-one-n |
| `stats-median` | Value at middle index of UNSORTED array (skip the sort step) | For even n: one of the two middle values instead of their average | Arithmetic mean of the dataset |
| `stats-mode` | Arithmetic mean | Median (middle-position value) | Only one mode in a bimodal set (missing the second); or max/min value instead of most frequent |

**Misconception tags:**
- `stats-mean-direct`: `M-forget-divide`, `M-wrong-n`, `M-mode-confusion`, `M-median-confusion`
- `stats-median`: `M-no-sort`, `M-even-median`, `M-use-mean`, `M-wrong-middle`
- `stats-mode`: `M-mean-confusion`, `M-median-confusion`, `M-multiple-mode`, `M-formula-error`, `M-freq-extremum`

**Difficulty tiers (all 3 games use the same 3-tier structure across 9 rounds):**
- Rounds 1–3 (Easy): simplest case, algorithm applies directly, distractors are clearly wrong if learner applies procedure
- Rounds 4–6 (Medium): complication introduced (even-n for median, bimodal for mode, carry arithmetic for mean)
- Rounds 7–9 (Hard): maximum distractor plausibility (unsorted + repeated values for median; grouped frequency table + formula for mode; real-world context transfer for mean)

**Star logic (all 3 games):** 9/9 correct = 3★; 6–8 = 2★; 3–5 = 1★; 0–2 = 0★.

**When to reuse this pattern:** Any L3 computation game where: (a) the answer is a single number or short expression, (b) 4 distractors can each represent a distinct documented misconception, (c) 45 seconds is sufficient for the mental computation. Advantages over typed input: lower motor load (especially on mobile), zero parsing errors, faster test generation (string equality, no tolerance). Disadvantage: learner can guess without computing — mitigated by choosing distractors that require the WRONG algorithm, making random guessing costly across a 9-round session.

**Key spec decisions (apply to all 3):**
- PART-017 excluded — FeedbackManager.init() triggers audio popup
- TimerComponent MUST be destroyed and recreated in restartGame() — reusing after destroy() causes a no-op
- gameId must be the FIRST field in gameState object literal (contract check)
- window.endGame and window.restartGame must be assigned in DOMContentLoaded

---

### Pattern: Sorted-Numbers Hint Field (stats-median)

**Used by:** `stats-median`
**Purpose:** Scaffolding for the sort step

The `stats-median` input schema includes a `sortedNumbers` field alongside the primary `numbers` field. The `numbers` field contains the dataset AS PRESENTED to the learner (may be unsorted for Medium/Hard rounds). The `sortedNumbers` field contains the same values in ascending order.

`sortedNumbers` is used in feedback: after a wrong answer, the feedback sentence shows the sorted order and the winning value. Example: "Median = middle of sorted data: 2, 4, 6, 8, 10 → 6."

**Why it matters:** The most common median error is picking the middle-position value WITHOUT sorting first (M-no-sort). Having `sortedNumbers` pre-computed in the schema means the feedback can immediately show the correct working step without the game needing to sort at runtime. The feedback is pre-authored to show the sorted sequence.

**Reuse:** Any computation game where the learner must apply a transformation to the data before extracting the answer (sort, cumulate, reorder) should include a pre-transformed field alongside the raw field. This keeps runtime game logic simple and feedback pre-authorable.

---

### Pattern: Dual Data Mode (stats-mode)

**Used by:** `stats-mode`
**Purpose:** Progressive complexity from ungrouped to grouped data within one game

The `stats-mode` input schema uses a `dataType` field (`"ungrouped"` | `"grouped"`) to toggle the display mode:

- `dataType: "ungrouped"` (Easy/Medium rounds): raw number list in a styled card, same UI as stats-mean-direct and stats-median
- `dataType: "grouped"` (Hard rounds): HTML frequency table (`<table>`) in the dataset card, with columns for class interval and frequency

The game renders the correct display type based on `dataType`. For grouped rounds, learners must apply the NCERT mode formula: `Mode = L + [(f₁ − f₀) / (2f₁ − f₀ − f₂)] × h`.

**Why two modes in one game:** Separating ungrouped-mode and grouped-mode into two separate games would require two builds and two approval cycles for content that is the same concept. The 9-round structure (3 Easy + 3 Medium + 3 Hard) provides natural difficulty ramping. Learners encounter the formula only after 6 rounds of reinforcing mode as "most frequent value", giving the conceptual foundation before the procedural formula.

**Schema fields (grouped rounds only):**
- `groupedData`: array of `{ classInterval: "10-20", frequency: 4 }` objects (4–6 rows)
- The modal class (highest frequency) must be unique (single modal class required)

**Distractor for grouped rounds (M-formula-error):** Off-by-one error in f₀/f₂ assignment (learner reads frequency table rows in wrong order when substituting into formula).

**Reuse:** Use dual-mode when the Hard tier of a game requires a materially different data representation (not just harder numbers) and the extra rendering complexity fits within a single self-contained HTML file. If the grouped-data formula is the primary learning target, write a dedicated spec instead (it deserves its own game).

---

### Pattern: Timer-Gated MCQ (stats-mean-direct, stats-median, stats-mode)

**Applies to:** All computation games in Statistics Session 2 (games 2–4 of 4)
**CDN Part:** PART-006 TimerComponent

**Configuration:** 45-second countdown per round. Timer starts when the round is displayed. On timeout: life deducted via the same path as a wrong answer, round auto-advances.

**Timer lifecycle (CRITICAL):** In `restartGame()`, the timer MUST be destroyed then recreated:
```javascript
timer.destroy();
timer = new TimerComponent({ ... });
```
Reusing the old TimerComponent after `destroy()` causes a no-op — the timer never starts on the restarted game. This is a documented Ralph pipeline lesson (captured in lessons-learned.md).

**Why 45 seconds:** Empirically calibrated for 5–7 number datasets:
- Mean computation: 10–20s for mental addition + division
- Median computation: 15–25s for mental sort + index
- Mode scan: 10–15s for frequency count
45s is above 95th-percentile completion time while short enough to maintain engagement. For harder computation (grouped data mode formula), 45s is a stretch goal that encourages formula fluency.

**Contrast with stats-identify-class (no timer):** Classification tasks require reflection on context and concept — time pressure actively harms learning by preventing the worked-example from being read. Computation tasks are procedural — time pressure serves as a fluency target and prevents passive guessing.

**When to use timer-gated MCQ vs untimed MCQ:**
- Timer ON: computation games, procedural fluency goals, when timeout = life-loss creates meaningful stakes
- Timer OFF: conceptual classification, worked-example games, any game where reading time is part of the learning

---

## Updated Pattern Selection Guide

The table from the prior section is updated to reflect statistics games:

| Target Bloom | Recommended Pattern | Notes |
|-------------|--------------------|-|
| L1 classification (which concept applies?) | 3-option MCQ with worked-example reveal on first wrong | No timer. explanationHtml required. |
| L1 recall (what is X?) | 4-option MCQ, no timer | — |
| L2–L3 computation (single formula) | 4-option computation MCQ with misconception distractors + 45s timer | Sort-hint field if sort step is required. |
| L3 formula from table | Dual-mode 4-option MCQ (ungrouped Easy/Medium + grouped Hard) | dataType field controls render mode. |
| L3 computation (must construct answer) | Typed numeric + immediate formula feedback | Use when MCQ guessing is unacceptable. |
| L4 multi-step | Two-step MCQ + typed input, or three-step word problem | real-world-problem pattern (approved build #564). |
