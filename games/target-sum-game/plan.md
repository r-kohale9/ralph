# Target Sum Game — Pre-Generation Plan

## game-flow.md

**One-liner:** 9 rounds of multi-tap selection on a staggered 3+4+2 card grid. Student taps cards (each card is either a plain number or a simple `a+b` expression) whose values sum to a target, then taps "Next Round" to submit.

**Shape:** Multi-round (default)
**Changes from default:** None

ASCII flow diagram: see `spec.md` `## Flow` section (copied verbatim from `alfred/skills/game-planning/reference/default-flow.md`).

**Stage table:**
| Stage | Rounds | Target range | Solution size | Distractor |
|-------|--------|-------------|---------------|-----------|
| 1 Warm-up | 1-3 | 300-330 | 2-3 cards | No |
| 2 Build | 4-6 | 320-330 | 3-4 cards | 0-1 |
| 3 Stretch | 7-9 | 330-340 | 3-4 cards | 1 |

Rounds 1 and 2 use the canonical targets 310 and 320 from the concept file; round 3 uses 330 to complete the stage curve.

---

## screens.md

### Preview (PART-039)
- Persistent: header (preview title, subtitle optional).
- Elements: instruction text (HTML), optional avatar, "Start" tap CTA managed by PreviewScreenComponent.
- Audio: `previewAudio` URL (deploy-time TTS) or runtime fallback.
- Exit: onComplete → `startGameAfterPreview(previewData)` → `showRoundIntro(1)`.

### Welcome / Level 1 transition
- Elements: sticker `STICKER_LEVEL`, title "Level 1", CTA "Let's Go!"
- Audio: `sound_level_transition` + `vo_level_start` (awaited sequentially; CTA interrupts).
- Exit: onAction → hide → `showRoundIntro(1)`.

NOTE: In this spec we combine Preview exit → directly into Round 1 intro without a standalone Welcome screen (keeps flow snappy for a speed-oriented game). The "Welcome" box in default-flow.md is fulfilled by the Preview itself for this game.

### Round N intro (auto-advance, no CTA)
| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent | no |
| Progress bar | below header | rounds N-1 completed, lives left | no |
| Sticker | top-center | `STICKER_ROUND` | no |
| Title | center | `'Round ' + n` | no |
| Audio | (auto, onMounted) | `rounds_sound_effect` + `STICKER_ROUND` | no |
| (no CTA — auto-dismiss on SFX end) | — | — | — |

### Gameplay (round body)
```
+-------------------------------------------+
| Preview header (avatar, title, star)      |  fixed
+-------------------------------------------+
| Progress bar (hearts + round counter)     |  PART-023
+-------------------------------------------+
| Target banner:  Make Sum  310             |  bold, large
+-------------------------------------------+
|                                           |
|    [card] [card] [card]                   |  row1: 3 cards centered
|     [card] [card] [card] [card]           |  row2: 4 cards centered
|       [card] [card]                       |  row3: 2 cards centered
|                                           |
+-------------------------------------------+
|                              [Next Round] |  yellow, bottom-right
+-------------------------------------------+
```
- Cards: white rounded rectangle, thin gray border, black text (`--mathai-primary` / `--mathai-text-primary`). Selected state: yellow-tinted background + yellow border. Correct-reveal: green bg. Wrong-pulse: red bg.
- Next Round: yellow (`--mathai-yellow`), bottom-right, min 44px height, disabled until ≥1 card selected.

### Game Over
Default template: `icons: ['😔']`, title `'Game Over'`, subtitle `'You ran out of lives!'`, button `'Try Again' → showMotivation`, audio `sound_game_over` + `STICKER_SAD`.

### Motivation ("Ready to improve your score? ⚡")
Default template: title `'Ready to improve your score? ⚡'`, button `"I'm ready! 🙌" → restartGame`, audio `rounds_sound_effect` + `STICKER_RESTART`, dynamic TTS `'Ready to improve your score?'`.

### Victory
Default: title `'Victory 🎉'`, stars `gameState.stars`, subtitle `'You solved {firstCheckSolves} of 9 on the first try!'`. Buttons: 3★ → `[Claim Stars]`; <3★ → `[Play Again, Claim Stars]`. Audio: `victory_sound_effect` (3★) or `game_complete_sound_effect` (<3★) + sticker by tier + dynamic VO.

### Stars Collected
Default: title `"Yay! 🎉\nStars collected!"`, `duration: 2500`, `styles: { title: { whiteSpace: 'pre-line' } }`, `onMounted: FeedbackManager.sound.play('victory_sound_effect', { sticker: STICKER_VICTORY })`. Auto-dismiss → `window.parent.postMessage({type:'game_exit'}, '*')` → `endGame(true)`.

---

## round-flow.md

### Round Type A — Make the Target Sum

1. `enterGameplay(n)` → `renderRound()`
2. `renderRound()`:
   - `gameState.isProcessing = false`
   - `gameState.isActive = true`
   - `gameState.selectedIds = []`
   - `gameState.roundStartTime = Date.now()`
   - `gameState.firstCheckThisRound = true`
   - Set `gameState.correctAnswer = round.target`
   - `syncDOM()`
   - Paint round: target banner, 9 cards in 3+4+2 staggered grid, Next Round button (disabled)
3. Student taps a card:
   - Guard: `if (gameState.isProcessing || gameState.gameEnded) return;`
   - If card `id` in `selectedIds`: remove it (deselect) + fire-and-forget `sound_bubble_deselect`
   - Else: push to `selectedIds` + fire-and-forget `sound_bubble_select`
   - Update card CSS class (`.card.selected`)
   - Update Next Round button enabled state (enabled if `selectedIds.length > 0`)
4. Student taps Next Round:
   - Guard as above
   - `gameState.isProcessing = true`
   - Compute `sum = Σ card.value for card.id in selectedIds`
   - If `sum === round.target`: correct path
   - Else: wrong path
5. **Correct path:**
   - `gameState.firstCheckSolves += (gameState.firstCheckThisRound ? 1 : 0)`
   - `gameState.score = gameState.firstCheckSolves`
   - `gameState.responseTimes.push(Date.now() - roundStartTime)`
   - `recordAttempt({correct: true, ...})` (PART-009, 12 fields)
   - `trackEvent('answer_submitted', ...)`
   - Highlight selected cards green
   - `progressBar.update(currentRound, lives)` (FIRST, before SFX)
   - `await Promise.all([FeedbackManager.sound.play('correct_sound_effect', {sticker:STICKER_CORRECT}), setTimeout 1500ms])`
   - `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}).catch(noop)` — fire-and-forget
   - `advanceAfterFeedback()`: `safeStopAllAudio()` → `showRoundIntro(++currentRound)` OR `showVictory()`
6. **Wrong path (lives > 1):**
   - `gameState.firstCheckThisRound = false`
   - `gameState.lives -= 1`
   - `recordAttempt({correct: false, misconception_tag: deriveMisconception(sum, target)})`
   - `trackEvent('answer_submitted', ...)`
   - Pulse selected cards red (600ms)
   - `progressBar.update(roundsCompleted, lives)` (FIRST)
   - `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect', {sticker:STICKER_WRONG}), 1500ms])`
   - fire-and-forget TTS "Your total is X. Target is 310. Try again."
   - Deselect all cards; `gameState.isProcessing = false`; stay on same round (student retries)
   - `syncDOM()`
7. **Wrong path (lives === 1, last life):**
   - Same as wrong path but AFTER awaited SFX+1500ms, go directly to Game Over
   - `gameState.lives = 0`; `progressBar.update(roundsCompleted, 0)`
   - `postGameComplete(false)` → `showGameOver()` (CASE 12)
   - `endGame(false)`

### State-change table
| Step | gameState mutation | DOM change |
|------|-------------------|-----------|
| Tap card (select) | `selectedIds.push(id)` | card gets `.selected` |
| Tap card (deselect) | `selectedIds = filter(id)` | card loses `.selected` |
| Submit correct | `firstCheckSolves++`, `score++`, `currentRound++` | cards turn green → round-intro transition |
| Submit wrong (lives>1) | `lives--`, `firstCheckThisRound=false` | cards pulse red → deselect → isProcessing false |
| Submit wrong (last life) | `lives=0` | cards pulse red → game-over screen |

---

## feedback.md

Bloom L3 Apply. Subtitle style: "Try [method hint]. The answer is [answer]." on wrong; "Correct approach!" on correct.

| Moment | SFX | TTS | Sticker | Duration | Await |
|--------|-----|-----|---------|----------|-------|
| Preview audio | `previewAudio` | via PreviewScreenComponent TTS fallback | none | ~5s | internal |
| Round N intro | `rounds_sound_effect` | none (auto-dismiss) | `STICKER_ROUND` | ~2s | awaited SFX, auto-hide |
| Card select | `sound_bubble_select` | none | none | ~0.5s | fire-and-forget |
| Card deselect | `sound_bubble_deselect` | none | none | ~0.5s | fire-and-forget |
| Correct submit | `correct_sound_effect` | "Correct approach! {a}+{b}+...={target}." | `STICKER_CORRECT` | 1.5s SFX + TTS | SFX awaited 1500ms; TTS fire-and-forget |
| Wrong submit | `incorrect_sound_effect` | "Your total is {sum}. Target is {target}. Try again." | `STICKER_WRONG` | 1.5s SFX + TTS | SFX awaited 1500ms; TTS fire-and-forget |
| Last life wrong | same as wrong | (skipped on last life) | `STICKER_WRONG` | 1.5s | SFX awaited 1500ms, THEN game over |
| Game Over | `game_over_sound_effect` | "Nice try — you completed {currentRound} rounds." | `STICKER_SAD` | 3-5s | screen first, `game_complete` postMessage first, then SFX+VO |
| Victory | `victory_sound_effect` (3★) or `game_complete_sound_effect` | "Amazing! {stars} stars! You solved {firstCheckSolves} of 9 on the first try." | tier sticker | 3-5s | screen first, postMessage first, then SFX+VO |
| Motivation | `rounds_sound_effect` | "Ready to improve your score?" | `STICKER_RESTART` | 2s | awaited sequentially |
| Stars Collected | `victory_sound_effect` | none | `STICKER_VICTORY` | 2.5s auto-dismiss | awaited SFX |

---

## scoring.md

- **Points:** `score = firstCheckSolves` (0-9).
- **Star thresholds:**
  - 3 stars: `firstCheckSolves >= 8` AND `avgResponseTime < 3000ms` AND all 9 rounds completed.
  - 2 stars: `firstCheckSolves >= 6` AND all 9 rounds completed.
  - 1 star: `firstCheckSolves >= 1`.
  - 0 stars: otherwise.
- **Lives:** 3 hearts. Decrement on every wrong submit. At 0 → Game Over.
- **Progress bar:** PART-023 with `totalRounds: 9`, `totalLives: 3`. Update after every submit.
- **Data-contract mapping:**
  - `metrics.accuracy` = `round(firstCheckSolves / totalRounds * 100)`
  - `metrics.stars` = `gameState.stars`
  - `metrics.time` = `(completedAt - startTime) / 1000` seconds
  - `metrics.attempts` = `gameState.attempts` array
  - `metrics.firstCheckSolves`, `metrics.avgResponseTime`, `metrics.livesRemaining`.
  - `payload.score` = `firstCheckSolves`.
