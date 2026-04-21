# Eval: Feedback

Tests for `skills/feedback/SKILL.md` — the skill that defines all feedback behavior: what plays, when, in what sequence, when to wait, when to stop, and what to prioritise.

## Version

v2 — 2026-04-07 — rewritten to match production patterns from 5 shipped games

## Setup

Context files that must be loaded before running:

- `skills/feedback/SKILL.md` (behavioral cases, cross-cutting rules, priority, await/fire-and-forget)
- `skills/feedback/reference/feedbackmanager-api.md` (actual API surface)
- `skills/feedback/reference/timing-and-blocking.md` (await patterns, input blocking, stop triggers)
- `skills/game-archetypes/SKILL.md` (archetype determines pacing defaults)
- `skills/pedagogy/SKILL.md` (Bloom level determines subtitle depth)

## Success Criteria

A feedback implementation passes when ALL of the following are true:

1. **Correct FeedbackManager API used.** `FeedbackManager.sound.play(id, {sticker})` for static audio, `FeedbackManager.playDynamicFeedback({audio_content, subtitle})` for TTS. Never a custom `playFeedback()` wrapper.
2. **Every event has a response.** No student action is silent — correct, wrong, round complete, victory, game over all handled.
3. **Await/fire-and-forget rules followed.** Single-step answers awaited, multi-step mid-round matches fire-and-forget.
4. **Input blocking correct.** `isProcessing` set before awaited audio, cleared after it resolves. Never set for fire-and-forget.
5. **Priority rules respected.** Game over skips wrong SFX. CTA stops audio. Screen renders before end-game audio.
6. **recordAttempt before audio.** Data captured before FeedbackManager plays.
7. **Emotional safety maintained.** No punitive language, game-over is encouraging, failure recovery at 3+ consecutive wrong.

## Ship-Readiness Gate

All P0 cases must PASS. All P1 cases must PASS or PARTIAL.

---

## Cases

### Case 1: Correct answer — single-step game (awaited feedback)

**Priority:** P0
**Type:** happy-path
**Judge:** llm

**Input:**

```
Archetype: MCQ Quiz
Bloom: L2 Understand
Topic: Classifying triangles
PART-017: YES

Round: "A triangle has sides 5cm, 5cm, 8cm. What type is it?"
Correct answer: Isosceles
Student selects: Isosceles (correct)
```

**Expect:**

- [ ] `gameState.isProcessing = true` set immediately
- [ ] Correct option gets green CSS class (`.correct` / `.selected-correct`)
- [ ] `recordAttempt({...correct: true})` called BEFORE audio
- [ ] `progressBar.update(round, lives)` called
- [ ] `FeedbackManager.sound.play('correct_sound_effect', { sticker: {..., duration: 2, type: 'IMAGE_GIF'} })` awaited
- [ ] After audio resolves: `gameState.isProcessing = false`, then advance to next round
- [ ] [LLM] No setTimeout used for timing — audio duration IS the timing

**Why:** Tests the core correct-answer flow with proper await pattern and production API.

---

### Case 2: Wrong answer — lives remaining (stay on round)

**Priority:** P0
**Type:** happy-path
**Judge:** llm

**Input:**

```
Archetype: MCQ Quiz
Bloom: L2 Understand
PART-017: YES

Student answers incorrectly. Lives: 3 → 2.
```

**Expect:**

- [ ] `gameState.isProcessing = true` set immediately
- [ ] Wrong option gets red CSS class (`.wrong` / `.incorrect`)
- [ ] Life decremented: `gameState.lives--`
- [ ] `progressBar.update(round, lives)` called immediately (student sees lost heart)
- [ ] `recordAttempt({...correct: false})` called BEFORE audio
- [ ] `FeedbackManager.sound.play('incorrect_sound_effect', { sticker: {..., duration: 2} })` awaited
- [ ] Red flash clears after ~600ms
- [ ] After audio resolves: `gameState.isProcessing = false`
- [ ] **Student stays on the same round** — not auto-advanced
- [ ] [LLM] Wrong option is either deselected (retry freely) or permanently disabled

**Why:** Tests that wrong answers don't advance the round and follow the correct await + blocking pattern.

---

### Case 3: Wrong answer — last life lost (wrong SFX plays, then game over)

**Priority:** P0
**Type:** edge-case
**Judge:** llm

**Input:**

```
Any archetype, PART-017: YES
Student answers incorrectly. Lives: 1 → 0.
```

**Expect:**

- [ ] Life decremented to 0
- [ ] **Wrong-answer SFX plays** — same SFX + sticker as Case 2 (awaited with Promise.all 1500ms minimum)
- [ ] After wrong SFX finishes, game proceeds to game-over flow
- [ ] Game Over screen renders FIRST (title, sad emoji, rounds completed, "Try Again" CTA)
- [ ] `game_complete` postMessage sent to parent BEFORE game-over audio
- [ ] Game over SFX plays (with sad sticker, 3s) → game over VO plays (sequential await)
- [ ] CTA is already visible during audio — if tapped, all audio stops, game restarts
- [ ] [LLM] No "incorrect" audio plays before game-over audio (priority rule)

**Why:** Tests the priority rule — game over trumps wrong-answer SFX.

---

### Case 4: Multi-step correct match (fire-and-forget, don't block)

**Priority:** P0
**Type:** happy-path
**Judge:** llm

**Input:**

```
Archetype: Matching game (pairs/chains)
PART-017: YES

Student matches one pair. 3 more pairs remain in the round.
```

**Expect:**

- [ ] Matched elements get green CSS class
- [ ] `FeedbackManager.sound.play('correct_sound_effect', { sticker })` called but NOT awaited (fire-and-forget with `.catch()`)
- [ ] `gameState.isProcessing` is NOT set to true — student can immediately match next pair
- [ ] `recordAttempt` called for the match
- [ ] [LLM] Student is never blocked from continuing to work while correct SFX plays

**Why:** Tests that multi-step mid-round feedback doesn't block input — critical for flow in matching/chain games.

---

### Case 5: Round complete (all sub-actions done — awaited)

**Priority:** P1
**Type:** happy-path
**Judge:** llm

**Input:**

```
Archetype: Matching game
PART-017: YES

Student matches the last pair in the round. All pairs complete.
```

**Expect:**

- [ ] "Round complete" SFX plays with sticker and subtitle (e.g., "All cards matched!")
- [ ] This audio IS awaited — input paused until it finishes
- [ ] After audio: game advances to next round transition, level transition, or end-game
- [ ] [LLM] Round-complete audio is the gate — next round does not load until it finishes

**Why:** Tests the distinction: mid-round matches are fire-and-forget, but round completion IS awaited.

---

### Case 6: Transition screen CTA stops audio

**Priority:** P1
**Type:** interaction
**Judge:** llm

**Input:**

```
Level transition screen visible. Level VO is playing with sticker.
Student taps "I'm ready!" CTA.
```

**Expect:**

- [ ] `FeedbackManager._stopCurrentDynamic()` called (if dynamic TTS)
- [ ] `FeedbackManager.sound.stopAll()` called
- [ ] Transition screen hides
- [ ] Game proceeds to round transition or gameplay
- [ ] [LLM] Audio does not continue playing after CTA tap

**Why:** Tests the cross-cutting rule: CTA always stops audio.

---

### Case 7: Victory — screen before audio, CTA interruptible

**Priority:** P1
**Type:** happy-path
**Judge:** llm

**Input:**

```
Student completes all rounds with 3 stars.
PART-017: YES
```

**Expect:**

- [ ] Timer pauses
- [ ] Results screen renders FIRST (stars, metrics, "Play Again" button visible)
- [ ] `game_complete` postMessage sent to parent BEFORE audio
- [ ] Victory SFX plays (with celebration sticker, 3-5s) — awaited
- [ ] Then victory VO plays — awaited
- [ ] If student taps "Play Again" while audio is playing: all audio stops, game restarts
- [ ] [LLM] Student never waits for a blank screen while audio plays

**Why:** Tests the end-game ordering: screen → postMessage → audio. And CTA interrupt.

---

### Case 8: Visibility hidden/restored

**Priority:** P1
**Type:** edge-case
**Judge:** llm

**Input:**

```
Game is mid-round. Student switches tabs.
```

**Expect:**

- [ ] Timer pauses
- [ ] `FeedbackManager.sound.pause()` called
- [ ] `FeedbackManager.stream.pauseAll()` called
- [ ] "Game Paused" overlay appears
- [ ] On return: timer resumes, audio resumes, streams resume, overlay dismisses
- [ ] Gameplay continues from exactly where it was

**Why:** Tests pause/resume behavior — audio must pause (not stop) so it can resume.

---

## Eval Scoring

| Result | Meaning |
|--------|---------|
| PASS | All assertions in Expect checklist pass |
| PARTIAL | Some assertions fail — note which ones |
| FAIL | Critical assertions fail or output is fundamentally wrong |

## Ship Gate Check

| Case | Priority | Required result |
|------|----------|----------------|
| Case 1: Correct answer (awaited) | P0 | PASS |
| Case 2: Wrong answer (stay on round) | P0 | PASS |
| Case 3: Last life (wrong SFX plays, then game over) | P0 | PASS |
| Case 4: Multi-step match (fire-and-forget) | P0 | PASS |
| Case 5: Round complete (awaited) | P1 | PASS or PARTIAL |
| Case 6: CTA stops audio | P1 | PASS or PARTIAL |
| Case 7: Victory screen-before-audio | P1 | PASS or PARTIAL |
| Case 8: Visibility pause/resume | P1 | PASS or PARTIAL |
