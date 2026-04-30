# Skill: Game Planning

## Purpose

Transform a game spec into 5 structured plan documents (game-flow, screens, round-flow, feedback, scoring) that are precise enough for game-building.md to produce a working HTML game without guessing.

## When to use

After spec is approved, before game-building. Produces the 5 plan docs the build step reads.

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When game-building can reliably produce correct HTML directly from a spec without intermediate plan documents.

## Reads

- `skills/game-archetypes.md` -- archetype profile determines the structural skeleton (incl. constraint #8 which mandates PART-050 whenever the flow has a Submit CTA) -- **ALWAYS**
- `alfred/parts/PART-050.md` -- FloatingButton planning requirements: slot wiring, visibility predicate, submit handler shape, opt-out policy -- **WHEN the spec describes a Submit / Check / Done CTA**
- `alfred/parts/PART-051.md` -- AnswerComponent planning: end-game stack ordering (Stars Collected celebration plays first, hands off to AnswerComponent via `onMounted` setTimeout; single-stage Next exit), per-round answer payload shape, CREATOR-ONLY opt-out policy -- **UNLESS spec declares `answerComponent: false` (creator-only flag — no LLM step may auto-default; planning treats `answerComponent: true` as non-negotiable when the flag is absent)**
- `skills/feedback/SKILL.md` -- 17 behavioral cases, await/fire-and-forget rules, priority table, FeedbackManager API -- **ALWAYS**
- `skills/pedagogy.md` -- Bloom level determines feedback depth and scaffolding -- **ALWAYS**
- `skills/mobile.md` -- viewport constraints for screen layouts -- **ON-DEMAND** (only for screens.md wireframes)
- `skills/data-contract/` -- recordAttempt and game_complete schemas -- **ON-DEMAND** (only for scoring.md data contract fields)
- `reference/default-flow.md` -- canonical multi-round flow diagram (Shape 2) -- **ALWAYS**
- `reference/shapes.md` -- Shape 1 Standalone, Shape 2 Multi-round, Shape 3 Sectioned -- **ALWAYS**
- `reference/flow-gallery.md` -- 16 customization patterns to apply as ADDITIVE deltas on top of the canonical diagram -- **ON-DEMAND** (only when the spec's `## Flow` lists a customization trigger)
- `reference/default-transition-screens.md` -- canonical Elements tables for the 4 standard transition screens (game_over, motivation, victory, stars_collected); copy verbatim into screens.md unless the spec explicitly overrides a field -- **ALWAYS**

## Input

- A complete `spec.md` for the game (from spec-creation.md or manually authored)
- The archetype profile (from game-archetypes.md Step 1-4)

## Output

A directory `pre-generation/` containing 5 markdown files:

```
pre-generation/
  game-flow.md     -- one-liner, flow diagram, stage breakdown
  screens.md       -- ASCII wireframe for EVERY screen with element positions
  round-flow.md    -- step-by-step walkthrough of each round type
  feedback.md      -- table of every feedback moment with FeedbackManager calls
  scoring.md       -- exact formula, star thresholds, lives rules, progress bar
```

Each file is self-contained: game-building.md can read any single file and get complete, unambiguous instructions for that aspect.

## Reference Files

| File | Contents |
|------|----------|
| [plan-formats.md](reference/plan-formats.md) | Exact output format for all 5 plan docs with field-by-field schemas |
| [cross-validation.md](reference/cross-validation.md) | Step 7 cross-validation checks, good vs bad plan examples |

## Procedure

### Step 1: Identify the archetype

Read the spec. Run game-archetypes.md decision tree (Steps 1-4) to identify the archetype and emit the full profile. This determines: screen state machine, default rounds/lives/timer, PART flags, interaction model. Note every spec override of archetype defaults.

### Step 2: Derive game-flow.md

1. Read the spec's `## Flow` section for shape hints (or infer: no rounds → Shape 1; sections/levels → Shape 3; else Shape 2 default).
2. Copy the canonical diagram VERBATIM: from `reference/default-flow.md` for Shape 2; from `reference/shapes.md` for Shape 1 or Shape 3.
3. Apply customization deltas only if the spec's `## Flow` listed changes. Match each trigger against `reference/flow-gallery.md` rows 4–16. Apply as ADDITIVE edits (insert step, add conditional branch, rewrite one label) — never rewrite the whole diagram.
4. Write `pre-generation/game-flow.md` with: the one-liner, the final ASCII diagram (canonical + deltas), `**Shape:** [...]`, `**Changes from default:** [...]`, and the stage table.

DO NOT hand-invent flow diagrams. DO NOT start from the archetype's minimal screen state machine — that's too skeletal.

### Step 2b: CRITICAL — FloatingButton (PART-050) planning

**Applies to every spec whose core mechanic or flow describes a Submit / Check / Done / Commit CTA**, regardless of archetype or number of rounds.

If the spec mentions a Submit button, you MUST plan the game to use `FloatingButtonComponent` (PART-050) — NOT an inline `<button>` under the input. Read [alfred/parts/PART-050.md](../../parts/PART-050.md) for the full API.

**The plan's screens.md, round-flow.md, and scoring.md MUST reflect this.** The Submit button lives in the fixed-bottom floating slot, not inline in `#gameContent`. ScreenLayout is planned with `slots.floatingButton: true`. The round-flow.md describes visibility via `floatingBtn.setSubmittable(isSubmittable())` wired to input-change handlers, and the submit handler registered via `floatingBtn.on('submit', async () => {...})`.

**FAILED REASONING PATTERNS — do NOT use any of these to justify omitting PART-050 from the plan.** Each one has been used by prior planning runs to produce plans that fail step-5 validation:

- ❌ *"No retry / next-round / submit-mode swap — in-form Submit is sufficient."* WRONG. PART-050 handles submit-only flows. `setMode('retry')` and `setMode('next')` are optional; the component works perfectly with `setMode('submit')` only. Standalone (`totalRounds: 1`) games still use PART-050.
- ❌ *"Archetype flags list PART-050 but the game's interaction is a simple in-form button."* WRONG. The per-archetype PART-flags row is a default starting point. The spec's flow (presence of a Submit CTA) OVERRIDES it per game-archetypes constraint #8. If the spec mentions Submit, PART-050 is mandatory.
- ❌ *"We pass `slots: { floatingButton: false }` because the Submit is inline."* WRONG. The slot flag exists to place the component; skipping the slot forces an inline button which the validator rejects (`GEN-FLOATING-BUTTON-MISSING`).
- ❌ *"PART-050 is 'OMITTED as default' because no mode-swap CTA."* WRONG — this is the exact reasoning that produced the bodmas-blitz regression (2026-04-23). Do not write this in any plan.
- ❌ *"Sticky-bottom Submit is only a variant for keyboard-coverage mitigation."* WRONG. The fixed-bottom placement IS the canonical Submit pattern; "inline under the input" is not a supported variant when a Submit CTA exists.

**The only valid reason to omit PART-050 from the plan** is when the spec declares `floatingButton: false` (PART-039-style opt-out — the spec author deliberately chose the PART-022 inline-button pattern for this game). The plan author (step 3) MUST NOT add a `floatingButton: false` line to `spec.md` — the spec is owned by step 1 + human review. If the spec describes a Submit CTA and does NOT have `floatingButton: false`, the plan MUST include PART-050.

What to write in each plan doc:
- **screens.md**: Every gameplay screen that accepts a Submit CTA shows a fixed-bottom floating Submit button (not inside `#gameContent`). Reference `.mathai-fb-btn-primary` as the test selector.
- **round-flow.md**: List the input-change handlers that call `floatingBtn.setSubmittable(isSubmittable())`; register `floatingBtn.on('submit', ...)`; describe how the handler transitions to `setMode('retry')` / `setMode('next')` / `setMode(null)` per the spec's feedback matrix.
- **scoring.md / feedback.md**: Cite `floatingBtn.on('submit')` as the evaluation entry point.

### Step 2c: CRITICAL — Next button planning (every FloatingButton-using game)

**Every game that uses FloatingButton MUST plan for the Next button at game end.** This is non-negotiable — the host harness relies on a `next_ended` postMessage to know the player has finished viewing results and the iframe can be torn down / advanced.

**Next is the LAST thing the player sees.** Its purpose is iframe-teardown. If Next appears during feedback audio or alongside the stars/results card, the player can tap it and destroy the iframe mid-audio. The plan MUST describe the exact sequence that guarantees Next is only visible AFTER feedback completes.

**The sequence differs by shape. Pick the correct one from the spec's `Rounds` value.**

### Standalone variant — `totalRounds: 1` (Shape 1)

Standalone games have NO TransitionScreen. The inline feedback panel in `#gameContent` (worked-example, result, stars) is the end-of-game display. TransitionScreen is architecturally redundant — there's nothing to transition between. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks any TransitionScreen usage in standalone games.

Four-step sequence:

1. `await FeedbackManager.play(correct ? 'correct' : 'incorrect')` — full audio + sticker, awaited.
2. Render the inline feedback panel in `#gameContent` (worked-example, stars if correct, final message).
3. Post `{ type: 'game_complete', data: { metrics: ... } }`.
4. `floatingBtn.setMode('next')` — Next appears directly on the same game screen, beneath the feedback panel.

The plan for standalone MUST:
- Declare `transitionScreen: false` in `ScreenLayout.inject()` slots (omit the key).
- NOT reference `new TransitionScreenComponent(...)` or `transitionScreen.show(...)`.
- Document the inline feedback panel's exact DOM structure in screens.md.
- In round-flow.md, document the 4-step sequence above.

### Multi-round variant — `totalRounds > 1` (Shape 2 / Shape 3)

Multi-round games use TransitionScreen for the victory / game_over screen because the per-round feedback has already been cleared when the final round ends.

> **AnswerComponent override (PART-051) — applies UNLESS spec declares `answerComponent: false`.** When AnswerComponent is in use (default), the legacy 5-step chain below DOES NOT APPLY. Use the chain in Step 2e instead. The legacy chain remains authoritative ONLY for games that opt out of AnswerComponent.

Legacy 5-step sequence (`answerComponent: false` only):

1. `await FeedbackManager.play(...)` — full feedback audio sequence, awaited.
2. Post `game_complete` with metrics.
3. `transitionScreen.show({ content: resultsHtml, buttons: [] })` — stars / message card, **`buttons: []`** (empty array — tap-dismissible only, NO Next button inside the card).
4. `transitionScreen.onDismiss(() => { transitionScreen.hide(); floatingBtn.setMode('next'); });` — `setMode('next')` lives ONLY inside this callback.
5. User taps Next → `on('next')` handler posts `{ type: 'next_ended' }` + `floatingBtn.destroy()`.

The plan for multi-round MUST include this sequence in screens.md (victory + game_over screens show Next as the floating CTA ONLY after the transition dismisses) and in round-flow.md (end-of-game handler chains the five steps above, with `await` on feedback and `onDismiss` wrapping the `setMode('next')`).

**CRITICAL — the Next click handler is registered as `floatingBtn.on('next', ...)`, NOT `floatingBtn.on('submit', ...)`.** The component dispatches primary-button clicks to `this._handlers[this._mode]` — after `setMode('next')`, only the `'next'` handler fires. A common mis-pattern (seen in bodmas-blitz 2026-04-23) is to write:
```js
floatingBtn.setMode('next');
floatingBtn.on('submit', () => postMessage({type:'next_ended'}));  // WRONG — submit handler never fires in 'next' mode
```
The correct plan snippet is:
```js
floatingBtn.setMode('next');
floatingBtn.on('next', () => { postMessage({type:'next_ended'}); floatingBtn.destroy(); });
```
If the plan's pseudocode shows `on('submit')` after a `setMode('next')`, that is a bug. Always `on('next')` for the Next click, `on('retry')` for the Try Again click, `on('submit')` for the Submit click.

**FAILED REASONING PATTERNS — banned (do NOT write any of these in the plan):**

- ❌ *"Victory screen has a Play Again button, so Next is redundant."* WRONG. Play Again is a different semantic (restart the game); Next signals "done, advance past end". Both may coexist but the Next floating button is MANDATORY.
- ❌ *"Standalone single-question game, no need for a Next screen."* WRONG. Standalone games end too. They still need the harness signal.
- ❌ *"Pass `{type: 'game_complete'}` and skip `next_ended` — the host can infer from `game_complete`."* WRONG. The two messages are distinct signals (metrics vs navigation). The harness needs both.
- ❌ *"Fire `next_ended` inside the submit handler alongside `game_complete`."* WRONG. `next_ended` fires in response to the user clicking Next AFTER viewing results. Not simultaneously with `game_complete`.
- ❌ *"Call `setMode('next')` inside `endGame()` right after `postGameComplete(...)`."* WRONG. This makes Next appear during feedback audio. The bodmas-blitz regeneration (2026-04-23) produced exactly this bug — validator `GEN-FLOATING-BUTTON-NEXT-TIMING` now catches it. `setMode('next')` MUST be inside `transitionScreen.onDismiss(...)` or in a callback that runs after `await FeedbackManager.play(...)` AND after the results TransitionScreen has been dismissed.
- ❌ *"Fire-and-forget the end-of-game feedback so the screen transitions quickly."* WRONG. End-of-game feedback MUST be awaited so the TransitionScreen + Next button appear only AFTER audio completes. Fire-and-forget at round boundaries is for mid-game, not for the final round.
- ❌ *"Put a 'Next' / 'Continue' / 'Done' button inside the victory TransitionScreen's `buttons:` array."* WRONG. This produces a confusing double-Next UX: the player sees Next on the card, taps it, and sees ANOTHER Next appear at the bottom from the FloatingButton. Victory / game_over TransitionScreens MUST use `buttons: []` and rely on tap-to-dismiss. The Next CTA is the FloatingButton's role; the TransitionScreen is content-only. Validator `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` catches this. (bodmas-blitz regression, 2026-04-23.)
- ❌ *"Standalone game should still show a victory TransitionScreen card before Next."* WRONG. Standalone games (`totalRounds: 1`) MUST NOT use TransitionScreen at all — the inline feedback panel in `#gameContent` is the end-of-game display. Feedback → game_complete → setMode('next') directly. No card, no onDismiss callback. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks any TransitionScreen usage in standalone. (bodmas-blitz 2026-04-23 — sub-agent kept TransitionScreen for the victory/game_over display even though Shape 1 doesn't need it.)

### Step 2d: CRITICAL — Try Again planning (standalone + `totalLives > 1` only)

**Applies when `spec.Rounds === 1` AND `spec.Lives > 1`.** Multi-round games use TransitionScreen retry buttons (unchanged — not covered by this step).

If applicable, the plan MUST describe:

1. **On wrong submit with lives remaining:** decrement `gameState.lives`, push attempt with `is_retry: (retryCount > 0)`, await feedback, then `floatingBtn.setMode('retry')` (label: "Try again"). If lives hit 0, `endGame(false)` → feeds into Next flow.
2. **On Try Again tap:** clear input if `spec.retryPreservesInput !== true`; re-enable input (`gameState.isProcessing = false`); `floatingBtn.setMode(null)` so the predicate takes over.
3. **Preserved state:** `gameState.attempts`, `gameState.score`, `gameState.retryCount`, AND the already-decremented `gameState.lives`. The retry handler MUST NOT reset lives.
4. **Reset state:** `gameState.isProcessing = false`; input value (unless `retryPreservesInput: true`); any inline wrong-answer feedback UI.

The round-flow.md must document the `retryCount` mechanic and the `is_retry` attempt flag. The scoring.md must confirm that retries do not multiply score (each attempt counts independently in the `attempts` array).

### Step 2e: CRITICAL — AnswerComponent planning (PART-051)

**Applies to every game UNLESS the spec declares `answerComponent: false`.** The AnswerComponent renders a `Correct Answers!` carousel after the player has finished playing. One slide per evaluated answer (one per round in multi-round, N slides for a standalone question with N answers, 1 slide with disabled nav for a standalone with one answer). It is the last in-game card before the terminal yay / star-collected TransitionScreen.

The plan MUST resolve four design decisions and document them in `pre-generation/`:

1. **Per-round answer payload shape.** What does each round carry to render the answer view? Examples: a grid game stores the solved cell-state (`answer: [[0,0,1,0],...]`); a drag-drop game stores the correct mapping (`answer: { 'zone-A': 'tile-3', 'zone-B': 'tile-1' }`); an MCQ game with a worked-example slide stores `answer: { correct: 2, explanation: '...' }`. Document the exact JSON shape in spec.md's content-schema section AND under round-flow.md's "answer slide" entry.
2. **Render-only-the-evaluated-elements rule.** Decide what part of the play-area DOM the slide reproduces. Drag-drop → drop-zones in solved state, NOT the draggable bank. Grid → the solved grid. MCQ → the question text + the correct option highlighted (no other options as tap-targets). Document this in screens.md as the "Answer Panel" wireframe — one ASCII sketch per round type.
3. **Slide builder placement.** Plan a `buildAnswerSlidesForAllRounds()` (multi-round) or `buildAnswerSlides()` (standalone) function in round-flow.md that returns `[{ render(container) { ... } }, ...]`. Each `render` must be self-contained and use only `gameState` / round data — no DOM references that may have been destroyed by feedback rendering.
4. **End-game chain (REQUIRED — supersedes Step 2c's multi-round 5-step chain).**

**New end-game chain (multi-round, with Victory + Stars Collected):**

The celebration beat plays FIRST. AnswerComponent appears AFTER. Single-stage Next exits.

1. `await FeedbackManager.play(...)` — final-round feedback, awaited.
2. Post `game_complete` with metrics.
3. `endGame()` routes to `showVictory()` (when intermediate Victory transition exists) OR `showStarsCollected()` (when no intermediate Victory).
4. **Victory transition (optional):** `transitionScreen.show({ title: 'Victory', stars, buttons: [{ text: 'Claim Stars', action: showStarsCollected }], persist: true })`. The Claim Stars button's action calls `showStarsCollected()` directly. **NEVER call `answerComponent.show(...)` from this action — it skips the celebration.**
5. **Stars Collected transition (celebration backdrop):** `transitionScreen.show({ title: 'Yay! Stars collected!', stars, buttons: [], persist: true, onMounted })`. The `onMounted` callback plays the yay sound, fires the `show_star` animation, and via `setTimeout` (typically ~1500 ms) calls `showAnswerCarousel()`. **The Stars Collected TS does NOT call `transitionScreen.hide()` in `onMounted`** — per [default-transition-screens.md](reference/default-transition-screens.md), it is the terminal celebration surface and stays mounted as the backdrop while AnswerComponent + Next appear over it. Both tear down together on the single-stage Next click.
6. **Answer carousel reveal:** `showAnswerCarousel()` calls `answerComponent.show({ slides })` then `floatingBtn.setMode('next')`. This is the **only place** `answerComponent.show(...)` is called in a multi-round game.
7. **Single-stage Next exit:** `floatingBtn.on('next', () => { answerComponent.destroy(); postMessage({ type: 'next_ended' }); previewScreen.destroy(); floatingBtn.destroy(); })`.

**New 5-step end-game chain (standalone, no TransitionScreen):**

1. `await FeedbackManager.play(correct ? 'correct' : 'incorrect')`.
2. Render the inline feedback panel in `#gameContent` (worked-example, stars, final message).
3. Post `game_complete`.
4. `answerComponent.show({ slides: buildAnswerSlides() })` — 1 slide if single answer (nav auto-disabled), N slides if multiple.
5. `floatingBtn.setMode('next')` → user taps Next → `on('next')` handler calls `answerComponent.destroy()`, posts `next_ended`, destroys the floating button.

**FAILED REASONING PATTERNS — banned (do NOT write any of these in the plan):**

- ❌ *"Show the AnswerComponent inside `endGame()` for multi-round games so it lines up with the result."* WRONG. The Stars Collected celebration plays FIRST. Calling `answerComponent.show(...)` from `endGame()` (or from a Victory `Claim Stars` action that skips Stars Collected) steals the celebration moment AND forces a two-stage Next handler. Validator `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` rejects this.
- ❌ *"Use a two-stage Next handler — first tap dismisses the answer card and shows Stars Collected, second tap exits."* WRONG. By the time Next is visible the player has already seen Victory + Stars Collected + AnswerComponent. The Next handler must be a single-stage exit (destroy + post `next_ended` + destroy preview + destroy floating). Validator `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE` rejects two-stage handlers (anything that branches on a `gameState.starsCollectedShown`-style flag and calls a celebration screen on the first click).
- ❌ *"Reveal the AnswerComponent during the round so players can compare their answer with the correct one immediately."* WRONG. The component is end-of-game only. Per-round feedback uses the existing PART-017 inline patterns. Validator `GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW` + the `.show-after-feedback` rule reject mid-round reveals.
- ❌ *"Encode each slide as an HTML string (`{ html: '<div>...</div>' }`) so the spec can ship the rendered card directly."* WRONG. Slides MUST be `{ render(container) {...} }` callbacks. Validator `GEN-ANSWER-COMPONENT-SLIDE-SHAPE` rejects `html` and `element` keys. The component intentionally has one shape so behaviour is predictable across games.
- ❌ *"Skip AnswerComponent for this game — it's an exploration game with no correct answer."* This is a valid reason to opt out, but the spec MUST declare `answerComponent: false` AND that opt-out must come from the human creator's explicit prompt (quoted in the spec) — NOT from any LLM step's judgment. **Spec-creation (step 1) MUST NOT auto-default `false`** (see spec-creation/SKILL.md "answerComponent exception"). **Spec-review (step 2) FAILs any spec with `answerComponent: false` lacking quoted creator opt-out** (see spec-review/SKILL.md H5). **Build (step 4) MUST NOT mutate spec.md** to silence the validator. The spec is the human creator's contract; no LLM at any step gets to opt out on their behalf.
- ❌ *"Put the Victory transition's `Claim Stars` action straight to `showAnswerCarousel()` to skip the redundant Stars Collected screen."* WRONG. Stars Collected is the celebration beat that owns the yay sound + `show_star` animation. Skipping it loses the reward feedback. Victory's Claim Stars action MUST call `showStarsCollected()`, not the answer-reveal function.

**screens.md MUST include the Answer Panel wireframe** (one per round type) showing only the evaluated elements. **round-flow.md MUST include the end-game step that calls `answerComponent.show(...)`** with the slide-builder function name and the slide payload shape.

**FAILED REASONING PATTERNS — banned:**

- ❌ *"No Try Again needed — Retry is only for multi-round."* WRONG. Multi-round uses TransitionScreen retry; standalone uses FloatingButton `setMode('retry')`. Different mechanisms, both valid.
- ❌ *"On retry, call `restartGame()` to reset state."* WRONG. `restartGame()` resets attempts / score / lives — defeats the whole point. Try Again is not a restart; it's "re-enable the single question with existing state preserved, one life already consumed."
- ❌ *"Just call `setMode('retry')` in the submit handler — the component will handle the rest."* WRONG. FloatingButton provides the mode + handler; the game MUST decrement lives + record the attempt + manage input value before flipping mode, and the retry handler MUST re-enable input.

### Step 3: Derive screens.md

**`screens.md` is the enumeration + content contract for game-building.** Every screen listed here becomes a required render target; every button listed here becomes a required `transitionScreen.show` button. Game-building MUST NOT omit a listed screen, MUST NOT add a button that isn't listed, MUST NOT relabel a listed button. Short-lived motivation / celebration transitions (e.g. "Ready to improve your score?", "Yay, stars collected!") are NOT optional — enumerate them.

For EVERY screen in the flow diagram:
1. Start with the archetype's screen state machine as the skeleton.
2. Read the spec for UI elements mentioned per screen.
3. Draw an ASCII wireframe showing element positions (375x667 mobile viewport). **Persistent fixtures** (preview header at top, progress bar below header on Shape 2/3) appear on EVERY non-Preview wireframe.
4. List every element with position, content, and interactivity. For buttons, record the exact visible label — this string is what game-building must emit.
5. Define entry and exit conditions.
6. For gameplay screen: define the round presentation sequence (preview, instructions, media, gameplay reveal).
7. **For the 4 standard transition screens (`game_over`, `motivation`, `victory`, `stars_collected`):** copy the canonical Elements table from `reference/default-transition-screens.md` verbatim. Override a row ONLY when the spec's `## Flow` or content section explicitly specifies different copy (e.g. Victory's subtitle is always game-specific). Do NOT invent alternative titles/buttons/stickers.

7d. **Sound ids in plan.md MUST come from canonical table.** Every sound id referenced in `plan.md` (Feedback Moment Table, screens.md Screen Audio table, end-game beats, round-flow.md feedback steps) MUST be either (a) a canonical id from `alfred/skills/feedback/reference/feedbackmanager-api.md` § Standard Audio URLs, OR (b) a custom id declared in `spec.creatorSounds`. The planner does NOT invent ids — `bubble_pop_sfx` / `tap_select_sfx` / `correct_chime_sfx` / etc. that look right but aren't canonical are forbidden. When the spec/creator describes a sound that doesn't have an obvious canonical match, ASK via the planner's clarifying question loop ("Did the creator mean `sound_bubble_select` from canonical? Or do they have a custom URL?") — never guess. Validator: `GEN-SOUND-ID-CANONICAL`.

8. **Resolve the Screen Audio table.** game-planning OWNS the per-game TS audio table (see `reference/plan-formats.md` § Screen Audio). For each prescribed TS for the game's shape (read the "Game shape" table in `reference/default-transition-screens.md`), produce one row in the `## Screen Audio` table at the top of `screens.md` with:
    - `sfxId` and `sticker` from the per-screen tables in `default-transition-screens.md`.
    - `ttsText` resolved as follows, in priority order:
      1. If `spec.creatorScreenAudio.<screen>.silent: true` → emit `(silent — creator opt-out)` and set `source: silent`.
      2. Else if `spec.creatorScreenAudio.<screen>.audioText` is non-empty → emit that string verbatim, `source: creator`.
      3. Else if the screen is `starsCollected` → emit `(silent — canon exception)`, `source: silent`. (Stars Collected is silent by canon regardless of `creatorScreenAudio`.)
      4. Else → emit the canonical template from `default-transition-screens.md` § Default narration strings, `source: default`. Interpolation tokens (`${n}`, `${score}`, `${gameTitle}`, etc.) stay literal in the table — the build agent resolves them at runtime.
    The build agent reads ONLY the resolved Screen Audio table; it does NOT consult `default-transition-screens.md` or `spec.creatorScreenAudio` directly. This is the single contract surface for TS audio.

**ActionBar header — end-of-game-only.** The platform header (`#previewQuestionLabel` + `#previewScore` + `#previewStar`) is a fixed persistent fixture on every non-Preview wireframe, but it does NOT update mid-game. Stars in the ActionBar represent overall game performance, awarded once via `show_star` at end. Wireframes MUST NOT propose a "running ActionBar score" widget that updates per correct round; MUST NOT propose a custom ActionBar label format like `'L1'` / `'Round 1'` / `'Stage N'` (the format is fixed at `'Q' + N`). Game-internal running counters (fast-tap meters, point tallies, level indicators) belong inside `#gameContent` — render them as a custom status row INSIDE the gameplay area, never in the platform header.

### Step 4: Derive round-flow.md

For each distinct round type:
1. Walk through the round from the student's perspective.
2. Branch at the answer: correct path and wrong path.
3. Specify every state change, CSS class, FeedbackManager call, and timing value.
4. End with transition to next round (or results/game_over).
5. Include a state-change table mapping steps to gameState mutations and DOM updates.

### Step 5: Derive feedback.md

1. Look up the spec's Bloom level (default L2).
2. Fill in subtitle templates from the Bloom level.
3. Write 3 concrete subtitle examples per feedback type using actual math content.
4. List applicable animations (remove heartBreak if no lives).
5. Document wrong-answer handling depth (misconception-specific or generic).
6. Add emotional arc notes.

### Step 6: Derive scoring.md

1. Copy scoring model from archetype profile.
2. Override with spec-specific scoring.
3. Calculate star thresholds (default 90%/66%/33%).
4. Document lives system if applicable.
5. Define progress bar behavior.
6. Map scoring values to data-contract fields.

### Step 7: Cross-validate

See [cross-validation.md](reference/cross-validation.md) for the full checklist. Every screen in game-flow.md must have a wireframe in screens.md. Every feedback moment must correspond to a step in round-flow.md. Scoring formula must match state changes.

## Constraints

1. **STANDARD -- No code in plans.** Zero JavaScript, CSS declarations, or HTML tags. Only exception: FeedbackManager call signatures and CSS class names.
2. **CRITICAL -- Every screen gets a wireframe.** If game-flow.md lists 4 screens, screens.md has 4 wireframes.
3. **CRITICAL -- Every feedback moment has a FeedbackManager call.** No "show a message" -- must be `FeedbackManager.sound.play(id, {sticker})` for SFX or `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` for VO. See `skills/feedback/SKILL.md` for the 17 behavioral cases.
4. **CRITICAL -- Plans must be buildable without the spec.** No ambiguities requiring spec lookup.
5. **STANDARD -- Archetype defaults are explicit.** Write "9 rounds", never "per archetype default."
6. **CRITICAL -- No invented features.** Implement the spec, not a wish list.
7. **CRITICAL -- Round presentation sequence is mandatory.** screens.md must document preview-instructions-media-reveal for each round type. The "Instructions" phase is NOT an on-screen text block — the how-to-play copy is owned by PreviewScreenComponent (`previewInstruction` + `previewAudioText`) and shown once before Round 1. Gameplay screens MUST NOT duplicate that instruction text. A per-round *prompt* ("Which tile matches?") is fine only when semantically distinct from the preview instruction; use Round-N intro transitions to convey round-type changes.
8. **STANDARD -- All timing values are exact.** Millisecond values only, never "after a brief pause."

## Defaults

| Decision | Default | Source |
|----------|---------|--------|
| Number of plan docs | 5 | This skill |
| Stage count | 3 (easy / medium / hard) | game-archetypes.md |
| Rounds per stage | Equal distribution | game-archetypes.md |
| Bloom level | L2 (Understand) | pedagogy.md |
| Star thresholds | 90% / 66% / 33% | game-archetypes.md |
| Feedback timing | 1500ms correct, 2000ms wrong | feedback/ |
| Round presentation | preview + gameplay reveal (NO instruction text panel on any gameplay screen — preview owns the how-to-play copy; use Round-N intro transitions for type changes) | feedback/ |
| Progress bar | Tracks round number, bottom of gameplay screen | game-archetypes.md |
| Wireframe viewport | 375x667 (mobile portrait) | mobile.md |
