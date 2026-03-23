# Match the Cards — UI/UX Audit

**Build:** #514
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
| PASS | 16 |

**Verdict: No re-queue required.** All 5 rounds functional. Correct match flow, wrong match life deduction, level transition (Level 1 → Level 2 at round 3), results screen, and Play Again all work end-to-end. Issues are systemic (GEN-UX-001, ARIA-001, GEN-GAMEID) with no game-flow impact.

---

## Issues

### UI-MTC-001 — results-screen position:static (MEDIUM)
- **Category:** a — gen prompt rule (GEN-UX-001)
- **Observed:** `getComputedStyle(resultsScreen).position = "static"`. Results card renders inline in the document flow, not as a fixed overlay. On short viewports, results card may be partially hidden or scrollable.
- **Expected:** `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;`
- **Instance count:** 14th confirmed GEN-UX-001 instance across all audited builds
- **Test impact:** Playwright assertion `waitForSelector('#results-screen')` passes but visual position differs from spec intent
- **Action:** GEN-UX-001 (rule 1, prompts.js) already deployed — failure at generation suggests rule coverage needs reinforcement

### UI-MTC-002 — No aria-live region anywhere (MEDIUM)
- **Category:** a — gen prompt rule (ARIA-001)
- **Observed:** `document.querySelectorAll('[aria-live]')` returns empty array. No feedback div, no results region, no instruction area has `aria-live`. Correct/wrong match feedback is purely visual (CSS class change + audio).
- **Expected:** At minimum one `aria-live="polite"` region for match feedback (e.g. on a feedback `<div>` that updates with "Correct!" / "Try again!")
- **Instance count:** 17th confirmed ARIA-001 instance across all audited builds
- **Action:** GEN-120 (ARIA-001, rule 30 in prompts.js) already deployed — failure at generation continues; T1 check for aria-live presence is a candidate enforcement point

### UI-MTC-003 — gameState.gameId undefined (MEDIUM)
- **Category:** a — gen prompt rule (GEN-GAMEID)
- **Observed:** `window.gameState.gameId` is `undefined`. SignalCollector initialized with `templateId: null`. PostMessage payload has no `gameId` field.
- **Expected:** `gameState.gameId = 'match_the_cards'` (or equivalent snake_case) set as first field in gameState declaration
- **Instance count:** 5th confirmed GEN-GAMEID instance in browser playthrough
- **Test impact:** SignalCollector.templateId = null; any test asserting `gameState.gameId` will fail
- **Action:** GEN-GAMEID rule (rule 48 in prompts.js) already deployed — failure at generation continues

### UI-MTC-004 — No Enter key binding (LOW)
- **Category:** a — gen prompt rule
- **Observed:** `document.onkeydown = null`, `window.onkeydown = null`. Pressing Enter on transition screen does not advance to gameplay.
- **Expected:** Enter key bound to advance CTA action (spec-level requirement for accessibility and keyboard users)
- **Action:** Low priority — match-the-cards is tap-primary (card click), no text input involved; GEN-ENTER-KEY rule not yet shipped

### UI-MTC-005 — FeedbackManager subtitle not loaded (20× warnings) (LOW)
- **Category:** c — CDN constraint
- **Observed:** `[FeedbackManager] Subtitle component not loaded, skipping` fires on every `playDynamicFeedback()` call — 20 instances across full playthrough.
- **Root cause:** SubtitleComponent loads lazily via CDN. In Playwright headless environment it may not be present at time of feedback calls.
- **Test impact:** No functional impact — feedback audio still plays; subtitle text absent
- **Action:** CDN constraint — document in T1 gap tracker. FeedbackManager.playDynamicFeedback() subtitle is best-effort.

### UI-MTC-006 — SignalCollector "Sealed — cannot recordViewEvent" (1×) (LOW)
- **Category:** c — CDN constraint
- **Observed:** After endGame(), `signalCollector.seal()` is called, then `FeedbackManager.playDynamicFeedback()` calls `signalCollector.recordViewEvent()` asynchronously → "Sealed — cannot recordViewEvent" warning.
- **Root cause:** endGame() calls `seal()` before `FeedbackManager.playDynamicFeedback()` resolves (async). Order: seal() → playDynamicFeedback() starts → feedback callback triggers recordViewEvent → too late.
- **Test impact:** 1 signal event lost per game completion. Low impact.
- **Action:** Known CDN sequencing pattern. Third confirmed instance (also in real-world-problem). Document in CDN constraint log.

---

## Passes

| Check | Result | Notes |
|-------|--------|-------|
| CSS intact | PASS | `.match-card` background, border, border-radius, min-height all computed correctly — no CSS strip |
| Match card height | PASS | `getBoundingClientRect().height = 52px` (min-height: 52px in CSS) |
| Let's go! button height | PASS | 47px |
| Play Again button height | PASS | 44px (exactly at threshold) |
| TransitionScreen object API | PASS | `typeof TransitionScreenComponent === 'function'`; `transitionScreen.show({...})` object mode used throughout |
| ProgressBar slotId | PASS | `new ProgressBarComponent({ slotId: 'mathai-progress-slot' })` — slot found in DOM |
| ProgressBar totalLives | PASS | `totalLives: 3` passed correctly — no RangeError |
| data-phase on #app | PASS | Transitions: `start_screen` → `transition` → `playing` → `results` — all correct |
| data-lives on #app | PASS | `lives=3` → `lives=2` after wrong match, `lives=2` at results |
| data-round on #app | PASS | Reflects `currentRound` correctly throughout |
| window.endGame | PASS | `typeof window.endGame === 'function'` |
| window.restartGame | PASS | `typeof window.restartGame === 'function'` |
| window.nextRound | PASS | `typeof window.nextRound === 'function'` (aliased to loadRound) |
| data-testid presence | PASS | `matching-area`, `results-screen`, `btn-restart`, `left-card-N`, `right-card-N` all present |
| game_complete postMessage | PASS | `window.__lastPostMessage.type === 'game_complete'` with metrics payload |
| Play Again state reset | PASS | lives=3, round=0, score=0, wrongAttempts=0, gameEnded=false — all reset; fresh SignalCollector initialized |
| All 5 rounds functional | PASS | Rounds 1–5 all completable; Level 1 (rounds 1–2, 3 pairs), Level 2 (rounds 3–5, 4 pairs) |
| Wrong match life deduction | PASS | Wrong match → lives decremented, progressBar.update() called, red flash on cards |
| Level transition | PASS | `showLevelTransition(2)` fires at currentRound=2; "Next Level" button advances to Level 2 correctly |
| Results screen reachable | PASS | `resultsVisible='flex'`; 5/5 rounds, 95% accuracy, 2 stars rendered correctly |

---

## Cross-Slot Routing

| Finding | Route to | Action |
|---------|----------|--------|
| UI-MTC-001 results-screen static (14th GEN-UX-001) | Gen Quality | Consider T1 enforcement for `position:fixed` on `#results-screen` |
| UI-MTC-002 no aria-live (17th ARIA-001) | Gen Quality | Consider T1 enforcement for at least one `[aria-live]` element |
| UI-MTC-003 gameId undefined (5th GEN-GAMEID) | Gen Quality + Test Engineering | Add test assertion for `window.gameState.gameId` being set |
| UI-MTC-005/006 CDN subtitle/seal warnings | Education (CDN constraints doc) | Document expected CDN behavior; no action required |
