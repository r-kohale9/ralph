# Round Flow: Matching Doubles

## Round Types

One round type: Two-Column Match. All 9 rounds use this type. The only variation is pair count (3, 4, or 5 pairs).

## Round Type: Two-Column Match

### Step-by-step

1. **Round starts**
   - Previous matched items clear. New left-column numbers and right-column doubles render.
   - Right-column items are shuffled (not aligned with their matching left-column number).
   - `new_cards` SFX plays (fire-and-forget).
   - Items fade in with `.fade-in` animation (350ms).
   - Progress bar updates to show currentRound/9.
   - Round counter updates: "Round N/9".
   - All items are in default state (neutral, tappable).
   - No left item is selected. `gameState.selectedLeft = null`.

2. **Student taps a left-column item**
   - If `gameState.isProcessing === true`, ignore tap.
   - If this left item is already matched (locked), ignore tap.
   - If another left item is already selected, deselect it first (remove `.selected` class, play `sound_bubble_deselect` SFX fire-and-forget).
   - If tapping the same left item that is already selected, deselect it (remove `.selected` class, play `sound_bubble_deselect` SFX fire-and-forget, set `gameState.selectedLeft = null`). Stop here.
   - Apply `.selected` class (blue border/glow) to tapped left item.
   - Play `sound_bubble_select` SFX (fire-and-forget).
   - Set `gameState.selectedLeft = tappedLeftItem`.

3. **Student taps a right-column item (with a left item selected)**
   - If `gameState.isProcessing === true`, ignore tap.
   - If this right item is already matched (locked), ignore tap.
   - If no left item is selected (`gameState.selectedLeft === null`), ignore tap.
   - Compare: does rightItem.value === selectedLeft.value * 2?

4. **Correct match path (multi-step -- SFX + sticker only, fire-and-forget):**
   a. Both items (left selected + right tapped) get `.selected-correct` styling (green background).
   b. Both items become locked: reduced opacity, `pointer-events: none`.
   c. `gameState.selectedLeft = null` (clear selection).
   d. `gameState.score++`. Score display updates with `.score-bounce` animation (400ms).
   e. `gameState.matchedPairs++` for current round.
   f. `recordAttempt({ question: selectedLeft.value, answer: rightItem.value, correct: true })`.
   g. `FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER }).catch(...)` -- fire-and-forget. No dynamic TTS. No input blocking.
   h. Student can immediately tap another left item.
   i. **Check: are all pairs in this round matched?** If yes, go to Step 6.

5. **Wrong match path (multi-step -- SFX + sticker only, fire-and-forget):**
   a. Both items (left selected + right tapped) get `.selected-wrong` styling (red flash).
   b. `gameState.selectedLeft = null` (clear selection).
   c. `gameState.lives--`. Lives display updates immediately (one heart empties). `.heart-break` animation (600ms).
   d. `recordAttempt({ question: selectedLeft.value, answer: rightItem.value, correct: false })`.
   e. **Check: are lives now 0?** If yes, skip wrong SFX entirely. Go to Step 7 (Game Over).
   f. `FeedbackManager.sound.play('incorrect_sound_effect', { sticker: INCORRECT_STICKER }).catch(...)` -- fire-and-forget. No dynamic TTS. No input blocking.
   g. After 600ms, remove `.selected-wrong` from both items. Both return to default state (tappable).
   h. Student can immediately tap another left item.

6. **Round complete (all pairs matched):**
   a. `gameState.isProcessing = true` -- block input.
   b. `await FeedbackManager.sound.play('all_correct', { sticker: ROUND_STICKER, subtitle: 'All matched!' })` -- awaited.
   c. `gameState.isProcessing = false`.
   d. `gameState.currentRound++`.
   e. **Check: was that round 9 (last round)?** If yes, go to Step 8 (Victory).
   f. Load next round (go to Step 1).

7. **Game Over (0 lives):**
   a. `gameState.isActive = false`.
   b. Timer pauses.
   c. Calculate final metrics: roundsCompleted, score, totalAttempts, accuracy.
   d. `signalCollector.seal()`.
   e. Render game_over screen FIRST (data-phase="game_over").
   f. `window.parent.postMessage({ type: 'game_complete', ... })` -- BEFORE audio.
   g. Sequential awaited audio with audioStopped flag:
      - `await FeedbackManager.sound.play('game_over_sound_effect', { sticker: GAMEOVER_STICKER })`
      - If not audioStopped: `await FeedbackManager.playDynamicFeedback({ audio_content: 'You completed N rounds', subtitle: 'You completed N rounds', sticker: GAMEOVER_STICKER })`
   h. CTA ("Try Again") is already visible. If tapped during audio, `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()`, reset all state, return to start screen.

8. **Victory (all 9 rounds complete):**
   a. `gameState.isActive = false`.
   b. Timer pauses. Record `gameState.totalTime = elapsed time in ms`.
   c. Calculate stars: 3 stars if totalTime <= 60000ms, 2 stars if totalTime <= 90000ms, 1 star if totalTime > 90000ms.
   d. Calculate accuracy: (score / totalAttempts) * 100.
   e. `signalCollector.seal()`.
   f. Render results screen FIRST (data-phase="results").
   g. `window.parent.postMessage({ type: 'game_complete', ... })` -- BEFORE audio.
   h. Determine audio tier:
      - 3 stars: `victory_sound_effect` SFX + victory VO
      - 2 stars: `game_complete_sound_effect` SFX + complete VO
      - 1 star: `game_complete_sound_effect` SFX + complete VO
   i. Sequential awaited audio with audioStopped flag:
      - `await FeedbackManager.sound.play(sfxId, { sticker: tierSticker })`
      - If not audioStopped: `await FeedbackManager.playDynamicFeedback({ audio_content: voText, subtitle: voText, sticker: tierSticker })`
   j. CTA ("Play Again") is already visible. If tapped during audio, `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()`, reset all state, return to start screen.

### State changes per step

| Step | gameState fields changed | DOM update |
|------|------------------------|------------|
| Round starts | currentRound (if not first), matchedPairs=0, selectedLeft=null | Clear old items, render new pairs, progress bar, round counter |
| Left item tapped | selectedLeft = item | `.selected` class on item, deselect previous if any |
| Left item deselected | selectedLeft = null | Remove `.selected` class |
| Correct match | score++, matchedPairs++, selectedLeft=null | `.selected-correct` on both, lock both, score display `.score-bounce` |
| Wrong match (lives > 0) | lives--, selectedLeft=null | `.selected-wrong` flash 600ms on both, heart empties, `.heart-break` |
| Wrong match (lives = 0) | lives=0, isActive=false, selectedLeft=null | Heart empties, transition to game_over |
| Round complete | isProcessing=true then false, currentRound++ | Round-complete audio plays, then next round loads |
| Victory | isActive=false, phase='results' | Timer pauses, results screen renders, end-game audio |
| Game over | isActive=false, phase='game_over' | Timer pauses, game_over screen renders, end-game audio |
| Restart | All state reset to initial values | Return to start screen |
