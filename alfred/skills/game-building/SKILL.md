# Skill: Game Building

## Purpose

Transform a game spec + pre-generation plan + archetype profile into a single self-contained HTML file that is a playable, tested, platform-compliant math game for Indian Class 5-10 students on budget Android phones.

## When to use

When generating HTML from an approved spec + plan. The main generation step.

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When game generation moves to a template engine that does not use LLM-based HTML generation.

## Reads

- [skills/game-archetypes/SKILL.md](../game-archetypes/SKILL.md) -- archetype profile (structure, interaction, scoring, screens, PART flags, defaults) -- **ALWAYS**
- [skills/data-contract/SKILL.md](../data-contract/SKILL.md) -- gameState schema, recordAttempt schema, game_complete postMessage schema, syncDOM contract, trackEvent schema, handlePostMessage/game_ready protocol, validation rules -- **ALWAYS**
- [skills/mobile/SKILL.md](../mobile/SKILL.md) -- viewport, touch targets, typography, safe areas, keyboard, orientation, gestures, performance, cross-browser, CSS variables -- **ALWAYS**
- [skills/feedback/SKILL.md](../feedback/SKILL.md) -- behavioral feedback cases, await/fire-and-forget rules, priority table, FeedbackManager API ([reference/feedbackmanager-api.md](../feedback/reference/feedbackmanager-api.md) for CDN URLs and code), timing ([reference/timing-and-blocking.md](../feedback/reference/timing-and-blocking.md)) -- **ALWAYS**
- [skills/interaction/SKILL.md](../interaction/SKILL.md) -- canonical interaction patterns, event handling, touch specifics, state machines, guards, undo, hit detection ([reference/patterns/](../interaction/reference/patterns/) for full code, [reference/touch-events.md](../interaction/reference/touch-events.md) for pointer events, [reference/state-and-guards.md](../interaction/reference/state-and-guards.md) for state management) -- **ALWAYS**
- [skills/game-planning/reference/shapes.md](../game-planning/reference/shapes.md) -- canonical source: shape definitions, decision matrix, creator-only flags -- **ALWAYS**
- [reference/flow-implementation.md](reference/flow-implementation.md) -- screen→component mapping + progress bar lifecycle + round loop pattern -- **ALWAYS**
- [alfred/skills/game-planning/reference/multi-round-flow.md](../game-planning/reference/multi-round-flow.md) -- canonical Shape 2 (Multi-round) flow diagram -- **ALWAYS**
- [alfred/skills/game-planning/reference/standalone-flow.md](../game-planning/reference/standalone-flow.md) -- canonical Shape 1 (Standalone) flow diagram -- **ALWAYS**
- [alfred/parts/README.md](../../parts/README.md) -- canonical PART catalog (every PART, name, purpose, mandatory/conditional flag). Use it to confirm which PARTs the spec/plan/archetype mandates before opening specific PART files. -- **ALWAYS**
- [alfred/parts/PART-050.md](../../parts/PART-050.md) -- CDN FloatingButtonComponent API (submit/retry/next lifecycle, submittable-predicate contract) -- **WHEN the game flow has a Submit CTA**
- [alfred/parts/PART-051.md](../../parts/PART-051.md) -- CDN AnswerComponentComponent API (post-feedback Correct Answers carousel, end-game stack, slide render-callback contract) -- **UNLESS spec declares `answerComponent: false`. NOTE: that flag is a CREATOR-ONLY opt-out — step 4 (Build) MUST NOT add it to spec.md to silence the validator, and the spec author at step 1 MUST NOT auto-default it. If a spec arrives at build with `answerComponent: false` lacking quoted creator opt-out language, the build is on a malformed spec and should be flagged, not patched.**

## Input

1. **Spec** (`spec.md`) -- game description, rounds schema, misconception taxonomy, Bloom level, scoring rules, screen descriptions, content set structure
2. **Pre-generation plan** (`pre-generation/`) -- screen flow, round presentation sequence, interaction breakdown, state management plan, archetype confirmation
3. **Archetype profile** -- looked up from `game-archetypes.md` based on the plan's archetype field

## Output

A single file: `index.html` — this is the ONLY file this skill writes.

- Self-contained: all CSS and JS inline (no external files except CDN scripts)
- Under 500KB total file size
- Passes `validate-static.js` (all GEN-* rules)
- Passes Playwright test suite (all 5 categories: game-flow, mechanics, level-progression, edge-cases, contract)

**CRITICAL — spec.md and plan.md are READ-ONLY during this step.** They were authored in step 1 (Draft Spec) and step 3 (Plan) and went through human review. The build step (step 4) MUST NOT modify `spec.md`, `plan.md`, or any file under `games/<id>/` other than `index.html`. If a validator rule is blocking the build, FIX the HTML — do not edit the spec to silence the rule. Writing `floatingButton: false` into spec.md during a build to silence `GEN-FLOATING-BUTTON-*` rules is a scope violation and a trust breach: spec flags are per-game design decisions that belong to the spec author, NOT to the build-time code generator. The user reviews spec changes via `git diff` and will revert any build-originated mutation.

---

## Regeneration modes — fresh vs edit (MANDATORY read)

Step 4 runs in one of two modes. Pick the right one before starting; picking wrong silently produces an out-of-date HTML.

### Fresh mode (REQUIRED when any skill / PART document you read has changed since the last generation of this game)

1. Delete the existing `games/<gameId>/index.html` (the sub-agent cannot reason about "what changed" from a diff; it only reads what's in front of it).
2. Generate the HTML from scratch off the current skill docs. Every MANDATORY block in flow-implementation.md / code-patterns.md / PART files gets emitted, because there is no existing code for the sub-agent to "preserve".
3. Run Step 5 (`node alfred/scripts/validate-static.js`). All GEN-* rules green.

**Use fresh mode whenever:**
- A new MANDATORY rule / checklist item was added to this SKILL.md or any reference doc.
- A new validator rule (GEN-*) was added that the existing HTML does not satisfy.
- A component's CDN API changed in a way that requires new call-sites (e.g. PART-040 added `setScore` / `setQuestionLabel` / `show_star.data.score`).
- The spec itself changed non-trivially (new rounds, new mechanic, new screens).

### Edit mode (only for targeted one-line fixes where the doc set has NOT changed)

1. Keep the existing HTML.
2. Make surgical changes based on the specific instruction (e.g. "rename this button label", "increase timer from 30 to 45").
3. Run Step 5. All GEN-* rules green.

**Use edit mode only when:**
- Creator is fixing a specific local issue (typo, value tweak, one-function bugfix).
- No doc updates are in flight — the sub-agent would otherwise preserve soon-to-be-incorrect code.

**Signal to the sub-agent:** the invoking prompt should say either "FRESH: delete and regenerate from scratch" or "EDIT: surgical change, leave the rest alone". If ambiguous, default to **FRESH** — edit mode skipping a MANDATORY new rule is a silent failure that only the validator (and only if a new GEN-* rule covers it) catches.

## Procedure

### Step 1: Read and Internalize

1. Read the **spec** completely. Extract: gameId, title, Bloom level, totalRounds, totalLives, timer, interaction type, round schema, misconception taxonomy, scoring rules, feedback overrides.
2. Read the **pre-generation plan**. Extract: archetype, screen flow, round presentation sequence, state management notes, any deviations from archetype defaults.
3. Look up the **archetype profile** from `game-archetypes.md`. Note the structure, interaction, scoring, feedback, screen state machine, PART flags, and defaults.
4. Identify any **spec overrides** of archetype defaults (e.g., different round count, added timer, custom star thresholds).

### Step 2: Build the HTML Shell

Write the document structure following [html-template.md](html-template.md). This covers the DOCTYPE, head, CDN scripts, CSS sections, body, and `#app` element with initial data attributes.

### Step 3: Build the JavaScript

Implement the flow code inline per [flow-implementation.md](reference/flow-implementation.md) — it provides the screen→component mapping, progress bar lifecycle, and round loop pattern derived from `pre-generation/game-flow.md` and `alfred/skills/game-planning/reference/multi-round-flow.md`.

Follow the exact function order from [code-patterns.md](reference/code-patterns.md) for everything else. All 24 code sections must be implemented with the exact signatures and behaviors documented there. Key sections: gameState, syncDOM, handlePostMessage, recordAttempt, trackEvent, endGame, FeedbackManager integration (preload, sound.play, playDynamicFeedback), getRounds, getStars, startGame, resetGame, answer handler, init sequence.

### Step 4: Write the Fallback Content

The `fallbackContent.rounds` array is the game's offline dataset. For multi-round games **it is round-set-cycled** — meaning a student playing Set A on first attempt, Set B on Try Again, Set C on next Try Again, then back to A. The runtime `getRounds()` helper groups by `set` key and `restartGame()` rotates `gameState.setIndex` on each restart. The fallback dataset MUST seed all three sets so the cycle has content.

**Standalone games (`totalRounds: 1`) are exempt from round-set cycling.** A single-round game ships a single `rounds` array with no `set` key (and `rounds.length === 1`). The validator skips `GEN-ROUNDSETS-MIN-3` entirely when `totalRounds === 1`. The rest of this Step 4 applies only to multi-round games.

**MANDATORY for multi-round games — round-set structure (validator rule `GEN-ROUNDSETS-MIN-3` blocks build-time; skipped for `totalRounds: 1`):**

- **`rounds.length === totalRounds × 3` (or more)** — NOT `totalRounds`. Three sets × `totalRounds` rounds per set = the array length.
- **Every round has a `set: 'A' | 'B' | 'C'` key** — mixed tagged/untagged rounds fail the validator.
- **At least 3 distinct `set` values** present: `"A"`, `"B"`, `"C"`. Each set contains exactly `totalRounds` rounds with the same round schema.
- **Round `id` values globally unique across sets** — use prefix convention `"A_r1_…"`, `"B_r1_…"`, `"C_r1_…"`. The prefix lets `question_id` analytics segment by set without schema change. Duplicating an `id` across sets fails the validator.
- **Parallel difficulty progression across sets** — Set A's Round 1 ≈ Set B's Round 1 ≈ Set C's Round 1 in difficulty. A student cycling through sets on retry experiences comparable learning load each session.

**Other round-content rules (apply to every round in every set):**

- Follow the exact round schema from the spec.
- Include every field the answer handler and recordAttempt read (id, answer, options, difficulty, misconception tags, feedbackCorrect, feedbackWrong, etc.).
- Progress in difficulty WITHIN a set (easy → medium → hard, or per spec stages).
- Stable `id` fields for cross-session comparison.

**Skeleton:**

```javascript
var fallbackContent = {
  totalRounds: 10,        // rounds per session (per set)
  totalLives: 3,
  rounds: [
    // Set A — 10 rounds
    { set: 'A', id: 'A_r1_…', round: 1, /* …spec schema… */ },
    { set: 'A', id: 'A_r2_…', round: 2, /* … */ },
    // … 8 more …
    // Set B — 10 rounds (parallel difficulty to Set A)
    { set: 'B', id: 'B_r1_…', round: 1, /* … */ },
    // … 9 more …
    // Set C — 10 rounds (parallel difficulty to Set A)
    { set: 'C', id: 'C_r1_…', round: 1, /* … */ },
    // … 9 more …
  ]
};
```

Total array length here = `10 × 3 = 30`. Same `round` numbers (1..10) appear three times, distinguished by the `set` key.

### Step 5: Implement the Answer Handler

The answer handler is the core game loop. See the full pattern in [code-patterns.md](code-patterns.md) Section 17. It must follow the exact sequence: guard -> evaluate -> recordAttempt -> trackEvent -> update state -> syncDOM -> visual feedback -> FeedbackManager.sound.play (awaited for single-step + multi-step round-complete, fire-and-forget for multi-step partial-match only) -> awaited playDynamicFeedback for content-specific explanation (validator: GEN-FEEDBACK-TTS-AWAIT) -> animations -> auto-advance. See `skills/feedback/SKILL.md` Cases 4-8 for exact behavior per answer type.

### Step 6: Implement Keyboard Handling (Input-Based Games)

If the game uses text/number input instead of MCQ, see the keyboard handling pattern in [code-patterns.md](code-patterns.md) Section 18.

### Step 7: Write the CSS

Follow the complete CSS reference in [css-reference.md](css-reference.md). This covers `--mathai-*` variables, mobile viewport/layout, touch targets, gesture suppression, landscape lock overlay, micro-animations, wrong-answer visual feedback, and disabled states.

### Step 8: Self-Validate

Before outputting, verify against every check:

**Static validation (GEN-* rules):**
- [ ] GEN-PM-001: `game_complete` postMessage uses exact type string
- [ ] GEN-PM-DUAL-PATH: `game_complete` fires on both victory AND game-over paths
- [ ] GEN-PM-READY: `game_ready` postMessage exists
- [ ] GEN-PM-NO-SELF-INIT: the game NEVER sends a `game_init` postMessage (`game_init` is inbound only — host → game). Self-posting it is caught by the game's own listener and boots `setupGame()` on fallbackContent, skipping the wait for the host's real content. Seed the standalone ActionBar header via component defaults, not a re-posted `game_init`.
- [ ] GEN-BOOT-WAIT-FOR-INIT: `setupGame()` is NOT called inline in the boot path. After registering the message listener and sending `game_ready`, WAIT. `setupGame()` is reached ONLY via `handlePostMessage` (host `game_init`) or the standalone `setTimeout` fallback (gated on `window.self === window.top`). See html-template.md step 16 + rule 11.
- [ ] GEN-PHASE-INIT: `#app` initial `data-phase` matches `gameState.phase` init
- [ ] GEN-PHASE-SEQUENCE: endGame sets phase BEFORE syncDOM
- [ ] GEN-PHASE-MCQ: At least 3 syncDOM calls exist
- [ ] GEN-DATA-LIVES-SYNC: syncDOM writes `data-lives` (lives games)
- [ ] GEN-SYNCDOMSTATE-ALLATTRS: syncDOM writes `data-round` and `data-score`
- [ ] GEN-SHOWRESULTS-SYNC: showResults calls syncDOM after phase assignment
- [ ] GEN-RESTART-RESET: resetGame resets phase, currentRound, score, attempts, events
- [ ] GEN-ROUNDSETS-MIN-3 (skipped for standalone `totalRounds: 1`): `fallbackContent.rounds` contains rounds for ≥ 3 distinct `set` values (`'A'`, `'B'`, `'C'`); each set has exactly `totalRounds` rounds; every round has a `set` key (no mixed mode); all `id` values globally unique across sets. `rounds.length === totalRounds × 3` (or more) — NOT `totalRounds`. `gameState.setIndex: 0` field present. `getRounds()` filters by current set. `restartGame()` rotates `setIndex` BEFORE `resetGameState()` (rotation is NOT in the reset list). See SKILL.md Step 4 for the full pattern.
- [ ] GEN-CORRECT-ANSWER-EXPOSURE: `gameState.correctAnswer` set each round
- [ ] GEN-FLOATING-BUTTON-CDN: When spec has a Submit CTA, the FloatingButton CDN script (or the bundle `components/index.js`) is included and `new FloatingButtonComponent(...)` is instantiated in DOMContentLoaded
- [ ] GEN-FLOATING-BUTTON-SLOT: `ScreenLayout.inject(...)` passes `slots.floatingButton: true` whenever `FloatingButtonComponent` is used
- [ ] **`autoSubmit` consumer** ([PART-050 § Top-level spec flag — `autoSubmit`](../../parts/PART-050.md#top-level-spec-flag--autosubmit), spec-review H7). Default `false` = manual Submit + Retry buttons (the rules below apply normally). When `spec.autoSubmit: true`: emit NO `floatingBtn.setSubmittable(...)` call from input/drop/timer handlers AND emit NO `on('retry', ...)` handler. The game's internal commit handler (timer `onEnd`, drag-drop drop callback, canvas commit) calls `endGame(correct)` directly (Standalone) or advances rounds directly (Multi-round). `FloatingButtonComponent` is STILL instantiated, the slot stays declared, and the `on('next', ...)` handler is STILL wired — `autoSubmit: true` hides only Submit and Retry, never Next. When `autoSubmit: true`, the three Submit/Retry rules (`GEN-FLOATING-BUTTON-PREDICATE`, `GEN-FLOATING-BUTTON-SUBMIT-DEFAULT`, `GEN-FLOATING-BUTTON-RETRY-STANDALONE`) auto-skip; all other `GEN-FLOATING-BUTTON-*` rules stay active. The build step MUST NOT add `autoSubmit: true` to `spec.md` to silence rules — same trust model as `floatingButton: false` / `previewScreen: false` / `answerComponent: false`.
- [ ] GEN-FLOATING-BUTTON-PREDICATE: At least one input / state-change handler calls `floatingBtn.setSubmittable(...)` so the button's visibility tracks the input state instead of staying permanently visible after first show. (Auto-skipped when `spec.autoSubmit: true` — see § `autoSubmit` consumer.)
- [ ] GEN-FLOATING-BUTTON-SUBMIT-DEFAULT: Submit starts hidden in every game. The Submittable predicate (a) gates on REAL input — `setSubmittable(true)` literal and predicates like `length >= 0` / `length >= -1` / `length !== -1` are forbidden; use `length >= 1` / `length === N` / `trim().length > 0`; (b) ANDs an Interaction signal so pre-filled inputs do not show Submit on first paint — track `gameState.hasInteracted` (or `userInteracted` / `touched` / `dirty`), set it to `true` in your input/click/drop handlers BEFORE calling `setSubmittable`, and AND it into `isSubmittable()`; (c) honours `spec.partialSubmitAllowed` — when `false`, the predicate requires fully-attempted state (`every(cell => cell.filled)` / `=== N`) instead of `>= 1`. Empty submits are prevented by hiding the button, never by costing a life. ([PART-050 § Mandatory rules § 2-3](../../parts/PART-050.md#mandatory-rules), [PART-050 § Cases — Submit visibility](../../parts/PART-050.md#cases--submit-visibility))
- [ ] **Predicate emission (`partialSubmitAllowed` consumer).** When emitting `isSubmittable()` for a Standalone game, branch on `spec.partialSubmitAllowed` (default `true`):
  - `true`: predicate gates on `gameState.hasInteracted && gameState.userInput.length >= 1` (or equivalent value-valid check).
  - `false`: predicate gates on `gameState.hasInteracted && allCellsFilled(gameState)` / `gameState.userInput.length === EXPECTED_N` / `gameState.cells.every(c => c.value !== '')` — fully-attempted state required. Submit hidden during partial input.
  Multi-round games consume the same flag for non-last and last rounds (Submit visibility table is shape-symmetric).
- [ ] GEN-FLOATING-BUTTON-RETRY-NO-SUBMITTABLE: The `on('retry', ...)` handler must NOT call `setSubmittable(...)`. Its only mode action is `setMode(null)`; the predicate fires from the player's NEXT input/drag/tap. When `retryPreservesInput: true`, calling `setSubmittable(isSubmittable())` inside the retry handler immediately re-shows Submit and lets the player tap-tap through Try Again → Submit unchanged. (PART-050 "Try Again flow")
- [ ] 5e0-FLOATING-BUTTON-DUP: No custom `<button>` anywhere in source whose **id / class / data-testid / aria-label / inner text** contains `submit / commit / retry / next / check / done / cta` when FloatingButton is used. Renaming id/class while keeping a telltale `data-testid` or inner text "Submit" still fires the rule — delete the button entirely.
- [ ] End-of-game sequencing differs by shape. **Standalone (`totalRounds: 1`)**: PART-050 5-step orchestrator inside a single `endGame()` — SFX awaited → `game_complete` SYNC (NO body-card render) → **TTS awaited** → `show_star` + `answerComponent.show({slides})` → `setTimeout(setMode('next' or 'retry'), 1100)`. The submit handler is one line: `await endGame(correct);`. **End-state UI = AnswerComponent + FloatingButton + header `show_star` only — NO inline body-card** ("Puzzle solved!" / "Try again!" / sticker-title-subtitle into `#gameContent` is FORBIDDEN: it duplicates AnswerComponent and visually mimics a Victory/Game-Over TransitionScreen that standalone games can't render). Validators: `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` (no `transitionScreen.show()`), `GEN-STANDALONE-END-PANEL-FORBIDDEN` (no `gameContent.innerHTML = '<...>'` inside endGame / onCorrect / onWrong). Do NOT split into `runFeedbackSequence` / `finalizeAfterDwell` — splitting fires `game_complete` + Next after only SFX while TTS still plays. **Multi-round (`totalRounds > 1`)**: round-N submit handler awaits SFX **AND** awaits dynamic TTS before advancing — same as every other round (validator: `GEN-FEEDBACK-TTS-AWAIT`). End-of-game audio is owned by Stars Collected `onMounted` (awaits `sound_stars_collected` → fires `show_star` → setTimeout → `setMode('next')`). Validator: `GEN-ENDGAME-AFTER-TTS` fires only on standalone games that define `function runFeedbackSequence` / `function finalizeAfterDwell`.

- [ ] **Spec-vs-build mismatch on standalone games.** If the spec mentions a TransitionScreen anywhere (`Welcome TS`, `Game Over TransitionScreen`, etc.) AND the game is standalone (`totalRounds: 1`), the build MUST IGNORE the spec's TransitionScreen and emit the canonical AnswerComponent + FloatingButton end-flow per `code-patterns.md § Canonical Standalone end-flow`. Do NOT translate the TS into an inline body-card (`gameContent.innerHTML = '<div class="...-screen-title">Puzzle solved!</div>...'`). Do NOT call `transitionScreen.show()` (validator blocks it). The spec-vs-build drift will surface at Step 9 human review (or earlier at Step 2 spec-review check Z8). Build's job is to emit canon, not to silently translate spec drift.

- [ ] **Audio→side-effect ordering (strict source order).** Inside any feedback-emitting scope (submit handler, `endGame`, TS `onMounted`), advance side-effects (`setMode('next' / 'retry')`, `nextRound`, `endGame`, `showStarsCollected`, `answerComponent.show`, `transitionScreen.hide`, destroys, `show_star` postMessage) MUST appear in source AFTER the awaited `playDynamicFeedback` line. Only `postGameComplete()` may appear between the awaited SFX (Step 1) and the awaited TTS (Step 3) — that's the canonical Step 2 slot. Placing any other side-effect in Step 2 (between SFX-await and TTS-await) means it executes while TTS is still streaming — visual jank (AnswerComponent slides in mid-narration). Validator: `GEN-FEEDBACK-ORDER`. See PART-050 5-step orchestrator + code-patterns.md § Canonical Standalone end-flow / § Canonical correct/wrong submit handler. Sub-rule: `setMode` deferred via `setTimeout(function(){ setMode(...); }, 1100)` is Step 5 — count the `setTimeout` call site, not the inner `setMode`.
- [ ] **ActionBar stars-immutable contract.** Stars in the ActionBar represent overall game performance, NOT a running counter of correct answers, levels cleared, or in-game points. The header has exactly two sanctioned write paths:
  - **`game_init.data.score`** (string `'X/Y'` or `{ x, y }` object) — sets the initial baseline `x/y`. The denominator `y` is locked for the session. Default `'0/3'`.
  - **`show_star.data.count`** — increments the numerator `x` by `count` after the 1 s animation. Clamped at `y`.
  Games MUST NOT call `previewScreen.setScore(...)` or `previewScreen.setQuestionLabel(...)` — these methods are not part of the public API. Games MUST NOT mutate `#previewScore` / `#previewStar` / `#previewQuestionLabel` directly via `getElementById` / `querySelector` / `textContent` / `innerHTML`. Validators: `GEN-ACTIONBAR-STARS-IMMUTABLE`, `GEN-QUESTION-LABEL-IMMUTABLE`, `GEN-QUESTION-LABEL-FORMAT`, `5e0-DOM-BOUNDARY`.
- [ ] **Question label format.** Platform action-bar label is fixed at `'Q' + N` (e.g., `'Q1'`, `'Q2'`). Game-internal vocabulary like "Level N", "Round N", "Stage N" goes in `#gameContent`, never in the platform header. Validator: `GEN-QUESTION-LABEL-FORMAT`.
- [ ] `show_star` fires EXACTLY ONCE per game session, at the end-of-game celebration step — NEVER inside a per-round correct handler. The numerator increments automatically by `count`. Firing `show_star` on each correct answer stacks the flying-star animation N times in a multi-round game. Validator: `GEN-SHOW-STAR-ONCE`.
- [ ] GEN-SHOW-STAR-REQUIRED: Every PreviewScreen + FloatingButton game MUST fire at least one `show_star` postMessage with a numeric `count`. Without it the ActionBar numerator never advances and the player never earns stars. Default location: end-of-game celebration step (standalone: inside endGame after all feedback audio; multi-round: inside victory / stars-collected TransitionScreen onMounted). Seed the denominator via `game_init.data.score = { x: 0, y: maxStars }` in your fallbackContent / host payload.
- [ ] **TS audio comes from `pre-generation/screens.md` § Screen Audio table** (game-planning resolves it). For every prescribed TS, the `onMounted` body MUST chain `await safePlaySound(<sfxId>, { sticker: <sticker> })` followed by `try { await FeedbackManager.playDynamicFeedback({ audio_content: <ttsText>, subtitle: <ttsText>, sticker: <sticker> }); } catch (e) {}` — both awaited, in order, per feedback/SKILL.md CASE 1/2/11/12. The `<ttsText>` is inlined verbatim from the Screen Audio table (interpolation tokens like `${n}`, `${score}` are resolved at runtime to `gameState.currentRound`, `gameState.score`, etc.). When the Screen Audio table marks a screen as `silent`, emit SFX only — skip the `playDynamicFeedback` call. Stars Collected is silent by canon. The build agent MUST NOT consult `default-transition-screens.md` or `spec.creatorScreenAudio` directly for TS audio — those are upstream sources merged into `screens.md` by game-planning. Validators: `GEN-TS-TTS-MISSING` (every prescribed TS `onMounted` plays both SFX and TTS unless silent) and `GEN-TS-AUDIO-AWAITED` (both calls awaited).
- [ ] GEN-FLOATING-BUTTON-MISSING: No hand-rolled Submit / Check / Done / Commit `<button>` when `FloatingButtonComponent` is NOT instantiated. Narrative reasons in HTML comments or plan notes ("submit-only flow doesn't need retry/next", "standalone totalRounds:1", "inline button inside the form") do NOT silence this rule. PART-050 handles submit-only flows. The ONLY valid opt-out is `floatingButton: false` in `spec.md` (mirrors PART-039 `previewScreen: false`) — a spec-author decision reviewed at step 2. The build step MUST NOT add `floatingButton: false` to `spec.md` to silence the rule; any spec mutation during build shows up in `git diff` and is a scope violation. If the spec genuinely has no Submit CTA (no Submit/Check/Done mentioned in core mechanic), do NOT emit the button at all. The archetype PART-flag row is a default; the spec's flow overrides it (game-archetypes constraint #8)
- [ ] GEN-ANSWER-COMPONENT-INSTANTIATE / GEN-ANSWER-COMPONENT-CDN / GEN-ANSWER-COMPONENT-SLOT (PART-051): Unless the spec declares `answerComponent: false`, every game MUST `new AnswerComponentComponent({ slotId: 'mathai-answer-slot' })` at DOMContentLoaded, declare `slots.answerComponent: true` in `ScreenLayout.inject(...)`, and include either `answer-component/index.js` or the `components/index.js` bundle script tag.
- [ ] GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK (PART-051): `answerComponent.show({ slides })` MUST be called AFTER `await FeedbackManager.play(...)` for the final round. Calling it earlier reveals the answer before the player has finished hearing the verdict.
- [ ] GEN-ANSWER-COMPONENT-AFTER-CELEBRATION (PART-051): For multi-round games that use TransitionScreen, `answerComponent.show(...)` MUST NOT appear inside `endGame()` (and MUST NOT appear in a Victory `Claim Stars` action that skips Stars Collected). It must be reached only through the Stars Collected `onMounted` setTimeout that calls a `showAnswerCarousel()`-style function. The Stars Collected TS stays mounted (no `transitionScreen.hide()` in `onMounted` — per default-transition-screens.md, Stars Collected is a celebration backdrop). The celebration step (yay sound + `show_star` animation) plays FIRST, then the answer card appears over it.
- [ ] GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE (PART-051): `floatingBtn.on('next', ...)` is a single-stage exit — destroy AnswerComponent, post `next_ended`, destroy floating button (and preview if applicable). NO `if (!firstClick)` two-stage branching that calls a celebration screen on the first click. By the time Next is visible, the player has already seen Victory + Stars Collected + AnswerComponent.
- [ ] GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW / GEN-ANSWER-COMPONENT-DESTROY / GEN-ANSWER-COMPONENT-SLIDE-SHAPE (PART-051): `.show(...)` is never called inside a preview-state branch; `.destroy()` is wired in the `next` handler (and in `restartGame()` if applicable); every slide entry uses the `render(container)` callback shape only — no `html` / `element` keys.

**Mobile checklist (from mobile.md):**
- [ ] Viewport meta tag present with `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- [ ] `max-width: var(--mathai-game-max-width)` on `#app` (480px)
- [ ] Uses `100dvh`, never bare `100vh`
- [ ] `overflow-x: hidden` on `html`, `body`
- [ ] All buttons 44x44px minimum
- [ ] 8px minimum spacing between touch targets
- [ ] Interactive elements in lower 60% of screen
- [ ] `var(--mathai-font-family)` on body
- [ ] No font below 14px; inputs 16px+
- [ ] Line height 1.4+ on text blocks
- [ ] All colors use `--mathai-*` variables
- [ ] `env(safe-area-inset-*)` padding on outer container
- [ ] `inputmode="numeric"` with `type="text"` for number inputs
- [ ] `visualViewport` resize listener (input games)
- [ ] Enter key triggers submit (input games)
- [ ] Landscape overlay present
- [ ] `overscroll-behavior: none` on `html` and `body`
- [ ] `touch-action: manipulation` on all interactive elements
- [ ] When `previewScreen: true`, do NOT author per-game `height` / `overflow` rules for `html` / `body` / `.page-center` / `#mathai-preview-slot` / `.mathai-preview-body` — the components bundle owns scroll selection (inner on touch, document on desktop)
- [ ] `-webkit-touch-callout: none` on game wrapper
- [ ] HTML under 500KB
- [ ] No continuous CSS animations during gameplay
- [ ] No flexbox `gap` (use margins)
- [ ] No optional chaining (`?.`) or nullish coalescing (`??`)
- [ ] Every `-webkit-` has standard fallback
- [ ] Inputs have `-webkit-appearance: none; appearance: none`
- [ ] Total DOM under 500 elements (render one round at a time)

**Feedback checklist (per `skills/feedback/SKILL.md`):**
- [ ] FeedbackManager CDN script tag: `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`
- [ ] `FeedbackManager.init()` in DOMContentLoaded
- [ ] `FeedbackManager.sound.preload([...])` with exact SFX URLs from `feedback/reference/feedbackmanager-api.md` § Standard Audio URLs. Every `{id, url}` pair MUST match the canonical table verbatim — copying a URL from a previous preload row when adding a new id is forbidden. Inventing an id (e.g. `bubble_pop_sfx`) and pairing it with an unrelated URL means the call site plays the wrong audio at runtime. When a game needs a sound NOT in the canonical table, the spec MUST declare it in `creatorSounds` with the creator-supplied URL (see spec-creation/SKILL.md). Validator: `GEN-SOUND-ID-CANONICAL`.
- [ ] `canPlayAudio()` polling on first transition screen (200ms interval, 15s timeout)
- [ ] Correct answer: `await FeedbackManager.sound.play('correct_sound_effect', {sticker})` — awaited, blocks input
- [ ] Wrong answer: `await FeedbackManager.sound.play('incorrect_sound_effect', {sticker})` — awaited, blocks input
- [ ] Last-life wrong: wrong SFX **skipped**, go straight to game-over
- [ ] Multi-step correct match: `FeedbackManager.sound.play(...).catch(...)` — fire-and-forget, no blocking
- [ ] Victory/game-over: screen renders FIRST, `game_complete` postMessage BEFORE audio, then SFX→VO sequentially
- [ ] All VO via `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` — never hardcode VO URLs
- [ ] CTA taps call `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()`
- [ ] Visibility hidden: `FeedbackManager.sound.pause()` + `FeedbackManager.stream.pauseAll()`
- [ ] Visibility restored: `FeedbackManager.sound.resume()` + `FeedbackManager.stream.resumeAll()`
- [ ] `gameState.isProcessing = true` BEFORE awaited feedback, `false` AFTER audio resolves
- [ ] Every FeedbackManager call wrapped in try/catch — audio failure never blocks gameplay
- [ ] Sticker GIF URLs from `feedback/reference/feedbackmanager-api.md` Standard Sticker GIFs table
- [ ] Subtitles under 60 characters, Bloom-level-appropriate
- [ ] No custom overlays (FeedbackManager owns overlays)
- [ ] No `new Audio()` — all audio through FeedbackManager

### Step 9: Output

Write the complete `index.html` file. No placeholder comments. No TODO markers. Every function fully implemented. Every fallback round fully populated with real math content matching the spec.

### Step 10: State-machine integrity report (MANDATORY for flag-conditional games)

For any spec flag that materially changes the FloatingButton / Preview / AnswerComponent / commit state machine, the build report MUST include a phase-by-phase enumeration table that the sub-agent fills in BEFORE handing back. The table forces the sub-agent to write down (and therefore notice) any contradiction between the spec flag and the code emitted.

Trigger flags (run the report for every flag whose value is the non-default form):

| Flag | Default | Triggers state-machine report when |
|---|---|---|
| `autoSubmit` | `false` | `true` |
| `floatingButton` | `true` | `false` |
| `previewScreen` | `true` | `false` |
| `answerComponent` | `true` | `false` |
| `roundMountNarration` | `false` | `true` |

Required table shape for each triggered flag:

```
### State-machine compliance report — `<flag>: <non-default-value>`

| Call site (file:line) | Phase | API call | Resulting mode | Compliant? |
|---|---|---|---|---|
| index.html:NNN | gameplay-input | floatingBtn.setSubmittable(...) | submit | ❌ violates GEN-AUTOSUBMIT-NO-SUBMITTABLE |
| index.html:NNN | endGame beat 5 | floatingBtn.setMode('next') | next | ✓ |
| ... | ... | ... | ... | ... |
```

The sub-agent enumerates EVERY `setMode` / `setSubmittable` / `show()` / `hide()` call site, names the phase it fires in, and confirms compliance with the flag's contract. If any row is non-compliant the sub-agent fixes the HTML and re-runs the table BEFORE submitting Step 4 output. The report sits in the Step 4 hand-off to Step 5.

---

## Constraints

### From data-contract.md

1. **CRITICAL** -- Every field marked Required in data-contract.md MUST be present. Omitting a required field is a contract violation.
2. **CRITICAL** -- All timestamps are epoch milliseconds (`Date.now()`), never ISO strings, never seconds.
3. **CRITICAL** -- `accuracy` in `game_complete` is integer 0-100, not decimal 0.0-1.0.
4. **CRITICAL** -- `round_number` in recordAttempt is 1-indexed. `currentRound` in gameState is 0-indexed.
5. **CRITICAL** -- `gameState` MUST be assigned to `window.gameState` -- test harness reads it directly.
6. **CRITICAL** -- `syncDOM` MUST target `#app` -- test harness reads `#app[data-phase]`. Never use `document.body`.
7. **CRITICAL** -- `gameState.phase = 'playing'` must be the VERY FIRST LINE in the `game_init` handler.
8. **CRITICAL** -- `game_ready` MUST follow the canonical boot order: `await waitForPackages()` → `new XComponent(...)` ×N → `addEventListener('message', …)` → `postMessage({type:'game_ready'},'*')` → `setupGame()`. See [PART-008 § Boot ordering](../../parts/PART-008.md#boot-ordering).
9. **CRITICAL** -- `game_complete` MUST fire on BOTH victory and game-over paths.
10. **CRITICAL** -- `completedAt` is a sibling of `metrics` inside `data`, not nested inside `metrics`.
11. **ADVISORY** -- Games may add extra fields (forward compatibility). Required fields must never be omitted.
12. **STANDARD** -- `question_id` must be stable across sessions for the same question content.
13. **STANDARD** -- `misconception_tag` values come from the spec's misconception taxonomy.

### From mobile.md

1. **CRITICAL** -- Viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` -- exactly this.
2. **STANDARD** -- `max-width: var(--mathai-game-max-width)` (480px) on the game container.
3. **CRITICAL** -- Use `100dvh`, never bare `100vh` (with `@supports` fallback).
4. **STANDARD** -- `overflow-x: hidden` on `html`, `body`.
5. **CRITICAL** -- All touch targets minimum 44x44px.
6. **STANDARD** -- Minimum 8px spacing between adjacent targets.
7. **ADVISORY** -- Interactive elements in bottom 60% of screen (thumb zone).
8. **STANDARD** -- Font family via `var(--mathai-font-family)`, never bare custom fonts.
9. **CRITICAL** -- No font below 14px anywhere; inputs 16px+ (prevents Safari auto-zoom).
10. **ADVISORY** -- Line height 1.4+ on text blocks.
11. **STANDARD** -- All colors via `--mathai-*` variables -- no hardcoded hex.
12. **STANDARD** -- `env(safe-area-inset-*)` padding on outer container.
13. **STANDARD** -- Bottom buttons clear gesture bar via `env(safe-area-inset-bottom)`.
14. **CRITICAL** -- Number inputs: `type="text"` with `inputmode="numeric"`, not `type="number"`.
15. **STANDARD** -- `visualViewport` resize listener for keyboard handling.
16. **STANDARD** -- Enter key triggers submit on text inputs.
17. **STANDARD** -- Portrait-only: landscape overlay at `max-height: 500px`.
18. **STANDARD** -- `overscroll-behavior: none` on `html` and `body`.
19. **STANDARD** -- `touch-action: manipulation` on all interactive elements.
20. **STANDARD** -- `-webkit-touch-callout: none` and `user-select: none` on game wrapper.
21. **STANDARD** -- `user-select: text` re-enabled on inputs.
22. **CRITICAL** -- HTML file under 500KB.
23. **STANDARD** -- No continuous CSS animations during gameplay -- momentary feedback only.
24. **STANDARD** -- DOM under 500 elements -- render one round at a time.
25. **CRITICAL** -- No flexbox `gap` (use margins). Grid `gap` is allowed.
26. **CRITICAL** -- No optional chaining (`?.`), nullish coalescing (`??`), `Array.at()`, `structuredClone()`, top-level `await`.
27. **STANDARD** -- Every `-webkit-` property must have the unprefixed standard property.
28. **STANDARD** -- `-webkit-appearance: none; appearance: none` on all inputs.
29. **ADVISORY** -- Debounce resize and scroll handlers.
30. **CRITICAL** -- In preview-wrapper mode (`slots.previewScreen: true`), the components bundle owns scroll selection — inner (`.mathai-preview-body`) on touch devices, document-level on desktop (via `(hover:hover) and (pointer:fine)`). Game CSS MUST NOT set `height` / `overflow` on `html`, `body`, `.page-center`, `#mathai-preview-slot`, or `.mathai-preview-body`, and MUST NOT create nested `overflow-y:auto` descendants inside `.game-stack`.

### From feedback/SKILL.md

1. **CRITICAL** -- Never build custom feedback overlays -- FeedbackManager owns the overlay layer.
2. **CRITICAL** -- Single-step correct/wrong: `await FeedbackManager.sound.play(...)` — awaited, blocks input via `gameState.isProcessing`. Multi-step mid-round matches: fire-and-forget, no blocking.
3. **CRITICAL** -- Last-life wrong answer: ALWAYS play wrong SFX (awaited with Promise.all 1500ms minimum, same as any other answer-feedback call) BEFORE proceeding to game-over flow (Case 8). Never skip the wrong SFX on last life.
4. **CRITICAL** -- Screen renders BEFORE end-game audio. `game_complete` postMessage sent BEFORE audio plays (Cases 11, 12).
5. **CRITICAL** -- CTA taps stop all audio (`FeedbackManager.sound.stopAll()` + `_stopCurrentDynamic()`).
6. **CRITICAL** -- All SFX URLs from `feedback/reference/feedbackmanager-api.md` Standard Audio URLs table. Never invent URLs.
7. **CRITICAL** -- All VO via `FeedbackManager.playDynamicFeedback()` — never hardcode VO URLs, never preload VO.
8. **CRITICAL** -- Call `waitForPackages()` (which waits for FeedbackManager) during init before first round.
9. **STANDARD** -- Never skip feedback -- even obvious answers need confirmation.
10. **STANDARD** -- Never show negative scores. Score >= 0 always.
11. **STANDARD** -- Never use "wrong" in student-facing text. Use "Not quite," "Close," "Almost."
12. **STANDARD** -- Subtitle under 60 characters.
13. **STANDARD** -- Audio failure is non-blocking. Every FeedbackManager call in try/catch.
14. **STANDARD** -- Always show correct answer on wrong answer.
15. **STANDARD** -- Game-over tone is encouraging, not punitive.
16. **CRITICAL** -- No custom audio (`new Audio()`) — FeedbackManager handles all audio.
17. **CRITICAL** -- Never block init on FeedbackManager failure.

---

## Defaults

When the spec does not specify:

| Parameter | Default | Source |
|-----------|---------|--------|
| Bloom level | L2 (Understand) | feedback/SKILL.md |
| Total rounds | Archetype default (9 for MCQ/Lives, 6 for Sort, etc.) | game-archetypes.md |
| Lives | Archetype default (0 for MCQ, 3 for Lives Challenge) | game-archetypes.md |
| Timer | Archetype default (0 for most, 60s for Speed Blitz) | game-archetypes.md |
| Star thresholds | 3 at 90%, 2 at 60%, 1 at 1+, 0 at 0 | data-contract.md |
| `question_id` format | `'r' + roundNumber` | data-contract.md |
| `misconception_tag` | `null` for all attempts | data-contract.md |
| `difficulty_level` | `1` for all rounds | data-contract.md |
| Correct SFX sticker | 2s duration | feedback/SKILL.md |
| Wrong SFX sticker | 2s duration | feedback/SKILL.md |
| End-game sticker | 3–5s duration | feedback/SKILL.md |
| Viewport | 375x667, portrait only | mobile.md |
| Touch targets | 44px minimum | mobile.md |
| Font | system stack via `--mathai-font-family` | mobile.md |

---

## Anti-patterns

1. No external CDN libraries -- only the three approved scripts from `storage.googleapis.com`
2. No custom feedback overlays -- FeedbackManager renders its own overlay; games only add `.correct-reveal`
3. No flat postMessage -- must use nested `data.metrics` structure, not top-level fields
4. No hardcoded colors -- all values via `--mathai-*` CSS variables
5. No bare `100vh` -- use `100dvh` with `@supports` fallback
6. No flexbox `gap` -- use margins; grid `gap` is allowed
7. No optional chaining (`?.`), nullish coalescing (`??`), `Array.at()`, `structuredClone()`, top-level `await`
8. No `type="number"` on inputs -- use `type="text"` with `inputmode="numeric"`
9. No custom audio -- FeedbackManager handles all audio via `sound.play()` and `playDynamicFeedback()`
10. No render-all-rounds -- render only the current round, never all at once
11. No sending `game_ready` before listener registration -- register `message` listener first, then send `game_ready`
12. No phase assignment after logic in `game_init` -- `gameState.phase = 'playing'` must be the FIRST LINE
13. No victory-only `game_complete` guard -- `game_complete` postMessage fires on BOTH victory and game-over
14. No skipping feedback -- always `await FeedbackManager.sound.play(...)` AND `await FeedbackManager.playDynamicFeedback(...)` for terminal/round-complete moments; fire-and-forget only for multi-step mid-round partial-match SFX (no TTS there) and round-start / chain-progress audio
15. No input during feedback -- `isProcessing` guard at top of every input handler
