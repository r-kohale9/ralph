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

**Current task:** Batch audit of 4 approved games — quadratic-formula-worked-example first (build #546, stub ui-ux.md)
**Waiting on:** diagnostic.js run for each game (requires local sub-agent with browser)
**Blocked by:** none

### Next Audit Batch (queued 2026-03-23)

Priority order — most recently approved first, without a **real** audit (9-line stubs counted as unaudited):

| Priority | Game | Build ID | GCP URL | ui-ux.md state | Status |
|----------|------|----------|---------|----------------|--------|
| 1 | quadratic-formula-worked-example | #546 | https://storage.googleapis.com/mathai-temp-assets/games/quadratic-formula-worked-example/builds/546/index.html | stub (9 lines) | queued |
| 2 | soh-cah-toa-worked-example | #544 | https://storage.googleapis.com/mathai-temp-assets/games/soh-cah-toa-worked-example/builds/544/index.html | stub (9 lines) | queued |
| 3 | right-triangle-area | #543 | https://storage.googleapis.com/mathai-temp-assets/games/right-triangle-area/builds/543/index.html | missing — no games/ folder | queued |
| 4 | word-pairs | #529 | https://storage.googleapis.com/mathai-temp-assets/games/word-pairs/builds/529/index.html | missing — games/ folder exists | queued |

**Notes:**
- `quadratic-formula-worked-example` and `soh-cah-toa-worked-example`: ui-ux.md exists as a 9-line stub ("Audit pending") — overwrite with real audit content
- `right-triangle-area`: no `games/` folder at all — create `games/right-triangle-area/` directory and `ui-ux.md`
- `word-pairs`: `games/word-pairs/` folder exists — create `ui-ux.md` in it
- None of the 4 have warehouse template folders; `games/<game>/ui-ux.md` is the primary file for each
- Several other approved games also have stub ui-ux.md (addition-mcq, math-cross-grid, etc.) — see Stub Inventory below

**Stub inventory (ui-ux.md exists but unpopulated — 9 lines):**
addition-mcq-blitz, addition-mcq-lives, addition-mcq, adjustment-strategy, associations, math-cross-grid, math-mcq-quiz, mcq-addition-blitz, real-world-problem — all pending future batches

**Previously active target (superseded):** soh-cah-toa-worked-example — was listed as next but now included in this batch as priority #2

---

## Completed Audits

| Date | Game | Build | Issues Found | Actions Taken |
|------|------|-------|-------------|---------------|
| 2026-03-23 | name-the-sides | #557 | 10 issues (5a, 3b, 2 low) | 5 gen prompt rules proposed; 3 spec additions documented; rebuild needed |
| 2026-03-23 | which-ratio | #560 | 8 issues (4a, 2b, 2c) | 4 gen prompt rules proposed; 2 spec additions documented; 2 CDN constraints noted |
| 2026-03-23 | which-ratio | #561 | 7 issues (4a, 2b, 1c) | CSS stripping resolved; 4 gen prompt rules confirmed pending in ROADMAP.md; 2 spec additions proposed; 1 CDN constraint unchanged |
| 2026-03-23 | count-and-tap | #551 | 7 issues (4a, 1b, 2 low) | CSS strip CRITICAL confirmed; ARIA-001 extension proposed; 44px gap confirmed 3rd instance; dead-code guard new rule proposed; dot-warning spec addition; all handoffs routed |
| 2026-03-23 | find-triangle-side | #549 | 10 issues (6a, 2b, 2 low) | Results static CRITICAL confirmed 2nd instance; 4 new gen rules added to ROADMAP (slot ID, local assets, SignalCollector args, results fixed); ARIA-001 coverage verified; all handoffs routed |

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

---

## Known Visual Issue Patterns

| Pattern | First seen | Also seen in | Classification | Status |
|---------|-----------|-------------|---------------|--------|
| CSS stylesheet stripped during JS-only surgical fix | which-ratio #560 | name-the-sides #557, count-and-tap #551 | (a) gen prompt rule + T1 check | FIX-001 shipped 2026-03-23 |
| Dynamic feedback elements missing aria-live | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549 | (a) gen prompt rule | ARIA-001 shipped 2026-03-23 — verify coverage extends to inline panels |
| Option buttons missing explicit 44px touch targets | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549 | (a) gen prompt rule | Pending — 4 confirmed instances |
| SVG muted lines using low-contrast colour (#64748b) | which-ratio #560 | find-triangle-side #549 | (a) gen prompt rule | Pending — 2 confirmed instances |
| Results screen is static-position (not overlay) | name-the-sides #557 | find-triangle-side #549 | (a) gen prompt rule | Pending — 2 confirmed instances |
| progressBar.update() emits Invalid count value error | name-the-sides #557 | — | (a) gen prompt rule | Proposed |
| CSS-trick triangle (border-based) breaks without CSS | name-the-sides #557 | — | (a) gen prompt rule | Proposed — prefer SVG |
| Two-triangle layout on mobile causes excessive scroll | name-the-sides #557 | — | (b) spec addition | Proposed |
| Wrong ProgressBarComponent slot ID | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Local asset path in TransitionScreen icons | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| SignalCollector instantiated without constructor args | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Dead-code guard: isActive set false then immediately true | count-and-tap #551 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |

---

## Gen Prompt Rules Added via UI/UX Slot

*(Track which CDN_CONSTRAINTS_BLOCK rules originated from UI/UX audits)*

| Rule | Source audit | Confirmed also in | Date | Status |
|------|-------------|------------------|------|--------|
| Never strip CSS stylesheet | which-ratio #560 | name-the-sides #557, count-and-tap #551 | 2026-03-23 | FIX-001 shipped (dc03155) + PART-028 T1 check |
| Explicit 44px touch targets on all buttons | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549 | 2026-03-23 | Pending — 4 confirmed instances |
| ARIA live regions on dynamic feedback | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549 | 2026-03-23 | ARIA-001 shipped (dc03155) — verify inline panel coverage |
| SVG diagram contrast + fallback dimensions | which-ratio #560 | find-triangle-side #549 | 2026-03-23 | Pending — 2 confirmed instances |
| Results screen must be position:fixed full-screen overlay | name-the-sides #557 | find-triangle-side #549 | 2026-03-23 | Pending — 2 confirmed instances, prioritise |
| progressBar.update() completed arg must be >= 0 | name-the-sides #557 | — | 2026-03-23 | Proposed — not yet in prompts.js |
| ProgressBarComponent slot ID must be 'mathai-progress-slot' | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Never use local asset paths in TransitionScreen icons | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Always pass constructor args to SignalCollector | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Never negate isActive guard immediately (dead code) | count-and-tap #551 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
