# Game Design: Spot the Pairs

## Identity
- **Game ID:** spot-the-pairs
- **Title:** Spot the Pairs — Friendly Pairs Sum Challenge
- **Class/Grade:** Class 1-3. Justification: Number bonds to 10 are a canonical Class 1 outcome (NCERT Math-Magic Ch. "Add Our Points" / "How Many"); number bonds to 20 are a Class 2 ("Give and Take") outcome; teen + single-digit fluency consolidates in Class 3 ("Give and Take: Add and Subtract"). The 4-level alternation across 10 / 20 spans the Class 1–3 progression.
- **Math Domain:** Number Operations — Addition / Number Bonds
- **Topic:** Friendly pairs (number bonds) that sum to 10 or 20. Fluency-focused — recognising decompositions, not introducing addition.
- **Bloom Level:** L2 Understand (recognise equivalent decompositions of a target). Lives are present at the creator's explicit request despite the L2 default of "no lives" — see Warnings.
- **Archetype:** Lives Challenge (#3) — adapted for multi-correct-per-round (multiple correct pills cleared before round advances). Closest standard profile to the creator's description. Notes on deviation listed under "Warnings".

## One-Line Concept
Students tap every pill on the 8-pill board whose two numbers add up to the level's target sum (10 or 20), racing to find each match within 2 seconds for a fast-tap star bonus while preserving 3 shared lives across 4 levels.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Number-bond recall (sums to 10) | Instantly recognise pairs that make 10 (1+9, 2+8, 3+7, 4+6, 5+5) | A (tap-all-correct-pairs) |
| Number-bond recall (sums to 20) | Recognise teen + single-digit pairs that make 20 (12+8, 13+7, 14+6, 15+5, 11+9) | A |
| Visual scanning under distraction | Find every correct pill among 8 pills, ignoring near-miss distractors | A |
| Inhibition / error monitoring | Resist tapping pairs that are off-by-one or off-by-two from the target | A |
| Speed of recall (fluency) | Tap each correct pill within 2 seconds of the level becoming interactive | A |

## Core Mechanic

### Type A: "Tap all friendly pairs"
1. **What the student sees:** A staggered 3+3+2 grid of 8 pill-shaped buttons. Each pill displays an addition expression (`6 + 4`, `13 + 7`). Above the board: a header banner reading **"Make Sum 10"** or **"Make Sum 20"**. Top of `#gameContent`: a fast-tap counter `X / 10` showing fast-tap stars earned so far. ProgressBar at the top owned by ScreenLayout (4-level rounds, 3 hearts).
2. **What the student does:** Taps any pill. Each tap is one independent attempt — no selection state, no submit button. Student keeps tapping until every correct pill has been tapped.
3. **What counts as correct:** The two addends on the tapped pill sum to the level's target (`a + b === targetSum`).
4. **What feedback plays:**
   - **Correct tap:** Pill flashes purple (accent-locked, disabled for further taps), correct SFX with celebration sticker — **fire-and-forget** (multi-step archetype CASE 5). Pill fades and is removed from the board after 250ms. If the tap landed within 2.0s of the level becoming interactive, fast-tap counter increments by 1 (capped at 10). No dynamic TTS mid-round.
   - **Wrong tap (distractor):** Pill flashes red and shakes (~600ms). Wrong SFX with sad sticker — **fire-and-forget** (CASE 7 multi-step variant). Lives decrement by 1; heart icon updates immediately. Pill remains on the board and re-enables after the shake so the kid can keep trying.
   - **Level cleared (all correct pills found):** Level-complete SFX plays awaited (`all_correct`) with celebration sticker + subtitle "Level cleared!" (CASE 6). ProgressBar bumps FIRST per Cross-Cutting Rule 0. The yellow Next Round CTA in the bottom-right enables. On tap, the next level transition begins.
   - **Last life lost (lives → 0):** Wrong-answer SFX plays first awaited (~1000ms). Then Game Over screen renders FIRST with 0★, "Try Again" CTA, then game-over audio (CASE 8 + 12).

## Rounds & Progression

The creator's description names "4 levels". In Alfred terms each level is one round. The four rounds alternate target sums and increase correct-pair density.

### Stage 1: Warm-up — Make Sum 10 (Round / Level 1)
- Round type: A.
- Target sum: **10**.
- Board: 8 pills.
- Correct pills: **3** (e.g., `6+4`, `2+8`, `5+5`).
- Distractors: **5** (sum-off-by-one and sum-off-by-two pills, all single-digit + single-digit).
- Pair value range: each addend ∈ [0, 10].
- Goal: anchor the friend-of-10 bonds with low cognitive load.

### Stage 2: Target switch — Make Sum 20 (Round / Level 2)
- Round type: A.
- Target sum: **20**.
- Board: 8 pills.
- Correct pills: **3** (e.g., `13+7`, `12+8`, `14+6`).
- Distractors: **5** (sum-off-by-one teen + single-digit pills).
- Pair value range: each addend ∈ [1, 19].
- Goal: bridge to the new benchmark with teen + single-digit arithmetic.

### Stage 3: Denser distractors — Make Sum 10 (Round / Level 3)
- Round type: A.
- Target sum: **10**.
- Board: 8 pills.
- Correct pills: **4** (e.g., `7+3`, `8+2`, `4+6`, `9+1`).
- Distractors: **4** (off-by-one and off-by-two; tighter distractor field).
- Pair value range: each addend ∈ [0, 10].
- Goal: more targets in a tighter distractor field.

### Stage 4: Fluency push — Make Sum 20 (Round / Level 4)
- Round type: A.
- Target sum: **20**.
- Board: 8 pills.
- Correct pills: **4** (e.g., `15+5`, `11+9`, `13+7`, `12+8`).
- Distractors: **4** (off-by-one teen-and-single-digit pills).
- Pair value range: each addend ∈ [1, 19].
- Goal: four targets, 2-digit + 1-digit teen arithmetic.

### Difficulty Summary

| Dimension | Stage 1 (R1) | Stage 2 (R2) | Stage 3 (R3) | Stage 4 (R4) |
|-----------|--------------|--------------|--------------|--------------|
| Target sum | 10 | 20 | 10 | 20 |
| Board size (pills) | 8 | 8 | 8 | 8 |
| Correct pills | 3 | 3 | 4 | 4 |
| Distractor count | 5 | 5 | 4 | 4 |
| Addend range | 0–10 | 1–19 | 0–10 | 1–19 |
| Arithmetic complexity | single-digit + single-digit | teen + single-digit | single-digit + single-digit | teen + single-digit |
| Distractor closeness | off-by-1 and off-by-2 | off-by-1 and off-by-2 | off-by-1 (denser) | off-by-1 (denser) |

## Game Parameters
- **Rounds:** 4 (1 per stage, alternating 10 / 20).
- **Timer:** Per-pill count-up soft timer for the fast-tap bonus only — NOT a hard deadline. A `TimerComponent` (PART-006) runs in count-up mode from the moment each level becomes interactive (after the round-intro audio finishes). It pauses on visibility-hidden (CASE 14), on level-complete audio, and on victory / game-over screens. Used solely to compute `tapTime - levelInteractiveStart` per correct tap.
- **Lives:** 3 hearts, **shared across all 4 levels** (creator-explicit). Lives do NOT reset per level. Each wrong tap costs 1 life. Hit 0 lives → Game Over (no retry of the current level; partial progress on that level still counts in `recordAttempt` analytics).
- **retryPreservesInput:** N/A (multi-round game).
- **autoShowStar:** `true` (default). The default `show_star` postMessage fires at the canonical multi-round end-of-game spot inside Stars Collected `onMounted`.
- **Star rating (3-star Victory tier driven by 10-star fast-tap counter):**
  - **3★:** 8 ≤ fastTapStars ≤ 10 AND lives > 0 at end.
  - **2★:** 5 ≤ fastTapStars ≤ 7 AND lives > 0 at end.
  - **1★:** 1 ≤ fastTapStars ≤ 4 AND lives > 0 at end.
  - **0★:** fastTapStars == 0 AND lives > 0 at end (still reaches Victory if all 4 levels were cleared without losing all lives, but with 0 fast-taps).
  - Game Over (lives → 0 before Level 4 cleared): no Victory screen, no star tier — Game Over surface owns the end-of-game.
- **Star denominator (`y`):** default `3` (omitted from spec body).
- **Input:** Single-tap on a pill. Touch targets ≥ 44×44 CSS px with ≥ 8 px spacing (mobile/SKILL.md rules 9–10). The 3+3+2 staggered layout is implemented with a CSS grid (3-column for the first two rows, 2 centred pills on row 3) — never with flex `gap` (mobile/SKILL.md rule 23).
- **Feedback:** FeedbackManager (PART-017) multi-step defaults — fire-and-forget mid-round SFX + sticker; awaited level-complete, victory, and game-over audio.

## Stars contract (read before defining scoring)

The platform ActionBar `x/y` shows overall star tier earned at end-of-game. The fast-tap **10-star counter** described by the creator is a **game-internal** display rendered inside `#gameContent` (top of the play area, e.g. a `<div id="fastTapCounter">⚡ X / 10</div>`). It is NOT the ActionBar header. The ActionBar receives a single `show_star` postMessage at end-of-game with `count` = the earned 3-star tier (0–3); the 10-star counter is a separate visual that lives in the game body.

The level label inside the round-intro transition is fixed at `'Q' + N` (i.e. `Q1` … `Q4`) per the platform contract; the creator's "Level 1 — Make Sum 10" is rendered as the in-game header banner (`<div class="level-banner">Make Sum 10</div>`) **inside `#gameContent`**, not in the platform header.

## Scoring
- **Points:** +1 per correct pill tapped (max **14** across all 4 levels: 3 + 3 + 4 + 4). Internal-only — drives `recordAttempt` analytics; does not directly drive stars.
- **10-star fast-tap counter:** +1 per correct pill tapped within 2.0s of the level becoming interactive. Capped at 10 (even though 14 fast taps are arithmetically possible). Displayed in `#gameContent` as `X / 10`.
- **Final 3-star Victory rating (driven by the 10-star counter):**
  - 3★ = 8–10 fast-tap stars (and lives > 0)
  - 2★ = 5–7 fast-tap stars (and lives > 0)
  - 1★ = 1–4 fast-tap stars (and lives > 0)
  - 0★ = 0 fast-tap stars but lives > 0 (Victory screen still shown)
  - Game Over = lives = 0 before Level 4 cleared (no Victory screen)
- **Lives:** Start at 3, shared across all 4 levels. Each wrong pill tap decrements lives by 1. At lives = 0, game ends immediately → `game_over` screen (CASE 12). Partial progress on the current level still counts in telemetry.
- **Partial credit:** Per-tap. A correct pill tapped before lives → 0 still counts toward the points total and (if within 2s) toward the fast-tap counter. The level itself does not advance unless every correct pill is tapped.
- **Level completion:** When the final correct pill of the level is tapped, ProgressBar bumps to `N/4` FIRST, then awaited level-complete SFX + "Level cleared!" subtitle plays; the Next Round CTA (yellow, bottom-right) becomes enabled. Tapping the CTA advances to the next-level transition (or to Victory after Level 4).

## Flow

**Shape:** Multi-round (default).
**Changes from default:**
- Add conditional branch from Wrong Tap → `game_over` when `lives === 0` (standard Lives-Challenge add-on).
- Each level-complete enables a yellow **Next Round CTA** in the bottom-right (rendered via FloatingButton in `'next'` mode, per PART-050 — flow-driven, MANDATORY because the creator described an explicit Next CTA). The CTA appears AFTER the awaited level-complete audio resolves; it does not auto-advance.
- Round transitions are NOT auto-advancing — each round-complete waits for the student to tap the Next Round CTA before transitioning. This deviates from the canonical "auto after sound" arrow in the default flow but is explicitly creator-described.

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Board N    │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ banner +   │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │ pills      │
│   audio  │        │    VO    │        │ 🔊 "Round N" │         │ + per-tap  │
└──────────┘        └──────────┘        └──────────────┘         │   timer    │
                                                                 └─────┬──────┘
                                                                       │ player taps pill
                                                                       ▼
                                                            ┌─────────────────────┐
                                                            │ Tap evaluated       │
                                                            │ ✓ correct: purple,  │
                                                            │   fade out, fast?   │
                                                            │   fastTapStars++    │
                                                            │ ✗ wrong: shake red, │
                                                            │   life--            │
                                                            └──────┬──────────────┘
                                                                   │
                                                  ┌────────────────┼─────────────────┐
                                                  │                │                 │
                                            all correct        lives == 0       more correct
                                            pills found             │           pills remain
                                                  │                 ▼                 │
                                                  ▼          ┌────────────────────┐   │
                              ┌──────────────────────┐       │ Game Over (0★)     │   │
                              │ Level-complete SFX + │       │ 🔊 sound_game_over │   │
                              │  "Level cleared!"    │       │ (after wrong SFX)  │◀──┘ stay on Board
                              │  (awaited) → Next-   │       └─────────┬──────────┘   N if lives > 0
                              │  Round CTA enabled   │                 │ "Try Again"
                              │  (yellow, bottom-R)  │                 ▼
                              └──────────┬───────────┘          ┌──────────────────┐
                                         │ tap CTA              │ "Ready to        │
                                         ▼                      │  improve your    │
                              ┌──────────────────────┐          │  score?"         │
                              │ N < 4 → next Round   │          │ (trans., tap)    │
                              │ N == 4 → Victory     │          │ 🔊 motivation VO │
                              └──────────┬───────────┘          │ [I'm ready]      │
                                         │                      └────────┬─────────┘
                                         ▼                               │ tap
                                                                         ▼
                                                                restart from Round 1
                                                                (skips Preview + Welcome)

        N == 4 AND all correct pills found
                 │
                 ▼
         ┌───────────────┐
         │ Victory (0–3★)│
         │ 🔊 game_vic → │
         │  vo_victory_N │
         └──┬────────┬───┘
  "Play     │        │ "Claim Stars"
   Again"   ▼        ▼
 (0–2★)   Ready-to  "Yay, stars
          improve    collected!"
          (tap) →    (auto) →
          restart    Correct Answers
                     carousel → exit
```

## Feedback

| Event | Behavior |
|-------|----------|
| Board renders (level start) | Soft `new_cards` SFX fire-and-forget (CASE 17). Per-tap timer starts when round-intro audio resolves and the board becomes interactive. No input block at level start. |
| Correct pill tap (not the last correct pill of the level) | Pill flashes purple + scale-pulse (200ms), disabled. `correct_sound_effect` SFX with celebration sticker `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-95.gif` — fire-and-forget (CASE 5). No dynamic TTS, no subtitle. Pill fades out (250ms) then is removed from the DOM. If `tapTime - levelInteractiveStart ≤ 2000ms`, fastTapStars increments (capped at 10) and the on-screen `X / 10` counter updates. `recordAttempt({ is_correct: true, misconception_tag: null })` fires synchronously. |
| Wrong pill tap (lives > 0 after decrement) | Pill flashes red + shake (600ms CSS keyframe). `incorrect_sound_effect` SFX with sad sticker `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-99.gif` — fire-and-forget (CASE 7 multi-step variant). No dynamic TTS, no subtitle. Heart icon updates immediately. Pill stays on board, re-enables after the 600ms shake. `recordAttempt({ is_correct: false, misconception_tag: <from round data> })` fires synchronously. |
| Correct pill tap (final correct pill of the level) | Pill locks purple. **ProgressBar bumps FIRST** (`progressBar.update(currentRound, Math.max(0, lives))`). Then awaited `all_correct` SFX with subtitle `"Level cleared!"` and round-transition celebration sticker (CASE 6). Board interactive elements (remaining distractors) become non-interactive while audio plays. After audio resolves, the FloatingButton is set to `'next'` mode (yellow Next Round CTA bottom-right). Game waits for student tap. |
| Next Round CTA tapped (level N < 4) | All audio stopped (`stopAll()` + `stream.stopAll()`). `currentRound++`. Round-N+1 transition shows with `'Round N+1'` title and round-intro SFX → "Round N+1" TTS sequence (auto-advancing variant per CASE 2 Variant A). Then Board N+1 renders. |
| Next Round CTA tapped (level 4 cleared) | All audio stopped. ProgressBar already at `4/4` from the level-complete bump. Victory transition path begins per default flow (Victory screen with computed star tier, then Stars Collected onMounted star animation, then AnswerComponent carousel). |
| Lose last life (lives → 0) | Wrong-answer SFX plays first awaited (~1000ms minimum) so the student sees/hears the incorrect feedback before game-over (CASE 8). Then Game Over screen renders FIRST with 0★, "You ran out of lives!" subtitle, levels completed so far, fast-tap stars earned, and "Try Again" CTA. `game_complete` postMessage sent BEFORE game-over audio. Then `game_over_sound_effect` SFX + sad sticker + game-over VO awaited; CTA interrupts at any time (CASE 12). |
| Complete all 4 levels (Victory) | Timer pauses. Final 3-star tier computed from `fastTapStars` (8–10 = 3★, 5–7 = 2★, 1–4 = 1★, 0 = 0★) AND `lives > 0`. Victory screen renders FIRST with stars, "Pairs found: 14/14", fast-tap stars (`X / 10`), lives remaining, and CTAs ("Play Again" if 0–2★; "Claim Stars" always per default flow). `game_complete` postMessage sent BEFORE audio. Then `victory_sound_effect` SFX + tier-specific celebration sticker + tier-specific victory VO awaited; CTA interrupts at any time (CASE 11). |
| Visibility hidden (tab switch / screen lock) | Per-tap timer pauses. All audio pauses (static + streams). VisibilityTracker shows its built-in pause popup (`autoShowPopup: true` per CASE 14). Do NOT roll a custom overlay. |
| Visibility restored | Timer resumes. Audio resumes. VisibilityTracker dismisses its own popup automatically (CASE 15). |
| Restart ("Try Again" after Game Over, "Play Again" after < 3★ Victory) | All audio stopped. Lives reset to 3. `currentRound` reset to 1. `fastTapStars` reset to 0. `points` reset to 0. `levelInteractiveStart` reset on next level. Round-set cycles to next set (A → B → C → A …). Preview screen NOT re-shown (PART-039 rule). Routes via "Ready to improve your score?" transition per default flow. |
| Claim Stars (after Victory) | "Yay, stars collected!" transition plays (`persist: true`, `buttons: []`). Inside `onMounted`: `await sound.play('sound_stars_collected')`, fire `show_star` postMessage with `count = starTier`, then setTimeout reveal Next button. After student taps Next: AnswerComponent carousel renders showing each level's correct pills highlighted. Final Next tap exits. |

## Content Structure (fallbackContent)

Each round object shape:

```js
{
  set: 'A' | 'B' | 'C',
  id: '<set>_r<n>_<topic>',
  round: <1..4>,
  stage: <1|2|3|4>,
  type: "A",
  targetSum: <10 | 20>,
  levelTitle: "Make Sum 10" | "Make Sum 20",  // shown in level banner
  pills: [
    { a: <Number>, b: <Number>, id: "p1" },
    ...                                       // exactly 8 pills
  ],
  correctPills: ["p1", "p3", ...],            // ids of pills where a + b === targetSum
  misconception_tags: {                       // key = pill id for every non-correct pill
    "<pill_id>": "<misconception-name>"
  },
  answer: {
    correctPills: ["p1", "p3", ...],          // mirrored for AnswerComponent rendering
    targetSum: <10 | 20>,
    expressions: ["6 + 4", "2 + 8", "5 + 5"]  // human-readable list of correct expressions
  }
}
```

`previewScreen` is `true` (default — not declared in spec body).
`answerComponent` is `true` (default — silent; not listed in Defaults Applied).

**Per-round `answer` field:** the AnswerComponent's `renderAnswerForRound(round, container)` paints the level's solved board — the correct pills highlighted in their final purple-locked state with the round's `targetSum` banner shown above. The `expressions` array is for accessibility / readability when a student reviews the carousel.

Full 12-round content set (4 rounds × 3 sets):

```js
const fallbackContent = {
  previewInstruction:
    '<p><strong>Spot the Pairs!</strong> Tap every pill where the two numbers add up to the target shown at the top.</p><p>Tap each pair in <strong>under 2 seconds</strong> to earn a fast-tap star — collect up to 10!</p><p>You have <strong>3 lives</strong> across all 4 levels. Don\'t tap a wrong pill!</p>',
  previewAudioText:
    "Spot the pairs! Tap every pill where the two numbers add up to the target shown at the top. Tap each pair in under two seconds to earn a fast-tap star — collect up to ten! You have three lives across all four levels. Don't tap a wrong pill.",
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  totalRounds: 4,
  totalLives: 3,
  rounds: [
    // ────────────────────────────────────────────────────────────────────
    // Set A — 4 rounds (warm-up content, Class 1–3 friendly examples)
    // ────────────────────────────────────────────────────────────────────

    // ── Set A — Level 1 — Make Sum 10 (warm-up) ──
    {
      set: 'A',
      id: 'A_r1_make10_warmup',
      round: 1, stage: 1, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 6, b: 4, id: "p1" },    // 10 ✓
        { a: 5, b: 4, id: "p2" },    // 9   (off-by-one-under)
        { a: 2, b: 8, id: "p3" },    // 10 ✓
        { a: 7, b: 2, id: "p4" },    // 9   (off-by-one-under)
        { a: 5, b: 5, id: "p5" },    // 10 ✓
        { a: 4, b: 7, id: "p6" },    // 11  (off-by-one-over)
        { a: 6, b: 5, id: "p7" },    // 11  (off-by-one-over)
        { a: 8, b: 4, id: "p8" }     // 12  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 10,
        expressions: ["6 + 4", "2 + 8", "5 + 5"]
      }
    },

    // ── Set A — Level 2 — Make Sum 20 (target switch) ──
    {
      set: 'A',
      id: 'A_r2_make20_switch',
      round: 2, stage: 2, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 13, b: 7, id: "p1" },   // 20 ✓
        { a: 12, b: 7, id: "p2" },   // 19  (off-by-one-under)
        { a: 12, b: 8, id: "p3" },   // 20 ✓
        { a: 15, b: 4, id: "p4" },   // 19  (off-by-one-under)
        { a: 14, b: 6, id: "p5" },   // 20 ✓
        { a: 11, b: 8, id: "p6" },   // 19  (off-by-one-under)
        { a: 13, b: 8, id: "p7" },   // 21  (off-by-one-over)
        { a: 16, b: 6, id: "p8" }    // 22  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-under",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 20,
        expressions: ["13 + 7", "12 + 8", "14 + 6"]
      }
    },

    // ── Set A — Level 3 — Make Sum 10 (denser distractors) ──
    {
      set: 'A',
      id: 'A_r3_make10_dense',
      round: 3, stage: 3, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 7, b: 3, id: "p1" },    // 10 ✓
        { a: 6, b: 3, id: "p2" },    // 9   (off-by-one-under)
        { a: 8, b: 2, id: "p3" },    // 10 ✓
        { a: 5, b: 6, id: "p4" },    // 11  (off-by-one-over)
        { a: 4, b: 6, id: "p5" },    // 10 ✓
        { a: 9, b: 2, id: "p6" },    // 11  (off-by-one-over)
        { a: 9, b: 1, id: "p7" },    // 10 ✓
        { a: 4, b: 4, id: "p8" }     // 8   (off-by-two-under)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-two-under"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 10,
        expressions: ["7 + 3", "8 + 2", "4 + 6", "9 + 1"]
      }
    },

    // ── Set A — Level 4 — Make Sum 20 (fluency push) ──
    {
      set: 'A',
      id: 'A_r4_make20_fluency',
      round: 4, stage: 4, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 15, b: 5, id: "p1" },   // 20 ✓
        { a: 14, b: 5, id: "p2" },   // 19  (off-by-one-under)
        { a: 11, b: 9, id: "p3" },   // 20 ✓
        { a: 10, b: 9, id: "p4" },   // 19  (off-by-one-under)
        { a: 13, b: 7, id: "p5" },   // 20 ✓
        { a: 13, b: 8, id: "p6" },   // 21  (off-by-one-over)
        { a: 12, b: 8, id: "p7" },   // 20 ✓
        { a: 12, b: 9, id: "p8" }    // 21  (off-by-one-over)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-one-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 20,
        expressions: ["15 + 5", "11 + 9", "13 + 7", "12 + 8"]
      }
    },

    // ────────────────────────────────────────────────────────────────────
    // Set B — 4 rounds (parallel difficulty to Set A, different surface)
    // ────────────────────────────────────────────────────────────────────

    // ── Set B — Level 1 — Make Sum 10 ──
    {
      set: 'B',
      id: 'B_r1_make10_warmup',
      round: 1, stage: 1, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 1, b: 9, id: "p1" },    // 10 ✓
        { a: 2, b: 7, id: "p2" },    // 9   (off-by-one-under)
        { a: 3, b: 7, id: "p3" },    // 10 ✓
        { a: 6, b: 3, id: "p4" },    // 9   (off-by-one-under)
        { a: 8, b: 2, id: "p5" },    // 10 ✓
        { a: 4, b: 5, id: "p6" },    // 9   (off-by-one-under)
        { a: 3, b: 8, id: "p7" },    // 11  (off-by-one-over)
        { a: 9, b: 3, id: "p8" }     // 12  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-under",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 10,
        expressions: ["1 + 9", "3 + 7", "8 + 2"]
      }
    },

    // ── Set B — Level 2 — Make Sum 20 ──
    {
      set: 'B',
      id: 'B_r2_make20_switch',
      round: 2, stage: 2, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 11, b: 9, id: "p1" },   // 20 ✓
        { a: 10, b: 9, id: "p2" },   // 19  (off-by-one-under)
        { a: 16, b: 4, id: "p3" },   // 20 ✓
        { a: 13, b: 6, id: "p4" },   // 19  (off-by-one-under)
        { a: 17, b: 3, id: "p5" },   // 20 ✓
        { a: 14, b: 7, id: "p6" },   // 21  (off-by-one-over)
        { a: 12, b: 9, id: "p7" },   // 21  (off-by-one-over)
        { a: 13, b: 5, id: "p8" }    // 18  (off-by-two-under)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-under"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 20,
        expressions: ["11 + 9", "16 + 4", "17 + 3"]
      }
    },

    // ── Set B — Level 3 — Make Sum 10 (denser) ──
    {
      set: 'B',
      id: 'B_r3_make10_dense',
      round: 3, stage: 3, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 0, b: 10, id: "p1" },   // 10 ✓
        { a: 5, b: 4, id: "p2" },    // 9   (off-by-one-under)
        { a: 6, b: 4, id: "p3" },    // 10 ✓
        { a: 6, b: 5, id: "p4" },    // 11  (off-by-one-over)
        { a: 2, b: 8, id: "p5" },    // 10 ✓
        { a: 7, b: 4, id: "p6" },    // 11  (off-by-one-over)
        { a: 5, b: 5, id: "p7" },    // 10 ✓
        { a: 3, b: 5, id: "p8" }     // 8   (off-by-two-under)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-two-under"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 10,
        expressions: ["0 + 10", "6 + 4", "2 + 8", "5 + 5"]
      }
    },

    // ── Set B — Level 4 — Make Sum 20 (fluency push) ──
    {
      set: 'B',
      id: 'B_r4_make20_fluency',
      round: 4, stage: 4, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 16, b: 4, id: "p1" },   // 20 ✓
        { a: 15, b: 4, id: "p2" },   // 19  (off-by-one-under)
        { a: 13, b: 7, id: "p3" },   // 20 ✓
        { a: 12, b: 7, id: "p4" },   // 19  (off-by-one-under)
        { a: 12, b: 8, id: "p5" },   // 20 ✓
        { a: 14, b: 7, id: "p6" },   // 21  (off-by-one-over)
        { a: 11, b: 9, id: "p7" },   // 20 ✓
        { a: 16, b: 5, id: "p8" }    // 21  (off-by-one-over)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-one-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 20,
        expressions: ["16 + 4", "13 + 7", "12 + 8", "11 + 9"]
      }
    },

    // ────────────────────────────────────────────────────────────────────
    // Set C — 4 rounds (parallel difficulty to Sets A and B)
    // ────────────────────────────────────────────────────────────────────

    // ── Set C — Level 1 — Make Sum 10 ──
    {
      set: 'C',
      id: 'C_r1_make10_warmup',
      round: 1, stage: 1, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 4, b: 6, id: "p1" },    // 10 ✓
        { a: 3, b: 6, id: "p2" },    // 9   (off-by-one-under)
        { a: 7, b: 3, id: "p3" },    // 10 ✓
        { a: 5, b: 6, id: "p4" },    // 11  (off-by-one-over)
        { a: 9, b: 1, id: "p5" },    // 10 ✓
        { a: 8, b: 1, id: "p6" },    // 9   (off-by-one-under)
        { a: 2, b: 9, id: "p7" },    // 11  (off-by-one-over)
        { a: 6, b: 6, id: "p8" }     // 12  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-under",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 10,
        expressions: ["4 + 6", "7 + 3", "9 + 1"]
      }
    },

    // ── Set C — Level 2 — Make Sum 20 ──
    {
      set: 'C',
      id: 'C_r2_make20_switch',
      round: 2, stage: 2, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 14, b: 6, id: "p1" },   // 20 ✓
        { a: 13, b: 6, id: "p2" },   // 19  (off-by-one-under)
        { a: 18, b: 2, id: "p3" },   // 20 ✓
        { a: 17, b: 2, id: "p4" },   // 19  (off-by-one-under)
        { a: 15, b: 5, id: "p5" },   // 20 ✓
        { a: 16, b: 5, id: "p6" },   // 21  (off-by-one-over)
        { a: 13, b: 8, id: "p7" },   // 21  (off-by-one-over)
        { a: 14, b: 8, id: "p8" }    // 22  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5"],
        targetSum: 20,
        expressions: ["14 + 6", "18 + 2", "15 + 5"]
      }
    },

    // ── Set C — Level 3 — Make Sum 10 (denser) ──
    {
      set: 'C',
      id: 'C_r3_make10_dense',
      round: 3, stage: 3, type: "A",
      targetSum: 10,
      levelTitle: "Make Sum 10",
      pills: [
        { a: 8, b: 2, id: "p1" },    // 10 ✓
        { a: 7, b: 2, id: "p2" },    // 9   (off-by-one-under)
        { a: 3, b: 7, id: "p3" },    // 10 ✓
        { a: 4, b: 7, id: "p4" },    // 11  (off-by-one-over)
        { a: 6, b: 4, id: "p5" },    // 10 ✓
        { a: 5, b: 4, id: "p6" },    // 9   (off-by-one-under)
        { a: 1, b: 9, id: "p7" },    // 10 ✓
        { a: 4, b: 8, id: "p8" }     // 12  (off-by-two-over)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-under",
        "p8": "sum-off-by-two-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 10,
        expressions: ["8 + 2", "3 + 7", "6 + 4", "1 + 9"]
      }
    },

    // ── Set C — Level 4 — Make Sum 20 (fluency push) ──
    {
      set: 'C',
      id: 'C_r4_make20_fluency',
      round: 4, stage: 4, type: "A",
      targetSum: 20,
      levelTitle: "Make Sum 20",
      pills: [
        { a: 17, b: 3, id: "p1" },   // 20 ✓
        { a: 16, b: 3, id: "p2" },   // 19  (off-by-one-under)
        { a: 14, b: 6, id: "p3" },   // 20 ✓
        { a: 13, b: 6, id: "p4" },   // 19  (off-by-one-under)
        { a: 11, b: 9, id: "p5" },   // 20 ✓
        { a: 12, b: 9, id: "p6" },   // 21  (off-by-one-over)
        { a: 18, b: 2, id: "p7" },   // 20 ✓
        { a: 17, b: 4, id: "p8" }    // 21  (off-by-one-over)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-one-over"
      },
      answer: {
        correctPills: ["p1", "p3", "p5", "p7"],
        targetSum: 20,
        expressions: ["17 + 3", "14 + 6", "11 + 9", "18 + 2"]
      }
    }
  ]
};
```

### Misconception tag definitions

| Tag | Name | Student belief |
|-----|------|----------------|
| `sum-off-by-one-under` | Sum is one less than target | Student computed `a+b` correctly but tapped a pill whose sum is `target - 1` (common attentional slip when scanning fast). |
| `sum-off-by-one-over` | Sum is one more than target | Student computed `a+b` correctly but tapped a pill whose sum is `target + 1`. |
| `sum-off-by-two-over` | Sum is two more than target | Larger miscalibration of the target boundary (e.g., reading "10" as "12"). |
| `sum-off-by-two-under` | Sum is two less than target | As above, in the opposite direction. |

Note: `correctPills` and `misconception_tags` partition the board — every pill on the board is either in `correctPills` OR has an entry in `misconception_tags`. The game engine asserts this invariant at round load.

**Multi-pill board misconception model (deviation from MCQ-style F3 "unique tag per distractor"):** because every level shows 4-5 distractor pills on a single board (vs. 3 in classic MCQ), a single round may carry multiple distractors that share the same misconception tag (e.g., Set A Level 2 has three `sum-off-by-one-under` pills: `12+7=19`, `15+4=19`, `11+8=19`). Tags here label a *category of error* (off-by-one-under, off-by-one-over, off-by-two-under, off-by-two-over) and each distractor is a distinct numerical *instance* of that category. This is intentional: the friendly-pairs misconception space has only 4 well-known categories at this Bloom level, and a 5-distractor board cannot allocate one unique category per pill without inventing implausible misconceptions. Telemetry granularity is preserved — every distractor still carries a tag, and `recordAttempt` still emits the per-tap misconception so analytics can count per-category miss rates.

## Defaults Applied

- **Archetype:** defaulted to Lives Challenge (#3) adapted for multi-correct-per-round (creator described "tap all correct pills"; closest standard archetype, with adaptation noted in Warnings).
- **Feedback style:** defaulted to FeedbackManager multi-step pattern (SFX + sticker, fire-and-forget; awaited level-complete) per feedback/SKILL.md — creator did not specify implementation pattern, only described "purple flash + sticker" / "red flash + sticker".
- **Difficulty stages:** defaulted to 4 stages = 4 rounds (one per level, per creator).
- **Bloom level:** defaulted to L2 Understand (creator did not specify; recognition of equivalent decompositions is canonical L2).
- **Class/Grade:** defaulted to Class 1-3 (creator wrote "Class 1–3").
- **Math domain:** Number Operations / Number Bonds.
- **Curriculum reference:** NCERT Math-Magic Class 1 ("Add Our Points"), Class 2 ("Give and Take"), Class 3 ("Give and Take: Add and Subtract") per creator's pedagogy note.
- **Per-tap speed threshold (2.0s):** taken verbatim from the creator's description.
- **Set B and Set C content:** defaulted to parallel-difficulty mirrors of Set A (different addends, same number of correct pairs, same off-by-one / off-by-two distractor patterns) per the GEN-ROUNDSETS-MIN-3 contract.
- **Set A example pairs:** taken verbatim from the creator's examples (Level 1: `6+4`, `2+8`, `5+5`; Level 2: `13+7`, `12+8`, `14+6`; Level 3: `7+3`, `8+2`, `4+6`, `9+1`; Level 4: `15+5`, `11+9`, `13+7`, `12+8`).
- **Preview audio:** TTS-at-deploy (`previewAudio: null`, `previewAudioText` provided for the pipeline). Standard.
- **Mobile layout:** inherits mobile/SKILL.md defaults (44px targets, portrait-only, 100dvh, overflow-x hidden, `overscroll-behavior: none`, `touch-action: manipulation` on pills). The 3+3+2 staggered layout uses CSS grid (3-column for rows 1–2, 2 centred pills for row 3), implemented with grid `gap` (allowed) — never flex `gap` (banned by mobile rule 23).
- **Scaffolding:** none per-tap (multi-step archetype; per-tap reveals would kill flow). Implicit scaffolding = correct-pair density rises (3 → 3 → 4 → 4) while distractor count drops (5 → 5 → 4 → 4).
- **Distractor strategy:** off-by-one (under and over) primary; off-by-two as a corner case in Levels 1, 2, 3. All distractors carry a misconception tag.
- **ProgressBar:** rounds-based (`N/4`); heart indicator = lives. Bumps on the final-correct-pill of each level FIRST per Cross-Cutting Rule 0.
- **Input:** single-tap (no double-tap, no drag).
- **Orientation:** portrait-only.
- **`previewScreen`:** `true` (default — not declared in spec body).

## Suggestions (require explicit creator approval)

- **Hindi vocabulary bridge for "sum" / "pair" (Class 1–3 fits the SUGGESTED window):** pedagogy/SKILL.md `[SUGGESTED]` rule recommends Hindi math-vocabulary bridges for Class 4–6, with a soft extension into Class 1–3 for early learners on Hindi-medium streams. Suggested addition: render the level banner as `"Make Sum 10 (योग 10)"` on first appearance, then drop the Hindi gloss in subsequent levels. Why: builds bilingual math vocabulary without crowding the banner. Applies if creator approves.
- **Per-pair speed-threshold relaxation if first-attempt pass rate < 70%:** pedagogy/SKILL.md `[SUGGESTED]` rule (success-rate target 70–85%). If telemetry shows < 70% first-attempt clear rate at Class 1, consider relaxing the fast-tap threshold from 2.0s to 2.5s for Levels 1 and 2 (warm-up + target-switch). Why: a tighter threshold can frustrate younger learners on the unfamiliar Make Sum 20 pivot. Applies if creator approves a post-launch tuning pass.
- **Show worked-example feedback panel after wrong taps in Stage 1:** pedagogy/SKILL.md `[SUGGESTED]` corrective-feedback rule. After 1 wrong tap on Level 1 only, briefly flash the correct expression nearest to the wrong tap (e.g., wrong-tap on `5+4` shows a fading chip "5 + 5 = 10" for 1.5s). Why: bridges from "wrong" to "what would have been right" without taking control from the kid. Applies if creator approves.

## Warnings

- **WARNING — Bloom L2 + 3 lives:** pedagogy/SKILL.md `[SUGGESTED]` rule (#2) discourages lives at L2 unless explicitly justified. The creator explicitly described "3 lives" and a "Game Over" flow, so lives are preserved per the faithful-translation boundary. Monitor first-attempt clear rate; if it drops below 70% at Class 1, either raise lives to 5 or convert Level 1 wrong taps into no-penalty nudges (only Levels 2–4 cost lives).
- **WARNING — Lives Challenge archetype + multi-correct-per-round:** the standard Lives Challenge profile assumes one correct answer per round. This spec keeps lives from that archetype but adopts the multi-target-per-round structure from the creator's description. Downstream implementers MUST NOT assume `currentRound++` after each correct tap — `currentRound++` fires only after all correct pills in the level are tapped AND the Next Round CTA is tapped. Track `correctPillsFoundThisLevel` and `totalCorrectPillsThisLevel` separately from `currentRound`.
- **WARNING — Multi-step feedback pattern with lives:** per feedback CASE 7 multi-step variant, mid-round wrong taps use fire-and-forget SFX and do NOT block input. This is the correct rule for this archetype but conflicts with the typical Lives-Challenge "wrong → await SFX → reset/retry" pattern. Implementers must follow the multi-step rule. `recordAttempt` still fires synchronously on every tap.
- **WARNING — Per-tap speed timer is bonus-only, NOT a deadline:** the 2.0s window is a bonus threshold for the fast-tap counter, NOT a hard timeout. Implementers MUST NOT decrement lives, fail the level, or otherwise penalise a tap that takes longer than 2.0s. The TimerComponent is used solely to compare `tapTime - levelInteractiveStart` per correct tap.
- **WARNING — `Bloom L2 + lives + speed-bonus pressure` compounds:** three pressure sources (lives, fast-tap window, denser Stage 3/4 boards) compound. Watch frustration signals (high game-over rate in Level 1, low star attainment, abandon mid-Level-2). If < 30% of students reach Victory, see pedagogy SUGGESTED #2 above.
- **WARNING — 14 fast taps possible but 10-star counter capped:** the maximum 14 correct pills (3+3+4+4) exceed the 10-star ceiling, so a perfect-fluency student earns 10/10 fast-tap stars with 4 fast taps to spare. This is creator-explicit ("Capped at 10 even though 14 fast taps are possible") and enables the 3★ tier (8–10) to be reachable without ALL taps being fast. Implementers MUST cap the counter at 10 in code (`Math.min(10, fastTapStars + 1)`).
- **WARNING — `Q1`/`Q2`/`Q3`/`Q4` platform label vs creator's "Level 1 — Make Sum 10":** the platform ActionBar question label is fixed at `'Q' + N` per the Stars Contract. The creator's "Level 1 — Make Sum 10" is rendered as the in-game header banner inside `#gameContent`, not in the ActionBar. Both labels coexist (ActionBar shows `Q1`; banner shows `Make Sum 10`).
- **WARNING — Single-tap rapid interaction (accessibility):** students with motor-coordination differences may mis-tap. Pills re-enable after a wrong-tap shake so a misread is not permanently lost (creator-explicit: "Pill stays on the board so the kid can keep trying"), but the 44×44 px minimum (mobile/SKILL.md rule 9) with 8 px spacing (rule 10) MUST be strictly enforced. Do NOT tighten spacing to fit the staggered grid into a smaller viewport.

## Diff from creator description

Items below appear in the spec but are NOT directly traceable to (1) the creator description, (2) a `[MANDATORY]` pedagogy/feedback/mobile/data-contract rule, or (3) a Creator Decision Default. Each is justified.

- **Bloom Level: L2 Understand** — added because spec-creation default (Creator Decision Default) when creator is silent on Bloom level. The creator specified target skill (number-bond fluency) but not the Bloom level explicitly.
- **Archetype: Lives Challenge (#3) adapted for multi-correct-per-round** — added because spec template requires an Archetype field. Creator described mechanics but did not pick an archetype; closest standard match per game-archetypes/SKILL.md decision tree.
- **Math Domain: Number Operations — Addition / Number Bonds** — added because spec template requires this field; derived from creator's "addition expressions" and "number bonds to 10/20".
- **Set B and Set C round content (8 round objects total)** — added because GEN-ROUNDSETS-MIN-3 validator MANDATORY rule requires `rounds.length === totalRounds × 3`. Creator only described Set A. Set B and C parallel Set A's difficulty with disjoint addend choices.
- **`p7: 6+5 = 11` and similar concrete distractor numerics in Set A** — added to fill the 5-distractor / 4-distractor slots per level. Creator gave 3-4 correct examples per level; the distractor pills are added to satisfy the 8-pill board constraint. Each distractor is misconception-tagged per data-contract MANDATORY rule.
- **Misconception tag set: `sum-off-by-one-under`, `sum-off-by-one-over`, `sum-off-by-two-under`, `sum-off-by-two-over`** — added because data-contract MANDATORY rule requires every wrong-answer path to carry a named misconception. Tags drawn from the friendly-pairs taxonomy (the closest shipped game in the same domain).
- **Per-tap timer implementation note ("count-up TimerComponent that pauses on visibility")** — added because the 2.0s fast-tap window requires a single-source-of-truth timer per PART-006 MANDATORY rule (`TIMER-MANDATORY-WHEN-DURATION-VISIBLE`). Creator described the bonus mechanic but not the implementation.
- **ProgressBar bumps FIRST in level-complete handler** — added because feedback/SKILL.md Cross-Cutting Rule 0 is MANDATORY (validator: `GEN-PROGRESSBAR-BUMP-ORDER`).
- **`recordAttempt` calls per tap with misconception tag** — added because data-contract MANDATORY rule requires synchronous attempt capture with misconception data on every interaction.
- **VisibilityTracker pause overlay (no custom overlay)** — added because feedback CASE 14/15 MANDATORY rule forbids custom pause overlays.
- **Round-set cycling A → B → C → A on retry / play-again** — added because GEN-ROUNDSETS-MIN-3 MANDATORY rule + spec-creation §5e requires three sets with parallel difficulty so each retry maintains the same learning load.
- **`answerComponent: true` (default, silent)** — applied silently per spec-creation §3 Critical Rule (PART-051 default; never auto-default to false; not listed in Defaults Applied per the rule).
- **Curriculum reference (NCERT Class 1 / 2 / 3 chapters)** — partially creator-derived (creator named "NCERT Class 2 'Give and Take' and Class 3 'Give and Take: Add and Subtract'") and partially added (Class 1 "Add Our Points" was inferred because creator named Class 1–3 as the target band).
- **Decision: Levels 1, 2 use 5 distractors and Levels 3, 4 use 4 distractors** — added because creator specified "8 pills" + "3 correct" (Levels 1–2) and "8 pills" + "4 correct" (Levels 3–4); 8 - correctCount = distractor count.
- **Distractor numerics in Levels 1 and 2 (`5+4`, `7+2`, `6+5`, `8+4`, etc.)** — added; creator gave only correct examples. Numerics chosen to be near-target (off-by-one or off-by-two) to produce the misconception traps.
- **Decision: render the staggered 3+3+2 layout via CSS grid (3-column rows 1-2, 2 centred row 3) NOT flex `gap`** — added because mobile/SKILL.md MANDATORY rule 23 forbids flex `gap`. Creator specified the visual ("staggered 3+3+2") but not the implementation.
- **FloatingButton in `'next'` mode for the bottom-right Next Round CTA + sub-rule MANDATORY end-of-game `'next'` wiring** — added because PART-050 MANDATORY rules apply whenever the spec describes any explicit Next CTA. Creator described the yellow Next Round CTA verbatim.
- **Multi-pill misconception-category model (multiple distractors may share one tag within a level)** — added because the creator's "8 pills per board, 3-4 correct" mechanic forces 4-5 distractors per round, and the friendly-pairs misconception taxonomy has only 4 categorical errors (off-by-one-under/over, off-by-two-under/over). Reusing the same tag across distractors that are different *numerical instances* of the same misconception category is intentional and is documented inline next to the misconception-tag definitions table. This deviates from spec-review F3's MCQ-style "unique tag per distractor" reading; the deviation is necessary because the multi-pill board mechanic does not map onto MCQ-distractor semantics.
