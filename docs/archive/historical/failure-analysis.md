# Ralph Pipeline — Comprehensive Build Failure Analysis

**Date:** 2026-03-20
**Scope:** All 223 FAILED/REJECTED builds in `builds.db` (ids 1–285), covering 8 months of pipeline development and 3 scale runs across 48+ game specs.
**Author:** Automated analysis by Claude agent.

---

## 1. Failure Taxonomy

### 1.1 Raw Counts (N=223)

| Category | Count | % | Description |
|----------|-------|---|-------------|
| A. SIGTERM / orphaned | 11 | 5% | Worker killed mid-run (SIGKILL, systemctl restart, BullMQ replay after restart) |
| B. BullMQ job stalled | 15 | 7% | `job stalled more than allowable limit` — Redis lock lost during long LLM call |
| C. Manual kill / debug | 5 | 2% | Deliberately killed to deploy fix or superseded by next queue |
| D. User cancelled | 3 | 1% | Explicitly cancelled via DB |
| E. Game init failure | 8 | 4% | 0% game-flow on all iterations — HTML never initializes `#gameContent` or `data-phase` |
| F. Review rejection / test logic | 35 | 16% | Either review model REJECTED the game, OR tests had persistent failures the fix loop couldn't resolve |
| G. Test data shape mismatch | 2 | 1% | `validSolution is not iterable`, `Cannot read properties of undefined (reading 'rounds')` — test assumed wrong data shape |
| H. Stale warehouse HTML | 25 | 11% | Scale-run 1+2: builds 169-245 — stale/broken warehouse HTML never generated fresh HTML; all iteration 1 tests timeout in beforeEach |
| I. Early development failures | 51 | 23% | Builds <100: pipeline under active development, no test_results — pipeline crashed before tests could run |
| J. Second scale run / no results | 68 | 30% | Builds 100-168: second scale run with stale warehouse HTML + pre-fix pipeline; same root cause as H but different era |

### 1.2 Causal Groupings

| Group | Categories | Count | % | Fix Type |
|-------|-----------|-------|---|----------|
| **Infrastructure** | A + B | 26 | 12% | Architecture: process management, Redis lock tuning |
| **Stale warehouse HTML** | H + J (scale-run subset) | ~70 | ~31% | Architecture: warehouse hygiene gate before build |
| **LLM / generation quality** | E + F + G | 45 | 20% | LLM prompt + validation: generation rules, fix loop depth |
| **Operational** | C + D | 8 | 4% | Human process — expected |
| **Early pipeline dev** | I | 51 | 23% | Historical: pipeline was not yet production-ready |

### 1.3 Production-Relevant Failures (excluding early dev, I)

Removing builds <100 (pipeline was not production-ready), the distribution shifts:

| Category | Count | % of N=172 |
|----------|-------|-----------|
| A. SIGTERM/orphaned | 11 | 6% |
| B. BullMQ stalled | 15 | 9% |
| E. Game init failure | 8 | 5% |
| F. Review rejection/test logic | 35 | 20% |
| G. Test data mismatch | 2 | 1% |
| H. Stale warehouse HTML | 25 | 15% |
| J. Scale run 2 (stale HTML) | 68 | 40% |

**Top 3 fixable categories by count:**
1. **J+H — Stale warehouse HTML** (93 builds, 54%) — architectural fix exists
2. **F — Review rejection / test logic** (35 builds, 20%) — LLM + fix-loop improvements
3. **A+B — Infrastructure failures** (26 builds, 15%) — process management

---

## 2. Top 3 Root Cause Deep Dives

### 2.1 Root Cause #1: Stale Warehouse HTML (93 builds — 54% of production failures)

**What happened:**
All 3 scale runs (builds 100-168, 169-245) queued 40-50 games simultaneously. The worker copied `warehouse/templates/<gameId>/game/index.html` into each build directory. `pipeline.js` line ~1630 checks `fs.existsSync(htmlFile) && fs.statSync(htmlFile).size > 5000` — if true, **HTML generation is skipped entirely**. For all 47 non-approved games, this HTML was stale/broken from prior failed runs. Every build then ran Playwright tests against the stale HTML, all tests timed out in `beforeEach` (waiting for `#mathai-transition-slot button` or `#app[data-phase]`), and the build FAILED with 0/N on iteration 1.

**Exact code path:**
- `lib/pipeline.js:1630-1633` — `existingHtml` check skips generation
- `lib/pipeline.js:2538-2588` — stale warehouse auto-detection added **after** builds 100-245 ran; the fix exists but was applied retroactively
- `worker.js:304` — `specPath` passed to pipeline; warehouse HTML copy happens at pipeline startup, not worker level

**Fault assignment:** 100% **pipeline architecture** — the generation-skip logic has no gate requiring the existing HTML to be from an APPROVED build.

**What prevents recurrence:**
- Lesson 25/36: Delete non-approved warehouse HTML before any scale run
- `pipeline.js` stale warehouse auto-delete on 0% game-flow iter 1 (added after build 227)
- But the auto-delete only triggers on `game-flow` batch + `iteration === 1` + `!htmlWasFreshlyGenerated` + `isInitFailure` — all 4 conditions must match simultaneously

**Gap still present:** The auto-delete guard requires `isInitFailure` — all failures must match `beforeEach|TimeoutError|waiting for|transition-slot|data-phase|SKIPPED`. If ANY failure has a different error pattern (e.g. a test assertion failure), the stale HTML is kept and all 3 iterations waste compute.

---

### 2.2 Root Cause #2: Review Rejection / Persistent Test Logic Failures (35 builds — 20%)

**What happened:**
After all fix iterations, either:
(a) The review model (Gemini 2.5 Pro) REJECTED the game for spec violations not caught by T1/T2 validation, OR
(b) The per-batch fix loop exhausted 3 iterations on the same failure pattern without resolution.

**Observed patterns from logs:**
- `calcStars` function uses wrong formula — star logic not derived verbatim from spec (builds 47-50)
- `JSON.stringify` missing in `console.error` calls — RULE-004 (build 50 REJECTED)
- `locator.click: Timeout 10000ms exceeded` on adjustment buttons — UI elements not clickable after multiple clicks (builds 47-49, 3 iterations failed)
- `signalPayload` not spread (`...signalPayload`) — T1 catches this now but older builds didn't
- `postMessage` timing: results screen visible assertion fails — game sends postMessage before DOM updates

**Exact code path:**
- `lib/pipeline.js:2440-2620` — per-batch fix loop (`for iteration = 1..MAX_ITERATIONS`)
- `lib/pipeline.js:2450-2500` — triage LLM call; if triage misdiagnoses `fix_html` when it's a test issue, wastes an iteration
- `lib/pipeline.js:3181-3190` — game-flow 0% + overall <70% → fails before review

**Fault assignment:** ~60% **LLM generation quality** (first-pass HTML has spec violations), ~40% **fix loop depth** (3 iterations insufficient for complex multi-bug games).

**Most impactful sub-patterns:**

1. **Triage misdiagnosis as `fix_html` when buttons are `pointer-events: none`**: The triage model sees `TimeoutError: locator.click` and diagnoses HTML bug, but the issue is the test re-clicking a disabled button. Deterministic pre-triage (Lesson 28) added for `pointer-events: none` pattern — but only catches the exact CSS phrase, not all forms of element-is-disabled.

2. **Review model rejects spec logic errors not detectable by T1/T2**: `calcStars` formula, `JSON.stringify` in logging, `async` missing on `handleGameOver`. These require reading the full spec. No automated check for these patterns — they only surface at review.

3. **Max iterations too low for multi-bug games**: `adjustment-strategy` needed 5+ iterations because game-flow, mechanics, level-progression, and contract ALL had distinct bugs. Each category consumed 3 iterations independently without benefit from other categories' fixes.

---

### 2.3 Root Cause #3: Infrastructure Failures — SIGTERM + BullMQ Stall (26 builds — 15%)

**What happened (SIGTERM/orphaned — 11 builds):**
- Worker restarted (`systemctl restart ralph-worker`) while a pipeline was running mid-LLM-call
- BullMQ replays the active job from the queue on next worker start (Lesson 7)
- `cleanupOrphanedBuilds()` marks the previous run as FAILED with "orphaned: worker restarted" message
- But the replayed job then runs from the beginning — no ability to resume from a checkpoint

**Exact code path:**
- `worker.js:296-1064` — `new Worker` with `lockDuration: 30m, lockRenewTime: 10m`
- `worker.js:startup` — `cleanupOrphanedBuilds()` marks running builds FAILED (added after lesson 43)
- `lib/pipeline.js:runPipeline` — no checkpoint; always runs all steps from scratch

**What happened (BullMQ stalled — 15 builds):**
- Pipeline jobs run for 25-35 minutes; BullMQ worker must renew the Redis lock every `lockRenewTime` (10 min)
- Scale run 2 (221-225) had 6+ jobs stalling in the same window — probable cause: concurrency=2 but Redis/Node event loop was saturated by concurrent Playwright + LLM calls, causing the BullMQ heartbeat renewal to be delayed past `lockDuration` (30 min)
- BullMQ marks job as stalled and re-queues it (up to `maxStalledCount` attempts), or moves to failed

**Exact code path:**
- `worker.js:1057-1058` — `lockDuration: 30 * 60 * 1000, lockRenewTime: 10 * 60 * 1000`
- No `maxStalledCount` explicitly set (BullMQ default is 1)
- Playwright browser processes and LLM HTTP calls (some up to 5 min) block the Node.js event loop, delaying BullMQ's internal `renewToken()` scheduler

**Fault assignment:** 100% **architecture** — no checkpoint/resume, no keepalive mechanism during blocking LLM calls.

---

## 3. Architecture POC: Warehouse Hygiene Gate

This is the highest-impact single fix. It would prevent 54% of production-relevant failures.

### 3.1 Problem Statement

`pipeline.js:1630` skips HTML generation when `warehouse/templates/<gameId>/game/index.html` exists and is > 5KB. This is valid for APPROVED games (avoid re-generating working HTML) but catastrophic for non-approved games (reuses broken HTML, wastes 3 iterations or entire build).

The stale-warehouse auto-delete guard added in pipeline.js (lesson 36) is a mid-pipeline correction — it only triggers after game-flow iteration 1 fails. This wastes:
- DOM snapshot run (~65s)
- Test generation (parallel, ~60-100s saved but still ~60s total)
- Full game-flow iteration 1 test run (~3-5 min)
- One LLM regen call (~2 min)

Total waste per stale-warehouse build: ~10-15 minutes of compute and $0.50-1.50 LLM cost.

### 3.2 POC: Pre-Build Warehouse Gate in worker.js

**What changes:**

In `worker.js`, before calling `runPipeline()`, add a gate that checks whether the existing warehouse HTML is from an APPROVED build:

```js
// PROPOSED — worker.js, before runPipeline() call
const warehouseHtmlPath = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game', 'index.html');
if (fs.existsSync(warehouseHtmlPath)) {
  const game = db.getGame(gameId);
  if (!game || game.status !== 'approved') {
    logger.warn(`[worker] Deleting non-approved warehouse HTML for ${gameId} — forcing fresh generation`);
    fs.unlinkSync(warehouseHtmlPath);
  }
}
```

**Alternative (safer, no file deletion):** Pass a `forceRegenerate` flag to `runPipeline()` that bypasses the `existingHtml` check — no file deletion needed, just skip the skip.

**What new behavior this enables:**
- All non-approved games always generate fresh HTML
- Approved games still skip generation (correct behavior — warehouse HTML IS the approved artifact)
- The mid-pipeline stale-warehouse auto-delete (pipeline.js:2561) becomes a safety net, not the primary guard
- Eliminates ~10-15 min waste per build for non-approved games

### 3.3 Acceptance Criteria

This fix is proven if:
- All 47 queued games (ids 259-288 + future scale run) generate fresh HTML on first iteration
- No build shows "Step 1: Skipping HTML generation — index.html exists" for any non-approved game
- Zero builds fail with `test_results=[]` and no error message (the stale-warehouse signature)
- Scale run pass rate (APPROVED/total queued) improves from current ~4% (2 APPROVED / 47 queued) to ≥15%

### 3.4 Test Set

The 47 queued games (warehouse/templates/ minus approved ones) are the natural test set:
- Currently queued: one-digit-doubles, position-maximizer, mcq-multi-select, keep-track, disappearing-numbers, face-memory, explain-the-pattern, right-triangle-area, number-pattern, rapid-challenge, simon-says, memory-flip, true-or-false, speed-input, word-pairs, visual-memory, sequence-builder, hidden-sums, count-and-tap, right-triangle-area, truth-tellers-liars, speedy-taps, expression-completer, zip, bubbles-pairs, queens, (and ~21 more)
- Approved games (exempt): doubles, adjustment-strategy, right-triangle-area, match-the-cards, sequence-builder, identify-pairs-list, number-pattern

### 3.5 Effort Estimate

- **Lines of code:** 8-12 lines in worker.js (before `runPipeline()` call) + 3-5 lines in pipeline.js (add `forceRegenerate` option to `existingHtml` check)
- **Risk level:** Low — additive change, no existing logic modified, only affects non-approved games
- **Test changes needed:** Update `test/worker.test.js` to verify non-approved warehouse HTML is deleted/bypassed before pipeline call; 2-3 new test cases
- **Expected effort:** 30-60 minutes implementation + tests

---

## 4. Secondary Architecture POC: BullMQ Stall Prevention

For the 15 stalled-job failures (7% of total, 9% of production), the root cause is the Node.js event loop being blocked during long LLM calls, preventing BullMQ's lock renewal.

### 4.1 Options

**Option A: Increase lockDuration (trivial, addresses symptom)**
`lockDuration: 60 * 60 * 1000` (60 min). Risk: jobs that truly stall (killed process) take longer to detect.

**Option B: Job progress heartbeat (robust)**
Call `job.updateProgress()` every 2 minutes inside the pipeline. BullMQ automatically renews the lock on `updateProgress()` calls. Requires threading `job` object into `runPipeline()`.

**Option C: LLM calls in separate process/thread**
Run each LLM call in a `worker_threads` thread or child process so Node's event loop stays free for BullMQ housekeeping. High complexity.

**Recommendation:** Option B — low risk, directly addresses the root cause. `runPipeline()` already has an `onProgress` callback; wiring it to `job.updateProgress()` in `worker.js` requires ~5 lines.

---

## 5. Findings Summary

### 5.1 What % is fixable by architecture vs. LLM quality?

- **Architecture fixes (warehouse gate + BullMQ stall):** Would prevent ~54% + 9% = **63% of production failures**
- **LLM quality improvements (generation rules, fix loop depth, review prompt coverage):** Would improve the remaining **~20%**
- **The pipeline is already robust at the code level** — T1 static validation, T2 contract validation, deterministic pre-triage, stale-warehouse auto-delete are all solid. The remaining gaps are pre-pipeline (warehouse gate) and runtime stability (BullMQ lock).

### 5.2 Top Systemic Pattern

The single most destructive systemic pattern was running scale tests against stale non-approved warehouse HTML. This one architectural gap (no approved-status gate before skipping HTML generation) caused 93 of 223 failures — more than all LLM quality issues combined. The fix is trivial (8-12 lines), low risk, and would be immediately proven by the currently-queued 47-game scale run.

### 5.3 What would prove the fix works?

Run the full 47-game scale run after deploying the warehouse gate. If zero builds show `test_results=[]` with no error message, the fix is proven. Current baseline: 25-93 builds per scale run fail with this signature. Target: 0.

---

## Appendix: Full Build Inventory (Key Milestones)

| Build ID Range | Era | Root Cause | Count |
|---------------|-----|-----------|-------|
| 1-99 | Pipeline development | Various (pipeline not production-ready) | 51 FAILED |
| 100-168 | Scale run 2 | Stale warehouse HTML + pre-fix pipeline | 68 FAILED |
| 169-245 | Scale run 3 | Stale warehouse HTML (post partial-fix) | 25 FAILED + 15 stalled |
| 191-215 | Proof builds | Doubles, identify-pairs-list, right-triangle-area | 16 APPROVED |
| 216-245 | Post-lesson fixes | game_init phase, CDN URL, beforeEach conditional | 3 APPROVED (226, 228) |
| 246-288 | Current queue | 47 games queued, 2 running | TBD |
