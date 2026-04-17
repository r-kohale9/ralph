# Game Design: Matching Doubles

## Identity
- **Game ID:** matching-doubles
- **Title:** Matching Doubles
- **Class/Grade:** Class 6-8
- **Math Domain:** Number Operations — Multiplication
- **Topic:** Doubling numbers (×2)
- **Bloom Level:** L2 Understand
- **Archetype:** Memory Match (#5) — click-to-match pairs across two columns

## One-Line Concept
Students match numbers on the left to their doubles (×2) on the right by tapping pairs, building ×2 fluency and speed under increasing grid complexity.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Double identification | Recognize that a number is 2× another | A (tap-to-match) |
| Mental multiplication (×2) | Quickly compute ×2 for single- and double-digit numbers | A (tap-to-match) |
| Elimination strategy | Use process of elimination as grid size grows | A (tap-to-match) |

## Core Mechanic

### Type A: "Tap-to-Match Pair"
1. **What the student sees:** Two columns of tiles. Left column shows N base numbers. Right column shows N values (mostly doubles of the left column values, in shuffled order; Stage 3 may include near-miss distractors).
2. **What the student does:** Taps one tile on the left (it highlights), then taps one tile on the right. Two taps = one match attempt. Either selection can be deselected by re-tapping.
3. **What counts as correct:** The right-column tile value equals 2× the left-column tile value.
4. **What feedback plays:**
   - Correct: both tiles turn green, lock in place (disabled/non-interactive), correct SFX with celebration sticker — fire-and-forget (multi-step archetype rule from feedback/SKILL.md CASE 5).
   - Wrong: both tiles flash red (~600ms), shake, then deselect — wrong SFX with sad sticker, fire-and-forget. Life lost.
   - All pairs matched in round: round-complete SFX with sticker + subtitle "Round complete!" — awaited (CASE 6).

## Rounds & Progression

### Stage 1: Warm-up (Rounds 1-3)
- Round type: A
- 3 pairs per round
- Left-column numbers drawn from 2-9
- Right column = exact doubles of left column (shuffled), NO distractors
- Goal: build the ×2 reflex with small numbers

### Stage 2: Standard (Rounds 4-6)
- Round type: A
- 4 pairs per round
- Left-column numbers drawn from 5-30 (mix of single- and two-digit)
- Right column = exact doubles (shuffled), NO distractors — but grid size increases cognitive load
- Goal: practice ×2 with larger numbers under more visual competition

### Stage 3: Confusability (Rounds 7-9)
- Round type: A
- 5 pairs per round
- Left-column numbers drawn from 15-50
- Right column = 5 exact doubles PLUS near-miss values designed to tempt common misconceptions (e.g., n+2, n+1, 2n±1). Any extra tile that is NOT a true double counts as a distractor; tapping a left tile with a distractor tile = wrong match.
- Goal: resist pull of additive/off-by-one thinking

### Difficulty Summary
| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Pairs per round | 3 | 4 | 5 |
| Left-column range | 2-9 | 5-30 | 15-50 |
| Right-column range | 4-18 | 10-60 | 30-100 |
| Distractors in right column | None | None | Yes (misconception-tagged) |
| Confusability | Low | Medium | High |

## Game Parameters
- **Rounds:** 9 (3 per stage)
- **Timer:** Count-up `TimerComponent` (no per-round or global limit); final value drives star tier.
- **Lives:** 3
- **Star rating (time-only):** 3★ if final timer ≤ 60s, 2★ if ≤ 90s, 1★ otherwise (or if game ends via lives = 0).
- **Input:** Tap-to-select (click-to-match). Touch targets ≥ 44×44 px with ≥ 8 px spacing (mobile/SKILL.md rules 9-10).
- **Feedback:** FeedbackManager per feedback/SKILL.md multi-step defaults (SFX + sticker, fire-and-forget mid-round; awaited round-complete and end-game).

## Scoring
- **Points:** Not tracked for star rating. Internal pairs-matched counter feeds `recordAttempt` analytics but does not affect stars.
- **Star tiers (time-only, measured from `startGameAfterPreview()` to final pair matched in Round 9):**
  - 3★: final timer ≤ 60s
  - 2★: 60s < final timer ≤ 90s
  - 1★: final timer > 90s OR game ends via lives = 0
- **Round completion:** A round is complete when every left-column tile has been correctly paired with its double on the right (all pairs locked green). Game auto-advances to the next round transition.
- **Lives behavior:**
  - Start with 3 lives.
  - Each wrong match decrements lives by 1 and triggers CASE 7 feedback (shake + red flash + wrong SFX + sticker, fire-and-forget). Selected tiles deselect; round continues at the same state.
  - If lives reach 0 mid-round, game ends immediately → `game_over` screen (Case 12). Star rating = 1★. Pairs matched so far are recorded for analytics but stars are not upgraded.
  - If all 9 rounds are completed with ≥ 1 life remaining, game ends via victory screen with stars computed from final timer.
- **Timer continuity:** Timer starts at `startGameAfterPreview()` and runs continuously across all rounds and round transitions. It does NOT reset between rounds. It pauses only on visibility-hidden (feedback/SKILL.md CASE 14) and on victory/game-over screens.
- **Partial credit:** None. A pair is either locked (correct) or not.

## Pedagogy note

**Why lives at L2 Understand?** The default pedagogy for L2 Understand is no-penalty (pedagogy/SKILL.md Step 2, bloom-mapping.md L2 row). This spec deliberately deviates because the Class 6-8 audience has already met doubling in earlier grades — this is a **fluency / speed-practice** reframing, not initial concept-building. The 3-lives mechanic paired with a time-based star tier creates productive urgency without compounding stakes: wrong answers cost a life but never a star (stars depend only on final time), so a student who finishes under 60s with 1 life remaining still earns 3★. The time-based star rating keeps the emotional tone on *speed of fluency* rather than *avoidance of error*, which matches the "fluency practice under light pressure" framing the creator chose. If pass-rate analytics later show < 70% first-attempt success at Class 6-8, drop lives back to 0 or raise to 5.

## Flow

**Shape:** Multi-round (default)
**Changes from default:** Add conditional branch from Wrong Answer to `game_over` when `lives === 0`.

```
┌──────────────┐
│   Preview    │ (PART-039 overlay: previewInstruction + previewAudio + 5s timer / skip)
└──────┬───────┘
       ▼
┌──────────────┐
│  Welcome /   │ (Round 1 intro transition)
│ Round 1 intro│
└──────┬───────┘
       ▼
┌──────────────┐     ┌───────────────────────────────┐
│   Round N    │────▶│ Tap left tile → tap right tile │
│  gameplay    │     └──────────────┬────────────────┘
└──────▲───────┘                    │
       │                            ▼
       │             ┌──────────────────────────┐
       │             │  Correct? Lock pair,     │
       │             │  fire-and-forget SFX.    │
       │             │  All pairs locked?       │
       │             └──────┬───────────────────┘
       │                    │ yes
       │                    ▼
       │             ┌──────────────────────────┐
       │             │ Round-complete SFX (awaited)│
       │             │ N < 9? → next round intro │──┐
       │             └──────┬───────────────────┘  │
       │                    │ N == 9               │
       │                    ▼                      │
       │             ┌──────────────────────────┐  │
       │             │  Victory (stars by time) │  │
       │             └──────────────────────────┘  │
       │                                           │
       └───────────────────────────────────────────┘

Wrong-match branch:
  Wrong? shake + red flash + life-- + wrong SFX (fire-and-forget)
       │
       ├─ lives > 0 → return to Round N (tiles deselect)
       └─ lives == 0 → Game Over screen (1★ recorded)
```

## Feedback

| Event | Behavior |
|-------|----------|
| Left tile tapped (select) | Tile highlights (accent border), soft bubble select SFX fire-and-forget (feedback CASE 9). No TTS. No sticker. |
| Left tile re-tapped (deselect) | Highlight removed, deselect SFX fire-and-forget. |
| Right tile tapped after left is selected — correct match | Both tiles animate to green "locked" state (scale pulse 200ms), disabled for further taps. Correct-match SFX (`correct.mp3` via FeedbackManager) with small celebration sticker — fire-and-forget (multi-step rule, feedback CASE 5). NO dynamic TTS. Input NOT blocked — student can start next pair immediately. `recordAttempt({ is_correct: true, misconception_tag: null })` fires synchronously. |
| Right tile tapped after left is selected — wrong match | Both tiles flash red + shake (~600ms CSS keyframe). Wrong-match SFX with sad sticker — fire-and-forget (feedback CASE 7 multi-step variant). NO dynamic TTS, NO subtitle. Lives counter decrements by 1, progress-bar heart updates immediately. Both tiles deselect (return to neutral state) after the shake. `recordAttempt({ is_correct: false, misconception_tag: <from round data> })` fires synchronously. |
| All pairs in round matched (Round complete) | Round-complete SFX with celebration sticker + subtitle "Round complete!" — **awaited** (feedback CASE 6). Input blocked during audio. Then transition to next round intro (Rounds 1-8) or Victory (Round 9). |
| Lose last life (lives → 0) | Wrong SFX is **skipped** (feedback priority rule: game-over overrides wrong SFX). Game Over screen renders FIRST with 1★, "You matched X of Y pairs", and "Try Again" CTA. `game_complete` postMessage sent BEFORE audio. Then game-over SFX + sad sticker + game-over VO ("Good try — let's practice those doubles again!") awaited, with CTA interrupting any time. |
| Complete all 9 rounds (Victory) | Timer pauses. Final elapsed time determines star tier (3★ ≤ 60s, 2★ ≤ 90s, else 1★). Victory screen renders FIRST with stars, final time, pairs matched, and "Play Again" CTA. `game_complete` postMessage sent BEFORE audio. Then victory SFX + celebration sticker + victory VO (tier-specific: "Lightning fast doubling!" / "Nice work!" / "You finished — let's get faster next time!") awaited, CTA interrupts. |
| Visibility hidden (tab switch) | Timer pauses, all audio pauses, "Game Paused" overlay shows (CASE 14). |
| Visibility restored | Timer resumes, audio resumes, overlay dismisses (CASE 15). |
| Restart / Play Again | All audio stopped, lives reset to 3, timer reset to 0, round index reset to 1, fresh fallbackContent loaded, preview screen is NOT re-shown (PART-039 rule). |

## Content Structure (fallbackContent)

Each round object shape:

```js
{
  round: <1..9>,
  stage: <1|2|3>,
  type: "A",
  left: [<Number>, ...],               // base numbers; length = pairs-per-round
  right: [<Number>, ...],              // shuffled array containing each double
                                       //   plus Stage-3 distractors
  pairs: { "<left_value>": <correct_right_value>, ... },
  misconception_tags: {                 // key = distractor value in `right`;
                                        //   only non-double tiles are keyed
    "<distractor_value>": "<tag-name>"
  }
}
```

Full 9-round content set:

```js
const fallbackContent = {
  previewInstruction:
    '<p><strong>Match the doubles!</strong> Tap a number on the left, then tap its <em>double</em> (×2) on the right. Finish all 9 rounds before you run out of 3 lives. The faster you finish, the more stars you earn!</p>',
  previewAudioText:
    'Match the doubles! Tap a number on the left, then tap its double on the right. Finish all nine rounds before you lose your three lives. The faster you finish, the more stars you earn.',
  previewAudio: null,            // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ─── Stage 1: Warm-up (no distractors) ───
    {
      round: 1, stage: 1, type: "A",
      left:  [3, 5, 8],
      right: [16, 6, 10],
      pairs: { "3": 6, "5": 10, "8": 16 },
      misconception_tags: {}
    },
    {
      round: 2, stage: 1, type: "A",
      left:  [4, 7, 9],
      right: [18, 8, 14],
      pairs: { "4": 8, "7": 14, "9": 18 },
      misconception_tags: {}
    },
    {
      round: 3, stage: 1, type: "A",
      left:  [2, 6, 9],
      right: [18, 4, 12],
      pairs: { "2": 4, "6": 12, "9": 18 },
      misconception_tags: {}
    },

    // ─── Stage 2: Standard (no distractors, bigger numbers, 4 pairs) ───
    {
      round: 4, stage: 2, type: "A",
      left:  [6, 11, 15, 22],
      right: [44, 12, 30, 22],
      pairs: { "6": 12, "11": 22, "15": 30, "22": 44 },
      misconception_tags: {}
    },
    {
      round: 5, stage: 2, type: "A",
      left:  [9, 13, 18, 25],
      right: [36, 18, 50, 26],
      pairs: { "9": 18, "13": 26, "18": 36, "25": 50 },
      misconception_tags: {}
    },
    {
      round: 6, stage: 2, type: "A",
      left:  [8, 14, 20, 27],
      right: [28, 40, 54, 16],
      pairs: { "8": 16, "14": 28, "20": 40, "27": 54 },
      misconception_tags: {}
    },

    // ─── Stage 3: Confusability (5 pairs + misconception distractors) ───
    // Round 7: 5 correct doubles + 1 "double→add-instead" distractor.
    {
      round: 7, stage: 3, type: "A",
      left:  [15, 18, 21, 24, 30],
      right: [36, 17, 42, 60, 30, 48],     // 17 = 15 + 2 (add-instead)
      pairs: { "15": 30, "18": 36, "21": 42, "24": 48, "30": 60 },
      misconception_tags: {
        "17": "double-add-instead"
      }
    },
    // Round 8: 5 correct doubles + 1 "double→next-number" (n+1) +
    //          1 "double→off-by-one" (2n-1) distractor.
    {
      round: 8, stage: 3, type: "A",
      left:  [17, 23, 28, 35, 40],
      right: [46, 29, 56, 80, 70, 34, 55], // 29 = 28+1, 55 = 2*28-1
      pairs: { "17": 34, "23": 46, "28": 56, "35": 70, "40": 80 },
      misconception_tags: {
        "29": "double-next-number",
        "55": "double-off-by-one"
      }
    },
    // Round 9: 5 correct doubles + mix of misconceptions for maximum pull.
    {
      round: 9, stage: 3, type: "A",
      left:  [19, 26, 33, 42, 50],
      right: [38, 52, 44, 66, 84, 100, 51], // 44 = 42+2 (add-instead),
                                            // 51 = 50+1 (next-number)
      pairs: { "19": 38, "26": 52, "33": 66, "42": 84, "50": 100 },
      misconception_tags: {
        "44": "double-add-instead",
        "51": "double-next-number"
      }
    }
  ]
};
```

**Misconception tag definitions** (map to `reference/misconceptions.md` patterns; naming kept short and domain-specific for analytics):

| Tag | Name | Student belief |
|-----|------|----------------|
| `double-add-instead` | Adds 2 instead of multiplying by 2 | "Double = +2" — picks n+2 instead of 2n (a variant of MISC-NUM-03 "confuses multiplication with repeated-addition count"). |
| `double-next-number` | Off-by-one successor | "Double of n = n+1" — impulse pattern seen when the student is rushing and confuses "double" with "next". |
| `double-off-by-one` | Correct operation, careless arithmetic | "2n ≈ 2n-1" — student doubled correctly but produced 2n±1 from mental-math slip (equivalent to MISC-CALC-01 "careless calculation error"). |

## Defaults Applied
- **Archetype:** defaulted to Memory Match (#5) adapted for column-pair matching (creator described "match pairs across two columns"; classic card-flip memory not required, so tiles are face-up from the start).
- **Feedback style:** defaulted to FeedbackManager multi-step pattern (SFX + sticker, fire-and-forget) per feedback/SKILL.md — creator said "use your best judgment".
- **Timer type:** defaulted to count-up (no limit) — follows from creator's "time-only star rating" decision.
- **Difficulty stages:** defaulted to 3 equal stages of 3 rounds.
- **Rounds:** defaulted to 9 (3 per stage).
- **Scaffolding:** none between wrong attempts (multi-step matching games do not support per-tile reveals without breaking flow); lives and time pressure provide implicit pacing.
- **Preview audio:** defaulted to TTS-at-deploy (`previewAudio: null`, `previewAudioText` provided for pipeline).
- **Language:** English.
- **Mobile layout:** inherits mobile/SKILL.md defaults (44px targets, portrait-only, 100dvh, overflow-x hidden).
- **Distractor strategy:** Stages 1 and 2 have no distractors; Stage 3 introduces 1-2 misconception-tagged distractors per round.

## Warnings

- **WARNING — Bloom L2 + 3 lives:** Default pedagogy (pedagogy/SKILL.md constraint #2) forbids lives at L1-L2. Creator explicitly kept 3 lives for Class 6-8 fluency practice; see "Pedagogy note" above for justification. Monitor first-attempt pass rate — if it drops below 70% at any stage, reduce lives or remove the penalty.
- **WARNING — Time-only star rating decouples accuracy from stars:** A student can earn 3★ while losing 2 lives if they finish under 60s. This matches the creator's "fluency/speed" framing but means the stars do not signal mastery of correctness. Analytics should surface `wrong-matches-per-round` separately.
- **WARNING — Stage 3 distractor count is modest (1-2 per round):** If analytics show near-ceiling Stage 3 pass rates, increase distractors to 3 per round.
- **WARNING — Memory Match archetype default has `lives: 0`:** This spec overrides to `lives: 3`. The `game_over` screen and Lives-Challenge-style progress-bar heart display must be added (per game-archetypes.md constraint #5).
