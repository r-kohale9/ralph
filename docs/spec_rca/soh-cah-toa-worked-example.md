# RCA: soh-cah-toa-worked-example

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| 531 | game-flow 0/5, mechanics 0/3 iter 1; mechanics 3/3, LP 1/1, EC 2/2 iter 2; contract 0/2 | `startGame()` uses `setTimeout(0)` — TransitionScreen slot button never dismissed | FAILED |
| 535 | Rejected at early-review; also `initSentry() called before waitForPackages()` T1 error | LLM used `transitionScreen.show()` for end-game results instead of implementing `showResults()` to populate `#results-screen`; contract-fix LLM introduced sentry order violation | REJECTED (early-review) |

---

## 1. Root Cause

The generated `startGame()` function wraps ALL its initialization logic inside `setTimeout(() => {...}, 0)`. When the TransitionScreen CDN component's button is clicked, its `action` callback fires `startGame()` synchronously — but `startGame()` defers all DOM changes (including `show('game-screen')` and `syncDOMState()`) to the next event loop tick via `setTimeout`. The TransitionScreen CDN component detects that the action callback returned without completing any transition, keeps the slot rendered, and the `#mathai-transition-slot button` remains visible.

The test harness `startGame()` helper (in game-flow.spec.js) clicks the slot button, then loops checking `#mathai-transition-slot button` visibility for up to 8 seconds, and then asserts `not.toBeVisible({ timeout: 5000 })`. Since the CDN slot is never cleared (because the game's `startGame()` deferred everything), all 5 game-flow tests and 3 mechanics tests fail at the VERY FIRST STEP with:

```
Locator: locator('#mathai-transition-slot button')
Expected: not visible
Received: visible
9 × locator resolved to <button data-index="0" class="mathai-transition-btn primary">Let's go!</button>
```

This is a **gen prompt problem**: the LLM consistently generates `startGame()` with `setTimeout(0)` for this game type. Working games (e.g. doubles, build 208) implement `startGame()` synchronously — the CDN TransitionScreen auto-clears the slot only when the action callback completes synchronously.

Secondary issues in build 531 (not blocking approval if primary is fixed):
1. **contract 0/2**: `game over postMessage` test expected `data-phase="gameover"` but got `"results"` — `endGame('game-over')` sets `gameState.phase = 'gameover'` but `showResults()` does not explicitly re-sync DOM state after revealing `#results-screen`. This is a separate minor bug.
2. **T1 contract-fix error (false positive)**: `initSentry() called before waitForPackages()` — the static validator's positional heuristic fires incorrectly. The game correctly calls `await waitForPackages()` at line 746 and `initSentry()` at line 748. The validator finds the first `waitForPackages(` at the function *definition* (line 724) and concludes the `initSentry()` *call* (line 748) is later — this should NOT trigger. Investigate whether the fix loop's rewrite introduced a real ordering violation or if the heuristic is getting confused.
3. **T1 missing 480px constraint**: standard static validator check — minor cosmetic fix needed.

---

## 2. Evidence of Root Cause

**Test error (all 5 game-flow tests, all 3 mechanics tests, iteration 1):**
```
[game-flow.spec.js] start screen to example phase — Error: expect(locator).not.toBeVisible() failed
Locator: locator('#mathai-transition-slot button')
Expected: not visible
Received: visible
Timeout: 5000ms
9 × locator resolved to <button data-index="0" class="mathai-transition-btn primary">Let's go!</button>
```

**Generated HTML `startGame()` (build 531, line 328–365):**
```javascript
function startGame() {
    setTimeout(() => {     // ← ALL logic deferred; CDN slot never sees sync completion
        Object.assign(gameState, { ... phase: 'playing' });
        syncDOMState();
        show('game-screen');
        renderRound(0);
    }, 0);
}
```

**Working reference (doubles build 208, line 427–435):**
```javascript
function startGame() {
    // No setTimeout — synchronous; CDN slot clears immediately on button action return
    Object.assign(gameState, { ... });
    syncDOMState();
    setupRound();
}
```

**DOM snapshot (gameStateShape):** `subPhase: "string \"example\""` — `window.gameState` IS on window, `syncDOMState()` works, `data-phase` is set correctly when the game actually starts. The transition slot is the sole blocker.

**gameState.phase at snapshot time:** `"playing"` — the game DID reach `playing` phase during DOM snapshot capture (step 2.5 auto-clicked through). But the TEST's `startGame()` helper cannot get past the transition slot.

**Behavioral transcript:** Showed the game runs correctly when automation can auto-click through. The game logic itself (example → faded → practice sub-phases, `window.skipToPhase`, mechanics) is correct.

**contract test failure:**
```
data-phase: "results"    ← actual (after endGame('game-over'))
Expected: "gameover"
```
`endGame('game_over')` sets `gameState.phase = 'gameover'` and calls `syncDOMState()` — but `showResults()` is called after `syncDOMState()` and may re-render without triggering a second sync. Needs a `syncDOMState()` call in `showResults()` or after it.

---

## 3. POC Fix Verification (REQUIRED before E2E)

**Fix required in spec (gen prompt):** Add an explicit ANTI-PATTERN rule to the spec:

> CRITICAL RULE — DO NOT use `setTimeout` in `startGame()`: The `startGame()` function MUST be synchronous. Do NOT wrap its body in `setTimeout(() => {...}, 0)`. The TransitionScreen CDN component auto-dismisses the slot only when the `action` callback returns synchronously. If `startGame()` defers via `setTimeout`, the slot button remains visible and all game-flow tests fail at the first step.

Add to spec Section 8 (PART-026 anti-patterns) and to the function specification for `startGame()`.

**Fix required for contract test:** Add `syncDOMState()` call at the start of `showResults()` so `data-phase` reflects `gameover` before the results screen is rendered.

**POC verification without E2E:**

1. Download build 531 HTML: `curl -s https://storage.googleapis.com/mathai-temp-assets/games/soh-cah-toa-worked-example/builds/531/index.html -o /tmp/soh531.html`
2. Edit: remove `setTimeout(() => {` wrapper from `startGame()`, move its body directly into `startGame()`
3. Run `node diagnostic.js` locally — confirm `#mathai-transition-slot button` disappears after clicking, confirm `data-phase` reaches `playing`
4. Confirm the contract test: after `endGame('game-over')`, `data-phase` should read `gameover`

The local diagnostic run is required to confirm before queuing E2E.

**Fix applied for build #535 (gen prompt — upstream prevention):**

Two new rules added to `lib/prompts.js` ADDITIONAL GENERATION RULES section (lines 419–472):

- **RULE-RESULTS-1 (rule 28):** `showResults()` MUST populate `#results-screen` directly via `document.getElementById('results-screen').style.display = 'block'`. Explicitly bans `transitionScreen.show()` as a results display mechanism. BAD/GOOD code patterns included. Root cause cited as build #535.

- **RULE-SENTRY-ORDER (rule 29):** `initSentry()` MUST be called after `await waitForPackages()` resolves. BAD/GOOD patterns with `DOMContentLoaded` async body shown. Also expanded in CDN_CONSTRAINTS_BLOCK (line 112) with inline BAD/GOOD examples.

Both rules verified: `npm test` passes 745/745 tests with no failures.

---

## 4. Reliability Reasoning

**Is the fix deterministic?** Yes. Removing `setTimeout(0)` from `startGame()` makes CDN slot dismissal synchronous and deterministic. This pattern is confirmed correct in 10+ approved builds (doubles, right-triangle-area, etc.).

**What could cause regression?** If the LLM re-introduces `setTimeout` in a future gen. The spec must explicitly ban it with a named rule (e.g. RULE-NNN: NO setTimeout in startGame). Once named, it appears in the anti-pattern checklist and the LLM respects it.

**Secondary contract issue reliability:** The `syncDOMState()` after `showResults()` fix is also deterministic — `data-phase` is set from `gameState.phase` which is set to `'gameover'` before `showResults()` is called. One extra `syncDOMState()` call in `showResults()` will always produce `data-phase="gameover"`.

**Edge cases remaining unhandled:**
- The T1 validator heuristic for `initSentry` order may produce false positives in other games — this is a pipeline bug worth fixing separately (improve the heuristic to use `await waitForPackages()` position, not the function definition position).
- The 480px constraint is a cosmetic T1 rule — does not affect gameplay but blocks approval. Must be added to spec as a CSS requirement.

---

## 5. Go/No-Go for E2E

**Status: NOT READY FOR E2E**

**Blocking items (must complete before queuing):**

1. **Spec update required:** Add explicit anti-pattern rule banning `setTimeout` in `startGame()` (Section 8, PART-026, and function spec). Without this, the LLM will regenerate the same bug.

2. **Spec update required:** Add `syncDOMState()` call to `showResults()` spec for the gameover contract test.

3. **POC local verification required:** Run `node diagnostic.js` against the patched HTML (without `setTimeout(0)`) to confirm the transition slot clears on click.

4. **T1 validator heuristic:** The `initSentry` false positive may or may not re-appear in the next gen — worth checking but not blocking if the HTML structure is correct.

**Evidence of root cause:** COMPLETE (§2 above — exact error messages, line numbers, comparison with working game).

**POC verification:** NOT YET DONE — local diagnostic run with patched HTML is required.

Once spec is updated and local diagnostic confirms the fix, this game is READY FOR E2E.

---

## Manual Run Findings (browser screenshots, console, network)

Not yet run locally (diagnostic.js not executed for this build). Evidence above is from server-side test_results JSON and HTML source analysis. Local run is required to complete §3.

---

## Targeted Fix Summary

**What was tried:** Build 531 ran 2 iterations. Iteration 1: game-flow 0/5, mechanics 0/3. The global fix loop modified the HTML to fix the transition slot issue but regressed other tests. Iteration 2: mechanics 3/3, LP 1/1, EC 2/2 — but game-flow still 0/5. Build failed due to game-flow and contract failures.

**What failed:** The fix loop's global patch did not fix the root `setTimeout` in `startGame()` — it patched mechanics but left the primary transition slot blocker intact.

**What will work:** Update spec with explicit RULE banning `setTimeout` in `startGame()`, add `syncDOMState()` to `showResults()`, verify locally, then re-queue E2E.
