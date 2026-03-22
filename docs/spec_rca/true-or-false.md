# Spec RCA: true-or-false

**Game ID:** true-or-false
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (local diagnostic)
**Status:** NOT READY — 3 hard T1 errors must be fixed before E2E

---

## 1. Root Cause

Build #436 fails at Step 1d with "Blank page: missing #gameContent element" because `waitForPackages()` only guards on `typeof FeedbackManager === 'undefined'`, but does NOT guard on `ScreenLayout`, `TimerComponent`, `TransitionScreenComponent`, or `ProgressBarComponent`. The CDN loads three packages sequentially: `feedback-manager/index.js` (FeedbackManager), `components/index.js` (ScreenLayout + all component classes), and `helpers/index.js`. When `FeedbackManager` loads from package 1 but `components/index.js` (package 2) is still in flight, the `await waitForPackages()` resolves immediately and `ScreenLayout.inject()` is called before `ScreenLayout` is defined — throwing a `ReferenceError` that prevents `#gameContent` from ever being created in the DOM. The smoke check waits 8 seconds for `#gameContent` to have children, finds none, and throws the fatal error. Additionally, `window.endGame` and `window.restartGame` are never assigned, which are hard T1 validator errors.

---

## 2. Evidence of Root Cause

**Build #436 DB record:**
```
id: 436, game_id: 'true-or-false', status: 'failed', iterations: 0,
error_message: 'Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element'
gcp_url: https://storage.googleapis.com/mathai-temp-assets/games/true-or-false/builds/436/index-generated.html
```

**Build #419 DB record (earlier failure):**
```
id: 419, game_id: 'true-or-false', status: 'failed', iterations: 0,
error_message: 'Step 1d: Page load failed ... Failed to load resource: 404 (x12)'
```
Build #419 failed with CDN 404s — a different failure mode (bad CDN URLs), but same Step 1d abort pattern.

**T1 static validator output on build #436 HTML:**
```
STATIC VALIDATION FAILED — 3 error(s):
  ✗ MISSING: window.endGame = endGame — CDN games define endGame inside DOMContentLoaded (not on window).
  ✗ MISSING: window.restartGame = restartGame — CDN games must expose restartGame on window for test harness access.
  ✗ FORBIDDEN: initSentry() called before waitForPackages() — Sentry SDK is not yet loaded.

WARNING: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check
WARNING: TransitionScreenComponent is used but typeof TransitionScreenComponent is not in waitForPackages() check
WARNING: ProgressBarComponent is used but typeof ProgressBarComponent is not in waitForPackages() check
WARNING: Inline event handler found in HTML
```

**HTML evidence — waitForPackages() only checks FeedbackManager (line 385):**
```javascript
async function waitForPackages() {
  const timeout = 10000; const interval = 50; let elapsed = 0;
  while (typeof FeedbackManager === 'undefined') {
    // ← ScreenLayout, TimerComponent, etc. are NOT checked here
```

**CDN load order (lines 326-328 in HTML):**
```html
<!-- STEP 5-7: Game packages -->
<script src=".../feedback-manager/index.js"></script>   ← package 1: FeedbackManager
<script src=".../components/index.js"></script>          ← package 2: ScreenLayout, Timer, etc.
<script src=".../helpers/index.js"></script>             ← package 3: SignalCollector etc.
```

ScreenLayout comes from package 2, but waitForPackages() only waits for package 1. If package 2 is slow (CDN cold start), `ScreenLayout.inject()` is called before ScreenLayout exists.

**ScreenLayout.inject() call (line 424) — correct slots wrapper, wrong timing:**
```javascript
ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
// ^ slots: wrapper IS correct, but ScreenLayout may not be defined yet
```

**Missing window exports (no matches found):**
```
grep "window\.endGame\s*=\|window\.restartGame\s*=\|window\.nextRound\s*=" → 0 results
```
`endGame` (line 773) and `restartGame` (line 885) are defined as standalone functions but never assigned to `window`.

---

## 3. POC Fix Verification

The fixes required are code-generation prompt fixes (not pipeline fixes). The LLM must generate:

**Fix 1: waitForPackages() must check ALL CDN components:**
```javascript
async function waitForPackages() {
  const timeout = 30000; const interval = 50; let elapsed = 0;
  while (
    typeof FeedbackManager === 'undefined' ||
    typeof ScreenLayout === 'undefined' ||
    typeof TimerComponent === 'undefined' ||
    typeof TransitionScreenComponent === 'undefined' ||
    typeof ProgressBarComponent === 'undefined'
  ) {
    if (elapsed >= timeout) { throw new Error('Packages failed to load within 30s'); }
    await new Promise(resolve => setTimeout(resolve, interval));
    elapsed += interval;
  }
}
```

**Fix 2: Export game functions to window (after DOMContentLoaded init):**
```javascript
// After defining endGame, restartGame, nextRound functions:
window.endGame = endGame;
window.restartGame = restartGame;
window.nextRound = nextRound;  // if applicable
```

**Fix 3: initSentry() placement — must be called AFTER waitForPackages():**
```javascript
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  initSentry();  // ← move here, after packages confirmed loaded
  // ...
});
// Remove the separate: window.addEventListener('load', initSentry);
```

**Verification approach:** Run T1 static validator against a corrected HTML:
```bash
node /Users/the-hw-app/Projects/mathai/ralph/lib/validate-static.js /tmp/fixed.html
```
Expected output: `STATIC VALIDATION PASSED` with no errors (warnings for inline event handlers are acceptable).

Note: Cannot run diagnostic.js to verify locally because the GCP-served packages would still face CDN cold-start timing. The fix is structural — guarding ALL package names in the while loop makes timing irrelevant.

---

## 4. Reliability Reasoning

**Why this fix holds:**
- Checking all 5 CDN symbols in `waitForPackages()` is deterministic — the while loop will spin until all packages are loaded regardless of network speed. Once all are defined, the code proceeds safely.
- The 30s timeout is generous vs. the current 10s. Even on cold GCP starts (60s+ documented in lessons), the smoke check's 8s window would be the limiting factor — but Step 1d uses the smoke check AFTER page load, so CDN cold start is measured from page open, not from `waitForPackages()` timeout.
- `window.endGame = endGame` is a one-time assignment at DOMContentLoaded — not susceptible to race conditions.

**What could cause regression:**
- LLM may omit one of the package names in the guard condition (e.g., only add ScreenLayout but not TimerComponent).
- LLM may still use 10s timeout instead of 30s, causing failures on CDN cold starts.
- LLM may re-add `window.addEventListener('load', initSentry)` without removing the `DOMContentLoaded` placement.
- New CDN packages added in future (e.g., SignalCollector) may not be added to the guard.

**Edge cases:**
- `nextRound` may not exist for this game (true-or-false may not use `nextRound`). Only export functions that exist.
- `window.gameState` IS already assigned at script parse time (line 332) — not inside DOMContentLoaded — so that is correctly exposed.

---

## 5. Go/No-Go for E2E

**Decision: NOT READY FOR E2E**

**Blockers before E2E:**
1. **waitForPackages() incomplete** — must check `ScreenLayout`, `TimerComponent`, `TransitionScreenComponent`, `ProgressBarComponent` in addition to `FeedbackManager`. This is the primary blank-page cause.
2. **window.endGame / window.restartGame not exported** — hard T1 errors that will fail validation and cause test harness failures even if the game renders.
3. **initSentry() ordering** — called before waitForPackages(), which is a T1 hard error.

**What E2E needs to produce to count as success:**
- Step 1d smoke check passes (no blank page error)
- T1 static validation passes (0 hard errors)
- T2 contract validation passes
- At least 80% of Playwright tests pass in iteration 1 (no fix loop needed for structural issues)
- `window.endGame` and `window.restartGame` callable from test harness

**These blockers are gen prompt / LLM output issues** — they cannot be fixed by pipeline code changes. The generation prompt already includes rules 20/21 for window exports (per CLAUDE.md). The `waitForPackages()` incomplete guard may need a stronger rule in the gen prompt, or the pipeline's smoke-regen prompt must explicitly call it out.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| 102 | Failed, no error_message, no gcp_url | Infrastructure/stall (pre-smoke-check era) | failed |
| 118 | Failed, no error_message, no gcp_url | Infrastructure/stall | failed |
| 181 | Failed, no error_message, no gcp_url | Infrastructure/stall | failed |
| 224 | Failed: job stalled more than allowable limit | BullMQ stall | failed |
| 272 | Failed: queue-sync: BullMQ job lost after worker restart | Worker restart | failed |
| 318 | Failed, no error_message, no gcp_url | Unknown (no artifact) | failed |
| 419 | Step 1d: Failed to load resource: 404 (x12) | CDN 404s — bad package URLs | failed |
| 436 | Step 1d: Blank page: missing #gameContent element | waitForPackages() incomplete + missing window.endGame/restartGame | failed |

---

## Manual Run Findings

**Downloaded HTML:** `https://storage.googleapis.com/mathai-temp-assets/games/true-or-false/builds/436/index-generated.html`

**Key findings from source analysis (no Playwright needed — T1 validator is definitive):**

1. `waitForPackages()` only checks `FeedbackManager` — misses `ScreenLayout`, `TimerComponent`, `TransitionScreenComponent`, `ProgressBarComponent` (all from `components/index.js`, package 2 in CDN chain).

2. `ScreenLayout.inject()` is called at line 424, immediately after `waitForPackages()` resolves. If `components/index.js` is still loading when `FeedbackManager` (from `feedback-manager/index.js`) loads, `ScreenLayout` is undefined and the call throws, leaving `#gameContent` uncreated.

3. `window.endGame` and `window.restartGame` are never assigned. `endGame()` is defined at line 773, `restartGame()` at line 885, both as standalone functions only. Tests using `window.__ralph.endGame()` or `window.endGame()` will fail with "not a function".

4. `initSentry()` is attached to `window.addEventListener('load', initSentry)` (line 324) — but is also effectively called before waitForPackages because the validator flagged the definition precedes the waitForPackages guard. This is a T1 hard error.

5. `window.gameState` IS correctly exposed (line 332, outside DOMContentLoaded) — this is correct.

6. `ScreenLayout.inject()` uses `{ slots: { progressBar: true, transitionScreen: true } }` — the slots wrapper IS correct. The problem is timing, not the wrapper format.

---

## Targeted Fix Summary

**What is needed (gen prompt enforcement, not pipeline code):**

| Issue | Fix Required | Priority |
|-------|-------------|----------|
| waitForPackages() incomplete guard | Must check all 5 CDN symbols: FeedbackManager, ScreenLayout, TimerComponent, TransitionScreenComponent, ProgressBarComponent | P1 — blank page cause |
| window.endGame missing | Add `window.endGame = endGame;` after function definition | P1 — T1 hard error |
| window.restartGame missing | Add `window.restartGame = restartGame;` after function definition | P1 — T1 hard error |
| initSentry() ordering | Move initSentry() call inside DOMContentLoaded after waitForPackages() | P2 — T1 hard error |
| Inline event handlers | Replace `onclick="handleAnswer(true)"` etc. with addEventListener | P3 — warning only |

**Build #419 root cause (different):** CDN 404s — the package URLs used in that generation were incorrect. This was likely a CDN domain or path issue in the gen prompt context, separate from build #436's timing issue.

**Recommendation:** Re-queue after verifying the generation prompt includes:
- Rule: waitForPackages must check ALL used CDN component types
- Rule: window.endGame, window.restartGame must be assigned at top level after DOMContentLoaded init
- These rules are already in CLAUDE.md (sections 5b3, 5d, rules 20/21) but LLM compliance is inconsistent
