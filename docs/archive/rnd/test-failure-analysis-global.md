# Ralph Pipeline: Research-Grade Test Failure Analysis — Global

Date: 2026-03-21
Author: R&D analysis agent (claude-sonnet-4-6)
Builds analysed: 12 (9 approved, 3 failed, from IDs 397–416)

---

## Executive Summary

Three findings dominate. First, the 0/0 category problem is real and architectural: when triage skips all tests in a category, that category contributes zero to both totalPassed and totalFailed, making it invisible to the approval gate — a game can be APPROVED with entire categories having zero coverage. Second, the most common test-failure root cause (38 out of 76 recorded failures) is a single symptom: `#mathai-transition-slot button` not found in 5 seconds, caused by games that do not expose `ScreenLayout.inject()` correctly or whose CDN packages take longer than the test's 5-second startup wait. Third, the fix loop does NOT rescue failed builds: every approved build in the corpus cleared all tests on iteration 1 (except futoshiki which needed 1 fix iteration), confirming that generation quality is the only lever that matters.

---

## Finding 1: The 0/0 Category Problem

### What it is

When the triage step decides to `skip_tests` for an entire category batch (or the LLM generates tests with invalid selectors that are all skipped), the category ends the pipeline with `passed=0, failed=0`. The approval gate computes:

```javascript
const passRate = totalTests > 0 ? lastPassed / totalTests : 0;
if (passRate < 0.5 || lastPassed === 0) { /* FAIL */ }
```

`totalTests = totalPassed + totalFailed`. A 0/0 category adds nothing to either. Its existence is invisible to the denominator.

### Concrete examples from the corpus

| Game | Category with 0/0 | Effective pass rate | Approved? |
|------|-------------------|---------------------|-----------|
| loop-the-loop | game-flow, mechanics, contract | 1/1 = 100% | YES |
| hidden-sums | game-flow | 9/9 = 100% | YES |
| matrix-memory | edge-cases | 7/7 = 100% | YES |

**loop-the-loop is the worst case.** Only 1 test out of 5 categories ran (edge-cases: 1 pass). The other 4 categories (game-flow, mechanics, contract, and partially level-progression) were all skipped by triage because the generated tests used invalid CSS selectors (`#edge-el-0,0-0,1` — commas in IDs are not valid CSS without escaping). The single passing test was a trivial edge-case check. The game was APPROVED.

### Is this a bug?

Yes, in a meaningful sense. The approval gate has a special game-flow guard:

```javascript
if (gameFlowResult && gameFlowResult.passed === 0 && passRate < 0.7) {
  // FAIL
}
```

But this guard only fires when `passRate < 0.7`. Because the 0/0 categories are invisible to passRate, a build with 1/1 has passRate = 1.0, bypassing the guard.

**The fix:** The approval gate should count the number of categories with zero coverage (0/0) and fail or warn when more than 1 category has no test evidence. Alternatively, the guard should fire when `game-flow.passed === 0 AND game-flow.failed === 0` regardless of passRate — a category with no evidence is not a passing category.

---

## Finding 2: Pass Rate by Category (Approved Builds)

Across 9 approved builds, final category_results aggregated:

| Category | Tests Passing | Tests Failing | Pass Rate | 0/0 in N builds |
|----------|--------------|--------------|-----------|-----------------|
| mechanics | 25 | 1 | 96% | 1/9 |
| level-progression | 7 | 0 | 100% | 0/7 (not generated for 2 builds) |
| edge-cases | 15 | 0 | 100% | 1/9 |
| contract | 9 | 0 | 100% | 1/9 |
| game-flow | 14 | 1 | 93% | 2/9 |

**Observation:** When tests actually run, all categories have high pass rates. The problem is not that individual tests fail — it is that entire categories get zeroed out by triage. The 0/0 builds skew the true coverage picture.

**Category difficulty ranking** (from easiest to hardest to generate correctly):
1. contract — simplest: check postMessage fires with correct fields
2. level-progression — straightforward: advance rounds, check counters
3. mechanics — medium: click game elements, check state changes
4. edge-cases — medium: boundary conditions, often uses wrong phase names
5. game-flow — hardest: relies on transition slot being present and all CDN scripts loaded within startup window

---

## Finding 3: Root Cause Taxonomy

76 failure instances catalogued across 12 builds. Root causes ranked by frequency:

### Root Cause 1: Transition slot not found (38 failures, ~50%)

**Error pattern:**
```
locator('#mathai-transition-slot button').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

**Occurs in:** associations (all 4 categories), count-and-tap (game-flow, mechanics), light-up (game-flow, mechanics, edge-cases).

**Why it happens:** The `beforeEach` hook in these failed builds waits only 5 seconds for `#mathai-transition-slot button` to be visible. CDN games require: (1) FeedbackManager.init() to complete (shows audio popup), (2) ScreenLayout.inject() to run (creates the transition slot), (3) The transition screen to render a button. When `window.gameState` is not yet set or the FeedbackManager audio popup blocks the CDN init flow, the slot never appears within 5 seconds.

The `beforeEach` in the test-gen boilerplate for CDN games uses a 50-second polling loop — but the failed builds use the 5-second fallback. This divergence occurs because the CDN detection logic in `pipeline-test-gen.js` checks:
- `htmlContent.includes('mathai-transition-slot')` — true only if the raw HTML contains the slot id literally
- `ScreenLayout.inject` — present in CDN HTML (these games all have it)

**Root cause within root cause:** The 5-second beforeEach variant is the non-CDN path. The CDN detection logic *does* correctly identify these as CDN games (they all have `ScreenLayout.inject`). The 50-second polling loop is correct in the boilerplate. But the test-gen LLM generates a `test.describe` block that overrides the `beforeEach` with a shorter wait, or the game's HTML fails at a different stage (CDN scripts take longer than 50 seconds on the test server, or FeedbackManager popup is clicked but init fails after that).

**Evidence:** associations build 405 iteration 3 shows "FeedbackManager Okay! button detached from DOM" — the popup was found and clicked, but the element detached before the click completed. This is a timing race in the CDN startup flow.

### Root Cause 2: Wrong phase name in test assertions (18 failures, ~24%)

**Error pattern:**
```
locator('#app').toHaveAttribute('data-phase', 'playing')
Received: 'memorize' / 'question' / 'start'
```

**Occurs in:** matrix-memory (edge-cases: 2 tests), count-and-tap (game-flow + all categories), loop-the-loop (indirectly).

**Why it happens:** Test generator uses `'playing'` as the universal game-active phase, but many games use custom phase names. Matrix-memory uses `memorize` and `question`. The DOM snapshot injected into test-gen prompts captures the runtime phase name — when the LLM generates tests without consulting the snapshot's actual phase values, it defaults to the generic `'playing'`.

In count-and-tap's case, the game IS at phase 'start' because the non-CDN `startGame()` helper fails to transition past the start screen. The game has `ScreenLayout.inject` (CDN), but the test treats it as non-CDN. The CDN-detection check should have caught this (the HTML has `ScreenLayout.inject`) — but the raw HTML also has `mathai-transition-slot` only injected at runtime. The `hasTransitionSlot` check in `pipeline-test-gen.js` line 219–229 does check `ScreenLayout.inject` — so count-and-tap should have received the CDN boilerplate with the 50-second polling loop.

The failure trace shows `data-phase="start"` persisting throughout all 15-second waits. This means the game's CDN startup succeeded and put the game in `start` phase, but the non-CDN `startGame()` function (which tries text-matching "Start", "Play", etc.) did not find the start button — the actual button is inside `#mathai-transition-slot` which the non-CDN helper doesn't use.

**Conclusion for count-and-tap:** The pipeline generated the non-CDN boilerplate despite the HTML having CDN markers. The DOM snapshot was missing (no `tests/dom-snapshot.json` in the build directory), meaning the snapshot was not captured and the fallback detection ran — but even the fallback checks `ScreenLayout.inject` in `htmlContent`. This suggests the build ran on an older pipeline version that didn't have this check.

### Root Cause 3: Test assumes wrong game logic (11 failures, ~14%)

The triage step correctly identified these and skipped the tests. Examples:

- **connect:** Test asserts reset button deducts a life — game logic doesn't implement this penalty
- **free-the-key:** Test directly mutates `block.row` to simulate a move — game's collision grid is not updated, move detection fails
- **loop-the-loop:** Test checks that `SVG <line>` elements are `toBeVisible` — SVG elements in headless Chromium are not visible in the CSS sense even when rendered
- **matrix-memory:** Tests wait for `data-phase='playing'` after startGame — actual phases are `memorize`/`question`
- **hidden-sums:** Test uses `.resolves.toBe()` on an `await`ed value (already a number, not a promise)

These are **generation quality failures**: the LLM hallucinated game behavior not present in the HTML or spec, or used incorrect Playwright API patterns.

### Root Cause 4: Invalid CSS selectors (9 failures, ~12%)

**loop-the-loop:** Edge IDs contain commas (`#edge-el-0,0-0,1`). CSS parsers treat commas as list separators. The correct selector would be `#edge-el-0\\,0-0\\,1` or an attribute selector. The LLM generated the ID verbatim from the DOM snapshot without escaping.

**Fix:** Post-processing fixup in `pipeline-test-gen.js` already fixes several CSS issues (class vs ID prefix, progress slot), but does not handle commas in IDs. A fixup regex could detect `#[\w-]*(,[\w-]*){1,}` patterns and emit a console warning or replace with `[id="..."]` syntax.

---

## Finding 4: What Tests Pass Easily vs Consistently Fail

### Passes easily (iteration 1, no fixes needed)

- Contract tests checking postMessage payload fields
- Level-progression: advance to next round and check round counter
- Simple mechanics: click a button, expect score to increment
- Edge-cases with `skipToEnd()`: these use `window.__ralph.endGame()` which bypasses game logic entirely
- Tests that only assert `window.gameState` field values (not DOM phase/visibility)

### Consistently fails or gets skipped

- Game-flow start-to-gameplay transitions for CDN games (depends on CDN load timing)
- Any test using `waitForPhase(page, 'playing')` on a game with custom phase names
- Any test generating selectors from element IDs that contain special characters
- Tests that try to simulate game-specific UI interactions (drag, slide, draw) rather than using `window.__ralph.answer()`
- Edge-case tests that assume default phase transitions (assume 3→2 lives decrements, assume reset deducts life)

---

## Finding 5: Approved With Failures — The Triage Loophole

Three approved builds have failing tests that were NOT fixed, only triaged away:

1. **connect (406):** mechanics test "Reset button clears path and deducts life" — failed because the game doesn't deduct a life on reset. Triage correctly skipped it. The game IS functionally correct; the test was wrong.
2. **free-the-key (404):** game-flow test "Verify victory condition" — failed because the test mutated state incorrectly. Triage correctly skipped.
3. **loop-the-loop (412):** 4 tests skipped for invalid CSS selectors — the game's edge interaction was never tested.

In cases 1–2, approval is correct (test was wrong, game is fine). In case 3, the approval is suspect: the game's core mechanic (edge toggling) was never verified by any test that actually ran.

---

## Recommendations

### Rec 1: Fix the 0/0 approval loophole (HIGH — impacts quality assurance)

**Change:** In `pipeline.js` approval gate, add:

```javascript
const zeroCoverageCats = Object.entries(report.category_results)
  .filter(([, r]) => r.passed === 0 && r.failed === 0);
if (zeroCoverageCats.length >= 2) {
  // fail or require human review
}
```

**Expected impact:** Would have blocked loop-the-loop #412 (3 zero-coverage categories). Would not have affected other approved builds. Prevents approving games with very thin test evidence.

### Rec 2: Enforce game-flow must have at least 1 passing test to approve (HIGH)

**Change:** The game-flow guard currently only fires when `passRate < 0.7`. Change to: if game-flow has 0 passed AND 0 failed, that is equivalent to 0 passed regardless of passRate.

**Expected impact:** Would have blocked hidden-sums #408 (game-flow 0/0) — but hidden-sums' mechanics/contract/edge/level all pass, so the review would likely still approve. Net effect: forces game-flow test regeneration before approval.

### Rec 3: Add CSS selector escaping fixup for comma-containing IDs (MEDIUM)

**In `pipeline-test-gen.js`** post-processing, add:

```javascript
// Replace locator('#id-with,commas') → locator('[id="id-with,commas"]')
catTests = catTests.replace(/locator\s*\(\s*'(#[^']*,[^']+)'\)/g, (m, sel) => {
  const id = sel.slice(1); // strip #
  return `locator('[id="${id}"]')`;
});
```

**Expected impact:** Would have fixed 4 of 9 invalid CSS selector failures in loop-the-loop (the edge-el selectors), allowing at least some mechanics tests to run.

### Rec 4: Inject phase names from DOM snapshot into test-gen prompt (MEDIUM)

Currently, the DOM snapshot captures `data-phase` values at runtime. Add a post-processing step that extracts the actual phase names from the DOM snapshot and injects them into the test-gen prompt as a constraint:

```
ACTUAL PHASE NAMES observed at runtime: ['start', 'memorize', 'question', 'gameover', 'results']
DO NOT use 'playing' — this game uses 'memorize'/'question' as its active phases.
```

**Expected impact:** Would have prevented the matrix-memory edge-case failures (which tested for `'playing'` instead of `'memorize'`/`'question'`). Estimated 2–3 additional tests passing per build with custom phases.

### Rec 5: Add transition-slot CDN startup timing guidance to beforeEach (LOW)

The 50-second polling loop in the CDN `beforeEach` is correct. But some games (associations, light-up) still time out at 5 seconds for individual assertions inside tests. The issue is the test writer uses 5-second `toBeVisible` assertions immediately after `startGame()` when the CDN slot button may take up to 10 additional seconds to appear.

**Fix:** Add to test-gen prompt: "After startGame(), always use at least 10-second timeouts for any toBeVisible assertions — CDN games may continue loading after the start button disappears."

---

## Appendix: Build Data Summary

| Game | Build | Status | Pass Rate | Fix Iters | 0/0 Cats | Cost |
|------|-------|--------|-----------|-----------|----------|------|
| simon-says | 416 | APPROVED | 100% (8/8) | 0 | none | $1.48 |
| mcq-multi-select | 414 | APPROVED | 100% (11/11) | 0 | none | $1.88 |
| matrix-memory | 413 | APPROVED | 100% (7/7) | 0 | edge-cases | $2.39 |
| loop-the-loop | 412 | APPROVED | 100% (1/1) | 0 | game-flow, mechanics, contract | $1.90 |
| hidden-sums | 408 | APPROVED | 100% (9/9) | 0 | game-flow | $1.72 |
| futoshiki | 407 | APPROVED | 100% (10/10) | 1 | none | $1.69 |
| connect | 406 | APPROVED | 89% (8/9) | 0 | none | $2.37 |
| free-the-key | 404 | APPROVED | 89% (8/9) | 0 | none | $2.86 |
| explain-the-pattern | 401 | APPROVED | 100% (8/8) | 0 | none | $2.12 |
| light-up | 411 | FAILED | 0% (0/8) | 2 | contract | $N/A |
| associations | 405 | FAILED | 0% (0/9) | 2 | level-prog, contract | $N/A |
| count-and-tap | 397 | FAILED | 0% (0/1) | 2 | mechanics, level-prog, edge, contract | $N/A |

**Key finding on cost:** Approved builds cost $1.48–$2.86, averaging ~$2.05. The fix loop does NOT reduce cost — futoshiki (1 fix iteration) cost $1.69, similar to simon-says (0 fix iterations) at $1.48. The bottleneck is the generation and test-gen LLM calls, not the fix loop.
