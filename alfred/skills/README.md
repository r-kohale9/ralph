# Skills

A skill is an .md file that Claude reads before doing a task. Skills are the pipeline's knowledge — they replace code with instructions.

## Structure

```
skills/
  README.md                  ← this file (framework)
  spec-creation.md           ← skill: generate a spec from a game description
  spec-review.md             ← skill: validate a spec against guidelines
  game-planning.md           ← skill: generate pre-generation plan from spec
  game-building.md           ← skill: generate HTML game from spec + plan
  game-testing.md            ← skill: test game using Playwright MCP
  ...
  evals/
    spec-creation.eval.md    ← eval: test cases for spec-creation skill
    spec-review.eval.md      ← eval: test cases for spec-review skill
    ...
    fixtures/                ← shared test inputs (sample specs, sample HTML, sample descriptions)
      sample-ratio-game.txt  ← game description input
      sample-spec.md         ← spec output for chain testing
      sample-game.html       ← HTML for testing downstream skills
```

Each skill has a corresponding eval file in `evals/`.

---

## Skill Format

Every skill .md follows this structure:

```markdown
# Skill: [Name]

## Purpose
What this skill does in one sentence.

## When to use
Trigger condition: when this skill applies.
E.g., "Before generating HTML from a spec" or "When a build fails contract validation."

## Owner
Who maintains this skill (person or process). When to retire it.

## Priority
Mark each constraint/rule as:
- CRITICAL — violation = broken game or lost data
- STANDARD — violation = lower quality, fixable
- ADVISORY — best practice, not enforced

## Reads
What other files/skills this skill needs as context.
Mark each as: ALWAYS (load with skill) or ON-DEMAND (load only when relevant section needed).

## Input
What the skill receives (e.g., game description, spec, HTML file).

## Output
What the skill produces (e.g., spec.md, pre-generation/, index.html).
Include the output schema/structure so the next skill in the chain knows what to expect.

## Procedure
Step-by-step instructions Claude follows.

## Constraints
Hard rules that must never be violated. Each marked CRITICAL/STANDARD/ADVISORY.
Non-trivial rules include one positive and one negative example.

## Defaults
What to assume when the input doesn't specify something.

## Anti-patterns
What to never do. Each with a concrete negative example.
```

Governed by: `alfred/principles/knowledgebase.md` (14 principles).

**Principles compliance notes:**
- #1 Single source: link to canonical location, never restate values from other skills
- #5 Weighted: every rule marked CRITICAL/STANDARD/ADVISORY
- #7 Trigger-scoped: `## When to use` section required
- #10 Example-anchored: non-trivial rules need positive + negative examples
- #12 Owned: `## Owner` section required
- #14 Token-budget-aware: `## Reads` marks each dependency ALWAYS or ON-DEMAND

---

## Eval Format

Every eval .md follows this structure:

```markdown
# Eval: [Skill Name]

## Version
v1 — YYYY-MM-DD — initial cases
v2 — YYYY-MM-DD — added edge cases for X (reason)

## Setup
Context files that must be loaded before running:
- skills/game-archetypes.md
- skills/pedagogy/SKILL.md
- (list all dependencies)

## Success Criteria
What "this skill works" looks like — measurable, observable.

## Ship-Readiness Gate
All P0 cases must PASS. All P1 cases must PASS or PARTIAL with documented reason.

## Cases

### Case 1: [Name]
**Priority:** P0
**Type:** happy-path | edge-case | error-handling | default-behavior | cross-skill | negative
**Judge:** auto | llm | human
**Input:** [The input to the skill]
**Expect:**
- [ ] Concrete, independently checkable assertion 1
- [ ] Concrete, independently checkable assertion 2
- [ ] Concrete, independently checkable assertion 3
**Why:** [What this case tests]
```

### Expect Format Rules

Each expect item is one independently checkable assertion. Use checklist format, not prose.

- **auto-checkable:** structural checks (section exists, field present, value matches). Write as: `- [ ] Output contains section "## Scoring"`
- **llm-checkable:** semantic checks (content is reasonable, pedagogically sound). Write as: `- [ ] [LLM] Distractors target real misconceptions, not random wrong answers`
- **human-checkable:** subjective quality (fun, engaging, clear). Write as: `- [ ] [HUMAN] Game description is clear to a Class 5 student`

### Priority Definitions

| Priority | Meaning | Ship gate |
|----------|---------|-----------|
| P0 | Core functionality. If this fails, the skill is broken. | Must PASS |
| P1 | Important edge case. If this fails, some inputs produce bad output. | Must PASS or PARTIAL |
| P2 | Aspirational. Nice to have, not blocking. | No gate |

---

## How to Run an Eval

### Manual (current)

1. Load the skill: read `skills/<name>.md`
2. Load the setup files listed in the eval
3. For each case in `skills/evals/<name>.eval.md`:
   - Feed the case input to Claude with the skill loaded
   - Check each assertion in the Expect checklist
   - Mark each assertion pass/fail
   - Record case result: PASS (all assertions pass), PARTIAL (some fail), FAIL (critical assertions fail)
4. Record results with timestamp

### Automated (target)

A runner that:
1. Loads skill + setup files
2. For each case: calls Claude API with input
3. Runs auto-check assertions (regex, structure checks)
4. For LLM-check assertions: calls Claude with rubric + output, gets PASS/FAIL
5. For human-check assertions: queues for human review
6. Writes results to `skills/evals/results/<skill>-<timestamp>.json`
7. Diffs against last run, flags regressions

---

## How to Develop a Skill

1. **Write the eval FIRST** (what does success look like?)
2. Write the skill (instructions that produce passing outputs)
3. Run the eval
4. If cases fail, update the skill (not the eval — unless the expectation was wrong)
5. When a new failure is discovered in production, add a case to the eval, then fix the skill

This is test-driven skill development. The eval is the spec. The skill is the implementation.

---

## Coverage Matrix

| Skill | Eval? | Cases | P0 | P1 | Status |
|-------|-------|-------|-----|-----|--------|
| game-archetypes | Yes | 5 | — | — | Verifying |
| data-contract | Yes | 5 | — | — | Verifying |
| mobile | Yes | 5 | — | — | Verifying |
| pedagogy | Yes | 5 | — | — | Verifying |
| feedback | Yes | 5 | — | — | Verifying |
| signal-collector | Yes | 8 | 5 | 3 | New |
| subjective-evaluation | Yes | 10 | 5 | 5 | New |
| spec-creation | Yes | 10 | — | — | Verifying |
| spec-review | Yes (skill) | — | — | — | Eval needed |
| game-planning | Yes (skill) | — | — | — | Eval needed |
| game-building | Yes (skill) | — | — | — | Eval needed |
| game-testing | Yes (skill) | — | — | — | Eval needed |
| deployment | Yes (skill) | — | — | — | Eval needed |
| gauge | Yes (skill) | — | — | — | Eval needed |
| visual-review | Yes (skill) | — | — | — | Eval needed |
| final-review | Yes (skill) | — | — | — | Eval needed |
| game-review | No | — | — | — | Skill + eval needed |
| iteration | No | — | — | — | Skill + eval needed |
| session-design | No | — | — | — | Skill + eval needed |

**Skills: 16/19 written. Evals: 8/19 written. Coverage: 42%.**

---

## Ship-Readiness Definition

The pipeline is ready to ship when:

1. **All core-pipeline skills have evals:** spec-creation, spec-review, game-planning, game-building, game-testing, deployment (6 skills)
2. **All P0 cases pass** across core-pipeline skills
3. **All P1 cases pass or are PARTIAL** with documented known limitations
4. **At least one E2E eval passes:** description → spec → plan → HTML → test → deploy chain produces a working game
5. **No P0 regression** from previous run

---

## Eval Types

### Unit evals (per-skill)

Test one skill in isolation. Input → skill → output matches expectations.

### Chain evals (cross-skill)

Test the handoff between skills. Output of skill A fed as input to skill B.

| Chain | Tests |
|-------|-------|
| spec-creation → spec-review | Does spec-review accept spec-creation output? |
| spec-creation → game-planning | Does game-planning consume the spec correctly? |
| game-planning → game-building | Does the plan translate into correct HTML structure? |
| game-building → game-testing | Does the built game pass the test suite? |

### E2E evals

Test the full pipeline. Game description in → deployed game URL out.

| E2E | Input | Expect |
|-----|-------|--------|
| MCQ Quiz | "Make a fractions MCQ for Class 6" | Playable game at URL, all P0 test cases pass, data contract valid |
| Lives Challenge | "Make a ratio game with 3 lives" | Playable game with lives system, correct game_complete postMessage |
| Worked Example | "Make a quadratic formula walkthrough" | 3-phase game, no lives, per-step feedback |

---

## Skill Dependency Order

From `skills-taxonomy.md` DAG:

```
Foundation (write first — referenced by everything):
  game-archetypes.md      ← 10 profiles, everything references these
  data-contract.md        ← recordAttempt + game_complete schemas
  mobile.md               ← device constraints
  pedagogy.md             ← Bloom mapping, misconception design
  feedback.md             ← FeedbackManager patterns per Bloom level

Core (write next — the pipeline steps):
  spec-creation.md        ← reads archetypes, pedagogy, defaults
  spec-review.md          ← reads all foundation skills as checklist
  game-planning.md        ← reads archetypes, spec-creation output
  game-building.md        ← reads archetypes, mobile, data-contract, feedback
  game-testing.md         ← reads data-contract (what to verify)

Deployment + Gauge (write last):
  deployment.md           ← reads data-contract (health check criteria)
  gauge.md                ← reads data-contract (what data to query)
  iteration.md            ← reads all (decides what to change)
  session-design.md       ← reads pedagogy, archetypes (curriculum level)
```

---

## Evals Needed (with case names)

### Foundation skills

**game-archetypes.eval.md**
- P0: Lookup MCQ Quiz profile (standard archetype)
- P0: Lookup Lives Challenge profile (common archetype)
- P1: Input doesn't match any archetype (custom game)
- P1: Input matches multiple archetypes (disambiguation)

**data-contract.eval.md**
- P0: Valid recordAttempt with all required fields
- P0: game_complete event with nested data.metrics structure
- P0: Missing required field detected
- P1: Extra fields preserved (forward compatibility)

**mobile.eval.md**
- P0: Touch target minimum 44px enforced
- P0: Viewport meta tag present and correct
- P1: Safe area insets handled
- P1: Keyboard doesn't cover question area

**pedagogy.eval.md**
- P0: Bloom L2 maps to no-penalty + guided feedback
- P0: Bloom L3 maps to lives + corrective feedback
- P1: Misconception taxonomy for fractions produces valid distractors
- P1: Difficulty progression follows Bloom progression

**feedback.eval.md**
- P0: Correct answer triggers playDynamicFeedback('correct')
- P0: Wrong answer at L2 includes explanation
- P1: Streak of 3+ wrongs triggers encouragement change
- P1: Game-over feedback is encouraging not punitive

### Core skills

**spec-creation.eval.md** — exists (7 cases + 3 pending)

**spec-review.eval.md**
- P0: Valid spec passes review
- P0: Missing required section detected
- P0: Bloom-interaction mismatch flagged
- P1: Spec with all defaults passes but flags them

**game-planning.eval.md**
- P0: Plan from MCQ Quiz spec has correct screen flow
- P0: Plan from Worked Example spec has 3 phases
- P1: Plan with custom interaction adapts structure
- P1: Plan includes round presentation sequence

**game-building.eval.md**
- P0: HTML has data-contract compliance (gameState, syncDOM, postMessage)
- P0: CDN scripts loaded in correct order
- P0: Mobile viewport and touch targets
- P0: FeedbackManager integration (not custom overlays)
- P1: Fallback content present and valid
- P1: recordAttempt includes all required fields from data-contract

**game-testing.eval.md**
- P0: All 5 test categories covered (game-flow, mechanics, level-progression, edge-cases, contract)
- P0: Game completes start-to-finish without errors
- P1: Wrong answer path tested (not just correct)
- P1: Replay tested (no leaked state)

### Deployment + Gauge

**deployment.eval.md**
- P0: Game uploads and URL is reachable
- P0: Content sets created and linked
- P1: Health check passes after deploy

**gauge.eval.md**
- P0: Per-round accuracy query returns data
- P0: Top misconception query returns ranked list
- P1: Abandonment rate calculable from data

**visual-review.eval.md**
- P0: Screenshot captures all game phases (start, gameplay, end)
- P0: Layout issues detected (overflow, overlap, cut-off text)
- P1: Mobile responsiveness verified across breakpoints
- P1: Accessibility contrast issues flagged

**final-review.eval.md**
- P0: All prior review outputs aggregated into single pass/fail
- P0: Blocking issues prevent approval
- P1: Non-blocking issues documented but don't block
- P1: Review summary references specific skill outputs

**iteration.eval.md**
- P0: Content-only change produces new content set (no HTML rebuild)
- P0: Spec change triggers full rebuild
- P1: Insight-to-action recommendation is specific and actionable
