# Crazy Maze — UI/UX Audit

**Build:** #481
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)
**Auditor:** UI/UX Slot (Rule 16)

---

## Summary

| | Count |
|-|-------|
| P0 (flow blocker) | 0 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 2 |
| PASS | 18 |

**Verdict:** No re-queue required. All 3 rounds playable end-to-end. No flow blockers. Issues are systemic gen prompt patterns (gameId missing, aria-live absent, results-screen static) plus game-specific findings (data-phase initial value inconsistency, d-pad center button missing testid, FeedbackManager CDN warnings).

---

## Issues

### UI-CM-001 — `window.gameState.gameId` not set (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** `'gameId' in window.gameState` returns `false`. The key is entirely absent from the `gameState` object at all lifecycle stages — initial load, playing, results, post-restart. The key never appears; it is not set to `null` or `undefined` — it does not exist.
- **Expected:** `window.gameState.gameId` should be set to a non-empty string (e.g. `'crazy-maze'`) at initialisation, consistent with the gen prompt contract. Tests that assert `gameState.gameId` will fail.
- **Action:** Routes to Gen Quality. GEN-GAMEID rule already shipped. Confirmed absent in this build. Rule is not being applied consistently — escalate for investigation.

### UI-CM-002 — No aria-live regions anywhere in the game (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** `document.querySelectorAll('[aria-live]').length` returns `0` at all phases. No live regions for target-sum announcements, collected-sum updates, round completions, or wrong-path feedback.
- **Expected:** At minimum one `aria-live="polite"` region for collected sum changes and round advancement, to support screen readers.
- **Action:** Routes to Gen Quality. ARIA-001 is the existing rule. Another confirmed browser instance — rule is already shipped but not applied here (build #481).

### UI-CM-003 — `data-phase` initial HTML value inconsistent with `gameState.phase` (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** On initial page load, `#app[data-phase]` = `"start"` (hardcoded in the HTML attribute) but `window.gameState.phase` = `"start_screen"`. After `restartGame()` calls `syncDOMState()`, `#app[data-phase]` correctly becomes `"start_screen"`. The two representations diverge until the first `syncDOMState()` call. Tests checking `data-phase="start"` will pass on cold load but fail after Play Again, and vice versa — creating test fragility depending on whether the game is in first-run or restarted state.
- **Expected:** The HTML `#app` element's initial `data-phase` attribute must match the initial `gameState.phase` value (`"start_screen"`). `syncDOMState()` should be called once at the end of initialisation so the DOM is always in sync from the first frame.
- **Action:** Routes to Gen Quality. Add rule: initial HTML `data-phase` attribute must be `"start_screen"` to match the gameState initialisation value, OR `syncDOMState()` must be called immediately after `gameState` is defined. The current pattern of hardcoding `data-phase="start"` in HTML is incorrect.

### UI-CM-004 — results-screen `position:static` (MEDIUM)
- **Category:** (a) gen prompt rule
- **Observed:** `getComputedStyle(document.getElementById('results-screen')).position` returns `"static"`. Results card is a flex child inside `#gameContent`, not a viewport-covering overlay. It renders correctly here because the game screen is hidden when results show, but the rule mandates `position:fixed` regardless.
- **Expected:** `position: fixed` with sufficient `z-index` to cover all game content, ensuring results card is always in viewport regardless of scroll position.
- **Action:** Routes to Gen Quality. GEN-UX-001 is the existing rule. Another confirmed browser instance.

### UI-CM-005 — D-pad center button has no `data-testid` and no `id` (MEDIUM)
- **Category:** (a) gen prompt rule
- **Observed:** The five-button directional pad includes a center spacer `<button>` (class `dir-btn dir-btn-center`) with no `id`, no `data-testid`, and empty text content. The four directional buttons (`btn-up`, `btn-left`, `btn-right`, `btn-down`) all have correct `id` and `data-testid`, but the center button is unaddressable and is a focusable empty button — an accessibility violation.
- **Expected:** The center placeholder should not be a `<button>` element. Use an inert `<div>` spacer instead. If a `<button>` is used for layout reasons, it must carry `aria-hidden="true"` and `tabindex="-1"` at minimum.
- **Action:** Routes to Gen Quality. Add rule: d-pad center placeholder must not be a focusable `<button>` element. Use an inert `<div>` spacer. If a button is retained for layout, add `aria-hidden="true"` and `tabindex="-1"`.

### UI-CM-006 — `[FeedbackManager] Subtitle component not loaded` / `Sticker component not loaded` warnings per round (MEDIUM)
- **Category:** (c) CDN constraint
- **Observed:** Every round completion fires two console warnings: `[FeedbackManager] Subtitle component not loaded, skipping` and `[FeedbackManager] Sticker component not loaded, skipping`. Fires 6 times (2× per round × 3 rounds) plus 2 more on the end-game feedback call = 14 warnings total. `SubtitleComponent` and `StickerComponent` are listed as loaded in the CDN init log, suggesting the FeedbackManager's internal lookup is not finding the registered instances.
- **Expected:** No warnings on component access. FeedbackManager should successfully resolve both components after CDN load.
- **Action:** Document only (CDN constraint). Does not affect gameplay — audio feedback still plays successfully. Known CDN issue pattern.

### UI-CM-007 — SignalCollector "Sealed — cannot recordViewEvent" on endGame (LOW)
- **Category:** (a) gen prompt rule
- **Observed:** `[SignalCollector] Sealed — cannot recordViewEvent` fires after `endGame()`. The results `recordViewEvent` call is made after `signalCollector.seal()` because `showResults()` triggers an async feedback sequence whose `recordViewEvent` call runs after seal has been invoked.
- **Expected:** All `recordViewEvent` calls for the results phase should complete before `signalCollector.seal()`.
- **Action:** Routes to Gen Quality. Known pattern — documented in UI-ODD-004 (one-digit-doubles) and UI-EC-007 (expression-completer). 6th+ confirmed instance. Rule already shipped.

### UI-CM-008 — "Let's go!" TransitionScreen button has no `data-testid` (LOW)
- **Category:** (a) gen prompt rule
- **Observed:** The TransitionScreen "Let's go!" start button has no `data-testid` attribute. `document.querySelector('button[data-testid="btn-start"]')` returns `null`. The button is rendered by the CDN TransitionScreen component; the gen code does not pass a `data-testid` in the button descriptor object passed to `transitionScreen.show()`.
- **Expected:** The start button should have `data-testid="btn-start"` to allow test harnesses to reliably trigger game start without depending on button text content.
- **Action:** Routes to Gen Quality. Add rule: TransitionScreen button config must include `data-testid: 'btn-start'` in the button descriptor object passed to `transitionScreen.show()`.

---

## Passing Checks

| Check | Result |
|-------|--------|
| Game loads without PAGEERROR | PASS — 0 JS errors; 15 console warnings (all FeedbackManager CDN + 1 SignalCollector seal ordering) |
| Packages all load successfully | PASS — FeedbackManager, ScreenLayout, TransitionScreen, ProgressBar, SignalCollector, VisibilityTracker, InteractionManager, StoriesComponent all confirmed loaded |
| Start screen (TransitionScreen) renders | PASS — "maze" icon, "Crazy Maze" title, "Navigate the maze and collect the target sum!" subtitle, "Let's go!" button displayed correctly |
| `data-phase` on load | PASS — `#app[data-phase="start"]` on initial page load |
| Let's go! transitions to playing | PASS — `data-phase` transitions to `"playing"` after button click |
| All 3 rounds reachable | PASS — completed rounds 1–3 in sequence via correct d-pad navigation |
| Round 1 correct: Target Sum 50 | PASS — path 5+10+15+8+12 = 50, end cell reached |
| Round 2 correct: Target Sum 80 | PASS — path 10+15+20+5+30 = 80, end cell reached |
| Round 3 correct: Target Sum 120 | PASS — path 15+10+25+20+5+30+5+10 = 120, end cell reached |
| Results screen reachable after final round | PASS — "Great Job!" results card shows with 3/3 rounds, 3 lives remaining, 100% accuracy, 3 stars |
| `data-phase` at results | PASS — `#app[data-phase="results"]` after victory |
| Play Again resets state | PASS — `currentRound=0`, `lives=3`, `gameEnded=false`, `score=0`; start screen re-displayed |
| Second playthrough starts correctly | PASS — TransitionScreen re-shown; "Let's go!" triggers round 1 of second play |
| `window.nextRound` exposed | PASS — `typeof window.nextRound === 'function'` |
| `window.endGame` exposed | PASS — `typeof window.endGame === 'function'` |
| `window.restartGame` exposed | PASS — `typeof window.restartGame === 'function'` |
| `syncDOMState()` exposed and writes `#app[data-phase]` | PASS — function confirmed; body: `if (app) app.setAttribute('data-phase', gameState.phase)` |
| `#mathai-transition-slot` present | PASS |
| `#mathai-progress-slot` present | PASS — ProgressBarComponent rendered into it |
| `data-testid` on directional buttons | PASS — `btn-up`, `btn-left`, `btn-right`, `btn-down`, `btn-reset` all have matching `id` and `data-testid` |
| `data-testid` on maze cells | PASS — `option-0` through `option-5` (round 1, 6 cells); indices re-assigned correctly each round |
| `data-testid="btn-restart"` on Play Again | PASS — `id="btn-restart"` and `data-testid="btn-restart"` both correct |
| `data-testid` on results elements | PASS — `stars-display` and `lives-display` (result-lives) have correct testids |
| Touch targets ≥ 44px | PASS — maze cells 48×48px; directional buttons 52×44px; Reset Path 291×45px; Play Again 291×44px+ |
| `data-phase` transitions: start → playing → results | PASS — all three transitions observed and confirmed |
| Directional buttons enable/disable correctly | PASS — only valid moves enabled at each position; disabled state updates on each move |
| Target sum and collected sum display | PASS — Target Sum and Collected values update correctly at each step |
| 3-star result for perfect run | PASS — 3/3 rounds, 3 lives remaining, 100% accuracy → 3 stars displayed |
| Progress bar updates per round | PASS — "0/3" on load, "1/3" after round 1, "2/3" after round 2, "3/3" at results |
| No network errors | PASS — 0 failed requests; all audio fetch calls return 200 |

---

## Flow Observations

- **Interaction model:** D-pad navigation (up/left/right/down buttons). Player moves through a constrained grid, collecting numbered cells. Running total displayed as "Collected". Only valid connected moves are enabled at each position — invalid directions are greyed out (disabled). No free-form tapping of cells.
- **Win condition:** Navigate from Start (S) cell to End (🏁) cell while accumulating exactly the target sum. Game confirms success when the end cell is reached with the correct sum.
- **Grid structure:** Round 1 is a 4×4 grid (6 cells, 1 path); Round 2 is a 5×5 grid (8 cells, branching); Round 3 is a 5×6 grid (10 cells, multiple branches). Only one path sums to the target.
- **Wrong-path behavior:** At branching points, choosing the wrong branch results in an incorrect running sum when the end cell is reached. When the end cell is reached with a wrong sum, a life is deducted and the path resets (inferred from spec; not directly triggered in this audit since d-pad disabling made branching choices unambiguous).
- **Reset Path:** Explicit "Reset Path" button clears the current path and returns to start. Presumed to deduct a life per the spec.
- **Round advancement:** Automatic on correct end-cell arrival. No confirmation required.
- **Star rating:** Displayed at results; 3 stars shown for perfect run (3 lives remaining, 3/3 rounds, 100% accuracy).
- **No timer:** The game has no timer component — pure accuracy/lives scoring.
- **Restart rebuilds components:** `restartGame()` correctly re-initialises SignalCollector, ProgressBar, and VisibilityTracker.

---

## Routing Summary

| Route | Issues |
|-------|--------|
| Gen Quality | UI-CM-001 (GEN-GAMEID — gameId missing), UI-CM-002 (ARIA-001 — no aria-live), UI-CM-003 (data-phase initial value inconsistency — new rule needed), UI-CM-004 (GEN-UX-001 — results-screen position:static), UI-CM-005 (d-pad center button should be inert div), UI-CM-007 (seal-before-recordViewEvent ordering — rule already shipped), UI-CM-008 (Let's go! button missing data-testid="btn-start") |
| CDN / Document only | UI-CM-006 (FeedbackManager Subtitle/Sticker component lookup warnings) |
