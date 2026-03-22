# Chronic Failure Diagnosis: adjustment-strategy and doubles

**Updated:** 2026-03-20
**Supersedes:** Previous version covering rapid-challenge and associations
**Method:** SSH build DB queries, GCP review report analysis, spec inspection, learnings extraction

> **Note:** A prior version of this file diagnosed rapid-challenge and associations. Those findings are preserved at the bottom of this document. This update adds adjustment-strategy and doubles as primary subjects.

---

## Executive Summary

| Game | Total Builds | Approved | Rejected | Failed | Root Cause |
|------|-------------|----------|----------|--------|------------|
| adjustment-strategy | 59 | 5 | 9 | 44 | Spec contradiction: CRITICAL note says no FeedbackManager.init() but spec code examples still call it; plus review keeps rejecting for incomplete postMessage payload and missing game-over=0★ star logic |
| doubles | 15 | 6 | 2 | 7 | Mostly APPROVED now. Early rejections were from incomplete signalPayload spread and TransitionScreen misuse. Recent builds (207–212) are all approved. Not a chronic failure anymore. |

---

## 1. adjustment-strategy

### Build history (all time)

| Build range | Status pattern | Notes |
|-------------|---------------|-------|
| 1–40 | failed (40 builds) | Pipeline infrastructure issues, stalls, stalled jobs, early pipeline bugs |
| 41–42 | rejected | TimerComponent startTime=1 bug, endGame missing destroy(), TransitionScreen not used for victory |
| 43, 45 | approved | First approvals. Pipeline was stabilizing. |
| 46–51 | failed | Mechanics batch 3/3 failing (adjuster UI hiding buttons) + CDN/worker issues |
| 52–54 | rejected | postMessage payload incomplete; calcStars missing game_over=0 handling; accuracy condition in stars |
| 55 | approved | — |
| 56 | rejected | postMessage incomplete + cleanup in setTimeout instead of endGame + results screen not using TransitionScreen |
| 57, 59 | approved | — |
| 159 | failed | (unclear; no error_message recorded) |
| 341 | queued | Currently waiting to run |

### Pattern analysis

Adjustment-strategy has 5 approvals and 9 rejections. This is NOT a game that "never gets approved" — it has been approved 5 times. The question is why 44 builds failed before reaching review, and why 9 review rejections keep hitting the same issues.

### Root Cause 1: Spec contradiction causing FeedbackManager.init() calls (primary cause of pre-review failures)

The spec contains a contradictory instruction:

- Line 38 (CRITICAL note): "Do NOT call FeedbackManager.init()"
- Line 630 (initialization flow): `waitForPackages(), FeedbackManager.init()`
- Line 935 (generated HTML example): `await FeedbackManager.init();`

The LLM sees conflicting signals. The code example on line 935 appears inside a full `initGame()` function that the LLM is expected to follow literally. The CRITICAL note appears as a sidebar in the parts table. When the LLM has to choose between an instruction note and executable code, it follows the code.

Result: nearly every generation includes `await FeedbackManager.init()`, which shows a blocking audio permission popup. Playwright's `beforeEach` has an 8-second timeout to dismiss it. Under parallelism (3 Playwright workers), this is non-deterministic — some runs pass, some don't. When it fails, all 10 tests in the batch fail simultaneously (same `beforeEach` context), which triage misidentifies as "HTML initialization failure" and fires `fix_html`. The fix LLM restructures the init sequence, creates new bugs, and the loop oscillates.

This is documented in more detail in `docs/rnd-adjustment-strategy-diagnosis.md`.

### Root Cause 2: Review rejection loop on postMessage payload (primary cause of review rejections)

The same 2 issues appear in 4+ consecutive rejection reports:

1. **postMessage payload incomplete** — LLM generates `{ type: 'game_complete', data: { metrics: {...subset...} } }` instead of `{ type: 'game_complete', data: { metrics, events: gameState.events, completedAt: Date.now() } }`. The spec on line 854 of spec.md shows the correct pattern but LLMs consistently send a metrics subset, omitting `events` and `completedAt`.

2. **calcStars missing game_over=0 case** — Spec says "game-over = 0★". LLMs implement time-based thresholds only and forget the `if (outcome === 'game_over') return 0` guard. This has appeared in builds 54, 56, and the learnings table.

These are deterministic LLM generation errors — the same two mistakes made independently in multiple generations, suggesting the gen prompt is not strongly enough emphasizing these rules.

### Root Cause 3: Mechanics test timeout on adjuster UI (secondary — causes failed exits before review)

The mechanics test "Reset Adjustments Functionality" and "Correct Answer Submission" fail with `TimeoutError: locator.click: Timeout 10000ms exceeded`. This is because `updateAdjusterUI()` hides the +/- buttons when delta < 0 or > 0, making the click target invisible. The second click on the button times out.

The learnings table records this as: "Adjuster UI: never hide +/- buttons in updateAdjusterUI(). Both + and - buttons must remain clickable at all times." This issue appears in builds 57 and 59 (both approved with 3/5 mechanics failures allowed through) — meaning the review approved despite this test failing, which is inconsistent with the rejection logic.

### Status of build 341 (queued)

Build 341 is queued but has not yet started. Given the spec contradiction is still present (FeedbackManager.init() still appears in the code examples), it is likely to hit the same non-deterministic popup issue. The CRITICAL note added to line 38 may or may not override the code example on line 935 depending on how the LLM weighs conflicting instructions.

### Recommendation for adjustment-strategy

**Priority 1 — Fix the spec code example contradiction (immediate, blocks all future builds):**
In `warehouse/templates/adjustment-strategy/spec.md`, remove `FeedbackManager.init()` from the initialization flow pseudo-code (around line 630) and from the full `initGame()` code example (around line 935). Replace with a comment: `// Do NOT call FeedbackManager.init() — see PART-017 CRITICAL note`.

**Priority 2 — Add explicit postMessage template to spec:**
The spec should show the exact correct postMessage call:
```javascript
window.parent.postMessage({ type: 'game_complete', data: { metrics, events: gameState.events, completedAt: Date.now() } }, '*');
```
And should also show the `calcStars` function with the `if (outcome === 'game_over') return 0` first line.

**Priority 3 — Add adjuster button visibility rule to spec:**
Add to Section 8 or the anti-patterns: "The +/- adjustment buttons must NEVER be hidden. `updateAdjusterUI()` must not call `classList.add('hidden')` on any adjuster button."

**Expected outcome:** After Priority 1 fix, build 341 should avoid the non-deterministic popup failures. After Priority 2, the review should stop rejecting for postMessage/stars issues.

---

## 2. doubles

### Build history (all time)

| Build | Status | Notes |
|-------|--------|-------|
| 68, 152 | failed | Old pipeline; no details |
| 193 | approved | First approval. game-flow 2/2 after 2 iterations. |
| 199–201 | failed | Orphaned BullMQ replays (infrastructure issue, not game bugs) |
| 202 | rejected | signalPayload spread missing; TransitionScreen not used for game-over; Sentry initSentry() placement wrong; hardcoded colors; endGame guard missing |
| 203 | failed | Superseded |
| 204 | approved | — |
| 205 | failed | Killed as stale |
| 206 | rejected | Killed manually — warehouse HTML missing window.endGame/gameState.phase |
| 207–209 | approved | 209 was "approved" despite prior rejection flag about signalPayload/Sentry; error_message records the concern but status=approved |
| 212 | approved | Most recent, clean approval |

### Pattern analysis

Doubles is NOT a chronic failure at this point. The last 4 real builds (207, 208, 209, 212) are all approved. Of the 2 rejections:

- Build 202: legitimate review rejection (signalPayload spread, TransitionScreen misuse, Sentry placement). This was a real generation quality issue that subsequent pipeline improvements addressed.
- Build 206: manually killed due to warehouse HTML state corruption, not a pipeline generation failure.

The 7 "failed" builds are mostly infrastructure (BullMQ orphans, worker restarts, explicit kills) not generation failures.

### Why it was listed as "best status: rejected"

The question states "best status: rejected, never approved" — but the DB shows 6 approvals (builds 193, 204, 207, 208, 209, 212). This is likely stale data from before the recent build run. The game IS approved and generating successfully.

### Current status

Doubles is solved. Build 212 is the most recent (approved). No action needed.

---

## 3. Other Chronic Failures Worth Flagging

The full DB query reveals several games with 5+ builds and 0 approvals:

| Game | Total | Approved | Most recent failure reason |
|------|-------|----------|---------------------------|
| rapid-challenge | 13 | 0 | "Kill: wrong test (lives on unlimited-lives game)" — see rnd-chronic-failures-diagnosis.md (prior version) |
| associations | 12 | 0 | "Kill: wrong test (lives on unlimited-lives game)" — see same |
| count-and-tap | 7 | 0 | No error_messages recorded |
| free-the-key | 7 | 0 | No error_messages recorded |
| futoshiki | 7 | 0 | No error_messages recorded |
| hide-unhide | 7 | 0 | No error_messages recorded |
| loop-the-loop | 7 | 0 | No error_messages recorded |
| simon-says | 6 | 0 | No error_messages recorded |
| speed-input | 6 | 0 | No error_messages recorded |
| true-or-false | 6 | 0 | No error_messages recorded |
| visual-memory | 6 | 0 | No error_messages recorded |
| word-pairs | 6 | 0 | No error_messages recorded |

**rapid-challenge and associations** are known: wrong tests generated (lives check on unlimited-lives games). Fix: remove/correct the wrong test case in spec, regenerate. See prior version of this doc below.

**The cluster of 6-7-build-zero-approval games** (count-and-tap, futoshiki, etc.) likely represent games that have not yet been properly queued in the current pipeline iteration or were all queued in a batch that was reset. Most have no error_messages, suggesting they stalled/failed at infrastructure level rather than game logic level. These should be re-queued once the current batch clears.

---

## Appendix: Prior Diagnosis — rapid-challenge and associations

The following is preserved from the previous version of this document (pre-adjustment-strategy/doubles analysis).

### rapid-challenge

**Root cause (primary):** The level-progression test asserts `waitForFunction(() => window.gameState.currentRound === N)` which races with `isProcessing`. The game's `roundComplete` increments `currentRound` and then immediately calls `showLevelTransition` which calls `loadRound`-next. The `answer()` helper only waits for `isProcessing = false`, but `currentRound` increments before `isProcessing` clears in the level-transition path. This is a test timing contract mismatch that the fix loop cannot reliably solve: fixing this in the HTML risks breaking mechanics, and vice versa.

**Root cause (secondary):** Most recent kills were explicitly for "wrong test (lives on unlimited-lives game)" — rapid-challenge has no lives display but test was checking for heart emoji counts.

**Recommendation:** Fix or remove the lives-display test from the spec before re-queuing.

### associations

**Root cause (primary):** The mechanics test incorrectly checks for a lives display (`❤️❤️`). Associations is unlimited-lives, accuracy-scored. `ProgressBar` is configured with `totalLives: 0` meaning no hearts are rendered. The fix loop cannot fix a correct game to satisfy an incorrect test.

**Root cause (secondary):** The `Restart Lifecycle` test checks `window.signalCollector !== window.oldCollectorRef` (reference identity comparison). The LLM fixes `restartGame()` but either assigns to a local variable instead of `window.signalCollector` or the reference comparison fails due to timing.

**Recommendation:** Remove the wrong-answer lives-decrement test case; fix `restartGame()` to explicitly reassign `window.signalCollector = new SignalCollector(...)`.
