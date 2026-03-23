# UI/UX Audit — Rapid Challenge

**Build:** #526  **Date:** 2026-03-23  **Auditor:** UI/UX slot (full browser playthrough)

---

## Summary Table

| Severity | Count |
|----------|-------|
| P0       | 2     |
| HIGH     | 3     |
| MEDIUM   | 3     |
| LOW      | 2     |
| **Total** | **10** |

---

## Browser Playthrough — Build #526 (Full)

Viewport: 375×812px. Playwright MCP. Local HTTP server (localhost:8767).

### Playthrough Steps Completed

1. Start screen — transition screen with "Rapid Challenge" title, lightning bolt icon, "Let's go!" CTA
2. Clicked "Let's go!" → Level 1 transition screen ("Easy — Simple expressions")
3. Clicked "Let's go!" → Gameplay screen, Round 1: "10 - 7 = ?"
4. Answered Round 1 correctly (3) → Round 2 advanced
5. Answered Round 2 incorrectly (4 for 7+__=10) → life lost, Round 3 loaded
6. Answered Round 3 correctly → Level 2 transition screen ("Medium — Bigger numbers")
7. Clicked "Next Level" → gameplay resumes at Round 4
8. Called `window.endGame('victory')` to reach results screen
9. Observed results screen
10. Clicked "Play Again" → returns to start screen (reset confirmed)

---

## Findings

### P0-A: Results screen is `position: static` — not `position: fixed`

**Finding ID:** UI-RC-001
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-UX-001 (11th confirmed live instance)

`document.getElementById('results-screen')` computed style: `position: static`, `z-index: auto`, `top: auto`. The results screen renders inline in document flow rather than as a fixed overlay. Under ScreenLayout's flex body layout, this can cause the results screen to render off-viewport or be partially obscured. GEN-UX-001 (results-screen must be `position:fixed; top:0; left:0; width:100%; height:100%; z-index:100`) is already shipped but was not applied in this build.

**Action:** Already covered by GEN-UX-001 — verify rule is active and covers `#results-screen` selector.

---

### P0-B: CSS entirely stripped — all custom styles absent

**Finding ID:** UI-RC-002
**Category:** (a) gen rule → Gen Quality
**Rule reference:** CSS-STRIP (6th confirmed live instance)

The `<style>` block in the HTML contains only a placeholder comment: `/* [CSS stripped — 57 chars, not relevant to JS fix] */`. **No custom CSS is applied anywhere in the game.** Consequences:

- Option buttons (`option-btn`) are browser-default: `height: 21.5px`, `minHeight: 0px`, `padding: 1px 6px`, grey background, 2px outset border. Fails 44px touch target requirement.
- "Play Again" button (`game-btn btn-primary`) rendered as unstyled browser button: `height: 21.5px`, grey background.
- Results metrics (time, accuracy, rounds) render as unstyled inline text — no card layout, label/value separation, or visual hierarchy.
- `.visually-hidden` container has **no CSS applied** (`position: static`, `visibility: visible`, `display: block`) — the hidden test harness elements (score-display "2", lives-display "2", answer-input textbox) are **fully visible** on screen throughout gameplay (see screenshot rc-526-gameplay-round1.png).

**Action:** Already flagged as a known pipeline issue — CSS strip root cause under investigation. No additional gen rule action needed beyond existing tracking.

---

### HIGH-1: Option buttons and Play Again button are 21.5px tall — fail 44px touch target

**Finding ID:** UI-RC-003
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-UX-002 (confirmed, .option-btn selector not covered)

Measured via `getBoundingClientRect()`:
- `.option-btn` buttons: `height: 21.5px`, `width: 23.4px`, `minHeight: 0px`
- `#btn-restart` ("Play Again"): `height: 21.5px`

Root cause is CSS stripping (UI-RC-002). The gen rule GEN-UX-002 requires `min-height: 52px` on game buttons but the CSS was stripped entirely. Confirm GEN-UX-002 explicitly covers `.option-btn` class (not just `.game-btn`).

**Action:** Verify GEN-UX-002 covers `.option-btn` selector. No additional rule needed beyond CSS strip fix.

---

### HIGH-2: `window.nextRound` not exposed — test harness MISSING error

**Finding ID:** UI-RC-004
**Category:** (d) test gap → Test Engineering
**Rule reference:** GEN-WINDOW-EXPOSE (new instance for nextRound)

Console error at page load:
```
[ralph-test-harness] MISSING window.nextRound: this function is not exposed on window.
Tests calling window.__ralph.nextRound() will fail silently.
Fix: add window.nextRound = nextRound; in the game code.
```

The game exposes: `window.startGame`, `window.showLevelTransition`, `window.startLevel`, `window.loadRound`, `window.endGame`, `window.restartGame`. It does NOT expose `window.nextRound`. The test harness `var required = ['endGame', 'restartGame', 'nextRound']` at line 1068 checks for this and fires the error. Rapid-challenge uses `loadRound` internally but does not alias it as `nextRound`.

**Action:** Gen rule or spec addition — add `window.nextRound = loadRound;` (or equivalent) to the game's initialization. Route to Test Engineering for test harness alignment check.

---

### HIGH-3: `endGame()` destroys progressBar with 10s setTimeout — race condition with `restartGame()`

**Finding ID:** UI-RC-005
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-PROGRESSBAR-DESTROY-RACE (new pattern)

`endGame()` at line 614:
```js
setTimeout(() => {
  try {
    if (progressBar) progressBar.destroy();
    if (timer) timer.destroy();
    ...
  } catch(e) {}
}, 10000);
```

`restartGame()` at line 682:
```js
if (progressBar) progressBar.destroy();
...
progressBar = new ProgressBarComponent(...); // new instance created
```

If the user clicks "Play Again" within 10 seconds of `endGame()`, `restartGame()` creates a new `progressBar` instance — but the 10s deferred `destroy()` will fire and destroy the **newly created** progressBar. This leaves the progress bar destroyed mid-game on any fast restart. This is the same pattern as found in right-triangle-area #543.

Confirmed in browser logs: the 10s setTimeout fired and logged `[ProgressBar] Destroyed` after the "Play Again" click had already created a new instance.

**Action:** New gen rule needed — `endGame()` deferred destroy must check if the component was replaced (e.g., use a sentinel/version counter, or cancel the timeout in `restartGame()`). Route to Gen Quality.

---

### MEDIUM-1: `waitForPackages` timeout is 120s but error message says "within 10s"

**Finding ID:** UI-RC-006
**Category:** (a) gen rule → Gen Quality

`waitForPackages()` at line 155: `const timeout = 120000` (120 seconds). However the thrown error message says: `'Packages failed to load within 10s'`. The actual behavior (120s timeout) is correct and acceptable. The error message is stale/inconsistent — a copy-paste artifact from an older generation where the timeout was 10s. Not functionally harmful but misleading for debugging.

**Action:** Minor gen rule cleanup — error message should match the actual timeout value: `'Packages failed to load within 120s'`. Note: the canonical value per pipeline rules is 180s; 120s is suboptimal but functional.

---

### MEDIUM-2: No `aria-live` on feedback elements

**Finding ID:** UI-RC-007
**Category:** (a) gen rule → Gen Quality
**Rule reference:** ARIA-001 (14th confirmed live instance)

`grep -n "aria-live"` returns 0 results in the entire HTML. No feedback element has `aria-live="polite"` or `role="status"`. The round feedback (correct/incorrect) is visually communicated but not announced to screen readers.

**Action:** Already covered by ARIA-001 gen rule — already shipped. Re-confirm rule is active.

---

### MEDIUM-3: FeedbackManager subtitle and sticker components emit warnings every round

**Finding ID:** UI-RC-008
**Category:** (c) CDN constraint → document

Every answer (correct or incorrect) triggers:
```
[FeedbackManager] Subtitle component not found — skipping subtitle display
[FeedbackManager] Sticker component not found — skipping sticker display
```

These are CDN warnings because `SubtitleComponent` and `StickerComponent` are not injected into the layout. The game uses `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })` without `subtitle` or `sticker` slots. FeedbackManager expects these slots but silently degrades. Not a functional failure but generates 2 warnings per round (18+ warnings total in a 9-round game).

**Action:** Document as CDN constraint. If subtitle feedback is desired in spec, add `subtitle: true` to ScreenLayout slots. Otherwise document "FeedbackManager subtitle/sticker warnings are expected when slots not injected" as a known CDN behavior.

---

### LOW-1: Sentry is a placeholder — no real DSN

**Finding ID:** UI-RC-009
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-SENTRY (12th warehouse-gap instance)

Line 134-137:
```js
if (typeof window.initSentry !== 'function') {
  window.initSentry = function() {
    console.log('Sentry init placeholder');
  };
}
```

No real Sentry SDK loaded. Errors in production would not be tracked.

**Action:** Low priority. Already tracked as a warehouse template gap (12th instance). No new action.

---

### LOW-2: `gameState.gameId` not set in initial state

**Finding ID:** UI-RC-010
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-GAMEID (5th confirmed live instance)

`window.gameState` at initialization does not include a `gameId` field. The SignalCollector constructor receives `templateId: gameState.gameId || null` which resolves to `null`. This means signal data is not tagged with the game template identifier in production.

**Action:** Already covered by GEN-GAMEID gen rule — already shipped. Re-confirm rule adds `gameId: 'rapid-challenge'` (or equivalent) as first field.

---

## Critical Checks Summary

| Check | Result |
|-------|--------|
| Results screen reachable | PASS — reached via `endGame('victory')` |
| Results screen `position:fixed` | FAIL — `position: static` (P0-A) |
| Play Again works without crash | PASS — returns to start screen correctly |
| Play Again state reset (lives, round, score) | PASS — `currentRound:0, lives:3, score:0, phase:'start_screen'` |
| progressBar race condition in endGame | FAIL — 10s deferred destroy can kill new instance (HIGH-3) |
| Option button min-height 44px | FAIL — 21.5px (CSS stripped, HIGH-1) |
| `waitForPackages` maxWait | PARTIAL — 120s (correct behavior, but error message says "10s"; not 180s canonical) |
| `aria-live` on feedback elements | FAIL — absent (MEDIUM-2) |
| Console errors | FAIL — `window.nextRound` MISSING (HIGH-2) + favicon 404 |
| Sentry | FAIL — placeholder only (LOW-1) |
| `data-testid` on key elements | PASS — `option-0/1/2`, `btn-restart`, `stars-display`, `score-display`, `lives-display` present |
| Level transitions (Level 1→2→3) | PASS — transition screens show correctly at rounds 3 and 6 |
| Lives deduction on wrong answer | PASS — lives correctly decremented (❤️❤️❤️ → ❤️❤️🤍) |
| Progress bar advancement | PASS — 0/9 → 1/9 → 2/9 → 3/9 correctly |

---

## Classification Routing

| Finding | Route |
|---------|-------|
| UI-RC-001 (results screen static) | Gen Quality — GEN-UX-001 coverage check |
| UI-RC-002 (CSS stripped) | Gen Quality — CSS strip root cause (known) |
| UI-RC-003 (buttons 21.5px) | Gen Quality — GEN-UX-002 .option-btn coverage |
| UI-RC-004 (window.nextRound missing) | Test Engineering — gen rule or spec addition |
| UI-RC-005 (progressBar race condition) | Gen Quality — new rule needed |
| UI-RC-006 (waitForPackages error message) | Gen Quality — minor cleanup |
| UI-RC-007 (no aria-live) | Gen Quality — ARIA-001 coverage check |
| UI-RC-008 (FeedbackManager warnings) | CDN constraint — document |
| UI-RC-009 (Sentry placeholder) | Gen Quality — warehouse gap |
| UI-RC-010 (gameState.gameId absent) | Gen Quality — GEN-GAMEID coverage check |

---

## Re-Queue Recommendation

**Not required for flow.** The game is playable end-to-end (all rounds completable, results screen reachable, Play Again functional). The P0s (results screen static, CSS stripped) are systemic pipeline issues affecting all builds — not rapid-challenge-specific bugs requiring a targeted re-queue. The progressBar race condition (HIGH-3) is a gen rule issue for future builds.

Re-queue should be triggered only after gen rule fixes for GEN-UX-001, CSS stripping, and progressBar destroy race are deployed — then queue to verify all three fixes together.
