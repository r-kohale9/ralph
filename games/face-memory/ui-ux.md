# Face Memory — UI/UX Audit

**Build:** #512
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)
**Auditor:** UI/UX Slot (Rule 16)

---

## Summary

| | Count |
|-|-------|
| P0 (flow blocker) | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 3 |
| PASS | 18 |

**Verdict: No re-queue required.** All 3 rounds functional. Correct and wrong answer flow, life deduction, results screen, and Play Again all work end-to-end. Difficulty scales across rounds (Round 1: 3 features; Rounds 2–3: 4 features including Accessory). Issues are systemic (GEN-UX-001, ARIA-001, GEN-GAMEID) with no game-flow impact.

---

## Issues

### UI-FM-001 — results-screen position:static (MEDIUM)
- **Category:** a — gen prompt rule (GEN-UX-001)
- **Observed:** `getComputedStyle(document.getElementById('results-screen')).position = "static"`. Results card is in the normal document flow (`.game-block` class, `display:flex; flex-direction:column`). Not a fixed overlay. On short viewports the Play Again button remains reachable because the results card is the only content rendered, but the architectural pattern is wrong.
- **Expected:** `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;`
- **Instance count:** 15th confirmed GEN-UX-001 instance across all audited builds
- **Test impact:** `checkResultsScreenViewport()` Playwright assertion (TE-RES-001) will fail — `position` is `static` and the element rect is `{x:20, y:64, width:335, height:510.5}` which does not cover viewport
- **Action:** GEN-UX-001 (rule 1, prompts.js) + T1 WARNING [GEN-RESULTS-FIXED] already deployed — failure at generation continues; T1 enforcement may need escalation to ERROR level

### UI-FM-002 — No aria-live region anywhere (MEDIUM)
- **Category:** a — gen prompt rule (ARIA-001)
- **Observed:** `document.querySelectorAll('[aria-live]').length === 0`. No feedback div, no results region, no instruction area has `aria-live`. Correct/wrong answer feedback is purely visual (option highlight + audio).
- **Expected:** At minimum one `aria-live="polite"` region for feature-selection feedback (e.g. feedback on correct vs incorrect option selection)
- **Instance count:** 18th confirmed ARIA-001 instance across all audited builds
- **Action:** GEN-120 (ARIA-001, rule 30 in prompts.js) already deployed — failure at generation continues

### UI-FM-003 — gameState.gameId undefined (MEDIUM)
- **Category:** a — gen prompt rule (GEN-GAMEID)
- **Observed:** `window.gameState.gameId` is `undefined`. SignalCollector initialized with `templateId: null` (`templateId: gameState.gameId || null`). PostMessage `game_complete` payload does not include a `gameId` field.
- **Expected:** `gameState.gameId = 'face_memory'` (or equivalent snake_case) set as first field in gameState declaration
- **Instance count:** 6th confirmed GEN-GAMEID instance in browser playthrough
- **Test impact:** SignalCollector.templateId = null; analytics data not attributed to game
- **Action:** GEN-GAMEID rule (rule 48 in prompts.js) already deployed — failure at generation continues

### UI-FM-004 — feature-option interactive elements are div not button (LOW)
- **Category:** a — gen prompt rule
- **Observed:** `.feature-option` elements are `<div>` tags with `role=null` and `tabIndex=-1`. These are the primary interactive elements during gameplay (the 4 emoji choices the user must click). They are not keyboard accessible (Tab cannot reach them; Enter/Space do not activate them).
- **Expected:** Interactive answer options should be `<button>` elements or `<div role="button" tabindex="0">` with keyboard event handlers
- **Test impact:** Test selector `[data-testid="option-0"]` works for Playwright clicks (Playwright will click divs), but screen-reader users cannot use this game
- **Action:** Low priority — game is mobile-first, emoji tap. Add to Gen Quality backlog: "interactive choice elements must be `<button>` or have `role='button'` + `tabindex='0'`"

### UI-FM-005 — No Enter key binding on start screen (LOW)
- **Category:** a — gen prompt rule
- **Observed:** `document.onkeydown === null`, `window.onkeydown === null`. Pressing Enter on the start screen ("I'm ready!" visible) does not advance to gameplay — phase remains `start`.
- **Expected:** Enter key bound to CTA action on start screen
- **Action:** Low priority — face-memory is tap-primary; GEN-ENTER-KEY rule not yet shipped

### UI-FM-006 — FeedbackManager subtitle not loaded (6× warnings) (LOW)
- **Category:** c — CDN constraint
- **Observed:** `[FeedbackManager] Subtitle component not loaded, skipping` fires on every correct/wrong answer feedback call — 6 instances across full playthrough.
- **Root cause:** SubtitleComponent loads lazily via CDN. In Playwright headless environment it may not be present at time of feedback calls.
- **Test impact:** No functional impact — feedback audio still plays; subtitle text absent
- **Action:** CDN constraint — known pattern (also in match-the-cards ×20, associations ×multiple). Document in CDN constraint log. No action required.

---

## Passes

| Check | Result | Notes |
|-------|--------|-------|
| CSS intact | PASS | Button bg = `rgb(33, 150, 83)`, borderRadius applied — no CSS strip |
| "I'm ready!" button height | PASS | 47px |
| Play Again button height | PASS | 44px (exactly at threshold) |
| Continue button height | PASS | 47px |
| feature-option height | PASS | 72px (div-based option cards, well above 44px threshold) |
| TransitionScreen object API | PASS | `typeof TransitionScreenComponent === 'function'`; used throughout for round transitions |
| ProgressBar slotId | PASS | `new ProgressBarComponent({ slotId: 'mathai-progress-slot' })` — slot found in DOM |
| ProgressBar totalLives | PASS | `totalLives: 3` passed correctly — no RangeError |
| data-phase on #app | PASS | Transitions: `start` → `reveal` → `select` → `transition` → `results` — all correct |
| data-lives on #app | PASS | `lives=3` → `lives=2` after wrong answer → `lives=1` at results |
| data-round on #app | PASS | Updates to `1` → `2` → `3` correctly across rounds |
| syncDOMState targets #app | PASS | `getElementById('app')` — not document.body (LP-4 pattern correct) |
| window.endGame | PASS | `typeof window.endGame === 'function'` |
| window.restartGame | PASS | `typeof window.restartGame === 'function'` |
| window.nextRound | PASS | `typeof window.nextRound === 'function'` |
| data-testid presence | PASS | `timer-display`, `feature-options`, `option-0` through `option-3`, `stars-display`, `score-display`, `time-display`, `lives-display`, `btn-restart` all present |
| game_complete postMessage | PASS | `window.__lastPostMessage.type === 'game_complete'` with full metrics payload (score, accuracy, time, stars, livesRemaining, attempts) |
| Play Again state reset | PASS | phase=start, currentRound=0, lives=3, score=0, gameEnded=false — all reset; fresh SignalCollector initialized |
| All 3 rounds functional | PASS | Rounds 1–3 all completable; difficulty scales (3 features → 4 features) |
| Wrong answer life deduction | PASS | Wrong answer → lives decremented correctly (3→2 confirmed in round 2) |
| Results screen reachable | PASS | `display:flex` at game end; 1-star result shown with correct metrics |
| 0 console errors | PASS | 0 errors across 190 total console messages in full playthrough |
| SignalCollector sealed warning | PASS (expected) | 1× `Sealed — cannot recordViewEvent` after endGame() — known CDN sequencing pattern (4th confirmed instance) |

---

## Cross-Slot Routing

| Finding | Route to | Action |
|---------|----------|--------|
| UI-FM-001 results-screen static (15th GEN-UX-001) | Gen Quality | Consider escalating T1 WARNING to ERROR to force regeneration |
| UI-FM-002 no aria-live (18th ARIA-001) | Gen Quality | T1 enforcement candidate for `[aria-live]` presence |
| UI-FM-003 gameId undefined (6th GEN-GAMEID) | Gen Quality + Test Engineering | Add test assertion for `window.gameState.gameId` being set |
| UI-FM-004 feature-option divs not buttons | Gen Quality | Backlog: interactive choice divs need `role=button` + `tabindex=0` |
| UI-FM-006 CDN subtitle/seal warnings | Education (CDN constraints doc) | Document expected CDN behavior; no action required |
