# Game Design: Target Sum Game — Make Sum

## Identity
- **Game ID:** target-sum-game
- **Title:** Target Sum Game — Make Sum
- **Class/Grade:** Class 5
- **Math Domain:** Number Operations — Flexible Addition
- **Topic:** Combinatorial addition, decomposition, and recomposition of numbers to reach a target sum
- **Bloom Level:** L3 Apply
- **Archetype:** Lives Challenge (toggle + auto-check / submit variant — extends Sort/Classify family by using multi-select on a staggered grid)

## One-Line Concept
Tap a subset of cards from a staggered 3-4-2 grid whose values (plain numbers and expressions like `50+50`) add up to a given target sum — training flexible decomposition of numbers.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Flexible decomposition | See multiple additive routes to the same total | A, B, C |
| Expression evaluation | Evaluate simple `a+b` expressions mentally and compose them with plain numbers | A, B, C |
| Mental arithmetic fluency | Add multi-digit whole numbers quickly under a speed target | A, B, C |

## Core Mechanic

### Type A: "Make the Target Sum"
1. What the student sees: A target label ("Make Sum 310"), a staggered 3+4+2 grid of 9 cards (each card shows either a plain number like `60` or an expression like `50+50`), and a yellow "Next Round" button bottom-right. Row 1 has 3 cards, row 2 has 4 cards (indented/centered relative to row 1), row 3 has 2 cards (centered). All cards use the same white rounded-rectangle style.
2. What the student does: Tap one or more cards to select them (running total of tapped cards is tracked internally). Tap a selected card again to deselect it. When the student believes the total matches the target, tap the yellow "Next Round" button to submit.
3. What counts as correct: The sum of the values on the tapped (selected) cards equals the round's target. An expression card like `50+50` contributes `100`. The number of cards selected is unconstrained — any subset that sums to the target is accepted.
4. What feedback plays: On correct submit, green highlight sweep across selected cards + `correct_sound_effect` + fire-and-forget TTS subtitle. On wrong submit, red pulse across selected cards + `incorrect_sound_effect` + life lost + fire-and-forget TTS subtitle. On last-life wrong, wrong SFX (awaited, 1500ms floor) then game-over screen.

## Rounds & Progression

### Stage 1: Warm-up (Rounds 1-3)
- Round type: A.
- Difficulty parameters: Target is a multiple of 10 between 300-310. At least one card is an expression that evaluates directly to a round "tens" number. The canonical 2-card solution exists (e.g., two expression cards whose sum hits the target), and a mixed 3-card solution also exists.
- Contexts/themes: Pure numbers — no story wrapping.

### Stage 2: Build (Rounds 4-6)
- Round type: A.
- Difficulty parameters: Target sums in the 320-330 range. Pools mix expression cards and plain numbers; the canonical solution uses 3-4 cards. Multiple valid subsets exist, forcing student to try combinations.
- Contexts/themes: Pure numbers.

### Stage 3: Stretch (Rounds 7-9)
- Round type: A.
- Difficulty parameters: Target sums 330-340. Pools include a distractor number that cannot be part of any valid subset close to target. Canonical solutions still 3-4 cards but non-obvious.
- Contexts/themes: Pure numbers.

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Target | 300-310 | 320-330 | 330-340 |
| Card count | 9 (3+4+2) | 9 (3+4+2) | 9 (3+4+2) |
| Expression cards | 2 | 2 | 1-2 |
| Solution size | 2-3 cards | 3-4 cards | 3-4 cards |
| Distractor cards | 0 | 0-1 | 1 |

## Game Parameters
- **Rounds:** 9
- **Timer:** None (per-round time is measured internally for the speed star only — no countdown displayed; timer display shows elapsed round time "00:03" style as a non-blocking header readout)
- **Lives:** 3 (hearts)
- **Star rating:** 3 stars = complete all 9 rounds AND average round time < 3 seconds AND solve ≥ 8 of 9 on first check; 2 stars = complete all 9 rounds AND solve ≥ 6 of 9 on first check; 1 star = complete at least 1 round on first check; 0 stars = otherwise.
- **Input:** Multi-tap select/deselect cards + "Next Round" submit button.
- **Feedback:** `FeedbackManager.sound.play()` + fire-and-forget `playDynamicFeedback()` per single-step submit. Select/deselect micro-SFX fire-and-forget. All via PART-017.

## Scoring
- Points: +1 per round solved on first check (counted in `gameState.firstCheckSolves`). Also maintained: `gameState.score` = firstCheckSolves for test harness.
- Stars: per the star rating rule above. `getStars()` returns 0-3 based on firstCheckSolves AND average response time.
- Lives: 3 hearts. A wrong submit deducts one life. At 0 lives, game-over path fires (Case 12).
- Partial credit: None — either the subset sums to target (correct, +1) or not (wrong, -1 life).

## Flow

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game       │
│ 🔊 prev  │        │ 🔊 welc. │        │ (trans.,     │ (after  │ (round N)  │
│   audio  │        │    VO    │        │  no buttons) │  sound) │ 🔊 prompt  │
└──────────┘        └──────────┘        │ 🔊 "Round N" │         │    / TTS   │
                                        └──────────────┘         └─────┬──────┘
                                                ▲                      │ player submits
                                                │                      ▼
                                                │            ┌─────────────────────┐
                                                │            │ Feedback (2s, on    │
                                                │            │ same game screen)   │
                                                │            │ ✓ 🔊 sound_correct  │
                                                │            │ ✗ 🔊 sound_life_lost│
                                                │            └─────────┬───────────┘
                              ┌─────────────────┴─────┬────────────────┼──────────────┐
                              │                       │                               │
                        wrong AND lives = 0   correct AND more   correct AND last round won
                              │                rounds            │
                              ▼                  (loops back     ▼
                   ┌────────────────────┐        to Round N+1     ┌────────────────────┐
                   │ Game Over (status) │        intro)           │ Victory (status)   │
                   │ 🔊 sound_game_over │                         │ 1–3★               │
                   └─────────┬──────────┘                         │ 🔊 sound_game_     │
                             │ "Try Again"                        │    victory →       │
                             ▼                                    │    vo_victory_     │
                   ┌──────────────────┐                           │    stars_N         │
                   │ "Ready to        │                           └──────┬─────┬───────┘
                   │  improve your    │                                   │     │
                   │  score?"         │                       "Play Again"│     │ "Claim Stars"
                   │ (trans., tap)    │                       (only if    │     │
                   │ 🔊 motivation VO │                        1–2 ★)     ▼     ▼
                   │ [I'm ready]      │                        ┌──────────────────┐  ┌──────────────────────┐
                   └────────┬─────────┘                        │ "Ready to        │  │ "Yay, stars          │
                            │ tap                              │  improve your    │  │  collected!"         │
                            ▼                                  │  score?"         │  │ (trans., auto,       │
                   restart from Round 1                        │ (trans., tap)    │  │  no buttons)         │
                                                               │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                                                               │ [I'm ready]      │  │    sound + ✨ star   │
                                                               └────────┬─────────┘  │    animation         │
                                                                        │ tap        └──────────┬───────────┘
                                                                        ▼                       │ auto, after
                                                               restart from Round 1             │ animation / sound
                                                                                                ▼
                                                                                               exit
```

**Shape:** Multi-round (default)
**Changes from default:** None

## Feedback
| Event | Behavior |
|-------|----------|
| Card select | Soft `sound_bubble_select` fire-and-forget, card turns yellow/highlighted |
| Card deselect | Soft `sound_bubble_deselect` fire-and-forget, card returns to default |
| Correct submit | Cards turn green, `await Promise.all([sound.play('correct_sound_effect', {sticker}), 1500ms])`, fire-and-forget TTS "Nice! 100 + 60 + 80 + 70 = 310". Progress bar bumps first, then auto-advance |
| Wrong submit (lives remain) | Selected cards pulse red, `await Promise.all([sound.play('incorrect_sound_effect', {sticker}), 1500ms])`, fire-and-forget TTS "Not quite — total is 290, try again", life -1. Cards deselect themselves after animation so student can try again |
| Wrong submit (last life) | Same as wrong SFX + animation (awaited 1500ms) THEN Game Over transition |
| Complete all 9 rounds | Victory transition with stars based on firstCheckSolves + avg time |
| Preview | PART-039 screen shown once at game start with instruction text and audio |
| Pause (tab switch) | VisibilityTracker's popup auto-shows; audio pauses |

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Tap & select to reach the target sum.</b><br><br>Tap to select, tap again to de-select.<br><br>Complete all 9 rounds with an average speed of under 3 seconds per round to win 3 stars.</p>',
  previewAudioText: 'Tap and select to reach the target sum. Tap again to deselect. Complete all nine rounds with an average speed of under three seconds per round to win three stars.',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    {
      round: 1, stage: 1, type: 'A',
      target: 310,
      cards: [
        // Row 1 (3 cards)
        { id: 'c1', label: '30+70', value: 100 },
        { id: 'c2', label: '50+50', value: 100 },
        { id: 'c3', label: '60',    value: 60  },
        // Row 2 (4 cards)
        { id: 'c4', label: '80',    value: 80  },
        { id: 'c5', label: '40',    value: 40  },
        { id: 'c6', label: '20',    value: 20  },
        { id: 'c7', label: '70',    value: 70  },
        // Row 3 (2 cards)
        { id: 'c8', label: '30',    value: 30  },
        { id: 'c9', label: '90',    value: 90  }
      ],
      // Multiple valid subsets exist; one canonical is used in TTS.
      canonical_solution: ['c1', 'c2', 'c4', 'c6', 'c5', 'c4'], // illustrative; any sum==310 accepted
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target (stopped too early)',
        'sum-over-target':   'Selection sum exceeds target (over-counted an expression)',
        'expression-misread':'Evaluated an expression card as one of its addends (e.g. read 50+50 as 50)'
      }
    },
    {
      round: 2, stage: 1, type: 'A',
      target: 320,
      cards: [
        { id: 'c1', label: '40+60', value: 100 },
        { id: 'c2', label: '30+70', value: 100 },
        { id: 'c3', label: '80',    value: 80  },
        { id: 'c4', label: '50',    value: 50  },
        { id: 'c5', label: '60',    value: 60  },
        { id: 'c6', label: '40',    value: 40  },
        { id: 'c7', label: '20',    value: 20  },
        { id: 'c8', label: '90',    value: 90  },
        { id: 'c9', label: '70',    value: 70  }
      ],
      canonical_solution: ['c1', 'c2', 'c8', 'c7'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 3, stage: 1, type: 'A',
      target: 330,
      cards: [
        { id: 'c1', label: '70+30', value: 100 },
        { id: 'c2', label: '60+40', value: 100 },
        { id: 'c3', label: '70',    value: 70  },
        { id: 'c4', label: '60',    value: 60  },
        { id: 'c5', label: '50',    value: 50  },
        { id: 'c6', label: '30',    value: 30  },
        { id: 'c7', label: '20',    value: 20  },
        { id: 'c8', label: '80',    value: 80  },
        { id: 'c9', label: '40',    value: 40  }
      ],
      canonical_solution: ['c1', 'c2', 'c5', 'c8'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 4, stage: 2, type: 'A',
      target: 320,
      cards: [
        { id: 'c1', label: '20+80', value: 100 },
        { id: 'c2', label: '60+40', value: 100 },
        { id: 'c3', label: '50',    value: 50  },
        { id: 'c4', label: '70',    value: 70  },
        { id: 'c5', label: '80',    value: 80  },
        { id: 'c6', label: '30',    value: 30  },
        { id: 'c7', label: '20',    value: 20  },
        { id: 'c8', label: '90',    value: 90  },
        { id: 'c9', label: '40',    value: 40  }
      ],
      canonical_solution: ['c1', 'c2', 'c5', 'c9'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 5, stage: 2, type: 'A',
      target: 330,
      cards: [
        { id: 'c1', label: '80+20', value: 100 },
        { id: 'c2', label: '40+60', value: 100 },
        { id: 'c3', label: '90',    value: 90  },
        { id: 'c4', label: '60',    value: 60  },
        { id: 'c5', label: '50',    value: 50  },
        { id: 'c6', label: '40',    value: 40  },
        { id: 'c7', label: '30',    value: 30  },
        { id: 'c8', label: '70',    value: 70  },
        { id: 'c9', label: '20',    value: 20  }
      ],
      canonical_solution: ['c1', 'c2', 'c4', 'c7'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 6, stage: 2, type: 'A',
      target: 320,
      cards: [
        { id: 'c1', label: '50+50', value: 100 },
        { id: 'c2', label: '70+30', value: 100 },
        { id: 'c3', label: '80',    value: 80  },
        { id: 'c4', label: '40',    value: 40  },
        { id: 'c5', label: '60',    value: 60  },
        { id: 'c6', label: '30',    value: 30  },
        { id: 'c7', label: '70',    value: 70  },
        { id: 'c8', label: '20',    value: 20  },
        { id: 'c9', label: '90',    value: 90  }
      ],
      canonical_solution: ['c1', 'c2', 'c4', 'c7', 'c1', 'c4'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 7, stage: 3, type: 'A',
      target: 330,
      cards: [
        { id: 'c1', label: '60+40', value: 100 },
        { id: 'c2', label: '20+80', value: 100 },
        { id: 'c3', label: '50',    value: 50  },
        { id: 'c4', label: '80',    value: 80  },
        { id: 'c5', label: '70',    value: 70  },
        { id: 'c6', label: '30',    value: 30  },
        { id: 'c7', label: '20',    value: 20  },
        { id: 'c8', label: '90',    value: 90  },
        { id: 'c9', label: '40',    value: 40  }
      ],
      canonical_solution: ['c1', 'c2', 'c5', 'c6'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 8, stage: 3, type: 'A',
      target: 340,
      cards: [
        { id: 'c1', label: '40+60', value: 100 },
        { id: 'c2', label: '50+50', value: 100 },
        { id: 'c3', label: '80',    value: 80  },
        { id: 'c4', label: '60',    value: 60  },
        { id: 'c5', label: '40',    value: 40  },
        { id: 'c6', label: '20',    value: 20  },
        { id: 'c7', label: '70',    value: 70  },
        { id: 'c8', label: '30',    value: 30  },
        { id: 'c9', label: '90',    value: 90  }
      ],
      canonical_solution: ['c1', 'c2', 'c4', 'c8', 'c5'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    },
    {
      round: 9, stage: 3, type: 'A',
      target: 330,
      cards: [
        { id: 'c1', label: '30+70', value: 100 },
        { id: 'c2', label: '40+60', value: 100 },
        { id: 'c3', label: '90',    value: 90  },
        { id: 'c4', label: '80',    value: 80  },
        { id: 'c5', label: '50',    value: 50  },
        { id: 'c6', label: '40',    value: 40  },
        { id: 'c7', label: '30',    value: 30  },
        { id: 'c8', label: '20',    value: 20  },
        { id: 'c9', label: '70',    value: 70  }
      ],
      canonical_solution: ['c1', 'c2', 'c5', 'c7', 'c1', 'c2'],
      misconception_tags: {
        'sum-under-target':  'Selection sum is below target',
        'sum-over-target':   'Selection sum exceeds target',
        'expression-misread':'Evaluated expression as one of its addends'
      }
    }
  ]
};
```

Note: `canonical_solution` is advisory — the engine accepts ANY subset whose card values sum to the target. Multiple valid subsets usually exist per round.

## Defaults Applied
- **Lives**: defaulted to 3 (L3 Apply level, speed-pressure game)
- **Timer**: defaulted to per-round elapsed readout ("00:03" style) in status header, no countdown, no hard cap (concept file does not specify a hard deadline)
- **Bloom Level**: set to L3 Apply (student applies decomposition to hit a target — not just recognition)
- **Language**: English
- **Accessibility**: Touch-only, 44px+ tap targets, 8px+ spacing
- **Scaffolding**: Wrong submit deselects all selected cards so student re-thinks (no pre-filled hint; lives system provides guardrails)
- **Preview**: PART-039 preview screen ON by default with the instruction verbatim from concept
- **Star thresholds**: 3★ requires average round time < 3 seconds per the concept; 2★ and 1★ derived from `firstCheckSolves` alone (the concept only defines 3★)

## Warnings
- WARNING: Star rule combines TWO conditions (first-check accuracy AND average response time). If the avg-time check fails at high accuracy, the student gets 2★ instead of 3★ — this follows the concept verbatim but may feel punitive. Acceptable per concept.
- WARNING: Multiple valid subsets per round means `canonical_solution` in fallbackContent is illustrative only; the real acceptance check is `sum(selected.values) === target`. Engineer must NOT implement set-exact-match against `canonical_solution`.
