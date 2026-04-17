# Skill: Feedback

## Purpose

Define exactly how games respond to student actions — what plays, when, in what sequence, when to wait, when to stop, and what to prioritise — so every game feels consistent, encouraging, and alive without the creator specifying feedback behavior.

## When to use

Every game generation. This skill is not optional. All feedback behavior described here is the **default** — creators do not need to specify it.

## Owner

Maintainer: Gen Quality slot (reviews feedback rules) + Education slot (reviews pedagogical tone).
Deletion trigger: retire when FeedbackManager is replaced by a new CDN feedback system.

## Reads

- `skills/game-archetypes/SKILL.md` — archetype determines pacing defaults — **ALWAYS**
- `skills/pedagogy/SKILL.md` — Bloom level determines subtitle depth — **ALWAYS**
- `skills/data-contract/` — recordAttempt and game_complete schemas — **ON-DEMAND**
- CDN FeedbackManager API (PART-017) — **ALWAYS**

## Input

- Bloom level (L1–L4)
- Game archetype
- PART-017 flag (YES = FeedbackManager available)

## Output

Feedback behavior baked into the generated game. The builder reads this skill and implements all cases by default.

## Reference Files

**MANDATORY:** When generating game code, ALWAYS read `reference/feedbackmanager-api.md` — it contains the exact CDN script URL, SFX audio URLs, sticker GIF URLs, and API code examples. Without it, audio URLs will be hallucinated and 404 in production.

| File | Contents | When to read |
|------|----------|-------------|
| [feedbackmanager-api.md](reference/feedbackmanager-api.md) | CDN script URL, FeedbackManager API (init, preload, sound.play, playDynamicFeedback), **exact SFX URLs**, **exact sticker GIF URLs**, preload categories, error handling, Bloom-level subtitles | **ALWAYS during code generation** |
| [timing-and-blocking.md](reference/timing-and-blocking.md) | Await vs fire-and-forget rules, input blocking, stop/pause triggers, data contract integration | **ALWAYS during code generation** |
| [what-plays-when.md](reference/what-plays-when.md) | Matrix of which feedback types (SFX, VO, TTS, sticker, subtitle) fire at each game moment | ON-DEMAND |
| [emotional-arc.md](reference/emotional-arc.md) | Pacing rhythm, streak celebration, failure recovery, game-over/victory tone | ON-DEMAND |
| [juice-animations.md](reference/juice-animations.md) | 7 CSS keyframe definitions, animation application, round presentation sequence | ON-DEMAND |

---

## Feedback Types

Every feedback moment uses a combination of these 5 types:

| Type | What it is | Plays alone? |
|------|-----------|-------------|
| **Static SFX** | Pre-recorded short sound effect (correct ding, life-lost buzz, bubble pop) | Yes |
| **Voiceover (VO)** | Pre-recorded narration ("Level 1", "Victory! 3 stars!") | Yes |
| **Dynamic TTS** | Text-to-speech generated on the fly ("Make 90", "Oops! 5 contributes only 50") | Yes |
| **Sticker** | Animated GIF overlay (celebration, sad, mascot) | Never alone — always paired with audio |
| **Subtitle** | On-screen text shown during audio ("Round 1", "Path complete!") | Never alone — always paired with audio |

---

## Default Feedback by Game Type

**CRITICAL — This is the default. No spec override needed.**

| Game type | How to identify | Correct answer feedback | Wrong answer feedback |
|-----------|----------------|----------------------|---------------------|
| **Single-step** | 1 interaction completes the round (MCQ, tap correct option, type answer, select one) | SFX (awaited) → dynamic TTS with subtitle + sticker (awaited) | SFX (awaited) → dynamic TTS with subtitle + sticker (awaited) |
| **Multi-step** | Multiple interactions to complete the round (matching pairs, chains, sorting, drag multiple items) | SFX + sticker only — **fire-and-forget, no dynamic TTS, no subtitle** | SFX + sticker only — **fire-and-forget, no dynamic TTS, no subtitle** |

**Why:** Single-step games have one moment per round to give rich feedback — the student benefits from hearing an explanation. Multi-step games need flow — adding dynamic TTS after every match/action would kill the pacing.

---

## Behavioral Cases

### CASE 1: Level Transition Screen

Transition screen shows level title, optional progress subtitle, and a CTA button. Audio readiness is awaited on the first level screen (poll `canPlayAudio()` every 200ms, give up after 15s). Audio plays **sequentially**: `await` level SFX (with sticker), then `await` level VO (dynamic TTS, with sticker, 5s). Both are awaited in order — the second never starts until the first finishes. **Student can tap the CTA at any time during this sequence — when tapped, stop all audio immediately (`stopAll()` + `_stopCurrentDynamic()`), proceed.**

### CASE 2: Round Transition Screen

**Variant A — Auto-advancing (no CTA):** Screen shows "Round N". Round SFX plays (awaited), then round VO plays (awaited) with sticker. After both finish, transition hides and gameplay begins. Student cannot skip.

**Variant B — With CTA:** Screen shows "Round N" with CTA. Audio plays **sequentially**: `await` round SFX (with sticker), then `await` round VO (dynamic TTS, with sticker). Both are awaited in order — the second never starts until the first finishes. **Student can tap CTA at any time during this sequence — when tapped, stop all audio immediately (`stopAll()` + `_stopCurrentDynamic()`), hide screen, load round.** If student waits for both audios to finish, screen persists until tapped.

### CASE 3: Round Start (Gameplay Begins)

Play area renders. Timer starts/resumes. In some games, dynamic TTS reads the question aloud with subtitle. **TTS does NOT block input** — student can interact immediately. If student taps while TTS is playing, TTS is stopped first.

### CASE 4: Correct Answer (Single-step games)

Input blocked immediately. Correct element turns green. **By default, two sequential audios play:** correct SFX with celebration sticker (awaited), then dynamic TTS with subtitle and sticker (awaited). The TTS speaks a context-aware explanation using actual numbers/values from the round — e.g., "Great! Placing 5 in the thousands place gives 5000". Sequence is always: SFX (awaited) → then TTS (awaited). After both audios finish, input unblocks. Game auto-advances to next round.

### CASE 5: Correct Match (Multi-step, within same round)

Matched elements turn green. Correct SFX plays with sticker — **fire-and-forget, does NOT block input**. **No dynamic TTS, no subtitle.** Student can immediately work on next match/chain while SFX plays.

### CASE 6: All Sub-Actions Complete (Round Finished)

"Round complete" SFX plays with sticker and subtitle (e.g., "All cards matched!"). **This audio IS awaited** — input paused until it finishes. Then game advances to next round/level/end-game.

### CASE 7: Wrong Answer (Lives Remaining)

**Single-step games:** Input blocked immediately. Wrong element flashes red (~600ms). Life lost — progress bar updates immediately. **By default, two sequential audios play:** wrong SFX with sad sticker (awaited), then dynamic TTS with subtitle and sticker (awaited). The TTS speaks a context-aware explanation using actual numbers/values from the round — e.g., "Not quite! 5 contributes only 50 from this position". Sequence: SFX (awaited) → then TTS (awaited). Red flash clears. After both audios finish, input unblocks. **Student stays on the same round** — retries. Wrong option is either deselected or permanently disabled.

**Multi-step games:** Wrong element flashes red (~600ms). Wrong SFX plays with sad sticker — **fire-and-forget, no dynamic TTS, no subtitle**. Life lost if applicable. Student continues interacting immediately.

### CASE 8: Wrong Answer (Last Life → Game Over)

Life lost — progress bar shows 0 lives. Red flash same as Case 7. **Wrong-answer SFX MUST play before game over** — same SFX + sticker as Case 7, awaited with `Promise.all` 1500ms minimum duration (same as every other answer-feedback call). After the wrong SFX finishes, game proceeds to Game Over (Case 12). The student must hear/see the incorrect feedback before the game-over screen appears.

### CASE 9: Tile Select / Deselect (Micro-interaction)

Soft bubble SFX on select, deselect SFX on deselect. **Fire-and-forget, no sticker, never blocks input.** If dynamic TTS is playing, stop it before processing the tap.

### CASE 10: Partial Progress (Chain/Multi-chain Games)

"Chain complete" SFX with sticker — **fire-and-forget, does NOT block input**. Then progress VO plays (e.g., "2 more chains to find!") with sticker. Student can start next chain immediately. On-screen text label updates with remaining count.

### CASE 11: Victory (All Rounds Finished)

Timer pauses. Results screen renders FIRST (stars, metrics, CTA). `game_complete` postMessage sent to parent BEFORE audio. Then: victory SFX (sticker, 3–5s) → victory VO, played sequentially. Different SFX + VO + sticker per star tier (3★/2★/1★). **CTA is already visible — if student taps while audio plays, stop all audio, restart game.**

### CASE 12: Game Over (0 Lives)

Timer pauses. Game Over screen renders FIRST (sad emoji, rounds completed, "Try Again" CTA). `game_complete` sent to parent BEFORE audio. Then: game-over SFX (sad sticker, 3s) → game-over VO (contextual, e.g., "You completed 2 rounds"). **CTA already visible — if tapped, stop all audio, restart.**

### CASE 13: Restart / Try Again

All audio stopped (static + dynamic + streams). All state resets. Optional restart VO with sticker. Game returns to first level/round transition.

### CASE 14: Visibility Hidden (Tab Switch / Screen Lock)

Timer pauses. All static audio pauses. All streams pause. "Game Paused" overlay with "Resume" button.

### CASE 15: Visibility Restored

Timer resumes. All audio resumes. All streams resume. Pause overlay dismisses. Gameplay continues exactly where it was.

### CASE 16: Audio Failure

Every audio call is try/catch wrapped. If audio fails, gameplay continues normally. Visual feedback (CSS classes, stickers) still renders. **Audio failure never blocks input, never blocks round advancement, never crashes the game.**

### CASE 17: New Content Appearing

When new round loads (new grid, tiles, cards), a soft "new cards" SFX plays — fire-and-forget, no sticker, doesn't block.

---

## Cross-Cutting Rules

1. **Screen before audio** — results/game-over screen always renders before end-game audio starts
2. **PostMessage before audio** — `game_complete` sent to parent before end-game audio plays
3. **CTA always stops audio** — any transition/results CTA, when tapped, stops all playing audio
4. **Wrong answer = stay on round** — never auto-advance after wrong
5. **Fire-and-forget for mid-round feedback** — correct matches in multi-step rounds don't block input
6. **Await for terminal feedback** — round-complete, level transitions, end-game audio are awaited
7. **Dynamic TTS is stoppable** — if student interacts while TTS plays, it's interrupted
8. **Sequential audio = await first, then second** — when two audios play back-to-back (SFX → VO, SFX → TTS), always `await` the first call before starting the second. Never fire both simultaneously. The second audio must NOT override/overlap the first.
9. **CTA interrupts mid-sequence** — if CTA is tapped while a sequential audio pair is playing (even between the two calls), call `stopAll()` + `_stopCurrentDynamic()` and proceed immediately

---

## Priority (What Wins When Two Feedback Moments Conflict)

| Conflict | Winner | Loser |
|----------|--------|-------|
| Game over vs wrong-answer SFX | Game over | Wrong SFX skipped entirely |
| Student interaction vs dynamic TTS | Interaction | TTS stopped mid-sentence |
| CTA tap vs any playing audio | CTA | All audio stopped |
| New transition screen vs previous audio | New screen | Previous audio stopped first |
| End-game audio vs results screen | Results screen | Screen renders first, audio after |
| `game_complete` postMessage vs end-game audio | postMessage | Sent before audio starts |
| Round-complete audio vs next round | Round-complete audio | Next round waits |

---

## Await vs Fire-and-Forget

| Feedback moment | Await? | Why |
|----------------|--------|-----|
| Level transition SFX → VO | **Yes** (sequential, CTA interrupts) | Both awaited in order; CTA stops all |
| Round transition (auto-advance) | **Yes** (sequential) | SFX → VO awaited in order; audio IS the pacing |
| Round transition (with CTA) | **Yes** (sequential, CTA interrupts) | SFX → VO awaited in order; CTA stops all |
| Round start TTS | No | Student should interact immediately |
| Correct SFX → TTS (single-step) | **Yes** (sequential) | SFX awaited, then dynamic TTS awaited; block input during both |
| Correct SFX (multi-step) | No | SFX + sticker only, fire-and-forget; don't interrupt flow |
| Round complete SFX | **Yes** | Gate before next round |
| Wrong SFX → TTS (single-step) | **Yes** (sequential) | SFX awaited, then dynamic TTS awaited; block input during both |
| Wrong SFX (multi-step) | No | SFX + sticker only, fire-and-forget |
| Tile select/deselect | No | Pure ambient |
| Partial progress SFX + VO | No | Don't interrupt flow |
| End-game SFX → VO | **Yes** (sequential) | But CTA visible, student CAN interrupt |
| New cards SFX | No | Ambient |

---

## Constraints

1. **CRITICAL — Never build custom feedback overlays.** FeedbackManager owns the overlay layer.
2. **CRITICAL — Input must be blocked during feedback** via `gameState.isProcessing` for single-step correct/wrong. Multi-step mid-round matches are the exception (fire-and-forget).
3. **CRITICAL — Never skip feedback.** Even obvious answers need confirmation.
4. **CRITICAL — Never show negative scores.** Score >= 0 always.
5. **CRITICAL — recordAttempt before audio.** Attempt data is captured before FeedbackManager plays.
6. **STANDARD — Subtitle under 60 characters.** FeedbackManager renders in a small area.
7. **STANDARD — Never use "wrong" in student-facing text.** Use "Not quite," "Close," "Almost."
8. **STANDARD — Audio failure is non-blocking.** Game continues if audio fails. *"Non-blocking" means `try { await FeedbackManager.sound.play(...) } catch (e) {}`* — NOT `Promise.race`. FeedbackManager already bounds every call internally (`sound.play` → audio-duration + 1.5s guard; `playDynamicFeedback` → 60s streaming / 3s TTS API timeout), so a plain `await` is guaranteed to resolve. Wrapping calls in `Promise.race([...setTimeout...])` or defining an `audioRace` helper truncates normal TTS (1–3s) and advances phase/round transitions before audio ends — validator rule `5e0-FEEDBACK-RACE-FORBIDDEN` blocks this at build time. See PART-026 Anti-Pattern 32.
9. **CRITICAL — Sequential audio must await in order.** When two audios play back-to-back (SFX → VO, SFX → TTS), `await` the first call fully before starting the second. Never fire both simultaneously. Use `audioStopped` flag to prevent second audio from starting if CTA was tapped during first.

## Anti-patterns

1. Building `<div class="feedback-overlay">` that conflicts with FeedbackManager.
2. Silent wrong answers — decrementing lives without playing SFX.
3. Blocking input during mid-round multi-step matches (kills flow).
4. Playing wrong-answer SFX when last life is lost (game-over SFX takes priority).
5. Rendering results screen AFTER end-game audio finishes (screen must appear FIRST).
6. Sending `game_complete` postMessage AFTER audio (must be sent BEFORE).
7. Using `new Audio()` instead of FeedbackManager (bypasses preloading and mute state).
8. Not stopping audio when CTA is tapped on transition/results screens.
9. Playing two audios simultaneously (e.g., SFX + VO at the same time) instead of sequentially awaiting each.
10. Starting the second audio without `await`-ing the first — the second overrides/overlaps the first.
11. Adding dynamic TTS to multi-step mid-round matches — kills pacing. Multi-step = SFX + sticker only.
12. Skipping dynamic TTS on single-step correct/wrong — single-step games ALWAYS play SFX → TTS by default.
