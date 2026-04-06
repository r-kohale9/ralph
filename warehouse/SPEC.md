# Game Spec — Warehouse Entry Point

> **This file is the router.** It tells the LLM how to navigate the warehouse and generate game-specific templates. It contains NO part code, NO rules — only navigation and pipeline logic.

---

## What This System Is

A **parts warehouse** for generating game HTML templates. Every component, pattern, rule, and contract is cataloged as an individual file. The LLM loads only what it needs per game.

**Two-stage generation:**

```
Stage 1: Warehouse + User Requirements → Game-Specific Template (assembly book)
Stage 2: Game-Specific Template → HTML File
```

---

## Directory Structure

```
game-spec/
├── SPEC.md                  ← YOU ARE HERE (router, ~100 lines)
├── parts/                   ← Component catalog (one file per part)
│   ├── manifest.json        ← Registry of all parts + capability matrix
│   └── PART-XXX-name.md     ← Self-contained part: code, rules, anti-patterns
├── rules/                   ← Universal rules (one file per rule)
│   ├── manifest.json        ← Registry of all rules
│   └── RULE-XXX-name.md     ← Self-contained rule: what, why, examples
├── contracts/               ← Machine-readable schemas (JSON)
│   ├── game-state.schema.json
│   ├── attempt.schema.json
│   ├── metrics.schema.json
│   ├── duration-data.schema.json
│   ├── postmessage-in.schema.json
│   ├── postmessage-out.schema.json
│   └── html-structure.json
└── templates/
    └── template-schema.md   ← The assembly book format (required sections)
```

---

## Stage 1: Generate a Game-Specific Template

Follow this exact sequence:

### Step 1 — Read the manifests

```
Read: parts/manifest.json    → See all available parts + capability matrix
Read: rules/manifest.json    → See all universal rules
```

### Step 2 — Extract user requirements

From the user prompt, determine:
- Game concept and mechanics
- Input method (tap, drag, type, mixed)
- Timer needed? (yes/no, type, duration)
- Stories/narrative? (yes/no)
- Validation type (fixed, function-based, LLM)
- Number of rounds
- Win/lose conditions
- Visual specifications
- Custom metrics
- Any custom game state fields

**If any required input is ambiguous, ask the user. Do not guess.**

### Step 3 — Select parts using capability matrix

Use `parts/manifest.json` → `capability_matrix` to determine which parts this game needs:

1. Start with `any_game` → gives all MANDATORY parts (including PART-039 Preview Screen, PART-017 Feedback, PART-025 ScreenLayout Component)
2. Always load `verification` → PART-026 (anti-patterns checklist)
3. Always load `post_gen` → PART-034, PART-035 (run after HTML generation)
4. **v2 mandatory components** (always included):
   - PART-023 (ProgressBar v2) — always included
   - PART-024 (TransitionScreen v2) — always included (welcome + results + audio)
   - PART-025 (ScreenLayout v2) — always included (sections API)
5. Check each conditional capability:
   - `has_timer` → adds PART-006
   - `has_stories` → adds PART-016
   - `has_fixed_validation` → adds PART-013
   - `has_function_validation` → adds PART-014
   - `has_llm_validation` → adds PART-015
   - `has_case_conversion` → adds PART-018
   - `is_story_only` → adds PART-029
   - `has_api_submission` → adds PART-031
   - `has_analytics` → adds PART-032
   - `has_drag_drop` / `has_grid_interaction` / `has_tag_input` → adds PART-033
   - `has_interaction_manager` → adds PART-038

> ⚠️ **Deprecated capability mappings:** `has_progress_bar` and `has_transition_screen` are no longer conditional — PART-023, PART-024, PART-025 are always included. ScreenLayout v1 `slots` API, standalone `#results-screen` divs, and manual `.page-center` layout HTML are deprecated.

### Step 4 — Load only the selected parts

Read ONLY the part files for parts selected in Step 3. Do NOT read parts that aren't needed.

```
For each selected part:
  Read: parts/PART-XXX-name.md
```

### Step 5 — Load contracts

```
Read: contracts/game-state.schema.json     → Know what gameState must look like
Read: contracts/metrics.schema.json        → Know what endGame metrics must contain
Read: contracts/attempt.schema.json        → Know what attempts must contain
```

Load additional contracts only if relevant:
- If timer: read `contracts/duration-data.schema.json`
- Always: read `contracts/postmessage-in.schema.json` and `contracts/postmessage-out.schema.json`

### Step 6 — Read all rules

```
Read: rules/manifest.json
For each rule:
  Read: rules/RULE-XXX-name.md
```

Rules are short (~20 lines each). Always load all of them.

### Step 7 — Generate the template

```
Read: templates/template-schema.md → The required format for the assembly book
```

Fill in every section of the template schema using:
- User requirements (from Step 2)
- Selected parts (from Step 3-4)
- Contracts (from Step 5)
- Rules (from Step 6)

Output the game-specific template to: `templates/{game-id}/spec.md`

---

## Stage 2: Generate HTML from Template

The game-specific template (`templates/{game-id}/spec.md`) is **self-contained**. It has:
- All code blocks needed (copied from parts)
- Game-specific logic filled in
- Exact function signatures
- Content structure with test data
- Verification checklist

The LLM reads ONLY this file and produces the HTML. No need to re-read the warehouse.

---

## Stage 3: Post-Generation Steps

After the HTML file is generated, run these mandatory steps:

### Step 1 — Extract Variable Schema (PART-034)

Analyze the generated HTML, extract the content structure (inputSchema) into a separate file:

```
Output: {game-directory}/inputSchema.json
```

Contains: schema definition, 3 example content sets at different difficulties, field mapping showing where each variable is used in the game code, and content constraints.

### Step 2 — Generate Test Plan (PART-035)

Analyze the generated HTML and produce a comprehensive test plan:

```
Output: {game-directory}/tests.md
```

Contains: 15 test categories covering page load, postMessage, game flow, validation, buttons, timer, visibility, metrics, results screen, layout containment, debug functions, error handling, CSS, game-specific tests, and structured Playwright test scenarios with exact user actions.

### Final Output Structure (before testing)

```
{game-directory}/
├── index.html          ← Stage 2 output
├── inputSchema.json    ← Stage 3 Step 1
└── tests.md            ← Stage 3 Step 2
```

---

## Stage 4: Automated Testing — Ralph Loop (PART-037)

After Stage 3, run the ralph loop to automatically test and fix the generated HTML:

```bash
./testing/ralph.sh {game-directory} templates/{game-id}/spec.md
```

The loop:
1. **Generate Playwright tests** — Claude reads the template's test scenarios (Section 14) + generated HTML → produces `tests/game.spec.js`
2. **Run tests** — `npx playwright test` executes all tests
3. **Fix loop** — If tests fail, Claude reads failures + fixes `index.html` (never the tests)
4. **Review** — When tests pass, Claude reviews HTML against the template checklist
5. **Approve or iterate** — Up to 5 iterations (configurable)

### Final Output Structure (after testing)

```
{game-directory}/
├── index.html          ← Tested & approved
├── inputSchema.json    ← From Stage 3
├── tests.md            ← Human-readable test plan
└── tests/
    ├── game.spec.js          ← Playwright tests
    ├── playwright.config.js  ← Config
    ├── test-helpers.js       ← Shared utilities
    ├── test-results.json     ← Last test run results
    └── test-output.txt       ← Console output
```

### Key Design Decisions

- **Tests are generated ONCE** then held fixed — prevents Claude from weakening tests instead of fixing code
- **Only `index.html` is modified** during fix iterations
- **Test helpers are shared** — common utilities in `test-helpers.js` ensure consistent testing patterns
- **Audio is mocked** — tests verify correct API calls, not actual audio playback

---

## Adding New Parts

1. Create `parts/PART-XXX-name.md` following the part file format
2. Add entry to `parts/manifest.json` → `parts` array
3. Add to `capability_matrix` if it maps to a capability
4. Add to `templates/template-schema.md` → parts table (as a new row)
5. If it has a contract, add to `contracts/`

## Adding New Rules

1. Create `rules/RULE-XXX-name.md` following the rule file format
2. Add entry to `rules/manifest.json`

---

## Context Budget

| Stage | What's loaded | Estimated tokens |
|-------|--------------|-----------------|
| Stage 1 | SPEC.md + manifests + selected parts + contracts + rules + template schema | ~3000-5000 |
| Stage 2 | Game-specific template only | ~1500-2500 |
| Stage 3 | Generated HTML + PART-034 + PART-035 instructions | ~2000-3000 |
| Stage 4 | Template + HTML + test-helpers.js (for test gen), then failures + HTML (for fixes) | ~2000-4000 per iteration |

The warehouse can grow to 100+ parts without affecting context usage — the LLM only loads what's needed.
