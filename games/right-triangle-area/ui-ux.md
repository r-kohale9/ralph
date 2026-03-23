# UI/UX Audit — Right Triangle Area Challenge

**Build:** #543  **Date:** 2026-03-23  **Auditor:** UI/UX slot (static analysis)

---

## Summary

**CRITICAL: CSS is fully stripped.** The `<style>` block contains only the comment `/* [CSS stripped — 57 chars, not relevant to JS fix] */`. This is the same catastrophic failure seen in count-and-tap #551 and word-pairs #529. The game renders with zero custom styling — no layout, no button appearance, no color system. The PART-028 T1 check (shipped dc03155) should have caught this; this build predates that fix (build #543 vs PART-028 ship date 2026-03-22).

Secondary issues are noted below but are largely masked by the CSS strip — they cannot be confirmed without layout context.

Canvas dimensions are hardcoded at `width="500" height="310"` — wider than the 480px mobile constraint.

---

## Issues Found

### High Priority

**UI-RTA-001 — CSS fully stripped — CRITICAL (PART-028 / FIX-001 pattern)**
`<style>/* [CSS stripped — 57 chars, not relevant to JS fix] */</style>` — entire stylesheet replaced with a one-line comment during a JS-only surgical fix. The game has no custom styling whatsoever. All visual presentation falls back to browser defaults: unstyled headings, block-level buttons with default appearance, no color system, no layout constraints. Canvas may overflow its container. Classification: **(a) gen prompt rule** — already in ROADMAP as FIX-001. This is the 4th confirmed instance (which-ratio #560, name-the-sides #557, count-and-tap #551, right-triangle-area #543). PART-028 T1 check shipped; this build predates it.

**UI-RTA-002 — Canvas hardcoded at 500px wide — exceeds 480px mobile layout (no 480px breakpoint)**
`<canvas id="triangle-canvas" width="500" height="310">` — the canvas is 500px wide, 20px wider than the standard 480px mobile constraint. Without CSS, there is no `max-width: 100%` on the canvas. On a 375px iPhone screen, the canvas will overflow the viewport causing horizontal scroll. Even with CSS restored, the canvas dimensions should be responsive (e.g. `width="100%" height="auto"` via CSS). Classification: **(a) gen prompt rule** — canvas elements must have `style="max-width: 100%; height: auto;"` or responsive sizing.

**UI-RTA-003 — Feedback text uses inline `style.color` with undefined CSS variables**
`feedbackMsg.style.color = 'var(--mathai-green)'` and `feedbackMsg.style.color = 'var(--color-orange)'` — these CSS variables are not defined in the (now-stripped) stylesheet. With CSS stripped, `var(--mathai-green)` resolves to empty string, rendering feedback text invisible (inherits body color — dark on dark potentially). Even with CSS restored, `--color-orange` is not in the standard mathai design token set (which uses `--mathai-warning: #f59e0b`). `--mathai-green` is also non-standard (standard is `--mathai-success: #22c55e`). Classification: **(a) gen prompt rule** — use only defined CSS variables; feedback text color must use `--mathai-success` and `--mathai-error` tokens.

**UI-RTA-004 — ProgressBarComponent called with CSS selector string `'#mathai-progress-bar-slot'`**
`new ProgressBarComponent('#mathai-progress-bar-slot', {...})` — the hash prefix makes this a CSS selector, not a slot ID. The correct slot ID string is `mathai-progress-slot` (no hash, no `-bar-` infix). This is a distinct variant: positional argument with wrong format. 4th confirmed instance of ProgressBarComponent slot ID errors. Classification: **(a) gen prompt rule** — confirmed pattern.

**UI-RTA-005 — Feedback area has no ARIA live region (WCAG SC 4.1.3)**
`<div id="feedback-message" data-testid="feedback-message">` — correct/wrong feedback rendered by setting `.textContent`. No `aria-live="polite"` or `role="status"`. Screen reader users will not hear feedback on answer selection. Classification: **(a) gen prompt rule** — ARIA-001 pattern, 6th confirmed instance.

### Medium Priority

**UI-RTA-006 — Timer text color uses `feedbackMsg.style.color = 'var(--color-orange)'` for timeout**
Separate from UI-RTA-003: the timeout feedback path uses `'var(--color-orange)'` which is undefined in the design system. The standard token is `--mathai-warning: #f59e0b`. Classification: **(a) gen prompt rule** — extends UI-RTA-003.

**UI-RTA-007 — Answer buttons have no class-based styling (CSS stripped)**
`button.className = 'answer-btn'` — the button class `answer-btn` had styling in the original CSS. With CSS stripped, buttons render as plain browser-default buttons. Even with CSS restored: no `min-height: 44px` is likely in the original CSS (which we cannot verify due to stripping). Classification: **(a) gen prompt rule** — min-height: 44px on answer buttons (5th+ confirmed instance); requires browser verification after CSS restore.

**UI-RTA-008 — Results screen uses `style="display: block"` not position:fixed overlay**
`document.getElementById('results-screen').style.display = 'block'` — inline style, not CSS class toggle. The results-screen `div` has `data-testid="results-screen"` and `style="display: none"` in HTML. No `position: fixed` in the (stripped) CSS. Classification: **(a) gen prompt rule** — results screen position:fixed pattern, 5th confirmed instance.

**UI-RTA-009 — `FeedbackManager.sound.play('timeout')` uses non-standard API path**
`FeedbackManager.sound.play('timeout')` — the standard API is `FeedbackManager.playDynamicFeedback({ event: 'error' })`. The `.sound.play()` sub-namespace may not exist or may behave differently. This appears similar to the PART-011-SOUND ban on `FeedbackManager.sound` namespace. Classification: **(a) gen prompt rule** — use only `FeedbackManager.playDynamicFeedback`; `FeedbackManager.sound.play` is non-standard (T1 may already catch this via PART-011-SOUND check — verify).

**UI-RTA-010 — Google Fonts loaded (Fredoka One, Nunito) — CDN dependency**
```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
```
External Google Fonts dependency adds a network request that may fail or slow rendering. Canvas uses `ctx.font = 'bold 17px Nunito'` — if Nunito fails to load, canvas falls back to system sans-serif (layout change). Classification: **(b) spec addition** — game spec should note font dependency; or gen rule should prefer system fonts.

### Low Priority / Observations

- `createConfetti()` generates DOM elements for confetti animation on correct answer — nice touch but no cleanup function visible. May cause DOM bloat on repeated plays. Observation only.
- CDN scripts are loaded in `<head>` before `<body>` (unusual — most games load them at end of body). This is acceptable since they're async CDN loads, but may cause FOUC. *Requires browser verification.*
- `verifySentry()` calls `Sentry.getClient()` without guarding for undefined Sentry — would throw if Sentry SDK fails to load. Low risk.
- `signalCollector` is initialised inside the DOMContentLoaded block after ScreenLayout.inject() — correct pattern.

---

## Routing

- **Gen Quality tasks:**
  - UI-RTA-001: CSS strip prevention (FIX-001) — PART-028 shipped; verify this build predates it; confirm coverage in T1 check applies to `/* [CSS stripped...]` pattern
  - UI-RTA-002: Canvas elements must use `max-width: 100%; height: auto;` via CSS — new gen rule needed for canvas-based games
  - UI-RTA-003/UI-RTA-006: Use only defined CSS variable tokens for feedback color — ban `var(--color-orange)` and `var(--mathai-green)`; standard tokens only
  - UI-RTA-004: ProgressBarComponent slot ID — add explicit rule banning hash-prefix and `-bar-` infix in slot ID (4th confirmed instance)
  - UI-RTA-005: ARIA-001 — aria-live on feedback-message div (6th confirmed instance — ship ARIA-001 now)
  - UI-RTA-008: Results screen position:fixed (5th confirmed instance)
  - UI-RTA-009: Verify T1 PART-011-SOUND covers `FeedbackManager.sound.play()` — add to ban if not covered

- **Test Engineering tasks:**
  - UI-RTA-002 test gap: Add Playwright assertion that canvas element has `offsetWidth <= 480` on 480px viewport
  - UI-RTA-008 test gap: Add Playwright assertion that results screen covers full viewport at data-phase='results'
  - UI-RTA-009 test gap: Add static lint check that `FeedbackManager.sound.play` is not used (verify PART-011-SOUND covers this)

- **Education tasks:**
  - UI-RTA-010: Add note to spec that external font dependencies should be avoided; prefer system fonts or specify fallback explicitly

- **CDN-blocked (no action):** None identified

---

## Browser Playthrough — Build #543 (Full)

**Date:** 2026-03-23
**Method:** Playwright MCP, GCP HTML downloaded to `/tmp/rta-543.html`, served locally at `http://localhost:8766/rta-543.html`, viewport 375×812px (iPhone SE)
**Build:** #543

### Summary Table

| Severity | Count |
|----------|-------|
| P0 | 1 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 2 |
| PASS | 6 |

---

### P0 Issues

**UI-RTA-B-001 — Play Again crashes with TypeError: Cannot read properties of null (reading 'update') — P0 restartGame() null progressBar**

`restartGame()` at line 567 calls `progressBar.update({ progress: 0, label: 'Q1' })` unconditionally. After `endGame()`, there is a `setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000)` (lines 524–534). By the time the user clicks "Play Again" (~10s after the last round), `progressBar` is null. This crashes `restartGame()` entirely — the game is stuck on the results screen and cannot be restarted.

Observed: clicking "Play Again" produced `TypeError: Cannot read properties of null (reading 'update') at HTMLButtonElement.restartGame (rta-543.html:567)` in browser console. Screenshot confirmed game stuck on results screen after crash.

Fix: `if (progressBar) progressBar.update(...)` guard in `restartGame()`, or re-instantiate `progressBar` inside `restartGame()` (same as the correct pattern).
Classification: **(a) gen prompt rule** — restartGame() must null-check progressBar before calling .update(). 1st confirmed P0 crash from this pattern.

---

### HIGH Issues

**UI-RTA-B-002 — Canvas overflows viewport — 500px canvas on 375px viewport, right edge at 520px (145px overflow)**

Measured: `canvas.getBoundingClientRect()` → `{ width: 500, height: 310, left: 20, right: 520, viewportWidth: 375, canvasOverflows: true }`. Canvas has no inline style (`inlineStyle: null`) and no CSS `max-width` constraint (`maxWidth: "none"`). The 500px fixed canvas width extends 145px past the right viewport edge, causing horizontal scroll. `GEN-CANVAS-001` (`style="max-width: 100%; height: auto;"`) is absent. This confirms the static analysis finding (UI-RTA-002).

Observed in screenshot: triangle right edge reaches viewport edge; base label "6 cm" partially clips.
Classification: **(a) gen prompt rule** — GEN-CANVAS-001 confirmed P0-level visual. 1st live-build confirmation (previously static-only).

**UI-RTA-B-003 — All buttons below 44px min-height: answer-btn 21.5px, restart/play-again 22px**

Measured: all 4 `.answer-btn` elements: `height: 21.5px`. `#btn-restart`: `height: 22px`. `#btn-play-again`: `height: 21.5px`. No button passes the 44px touch target minimum. This is a direct consequence of CSS being fully stripped — `.answer-btn` and button CSS were deleted. Confirms UI-RTA-007 (static analysis finding).

Classification: **(a) gen prompt rule** — GEN-UX-002 (min-height: 44px). 2nd confirmed live measurement this session for `.answer-btn` (word-pairs #529 also 21.5px).

**UI-RTA-B-004 — `window.nextRound` not exposed on window — test harness reports MISSING at load**

Harness check at line 975: `var required = ['endGame', 'restartGame', 'nextRound']`. Console error on load: `[ralph-test-harness] MISSING window.nextRound: this function is not exposed on window. Tests calling window.__ralph.nextRound() will fail silently.` Searching the HTML: `window.endGame = endGame` is assigned, `window.restartGame = restartGame` is assigned, but `window.nextRound` is never assigned. The `nextRound` function (which maps to `startRound(currentRound + 1)`) exists but is not exposed.

Classification: **(a) gen prompt rule** — GEN-WINDOW-EXPOSE: all required functions must be exposed. `window.nextRound` is a new required exposure not previously confirmed missing in this game. Test Engineering action: harness `nextRound()` calls will silently fail for all right-triangle-area builds until fixed.

---

### MEDIUM Issues

**UI-RTA-B-005 — ProgressBar shows "[object Object]/5 rounds completed" — API mismatch in progressBar.update() call**

`progressBar.update({ progress: 0, label: 'Q1' })` is called with an object argument. The CDN ProgressBarComponent's `.update()` method expects positional arguments `(progress, total)` not a config object. The label "[object Object]" is the stringified config object. Also: the ProgressBar shows "5 rounds" instead of 3 — likely the CDN default total is 5 when the positional `total` arg is missing. The progress text is always wrong throughout gameplay.

Observed: progress bar consistently displayed `[object Object]/5 rounds completed` from start screen through results.
Classification: **(a) gen prompt rule** — progressBar.update() must use positional args `(roundIndex, livesOrTotal)` not a config object. 1st confirmed live-build instance of this specific API misuse.

**UI-RTA-B-006 — Feedback area has no aria-live (WCAG SC 4.1.3)**

`document.getElementById('feedback-message')` has `ariaLive: null, role: null`. Correct/wrong/timeout feedback is set via `.textContent` on this element with no screen reader announcement. Confirms UI-RTA-005 (static analysis). 7th confirmed live-build instance (word-pairs #529 also confirmed).
Classification: **(a) gen prompt rule** — ARIA-001. Rule already shipped; this confirms it applies to this build.

**UI-RTA-B-007 — Results screen is position:static, not position:fixed — renders in document flow**

`window.getComputedStyle(resultsScreen).position` = `"static"`. `resultsTop: 83.9px` (below progress bar header). The results screen does not overlay the viewport as a modal — it renders below the CDN progress bar. If the user had scrolled during gameplay, the results screen would be out of view. However, at 375×812px the results screen bottom is 764.7px (within 812px viewport) so it fits this run. Confirms UI-RTA-008 (static analysis).
Classification: **(a) gen prompt rule** — GEN-UX-001 (results screen position:fixed). 11th confirmed instance across audit batch.

---

### LOW Issues

**UI-RTA-B-008 — Sentry not loaded via script tag — initSentry() function present but Sentry SDK absent from HTML**

No `<script src="...sentry...">` tag found. `typeof Sentry` = `"not defined"` in browser evaluation. Console shows Sentry 7.105.0 loaded via CDN (appears to be injected by CDN package loader), not via direct HTML inclusion. `initSentry()` function at line 90 calls `SentryConfig.init()` conditionally. This is a low-risk observation — Sentry appears to function via CDN injection.
Classification: **low / observation** — no action needed, CDN handles Sentry injection.

**UI-RTA-B-009 — waitForPackages timeout is 180000ms (correct) — PASS noted for record**

`waitForPackages()` uses `const timeout = 180000` (line 627). Correct. The previous static analysis raised this as a concern (line 534 shows 10000 for a different timeout — that is the `endGame()` cleanup delay, not waitForPackages). waitForPackages is correctly set to 180s.
Classification: **PASS** — no action needed.

---

### PASS Items

- **waitForPackages 180000ms** — correct (line 627). PASS.
- **restartGame() resets gameState fields** — `setupGame()` resets `currentRound`, `score`, `streak`, `attempts`, `isActive`, `gameEnded`. PASS (reset is correct except for the null progressBar crash above).
- **Results screen reachable** — all 3 rounds completable; results screen displayed after round 3 with correct stats (Score: 1/3, Accuracy: 33%, Correct: 1, Wrong: 1, Timeouts: 1). PASS.
- **Correct/wrong/timeout feedback paths** — all 3 tested and functional (correct: "✅ Correct! Great work!", wrong: "❌ Not quite. The correct area is 20 cm²", timeout: "⏰ Time's up! The correct area is 12 cm²"). PASS.
- **Canvas draws correctly** — triangle renders with labeled base and height; formula hint displayed. PASS.
- **gameState.totalLives undefined** — non-lives game confirmed (`window.gameState.totalLives` = undefined). Correct for this game type. PASS.

---

### Routing

**Gen Quality tasks (new from browser playthrough):**
- UI-RTA-B-001: restartGame() must null-check progressBar before calling .update() — new gen rule for restartGame() null guard pattern
- UI-RTA-B-002: GEN-CANVAS-001 confirmed live — `style="max-width: 100%; height: auto;"` on all canvas elements (ship rule if not already in CDN_CONSTRAINTS_BLOCK)
- UI-RTA-B-004: window.nextRound must be exposed — add to GEN-WINDOW-EXPOSE rule
- UI-RTA-B-005: progressBar.update() positional args only — ban config-object form of update() call

**Test Engineering tasks (new from browser playthrough):**
- UI-RTA-B-001: Add Playwright test: click Play Again after results, assert game returns to playing phase (would catch null progressBar crash)
- UI-RTA-B-002: Add assertion: canvas offsetWidth ≤ viewport width (375px) on mobile viewport
- UI-RTA-B-004: window.nextRound must be verified in harness MISSING check — add to test coverage for all canvas/area games
