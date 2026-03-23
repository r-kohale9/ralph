# UI/UX Audit — Quadratic Formula: Worked Example

**Build:** #546  **Date:** 2026-03-23  **Auditor:** UI/UX slot (static analysis)

---

## Summary

CSS is fully present and intact — all styles defined inline in a single `<style>` block. ScreenLayout.inject() is used correctly. The worked-example / faded / practice three-phase structure is well-implemented. Several recurring issues from previous audits are confirmed here (no aria-live, no 44px explicit sizing, results screen not position:fixed).

---

## Issues Found

### High Priority

**UI-QF-001 — Results screen is not position:fixed (WCAG SC 1.3.4 / known pattern)**
`#results-screen` is styled with `min-height: 100dvh; display: flex; align-items: center; justify-content: center` but no `position: fixed`. On mobile at game completion, if the user has scrolled down during the worked-example steps, the results screen renders at the document flow position, not as a full-screen overlay. Classification: **(a) gen prompt rule**. Known pattern: confirmed in name-the-sides #557 and find-triangle-side #549. Pending fix for 3 games now.

**UI-QF-002 — Feedback areas missing aria-live (WCAG SC 4.1.3)**
`#faded-feedback` and `#practice-feedback` are both standard `div.feedback-area` elements. Neither has `aria-live="polite"` or `role="status"`. When a learner picks an MCQ answer, the correct/wrong feedback appears dynamically but is invisible to screen readers. The MCQ `role="group"` is present on the option containers (good), but the feedback region itself is not announced. Classification: **(a) gen prompt rule** — confirms ARIA-001 gap pattern.

**UI-QF-003 — ProgressBarComponent uses wrong slot ID string (confirmed pattern)**
`new ProgressBarComponent('mathai-progress-bar-slot', {...})` is called with a positional string argument rather than `{ slotId: 'mathai-progress-slot' }`. The canonical slot ID is `mathai-progress-slot` (no `-bar-` infix). This was identified as a pending gen rule from find-triangle-side #549. Third confirmed instance. Classification: **(a) gen prompt rule**.

### Medium Priority

**UI-QF-004 — MCQ buttons lack explicit minimum height (HIG: 44pt touch target)**
`.btn-option` has `padding: 14px 16px` and `font-size: 14px`. At default browser sizing this yields approximately 42-44px height, which is at the minimum boundary but not guaranteed across all fonts and user settings. No `min-height: 44px` is set explicitly. Apple HIG specifies 44x44pt minimum touch target. Classification: **(a) gen prompt rule** — confirms 44px pattern (4th instance).

**UI-QF-005 — Step cards rendered via innerHTML without sanitization**
`renderStepCard()` uses `innerHTML` to inject `stepData.label`, `stepData.text`, and `stepData.formula`. Content comes from `fallbackContent` (hardcoded in JS) and from `game_init` postMessage. If an attacker can supply game_init data, XSS is possible in production. For the test pipeline this is lower risk, but sanitization should be applied. Classification: **low priority observation**.

**UI-QF-006 — Phase distinction relies on background tint alone (WCAG SC 1.4.1)**
The three sub-phases (example = blue tint `#eff6ff`, faded = green tint `#f0fdf4`, practice = yellow tint `#fefce8`) are distinguished using colour only. A `phase-badge` text label exists and partially mitigates this, but the panel backgrounds themselves use only colour as a phase signal. WCAG SC 1.4.1 requires information not be conveyed by colour alone. The badge text ("Step 1 of 3: Worked Example") is the accessible equivalent — this is **partially compliant** but worth noting. Classification: **low priority / observation**.

**UI-QF-007 — `.page-center` class defined in CSS but never applied — dead code**
CSS defines `.page-center { width: 100%; max-width: 480px; ... }` but the HTML root is `<div id="app" data-phase="start">` — ScreenLayout.inject() replaces `#app` content, so the page centering and 480px constraint relies on ScreenLayout's injected wrapper, not `.page-center`. The `.page-center` rule is dead code. Classification: **low priority / observation**.

**UI-QF-008 — No explicit max-width: 480px breakpoint CSS for content inside injected gameContent**
The layout constrains to 480px via ScreenLayout's wrapper. This is CDN-dependent and cannot be verified without browser. *Requires browser verification.* Classification: **(c) CDN constraint**.

**UI-QF-009 — handlePostMessage checks flat event.data.content not nested event.data.data.content**
`handlePostMessage` checks `event.data.content` (flat path) not `event.data.data.content` (the nested path used by other games). This is a data contract inconsistency that could silently fail to load server-provided rounds. Classification: **(a) gen prompt rule candidate** — standardise postMessage content path.

### Low Priority / Observations

- `.btn-option` has `text-align: left` — formula options will left-align. For math formulas this is appropriate, but may look misaligned on narrow screens if the formula is longer than the button width. *Requires browser verification.*
- The `recordAttempt` function stores `...data` which spreads all properties. If `data` contains unexpected keys from postMessage, they get stored in the attempts array. Low risk but inconsistent with other games' strict schema.
- Color contrast check: `--mathai-primary: #4f46e5` on white background — ratio approx 6.6:1, passes AA. `--mathai-text-muted: #64748b` on white — ratio approx 4.6:1, passes AA barely. `#166534` (correct feedback text) on `#f0fdf4` — ratio approx 8.6:1, passes AAA.

---

## Routing

- **Gen Quality tasks:**
  - UI-QF-001: Add gen prompt rule — results screen must use `position: fixed; top: 0; left: 0; width: 100%; height: 100%;` (3rd confirmed instance — prioritise)
  - UI-QF-002: Confirm ARIA-001 covers inline feedback areas — faded-feedback and practice-feedback must have `aria-live="polite"` (4th confirmed instance)
  - UI-QF-003: Add gen prompt rule — ProgressBarComponent slot ID must use options object `{ slotId: 'mathai-progress-slot' }`, not positional string (3rd confirmed instance)
  - UI-QF-004: Add gen prompt rule — all `.btn-option` must have `min-height: 44px` (4th confirmed instance — ship this rule now)
  - UI-QF-009: Standardise postMessage content path to `event.data.data.content`

- **Test Engineering tasks:**
  - UI-QF-001 test gap: Add Playwright assertion verifying `#results-screen` has `position: fixed` or viewport-covering dimensions at `data-phase='results'`
  - UI-QF-002 test gap: Add Playwright assertion that `#faded-feedback` and `#practice-feedback` have `aria-live` attribute before they become visible

- **Education tasks:** none

- **CDN-blocked (no action):** UI-QF-008 (layout depends on ScreenLayout injection)
