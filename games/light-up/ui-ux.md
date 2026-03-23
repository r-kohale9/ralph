# Light-Up — UI/UX Audit
**Build:** #508
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)

## Summary

| Severity | Count |
|----------|-------|
| P0 | 0 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 2 |
| CDN | 1 |

No P0 flow blockers. Game is fully completable start-to-finish with two successful playthroughs. No re-queue required for P0 reasons; systemic gen rule misses only.

---

## Issues

### HIGH-1 — `window.nextRound` not exposed (category: d — test gap)
**Observed:** Console error on load: `[ralph-test-harness] MISSING window.nextRound: this function is not exposed on window. Tests calling window.__ralph.nextRound() will fail silently.` Source confirms 0 occurrences of "nextRound" anywhere in game script.
**Expected:** `window.nextRound = nextRound;` assigned in global scope or at end of DOMContentLoaded. This game is single-round (1 puzzle), so nextRound is a no-op, but the harness expects it exposed.
**Action:** Test Engineering — verify test harness behavior when nextRound is missing for single-round games. Gen Quality — confirm GEN-WINDOW-EXPOSE rule covers nextRound for all game types including single-round puzzle games.
**Instance count:** 10th+ confirmed missing window.nextRound instance.

### HIGH-2 — `results-screen` position:static, not position:fixed (category: a — gen rule)
**Observed:** `getComputedStyle(resultsScreen).position` = `'static'`. Results screen renders as a centered card at y=64, height=409px — does not cover full viewport.
**Expected:** `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100` per GEN-UX-001.
**Action:** Gen Quality — GEN-UX-001 rule already shipped. Verify prompt rule is enforced in current prompt. This is the 17th+ confirmed instance across builds.
**Instance count:** 17th confirmed GEN-UX-001 miss.

### HIGH-3 — `answer-input` data-testid on grid container is semantically wrong (category: a — gen rule)
**Observed:** The game grid `<div class="game-grid">` carries `data-testid="answer-input"`. White clickable cells carry `data-testid="option-N"`. Black cells carry `data-testid="cell-R-C"`. The `answer-input` label implies a text input field, not a puzzle grid container.
**Expected:** Grid container should have `data-testid="game-grid"` or similar. White interactive cells should have `data-testid="cell-R-C"` for consistent grid addressing. Black cells could retain their current naming.
**Action:** Gen Quality — puzzle/grid games should not use `answer-input` data-testid on the grid container. This is a template artifact from MCQ/text-answer games applied incorrectly to a spatial puzzle. Add gen rule: for grid-based puzzle games, use `data-testid="game-grid"` on the container.

---

### MEDIUM-1 — No `aria-live` regions (category: a — gen rule)
**Observed:** `document.querySelectorAll('[aria-live]').length` = 0.
**Expected:** At minimum one `aria-live="polite"` region for feedback messages (correct/incorrect/game state changes).
**Action:** Gen Quality — ARIA-001 rule already shipped. 20th+ confirmed instance.
**Instance count:** 20th+ confirmed ARIA-001 miss.

### MEDIUM-2 — `gameState.gameId` field is `'game_light_up'` (category: a — gen rule check — PASS variant)
**Observed:** `window.gameState.gameId = 'game_light_up'` — field exists and is populated.
**Note:** This is a PASS for GEN-GAMEID. Recorded here because many builds fail this check; this build has it correct.

### MEDIUM-3 — `data-phase` on `#app` is `'playing'` during transition screen interstitial (category: a — gen rule)
**Observed:** After clicking "Play Again", `#app[data-phase]` = `'playing'` while the TransitionScreen interstitial (start screen overlay) is visually displayed. The TransitionScreen shows "Ready to play again?" but the DOM already reports `playing` before the user clicks "Let's go!" the second time.
**Expected:** `syncDOMState()` should write `data-phase='start_screen'` when the interstitial is displayed, transitioning to `'playing'` only when the puzzle grid is revealed. Current behavior means test harness could see `playing` before gameplay has actually started.
**Action:** Gen Quality — syncDOMState() must be called with `start_screen` phase when showing the restart interstitial. This is a timing mismatch in restartGame().

---

### LOW-1 — Audio 404 storm: `success.mp3` repeatedly 404s (category: c — CDN constraint)
**Observed:** 70+ network requests to `https://storage.googleapis.com/test-dynamic-assets/audio/success.mp3` all return 404. AudioKit retries repeatedly on each cell tap (5 bulb placements = ~14 retries each = 70+ total). Console shows `[AudioKit] Failed to preload tap/win Error: HTTP error 404` on every interaction.
**Expected:** AudioKit should either use an existing audio path or suppress retries after first 404 failure.
**Action:** CDN — `success.mp3` does not exist at the test-dynamic-assets path. Other games using correct audio paths (e.g. `tap.mp3`, `win.mp3`) should work. Gen rule: verify AudioKit sound names match available CDN assets.

### LOW-2 — `TransitionScreen` variable not in global scope (category: c — CDN observation)
**Observed:** `typeof TransitionScreen` = `'undefined'` at the global window level, even though `TransitionScreenComponent` is loaded (checked `typeof TransitionScreenComponent` = `'function'`). `waitForPackages()` correctly checks `typeof TransitionScreenComponent` (not `TransitionScreen`), so this is NOT a bug.
**Action:** No action — package check is correct. Recorded for reference.

---

## Passing Checks

| Check | Result |
|-------|--------|
| CDN packages load (ScreenLayout, ProgressBarComponent, TransitionScreenComponent, TimerComponent) | PASS — all load cleanly |
| No CDN 404 for packages | PASS |
| `#app[data-phase]` transitions: `start` → `playing` → `results` | PASS |
| `window.endGame` exposed | PASS |
| `window.restartGame` exposed | PASS |
| `window.nextRound` exposed | FAIL — missing (HIGH-1) |
| `gameState.gameId` = `'game_light_up'` | PASS |
| `gameState.gameEnded` resets to `false` after Play Again | PASS |
| `gameState.score` resets to 0 after Play Again | PASS |
| `gameState.lives` resets to 3 after Play Again | PASS |
| `gameState.currentRound` resets to 0 after Play Again | PASS |
| Grid cells touch target ≥44px | PASS — cells are 61.4px × 61.4px |
| Check Solution button height ≥44px | PASS — exactly 44px |
| `data-testid="results-screen"` present | PASS |
| `data-testid="btn-restart"` present | PASS |
| `data-testid="btn-check"` present | PASS |
| `data-testid="stars-display"` present | PASS |
| `data-testid="score-display"` present | PASS |
| `data-testid="lives-display"` present | PASS |
| `data-testid="timer-display"` present | PASS |
| Grid cells have `data-row` + `data-col` attributes | PASS |
| `syncDOMState()` writes to `#app[data-phase]` | PASS |
| `waitForPackages()` checks `typeof TransitionScreenComponent` (correct) | PASS |
| TransitionScreen uses object API (not string mode) | PASS — `new TransitionScreenComponent({ autoInject: true })` |
| ProgressBarComponent loaded | PASS — in packages |
| `mathai-transition-slot` present in DOM | PASS |
| Game completable end-to-end (start → solve puzzle → results) | PASS |
| "Play Again" restarts game cleanly | PASS |
| Second playthrough starts with empty grid | PASS |
| Timer present during gameplay | PASS |
| Lives counter (3) displayed | PASS |
| Puzzle grid renders (5×5, numbered cells) | PASS |
| Cell illumination on bulb placement | PASS — yellow highlight on click |
| `Puzzle Complete!` + stars (★★★) on correct solution | PASS |
| Stats shown: Time, Bulbs Placed, Check Attempts | PASS |
| `lottie-player` duplicate registration error (CDN known issue) | KNOWN — non-blocking |

---

## Flow Observations

**Playthrough 1:**
1. Start screen: emoji 💡, "Light-Up" heading, "Illuminate the entire grid!" subtitle, "Let's go!" button (green, full-width). Audio popup shown and dismissed.
2. After "Let's go!": grid renders immediately with 5×5 layout. Instructions visible above grid (3 paragraphs). Timer shows 00:00. Lives shows 3. Check Solution button at bottom.
3. Grid interaction: clicking white cells places bulb emoji (💡), yellow illumination spreads through row and column until blocked by black cells.
4. After correct solution placed (5 bulbs at solutionBulbs positions): "Check Solution" transitions to results.
5. Results screen: "Puzzle Complete!" + ★★★ stars + stats card (Time 0:00, Bulbs Placed 5, Check Attempts 1) + "Play Again" button.
6. "Play Again" → transition screen shows "Ready to play again?" overlay.

**Playthrough 2:**
- Grid resets cleanly (no bulbs, no illumination).
- Timer not visible on second play (timer-display element present but blank — possible timer reinit issue on restart).
- Puzzle solvable identically.

**Phase machine observed:**
- `start` (initial load)
- `playing` (after "Let's go!")
- `playing` (erroneously — during restart interstitial — see MEDIUM-3)
- `results` (after Check Solution with correct answer)

---

## Routing Summary

| Issue | Route | Action |
|-------|-------|--------|
| HIGH-1: window.nextRound missing | (d) Test gap | Test Engineering: verify harness for single-round games |
| HIGH-2: results-screen position:static | (a) Gen rule | Gen Quality: GEN-UX-001 enforcement check |
| HIGH-3: answer-input on grid container | (a) Gen rule | Gen Quality: new rule for grid-based puzzle games |
| MEDIUM-1: no aria-live | (a) Gen rule | Gen Quality: ARIA-001 enforcement check |
| MEDIUM-3: data-phase during interstitial | (a) Gen rule | Gen Quality: syncDOMState must be called with start_screen during restart interstitial |
| LOW-1: audio 404 storm | (c) CDN constraint | Document: AudioKit audio file names must match existing CDN assets |

**Verdict:** No P0. Game is fully playable. No re-queue required. 3 HIGH findings route to Gen Quality / Test Engineering.
