# Game Design: Odd Fraction Out

## Identity
- **Game ID:** odd-fraction-out
- **Title:** Odd Fraction Out
- **Class/Grade:** Class 5
- **Math Domain:** Fractions
- **Topic:** Equivalent fractions (identifying the non-equivalent fraction from a set)
- **Bloom Level:** L2 Understand
- **Archetype:** MCQ Quiz (single-question variant / Shape 1 Standalone)
- **NCERT:** Class 5 Math Magic, Chapter 4 — *Parts and Wholes*

## One-Line Concept
The student looks at four fraction cards and taps the one that is NOT equivalent to the others, forcing them to mentally verify equivalence across three candidates and spot the outlier — building their understanding that fractions are the same rational number when numerator and denominator are scaled by the same factor.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Recognise equivalent fractions by common scaling factor | Student checks that 3/4, 6/8, 9/12 are all 3/4 scaled by 1, 2, 3 respectively | A (odd-one-out MCQ) |
| Distinguish a non-equivalent fraction from a set of equivalents | Student rules out 2/3 as having a different value than 3/4 | A (odd-one-out MCQ) |

## Core Mechanic

### Type A: "Odd-One-Out Fraction Tap"
1. **What the student sees:** Four fraction cards displayed as a 2×2 grid. Each card shows one fraction rendered in stacked numerator/denominator form: `3/4`, `6/8`, `9/12`, `2/3`. A single prompt heading above the cards reads: *"Tap the fraction that is NOT equal to the others."* No timer, no lives display, no progress bar. Card order is fixed as specified (no shuffling in this spec).
2. **What the student does:** Taps exactly one card. The tap commits the answer immediately — there is no "Submit" button and no confirmation step. After a tap the board is locked (input blocked) while feedback plays.
3. **What counts as correct:** Tapping the `2/3` card is correct. Tapping any of `3/4`, `6/8`, `9/12` is incorrect.
4. **What feedback plays:**
   - **Correct (2/3):** Correct SFX with celebration sticker (awaited) → dynamic TTS with subtitle and sticker: `"You got it!"` (awaited). `2/3` card turns green. 3 stars awarded.
   - **Incorrect (any of 3/4, 6/8, 9/12):** Wrong SFX with sad sticker (awaited) → dynamic TTS with subtitle and sticker: `"3/4, 6/8, 9/12 are all 3/4; 2/3 isn't."` (awaited). Tapped card flashes red (~600ms), then the correct card (`2/3`) is highlighted green so the student sees the right answer. 0 stars awarded.
   - After either outcome, a 2 second dwell, then Game End fires.

## Rounds & Progression

### Stage 1: The Only Stage (Round 1)
- Round types used: Type A (odd-one-out MCQ)
- Difficulty parameters: Four fractions equivalent to 3/4 via multipliers x1, x2, x3, with 2/3 as the outlier.
- Contexts/themes: Bare fraction cards, no word-problem wrapper.

| Dimension | Stage 1 |
|-----------|---------|
| Number of cards | 4 |
| Equivalent fractions shown | 3/4, 6/8, 9/12 |
| Outlier fraction | 2/3 |
| Scaling factors used | x1, x2, x3 |
| Difficulty descriptor | Single-question, fixed content |

(Only one stage exists because the game is a single question by creator's explicit design.)

## Game Parameters
- **Rounds:** 1 (totalRounds = 1, shape = Standalone)
- **Timer:** None
- **Lives:** None (0). No life display UI.
- **Star rating:** 3 stars = correct tap (2/3). 0 stars = any incorrect tap. No 1-star or 2-star tier.
- **Input:** Single-tap MCQ on one of four fraction cards.
- **Feedback:** FeedbackManager with `playDynamicFeedback('correct')` / `playDynamicFeedback('incorrect')`; custom TTS strings supplied per outcome.

## Scoring
- **Points:** +1 on correct, 0 on incorrect (binary).
- **Stars:** 3 stars if correct; 0 stars if incorrect. No intermediate thresholds.
- **Lives:** None. The game cannot end via life loss because lives do not exist.
- **Partial credit:** None.

## Flow

**Shape:** Standalone (`totalRounds: 1`)
**Changes from default:** None. Shape 1 Standalone is used verbatim.

```
┌──────────┐ tap    ┌────────────┐ tap card ┌──────────────────┐
│ Preview  ├───────▶│ Game (Q1)  ├─────────▶│ Feedback 2s      ├──▶ Game End
│ 🔊 prev  │        │ 🔊 prompt  │          │ ✓ / ✗            │    {stars, correct,
└──────────┘        │ no progress│          │ stars auto-given │     livesLeft:null}
                    │ bar        │          │ no retry         │    → host resumes
                    └────────────┘          └──────────────────┘
```

No Welcome, no Round-N intro, no Victory screen, no Game-Over screen, no "Ready to improve your score?", no "Yay stars collected!". Wrong answers do NOT retry — feedback plays, stars are finalized (0), Game End fires. Correct and wrong both terminate via the same Game End event.

## Feedback

| Event | Behavior |
|-------|----------|
| Preview shown (before first tap) | Preview overlay renders with `previewInstruction` HTML and plays `previewAudio` (TTS of `previewAudioText`). Overlay dismisses when student taps the overlay's "Start" CTA (stops audio if still playing). |
| Game screen loads | Prompt text "Tap the fraction that is NOT equal to the others." renders above the four cards. No auto-TTS on the game screen (preview audio already narrated the instruction). |
| Card tap — Correct (2/3) | Input blocked. `2/3` card turns green. Correct SFX with celebration sticker (awaited) → dynamic TTS "You got it!" with subtitle + sticker (awaited). `recordAttempt` sent with `selected_option="2/3"`, `is_correct=true`, `misconception_tag=null`. 3 stars awarded. 2s dwell. `game_complete` postMessage sent. Game End fires. |
| Card tap — Incorrect (3/4, 6/8, or 9/12) | Input blocked. Tapped card flashes red ~600ms. Wrong SFX with sad sticker (awaited) → dynamic TTS "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't." with subtitle + sticker (awaited). After TTS, the `2/3` card is highlighted green so the student sees the correct answer. `recordAttempt` sent with `selected_option`, `is_correct=false`, and the `misconception_tag` matching the tapped card. 0 stars awarded. 2s dwell. `game_complete` postMessage sent. Game End fires. |
| Lose last life | N/A — no lives in this game. |
| Complete all rounds | N/A in the traditional Victory sense; Game End event is fired directly after feedback. No Victory or Results screen is rendered — the host app handles post-game transition. |
| Visibility hidden | Pause any playing audio. No timer to pause. |
| Visibility restored | Resume audio if paused mid-playback. |
| Audio failure | Visual feedback (green/red card, sticker if it loads) still renders; gameplay continues and Game End still fires. |

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><strong>Find the fraction that isn&rsquo;t equal to the others.</strong></p>',
  previewAudioText: 'Three of these fractions are equal. One is not. Tap the odd one out.',
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  totalRounds: 1,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: "A",
      prompt: "Tap the fraction that is NOT equal to the others.",
      cards: [
        { id: "c1", numerator: 3, denominator: 4,  label: "3/4"  },
        { id: "c2", numerator: 6, denominator: 8,  label: "6/8"  },
        { id: "c3", numerator: 9, denominator: 12, label: "9/12" },
        { id: "c4", numerator: 2, denominator: 3,  label: "2/3"  }
      ],
      correctCardId: "c4",
      correctLabel: "2/3",
      correctFeedbackText: "You got it!",
      incorrectFeedbackText: "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't.",
      starsOnCorrect: 3,
      starsOnIncorrect: 0,
      misconception_tags: {
        "3/4":  "MISC-FRAC-EQ-01",
        "6/8":  "MISC-FRAC-EQ-02",
        "9/12": "MISC-FRAC-EQ-03"
      },
      misconception_definitions: {
        "MISC-FRAC-EQ-01": {
          name: "Treats the base/unscaled fraction as the odd one out",
          explanation: "3/4 is the base fraction; 6/8 and 9/12 are 3/4 scaled by 2 and 3. The unscaled form is still equal to the scaled forms."
        },
        "MISC-FRAC-EQ-02": {
          name: "Assumes a bigger-looking fraction has a different value",
          explanation: "6/8 looks bigger than 3/4 but it is the same value — both numerator and denominator were multiplied by 2."
        },
        "MISC-FRAC-EQ-03": {
          name: "Picks the fraction with the largest numbers as the odd one",
          explanation: "9/12 has the biggest numbers but is still equal to 3/4 — both numerator and denominator were multiplied by 3. Size of digits does not change the value of the fraction."
        }
      }
    }
  ]
};
```

## Mobile Considerations
- Viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`.
- `.game-wrapper` max-width: `var(--mathai-game-max-width)` (480px).
- Full-height container uses `100dvh` with `@supports` fallback to `100vh`.
- `overflow-x: hidden` on `html`, `body`, `.game-stack`; `overscroll-behavior: none` to prevent pull-to-refresh on incorrect tap flash.
- Four fraction cards laid out as a 2×2 grid using CSS `grid` with `gap`. Each card minimum 44×44 px; actual target size should exceed 120×120 px in the 2×2 layout on 375px-wide screens. Minimum 8 px between cards.
- Cards placed in the lower 60% of the viewport (thumb zone). Prompt heading occupies the upper area.
- `touch-action: manipulation` on cards; `-webkit-touch-callout: none` and `user-select: none` on `.game-wrapper`.
- No `type="number"` inputs anywhere (no text input in this game).
- Colors use `--mathai-*` CSS variables only — no hardcoded hex. Correct = `--mathai-success` green; incorrect = `--mathai-danger` red; card base = `--mathai-surface` with `--mathai-border` border.
- Font family via `var(--mathai-font-family)`. Fraction labels rendered at minimum 28 px for legibility; prompt heading at minimum 18 px.
- Safe-area insets (`env(safe-area-inset-*)`) applied to outer container.
- Portrait-only; landscape shows "rotate to portrait" overlay.
- No continuous CSS animations during gameplay. The red flash and green reveal are momentary (<800 ms each).
- No optional chaining (`?.`), no nullish coalescing (`??`), no `Array.at()`, no `aspect-ratio`, no `:has()`, no `color-mix()`, no top-level `await`. Explicit null checks in JS.
- FeedbackManager overlay visibility preserved (no custom overlay div that would compete with it).
- File size budget: <500 KB. DOM element count trivially under 500.

## Defaults Applied (creator auto-approved)
- **Archetype**: MCQ Quiz / Shape 1 Standalone.
- **Bloom Level**: L2 Understand.
- **Card layout**: 2×2 grid.
- **Card order**: fixed `[3/4, 6/8, 9/12, 2/3]` (no shuffle).
- **Fraction rendering**: stacked numerator-over-denominator with horizontal bar.
- **In-game prompt**: "Tap the fraction that is NOT equal to the others." shown above cards.
- **Wrong-answer UX**: ~600 ms red flash on tapped card, then green reveal on correct `2/3` card after TTS.
- **Misconception tags**: per-card (MISC-FRAC-EQ-01/02/03).
- **Dwell time after feedback**: 2 seconds.
- **Language**: English.
- **Scoring granularity**: binary (3 or 0 stars).

## Warnings (informational)
- Single-question game carries high variance — one tap fully determines outcome.
- No retry / no lives means no scaffolding opportunity after a wrong answer.
- Fixed card order may cue the answer (2/3 is always last). Future iteration could randomise.
- 70-85% difficulty target is measured across students, not rounds.
