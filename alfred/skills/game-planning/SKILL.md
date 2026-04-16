# Skill: Game Planning

## Purpose

Transform a game spec into 5 structured plan documents (game-flow, screens, round-flow, feedback, scoring) that are precise enough for game-building.md to produce a working HTML game without guessing.

## When to use

After spec is approved, before game-building. Produces the 5 plan docs the build step reads.

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When game-building can reliably produce correct HTML directly from a spec without intermediate plan documents.

## Reads

- `skills/game-archetypes.md` -- archetype profile determines the structural skeleton -- **ALWAYS**
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
