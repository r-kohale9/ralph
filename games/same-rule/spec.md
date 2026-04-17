# Game Design: Same Rule?

## Identity
- **Game ID:** same-rule
- **Title:** Same Rule?
- **Class/Grade:** Class 5 / Grade 5
- **Math Domain:** Ratio & Proportion
- **Topic:** Ratio intuition — recognizing a multiplicative "for every X, Y" relationship and distinguishing it from additive difference
- **Bloom Level:** L2 Understand
- **Archetype:** No-Penalty Explorer (#9), with two-step composite interaction per round

## One-Line Concept
The student compares two real-world scenes stacked vertically, decides whether both obey the same "for every A, there are B" rule, then states that rule by filling two number pickers — building the habit of multiplicative (ratio) thinking over additive (difference) thinking.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Ratio recognition | See a scene and name the "for every A, B" rule it follows | A, B, C |
| Ratio equivalence | Judge whether two scenes follow the same multiplicative rule | A, B, C |
| Additive-vs-multiplicative discrimination | Reject "same difference = same rule" reasoning | B |
| Rule generation | Produce a ratio statement from a single scene before comparison | C |

## Core Mechanic

The game uses ONE compound interaction per round, implemented as two sequential steps. The order of the steps flips between Stages 1–2 and Stage 3.

### Type A: Same / Different Judge (Stages 1–2)
1. **What the student sees:** Scene A at top (items arranged on a themed background), scene B below it once it slides in, labels describing each scene, and two buttons: "Same Rule" and "Different Rule".
2. **What the student does:** Taps one button (MCQ single-select, binary).
3. **What counts as correct:** The button matches `round.sameRule` (boolean).
4. **What feedback plays:** SFX (awaited) → dynamic TTS subtitle + sticker (awaited). On correct: items in both scenes animate into groups with a soft glow. On wrong: the correct grouping animates gently without a red X, then TTS explains.

### Type B: State the Rule (sentence builder)
1. **What the student sees:** Both scenes remain visible at the top (compressed). A sentence template slides up from the bottom: `For every ___ [thingA], there are ___ [thingB].` Two tappable +/− steppers, each bound to a number 1–9 (initial value 1). Thing names are pre-filled from round context. A "Check" button is enabled when both numbers are > 0.
2. **What the student does:** Taps +/− to set each number, then taps "Check".
3. **What counts as correct:** Both numbers match `round.canonicalRule.a` and `round.canonicalRule.b` in their simplest form (the stored rule is already reduced).
4. **What feedback plays:** SFX (awaited) → dynamic TTS with subtitle + sticker (awaited). Correct: celebration sticker + voice line reading back the rule. Wrong: the correct values tick into place on the pickers, a sad (but kind) sticker, and an explanation TTS.

### Type C: Kid-Leads (Stage 3 only)
Same two building blocks (Type A and Type B), but reordered:
1. Scene A appears alone.
2. Type B runs first: student states the rule for Scene A.
3. Scene B slides in.
4. Type A runs: student judges Same / Different.
5. Feedback for Type A then rolls directly into the stage-summary feedback line.

**Validation for Type C's Type-B step:** The stated rule is judged against Scene A's simplified ratio only. Once Scene B appears, the correctness of the Same/Different decision follows the standard rule.

## Rounds & Progression

### Stage 1 — Easy Matches (Rounds 1–3) — Type A (Scene A → Scene B → Judge → Rule)
- All three rounds have `sameRule: true` with small integer multipliers (x2).
- Ratios include 1 as one component (2:1, 3:1, 2:1) to anchor the "unit" reading.
- Contexts: cookies/milk, flowers, fish tank.
- Wrong path: student picks "Different Rule" when the scaled version was correct → misconception `MISC-RATIO-02 scale-changes-rule`.

### Stage 2 — The Additive Trap (Rounds 4–7) — Type A
- 2 rounds have `sameRule: true`; 2 have `sameRule: false`.
- Differences are intentionally misleading: some trap rounds share the SAME difference but a DIFFERENT ratio; others have DIFFERENT differences but the SAME ratio.
- Contexts: park animals, kitchen jars, beads, classroom.
- Round 4 flag `additiveTrap: true` — same difference (+2), ratio changes 3:1 → 5:3.
- Round 5 flag `additiveTrap: true` — different difference (+1 vs +2), ratio holds 2:3.
- Round 6 flag `additiveTrap: true` — same difference (+1), ratio changes 2:1 → 4:3.
- Round 7 flag `additiveTrap: true` — differences jump 3 → 9, ratio holds 1:4.
- Wrong path targets `MISC-RATIO-01 additive-thinking-instead-of-multiplicative`.

### Stage 3 — Kid Leads (Rounds 8–10) — Type C (Scene A → Rule → Scene B → Judge)
- Student must produce the rule BEFORE Scene B is shown (generation rather than recognition).
- Round 8: 6 sunflowers / 3 pots → 9 / 3 (rule changes 2:1 → 3:1, `sameRule: false`).
- Round 9: 2 sugar / 5 water → 4 / 10 (rule holds 2:5, `sameRule: true`).
- Round 10: 3 red threads / 2 white → 9 / 6 (rule holds 3:2, `sameRule: true`).
- Contexts: gardening, cooking (lemonade), weaving.

### Difficulty Summary

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Role of ratio | Recognize a known unit rate | Distinguish ratio from difference | Generate a rule, then test it |
| Multiplier | x2 | x2, x3, non-integer (5:3, 4:3) | x1.5, x2, x3 |
| Ratio form | A:1 | A:B where B > 1 | A:B where either can be the larger term |
| Answer distribution | 100% "Same Rule" | 50% "Same", 50% "Different" (all trap-coded) | 33% "Same" in R8; 100% "Same" in R9–R10 |
| Step order | Scene A → Scene B → Judge → Rule | Same as Stage 1 | Scene A → Rule → Scene B → Judge |
| Cognitive demand | Recognition | Discrimination against additive trap | Generation + verification |

## Game Parameters
- **Rounds:** 10
- **Timer:** None
- **Lives:** 0 (No-Penalty Explorer; definitional)
- **Star rating:**
  - 3 stars = 8–10 rounds correct AND at least 3 of the 4 Stage-2 trap rounds (4, 5, 6, 7) correct
  - 2 stars = 5–7 rounds correct, OR 8–10 with fewer than 3 trap rounds correct
  - 1 star = 1–4 rounds correct
  - 0 stars = 0 rounds correct (shown as "Keep going!" — no shame framing)
- **Input:** (a) MCQ single-select (Same / Different buttons), (b) two +/− numeric steppers (range 1–9) + Check button
- **Feedback:** FeedbackManager sequential SFX → dynamic TTS with subtitle + sticker per decision point; grouping animation on correct Judge; extended explanation TTS on `additiveTrap: true` rounds

## Scoring
- **Points:** A round scores +1 only if BOTH the Judge step AND the Rule step are answered correctly on the first attempt. Score is stored on `gameState.score`.
- **Stars:** Thresholds as listed under Game Parameters. The "trap-aware" 3-star gate is evaluated in `endGame()` against `gameState.trapCorrectCount`.
- **Lives:** No lives. There is no `game_over` screen (per archetype Rule #5 — `lives: 0` means no `game_over` state).
- **Partial credit:** None on score, but UX still shows correct feedback for each step independently so the student always sees the full "for every" rule acted out.

## Flow

**Shape:** Multi-round (default) + customizations.

**Changes from default:**
- Each "Round N" screen runs a two-phase internal state machine inside the Game node: `scene-reveal → judge → rule-builder → feedback` for Stages 1–2, and `scene-a-reveal → rule-builder → scene-b-reveal → judge → feedback` for Stage 3.
- Stage transitions (Round 3 → 4 and Round 7 → 8) insert a short section-intro transition screen announcing "Stage N" (delta from flow-gallery — sectioned-intro pattern), since the mechanic flips at Stage 3.
- Victory → "Yay, stars collected!" branch is retained. No "Play Again" replay path is removed — default retained.
- No `game_over` branch. The diagram's "Game Over" and "Try Again" nodes are unreachable and MUST be omitted at build time.

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌─────────────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)          │
│ 🔊 prev  │        │ 🔊 welc. │        │ (trans.,     │         │   Stages 1–2:           │
│   audio  │        │    VO    │        │  no buttons) │         │   scene-A → scene-B     │
└──────────┘        └──────────┘        │ 🔊 "Round N" │         │     → judge → rule      │
                                        └──────────────┘         │   Stage 3:              │
                                                ▲                │   scene-A → rule        │
                                                │                │     → scene-B → judge   │
                                                │                │ 🔊 SFX + TTS per step   │
                                                │                └──────────┬──────────────┘
                                                │                           │ 2 steps done
                                                │                           ▼
                                                │            ┌──────────────────────────────┐
                                                │            │ Feedback (2s, same screen)   │
                                                │            │ ✓ 🔊 correct + grouping anim │
                                                │            │ ✗ 🔊 neutral + show rule     │
                                                │            │   (+ extra TTS if trap)      │
                                                │            └──────────┬───────────────────┘
                                                │                       │
                                                │            ┌──────────┴─────────────┐
                                                │            │                        │
                                                │  correct OR wrong   last round done
                                                │  AND more rounds    ▼
                                                │            │  ┌────────────────────┐
                                                └────────────┘  │ Victory (status)   │
                                                                │ 0–3★               │
                                                                │ 🔊 sound_game_     │
                                                                │    victory →       │
                                                                │    vo_victory_     │
                                                                │    stars_N         │
                                                                └──────┬─────┬───────┘
                                                                       │     │
                                                          "Play Again" │     │ "Claim Stars"
                                                          (only 0–2 ★) │     │
                                                                       ▼     ▼
                                                     ┌──────────────────┐  ┌──────────────────────┐
                                                     │ "Ready to        │  │ "Yay, stars          │
                                                     │  improve your    │  │  collected!"         │
                                                     │  score?"         │  │ (trans., auto,       │
                                                     │ 🔊 motivation VO │  │  no buttons)         │
                                                     └────────┬─────────┘  └──────────┬───────────┘
                                                              │ tap                   │ auto
                                                              ▼                       ▼
                                                     restart from Round 1           exit
                                                     (skips Preview + Welcome)

         ┌──────────────────────────────────┐
  Stage  │ Between Round 3 → 4 and 7 → 8:   │
 flip ── │ auto "Stage N" transition screen │
         │ 🔊 section-intro VO              │
         └──────────────────────────────────┘
```

## Feedback

| Event | Behavior |
|-------|----------|
| Round start (Type A order) | Scene A slides in with reveal chime (`sound_new_content`). After ~900ms, Scene B slides in with whoosh. Judge buttons fade in. |
| Round start (Type C order) | Scene A slides in with reveal chime. After a short beat, rule-builder slides up. |
| Judge correct | Input blocked. Selected button turns green. Grouping animation on both scenes (items cluster into ratio-sized groups, gentle glow). SFX `sound_correct` (awaited) → TTS + subtitle + celebration sticker (awaited): e.g., "Yes! Both follow 'for every 2 cookies, 1 glass of milk'." Input unblocks. Proceeds to Rule step. |
| Judge wrong | Input blocked. Selected button flashes soft amber (NOT red). SFX `sound_neutral_soft` (awaited) → TTS + subtitle + thinking sticker (awaited): e.g., "Let's look again — Scene A is 'for every 2, 1'; Scene B is 'for every 4, 3'. Different rule." Correct button highlights. Proceeds to Rule step. Answer still counted as a miss for scoring. |
| Rule correct | Input blocked. Sentence locks in. SFX `sound_correct_melodic` (awaited) → TTS + subtitle + star sticker (awaited): reads the full sentence back. |
| Rule wrong | Input blocked. Correct numbers tick into place on the steppers with picker-tick SFX. SFX `sound_neutral_soft` (awaited) → TTS + subtitle + kind sticker (awaited): "Close — in this scene it's 'for every 2 jars of rice, 3 jars of dal'." |
| Additive trap round (any step wrong, `additiveTrap: true`) | After the standard wrong-feedback TTS, append a second awaited TTS with `insight-bell` SFX and a callout overlay: "Notice: both had {diff} more of one kind. But the 'for every' rule was different — the difference can trick you." Extended explanation drawn from `round.explanation`. |
| Complete round (both correct) | +1 to score. Progress bar advances with correct-tick animation. After a 1.2s beat, round transitions to next. |
| Stage transition (after round 3 and round 7) | Brief auto-advancing transition screen: "Stage 2 — The Trap" / "Stage 3 — Your Turn" with section-intro VO. Auto-advances after audio ends. |
| Complete all rounds | Timer N/A (no timer). `game_complete` postMessage sent. Results screen renders FIRST with star tier + summary "You spotted the 'for every' rule {correctCount} out of 10 times!". THEN victory SFX → dynamic VO per star tier. CTA visible and interruptible. |
| Replay / Play Again | Resets all state including `gameState.trapCorrectCount`. Routes through "Ready to improve your score?" per default flow. |
| Visibility hidden / restored | Standard FeedbackManager pause/resume per feedback/SKILL.md Cases 14–15. No timer to pause. |

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction:
    '<p><b>Same Rule?</b> Look at two pictures and decide if they follow the same <b>"for every"</b> rule. Then fill in the rule yourself!</p>',
  previewAudioText:
    'You will see two pictures. Decide if they follow the same "for every" rule. Then tell me the rule by filling in the two numbers.',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    // ───────── Stage 1: Easy Matches ─────────
    {
      round: 1,
      stage: 1,
      type: 'A',
      ruleFirst: false,
      additiveTrap: false,
      sceneA: {
        label: "Ria's snack plate",
        items: [
          { emoji: '🍪', count: 2, role: 'A' },
          { emoji: '🥛', count: 1, role: 'B' }
        ]
      },
      sceneB: {
        label: "Ria's party plate",
        items: [
          { emoji: '🍪', count: 4, role: 'A' },
          { emoji: '🥛', count: 2, role: 'B' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 2, thingA: 'cookies', b: 1, thingB: 'glass of milk' },
      explanation:
        "Same rule — both say 'for every 2 cookies, 1 glass of milk'. Scene B is just bigger.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-02 scale-changes-rule',
        rule_1_2: 'MISC-RATIO-03 ratio-reversed',
        rule_4_2: 'MISC-RATIO-04 used-raw-counts-not-simplified'
      }
    },
    {
      round: 2,
      stage: 1,
      type: 'A',
      ruleFirst: false,
      additiveTrap: false,
      sceneA: {
        label: 'Small flower bed',
        items: [
          { emoji: '🌹', count: 3, role: 'A' },
          { emoji: '🌻', count: 1, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Bigger flower bed',
        items: [
          { emoji: '🌹', count: 6, role: 'A' },
          { emoji: '🌻', count: 2, role: 'B' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 3, thingA: 'red flowers', b: 1, thingB: 'yellow flower' },
      explanation:
        "Same rule — both beds follow 'for every 3 red flowers, 1 yellow flower'.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-02 scale-changes-rule',
        rule_1_3: 'MISC-RATIO-03 ratio-reversed',
        rule_6_2: 'MISC-RATIO-04 used-raw-counts-not-simplified'
      }
    },
    {
      round: 3,
      stage: 1,
      type: 'A',
      ruleFirst: false,
      additiveTrap: false,
      sceneA: {
        label: 'Small fish tank',
        items: [
          { emoji: '🐠', count: 4, role: 'A' },
          { emoji: '🐟', count: 2, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Bigger fish tank',
        items: [
          { emoji: '🐠', count: 4, role: 'A' },
          { emoji: '🐟', count: 5, role: 'B' }
        ]
      },
      sameRule: false,
      canonicalRule: { a: 2, thingA: 'orange fish', b: 1, thingB: 'blue fish' },
      explanation:
        "Different rule — Scene A is 'for every 2 orange, 1 blue', but the big tank has more blues than oranges.",
      misconception_tags: {
        judge_same: 'MISC-RATIO-05 ignored-second-scene',
        rule_4_2: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_1_2: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    // ───────── Stage 2: The Additive Trap ─────────
    {
      round: 4,
      stage: 2,
      type: 'A',
      ruleFirst: false,
      additiveTrap: true,
      sceneA: {
        label: 'Park bench',
        items: [
          { emoji: '🐦', count: 3, role: 'A' },
          { emoji: '🐿️', count: 1, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Bigger park',
        items: [
          { emoji: '🐦', count: 5, role: 'A' },
          { emoji: '🐿️', count: 3, role: 'B' }
        ]
      },
      sameRule: false,
      canonicalRule: { a: 3, thingA: 'birds', b: 1, thingB: 'squirrel' },
      explanation:
        "Both had 2 more birds than squirrels — but the 'for every' rule changed! Small park is 'for every 3 birds, 1 squirrel'. Big park is different.",
      misconception_tags: {
        judge_same: 'MISC-RATIO-01 additive-thinking-instead-of-multiplicative',
        rule_2_2: 'MISC-RATIO-06 used-difference-as-rule',
        rule_1_3: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    {
      round: 5,
      stage: 2,
      type: 'A',
      ruleFirst: false,
      additiveTrap: true,
      sceneA: {
        label: 'Kitchen shelf',
        items: [
          { emoji: '🍚', count: 2, role: 'A' },
          { emoji: '🫘', count: 3, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Bigger shelf',
        items: [
          { emoji: '🍚', count: 4, role: 'A' },
          { emoji: '🫘', count: 6, role: 'B' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 2, thingA: 'jars of rice', b: 3, thingB: 'jars of dal' },
      explanation:
        "The difference changed (1 vs 2) — but the 'for every' rule stayed the same! Both are 'for every 2 jars of rice, 3 jars of dal'.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-01 additive-thinking-instead-of-multiplicative',
        rule_4_6: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_3_2: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    {
      round: 6,
      stage: 2,
      type: 'A',
      ruleFirst: false,
      additiveTrap: true,
      sceneA: {
        label: 'Friendship bracelet',
        items: [
          { emoji: '🟡', count: 2, role: 'A' },
          { emoji: '⚫', count: 1, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Necklace',
        items: [
          { emoji: '🟡', count: 4, role: 'A' },
          { emoji: '⚫', count: 3, role: 'B' }
        ]
      },
      sameRule: false,
      canonicalRule: { a: 2, thingA: 'gold beads', b: 1, thingB: 'black bead' },
      explanation:
        "Both had 1 more gold than black — but the 'for every' rule changed. Bracelet is 'for every 2 gold, 1 black'. Necklace doesn't follow that.",
      misconception_tags: {
        judge_same: 'MISC-RATIO-01 additive-thinking-instead-of-multiplicative',
        rule_4_3: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_1_2: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    {
      round: 7,
      stage: 2,
      type: 'A',
      ruleFirst: false,
      additiveTrap: true,
      sceneA: {
        label: 'Small classroom',
        items: [
          { emoji: '🪑', count: 4, role: 'B' },
          { emoji: '📚', count: 1, role: 'A' }
        ]
      },
      sceneB: {
        label: 'Bigger classroom',
        items: [
          { emoji: '🪑', count: 12, role: 'B' },
          { emoji: '📚', count: 3, role: 'A' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 1, thingA: 'table', b: 4, thingB: 'chairs' },
      explanation:
        "The differences looked very different (3 vs 9) — but the 'for every' rule held. Both are 'for every 1 table, 4 chairs'.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-01 additive-thinking-instead-of-multiplicative',
        rule_3_12: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_4_1: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    // ───────── Stage 3: Kid Leads ─────────
    {
      round: 8,
      stage: 3,
      type: 'C',
      ruleFirst: true,
      additiveTrap: false,
      sceneA: {
        label: 'Garden display',
        items: [
          { emoji: '🌻', count: 6, role: 'A' },
          { emoji: '🪴', count: 3, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Fuller display',
        items: [
          { emoji: '🌻', count: 9, role: 'A' },
          { emoji: '🪴', count: 3, role: 'B' }
        ]
      },
      sameRule: false,
      canonicalRule: { a: 2, thingA: 'sunflowers', b: 1, thingB: 'pot' },
      explanation:
        "Scene A's rule is 'for every 2 sunflowers, 1 pot'. But Scene B is 'for every 3 sunflowers, 1 pot'. Different!",
      misconception_tags: {
        judge_same: 'MISC-RATIO-05 ignored-second-scene',
        rule_6_3: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_1_2: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    {
      round: 9,
      stage: 3,
      type: 'C',
      ruleFirst: true,
      additiveTrap: false,
      sceneA: {
        label: 'Lemonade recipe',
        items: [
          { emoji: '🥄', count: 2, role: 'A' },
          { emoji: '💧', count: 5, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Double batch',
        items: [
          { emoji: '🥄', count: 4, role: 'A' },
          { emoji: '💧', count: 10, role: 'B' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 2, thingA: 'spoons of sugar', b: 5, thingB: 'cups of water' },
      explanation:
        "Scene A's rule is 'for every 2 spoons of sugar, 5 cups of water'. Scene B is the same rule, just doubled.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-02 scale-changes-rule',
        rule_4_10: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_5_2: 'MISC-RATIO-03 ratio-reversed'
      }
    },
    {
      round: 10,
      stage: 3,
      type: 'C',
      ruleFirst: true,
      additiveTrap: false,
      sceneA: {
        label: 'Loom pattern',
        items: [
          { emoji: '🟥', count: 3, role: 'A' },
          { emoji: '⬜', count: 2, role: 'B' }
        ]
      },
      sceneB: {
        label: 'Bigger weave',
        items: [
          { emoji: '🟥', count: 9, role: 'A' },
          { emoji: '⬜', count: 6, role: 'B' }
        ]
      },
      sameRule: true,
      canonicalRule: { a: 3, thingA: 'red threads', b: 2, thingB: 'white threads' },
      explanation:
        "Scene A's rule is 'for every 3 red threads, 2 white threads'. Scene B follows the same rule at triple the size.",
      misconception_tags: {
        judge_different: 'MISC-RATIO-02 scale-changes-rule',
        rule_9_6: 'MISC-RATIO-04 used-raw-counts-not-simplified',
        rule_2_3: 'MISC-RATIO-03 ratio-reversed'
      }
    }
  ]
};
```

### Misconception Tag Glossary (new tags introduced for ratio intuition)
- `MISC-RATIO-01 additive-thinking-instead-of-multiplicative` — student uses difference (A − B) to judge "same rule" instead of the multiplicative ratio. Primary learning target of Stage 2.
- `MISC-RATIO-02 scale-changes-rule` — student believes a scaled-up scene (x2, x3) no longer follows the original rule.
- `MISC-RATIO-03 ratio-reversed` — student states the rule with A and B swapped (e.g., "for every 1 glass of milk, 2 cookies" instead of "for every 2 cookies, 1 glass of milk"). Order matters because the sentence template is directional.
- `MISC-RATIO-04 used-raw-counts-not-simplified` — student types the raw counts from Scene A (or B) into the sentence instead of the simplified ratio.
- `MISC-RATIO-05 ignored-second-scene` — student judges "same rule" based on Scene A alone, without comparing to Scene B (common in Stage 3 after generating the rule).
- `MISC-RATIO-06 used-difference-as-rule` — student fills the sentence with the additive difference numbers (e.g., typing "2" and "2" because both differences were 2).

## Defaults Applied
- **Archetype:** defaulted to No-Penalty Explorer (#9) based on Bloom L2 + explicit "low-stakes, exploratory" + lives = 0 in creator description.
- **Timer:** defaulted to None (creator did not specify; No-Penalty Explorer default).
- **Lives:** defaulted to 0 (creator specified "None — low-stakes, exploratory"; matches archetype default).
- **Bloom Level:** defaulted to L2 Understand (creator did not specify a Bloom level explicitly; classification of ratio equivalence is an L2 hallmark per `pedagogy/reference/bloom-mapping.md`).
- **Feedback style:** defaulted to FeedbackManager sequential SFX → dynamic TTS with subtitle + sticker per `feedback/SKILL.md` single-step defaults; creator described feedback intent but not platform mechanics.
- **Visual asset style:** defaulted to emoji-based scene tokens (creator said "illustrated scenes"; swapped to emoji for v0 reliability — no image asset pipeline required).
- **Number picker UI:** defaulted to +/− steppers (creator said "number pickers 1–9"; steppers chosen over scroll wheels for testability with Playwright per `game-testing/SKILL.md`).
- **Stage-transition screens:** defaulted to auto-advancing section intros (creator did not specify; mechanic flip at Stage 3 warrants a visual checkpoint).
- **Scoring formula:** per-round binary on BOTH steps combined (creator said "Star rating at the end based on accuracy" without defining per-round scoring; chose "both steps must be correct" so scoring reflects full skill, not partial attention).
- **Star threshold modifier:** 3-star gate requires ≥3 of 4 trap rounds correct (directly from creator's spec).
- **Mobile-first layout:** per `mobile/SKILL.md` defaults (44px min targets, dvh viewport, single-column vertical stack).
- **Language:** defaulted to English.
- **Replay path:** default "Ready to improve your score?" → Round 1 (skips Preview + Welcome) retained.

## Warnings
- **WARNING: Non-standard two-step interaction per round.** No-Penalty Explorer canonical examples are single-select MCQ. This game runs MCQ THEN number-picker per round, with Stage 3 flipping the order. Downstream game-building skill must treat each step as its own `isProcessing` gate, its own `recordAttempt` call, and its own feedback cycle. Builder should NOT try to collapse both into one attempt record.
- **WARNING: New misconception taxonomy.** Six new `MISC-RATIO-*` tags are introduced that are not currently listed in `pedagogy/reference/misconceptions.md`. The pedagogy reference file must be updated to include these tags before analytics queries can attribute student errors to them cleanly.
- **WARNING: 10 rounds is one above the archetype default of 9.** Creator explicitly specified 10; kept as-is. Session length remains well within the <12-round guideline.
- **WARNING: Judge wrong does not skip the Rule step.** The student sees the correct "same/different" answer highlighted, then is still required to state the rule. This is intentional pedagogy (the sentence-building is the skill anchor) but is atypical — the student can lose the Judge and still win +1 only if they also correctly state the Rule. Scoring is joint-correct only.
- **WARNING: `role: 'A' | 'B'` in scene items.** The ordering of `items` in a scene does not necessarily match the canonical rule's (a, b) ordering. The `role` field tells the renderer which item group maps to `canonicalRule.a` vs `canonicalRule.b` so the sentence-builder's pre-filled thing names are correct. Builder must respect `role`, not array index (see round 7 where chairs are listed with `role: 'B'` despite appearing first visually).
- **WARNING: Stage 3 `ruleFirst: true` changes which step records attempts first.** `recordAttempt` sequencing in Stage 3 is (rule-step, judge-step) rather than (judge-step, rule-step). Test plan must cover both orderings.
- **WARNING: No `game_over` screen.** Per No-Penalty Explorer archetype Rule #5. Builder must omit `game_over` from the screen state machine entirely — if it is included, static validation will fail (unreachable screen).
