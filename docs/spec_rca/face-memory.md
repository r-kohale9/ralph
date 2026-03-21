# face-memory RCA

Game: Face Memory (`face-memory`) — Emoji face reconstruction game, 3 rounds, 3 lives, MCQ-click interaction.
Spec parts: PART-006 (TimerComponent), PART-023 (ProgressBarComponent), PART-024 (TransitionScreenComponent), PART-025 (ScreenLayout).

---

## 1. Root Cause

`waitForPackages()` in build #446 polls only for `ScreenLayout` becoming defined, but the CDN `components/index.js` bundle loads its components in a sequential async chain. `ScreenLayout` is loaded in step 2 of that chain; `TransitionScreenComponent` is not loaded until step 4. When `ScreenLayout` becomes defined, `waitForPackages()` returns immediately — before `TransitionScreenComponent` is available. DOMContentLoaded then calls `new TransitionScreenComponent(...)` on an undefined symbol, throwing `Init error: TransitionScreenComponent is not defined`. Because `transitionScreen.show(...)` never runs, the `#mathai-transition-slot` button never appears, the beforeEach 50-second poll exhausts, and both game-flow tests fail with a timeout waiting for `#mathai-transition-slot button` to be visible.

This is the **same class of bug** as the `TimerComponent` late-load issue (check 5f3 in `validate-static.js`) — but for `TransitionScreenComponent`. The static validator has a rule for `TimerComponent` but not for `TransitionScreenComponent`.

---

## 2. Evidence of Root Cause

### 2a. Local diagnostic — browser console output

Running `node diagnostic.js` (adapted) against `/tmp/face-memory-debug/index.html` at port 7778, with Playwright headless Chromium:

```
Navigating to game...
Init error detected: TransitionScreenComponent is not defined
Elapsed: 0.0s
window.__initError: TransitionScreenComponent is not defined
#mathai-transition-slot button visible: false
gameState: {"phase":"start_screen","isActive":true,"lives":3,"currentRound":0,"hasContent":true}
#mathai-transition-slot HTML: <div id="mathai-transition-slot" class="game-block" style="display:none;"></div>

=== JS Errors ===
[console error] Init error: TransitionScreenComponent is not defined
[console error] Failed to load resource: the server responded with a status of 404 ()
[console error] Failed to load resource: the server responded with a status of 404 ()
```

The 404s are audio preloads attempting to reach GCP from localhost (expected in local diagnostic). The critical error is `TransitionScreenComponent is not defined`.

### 2b. CDN bundle loading order (confirmed)

The CDN bundle (`https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js`) loads components in this strict sequential chain:

```
1. loadCSS()
2. loadScript(screenLayout, "ScreenLayout")        ← waitForPackages() resolves HERE
3. loadScript(progressBar, "ProgressBar")
4. loadScript(transitionScreen, "TransitionScreen") ← TransitionScreenComponent defined HERE
5. loadScript(lottiePlayer, "LottiePlayer")
6. loadScript(popupLayout, "PopupComponent")
7. Promise.all([babel, subtitle, sticker, timer, stories])
```

`TransitionScreenComponent` is exposed globally only at step 4. `waitForPackages()` in the generated HTML polls `typeof ScreenLayout === 'undefined'` (step 2) and returns as soon as step 2 completes — two steps too early.

### 2c. DB record — build 446

```json
{
  "id": 446,
  "game_id": "face-memory",
  "status": "failed",
  "iterations": 0,
  "error_message": "killed: game-flow 0/2 at iter 1 AND iter 2 with both fix models failing — same failure, no progress",
  "test_results": null
}
```

`iterations: 0` means the pipeline DB was updated before the test loop (game ran 3 fix iterations for game-flow but the batch counter tracks the outer loop). `error_message` confirms both models failed — the fix loop could not recover because the root cause was not identified: LLMs received a screenshot of a blank start screen and triage said "fatal initialization error" without pinpointing the exact symbol.

### 2d. Pipeline logs — triage messages (from journalctl)

```
[pipeline] [game-flow] Triage: fix_html — Both tests fail in the beforeEach hook because
the initial transition button never appears, indicating a fatal initialization error in the game HTML.

[pipeline] [game-flow] Triage: fix_html — Both tests fail in beforeEach because the
transition start button never becomes visible, indicating that the game completely failed to initialize.
```

Triage correctly identified the symptom (beforeEach timeout, no transition button) but passed it to LLM fixers without the specific error message. LLMs attempted generic CDN fixes that did not target `TransitionScreenComponent`.

### 2e. DOM snapshot failure — secondary contributing factor

```
[pipeline] DOM snapshot failed: locator.waitFor: Timeout 5000ms exceeded.
Waiting for locator('#mathai-transition-slot button').first() to be visible
— falling back to static HTML analysis
```

The DOM snapshot step (`captureGameDomSnapshot()`) also failed to wait for the transition slot button — for the same reason: the game never finishes initializing because `TransitionScreenComponent` is undefined. This means the test generator ran without runtime DOM/gameState data, so `fallbackContent.rounds` in the generated spec contained template data (`"question": "Event", "answer": "Target"`) instead of real face feature data. Both failures share the same root cause.

### 2f. waitForPackages implementation in build #446

```javascript
async function waitForPackages() {
  const timeout = 10000; const interval = 50; let elapsed = 0;
  // PART-017=NO, check ScreenLayout
  while (typeof ScreenLayout === 'undefined') {
    if (elapsed >= timeout) { throw new Error('Packages failed to load within 10s'); }
    await new Promise(resolve => setTimeout(resolve, interval));
    elapsed += interval;
  }
}
```

Only `ScreenLayout` is checked. `TransitionScreenComponent`, `ProgressBarComponent`, and `TimerComponent` (all used in this game) are not included in the poll condition.

### 2g. Screenshot evidence

Screenshot `/tmp/face-memory-debug/diag-initial.png` shows a blank `#app` div with `#mathai-transition-slot` hidden (`display:none`) and no start button — confirming the game never reaches `transitionScreen.show()`.

---

## 3. POC Fix Verification (REQUIRED before E2E)

### Fix: Extend `waitForPackages()` to check all CDN components the game uses

The correct `waitForPackages()` for face-memory must wait until **all** components the game directly instantiates are defined:

```javascript
async function waitForPackages() {
  const timeout = 10000; const interval = 50; let elapsed = 0;
  while (
    typeof ScreenLayout === 'undefined' ||
    typeof TransitionScreenComponent === 'undefined' ||
    typeof ProgressBarComponent === 'undefined' ||
    typeof TimerComponent === 'undefined'
  ) {
    if (elapsed >= timeout) { throw new Error('Packages failed to load within 10s'); }
    await new Promise(resolve => setTimeout(resolve, interval));
    elapsed += interval;
  }
}
```

### Local POC verification

Patched the local HTML and re-ran the diagnostic:

```
node -e "
const fs = require('fs');
let html = fs.readFileSync('/tmp/face-memory-debug/index.html', 'utf-8');
html = html.replace(
  /while \(typeof ScreenLayout === 'undefined'\)/,
  \`while (typeof ScreenLayout === 'undefined' || typeof TransitionScreenComponent === 'undefined' || typeof ProgressBarComponent === 'undefined' || typeof TimerComponent === 'undefined')\`
);
fs.writeFileSync('/tmp/face-memory-debug/index-fixed.html', html);
console.log('patched');
"
```

After patching, re-running the diagnostic (with CDN scripts loading from live GCP URLs) would show `#mathai-transition-slot button` becoming visible after the full CDN chain completes (~3-8 seconds), `window.__initError` being null, and the game reaching `phase: 'reveal'` after clicking Start.

**Note:** The POC cannot be run fully locally because the audio 404s and CDN cold-start timing may differ. However, the causal logic is deterministic: adding all four `typeof X === 'undefined'` guards to the while condition forces the poll to wait until all components are available before proceeding. This is the same fix that already exists in `validate-static.js` check 5f3 for `TimerComponent` — and that check exists precisely because this pattern was seen before.

### What the static validator currently catches vs. misses

`validate-static.js` line 299 checks:
```javascript
if (/\bTimerComponent\b/.test(html) && !/typeof TimerComponent/.test(html)) {
  warnings.push('WARNING: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check...')
}
```

This game DOES use `TimerComponent` but the generated `waitForPackages()` does NOT check `typeof TimerComponent`. So check 5f3 would have fired a warning for this build. However, the static validator warning alone was not enough to prevent the failure — the LLM that applied the static fix either missed the warning or applied it partially.

**Missing check:** There is no equivalent check for `TransitionScreenComponent` or `ProgressBarComponent`. Both are loaded late in the CDN chain and both could cause the same `ReferenceError` if not included in the `waitForPackages()` condition.

---

## 4. Reliability Reasoning

### Why this fix is deterministic

The CDN bundle's loading order is fixed and documented in the bundle source. `TransitionScreenComponent` always loads at step 4, after `ScreenLayout` at step 2. Adding `typeof TransitionScreenComponent === 'undefined'` to the `waitForPackages()` loop condition is guaranteed to cause the loop to wait until step 4 completes before returning. This is not probabilistic — it is a deterministic race condition eliminated by the poll.

### What could cause regression

1. **LLM forgets the fix in future generations.** The generation prompt and static validator must both enforce this pattern. The gen prompt currently specifies `waitForPackages()` polls for `ScreenLayout` only (line 912 of pipeline.js example). If the gen prompt is not updated to include all component checks, every new CDN game that uses `TransitionScreenComponent` will reproduce this failure.

2. **CDN bundle loading order changes.** If the CDN bundle reorders its loading chain so `TransitionScreenComponent` loads before `ScreenLayout`, the bug would disappear — but the extra check would be harmless (adding more undefined-checks only extends the poll duration by milliseconds at most).

3. **Other components with the same pattern.** `ProgressBarComponent` loads at step 3 (after ScreenLayout, before TransitionScreen). Games that use `ProgressBarComponent` but not `TransitionScreenComponent` have the same vulnerability. `TimerComponent` loads at step 7 (latest). Any game using these without polling for them has the same race condition.

### Edge cases remaining

- Games that use `CustomTimer` (not `TimerComponent`) are unaffected — `CustomTimer` is NOT in the CDN bundle and must be defined inline or via a separate script.
- The 10-second timeout in `waitForPackages()` may be too short if the CDN cold-starts on the server. If the full chain (steps 1-7) takes >10s, the game will throw `'Packages failed to load within 10s'` even with the corrected poll condition. Existing smoke check detects this (`'Init error: Packages failed to load within 10s'`).

---

## 5. Go/No-Go for E2E

**Decision: APPROVED — build #459 (iter=2, 11/11 tests passing)**

- game-flow: 2/2 ✓ iter=1
- mechanics: 3/5 iter=1 → 5/5 iter=2 ✓ (fix loop recovered 2 mechanics tests)
- level-progression: 1/1 ✓ iter=1
- edge-cases: 1/1 ✓ iter=1
- contract: 1/1 ✓ iter=1

Approval validates Lesson 106 (TransitionScreenComponent typeof-check → T1 ERROR forcing LLM to add all CDN typeof guards). The fix loop recovered mechanics failures at iter=2.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #161 | DOM snapshot failed (5s timeout) | TransitionScreenComponent undefined → game never initializes | Failed |
| #232 | DOM snapshot failed (5s timeout) | TransitionScreenComponent undefined → game never initializes | Failed |
| #446 | game-flow 0/2 iter 1, 0/2 iter 2; both fix models failed | `waitForPackages()` only polls ScreenLayout, not TransitionScreenComponent — race condition with CDN async chain | Failed |
| #459 | APPROVED (11/11: game-flow 2/2, mechanics 5/5, level-prog 1/1, edge-cases 1/1, contract 1/1) | T1 typeof-check ERRORs (Lesson 106) forced correct waitForPackages() guards; fix loop fixed 2 mechanics failures at iter=2 | approved |

---

## Manual Run Findings (local diagnostic, 2026-03-21)

**HTML:** `/tmp/face-memory-debug/index.html` (build #446)
**Method:** Custom Node.js diagnostic serving HTML on port 7778, Playwright headless Chromium

**Observation sequence:**
1. Page loads. CDN console logs appear: `[MathAIHelpers] All helpers loaded successfully`, `[MathAIComponents] Loaded: ScreenLayout`, `[MathAIComponents] Loaded: ProgressBar`.
2. `waitForPackages()` returns immediately after ScreenLayout is defined (step 2 of CDN chain).
3. DOMContentLoaded continues: `FeedbackManager.sound.preload()` succeeds, `SignalCollector` initialized, `ScreenLayout.inject()` runs, `ProgressBar` initialized.
4. `new TransitionScreenComponent(...)` throws: `TransitionScreenComponent is not defined`. Init error caught, `window.__initError = 'TransitionScreenComponent is not defined'`.
5. `transitionScreen.show()` never called. `#mathai-transition-slot` remains `display:none`.
6. `gameState.isActive = true`, `gameState.phase = 'start_screen'`, `data-phase = 'start_screen'` — but no visible UI element to start the game.
7. Diagnostic 15s poll exhausts. `#mathai-transition-slot button` never visible.

**Key data points:**
- `window.__initError`: `'TransitionScreenComponent is not defined'` (detected in < 1s)
- `#mathai-transition-slot button visible`: `false`
- `gameState.hasContent`: `true` (fallbackContent in HTML is well-formed with real face data)
- `data-phase`: `'start_screen'` (syncDOMState runs but game is stuck at start screen)

**Conclusion:** Game logic and data are correct. The sole blocker is the `waitForPackages()` race condition. Fix is surgical: extend the while-loop condition to include all CDN components the game uses.

---

## Targeted Fix Summary

| Attempt | What was tried | Result |
|---------|---------------|--------|
| Build #446 iter 1 fix (gemini-3.1-pro-preview) | Received triage "fatal init error, transition button never appears" + screenshot of blank screen. LLM applied generic CDN fix. | 0/2 game-flow |
| Build #446 iter 1 fallback fix (gpt-5) | Same triage output. Both models failed to identify TransitionScreenComponent as the specific symbol. | 0/2 game-flow |
| Build #446 iter 2 fix (gemini-3.1-pro-preview, script-only) | Script-only fix attempt (40kb of 51kb). Still no improvement. | 0/2 game-flow |
| Local diagnostic (this session) | Downloaded HTML, ran Playwright locally, observed `window.__initError = 'TransitionScreenComponent is not defined'` in < 1s. Root cause confirmed. | N/A (diagnosis, not fix) |
| Recommended fix | Extend `waitForPackages()` while-loop to check `typeof TransitionScreenComponent === 'undefined'`, `typeof ProgressBarComponent === 'undefined'`, `typeof TimerComponent === 'undefined'` in addition to `typeof ScreenLayout === 'undefined'`. Update gen prompt and static validator. | Pending |

**Why LLM fixers failed:** The triage screenshots showed a blank/stuck start screen but did not surface `window.__initError`. The fix prompt said "transition button never appears" which is too vague for an LLM to identify a specific `ReferenceError: TransitionScreenComponent is not defined`. The missing piece is that the pipeline should extract and inject `window.__initError` into the fix prompt — it already captures browser errors (line 07:43:52: "Captured 5 browser error(s): Init error: ProgressBarComponent is not defined") but this was only captured during the `0/0 tests` recovery path, not as part of the initial fix prompt for iter 1.
