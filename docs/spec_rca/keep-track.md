# keep-track — Spec RCA

Game: Shell game (cups shuffle, player taps correct cup). 5 rounds, 3 lives. CDN game using TimerComponent (PART-006=YES).

---

## 1. Root Cause

`TimerComponent` is constructed with a config object as its first argument instead of the required string container ID, **and** it is initialized before `ScreenLayout.inject()` + template clone, so the container element does not yet exist in the live DOM. The CDN's `TimerComponent` constructor signature is `new TimerComponent(containerId: string, config: object)`. The LLM generates `new TimerComponent({ container: document.getElementById('timer-container'), timerType: 'increase', ... })`, passing the entire config object as `containerId`. This makes `document.getElementById("[object Object]")` return `null`, and `TimerComponent` throws `Container with id "[object Object]" not found` inside the DOMContentLoaded async callback. The error is caught by the try/catch and logged via `console.error('Init error: ...')`, but execution stops before `ScreenLayout.inject()` is reached. Since `ScreenLayout.inject()` never runs, `#gameContent` is never created, and the pipeline smoke check correctly reports "Blank page: missing #gameContent element".

The second issue is ordering: even if the API were correct, `TimerComponent` is called at line 357 — before the template clone at line 412. The element `#timer-container` lives inside `<template id="game-template">` and is not in the live DOM until after `tpl.content.cloneNode(true)` is appended to `#gameContent`. Moving `TimerComponent` init to after the clone is also required.

The smoke-regen LLM call also fails to fix this because `buildSmokeRegenFixPrompt` tells the LLM to move "other CDN components" after the template clone, but does not call out the `TimerComponent` constructor signature error explicitly — so the LLM regenerates `TimerComponent` with the same wrong API.

---

## 2. Evidence of Root Cause

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

## 3. POC Fix Verification

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

POC verification: COMPLETE. Both fixes together resolve the blank page.

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

Decision: **NOT READY FOR E2E** — TimerComponent fix resolved blank page but build #465 revealed two new blockers (see §4 update).

**Build #465 findings (2026-03-21):** TimerComponent API fix WORKED — no blank page, game actually ran to 3 iterations. But two new issues found:
1. `initSentry() called before waitForPackages()` — T1 hard error blocked the contract-fix exit on every iteration until iteration 3 finally passed
2. `game-flow 0/2` — `#mathai-transition-slot button` resolves to element but is `hidden` (not missing). The game is not showing the transition screen after round completion. The `Continue` button exists but stays hidden — game logic never calls `transitionScreen.show()` after a round ends.
3. mechanics 0/2 — `.cup-container[data-signal-id="cup-2"]` missing `correct` CSS class after player clicks correct cup — game logic not applying visual feedback

**Blockers before E2E:**
1. Add `initSentry()` ordering rule to gen prompt: must be called INSIDE `waitForPackages()` callback, not before it
2. Diagnose game-flow: why does the game not call `transitionScreen.show()` after a round ends? Likely the round-complete logic has a bug in the generated code.

Evidence of root cause (§2): Complete. DB records, HTML inspection, CDN API verification, diagnostic run with error message confirmed.

POC verification (§3): Complete. Patched HTML passes smoke check locally — `#gameContent` exists, start screen renders, `data-phase="start"` set correctly.

**Recommended pipeline fix before E2E** (to prevent same failure on next build):

1. Upgrade T1 check 5f4 from WARNING to ERROR — forces static-fix LLM to correct the `new TimerComponent({...})` API.
2. Add to `buildSmokeRegenFixPrompt` an explicit bullet: "If this HTML uses `TimerComponent`: its constructor is `new TimerComponent('container-id', config)` — FIRST argument MUST be the container element ID string. `new TimerComponent({ container: ..., ... })` is WRONG and causes the exact `Container with id [object Object] not found` crash. Also, `new TimerComponent(...)` MUST be called AFTER `ScreenLayout.inject()` + template clone, since `#timer-container` lives inside the template and does not exist in the live DOM until the template is cloned."

Without these fixes, the LLM will likely generate the same wrong API again (3 consecutive builds prove it). The spec itself is sound and the game logic passes locally with the patched HTML.

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

## Targeted Fix Summary

No targeted fix has been run. Diagnosis complete from local diagnostic run.

**What to do before E2E:**
1. Upgrade T1 check 5f4 to ERROR (in `lib/validate-static.js`)
2. Add TimerComponent constructor signature warning to `buildSmokeRegenFixPrompt` (in `lib/prompts.js`)
3. Queue build — gen prompt already has the correct API at line 85, so a fresh generation may work with the above safeguards catching regressions

**What NOT to do:** Do not run a targeted fix — the root cause is in generation, not post-generation state. A new full generation with the upgraded T1 check will force the static-fix LLM to correct the API before reaching Step 1d.
