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

**Current task:** math-mcq-quiz (next in stub inventory)
**Last completed:** math-cross-grid — 2026-03-23 (spec-only; no approved build; 8 findings — 5a, 1b, 0c, 2d)
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
addition-mcq, adjustment-strategy, associations, math-cross-grid, math-mcq-quiz, mcq-addition-blitz

---

## Completed Audits

| Date | Game | Build | Issues Found | Actions Taken |
|------|------|-------|-------------|---------------|
| 2026-03-23 | math-cross-grid | spec-only | 8 issues (5a, 1b, 0c, 2d) | No P0 flow bugs; both end conditions route through endGame(); FeedbackManager.init() called (FAIL — pre-build must fix); results-screen not position:fixed (10th GEN-UX-001 instance); ARIA live region absent (13th ARIA-001 instance); data-phase/syncDOMState absent (4th non-MCQ instance); window.endGame not assigned (4th instance); gameState.gameId absent (4th instance — ship rule now); data-lives not on DOM (3rd instance — test gap); TimerComponent wait unnecessary for no-timer game (low) |
| 2026-03-23 | associations | #513 (approved) | 5 issues (4a, 0b, 0c, 1d) | No P0 flow bugs; CSS intact; ProgressBarComponent no slotId (7th GEN-UX-003 instance); ARIA-001 absent (12th instance — rule shipped); results screen not fixed (9th GEN-UX-001 instance — rule shipped); gameState.gameId absent (3rd instance — escalate to ship); choice-btn no min-height (9th GEN-UX-002 instance — extend rule to non-.game-btn buttons); test gap: no Playwright assertion for choice-btn min-height |
| 2026-03-23 | adjustment-strategy | #385 (approved) | 7 issues (5a, 0b, 0c, 2d) | No P0 flow bugs; all phases reachable; adj-btn 36px (8th GEN-UX-002 gap); ARIA-001 absent (11th instance); results static (8th GEN-UX-001); gameState.gameId absent (2nd); no Enter key on answer-input (2nd — ship now); window.nextRound missing (test gap); reset-btn 30.5px (secondary button gap, overlaps F1) |
| 2026-03-23 | addition-mcq | spec-only | 9 issues (6a, 2b, 1d) | No P0 blockers; ProgressBar slotId missing (6th instance); data-phase/syncDOMState absent (3rd MCQ spec); ARIA-001 (10th instance); window.endGame unassigned; data-lives not on DOM (2nd MCQ spec test gap); gameState.gameId missing; SignalCollector no constructor args (3rd); timer destroy/recreate ambiguity; initSentry absent from spec |
| 2026-03-23 | addition-mcq-lives | spec-only | 6 issues (4a, 2b, 1d; F4 downgraded) | No P0 blockers; data-phase/syncDOMState absent (9th pattern, 2nd MCQ spec); ProgressBar slotId missing (5th); ARIA-001 MCQ (9th); endGame branching implicit; restartGame() unspecified; data-lives not on DOM (test gap) |
| 2026-03-23 | addition-mcq-blitz | spec-only | 8 issues (6a, 2b) | FeedbackManager.init() in spec (URGENT — fix before first build); results not fixed (8th instance); ARIA-001 (8th instance); timer.start() race in setupGame(); recordViewEvent after seal() data loss; window.endGame unassigned; no syncDOMState/data-phase; gameState.gameId undeclared |
| 2026-03-23 | real-world-problem | #564 | 8 issues (6a, 2b/d) | 44px 7th instance; results-fixed 7th instance; ProgressBar slotId 4th instance; SignalCollector no-args 2nd; alert() new rule; Enter-key new rule; 2 education/test handoffs |
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

## real-world-problem Audit #564 (2026-03-23)

See [games/real-world-problem/ui-ux.md](../../games/real-world-problem/ui-ux.md)

**CSS intact. No P0 flow bugs. All three steps reachable. End screen reachable.** 8 issues: 6 gen prompt rules (44px min-height — 7th instance; results not fixed — 7th instance; ProgressBar `-bar-` slotId — 4th instance; SignalCollector no args — 2nd instance; alert() for validation — new; no Enter key on numeric input — new), 2 education/test handoffs (accuracy metric scope, SVG label overflow). 44px and results-screen rules now at 7 confirmed instances each — ship both immediately.

## adjustment-strategy Audit #385 (2026-03-23)

See [games/adjustment-strategy/ui-ux.md](../../games/adjustment-strategy/ui-ux.md)

**CSS intact. No P0 flow bugs. All phases reachable end-to-end.** 7 issues: 5 gen prompt rules (adj-btn/reset-btn secondary button 44px gap — 8th GEN-UX-002 instance; ARIA-001 — 11th instance, already shipped; results static — 8th GEN-UX-001 instance, already shipped; gameState.gameId absent — 2nd instance; no Enter key on answer-input — 2nd instance, ship now), 2 test gaps (window.nextRound missing; secondary button min-height not caught by test assertions). ProgressBar slotId correct, FeedbackManager.init() absent, CSS intact, all data-phase transitions working.

---

## math-cross-grid Audit (2026-03-23)

See [games/math-cross-grid/ui-ux.md](../../games/math-cross-grid/ui-ux.md)

**Spec-only audit — no approved build exists (0 builds in DB).** 8 actionable issues (5a, 1b, 0c, 2d). No P0 flow bugs: both end conditions route through `endGame()` which sends `game_complete`; drag-and-drop interaction well-specified; touch targets adequate (64px tiles, 58px cells). Key issues: (1) F1 — FeedbackManager.init() explicitly called in init sequence (banned API — must be removed before first build; T1 should catch); (2) F2 — results-screen not position:fixed (10th GEN-UX-001 instance — rule shipped 2026-03-23); (3) F3 — no aria-live region for drag-and-drop feedback (13th ARIA-001 instance — rule shipped); (4) F4 — no data-phase / syncDOMState at phase transitions (4th non-MCQ instance); (5) F5 — window.endGame not assigned (4th instance); (6) F6 — gameState.gameId absent from initial declaration (4th instance — ship rule now); (7) F7 — data-lives not on DOM for lives=2 game (3rd test gap instance); (8) F8 — TimerComponent wait in waitForPackages for no-timer game (low). ProgressBar slotId correct. SignalCollector constructor args correct.

---

## associations Audit #513 (2026-03-23)

See [games/associations/ui-ux.md](../../games/associations/ui-ux.md)

**CSS intact. No P0 flow bugs. All phases reachable.** 5 issues: 4 gen prompt rules (ProgressBarComponent no slotId — 7th instance; ARIA-001 no text feedback element — 12th instance; gameState.gameId absent — 3rd live-build instance, ship rule now; results screen not position:fixed — 9th instance), 1 test gap (no Playwright assertion for choice-btn computed min-height). All rules (GEN-UX-001/002/003, ARIA-001) already shipped — this build predates them. gameState.gameId rule at 3 instances — escalate to ship immediately.

---

## addition-mcq Audit (2026-03-23)

See [games/addition-mcq/ui-ux.md](../../games/addition-mcq/ui-ux.md)

**Spec-only audit — no build exists.** 9 actionable issues (6a, 2b, 1d). No P0 blockers: no FeedbackManager.init(), no alert(), endGame() called on both win and game-over paths, restartGame() defined, results screen uses PART-019. Key issues: (1) F1 — ProgressBar slotId missing (6th confirmed instance — GEN-UX-003 shipped but spec still lacks it; add before first build); (2) F2 — no data-phase / syncDOMState (3rd confirmed MCQ spec instance); (3) F3 — no ARIA live region on option feedback (10th instance — ARIA-001 shipped); (4) F4 — window.endGame unassigned; (5) F5 — data-lives not on DOM (2nd MCQ spec test gap); (6) F6 — gameState.gameId absent; (7) F7 — SignalCollector no constructor args (3rd instance — GEN-UX-005 shipped); (8) F8 — timer destroy/recreate ambiguity on restartGame(); (9) F9 — initSentry() absent from spec. Pre-build checklist added to ui-ux.md.

## addition-mcq-lives Audit (2026-03-23)

See [games/addition-mcq-lives/ui-ux.md](../../games/addition-mcq-lives/ui-ux.md)

**Spec-only audit — no build exists.** 6 actionable issues (4a, 2b, 1d; F4 initialization order downgraded). No P0 blockers: no FeedbackManager.init(), no results-screen static position violation, window.endGame assigned per spec Section 8, CSS well-formed. Key issues: (1) F1 — no data-phase / syncDOMState at any transition (2nd confirmed MCQ spec instance; already in ROADMAP line 237); (2) F2 — ProgressBar slotId missing (5th confirmed instance — escalate to ship now); (3) F3 — no ARIA live region on MCQ feedback (9th instance — ARIA-001 shipped, T1 will catch it on first build); (4) F5 — endGame dual-path not explicit (spec addition needed before queuing); (5) F6 — restartGame() unspecified for timer game (spec addition needed); (6) F7 — data-lives not on DOM element (test gap). Pre-build checklist added to ui-ux.md. ProgressBar slotId pattern at 5 confirmed instances — ship rule immediately.

---

## Known Visual Issue Patterns

| Pattern | First seen | Also seen in | Classification | Status |
|---------|-----------|-------------|---------------|--------|
| CSS stylesheet stripped during JS-only surgical fix | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | (a) gen prompt rule + T1 check | FIX-001 shipped 2026-03-23; PART-028 T1 deployed 2026-03-22; 5 confirmed instances |
| Dynamic feedback elements missing aria-live | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513 | (a) gen prompt rule | **ARIA-001 expanded SHIPPED 2026-03-23 (c826ec1)** — rule covers ALL dynamic feedback elements (not just #feedback): #feedback-panel, #faded-feedback, #practice-feedback, #feedback-area, #answer-feedback, #result-feedback, #hint-text; requires role="status"; T1 W5 regex broadened; 4 new tests; **12 confirmed instances** |
| Option buttons missing explicit 44px touch targets | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, real-world-problem #564, associations #513 | (a) gen prompt rule | **SHIPPED — GEN-UX-002 / GEN-TOUCH-TARGET (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 121 + rule 32**; GEN-UX-002 targets .game-btn — NOTE: associations choice-btn (.choice-btn) is not covered by this class selector — rule needs extension; **9 confirmed instances** |
| SVG muted lines using low-contrast colour (#64748b) | which-ratio #560 | find-triangle-side #549 | (a) gen prompt rule | Pending — 2 confirmed instances |
| Results screen is static-position (not overlay) | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, associations #513 | (a) gen prompt rule | **SHIPPED — GEN-UX-001 / GEN-MOBILE-RESULTS (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 120 + rule 31**; **9 confirmed instances** |
| progressBar.update() emits Invalid count value error | name-the-sides #557 | — | (a) gen prompt rule | Proposed |
| CSS-trick triangle (border-based) breaks without CSS | name-the-sides #557 | — | (a) gen prompt rule | Proposed — prefer SVG |
| Two-triangle layout on mobile causes excessive scroll | name-the-sides #557 | — | (b) spec addition | Proposed |
| Wrong ProgressBarComponent slot ID (positional string, hash-prefix, or missing slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513 | (a) gen prompt rule | SHIPPED — GEN-UX-003 (25bdad0 2026-03-23) — **7 confirmed instances** |
| Local asset path in TransitionScreen icons | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| SignalCollector instantiated without constructor args | find-triangle-side #549 | real-world-problem #564, addition-mcq spec | (a) gen prompt rule | SHIPPED — GEN-UX-005 (25bdad0 2026-03-23) — 3 confirmed instances |
| Dead-code guard: isActive set false then immediately true | count-and-tap #551 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Canvas element wider than 480px mobile viewport | right-triangle-area #543 | — | (a) gen prompt rule | New — canvas must use max-width: 100% |
| Undefined CSS variable tokens used for feedback color | right-triangle-area #543 | — | (a) gen prompt rule | New — only use --mathai-success, --mathai-error, --mathai-warning |
| FeedbackManager.sound.play() non-standard API path | right-triangle-area #543 | — | (a) gen prompt rule | New — verify PART-011-SOUND covers this; ban if not |
| data-testid does not match element id | word-pairs #529 | — | (a) gen prompt rule | New — testid must match id; no divergence |
| Sentry SDK version inconsistency (v7 vs v10) | word-pairs #529 | — | (a) gen prompt rule | New — standardise to v10.23.0 three-script pattern |
| hide()/show() helpers called with CSS selector strings instead of DOM elements | soh-cah-toa #544 | — | (a) gen prompt rule | New — helpers must receive element objects only |
| alert() used for inline input validation | real-world-problem #564 | — | (a) gen prompt rule | SHIPPED — GEN-UX-004 (25bdad0 2026-03-23) — 1 confirmed instance (new) |
| Typed numeric input has no Enter-key submission handler | real-world-problem #564 | — | (a) gen prompt rule | New — input fields must bind keydown Enter → submit handler |
| data-lives hardcoded to 0 for non-lives games | word-pairs #529 | — | (d) test gap | New — test assertions on data-lives must handle games with totalLives: 0 |
| Custom widget buttons (adj-btn, reset-btn) bypass min-height: 44px rule | adjustment-strategy #385 | — | (a) gen prompt rule | New — GEN-UX-002 only covers .game-btn; secondary/custom buttons need min-height: 44px too; adj-btn=36px, reset-btn=30.5px |
| gameState.gameId absent from gameState object | adjustment-strategy #385 | addition-mcq spec, associations #513, math-cross-grid spec | (a) gen prompt rule | **4th confirmed instance (math-cross-grid spec)** — mandatory gameId field not in initial gameState declaration; set only conditionally via postMessage; ship rule now |
| Typed numeric input has no Enter key submission | adjustment-strategy #385 | real-world-problem #564 | (a) gen prompt rule | 2nd confirmed instance — ship now per ROADMAP line 430 |
| window.nextRound not exposed; harness warns MISSING | adjustment-strategy #385 | — | (d) test gap | Game uses loadRound() internally; window.nextRound alias never assigned; harness fallback may cover via window.loadRound |
| Lives games missing data-lives attribute on DOM element | addition-mcq-lives spec | addition-mcq spec, math-cross-grid spec | (d) test gap | 3 confirmed instances — lives games must sync data-lives via syncDOMState(); getLives() harness helper needs a DOM attribute to read |
| No syncDOMState() / data-phase state machine in MCQ spec | addition-mcq-blitz spec | addition-mcq-lives spec, addition-mcq spec | (a) gen prompt rule | 3 confirmed MCQ spec instances — already in ROADMAP (line 237); 3rd instance confirmed 2026-03-23 |
| No data-phase / syncDOMState in drag-and-drop spec | math-cross-grid spec | — | (a) gen prompt rule | 1st confirmed non-MCQ drag-and-drop instance — game has two phases (gameplay → results) with no data-phase or syncDOMState; pattern extends beyond MCQ games |
| endGame() dual-path not specified: game-over vs victory TransitionScreen calls differ | addition-mcq-lives spec | — | (b) spec addition | New — lives games need explicit if/else branching in endGame() for two different TransitionScreen templates; ROADMAP entry added |
| restartGame() unspecified for timer games — destroy+recreate required | addition-mcq-lives spec | — | (b) spec addition | New — timer games must destroy and recreate TimerComponent in restartGame() to clear stale onEnd callbacks; ROADMAP entry added |
| waitForPackages() awaits packages not used by the game | math-cross-grid spec | — | (a) gen prompt rule | Low — waitForPackages polls for TimerComponent but spec says Timer: None; unnecessary CDN wait that could cause timeout if component is unavailable |
| window.endGame not assigned to window | math-cross-grid spec | — | (a) gen prompt rule | 4th confirmed instance — endGame() defined as local function never exposed on window; harness calls window.endGame() to force end-game in tests |

---

## Gen Prompt Rules Added via UI/UX Slot

*(Track which CDN_CONSTRAINTS_BLOCK rules originated from UI/UX audits)*

| Rule | Source audit | Confirmed also in | Date | Status |
|------|-------------|------------------|------|--------|
| Never strip CSS stylesheet | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | 2026-03-23 | FIX-001 shipped (dc03155) + PART-028 T1 check — 5 instances confirmed |
| Explicit 44px touch targets on all buttons | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, real-world-problem #564 | 2026-03-23 | **SHIPPED — GEN-UX-002 / GEN-TOUCH-TARGET (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 121 + rule 32** |
| ARIA live regions on dynamic feedback | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513 | 2026-03-23 | **ARIA-001 expanded SHIPPED (c826ec1 2026-03-23)** — **12 confirmed instances**; rule now covers ALL dynamic feedback variants + role="status"; T1 W5 regex broadened; 4 new tests; temp-file race in test helper fixed |
| SVG diagram contrast + fallback dimensions | which-ratio #560 | find-triangle-side #549 | 2026-03-23 | Pending — 2 confirmed instances |
| Results screen must be position:fixed full-screen overlay | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564 | 2026-03-23 | **SHIPPED — GEN-UX-001 / GEN-MOBILE-RESULTS (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 120 + rule 31** |
| progressBar.update() completed arg must be >= 0 | name-the-sides #557 | — | 2026-03-23 | Proposed — not yet in prompts.js |
| ProgressBarComponent slot ID must be 'mathai-progress-slot' (options object with slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543, real-world-problem #564, addition-mcq-lives spec | 2026-03-23 | SHIPPED — GEN-UX-003 (25bdad0 2026-03-23) — 5 confirmed instances |
| Never use local asset paths in TransitionScreen icons | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Always pass constructor args to SignalCollector | find-triangle-side #549 | real-world-problem #564 | 2026-03-23 | SHIPPED — GEN-UX-005 (25bdad0 2026-03-23) — 2 confirmed instances |
| Never negate isActive guard immediately (dead code) | count-and-tap #551 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Canvas elements must use max-width: 100%; height: auto for responsive layout | right-triangle-area #543 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Only use defined CSS variable tokens for feedback colors | right-triangle-area #543 | — | 2026-03-23 | New — ban --color-orange, --mathai-green; use --mathai-success/error/warning |
| data-testid must match element id exactly | word-pairs #529 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Standardise Sentry SDK to v10.23.0 three-script pattern | word-pairs #529 | — | 2026-03-23 | New — word-pairs uses v7; CDN_CONSTRAINTS_BLOCK must enforce v10 |
| hide()/show() helpers must receive DOM element objects, not CSS selector strings | soh-cah-toa #544 | — | 2026-03-23 | New — runtime TypeError if string passed to classList |
| Never use alert()/confirm() in game code; use inline aria-live feedback div | real-world-problem #564 | — | 2026-03-23 | SHIPPED — GEN-UX-004 (25bdad0 2026-03-23) — 1 confirmed instance (new) |
| Typed numeric input fields must support Enter key as submit equivalent | real-world-problem #564 | adjustment-strategy #385 | 2026-03-23 | **2nd confirmed instance — SHIP NOW** — keyboard/mobile UX gap; answer-input in adjustment-strategy also has no Enter listener |
| gameState must declare gameId field | adjustment-strategy #385 | addition-mcq spec | 2026-03-23 | 2nd confirmed instance — `window.gameState.gameId` undefined in both; add to CDN_CONSTRAINTS_BLOCK and spec Section 3 |
| Secondary/custom widget buttons (adj-btn, reset-btn) exempt from min-height: 44px | adjustment-strategy #385 | — | 2026-03-23 | New — GEN-UX-002 only covers .game-btn; adj-btn=36px, reset-btn=30.5px; extend rule to all interactive buttons |
