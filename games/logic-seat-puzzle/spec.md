# Game Design: Logic Seating Puzzle

## Identity

- **Game ID:** logic-seat-puzzle
- **Title:** Logic Seating Puzzle
- **Class/Grade:** Class 4-6 (Grade 4-6) — DECISION-POINT: flagged in Defaults Applied; source concept is silent on grade
- **Math Domain:** Logical Reasoning / Deductive Reasoning (Pre-algebra "Relations & Positions")
- **Topic:** Constraint satisfaction — interpret positional clues ("between", "across", "next to", "left of", "right of") and arrange named characters into numbered seats so every clue is satisfied simultaneously.
- **Bloom Level:** L4 Analyze — students must decompose a set of independent clues, hold multiple partial constraints in working memory, and test whether the whole arrangement satisfies every constraint. This is not recall (L1) or procedure (L3); it is analytic constraint satisfaction.
- **Archetype:** Board Puzzle (#6) — each round is a single puzzle board that is solved as a whole (not a sequence of per-item questions). Drag-and-drop is used to populate the board, and a CHECK button validates the entire arrangement against the clue set.
- **NCERT Alignment:** NCERT Class 5 Math "Mapping Your Way" (positions, directions, left/right/across) and NCERT Class 6 Math "Knowing Our Numbers / Playing with Numbers" puzzle appendix (logic grids). Reading-comprehension portion aligns with any language textbook's "follow the clues" puzzle pages — DECISION-POINT: confirm NCERT mapping with Education slot.

## One-Line Concept

Students drag named characters from a pool into numbered seats around a table so that every one of the given textual clues ("Anu is between Priya and Ravi", "Neha sits across from Anu") is satisfied — tapping CHECK validates the entire arrangement at once.

---

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Reading comprehension | Parse short positional statements and translate each into a concrete spatial constraint on seats. | All rounds |
| Deductive reasoning | Combine multiple independent constraints to narrow an initially large solution space to a single valid arrangement. | Type B, Type C |
| Spatial reasoning | Map relative terms (between, across, left-of, next-to) onto a specific numbered-seat layout. | All rounds |
| Hypothesis testing | Try an arrangement, predict which clues it will fail, revise. CHECK gives whole-board feedback. | Type C |
| Working memory | Hold 3–5 partial constraints in mind while moving characters. | Type B, Type C |

---

## Core Mechanic

Single interaction type across all rounds — drag-and-drop with check-on-submit. Difficulty scales by (a) number of seats, (b) number and type of clues, (c) presence of distractor characters in the pool.

### Type A: "Fill every seat" (Stage 1 — R1–2)

1. **Student sees:** Table diagram with 4 numbered seats (2 per side, rectangular table, top-down view). A clue panel above the table with 2–3 simple clues. A character pool below with exactly 4 character chips (name + avatar). A CHECK button below the table, initially disabled.
2. **Student does:** Drags each character chip from the pool into a seat. CHECK enables once every seat is filled. Dropping on an occupied seat swaps/evicts the prior occupant back to the pool. Tapping CHECK validates the whole arrangement.
3. **Correct criterion:** Every clue is satisfied (no clue conflicts with the final placement).
4. **Feedback:** See § Feedback. Correct = green-seat flash + correct SFX + TTS celebration + advance. Wrong = red-seat highlighting on conflict-contributing seats + "Oh no! That's not right!" message + incorrect SFX + CHECK button morphs to NEXT button which auto-advances to the next round (no retry in this game — DECISION-POINT, see Warnings).

### Type B: "Clued with 5 seats" (Stage 2 — R3–5)

1. **Student sees:** Table with 5 numbered seats (2 on top side, 2 on bottom side, 1 at a head). Clue panel with 3–4 clues including "between" and "across from". Pool has exactly 5 character chips (no distractors yet). CHECK button disabled until all seats filled.
2. **Student does:** Same drag-drop interaction. Clues now require inferring one placement from a pair of constraints (e.g., "Anu is between Priya and Ravi" pins Anu's two neighbours).
3. **Correct criterion:** Identical to Type A — every clue must hold.
4. **Feedback:** Identical to Type A. Red highlighting on seats that participate in at least one violated clue (see § Feedback for "conflict seat" definition).

### Type C: "With distractors" (Stage 3 — R6–7)

1. **Student sees:** Table with 6 numbered seats (3 per side). Clue panel with 4–5 clues. Pool has 7 character chips — **6 valid characters + 1 distractor** mentioned in no clue. CHECK button disabled until all 6 seats are filled.
2. **Student does:** Same drag-drop interaction. The student must first identify which pool characters appear in clues vs. which one is a distractor (never mentioned → must not be seated). Then solve the arrangement.
3. **Correct criterion:** Every clue is satisfied AND the distractor remains in the pool (because seating the distractor displaces a valid character, which then fails the clue that mentions them).
4. **Feedback:** Identical to Type A/B. If a distractor is seated, the seat they occupy is one of the conflict-highlighted red seats on CHECK.

---

## Rounds & Progression

### Stage 1: Small table, no distractors (R1–2)
- Round type: Type A.
- Table seats: **4** (2 per long side, rectangular).
- Clues: **2–3**, simple adjacency only ("Ravi sits next to Anu", "Priya is on the same side as Ravi", "Meera is across from Anu").
- Pool: **exactly 4** characters (no distractors).
- Cognitive demand: **Translate** — map each clue to a concrete seat constraint and fill.

### Stage 2: Medium table, mixed clue types (R3–5)
- Round type: Type B.
- Table seats: **5** (2 + 2 + 1 head) — NOTE: round table or rectangular with a head seat. DECISION-POINT: rectangular with a "head of table" seat at one short end. Seats numbered 1 (head) through 5 clockwise from head.
- Clues: **3–4**, mixing "between X and Y", "across from", "next to", "on the left of". "Between" introduces a tight two-neighbour constraint.
- Pool: **exactly 5** characters (no distractors).
- Cognitive demand: **Combine** — intersect multiple constraints to narrow each character's seat.

### Stage 3: Full table with distractors (R6–7)
- Round type: Type C.
- Table seats: **6** (3 per side, rectangular, top-down view).
- Clues: **4–5**, mixing all clue types. One round includes a negation clue ("Not next to").
- Pool: **7** characters — 6 named in clues + 1 distractor never mentioned.
- Cognitive demand: **Decompose + reject** — student must decide which pool character is extraneous AND solve the arrangement.

### Summary Table

| Dimension | Stage 1 (R1–2) | Stage 2 (R3–5) | Stage 3 (R6–7) |
|-----------|----------------|-----------------|-----------------|
| Round type | A | B | C |
| Seats | 4 | 5 | 6 |
| Pool characters | 4 | 5 | 7 (6 + 1 distractor) |
| Clue count | 2–3 | 3–4 | 4–5 |
| Clue types used | next to, same side, across | + between, left/right of | + not-next-to (negation) |
| Distractors | None | None | 1 per round |
| Target first-attempt rate | 70–80% | 55–70% | 45–60% |

---

## Game Parameters

- **Rounds:** 7 — **DECISION-POINT (see Defaults Applied & Warnings):** concept did not specify. Default is 9 for MCQ-style games but Board Puzzles are cognitively heavier. 7 rounds (2 + 3 + 2) keeps the session under ~12 minutes at ~90 s/round.
- **Timer:** None — L4 Analyze tasks should not be timed.
- **Lives:** None. Each round is one-shot: student submits, gets feedback, advances. This is the literal behaviour described in the source concept ("CHECK button changes to a NEXT button to proceed"). DECISION-POINT flagged in Warnings.
- **Star rating:**
  - **3 stars** = 6–7 rounds solved on first CHECK
  - **2 stars** = 4–5 rounds solved on first CHECK
  - **1 star** = 1–3 rounds solved on first CHECK
  - **0 stars (still reaches results)** = 0 rounds solved on first CHECK
- **Input:** Drag-and-drop (touch + mouse) using Pattern P6. Source = character chip in pool or currently-occupied seat. Target = any seat (fill-empty OR replace-occupant). Plus tap on CHECK / NEXT button.
- **Feedback:** Per-round whole-arrangement validation on CHECK. Per-drop micro-feedback is visual only (snap SFX fire-and-forget). Awaited SFX + TTS on correct/incorrect round resolution. FeedbackManager handles all audio.

---

## Scoring

- **Points:** +1 per round solved on first CHECK (max 7). No partial credit — either every clue is satisfied or not.
- **Stars:** By count of first-CHECK solves, thresholds above.
- **Lives:** None (no game_over path — see Warnings).
- **Partial credit:** None for scoring; telemetry still records per-seat placements and which clues were violated so analytics can distinguish "one clue off" from "random arrangement".

---

## Flow

**Shape:** Multi-round (default) with two deltas from the canonical default:
1. **No Game Over branch.** Lives = 0, so the "wrong AND lives = 0" branch is removed entirely. Wrong CHECK → NEXT button → next round transition → next round. Never transitions to game_over.
2. **Wrong answer does NOT loop back to the same round.** The NEXT button shipped in the source concept means the student sees the correct arrangement (briefly) then advances — no retry. This is unusual and is flagged in Warnings.

Changes from default:
- Remove Game Over path (no lives).
- After wrong CHECK, advance to next round (no retry loop inside the same round).
- Replace the "submit" transition in the Gameplay → Feedback edge with an explicit CHECK button tap.

```
[Preview Screen (PART-039)]
        |
        v
[Welcome / Level Screen]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: Drag characters into seats, CHECK button disabled until all seats filled]
        |
        | tap CHECK (all seats filled)
        v
[Validate arrangement against clues]
        |
        +--> all clues satisfied --> Correct feedback (green seats, SFX + TTS)
        |                                  |
        |                                  v
        |                            [If N < 7: Round N+1 Transition]
        |                            [If N == 7: Victory / Results]
        |
        +--> at least one clue violated --> Wrong feedback
                  (red on conflict seats,
                   SFX + TTS, CHECK -> NEXT,
                   correct arrangement briefly shown)
                  |
                  | tap NEXT
                  v
           [If N < 7: Round N+1 Transition]
           [If N == 7: Victory / Results]

(No Game Over; always reaches Results after Round 7.)
```

---

## Feedback

| Event | Behavior |
|-------|----------|
| Character picked up from pool | Chip lifts (scale 1.06, soft drop-shadow), pool slot dims. No audio. |
| Character dragged over a seat | Seat border highlights (primary color). No audio. |
| Character dropped on empty seat | Snap SFX (fire-and-forget, no sticker, no TTS, no block). Seat turns filled. CHECK button enables when all seats filled. |
| Character dropped on occupied seat | Previous occupant animates back to the pool; new character snaps into seat. Snap SFX (fire-and-forget). Pool slot repopulates. |
| Character dragged from seat back to pool | Seat clears, pool slot refills. CHECK button disables (not all seats filled). Soft deselect SFX (fire-and-forget). |
| CHECK pressed, arrangement correct | Input blocked (`isProcessing = true`) before any await. All seats flash green (400ms). Awaited correct SFX + celebration sticker (~1s). Fire-and-forget TTS + subtitle: "Great thinking! You matched every clue." After SFX, advance to next round. `recordAttempt` captures the whole arrangement before audio starts. |
| CHECK pressed, arrangement wrong | Input blocked. Conflict seats highlight red (see "conflict seat" rule below). Awaited wrong SFX + sad sticker (~1s). Fire-and-forget TTS + subtitle: "Oh no! That's not right!" (matches source-concept copy). CHECK button morphs to NEXT button. After ~1.5s, the **correct arrangement is briefly shown** (characters slide into their solution seats with subtle animation) so the student sees the answer before advancing. NEXT is tappable at any time to advance immediately. |
| NEXT pressed | Stop all audio. Transition to next-round screen. If N == 7, transition to Victory / Results. |
| Round complete (correct OR wrong+next) | `recordAttempt` already sent. Auto-advance to next round transition after audio settles. |
| All 7 rounds complete | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO sequence (awaited, CTA interruptible). Star count based on first-CHECK solves. |
| Try again / replay | Stop all audio; reset state; return to Welcome Screen. |
| Visibility hidden | `VisibilityTracker` handles pause overlay (do not roll a custom one). Audio + timers pause. |
| Visibility restored | `VisibilityTracker` dismisses overlay. State continues exactly where it was. |

### Conflict seat rule (for red highlighting on wrong CHECK)

A seat is a "conflict seat" if the character in it participates in at least one violated clue.

- For clue "X is between Y and Z": if X is not between Y and Z in the arrangement, the seats of X, Y, Z are all conflict seats.
- For clue "X is across from Y": if X is not across from Y, the seats of X and Y are conflict seats.
- For clue "X is next to Y": the seats of X and Y are conflict seats if they are not adjacent.
- For clue "X is on the left of Y" / "X is on the right of Y": the seats of X and Y.
- For clue "X is not next to Y" (negation, Stage 3 only): the seats of X and Y if they are adjacent.
- For a distractor round where a distractor is seated: the distractor's seat AND the seat of the valid character who was displaced are both conflict seats.

A seat not involved in any violated clue is NOT highlighted red (it stays neutral) — this tells the student which seats to reconsider.

---

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Seat everyone at the table!</b><br>Drag each character into a seat so every clue is true. Tap <b>CHECK</b> when you are done.</p>',
  previewAudioText: 'Drag each character into a seat so every clue is true. Then tap CHECK.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    // ===================================================================
    // ROUND 1 — Stage 1, Type A. 4 seats. 2 clues. No distractors.
    // Table (rectangular, top-down):
    //   Seats 1 & 2 are on the TOP side (1 left, 2 right).
    //   Seats 3 & 4 are on the BOTTOM side (3 left, 4 right).
    //   "Across from" means same column, opposite side: 1<->3, 2<->4.
    //   "Next to" means same side and adjacent: 1<->2, 3<->4.
    // ===================================================================
    {
      round: 1,
      stage: 1,
      type: "A",
      layout: "rect-4",
      seats: [
        { id: 1, side: "top",    col: "left"  },
        { id: 2, side: "top",    col: "right" },
        { id: 3, side: "bottom", col: "left"  },
        { id: 4, side: "bottom", col: "right" }
      ],
      pool: [
        { id: "anu",   name: "Anu",   avatar: "avatar_anu" },
        { id: "ravi",  name: "Ravi",  avatar: "avatar_ravi" },
        { id: "priya", name: "Priya", avatar: "avatar_priya" },
        { id: "meera", name: "Meera", avatar: "avatar_meera" }
      ],
      clues: [
        { id: "c1", text: "Anu sits next to Ravi.",        type: "next_to",    args: ["anu", "ravi"] },
        { id: "c2", text: "Priya sits across from Anu.",   type: "across_from", args: ["priya", "anu"] }
      ],
      solution: { 1: "anu", 2: "ravi", 3: "priya", 4: "meera" },
      misconception_tags: {
        "swap-across-for-next-to": "Student places Priya next to Anu instead of across (confuses 'across' with 'next to').",
        "arbitrary-fill":          "Student fills seats in pool order without reading clues."
      }
    },

    // ===================================================================
    // ROUND 2 — Stage 1, Type A. 4 seats. 3 clues. No distractors.
    // Adds a "same side" clue.
    // ===================================================================
    {
      round: 2,
      stage: 1,
      type: "A",
      layout: "rect-4",
      seats: [
        { id: 1, side: "top",    col: "left"  },
        { id: 2, side: "top",    col: "right" },
        { id: 3, side: "bottom", col: "left"  },
        { id: 4, side: "bottom", col: "right" }
      ],
      pool: [
        { id: "kiran", name: "Kiran", avatar: "avatar_kiran" },
        { id: "neha",  name: "Neha",  avatar: "avatar_neha" },
        { id: "dev",   name: "Dev",   avatar: "avatar_dev" },
        { id: "sara",  name: "Sara",  avatar: "avatar_sara" }
      ],
      clues: [
        { id: "c1", text: "Kiran and Neha sit on the same side.", type: "same_side",   args: ["kiran", "neha"] },
        { id: "c2", text: "Dev sits across from Kiran.",           type: "across_from", args: ["dev", "kiran"] },
        { id: "c3", text: "Sara sits next to Dev.",                type: "next_to",     args: ["sara", "dev"] }
      ],
      solution: { 1: "kiran", 2: "neha", 3: "dev", 4: "sara" },
      misconception_tags: {
        "same-side-as-next-to": "Student treats 'same side' as only adjacent seats and places Kiran and Neha on opposite sides.",
        "across-direction-error": "Student places Dev next to Kiran instead of across."
      }
    },

    // ===================================================================
    // ROUND 3 — Stage 2, Type B. 5 seats (head + 2 + 2). 3 clues. No distractors.
    // Layout:
    //   Seat 1 = head of table (short end, top).
    //   Seats 2 & 3 on the top long side (2 closer to head, 3 farther).
    //   Seats 4 & 5 on the bottom long side (4 closer to head, 5 farther).
    //   Across: 2<->4, 3<->5. Seat 1 has no "across".
    //   Next to: 1<->2, 1<->4, 2<->3, 4<->5.
    // ===================================================================
    {
      round: 3,
      stage: 2,
      type: "B",
      layout: "rect-5-head",
      seats: [
        { id: 1, side: "head",   col: "center" },
        { id: 2, side: "top",    col: "near"   },
        { id: 3, side: "top",    col: "far"    },
        { id: 4, side: "bottom", col: "near"   },
        { id: 5, side: "bottom", col: "far"    }
      ],
      pool: [
        { id: "tara",  name: "Tara",  avatar: "avatar_tara" },
        { id: "veer",  name: "Veer",  avatar: "avatar_veer" },
        { id: "ishan", name: "Ishan", avatar: "avatar_ishan" },
        { id: "lila",  name: "Lila",  avatar: "avatar_lila" },
        { id: "omar",  name: "Omar",  avatar: "avatar_omar" }
      ],
      clues: [
        { id: "c1", text: "Tara sits at the head of the table.", type: "at_seat",     args: ["tara", 1] },
        { id: "c2", text: "Veer is between Tara and Ishan.",      type: "between",     args: ["veer", "tara", "ishan"] },
        { id: "c3", text: "Lila sits across from Veer.",           type: "across_from", args: ["lila", "veer"] }
      ],
      solution: { 1: "tara", 2: "veer", 3: "ishan", 4: "lila", 5: "omar" },
      misconception_tags: {
        "between-as-adjacent-to-one": "Student places Veer next to only Tara (or only Ishan) and ignores that 'between' requires both flanks.",
        "head-seat-ignored":           "Student fills the head seat last/arbitrarily, missing the explicit 'at the head' clue."
      }
    },

    // ===================================================================
    // ROUND 4 — Stage 2, Type B. 5 seats. 4 clues. No distractors.
    // Introduces "on the left of / on the right of" as seen from the student.
    // DECISION-POINT: left/right semantics in top-down view is ambiguous.
    // In this spec, "X is on the left of Y" = X's seat is immediately to the
    // left of Y's seat FROM THE STUDENT'S VIEW (left on screen).
    // ===================================================================
    {
      round: 4,
      stage: 2,
      type: "B",
      layout: "rect-5-head",
      seats: [
        { id: 1, side: "head",   col: "center" },
        { id: 2, side: "top",    col: "near"   },
        { id: 3, side: "top",    col: "far"    },
        { id: 4, side: "bottom", col: "near"   },
        { id: 5, side: "bottom", col: "far"    }
      ],
      pool: [
        { id: "bela",   name: "Bela",   avatar: "avatar_bela" },
        { id: "chand",  name: "Chand",  avatar: "avatar_chand" },
        { id: "dia",    name: "Dia",    avatar: "avatar_dia" },
        { id: "esh",    name: "Esh",    avatar: "avatar_esh" },
        { id: "farah",  name: "Farah",  avatar: "avatar_farah" }
      ],
      clues: [
        { id: "c1", text: "Chand sits at the head.",                  type: "at_seat",     args: ["chand", 1] },
        { id: "c2", text: "Bela sits on the left of Chand.",          type: "left_of",     args: ["bela", "chand"] },
        { id: "c3", text: "Dia sits across from Bela.",                type: "across_from", args: ["dia", "bela"] },
        { id: "c4", text: "Farah sits next to Dia.",                   type: "next_to",     args: ["farah", "dia"] }
      ],
      solution: { 1: "chand", 2: "bela", 3: "esh", 4: "dia", 5: "farah" },
      misconception_tags: {
        "mirror-left-right":      "Student reads 'left of Chand' as Chand's left (opposite side) instead of screen-left.",
        "across-chained-wrong":   "Student places Dia next to Bela rather than across."
      }
    },

    // ===================================================================
    // ROUND 5 — Stage 2, Type B. 5 seats. 4 clues. No distractors.
    // Two "between" clues combine to pin two characters.
    // ===================================================================
    {
      round: 5,
      stage: 2,
      type: "B",
      layout: "rect-5-head",
      seats: [
        { id: 1, side: "head",   col: "center" },
        { id: 2, side: "top",    col: "near"   },
        { id: 3, side: "top",    col: "far"    },
        { id: 4, side: "bottom", col: "near"   },
        { id: 5, side: "bottom", col: "far"    }
      ],
      pool: [
        { id: "hari",  name: "Hari",  avatar: "avatar_hari" },
        { id: "ina",   name: "Ina",   avatar: "avatar_ina" },
        { id: "joy",   name: "Joy",   avatar: "avatar_joy" },
        { id: "kabir", name: "Kabir", avatar: "avatar_kabir" },
        { id: "lena",  name: "Lena",  avatar: "avatar_lena" }
      ],
      clues: [
        { id: "c1", text: "Hari sits at the head.",              type: "at_seat", args: ["hari", 1] },
        { id: "c2", text: "Ina is between Hari and Joy.",         type: "between", args: ["ina", "hari", "joy"] },
        { id: "c3", text: "Kabir is between Hari and Lena.",      type: "between", args: ["kabir", "hari", "lena"] },
        { id: "c4", text: "Joy sits across from Lena.",           type: "across_from", args: ["joy", "lena"] }
      ],
      solution: { 1: "hari", 2: "ina", 3: "joy", 4: "kabir", 5: "lena" },
      misconception_tags: {
        "between-on-wrong-side":  "Student places Ina on the bottom side though the pair Hari-Joy is on the top.",
        "overlook-second-between": "Student satisfies clue 2 but ignores that clue 3 also has 'Hari' — Kabir must also be adjacent to Hari."
      }
    },

    // ===================================================================
    // ROUND 6 — Stage 3, Type C. 6 seats. 4 clues. 1 distractor.
    // 6-seat rectangular table: 3 seats per long side.
    //   Top side:    seats 1 (L), 2 (M), 3 (R)   [L/M/R = screen left/middle/right]
    //   Bottom side: seats 4 (L), 5 (M), 6 (R)
    //   Across:  1<->4, 2<->5, 3<->6
    //   Next to: 1<->2, 2<->3, 4<->5, 5<->6 (same side only; 1<->4 is across, NOT next to)
    // Pool has 7 chars; 1 is a distractor (never named in any clue).
    // ===================================================================
    {
      round: 6,
      stage: 3,
      type: "C",
      layout: "rect-6",
      seats: [
        { id: 1, side: "top",    col: "left"   },
        { id: 2, side: "top",    col: "middle" },
        { id: 3, side: "top",    col: "right"  },
        { id: 4, side: "bottom", col: "left"   },
        { id: 5, side: "bottom", col: "middle" },
        { id: 6, side: "bottom", col: "right"  }
      ],
      pool: [
        { id: "arjun",  name: "Arjun",  avatar: "avatar_arjun" },
        { id: "bhavna", name: "Bhavna", avatar: "avatar_bhavna" },
        { id: "cyrus",  name: "Cyrus",  avatar: "avatar_cyrus" },
        { id: "divya",  name: "Divya",  avatar: "avatar_divya" },
        { id: "eshaan", name: "Eshaan", avatar: "avatar_eshaan" },
        { id: "farida", name: "Farida", avatar: "avatar_farida" },
        { id: "gopal",  name: "Gopal",  avatar: "avatar_gopal",  distractor: true }
      ],
      clues: [
        { id: "c1", text: "Arjun is between Bhavna and Cyrus.", type: "between",     args: ["arjun", "bhavna", "cyrus"] },
        { id: "c2", text: "Divya sits across from Arjun.",        type: "across_from", args: ["divya", "arjun"] },
        { id: "c3", text: "Eshaan sits next to Divya.",           type: "next_to",     args: ["eshaan", "divya"] },
        { id: "c4", text: "Farida sits across from Cyrus.",       type: "across_from", args: ["farida", "cyrus"] }
      ],
      // Gopal is the distractor — not in any clue; stays in pool.
      solution: { 1: "bhavna", 2: "arjun", 3: "cyrus", 4: "eshaan", 5: "divya", 6: "farida" },
      misconception_tags: {
        "seat-every-pool-char":    "Student assumes every pool character must be seated and places Gopal in seat 6, displacing Farida (then fails clue 4).",
        "between-ignores-sides":   "Student places Arjun on the bottom side though Bhavna and Cyrus are on top.",
        "parallel-across-ignored": "Student aligns Divya next to Arjun rather than across."
      }
    },

    // ===================================================================
    // ROUND 7 — Stage 3, Type C. 6 seats. 5 clues including one negation.
    // ===================================================================
    {
      round: 7,
      stage: 3,
      type: "C",
      layout: "rect-6",
      seats: [
        { id: 1, side: "top",    col: "left"   },
        { id: 2, side: "top",    col: "middle" },
        { id: 3, side: "top",    col: "right"  },
        { id: 4, side: "bottom", col: "left"   },
        { id: 5, side: "bottom", col: "middle" },
        { id: 6, side: "bottom", col: "right"  }
      ],
      pool: [
        { id: "aarav",  name: "Aarav",  avatar: "avatar_aarav" },
        { id: "brinda", name: "Brinda", avatar: "avatar_brinda" },
        { id: "chetan", name: "Chetan", avatar: "avatar_chetan" },
        { id: "deepa",  name: "Deepa",  avatar: "avatar_deepa" },
        { id: "ekansh", name: "Ekansh", avatar: "avatar_ekansh" },
        { id: "fiza",   name: "Fiza",   avatar: "avatar_fiza" },
        { id: "gaurav", name: "Gaurav", avatar: "avatar_gaurav", distractor: true }
      ],
      clues: [
        { id: "c1", text: "Brinda sits at seat 1 (top-left corner).",   type: "at_seat",     args: ["brinda", 1] },
        { id: "c2", text: "Aarav is between Brinda and Chetan.",         type: "between",     args: ["aarav", "brinda", "chetan"] },
        { id: "c3", text: "Deepa sits across from Brinda.",              type: "across_from", args: ["deepa", "brinda"] },
        { id: "c4", text: "Ekansh is NOT next to Deepa.",                 type: "not_next_to", args: ["ekansh", "deepa"] },
        { id: "c5", text: "Fiza sits next to Deepa.",                     type: "next_to",     args: ["fiza", "deepa"] }
      ],
      // Gaurav is the distractor.
      // Solve: Brinda=1, Aarav=2, Chetan=3, Deepa=4, Fiza=5, Ekansh=6.
      // Verify: Ekansh(6) is not next-to Deepa(4) because 6 is adjacent to 5 only, not 4. ✓
      //         Fiza(5) is next-to Deepa(4) and next-to Ekansh(6). ✓
      solution: { 1: "brinda", 2: "aarav", 3: "chetan", 4: "deepa", 5: "fiza", 6: "ekansh" },
      misconception_tags: {
        "seat-every-pool-char":   "Student seats Gaurav, displacing a clued character and failing at least one clue.",
        "negation-as-positive":   "Student reads 'NOT next to Deepa' as 'next to Deepa' and places Ekansh adjacent.",
        "ekansh-fiza-swap":       "Student swaps Ekansh and Fiza (both are on bottom-right area) and violates clue 4 OR 5."
      }
    }
  ]
};
```

---

## Defaults Applied

- **Class/Grade:** defaulted to **Class 4-6** (creator did not specify). Logic-grid puzzles appear in Class 5 "Mapping Your Way" and work through Class 6–8. DECISION-POINT for human to confirm.
- **Bloom Level:** defaulted to **L4 Analyze** based on the decomposition / constraint-intersection demand. Concept does not specify.
- **Archetype:** **Board Puzzle (#6)**. Creator describes a "check the whole board once per round" puzzle with drag-to-place — Construction (#7) was considered but rejected because nothing is being built from parts (parts are predefined characters and fixed seats).
- **Rounds:** defaulted to **7** (creator did not specify a count). Distribution 2+3+2 across three stages. Flagged in Warnings.
- **Lives:** defaulted to **None** because the source concept explicitly says the CHECK button becomes a NEXT button on wrong answer (advance, no retry). This is unusual for an L4 game — normal L4 default is 0 or 5, and normal Board Puzzle default is 0. Kept at 0 with no retry loop.
- **Timer:** defaulted to **None** (Board Puzzle default; L4 default; no time pressure for deductive reasoning).
- **Input:** **Drag-and-drop (P6)** per source concept explicit description.
- **Feedback style:** **FeedbackManager** with standard playDynamicFeedback on correct/incorrect CHECK; fire-and-forget SFX on per-drop micro-interactions; awaited SFX + fire-and-forget TTS on CHECK resolution per skill/feedback defaults.
- **Scaffolding:** defaulted to **show-correct-arrangement** after wrong CHECK (animation slides characters into their solution seats before NEXT advances). This replaces the usual "retry with hint" pattern because the source concept specifies a CHECK→NEXT flow.
- **Distractor presence:** creator noted "may have distractor characters" — defaulted to **Stage 3 only** (Rounds 6–7) to scaffold difficulty. Flagged in Warnings.
- **Clue language:** defaulted to English. Indian name set used for character chips (Anu, Ravi, Priya, Meera, Kiran, Neha, Dev, Sara, Tara, Veer, Ishan, etc.) to match target-student demographics.
- **Star thresholds:** defaulted to 6–7 = 3★, 4–5 = 2★, 1–3 = 1★ (roughly 85% / 60% / 14% of 7 rounds), biased to first-CHECK solves rather than total placement accuracy.
- **Game-over path:** **removed entirely** (no lives). Matches Board Puzzle archetype default.
- **Preview screen:** included (default `previewScreen: true` — PART-039).

---

## Warnings

- **WARNING — No retry on wrong answer.** Source concept states the CHECK button morphs into a NEXT button after a wrong submission. Every other shipped game allows the student to revise and retry on wrong. Advancing after a single wrong CHECK is pedagogically unusual for an L4 game — students get no chance to re-examine their reasoning. **DECISION-POINT:** Confirm with Education slot whether to keep the strict CHECK→NEXT behaviour (matches source) or add a "retry once, then NEXT" scaffold (matches platform norm). The spec currently matches the source.
- **WARNING — Grade level assumed.** Source concept silent on target grade. L4 deductive reasoning for Class 4 may be aggressive. DECISION-POINT: confirm target grade; if Class 4 is confirmed, consider reducing Stage 3 clues to 3 and removing the negation ("not next to") clue in Round 7.
- **WARNING — Round count assumed.** Default is 9 for MCQ but 3 for Board Puzzle. Spec settled on 7 as a middle ground. DECISION-POINT: confirm round count; if fatigue data suggests, drop to 6 by removing Round 5.
- **WARNING — Distractor placement.** Source concept says distractors "may" exist. Spec introduces them only in Stage 3 (Rounds 6–7). DECISION-POINT: confirm whether distractors should also appear in Stage 2 to accelerate difficulty, or not at all.
- **WARNING — Left/right semantics.** "X is on the left of Y" is ambiguous in top-down view (student's-left vs character's-left). Spec standardises on **student's-left (screen-left)** throughout. DECISION-POINT: confirm semantics with Education slot; whichever is chosen, the preview screen should state the convention explicitly.
- **WARNING — Head-of-table layout.** Stage 2 uses a 5-seat "head-of-table" layout (1 head + 2 top + 2 bottom). "Across from" is undefined for the head seat. Spec avoids across-clues on seat 1 in every Stage 2 round. DECISION-POINT: confirm layout; alternative is a 5-seat round table where "across" wraps.
- **WARNING — Bloom-lives compatibility.** L4 default is lives=0 or lives=5 (pedagogy quick-reference). Spec chose **0 with no retry**, which differs from both defaults because the source concept dictates immediate advance. Acceptable but unusual; see first warning.
- **WARNING — Drag-on-drag complexity.** Replace-on-drop (new character evicts old back to pool) combined with drag-from-seat-back-to-pool adds a small combinatorial state machine on top of Pattern P6. Implementer must keep the `tagSource` data structure (P6 invariant R2) correct across bank→seat, seat→seat, seat→bank moves. Test Engineering slot should cover all three transitions.
- **WARNING — 7-character pool on 6-seat board (Stage 3) = ~720 tab-through permutations.** Randomise chip order each round but keep the clue-referenced names stable for test determinism. Tests should use `chipId`, not pool index.
- **WARNING — CHECK button enablement rule.** Spec says CHECK enables only when all seats are filled. This prevents partial-submit telemetry and means a student who is "stuck halfway" has no way to ask for a nudge. DECISION-POINT: consider enabling CHECK whenever at least one seat is filled, with partial-credit scoring. Not done here to match source concept.
