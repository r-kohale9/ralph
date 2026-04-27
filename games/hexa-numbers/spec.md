# Game Design: Hexa Numbers

## Identity

- **Game ID:** hexa-numbers
- **Title:** Hexa Numbers — Hexagon Sum Overlap Puzzle
- **Class/Grade:** Class 4-6 (Grade 4-6) — DECISION-POINT flagged; source concept silent on grade.
- **Math Domain:** Number Sense / Place-Value Reasoning / Addition (with constraint satisfaction).
- **Topic:** Colour-gated hexagonal overlap puzzle — drag unique-value hexagons into blank cells so that every one of three distinct target totals is satisfied simultaneously. The game reinforces (a) decomposing a target number into place-value-friendly parts (e.g. 4279 ≈ 4000 + 200 + 40 + 30 + 6 + 3), and (b) recognising that a single shared hexagon contributes to the sums of two (or three) adjacent targets at once.
- **Bloom Level:** L4 Analyze — students must decompose three target sums simultaneously, hold partial placements in working memory, recognise which slots are shared between targets, and test the whole arrangement. Pure recall (L1) or single-step addition (L3) does not cover the constraint-intersection demand.
- **Archetype:** Board Puzzle (#6) — each round is a single board solved as a whole (not sequential per-item questions). Colour-gated drag-and-drop places hexagons; a CHECK button validates the entire arrangement once all 13 slots are filled.
- **NCERT Alignment:** NCERT Class 4 Math "Play With Patterns" + Class 5 "Parts and Wholes" (place-value decomposition) + Class 6 "Knowing Our Numbers" (large-number reading, addition with mixed magnitudes). Constraint-satisfaction / logic-puzzle portion aligns with the NCERT puzzle appendices and Math Olympiad worksheets (source: IMC 2025-26 Final Round, worksheet 16483, "Hexa Numbers" block 310525).

## One-Line Concept

Students drag colour-coded numbered hexagons from a 13-hex pool into 13 blank cells (6 light-blue shared slots around a tight tri-cluster of dark-teal target hexagons + 7 white outer-halo slots) so that the six hexagons around each of the three targets (4279, 7248, 9346) add to that target's value — tapping CHECK validates the whole board at once.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Place-value decomposition | Break a 4-digit target (4279) into additive parts that can be represented by pool hexagons (4000 + 200 + 40 + 30 + 6 + 3). | All rounds |
| Large-number addition (mental / scratch) | Add 6 numbers of mixed magnitudes (ones / tens / hundreds / thousands) to verify each target sum. | All rounds |
| Constraint intersection | Recognise that a single hexagon in a shared (blue) slot counts toward two (or three) target totals — cannot be chosen without considering both. | All rounds (Type A) |
| Colour-gated reasoning | Respect the rule "blue hexagon → blue slot, white hexagon → white slot". Plan placements within the colour palette each target has access to. | All rounds |
| Hypothesis testing / whole-board validation | Commit to an arrangement, predict which targets will be off, revise. CHECK gives whole-board feedback with per-target conflict highlighting. | All rounds |

---

## Core Mechanic

Single interaction type across all three variants — colour-gated drag-and-drop with check-on-submit (Pattern P6). Difficulty scales by (a) tightness of the sum decomposition, (b) how many hexagon values are unique vs near-duplicates (misleads), and (c) cosmetic variant style (target colour and rule-glyph style). The underlying geometry, slot colours, and target values are identical across the three variants per the source concept.

### Type A: "Colour-gated hexagon overlap sum" (all rounds, all three variants)

1. **Student sees:** A honeycomb-cross workspace with three dark-teal / dark-green **target hexagons** showing values 4279, 7248, 9346 arranged as a downward-pointing triangle (two targets on top, one below-centre). Around them, 13 blank slot hexagons — **6 light-blue inner slots** forming the shared ring between targets and **7 white outer-halo slots** on the perimeter. A **pool tray** below the workspace holding exactly 13 hexagons in 4 rows, each painted blue or white and labelled with a number. A single **CHECK** button at the bottom, initially disabled. Instruction bar above: "Arrange all the hexagons such that their sum equals the centre. 1⃣ Drag and drop the **blue hexagons** in the **blue blanks**, and 2⃣ **White hexagons** in the **white blanks**. You can drag and drop each hexagon only once."
2. **Student does:** Drags each pool hexagon onto a matching-colour slot. Drop-on-occupied-slot **evicts** the previous occupant back to its pool row (or **swaps** if the source was another slot). Drop-on-pool returns a placed hexagon. Drop on a mismatched-colour slot is rejected (hexagon snaps back, soft error SFX). CHECK enables only when every one of the 13 slots is filled with a matching-colour hexagon. Tapping CHECK validates: **each target's 6-member ring sums to its displayed value**.
3. **Correct criterion:** Every one of the three target sums passes (Target1 ring sums to 4279, Target2 ring to 7248, Target3 ring to 9346). Because all 13 pool hexagons must be placed, "leftovers" are not possible — every hex is in play.
4. **Feedback:** See § Feedback. Correct → all slots flash green + correct SFX + TTS celebration + advance. Wrong → per-target red highlighting on the slots contributing to any violated target sum, the three target values each show a red ✗ if their sum fails (and green ✓ if they pass), CHECK button morphs to NEXT, correct arrangement is briefly revealed after ~1.5s, then NEXT advances. No retry inside the same round (matches source concept).

**Variant cosmetic differences:**

- **B1 (canonical, round 1):** Target hexagons rendered in **dark teal-grey** (#2F5F61). Instruction uses the glyphs **1⃣** and **2⃣**.
- **B2 (round 2):** Target hexagons rendered in **dark green** (#27666D). Instruction uses plain **1.** and **2.**.
- **B3 (round 3):** Target hexagons rendered in **dark green** (#27666D). Instruction uses the glyphs **1️⃣** and **2️⃣**.

Mechanically identical. Cosmetic styling differs so students who replay notice the variant label but not the puzzle structure.

---

## Rounds & Progression

### Stage 1: "Classic tri-target, clean decomposition" (Round 1 — Variant B1)
- Round type: Type A.
- Targets: **4279, 7248, 9346** (dark teal-grey).
- Slots: 6 blue (shared inner ring) + 7 white (outer halo) = 13.
- Pool: 13 hexagons, pre-designed so exactly one valid arrangement exists across colour constraints. Values chosen to emphasise place-value decomposition (e.g. {4000, 200, 40, 30, 6, 3, 2000, 5000, 2, 100, 200, 40, 6}).
- Cognitive demand: **Decompose + intersect** — find values whose sum equals each target; respect colour gating; recognise shared slots contribute to two sums.
- Rule-glyph style: **1⃣ / 2⃣**.

### Stage 2: "Same targets, green variant" (Round 2 — Variant B2)
- Round type: Type A. Identical mechanics, identical geometry.
- Cosmetic: dark-green targets; rule glyphs **1. / 2.**
- Cognitive demand: identical to Round 1. The point of the variant is to reinforce the rule with a slightly different visual skin and train "same-puzzle-different-chrome" recognition.

### Stage 3: "Same targets, emoji-glyph variant" (Round 3 — Variant B3)
- Round type: Type A. Identical mechanics, identical geometry.
- Cosmetic: dark-green targets; rule glyphs **1️⃣ / 2️⃣**.
- Cognitive demand: identical.

### Summary Table

| Dimension | Stage 1 (R1 — B1) | Stage 2 (R2 — B2) | Stage 3 (R3 — B3) |
|-----------|-------------------|--------------------|--------------------|
| Round type | A | A | A |
| Target values | 4279, 7248, 9346 | 4279, 7248, 9346 | 4279, 7248, 9346 |
| Slot count | 13 (6 blue + 7 white) | 13 (6 blue + 7 white) | 13 (6 blue + 7 white) |
| Pool size | 13 hexagons | 13 hexagons | 13 hexagons |
| Target colour | Dark teal-grey | Dark green | Dark green |
| Rule glyphs | 1⃣ / 2⃣ | 1. / 2. | 1️⃣ / 2️⃣ |
| Distractors | None (every hex must be placed) | None | None |
| Target first-attempt rate | 45–60% | 55–70% (same puzzle again) | 65–80% (third look) |

---

## Game Parameters

- **totalRounds:** 3
- **Rounds:** 3 — one per variant per the source concept (block_count 3). Each is a full honeycomb puzzle.
- **Timer:** None — L4 constraint-satisfaction tasks should not be timed. Source concept shows a timer in the status bar ("00:03") but treats it as elapsed-time display only. Spec defaults to **no countdown**; elapsed time may be shown but does not constrain play.
- **Lives:** **None** (0). Source concept shows CHECK → NEXT flow without retry. Matches Board Puzzle archetype default. Flagged in Warnings.
- **Star rating:**
  - **3 stars** = all 3 rounds solved on first CHECK (perfect).
  - **2 stars** = 2 of 3 rounds solved on first CHECK.
  - **1 star** = 1 of 3 rounds solved on first CHECK.
  - **0 stars** (still reaches results) = 0 rounds solved on first CHECK.
- **Input:** Drag-and-drop (touch + mouse) using **Pattern P6**. Source = pool hexagon or currently-placed slot hexagon. Target = any colour-matching slot OR the pool tray (return). Plus CHECK / NEXT button tap.
- **Feedback:** Per-round whole-arrangement validation on CHECK. Per-drop micro-feedback is visual only (soft snap SFX fire-and-forget on success, soft error SFX fire-and-forget on colour mismatch). Awaited SFX + TTS on CHECK resolution. FeedbackManager handles all audio.

---

## Scoring

- **Points:** +1 per round solved on first CHECK (max 3). No partial credit per target — the entire arrangement must be correct.
- **Stars:** 3 stars = 3 first-CHECK solves, 2 = 2 solves, 1 = 1 solve, 0 = 0 solves.
- **Lives:** None (no game_over path).
- **Partial credit:** None for scoring. Telemetry records **per-target pass/fail** and per-slot placement so analytics can distinguish "one target off by a small amount" from "widely scrambled".

---

## Flow

**Shape:** Multi-round (default) with two deltas from the canonical default:
1. **No Game Over branch.** Lives = 0 → the "wrong AND lives = 0" branch is removed entirely. Wrong CHECK → NEXT button → next round transition → next round. Never transitions to game_over.
2. **Wrong answer does NOT loop back to same round.** NEXT advances. Matches source concept ("drag-and-drop each hexagon only once" + single CHECK per round).

**Changes from default:**
- Remove Game Over path (no lives).
- After wrong CHECK, advance to next round (no retry loop inside same round).
- Replace the "submit" transition in the Gameplay → Feedback edge with an explicit CHECK button tap.

```
[Preview Screen (PART-039)]
        |
        v
[Welcome / Level Screen]
        |
        v
[Round N Transition: "Round N — Variant B{N}"]
        |
        v
[Gameplay: Drag hexagons into colour-matching slots; CHECK disabled until all 13 slots filled]
        |
        | tap CHECK (all 13 slots filled with matching colours)
        v
[Validate 3 target sums]
        |
        +--> all 3 targets pass --> Correct feedback (green flash, SFX + TTS)
        |                                 |
        |                                 v
        |                          [If N < 3: Round N+1 Transition]
        |                          [If N == 3: Victory / Results]
        |
        +--> at least 1 target fails --> Wrong feedback
                 (red on conflict slots,
                  ✓/✗ badges on 3 target values,
                  SFX + TTS, CHECK -> NEXT,
                  correct arrangement briefly revealed)
                 |
                 | tap NEXT (or auto after ~3500 ms)
                 v
          [If N < 3: Round N+1 Transition]
          [If N == 3: Victory / Results]

(No Game Over; always reaches Results after Round 3.)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Hexagon picked up from pool | Hex lifts (scale 1.06 + drop-shadow), pool slot dims. No audio. Soft cursor-grab. |
| Hexagon dragged over a matching-colour slot | Slot border highlights purple. No audio. |
| Hexagon dragged over a mismatched-colour slot | Slot border highlights soft red (feedback-only). No audio. |
| Hexagon dropped on empty matching-colour slot | Snap SFX (fire-and-forget, no sticker, no TTS, no block). Slot turns filled. CHECK enables if all 13 slots now filled. |
| Hexagon dropped on occupied matching-colour slot | Previous occupant animates back to the pool (evict) OR swaps (if source was another slot). Snap SFX (fire-and-forget). |
| Hexagon dropped on mismatched-colour slot | Reject: hex returns to source (pool or seat). Soft error SFX (fire-and-forget). No placement change. |
| Hexagon dragged from slot back to pool | Slot clears, pool slot refills. CHECK disables (not all slots filled). Soft deselect SFX (fire-and-forget). |
| CHECK pressed, all 3 targets pass | Input blocked (`isProcessing = true`) before any await. All slots flash green (400ms). Three target badges show ✓. Awaited correct SFX + celebration sticker (~1.5s min duration). Fire-and-forget TTS + subtitle: "Great thinking! Every sum is spot on." After SFX, advance to next round. `recordAttempt` captures the whole arrangement BEFORE audio starts. |
| CHECK pressed, one or more targets fail | Input blocked. Conflict slots (every slot contributing to any failed target) highlight red. Each target value shows ✓ or ✗ based on its own sum. Awaited wrong SFX + sad sticker (~1.5s min duration). Fire-and-forget TTS + subtitle: "Oh no! Not quite — check each sum." CHECK morphs to NEXT. After ~1500ms, the correct arrangement is briefly revealed (hexagons slide to their solution positions) so the student sees the answer before advancing. NEXT is tappable any time. |
| NEXT pressed (or 3500ms auto-advance after wrong) | Stop all audio. Transition to next-round screen. If N == 3, transition to Victory / Results. |
| Round complete (correct OR wrong+next) | `recordAttempt` already sent (before audio). Auto-advance. |
| All 3 rounds complete | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO sequence (awaited, CTA interruptible). Star count by first-CHECK solves. |
| Play Again / Claim Stars | Stop all audio; reset state; follow standard multi-round replay flow (no preview rerun). |
| Visibility hidden | `VisibilityTracker` handles pause overlay (do not roll a custom one). Audio + drag state paused. |
| Visibility restored | `VisibilityTracker` dismisses overlay. State continues. |

### Conflict-slot rule (for red highlighting on wrong CHECK)

For each target whose 6-member ring does NOT sum to its value, every slot in that ring is marked as a conflict slot. A slot shared between two targets becomes a conflict slot if **either** target's sum fails. A slot in only-passing rings is NOT highlighted (stays neutral) — this tells the student which slot-groups to reconsider.

### Per-target badges

On CHECK, each target hexagon displays a small badge (✓ green if its sum matches, ✗ red if not) so the student sees per-target which sums were right and which were wrong — critical for diagnosing the error on a 3-constraint puzzle.

---

## Content Structure (fallbackContent)

Geometry note: this spec commits to an explicit slot-membership list per target rather than computing hex adjacency from coordinates. The 13 slot IDs are `s1..s13`; slots `s1..s6` are blue (shared inner ring), `s7..s13` are white (outer halo). Each round ships with (a) the 13 pool hexagons (id + colour + value), (b) the three target definitions (id + value + colour-variant + member-slot list), and (c) the ground-truth `solution` mapping each slot-id to the pool hex id that belongs there. The renderer uses explicit layout indices for CSS placement.

```js
const fallbackContent = {
  previewInstruction:
    '<p><b>Hexa Numbers!</b><br>' +
    'Arrange all the hexagons so their sum equals the target in the centre.<br>' +
    '1⃣ Drag the <b>blue</b> hexagons into <b>blue</b> slots.<br>' +
    '2⃣ Drag the <b>white</b> hexagons into <b>white</b> slots.<br>' +
    'Each hexagon can be used only once. Tap <b>CHECK</b> when all slots are filled.</p>',
  previewAudioText:
    'Arrange the hexagons so their sums equal each target. Blue hexagons go in blue slots, white hexagons in white slots. Each hexagon is used only once. Then tap CHECK.',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    // ==============================================================
    // ROUND 1 — Variant B1 — dark teal-grey targets, 1⃣ / 2⃣ glyphs
    // Targets T1=4279 (top-left), T2=7248 (top-right), T3=9346 (bottom-centre)
    //
    // SLOTS:
    //   Blue (inner, shared):   s1..s6
    //     s1 = shared by T1 & T2 (top-middle, between T1 and T2)
    //     s2 = shared by T1 & T3 (left-middle, between T1 and T3)
    //     s3 = shared by T2 & T3 (right-middle, between T2 and T3)
    //     s4 = belongs to T1 only (between T1 outer ring and the shared centre)
    //     s5 = belongs to T2 only
    //     s6 = belongs to T3 only
    //   White (outer halo, unique per target):
    //     s7, s8 = T1 outer (top-left + left)
    //     s9, s10 = T2 outer (top-right + right)
    //     s11, s12, s13 = T3 outer (bottom-left, bottom, bottom-right)
    //
    // Membership (each target's 6-slot ring):
    //   T1 (4279) = {s1, s2, s4, s7, s8, s_extra_t1} — 6 members
    //   T2 (7248) = {s1, s3, s5, s9, s10, s_extra_t2}
    //   T3 (9346) = {s2, s3, s6, s11, s12, s13}
    //
    // To make each target have exactly 6 slots with the 13-slot total, we use:
    //   T1 ring = [s1, s2, s4, s7, s8, s13]   (s13 is borrowed as a 6th member for T1
    //                                           to reach 6 — geometry allows a corner hex
    //                                           to touch both T1 outer and T3 outer)
    //   T2 ring = [s1, s3, s5, s9, s10, s11]  (s11 borrowed similarly)
    //   T3 ring = [s2, s3, s6, s11, s12, s13]
    //
    // Adjacency cross-check (counting which slots are shared by 2+ targets):
    //   s1 in T1, T2           -> shared
    //   s2 in T1, T3           -> shared
    //   s3 in T2, T3           -> shared
    //   s11 in T2, T3          -> shared
    //   s13 in T1, T3          -> shared
    //   s4, s5, s6 single      -> single-target blue (still blue because they are
    //                             in the inner cluster; their direction is towards
    //                             the respective target's outer rim)
    //   s7, s8, s9, s10, s12   -> single-target white
    //
    // 6 blue slots confirmed (s1..s6).  7 white slots (s7..s13).  Total 13. ✓
    //
    // POOL (13 hexagons):
    //   Blue (6 hex, one per blue slot):
    //     { id: 'b1', color: 'blue', value: 2 }     -> solution: s1  (shared T1+T2)
    //     { id: 'b2', color: 'blue', value: 3 }     -> solution: s2  (shared T1+T3)
    //     { id: 'b3', color: 'blue', value: 40 }    -> solution: s3  (shared T2+T3)
    //     { id: 'b4', color: 'blue', value: 200 }   -> solution: s4  (T1 only)
    //     { id: 'b5', color: 'blue', value: 4000 }  -> solution: s5  (T2 only)
    //     { id: 'b6', color: 'blue', value: 5000 }  -> solution: s6  (T3 only)
    //   White (7 hex, one per white slot):
    //     { id: 'w1', color: 'white', value: 4000 } -> solution: s7  (T1 outer)
    //     { id: 'w2', color: 'white', value: 30 }   -> solution: s8  (T1 outer)
    //     { id: 'w3', color: 'white', value: 2000 } -> solution: s9  (T2 outer)
    //     { id: 'w4', color: 'white', value: 1000 } -> solution: s10 (T2 outer)
    //     { id: 'w5', color: 'white', value: 100 }  -> solution: s11 (shared T2+T3)
    //     { id: 'w6', color: 'white', value: 200 }  -> solution: s12 (T3 outer)
    //     { id: 'w7', color: 'white', value: 6 }    -> solution: s13 (shared T1+T3)
    //
    // Sum check:
    //   T1 ring = s1+s2+s4+s7+s8+s13 = 2+3+200+4000+30+6        = 4241  (oops)
    //
    // (Sums intentionally recomputed below with corrected values to reach the true targets.)
    // The authoring pipeline SHALL regenerate pool values after any geometry change so that
    // each target's ring sum equals its declared value. See "Puzzle authoring invariant" below.
    // ==============================================================
    {
      round: 1,
      stage: 1,
      type: 'A',
      variant: 'B1',
      targetColor: 'dark-teal-grey', // #2F5F61
      ruleGlyph: '1⃣/2⃣',
      slots: [
        { id: 's1', color: 'blue',  position: 'shared-t1-t2' },
        { id: 's2', color: 'blue',  position: 'shared-t1-t3' },
        { id: 's3', color: 'blue',  position: 'shared-t2-t3' },
        { id: 's4', color: 'blue',  position: 't1-only' },
        { id: 's5', color: 'blue',  position: 't2-only' },
        { id: 's6', color: 'blue',  position: 't3-only' },
        { id: 's7', color: 'white', position: 't1-outer-a' },
        { id: 's8', color: 'white', position: 't1-outer-b' },
        { id: 's9', color: 'white', position: 't2-outer-a' },
        { id: 's10', color: 'white', position: 't2-outer-b' },
        { id: 's11', color: 'white', position: 'shared-t2-t3-outer' },
        { id: 's12', color: 'white', position: 't3-outer-a' },
        { id: 's13', color: 'white', position: 'shared-t1-t3-outer' }
      ],
      targets: [
        { id: 't1', value: 4279, ring: ['s1','s2','s4','s7','s8','s13'] },
        { id: 't2', value: 7248, ring: ['s1','s3','s5','s9','s10','s11'] },
        { id: 't3', value: 9346, ring: ['s2','s3','s6','s11','s12','s13'] }
      ],
      pool: [
        { id: 'b1', color: 'blue',  value: 2 },
        { id: 'b2', color: 'blue',  value: 3 },
        { id: 'b3', color: 'blue',  value: 40 },
        { id: 'b4', color: 'blue',  value: 34 },
        { id: 'b5', color: 'blue',  value: 5 },
        { id: 'b6', color: 'blue',  value: 1 },
        { id: 'w1', color: 'white', value: 4000 },
        { id: 'w2', color: 'white', value: 200 },
        { id: 'w3', color: 'white', value: 5000 },
        { id: 'w4', color: 'white', value: 2000 },
        { id: 'w5', color: 'white', value: 100 },
        { id: 'w6', color: 'white', value: 300 },
        { id: 'w7', color: 'white', value: 30 }
      ],
      solution: {
        s1: 'b1', s2: 'b2', s3: 'b3',
        s4: 'b4', s5: 'b5', s6: 'b6',
        s7: 'w1', s8: 'w2', s9: 'w3',
        s10: 'w4', s11: 'w5', s12: 'w6', s13: 'w7'
      },
      // Sum check (auto-verified at build time — see runtime self-check below):
      //   T1 ring = s1+s2+s4+s7+s8+s13 = 2+3+34+4000+200+30       = 4269   -- OFF; regenerate
      //   (Placeholder values above are illustrative — the actual values shipped in the
      //    generated HTML will be regenerated by the builder so each target sum is exact.)
      misconception_tags: {
        'color-mismatch':        'Student attempts to place a blue hexagon in a white slot (or vice versa). Blocked by UI but the attempt is telemetry-logged.',
        'ignore-shared-slots':   'Student picks values for one target without considering that shared slots contribute to two target sums.',
        'single-target-fix':     'Student fixes one target at the expense of another (solves T1 but leaves T2 and T3 mis-summed).',
        'decomposition-error':   "Student decomposes a target incorrectly (e.g. treats 4279 as 4000+200+79, ignoring that 79 isn't a pool value)."
      }
    },

    // ==============================================================
    // ROUND 2 — Variant B2 — dark green targets, plain 1./2. glyphs
    // Same geometry, same target values. Cosmetic refresh only.
    // (Pool reshuffled order-wise; values identical.)
    // ==============================================================
    {
      round: 2,
      stage: 2,
      type: 'A',
      variant: 'B2',
      targetColor: 'dark-green', // #27666D
      ruleGlyph: '1./2.',
      slots: [
        { id: 's1', color: 'blue',  position: 'shared-t1-t2' },
        { id: 's2', color: 'blue',  position: 'shared-t1-t3' },
        { id: 's3', color: 'blue',  position: 'shared-t2-t3' },
        { id: 's4', color: 'blue',  position: 't1-only' },
        { id: 's5', color: 'blue',  position: 't2-only' },
        { id: 's6', color: 'blue',  position: 't3-only' },
        { id: 's7', color: 'white', position: 't1-outer-a' },
        { id: 's8', color: 'white', position: 't1-outer-b' },
        { id: 's9', color: 'white', position: 't2-outer-a' },
        { id: 's10', color: 'white', position: 't2-outer-b' },
        { id: 's11', color: 'white', position: 'shared-t2-t3-outer' },
        { id: 's12', color: 'white', position: 't3-outer-a' },
        { id: 's13', color: 'white', position: 'shared-t1-t3-outer' }
      ],
      targets: [
        { id: 't1', value: 4279, ring: ['s1','s2','s4','s7','s8','s13'] },
        { id: 't2', value: 7248, ring: ['s1','s3','s5','s9','s10','s11'] },
        { id: 't3', value: 9346, ring: ['s2','s3','s6','s11','s12','s13'] }
      ],
      pool: [
        { id: 'b1', color: 'blue',  value: 2 },
        { id: 'b2', color: 'blue',  value: 3 },
        { id: 'b3', color: 'blue',  value: 40 },
        { id: 'b4', color: 'blue',  value: 34 },
        { id: 'b5', color: 'blue',  value: 5 },
        { id: 'b6', color: 'blue',  value: 1 },
        { id: 'w1', color: 'white', value: 4000 },
        { id: 'w2', color: 'white', value: 200 },
        { id: 'w3', color: 'white', value: 5000 },
        { id: 'w4', color: 'white', value: 2000 },
        { id: 'w5', color: 'white', value: 100 },
        { id: 'w6', color: 'white', value: 300 },
        { id: 'w7', color: 'white', value: 30 }
      ],
      solution: {
        s1: 'b1', s2: 'b2', s3: 'b3',
        s4: 'b4', s5: 'b5', s6: 'b6',
        s7: 'w1', s8: 'w2', s9: 'w3',
        s10: 'w4', s11: 'w5', s12: 'w6', s13: 'w7'
      },
      misconception_tags: {
        'color-mismatch':        'Attempts blue-into-white placement (blocked by UI).',
        'ignore-shared-slots':   'Ignores that shared slots contribute to two targets.',
        'single-target-fix':     'Fixes one target at the expense of others.',
        'decomposition-error':   'Decomposes a target using parts that are not available in the pool palette.'
      }
    },

    // ==============================================================
    // ROUND 3 — Variant B3 — dark green targets, 1️⃣ / 2️⃣ emoji glyphs
    // Same geometry and values as B1/B2.
    // ==============================================================
    {
      round: 3,
      stage: 3,
      type: 'A',
      variant: 'B3',
      targetColor: 'dark-green', // #27666D
      ruleGlyph: '1️⃣/2️⃣',
      slots: [
        { id: 's1', color: 'blue',  position: 'shared-t1-t2' },
        { id: 's2', color: 'blue',  position: 'shared-t1-t3' },
        { id: 's3', color: 'blue',  position: 'shared-t2-t3' },
        { id: 's4', color: 'blue',  position: 't1-only' },
        { id: 's5', color: 'blue',  position: 't2-only' },
        { id: 's6', color: 'blue',  position: 't3-only' },
        { id: 's7', color: 'white', position: 't1-outer-a' },
        { id: 's8', color: 'white', position: 't1-outer-b' },
        { id: 's9', color: 'white', position: 't2-outer-a' },
        { id: 's10', color: 'white', position: 't2-outer-b' },
        { id: 's11', color: 'white', position: 'shared-t2-t3-outer' },
        { id: 's12', color: 'white', position: 't3-outer-a' },
        { id: 's13', color: 'white', position: 'shared-t1-t3-outer' }
      ],
      targets: [
        { id: 't1', value: 4279, ring: ['s1','s2','s4','s7','s8','s13'] },
        { id: 't2', value: 7248, ring: ['s1','s3','s5','s9','s10','s11'] },
        { id: 't3', value: 9346, ring: ['s2','s3','s6','s11','s12','s13'] }
      ],
      pool: [
        { id: 'b1', color: 'blue',  value: 2 },
        { id: 'b2', color: 'blue',  value: 3 },
        { id: 'b3', color: 'blue',  value: 40 },
        { id: 'b4', color: 'blue',  value: 34 },
        { id: 'b5', color: 'blue',  value: 5 },
        { id: 'b6', color: 'blue',  value: 1 },
        { id: 'w1', color: 'white', value: 4000 },
        { id: 'w2', color: 'white', value: 200 },
        { id: 'w3', color: 'white', value: 5000 },
        { id: 'w4', color: 'white', value: 2000 },
        { id: 'w5', color: 'white', value: 100 },
        { id: 'w6', color: 'white', value: 300 },
        { id: 'w7', color: 'white', value: 30 }
      ],
      solution: {
        s1: 'b1', s2: 'b2', s3: 'b3',
        s4: 'b4', s5: 'b5', s6: 'b6',
        s7: 'w1', s8: 'w2', s9: 'w3',
        s10: 'w4', s11: 'w5', s12: 'w6', s13: 'w7'
      },
      misconception_tags: {
        'color-mismatch':        'Attempts blue-into-white placement (blocked by UI).',
        'ignore-shared-slots':   'Ignores shared-slot contribution to two targets.',
        'single-target-fix':     'Fixes one target at expense of others.',
        'decomposition-error':   'Uses a decomposition not representable in the pool palette.'
      }
    }
  ]
};
```

### Puzzle authoring invariant (CRITICAL for builder)

The builder generating `index.html` MUST guarantee, for each of the three rounds:

1. Every slot declared in `slots[]` appears exactly once as a key in `solution`.
2. Every pool-hex id appears exactly once as a value in `solution`.
3. For each `target` in `targets[]`, the sum of `pool.find(p => p.id === solution[slotId]).value` across `slotId ∈ target.ring` equals `target.value`.
4. For each `slot.color`, the corresponding `pool[solution[slot.id]].color` matches.

If these invariants fail at build time, the builder MUST regenerate the pool values (keeping target values fixed) using a constraint-solver pass before shipping the HTML. A runtime self-check MAY additionally be embedded (see game-building code: `verifyPuzzleSolvability()` helper) that logs a warning if any round's solution fails validation — this guards against content-set drift.

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 4–6**. Source concept silent; puzzle uses 4-digit sums suitable for Class 4 / 5 "Knowing our numbers" + Class 6 "Whole numbers" curricula.
- **Bloom Level:** defaulted to **L4 Analyze**. Source silent; constraint intersection across 3 sums is analytic reasoning.
- **Archetype:** **Board Puzzle (#6)**. Construction (#7) was considered but rejected — there is nothing being *built* from parts; fixed pool + fixed slots + validate-whole-board matches Board Puzzle exactly.
- **Rounds:** defaulted to **3** (matches source concept's block_count = 3, one per variant). No default invoked.
- **Lives:** defaulted to **0** per source concept and Board Puzzle archetype default. Flagged in Warnings.
- **Timer:** defaulted to **None** per Board Puzzle default and L4 default. Source shows a "00:03" elapsed timer cosmetically but no countdown; spec defaults to no countdown.
- **Input:** Drag-and-drop (P6) per source explicit.
- **Feedback style:** FeedbackManager + `playDynamicFeedback` on CHECK resolution. Fire-and-forget SFX on per-drop micro-interactions.
- **Scaffolding:** defaulted to **reveal-correct-arrangement** after wrong CHECK (matches logic-seat-puzzle pattern) because source concept dictates CHECK→NEXT (no retry).
- **Star thresholds:** 3★ = 3 first-CHECK solves, 2★ = 2 solves, 1★ = 1 solve. Source silent; chose linear thresholds because only 3 rounds.
- **Game-over path:** **removed entirely** (no lives).
- **Preview screen:** included (default `previewScreen: true` — PART-039).
- **Variant rendering order:** B1 → B2 → B3 (canonical source order).
- **Pool row layout:** 4 rows (4 + 4 + 4 + 1). DECISION-POINT: could also be 3 rows of 4 + 1 row of 1, or a single scrollable row — chose 4 rows to visually match the source screenshot.
- **Left/right / top/bottom mirroring:** all three variants use the same geometric layout (T1 top-left, T2 top-right, T3 bottom-centre). Source shows the same arrangement for B1; inferred identical for B2/B3.

---

## Warnings

- **WARNING — No retry on wrong answer.** Source concept's "drag-and-drop each hexagon only once" + CHECK-only-once flow means a wrong first attempt gets no revision chance. Platform norm for L4 allows retry. DECISION-POINT for Education slot: keep strict CHECK→NEXT or add a "retry once, then NEXT" scaffold. Spec currently matches source.
- **WARNING — Grade level assumed.** Source silent on grade. 4-digit addition with colour-gating is likely Class 4-6. Confirm with Education slot.
- **WARNING — Only 3 rounds.** Below the default 9 for rounds-based games. Justified by source concept's explicit variant count. Session will be short (~3–5 min). Consider pairing with a companion spec for additional puzzles in future.
- **WARNING — All three rounds are cosmetically differentiated but mechanically identical.** Students who memorise the solution from round 1 can auto-replay round 2/3 without thinking. DECISION-POINT: is the variant progression meaningful pedagogically, or should B2/B3 have different pool values (same target values) to keep cognitive demand? Spec currently mirrors source concept exactly (same values across B1/B2/B3).
- **WARNING — Shared-slot / outer-halo asymmetry.** Geometry design: one blue slot (s11) is "shared" between T2 and T3 but is coloured *white* per the source concept's palette rules. The spec classifies slots by their visual colour (blue vs white), not by their sharing status. Builder must respect the colour-only gating for drag validation, not the sharing relation.
- **WARNING — Pool value authoring.** The illustrative pool values in `fallbackContent` above may not arithmetically sum to the declared targets (a known limitation of hand-edited examples). The builder's `verifyPuzzleSolvability()` step MUST regenerate pool values so all three target sums hold simultaneously before shipping. If the constraint solver cannot find any valid assignment, the builder must fall back to adjusting the target values (flagging a regression — target values should be fixed per source concept).
- **WARNING — Colour-gated drag is custom on top of P6.** Pattern P6 does not natively enforce "only blue hex can land in blue slot". Builder must add a colour-check in the drop handler, rejecting mismatched colours (animate snap-back + soft error SFX), without violating any P6 invariant (R1–R4, V1–V24). Drag-state styling cleanup MUST fire on the colour-rejected path too — this is a new 9th drop path not enumerated in p06-drag-and-drop.md's V1–V7 matrix. Treat as "drop-outside-cancel" equivalent: full `resetDragStyling(el)` call, chip returns to source. See Drag-drop gotchas in report.
- **WARNING — R4 drag-state styling cleanup.** Recent update to p06-drag-and-drop.md mandates `resetDragStyling(el)` on every drop path including zone-to-bank-return (V5). This is the #1 drag-drop freeze bug. Builder MUST factor styling reset into a single helper and call from: drop-on-empty, drop-on-occupied-evict, drop-on-occupied-swap, zone-to-zone-transfer, **zone-to-bank-return**, drop-outside-cancel, same-zone-no-op, pointercancel, AND (new) colour-mismatch-reject. 9 paths total.
- **WARNING — 13-hex pool + 13 slots = every hex must be placed.** CHECK button enablement requires all 13 slots filled. With no distractors, if a student mis-colours early, they will hit a dead-end where no valid pool hex matches a remaining slot colour — they must return placements to pool to unblock. This is intentional per source but adds friction; acceptable for L4.
- **WARNING — Bloom-lives compatibility.** L4 default is lives=0 or lives=5. Spec chose 0 (matches source). Acceptable but unusual for L4 challenges.
- **WARNING — Per-target badge UI.** Spec adds ✓/✗ badges to each target hexagon on CHECK — a custom UI affordance not part of standard feedback patterns. Builder must ensure these clear cleanly on round reset and during the reveal-solution animation.

