# Game Design: Matching Doubles

## Identity
- **Game ID:** matching-doubles
- **Title:** Matching Doubles
- **Class/Grade:** Class 6-8
- **Math Domain:** Number Operations — Multiplication
- **Topic:** Doubling numbers (×2)
- **Bloom Level:** L2 Understand
- **Archetype:** Memory Match (#5) with lives (variant: two-column match, not card-flip)

## One-Line Concept
Students match numbers to their doubles (×2) by tapping pairs across two columns, building fluency with the doubling operation under increasing grid complexity.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Double identification | Recognize that a number is 2× another | All rounds |
| Mental multiplication (×2) | Quickly compute ×2 for single and double-digit numbers | All rounds |
| Elimination strategy | Use process of elimination as grid size grows | Rounds 4-9 |

## Core Mechanic
### Type A: "Two-Column Match"
1. **What the student sees:** Left column shows N numbers, right column shows their doubles (×2) in shuffled order. Unmatched items are active; matched pairs are locked and visually distinct.
2. **What the student does:** Tap a number on the left, then tap its double on the right. Two taps = one match attempt.
3. **What counts as correct:** The right-column value equals 2× the left-column value.
4. **What feedback plays:** Correct match: SFX + celebration sticker (fire-and-forget, no TTS — multi-step). Wrong match: SFX + sad sticker (fire-and-forget), life lost, both selections deselect. Round complete (all pairs matched): round-complete SFX + sticker (awaited).

## Rounds & Progression
### Stage 1: Easy (Rounds 1-3)
- 3 pairs per round (3 numbers on left, 3 doubles on right)
- Numbers: single digits 2-9
- Doubles range: 4-18
- Minimal confusability between doubles

### Stage 2: Medium (Rounds 4-6)
- 4 pairs per round (4 numbers on left, 4 doubles on right)
- Numbers: mix of single and double digits, 5-30
- Doubles range: 10-60
- Some doubles are close in value (e.g., 24 and 26), increasing confusability

### Stage 3: Hard (Rounds 7-9)
- 5 pairs per round (5 numbers on left, 5 doubles on right)
- Numbers: double digits, 15-50
- Doubles range: 30-100
- High confusability: multiple doubles within ±10 of each other

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Pairs per round | 3 | 4 | 5 |
| Number range | 2-9 | 5-30 | 15-50 |
| Doubles range | 4-18 | 10-60 | 30-100 |
| Confusability | Low | Medium | High |
| Cognitive load | Low (few pairs) | Medium (more pairs, larger numbers) | High (many pairs, close values) |

## Game Parameters
- **Rounds:** 9
- **Timer:** Count-up timer (starts at 0, counts up — no time limit, used for star rating)
- **Lives:** 3 (wrong match costs 1 life; game ends at 0 lives)
- **Star rating:** 3 stars = finish in ≤ 60 seconds, 2 stars = finish in ≤ 90 seconds, 1 star = finish in > 90 seconds
- **Input:** Tap-to-select (tap left item, then tap right item)
- **Feedback:** Multi-step — SFX + sticker per match (fire-and-forget), round-complete SFX (awaited)

## Scoring
- **Points:** +1 per correct match (total possible = 3+3+3+4+4+4+5+5+5 = 36 matches)
- **Stars:** Based on total completion time (3★ ≤60s, 2★ ≤90s, 1★ >90s)
- **Lives:** 3 lives. -1 life per wrong match. At 0 lives → game over screen.
- **Partial credit:** None. A match is either correct or wrong.

## Feedback
| Event | Behavior |
|-------|----------|
| Tap left-column item | Highlight selected item (blue border/glow). Soft select SFX (fire-and-forget). |
| Tap right-column item (with left selected) | Check match. |
| Correct match | Both items turn green, lock in place (opacity reduced, pointer-events: none). Correct SFX + celebration sticker (fire-and-forget). Score +1. |
| Wrong match | Both items flash red (~600ms), then deselect. Wrong SFX + sad sticker (fire-and-forget). Life lost — lives display updates. |
| Wrong match (last life) | Wrong SFX skipped — go straight to Game Over (Case 8). |
| All pairs matched in round | "Round complete" SFX + sticker + subtitle (awaited). Advance to next round. |
| All 9 rounds completed | Timer pauses. Results screen renders (stars, time, accuracy). `game_complete` sent before audio. Victory SFX → VO (sequential, awaited). |
| Game over (0 lives) | Timer pauses. Game Over screen renders (rounds completed, "Try Again" CTA). `game_complete` sent before audio. Game-over SFX → VO (sequential, awaited). |
| Tap "Try Again" / "Play Again" | Stop all audio. Reset all state. Return to start screen. |
| Deselect (tap selected left item again) | Remove highlight. Deselect SFX (fire-and-forget). |

## Content Structure (fallbackContent)

```js
const fallbackContent = [
  // Stage 1: Easy — 3 pairs, numbers 2-9
  {
    round: 1,
    stage: 1,
    type: "A",
    pairs: [
      { number: 3, double: 6 },
      { number: 7, double: 14 },
      { number: 5, double: 10 }
    ],
    misconception_tags: {
      "3→14": "magnitude-error",
      "3→10": "additive-reasoning",
      "7→6": "operation-reversal",
      "7→10": "computation-error",
      "5→6": "additive-reasoning",
      "5→14": "magnitude-error"
    }
  },
  {
    round: 2,
    stage: 1,
    type: "A",
    pairs: [
      { number: 4, double: 8 },
      { number: 9, double: 18 },
      { number: 2, double: 4 }
    ],
    misconception_tags: {
      "4→18": "magnitude-error",
      "4→4": "identity-confusion",
      "9→8": "off-by-one",
      "9→4": "operation-reversal",
      "2→8": "magnitude-error",
      "2→18": "magnitude-error"
    }
  },
  {
    round: 3,
    stage: 1,
    type: "A",
    pairs: [
      { number: 6, double: 12 },
      { number: 8, double: 16 },
      { number: 3, double: 6 }
    ],
    misconception_tags: {
      "6→16": "computation-error",
      "6→6": "identity-confusion",
      "8→12": "computation-error",
      "8→6": "operation-reversal",
      "3→12": "magnitude-error",
      "3→16": "magnitude-error"
    }
  },
  // Stage 2: Medium — 4 pairs, numbers 5-30
  {
    round: 4,
    stage: 2,
    type: "A",
    pairs: [
      { number: 12, double: 24 },
      { number: 15, double: 30 },
      { number: 8, double: 16 },
      { number: 21, double: 42 }
    ],
    misconception_tags: {
      "12→30": "additive-reasoning",
      "12→16": "computation-error",
      "12→42": "magnitude-error",
      "15→24": "computation-error",
      "15→16": "off-by-one",
      "15→42": "magnitude-error",
      "8→24": "magnitude-error",
      "8→30": "magnitude-error",
      "8→42": "magnitude-error",
      "21→24": "off-by-one",
      "21→30": "additive-reasoning",
      "21→16": "operation-reversal"
    }
  },
  {
    round: 5,
    stage: 2,
    type: "A",
    pairs: [
      { number: 18, double: 36 },
      { number: 25, double: 50 },
      { number: 11, double: 22 },
      { number: 30, double: 60 }
    ],
    misconception_tags: {
      "18→50": "magnitude-error",
      "18→22": "additive-reasoning",
      "18→60": "magnitude-error",
      "25→36": "computation-error",
      "25→22": "off-by-one",
      "25→60": "additive-reasoning",
      "11→36": "magnitude-error",
      "11→50": "magnitude-error",
      "11→60": "magnitude-error",
      "30→36": "additive-reasoning",
      "30→50": "computation-error",
      "30→22": "operation-reversal"
    }
  },
  {
    round: 6,
    stage: 2,
    type: "A",
    pairs: [
      { number: 14, double: 28 },
      { number: 22, double: 44 },
      { number: 9, double: 18 },
      { number: 27, double: 54 }
    ],
    misconception_tags: {
      "14→44": "magnitude-error",
      "14→18": "additive-reasoning",
      "14→54": "magnitude-error",
      "22→28": "additive-reasoning",
      "22→18": "operation-reversal",
      "22→54": "magnitude-error",
      "9→28": "magnitude-error",
      "9→44": "magnitude-error",
      "9→54": "magnitude-error",
      "27→28": "off-by-one",
      "27→44": "computation-error",
      "27→18": "operation-reversal"
    }
  },
  // Stage 3: Hard — 5 pairs, numbers 15-50
  {
    round: 7,
    stage: 3,
    type: "A",
    pairs: [
      { number: 23, double: 46 },
      { number: 35, double: 70 },
      { number: 19, double: 38 },
      { number: 42, double: 84 },
      { number: 28, double: 56 }
    ],
    misconception_tags: {
      "23→70": "magnitude-error",
      "23→38": "additive-reasoning",
      "23→84": "magnitude-error",
      "23→56": "magnitude-error",
      "35→46": "computation-error",
      "35→38": "off-by-one",
      "35→84": "magnitude-error",
      "35→56": "additive-reasoning",
      "19→46": "magnitude-error",
      "19→70": "magnitude-error",
      "19→84": "magnitude-error",
      "19→56": "magnitude-error",
      "42→46": "off-by-one",
      "42→70": "additive-reasoning",
      "42→38": "operation-reversal",
      "42→56": "computation-error",
      "28→46": "additive-reasoning",
      "28→70": "magnitude-error",
      "28→38": "computation-error",
      "28→84": "magnitude-error"
    }
  },
  {
    round: 8,
    stage: 3,
    type: "A",
    pairs: [
      { number: 33, double: 66 },
      { number: 47, double: 94 },
      { number: 16, double: 32 },
      { number: 38, double: 76 },
      { number: 25, double: 50 }
    ],
    misconception_tags: {
      "33→94": "magnitude-error",
      "33→32": "identity-confusion",
      "33→76": "magnitude-error",
      "33→50": "additive-reasoning",
      "47→66": "computation-error",
      "47→32": "operation-reversal",
      "47→76": "additive-reasoning",
      "47→50": "off-by-one",
      "16→66": "magnitude-error",
      "16→94": "magnitude-error",
      "16→76": "magnitude-error",
      "16→50": "magnitude-error",
      "38→66": "additive-reasoning",
      "38→94": "magnitude-error",
      "38→32": "off-by-one",
      "38→50": "computation-error",
      "25→66": "magnitude-error",
      "25→94": "magnitude-error",
      "25→32": "additive-reasoning",
      "25→76": "magnitude-error"
    }
  },
  {
    round: 9,
    stage: 3,
    type: "A",
    pairs: [
      { number: 44, double: 88 },
      { number: 29, double: 58 },
      { number: 36, double: 72 },
      { number: 50, double: 100 },
      { number: 21, double: 42 }
    ],
    misconception_tags: {
      "44→58": "computation-error",
      "44→72": "additive-reasoning",
      "44→100": "magnitude-error",
      "44→42": "identity-confusion",
      "29→88": "magnitude-error",
      "29→72": "magnitude-error",
      "29→100": "magnitude-error",
      "29→42": "additive-reasoning",
      "36→88": "magnitude-error",
      "36→58": "additive-reasoning",
      "36→100": "magnitude-error",
      "36→42": "off-by-one",
      "50→88": "magnitude-error",
      "50→58": "computation-error",
      "50→72": "additive-reasoning",
      "50→42": "operation-reversal",
      "21→88": "magnitude-error",
      "21→58": "magnitude-error",
      "21→72": "magnitude-error",
      "21→100": "magnitude-error"
    }
  }
];
```

## Defaults Applied
- **Feedback style:** Defaulted to FeedbackManager multi-step pattern (SFX + sticker per match, fire-and-forget) — creator did not specify feedback behavior.
- **Scaffolding:** Defaulted to no scaffolding (matching games don't use progressive hints — wrong match just deselects and costs a life) — creator did not specify.
- **Language:** Defaulted to English — creator did not specify.
- **Accessibility:** Defaulted to touch-only, 44px targets, sufficient contrast — creator did not specify.

## Warnings
- **WARNING: Lives at L2 Bloom level.** Creator explicitly specified 3 lives, but pedagogy guidelines recommend no lives at L1-L2. Keeping creator's choice (3 lives). Consider whether the lives mechanic adds productive pressure or unnecessary anxiety for this age group.
- **WARNING: Time-based star rating may penalize slower learners.** Stars are awarded solely on completion speed (≤60s / ≤90s / >90s), not accuracy. Students who are careful but slow get fewer stars than fast-but-lucky students. Consider adding an accuracy component to star calculation.
