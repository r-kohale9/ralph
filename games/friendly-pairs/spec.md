# Game Design: Friendly Pairs

## Identity
- **Game ID:** friendly-pairs
- **Title:** Friendly Pairs
- **Class/Grade:** Class 1-2 (ages 6-8). Justification: "Number bonds / friendly pairs to 10" is a canonical Class 1 (Ganit Prakash / NCERT Math-Magic Ch. "Numbers 1-10", "How Many", "Add Our Points") and Class 2 (number-bonds to 20) outcome. Sum-to-10 is the launchpad skill.
- **Math Domain:** Number Operations — Addition / Number Bonds
- **Topic:** Number bonds ("friendly pairs") that sum to a target (10, 12, 15, 18, 20). Fluency-focused, not concept-introduction.
- **Bloom Level:** L2 Understand (recognise equivalent decompositions of a number). Stages 2–3 lean toward L3 Apply (use the ×10-bond fluency on unfamiliar targets and under mild pressure), but the game as a whole is dominated by L2 recognition.
- **Archetype:** Lives Challenge (#3). Multi-step within a round (clear all correct pairs) + lives + per-pair speed-bonus scoring. Closest standard profile to the creator's description. Notes on deviation listed under "Warnings".

## One-Line Concept
Students tap every pill on the board whose two numbers add up to the target sum, clearing round after round of number-bond puzzles to build addition fluency and visual search speed.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Number-bond recall (sums to 10/12/15/18/20) | Instantly recognise pairs that make a target sum | A (tap-all-correct-pairs) |
| Mental addition of single- and early-two-digit pairs | Compute a+b in under 2s for a, b ≤ 15 | A |
| Visual scanning under distraction | Find all correct pairs among 8–12 pill buttons, ignoring near-miss pairs | A |
| Inhibition / error monitoring | Resist tapping pairs that are "close" to the target (off-by-one, swapped, partial-sum) | A |

## Core Mechanic

### Type A: "Tap all friendly pairs"
1. **What the student sees:** A staggered grid of pill-shaped buttons. Each pill shows two numbers separated by a middle dot (`6 · 4`, `7 · 2`, …). Above the grid: the target banner **"Make Sum N"**. Top-right: 3 heart icons (lives). Top-left: progress bar (rounds). Below the board: a `✓ N/M` counter showing *correct pairs found / correct pairs in this round*.
2. **What the student does:** Taps any pill. Each tap is one independent attempt (no second-tap required; no selection state). Student keeps tapping pills until all correct pairs are found.
3. **What counts as correct:** The two numbers on the tapped pill sum to the target (`a + b === targetSum`).
4. **What feedback plays:**
   - **Correct tap:** Pill turns purple (accent-locked, disabled for further taps), soft correct SFX with small celebration sticker — **fire-and-forget** (multi-step archetype: feedback/SKILL.md CASE 5). No dynamic TTS. `✓ N/M` counter increments. Input is NOT blocked — student immediately scans for the next correct pair.
   - **Wrong tap:** Pill flashes red and shakes (~600ms). A brief red ✗ badge flashes at the bottom of the play area (~600ms). Wrong SFX with sad sticker — **fire-and-forget** (CASE 7 multi-step variant). No dynamic TTS. Lives decrement by 1; heart icon updates immediately. Pill re-enables after the shake (so the student is not forced into that same wrong answer again but is not permanently locked out of the tile either — same number pair may legitimately recur between rounds and the pill remains visible).
   - **All correct pairs in round found:** Round-complete SFX with celebration sticker + subtitle "Good job!" — **awaited** (CASE 6). Board clears via fade + pop animation. Progress bar bumps first (per feedback/SKILL.md Cross-Cutting rule 0). Advance to next round transition.
   - **Last life lost (lives → 0):** Wrong SFX + life-lost animation as in Case 7, awaited long enough for the flash to land (~1000ms). Game Over screen renders first, then game-over audio (CASE 8 + 12).

## Rounds & Progression

### Stage 1: Sum-to-10, friendly board (Rounds 1-3)
- Round type: A.
- Target sum: **10** (all three rounds).
- Board: 8 pills.
- Pair values drawn from a+b where a,b ∈ [0, 10] (so each number on the pill is a single digit; sum-to-10 only).
- Exactly **3** correct pairs per round; remaining **5** pills are misconception-tagged distractors.
- Goal: anchor the friend-of-10 bonds (1+9, 2+8, 3+7, 4+6, 5+5) with low cognitive load.

### Stage 2: Mixed sums in the 10s (Rounds 4-6)
- Round type: A.
- Target sum rotates: Round 4 = 12, Round 5 = 15, Round 6 = 18.
- Board: 10 pills per round.
- Pair values drawn from a+b where a,b ∈ [0, 15].
- Exactly **4** correct pairs per round; remaining **6** are misconception-tagged distractors.
- Goal: generalise the "make a target" skill beyond 10; introduces cross-10 addition (6+7 = 13, 9+6 = 15, 8+9 = 17, etc.) for the near-miss distractors.

### Stage 3: Sum-to-20, crowded board (Rounds 7-9)
- Round type: A.
- Target sum: Round 7 = 15, Round 8 = 18, Round 9 = 20.
- Board: 12 pills per round.
- Pair values drawn from a+b where a,b ∈ [0, 20].
- Exactly **4** correct pairs per round; remaining **8** are misconception-tagged distractors, including adjacent-sum traps (target±1, target±2) and swap-value illusions.
- Goal: sustain accuracy under maximum visual and inhibitory load.

### Difficulty Summary

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Rounds | 1-3 | 4-6 | 7-9 |
| Target sum(s) | 10 only | 12, 15, 18 (rotates) | 15, 18, 20 (rotates) |
| Board size (pills) | 8 | 10 | 12 |
| Correct pairs / round | 3 | 4 | 4 |
| Distractor count / round | 5 | 6 | 8 |
| Pair-value range (each number on pill) | 0–10 | 0–15 | 0–20 |
| Distractor closeness | off-by-1 and off-by-2 | off-by-1, off-by-2, and swap-pair | off-by-1/2, adjacent targets, swap-pair |

## Game Parameters
- **Rounds:** 9 (3 per stage). Default.
- **Timer:** Per-pair count-up soft timer, used for per-pair bonus (see Scoring). No hard per-round or global timeout. A `TimerComponent` runs in count-up mode from the moment each round's board is first rendered. It pauses on visibility-hidden (CASE 14) and on victory / game-over screens.
- **Lives:** 3 hearts. Lives do NOT reset between rounds (carry across all 9 rounds, matching the creator's "3 lives total for the session" description).
- **Star rating (per-round per-pair speed + lives):**
  - The creator's intro text says: *"Spot each pair under 2 seconds to win 3 stars!"* — operationalised as: each correct pair tapped within 2.0s of the previous correct-pair tap (or round-start for the first pair) counts as a **fast pair**.
  - Final star tier is computed at Victory:
    - **3★:** ≥ 80% of the 33 correct pairs across rounds 1-9 were fast pairs AND lives > 0 at end.
    - **2★:** ≥ 50% fast pairs AND lives > 0 at end.
    - **1★:** finished all 9 rounds with lives > 0 but < 50% fast pairs.
    - **0★:** Game Over via lives → 0. (Shown on Game Over screen; no star celebration.)
- **Input:** Single-tap on a pill. Touch targets ≥ 44×44 CSS px with ≥ 8 px spacing (mobile/SKILL.md rules 9–10). Staggered grid is visual only — layout is a responsive CSS grid of 2 columns × N rows, offset every other row using `margin-left` (not flex `gap`, per mobile/SKILL.md rule 23).
- **Feedback:** FeedbackManager (PART-017) multi-step defaults — SFX + sticker, fire-and-forget mid-round; awaited round-complete, victory, and game-over audio.

## Scoring
- **Points:** Internal-only. Each correct pair = +1 point; each fast correct pair (≤ 2s since previous correct tap or round start) = +2 points. Stars are driven by the fast-pair ratio (above), not the raw point total, so score is purely for `recordAttempt` analytics.
- **Star thresholds (exact numbers, total 33 correct pairs across 9 rounds = 3+3+3 in S1 + 4+4+4 in S2 + 4+4+4 in S3):**
  - 3★ = at least 27 of 33 pairs fast AND lives > 0 at end (≥ 80%).
  - 2★ = at least 17 of 33 pairs fast AND lives > 0 at end (≥ 50%).
  - 1★ = completed all 9 rounds with lives > 0 but < 17 fast pairs.
  - 0★ = Game Over (lives = 0 before Round 9 complete).
- **Lives:** Start at 3. Each wrong pill tap decrements lives by 1. At lives = 0, game ends immediately → `game_over` screen (CASE 12).
- **Partial credit:** None per-round. A round must be fully cleared (all correct pairs found) to advance. The round does not allow forfeit / skip.
- **Round completion:** When the final correct pair of the round is tapped, progress bar bumps to N/9 FIRST, then the awaited round-complete SFX + "Good job!" subtitle plays; the board clears and the game either transitions to the next round intro (rounds 1-8) or to the Victory screen (round 9).

## Flow

**Shape:** Multi-round (default).
**Changes from default:**
- Add conditional branch from Wrong Answer → `game_over` when `lives === 0` (standard Lives-Challenge add-on; mirrors `matching-doubles` spec).
- No per-round CTA; round transitions auto-advance after the round-complete audio finishes (feedback CASE 2 Variant A).

```
┌──────────┐  tap   ┌──────────┐  auto   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├────────▶│ Round N      ├────────▶│ Board N    │
│          │        │ (trans.) │         │ (trans.,     │ (after  │ render +   │
│ 🔊 prev  │        │ 🔊 welc. │         │  no buttons) │  sound) │ per-pair   │
│   audio  │        │    VO    │         │ 🔊 "Round N" │         │ timer start│
└──────────┘        └──────────┘         └──────────────┘         └─────┬──────┘
                                                ▲                       │ player taps pill
                                                │                       ▼
                                                │            ┌─────────────────────┐
                                                │            │ Tap evaluated       │
                                                │            │ ✓ correct → lock    │
                                                │            │   purple, counter++ │
                                                │            │   fast? bonus++     │
                                                │            │ ✗ wrong → shake,    │
                                                │            │   red ✗, life--    │
                                                │            └──────┬──────────────┘
                                                │                   │
                                                │       ┌───────────┼────────────────────────┐
                                                │       │           │                        │
                                                │  all correct   lives == 0              more correct
                                                │  pairs found     │                        pairs remain
                                                │       │           ▼                           │
                                                │       ▼     ┌────────────────────┐            │
                                                │ ┌──────────┐│ Game Over (0★)     │            │
                                                │ │ Round    ││ 🔊 sound_game_over │            │
                                                │ │ complete ││ (after wrong SFX)  │◀── wrong ──┘ (if lives > 0, stay on Board N)
                                                │ │ SFX +    │└────────┬───────────┘
                                                │ │ subtitle │         │ "Try Again"
                                                │ │ (awaited)│         ▼
                                                │ └────┬─────┘  ┌──────────────────┐
                                                │      │        │ "Ready to        │
                                                │      │        │  improve your    │
                                                │      │        │  score?"         │
                                                │   N < 9       │ (trans., tap)    │
                                                └──────┘        │ 🔊 motivation VO │
                                                                │ [I'm ready]      │
                                                                └────────┬─────────┘
                                                                         │ tap
                                                                         ▼
                                                                restart from Round 1
                                                                (skips Preview + Welcome)

        N == 9 AND all pairs found
                 │
                 ▼
         ┌───────────────┐
         │ Victory (1–3★)│
         │ 🔊 game_vic → │
         │  vo_victory_N │
         └──┬────────┬───┘
  "Play     │        │ "Claim Stars"
   Again"   ▼        ▼
 (1–2 ★)  Ready-to  "Yay, stars
          improve    collected!"
          (tap) →    (auto) →
          restart    exit
```

## Feedback

| Event | Behavior |
|-------|----------|
| Board renders (round start) | Soft "new cards" SFX fire-and-forget (CASE 17). Per-pair timer starts. No input block. |
| Correct pill tap (not the last correct pair of the round) | Pill turns purple + scale-pulse (200ms), disabled for further taps. Correct-match SFX with small celebration sticker — fire-and-forget (CASE 5). No dynamic TTS, no subtitle. `✓ N/M` counter updates immediately. Per-pair timer resets for the next correct tap. `recordAttempt({ is_correct: true, misconception_tag: null })` fires synchronously. |
| Wrong pill tap (lives > 0 after decrement) | Pill flashes red + shake (600ms CSS keyframe). Red ✗ badge flashes at bottom of play area (600ms; auto-hide). Wrong-match SFX with sad sticker — fire-and-forget (CASE 7 multi-step variant). No dynamic TTS, no subtitle. Heart icon updates immediately. Pill re-enables after shake. Per-pair timer is NOT reset (so a single wrong tap doesn't grant a free speed bonus on the next correct tap). `recordAttempt({ is_correct: false, misconception_tag: <from round data> })` fires synchronously. |
| Correct pill tap (final correct pair of the round) | Pill locks purple, `✓ N/M` counter hits `N/N`. **Progress bar bumps FIRST** (`progressBar.update(currentRound, Math.max(0, lives))`), then awaited round-complete SFX + "Good job!" subtitle + celebration sticker (CASE 6). Board clears (fade-out 400ms). Input blocked during audio. After audio: auto-advance to next-round intro (rounds 1-8) or to Victory (round 9). |
| Lose last life (lives → 0) | Wrong-answer SFX plays first for ~1000ms (priority rule: the student must see/hear the incorrect feedback before game-over). Then Game Over screen renders FIRST with 0★, "You ran out of lives!" subtitle, fast-pair count so far, rounds completed so far, and "Try Again" CTA. `game_complete` postMessage sent BEFORE game-over audio. Then game-over SFX + sad sticker + game-over VO ("Good try — let's practice those friendly pairs again!") awaited; CTA interrupts at any time (CASE 12 + feedback priority table). |
| Complete all 9 rounds (Victory) | Timer pauses. Final star tier computed from fast-pair ratio + lives remaining. Victory screen renders FIRST with stars, "Pairs found: 33/33", fast-pair count, lives remaining, and CTAs ("Play Again" if 1–2★; "Claim Stars" always). `game_complete` postMessage sent BEFORE audio. Then victory SFX + celebration sticker + tier-specific victory VO ("Super-fast friend-finder!" / "Nice work!" / "You finished — let's get faster next time!") awaited; CTA interrupts at any time (CASE 11). |
| Visibility hidden (tab switch / screen lock) | Per-pair timer pauses. All audio pauses (static + streams). VisibilityTracker shows its built-in pause popup (autoShowPopup: true per feedback CASE 14). Do NOT roll a custom overlay. |
| Visibility restored | Timer resumes. Audio resumes. VisibilityTracker dismisses its own popup (CASE 15). |
| Restart ("Try Again" after game-over, "Play Again" after < 3★ victory) | All audio stopped (`stopAll()` + stream stop). Lives reset to 3. Timer reset to 0. Round index reset to 1. `currentPairsFound`, `fastPairs`, `correctPairsInRound` all reset. Fresh fallbackContent loaded. Preview screen is NOT re-shown (PART-039 rule). Routes via "Ready to improve your score?" transition per default flow. |
| Claim Stars (after Victory) | "Yay, stars collected!" transition plays (auto, no CTA). Then exits. |

## Content Structure (fallbackContent)

Each round object shape:

```js
{
  round: <1..9>,
  stage: <1|2|3>,
  type: "A",
  targetSum: <Number>,                    // the "Make Sum N" banner value
  pills: [                                // board contents, order = render order
    { a: <Number>, b: <Number>, id: "p1" },
    ...
  ],
  correctPills: ["p2", "p5", ...],        // ids of pills where a+b === targetSum
  misconception_tags: {                   // key = pill id for every non-correct pill
    "<pill_id>": "<misconception-name>"
  }
}
```

Full 9-round content set:

```js
const fallbackContent = {
  previewInstruction:
    '<p><strong>Find the friendly pairs!</strong> Tap every pill where the two numbers add up to the target sum at the top. Spot each pair in under 2 seconds to win 3 stars!</p><p>You have <strong>3 lives</strong> — don\'t tap a wrong pair.</p>',
  previewAudioText:
    "Find the friendly pairs! Tap every pill where the two numbers add up to the target sum shown at the top. Spot each pair in under two seconds to win three stars. You have three lives — don't tap a wrong pair.",
  previewAudio: null,            // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ─── Stage 1: Sum-to-10, 8 pills, 3 correct ───
    {
      round: 1, stage: 1, type: "A",
      targetSum: 10,
      pills: [
        { a: 6, b: 4, id: "p1" },    // 10 ✓
        { a: 5, b: 4, id: "p2" },    // 9  (sum-1)
        { a: 2, b: 8, id: "p3" },    // 10 ✓
        { a: 7, b: 2, id: "p4" },    // 9  (sum-1)
        { a: 3, b: 7, id: "p5" },    // 10 ✓
        { a: 4, b: 7, id: "p6" },    // 11 (sum+1)
        { a: 6, b: 5, id: "p7" },    // 11 (sum+1)
        { a: 8, b: 4, id: "p8" }     // 12 (sum+2)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      }
    },
    {
      round: 2, stage: 1, type: "A",
      targetSum: 10,
      pills: [
        { a: 1, b: 9, id: "p1" },    // 10 ✓
        { a: 2, b: 7, id: "p2" },    // 9  (sum-1)
        { a: 5, b: 5, id: "p3" },    // 10 ✓
        { a: 6, b: 3, id: "p4" },    // 9  (sum-1)
        { a: 8, b: 2, id: "p5" },    // 10 ✓
        { a: 4, b: 5, id: "p6" },    // 9  (sum-1)
        { a: 3, b: 8, id: "p7" },    // 11 (sum+1)
        { a: 9, b: 3, id: "p8" }     // 12 (sum+2)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-under",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      }
    },
    {
      round: 3, stage: 1, type: "A",
      targetSum: 10,
      pills: [
        { a: 4, b: 6, id: "p1" },    // 10 ✓
        { a: 3, b: 6, id: "p2" },    // 9  (sum-1)
        { a: 7, b: 3, id: "p3" },    // 10 ✓
        { a: 5, b: 6, id: "p4" },    // 11 (sum+1)
        { a: 9, b: 1, id: "p5" },    // 10 ✓
        { a: 8, b: 1, id: "p6" },    // 9  (sum-1)
        { a: 2, b: 9, id: "p7" },    // 11 (sum+1)
        { a: 6, b: 6, id: "p8" }     // 12 (sum+2)
      ],
      correctPills: ["p1", "p3", "p5"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-under",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-two-over"
      }
    },

    // ─── Stage 2: Mixed sums 12/15/18, 10 pills, 4 correct ───
    {
      round: 4, stage: 2, type: "A",
      targetSum: 12,
      pills: [
        { a: 8, b: 4, id: "p1" },    // 12 ✓
        { a: 5, b: 6, id: "p2" },    // 11 (sum-1)
        { a: 7, b: 5, id: "p3" },    // 12 ✓
        { a: 9, b: 2, id: "p4" },    // 11 (sum-1)
        { a: 3, b: 9, id: "p5" },    // 12 ✓
        { a: 6, b: 7, id: "p6" },    // 13 (sum+1)
        { a: 6, b: 6, id: "p7" },    // 12 ✓
        { a: 4, b: 7, id: "p8" },    // 11 (sum-1)
        { a: 8, b: 5, id: "p9" },    // 13 (sum+1)
        { a: 2, b: 1, id: "p10" }    // 3  (partial-sum; student reads "21" or uses only one digit)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-one-under",
        "p9": "sum-off-by-one-over",
        "p10": "concat-not-add"
      }
    },
    {
      round: 5, stage: 2, type: "A",
      targetSum: 15,
      pills: [
        { a: 9, b: 6, id: "p1" },    // 15 ✓
        { a: 8, b: 6, id: "p2" },    // 14 (sum-1)
        { a: 7, b: 8, id: "p3" },    // 15 ✓
        { a: 9, b: 7, id: "p4" },    // 16 (sum+1)
        { a: 10, b: 5, id: "p5" },   // 15 ✓
        { a: 9, b: 5, id: "p6" },    // 14 (sum-1)
        { a: 12, b: 3, id: "p7" },   // 15 ✓
        { a: 8, b: 8, id: "p8" },    // 16 (sum+1)
        { a: 6, b: 7, id: "p9" },    // 13 (sum-2)
        { a: 4, b: 10, id: "p10" }   // 14 (sum-1; looks very close)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-over",
        "p6": "sum-off-by-one-under",
        "p8": "sum-off-by-one-over",
        "p9": "sum-off-by-two-under",
        "p10": "sum-off-by-one-under"
      }
    },
    {
      round: 6, stage: 2, type: "A",
      targetSum: 18,
      pills: [
        { a: 9, b: 9, id: "p1" },    // 18 ✓
        { a: 10, b: 7, id: "p2" },   // 17 (sum-1)
        { a: 12, b: 6, id: "p3" },   // 18 ✓
        { a: 8, b: 9, id: "p4" },    // 17 (sum-1)
        { a: 11, b: 7, id: "p5" },   // 18 ✓
        { a: 13, b: 6, id: "p6" },   // 19 (sum+1)
        { a: 10, b: 8, id: "p7" },   // 18 ✓
        { a: 11, b: 8, id: "p8" },   // 19 (sum+1)
        { a: 9, b: 8, id: "p9" },    // 17 (sum-1)
        { a: 7, b: 1, id: "p10" }    // 8  (big gap; tests swap-pair temptation since 7+1 looks like 8·1 ≈ 81)
      ],
      correctPills: ["p1", "p3", "p5", "p7"],
      misconception_tags: {
        "p2": "sum-off-by-one-under",
        "p4": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p8": "sum-off-by-one-over",
        "p9": "sum-off-by-one-under",
        "p10": "concat-not-add"
      }
    },

    // ─── Stage 3: Sums 15/18/20, 12 pills, 4 correct, 8 distractors ───
    {
      round: 7, stage: 3, type: "A",
      targetSum: 15,
      pills: [
        { a: 9, b: 6, id: "p1" },    // 15 ✓
        { a: 10, b: 5, id: "p2" },   // 15 ✓
        { a: 8, b: 7, id: "p3" },    // 15 ✓
        { a: 11, b: 4, id: "p4" },   // 15 ✓
        { a: 6, b: 8, id: "p5" },    // 14 (sum-1)
        { a: 7, b: 9, id: "p6" },    // 16 (sum+1)
        { a: 5, b: 9, id: "p7" },    // 14 (sum-1)
        { a: 12, b: 4, id: "p8" },   // 16 (sum+1)
        { a: 6, b: 7, id: "p9" },    // 13 (sum-2; tests under-counting)
        { a: 13, b: 3, id: "p10" },  // 16 (sum+1)
        { a: 9, b: 5, id: "p11" },   // 14 (sum-1)
        { a: 5, b: 1, id: "p12" }    // 6  (concat trap: "5·1" ≈ 51)
      ],
      correctPills: ["p1", "p2", "p3", "p4"],
      misconception_tags: {
        "p5": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-under",
        "p8": "sum-off-by-one-over",
        "p9": "sum-off-by-two-under",
        "p10": "sum-off-by-one-over",
        "p11": "sum-off-by-one-under",
        "p12": "concat-not-add"
      }
    },
    {
      round: 8, stage: 3, type: "A",
      targetSum: 18,
      pills: [
        { a: 9, b: 9, id: "p1" },    // 18 ✓
        { a: 10, b: 8, id: "p2" },   // 18 ✓
        { a: 11, b: 7, id: "p3" },   // 18 ✓
        { a: 12, b: 6, id: "p4" },   // 18 ✓
        { a: 9, b: 8, id: "p5" },    // 17 (sum-1)
        { a: 10, b: 9, id: "p6" },   // 19 (sum+1)
        { a: 11, b: 8, id: "p7" },   // 19 (sum+1)
        { a: 13, b: 4, id: "p8" },   // 17 (sum-1)
        { a: 7, b: 10, id: "p9" },   // 17 (sum-1; swap-pair illusion with p2)
        { a: 8, b: 11, id: "p10" },  // 19 (sum+1; swap-pair illusion with p3)
        { a: 15, b: 2, id: "p11" },  // 17 (sum-1; large-imbalance trap)
        { a: 1, b: 8, id: "p12" }    // 9  (half-sum trap; resembles 18 if digits concatenated)
      ],
      correctPills: ["p1", "p2", "p3", "p4"],
      misconception_tags: {
        "p5": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over-swap",
        "p8": "sum-off-by-one-under",
        "p9": "sum-off-by-one-under-swap",
        "p10": "sum-off-by-one-over-swap",
        "p11": "sum-off-by-one-under",
        "p12": "concat-not-add"
      }
    },
    {
      round: 9, stage: 3, type: "A",
      targetSum: 20,
      pills: [
        { a: 12, b: 8, id: "p1" },   // 20 ✓
        { a: 11, b: 9, id: "p2" },   // 20 ✓
        { a: 13, b: 7, id: "p3" },   // 20 ✓
        { a: 14, b: 6, id: "p4" },   // 20 ✓
        { a: 10, b: 9, id: "p5" },   // 19 (sum-1)
        { a: 11, b: 10, id: "p6" },  // 21 (sum+1)
        { a: 12, b: 9, id: "p7" },   // 21 (sum+1)
        { a: 13, b: 6, id: "p8" },   // 19 (sum-1)
        { a: 17, b: 4, id: "p9" },   // 21 (sum+1; swap-pair illusion with p3: 4 near 13·7)
        { a: 15, b: 4, id: "p10" },  // 19 (sum-1)
        { a: 16, b: 5, id: "p11" },  // 21 (sum+1)
        { a: 2, b: 0, id: "p12" }    // 2  (concat trap: "2·0" resembles 20)
      ],
      correctPills: ["p1", "p2", "p3", "p4"],
      misconception_tags: {
        "p5": "sum-off-by-one-under",
        "p6": "sum-off-by-one-over",
        "p7": "sum-off-by-one-over",
        "p8": "sum-off-by-one-under",
        "p9": "sum-off-by-one-over-swap",
        "p10": "sum-off-by-one-under",
        "p11": "sum-off-by-one-over",
        "p12": "concat-not-add"
      }
    }
  ]
};
```

**Misconception tag definitions** (map to `skills/pedagogy/reference/misconceptions.md` patterns; domain-specific):

| Tag | Name | Student belief |
|-----|------|----------------|
| `sum-off-by-one-under` | Sum is one less than target | Student computed a+b correctly but expected target-1 (common attentional slip when scanning fast). |
| `sum-off-by-one-over` | Sum is one more than target | Student computed a+b correctly but misread target as target+1. |
| `sum-off-by-two-over` | Sum is two more than target | Similar to above with larger miscalibration. |
| `sum-off-by-two-under` | Sum is two less than target | As above. |
| `sum-off-by-one-over-swap` | Swap-pair illusion off-by-one | Student sees the digits of a correct pair in a different order and assumes correctness (positional confusion + arithmetic slip). |
| `sum-off-by-one-under-swap` | Swap-pair illusion off-by-one (under) | As above. |
| `concat-not-add` | Treats "a · b" as the two-digit number "ab" instead of addition | Maps to MISC-NUM-01-style misread of the operator; tapped because "51" or "81" visually resembles the target. |

Note: `correctPills` and `misconception_tags` are complementary — every pill on the board is either in `correctPills` OR has an entry in `misconception_tags`. The game engine can assert this invariant at round load.

## Defaults Applied
- **Archetype:** defaulted to Lives Challenge (#3) adapted for multi-correct-per-round (creator described "tap all correct pairs"; closest standard archetype, with adaptation noted).
- **Feedback style:** defaulted to FeedbackManager multi-step pattern (SFX + sticker, fire-and-forget) per feedback/SKILL.md — creator did not specify.
- **Difficulty stages:** defaulted to 3 equal stages of 3 rounds.
- **Rounds:** defaulted to 9 (3 per stage).
- **Target sums in Stages 2 and 3:** defaulted to {12,15,18} and {15,18,20} — creator showed only a sum-10 example; these progress naturally (extend past 10 → cross-10 → sum-to-20).
- **Board sizes (8 / 10 / 12 pills):** defaulted per stage — creator showed only one board; sizes chosen to keep the grid fit within a mobile viewport (2 columns × ≤ 6 rows = 12 pills max within 480px width).
- **Correct-pair counts (3 / 4 / 4):** defaulted to match the creator's "find ALL correct pairs" rule under the constraint that 25-40% of the board is a correct pair (keeps scanning non-trivial).
- **Per-pair speed threshold (2.0s):** taken verbatim from the creator's intro text "Spot each pair under 2 seconds to win 3 stars!".
- **Star formula:** defaulted to fast-pair ratio + lives-alive (creator only specified the speed threshold, not the aggregate thresholds).
- **Timer type:** defaulted to count-up per-pair soft timer (required by the speed-bonus mechanic; no hard time limit).
- **Preview audio:** defaulted to TTS-at-deploy (`previewAudio: null`, `previewAudioText` provided for pipeline).
- **Language:** English.
- **Bloom level:** inferred L2 (recognise) with a lean toward L3 in Stage 3 — creator did not state a Bloom level.
- **Class/Grade:** defaulted to Class 1-2 — creator did not specify; sum-to-10 is a Class 1 outcome and the sum-to-20 extension fits Class 2.
- **Curriculum reference:** NCERT Math-Magic Class 1 ("Add Our Points", "Numbers 10 to 20") and Class 2 ("What Is Long, What Is Round?" follow-up addition chapters).
- **Mobile layout:** inherits mobile/SKILL.md defaults (44px targets, portrait-only, 100dvh, overflow-x hidden, staggered grid implemented with grid-layout + row-offset margins, not flex `gap`).
- **Scaffolding:** none per-tap (multi-step game; per-tap reveals would kill flow). Implicit scaffolding = distractor density increases gradually across stages.
- **Distractor strategy:** all distractors carry a misconception tag; Stages 2-3 include swap-pair and concat-not-add traps on top of off-by-one variants.
- **Progress bar:** visible on every non-preview screen; rounds-based (N/9), heart indicator = lives. Bumps on final-correct-pair of each round, per Cross-Cutting rule 0.
- **Input:** single-tap (no double-tap, no drag).
- **Orientation:** portrait-only.

## Warnings

- **WARNING — Bloom L2 + 3 lives:** Default pedagogy (pedagogy/SKILL.md constraint #2) forbids lives at L2 unless there is explicit spec justification. Creator's description explicitly includes "3 hearts / lives" and a "Game Over" flow, so lives are preserved. Monitor first-attempt pass rate; if it drops below 70% at Class 1-2, either raise lives to 5 or convert Stage 1 wrong answers into no-penalty nudges (show correct-pair hint instead of decrementing lives).
- **WARNING — Lives Challenge archetype + multi-correct-per-round:** The standard Lives Challenge profile assumes one correct answer per round. This spec keeps lives from that archetype but adopts the multi-target-per-round structure from the creator's description. Downstream implementers MUST NOT assume `currentRound++` after each correct tap — `currentRound++` fires only after all correct pairs in the round are found. Game state must track `correctPairsFoundThisRound` separately from `currentRound`.
- **WARNING — Multi-step feedback pattern with lives:** Per feedback CASE 7 multi-step variant, mid-round wrong taps use fire-and-forget SFX and do NOT block input. This is the correct rule for this archetype but conflicts with the typical Lives-Challenge pattern of "wrong → await SFX → reset/retry". Implementers must follow the multi-step rule, not the single-step one. `recordAttempt` still fires synchronously on every tap.
- **WARNING — Per-pair timer (count-up) with lives and no hard timeout:** Three pressure sources (lives, per-pair speed, board density in Stage 3) compound. Watch for frustration signals (high game-over rate in Stage 1, long session times, low star attainment). If < 30% of players reach Victory, relax the 2-second speed threshold to 3.0s or drop the lives penalty to "no lives, only speed affects stars".
- **WARNING — Single-digit pair on a crowded board (Stage 3 R9 `p12 = 2·0`):** This pill sums to only 2, far from target 20. Included to test the `concat-not-add` misconception (students reading "2·0" as "20"). If the digit `·` separator is ambiguous on low-DPI screens, replace with a bullet `•` or `+` and retest.
- **WARNING — Accessibility: single-tap rapid interaction:** Students with motor-coordination differences may mis-tap. Pills re-enable after a wrong-tap shake so a misread is not permanently lost, but the 44×44 px minimum (mobile/SKILL.md rule 9) with 8 px spacing (rule 10) must be strictly enforced. Do NOT tighten spacing to fit more pills on screen.
