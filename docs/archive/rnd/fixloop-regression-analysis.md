# R&D: Fix Loop Regression Analysis

**Date:** 2026-03-20
**Hypothesis:** The fix loop sometimes submits HTML to review that scores LOWER than the best iteration — confirming a score-regression pattern that could directly improve approval rate.

---

## Verdict: CONFIRMED — The regression pattern is real

Score regressions are present in 15 of 42 builds (35.7%) that used the per-batch pipeline format, with 19 individual batch regressions. Multiple APPROVED builds reached review with a degraded iteration HTML that should have been replaced by the best-snapshot, but wasn't — because `batchPassed` (the tracking variable) was not updated even when the file WAS restored.

---

## Bug 1: `batchPassed` not updated in the 0/0 branch at `MAX_ITERATIONS`

**File:** `lib/pipeline-fix-loop.js`, lines 324–348

### Code trace

```
iteration N (N == MAX_ITERATIONS):
  passed = 0, failed = 0     ← both zero, page crashed
  batchPassed = 0            ← set on line 249

  → enter block at line 324:
      if (bestHtmlSnapshot) fs.writeFileSync(htmlFile, bestHtmlSnapshot);   ← FILE IS RESTORED ✓
      if (iteration >= MAX_ITERATIONS) break;   ← BREAKS HERE

  → lines 339-347 NEVER EXECUTE:
      if (iteration >= MAX_ITERATIONS) {
        if (bestHtmlSnapshot && passed < bestPassed) {
          batchPassed = bestPassed;   ← THIS LINE IS NEVER REACHED
        }
      }
```

The file on disk IS correctly restored to the best-snapshot HTML when the 0/0 path fires at the last iteration. But `batchPassed` is never updated from 0 to `bestPassed`. This leaves the batch's tracked pass count wrong, which in turn means `report.category_results[batchLabel]` is written with the wrong value at line 682.

### Concrete evidence: Build 288 (`one-digit-doubles`, APPROVED)

The mechanics batch iteration log:
- Iteration 1: 15 passed, 8 failed → best snapshot saved (15)
- Iteration 2: 0 passed, 0 failed → file restored to best; `batchPassed` stays 0
- Iteration 3: 0 passed, 0 failed → file restored (again) to best; `batchPassed` stays 0; MAX_ITERATIONS → break

`report.category_results['mechanics']` written as `{ passed: 0, failed: 0 }` even though the HTML on disk was the iteration-1 version (15 passing). The file submitted to review WAS the best HTML — but the score accounting was wrong. This makes the `reviewPrompt` show a degraded score summary to the reviewer.

---

## Bug 2: Step 3b final re-test keeps the WRONG score when re-test returns 0/0

**File:** `lib/pipeline-fix-loop.js`, lines 869–870

```javascript
if (reTestPassed === 0 && reTestFailed === 0 && (prevPassed + prevFailed) > 0) {
  warn(`... keeping previous score ${prevPassed}p/${prevFailed}f`);
}
```

This guard is intended to handle a page crash during the final re-test — it "preserves" the prior score to avoid a spurious downgrade. But if `prevPassed` was already wrong (0 due to Bug 1), this guard locks in the wrong score permanently, preventing Step 3b from correcting it.

If `prevPassed = 0` and the final re-test also returns 0/0, the guard fires and the score stays 0. If instead the final re-test returns a non-zero result (e.g., 15 passed), Step 3b WOULD correctly update the score. So Step 3b is a partial mitigation — but only when the re-test doesn't also encounter the 0/0 page-crash condition.

---

## Bug 3: Global fix loop (Step 3c) has no best-snapshot tracking at all

**File:** `lib/pipeline-fix-loop.js`, lines 820–838

The global fix loop writes each new HTML to disk unconditionally (line 834) with only a 30% shrink-ratio rollback check. There is no `globalBestHtmlSnapshot` variable — if global fix iteration 1 improves the score and iteration 2 degrades it, the degraded version is submitted to review. This is a separate regression vector from Bug 1 but follows the same pattern.

---

## Flow answers to Step 2 questions

1. **When a batch finishes with all tests passing** (line 334-336): uses `break` immediately — current HTML (= passing HTML) is correct and consistent with `batchPassed`.

2. **When a batch FAILS all iterations at max**: two paths depending on whether the last iteration is 0/0 or has actual failures.
   - Actual failures (passed < bestPassed, failed > 0): line 341-346 correctly restores best HTML AND updates `batchPassed`. **No bug here.**
   - 0/0 (no tests ran): line 330 breaks WITHOUT updating `batchPassed`. **Bug 1.**

3. **Can a later batch corrupt an earlier batch's state?** Yes, indirectly: the global fix loop (Step 3c) writes a single unified HTML fix. If the global fix improves batch B but breaks batch A, the degraded-A version proceeds to review with no rollback. This is Bug 3.

4. **What HTML gets passed to the review step?** `fs.readFileSync(htmlFile, 'utf-8')` at pipeline.js line 833 — always the current file on disk. In the Bug 1 case, the file IS the best-snapshot (correctly restored). But the score summary passed in `reviewPrompt` (via `categoryResultsSummary`) reflects the wrong `batchPassed=0`, so the reviewer sees "mechanics: 0/23 passing" instead of "mechanics: 15/23 passing", potentially causing an incorrect rejection.

---

## Impact estimate across last 42 builds

| Metric | Value |
|--------|-------|
| Builds with per-batch test_results | 42 |
| Builds with at least one batch regression | 15 (35.7%) |
| Individual batch regressions | 19 |
| APPROVED builds that had regressions | 9 |
| REJECTED/FAILED builds that had regressions | 6 |

**Key observation:** 9 builds were APPROVED despite the regression — meaning the HTML submitted was actually fine (file was correctly restored per Bug 1), but the score summary shown to the reviewer was understated. These builds got lucky that the reviewer approved anyway. In marginal cases, a correct summary could be the difference between approval and rejection.

The most severe regression observed was Build 288: mechanics batch showed "0 passing" in the report but the HTML actually had 15 mechanics tests passing. The build was approved, but the review prompt told the LLM reviewer that 0/23 mechanics tests passed — an incorrect representation that could cause rejection in a less generous reviewer model.

---

## Proposed fixes (not implemented — research only)

### Fix for Bug 1 (critical, 2 lines)

In the 0/0 branch at `MAX_ITERATIONS` (line 330), update `batchPassed` before breaking:

```javascript
// Current (line 326-331):
if (bestHtmlSnapshot) {
  fs.writeFileSync(htmlFile, bestHtmlSnapshot);
  info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
}
if (iteration >= MAX_ITERATIONS) break;
continue;

// Fix: update batchPassed to match the restored file's score
if (bestHtmlSnapshot) {
  fs.writeFileSync(htmlFile, bestHtmlSnapshot);
  batchPassed = bestPassed;            // ADD THIS LINE
  batchFailed = 0;                     // ADD THIS LINE (0/0 means we don't know failed count)
  info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
}
if (iteration >= MAX_ITERATIONS) break;
continue;
```

### Fix for Bug 3 (global fix loop, medium)

Add a `globalBestHtml` / `globalBestScore` tracker in the global fix loop (Step 3c), similar to the per-batch `bestHtmlSnapshot` pattern. Before writing global fix HTML, check total pass count; if it drops, restore.

---

## Summary

- **Is the regression pattern real?** Yes, confirmed in 35.7% of builds.
- **Does the code correctly use best-snapshot?** Partially. The file on disk is correctly restored in the 0/0 case, but `batchPassed` (and thus `report.category_results`) is NOT updated, giving the reviewer a misleading score. In the global fix loop, there is no best-snapshot tracking at all.
- **Measurable impact:** 15 of 42 builds affected. 9 APPROVED builds had their score understated in the review prompt. Fixing Bug 1 would give the reviewer an accurate score in all cases, and could convert marginal rejections to approvals.
- **Highest leverage fix:** Bug 1 (2 lines in `pipeline-fix-loop.js`) addresses the most common regression and is low-risk since the file restoration logic is already correct.
