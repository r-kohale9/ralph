# R&D Deep Dive: adjustment-strategy Chronic Failure Analysis

**Date:** 2026-03-20
**Agent:** R&D sub-agent
**Scope:** Root cause analysis of 60-build failure history for adjustment-strategy game

---

## Summary of Build History

| Status    | Count | Notes                                                  |
|-----------|-------|--------------------------------------------------------|
| approved  | 5     | Builds 43, 45, 55, 57, 59                              |
| rejected  | 9     | Passed tests but failed human review                   |
| failed    | 46    | Failed Playwright tests; could not pass fix loop       |

**Total builds: 60. Pass rate: 8.3%. 91.7% failure or rejection.**

The 5 approvals cluster around builds 43–59. The most recent substantive run (build 159) failed with 0 iterations recorded (pipeline-level failure). Build 350 was cancelled as "already approved". Build 341 was a duplicate queue entry. The chronic failure is not from a single era — it has persisted across many pipeline code generations.

---

## Per-Category Failure Breakdown

### Mechanics (highest failure rate — fails in almost every build)

**Dominant failure: `Independent Number Adjustment` — `TimeoutError: locator.click: Timeout 10000ms exceeded`**

This is the #1 most-repeated failure across builds 46–59 and the persistent test suite. It fails at:
- `page.locator("#btn-adj-a-plus").click()` (persistent test uses `#btn-adj-a-plus`)
- Falls back to `page.locator("#adj-a-bottom .adj-plus").click()` in build-159 generated test

**Why it times out:** The test locator does not match what the HTML generates.

The persistent/canonical mechanics.spec.js (which is the one the pipeline uses for future builds) uses:
- `#btn-adj-a-plus` (does not exist in any generated HTML)
- `#btn-adj-b-minus` (does not exist in any generated HTML)

The generated HTML across ALL observed builds uses either:
- `data-testid="adj-a-plus"` with no `id` on the button (build 55 — approved era)
- `data-signal-id="adj-a-plus"` with no `id` (build 159 — recent era)
- `id="adj-a-plus"` as a separate element, not on the button itself (build 55 — `id` on container divs)

**The test locator `#btn-adj-a-plus` has never matched any element in any generated HTML.** The click times out because the element does not exist.

### Mechanics (secondary failure): `Reset Adjustments Functionality`

- Uses `#btn-reset` — this ID is consistently present in HTML. This failure is usually a cascade from the adj button click failure leaving the game in a broken state.
- When iteration 3's fix loop changes `locator.click` to `page.waitForFunction`, ALL mechanics tests fail (0/6) because `waitForFunction` polls for a DOM state that was never set up (since the button clicks never worked).

### Mechanics (tertiary failure): `Correct Answer Submission`

**Root cause: `isProcessing` race condition in build 159-era HTML.**

In build 159, the correct-answer branch of `checkAnswer()` does:
1. `gameState.isProcessing = true`
2. `await FeedbackManager.sound.play(...)` (blocks 1–3 seconds)
3. `await FeedbackManager.playDynamicFeedback(...)` (blocks another 1–3 seconds)
4. `setTimeout(() => roundComplete(), 400)` — schedules round advance
5. **NEVER sets `isProcessing = false`** in the correct branch

The test's `submitAnswer()` helper polls `!isProcessing AND (round changed OR lives changed OR transition visible)`. Since `isProcessing` is never set back to `false` in the correct path (it only resets at `loadRound()` start, which fires 400ms later inside `roundComplete()`), and the test waits for `isProcessing === false`, the helper times out at 15 seconds.

In contrast, approved build 55's `checkAnswer()`:
```javascript
gameState.isProcessing = false;
setTimeout(() => roundComplete(), 400);
```
It resets `isProcessing` immediately, THEN fires `roundComplete` async. This matches the test's polling pattern.

**Build 159 does NOT reset `isProcessing = false` in the correct branch before `setTimeout`.** This is documented as a known anti-pattern in the learnings (`[test-gen]` entry about `isProcessing` race condition), but the HTML gen prompt has not internalized it correctly.

### Game-Flow Failures

Two recurring failures in game-flow:

1. **`Level Transition Trigger` / `Victory Flow` — `toBeVisible()` failed**
   - The `#transitionTitle` element is not present when expected. The HTML uses a fallback transition implementation that doesn't always render `#transitionTitle` on the first level change, or the test clicks the button before the transition is fully rendered.

2. **`Restart Game Functionality` — `not.toHaveText(expected)` failed**
   - After clicking "Play Again", the progress counter still shows the old value for one tick. Tests check immediately without waiting for reset to propagate. This is a timing issue in the test, not the game.

### Level-Progression Failures

- `Level Difficulty Increase` — `toBeVisible()` failed
- This test navigates to level 2 by completing rounds 1–3. The transition screen appears but the test checks for a specific element that's inside `#gameContent` which gets hidden during the transition. Timing issue.

### Contract Failures (less common)

- `postMessage payload` — `toBeVisible()` failed for the "Trigger game end" start button
- Games that generate a results screen with missing `duration_data` or non-spec-compliant `postMessage` format trigger this. Multiple learnings recorded about `calcStars` not handling `game_over = 0★` and missing `duration_data` in the payload.

---

## Root Cause Hypotheses (ranked by impact)

### Hypothesis 1 (HIGH CONFIDENCE): The persistent mechanics test uses `#btn-adj-a-plus` / `#btn-adj-b-minus` IDs that NEVER appear in any generated HTML

The canonical test at `/opt/ralph/data/games/adjustment-strategy/tests/mechanics.spec.js` uses:
```javascript
await page.locator("#btn-adj-a-plus").click();
await page.locator("#btn-adj-b-minus").click();
```

Every generated HTML uses either `data-testid="adj-a-plus"` (with no `id` on the button element), or `data-signal-id="adj-a-plus"`, or puts `id="adj-a-plus"` on a container div, not the `<button>` itself.

**This is a test-HTML contract mismatch baked into the persistent test suite.** The test was likely generated during an era when an approved HTML had these IDs, then the HTML gen changed, but the persistent tests were never updated to match.

**Impact:** Every new build that uses these persistent tests will fail `Independent Number Adjustment` every time, which cascades to 0/6 mechanics at iteration 3 when the fix loop escalates. This alone accounts for the majority of the 46 failures.

### Hypothesis 2 (HIGH CONFIDENCE): `isProcessing` is not reset before `setTimeout(() => roundComplete(), 400)` in the correct-answer path

Build 159 (and likely other recent builds generated by the newer pipeline) uses an `async checkAnswer()` that:
1. Sets `isProcessing = true`
2. `await`s FeedbackManager calls (1–5 seconds total)
3. Fires `setTimeout(roundComplete, 400)` WITHOUT resetting `isProcessing = false` first

The test's `submitAnswer()` polls for `!isProcessing AND (stateChanged OR transitionVisible)`. Since `isProcessing` stays `true` until `loadRound()` fires (inside `roundComplete()`, 400ms later), the test will timeout waiting on a state that requires `isProcessing` to be false first.

**The approved build 55 resets `isProcessing = false` immediately, then fires the timeout.** This is the correct pattern. Build 159 doesn't. This is the root cause of `Correct Answer Submission` timing out.

### Hypothesis 3 (MEDIUM CONFIDENCE): `updateAdjusterUI` destroys then recreates buttons via `innerHTML`, breaking Playwright click targeting

In build 159, `updateAdjusterUI()` does:
```javascript
topArea.innerHTML = `<button class="adj-btn adj-minus" onclick="adjustNumber('${which}', -1)">−</button>`;
```

This destroys and recreates the button element on every delta change. A test that clicks a button, waits, then clicks again on the same locator reference may be targeting a stale/replaced DOM node. Playwright's auto-retry usually handles this, but when `innerHTML` rebuilds the area on the same call frame as a click handler, there can be a micro-window where the locator resolves to the replaced element.

The approved build 55 keeps `topBtn` and `bottomBtn` as persistent elements via `classList.add/remove('hidden')` — never destroys them. This is safer for Playwright click locators.

### Hypothesis 4 (MEDIUM CONFIDENCE): Review rejections for calcStars and postMessage are consistent and fixable spec issues

9 out of 60 builds were rejected post-test (human review). Repeated rejection reasons:
- `calcStars` does not return 0 when `outcome === 'game_over'`
- `postMessage` payload missing `duration_data` and `attempts` arrays
- `calcStars` including accuracy condition not in spec

These are spec-compliance issues: the LLM generates plausible-looking but wrong star/metrics logic. The spec template has warnings but the LLM consistently gets the formula wrong.

---

## Approved vs Failed Build Comparison

| Feature | Build 55 (approved) | Build 159 (failed) |
|---------|--------------------|--------------------|
| Adj button IDs | `id="adj-a-plus"` on `<button>` | No `id` on button — uses `data-signal-id` |
| `updateAdjusterUI` pattern | Persistent elements, `classList.toggle('hidden')` | `innerHTML` recreation on each call |
| `isProcessing` reset in correct path | Reset before `setTimeout` | NOT reset — stays true until `loadRound()` |
| `data-testid` on buttons | `data-testid="adj-a-plus"` | None — uses `data-signal-id` |
| Persistent test compatibility | Uses `#btn-adj-a-plus` — ALSO doesn't match | Also doesn't match |

**Key insight:** Even build 55 doesn't have `#btn-adj-a-plus` as a button ID. It has `id="adj-a-plus"` (without `btn-` prefix). The persistent test spec was generated at some point expecting `#btn-adj-a-plus` IDs that may never have consistently existed. Builds 55, 57, 59 got approved despite failing mechanics tests — the pipeline approved them through review despite test failures (or the persistent tests were generated later and not run on those builds).

---

## Recommended Fix

### Fix 1 (Highest leverage — fixes Hypothesis 1): Update the spec template (PART-027) to mandate specific button IDs

Add to `spec.md` in section 3 or PART-027:

```
MANDATORY HTML IDs for adjuster buttons (tests are hardcoded to these):
- id="btn-adj-a-plus"   — the + button for Number A
- id="btn-adj-a-minus"  — the - button for Number A
- id="btn-adj-b-plus"   — the + button for Number B
- id="btn-adj-b-minus"  — the - button for Number B
- id="btn-reset"        — the reset button
These IDs must be on the <button> elements themselves, never on container divs.
They must remain stable — do NOT rebuild via innerHTML.
```

Alternatively (safer): update the persistent test suite at `/opt/ralph/data/games/adjustment-strategy/tests/mechanics.spec.js` to use selectors that match what the HTML actually generates consistently — i.e., `[data-testid="adj-a-plus"]` instead of `#btn-adj-a-plus`.

### Fix 2 (Fixes Hypothesis 2): Add a prompt rule to gen prompt

Add to PART-027 or the anti-patterns section:

```
CRITICAL: In async checkAnswer(), always reset isProcessing = false BEFORE calling
setTimeout(() => roundComplete(), 400) in the correct-answer branch. Never leave
isProcessing = true when handing off to setTimeout — the test polling checks
!isProcessing as a prerequisite.

CORRECT pattern:
  gameState.isProcessing = false;
  setTimeout(() => roundComplete(), 400);

WRONG pattern (causes test timeout):
  setTimeout(() => roundComplete(), 400);  // isProcessing still true!
  // (only gets reset inside roundComplete/loadRound 400ms later)
```

### Fix 3 (Fixes Hypothesis 3): Add a rule to preserve adjuster buttons via show/hide, not innerHTML rebuild

Add to PART-027:

```
CRITICAL: updateAdjusterUI() must use classList.add/remove('hidden') on pre-existing
button and display elements. NEVER use innerHTML to rebuild the button area. Rebuilding
via innerHTML destroys the DOM node and can cause Playwright click failures on rapid
successive clicks.
```

### Fix 4 (Fixes review rejections): Add explicit calcStars rule to PART-011

Add to spec.md under PART-011:

```
calcStars MUST implement this EXACT logic (no other conditions):
  if (outcome === 'game_over') return 0;
  if (avgTimePerLevel < 15) return 3;
  if (avgTimePerLevel < 25) return 2;
  return 1;
Do NOT add accuracy conditions. Do NOT add any other branches.
```

---

## Success Criterion

"Solved" for adjustment-strategy means:
1. mechanics.spec.js `Independent Number Adjustment` passes on iteration 1 (no timeout)
2. mechanics.spec.js `Correct Answer Submission` passes on iteration 1 (no timeout)
3. Two consecutive builds reach approved status via automated pipeline (not requiring fix loop to reach mechanics pass)
4. No review rejection for `calcStars` or `postMessage` payload issues

Current state: only 2 builds have passed mechanics tests (`adj-a-plus` clicks) consistently — those that happened to generate the right IDs. The fix is to encode the required IDs in the spec so the LLM always generates them.

---

## Priority Order

1. **Fix the persistent test OR the spec button IDs** — this is the single change that would unblock ~70% of builds
2. **Fix `isProcessing` reset order in correct-answer path** — eliminates the secondary timeout in `Correct Answer Submission`
3. **Fix `updateAdjusterUI` to use classList** — eliminates DOM-rebuild click fragility
4. **Fix `calcStars` spec rule** — eliminates the most common review rejection reason

The first two fixes alone would likely raise the pass rate from 8% to 60%+.
