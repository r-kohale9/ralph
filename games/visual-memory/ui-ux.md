# visual-memory — UI/UX Audit

**Build:** #528 | **Audit date:** 2026-03-23 | **Method:** full browser playthrough (Playwright MCP, GCP HTML download)

---

## Summary

**2 P0s, 5 additional findings (3a, 1b, 1c)**

| Severity | Count | Action |
|----------|-------|--------|
| P0 | 2 | Re-queue required |
| Gen rule (a) | 3 | Route to Gen Quality |
| Spec (b) | 1 | Route to Education |
| CDN constraint (c) | 1 | Document |

**Verdict: Re-queue required.** Two P0 flow bugs make the all-correct path uncompletable.

---

## Findings

### P0-1 — endGame() guard blocks results screen on perfect playthrough [P0]

**Description:** When a player completes all 5 rounds correctly (no lives lost), the results screen never appears. The game freezes: Submit button is disabled, feedback shows "Perfect recall!", and no further interaction is possible.

**Root cause:** `endGame()` line 775 has a guard: `if (!gameState.isActive && gameState.lives > 0) return`. In the correct-answer path, `handleSubmit()` sets `gameState.isActive = false` at line 523 before the submit logic runs. It is never reset to `true` before the 1500ms `setTimeout(() => nextRound())` fires. When `nextRound()` calls `endGame()` after the last round, the guard condition is met (`isActive=false`, `lives>0`) and `endGame()` returns without showing results. `gameEnded` stays `false`. The results screen is never reached.

**Evidence:** Live Playwright playthrough — all 5 rounds answered correctly, final state: `phase="playing"`, `currentRound=5`, `score=5`, `gameEnded=false`, results screen `display:none`.

**Classification:** (a) gen prompt rule — "In the correct-answer path, reset `gameState.isActive = true` before calling `nextRound()` via setTimeout, OR remove the `!isActive` check from the `endGame()` guard when `gameEnded=false`."

---

### P0-2 — setupRound() crashes when called after last round via Continue button [P0]

**Description:** After the 5th round's correct-answer transition screen appears (from `nextRound()` → transition → Continue), clicking Continue triggers `setupRound()` which crashes: `TypeError: Cannot read properties of undefined (reading 'gridSize')` because `gameState.content.rounds[5]` is `undefined` (only indices 0–4 exist).

**Root cause:** Caused by P0-1 — `endGame()` guard prevents the game-end path, so `nextRound()` still shows a Round N transition screen. Its Continue button action calls `setupRound()` directly (line 664), which accesses `gameState.content.rounds[gameState.currentRound]` where `currentRound=5`. This is an out-of-bounds array access.

**Evidence:** Console error during live playthrough: `TypeError: Cannot read properties of undefined (reading 'gridSize') at setupRound (http://localhost:9191/:410:59)`.

**Classification:** (a) gen prompt rule — fix is same as P0-1. Once `endGame()` runs correctly, `nextRound()` will call `endGame()` instead of the transition screen for the last round.

---

### F1 — waitForPackages timeout too short [LOW] (a)

**Description:** `waitForPackages()` uses `elapsed >= 10000` (10 seconds) as the timeout. Required value is 180000ms (3 minutes) per pipeline gen rule.

**Evidence:** `timeoutMatch: "10000"` from inline script inspection. Build #528 HTML line 916.

**Classification:** (a) gen prompt rule — "waitForPackages timeout must be 180000ms" (existing rule, not being followed in this build).

---

### F2 — feedback-area and feedback-text missing aria-live [LOW] (a)

**Description:** Neither `#feedback-area` nor `#feedback-text` has an `aria-live` attribute. Feedback text ("Perfect recall!" / "Not quite the right pattern!") changes dynamically but is not announced to screen readers.

**Evidence:** `feedbackAreaAriaLive: null`, `feedbackTextAriaLive: null` from live DOM inspection.

**Classification:** (a) gen prompt rule — "Feedback elements that show dynamic correct/wrong messages must have `aria-live='polite'` on the container."

---

### F3 — Grid cells have no ARIA role [LOW] (a)

**Description:** The 9–16 clickable grid cells (`div.grid-cell`) have no `role` attribute, so they are invisible to the accessibility tree. Playwright snapshot confirms cells are not present as interactive elements. Players using screen readers or assistive navigation have no way to identify or select cells.

**Evidence:** Playwright snapshot during recall phase shows only "Clear" and "Submit" buttons in the a11y tree — no grid cells visible.

**Classification:** (a) gen prompt rule — "Clickable game elements that are not `<button>` or `<a>` must have `role='button'` and `tabindex='0'` and `aria-label`."

---

### F4 — Accuracy calculation allows >100% display [MEDIUM] (b)

**Description:** The accuracy formula is `Math.round((score / attempts.length) * 100)`. In the normal game flow, a player can score a correct round on first attempt, giving `score=5` and `attempts=5` → 100%. However, if `score` tracks unique correct rounds and `attempts` tracks only submitted answers (which can be fewer than rounds when rounds are automatically correct), the denominator can be smaller than the numerator. Live test: `score=3`, `attempts=2` → displayed accuracy **150%**.

The root cause is that `recordAttempt()` is only called on `handleSubmit()`, but `score` can be incremented from endGame() forced state. In normal play this can still occur if the score/attempts relationship is miscalibrated.

**Evidence:** `result-accuracy` showing "150%" on results screen screenshot (06-results-screen.png).

**Classification:** (b) spec addition — accuracy should be clamped to 100% maximum: `Math.min(100, Math.round((score / attempts.length) * 100))`, or spec should clarify the accuracy calculation method.

---

### F5 — FeedbackManager subtitle not rendered [LOW] (c)

**Description:** All `FeedbackManager.playDynamicFeedback()` calls pass a `subtitle` parameter (e.g., `"Perfect recall!"`), but the console warns `[FeedbackManager] Subtitle component not loaded, skipping` on every call. Subtitles never appear visually.

**Evidence:** 3 warnings of `[FeedbackManager] Subtitle component not loaded, skipping` in console.

**Classification:** (c) CDN constraint — SubtitleComponent must be initialized before FeedbackManager for subtitles to render. This appears to be a CDN loading order / initialization issue. Not a gen code bug, but worth documenting as a known limitation.

---

## Checklist Results

| Check | Result |
|-------|--------|
| Start screen visible, button works | PASS |
| Game flow: start → round 1 → recall → correct feedback | PASS |
| Game flow: wrong answer → life lost | PASS |
| Round transition screen (Continue button) | PASS |
| Game flow: all 5 rounds correct → results screen | **FAIL (P0-1)** |
| Game flow: lives=0 → game over screen | not tested (P0 priority) |
| Touch targets ≥44px (Submit, Clear, Play Again) | PASS (47px, 47px, 44px) |
| Grid cell touch targets | PASS (88x88px) |
| Results screen visible after game end | FAIL (P0-1) |
| ARIA: feedback elements have aria-live | FAIL (F2) |
| ARIA: interactive grid cells have role | FAIL (F3) |
| syncDOMState: data-phase updates correctly | PASS (playing/transition confirmed) |
| restartGame: resets score/lives/round/phase | PASS (full reset verified) |
| Console PAGEERROR during gameplay | FAIL — TypeError in setupRound (P0-2) |
| TransitionScreen: uses object API | PASS |
| ProgressBar: using slotId options form | PASS (slotId: 'mathai-progress-slot') |
| waitForPackages: timeout=180000ms | FAIL (10000ms — F1) |

---

## Action Required

### P0s — Re-queue immediately
1. **P0-1 + P0-2:** Fix `endGame()` guard logic. The `!gameState.isActive` check at line 775 must not block the success path. Fix: reset `gameState.isActive = true` before the `setTimeout(() => nextRound())` call in `handleSubmit()`'s correct path (after line 563), OR remove the broken guard. This will also fix P0-2 (the out-of-bounds `setupRound` crash) since `nextRound()` will route to `endGame()` correctly.

### Gen Quality route (a-class findings)
- **F1 (waitForPackages):** Reinforce rule — timeout must be 180000ms. Existing rule not applied in build #528.
- **F2 (aria-live missing):** Add rule: dynamic feedback containers need `aria-live="polite"`.
- **F3 (grid cells ARIA):** Add rule: non-`<button>` interactive elements need `role="button"`, `tabindex="0"`, `aria-label`.
- **P0-1 guard:** Add rule: "In handleSubmit() correct path, always reset `gameState.isActive = true` before calling `nextRound()` via setTimeout."

### Education route (b-class findings)
- **F4 (accuracy >100%):** Add spec note or gen rule: clamp accuracy display to max 100%.

### CDN constraint (c-class findings)
- **F5 (subtitle missing):** Document as known CDN limitation. No gen rule needed.
