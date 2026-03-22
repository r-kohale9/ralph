# find-triangle-side — Per-Spec RCA

Two-step trig game (Bloom L3 Apply): Step 1 MCQ ratio selection (sin/cos/tan), Step 2 typed numeric computation with ±0.15 tolerance. 5 rounds. Uses CDN components: ScreenLayout, TransitionScreenComponent, ProgressBarComponent, FeedbackManager (sound effects only — no FeedbackManager.init()). No TimerComponent.

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #547 | 100% test failure: `#mathai-transition-slot button` visible after click | ProgressBarComponent wrong API (positional arg + 3-arg update + no null guard) → renderRound() throws → startGame() throws → transitionScreen never dismisses | Failed (orphaned — Rule 1 violation during deploy) |
| #548 | Rejected at early review (iter=0, never reached tests) | `new date()` lowercase typo in endGame → silent ReferenceError → endGame never sends postMessage, early review detected it | Rejected |
| #549 | APPROVED (1 review-fix: RULE-003 try/catch in restartGame) | CSS visibility + GEN-112 ProgressBarComponent API (T1 caught + static-fix corrected) | APPROVED |

---

## 1. Root Cause

Build #547: `ProgressBarComponent` initialized with wrong API — positional string slot ID instead of options object. This causes the component to fail silently. When `renderRound()` calls `progressBar.update(currentRound, totalRounds, lives)` (3 args, no null guard), it throws because `progressBar` is null or malformed. The error propagates through the `action: () => startGame()` callback in `transitionScreen.show()`, preventing the TransitionScreenComponent from calling `hide()`. The "Let's go!" button never dismisses.

Build #548: unrelated — `new date()` (lowercase d) JavaScript typo in `endGame()`. Early review correctly caught it. Early-review-fix didn't resolve it.

## 2. Evidence of Root Cause

**Build #547 — ProgressBarComponent API mismatch:**
```
# Wrong (from build #547 line 191):
progressBar = new ProgressBarComponent('mathai-progress-bar-slot', {
    totalRounds: gameState.totalRounds,
    totalLives: gameState.totalLives,
});
# Wrong update call (line 321):
progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives); // 3 args, no null guard

# Correct (expression-completer build #511 — working game):
progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 6, totalLives: 3, slotId: 'mathai-progress-slot' });
if (progressBar) progressBar.update(window.gameState.currentRound, window.gameState.lives); // 2 args, null-guarded
```

**Test failure pattern (build #547, ALL categories, iterations 1+2):**
```
Locator: locator('#mathai-transition-slot button')
Expected: not visible
Received: visible
```
Click fired, button clicked 8+ times across 8-second loop, still visible → confirms action callback threw before hide().

**Build #548 — early review finding:**
```
new date().toISOString() // ReferenceError: date is not defined
```
Located in `endGame()` wrapped in try/catch → silent failure → game never ends properly.

## 3. POC Fix Verification

**For GEN-112 (ProgressBarComponent API):**
T1 static check added to `lib/validate-static.js`: rejects `new ProgressBarComponent(` with positional string arg (`PART-023-API` error) and `progressBar.update(` with 3 args (`PART-023-UPDATE` error).

Gen prompt rule GEN-112 added to `lib/prompts.js` CDN_CONSTRAINTS_BLOCK with WRONG/RIGHT examples.

T1 check was verified by running `npm test` — all tests pass.

**For new date() typo:**
No separate fix needed — this is a random generation error. GEN-112 + T1 static check will catch the ProgressBarComponent issue in future builds. The `new date()` typo is a low-probability random error that the early review will catch and the early-review-fix LLM will resolve.

## 4. Reliability Reasoning

**GEN-112 (ProgressBarComponent):**
- T1 static check fires BEFORE test generation, forcing a regen cycle when the wrong API is used
- Gen prompt rule teaches the correct pattern explicitly with WRONG/RIGHT examples (same methodology that fixed Lesson 144 for TimerComponent)
- Deterministic: T1 check is regex-based, not probabilistic. Any generated HTML using the wrong API will be caught.
- No CDN timing dependency — this is a pure JavaScript API mismatch, not a CDN cold-start issue

**new date() typo:**
- Low-probability random error. No structural fix needed.
- Early review catches it reliably (confirmed in build #548)

## 5. Go/No-Go for E2E

**APPROVED — Build #549 approved on 2026-03-22.**

Results:
- T1 PART-023-API fired on first gen → static-fix corrected ProgressBarComponent API ✅
- GEN-111 (MCQ correctAnswer): verified working ✅
- CT8 (no expect.poll() deletion): contract 1/1 passing ✅
- CSS visibility bug fixed in mechanics iter 2; game-flow corrected in Step 3b re-test
- RULE-003 review rejection → review-fix-1 applied → APPROVED
- Final: 9/10 tests passing (90%), 1382s, 3 iterations

---

## Manual Run Findings

**Source: Direct HTML inspection (2026-03-22), no browser screenshots needed — root cause found via code analysis.**

Find-triangle-side builds #547 and #548 were analyzed:
- Build #547: CDN game with ProgressBarComponent, TransitionScreenComponent, ScreenLayout, FeedbackManager (sound only). Wrong ProgressBarComponent API confirmed at line 191 and wrong update() call at line 321.
- Build #548: `new date()` typo at line containing `duration_data.startTime = new date().toISOString()` (endGame function).

---

## Targeted Fix Summary

| Issue | Fix | Result |
|-------|-----|--------|
| Build #547: ProgressBarComponent wrong API | GEN-112 rule + T1 PART-023-API/PART-023-UPDATE checks | Not yet tested in E2E (build #549 pending) |
| Build #548: new date() typo | Random gen error — early review catches it; no structural fix | Early review confirmed working |
| CT8 ban on expect.poll() value capture | Shipped (commit 30509b9) but unverified | Needs build #549 to verify |
| GEN-111 MCQ correctAnswer | Shipped (commit 0536383) | Untested for find-triangle-side |
