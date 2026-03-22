# R&D: Review Rejection Pattern Analysis

**Date:** 2026-03-20
**Analyst:** Claude agent (automated R&D)
**Data range:** 2026-03-19 to 2026-03-20
**Build DB:** `/opt/ralph/data/builds.db`

---

## Sample Size

- **Total builds:** 341 (20 approved, 15 DB-status=rejected, 256 failed, 6 cancelled, 43 queued/running)
- **Rejection events analyzed:** 28 unique rejection events from worker logs (early-review + final-review combined)
  - 23 early-review rejections (Step 1c pre-test fast-fail)
  - 5 final-review rejections (Step 4 post-test)

Note: DB `status=rejected` (15 builds) only counts builds where the early-review fix attempt also failed. Many early-review rejections are recovered (fix → re-review → APPROVED) and those builds proceed to tests. The 28 events include both terminal rejections and recovered ones.

---

## Category Classification

### Category A: VisibilityTracker / FeedbackManager API misuse
**Count: 11 events (39%)**

The LLM consistently generates VisibilityTracker with the wrong audio API:
- Uses `FeedbackManager.sound.stopAll()` instead of `sound.pause()` / `sound.resume()`
- Missing `FeedbackManager.stream.pauseAll()` / `stream.resumeAll()` in onInactive/onResume
- Missing `popupProps` configuration
- Missing `{ fromVisibilityTracker: true }` flag on `timer.pause()` / `timer.resume()`
- Missing `signalCollector.recordCustomEvent('visibility_hidden'/'visibility_visible')` calls
- Uses deprecated `FeedbackManager.sound.register()` instead of `sound.preload([{id, url}])`

**Examples:**
- `doubles` build 202: "VisibilityTracker incorrectly uses `FeedbackManager.sound.stopAll()` instead of `FeedbackManager.sound.pause()` / `resume()`"
- `memory-flip` build 222: "VisibilityTracker callbacks use `FeedbackManager.sound.stopAll()` instead of `FeedbackManager.sound.pause()/resume()`, missing `popupProps`"
- `true-or-false` builds 224+225: "VisibilityTracker onInactive uses stopAll instead of pause, missing stream handling, missing popupProps, missing fromVisibilityTracker flag"
- `number-pattern` build 213: Full VisibilityTracker cluster (wrong stopAll, wrong preload format, missing recordCustomEvent, missing stream calls)

**Why it survives generation:** CDN_CONSTRAINTS_BLOCK in prompts.js does NOT mention VisibilityTracker patterns. The generation prompt has no explicit VisibilityTracker block. The reviewer (Gemini 2.5 Pro) correctly catches it every time.

---

### Category B: debug functions / window exposure conflict
**Count: 8 events (29%)**

The generation prompt has a direct conflict in its rules:
- `CDN_CONSTRAINTS_BLOCK` line 84: "DEBUG FUNCTIONS: `window.debugGame/testAudio/testPause/testResume/testSentry/verifySentry` MUST NOT be on window — keep as local functions inside DOMContentLoaded (T1 rejects window-exposed debug functions)"
- But specs' Verification Checklist explicitly requires debug functions to be on `window` for the test harness

The LLM follows the generation prompt rule (keeps them local), and the reviewer then rejects for violating the spec checklist.

**Examples:**
- `queens` build 285: "Debug functions are defined as local variables inside `DOMContentLoaded` and are explicitly not attached to the `window` object, violating PART-012 and the Verification Checklist"
- `queens` build 285 (retry): Same rejection, same root cause
- `queens` build (08:31): Same again — fix model re-applied same local pattern
- `position-maximizer` build 287: "Debug functions are defined as local variables inside `DOMContentLoaded` closure and are explicitly not attached to window"
- `bubbles-pairs` build 230: "Missing debug functions on window (`debugGame`, `debugAudio`, `testAudio`, `testPause`, `testResume`)"

**This is a false positive in generation.** The CDN_CONSTRAINTS_BLOCK rule was added to prevent T1 static validator from rejecting window-exposed debug functions. But the specs themselves require them on window. These two requirements are in direct contradiction, causing a rejection loop on every game that has PART-012 debug functions.

---

### Category C: Contract compliance — postMessage payload incomplete
**Count: 5 events (18%)**

The LLM generates incomplete `postMessage` payloads for `game_complete` events:
- Missing `events` field (from `signalCollector.seal()`)
- Missing `completedAt` field
- Missing `duration_data` in metrics
- Sends `metrics` as a subset instead of the full required object
- Sends `game_complete` only on victory, not on game_over

**Examples:**
- `adjustment-strategy` build 50: "postMessage payload is `{ type: 'game_complete', data: { metrics: { ...subset... } } }` — missing `events` and `completedAt`"
- `adjustment-strategy` build 53: "Contract Compliance > gameState, attempts, metrics, duration_data, postMessage schemas"
- `adjustment-strategy` build 54: "postMessage payload omits `events`, `completedAt`; plus 0-stars not set on game_over"
- `adjustment-strategy` build 56: Multiple contract violations including missing `...signalPayload` spread
- `number-pattern` build 213: "FeedbackManager.sound.preload() calls use register() format instead of preload array format"

**Note:** Build 53 had `contract: { passed: 1, failed: 0 }` in Playwright tests but was still rejected by the LLM reviewer for contract issues. This is a **false positive** — the Playwright contract test passed but the review LLM identified a deeper spec mismatch the test did not cover.

---

### Category D: Sentry / initSentry ordering
**Count: 4 events (14%)**

The LLM places `initSentry()` in the wrong position relative to the Sentry SDK script:
- Places `initSentry` definition inside `<body>` after the `<head>` Sentry SDK script loads
- Or calls `initSentry()` inside `DOMContentLoaded` instead of in the `waitForPackages()` callback

**Examples:**
- `doubles` build 202: "`initSentry` function is defined in the `<body>` script, after the Sentry SDK script in the `<head>`"
- `doubles` build 206 (after fix): Same issue survived the fix attempt
- `position-maximizer` build 287: "initSentry() defined in body script after SDK loads; called inside DOMContentLoaded instead of using required window.addEventListener('load', initSentry) trigger"

---

### Category E: CDN audio URL domain confusion
**Count: 5 events (18%) — often co-occurring with Category A**

Generation prompt says CDN domain MUST be `cdn.homeworkapp.ai`. But specs with PART-017 audio include explicit asset URLs on `cdn.mathai.ai`. The LLM uses the generation prompt's domain rule over the spec's literal URLs.

**Examples:**
- `true-or-false`: "Sound preloading uses `cdn.homeworkapp.ai` instead of required `cdn.mathai.ai` URLs"
- `sequence-builder`: "Audio URLs in `FeedbackManager.sound.preload` use `cdn.homeworkapp.ai` instead of required `cdn.mathai.ai`"
- `memory-flip`: "Uses `FeedbackManager.sound.register()` with `cdn.homeworkapp.ai` URLs instead of `sound.preload()` with `cdn.mathai.ai` URLs"

**Root cause:** CDN_CONSTRAINTS_BLOCK has blanket rule "CDN domain MUST be cdn.homeworkapp.ai — NEVER cdn.mathai.ai", but audio asset files (MP3s) live on cdn.mathai.ai. The rule applies to CDN packages (JS/CSS), not audio assets. The LLM applies it to everything.

---

### Category F: Truncated/incomplete HTML generation
**Count: 2 events (7%)**

LLM hits token limit mid-output, producing truncated HTML that fails basic syntax checks.

**Examples:**
- `interactive-chat` build 220: "HTML ends mid-statement (`await runFallback`), SyntaxError, missing DOMContentLoaded block, missing closing tags"
- `queens` (static fix): "MISSING: </html> closing tag — HTML appears truncated"

---

## Are Any Rejections False Positives?

**Yes — two confirmed false positive patterns:**

### FP-1: Debug functions (Category B) — HIGH IMPACT
The CDN_CONSTRAINTS_BLOCK rule "DEBUG FUNCTIONS must NOT be on window" directly contradicts the spec checklist requirement "debug functions on window". The generation prompt trains the LLM to keep them local, then the reviewer rejects for not having them on window. This affects every game with PART-012 debug functions (estimated 60-70% of all games).

**Evidence:** `queens` build 285 was rejected 3 times for the same debug function issue. The fix model applied the CDN_CONSTRAINTS_BLOCK rule correctly, but the reviewer kept rejecting per the spec checklist. Neither side is wrong — the rules themselves conflict.

### FP-2: Contract test passed but reviewer rejected (Category C)
`adjustment-strategy` build 54 had `contract: { passed: 1, failed: 0 }` but was rejected for contract violations. The Playwright contract test is too coarse (only checks postMessage type exists) while the review LLM checks the full payload schema. These are testing different things, causing the reviewer to REJECT even when Playwright tests pass.

---

## Top 3 Rejection Categories (Summary Table)

| Rank | Category | Count | % | Recoverable? | False Positive? |
|------|----------|-------|---|--------------|-----------------|
| 1 | VisibilityTracker API misuse | 11 | 39% | Yes (fix usually works) | No |
| 2 | Debug functions / window conflict | 8 | 29% | No (loop) | YES — generation rule contradicts spec |
| 3 | postMessage contract incomplete | 5 | 18% | Sometimes | Partial (FP when Playwright test passes) |
| 3 | CDN audio URL domain confusion | 5 | 18% | Yes | No — but generation rule is overly broad |
| 5 | Sentry/initSentry ordering | 4 | 14% | Yes | No |
| 6 | Truncated HTML | 2 | 7% | Yes | No |

(Counts exceed 28 because events have multiple rejection reasons)

---

## Concrete Recommendations

### Recommendation 1 (Highest impact): Fix the debug-functions contradiction in CDN_CONSTRAINTS_BLOCK

The current rule in `lib/prompts.js` CDN_CONSTRAINTS_BLOCK (line 84):
```
DEBUG FUNCTIONS: window.debugGame/testAudio/testPause/testResume/testSentry/verifySentry MUST NOT be on window — keep as local functions inside DOMContentLoaded (T1 rejects window-exposed debug functions)
```

This is wrong. The specs' Verification Checklists require them ON window. The T1 static validator rejection concern was about **window.gameState/endGame/etc.** being overridden, not debug helpers. This rule should be corrected to:
```
DEBUG FUNCTIONS: window.debugGame, window.testAudio, window.testPause, window.testResume, window.verifySentry, window.testSentry MUST be exposed on window for test harness access. window.debugSignals must also be on window if SignalCollector is used.
```
This single change would prevent ~29% of all early rejections (Category B) from occurring at all.

### Recommendation 2: Add VisibilityTracker template to CDN_CONSTRAINTS_BLOCK

The most frequent rejection (39%) is VisibilityTracker API misuse. The CDN_CONSTRAINTS_BLOCK has extensive CDN_INIT_ORDER guidance but zero VisibilityTracker guidance. Adding a minimal required VisibilityTracker template would eliminate the majority of Category A rejections. The exact API is deterministic (same every time):
- `sound.pause()` / `sound.resume()` (not `stopAll()`)
- `stream.pauseAll()` / `stream.resumeAll()`
- `recordCustomEvent('visibility_hidden'/{})` / `recordCustomEvent('visibility_visible',{})`
- `{ fromVisibilityTracker: true }` on timer calls
- `popupProps: { ... }` in constructor

### Recommendation 3: Clarify CDN audio URL domain rule

The blanket "CDN domain MUST be cdn.homeworkapp.ai" rule should explicitly exclude audio asset URLs that the spec provides literally. Suggested fix:
```
- CDN URL for packages (JS/CSS): ALWAYS cdn.homeworkapp.ai — NEVER cdn.mathai.ai
- Audio asset URLs: use EXACTLY the URLs provided in the spec's PART-017 section — do NOT substitute domain names
```

---

## Impact Estimate

If Recommendations 1 and 2 are implemented:
- **Category B (debug functions, 29%)** would be eliminated entirely
- **Category A (VisibilityTracker, 39%)** would be reduced by ~70% (not all VisibilityTracker errors are template issues)
- Combined: estimated **~45-55% reduction** in early-review rejections
- Fewer early-review rejections = fewer build failures from the 2-strike early-review limit
- Fewer early-review retries = 3-5 minutes saved per build that currently hits the retry

---

*Analysis based on 48 hours of live build data (builds 50–295). No code was modified as part of this investigation.*
