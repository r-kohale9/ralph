# Consistent Test Failure RCA (2026-03-22)

## Summary

Analysis of builds 450–515 (65 builds across 20+ games). **6 consistent cross-game failure patterns** found.
The data sources used:
- `failure_patterns` table: 50 rows, dominated by adjustment-strategy (19 unknown + rendering occurrences)
- `builds` table `test_results` JSON: 40 builds parsed, error signatures extracted per batch/iteration
- `learnings` table: 10 learning records from builds 450–503
- `docs/lessons-learned.md`: Lessons 63–93 reviewed for open issues

Top patterns by cross-build frequency (unique build count, not occurrence count):

| Rank | Pattern | Unique Builds | Unique Games | Category |
|------|---------|---------------|--------------|----------|
| 1 | `#mathai-transition-slot button` missing in beforeEach | 8 | 5 | CDN init / test-gen |
| 2 | Phase stuck at `playing` when game-over expected | 7 | 5 | game-flow |
| 3 | `postMessage` returns null (game_complete not sent) | 4 | 2 | contract |
| 4 | Results/victory screen visibility wrong after endGame | 5 | 3 | game-flow / edge-cases |
| 5 | CSS class state mismatch (toHaveClass / toNotHaveClass) | 1 | 1 | mechanics |
| 6 | `isProcessing` never reset after rapid-click guard | 1 | 1 | mechanics |

**Cross-cutting finding:** The fix loop rescues very few builds. Of 9 builds with `iterations >= 3`, only 3 were approved (33%). All 3 still had at least one failing test at iteration 3 (left in test_results). The fix loop cannot repair structural phase-management bugs — those require gen prompt changes.

---

## Pattern 1: `#mathai-transition-slot button` missing in beforeEach

**Frequency:** 15 occurrences across 8 builds, 5 games
**Builds:** 462 (associations), 463 (light-up), 465 (keep-track), 471 (count-and-tap), 473 (light-up), 477 (keep-track), 479 (disappearing-numbers), 503 (keep-track)
**Games:** associations, light-up, keep-track, count-and-tap, disappearing-numbers
**Category:** CDN init / test-gen

**Root cause:**
Two sub-causes produce this identical error signature:

**Sub-cause A — beforeEach waits for transition-slot that never appears (Lesson 35/37):**
The `sharedBoilerplate` beforeEach unconditionally waits for `#mathai-transition-slot button` with a 50s polling timeout. For CDN games where the transition slot IS present, this is correct. But when the transition screen does not show (e.g., the game skips it for a particular flow, or the slot is empty during a mid-game transition), the wait times out and the test fails in beforeEach before any assertions run.

**Sub-cause B — Fix loop regenerates HTML that breaks CDN init, losing the transition slot entirely:**
After iteration 2 or 3, the fix LLM patches an unrelated bug but accidentally corrupts the `ScreenLayout.inject()` call or the `waitForPackages` block. This causes the CDN initialization to fail silently — `#mathai-transition-slot` is never populated by ScreenLayout, so the button never appears.

**Evidence:**
- Build 503 (keep-track): All 6 persistent failures in learnings table are `locator('#mathai-transition-slot button').first()` — visible in every test category at iteration 3
- Build 473 (light-up): edge-cases iter 3 fails on transition-slot, while iter 2 failed on `bulb-conflict` class — indicating the fix at iter 2 corrupted the CDN init
- Build 471 (count-and-tap): level-progression spec at iter 3 fails on transition-slot; at iter 1 the failure was a different assertion

**Current rule coverage:**
- Lesson 35 (conditional beforeEach based on `hasTransitionSlot`) — SHIPPED
- Lesson 37 (post-processing always-apply overwrites conditional beforeEach) — SHIPPED fix

**Gap:**
The fix is correct for generation but the fix loop at iteration 2+ can corrupt CDN init in a way that removes the transition slot. This is NOT caught by T1 validation because T1 only runs at Step 1b (after initial gen), not after each fix iteration. The fix loop LLM runs without T1 re-check constraints.

**Fix needed:**
1. Run T1 static validation after each HTML fix iteration, not just after initial gen. If T1 finds a new error introduced by the fix, discard the fix and roll back (same as cross-batch regression guard logic).
2. OR: Add `#mathai-transition-slot` presence check to the T1 error checks for CDN games, then run T1 after fix.
3. Prompt rule for fix LLM: "DO NOT modify `ScreenLayout.inject()`, `waitForPackages`, or any CDN initialization code unless the failure is explicitly about CDN init."

---

## Pattern 2: Phase stuck at `playing` when game-over expected

**Frequency:** 11 occurrences across 7 builds, 5 games
**Builds:** 453 (memory-flip), 457 (count-and-tap), 463 (light-up), 471 (count-and-tap), 473 (light-up), 487 (one-digit-doubles), 514 (match-the-cards)
**Games:** memory-flip, count-and-tap, light-up, one-digit-doubles, match-the-cards
**Category:** game-flow / mechanics

**Root cause:**
`endGame()` is called and the postMessage is sent, but `gameState.phase` is never set to `'gameover'` (or `'game_over'` which normalizes to `'gameover'`). `waitForPhase(page, 'gameover')` then polls `#app[data-phase]` which remains `'playing'` until the 15s timeout expires. Two variants:

**Variant A — `endGame()` sends postMessage but skips phase assignment:**
Some generated HTML omits `gameState.phase = 'game_over'` from `endGame()` when it calls `endGame()` early (e.g., from a button click handler) without going through the full state machine. `syncDOMState()` then reads `gameState.phase = 'playing'` and writes that to `data-phase`.

**Variant B — Phase set to custom value not normalizable:**
Game uses a custom phase like `'gameOver'` (camelCase) or `'game-over'` (hyphenated) which is not in the `syncDOMState()` normalization map. The raw value is written directly to `data-phase` and `waitForPhase('gameover')` never matches.

**Evidence:**
- Build 514 (match-the-cards): `Expected: "gameover"` / `Received: "playing"` — textbook Variant A
- Build 487 (one-digit-doubles): same assertion on `#app`, `Expected: "gameover"` / `Received: "playing"`
- Build 457 (count-and-tap): `Expected: "gameover"` / `Received: "playing"` at game-flow iter 1 — fix loop ran 2 more iterations without resolving
- Build 503 (keep-track): `Expected: "guess"` / `Received: "reveal"` — Variant: wrong custom phase name

**Current rule coverage:**
- Lesson 50 (rule 22): syncDOMState() after every `gameState.phase =` assignment — SHIPPED
- Gen prompt rule 8: `gameState.phase` must be set at every state transition
- T1 check: `game_init` must set `gameState.phase = 'playing'`

**Gap:**
The current T1 check only validates that `game_init` handler sets `'playing'`. There is no T1 check verifying that `endGame()` sets `gameState.phase` before sending the postMessage. The gen prompt rule (lesson 50) applies to all assignments but LLMs inconsistently omit `syncDOMState()` after the gameover phase assignment specifically, or omit the assignment entirely.

**Fix needed:**
1. Add T1 error check: If `endGame` function is present AND `gameState.phase = '` appears in the file AND `syncDOMState()` is called somewhere, verify that `gameState.phase` is set to `'game_over'` or `'gameover'` WITHIN the `endGame` function body (not just somewhere in the file).
2. Strengthen gen prompt: Add explicit CRITICAL rule — "In `endGame()`, the FIRST line must be `gameState.phase = 'game_over'; syncDOMState();` — before any other logic, before postMessage."
3. This is the highest-leverage single gen prompt change: 7 builds across 5 games are affected.

---

## Pattern 3: `postMessage` returns null (game_complete not sent)

**Frequency:** 8 occurrences across 4 builds, 2 games (but structurally recurring)
**Builds:** 465 (keep-track), 479 (disappearing-numbers), 480 (disappearing-numbers), 509 (disappearing-numbers)
**Games:** keep-track, disappearing-numbers
**Category:** contract

**Root cause:**
The contract test calls `window.__ralph.getLastPostMessage()` expecting a non-null `game_complete` payload. The test returns `null`, meaning either:

**Sub-cause A — `endGame()` never called before the test asserts:**
The test triggers game-over conditions (exhaust lives), then immediately checks for the postMessage. If `endGame()` has an async delay before sending (e.g., a `setTimeout(() => sendPostMessage(), 500)`), the test assertion fires before the timeout resolves.

**Sub-cause B — `postMessage` is sent with wrong `type` field:**
The contract check filters by `type === 'game_complete'`. If the game sends `type: 'game_over'` or `type: 'gameComplete'`, the harness's `getLastPostMessage()` returns null because it only stores messages with `type === 'game_complete'`.

**Sub-cause C — `endGame()` is called but crashes before `postMessage`:**
An exception in `endGame()` (e.g., `TypeError: Cannot compute stars` when `gameState.levelTimes` is undefined) prevents the `window.parent.postMessage()` call from executing.

**Evidence:**
- Builds 480 and 509 (disappearing-numbers): same test, same error, iterations 2 and 3 — not fixed by fix loop across 2 separate builds, indicating structural issue
- Build 465 (keep-track): learning record shows `contract.spec.js Game complete postMessage contract — Error: not.toBeNull()` persists at iteration 3
- Build 484 (position-maximizer): `contract.spec.js Correct slot selection — Error: not.toBeNull()` — postMessage null on a mechanics-level call

**Current rule coverage:**
- Lesson 59 Root cause 3 and 4: `calcStars` game_over path + `duration_data`/`attempts` in metrics — SHIPPED for adjustment-strategy
- T2 contract validator checks postMessage structure

**Gap:**
T2 runs at Step 1b on initial HTML — it cannot catch runtime-conditional postMessage failures where `endGame()` crashes under specific game-state conditions. The fix loop sees `not.toBeNull()` but often fails to diagnose whether the cause is timing, type mismatch, or exception. The triage LLM needs explicit evidence of which sub-cause applies.

**Fix needed:**
1. Add `window.__ralph.getLastPostMessage()` to the DOM snapshot context (Step 2.5) by briefly triggering `endGame()` in the headless browser and capturing the result. This surfaces whether the game sends `null` structurally vs. only under specific conditions.
2. Gen prompt rule: "The `window.parent.postMessage()` call MUST be the LAST statement in `endGame()`, wrapped in a try-catch to prevent silent failure. Always use `type: 'game_complete'` exactly (not `'game_over'`, not `'gameComplete'`)."
3. Add T1 warning: flag `postMessage` calls where the `type` field is not the literal string `'game_complete'`.

---

## Pattern 4: Results/victory screen visibility wrong after endGame

**Frequency:** 6 occurrences across 5 builds, 3 games
**Builds:** 479 (disappearing-numbers), 480 (disappearing-numbers), 483 (keep-track), 503 (keep-track), 513 (associations)
**Games:** disappearing-numbers, keep-track, associations
**Category:** game-flow / edge-cases

**Root cause:**
After `endGame()` is called, the expected `#results-screen` (or equivalent results container) does not become visible. Tests assert `toBeVisible()` on the results screen after a winning or game-over condition, but the screen remains hidden.

Two variants observed:
**Variant A — Results screen DOM not shown:**
`endGame()` sends the postMessage but does not explicitly `show()` a results screen element. The game depends on the parent frame to handle the `game_complete` postMessage and navigate away, but in the test harness (no parent frame), the screen never changes.

**Variant B — Phase name mismatch blocks results display:**
The results screen shows only when `gameState.phase === 'results'`, but `endGame()` sets `'game_complete'` (which doesn't normalize to `'results'` in syncDOMState). The screen stays hidden.

**Evidence:**
- Build 479 (disappearing-numbers): `[game-flow.spec.js] Flow: Results to Restart — locator('#results-screen') Expected: visible / Received: hidden`
- Build 480 (disappearing-numbers): `[edge-cases.spec.js] Game over when lives reach zero — locator('#results-screen') Expected: visible / Received: hidden` — same game, different build, fix loop did not repair
- Build 503 (keep-track): `Victory screen on 5 correct rounds — toHaveAttribute Expected: "guess" / Received: "reveal"` — wrong phase at results time

**Current rule coverage:**
- Gen prompt rule 8: phase must be set at every transition
- Lesson 68: phase name normalization (game_complete → results) — SHIPPED

**Gap:**
The normalization in `extractPhaseNamesFromGame()` (Lesson 68) maps raw phase names in extracted test strings. But if `endGame()` uses `gameState.phase = 'game_complete'` and there's no entry in the syncDOMState normalization map for `'game_complete'` → `'results'`, the test harness writes `'game_complete'` to `data-phase` — which is not `'results'`. `waitForPhase(page, 'results')` then times out.

**Fix needed:**
1. Add `'game_complete'` → `'results'` to the `syncDOMState()` normalization map in the test harness template (in `injectTestHarness()` in `lib/pipeline.js`).
2. Gen prompt: "After `endGame()` is called, set `gameState.phase = 'results'` (NOT `'game_complete'`) if the game shows a results/victory screen in-game. The phase `'results'` is what the test harness uses for `waitForPhase(page, 'results')` checks."
3. T1 warning: flag `gameState.phase = 'game_complete'` — suggest using `'results'` instead.

---

## Pattern 5: CSS class state mismatch (toHaveClass / not.toHaveClass)

**Frequency:** 4 occurrences across 1 build, 1 game
**Builds:** 473 (light-up)
**Games:** light-up
**Category:** mechanics

**Root cause:**
Tests assert that a cell/element has (or does not have) a specific CSS class after a game action. Example: `expect(locator('#cell-0-0')).not.toHaveClass(/has-bulb/)` after removing a bulb, or `expect(locator('[id="cell-0-0"]')).toHaveClass(/bulb-conflict/)` after creating a conflict.

The failure occurs because:
- The game manages state in `gameState` (JS object) but applies CSS classes through a separate render function
- The render function is not called synchronously after the state change — it may use `requestAnimationFrame` or event-based triggering
- Tests assert the class immediately after the action, before the render cycle

**Evidence:**
- Build 473 (light-up) iter 2: `not.toHaveClass /has-bulb/` — bulb removal action completed but class persists
- Build 473 (light-up) iter 2 edge-cases: `toHaveClass /bulb-conflict/` — conflict state set but CSS class not applied

**Current rule coverage:**
- R6 rule: 10s timeout on toBeVisible() assertions after startGame() (Lesson 78)

**Gap:**
No existing rule or prompt guidance about synchronous class application after state changes. Test-gen LLM generates immediate assertions after actions without `waitFor` wrappers.

**Fix needed:**
1. Test-gen prompt rule: "After clicking a game element to trigger a state change, use `await page.waitForTimeout(100)` before asserting CSS class changes — render cycles may be asynchronous."
2. OR: Gen prompt rule for game HTML: "All CSS class updates derived from `gameState` changes must be applied synchronously in the event handler, before returning. Do not use requestAnimationFrame for class updates that tests need to observe."

---

## Pattern 6: `isProcessing` not reset, blocking rapid-click edge-case tests

**Frequency:** 1 occurrence across 1 build, 1 game (but structurally recurring per Lesson 59)
**Builds:** 511 (expression-completer)
**Games:** expression-completer
**Category:** mechanics / edge-cases

**Root cause:**
`isProcessing` flag is set to `true` at the start of answer processing to prevent double-submission. However, it is not reset after the processing completes (or is reset only after a timeout). When the edge-case test tries a "rapid double-click" scenario, `isProcessing = true` from the first click is never cleared, so the second click is correctly blocked. But the test then asserts that the element does NOT have a `processing` CSS class — which it still has because the reset never fired.

**Evidence:**
- Build 511 (expression-completer): `[edge-cases.spec.js] Edge Cases: Rapid double-clicks ignored via isProcessing — expect(locator('[data-testid="option-1"]')).not.toHaveClass(/expected/)`

**Note:** Lesson 59 Root cause 2 documented the exact same pattern for adjustment-strategy's `checkAnswer()`. This is cross-game recurring but only captured in 1 build in the analysis window.

**Current rule coverage:**
- Lesson 59: `isProcessing = false` must be reset before setTimeout in checkAnswer() — documented for adjustment-strategy

**Gap:**
The lesson is game-specific documentation, not a gen prompt rule. Other games can independently reintroduce this bug.

**Fix needed:**
1. Gen prompt rule (universal): "After `isProcessing = true` in any answer handler, ALWAYS reset it: place `gameState.isProcessing = false` in BOTH the success path AND the `finally` block (or after each await). Never leave `isProcessing = true` across game rounds."
2. T1 warning: if `isProcessing = true` appears but no `isProcessing = false` reset is found within the same function scope, warn.

---

## Cross-cutting Findings

### Finding A: Fix loop only helps for iteration-1 partial failures, not structural phase/contract bugs

Of 9 builds with `iterations >= 3`:
- 3 approved (33%): light-up #473, disappearing-numbers #480, keep-track #503
- 6 failed/needed more builds: adjustment-strategy (multiple), keep-track #483, position-maximizer #484, count-and-tap #471/440, disappearing-numbers #479

The 3 approved ones survived because the fix loop patched a narrow CSS/selector issue, not a structural bug. The 6 failures all had structural phase or init issues that the fix loop could not repair in 3 iterations. This confirms the `feedback_rnd_fix_loop_insight.md` finding: gen prompt quality is the only effective lever.

**Implication:** Patterns 1, 2, 3, and 4 above all require gen prompt fixes, not fix loop improvements.

### Finding B: Mechanics and game-flow categories have the most iteration-1 failures by volume

```
mechanics:      29 failures across 16 builds
game-flow:      26 failures across 18 builds
edge-cases:     18 failures across 16 builds
contract:       13 failures across 13 builds
level-progression: 12 failures across 10 builds
```

Mechanics and game-flow dominate because they test the most interactive behaviors (phase transitions, live counting, score updates) — the exact behaviors where the gen prompt rules are least specific and most often violated. Contract failures (13 across 13 builds = near-universal) suggest postMessage is structurally fragile by design.

### Finding C: `failure_patterns` table is dominated by adjustment-strategy `unknown` entries (19 occurrences)

The `failure_patterns` table has 19 rows for adjustment-strategy with `pattern='unknown'` and `category='unknown'`. These are useless for cross-game analysis. The table schema needs a fallback pattern extraction — when a build fails with `null` or empty `failures` field, the error_message from the builds table should be used as the pattern instead.

### Finding D: postMessage null is the one pattern the fix loop consistently fails to repair

Builds 480 and 509 (both disappearing-numbers) show the SAME `postMessage null` failure persisting across 3 iterations in both builds. This is 6 total fix iterations making zero progress on the same error. The fix LLM cannot repair postMessage contract failures from the test output alone — it needs to see why `endGame()` is not calling `postMessage()`. This is a triage context gap.

---

## Recommended Rule Additions

These are NEW rules not covered by existing M10-M15/GF3-GF8/CT3-CT7/EC1-EC6/LP4-LP6 categories:

### GF-NEW-1: `endGame()` must set phase AND syncDOMState before postMessage
```
In endGame(), the FIRST two lines must always be:
  gameState.phase = 'game_over';
  syncDOMState();
Then: calculate stars, build postMessage payload, call window.parent.postMessage().
NEVER set phase after postMessage — syncDOMState() must run before the test can assert the phase.
```
**Covers:** Pattern 2 (7 builds, 5 games)

### GF-NEW-2: Use `'results'` (not `'game_complete'`) for in-game results phase
```
If the game displays a results/victory screen within the HTML (not relying on parent-frame navigation),
use gameState.phase = 'results' for that state, NOT 'game_complete'.
The test harness maps 'results' → data-phase="results". 'game_complete' has no mapping.
```
**Covers:** Pattern 4 (5 builds, 3 games)

### CT-NEW-1: postMessage type must be exact string `'game_complete'`
```
window.parent.postMessage() MUST use type: 'game_complete' (exact, lowercase, underscore).
NEVER: 'game_over', 'gameComplete', 'GAME_COMPLETE', 'complete'.
The harness stores only messages with type === 'game_complete'; other types return null from getLastPostMessage().
```
**Covers:** Pattern 3 (sub-cause B)

### M-NEW-1: `isProcessing` must be reset in both success and error paths
```
When isProcessing = true is set in an answer handler:
- Reset it (isProcessing = false) BEFORE any setTimeout callback fires
- Reset it in both the success path and any catch/error path
- NEVER leave isProcessing = true across round transitions
```
**Covers:** Pattern 6 (recurring across games, documented for adjustment-strategy + expression-completer)

### INFRA-NEW-1: Run T1 after each fix iteration, not just after initial gen
```
This is a pipeline change, not a gen prompt rule.
After applying a fix LLM response, re-run runStaticValidation() before saving the HTML.
If T1 introduces NEW errors vs. the pre-fix HTML, discard the fix and try again (or skip and use rollback).
This prevents fix LLM from corrupting CDN init (Pattern 1).
```
**Covers:** Pattern 1 (8 builds, 5 games) — highest leverage infra change

---

## Recommended failure-patterns-tracker.md Updates

1. Add Pattern 2 (phase-gameover-not-set) as new Rank 5 active pattern — 7 builds, 5 games
2. Add Pattern 3 (postmessage-null structural) as sub-note under existing "postMessage" contract entry
3. Add Pattern 4 (results-screen-visibility) as new Rank 6 active pattern — 5 builds, 3 games
4. Add Pattern 1 infra fix (T1-after-fix) as new R&D recommendation #6
5. Note that `failure_patterns` table `unknown` entries are not useful — recommend fix to extract from builds.error_message as fallback
