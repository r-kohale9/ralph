# One Digit Doubles — UI/UX Audit

**Build:** #487
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)
**Auditor:** UI/UX Slot (Rule 16)

---

## Summary

| | Count |
|-|-------|
| P0 (flow blocker) | 0 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 2 |
| PASS | 16 |

**Verdict:** No re-queue required. All issues are systemic gen prompt / CDN race patterns. Game is fully playable end-to-end.

---

## Issues

### UI-ODD-001 — No aria-live regions anywhere in the game (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** `document.querySelectorAll('[aria-live]').length` returns `0`. No live regions exist for answer feedback, round progress, or timer announcements.
- **Expected:** At minimum one `aria-live="polite"` region for correct/wrong feedback and round advancement, to support screen readers.
- **Action:** Routes to Gen Quality. ARIA-001 is the existing rule. This is a further confirmed browser instance. Rule is already shipped — investigate why it is not being applied.

### UI-ODD-002 — results-screen position:static (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** `getComputedStyle(document.getElementById('results-screen')).position` returns `"static"`. The results screen is a flex child inside `#gameContent`, not a viewport-covering overlay. On taller content it could be scrolled out of view.
- **Expected:** `position: fixed` with `z-index` sufficient to cover all game content, ensuring the results card is always in viewport.
- **Action:** Routes to Gen Quality. GEN-UX-001 is the existing rule. This is another confirmed browser instance. Rule is already shipped.

### UI-ODD-003 — data-testid on restart button is "restart-btn" not "btn-restart" (MEDIUM)
- **Category:** (a) gen prompt rule
- **Observed:** `document.getElementById('btn-restart').getAttribute('data-testid')` returns `"restart-btn"`. The element `id` is `btn-restart` but the `data-testid` attribute is `restart-btn` — reversed. Tests that use `data-testid="btn-restart"` (the standard convention) will silently miss this button.
- **Expected:** `data-testid="btn-restart"` to match the element `id` and the gen prompt convention. The restart button in every other game uses `data-testid="btn-restart"`.
- **Action:** Routes to Gen Quality. Add / reinforce rule: `GEN-TESTID-RESTART: the Play Again button must have id="btn-restart" AND data-testid="btn-restart"`.

### UI-ODD-004 — SignalCollector "Sealed — cannot record" warning on end (MEDIUM)
- **Category:** (c) CDN constraint
- **Observed:** `[SignalCollector] Sealed — cannot recordViewEvent` fires after `endGame()`. The FeedbackManager's async screen-transition `recordViewEvent` call in `endGame` runs after `signalCollector.seal()` because `showResults()` is called synchronously but `recordViewEvent` is inside the async `if (signalCollector)` block that follows `seal()`. This is a code ordering issue.
- **Expected:** All `signalCollector.recordViewEvent` calls that belong to the endGame sequence should happen before `signalCollector.seal()`. The results transition event currently fires after seal.
- **Action:** Routes to Gen Quality. The seal-before-recordViewEvent ordering is a gen prompt code structure issue. Existing pattern documented in expression-completer UI-EC-007 — now 5th+ confirmed instance. Add code structure rule to gen prompt: results `recordViewEvent` must be called before `seal()`.

### UI-ODD-005 — lottie-player CustomElementRegistry collision warning (LOW)
- **Category:** (c) CDN constraint
- **Observed:** `Uncaught NotSupportedError: Failed to execute 'define' on 'CustomElementRegistry': the name "lottie-player" has already been used with this registry`. Fires on page load from `lottie-player@latest`. Two CDN scripts both attempt to register the `lottie-player` custom element.
- **Expected:** No uncaught error on load. The CDN package loader should guard against double-registration.
- **Action:** Document only (CDN constraint). Does not affect gameplay — stickers/lottie still render. Known CDN issue, tracked but not actionable by gen prompt changes.

### UI-ODD-006 — 1-star result for 33s total time (LOW)
- **Category:** (b) spec
- **Observed:** Playing all 9 rounds correctly but at a slow pace (33s) yields 1 star. The spec sets: 3 stars ≤15s, 2 stars ≤25s, 1 star otherwise. The game correctly implements this logic. However, the "You get 3 stars for completing all rounds within 15 seconds!" instruction UI text creates an expectation mismatch for players who complete correctly but slowly.
- **Expected:** The UI could clarify that 2 stars are achievable under 25s, to reduce player confusion about the grading bands.
- **Action:** Routes to Education slot. Consider updating spec to include the 2-star threshold in the in-game instruction text, e.g. "Complete in ≤15s for 3 stars, ≤25s for 2 stars."

---

## Passing Checks

| Check | Result |
|-------|--------|
| Game loads without PAGEERROR | PASS — 1 favicon 404 (harmless), 1 lottie re-registration error (CDN, harmless to gameplay) |
| Packages all load successfully | PASS — FeedbackManager, ScreenLayout, TransitionScreen, ProgressBar, TimerComponent, SignalCollector all confirmed loaded |
| Start screen (TransitionScreen) renders | PASS — "1 Digit Doubles" title, "Tap the doubles as fast as you can!" subtitle, "Let's go!" button, ×2 icons displayed correctly |
| data-phase on load | PASS — `#app[data-phase="start"]` on initial load |
| Let's go! transitions to playing | PASS — `data-phase` transitions to `"playing"` after button click |
| All 9 rounds reachable | PASS — completed rounds 1–9 in sequence via correct taps |
| Results screen reachable after final round | PASS — "Great Job!" results card shows with 9/9, 0 wrong, 100% accuracy, star rating |
| Play Again resets state | PASS — `currentRound=0`, `lives=3`, `gameEnded=false`, `score=0`, `data-phase="start"` |
| Second playthrough starts correctly | PASS — TransitionScreen re-shown; "Let's go!" triggers round 1 of second play |
| Wrong answer deducts life | PASS — clicking wrong option reduces lives 3→2 (heart icon updates in progress slot) |
| All buttons clickable and responsive | PASS |
| 44px touch targets | PASS — all option cells are 56×87px |
| ProgressBar slotId = 'mathai-progress-slot' | PASS — `#mathai-progress-slot` present and ProgressBarComponent injected into it |
| TransitionScreen uses object API | PASS — `transitionScreen.show({ icons, title, subtitle, buttons })` — not string API |
| syncDOMState updates #app data-phase | PASS — `#app[data-phase]` transitions: start → playing → results |
| window.endGame exposed | PASS |
| window.restartGame exposed | PASS |
| window.nextRound exposed | PASS — explicitly defined and exposed (distinct from many other games) |
| window.gameState.gameId set | PASS — `gameState.gameId = 'game_one_digit_doubles'` set at initialization |
| #mathai-transition-slot present | PASS |
| data-testid on option cells | PASS — `option-0` through `option-5` on all 6 answer cells |
| Timer component renders | PASS — `00:00` counting-up timer displayed in game area |
| Results screen shows correct stats | PASS — time, rounds completed (9/9), wrong attempts (0), accuracy (100%), stars correctly calculated |
| isProcessing guard prevents double-click | PASS — clicking during animation has no effect |

---

## Flow Observations

- **Single-step interaction:** Each round presents "Double of N" with 6 option cells (3×2 grid). One tap selects an answer. No multi-step interaction.
- **Wrong answer:** Deducts a life, flashes cell red for 1s, then re-enables input. Game does NOT advance round on wrong answer — player must find the correct cell.
- **Game over path:** At 0 lives, `endGame('game_over')` fires — "Game Over" results screen shown. Not tested to full completion in this audit (only 1 life deducted in wrong-answer test).
- **Star thresholds:** 3 stars ≤15s, 2 stars ≤25s, 1 star otherwise. The in-game instruction text only mentions the 3-star threshold.
- **Timer:** Counts up (increasing) — not a countdown. Stops when `endGame` fires.
- **Restart rebuilds components:** `restartGame()` correctly re-creates `SignalCollector`, `TimerComponent`, `ProgressBarComponent`, and `VisibilityTracker` (which are destroyed in the 10s `endGame` cleanup).

---

## Routing Summary

| Route | Issues |
|-------|--------|
| Gen Quality | UI-ODD-001 (ARIA-001 #N), UI-ODD-002 (GEN-UX-001 #N), UI-ODD-003 (GEN-TESTID-RESTART — restart-btn vs btn-restart mismatch), UI-ODD-004 (seal-before-recordViewEvent ordering rule) |
| Education | UI-ODD-006 (star threshold text only shows 3-star cutoff — consider adding 2-star band) |
| CDN/Document only | UI-ODD-005 (lottie-player double-registration) |
