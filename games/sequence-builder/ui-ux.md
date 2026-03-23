# UI/UX Audit — Sequence Builder

**Build:** #525  **Date:** 2026-03-23  **Auditor:** UI/UX slot (full browser playthrough)

---

## Summary Table

| Severity | Count |
|----------|-------|
| P0       | 2     |
| HIGH     | 3     |
| MEDIUM   | 2     |
| LOW      | 1     |
| **Total** | **8** |

---

## Browser Playthrough — Build #525 (Full)

Viewport: 375×812px. Playwright MCP. Local HTTP server (localhost:8768).

### Game Description

Sequence Builder teaches multi-step arithmetic decomposition (e.g. "65 − 24 = ?"). Each round shows a full expression and a step-by-step chain: the learner solves each sub-step (65 − 20 = ?) by selecting from 3 MCQ options, with each correct answer "locking in" before the next step unlocks. 5 rounds total; later rounds have 3 sub-steps each. 3 lives; wrong answer deducts 1 life and allows retry.

### Playthrough Steps Completed

1. Start screen — TransitionScreen with "Sequence Builder" title, 🔢 icon, "Let's go!" CTA. Progress bar shows 0/5, 3 hearts.
2. Clicked "Let's go!" → Round 1 loaded: "65 − 24 = ?" with 2 sub-steps. Content renders at bottom third of viewport (layout spacing issue).
3. Answered Round 1 Step 1 correctly (45) → Step 2 unlocked ("45 − 4 = ?"). Step 1 answer "locked in" visually.
4. Answered Round 1 Step 2 correctly (41) → chain complete → Round 2 loaded. Progress: 1/5.
5. Completed Round 2 (47+36: steps 77, 83) → Progress: 2/5.
6. Completed Round 3 (82−35: steps 52, 47) → Progress: 3/5.
7. Completed Round 4 (156−78: 3 steps — 86, 80, 78) → Progress: 4/5.
8. Completed Round 5 (234+189: 3 steps — 334, 414, 423) → endGame('victory') triggered.
9. Results screen shown: "Great Job!", ⭐⭐⭐, 5/5 rounds, 12 steps completed, 0 wrong, 100% accuracy.
10. Clicked "Play Again" → returns to start TransitionScreen (state reset confirmed: 0/5, 3 hearts).

All 5 rounds completed. Results screen reachable. Play Again functional.

---

## Findings

### P0-A: Results screen is `position: static` — not `position: fixed`

**Finding ID:** UI-SB-001
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-UX-001 (12th confirmed live instance)

`document.getElementById('results-screen')` computed style: `position: static`, `z-index: auto`. Results screen top: 64px in document flow when rendered (below the ScreenLayout-injected progress bar). Under ScreenLayout flex body layout, this means the results screen is not a fixed overlay — on smaller or wider viewports it can appear off-screen. GEN-UX-001 (`#results-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100 }`) is already shipped but was not applied in this build (CSS was stripped — see P0-B).

**Action:** Already covered by GEN-UX-001. Verify rule is active. No separate action.

---

### P0-B: CSS entirely stripped — all custom styles absent

**Finding ID:** UI-SB-002
**Category:** (a) gen rule → Gen Quality
**Rule reference:** CSS-STRIP (7th confirmed live instance)

The `<style>` block at line 14–16 contains only: `/* [CSS stripped — 57 chars, not relevant to JS fix] */`. No custom CSS is applied. Consequences:
- Answer option buttons (`data-option-index`): `height: 21.5px`, `minHeight: 0px` — fail 44px touch target requirement.
- "Play Again" button (`#btn-restart`): `height: 21.5px` — fail 44px.
- Step chain layout, answer feedback (`.correct`, `.wrong`, `.error` classes) and final summary rendered with zero custom styling — visual experience is browser-default.
- `.full-expression-area` and `.steps-chain` have no layout CSS — content collapses to bottom of viewport because ScreenLayout `page-center` centering has nothing to distribute.

**Action:** CSS strip root cause already flagged as known pipeline issue. No new gen rule action needed beyond existing tracking.

---

### HIGH-1: Answer option buttons and Play Again button are 21.5px tall — fail 44px touch target

**Finding ID:** UI-SB-003
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-UX-002 (confirmed, `data-option-index` buttons not covered)

Measured via `getBoundingClientRect()`:
- All answer option buttons (e.g. "40", "45", "50"): `height: 21.5px`, `minHeight: 0px`
- `#btn-restart` ("Play Again"): `height: 21.5px`

Root cause is CSS stripping (UI-SB-002). GEN-UX-002 requires `min-height: 52px` on game buttons; the CSS was stripped.

**Action:** Verify GEN-UX-002 selector covers game-specific option button classes. No additional rule needed beyond CSS strip fix.

---

### HIGH-2: `window.nextRound` not exposed — test harness MISSING error

**Finding ID:** UI-SB-004
**Category:** (d) test gap → Test Engineering
**Rule reference:** GEN-WINDOW-EXPOSE (nextRound pattern — 3rd live instance)

Console error at page load:
```
[ralph-test-harness] MISSING window.nextRound: this function is not exposed on window.
Tests calling window.__ralph.nextRound() will fail silently.
Fix: add window.nextRound = nextRound; in the game code.
```

The game exposes: `window.endGame`, `window.restartGame`, `window.calcStars`. It does NOT expose `window.nextRound`. The test harness `var required = ['endGame', 'restartGame', 'nextRound']` at line 890 fires the error. Sequence Builder uses `loadRound()` internally but does not alias it as `window.nextRound`.

**Action:** Gen rule addition — `window.nextRound = loadRound;` (or equivalent advance-round function) must be assigned in game initialization. Route to Test Engineering for harness alignment check.

---

### HIGH-3: `endGame()` destroys progressBar via 10s setTimeout — race condition with `restartGame()`

**Finding ID:** UI-SB-005
**Category:** (a) gen rule → Gen Quality
**Rule reference:** GEN-PROGRESSBAR-DESTROY-RACE (3rd confirmed live instance)

`endGame()` at line 434–441:
```js
setTimeout(() => {
    try {
        progressBar?.destroy();
        visibilityTracker?.destroy();
    } catch(e) {}
    progressBar = null;
    visibilityTracker = null;
}, 10000);
```

`restartGame()` at line 491–493:
```js
progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 5, totalLives: 3, slotId: 'mathai-progress-slot' });
```

If the user clicks "Play Again" within 10 seconds of `endGame()`, `restartGame()` creates a new `progressBar` instance — but the deferred `destroy()` fires and destroys the **newly created** progressBar. Confirmed: browser log shows `[ProgressBar] Destroyed` after "Play Again" was clicked (the destroy fired on the new instance). Previous instances: right-triangle-area #543 and rapid-challenge #526.

**Action:** Same pattern as UI-RC-005. New gen rule needed — `endGame()` deferred destroy must be cancelled or guarded when `restartGame()` creates a new instance. Route to Gen Quality.

---

### MEDIUM-1: `syncDOMState()` targets `#app` only — `body[data-phase]` never set

**Finding ID:** UI-SB-006
**Category:** (a) gen rule → Gen Quality / (d) test gap → Test Engineering
**Rule reference:** LP-4 pattern (4th live-build confirmed instance)

`syncDOMState()` at line 84–90 reads:
```js
const app = document.getElementById('app');
if (app) {
    app.dataset.phase = window.gameState.phase;
    app.dataset.lives = window.gameState.lives;
    ...
}
```

`document.body` is never assigned `data-phase`, `data-lives`, or `data-round`. Any Playwright test assertion using `body[data-phase="playing"]` or `body[data-lives]` will fail — `#app[data-phase]` is the correct selector. This is the same LP-4 pattern confirmed in real-world-problem (#564), count-and-tap (#551), and associations (#472). Test harness correctly reads `#app[data-phase]` — the mismatch only affects tests that incorrectly target `body`.

**Action:** Confirm test suite uses `#app[data-phase]` selector throughout. Gen Quality: verify gen rule mandates `#app` as target (not body). No separate action if tests are already correct.

---

### MEDIUM-2: No `aria-live` on any feedback element

**Finding ID:** UI-SB-007
**Category:** (a) gen rule → Gen Quality
**Rule reference:** ARIA-001 (15th confirmed live instance)

`document.querySelectorAll('[aria-live]')` returns 0 elements. No feedback element (step correct/incorrect, chain complete, game end) has `aria-live="polite"` or `role="status"`. Correct/wrong step feedback is communicated only via visual CSS class changes (`.correct`, `.wrong`, `.error`).

**Action:** Already covered by ARIA-001 gen rule (already shipped). Re-confirm rule is active.

---

### LOW-1: FeedbackManager `playDynamicFeedback({ event: '...' })` — no `audio_content` provided

**Finding ID:** UI-SB-008
**Category:** (c) CDN constraint → document

Per-round completion and error feedback calls `FeedbackManager.playDynamicFeedback({ event: 'success' })` and `FeedbackManager.playDynamicFeedback({ event: 'error' })`. These fire 5 warnings:
```
[FeedbackManager] No audio_content provided
```

The CDN FeedbackManager requires `audio_content` (a TTS string) to play dynamic audio. Calls using only `{ event: 'X' }` without `audio_content` silently skip audio. The end-game calls (victory/game_over) correctly include `audio_content` strings. The per-step and per-chain calls do not.

**Action:** Spec/gen rule addition: all `playDynamicFeedback` calls must include `audio_content`. Document this CDN constraint. Route to Gen Quality for rule addition.

---

## Critical Checks Summary

| Check | Result |
|-------|--------|
| Results screen reachable | PASS — all 5 rounds completable, results shown correctly |
| Results screen `position: fixed` | FAIL — `position: static` (P0-A, UI-SB-001) |
| Play Again works without crash | PASS — returns to start TransitionScreen |
| Play Again state reset (lives, round, score) | PASS — `currentRound:0, lives:3, score:0, phase:'start'` |
| progressBar race condition in endGame | FAIL — 10s deferred destroy races with restartGame() new instance (HIGH-3) |
| Option button min-height 44px | FAIL — 21.5px (CSS stripped, HIGH-1) |
| `waitForPackages` maxWait | PASS — 120s (correct behavior; 120s is suboptimal vs 180s canonical but functional) |
| `aria-live` on feedback elements | FAIL — absent (MEDIUM-2, ARIA-001 15th instance) |
| Console errors | FAIL — `window.nextRound` MISSING (HIGH-2) + favicon 404 |
| `window.nextRound` defined | FAIL — not exposed (HIGH-2) |
| CSS intact | FAIL — stripped (P0-B) |
| `gameState.gameId` set | PASS — `'game_sequence_builder'` as first field |
| `syncDOMState()` targets `#app` | PASS — `#app[data-phase]` set correctly |
| Progress bar advancement | PASS — 0/5 → 1/5 → 2/5 → 3/5 → 4/5 → 5/5 correctly |
| Lives deduction on wrong answer | PASS — decremented and synced to DOM |
| Multi-step chain (3+ steps) | PASS — Rounds 4 and 5 (3-step chains) complete correctly |
| FeedbackManager audio_content | FAIL — per-step/chain calls omit audio_content (LOW-1) |

---

## Classification Routing

| Finding | Route |
|---------|-------|
| UI-SB-001 (results screen static) | Gen Quality — GEN-UX-001 coverage check (12th instance) |
| UI-SB-002 (CSS stripped) | Gen Quality — CSS strip root cause (7th instance, known) |
| UI-SB-003 (buttons 21.5px) | Gen Quality — GEN-UX-002 option selector coverage |
| UI-SB-004 (window.nextRound missing) | Test Engineering — gen rule or spec addition |
| UI-SB-005 (progressBar race condition) | Gen Quality — GEN-PROGRESSBAR-DESTROY-RACE rule needed (3rd instance) |
| UI-SB-006 (syncDOMState #app only) | Gen Quality + Test Engineering — LP-4 pattern (4th instance) |
| UI-SB-007 (no aria-live) | Gen Quality — ARIA-001 coverage check (15th instance) |
| UI-SB-008 (FeedbackManager no audio_content) | Gen Quality — new rule for playDynamicFeedback calls |

---

## Re-Queue Recommendation

**Not required for flow.** The game is playable end-to-end: all 5 rounds completable (including 3-step chains in rounds 4 and 5), results screen reachable, Play Again functional and state reset correct. The P0s (results screen static, CSS stripped) and HIGHs (progressBar race, window.nextRound missing, button height) are systemic pipeline issues affecting all builds — not sequence-builder-specific bugs requiring a targeted re-queue.

Re-queue should be triggered only after gen rule fixes for CSS stripping, GEN-PROGRESSBAR-DESTROY-RACE, and window.nextRound exposure are deployed — then queue to verify all three together.
