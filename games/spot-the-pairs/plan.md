# Pre-Generation Plan: Spot the Pairs — Friendly Pairs Sum Challenge

**Game ID:** spot-the-pairs
**Archetype:** Speed Blitz (#2) — Shape 2 (Multi-round, per-tap multi-step within each round)
**Bloom:** L2 Understand
**Interaction:** P1 Tap — multi-select, multi-step (tap each correct pill; per-tap evaluation; level-clear when all correct pills found)
**Rounds:** 4 (Levels 1–4, alternating target 10 ↔ 20)
**Lives:** 3 (global across the game)
**Timer:** Visual count-up only in header (not enforced); speed bonus = ≤2s/pair
**PreviewScreen:** YES (mandatory per PART-039)

---

## 1. Screen Flow

```
DOMContentLoaded
      │
      ▼
 setupGame()
   • injectGameHTML()
   • renderInitialState()   ← paints Round 1 scaffold non-interactive
   • previewScreen.show(...) ← LAST step
      │
      │ preview onComplete (skip OR audio-end)
      ▼
 startGameAfterPreview(previewData)
   • gameState.startTime = Date.now()
   • gameState.isActive  = true
      │
      ▼
┌───────────── Round N Transition (TransitionScreen) ───────────┐
│ icons: ['🔟'] or ['2️⃣0️⃣']  (target-specific emoji, not stars) │
│ title: "Level N"                                              │
│ subtitle: "Make Sum 10" or "Make Sum 20"                      │
│ onMounted: await SFX('rounds_sound_effect') → await VO       │
│ auto-advance ≈900ms after audio settles                       │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌────────── Gameplay Round N (data-phase="gameplay") ───────────┐
│ Header: Q N · timer · 10-star counter · lives (CDN ProgBar)   │
│ Banner: "Make Sum 10" / "Make Sum 20"                         │
│ Board: staggered 3+3+2 pills (8 pills)                        │
│ Footer: yellow "Next Round" CTA (disabled)                    │
│                                                               │
│ Tap loop per pill (P1 multi-step):                            │
│  ┌──────────────────────────────────────────────┐             │
│  │ correct (not yet tapped)  → purple + await   │             │
│  │   SFX('correct') (Promise.all 1500ms),       │             │
│  │   fade pill, foundCorrect++, speed-check,    │             │
│  │   starCount++ (if ≤2s from lastRef),         │             │
│  │   update CDN progressBar(level, lives),      │             │
│  │   recordAttempt({correct: true})             │             │
│  │                                              │             │
│  │ distractor → red flash + await               │             │
│  │   SFX('incorrect') (Promise.all 1500ms),     │             │
│  │   lives--, syncDOM,                          │             │
│  │   recordAttempt({correct: false, miscTag}),  │             │
│  │   if lives==0 → endGame(false)               │             │
│  └──────────────────────────────────────────────┘             │
│                                                               │
│ foundCorrect == correctCount → enable "Next Round" CTA         │
└────────────────┬───────────────────────┬──────────────────────┘
                 │ Next Round tap        │ lives==0
                 ▼                       ▼
      (if N<4) Level N+1 intro     [Game Over TransitionScreen]
      (if N==4) Victory            │
                                   ▼
                             [Try Again CTA] → restartGame()
```

**Shape:** Shape 2 Multi-round with customizations:
1. **Multi-tap-per-round** — within each round, evaluation is per-tap until `foundCorrect == correctCount`.
2. **Explicit "Next Round" CTA, no auto-advance between levels.**
3. **Wrong tap does not advance the round** (stays in same level unless lives==0).
4. **Game Over branch retained** (lives==0 at any level).

**Entry/exit triggers table:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen (preview state) | `start_screen` | `DOMContentLoaded` → `setupGame()` → `previewScreen.show()` | skip / audio-end → `onComplete` → `startGameAfterPreview()` |
| Round N intro | `round_intro` | before each round (N=1..4) | auto-advance after SFX+VO settle (≈900ms) |
| Gameplay Round N | `gameplay` | round intro auto-complete | `foundCorrect == correctCount` → enable CTA (stay in gameplay); OR lives==0 → endGame(false) |
| (CTA-tap advance) | `round_intro` | "Next Round" CTA tap on gameplay screen | — |
| Victory | `results` | after Round 4 cleared (`foundCorrect == correctCount` AND `currentRound == 4`) + Next Round tap OR direct advance | Claim Stars → Stars Collected; Play Again → Motivation |
| Game Over | `results` | lives == 0 at any round | Try Again → restartGame() |
| Motivation | `results` (transition) | Play Again on Victory stars<3 | "I'm ready! 🙌" → `restartGame()` |
| Stars Collected | `results` (transition) | "Claim Stars" on Victory | auto 2500ms → `postMessage({type:'game_exit'})` |

**ProgressBar** (CDN `ProgressBarComponent`):
- 4 segments (one per level).
- `progressBar.update(0, 3)` at start.
- Entering Round N: `update(N-1, lives)`.
- Correct tap that clears the level: `update(N, lives)` FIRST (per MEMORY.md `progress_bar_round_complete`) — before level-complete audio.
- Wrong tap: `update(roundsCompleted, lives - 1)` after `lives--` (hearts decrement).
- Victory: `update(4, lives)` FIRST, before Victory audio.
- Restart: `createProgressBar()` re-inits to `(0, 3)`.

---

## 2. Round-by-Round Breakdown

All pill data is copied verbatim from spec `fallbackContent.rounds[]`. Pill IDs are stable for test determinism.

| R / L | Target | Correct pills (ids → expr) | Distractors | Correct count | Misconception focus |
|---|---|---|---|---|---|
| 1 | 10 | p1_1=6+4, p1_4=2+8, p1_7=5+5 | p1_2=5+6, p1_3=3+8, p1_5=4+5, p1_6=7+4, p1_8=6+3 | 3 | off-by-one-under/over |
| 2 | 20 | p2_1=13+7, p2_3=12+8, p2_5=14+6 | p2_2=11+8, p2_4=15+4, p2_6=12+7, p2_7=13+9, p2_8=11+7 | 3 | off-by-one-under/over, place-value-drop |
| 3 | 10 | p3_1=7+3, p3_3=8+2, p3_5=4+6, p3_7=9+1 | p3_2=5+6, p3_4=6+3, p3_6=3+8, p3_8=4+5 | 4 | fluency, denser distractors |
| 4 | 20 | p4_1=15+5, p4_3=11+9, p4_5=13+7, p4_7=12+8 | p4_2=14+7, p4_4=13+5, p4_6=16+3, p4_8=11+7 | 4 | off-by-one/two, place-value-drop |

**Layout mapping (staggered 3+3+2):**

```
Row 1 (top):    [pill idx 0] [pill idx 1] [pill idx 2]
Row 2 (middle): [pill idx 3] [pill idx 4] [pill idx 5]
Row 3 (bottom):     [pill idx 6] [pill idx 7]   (centred under cols 0,1)
```

`round.pills[i]` maps directly to `i`-th grid slot. Row 3 (the 2-pill row) is offset leftwards by half a column so pills 6 and 7 sit centred under columns 0 and 1 (matching the source screenshot).

**Per-pill correctness evaluation:**

```
function evaluate(pill, round) {
  return (pill.a + pill.b) === round.target;
}
```

Equivalent check using `pill.correct` boolean (pre-computed at spec time — authoritative source).

---

## 3. Tap Interaction Logic (Pattern P1, Multi-Select Multi-Step)

**Selection model:** Multi-select, multi-step (one tap per correct pill, up to `correctCount` per round).

**Per-pill state:**
- `idle` — default; pill is purple-text-on-lavender; tappable.
- `matched` — student tapped pill and evaluation returned true. Pill turns bright purple → fade-out after SFX. `pointer-events: none`.
- `wrong-flash` — student tapped pill and evaluation returned false. Red flash ~600ms; then back to `idle` (re-tappable — but sensible players won't re-tap).

**Tap guards (enforced at top of `onPillTap`):**
1. `if (!gameState.isActive || gameState.gameEnded) return;`
2. `if (gameState.isProcessing) return;`
3. `if (pillEl.classList.contains('matched')) return;` (already-correct pills)
4. `if (gameState.currentRoundData == null) return;`

**Tap handler flow:**

```pseudo
function onPillTap(pillId) {
  guards ...;
  const pill = findPillInCurrentRound(pillId);
  const isCorrect = (pill.a + pill.b) === round.target;
  const now = Date.now();
  const sinceRef = now - gameState.lastSpeedRefTime; // ms
  const speedBonus = isCorrect && sinceRef <= 2000;

  gameState.isProcessing = true;

  // record BEFORE audio
  recordAttempt({
    input_of_user: `${pill.a} + ${pill.b}`,
    correct: isCorrect,
    round_number: gameState.currentRound,
    question_id: `r${gameState.currentRound}_sum${round.target}_${pill.id}`,
    correct_answer: round.target,
    response_time_ms: sinceRef,
    misconception_tag: isCorrect ? null : deriveTag(pill, round),
    difficulty_level: round.stage,
    is_retry: false,
    metadata: { target: round.target, pillId: pill.id, a: pill.a, b: pill.b, speedBonus }
  });

  if (isCorrect) {
    pillEl.classList.add('matched');
    gameState.foundCorrect += 1;
    gameState.score += 1;
    if (speedBonus) {
      gameState.starCount = Math.min(10, gameState.starCount + 1);
      updateStarCounterDisplay();
    }
    gameState.lastSpeedRefTime = now;

    // CDN ProgressBar bumps only on level clear
    const levelClear = gameState.foundCorrect === round.correctCount;

    await Promise.all([
      safePlaySound('correct_sound_effect', { sticker: STICKER_CORRECT }),
      new Promise(r => setTimeout(r, 1500))
    ]);

    syncDOM();
    pillEl.classList.add('fading');
    setTimeout(() => { pillEl.style.visibility = 'hidden'; }, 300);

    if (levelClear) {
      // progressBar.update FIRST — MEMORY.md progress_bar_round_complete
      progressBar.update(gameState.currentRound, gameState.lives);
      enableNextRoundCTA();
      gameState.phase = 'round_complete';
      syncDOM();
      trackEvent('round_complete', { round: gameState.currentRound, cleared: true });
    }
    gameState.isProcessing = false;
    return;
  }

  // WRONG TAP
  pillEl.classList.add('wrong-flash');
  gameState.lives -= 1;
  syncDOM();

  await Promise.all([
    safePlaySound('incorrect_sound_effect', { sticker: STICKER_WRONG }),
    new Promise(r => setTimeout(r, 1500))
  ]);

  setTimeout(() => { pillEl.classList.remove('wrong-flash'); }, 600);

  if (gameState.lives === 0) {
    // Game Over: lives bump first
    progressBar.update(gameState.currentRound - 1, 0);  // round not cleared
    endGame(false);
    return;
  }

  // Still alive
  progressBar.update(gameState.currentRound - 1, gameState.lives); // hearts decrement
  gameState.isProcessing = false;
}
```

**Key invariants:**
- `isProcessing=true` BEFORE any `await`. Re-enabled at end of handler (NOT on next `renderRound`, because the level isn't ending — student keeps tapping).
- `recordAttempt` fires BEFORE audio.
- `gameState.lastSpeedRefTime` initialised to `levelEnableTime` on entering gameplay; updated on every correct tap; NOT updated on wrong tap.
- Wrong tap does NOT reset `foundCorrect` or the round.

**"Next Round" CTA handler:**
```pseudo
function onNextRoundClick() {
  if (!gameState.isActive || gameState.gameEnded) return;
  if (gameState.phase !== 'round_complete') return; // disabled guard
  safeStopAllAudio();
  if (gameState.currentRound >= gameState.totalRounds) { showVictory(); return; }
  gameState.currentRound += 1;
  showRoundIntro(gameState.currentRound);
}
```

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  gameId: 'spot-the-pairs',
  phase: 'start_screen' | 'round_intro' | 'gameplay' | 'round_complete' | 'feedback' | 'results',
  currentRound: 0..4,       // 1-indexed after round 1 starts; 0 before
  totalRounds: 4,
  score: 0..14,
  lives: 0..3,
  totalLives: 3,
  correctAnswer: <int>,     // current target (10 or 20) — exposed for GEN-CORRECT-ANSWER-EXPOSURE
  attempts: [],
  events: [],
  startTime: null | ms,
  roundStartTime: null | ms,   // per-round start time; used for response_time_ms fallback
  levelEnableTime: null | ms,  // when gameplay unlocks for the current round
  lastSpeedRefTime: null | ms, // rolling reference for speed bonus
  isActive: false | true,
  isProcessing: false | true,
  gameEnded: false | true,
  content: null | fallbackContent,
  stars: 0..3,                 // final 3-star rating
  starCount: 0..10,            // header 10-star counter
  foundCorrect: 0..4,          // correct pills found in current round
  currentRoundData: null | round,
  duration_data: { startTime, preview, attempts, evaluations, inActiveTime, totalInactiveTime }
}
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| `start_screen` | preview `onComplete` | `round_intro` (R1) | `startGameAfterPreview`: set `startTime`, `isActive=true`, show Round 1 transition |
| `round_intro` | intro audio settles | `gameplay` | `renderRound(N)`: reset board, `foundCorrect=0`, `levelEnableTime=Date.now()`, `lastSpeedRefTime=levelEnableTime`, `isProcessing=false`, `isActive=true`, `currentRoundData=rounds[N-1]` |
| `gameplay` | correct tap | `gameplay` | update `foundCorrect`, `score`, maybe `starCount`, fade pill |
| `gameplay` | wrong tap, lives > 0 after dec | `gameplay` | `lives--`, progressBar hearts decrement |
| `gameplay` | wrong tap, lives == 0 after dec | `results` | `endGame(false)` → Game Over TransitionScreen |
| `gameplay` | correct tap that makes `foundCorrect == correctCount` | `round_complete` | progressBar update FIRST, enable CTA |
| `round_complete` | "Next Round" tap (N<4) | `round_intro` (N+1) | advance round |
| `round_complete` | "Next Round" tap (N==4) | `results` | `showVictory()` |
| `results` | Claim Stars | transition (stars_collected) | auto 2500ms → `postMessage({type:'game_exit'})` |
| `results` | Play Again (stars<3) | transition (motivation) | "I'm ready!" → `restartGame()` |
| `results` (game-over) | Try Again | `round_intro` (R1) | `restartGame()` — fresh gameState, no preview re-show |

---

## 5. Scoring & Progression Logic

- **Points:** `+1` per correct pill. Max 14 (3+3+4+4 across 4 rounds).
- **Lives:** `-1` per wrong tap. 0 lives → Game Over.
- **Timer (header display only):** A count-up timer in mm:ss format, starting at 00:00 when the level's gameplay phase enters; paused on visibility-hidden; NOT enforced (no game-over by timer).
- **Speed-bonus star counter (header "X / 10"):** incremented by 1 when a correct tap has `(now - lastSpeedRefTime) <= 2000 ms`. Capped at 10.
- **Final 3-star rating** (computed once on entering `results` via victory path):
  - 3★ = `starCount >= 8`
  - 2★ = `starCount >= 5`
  - 1★ = `starCount >= 1`
  - 0★ = `starCount == 0` (still reaches Victory with game completed; Game Over path never shows 3★)
- **Game Over:** `stars = 0`; still call `postGameComplete(false)`; `endGame(false)`.

---

## 6. Feedback Patterns

Cross-reference: feedback SKILL 17 cases + feedback/reference/timing-and-blocking.md + PART-017 + MEMORY.md `progress_bar_round_complete`.

| Event | Trigger | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|---|---|---|---|---|---|---|
| Preview audio | preview onMounted | auto via `previewScreen.show({ audioUrl })` | — | Yes (during preview) | internal | `onComplete` fires skip or audio-end |
| Round N intro | TransitionScreen onMounted | `await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_LEVEL })` → `await FeedbackManager.playDynamicFeedback({ audio_content: 'Make sum of ' + target + '!', subtitle: 'Make Sum ' + target, sticker })` | "Make Sum 10" / "Make Sum 20" | No CTA (auto-advance) | Yes (sequential SFX→VO) | auto-advance to gameplay after audio |
| Correct tap (pill matches) | handler | `await Promise.all([ FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }), setTimeout 1500ms ])` | — (CASE 5 multi-step: no TTS) | Yes via `isProcessing=true` | Yes (SFX min 1500ms) | pill fades out; `foundCorrect++`; maybe starCount++ |
| Correct tap that clears level | handler, `foundCorrect == correctCount` | same as correct tap, PLUS `progressBar.update(N, lives)` FIRST, then enable CTA; `trackEvent('round_complete')` | — | — | — | CTA becomes the only exit |
| Wrong tap, lives > 1 after | handler | `await Promise.all([ FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_WRONG }), setTimeout 1500ms ])` | — (CASE 7 multi-step) | Yes via `isProcessing=true` | Yes (SFX min 1500ms) | red-flash class cleared after 600ms; student can keep tapping |
| Wrong tap, last life lost | handler | same awaited SFX (CASE 8) | — | Yes | Yes | `endGame(false)` → Game Over transition |
| Game Over screen | after wrong-SFX | `postGameComplete(false)` → screen renders FIRST → `await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: STICKER_SAD })` → `await FeedbackManager.playDynamicFeedback({...})` | "You completed N of 4 levels" | CTA visible | Yes (sequential) | Try Again CTA interrupts via `stopAll` |
| Victory screen | all 4 levels cleared | `progressBar.update(4, lives)` FIRST → screen renders FIRST → `postGameComplete(true)` → `await FM.sound.play('victory_sound_effect', { sticker: STICKER_VICTORY })` → `await FM.playDynamicFeedback({...})` | "You got X of 10 quick taps!" | CTA visible | Yes (sequential) | Claim Stars / Play Again |
| Motivation screen | Play Again | TS shows "Ready to improve your score? ⚡" with "I'm ready! 🙌" | — | CTA visible | Yes | CTA → `restartGame()` |
| Stars Collected | Claim Stars | TS auto-dismiss 2500ms | "Yay! 🎉\nStars collected!" | — | — | `postMessage({type:'game_exit'})` |
| Next Round CTA tapped | button onclick | `FM.sound.stopAll()` + `_stopCurrentDynamic()` | — | — | — | advance |
| Visibility hidden/restored | VisibilityTracker onInactive/onResume | `pause()` / `resume()` FM + preview | — | — | — | pause overlay from VisibilityTracker PopupComponent |

**Animations:**

| Animation | Trigger | CSS class | Duration |
|---|---|---|---|
| Pill tap (touch-down highlight) | pointerdown feedback | `.pill-press` | 120ms |
| Pill correct flash | correct tap | `.matched` | 400ms flash then `.fading` 300ms opacity→0 |
| Pill wrong flash | wrong tap | `.wrong-flash` | 600ms shake + red background |
| Star counter pop | starCount++ | `.star-pop` | 250ms scale |
| Hearts decrement | wrong tap | CDN ProgressBar handles | — |
| Next Round enable | level cleared | `.cta-enabled` | 300ms fade-in yellow |

**Emotional Arc Notes:**

- L2 Understand: tone is encouraging and fast. Each correct tap rewards with a short SFX; no TTS dialogue during multi-tap (CASE 5 default).
- Wrong tap: brief red flash; student re-orients and tries another pill. No shaming TTS.
- Victory: celebrate fast taps explicitly ("You got X of 10 quick taps!") to reinforce the speed goal.

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })` called once after FeedbackManager init in DOMContentLoaded.
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview: false, timerConfig: null, timerInstance: null, onComplete: startGameAfterPreview })` called as the LAST step of `setupGame()`.
- `endGame()` calls `previewScreen.destroy()` once.
- `restartGame()` does NOT call `previewScreen.show()` or `setupGame()`.
- `VisibilityTracker` wired with default `autoShowPopup: true`; `onInactive`/`onResume` wire FM + preview pause/resume.
- **TimerComponent:** NOT used as a game timer. The header timer pill is a lightweight local `<span>` count-up updated via `setInterval(1000)` started on entering gameplay, cleared on leaving gameplay / visibility-hidden. This is allowed because it is purely visual (no `gameState.phase` side effect, no enforcement).
- `progressBar`: CDN `ProgressBarComponent` instance in `#mathai-progress-slot`. Constructor: `totalRounds: 4, totalLives: 3`. Updated per spec §5.
- `FeedbackManager` handles ALL audio. Preload `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `victory_sound_effect`, `game_complete_sound_effect`, `tap_sound`, `sound_bubble_select`, `sound_bubble_deselect`, `new_cards` at `setupGame()` time.
- `syncDOM()` on every phase transition + every score/lives/round change. Writes `data-phase`, `data-score`, `data-round`, `data-lives`, `data-stars` on `#app`.
- **`recordAttempt` on every tap** (correct or wrong):
  - Correct: `{ correct: true, round_number, question_id: 'r<N>_sum<target>_<pillId>', correct_answer: target, response_time_ms: now - lastSpeedRefTime, misconception_tag: null, difficulty_level: stage, is_retry: false, metadata: { target, pillId, a, b, speedBonus } }`
  - Wrong: `{ correct: false, ..., misconception_tag: deriveTag(pill, round), metadata: { target, pillId, a, b, sum: a+b, off: (a+b) - target } }`
- **`game_complete` fires exactly once** on entering `results` (victory OR game-over), BEFORE any victory/game-over audio, with schema:
  ```
  {
    data: {
      metrics: { accuracy, time, stars, attempts, duration_data, totalLives, livesRemaining, tries: [], avgResponseTime, signal_event_count, signal_metadata, starCount, foundCorrectByRound },
      completedAt: Date.now()
    },
    payload: { score, totalQuestions: 4, stars, accuracy, timeSpent, avgResponseTime, livesRemaining }
  }
  ```
- **TransitionScreen usage** (per `parts/PART-024.md` rules):
  - **Round N intro**: `{ icons: [targetEmoji], title: 'Level '+N, subtitle: 'Make Sum '+target, onMounted: () => (async () => { await sound.play('rounds_sound_effect',{sticker: STICKER_LEVEL}); try { await FM.playDynamicFeedback({ audio_content: 'Make sum of '+target+'!', subtitle: 'Make Sum '+target, sticker: STICKER_LEVEL }); } catch(e){}; try{ transitionScreen.hide(); }catch(e){}; enterGameplay(N); })() }`. Auto-advance inside `onMounted`. Hard-fallback `setTimeout(3500ms)` guards stalled audio.
  - **Victory**: `{ stars: gameState.stars, title: 'Victory 🎉', subtitle: 'You got '+starCount+' of 10 quick taps!', buttons: (stars===3 ? [Claim] : [Play Again, Claim]), onMounted: () => FM.sound.play('victory_sound_effect', { sticker: STICKER_VICTORY }) }`. Do NOT pass `icons` when `stars` is passed.
  - **Game Over**: `{ icons: ['😅'], title: 'Game Over', subtitle: 'You completed '+roundsCleared+' of 4 levels', buttons: [{ text: 'Try Again', type: 'primary', action: () => { safeStopAllAudio(); transitionScreen.hide(); restartGame(); } }], onMounted: () => FM.sound.play('game_complete_sound_effect', { sticker: STICKER_SAD }) }`.
  - **Motivation**: `{ title: 'Ready to improve your score? ⚡', buttons: [{ text: "I'm ready! 🙌", type: 'primary', action: () => { safeStopAllAudio(); transitionScreen.hide(); restartGame(); } }], onMounted: () => FM.sound.play('rounds_sound_effect', { sticker: STICKER_RESTART }) }`.
  - **Stars Collected**: `{ title: "Yay! 🎉\nStars collected!", styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }, onMounted: () => FM.sound.play('victory_sound_effect', { sticker: STICKER_VICTORY }) }`. After 2500ms: `postMessage({type:'game_exit'}, '*')`.
- `data-testid` attributes on: every pill (`pill-<pillId>`), "Next Round" CTA (`btn-next-round`), header banner (`target-banner`), timer (`timer-display`), stars counter (`stars-counter`), hearts strip (CDN-owned), Victory "Claim Stars" (`claim-stars`), Motivation "I'm ready!" (`im-ready`), Game Over "Try Again" (`try-again`).
- **Test harness helpers** (exposed on `window`): `debugGame()` returns snapshot; `loadRound(n)` jumps to round n; `solveCurrentRound()` taps every correct pill programmatically; `tapPill(id)` simulates a tap.

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen (data-phase="start_screen")

```
+-------------------------------------+
|  [avatar]  Spot the Pairs           |
|                        0 / 4   ★ 0  |
+-------------------------------------+
|                                     |
|   ┌─────────────────────────────┐   |
|   │ Tap and select all friendly │   |
|   │ pairs of 10 and 20!         │   |
|   │                             │   |
|   │ Spot each pair under 2      │   |
|   │ seconds to win 3 stars!     │   |
|   └─────────────────────────────┘   |
|                                     |
|              [ ▶ Skip ]             |
+-------------------------------------+
```

### 8.2 Round N intro (TransitionScreen, data-phase="round_intro")

```
+-------------------------------------+
|  header (0/4, stars, etc.)          |
+-------------------------------------+
|  [progress: ░░░░ 0/4]                |
+-------------------------------------+
|                                     |
|               [🔟]                   |
|                                     |
|            Level 1                  |
|           Make Sum 10               |
|                                     |
|        (auto-advance ~900ms)        |
+-------------------------------------+
```

### 8.3 Gameplay (data-phase="gameplay")

```
+-------------------------------------+
|  Q 1 · [00:03] · ★ 0/10             |
+-------------------------------------+
|  [progress: ▓░░░ 1/4]    ♥ ♥ ♥       |
+-------------------------------------+
|          Make Sum 10                |
|                                     |
|   [ 6 + 4 ]  [ 5 + 6 ]  [ 3 + 8 ]   |
|                                     |
|   [ 2 + 8 ]  [ 4 + 5 ]  [ 7 + 4 ]   |
|                                     |
|       [ 5 + 5 ]  [ 6 + 3 ]          |
|                                     |
|                                     |
|                    [ Next Round ]   |
+-------------------------------------+
```

Pills: light-lavender fill (`#F3ECFB`), purple text (`--mathai-purple`), 10px border radius, 44px min height (actual 56px), centered text "a + b". Correct → `.matched` bright purple then fade. Wrong → `.wrong-flash` red 600ms.
"Next Round" CTA: yellow bg (`--mathai-yellow` #FFDE49), black text, disabled (grey) until level clears; anchored bottom-right of `#gameContent`.

### 8.4 Victory (data-phase="results", TransitionScreen)

| Element | Content |
|---|---|
| Progress | 4/4 filled |
| Stars row | `gameState.stars` filled |
| Title | "Victory 🎉" |
| Subtitle | "You got X of 10 quick taps!" |
| Audio | `victory_sound_effect` + VO |
| CTA 1 (if stars<3) | "Play Again" → motivation |
| CTA 2 | "Claim Stars" → stars_collected |

### 8.5 Game Over (data-phase="results")

| Element | Content |
|---|---|
| Icon | 😅 |
| Title | "Game Over" |
| Subtitle | "You completed N of 4 levels" |
| Audio | `game_complete_sound_effect` + VO |
| CTA | "Try Again" → `restartGame()` |

### 8.6 Motivation / 8.7 Stars Collected

Standard per logic-seat-puzzle reference.

---

## 9. Round Presentation Sequence (within gameplay screen)

Every round enters gameplay with:
1. **Header/banner re-paint** — banner text switches to the round's `targetLabel` ("Make Sum 10" / "Make Sum 20").
2. **Pills re-paint** — 8 pills rebuilt from `round.pills[]`. All start at `.idle` (no `.matched`, no `.wrong-flash`, no inline `visibility:hidden`). Pill text = `a + ' + ' + b`. `data-testid="pill-<id>"`, `data-pill-id="<id>"`, `data-correct="<true|false>"` (for test harness introspection).
3. **CTA state** — "Next Round" disabled. `.disabled` class, `disabled` attr.
4. **Timer reset** — header timer element zeros to "00:00" and `setInterval` restarts.
5. **Gameplay reveal** — `isProcessing=false`, `isActive=true`, `levelEnableTime = Date.now()`, `lastSpeedRefTime = levelEnableTime`, `foundCorrect=0`.
6. **Fire-and-forget `new_cards` SFX** on entering gameplay.

No per-round prompt text beyond the target-sum banner (which IS the round-specific prompt and is not a restatement of preview instructions).

---

## 10. Spec Ambiguities Resolved

| Ambiguity (spec) | Planner default | Rationale |
|---|---|---|
| Timer "starts at 00:03" in source screenshot | **Count up from 00:00** | Source screenshot shows an elapsed-time display; "00:03" is just the moment the screenshot was captured. Count-up is simpler and non-enforcing. |
| 10-star counter vs 3-star final | **Both preserved** | Both are explicit in source ("0/10" header + source concept says "3-star bonus for under 2s"). 10-star counter is implementation detail; 3-star is Victory screen. |
| Pill shuffling | **No shuffle** | Source screenshots show specific positions; test determinism needs stable indices. |
| "Next Round" CTA visible during level | **Always visible, disabled until clear** | Matches source screenshot (yellow CTA is anchored bottom-right even on first screen). |
| Speed bonus reference timestamp | **Per-pair since last correct tap** (first pair = since level-enable) | Matches "each pair under 2 seconds" language; simplest to implement and pedagogically clearest. |
| Game over retry | **No retry of current level; full restart** | Matches Speed Blitz archetype default. Partial-credit scoring already captures progress. |

---

## 11. Cross-Validation (Step 7)

- Every screen in §1 has a wireframe in §8: PreviewScreen, Round-N intro, Gameplay, Victory, Game Over, Motivation, Stars Collected.
- Every feedback moment in §6 corresponds to a phase transition in §4.
- `starCount` is the single source for speed-bonus scoring; `stars` (0..3) is a pure function of `starCount`.
- `progressBar.update` is called FIRST in both the level-clear handler AND the Victory path (MEMORY.md rule).
- `recordAttempt` fires on every tap (correct or wrong), BEFORE audio.
- `game_complete` fires exactly once per game, BEFORE end-game audio.
- Transition screens match `default-transition-screens.md`; Victory uses `stars`, Round Intro uses `icons`, never both on the same screen.
- `isProcessing` is set BEFORE any await and cleared at the end of the handler (NOT in `renderRound`, because multi-tap means the round is still in progress).
- Wrong tap does NOT reset `foundCorrect` or re-render the round.
