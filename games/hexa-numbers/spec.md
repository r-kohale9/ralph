# Game Design: Hexa Numbers

## Identity
- **Game ID:** hexa-numbers
- **Title:** Hexa Numbers
- **Class/Grade:** Class 4–6 (Grade 4–6, ~9–12 years old)
- **Math Domain:** Number Sense & Operations (addition of small numbers, place-value reasoning with tens and ones)
- **Topic:** Decomposing 2-digit numbers (40–90 range) into a sum of six small addends, with shared addends across overlapping rings
- **Bloom Level:** L4 Analyze
- **Archetype:** #6 Board Puzzle (single multi-step puzzle; one CHECK action; whole board is right-or-wrong as a unit)
- **NCERT Reference:** Class 4 NCERT Chapter "Long and Short" / "Tick Tick Tick" — Place value & addition; Class 5 NCERT Chapter "The Fish Tale" / "Be My Multiple, I'll be Your Factor" — number-sense addition.
- **Pattern:** P6 (Drag-and-drop) — uses `@dnd-kit/dom@beta`. Step 4 (Build) MUST run in MAIN CONTEXT so the orchestrator can call `mcp__context7__query-docs` for the dnd-kit API on demand.
- **Input:** Drag-and-drop (PART-033 + dnd-kit), plus a single Submit/Check tap (PART-050).

## One-Line Concept
The student drags 13 numbered hexagons into a honeycomb so that the six small hexagons surrounding each of three overlapping target numbers add to that target's value, then taps CHECK once to verify the whole board.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Place-value decomposition | Break a 2-digit target into a sum of six small addends spanning ones and tens. | hexa-board |
| Addition of six small numbers | Mentally sum six small numbers (single-digit and small multiples of 5/10) to verify a ring. | hexa-board |
| Constraint intersection | Recognize that a shared-slot hexagon must satisfy two target sums simultaneously. | hexa-board |
| Colour-gated planning | Plan within the blue palette for inner slots and the white palette for outer slots independently. | hexa-board |
| Hypothesis testing | Commit to an arrangement, predict passes, revise before the one-shot CHECK. | hexa-board |

## Core Mechanic

### Type A: "Hexa Board"

1. **What the student sees**
   - A board area with 3 dark **target hexagons** arranged in a downward-pointing triangle (T1 top-left, T2 top-right, T3 bottom-center). Each target displays a 2-digit number (40–90 range).
   - 13 empty **slot hexagons** packed around the targets:
     - 6 **inner blue slots** form the cluster between/under the targets. Some belong to two adjacent target rings.
     - 7 **outer white slots** form the halo. Most belong to one target's ring; two corner slots are shared between two targets' outer rings.
   - A **pool tray** below the board holds exactly 13 numbered hexagons: 6 painted blue and 7 painted white, each carrying a small number value (single-digit ones for white; small multiples of 5 / 10 for blue).
   - A **CHECK** button (FloatingButton, PART-050). Disabled until all 13 slots hold a hexagon.
2. **What the student does** (input type: drag-and-drop + 1 tap)
   - Picks up a pool hexagon and drops it onto a slot.
   - **Colour rule (the hidden constraint):** a blue hexagon may only enter a blue slot; a white hexagon may only enter a white slot. Dropping on a wrong-coloured slot bounces the hexagon back to the pool with a soft buzz (bubble-pop SFX).
   - May freely re-arrange (drag a placed hexagon off a slot back to the pool, or to another same-colour slot).
   - Taps **CHECK** once — one-shot per round; the result stands.
3. **What counts as correct**
   - The arrangement is judged as **all-or-nothing per target**. A target passes iff the six hexagons in its ring sum exactly to the target's value.
   - The whole round counts as **solved on first CHECK** iff all three targets pass simultaneously.
   - Each set (A, B, C) has **exactly one canonical arrangement modulo the topologically-trivial swaps** `outer-1 ↔ outer-2` (both T1-only) and `outer-6 ↔ outer-7` (both T3-only). Because both slots in each pair share the same target-ring membership, swapping their values is gameplay-equivalent and CHECK accepts all 4 symmetric variants. Uniqueness modulo these swaps is asserted in the Content Structure section and verified by build-time exhaustive search (each set must enumerate to exactly 4 raw solutions = 1 equivalence class).
4. **What feedback plays**
   - **All three pass:** green flash on every slot, SFX `sound_correct_answer` (CASE 6 round-complete) → awaited dynamic TTS ("Great! Every ring adds up!") with celebration sticker → auto-advance to next round-set variant.
   - **Any target fails:** per-target tick/cross renders on each target hex. Slots that belong only to passing rings stay neutral. Slots in any failing target's ring glow red. After ~1.5 s the **reveal animation** plays: each pool hexagon glides to its canonical correct slot in turn (~2.5 s total). SFX `sound_life_lost` (one-shot) → awaited dynamic TTS ("Almost! Look at how the rings should add up.") → auto-advance to the next round-set variant.
   - **Drop on wrong-colour slot:** soft buzz SFX (`sound_bubble_burst` style), hexagon springs back to its pool position. No life lost (no lives in this game). No round advance.

## Rounds & Progression

Three rounds per session, all sharing the same puzzle within a set. Set A → B → C is the round-set cycling axis (one full set per session); within a set, the three rounds are mechanically identical and only differ cosmetically (colour skin + glyph).

### Stage 1: Variant B1 (Round 1)
- Round type: hexa-board
- Difficulty parameters: targets and pool fixed by the active set (A, B, or C). Geometry, slot IDs, and correct mapping are identical across all three rounds of a set.
- Cosmetic skin: dark teal-grey targets, glyph A (sun-burst icon).
- Score event: +1 if solved on first CHECK.

### Stage 2: Variant B2 (Round 2)
- Round type: hexa-board
- Difficulty parameters: identical puzzle (same targets / same pool / same correct arrangement) — a fluency repeat after Round 1.
- Cosmetic skin: dark green targets, glyph B (leaf icon).
- Score event: +1 if solved on first CHECK.

### Stage 3: Variant B3 (Round 3)
- Round type: hexa-board
- Difficulty parameters: identical puzzle (same targets / same pool / same correct arrangement) — second fluency repeat.
- Cosmetic skin: dark green targets, glyph C (star icon).
- Score event: +1 if solved on first CHECK.

| Dimension | Stage 1 (R1, B1) | Stage 2 (R2, B2) | Stage 3 (R3, B3) |
|-----------|-------------------|-------------------|-------------------|
| Targets | Set's three values | Same as R1 | Same as R1 |
| Pool values | Set's 13 values | Same as R1 | Same as R1 |
| Correct arrangement | Set's canonical mapping | Same as R1 | Same as R1 |
| Cosmetic colour | dark teal-grey | dark green | dark green |
| Cosmetic glyph | glyph A (sun-burst) | glyph B (leaf) | glyph C (star) |
| Cognitive demand | First exposure (analysis) | Fluency repeat (recall + verify) | Mastery repeat (automatic recall) |

**Round-set cycling:** the spec authors three full sets (A, B, C) so `rounds.length === 9`. First play uses Set A; after a Try-Again / Play-Again the runtime cycles to Set B; the next restart cycles to Set C; a fourth restart loops back to Set A. Each set has a different triple of target values and a different canonical correct mapping (per the creator's "Replay" section).

## Game Parameters
- **Rounds:** 3 per session (one full set, three cosmetic variants).
- **Timer:** None (`timer: false`). This is a thinking puzzle, not a speed puzzle.
- **Lives:** 0 (`totalLives: 0`). No lives, no game-over screen, no in-round retry. CHECK is one-shot; the result stands.
- **retryPreservesInput:** N/A (multi-round, lives = 0).
- **autoShowStar:** `true` (default end-of-game beat handled by PART-050 / Stars Collected).
- **Star rating:** 3 stars = 3 first-CHECK solves; 2 stars = 2 first-CHECK solves; 1 star = 1 first-CHECK solve; 0 stars = 0 solves (still routes through Victory + Stars Collected; never through Game Over because `lives = 0`).
- **Input:** Drag-and-drop (P6, dnd-kit) + single Submit tap per round (PART-050 'submit' mode).
- **Feedback:** FeedbackManager (PART-017). Per-target tick/cross verdict. Reveal animation on any-fail. Single global CHECK gating per round.
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships). Each round's `answer` payload is the canonical mapping for the active set so students can review the correct arrangement at end-of-game.

## Scoring
- **Points:** +1 per round solved correctly on the first (and only) CHECK. Max 3 points per session.
- **Stars (mapped from points):** 3 pts → 3★ · 2 pts → 2★ · 1 pt → 1★ · 0 pts → 0★. The 0★ Victory still renders the celebration + AnswerComponent (carousel shows the correct arrangement); there is no Game Over branch because `lives = 0`.
- **Lives:** 0 (no penalty mechanic). A failed CHECK does not end the game; it just forfeits the point for that round and reveals the correct arrangement before advancing.
- **Partial credit:** None — a round either solves all three targets or none. (Per-target tick/cross is a *feedback* affordance, not a scoring affordance.)

## Flow

**Shape:** Multi-round (default).
**Changes from default:**
- Delete the `Game Over` branch and its `Try Again` motivation transition (lives = 0 means Game Over is unreachable).
- The `Feedback` block has a `~2.5 s reveal animation` sub-step on the any-fail path (pool hexagons glide to canonical positions before auto-advance).
- The CHECK CTA is the FloatingButton in `submit` mode (PART-050) and is disabled until all 13 slots hold a hexagon.
- AnswerComponent (PART-051) renders the canonical correct arrangement of the active set as one slide per round (3 identical slides for the same set).

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌──────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)   │
│ 🔊 prev  │        │ 🔊 welc. │        │ (trans.,     │ (after  │ 🔊 prompt / TTS  │
│   audio  │        │    VO    │        │  no buttons) │  sound) │ Drag pool→slots  │
└──────────┘        └──────────┘        │ 🔊 "Round N" │         │ CHECK (disabled  │
                                        └──────────────┘         │ until 13 placed) │
                                                ▲                └─────────┬────────┘
                                                │                          │ tap CHECK
                                                │                          ▼
                                                │            ┌─────────────────────────────┐
                                                │            │ Per-target tick/cross.      │
                                                │            │ Pass→neutral. Fail→red glow.│
                                                │            │ All-pass: 🔊 correct + TTS  │
                                                │            │ Any-fail: ~2.5s reveal anim │
                                                │            │           🔊 life_lost+TTS  │
                                                │            └─────────┬───────────────────┘
                                                │                      │
                                                │                ┌─────┴────────┐
                                                │                │              │
                                                │          more rounds     last round done
                                                │                │              │
                                                │                ▼              ▼
                                                │       (loop to Round N+1) ┌────────────────────┐
                                                │                           │ Victory (status)   │
                                                │                           │ 0–3★               │
                                                │                           │ 🔊 sound_game_     │
                                                │                           │    victory →       │
                                                │                           │    vo_victory_     │
                                                │                           │    stars_N         │
                                                │                           └──────┬─────┬───────┘
                                                │                                  │     │
                                                │                     "Play Again" │     │ "Claim Stars"
                                                │                     (only if     │     │
                                                │                      0–2★)       ▼     ▼
                                                │                     ┌──────────────────┐  ┌────────────────────────┐
                                                │                     │ "Ready for       │  │ "Yay, stars            │
                                                │                     │  another puzzle?"│  │  collected!"           │
                                                │                     │ (trans., tap)    │  │ (trans., auto,         │
                                                │                     │ 🔊 motivation VO │  │  no buttons)           │
                                                │                     │ [I'm ready]      │  │ 🔊 stars-collected     │
                                                │                     └────────┬─────────┘  │    sound + ✨ star     │
                                                │                              │ tap        │    animation           │
                                                │                              ▼            └──────────┬─────────────┘
                                                └──────── restart from Round 1                         │ auto-handoff
                                                          (skips Preview + Welcome,                    ▼
                                                           cycles round-set A→B→C→A)         ┌─────────────────────────────┐
                                                                                             │ Correct Answers carousel    │
                                                                                             │ (PART-051, 3 slides — one   │
                                                                                             │ per round; all show the     │
                                                                                             │ same canonical board for    │
                                                                                             │ the played set)             │
                                                                                             │ FloatingButton 'next'       │
                                                                                             └──────────┬──────────────────┘
                                                                                                        │ tap Next
                                                                                                        ▼
                                                                                                       exit
```

## Feedback

| Event | Behavior |
|-------|----------|
| Drop on **same-colour** slot | Hexagon snaps in. Soft `sound_bubble_pop` SFX, fire-and-forget, no sticker, no TTS. Re-evaluate CHECK enabled state (enable when all 13 slots filled). |
| Drop on **wrong-colour** slot | Hexagon springs back to pool position with a soft buzz (`sound_bubble_burst`-style SFX), fire-and-forget, no sticker, no TTS. CHECK state unchanged. CASE 9 (micro-interaction). |
| Drag a **placed** hexagon back to pool | Soft `sound_bubble_burst` deselect SFX, fire-and-forget. Re-evaluate CHECK (likely disable). |
| CHECK tapped, **all three targets pass** | Input blocked (`isProcessing = true`). Each target hex shows green tick. All slots flash green for ~600 ms. Awaited `sound_correct_answer` SFX with celebration sticker (CASE 6 round-complete) → awaited dynamic TTS ("Great! Every ring adds up to its target.") with subtitle. ProgressBar bumps FIRST (`progressBar.update(currentRound, 0)`) before audio. Then auto-advance to next round (or to Victory after Round 3). |
| CHECK tapped, **any target fails** | Input blocked. Each target hex shows tick (pass) or cross (fail). Slots in any failing ring glow red (~1.5 s). Reveal animation plays: each pool/placed hexagon glides to its canonical slot over ~2.5 s. Awaited `sound_life_lost` SFX with sad sticker → awaited dynamic TTS ("Almost! Here's how the rings should add up.") with subtitle. ProgressBar bumps FIRST. Then auto-advance to next round (or Victory after Round 3). **No retry within round.** |
| Round complete (auto-advance) | Round transition screen renders (CASE 2 Variant A — auto-advancing, no CTA). Sequential audio: round SFX awaited → round VO awaited. Then Game (Round N+1) renders. |
| Complete all 3 rounds | Victory screen renders (with star count 0–3). `game_complete` postMessage sent BEFORE audio. Victory SFX → Victory VO sequential. CTAs visible: `Play Again` (if <3★) and `Claim Stars`. |
| Tap "Claim Stars" | Routes to "Yay, stars collected!" transition. `sound_stars_collected` awaited → `show_star` postMessage → setTimeout(~1500 ms) → `showAnswerCarousel()` (PART-051). |
| Tap "Play Again" | Routes through "Ready for another puzzle?" motivation transition → `restartGame()` → game restarts from Round 1 (skips Preview + Welcome). Round-set cycles A → B → C → A. ProgressBar reset on the motivation transition's `onMounted` (covers the restart-path entry). |
| AnswerComponent Next tapped | `answerComponent.destroy()`, `previewScreen.destroy()`, `floatingBtn.destroy()`, postMessage `{type:'next_ended'}`. Iframe tears down. |
| Visibility hidden / tab switch (CASE 14) | Timer is N/A; FeedbackManager pauses any in-flight audio; VisibilityTracker's built-in PopupComponent renders the pause overlay (autoShowPopup default — never custom). |
| Visibility restored (CASE 15) | Audio resumes; VisibilityTracker dismisses its own popup; gameplay continues. |
| Audio failure (CASE 16) | All audio calls try/catch wrapped. Visual feedback (tick/cross/red glow/reveal animation) renders regardless. Game advances normally. |

## Content Structure (fallbackContent)

### Geometry & slot ID schema (canonical, identical across all sets)

Three target hexagons:
- **T1** — top-left target
- **T2** — top-right target
- **T3** — bottom-center target

Six **inner blue slots** (slot IDs `inner-1` … `inner-6`) and seven **outer white slots** (slot IDs `outer-1` … `outer-7`):

| Slot ID | Colour | Belongs to ring of |
|---------|--------|---------------------|
| `inner-1` | blue | T1 only |
| `inner-2` | blue | T1 + T2 (shared inner edge between top-left and top-right targets) |
| `inner-3` | blue | T2 only |
| `inner-4` | blue | T2 + T3 (shared inner edge between top-right and bottom targets) |
| `inner-5` | blue | T3 only |
| `inner-6` | blue | T1 + T3 (shared inner edge between top-left and bottom targets) |
| `outer-1` | white | T1 only (outer halo) |
| `outer-2` | white | T1 only (outer halo) |
| `outer-3` | white | T1 + T2 (corner shared between two outer halos) |
| `outer-4` | white | T2 only (outer halo) |
| `outer-5` | white | T2 + T3 (corner shared between two outer halos) |
| `outer-6` | white | T3 only (outer halo) |
| `outer-7` | white | T3 only (outer halo) |

Per-target rings (each is exactly 6 slots):
- **T1 ring (6 slots):** `inner-1`, `inner-2`, `inner-6`, `outer-1`, `outer-2`, `outer-3`
- **T2 ring (6 slots):** `inner-2`, `inner-3`, `inner-4`, `outer-3`, `outer-4`, `outer-5`
- **T3 ring (6 slots):** `inner-4`, `inner-5`, `inner-6`, `outer-5`, `outer-6`, `outer-7`

Membership counts (sanity check, sum to 18 = 3 × 6):
- Inner: `inner-1`(1) + `inner-2`(2) + `inner-3`(1) + `inner-4`(2) + `inner-5`(1) + `inner-6`(2) = 9
- Outer: `outer-1`(1) + `outer-2`(1) + `outer-3`(2) + `outer-4`(1) + `outer-5`(2) + `outer-6`(1) + `outer-7`(1) = 9
- Total = 18 ✓

The build step MUST render this exact slot topology so per-target sum verification matches the canonical mappings below.

### Set A — targets 45, 65, 60

**Pool (13 hexagons, all distinct values):**
- Blue (6): `5`, `10`, `15`, `20`, `25`, `30`
- White (7): `1`, `2`, `3`, `4`, `6`, `7`, `8`

**Canonical correct mapping (the unique solution modulo outer-1↔outer-2 and outer-6↔outer-7 swaps):**

| Slot ID | Colour | Pool value | Contributes to |
|---------|--------|-----------:|----------------|
| `inner-1` | blue | `20` | T1 |
| `inner-2` | blue | `10` | T1, T2 |
| `inner-3` | blue | `30` | T2 |
| `inner-4` | blue | `15` | T2, T3 |
| `inner-5` | blue | `25` | T3 |
| `inner-6` | blue | `5` | T1, T3 |
| `outer-1` | white | `2` | T1 |
| `outer-2` | white | `7` | T1 |
| `outer-3` | white | `1` | T1, T2 |
| `outer-4` | white | `6` | T2 |
| `outer-5` | white | `3` | T2, T3 |
| `outer-6` | white | `4` | T3 |
| `outer-7` | white | `8` | T3 |

**Sum verification:**
- T1 = 20 + 10 + 5 + 2 + 7 + 1 = **45** ✓
- T2 = 10 + 30 + 15 + 1 + 6 + 3 = **65** ✓
- T3 = 15 + 25 + 5 + 3 + 4 + 8 = **60** ✓

**Solvability:** exactly one valid arrangement modulo the outer-1↔outer-2 and outer-6↔outer-7 swaps (verified — exhaustive search of all 6! × 7! colour-respecting placements yields 4 raw solutions = 1 equivalence class).

### Set B — targets 50, 65, 75

**Pool (13 hexagons, all distinct values):**
- Blue (6): `5`, `10`, `15`, `25`, `30`, `35`
- White (7): `1`, `2`, `3`, `4`, `6`, `8`, `9`

**Canonical correct mapping (the unique solution modulo outer-1↔outer-2 and outer-6↔outer-7 swaps):**

| Slot ID | Colour | Pool value | Contributes to |
|---------|--------|-----------:|----------------|
| `inner-1` | blue | `25` | T1 |
| `inner-2` | blue | `5` | T1, T2 |
| `inner-3` | blue | `30` | T2 |
| `inner-4` | blue | `15` | T2, T3 |
| `inner-5` | blue | `35` | T3 |
| `inner-6` | blue | `10` | T1, T3 |
| `outer-1` | white | `1` | T1 |
| `outer-2` | white | `6` | T1 |
| `outer-3` | white | `3` | T1, T2 |
| `outer-4` | white | `8` | T2 |
| `outer-5` | white | `4` | T2, T3 |
| `outer-6` | white | `2` | T3 |
| `outer-7` | white | `9` | T3 |

**Sum verification:**
- T1 = 25 + 5 + 10 + 1 + 6 + 3 = **50** ✓
- T2 = 5 + 30 + 15 + 3 + 8 + 4 = **65** ✓
- T3 = 15 + 35 + 10 + 4 + 2 + 9 = **75** ✓

**Solvability:** exactly one valid arrangement modulo the outer-1↔outer-2 and outer-6↔outer-7 swaps (verified — exhaustive search yields 4 raw solutions = 1 equivalence class).

### Set C — targets 60, 70, 90

**Pool (13 hexagons, all distinct values):**
- Blue (6): `10`, `15`, `20`, `25`, `30`, `40`
- White (7): `1`, `2`, `3`, `4`, `6`, `7`, `9`

**Canonical correct mapping (the unique solution modulo outer-1↔outer-2 and outer-6↔outer-7 swaps):**

| Slot ID | Colour | Pool value | Contributes to |
|---------|--------|-----------:|----------------|
| `inner-1` | blue | `25` | T1 |
| `inner-2` | blue | `10` | T1, T2 |
| `inner-3` | blue | `30` | T2 |
| `inner-4` | blue | `20` | T2, T3 |
| `inner-5` | blue | `40` | T3 |
| `inner-6` | blue | `15` | T1, T3 |
| `outer-1` | white | `3` | T1 |
| `outer-2` | white | `6` | T1 |
| `outer-3` | white | `1` | T1, T2 |
| `outer-4` | white | `7` | T2 |
| `outer-5` | white | `2` | T2, T3 |
| `outer-6` | white | `4` | T3 |
| `outer-7` | white | `9` | T3 |

**Sum verification:**
- T1 = 25 + 10 + 15 + 3 + 6 + 1 = **60** ✓
- T2 = 10 + 30 + 20 + 1 + 7 + 2 = **70** ✓
- T3 = 20 + 40 + 15 + 2 + 4 + 9 = **90** ✓

**Solvability:** exactly one valid arrangement modulo the outer-1↔outer-2 and outer-6↔outer-7 swaps (verified — exhaustive search yields 4 raw solutions = 1 equivalence class).

### Preview-screen content

- `previewInstruction` (HTML):

  ```html
  <p><strong>Hexa Numbers</strong></p>
  <p>Drag the numbered hexagons into the empty slots so the <strong>six hexagons around each target number</strong> add up to that target.</p>
  <p><strong>Blue</strong> hexagons go in <strong>blue</strong> slots; <strong>white</strong> hexagons go in <strong>white</strong> slots. Tap <strong>CHECK</strong> when every slot is filled.</p>
  ```

- `previewAudioText` (plain text, used at deploy time to generate `previewAudio` TTS):

  > "Welcome to Hexa Numbers. Drag the numbered hexagons into the slots so the six hexagons around each target add up to that target's number. Blue hexagons go in blue slots. White hexagons go in white slots. Tap CHECK when every slot is filled."

- `showGameOnPreview`: `false` (board geometry is novel; preview overlay should not show the game state because the colour rule needs explanation first).

### Misconception tags

Because the puzzle has a single canonical solution per set rather than a list of distractor options, misconception tags are attached to **failure modes** rather than to enumerated wrong answers. The build step records the failure mode the student exhibited at CHECK time and tags `recordAttempt` with one of:

| `misconception_tag` | Trigger condition at CHECK time |
|---------------------|--------------------------------|
| `place-value-misread` | At least one target's ring sum is off by an exact factor-of-10 difference (e.g., a tens-digit pool value placed where a ones-digit pool value was needed, or vice versa via the available pool). |
| `additive-shared-blindness` | A shared-slot blue hexagon (`inner-2`, `inner-4`, or `inner-6`) is placed in a shared position but with a value that satisfies only one of the two adjacent targets (the student treated the shared slot as belonging to only one ring). |
| `colour-rule-violated-then-corrected` | The student attempted ≥3 wrong-colour drops during the round (telemetry signal — does not block CHECK because the colour rule auto-rejects, but flags incomplete uptake of the constraint). |
| `single-target-tunnel-vision` | Exactly one target passes and the other two fail — the student locked one ring early and could not balance the others. |
| `whole-board-mismatch` | All three targets fail and no clear pattern matches above — generic "did not converge" tag. |

The `misconception_tags` field on each round object lists the *possible* tags for that round; the runtime selects the matching one(s) at CHECK time and includes them in the `recordAttempt` payload.

### Round answer payload (PART-051)

Each round's `answer` payload is the canonical mapping for that round's set. The shape:

```js
answer: {
  targets: { T1: <int>, T2: <int>, T3: <int> },
  placement: {
    'inner-1': <int>, 'inner-2': <int>, 'inner-3': <int>,
    'inner-4': <int>, 'inner-5': <int>, 'inner-6': <int>,
    'outer-1': <int>, 'outer-2': <int>, 'outer-3': <int>,
    'outer-4': <int>, 'outer-5': <int>, 'outer-6': <int>,
    'outer-7': <int>
  },
  rings: {
    T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
    T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
    T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
  }
}
```

`renderAnswerForRound(round, container)` renders the solved board (every slot filled with its canonical pool value, every target showing a green tick) — NOT the input pool tray and NOT the drag affordances.

### `fallbackContent` object

```js
const fallbackContent = {
  // Preview (PART-039)
  previewInstruction: '<p><strong>Hexa Numbers</strong></p><p>Drag the numbered hexagons into the empty slots so the <strong>six hexagons around each target number</strong> add up to that target.</p><p><strong>Blue</strong> hexagons go in <strong>blue</strong> slots; <strong>white</strong> hexagons go in <strong>white</strong> slots. Tap <strong>CHECK</strong> when every slot is filled.</p>',
  previewAudioText: "Welcome to Hexa Numbers. Drag the numbered hexagons into the slots so the six hexagons around each target add up to that target's number. Blue hexagons go in blue slots. White hexagons go in white slots. Tap CHECK when every slot is filled.",
  previewAudio: null,            // patched at deploy time by TTS pipeline
  showGameOnPreview: false,

  // Session config
  totalRounds: 3,                // 3 rounds per session (per set)
  totalLives: 0,                 // No lives — Board Puzzle one-shot CHECK
  timer: false,                  // No timer

  // Geometry shared by every round
  geometry: {
    targets: ['T1', 'T2', 'T3'],
    innerSlots: ['inner-1','inner-2','inner-3','inner-4','inner-5','inner-6'],
    outerSlots: ['outer-1','outer-2','outer-3','outer-4','outer-5','outer-6','outer-7'],
    slotColour: {
      'inner-1':'blue','inner-2':'blue','inner-3':'blue','inner-4':'blue','inner-5':'blue','inner-6':'blue',
      'outer-1':'white','outer-2':'white','outer-3':'white','outer-4':'white','outer-5':'white','outer-6':'white','outer-7':'white'
    },
    rings: {
      T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
      T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
      T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
    }
  },

  rounds: [
    // ───────────── Set A — 3 rounds, same puzzle, B1/B2/B3 cosmetic skin ─────────────
    {
      set: 'A',
      id: 'A_r1_hexa',
      round: 1,
      stage: 1,
      type: 'hexa-board',
      variant: 'B1',
      skin: { targetColour: 'teal-grey', glyph: 'sun-burst' },
      targets: { T1: 45, T2: 65, T3: 60 },
      pool: {
        blue:  [5, 10, 15, 20, 25, 30],
        white: [1, 2, 3, 4, 6, 7, 8]
      },
      correctPlacement: {
        'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
        'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
        'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
      },
      answer: {
        targets: { T1: 45, T2: 65, T3: 60 },
        placement: {
          'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
          'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
          'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'A',
      id: 'A_r2_hexa',
      round: 2,
      stage: 2,
      type: 'hexa-board',
      variant: 'B2',
      skin: { targetColour: 'green', glyph: 'leaf' },
      targets: { T1: 45, T2: 65, T3: 60 },
      pool: {
        blue:  [5, 10, 15, 20, 25, 30],
        white: [1, 2, 3, 4, 6, 7, 8]
      },
      correctPlacement: {
        'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
        'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
        'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
      },
      answer: {
        targets: { T1: 45, T2: 65, T3: 60 },
        placement: {
          'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
          'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
          'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'A',
      id: 'A_r3_hexa',
      round: 3,
      stage: 3,
      type: 'hexa-board',
      variant: 'B3',
      skin: { targetColour: 'green', glyph: 'star' },
      targets: { T1: 45, T2: 65, T3: 60 },
      pool: {
        blue:  [5, 10, 15, 20, 25, 30],
        white: [1, 2, 3, 4, 6, 7, 8]
      },
      correctPlacement: {
        'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
        'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
        'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
      },
      answer: {
        targets: { T1: 45, T2: 65, T3: 60 },
        placement: {
          'inner-1': 20, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 15, 'inner-5': 25, 'inner-6': 5,
          'outer-1': 2,  'outer-2': 7,  'outer-3': 1,
          'outer-4': 6,  'outer-5': 3,  'outer-6': 4, 'outer-7': 8
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },

    // ───────────── Set B — 3 rounds, same puzzle, B1/B2/B3 cosmetic skin ─────────────
    {
      set: 'B',
      id: 'B_r1_hexa',
      round: 1,
      stage: 1,
      type: 'hexa-board',
      variant: 'B1',
      skin: { targetColour: 'teal-grey', glyph: 'sun-burst' },
      targets: { T1: 50, T2: 65, T3: 75 },
      pool: {
        blue:  [5, 10, 15, 25, 30, 35],
        white: [1, 2, 3, 4, 6, 8, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
        'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
        'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
        'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
      },
      answer: {
        targets: { T1: 50, T2: 65, T3: 75 },
        placement: {
          'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
          'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
          'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
          'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'B',
      id: 'B_r2_hexa',
      round: 2,
      stage: 2,
      type: 'hexa-board',
      variant: 'B2',
      skin: { targetColour: 'green', glyph: 'leaf' },
      targets: { T1: 50, T2: 65, T3: 75 },
      pool: {
        blue:  [5, 10, 15, 25, 30, 35],
        white: [1, 2, 3, 4, 6, 8, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
        'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
        'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
        'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
      },
      answer: {
        targets: { T1: 50, T2: 65, T3: 75 },
        placement: {
          'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
          'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
          'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
          'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'B',
      id: 'B_r3_hexa',
      round: 3,
      stage: 3,
      type: 'hexa-board',
      variant: 'B3',
      skin: { targetColour: 'green', glyph: 'star' },
      targets: { T1: 50, T2: 65, T3: 75 },
      pool: {
        blue:  [5, 10, 15, 25, 30, 35],
        white: [1, 2, 3, 4, 6, 8, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
        'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
        'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
        'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
      },
      answer: {
        targets: { T1: 50, T2: 65, T3: 75 },
        placement: {
          'inner-1': 25, 'inner-2': 5,  'inner-3': 30,
          'inner-4': 15, 'inner-5': 35, 'inner-6': 10,
          'outer-1': 1,  'outer-2': 6,  'outer-3': 3,
          'outer-4': 8,  'outer-5': 4,  'outer-6': 2, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },

    // ───────────── Set C — 3 rounds, same puzzle, B1/B2/B3 cosmetic skin ─────────────
    {
      set: 'C',
      id: 'C_r1_hexa',
      round: 1,
      stage: 1,
      type: 'hexa-board',
      variant: 'B1',
      skin: { targetColour: 'teal-grey', glyph: 'sun-burst' },
      targets: { T1: 60, T2: 70, T3: 90 },
      pool: {
        blue:  [10, 15, 20, 25, 30, 40],
        white: [1, 2, 3, 4, 6, 7, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
        'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
        'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
      },
      answer: {
        targets: { T1: 60, T2: 70, T3: 90 },
        placement: {
          'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
          'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
          'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'C',
      id: 'C_r2_hexa',
      round: 2,
      stage: 2,
      type: 'hexa-board',
      variant: 'B2',
      skin: { targetColour: 'green', glyph: 'leaf' },
      targets: { T1: 60, T2: 70, T3: 90 },
      pool: {
        blue:  [10, 15, 20, 25, 30, 40],
        white: [1, 2, 3, 4, 6, 7, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
        'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
        'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
      },
      answer: {
        targets: { T1: 60, T2: 70, T3: 90 },
        placement: {
          'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
          'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
          'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    },
    {
      set: 'C',
      id: 'C_r3_hexa',
      round: 3,
      stage: 3,
      type: 'hexa-board',
      variant: 'B3',
      skin: { targetColour: 'green', glyph: 'star' },
      targets: { T1: 60, T2: 70, T3: 90 },
      pool: {
        blue:  [10, 15, 20, 25, 30, 40],
        white: [1, 2, 3, 4, 6, 7, 9]
      },
      correctPlacement: {
        'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
        'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
        'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
        'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
      },
      answer: {
        targets: { T1: 60, T2: 70, T3: 90 },
        placement: {
          'inner-1': 25, 'inner-2': 10, 'inner-3': 30,
          'inner-4': 20, 'inner-5': 40, 'inner-6': 15,
          'outer-1': 3,  'outer-2': 6,  'outer-3': 1,
          'outer-4': 7,  'outer-5': 2,  'outer-6': 4, 'outer-7': 9
        },
        rings: {
          T1: ['inner-1','inner-2','inner-6','outer-1','outer-2','outer-3'],
          T2: ['inner-2','inner-3','inner-4','outer-3','outer-4','outer-5'],
          T3: ['inner-4','inner-5','inner-6','outer-5','outer-6','outer-7']
        }
      },
      misconception_tags: {
        'place-value-misread': 'place-value-misread',
        'additive-shared-blindness': 'additive-shared-blindness',
        'colour-rule-violated-then-corrected': 'colour-rule-violated-then-corrected',
        'single-target-tunnel-vision': 'single-target-tunnel-vision',
        'whole-board-mismatch': 'whole-board-mismatch'
      }
    }
  ]
};
```

**Round-set cycling check:** `rounds.length === 9 === totalRounds (3) × 3 sets`. Every round has a `set` key (`'A' | 'B' | 'C'`). All `id` values are globally unique (`A_r1_hexa` through `C_r3_hexa`). Set A's R1 ≈ Set B's R1 ≈ Set C's R1 in difficulty (all are the same puzzle archetype, 2-digit targets in the 40–90 range, 13 same-shape pool hexagons). Validator `GEN-ROUNDSETS-MIN-3` passes.

## Defaults Applied
- **Bloom Level:** creator specified L4 Analyze (no default applied).
- **Lives:** creator specified 0 — overrides the L4 default of "None or 5" with explicit `0` (no penalty mechanic at all).
- **Timer:** creator specified None (no default applied).
- **Rounds count:** creator specified 3 (overrides Board Puzzle default of 3 — coincidentally the same).
- **Star thresholds:** creator specified 3/2/1/0 first-CHECK solves → 3★/2★/1★/0★ (no default applied).
- **Round-set cycling sets:** creator specified Sets A / B / C with explicit target triples; intra-set values (pool numbers + canonical placement) defaulted by spec author to satisfy the colour-gated unique-solution constraint (creator did not specify pool composition, only target sums).
- **Slot ID schema (`inner-1..6`, `outer-1..7`) and per-target ring memberships:** creator described the geometry in prose ("6 inner blue", "7 outer white", "some inner shared between two adjacent targets", "a few corners shared between two outer halos"); spec author defaulted the exact slot IDs and ring assignments to a concrete topology consistent with the prose and with 3 × 6 = 18 ring memberships.
- **Misconception tag taxonomy:** creator did not enumerate misconceptions; spec author defaulted to a 5-tag taxonomy keyed to failure-mode telemetry signals (`place-value-misread`, `additive-shared-blindness`, `colour-rule-violated-then-corrected`, `single-target-tunnel-vision`, `whole-board-mismatch`).
- **Cosmetic skins (B1/B2/B3 colour + glyph):** creator specified colours (dark teal-grey for B1; dark green for B2 + B3) and glyph labels (A/B/C); spec author defaulted glyph identities to `sun-burst`, `leaf`, `star` (concrete iconography for the build step).
- **Reveal animation duration:** creator described "brief reveal of the correct arrangement"; spec author defaulted to ~2.5 s glide animation.
- **Failed-CHECK SFX:** creator described a "soft buzz" for wrong-colour drops; spec author defaulted the all-fail CHECK to `sound_life_lost` (CASE 7-style) since lives = 0 makes "life lost" a cosmetic SFX, not a state mutation.
- **`previewScreen: true`** (PART-039 default; creator did not opt out).
- **`showGameOnPreview: false`** (board geometry novel; preview should explain colour rule before showing the board).
- **`autoShowStar: true`** (default).
- **`previewAudioText`:** spec author drafted; will be patched into `previewAudio` at deploy time.
- **NCERT chapter alignment:** creator named only Class 4–6 grade band; spec author mapped to Class 4 / 5 NCERT place-value & addition chapters.

(Per the spec-creation skill, `answerComponent: true` is the silent default and is NOT listed here. Creator did not opt out, so the carousel ships.)

## Warnings
- **WARNING — Bloom L4 with no penalty (lives = 0).** The pedagogy table lists "None or 5" lives at L4. This game uses 0 — explicitly creator-chosen ("no lives, no game-over"). Acceptable because the round-set cycling (Sets A→B→C) plus the within-set fluency repeats (B1/B2/B3) provide the iteration cushion that lives normally provide. No change needed; just flagging the deviation.
- **WARNING — One-shot CHECK with no in-round retry.** Standard L4 Board Puzzle scaffolding allows undo / re-arrange before commit (which this game DOES allow — student can drag placed hexagons back to the pool freely until CHECK is tapped) but no re-CHECK within a round. The creator made this an explicit design choice — the reveal animation IS the scaffold. This is unusual relative to default Board Puzzle behavior; building it requires that the FloatingButton's submit handler set `isProcessing = true` permanently for the round (until auto-advance fires).
- **WARNING — Solvability uniqueness verified modulo trivial outer-slot symmetry.** Each set's pool was brute-force enumerated at spec-review time over all 6! × 7! = 3,628,800 colour-respecting permutations. Result: each set has **exactly 4 raw solutions** = **1 equivalence class** under the topologically-trivial swaps `outer-1 ↔ outer-2` (both are T1-only outer slots) and `outer-6 ↔ outer-7` (both are T3-only outer slots). These swaps are gameplay-irrelevant: both members of each pair share the same target-ring membership, so swapping their values changes nothing about which targets pass. CHECK is sum-based, so all 4 symmetric variants are accepted as correct, which is the correct runtime behaviour. The build step SHOULD re-run the exhaustive search as a build-time guard and FAIL the build if any set produces more than 4 raw solutions or fewer than 1.
- **WARNING — Drag-and-drop on cheap Android (P6).** Per CLAUDE.md routing table, Step 4 (Build) MUST run in MAIN CONTEXT for this spec because P6 requires the orchestrator to call `mcp__context7__query-docs` for the `@dnd-kit/dom@beta` API (`https://esm.sh/@dnd-kit/dom@beta`). Mobile rule #22 applies: `touch-action: none` MUST be on draggable hexagons only, NEVER on the board container or pool tray (would kill page scroll). Mobile rule #16 applies: `touch-action: none` MUST NOT be on drop-zones. Validator `GEN-DND-KIT` should pass.
- **WARNING — Hexagon touch target size on 375 px viewport.** With 13 slot hexagons + 13 pool hexagons all in the lower 60% of a 375-wide viewport, each effective touch target must remain ≥ 44 × 44 CSS px (mobile rule #9, CRITICAL). Build step must lay out the board area (~340 × ~280 px) with hexagons at ~52 px point-to-point so the touch ellipse stays comfortably above 44 px. The pool tray at the bottom needs a 13-tile horizontal strip — with hex tiles at 52 px and ~6 px spacing this overflows 375 px, so the pool tray MUST scroll horizontally OR wrap to two rows of 6+7. Spec recommends two rows in the pool tray (blue row of 6, white row of 7 or vice versa).
- **WARNING — Cosmetic-only difference between R1, R2, R3 within a set.** A student who solves R1 will solve R2 and R3 trivially (same puzzle, same pool, same answer). This is intentional per the creator ("Students who solved Round 1 demonstrate fluency on Rounds 2/3"), but worth flagging because it makes the final star count strongly bimodal (typical sessions will end at 0★ or 3★, rarely 1★ or 2★ except when a student has a slip-of-the-finger CHECK on R1 then re-thinks for R2). Subjective evaluation should not be alarmed by the bimodal distribution.
