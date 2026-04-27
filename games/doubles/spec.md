# Game Design: Doubles — Doubling Speed Challenge

## Identity
- **Game ID:** doubles
- **Title:** Doubles — Doubling Speed Challenge
- **Class/Grade:** Class 2-4 (Grade 2-4)
- **Math Domain:** Number & Operations — Multiplication (2× table)
- **Topic:** Doubling — rapid recall of `2 × N` for N in 5..19
- **Bloom Level:** L1 Remember / L2 Understand (automatic recall of doubling facts)
- **Archetype:** Lives Challenge (#3) — single-select MCQ with speed pressure, 3 lives, 3 stages × 5 rounds = 15 rounds total.
- **NCERT Alignment:** NCERT Class 2 "Footprints" + Class 3 "Multiply and Divide" (2× table drills). Speed-recall practice for CBSE Class 2-4 arithmetic fluency.

## One-Line Concept
Students tap the correct double of a target number from a single horizontal row of three pill-shaped buttons as fast as possible — 15 rounds, 3 dark-heart lives, 3-star threshold at average answer time <2s.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Automatic doubling recall | Retrieve `2 × N` without re-adding (fact fluency, not re-computation) | All rounds |
| Speed under pressure | Produce the correct answer under implicit time pressure to build fluency threshold <2s/answer | All rounds |
| Distractor discrimination | Reject near-miss distractors (`2N ± 2`, `2N ± 4`, `N + 10`) without second-guessing | All rounds |

## Core Mechanic

### Type A: "Double of N — single-MCQ speed tap" (all rounds)
1. **Student sees:** Prompt `Double of <N>` with N in a large display. Below, a single horizontal row of **three** pill-shaped option buttons. Above the prompt: `#mathai-progress-slot` shows round counter (e.g. `3 / 15`) and **three DARK (black) heart** lives on the right (distinct from red hearts used in most other games in this pack). A yellow rounded-rectangle "Next Round" button anchored bottom-right is visible but inactive — the game auto-advances on correct tap, so the button is primarily a visual anchor / manual nudge.
2. **Student does:** Taps exactly one option button. Single-step tap (pattern P1). On tap, all three buttons are immediately disabled to prevent double-tap.
3. **Correct criterion:** Tapped button value `=== 2 × N`.
4. **Feedback:**
   - **Correct:** Tapped button highlights **green** (solid green fill + white text) for ~350ms; fire-and-forget `correct_sound_effect` SFX (no awaited 1.5s dwell — speed game explicitly demands zero-delay auto-advance per spec); **instant transition** to the next prompt. NO TTS on correct (speed game). `recordAttempt(correct: true)` fired before the SFX.
   - **Wrong:** Tapped button flashes **red** (~400ms); correct button simultaneously highlights green so the student sees the answer; life decrements (3 → 2 → 1 → 0) with dark-heart animation inside the CDN ProgressBar strip; awaited `incorrect_sound_effect` SFX with 1500ms minimum dwell per PART-017; fire-and-forget TTS subtitle: "Double of N is 2N". Then auto-advance to the next round (unless lives = 0 → game over).

## Rounds & Progression

### Stage / Level 1: "Easy doubles" (Rounds 1–5)
- Round type: A.
- Target numbers N: small and round (6, 10, 11, 8, 12).
- Distractors: near-miss `2N ± 2` + plausible wrong like `N + 10`.
- Cognitive demand: Automatic recall from the 2× table.
- Target first-attempt rate: 85–95%.

### Stage / Level 2: "Medium doubles" (Rounds 6–10)
- Round type: A.
- Target numbers N: mid-range (13, 14, 16, 17, 15).
- Distractors: slightly tighter (`2N ± 4`, swap digits, operation-reversal like `N / 2 × 3`).
- Cognitive demand: Recall where re-adding is tempting.
- Target first-attempt rate: 70–85%.

### Stage / Level 3: "Harder doubles" (Rounds 11–15)
- Round type: A.
- Target numbers N: largest (18, 19, 22, 23, 25).
- Distractors: tightest (`2N ± 2`, magnitude-error like `20 + N`).
- Cognitive demand: Recall on less-practiced 2× facts; some N values require crossing a decade.
- Target first-attempt rate: 55–70%.

### Summary Table
| Dimension | Stage 1 (R1–5) | Stage 2 (R6–10) | Stage 3 (R11–15) |
|-----------|----------------|------------------|-------------------|
| Target N range | 6–12 | 13–17 | 18–25 |
| Distractor tightness | 2N ± 2, + 10 | 2N ± 4, swap | 2N ± 2, magnitude |
| Cognitive load | Low | Medium | High |
| Target 1st-attempt rate | 85–95% | 70–85% | 55–70% |

**Between stages:** A summary pause screen shows "Average time per double: X.Xs" + "Target: under 2s" using `TransitionScreenComponent`, before advancing to the next stage's first round intro.

## Game Parameters
- **Rounds:** 15 (3 stages × 5 rounds each)
- **Timer:** None (global). Per-answer response time is captured for star calculation; no visible countdown.
- **Lives:** 3 (**DARK / BLACK hearts** — distinct from the red hearts in other games in this pack, per source concept).
- **Star rating (by AVERAGE response time on CORRECT answers across all completed rounds):**
  - **3 stars** = average correct answer time **< 2.0 seconds**
  - **2 stars** = average correct answer time `>= 2.0s` AND `< 3.5s`
  - **1 star** = average correct answer time `>= 3.5s` OR any remaining correct answers
  - **0 stars** = game-over with zero correct rounds
- **Input:** MCQ single-tap (pattern P1). Three pill-shaped option buttons in a single horizontal row.
- **Feedback:** FeedbackManager with `correct_sound_effect` (fire-and-forget on correct — instant-advance game) and `incorrect_sound_effect` (awaited 1500ms dwell, per PART-017 `5e0-FEEDBACK-MIN-DURATION`).

## Scoring
- **Points:** +1 per correct round. Max 15.
- **Stars:** By average response time across correct answers (see thresholds above). Speed is the primary grading axis — not raw accuracy.
- **Lives:** 3 dark hearts at start. Each wrong answer = -1 life. At 0 lives → `endGame('game_over')` → Game Over transition screen (distinct from Victory) with encouraging copy.
- **Partial credit:** None — binary correct/wrong per round.

## Flow

**Shape:** Multi-round (default) + customizations.

**Changes from default:**
- Insert a **stage summary pause transition** between Round 5 → Round 6 and Round 10 → Round 11 showing "Average time per double" + target.
- Game Over branch active (lives = 3).
- Correct answer: **instant advance** — no 1500ms dwell on correct (speed game). SFX fire-and-forget.
- Victory path: star calculation uses **average response time**, not raw score.

```
[PreviewScreen (PART-039)]
        |
        v
[Round 1 intro: "Round 1"] (auto-advance after rounds SFX)
        |
        v
[Gameplay Round N: "Double of N" + 3-option row + 3 dark hearts]
        |
        +-- tap CORRECT option --> green highlight (350ms) ----> [Round N+1 intro OR Stage summary OR Victory]
        |        (fire-and-forget SFX; NO awaited dwell — instant-advance)
        |
        +-- tap WRONG option ----> red flash on tapped +
                                    green highlight on correct +
                                    life -1 (dark-heart animation) +
                                    awaited wrong SFX (1500ms floor) +
                                    fire-and-forget TTS "Double of N is 2N"
                                      |
                                      +-- if lives > 0 --> [Round N+1 intro OR Stage summary]
                                      +-- if lives == 0 --> [Game Over screen]

[After Round 5]  --> [Stage 1 → Stage 2 summary: "Avg time: X.Xs · Target: <2s"]
[After Round 10] --> [Stage 2 → Stage 3 summary: "Avg time: X.Xs · Target: <2s"]
[After Round 15] --> [Victory: 3/2/1/0 stars by avg time + "Play Again" / "Claim Stars"]

[Game Over] --> "Play Again" --> restart (no preview, direct to Round 1 intro)
```

## Feedback
| Event | Behavior |
|-------|----------|
| Option tap (correct) | Button highlights **solid green** (white text) ~350ms; `recordAttempt({correct: true})` fires FIRST; `FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT }).catch(...)` fire-and-forget (no 1500ms floor — speed game); progress bar bumps rounds-completed FIRST; auto-advance to next round intro within ~400ms. |
| Option tap (wrong, lives > 0) | Tapped button flashes **red** for 400ms; correct button simultaneously highlights solid green; `recordAttempt({correct: false, misconception_tag})` fires BEFORE audio; lives -= 1; `progressBar.update(roundsCompleted, livesRemaining)` called FIRST; `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_WRONG}), new Promise(r => setTimeout(r, 1500))])`; fire-and-forget TTS "Double of N is 2N" via `playDynamicFeedback`; auto-advance to next round intro. |
| Option tap (wrong, last life) | Same wrong-SFX sequence (NEVER skip wrong SFX per feedback SKILL constraint 3) + correct answer reveal, THEN transition to Game Over. `game_complete` postMessage fires BEFORE game-over audio. |
| Complete all 15 rounds | Compute stars from average correct response time; render Victory transition screen; `game_complete` postMessage BEFORE audio; play victory SFX + fire-and-forget TTS ("You averaged X.Xs — N stars!"). Buttons: `Play Again` (if stars < 3), `Claim Stars`. |
| Stage 1 → Stage 2 (after Round 5) | TransitionScreen: title "Level 2 — Faster!"; subtitle "Average time: {X.X}s · Target: under 2s"; button "Continue" → Round 6 intro. `onMounted` plays `rounds_sound_effect`. |
| Stage 2 → Stage 3 (after Round 10) | Same pattern as Stage 1 → 2. Title "Level 3 — Speed Up!". |
| Visibility hidden | VisibilityTracker pauses (FeedbackManager.pause + preview.pause). Own pause overlay is managed by VisibilityTracker's PopupComponent — never custom. |
| Visibility restored | VisibilityTracker resumes. |

## Content Structure (fallbackContent)

```javascript
const fallbackContent = {
  previewInstruction: '<p><b>Tap on the doubles as fast as possible!</b><br><br>You get 3 stars for doubling each number within 2 seconds!</p>',
  previewAudioText: 'Tap on the doubles as fast as possible! You get three stars for doubling each number within two seconds.',
  previewAudio: null,          // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ===== Stage 1: Easy doubles (Rounds 1-5) =====
    { round: 1,  stage: 1, type: 'A', n: 6,  options: [12, 10, 14], answer: 12,
      misconception_tags: { '10': 'off-by-2-under', '14': 'off-by-2-over' } },
    { round: 2,  stage: 1, type: 'A', n: 10, options: [22, 20, 18], answer: 20,
      misconception_tags: { '22': 'off-by-2-over', '18': 'off-by-2-under' } },
    { round: 3,  stage: 1, type: 'A', n: 11, options: [20, 22, 24], answer: 22,
      misconception_tags: { '20': 'off-by-2-under', '24': 'off-by-2-over' } },
    { round: 4,  stage: 1, type: 'A', n: 8,  options: [16, 14, 18], answer: 16,
      misconception_tags: { '14': 'off-by-2-under', '18': 'off-by-2-over' } },
    { round: 5,  stage: 1, type: 'A', n: 12, options: [20, 28, 24], answer: 24,
      misconception_tags: { '20': 'off-by-4-under', '28': 'off-by-4-over' } },

    // ===== Stage 2: Medium doubles (Rounds 6-10) =====
    { round: 6,  stage: 2, type: 'A', n: 13, options: [26, 22, 30], answer: 26,
      misconception_tags: { '22': 'off-by-4-under', '30': 'off-by-4-over' } },
    { round: 7,  stage: 2, type: 'A', n: 14, options: [24, 28, 26], answer: 28,
      misconception_tags: { '24': 'off-by-4-under', '26': 'off-by-2-under' } },
    { round: 8,  stage: 2, type: 'A', n: 16, options: [32, 30, 34], answer: 32,
      misconception_tags: { '30': 'off-by-2-under', '34': 'off-by-2-over' } },
    { round: 9,  stage: 2, type: 'A', n: 17, options: [30, 34, 36], answer: 34,
      misconception_tags: { '30': 'off-by-4-under', '36': 'off-by-2-over' } },
    { round: 10, stage: 2, type: 'A', n: 15, options: [30, 25, 35], answer: 30,
      misconception_tags: { '25': 'additive-reasoning-N+10', '35': 'off-by-5-over' } },

    // ===== Stage 3: Harder doubles (Rounds 11-15) =====
    { round: 11, stage: 3, type: 'A', n: 18, options: [36, 34, 38], answer: 36,
      misconception_tags: { '34': 'off-by-2-under', '38': 'off-by-2-over' } },
    { round: 12, stage: 3, type: 'A', n: 19, options: [38, 36, 40], answer: 38,
      misconception_tags: { '36': 'off-by-2-under', '40': 'off-by-2-over' } },
    { round: 13, stage: 3, type: 'A', n: 22, options: [42, 44, 46], answer: 44,
      misconception_tags: { '42': 'off-by-2-under', '46': 'off-by-2-over' } },
    { round: 14, stage: 3, type: 'A', n: 23, options: [46, 44, 48], answer: 46,
      misconception_tags: { '44': 'off-by-2-under', '48': 'off-by-2-over' } },
    { round: 15, stage: 3, type: 'A', n: 25, options: [50, 45, 55], answer: 50,
      misconception_tags: { '45': 'off-by-5-under', '55': 'off-by-5-over' } }
  ]
};
```

**Misconception taxonomy:**
- `off-by-2-under` — student subtracted 2 from the correct answer (drop-one).
- `off-by-2-over`  — student added 2 to the correct answer (over-count).
- `off-by-4-under` / `off-by-4-over` — off by the next even step.
- `off-by-5-under` / `off-by-5-over` — near misses on round-5 doubles (N=15, 25).
- `additive-reasoning-N+10` — student added 10 instead of doubling (classic misconception).
- `magnitude-error` — off by a factor of 10 (reserved; not used in fallback but valid for generated content).

## Defaults Applied
- **Class/Grade:** defaulted to Class 2-4 (concept silent; 2× table is a Class 2-3 curriculum skill).
- **Bloom Level:** defaulted to L1/L2 (automatic recall of doubling facts — concept-building, not application).
- **Archetype:** **Lives Challenge (#3)** with speed-game feedback timing (correct = instant advance, matching source concept "zero delay"). Rationale: 3 lives + MCQ + 15 rounds + speed-based star grading matches Lives Challenge most closely; Speed Blitz was rejected because there is no global countdown timer.
- **Rounds:** 15 (spec-driven: 3 levels × 5 rounds).
- **Lives:** 3 dark hearts (spec-driven; explicit call-out in source concept).
- **Timer:** None globally. Per-answer response-time captured for star calculation.
- **Star thresholds:** defaulted to average-correct-response-time buckets `<2s / <3.5s / else` per source concept "<2s for 3 stars"; the 2-star band (<3.5s) was added to avoid the known UX issue from the One Digit Doubles audit (UI-ODD-006) where 2-star thresholds must appear in-game.
- **Feedback style:** FeedbackManager with speed-game correct-side override (fire-and-forget, no 1500ms dwell) — justified because source concept explicitly requires "zero delay / instant transition". Wrong side follows the standard awaited 1500ms dwell per PART-017 `5e0-FEEDBACK-MIN-DURATION`.
- **Preview screen:** enabled (default `previewScreen: true` per PART-039).

## Warnings
- **WARNING — Correct-answer SFX is fire-and-forget (deviates from standard 1500ms dwell).** Source concept explicitly requires "zero delay; game immediately transitions". Correct SFX plays in the background as the next round renders. Wrong SFX still uses the standard awaited `Promise.all([..., 1500ms])` dwell per PART-017. Validator rule `5e0-FEEDBACK-MIN-DURATION` applies only to wrong-side and end-game SFX in this game; the correct-side deviation is documented here and must match the planner's feedback table. If the validator flags correct-side fire-and-forget as a violation, the plan overrides — speed game takes precedence.
- **WARNING — Dark hearts are distinct from standard red hearts.** The CDN ProgressBarComponent renders its own heart strip. The source concept calls for DARK/BLACK hearts specifically. If the CDN does not expose a dark-heart skin, the game uses the default CDN hearts but adds a game-local `filter: brightness(0.2) saturate(0)` / `color: #111` CSS override targeting the CDN-rendered heart class. The game does NOT render a second custom hearts row (forbidden per validator `5e0-LIVES-DUP-FORBIDDEN`).
- **WARNING — "Next Round" bottom-right button is decorative in v1.** Source concept shows a yellow "Next Round" button, but also says the game auto-advances on correct tap. Resolution: render a dim / disabled yellow pill labelled "Next Round" at the bottom-right as a visual anchor, but make it a no-op in v1 (auto-advance is the sole progression mechanism). Can be upgraded in v2 to a manual-advance button if pedagogy review requests it.
- **WARNING — Bloom L1-L2 with 3 lives is an unusual combination.** Typical L1-L2 games default to No-Penalty Explorer (lives = 0). Here the source concept explicitly demands 3 hearts + speed grading, so lives are kept at 3. Star grading is still based on speed (not raw accuracy), so the penalty is motivational, not punitive.
- **WARNING — Instruction copy is verbatim from source concept** ("Tap on the doubles as fast as possible! / You get 3 stars for doubling each number within 2 seconds!"). If Education slot wishes to also surface the 2-star threshold (<3.5s) to resolve the UX issue from One Digit Doubles audit UI-ODD-006, the preview text should be lengthened in a follow-up — not silently changed.
