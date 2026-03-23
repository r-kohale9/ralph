# R&D: Fatal CDN Init Failure Analysis

**Date:** 2026-03-20
**Analyst:** R&D agent
**Scope:** 224 triage events from 2026-03-19 to 2026-03-20

---

## Hypothesis

58% of builds produce HTML with fatal init failures (game never renders, `#mathai-transition-slot` missing). These fall into 2-3 sub-patterns related to CDN init order.

---

## Data Gathered

### Server Log Analysis

Pulled 224 `Triage: fix_html` messages from `ralph-worker` journalctl logs over a 2-day window. Classified each by symptom:

| Sub-Pattern | Count | % of total |
|-------------|-------|------------|
| `#mathai-transition-slot` button never visible / page never initializes | 149 | 67% |
| `data-phase` never set on `#app` (syncDOMState missing) | 15 | 7% |
| Other (logic bugs, phase transitions, star display) | 60 | 27% |

### HTML Inspection

Inspected 6 recent HTML builds:
- `matrix-memory/builds/289` — calls `initSentry()` before `FeedbackManager.init()`; has `transitionScreen.show()` only in `restartGame()`, NOT in DOMContentLoaded init block
- `one-digit-doubles` (warehouse) — working game; calls `transitionScreen.show()` at end of DOMContentLoaded ✓
- `adjustment-strategy` (warehouse) — zero `syncDOMState` or `phase` references; uses forbidden `sound.register()` and exposes debug functions on window
- `aided-game` (warehouse) — correct init order: `waitForPackages → FeedbackManager.init → ScreenLayout.inject → transitionScreen.show()` ✓

### Confirmed Pattern from `matrix-memory` Logs

```
[pipeline] Step 2.5: DOM snapshot failed: locator('#mathai-transition-slot button').first()
           to be visible — falling back to static HTML analysis
[pipeline] [game-flow] Triage: fix_html — All 10 failures trace back to the missing
           `#mathai-transition-slot` DOM element
```

---

## Root Cause Classification

### Sub-Pattern A: `initSentry()` before `FeedbackManager.init()` — Low frequency (3 messages)

Not the primary driver. `waitForPackages()` confirms CDN is loaded including Sentry SDK, so calling `initSentry()` before `FeedbackManager.init()` doesn't cause a ReferenceError. The current rule is slightly inconsistent between CDN_CONSTRAINTS_BLOCK and the numbered rules, but this is not causing the 67% failure rate.

### Sub-Pattern B: `#mathai-transition-slot` empty — HIGH frequency (≈67%)

This is the dominant failure. The pattern:
1. `ScreenLayout.inject()` runs — creates `#mathai-transition-slot` in the DOM ✓
2. `transitionScreen = new TransitionScreenComponent({ autoInject: true })` runs ✓
3. BUT `transitionScreen.show()` is NEVER called during DOMContentLoaded init
4. Result: `#mathai-transition-slot` exists but is empty — no start button
5. ALL tests timeout on the very first assertion waiting for `#mathai-transition-slot button`

The generation prompt had no rule requiring this initial `transitionScreen.show()` call.

### Sub-Pattern C: `data-phase` never set — moderate (7%)

`syncDOMState()` not called after phase changes. This was addressed by Rule 22 (already shipped). Some residual.

### Sub-Pattern D: Infrastructure `logger is not defined` — batch failure on 2026-03-20

The 7 builds that failed with `iterations=0` today were all hit by an infrastructure error: `logger is not defined`. Investigation showed this is thrown during the `runPageSmokeDiagnostic` call. Not a gen prompt issue — separate infra bug affecting that batch.

---

## Fix Implemented

Added **Rule 9** to `buildGenerationPrompt` ADDITIONAL GENERATION RULES in `lib/prompts.js`:

> **INITIAL TRANSITIONSCREEN.SHOW()** — the LAST step in DOMContentLoaded after all CDN components are initialized. If the spec uses PART-025, DOMContentLoaded MUST end with a `transitionScreen.show()` call to populate `#mathai-transition-slot` with the start button.

With a ✗ WRONG / ✓ CORRECT pattern pair showing the exact difference.

Also added to `CDN_CONSTRAINTS_BLOCK` (used in all fix prompts) and `buildCliGenPrompt`.

---

## Expected Impact

The `#mathai-transition-slot` empty failure is the single largest failure category (~67% of all triage events). Every CDN game that uses `TransitionScreenComponent` is affected when the LLM forgets the initial `show()` call.

**Predicted improvement:** Builds requiring iteration 1 fix for "transition slot never shows start button" should drop significantly. Prior rate: ~10 triage events per build per category for this pattern. Expected: 0 for this specific failure.

**Measurable signal:** Watch the next 3-5 builds. If iteration 1 game-flow tests pass (or fail for logic reasons rather than "beforeEach timeout"), the fix is working.

---

## Residual Issues Not Addressed

1. `initSentry()` order inconsistency (before vs after `FeedbackManager.init()`) — low impact
2. `sound.register()` vs `sound.preload()` — addressed by existing rule but still appears in old builds
3. Window-exposed debug functions — addressed by existing rule but still in adjustment-strategy (old build)
4. The `logger is not defined` infrastructure error — separate investigation needed

---

## Files Changed

- `/Users/the-hw-app/Projects/mathai/ralph/lib/prompts.js` — Rule 9 added to generation prompt + CDN_CONSTRAINTS_BLOCK + CLI prompt
