# 04 — Iteration: What Happens After a Game Ships?

## TL;DR (skim in 30 seconds)

- **Shipping is the start, not the end** of the loop that matters.
- **3 levels of iteration**, picked by cost: **content swap** (minutes), **spec tweak** (hours), **full rebuild** (a day).
- **The gauge skill picks the cheapest level** that will actually fix the problem.
- **THE ITERATION LOOP HAS NEVER RUN.** Every artifact in this doc is a design. The MCP queries assume an unverified schema. Every example number is **fabricated for illustration**.
- **Pedagogy gap:** levels describe what artifact changes, NOT what *learning* changes. Easier ≠ better-taught.

---

## First Principles: Why Iterate?

### Step 1 — What is the goal?
Students stop having the misconception the game targets. Not "score higher." Not "play longer." Misconception extinction.

### Step 2 — How would you know?
Compare student behavior before vs after a change. Did the misconception appear less often? Did transfer to a never-seen problem improve?

### Step 3 — How do we change a deployed game?
Three options, ordered by cost:

| Level | What changes | Time | When |
|-------|-------------|------|------|
| Content swap | New questions, same code | Minutes | Round too easy/hard, weak distractors |
| Spec tweak | Spec edits → re-build → re-test → re-deploy | Hours | Scoring/lives/feedback wrong |
| Full rebuild | Restart from spec creation | Day+ | Wrong archetype or pedagogy |

**Picking the wrong level is the failure mode.** Rebuilding when a swap would work wastes hours. Swapping when code is broken wastes the next cohort.

---

## The Iteration Loop

```
Students play → SignalCollector captures attempts/timing/misconceptions
      ↓
Creator runs gauge skill → MCP queries gameplay DB
      ↓
GAUGE_REPORT (5 questions) → Creator picks level
      ↓
[Content swap]   [Spec tweak]   [Full rebuild]
      ↓               ↓                ↓
   Core API      Re-pipeline      Re-pipeline
   minutes        hours            from spec
      ↓
Redeploy → students play → gauge again
```

---

## Triggers — Which Level for Which Symptom

| Symptom | Level |
|---------|-------|
| One round too easy/hard, weak distractors, ordering off | Content swap |
| Scoring wrong, lives too punitive, missing hint, generic feedback | Spec tweak |
| Archetype mismatch, pedagogy wrong, fundamentally unengaging | Full rebuild |

---

## The Gauge Step — 5 Questions

| # | Question | Source |
|---|----------|--------|
| 1 | Lowest-accuracy round? | Per-round attempt records |
| 2 | Top misconception? | `misconception_tag` field |
| 3 | Learning vs guessing? | response_time × correctness |
| 4 | Difficulty curve shape? | Round accuracy progression |
| 5 | Abandonment rate / where? | session_metrics |

Each question maps to an action tagged `content-only` / `spec-change` / `full-rebuild`, prioritized P0–P3.

**Gauge refuses < 30 sessions.** Small samples = noise.

---

## Worked Example (FABRICATED — for illustration only)

> **NOTHING IN THIS EXAMPLE IS REAL.** No student has played either game built this session. Numbers below are what we *want* gauge to surface if the loop existed.

| Question | Hypothetical result |
|----------|---------------------|
| Q1 | Round 7 accuracy = 34% (Round 6 = 72%, Round 8 = 68%) |
| Q2 | 62% wrong answers = `additive-reasoning` |
| Q5 | 69% of abandonments at/after Round 7 |

**Decision:** P0 = content swap. Replace Round 7 with easier additive-trap question + worked hint. P1 spec tweak (misconception-specific feedback) ships separately.

**Action:** Sub-agent → Core API → new content set. **Minutes.** Re-gauge in a week.

---

## What's Needed for the Loop to Work

| Requirement | Status |
|-------------|--------|
| `SignalCollector` (PART-042) in shipped games | Implemented |
| Gameplay MCP exists | Yes — needs schema audit |
| Content set API (PART-031) | Implemented |
| Skill / spec versioning + history | TODO |
| `iteration.md` skill file | **Not yet written** |

---

## THE ITERATION LOOP HAS NEVER RUN

> Not on synthetic data. Not on real data. Not once.
>
> Every artifact in this doc — the three levels, the trigger table, the gauge questions, the Scale It Up example — is a **design**. The MCP queries are SQL templates against an **assumed schema** (`misconception_tag`, `response_time_ms`, `round_number`, `session_metrics.rounds_played` are unconfirmed). The Core API content-set path is documented but unexercised. The iteration skill file does not exist. **Until this loop closes once on real data, Alfred is an open-loop HTML generator with an iteration story attached — not a learning factory.**

---

## The Pedagogy Gap

The 3 levels are **delivery levels** (what artifact changes). They are NOT **learning levels** (what student-cognition changes). A learning-outcome rubric needs separate questions:

| Learning question | Why it matters |
|------------------|---------------|
| Did the misconception stop appearing? | Extinction, not score |
| Did transfer to a new surface improve? | Not gameable by easier content |
| Did scaffolding teach, or did easier content hide the gap? | Distinguish "easier" from "better-taught" |

**Without these in `iteration.md`, Alfred iterates on engagement and calls it learning.**

---

## Review Response

| Reviewer | Finding | Where addressed |
|----------|---------|----------------|
| Pedagogy | "Iteration described as code change, not learning" | Pedagogy Gap section added; flagged as required content for iteration.md |
| Systems | "Loop never ran end-to-end on real data" | Promoted to top-level callout box |
| CEO | "Examples are hypothetical (Round 7 30%)" | Worked example explicitly labeled FABRICATED with warning box |

### What still stands

| Fact | Status |
|------|--------|
| 3-tier cost-ordered framing | Right mental model |
| Trigger table maps spec attributes to change classes | Real mapping |
| Worked example replaceable once one cycle runs on real data | TODO |
