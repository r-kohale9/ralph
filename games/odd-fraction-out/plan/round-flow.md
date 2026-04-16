# Round Flow: Odd Fraction Out

## Round Types

Only one round type exists (Shape 1 Standalone, `totalRounds = 1`):

- **Type A — Odd-One-Out Fraction Tap** (single MCQ, fixed cards: 3/4, 6/8, 9/12, 2/3)

## Round Type: A — Odd-One-Out Fraction Tap

### Step-by-step

1. **Round starts** — gameplay screen mounts. `gameState.phase = 'gameplay'`, `gameState.currentRound = 1`, `gameState.isProcessing = false`. Prompt heading and 2×2 grid of four fraction cards render. `syncDOM()` called.
2. **Student sees** —
   - Prompt heading: "Tap the fraction that is NOT equal to the others."
   - Four cards in a 2×2 grid: `3/4`, `6/8`, `9/12`, `2/3` (stacked fraction rendering).
   - No progress bar (Shape 1 Standalone).
   - No timer, no lives display.
3. **Student acts** — taps exactly one card. Tap commits the answer immediately. No Submit button. All four cards are active until the first tap; after the tap, all four are locked.
4. **Correct path (student tapped `c4` / `2/3`) — single-step: SFX + dynamic TTS:**
   a. Tapped `c4` card gets `.selected-correct` styling (green, via `--mathai-success`).
   b. `gameState.isProcessing = true` — all card taps blocked.
   c. `gameState.score = 1`, `gameState.stars = 3`.
   d. `recordAttempt` postMessage fires: `{ selected_option: "2/3", is_correct: true, misconception_tag: null }`.
   e. `await FeedbackManager.sound.play('correct_sound_effect', { sticker: 'celebration' })` — awaited.
   f. `await FeedbackManager.playDynamicFeedback({ audio_content: 'You got it!', subtitle: 'You got it!', sticker: 'celebration' })` — awaited after SFX.
   g. 2000ms dwell after TTS completes.
   h. `game_complete` postMessage fires: `{ correct: true, stars: 3, livesLeft: null, score: 1, totalQuestions: 1, accuracy: 100 }`.
   i. `gameState.phase = 'complete'`. Host app receives Game End and resumes.
5. **Wrong path (student tapped `c1`, `c2`, or `c3`) — single-step: SFX + dynamic TTS; NO retry (Shape 1 Standalone terminates on any answer):**
   a. Tapped card gets `.selected-wrong` styling — red flash via `--mathai-danger` for ~600ms.
   b. `gameState.isProcessing = true` — all card taps blocked.
   c. `gameState.score = 0`, `gameState.stars = 0`.
   d. `recordAttempt` postMessage fires: `{ selected_option: "<tapped label>", is_correct: false, misconception_tag: "<MISC-FRAC-EQ-01|02|03 per tapped card>" }`.
   e. `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: 'sad' })` — awaited.
   f. `await FeedbackManager.playDynamicFeedback({ audio_content: "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't.", subtitle: "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't.", sticker: 'sad' })` — awaited after SFX.
   g. After the red flash (~600ms, runs concurrently with SFX start) and after TTS completes, `c4` (`2/3`) card gets `.selected-correct` styling (green) so the student sees the correct answer.
   h. Lives branch: **N/A** — the spec has no lives. Skip life-decrement and game-over routing entirely.
   i. 2000ms dwell after TTS completes (concurrent with green reveal on `c4`).
   j. `game_complete` postMessage fires: `{ correct: false, stars: 0, livesLeft: null, score: 0, totalQuestions: 1, accuracy: 0 }`.
   k. `gameState.phase = 'complete'`. Host app receives Game End and resumes.
   l. Student does **NOT** retry — Shape 1 Standalone terminates on any answer.
6. **Last round complete** — this IS the last (and only) round. Per the spec's Feedback table: "No Victory or Results screen is rendered — the host app handles post-game transition." Order is therefore:
   a. `game_complete` postMessage sent (after the 2000ms dwell completes).
   b. No victory SFX (spec defines no Victory screen; Game End fires directly).
   c. No "Claim Stars" CTA, no "Play Again" CTA — host handles routing.

### State changes per step

| Step | gameState fields changed | DOM update |
|------|--------------------------|------------|
| Round starts (gameplay mount) | phase='gameplay', currentRound=1, isProcessing=false, score=0, stars=0 | prompt + 4 cards rendered; `data-phase="gameplay"` on root |
| Correct tap (on `c4`) | isProcessing=true, score=1, stars=3 | `c4` gains `.selected-correct`; all cards locked |
| Correct TTS completes | (no change) | sticker overlay dismisses |
| Wrong tap (on `c1`/`c2`/`c3`) | isProcessing=true, score=0, stars=0 | tapped card gains `.selected-wrong` (600ms red flash); all cards locked |
| Wrong TTS completes | (no change) | `c4` gains `.selected-correct` (green reveal) |
| 2000ms dwell end | phase='complete' | `game_complete` postMessage fires; host resumes |
