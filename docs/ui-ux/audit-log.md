# UI/UX Audit Log

**Created:** March 23, 2026
**Maintained by:** UI/UX Slot (mandatory active slot — see CLAUDE.md Rule 16)

---

## Purpose

Track visual and interaction quality audits of generated games. Each entry records: what was audited, what issues were found, how they were classified, and what action was taken.

**Issue classification:**
- **Gen prompt rule** → add to CDN_CONSTRAINTS_BLOCK or VISUAL_CONSTRAINTS_BLOCK in lib/prompts.js
- **Spec addition** → add visual requirement to game spec (docs/education/trig-session.md etc.)
- **CDN constraint** → add T1 check in lib/validate-static.js

---

## Active Audit Target

**Current task:** Next batch — addition-mcq-blitz, addition-mcq-lives, addition-mcq (stub ui-ux.md games from inventory)
**Waiting on:** unblocked
**Blocked by:** none

### Batch 2 — Completed 2026-03-23 (static analysis)

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | quadratic-formula-worked-example | #546 | audited (static analysis) 2026-03-23 | done |
| 2 | soh-cah-toa-worked-example | #544 | audited (static analysis) 2026-03-23 | done |
| 3 | right-triangle-area | #543 | audited (static analysis) 2026-03-23 | done — games/ dir created |
| 4 | word-pairs | #529 | audited (static analysis) 2026-03-23 | done |

**Stub inventory (ui-ux.md exists but unpopulated — pending future batches):**
addition-mcq-blitz, addition-mcq-lives, addition-mcq, adjustment-strategy, associations, math-cross-grid, math-mcq-quiz, mcq-addition-blitz, real-world-problem

---

## Completed Audits

| Date | Game | Build | Issues Found | Actions Taken |
|------|------|-------|-------------|---------------|
| 2026-03-23 | name-the-sides | #557 | 10 issues (5a, 3b, 2 low) | 5 gen prompt rules proposed; 3 spec additions documented; rebuild needed |
| 2026-03-23 | which-ratio | #560 | 8 issues (4a, 2b, 2c) | 4 gen prompt rules proposed; 2 spec additions documented; 2 CDN constraints noted |
| 2026-03-23 | which-ratio | #561 | 7 issues (4a, 2b, 1c) | CSS stripping resolved; 4 gen prompt rules confirmed pending in ROADMAP.md; 2 spec additions proposed; 1 CDN constraint unchanged |
| 2026-03-23 | count-and-tap | #551 | 7 issues (4a, 1b, 2 low) | CSS strip CRITICAL confirmed; ARIA-001 extension proposed; 44px gap confirmed 3rd instance; dead-code guard new rule proposed; dot-warning spec addition; all handoffs routed |
| 2026-03-23 | find-triangle-side | #549 | 10 issues (6a, 2b, 2 low) | Results static CRITICAL confirmed 2nd instance; 4 new gen rules added to ROADMAP (slot ID, local assets, SignalCollector args, results fixed); ARIA-001 coverage verified; all handoffs routed |
| 2026-03-23 | quadratic-formula-worked-example | #546 | 8 issues (5a, 0b, 1c, 2 low) | CSS intact; results not fixed (3rd instance); ARIA-001 (4th); slot ID wrong string (3rd); min-height 44px (4th); postMessage path inconsistency flagged; all handoffs routed |
| 2026-03-23 | soh-cah-toa-worked-example | #544 | 7 issues (5a, 1b, 1 low) | CSS intact — cleanest build in batch; results not fixed (4th); ARIA-001 (5th); slot ID options missing key; min-height 44px (5th); hide()/show() string selector bug found; formula accessibility spec addition |
| 2026-03-23 | right-triangle-area | #543 | 9 issues (7a, 1b, 1c) | CSS STRIPPED (4th instance); canvas 500px > 480px new rule; undefined CSS vars for feedback color; ProgressBar hash-prefix slot ID (4th); ARIA-001 (6th); results not fixed (5th); FeedbackManager.sound.play non-standard API; Google Fonts dependency |
| 2026-03-23 | word-pairs | #529 | 8 issues (5a, 1b, 1d, 1 low) | CSS STRIPPED (5th instance); ARIA-001 (7th); results not fixed (6th); data-testid/id mismatch; data-lives hardcoded 0; Sentry SDK v7 vs v10 inconsistency; no learn-phase countdown spec addition |

---

## name-the-sides Audit (2026-03-23)

See [warehouse/templates/name-the-sides/ui-ux.md](../../warehouse/templates/name-the-sides/ui-ux.md)

---

## which-ratio Audit #560 (2026-03-23)

See [games/which-ratio/ui-ux.md](../../games/which-ratio/ui-ux.md) — Build #560 section

## which-ratio Audit #561 (2026-03-23)

See [games/which-ratio/ui-ux.md](../../games/which-ratio/ui-ux.md) — Build #561 section (latest)

**CSS stripping resolved.** 7 remaining issues: 4 gen prompt rules (all already in ROADMAP.md R&D backlog), 2 spec additions, 1 CDN constraint. No re-queue needed.

## count-and-tap Audit #551 (2026-03-23)

See [games/count-and-tap/ui-ux.md](../../games/count-and-tap/ui-ux.md)

**CSS fully stripped — CRITICAL.** Build approved with entire stylesheet stripped to a single comment. FIX-001 + PART-028 T1 check (dc03155) is the intended prevention. 7 total issues: 4 gen prompt rules (CSS strip, ARIA-001 extension, 44px buttons, dead-code guard), 1 spec addition (dot warning), 2 low. All handoffs routed to ROADMAP.md.

## find-triangle-side Audit #549 (2026-03-23)

See [games/find-triangle-side/ui-ux.md](../../games/find-triangle-side/ui-ux.md)

**Results screen static-position — CRITICAL.** CSS present and intact. 10 total issues: 6 gen prompt rules (results fixed, wrong slot ID, no ARIA, 44px buttons, local asset path, SignalCollector args), 2 spec additions (formula formatting, mobile overflow), 2 low. 4 new ROADMAP R&D entries added.

## quadratic-formula-worked-example Audit #546 (2026-03-23)

See [games/quadratic-formula-worked-example/ui-ux.md](../../games/quadratic-formula-worked-example/ui-ux.md)

**CSS intact.** 8 issues: 5 gen prompt rules (results not fixed — 3rd instance, ARIA-001 — 4th instance, ProgressBar slot string wrong — 3rd instance, min-height 44px — 4th instance, postMessage path inconsistency), 1 CDN constraint (layout via ScreenLayout), 2 low. Results screen rule and ARIA-001 now at 3-4 confirmed instances — ship both immediately.

## soh-cah-toa-worked-example Audit #544 (2026-03-23)

See [games/soh-cah-toa-worked-example/ui-ux.md](../../games/soh-cah-toa-worked-example/ui-ux.md)

**CSS intact — cleanest build in batch.** 7 issues: 5 gen prompt rules (results not fixed — 4th instance, ARIA-001 — 5th instance, ProgressBar options missing slotId key, min-height 44px — 5th instance, hide()/show() string selector bug), 1 spec addition (formula accessibility), 1 low. ARIA-001 and results screen rule both at 4-5 confirmed instances — must ship.

## right-triangle-area Audit #543 (2026-03-23)

See [games/right-triangle-area/ui-ux.md](../../games/right-triangle-area/ui-ux.md)

**CSS STRIPPED — CRITICAL (4th confirmed instance).** 9 issues: 7 gen prompt rules (CSS strip — FIX-001 pre-dates PART-028, canvas 500px > 480px new rule, undefined CSS vars for feedback color, ProgressBar hash-prefix slot ID — 4th instance, ARIA-001 — 6th instance, results not fixed — 5th instance, FeedbackManager.sound.play non-standard API), 1 spec addition (Google Fonts dependency), 1 CDN constraint. New rules: canvas max-width and CSS variable consistency.

## word-pairs Audit #529 (2026-03-23)

See [games/word-pairs/ui-ux.md](../../games/word-pairs/ui-ux.md)

**CSS STRIPPED — CRITICAL (5th confirmed instance, 2 style blocks both stripped).** 8 issues: 5 gen prompt rules (CSS strip — pre-PART-028, ARIA-001 — 7th instance, results not fixed — 6th instance, data-testid/id mismatch new rule, Sentry v7 vs v10 standardisation), 1 spec addition (learn-phase countdown), 1 test gap (data-lives hardcoded 0), 1 low. ARIA-001 now at 7 confirmed instances — immediate ship required.

---

## Known Visual Issue Patterns

| Pattern | First seen | Also seen in | Classification | Status |
|---------|-----------|-------------|---------------|--------|
| CSS stylesheet stripped during JS-only surgical fix | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | (a) gen prompt rule + T1 check | FIX-001 shipped 2026-03-23; PART-028 T1 deployed 2026-03-22; 5 confirmed instances |
| Dynamic feedback elements missing aria-live | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529 | (a) gen prompt rule | ARIA-001 shipped 2026-03-23 — **7 confirmed instances — SHIP NOW as hard rule** |
| Option buttons missing explicit 44px touch targets | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544 | (a) gen prompt rule | Pending — **5 confirmed instances — SHIP NOW** |
| SVG muted lines using low-contrast colour (#64748b) | which-ratio #560 | find-triangle-side #549 | (a) gen prompt rule | Pending — 2 confirmed instances |
| Results screen is static-position (not overlay) | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529 | (a) gen prompt rule | Pending — **6 confirmed instances — SHIP NOW** |
| progressBar.update() emits Invalid count value error | name-the-sides #557 | — | (a) gen prompt rule | Proposed |
| CSS-trick triangle (border-based) breaks without CSS | name-the-sides #557 | — | (a) gen prompt rule | Proposed — prefer SVG |
| Two-triangle layout on mobile causes excessive scroll | name-the-sides #557 | — | (b) spec addition | Proposed |
| Wrong ProgressBarComponent slot ID (positional string, hash-prefix, or missing slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543 | (a) gen prompt rule | Pending — 3 confirmed instances (3 variants: wrong string, hash-prefix, missing key) |
| Local asset path in TransitionScreen icons | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| SignalCollector instantiated without constructor args | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Dead-code guard: isActive set false then immediately true | count-and-tap #551 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Canvas element wider than 480px mobile viewport | right-triangle-area #543 | — | (a) gen prompt rule | New — canvas must use max-width: 100% |
| Undefined CSS variable tokens used for feedback color | right-triangle-area #543 | — | (a) gen prompt rule | New — only use --mathai-success, --mathai-error, --mathai-warning |
| FeedbackManager.sound.play() non-standard API path | right-triangle-area #543 | — | (a) gen prompt rule | New — verify PART-011-SOUND covers this; ban if not |
| data-testid does not match element id | word-pairs #529 | — | (a) gen prompt rule | New — testid must match id; no divergence |
| Sentry SDK version inconsistency (v7 vs v10) | word-pairs #529 | — | (a) gen prompt rule | New — standardise to v10.23.0 three-script pattern |
| hide()/show() helpers called with CSS selector strings instead of DOM elements | soh-cah-toa #544 | — | (a) gen prompt rule | New — helpers must receive element objects only |
| data-lives hardcoded to 0 for non-lives games | word-pairs #529 | — | (d) test gap | New — test assertions on data-lives must handle games with totalLives: 0 |

---

## Gen Prompt Rules Added via UI/UX Slot

*(Track which CDN_CONSTRAINTS_BLOCK rules originated from UI/UX audits)*

| Rule | Source audit | Confirmed also in | Date | Status |
|------|-------------|------------------|------|--------|
| Never strip CSS stylesheet | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | 2026-03-23 | FIX-001 shipped (dc03155) + PART-028 T1 check — 5 instances confirmed |
| Explicit 44px touch targets on all buttons | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544 | 2026-03-23 | **Pending — 5 confirmed instances — SHIP NOW** |
| ARIA live regions on dynamic feedback | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529 | 2026-03-23 | ARIA-001 shipped (dc03155) — **7 instances; ship inline panel coverage immediately** |
| SVG diagram contrast + fallback dimensions | which-ratio #560 | find-triangle-side #549 | 2026-03-23 | Pending — 2 confirmed instances |
| Results screen must be position:fixed full-screen overlay | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529 | 2026-03-23 | **Pending — 6 confirmed instances — SHIP NOW** |
| progressBar.update() completed arg must be >= 0 | name-the-sides #557 | — | 2026-03-23 | Proposed — not yet in prompts.js |
| ProgressBarComponent slot ID must be 'mathai-progress-slot' (options object with slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543 | 2026-03-23 | Pending — 3 instances, 3 variants — added to ROADMAP |
| Never use local asset paths in TransitionScreen icons | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Always pass constructor args to SignalCollector | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Never negate isActive guard immediately (dead code) | count-and-tap #551 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Canvas elements must use max-width: 100%; height: auto for responsive layout | right-triangle-area #543 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Only use defined CSS variable tokens for feedback colors | right-triangle-area #543 | — | 2026-03-23 | New — ban --color-orange, --mathai-green; use --mathai-success/error/warning |
| data-testid must match element id exactly | word-pairs #529 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Standardise Sentry SDK to v10.23.0 three-script pattern | word-pairs #529 | — | 2026-03-23 | New — word-pairs uses v7; CDN_CONSTRAINTS_BLOCK must enforce v10 |
| hide()/show() helpers must receive DOM element objects, not CSS selector strings | soh-cah-toa #544 | — | 2026-03-23 | New — runtime TypeError if string passed to classList |
