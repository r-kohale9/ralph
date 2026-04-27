# Pre-Generation Plan: Friendly Pairs

**Game ID:** `friendly-pairs`
**Archetype:** Lives Challenge (#3) adapted for multi-correct-per-round
**Shape:** Shape 2 Multi-round (with Lives branch to game_over)
**Bloom Level:** L2 Understand (Stage 3 leans L3 Apply)
**Rounds:** 9 (3 stages × 3 rounds)
**Lives:** 3 (carry across all 9 rounds)
**Viewport:** 375×667 mobile portrait

---

## 1. Screen Flow

### 1.1 Screen Inventory

| # | Screen | `data-phase` | DOM container IDs | Owner |
|---|--------|-------------|-------------------|-------|
| 1 | Preview | `preview` | `#previewScreen` (PreviewScreenComponent) | Persistent until tap-to-start |
| 2 | Welcome transition | `welcome` | `#transitionScreen` (TransitionScreen) | Auto after preview tap |
| 3 | Round intro (Round N) | `round_intro` | `#transitionScreen` | Before each of 9 rounds |
| 4 | Gameplay (Board N) | `gameplay` | `#gameContent` → `#board` (pill grid) | Active during round play |
| 5 | Round complete SFX | (overlay on gameplay) | FeedbackManager sticker overlay | 1500ms awaited |
| 6 | Game Over | `game_over` | `#transitionScreen` | If `lives === 0` |
| 7 | Motivation | `motivation` | `#transitionScreen` | After game_over CTA or < 3★ Victory CTA |
| 8 | Victory | `victory` | `#transitionScreen` | After Round 9 complete with lives > 0 |
| 9 | Stars Collected | `stars_collected` | `#transitionScreen` | After victory "Claim Stars" tap |

### 1.2 Persistent Fixtures (visible on every non-Preview screen)

- `.mathai-preview-header` — avatar, question label ("Friendly Pairs"), score, star count. Owned by PreviewScreenComponent (persistent DOM, not re-rendered).
- `#timer-container` mounted inside `.mathai-preview-header-center` showing count-up `TimerComponent`. Pauses on Preview/Victory/Game Over.
- `#progressBarContainer` (ProgressBarComponent) at top of `#gameContent` below header. Shows `N / 9` fill + 3 heart icons. Visible on screens 3–9.

### 1.3 Flow Diagram (copied from spec `## Flow`, normalized to canonical Shape 2 + lives branch)

```
Preview ──tap──▶ Welcome (trans.) ──auto──▶ Round N intro (trans., no buttons)
                                                     │ after "Round N" SFX/VO
                                                     ▼
                                             Board N gameplay
                                             (#board renders pills;
                                              per-pair timer starts)
                                                     │ tap on pill
                                                     ▼
                                         ┌── evaluate tap ───┐
                                         │                   │
                       correct (final pair?)            wrong
                          │      │                         │
                 not final│      │final                    │
                          │      │                         ▼
                          │      │                 lives-- → lives==0 ?
                          │      │                  │           │
                          │      │                 yes          no
                          │      │                  │           │
                          │      │                  ▼           ▼
                          │      │          game_over     stay on Board N
                          │      │          (screen 6)    (pill re-enables
                          │      │                          after shake)
                          │      ▼
                          │  progressBar.update FIRST
                          │  → awaited round_complete SFX + "Good job!"
                          │      │
                          │      ▼
                          │  N < 9 ?
                          │    │     │
                          │    yes   no
                          │    │     │
                          │    ▼     ▼
                          │ Round N+1  Victory (screen 8)
                          │  intro
                          │
                          └──(not final)──▶ stay on Board N,
                                            counter ✓ k/M++

Game Over ──"Try Again"──▶ Motivation ("Ready to improve your score?")
                              │ tap [I'm ready]
                              ▼
                          restart from Round 1 (skip Preview + Welcome)

Victory (1–2★) ──"Play Again"──▶ Motivation ──tap──▶ restart Round 1
Victory (any)  ──"Claim Stars"──▶ Stars Collected ──auto──▶ exit
```

### 1.4 Transitions (state deltas)

| From → To | Trigger | `gameState` mutations | DOM actions |
|-----------|---------|---------------------|-------------|
| Preview → Welcome | Tap preview CTA | `phase = 'welcome'` | `previewScreen.hide()`, `transitionScreen.show({title:"Hi, I'm Alfred!", …})`; start `TimerComponent` (paused until Board 1) |
| Welcome → Round 1 intro | Auto after welcome VO | `phase = 'round_intro'`, `currentRound = 1` | `transitionScreen.show({title:"Round 1", subtitle:"Find pairs that make 10", audio:'rounds_sound_effect'})`; ProgressBar rendered for first time |
| Round N intro → Board N | Auto after `Round N` SFX/VO finishes | `phase = 'gameplay'`, `roundStartAt = Date.now()`, `lastCorrectTapAt = roundStartAt`, `correctPairsFoundThisRound = 0`, `currentRoundData = fallbackContent.rounds[N-1]` | `transitionScreen.hide()`, `renderBoard()` populates `#board`, per-pair timer resets |
| Board N → Round complete | Final correct pair tapped | `correctPairsFoundThisRound = M`, `score += gain`, `fastPairs += (isFast?1:0)` | `progressBar.update(currentRound, lives)` FIRST, then awaited `round_complete` SFX |
| Board N → Round N+1 intro | After round_complete awaited | `currentRound++`, reset per-round counters | Board `#board.innerHTML = ''`, `transitionScreen.show({title:"Round N+1", …})` |
| Board N → Victory | After Round 9 round_complete awaited | `phase = 'victory'`, compute `stars` | `TimerComponent.pause()`, `transitionScreen.show({title:"You did it!", subtitle:`Pairs found: ${pairsFoundTotal}/33`, stars, ctas})`, send `game_complete` postMessage BEFORE audio, then awaited victory SFX + VO |
| Board N → Game Over | `lives === 0` after wrong tap | `phase = 'game_over'`, `stars = 0` | After ~1000ms wrong SFX, `transitionScreen.show({title:"You ran out of lives!", subtitle:`You found ${pairsFoundTotal} pairs across ${currentRound-1} rounds`, stars:0, cta:"Try Again"})`, `game_complete` postMessage BEFORE audio, then game_over SFX + VO |
| Game Over → Motivation | Tap "Try Again" | `phase = 'motivation'`, `FeedbackManager.sound.stopAll()` | `transitionScreen.show({title:"Ready to improve your score?", cta:"I'm ready", audio:'motivation_sound_effect'})` |
| Motivation → Restart | Tap "I'm ready" | Full `resetGameState()` → `currentRound = 1`, `lives = 3`, `score = 0`, `fastPairs = 0`, `pairsFoundTotal = 0`, fallbackContent reloaded | Skip Preview + Welcome; go directly to Round 1 intro |
| Victory → Motivation | Tap "Play Again" (1–2★) | Same as above | Same as above |
| Victory → Stars Collected | Tap "Claim Stars" | `phase = 'stars_collected'`, `FeedbackManager.sound.stopAll()` | `transitionScreen.show({title:"Yay, stars collected!", icons:['⭐'], audio:'stars_collected_sound_effect'})`, auto-dismiss after audio |
| Stars Collected → exit | Auto after audio | — | `window.parent.postMessage({type:'exit'}, '*')` |

---

## 2. Round-by-Round Breakdown

Each round renders:
1. Round intro transition (title `"Round N"`, subtitle `"Find pairs that make {targetSum}"`, audio `rounds_sound_effect` + `Round N` VO)
2. Board appears (fade-in 350ms), per-pair count-up timer starts
3. Progress bar shows `N / 9` with current `lives` hearts
4. Target banner reads `Make Sum {targetSum}`
5. `✓ 0/M` counter visible below board where M = `correctPairs.length`

| Round | Stage | targetSum | Pills on board | Correct pills (M) | Distractor trap types |
|-------|-------|-----------|----------------|-------------------|----------------------|
| 1 | 1 | 10 | 8 | 3 (`p1,p3,p5`) | off-by-1 under/over, off-by-2 over |
| 2 | 1 | 10 | 8 | 3 (`p1,p3,p5`) | mostly off-by-1 under, one off-by-2 over |
| 3 | 1 | 10 | 8 | 3 (`p1,p3,p5`) | balanced off-by-1, one off-by-2 over |
| 4 | 2 | 12 | 10 | 4 (`p1,p3,p5,p7`) | off-by-1 mix + 1 concat-not-add (`2·1`) |
| 5 | 2 | 15 | 10 | 4 (`p1,p3,p5,p7`) | off-by-1/off-by-2, cross-10 (9+7, 8+8) |
| 6 | 2 | 18 | 10 | 4 (`p1,p3,p5,p7`) | off-by-1 cross-10 + concat trap (`7·1`) |
| 7 | 3 | 15 | 12 | 4 (`p1,p2,p3,p4`) | off-by-1/2, off-by-2 under, concat (`5·1`) |
| 8 | 3 | 18 | 12 | 4 (`p1,p2,p3,p4`) | off-by-1 with swap-pair illusions, concat (`1·8`) |
| 9 | 3 | 20 | 12 | 4 (`p1,p2,p3,p4`) | off-by-1, swap-pair illusion (`17·4`), concat (`2·0`) |

**Total correct pairs across session:** 3+3+3 + 4+4+4 + 4+4+4 = **33**

### Per-round student experience (Round 1 worked example)

- Intro: "Round 1" — subtitle "Find pairs that make 10"
- Board shows 8 pills in 2×4 staggered grid:
  `6·4 | 5·4 | 2·8 | 7·2 | 3·7 | 4·7 | 6·5 | 8·4`
- Target banner: **Make Sum 10**
- Counter below: `✓ 0/3`
- Lives: 3 hearts in header
- Student taps `6·4` → pill turns purple, counter `✓ 1/3`, timer resets
- Student taps `5·4` (wrong, sum=9) → pill red-shake, lives→2, ✗ badge flashes, pill re-enables
- Student taps `2·8` → purple, `✓ 2/3`
- Student taps `3·7` → purple, `✓ 3/3` — progress bar bumps to `1/9` FIRST, then `"Good job!"` awaited
- Auto-advance to Round 2 intro

---

## 3. Scoring & Lives Logic (pseudocode)

```
// Constants
TOTAL_ROUNDS = 9
TOTAL_CORRECT_PAIRS = 33      // 3+3+3+4+4+4+4+4+4
STARTING_LIVES = 3
FAST_PAIR_WINDOW_MS = 2000

// State counters
gameState.score = 0                    // internal analytics only
gameState.fastPairs = 0
gameState.pairsFoundTotal = 0
gameState.correctPairsFoundThisRound = 0
gameState.lives = 3
gameState.lastCorrectTapAt = roundStartAt  // reset on round start + every correct tap

// On every pill tap
function onPillTap(pillId, pillData, currentRoundData):
    if gameState.lockedPills.has(pillId): return
    isCorrect = currentRoundData.correctPills.includes(pillId)
    if isCorrect:
        now = Date.now()
        isFast = (now - gameState.lastCorrectTapAt) <= FAST_PAIR_WINDOW_MS
        gameState.score += isFast ? 2 : 1
        if isFast: gameState.fastPairs++
        gameState.pairsFoundTotal++
        gameState.correctPairsFoundThisRound++
        gameState.lastCorrectTapAt = now
        gameState.lockedPills.add(pillId)
        recordAttempt({is_correct: true, misconception_tag: null, …})
        handleCorrectTap(pillId, currentRoundData)
    else:
        gameState.lives--
        // per-pair timer NOT reset on wrong
        recordAttempt({is_correct: false,
                       misconception_tag: currentRoundData.misconception_tags[pillId], …})
        handleWrongTap(pillId, currentRoundData)

// Star computation (ONLY at Victory)
function computeStars():
    if gameState.lives <= 0: return 0
    ratio = gameState.fastPairs / TOTAL_CORRECT_PAIRS   // 33
    if gameState.fastPairs >= 27 && gameState.lives > 0: return 3   // ≥80%
    if gameState.fastPairs >= 17 && gameState.lives > 0: return 2   // ≥50%
    return 1                                                         // finished, lives>0, <50% fast

// Lives zero check (inside handleWrongTap)
if gameState.lives === 0:
    // allow wrong-tap SFX + shake to land ~1000ms then:
    setTimeout(() => {
        game_complete(postMessage, stars:0)          // BEFORE audio
        transitionScreen.show(game_over payload)     // screen first
        await FeedbackManager.sound.play('game_over_sound_effect', {sticker:'alfred_sad'})
        await FeedbackManager.playDynamicFeedback({
            audio_content: "Good try — let's practice those friendly pairs again!",
            subtitle: "Good try — let's practice those friendly pairs again!",
            sticker: 'alfred_sad'
        })
    }, 1000)

// Round complete (final correct pair)
if gameState.correctPairsFoundThisRound === currentRoundData.correctPills.length:
    progressBar.update(gameState.currentRound, gameState.lives)   // FIRST
    await FeedbackManager.sound.play('all_correct', {sticker:'alfred_happy'})
    // subtitle "Good job!" via sticker overlay or updateSubtitle
    if gameState.currentRound === 9:
        startVictory()
    else:
        gameState.currentRound++
        gameState.correctPairsFoundThisRound = 0
        gameState.lockedPills.clear()
        renderRoundIntro(gameState.currentRound)
```

---

## 4. Feedback Patterns (per answer type)

Every row below is a `FeedbackManager` call. "Multi-step archetype" means SFX + sticker only, fire-and-forget, no dynamic TTS, NO input blocking (per `skills/feedback/SKILL.md` CASE 5/7 multi-step variant).

| # | Moment | Trigger | CASE | Call | Sticker | Await? | Blocks input? |
|---|--------|---------|------|------|---------|--------|---------------|
| 1 | Board render | Round intro ends, `#board` rendered | CASE 17 | `FeedbackManager.sound.play('card_appear', {sticker:null}).catch(()=>{})` | none | No (fire-and-forget) | No |
| 2 | Correct tap (not final) | `a+b === targetSum`, more pairs remain | CASE 5 (multi-step) | `FeedbackManager.sound.play('correct_sound_effect', {sticker:'alfred_happy'}).catch(()=>{})` | `alfred_happy` | No | No |
| 3 | Wrong tap (lives > 0 post-decrement) | `a+b !== targetSum` | CASE 7 (multi-step variant) | `FeedbackManager.sound.play('incorrect_sound_effect', {sticker:'alfred_sad'}).catch(()=>{})` | `alfred_sad` | No | No |
| 4 | Final correct pair of round | `correctPairsFoundThisRound === M` | CASE 6 | `await FeedbackManager.sound.play('all_correct', {sticker:'alfred_celebrate'})` | `alfred_celebrate` | **Yes** | Yes (board locked until resolved) |
| 5 | Round intro (Round N) | Round intro screen shown | CASE 2 Variant A (auto-advance) | `await FeedbackManager.sound.play('rounds_sound_effect', {sticker:'alfred_pointing'})` → `await FeedbackManager.playDynamicFeedback({audio_content:`Round ${N}`, subtitle:`Round ${N}`, sticker:'alfred_pointing'})` | `alfred_pointing` | Yes (sequential, no CTA) | Yes until sequence ends |
| 6 | Welcome | Welcome transition shown | CASE 1 | `await FeedbackManager.sound.play('welcome_sound_effect', {sticker:'alfred_happy'})` → `await FeedbackManager.playDynamicFeedback({audio_content:"Hi! Let's find friendly pairs that make the target sum. Ready?", subtitle:"Let's find friendly pairs!", sticker:'alfred_happy'})` | `alfred_happy` | Yes | CTA visible; CTA interrupts |
| 7 | Last life lost | `lives === 0` after wrong tap | CASE 8 + CASE 12 | 1. ~1000ms delay for wrong SFX/shake to land 2. `postMessage({type:'game_complete', stars:0, …})` 3. `transitionScreen.show(game_over)` FIRST 4. `await FeedbackManager.sound.play('game_over_sound_effect', {sticker:'alfred_sad'})` 5. `await FeedbackManager.playDynamicFeedback({audio_content:"Good try — let's practice those friendly pairs again!", subtitle:"Good try — let's practice those friendly pairs again!", sticker:'alfred_sad'})` | `alfred_sad` | Yes (sequential) | CTA "Try Again" interrupts |
| 8 | Victory (3★) | Round 9 complete, fastPairs ≥ 27, lives > 0 | CASE 11 | screen FIRST → `postMessage(game_complete)` → `await sound.play('victory_sound_effect', {sticker:'alfred_celebrate'})` → `await playDynamicFeedback({audio_content:"Super-fast friend-finder!", subtitle:"Super-fast friend-finder!", sticker:'alfred_celebrate'})` | `alfred_celebrate` | Yes | CTA interrupts |
| 9 | Victory (2★) | fastPairs 17–26, lives > 0 | CASE 11 | same with `audio_content:"Nice work!"` | `alfred_happy` | Yes | CTA interrupts |
| 10 | Victory (1★) | fastPairs < 17, lives > 0 | CASE 11 | same with `audio_content:"You finished — let's get faster next time!"` | `alfred_happy` | Yes | CTA interrupts |
| 11 | Motivation | Arrived via Game Over "Try Again" or Victory "Play Again" | CASE 10 | `await FeedbackManager.sound.play('motivation_sound_effect', {sticker:'alfred_pointing'})` → `await playDynamicFeedback({audio_content:"Ready to improve your score?", subtitle:"Ready to improve your score?", sticker:'alfred_pointing'})` | `alfred_pointing` | Yes | CTA "I'm ready" interrupts |
| 12 | Stars Collected | Victory "Claim Stars" tapped | CASE 9 | `await FeedbackManager.sound.play('stars_collected_sound_effect', {sticker:'alfred_celebrate'})` | `alfred_celebrate` | Yes | Auto-exit after audio |
| 13 | Visibility hidden | `document.visibilityState === 'hidden'` | CASE 14 | `VisibilityTracker` (autoShowPopup:true) pauses all audio + timer; renders its built-in pause popup | — | Managed by VisibilityTracker | Timer paused |
| 14 | Visibility restored | `visibilitychange` → visible | CASE 15 | VisibilityTracker dismisses popup; `timerInstance.resume()`; `FeedbackManager.sound.resumeAll()` | — | — | Timer resumed |

### Subtitle examples (3 concrete per type)

**Correct (multi-step):** no subtitle (SFX + sticker only).

**Wrong (multi-step):** no subtitle; visual red ✗ badge only.

**Round complete:** always `"Good job!"` (single awaited subtitle tied to `all_correct` SFX).

**Victory:**
- 3★: `"Super-fast friend-finder!"`
- 2★: `"Nice work!"`
- 1★: `"You finished — let's get faster next time!"`

**Game Over:** `"Good try — let's practice those friendly pairs again!"`

**Round intro:** `"Round 1"`, `"Round 2"`, …, `"Round 9"` (subtitle matches `audio_content`).

---

## 5. State Shape (`gameState`)

```js
const gameState = {
  // Phase
  phase: 'preview', // 'preview' | 'welcome' | 'round_intro' | 'gameplay'
                    // | 'game_over' | 'motivation' | 'victory' | 'stars_collected'

  // Progression
  currentRound: 0,            // 0 before Round 1 intro, increments to 1..9
  totalRounds: 9,

  // Per-round transient
  currentRoundData: null,     // reference into fallbackContent.rounds[currentRound-1]
  correctPairsFoundThisRound: 0,
  lockedPills: new Set(),     // pill ids that have been correctly tapped (purple + disabled)
                              // cleared at round start

  // Session aggregates
  lives: 3,
  score: 0,                   // internal analytics: +1 per correct, +2 per fast-correct
  fastPairs: 0,               // 0..33
  pairsFoundTotal: 0,         // 0..33

  // Timing
  startTime: null,            // Date.now() at first Round 1 intro
  roundStartAt: null,         // Date.now() at current Board N render
  lastCorrectTapAt: null,     // Date.now() used for fast-pair window; reset on round start + every correct tap

  // Star result (set at Victory)
  stars: null,                // 0 | 1 | 2 | 3

  // Guards
  isProcessing: false,        // true only during awaited round-complete / transitions
  isPaused: false,            // VisibilityTracker managed

  // Content
  fallbackContent: /* full spec object */,

  // Component handles
  timerInstance: null,        // TimerComponent (count-up)
  progressBarInstance: null,  // ProgressBarComponent
  previewScreen: null,        // PreviewScreenComponent
  transitionScreen: null,     // TransitionScreen
  visibilityTracker: null,    // VisibilityTracker
};
```

**Invariants (asserted on round load):**
- `currentRoundData.correctPills.length + Object.keys(currentRoundData.misconception_tags).length === currentRoundData.pills.length`
- Every `pills[i].id` is either in `correctPills` OR a key in `misconception_tags`.
- `lives ∈ [0, 3]`; `fastPairs ≤ pairsFoundTotal ≤ 33`.
- `correctPairsFoundThisRound ≤ correctPills.length`.

---

## 6. Key Event Handlers

### 6.1 `onPillClick(event)` — the central handler

```
function onPillClick(event):
    if gameState.isProcessing: return
    if gameState.phase !== 'gameplay': return
    pillEl = event.currentTarget
    pillId = pillEl.dataset.pillId
    if gameState.lockedPills.has(pillId): return

    pillData = gameState.currentRoundData.pills.find(p => p.id === pillId)
    isCorrect = gameState.currentRoundData.correctPills.includes(pillId)

    if isCorrect:
        handleCorrectPill(pillEl, pillId)
    else:
        handleWrongPill(pillEl, pillId, pillData)
```

### 6.2 `handleCorrectPill(pillEl, pillId)`

```
now = Date.now()
isFast = (now - gameState.lastCorrectTapAt) <= 2000
gameState.score += isFast ? 2 : 1
if isFast: gameState.fastPairs++
gameState.pairsFoundTotal++
gameState.correctPairsFoundThisRound++
gameState.lastCorrectTapAt = now
gameState.lockedPills.add(pillId)

pillEl.classList.add('pill-correct', 'scale-pulse')   // 200ms
pillEl.setAttribute('aria-disabled', 'true')
updateCounter(gameState.correctPairsFoundThisRound, M) // ✓ N/M text

recordAttempt({
    is_correct: true,
    misconception_tag: null,
    user_answer: `${pillData.a}+${pillData.b}`,
    correct_answer: `sum=${gameState.currentRoundData.targetSum}`,
    question: `Make sum ${gameState.currentRoundData.targetSum}`,
    time_taken_ms: now - gameState.roundStartAt
})

M = gameState.currentRoundData.correctPills.length
isFinalPair = gameState.correctPairsFoundThisRound === M

if !isFinalPair:
    // fire-and-forget SFX (CASE 5 multi-step)
    FeedbackManager.sound.play('correct_sound_effect', {sticker:'alfred_happy'}).catch(()=>{})
    return

// === Final correct pair of round ===
gameState.isProcessing = true
progressBar.update(gameState.currentRound, Math.max(0, gameState.lives))  // FIRST
await delay(400)                         // fade-out board
boardEl.classList.add('board-clear')     // fade 400ms
await FeedbackManager.sound.play('all_correct', {sticker:'alfred_celebrate'})
FeedbackManager.updateSubtitle('Good job!')   // briefly during SFX
await delay(300)

if gameState.currentRound === 9:
    startVictory()
else:
    gameState.currentRound++
    gameState.correctPairsFoundThisRound = 0
    gameState.lockedPills.clear()
    gameState.isProcessing = false
    renderRoundIntro(gameState.currentRound)
```

### 6.3 `handleWrongPill(pillEl, pillId, pillData)`

```
gameState.lives--
updateHearts(gameState.lives)

pillEl.classList.add('pill-wrong', 'shake-wrong')   // 600ms CSS keyframe
xBadgeEl.classList.add('x-flash')                    // 600ms auto-hide
setTimeout(() => {
    pillEl.classList.remove('pill-wrong', 'shake-wrong')
    xBadgeEl.classList.remove('x-flash')
}, 600)

FeedbackManager.sound.play('incorrect_sound_effect', {sticker:'alfred_sad'}).catch(()=>{})

recordAttempt({
    is_correct: false,
    misconception_tag: gameState.currentRoundData.misconception_tags[pillId],
    user_answer: `${pillData.a}+${pillData.b}`,
    correct_answer: `sum=${gameState.currentRoundData.targetSum}`,
    question: `Make sum ${gameState.currentRoundData.targetSum}`,
    time_taken_ms: Date.now() - gameState.roundStartAt
})
// per-pair timer (lastCorrectTapAt) NOT reset — wrong tap does not grant free speed bonus

if gameState.lives === 0:
    gameState.isProcessing = true
    setTimeout(() => startGameOver(), 1000)   // let wrong SFX/shake land
```

### 6.4 `startVictory()`

```
gameState.phase = 'victory'
gameState.timerInstance.pause()
gameState.stars = computeStars()

// SCREEN FIRST
transitionScreen.show({
    type: 'victory',
    icons: ['⭐'],
    title: 'You did it!',
    subtitle: `Pairs found: ${gameState.pairsFoundTotal}/33 · Fast pairs: ${gameState.fastPairs} · Lives left: ${gameState.lives}`,
    stars: gameState.stars,
    buttons: gameState.stars < 3
        ? [{label:'Play Again', action:'play_again'}, {label:'Claim Stars', action:'claim_stars'}]
        : [{label:'Claim Stars', action:'claim_stars'}]
})

// game_complete BEFORE audio
window.parent.postMessage({
    type: 'game_complete',
    score: gameState.score,
    totalQuestions: 33,
    correctAnswers: gameState.pairsFoundTotal,
    stars: gameState.stars,
    accuracy: Math.round((gameState.pairsFoundTotal/33)*100),
    timeSpent: Date.now() - gameState.startTime
}, '*')

// Then awaited victory audio (CASE 11); CTA interrupts
voByTier = {3:"Super-fast friend-finder!", 2:"Nice work!", 1:"You finished — let's get faster next time!"}
stickerByTier = {3:'alfred_celebrate', 2:'alfred_happy', 1:'alfred_happy'}
await FeedbackManager.sound.play('victory_sound_effect', {sticker: stickerByTier[gameState.stars]})
await FeedbackManager.playDynamicFeedback({
    audio_content: voByTier[gameState.stars],
    subtitle: voByTier[gameState.stars],
    sticker: stickerByTier[gameState.stars]
})
```

### 6.5 `startGameOver()`

```
gameState.phase = 'game_over'
gameState.timerInstance.pause()
gameState.stars = 0

// SCREEN FIRST
transitionScreen.show({
    type: 'game_over',
    icons: ['😔'],
    title: 'You ran out of lives!',
    subtitle: `You found ${gameState.pairsFoundTotal} pairs across ${Math.max(0, gameState.currentRound-1)} rounds`,
    buttons: [{label:'Try Again', action:'try_again'}]
})

// game_complete BEFORE audio
window.parent.postMessage({
    type: 'game_complete',
    score: gameState.score,
    totalQuestions: 33,
    correctAnswers: gameState.pairsFoundTotal,
    stars: 0,
    accuracy: Math.round((gameState.pairsFoundTotal/33)*100),
    timeSpent: Date.now() - gameState.startTime
}, '*')

// Then awaited game-over audio (CASE 8 + 12); CTA "Try Again" interrupts
await FeedbackManager.sound.play('game_over_sound_effect', {sticker:'alfred_sad'})
await FeedbackManager.playDynamicFeedback({
    audio_content: "Good try — let's practice those friendly pairs again!",
    subtitle: "Good try — let's practice those friendly pairs again!",
    sticker: 'alfred_sad'
})
```

### 6.6 `onRestart()` — handles both "Try Again" (after Game Over) and "Play Again" (after < 3★ Victory)

```
function onRestart():
    FeedbackManager.sound.stopAll()    // includes stream stop
    gameState.phase = 'motivation'
    transitionScreen.show({
        type: 'motivation',
        icons: ['💪'],
        title: 'Ready to improve your score?',
        buttons: [{label:"I'm ready", action:'restart_confirmed'}]
    })
    // motivation audio via onMounted
    await FeedbackManager.sound.play('motivation_sound_effect', {sticker:'alfred_pointing'})
    await FeedbackManager.playDynamicFeedback({
        audio_content: "Ready to improve your score?",
        subtitle: "Ready to improve your score?",
        sticker: 'alfred_pointing'
    })

function onRestartConfirmed():       // bound to "I'm ready" CTA
    FeedbackManager.sound.stopAll()
    resetGameState()
    // Skip Preview + Welcome per PART-039 — go directly to Round 1 intro
    gameState.currentRound = 1
    gameState.startTime = Date.now()
    gameState.timerInstance.reset(); gameState.timerInstance.start()
    renderRoundIntro(1)

function resetGameState():
    gameState.lives = 3
    gameState.score = 0
    gameState.fastPairs = 0
    gameState.pairsFoundTotal = 0
    gameState.correctPairsFoundThisRound = 0
    gameState.lockedPills.clear()
    gameState.stars = null
    gameState.isProcessing = false
    // Fresh fallbackContent reference (already loaded; rounds array is read-only)
    updateHearts(3)
    progressBar.update(0, 3)
```

### 6.7 `onClaimStars()` — Victory "Claim Stars" CTA

```
function onClaimStars():
    FeedbackManager.sound.stopAll()
    gameState.phase = 'stars_collected'
    transitionScreen.show({
        type: 'stars_collected',
        icons: ['⭐'],
        title: 'Yay, stars collected!',
        buttons: []   // no CTA; auto-advance
    })
    await FeedbackManager.sound.play('stars_collected_sound_effect', {sticker:'alfred_celebrate'})
    window.parent.postMessage({type:'exit'}, '*')
```

### 6.8 `VisibilityTracker` handlers (CASE 14 / 15)

```
visibilityTracker = new VisibilityTracker({
    autoShowPopup: true,           // built-in pause overlay — DO NOT build a custom overlay
    onHidden: () => {
        gameState.isPaused = true
        gameState.timerInstance.pause()
        FeedbackManager.sound.pauseAll()
    },
    onVisible: () => {
        gameState.isPaused = false
        gameState.timerInstance.resume()
        FeedbackManager.sound.resumeAll()
    }
})
```

---

## 7. Gameplay Screen DOM Structure

```
<div id="gameContainer" data-phase="gameplay">
  <div class="mathai-preview-header">         <!-- persistent, from PreviewScreenComponent -->
    <div class="mathai-preview-header-left">avatar + "Friendly Pairs"</div>
    <div class="mathai-preview-header-center">
      <div id="timer-container"></div>         <!-- TimerComponent mount -->
    </div>
    <div class="mathai-preview-header-right">score + star</div>
  </div>

  <div id="progressBarContainer"></div>        <!-- N/9 + 3 hearts -->

  <div id="gameContent">
    <div id="targetBanner">Make Sum 10</div>
    <div id="board" class="board-grid"></div>  <!-- 2-col staggered grid of pills -->
    <div id="pairCounter">✓ 0/3</div>
    <div id="xBadge" class="hidden">✗</div>    <!-- wrong-tap flash -->
  </div>

  <div id="transitionScreen" class="hidden"></div>  <!-- TransitionScreen mount -->
  <div id="previewScreen" class="hidden"></div>     <!-- PreviewScreenComponent (only visible during preview phase) -->
</div>
```

Each pill:
```
<button class="pill"
        data-pill-id="p1"
        data-a="6" data-b="4"
        aria-label="Pair 6 and 4">
  <span class="pill-num">6</span>
  <span class="pill-dot">·</span>
  <span class="pill-num">4</span>
</button>
```

CSS: grid `grid-template-columns: 1fr 1fr`; every odd-indexed row offset by `margin-left: 24px` (staggered). Min-height `64px` per pill (>44px touch target); row-gap `12px`, column-gap `12px` (>8px spacing).

---

## 8. Cross-Validation Checklist (pre-handoff to game-building)

- [x] Every screen in §1.1 appears in the flow diagram (§1.3) and has an explicit transition row (§1.4).
- [x] Every feedback moment (§4) maps to a step in the handlers (§6).
- [x] Star formula (§3) matches `fastPairs` counter incremented in `handleCorrectPill` (§6.2).
- [x] `progressBar.update(currentRound, lives)` is the FIRST action on final-correct-pair (§6.2), per `progress_bar_round_complete` memory.
- [x] Pause overlay is VisibilityTracker-owned (§6.8), per `feedback_pause_overlay` memory.
- [x] Timer mounts in `.mathai-preview-header-center` visibly (§7), per `timer_preview_integration` memory.
- [x] `game_complete` postMessage fires BEFORE victory and game-over audio (§6.4, §6.5), per CASE 11/12.
- [x] Correct taps (mid-round) are fire-and-forget CASE 5 multi-step — NO input blocking (§4 row 2, §6.2).
- [x] Wrong taps (lives > 0 after decrement) are fire-and-forget CASE 7 multi-step — pill re-enables after 600ms shake (§4 row 3, §6.3).
- [x] Round-complete SFX is awaited CASE 6 (§4 row 4).
- [x] Lives-zero path awaits game_over SFX + VO per CASE 8 + 12 (§4 row 7, §6.5).
- [x] All 33 correct pairs accounted for: 3+3+3 + 4+4+4 + 4+4+4 = 33 (§2 table).
- [x] Every non-correct pill on every round has a `misconception_tags` entry (spec invariant, §5 invariants).
- [x] Restart path skips Preview + Welcome per PART-039 (§6.6).
- [x] No on-screen instruction text on gameplay screens — how-to-play is owned by PreviewScreenComponent (`previewInstruction` + `previewAudioText` from spec).
