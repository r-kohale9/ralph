## Review: addition-mcq-lives

### Step 1 — Game Understanding

1. **Math concept:** Single-operation addition fact recall (e.g., 3 + 4 = ?)
2. **Core mechanic:** Player sees an addition expression and selects the correct answer from 4 numerically close distractors within 30 seconds.
3. **One round walkthrough:** Timer starts at 30s → player reads "8 + 5" → clicks one of [11, 12, 13, 14] → correct button turns green → 600ms pause → next question loads with timer reset.
4. **States:** Start screen (waiting) → active gameplay → answer feedback (correct / wrong / timeout) → next question or end → victory / game-over transition screen → results screen.

---

### 🔴 Critical · Completeness — Victory and Game Over transition screens absent from endGame flow

**What the spec says:** Section 7 endGame: "6. `showResults(metrics)` (PART-019)" and Section 13 checklist: "Game over screen shown when lives = 0 (with restart option)" and "Victory screen shown when all questions answered with lives remaining."

**Problem:** The endGame step-by-step flow goes directly from metrics calculation to `showResults()`. The victory and game-over transitionScreen.show() calls are mentioned in the checklist but never described in the endGame steps. An implementer following Section 7 literally will skip these screens entirely, jumping straight to the results screen with no context about win/loss.

**Suggested fix:** Add a branching step in the endGame flow before `showResults()`: if lives === 0, show the game-over transition screen (with "Try again!" button that calls restartGame()); if lives > 0, show the victory transition screen (with star count and a "See Results" button). Only after the user interacts should `showResults(metrics)` be called.

---

### ⚠️ Warning · Completeness — restartGame() flow is undefined

**What the spec says:** Section 8 Functions: "`restartGame()` — global — Resets state, recreates timer, starts over."

**Problem:** restartGame() is referenced by the game-over screen ("Try again!" button) but has no step-by-step description anywhere in Section 7. endGame() nulls out `timer` and `visibilityTracker`. Without an explicit restart section, implementers will forget to recreate these components, causing crashes on restart.

**Suggested fix:** Add a "Restart Game (`restartGame`)" subsection in Section 7 with explicit steps: reset all gameState fields, recreate signalCollector, timer, and visibilityTracker, call progressBar.update(0, 3), show #game-screen, and call renderQuestion().

---

### ⚠️ Warning · Completeness — ProgressBar initialized with hardcoded totalRounds: 10 before content is available

**What the spec says:** Section 7 Initialization step 3: "`progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 3 })`"

**Problem:** ProgressBar is created in DOMContentLoaded with totalRounds hardcoded to 10. If injected content has a different number of questions, the progress bar shows "X/10" incorrectly.

**Suggested fix:** Move ProgressBar initialization (or re-initialization) to startGame(), after totalRounds is set from content.questions.length.

---

### ⚠️ Warning · Completeness — Content may be null when startGame() accesses it

**What the spec says:** Section 7 startGame step 4: "Set `totalRounds` from `content.questions.length`" — gameState.content is initialized as `null` in Section 4.

**Problem:** If the user presses "Let's Go!" before game_init postMessage arrives, `gameState.content` is null and accessing `.questions.length` will crash.

**Suggested fix:** Initialize `gameState.content` to `fallbackContent` (not null) at script initialization, so it is always valid when startGame() runs.

---

### Summary

| # | Severity | Category      | Title                                                             |
|---|----------|---------------|-------------------------------------------------------------------|
| 1 | Critical | Completeness  | Victory and Game Over transition screens absent from endGame flow |
| 2 | Warning  | Completeness  | restartGame() flow is undefined                                   |
| 3 | Warning  | Completeness  | ProgressBar initialized with hardcoded totalRounds before content |
| 4 | Warning  | Completeness  | Content may be null when startGame() accesses it                  |

VERDICT: Needs revision — 1 critical, 3 warnings
