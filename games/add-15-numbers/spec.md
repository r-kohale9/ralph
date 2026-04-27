# Game Design: Add 15 Numbers

## Identity
- **Game ID:** add-15-numbers
- **Title:** Add 15 Numbers
- **Class/Grade:** Class 5 (Grade 5) — NCERT Class 5, Chapter "Ways to Multiply and Divide" prerequisites; direct alignment with Class 4 "Tick-Tick-Tick" (mental addition) and Class 5 revision of whole-number addition. Also playable for Classes 4 and 6 as practice.
- **Math Domain:** Number Sense — Whole-Number Addition
- **Topic:** Mental addition of a list of small whole numbers under time pressure; recognizing partial sums and using grouping/regrouping strategies (make-tens, doubles) to accelerate.
- **Bloom Level:** L3 Apply (student applies addition procedures to a multi-addend sum and selects the correct total from options).
- **Archetype:** Lives Challenge (Timed + Lives variant). Maps to Archetype #3 with PART-006 added (per-round timer). Base profile: rounds + lives + MCQ (single-select); timer is per-round, not global Speed Blitz.

## One-Line Concept
Across 5 rounds, the student mentally adds a grid of ~15 small whole numbers before a 15-second per-round timer expires, optionally tapping tiles to cross them out as a working-memory aid, then taps one of 3 MCQ buttons showing the candidate sum.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Multi-addend mental addition | Summing 10-15 small numbers (1-20) by running total or grouping | A (all rounds) |
| Make-ten grouping strategy | Recognising number pairs that sum to 10 (e.g., 7+3, 6+4) to accelerate | A (Stage 2-3) |
| Doubles / near-doubles | Using known doubles (6+6=12, 7+7=14) as anchors for faster addition | A (Stage 2-3) |
| Working-memory tracking under time pressure | Using the strike-out visual aid to avoid double-counting while the timer runs | A (all rounds) |
| Estimation for answer discrimination | Rejecting the out-of-range distractor by ballpark estimate | A (all rounds) |

## Core Mechanic

### Type A: "Tap-and-strike grid sum + MCQ selection"

1. **What the student sees**
   - A fixed objective banner at the top: "Add the given list of numbers and tap on their sum!"
   - A centred grid of number tiles (12-15 tiles per round, laid out as a 3-column x 4-5 row grid; exact tile count per round below).
   - Below the grid, 3 horizontally-arranged MCQ buttons, each showing a candidate sum (2-3 digit whole numbers).
   - A progress bar + timer at the top: shrinking horizontal bar + a digital countdown ("15s" → "0s"). ProgressBar also shows 3 heart icons (lives) and "N/5" rounds-completed indicator.

2. **What the student does (inputs)**
   - **Grid tile tap (optional working-memory aid):** Tapping a tile toggles a "struck-out" visual state — the tile turns light gray and a red strike-through line appears diagonally across the number. A second tap un-strikes it. Striking a tile does NOT submit, does NOT cost time, does NOT cost a life, does NOT advance the round. It is purely a visual bookkeeping aid.
   - **MCQ button tap (the commit action):** Tapping one of the 3 sum buttons is the terminal answer for the round. After a tap, all MCQ buttons and grid tiles are disabled immediately (`gameState.isProcessing = true` before any await).

3. **What counts as correct**
   - The tapped MCQ value equals the true sum of all tiles in the grid (not the sum of non-struck tiles — the strike-out is an aid only, it does not change the target).
   - Validation: fixed-answer string compare (PART-013 style): `String(userAnswer).trim() === String(correctAnswer).trim()`.

4. **What feedback plays**
   - **Correct (single-step, per feedback skill CASE 4):** input blocked immediately → correct MCQ button flashes green (`.correct` class, ~600ms) → awaited correct SFX (~1s) with celebration sticker → fire-and-forget dynamic TTS with subtitle ("Correct sum! That's <sum>!"). Then auto-advance to round interstitial.
   - **Wrong (lives remaining, CASE 7):** input blocked immediately → tapped MCQ button flashes red + shake animation (~600ms) → "Oops! This is not the correct sum!" subtitle → awaited wrong SFX (~1s) with sad sticker → fire-and-forget dynamic TTS ("Not quite — the sum was <correct>"). Life lost, progressBar hearts update immediately. Correct option then highlights green so the student sees it. Then auto-advance to round interstitial.
   - **Timeout (no tap within 15s):** treated as wrong (see CASE 7). Wrong SFX plays, one life deducted, correct option highlighted in green. Subtitle: "Time's up! The sum was <correct>".
   - **Grid tile tap (CASE 9 micro-interaction):** soft bubble SFX on strike, deselect SFX on un-strike. Fire-and-forget, no sticker, no input block.
   - **Round-complete interstitial:** after correct OR wrong (non-fatal), a 2-second interstitial screen shows "Average time taken: X.Xs" and "N/5 rounds complete" before the next round intro. This replaces the default round-transition VO; a short "next round" SFX plays (fire-and-forget).

## Rounds & Progression

5 rounds total, organized into 3 difficulty stages (2+2+1 distribution so Round 5 is a boss).

### Stage 1: Warmup — small single-digit numbers, tight value range (Rounds 1-2)
- Round types used: Type A
- Difficulty parameters
  - Tile count: 12 tiles
  - Tile value range: 1-9 (single digits only, including easy make-ten pairs)
  - Target sum range: 50-75
  - Distractor gap: ±3 and ±10 from correct (close but distinguishable)
- Contexts/themes: plain number tiles on a light-blue background. No story frame.

### Stage 2: Core — mixed single and low double digits, make-ten opportunities (Rounds 3-4)
- Round types used: Type A
- Difficulty parameters
  - Tile count: 14 tiles
  - Tile value range: 1-15 (mostly single digits plus a few 10-15 values)
  - Target sum range: 85-120
  - Distractor gap: ±5 and ±10 (with one "digit-swap" distractor where applicable)
- Contexts/themes: plain number tiles.

### Stage 3: Boss — larger grid, bigger numbers, tightest distractors (Round 5)
- Round types used: Type A
- Difficulty parameters
  - Tile count: 15 tiles
  - Tile value range: 1-20 (includes teens)
  - Target sum range: 130-170
  - Distractor gap: ±5 and ±7 (tighter; forces careful addition)
- Contexts/themes: plain number tiles.

Total numbers added across the 5 rounds: 12+12+14+14+15 = **67 numbers** across the session (interpretation of "add-15-numbers" — see Defaults Applied).

| Dimension | Stage 1 (R1-2) | Stage 2 (R3-4) | Stage 3 (R5) |
|-----------|----------------|----------------|--------------|
| Tile count | 12 | 14 | 15 |
| Value range | 1-9 | 1-15 | 1-20 |
| Target sum | 50-75 | 85-120 | 130-170 |
| Distractor gap | ±3, ±10 | ±5, ±10 + digit-swap | ±5, ±7 |
| Timer | 15s | 15s | 15s |
| Lives | shared pool (3) | shared pool (3) | shared pool (3) |

## Game Parameters
- **Rounds:** 5 (creator explicit)
- **Timer:** 15 seconds per round; resets on each new round; stops on MCQ tap; timeout costs 1 life (creator explicit)
- **Lives:** 3 (creator explicit); shared across all rounds; game ends immediately on reaching 0
- **Star rating:** 3 stars = complete all 5 rounds with 3 lives remaining AND average time per round ≤ 15s (all rounds answered in time); 2 stars = complete all 5 rounds with 1-2 lives remaining; 1 star = complete all 5 rounds with 0 lives remaining (impossible — 0 lives ends game early) OR complete 3-4 rounds before losing all lives; 0 stars = complete 0-2 rounds before losing all lives. See Scoring below for exact formula.
- **Input:** Tap / click. Two target types: (a) 12-15 grid tiles (toggle strike, no submit), (b) 3 MCQ option buttons (submit on tap).
- **Feedback:** FeedbackManager (PART-017). playDynamicFeedback('correct')/('incorrect') per CASE 4 and CASE 7 of the feedback skill. Grid-tile tap uses CASE 9 (tile select/deselect micro-interaction).

## Scoring
- Points: +1 per round completed correctly (not per-tile, not per-strike). Max points = 5.
- Stars (lives-based, following `addition-mcq-lives` convention):
  - 3 stars = complete all 5 rounds AND `lives === 3` at end
  - 2 stars = complete all 5 rounds AND `lives === 2` at end
  - 1 star = complete all 5 rounds AND `lives === 1` at end
  - 0 stars = lives reached 0 before all rounds complete (Game Over path)
- Lives: start at 3. Wrong MCQ tap = -1 life. Timer expiry (no tap within 15s) = -1 life. At 0 lives → game transitions to Game Over screen immediately.
- Partial credit: None. Correct MCQ tap = full point; any other outcome for that round (wrong or timeout) = 0 points for that round AND -1 life.
- Average time per round displayed on the inter-round interstitial and on the Results screen (metric: sum of per-round response times / rounds answered).

## Flow

**Shape:** Multi-round (default) + customizations
**Changes from default:**
- Insert a per-round 15-second TimerComponent into the Round N game screen (between Round-N intro and player input). Timer pause/stop on MCQ tap; timeout branches to wrong-answer feedback + life decrement.
- Insert a "Round-complete interstitial" transition between Feedback and the next Round-N intro. Shows "Average time taken: X.Xs" + "N/5 rounds complete" for ~2s (auto-advance, no CTA).
- No section intros (single contiguous round sequence). No pep-talk branch. No early-exit streak bail-out. Claim-stars and Play-again branches remain as in default-flow.md.

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)         │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ 🔊 prompt / TTS        │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │ + 15s timer runs       │
│   audio  │        │    VO    │        │ 🔊 "Round N" │         │ + grid tap-to-strike   │
└──────────┘        └──────────┘        └──────────────┘         └─────────┬──────────────┘
                                                ▲                          │ player taps MCQ
                                                │                          │   OR timer hits 0
                                                │                          ▼
                                                │                ┌──────────────────────────┐
                                                │                │ Feedback (2s, same       │
                                                │                │ screen)                  │
                                                │                │ ✓ 🔊 sound_correct       │
                                                │                │ ✗ 🔊 sound_life_lost     │
                                                │                │   + red flash + shake    │
                                                │                │   + correct revealed     │
                                                │                └─────────┬────────────────┘
                                                │                          │
                                                │                          ▼
                                                │                ┌──────────────────────────┐
                                                │                │ Round-complete           │
                                                │                │ interstitial (2s, auto)  │
                                                │                │ "Avg time: X.Xs"         │
                                                │                │ "N/5 rounds complete"    │
                                                │                └─────────┬────────────────┘
                                                │                          │
                            ┌───────────────────┴─────┬────────────────────┼──────────────┐
                            │                         │                                   │
                      wrong/timeout AND lives = 0   correct AND more       correct AND last round won
                            │                      rounds                    │
                            ▼                       (loops to Round N+1)     ▼
                 ┌────────────────────┐                                    ┌────────────────────┐
                 │ Game Over (status) │                                    │ Victory (status)   │
                 │ 💔 "All lives lost!"│                                   │ 1-3★ (lives-based) │
                 │ 🔊 sound_game_over │                                    │ 🔊 sound_game_     │
                 └─────────┬──────────┘                                    │    victory →       │
                           │ "Try Again"                                   │    vo_victory_     │
                           ▼                                               │    stars_N         │
                 ┌──────────────────┐                                      └──────┬─────┬───────┘
                 │ "Ready to        │                                             │     │
                 │  improve your    │                                "Play Again" │     │ "Claim Stars"
                 │  score?"         │                                (only if     │     │
                 │ (trans., tap)    │                                 1-2 ★)      ▼     ▼
                 │ 🔊 motivation VO │                                       ┌──────────────────┐  ┌──────────────────────┐
                 │ [I'm ready]      │                                       │ "Ready to        │  │ "Yay, stars          │
                 └────────┬─────────┘                                       │  improve your    │  │  collected!"         │
                          │ tap                                             │  score?"         │  │ (trans., auto,       │
                          ▼                                                 │ (trans., tap)    │  │  no buttons)         │
                 restart from Round 1                                       │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                 (skips Preview + Welcome)                                  │ [I'm ready]      │  │    sound + ✨ star   │
                                                                            └────────┬─────────┘  │    animation         │
                                                                                     │ tap        └──────────┬───────────┘
                                                                                     ▼                       │ auto
                                                                            restart from Round 1             ▼
                                                                            (skips Preview + Welcome)        exit
```

## Feedback
| Event | Behavior |
|-------|----------|
| Grid tile tap (strike on) | Tile turns light gray, red diagonal strike-through appears. Soft bubble SFX, fire-and-forget, no sticker, no input block. CASE 9. |
| Grid tile tap (un-strike) | Tile returns to default appearance, strike-through removed. Deselect SFX, fire-and-forget. |
| MCQ correct tap | Button `.correct` green flash (~600ms). Input blocked (`isProcessing=true` pre-await). Timer paused. Awaited correct SFX (~1s) + celebration sticker. Fire-and-forget TTS with subtitle "Correct sum! That's <sum>!". Then round-complete interstitial after ~1s. CASE 4. |
| MCQ wrong tap (lives > 0) | Button `.wrong` red flash + shake (~600ms). Input blocked. Timer paused. Lives decrement immediately, progressBar hearts update. Correct option highlighted `.correct` green for visibility. Awaited wrong SFX (~1s) + sad sticker + subtitle "Oops! This is not the correct sum!". Fire-and-forget TTS "Not quite — the sum was <correct>". Then round-complete interstitial. CASE 7. |
| Timer expires (no tap within 15s) | All MCQ + grid disabled. Correct option highlighted `.correct`. Subtitle "Time's up! The sum was <correct>". Wrong SFX awaited + sad sticker. Lives decrement, progressBar updates. Fire-and-forget TTS. Then round-complete interstitial. Treated as wrong for scoring. |
| Round-complete interstitial | ~2s auto-advancing transition screen showing "Average time taken: X.Xs" + "<currentRound>/5 rounds complete". Short "next round" SFX (fire-and-forget). No CTA. |
| Lose last life (lives = 0) | After the wrong/timeout SFX sequence of CASE 8 finishes, `game_complete` postMessage sent BEFORE audio. Then Game Over TransitionScreen renders: broken-heart icon 💔, title "All lives lost!", subtitle "You completed <N> rounds", `sound_game_over` + sad sticker + VO "You completed <N> rounds. Nice try!". CTA "Try Again". CASE 12. |
| Complete all 5 rounds | ProgressBar bumps to 5/5 FIRST (cross-cutting rule 0). `game_complete` postMessage sent BEFORE audio. Victory TransitionScreen renders: star count (1-3 based on lives remaining), "Average time: X.Xs", sound_game_victory + VO matching star tier. CTAs: if 1-2★ "Play Again" + "Claim Stars"; if 3★ just "Claim Stars". CASE 11. |
| Visibility hidden (tab switch) | Timer pauses via VisibilityTracker. All audio pauses. VisibilityTracker's built-in PopupComponent shows pause overlay (`autoShowPopup: true`, do NOT override). CASE 14. |
| Visibility restored | Timer resumes. Audio resumes. PopupComponent auto-dismisses. CASE 15. |
| Audio failure | All FeedbackManager calls try/catch wrapped. Game continues, visuals still render. CASE 16. |

## Content Structure (fallbackContent)

Top-level spec field `previewScreen: true` (default, PART-039 preview screen enabled). Preview shows the objective, one example sum visual, and TTS narration of the rules.

InputSchema shape (consumed by the content pipeline):

```json
{
  "type": "object",
  "properties": {
    "previewInstruction": { "type": "string" },
    "previewAudioText": { "type": "string" },
    "showGameOnPreview": { "type": "boolean", "default": false },
    "rounds": {
      "type": "array",
      "minItems": 5,
      "maxItems": 5,
      "items": {
        "type": "object",
        "properties": {
          "round": { "type": "integer", "minimum": 1, "maximum": 5 },
          "stage": { "type": "integer", "minimum": 1, "maximum": 3 },
          "type": { "type": "string", "enum": ["A"] },
          "tiles": {
            "type": "array",
            "minItems": 12,
            "maxItems": 15,
            "items": { "type": "integer", "minimum": 1, "maximum": 20 }
          },
          "correctSum": { "type": "integer" },
          "options": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": { "type": "integer" }
          },
          "misconception_tags": {
            "type": "object",
            "description": "Map from each wrong option (as string) to its misconception tag"
          },
          "misconception_explanations": {
            "type": "object",
            "description": "Map from each wrong option (as string) to a short corrective explanation"
          }
        },
        "required": ["round", "stage", "type", "tiles", "correctSum", "options", "misconception_tags", "misconception_explanations"]
      }
    }
  },
  "required": ["rounds"]
}
```

Fully-worked fallbackContent (all 5 rounds populated; tiles sum exactly to correctSum; options include correctSum + 2 misconception distractors; `correctSum` always appears at a random position among options in implementation — fallback shows a consistent middle position for readability):

```js
const fallbackContent = {
  previewInstruction: '<p><b>Add the given list of numbers and tap on their sum!</b></p><p>You have 15 seconds per round. 3 lives. 5 rounds.</p><p>Tap a tile to cross it out — it just helps you keep track.</p>',
  previewAudioText: 'Add the given list of numbers and tap on their sum. You have fifteen seconds each round, three lives, and five rounds. Tap a number to cross it out — it just helps you keep track.',
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: 'A',
      tiles: [5, 8, 3, 7, 6, 2, 9, 4, 8, 5, 3, 7],
      // sum = 5+8+3+7+6+2+9+4+8+5+3+7 = 67
      correctSum: 67,
      options: [64, 67, 77],
      misconception_tags: {
        '64': 'MISC-ADD-01',   // dropped-addend (missed one 3)
        '77': 'MISC-ADD-02'    // double-counted a tile (counted 5 twice)
      },
      misconception_explanations: {
        '64': 'Close! It looks like you missed one number when running your total. Try crossing out each tile as you add it.',
        '77': 'You may have counted a tile twice. Crossing out each tile as you add it helps you not double-count.'
      }
    },
    {
      round: 2,
      stage: 1,
      type: 'A',
      tiles: [4, 9, 1, 6, 8, 2, 7, 3, 5, 8, 6, 4],
      // sum = 4+9+1+6+8+2+7+3+5+8+6+4 = 63
      correctSum: 63,
      options: [60, 63, 73],
      misconception_tags: {
        '60': 'MISC-ADD-01',   // dropped-addend (missed a 3)
        '73': 'MISC-CARRY-01'  // carry error (+10 off)
      },
      misconception_explanations: {
        '60': 'Off by a small number — you likely missed one tile. Cross out each tile as you add it.',
        '73': 'Check for a carry mistake: it looks like you added an extra ten when regrouping.'
      }
    },
    {
      round: 3,
      stage: 2,
      type: 'A',
      tiles: [7, 12, 5, 9, 3, 14, 6, 8, 4, 11, 2, 10, 6, 5],
      // sum = 7+12+5+9+3+14+6+8+4+11+2+10+6+5 = 102
      correctSum: 102,
      options: [99, 102, 112],
      misconception_tags: {
        '99': 'MISC-ADD-01',   // dropped-addend (off by 3)
        '112': 'MISC-CARRY-01' // carry error (+10 off)
      },
      misconception_explanations: {
        '99': 'Off by 3 — you likely skipped one tile. Grouping make-tens (e.g., 7+3, 6+4) can make the running total easier.',
        '112': 'Check for a carry mistake: you added an extra ten when regrouping.'
      }
    },
    {
      round: 4,
      stage: 2,
      type: 'A',
      tiles: [9, 14, 5, 11, 7, 3, 13, 6, 8, 2, 10, 4, 7, 15],
      // sum = 9+14+5+11+7+3+13+6+8+2+10+4+7+15 = 114
      correctSum: 114,
      options: [109, 114, 124],
      misconception_tags: {
        '109': 'MISC-ADD-01',   // dropped-addend (off by 5)
        '124': 'MISC-CARRY-01'  // carry error (+10 off)
      },
      misconception_explanations: {
        '109': 'Off by 5 — a tile likely got skipped. Try pairing make-tens (e.g., 7+3, 6+4) to keep the running total tidy.',
        '124': 'Off by 10 — this looks like a carry/regrouping slip. Recount the tens column.'
      }
    },
    {
      round: 5,
      stage: 3,
      type: 'A',
      tiles: [12, 8, 15, 6, 11, 9, 4, 13, 7, 10, 5, 14, 8, 11, 17],
      // sum = 12+8+15+6+11+9+4+13+7+10+5+14+8+11+17 = 150
      correctSum: 150,
      options: [143, 150, 157],
      misconception_tags: {
        '143': 'MISC-ADD-01',   // dropped-addend (off by 7)
        '157': 'MISC-ADD-02'    // double-counted a tile (extra 7)
      },
      misconception_explanations: {
        '143': 'Off by 7 — a tile may have been skipped. Try make-tens (e.g., 13+7, 14+6) to simplify the running total.',
        '157': 'It looks like a tile got counted twice. Cross out each tile as you add it to avoid double-counting.'
      }
    }
  ]
};
```

**Misconception taxonomy for this game (addition-specific extension to pedagogy/misconceptions.md):**

| Tag | Name | How it produces a wrong answer |
|-----|------|-------------------------------|
| MISC-ADD-01 | Dropped-addend (skipped a tile) | Student runs a mental total and skips one or more tiles, producing a sum lower than correct by the value(s) skipped (typically −3 to −10). |
| MISC-ADD-02 | Double-counted a tile | Student counts a tile twice when glancing back, producing a sum higher than correct by a single tile value (typically +5 to +10). |
| MISC-CARRY-01 | Carry / regrouping error | Student correctly identifies every addend but misregroups at the tens column (off by exactly 10, sometimes 20). |
| MISC-CALC-01 (reserve) | Careless computation error | Arithmetic slip with correct procedure. Use only if a 3rd distractor is needed and no misconception fits; this game uses only 3 options so only 2 distractors per round — all 10 distractors across the game are tagged to MISC-ADD-01, MISC-ADD-02, or MISC-CARRY-01. |

Every wrong option in every round maps to one of these three tags. No random distractors.

**Content-pipeline generation rules (for non-fallback content):**
- Tile count per round per Stage table above.
- Tile value range per Stage table above.
- `correctSum` must equal the exact integer sum of `tiles`.
- Exactly 3 `options`: one equals `correctSum`; one is a MISC-ADD-01 distractor (−3 to −10 from correct, chosen as the actual value of one of the tiles); one is a MISC-ADD-02 or MISC-CARRY-01 distractor (+5 to +10, or ±10, from correct).
- No two distractors may be equal. No distractor may equal `correctSum`.
- Tiles list should include at least one make-ten pair in Stage 2-3 to enable the grouping strategy.

## Defaults Applied
- **Archetype classification**: defaulted to Lives Challenge (Timed + Lives variant, Archetype #3 + PART-006) based on creator's explicit 3 lives + 15s timer + rounds structure (creator did not name an archetype).
- **Bloom Level**: defaulted to L3 Apply (creator did not specify; verb is "calculate/add" which is L3 per pedagogy.md Step 1 verb table).
- **Class/Grade**: defaulted to Class 5 (creator did not specify; the number range 1-20 and multi-addend mental addition aligns with Class 4-5 NCERT and is the most common band for this game shape).
- **Interpretation of "add-15-numbers"**: the title is ambiguous — it could mean (a) "add 15 numbers per round" (grid size = 15), (b) "add 15 numbers in total across the game" (way too few for 5 rounds), or (c) a reference to the 15-second timer. **Chosen interpretation:** primary meaning is grid-centric ("add a list of ~15 numbers per round"), aligned with the creator's description ("grid of numbers"). The per-round tile count scales 12 → 14 → 15 across stages so Round 5 hits exactly 15. The 15-second timer is an independent creator-specified constraint and is honored as-is. If the creator intended meaning (b), this spec is wrong and should be rebuilt with a single-round or 15-total-tiles design; if meaning (c) only, the title is describing the timer and the grid count could be any value. Flag for confirmation.
- **Star-rating formula**: defaulted to lives-based (3★ = 3 lives at end, 2★ = 2, 1★ = 1, 0★ = game-over), following the shipped `addition-mcq-lives` convention. Creator described "3 stars = answered within 15 seconds" which is a per-round speed heuristic but did not define 2★/1★ thresholds; lives-based gives a coherent end-game tier consistent with the rest of the pipeline.
- **MCQ layout**: defaulted to 3 buttons in a single horizontal row below the grid (creator's description shows 3 buttons labelled in screenshots).
- **Grid layout**: defaulted to a 3-column grid with 4-5 rows (creator said "grid" without specifying dimensions). 3 columns gives 44px+ touch targets on a 375px viewport with 8px spacing.
- **Strike-through visual**: defaulted to gray fill + red diagonal line per creator's description ("turns gray and is crossed out with a red strike-through line").
- **Timer style**: defaulted to PART-006 TimerComponent with shrinking horizontal bar + digital "15s" countdown (creator's description shows both).
- **Inter-round interstitial**: defaulted to 2-second auto-advance transition screen showing average time + rounds complete, matching creator's description.
- **Progress bar**: defaulted to PART-023 ProgressBarComponent with `totalRounds: 5` and `totalLives: 3` (standard Lives Challenge).
- **Feedback behavior**: defaulted to FeedbackManager (PART-017) CASE 4/7/9/11/12 per feedback skill. Creator described "button flashes green / flashes red and shakes" which matches default single-step feedback.
- **Language**: defaulted to English (creator did not specify).
- **Scaffolding**: defaulted to "show correct answer after wrong or timeout" (creator did not specify scaffolding; this is the standard L3 scaffolding pattern from pedagogy.md).
- **Accessibility**: defaulted to touch-only, 44×44 CSS px minimum touch targets (grid tiles + MCQ buttons), 8px spacing, `--mathai-*` color variables, `inputmode`/`type="text"` not needed (no number input), `overscroll-behavior: none`, `100dvh` layout, portrait-only, per mobile skill.
- **PART flags**: PART-001, PART-002, PART-003, PART-004, PART-005, PART-006, PART-007, PART-008, PART-009, PART-010, PART-011, PART-012, PART-013, PART-017, PART-019, PART-020, PART-021, PART-022, PART-023, PART-024, PART-025, PART-026, PART-027, PART-028, PART-030, PART-039 (preview). Creator did not specify; standard set for Timed + Lives Challenge with preview.

## Warnings
- **WARNING: Timer + Lives compounds difficulty.** The game stacks a 15-second per-round timer on top of 3 lives, and a timeout costs a life. A Class 5 student who is a slow mental-adder can lose all 3 lives to timeouts alone before even tapping a wrong option, producing a 0-star game-over in ≤45 seconds. This is creator-specified so it is kept, but consider softening (e.g., timeout = 0 points but NO life lost) if early playtest data shows excessive game-over rates on the first round.
- **WARNING: Bloom L3 with only 3 options instead of 4.** L3 Apply games typically use 4 MCQ options to force more computational discrimination; this game uses 3 (creator-specified from the description). With only 2 distractors per round, guessing gives 33% baseline accuracy. Kept as-is per creator; flagged so the content pipeline tightens distractor gaps accordingly (see Stage 3: ±5/±7, not ±10).
- **WARNING: Ambiguous game title.** "add-15-numbers" does not unambiguously state whether 15 = tile count, total numbers across the game, or timer seconds. See Defaults Applied for the chosen interpretation. Confirm with creator before building.
- **WARNING: Strike-through is a no-op for scoring, which could confuse a student who expects "uncrossed tiles = unused numbers".** The current design does NOT validate that the struck-out tiles match the student's mental path; the correct sum is always the sum of ALL tiles. This is standard for MCQ + visual-aid patterns (creator-described) but the preview audio MUST make this explicit ("tapping tiles just helps you keep track — the sum is always of all the numbers"). Preview audio text above already includes this clarification.
- **WARNING: 5 rounds is the lower bound of the "unusual round count" heuristic** (spec-creation skill Step 4 notes "unusual if < 5 or > 12"). Creator-specified 5, so kept; session length will feel short (~2-3 minutes end-to-end). This is acceptable for a speed-addition practice slot.
- **WARNING: No timer visualization spec override — ensure the per-round timer is the canonical `TimerComponent` (PART-006) rendered inside the play-area header, not a custom countdown element.** Per lessons-learned: custom timer divs race with TimerComponent late-load and produce "TimerComponent is not defined" on ~1-in-3 builds. Also mount `#timer-container` inside `.mathai-preview-header-center` visibly (MEMORY.md note) and ensure ProgressBar bumps BEFORE round-complete audio in the round-complete handler (MEMORY.md note).
