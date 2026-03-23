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
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 2 |
| PASS | 17 |

**Verdict:** No re-queue required (all issues are systemic gen prompt / accessibility / CDN warning issues, no flow blockers). All 3 rounds reachable end-to-end, results screen shows, Play Again resets correctly.

---

## Issues

### UI-CM-001 — Maze cells are DIV elements without role/tabindex/aria-label (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** All 6 maze cells are rendered as `<div class="maze-cell passable">` elements with `data-testid="option-N"` but no `role="button"`, no `tabindex`, and no `aria-label`. The cells have click handlers (`handleCellClick`) but are not keyboard accessible and are invisible to screen readers. Confirmed with `document.querySelectorAll('.maze-cell.passable')[0].getAttribute('role')` returning `null`.
- **Expected:** Each interactive maze cell should have `role="button"`, `tabindex="0"`, and `aria-label` describing its value and position (e.g., `aria-label="Cell value 10, row 1 col 2"`).
- **Action:** Routes to Gen Quality. This is the same `GEN-INTERACTIVE-DIV-ROLE` pattern established in keep-track #503 for interactive cup divs. Confirms 2nd instance. Rule should already be queued — confirm it is in the Gen Quality backlog.

### UI-CM-002 — window.gameState.gameId not set (HIGH)
- **Category:** (a) gen prompt rule
- **Observed:** `window.gameState.gameId` is `undefined`. The `gameState` object is initialized without a `gameId` field. In two places (`templateId: window.gameState?.gameId || null`) the field is referenced but never assigned, so `SignalCollector` receives `templateId: null`.
- **Expected:** `window.gameState.gameId = 'crazy-maze'` set as part of the `gameState` initialization object.
- **Action:** Routes to Gen Quality. GEN-GAMEID rule already shipped. This is the 8th+ confirmed browser instance. Rule is not being applied consistently — escalate to Gen Quality for investigation.

### UI-CM-003 — results-screen position:static (MEDIUM)
- **Category:** (a) gen prompt rule
- **Observed:** `getComputedStyle(document.getElementById('results-screen')).position` returns `"static"`. The results screen is a flex child inside `#gameContent`, not a viewport-covering overlay. It renders correctly in this game because the game-screen is hidden via `display:none` when results show, but the rule mandates `position:fixed` regardless.
- **Expected:** `position: fixed; z-index: 1000+` to overlay the entire viewport consistently.
- **Action:** Routes to Gen Quality. GEN-UX-001 rule already shipped. This is the 22nd+ confirmed browser instance. Rule is not enforced consistently.

### UI-CM-004 — No aria-live regions anywhere in the game (MEDIUM)
- **Category:** (a) gen prompt rule
- **Observed:** `document.querySelectorAll('[aria-live]').length` returns `0`. No live regions for maze navigation feedback, running total updates, correct/incorrect path announcements, or round progress.
- **Expected:** At minimum one `aria-live="polite"` region for the running total display and feedback messages, to support screen readers.
- **Action:** Routes to Gen Quality. ARIA-001 rule already shipped. This is the 20th+ confirmed browser instance.

### UI-CM-005 — data-lives attribute stale after Reset Path (MEDIUM)
- **Category:** (d) test gap
- **Observed:** After clicking "Reset Path" (which calls `handleReset()` and deducts a life), `#app[data-lives]` remains at the old value (e.g., "3") while `window.gameState.lives` correctly shows "2". The test harness `syncDOMState` patches `['roundComplete', 'endGame', 'loadRound', 'initGame', 'checkAnswer', 'handleSubmit']` but does not include `handleReset`. Any test asserting `data-lives` after a reset path action will see stale data.
- **Expected:** `handleReset` should be in the harness `patchGameFunctions` list, or `handleReset` should call `syncDOMState` itself (which it does via `resetPath()` → but `resetPath` doesn't call `syncDOMState` after a life deduction).
- **Action:** Routes to Test Engineering. The harness `patchGameFunctions` list should include `handleReset` and `resetPath` as candidates for wrapping, or the gen prompt should mandate that `handleReset` calls `syncDOMState()` after deducting a life.

### UI-CM-006 — FeedbackManager subtitle/sticker components not initialized (LOW)
- **Category:** (c) CDN constraint
- **Observed:** `[FeedbackManager] Subtitle component not loaded, skipping` and `[FeedbackManager] Sticker component not loaded, skipping` warnings appear repeatedly during gameplay (on every correct/incorrect path). These fire because `FeedbackManager.sound.play()` and `playDynamicFeedback()` are called with `subtitle` and `sticker` params but `SubtitleComponent` and `StickerComponent` are not initialized before use.
- **Expected:** Either components are initialized, or the subtitle/sticker params are omitted. Audio still plays correctly — cosmetic warnings only.
- **Action:** Document only (CDN constraint). Same pattern as expression-completer, match-the-cards, and others.

### UI-CM-007 — SignalCollector "Sealed — cannot record" warning on end (LOW)
- **Category:** (c) CDN constraint
- **Observed:** `[SignalCollector] Sealed — cannot recordViewEvent` warning fires after `endGame()` seals the collector. A `showResults()` call inside `endGame()` tries to `recordViewEvent('screen_transition', ...)` after `seal()` has been called at line 1079, because `showResults` is called at line 1103 (after `seal()`).
- **Expected:** `signalCollector.recordViewEvent(...)` in `showResults` should be called before `signalCollector.seal()`, or the `showResults` internal `signalCollector.recordViewEvent` guard should check if collector is null/sealed.
- **Action:** Routes to Gen Quality. Known pattern — 5th confirmed instance. The gen prompt should order `showResults(metrics, reason)` before `signalCollector.seal()`, or the `showResults` function should guard with `if (signalCollector && !signalCollector._sealed)`.

---

## Passing Checks

| Check | Result |
|-------|--------|
| Game loads without PAGEERROR | PASS — 1 console error (favicon 404), no JS errors, no init failure |
| Transition screen shows on load | PASS — "Crazy Maze" title, "Navigate the maze and collect the target sum!", "Let's go!" button |
| data-phase on load | PASS — `#app[data-phase="start"]` (harness normalizes `start_screen` → `start`) |
| All 3 rounds reachable | PASS — completed rounds 1–3 in sequence, each round loads correctly |
| Round 1: Target Sum 50 | PASS — 4×4 grid, path 5+10+15+8+12+0=50 |
| Round 2: Target Sum 80 | PASS — 5×5 grid, path 10+15+20+5+30+0=80 |
| Round 3: Target Sum 120 | PASS — 5×6 grid, path 15+10+25+20+5+30+5+10+0=120 |
| Results screen reachable after final round | PASS — "Great Job!" with 3 stars, 3/3 rounds, 3 lives, 100% accuracy |
| data-phase after results | PASS — `#app[data-phase="results"]` after victory |
| Play Again resets state | PASS — `currentRound=0`, `lives=3`, `gameEnded=false`, `score=0`, transition screen re-shown |
| Second playthrough starts correctly | PASS — Let's go! triggers Round 1 of second play |
| All interactive buttons >= 44px | PASS — direction buttons 44×52px, Reset Path and Play Again ≥ 44px |
| Maze cells >= 48px | PASS — all maze cells 48×48px |
| ProgressBar slotId = 'mathai-progress-slot' | PASS — `#mathai-progress-slot` present |
| TransitionScreen uses object API | PASS — `transitionScreen.show({ icons, title, subtitle, buttons })` — single-argument object API |
| syncDOMState updates #app data-phase | PASS — `#app[data-phase]` transitions: start → playing → results |
| window.endGame exposed | PASS |
| window.restartGame exposed | PASS |
| window.nextRound exposed | PASS — aliased to `loadRound` |
| window.startGame exposed | PASS |
| data-testid on direction buttons | PASS — `btn-up`, `btn-down`, `btn-left`, `btn-right` |
| data-testid on maze cells | PASS — `option-0` through `option-N` per cell index |
| data-testid btn-restart on Play Again | PASS |
| postMessage type: game_complete | PASS |
| postMessage has events, attempts, metrics.duration_data | PASS — all present |
| Stars = lives remaining (victory path) | PASS — 3 lives remaining → 3 stars |
| Reset Path deducts a life | PASS — 3 → 2 lives after handleReset |
| Wrong sum path deducts a life | PASS — lives decrease, path resets on wrong total |
| Maze direction buttons disable when no valid move | PASS — disabled when path blocked or out-of-bounds |
| Progress bar updates per round | PASS — "1/3 rounds completed" after round 1, "2/3" after round 2, "3/3" at results |
| CDN packages load (0 404s) | PASS — all packages loaded successfully |
| FeedbackManager audio preload | PASS — 2/2 sounds preloaded |

---

## Flow Observations

- **Grid-based navigation:** The game renders a partial maze grid (only passable cells at specific row/col positions) surrounded by wall cells. Players navigate by clicking direction buttons or clicking adjacent cells.
- **Correct path validation:** When the player reaches the end cell (`isEnd: true`), the running total is compared to `targetSum`. If equal, the path flashes green and the round completes. If not equal, the path flashes red, a life is deducted, and the path resets.
- **Reset Path:** Explicit reset button deducts a life and returns player to start of current round. With 3 lives total this is significant — 3 resets = game over.
- **Stars = lives remaining:** Unique star-calculation approach (stars = `gameState.lives` at end of victory). Perfect run = 3 stars, each lost life = one fewer star.
- **Game over vs victory:** `endGame('game_over')` sets `data-phase="gameover"`, `endGame('victory')` sets `data-phase="results"`. Results screen title changes accordingly ("Great Job!" vs "Game Over").
- **No timer:** Game intentionally has no timer (comment in code: `let timer = null; // No timer logic in this game`). Pure move-count scoring.

---

## Routing Summary

| Route | Issues |
|-------|--------|
| Gen Quality | UI-CM-002 (GEN-GAMEID #8+), UI-CM-003 (GEN-UX-001 #22+), UI-CM-004 (ARIA-001 #20+), UI-CM-007 (showResults-after-seal ordering) |
| Test Engineering | UI-CM-001 (GEN-INTERACTIVE-DIV-ROLE #2 — maze cells no role/tabindex), UI-CM-005 (data-lives stale after handleReset — harness patchGameFunctions gap) |
| CDN/Document only | UI-CM-006 (subtitle/sticker CDN warnings), UI-CM-007 (SignalCollector sealed race — also routes Gen Quality for ordering fix) |
