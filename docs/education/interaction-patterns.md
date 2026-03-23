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

---

## Operational Pattern Guide — CDN Parts, Pitfalls, and Build Notes

> **Added:** 2026-03-23. This section complements the taxonomy above with concrete CDN wiring, known pitfalls sourced from browser ui-ux audits, and build-verified lessons-learned references. Use this section when writing a new spec or debugging a failing build.

---

### Pattern A — MCQ (Multiple Choice Question)

**CDN Parts**

| Part | Role |
|------|------|
| PART-023 ProgressBarComponent | Round progress + lives. Use `{ slotId: 'mathai-progress-slot', totalRounds: N, totalLives: N }` |
| PART-024 TransitionScreenComponent | Start screen, victory, game-over overlays |
| PART-025 ScreenLayoutComponent | Injects `#mathai-progress-slot` and `#mathai-transition-slot` into DOM |
| PART-013 Validation Fixed | String equality: `selectedOption === correctAnswer` |

**Bloom Levels:** L1 (Remember) and L2 (Understand). Adding a worked-example panel on first wrong attempt pushes toward L2 (stats-identify-class pattern).

**Example Games:** name-the-sides (#557), which-ratio (#561), stats-identify-class.

**When to use:** Skill is recognition or classification. 3–4 options per round. Worked-example feedback panel on wrong answer adds L2 depth.

**When to avoid:** Skill requires construction, computation, or open-ended reasoning. Answer space is continuous (use typed numeric input).

**Known Pitfalls:**

1. `syncDOMState()` must be called after every `gameState.phase =` assignment — init (`start`), round start (`playing`), feedback, and `endGame` (`results`). Missing call causes all `waitForPhase()` calls to timeout (Lesson 50; confirmed in virtually every audited game).

2. `TransitionScreen.show()` must use object API — `transitionScreen.show('victory', {...})` string-mode renders a blank white screen. Always: `transitionScreen.show({ icons: ['🎉'], title: '...', subtitle: '...', buttons: [{...}] })` (ui-ux which-ratio #561 BROWSER-P0-001).

3. `icons` array takes emoji strings only — passing `icons: ['<svg...>']` HTML-escapes the markup and renders raw SVG code covering the screen (ui-ux which-ratio #561 BROWSER-P0-002).

4. `ProgressBar totalLives: 0` throws RangeError — omit `totalLives` or use a positive value for lives-free games. `totalLives: 0` causes `RangeError: Invalid count value: -N` on every round (ui-ux which-ratio #561, name-the-sides #557).

5. `ProgressBarComponent slotId` must be exactly `'mathai-progress-slot'` — no `#` prefix, no `-bar-` infix. Wrong slot ID causes fallback mount (confirmed: real-world-problem #564 UI-RWP-003, find-triangle-side #549 UI-FTS-002, soh-cah-toa-worked-example #544 UI-SC-003).

6. Correct feedback auto-dismiss minimum 1500ms — use a single constant `FEEDBACK_DURATION_MS = 1500`. Skip and correct paths must use the same constant (ui-ux which-ratio #561 Issues 5–6).

7. No ARIA live regions — ARIA-001 confirmed in 20+ builds. Add `aria-live="polite"` to `#correct-feedback`, `#skip-note`, and all dynamic feedback elements.

---

### Pattern B — Worked Example + Faded (Scaffolded Learning)

**CDN Parts**

| Part | Role |
|------|------|
| PART-023 ProgressBarComponent | Round + lives display. Lives apply only to practice phase. |
| PART-024 TransitionScreenComponent | Start / victory / game-over |
| PART-025 ScreenLayoutComponent | Slot injection |
| PART-013 Validation Fixed | MCQ string equality for faded and practice phases |

No dedicated CDN WorkedExampleComponent — the three-phase layout (example → faded → practice) is custom JS + CSS panel toggling.

**Bloom Levels:** L2 (Understand) and L3 (Apply). Cognitive load theory gradient: full scaffolding (Sweller & Cooper 1985) → partial scaffolding → independent work. Documented in soh-cah-toa-worked-example spec Section 1 Pedagogical Design Note.

**Example Games:** soh-cah-toa-worked-example (#544), quadratic-formula-worked-example.

**When to use:** Skill is a multi-step procedure learners frequently memorize without understanding. Place immediately before or after an MCQ classification game on the same concept.

**When to avoid:** Pure recall/classification (use MCQ). More than 5 steps per worked example (exceeds mobile screen space).

**Known Pitfalls:**

1. Lives apply to practice sub-phase only, not example or faded. Wrong faded answers must show the correct step and allow retry — not deduct a life (soh-cah-toa-worked-example spec Section 1).

2. `gameState.subPhase` must be explicitly tracked — values `'example' | 'faded' | 'practice'`. Tests verify sub-phase transitions. Ad hoc boolean flags are harder to test (soh-cah-toa-worked-example spec Section 3).

3. `results-screen` must be `position: fixed` — confirmed `position:static` in soh-cah-toa-worked-example #544 (UI-SC-001). GEN-UX-001 rule is shipped; still missing in builds predating it.

4. `ProgressBarComponent` options object must include `slotId` — confirmed missing in soh-cah-toa-worked-example #544 (UI-SC-003): options format correct but `slotId` key absent.

5. Formula display is plain text (`font-family: Courier New`) — MathML is not available. Document as known accessibility limitation in spec (ui-ux soh-cah-toa-worked-example UI-SC-006).

6. `window.nextRound` must be exposed — assign `window.nextRound = roundComplete` (or equivalent internal function) in DOMContentLoaded. 10+ confirmed missing instances.

---

### Pattern C — Spatial / Grid Puzzle

**CDN Parts**

| Part | Role |
|------|------|
| PART-025 ScreenLayoutComponent | Slot injection |
| PART-023 ProgressBarComponent | Round/lives display (optional for single-round puzzles) |
| PART-024 TransitionScreenComponent | Start / victory / game-over |

Grid logic is entirely custom. `TimerComponent` CDN class does NOT exist (Lesson 87) — use `setInterval`/`setTimeout`.

**Bloom Levels:** L3 (Apply) and L4 (Analyze).

**Example Games:** light-up (#508), kakuro, futoshiki, queens.

**When to use:** Skill involves spatial reasoning or constraint satisfaction. Single-puzzle-per-session design.

**When to avoid:** Primary skill is numeric computation or algebraic manipulation. Grid requires scroll on mobile to see all cells — keep grids to 5×5 or smaller at 375px viewport.

**Known Pitfalls:**

1. `data-testid` on cells, not container — use `data-testid="game-grid"` on the grid wrapper and `data-testid="cell-R-C"` for individual cells. Using `data-testid="answer-input"` on the grid container (MCQ template artifact) breaks test selectors (ui-ux light-up #508 HIGH-3).

2. `window.nextRound` must be exposed even for single-round games — assign `window.nextRound = function() {}` if no round advancement exists. Test harness warns silently if absent (ui-ux light-up #508 HIGH-1; 10+ confirmed instances).

3. `TimerComponent` does not exist in CDN bundle — causes `ReferenceError: TimerComponent is not defined` crashing DOMContentLoaded before `#gameContent` is created. Blank page. All tests fail. Use `setInterval`/`clearInterval` (Lesson 87).

4. `syncDOMState()` must write `data-phase='start_screen'` when the restart interstitial is shown — writing `'playing'` prematurely causes test harness to begin game assertions before the grid renders (ui-ux light-up #508 MEDIUM-3).

5. Interactive cells must be `<button>` elements or `role="button" tabindex="0"` — plain `<div>` elements are inaccessible. Playwright clicks divs (tests pass), but WCAG compliance fails.

---

### Pattern D — Card Matching

**CDN Parts**

| Part | Role |
|------|------|
| PART-025 ScreenLayoutComponent | Slot injection |
| PART-023 ProgressBarComponent | Round progress + lives |
| PART-024 TransitionScreenComponent | Start / victory / game-over |

Card matching is custom JS + CSS. No dedicated CDN card-matching component.

**Bloom Levels:** L1 (Remember) and L2 (Understand). Face-memory = pure recognition (L1). match-the-cards and associations = associative recall/linking (L1–L2).

**Example Games:** face-memory (#512), match-the-cards (#226), associations.

**When to use:** Skill is associative recall — linking two items (term ↔ definition, equation ↔ graph). Short rounds (≤8 cards) to keep working memory load manageable.

**When to avoid:** Skill requires procedural steps or computation. Large card sets requiring scroll to find a match.

**Known Pitfalls:**

1. Per-round match counters must reset in `renderRound()` — stale counters from the previous round cause premature round-end (frequent source of level-progression test failures).

2. `isProcessing = true` during card reveal delay — for any timed reveal (show then hide), keep `isProcessing = true` until the timeout completes. Setting it `false` before the delay means a fast tap can answer during the reveal window (Lesson 109).

3. ARIA roles required on card elements — `role="button"` and `aria-label` describing card content (or `aria-pressed` for toggled state). Plain `<div>` elements with click handlers are inaccessible (ui-ux face-memory #512 UI-FM-004).

4. `aria-live="polite"` on match feedback — confirmed absent in face-memory #512 (UI-FM-002, 18th instance of ARIA-001).

5. `SignalCollector.reset()` in `restartGame()` — the sealed instance from the first play records zero events for replayed sessions (ui-ux expression-completer UI-EC-007, real-world-problem UI-RWP-004 — same pattern).

---

### Pattern E — Two-Step Expression

**CDN Parts**

| Part | Role |
|------|------|
| PART-025 ScreenLayoutComponent | Slot injection |
| PART-023 ProgressBarComponent | Round progress + lives |
| PART-024 TransitionScreenComponent | Start / victory / game-over |
| PART-013 Validation Fixed | String equality for each step |

Both steps rendered simultaneously in DOM. Step 2 hidden until Step 1 is answered. Custom layout only — no CDN two-step component.

**Bloom Levels:** L2 (Understand) and L3 (Apply).

**Example Games:** expression-completer (#511).

**When to use:** Round has two causally linked decisions (Step 2 depends on Step 1). Both steps are MCQ or short typed input.

**When to avoid:** Two steps are independent (use separate rounds). Step 1 has 4+ options and Step 2 also has 4+ options (cognitive overload; split into two games).

**Known Pitfalls:**

1. `data-testid` must be namespaced per step — `data-testid="part1-option-N"` for Step 1, `data-testid="part2-option-N"` for Step 2. If both steps are in DOM simultaneously with shared testids, `querySelector('[data-testid="option-0"]')` always returns the Step 1 button; tests cannot reach Step 2 (ui-ux expression-completer #511 UI-EC-002 — HIGH, confirmed test-gap).

2. `window.nextRound` not exposed — confirmed missing in expression-completer #511 (UI-EC-001). Game exposed `window.roundComplete` and `window.loadRound` but not `window.nextRound`. Always add `window.nextRound = nextRound` (or alias to the actual advancement function).

3. Wrong answer on Step 1 behavior must be explicitly specced — either instructional-only (show feedback + retry, no life deduction) or life-deducting (advance). Expression-completer uses life-deduction; real-world-problem uses instructional-only for Steps 1–2. Spec must make this explicit.

4. Step 2 panel uses CSS `hidden` class, not inline `display:none` — toggling `display:none` via inline style prevents CSS transitions. Use `classList.remove('hidden')` with a `hidden` class that sets `display:none`.

---

### Pattern F — Real-World Scenario

**CDN Parts**

| Part | Role |
|------|------|
| PART-025 ScreenLayoutComponent | Slot injection |
| PART-023 ProgressBarComponent | Round progress + lives (lives only on Step 3) |
| PART-024 TransitionScreenComponent | Start / victory / game-over |
| PART-013 Validation Fixed | Steps 1 and 2 MCQ string equality |
| PART-014 Validation Function | Step 3 typed numeric: `Math.abs(parseFloat(answer) - correct) <= tolerance` |
| PART-027 Play Area Construction | Word-problem card (always visible) + SVG diagram (always visible) + step panels |

**Bloom Levels:** L4 (Analyze). Learner constructs a mental model from a word description, selects the correct approach, and computes.

**Example Games:** real-world-problem (#564, #565 — both approved).

**When to use:** Skill is situational application. Prerequisites are solid. Session-plan position: last game in a session (highest Bloom level).

**When to avoid:** As a first game in a session. When word problem requires domain knowledge not taught in the session.

**Known Pitfalls:**

1. Word-problem card + SVG diagram must always be visible — must remain on screen during all three steps. Hiding or replacing the problem context forces the learner to recall from memory (real-world-problem spec Section 2, PART-027 config).

2. `game_complete` postMessage must fire on both victory and game-over paths — route both through `endGame()`. If game-over exits without calling `endGame()`, Session Planner never marks the game complete.

3. `results-screen position:static` confirmed in #564 (UI-RWP-002) — GEN-UX-001 shipped but still missing. Verify position:fixed with browser playthrough before approving.

4. `SignalCollector.reset()` in `restartGame()` — confirmed missing in real-world-problem #564 (UI-RWP-004): replay sessions emit zero events.

5. `ProgressBarComponent` wrong slot ID — #564 used `'mathai-progress-bar-slot'` (wrong), causing fallback mount (UI-RWP-003). Must be `'mathai-progress-slot'`.

6. Typed input needs Enter key binding — `#answer-input` (type="number") for Step 3 must bind `keydown` Enter: `input.addEventListener('keydown', e => { if (e.key === 'Enter') handleAnswerSubmit(); })` (real-world-problem #564 — 1st confirmed instance of this pattern).

7. Lives apply only to Step 3 computation — Steps 1–2 MCQ are instructional; wrong answers show feedback and allow continuation, no life deduction. Mixing this causes pedagogically inappropriate punishment of misconceptions the game should be teaching.

---

### Pattern G — Timer Race

**CDN Parts**

| Part | Role |
|------|------|
| PART-006 TimerComponent | CAUTION — do NOT use this CDN class (Lesson 87: does not exist in CDN bundle, causes ReferenceError). Use `setInterval`/`setTimeout` instead. |
| PART-023 ProgressBarComponent | Round progress + lives |
| PART-024 TransitionScreenComponent | Start / level-transition / victory / game-over |
| PART-025 ScreenLayoutComponent | Slot injection |

**Bloom Levels:** L1 (Remember) and L2 (Understand). Timer pressure promotes automaticity, not analysis. Use only when automaticity is the explicit learning goal.

**Example Games:** addition-mcq-blitz, adjustment-strategy (#385).

**When to use:** Explicit goal is automaticity or speed drill. Learner already demonstrated conceptual mastery through non-timed games in the same session. Star metric is time-based.

**When to avoid:** First exposure to a concept. L3+ Bloom levels. Games with worked-example panels (contradictory pedagogical intent).

**Known Pitfalls:**

1. `timer.start()` only in `renderRound()`, never in `setupGame()` or `DOMContentLoaded` — starting a timer in setup launches it during the start screen before the learner clicks "Let's go!" (verified correct pattern in adjustment-strategy #385).

2. `timer` must be cleared and recreated in `restartGame()` — `clearInterval(timer); timer = null` then start fresh. Reusing a running timer interval causes level-time calculations to include the pause between sessions.

3. Custom widget buttons also need `min-height: 44px` — GEN-UX-002 applies to `.game-btn` globally, but adjuster buttons (`.adj-btn`) set `height: 36px` explicitly and bypass the rule. Confirmed in adjustment-strategy #385 (ui-ux F1, F7): adjuster buttons 36px, reset button 30.5px. Every clickable button requires `min-height: 44px` with no exceptions.

4. Button IDs must survive innerHTML rebuilds — if `updateAdjusterUI()` rebuilds inner HTML to show updated values, button IDs (`btn-a-minus`, `btn-a-plus`, etc.) must be re-injected in the new HTML string. Losing IDs causes all mechanics tests to fail (Lesson 59; adjustment-strategy spec CRITICAL note).

5. Level-transition `TransitionScreen` requires `await transitionScreen.show(...)` — the `endGame('level-complete')` or equivalent path must `await` the transition screen and wire the "Continue" button action to `startLevel()` before calling it.

6. `window.nextRound` not exposed — confirmed missing in adjustment-strategy #385 (ui-ux F6): game uses `loadRound()` internally. Add `window.nextRound = loadRound` alias.

---

### Cross-Pattern Issues (Affect All 7 Patterns)

| Issue | Rule ID | Confirmed Instances |
|-------|---------|---------------------|
| `syncDOMState()` after every `gameState.phase =` | Lesson 50 | Virtually all games |
| `results-screen` must be `position: fixed; inset: 0; z-index: 100` | GEN-UX-001 | 17+ builds |
| All interactive buttons `min-height: 44px` | GEN-UX-002 | 8+ confirmed |
| `aria-live="polite"` on all dynamic feedback elements | ARIA-001 / GEN-120 | 20+ builds |
| `ProgressBarComponent slotId: 'mathai-progress-slot'` | GEN-UX-003 | 9+ builds |
| `TransitionScreen` object API (never string mode) | GEN-TS-001 | 2 builds |
| `TransitionScreen icons:` emoji only, not SVG strings | GEN-TS-002 | 2 builds |
| `window.nextRound` exposed on `window` | GEN-WINDOW-EXPOSE | 10+ builds |
| `TimerComponent` CDN class — use `setInterval` instead | Lesson 87 | Lesson 87 root cause |
| `SignalCollector.reset()` in `restartGame()` | UI-RWP-004 | 4+ builds |
| `data-testid` namespaced per step in multi-step games | GEN-TESTID-STEP | expression-completer #511 |

**Source files for all pitfalls above:**
- `games/which-ratio/ui-ux.md` (builds #560, #561)
- `games/name-the-sides/ui-ux.md` (build #557)
- `games/soh-cah-toa-worked-example/ui-ux.md` (build #544)
- `games/real-world-problem/ui-ux.md` (build #564)
- `games/expression-completer/ui-ux.md` (build #511)
- `games/adjustment-strategy/ui-ux.md` (build #385)
- `games/light-up/ui-ux.md` (build #508)
- `games/face-memory/ui-ux.md` (build #512)
- `games/find-triangle-side/ui-ux.md` (build #549)
- `games/count-and-tap/ui-ux.md` (build #551)
- `docs/lessons-learned.md` (Lessons 50, 59, 87, 109)
