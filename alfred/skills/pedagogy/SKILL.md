# Skill: Pedagogy

## Tag conventions

Rules in this skill and its detail files are tagged:
- **`[MANDATORY]`** — must be enforced; spec-review FAILs if violated. Often tied to a hard validator or downstream contract.
- **`[SUGGESTED]`** — default behavior; spec-creation may include or omit based on creator intent. If creator description is silent on the topic, the rule may be applied silently. If creator description specifies a contradicting choice, defer to the creator. Suggestions land in the spec's "## Suggestions (require explicit creator approval)" section if added without creator request.

The faithful-translation boundary (spec-creation/SKILL.md § Faithful translation boundary) uses these tags to decide what may be silently added vs what must be flagged.

## Purpose

Encode the pedagogical knowledge that makes a game teach, not just test: Bloom-to-structure mapping, misconception-aware distractor design, difficulty calibration, scaffolding patterns, emotional safety, and Indian curriculum alignment.

## When to use

When designing a spec's Bloom level, misconception distractors, difficulty progression, scaffolding pattern, or emotional tone. Consult before assigning any Bloom level or writing any distractor.

## Owner

Maintainer: Education slot.
Deletion trigger: retire when pedagogy rules move into a validated ML model that replaces spec-time design decisions.

## Reads

- `skills/game-archetypes.md` -- ALWAYS (archetype profiles this skill references; canonical source for scoring thresholds and star breakpoints)
- `skills-taxonomy.md` sections 1.6, 5.3, 5.4, 8.2, 8.3, 8.9 -- ON-DEMAND (background rationale)
- `reviews/skills-review.md` section H (Pedagogy Expert gaps) -- ON-DEMAND (known gaps to address)

## Detail Files

| File | Contents |
|------|----------|
| [bloom-mapping.md](bloom-mapping.md) | Full Bloom-to-game mapping (L1-L4): structure, interaction, scoring, feedback, scaffolding, pacing per level |
| [misconceptions.md](misconceptions.md) | Misconception taxonomy (30+ named misconceptions across 5 domains), distractor design process, template |
| [difficulty-tuning.md](difficulty-tuning.md) | 70-85% target, stage targets, domain-specific difficulty axes, adaptive difficulty |
| [scaffolding.md](scaffolding.md) | Scaffolding patterns per Bloom level, trigger conditions, scoring impact, scaffolding vs hints vs feedback |
| [emotional-safety.md](emotional-safety.md) | Game-over language, failure recovery patterns, tone per Bloom level |
| [indian-curriculum.md](indian-curriculum.md) | NCERT/CBSE mapping, regional boards, Hindi-English math vocabulary |

## Input

A game spec (or draft spec) containing: topic, target class, Bloom level (optional), math domain, interaction type (optional), content samples.

## Output

Pedagogical parameters for the game:
- Bloom level (confirmed or inferred)
- Game structure recommendation (from Bloom-to-game table)
- Scaffolding pattern
- Lives/scoring policy
- Feedback style and tone
- Difficulty curve specification
- Misconception map for distractors
- Emotional safety language

These parameters feed into `spec-creation.md`, `spec-review.md`, and `game-building.md`.

---

## Procedure

### Step 1: Determine Bloom level

If the spec states a Bloom level, use it. If not, infer from the verb:

| Verb in spec | Bloom level |
|-------------|-------------|
| identify, name, list, recall, recognize, state, define | L1 Remember |
| explain, describe, classify, compare, summarize, distinguish, interpret | L2 Understand |
| solve, calculate, apply, use, compute, find, determine, construct | L3 Apply |
| analyze, compare-contrast, categorize, examine, deduce, infer, justify | L4 Analyze |

If ambiguous, default to **L2 Understand** (pipeline default from skills-taxonomy.md).

### Step 2: Verify Bloom-interaction compatibility

**[MANDATORY]** Check that the stated (or inferred) Bloom level is compatible with the spec's interaction type. If they conflict, emit a WARNING and recommend a correction.

| Bloom level | Compatible interactions | Incompatible interactions (WARNING) |
|-------------|----------------------|-------------------------------------|
| L1 Remember | MCQ single-select, click-to-match, tap-to-select | Drag-and-drop sorting, construction/build, multi-step input, open-ended text entry |
| L2 Understand | MCQ single-select, drag-and-drop (sorting), multi-select | Number input, build-from-parts, step-reveal |
| L3 Apply | Number input, build-from-parts, MCQ (multi-step), step-reveal | Click-to-match, memory match (pure recall) |
| L4 Analyze | Multi-select, drag-and-drop (complex), click-to-select (board), construction | MCQ single-select (simple), speed/timed drills |

When a mismatch is detected, include in the output:
```
WARNING: Bloom-interaction mismatch
  Stated Bloom: [level]
  Interaction: [type]
  Conflict: [why these are incompatible]
  Recommendation: [upgrade Bloom to X] or [change interaction to Y]
```

### Step 3: Look up Bloom-to-game mapping -- see [bloom-mapping.md](bloom-mapping.md)

### Step 4: Design misconception-aware distractors -- see [misconceptions.md](misconceptions.md)

### Step 5: Set difficulty curve -- see [difficulty-tuning.md](difficulty-tuning.md)

### Step 6: Select scaffolding pattern -- see [scaffolding.md](scaffolding.md)

### Step 7: Apply emotional safety rules -- see [emotional-safety.md](emotional-safety.md)

### Step 8: Verify Indian curriculum alignment -- see [indian-curriculum.md](indian-curriculum.md)

---

## Bloom Level Quick-Reference (Lookup Table)

| Parameter | L1 Remember | L2 Understand | L3 Apply | L4 Analyze |
|-----------|------------|---------------|----------|------------|
| Structures | MCQ Quiz, Speed Blitz, Memory Match | MCQ Quiz, Sort/Classify, No-Penalty Explorer | Lives Challenge, Construction, Worked Example | Board Puzzle, Sort/Classify (complex), Construction |
| Interaction | MCQ single-select, click-to-match | MCQ, drag-and-drop (sorting), multi-select | Number input, build-from-parts, step-reveal | Multi-select, drag-and-drop (complex), board |
| Lives | None | None or 5 | 3 | None or 5 |
| Feedback | Show answer | Explain why | Show procedure step | Ask-back, then show reasoning |
| Scaffolding trigger | Immediate reveal | After 1 wrong: hint. After 2: reveal | After 1: nudge. After 2: first step. After 3: full solution | After 1: metacognitive. After 2: narrow scope. After 3: full analysis |
| Full reveal after | 1 wrong | 2 wrong | 3 wrong | 3 wrong |
| Pacing (sec/question) | 3-5 | 8-15 | 15-30 | 30-60 |
| Rounds | 9-15 | 9 | 6-9 | 6 |
| Difficulty axis | Confusability | Ambiguity | Procedural steps | Dimensional complexity |
| Star thresholds | See `game-archetypes.md` | See `game-archetypes.md` | See `game-archetypes.md` | See `game-archetypes.md` |
| Penalty for wrong | None | None (or reduced retry) | -1 life | None |
| Correct tone | Celebratory | Warm | Affirming | Respectful |
| Wrong tone | Matter-of-fact | Gentle redirect | Procedural | Curious |
| Game-over tone | "Nice practice!" | "Good thinking!" | "Solid effort." | "Those were tough!" |

---

## Constraints

1. **[MANDATORY] Every distractor must have a misconception tag.** No tag = random wrong answer = reject.
2. **[SUGGESTED] Never use lives at L1 or L2 by default.** Only with explicit spec justification. (Tagging note: pedagogical default; creators may specify lives at any Bloom level if justified, so this is overridable rather than a hard gate.)
3. **[SUGGESTED] 70-85% success rate target is a design constraint,** not post-hoc observation.
4. **[SUGGESTED] Scaffolding must trigger after at most 3 wrong attempts.**
5. **[MANDATORY] Game-over language must never use "fail," "lose," or "game over."**
6. **[SUGGESTED] Every game spec must reference an NCERT chapter.** (Tagging note: no hard validator enforces this; defaulting to SUGGESTED so creator-specified non-NCERT boards or chapter-less practice games aren't blocked.)
7. **[SUGGESTED] Hindi vocabulary bridges recommended for Class 4-6.**

## Defaults

| Parameter | Default | Override trigger |
|-----------|---------|-----------------|
| Bloom level | L2 Understand | Spec contains explicit Bloom keyword |
| Lives | 0 (no penalty) | Spec says "lives" or Bloom is L3+ |
| Scaffolding | Show answer after 2 wrong | Spec says "hint" or "retry" |
| Difficulty stages | 3 (easy/medium/hard) | Spec defines explicit stages |
| Success rate target | 75% first-attempt | Spec defines custom target |
| Distractor design | Misconception-aware (required) | Never overridden |
| Game-over language | "Good effort! Let's try again!" | Spec provides custom language |
| Feedback style | Corrective with explanation | L1 overrides to show-answer-only |
| Hindi bridges | Off | Spec targets Class 4-6 or says "bilingual" |
| Curriculum reference | NCERT/CBSE | Spec names a different board |

## Anti-patterns

1. **Random distractors.** Never generate wrong answers by adding/subtracting a random number. Every wrong answer must trace to a named misconception.
2. **Uniform difficulty.** Never make all rounds the same difficulty. Flat success rate = broken curve.
3. **Punishment disguised as pedagogy.** "You should study more" is blame, not feedback.
4. **Overcrowded screens.** Show what's needed for the current moment, not everything at once.
5. **Feedback that just says "Wrong."** Even at L1, show the correct answer.
6. **Ignoring prerequisite gaps.** 5 consecutive wrong = game is too hard right now.
7. **Translating English to Hindi literally.** Math vocab doesn't translate 1:1.
8. **Designing L4 games as fast-paced drills.** Analysis requires time, not speed.
