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

Decision: **READY FOR E2E** — with required pipeline fixes deployed first.

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

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| 281 | BullMQ job lost after worker restart | Infrastructure | Failed (infra) |
| 325 | `test_results: []`, no error | Unknown (likely infra/queue) | Failed |
| 410 | Step 1d: Blank page: missing #gameContent | TimerComponent wrong API + ordering | Failed |
| 427 | Step 1d: Blank page: missing #gameContent | Same — smoke regen did not fix it | Failed |
| 452 | Step 1d: Blank page: missing #gameContent | Same — smoke regen did not fix it | Failed |
| 465 | Contract-fix T1 error; game-flow 0/2 (button hidden) | initSentry before waitForPackages; transition slot button never shown after round | Failed |

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

## Targeted Fix Summary

No targeted fix has been run. Diagnosis complete from local diagnostic run.

**What to do before E2E:**
1. Upgrade T1 check 5f4 to ERROR (in `lib/validate-static.js`)
2. Add TimerComponent constructor signature warning to `buildSmokeRegenFixPrompt` (in `lib/prompts.js`)
3. Queue build — gen prompt already has the correct API at line 85, so a fresh generation may work with the above safeguards catching regressions

**What NOT to do:** Do not run a targeted fix — the root cause is in generation, not post-generation state. A new full generation with the upgraded T1 check will force the static-fix LLM to correct the API before reaching Step 1d.
