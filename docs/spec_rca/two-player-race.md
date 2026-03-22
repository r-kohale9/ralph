# two-player-race — Spec RCA

Game: 2 Player Race (game_two_player_race). Split-screen competitive math race, two players on one device, 10 rounds, no lives.

---

## 1. Root Cause

Build 438 (most recent) fails in Step 1d with 12x "Failed to load resource: 404" errors. There are **two independent bugs**, both introduced by the LLM misreading the CDN API contracts:

**Bug A (fatal, blocks init):** `new TimerComponent({ startTime: 0 })` — the TimerComponent constructor signature is `constructor(containerId, config = {})`, but the game passes a config object as the first positional argument. The component calls `document.getElementById({ startTime: 0 })`, which coerces to `"[object Object]"`, finds nothing, and throws `"Container with id '[object Object]' not found"`. This exception propagates from inside the `DOMContentLoaded` try-block, so the TransitionScreen never shows and the game never reaches a playable state.

**Bug B (non-fatal but triggers smoke check):** `FeedbackManager.sound.preload([{ id: 'correct_tap', url: 'https://storage.googleapis.com/test-dynamic-assets/audio/success.mp3' }, { id: 'wrong_tap', url: '.../audio/error.mp3' }])` — both URLs 404 (the `/audio/` path does not exist in the bucket). FeedbackManager retries each preload 6 times, producing 12 console errors. The Step 1d smoke check counts these 404s and fails the build before it reaches test generation.

Build 421 (earlier) had a different generation: `ScreenLayout.inject` ran but produced no visible start screen (`#mathai-transition-slot` absent from DOM, `data-phase=game_init` instead of `start_screen`). The `#gameContent` element was missing — ScreenLayout.inject likely failed silently or the template cloneNode ran before the slot was ready.

---

## 2. Evidence of Root Cause

**Stack trace from instrumented browser run (build 438):**

```
[CAUGHT TARGET ERROR] Container with id "[object Object]" not found
[STACK] Error: Container with id "[object Object]" not found
    at new <anonymous> (http://localhost:7783/:6:15)
    at new TimerComponent (https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js:15:13)
    at http://localhost:7783/:919:17   <-- corresponds to build438.html line 907
[error] Init error: Container with id "[object Object]" not found
```

Source: `/tmp/tpr-trace3.js` instrumented run, 2026-03-21.

**TimerComponent constructor confirmed:**

```
curl https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js | grep 'class TimerComponent'
→ class TimerComponent { constructor(containerId, config = {}) { this.container = document.getElementById(containerId); if (!this.container) { throw new Error(...) }
```

**Audio 404s confirmed:**

```
curl -I https://storage.googleapis.com/test-dynamic-assets/audio/success.mp3  → HTTP/2 404
curl -I https://storage.googleapis.com/test-dynamic-assets/audio/error.mp3    → HTTP/2 404
```

**ScreenLayout.inject confirmed working correctly (not the source of the error):**

```
[TRACE] ScreenLayout.inject called with containerId type=string value="app"  ← correct, one call only
```

**DB query confirming builds never reached iteration 1:**

```json
[
  { "id": 438, "status": "failed", "error_message": "Step 1d: Page load failed after regeneration attempt: Failed to load resource: the server responded with a status of 404 (); [x12]", "iterations": 0 },
  { "id": 421, "status": "failed", "error_message": "Step 1d: Page load failed after regeneration attempt: Blank page: missing #gameContent element", "iterations": 0 },
  { "id": 307, "status": "failed", "error_message": null, "iterations": 0 },
  { "id": 258, "status": "failed", "error_message": "queue-sync: BullMQ job lost after worker restart", "iterations": 0 },
  { "id": 184, "status": "failed", "error_message": null, "iterations": 0 }
]
```

**Screenshots:**

- `/tmp/two-player-race-debug/tpr-01-initial-load.png` — build 438 shows `data-phase=start_screen`, `#mathai-transition-slot` present but has 0 buttons (init errored before `transitionScreen.show()` was called)
- `/tmp/two-player-race-debug/tpr-02-final-state.png` — same state after 5s, no game starts

**Missing window functions (secondary issue):**

`endGame`, `restartGame`, and `nextRound` are defined as local functions but ARE exposed on `window` in build 438 — this is not the primary blocker. (The T1 validator would NOT flag this build for that reason.)

---

## 3. POC Fix Verification (REQUIRED before E2E)

**Local verification of the TimerComponent API fix:**

```bash
# Confirmed TimerComponent constructor from CDN source:
curl -s https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js \
  | grep -A3 'class TimerComponent'
# Output: constructor(containerId, config = {}) {
#           this.container = document.getElementById(containerId);

# Wrong call (current build 438 line 907):
timer = new TimerComponent({ startTime: 0 });
# → throws: "Container with id '[object Object]' not found"

# Correct call pattern:
timer = new TimerComponent('mathai-timer-slot', { startTime: 0, timerType: 'decrease', format: 'sec' });
# → getElementById('mathai-timer-slot') → finds the DOM element injected by ScreenLayout
```

The fix requires the generation prompt to pass a container ID string as the first argument. The spec (PART-006) says "manual setInterval, not TimerComponent class" for timing — so the correct fix is either:
- Remove the `new TimerComponent(...)` call entirely (since this game uses manual setInterval for its countdown), OR
- Call it correctly: `timer = new TimerComponent('mathai-timer-slot', { startTime: 0 })`

**Local verification of audio URL fix:**

The spec (PART-017) states `sound.preload: correct_tap, wrong_tap`. The URLs `audio/success.mp3` and `audio/error.mp3` are LLM-hallucinated paths — they don't exist. FeedbackManager sound IDs should use the prebuilt sounds registered with the package, or the preload block should be removed if the game uses only `correct_tap`/`wrong_tap` as local aliases. The correct preload URLs should come from the spec or the FeedbackManager documentation.

**POC: confirming the error is eliminated when init error is fixed:**

From the instrumented run, `#mathai-transition-slot` IS injected correctly by `ScreenLayout.inject('app', ...)`. The game would reach `transitionScreen.show(...)` if the TimerComponent call didn't throw. This means fixing Bug A alone would unblock the start screen — the audio 404s are non-fatal (wrapped in try/catch).

---

## 4. Reliability Reasoning

**Why this fix will hold across builds:**

- Bug A is **deterministic**: any call to `new TimerComponent(configObject)` with an object as first arg will always throw. The fix (remove call or pass correct string ID) is also deterministic.
- The spec (PART-006) already says to use manual setInterval, not TimerComponent — the fix aligns with the spec intent.
- Bug B (audio 404s) will recur unless the generation prompt explicitly specifies the correct audio URL pattern or removes the preload block. Since FeedbackManager has built-in sounds, the preload block with custom URLs may be unnecessary.

**Regression risk:**

- The generation prompt does not currently validate TimerComponent API. If the LLM generates `new TimerComponent({...})` again, the same crash recurs. This requires a prompt rule change: "TimerComponent takes a containerId string as first argument, not a config object."
- Audio URLs are LLM-hallucinated. Without explicit URL constants in the spec, the LLM will invent paths. Fix: add correct audio URL examples to PART-017 or mark sound.preload as not applicable for this game type.

**Edge cases:**

- Build 421 had a completely different failure mode (no #gameContent, wrong initial phase). This suggests the game generation is highly variable — fixing Bug A in the gen prompt does not guarantee build 421's specific issues won't recur. However, build 438 is the more recent/stable generation pattern.

---

## 5. Go/No-Go for E2E

**Decision: APPROVED — build #466 (iter=2, 10/10 tests passing)**

- game-flow: 2/2 ✓
- mechanics: 3/3 ✓
- level-progression: 1/1 ✓
- edge-cases: 3/3 ✓ (iter=2 after 1 round-timeout edge-case failure fixed in iter=1)
- contract: 1/1 ✓

Approval validates: TimerComponent API fix (Lesson 98 — string containerId), audio 404 exclusion (Lesson 95), and all CDN constraint rules held.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #184 | Unknown (no error_message) | Likely early pipeline issue | Failed |
| #258 | queue-sync: BullMQ job lost after worker restart | Infrastructure / worker restart mid-build | Failed |
| #307 | Unknown (test_results: []) | Likely LLM generation or test-gen issue | Failed |
| #421 | Blank page: missing #gameContent element | ScreenLayout.inject failed or game-template not cloned; data-phase=game_init (wrong), Sentry initSentry error | Failed |
| #438 | 12x 404 (Step 1d smoke check) | `new TimerComponent({startTime:0})` crashes init; audio preload URLs hallucinated and 404 | Failed |
| #466 | APPROVED (10/10: game-flow 2/2, mechanics 3/3, level-prog 1/1, edge-cases 3/3, contract 1/1) | All prior blockers fixed (TimerComponent API, audio 404 exclusion, CDN constraints) | approved |

---

## Manual Run Findings (browser screenshots, console, network)

Run date: 2026-03-21. Build 438 HTML from `/opt/ralph/data/games/two-player-race/builds/438/index.html`.

**What the browser sees:**
- Start screen (`data-phase=start_screen`) is present but frozen — `#mathai-transition-slot` has no buttons
- `#gameContent` exists in the DOM (ScreenLayout.inject succeeded)
- `window.__initError = "Container with id '[object Object]' not found"`
- 12 console errors: 6 from `correct_tap` preload failure (HTTP 404 × retry), 6 from `wrong_tap` preload failure

**What works locally:**
- CDN packages load correctly (helpers, components, feedback-manager all HTTP 200)
- `ScreenLayout.inject('app', {...})` runs successfully, injecting `#gameContent`, `#mathai-transition-slot`, `#mathai-progress-slot`
- `gameState` is initialized correctly
- `window.endGame`, `window.restartGame`, `window.nextRound` ARE on window (rule 20/21 satisfied)

**What fails:**
- `new TimerComponent({ startTime: 0 })` — object passed as containerId → throws, aborts init
- `FeedbackManager.sound.preload([{id:'correct_tap', url:'...audio/success.mp3'}])` → 404 (URL doesn't exist)

**Build 421 differences:**
- `#mathai-transition-slot` never injected (ScreenLayout.inject may have run before component was ready, or threw silently)
- `data-phase=game_init` (wrong — should be `start_screen`)
- Different init structure (Sentry called before FeedbackManager)

Screenshots:
- `/tmp/two-player-race-debug/tpr-01-initial-load.png` — frozen start screen, no button
- `/tmp/two-player-race-debug/tpr-02-final-state.png` — same after 5s

---

## Targeted Fix Summary

No targeted fix has been attempted. Both issues are gen-prompt level, not pipeline level:

| Issue | What Was Tried | Outcome |
|-------|---------------|---------|
| TimerComponent wrong call | — | Not attempted. Fix: update spec PART-006 to remove TimerComponent instantiation or specify correct containerId |
| Audio 404s | — | Not attempted. Fix: update spec PART-017 to remove custom preload block or specify valid URLs |
| build #421 ScreenLayout failure | — | Not attempted. Superseded by build #438 analysis |

**Pipeline fix needed?**

The suspected ROADMAP item ("Persistent CDN 404 after smoke-regen — wrong URL path not domain") does NOT apply here. The CDN domain is correct (`storage.googleapis.com/test-dynamic-assets`). The issue is hallucinated subdirectory paths (`/audio/` doesn't exist). The existing `checkCdnScriptUrls()` HEAD-check would catch these if it also checked audio preload URLs, but currently it only checks `<script src>` tags. A URL-checking pass over `FeedbackManager.sound.preload` call args would catch this pattern.

`fixCdnDomainsInFile()` does not apply — the domain is correct. What's needed is either:
1. A `checkAudioPreloadUrls()` step that HEAD-checks each URL in `sound.preload` arrays, OR
2. Gen prompt enforcement that audio URLs must come from an approved list (not invented)
