# Game Design: Age Matters — Age Logic Word Problems

## Identity

- **Game ID:** age-matters
- **Title:** Age Matters — Age Logic Word Problems
- **Class/Grade:** Class 5-7 (Grade 5-7) — flagged in Defaults Applied; concept silent on grade. Age word-problems with single-variable relational statements map well to pre-algebra (Class 6-7 NCERT "Simple Equations" / Class 5 "Ways to Multiply & Divide" puzzles).
- **Math Domain:** Pre-Algebra / Algebraic Reasoning (relational age puzzles)
- **Topic:** Relative-age word problems — interpret past/future/relative-age clues delivered via character speech bubbles, solve each character's **current age** in whole-number years, and type both ages into separate input fields.
- **Bloom Level:** L3 Apply — student must translate each English clue into an age equation, then solve the resulting simultaneous system. This is not recall (L1) or explanation (L2); it is procedural application of algebraic reasoning.
- **Archetype:** Lives Challenge (#3) — rounds-based, 3 lives, wrong submission costs a life, multi-field numeric input, MCQ-class feedback (correct SFX+TTS, wrong SFX+TTS+show-correct). L3 default is 3 lives per pedagogy/game-archetypes.
- **NCERT Alignment:** NCERT Class 6 "Simple Equations" (translating word statements into linear equations) and Class 5 "Ways to Multiply & Divide" puzzle chapters — age problems are a canonical application.

## One-Line Concept

Students read two character speech bubbles giving past/future/relative-age clues, work backwards to each character's current age, and type both whole-number ages into side-by-side input fields before tapping CHECK — lose a life for any wrong submission, win by getting every round right in 3 attempts total.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Reading comprehension | Parse short clue sentences mixing tense ("was", "will be"), time offsets ("4 years ago", "in 2 years"), and multiplicative relations ("three times as old as"). | All rounds |
| Algebraic translation | Turn each clue into a linear equation in the characters' current ages (e.g., "I was 12 four years ago" -> a - 4 = 12). | All rounds |
| System solving | Combine two clues (each about a different character) into a small simultaneous system and back-solve each current age. | All rounds |
| Numeric input | Type a whole-number age into the correct field for each character; submit both as one CHECK. | All rounds |
| Careful reading | Distinguish between clues about **current** age vs **shifted** age (4 years ago / in 2 years), a known misconception trap. | All rounds |

---

## Core Mechanic

Single interaction type across all rounds — **multi-field text/number input (P7)** with check-on-submit. Each round has exactly 2 character cards, 2 speech-bubble clues, and 2 labelled input fields (one per character). CHECK button submits both ages as one action.

### Type A: "Two-character age logic" (All rounds)

1. **Student sees:**
   - Clue area with 2 character rows (mirrored layout per spec):
     - Row 1: character avatar + "Name" label on one side, a vivid purple-oval speech bubble on the other side reading the character's clue.
     - Row 2: mirrored — the second character's speech bubble on the opposite side from row 1, so the two bubbles visually face each other.
   - Question prompt line: "How old are [Name1] and [Name2] now?"
   - Two labelled input rows, each "[Name]'s age is [input]", right-aligned rectangular number input with thin border and "Type here" placeholder.
   - CHECK button below, disabled until BOTH inputs have a non-empty numeric value.
2. **Student does:** Taps each input, types a whole-number age using the numeric keyboard. Taps CHECK (or presses Enter while either field has focus with both fields filled) to submit.
3. **Correct criterion:** BOTH typed values match the pre-baked solution ages exactly. Every clue must evaluate true when the two typed ages are substituted.
4. **Feedback:** See § Feedback. Correct = green input flash + correct SFX + fire-and-forget TTS + auto-advance. Wrong = red input flash on the incorrect field(s) + -1 life + wrong SFX + fire-and-forget TTS showing the correct answer + retry the same round with inputs cleared. On last life wrong, advance to Game Over (standard Lives Challenge).

---

## Rounds & Progression

### Stage 1: Small absolute age + simple relation (Round 1)
- Round type: Type A.
- Clue mix: one **absolute** anchor ("I was N years old, M years ago") + one **past relational** ("in X years I will be k times as old as [other] was Y years ago").
- Ages: 14-20 range.
- Cognitive demand: translate one clue to get one age directly, substitute into the second to solve the other.

### Stage 2: Future anchor + past multiplicative (Round 2)
- Round type: Type A.
- Clue mix: one **future** anchor ("In X years I will be N years old") + one **past multiplicative** ("Y years ago I was k times as old as [other] is now").
- Ages: 10-18 range.
- Cognitive demand: subtract an offset for the anchor, substitute into a multiplicative equation.

### Stage 3: Past absolute + future multiplicative (Round 3)
- Round type: Type A.
- Clue mix: one **past** anchor ("Y years ago I was N years old") + one **future multiplicative** ("In X years I will be k times as old as [other] was Y years ago").
- Ages: 12-22 range.
- Cognitive demand: add/subtract offsets on both clues and resolve a multiplicative dependency.

### Summary Table

| Dimension | Stage 1 (R1) | Stage 2 (R2) | Stage 3 (R3) |
|-----------|--------------|--------------|--------------|
| Characters | Riya & Priya | Amit & Bharat | Kiran & Meera |
| Age range | 14-20 | 10-18 | 12-22 |
| Anchor tense | Past (was) | Future (will be) | Past (was) |
| Relational tense | Future + past | Past + current | Future + past |
| Multiplier | 3x | 2x | 3x |
| Target first-attempt rate | 65-75% | 55-65% | 45-55% |

---

## Game Parameters

- **Rounds:** 3 (one per concept variant B1/B2/B3). The source concept flags a metadata inconsistency ("B1 total_rounds=10, B2/B3 total_rounds=1"). Resolution: spec ships exactly **3 unique pre-baked rounds** (one per variant), which matches the "3 variants" block structure and gives enough sample to validate the mechanic while staying under a 3-minute session. Flagged in Warnings.
- **Timer:** None — L3 Apply word-problems need thinking time, not speed pressure.
- **Lives:** 3 (standard Lives Challenge default for L3).
- **Star rating:**
  - 3 stars = 3 rounds solved (score == 3)
  - 2 stars = 2 rounds solved (score == 2)
  - 1 star = 1 round solved (score == 1)
  - 0 stars = 0 rounds solved (score == 0)
- **Input:** Multi-field text/number input (P7). Each round has 2 input fields using `type="text" inputmode="numeric" pattern="[0-9]*"`, max 2 digits, autocomplete="off", 16px+ font-size.
- **Feedback:** FeedbackManager. Correct = awaited SFX + fire-and-forget TTS. Wrong (lives > 0) = awaited SFX + fire-and-forget TTS + inputs cleared, retry same round. Wrong on last life = standard wrong SFX awaited with 1500ms minimum, then Game Over.

---

## Scoring

- **Points:** +1 per round solved correctly (first or retry attempt — retry on same round is allowed as long as lives remain). Max 3.
- **Stars:** 3 / 2 / 1 / 0 matching score exactly (since there are only 3 rounds, the standard 90/66/33% thresholds degenerate to integers).
- **Lives:** 3 at start. Each wrong CHECK submission = -1 life. When lives reach 0 mid-round, Game Over fires (screen before audio, game_complete postMessage before audio).
- **Partial credit:** None at round level; if only one of the two inputs is correct, the round is still wrong and a life is lost. Telemetry records which field(s) were wrong in `recordAttempt.metadata`.

---

## Flow

**Shape:** Multi-round (default Lives Challenge) with these deltas:
1. **Multi-field submit on CHECK.** Submit is an explicit button tap OR Enter on either focused input; CHECK is disabled until both fields have a numeric value.
2. **Retry-same-round on wrong (while lives remain).** Wrong answer clears the inputs, keeps the student on the same round, decrements lives. Only advances on correct OR on last-life wrong (-> Game Over).
3. **Game Over branch present.** Lives = 3, so the "wrong AND lives == 0" edge routes to Game Over per archetype standard.

**Changes from default:**
- Submit is an explicit CHECK button tap (plus Enter keydown handler).
- Correct -> clear inputs + advance to next-round transition.
- Wrong (lives remain) -> decrement lives, clear inputs, red flash, stay on round.
- Wrong (last life) -> Game Over path.

```
[Preview Screen (PART-039)]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: 2 character rows + 2 input fields, CHECK disabled until both filled]
        |
        | tap CHECK (both fields numeric) OR Enter key on focused input
        v
[Validate both ages against solution]
        |
        +--> both correct --> Correct feedback (green, SFX + TTS)
        |                          |
        |                          v
        |                    [If N < 3: Round N+1 Transition]
        |                    [If N == 3: Victory / Results]
        |
        +--> at least one wrong --> life--
                  |
                  +--> lives > 0 --> Wrong feedback (red on wrong field(s), SFX + TTS)
                  |                        |
                  |                        v
                  |                  clear inputs, stay on same round
                  |
                  +--> lives == 0 --> Wrong feedback (SFX + TTS with Promise.all 1500ms)
                                            |
                                            v
                                      [Game Over screen]
                                            |
                                            v
                                      game_complete postMessage, game-over audio
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Input focused | Numeric keyboard opens (via inputmode="numeric"); input border highlights blue. No audio. |
| Character typed | Input value updates. CHECK button re-evaluates: enables only when both inputs non-empty. No audio. |
| CHECK pressed, both fields non-empty | `isProcessing = true` BEFORE any await. Call `input.blur()` on both inputs to dismiss keyboard. Validate both values against solution ages. |
| CHECK correct (both ages match) | Both inputs flash green. `progressBar.update(currentRound+1, lives)` FIRST. `recordAttempt(correct:true)` BEFORE audio. `await` correct SFX with celebrate sticker wrapped in Promise.all(1500ms min). Fire-and-forget TTS: "Great! [Name1] is [age1] and [Name2] is [age2]." Advance to next-round transition OR Victory. |
| CHECK wrong, lives > 0 | Wrong field(s) flash red; correct field(s) stay blue. `gameState.lives -= 1`, `progressBar.update(currentRound+1, lives)` FIRST. `recordAttempt(correct:false, misconception_tag)` BEFORE audio. `await` incorrect SFX with sad sticker wrapped in Promise.all(1500ms min). Fire-and-forget TTS: "Not quite. [hint or show the correct ages]." Clear both inputs. Stay on same round (isProcessing=false at end of handler so student can retry). |
| CHECK wrong, lives == 0 | Same as "wrong lives > 0" through recordAttempt + progressBar bump. `await` incorrect SFX + sad sticker wrapped in Promise.all(1500ms min). Then trigger Game Over path: render Game Over screen FIRST, send `game_complete` postMessage, then game-over SFX + dynamic TTS VO. |
| Enter key while inputs focused | If both fields have values, behaves exactly like CHECK tap. |
| Round complete (correct) | `progressBar.update` was already called first. Advance to next-round transition. |
| All 3 rounds solved (Victory) | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO sequence (awaited, CTA interruptible). Star count == score. |
| Game Over (lives == 0) | Game Over screen renders first; `game_complete` postMessage sent; game-over SFX + VO sequence awaited; "Try Again" CTA restarts game. |
| Try again / replay | Stop all audio; reset state; return to Round 1 transition (skip preview per canonical). |
| Visibility hidden | `VisibilityTracker` handles pause overlay. Audio + timers pause. |
| Visibility restored | State continues. |

### Misconception tag derivation (for recordAttempt on wrong CHECK)

Derive from which field(s) were wrong:

- **Both fields wrong** -> `both-ages-wrong` (generic — student did not attempt any correct algebra).
- **Only character-1 field wrong** -> either `shift-tense-ignored` (treated past clue as current) or `anchor-only` (solved the one with an absolute anchor and guessed the other).
- **Only character-2 field wrong** -> symmetric.
- **Values swapped between fields** -> `fields-swapped` (common on symmetric clue pairs).
- **Off-by-N (where N matches a time offset in clues)** -> `tense-offset-dropped` (forgot to add/subtract the offset).
- **Result is `k * x` where `x` is a correct age and `k` is a multiplier in a clue** -> `multiplier-not-inverted` (applied multiplier forwards when it should have been inverted).

These are surfaced in `recordAttempt.misconception_tag` for analytics.

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Find their ages!</b><br>Read both clues in the speech bubbles, then type each character\'s current age. Tap <b>CHECK</b> when both ages are filled in.</p>',
  previewAudioText: 'Read both clues carefully, then type each character\'s current age. Tap CHECK when you are done.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ===================================================================
    // ROUND 1 — Stage 1 — Riya & Priya
    // Clue 1 (Riya, past absolute): "I was 12 years old, 4 years ago."
    //   => riya - 4 = 12 => riya = 16
    // Clue 2 (Priya, future + past multiplicative):
    //   "In two years, I will be three times as old as Riya was four years ago."
    //   => priya + 2 = 3 * (riya - 4) = 3 * 12 = 36 => priya = 34
    // Sanity: riya=16, priya=34. Both are valid whole-number ages; priya is older.
    // ===================================================================
    {
      round: 1,
      stage: 1,
      type: "A",
      characters: [
        {
          id: "riya",
          name: "Riya",
          avatarEmoji: "👧",
          avatarBg: "#F2994A",
          cluePosition: "right",  // bubble on right of avatar (B1: Riya clue sits right of her avatar)
          clue: "I was 12 years old, 4 years ago."
        },
        {
          id: "priya",
          name: "Priya",
          avatarEmoji: "👩",
          avatarBg: "#FFDE49",
          cluePosition: "left",   // bubble on left of avatar (B1: Priya clue sits left of her avatar; mirrored)
          clue: "In two years, I will be three times as old as Riya was four years ago."
        }
      ],
      questionPrompt: "How old are Riya and Priya now?",
      solution: { riya: 16, priya: 34 },
      misconception_tags: {
        "both-ages-wrong":          "Both inputs wrong; student did not translate either clue.",
        "shift-tense-ignored":      "Treated 'was 12 four years ago' as 'is 12 now'.",
        "anchor-only":              "Got Riya right but guessed Priya without using the clue.",
        "fields-swapped":           "Typed Riya in Priya's field and vice versa.",
        "tense-offset-dropped":     "Forgot to add/subtract the year offset.",
        "multiplier-not-inverted":  "Applied multiplier in the wrong direction."
      }
    },

    // ===================================================================
    // ROUND 2 — Stage 2 — Amit & Bharat
    // Clue 1 (Amit/Bharat boys; concept labels Bharat with the future clue):
    //   Bharat: "In four years, I will be 18 years old." => bharat = 14.
    // Clue 2 (Amit with past multiplicative):
    //   Actually per concept: "Two years ago, I was twice as old as Amit is now."
    //   The speaker is Bharat here too? Concept says both clues are per character:
    //     - "In four years, I will be 18 years old." (Amit's clue per concept = Amit? or Bharat?)
    //   Reading concept: "Amit (boy in orange shirt) & Bharat (boy in green shirt, arms outstretched) —
    //   'In four years, I will be 18 years old.' / 'Two years ago, I was twice as old as Amit is now.'"
    //   So Clue 1 (Amit): "In four years, I will be 18 years old." => amit + 4 = 18 => amit = 14.
    //   Clue 2 (Bharat): "Two years ago, I was twice as old as Amit is now."
    //     => bharat - 2 = 2 * amit = 2 * 14 = 28 => bharat = 30.
    // Sanity: amit=14, bharat=30. Valid whole-number ages.
    // ===================================================================
    {
      round: 2,
      stage: 2,
      type: "A",
      characters: [
        {
          id: "amit",
          name: "Amit",
          avatarEmoji: "👦",
          avatarBg: "#F2994A",
          cluePosition: "right",
          clue: "In four years, I will be 18 years old."
        },
        {
          id: "bharat",
          name: "Bharat",
          avatarEmoji: "🧒",
          avatarBg: "#219653",
          cluePosition: "left",
          clue: "Two years ago, I was twice as old as Amit is now."
        }
      ],
      questionPrompt: "How old are Amit and Bharat now?",
      solution: { amit: 14, bharat: 30 },
      misconception_tags: {
        "both-ages-wrong":          "Both inputs wrong; student did not translate either clue.",
        "shift-tense-ignored":      "Treated 'will be 18 in 4 years' as 'is 18 now'.",
        "anchor-only":              "Got Amit right but guessed Bharat.",
        "fields-swapped":           "Typed Amit in Bharat's field and vice versa.",
        "tense-offset-dropped":     "Forgot to add/subtract the year offset.",
        "multiplier-not-inverted":  "Applied 2x in the wrong direction."
      }
    },

    // ===================================================================
    // ROUND 3 — Stage 3 — Kiran & Meera
    // Clue 1 (Kiran, past absolute): "Two years ago, I was 11 years old." => kiran - 2 = 11 => kiran = 13.
    // Clue 2 (Meera, future multiplicative):
    //   "In four years, I will be three times as old as Kiran was two years ago."
    //   => meera + 4 = 3 * (kiran - 2) = 3 * 11 = 33 => meera = 29.
    // Sanity: kiran=13, meera=29. Valid whole-number ages.
    // ===================================================================
    {
      round: 3,
      stage: 3,
      type: "A",
      characters: [
        {
          id: "kiran",
          name: "Kiran",
          avatarEmoji: "👧",
          avatarBg: "#FFDE49",
          cluePosition: "right",
          clue: "Two years ago, I was 11 years old."
        },
        {
          id: "meera",
          name: "Meera",
          avatarEmoji: "👩",
          avatarBg: "#9B51E0",
          cluePosition: "left",
          clue: "In four years, I will be three times as old as Kiran was two years ago."
        }
      ],
      questionPrompt: "How old are Kiran and Meera now?",
      solution: { kiran: 13, meera: 29 },
      misconception_tags: {
        "both-ages-wrong":          "Both inputs wrong; student did not translate either clue.",
        "shift-tense-ignored":      "Treated 'was 11 two years ago' as 'is 11 now'.",
        "anchor-only":              "Got Kiran right but guessed Meera.",
        "fields-swapped":           "Typed Kiran in Meera's field and vice versa.",
        "tense-offset-dropped":     "Forgot to add/subtract the year offset.",
        "multiplier-not-inverted":  "Applied 3x in the wrong direction."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 5-7** (concept silent on grade). Age word-problems at this difficulty fit Class 6 NCERT "Simple Equations". Flagged in Warnings.
- **Bloom Level:** defaulted to **L3 Apply** (word-problem translation + equation solving is canonical L3).
- **Archetype:** **Lives Challenge (#3)** because L3 default is lives=3, and the mechanic (type-to-check with a right/wrong verdict per round) fits Lives Challenge cleanly.
- **Rounds:** **3** (one per concept variant B1/B2/B3). Concept flags a B1 total_rounds=10 inconsistency; choosing 3 unique pre-baked rounds as canonical. Flagged in Warnings.
- **Lives:** **3** (archetype default for L3).
- **Timer:** **None** (L3 word-problem default — no time pressure).
- **Input:** **Multi-field text/number input (P7)** per concept explicit description, two fields per round.
- **Feedback style:** **FeedbackManager** with standard playDynamicFeedback on correct/incorrect CHECK per skill/feedback defaults. Promise.all 1500ms minimum wrap on all answer-SFX.
- **Scaffolding:** defaulted to **show-correct-after-wrong** — the TTS line on wrong CHECK states the correct ages when lives reach 0 (Game Over reveal) and gives a method hint ("check the 4 years ago part") while lives remain.
- **Clue language:** English (platform default). Indian names used throughout to match student demographics.
- **Star thresholds:** score == 3/2/1/0 maps 1:1 to 3/2/1/0 stars since total rounds = 3.
- **Preview screen:** included (default `previewScreen: true` — PART-039).

---

## Warnings

- **WARNING — Round count resolves a concept inconsistency.** Concept metadata says "B1 total_rounds=10, B2=1, B3=1" — three variants of the same puzzle type. Spec resolves this by shipping exactly **3 rounds = one per variant** (total 3 distinct puzzles), NOT 10 copies of B1. This matches the "3 characters pairs" structure in the concept and keeps sessions under 3 minutes. DECISION-POINT: if Education slot prefers 10 rounds, duplicate the B1 puzzle 8 more times with different number values OR upgrade to a generator that randomises clue structure.
- **WARNING — Concept claims "3 characters" for B2/B3 in one reading.** Concept file is unambiguous: B2 = Amit & Bharat (2 chars), B3 = Kiran & Meera (2 chars). Every round is 2 characters. Spec aligns with the concept.
- **WARNING — L3 with lives.** Standard combination but verify with Education slot that 3 lives is appropriate for a 3-round session; if a student wrong-answers the same round 3 times in a row they hit Game Over on round 1 without completing the session.
- **WARNING — Numeric-only input.** Input validation rejects any non-digit (including leading/trailing spaces are trimmed; negative signs are stripped; decimals stripped to integer). Max 2 digits per field (ages 0-99). If student types a non-numeric character, it is stripped live via an `input` event listener.
- **WARNING — Enter key on 2-field form.** Pressing Enter while either input is focused submits the whole form. If only one field is filled, CHECK is still disabled and Enter is a no-op. This prevents the common "student pressed Enter with only one age filled" frustration.
- **WARNING — Multi-step ARITHMETIC misconception tags depend on value detection.** Misconception derivation is heuristic (field-wise wrongness, field-swap detection, offset-match detection). Analytics should be treated as directional, not authoritative.
- **WARNING — Field-swap detection is exact-match only.** If the student types `riya=34, priya=16` on round 1, the `fields-swapped` tag fires. Any near-swap (e.g., `riya=33, priya=16`) falls back to `both-ages-wrong`. This is acceptable for v1.
- **WARNING — Speech-bubble layout is mirrored per row per the concept.** Row 1 (character 1): avatar/label on one side, bubble on the other. Row 2 (character 2): mirrored. B1 canonical: Riya bubble-right, Priya bubble-left. Spec encodes this via `characters[i].cluePosition = 'left' | 'right'`. If a future variant prefers both bubbles on the same side, change only the per-character field.
