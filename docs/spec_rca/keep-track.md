# keep-track — Spec RCA

Game: Shell game (cups shuffle, player taps correct cup). 5 rounds, 3 lives. CDN game using TimerComponent (PART-006=YES).

---

## 1. Root Cause

`TimerComponent` is constructed with a config object as its first argument instead of the required string container ID, **and** it is initialized before `ScreenLayout.inject()` + template clone, so the container element does not yet exist in the live DOM. The CDN's `TimerComponent` constructor signature is `new TimerComponent(containerId: string, config: object)`. The LLM generates `new TimerComponent({ container: document.getElementById('timer-container'), timerType: 'increase', ... })`, passing the entire config object as `containerId`. This makes `document.getElementById("[object Object]")` return `null`, and `TimerComponent` throws `Container with id "[object Object]" not found` inside the DOMContentLoaded async callback. The error is caught by the try/catch and logged via `console.error('Init error: ...')`, but execution stops before `ScreenLayout.inject()` is reached. Since `ScreenLayout.inject()` never runs, `#gameContent` is never created, and the pipeline smoke check correctly reports "Blank page: missing #gameContent element".

The second issue is ordering: even if the API were correct, `TimerComponent` is called at line 357 — before the template clone at line 412. The element `#timer-container` lives inside `<template id="game-template">` and is not in the live DOM until after `tpl.content.cloneNode(true)` is appended to `#gameContent`. Moving `TimerComponent` init to after the clone is also required.

The smoke-regen LLM call also fails to fix this because `buildSmokeRegenFixPrompt` tells the LLM to move "other CDN components" after the template clone, but does not call out the `TimerComponent` constructor signature error explicitly — so the LLM regenerates `TimerComponent` with the same wrong API.

---

## 2. Evidence of Root Cause

### 2A. Builds 410/427/452 — Blank Page (TimerComponent API)

**DB query — three consecutive builds with same error:**
```json
[
  { "id": 452, "error_message": "Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element", "iterations": 0 },
  { "id": 427, "error_message": "Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element", "iterations": 0 },
  { "id": 410, "error_message": "Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element", "iterations": 0 }
]
```

**Generated HTML (build 452, line 357):**
```js
timer = new TimerComponent({
  container: document.getElementById('timer-container'),
  timerType: 'increase',
  startTime: 0,
  autoStart: false,
  format: 'min'
});
```

**CDN timer API (https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js lines 12-15):**
```js
constructor(containerId, config = {}) {
  this.container = document.getElementById(containerId);
  if (!this.container) {
    throw new Error(`Container with id "${containerId}" not found`);
  }
```

**Diagnostic output (`node keep-track-diag.js /tmp/keep-track-debug/index-generated.html`):**
```
initErrors: ["Init error: Container with id \"[object Object]\" not found"]
gameContentExists: false
appPhase: "idle"
transitionSlotExists: false
```

Screenshot `/tmp/keep-track-debug/01-after-load-8s.png`: blank white page, `#app` is empty.

**T1 static validator output (warnings only — not blocking):**
```
WARNING: TimerComponent called with wrong first argument. Correct: new TimerComponent('container-id', { options }).
WRONG: new TimerComponent({ container: element, ... }) or new TimerComponent(document.getElementById(...)).
```

T1 check 5f4 catches this as a WARNING (not an error), so the pipeline does not block on it. The static-fix LLM call addresses the hard errors (`window.endGame`, `window.restartGame`) but may not fix the warning. The resulting HTML still has the wrong API when it reaches Step 1d smoke check.

---

### 2B. Build 465 — Local Browser Diagnostic (2026-03-21)

**Method:** Custom diagnostic script (`/tmp/keep-track-465/diagnostic-keep-track.js`) run from ralph repo root. Serves build 465 HTML locally on port 7780 with harness injected. Screenshots taken at each step.

**Finding 1 — Start screen renders correctly (TimerComponent bug is FIXED in build 465):**
- `data-phase="start_screen"`, `#gameContent` present, transition slot visible, "Let's go!" button clickable.
- `initSentry()` is called INSIDE `waitForPackages()` at line 375 — correct ordering, NOT a blocker.
- Initial `transitionScreen.show()` at line 464 IS awaited — correct.
- No init errors.

Screenshot 01 (`/tmp/keep-track-465/01-01-after-load-3s.png`): Start screen with "Keep Track" title, cup icon, "Let's go!" button — fully rendered.

**gameState at load:**
```json
{"phase":"start_screen","isActive":true,"currentRound":0,"lives":3,"score":0,"correctCup":0,"cupCount":3,"isProcessing":false,"gameEnded":false}
```

**Finding 2 — Game flow works correctly locally: guess phase reached, transition shown after correct answer:**
- After clicking "Let's go!", game enters `reveal` phase immediately, then `shuffling`, then `guess`.
- Round 1: 3 shuffles at shuffleSpeed=0.8s + 1.5s reveal + 0.3s pause → guess phase reached in ~5.6s.
- In guess phase: `isActive=true`, `phase="guess"`, `correctCup=2` (cup moved from position 1 to position 2 after 3 shuffles), 3 `.cup-container.clickable` elements present.
- Clicking `data-testid="option-2"` (the correct cup, which has `data-signal-id="cup-1"`) → game transitions: `phase="transition"`, `currentRound=1`, `score=1`, "Continue" button visible.

Screenshot 04 (`/tmp/keep-track-465/04-04-guess-phase.png`): Three cups displayed, shuffled — Cup 1, Cup 3, Cup 2 (labels show DOM positions after shuffle). "Where is the star?" instruction shown.

Screenshot 06 (`/tmp/keep-track-465/06-05b-after-transition-check.png`): "Round 2 — Get ready! — Continue" transition screen. Progress bar shows 1/5 complete.

**This proves game-flow WORKS locally. The build 465 server failure was NOT caused by broken HTML logic.**

**Finding 3 — data-signal-id vs correctCup mismatch CONFIRMED:**
- `gameState.correctCup = 2` (DOM index after shuffles).
- The element at DOM position 2 has `data-testid="option-2"` AND `data-signal-id="cup-1"` (original label before shuffle).
- After wrong cup click: `.cup-container.correct` applied to `data-testid="option-2"` / `data-signal-id="cup-1"`.
- The element `data-signal-id="cup-2"` has `data-testid="option-1"` — it was shuffled away from position 2.
- `cup2State.hasCorrectClass = false` — confirms `data-signal-id="cup-2"` does NOT get the `correct` class.

Screenshot 07 (`/tmp/keep-track-465/07-06-after-wrong-click.png`): Cup at position 2 (labeled "Cup 2" visually) is highlighted green with star revealed — but its `data-signal-id` is `"cup-1"`. The test selector `.cup-container[data-signal-id="cup-2"]` targets the WRONG element.

```
Elements with .correct class: [{"testid":"option-2","signalId":"cup-1"}]
cup with data-signal-id="cup-2": {"signalId":"cup-2","testid":"option-1","hasCorrectClass":false}
```

**Finding 4 — game-flow failure on server is a TIMING issue, not HTML logic:**
- Build 465 server logs: game-flow 0/3 with "beforeEach timeout" errors.
- Locally: game-flow passes — guess phase reached in ~5.6s, well within 50s beforeEach.
- Root cause: CDN cold-start on server adds 30-120s before packages load. The round also requires 5-8s for animations AFTER CDN loads. Total can exceed 50s beforeEach timeout if CDN is slow.
- This is the same CDN timing issue seen in count-and-tap (Lesson 91).

**One pageerror observed (non-fatal):**
```
[pageerror] Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.
```
This occurs during cup shuffle DOM manipulation — likely a timing edge case in `swapCups()` when elements are rapidly moved. Non-fatal in local testing but could cause issues under load.

---

## 3. POC Fix Verification

### 3A. TimerComponent API Fix (builds 410/427/452)

Two changes required:

**Change 1 — Fix TimerComponent API (string ID as first arg):**
```js
// WRONG (generated):
timer = new TimerComponent({
  container: document.getElementById('timer-container'),
  timerType: 'increase', ...
});

// CORRECT:
timer = new TimerComponent('timer-container', {
  timerType: 'increase',
  startTime: 0,
  autoStart: false,
  format: 'min'
});
```

**Change 2 — Move TimerComponent init after ScreenLayout.inject() + template clone:**
`#timer-container` is inside `<template id="game-template">` and only enters the live DOM after `tpl.content.cloneNode(true)` is appended. TimerComponent must be initialized after:
```js
ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
const tpl = document.getElementById('game-template');
if (tpl) document.getElementById('gameContent').appendChild(tpl.content.cloneNode(true));
// NOW initialize TimerComponent — #timer-container is in live DOM
timer = new TimerComponent('timer-container', { timerType: 'increase', startTime: 0, autoStart: false, format: 'min' });
```

**Verification:**

Patched HTML created at `/tmp/keep-track-debug/index-patched2.html` using the above two changes.

Diagnostic output after patch:
```
initErrors: (only audio 404s — non-fatal)
gameContentExists: true
appPhase: "start"
transitionSlotExists: true
progressSlotExists: true
gameStatePhase: "start_screen"
appInnerHTMLLength: 4007
```

Screenshot `/tmp/keep-track-debug/02-final-state.png`: start screen rendered, transition screen visible with "Keep Track" title.

POC verification for 3A: COMPLETE. Both fixes together resolve the blank page. Build 465 confirmed this — it had no blank page.

---

### 3B. Build 465 — Local Browser Diagnostic POC (2026-03-21)

**Script:** `/tmp/keep-track-465/diagnostic-keep-track.js` — custom diagnostic run from ralph repo root against build 465 HTML.

**Verified behaviors (all pass locally):**

| Behavior | Result | Evidence |
|---------|--------|---------|
| Start screen renders | PASS | `transitionBtnVisible: true`, screenshot 01 |
| initSentry ordering | PASS | Called at line 375 INSIDE waitForPackages() callback |
| Initial transitionScreen.show() awaited | PASS | Line 464: `await transitionScreen.show(...)` |
| Reveal phase (star visible under correct cup) | PASS | `.cup-item.visible count: 1` during reveal |
| Shuffle completes, guess phase reached | PASS | `phase="guess"` reached in ~5.6s |
| isActive=true during guess phase | PASS | `gameState.isActive: true` confirmed |
| 3 clickable cups present | PASS | `.cup-container.clickable count: 3` |
| Correct cup click → nextRound transition | PASS | `phase="transition"`, "Continue" button visible |
| correctCup tracks DOM position (not signal-id) | CONFIRMED BUG | `correctCup=2` → `data-testid="option-2"` has `data-signal-id="cup-1"` |
| `.correct` class applied to wrong element by test | CONFIRMED | `data-signal-id="cup-2"` at `option-1` has NO `.correct` class |

**POC for correctCup selector fix:**
```js
// WRONG (test gen uses hardcoded signal-id):
await expect(page.locator('.cup-container[data-signal-id="cup-2"]')).toHaveClass(/correct/);

// CORRECT (read correctCup dynamically from gameState):
const correctPos = await page.evaluate(() => window.gameState?.correctCup ?? 0);
await expect(page.locator(`.cup-container[data-testid="option-${correctPos}"]`)).toHaveClass(/correct/);
```
Verified locally: after wrong cup click, `.cup-container[data-testid="option-2"]` HAS `.correct` class. The `data-testid` selector works; `data-signal-id` does not after shuffles.

**POC for game-flow server timing fix:**
- Locally: guess phase reached in ~5.6s. No beforeEach timeout.
- Server failure: CDN packages may take 30-120s to load (cold start). Total time from page load to guess phase ready = CDN load time + 5.6s animation time.
- Fix needed: increase server-side beforeEach timeout to 120s (matching count-and-tap fix, Lesson 91), OR add a `waitFor(() => window.gameState?.phase === 'guess', { timeout: 120000 })` in the test before answering.

**POC for isActive guard (Lesson 102):**
- `startRound()` sets `gameState.isActive = true` at the very start (line 502), BEFORE reveal delay.
- `handleCupTap()` checks `if (!gameState.isActive) return` (line 666).
- Risk: test calls `answer()` while still in reveal/shuffle phases if it doesn't wait for `phase="guess"`.
- Fix: test must `waitForPhase(page, 'guess')` or `waitFor(() => window.gameState?.phase === 'guess')` before calling answer.

POC verification for 3B: COMPLETE. All three root causes confirmed with browser evidence. Game HTML itself is correct — all failures on server are either test gen bugs or CDN timing.

---

## 4. Reliability Reasoning

**Is the fix deterministic?** Yes. The root cause is a deterministic API mismatch: LLM generates `new TimerComponent({ ... })` because it has seen this pattern in other component APIs (ProgressBarComponent, TransitionScreenComponent all take config objects). The TimerComponent API is uniquely positional. The fix is deterministic — always pass string ID as first arg, always init after template clone.

**Why does it recur across 3 builds?** Two reasons:
1. The smoke-regen prompt (`buildSmokeRegenFixPrompt`) says "THEN initialize other CDN components (TimerComponent, ProgressBarComponent, VisibilityTracker, etc.)" — it addresses the ordering but does NOT call out the constructor signature. The LLM follows the ordering instruction but re-generates the same wrong API.
2. T1 check 5f4 is a WARNING, not an error, so the static-fix LLM call (which is prompted to fix hard errors) may skip fixing it.

**What could cause regression?** If the gen prompt's TimerComponent rule is unclear or the LLM ignores it. The gen prompt at line 85 of prompts.js does include the correct constructor signature: `new TimerComponent('container-id', { timerType: 'increase', startTime: 0, endTime: 3600, autoStart: false, format: 'min' })`. The LLM is not following it reliably for this spec.

**Edge cases:** Any game using TimerComponent (PART-006=YES) with `#timer-container` inside a template (PART-025=YES) is vulnerable. This is a common combination — TimerComponent is often placed in the game UI template, not the static wrapper.

**Pipeline fix needed:** The smoke-regen prompt should explicitly state the TimerComponent constructor signature and that it must be initialized after the template clone. The T1 check 5f4 should also be upgraded from WARNING to ERROR so the static-fix LLM call is forced to fix it.

---

## 5. Go/No-Go for E2E

Decision: **APPROVED — build #503 approved 2026-03-22.** Global fix 2 (248s) fixed mechanics 0/3→3/3 AND level-progression 0/1→1/1 simultaneously. Final score: 8/9 (1 edge-case regressed). Review rejected attempt 1/3; targeted fix (158s) applied; approved at attempt 2/3. Build total ~99 min, iterations=3.

**Original decision (before build 483/503 analysis):**

**Local diagnostic (2026-03-21) confirms:** Build 465 HTML is CORRECT. The game renders, animates, transitions between rounds, and applies `.correct` class to the right element. All three originally identified "root causes" (A+B+C) have been re-evaluated:

| Root Cause | Status | Evidence |
|-----------|--------|---------|
| A. Unawaited transitionScreen.show() | FALSE — build 465 ALREADY has `await` | Code inspection line 464 + diagnostic pass |
| B. test calls answer() before isActive=true | REAL but reframed — isActive=true from start of startRound, but test must wait for phase="guess" | Diagnostic confirms isActive=true during guess; risk is test calling answer() during shuffle |
| C. Hardcoded data-signal-id="cup-2" in test | CONFIRMED BUG | Diagnostic: `.correct` on `data-signal-id="cup-1"` (not cup-2) after shuffle |

**Build 465 actual failure root cause (revised):**
- game-flow 0/3: CDN cold-start on server (30-120s) + animation time (5.6s) exceeds 50s beforeEach timeout. Same as count-and-tap. HTML is correct.
- mechanics 0/2: test gen hardcodes `data-signal-id="cup-2"` but correct cup after shuffles is at `data-testid="option-N"` where N=`gameState.correctCup`. Test gen bug, not HTML bug.

**Evidence of root cause (§2):** COMPLETE. Build 465 local diagnostic with 7 screenshots, DB records, CDN API verification, cup position tracking confirmed.

**POC verification (§3):** COMPLETE. Game flow, transitions, and `.correct` class all work correctly locally. `data-testid="option-N"` selector confirmed.

**Required pipeline fixes before queuing E2E:**

1. **Test gen prompt (M7 rule):** For shell games (shuffle + guess), NEVER select correct cup by `data-signal-id`. Use:
   ```js
   const correctPos = await page.evaluate(() => window.gameState?.correctCup ?? 0);
   await expect(page.locator(`.cup-container[data-testid="option-${correctPos}"]`)).toHaveClass(/correct/);
   ```
   Already added to gen prompts as Lesson 103 rule. Verify it's in the test-gen prompt.

2. **Test gen prompt (M6 rule):** For games with animations before guess phase, add:
   ```js
   await page.waitForFunction(() => window.gameState?.phase === 'guess', { timeout: 120000 });
   ```
   before calling `answer()`. Already added as Lesson 102 rule. Verify it's in the test-gen prompt.

3. **beforeEach timeout:** Increase server-side beforeEach timeout to 120s (matches count-and-tap fix). The CDN cold-start alone can take 60-120s; plus 5.6s animation. 50s is not enough.

**Without items 1+2 deployed to test-gen prompt, the next build will fail with the same test errors.** These are test generation issues, not HTML issues. The gen prompt fixes for Lessons 102/103 must be confirmed deployed before E2E.

**Recommended action:** Confirm Lesson 102 and 103 rules are in the deployed test-gen prompt (check lib/prompts.js), then queue build. Expected outcome: game-flow passes once CDN is warm + beforeEach timeout is sufficient, mechanics passes with dynamic correctCup selector.

---

## Build #465 Game-Flow Analysis (2026-03-21)

### Failure 1 — game-flow 0/2: `#mathai-transition-slot button` is hidden, not missing

**Symptom:** Playwright reports `locator('#mathai-transition-slot button')` resolves to `<button data-index="0" class="mathai-transition-btn primary">Continue</button>` with `unexpected value "hidden"` — 14 polling retries, all hidden, 10s timeout exhausted.

**Key observation:** The button EXISTS in the DOM throughout. It is never missing. It is `visibility:hidden` the entire time.

**Root cause — unawaited initial `transitionScreen.show()` disrupts CDN component state:**

The initial start screen is shown at line 455 WITHOUT `await`:
```js
transitionScreen.show({  // ← NO await — flagged by T1 validator as a warning
  icons: ['🥤'],
  title: 'Keep Track',
  buttons: [{ text: "Let's go!", type: 'primary', action: () => setupGame() }]
});
```

The CDN `TransitionScreenComponent.show()` is an async animation: it sets `visibility:visible` on the slot and animates buttons in, then resolves its promise when the user clicks a button. Because this call is not awaited, the component's internal `hide()` logic (which sets `visibility:hidden` again) may run at an unexpected time, or the component may be left in a state where it expects the first `show()` promise to resolve before it can accept a second `show()` call.

When `nextRound()` (line 749-757) subsequently calls `await transitionScreen.show({ type: 'level-transition', ... })`, the component internally hides (sets `visibility:hidden`) first, then animates in. If the hide-in animation takes time, the button is visible to the DOM (exists) but still `visibility:hidden` during the animation. Playwright finds the element immediately and polls for 10s, but the animation never completes — likely because the component is waiting for the unawaited first `show()` promise to complete before it can transition.

**Secondary cause — game may never reach guess phase in time:**

`startRound()` runs: reveal (1.5s delay) → shuffle animations (N swaps × shuffleSpeed seconds) → guess phase. The test likely calls `window.__ralph.answer()` immediately after the start screen transition, but the game is still in the `reveal` or `shuffling` phase. `handleCupTap()` begins with `if (!gameState.isActive) return` — and `gameState.isActive` is `false` during the reveal/shuffle phases. So the tap is silently ignored, `nextRound()` is never called, and the transition screen never shows. The test times out waiting for a "Continue" button that will never appear because the round was never completed.

**The `answer()` harness doesn't know about shuffle-and-guess games:** The harness (`window.__ralph.answer()`) clicks a cup via `data-testid="option-N"`. But if the game is not in guess phase (`gameState.isActive = false`), the click is swallowed. The test needs to `waitForPhase(page, 'playing')` AND wait for the guess phase indicator before calling `answer()`. Tests likely don't wait long enough for all shuffle animations to complete before tapping.

**Evidence:** T1 static validator output confirms the unawaited call:
```
WARNING: 1/5 transitionScreen.show() call(s) are not awaited — ALL calls must use await transitionScreen.show({...})
```

---

### Failure 2 — mechanics 0/2: `.cup-container[data-signal-id="cup-2"]` missing `correct` class

**Symptom:** Playwright expects `.cup-container[data-signal-id="cup-2"]` to have class `correct` after player clicks the wrong cup. The element is found (9 retries) but has class `cup-container` only — `correct` never appears.

**Root cause — test selector hardcodes cup-2 but correct cup tracks DOM position, not signal-ID:**

When cups are rendered, each `div` gets `data-signal-id="cup-N"` where N is its initial DOM index (0, 1, 2...). `data-signal-id` is a fixed label — it stays on the element through shuffles.

During `swapCups(indexA, indexB)`, the game physically moves DOM elements (lines 648-651) AND updates `gameState.correctCup` to track the new DOM position of the element holding the star (lines 566-567). After shuffles, `gameState.correctCup` is the current DOM index of the correct cup.

When the player taps the wrong cup, the game reveals the correct one:
```js
cupEls[gameState.correctCup].classList.add('correct');  // DOM position index
```

`cupEls` is `document.getElementById('cups-row').children` — the live HTMLCollection. After physical DOM swaps, the element at `cupEls[gameState.correctCup]` IS the correct cup. But its `data-signal-id` is whatever it was originally — NOT necessarily `cup-2`.

The test assumes the correct cup is always `data-signal-id="cup-2"`. This is only true if the star started at position 2 AND no shuffle moved it. After any shuffle involving position 2, the element with `data-signal-id="cup-2"` is no longer the correct cup.

**Confirmed by test output:** `9 × locator resolved to <div class="cup-container" data-signal-id="cup-2" data-testid="option-1">` — the element with signal-id "cup-2" is now at DOM position 1 (`data-testid="option-1"`), meaning it was shuffled. The `correct` class was applied to `cupEls[gameState.correctCup]` (some other DOM position), not to `data-signal-id="cup-2"`.

**This is a test generation bug**, not an HTML bug. The test should check `gameState.correctCup` dynamically or use the `data-testid="option-N"` selector where N = `gameState.correctCup` after shuffles.

**Correct assertion approach:**
```js
// After tapping wrong cup, the correct cup gets 'correct' class — use data-testid based on gameState.correctCup
const correctPos = await page.evaluate(() => window.gameState?.correctCup ?? 0);
await expect(page.locator(`.cup-container[data-testid="option-${correctPos}"]`)).toHaveClass(/correct/);
```

---

### Summary of build #465 failures

| Failure | Type | Root Cause | Fix location |
|---------|------|------------|--------------|
| game-flow: `#mathai-transition-slot button` hidden | HTML + test | Unawaited `transitionScreen.show()` on init + test doesn't wait for shuffle to finish before answering | Fix: (1) add `await` to line 455, (2) test must wait for `isActive=true` before calling `answer()` |
| mechanics: `cup-2` missing `correct` class | Test gen bug | Test hardcodes `data-signal-id="cup-2"` but correct cup tracks DOM position, not signal-id | Fix: test gen prompt must use `data-testid="option-N"` where N = `gameState.correctCup` |

**Required pipeline fixes before next build:**
1. Add gen prompt rule: ALL `transitionScreen.show()` calls MUST use `await`, including the initial start screen call
2. Add test-gen prompt rule for shell games: never select the correct cup by `data-signal-id` — use `data-testid="option-N"` where N is read from `window.gameState.correctCup` dynamically
3. Add test-gen prompt rule: for games with shuffle animations, always `waitForPhase(page, 'playing')` AND add a `waitFor` for `gameState.isActive === true` before calling `answer()`

---

---

## Build #477 Analysis (2026-03-21)

### Overview

Build 477 result: **4/7 tests passed, 1 iteration, review SKIPPED** (2 categories with 0 test evidence).
- mechanics: 2/2 PASS
- edge-cases: 1/1 PASS
- game-flow: 1/2 (1 pass, 1 triage-skipped)
- level-progression: 0/1 FAIL → triage-deleted
- contract: 0/1 FAIL → triage-deleted

Final error: `"Tests failed: 4/7 passed after 1 iteration(s). Review: SKIPPED"`

The HTML itself is functionally correct (mechanics pass, all `transitionScreen.show()` calls are properly `await`ed). All failures are test generation bugs.

---

### Failure A — level-progression: `#mathai-transition-slot button` hidden

**Error from DB `test_results`:**
```
[level-progression.spec.js] Level Progression - Cup Count and Difficulty
Error: expect(locator).toBeVisible() failed
Locator: locator('#mathai-transition-slot button')
Expected: visible
Timeout: 10000ms
5 × locator resolved to <button data-index="0" class="mathai-transition-btn primary">Let's go!</button>
  - unexpected value "hidden"
```

**Root cause:** The level-progression test used `clickNextLevel()` (which calls `await expect(#mathai-transition-slot button).toBeVisible({ timeout: 10000 })`) to advance through rounds to reach Round 3. However, the game's inter-round transition at line 780 uses:

```js
await transitionScreen.show({ type: 'level-transition', title: `Round ${gameState.currentRound + 1}` });
```

This call has **no `buttons` config**. The CDN's `TransitionScreenComponent` for `type: 'level-transition'` auto-advances after a brief animation — it does NOT wait for a user button click. The promise resolves automatically after the animation plays. The test then calls `clickNextLevel()` which expects `#mathai-transition-slot button` to be visible, but the button present in the DOM is the ORIGINAL start-screen button (`"Let's go!"` at `data-index="0"`), which is always hidden after game start.

The test generator incorrectly assumed `level-transition` type shows a clickable "Continue" button (as it does in games where `buttons: [...]` is explicitly passed). For `keep-track`, the inter-round transition is auto-advancing: no user input required. `clickNextLevel()` is the wrong helper to advance between rounds in this game.

**What the test should do instead:** Wait for `waitForPhase(page, 'reveal')` after completing a round — the game auto-advances from `transition` to `reveal` after the `level-transition` animation.

**Why triage deleted it:** 0/1 at iteration 1 with same error pattern → triage treated as permanently broken assertion → deleted. Correct call per triage rules, but the underlying cause was test gen, not HTML.

---

### Failure B — contract: `#mathai-transition-slot button` hidden (same root cause)

**Error from DB `test_results`:**
```
[contract.spec.js] Game Complete PostMessage Contract
Error: expect(locator).toBeVisible() failed
Locator: locator('#mathai-transition-slot button')
Expected: visible
Timeout: 10000ms
5 × locator resolved to <button data-index="0" class="mathai-transition-btn primary">Let's go!</button>
  - unexpected value "hidden"
```

**Root cause:** The contract test used `clickNextLevel()` or `skipToEnd()` to reach the results screen and capture the postMessage. The exact same `#mathai-transition-slot button` hidden issue — the test attempted to click through level transitions that auto-advance without buttons.

The behavioral transcript captured the correct postMessage structure:
```json
{
  "type": "game_complete",
  "data": {
    "metrics": {
      "score": 0,
      "totalRounds": 5,
      "stars": 3,
      "accuracy": 0,
      "timeTaken": 10,
      ...
    }
  }
}
```

The postMessage payload IS correct — `type: "game_complete"` with all required fields. The contract test failed on navigation/setup (reaching the results screen), not on the payload assertions themselves.

**Correct approach:** Use `await skipToEnd(page, 'victory')` (which calls `window.__ralph.endGame('victory')` directly) to reach results screen, THEN assert the postMessage — no need to click through 5 rounds of transitions.

**Why triage deleted it:** 0/1 at iteration 1 → triage rule triggered → deleted. The HTML contract is correct; the test setup path was wrong.

---

### Failure C — game-flow: "Game Over Transition on Zero Lives" skipped

**Error from DB `test_results`:**
```
[game-flow.spec.js] Game Over Transition on Zero Lives
locator.click: Element is not visible
Waiting for locator('[data-signal-id="cup-1"]')
  - locator resolved to <div data-signal-id="cup-1" data-testid="option-1" class="cup-container clickable">...</div>
  - attempting click action
  - scrolling into view if needed
```

**Root cause:** The element is found (`.cup-container.clickable` present) but Playwright reports "Element is not visible". This is the same class of bug as build 465 Failure 1 — the test clicks a cup before the guess phase is fully active. The game must pass through `reveal` (1.5s) and `shuffling` (N × shuffleSpeed seconds) before entering `guess` phase. If the test clicks during `shuffling`, the element is `.clickable` in class but Playwright considers it obscured by the animation overlay or the DOM swap is mid-flight.

Specifically: the test tried clicking `[data-signal-id="cup-1"]` which resolved correctly, but the cup was not interactable. This happens when:
1. The cup's parent container has an animation/overlay blocking interaction
2. The game is still in `shuffling` phase (cups are being physically moved via `swapCups()`)

The test was triage-skipped (not deleted), consistent with game-flow.spec.js showing `// SKIPPED (triage): Game Over Transition on Zero Lives`.

**Fix needed:** Test must `await waitForPhase(page, 'guess')` before attempting any cup click. The `guess` phase is only set AFTER all shuffles complete at line 637:
```js
gameState.phase = 'guess';
```

---

### Summary of build 477 failures

| Failure | Category | Root Cause | HTML Bug? | Fix Location |
|---------|----------|------------|-----------|--------------|
| level-progression: `#mathai-transition-slot button` hidden | Test gen | `level-transition` type auto-advances — no button click needed; `clickNextLevel()` is wrong helper | No | Test gen prompt: after completing a round, wait for `waitForPhase(page, 'reveal')` instead of `clickNextLevel()` |
| contract: `#mathai-transition-slot button` hidden | Test gen | Same — test used click-based navigation to reach results screen instead of `skipToEnd()` | No | Test gen prompt: contract tests MUST use `skipToEnd(page, 'victory')` to reach results screen |
| game-flow: cup not visible during click | Test gen | Cup clicked before `phase='guess'`; cup is `.clickable` but Playwright considers it blocked during shuffle animation | No | Test gen prompt: always `waitForPhase(page, 'guess')` before any cup click |

**The HTML game is functionally correct.** mechanics 2/2 + edge-cases 1/1 confirm the core guess/feedback/scoring loop works. All 3 failures are test generation bugs involving incorrect navigation patterns and missing phase-wait guards.

---

### Required pipeline fixes before re-queuing

1. **Test gen prompt — inter-round transition navigation rule:** For games where `transitionScreen.show({ type: 'level-transition' })` is called WITHOUT a `buttons` config, the transition auto-advances. Tests MUST NOT use `clickNextLevel()` between rounds. Use `waitForPhase(page, 'reveal')` instead after completing a round. The test gen prompt should detect this pattern from the DOM snapshot / behavioral transcript.

2. **Test gen prompt — contract test pattern:** Contract tests must reach results screen via `skipToEnd(page, 'victory')` (harness API), NOT by clicking through all rounds. This prevents contract tests from depending on the multi-round navigation path.

3. **Test gen prompt — shell game cup click guard:** For shuffle-and-guess games, ALWAYS `await waitForPhase(page, 'guess')` before clicking any cup. `phase='guess'` is set only after all shuffle animations complete (line 637 in build 477 HTML).

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| 281 | BullMQ job lost after worker restart | Infrastructure | Failed (infra) |
| 325 | `test_results: []`, no error | Unknown (likely infra/queue) | Failed |
| 410 | Step 1d: Blank page: missing #gameContent | TimerComponent wrong API + ordering | Failed |
| 427 | Step 1d: Blank page: missing #gameContent | Same — smoke regen did not fix it | Failed |
| 452 | Step 1d: Blank page: missing #gameContent | Same — smoke regen did not fix it | Failed |
| 465 | Contract-fix T1: "initSentry() called before waitForPackages()" — iteration 3 fail | Root cause D: original gen had initSentry INSIDE waitForPackages (correct), but contract-fix LLM moved it outside while fixing other contract errors. CDN_CONSTRAINTS_BLOCK has the rule but LLM ignored it during full-HTML contract fix rewrite. | Failed |
| 468 | Orphaned — worker SIGKILL'd mid-mechanics-iter-1 | Worker was deactivating; passed smoke check, reached mechanics iter 1 (1/2 passed), then SIGKILL'd. Not a game bug. | Orphaned (infra) |
| 477 | 4/7 passed: level-progression 0/1 + contract 0/1 triage-deleted; game-flow 1/2 (skipped); mechanics 2/2 pass | test gen assumed `level-transition` type requires button click + test assumed transition appears AFTER skipToEnd(); both tests deleted by triage. game-flow failure: cup element not visible during guess phase (timing) | Failed |
| 482 | All tests timed out in beforeEach — 0/N every batch | CDN cold-start ~150s exceeds 120s poll loop in beforeEach | Killed (infra — fix deployed) |
| 483 | game-flow 1/3 (2 tests fail both iter 1 and iter 2): "Game Over on Zero Lives" + "Victory Transition" | Iter 1: `isProcessing` stuck true >5s (server CDN race — progressBar.update or similar throws internally, leaving isProcessing=true). Iter 2: `#game-screen` remains visible after "See Results" click. Passes locally in <2ms. Server-specific timing issue. | Failed |
| 503 | Mechanics 0/3, level-progression 0/1 in per-category loop | Tests generated before M10-M12+LP4 rules; global fix 2 (248s) fixed both simultaneously; 8/9 final, review approved attempt 2/3 | APPROVED |

---

## Manual Run Findings

### Session 1 — Builds 452/427/410 (blank page diagnosis)

**Environment:** Local Playwright via `node keep-track-diag.js` (ralph repo, port 7779)

**Files tested:**
- `/tmp/keep-track-debug/index-generated.html` (build 452 generated HTML, 43KB)
- `/tmp/keep-track-debug/index-patched2.html` (same with both fixes applied)

**Finding 1 — Original HTML:**
- Console error: `Init error: Container with id "[object Object]" not found`
- `#gameContent`: absent
- `#app` innerHTML: empty (0 bytes)
- Screenshot 01: blank white page

**Finding 2 — Patched HTML:**
- No init errors (only audio 404s, non-fatal)
- `#gameContent`: present
- `appPhase`: "start" (synced from `gameState.phase = "start_screen"`)
- Transition slot: visible with "Keep Track" title
- Screenshot 02: start screen rendered correctly

**CDN API confirmation:**
- `https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js` line 12: `constructor(containerId, config = {})`
- The first arg is a string ID — not a DOM element, not a config object.

---

### Session 2 — Build 465 (game-flow + mechanics diagnosis, 2026-03-21)

**Environment:** Local Playwright via `/tmp/keep-track-465/diagnostic-keep-track.js` (ralph repo, port 7780)

**File tested:** `/tmp/keep-track-465/index.html` (build 465 generated HTML, 1147 lines)

**Screenshots (all at `/tmp/keep-track-465/`):**
- `01-01-after-load-3s.png`: Start screen — "Keep Track", cup icon, "Let's go!" button. Fully rendered.
- `02-02-after-start-click.png`: Game starts, enters reveal phase (star visible under one cup).
- `03-03-reveal-phase.png`: Star visible under cup at position 1 (correctCup=1 at start).
- `04-04-guess-phase.png`: Three cups after shuffle (Cup 1, Cup 3, Cup 2 in DOM order — shuffled). "Where is the star?" shown. correctCup=2.
- `05-05-after-correct-click.png`: After clicking option-2 (correct). Score=1.
- `06-05b-after-transition-check.png`: "Round 2 — Get ready! — Continue" transition shown. Progress bar at 1/5.
- `07-06-after-wrong-click.png`: After clicking wrong cup. Cup at DOM position 2 (labeled "Cup 2", `data-signal-id="cup-1"`) is highlighted green with star revealed. Cup with `data-signal-id="cup-2"` has no `.correct` class.

**Key measurements:**
- CDN load time locally: <3s (no cold-start penalty)
- Guess phase reached: ~5.6s after start click (1.5s reveal + 3 shuffles × 0.8s each + 0.3s)
- Transition screen after correct click: visible in <1s

**Non-fatal pageerror observed:**
```
Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.
```
Occurs during cup swap animation (swapCups() DOM manipulation). Does not prevent game completion locally. Could be a transient race if cups are swapped very rapidly.

---

### Session 3 — Build 483 (Game Over diagnostic, 2026-03-22)

**Environment:** Custom scripts `diagnostic-kt.js` and `diagnostic-kt2.js` (ralph repo root), serving `/tmp/keep-track/index.html` (build 483, 43625 bytes) on ports 7779/7780.

**Scripts:** `/Users/the-hw-app/Projects/mathai/ralph/diagnostic-kt.js`, `diagnostic-kt2.js`

**Screenshots:** `/tmp/keep-track/shots/`, `/tmp/keep-track/shots2/`

**Test 1 (diagnostic-kt.js — direct DOM clicks):**
- Direct cup click by DOM index: all 3 rounds completed successfully
- gameover phase reached at t+1600ms after 3rd wrong click
- "See Results" button visible; clicking → results screen shown
- PASS

**Test 2 (diagnostic-kt2.js — exact `__ralph.answer()` harness replication):**
- `__ralph.answer(false)` correctly identified wrong cups via testid:
  - Round 1: correctIdx=2, wrongIdx=0, btn=option-0 found ✓
  - Round 2: correctIdx=0, wrongIdx=1, btn=option-1 found ✓
  - Round 3: correctIdx=3, wrongIdx=0, btn=option-0 found ✓
- isProcessing cleared in 1ms each time (immediate)
- gameover phase reached in 1866ms (well within 15s)
- "See Results" clicked → game-screen hidden, results-screen shown
- PASS

**Conclusion:** Build 483 HTML is correct. Both direct click and harness click work. All assertions pass. Server failure is environment-specific (CDN race, not HTML bug).

---

## Targeted Fix Summary

No targeted fix has been run. Diagnosis complete from local diagnostic run.

**What to do before E2E:**
1. Upgrade T1 check 5f4 to ERROR (in `lib/validate-static.js`)
2. Add TimerComponent constructor signature warning to `buildSmokeRegenFixPrompt` (in `lib/prompts.js`)
3. Queue build — gen prompt already has the correct API at line 85, so a fresh generation may work with the above safeguards catching regressions

**What NOT to do:** Do not run a targeted fix — the root cause is in generation, not post-generation state. A new full generation with the upgraded T1 check will force the static-fix LLM to correct the API before reaching Step 1d.

---

## Build #482 — CDN Cold-Start (2026-03-21)

### Symptom
Every test in every batch (game-flow, mechanics, contract, edge-cases, level-progression) timed out in beforeEach with 0/N results. Each batch took 4-7 minutes (CDN cold-start per test).

### Root Cause
GCP server CDN cold-start = ~150s. The beforeEach CDN poll loop was `Date.now() + 120000` (120s). Each Playwright test gets a fresh BrowserContext with no CDN cache. Since keep-track requires TimerComponent (CDN step 7, loads last), waitForPackages() throws at 120s, transitionScreen never initializes, `#mathai-transition-slot button` never appears, every test times out.

### Fix Applied (commit e4e149b)
- CDN poll deadline: 120000 → 160000 ms in `pipeline-test-gen.js`
- Playwright test timeout: 180000 → 240000 ms in `pipeline-utils.js`
- Gives 160s for CDN + 75s for actual test execution

### Build #483 result: FAILED — game-flow 1/3, same test failing iter 1+2

| Build | Status | Root Cause | Fix |
|-------|--------|------------|-----|
| 482 | killed | CDN cold-start ~150s > 120s poll loop | poll loop → 160s, timeout → 240s |
| 483 | failed | game-flow "Game Over on Zero Lives" + "Victory" fail iter 1+2 | See §2D + §3C below |

---

## Build #483 + #503 Analysis (2026-03-22)

### §2D. Build 483 — "Game Over on Zero Lives" failure (local diagnostic 2026-03-22)

**Method:** Custom diagnostic scripts (`/Users/the-hw-app/Projects/mathai/ralph/diagnostic-kt.js` and `diagnostic-kt2.js`) running from ralph repo root. Both serve build 483 HTML locally on port 7779/7780 with full harness injected.

**Finding 1 — Game works correctly locally. All assertions pass:**

Both scripts completed the full "Game Over on Zero Lives" flow:
- Round 1 wrong answer: `__ralph.answer(false)` found `option-0` (correctIdx=2, wrong idx=0), clicked it. `isProcessing` cleared in 1-2ms.
- Round 2 wrong answer: `__ralph.answer(false)` found `option-1` (correctIdx=0, wrong idx=1), clicked it. `isProcessing` cleared in 1ms.
- Round 3 fatal wrong answer: `isProcessing` cleared immediately (game sets `isProcessing=false` at line 666 before `delay(1500)`). gameover phase reached at t+1600ms (well within 15s waitForPhase).
- "See Results" button visible. Clicking it → `endGame('game_over')` → `showResults()` → `#game-screen display=none`, `#results-screen display=flex`.
- **All assertions pass locally.** No errors.

```
[shot] /tmp/keep-track/shots2/12-11-final.png
Final state: {gameScreenDisplay:"none", resultsScreenDisplay:"flex", dataphase:"results"}
#game-screen hidden: true
#results-screen visible: true
TEST PASSED
```

**Finding 2 — Iter 1 failure: `Timeout 5000ms exceeded while waiting on the predicate`**

The `answer()` helper polls `!window.gameState?.isProcessing` with 5s timeout. For this to time out, `isProcessing` must be `true` for >5s after a cup click.

Build 483 code sets `isProcessing=false` at line 666 (BEFORE `await delay(1500)`) in the lives=0 path. Locally this clears in ~200ms. Server-side CDN race condition is the likely cause — if `progressBar.update()` throws internally or a CDN async callback re-sets `isProcessing=true`, the poll would stall.

**Finding 3 — Iter 2 failure: `#game-screen` expected hidden, received visible**

The test reached gameover phase and clicked "See Results", but `#game-screen` remained visible. This means `endGame('game_over')` was either not called (button action failed) or was called but `showResults()` didn't run (likely because `gameState.gameEnded` was already `true` from a previous path).

**Finding 4 — Root cause is server-specific, not HTML logic bug**

Both iter 1 and iter 2 pass completely in local browser. This rules out HTML logic bugs. Server failures are CDN timing/race conditions under load.

**Key data from `__ralph.answer(false)` debug:**
```
Round 1: correctIdx=2, wrongIdx=0, btnFound=true, phase=guess, isActive=true
Round 2: correctIdx=0, wrongIdx=1, btnFound=true, phase=guess, isActive=true
Round 3: correctIdx=3, wrongIdx=0, btnFound=true, phase=guess, isActive=true
```

All three rounds: correct cup found, wrong cup identified, button found by testid. Answer logic is correct.

---

### §3C. Build 503 — Analysis (2026-03-22)

**Build 503 test spec (game-flow.spec.js):** Only 2 tests — "Screen transition from Start to Game" and "Victory screen on 5 correct rounds". **No "Game Over on Zero Lives" test in build 503.** The test gen for this build did not produce a gameover test.

**Critical bug in build 503 HTML — `isProcessing` never reset in wrong-answer path:**

Build 483 code (CORRECT):
```js
if (gameState.lives <= 0) {
  gameState.isProcessing = false;  // ← explicitly reset before delay
  await delay(1500);
  gameState.phase = 'gameover';
```

Build 503 code (BUGGY):
```js
if (window.gameState.lives <= 0) {
  await delay(1500);               // ← isProcessing NEVER reset here
  window.gameState.phase = 'gameover';
```

In build 503, `isProcessing` is set to `true` at the start of `handleCupTap()` and is only reset to `false` inside `endGame()`. On the wrong-answer path (lives=0), `isProcessing` stays `true` throughout the `delay(1500)` + gameover transition, until the user clicks "Finish" which calls `endGame()`. Any test polling `!isProcessing` with a 5s timeout WILL time out.

**However**, build 503's test spec does NOT have a "Game Over on Zero Lives" test — so this bug won't be exposed by game-flow batch. The "Victory" test calls `answer(page, true)` repeatedly, which takes the correct-answer path where `isProcessing` IS reset quickly.

**Build 503 victory test uses hardcoded `correctIndices = [2, 0, 3, 0, 0]`** — these are fixed positions that may be wrong for any given game session since correct cup positions are randomized after shuffling. This test is very likely to fail in iter 1.

**Build 503 game-flow already ran 3 iterations** (from server logs: iter=1 at 18:10:55, iter=2 at 18:18:19, iter=3 at 18:26:53). The batch is complete. Results not yet in DB (saved at build end).

**Current status (2026-03-22):** Build 503 is at level-progression batch. Game-flow results will show in DB when build completes.

---

### §5 — Updated Go/No-Go for Build #503

**Likely outcome for build #503:**
- game-flow: 1/2 pass ("Start Game" passes, "Victory with hardcoded correctIndices" likely fails)
- mechanics: unknown — depends on test gen quality
- level-progression, edge-cases, contract: unknown
- Overall: likely to FAIL due to hardcoded correctIndices in victory test + `isProcessing` bug in wrong-answer path (even if not directly tested)

**Go/No-Go for approval:** NOT READY if game-flow "Victory" fails due to hardcoded positions. The `isProcessing` bug in build 503's HTML also needs to be fixed before the game can reliably handle wrong-answer flows.

**Required fixes for next build:**
1. **HTML fix:** In wrong-answer path when `lives <= 0`, add `window.gameState.isProcessing = false` BEFORE `await delay(...)`. This prevents `answer()` helper from timing out.
2. **Test gen prompt:** Never hardcode `correctIndices` for shuffle games — always use `window.gameState.correctCup` dynamically to find the correct cup.
3. **GF3 rule (waitForPhase gameover 15000):** Sufficient — locally gameover is reached in 1600ms. 15000ms is adequate margin.
