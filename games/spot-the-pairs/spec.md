# Game Design: Spot the Pairs — Friendly Pairs Sum Challenge

## Identity

- **Game ID:** spot-the-pairs
- **Title:** Spot the Pairs — Friendly Pairs Sum Challenge
- **Class/Grade:** Class 1-3 (Grade 1-3) — number bonds / friendly pairs of 10 and 20 is an early-primary fluency skill. The source concept ("friendly pairs of 10 and 20") maps to NCERT Class 2 "Maths Magic" ("Give and Take"), and Class 3 "Maths Magic" ("Give and Take: Add and Subtract") where number bonds to 10 and 20 are explicitly practised.
- **Math Domain:** Number & Operations — Addition / Number Bonds
- **Topic:** Recognising complementary addition pairs that sum to a benchmark number (10 or 20). Trains automatic recall of friendly pairs (e.g., 6+4=10, 13+7=20) — a prerequisite for mental strategies like "make 10" and "bridging through 10".
- **Bloom Level:** L2 Understand (recognising the benchmark sum for a given expression); with speed pressure, edges into L1 Remember (fluency recall). Chosen: **L2 Understand**.
- **Archetype:** Speed Blitz (#2) — timed, multi-step tap-to-select where multiple correct targets exist on screen simultaneously, wrong taps cost a life, and a 2-second-per-pair bonus drives urgency.
- **NCERT Alignment:** Class 2 Math "Give and Take" (pairs that make 10); Class 3 Math "Give and Take" (pairs that make 20). Also aligns with NCF-2022 foundational-stage numeracy fluency outcomes.

## One-Line Concept

Students scan a staggered 3+3+2 board of addition expressions and tap **all** the expressions whose result equals the target sum shown in the header (10 or 20), racing the 2-second-per-pair bonus threshold.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Number-bond recognition | Recognise pairs summing to 10 (e.g., 6+4, 7+3, 2+8) and to 20 (e.g., 12+8, 13+7) without re-computing from scratch. | All rounds (A for target 10; B for target 20) |
| Mental addition fluency | Compute 1-digit + 1-digit (target 10) and 2-digit + 1-digit / teen + single (target 20) sums under mild time pressure. | All rounds |
| Visual scanning | Sweep an 8-pill board and classify each pill as "matches target" vs "does not" in under ~2s/pill. | All rounds |
| Speed-of-recall | Produce each correct tap under 2 seconds to earn a 3-star speed bonus. | Speed threshold applies across all rounds |
| Selective attention | Ignore 4–5 distractor expressions (pairs that DO NOT sum to the target) while choosing the 3–4 targets. | All rounds |

---

## Core Mechanic

Single interaction type across all rounds — **multi-tap selection** on a fixed 8-pill board with per-pill correctness evaluation and per-pill feedback. This is NOT "tap once to submit the whole round"; it is "tap each correct pill and each correct tap permanently removes that pill from the board".

### Type A: "Make Sum 10" (Levels 1 and 3 — rounds 1 and 3)

1. **Student sees:** Header banner reading "Make Sum 10". A staggered 3+3+2 board of **eight** pill-shaped buttons, each showing an addition expression like "6 + 4" or "3 + 8". Light-lavender pill fill, purple text. Status bar at top showing Q1 label, timer, 10-star counter, 3 red hearts for lives, and a horizontal progress bar labelled "1/4 Levels". A yellow "Next Round" CTA pinned to the bottom-right, disabled until the level clears.
2. **Student does:** Taps every pill whose two addends sum to **10**.
   - Correct tap → pill turns purple/highlighted, awaited correct SFX with celebration sticker (~1s), pill disappears from the board after a short fade.
   - Wrong tap → pill flashes red, awaited wrong SFX with sad sticker, one life decrements, pill remains on the board so the student can try another.
   - Level is cleared when every pill summing to the target has been tapped correctly (i.e., 3 or 4 correct pills, depending on the level).
3. **What counts as correct:** Every pill whose two displayed addends sum exactly to 10.
4. **What feedback plays:** Per-correct-tap: awaited correct SFX ~1s (multi-step pattern — short, fire-and-forget TTS with subtitle is suppressed per feedback SKILL multi-step default). Per-wrong-tap: awaited wrong SFX + red flash + life decrement. On level clear (all targets found): "level complete" SFX + progress bar advances + "Next Round" CTA enables.

### Type B: "Make Sum 20" (Levels 2 and 4 — rounds 2 and 4)

Identical interaction to Type A; only the target sum and the expression pool change. Expressions in Type B range over teen + single-digit and 2-digit + 1-digit addends (e.g., "13 + 7", "14 + 6", "11 + 8") so the player practises pairs of 20.

1. **Student sees:** Same layout as Type A; banner reads "Make Sum 20".
2. **Student does:** Same — tap every pill summing to 20.
3. **Correct criterion:** Every pill whose two displayed addends sum exactly to 20.
4. **Feedback:** Identical to Type A.

---

## Rounds & Progression

There are **4 levels** (spec concept phrasing) which, in Alfred's "round" vocabulary, are **4 rounds**. Levels 1-4 alternate the target sum; the target-10 pool is drawn from the B1 canonical source (6+4, 5+6, 3+8, 2+8, 4+5, 7+4, 5+5, 6+3) with 3 correct pills. The target-20 pool uses matched-difficulty teen expressions, with 3 or 4 correct pills.

### Stage 1: Warm-up (Level 1)
- Round type: Type A (target = 10).
- 8 pills, **3 correct** (6+4, 2+8, 3+7 — wait, canonical B1 content is 6+4, 5+6, 3+8, 2+8, 4+5, 7+4, 5+5, 6+3 → correct pills are 6+4, 2+8, 5+5, and 7+3 is NOT in the pool). The 8-pill B1 pool is **6+4, 5+6, 3+8, 2+8, 4+5, 7+4, 5+5, 6+3** → correct pills summing to 10 are **6+4, 2+8, 5+5** (3 correct). Distractors: 5+6=11, 3+8=11, 4+5=9, 7+4=11, 6+3=9.
- Cognitive demand: **Recognise** — small, familiar friendly pairs of 10.

### Stage 2: Target switch (Level 2)
- Round type: Type B (target = 20).
- 8 pills, **3 correct** (e.g., 13+7=20, 12+8=20, 14+6=20). Distractors: 11+8=19, 15+4=19, 12+7=19, 13+9=22, 11+7=18.
- Cognitive demand: **Apply** — bridge to a new benchmark (20). Teen + single-digit arithmetic.

### Stage 3: Return to 10 with denser distractors (Level 3)
- Round type: Type A (target = 10).
- 8 pills, **4 correct** (e.g., 7+3, 8+2, 4+6, 9+1). Distractors: 5+6=11, 6+3=9, 3+8=11, 4+5=9.
- Cognitive demand: **Fluency** — four targets in a slightly denser distractor field.

### Stage 4: Return to 20 (Level 4)
- Round type: Type B (target = 20).
- 8 pills, **4 correct** (e.g., 15+5, 11+9, 13+7, 12+8). Distractors: 14+7=21, 13+5=18, 16+3=19, 11+7=18.
- Cognitive demand: **Fluency** — four targets with 2-digit + 1-digit teen arithmetic.

### Summary Table

| Dimension | Stage 1 / L1 | Stage 2 / L2 | Stage 3 / L3 | Stage 4 / L4 |
|-----------|--------------|--------------|--------------|--------------|
| Round type | A (sum 10) | B (sum 20) | A (sum 10) | B (sum 20) |
| Target | 10 | 20 | 10 | 20 |
| Pills shown | 8 | 8 | 8 | 8 |
| Correct pills | 3 | 3 | 4 | 4 |
| Distractor count | 5 | 5 | 4 | 4 |
| Addend range | 0–9 | 1–16 (teen + single) | 0–9 | 1–16 (teen + single) |
| Target first-level clear rate | 85–95% | 75–85% | 75–85% | 65–80% |

---

## Game Parameters

- **Rounds:** 4 (one per level).
- **Timer:** None for the game/level (the 2-second-per-pair threshold is a **speed bonus**, not a hard timer). The top-bar timer pill visually counts up-seconds-since-level-start, but level-clear or life-loss are the only way to leave the level; the timer does NOT force-end a level.
- **Lives:** 3 (shared across the whole 4-level game). Each wrong tap on a distractor deducts 1 life. If lives reach 0 on a wrong tap → game over (no retry of the current level).
- **Star rating (10-star counter visible during play; final-screen 3-star rating):**
  - **10-star counter:** Each correct pill awards **1 star** if tapped within 2 seconds of its level becoming interactive (measured from the moment the level first enables taps), else **0 stars** for that pill. With 3+3+4+4 = 14 available correct pills across 4 levels, capped at 10. The header counter is "X / 10" and increments ONLY on a speed-bonus-qualifying correct tap.
  - **3-star final rating** (for the Victory screen):
    - 3 stars = 8–10 stars earned (i.e., ≥80% of fast taps)
    - 2 stars = 5–7 stars earned
    - 1 star = 1–4 stars earned
    - 0 stars = 0 stars earned (student still reaches Victory unless lives ran out; 0-lives = Game Over)
- **Input:** Tap (single-tap per pill, multi-tap per level). Pattern **P1 Tap (multi-select multi-step)** — tap-interaction pattern, multi-step model.
- **Feedback:** Multi-step per-tap feedback per feedback SKILL CASE 5 / CASE 7 (multi-step variant). Level-clear = CASE 6. Game over = CASE 8/12. Victory = CASE 11.

---

## Scoring

- **Points:** +1 per correct pill (tap on an expression that sums to the target). Wrong tap = 0 points, −1 life. Max points = 14 (sum of correct pills across 4 levels).
- **Stars (10-counter):** +1 per correct pill tapped within 2s of the level's first-tap-enabled timestamp; 0 stars for correct-but-slow pills. Cap at 10 even if 11+ fast pills exist.
- **Stars (3-star Victory):** Thresholds above. Purely a function of the 10-star counter at game end.
- **Lives:** 3 total across the game, not per-level. Each wrong tap = −1 life. At 0 lives on a wrong tap, game transitions to Game Over. Correct taps do not affect lives.
- **Partial credit:** Yes at the level granularity — if the student taps 2 of 3 correct pills and then loses their last life, the 2 correct pills still counted for points + stars (recorded in `recordAttempt`). Scoring does NOT discard a partially-cleared level.

---

## Flow

**Shape:** Multi-round (default) with customizations:

1. **Multi-tap per round** — within each level, the student taps up to N correct pills (plus any wrong taps). `renderRound` is called once at level-start; the level ends when `foundCorrect === targetCorrectCount`. No "submit" button; evaluation is per-tap.
2. **Wrong answers stay on round** — a wrong tap does NOT advance the round. The student can continue tapping until they find all correct pills or run out of lives.
3. **"Next Round" CTA** — the yellow bottom-right "Next Round" button is the explicit between-level advance (not auto-advance). It enables only after the level is cleared (`foundCorrect === targetCorrectCount`).
4. **Game over on lives=0** — standard game-over branch (retained from default flow).

Changes from default:
- Round-complete trigger is "all correct pills found", not "single answer submitted".
- Advance is explicit via "Next Round" CTA, not auto.
- Per-tap feedback is multi-step fire-and-forget; level-complete is the awaited terminal feedback.

```
[Preview Screen (PART-039)]
        |
        v
[Level 1 (Round 1) Transition: "Level 1 — Make Sum 10"]
        |
        v
[Gameplay: 8 pills, banner "Make Sum 10", hearts 3, stars 0/10, timer running]
        |
        | tap loop (per-pill):
        |   correct pill not tapped --> per-tap correct (purple flash + SFX) -> fade out pill -> foundCorrect++, speed-check, maybe +1 star
        |   distractor  --> per-tap wrong (red flash + SFX) -> lives--, if lives==0 -> Game Over (after SFX)
        |
        +--> foundCorrect == targetCorrectCount --> Level Complete (awaited SFX + sticker) --> "Next Round" CTA enables
        |
        | tap Next Round
        v
[Round 2 Transition: "Level 2 — Make Sum 20"]
        |
        ... repeats for Levels 3 and 4 ...
        |
        v
[After Level 4 cleared: Victory screen (results)]
        |  (or any-level lives==0 --> Game Over branch, then "Try Again")
        v
[Claim Stars / Play Again / Stars Collected]
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Preview shown | PART-039 preview overlay: instruction HTML + audio narrates the task. Student can skip. |
| Round/Level intro | TransitionScreen shows `Level N` with `rounds_sound_effect` SFX + celebration sticker + dynamic VO line "Make sum of ten!" or "Make sum of twenty!" (awaited, CTA-interruptible if CTA present; this transition auto-advances so it's sequential SFX→VO and then gameplay starts). |
| Correct tap (pill matches target) | Per CASE 5 (multi-step mid-round correct): pill turns purple, awaited correct SFX (~1s) + sticker STICKER_CORRECT (Promise.all 1500ms min), fire-and-forget TTS suppressed (multi-step default). Pill fades/removes. `foundCorrect` increments. If tap time ≤ 2s since level-enable, `starCount` increments (max 10) and progress star-count display updates. `recordAttempt({correct: true})` fires BEFORE audio. |
| Correct tap (level clears via this tap) | CASE 6 round-complete: same as correct-tap SFX, plus level-complete awaited sequence: `progressBar.update(level, lives)` FIRST, then level-clear SFX. "Next Round" CTA enables (yellow bg visible). |
| Wrong tap (distractor, lives > 1 after deduction) | CASE 7 multi-step wrong: pill flashes red, awaited wrong SFX (Promise.all 1500ms min) + sticker STICKER_WRONG. `lives -= 1`. `recordAttempt({correct: false, misconception_tag})` fires BEFORE audio. Pill remains tappable-interactive after red-flash clears (~600ms). |
| Wrong tap (last life lost) | CASE 8: wrong SFX awaited with 1500ms Promise.all floor; lives goes to 0; then `endGame(false)` → Game Over branch. |
| Game Over | Timer pauses. Game Over TransitionScreen renders FIRST (sad sticker, "You completed N levels" subtitle, "Try Again" CTA). `game_complete` postMessage sent BEFORE audio. Then awaited game-over SFX + VO. CTA interrupts audio. |
| Next Round CTA tapped | `FeedbackManager.sound.stopAll() + _stopCurrentDynamic()`; advance to next level's Round Intro. |
| Last level cleared / Victory | Timer pauses. Victory TransitionScreen renders FIRST (stars, "X of 10 fast taps!" subtitle). `game_complete` sent BEFORE audio. SFX + VO awaited. CTA interrupts. |
| Play Again | Stop all audio; show Motivation screen; "I'm ready!" → `restartGame()` (no preview re-show). |
| Stars Collected | Auto-dismiss 2500ms; `postMessage({type:'game_exit'})`. |
| Visibility hidden/restored | `VisibilityTracker` handles pause overlay via its built-in `PopupComponent`. Never roll a custom pause overlay. Pause/resume timer + audio + preview. |

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Tap and select all friendly pairs of 10 and 20!</b><br><br>Spot each pair under 2 seconds to win 3 stars!</p>',
  previewAudioText: 'Tap and select all friendly pairs of ten and twenty. Spot each pair under two seconds to win three stars.',
  previewAudio: null, // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ===================================================================
    // LEVEL 1 (Round 1) — target 10, B1 canonical pool
    // Correct pills: 6+4, 2+8, 5+5 (3 correct)
    // Distractors: 5+6, 3+8, 4+5, 7+4, 6+3
    // ===================================================================
    {
      round: 1,
      level: 1,
      stage: 1,
      type: 'A',
      target: 10,
      targetLabel: 'Make Sum 10',
      pills: [
        { id: 'p1_1', a: 6, b: 4, correct: true  },
        { id: 'p1_2', a: 5, b: 6, correct: false },
        { id: 'p1_3', a: 3, b: 8, correct: false },
        { id: 'p1_4', a: 2, b: 8, correct: true  },
        { id: 'p1_5', a: 4, b: 5, correct: false },
        { id: 'p1_6', a: 7, b: 4, correct: false },
        { id: 'p1_7', a: 5, b: 5, correct: true  },
        { id: 'p1_8', a: 6, b: 3, correct: false }
      ],
      correctCount: 3,
      misconception_tags: {
        'off-by-one-under':   "Student taps 5+6=11 or 3+8=11 — adds one too many (computation-error bias toward 11).",
        'off-by-one-over':   "Student taps 4+5=9 or 6+3=9 — under-counts by 1.",
        'digit-confusion':   "Student taps 7+4=11 — swaps addends or misreads.",
        'arbitrary-fill':    "Student taps any pill to try their luck."
      }
    },

    // ===================================================================
    // LEVEL 2 (Round 2) — target 20, teen + single / 2-digit
    // Correct pills: 13+7, 12+8, 14+6 (3 correct)
    // Distractors: 11+8=19, 15+4=19, 12+7=19, 13+9=22, 11+7=18
    // ===================================================================
    {
      round: 2,
      level: 2,
      stage: 2,
      type: 'B',
      target: 20,
      targetLabel: 'Make Sum 20',
      pills: [
        { id: 'p2_1', a: 13, b: 7, correct: true  },
        { id: 'p2_2', a: 11, b: 8, correct: false },
        { id: 'p2_3', a: 12, b: 8, correct: true  },
        { id: 'p2_4', a: 15, b: 4, correct: false },
        { id: 'p2_5', a: 14, b: 6, correct: true  },
        { id: 'p2_6', a: 12, b: 7, correct: false },
        { id: 'p2_7', a: 13, b: 9, correct: false },
        { id: 'p2_8', a: 11, b: 7, correct: false }
      ],
      correctCount: 3,
      misconception_tags: {
        'off-by-one-under': "Student taps 11+8=19, 15+4=19, 12+7=19 — off by one under 20.",
        'off-by-one-over':  "Student taps 13+9=22 — off by one over.",
        'off-by-two':       "Student taps 11+7=18 — off by two.",
        'place-value-drop': "Student adds only the ones digits (e.g., 13+9 → 3+9=12 rather than 22)."
      }
    },

    // ===================================================================
    // LEVEL 3 (Round 3) — target 10, 4 correct, denser distractor field
    // Correct pills: 7+3, 8+2, 4+6, 9+1 (4 correct)
    // Distractors: 5+6=11, 6+3=9, 3+8=11, 4+5=9
    // ===================================================================
    {
      round: 3,
      level: 3,
      stage: 3,
      type: 'A',
      target: 10,
      targetLabel: 'Make Sum 10',
      pills: [
        { id: 'p3_1', a: 7, b: 3, correct: true  },
        { id: 'p3_2', a: 5, b: 6, correct: false },
        { id: 'p3_3', a: 8, b: 2, correct: true  },
        { id: 'p3_4', a: 6, b: 3, correct: false },
        { id: 'p3_5', a: 4, b: 6, correct: true  },
        { id: 'p3_6', a: 3, b: 8, correct: false },
        { id: 'p3_7', a: 9, b: 1, correct: true  },
        { id: 'p3_8', a: 4, b: 5, correct: false }
      ],
      correctCount: 4,
      misconception_tags: {
        'off-by-one-under': "Student taps 5+6=11 or 3+8=11.",
        'off-by-one-over':  "Student taps 6+3=9 or 4+5=9.",
        'arbitrary-fill':   "Student taps any pill."
      }
    },

    // ===================================================================
    // LEVEL 4 (Round 4) — target 20, 4 correct
    // Correct pills: 15+5, 11+9, 13+7, 12+8 (4 correct)
    // Distractors: 14+7=21, 13+5=18, 16+3=19, 11+7=18
    // ===================================================================
    {
      round: 4,
      level: 4,
      stage: 4,
      type: 'B',
      target: 20,
      targetLabel: 'Make Sum 20',
      pills: [
        { id: 'p4_1', a: 15, b: 5, correct: true  },
        { id: 'p4_2', a: 14, b: 7, correct: false },
        { id: 'p4_3', a: 11, b: 9, correct: true  },
        { id: 'p4_4', a: 13, b: 5, correct: false },
        { id: 'p4_5', a: 13, b: 7, correct: true  },
        { id: 'p4_6', a: 16, b: 3, correct: false },
        { id: 'p4_7', a: 12, b: 8, correct: true  },
        { id: 'p4_8', a: 11, b: 7, correct: false }
      ],
      correctCount: 4,
      misconception_tags: {
        'off-by-one-over':   "Student taps 14+7=21.",
        'off-by-two-under':  "Student taps 13+5=18 or 11+7=18.",
        'off-by-one-under':  "Student taps 16+3=19.",
        'place-value-drop':  "Student drops the tens digit entirely."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 1-3** (source concept silent). "Friendly pairs of 10 and 20" maps to early-primary number-bonds work per NCERT.
- **Bloom Level:** defaulted to **L2 Understand** (recognising benchmark-sum relationships; adjacent to L1 Remember for already-fluent students).
- **Archetype:** **Speed Blitz (#2)** — timed per-pair speed bonus + lives + multi-tap target selection. Alternatives rejected: MCQ (#1) does not fit (multiple simultaneous correct answers); Sort (#4) does not fit (no drag or category bins); Lives Challenge (#3) fits but Speed Blitz's "speed bonus under time threshold" is a better semantic match.
- **Rounds:** **4** (per source concept "4 levels per round" — interpreted as 4 levels total; each level = one round in Alfred vocabulary).
- **Lives:** **3** (per source concept "3 red hearts").
- **Timer:** **None as a hard timer**; a 2-second-per-pair speed threshold is used ONLY for the 10-star bonus counter. The header timer pill counts up-seconds visually.
- **Speed threshold:** **2 seconds per pair** (per source concept "Spot each pair under 2 seconds to win 3 stars!").
- **10-star counter:** defaulted to +1 per correct pill tapped within 2s of level-enable timestamp; cap at 10. Max reachable = min(14, 10) = 10. Final 3-star rating thresholds 8/5/1 fixed in scoring.
- **Input:** **Tap (multi-select, multi-step)** per source concept ("Tap and select all friendly pairs").
- **Feedback style:** **FeedbackManager** (multi-step per CASE 5/7; level-complete per CASE 6).
- **Language:** English (per platform default).
- **Accessibility:** Touch-only, 44px minimum targets (pills sized ≥56px tall), sufficient contrast (purple-on-lavender for pills; red for wrong flash; green for correct).
- **Preview screen:** included (default `previewScreen: true` — PART-039).
- **Layout:** **Staggered 3+3+2** pill grid per source concept. Row 1 = 3 pills, Row 2 = 3 pills directly under row 1, Row 3 = 2 pills centred under the first two columns.
- **Pill order:** As written in fallbackContent per round — NOT shuffled at runtime, because the staggered layout is semantically meaningful (source concept explicitly names positions) and because test determinism requires stable pill indices. If UX wants shuffling, it can be added later; flagged in Warnings.
- **Next Round CTA:** Always shown but disabled until level cleared. Position: bottom-right, yellow background per source concept. Ships as part of the gameplay DOM (not a separate transition screen).
- **Stage assignment:** Each level is its own stage (4 stages, 1 round per stage) since variants differ per level by target and correct count.

---

## Warnings

- **WARNING — 4 rounds is below the default 9.** Source concept explicitly says 4 levels. This is unusual but matches the source exactly. Session length ≈ 3–5 minutes.
- **WARNING — 10-star counter + 3-star final rating = two star systems.** The header "X/10" tracks speed-bonus pills; the Victory screen renders a 0–3 star rating derived from that counter. Students may conflate the two. Preview/instruction should mention "3 stars" per source concept; the "10" counter is implicit and not narrated.
- **WARNING — "Timer" displayed but not enforced.** The header shows a timer pill per source concept (starts at "00:03" in the screenshot, implied count-up). It is NOT a hard round timer; it does NOT cause game-over; it is purely visual. Implementation flag: implement as a `count-up` display only; the 2s speed threshold is compared against `Date.now() - levelEnableTime`, not against the timer display. If UX wants a hard timer later, Education slot can revisit.
- **WARNING — Pills do not shuffle.** The 3+3+2 position mapping is stable. Tests rely on pill IDs (`p1_1`..`p4_8`). If future iterations want randomised position, add a stable `seed` and rearrange the staggered grid indices, but keep `pill.id` stable.
- **WARNING — Last-life wrong SFX.** Per CASE 8 + PART-017 `5e0-FEEDBACK-MIN-DURATION`, the wrong-SFX MUST play (awaited, Promise.all 1500ms floor) before game-over. Do NOT skip wrong SFX on last life. This is tested by static validator.
- **WARNING — Correct pill fade removal vs. re-tap.** Once a correct pill is tapped, it is removed from the board (or made non-interactive with `pointer-events: none`). Do NOT allow re-tap on a correct pill (double-count would corrupt scoring).
- **WARNING — "Next Round" CTA is interactive during level, disabled visually and programmatically.** A tap on a disabled CTA must be a no-op (guard at top of handler). After level-clear, CTA becomes the ONLY way to advance; do NOT auto-advance.
- **WARNING — Speed threshold ≤ 2s applies per-pair since the previous tap.** For the first correct tap of a level, the reference is the level-enable timestamp (when the level first becomes tappable — captured once when gameplay begins). For each subsequent correct tap, the reference is the prior correct-tap timestamp. If a student takes 3s to find pill 1 and then 1s for pill 2, only pill 2 qualifies for the speed star. Wrong taps do NOT reset the reference timestamp (so a student can still earn the star on the next correct tap if they chain them quickly). This matches the source-concept phrasing "Spot each pair under 2 seconds".
