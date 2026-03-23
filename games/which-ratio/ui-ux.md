# UI/UX Audit — which-ratio

**Build:** #561 (latest approved)
**Date:** 2026-03-23
**URL:** https://storage.googleapis.com/mathai-temp-assets/games/which-ratio/builds/561/index.html
**Method:** Full HTML + CSS + JS static analysis (CSS present in #561 — prior stripped-CSS issue resolved)
**Prior audit:** Build #560 (2026-03-23) — 8 issues including CRITICAL CSS stripping. All #560 issues re-checked below.

---

## Status vs Build #560

| #560 Issue | #561 Status |
|------------|-------------|
| CRITICAL: CSS stylesheet stripped | **FIXED** — full `<style>` block present (291 lines) |
| Option buttons no explicit 44px touch target | **Still present** — `padding: 12px 20px`, no `min-height` |
| No ARIA live regions on feedback elements | **Still present** — no `aria-live` on `#correct-feedback` / `#skip-note` |
| SVG no fallback width/height + tiny labels | **Partially fixed** — CSS sets `#triangle-diagram svg { width: 100%; height: auto }` via container; labels still `font-size="5"` |
| Correct feedback 1200ms auto-dismiss | **Still present** |
| Skip note duration inconsistent (1500ms/2000ms) | **Still present** |
| No live score display | **Still present** (CDN constraint — not fixable) |
| Muted SVG lines #94a3b8 below WCAG AA | **Still present** — `const mutedColor = '#94a3b8'` hardcoded in JS |

---

## Issue 1 — Option buttons lack explicit min-height: 44px (a) Gen prompt rule

**Observation:** `.option-btn` CSS defines `padding: 12px 20px` and `font-size: 1rem`. There is no `min-height` or `min-width` declaration. At 1rem ≈ 16px, line-height ≈ 1.5, plus 24px padding = ~48px total — borderline on desktop. However: on small screens or when font-size is scaled down by browser, the computed height can drop below 44px. More critically, the `we-btn` class (Got it / Skip buttons) defines only `padding: 10px 20px` at `font-size: 1rem` — total height ≈ 44px, with zero margin. Any browser font-size reduction pushes these below minimum.

**Impact:** Tap targets below 44px violate iOS HIG and Android Material Design minimums. Miss-taps on mobile cause accidental option selections.

**Classification:** (a) Gen prompt rule

**Proposed rule (already in ROADMAP.md R&D backlog — confirm not yet implemented):**
```
All interactive buttons (option-btn, we-btn, any clickable element) MUST have min-height: 44px and min-width: 44px. Tap target sizing must be explicit in the CSS, not inherited or implicit.
```

---

## Issue 2 — No ARIA live regions on dynamic feedback elements (a) Gen prompt rule

**Observation:** `#correct-feedback` and `#skip-note` are toggled via `classList.add('visible')` / `classList.remove('visible')`. Neither element has `aria-live="polite"` or `role="alert"`. Screen readers will not announce "Correct! sin θ is the right ratio." when it appears.

**HTML (line 321–323):**
```html
<div id="correct-feedback" data-testid="correct-feedback">Correct!</div>
<div id="skip-note" data-testid="game-skip-note">Skipping round.</div>
```

**Impact:** Inaccessible to screen reader users. Correct/incorrect state changes are invisible to assistive technology.

**Classification:** (a) Gen prompt rule

**Proposed rule (already in ROADMAP.md R&D backlog — confirm not yet implemented):**
```
Feedback elements that appear dynamically (correct/incorrect messages, skip notes, score updates) MUST have aria-live="polite" (or role="alert" for immediate errors). Example: <div id="correct-feedback" aria-live="polite" ...>
```

---

## Issue 3 — SVG text labels use font-size="5" (unitless raw SVG) (a) Gen prompt rule

**Observation:** All four SVG labels (A, O, H, θ) use `font-size="5"` as a raw attribute in a `viewBox="0 0 100 60"`. This renders at 5/100 = 5% of viewBox width. On a 300px canvas, labels are 15px — readable. On a 200px canvas (common on 320px screens with margin), labels are 10px — below legibility threshold.

**Additional concern:** The SVG element itself has no `width`/`height` attributes — it relies entirely on `#triangle-diagram svg { width: 100%; height: auto }` in CSS. The CSS is now present, so this is not a critical failure, but is fragile: any future CSS-stripping incident would collapse the SVG.

**Classification:** (a) Gen prompt rule

**Proposed rule (already in ROADMAP.md R&D backlog as SVG constraint):**
```
SVG elements used as diagrams MUST have explicit width and height attributes (e.g., width="100%" height="auto") as a fallback. SVG text labels should use font-size values that are at least 8% of the viewBox height.
```

---

## Issue 4 — Muted SVG lines use #94a3b8 — contrast ratio ~2.7:1 (a) Gen prompt rule

**Observation:** `renderTriangle()` hardcodes `const mutedColor = '#94a3b8'` (slate-400). Against white background (`--page-bg: #f8fafc`, effectively white), contrast ratio is approximately 2.7:1 — below the WCAG AA minimum of 3:1 for non-text graphical elements.

**Classification:** (a) Gen prompt rule

**Proposed rule (already in ROADMAP.md R&D backlog):**
```
SVG diagram lines that convey information (triangle sides, graph axes, bar outlines) must use a muted stroke color with contrast ratio >= 3:1 against the background. #94a3b8 on white fails this. Use #64748b (slate-500) or darker.
```

---

## Issue 5 — Correct feedback auto-dismisses in 1200ms — no learner control (b) Spec addition

**Observation:** `setTimeout(() => { feedbackEl.classList.remove('visible'); nextRound(); }, 1200)` — 1200ms is below the recommended minimum of 1500ms for feedback a learner may wish to read.

**Classification:** (b) Spec addition

**Proposed spec addition:** "Correct feedback must display for at least 1500ms. The game should not auto-advance in under 1500ms."

---

## Issue 6 — Skip note duration inconsistent across two code paths (b) Spec addition

**Observation:**
- `handleWorkedExampleSkip()` → `setTimeout(..., 1500)` (line 707)
- `handleOptionClick()` second-incorrect branch → `setTimeout(..., 2000)` (line 680)

Both paths display the skip note and advance to the next round. The durations differ by 500ms — perceptible inconsistency.

**Classification:** (b) Spec addition

**Proposed spec addition:** "Skip feedback duration must be consistent across all skip paths. Use a single constant; minimum 1500ms."

---

## Issue 7 — No live score display during gameplay (c) CDN constraint

**Observation:** `ProgressBarComponent` is configured with `totalLives: 0`. Score is tracked in `gameState.score` but never displayed mid-game. Score and stars are only revealed at the end via `TransitionScreenComponent`.

**Classification:** (c) CDN constraint — ProgressBarComponent API does not expose a live score prop. Not fixable via gen prompt.

---

## NOT an issue — Results screen (CDN TransitionScreenComponent is fixed overlay)

**Observation from prior audit template:** The results screen concern from name-the-sides (position:static) does NOT apply here. `which-ratio` uses `TransitionScreenComponent` with `autoInject: true`, which renders as a full-screen fixed overlay via CDN implementation. This is the correct pattern. No issue.

---

## NOT an issue — progressBar.update() arguments

**Observation:** `progressBar.update(gameState.currentRound, gameState.totalRounds)` — `currentRound` starts at 1 (after `nextRound()` increments it) and maxes at `totalRounds`. No negative values possible in the normal flow path.

---

## NOT an issue — Mobile layout at 480px

**Observation:** `@media (max-width: 600px)` switches `#option-buttons` to `grid-template-columns: 1fr` (single column) and reduces `#triangle-diagram max-width` to 250px. At 480px this breakpoint is active. Layout stacks vertically without horizontal scroll. The `overflow: hidden` on `html, body` prevents scroll. No issue.

---

## NOT an issue — CSS stylesheet present

**Build #561 has full CSS** (291 lines of real rules). The CRITICAL issue from build #560 is resolved. T1 check PART-028 (detect comment-only `<style>` blocks) would correctly pass this build.

---

## Summary

| # | Issue | Severity | Classification |
|---|-------|----------|---------------|
| 1 | Option buttons lack explicit min-height: 44px | High | (a) Gen prompt rule |
| 2 | No ARIA live regions on dynamic feedback elements | High | (a) Gen prompt rule |
| 3 | SVG labels use font-size="5" — may be too small at 200px canvas | Medium | (a) Gen prompt rule |
| 4 | Muted SVG lines #94a3b8 — contrast ratio ~2.7:1, below WCAG AA 3:1 | Medium | (a) Gen prompt rule |
| 5 | Correct feedback auto-dismisses in 1200ms — below 1500ms minimum | Low | (b) Spec addition |
| 6 | Skip note duration inconsistent: 1500ms vs 2000ms across two paths | Low | (b) Spec addition |
| 7 | No live score/stars display during gameplay | Low | (c) CDN constraint |

**Total: 7 issues** — 4 gen prompt rules (Issues 1–4), 2 spec additions (Issues 5–6), 1 CDN constraint (Issue 7)

**Issues resolved from #560:** 1 (CRITICAL CSS stripping fixed)

**All 4 gen prompt rules are already in ROADMAP.md R&D backlog** — added during which-ratio #560 and name-the-sides #557 audits. Status: pending implementation in lib/prompts.js.

---

## Cross-Slot Handoffs

### → R&D (gen prompt rules — pending in ROADMAP.md)
- Issue 1: min-height 44px on all buttons — ROADMAP entry exists, pending
- Issue 2: ARIA live regions on feedback elements — ROADMAP entry exists, pending
- Issue 3: SVG fallback dimensions + label font-size — ROADMAP entry exists, pending
- Issue 4: SVG muted line contrast (#94a3b8 → #64748b) — ROADMAP entry exists, pending

### → Education (spec additions)
- Issue 5: Correct feedback minimum duration (1500ms) — add to which-ratio spec
- Issue 6: Skip note duration consistency — add to which-ratio spec

### → Build queue
No visual bugs requiring re-queue. Build #561 is structurally sound. Gen prompt rules above are the correct fix path for the remaining issues.
