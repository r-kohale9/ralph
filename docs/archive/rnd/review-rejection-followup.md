# R&D: Review Rejection Follow-Up Analysis (Post-Fix dd7f170)

**Date:** 2026-03-20
**Analyst:** Claude agent (automated R&D)
**Fix commit measured:** `dd7f170` — "fix: correct debug-function window exposure rule; add VisibilityTracker template to CDN constraints"
**Fix commit deployed:** 2026-03-20 17:35 IST (12:05 UTC)
**Data range:** Builds 296–347 (all builds after the baseline period)

---

## Executive Summary

The fix `dd7f170` was deployed at 12:05 UTC. As of this analysis, **no builds that used the new prompts.js have completed** — the 5 post-fix builds (343–347) are all still in `queued` status awaiting worker slots. Therefore, **impact cannot yet be measured numerically**.

What we CAN confirm:
1. The **debug-function rule (Category B) was correctly reversed** in `dd7f170` — the rule now says MUST be on window, not MUST NOT.
2. The **VisibilityTracker template added in `dd7f170` addresses the WRONG VisibilityTracker API** — it describes a simple DOM-element visibility tracker, not the FeedbackManager-integrated game visibility tracker that causes Category A rejections.
3. **Category B rejections (debug functions) are confirmed still occurring** in builds that ran on old prompts (crazy-maze build 294 had all debug functions local, not on window).
4. **Category F (truncated HTML)** emerged as a new terminal rejection in this period (kakuro build 299).

---

## Before vs After: Rejection Rate Comparison

### Pre-fix period (builds 50–295, analyzed in baseline)

| Metric | Value |
|--------|-------|
| Total builds | ~295 from build 50 |
| Final-state reviewed (approved + rejected) | 29 (18 approved + 11 rejected) |
| DB rejection rate | 11/29 = **37.9%** |
| Early-review rejection events (including recovered) | 28 events across 23 games |
| Early-review rejection rate | ~28 events / ~150 builds that reached review ≈ **18%** |

### Post-295 period (builds 296–347, this analysis)

| Metric | Value |
|--------|-------|
| Total builds queued | 52 |
| Completed builds | 18 (2 approved + 1 rejected + 15 failed/cancelled) |
| DB rejection rate (completed) | 1/3 = **33%** — sample too small |
| Early-review rejection events (from logs) | 5 events (aided-game, colour-coding-tool, crazy-maze, kakuro, jelly-doods) |
| Builds that used NEW prompts (post-dd7f170) | **0 completed** — all 5 queued |

**Conclusion: The sample of post-fix completed builds is insufficient (n=0) to measure impact. The 5 early-review rejections observed all ran on OLD prompts.js.**

---

## Post-295 Early-Review Rejection Events (All on Old Prompts)

All 5 rejection events occurred in builds queued at 09:46 UTC, before the fix deployed at 12:05 UTC. Classification:

### Event 1: aided-game (build 290) — RECOVERED
- **Status:** Early review rejected → fixed → APPROVED after fix
- **HTML analysis:** VisibilityTracker present, `sound.pause()` / `stream.pauseAll()` used (correct), `stopAll()` only in cleanup/destroy. `fromVisibilityTracker` missing from timer calls. `window.debugGame` missing (debug functions local). `events` field absent in postMessage.
- **Categories:** B (debug functions), partial A (missing fromVisibilityTracker), partial C (missing events field)
- **Recovery:** Early-review fix resolved enough issues to pass second review.

### Event 2: colour-coding-tool (build 292) — RECOVERED THEN FAILED
- **Status:** Early review rejected → fixed → APPROVED after fix → build FAILED (`logger is not defined`)
- **HTML analysis:** VisibilityTracker correct (sound.pause, stream.pauseAll, popupProps), `stopAll()` only in cleanup. `fromVisibilityTracker` missing. `window.debugGame` missing.
- **Categories:** B (debug functions), partial A (missing fromVisibilityTracker)
- **Note:** The `logger is not defined` failure is a separate infrastructure/pipeline bug — not a rejection issue.

### Event 3: crazy-maze (build 294) — RECOVERED THEN FAILED
- **Status:** Early review rejected → fixed → APPROVED → build FAILED (`logger is not defined`)
- **HTML analysis:** VisibilityTracker CORRECT (fromVisibilityTracker present, popupProps present, sound.pause, stream.pauseAll). `stopAll()` only in cleanup. `window.debugGame` missing — all debug functions local.
- **Categories:** B only (debug functions)
- **Note:** Clear Category B — the ONLY problem was debug functions not on window.

### Event 4: kakuro (build 299) — TERMINAL REJECTION
- **Status:** Early review rejected → fix attempted → REJECTED (terminal, DB status = rejected)
- **Review result (from DB):** "The generated HTML file is severely truncated. The main JavaScript block cuts off abruptly at `Sentry.captureException` within the `DOMContentLoaded` handler. This results in invalid JavaScript syntax, missing initialization for core components (SignalCollector, ScreenLayout, ProgressBar, TransitionScreen, VisibilityTracker), and missing closing HTML tags."
- **Categories:** F (truncated HTML) — terminal, fix could not recover because the game structure was fundamentally broken.
- **Note:** The generated HTML was NOT truncated (index-generated.html has 1722 lines, complete). The truncation occurred in index.html after harness injection or during GCP upload, OR the reviewer was reviewing the harness-injected file which ended abruptly at line 1619 without `</body></html>`. This points to a **harness injection truncation bug** rather than LLM truncation.

### Event 5: jelly-doods (build 298) — active at time of analysis
- **Status:** Early review rejected at 12:52 UTC, fix applied. Build was later killed by admin ("edge-cases iter3 collapsed, 51min wasted").
- **HTML analysis:** VisibilityTracker has `sound.pause` / `stream.pauseAll` but missing `fromVisibilityTracker`. `window.debugGame` present (one debug function on window). `window.testAudio` missing. `events` field absent.
- **Categories:** A (partial — missing fromVisibilityTracker), B (partial — testAudio not on window), C (partial — missing events)

---

## Category Summary: Post-295 Events (n=5)

| Category | Count | Still Present Post-Fix? |
|----------|-------|------------------------|
| B: Debug functions not on window | 4/5 (80%) | YES — fix not yet in any completed build |
| A: fromVisibilityTracker missing | 3/5 (60%) | YES — template in dd7f170 does NOT address this |
| C: Missing events/completedAt in postMessage | 2/5 (40%) | Unclear |
| F: Truncated HTML / harness injection bug | 1/5 (20%) | Possibly new pattern |

---

## Critical Finding: VisibilityTracker Template Is Wrong

**The VisibilityTracker template added in `dd7f170` targets the WRONG API.**

The template added describes:
```javascript
const tracker = new VisibilityTracker(element);
tracker.init();
tracker.visible = true;
```

This is a DOM-element visibility helper. The Category A rejections are about a **different VisibilityTracker** — the game lifecycle tracker that takes an options object with `onInactive`, `onResume`, and `popupProps`:

```javascript
new VisibilityTracker({
  onInactive: () => {
    timer.pause({ fromVisibilityTracker: true });  // ← missing from rejections
    FeedbackManager.sound.pause();                  // ← correct (not stopAll)
    FeedbackManager.stream.pauseAll();              // ← correct
    signalCollector.recordCustomEvent('visibility_hidden', {});
  },
  onResume: () => {
    timer.resume({ fromVisibilityTracker: true });  // ← missing from rejections
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
    signalCollector.recordCustomEvent('visibility_visible', {});
  },
  popupProps: { title: '...', description: '...', primaryText: '...' }
});
```

The most common specific violation is **missing `{ fromVisibilityTracker: true }` on timer calls** — this appeared in 3/5 post-295 events. The wrong template in dd7f170 will NOT prevent these rejections.

---

## New Pattern: Harness Injection Truncation (kakuro build 299)

The kakuro build 299 provides evidence of a potential new failure mode:
- `index-generated.html` (pre-harness): 1722 lines, complete with `</html>`
- `index.html` (post-harness): 1619 lines, ends abruptly after `Sentry.captureException` without `</body></html>`

This suggests the **test harness injection process truncated the HTML** at a `Sentry.captureException` line mid-file. The file was 1619 lines, which is shorter than the original 1722 — not a harness addition but a LOSS of content. This is worth investigating in `injectTestHarness()`.

---

## What Changed vs. What Stayed the Same

| Pattern | Baseline (builds 50–295) | Post-295 | Verdict |
|---------|--------------------------|----------|---------|
| Category B: debug functions (29%) | 8 events — dominant | 4/5 events — STILL dominant | Fix deployed, no completed build yet to verify |
| Category A: VisibilityTracker (39%) | 11 events — #1 | 3/5 events — still present | Template in dd7f170 targets wrong API — not fixed |
| Category C: postMessage incomplete (18%) | 5 events | 2/5 events | Unchanged |
| Category D: initSentry ordering (14%) | 4 events | 0 events | Possibly reduced |
| Category E: CDN audio domain (18%) | 5 events | 0 events | Possibly eliminated by domain fix |
| Category F: truncated HTML (7%) | 2 events | 1/5 events (harness bug) | New failure mode identified |

---

## Recommendations for Next Fix

### Priority 1 (Highest): Fix the VisibilityTracker template in CDN_CONSTRAINTS_BLOCK

The template in `dd7f170` is wrong — it addresses a DOM-element tracker, not the game lifecycle VisibilityTracker. Replace with the correct template that shows `onInactive`/`onResume` callbacks, `fromVisibilityTracker`, `popupProps`, and `sound.pause` vs `stopAll`.

Estimated impact: would eliminate ~60% of current early-review rejections (Category A).

### Priority 2: Investigate harness injection truncation (kakuro pattern)

In `lib/pipeline.js`, `injectTestHarness()` — check if the injection logic has a regex or string manipulation that could truncate content when encountering a `Sentry.captureException` call containing special characters. If confirmed, this is a code bug causing terminal rejections.

Estimated impact: eliminates Category F terminal rejections (currently 1/5 events = 20% of rejections, but 100% when it occurs — no recovery).

### Priority 3: Verify Category B fix actually works once post-fix builds complete

The 5 builds in queue (343–347) will be the first to run with corrected debug-function rules. Monitor their early review results. If any still reject for debug functions, there may be a secondary conflict elsewhere in the prompts.

---

## Hypothesis for Next Build Cycle

**Hypothesis:** "After fixing the VisibilityTracker template (Priority 1), Category A rejections will drop from 60% to <20% of events, and total early-review rejection rate will drop from ~18% to <8%."

**Measurable:** Track early-review-rejected log events per N builds over the next 20 builds.

---

*Analysis based on 5 early-review rejection events (builds 296–347, 2026-03-20). Fix commit dd7f170 deployed but no completed builds yet use the new prompts. Next verification window: builds 343–347 when they complete.*
