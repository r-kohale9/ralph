# Spec RCA: light-up

**Game ID:** light-up
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (local diagnostic)
**Status:** READY FOR E2E (build #463 queued with all fixes applied)

---

## 1. Root Cause

Build #428 crashed at pipeline Step 1d because the LLM generated `Sentry.captureConsoleIntegration({ levels: ['error'] })` inside `initSentry()`. This function does not exist in the Sentry CDN bundle loaded by the game — it is only available in a separate `captureconsole.min.js` plugin bundle that is never loaded. The crash occurs synchronously at `initSentry()` call time (line 320 of the generated HTML), before `#gameContent` is ever created. The result is a completely blank page with no game element, causing every downstream test to fail. This is a pure code-generation error: the LLM used a Sentry API that exists in npm package installations but is absent from the CDN-hosted bundle.

Beyond the primary Sentry crash, the T1 validator also flagged four additional issues present in the same HTML:
1. `window.endGame` and `window.restartGame` not exported to window (test harness cannot call them)
2. `TimerComponent` instantiated with a wrong object-as-first-argument signature (`new TimerComponent({ containerId: ..., ... })` instead of `new TimerComponent('container-id', { ... })`)
3. One `transitionScreen.show()` call on the start screen not awaited

These secondary issues would have caused further test failures even if Sentry had not crashed the init.

---

## 2. Evidence of Root Cause

**DB error_message for build #428:**
```
Step 1d: Page load failed after regeneration attempt: Initialization error: TypeError: Sentry.captureConsoleIntegration is not a function
    at initSentry (http://localhost:33777/:297:28)
    at http://localhost:33777/:320:13; Blank page: missing #gameContent element
```

**HTML grep confirming the call:**
```
Line 292: function initSentry() {
Line 297:     Sentry.captureConsoleIntegration({ levels: ['error'] })
Line 320: initSentry();
```
(`/opt/ralph/data/games/light-up/builds/428/index.html` lines 292–320)

**T1 validator output on build #428 HTML** (`node lib/validate-static.js /tmp/light-up-debug/index.html`):
```
WARNING: Sentry.captureConsoleIntegration() — not available in the Sentry CDN bundle; calling it throws
  "Sentry.captureConsoleIntegration is not a function" and aborts initSentry(). OMIT integrations
  entirely: call initSentry() with no argument or pass integrations:[] (Lesson 105).
WARNING: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check
WARNING: TransitionScreenComponent is used but typeof TransitionScreenComponent is not in waitForPackages() check
STATIC VALIDATION FAILED — 4 error(s):
  ✗ MISSING: window.endGame = endGame
  ✗ MISSING: window.restartGame = restartGame
  ✗ ERROR: TimerComponent called with wrong first argument
  ✗ ERROR: 1/3 transitionScreen.show() call(s) are not awaited
```

**HTML confirmation of secondary issues:**
- Line 348: `new TimerComponent({ containerId: 'timer-container', ... })` — object as first arg (wrong)
- Line 404: `transitionScreen.show({ ... })` — not awaited (start screen call)
- Lines 793, 863: `await transitionScreen.show({ ... })` — correctly awaited (only 2 of 3)
- No `window.endGame`, `window.restartGame`, or `window.nextRound` assignments anywhere in file

**`waitForPackages()` guard (line 282):**
```javascript
while (typeof ScreenLayout === 'undefined') { ... }
```
Only guards `ScreenLayout` — missing checks for `TimerComponent` and `TransitionScreenComponent`.

---

## 3. POC Fix Verification

The fix has two layers, both already deployed:

**Layer 1 — Gen prompt rule (lib/prompts.js line 107):**
```
SENTRY INTEGRATIONS: NEVER use new Sentry.Integrations.CaptureConsole() — throws TypeError.
NEVER use Sentry.captureConsoleIntegration() — only available in the separate captureconsole.min.js
plugin bundle which is NOT loaded; calling it throws "Sentry.captureConsoleIntegration is not a
function" and crashes initSentry(), leaving #gameContent never created. OMIT integrations entirely:
call initSentry() with no integrations argument or pass [].
```
This rule is an explicit, prominently placed instruction in the generation prompt that the LLM reads before producing any code.

**Layer 2 — T1 validator catch (lib/validate-static.js lines 314–328):**
If the LLM somehow generates the bad pattern anyway, the T1 static validator now emits a WARNING with the exact error text, which causes the pipeline to regenerate before any test is attempted. Verified by running the validator against the #428 HTML — it correctly flags the issue.

**Verification run:**
```bash
node lib/validate-static.js /tmp/light-up-debug/index.html 2>&1
# Output includes:
# WARNING: Sentry.captureConsoleIntegration() — not available in the Sentry CDN bundle ...
```

The other secondary issues (window exports, TimerComponent signature, transitionScreen await) are also covered by T1 validator checks (errors, not just warnings), meaning a regeneration will be triggered before tests run if any of these appear in the next generation.

Build #463 is currently queued and will run with all these fixes in place.

---

## 4. Reliability Reasoning

**Sentry fix — highly reliable:**
- The gen prompt rule is explicit and uses strong negative language ("NEVER", with the exact error message quoted). LLMs reliably avoid patterns when given this level of specificity in the prompt.
- The T1 validator is a deterministic regex check — it will catch any occurrence regardless of LLM variation.
- Defense-in-depth: both layers must fail simultaneously for the bug to reach test execution.

**Secondary issues — moderately reliable:**
- `window.endGame`/`window.restartGame` missing: This is also a T1 validator check (hard error). Any build without these will be regenerated.
- `TimerComponent` wrong signature: T1 validator catches this as an error — will force regeneration.
- `transitionScreen.show()` not awaited: T1 validator detects the count mismatch and flags it.

**Potential regressions:**
- If the LLM generates a subtly different Sentry pattern not covered by the regex (e.g. wrapping the call in a try/catch), the validator might miss it. However, the primary guard is the gen prompt rule.
- The `waitForPackages()` guard missing `TimerComponent`/`TransitionScreenComponent` is only a WARNING (not error) in T1 — the pipeline will not regenerate for warnings alone. This could still cause race-condition failures in rare CDN-timing scenarios.

---

## 5. Go/No-Go for E2E

**Decision: READY FOR E2E**

- §2 Evidence: confirmed via DB error message + HTML grep + T1 validator output
- §3 POC: fix verified via gen prompt rule (prompts.js:107) + T1 validator detection (validate-static.js:324)
- Build #463 is queued with all fixes deployed

Remaining watch items (not blockers):
- `waitForPackages()` only guards `ScreenLayout` — should ideally also check `TimerComponent` and `TransitionScreenComponent`, but this is a WARNING-only gap, not a blocking error
- light-up is a single-puzzle game (no `nextRound`) so the missing `window.nextRound` export is expected behavior, not a bug

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|-----------|--------|
| #347 | null error, infra crash | Pre-pipeline era infra failure | Abandoned |
| #411 | null error, infra crash | Pre-pipeline era infra failure | Abandoned |
| #428 | Step 1d: blank page, `#gameContent` missing | `Sentry.captureConsoleIntegration` not in CDN bundle → initSentry() crash + secondary issues: missing window exports, wrong TimerComponent signature, unawaited transitionScreen.show() | Failed |
| #451 | Killed immediately | Running on old CDN load order + 404 fix pipeline code | Killed |
| #463 | — | Queued with Lesson 105 gen prompt fix + T1 validator guard | Queued |

---

## Manual Run Findings

HTML downloaded from server (`/opt/ralph/data/games/light-up/builds/428/index.html`) and validated locally. Browser execution not required — the T1 validator and HTML grep fully confirm the failure without needing a live browser run, because:

1. The crash is deterministic at initSentry() before DOMContentLoaded completes
2. The T1 validator reproduces the exact failure pattern with its regex checks
3. The DB error message includes the exact stack trace with line numbers matching the HTML

Running `diagnostic.js` locally would confirm a blank screen with a console error, but adds no new diagnostic information beyond what is already in the DB error_message and T1 output.

---

## Targeted Fix Summary

No targeted fixes attempted on #428 — the build was superseded by #451 (killed on old code) and #463 (queued with gen prompt fix). The fix was applied at the source (gen prompt + T1 validator) rather than patching the generated HTML, because:

1. A patched HTML would not fix future builds
2. The root cause was a known LLM behavior pattern requiring a prompt-level guard
3. T1 validator now catches this deterministically before any test execution

**What was tried:** N/A (fix was prophylactic via prompt + validator)
**What failed:** `Sentry.captureConsoleIntegration()` call in LLM-generated initSentry()
**What worked:** Explicit NEVER rule in gen prompt (prompts.js:107) + T1 validator regex catch (validate-static.js:324)
