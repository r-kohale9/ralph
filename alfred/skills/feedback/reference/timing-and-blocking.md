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
| Correct SFX (single-step) | **Yes** | SFX awaited (~1s, predictable); block input; then awaited TTS |
| Correct TTS (single-step) | **Yes** | Awaited so the explanation finishes BEFORE the round advances. Without await, the TTS subtitle/audio paints over the next round's transition (equivalent-ratios regression). |
| Correct SFX (multi-step, mid-round match) | No | SFX + sticker only, fire-and-forget; no dynamic TTS |
| Round complete SFX | **Yes** | Gate before next round advances |
| Round complete TTS | **Yes** | Awaited — finishes before round advance. Same reasoning as single-step correct TTS. |
| Wrong SFX (single-step) | **Yes** | SFX awaited (~1s, predictable); block input; then awaited TTS |
| Wrong TTS (single-step) | **Yes** | Awaited so the explanation finishes BEFORE retry/advance. Without await, the TTS bleeds into the retry input or the next round. |
| Wrong SFX (multi-step) | No | SFX + sticker only, fire-and-forget; no dynamic TTS |
| Explanatory TTS (Bloom L2+, any moment) | **Yes** | If `playDynamicFeedback`'s `audio_content` carries a Bloom L2+ explanation (a *why*, not just an ack), it MUST be awaited so the student actually hears it. Bloom L1 acks (e.g., "Yes!", "Correct!") MAY remain fire-and-forget. |
| Tile select / deselect SFX | No | Pure ambient micro-interaction |
| Partial progress SFX + VO (chains) | No | Don't interrupt — student starts next chain |
| End-game SFX → VO (victory/game-over) | **Yes** (sequential) | But screen + CTA already visible, so student CAN interrupt |
| New cards / content appearing SFX | No | Ambient |

### Submit-handler Pattern (Single-step games — SFX awaited, then TTS awaited)

```javascript
// BEFORE any await: lock input so the game freezes, not the TTS pipeline
gameState.isProcessing = true;
// ... disable buttons / voiceInput.disable() here ...
// ... visual feedback (CSS classes) ...
// ... recordAttempt ...
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER });
} catch(e) {}
// Dynamic TTS is AWAITED — the explanation must finish before round advance,
// otherwise its subtitle/audio paints on top of the next round
// (equivalent-ratios regression, GEN-FEEDBACK-TTS-AWAIT). The package
// already bounds resolution (3 s API timeout, 60 s streaming) so a stalled
// TTS can never freeze the game indefinitely. Wrap in try/catch so a
// rejection is swallowed.
try {
  await FeedbackManager.playDynamicFeedback({
    audio_content: 'Great! 5 in the thousands place gives 5000',
    subtitle: 'Great! 5 in the thousands place gives 5000',
    sticker: CORRECT_STICKER
  });
} catch(e) { console.error('TTS error:', e.message); }
// Do NOT re-enable here. renderRound() / loadRound() re-enables inputs when the next round paints.
// advance to next round
```

**Carve-outs that remain fire-and-forget.** TTS is awaited only when it carries an explanation tied to a specific moment (submit handlers, round-complete). The following sites stay fire-and-forget because the audio has no explanatory payload and/or the student should keep interacting:

| Moment | Why fire-and-forget |
|---|---|
| Round-start dynamic TTS (line 14) | Contextual welcome, not feedback — student should interact immediately |
| Partial progress SFX + VO in chains (line 23) | Ambient progress acknowledgement — don't pause mid-chain |
| Tile select / deselect SFX (line 22) | Pure micro-interaction |
| New cards / content appearing SFX (line 25) | Ambient |
| Multi-step mid-round match SFX (line 17) | SFX + sticker only — no TTS exists |

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
- Immediately when a single-step correct/wrong answer is submitted — BEFORE any await (LLM eval, SFX play). Also disable modality-specific input (`voiceInput.disable()`, `btn.disabled = true`, `.dnd-disabled` class) at the same point.
- Immediately when round-complete audio starts
- During handleReset / path reset flows

**When to set `isProcessing = false`:**
- Submit/answer handler: NEVER here. Let `renderRound()` / `loadRound()` be the single source of truth — it clears `isProcessing`, re-enables voice/buttons, removes `.dnd-disabled`. Re-enabling in the handler ties game flow to TTS completion (anti-pattern).
- Transition sequences (level / round / end-game with CTA): after the last awaited audio resolves, or when the CTA is tapped.
- Exception A: API-failure path (LLM timeout / error, can't advance) re-enables in-handler so the user can retry.
- Exception B: Terminal game-over path re-enables in-handler before calling `endGame()`.

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
| `nextRound()` / `scheduleNextRound()` silent auto-advance (no CTA) | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` — FIRST line, before `currentRound++` |
| `showRoundIntro(n)` entry (multi-round, between-round transition) | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` + `FeedbackManager._stopCurrentDynamic()` — FIRST lines, BEFORE the new round's `transitionScreen.show()` / `sound_round_n`. With awaited TTS in submit handlers (`GEN-FEEDBACK-TTS-AWAIT`) the explanation normally finishes before this point — the cleanup remains mandatory as defense-in-depth: TTS streaming can hit its 60 s upper bound, the try/catch can swallow a mid-stream rejection that left audio partially playing, or a tail of `sound_round_n` from a previous transition can linger. Validator: `GEN-ROUND-BOUNDARY-STOP`. |
| `endGame()` entry (victory/game-over TransitionScreen) | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` — FIRST line after the `gameEnded` guard, before phase mutation |
| `restartGame()` entry | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` — FIRST line, before recreating SignalCollector / Timer / ProgressBar |
| Level-transition button `action` callback | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` — before `startLevel()` / `nextLevel()` |

**Why the last four rows exist:** The FeedbackManager overlay auto-clear fires only when a NEW `playDynamicFeedback()` call starts. Silent round auto-advance, restart, end-screen entry, and level transitions do NOT necessarily start a new dynamic feedback — so the previous round's subtitle + sticker + audio will bleed into the new phase unless stopped explicitly. See Feedback SKILL Cross-Cutting Rule 10 and Anti-pattern 13.

## Round/Phase Cleanup (Canonical Call)

Every round-boundary function (`nextRound`, `scheduleNextRound` timeout body, `endGame`, `restartGame`, level-transition `action`) MUST execute this block as its FIRST statement, before mutating `gameState`:

```javascript
// Canonical cleanup — MUST run BEFORE any gameState mutation
try { FeedbackManager.sound.stopAll(); } catch (e) {}
try { FeedbackManager.stream.stopAll(); } catch (e) {}

// If the game renders custom feedback DOM outside FeedbackManager's overlay:
if (feedbackEl) {
  feedbackEl.textContent = '';
  feedbackEl.classList.remove('show', 'correct', 'incorrect', 'visible');
}
```

**Ordering in `endGame()`** (cleanup slots in right after the re-entry guard):

```javascript
async function endGame(reason) {
  if (gameState.gameEnded) return;       // 1. re-entry guard
  gameState.gameEnded = true;             // 2. set guard flag
  try { FeedbackManager.sound.stopAll(); } catch(e) {}   // 3. cleanup FIRST
  try { FeedbackManager.stream.stopAll(); } catch(e) {}
  gameState.isActive = false;             // 4. stop accepting input
  gameState.phase = reason === 'victory' ? 'results' : 'gameover';  // 5. phase
  syncDOMState();                         // 6. propagate to data-phase
  // 7. results screen + postMessage + end-game audio (as defined by End-Game Data Contract)
  await transitionScreen.show({ ... });
}
```

**Why this ordering (matches GEN-PHASE-SEQUENCE):** cleanup runs BEFORE phase assignment so no audio is still resolving when `syncDOMState()` paints the new `data-phase`; phase assignment runs BEFORE `syncDOMState()` so the 500ms test harness poll never reads a stale value. Running cleanup AFTER state mutation opens a 1–2 frame window where the next round paints with the previous round's sticker still on screen — visually jarring and detectable in Playwright screenshots.

**Caller does NOT need to also call `FeedbackManager._stopCurrentDynamic()`** — the pair `sound.stopAll()` + `stream.stopAll()` covers both static SFX and dynamic TTS. `_stopCurrentDynamic()` is only needed as an additional belt-and-suspenders call on CTA interrupts where the sequential `audioStopped` flag pattern is in play (see "Round/Level Transition Audio Sequence" below).

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
1. gameState.isProcessing = true          — block input (set BEFORE any await)
   + disable voiceInput / buttons          — defense-in-depth; also BEFORE any await
2. Apply visual CSS (.correct / .wrong)   — immediate visual feedback
3. Update state (lives--, score++)        — update game state
4. progressBar.update(round, lives)       — update UI immediately
5. recordAttempt({...})                   — log attempt BEFORE audio
6. signalCollector.recordViewEvent(...)   — record feedback event
7a. await FeedbackManager.sound.play(...)  — play SFX with sticker (awaited; ~1s predictable)
7b. [Single-step + round-complete] try { await FeedbackManager.playDynamicFeedback(...); } catch(e){}
    — dynamic TTS is AWAITED so the explanation finishes BEFORE round advance.
    Package already bounds resolution (3 s API / 60 s streaming) so it can't freeze the game.
    Validator: GEN-FEEDBACK-TTS-AWAIT.
8. Advance (renderRound / loadRound / endGame)
   — renderRound / loadRound is the single source of truth for re-enabling inputs
   (it sets isProcessing = false, voiceInput.enable(), btn.disabled = false, etc.)
   DO NOT set isProcessing = false in the submit handler.
   Exception: API-failure path (LLM timeout / error, can't advance) re-enables in-handler
   so the user can retry; terminal game-over also handles its own re-enable.
```

**Why this order:**
- `recordAttempt` fires BEFORE audio so the attempt captures pre-feedback state
- `progressBar.update` fires BEFORE audio so student sees the heart/round change immediately
- Visual CSS applies BEFORE audio so student sees green/red while audio plays
- SFX is awaited (short, predictable ~1s) so the visual flash has time to land before advance
- Dynamic TTS is awaited so the explanation finishes attached to the answer it explains; package-level bounds (3 s API / 60 s streaming) prevent indefinite freezes, and the `try/catch` swallows rejection so a network failure still lets the game advance
- Inputs are re-enabled only by the next `renderRound()` / `loadRound()` — same single-source-of-truth invariant as before; awaited TTS just delays when `renderRound` is reached

### Defense-in-depth CSS (optional but recommended)

Add `.is-processing` to `#gameContent` at the start of the submit handler; clear it in `renderRound()`. Style it as `pointer-events: none` on voice-input, action-row, submit-btn. The CDN VoiceInput has a known bug where `.disable()` only blocks the textarea but not the mic toggle — this CSS works around it.

```css
#gameContent.is-processing .voice-input,
#gameContent.is-processing .action-row,
#gameContent.is-processing #submit-btn {
  pointer-events: none;
}
```

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
