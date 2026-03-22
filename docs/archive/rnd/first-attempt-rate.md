# R&D #65: First-Attempt Approval Rate Analysis

**Date:** 2026-03-21
**Scope:** All 447 builds across 51 unique games (DB as of analysis date)
**Method:** SQLite queries against production DB on 34.93.153.206

---

## Key Findings

### 1. First-Attempt Approval Rate: 0% All-Time, 29% Recently

No game has ever been approved on its very first build attempt across the entire history of the pipeline (builds 1–447, 51 unique games). However, the recent epoch (builds 350+) shows a dramatic improvement: **9 of 31 resolved games (29%)** were approved on their first attempt within that epoch — meaning when a game was re-queued after pipeline improvements, it often cleared immediately.

| Metric | Value |
|--------|-------|
| Total unique games | 51 |
| Games approved on absolute first-ever build | 0 (0%) |
| Games ever approved | 31 (61% of games attempted) |
| Games never approved | 20 (39%) |
| Average build attempts to first approval | 7.2 |

### 2. All Recent Approvals Required 0 Iterations (Pass-on-First-Generation)

Every single approval in the recent epoch (builds 350+) had `iterations=0`, meaning the generated HTML passed all tests without needing any fix-loop iterations. This is a significant signal: **the fix loop is not producing approvals — fresh generation on a new build attempt is**. Games that pass do so immediately; games that fail keep failing until the pipeline itself improves.

### 3. Per-Build Approval Rate Has Improved 5.5x

| Epoch | Builds | Approved | Per-Build Rate |
|-------|--------|----------|----------------|
| Epoch 1 (1–110) | 109 | 5 | 4.6% |
| Epoch 2 (110–230) | 120 | 11 | 9.2% |
| Epoch 3 (230–350) | 114 | 11 | 9.6% |
| Epoch 4 (350+) | 63 | 16 | **25.4%** |

The overall per-build approval rate has improved from 4.6% to 25.4% — a 5.5x improvement driven by pipeline improvements in generation quality, T1/T2 validation, and test generation.

### 4. Attempts-to-First-Approval Distribution

| Attempts Required | Games |
|-------------------|-------|
| 2 | 1 |
| 3 | 1 |
| 4 | 7 |
| 5 | 4 |
| 6 | 6 |
| 7 | 4 |
| 8 | 4 |
| 9 | 2 |
| 14 | 1 |
| 42 | 1 (adjustment-strategy) |

**Median: ~6 attempts.** The distribution is skewed by outliers (rapid-challenge at 14, adjustment-strategy at 42). Excluding those two, median is ~5 attempts.

### 5. Dominant Failure Mode: Games Exit at Iteration 0

Of 344 failed builds total, the overwhelming pattern is `iter=0` — meaning the pipeline fails before completing even one fix-loop iteration. This happens for several reasons:

| Failure Category | Count (builds 200+, failed) |
|-----------------|------------------------------|
| No error message (pipeline completed but didn't approve) | 55 |
| Other error messages | 61 |
| Duplicate/cancelled/already-approved | 21 |
| Orphaned (worker restart) | 10 |
| Step 1d: Blank page / missing #gameContent | 8 |
| Infrastructure kill (wrong config, worker restart) | 5 |
| Ghost build (silent pipeline death) | 2 |

The largest category ("No error, iter=0") likely represents games where the generated HTML failed T1/T2 static validation and was abandoned before ever running Playwright tests — the pipeline detected a fatal flaw early and reported it as a failed build without a detailed error message.

### 6. Step 1d (CDN Init Failure) is a Recurring Hard Blocker

8 recent builds failed at "Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element." This error means the game's CDN dependencies failed to load, leaving the page blank. Affected games include: bubbles-pairs, kakuro, associations (x2), disappearing-numbers, face-memory. These games require CDN libraries that may not load reliably in the headless Playwright environment.

### 7. 20 Games Have Never Been Approved

| Game | Failed Attempts |
|------|----------------|
| associations | 15 |
| count-and-tap | 9 |
| hide-unhide | 8 |
| crazy-maze | 7 |
| face-memory | 7 |
| colour-coding-tool | 6 |
| disappearing-numbers | 6 |
| expression-completer | 6 |
| memory-flip | 6 |
| simon-says | 6 |
| speed-input | 6 |
| true-or-false | 6 |
| light-up | 5 |
| mcq-multi-select | 5 |
| truth-tellers-liars | 5 |
| two-player-race | 5 |
| keep-track | 6 |
| totals-in-a-flash | 4 |
| visual-memory | 6 |
| template-schema.md | 1 (not a game spec) |

All 19 real games (excluding template-schema.md) are currently queued for fresh attempts in builds 415–447.

### 8. The Fix Loop Is Not the Path to Approval

A critical insight: no approved build in the recent epoch used the fix loop (all were `iterations=0`). The pipeline's fix loop (up to 5 iterations) is theoretically meant to rescue failing builds, but in practice:
- Games that fail keep failing through the loop without reaching approval
- When the pipeline code is improved and a fresh build is queued, games pass on the first generation attempt
- This suggests the fix loop prompt/strategy may not be targeting the right failure modes

---

## Actionable Hypotheses

1. **The fix loop is underperforming.** If fix-loop iterations actually worked, games would get approved mid-build rather than requiring N complete rebuild attempts. The per-iteration failure rate should be measured directly (what % of fix-loop iterations result in approval vs. continuing to fail).

2. **Step 1d CDN failures need early detection.** 8 builds wasted full pipeline runs hitting a blank page. The smoke-check smoke detector should catch CDN init failures before generation begins and skip to a known-good fallback.

3. **"No error, iter=0" builds hide the real failure mode.** 55 builds failed silently. Adding structured logging of the exact T1/T2 failure reason would enable root-cause analysis of the most common rejection reason.

4. **Epoch 4's 29% first-attempt rate (within epoch) may reach 50%+ with one more generation-prompt improvement.** The recent wave is the first time first-attempt success within a re-queue cycle has occurred at all. Targeting the remaining 20 hard-failing games would push overall game approval coverage from 61% → 100%.

---

## Trend Summary

The pipeline has gone from **0% first-attempt success** historically to **29% within the most recent build epoch**, driven by iterative pipeline improvements in generation quality, validation, and test infrastructure. The current blocker is a set of 20 games that have never been approved across 4–15 attempts each — all queued for fresh runs as of build 415+.
