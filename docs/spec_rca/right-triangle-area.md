# Spec RCA: right-triangle-area

## 1. Root Cause

Build #530 failed at Step 1d ("Blank page: missing #gameContent element") both on the initial smoke check AND after the smoke-regen attempt. The failure is caused by a cascade triggered by a bug in the T1 static validator (validate-static.js, section 5f3).

**Root cause chain for build #530:**

1. The LLM-generated HTML (index-generated.html, 49KB) correctly used `window.components?.ProgressBarComponent` and `window.components?.TimerComponent` in the `waitForPackages()` while-loop — the proper form for CDN games where components live under `window.components`, not as bare globals.

2. T1 static validation ran and FALSELY flagged two errors because its regex checks look for `typeof TimerComponent` and `typeof ProgressBarComponent` as bare strings, but the correct CDN form `window.components?.TimerComponent` does not match. The T1 checks at lines 378 and 388 of validate-static.js are:
   ```js
   /typeof TimerComponent/.test(html)   // ← fails to match window.components?.TimerComponent
   /typeof ProgressBarComponent/.test(html)  // ← same false-negative
   ```

3. The static-fix LLM received the misleading error messages "Add `|| typeof TimerComponent === "undefined"` to the waitForPackages while-loop condition" and dutifully added bare global checks:
   ```js
   typeof ProgressBarComponent === 'undefined' ||   // ← ALWAYS true — not a bare global
   typeof TimerComponent === 'undefined' ||           // ← ALWAYS true — not a bare global
   ```

4. With these broken checks in `waitForPackages()`, the function will **always** spin for the full 120-second timeout before throwing "Packages failed to load within 120s" — because `ProgressBarComponent` and `TimerComponent` are not bare globals and `typeof ProgressBarComponent` is always `'undefined'` (the packages are under `window.components`).

5. The smoke check allows only 8 seconds. When `waitForPackages()` is stuck in an infinite-effectively loop, `ScreenLayout.inject()` never runs, `#gameContent` is never created, and the 8-second smoke check finds a blank page.

6. Smoke-regen LLM produces the same broken `waitForPackages` pattern (following T1 error guidance again), so the second smoke check also fails.

The T1 false positive is the single trigger. Without it, the static-fix LLM would not have run, and the original correct `window.components?.ProgressBarComponent` checks would have been preserved.

**Note on build #527:** Build #527 had two independent bugs (TimerComponent('headless-timer') + E8 CDN script stripping). Those bugs were addressed by gen prompt changes. Build #530 is a new failure pattern — the T1 validator false-positive — introduced after #527.

## 2. Evidence of Root Cause

**Source:** Static analysis of GCP `index-generated.html` + server `index.html` (post-static-fix + post-smoke-regen) + server journal logs.

**Evidence A — Original HTML had correct waitForPackages:**

`index-generated.html` line 422–425:
```js
typeof window.components?.ProgressBarComponent === 'undefined' ||
typeof window.components?.TimerComponent === 'undefined' ||
typeof window.components?.VisibilityTracker === 'undefined'
```

Running T1 locally confirms false-positive:
```
node lib/validate-static.js /tmp/right-triangle-area/index-generated-530.html
STATIC VALIDATION FAILED — 2 error(s):
  ✗ ERROR: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check ...
  ✗ ERROR: ProgressBarComponent is used but typeof ProgressBarComponent is not in waitForPackages() check ...
```

T1 triggers because `/typeof TimerComponent/.test(html)` returns false for the string `window.components?.TimerComponent`.

**Evidence B — Post-static-fix HTML has broken bare-global checks:**

`/opt/ralph/data/games/right-triangle-area/builds/530/index.html` lines 124–125:
```js
typeof ProgressBarComponent === 'undefined' ||
typeof TimerComponent === 'undefined' ||
```

These are bare globals. `ProgressBarComponent` and `TimerComponent` are never defined as globals (they're under `window.components`). `typeof ProgressBarComponent` evaluates to `'undefined'` forever → `waitForPackages()` spins for 120s → throws before `ScreenLayout.inject()` runs.

**Evidence C — Server journal confirms the failure chain:**
```
06:58:07  static-validation-failed
06:58:07  [static-fix] model=gemini-2.5-pro ...  ← LLM introduced broken bare-global checks
07:00:24  static-validation-fixed-partial
07:02:54  Fatal smoke errors detected: Blank page: missing #gameContent element
07:04:49  [smoke-regen] completed
07:05:00  Fatal smoke errors detected: Blank page: missing #gameContent element  ← smoke-regen also fails
07:05:01  Job 14 failed: Step 1d: Page load failed after regeneration attempt
```

**Evidence D — T1 validator regex (validate-static.js line 378):**
```js
if (/\bTimerComponent\b/.test(html) && !/typeof TimerComponent/.test(html)) {
  errors.push('ERROR: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check ...');
}
```

The negative check `!/typeof TimerComponent/.test(html)` does NOT accept `window.components?.TimerComponent` as a valid alternative form.

## 3. POC Fix Verification (REQUIRED before E2E)

**Fix location:** `lib/validate-static.js` lines 378 and 388. Update the negative-check regexes to accept both bare-global and `window.components?.X` forms:

```js
// Current (broken):
if (/\bTimerComponent\b/.test(html) && !/typeof TimerComponent/.test(html)) {

// Fixed — accept window.components?.TimerComponent as valid:
if (/\bTimerComponent\b/.test(html) && !/typeof(?:\s+TimerComponent|.*window\.components\?\.TimerComponent)/.test(html)) {
```

Similarly for `ProgressBarComponent` and `TransitionScreenComponent`.

**Verify the fix catches the real T1 problem but not the false positive:**
```bash
# Before fix — false positive fires on correct HTML
node lib/validate-static.js /tmp/right-triangle-area/index-generated-530.html
# → FAILS with TimerComponent + ProgressBarComponent errors (wrong)

# After fix — no false positive
node lib/validate-static.js /tmp/right-triangle-area/index-generated-530.html
# → Should PASS (window.components?.TimerComponent is a valid check form)
```

Also update the T1 error message to include the correct `window.components?.TimerComponent` form so static-fix LLMs produce the right output when a TRUE positive is detected.

**POC verification status:** COMPLETE. Fix implemented in `lib/validate-static.js` (section 5f3, lines ~373–420). Verified:
```bash
# Before fix — false positive on correct HTML:
node lib/validate-static.js /tmp/right-triangle-area/index-generated-530.html
→ FAILED: 2 errors (TimerComponent + ProgressBarComponent)

# After fix — no false positive:
node lib/validate-static.js /tmp/right-triangle-area/index-generated-530.html
→ Static validation passed (0 warning(s))

# True positive still caught:
node lib/validate-static.js /tmp/test-true-positive.html
→ FAILED: TimerComponent and ProgressBarComponent errors still reported (correct)

# Full test suite: 644/644 pass, 0 fail
npm test → # pass 644 # fail 0
```

## 2b. Evidence of Root Cause — Build #533 (window.mira.components hallucination — DIFFERENT root cause)

**Source:** Static analysis of `/opt/ralph/data/games/right-triangle-area/builds/533/index.html` + server journal logs. 2026-03-22.

**Context:** Build #533 was queued to verify the `signalCollector.trackEvent` T1 fix. The fix WAS in place — build #533 passed T1 (static-validation-passed in logs at 07:58:16). However, it still failed at Step 1d with "Blank page: missing #gameContent element".

**Evidence A — Build #533 passed T1 (signalCollector.trackEvent fix confirmed working):**
```
07:58:16 [worker] static-validation-passed | game=right-triangle-area
```
The T1 check for `signalCollector.trackEvent` worked correctly — T1 passed, meaning the LLM did NOT generate `.trackEvent()` this time.

**Evidence B — Contract-fix introduced a T1 error, but build proceeded:**
```
07:59:22 [pipeline] Step 1b: Contract-fix introduced 1 T1 error(s) — logged for fix loop
```
The contract-fix LLM introduced one T1 error (missing 480px/max-width constraint — confirmed by running T1 locally on build #533's `index.html`: `✗ MISSING: No 480px or max-width constraint found`). This is logged for the fix loop but does NOT block the smoke check.

**Evidence C — Smoke check failure: `#gameContent` never created:**
```
08:03:10 [pipeline] Step 1d: Fatal smoke errors detected: Blank page: missing #gameContent element
08:06:28 [pipeline] Step 1d: Fatal smoke errors detected: Blank page: missing #gameContent element  ← smoke-regen also fails
08:06:28 Job 17 failed: Step 1d: Page load failed after regeneration attempt
```

**Evidence D — Root cause: `window.mira.components` namespace hallucination:**

Build #533's `index.html` line 52:
```js
const { ScreenLayout, ProgressBarComponent, TransitionScreenComponent, TimerComponent, VisibilityTracker } = window.mira.components;
```

`window.mira.components` does NOT exist. The CDN bundles expose:
- `window.ScreenLayout`, `window.ProgressBarComponent`, etc. (globals via `components/index.js` → `loadAllComponents()`)
- `window.SignalCollector`, `window.VisibilityTracker`, etc. (globals via `helpers/index.js` → `loadAllHelpers()`)
- `window.MathAIComponents` — a summary object set AFTER all components load asynchronously
- `window.MathAIHelpers` — same pattern for helpers

Neither bundle creates `window.mira` or `window.mira.components`. The destructuring assigns `undefined` to all components.

**Evidence E — Why `waitForPackages()` doesn't save it:**

Build #533's `waitForPackages()` loop (lines 106):
```js
while (typeof ScreenLayout === 'undefined' || typeof ProgressBarComponent === 'undefined' || ...)
```

`ScreenLayout` is a `const` in module scope holding `undefined` (from the failed destructuring). `typeof undefined === 'undefined'` is `true` — so the loop spins indefinitely. `ScreenLayout.inject()` never runs. `#gameContent` is never created. The smoke check (8s timeout) fires "Blank page: missing #gameContent element" at 07:58:16+~5min.

**Evidence F — This is a NEW hallucination, not the same as #530/#532:**

- Build #530: `window.components?.ProgressBarComponent` (partially correct — wrong namespace, but at least scoped)
- Build #532: `signalCollector.trackEvent()` (method hallucination)
- Build #533: `window.mira.components` (wrong namespace — `window.mira` does not exist)

Three independent LLM hallucinations about CDN API shape. The correct namespace is `window.ScreenLayout` (bare global) or `window.MathAIComponents.ScreenLayout` (only available after async load completes).

## 2c. Evidence of Root Cause — Build #532 (signalCollector.trackEvent hallucination)

**Source:** Build #532 Step 1d smoke-check log. 2026-03-22.

**Evidence A — Step 1d smoke check error message (build #532):**
```
Init error: signalCollector.trackEvent is not a function
```
This error appeared after the T1 fix (commit 65aed12) allowed the HTML to pass Step 1b. The game reached the browser but immediately threw at runtime because `signalCollector.trackEvent` does not exist.

**Evidence B — Same error across all three builds:**
- Build #527: failed — also contained `signalCollector.trackEvent` calls (masked by other failures)
- Build #530: failed at Step 1d with blank page (T1 cascade obscured the trackEvent error)
- Build #532: T1 fix removed the cascade; `signalCollector.trackEvent` is now the sole failure mode

**Evidence C — PART-011 signalCollector API:**
The CDN `signalCollector` object from PART-011 exposes lifecycle methods (`.signalCorrect()`, `.signalWrong()`, `.seal()`, `.getPayload()`). It has no generic `.trackEvent()` method. The LLM generates it because it resembles common analytics patterns (Google Analytics, Mixpanel, etc.).

**Evidence D — Hallucination recurrence:**
The same `.trackEvent()` call appeared in 3 consecutive independently-generated HTML files. Without a constraint in the gen prompt or a T1 gate, every subsequent build of this game (and other PART-011 games) will produce the same hallucination.

## 3b. POC Fix Verification — window.mira.components hallucination (Build #533)

**Fix location 1 — `lib/validate-static.js`:** Add a T1 check that fires if `window.mira.components` appears in the HTML:
```js
if (/window\.mira\.components/.test(html)) {
  errors.push('ERROR: window.mira.components does not exist — CDN components are bare globals: window.ScreenLayout, window.ProgressBarComponent, etc. (set async by components/index.js). Do not destructure from window.mira.components.');
}
```

**Fix location 2 — Gen prompt `CDN_CONSTRAINTS_BLOCK`:** Add:
```
- window.mira does NOT exist. CDN components/helpers are NOT under window.mira.components or any window.mira namespace.
- CDN components are bare globals: window.ScreenLayout, window.ProgressBarComponent, window.TransitionScreenComponent, window.TimerComponent, etc. — BUT they are loaded asynchronously, so waitForPackages() must check them.
- Correct waitForPackages pattern: check typeof window.ScreenLayout === 'undefined' (bare global, not window.mira.components.ScreenLayout)
```

**POC verification status:** NOT COMPLETE. T1 check + gen prompt update needed before build #534.

## 3c. POC Fix Verification — signalCollector.trackEvent (PENDING)

**Fix location 1 — `lib/validate-static.js`:** Add a T1 check that fires if `signalCollector.trackEvent` appears in the HTML:
```js
if (/signalCollector\.trackEvent\b/.test(html)) {
  errors.push('ERROR: signalCollector.trackEvent() does not exist in PART-011 CDN API — use .signalCorrect(), .signalWrong(), .seal(), .getPayload() instead');
}
```

**Fix location 2 — Gen prompt `CDN_CONSTRAINTS_BLOCK`:** Add:
```
- signalCollector does NOT have .trackEvent() — NEVER call signalCollector.trackEvent(). Use the PART-011 lifecycle API: .signalCorrect(), .signalWrong(), .seal(), .getPayload()
```

**Fix location 3 — `lib/pipeline.js` `classifySmokeErrors()`:** Add:
```js
{ pattern: /signalCollector\.trackEvent is not a function/, label: 'SIGNAL_COLLECTOR_TRACKEVENT_HALLUCINATION', fatal: true }
```

**POC verification status:** NOT COMPLETE. Implementation pending. Once T1 check is added and tested, re-run `npm test` to confirm no regressions, then deploy and queue build #533.

## 4. Reliability Reasoning

**Fix 1 (T1 false-positive, commit 65aed12) — determinism:** The regex change is deterministic — it either accepts or rejects the `window.components?.X` pattern. No LLM involvement. Once deployed, any HTML that correctly uses `window.components?.ProgressBarComponent` in `waitForPackages()` will pass T1 without triggering the static-fix LLM. Confirmed working: build #532 passed Step 1b.

**Regression risk (Fix 1):** The true-positive case must still be caught — games that use `new ProgressBarComponent()` but have NO `typeof` check at all (neither bare nor `window.components?.X`) should still fail T1. The updated regex only suppresses the false positive for the correct CDN form.

**Edge cases remaining (Fix 1):**
- LLMs could generate `window.components.ProgressBarComponent` (no `?.`) — the regex should accept both `?.` and `.` access forms.
- If a game uses both bare `ProgressBarComponent` AND `window.components?.ProgressBarComponent`, either form should satisfy T1.
- The gen prompt should explicitly document both acceptable forms to prevent future regressions.

**Fix 2 (signalCollector.trackEvent, pending) — determinism:** Adding `.trackEvent` to T1 as a hard error is fully deterministic. The LLM cannot generate this call without T1 catching it at Step 1b. Gen prompt prohibition reduces the likelihood of generation at source. `classifySmokeErrors()` addition provides a targeted smoke-regen in case the T1 check is bypassed.

**Regression risk (Fix 2):** Low. The PART-011 `signalCollector` API is stable and `.trackEvent()` is definitively not part of it. Adding a blanket ban carries no false-positive risk.

**Why the same game failed three times:** Three independent pipeline-level bugs cascaded sequentially. Each build revealed the next hidden failure once the preceding bug was fixed. The game's own HTML logic is sound — all failures have been pipeline or hallucination bugs, not game design issues.

## 5. Go/No-Go for E2E: APPROVED ✅
Build #543 APPROVED on 2026-03-22. After 13 consecutive failures (builds #530-#543), 7 CDN init error layers were identified, T1-checked, and fixed.
Final test results: 2 iterations, 1373s, 5/5 batches passed.

7 sequential pipeline/hallucination layers were peeled across builds #527–#543. Each layer was hidden by the one preceding it. All 7 are now fixed and deployed:

| Layer | Build | Root Cause | Fix |
|-------|-------|------------|-----|
| 1 | #530 | T1 false-positive for `window.components?.X` → static-fix LLM adds broken bare-global checks → waitForPackages spins 120s | T1 fix: commit 65aed12 |
| 2 | #532/#533 | `signalCollector.trackEvent()` hallucination — method does not exist in PART-011 API | T1 §5h + gen prompt: commit 65aed12 |
| 3 | #536/#538 | SentryHelper/initSentry hallucinations in waitForPackages() | T1 §5h2 + §5f0 + RULE-SENTRY-ORDER: commits 88b965d, 13b7d7b |
| 4 | #540 | `addColorStop('var(--color-sky)')` → Canvas API DOMException (CSS vars not resolved) | T1 §5f6 + gen prompt: commit cd04177 |
| 5 | #541 | `progressBar.timer` → undefined → `timer.start()` TypeError | T1 §5f7 + gen prompt: commit dd844f4 |
| 6 | #542 | `new TimerComponent('timer-container', ...)` → slot `'timer-container'` not declared in ScreenLayout.inject() `slots:` → element never injected → component init fails → blank page | T1 §5f8 + gen prompt: commits 8657a6d + ad4a15a |
| 7 | #543 | `progressBar.init()` — method does not exist on ProgressBarComponent (introduced by early-review-fix at Step 1c) → DOMContentLoaded catch → blank page | T1 §5f9 + gen prompt + smoke-regen BUG 6: commit ede9df4, 764 tests. Smoke PASSED. |

**Build #543** was the first build with all 7 layers addressed. Result: smoke check PASSED (after smoke-regen fixed Layer 7); build entered test generation (Step 2a) at 10:27 on 2026-03-22.

**Resolved items (all confirmed deployed):**
- T1 false-positive for `window.components?.X` (commit 65aed12) — confirmed working in builds #532 and #533
- `signalCollector.trackEvent` hallucination — T1 check deployed; build #533 passed T1 without triggering it
- SentryHelper ban T1 §5h2 (commit 88b965d) + initSentry-not-defined T1 §5f0 (commit 13b7d7b)
- Canvas API CSS variable check T1 §5f6 (commit cd04177)
- ProgressBarComponent .timer ban T1 §5f7 (commit dd844f4)
- TimerComponent slot-not-in-ScreenLayout ban T1 §5f8 (commits 8657a6d + ad4a15a)

The game's core HTML logic (canvas triangle rendering, area formula, CDN init structure) is sound. All failures have been pipeline or hallucination bugs, not game design issues.

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #527 | game-flow all fail; E8 iteration blank page | TimerComponent('headless-timer') throws (slot not in DOM); E8 merge stripped CDN scripts | Fixed in gen prompt + T1 E8 CDN check |
| #530 | Blank page: missing #gameContent element (Step 1d, both initial + smoke-regen) | T1 validator false-positive for `window.components?.TimerComponent` → static-fix LLM adds broken bare-global checks → waitForPackages spins 120s → #gameContent never created | Fixed: commit 65aed12 corrects T1 validator to accept window.components?.X form |
| #532 | Init error: signalCollector.trackEvent is not a function (Step 1d) | LLM hallucinates `.trackEvent()` on signalCollector (PART-011); method does not exist in CDN API | Fixed: T1 check + gen prompt prohibition deployed before build #533 |
| #533 | Blank page: missing #gameContent element (Step 1d, both initial + smoke-regen) | LLM generated `const { ScreenLayout, ... } = window.mira.components` — `window.mira` doesn't exist; components are bare globals (window.ScreenLayout etc.); destructuring yields undefined everywhere; waitForPackages() spins forever; ScreenLayout.inject() never runs; #gameContent never created | NOT FIXED — T1 check for `window.mira.components` + gen prompt clarification needed before build #534 |
| #534 | T1 fail: window.endGame missing (arrow fn regex) | T1 false positive on `const endGame = async () =>` | FAILED |
| #536 | Step 1d: Blank page, missing #gameContent | SentryHelper in waitForPackages() hangs forever | FAILED |
| #538 | Step 1d: ReferenceError: initSentry is not defined | LLM called initSentry() inside waitForPackages callback (correct), but never defined function initSentry() — thought it was CDN-provided. Missing function → ReferenceError → catch → ScreenLayout.inject() never runs → blank page | FAILED — layer 2 of same chain |
| #540 | Step 1d smoke fail: `addColorStop('var(--color-sky)')` — DOMException: color could not be parsed | Canvas API does not resolve CSS variables — literal hex/rgba required | Fixed: T1 §5f6 + gen prompt rule (commit cd04177), #541 queued |
| #541 | Step 1d smoke fail: `TypeError: Cannot read properties of undefined (reading 'start')` | `progressBar.timer` undefined (Layer 5) — ProgressBarComponent does not expose a .timer property; LLM hallucinated the API | Fixed: T1 §5f7 + gen prompt rule (commit dd844f4) |
| #542 | Step 1d smoke fail: `Container with id "mathai-timer-slot" not found` | `timer: true` missing from ScreenLayout slots (Layer 6) — mathai-timer-slot div never created; TimerComponent constructor throws | Fixed: T1 §5f8 + gen prompt rule + smoke-regen BUG 5 (commits 8657a6d + ad4a15a) |
| #543 | Step 1d smoke fail: `TypeError: progressBar.init is not a function` (Layer 7) — introduced by early-review-fix at Step 1c | early-review-fix LLM called `progressBar.init()` which does not exist on ProgressBarComponent (API is constructor + .update() + .destroy() only) → DOMContentLoaded catch → blank page | Fixed by smoke-regen (general CDN init fix prompt); T1 §5f9 + gen prompt rule deployed (commit ede9df4, 764 tests). Smoke PASSED — build entered test generation (Step 2a) at 10:27 on 2026-03-22. First time in 13 builds. **APPROVED** 2026-03-22: 2 iterations, 1373s, 5/5 batches passed (game-flow 3/3, mechanics 3/3, level-progression 1/1, edge-cases all pass, contract 1/1). |

## Root Cause (build #536 — layer 1)
`typeof SentryHelper === 'undefined'` in waitForPackages() causes infinite loop — SentryHelper is not a CDN global. Also had `typeof TimerComponent === 'undefined'` (TimerComponent IS real, but still caused hang when not needed). Both the original and regen HTMLs had SentryHelper, causing all smoke checks to fail.

## Fix Applied (88b965d — layer 1)
- T1 §5h2: bans typeof SentryHelper in waitForPackages()
- prompts.js: removed SentryHelper from valid CDN globals, updated RULE-SENTRY-ORDER

## Root Cause (build #538 — layer 2)
After the SentryHelper fix, build #538 generated correct waitForPackages() but called `initSentry()` without defining it. `initSentry()` is NOT a CDN function — it must be defined by the game code when spec includes PART-030 (Sentry). The gen prompt wording "initSentry() checks typeof SentryConfig internally" implied it was pre-existing, so the LLM just called it without a function body → `ReferenceError: initSentry is not defined` at runtime → catch block executes but ScreenLayout.inject() never runs → blank page.

## Fix Applied (13b7d7b — layer 2)
- T1 §5f0: ERROR if initSentry() is called but function initSentry() is not defined
- prompts.js RULE-SENTRY-ORDER: added canonical function body template + explicitly says "NOT A CDN FUNCTION"
- prompts.js CDN INIT ORDER: comment now says "ONLY if PART-030=YES — MUST define it yourself"

## Manual Run Findings

Static analysis was sufficient to identify the root cause for both #527 and #530. No live browser run was performed.

For build #530 specifically: the original `index-generated.html` (49KB, from GCP) contains the correct CDN init pattern. The post-static-fix `index.html` (42KB, from server) contains the broken bare-global checks introduced by the mislead static-fix LLM.

## Targeted Fix Summary

**Build #527:**
- What was tried: Static analysis of build #527 iteration logs and HTML structure.
- What worked: Identified two independent bugs from constructor signature + E8 merge behavior. Fixed both at source (gen prompt rule + T1 E8 error check).

**Build #530:**
- What was tried: Static analysis of `index-generated.html` (correct) + server `index.html` (broken) + journal logs.
- Root cause found: T1 validator false-positive at validate-static.js lines 378/388 — regex `/typeof TimerComponent/.test(html)` does not accept `window.components?.TimerComponent` as a valid form.
- Fix applied (commit 65aed12): Updated all 3 component checks (TimerComponent, TransitionScreenComponent, ProgressBarComponent) to accept EITHER bare-global OR `window.components?.X` form. Error messages updated to show both options. 3 new test cases; 644→647 passing.
- Build #532 queued to verify fix.

**Build #532:**
- What was tried: Queued to verify T1 fix from commit 65aed12.
- Partial success: T1 fix worked — HTML passed Step 1b. Build advanced further than #527 or #530.
- New failure: Step 1d smoke check threw `Init error: signalCollector.trackEvent is not a function` — a second independent hallucination bug not visible in earlier builds because the T1 cascade hid it.
- Root cause: LLM hallucinates `signalCollector.trackEvent(event)` on the PART-011 CDN object which has no such method.
- Status: T1 check + gen prompt prohibition deployed before build #533. Build #533 confirmed fix worked (T1 passed).

**Build #533:**
- What was tried: Queued to verify `signalCollector.trackEvent` T1 fix.
- Partial success: `signalCollector.trackEvent` T1 check worked — T1 passed (07:58:16). Also: contract-fix introduced 1 T1 error (missing 480px constraint — logged for fix loop, non-blocking).
- New failure: Step 1d smoke check reported "Blank page: missing #gameContent element" — same surface symptom as build #530 but different root cause.
- Root cause: LLM generated `const { ScreenLayout, ProgressBarComponent, ... } = window.mira.components` — `window.mira` namespace does not exist. Components are bare globals (window.ScreenLayout etc.) set asynchronously by `components/index.js → loadAllComponents()`. Destructuring yields `undefined` for all components. `waitForPackages()` loops on `typeof ScreenLayout === 'undefined'` which is always `true` (const holds undefined). `ScreenLayout.inject()` never runs. `#gameContent` never created.
- CDN confirmed: `components/index.js` calls `loadAllComponents()` async and sets `window.MathAIComponents` after load. No `window.mira` namespace anywhere in either the helpers or components bundles.
- Status: T1 check for `window.mira.components` + gen prompt prohibition needed before build #534.
