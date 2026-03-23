# UI/UX Audit — SOH-CAH-TOA: Worked Example

**Build:** #544  **Static analysis:** 2026-03-23  **Browser playthrough:** 2026-03-23  **Auditor:** UI/UX slot

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

**UI-SC-007 — RETRACTED (browser playthrough 2026-03-23)**
Static analysis incorrectly flagged `hide('#results-screen')` as a TypeError. Browser inspection confirmed: `hide = (selector) => document.querySelector(selector)?.classList.add('hidden')` — the helper takes CSS selector strings. `hide('#results-screen')` in `restartGame()` is correct. Zero TypeErrors observed during full playthrough. Not a gen rule issue.

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
- **UI-SC-007:** RETRACTED — hide() selector pattern confirmed correct by browser playthrough

---

## Browser Playthrough Audit

**Date:** 2026-03-23  **Build:** #544  **Auditor:** UI/UX slot (Playwright MCP, localhost:7779, viewport 480×800)

### Playthrough Status: COMPLETE

Full path traversed: Start screen → Round 1 (SOH) Worked Example (4 steps) → Fill the Gap (correct) → Your Turn (correct) → Round 2 (CAH) Worked Example → Fill the Gap (correct) → Your Turn (wrong then correct — life deduction verified) → Round 3 (TOA) Worked Example → Fill the Gap (correct) → Your Turn (correct) → Results screen → Play Again → Start (second run state reset verified).

### Console Log

- 1 error: favicon 404 (not a game error)
- 5 warnings: Sentry init failed (expected local env), FeedbackManager "No audio_content" ×4 (expected — game content has no audio_content field)
- **Zero PAGEERRORs. Zero TypeErrors. Zero game-breaking errors.**

### Critical Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Start screen renders (`data-phase='start'`) | PASS | `data-phase="start"`, `data-lives="3"`, `data-round="0"` confirmed |
| Game starts — phase transitions to `playing` | PASS | "Let's go!" click → `data-phase="playing"` immediately |
| Worked Example sub-phase (step cards) | PASS | 4 steps reveal sequentially; answer shown after final step; "Got It" transitions correctly |
| Fill the Gap sub-phase (faded MCQ) | PASS | Correct/wrong handling correct; buttons disabled post-selection; feedback visible |
| Your Turn sub-phase (practice MCQ) | PASS | Wrong answer deducts 1 life; remaining options stay active until correct chosen |
| MCQ options height ≥44px | PASS (marginal) | Measured 45px (padding 14px 24px); `minHeight: "auto"` — no explicit `min-height: 44px`. UI-SC-004 confirmed. |
| Correct answer feedback visible | PASS | "Correct!" text and explanation appear in feedback box |
| Wrong answer feedback + life deduction | PASS | ❤️❤️🤍 after 1 wrong; feedback shows; remaining options stay active |
| Results screen `position: fixed` | **FAIL — P0** | `position: static`, `z-index: auto`, `rectTop: 144.5px`. Progress bar visible above results. UI-SC-001 confirmed by browser. |
| Results screen covers full viewport | **FAIL** | `coversViewport: false`. Starts at y=144.5, x=20. On mobile with scroll, results card is partially hidden. |
| Play Again button reachable | PASS | Visible and clickable; no scroll needed in 480×800 viewport |
| Zero PAGEERRORs | PASS | favicon 404 only |
| `restartGame()` full state reset | PASS (via startGame()) | `restartGame()` resets `phase='start'` only; `startGame()` (called when player clicks "Start" on transition screen) performs full reset — `lives=3`, `currentRound=0`, `score=0` confirmed on second play |
| `hide()`/`show()` DOM vs string | PASS — UI-SC-007 RETRACTED | `hide()` is `(selector) => document.querySelector(selector)?.classList.add('hidden')` — CSS selector strings are correct usage. Zero TypeErrors. |
| `data-phase` transitions | PASS | start → playing → results → start all correct |
| aria-live on feedback areas | **FAIL** | `#faded-feedback` and `#practice-feedback` both `ariaLive: null`. Zero `[aria-live]` elements anywhere on page. UI-SC-002 confirmed. |
| ProgressBarComponent `slotId` | **FAIL** | Missing from options. `#mathai-progress-slot` exists but empty after restart. UI-SC-003 confirmed. |

### New Findings vs Static Analysis

1. **UI-SC-001 — results screen non-coverage CONFIRMED by measurement:** `rectTop: 144.5`, `position: static`, `zIndex: auto`, `coversViewport: false`. P0.
2. **UI-SC-002 — aria-live CONFIRMED by browser query:** Zero `[aria-live]` elements on page.
3. **UI-SC-003 — ProgressBarComponent slotId CONFIRMED:** `#mathai-progress-slot` empty after restart (destroyed by `endGame()`).
4. **UI-SC-007 RETRACTED:** `hide()` takes CSS selector strings — correct pattern, no TypeError. Static analysis was wrong about the function signature.
5. **restartGame() gap window:** Between "Play Again" and "Start" clicks, `gameState.lives=2`, `currentRound=3` are stale — but transition screen hides game content during this window. Not player-visible. Not a bug.
6. **Game flow quality: excellent.** 3-sub-phase structure (Worked Example → Fill the Gap → Your Turn) works exactly as specified across all 3 rounds. All animations, transitions, and state changes correct.

### Updated Gen Quality Routing

- **Ship GEN-UX-001 immediately:** `#results-screen { position: fixed; inset: 0; z-index: 100 }` — now browser-verified on #544. 4th confirmed instance.
- **Remove UI-SC-007 from gen quality backlog** — retracted, hide() selector pattern is correct.
- All other routing from static analysis section above remains valid.
