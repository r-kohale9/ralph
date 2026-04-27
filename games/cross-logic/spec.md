# Game Design: Cross-Logic Puzzle

## Identity
- **Game ID:** cross-logic
- **Title:** Cross-Logic Puzzle
- **Class/Grade:** Class 4-6 (ages 9-12)
- **Math Domain:** Logical Reasoning & Mathematical Thinking (cross-curricular foundation for algebra, set theory, and proof reasoning)
- **Topic:** Deductive reasoning via logic-grid cross-referencing (process of elimination, biconditional inference, contradiction detection)
- **Bloom Level:** L4 Analyze
- **Archetype:** Board Puzzle (#6)
- **totalRounds:** 6
- **totalLives:** 0

## One-Line Concept
The student fills a 3x4 logic grid with crosses and checks to deduce the unique pairing of three subjects with two two-category attributes, using the process of elimination on a small set of natural-language clues.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Negative deduction | Place ❌ in cells the clues directly forbid | Type A (clue-driven elimination) |
| Positive inference by elimination | Place ✅ in the only remaining cell of a row/column once others are crossed out | Type A |
| Biconditional reasoning | Use a positive pairing in one category (X likes Lions) to chain a deduction in another (X is from Japan, because the Lion-lover lives in Japan) | Type A |
| Contradiction detection | Recognize when two filled cells violate a clue and avoid that placement | Type A |
| Constraint propagation | Maintain consistency across the whole grid: in every row exactly one ✅, in every column-block exactly one ✅ | Type A |

## Core Mechanic

### Type A: "Tap-Cycle Logic Grid"

1. **What the student sees**
   - **Clue Panel** (top of play area): an ordered list of 2-4 short natural-language clues for the current puzzle (e.g., "Maya is not from Japan", "The Lion lover is from Japan"). Each clue is rendered as a numbered chip/card so it can be re-read at any time.
   - **Logic Grid** (center, dominant element): a 3-row x 4-column matrix.
     - Rows = the 3 SUBJECTS (left edge labels, e.g., student names).
     - Columns are split into **two attribute blocks of 2 columns each**: Block 1 = Attribute A's two values, Block 2 = Attribute B's two values. A vertical divider visually separates the two blocks.
     - Column headers show the attribute values (e.g., Lion, Elephant | India, Japan).
   - **Submit button** (bottom): "Check my solution" — disabled until every row contains exactly one ✅ in EACH attribute block (i.e., the student has committed to a complete pairing).
   - **Puzzle counter** (top-right): "Puzzle 2 of 6".

2. **What the student does (input type)**
   - Tap-cycle on each grid cell:
     - **First tap**: empty → ❌ (red cross, indicates "this pairing is impossible")
     - **Second tap**: ❌ → ✅ (green check, indicates "this pairing is true")
     - **Third tap**: ✅ → empty (clears the cell — used to fix mistakes)
   - The cycle is local to one cell; the grid does NOT auto-fill the rest of the row/column on a tap (the deduction work is the student's job — that is the pedagogy).
   - Tap the **"Check my solution"** button to commit. (The "Please wait" flash from the original description is preserved as a 600ms "Checking..." overlay so the student feels the system reasoning, then resolves to correct or wrong.)

3. **What counts as correct**
   - On Submit, the engine reads the ✅ cells and constructs the implied subject→attribute mapping.
   - Correct iff: (a) every row has exactly one ✅ in each of the two attribute blocks, AND (b) the resulting mapping satisfies every clue with no contradictions, AND (c) the mapping equals the puzzle's unique canonical solution.
   - Crosses are NOT scored — they are only the student's working. (Pedagogically, marking a cell as ❌ when it could be ✅ does not break the puzzle; only the final ✅ pattern matters.)

4. **What feedback plays**
   - **On Submit-correct:** "Checking..." overlay (~600ms) → CASE 6 (round-complete) SFX awaited with celebration sticker and subtitle "Puzzle solved!" → progressBar bumps → next puzzle transition.
   - **On Submit-wrong:** "Checking..." overlay (~600ms) → fail dialogue ("Oh no! That solution doesn't fit the clues.") → CASE 7 (wrong) SFX awaited with sad sticker → fire-and-forget dynamic TTS naming the violated clue (e.g., "Clue 2 says the Elephant lover is from Japan, but you marked Maya with Elephant AND with India.") → "Next" button enabled to advance to the next puzzle (per the source description, a wrong solution ends the puzzle — there is no in-puzzle retry).
   - **On in-puzzle cell tap (any of the three states):** CASE 9 micro-interaction SFX (soft bubble), fire-and-forget, no sticker, never blocks input.

## Rounds & Progression

### Stage 1: Two-Attribute Warmup (Rounds 1-2)
- Round type: A (Tap-Cycle Logic Grid)
- Difficulty parameters: 3 subjects, 2 attribute blocks of 2 values each (3x4 grid). 2 clues, both DIRECT-NEGATIVE form ("X is not Y"). Solution reachable by 2 elimination steps.
- Contexts/themes: Round 1 = students/animals/countries (the canonical theme from the source description, kept verbatim so the mechanic is taught with maximum familiarity). Round 2 = students/sports/snacks.

### Stage 2: Mixed Clue Forms (Rounds 3-4)
- Round type: A
- Difficulty parameters: Same 3x4 grid. 3 clues per puzzle, mixing DIRECT-NEGATIVE ("X is not Y") with DIRECT-POSITIVE ("X likes Y") and CROSS-CATEGORY ("The person who likes Y is from Z"). Solution requires 1 chained inference (use a positive pairing in one block to deduce in the other block).
- Contexts/themes: Round 3 = math-flavored — students/operation/result (e.g., students Aarav/Diya/Kiran, operations +/×, results 12/15) where each student "performed" a different operation on a small pair of numbers and the clues describe whose result equals which value. Round 4 = students/instruments/colors.

### Stage 3: Pure Cross-Category Inference (Rounds 5-6)
- Round type: A
- Difficulty parameters: Same 3x4 grid. 4 clues per puzzle, at least 2 of which are CROSS-CATEGORY and at least 1 is COMPOUND ("X is from Y OR likes Z, but not both" / "If A then B"). Solution requires 2+ chained inferences and at least one contradiction-avoidance step.
- Contexts/themes: Round 5 = math-flavored — students/shape/number-of-sides (e.g., students Meera/Rohan/Sara, shapes triangle/square, sides 3/4) — reinforces shape↔attribute reasoning. Round 6 = students/animals/countries again (same theme as Round 1, harder clue set, so the student feels the difficulty growth on identical surface content).

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Number of clues | 2 | 3 | 4 |
| Clue forms used | DIRECT-NEGATIVE only | DIRECT-NEGATIVE + DIRECT-POSITIVE + CROSS-CATEGORY | All Stage 2 forms + COMPOUND/conditional |
| Inference depth | 1-2 elimination steps | 1 chained inference across attribute blocks | 2+ chained inferences + contradiction-avoidance |
| Theme | Concrete (students/animals/countries) | Mixed concrete + math-flavored | Math-flavored + revisited concrete (harder) |

## Game Parameters
- **Rounds:** 6 (2 per stage)
- **Timer:** None
- **Lives:** 0 (each puzzle is binary solved/wrong; a wrong submission ends THAT puzzle and advances to the next — there is no game-wide life pool and no game_over screen)
- **Star rating:** 3 stars = 6/6 puzzles solved, 2 stars = 4-5/6 puzzles solved, 1 star = 1-3/6 puzzles solved, 0 stars = 0/6.
- **Input:** Tap-cycle on grid cells (3-state cycle: empty → ❌ → ✅ → empty). Tap "Check my solution" to submit. Tap "Next" on fail dialogue.
- **Feedback:** FeedbackManager (PART-017) — `playDynamicFeedback('correct')` on solve, `playDynamicFeedback('incorrect')` on wrong submission, soft bubble SFX on every cell tap, "Checking..." 600ms overlay between submit and resolution.

## Scoring
- Points: +1 per puzzle solved correctly on first (and only) submission. No partial credit (a puzzle is binary — the unique solution is found or it isn't).
- Stars: 3★ = 6 solved, 2★ = 4-5 solved, 1★ = 1-3 solved, 0★ = 0 solved.
- Lives: 0. Wrong submission does NOT end the game; it ends the current puzzle and advances to the next. Game ends after Round 6 regardless of solve count → results screen with star rating.
- Partial credit: None. Within a puzzle, marking some ❌ cells correctly but submitting a wrong ✅ pattern still scores 0 for that puzzle.

## Flow

**Shape:** Multi-round (default) + customizations
**Changes from default:**
- Replace per-round "wrong → lose a life → game_over at 0 lives" branch with "wrong → fail dialogue with Next button → advance to next puzzle". There is no game_over screen (lives=0).
- Replace the "Game Over" branch entirely (unreachable). Remove the "Try Again" → "Ready to improve your score?" loop from the Game Over side; the Victory-side "Play Again" / "Claim Stars" branches are preserved.
- Insert a 600ms "Checking..." overlay step inside the Feedback box, before the correct/wrong split (preserves the source-description "Please wait" flash).
- Round transition label rewritten from "Round N" to "Puzzle N of 6" (this game is puzzle-counted, not round-counted, per Board Puzzle archetype convention).

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Puzzle N of 6├────────▶│ Game       │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ (logic     │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │  grid)     │
│   audio  │        │    VO    │        │ 🔊 "Puzzle N"│         │ 🔊 prompt  │
└──────────┘        └──────────┘        └──────────────┘         └─────┬──────┘
                                                ▲                      │ student fills
                                                │                      │ grid + taps
                                                │                      │ "Check my
                                                │                      │  solution"
                                                │                      ▼
                                                │            ┌─────────────────────┐
                                                │            │ "Checking..."       │
                                                │            │ overlay (~600ms)    │
                                                │            └─────────┬───────────┘
                                                │                      │
                                                │       ┌──────────────┴──────────────┐
                                                │       │                             │
                                                │   correct                        wrong
                                                │       │                             │
                                                │       ▼                             ▼
                                                │ ┌──────────────────┐   ┌──────────────────────┐
                                                │ │ Feedback         │   │ Fail dialogue        │
                                                │ │ ✓ 🔊 sound_correct│   │ "Oh no! That        │
                                                │ │   + sticker      │   │  solution doesn't    │
                                                │ │   "Puzzle solved!"│   │  fit the clues."    │
                                                │ └─────────┬────────┘   │ ✗ 🔊 sound_incorrect │
                                                │           │            │ + TTS naming clue    │
                                                │           │            │ [Next] button        │
                                                │           │            └──────────┬───────────┘
                                                │           │                       │
                                                │           ├───────────────────────┤
                                                │           │                       │
                                                │      more puzzles            more puzzles
                                                │      remaining               remaining
                                                │           │                       │
                                                └───────────┴───────────────────────┘
                                                            │
                                                       last puzzle
                                                       resolved (correct OR wrong)
                                                            │
                                                            ▼
                                                  ┌────────────────────┐
                                                  │ Victory (status)   │
                                                  │ 1–3★               │
                                                  │ 🔊 sound_game_     │
                                                  │    victory →       │
                                                  │    vo_victory_     │
                                                  │    stars_N         │
                                                  └──────┬─────┬───────┘
                                                         │     │
                                            "Play Again" │     │ "Claim Stars"
                                            (only if     │     │
                                             1–2 ★)      ▼     ▼
                                   ┌──────────────────┐  ┌──────────────────────┐
                                   │ "Ready to        │  │ "Yay, stars          │
                                   │  improve your    │  │  collected!"         │
                                   │  score?"         │  │ (trans., auto,       │
                                   │ (trans., tap)    │  │  no buttons)         │
                                   │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                                   │ [I'm ready]      │  │    sound + ✨ star   │
                                   └────────┬─────────┘  │    animation         │
                                            │ tap        └──────────┬───────────┘
                                            ▼                       │ auto, after
                                   restart from Puzzle 1            │ animation / sound
                                   (skips Preview + Welcome)        ▼
                                                                   exit
```

## Feedback
| Event | Behavior |
|-------|----------|
| Cell tap (any state) | Soft bubble SFX, fire-and-forget, no sticker, no input block. Cell visual updates instantly to show next state in the cycle (empty → ❌ → ✅ → empty). If a TTS is currently playing, stop it (Case 9). |
| Submit tapped (any state) | "Checking..." overlay shows for ~600ms (preserves source-description "Please wait" flash). All grid cells disabled (`isProcessing=true`) BEFORE the await. After 600ms, resolve to correct or wrong path. |
| Submit blocked (incomplete grid) | Submit button stays disabled (greyed) until every row has exactly one ✅ in each attribute block. Tapping a disabled button does nothing (mobile rule 12). |
| Correct solution | "Checking..." clears → CASE 6 round-complete SFX awaited (~1s) with celebration sticker + subtitle "Puzzle solved!" → progressBar.update(currentRound, 0) fires FIRST (per cross-cutting rule 0) → 1500ms minimum visual lock → advance to next puzzle transition (or Victory if last puzzle). |
| Wrong solution | "Checking..." clears → fail dialogue overlay renders ("Oh no! That solution doesn't fit the clues.") → CASE 7 wrong SFX awaited (~1s) with sad sticker → fire-and-forget dynamic TTS naming the violated clue, e.g., "Clue 2 says the Elephant lover is from Japan, but your grid says Maya likes Elephant AND is from India." → "Next" button visible. |
| Next tapped (after wrong) | Stop all audio (`stopAll()` + `_stopCurrentDynamic()`), clear fail dialogue, progressBar.update fires (puzzle counted as attempted but not solved), advance to next puzzle transition (or Victory if last puzzle). |
| Complete all puzzles (Victory) | Render Victory screen FIRST (stars, "X of 6 solved", CTA). Send `game_complete` postMessage BEFORE audio. Then victory SFX → victory VO sequential, with stars-tier sticker. |
| Tab switch / screen lock (CASE 14) | Pause audio, freeze grid, show VisibilityTracker built-in pause overlay (popupComponent — never custom). Cell taps ignored while hidden. |
| Visibility restored (CASE 15) | Resume audio, re-enable grid, dismiss VisibilityTracker popup automatically. |

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><strong>Cross-Logic Puzzle:</strong> Read the clues at the top. Tap each grid cell to mark it: <span style="color:#d44">❌ (impossible)</span> on first tap, <span style="color:#2a8">✅ (true!)</span> on second tap, empty on third tap. Find the only solution that fits every clue, then tap <em>Check my solution</em>.</p>',
  previewAudioText: 'Read the clues. Tap each grid cell once for cross, twice for check, three times to clear. Find the one solution that fits every clue, then tap Check my solution.',
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: "A",
      theme: "students-animals-countries",
      subjects: { label: "Student", values: ["Maya", "Arjun", "Priya"] },
      attributeA: { label: "Animal", values: ["Lion", "Elephant", "Tiger"] },
      attributeB: { label: "Country", values: ["India", "Japan", "Brazil"] },
      // 3x6 grid columns: Lion, Elephant, Tiger | India, Japan, Brazil
      // For Stage 1 we keep the grid 3x4 by using 2 values per attribute (drop "Tiger" + "Brazil")
      // — see roundOverride below.
      roundOverride: {
        attributeA: { label: "Animal", values: ["Lion", "Elephant"] },
        attributeB: { label: "Country", values: ["India", "Japan"] }
      },
      clues: [
        "Maya is not from Japan.",
        "Arjun likes the Lion."
      ],
      // Canonical solution: Maya→Elephant→India, Arjun→Lion→Japan, Priya→???
      // With 3 students and only 2 attribute values per block, Priya cannot be
      // uniquely placed → upgrade to 2 students for puzzle 1 to keep it solvable.
      subjectsOverride: ["Maya", "Arjun"],
      solution: { Maya: { Animal: "Elephant", Country: "India" }, Arjun: { Animal: "Lion", Country: "Japan" } },
      misconception_tags: {
        "Maya-Lion": "ignored-direct-positive-clue",
        "Maya-Japan": "ignored-direct-negative-clue",
        "Arjun-Elephant": "ignored-direct-positive-clue",
        "Arjun-India": "failed-to-chain-cross-category"
      }
    },
    {
      round: 2,
      stage: 1,
      type: "A",
      theme: "students-sports-snacks",
      subjects: ["Riya", "Karan"],
      attributeA: { label: "Sport", values: ["Cricket", "Football"] },
      attributeB: { label: "Snack", values: ["Samosa", "Mango"] },
      clues: [
        "Riya does not play Football.",
        "The Cricket player eats Mango."
      ],
      solution: { Riya: { Sport: "Cricket", Snack: "Mango" }, Karan: { Sport: "Football", Snack: "Samosa" } },
      misconception_tags: {
        "Riya-Football": "ignored-direct-negative-clue",
        "Riya-Samosa": "failed-to-chain-cross-category",
        "Karan-Cricket": "ignored-direct-negative-clue-by-elimination",
        "Karan-Mango": "double-assigned-positive"
      }
    },
    {
      round: 3,
      stage: 2,
      type: "A",
      theme: "students-operation-result",
      subjects: ["Aarav", "Diya"],
      attributeA: { label: "Operation", values: ["Add", "Multiply"] },
      attributeB: { label: "Result", values: ["12", "35"] },
      clues: [
        "Aarav did not get 35.",
        "The student who multiplied got 35.",
        "Diya did not add."
      ],
      // Aarav: not 35 → Aarav got 12. Multiplier got 35 → Diya multiplied → Diya got 35.
      // Aarav added → Aarav: Add+12. Diya: Multiply+35.
      solution: { Aarav: { Operation: "Add", Result: "12" }, Diya: { Operation: "Multiply", Result: "35" } },
      misconception_tags: {
        "Aarav-35": "ignored-direct-negative-clue",
        "Aarav-Multiply": "failed-to-chain-positive-cross-category",
        "Diya-Add": "ignored-direct-negative-clue",
        "Diya-12": "failed-to-chain-cross-category-result"
      }
    },
    {
      round: 4,
      stage: 2,
      type: "A",
      theme: "students-instruments-colors",
      subjects: ["Sana", "Vir"],
      attributeA: { label: "Instrument", values: ["Drum", "Flute"] },
      attributeB: { label: "Color", values: ["Red", "Blue"] },
      clues: [
        "Sana plays the Flute.",
        "The Drum player likes Blue.",
        "Vir does not like Red."
      ],
      // Sana: Flute. Drum player → Blue → Vir: Drum+Blue. But clue 3 says Vir≠Red,
      // consistent. Sana: Flute+Red.
      solution: { Sana: { Instrument: "Flute", Color: "Red" }, Vir: { Instrument: "Drum", Color: "Blue" } },
      misconception_tags: {
        "Sana-Drum": "ignored-direct-positive-clue",
        "Sana-Blue": "misapplied-cross-category-to-wrong-subject",
        "Vir-Flute": "double-assigned-positive",
        "Vir-Red": "ignored-direct-negative-clue"
      }
    },
    {
      round: 5,
      stage: 3,
      type: "A",
      theme: "students-shapes-sides",
      subjects: ["Meera", "Rohan", "Sara"],
      attributeA: { label: "Shape", values: ["Triangle", "Square", "Pentagon"] },
      attributeB: { label: "Sides", values: ["3", "4", "5"] },
      clues: [
        "Meera did not pick the Triangle.",
        "The student with the Square chose 4 sides.",
        "Rohan's shape has more than 3 sides.",
        "Sara picked an odd number of sides."
      ],
      // Sara: odd sides → 3 or 5. Rohan: >3 sides → 4 or 5.
      // Meera: not Triangle → Square or Pentagon.
      // Square→4 sides. If Meera=Square then Meera=4. Rohan must be 4 or 5; if Meera=4, Rohan=5=Pentagon.
      // Then Sara=Triangle=3 (odd ✓). Check: Meera=Square+4, Rohan=Pentagon+5, Sara=Triangle+3. All clues satisfied.
      solution: {
        Meera: { Shape: "Square", Sides: "4" },
        Rohan: { Shape: "Pentagon", Sides: "5" },
        Sara: { Shape: "Triangle", Sides: "3" }
      },
      misconception_tags: {
        "Meera-Triangle": "ignored-direct-negative-clue",
        "Meera-3": "failed-to-chain-shape-to-sides",
        "Rohan-Triangle": "ignored-conditional-clue-numeric",
        "Rohan-3": "ignored-conditional-clue-numeric",
        "Sara-Square": "ignored-conditional-clue-parity",
        "Sara-4": "ignored-conditional-clue-parity"
      }
    },
    {
      round: 6,
      stage: 3,
      type: "A",
      theme: "students-animals-countries-hard",
      subjects: ["Maya", "Arjun", "Priya"],
      attributeA: { label: "Animal", values: ["Lion", "Elephant", "Tiger"] },
      attributeB: { label: "Country", values: ["India", "Japan", "Brazil"] },
      clues: [
        "Maya is not from Japan.",
        "The Elephant lover is from Japan.",
        "Priya likes the Tiger.",
        "Arjun is not from Brazil."
      ],
      // Priya: Tiger. Elephant→Japan. Maya not Japan → Maya not Elephant → Maya: Lion or (Tiger taken) → Maya: Lion.
      // So Arjun: Elephant+Japan. Arjun not Brazil ✓.
      // Priya: Tiger+? Remaining countries for Priya/Maya: India, Brazil. Maya not Japan (already used), so Maya: India or Brazil.
      // Arjun=Japan. Arjun not Brazil ✓. Priya & Maya split India/Brazil.
      // No further constraint → puzzle is under-determined unless we add: "Maya is from India".
      // Add that as 5th clue? Spec caps at 4. Instead tighten: replace clue 4 with "Maya is from India".
      cluesFinal: [
        "Maya is not from Japan.",
        "The Elephant lover is from Japan.",
        "Priya likes the Tiger.",
        "Maya is from India."
      ],
      solution: {
        Maya: { Animal: "Lion", Country: "India" },
        Arjun: { Animal: "Elephant", Country: "Japan" },
        Priya: { Animal: "Tiger", Country: "Brazil" }
      },
      misconception_tags: {
        "Maya-Japan": "ignored-direct-negative-clue",
        "Maya-Elephant": "failed-to-chain-cross-category",
        "Arjun-Lion": "failed-elimination-after-positive",
        "Arjun-India": "ignored-direct-positive-clue",
        "Priya-Lion": "ignored-direct-positive-clue",
        "Priya-Japan": "double-assigned-attribute"
      }
    }
  ]
};
```

> **Engineer note on Round 1 / Round 2:** Rounds 1 and 2 use 2 subjects (not 3) so the 3x4 grid story in the source description is preserved as a *teaching shape* but the puzzle is genuinely solvable with only 2 attribute values per block. The grid is rendered as 2 rows x 4 columns for these rounds. Round 5 and Round 6 use the full 3 subjects x 6 columns (3+3) to stretch deduction depth. The renderer must size the grid from `subjects.length` x (`attributeA.values.length` + `attributeB.values.length`), not assume 3x4.

> **Engineer note on Round 6:** Use `cluesFinal` as the rendered clue list (a stricter 4th clue replaces the loose "Arjun is not from Brazil" so the puzzle has a unique solution). The original `clues` array is left in the spec for traceability of the design iteration.

## Defaults Applied

- **Bloom Level**: defaulted to L4 Analyze (creator did not specify; deductive reasoning with chained inferences is canonically L4 per pedagogy.md verb table — "deduce, infer").
- **Archetype**: defaulted to Board Puzzle #6 (creator described "puzzle" + "grid" + "solve the board" structure with no sequential MCQ rounds; matches the Board Puzzle decision-tree branch in game-archetypes.md).
- **Rounds**: set to 6 (creator did not specify; Board Puzzle default is 3, but the 3-stage pedagogy curve requires 2 puzzles per stage to show difficulty progression — this is a documented override of the archetype default for pedagogical reasons; warning logged below).
- **Lives**: 0 (creator's source description says wrong submission ends the puzzle and shows Next — this is binary per-puzzle, not a life pool. Board Puzzle default is 0; matches.).
- **Timer**: None (creator did not specify; pedagogy.md L4 default is no timer — analysis requires time, not speed; explicitly listed as anti-pattern #8 in pedagogy.md).
- **Star thresholds**: 3★=6/6, 2★=4-5/6, 1★=1-3/6 (creator did not specify; rounded the 90%/66%/33% standard archetype thresholds to integer puzzle counts, since 6 puzzles cannot land on exact 0.66/0.33).
- **Scaffolding**: Per Board Puzzle archetype — no in-puzzle scaffolding; the entire grid is the workspace and the student's crosses ARE the scaffolding (creator did not specify hint/retry pattern).
- **Feedback style**: FeedbackManager (PART-017) — `playDynamicFeedback('correct'/'incorrect')` (creator did not specify custom feedback; pipeline standard).
- **"Checking..." overlay duration**: 600ms (creator said "brief Please wait message flashes" but did not specify timing; 600ms is the shortest duration that registers as intentional UX feedback while still feeling responsive).
- **Cell tap SFX**: soft bubble (CASE 9 micro-interaction default; creator did not specify).
- **Class/Grade**: Class 4-6 (creator did not specify; deductive logic puzzles fit this range — younger than 4 struggles with abstract cross-category chaining, older than 6 finds 4-clue puzzles trivial).
- **Math domain framing**: Logical Reasoning (creator described a generic deduction puzzle, not a numeric topic; framed as a math-foundation game per the task brief, with 2 of 6 puzzles using math-relevant content — operations/results in Round 3 and shapes/sides in Round 5 — to strengthen the math connection).
- **Theme set**: Mixed concrete (students/animals/countries, students/sports/snacks, students/instruments/colors) + math-flavored (students/operation/result, students/shape/sides). Decision rationale: kept the source-description theme verbatim for Round 1 and Round 6 (the "before and after" arc lets the student feel growth on identical surface content) and inserted 2 math-flavored puzzles in the middle stages to honor the "math-relevant where possible" task brief.
- **Language**: English (creator did not specify; pipeline default).
- **Accessibility**: Touch-only, 44px min targets, sufficient contrast (mobile.md defaults; creator did not specify).

## Warnings

- **WARNING — Bloom L4 with 6 rounds:** pedagogy.md recommends 6 rounds for L4 (lookup table) but archetype Board Puzzle default is 3. The override to 6 puzzles (2 per stage) is the right pedagogical call given the 3-stage difficulty curve, but engineers should be aware that total session time may reach 8-12 minutes — at the upper edge of the recommended attention window for Class 4-6.
- **WARNING — Rounds 1 and 2 use 2 subjects, not 3:** the source description states 3 subjects (Maya/Arjun/Priya), but a 3-subject puzzle with only 2 attribute values per block is mathematically under-determined (the third subject has no row to map to in a 2-value column block). Stage 1 rounds therefore use 2 subjects to teach the mechanic on a genuinely solvable puzzle. The renderer MUST read grid dimensions from the round's `subjects.length` and attribute `values.length` — do not hardcode 3x4.
- **WARNING — No game_over screen:** because lives = 0 and a wrong submission advances to the next puzzle (per source description), there is no game_over screen. Engineers building this MUST NOT add one (game-archetypes.md Constraint 5 — adding a game_over to a lives=0 game causes white-screen test failures). The Victory screen is reachable from EVERY play-through, even one where 0 puzzles are solved.
- **WARNING — Tap-cycle is a non-standard interaction for Board Puzzle:** Board Puzzle's typical interaction is click-to-toggle (binary). The 3-state cycle (empty → ❌ → ✅ → empty) requires explicit state-machine handling per cell. Engineers must implement the cycle as `cell.dataset.state` with three values and ensure CSS transitions are momentary (not continuous, per mobile.md rule 30).
- **WARNING — Wrong submission ends puzzle with no retry:** this is a deliberate design choice from the source description, but it is a harsh failure mode for L4 cognitive work. Pedagogy.md recommends scaffolding after at most 3 wrong attempts; this game offers ZERO retries. Mitigation: the dynamic-TTS fail message names the violated clue and points to the contradicting cells, providing post-hoc instruction even if not retry. If user-testing shows frustration, consider a future variant that allows 1 retry per puzzle before failing — but the current spec honors the source description as written.
- **WARNING — Round 5 uses 3 subjects x 6 columns (3+3):** the largest grid in the game. On a 375px-wide viewport, each cell is ~50px wide before borders/labels — at the lower edge of the 44px minimum touch target. Engineers must verify cell touch-target size on the smallest target viewport (mobile.md rule 9) and consider compressing column-header text (e.g., "Tri/Sq/Pen" abbreviations on narrow screens) to keep cell tap area at 44px+.
