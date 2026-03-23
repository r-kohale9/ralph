# real-world-problem — UI/UX Audit

**Audited:** 2026-03-23
**Build:** #564
**Auditor:** UI/UX slot
**Method:** Full browser playthrough via Playwright (headless Chromium, 480×800 mobile viewport). All 4 rounds played end-to-end. Wrong answer tested on step 3 (life deduction verified). Enter key tested. Results screen and Play Again tested. CSS and DOM state inspected via `evaluate()`.

---

## Summary

**12 total issues: 7 gen prompt rules (a), 2 spec/education additions (b), 1 CDN constraint (c), 2 test gaps (d).**

No P0 flow bugs that block game completion — all 4 rounds reachable, results screen reachable, Play Again restarts correctly. However results screen is `position:static` (UI-RWP-002, HIGH, confirmed P0 class for post-rule builds). Two new HIGH findings added from browser playthrough: data-phase/data-lives on wrong element, and Play Again button below 44px.

| Severity | Count | Open |
|----------|-------|------|
| Critical | 0 | 0 |
| High | 6 | 2 (N1 new, N2 new — test gaps) |
| Medium | 4 | 2 open, 2 shipped |
| Low | 2 | 2 open |

**Playthrough result:** CSS intact. All 4 rounds reachable. All 3 steps per round functional. Wrong answer correctly deducts a life. Enter key confirmed unbound. Results screen confirmed `position:static`. restartGame() resets lives/score/round/wrongOnStep3 correctly. `data-phase`/`data-lives`/`data-round` set on `#app` (not `body`) — tests that target `body` will fail.

---

## P0 Pattern Check (per audit mandate)

| P0 Pattern | Result |
|-----------|--------|
| Results screen position:fixed | FAIL — `position:static`, `rectTop:80`, `rectLeft:36`, `width:344px`, `coversViewport:false` |
| restartGame() not resetting lives/round | PASS — lives:3, currentRound:0, score:0, wrongOnStep3:0 all reset |
| SVG icons in TransitionScreen (P0-002) | PASS — CDN renders SVG stars via `show({icons:[...]})` correctly, no raw strings |
| String-mode transitionScreen.show() (P0-001) | PASS — `show()` called with object `{title, message, icons}` |
| totalLives:0 in ProgressBar (P0-003) | PASS — `totalLives: gameState.totalLives` (3) passed; but wrong `slotId` still causes fallback |
| Local asset 404s | PASS — only Sentry 404 (known warehouse gap), no local asset paths |
| Low-contrast SVG stroke/text | PASS — SVG text inherits fill (dark), readable |

---

## Issues

### HIGH

**UI-RWP-001 — Option buttons missing explicit 44px touch targets**

- Observed (browser): Step 1 MCQ buttons (Opposite/Adjacent/Hypotenuse): computed height **41px**. Step 2 MCQ buttons (cos/sin/tan): 41px. Step 3 "Check" button: visible on screen. "Play Again" button: 41px.
- Measurement: `getBoundingClientRect().height = 41` for all 3 step-1 MCQ buttons.
- Impact: Learners on touch devices cannot reliably tap option buttons. 7th confirmed instance of this pattern. Rule shipped.
- Classification: (a) Gen prompt rule
- Status: **SHIPPED** — GEN-UX-002 (2026-03-23). Verify next build: all interactive buttons ≥44px.

**UI-RWP-002 — Results screen renders in document flow (position: static)**

- Observed (browser): `#results-screen` computed style: `position:static`, `z-index:auto`. After "See Results" click: `rectTop:80px`, `rectLeft:36px`, `rectWidth:408px`, `rectHeight:231px`, `coversViewport:false`. Viewport: 480×800. Results content is visible but does NOT overlay — it sits in page flow below the progress bar region.
- Impact: Results screen is visible (not below-fold in this case) but does not cover the game area. Game content is still rendered behind. On builds where game content is taller, results will be below fold. This is the 7th confirmed instance of this pattern.
- Classification: (a) Gen prompt rule
- Status: **SHIPPED** — GEN-UX-001 (2026-03-23). `position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999` required.

**UI-RWP-003 — ProgressBarComponent initialized with wrong slot ID**

- Observed (browser): Source code: `new ProgressBarComponent({ slotId: 'mathai-progress-bar-slot', totalRounds: gameState.totalRounds, totalLives: gameState.totalLives })`. Browser console: `[WARNING] ProgressBar: Slot #mathai-progress-bar-slot not found`. CDN created a fallback slot in `.game-area` instead. `mathai-progress-slot` exists in DOM but unused by ProgressBar.
- Impact: ProgressBar mounts in wrong location (fallback). Visual position may be incorrect relative to ScreenLayout.
- Classification: (a) Gen prompt rule
- Status: **SHIPPED** — GEN-UX-003 (2026-03-23). Must use `{ slotId: 'mathai-progress-slot' }`.

**UI-RWP-004 — SignalCollector sealed on restart — signal loss**

- Observed (browser): After Play Again, browser console shows: `[WARNING] [SignalCollector] Sealed — cannot record`, `[WARNING] [SignalCollector] Sealed — cannot startProblem`. The `restartGame()` function does not re-initialize SignalCollector — it reuses the sealed instance. Round 2 problems on a restarted game emit no signals.
- Impact: Analytics for replay sessions are completely silent — no events, no round data. DB pass rates for real-world-problem in replayed sessions are absent.
- Classification: (a) Gen prompt rule → add to spec: `restartGame()` must call `signalCollector.reset()` or create a new `SignalCollector` instance.
- Status: Open — escalate to Gen Quality. Add to spec Section 3 notes.

**UI-RWP-009 (NEW) — syncDOMState() targets `#app` not `body` — test gap**

- Observed (browser): `syncDOMState()` sets `data-phase`, `data-lives`, `data-round`, `data-score` on `document.getElementById('app')`. `document.body` has `null` for all these attributes throughout gameplay.
- Values confirmed: `app.dataset.phase = "playing"`, `app.dataset.lives = "3"`, `app.dataset.round = "1"` — all correct on `#app`. But Playwright tests that use `page.locator('body[data-phase="playing"]')` or `body.getAttribute('data-lives')` will always fail.
- Impact: Test harness assertions on `data-phase`/`data-lives` will time out or return null. This is a test gap — the game logic is correct (syncDOMState works) but tests look at the wrong element.
- Classification: (d) Test gap → Test Engineering: update test selectors to use `#app[data-phase]` instead of `body[data-phase]`. OR add to gen rule: syncDOMState must target `body` AND `#app`.
- Status: Open — HIGH priority for Test Engineering.

**UI-RWP-010 (NEW) — "Play Again" button 41px height (below 44px)**

- Observed (browser): `#results-screen button[data-testid="btn-restart"]` height: 41px. Same as MCQ buttons — GEN-UX-002 rule not applied to results screen Play Again button.
- Classification: (a) Gen prompt rule — GEN-UX-002 must explicitly cover `#btn-restart` and results-screen buttons.
- Status: Open — add to GEN-UX-002 rule coverage: all buttons including Play Again and Try Again.

---

### MEDIUM

**UI-RWP-005 — Input validation uses alert() instead of inline feedback**

- Observed (static): `alert('Please enter a number')` on empty/invalid submission. Could not trigger during browser playthrough (input accepts 0.00 default without alerting).
- Impact: Native modal blocks page on mobile.
- Classification: (a) Gen prompt rule
- Status: **SHIPPED** — GEN-UX-004 (2026-03-23).

**UI-RWP-006 — Typed numeric input has no Enter key submission handler**

- Observed (browser): Typed "5" into `input[type="number"]`, pressed Enter. Page state unchanged — no submission. `input.onkeydown = null`. No addEventListener for keydown bound to input.
- Classification: (a) Gen prompt rule
- Status: **SHIPPED** — GEN-UX-004 batch (2026-03-23). 2nd confirmed instance (browser-verified).

**UI-RWP-011 (NEW) — SVG diagram missing `preserveAspectRatio` — clip risk on narrow screens**

- Observed (browser): SVG `viewBox="0 0 400 300"`, no `width`/`height` attributes, no `preserveAspectRatio`. Text element "wall height (?)" at `x=360` — only 40px from viewBox right edge (400px wide). Text extends rightward from x=360, clipping beyond SVG right edge. Visually confirmed in screenshot: "wall" label truncated to just "wall |" with a cursor-like artifact at x=400.
- Impact: Label for the unknown quantity is clipped. Learner cannot read "wall height (?)" completely. Affects comprehension of what to calculate.
- Classification: (b) Spec addition → add to spec: SVG must declare `preserveAspectRatio="xMidYMid meet"` and all text must be positioned with ≥20px margin from viewBox edges. Labels for unknown sides must use `text-anchor="end"` or `x` ≤ viewBox-width - 80px.
- Status: Open — routed to Education slot.

---

### LOW

**UI-RWP-007 — Accuracy metric scope ambiguous — per-step vs per-game**

- Observed: SignalCollector emits `problem_ended` with aggregate data. No per-step `signal_answer` with `step_id`.
- Classification: (d) Test gap / Education handoff
- Status: Open — routed to Education slot (per-step signal spec) and Test Engineering (per-step assertion).

**UI-RWP-008 — SVG label text overflows bounding box**

- Observed (browser CONFIRMED): `text` elements at fixed pixel coordinates relative to `viewBox="0 0 400 300"` with no `preserveAspectRatio`. "wall height (?)" at `x=360` clips at SVG right edge. SVG has no `width`/`height` attrs, relies on container.
- Classification: (b) Spec addition
- Status: Open — merged with UI-RWP-011 finding. Routed to Education slot.

**UI-RWP-012 (NEW) — Sentry package 404**

- Observed (browser): `GET test-dynamic-assets/packages/sentry/index.js => 404`. No Sentry error tracking active.
- Impact: Production errors in this game will not be captured. Low severity as this is a monitoring gap, not a functional issue.
- Classification: (c) CDN constraint / warehouse gap — Sentry v10 three-script pattern missing from template. 12th+ confirmed instance.
- Status: Low — known recurring pattern. Warehouse template gap.

---

## Browser Playthrough Confirmation Status

| Static Finding | Browser Status |
|---------------|----------------|
| UI-RWP-001 — buttons < 44px | CONFIRMED — measured 41px |
| UI-RWP-002 — results-screen static | CONFIRMED — position:static, rectTop:80, coversViewport:false |
| UI-RWP-003 — wrong ProgressBar slot ID | CONFIRMED — `mathai-progress-bar-slot` in source, console WARNING logged |
| UI-RWP-004 — SignalCollector no args | CONFIRMED — sealed warning on restart (replay signals lost) |
| UI-RWP-005 — alert() validation | SHIPPED — could not trigger in playthrough (tolerates 0.00 default) |
| UI-RWP-006 — Enter key unbound | CONFIRMED — Enter pressed, no submission, `onkeydown=null` |
| UI-RWP-007 — per-step signal tracking | Pending spec change |
| UI-RWP-008 — SVG label overflow | CONFIRMED — "wall height (?)" at x=360 clips, no preserveAspectRatio |

---

## Gen Prompt Rule Proposals

| Rule | Status |
|------|--------|
| Results screen must be position:fixed overlay (GEN-UX-001) | SHIPPED 2026-03-23 |
| Explicit 44px touch targets on all buttons (GEN-UX-002) | SHIPPED 2026-03-23 |
| ProgressBarComponent must use `{ slotId: 'mathai-progress-slot' }` (GEN-UX-003) | SHIPPED 2026-03-23 |
| Never use alert()/confirm() — use inline aria-live div (GEN-UX-004) | SHIPPED 2026-03-23 |
| SignalCollector must receive constructor args (GEN-UX-005) | SHIPPED 2026-03-23 |
| Typed numeric input fields must bind Enter key → submit handler | SHIPPED 2026-03-23 (browser-confirmed 2nd instance) |
| restartGame() must re-initialize SignalCollector (not reuse sealed instance) | Open — NEW finding from browser playthrough |
| GEN-UX-002 must cover Play Again / Try Again buttons explicitly | Open — NEW finding, extend rule |

## Open Actions

| Action | Priority | Owner |
|--------|----------|-------|
| Test Engineering: update test selectors to use `#app[data-phase]` not `body[data-phase]` | HIGH | Test Engineering |
| Test Engineering: add Play Again button height assertion (≥44px) | High | Test Engineering |
| Gen Quality: add restartGame() SignalCollector re-init rule | Medium | Gen Quality |
| Education: add SVG label margin/preserveAspectRatio requirement to spec | Medium | Education |
| Education: add per-step signal tracking to spec (step_id + first_attempt) | Medium | Education |
| Test Engineering: add per-step signal_answer assertion | Medium | Test Engineering |
| Gen Quality: extend GEN-UX-002 to explicitly cover Play Again/Try Again buttons | Low | Gen Quality |
| Verify next real-world-problem build: results overlay, 44px all buttons, ProgressBar slot ID, no alert(), Enter key, SignalCollector re-init on restart | High | Test Engineering |
