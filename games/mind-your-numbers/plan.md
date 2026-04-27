# Pre-Generation Plan: Mind Your Numbers

**Game ID:** mind-your-numbers
**Archetype:** Puzzle (Pattern Recognition) — Shape 1 (Multi-round with Lives + Timer)
**Bloom:** L4 Analyze
**Interaction:** P7 Text/Number Input (numeric only) — mandatory companion `p07-input-behaviors.md`
**Rounds:** 3 (distinct arithmetic rule per round)
**Lives:** 3
**Timer:** 60 s per round
**PreviewScreen:** YES (mandatory per PART-039)

---

## 1. Screen Flow

```
+---------------------------------------------------------------+
|  PreviewScreen wrapper (persistent: header bar + scroll area   |
|                          + progress-bar slot)                  |
|                                                                |
|  DOMContentLoaded                                              |
|     |                                                          |
|     v                                                          |
|  setupGame() -- renderInitialState() -- previewScreen.show()   |
|                                                                |
|                                            +---- preview state |
|                                            |    * instruction  |
|                                            |    * skip / audio |
|                                            +----+--------------+
|                                                 | skip / audio-end
|                                                 v
|                                        startGameAfterPreview()
|                                                 |
|                                                 v
|            +-------- TransitionScreen: "Round N" (N=1..3) -----+
|            |  title "Round N"   sticker STICKER_ROUND          |
|            |  onMounted: sound 'rounds_sound_effect'           |
|            |  auto-advance after SFX                           |
|            +---------------------+-----------------------------+
|                                  | auto
|                                  v
|  +--------- Gameplay Round N (data-phase="gameplay") ---------+
|  |  persistent preview header  ProgressBar (10 segments)       |
|  |  Instruction: "Figure out the pattern..." (fixed copy)      |
|  |  3 clusters (SVG): 2 top-row examples + 1 bottom target     |
|  |  Number input (type="text", inputmode="numeric")            |
|  |  CHECK button (disabled when input empty)                    |
|  |  60 s timer (in header via TimerComponent if available;      |
|  |               else inline countdown)                          |
|  +----------+--------------------------------------------------+
|             | Enter or tap CHECK (input non-empty)
|             v
|  +--- Validator: parseInt(input) === round.answer -----+
|  +----------+------------------------------------------+
|    correct                    wrong (or timeout)
|     |                          |
|     v                          v
|  +-- Correct feedback --+   +-- Wrong feedback --+
|  | input flashes green  |   | input flashes red  |
|  | firstCheckSolves++   |   | reveal "Correct    |
|  | await SFX + sticker  |   |  answer: X" label  |
|  | FAF TTS              |   | lives--            |
|  | advance after 1500ms |   | await SFX + sticker|
|  +-----------+----------+   | FAF TTS            |
|              |              +--+-----------------+
|              |                 |
|              v                 +-- lives > 0 -> advance
|     +--- routing ---+          +-- lives == 0 -> Game Over
|     | if N<3 -> N+1 |                         |
|     | if N=3 -> Victory                       |
|     +-----+---------+                         |
|           |                                   |
|   N<3 v                  N==3 v                 v
| (loop to Round N+1       +------ Victory -------+
|  intro transition)       | stars 0..3            |
|                          | subtitle X of 3       |
|                          +---+-------+-----------+
|                              |       |
|                          stars<3  stars>0
|                              |       |
|                              v       v
|                         Motivation  Stars Collected
|                         +Play Again +Claim Stars
|                                            |
|                                            v
|                                 postMessage game_exit
+---------------------------------------------------------------+
```

**Shape:** Shape 1 Multi-round with Lives + Timer.

**Changes from canonical default:** None material. Uses the canonical MCQ-lives flow with the submit transition driven by a CHECK button (Enter key also triggers) instead of an MCQ option-tap.

**Entry/exit triggers table:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen | `start_screen` | DOMContentLoaded -> setupGame() -> previewScreen.show() AFTER initial render | skip / audio-finish / fallback -> startGameAfterPreview() |
| Round N intro | `round_intro` | before each round via transitionScreen.show({title:'Round N',...}) | auto-advance after rounds_sound_effect |
| Gameplay Round N | `gameplay` | transition auto-complete -> renderRound() | CHECK tap or Enter with non-empty input -> validator; OR timer=0 -> wrong |
| Inline Feedback (correct) | `gameplay` | validator pass | auto-advance ~1500ms -> next round transition or Victory |
| Inline Feedback (wrong) | `gameplay` | validator fail | auto-advance ~1500ms -> next round (lives>0) or Game Over (lives==0) |
| Victory | `results` | Round 3 solved (win path) OR all rounds complete with lives>0 | Claim Stars -> Stars Collected; Play Again (stars<3) -> Motivation |
| Game Over | `results` | lives==0 after wrong answer | Play Again -> Motivation -> restart |
| Motivation | `results` (transition) | Play Again on Victory stars<3 OR Game Over | I'm ready -> restartGame() |
| Stars Collected | `results` (transition) | Claim Stars on Victory | auto 2500ms -> postMessage game_exit |

**ProgressBar:**
- 10 discrete segments, totalRounds=3 mapped onto it — after each correct round, bump by `Math.ceil(10 / 3) = 4`, with final Victory clamped to 10.
- Simpler: 3 segments (totalRounds=3), matches logic-seat pattern. Use **3 segments**, 1 bump per round-complete.
- `progressBar.update(roundsCompleted, lives)` is the FIRST action in round-complete handler per MEMORY.md rule.

---

## 2. Round-by-Round Breakdown

| R | Rule | Ex1 outers / centre | Ex2 outers / centre | Target outers / ANSWER | Misconceptions |
|---|------|---------------------|---------------------|------------------------|---------------|
| 1 | product-of-pairs (top & bottom rows) | 2,6,4,3 / **12** | 4,4,8,2 / **16** | 9,2,6,3 / **18** | sum-not-product, wrong-pairing |
| 2 | sum of all four | 1,2,3,4 / **10** | 2,5,1,4 / **12** | 3,3,4,2 / **12** | product-instead-of-sum, sum-three-of-four |
| 3 | max − min | 9,3,2,7 / **7** | 10,4,6,2 / **8** | 9,5,1,6 / **8** | sum-not-range, first-minus-second |

**Answer validator:**

```
function validate(input, roundAnswer):
  trimmed = String(input).trim()
  if trimmed === '': return { pass: false, reason: 'empty' }
  parsed = parseInt(trimmed, 10)
  if isNaN(parsed): return { pass: false, reason: 'invalid' }
  return { pass: parsed === roundAnswer, typed: parsed }
```

Validator is deterministic, idempotent, and never mutates state.

---

## 3. Input Interaction Logic (Pattern P7 + p07-input-behaviors)

**Input element:**

```html
<span class="input-wrap">
  <input type="text"
         inputmode="numeric"
         pattern="[0-9]*"
         id="answer-input"
         data-testid="answer-input"
         autocomplete="off"
         placeholder="Type here"
         maxlength="4">
</span>
```

- `type="text"` + `inputmode="numeric"` (not `type="number"` — PART-033 / mobile rule 14).
- `font-size: 16px` to prevent iOS zoom.
- Wrapper span for reliable `scrollIntoView` on iOS.
- Initial width `MIN_W = 72px`, grows to `MAX_W = 300px`.
- `font-variant-numeric: tabular-nums` — for predictable `CHAR_W`.

**Event handlers:**

- **`click` on input** → focusAndScroll() — focus + scrollIntoView({behavior:'smooth', block:'center'}) after 50ms.
- **`focus` on input** → re-scroll (tab / programmatic focus).
- **`input` event** → numeric filter (strip non-digits), update width, clear transient feedback classes.
- **`keydown` Enter** → `preventDefault()`, call `handleSubmit()`.
- **CHECK button click** → `handleSubmit()`.
- **`visualViewport.resize`** → re-scroll input into view if it's active element.

**Width growth:**

```
var MIN_W = 72, MAX_W = 300, CHAR_W = 22, BASE_PADDING = 28;
function updateInputWidth() {
  var len = input.value.length;
  var target = len === 0 ? MIN_W
             : Math.min(MAX_W, Math.max(MIN_W, len * CHAR_W + BASE_PADDING));
  input.style.width = target + 'px';
}
```

**Submit handler outline:**

```
async function handleSubmit() {
  if (!gameState.isActive || gameState.isProcessing || gameState.gameEnded) return;
  var val = input.value.trim();
  if (!val) return;                                 // CHECK disabled visually, but double-guard
  gameState.isProcessing = true;
  input.blur();                                     // dismiss keyboard
  var round = getRounds()[gameState.currentRound];
  var typed = parseInt(val, 10);
  var isCorrect = !isNaN(typed) && typed === round.answer;

  // Visual feedback
  input.classList.add(isCorrect ? 'input-correct' : 'input-wrong');
  if (!isCorrect) showCorrectLabel(round.answer);

  // State + data
  if (isCorrect) { gameState.score++; gameState.firstCheckSolves++; }
  else { gameState.lives = Math.max(0, gameState.lives - 1); }
  syncDOM();
  if (progressBar) progressBar.update(gameState.roundsCompleted + (isCorrect ? 1 : 0), gameState.lives);

  recordAttempt({
    input_of_user: val,
    correct: isCorrect,
    round_number: round.round,
    question_id: 'r' + round.round + '_' + round.rule,
    correct_answer: round.answer,
    misconception_tag: isCorrect ? null : deriveMisconception(round, typed)
  });
  trackEvent('answer_submitted', { round: round.round, isCorrect: isCorrect });

  // Audio — single-step single-answer path
  try {
    if (isCorrect) {
      await Promise.all([
        FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }),
        new Promise(function(r) { setTimeout(r, 1500); })
      ]);
      FeedbackManager.playDynamicFeedback({
        audio_content: buildCorrectVO(round),
        subtitle: buildCorrectVO(round),
        sticker: STICKER_CORRECT
      }).catch(function() {});
    } else {
      if (gameState.lives <= 0) {
        // LAST-LIFE: play wrong SFX first (CRITICAL — PART-017)
        await Promise.all([
          FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_WRONG }),
          new Promise(function(r) { setTimeout(r, 1500); })
        ]);
        gameState.isProcessing = false;
        endGame(false); showGameOver();
        return;
      }
      await Promise.all([
        FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_WRONG }),
        new Promise(function(r) { setTimeout(r, 1500); })
      ]);
      FeedbackManager.playDynamicFeedback({
        audio_content: 'Not quite. The correct answer is ' + round.answer + '.',
        subtitle: 'The correct answer is ' + round.answer + '.',
        sticker: STICKER_WRONG
      }).catch(function() {});
    }
  } catch (e) {}

  input.value = '';
  input.classList.remove('input-correct', 'input-wrong');
  hideCorrectLabel();
  updateInputWidth();
  gameState.roundsCompleted += 1;
  gameState.currentRound += 1;
  if (gameState.currentRound >= gameState.totalRounds) {
    showVictory();
  } else {
    showRoundIntro(gameState.currentRound + 1);
  }
  // isProcessing=false is reset by renderRound() per p07 doctrine.
}
```

**CRITICAL:**
- `try { FeedbackManager.sound.stopAll(); } catch (e) {} try { FeedbackManager.stream.stopAll(); } catch (e) {}` at the top of `showRoundIntro`, `showVictory`, `showGameOver`, `restartGame` (per PART-017 cleanup-between-rounds rule).
- `isProcessing=true` is set BEFORE any await.
- `recordAttempt` is called BEFORE audio.
- `game_complete` postMessage is called BEFORE end-screen audio on both victory and game-over paths (CRITICAL — data-contract).

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  gameId: 'mind-your-numbers',
  phase: 'start_screen' | 'round_intro' | 'gameplay' | 'results',
  currentRound: 0,            // 0-based (0..2)
  totalRounds: 3,
  totalLives: 3,
  lives: 3,
  score: 0,
  correctAnswer: null,        // set per round to round.answer
  firstCheckSolves: 0,
  roundsCompleted: 0,
  attempts: [],
  events: [],
  stars: 0,
  isActive: false,
  isProcessing: false,
  gameEnded: false,
  content: null,               // patched from game_init postMessage
  startTime: null,
  roundStartTime: null,
  responseTimes: [],
  previewResult: null,
  currentRoundData: null,
  roundTimerId: null,
  roundTimerRemainingMs: 60000,
  duration_data: { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0 }
};
window.gameState = gameState;
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| start_screen | DOMContentLoaded | preview | setupGame() injects scaffold, previewScreen.show() |
| start_screen | preview onComplete | round_intro | startGameAfterPreview(): isActive=true, startTime, show Round 1 transition |
| round_intro | rounds SFX finishes | gameplay | renderRound() — reset input, start timer, isProcessing=false |
| gameplay | Enter/CHECK with value | gameplay (inline feedback) | validator; recordAttempt; update lives/firstCheckSolves; audio |
| gameplay | timer=0 | gameplay (inline wrong) | synthetic wrong answer (input left empty) |
| feedback_correct | audio+1500ms | round_intro OR results | if currentRound<2: showRoundIntro(N+1); else showVictory() |
| feedback_wrong (lives>0) | audio+1500ms | round_intro OR results | same routing as correct, but score/firstCheckSolves not incremented |
| feedback_wrong (lives==0) | wrong SFX+1500ms | results | showGameOver() |
| results (victory) | Claim Stars | results (stars_collected transition) | auto 2500ms -> postMessage game_exit |
| results | Play Again / I'm ready | round_intro | restartGame(): reset all state, roundIndex=0, lives=3 |

---

## 5. Scoring & Progression Logic

- **Points:** +1 per round answered correctly on first CHECK (max 3).
- **Lives:** start 3; each wrong costs 1; 0 -> game-over.
- **Timer:** 60 s per round (reset on renderRound). Visible in header if TimerComponent slot supports it; else inline countdown "00:XX". Timer expiry treated as wrong.
- **Star rating** (pure function of firstCheckSolves):
  - 3★ = firstCheckSolves === 3
  - 2★ = firstCheckSolves === 2
  - 1★ = firstCheckSolves === 1
  - 0★ = firstCheckSolves === 0
- **ProgressBar:** 3 segments. `progressBar.update(roundsCompleted, lives)` as FIRST action in round-complete handler. Reset on restart.
- **Victory subtitle:** "You solved ${firstCheckSolves} of 3 on the first try!"
- **Game-over subtitle:** "Great effort — you solved ${firstCheckSolves} of ${currentRound} so far."

---

## 6. Feedback Patterns

Cross-reference: alfred/skills/feedback/SKILL.md + PART-017.

| Event | Trigger | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|---|---|---|---|---|---|---|
| Input focus / type | input event | — | — | No | — | border purple, width auto-grow |
| Round N intro | transition mount | `await safePlaySound('rounds_sound_effect', {sticker: STICKER_ROUND})` | — | No CTA | Yes | auto-advance to gameplay |
| CHECK correct | `pass=true` | `isProcessing=true` -> input green -> `await Promise.all([sound.play('correct_sound_effect',{sticker:STICKER_CORRECT}), setTimeout 1500ms])` -> FAF `playDynamicFeedback({audio_content, subtitle, sticker})` | "You found the pattern!" (dynamic per round) | Yes | Yes SFX + FAF TTS | advance after 1500ms |
| CHECK wrong (lives>0) | `pass=false` | `isProcessing=true` -> input red + reveal label -> `await Promise.all([sound.play('incorrect_sound_effect',{sticker:STICKER_WRONG}), setTimeout 1500ms])` -> FAF TTS | "The correct answer is X." | Yes | Yes SFX + FAF TTS | advance after 1500ms |
| CHECK wrong (lives==0) | `pass=false` AND `lives==0` | same SFX path (MUST NOT skip wrong SFX — PART-017 last-life rule) | same subtitle | Yes | Yes | showGameOver() |
| Victory | all 3 rounds complete | screen first -> `game_complete` postMessage -> `await safePlaySound('victory_sound_effect',{sticker:STICKER_VICTORY})` -> `await playDynamicFeedback(victoryVO)` | dynamic per star count | CTA visible | Yes (sequential, CTA interrupts via stopAll) | Claim Stars / Play Again |
| Game Over | lives==0 | screen first -> `game_complete` postMessage -> `await safePlaySound('incorrect_sound_effect',{sticker:STICKER_SAD})` -> `await playDynamicFeedback(goVO)` | "Great effort. Let's try again!" | CTA visible | Yes | Play Again |
| Visibility hidden | visibilitychange | VisibilityTracker handles pause overlay; pause all audio + timer | — | — | — | — |

**Subtitle examples (3 correct + 3 wrong):**
- Correct R1: "Nice! 2 × 6 = 12 and 4 × 3 = 12, so 9 × 2 = 6 × 3 = 18."
- Correct R2: "That's it! 3 + 3 + 4 + 2 = 12."
- Correct R3: "Exactly! The largest is 9, the smallest is 1, so 9 − 1 = 8."
- Wrong R1: "Not quite. The correct answer is 18."
- Wrong R2: "Not quite. The correct answer is 12."
- Wrong R3: "Not quite. The correct answer is 8."

**Animations:**
| Animation | Trigger | CSS class | Duration |
|---|---|---|---|
| Input flash green | CHECK pass | `.input-correct` | 400ms |
| Input flash red | CHECK fail | `.input-wrong` | 400ms (shake) |
| Fade-in new round | renderRound | `.fade-in` | 350ms |

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true, progressBar: true } })` called once at init.
- `previewScreen.show()` called at end of `setupGame()` AFTER Round 1 scaffold rendered in background. `timerConfig: null, timerInstance: null` (per-round timer is inline, not the PreviewScreen's header timer — simpler + avoids fighting MEMORY `timer_preview_integration`).
- `endGame()` calls `previewScreen.destroy()` exactly once.
- `VisibilityTracker` wired; pause overlay owned by VisibilityTracker's PopupComponent (MEMORY `feedback_pause_overlay`).
- `progressBar.update(roundsCompleted, lives)` as FIRST action in round-complete handler (MEMORY `progress_bar_round_complete`).
- `FeedbackManager` handles ALL audio. Preload: `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `victory_sound_effect`, `game_complete_sound_effect`, `tap_sound`.
- `syncDOM()` on every phase transition — writes `data-phase`, `data-score`, `data-round`, `data-lives`, `data-stars`.
- **`recordAttempt` per CHECK** with 12 fields.
- **`game_complete` fires exactly once** on transition to `results`, BEFORE end-game audio, on BOTH victory and game-over paths.
- **data-testid attributes:** `answer-input`, `btn-check`, `cluster-0/1/2`, `correct-answer-label`, `claim-stars`, `im-ready`, `play-again`, `progress-seg-<i>`.

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen (data-phase="start_screen", component state = preview)

```
+-------------------------------------+
|  [header] Mind Your Numbers          |
|                         0 / 3   0   |
+-------------------------------------+
|                                     |
|      +------------------------+     |
|      | Figure out the pattern |     |
|      | in this image          |     |
|      |                        |     |
|      | Type the number that   |     |
|      | should replace the     |     |
|      | question mark to       |     |
|      | complete the pattern.  |     |
|      +------------------------+     |
|                                     |
|            [ > Skip ]               |
+-------------------------------------+
```

### 8.2 Round N intro

```
+-------------------------------------+
|  [header] 0/3  ★ 0   ♥♥♥             |
+-------------------------------------+
|  [progress: 0/3]                    |
+-------------------------------------+
|              [🧠]                    |
|           Round N                    |
+-------------------------------------+
```

### 8.3 Gameplay (data-phase="gameplay")

```
+-------------------------------------+
|  [header] 1/3 ★ 0 ♥♥♥ ⏱ 0:60        |
+-------------------------------------+
|  [progress: 0/3]                    |
+-------------------------------------+
|  Figure out the pattern in this      |
|  image                               |
|  Type the number that should         |
|  replace the question mark.          |
|                                     |
|   +---+Ex1+---+   +---+Ex2+---+      |
|   |  2     6 |   |  4     4 |       |
|   |    12    |   |    16    |       |
|   |  4     3 |   |  8     2 |       |
|   +----------+   +----------+       |
|                                     |
|         +--Target--+                 |
|         |  9     2 |                 |
|         |    ?     |                 |
|         |  6     3 |                 |
|         +----------+                 |
|                                     |
|        [  Type here    ]            |
|                                     |
|        [  CHECK (disabled)  ]       |
+-------------------------------------+
```

### 8.4 Victory (data-phase="results")

```
+-------------------------------------+
|  [header] 3/3  ★ 3                   |
+-------------------------------------+
|  [progress: 3/3]                    |
+-------------------------------------+
|         ★   ★   ★                    |
|         Victory 🎉                   |
|  You solved X of 3 on the first try! |
|                                     |
|   [ Play Again ]  [ Claim Stars ]    |
+-------------------------------------+
```

### 8.5 Game Over (data-phase="results")

```
+-------------------------------------+
|  [header] X/3  ★ 0                   |
+-------------------------------------+
|  Game Over                           |
|  Great effort — try again!           |
|                                     |
|   [ Play Again ]                    |
+-------------------------------------+
```

### 8.6 Motivation / Stars Collected

Standard per alfred/skills/game-planning/reference/default-transition-screens.md.

---

## 9. Round Presentation Sequence

Every round:
1. **Render** — 3 clusters + input + CHECK render. Fade-in 350ms. CHECK disabled until input non-empty.
2. **Focus** — programmatic `input.focus({preventScroll:true})` after a 150ms delay; scrollIntoView the wrapper to center.
3. **Timer** — start 60 s countdown. On tick 0 → synthesize wrong submit (typed='').
4. **Gameplay reveal** — `isProcessing=false`, `roundStartTime=Date.now()`.

---

## 10. Spec Ambiguities Resolved

| Ambiguity (spec) | Planner default | Rationale |
|---|---|---|
| Timer on L4 content | 60s per round | Concept has short targets; timer adds pacing. |
| Single round per rule | 1 target/rule | Matches spec §Rounds. |
| Input width | 72px MIN, 300px MAX | p07-input-behaviors default. |
| Cluster rendering | SVG | Scales cleanly on mobile. |
| Timer display | Inline countdown in a header strip below progress bar | Avoids MEMORY timer_preview_integration complexity. |

---

## 11. Cross-Validation

- Every screen in §1 has a wireframe in §8.
- Every feedback moment in §6 corresponds to a step in §4 phase transitions.
- `firstCheckSolves` is the single scoring source; stars map in §5 is pure function of it.
- `progressBar.update` is called FIRST in round_complete handler (MEMORY rule).
- `recordAttempt` fires exactly once per round, on CHECK.
- `game_complete` fires exactly once, BEFORE end-game audio, on BOTH victory AND game-over paths.
- `gameState.phase='playing'` is FIRST LINE of game_init handler.
- `syncDOM()` targets `#app`, not body.
