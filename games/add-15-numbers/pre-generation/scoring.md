# Scoring: Add 15 Numbers

## Points

| Action | Points | Notes |
|--------|--------|-------|
| Correct MCQ tap | +1 | Per round. Max 1 per round. |
| Wrong MCQ tap | 0 | No point penalty on points; costs 1 life instead. |
| Timeout (no tap in 15s) | 0 | Treated as wrong — 0 points, -1 life. |
| Grid tile strike/unstrike | 0 | Visual aid only; does not affect score, lives, or round state. |

## Formula

```
score = count of rounds where student tapped the correct MCQ within 15s
maxScore = 5  (total rounds; creator-explicit)
percentage = (score / maxScore) * 100
```

No partial credit. A round yields 1 or 0 — no fractional points.

## Star Thresholds

This game uses **lives-based** star thresholds, NOT percentage-based (spec defaults applied: matches shipped `addition-mcq-lives` convention).

| Stars | Threshold | Displayed as |
|-------|-----------|-------------|
| 3 stars | All 5 rounds attempted AND `lives === 3` at end (zero wrong, zero timeouts) | ⭐⭐⭐ |
| 2 stars | All 5 rounds attempted AND `lives === 2` at end | ⭐⭐☆ |
| 1 star | All 5 rounds attempted AND `lives === 1` at end | ⭐☆☆ |
| 0 stars | `lives` reached 0 before round 5 completed (Game Over path, never reaches Victory) | ☆☆☆ (via Game Over screen, not Victory) |

**Derivation:** `lives` starts at 3; every wrong or timeout decrements by 1. Therefore number of wrong+timeout events = `3 - lives` at end. So 3★ = 0 wrong, 2★ = 1 wrong, 1★ = 2 wrong. 3 wrongs triggers Game Over mid-session (lives=0) → 0 stars via Game Over branch. All 5 rounds MUST be attempted for any non-zero star count.

## Lives

| Parameter | Value |
|-----------|-------|
| Starting lives | 3 |
| Lives lost per wrong MCQ | 1 |
| Lives lost per timer timeout | 1 |
| Lives lost per grid tile strike | 0 (tile taps do not cost lives) |
| Game over condition | `lives === 0` |
| Lives display | 3 heart icons in the ProgressBarComponent (PART-023) at the top of every non-preview screen, left of the round counter |
| Life loss animation | `.heart-break` 600ms on the just-lost heart, fired when `progressBar.update(currentRound, lives)` runs FIRST in the round-complete handler |
| Lives across restart | Reset to 3 on `motivation` CTA tap (before routing to Round 1 intro) |

## Progress Bar

| Parameter | Value |
|-----------|-------|
| Component | PART-023 ProgressBarComponent, driven by ScreenLayout |
| Tracks | `currentRound / totalRounds` where `totalRounds = 5`, PLUS 3 heart icons |
| Position | **Top of game body** — below the fixed preview header (which contains the timer), above `#gameContent`. Visible on every screen EXCEPT `preview`. Do NOT place at the bottom. |
| Style | Filled bar, left-to-right, with heart row |
| Initial state | `0/5`, 3 hearts full — on welcome screen |
| Updates per round | `progressBar.update(currentRound, lives)` fires as the FIRST action in the round-complete handler, BEFORE the awaited correct/wrong SFX, BEFORE `nextRound()`, BEFORE `endGame()`. Per MEMORY.md `progress_bar_round_complete`: omitting this ordering causes the final-round Victory screen to show 4/5 instead of 5/5. |
| On Game Over | Progress bar reflects last attempted round (e.g. `2/5`), 0 hearts |
| On Victory | Progress bar reads `5/5` with remaining hearts (reflects star tier) |
| On restart (motivation CTA) | Resets to `0/5`, 3 hearts full as soon as round 1 renders |

## Timer (PART-006)

| Parameter | Value |
|-----------|-------|
| Duration per round | 15000 ms (15 seconds — creator-explicit) |
| Mount | `new TimerComponent({container: '#timer-container', duration: 15000, onTimeout: handleTimeout})` |
| DOM location | `#timer-container` mounted INSIDE `.mathai-preview-header-center` (MEMORY.md `timer_preview_integration`). Component inline 320x41 styles overridden to fit the header. `#previewTimerText` is emptied and hidden so only the timer bar shows. |
| Visual | Shrinking horizontal bar + digital "15s" → "0s" countdown text |
| Start | On `gameplay` reveal (after 350ms fade-in). TimerComponent.start() |
| Pause triggers | (a) MCQ tap → `TimerComponent.pause()`; (b) TimerComponent.onTimeout fires at 0 → treated as wrong; (c) Tab visibility hidden → VisibilityTracker pauses timer + audio; (d) Tile taps do NOT pause. |
| Reset | On each new round entry via `TimerComponent.reset()` then `TimerComponent.start()` |
| Timeout action | `handleTimeout()` runs the wrong-path handler (step 7 in round-flow.md) — life decrement, correct reveal, incorrect SFX awaited, fire-and-forget TTS "Time's up! The sum was <correctSum>" |

## Average Time Tracking

| Parameter | Value |
|-----------|-------|
| Storage | `gameState.responseTimes = []` (array of ms values, one per round completed or timed-out) |
| Per-round capture | At MCQ tap: `gameState.responseTimes.push(Date.now() - gameState.roundStartTime)`. At timeout: `gameState.responseTimes.push(15000)`. |
| Per-round display | On `round_complete_interstitial` title: `"Average time: " + (avg/1000).toFixed(1) + "s"` where `avg = sum(responseTimes) / responseTimes.length`. |
| End-of-game display | On Victory subtitle: `"You completed all 5 rounds! Average time: " + avgTime.toFixed(1) + "s"`. |

## Data Contract Fields

The `game_complete` postMessage fires BEFORE the Victory or Game Over screen audio (feedback/SKILL.md CASE 11/12).

| Field | Source | Example value (Victory 2★ scenario, avg 10.2s) | Example value (Game Over after R2) |
|-------|--------|-----------------------------------------------|-----------------------------------|
| score | `gameState.score` | 4 (4 correct out of 5) | 1 (1 correct before lives=0) |
| totalQuestions | `5` (constant) | 5 | 5 |
| stars | `gameState.stars` | 2 | 0 |
| accuracy | `(score / 5) * 100` | 80 | 20 |
| timeSpent | `Date.now() - gameState.startTime` | 78000 (roughly 5 × ~15s + intros/feedback) | 32000 |
| avgResponseTime | `sum(responseTimes) / responseTimes.length` | 10200 (ms) | 13500 (ms) |
| livesRemaining | `gameState.lives` | 2 | 0 |

```js
window.parent.postMessage({
  type: 'game_complete',
  payload: {
    score: gameState.score,
    totalQuestions: 5,
    stars: gameState.stars,
    accuracy: (gameState.score / 5) * 100,
    timeSpent: Date.now() - gameState.startTime,
    avgResponseTime: gameState.responseTimes.reduce((a,b)=>a+b,0) / gameState.responseTimes.length,
    livesRemaining: gameState.lives
  }
}, '*');
```

`game_exit` postMessage fires from `stars_collected` after its 2500ms auto-hide:

```js
window.parent.postMessage({ type: 'game_exit' }, '*');
```

## recordAttempt schema (per-round)

Fired once per round after the MCQ tap or timeout (inside the round-complete handler, after `progressBar.update()` and after `await <short SFX>`).

| Field | Source | Example value |
|-------|--------|---------------|
| round | `gameState.currentRound` | 3 |
| correctAnswer | `rounds[N-1].correctSum` | 102 |
| userAnswer | tappedValue or `null` on timeout | 99 |
| isCorrect | `String(userAnswer).trim() === String(correctAnswer).trim()` | false |
| responseTime | `Date.now() - gameState.roundStartTime` (or 15000 on timeout) | 13500 |
| misconceptionTag | if wrong MCQ: `rounds[N-1].misconception_tags[String(userAnswer)]`; else null | "MISC-ADD-01" |
| livesAfter | `gameState.lives` (after this round's decrement if any) | 2 |

## Star assignment pseudocode

```js
function assignStars() {
  if (gameState.lives === 0) {
    gameState.stars = 0;
    // goes to Game Over, not Victory
    return 0;
  }
  // At this point, all 5 rounds were attempted and lives >= 1
  if (gameState.lives === 3) { gameState.stars = 3; return 3; }
  if (gameState.lives === 2) { gameState.stars = 2; return 2; }
  if (gameState.lives === 1) { gameState.stars = 1; return 1; }
  return 0; // unreachable
}
```
