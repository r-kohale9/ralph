# Game Design: Reach the Target Sum

## Identity
- **Game ID:** make-x
- **Title:** Reach the Target Sum
- **Class/Grade:** Class 4-5
- **Math Domain:** Number Sense & Addition
- **Topic:** Mental addition fluency, subset-sum reasoning
- **Bloom Level:** L3 Apply
- **Archetype:** Lives Challenge (#3) — multi-select with auto-validation, 3 lives, 2 levels

## One-Line Concept
Tap number tiles whose values add up exactly to a target sum — go over and you lose a life.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Mental addition | Add 2-4 numbers mentally to check if they reach a target | All rounds |
| Subset-sum reasoning | Identify which combination of tiles sums to the target (not just any tiles) | All rounds |
| Expression evaluation | Mentally evaluate expressions like "40+50" before selecting | Level 2 rounds |
| Strategic selection | Choose tiles carefully to avoid overshooting the target | All rounds |

## Core Mechanic
### Type A: "Tap-to-Sum"
1. **What the student sees:** A target number displayed prominently ("Make 90") and 5-6 number tiles below it. A running sum display shows the current total of selected tiles. Level 1 tiles show plain numbers (20, 30, 50). Level 2 tiles show addition expressions ("40+50").
2. **What the student does:** Taps tiles to select them (tile turns yellow, running sum updates). Taps again to deselect (tile returns to default, running sum decreases). No submit button — validation is automatic.
3. **What counts as correct:** Selected tiles' values sum exactly to the target number. Multiple valid solutions may exist per round.
4. **What counts as wrong:** Selected tiles' values exceed the target number. Going over = lose 1 life. Tiles are deselected and round resets (same target, same tiles).
5. **What feedback plays:**
   - On correct: Correct SFX (awaited) -> Dynamic TTS with subtitle + celebration sticker (awaited). E.g., "Great! 20 + 30 + 40 = 90!"
   - On overshoot: Incorrect SFX (awaited) -> Dynamic TTS with subtitle + sad sticker (awaited). E.g., "Oops! 20 + 30 + 50 = 100, that's over 90!"
   - On tile select: Bubble select SFX (fire-and-forget)
   - On tile deselect: Bubble deselect SFX (fire-and-forget)

## Rounds & Progression

### Level 1: "Number Tiles" (Rounds 1-3)
- Round type: A (Tap-to-Sum)
- Tiles show plain numbers (multiples of 5 and 10)
- Numbers range: 10-50
- Target range: 50-100
- 5-6 tiles per round
- Multiple valid solutions exist per round

### Level 2: "Expression Tiles" (Rounds 4-5)
- Round type: A (Tap-to-Sum)
- Tiles show addition expressions ("40+50", "25+15") that the player must mentally evaluate
- Expression values range: 20-60
- Target range: 90-130
- 5 tiles per round
- Player must evaluate expressions before reasoning about the subset sum
- Level intro screen shows average time from Level 1

| Dimension | Level 1 (Rounds 1-3) | Level 2 (Rounds 4-5) |
|-----------|----------------------|----------------------|
| Tile format | Plain numbers | Addition expressions |
| Number range | 10-50 | Expressions evaluating to 20-60 |
| Target range | 50-100 | 90-130 |
| Cognitive load | Single-step addition | Two-step: evaluate expression + subset-sum |
| Tiles per round | 5-6 | 5 |

## Game Parameters
- **Rounds:** 5 (3 in Level 1, 2 in Level 2)
- **Timer:** Count-up timer (tracks elapsed time per round for star calculation, not a countdown)
- **Lives:** 3 (lose 1 when selected tiles exceed target)
- **Star rating:** Based on average time per round: 3 stars = avg <=3s, 2 stars = avg 3-5s, 1 star = avg >5s
- **Input:** Multi-select tap (toggle tiles on/off)
- **Feedback:** FeedbackManager with audio + stickers + dynamic TTS

## Scoring
- Points: +1 per round completed correctly
- Stars: Based on speed (average seconds per round), NOT accuracy:
  - 3 stars: average <= 3 seconds per round
  - 2 stars: average > 3 and <= 5 seconds per round
  - 1 star: average > 5 seconds per round
  - 0 stars: lost all 3 lives (game over)
- Lives: 3 total. Lose 1 when selected tiles sum exceeds target. At 0 lives -> game over.
- Partial credit: None. Each round is binary (solved or not).

## Feedback
| Event | Behavior |
|-------|----------|
| Tile selected | Tile turns yellow, running sum updates, bubble select SFX (fire-and-forget) |
| Tile deselected | Tile returns to default color, running sum updates, bubble deselect SFX (fire-and-forget) |
| Correct sum reached | Celebration! Correct SFX (awaited) -> Dynamic TTS "Great! [tiles] = [target]!" with celebration sticker (awaited). Auto-advance after feedback. |
| Sum exceeds target (lives > 1) | Tiles flash red. Life lost. Incorrect SFX (awaited) -> Dynamic TTS "Oops! [sum] is more than [target]!" with sad sticker (awaited). Round resets (same target, tiles deselected). |
| Sum exceeds target (last life) | Skip incorrect SFX. Transition directly to game over screen. |
| Level 1 complete | Level transition screen: "Level 2: Expression Tiles!" Shows avg time so far. Level transition SFX (awaited) -> VO (awaited). CTA to continue. |
| All rounds complete (victory) | Results screen renders first. Shows stars, avg time, rounds completed. Victory SFX -> VO (awaited). game_complete sent before audio. |
| Game over (0 lives) | Game over screen renders first. Shows rounds completed, "Try Again" CTA. Game over SFX -> VO (awaited). game_complete sent before audio. |
| Round start | Dynamic TTS reads "Make [target]!" with subtitle (does NOT block input). New cards SFX (fire-and-forget). |

## Screen Flow
```
welcome -> level_1_intro -> gameplay (rounds 1-3) -> level_2_intro -> gameplay (rounds 4-5) -> results
                                                                                              |
                                          game_over <-- (at any point if lives = 0)
```

Screens:
1. **Welcome screen** (`start` phase): Game title "Reach the Target Sum", brief instructions, "Start" CTA
2. **Level 1 intro** (`level_intro` phase): "Level 1: Number Tiles", CTA to begin
3. **Gameplay** (`playing` phase): Target number, tile grid, running sum display, lives indicator, count-up timer, progress bar
4. **Level 2 intro** (`level_intro` phase): "Level 2: Expression Tiles!", shows avg time from Level 1, CTA to begin
5. **Results** (`results` phase): Stars, avg time per round, rounds completed, score, "Play Again" CTA
6. **Game Over** (`gameover` phase): Rounds completed out of 5, encouraging message, "Try Again" CTA

## Content Structure (fallbackContent)

```js
const fallbackContent = [
  {
    round: 1,
    level: 1,
    type: "A",
    target: 50,
    tiles: [
      { id: "t1", display: "10", value: 10 },
      { id: "t2", display: "15", value: 15 },
      { id: "t3", display: "20", value: 20 },
      { id: "t4", display: "25", value: 25 },
      { id: "t5", display: "30", value: 30 },
      { id: "t6", display: "35", value: 35 }
    ],
    solutions: [[20, 30], [15, 35], [10, 15, 25]],
    difficulty_level: 1,
    misconception_tags: {
      "overshoot": "greedy-selection",
      "select_all": "no-subset-reasoning"
    }
  },
  {
    round: 2,
    level: 1,
    type: "A",
    target: 80,
    tiles: [
      { id: "t1", display: "15", value: 15 },
      { id: "t2", display: "20", value: 20 },
      { id: "t3", display: "25", value: 25 },
      { id: "t4", display: "30", value: 30 },
      { id: "t5", display: "35", value: 35 },
      { id: "t6", display: "40", value: 40 }
    ],
    solutions: [[40, 25, 15], [35, 25, 20], [30, 35, 15]],
    difficulty_level: 1,
    misconception_tags: {
      "overshoot": "greedy-selection",
      "near_miss": "partial-sum-neglect"
    }
  },
  {
    round: 3,
    level: 1,
    type: "A",
    target: 100,
    tiles: [
      { id: "t1", display: "20", value: 20 },
      { id: "t2", display: "25", value: 25 },
      { id: "t3", display: "30", value: 30 },
      { id: "t4", display: "35", value: 35 },
      { id: "t5", display: "40", value: 40 },
      { id: "t6", display: "45", value: 45 }
    ],
    solutions: [[25, 30, 45], [20, 35, 45], [25, 35, 40]],
    difficulty_level: 2,
    misconception_tags: {
      "overshoot": "greedy-selection",
      "three_largest": "no-mental-check"
    }
  },
  {
    round: 4,
    level: 2,
    type: "A",
    target: 90,
    tiles: [
      { id: "t1", display: "20+10", value: 30 },
      { id: "t2", display: "15+5", value: 20 },
      { id: "t3", display: "25+15", value: 40 },
      { id: "t4", display: "40+10", value: 50 },
      { id: "t5", display: "10+20", value: 30 }
    ],
    solutions: [[30, 20, 40], [40, 50]],
    difficulty_level: 2,
    misconception_tags: {
      "overshoot": "greedy-selection",
      "expression_error": "expression-evaluation-error",
      "treat_as_first_operand": "partial-expression-read"
    }
  },
  {
    round: 5,
    level: 2,
    type: "A",
    target: 120,
    tiles: [
      { id: "t1", display: "30+20", value: 50 },
      { id: "t2", display: "45+5", value: 50 },
      { id: "t3", display: "25+15", value: 40 },
      { id: "t4", display: "35+25", value: 60 },
      { id: "t5", display: "20+10", value: 30 }
    ],
    solutions: [[50, 40, 30]],
    difficulty_level: 3,
    misconception_tags: {
      "overshoot": "greedy-selection",
      "expression_error": "expression-evaluation-error",
      "select_similar_values": "magnitude-confusion"
    }
  }
];
```

**Note on Round 5 solutions:** `[50, 40, 30]` is achievable via tiles t1+t3+t5 or t2+t3+t5 (both "30+20" and "45+5" evaluate to 50).

## Audio Integration

| Moment | Audio Type | URL/Method | Sticker |
|--------|-----------|------------|---------|
| Round start | Dynamic TTS | `playDynamicFeedback({ text: "Make [target]!", ... })` | None |
| Tile select | Static SFX | `sound_bubble_select` | None |
| Tile deselect | Static SFX | `sound_bubble_deselect` | None |
| Correct sum | Static SFX -> Dynamic TTS | `correct_sound_effect` then `playDynamicFeedback(...)` | Correct sticker |
| Overshoot | Static SFX -> Dynamic TTS | `incorrect_sound_effect` then `playDynamicFeedback(...)` | Incorrect sticker |
| Level transition | Static SFX -> Dynamic TTS | `sound_level_transition` then VO | Level transition sticker |
| Victory | Static SFX -> Dynamic TTS | `victory_sound_effect` then VO | Victory sticker (per star tier) |
| Game over | Static SFX -> Dynamic TTS | `game_over_sound_effect` then VO | Game over sticker |

## Defaults Applied
- **Language:** defaulted to English (creator did not specify)
- **Accessibility:** defaulted to touch-only, 44px min targets, sufficient contrast (creator did not specify)
- **Scaffolding:** On overshoot, tiles deselect and round resets (same tiles, same target) — gives student another try rather than showing the answer. After 2 consecutive overshoots on the same round, briefly highlight one valid tile combination before resetting.
- **Number ranges:** defaulted to multiples of 5 for Level 1 (creator said "20, 30, 50...") and clean addition expressions for Level 2 (creator said "40+50")

## Warnings
- **WARNING: Stars based on speed, not accuracy.** This is explicitly requested by the creator. Speed-based stars with lives creates dual pressure (speed + survival). Monitor if this feels too stressful for Class 4 students.
- **WARNING: Only 5 rounds total.** Below the typical 6-9 round minimum. However, with the subset-sum mechanic requiring multiple tile selections per round, each round has higher cognitive load than a standard MCQ. 5 rounds is appropriate.
- **WARNING: Auto-validation on overshoot is punitive.** Going over the target costs a life with no "undo" — a single accidental tap on a large tile can lose a life. The deselect mechanic mitigates this (student can deselect before overshooting), but accidental taps on small screens are possible. Consider: tiles could briefly "preview" before committing (200ms delay), but creator did not request this.
- **WARNING: Bloom-interaction note.** L3 Apply with multi-select is compatible. The subset-sum reasoning (which tiles add to target?) is genuinely L3 application of addition skills.
