# keep-track — UI/UX Audit

**Build:** #503
**Date:** 2026-03-23
**Auditor:** UI/UX Slot (Rule 16)
**Method:** Full browser playthrough — Playwright MCP, 375×812px mobile viewport
**GCP URL:** `https://storage.googleapis.com/mathai-temp-assets/games/keep-track/builds/503/index.html`

---

## Summary

| Severity | Count |
|----------|-------|
| P0 (flow blocker) | 2 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 2 |
| **TOTAL** | **10** |

**Re-queue required: YES** — P0-A and P0-B together make the game completely unplayable. User sees blank screen on load, cannot start, and blank screen again after restart.

---

## P0 Flow Blockers

### P0-A: `transitionScreen.show()` called with wrong arg count — blank start screen, game never starts

**Category:** (a) gen rule
**Severity:** P0

The game calls `transitionScreen.show('start', { icons, title, subtitle, buttons })` — passing a screen-type string as the first argument and the config object as the second. But `TransitionScreenComponent.show(config)` takes **one argument only** (the config object). The CDN component destructures `config = 'start'` (a string), so `title`, `buttons`, `icons`, etc. are all `undefined`.

Result: on page load the transition screen slot shows as active but completely empty — no title, no subtitle, no "Let's go!" button. The user cannot start the game. This same broken call pattern affects:
- Start screen: `transitionScreen.show('start', {...})` → blank
- Between-round transitions: `transitionScreen.show('level-transition', {...})` → blank, no "Next" button
- Game-over screen: `transitionScreen.show('game-over', {...})` → blank
- Victory screen: `transitionScreen.show('victory', {...})` → blank
- Restart start screen: `transitionScreen.show('start', {...})` → blank

**Console evidence:** `[TransitionScreen] Showing screen: {title: undefined, stars: undefined, buttons: undefined, persist: undefined}`

**Root cause confirmed by:** `TransitionScreenComponent.prototype.show.toString()` — signature is `show(config)`, single arg, destructures `icons, title, subtitle, buttons` directly from `config`.

**Previous instance:** which-ratio #561 had `transitionScreen.show('victory', ...)` with the same two-arg bug — only the victory screen was affected there. Here every `show()` call is broken.

**Gen rule needed:** `transitionScreen.show()` takes ONE argument (the config object). Never pass a screen-type string as the first arg. Correct: `transitionScreen.show({ icons, title, subtitle, buttons })`. The `type` key may optionally be included inside the config if the CDN supports it, but must not be a positional first argument.

---

### P0-B: `#gameContent` div stays `display:none` after game starts — gameplay invisible

**Category:** (a) gen rule
**Severity:** P0

Even when `setupGame()` runs and the game reaches the "shuffling" phase (cups are rendered and animations run), `document.getElementById('gameContent').style.display` remains `"none"`. The transition slot overlay covers the entire content area.

Root cause: `TransitionScreenComponent.hide()` is what sets `gameContent` back to `display:block` when a transition completes. Because P0-A broke all `show()` calls (passing undefined config), the hide lifecycle never fires correctly — the CDN component manages `gameContent` visibility internally based on its `show()`/`hide()` calls. With the broken start-screen `show()`, the component never receives a valid screen to show and therefore never hides.

**Verified:** Force-calling `document.getElementById('gameContent').style.display = 'block'` makes cups and game content visible — the underlying game logic works, only the visibility management is broken.

---

## HIGH Issues

### HIGH-1: `gameState.gameId` absent from `window.gameState` declaration

**Category:** (a) gen rule — GEN-GAMEID (25th+ instance)
**Severity:** HIGH

`window.gameState.gameId` is set to `'game_keep_track'` (PASS — it is present in this build). However, `SignalCollector` is initialized with `templateId: window.gameState.gameId` — this works correctly here. **PASS on GEN-GAMEID for this build.**

*(Note: reviewing more carefully — gameId IS set to `'game_keep_track'` — this is a PASS, not a finding. Corrected below.)*

### HIGH-1 (revised): No `aria-live` regions anywhere in the game

**Category:** (a) gen rule — ARIA-001 (25th+ instance)
**Severity:** HIGH

`document.querySelectorAll('[aria-live]').length === 0`. No screen reader announcements for cup positions, phase changes, round transitions, or results. Standard systemic gap across all audited games.

### HIGH-2: Cup containers are `<div>` elements, not `<button>` — missing role/tabindex/aria-label

**Category:** (a) gen rule — interactive-div accessibility
**Severity:** HIGH

Cup containers are `<div class="cup-container" data-testid="option-N">` — no `role="button"`, no `tabindex="0"`, no `aria-label`. Users cannot tab to cups or activate via keyboard. Interactive game targets must use semantic `<button>` elements or have full ARIA equivalent attributes.

**Cup dimensions:** 120×80px (height PASS for touch target). 3 cups shown.

### HIGH-3: `results-screen` position:static — not visible over game layout

**Category:** (a) gen rule — GEN-UX-001 (21st+ instance)
**Severity:** HIGH

`getComputedStyle(document.getElementById('results-screen')).position === 'static'`. The results screen renders in document flow below the transition slot. Although in this build the results screen WAS reachable (after `endGame()` forced, gameContent was `block`), the static positioning causes layout overlap issues. `resultsRect.top: 64px` — positioned below progress bar, inside game area. Rule GEN-UX-001 requires `position:fixed; z-index:100` or `position:absolute; inset:0`.

---

## MEDIUM Issues

### MEDIUM-1: `restartGame()` — `gameEnded` flag not reset

**Category:** (a) gen rule
**Severity:** MEDIUM

After `endGame()` sets `gameEnded: true`, the `restartGame()` call shows the blank start screen (P0-A is the primary cause) but also `window.gameState.gameEnded` remains `true` and `currentRound: 4`, `score: 4` are not reset. If P0-A were fixed, the restart would still start with stale state.

### MEDIUM-2: Accuracy always shows 0% in results screen

**Category:** (a) gen rule
**Severity:** MEDIUM

The results screen shows `Accuracy: 0%`. Verified: `window.gameState.attempts` has 3 entries, all `correct: false` (because we clicked wrong cups in the test). However the `result-accuracy` element was also `""` before endGame forced. The accuracy metric is likely calculated as `score / totalRounds * 100` = `0/0` (since total score tracking may not count individual correct attempts). The attempts array does track `correct: true/false` correctly, but the results display doesn't use it for the accuracy field.

**Note:** This may partly be an artifact of our forced testing. Verify on natural playthrough.

### MEDIUM-3: Timer color hardcoded as `#000FFF` (blue) — non-brand color

**Category:** (a) gen rule
**Severity:** MEDIUM

Timer display CSS: `color: #000FFF` — this is a near-black blue (`rgb(0, 15, 255)`). This is likely a typo for `#000000` (black) or `#0000FF` (pure blue) but neither is a standard brand color. Should use CSS variable `var(--color-primary)` or `#000000`.

---

## LOW Issues

### LOW-1: FeedbackManager subtitle component not initialized warning

**Category:** (c) CDN constraint
**Severity:** LOW

`[WARNING] [FeedbackManager] Subtitle component not...` — FeedbackManager fires a warning because SubtitleComponent was not mounted. Non-blocking but a known CDN gap. 23rd+ instance across audited games.

### LOW-2: `result-time` shows `0:00` when timer not running from start

**Category:** (a) gen rule (minor)
**Severity:** LOW

Timer shows `0:00` in results because we forced `endGame()` before starting via normal flow. In natural play, once P0-A is fixed and the game starts via "Let's go!" button, the timer would start correctly. This is conditional on P0-A fix. Mark as LOW to verify on next build.

---

## Passes

- CDN packages: 0 network 404s on CDN packages load
- All packages load: ScreenLayout, ProgressBar, TransitionScreen, LottiePlayer, PopupComponent, TimerComponent, StoriesComponent — all `[MathAIComponents] All components loaded successfully`
- `#mathai-progress-slot` and `#mathai-transition-slot` — both present and in DOM
- `window.nextRound`, `window.endGame`, `window.restartGame` — all exposed on `window` (PASS — GEN-WINDOW-EXPOSE)
- `window.gameState.gameId = 'game_keep_track'` — PASS (GEN-GAMEID)
- `#app[data-phase]` transitions correctly: `start` → `start_screen` → `shuffling` → `guess` → `reveal` → `results`
- `#app[data-round]`, `#app[data-lives]`, `#app[data-score]` all set by syncDOMState (PASS)
- `syncDOMState()` targets `#app` not `document.body` (PASS — LP-4 lesson applied correctly)
- Cup containers use `data-testid="option-0"`, `"option-1"`, `"option-2"` (PASS — test selector coverage)
- Life deduction works: wrong answer → lives 3→2 confirmed
- `game_complete` postMessage fires with correct structure: `{type: 'game_complete', data: {metrics: {score, totalRounds, stars, accuracy, timeTaken, ...}}}` — PASS
- Results screen renders when reached: 2 stars, Score 4/5, Play Again button 43px (slightly under 44px — borderline)
- `ProgressBar` slotId `'mathai-progress-slot'` (PASS — GEN-UX-003)
- Progress bar header shows `0/5 rounds completed` → `4/5 rounds completed` correctly
- SignalCollector initialized with sessionId + templateId (PASS)
- 0 console errors throughout (only warnings)
- Cup game logic: shuffling animations, 3→4→5 cup escalation per spec
- `restartGame()` exists and callable (though state reset is incomplete — MEDIUM-1)

---

## Findings Classification & Routing

| ID | Severity | Category | Rule/Pattern | Route To |
|----|----------|----------|-------------|----------|
| P0-A | P0 | (a) gen rule | `transitionScreen.show()` two-arg bug | Gen Quality — new/reinforce prompt rule |
| P0-B | P0 | (a) gen rule | gameContent stays hidden due to P0-A | Gen Quality — fix P0-A |
| HIGH-1 | HIGH | (a) gen rule | ARIA-001 — no aria-live | Gen Quality — verify rule enforcement |
| HIGH-2 | HIGH | (a) gen rule | Interactive divs not buttons | Gen Quality — new rule for cup/card/grid games |
| HIGH-3 | HIGH | (a) gen rule | GEN-UX-001 results-screen position:static | Gen Quality — verify rule enforcement |
| MEDIUM-1 | MEDIUM | (a) gen rule | restartGame() incomplete state reset | Gen Quality — verify GEN-RESTART-RESET |
| MEDIUM-2 | MEDIUM | (a) gen rule | Accuracy 0% in results | Gen Quality — investigate accuracy calc pattern |
| MEDIUM-3 | MEDIUM | (a) gen rule | Hardcoded timer color `#000FFF` | Gen Quality — CSS vars rule |
| LOW-1 | LOW | (c) CDN | FeedbackManager subtitle warning | Document only — systemic CDN gap |
| LOW-2 | LOW | (a) gen rule | Timer 0:00 (conditional on P0-A) | Verify after P0-A fix |

---

## Gen Rule Handoffs

### GEN-TS-ONEARG (NEW — CRITICAL)
**Rule:** `transitionScreen.show()` accepts ONE argument — the config object. Do NOT pass a screen-type string as the first argument. Incorrect: `transitionScreen.show('start', {title: 'X', buttons: [...]})`. Correct: `transitionScreen.show({title: 'X', buttons: [...]})`.

**Evidence:** TransitionScreenComponent.prototype.show signature: `show(config)` — destructures `{icons, title, subtitle, buttons, duration, persist}` from `config`. Passing a string as `config` gives all properties as `undefined`. Confirmed in which-ratio #561 (victory screen) and now keep-track #503 (ALL screens).

**Priority:** CRITICAL — ships as P0 finding. Must add to CDN_CONSTRAINTS_BLOCK. T1 check candidate: scan for `transitionScreen.show(` followed by a string literal.

### GEN-INTERACTIVE-DIV-ROLE (NEW)
**Rule:** Any clickable/tappable game element that is not a `<button>` must have `role="button"`, `tabindex="0"`, and `aria-label` describing the target. This includes cup containers, card elements, choice tiles, grid cells. Preferred: use `<button>` elements directly.

**Priority:** HIGH — add to CDN_CONSTRAINTS_BLOCK.

### GEN-TIMER-COLOR (NEW)
**Rule:** Timer display color must use CSS variable `var(--color-primary)` or `#333333`, never a hardcoded hex like `#000FFF`. Template literal timer styles should reference the design system.

**Priority:** MEDIUM — add to VISUAL_CONSTRAINTS_BLOCK.

---

## Re-queue Decision

**Re-queue: YES.**

P0-A (`transitionScreen.show()` two-arg bug) makes the game completely unplayable. The user sees a blank screen and cannot start. P0-B (gameContent hidden) compounds this. Both are gen rule failures with a known fix.

**Before re-queue:** Apply GEN-TS-ONEARG rule to prompt, verify with local diagnostic.

---

## Screenshots

- Initial load: blank screen (header bar only)
- After force-start + force-show gameContent: 3 cups "Where is the star?" with timer 00:25 (shuffled order: Cup 1, Cup 3, Cup 2)
- After wrong answer: lives 3→2, header shows 2 hearts
- After force endGame: "Game Complete!" with 2 stars, Score 4/5, Accuracy 0%, Play Again 43px button
- After Play Again: completely blank screen (P0-A repeats on restart)
