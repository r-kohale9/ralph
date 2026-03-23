# Statistics Session — Measures of Central Tendency

**Target concept:** Measures of central tendency (Mean, Median, Mode) — classification, computation, and appropriate use
**Standard:** NCERT Class 9 Ch 14 / Class 10 Ch 13–14 §14.4 / CC HSS-ID.A.2, HSS-ID.A.3
**Total time:** ~20–25 minutes
**Prerequisite:** Basic arithmetic (addition, division), ability to order a list of numbers

---

## Session Sequence (prerequisite-ordered)

| Game # | Game ID | Bloom Level | Interaction Type | Status | Build |
|--------|---------|-------------|-----------------|--------|-------|
| 1 | `stats-identify-class` | L1 Remember | MCQ — classify which measure (Mean/Median/Mode) fits a described dataset, no computation | Spec ready — awaiting first build | — |
| 2 | `stats-mean-direct` | L2–L3 Understand→Apply | MCQ — compute arithmetic mean of 5–7 numbers (direct method); 4-distractor MCQ | Spec ready — awaiting first build | — |
| 3 | `stats-median` | L3 Apply | MCQ — find median of 5–7 numbers; requires sorting first | Spec ready — awaiting first build | — |
| 4 | `stats-mode` | L3 Apply | MCQ — find mode of ungrouped and grouped data; includes bimodal and formula rounds | Spec ready — awaiting first build | — |
| 5 | `stats-which-measure` | L4 Analyze | MCQ — given a real-world scenario with justification options, evaluate competing reasoning to select the most appropriate measure | Spec ready — awaiting first build | — |

**Note on ordering:** The sequence above is strict. A learner who cannot classify measures by description (Game 1) lacks the conceptual anchor for the computation games that follow. A learner who cannot compute all three measures (Games 2–4) will struggle to reason about which measure is *appropriate* (Game 5). Build and queue in order: stats-identify-class first, then stats-mean-direct → stats-median → stats-mode → stats-which-measure.

---

## Design Rationale

### Game 1 — stats-identify-class (L1 Remember)

The most common failure mode when a learner first encounters "measures of central tendency" is treating mean, median, and mode as three different algorithms for the same thing — interchangeable ways of summarising data. They are not. Each measure answers a different question about the data: mean asks "what is the fair share?", median asks "what is the middle value when ordered?", mode asks "what appears most often?"

This game forces pure classification — no computation required. Given a real-world scenario and dataset description, the learner must identify which measure is most appropriate. The worked-example panel (expands on first wrong attempt) shows the "Measure Selector" reference card with the correct reasoning highlighted. 10 rounds cover Indian Class 10 contexts (marks, salaries, shoe sizes, temperature, fruit sales) that directly target the four documented misconceptions.

No timer. Time pressure contradicts the worked-example pedagogical goal: the learner must read and reason about the reference card, not rush past it.

Game title: "Which Measure?"

### Game 2 — stats-mean-direct (L2–L3 Understand→Apply)

Computation is the weakest evidence of understanding — a learner can execute an algorithm without knowing what it means. But computation is still a prerequisite for reasoning: a learner who cannot calculate the mean cannot judge whether it is being distorted by an outlier.

This game builds computational fluency for arithmetic mean (direct method: Σxi / n). The four MCQ distractors are engineered to surface specific misconceptions: (1) raw sum without dividing by n; (2) dividing by the wrong n (off-by-one count); (3) selecting the mode when repeated values create a plausible distractor; (4) selecting the median (positional confusion). Three tiers of difficulty: Easy (whole numbers, n=5, sum ≤ 50) → Medium (larger values, mental carry) → Hard (repeated values creating mode distractor, real-world context requiring transfer).

45 seconds per round allows mental calculation without feeling rushed. Timer included — unlike Game 1, computation games benefit from mild time pressure to prevent pen-and-paper dependency.

Game title: "Mean Machine"

### Game 3 — stats-median (L3 Apply)

The median is commonly the most difficult of the three measures for learners to compute correctly because it requires a two-stage process: sort the data, then find the middle value. Learners who skip sorting produce wrong answers even when they know the formula. Learners with even-count datasets frequently pick one of the two middle values rather than averaging them.

This game targets both failure modes explicitly. Easy rounds use pre-sorted or odd-n data (sort step is trivial, median is the 3rd value). Medium rounds introduce unsorted data and even-n requiring averaging. Hard rounds use skewed datasets with a large outlier — the spatial midpoint between min and max differs dramatically from the ranked median, targeting the "spatial middle" misconception documented in classroom research.

Distractors per round: (1) M-no-sort (pick middle-position without sorting), (2) M-even-half (pick one middle value not the average), (3) M-off-by-one (index error), (4) M-mean (additive confusion).

Game title: "Middle Ground"

### Game 4 — stats-mode (L3 Apply)

Mode is deceptively simple at the surface (find the most frequent value) but produces documented errors in two distinct contexts: (a) grouped data requiring the formula Mode = L + [(f₁−f₀)/(2f₁−f₀−f₂)]×h — learners misread the frequency table and substitute wrong rows for f₀ and f₂; (b) bimodal data — learners report only one mode, missing the second. Both are targeted here.

Three tiers: Easy (clear single mode, ungrouped, n=7–9) → Medium (bimodal datasets, M-multiple-mode targeted) → Hard (grouped frequency table with formula application). Includes rounds where the maximum value coincides with a plausible distractor — targeting the documented error where students pick the largest rather than the most frequent value.

Game title: "Most Common"

### Game 5 — stats-which-measure (L4 Analyze)

Transfer to novel reasoning — the hardest Bloom level in the session. Unlike Game 1 (which asks "which measure fits?"), Game 5 requires the learner to evaluate competing reasoning: each MCQ option presents not just a measure name but a brief justification ("Median — because the salary data has extreme values that pull the mean higher than most earners experience"). The learner must evaluate whether each justification is valid, not just recall which measure is associated with which scenario type.

6 rounds covering the full three-way decision space: (R1) salary data with outliers → Median; (R2) shoe sizes (categorical) → Mode; (R3) symmetric test scores → Mean; (R4) house prices in a skewed market → Median; (R5) favourite colours → Mode; (R6) daily rainfall with extreme storm events → Median.

60-second timer — L4 reasoning takes longer than L1–L3 computation, and tight time forces use of prior knowledge rather than re-deriving from scratch.

Game title: "Measure Selector"

---

## Pedagogical Approach

The session moves through four cognitive levels deliberately:

**L1 (classify):** The learner recognises which measure fits a described context. No calculation. This establishes the *purpose* of each measure before any algorithm is introduced — a top-down approach grounded in cognitive load theory. Learners who know *why* mean/median/mode differ can anchor the computation algorithms to that conceptual framework.

**L2–L3 (compute):** Three consecutive games build computational fluency for each measure in isolation: mean (Game 2), then median (Game 3), then mode (Game 4). The order follows the NCERT Class 10 chapter structure and matches increasing algorithmic complexity: mean is one formula → median requires ordering → mode requires either frequency inspection or a multi-variable formula for grouped data.

**L4 (analyze):** The session ends with a game that requires the learner to synthesize all three measures. Knowing how to compute all three is a prerequisite — Game 5 is explicitly inaccessible to a learner who cannot distinguish the three measures' properties. This is the design intent: the final game is hard because of what it requires the learner to have learned, not because of arbitrary difficulty inflation.

**Why this order works:**
- L1 classification establishes the conceptual model before algorithms — prevents "three arbitrary procedures" misconception
- L2–L3 computation builds the working knowledge that L4 synthesis requires
- L4 analysis forces the learner to evaluate competing reasoning — evidence of genuine understanding, not pattern matching
- The worked-example scaffold in Game 1 (first wrong attempt → reference card) gives the learner a decision framework they can use mentally in Game 5

---

## Session Sequencing Rule

Build and queue strictly in order:

```
stats-identify-class → stats-mean-direct → stats-median → stats-mode → stats-which-measure
```

Do not queue Game 2 until Game 1 is approved. Do not queue Game 5 until Games 2–4 are approved. Game 5's spec explicitly assumes the learner has computed all three measures and can reason about them — if any of Games 2–4 have spec defects, those defects will surface as failures in Game 5 that are hard to diagnose because the context has changed.

The sequencing also applies to spec review: review stats-identify-class spec first. Any anti-pattern corrections discovered there (FIX-1 through FIX-5) were applied forward to all four remaining specs before first build. Do not re-derive anti-pattern fixes from each spec in isolation.

---

## Key Spec Decisions

**CDN components:** All 5 games use only the standard component set (ScreenLayout, TransitionScreenComponent, ProgressBarComponent, FeedbackManager, TimerComponent). No new CDN packages required. The pipeline can build all 5 games without any warehouse component additions.

**Anti-pattern compliance:** All 5 specs carry the full FIX-1 through FIX-5 critical warning block:
- FIX-1: PART-017 excluded (no `FeedbackManager.init()` — audio permission popup)
- FIX-2: `window.gameState` set at module scope (not inside DOMContentLoaded)
- FIX-3: `window.endGame`, `window.restartGame`, `window.nextRound` set in DOMContentLoaded
- FIX-4: `restartGame()` destroys and recreates TimerComponent (not reuses)
- FIX-5: `gameId` is the first field in the gameState object literal

stats-identify-class was spec'd first and established this pattern. All subsequent specs in the session were written with the same block applied from the start.

**Timer lengths (deliberate variation):**
- Game 1 (L1 MCQ, classification): no timer — worked-example panel requires unhurried reading
- Game 2 (L2–L3, compute mean): 45 seconds — allows mental arithmetic without pen dependency
- Game 3 (L3, find median): 45 seconds — allows mental sorting for n≤7
- Game 4 (L3, find mode): 45 seconds — includes formula rounds; 45s is achievable with practice
- Game 5 (L4, analyze): 60 seconds — L4 reasoning requires evaluating competing justifications; tight time forces use of prior knowledge

**Lives:** 3 across all 5 games — session consistency. A learner who loses all 3 lives sees the game-over screen, not an infinite retry loop. This is deliberate: the session is designed to be replayed, not brute-forced.

**Stars (session consistency):**
- Games 2–5: standard 3-star scoring (≥80% first-attempt = 3★; ≥60% = 2★; <60% = 1★)
- Game 1: 3★ ≥ 8/10; 2★ ≥ 6/10; 1★ otherwise (10-round game, first-attempt accuracy)

**Rounds per game:** 10 (Game 1), 9 (Games 2–4: 3 rounds × 3 difficulty tiers), 6 (Game 5: one round per scenario type). Variation is deliberate — Games 2–4 need enough rounds to cover the three-tier difficulty curve; Game 5 is limited to 6 because L4 reasoning at 60s/round is cognitively demanding.

---

## Misconceptions Targeted

| Misconception | Targeted By |
|--------------|-------------|
| Mean, median, mode are interchangeable (all three describe "average") | Game 1 — classification across varied contexts |
| Mean is always the right measure ("average" = mean in casual speech) | Games 1, 5 — median/mode scenarios force distinction |
| Sum ÷ n is the only formula for mean (no concept of why) | Game 2 Hard — real-world transfer rounds (Pollatsek 1981) |
| Median can be found without sorting first | Game 3 Medium/Hard — M-no-sort distractor |
| For even n, median is one of the two middle values (not their average) | Game 3 Medium — M-even-half distractor |
| Mode is the largest (or smallest) value | Game 4 Medium — M-freq-extremum distractor |
| Bimodal data has only one mode | Game 4 Medium — bimodal rounds, M-multiple-mode distractor |
| Grouped-data mode formula: using wrong rows for f₀ and f₂ | Game 4 Hard — formula rounds targeting M-formula-error |
| Median = Mean in symmetric distributions (they coincide, so they're the same) | Games 3, 5 — skewed datasets where median ≠ mean |
| Categorical data can have a meaningful mean | Game 5 — shoe sizes / favourite colours → Mode only |

---

## Curriculum Alignment

### NCERT

| Section | Topic | Games |
|---------|-------|-------|
| Class 9 Ch 14 §14.4 | Mean of ungrouped data (direct method) | Game 2 |
| Class 10 Ch 13 §13.3 | Mode of grouped data (formula) | Game 4 Hard |
| Class 10 Ch 14 §14.1 | Mean, median, mode — choosing appropriate measure | Games 1, 5 |
| Class 10 Ch 14 §14.4 | Empirical relationship: 3 × Median = Mode + 2 × Mean | Games 1, 5 (background context) |

### Common Core (HS Statistics)

| Standard | Topic | Games |
|----------|-------|-------|
| HSS-ID.A.2 | Compare center (median, mean) and spread; effect of outliers | Games 1, 3, 5 |
| HSS-ID.A.3 | Interpret differences in shape, center, spread; effect of outliers on data summaries | Game 5 |

---

## Build Log

| Build | Game | Status | Key Finding |
|-------|------|--------|------------|
| — | stats-identify-class | Spec ready — awaiting first build | FIX-1 through FIX-5 applied; no-timer design (worked-example panel requires reading time) |
| — | stats-mean-direct | Spec ready — awaiting first build | 3-tier difficulty; 4 distractors engineered from Pollatsek 1981 + Cambridge common errors |
| — | stats-median | Spec ready — awaiting first build | M-no-sort distractor is highest-frequency error per AAMT Top Drawer |
| — | stats-mode | Spec ready — awaiting first build | Includes NCERT grouped-data formula rounds in Hard tier |
| — | stats-which-measure | Spec ready — awaiting first build | L4 cap — 60s timer, justification-MCQ (not just label-MCQ) |

---

## Session Planner JSON (target output format)

When the Session Planner is implemented, this session should be producible from:

```json
{
  "curriculum": "NCERT",
  "grade": 10,
  "topic": "statistics-central-tendency",
  "concept_node_order": [
    { "node": "measure-classification", "game": "stats-identify-class", "spec": "specs/stats/stats-identify-class.md" },
    { "node": "mean-computation", "game": "stats-mean-direct", "spec": "specs/stats/stats-mean-direct.md" },
    { "node": "median-computation", "game": "stats-median", "spec": "specs/stats/stats-median.md" },
    { "node": "mode-computation", "game": "stats-mode", "spec": "specs/stats/stats-mode.md" },
    { "node": "measure-selection", "game": "stats-which-measure", "spec": "specs/stats/stats-which-measure.md" }
  ],
  "ncert_alignment": "Class 9 Ch 14, Class 10 Ch 13-14",
  "session_count": 2,
  "total_minutes": 22
}
```
