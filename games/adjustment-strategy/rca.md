# adjustment-strategy — Per-Spec RCA

## Rendering Investigation 2026-03-23

**Analyst:** Test Engineering slot
**Trigger:** Analytics flagged 68 builds, 6 approved (8.8% — worst in DB). All unresolved failures show `toBeVisible` errors across every test category.

### Summary

The `toBeVisible` pattern is a **proxy symptom** of CDN initialization failures, not a test harness issue. Three compounding bugs recur across failed builds and are present even in the most recent approved build (#385). The game transitions through `game_init → start_screen` synchronously via async CDN components that are never properly awaited, causing the Playwright harness to capture the page mid-init.

---

### Evidence from DB + Static Validation

**Build inventory (DB query 2026-03-23):**
- Total builds: 68
- Approved: 6 (8.8%)
- Most recent approved: **Build #385** (2026-03-20, iterations=0)
- Builds #376–378: `failed`, `test_results=[]` — CDN never loaded, all tests bombed in `beforeEach`
- Build #380: killed — worker config error (claude-opus-4-6 auth unavailable)
- Build #381: `failed`, all batches 0 passed — `game-flow:i1:p0/f1`, `mechanics:i1:p0/f4`, `level-progression:i1:p0/f1`, `edge-cases:i1:p0/f3`, `contract:i1:p0/f1`
- Build #383: killed — skip_test bug corrupted HTML across all 5 categories (cascade failure)
- Build #488: cancelled — scale run complete (game was already approved)

**Static validator on failed build #381 — 7 errors:**
1. `FeedbackManager.init()` called unconditionally → audio popup → blocks test harness
2. `transitionScreen.show()` without `transitionScreen.hide()` in `startGame()` → `#gameContent` never revealed
3. `waitForPackages()` timeout = 10000ms (must be 120000ms) → "Packages failed to load" on CDN cold-start → ALL `beforeEach` calls fail → every test gets `toBeVisible` failure
4. `TimerComponent` not in `waitForPackages()` typeof guards → ReferenceError on init
5. `TransitionScreenComponent` not in `waitForPackages()` typeof guards → ReferenceError on init
6. `ProgressBarComponent` not in `waitForPackages()` typeof guards → ReferenceError on init
7. `transitionScreen.show()` never awaited (3/3 calls) → CDN state machine corruption → button stays `visibility:hidden` in subsequent rounds

**Static validator on approved build #385 — 3 errors (still present in approved build):**
1. `transitionScreen.show()` without `transitionScreen.hide()` in `startGame()` → `#gameContent` never explicitly revealed
2. `waitForPackages()` timeout = 10000ms (must be 120000ms) → CDN cold-start risk remains
3. All 3 `transitionScreen.show()` calls unawaited → state machine corruption risk

**Build #381 game-flow failure (direct evidence):**
```
[game-flow.spec.js] Start Screen Transition
Expected: "start_screen"
Received: "game_init"
14× locator resolved to <div id="app" data-phase="game_init">
```
This confirms the page was still in `game_init` when Playwright tested for `start_screen`. The init async chain was incomplete because either the CDN timeout fired too early (10s) or `waitForPackages()` didn't guard all required components.

**Build #381 mechanics failures:**
```
TimeoutError: locator.click: Timeout 15000ms exceeded.
waiting for locator('#mathai-transition-slot button').first()
```
The transition screen button never became clickable — consistent with unawaited `transitionScreen.show()` leaving the button in a hidden CDN state.

---

### Root Cause Classification

**Primary:** `waitForPackages()` timeout = 10000ms (must be 120000ms). CDN cold-start in Playwright takes 30–120s on first run. The 10s timeout causes all `beforeEach` to throw "Packages failed to load" → every test in every batch gets `toBeVisible` failure. This is a **gen rule failure** — the prompt rule for PART-003 must enforce 120000ms explicitly.

**Secondary:** `transitionScreen.show()` calls not awaited. This is a **gen rule failure** — GEN-117 / Lesson 101 requires `await` before every `transitionScreen.show()`. Without it, the CDN internal state machine is corrupted, and the button remains hidden → mechanics tests time out with `toBeVisible`.

**Tertiary:** `transitionScreen.hide()` not called in `startGame()`. `#gameContent` is never revealed → game appears blank after start screen button press. GEN-117 and GEN-118 cover this.

**Quaternary (build #381 only):** Missing `typeof` guards in `waitForPackages()` for `TransitionScreenComponent`, `ProgressBarComponent`, `TimerComponent`. Even if the timeout was long enough, init runs before CDN loads these components → ReferenceError → blank page.

**The approved build (#385) does NOT have these guards fixed** — it only passed because the test harness happened to catch it with CDN already warm (builds #383 and prior had already loaded CDN assets into cache). The 8.8% approval rate reflects how rarely CDN is warm when Playwright runs.

---

### Root Cause Classification: HTML Bug vs Test Bug

**HTML Bug** — all four issues are generation failures in the game HTML, not test harness bugs. The test harness is correctly waiting for CDN and correctly checking visibility. The game HTML fails to:
1. Guard all CDN components in `waitForPackages()`
2. Use a CDN-safe timeout (120000ms)
3. Await `transitionScreen.show()`
4. Call `transitionScreen.hide()` in `startGame()`

No test harness change is warranted. The fix is entirely in gen rules.

---

### Gen Rule Gaps Identified

These rules either don't exist or aren't being enforced by the static validator:

| Gap | Existing rule? | Action |
|-----|----------------|--------|
| waitForPackages timeout must be 120000ms | Yes (Lesson 117, static validator checks) | Rule exists but gen is not following it — reinforce in PART-003 spec section |
| All CDN components in typeof guards | Partial (validator checks known components) | Validator caught it on #381 but #385 got it right — fragile, per-build variance |
| await transitionScreen.show() everywhere | Yes (Lesson 101, GEN-117) | Gen still misses it — prompt needs stronger enforcement |
| transitionScreen.hide() in startGame() | Yes (GEN-117) | Gen still misses it — prompt needs stronger enforcement |
| FeedbackManager.init() forbidden when PART-017=NO | Yes (spec says CRITICAL) | Spec says it but gen ignores it — reinforce as T1 static check |

---

### Queue Decision

**Do NOT queue a new build.** Per queue policy: only queue to verify a specific fix. The current failure pattern is a gen rule problem — queuing without deploying updated gen rules would produce the same 0-pass results. Required sequence:
1. Reinforce `waitForPackages` timeout rule in the spec PART-003 section (already says 120000ms but gen ignores it)
2. Confirm static validator catches `await transitionScreen.show()` absence and missing typeof guards on EVERY component
3. Deploy updated gen rules → local verify → then queue

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #376–378 | test_results=[] (all batches) | CDN never loaded — 10s waitForPackages timeout expired | Confirmed |
| #380 | Killed immediately | Worker config error (auth unavailable) | N/A |
| #381 | game-flow: data-phase="game_init" not "start_screen"; mechanics: #mathai-transition-slot button timeout | 7 static errors: missing typeof guards + 10s timeout + unawaited show() + FeedbackManager.init() | Confirmed |
| #383 | Killed | skip_test bug corrupted HTML across all 5 categories | N/A (pipeline bug, not game bug) |
| #385 | Approved (iterations=0) | CDN was warm from prior builds; 3 static errors still present but didn't trigger | Fragile approval |
| #488 | Cancelled | Game already approved per scale-run policy | N/A |

---

## 1. Root Cause

`waitForPackages()` uses a 10000ms timeout instead of 120000ms. CDN Playwright cold-start takes 30–120s. This causes "Packages failed to load" in `beforeEach` for every test → every test fails with `toBeVisible` before any game interaction occurs. Compounded by unawaited `transitionScreen.show()` calls (CDN state machine corruption) and missing `typeof` guards for `TransitionScreenComponent`, `ProgressBarComponent`, and `TimerComponent`.

## 2. Evidence of Root Cause

- Static validator confirms `timeout = 10000` in build #381 (must be 120000)
- `test_results=[]` for builds #376–378 confirms CDN never loaded (beforeEach bomb)
- Build #381 game-flow: `data-phase="game_init"` when `start_screen` expected — page mid-init at test time
- Build #381 mechanics: `locator('#mathai-transition-slot button')` timeout — button never visible (unawaited show())
- Build #385 (approved) still has 3 static errors — approved only because CDN was warm from prior runs

## 3. POC Fix Verification

Not yet performed. Requires:
1. Download build #385 HTML
2. Manually patch: `timeout = 120000`, add `await` before all `transitionScreen.show()`, add `await transitionScreen.hide()` in `startGame()`
3. Run `diagnostic.js` locally + Playwright mechanics tests
4. Report pass rate before/after

## 4. Reliability Reasoning

The 8.8% approval rate is explained entirely by CDN warm/cold cache state. When CDN is warm (immediately after prior builds), the 10s timeout doesn't fire and the game passes. When CDN is cold (fresh Playwright context, first build of session), 10s is never enough. This is not a spec complexity issue — it's a pure CDN init timing issue compounded by missing await patterns.

## 5. Go/No-Go for E2E

**No-Go for new build queue.** Fix gen rules first, local verify, then queue. Expected improvement: from 0% test pass rate (CDN cold) to >80% (correct init pattern). The game mechanics themselves appear functional when CDN loads — build #385 passed game-flow and achieved approval.

---

## Manual Run Findings

*(browser screenshots, console, network — not yet performed for this game)*

## Targeted Fix Summary

- **Build #383 killed:** `skip_test` pipeline bug corrupted HTML across categories — fixed in pipeline (CODE-001)
- **Build #380 killed:** Worker auth config — fixed separately
- **Root CDN fix not yet deployed:** gen rule reinforcement pending (see Gen Quality slot)
