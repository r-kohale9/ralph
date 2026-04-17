Exact output format for all 5 plan documents -- each section below is the template that game-building.md consumes.

## 1. game-flow.md Format

```markdown
# Game Flow: [Game Title]

## One-liner
[What the player does in one sentence. Must name the math topic, the action verb, and the end goal.]

## Flow Diagram

[ASCII diagram copied VERBATIM from reference/default-flow.md (Shape 2) or reference/shapes.md (Shape 1 / Shape 3), with any additive customization deltas from reference/flow-gallery.md applied in place.]

Rules:
- Must match the canonical diagram from default-flow.md or shapes.md. Hand-invented flows are not allowed.
- Customizations appear as ADDITIVE edits only: inserted steps, added conditional branches, or a single relabeled transition — never a wholesale rewrite.
- Every screen that exists in the game appears in this diagram.
- Every transition is labeled with what triggers it (tap, timer expiry, lives=0, all rounds done).
- Loops (replay) are shown explicitly.
- If the archetype has game_over, it appears as a branch.

## Shape

**Shape:** [Shape 1 Standalone | Shape 2 Multi-round | Shape 3 Sectioned]

## Changes from default

- [List every delta applied from flow-gallery.md, one per bullet. If none, write "None — canonical diagram copied verbatim."]

## Stages

| Stage | Rounds | Difficulty | Content description |
|-------|--------|------------|---------------------|
| Easy | 1-3 | L1 recall / simple values | [what the student sees] |
| Medium | 4-6 | L2 application / moderate values | [what the student sees] |
| Hard | 7-9 | L3 multi-step / tricky distractors | [what the student sees] |

Notes:
- Round count and stage breakdown come from the spec. If the spec is silent, use archetype defaults.
- "Content description" is concrete: "single-digit multiplication" not "easier problems."
```

## 2. screens.md Format

```markdown
# Screens: [Game Title]

## Screen Inventory

List every screen with its data-phase value:
- start (data-phase="start")
- gameplay (data-phase="gameplay")
- results (data-phase="results")
- game_over (data-phase="game_over") -- only if lives > 0

## [Screen Name] (data-phase="[value]")

### Layout

+-----------------------------+
|  [element]        [element] |  <- describe position and content
|                             |
|        [element]            |  <- centered element
|                             |
|  [element]  [element]       |  <- grouped elements
|                             |
|        [element]            |  <- bottom element
+-----------------------------+

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| [name] | top-left | [what it shows] | no / tap / drag |

**Required rows for every TransitionScreen-backed screen** (welcome, round_intro, section_intro, motivation, victory, game_over, stars_collected, any custom transition):

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Sticker / Icon | top-center | exact emoji string (e.g. `😔`) OR named sticker (e.g. `alfred_sad`) — the icons[] array passed to transitionScreen.show | no |
| Title | center | **exact quoted string** — the `title` passed to transitionScreen.show | no |
| Subtitle | center | **exact quoted string** (omit row if no subtitle) — the `subtitle` passed to transitionScreen.show | no |
| Audio | (auto, onMounted) | **sound id + optional dynamic VO text** — fired by onMounted via FeedbackManager.sound.play(id, { sticker }) | no |
| CTA 1 | bottom | **exact quoted button label** → which screen / function it routes to | tap |
| CTA 2 | bottom (if multiple) | **exact quoted button label** → which screen / function it routes to | tap |

These strings are the **contract** between planning and building. Game-building MUST copy title / subtitle / sticker / audio id / button labels VERBATIM from this table into `transitionScreen.show({...})`. Content drift (inventing a different title, adding stars to the subtitle, renaming a button) is blocked by `test/content-match.test.js` and static rule `5f-CONTENT-MATCH`.

### Entry condition
How the player arrives at this screen.

### Exit condition
What the player does to leave this screen and where they go.

[Repeat for EVERY screen]

## Round Presentation Sequence

Within the gameplay screen, each round follows this sequence:
1. **Question preview** -- question text + any images render. Options NOT yet visible.
2. **Instructions** (conditional) -- **NOT an on-screen text block.** The "how to play" copy is delivered ONCE by the PreviewScreenComponent (`previewInstruction` + `previewAudioText`) before Round 1 starts. Gameplay screens MUST NOT re-render the same instruction text in a static panel. Only render a per-round **prompt / question** if it is semantically different from the preview instruction (e.g. "Which tile shows the answer?" — a per-item prompt, not the global how-to-play). When a round type changes, convey the change via a **Round-N intro transition screen**, not by injecting an instruction banner into gameplay.
3. **Media** (conditional) -- audio/video plays if present. Skippable.
4. **Gameplay reveal** -- options/inputs fade in (350ms). Input unblocks.
```

**ASCII wireframe rules:**
- Draw a wireframe for EVERY screen, not just gameplay
- Show actual content examples (real question text, real option text), not placeholders
- Show element positions: top-left, top-center, top-right, center, bottom
- Show relative sizing: a progress bar is wide and thin, a question is large text centered
- **Progress bar is drawn at the TOP of every non-Preview wireframe** (below the preview header, above gameplay content). Never at the bottom.
- **Persistent fixtures are drawn on every non-Preview wireframe:** (a) preview header (avatar, question label, score, star) at the very top — owned by PreviewScreenComponent and visible in both preview + game states; (b) progress bar below the header (Shape 2 Multi-round and Shape 3 Sectioned only — hidden for Shape 1 Standalone).
- Use box-drawing characters for the mobile viewport (375x667 proportions)
- Include the round presentation sequence for gameplay screens

## 3. round-flow.md Format

```markdown
# Round Flow: [Game Title]

## Round Types

List every distinct round type.

## Round Type: [Name]

### Step-by-step

1. **Round starts** -- [what renders]
2. **Student sees** -- [question preview content, instruction if applicable]
3. **Student acts** -- [tap option / type number / drag item / click cell]
4. **Correct path (single-step — SFX + dynamic TTS by default):**
   a. Selected option gets `.selected-correct` styling
   b. `gameState.isProcessing = true` blocks input
   c. `await FeedbackManager.sound.play('correct_sound_effect', {sticker})` — awaited
   d. `await FeedbackManager.playDynamicFeedback({audio_content: '[context-aware explanation]', subtitle: '[same text]', sticker})` — awaited after SFX
   e. Score increments, score display bounces (scoreBounce 400ms)
   f. `gameState.isProcessing = false`, input unblocks, auto-advance to next round
4alt. **Correct path (multi-step — SFX + sticker only):**
   a. Matched elements get `.selected-correct` styling
   b. `FeedbackManager.sound.play('correct_sound_effect', {sticker}).catch(...)` — fire-and-forget, NO dynamic TTS
   c. Student continues interacting immediately — NO input blocking
5. **Wrong path (single-step — SFX + dynamic TTS by default):**
   a. Selected option gets `.selected-wrong` styling
   b. Correct option gets `.selected-correct` styling
   c. `.correct-reveal` shows "Answer: [correct answer]"
   d. `gameState.isProcessing = true` blocks input
   e. `await FeedbackManager.sound.play('incorrect_sound_effect', {sticker})` — awaited
   f. `await FeedbackManager.playDynamicFeedback({audio_content: '[context-aware explanation]', subtitle: '[same text]', sticker})` — awaited after SFX
   g. [If lives game: life decremented, progress bar updated, heart-break animation 600ms]
   h. [If lives = 0: ALWAYS play wrong SFX (awaited, Promise.all 1500ms min) BEFORE proceeding to game_over (feedback/SKILL.md Case 8) — never skip]
   i. `gameState.isProcessing = false`, input unblocks
   j. Student stays on same round — retries
5alt. **Wrong path (multi-step — SFX + sticker only):**
   a. Wrong element flashes `.selected-wrong`
   b. `FeedbackManager.sound.play('incorrect_sound_effect', {sticker}).catch(...)` — fire-and-forget, NO dynamic TTS
   c. Life lost if applicable
   d. Student continues interacting immediately — NO input blocking
6. **Last round complete:**
   a. Results screen renders FIRST, `game_complete` postMessage sent BEFORE audio
   b. `await FeedbackManager.sound.play('victory_sound_effect', {sticker})` → `await FeedbackManager.playDynamicFeedback({audio_content: '[victory VO]', subtitle, sticker})`
   c. CTA already visible — if tapped, `FeedbackManager.sound.stopAll()`

### State changes per step

| Step | gameState fields changed | DOM update |
|------|------------------------|------------|
| Round starts | currentRound incremented | syncDOM() called |
| Correct answer | score++, streak++ | score display, progress bar |
| Wrong answer | streak=0, lives-- (if applicable) | lives display, correct reveal |
| Last round | phase='results' | screen transition |
```

## 4. feedback.md Format

```markdown
# Feedback: [Game Title]

## Bloom Level: [L1/L2/L3/L4]

## Feedback Moment Table

| Moment | Trigger | FeedbackManager call | Subtitle template | Blocks input? | Await? | What happens after |
|--------|---------|---------------------|-------------------|---------------|--------|--------------------|
| Level transition | Level screen shows | `await sound.play('rounds_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: 'Level N'})` | "Level N" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Round transition (auto) | Round screen shows | `await sound.play('rounds_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: 'Round N'})` | "Round N" | No CTA | Yes (sequential) | Auto-advance after both |
| Round transition (CTA) | Round screen shows | `await sound.play('rounds_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: 'Round N'})` | "Round N" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Correct (single-step) | Student selects correct option | `await sound.play('correct_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: explanation, subtitle, sticker})` | context-aware explanation | Yes | Yes (sequential) | Auto-advance |
| Correct (multi-step) | Student matches pair/chain | `FeedbackManager.sound.play('correct_sound_effect', {sticker}).catch(...)` | — | No | No (fire-and-forget) | Continue playing |
| Wrong (single-step) | Student selects wrong option | `await sound.play('incorrect_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: explanation, subtitle, sticker})` | context-aware explanation | Yes | Yes (sequential) | Stay on round, retry |
| Wrong (multi-step) | Student selects wrong match | `FeedbackManager.sound.play('incorrect_sound_effect', {sticker}).catch(...)` | — | No | No (fire-and-forget) | Continue playing |
| Last life wrong | Lives reach 0 | Skip wrong SFX → game-over | — | — | — | Game over screen |
| Round complete | All sub-actions done | `await FeedbackManager.sound.play('all_correct', {sticker})` | "All matched!" | Yes | Yes | Next round |
| Victory | All rounds complete | Screen first → `game_complete` → `await sound.play('victory_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: VO})` | per star tier | CTA visible | Yes (sequential) | CTA stops audio |
| Game over | Lives reach 0 | Screen first → `game_complete` → `await sound.play('game_over_sound_effect', {sticker})` → `await playDynamicFeedback({audio_content: VO})` | contextual | CTA visible | Yes (sequential) | CTA stops audio |

## Subtitle Examples

3 concrete examples per type using actual spec content.

## Animations

| Animation | Trigger | CSS class | Duration |
|-----------|---------|-----------|----------|
| Score bounce | Correct answer | `.score-bounce` | 400ms |
| Shake | Wrong answer | `.shake-wrong` | 500ms |
| Heart break | Life lost | `.heart-break` | 600ms |
| Streak glow | 3+ streak | `.streak-glow` | 600ms |
| Star pop | Results star earned | `.star-earned` | 400ms |
| Fade in | New round appears | `.fade-in` | 350ms |

## Wrong Answer Handling

- Show correct answer: always
- Misconception-specific feedback: [yes/no]
- Failure recovery (3+ consecutive wrong): soften language, add hints

## Emotional Arc Notes

[Game-specific notes]
```

## 5. scoring.md Format

```markdown
# Scoring: [Game Title]

## Points

| Action | Points | Notes |
|--------|--------|-------|
| Correct answer | +1 | Per round |
| Wrong answer | 0 | No point penalty |

## Formula

score = number of correct answers
maxScore = total rounds
percentage = (score / maxScore) * 100

## Star Thresholds

| Stars | Threshold | Displayed as |
|-------|-----------|-------------|
| 3 stars | >= 90% | Three filled stars |
| 2 stars | >= 66% | Two filled, one empty |
| 1 star | >= 33% | One filled, two empty |
| 0 stars | < 33% | Three empty stars |

## Lives (if applicable)

| Parameter | Value |
|-----------|-------|
| Starting lives | [N] |
| Lives lost per wrong answer | 1 |
| Game over condition | lives = 0 |
| Lives display | [hearts/icons at top-right] |
| Life loss animation | heartBreak 600ms |

## Progress Bar

| Parameter | Value |
|-----------|-------|
| Tracks | Round number (currentRound / totalRounds) |
| Position | **Top of game body** — below the fixed preview header, above `#gameContent`. Owned by ScreenLayout + ProgressBarComponent. Visible on every screen except Preview. Do NOT place at the bottom. |
| Style | Filled bar, left-to-right |
| Updates | After each correct feedback (animates during ✓ window) |

## Data Contract Fields

| Field | Source | Example value |
|-------|--------|---------------|
| score | gameState.score | 7 |
| totalQuestions | gameState.totalRounds | 9 |
| stars | calculated from percentage | 2 |
| accuracy | percentage | 78 |
| timeSpent | Date.now() - gameState.startTime | 45000 |
```
