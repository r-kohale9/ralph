# UI/UX Audit — SOH-CAH-TOA: Worked Example

**Build:** #544  **Date:** 2026-03-23  **Auditor:** UI/UX slot (static analysis)

---

## Summary

CSS is fully present and well-structured, with clear section comments referencing PART numbers (PART-020 through PART-023). ScreenLayout.inject() is used correctly. This is the most structurally clean game in this audit batch — the CSS comments and organisation are exemplary. Several recurring issues still present (no aria-live on feedback, no explicit min-height on buttons, results screen not position:fixed). One new issue: ProgressBarComponent is called with an options object but missing the `slotId` key.

---

## Issues Found

### High Priority

**UI-SC-001 — Results screen is not position:fixed (WCAG SC 1.3.4 / known pattern)**
`#results-screen` CSS: `min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--mathai-surface)` — no `position: fixed`. Same pattern as quadratic-formula-worked-example #546, find-triangle-side #549, and name-the-sides #557. On mobile with scroll, results overlay will not cover the full viewport. Classification: **(a) gen prompt rule** — 4th confirmed instance across all audits. This rule must be shipped.

**UI-SC-002 — Feedback areas missing aria-live (WCAG SC 4.1.3)**
`#faded-feedback` and `#practice-feedback` are `div.feedback-area` with class `hidden` — no `aria-live="polite"` or `role="status"`. The MCQ option groups have `role="group"` and `aria-label`, which is good. But feedback text appearing on answer selection is not announced to screen readers. Confirms ARIA-001 pattern: 5th confirmed instance across name-the-sides, which-ratio, count-and-tap, find-triangle-side, quadratic-formula. Classification: **(a) gen prompt rule** — ARIA-001 must now be enforced as shipped rule.

**UI-SC-003 — ProgressBarComponent called without slotId in options object**
```js
progressBar = new ProgressBarComponent({
    totalRounds: gameState.totalRounds,
    totalLives: gameState.totalLives,
    livesPrefix: 'Lives',
    roundsPrefix: 'Round'
});
```
No `slotId` key in the options object. Without `slotId: 'mathai-progress-slot'`, the ProgressBarComponent may fall back to a default slot ID or fail silently. This is distinct from UI-QF-003 (positional string) — here the options object format is correct but missing the slot key. Classification: **(a) gen prompt rule**.

### Medium Priority

**UI-SC-004 — `.btn-option` missing explicit min-height: 44px (HIG touch target)**
`padding: 14px 16px; font-size: 14px` — same as quadratic-formula. At default font sizes this is approximately 42-44px, at the boundary. No `min-height: 44px` is explicitly set. Classification: **(a) gen prompt rule** — 5th confirmed instance.

**UI-SC-005 — `.game-btn` full-width navigation buttons also missing min-height: 44px (HIG)**
`.game-btn { padding: 14px 24px; font-size: 15px; width: 100%; }` — "Next Step", "Got It", "Next: Practice Problem" buttons. Same boundary issue as btn-option. Classification: **(a) gen prompt rule**.

**UI-SC-006 — Step card formulas have no math accessibility (WCAG SC 1.1.1)**
`.step-formula` uses `font-family: 'Courier New', monospace`. Formulas like `x = (-b +/- sqrt(Delta)) / 2a` are plain text. No MathML, no `role="math"`, no `aria-label` providing the formula in human-readable form. Assistive technology reads the raw text literally. Classification: **(b) spec addition** — trig session should note that formula display accessibility is a known limitation until MathML support is added.

**UI-SC-007 — hide()/show() called with string selectors in some locations**
At line 921 area: `hide('#results-screen')` and `show('#results-screen')` pass CSS selector strings. But `const hide = (el) => el.classList.add('hidden')` expects a DOM element object — strings do not have `.classList`. This is a runtime TypeError if those string-argument calls execute. Other calls use `document.getElementById(...)` correctly. *Requires browser verification* to confirm whether this branch is actually reached. Classification: **(a) gen prompt rule** — `hide()`/`show()` helpers must always receive DOM element objects, not CSS selector strings.

### Low Priority / Observations

- `waitForPackages()` timeout is 10000ms (10s) — at the T1 minimum. Other games use 120000-180000ms. While T1 accepts 10000ms+, a 10s timeout on a slow CDN load could trigger false package-load failures. Low risk but worth noting.
- CSS is well-commented with PART references throughout — exemplary code organisation. This should be reinforced as a best practice in gen prompts.
- Color contrast: `--mathai-primary: #4f46e5` on `#eef2ff` for .phase-badge — ratio approx 6.4:1, passes AA. `--mathai-text-muted: #64748b` — passes AA at normal text sizes (4.6:1).
- `transitionScreen.show()` is awaited correctly with `await transitionScreen.show(...)` — Rule 25/26 compliant.
- `ScreenLayout.inject()` has the correct `#gameContent` existence guard — Rule db6f8a4 compliant.
- `initSentry()` is defined before `waitForPackages()` is called but is triggered by `window.addEventListener('load', initSentry)` after the DOMContentLoaded block completes — T1 initSentry order check passes.

---

## Routing

- **Gen Quality tasks:**
  - UI-SC-001: Results screen `position: fixed` rule — 4th confirmed instance, ship immediately (source: UI/UX audit soh-cah-toa-worked-example #544)
  - UI-SC-002: Confirm ARIA-001 extends to inline `#faded-feedback` / `#practice-feedback` panels with `aria-live="polite"` (5th confirmed instance)
  - UI-SC-003: ProgressBarComponent options object must include `slotId: 'mathai-progress-slot'` (new variant of slot ID issue — options format but missing key)
  - UI-SC-004/UI-SC-005: `min-height: 44px` on all interactive buttons — ship now (5th confirmed instance)
  - UI-SC-007: `hide()`/`show()` helpers must receive DOM element objects — never CSS selector strings; add gen rule

- **Test Engineering tasks:**
  - UI-SC-001 test gap: `#results-screen` must be position:fixed at data-phase='results' — Playwright assertion needed
  - UI-SC-007 test gap: Add Playwright test verifying results screen is visible and covers viewport (offsetTop = 0, offsetHeight = window.innerHeight) when game completes

- **Education tasks:**
  - UI-SC-006: Add note to trig session spec that formula display uses plain text monospace — log as known accessibility limitation; consider MathML requirement in future spec revision

- **CDN-blocked (no action):** None identified
