# Pre-Generation Plan: Age Matters — Age Logic Word Problems

**Game ID:** age-matters
**Archetype:** Lives Challenge (#3) — Shape 2 (Multi-round with Game Over branch)
**Bloom:** L3 Apply
**Interaction:** P7 Text/Number Input (multi-field, 2 numeric inputs per round, CHECK submits both)
**Rounds:** 3 (Stage 1 / Stage 2 / Stage 3 — one pre-baked puzzle per variant)
**Lives:** 3
**Timer:** None
**PreviewScreen:** YES (per PART-039)

---

## 1. Screen Flow

```
          ┌─────────────────────────────────────────────────────────────────┐
          │                     PreviewScreen wrapper                        │
          │  (persistent: header bar + scroll area + progress-bar slot)     │
          │                                                                  │
          │   DOMContentLoaded                                               │
          │        │                                                         │
          │        ▼                                                         │
          │   setupGame() ── injectGameHTML() ── renderInitialState() ──    │
          │                                                    previewScreen.show() ──┐
          │                                                                            │
          │                                                                            ▼
          │                                                     ┌─── Preview State ────┐
          │                                                     │ instruction HTML:    │
          │                                                     │ "Find their ages!"   │
          │                                                     │ "Skip & start" CTA   │
          │                                                     └──────────┬───────────┘
          │                                                                │ skip / audio-end
          │                                                                ▼
          │                                                      startGameAfterPreview()
          │                                                                │
          │                                                                ▼
          │                       ┌────────── TransitionScreen: "Round N" (N=1..3) ─────────┐
          │                       │  title "Round N"  ·  sticker rounds_sticker             │
          │                       │  onMounted: sound 'rounds_sound_effect'                  │
          │                       │  auto-advance after SFX + ≈900ms                          │
          │                       └────────────────────┬─────────────────────────────────────┘
          │                                            │ auto
          │                                            ▼
          │          ┌──────────────── Gameplay Round N (data-phase="gameplay") ─────────────┐
          │          │  persistent preview header  ·  ProgressBar (N/3 segments + 3 hearts)    │
          │          │  Character Row 1 (avatar/name + speech bubble)                          │
          │          │  Character Row 2 (mirrored: speech bubble + avatar/name)                │
          │          │  Question prompt: "How old are [Name1] and [Name2] now?"               │
          │          │  Input Row 1: "[Name1]'s age is" [   ] (numeric-only, placeholder)     │
          │          │  Input Row 2: "[Name2]'s age is" [   ] (numeric-only, placeholder)     │
          │          │  CHECK button (disabled until both fields numeric)                      │
          │          └───────┬────────────────────────────────────────────────────────────────┘
          │                  │ tap CHECK OR Enter on either input (both fields filled)
          │                  ▼
          │          ┌─── Validate both values against solution ages ─┐
          │          └───────┬───────────────────────────────┬─────────┘
          │          both match                        at least one wrong
          │                  │                                 │
          │                  ▼                                 ▼
          │     ┌── Correct Feedback (inline) ──┐   ┌── Wrong Feedback (inline) ──┐
          │     │ both inputs flash green        │   │ wrong field(s) flash red    │
          │     │ recordAttempt(correct:true)    │   │ lives -= 1                   │
          │     │ progressBar.update FIRST       │   │ recordAttempt(correct:false,│
          │     │ await SFX (Promise.all 1500ms) │   │   misconception_tag)         │
          │     │ fire-and-forget TTS            │   │ progressBar.update FIRST     │
          │     │ advance to next round or Vic.  │   │ await SFX (Promise.all 1500)│
          │     └────────────┬───────────────────┘   │ fire-and-forget TTS          │
          │                  │                         │                             │
          │                  │                         │  if lives > 0 → clear       │
          │                  │                         │  inputs, isProcessing=false,│
          │                  │                         │  stay on round              │
          │                  │                         │                             │
          │                  │                         │  if lives == 0 → Game Over  │
          │                  │                         └───────┬────────────────────┘
          │                  │                                 │
          │                  ▼                                 ▼
          │          ┌───── routing on N ─────┐        ┌─── Game Over screen ───┐
          │          │ if N < 3 → Round N+1   │        │ title: "Try again!"    │
          │          │ if N == 3 → Victory    │        │ game_complete FIRST    │
          │          └─────────┬──────────────┘        │ then game-over audio   │
          │                    │                       │ "Try Again" CTA        │
          │                    │                       └──────┬─────────────────┘
          │                    │                              │ tap Try Again
          │        N<3 ▼                   N==3 ▼             │
          │   (loop to Round N+1        ┌───── Victory ────┐  │
          │    intro transition)        │ stars 0..3       │  │
          │                             │ subtitle:        │  │
          │                             │  "You solved     │  │
          │                             │   X of 3!"        │  │
          │                             └───┬────┬─────────┘  │
          │                                 │    │             │
          │                      stars<3 │    │ any stars     │
          │                [Play Again]     │    │ [Claim]      │
          │                                 ▼    ▼             ▼
          │                     ┌─ Motivation ─┐  ┌─ Stars Collected ─┐
          │                     │ "Ready to    │  │ "Yay! 🎉          │
          │                     │ improve      │  │  Stars collected!"│
          │                     │ your score?"│  │ auto 2500ms        │
          │                     │ [I'm ready!] │  │ → postMessage      │
          │                     └──────┬───────┘  │   game_exit        │
          │                            │ tap      └─────────┬──────────┘
          │                            ▼                    ▼
          │           restart from Round 1 (skip Preview)    exit
          └─────────────────────────────────────────────────────────────────┘
```

**Shape:** Shape 2 Multi-round + Game Over branch.

**Changes from canonical default:**
1. **Submit is explicit CHECK button tap** (plus Enter-keydown handler on both inputs). CHECK is disabled until BOTH input fields contain a non-empty numeric value.
2. **Wrong + lives > 0 retry on same round** — inputs cleared, isProcessing released, student tries again on the same round.
3. **Standard Game Over branch** on wrong + lives == 0 per archetype.

**Entry/exit triggers table:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen | `start_screen` | `DOMContentLoaded` → `setupGame()` → `previewScreen.show()` | skip OR audio-end → `onComplete` → `startGameAfterPreview()` |
| Round N transition | `round_intro` | before each round (N=1..3) via `transitionScreen.show({ title: 'Round N', … })` | SFX complete + ≈900ms → auto-advance |
| Gameplay Round N | `gameplay` | transition auto-complete → `renderRound()` | CHECK tap (or Enter) with both fields filled → validator |
| Inline Feedback (correct) | `gameplay` (inline) | validator returns pass | auto-advance ≈1500ms → next round or Victory |
| Inline Feedback (wrong, lives>0) | `gameplay` (inline) | validator returns fail, lives>0 | after ≈1500ms, clear inputs + isProcessing=false (stay on round) |
| Game Over | `gameover` | validator returns fail, lives==0 | "Try Again" → `restartGame()` |
| Victory | `results` | after Round 3 correct feedback | Claim Stars → Stars Collected; Play Again (stars<3) → Motivation |
| Motivation | `results` (transition) | "Play Again" on Victory stars<3 | "I'm ready! 🙌" → `restartGame()` |
| Stars Collected | `results` (transition) | "Claim Stars" on Victory | auto 2500ms → `postMessage({type:'game_exit'})` |

**ProgressBar:**
- 3 segments + 3 lives indicator (Lives Challenge default).
- `progressBar.update(currentRound, lives)` is FIRST action in round-complete handler (correct OR wrong), BEFORE any awaited SFX. Matches MEMORY.md `progress_bar_round_complete`.
- `data-lives` written by `syncDOM()` on every phase change.

---

## 2. Round-by-Round Breakdown

Every round uses Pattern P7 multi-field numeric input with check-on-submit. Clue text, character metadata, and pre-computed solution ages come from `fallbackContent.rounds[]` in the spec.

| R | Stage | Characters | Clue 1 | Clue 2 | Solution | Primary misconceptions | Target 1st-attempt rate |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Riya, Priya | Riya: "I was 12 years old, 4 years ago." | Priya: "In two years, I will be three times as old as Riya was four years ago." | riya=16, priya=34 | shift-tense-ignored, multiplier-not-inverted, tense-offset-dropped | 65-75% |
| 2 | 2 | Amit, Bharat | Amit: "In four years, I will be 18 years old." | Bharat: "Two years ago, I was twice as old as Amit is now." | amit=14, bharat=30 | shift-tense-ignored, anchor-only | 55-65% |
| 3 | 3 | Kiran, Meera | Kiran: "Two years ago, I was 11 years old." | Meera: "In four years, I will be three times as old as Kiran was two years ago." | kiran=13, meera=29 | tense-offset-dropped, multiplier-not-inverted | 45-55% |

**Algebra key (deterministic, pre-computed, NOT evaluated at runtime):**

- R1: riya - 4 = 12 → riya = 16. priya + 2 = 3 * (riya - 4) = 3 * 12 = 36 → priya = 34.
- R2: amit + 4 = 18 → amit = 14. bharat - 2 = 2 * amit = 2 * 14 = 28 → bharat = 30.
- R3: kiran - 2 = 11 → kiran = 13. meera + 4 = 3 * (kiran - 2) = 3 * 11 = 33 → meera = 29.

**Validator (runtime):** purely compares typed integer value per field against `round.solution[characterId]`. No symbolic math is attempted at runtime — the pre-computed solution is authoritative.

**Misconception-tag derivation (runtime, on wrong CHECK):**

| Condition | Tag |
|---|---|
| Both fields wrong AND (typed1, typed2) == (solution[char2], solution[char1]) — exact swap | `fields-swapped` |
| Both fields wrong AND neither matches any solution value | `both-ages-wrong` |
| Only char-1 field wrong AND char-2 correct | `anchor-only` |
| Only char-2 field wrong AND char-1 correct | `anchor-only` |
| Any wrong field where typed = expected ± any time offset present in clues (2, 4) | `tense-offset-dropped` |
| Any wrong field where typed = expected × any multiplier present in clues (2, 3) OR typed × multiplier = expected | `multiplier-not-inverted` |
| Fallback | `shift-tense-ignored` |

Priority: `fields-swapped` > `tense-offset-dropped` > `multiplier-not-inverted` > `anchor-only` > `both-ages-wrong` > `shift-tense-ignored`.

---

## 3. Input Interaction Logic (Pattern P7)

**Inputs:** two `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off">` fields, one per character. Each input has an associated `id` that encodes the characterId (`age-input-<charId>`).

**Per-input live listener:**
- `input` event: strip non-digits live (`value = value.replace(/[^0-9]/g, '').slice(0,2)`). Re-evaluate CHECK enablement.
- `keydown` Enter: call `handleSubmit()` (same entry point as CHECK tap); the handler first checks that both fields are non-empty.

**CHECK enablement:**
- Evaluated on every `input` event: `both inputs non-empty with numeric content` → enable CHECK.
- While in "wrong retry" state, CHECK is disabled until inputs are cleared (they are cleared by the handler after a wrong submission) AND the student types again.

**Submit (CHECK tap OR Enter keydown):**
1. Guard: `!gameState.isActive || gameState.isProcessing || gameState.gameEnded` → return.
2. Guard: both fields must be non-empty numeric values.
3. `gameState.isProcessing = true` BEFORE any await.
4. `input.blur()` on BOTH inputs to dismiss the keyboard.
5. Compare typed integers against `round.solution`.
6. Route to `handleCorrectOutcome` or `handleWrongOutcome`.

**Mobile rules (from mobile/SKILL.md and p07-input-behaviors):**
- `type="text"` with `inputmode="numeric"` — NEVER `type="number"`.
- Font-size 16px+ on inputs (prevents Safari auto-zoom).
- `-webkit-appearance: none; appearance: none` on inputs.
- `visualViewport` resize listener — scrolls the focused input into view when the mobile keyboard opens.
- Never auto-focus during transitions (keyboard flicker). First interaction must be a student tap.
- Input borders: thin (2px), `--mathai-border-gray` neutral; `--mathai-blue` on focus; `--mathai-green` background on correct flash; `--mathai-red` background on wrong flash.

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  gameId: 'age-matters',
  phase: 'start_screen' | 'round_intro' | 'gameplay' | 'feedback_correct' | 'feedback_wrong' | 'round_complete' | 'results' | 'gameover',
  currentRound: 0..3,                         // 1-indexed at gameplay; 0 before first round
  totalRounds: 3,
  score: 0..3,
  lives: 0..3,
  totalLives: 3,
  correctAnswer: { [charId]: number } | null, // solution for current round
  attempts: [],
  events: [],
  startTime: null | epoch ms,
  isActive: false,
  isProcessing: false,
  gameEnded: false,
  content: null | fallbackContent,
  stars: 0..3,
  roundStartTime: null | epoch ms,
  responseTimes: [],
  previewResult: null,
  currentRoundData: null | round,
  currentInputs: { [charId]: string },        // live-typed string values
  duration_data: { startTime, preview, attempts, evaluations, inActiveTime, totalInactiveTime }
}
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| `start_screen` | `DOMContentLoaded` | preview (PreviewScreen) | `setupGame()` injects HTML, renders Round 1 scaffold, `previewScreen.show()` |
| `start_screen` | preview `onComplete` | `round_intro` | `startGameAfterPreview()`: set `startTime`, `isActive=true`, `lives=3`, `score=0`, show Round 1 transition |
| `round_intro` | rounds SFX finishes | `gameplay` | `renderRound()` — reset `currentInputs`, `isProcessing=false`; `syncDOM()` |
| `gameplay` | input event | `gameplay` | live update of `currentInputs`; recompute CHECK enablement |
| `gameplay` | CHECK tap / Enter (both fields filled) | `feedback_correct` OR `feedback_wrong` | `isProcessing=true` BEFORE await; validator; `recordAttempt(...)` BEFORE audio |
| `feedback_correct` | after `await` SFX + 1500ms, progressBar updated FIRST | `round_complete` | `score += 1`; then next-round transition OR Victory |
| `feedback_wrong` | lives > 0 after SFX + 1500ms | `gameplay` (retry) | clear inputs, reset border classes, `isProcessing=false` |
| `feedback_wrong` | lives == 0 after SFX + 1500ms | `gameover` | Game Over screen, `game_complete` BEFORE audio |
| `round_complete` | (currentRound < totalRounds) | `round_intro` | `currentRound += 1`, show "Round N" transition |
| `round_complete` | (currentRound == totalRounds) | `results` | compute stars, render Victory, fire `game_complete` BEFORE audio |
| `results` | "Claim Stars" | transition: `stars_collected` | auto 2500ms → `postMessage({type:'game_exit'})` |
| `results` | "Play Again" (stars<3) | transition: motivation | "I'm ready!" → `restartGame()` |
| `gameover` | "Try Again" | transition: motivation or direct restart | `restartGame()` |

**Validator (pure function):**

```
function validateAges(typedInputs, solution):
  let allCorrect = true
  let wrongFields = []
  for each charId in solution:
    let typedStr = typedInputs[charId]
    let expected = solution[charId]
    let typedInt = parseInt(typedStr, 10)
    if isNaN(typedInt) or typedInt !== expected:
      allCorrect = false
      wrongFields.push(charId)
  return { pass: allCorrect, wrongFields, typed: typedInputs }
```

Deterministic, idempotent, NEVER mutates `gameState`.

---

## 5. Scoring & Progression Logic

- **Points:** `+1` per round solved correctly. Max 3.
- **Lives:** 3 at start. Each wrong CHECK → `-1`. When lives reach 0 AND the current CHECK is wrong, route to Game Over (after the minimum 1500ms wrong-SFX window).
- **Timer:** None.
- **Star rating:** computed once on transition to `results`, from `score`:
  - 3★ = score == 3
  - 2★ = score == 2
  - 1★ = score == 1
  - 0★ = score == 0 (still renders Victory — possible only if student never reached Game Over, i.e., won all 3 rounds WITH 0 lives remaining which is impossible; practically, 0 stars means Game Over fired earlier).

**Victory subtitle:** `"You solved " + score + " of 3!"`
**Game Over subtitle:** `"You solved " + score + " of 3 before losing all lives."`

**ProgressBar:**
- 3 segments + 3 lives.
- `progressBar.update(gameState.currentRound, Math.max(0, gameState.lives))` called FIRST in every round-complete handler BEFORE awaited SFX.
- Completed segments persist. Reset on restart only.

---

## 6. Feedback Patterns

Cross-reference: feedback/SKILL.md 17 cases + await/fire-and-forget priority table. Bloom L3 → context-aware TTS on CHECK resolution, Case 4 (correct single-step) and Case 7 (wrong with lives remaining) / Case 8 (wrong last life).

| Event | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|---|---|---|---|---|---|
| Input focus / type | — (no audio) | — | No | — | live value update, CHECK enablement |
| Round N intro | `await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_ROUND })` | — | No CTA | Yes (sequential) | auto-advance to gameplay |
| CHECK correct | `isProcessing=true` → progressBar.update FIRST → flash green on both inputs → `await Promise.all([sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }), new Promise(r=>setTimeout(r,1500))])` → fire-and-forget `playDynamicFeedback({audio_content, subtitle, sticker: STICKER_CORRECT}).catch(...)` | "Great! [N1] is [age1] and [N2] is [age2]." | Yes | SFX: Yes (Promise.all 1500ms); TTS: No (FAF) | advance to next round / victory |
| CHECK wrong (lives>0) | `isProcessing=true` → progressBar.update FIRST → flash red on wrong field(s) → `await Promise.all([sound.play('incorrect_sound_effect', { sticker: STICKER_WRONG }), new Promise(r=>setTimeout(r,1500))])` → fire-and-forget `playDynamicFeedback({audio_content, subtitle, sticker: STICKER_WRONG}).catch(...)` | "Not quite. Check the [tense] part and try again." | Yes | SFX: Yes (Promise.all 1500ms); TTS: No (FAF) | clear inputs, isProcessing=false, retry same round |
| CHECK wrong (lives==0) | Same SFX path with Promise.all 1500ms. TTS reveals correct: "The correct answer is [age1] and [age2]." | "Correct: [N1]=[age1], [N2]=[age2]" | Yes | SFX: Yes | Game Over branch |
| Game Over entry | Render screen FIRST → `game_complete` BEFORE audio → `await` game-over SFX + VO (sequential, CTA interruptible) | "You solved X of 3." | CTA visible | Yes (sequential) | "Try Again" → restartGame |
| Round complete | `progressBar.update(currentRound, lives)` FIRST in round-complete handler, BEFORE SFX | — | — | — | next round or Victory |
| Victory | Render screen FIRST → `game_complete` BEFORE audio → `await victory_sound_effect` + VO | "You solved X of 3!" | CTA visible | Yes (sequential) | Claim Stars / Play Again |
| Visibility hidden | `VisibilityTracker` handles pause overlay + `pause()` / `pauseAll()` | — | — | — | overlay shown by VisibilityTracker PopupComponent (not custom) |
| Visibility restored | `VisibilityTracker.resume()` | — | — | — | state continues |

**Subtitle examples per round (correct):**

- R1: "Great! Riya is 16 and Priya is 34."
- R2: "Great! Amit is 14 and Bharat is 30."
- R3: "Great! Kiran is 13 and Meera is 29."

**Subtitle examples (wrong, lives>0):**

- R1: "Not quite. Remember — 4 years ago means subtract 4."
- R2: "Not quite. 'Twice as old as Amit' means 2 × Amit's age."
- R3: "Not quite. Solve Kiran first, then use that to find Meera."

**Subtitle examples (wrong, last life / reveal):**

- R1: "Correct: Riya is 16 and Priya is 34."
- R2: "Correct: Amit is 14 and Bharat is 30."
- R3: "Correct: Kiran is 13 and Meera is 29."

**Animations:**

| Animation | Trigger | CSS class | Duration |
|---|---|---|---|
| Input focus border | `focus` | `.input-focus` (CSS `:focus`) | — |
| Input correct flash | CHECK pass | `.input-correct` (green bg + border) | 400ms |
| Input wrong flash | CHECK fail | `.input-wrong` (red bg + border, shake) | 600ms |
| Fade-in new round | `renderRound` | `.fade-in` | 350ms |
| Bubble pop-in | character row render | `.bubble-pop` | 300ms |

**Wrong Answer Handling:**

- Show correct answer: only on **last-life wrong** (in the TTS line before Game Over). On lives>0 wrong, the TTS gives a **hint** not the answer.
- Misconception-specific TTS: **No in v1** — the TTS is a tense/multiplier hint keyed off the derived tag, not a per-misconception script. Misconception tags ARE captured in `recordAttempt.misconception_tag` for analytics.
- No auto-advance on wrong while lives remain — student retries same round with inputs cleared.

**Emotional Arc:**

- L3 Apply: tone is affirming-but-procedural on correct, gentle redirect on wrong. Avoid words like "wrong" / "failed" in student-facing copy.
- Wrong feedback stays under 2s (1500ms SFX + 0.5s TTS start). Retry ready quickly.
- Victory leans on "X of 3" — matches spec star thresholds.
- Game Over subtitle: "You solved X of 3 before losing all lives. Good effort!"

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true, progressBar: true } })` called once at setup.
- `previewScreen.show()` called at end of `setupGame()` AFTER the Round 1 scaffold renders non-interactively in background. `timerConfig: null, timerInstance: null`. `previewInstruction` + `previewAudioText` from fallbackContent.
- `endGame()` calls `previewScreen.destroy()` exactly once.
- `restartGame()` does NOT call `previewScreen.show()` (per canonical default restart skips preview + welcome).
- `VisibilityTracker` wired to `previewScreen.pause/resume`; built-in PopupComponent handles pause overlay — never a custom div.
- `TimerComponent`: NOT used.
- `progressBar`: single instance mounted via ScreenLayout slot. Config: `{ totalRounds: 3, totalLives: 3 }`. Updated via `progressBar.update(currentRound, Math.max(0, lives))` as FIRST action in round-complete handler.
- `FeedbackManager` handles ALL audio. Preload: `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `victory_sound_effect`, `game_complete_sound_effect`, `game_over_sound_effect`, `tap_sound`, `sound_bubble_select`, `new_cards`.
- `syncDOM()` writes `data-phase`, `data-score`, `data-round`, `data-lives` on every phase change.
- **`recordAttempt`** per CHECK, once per round submission:
  - Correct: `{ pass: true, roundId: round, type, typed, correct_answer, misconception_tag: null, metadata: { stage, wrongFields: [] } }`
  - Wrong: `{ pass: false, roundId: round, type, typed, correct_answer, misconception_tag, metadata: { stage, wrongFields } }`
- **`game_complete` fires exactly once** on transition to `results` OR `gameover`, BEFORE end-game audio. Schema:
  ```
  { score, totalQuestions: 3, stars, accuracy: round((score/3)*100), timeSpent, attempts, duration_data, totalLives: 3, livesRemaining }
  ```
- **TransitionScreen usage:**
  - Round N intro: `{ title: 'Round N', icons: ['🎯'], buttons: [], onMounted: → rounds_sound_effect }`. Auto-advance after SFX.
  - Victory: `{ title: 'Victory 🎉', subtitle: 'You solved X of 3!', stars, persist: true, buttons: [...], onMounted: → victory_sound_effect }`.
  - Game Over: `{ title: 'Try again!', subtitle: 'You solved X of 3 before losing all lives.', persist: true, buttons: [{text:'Try Again', type:'primary', action: showMotivation}], onMounted: → game_over_sound_effect + reveal TTS }`.
  - Motivation: `{ title: 'Ready to improve your score? ⚡', buttons: [{text:"I'm ready! 🙌", type:'primary', action: restartGame}], persist: true, onMounted: → rounds_sound_effect }`.
  - Stars Collected: `{ title: 'Yay! 🎉\nStars collected!', duration: 2500, styles: { title: { whiteSpace: 'pre-line' } }, onMounted: → victory_sound_effect }`. On hide: `postMessage({type:'game_exit'})`.

- `data-testid` attributes required on: every input (`age-input-<charId>`), every character row (`char-row-<charId>`), CHECK button (`btn-check`), Victory "Claim Stars" (`claim-stars`), Motivation "I'm ready!" (`im-ready`), Game Over "Try Again" (`btn-try-again`).

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen

```
+-------------------------------------+
|  [avatar]  Age Matters              |  <- persistent preview header
|                         0 / 3  ★ 0  |
+-------------------------------------+
|                                     |
|      ┌──────────────────────────┐   |
|      │  Find their ages!        │   |
|      │  Read both clues in the  │   |
|      │  speech bubbles, then    │   |
|      │  type each character's   │   |
|      │  current age.            │   |
|      │  Tap CHECK when both     │   |
|      │  ages are filled in.     │   |
|      └──────────────────────────┘   |
|                                     |
|            [ ▶ Skip ]               |
+-------------------------------------+
```

### 8.2 Round N intro

```
+-------------------------------------+
|  [header] 0/3 ♥♥♥  ★ 0              |
+-------------------------------------+
|  [progress: 0/3 · hearts ♥♥♥]       |
+-------------------------------------+
|              [🎯]                   |
|           Round N                   |
|        (auto-advance)               |
+-------------------------------------+
```

### 8.3 Gameplay (Round 1 example)

```
+-------------------------------------+
|  [header] 1/3 ♥♥♥  ★ 0              |
+-------------------------------------+
|  [progress: ▓░░ 1/3 · hearts ♥♥♥]  |
+-------------------------------------+
|                                     |
|  ┌──────────────────────┐           |
|  │ I was 12 years old,  │  [👧]    |
|  │ 4 years ago.         │   Riya   |
|  └──────▼───────────────┘           |
|                                     |
|           ┌──────────────────────┐  |
|   [👩]   │ In two years, I will │  |
|   Priya  │ be three times as    │  |
|           │ old as Riya was 4    │  |
|           │ years ago.           │  |
|           └──────────▼───────────┘  |
|                                     |
|  How old are Riya and Priya now?    |
|                                     |
|  Riya's age is  [Type here]         |
|  Priya's age is [Type here]         |
|                                     |
|        [  CHECK  (disabled)  ]      |
+-------------------------------------+
```

### 8.4 Victory

```
+-------------------------------------+
|  [header] 3/3 ♥?  ★ 3               |
+-------------------------------------+
|         ★   ★   ★                   |
|         Victory 🎉                  |
|   You solved 3 of 3!                |
|  [ Play Again ]  [ Claim Stars ]    |
+-------------------------------------+
```

### 8.5 Game Over

```
+-------------------------------------+
|  [header] N/3 ♥♥♥→♡♡♡  ★ X          |
+-------------------------------------+
|              [😢]                   |
|           Try again!                |
|  You solved X of 3                  |
|  before losing all lives.           |
|        [ Try Again ]                |
+-------------------------------------+
```

### 8.6 Motivation / Stars Collected

Same as logic-seat-puzzle canonical forms (see PART-024 default transitions).

---

## 9. Round Presentation Sequence (within gameplay screen)

1. **Question preview** — character rows (bubbles + avatars) + question prompt + input rows render with fade-in 350ms. CHECK disabled.
2. **Instructions** — NOT repeated on gameplay. Preview owns the how-to.
3. **Media** — none (emoji avatars + colored backgrounds only; no remote images).
4. **Gameplay reveal** — inputs become focusable; CHECK enablement tracks input values. `isProcessing = false`.

---

## 10. Spec Ambiguities Resolved

| Ambiguity | Planner default | Rationale |
|---|---|---|
| Round count (B1=10 vs B2/B3=1) | 3 rounds total (one per variant) | Matches 3-variant structure; < 3-min session; aligns with concept's "block_count 3". |
| Lives presence at L3 | 3 lives (archetype + L3 pedagogy default) | Standard Lives Challenge combo. |
| Avatar rendering | Emoji + background color tile | No remote images; keeps HTML self-contained and under 500KB; concept's saree/ponytail details are aspirational and not load-bearing for the mechanic. |
| Speech-bubble orientation | Purple-oval border via CSS, with tail via `::after` pseudo-element | Matches concept's "vivid-purple oval" description. |
| Mirrored clue rows | `cluePosition: 'left'|'right'` per character drives CSS `flex-direction: row` vs `row-reverse` | Matches concept's B1 mirrored spec. |
| Input field type | `type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2"` | Mobile mandatory (never `type="number"`). |
| Submit trigger | CHECK button tap OR Enter key on either focused input (both fields filled) | Matches concept's "Tap field, type age" + platform accessibility default. |
| Misconception tag derivation at runtime | Prioritised heuristic over value comparison (see §2) | Simple, deterministic, captures the most common failure modes. |
| Retry on wrong (lives>0) | Inputs cleared, stay on same round | Matches Lives Challenge canonical: wrong costs a life, student retries. |

---

## 11. Cross-Validation

- Every screen in §1 has a wireframe in §8: PreviewScreen, Round N intro, Gameplay, Victory, Motivation, Stars Collected, Game Over.
- Every feedback moment in §6 corresponds to a phase transition in §4.
- `score` is the single star source; incremented in `feedback_correct` only.
- `progressBar.update` is FIRST in every round-complete handler (correct AND wrong), BEFORE awaited SFX.
- `recordAttempt` fires exactly once per CHECK submission (can fire multiple times per round if the student retries).
- `game_complete` fires exactly once, BEFORE end-game audio, on transition to `results` OR `gameover`.
- Transition screens match `default-transition-screens.md` templates verbatim except for the custom subtitle.
