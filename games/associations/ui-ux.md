# associations — UI/UX Audit

**Build audited:** #578 (re-queue from #513 — P0 restartGame() crash fix verification)
**Audit date:** 2026-03-23
**Auditor:** UI/UX Slot (full browser playthrough)
**HTML URL:** https://storage.googleapis.com/mathai-temp-assets/games/associations/builds/578/index.html
**Previous audit:** #513 full browser playthrough (2026-03-23) — 1 P0 (white screen on Play Again, TypeError in transitionScreen.show()) + 4 MEDIUM + 2 LOW

---

## Summary

**1 P0 (timer.getTime crash blocks results screen — game stuck on last recall screen), 0 HIGH, 3 MEDIUM, 2 LOW.**

Build #578 completes all 3 rounds and Play Again (GEN-ISACTIVE-GUARD) no longer crashes — the white screen P0 from #513 is FIXED. However a new P0 exists: `TypeError: timer.getTime is not a function` in `endGame()` at line 706 crashes before `showResults()` can be called. The results screen (`#results-screen`) is in the DOM but stays `display: none` with all metrics showing 0. The game appears stuck on the last recall screen. The results screen is technically unreachable to the user without a code fix.

Total: **8 findings — 6(a), 0(b), 0(c), 2(d)**

---

## Checklist Results (Browser Playthrough — 375×812px Playwright MCP)

| Check | Result | Notes |
|-------|--------|-------|
| CDN packages load | PASS | All 11 components load; ScreenLayout, ProgressBar, TransitionScreen, TimerComponent, etc. |
| Zero network 404s | PASS | All audio requests return 200; loading.json CDN asset fails (4 requests, known CDN issue, non-blocking) |
| `window.gameState.gameId` set | PASS — FIXED | `gameState.gameId = "game_associations"` — UI-ASC-005 FIXED from #513 |
| `window.endGame` exposed | PASS | Present and callable |
| `window.restartGame` exposed | PASS | Present and callable |
| `window.nextRound` exposed | PASS | Present and callable |
| `window.syncDOMState` exposed | PASS | Present; correctly targets `#app` (not `body`) — LP-4 confirmed non-violation |
| `syncDOMState()` targets `#app` | PASS | Sets `#app[data-phase]`, `#app[data-round]`, `#app[data-score]` |
| `data-phase` transitions | PARTIAL | `start` → `learn` → `recall` → `transition` → `results` (DOM correct) but `results` phase never renders visually |
| `data-round` updates | PASS | Increments correctly: 0→1→2→3 at round transitions |
| `data-score` updates | PASS | Increments on each correct answer during recall |
| `data-testid="option-N"` on choice buttons | PASS | `option-0` through `option-3` present during recall |
| `data-testid="btn-restart"` | PASS — FIXED | Present; `data-testid="results-screen"` also now present (both were missing in #513) |
| `data-testid="results-screen"` | PASS — FIXED | `#results-screen` has `data-testid="results-screen"` — UI-ASC-004 FIXED from #513 |
| `data-testid="stars-display"` | PASS | Present in DOM (unpopulated due to P0) |
| `data-testid="score-display"` | PASS | Present in DOM (shows 0/0 due to P0) |
| `aria-live` region present | FAIL — UI-ASC-003 | Zero `aria-live` regions at any phase |
| Results screen `position:fixed` | FAIL — UI-ASC-002 | `position: static` on `#results-screen` (GEN-UX-001 violation) |
| Touch targets ≥44px (choice buttons) | PASS | 145×51px — passes minimum |
| Touch targets ≥44px (btn-restart) | BORDERLINE — UI-ASC-006 | 143×43px — 1px below 44px minimum (same as #513) |
| All 3 rounds completable | PASS | Round 1 (3 pairs), Round 2 (4 pairs), Round 3 (5 pairs) all completed via recall |
| Results screen reachable (visible) | FAIL — P0 UI-ASC-P0-001 | Results screen not shown — timer.getTime TypeError in endGame() blocks showResults() call |
| Results screen populated | FAIL — P0 UI-ASC-P0-001 | Score 0/0, Time 0:00, Correct 0, Accuracy 0% — endGame() crashed before populating values |
| Restart / Play Again | PASS — FIXED | Play Again shows start screen, state resets (score=0, round=0, gameEnded=false) — UI-ASC-P0-001 from #513 FIXED |
| Progress bar resets on restart | FAIL — UI-ASC-009 | Progress bar still shows "3/3 rounds completed" after restart (not reset to 0/3) |
| Sentry 3-script pattern | PASS | v10.23.0 three-script pattern present |
| No alert/confirm/prompt | PASS | None found |
| Console errors (non-audio) | FAIL — P0 UI-ASC-P0-001 | `timer.getTime is not a function` in endGame() — 1 uncaught TypeError |

---

## Issues

### [P0] UI-ASC-P0-001 — timer.getTime crash in endGame() — results screen never shown

- **Observed:** After answering the last recall question in round 3, the game hangs on the recall screen. Buttons become disabled but the results screen never appears. `data-phase="results"` is set in the DOM (syncDOMState still runs via the wrapper), but `#results-screen` remains `display: none` and all result metrics show 0.
- **Error:** `TypeError: timer.getTime is not a function` at `endGame()` line 706, called via `nextRound()` → `showRecallQuestion()` → `handleChoice()`. Full trace:
  ```
  TypeError: timer.getTime is not a function
      at endGame (index.html:706:45)
      at window.<computed> (index.html:1039:31)
      at nextRound (index.html:666:17)
      at showRecallQuestion (index.html:556:17)
      at handleChoice (index.html:658:13)
  ```
- **Root cause:** `endGame()` calls `timer.getTime()` to calculate elapsed time, but `timer` is either a local variable not in scope at call time, a CDN `TimerComponent` instance that doesn't expose `.getTime()`, or the timer object was destroyed before `endGame()` runs. `TimerComponent` is loaded in `MathAIComponents` but the game accesses it via a local variable reference that is out of scope or the CDN's `TimerComponent` API does not have a `.getTime()` method.
- **Impact:** Results screen is entirely unreachable. Score, accuracy, and time are never displayed. User is permanently stuck on a frozen recall screen after completing all rounds. P0.
- **Note:** This error was already present in #513 (logged in ui-ux.md as UI-ASC-007 LOW — "fires 20+ times during gameplay") but was classified LOW because in #513 it was a repeating non-crash error during gameplay. In #578 the error moved from a side-effect to a fatal crash in `endGame()` itself, blocking results display entirely.
- **Classification:** (a) gen prompt rule — `endGame()` must not call `timer.getTime()`. The CDN `TimerComponent` API does not expose a `.getTime()` method (or the timer reference is stale/destroyed). Use `Date.now() - gameState.startTime` for elapsed time, or use `gameState.duration_data` if TimerComponent stores it there.
- **Action:** REQUIRES RE-QUEUE. Add gen rule: never call `timer.getTime()` — use `Date.now() - gameState.startTime` for elapsed time calculation in `endGame()`.

---

### [MEDIUM] UI-ASC-009 — Progress bar not reset on Play Again

- **Observed:** After clicking "Play Again" and returning to the start screen, the progress bar header still reads "3/3 rounds completed" (fully filled bar). Game state resets correctly (`score=0`, `round=0`, `gameEnded=false`), but the CDN ProgressBar component itself is not reset. When the new game starts, the bar jumps from 3/3 to 0/3 only after the first nextRound call.
- **Classification:** (a) gen prompt rule — `restartGame()` must call `progressBar.reset()` or `progressBar.update(0, totalRounds)` before re-initializing the game.
- **Action:** Route to Gen Quality. Add rule: `restartGame()` must call ProgressBar reset method.

---

### [MEDIUM] UI-ASC-002 — Results screen position:static (GEN-UX-001 — 12th confirmed instance)

- **Observed:** `#results-screen` has `position: static` (computed). Results card is not a full-screen overlay — it appears inline in the content flow. GEN-UX-001 requires `position: fixed; top: 0; left: 0; width: 100%; height: 100%`.
- **Classification:** (a) gen prompt rule
- **Action:** 12th confirmed GEN-UX-001 instance. Route to Gen Quality to verify rule is active and enforced. Also note: `#results-screen` now correctly has `data-testid="results-screen"` — the testid issue from #513 is fixed.

---

### [MEDIUM] UI-ASC-003 — No aria-live region; answer feedback is CSS-only

- **Observed:** Zero `aria-live` elements in DOM at any phase. When a choice button is clicked, only CSS classes change — no text announcement. Screen reader users get no feedback.
- **Classification:** (a) gen prompt rule
- **Action:** ARIA-001 already shipped. 15th confirmed instance. Route to Gen Quality to verify rule coverage.

---

### [MEDIUM] UI-ASC-006 — btn-restart height is 43px (1px below 44px minimum)

- **Observed:** `data-testid="btn-restart"` (Play Again button) measures 143×43px at 375px viewport. One pixel below the WCAG 44px touch target minimum. Same as #513.
- **Classification:** (a) gen prompt rule
- **Action:** Add rule: `min-height: 48px` on `.game-btn.btn-primary`. Persistent across builds; not caught by current gen rules.

---

### [LOW] UI-ASC-007 — FeedbackManager subtitle component missing warning (repeating)

- **Observed:** `[WARNING] [FeedbackManager] Subtitle component not loaded, skipping` fires on every audio play event (6+ warnings per game session). FeedbackManager initialised without a SubtitleComponent reference.
- **Classification:** (c) CDN constraint — FeedbackManager requires SubtitleComponent to be registered before audio playback
- **Action:** Document only. CDN constraint. Verify whether GEN-FEEDBACK-SUBTITLE rule exists.

---

### [LOW] UI-ASC-010 — loading.json Lottie animation 404s (4 failures)

- **Observed:** `https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/loading.json` fails with `net::ERR_ABORTED` 4 times. This is the Lottie loading animation asset. Visually non-blocking (no visible spinner shown), but pollutes network log.
- **Classification:** (c) CDN constraint — asset not available on CDN
- **Action:** Document only. CDN asset availability issue; gen code should not reference this Lottie path if asset is unavailable.

---

## What Changed from #513 to #578

| Finding | #513 | #578 | Status |
|---------|------|------|--------|
| restartGame() white screen crash | P0 | — | **FIXED** |
| gameState.gameId absent | MEDIUM | PASS | **FIXED** |
| data-testid="results-screen" missing | MEDIUM (implied) | PASS | **FIXED** |
| timer.getTime error (endGame crash) | LOW (non-blocking repeating) | **P0** (fatal — blocks results) | **REGRESSED / ESCALATED** |
| results-screen position:static | MEDIUM | MEDIUM | persists |
| No aria-live | MEDIUM | MEDIUM | persists |
| btn-restart 43px | MEDIUM | MEDIUM | persists |
| FeedbackManager subtitle warning | LOW | LOW | persists |
| Progress bar not reset on restart | not tested | MEDIUM | new finding |

---

## Passing Checks

- CDN packages (11 components + 6 helpers) all load — 0 CDN load errors
- All 3 rounds (3-pair, 4-pair, 5-pair) complete correctly end-to-end
- Progress bar updates correctly during gameplay: 0/3 → 1/3 → 2/3 → 3/3
- TransitionScreen used with correct object API `{icons, title, subtitle, buttons}` throughout
- `syncDOMState()` correctly targets `#app` (not `body`) — LP-4 non-violation confirmed
- Choice buttons use `data-testid="option-0"` through `option-3`
- `data-testid="btn-restart"`, `stars-display`, `score-display`, `results-screen` all present in DOM
- `data-phase` transitions correctly: `start` → `learn` → `recall` → `transition` → `results` (DOM level)
- `data-round` increments: 0 → 1 → 2 → 3
- `data-score` increments on correct answers
- FeedbackManager dynamic audio (correct/incorrect feedback) plays on answers — network fetches all succeed
- **Play Again no longer crashes** — start screen shown, state fully reset (score, round, gameEnded all correct)
- `window.gameState.gameId = "game_associations"` — correctly populated
- Sentry SDK v10.23.0 three-script pattern present
- No `alert()`, `confirm()`, or `prompt()` calls

---

## Flow Observations

- **Start screen:** TransitionScreen with "Associations" title, "Remember the faces!" subtitle, "Let's go!" button (140×47px). Clean.
- **Learn phase:** Face emoji + name + "Pair N of M" counter. Timer counts up. Pairs auto-advance with decreasing exposure duration across rounds (3000ms / 2500ms / 2000ms — good difficulty progression).
- **Recall phase:** Face emoji shown, "Who is this?", 4 MCQ choice buttons (2×2 grid, 145×51px). Answer advances immediately on click. Correct feedback plays audio.
- **Transition screen:** Between rounds, TransitionScreen CDN shows "Round N" + "Get ready for the next set!" + "Continue" button. Clean.
- **Results screen:** In DOM but never displayed. `endGame()` crashes on `timer.getTime()` at line 706 — `showResults()` never called, results div stays `display: none`, all stats remain 0.
- **Play Again:** Returns to start screen correctly. No white screen crash. State reset confirmed. Progress bar not reset (shows stale 3/3).

---

## Routing Summary

| Finding | Severity | Slot | Action |
|---------|----------|------|--------|
| UI-ASC-P0-001 — timer.getTime crash blocks results screen | P0 | Gen Quality + Build Queue | Re-queue; never call `timer.getTime()` — use `Date.now() - gameState.startTime` |
| UI-ASC-009 — Progress bar not reset on restart | MEDIUM | Gen Quality | restartGame() must call progressBar reset method |
| UI-ASC-002 — results-screen position:static | MEDIUM | Gen Quality | 12th GEN-UX-001 instance; verify rule active |
| UI-ASC-003 — No aria-live | MEDIUM | Gen Quality | 15th ARIA-001 instance; verify rule active |
| UI-ASC-006 — btn-restart 43px (1px below min) | MEDIUM | Gen Quality | Add min-height: 48px for .game-btn.btn-primary |
| UI-ASC-007 — FeedbackManager subtitle warning | LOW | Gen Quality | Verify GEN-FEEDBACK-SUBTITLE rule exists; CDN constraint |
| UI-ASC-010 — loading.json Lottie 404s | LOW | Document only | CDN asset unavailable; document constraint |

**Verdict:** P0 — re-queue required. The `timer.getTime is not a function` error in `endGame()` prevents the results screen from ever showing. All 3 rounds complete correctly, Play Again no longer crashes (FIXED), but the game is not completable from the user's perspective (no results screen). Fix: remove `timer.getTime()` call from `endGame()` and compute elapsed time from `Date.now() - gameState.startTime`.
