# Skill: Spec Creation

## Purpose

Generate a complete, buildable game spec from a creator's game description (1-10 sentences), producing output that an engineer can implement without guessing.

## When to use

When a creator provides a game description (1-10 sentences) and a new spec.md needs to be generated. Not for reviewing or editing existing specs — use `spec-review.md` for that.

## Owner

**Maintainer:** Education slot.
**Deletion trigger:** Retire when spec creation is fully automated by a deterministic pipeline stage that no longer uses LLM-generated specs.

## Reads

- `game-archetypes.md` — ALWAYS — 10 archetype profiles (structure + interaction + scoring + feedback combinations). Includes constraint #8 (FloatingButton is flow-driven and overrides the per-archetype PART flag list — any flow with a Submit / Check / Done / Commit CTA mandates PART-050).
- `alfred/parts/PART-050.md` — WHEN the creator's description includes a Submit / Check / Done CTA — FloatingButton planning contract (slot, submittable predicate, submit handler, opt-out policy).
- `pedagogy.md` — ON-DEMAND — Bloom level mapping, misconception design principles (load when assigning Bloom level or generating misconception tags)
- `data-contract.md` — ON-DEMAND — recordAttempt schema, game_complete schema, required fields (load when building fallbackContent structure)
- alfred/skills/game-planning/reference/default-flow.md -- canonical multi-round default; copy verbatim into spec's ## Flow when any rounds-based game is described -- ALWAYS
- alfred/skills/game-planning/reference/flow-gallery.md -- 16 customization patterns to apply on top of the default; consulted when the user description triggers a deviation -- WHEN CUSTOMIZATION TRIGGERED

## Input

A game description from a creator: 1-10 sentences in natural language. May be detailed or vague. May be in mixed Hindi/English. May describe a session instead of a single game. May be empty, non-math, or impossibly scoped.

## Output

A structured `spec.md` file with ALL of the following sections. Every section is mandatory — no section may be omitted or left as a placeholder.

```markdown
# Game Design: [Game Name]

## Identity
- **Game ID:** [kebab-case slug, e.g., scale-it-up]
- **Title:** [Human-readable name]
- **Class/Grade:** [e.g., Class 5, Grade 5]
- **Math Domain:** [e.g., Ratio & Proportion, Fractions, Geometry]
- **Topic:** [Specific topic, e.g., ratio scaling, triangle classification]
- **Bloom Level:** [L1 Remember / L2 Understand / L3 Apply / L4 Analyze]
- **Archetype:** [One of 10 profiles from game-archetypes.md]

## One-Line Concept
[Single sentence: what the student does and why it builds the target skill.]

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
[One row per distinct skill exercised. Link each to a round type.]

## Core Mechanic
[For EACH interaction type used:]
### Type [Letter]: "[Name]"
1. What the student sees
2. What the student does (input type)
3. What counts as correct
4. What feedback plays

## Rounds & Progression
### Stage [N]: [Label] (Rounds [X]-[Y])
- Round types used
- Difficulty parameters (multiplier range, ratio complexity, etc.)
- Contexts/themes

[Then a summary table:]
| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
[One row per difficulty dimension that changes across stages]

## Game Parameters
- **Rounds:** [exact number]
- **Timer:** [None, or seconds per round]
- **Lives:** [0 or exact number]
- **retryPreservesInput:** [true | false — default `false`. Applicable only when `Rounds: 1` AND `Lives > 1` (standalone + Try Again reachable). `true` keeps the input value intact after the player taps Try Again; `false` clears it. See PART-050 "Try Again flow". Ignored for multi-round games and for standalone games with Lives = 1.]
- **autoShowStar:** [true | false — default `true`. When `true`, the generator emits the default `show_star` postMessage at PART-050's canonical end-of-game spot (before `floatingBtn.setMode('next')` in standalone, inside `transitionScreen.onDismiss(...)` in multi-round). Set `false` to suppress the default trigger and fire `show_star` yourself at a custom beat. See PART-050 "Next flow".]
- **Star rating:** 3 stars = [threshold], 2 stars = [threshold], 1 star = [threshold]
- **Input:** [input type(s) with specifics]
- **Feedback:** [feedback style]

## Scoring
- Points: [formula, e.g., +1 per correct]
- Stars: [thresholds as fractions of total rounds]
- Lives: [how lives are lost, what happens at 0]
- Partial credit: [if applicable, or "None"]

## Flow

[Final ASCII flow diagram. Start from default-flow.md (or Shape 1 Standalone from shapes.md for single-question games), then apply customizations from user description.]

**Shape:** [Multi-round (default) | Standalone | Multi-round + customizations]
**Changes from default:**
- [each customization, one line; "None" if no changes]

## Feedback
| Event | Behavior |
|-------|----------|
| Correct answer | [what happens] |
| Wrong answer | [what happens] |
| Lose last life | [what happens] |
| Complete all rounds | [what happens] |
| [Any game-specific events] | [what happens] |

## Content Structure (fallbackContent)
[The exact shape of the fallbackContent object, with one fully worked example round
and the misconception tags for every distractor/wrong-answer path.

**Top-level spec field — `previewScreen` (optional, default `true`):**
When absent or `true`, the generated game includes the PART-039 preview screen (this is the default). When explicitly set to `false`, the pipeline generates a game with NO preview screen: no `PreviewScreenComponent`, no `#mathai-preview-slot`, and `DOMContentLoaded` proceeds directly into the first level/round transition. Only set `false` when the author explicitly asks for no preview.

**Required preview fields** (per PART-039, required ONLY when `previewScreen !== false`):
- `previewInstruction` — HTML string with the full instruction text shown on the preview overlay (bold, images allowed).
- `previewAudioText` — plain-text narration used to generate preview TTS at deploy time (patched into `previewAudio` post-build).
- `showGameOnPreview` — optional boolean, default `false`. Set `true` if the student should see the game state (covered by a blocking overlay) while the preview audio plays.

When `previewScreen: false`, the three fields above are NOT required and SHOULD be omitted from `fallbackContent`.]

Example:
```js
const fallbackContent = {
  previewInstruction: '<p>Tap two tiles that double each other!</p>',
  previewAudioText: 'Find two numbers where one is double the other. Tap both to match them.',
  previewAudio: null,           // filled at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: "A",
      // ... all fields for this round type
      misconception_tags: {
        "[wrong_answer_1]": "misconception-name",
        "[wrong_answer_2]": "misconception-name"
      }
    }
    // ... all N rounds
  ]
};
```

## Defaults Applied
[List every decision that was NOT specified by the creator and was filled by a default.
Format: "- **[Decision]**: defaulted to [value] (creator did not specify)"]

## Warnings
[List any guideline conflicts, unusual choices, or potential issues.
Format: "- WARNING: [description of conflict or concern]"]
```

## Procedure

Follow these steps in order. Do not skip any step. Do not combine steps.

### Step 1: Validate input

1a. **Check for empty input.** If the input is empty or contains no meaningful content, do NOT produce a spec. Instead, respond: "I need a game description to generate a spec. Please describe: (1) the math topic and grade level, (2) what the student does in the game, and (3) any preferences for rounds, lives, or difficulty." Stop here.

1b. **Check for non-math input.** If the input describes a non-math game (history, science, language arts, etc.), FLAG it: "This describes a [subject] game, not a math game. The pipeline currently supports math games only." Either refuse or ask for clarification. Do NOT silently produce a non-math spec.

1c. **Check for impossible scope.** If the input asks for a single game covering more than ~3 tightly related concepts (e.g., "all of Class 10 mathematics"), push back: "This is too broad for a single game. A game works best when it targets 1-3 related skills." Suggest breaking into multiple games or a session, and offer to focus on one concept as a starting point. Do NOT produce a 200-concept game.

1d. **Check for session-level input.** If the input describes multiple games, a progression through different archetypes, or uses words like "session", "unit", "start with X then move to Y", recognize it as a session, NOT a single game. FLAG: "This describes a session of N games, not a single game." Produce a session plan with an ordered list of games, each with: suggested archetype, interaction type, Bloom level, and prerequisite dependencies. Note the Bloom progression (should be L1 -> L2 -> L3 -> L4 or similar logical ordering). Do NOT produce a single monolithic spec.

1e. **Check for mixed language.** If the input contains Hindi (or other non-English language) mixed with English, FLAG: "Hindi input detected. Spec will be generated in English." Add a suggestion: "Consider bilingual math vocabulary support if students are Hindi-medium." Proceed with spec generation in English using the understood content.

### Step 2: Identify the archetype

Match the input to one of the 10 Game Archetype Profiles:

| # | Profile | Key signals in input |
|---|---------|---------------------|
| 1 | MCQ Quiz | "quiz", "multiple choice", "choose", "select", no lives/timer mentioned |
| 2 | Speed Blitz | "timed", "speed", "fast", "blitz", countdown mentioned |
| 3 | Lives Challenge | "lives", rounds + lives, wrong = penalty, mixed input types |
| 4 | Sort/Classify | "sort", "classify", "drag", "categorize", "group" |
| 5 | Memory Match | "memory", "match", "pairs", "flip", "cards" |
| 6 | Board Puzzle | "puzzle", "grid", "board", "solve the board" |
| 7 | Construction | "build", "construct", "assemble", "expression", "sequence" |
| 8 | Worked Example | "worked example", "show steps", "faded", "step by step", "demonstrate" |
| 9 | No-Penalty Explorer | "explore", "no penalty", "learning mode", "practice" + Bloom L1-L2 |
| 10 | Tracking/Attention | "track", "attention", "flash", "keep track", "remember which" |

If the input does not clearly match any archetype:
- If it is close to one, assign it and note the adaptation needed.
- If it describes a genuinely novel interaction (e.g., "estimation on a number line"), flag it as non-standard: "Interaction type '[type]' is not one of the 10 standard types. Spec will define custom mechanics." Do NOT force it into MCQ or reject it.

If the input matches multiple archetypes, choose the one that best fits the primary interaction described and note the ambiguity.

### Step 2.5: Pick the flow shape

- Scan the description for rounds / questions / lives / stages / sections.
- **No rounds, single question, one-shot:** use Shape 1 Standalone from `alfred/skills/game-planning/reference/shapes.md`. Copy that mini-diagram verbatim into `## Flow`. Skip Step 2.6.
- **Anything rounds-based (default case):** copy the full ASCII diagram from `alfred/skills/game-planning/reference/default-flow.md` verbatim into the spec's `## Flow` section. This is the base.
- **Sectioned (`sections` or explicit groupings):** use default-flow.md as base, then Step 2.6 will layer the section-intro delta.
- Never hand-roll a flow diagram. Always start from one of these canonical bases.
- Record the pick on the `**Shape:**` line of the `## Flow` section.

### Step 2.6: Apply customizations on top of the default

- After pasting the default, scan the user description for customization triggers and match each against `alfred/skills/game-planning/reference/flow-gallery.md` rows 4–16.
- Apply each matched row as an **additive delta**: insert a step, add a conditional branch, rewrite a single label. Never rewrite the whole diagram.
- Example trigger → delta mappings:
  - "show a custom intro / story screen before the first round" → insert intro transition between Preview and Welcome.
  - "pep-talk every 3 rounds" / "mid-game encouragement" → insert conditional pep-talk transition between Feedback and the next Round-N intro.
  - "early exit if they get 3 in a row" / "bail-out at streak N" → add a conditional branch from Feedback to Victory.
  - "has sections / levels / chapters" → insert section-intro transition at each section boundary.
  - "custom play-again text" / "custom try-again copy" → rewrite the label inside the "Ready to improve your score?" box only.
  - "skip stars screen" / "no claim-stars" → delete the "Yay, stars collected!" branch and route Victory directly to exit.
- Record every applied delta as one bullet under `**Changes from default:**`. If no triggers fire, the default diagram stays unchanged and the bullet list reads "None".

### Step 3: Apply defaults for every unspecified decision

For EACH decision in the defaults table below, check whether the creator's input specifies a value. If not, apply the default. Track every default applied — you will list them in the "Defaults Applied" section.

| Decision | Default | How to check if creator specified it |
|----------|---------|--------------------------------------|
| Game structure | Rounds-based | Look for timer/lives/story/puzzle keywords |
| Interaction type | MCQ (single) | Look for drag/type/match/sort/build keywords |
| Scoring | +1 per correct, stars at 90%/66%/33% of total rounds | Look for custom scoring formula |
| Difficulty curve | 3 equal stages (easy/medium/hard) | Look for explicit stage definitions |
| Rounds | 9 (3 per stage) | Look for explicit round count |
| Lives | Infer from Bloom level: L1-L2 = 0 (no penalty), L3+ = 3 | Look for explicit lives count |
| Timer | None | Look for time/countdown/seconds keywords |
| Feedback style | playDynamicFeedback('correct'/'incorrect') via FeedbackManager | Look for custom feedback description |
| Content | fallbackContent (generated in Step 5) | Always generated |
| Bloom level | L2 Understand | Look for Bloom/remember/understand/apply/analyze keywords |
| Language | English | Look for language/Hindi keywords |
| Accessibility | Touch-only, 44px targets, contrast only | No further unless specified |
| Scaffolding | Show correct answer after wrong, auto-advance | Look for hint/retry keywords |

**Critical rule:** If the creator explicitly specifies a value for any decision, ALWAYS use the creator's value, even if it conflicts with defaults or guidelines. Never silently override. If the creator's choice conflicts with a guideline, add a WARNING but keep the creator's choice.

### Step 4: Check for guideline conflicts and generate warnings

Review the spec-in-progress for conflicts. Generate a WARNING for each:

- **Bloom-interaction mismatch:** If the Bloom level does not match the typical level for the chosen interaction (e.g., sorting is typically L2+ but creator said L1; worked examples are L2 but creator said L4).
- **Unusual round count:** If rounds > 12 or < 5, warn about session length.
- **Unusual lives count:** If lives > 5 or lives with L1-L2 Bloom level.
- **Timer + lives:** If both are specified, warn about difficulty compounding.
- **Scope concern:** If the content scope seems too broad for the round count.

Do NOT suppress warnings. Do NOT override the creator's choices to resolve warnings.

### Step 5: Generate round content

This is the most critical step. You must produce EVERY round, not a template or pattern.

5a. **Determine total rounds and stage assignments.**
- Use the creator's round count, or default (9).
- Divide into stages: Stage 1 gets ~33% of rounds, Stage 2 ~33%, Stage 3 ~34%. Adjust if the creator specified stage boundaries.

5b. **For each stage, define difficulty parameters.**
- What changes between stages? (number size, ratio complexity, operation type, number of steps, context familiarity)
- Be explicit: "Stage 1: multipliers are x2 and x3, ratios include 1 as a component" not "Stage 1: easy".

5c. **For each round, generate complete content.**
Every round must have:
- Round number and stage assignment
- Round type (if multiple types exist)
- The full question/scenario (not a placeholder like "similar to round 1")
- The correct answer
- All wrong answer options or distractor paths
- A misconception tag for EACH wrong answer/distractor (see Step 5d)
- The context/theme for this round

5d. **Assign misconception tags to every wrong answer.**
Each distractor must target a NAMED, REAL misconception — not a random wrong answer. Common math misconceptions include:
- `additive-reasoning` — adding instead of multiplying (e.g., 2:1 scaled to 6:? gives 5 instead of 3)
- `unit-confusion` — confusing units or positions
- `operation-reversal` — using the inverse operation
- `magnitude-error` — off by a factor of 10
- `numerator-denominator-swap` — flipping fraction components
- `sign-error` — wrong positive/negative
- `partial-application` — applying a rule to only part of the problem
- `overgeneralization` — applying a rule outside its valid domain
- `computation-error` — arithmetic mistake

Use misconception names that are specific to the math topic. Do not use generic tags like "wrong" or "other".

5e. **Build the fallbackContent structure.**
Produce the COMPLETE fallbackContent array with every round as a JavaScript object. Include all fields needed for the game engine to render the round without ambiguity. Every round object must include a `misconception_tags` mapping from each wrong answer to its misconception name.

### Step 6: Define scoring and feedback

6a. **Scoring formula.** Define exactly:
- Points per correct answer (default: +1)
- Star thresholds as exact numbers (not percentages), e.g., "3 stars = 9-10 correct, 2 stars = 6-8, 1 star = 1-5"
- Lives behavior: how many, what triggers loss, what happens at 0
- Partial credit rules, if any

6b. **Feedback table.** Define behavior for every game event:
- Correct answer (sound, visual, explanation)
- Wrong answer (sound, visual, show correct answer, misconception-specific hint if applicable)
- Last life lost / game over
- All rounds completed / results screen
- Any game-specific events (e.g., streak bonus, stage transition)

### Step 7: Assemble and verify

7a. **Assemble the full spec** using the output template above.

7b. **Verify completeness.** Check that ALL of these are present:
- [ ] Game Identity: name, one-line concept, target skills table
- [ ] Mechanics: every interaction type fully described (what student sees, does, what's correct, what feedback plays)
- [ ] Rounds/Progression: every round listed with stage, difficulty, content — no "etc." or "similar to above"
- [ ] Scoring: formula, star thresholds as exact numbers, lives rules
- [ ] Feedback: table with every event type
- [ ] Content Structure: full fallbackContent array with every round, misconception tags on every distractor
- [ ] Defaults Applied: every assumed default listed
- [ ] Warnings: every guideline conflict noted

7c. **Verify buildability.** Read through the spec as if you were an engineer implementing it. Flag any point where you would need to ask a clarifying question. If you find ambiguity, resolve it in the spec (and note it in Defaults Applied if you had to assume something).

7d. **Verify educational soundness.** Check that:
- Bloom level matches the cognitive demand of the interaction
- Difficulty genuinely progresses across stages (not just "harder" — specify HOW)
- Misconception tags target real, documented misconceptions for this math topic
- Content is appropriate for the stated grade level

## Constraints

1. **CRITICAL — Must map to an archetype.** Every spec must identify which of the 10 archetypes it corresponds to (or explicitly flag a custom archetype).
   - WRONG: `## Identity` section with no `Archetype:` field, or `Archetype: Custom` with no explanation of what the custom interaction is.

2. **CRITICAL — Must have misconception tags.** Every wrong answer path in every round must have a named misconception tag. No exceptions.
   - WRONG: `options: [12, 15, 18, 20], correct: 15` with no misconception_tags object mapping 12/18/20 to named misconceptions.

3. **CRITICAL — Must be buildable.** An engineer reading the spec must be able to implement the game without asking a single clarifying question. No vague phrases like "rounds get harder", "appropriate difficulty", "similar questions", or "etc."
   - WRONG: `Stage 2: Rounds 4-6, medium difficulty, harder ratios` — does not specify what "harder" means (larger multipliers? non-unit ratios? multi-step?).

4. **STANDARD — Must flag defaults.** Every decision filled by a default must be listed in the "Defaults Applied" section so the creator knows what was assumed.

5. **CRITICAL — Must not override creator choices.** If the creator specifies lives=5, the spec has lives=5, even if the default is 3. Add a WARNING if it conflicts with guidelines, but keep the creator's value.
   - WRONG: Creator says "I want 5 lives" and the spec says `Lives: 3` because the default is 3 and 5 "seems too many."

6. **STANDARD — Must be math only.** If the input describes a non-math game, flag it and do not produce a spec.

7. **STANDARD — Must be single-game scoped.** If the input describes multiple games or a session, flag it and produce a session plan instead of a monolithic spec.

8. **CRITICAL — Must include complete fallbackContent.** The content structure section must contain the full array of round objects, not a partial example with "and so on."
   - WRONG: Three fully specified round objects followed by `// ... remaining 6 rounds follow the same pattern`.

## Defaults

The full defaults table, applied when the creator does not specify:

| Decision | Default | Rationale |
|----------|---------|-----------|
| Game structure | Rounds-based | Most common, simplest to build |
| Interaction type | MCQ (single) | Most proven, lowest build risk |
| Scoring | +1 per correct, stars at 90%/66%/33% | Standard across shipped games |
| Difficulty curve | 3 equal stages (easy/medium/hard) | Proven progression pattern |
| Rounds | 9 (3 per stage) | Sweet spot for engagement without fatigue |
| Lives | 0 if Bloom L1-L2, 3 if Bloom L3+ | L1-L2 is learning (no penalty), L3+ is application (stakes) |
| Timer | None | Timers increase anxiety, only add when speed is pedagogically relevant |
| Feedback style | FeedbackManager: playDynamicFeedback('correct'/'incorrect') | Platform standard, consistent UX |
| Bloom level | L2 Understand | Most common level for concept-building games |
| Language | English | Platform default |
| Accessibility | Touch-only, 44px min targets, sufficient contrast | Mobile-first platform constraints |
| Scaffolding | Show correct answer after wrong, auto-advance to next round | Standard corrective feedback pattern |

## Anti-patterns

1. **Do not override creator's explicit choices.** If the creator says "5 lives", do not change it to 3. Warn, but obey.
   - Bad: Creator says "I want a timer of 60 seconds per round." Spec says `Timer: None` because "timers increase anxiety."
   - Good: Spec says `Timer: 60 seconds per round`. Warnings section says `WARNING: Timer combined with lives may compound difficulty — confirm with creator.`

2. **Do not produce vague specs.** Every dimension of difficulty must be explicit.
   - Bad: `Stage 2: Medium difficulty. Ratios are harder.`
   - Good: `Stage 2: Multipliers x3-x4 (up from x2-x3). Ratios no longer include 1 as a component. Contexts shift from recipes to maps.`

3. **Do not skip content generation.** Every round must be fully specified with unique content.
   - Bad: `Rounds 4-7: similar to above but with larger numbers.`
   - Good: Each of rounds 4-7 written out with specific question, correct answer, distractors, and misconception tags.

4. **Do not forget fallbackContent structure.** The spec must include the complete data shape with every round as a concrete object.
   - Bad: `// Rounds 4-9 follow the same structure as rounds 1-3 with increasing difficulty`
   - Good: All 9 round objects written out in full in the fallbackContent array.

5. **Do not use random wrong answers.** Every distractor must target a named, real misconception.
   - Bad: `options: [6, 8, 10, 12], correct: 8` with no misconception mapping.
   - Good: `options: [6, 8, 10, 12], correct: 8, misconception_tags: { "6": "additive-reasoning", "10": "magnitude-error", "12": "operation-reversal" }`

6. **Do not produce a spec for empty input.** Ask for more information.
   - Bad: Generating a generic MCQ spec when the creator sends an empty message.
   - Good: Responding with the clarification prompt from Step 1a.

7. **Do not produce a spec for non-math input.** Flag and refuse or ask for clarification.
   - Bad: Producing a "History Timeline Quiz" spec because the creator asked for a history game.
   - Good: Flagging "This describes a history game, not a math game" and asking for a math topic.

8. **Do not produce a single spec for session-level input.** Recognize it as a session and produce a session plan.
   - Bad: A single 30-round monolithic spec covering fractions, decimals, and percentages because the creator said "start with fractions then move to decimals then percentages."
   - Good: A session plan with 3 separate games, each with its own archetype, Bloom level, and dependency chain.

9. **Do not silently assume Bloom level.** If defaulting to L2, say so in Defaults Applied. Bloom level drives lives/penalty/feedback decisions — getting it wrong cascades.
   - Bad: Spec says `Bloom Level: L2` with no entry in Defaults Applied mentioning this was assumed.
   - Good: Defaults Applied section includes `- **Bloom Level**: defaulted to L2 Understand (creator did not specify)`.

10. **Do not forget the Warnings section.** Even if there are no warnings, include the section with "None" to confirm you checked.
    - Bad: Spec ends after Content Structure with no Warnings section.
    - Good: `## Warnings\nNone.`
