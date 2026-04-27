# Pre-Generation Plan: Doubles — Doubling Speed Challenge

**Game ID:** doubles
**Archetype:** Lives Challenge (#3) with speed-game correct-side override
**Bloom:** L1 / L2 (automatic recall of 2× facts)
**Interaction:** P1 Single-Select MCQ (tap one of three pill buttons)
**Rounds:** 15 (Stage 1: R1–5, Stage 2: R6–10, Stage 3: R11–15)
**Lives:** 3 (DARK hearts)
**Timer:** None (global); per-answer response time captured
**PreviewScreen:** YES (PART-039)

---

## 1. Screen Flow

```
         ┌─────────────────────────────────────────────────────────────────┐
         │                  PreviewScreen wrapper (persistent)             │
         │  (header bar + progress-bar slot + transition-slot + gameContent) │
         │                                                                  │
         │   DOMContentLoaded                                               │
         │        │                                                         │
         │        ▼                                                         │
         │   setupGame() ── injectGameHTML() ── renderInitialState() ──    │
         │                                                       previewScreen.show() ─┐
         │                                                                              │
         │                                                            ┌──── Preview ───┐│
         │                                                            │ "Tap on the    ││
         │                                                            │  doubles as    ││
         │                                                            │  fast as       ││
         │                                                            │  possible!"    ││
         │                                                            │ [Skip]         ││
         │                                                            └──────┬─────────┘│
         │                                                                   │ skip/end
         │                                                                   ▼
         │                                                        startGameAfterPreview()
         │                                                                   │
         │                                                                   ▼
         │                ┌─────── TransitionScreen: "Round 1" ──────────┐
         │                │ icon ['🎯']  ·  rounds_sound_effect onMounted │
         │                │ auto-advance after SFX                        │
         │                └───────────────────┬──────────────────────────┘
         │                                    │
         │                                    ▼
         │        ┌──────── Gameplay Round N (data-phase="gameplay") ───────┐
         │        │ progress-bar: roundsCompleted/15, dark hearts: lives     │
         │        │ prompt: "Double of <N>" (large)                          │
         │        │ 3 pill-shaped option buttons in SINGLE horizontal row    │
         │        │ "Next Round" decorative pill bottom-right                │
         │        └─────────────────────┬────────────────────────────────────┘
         │                              │ tap option
         │                              ▼
         │              ┌── Evaluate: tapped === 2 × N ? ──┐
         │              └──────┬──────────────┬────────────┘
         │                  correct       wrong
         │                     │              │
         │                     ▼              ▼
         │        ┌─ Correct path ─┐    ┌─ Wrong path ─────────────────────────┐
         │        │ - all buttons  │    │ - all buttons disable                 │
         │        │   disable      │    │ - tapped flashes red 400ms            │
         │        │ - tapped       │    │ - correct highlights green            │
         │        │   highlights   │    │ - lives -= 1; progressBar.update      │
         │        │   green 350ms  │    │   FIRST                               │
         │        │ - recordAttempt│    │ - recordAttempt(correct:false,        │
         │        │   (correct:t)  │    │   misconception_tag)                  │
         │        │ - progressBar  │    │ - await Promise.all([                 │
         │        │   .update FIRST│    │     sound.play('incorrect...',        │
         │        │ - sound.play   │    │       {sticker: STICKER_WRONG}),      │
         │        │   FIRE-AND-    │    │     setTimeout 1500                   │
         │        │   FORGET (NO   │    │   ])                                  │
         │        │   1500ms dwell)│    │ - fire-and-forget TTS                 │
         │        │ - auto-advance │    │   "Double of N is 2N"                 │
         │        │   ≤400ms       │    │ - if lives===0: showGameOver          │
         │        │                │    │   else auto-advance                   │
         │        └────────┬───────┘    └────────┬──────────────────────────────┘
         │                 │                     │
         │                 ▼                     ▼
         │          ┌───── routing on N / lives ─────────────────────┐
         │          │ if lives===0: Game Over (lives-exhausted path) │
         │          │ elif N == 5:  Stage-summary "Level 2 — Faster!"│
         │          │ elif N == 10: Stage-summary "Level 3 — Speed Up"│
         │          │ elif N < 15:  Round N+1 intro                  │
         │          │ elif N == 15: Victory                          │
         │          └──────────────────┬──────────────────────────────┘
         │                             │
         │                             ▼
         │                   (see Victory / Game Over below)
         │
         │  [Stage Summary] ── "Avg time: X.Xs · Target: <2s"  [Continue] ── Round N+1 intro
         │  [Victory]       ── stars from avgCorrectResponseMs < 2000 / < 3500 / else
         │                     buttons: [Play Again if stars<3, Claim Stars]
         │  [Game Over]     ── subtitle: "Keep practicing — you'll speed up!"
         │                     buttons: [Play Again]
         │  [Motivation]    ── "Ready to improve your score? ⚡" [I'm ready!]
         │  [Stars Collected] "Yay! Stars collected!" 2500ms → postMessage game_exit
         └─────────────────────────────────────────────────────────────────┘
```

**Shape:** Shape 2 Multi-round.

**Changes from canonical default:**
1. **Correct-side feedback is fire-and-forget** (no 1500ms dwell) — speed-game override per spec Warning 1.
2. **Stage summary pauses** after Round 5 and Round 10 (flow-gallery delta: sectioned stages).
3. **Star grading by average response time**, not raw score.
4. **DARK hearts** (game-local CSS filter) over CDN heart strip.

**Entry/exit triggers:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen | `start_screen` | DOMContentLoaded → setupGame() → previewScreen.show() AFTER initial render | skip OR audio-finish → onComplete → startGameAfterPreview() |
| Round N intro | `round_intro` | before each round via transitionScreen.show({ title: 'Round N', onMounted: play rounds_sound_effect }) | SFX complete → hide() → enterGameplay(N) |
| Gameplay Round N | `gameplay` | enterGameplay(N) → renderRound() | option tap |
| Feedback correct | `gameplay` (inline) | correct tap | auto-advance ≤400ms |
| Feedback wrong | `gameplay` (inline) | wrong tap | after awaited SFX → next-round intro OR game-over |
| Stage summary | `round_intro` | after Round 5 or Round 10 correct/wrong resolution | "Continue" button → next-round intro |
| Victory | `results` | after Round 15 feedback resolves | Claim Stars → Stars Collected; Play Again (if stars<3) → Motivation |
| Game Over | `game_over` | lives reach 0 after wrong-SFX dwell | Play Again → Motivation |
| Motivation | `results` (transition) | Play Again on Victory or Game Over | "I'm ready!" → restartGame() |
| Stars Collected | `results` (transition) | Claim Stars on Victory | auto 2500ms → postMessage game_exit → endGame() |

**ProgressBar** (mounted in `#mathai-progress-slot`):
- 15 segments for rounds, 3 heart glyphs for lives.
- `progressBar.update(roundsCompleted, livesRemaining)` called as the FIRST action in both correct-resolution and wrong-resolution handlers (MEMORY.md `progress_bar_round_complete`).
- DARK heart CSS override applied via game-local rule targeting the CDN heart class.

---

## 2. Round-by-Round Breakdown

Every round uses Pattern P1: single-select MCQ with 3 options. Prompt, options, answer, and misconception_tags are copied verbatim from the spec's fallbackContent.

| R | Stage | N (target) | Options | Answer | Primary misconceptions | Target 1st-attempt rate |
|---|-------|------------|---------|--------|------------------------|--------------------------|
| 1 | 1 | 6  | [12, 10, 14] | 12 | off-by-2 both sides         | 85–95% |
| 2 | 1 | 10 | [22, 20, 18] | 20 | off-by-2 both sides         | 85–95% |
| 3 | 1 | 11 | [20, 22, 24] | 22 | off-by-2 both sides         | 85–95% |
| 4 | 1 | 8  | [16, 14, 18] | 16 | off-by-2 both sides         | 85–95% |
| 5 | 1 | 12 | [20, 28, 24] | 24 | off-by-4 both sides         | 85–95% |
| 6 | 2 | 13 | [26, 22, 30] | 26 | off-by-4 both sides         | 70–85% |
| 7 | 2 | 14 | [24, 28, 26] | 28 | off-by-4 under, off-by-2    | 70–85% |
| 8 | 2 | 16 | [32, 30, 34] | 32 | off-by-2 both sides         | 70–85% |
| 9 | 2 | 17 | [30, 34, 36] | 34 | off-by-4 under, off-by-2    | 70–85% |
| 10| 2 | 15 | [30, 25, 35] | 30 | **additive-reasoning-N+10** (25 = 15+10), off-by-5 | 70–85% |
| 11| 3 | 18 | [36, 34, 38] | 36 | off-by-2 both sides         | 55–70% |
| 12| 3 | 19 | [38, 36, 40] | 38 | off-by-2 both sides         | 55–70% |
| 13| 3 | 22 | [42, 44, 46] | 44 | off-by-2 both sides         | 55–70% |
| 14| 3 | 23 | [46, 44, 48] | 46 | off-by-2 both sides         | 55–70% |
| 15| 3 | 25 | [50, 45, 55] | 50 | off-by-5 both sides         | 55–70% |

**Option randomization:** Option position is shuffled at round-render time via Fisher-Yates. The correct-answer index is tracked via comparing button value to `round.answer`, not by index, so tests must use `data-testid="option-<value>"` (VALUE, not positional index) — OR a stable index-based `option-0..option-2` plus the game exposes `window.gameState.correctAnswer` per contract. This plan chooses **index-based `option-0..option-2` data-testid** to match Alfred conventions, with the correct answer VALUE exposed via `gameState.correctAnswer` (GEN-CORRECT-ANSWER-EXPOSURE).

---

## 3. Interaction Logic (Pattern P1 Tap)

**Event type:** `click` on each option button (P1 requirement).

**Universal guards at handler top:**
- `if (!gameState.isActive) return;`
- `if (gameState.isProcessing) return;`
- `if (gameState.gameEnded) return;`

**On tap:**
1. Immediately set `gameState.isProcessing = true` and disable ALL option buttons (add `disabled` attribute + `.disabled` class; `pointer-events: none`).
2. Compute correctness: `const tapped = Number(btn.getAttribute('data-value')); const correct = tapped === gameState.currentRoundData.answer;`.
3. Fire `recordAttempt({ input_of_user: String(tapped), correct, round_number, question_id: 'r<N>_double_of_<targetN>', correct_answer: String(round.answer), response_time_ms, misconception_tag })` BEFORE audio. Misconception tag lookup: `round.misconception_tags[String(tapped)] || null`.
4. Fire `trackEvent('answer_submitted', { round, correct })`.
5. Push response time to `gameState.responseTimes` if correct.
6. Update `gameState.roundsCompleted += 1` (correct OR wrong). Update `gameState.score += 1` if correct; `gameState.lives -= 1` if wrong.
7. Call `syncDOM()` (phase stays `gameplay`).
8. Call `progressBar.update(gameState.roundsCompleted, Math.max(0, gameState.lives))` as the FIRST visual action (MEMORY.md `progress_bar_round_complete`).
9. Apply visual class: `btn.classList.add('option-correct')` on correct, `btn.classList.add('option-wrong')` on wrong + highlight the truly-correct button with `.option-correct`.
10. **Correct branch** (fire-and-forget audio, instant advance):
    ```js
    try { FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }).catch(function(){}); } catch(e){}
    setTimeout(function(){ advanceAfterCorrect(); }, 400); // 400ms lets the green highlight register visually
    ```
11. **Wrong branch** (awaited SFX with 1500ms floor):
    ```js
    await Promise.all([
      safePlaySound('incorrect_sound_effect', { sticker: STICKER_WRONG }),
      new Promise(function(r) { setTimeout(r, 1500); })
    ]);
    // Fire-and-forget TTS explanation
    try { FeedbackManager.playDynamicFeedback({
      audio_content: 'Double of ' + n + ' is ' + (2 * n) + '.',
      subtitle: 'Double of ' + n + ' is ' + (2 * n) + '.',
      sticker: STICKER_WRONG
    }).catch(function(){}); } catch(e){}
    if (gameState.lives <= 0) { showGameOver(); } else { advanceAfterWrong(); }
    ```

**advanceAfterCorrect() / advanceAfterWrong()** share logic:
- If `currentRound === 5` → `showStageSummary(1)` then Round 6 intro on Continue.
- If `currentRound === 10` → `showStageSummary(2)` then Round 11 intro.
- If `currentRound === 15` → `showVictory()`.
- Else → `showRoundIntro(currentRound + 1)`.

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  gameId: 'doubles',
  phase: 'start_screen' | 'round_intro' | 'gameplay' | 'results' | 'game_over',
  currentRound: 0..15,
  totalRounds: 15,
  score: 0..15,
  lives: 0..3,
  totalLives: 3,
  correctAnswer: null | number,
  currentRoundData: null | RoundObject,
  attempts: Attempt[],
  events: TrackedEvent[],
  startTime: null | ms,
  roundStartTime: null | ms,
  responseTimes: ms[],   // correct-only response times
  isActive: boolean,
  isProcessing: boolean,
  gameEnded: boolean,
  content: null | Content,
  stars: 0..3,
  roundsCompleted: 0..15,
  avgResponseTimeMs: 0 | number,
  previewResult: null | { duration },
  duration_data: { startTime, preview[], attempts[], evaluations[], inActiveTime[], totalInactiveTime }
}
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| `start_screen` | DOMContentLoaded | preview (component state) | setupGame(): injectGameHTML, renderInitialState(round 1), previewScreen.show() |
| `start_screen` | preview onComplete | `round_intro` | startGameAfterPreview: startTime, isActive=true; showRoundIntro(1) |
| `round_intro` | rounds SFX complete | `gameplay` | enterGameplay(N) → renderRound() → reset isProcessing=false, attach click handlers |
| `gameplay` | option tap (correct) | `gameplay` (inline correct) | score+1, roundsCompleted+1, responseTimes.push, progressBar.update FIRST, fire-and-forget correct SFX |
| `gameplay` | option tap (wrong, lives>1) | `gameplay` (inline wrong) | roundsCompleted+1, lives-1, progressBar.update FIRST, awaited wrong SFX+1500ms, FAF TTS |
| `gameplay` | option tap (wrong, last life) | `game_over` | same wrong-SFX sequence then showGameOver() |
| `gameplay` (correct, N===5) | after 400ms | stage-summary | showStageSummary(1) |
| `gameplay` (correct/wrong, N===10) | after feedback | stage-summary | showStageSummary(2) |
| `gameplay` (correct/wrong, N===15) | after feedback | `results` | showVictory() |
| `gameplay` (else) | after feedback | `round_intro` | showRoundIntro(N+1) |
| `results` | Claim Stars | (transition: stars_collected) | auto 2500ms → postMessage game_exit → endGame(true) |
| `results` | Play Again (stars<3) | (transition: motivation) | "I'm ready!" → restartGame() |
| `game_over` | Play Again | (transition: motivation) | "I'm ready!" → restartGame() |

---

## 5. Scoring & Progression Logic

- **Points:** `+1` per correct round. Max 15.
- **Lives:** Start 3 (dark hearts). `-1` per wrong answer. At 0 → `showGameOver()`.
- **Timer:** None global. `gameState.roundStartTime` captured at `renderRound()` start; `responseTime = Date.now() - roundStartTime` on tap. Only correct-answer response times are included in the average.
- **Star rating (computed on entry to `results`):**
  - Compute `avgResponseTimeMs = sum(gameState.responseTimes) / gameState.responseTimes.length` (guard `responseTimes.length === 0` → `avgResponseTimeMs = Infinity`).
  - **3 stars** if `avgResponseTimeMs < 2000` AND `gameState.score === 15`.
  - **2 stars** if `avgResponseTimeMs < 3500` AND `gameState.score >= 10`.
  - **1 star** if `gameState.score >= 1`.
  - **0 stars** otherwise (game over with 0 correct).
- **ProgressBar:**
  - 15 segments, 3 hearts (DARK via game-local CSS filter).
  - `progressBar.update(roundsCompleted, livesRemaining)` FIRST in every feedback handler (MEMORY.md).
- **Victory subtitle:** `"You averaged {avgResponseTimeMs/1000}s per double!"` (1-decimal). If `score < 15`: `"You got {score} of 15 correct — average {X.X}s per double."`.

---

## 6. Feedback Patterns

Cross-reference: alfred/skills/feedback/SKILL.md 17 cases + PART-017 rules.

| Event | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|---|---|---|---|---|---|
| Preview | CDN handles | previewAudioText → TTS | Yes (until skip/end) | — | onComplete → startGameAfterPreview |
| Round N intro | `await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_ROUND })` inside onMounted | (none) | No CTA | Yes | transitionScreen.hide → enterGameplay |
| Correct tap | `FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }).catch(...)` | (none — speed game) | Buttons disabled, no audio-blocking | **NO** (fire-and-forget) | setTimeout 400ms → advance |
| Wrong tap (lives>0) | `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_WRONG}), setTimeout(r,1500)])` + `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker: STICKER_WRONG}).catch(...)` | "Double of N is 2N." | Yes (isProcessing=true, buttons disabled) | SFX Yes, TTS fire-and-forget | advance to next intro |
| Wrong tap (last life) | Same as above, THEN showGameOver() | Same | Yes | Yes | showGameOver() |
| Stage 1→2 summary | `onMounted: play rounds_sound_effect` + fire-and-forget TTS | "Average time: X.Xs · Target: under 2s" | CTA visible | No | [Continue] → showRoundIntro(6) |
| Stage 2→3 summary | Same | Same | CTA visible | No | [Continue] → showRoundIntro(11) |
| Victory | Render FIRST → game_complete postMessage BEFORE audio → `await sound.play('victory_sound_effect' OR 'game_complete_sound_effect', {sticker})` → `await FeedbackManager.playDynamicFeedback({...})` | "You averaged X.Xs per double!" | CTA visible | Yes | Claim Stars → stars_collected; Play Again → motivation |
| Game Over | Render FIRST → game_complete postMessage BEFORE audio → `await sound.play('game_complete_sound_effect', {sticker: STICKER_SAD})` → fire-and-forget encouraging TTS | "Keep practicing — you'll speed up!" | CTA visible | Yes SFX, FAF TTS | Play Again → motivation |
| Visibility hidden | VisibilityTracker → sound.pause + stream.pauseAll + preview.pause | — | — | — | overlay shown by PopupComponent (MEMORY: feedback_pause_overlay) |

**Cleanup between rounds (per PART-017 `5e0-CLEANUP-BETWEEN-ROUNDS`):** Every `advanceAfterCorrect`, `advanceAfterWrong`, `showRoundIntro`, `showStageSummary`, `showVictory`, `showGameOver`, `restartGame`, `showMotivation` starts with:
```js
try { FeedbackManager.sound.stopAll(); } catch(e){}
try { FeedbackManager.stream.stopAll(); } catch(e){}
```
BEFORE any gameState mutation.

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })` once in DOMContentLoaded.
- `PreviewScreenComponent({ slotId: 'mathai-preview-slot' })` instantiated in DOMContentLoaded.
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview: false, timerConfig: null, timerInstance: null, onComplete: startGameAfterPreview })` called as LAST step of `setupGame()`.
- `endGame()` calls `previewScreen.destroy()` exactly once.
- `restartGame()` does NOT call `previewScreen.show()` (preview is once per session).
- `VisibilityTracker` wired with `popupProps` + `onInactive` → `FeedbackManager.sound.pause()` + `stream.pauseAll()` + `previewScreen.pause()`; `onResume` → resume.
- `TimerComponent`: NOT used (`timer === null`).
- `ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 15, totalLives: 3 })`. `update(roundsCompleted, livesRemaining)` called FIRST in every feedback handler.
- `FeedbackManager.sound.preload([...])` at init with: `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `victory_sound_effect`, `game_complete_sound_effect`, `tap_sound`.
- `syncDOM()` writes `data-phase`, `data-round`, `data-score`, `data-lives` on `#app` every phase transition (GEN-DATA-LIVES-SYNC, GEN-SYNCDOMSTATE-ALLATTRS).
- **recordAttempt per option tap** (12 fields, PART-009):
  - `input_of_user: String(tappedValue)`
  - `correct: bool`
  - `round_number: gameState.currentRound` (1-indexed)
  - `question_id: 'r' + N + '_double_of_' + targetN`
  - `correct_answer: String(2 * targetN)`
  - `response_time_ms: Date.now() - roundStartTime`
  - `misconception_tag: round.misconception_tags[String(tappedValue)] || null`
  - `difficulty_level: round.stage`
  - `is_retry: false`
  - `metadata: { n: targetN, stage: round.stage }`
- **game_complete postMessage** fires exactly once on entry to `results` OR `game_over`, BEFORE audio (GEN-PM-DUAL-PATH):
  ```
  { type: 'game_complete',
    data: { metrics: { accuracy, time, stars, attempts, duration_data, totalLives: 3,
                       livesRemaining, avgResponseTime, tries }, completedAt, previewResult },
    payload: { score, totalQuestions: 15, stars, accuracy, timeSpent, avgResponseTime, livesRemaining } }
  ```
- **TransitionScreen usage** (PART-024; `stars` and `icons` are mutually exclusive):
  - **Round N intro:** `{ title: 'Round ' + N, icons: ['🎯'], buttons: [], onMounted: play rounds_sound_effect → hide → enterGameplay }`.
  - **Stage summary:** `{ title: 'Level ' + (stage+1) + ' — ' + (stage===1 ? 'Faster!' : 'Speed Up!'), subtitle: 'Average time: ' + fmt(avg) + 's · Target: under 2s', icons: ['⚡'], buttons: [{text: 'Continue', type: 'primary', action: () => showRoundIntro(next)}], onMounted: play rounds_sound_effect }`.
  - **Victory:** `{ title: 'Victory 🎉', subtitle: victorySubtitle, stars, persist: true, buttons: [Play Again if stars<3, Claim Stars], onMounted: play victory/game_complete SFX → FAF TTS }`. Do NOT pass `icons`.
  - **Game Over:** `{ title: 'Game Over', subtitle: "Keep practicing — you'll speed up!", icons: ['💔'], buttons: [{text: 'Play Again', type: 'primary', action: showMotivation}], onMounted: play game_complete_sound_effect }`.
  - **Motivation:** `{ title: 'Ready to improve your score? ⚡', icons: ['⚡'], buttons: [{text: "I'm ready! 🙌", type: 'primary', action: restartGame}], onMounted: play rounds_sound_effect }`.
  - **Stars Collected:** `{ title: 'Yay! 🎉\nStars collected!', styles: { title: { whiteSpace: 'pre-line' } }, onMounted: play victory_sound_effect }` → setTimeout 2500 → postMessage game_exit → endGame(true).
- **data-testid attributes:**
  - Every option button: `option-0`, `option-1`, `option-2` (index-based, stable).
  - "Next Round" decorative button: `btn-next-round` (no-op in v1).
  - Play Again button inside Game Over / Motivation: `btn-play-again`.
  - Claim Stars: `claim-stars`.
  - Restart (alias for Play Again on Game Over): same `btn-play-again`.

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen (data-phase="start_screen")

```
+-------------------------------------+
|  [avatar] Doubles — Speed     0 / 15 |
+-------------------------------------+
|   [audio countdown bar]             |
+-------------------------------------+
|                                     |
|  ┌─────────────────────────────┐   |
|  │ Tap on the doubles as fast  │   |
|  │ as possible!                │   |
|  │                             │   |
|  │ You get 3 stars for         │   |
|  │ doubling each number        │   |
|  │ within 2 seconds!           │   |
|  └─────────────────────────────┘   |
|                                     |
|           [ ▶ Skip ]                |
+-------------------------------------+
```

### 8.2 Round N intro (data-phase="round_intro")

```
+-------------------------------------+
| [header]  Round N/15    ❤️🖤🖤  ★ 0  |
+-------------------------------------+
| [progress: ▓░░░░░░░░░░░░░░]        |
+-------------------------------------+
|                                     |
|             [🎯]                    |
|          Round N                    |
|                                     |
|        (auto-advance)               |
|                                     |
+-------------------------------------+
```

### 8.3 Gameplay (data-phase="gameplay")

```
+--------------------------------------+
| [header]  Round 3/15   ❤️❤️❤️  ★ 0   |
+--------------------------------------+
| [progress: ▓▓░░░░░░░░░░░░░]          |
+--------------------------------------+
|                                      |
|           Double of                  |
|                                      |
|              11                      |
|                                      |
|     ┌────┐  ┌────┐  ┌────┐           |
|     │ 20 │  │ 22 │  │ 24 │           |
|     └────┘  └────┘  └────┘           |
|                                      |
|                                      |
|                      ┌─────────┐     |
|                      │ NEXT ▶  │     |
|                      └─────────┘     |
+--------------------------------------+
```

### 8.4 Victory (data-phase="results")

```
+-------------------------------------+
| [header]  15/15   ❤️❤️❤️   ★ 3       |
+-------------------------------------+
| [progress: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 15/15]   |
+-------------------------------------+
|                                     |
|         ★  ★  ★                     |
|                                     |
|          Victory 🎉                 |
|  You averaged 1.6s per double!      |
|                                     |
|   [ Play Again ]  [ Claim Stars ]   |
+-------------------------------------+
```

### 8.5 Game Over (data-phase="game_over")

```
+-------------------------------------+
| [header]  6/15   🖤🖤🖤   ★ 0        |
+-------------------------------------+
|                                     |
|             [💔]                    |
|          Game Over                  |
|  Keep practicing — you'll speed up! |
|                                     |
|        [ Play Again ]               |
+-------------------------------------+
```

---

## 9. Round Presentation Sequence (within gameplay screen)

Every round:
1. **Prompt render** — "Double of" label + target number N (large, bold, centered).
2. **Options render** — three pill buttons in a single horizontal row (`.option-row` with `display: flex; justify-content: space-between`).
3. **Instructions** — NOT repeated; owned by PreviewScreen per PART-039.
4. **Input unblock** — `isProcessing = false`; buttons become tappable; `roundStartTime = Date.now()`.

---

## 10. Spec Ambiguities Resolved

| Ambiguity | Planner resolution | Rationale |
|---|---|---|
| Correct SFX fire-and-forget vs awaited | **Fire-and-forget** on correct; awaited 1500ms floor on wrong | Spec Warning 1 — "zero delay" for correct is spec-mandated; wrong retains PART-017 dwell |
| Dark hearts implementation | **CDN heart strip + game-local CSS filter** (no custom hearts row) | Validator `5e0-LIVES-DUP-FORBIDDEN` forbids custom hearts; filter is passive |
| "Next Round" button role | **Decorative no-op pill** bottom-right, `data-testid="btn-next-round"` | Spec Warning 3; auto-advance is the sole progression mechanism |
| Stage summary text | **"Level N — Faster!" / "Speed Up!" + "Average time: X.Xs · Target: under 2s"** | Matches spec feedback table; X.X is live-computed |
| Game Over copy | **"Keep practicing — you'll speed up!"** | Spec feedback constraint 15 (encouraging, not punitive) |
| Star thresholds with incomplete play | **3-star requires score===15; 2-star requires score>=10** | Avoids awarding 3 stars on a 5-correct-with-sub-2s-average partial game |

---

## 11. Cross-Validation

- Every screen in §1 has a wireframe in §8 (Preview, Round intro, Gameplay, Stage Summary [not wireframed separately — uses TransitionScreen with subtitle], Victory, Game Over, Motivation, Stars Collected).
- Every feedback moment in §6 corresponds to a phase transition in §4.
- `gameState.score` counts correct answers; `gameState.responseTimes` collects only correct response times; stars derived from both.
- `progressBar.update(roundsCompleted, livesRemaining)` is FIRST action in every feedback handler (§3, §5, §6).
- `recordAttempt` fires exactly once per option tap, BEFORE audio (§3, §7).
- `game_complete` fires exactly once on entry to `results` OR `game_over`, BEFORE audio (§7 — GEN-PM-DUAL-PATH).
- Transition screens follow PART-024 contract; `stars` and `icons` mutually exclusive (§7).
