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
