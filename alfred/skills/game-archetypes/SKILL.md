# Skill: Game Archetypes

## Purpose

Define the 10 validated game archetype profiles so that every downstream skill (spec creation, game planning, game building, testing) can look up the structural skeleton, interaction model, scoring, feedback, screen flow, PART flags, and defaults for any game.

## When to use

When identifying which game archetype a spec or game description maps to, or when a downstream skill (spec-creation, game-planning, game-building, game-testing) needs the PART flags, screen state machine, scoring model, or defaults for an archetype.

## Owner

Maintained by: spec-creation pipeline (any change to archetype profiles must be validated against shipped games).
Deletion trigger: retire an archetype when zero shipped games use it for 6+ months AND no spec in the backlog references it.

## Reads

- `skills-taxonomy.md` sections 1.1 (Game structure type), 1.2 (Screen state machine), 2.1 (Input types), Game Archetype Profiles table — ALWAYS
- Warehouse PART flag definitions (referenced by ID only; full specs live in warehouse docs) — ON-DEMAND (load only when validating PART flags for a custom archetype or resolving a PART flag conflict)

## Input

A game description or spec containing enough information to identify the archetype. At minimum: what the student does (verb), how the game is organized (rounds/timer/lives/phases), and what kind of input the student provides.

## Output

One archetype profile (or a custom-archetype report) containing:

- `archetype`: profile name
- `structure`: how the game is organized
- `interaction`: how the student acts
- `scoring`: how points are awarded
- `feedback`: what the student sees after each action
- `screens`: the state machine (screens + transitions)
- `part_flags`: which PART-NNN flags must be YES
- `defaults.rounds`: number of rounds
- `defaults.lives`: number of lives (0 = no lives)
- `defaults.timer`: timer in seconds (0 = no timer)
- `confidence`: HIGH (exact match), MEDIUM (close match with noted differences), CUSTOM (no match)
- `notes`: any deviations from the profile that the spec requires

---

## Archetype Profiles

### 1. MCQ Quiz

The most common archetype. Fixed rounds, one question per round, tap an option, score at end.

| Attribute | Value |
|-----------|-------|
| **Structure** | Rounds-based. Fixed N rounds, sequential. |
| **Interaction** | MCQ (single select). Student taps one of 2-4 option buttons. |
| **Scoring** | +1 per correct answer. Stars at 90%/66%/33% thresholds. No penalty for wrong. |
| **Feedback** | `playDynamicFeedback('correct')` on right, `playDynamicFeedback('incorrect')` on wrong. Show correct answer after wrong. Auto-advance after 1.5s. |
| **Screen state machine** | `start` -> `gameplay` -> (loop N rounds) -> `results`. No `game_over` screen. |
| **PART flags** | PART-001 (CDN core), PART-004 (init), PART-005 (visibility), PART-007 (state), PART-008 (postMessage), PART-009 (recordAttempt), PART-010 (events), PART-042 (signals), PART-017 (FeedbackManager), PART-019 (results), PART-021 (mobile layout), PART-023 (progress bar), PART-024 (transitions), PART-025 (screen layout), PART-027 (play area) |
| **Rounds default** | 9 (3 per stage: easy/medium/hard) |
| **Lives default** | 0 (no lives) |
| **Timer default** | 0 (no timer) |

**Canonical examples:** which-ratio, geo-angle-id, stats-identify-class

---

### 2. Speed Blitz

Timed pressure. Answer as many as possible before the clock runs out. Speed matters.

| Attribute | Value |
|-----------|-------|
| **Structure** | Timed. Countdown clock. Game ends when timer expires. Round count is unlimited (endless) or very high ceiling. |
| **Interaction** | MCQ (single select). Fast tap, minimal deliberation. |
| **Scoring** | +1 per correct. Bonus for streaks or speed. Stars based on total correct (thresholds set by spec). No penalty for wrong (wrong just wastes time). |
| **Feedback** | `playDynamicFeedback('correct')` / `playDynamicFeedback('incorrect')`. Minimal delay (0.5s or less). Show correct answer briefly. Speed of feedback is critical. |
| **Screen state machine** | `start` -> `gameplay` -> (loop until timer expires) -> `results`. No `game_over` screen (timer expiry IS the natural end, shown on results). |
| **PART flags** | PART-001, PART-004, PART-005, PART-006 (timer), PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027, PART-050 (whenever the spec describes a Submit / Check / Done button — number-input variants and standalone `totalRounds: 1` variants especially; MCQ tap-to-answer variants skip it) |
| **Rounds default** | 0 (unlimited -- timer is the constraint) |
| **Lives default** | 0 (no lives) |
| **Timer default** | 60 seconds |

**Canonical examples:** addition-mcq-blitz, rapid-challenge

---

### 3. Lives Challenge

Stakes game. Wrong answers cost lives. Survival pressure creates engagement.

| Attribute | Value |
|-----------|-------|
| **Structure** | Lives + rounds. Fixed N rounds but game can end early if lives reach 0. |
| **Interaction** | MCQ (single) or number input. Can be multi-step (MCQ then number input in one round). |
| **Scoring** | +1 per correct. -1 life per wrong. Stars at 90%/66%/33%. |
| **Feedback** | `playDynamicFeedback('correct')` / `playDynamicFeedback('incorrect')`. Show correct answer after wrong. Life loss animation. If lives = 0, transition to game_over. |
| **Screen state machine** | `start` -> `gameplay` -> (loop rounds, checking lives after each) -> `results` (if all rounds done) OR `game_over` (if lives = 0). Both `results` and `game_over` -> `start` (replay). |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023 (progress bar with lives display), PART-024, PART-025, PART-027, PART-050 (whenever the spec's flow uses number-input or an explicit Submit / Check CTA in a round — pure MCQ tap-to-answer variants skip it) |
| **Rounds default** | 9 (3 per stage) |
| **Lives default** | 3 |
| **Timer default** | 0 (no timer; add PART-006 if spec says timed) |

**Canonical examples:** find-triangle-side, right-triangle-area

**Variant: Timed + Lives.** If the spec says both timer and lives, add PART-006 and set timer default to 45s. Game ends on EITHER lives = 0 OR timer expiry. Example: stats-mean-direct.

---

### 4. Sort/Classify

Student categorizes items by dragging them into buckets or zones.

| Attribute | Value |
|-----------|-------|
| **Structure** | Rounds-based. Each round presents a set of items to sort. |
| **Interaction** | Drag-and-drop (PART-033). Student drags items into labeled category zones. Touch-friendly drag handlers required. |
| **Scoring** | Per-item scoring within each round. +1 per correctly placed item. Stars based on total percentage. |
| **Feedback** | `playDynamicFeedback('correct')` when all items correctly placed in round. Per-item visual feedback (green/red highlight on drop). Show corrections for misplaced items. |
| **Screen state machine** | `start` -> `gameplay` -> (loop rounds; each round = sort all items) -> `results`. No `game_over` (no lives by default). |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027, PART-033 (drag interaction), PART-050 (if spec's flow has an explicit Submit / Check CTA after placing items — auto-evaluate-on-drop variants skip it) |
| **Rounds default** | 6 (2 per stage) |
| **Lives default** | 0 |
| **Timer default** | 0 |

**Canonical examples:** geo-triangle-sort

---

### 5. Memory Match

Student finds matching pairs by flipping/clicking items. Tests recall or association.

| Attribute | Value |
|-----------|-------|
| **Structure** | Rounds-based. Each round is a grid of face-down cards. Round ends when all pairs found. |
| **Interaction** | Click-to-match. Student clicks two items to reveal and pair. Pair selection state machine: first click selects, second click checks match. Matched pairs stay revealed, mismatched pairs flip back. |
| **Scoring** | Pairs cleared count. Optional: penalty for mismatches (extra flips), bonus for fewer attempts. Stars based on efficiency (attempts / minimum possible). |
| **Feedback** | Visual: matched pairs glow/stay. Mismatched pairs shake and flip back. `playDynamicFeedback('correct')` on match, `playDynamicFeedback('incorrect')` on mismatch. |
| **Screen state machine** | `start` -> `gameplay` -> (loop rounds; each round = clear all pairs) -> `results`. No `game_over`. |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027 |
| **Rounds default** | 3 (each round is a fresh grid; grid size can increase per round) |
| **Lives default** | 0 |
| **Timer default** | 0 |

**Canonical examples:** match-the-cards, word-pairs, associations

---

### 6. Board Puzzle

A single state to solve. No sequential rounds -- the whole board IS the round. Student manipulates a grid or board until a win condition is met.

| Attribute | Value |
|-----------|-------|
| **Structure** | Puzzle. One board per round. The board is the game. Solving the board = completing the round. Can have multiple puzzles (boards) of increasing difficulty. |
| **Interaction** | Click-to-select or click-to-toggle. Student clicks cells/positions to place, remove, or change state. |
| **Scoring** | Binary solve state per puzzle (solved/not-solved). Stars based on number of puzzles solved or attempts needed. |
| **Feedback** | Per-action: constraint violation highlighted immediately (e.g., conflicting placement). On solve: `playDynamicFeedback('correct')` + celebration. Undo supported (click again to deselect). |
| **Screen state machine** | `start` -> `gameplay` -> (solve puzzle; if multiple puzzles: next puzzle) -> `results`. Optional `game_over` if lives are added. |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-024, PART-025, PART-027, PART-050 (if spec's flow has an explicit "Check" CTA — auto-detect-on-solve variants skip it) |
| **Rounds default** | 3 (3 puzzles of increasing difficulty) |
| **Lives default** | 0 |
| **Timer default** | 0 |

**Note:** PART-023 (progress bar) is optional -- some board puzzles show a puzzle counter instead of a round progress bar.

**Canonical examples:** queens-puzzle, math-cross-grid, expression-completer (when used as a grid)

---

### 7. Construction

Student builds something (expression, sequence, structure) from provided parts. Creative assembly with a correct target.

| Attribute | Value |
|-----------|-------|
| **Structure** | Rounds-based. Each round presents parts and a target to construct. |
| **Interaction** | Build-from-parts. Student drags parts into slots, or taps parts to add them to a construction area. Submit button to check. |
| **Scoring** | +1 per correctly constructed expression/sequence. Partial credit possible (e.g., 3/4 parts correct). Stars at 90%/66%/33%. |
| **Feedback** | On submit: `playDynamicFeedback('correct')` if construction matches target. `playDynamicFeedback('incorrect')` if not -- highlight which parts are wrong. Allow retry (clear and rebuild) or show correct answer. |
| **Screen state machine** | `start` -> `gameplay` -> (loop rounds) -> `results`. No `game_over`. |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027, PART-033 (drag interaction, if drag-based), PART-050 (FloatingButton — required for the Submit CTA) |
| **Rounds default** | 6 (2 per stage) |
| **Lives default** | 0 |
| **Timer default** | 0 |

**Canonical examples:** expression-completer, sequence-builder

---

### 8. Worked Example

Three-phase pedagogy: teacher demonstrates, then student fills blanks, then student solves independently. Not rounds-based -- phase-based.

| Attribute | Value |
|-----------|-------|
| **Structure** | Example -> Faded -> Practice phases. Phase 1 (Example): teacher shows full worked solution, student taps to advance steps. Phase 2 (Faded): same problem type but some steps are blank, student fills them. Phase 3 (Practice): student solves independently. |
| **Interaction** | Step reveal (phase 1: tap to see next step) + input (phase 2-3: fill blanks via MCQ or number input). |
| **Scoring** | Per-step scoring in phases 2-3. No scoring in phase 1 (observation only). Stars based on phase 2+3 accuracy. |
| **Feedback** | Phase 1: no feedback needed (demonstration). Phases 2-3: `playDynamicFeedback('correct')` / `playDynamicFeedback('incorrect')` per step. Show correct step if wrong. |
| **Screen state machine** | `start` -> `example_phase` -> `faded_phase` -> `practice_phase` -> `results`. No `game_over`. Phase transitions are explicit (not automatic). |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-024, PART-025, PART-027, PART-050 (whenever phase 2/3 uses number-input fill-blanks, OR any phase uses an explicit Next / Done / Submit CTA to advance — pure MCQ auto-advance variants skip it) |
| **Rounds default** | 0 (not rounds-based; 3 phases with 3-5 steps each) |
| **Lives default** | 0 |
| **Timer default** | 0 |

**Note:** PART-023 (progress bar) is typically replaced by a phase indicator (Phase 1/2/3) rather than a round counter.

**Canonical examples:** soh-cah-toa-worked-example

---

### 9. No-Penalty Explorer

Safe learning space. Wrong answers are noted but carry no consequence. Designed for early Bloom levels (L1-L2) where the goal is exposure and understanding, not assessment.

| Attribute | Value |
|-----------|-------|
| **Structure** | Rounds-based. Fixed N rounds, sequential. Identical structure to MCQ Quiz but with no-penalty scoring. |
| **Interaction** | MCQ (single select). Same as MCQ Quiz. |
| **Scoring** | Track correct/incorrect for data purposes but no lives lost, no game-over possible. Stars based on accuracy but framed as encouragement ("Great effort!" not "You failed"). |
| **Feedback** | `playDynamicFeedback('correct')` on right. On wrong: `playDynamicFeedback('incorrect')` + extended explanation of why the correct answer is correct. Emphasis on teaching, not penalizing. Show correct answer with reasoning. |
| **Screen state machine** | `start` -> `gameplay` -> (loop N rounds) -> `results`. No `game_over` screen (impossible -- no lives). |
| **PART flags** | PART-001, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027 |
| **Rounds default** | 9 (3 per stage) |
| **Lives default** | 0 (always -- this is definitional) |
| **Timer default** | 0 (always -- no time pressure in a learning space) |

**Canonical examples:** name-the-sides, geo-angle-id (no-penalty variant)

**Key difference from MCQ Quiz:** The scoring model is identical in data capture, but the UX framing is different. Results screen uses encouraging language. Wrong answers always include explanations. The Bloom level is L1-L2 (Remember/Understand), not L3 (Apply).

---

### 10. Tracking/Attention

Cognitive skill games. Student must track, count, or remember items under time pressure. Tests working memory and attention, not math knowledge per se.

| Attribute | Value |
|-----------|-------|
| **Structure** | Timed rounds. Fixed N rounds, each with a time limit. Items appear/move/change and student must track them. |
| **Interaction** | Click-to-select. Student clicks items that match a tracking criterion (e.g., "which items were red?", "how many dots appeared?"). Sometimes number input. |
| **Scoring** | Timed accuracy. +1 per correct identification. Speed bonus possible. Stars based on accuracy. |
| **Feedback** | `playDynamicFeedback('correct')` / `playDynamicFeedback('incorrect')`. Reveal correct answer (highlight what they should have tracked). |
| **Screen state machine** | `start` -> `gameplay` -> (loop rounds; each round: stimulus display phase -> response phase) -> `results`. |
| **PART flags** | PART-001, PART-004, PART-005, PART-006 (timer per round), PART-007, PART-008, PART-009, PART-010, PART-042, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027, PART-050 (whenever the response phase uses a number-input or an explicit Submit — click-to-select variants skip it) |
| **Rounds default** | 9 (3 per stage, increasing difficulty = more items to track) |
| **Lives default** | 0 |
| **Timer default** | Per-round timer, not global. Default 5-10 seconds per stimulus display, 15 seconds per response. |

**Canonical examples:** keep-track, total-in-flash

---

## Procedure

### Step 1: Extract signals from the game description

Read the game description or spec and extract:

1. **Structure signals:** Look for keywords: "rounds", "timer", "countdown", "lives", "hearts", "phases", "example then practice", "puzzle", "board", "grid", "endless", "no penalty", "safe space", "explore"
2. **Interaction signals:** Look for: "tap", "click", "drag", "sort", "match", "pair", "build", "construct", "type", "number input", "fill in", "select multiple", "flip"
3. **Scoring signals:** Look for: "lives", "hearts", "no penalty", "encouragement", "time bonus", "streak", "solve", "pairs"
4. **Bloom level signals:** L1-L2 (identify, name, recognize, understand, explain) -> No-Penalty Explorer or MCQ Quiz. L3+ (apply, calculate, solve, construct) -> Lives Challenge, Construction, or Board Puzzle.
5. **Pedagogical signals:** "worked example", "step by step", "demonstrate then practice", "faded" -> Worked Example.

### Step 2: Match to archetype

Use this decision tree:

```
Is it a worked example (phases: demo -> faded -> practice)?
  YES -> Worked Example (#8)

Is it a puzzle/board with no sequential rounds (solve-the-grid)?
  YES -> Board Puzzle (#6)

Is the student building/constructing an expression or sequence from parts?
  YES -> Construction (#7)

Is it a sort/classify task (drag items into categories)?
  YES -> Sort/Classify (#4)

Is it a memory/matching game (find pairs, flip cards)?
  YES -> Memory Match (#5)

Is it a tracking/attention task (count, remember, track moving items)?
  YES -> Tracking/Attention (#10)

Does it have a global countdown timer (answer before time runs out)?
  YES -> Speed Blitz (#2)

Does it have lives (wrong answers have consequences)?
  YES -> Lives Challenge (#3)

Is it explicitly no-penalty / Bloom L1-L2 / learning-focused?
  YES -> No-Penalty Explorer (#9)

Default -> MCQ Quiz (#1)
```

### Step 3: Validate the match

After matching, check:

1. Does the spec mention any attribute that CONTRADICTS the matched profile? (e.g., matched MCQ Quiz but spec says "3 lives")
2. Does the spec add features ON TOP of the profile? (e.g., matched Lives Challenge but spec also says "45 second timer")
3. If contradictions exist, re-run the decision tree with the contradicting attributes weighted higher.
4. If additions exist, note them in `notes` and add the required PART flags (e.g., add PART-006 for timer).

### Step 4: Emit the profile

Output the full profile with all attributes, including any spec-specific overrides in `notes`.

---

## Constraints

1. **CRITICAL — Every game MUST map to exactly one archetype.** If a game maps to zero, follow the custom-archetype procedure below. If it maps to multiple, follow the disambiguation procedure below.

2. **CRITICAL — PART flags are non-negotiable.** If a profile says PART-017 is required, the generated game MUST include FeedbackManager. Omitting a required PART flag is a build-breaking error.
   - *Negative example:* A Lives Challenge game is generated without PART-008 (postMessage). The game plays fine locally but `game_complete` is never sent to the host app, so the session is never recorded. This is a silent data-loss failure caught only in production.

3. **STANDARD — Defaults are overridable, not optional.** Every profile has defaults for rounds, lives, and timer. If the spec specifies different values, use the spec values. If the spec is silent, use the defaults. Never generate a game with unspecified values.

4. **CRITICAL — Screen state machines are exact.** The screens listed in a profile are the screens that must exist. Adding screens the profile does not define requires explicit justification. Missing a screen the profile requires is a build-breaking error.

5. **CRITICAL — Lives = 0 means no game_over screen.** If a profile has `lives: 0`, the game MUST NOT have a `game_over` screen. If the spec adds lives to a normally no-lives archetype, the `game_over` screen must be added.
   - *Negative example:* An MCQ Quiz (lives=0) is generated with a `game_over` screen. Tests fail because the harness expects `gameplay -> results` but hits an unreachable `game_over` phase. Build loops 5 iterations on a phantom screen.

6. **STANDARD — Timer = 0 means no PART-006.** Do not include the timer PART flag unless the archetype or spec explicitly requires a timer.

7. **ADVISORY — Archetype does not override the spec.** If the spec says 12 rounds and the archetype default is 9, use 12. The archetype provides defaults and structure; the spec provides intent.

8. **CRITICAL — PART-050 (FloatingButton) is flow-driven and OVERRIDES the per-archetype PART flag list.** If the spec's flow shows ANY explicit Submit / Check / Done / Commit CTA, PART-050 MUST be included — even if the archetype's PART-flags row does not list it, and even if the row lists it only conditionally. Flow > archetype row. Applies to every archetype, including MCQ-primary archetypes whose canonical variant auto-evaluates on tap (a customised MCQ Quiz or No-Penalty Explorer with a number-input round still needs PART-050). If the flow auto-evaluates on interaction only (MCQ tap, Memory Match pair reveal, Speed Blitz timer expiry with no Submit button), PART-050 does NOT apply — omit it. When in doubt, check the spec's core-mechanic description for the words "Submit" / "Check" / "Done" / "Commit" — presence of any of these strings triggers PART-050.
   - **Sub-rule — Next button at end-of-game.** Every FloatingButton-using game MUST wire the Next mode after `game_complete` + end TransitionScreen dismissal, posting `next_ended` from `on('next', ...)`. This is non-negotiable regardless of archetype — the harness needs the signal to tear down the iframe. See PART-050 "Next flow" section. Validator: `GEN-FLOATING-BUTTON-NEXT-MISSING` / `-NEXT-POSTMESSAGE`.
   - **Sub-rule — Try Again for standalone + lives.** When `totalRounds: 1` AND `totalLives > 1`, the plan MUST wire `on('retry', ...)` to implement the Try Again flow per PART-050. Multi-round games are unaffected (they use TransitionScreen retry buttons). Validator: `GEN-FLOATING-BUTTON-RETRY-STANDALONE` / `-RETRY-LIVES-RESET`.
   - *Negative example:* A Speed Blitz game with `totalRounds: 1` and a Submit button is generated using a hand-rolled `<button class="bb-submit">` because the archetype row omitted PART-050. FloatingButton never mounts, the button uses game-local styling instead of the CDN-enforced 48px touch target, and the mobile layout contract drifts. The per-archetype PART flags row is a default starting point; the spec's flow overrides it. (bodmas-blitz regeneration, 2026-04-22.)

---

## Defaults

When the game description or spec is silent on a decision, use these values:

| Decision | Default | Source |
|----------|---------|--------|
| Archetype | MCQ Quiz (#1) | Most common game type in the pipeline |
| Rounds | Per archetype (see profiles above) | Validated from shipped games |
| Lives | Per archetype (see profiles above) | 0 for learning, 3 for challenge |
| Timer | Per archetype (see profiles above) | 0 unless Speed Blitz or Tracking |
| Difficulty stages | 3 (easy / medium / hard) | Equal distribution across rounds |
| Stars thresholds | Per pedagogy.md Section 1 "Bloom-to-Game Mapping" table (varies by Bloom level) | Canonical source: pedagogy.md |
| Feedback delay | Per feedback.md "Timing" section (varies by archetype speed) | Canonical source: feedback.md |
| Bloom level | Per pedagogy.md Procedure Step 1 (default L2 Understand) | Canonical source: pedagogy.md |
| Scaffolding | Per pedagogy.md Section 4 "Scaffolding Patterns by Bloom Level" | Canonical source: pedagogy.md |

---

## Anti-patterns

### 1. Inventing a new archetype instead of using an existing one

If a game "feels different" but has rounds + MCQ + scoring, it is an MCQ Quiz with cosmetic differences. Do not create an 11th archetype. Use the closest match and document deviations in `notes`.

*Negative example:* A spec says "fraction pizza game where students tap slices." Agent creates a "Pizza Archetype" with custom screen flow. In reality this is an MCQ Quiz with a pizza visual theme -- rounds, tap-to-select, score at end. The custom archetype breaks downstream skills that only know the 10 standard profiles.

### 2. Mixing archetype defaults with spec values inconsistently

Either use all spec values or all defaults. Do not use the spec's round count but the archetype's lives count when the spec also specified lives. Read the full spec before emitting any defaults.

*Negative example:* Spec says "12 rounds, 5 lives." Agent emits `rounds: 12` (from spec) but `lives: 3` (from Lives Challenge default), ignoring the spec's explicit `5 lives`. The game ends too early because 2 lives are missing.

### 3. Omitting the game_over screen for lives-based games

Every archetype with `lives > 0` MUST have a `game_over` screen. This is the most common build failure for Lives Challenge games. Check the screen state machine against the lives value.

*Negative example:* A Lives Challenge game is generated with `lives: 3` but no `game_over` screen. When lives hit 0, `syncDOMState` sets `data-phase="game_over"` but no screen exists for it -- white screen. Test harness times out waiting for a visible element.

### 4. Adding PART-006 (timer) to non-timed archetypes without spec justification

Timer adds complexity (TimerComponent late-load bug, timer display, timer-expiry end condition). Never add it "just in case". Only add when the archetype requires it or the spec explicitly asks for it.

*Negative example:* An MCQ Quiz spec says nothing about time. Agent adds PART-006 "for engagement." TimerComponent loads asynchronously and races with game init -- 1 in 3 builds get a `TimerComponent is not defined` error at runtime because the CDN script hasn't loaded when `startTimer()` is called.

### 5. Using MCQ Quiz archetype for Bloom L1-L2 learning games

If the spec's Bloom level is L1-L2 and the language is exploratory ("learn", "discover", "understand", "identify"), use No-Penalty Explorer (#9), not MCQ Quiz (#1). The UX framing difference (encouraging vs neutral) matters for learning outcomes.

*Negative example:* Spec says "Help Class 4 students identify types of triangles" (Bloom L1 Remember). Agent picks MCQ Quiz. The results screen shows "2/9 correct" with no explanation -- discouraging for a learning activity. No-Penalty Explorer would show encouraging language and explanations after each wrong answer.

### 6. Treating Board Puzzle like a rounds-based game

Board Puzzle has no round progression in the traditional sense. The board IS the game. Do not generate `currentRound++` logic or round transition screens. If there are multiple puzzles, treat each as a separate board, not as a "round".

*Negative example:* A queens-puzzle game is generated with `currentRound++` after each queen placement. The progress bar shows "Round 1 of 8" (one per queen). The game advances to "Round 2" after placing the first queen, clearing the board. The puzzle is unsolvable because state resets each "round."

### 7. Skipping the validation step (Step 3)

Every match must be validated against the spec. The decision tree gives the most likely match, not the guaranteed match. A spec that says "drag items into categories with 3 lives" is a Sort/Classify with lives added, not a Lives Challenge with drag.

---

## Custom Archetype Procedure (no match)

When the decision tree produces no clear match:

1. **Flag as custom.** Set `confidence: CUSTOM` in the output.
2. **Identify the closest archetype.** Which profile shares the most attributes with the spec? Use that as the starting point.
3. **Document every deviation.** List each attribute where the spec differs from the closest profile.
4. **Build the screen state machine from scratch.** Do not assume the closest profile's screens are correct. Derive screens from the spec's described flow.
5. **Derive PART flags from first principles.** Walk the PART flag list and check each: does this game need this capability? Do not copy the closest profile's flags blindly.
6. **Add a warning to the output.** Downstream skills must know this is a custom archetype so they apply extra validation.

---

## Disambiguation Procedure (multiple matches)

When the decision tree could match two or more archetypes:

### Priority rules (apply in order):

1. **Interaction type breaks ties.** If the game uses drag-and-drop, it is Sort/Classify or Construction, not MCQ Quiz -- even if it also has rounds and scoring.

2. **Structure breaks ties.** Phases (example/faded/practice) = Worked Example, always. Puzzle/board = Board Puzzle, always. These structural patterns are more specific than interaction or scoring.

3. **Bloom level breaks ties between MCQ Quiz and No-Penalty Explorer.** L1-L2 = No-Penalty Explorer. L3+ = MCQ Quiz (or Lives Challenge if lives are present).

4. **Timer presence breaks ties between MCQ Quiz and Speed Blitz.** Global countdown timer = Speed Blitz. No timer = MCQ Quiz.

5. **Lives presence breaks ties between MCQ Quiz and Lives Challenge.** Lives > 0 = Lives Challenge. Lives = 0 = MCQ Quiz.

6. **When truly ambiguous, prefer the simpler archetype.** MCQ Quiz (#1) is simpler than Lives Challenge (#3). Simpler archetypes have fewer failure modes in generation.

### Common ambiguities:

| Ambiguity | Resolution |
|-----------|------------|
| MCQ Quiz vs No-Penalty Explorer | Check Bloom level. L1-L2 or "learning/explore" language = Explorer. L3+ or "test/assess/quiz" = MCQ Quiz. |
| MCQ Quiz vs Speed Blitz | Check for global timer. Timer = Speed Blitz. No timer = MCQ Quiz. |
| MCQ Quiz vs Lives Challenge | Check for lives. Lives mentioned = Lives Challenge. No mention = MCQ Quiz. |
| Lives Challenge vs Speed Blitz | Check primary constraint. Timer is primary = Speed Blitz (even with lives). Lives are primary = Lives Challenge (even with per-round timers). |
| Sort/Classify vs Construction | Sort = items exist, student categorizes them. Construction = student builds something new from parts. |
| Board Puzzle vs Construction | Board = manipulate a fixed grid. Construction = assemble from parts into slots. |
| Memory Match vs Tracking/Attention | Memory Match = find pairs (two items match). Tracking = count or remember stimuli (no pairing). |
