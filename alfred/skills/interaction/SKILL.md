# Skill: Interaction Patterns

## Purpose

Define the 17 canonical interaction patterns so every game uses the correct event listeners, state management, touch handling, hit detection, undo behavior, and visual feedback for its interaction type. Without this, each game invents its own interaction code — leading to inconsistent touch handling, broken drag on mobile, missing guards, and unreliable input blocking.

## When to use

Every game generation. The game-building step reads this skill after identifying the interaction pattern from the archetype and spec. The interaction pattern determines which event listeners to attach, how to manage selection state, when to block input, and how to wire visual feedback.

## Owner

**Maintainer:** Gen Quality slot (reviews interaction code) + Mobile slot (reviews touch handling).
**Deletion trigger:** Retire when interaction handling moves to a shared CDN component that games import rather than implement inline.

## Reads

- `skills/game-archetypes/SKILL.md` — archetype determines the interaction type — **ALWAYS**
- `skills/mobile/SKILL.md` — touch targets, gesture suppression, `touch-action` — **ALWAYS**
- `skills/feedback/SKILL.md` — feedback behavior depends on single-step vs multi-step — **ALWAYS**
- `skills/game-building/reference/code-patterns.md` — answer handler sequence, guards, syncDOM — **ON-DEMAND**

## Input

- Game archetype (from spec-creation / game-planning)
- Interaction type from the spec (tap, drag, input, match, etc.)
- Single-step vs multi-step (determines feedback wiring)

## Output

Interaction code baked into the generated game. The builder reads this skill and implements the correct pattern for the game's interaction type.

## Reference Files

| File | Contents | When to read |
|------|----------|-------------|
| [patterns-summary.md](reference/patterns-summary.md) | Quick-reference table of all 17 patterns + 2 modifiers | **ALWAYS** (to identify which pattern files to load) |
| [touch-events.md](reference/touch-events.md) | Event type decision tree, pointer events guide, hit detection, gesture suppression, preventDefault rules | **ALWAYS during code generation** |
| [state-and-guards.md](reference/state-and-guards.md) | Selection state machines, isProcessing guards, undo/reset patterns, common guard code | **ALWAYS during code generation** |

### Pattern Files (load only the ones needed for the game)

| File | Pattern |
|------|---------|
| [tap-interaction.md](reference/patterns/tap-interaction.md) | **All tap/click patterns** — P1, P2, P3, P8, P9, P10, P11, P12, P14, P15, P16 |
| [p05-continuous-drag-path.md](reference/patterns/p05-continuous-drag-path.md) | Continuous Drag (Path) — draw path across grid |
| [p06-drag-and-drop.md](reference/patterns/p06-drag-and-drop.md) | Drag-and-Drop — clone-based, eviction, edge-scroll, zone-to-zone |
| [p07-text-input.md](reference/patterns/p07-text-input.md) | Text/Number Input — keyboard, Enter submit, visualViewport |
| [p13-directional-drag.md](reference/patterns/p13-directional-drag.md) | Directional Drag (Constrained Axis) — Rush Hour style |
| [p17-voice-input.md](reference/patterns/p17-voice-input.md) | Voice Input — speak or type answer via VoiceInput CDN package |
| [modifier-observe-phase.md](reference/patterns/modifier-observe-phase.md) | Observe-then-Respond phase wrapper |
| [modifier-multi-step-mcq.md](reference/patterns/modifier-multi-step-mcq.md) | Multi-Step MCQ — P1 repeated N times per round |

---

## Full Pattern Inventory (17 patterns)

| # | Pattern | Events | Step type | Game count |
|---|---------|--------|-----------|------------|
| 1 | Tap-Select (Single) | `click` | Single | 11 |
| 2 | Tap-Select (Sequential Chain) | `click` | Multi | 1 |
| 3 | Tap-Select (Two-Phase Match) | `click` | Multi | 3 |
| 4 | ~~Tap + Swipe~~ **DEPRECATED** — use P1 tap-only | — | — | 0 |
| 5 | Continuous Drag (Path) | `pointerdown`+`pointermove`+`pointerup` | Multi | 3 |
| 6 | Drag-and-Drop (Pick & Place) | `@dnd-kit/dom` (ESM) — DragDropManager/Draggable/Droppable | Multi | 4 |
| 7 | Text/Number Input | `keydown`+`click` | Single | 8 |
| 8 | Click-to-Toggle | `click` | Multi | 3 |
| 9 | Stepper (Increment/Decrement) | `click` | Multi | 1 |
| 10 | Multi-Select + Submit | `click` + submit button | Multi | 6 |
| 11 | Same-Grid Pair Selection | `click` | Multi | 3 |
| 12 | Tap-to-Assign (Palette) | `click` (palette) + `click` (items) | Multi | 1 |
| 13 | Directional Drag (Constrained Axis) | `pointerdown`+`pointermove`+`pointerup` | Multi | 1 |
| 14 | Edge/Segment Toggle | `click` | Multi | 1 |
| 15 | Cell Select → Number Picker | `click` (cell) + `click` (picker) | Multi | 3 |
| 16 | Sequence Replay (Observe → Reproduce) | `click` | Multi | 1 |
| 17 | Voice Input (Speak or Type) | `getUserMedia` + `click` | Single | — |

---

## Interaction Pattern Identification

### Step 1: Read the archetype

| Archetype | Default interaction pattern |
|-----------|---------------------------|
| MCQ Quiz | Tap-Select (Single) — P1 |
| Speed Blitz | Tap-Select (Single) — P1 |
| Lives Challenge | Tap-Select (Single) — P1, or Text/Number Input — P7 |
| No-Penalty Explorer | Tap-Select (Single) — P1 |
| Sort/Classify | Drag-and-Drop (Pick & Place) — P6 |
| Memory Match | Tap-Select (Two-Phase Match) — P3 |
| Board Puzzle | Click-to-Toggle — P8, or Cell Select → Number Picker — P15 |
| Construction | Drag-and-Drop — P6, or Tap-Select (Single) — P1 |
| Worked Example | Tap-Select (Single) — P1 + Text/Number Input — P7 |
| Tracking/Attention | Tap-Select (Single) — P1, or Sequence Replay — P16 |

### Step 2: Check spec overrides

| Spec keyword | Overrides to | Pattern # |
|-------------|-------------|-----------|
| "drag", "sort into", "place in zone" | Drag-and-Drop | P6 |
| "drag into grid cells", "drag tags into cells" | Drag-and-Drop (grid variant) | P6 |
| "swipe", "slide jelly/piece", "push" | ~~Tap + Swipe~~ **DEPRECATED** — convert to Tap-Select (progressive tap with directional buttons) | P1 |
| "slide block", "Rush Hour", "move block along axis" | Directional Drag (Constrained) | P13 |
| "draw a path", "connect cells", "trace", "navigate maze" | Continuous Drag (Path) | P5 |
| "match pairs", "find the pair", "flip cards" | Two-Phase Match | P3 |
| "tap pairs from same grid", "pairs that sum to" | Same-Grid Pair Selection | P11 |
| "build a chain", "tap in sequence", "find the sequence" | Sequential Chain | P2 |
| "type", "enter the number", "fill in the blank" | Text/Number Input | P7 |
| "toggle", "place/remove", "click to fill", "hide/show" | Click-to-Toggle | P8 |
| "toggle edges", "draw segments between dots" | Edge/Segment Toggle | P14 |
| "select all correct", "checkbox", "multi-select + submit" | Multi-Select + Submit | P10 |
| "select numbers to reach target", "tap to add to sum" | Multi-Select + Submit (auto-check variant) | P10 |
| "+/- buttons", "adjust", "increment/decrement" | Stepper | P9 |
| "colour-code", "assign category", "label each item" | Tap-to-Assign (Palette) | P12 |
| "tap cell then pick number", "number picker" | Cell Select → Number Picker | P15 |
| "watch sequence then repeat", "Simon Says" | Sequence Replay | P16 |
| "say your answer", "speak", "voice input", "type or speak" | Voice Input | P17 |

### Step 3: Determine single-step vs multi-step

| Pattern | Step type | Why |
|---------|----------|-----|
| P1 Tap-Select (Single) | **Single-step** | 1 tap = 1 evaluation = round complete |
| P2 Sequential Chain | **Multi-step** | Multiple taps to build chain |
| P3 Two-Phase Match | **Multi-step** | Multiple pairs to match per round |
| P4 ~~Tap + Swipe~~ | **DEPRECATED** | Use P1 tap-only with directional buttons instead |
| P5 Continuous Drag (Path) | **Multi-step** | Full path needed |
| P6 Drag-and-Drop (`@dnd-kit/dom`) | **Multi-step** | Multiple items to place |
| P7 Text/Number Input | **Single-step** | 1 input + submit = 1 evaluation |
| P8 Click-to-Toggle | **Multi-step** | Multiple toggles to solve |
| P9 Stepper | **Multi-step** | Adjust values + then submit/check |
| P10 Multi-Select + Submit | **Multi-step** | Toggle multiple items then submit |
| P11 Same-Grid Pair Selection | **Multi-step** | Multiple pairs from same grid |
| P12 Tap-to-Assign (Palette) | **Multi-step** | Assign colours/labels to multiple items |
| P13 Directional Drag (Constrained) | **Multi-step** | Multiple block moves to solve |
| P14 Edge/Segment Toggle | **Multi-step** | Multiple edges to form loop |
| P15 Cell Select → Number Picker | **Multi-step** | Fill multiple cells |
| P16 Sequence Replay | **Multi-step** | Reproduce sequence tap by tap |
| P17 Voice Input | **Single-step** | 1 spoken/typed answer + submit = 1 evaluation (uses VoiceInput CDN package) |

---

## Phase Modifier: Observe-then-Respond

Some games have a **memorize/observe phase** before the interaction phase. This is NOT a separate pattern — it's a phase that wraps an existing interaction pattern.

| Observe type | How it works | Then interacts via | Games |
|-------------|-------------|-------------------|-------|
| **Visual memorize** | Grid/pattern shown briefly, then hidden | Click-to-Toggle (P8), Text Input (P7), Tap-Select (P1) | Visual Memory, Disappearing Numbers, Matrix Memory |
| **Sequential memorize** | Items shown one by one | Sequence Replay (P16), Text Input (P7) | Simon Says, Listen and Add, Totals in a Flash |
| **Learn pairs** | Pairs shown sequentially | Two-Phase Match (P3), Text Input (P7), Tap-Select (P1) | Associations, Word Pairs, Face Memory |
| **Track movement** | Item hidden, containers shuffle | Tap-Select (P1) | Keep Track |

**Implementation:** The observe phase uses `setTimeout` or animation callbacks to control timing. During the observe phase, `gameState.phase = 'observing'` and all interaction handlers return early. After the observe phase completes, `gameState.phase = 'responding'` and interaction is enabled.

---

## Game-Flow Modifier: Multi-Step MCQ

Some games use Tap-Select (Single) — P1 — multiple times within a single round. Each step is an independent MCQ choice, but they're chained together as sub-steps of one round.

| How it works | Games |
|-------------|-------|
| Round has 2-3 MCQ sub-steps. Each step shows options, student taps one, immediate feedback, then next step appears. Round completes after all sub-steps are answered. | Expression Completer, Sequence Builder, Aided Game, Two-Digit Doubles Aided |

**Implementation:** Track `gameState.currentStep` within each round. The interaction pattern per step is still P1 (Tap-Select Single). The round advances when `currentStep >= totalSteps`.

---

## Complete Game → Pattern Mapping (47 games)

| # | Game | Pattern(s) | Phase modifier |
|---|------|-----------|---------------|
| 1 | Adjustment Strategy | P9 (Stepper) + P7 (Input) | — |
| 2 | Aided Game | P1 (Tap-Select) ×2 steps | Multi-Step MCQ |
| 3 | Associations | P1 (Tap-Select) | Observe (learn pairs) |
| 4 | Bubbles Pairs | P11 (Same-Grid Pair) | — |
| 5 | Colour Coding Tool | P12 (Palette Assign) + P7 (Input) | — |
| 6 | Connect | P5 (Continuous Drag Path) | — |
| 7 | Crazy Maze | P5 (Continuous Drag Path) — tap variant | — |
| 8 | Disappearing Numbers | P7 (Input) | Observe (visual memorize) |
| 9 | Doubles | P2 (Sequential Chain) | — |
| 10 | Equation Grid | P6 (Drag-and-Drop) + Submit | — |
| 11 | Explain the Pattern | P7 (Input) ×2 phases | — |
| 12 | Expression Completer | P1 (Tap-Select) ×2 steps | Multi-Step MCQ |
| 13 | Face Memory | P1 (Tap-Select) | Observe (visual memorize) |
| 14 | Free the Key | P13 (Directional Drag Constrained) | — |
| 15 | Futoshiki | P15 (Cell + Number Picker) | — |
| 16 | Hidden Sums | P10 (Multi-Select + Submit) | — |
| 17 | Hide Unhide | P8 (Click-to-Toggle) + Submit | — |
| 18 | Identify Pairs List | P11 (Same-Grid Pair) | — |
| 19 | Interactive Chat | P7 (Input) + P1 (Tap-Select) alternating | — |
| 20 | Jelly Doods | P1 (Tap-Select with directional buttons) — ~~P4 deprecated~~ | — |
| 21 | Kakuro | P6 (Drag-and-Drop into grid) or P15 (Cell + Picker) | — |
| 22 | Keep Track | P1 (Tap-Select) | Observe (track movement) |
| 23 | Killer Sudoku | P15 (Cell + Number Picker) | — |
| 24 | Light Up | P8 (Click-to-Toggle) | — |
| 25 | Listen and Add | P7 (Input) | Observe (audio sequential) |
| 26 | Loop the Loop | P14 (Edge/Segment Toggle) | — |
| 27 | Make X | P10 (Multi-Select + auto-check) | — |
| 28 | Match the Cards | P3 (Two-Phase Match) | — |
| 29 | Matching Doubles | P3 (Two-Phase Match) | — |
| 30 | Math Crossword | P6 (Drag-and-Drop) + Submit | — |
| 31 | Matrix Memory | P7 (Input) or P1 (Tap-Select) | Observe (visual memorize) |
| 32 | MCQ Multi-Select | P10 (Multi-Select + Submit) | — |
| 33 | Memory Flip | P3 (Two-Phase Match — card flip) | — |
| 34 | Number Pattern | P1 (Tap-Select) | — |
| 35 | One Digit Doubles | P1 (Tap-Select) | — |
| 36 | Position Maximizer | P1 (Tap-Select) | — |
| 37 | Queens | P8 (Click-to-Toggle) | — |
| 38 | Rapid Challenge | P1 (Tap-Select) | — |
| 39 | Sequence Builder | P1 (Tap-Select) ×N steps | Multi-Step MCQ |
| 40 | Simon Says | P16 (Sequence Replay) | Observe (sequential flash) |
| 41 | Speed Input | P7 (Input) | — |
| 42 | Speedy Taps | P11 (Same-Grid Pair) | — |
| 43 | Subjective | P7 (Input — textarea) | — |
| 44 | Totals in a Flash | P7 (Input) | Observe (visual+audio sequential) |
| 45 | True or False | P1 (Tap-Select — binary) | — |
| 46 | Truth Tellers & Liars | P10 (Multi-Select + Submit) or P12 (Palette Assign) | — |
| 47 | Two Digit Doubles Aided | P1 (Tap-Select) ×3 steps | Multi-Step MCQ |
| 48 | Two Player Race | P1 (Tap-Select) ×2 players | Split-screen layout |
| 49 | Visual Memory | P8 (Toggle) + Submit | Observe (visual memorize) |
| 50 | Word Pairs | P7 (Input) | Observe (learn pairs) |
| 51 | Zip | P5 (Continuous Drag Path) | — |

**Coverage: 47/47 games mapped. 0 unmapped.**

---

## The 16 Patterns (Summary)

### Pattern 1: Tap-Select (Single)

**What:** Student taps one element to make a choice. One tap = one evaluation.
**Events:** `click` on option buttons or grid cells.
**Game type:** Single-step.
**Selection:** No persistent selection. Tap = immediate evaluation.
**Guards:** `isProcessing`, `isActive`, `gameEnded`.
**Feedback:** SFX (awaited) → dynamic TTS (awaited). Input blocked during both.
**Used by:** MCQ Quiz, Rapid Challenge, True/False, One Digit Doubles, Position Maximizer, Number Pattern, Face Memory (response phase), Associations (response phase), Keep Track, Two-Player Race.

### Pattern 2: Tap-Select (Sequential Chain)

**What:** Student taps elements in a specific order to build a chain/sequence.
**Events:** `click` on grid tiles.
**Game type:** Multi-step.
**Selection:** Persistent — each valid tap adds `.selected`. Wrong tap force-resets entire chain.
**Guards:** `isProcessing`, `isActive`, tile in `completedTiles`.
**Feedback:** Fire-and-forget SFX + sticker per tap. Awaited SFX on round-complete.
**Used by:** Doubles.

### Pattern 3: Tap-Select (Two-Phase Match)

**What:** Student taps item A, then taps matching item B. Two taps = one evaluation.
**Events:** `click`/`onclick` on items in both groups.
**Game type:** Multi-step.
**Selection:** First tap highlights (`.selected`). Re-selectable before second tap. Second tap evaluates.
**Guards:** `isProcessing`, `selectedA !== null`, item not `.matched`.
**Feedback:** Fire-and-forget SFX + sticker per match. Awaited SFX on round-complete.
**Used by:** Matching Doubles, Match the Cards, Memory Flip.

### Pattern 4: ~~Tap + Swipe~~ — DEPRECATED

**DEPRECATED.** Swipe interactions are unreliable on mobile. Convert to P1 (Tap-Select) with directional buttons or progressive tapping. If a spec mentions "swipe", "slide", or "push", redesign as tap-only during spec creation.
**Previously used by:** Jelly Doods (now uses P1 with directional buttons).

### Pattern 5: Continuous Drag (Path)

**What:** Student draws a continuous path by pressing and dragging across cells.
**Events:** `pointerdown` on grid, `pointermove`+`pointerup`+`pointercancel` on document.
**Game type:** Multi-step.
**Hit detection:** `document.elementFromPoint(clientX, clientY)`.
**Feedback:** Fire-and-forget tap SFX per cell. Awaited SFX + TTS on puzzle-complete.
**Variant — Tap Path (Crazy Maze):** Student taps adjacent cells one by one instead of continuous drag. Same state (path array), but uses `click` events instead of pointer events. Running total tracked and displayed.
**Used by:** Connect, Zip, Crazy Maze.

### Pattern 6: Drag-and-Drop (Pick & Place)

**What:** Student picks up an item and drops it into a target zone or grid cell.
**Library:** **`@dnd-kit/dom`** loaded via ESM CDN (`https://esm.sh/@dnd-kit/dom@beta`). Use `DragDropManager`, `Draggable`, `Droppable` — never native HTML5 drag (`draggable="true"` / `dataTransfer`) and never hand-rolled pointer events. See `reference/patterns/p06-drag-and-drop.md` for the full 8 required behaviours and V1–V20 verification matrix, which is MANDATORY for every P6 game.
**Events:** handled by the library's pointer sensor — cross-device (mouse + touch) out of the box. Listen to `manager.monitor` (`dragstart`, `dragend`).
**Game type:** Multi-step.
**CSS:** `touch-action: none` ONLY on the draggable items themselves — never on `body`, `html`, containers, or drop zones (that blocks page scroll). Add a `touchmove` preventDefault gated on an `isDragging` flag (set on dragstart, cleared on dragend).
**Tracking:** game-controlled `locations` map (tagId → 'bank' | 'zone-N'). Never infer origin from `parentElement` — the library reparents during drag. Required to distinguish evict (bank→zone) from swap (zone→zone).
**Lifecycle:** destroy manager + draggables + droppables + clear tracking at the start of every round and in `endGame()`.
**Feedback:** Fire-and-forget SFX + sticker per drop. Awaited SFX on round-complete.
**Variant — Grid Cell Drop:** Drop targets are individual grid cells (not category zones). Used by Kakuro, Equation Grid, Math Crossword.
**Used by:** Equation Grid, Math Crossword, Kakuro.

### Pattern 7: Text/Number Input

**What:** Student types answer and submits via Enter key or Submit button.
**Events:** `keydown` (Enter) on input, `click` on submit button.
**Game type:** Single-step.
**Input HTML:** `type="text" inputmode="numeric" pattern="[0-9]*"` with `font-size: 16px`.
**Keyboard:** Blur after answer. `visualViewport` resize listener.
**Variant — Textarea (Subjective):** `<textarea>` for free-text responses. LLM evaluates.
**Variant — Mixed (Interactive Chat):** Alternates between text input and MCQ buttons per message.
**Used by:** Speed Input, Listen and Add, Totals in a Flash, Disappearing Numbers, Word Pairs, Matrix Memory, Adjustment Strategy (sum step), Colour Coding Tool (sum step), Explain the Pattern, Subjective, Interactive Chat.

### Pattern 8: Click-to-Toggle

**What:** Student clicks cells to cycle through states. Board evaluated against constraints.
**Events:** `click` on grid cells.
**Game type:** Multi-step.
**Selection:** Toggle (click again = undo).
**Feedback:** No audio per toggle. Constraint violations visual-only. Awaited SFX + TTS on solve.
**Variant — Toggle + Submit:** Student toggles cells, then presses Check/Submit to validate (Hide-Unhide, Visual Memory). Constraints NOT checked per-toggle — only on submit.
**Used by:** Queens, Light Up, Hide-Unhide, Visual Memory (response phase).

### Pattern 9: Stepper (Increment/Decrement)

**What:** Student taps +/− buttons to adjust a numeric value. Two linked values adjust inversely.
**Events:** `click` on +/− buttons.
**Game type:** Multi-step (adjust + then submit/type answer).
**Selection:** No selection state. Each +/− tap updates the displayed value immediately.
**State:** `adjustedValues` array tracking current values. Value clamped within valid range.
**Submit:** After adjusting, student types the sum into an input field (combines with P7).
**Guards:** `isProcessing`, value at min/max bound.
**Feedback:** Fire-and-forget tap SFX per +/− press. Evaluation happens on submit (single-step for the submit part).
**Used by:** Adjustment Strategy.

### Pattern 10: Multi-Select + Submit

**What:** Student taps multiple items to toggle their selected state (checkbox-style), then presses Submit to evaluate all selections at once.
**Events:** `click` on items (toggle `.selected`), `click` on Submit button.
**Game type:** Multi-step (toggling) → single-step evaluation (submit).
**Selection:** Each tap toggles `.selected` on/off. Multiple items can be selected simultaneously.
**State:** `selectedItems` Set tracking which items are toggled on.
**Variant — Running Sum (Hidden Sums, Make-X):** A live counter shows the running sum of selected values. Auto-check: if sum equals target → correct; if sum exceeds target → incorrect (Make-X).
**Variant — All-or-Nothing (MCQ Multi-Select):** Must select ALL correct AND no incorrect. Partial credit not given.
**Guards:** `isProcessing`, Submit disabled when nothing selected.
**Feedback:** Fire-and-forget tap SFX per toggle. Awaited SFX → TTS on Submit evaluation.
**Used by:** MCQ Multi-Select, Hidden Sums, Make-X, Hide-Unhide (row targets), Truth Tellers & Liars, Visual Memory (reconstruction phase).

### Pattern 11: Same-Grid Pair Selection

**What:** Student taps two items from the same grid that form a valid pair. Two taps from one pool.
**Events:** `click` on grid items.
**Game type:** Multi-step (multiple pairs per round).
**Selection:** First tap highlights item A (`.selected`). Second tap evaluates: if A + B form a valid pair, both are removed/marked. If not, flash incorrect.
**Difference from P3:** Both items come from the same grid (not separate left/right groups). No group enabling/disabling.
**State:** `selectedIndex` (first selection), `matchedPairs` Set, `removedItems` Set.
**Guards:** `isProcessing`, item not already matched/removed.
**Feedback:** Fire-and-forget SFX + sticker per correct pair. Fire-and-forget wrong SFX on mismatch. Awaited SFX on round-complete (all pairs found).
**Used by:** Bubbles Pairs, Speedy Taps, Identify Pairs List.

### Pattern 12: Tap-to-Assign (Palette)

**What:** Student selects a colour/category from a palette, then taps items to assign that colour/category to them.
**Events:** `click` on palette swatches (select colour), `click` on items (assign colour).
**Game type:** Multi-step (assign + then submit).
**Selection:** Active palette colour (`.palette-active`). Tapping an item applies the active colour.
**State:** `activePalette` (current colour), `assignments` Map (item → colour).
**Submit:** After colouring, student types the answer (combines with P7) or presses Check.
**Guards:** `isProcessing`, no active palette selected.
**Feedback:** Fire-and-forget tap SFX per assignment. Evaluation on submit.
**Used by:** Colour Coding Tool. (Truth Tellers & Liars can also use this pattern — assign T/L labels.)

### Pattern 13: Directional Drag (Constrained Axis)

**What:** Student drags blocks along their allowed axis (horizontal OR vertical, not both) to clear a path. Rush Hour / sliding block puzzle.
**Events:** `pointerdown` on block, `pointermove`+`pointerup`+`pointercancel` on document.
**Game type:** Multi-step (multiple block moves to solve).
**Drag constraint:** Each block has an `orientation` (horizontal/vertical). During drag, movement is locked to that axis only.
**Hit detection:** Track block position by pointer delta along the constrained axis. Snap to grid cells.
**State:** `blocks` array with `{id, row, col, length, orientation}`. `selectedBlock` during drag. `moveCount`.
**Win condition:** Key block reaches the exit cell/edge.
**Undo:** Move history stack. Undo button restores previous state.
**Guards:** `isProcessing`, `solved`, block not movable (blocked by adjacent block).
**Feedback:** Fire-and-forget slide SFX per move. Awaited SFX + TTS on puzzle-complete.
**Used by:** Free the Key.

### Pattern 14: Edge/Segment Toggle

**What:** Student taps between adjacent dots/nodes to toggle a line segment on/off, forming a closed loop or path.
**Events:** `click` on edge elements (rendered between dots).
**Game type:** Multi-step.
**Target:** The interactive elements are the **edges** between cells/dots, not the cells/dots themselves. Edges are typically thin rectangular hit areas between grid points.
**State:** `edges` Map (edge key → boolean on/off). Constraint: numbered squares dictate how many adjacent edges must be on.
**Constraint checking:** After each toggle, check if any numbered constraint is violated (highlight violations). Auto-validate when a valid closed loop is detected.
**Undo:** Click same edge again (toggle off).
**Guards:** `isProcessing`, `solved`.
**Feedback:** Fire-and-forget tap SFX per toggle. Constraint violations visual-only. Awaited SFX + TTS on puzzle-complete.
**Used by:** Loop the Loop.

### Pattern 15: Cell Select → Number Picker

**What:** Student taps a grid cell to select it, then chooses a number from a popup picker or inline number bar to place it.
**Events:** `click` on grid cell (opens picker), `click` on picker number (places value).
**Game type:** Multi-step (fill multiple cells).
**Two-phase within a single action:**
  1. Tap empty cell → cell highlights, picker appears (inline bar or popup).
  2. Tap number in picker → number placed in cell, picker dismisses.
  3. Tap same cell again → clears the placed number (undo).
**State:** `selectedCell` (`{row, col}` or null), `grid[][]` (placed values), `lockedCells` (pre-filled clues).
**Constraint checking:** Per-placement: check row/column uniqueness, sum constraints, inequality constraints. Highlight violations.
**Submit:** Check button validates entire grid (Kakuro, Killer Sudoku) or auto-validates when all cells filled (Futoshiki).
**Guards:** `isProcessing`, `solved`, cell is locked.
**Feedback:** Fire-and-forget tap SFX per placement. Awaited SFX + TTS on puzzle-complete.
**Used by:** Futoshiki, Kakuro (when not using drag), Killer Sudoku.

### Pattern 16: Sequence Replay (Observe → Reproduce)

**What:** Student watches a sequence play out (flashing lights, appearing items), then reproduces it by tapping in the same order.
**Events:** `click` on elements (during reproduction phase).
**Game type:** Multi-step (tap N elements in order).
**Two phases:**
  1. **Observe phase:** Elements flash/highlight in sequence with timed delays. Student watches. Input disabled (`gameState.phase = 'observing'`).
  2. **Reproduce phase:** Student taps elements in the same order. Each tap is validated immediately.
**State:** `sequence` array (the correct order), `playerSequence` array (student's taps so far), `currentStep` (position in reproduction).
**Per-tap evaluation:**
  - Correct (matches `sequence[currentStep]`): highlight, fire-and-forget SFX, increment `currentStep`.
  - Wrong: flash incorrect, life lost, round fails.
  - Sequence complete (`currentStep >= sequence.length`): round complete.
**Guards:** `isProcessing`, phase must be `'responding'` (not `'observing'`).
**Feedback:** Fire-and-forget SFX per correct tap. Wrong SFX + life lost on wrong tap. Awaited SFX on sequence complete.
**Used by:** Simon Says.

---

## Cross-Cutting Rules

### 1. Every handler starts with guards

```javascript
if (!gameState.isActive) return;
if (gameState.isProcessing) return;
if (gameState.gameEnded) return;
```

No exceptions. Missing guards cause double-fire, corruption, and test failures.

### 2. `isProcessing` blocks input during feedback

- **Single-step patterns (P1, P7):** `isProcessing = true` before audio, `false` after all audio completes.
- **Multi-step patterns (all others):** `isProcessing` used briefly during animations/evaluations, NOT during fire-and-forget SFX.
- **Exception:** Round-complete, puzzle-complete, and submit-evaluation moments in multi-step games DO block via `isProcessing` (awaited SFX).

### 3. Event type follows the touch decision tree

```
Drag/swipe involved? → pointer events (pointerdown, pointermove, pointerup, pointercancel)
Text input? → keydown (Enter) + click (Submit)
Everything else? → click
```

Never use `touchstart`/`touchmove`/`touchend` directly. Pointer events unify mouse + touch.

### 4. `preventDefault` rules

| Event | When to call `preventDefault` |
|-------|------------------------------|
| `pointerdown` | Always, when drag/swipe is involved (prevents scroll) |
| `pointermove` | Always, when continuous drag (prevents scroll during drag) |
| `keydown` (Enter) | Always on inputs (prevents form submission / page reload) |
| `click` | Never (click is the final event, nothing to prevent) |

### 5. Hit detection during drag

Use `document.elementFromPoint(e.clientX, e.clientY)` for continuous drag (P5) and drag-and-drop (P6, P13). During a drag, `pointermove` fires on the element where the pointer was initially captured, NOT where it currently is.

### 6. Document-level listeners for drag

Attach `pointermove`, `pointerup`, and `pointercancel` to `document`, not to the grid. This ensures the drag continues even if the finger drifts outside the grid.

### 7. `touch-action` CSS

| Pattern | CSS on interactive elements |
|---------|---------------------------|
| Tap-based (P1, P2, P3, P8, P9, P10, P11, P12, P14, P15, P16) | `touch-action: manipulation` |
| ~~Swipe (P4)~~ | **DEPRECATED** |
| Continuous drag (P5) | `touch-action: none` on grid |
| Drag-and-drop (P6) | `touch-action: none` on draggable items |
| Constrained drag (P13) | `touch-action: none` on draggable blocks |
| Input (P7) | Default |

### 8. Undo varies by pattern

| Pattern | Undo mechanism |
|---------|---------------|
| P1 Tap-Select (Single) | None — tap is final |
| P2 Sequential Chain | Forced reset on error |
| P3 Two-Phase Match | Re-select first item |
| ~~P4 Tap + Swipe~~ | **DEPRECATED** — use P1 tap-only |
| P5 Continuous Drag | Backtrack drag + Reset button |
| P6 Drag-and-Drop | Snap-back on miss; tap placed item to return |
| P7 Text Input | Clear input / retype |
| P8 Click-to-Toggle | Click again to toggle back |
| P9 Stepper | Tap opposite +/− button |
| P10 Multi-Select + Submit | Tap to deselect before submit |
| P11 Same-Grid Pair | Tap different item to change first selection |
| P12 Palette Assign | Tap item again with different colour |
| P13 Directional Drag | Undo button (move history stack) |
| P14 Edge Toggle | Click same edge to toggle off |
| P15 Cell + Picker | Tap filled cell to clear |
| P16 Sequence Replay | None — each tap is evaluated immediately |

---

## Constraints

1. **CRITICAL — Use the correct event type.** Drag/swipe = pointer events. Everything else = click. Never mix. Never use raw touch events.
2. **CRITICAL — Every handler has guards.** `isActive`, `isProcessing`, `gameEnded`. Missing guards = double-fire, state corruption.
3. **CRITICAL — `preventDefault` on pointer events for drag/swipe.** Without it, the page scrolls during drag on mobile.
4. **CRITICAL — `touch-action: none` on draggable elements.** Without it, the browser intercepts touch gestures.
5. **CRITICAL — Document-level listeners for drag.** `pointermove`/`pointerup` on `document`, not on the grid.
6. **CRITICAL — `elementFromPoint` for continuous drag hit detection.** Direct `e.target` during `pointermove` gives the wrong element.
7. **CRITICAL — Observe phase blocks interaction.** During observe phases (P16, memorize games), `gameState.phase = 'observing'` and all handlers return early.
8. **STANDARD — Min 44x44px touch targets.** Per mobile skill.
9. **STANDARD — 8px spacing between targets.** Per mobile skill.
10. **STANDARD — `inputmode="numeric"` for number inputs.** Never `type="number"`. Per mobile skill.
11. **STANDARD — Blur input after answer.** Dismiss keyboard before showing feedback.
12. **STANDARD — `SWIPE_THRESHOLD = 30px`.** Below this, the gesture is a tap, not a swipe.
13. **STANDARD — `pointercancel` handler on drag patterns.** Handles OS-level interruptions.
14. **STANDARD — Edge targets (P14) need extra hit area.** Edges between dots are thin — add padding or invisible hit areas to reach 44px minimum.
15. **STANDARD — Number picker (P15) dismisses on outside tap.** Tapping outside the picker closes it without placing a number.

## Anti-patterns

1. **Using `touchstart`/`touchmove`/`touchend` instead of pointer events.**
2. **Attaching `pointermove` to the grid instead of `document`.**
3. **Using `e.target` during `pointermove` for hit detection.**
4. **Missing `isProcessing` guard.**
5. **Missing `preventDefault` on `pointerdown` for drag games.**
6. **Missing `touch-action: none` on draggable elements.**
7. **Auto-focusing input on round transition.**
8. **Using `type="number"` input.**
9. **Not handling `pointercancel`.**
10. **Evaluating per-cell in continuous drag/puzzle games.**
11. **Blocking input with `isProcessing` during fire-and-forget multi-step SFX.**
12. **No undo in puzzle games.**
13. **Allowing interaction during observe phase.** Must check `gameState.phase !== 'observing'`.
14. **Not constraining drag axis in P13.** Free the Key blocks must only move along their orientation axis.
15. **Edge/segment targets too thin to tap.** Must have invisible padding to 44px minimum.
16. **Number picker not dismissing on outside tap.** Leaves picker open, blocks other interactions.

## Verification Checklist

- [ ] Correct event type used for the interaction pattern
- [ ] All three guards present in every handler (`isActive`, `isProcessing`, `gameEnded`)
- [ ] `preventDefault` called on `pointerdown`/`pointermove` for drag/swipe patterns
- [ ] `touch-action` CSS set correctly per pattern
- [ ] `pointermove`/`pointerup`/`pointercancel` attached to `document` for drag patterns
- [ ] `elementFromPoint` used for continuous drag hit detection
- [ ] Touch targets >= 44x44px with >= 8px spacing
- [ ] `inputmode="numeric"` for number inputs (not `type="number"`)
- [ ] Input blurred after answer processed
- [ ] `visualViewport` resize listener for keyboard (input patterns)
- [ ] Undo mechanism present for puzzle patterns
- [ ] `isProcessing` blocks during awaited audio only, not during fire-and-forget
- [ ] Feedback type matches single-step (awaited SFX→TTS) or multi-step (fire-and-forget SFX)
- [ ] Observe phase blocks all interaction (P16, memorize games)
- [ ] Drag axis constrained for P13 (Directional Drag)
- [ ] Edge/segment hit areas padded to 44px minimum (P14)
- [ ] Number picker dismisses on outside tap (P15)
- [ ] Multi-Step MCQ tracks `currentStep` within round
