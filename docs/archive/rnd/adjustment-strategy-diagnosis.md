# RnD: Adjustment Strategy — Root Cause Diagnosis

**Investigated:** 2026-03-20
**Builds analyzed:** 50, 51, 52, 53, 54, 55, 56, 57, 59 (approved), 159 (failed)
**Stated symptom:** "58 builds failed, ALL failures being rendering/toBeVisible — classic blank-page symptom"

---

## 1. Root Cause (one sentence)

The game fails not from a blank page but from a **non-deterministic FeedbackManager.init() audio popup race condition** combined with a **thrashing fix loop** that destroys working HTML when it misdiagnoses the popup timing failure as an HTML initialization bug.

---

## 2. What Actually Happens — Evidence Trail

### The Failure Is NOT a Blank Page

Build 159 log trace (March 20):
- DOM snapshot at Step 2.5 captured **42 start-screen elements, 42 game-screen elements** — the page renders fine
- Debug spec output confirms: `FeedbackManagerDefined: true`, `VisibilityTrackerDefined: true`, `ScreenLayoutDefined: true`, `TransitionScreenComponentDefined: true`
- The start screen renders ("Let's go!" and "Okay!" buttons are visible)

The "toBeVisible" failures are NOT from a blank page. They come from the `#mathai-transition-slot button` never becoming visible because the `beforeEach` fails to dismiss the FeedbackManager audio popup in time.

### The Core Mechanism

1. `FeedbackManager.init()` shows an audio permission popup with an "Okay!" button
2. This popup BLOCKS the rest of initialization — `ScreenLayout.inject()` runs only AFTER `FeedbackManager.init()` resolves
3. The `beforeEach` in game-flow.spec.js tries to click "Okay!" with an 8-second timeout
4. Under server load or Playwright parallelism, the popup sometimes takes >8s or appears at an unexpected time
5. When `beforeEach` silently swallows the timeout error (the `catch {}` block), the game never shows the transition slot
6. ALL 10 tests in the batch then fail with `waitForFunction` timeout on `#mathai-transition-slot button`
7. Triage correctly reads this as "HTML initialization failure" — and fires `fix_html`

### Evidence of Race Condition (Not HTML Bug)

Build 159 progression:
- **10:04**: 4 passed, 2 failed (game partially works)
- **10:04→10:06**: LLM fix applied → **0 passed, 10 failed** (fix broke the HTML)
- **10:06→10:07**: LLM fix applied again → **10:07: 6 passed, 0 failed** (restored)
- **10:07→10:18**: mechanics(17/0), level-progression(4/0), edge-cases(10/2), contract(6/0) — **all pass on same HTML**
- **10:24**: game-flow re-run → **0 passed, 10 failed** on the SAME HTML that passed at 10:08

The identical HTML passing at 10:08 and failing at 10:24 proves the issue is **non-deterministic**, not a deterministic HTML bug.

### The Thrashing Fix Loop

The LLM fix at 10:04 took a game with 4 passing tests and produced 0 passing. The triage correctly identified the symptom ("all tests fail on first `waitForSelector`") but misattributed it to "HTML initialization failure" when in fact the HTML was working — the popup timing was the variable.

The fix LLM then modifies the initialization sequence (sometimes removing `await FeedbackManager.init()` or restructuring `ScreenLayout.inject()` order), which creates a new structural break — producing the next round of 0/10 failures for a genuinely different reason. This creates the oscillation pattern visible across 58 builds.

---

## 3. Secondary Contributing Issues

### 3a. `FeedbackManager.sound.register is not a function`

The CDN's `FeedbackManager.sound.register()` API does not exist in the version being loaded. This error is caught and logged but does NOT block initialization (wrapped in `try/catch`). The game works without sound registration — this is a minor cosmetic issue, not the root cause.

Evidence from debug spec output:
```
"Sound registration error: FeedbackManager.sound.register is not a function"
```

### 3b. `window.endGame`, `window.restartGame`, `window.nextRound` not exposed

The generated HTML defines `endGame()` and `restartGame()` as local functions inside `DOMContentLoaded` — they are NOT assigned to `window`. Per CLAUDE.md, CDN games must expose `window.endGame`, `window.restartGame`, `window.nextRound`. This means `syncDOMState()` cannot call them via the test harness `window.__ralph.endGame()`, and `data-phase` transitions may not work correctly.

Evidence: grep shows zero `window.endGame` or `window.restartGame` assignments in the generated HTML.

This is a **secondary cause** — the test harness injected by pipeline can't drive the game through phases reliably. But since the game-flow tests don't use `window.__ralph` (they use direct DOM interaction), this may not be the proximate cause of the 0/10 failures.

### 3c. `PART-017 Feedback Integration: NO` vs `FeedbackManager.init()` usage

The spec marks `PART-017 Feedback Integration` as `NO` with the note "Extension — specific audio URLs used directly." However, the generated HTML still calls `FeedbackManager.init()` (which shows the popup). The intent of marking PART-017 as `NO` was to use FeedbackManager for audio only (direct `.sound.play()` calls), NOT to call `.init()` which triggers the popup. The LLM consistently misunderstands this and calls `FeedbackManager.init()` regardless.

---

## 4. Why It Recurs Across All 58 Builds

Three interlocking patterns:

1. **LLM always generates `await FeedbackManager.init()`** — the spec says PART-017 is NO (meaning no full FeedbackManager feature integration), but PART-005 says `popupProps: default`. The LLM interprets "popupProps: default" as requiring `FeedbackManager.init()`, which shows the audio popup. Every generation includes this call.

2. **The popup timing is non-deterministic** — under Playwright test parallelism (3 workers), some tests hit the 8-second window cleanly, others don't. When they don't, all 10 tests in the batch fail simultaneously (same `beforeEach` failure), which looks like a catastrophic HTML init failure to triage.

3. **The fix loop is destructive** — when triage sees 10/10 failures with timeout on `#mathai-transition-slot button`, it fires `fix_html`. The fix LLM restructures the init sequence (sometimes incorrectly), creating a new class of HTML bugs. The loop then spends all 3 iterations on a moving target, never stabilizing. The "best snapshot" restore partially mitigates this but doesn't prevent it.

---

## 5. Recommended Fix

### Fix A — Remove `await FeedbackManager.init()` from adjustment-strategy (spec change) [HIGHEST IMPACT]

Add to the spec's PART-017 section an explicit instruction:
> "Do NOT call `FeedbackManager.init()`. Use `FeedbackManager.sound.play()` and `FeedbackManager.playDynamicFeedback()` directly without initialization. The popup must not appear."

This eliminates the popup entirely. Without the popup, the `beforeEach` timing issue disappears and the non-determinism goes away.

**Confidence: HIGH** — the spec already marks PART-017 as NO; the popup was never intended. This is a spec clarification that prevents the LLM from generating the init call.

### Fix B — Add `window.endGame`, `window.restartGame`, `window.nextRound` as prompt rules [SECONDARY]

Add to gen prompt rules 20/21 (already enforced per CLAUDE.md): ensure these are already enforced. If they are, the current build's HTML is regressing because the LLM is ignoring the rules under the pressure of fixing other failures. The fix prompt needs to include these rules explicitly.

**Confidence: MEDIUM** — fixes a secondary issue but won't stop the 0/10 popup-driven failures.

### Fix C — Fix the `beforeEach` popup dismiss reliability in test generation prompt [PIPELINE CHANGE]

The test-gen prompt should specify: "If FeedbackManager.init() is called, the beforeEach must handle the popup with a polling loop (not a fixed timeout) and must verify the popup is gone before proceeding." Also: use `waitForFunction` that polls for both the popup's absence AND the slot's presence.

**Confidence: MEDIUM** — improves test resilience but doesn't fix the root cause (the popup being called at all).

### Fix D — Add "FeedbackManager.init() shows blocking popup" to pipeline knowledge base

Add to the gen prompt's CRITICAL NOTES: "Do NOT call `FeedbackManager.init()` without also adding popup dismiss logic in `beforeEach`. If you call `FeedbackManager.init()`, every test will non-deterministically fail because Playwright cannot reliably dismiss the popup under parallelism."

**Confidence: HIGH** — addresses the LLM's blind spot about this specific anti-pattern.

---

## 6. Recommended Immediate Action (Priority Order)

1. **Add to spec.md** under PART-017 (or PART-003/PART-005): `CRITICAL: Do NOT call FeedbackManager.init(). Use .sound.play() and .playDynamicFeedback() directly. Calling .init() shows a blocking popup that prevents game initialization and causes all tests to fail non-deterministically.`

2. **Add to pipeline gen prompt**: "Do NOT call `FeedbackManager.init()` — it shows a blocking audio permission popup. Use FeedbackManager audio APIs directly."

3. **Trigger a fresh build** after spec + prompt change.

---

## 7. Confidence Assessment

| Finding | Confidence |
|---------|-----------|
| Page renders fine (not blank) | HIGH — debug spec confirms all CDN packages load, DOM snapshot shows 42 elements |
| FeedbackManager popup is the non-deterministic blocker | HIGH — logs show 6/0 pass and 0/10 fail on identical HTML in same build |
| `FeedbackManager.sound.register is not a function` error | HIGH — directly visible in test output |
| `window.endGame` etc. not exposed | HIGH — grep confirms zero assignments |
| Fix loop thrashing as secondary damage amplifier | HIGH — iteration trace shows working HTML destroyed by fix LLM |
| PART-017=NO being misinterpreted to still call `.init()` | MEDIUM — inferred from pattern; would need LLM gen logs to fully confirm |
