# Round Flow: Add 15 Numbers

## Round Types

Only one round type exists in this game:
- **Type A — Tap-and-strike grid sum + MCQ selection** (used in all 5 rounds; difficulty scales per stage).

## Round Type: A (Tap-and-strike grid sum + MCQ selection)

### Step-by-step

1. **Round starts.**
   - `renderRound(N)` runs (single source of truth for enabling inputs).
   - `gameState.currentRound = N` (1-indexed).
   - `gameState.roundStartTime = Date.now()`.
   - `gameState.isProcessing = false`.
   - DOM updates: progress bar reads `N-1 of 5` entering, grid renders 12-15 tiles from `rounds[N-1].tiles` in 3-column layout with `.fade-in` (350ms). MCQ row renders 3 buttons from `rounds[N-1].options` with `opacity: 0, pointer-events: none` until reveal.
   - `TimerComponent` mounted inside `#timer-container` (which is inside `.mathai-preview-header-center` per MEMORY.md timer_preview_integration) — duration 15000ms, `onTimeout: handleTimeout`. Timer inline 320x41 styles are overridden so the bar fits within the preview header. `#previewTimerText` is hidden (empty). Timer does NOT start yet.
   - VisibilityTracker is armed with `autoShowPopup: true` — any tab-hide pauses the timer + all FeedbackManager audio and shows the default pause popup. Do NOT build a custom pause overlay (per MEMORY.md feedback_pause_overlay).

2. **Student sees.**
   - Persistent preview header with title + score + star (top).
   - Progress bar "`(N-1)/5`" with 3 heart icons reflecting current `gameState.lives` (just below header).
   - Timer bar inside the header showing "15s" with a full horizontal bar.
   - Prompt banner: "Add the given list of numbers and tap on their sum!" (semantically-distinct per-round prompt, NOT the preview how-to-play).
   - Grid of 12-15 number tiles in a 3-column CSS grid, fully tappable.
   - Below grid, 3 MCQ buttons hidden during reveal.

3. **Gameplay reveal (350ms after step 1).**
   - MCQ buttons transition `opacity` 0→1, `pointer-events` none→auto (`.fade-in` 350ms).
   - `TimerComponent.start()` — begins 15000ms countdown. Bar shrinks, digital text counts `15s` → `0s`.
   - Inputs now unblocked.

4. **Student acts (inputs, mutually exclusive):**
   - **Path 4a — Grid tile tap (non-committing, CASE 9 micro-interaction):**
     a. Tile's `.struck` class toggles (gray fill + red diagonal strike line appears or disappears).
     b. `FeedbackManager.sound.play('sound_tile_select', {sticker: null}).catch(function(e){})` on strike-on, or `sound_tile_deselect` on strike-off — fire-and-forget.
     c. NO input block. NO sticker. NO timer pause. Does NOT decrement lives, does NOT advance round. `gameState.isProcessing` stays `false`.
     d. Student may tap multiple tiles in any order. Strike is a pure bookkeeping aid.
   - **Path 4b — MCQ button tap (commit):** proceed to step 5.
   - **Path 4c — Timer hits 0** (no MCQ tapped within 15000ms): proceed to step 7 (Timeout path).

5. **MCQ tap — branching on correctness.** Fires only for MCQ buttons. String-compare: `String(tappedValue).trim() === String(rounds[N-1].correctSum).trim()`.

6. **Correct path (single-step — SFX awaited + dynamic TTS fire-and-forget, CASE 4):**
   a. `gameState.isProcessing = true` — set BEFORE any await; disables all MCQ buttons + grid tiles.
   b. `TimerComponent.pause()` — stops countdown immediately. Capture `gameState.roundResponseTime = Date.now() - gameState.roundStartTime`; append to `gameState.responseTimes[]`.
   c. Tapped MCQ button gets `.correct` class (green flash ~600ms).
   d. `gameState.score += 1`.
   e. ProgressBar bumps FIRST: `progressBar.update(currentRound, lives)` fires as the first action in the round-complete handler (per MEMORY.md progress_bar_round_complete), BEFORE the awaited SFX.
   f. `await FeedbackManager.sound.play('correct_sound_effect', {sticker: STICKER_CELEBRATE})` — awaited ~1000ms.
   g. `FeedbackManager.playDynamicFeedback({audio_content: 'Correct sum! That is ' + correctSum + '.', subtitle: 'Correct sum! That is ' + correctSum + '!', sticker: STICKER_CELEBRATE}).catch(function(e){})` — FIRE-AND-FORGET.
   h. **Branch on N:**
      - If `N < 5`: after ~1000ms total feedback window, route to `round_complete_interstitial` (step 8).
      - If `N === 5`: route to `victory` (step 10).

7. **Wrong path (lives > 1 after decrement — CASE 7) OR Timeout path (treated identically for scoring, CASE 7):**
   a. `gameState.isProcessing = true` — set BEFORE any await.
   b. `TimerComponent.pause()` — stops countdown. Capture `gameState.roundResponseTime = Date.now() - gameState.roundStartTime` (or 15000 on timeout); append to `gameState.responseTimes[]`.
   c. If MCQ tap: tapped button gets `.wrong` class + `.shake-wrong` animation (~600ms red flash + shake). If timeout: no `.wrong` flash, all MCQ buttons disabled.
   d. Correct option gets `.correct` class (green highlight) so student sees the answer.
   e. `gameState.lives -= 1`.
   f. `progressBar.update(currentRound, lives)` fires FIRST in round-complete handler — hearts update immediately with heart-break animation (`.heart-break` 600ms on the just-lost heart).
   g. Subtitle text is set based on trigger:
      - Wrong MCQ: `'Oops! This is not the correct sum!'`
      - Timeout: `"Time's up! The sum was " + correctSum`
   h. `await FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_SAD})` — awaited ~1000ms.
   i. `FeedbackManager.playDynamicFeedback({audio_content: 'Not quite — the sum was ' + correctSum + '.', subtitle: '<from step g>', sticker: STICKER_SAD}).catch(function(e){})` — FIRE-AND-FORGET.
   j. **Branch on `gameState.lives` after decrement:**
      - If `lives > 0` AND `N < 5`: route to `round_complete_interstitial` (step 8).
      - If `lives > 0` AND `N === 5`: correct-path Victory is not reached because the student got the last round wrong; instead, per the Flow diagram, correct-only path leads to Victory. Wrong/timeout on last round with lives remaining ALSO routes to `round_complete_interstitial` and then triggers Victory gating: if all 5 rounds are completed (attempted), evaluate Victory vs. Game-Over. Design decision: wrong-on-last-round with `lives > 0` → `victory` (step 10) with reduced stars. Score for that round is 0 but the 5-round session completed.
      - If `lives === 0`: route to `game_over` (step 9). Per CASE 8, the wrong SFX sequence already completed — do NOT skip it.

8. **Round-complete interstitial (after step 6h-N<5 or step 7j-lives>0).**
   a. `transitionScreen.show({ icons: ['⏱'], title: 'Average time: ' + avgTimeFormatted + 's', subtitle: gameState.currentRound + '/5 rounds complete', duration: 2000, onMounted: function() { FeedbackManager.sound.play('sound_next_round', {sticker: null}).catch(function(e){}); } })`.
   b. 2000ms auto-dismiss. No CTA.
   c. On dismiss: `gameState.currentRound += 1`; route to `round_intro` for new N.

9. **Game Over path (from step 7j when lives === 0, CASE 8 + CASE 12).**
   a. All MCQ + grid disabled (already done in step 7a).
   b. Wrong SFX sequence from step 7h-7i has already completed (≥1500ms min per feedback/SKILL.md CASE 8 — `await Promise.all([sound.play(...), playDynamicFeedback(...)])` equivalent). Do NOT skip.
   c. `gameState.phase = 'game_over'`.
   d. `window.parent.postMessage({ type: 'game_complete', payload: { score: gameState.score, totalQuestions: 5, stars: 0, accuracy: (gameState.score/5)*100, timeSpent: Date.now() - gameState.startTime } }, '*')` — fired BEFORE the Game Over screen's audio.
   e. `transitionScreen.show({ icons: ['😔'], title: 'Game Over', subtitle: 'You ran out of lives!', persist: true, buttons: [{ text: 'Try Again', type: 'primary', action: showMotivation }], onMounted: function() { FeedbackManager.sound.play('sound_game_over', {sticker: STICKER_SAD}); } })`.

10. **Victory path (from step 6h-N===5 OR step 7j-N===5-lives>0, CASE 11).**
    a. `gameState.phase = 'victory'`.
    b. Compute `gameState.stars`:
       - If all 5 rounds completed AND `lives === 3` → 3
       - If all 5 rounds completed AND `lives === 2` → 2
       - If all 5 rounds completed AND `lives === 1` → 1
       - (lives === 0 never reaches this branch — goes to game_over)
    c. `progressBar.update(5, lives)` fires FIRST (cross-cutting rule 0 — ensures final round shows 5/5 not 4/5 at Victory mount).
    d. `window.parent.postMessage({ type: 'game_complete', payload: { score: gameState.score, totalQuestions: 5, stars: gameState.stars, accuracy: (gameState.score/5)*100, timeSpent: Date.now() - gameState.startTime } }, '*')` — fired BEFORE the Victory screen's audio.
    e. Compute `avgTime = (sum(responseTimes) / responseTimes.length) / 1000` (seconds, one decimal).
    f. Build buttons array conditionally:
       - `stars === 3` → `[{ text: 'Claim Stars', type: 'primary', action: showStarsCollected }]`
       - `stars < 3` → `[{ text: 'Play Again', type: 'secondary', action: showMotivation }, { text: 'Claim Stars', type: 'primary', action: showStarsCollected }]`
    g. `transitionScreen.show({ stars: gameState.stars, title: 'Victory 🎉', subtitle: 'You completed all 5 rounds! Average time: ' + avgTime.toFixed(1) + 's', persist: true, buttons: <from step f>, onMounted: function() { FeedbackManager.sound.play('sound_game_victory', {sticker: STICKER_CELEBRATE}); /* then fire-and-forget VO matching star tier */ } })`.

### State changes per step

| Step | gameState fields changed | DOM update |
|------|--------------------------|------------|
| 1 Round starts | `currentRound=N`, `roundStartTime=Date.now()`, `isProcessing=false` | Grid renders (fade-in 350ms), MCQ buttons hidden, TimerComponent mounted (not started), progress bar `(N-1)/5` |
| 3 Gameplay reveal | — | MCQ fade-in 350ms, pointer-events enabled, Timer starts |
| 4a Tile tap | — (no gameState change) | Tile `.struck` class toggles; soft SFX fire-and-forget |
| 6a Correct processing flag | `isProcessing=true` | All MCQ + grid disabled |
| 6b Correct timer pause | `responseTimes.push(Δt)` | TimerComponent.pause() |
| 6d Correct score | `score+=1` | Score display bounces (`.score-bounce` 400ms) |
| 6e Correct progress bump | — (lives unchanged) | `progressBar.update(N, lives)` — progress fills to N/5 FIRST, before audio |
| 6f Correct SFX | — | Correct button `.correct` green flash 600ms; awaited SFX |
| 6g Correct TTS | — | Subtitle renders; fire-and-forget audio |
| 7a Wrong/Timeout processing flag | `isProcessing=true` | All MCQ + grid disabled |
| 7b Wrong/Timeout timer pause | `responseTimes.push(Δt or 15000)` | TimerComponent.pause() |
| 7c Wrong MCQ feedback | — | Tapped button `.wrong` + `.shake-wrong` 600ms |
| 7d Correct reveal | — | Correct option `.correct` green 600ms |
| 7e Life decrement | `lives-=1` | (DOM update happens in step 7f) |
| 7f Heart update + bump | — | `progressBar.update(N, lives)` FIRST — heart-break 600ms on just-lost heart |
| 7h Wrong SFX | — | Awaited incorrect sound |
| 7i Wrong TTS | — | Subtitle renders; fire-and-forget audio |
| 8 Interstitial | `currentRound+=1` (on dismiss) | TransitionScreen shows 2000ms, next-round SFX fire-and-forget |
| 9 Game Over | `phase='game_over'` | postMessage fires BEFORE audio, then TransitionScreen with `sound_game_over` |
| 10 Victory | `phase='victory'`, `stars=<1..3>` | `progressBar.update(5, lives)` FIRST, postMessage fires BEFORE audio, then TransitionScreen with stars |

### Critical ordering constraints (MEMORY.md + feedback/SKILL.md invariants)

1. **`gameState.isProcessing = true` is set BEFORE any `await`** in steps 6 and 7 (feedback/SKILL.md input-block rule).
2. **`progressBar.update()` is the FIRST action in the round-complete handler**, BEFORE `await FeedbackManager.sound.play(...)`, BEFORE `nextRound()`, BEFORE `endGame()` — otherwise the final round Victory shows N-1/N (MEMORY.md `progress_bar_round_complete`).
3. **TimerComponent mounts inside `.mathai-preview-header-center`** at `#timer-container`, visibly (not `display:none`), with inline 320x41 styles overridden, and with `#previewTimerText` emptied/hidden (MEMORY.md `timer_preview_integration`).
4. **VisibilityTracker's built-in PopupComponent handles pause/resume** via `autoShowPopup: true` — customize only through `popupProps`, never build a custom pause overlay (MEMORY.md `feedback_pause_overlay`).
5. **`game_complete` postMessage fires BEFORE Game Over / Victory audio** in steps 9d and 10d (feedback/SKILL.md CASE 11/12).
6. **Wrong SFX on last life is AWAITED (≥1500ms), not skipped**, before Game Over screen renders (feedback/SKILL.md CASE 8).
7. **Auto-advance does NOT await TTS** — `playDynamicFeedback(...)` is always fire-and-forget after the awaited short SFX (feedback/SKILL.md CASE 4/7).
8. **`renderRound()` / `loadRound()` is the single source of truth for re-enabling inputs** — the feedback handler must NOT manually set `isProcessing=false` or re-enable buttons.
