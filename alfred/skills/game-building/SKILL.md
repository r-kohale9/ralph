# Skill: Game Building

## Purpose

Transform a game spec + pre-generation plan + archetype profile into a single self-contained HTML file that is a playable, tested, platform-compliant math game for Indian Class 5-10 students on budget Android phones.

## When to use

When generating HTML from an approved spec + plan. The main generation step.

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When game generation moves to a template engine that does not use LLM-based HTML generation.

## Reads

- `skills/game-archetypes.md` -- archetype profile (structure, interaction, scoring, screens, PART flags, defaults) -- **ALWAYS**
- `skills/data-contract.md` -- gameState schema, recordAttempt schema, game_complete postMessage schema, syncDOM contract, trackEvent schema, handlePostMessage/game_ready protocol, validation rules -- **ALWAYS**
- `skills/mobile/SKILL.md` -- viewport, touch targets, typography, safe areas, keyboard, orientation, gestures, performance, cross-browser, CSS variables -- **ALWAYS**
- `skills/feedback/SKILL.md` -- behavioral feedback cases, await/fire-and-forget rules, priority table, FeedbackManager API (reference/feedbackmanager-api.md for CDN URLs and code), timing (reference/timing-and-blocking.md) -- **ALWAYS**
- `skills/interaction/SKILL.md` -- 8 canonical interaction patterns (tap, chain, match, swipe, drag-path, drag-drop, input, toggle), event handling, touch specifics, state machines, guards, undo, hit detection (reference/patterns.md for full code, reference/touch-events.md for pointer events, reference/state-and-guards.md for state management) -- **ALWAYS**
- `reference/flow-implementation.md` -- screen→component mapping + progress bar lifecycle + round loop pattern -- **ALWAYS**
- `alfred/skills/game-planning/reference/default-flow.md` -- canonical flow diagram -- **ALWAYS**
- `alfred/parts/PART-050.md` -- CDN FloatingButtonComponent API (submit/retry/next lifecycle, submittable-predicate contract) -- **WHEN the game flow has a Submit CTA**
- `alfred/parts/PART-051.md` -- CDN AnswerComponentComponent API (post-feedback Correct Answers carousel, end-game stack, slide render-callback contract) -- **UNLESS spec declares `answerComponent: false`. NOTE: that flag is a CREATOR-ONLY opt-out — step 4 (Build) MUST NOT add it to spec.md to silence the validator, and the spec author at step 1 MUST NOT auto-default it. If a spec arrives at build with `answerComponent: false` lacking quoted creator opt-out language, the build is on a malformed spec and should be flagged, not patched.**

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
3. Run Step 5 (`node lib/validate-static.js`). All GEN-* rules green.

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

Implement the flow code inline per [flow-implementation.md](reference/flow-implementation.md) — it provides the screen→component mapping, progress bar lifecycle, and round loop pattern derived from `pre-generation/game-flow.md` and `alfred/skills/game-planning/reference/default-flow.md`.

Follow the exact function order from [code-patterns.md](reference/code-patterns.md) for everything else. All 24 code sections must be implemented with the exact signatures and behaviors documented there. Key sections: gameState, syncDOM, handlePostMessage, recordAttempt, trackEvent, endGame, FeedbackManager integration (preload, sound.play, playDynamicFeedback), getRounds, getStars, startGame, resetGame, answer handler, init sequence.

### Step 4: Write the Fallback Content

The `fallbackContent.rounds` array is the game's offline dataset. It must:

- Contain at least `totalRounds` round objects
- Follow the exact round schema from the spec
- Include every field the answer handler and recordAttempt read (id, answer, options, difficulty, misconception tags, feedbackCorrect, feedbackWrong, etc.)
- Progress in difficulty (easy -> medium -> hard, or per spec stages)
- Have stable `id` fields (e.g., `'r1_topic_detail'`) for cross-session comparison
- Contain rounds for at least **3 distinct `set` values** (`"A"`, `"B"`, `"C"`). Each set contains exactly `totalRounds` rounds with the same round schema.
- Round `id` values globally unique across sets — use prefix convention `"A_r1_…"`, `"B_r1_…"`, `"C_r1_…"` so `question_id` analytics segment by set via prefix (no schema change required).
- Parallel difficulty progression across sets — Set A's Round 1 ≈ Set B's Round 1 ≈ Set C's Round 1 in difficulty. A student cycling through sets on retry experiences comparable learning load.

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
- [ ] GEN-PHASE-INIT: `#app` initial `data-phase` matches `gameState.phase` init
- [ ] GEN-PHASE-SEQUENCE: endGame sets phase BEFORE syncDOM
- [ ] GEN-PHASE-MCQ: At least 3 syncDOM calls exist
- [ ] GEN-DATA-LIVES-SYNC: syncDOM writes `data-lives` (lives games)
- [ ] GEN-SYNCDOMSTATE-ALLATTRS: syncDOM writes `data-round` and `data-score`
- [ ] GEN-SHOWRESULTS-SYNC: showResults calls syncDOM after phase assignment
- [ ] GEN-RESTART-RESET: resetGame resets phase, currentRound, score, attempts, events
- [ ] GEN-CORRECT-ANSWER-EXPOSURE: `gameState.correctAnswer` set each round
- [ ] GEN-FLOATING-BUTTON-CDN: When spec has a Submit CTA, the FloatingButton CDN script (or the bundle `components/index.js`) is included and `new FloatingButtonComponent(...)` is instantiated in DOMContentLoaded
- [ ] GEN-FLOATING-BUTTON-SLOT: `ScreenLayout.inject(...)` passes `slots.floatingButton: true` whenever `FloatingButtonComponent` is used
- [ ] GEN-FLOATING-BUTTON-PREDICATE: At least one input / state-change handler calls `floatingBtn.setSubmittable(...)` (prevents the "show once, never hide" regression)
- [ ] 5e0-FLOATING-BUTTON-DUP: No custom `<button>` anywhere in source whose **id / class / data-testid / aria-label / inner text** contains `submit / commit / retry / next / check / done / cta` when FloatingButton is used. Renaming id/class while keeping a telltale `data-testid` or inner text "Submit" still fires the rule — delete the button entirely.
- [ ] End-of-game sequencing differs by shape. **Standalone (`totalRounds: 1`)**: PART-050 5-beat orchestrator inside a single `endGame()` — SFX awaited → feedback panel + `game_complete` SYNC → **TTS awaited** → `show_star` → `setTimeout(setMode('next'), 1100)`. The submit handler is one line: `await endGame(correct);`. Do NOT split into `runFeedbackSequence` / `finalizeAfterDwell` (bodmas-blitz regression — `game_complete` + Next fired after only SFX while TTS still played). **Multi-round (`totalRounds > 1`)**: round-N submit handler awaits SFX **AND** awaits dynamic TTS before advancing — same as every other round (validator: `GEN-FEEDBACK-TTS-AWAIT`). End-of-game audio is owned by Stars Collected `onMounted` (awaits `sound_stars_collected` → fires `show_star` → setTimeout → `setMode('next')`). Validator: `GEN-ENDGAME-AFTER-TTS` fires only on standalone games that define `function runFeedbackSequence` / `function finalizeAfterDwell`.
- [ ] show_star `count` and `score` must agree: whatever number of stars the animation visually celebrates (`count`), the `score` string in the same payload must express the same quantity. `×2` animation with `/1` score = broken (solve-for-x-speed-round 2026-04-24 regression). For standalone games where one round awards up to N stars, use `count: Math.max(1,Math.min(N,stars))` + `score: stars + '/' + N`, not `gameState.score + '/' + gameState.totalRounds`. See code-patterns.md "show_star count ↔ score agreement" table.
- [ ] `show_star` fires EXACTLY ONCE per game session, at the end-of-game celebration beat — NEVER inside a per-round correct handler. Per-round score bumps use `previewScreen.setScore(gameState.score + '/' + gameState.totalRounds)` directly (no animation). Firing `show_star` on each correct answer stacks the flying-star animation N times in a multi-round game (equivalent-ratio-quest + equivalent-ratios regressions). Validator: `GEN-SHOW-STAR-ONCE`.
- [ ] GEN-HEADER-REFRESH (PART-040): Every game that uses `PreviewScreenComponent` MUST update the ActionBar header score as the game progresses. Three mandatory moments:
  - **Initial seed (in `startGameAfterPreview`)**: `previewScreen.setQuestionLabel('Q1')` + `previewScreen.setScore('0/' + gameState.totalRounds)`.
  - **Correct answer mid-round**: `previewScreen.setScore(gameState.score + '/' + gameState.totalRounds)` — direct, no animation.
  - **End-of-game celebration (the ONE `show_star` per session)**: `window.postMessage({type:'show_star', data:{count, variant:'yellow', score: gameState.score + '/' + gameState.totalRounds}}, '*')`. The `score` field is applied AFTER the 1 s animation finishes, so the celebration visibly precedes the number change.
  - **Round advance (multi-round only)**: call `previewScreen.setQuestionLabel('Q' + gameState.currentRound)` directly (no star animation on round start).
  Do NOT re-post `game_init` from game code to update header fields — the game's own `handlePostMessage` would re-run `setupGame()` with fallback content. Direct methods + `show_star` payload extensions are the only sanctioned paths. See PART-040 "Updating header state from game code".
- [ ] GEN-FLOATING-BUTTON-MISSING: No hand-rolled Submit / Check / Done / Commit `<button>` when `FloatingButtonComponent` is NOT instantiated. Narrative reasons in HTML comments or plan notes ("submit-only flow doesn't need retry/next", "standalone totalRounds:1", "inline button inside the form") do NOT silence this rule. PART-050 handles submit-only flows. The ONLY valid opt-out is `floatingButton: false` in `spec.md` (mirrors PART-039 `previewScreen: false`) — a spec-author decision reviewed at step 2. The build step MUST NOT add `floatingButton: false` to `spec.md` to silence the rule; any spec mutation during build shows up in `git diff` and is a scope violation. If the spec genuinely has no Submit CTA (no Submit/Check/Done mentioned in core mechanic), do NOT emit the button at all. The archetype PART-flag row is a default; the spec's flow overrides it (game-archetypes constraint #8)
- [ ] GEN-ANSWER-COMPONENT-INSTANTIATE / GEN-ANSWER-COMPONENT-CDN / GEN-ANSWER-COMPONENT-SLOT (PART-051): Unless the spec declares `answerComponent: false`, every game MUST `new AnswerComponentComponent({ slotId: 'mathai-answer-slot' })` at DOMContentLoaded, declare `slots.answerComponent: true` in `ScreenLayout.inject(...)`, and include either `answer-component/index.js` or the `components/index.js` bundle script tag.
- [ ] GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK (PART-051): `answerComponent.show({ slides })` MUST be called AFTER `await FeedbackManager.play(...)` for the final round. Calling it earlier reveals the answer before the player has finished hearing the verdict.
- [ ] GEN-ANSWER-COMPONENT-AFTER-CELEBRATION (PART-051): For multi-round games that use TransitionScreen, `answerComponent.show(...)` MUST NOT appear inside `endGame()` (and MUST NOT appear in a Victory `Claim Stars` action that skips Stars Collected). It must be reached only through the Stars Collected `onMounted` setTimeout that calls a `showAnswerCarousel()`-style function. The Stars Collected TS stays mounted (no `transitionScreen.hide()` in `onMounted` — per default-transition-screens.md, Stars Collected is a celebration backdrop). The celebration beat (yay sound + `show_star` animation) plays FIRST, then the answer card appears over it.
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
- [ ] When `previewScreen: true`, emit the preview-wrapper scroll compatibility CSS so `.mathai-preview-body` is the single vertical scroll owner
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
- [ ] `FeedbackManager.sound.preload([...])` with exact SFX URLs from `feedback/reference/feedbackmanager-api.md`
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
8. **CRITICAL** -- `game_ready` MUST be sent AFTER the message listener is registered. Sending it before means `game_init` is lost.
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
30. **CRITICAL** -- In preview-wrapper mode (`slots.previewScreen: true`), ship the compatibility CSS that makes `#mathai-preview-slot .mathai-preview-body` the explicit vertical scroll owner. Do NOT rely on root-page scrolling, and do NOT create nested `overflow-y:auto` descendants inside `.game-stack`.

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
