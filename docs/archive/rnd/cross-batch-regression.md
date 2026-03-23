# R&D Investigation: Cross-Batch Regression Detection

**Date:** 2026-03-20
**Method:** Code trace (lib/pipeline-fix-loop.js), prior diagnosis review (docs/rnd-chronic-failures-diagnosis.md), live DB analysis (builds 191–291, 19 multi-batch builds)
**Status:** Trace + Hypothesis complete. Implementation not started.

---

## Problem Statement

The per-batch sequential fix loop (`lib/pipeline-fix-loop.js`) cannot detect cross-batch regressions in real time. When a fix applied in batch N breaks batch N+1, the pipeline:
1. Discovers this only when batch N+1 runs (3–15 minutes later)
2. Spends all 3 of batch N+1's iterations attempting HTML fixes from the already-broken state
3. Has no mechanism to roll back to the pre-batch-N-fix HTML state

The fix loop's `bestHtmlSnapshot` mechanism is per-batch and per-iteration — it snapshots the best HTML **within a batch**, but has no cross-batch visibility. By the time batch N+1 fails, the batch N HTML state has been committed to disk and the budget has moved on.

---

## Code Trace: How the Fix Loop Works

### Per-batch loop (Step 3, lines 210–702)

```
for each batch in orderedSpecFiles:
  bestHtmlSnapshot = null   ← scoped to this batch only
  for iter 1..MAX_ITERATIONS:
    run playwright on batch-only spec files
    if passed > bestPassed: save bestHtmlSnapshot
    if all pass: break
    if max iters: restore bestHtmlSnapshot, break
    call LLM fix → write to htmlFile (shared file)

  record category_results[batch] = {passed, failed}
  record priorBatchPassingTests[] ← test bodies only, NOT the HTML that produced them
```

**Critical observation:** `priorBatchPassingTests` captures test source code from earlier batches, injected into the fix prompt as a "DO NOT REGRESS" hint. But this is a soft advisory to the LLM — it does not enforce anything. If the LLM's fix for batch N+1 inadvertently breaks the contract established by batch N, the pipeline has no detection mechanism until batch N+2 (or the global fix loop).

### Global fix loop (Step 3c, lines 704–869)

The global fix loop runs **after all per-batch loops complete**. It re-runs all batches once per global iteration, identifies remaining failures, and calls a single LLM fix with the full picture. It has its own `globalBestHtml` snapshot.

**Problem with global fix loop for this issue:** By the time Step 3c runs, each per-batch loop has already spent its 3-iteration budget. The global loop gets MAX_GLOBAL_FIX_ITERATIONS (typically 1–2) to clean up. This is a recovery mechanism, not a prevention mechanism — it cannot compensate for the wasted per-batch iterations on a corrupted HTML state.

### Final re-test (Step 3b, lines 871–905)

After Step 3c, all batches are re-tested on the final HTML. This correctly captures the true final state. This is why some builds show `0/0` in a batch at the end despite earlier iterations showing real results — the final HTML may have regressed that batch to zero, but the code correctly reports the re-test result.

---

## Empirical Trace: Regression Frequency

Analysis of 19 multi-batch builds (status: failed/approved/rejected, last 30 with test_results):

**12 out of 19 builds (63%) showed cross-batch regression patterns.**

Two regression types identified:

### Type 1: Downstream batch all-zero-pass (upstream passed)
Later batch spent all its iterations on 0-pass results while an earlier batch had already passed.

| Build | Game | Status | Affected Batch | Iterations Wasted |
|-------|------|--------|----------------|-------------------|
| 227 | hidden-sums | failed | level-progression (1 iter) | 1 |
| 211 | right-triangle-area | approved | contract (3 iters) | 3 |
| 209 | doubles | approved | contract (3 iters) | 3 |
| 204 | doubles | approved | edge-cases (1 iter) | 1 |
| 202 | doubles | rejected | contract (2 iters) | 2 |
| 194 | rapid-challenge | rejected | contract (1 iter) | 1 |
| 191 | identify-pairs-list | approved | contract (1 iter) | 1 |

### Type 2: Intra-batch peak-then-drop (a batch peaked then finished lower)
A batch reached a best score mid-iteration then finished lower — indicating the HTML was changed by a later batch's fix and the final re-test showed the drop.

| Build | Game | Status | Batch | Best → Final |
|-------|------|--------|-------|--------------|
| 288 | one-digit-doubles | approved | mechanics | 15 → 0 |
| 287 | position-maximizer | approved | game-flow | 1 → 0 |
| 212 | doubles | approved | edge-cases | 2 → 0 |
| 207 | doubles | approved | edge-cases | 1 → 0 |
| 202 | doubles | rejected | mechanics, edge-cases | 1→0, 1→0 |
| 193 | doubles | approved | game-flow, mechanics | 2→0, 1→0 |

**Key observation:** Build 288 (one-digit-doubles) had mechanics go from 15 passing to 0 in the final re-test. The build was still approved because other batches were intact. Build 288's final state shows `mechanics:0/0` — meaning the final HTML produced 0/0 (page crash) on mechanics, but the re-test logic kept the "previous score" of 0 (since it was 0/0). This is a silent quality degradation that passed review.

### Impact on final scores

Several approved builds show zero-passing final batches:
- Build 212: edge-cases 0/0 final
- Build 209: edge-cases 0/0, contract 0/1
- Build 207: edge-cases 0/0
- Build 204: edge-cases 0/3
- Build 193: game-flow 0/0, mechanics 0/0

These builds reached "approved" status despite having categories at 0 final — because the global fix loop partially recovered or the reviewer accepted the partial state.

---

## Root Cause Analysis

The structural failure mode has two sub-causes:

### Sub-cause A: Sequential, one-way information flow
Batches process in order. Batch N's HTML changes are immediately visible to batch N+1. But batch N+1's fix iterations have no knowledge of "what HTML state batch N was validated against." The `priorBatchPassingTests` context only sends test code — not the validated HTML state.

### Sub-cause B: bestHtmlSnapshot is per-batch scope
The snapshot tracks the best HTML **within the current batch's iterations**. At the end of a batch, the snapshot is discarded — it is never used to validate that subsequent batches don't regress against it. Even if a batch ends with `bestHtmlSnapshot` restored, a later batch's LLM fix will overwrite it without checking what it's replacing.

### Sub-cause C: Global fix loop arrives too late
Step 3c could theoretically catch all regressions, but it runs after all per-batch budgets are spent. For a 5-batch game with MAX_ITERATIONS=3, that's up to 15 LLM fix calls before the global loop gets one attempt. The global loop is one pass over a cumulative HTML that may have been degraded by 15 sequential conflicting fixes.

---

## Hypothesis

**Hypothesis:** If, after each batch's per-batch fix loop completes with a passing result, we re-run a fast smoke check of all previously passing batches (running only their tests, no new fix), builds that currently spend 3 iterations on a zero-pass downstream batch will instead detect the regression at the end of the upstream batch, roll back to the pre-fix HTML, and try a different fix path — reducing wasted iterations from 3 per regressed batch to 0–1, and eliminating zero-final-score categories in approved builds.

**Falsifiable form:** If we implement cross-batch smoke checks after each batch's fix loop, the fraction of approved builds with at least one zero-final-score category will drop from the current 37% (7/19) to <10%. Average wasted iterations per build (T1 pattern) will drop from ~1.5 to <0.3.

**Why this will work:** The regression detection cost is low — a single playwright run of prior batches' spec files takes 10–30 seconds (no LLM call). Currently these regressions cost 1–3 full fix iterations each (each iteration = triage + LLM fix = 3–6 minutes). Catching the regression immediately after the upstream batch completes gives the pipeline a chance to either (a) roll back the upstream fix and try again, or (b) mark the upstream batch as "cannot fix without regressing" and skip it before contaminating downstream batches.

---

## Option Comparison

### Option A: Post-batch smoke check + rollback (RECOMMENDED)
After each batch completes with `batchPassed > 0`, immediately run playwright on all previously-passing batches. If any prior batch now fails, roll back `htmlFile` to the snapshot that was current before this batch's first iteration, mark the batch as "untreatable without regression," and move on.

- **Effort:** Medium. Requires storing a "pre-batch HTML snapshot" at the start of each batch loop, and a 10–30s playwright run after each batch completion.
- **Risk:** Adds 10–30s per batch (only when batch passes). For a 5-batch game, ~2 minutes total overhead in the happy path. Acceptable.
- **Limitation:** If the upstream fix genuinely requires the change that breaks the downstream batch, rollback leaves the upstream batch with a suboptimal HTML. But this is better than the current state (downstream batch corrupted, wasted 3 iterations, upstream fix still in place anyway).

### Option B: Global baseline HTML tracking
Track a "global baseline" HTML at the start of the per-batch loop. After each batch fix iteration, re-test all prior batches. Roll back if global passing count drops below baseline.

- **Effort:** High. Requires re-running ALL batches after EVERY iteration, which multiplies playwright execution time by N batches. For MAX_ITERATIONS=3 and 5 batches, this is 5 × (3 × 4 re-tests) = 60 playwright runs vs the current 15.
- **Not recommended.** The overhead is too high and the granularity is too fine.

### Option C: Increase MAX_ITERATIONS with early-exit
Increase MAX_ITERATIONS from 3 to 5 and add an early-exit if total passing count across all previously-run batches drops below a threshold.

- **Effort:** Low. Config change + one check.
- **Problem:** Does not address the root cause. More iterations per batch means more opportunities to corrupt downstream batches. The early-exit threshold is hard to calibrate without false positives.
- **Not recommended.** Treats symptoms, not cause.

---

## Recommended Implementation: Option A (design sketch)

**Where:** `runFixLoop()` in `lib/pipeline-fix-loop.js`, within the outer `for...of batches` loop.

**Changes needed (no code, design only):**

1. **Pre-batch snapshot:** At the start of each batch loop iteration (before `iteration = 1`), read and save `preBatchHtml = fs.readFileSync(htmlFile)`. This is a zero-cost operation.

2. **Post-batch smoke check:** After the inner iteration loop exits (batch complete, any result), if `batchPassed > 0` AND `priorBatchPassingTests.length > 0`:
   - Run playwright on all prior batch spec files (the same spec files that were previously run — already known from the `batches` array)
   - Sum up passed/failed across all prior batches
   - If any prior batch that previously fully passed (all tests passing) now has failures:
     - Log the regression
     - Restore `htmlFile` from `preBatchHtml`
     - Set `batchPassed = 0` (mark this batch as failed to fix without regression)
     - Push a progress event: `regression-detected`
     - **Do NOT burn fix iterations** — the regression was caused by the batch's fix, not the tests

3. **priorBatchPassingTests collection:** No change needed here. The existing logic that collects test bodies from passing batches is already in place; the smoke check just needs the batch spec file paths, which are available from the `batches` array.

4. **Global fix loop interaction:** Step 3c already re-runs all batches in sequence. After implementing the smoke check, Step 3c will still run, but it will start from a less-corrupted HTML state (regressions caught earlier), improving its success rate.

**Performance cost estimate:**
- 1 playwright run of N-1 prior batch spec files after each batch
- For a 5-batch game: 4 extra playwright runs (after batches 2–5)
- Each run: ~15–30 seconds (2–5 spec files, headless Chromium)
- Total overhead per build: ~2 minutes on the happy path
- Break-even: saves 1 wasted LLM fix iteration at ~3–5 minutes each

**Net time impact per build:** Saves 3–15 minutes of LLM fix iterations for builds with cross-batch regressions (63% of builds) at a cost of 2 minutes of extra playwright runs. Expected net saving: ~2–10 minutes per regressed build.

---

## Estimated Impact

From the last 19 multi-batch builds:
- **12 builds (63%) had at least one cross-batch regression**
- **7 builds (37%) had at least one zero-final-score category at approval** — these are quality escapes where the approved game has a broken category
- **T1 regressions** wasted an average of ~1.5 fix iterations per affected build (12 iterations wasted across 8 T1 occurrences)
- **T2 regressions** (intra-batch peak-drop) are partially addressed by the existing `bestHtmlSnapshot` mechanism, but the snap is overwritten by later batches without the new check

**Conservative estimate:** Option A would eliminate T1 regressions entirely and reduce T2 regressions by ~50% (catching the case where the current batch's fix corrupts a prior batch that the global loop would then recover). This translates to:
- 12 fewer wasted fix iterations across the next 19 builds
- 4–5 fewer zero-final-score category escapes per 19 builds
- ~20–40 minutes of total pipeline time saved per 19 builds

---

## Limitations and Caveats

1. **Does not fix games that simply cannot converge:** rapid-challenge and associations have test logic errors (timing race, wrong test expectation) that no cross-batch detection can fix. Those require targeted fixes as documented in `rnd-chronic-failures-diagnosis.md`.

2. **Does not eliminate the global fix loop need:** Step 3c is still necessary for cases where a batch simply cannot pass without changes that break another — the global loop addresses this holistically.

3. **Data quality note:** The regression analysis used the `test_results` array (per-iteration batch entries). The `category_results` field (which would give cleaner final state) was not populated for these builds — suggesting the pipeline is writing `test_results` as an array, not the object with `category_results` key. The per-iteration data is sufficient for this analysis but the discrepancy should be investigated separately.

4. **T2 regression signal quality:** Some T2 cases (batch peak-then-drop) may be explained by the final re-test (Step 3b) detecting that an intermediate fix degraded a previously-passing batch — which is *expected behavior* and partially handled by `bestHtmlSnapshot`. The smoke-check approach would eliminate these by detecting the regression during the per-batch loop rather than at the final re-test.

---

## Next Steps (when implementing)

1. Deploy Option A to staging, run 3–5 builds of historically-regressing games (doubles, right-triangle-area, one-digit-doubles)
2. Compare: iteration counts, final category scores, zero-final-score categories
3. Measure: build time delta (should be <5% overhead in passing builds, -15% in regressing builds)
4. If confirmed: merge, deploy, update ROADMAP

**Pre-condition:** Before implementing, apply the targeted fixes from `rnd-chronic-failures-diagnosis.md` for rapid-challenge and associations. Those games have different root causes that the smoke check will not solve.
