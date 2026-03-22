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

## 4. Reliability Reasoning

**Fix determinism:** The regex change is deterministic — it either accepts or rejects the `window.components?.X` pattern. No LLM involvement. Once deployed, any HTML that correctly uses `window.components?.ProgressBarComponent` in `waitForPackages()` will pass T1 without triggering the static-fix LLM.

**Regression risk:** The true-positive case must still be caught — games that use `new ProgressBarComponent()` but have NO `typeof` check at all (neither bare nor `window.components?.X`) should still fail T1. The updated regex must only suppress the false positive for the correct CDN form.

**Edge cases remaining:**
- LLMs could generate `window.components.ProgressBarComponent` (no `?.`) — the regex should accept both `?.` and `.` access forms.
- If a game uses both bare `ProgressBarComponent` AND `window.components?.ProgressBarComponent`, either form should satisfy T1.
- The gen prompt should explicitly document both acceptable forms to prevent future regressions.

**What caused the same game to fail twice:** Build #527's fix (gen prompt + T1 bug for E8 CDN stripping) was unrelated to this T1 false-positive bug. The T1 regex bug existed for both builds but only triggered when the LLM used `window.components?.X` correctly. This is a pipeline-level bug, not game-specific.

## 5. Go/No-Go for E2E

**READY FOR E2E — T1 fix deployed (commit 65aed12). Build #532 queued.**

Root cause was the T1 validator itself (not game logic). The fix corrects the validator. When right-triangle-area is next built:
- The LLM will generate correct `window.components?.TimerComponent` checks in `waitForPackages()`
- T1 will correctly accept this form and NOT trigger the static-fix LLM
- `waitForPackages()` will resolve normally, `ScreenLayout.inject()` will run, `#gameContent` will be created
- Smoke check should pass

**Value if completed:** right-triangle-area HTML is structurally sound — correct CDN init sequence, correct TimerComponent null-slot pattern (`new TimerComponent(null, {...})`), correct canvas-based triangle rendering, correct area formula validation logic. The only failure mode across both builds was pipeline-level bugs (T1 validator false-positive), not game design issues.

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #527 | game-flow all fail; E8 iteration blank page | TimerComponent('headless-timer') throws (slot not in DOM); E8 merge stripped CDN scripts | Fixed in gen prompt + T1 E8 CDN check |
| #530 | Blank page: missing #gameContent element (Step 1d, both initial + smoke-regen) | T1 validator false-positive for `window.components?.TimerComponent` → static-fix LLM adds broken bare-global checks → waitForPackages spins 120s → #gameContent never created | Fixed: commit 65aed12 corrects T1 validator to accept window.components?.X form |
| #532 | — | — | Queued: verifying T1 fix resolves smoke check |

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
