# Timing, Blocking, and Audio Control

How feedback timing works in production: what to await, what to fire-and-forget, when to stop, when to pause, and how input blocking integrates with the data contract.

## Await vs Fire-and-Forget

Production games do NOT use fixed setTimeout delays. They `await` the `FeedbackManager.sound.play()` promise — the audio duration itself IS the timing. When fire-and-forget is used, the `.play()` call is not awaited and `.catch()` is chained for error handling.

| Feedback moment | Await? | Reasoning |
|----------------|--------|-----------|
| Level transition SFX → VO | **Yes** (sequential, CTA interrupts) | SFX awaited, then VO awaited; CTA stops all mid-sequence |
| Round transition (auto-advance, no CTA) | **Yes** (sequential) | SFX awaited, then VO awaited; audio IS the pacing |
| Round transition (with CTA) | **Yes** (sequential, CTA interrupts) | SFX awaited, then VO awaited; CTA stops all mid-sequence |
| Round start dynamic TTS | No | Student should interact immediately |
| Correct SFX → TTS (single-step) | **Yes** (sequential) | SFX awaited, then dynamic TTS awaited; block input during both |
| Correct SFX (multi-step, mid-round match) | No | SFX + sticker only, fire-and-forget; no dynamic TTS |
| Round complete SFX | **Yes** | Gate before next round advances |
| Wrong SFX → TTS (single-step) | **Yes** (sequential) | SFX awaited, then dynamic TTS awaited; block input during both |
| Wrong SFX (multi-step) | No | SFX + sticker only, fire-and-forget; no dynamic TTS |
| Tile select / deselect SFX | No | Pure ambient micro-interaction |
| Partial progress SFX + VO (chains) | No | Don't interrupt — student starts next chain |
| End-game SFX → VO (victory/game-over) | **Yes** (sequential) | But screen + CTA already visible, so student CAN interrupt |
| New cards / content appearing SFX | No | Ambient |

### Awaited Pattern (Single-step games — SFX → dynamic TTS, always)

```javascript
gameState.isProcessing = true;
// ... visual feedback (CSS classes) ...
// ... recordAttempt ...
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER });
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Great! 5 in the thousands place gives 5000', subtitle: 'Great! 5 in the thousands place gives 5000', sticker: CORRECT_STICKER });
} catch(e) {}
gameState.isProcessing = false;
// advance to next round
```

### Fire-and-Forget Pattern

```javascript
FeedbackManager.sound.play('correct_sound_effect', {
  sticker: CORRECT_STICKER
}).catch(function(e) { console.error('Audio error:', e.message); });
// student can interact immediately — no await, no isProcessing block
```

## Input Blocking

`gameState.isProcessing` is the single gatekeeper. Every interaction handler must check it:

```javascript
if (gameState.isProcessing) return;
```

**When to set `isProcessing = true`:**
- Immediately when a single-step correct/wrong answer is submitted
- Immediately when round-complete audio starts
- During handleReset / path reset flows

**When to set `isProcessing = false`:**
- After the awaited `FeedbackManager.sound.play()` resolves
- Before starting the next round (so input is ready when gameplay renders)

**When NOT to block input:**
- Multi-step correct matches (fire-and-forget)
- Tile select/deselect (micro-interactions)
- Dynamic TTS at round start
- Partial progress audio (chain games)

## Stop Triggers

| Trigger | What to call |
|---------|-------------|
| CTA tapped on transition screen | `FeedbackManager._stopCurrentDynamic()` + `FeedbackManager.sound.stopAll()` |
| CTA tapped on results/game-over screen | `FeedbackManager._stopCurrentDynamic()` + `FeedbackManager.sound.stopAll()` |
| New transition screen appearing | `FeedbackManager.sound.stopAll()` (clear previous screen's audio) |
| Student taps during dynamic TTS | `FeedbackManager.stream.stopAll()` (stop TTS, then process tap) |
| Restart / Try Again | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` |
| Game cleanup (endGame) | `FeedbackManager._stopCurrentDynamic()` + `FeedbackManager.sound.pause()` + `FeedbackManager.stream.stopAll()` |

## Pause / Resume Triggers

Only triggered by visibility change:

```javascript
// Tab hidden / screen lock:
FeedbackManager.sound.pause();
FeedbackManager.stream.pauseAll();
timer.pause({ fromVisibilityTracker: true });

// Tab visible / return:
FeedbackManager.sound.resume();
FeedbackManager.stream.resumeAll();
timer.resume({ fromVisibilityTracker: true });
```

Pause ≠ Stop. Pause keeps the audio position so it can resume. Stop discards it.

## Round/Level Transition Audio Sequence

Transition screens always play **two sequential awaited calls**: SFX first, then dynamic VO. The second audio MUST NOT start until the first completes. CTA can interrupt at any point in the sequence.

**Round transition (auto-advance, no CTA):**
```javascript
// No CTA — student cannot skip, both audios play fully
await FeedbackManager.sound.play('rounds_sound_effect', { sticker: ROUND_STICKER });
await FeedbackManager.playDynamicFeedback({ audio_content: 'Round 3', subtitle: 'Round 3', sticker: ROUND_STICKER });
// Both done → hide transition, start gameplay
```

**Round transition (with CTA):**
```javascript
// CTA visible — student can tap anytime to skip
var audioStopped = false;

ctaButton.addEventListener('click', function() {
  audioStopped = true;
  FeedbackManager.sound.stopAll();
  FeedbackManager._stopCurrentDynamic();
  hideTransition();
  loadRound();
});

// Play sequentially — await each in order
try {
  await FeedbackManager.sound.play('rounds_sound_effect', { sticker: ROUND_STICKER });
  if (audioStopped) return; // CTA was tapped between the two calls
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Round 3', subtitle: 'Round 3', sticker: ROUND_STICKER });
} catch(e) {}
// If CTA not tapped, screen stays until tapped
```

**Level transition (with CTA):**
```javascript
var audioStopped = false;

ctaButton.addEventListener('click', function() {
  audioStopped = true;
  FeedbackManager.sound.stopAll();
  FeedbackManager._stopCurrentDynamic();
  hideTransition();
  startLevel();
});

try {
  await FeedbackManager.sound.play('rounds_sound_effect', { sticker: LEVEL_STICKER });
  if (audioStopped) return;
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Level 2', subtitle: 'Level 2', sticker: LEVEL_STICKER });
} catch(e) {}
```

**Key pattern:** The `audioStopped` flag prevents the second `await` from firing if CTA was tapped during the first audio. Without this check, the second audio would start immediately after `stopAll()` clears the first.

---

## End-Game Audio Sequence

End-game audio always plays as two sequential awaited calls: SFX first, then dynamic VO. Same `audioStopped` flag pattern as transitions — CTA is visible and can interrupt at any point.

**Victory (3★):**
```javascript
var audioStopped = false;
ctaButton.onclick = function() { audioStopped = true; FeedbackManager.sound.stopAll(); FeedbackManager._stopCurrentDynamic(); restartGame(); };
try {
  await FeedbackManager.sound.play('victory_sound_effect', { sticker: VICTORY_STICKER });
  if (audioStopped) return;
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Victory! 3 stars!', subtitle: 'Victory! 3 stars!', sticker: VICTORY_STICKER });
} catch(e) {}
```

**Game complete (2★):**
```javascript
try {
  await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: COMPLETE_STICKER });
  if (audioStopped) return;
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Well done! 2 stars!', subtitle: 'Well done! 2 stars!', sticker: COMPLETE_STICKER });
} catch(e) {}
```

**Game complete (1★):**
```javascript
try {
  await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: COMPLETE_STICKER });
  if (audioStopped) return;
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Good try! 1 star!', subtitle: 'Good try! 1 star!', sticker: COMPLETE_STICKER });
} catch(e) {}
```

**Game over:**
```javascript
try {
  await FeedbackManager.sound.play('game_over_sound_effect', { sticker: GAMEOVER_STICKER });
  if (audioStopped) return;
  await FeedbackManager.playDynamicFeedback({ audio_content: 'You completed 2 rounds', subtitle: 'You completed 2 rounds', sticker: GAMEOVER_STICKER });
} catch(e) {}
```

## Wrong Answer Visual Timing

- `.wrong` / `.incorrect` CSS class applied immediately
- Class cleared after ~600ms (via setTimeout)
- In some games, the wrong option becomes permanently disabled (`.filled` with gray background)
- The FeedbackManager audio plays in parallel with the visual flash

## Data Contract Integration

When an answer is submitted, execute in this exact order:

```
1. gameState.isProcessing = true          — block input
2. Apply visual CSS (.correct / .wrong)   — immediate visual feedback
3. Update state (lives--, score++)        — update game state
4. progressBar.update(round, lives)       — update UI immediately
5. recordAttempt({...})                   — log attempt BEFORE audio
6. signalCollector.recordViewEvent(...)   — record feedback event
7a. await FeedbackManager.sound.play(...)  — play SFX with sticker
7b. [Single-step only] await FeedbackManager.playDynamicFeedback(...)  — play dynamic TTS with subtitle + sticker
8. gameState.isProcessing = false         — unblock input
9. Advance (next round / game over)       — proceed
```

**Why this order:**
- `recordAttempt` fires BEFORE audio so the attempt captures pre-feedback state
- `progressBar.update` fires BEFORE audio so student sees the heart/round change immediately
- Visual CSS applies BEFORE audio so student sees green/red while audio plays
- `isProcessing = false` fires AFTER audio so input is blocked for the full feedback duration

## End-Game Data Contract

The end-game sequence has a strict order:

```
1. gameState.isActive = false             — stop accepting input
2. timer.pause()                          — freeze the timer
3. Calculate metrics (stars, accuracy)    — compute final results
4. signalCollector.seal()                 — finalize signal data
5. Render results/game-over screen        — SCREEN FIRST
6. window.parent.postMessage(game_complete) — DATA BEFORE AUDIO
7. await end-game SFX → VO               — audio plays last
8. Cleanup (destroy timer, tracker, etc.) — after audio finishes
```
