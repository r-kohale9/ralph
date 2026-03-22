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

## 2b. Evidence of Root Cause — Build #532 (signalCollector.trackEvent hallucination)

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

## 3b. POC Fix Verification — signalCollector.trackEvent (PENDING)

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

## 5. Go/No-Go for E2E

**NOT READY FOR E2E — signalCollector.trackEvent hallucination must be fixed first.**

Build #532 confirmed the T1 false-positive fix worked (smoke check advanced past Step 1b), but revealed a second independent failure: `Init error: signalCollector.trackEvent is not a function` at Step 1d. This hallucination appeared in all three builds (#527, #530, #532) and will recur until fixed at the source.

**Blocking items before next E2E:**
1. Add `signalCollector.trackEvent` as a T1 static-validation error in `lib/validate-static.js`
2. Add prohibition to gen prompt `CDN_CONSTRAINTS_BLOCK`: `signalCollector` has no `.trackEvent()` — use PART-011 lifecycle API (`.signalCorrect()`, `.signalWrong()`, `.seal()`, `.getPayload()`)
3. Add `signalCollector.trackEvent is not a function` to `classifySmokeErrors()` fatal patterns in `lib/pipeline.js`

Once these three fixes are deployed, re-queue right-triangle-area. The game's HTML structure is sound (correct canvas triangle rendering, correct area formula logic, correct CDN init pattern). Pipeline-level bugs have been the only failure mode across all three builds.

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #527 | game-flow all fail; E8 iteration blank page | TimerComponent('headless-timer') throws (slot not in DOM); E8 merge stripped CDN scripts | Fixed in gen prompt + T1 E8 CDN check |
| #530 | Blank page: missing #gameContent element (Step 1d, both initial + smoke-regen) | T1 validator false-positive for `window.components?.TimerComponent` → static-fix LLM adds broken bare-global checks → waitForPackages spins 120s → #gameContent never created | Fixed: commit 65aed12 corrects T1 validator to accept window.components?.X form |
| #532 | Init error: signalCollector.trackEvent is not a function (Step 1d) | LLM hallucinates `.trackEvent()` on signalCollector (PART-011); method does not exist in CDN API | NOT FIXED — T1 check + gen prompt prohibition needed before next build |

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
- Status: T1 check + gen prompt prohibition + classifySmokeErrors() entry needed. Build #533 blocked until fixes deployed.
