# Game Design: Add List with Adjustment Strategy

<!-- machine-readable (validator pick-up) -->
- **totalRounds:** 9
- **totalLives:** 3

## Identity

- **Game ID:** add-list-adjustment-strategy
- **Title:** Add List with Adjustment Strategy
- **Class/Grade:** Class 4-5 (Grade 4-5) — the adjustment / compensation strategy is typically introduced once students are fluent with two-digit addition (NCERT Class 4 "Carts and Wheels", Class 5 "Parts and Wholes"). Authoritative concept source does not pin a grade — defaulted.
- **Math Domain:** Number & Operations — Whole-Number Addition.
- **Topic:** Mental-math **adjustment (compensation) strategy** for sum of two 2-digit addends. The student decrements one addend by `k` and increments the other by `k` to reach a friendlier pair (e.g. a multiple of 10), then computes the sum. Because compensation conserves the total, the final sum equals the original sum regardless of how many +/- presses were made.
- **Bloom Level:** L3 Apply — students apply a known strategy (compensation) to concrete problems. They do not merely recall (L1) or explain (L2); they must choose **how** to shift addends to produce an easier pair and then compute. Lives = 3 (L3+ default).
- **Archetype:** Construction (#7) — the student **builds** an easier addition expression using dedicated per-addend +/- buttons before submitting the sum. It is not an MCQ (no options) and not a pure input game (the workspace matters at least as much as the typed answer). Reset + submit + type-sum is the same build-and-check pattern as `equation-builder` / `adjustment-strategy`.

## One-Line Concept

Student taps + / - buttons to adjust each of two two-digit addends toward a friendlier pair (like 60 + 70), types the final sum, and submits — the answer is always the original sum, teaching that compensation preserves the total.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Compensation strategy | Recognise that adding `k` to one addend and subtracting `k` from the other keeps the sum constant. | All rounds |
| Benchmark-number sense | Choose a pair of "nice" numbers (multiples of 10) that are near the given addends. | All rounds |
| Two-digit mental addition | Add a pair of multiples of 10 (or near-multiples) without paper. | All rounds |
| Numeric input accuracy | Type a two- or three-digit sum with the on-screen/number keyboard without typos. | All rounds |
| Self-correction | Use the Reset button to undo a wrong adjustment path and try again. | All rounds |

---

## Core Mechanic

Single interaction archetype. Hybrid tap + type input: tap the +/- buttons to move each addend; tap Reset to restore originals; type the final sum into a `?` input box; tap "Next Round" to submit.

### Type A: "Adjust and sum" (all rounds)

1. **Student sees:** Two stacked "adjust cells" side by side separated by a black `+` operator glyph. Each cell has:
   - A **light-pink tinted `-` button above** (decrement by 1, data-testid `btn-a-minus` or `btn-b-minus`).
   - A **white number display in the middle** showing the current value (border is light-gray for B1 & B3, light-blue for B2 — per concept spec).
   - A **light-green tinted `+` button below** (increment by 1, data-testid `btn-a-plus` or `btn-b-plus`).
   Below the workspace is a single light-gray square **`?` placeholder input** (type=text, inputmode=numeric, data-testid `sum-input`). Upper-right of the workspace is a **dark-gray "↺ Reset" pill button** (data-testid `btn-reset`). Bottom-right is a **yellow "Next Round" button** (data-testid `btn-submit`) that is disabled until the sum field has a numeric value.
   Header: `Q1` label, timer starting at `00:00` (count-up, displayed `mm:ss`), `0/10` star counter (cosmetic, advisory — see Warnings). Below header: "0/9 rounds completed" progress text, 3 DARK hearts (concept spec calls for dark, not red), and the CDN progress bar.
2. **Student does:**
   - Taps `-` to decrement that addend by 1, or `+` to increment by 1 (repeat freely).
   - Taps Reset to restore both addends to their original starting values (each tap logs an event).
   - Taps the `?` input, types a number (mobile numeric keyboard), presses Enter or taps Next Round to submit.
3. **Correct criterion:** `parseInt(inputValue, 10) === originalA + originalB`, regardless of how many +/- / reset taps occurred. If the typed sum equals the true original sum, correct. Otherwise wrong.
4. **Feedback:**
   - **Correct:** Awaited correct SFX (1500ms minimum via `Promise.all`) + correct sticker. Fire-and-forget dynamic TTS ("Great thinking!"). Progress bar bumps `roundsCompleted` BEFORE awaited audio. Advance to next round via `showRoundIntro`.
   - **Wrong (lives > 0):** Awaited wrong SFX (1500ms) + wrong sticker. Fire-and-forget TTS ("Not quite — the sum of X and Y is Z.") Life decrements. Input box shakes briefly and flashes red. Reset to original addends and clear the input for a retry (student stays on the same round to try again). `wrongAttempts++`.
   - **Wrong (lives == 0):** Awaited wrong SFX (1500ms min) then `endGame('game_over')` with the "Ready to improve your score?" motivation flow (standard Construction archetype game-over, per Rule 3 of feedback skill).

---

## Rounds & Progression

### Stage 1: Starter pairs near 10-friendly benchmarks (Rounds 1–3)
- Round type: Type A.
- Addend range: each in [55, 78], both requiring ±1..±4 to reach a multiple of 10.
- B1 canonical pair (Round 1 per concept): **58 + 72**. Canonical solve path: 58+2=60 and 72-2=70 → 60+70=130. Sum = 130.
- Border color: light-gray (default).

### Stage 2: Tighter adjustments + blue-bordered cells (Rounds 4–6)
- Round type: Type A.
- Addend range: each in [61, 79]. Adjustments still ±1..±4.
- B2 canonical pair (Round 4 per concept): **62 + 68**. Canonical solve path: 62-2=60 and 68+2=70 → 60+70=130. Sum = 130.
- Border color: **light-blue** on the number boxes (concept-spec call-out).

### Stage 3: Wider and higher pairs (Rounds 7–9)
- Round type: Type A.
- Addend range: each in [64, 78]. Adjustments ±3..±5 (bigger nudge to the benchmark).
- B3 canonical pair (Round 7 per concept): **66 + 74**. Canonical solve path: 66+4=70 and 74-4=70 → 70+70=140. Sum = 140.
- Border color: light-gray.

### Summary Table

| Dimension | Stage 1 (R1–3) | Stage 2 (R4–6) | Stage 3 (R7–9) |
|-----------|----------------|----------------|----------------|
| Round type | A | A | A |
| Addend magnitude | 55–78 | 61–79 | 64–78 |
| Typical adjustment `|k|` | 1–3 | 1–3 | 3–5 |
| Cell border color | light-gray | **light-blue** | light-gray |
| Canonical example | 58 + 72 = 130 | 62 + 68 = 130 | 66 + 74 = 140 |
| Target first-attempt rate | 75% | 65% | 55% |

---

## Game Parameters

- **Rounds:** **9** (3 per stage) — per concept spec.
- **Timer:** **Count-up** `mm:ss`, starts at `00:00` (per concept screenshots; `00:03` was a mid-game snapshot, not a starting value). Drives the speed-based star calculation.
- **Lives:** **3** (dark hearts — concept spec explicitly calls for dark not red). Wrong answer decrements one life; zero lives → game-over.
- **Star rating** (by average time per LEVEL, where a level = 3 rounds):
  - **3 stars** = avg time per level **< 15 seconds** (per concept spec)
  - **2 stars** = avg time per level **< 25 seconds**
  - **1 star** = avg time per level **≥ 25 seconds** but the player completed all 9 rounds
  - **0 stars** = game-over (lives exhausted before round 9)
- **Input:** Hybrid — **tap** on +, -, reset, submit buttons AND **text/numeric input** for the sum (Pattern P7 companion behaviors: auto-focus, auto-growing width, Enter-submits, keyboard-visibility scroll).
- **Feedback:** FeedbackManager `sound.play('correct_sound_effect' | 'incorrect_sound_effect')` awaited with 1500ms floor; `playDynamicFeedback` fire-and-forget for round-level VO. Last-life wrong plays full SFX before `endGame('game_over')`.

---

## Scoring

- **Points:** +1 per round solved correctly on ANY attempt (max 9).
- **Stars:** by average level time, as above.
- **Lives:** 3; each wrong answer ‑1 life; game-over at 0.
- **Partial credit:** none; the sum is either correct or wrong. Wrong attempts are recorded in `gameState.wrongAttempts` for analytics.

---

## Flow

**Shape:** Multi-round (default) with two deltas.

**Changes from default:**
- On wrong answer with lives remaining, the round **retries** (same addends re-randomised back to original; sum input cleared). This matches the standard Lives Challenge archetype, NOT the CHECK→NEXT pattern used by logic-seat-puzzle.
- Star computation uses **speed** (average time per level) rather than correctness count. All 9 rounds MUST be completed for any stars > 0.

```
[Preview Screen (PART-039)]
        |
        v
[Welcome / Level Screen]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: timer starts, cells show original A + B; student taps +/-, Reset, types sum]
        |
        | tap Next Round (sum field non-empty)
        v
[Validate: parseInt(input) === originalA + originalB]
        |
        +--> TRUE  --> Correct feedback (SFX + sticker + TTS)
        |                    |
        |                    v
        |              [If N < 9: Round N+1 Transition]
        |              [If N == 9: Victory / Results]
        |
        +--> FALSE --> Wrong feedback (SFX + sticker + TTS)
                            |
                            +-- lives > 0 --> lives--; reset to originals; clear input; retry round N
                            |
                            +-- lives == 0 --> [Game Over / Motivation → Restart]
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Tap `+` or `-` on a cell | Cell number updates immediately. Fire-and-forget `tap_sound`. Visually pulse the cell value briefly (no blocking). |
| Tap Reset | Both addends restored to originals. Fire-and-forget `sound_bubble_deselect`. `deltaA` / `deltaB` reset to 0. |
| Input field receives focus | Auto-scroll so input + cells are visible above the virtual keyboard. (visualViewport resize listener.) |
| Type a digit into the input | Input width grows with content (MIN_W 72px → MAX_W 300px). No audio. |
| Press Enter OR tap Next Round | Submit handler runs if input non-empty. |
| Correct submit | Progress bar bumps first (`progressBar.update(roundsCompleted+1, livesLeft)`). `isProcessing=true`. `recordAttempt` logged BEFORE audio. `await Promise.all([FeedbackManager.sound.play('correct_sound_effect', {sticker: STICKER_CORRECT}), setTimeout(1500)])`. Fire-and-forget `playDynamicFeedback({audio_content:'Great thinking!', sticker: STICKER_CORRECT}).catch(...)`. Advance via `showRoundIntro(N+1)`. |
| Wrong submit, lives remain | Input box shake + flash red. Lives--. Progress bar `update(roundsCompleted, livesLeft)`. `recordAttempt` logged with `misconception_tag` BEFORE audio. `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_WRONG}), setTimeout(1500)])`. Fire-and-forget `playDynamicFeedback({audio_content:'Not quite — sum of X and Y is Z.', sticker: STICKER_WRONG}).catch(...)`. Reset cells to originals, clear sum input, keep student on the same round. |
| Wrong submit, lives == 0 | `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect'), setTimeout(1500)])` FIRST (NEVER skip last-life wrong SFX). Then `endGame('game_over')`. |
| Round complete (correct) | `roundsCompleted += 1`. If `currentRound % 3 == 0` (end of level), push elapsed level time to `levelTimes`. |
| All 9 rounds complete | Results screen renders FIRST. `game_complete` postMessage fires BEFORE audio. Stars computed from `levelTimes` average. Victory SFX + TTS sequence (awaited, CTA interruptible). |
| Claim Stars | `FeedbackManager.sound.stopAll()` + `_stopCurrentDynamic()`. Show "Yay stars collected!" for 2500ms, then `game_exit` postMessage + `endGame(true)`. |
| Play Again | `FeedbackManager.sound.stopAll()` + `_stopCurrentDynamic()`. Show "Ready to improve your score?" transition → tap `I'm ready` → `restartGame()`. |
| Visibility hidden | `FeedbackManager.sound.pause()`, `stream.pauseAll()`, timer.pause, previewScreen.pause. |
| Visibility restored | `FeedbackManager.sound.resume()`, `stream.resumeAll()`, timer.resume, previewScreen.resume. |

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Add the numbers using the adjustment strategy.</b><br>Tap <b>+</b> and <b>-</b> to nudge each number toward a friendly pair (like 60 and 70). Then type the sum and tap <b>Next Round</b>.</p>',
  previewAudioText: 'Add the numbers using the adjustment strategy. Nudge each number toward a friendly pair, then type the sum and tap Next Round.',
  previewAudio: null,                    // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ============== STAGE 1 — starter pairs, light-gray border ==============
    {
      round: 1, stage: 1, type: 'A',
      numberA: 58, numberB: 72, correctAnswer: 130,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +2, deltaB: -2, targetA: 60, targetB: 70 },
      feedbackWrong: 'Not quite. 58 plus 72 is 130.',
      feedbackCorrect: 'Great thinking! 60 plus 70 is 130.',
      misconception_tags: {
        'adjust-one-only':          'Student shifts only one addend (e.g. 58→60) and forgets to subtract 2 from the other; types 132.',
        'double-compensation':      'Student adjusts both addends in the SAME direction (58→60 and 72→74) and types 134.',
        'arithmetic-slip':          'Student computes 60+70 correctly in their head but mistypes (e.g. 13, 1300, 103).',
        'input-noise':              'Typo — leading zero, empty, non-numeric; treat as wrong.'
      }
    },
    {
      round: 2, stage: 1, type: 'A',
      numberA: 57, numberB: 73, correctAnswer: 130,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +3, deltaB: -3, targetA: 60, targetB: 70 },
      feedbackWrong: 'Not quite. 57 plus 73 is 130.',
      feedbackCorrect: 'Nice! 60 plus 70 is 130.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only A or only B.',
        'double-compensation': 'Shifts both addends in the same direction.',
        'arithmetic-slip':     'Correct adjusted pair but mistyped sum.'
      }
    },
    {
      round: 3, stage: 1, type: 'A',
      numberA: 65, numberB: 78, correctAnswer: 143,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +5, deltaB: -8, targetA: 70, targetB: 70 }, // 70+73=143 (one benchmark move)
      feedbackWrong: 'Not quite. 65 plus 78 is 143.',
      feedbackCorrect: 'Great! 70 plus 73 is 143.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only one addend.',
        'double-compensation': 'Shifts both in same direction; types 153.',
        'arithmetic-slip':     'Arithmetic error in head-adding after adjusting.'
      }
    },

    // ============== STAGE 2 — light-BLUE border cells ==============
    {
      round: 4, stage: 2, type: 'A',
      numberA: 62, numberB: 68, correctAnswer: 130,
      borderStyle: 'blue',
      suggestedAdjust: { deltaA: -2, deltaB: +2, targetA: 60, targetB: 70 },
      feedbackWrong: 'Not quite. 62 plus 68 is 130.',
      feedbackCorrect: 'Yes! 60 plus 70 is 130.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only one addend; types 132.',
        'double-compensation': 'Shifts both in same direction.',
        'arithmetic-slip':     'Sum error after adjustment.'
      }
    },
    {
      round: 5, stage: 2, type: 'A',
      numberA: 64, numberB: 67, correctAnswer: 131,
      borderStyle: 'blue',
      suggestedAdjust: { deltaA: -4, deltaB: +3, targetA: 60, targetB: 70 }, // 60+71=131
      feedbackWrong: 'Not quite. 64 plus 67 is 131.',
      feedbackCorrect: 'Good one! 60 plus 71 is 131.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only A or only B.',
        'double-compensation': 'Shifts both same direction.',
        'arithmetic-slip':     'Arithmetic error after adjustment.'
      }
    },
    {
      round: 6, stage: 2, type: 'A',
      numberA: 61, numberB: 79, correctAnswer: 140,
      borderStyle: 'blue',
      suggestedAdjust: { deltaA: -1, deltaB: +1, targetA: 60, targetB: 80 },
      feedbackWrong: 'Not quite. 61 plus 79 is 140.',
      feedbackCorrect: 'Great! 60 plus 80 is 140.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only one addend; types 141 or 139.',
        'double-compensation': 'Shifts both same direction.',
        'arithmetic-slip':     'Typed 130, 150, or similar after correct adjust.'
      }
    },

    // ============== STAGE 3 — wider nudges, light-gray border ==============
    {
      round: 7, stage: 3, type: 'A',
      numberA: 66, numberB: 74, correctAnswer: 140,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +4, deltaB: -4, targetA: 70, targetB: 70 },
      feedbackWrong: 'Not quite. 66 plus 74 is 140.',
      feedbackCorrect: 'Nice! 70 plus 70 is 140.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only A or only B; types 144 or 136.',
        'double-compensation': 'Shifts both same direction; types 148.',
        'arithmetic-slip':     'Correct adjustment but typed wrong sum.'
      }
    },
    {
      round: 8, stage: 3, type: 'A',
      numberA: 67, numberB: 78, correctAnswer: 145,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +3, deltaB: -3, targetA: 70, targetB: 75 }, // 70+75=145
      feedbackWrong: 'Not quite. 67 plus 78 is 145.',
      feedbackCorrect: 'Great! 70 plus 75 is 145.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only A or only B.',
        'double-compensation': 'Shifts both same direction.',
        'arithmetic-slip':     'Arithmetic error after adjustment.'
      }
    },
    {
      round: 9, stage: 3, type: 'A',
      numberA: 64, numberB: 77, correctAnswer: 141,
      borderStyle: 'default',
      suggestedAdjust: { deltaA: +6, deltaB: -7, targetA: 70, targetB: 70 }, // 70+71=141
      feedbackWrong: 'Not quite. 64 plus 77 is 141.',
      feedbackCorrect: 'You got it! 70 plus 71 is 141.',
      misconception_tags: {
        'adjust-one-only':     'Shifts only A or only B.',
        'double-compensation': 'Shifts both in same direction.',
        'arithmetic-slip':     'Final typed sum off by 10 / sign of adjustment reversed.'
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 4-5** (source silent). Compensation strategy typically introduced here.
- **Bloom Level:** defaulted to **L3 Apply** (source silent). Matches archetype + lives=3 default.
- **Archetype:** **Construction (#7)** — student builds an easier expression using +/- widgets before entering a typed sum. Reset + Submit is the canonical build-and-check loop.
- **Rounds:** **9** per concept spec (explicit).
- **Lives:** **3** per concept spec ("3 dark hearts"). Hearts rendered via CDN ProgressBar; CSS overrides heart color to dark (`#272B2E` or `--mathai-primary`) — the CDN default is red.
- **Timer:** **count-up mm:ss** starting at 00:00 (concept screenshot shows 00:03 mid-round; starting value defaulted to 00:00).
- **Input:** hybrid — tap on +/-/reset/submit buttons AND typed sum in a single text input with `inputmode="numeric"`.
- **Feedback style:** `FeedbackManager.sound.play` awaited with 1500ms floor; `playDynamicFeedback` fire-and-forget on submit handler; awaited with CTA-interrupt on transition screens. Standard platform pattern.
- **Scaffolding:** no explicit hint besides the "reset" affordance. Wrong answer reveals the correct sum in the TTS line and retries.
- **Preview screen:** included (default `previewScreen: true` — PART-039).
- **Star computation:** speed-based (avg level time < 15s / < 25s / any). The `0/10 star counter` in the concept header is cosmetic — flagged in Warnings.

---

## Warnings

- **WARNING — Cosmetic star counter mismatch.** Concept spec header shows a `0/10` star progress readout. The game has 9 rounds, and stars are awarded by speed (max 3), not by counting correct rounds. The `0/10` is a UI residue of an older template and SHOULD NOT be wired to the real star count. Implementation: render a static cosmetic chip with a decorative icon + "0/10" label in the header, but compute actual stars from `levelTimes`. DECISION-POINT: confirm with Education slot; if they prefer a per-round star (0/9 rounded), update the label to `0/9` and remove the decorative `10`.
- **WARNING — Speed-based stars with L3 Apply is stressful.** Speed thresholds (< 15s avg/level) are aggressive for 9-year-olds. Consider softening to < 20s / < 30s in playtesting.
- **WARNING — Reset behaviour on wrong answer.** On a wrong submission the game resets addends to originals AND clears the input, essentially forcing a full re-do. Some platforms prefer preserving the last adjustment so the student can iterate. Spec chose full reset for clarity; DECISION-POINT.
- **WARNING — "Dark hearts" requires CSS override on CDN ProgressBar.** The CDN component renders red hearts by default. Game CSS must target the heart class (`.heart`, `.mathai-heart`, or CDN-documented selector) and recolor to dark. If the override breaks the "hearts painted only by CDN" rule (`5e0-LIVES-DUP-FORBIDDEN`), fall back to the default red and note in build log.
- **WARNING — Adjustment is optional, not required.** A student can ignore the +/- buttons entirely and just compute 58+72=130 mentally. This is NOT penalised — the strategy is taught, not enforced. Telemetry records whether any +/- was tapped (`events: adjust_number`) so analytics can distinguish strategy-users from direct-adders.
- **WARNING — Input accepts negative values and very large numbers.** `inputmode="numeric"` is a hint; the real validator is `parseInt(value, 10) === originalA + originalB` (exact match). Whitespace trim + NaN filter is done; anything else is just wrong. No cap on length.
