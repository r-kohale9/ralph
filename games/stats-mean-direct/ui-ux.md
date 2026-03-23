# Stats: Mean (Direct Calculation) — UI/UX Audit
**Build:** #580
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)
**URL:** https://storage.googleapis.com/mathai-temp-assets/games/stats-mean-direct/builds/580/index.html

---

## Summary

| Severity | Count |
|----------|-------|
| P0       | 0     |
| HIGH     | 0     |
| MEDIUM   | 3     |
| LOW      | 2     |
| CDN      | 1     |

**Verdict:** APPROVED — No P0 flow blockers. All 9 rounds functional, correct answers verified, wrong-answer life deduction works, results screen loads with correct metrics (7/9, 78%, 2 stars), Play Again resets all state cleanly. 3 MEDIUM findings (window.nextRound harness warning, results missing "rounds completed" metric, aria-atomic absent on feedback). No re-queue required.

---

## P0 Findings

None.

---

## HIGH Findings

None.

---

## MEDIUM Findings

### M-001 — Test harness console ERROR: `MISSING window.nextRound`
- **Observed:** Console logs `[ERROR] [ralph-test-harness] MISSING window.nextRound / window.loadRound / window.jumpToRound` on page load.
- **Root cause:** The test harness check fires during `waitForPackages` initialization, before DOMContentLoaded has run and assigned `window.nextRound`. The function IS defined and functional (confirmed via `typeof window.nextRound === 'function'` after load) — this is a timing race in the harness check.
- **Impact:** Could cause round-navigation tests to fail if they rely on this harness check passing without waiting.
- **Category:** (d) test gap → Test Engineering slot
- **Action:** Test Engineering: harness check should be deferred until after DOMContentLoaded, or use `waitFor(() => window.nextRound)` before asserting.

### M-002 — Results screen missing "rounds completed" metric
- **Observed:** Results screen shows: "Correct Answers: 7/9", "Accuracy: 78%", 2 stars, "Play Again". Missing "Rounds Completed" count.
- **Spec says (PART-019):** Metrics should include "correct answers, accuracy %, stars earned, rounds completed".
- **Impact:** Incomplete session summary for the learner (they can infer from "7/9" but explicit round completion count is absent).
- **Category:** (a) gen rule → Gen Quality slot
- **Action:** Add gen rule: results screen must display rounds completed explicitly alongside correct answers.

### M-003 — `aria-atomic` absent on feedback element
- **Observed:** `#answer-feedback` has `aria-live="polite"` and `role="status"` but `aria-atomic` is not set (defaults to `false`).
- **Impact:** Screen readers may announce partial updates if the feedback text is updated incrementally. Setting `aria-atomic="true"` ensures the full feedback string is announced on change.
- **Category:** (a) gen rule → Gen Quality slot
- **Action:** Gen rule: answer feedback elements with `aria-live` should also set `aria-atomic="true"`.

---

## LOW Findings

### L-001 — FeedbackManager "No audio_content provided" warnings (9 per playthrough)
- **Observed:** Console logs `[WARNING] [FeedbackManager] No audio_content provided` on every answer (both correct and wrong). 9 warnings total per playthrough.
- **Root cause:** `FeedbackManager.playDynamicFeedback()` is called without an `audio_content` payload. The spec correctly excludes `FeedbackManager.init()` (PART-017 NO), but the feedback calls don't include audio content.
- **Impact:** No audio feedback for the learner. Visual feedback (status text) still functions correctly.
- **Category:** (a) gen rule → Gen Quality slot (low priority — audio is optional for this game per spec)
- **Action:** Note for spec: if audio feedback is desired, provide `audio_content` to `playDynamicFeedback()` calls. Not blocking.

### L-002 — loading.json 404 (Lottie animation asset)
- **Observed:** 4× `GET https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/loading.json => net::ERR_ABORTED`
- **Root cause:** The CDN loading animation file is not available at this URL. Seen consistently across all games in this pipeline.
- **Impact:** Loading spinner animation not shown. Packages still load correctly (no white screen). Visual quality only.
- **Category:** (c) CDN constraint — document only
- **Action:** Known CDN constraint. No game-side fix possible.

---

## Passing Checks

| Check | Result |
|-------|--------|
| Start screen renders | PASS — Title "Mean Machine", calculator icon, subtitle, green "Let's Go!" button, progress bar, 3 lives |
| `#app[data-phase]` on start | PASS — `data-phase="start"` |
| `window.gameState` present at module scope | PASS — `{gameId: "stats-mean-direct", phase: "start", lives: 3, score: 0, totalRounds: 9}` |
| `window.gameState.gameId` correct | PASS — `"stats-mean-direct"` |
| `window.endGame` exposed | PASS — `typeof window.endGame === 'function'` |
| `window.restartGame` exposed | PASS — `typeof window.restartGame === 'function'` |
| `window.nextRound` exposed | PASS — `typeof window.nextRound === 'function'` (set in DOMContentLoaded) |
| Let's Go! button touch target | PASS — 47×140px (above 44px minimum) |
| Option buttons are `<button>` elements | PASS — all 4 options are `<button data-testid="option-N">` |
| Option button touch targets | PASS — 54×142.5px (well above 44px minimum) |
| Option buttons `data-testid` | PASS — `option-0` through `option-3` |
| Play Again button touch target | PASS — 46×139px (above 44px minimum) |
| Play Again `data-testid` | PASS — `data-testid="btn-restart"` |
| `aria-live="polite"` on feedback | PASS — `#answer-feedback` has `aria-live="polite"` and `role="status"` |
| Timer visible during play | PASS — timer container 320×41px, counts down from 45s |
| Timer value shown | PASS — `#timer-container` with `.timer-display` shows countdown number in blue |
| Dataset `aria-label` | PASS — dataset box has `aria-label="Data set"` |
| Dataset `data-testid` | PASS — `data-testid="dataset-display"` |
| `#app[data-phase]` transitions correctly | PASS — `start` → `playing` → `results` (verified) |
| `data-lives` decrements on wrong answer | PASS — 3→2 on round 3 wrong, 2→1 on round 6 wrong |
| `data-score` increments on correct answer | PASS — 10 per correct answer (score=70 after 7 correct) |
| Correct answer feedback text | PASS — e.g., "Correct! (2+4+6+8+10) ÷ 5 = 30 ÷ 5 = 6." with full working shown |
| Wrong answer feedback text | PASS — e.g., "Mean = (4+8+12+6+10) ÷ 5 = 8. The middle value (10) is the median." with correction |
| Results screen reachable | PASS — shown after round 9 automatically |
| Results screen `position:fixed` | PASS — `window.getComputedStyle(resultsEl).position === "fixed"` |
| Results screen `id="results-screen"` | PASS — `id="results-screen"` present |
| Star logic: 7/9 = 2 stars | PASS — "⭐⭐" displayed for 7 correct (spec: 6–8/9 = 2★) |
| Results shows correct count | PASS — "Correct Answers: 7 / 9" |
| Results shows accuracy % | PASS — "Accuracy: 78%" |
| Play Again resets state | PASS — `data-phase="start"`, lives=3, score=0, currentRound=0, correctAnswers=0 |
| ProgressBar component | PASS — `#mathai-progress-slot` present, renders "N/9 rounds completed" |
| TransitionComponent | PASS — start/results screens use transition component correctly |
| FeedbackManager.init() absent | PASS — no audio permission popup triggered (PART-017 correctly excluded) |
| Buttons disabled after answer | PASS — all 4 option buttons set `[disabled]` after selection |
| Auto-advance to next round | PASS — next round loads automatically after brief feedback display |
| 9 rounds total | PASS — completed rounds 1–9 (progress bar: 9/9 rounds completed) |
| Difficulty tiers observable | PASS — Easy (rounds 1–3, n=5, whole numbers), Medium (rounds 4–6, larger values), Hard (rounds 7–9, repeated values, mode distractors) |
| Misconception distractors present | PASS — raw sum, median, mode, off-by-one-n all observed across rounds |
| Real-world contexts in Hard tier | PASS — rainfall, cricket scores, plant counts, spelling test scores |
| No JS runtime errors | PASS — 0 runtime JS errors (harness timing warning is non-blocking) |
| No functional 404s | PASS — only loading.json animation 404 (CDN constraint, non-blocking) |

---

## Flow Observations

1. **Start screen** — "Mean Machine" title, calculator emoji icon, "Calculate the average of each dataset." subtitle, green "Let's Go!" button (47px). Progress bar shows "0/9 rounds completed" and 3 red hearts. Clean layout.

2. **Round 1** — Dataset: `2, 4, 6, 8, 10` (Easy, n=5). Question: "What is the mean of these 5 numbers?" Options: 5, 6, 8, 30. Correct=6. Timer starts at 45, counts down in blue. Selected 6. Feedback (aria-live): "Correct! (2+4+6+8+10) ÷ 5 = 30 ÷ 5 = 6." Buttons disabled. Auto-advance.

3. **Round 2** — Dataset: `3, 5, 7, 9, 11` (Easy). Options: 6, 7, 9, 35. Correct=7. Selected 7. Feedback: "Correct! (3+5+7+9+11) ÷ 5 = 35 ÷ 5 = 7." Auto-advance.

4. **Round 3** — Dataset: `4, 8, 12, 6, 10` (Easy/Medium). Real-world: cricket runs. Options: 6, 8, 12, 40. Correct=8. Selected 40 (wrong — raw sum distractor). Lives: 3→2. Feedback: "Mean = (4+8+12+6+10) ÷ 5 = 8. The middle value (10) is the median." — correctly addresses median-vs-mean misconception. Auto-advance.

5. **Round 4** — Dataset: `12, 18, 24, 15, 21` (Medium, larger values). Options: 15, 18, 21, 90. Correct=18. Selected 18. Feedback: "Correct! (12+18+24+15+21) ÷ 5 = 90 ÷ 5 = 18." Auto-advance.

6. **Round 5** — Dataset: `14, 20, 16, 18, 22, 18` (Medium, n=6, repeated value). Real-world: rainfall mm. Options: 16, 18, 20, 108. Correct=18. Selected 18. Feedback: "Correct! (14+20+16+18+22+18) ÷ 6 = 108 ÷ 6 = 18 mm." Auto-advance.

7. **Round 6** — Dataset: `4, 8, 12, 10, 11` (Medium). Real-world: quiz marks. Options: 9, 10, 11, 45. Correct=9. Selected 45 (wrong — raw sum). Lives: 2→1. Feedback: "Mean = (4+8+12+10+11) ÷ 5 = 9. The middle value (10) is the median." Auto-advance.

8. **Round 7** — Dataset: `3, 3, 7, 9, 3` (Hard, mode=3, repeated values). Options: 3, 5, 7, 25. Correct=5. Mode distractor=3 present. Selected 5. Feedback: "Correct! (3+3+7+9+3) ÷ 5 = 25 ÷ 5 = 5." Auto-advance.

9. **Round 8** — Dataset: `5, 8, 6, 9, 5, 7, 5` (Hard, n=7, mode=5). Real-world: plants per house. Options: 5, 6, 6.4, 45. Correct=6.4 (decimal result). Selected 6.4. Feedback: "Correct! (5+8+6+9+5+7+5) ÷ 7 = 45 ÷ 7 ≈ 6.4 plants." Auto-advance.

10. **Round 9** — Dataset: `6, 9, 6, 15, 9` (Hard). Real-world: spelling test. Options: 6, 9, 11, 15. Correct=9. Selected 9. Feedback: "Correct! (6+9+6+15+9) ÷ 5 = 45 ÷ 5 = 9." Auto-advance to results.

11. **Results screen** — "Well Done! ⭐⭐ Correct Answers: 7/9, Accuracy: 78%, Play Again." Overlay is `position:fixed`, covers full viewport cleanly. Star logic: 7/9 = 2 stars (spec: 6–8/9 = 2★ — PASS). "Play Again" button 46px — PASS.

12. **Play Again** — Returns to start screen. All state fully reset: `data-phase="start"`, lives=3, score=0, currentRound=0, correctAnswers=0. Timer reinitialised per spec. Identical to initial load.

---

## Routing Summary

| Issue | Category | Route | Action |
|-------|----------|-------|--------|
| M-001: Test harness nextRound check fires before DOMContentLoaded | (d) test gap | Test Engineering slot | Defer harness check or use waitFor() for window.nextRound |
| M-002: Results screen missing "rounds completed" metric | (a) gen rule | Gen Quality slot | Add gen rule: results must show rounds completed |
| M-003: aria-atomic absent on feedback element | (a) gen rule | Gen Quality slot | Add gen rule: aria-live feedback must include aria-atomic="true" |
| L-001: FeedbackManager audio_content warnings | (a) gen rule | Gen Quality slot (low priority) | Optional: provide audio_content to playDynamicFeedback() calls |
| L-002: loading.json 404 (Lottie animation) | (c) CDN constraint | Document only | Known constraint, no game fix possible |
