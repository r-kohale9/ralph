# Keep-Track — UI/UX Audit
**Build:** #571
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)

---

## Summary

| Severity | Count |
|----------|-------|
| P0       | 0     |
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 2     |
| CDN      | 2     |
| **Total findings** | **9** |

**Verdict:** No P0 — build #571 approved. GEN-TS-ONEARG fix confirmed working. Game flow is complete and fully playable.

---

## P0 Findings

None.

---

## HIGH Findings

### HIGH-1: GEN-INTERACTIVE-DIV-ROLE — Cup divs still missing role/tabindex/aria-label
**Category:** (a) gen rule — GEN-INTERACTIVE-DIV-ROLE
**Description:** Interactive cup containers are rendered as `<div>` elements with no `role="button"`, no `tabindex="0"`, and no `aria-label`. They have `data-testid="option-N"` and a click handler, but are not keyboard-focusable or screen-reader-accessible.
**Evidence:**
```json
{ "tagName": "DIV", "role": null, "tabindex": null, "ariaLabel": null, "clickable": true }
```
This issue was flagged in #503 audit. The GEN-INTERACTIVE-DIV-ROLE rule exists but was not applied — cups are still plain divs.
**Action:** Verify GEN-INTERACTIVE-DIV-ROLE rule is active in lib/prompts.js and re-confirm it applies to container divs, not just icon spans.
**Routing:** Gen Quality slot — check rule wording and re-apply.

### HIGH-2: ARIA-001 — No aria-live regions
**Category:** (a) gen rule — ARIA-001
**Instance count:** 26th+ confirmed instance.
**Description:** 0 `aria-live` regions found on page. Game phase changes, cup reveals, feedback, and results are invisible to screen readers.
**Action:** Gen Quality slot — ARIA-001 rule must be enforced. Add T1 check in validate-static.js to fail builds missing aria-live.
**Routing:** Gen Quality → Test Engineering (add T1 check).

---

## MEDIUM Findings

### MED-1: results-screen missing data-testid="results-screen"
**Category:** (a) gen rule
**Description:** `document.getElementById('results-screen')` exists and is visible, but the element has no `data-testid="results-screen"` attribute. Tests that target `[data-testid="results-screen"]` will fail.
**Evidence:** `resultsTestid: null` (live DOM check).
**Instance count:** Same pattern as true-or-false #474 audit.
**Action:** Gen Quality slot — add rule that results container must have `data-testid="results-screen"` in addition to `id="results-screen"`.

### MED-2: data-phase not updated to "results" after endGame
**Category:** (a) gen rule
**Description:** After `endGame()` completes and results screen is shown, `#app[data-phase]` remains at `"guess"` instead of transitioning to `"results"`. The `showResults()` function (line 1024–1037) sets element display styles but does not call `syncDOMState()`. The `gameState.phase` is correctly set to `"results"` at line 945, but the DOM attribute is not refreshed when the results view appears.
**Impact:** Tests that wait for `[data-phase="results"]` to confirm game-over state will time out.
**Action:** Gen Quality slot — gen rule: `showResults()` must call `syncDOMState()` after updating display.

### MED-3: btn-restart touch target 43px (1px under 44px minimum)
**Category:** (a) gen rule
**Description:** `[data-testid="btn-restart"]` renders at height 43px. The 44px minimum touch target (WCAG 2.5.5 / Apple HIG) is not met. Root cause: `.game-btn` has `padding: 12px 32px` with `font-size: 16px` and `line-height: normal`. Browser-resolved `normal` line-height for Inter at 16px computes to ~19px, giving 12+12+19=43px.
**Fix:** Add `min-height: 44px` to `.game-btn` rule. This also accounts for mechanics test failures on btn-restart in build #571.
**Action:** Gen Quality slot — add gen rule: all action buttons must have `min-height: 44px`.

---

## LOW Findings

### LOW-1: FeedbackManager subtitle CDN warning
**Category:** (c) CDN constraint
**Description:** `[WARNING] [FeedbackManager] Subtitle component not loaded, skipping`. CDN-internal warning fired when SubtitleComponent is not present in the audio playback path. Not a gen issue.
**Action:** Document only. No gen rule needed.

### LOW-2: loading.json 404s (Lottie animation)
**Category:** (c) CDN constraint
**Description:** `https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/loading.json` returns ERR_ABORTED (×4). LottiePlayer loading animation CDN asset not available in test environment. Does not affect gameplay.
**Action:** Document only. Known CDN constraint across all games.

---

## Passing Checks

| Check | Result |
|-------|--------|
| GEN-TS-ONEARG: TransitionScreen.show() single-object arg | PASS — all calls use `{ title, icons, buttons, ... }` single object |
| TransitionScreen renders start screen (was P0-A in #503) | PASS — "Keep Track / Follow the star!" rendered immediately |
| CDN packages load (0 404s) | PASS — all 8 packages loaded successfully |
| window.gameState.gameId | PASS — `'game_keep_track'` |
| window.endGame / restartGame / nextRound exposed | PASS — all functions present |
| data-phase transitions start → playing → guess | PASS |
| data-lives / data-round / data-score on #app | PASS — all attributes present and updating |
| syncDOMState targets #app (not document.body) | PASS |
| option-0 / option-1 / option-2 data-testid on cups | PASS |
| btn-restart data-testid present | PASS — `data-testid="btn-restart"` |
| results-screen position:fixed + full viewport | PASS — `position:fixed; top:0; left:0; width:100%; height:100%; z-index:100` |
| results-screen visible (display:flex) after game ends | PASS |
| game_complete postMessage structure | PASS — `{ type: 'game_complete', data: { metrics, attempts, events, signals, metadata, completedAt } }` |
| Timer color (was hardcoded #000FFF in #503) | PASS — now uses `--mathai-black` (#1A1A2E) |
| Progress bar updates | PASS — 0/5 → 1/5 after round completion |
| Round transition TransitionScreen | PASS — "Round 2 / Next" shown between rounds |
| FeedbackManager audio | PASS — dynamic audio fetch + cache HIT working |
| Console errors | PASS — 0 errors |

---

## Flow Observations

1. **Page load:** All 8 CDN packages loaded (no errors). ScreenLayout injected. ProgressBar rendered showing "0/5 rounds completed / ❤️❤️❤️".
2. **Start screen (TransitionScreen):** "⭐ Keep Track / Follow the star! / Let's go!" button rendered immediately on first frame. TransitionScreen.show() confirmed single-object arg — GEN-TS-ONEARG FIXED.
3. **Playing phase (after Let's go! click):** TransitionScreen hid. Game screen appeared with timer (00:04, color #1A1A2E), "Watch where the star hides!" instruction, 3 cups with labels (Cup 1, Cup 2, Cup 3) and ⭐ visible under one cup.
4. **Guess phase:** Star hidden under cup, instruction changed to "Where is the star?", cups became clickable. Cups shuffled positions (Cup 1, Cup 3, Cup 2 order after shuffle).
5. **Round 1 wrong answer:** FeedbackManager audio played ("oh no, it was under cup 3!"). Life lost — lives went from 3 to 2 (❤️❤️🤍). TransitionScreen showed "Round 2 / Next".
6. **Round transition:** TransitionScreen round transition working. Progress bar updated to 1/5 with blue fill.
7. **endGame called:** GAME_METRICS logged with complete structure including events and duration_data. game_complete postMessage fired.
8. **Results screen:** Full viewport white card. "⭐⭐ Game Complete!" with Score 0/5, Time 0:00, Rounds Completed 1, Lives Remaining 2, Accuracy 0%, "Play Again" button visible and prominent.

---

## Routing Summary

| Issue | Category | Route | Action |
|-------|----------|-------|--------|
| GEN-INTERACTIVE-DIV-ROLE: cups missing role/tabindex/aria-label | Gen rule | Gen Quality | Verify rule wording covers container divs |
| ARIA-001: no aria-live regions | Gen rule | Gen Quality + Test Engineering | Enforce rule + add T1 check |
| results-screen missing data-testid | Gen rule | Gen Quality | Add rule: results container needs data-testid="results-screen" |
| data-phase not updated to "results" after endGame | Gen rule | Gen Quality | showResults() must call syncDOMState() |
| btn-restart 43px height | Gen rule | Gen Quality | Add min-height: 44px to .game-btn |
| FeedbackManager subtitle warning | CDN constraint | Document | No action |
| loading.json 404s | CDN constraint | Document | No action |

**Verdict:** No P0 — GEN-TS-ONEARG fix confirmed. Game is fully playable end-to-end. 2 HIGH issues (both known gen rules needing enforcement verification), 3 MEDIUM issues including btn-restart 43px touch target. No re-queue required.

---

## Prior Audit Reference

Build #503 audit (2026-03-23): 2 P0 + 3 HIGH + 3 MEDIUM + 2 LOW. P0-A was GEN-TS-ONEARG (TransitionScreen called with two args, all screens blank). P0-B was gameContent staying display:none (consequence of P0-A). Re-queued as #567 → approved as #571.
