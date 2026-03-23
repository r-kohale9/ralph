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
