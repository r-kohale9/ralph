# name-the-sides — UI/UX Audit

**Audited:** 2026-03-23
**Build:** #557
**Auditor:** UI/UX slot
**Method:** Live browser audit via Playwright (headless Chromium). Screenshots captured at 1024×768 (desktop) and 480×800 (mobile). All 9 rounds walked through via correct submissions. CSS inspection run post-load.

---

## Summary

| Severity | Count | Open |
|----------|-------|------|
| Critical | 1 | 1 |
| High | 4 | 4 |
| Medium | 3 | 3 |
| Low | 2 | 2 |

---

## Issues

### CRITICAL

**UI-NS-001 — CSS stylesheet stripped — game renders with zero custom styling**

- Observed: The `<style>` block contains only a placeholder comment: `/* [CSS stripped — 5235 chars, not relevant to JS fix] */`. No actual CSS rules exist anywhere in the file (no `<link>` stylesheet, no inline styles). Computed styles confirm: `.label-btn` gets `padding: 1px 6px`, `border-radius: 0px`, `min-height: 0px`, `backgroundColor: rgb(239,239,239)` — all browser-default button styles, no custom styling. The `#diagram-1` container renders at height 36px (content height only — no custom sizing). The feedback panel has no background colour, border, or padding. The hint bar has no visual treatment — raw text.
- Impact: The entire game is visually broken. The CSS would have defined: the triangle shape via CSS borders/transforms (the `.triangle-shape` div renders empty — its visual comes entirely from CSS), button styles, layout structure, feedback state colours (correct/incorrect), hint bar styling, and spacing. Learners see an unstyled form with no triangle diagram, no visual hierarchy, and no colour feedback.
- Triangle shape is invisible: `#diagram-1` is 440×36px but contains a `.triangle-shape` div that is 0×0px computed — it relies entirely on CSS `border-trick` triangle rendering which requires the stripped CSS.
- Classification: (A) Gen prompt rule + CDN constraint (T1 check)
- Proposed fix: Same rule as which-ratio Issue 1 — LLM must never strip the `<style>` block. Also a validate-static.js T1 check: flag any `<style>` block whose text content after stripping comments is fewer than 20 chars of actual CSS rules.

---

### HIGH

**UI-NS-002 — Triangle diagram is invisible — CSS-drawn triangle requires stripped CSS**

- Observed: `renderTriangle()` creates a `.triangle-shape` div and adds vertex/side label spans and markers. The triangle shape is produced entirely by CSS `border` tricks (using transparent borders on a zero-width/zero-height div). Without CSS, `.triangle-shape` has zero computed dimensions. On mobile, `#diagram-1` measures 440×36px (just the text of vertex labels stacked), and the triangle shape itself is invisible. The angle arc and right-angle marker divs are also invisible without CSS `border-radius` and `border` rules.
- Impact: The core educational stimulus — the triangle diagram with a marked reference angle — is completely absent. Learners cannot identify which side is opposite/adjacent without seeing the triangle. This is a game-breaking gap on top of the CSS issue.
- Classification: (A) Gen prompt rule (same as UI-NS-001 — restoring CSS fixes this)
- Note: Also a fundamental fragility — CSS-trick triangles break completely when CSS is unavailable. A more resilient approach would use inline SVG (which can carry its own `<style>` or attributes).

**UI-NS-003 — Label buttons have no touch target sizing (21px height on mobile)**

- Observed: `.label-btn` computed styles on mobile: `height: 21px`, `min-height: 0px`, `padding: 1px 6px`. The "Check Answers" button is also 21px. The "Try Again" feedback button is 21px. None meet the 44px minimum touch target.
- Impact: On mobile (480px wide), all interactive buttons are at ~21px — half the iOS/Android HIG minimum. Consistent with the which-ratio finding (UI-WR-002). This is a session-wide failure.
- Classification: (A) Gen prompt rule — explicit `min-height: 44px` on all interactive elements.

**UI-NS-004 — Results screen renders below game content (z-index: auto, position: static)**

- Observed: `#results-screen` has `position: static; z-index: auto`. Screenshot `09-mobile-label-panel-scrolled.png` shows the results screen "Congratulations!" is visibly rendering below the active game area during gameplay (it's position:static in the document flow). The results screen never visually replaces the game content — it just appears below it. When the game ends, `#gameContent` is hidden but the page layout does not collapse cleanly. At 480px viewport, the "Play Again" button is at y=1037px — below two full screen-heights.
- Impact: The results screen is not a modal overlay — it is stacked below in the DOM. On mobile, learners must scroll down to reach it. The star celebration and score are off-screen.
- Classification: (A) Gen prompt rule — results screen must be `position: fixed; top: 0; left: 0; z-index: 9999; width: 100%; height: 100%` or managed via the CDN TransitionScreenComponent.

**UI-NS-005 — No ARIA live regions on any feedback element**

- Observed: `#feedback-panel` has no `aria-live` attribute (confirmed via `feedbackAriaLive: null`). `#hint-bar` has no `aria-label` (confirmed via `hintAriaLabel: null`). `#btn-check` has no `aria-disabled` attribute — it uses the HTML `disabled` property, which is correct, but the feedback panel is the critical gap.
- Impact: Screen readers will not announce correct/incorrect feedback or the explanatory text on first wrong answer. The hint bar text also changes per round with no announcement. Identical to which-ratio Issue 3.
- Classification: (A) Gen prompt rule — same rule as which-ratio finding.

---

### MEDIUM

**UI-NS-006 — CSS variables not set — theming system not connected**

- Observed: CSS custom properties `--color-primary`, `--color-background`, `--color-correct`, `--color-incorrect` are all `not set` per computed style inspection. These are the CDN component theming variables. Without them, ProgressBarComponent, TransitionScreenComponent, and any other CDN component that uses them will fall back to internal defaults (which may not match the game's intended palette).
- Impact: Session-level visual consistency is compromised. If each game has different button colours because the CDN components fall back to different defaults, the trig session will feel fragmented.
- Classification: (A) Gen prompt rule — the init block should set CSS variables using `document.documentElement.style.setProperty()` to connect the game palette to the CDN theming system.

**UI-NS-007 — Progress bar fails to update correctly — "Invalid count value: -9" error every round**

- Observed: `PAGEERROR: Invalid count value: -9` fires on every round load. This originates from `progressBar.update(gameState.currentRound - 1, gameState.totalRounds)` in `loadRound()`. When `currentRound = 1`, `progressBar.update(0, 9)` — that is correct. But the error fires repeatedly. Investigation: `ProgressBarComponent` emits this error when the `completed` argument is `currentRound - 1` and some internal validation rejects the value at certain states. The progress bar visually still updates (the bar fills correctly in screenshots), but the error is a reliability signal.
- Impact: Non-fatal in current build — progress bar renders correctly. However, the repeated page error pollutes the console and may mask actual errors. In stricter Playwright test runs this may cause false failures.
- Classification: (A) Gen prompt rule — `progressBar.update()` should be called with `gameState.currentRound` (not `currentRound - 1`) to match the ProgressBarComponent API expectation. Alternatively, inspect the ProgressBarComponent API docs.

**UI-NS-008 — Two-triangle layout on mobile requires excessive scrolling (round 7-9)**

- Observed: Round 7 screenshot shows both triangle section headings plus 18 label buttons stacked vertically (6 rows × 3 buttons). On 480×800 mobile, the full interactive area requires ~600px of scrollable content. The labeling panel for Triangle 1 and Triangle 2 is linearised — no side-by-side layout. The hint bar and diagram zone are above the fold; the Triangle 2 section is off-screen requiring scroll.
- Impact: For the most cognitively demanding rounds (7-9), the learner must scroll while holding the triangle configurations in working memory. This adds a navigation burden on top of the hardest content. Side-by-side layout would be preferable.
- Classification: (B) Spec addition — specify that two-triangle rounds should use a side-by-side or accordion layout on mobile to reduce scroll distance.

---

### LOW

**UI-NS-009 — Correct feedback displays previous round content during transition**

- Observed: In screenshots `05-desktop-correct-feedback.png` and `06-desktop-round2.png`, after a correct answer the label panel (AB/BC/AC buttons) remains visible while the "Correct! All sides labeled perfectly." text appears below. The panel is not cleared until `nextRound()` fires. During the 1200ms auto-advance delay, the learner sees the old round's label buttons (still with selections) alongside the feedback text. This creates a briefly cluttered state.
- Impact: Minor — 1200ms transition is fast enough that most learners won't act on the stale buttons. But the visual is slightly confusing: selected buttons remain highlighted after "Correct" is shown.
- Classification: (B) Spec addition — on correct answer, immediately disable/visually reset label buttons before showing feedback, rather than waiting for round transition.

**UI-NS-010 — Results screen shows "Congratulations!" even for 0-star outcomes**

- Observed: `showResults()` always uses `<h2>Congratulations!</h2>` regardless of star count. The star logic gives 0 stars for 5+ skipped rounds. A learner who skipped 5+ rounds would see "Congratulations!" with 0 stars — semantically inconsistent.
- Impact: Minor pedagogical inconsistency — the result heading should reflect performance.
- Classification: (B) Spec addition — vary results heading: "Congratulations!" for 3 stars, "Well Done!" for 1-2 stars, "Keep Practicing!" for 0 stars.

---

## Comparison with which-ratio

which-ratio was audited the same day (Build #560) and had 8 issues. Comparing the two:

| Issue type | which-ratio | name-the-sides | Pattern |
|------------|-------------|----------------|---------|
| CSS stripped | YES (critical) | YES (critical) | Session-wide — same surgical fix applied to both |
| No touch targets (44px) | YES | YES | Session-wide — gen never sets min-height |
| No ARIA live regions | YES | YES | Session-wide — gen never adds aria-live |
| Results screen layout | NO | YES (new) | name-the-sides specific — no overlay |
| CSS variables unset | Not checked | YES | Session-wide risk |
| Progress bar error | Not checked | YES | name-the-sides specific |
| Diagram fragility (CSS triangle vs SVG) | SVG (more resilient) | CSS trick (breaks completely without CSS) | name-the-sides is more fragile |

**Key session-level drift observations:**
1. Both games have identical CSS-stripping — confirming this is a pipeline-level problem, not a game-level one.
2. name-the-sides uses CSS-trick triangles instead of SVG — far more fragile. The triangle is completely invisible without CSS. which-ratio used inline SVG which at least rendered a shape.
3. The results screen overlay/positioning issue is new to name-the-sides and not observed in which-ratio. This suggests variation in how different games handle the end-state.
4. Both games miss the same accessibility pattern (no aria-live) — this is a systemic gen prompt gap.

---

## Gen Prompt Rule Proposals

For each (A) issue, exact rule text for `CDN_CONSTRAINTS_BLOCK` or visual gen rules in `lib/prompts.js`:

**Rule A1 — Never strip the CSS stylesheet** (same as which-ratio proposal)
```
NEVER remove, replace, or summarise the <style> block during a targeted fix. If the fix is JS-only, preserve the entire CSS verbatim. A <style> block containing only comments and no actual CSS rules is always a build error — never generate or accept one.
```

**Rule A2 — Explicit touch target sizing on all interactive elements**
```
ALL interactive elements (buttons, clickable divs, label-btn, option-btn, feedback-btn, check button) MUST have min-height: 44px; min-width: 44px; padding: 12px 16px in the CSS. Never rely on browser-default button sizing. This applies to every button created statically or dynamically.
```

**Rule A3 — ARIA live regions on all dynamic feedback**
```
Every element that shows/hides dynamically in response to user interaction MUST have aria-live="polite" or role="alert". This includes: feedback panels (correct/incorrect), skip messages, hint bar content changes, and any div that receives innerHTML updates after user action. Add aria-live="polite" to the element in the HTML template or on creation.
```

**Rule A4 — Results screen must be a full-screen overlay**
```
The results screen MUST use position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: var(--color-background, #fff); overflow-y: auto. It must never be a static-position element that stacks below game content. On game end, #gameContent is hidden and results-screen covers the full viewport.
```

**Rule A5 — progressBar.update() argument order**
```
When calling progressBar.update(), the first argument is the number of rounds COMPLETED (i.e., gameState.currentRound after incrementing, or gameState.currentRound - 1 before the round starts). Verify against ProgressBarComponent API: update(completed, total). If the API emits "Invalid count value" errors, check that completed >= 0 and completed <= total.
```

---

## Open Actions

| Action | Priority | Owner |
|--------|----------|-------|
| Add Rule A1 (never strip CSS) to prompts.js CDN_CONSTRAINTS_BLOCK | Critical | R&D |
| Add T1 check to validate-static.js: empty/comment-only `<style>` block | Critical | R&D |
| Add Rule A2 (44px touch targets) to prompts.js | High | R&D |
| Add Rule A3 (ARIA live regions) to prompts.js | High | R&D |
| Add Rule A4 (results screen overlay) to prompts.js | High | R&D |
| Add Rule A5 (progressBar.update args) to prompts.js | Medium | R&D |
| Add CSS variables init block to spec (theming) | Medium | Education |
| Add two-triangle mobile layout requirement to spec | Medium | Education |
| Add results heading variation to spec | Low | Education |
| Add correct-feedback panel clear-before-show to spec | Low | Education |
| Rebuild name-the-sides with restored CSS (re-queue build) | Critical | Pipeline |
