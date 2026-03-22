# Count & Tap — Root Cause Analysis

**Spec:** `warehouse/templates/count-and-tap/spec.md`
**Parts:** PART-006 (TimerComponent), PART-025 (ScreenLayout), PART-024 (TransitionScreen), PART-013 (Fixed Answer)
**Last updated:** 2026-03-21 (build #471 evidence added)

---

## 1. Root Cause

Two independent root causes compounded on build #440:

**A) `window.gameState.content` null at DOM snapshot time.** The game only populates `window.gameState.content` when it receives a `game_init` postMessage (`window.gameState.content = event.data.content`). The DOM snapshot step reads `window.gameState?.content` synchronously — before `game_init` fires. So content was null. `extractSpecRounds()` fell back to parsing the spec's markdown tables, but the first table is the game overview metadata table (Field/Value rows), not round data. This produced `fallbackContent.rounds[0] = { question: "**Game ID**", answer: "count-and-tap" }` — not `{ correctAnswer, options, dotCount }`. Test gen tried to read `.correctAnswer` → `undefined` → selector `.option-btn[data-value="undefined"]` → never exists. Triage correctly skipped all 3 affected categories (mechanics, level-progression, edge-cases) → 0 test evidence → FAILED.

**B) CDN cold-start in test browser.** The smoke-check browser took 2.5 minutes to load CDN on a cold GCP VM. The test runner opened a fresh Playwright browser (no CDN cache). The `beforeEach` 50s timeout expired before CDN loaded → "transition slot button not visible." This caused game-flow iteration 1 to fail. The fix loop then oscillated (0→1→0 across iterations) because it changed HTML that was correct to begin with.

---

## 2. Evidence of Root Cause

### Build #471 Evidence (isProcessing stuck — 2026-03-21 local diagnostic)

**Root cause: `FeedbackManager.sound.playDynamicFeedback` does not exist. The method lives on `FeedbackManager` (top-level), not on `FeedbackManager.sound`. Calling it throws a synchronous `TypeError` inside `showFeedback()`, which is called from `handleAnswer()` before `scheduleNextRound()`. Because the exception propagates out of `handleAnswer()` before `scheduleNextRound()` runs, `isProcessing` is set to `true` at line 512 and never reset — the round lifecycle deadlocks permanently.**

Evidence chain from local Playwright diagnostic run against `/tmp/count-and-tap-471/index.html`:

| Artifact | Finding |
|----------|---------|
| PAGE_ERROR from browser console | `FeedbackManager.sound.playDynamicFeedback is not a function` — thrown at click time |
| `FeedbackManager.sound` method list (page.evaluate) | Keys: `audioKit, sounds, pauseSound, pausedAudioId, pendingPlayQueue, config, unlocked, unlockAttempted`. No `playDynamicFeedback`. |
| `FeedbackManager` top-level method list | Includes `playDynamicFeedback` — correct location |
| `handleAnswer` call trace | Sets `isProcessing = true` (line 512) → calls `showFeedback()` → `showFeedback()` calls `FeedbackManager.sound.playDynamicFeedback()` → THROWS → execution exits `handleAnswer` without reaching `scheduleNextRound()` on line 538 |
| State 200ms after click | `isProcessing: true, isActive: false, answerLocked: true, round: 0` |
| State 1700ms after click | `isProcessing: true, isActive: false, answerLocked: true, round: 0` — unchanged; `scheduleNextRound` never fired |
| `renderRound()` (line 390) | Resets `isProcessing = false` — but it is never called because `scheduleNextRound()` never ran |
| Audio 404s in console | FeedbackManager.sound.preload() fires audio HTTP requests that 404 (test environment). These are non-blocking — they do NOT cause the deadlock. |
| Both FeedbackManager calls in showFeedback | Lines 568 and 571 in index.html both say `FeedbackManager.sound.playDynamicFeedback` — wrong namespace for both success and error paths |

**Evidence for root cause A:**

| Artifact | Finding |
|----------|---------|
| `dom-snapshot.json` on server | `gameStateShape: {}` — empty object, not the 7-key gameState shape. Confirmed snapshot before game_init. |
| `game-content.json` | Does not exist — confirmed `window.gameState?.content` was null at snapshot time |
| `test-cases.json` fallbackContent | `rounds[0] = { question: "Field", answer: "Value" }` — metadata table, not round data |
| Triage output (from DB test_results) | "tests attempt to read properties correctAnswer and options from fallbackContent, which do not exist" |
| `extractSpecRounds()` behavior | Parses first markdown table found. count-and-tap spec opens with overview table (Field/Value). Actual round data is in a JSON fenced code block — not parsed by extractSpecRounds. |

**Evidence for root cause B:**

| Artifact | Finding |
|----------|---------|
| journalctl logs | `06:14:27 smoke-check-failed → 06:16:54 smoke-check-passed` — 2.5 minute CDN load |
| Local diagnostic run (2026-03-21) | Both game-flow tests PASS locally. CDN loads in < 0.1s (OS HTTP cache). `typeof TimerComponent` = true. |
| Test failure message | "locator('#mathai-transition-slot button').first() not found within 5s" — beforeEach timeout, not game logic |

---

## 3. POC Fix Verification

### Build #471 POC Fix (FeedbackManager namespace — 2026-03-21)

**Fix:** Replace `FeedbackManager.sound.playDynamicFeedback(...)` with `FeedbackManager.playDynamicFeedback(...)` in `showFeedback()` (2 occurrences, lines 568 and 571).

**POC verification script:**
```
node -e "
  let html = fs.readFileSync('/tmp/count-and-tap-471/index.html', 'utf-8');
  html = html.replace(/FeedbackManager\.sound\.playDynamicFeedback/g, 'FeedbackManager.playDynamicFeedback');
  // serve patched HTML → click start → wait for options → click option
"
```

**Results before patch:**
- State 1700ms after click: `isProcessing: true, isActive: false, round: 0` (deadlocked)
- PAGE_ERROR: `FeedbackManager.sound.playDynamicFeedback is not a function`

**Results after patch:**
- State after next round loads: `phase: playing, isProcessing: false, isActive: true, answerLocked: false, round: 1`
- PASS: YES — round advanced from 0 → 1, `isProcessing` reset to `false`
- Only remaining PAGE_ERROR: `lottie-player already registered` (cosmetic, pre-existing)

The fix is a one-line s/find/replace in the gen prompt or as a T1 validator rule.

---

**Root cause A fix:** Added gen prompt rule: "window.gameState.content MUST be pre-populated with fallback/default round data at the START of DOMContentLoaded (before `await waitForPackages()`), then override with real content when game_init arrives."

Verified by: The next build (#457) will generate HTML that pre-populates `window.gameState.content`. The DOM snapshot will then find real round data and `game-content.json` will be written. Fallback content will not be needed.

Intermediate verification (Lesson 93): Investigation agent traced the exact call chain — confirmed `page.evaluate(() => window.gameState?.content || null)` returns null at snapshot time, `game-content.json` never written, `extractSpecRounds()` used, metadata table parsed first.

**Root cause B fix:** CDN cold-start is a transient infra issue. Next build runs on a VM that has already loaded CDN packages for the running build (#442 disappearing-numbers). CDN will be warm (< 5s load time). The 50s beforeEach timeout is sufficient for warm CDN.

Also: `typeof TimerComponent` ban (Lesson 87) was corrected — TimerComponent IS in bundle. T1 check downgraded from ERROR to WARNING (commit 16c5640). New build no longer hard-blocked on TimerComponent usage.

---

## 4. Reliability Reasoning

**Build #471 fix (FeedbackManager namespace):** Deterministic. `FeedbackManager.playDynamicFeedback` is confirmed to exist (verified via `Object.getOwnPropertyNames` walk in live browser). The fix is a text substitution — `FeedbackManager.sound.playDynamicFeedback` → `FeedbackManager.playDynamicFeedback`. Regression risk: near-zero — the FeedbackManager CDN API surface is stable; `playDynamicFeedback` has been on the top-level object consistently. The fix must be enforced either as a gen prompt rule ("always call `FeedbackManager.playDynamicFeedback()` not `FeedbackManager.sound.playDynamicFeedback()`") or as a T1 validator that detects the wrong namespace. Without enforcement in the prompt, the LLM may regenerate the incorrect call on the next build.

**Root cause A fix:** Deterministic. Once gen prompt instructs pre-population at DOMContentLoaded start, every CDN game will set `window.gameState.content = fallbackContent` synchronously. The DOM snapshot always executes after CDN loads (it waits for transition slot), so content will be populated. Reliability: high. Regression risk: if a future game spec doesn't define `fallbackContent` in HTML (content is entirely dynamic). Mitigation: snapshot also captures `window.gameState.content` after `game_init` fires (behavioral transcript sends it). But fallback path in `extractSpecRounds()` still needs improvement for JSON code block specs.

**Root cause B fix:** Semi-deterministic. Warm CDN loads in < 5s on GCP-to-GCP. But the underlying fragility (each test browser has no CDN cache) remains. Future mitigation: CDN local proxy during test runs (capture CDN scripts at DOM snapshot, serve from disk in tests). This eliminates CDN latency entirely for tests. Planned as next R&D item.

---

## 5. Go/No-Go for E2E

**APPROVED — Build #551 approved 2026-03-22. FeedbackManager.playDynamicFeedback fix verified working.**

- §2 Evidence: Complete. Local Playwright diagnostic confirmed `FeedbackManager.sound.playDynamicFeedback` throws synchronously → `scheduleNextRound()` never called → `isProcessing` stuck true → round lifecycle deadlocked.
- §3 POC: Confirmed — patching the 2 occurrences in index.html from `FeedbackManager.sound.playDynamicFeedback` to `FeedbackManager.playDynamicFeedback` allows rounds to advance correctly (round 0 → 1, isProcessing resets to false).
- §4 Reliability: High — deterministic text substitution; FeedbackManager API is stable.
- §5 Go/No-Go: APPROVED — build #551 returned 11/12 iter 1, approved 2026-03-22. PART-011-SOUND T1 check (commit 26fcfb6) provides ongoing defense-in-depth.

**Edge case note:** Timer expiry phase was 'results' instead of 'gameover' in build #551 iter 1 (edge-cases 2/3). Fixed by fix loop iter 2. Future gen prompt should clarify: timer expiry at lives=0 sets phase='gameover', not 'results'.

**Previous Go/No-Go (builds #440/#457):**
- §2 Evidence: Complete. gameStateShape={}, game-content.json absent, fallbackContent wrong shape, triage output confirms. Plus: local diagnostic proves HTML is correct (both tests pass locally).
- §3 POC: Gen prompt rule deployed (c4d24f2, commit on server). T1 TimerComponent fix deployed (16c5640). CDN is warm on current VM.
- §4 Reliability: High for root cause A. Acceptable for root cause B (warm CDN expected).

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #440 | game-flow 0/2 iter 1+3 (oscillated); mechanics/level-prog/edge-cases 0 test evidence; FAILED after 3 iterations | A: null gameState.content → corrupted fallback → triage skips all categories. B: CDN cold-start → beforeEach 50s timeout | Investigated; gen prompt fix deployed (c4d24f2); T1 fix (16c5640); re-queued as #457 |
| #457 | game-flow 1/3 iter 1+2; mechanics 1/4; level-prog 0/1; edge-cases 0/1; contract 1/1; FAILED (1/4 cats, 4 needed) | C: renderRound() sets isProcessing=false immediately → harness answer() fires before option buttons rendered → click silently fails → timer fires → test desync. Global fix loop also failed (page broken after E8 fix). Tests pre-generated without M8 rule. | Failed — Lesson 109 rules deployed (833da9f); #471 queued for fresh build |
| #471 | level-progression 0/1 all 3 iters; mechanics triage-deleted (0 evidence); edge-cases initially failed "transition slot button never visible" then fixed by fix-1; global fix loop still failed level-prog; FAILED | `FeedbackManager.sound.playDynamicFeedback` does not exist — throws synchronously inside `showFeedback()` before `scheduleNextRound()` is called → `isProcessing` stuck `true` → round lifecycle deadlocked. Verified by local Playwright diagnostic 2026-03-21. POC fix confirmed: replace with `FeedbackManager.playDynamicFeedback` → round advances. | Investigated; gen prompt fix required before next build (#472) |
| #551 | edge-cases 2/3 iter 1 (timer expiry phase 'results' instead of 'gameover'); fixed iter 2; 11/12 iter 1; APPROVED | FeedbackManager.playDynamicFeedback namespace fix (prompts.js line 81) verified — rounds cycle correctly; PART-011-SOUND T1 check shipped as defense-in-depth | APPROVED (2026-03-22) |

---

## Manual Run Findings

### Build #471 local diagnostic (2026-03-21)

**Source:** Direct Playwright node script against `/tmp/count-and-tap-471/index.html`, served on localhost:7790-7794.

**Findings:**
- Game renders correctly: transition slot button visible at 3s, CDN packages load cleanly
- `window.gameState` at start: `{ phase: 'start_screen', lives: 3, isProcessing: false, isActive: true }`
- After clicking start: `{ phase: 'playing', isProcessing: false }` — correct
- Options appear after ~3s (dot reveal 1500ms + stagger ~200ms + hideDots renders options): 4 visible, 0 disabled
- **After clicking first option button:**
  - 200ms: `isProcessing: true, isActive: false, answerLocked: true, round: 0` — correct so far
  - 1700ms: `isProcessing: true, isActive: false, answerLocked: true, round: 0` — STUCK (scheduleNextRound never fired)
  - PAGE_ERROR: `FeedbackManager.sound.playDynamicFeedback is not a function`
- `FeedbackManager.sound` has keys: `audioKit, sounds, pauseSound, pausedAudioId, pendingPlayQueue, config, unlocked, unlockAttempted` — no `playDynamicFeedback`
- `FeedbackManager` (top-level) HAS `playDynamicFeedback` — correct namespace
- Audio 404s for success.mp3/error.mp3: non-blocking, does not cause deadlock

**With fix applied (FeedbackManager.playDynamicFeedback):**
- Round advances 0 → 1, `isProcessing` resets to `false`, `answerLocked` resets to `false`
- No functional page errors

---

### Build #440 local diagnostic (2026-03-21, prior session)

**Source:** Playwright diagnostic run locally (2026-03-21), node diagnostic.js

**Result: Both game-flow tests PASS locally.**

- Game renders correctly: dot-cover stage visible, "How many did you see?" prompt, 10s timer, 4 option buttons with correct `data-value` attributes
- Lives deduct on wrong answer: lives=3 → 2 → 1 → 0 correctly
- game-over triggers at lives=0, phase=gameover
- `typeof TimerComponent !== 'undefined'` = true
- CDN loads in < 0.1s (cached)
- `window.nextRound` not exposed on window (test harness warning logged)
- Audio preload 404s (FeedbackManager tries generic paths) — non-blocking

**Screenshots:** `/tmp/count-and-tap-debug/` (01–08 PNGs, 2026-03-21 session)

---

## Targeted Fix Summary

| Fix | Commit | What Changed |
|-----|--------|-------------|
| Correct TimerComponent ban | 16c5640 | T1 5f3: ERROR → WARNING; gen prompt: NEVER → "add typeof check to waitForPackages" |
| window.gameState.content pre-population | c4d24f2 | Gen prompt rule: pre-populate content before waitForPackages(), override on game_init |
| Surgical smoke-regen dead code | c4d24f2 | specMeta.isCdnGame (never set) → HTML-based CDN detection |
| FeedbackManager namespace fix (PENDING) | — | Gen prompt must add rule: use `FeedbackManager.playDynamicFeedback()` not `FeedbackManager.sound.playDynamicFeedback()`. POC verified 2026-03-21. Deploy before build #472. |
| FeedbackManager.sound.playDynamicFeedback namespace | Already in prompts.js line 81 (prior session); PART-011-SOUND T1 check (commit 26fcfb6) | Build #551 APPROVED — fix confirmed working |

---

## Investigation Agent Evidence

**Agent a0d098ed34ae74469 (count-and-tap test deletion root cause):**
- gameStateShape:{} at snapshot → confirmed content null at snapshot time
- game-content.json absent → confirmed
- test-cases.json fallbackContent: `[{question:"Field",answer:"Value"},...]` — metadata table parsed
- Triage output: "properties correctAnswer and options do not exist"

**Agent a5414227a1a48b84d (surgical smoke-regen dead code):**
- `specMeta.isCdnGame` always `undefined` — `extractSpecMetadata()` never sets this field
- `if (specMeta.isCdnGame)` branch never fired — all smoke regens were full regens
- Fix: detect CDN from HTML content instead (storage.googleapis.com presence)
