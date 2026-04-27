# Game Design: Mind Your Numbers — Visual Pattern Completion

## Identity

- **Game ID:** mind-your-numbers
- **Title:** Mind Your Numbers
- **Class/Grade:** Class 4–6 (source concept: IMC 2025-26 Final Round, Level 2)
- **Math Domain:** Pattern Recognition / Inductive Reasoning (Pre-algebra number-pattern reasoning)
- **Topic:** Infer an arithmetic rule that relates four outer numbers to a central number, using two worked-example clusters, then compute the missing central value in a third (target) cluster.
- **Bloom Level:** L4 Analyze — the student must decompose each worked example, test multiple arithmetic hypotheses (sum, product, difference, max−min, …), and verify the hypothesis across *both* examples before applying it to the target cluster.
- **Archetype:** Puzzle (Pattern Recognition) with a Number-Input submit (Pattern P7) — single target per round; CHECK button submits.
- **NCERT Alignment:** NCERT Class 5 "Patterns" and Class 6 "Playing With Numbers" / "Knowing Our Numbers" — both chapters introduce the pattern-inference / number-rule skill. Reinforces the broader "find the rule" skill that shows up in Class 4–6 olympiad worksheets.

## One-Line Concept

Students look at three 2×2 clusters of overlapping circles — two completed clusters show a worked rule relating four outer numbers to a central number, and the third cluster has a "?" in the centre that the student must type.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Inductive reasoning | Infer an arithmetic rule from two labelled examples. | All rounds |
| Hypothesis testing | Try a rule on example 1, verify on example 2, only then apply to target. | All rounds |
| Arithmetic fluency | Execute sum, product, or max/min on small whole numbers mentally. | All rounds |
| Visual parsing | Read four outer numbers and one central number off overlapping-circle clusters. | All rounds |

---

## Core Mechanic

Single interaction type across all rounds — **type the missing central number** and tap CHECK (or press Enter).

Each round presents three 2×2 clusters of four overlapping circles:

- **Cluster 1 (top-left, worked example):** 4 outer numbers + 1 central number. Yellow/blue outline.
- **Cluster 2 (top-right, worked example):** 4 outer numbers + 1 central number. Purple/magenta outline.
- **Cluster 3 (bottom-center, target):** 4 outer numbers + a stylised 3D gold **"?"** in the centre. Pink outline.

A single rule relates the four outer numbers of a cluster to its central value. The same rule holds for all three clusters in a round — so the two worked examples *define* the rule, and the student computes the missing central number for the third.

The student taps the input box (beneath the target cluster) to focus it, types a numeric answer, and presses CHECK (or Enter).

### Type A: "One cluster" (the only type)

1. **Student sees:** Header (question counter, timer, 10-star rating) + 3 clusters stacked (2 on top row, 1 target below) + instruction text + a text input + CHECK button.
2. **Student does:** Taps the input, types the missing central number, taps CHECK (or Enter).
3. **Correct criterion:** Typed value, parsed as integer, equals the target cluster's central value.
4. **Feedback:** See § Feedback. Correct = green input highlight + correct SFX + TTS celebration + advance. Wrong = red input highlight + reveal answer + life −1 (down to 0 → game-over).

---

## Rounds & Progression

Three rounds per session, each with a distinct arithmetic rule. The student does NOT know the rule in advance — the two worked examples define it.

### Round 1 — Rule: product of top pair = product of bottom pair = centre

Mirrors the source-concept's Round 1 exactly.

- **Cluster 1 (yellow/blue):** outer top-left=2, top-right=6, bottom-left=4, bottom-right=3 → centre **12** (2×6 = 4×3 = 12).
- **Cluster 2 (purple/magenta):** outer 4, 4, 8, 2 → centre **16** (4×4 = 8×2 = 16).
- **Cluster 3 (pink, target):** outer 9, 2, 6, 3 → centre **?** (9×2 = 6×3 = **18**).

- **Answer:** 18
- **Bloom:** L4 Analyze.
- **Misconceptions:**
  - `sum-not-product` — student sums all four (2+6+4+3 = 15) instead of multiplying pairs.
  - `wrong-pairing` — student multiplies top-left×bottom-left (2×4 = 8) instead of top-row and bottom-row separately.

### Round 2 — Rule: sum of all four outer numbers

- **Cluster 1:** 1, 2, 3, 4 → centre **10**.
- **Cluster 2:** 2, 5, 1, 4 → centre **12**.
- **Cluster 3 (target):** 3, 3, 4, 2 → centre **?** (3+3+4+2 = **12**).

- **Answer:** 12
- **Bloom:** L4 Analyze.
- **Misconceptions:**
  - `product-instead-of-sum` — student carries over the product rule from R1.
  - `sum-three-out-of-four` — student misses one outer number while summing.

### Round 3 — Rule: max(outers) − min(outers)

- **Cluster 1:** 9, 3, 2, 7 → centre **7** (max=9, min=2, 9−2=7).
- **Cluster 2:** 10, 4, 6, 2 → centre **8** (max=10, min=2, 10−2=8).
- **Cluster 3 (target):** 9, 5, 1, 6 → centre **?** (max=9, min=1, 9−1 = **8**).

- **Answer:** 8
- **Bloom:** L4 Analyze.
- **Misconceptions:**
  - `sum-not-range` — student carries over R2 sum rule (9+5+1+6 = 21).
  - `first-minus-second` — student does top-left − top-right (9−5 = 4).

### Summary Table

| R | Rule | Example 1 outers / centre | Example 2 outers / centre | Target outers / answer |
|---|------|--------------------------|----------------------------|------------------------|
| 1 | product-of-pairs (top & bottom rows) | 2,6,4,3 / **12** | 4,4,8,2 / **16** | 9,2,6,3 / **18** |
| 2 | sum of all four | 1,2,3,4 / **10** | 2,5,1,4 / **12** | 3,3,4,2 / **12** |
| 3 | max − min | 9,3,2,7 / **7** | 10,4,6,2 / **8** | 9,5,1,6 / **8** |

---

## Game Parameters

- **Rounds:** 3 (one target cluster per round, hand-designed).
- **Timer:** 60 seconds per round (starts on entering gameplay; round advance resets it). L4 content, but rounds are short — timer adds a pacing pressure without being punitive.
- **Lives:** 3 (standard hearts). Wrong CHECK → life −1; when lives hit 0 → game-over.
- **Star rating** (tied to first-attempt solves):
  - **3 stars** = all 3 rounds solved on first CHECK
  - **2 stars** = 2 rounds solved on first CHECK
  - **1 star** = 1 round solved on first CHECK
  - **0 stars** = 0 rounds solved (still reaches results if lives survive)
- **Progress bar:** 10 stars (totalRounds × 3.33 → 10 segments), bump on every correct / round-complete.
- **Input:** Number input box (`type="text"` + `inputmode="numeric"`) + CHECK button. Enter key submits.
- **Feedback:** FeedbackManager single-step correct/wrong with sticker + SFX + TTS. Wrong answer reveals the correct numeric value in a small "Correct answer: X" label.

---

## Scoring

- **Points:** +1 per round solved on first CHECK (max 3). No partial credit.
- **Stars:** By count of first-CHECK solves (thresholds above).
- **Lives:** 3 total. Each wrong answer costs 1 life. Life = 0 → game-over path.
- **Partial credit:** None for scoring; telemetry still records per-round misconception tag for analytics.

---

## Flow

**Shape:** Shape 1 (Multi-round with Lives + Timer). Standard MCQ-lives flow adapted for text-input.

```
[Preview Screen (PART-039)]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: 3 clusters + input box + CHECK]
        |
        | Enter or tap CHECK
        v
[Validate typed number against answer]
        |
        +--> correct  --> Correct feedback (green input, SFX + TTS, firstCheckSolves++)
        |                    |
        |                    v
        |              [If N < 3: Round N+1 Transition]
        |              [If N == 3: Victory / Results]
        |
        +--> wrong --> Wrong feedback
                          (red input, reveal "Correct answer: X",
                           SFX + TTS, lives--)
                          |
                          +--> lives > 0: advance to next round
                          |
                          +--> lives == 0: Game Over screen
```

- After a **correct** answer, advance to next round (or Victory if N==3).
- After a **wrong** answer with lives remaining, briefly reveal the correct number, then advance. No in-round retry.
- After a **wrong** answer with lives = 0, show the Game Over screen.

---

## Feedback

| Event | Behavior |
|-------|----------|
| Input focus | Input border purple, scroll-into-view (p07-input-behaviors) |
| Input typing | Auto-grow width (MIN_W 72px → MAX_W 300px); numeric filter strips non-digits; clears `.input-correct`/`.input-wrong` classes |
| CHECK disabled | When input empty |
| CHECK pressed, correct | `isProcessing=true` before any await. Input border+bg flash green. `await FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT })` + minimum-duration 1500ms. `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` fire-and-forget. `recordAttempt(correct=true)` fires BEFORE audio. `firstCheckSolves+=1`. Advance to next round (or Victory). |
| CHECK pressed, wrong | `isProcessing=true`. Input border+bg flash red. "Correct answer: X" label renders below input. `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_WRONG })` + minimum-duration 1500ms. `FeedbackManager.playDynamicFeedback({...})` fire-and-forget. `recordAttempt(correct=false, misconception_tag)` fires BEFORE audio. Lives -=1. If lives>0 → advance; if lives==0 → game-over. |
| Round intro | TransitionScreen `{title: 'Round N', icons: ['🧠']}` + `rounds_sound_effect` + STICKER_ROUND. Auto-advance after SFX resolves. |
| Victory | TransitionScreen (persist, title "Victory 🎉", subtitle "You solved X of 3 on the first try!", stars). `game_complete` postMessage BEFORE audio. Victory SFX + VO awaited; CTA taps call stopAll. |
| Game Over | TransitionScreen (persist, title "Game Over", subtitle "Great effort — try again!"). `game_complete` postMessage BEFORE audio. game-over SFX + VO. |
| Visibility hidden | VisibilityTracker handles pause overlay (do not roll a custom one); audio + timer paused. |
| Visibility restored | VisibilityTracker dismisses overlay. State continues. |

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Figure out the pattern in this image</b><br>Type the number that should replace the question mark to complete the pattern.</p>',
  previewAudioText: 'Figure out the pattern in this image. Type the number that should replace the question mark to complete the pattern.',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    // ---------------------------------------------------------
    // ROUND 1 — Rule: product of top pair = product of bottom pair = centre
    // Example 1: 2,6,4,3 → 12 (2×6=12, 4×3=12)
    // Example 2: 4,4,8,2 → 16 (4×4=16, 8×2=16)
    // Target:    9,2,6,3 → 18 (9×2=18, 6×3=18)
    // ---------------------------------------------------------
    {
      round: 1,
      rule: 'product-of-pairs',
      ruleHint: 'top-left × top-right = bottom-left × bottom-right = centre',
      clusters: [
        { label: 'Example 1', colorScheme: 'yellow', outers: { tl: 2, tr: 6, bl: 4, br: 3 }, centre: 12 },
        { label: 'Example 2', colorScheme: 'purple', outers: { tl: 4, tr: 4, bl: 8, br: 2 }, centre: 16 },
        { label: 'Target',    colorScheme: 'pink',   outers: { tl: 9, tr: 2, bl: 6, br: 3 }, centre: null }
      ],
      answer: 18,
      misconception_tags: {
        'sum-not-product':  "Sums all four outer numbers instead of multiplying paired rows.",
        'wrong-pairing':    "Pairs diagonally (tl×bl) or (tl×br) instead of top-row and bottom-row."
      }
    },
    // ---------------------------------------------------------
    // ROUND 2 — Rule: sum of all four outer numbers
    // Example 1: 1,2,3,4 → 10
    // Example 2: 2,5,1,4 → 12
    // Target:    3,3,4,2 → 12
    // ---------------------------------------------------------
    {
      round: 2,
      rule: 'sum',
      ruleHint: 'sum of all four outer numbers',
      clusters: [
        { label: 'Example 1', colorScheme: 'yellow', outers: { tl: 1, tr: 2, bl: 3, br: 4 }, centre: 10 },
        { label: 'Example 2', colorScheme: 'purple', outers: { tl: 2, tr: 5, bl: 1, br: 4 }, centre: 12 },
        { label: 'Target',    colorScheme: 'pink',   outers: { tl: 3, tr: 3, bl: 4, br: 2 }, centre: null }
      ],
      answer: 12,
      misconception_tags: {
        'product-instead-of-sum': "Carries the product-of-pairs rule from Round 1.",
        'sum-three-of-four':      "Omits one outer number while summing."
      }
    },
    // ---------------------------------------------------------
    // ROUND 3 — Rule: max(outers) − min(outers)
    // Example 1: 9,3,2,7 → 7
    // Example 2: 10,4,6,2 → 8
    // Target:    9,5,1,6 → 8
    // ---------------------------------------------------------
    {
      round: 3,
      rule: 'max-minus-min',
      ruleHint: 'largest outer − smallest outer',
      clusters: [
        { label: 'Example 1', colorScheme: 'yellow', outers: { tl: 9, tr: 3, bl: 2, br: 7 }, centre: 7 },
        { label: 'Example 2', colorScheme: 'purple', outers: { tl: 10, tr: 4, bl: 6, br: 2 }, centre: 8 },
        { label: 'Target',    colorScheme: 'pink',   outers: { tl: 9, tr: 5, bl: 1, br: 6 }, centre: null }
      ],
      answer: 8,
      misconception_tags: {
        'sum-not-range':     "Sums all four instead of taking max − min.",
        'first-minus-second': "Subtracts top-right from top-left (tl − tr) instead of max − min."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Grade:** defaulted to Class 4–6 (source concept silent; IMC Level 2 suggests Class 4–6).
- **Bloom:** L4 Analyze (inductive rule inference across two examples).
- **Archetype:** Puzzle (Pattern Recognition) + Number-Input (P7).
- **Rounds:** defaulted to **3** total (source concept says "3 blocks" B1=10 but B2/B3=1 — we interpret the 3-cluster-per-round structure as one round, and the 3 block variants as 3 distinct rule rounds).
- **Timer:** 60 s per round — L4 is not typically timed, but targets here are quick computations, and a timer adds urgency without being punitive.
- **Lives:** 3 (standard for a bounded guessing game).
- **Star thresholds:** 3 firstCheckSolves → 3★; 2 → 2★; 1 → 1★; 0 → 0★.
- **Input style:** text-input with inputmode="numeric" (PART-P7 + p07-input-behaviors).
- **Feedback style:** FeedbackManager playDynamicFeedback with STICKER_CORRECT/STICKER_WRONG on correct/wrong; TTS subtitle mirrors audio; fire-and-forget per PART-017.
- **Scaffolding:** on wrong CHECK, reveal the correct numeric answer in a small label (no retry in same round).
- **Preview screen:** included (default `previewScreen: true` — PART-039). Instruction text verbatim from source concept.

---

## Warnings

- **WARNING — Timer on an L4 task.** Inductive reasoning is typically untimed. 60 s is a soft cap — with only 3 rounds, a total 180 s session is tight. DECISION-POINT: Education slot may choose to drop the timer entirely, keeping Bloom-pure semantics.
- **WARNING — Single round per rule.** With only one target cluster per rule, a student who guesses wrongly has no second chance to test the same rule. Acceptable for a short session, but if miscomprehension is broad we may want 2 targets per rule.
- **WARNING — Overlapping-circle geometry on small viewports.** Each cluster is a 2×2 composite of overlapping circles. On 375px viewport this must shrink gracefully. Use SVG so vectors scale without pixelation.
- **WARNING — Rule ambiguity.** The 2-example worked-rule design can be under-determined (several rules fit both examples). Target values are hand-designed so that only the *intended* rule produces an integer answer; tests should verify each round has a single correct value.
- **WARNING — Numeric-only input.** Input is filtered to digits only. Negative signs are rejected (per p07-input-behaviors); all answers in this game are positive integers.
