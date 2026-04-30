# Feedback System Summary

Quick-reference answers to the 8 core questions about how feedback works in every game.

---

## 1. Types of Feedback

Every feedback moment uses a combination of these 5 types:

| Type               | What it is                                                                        | Source                                                                                      | Plays alone?                           |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Static SFX**     | Pre-recorded short sound effect (correct ding, wrong buzz, bubble pop, life-lost) | `FeedbackManager.sound.play(id, {sticker})` — preloaded via `sound.preload()`               | Yes                                    |
| **Voiceover (VO)** | Pre-recorded narration ("Level 1", "Victory!")                                    | `FeedbackManager.sound.play(id, {sticker})` — preloaded                                     | Yes                                    |
| **Dynamic TTS**    | Text-to-speech generated on the fly ("Make 90", "Great! 5 in thousands = 5000")   | `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` — never preloaded | Yes                                    |
| **Sticker**        | Animated GIF overlay (celebration, sad, mascot)                                   | Passed as a string URL in the `sticker` param of either API                                 | Never alone — always paired with audio |
| **Subtitle**       | On-screen text shown during audio ("Round 1", "Not quite!")                       | Passed as `subtitle` param — under 60 chars, never uses "wrong"                             | Never alone — always paired with audio |

**Key distinction:** SFX and VO are pre-recorded and preloaded at init. Dynamic TTS is generated on the fly and never preloaded.

---

## 2. What Feedback to Play

What plays depends on the **game type** and the **moment**.

### By Game Type (Default Rule)

| Game type       | How to identify                                                   | Correct/Wrong feedback                                                     |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Single-step** | 1 interaction completes the round (MCQ, type answer, select one)  | **All rounds (1..N), all shapes:** SFX awaited (~1.5s floor) → dynamic TTS **awaited** (`try { await playDynamicFeedback(...); } catch(e){}`) with subtitle + sticker — explanation finishes BEFORE round advance, else it bleeds into next round (equivalent-ratios regression). Package bounds at 3 s API / 60 s streaming + try/catch prevents freezes. Validator: `GEN-FEEDBACK-TTS-AWAIT`. Standalone end-of-game (`totalRounds: 1`) uses the same awaited TTS as part of `endGame()`'s 5-beat orchestrator (PART-050). |
| **Multi-step**  | Multiple interactions per round (match pairs, sort, drag, chains) | Mid-round partial-match SFX + sticker only — **fire-and-forget, no TTS**. Round-complete: SFX awaited → TTS awaited (Case 6 in SKILL.md). |

### By Moment

| Moment                               | What plays                                                            |
| ------------------------------------ | --------------------------------------------------------------------- |
| Level transition                     | Level SFX + sticker → dynamic VO ("Level N") + sticker                |
| Round transition                     | Round SFX + sticker → dynamic VO ("Round N") + sticker                |
| Round start                          | Dynamic TTS reads question (optional)                                 |
| Correct (single-step)                | Correct SFX + celebration sticker → dynamic TTS explanation + sticker |
| Correct (multi-step)                 | Correct SFX + celebration sticker only                                |
| Round complete (all matched)         | All-correct SFX + sticker + subtitle                                  |
| Wrong (single-step, lives remaining) | Wrong SFX + sad sticker → dynamic TTS explanation + sticker           |
| Wrong (multi-step, lives remaining)  | Wrong SFX + sad sticker only                                          |
| Wrong (last life)                    | Wrong SFX + sad sticker (awaited, 1500ms min) → then game over        |
| Tile select/deselect                 | Bubble SFX only (no sticker, no TTS)                                  |
| Partial progress (chains)            | Chain SFX + sticker (fire-and-forget)                                 |
| Victory (3★)                         | Victory SFX + big celebration sticker → dynamic VO                    |
| Game complete (2★/1★)                | Complete SFX + sticker → dynamic VO                                   |
| Game over                            | Game-over SFX + sad sticker → dynamic VO                              |
| New cards appearing                  | Ambient SFX only                                                      |
| Restart                              | Stop all audio, optional restart VO                                   |

---

## 3. When to Play Feedback

| Trigger                                      | Feedback fires                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Transition screen appears (level/round)      | Immediately — SFX → VO sequential                                                           |
| Gameplay round renders                       | Optional question TTS (non-blocking)                                                        |
| Student selects correct answer (single-step) | Immediately — SFX → TTS sequential                                                          |
| Student matches correct pair (multi-step)    | Immediately — SFX fire-and-forget                                                           |
| All sub-actions in round complete            | FIRST: `progressBar.update(currentRound, lives)` synchronously; THEN await round-complete SFX; THEN `nextRound`/`endGame`. Paints `N/N` on the final round before Victory renders (PART-023). |
| Student selects wrong answer (single-step)   | Immediately — SFX → TTS sequential                                                          |
| Student makes wrong match (multi-step)       | Immediately — SFX fire-and-forget                                                           |
| Last life lost                               | Skip wrong SFX, trigger game-over flow                                                      |
| All rounds complete                          | Results screen renders FIRST → `game_complete` postMessage → then victory/complete SFX → VO |
| Lives reach 0                                | Game-over screen renders FIRST → `game_complete` postMessage → then game-over SFX → VO      |
| Student taps tile                            | Immediately — bubble SFX fire-and-forget                                                    |
| Tab hidden / screen lock                     | Immediately — pause all audio                                                               |
| Tab restored                                 | Immediately — resume all audio                                                              |
| CTA tapped on any overlay                    | Immediately — stop all audio                                                                |

---

## 4. In What Sequence Should Feedback Be Played

### Sequential Audio Rule (CRITICAL)

When two audios play back-to-back, **always `await` the first before starting the second**. The second must never override or overlap the first.

```
Audio 1 (SFX) → await complete → Audio 2 (VO/TTS) → await complete → done
```

### Sequence by Moment

**Level/Round Transition:**

```
Screen renders → await SFX (with sticker) → await dynamic VO (with sticker) → done / CTA proceeds
```

**Correct Answer (single-step):**

```
Visual feedback (green) → isProcessing=true (disable inputs BEFORE any await) → recordAttempt → progressBar.update
→ await correct SFX (with sticker) → await dynamic TTS (with sticker, try/catch, AWAITED)
→ advance to next round (renderRound / loadRound re-enables inputs — single source of truth)
```

**Wrong Answer (single-step):**

```
Visual feedback (red flash) → isProcessing=true (disable inputs BEFORE any await) → recordAttempt → life-- → progressBar.update
→ await wrong SFX (with sticker) → await dynamic TTS (with sticker, try/catch, AWAITED)
→ stay on same round (renderRound / loadRound re-enables inputs for retry — single source of truth)
```

Exception: API-failure path (LLM timeout/error, cannot advance) DOES re-enable inputs in-handler so the user can retry.

**Correct/Wrong (multi-step mid-round):**

```
Visual feedback → SFX + sticker (fire-and-forget) → student continues immediately
```

**End-game (victory/game-over):**

```
Screen renders FIRST → game_complete postMessage → await SFX (with sticker)
→ await dynamic VO (with sticker) → CTA already visible, can interrupt anytime
```

**Full data-contract order for answer submission:**

```
1. isProcessing = true             — block input (set BEFORE any await; also disable voice/buttons)
2. Apply visual CSS (.correct/.wrong) — immediate feedback
3. Update state (lives--, score++) — game state
4. progressBar.update()           — UI update
5. recordAttempt({...})           — log attempt BEFORE audio
6. signalCollector.recordViewEvent() — record event
7a. await SFX (with sticker)      — play SFX (awaited; short ~1s predictable)
7b. [single-step + round-complete] AWAIT dynamic TTS (try/catch around await) — explanation must finish before round advance (validator: GEN-FEEDBACK-TTS-AWAIT)
8. Advance (renderRound / loadRound / endGame)
   — renderRound / loadRound is the single source of truth for re-enabling inputs
   (sets isProcessing = false, voiceInput.enable(), btn.disabled = false).
   DO NOT re-enable in the handler. Exception: API-failure / terminal game-over re-enable in-handler.
```

---

## 5. When to Stop

| Trigger                                | What to call                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CTA tapped on transition screen        | `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()`                                    |
| CTA tapped on results/game-over screen | `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()`                                    |
| New transition screen appearing        | `FeedbackManager.sound.stopAll()` (clear previous screen's audio)                                              |
| Student taps during dynamic TTS        | `FeedbackManager._stopCurrentDynamic()` (stop TTS, then process tap)                                           |
| Restart / Try Again                    | `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()`                                         |
| Game cleanup (endGame)                 | `FeedbackManager._stopCurrentDynamic()` + `FeedbackManager.sound.pause()` + `FeedbackManager.stream.stopAll()` |

### CTA Mid-Sequence Interrupt Pattern

When a CTA can be tapped during a sequential audio pair, use the `audioStopped` flag:

```javascript
var audioStopped = false;
ctaButton.onclick = function () {
  audioStopped = true;
  FeedbackManager.sound.stopAll();
  FeedbackManager._stopCurrentDynamic();
  proceed(); // hide transition, load round, restart, etc.
};

try {
  await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_URL });
  if (audioStopped) return; // CTA tapped between the two calls
  await FeedbackManager.playDynamicFeedback({ audio_content: 'Round 3', subtitle: 'Round 3', sticker: STICKER_URL });
} catch (e) {}
```

---

## 6. When to Wait / No Wait

### Wait (Await) — blocks next step via `isProcessing`

| Moment                          | Why await                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| Level transition SFX → VO       | Audio IS the pacing; CTA can interrupt                         |
| Round transition SFX → VO       | Audio IS the pacing (auto-advance or CTA interrupts)           |
| Correct/Wrong SFX (single-step) | Short ~1s audio; visual flash needs time to land before advance |
| Correct/Wrong TTS (single-step) | Explanation must finish BEFORE round advance, else bleeds into next round (GEN-FEEDBACK-TTS-AWAIT) |
| Round complete SFX              | Gate before advancing to next round                            |
| Round complete TTS              | Same as Correct/Wrong TTS — finishes before advance            |
| End-game SFX → VO               | Terminal moment; CTA already visible for interrupt             |

### No Wait (Fire-and-Forget) — does NOT block game flow

| Moment                                | Why no await                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Correct SFX (multi-step mid-round)    | Don't interrupt flow — student continues matching                                              |
| Wrong SFX (multi-step mid-round)      | Don't interrupt flow                                                                           |
| Round start TTS                       | Student should interact immediately                                                            |
| Tile select/deselect SFX              | Pure ambient micro-interaction                                                                 |
| Partial progress SFX + VO             | Don't interrupt — student starts next chain                                                    |
| New cards SFX                         | Ambient, decorative                                                                            |

### Code Patterns

**Submit handler (single-step) — SFX awaited, TTS awaited:**

```javascript
// BEFORE any await: lock input
gameState.isProcessing = true;
// ... disable buttons / voiceInput.disable() here ...
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER });
} catch (e) {}
// Dynamic TTS is AWAITED — explanation must finish before round advance, else
// the subtitle/audio paints over the next round's transition. Package bounds
// at 3 s API / 60 s streaming; try/catch swallows rejection so a network failure
// still advances. Validator: GEN-FEEDBACK-TTS-AWAIT.
try {
  await FeedbackManager.playDynamicFeedback({
    audio_content: 'Great!',
    subtitle: 'Great!',
    sticker: CORRECT_STICKER
  });
} catch (e) { console.error('TTS error:', e.message); }
// Do NOT re-enable here. renderRound() / loadRound() re-enables inputs for the next round.
// advance to next round
```

**Per-round long-audio + paired short-subtitle (the canonical CASE 4 / CASE 7 shape).** When `audio_content` is creator-supplied per-round narration (an inference explanation, a violated-clue ask-back), `subtitle` MUST come from a paired authored field on the same round object. The pairing convention is `<X>TTS` ↔ `<X>Subtitle` — both strings live in the spec's round entry, both inline verbatim into the call. See spec-creation/SKILL.md § 5e-i for the authoring rule.

```javascript
// CORRECT (CASE 4) — long inference TTS, paired short subtitle
try {
  await FeedbackManager.playDynamicFeedback({
    audio_content: round.keyInferenceTTS,    // e.g. "Nice — since Arjun is from India and the Lion lover is from Japan, Maya must like the Lion."
    subtitle:      round.keyInferenceSubtitle, // e.g. "Maya likes the Lion!"  ≤60 chars, paraphrases TTS
    sticker:       STICKER_CORRECT
  });
} catch (e) {}

// WRONG (CASE 7) — long violated-clue TTS, paired short subtitle
try {
  await FeedbackManager.playDynamicFeedback({
    audio_content: round.violatedClueTTS,    // e.g. "That breaks clue 2 — Arjun is from India. Which row still has Arjun checked against Japan?"
    subtitle:      round.violatedClueSubtitle, // e.g. "Clue 2 — Arjun is from India."  ≤60 chars
    sticker:       STICKER_INCORRECT
  });
} catch (e) {}

// ANTI-PATTERN — disconnected generic literal (cross-logic 2026-04-29 regression)
// audio_content: round.keyInferenceTTS, subtitle: 'Nice deduction!'
// audio_content: round.violatedClueTTS, subtitle: 'Check the clue again.'
//   ↑ The audio carries L4 scaffolding; the subtitle is content-disconnected.
//     Students who can't hear audio (mute / slow TTS / deaf/HoH) get NO scaffold.
//     Validator GEN-FEEDBACK-SUBTITLE-LINKED-TO-AUDIO blocks this at Step 5.
```

**Fire-and-forget SFX (multi-step mid-round):**

```javascript
FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER }).catch(function (e) {
  console.error('Audio error:', e.message);
});
// Student can interact immediately — no await, no isProcessing block
```

---

## 7. When to Pause / Resume

Pause and resume are **only** triggered by visibility changes (tab switch, screen lock). Pause keeps audio position so it can resume. Pause ≠ Stop.

### Pause (tab hidden / screen lock):

```javascript
// Inside VisibilityTracker's onInactive callback:
FeedbackManager.sound.pause();
FeedbackManager.stream.pauseAll();
timer.pause({ fromVisibilityTracker: true });
if (previewScreen) previewScreen.pause();
// Pause overlay is shown by VisibilityTracker automatically — do NOT render your own.
```

### Resume (tab visible / return):

```javascript
// Inside VisibilityTracker's onResume callback:
FeedbackManager.sound.resume();
FeedbackManager.stream.resumeAll();
timer.resume({ fromVisibilityTracker: true });
if (previewScreen) previewScreen.resume();
// VisibilityTracker dismisses its own popup — do NOT hide a custom overlay here.
```

**Key:** Pause/resume applies to both static audio (`sound`) and dynamic TTS streams (`stream`). Timer also pauses/resumes in sync. The pause/resume popup is rendered by `VisibilityTracker`'s built-in `PopupComponent` (default `autoShowPopup: true`) — customize with `popupProps`, never replace with a game-local overlay.

---

## 8. What Feedback to Prioritise

When two feedback moments conflict, one wins and one is skipped or stopped:

| Conflict                                      | Winner                   | Loser                                   |
| --------------------------------------------- | ------------------------ | --------------------------------------- |
| Game over vs wrong-answer SFX                 | **Game over**            | Wrong SFX skipped entirely (Case 8)     |
| Student interaction vs dynamic TTS            | **Interaction**          | TTS stopped mid-sentence                |
| CTA tap vs any playing audio                  | **CTA**                  | All audio stopped immediately           |
| New transition screen vs previous audio       | **New screen**           | Previous audio stopped first            |
| End-game audio vs results screen rendering    | **Results screen**       | Screen renders first, audio plays after |
| `game_complete` postMessage vs end-game audio | **postMessage**          | Sent before audio starts                |
| Round-complete audio vs next round            | **Round-complete audio** | Next round waits until audio finishes   |
| recordAttempt vs feedback audio               | **recordAttempt**        | Attempt logged before any audio plays   |
| progressBar.update vs feedback audio          | **progressBar**          | UI updates before audio plays. Applies to per-answer feedback AND to round-complete: bar bumps **first**, then the awaited round-complete SFX runs. Otherwise the final round's Victory screen lags the bar at `N-1/N` (matching-doubles, April 2026). |

### Priority Ordering (highest to lowest):

1. **Screen rendering** — always appears first (results, game-over, transitions)
2. **Data events** — `game_complete` postMessage, `recordAttempt` fire before audio
3. **UI updates** — progressBar, score display, visual CSS update before audio
4. **Student interaction** — CTA taps, tile taps always interrupt audio
5. **Game-over flow** — overrides wrong-answer SFX when last life lost
6. **Awaited audio** — SFX → VO/TTS sequential pairs block input
7. **Fire-and-forget audio** — ambient/mid-round SFX plays in background

## 9. Interaction Patterns — Complete Reference

All worksheet questions use one of 16 base interaction patterns (or a compound combination). The pattern determines whether feedback is **single-step** (awaited SFX → awaited TTS) or **multi-step** (fire-and-forget partial-match SFX only mid-round; awaited SFX → awaited TTS at round-complete).

**252 worksheets · 4,026 total questions**

### Base Patterns (P1–P16)

| # | Pattern Name | Step Type | Events | What Happens |
|---|-------------|-----------|--------|--------------|
| **P1** | Tap-Select (Single/MCQ) | **Single** | `click` | Tap one option → immediate eval → round done |
| **P2** | Tap-Select (Sequential Chain) | **Multi** | `click` | Tap tiles in order to build a chain; wrong tap resets chain |
| **P3** | Tap-Select (Two-Phase Match) | **Multi** | `click` | Tap item A (left), then tap matching item B (right); two taps = one eval |
| **P4** | ~~Tap + Swipe~~ **DEPRECATED** | — | — | Use P1 tap-only with directional buttons |
| **P5** | Continuous Drag (Path) | **Multi** | `pointerdown` + `pointermove` + `pointerup` | Press and drag across grid cells to draw a path; backtrack by dragging backwards |
| **P6** | Drag-and-Drop (Pick & Place) | **Multi** | `pointerdown` + `pointermove` + `pointerup` | Pick up item, drag it, drop into a target zone; snap-back on miss |
| **P7** | Text/Number Input | **Single** | `keydown` + `click` | Type answer + Enter/Submit → immediate eval → round done |
| **P8** | Click-to-Toggle | **Multi** | `click` | Click cells to flip on/off; board auto-validates against constraints |
| **P9** | Stepper (+/-) | **Multi** | `click` | Tap +/- buttons to adjust values, then submit a typed answer |
| **P10** | Multi-Select + Submit | **Multi** | `click` + submit | Toggle multiple items on/off, then press Submit to evaluate all at once |
| **P11** | Same-Grid Pair Selection | **Multi** | `click` | Tap two items from the same pool that form a valid pair (e.g., sum to target) |
| **P12** | Tap-to-Assign (Palette) | **Multi** | `click` | Pick a colour/category from palette, then tap items to paint them |
| **P13** | Directional Drag (Constrained Axis) | **Multi** | `pointerdown` + `pointermove` + `pointerup` | Drag blocks along their locked axis (horizontal OR vertical); Rush Hour style |
| **P14** | Edge/Segment Toggle | **Multi** | `click` | Tap between dots to toggle line segments on/off; form a closed loop |
| **P15** | Cell Select → Number Picker | **Multi** | `click` | Tap cell → popup picker appears → tap number to place it; tap again to clear |
| **P16** | Sequence Replay | **Multi** | `click` | Watch elements flash in order (observe), then tap them back in same order (reproduce) |

### Compound Patterns

| Pattern | Name | Step Type | Description |
|---------|------|-----------|-------------|
| **P1+P7** | Tap-Select + Text Input (Feedback) | **Single** | Emoji/sentiment tap + text/audio feedback input; appears as last question in most worksheets |
| **P6+P7** | Drag-and-Drop + Text Input | **Multi** | Drag items to zones + type a value as part of the same round |
| **P8+P7** | Click-to-Toggle + Text Input | **Multi** | Toggle grid cells + type answer to complete |
| **P9+P7** | Stepper + Text Input | **Multi** | Adjust with +/- steppers then type final answer |
| **P8+P1** | Click-to-Toggle + Tap-Select | **Multi** | Toggle grid + dropdown/MCQ selection in same round |
| **P10+P7** | Multi-Select + Submit + Text Input | **Multi** | Select multiple items + type supplementary answer |
| **P6+P10** | Drag-and-Drop + Multi-Select | **Multi** | Drag items then select/submit additional choices |

### Modifiers

| Modifier | What It Does | Used By |
|----------|-------------|---------|
| **Observe-then-Respond** | Memorize/watch phase before interaction begins | Visual Memory, Simon Says, Associations, Disappearing Numbers, Face Memory, Keep Track, Listen and Add, Totals in a Flash, Word Pairs, Matrix Memory |
| **Multi-Step MCQ** | P1 used N times within one round as sub-steps | Expression Completer, Sequence Builder, Aided Game, Two-Digit Doubles Aided |

### Pattern Distribution Across All Worksheets

| Pattern | Name | Count | % of 4,026 |
|---------|------|-------|------------|
| P7 | Text/Number Input | 911 | 22.6% |
| P6 | Drag-and-Drop (Pick & Place) | 774 | 19.2% |
| P1+P7 | Tap-Select + Text Input (Feedback) | 549 | 13.6% |
| P10 | Multi-Select + Submit | 424 | 10.5% |
| P1 | Tap-Select (Single/MCQ) | 382 | 9.5% |
| P8 | Click-to-Toggle | 359 | 8.9% |
| P15 | Cell Select → Number Picker | 198 | 4.9% |
| P5 | Continuous Drag (Path) | 72 | 1.8% |
| P6+P7 | Drag-and-Drop + Text Input | 57 | 1.4% |
| P11 | Same-Grid Pair Selection | 53 | 1.3% |
| P12 | Tap-to-Assign (Palette) | 44 | 1.1% |
| P2 | Tap-Select (Sequential Chain) | 36 | 0.9% |
| P8+P7 | Click-to-Toggle + Text Input | 30 | 0.7% |
| P4 | ~~Tap + Swipe~~ **DEPRECATED** | 28 | 0.7% |
| P9+P7 | Stepper + Text Input | 28 | 0.7% |
| P3 | Tap-Select (Two-Phase Match) | 22 | 0.5% |
| P9 | Stepper (+/-) | 13 | 0.3% |
| P8+P1 | Click-to-Toggle + Tap-Select | 10 | 0.2% |
| P10+P7 | Multi-Select + Submit + Text Input | 9 | 0.2% |
| P13 | Directional Drag (Constrained Axis) | 5 | 0.1% |
| P6+P10 | Drag-and-Drop + Multi-Select | 1 | 0.0% |

### Feedback Mapping by Pattern Step Type

| Step Type | Patterns | Feedback Rule |
|-----------|----------|---------------|
| **Single-step** | P1, P7, P1+P7 | **All rounds (1..N), all shapes:** SFX awaited (~1.5s floor) → dynamic TTS **awaited** with subtitle + sticker (`try { await playDynamicFeedback(...); } catch(e){}`). Validator: `GEN-FEEDBACK-TTS-AWAIT`. Standalone end-of-game (`totalRounds: 1`) uses the same awaited TTS as part of `endGame()`'s 5-beat orchestrator (PART-050). |
| **Multi-step** | P2, P3, P5, P6, P8, P9, P10, P11, P12, P13, P14, P15, P16, P6+P7, P8+P7, P9+P7, P8+P1, P10+P7, P6+P10 | Mid-round partial-match SFX + sticker only — fire-and-forget. Round-complete: SFX awaited → TTS awaited. |

**Note:** P14 (Edge/Segment Toggle) and P16 (Sequence Replay) are defined but have zero occurrences across all 252 current worksheets.

---

## Games Generated

- https://storage.googleapis.com/mathai-temp-assets/games/position_maximizer/index.html
- https://storage.googleapis.com/mathai-temp-assets/games/doubles-chain/index.html
- https://storage.googleapis.com/mathai-temp-assets/games/game_jelly_doods/index.html
- https://storage.googleapis.com/mathai-temp-assets/games/game_connect/index.html
- https://storage.googleapis.com/mathai-temp-assets/games/game_matching_doubles/index.html
