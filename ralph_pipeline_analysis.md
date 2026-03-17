# Ralph Pipeline — Production Readiness Analysis

**Date:** March 13, 2026
**Scope:** Constraints, TODOs, enhancements, and full-flow integration for `ralph.sh`

---

## Where Ralph Sits in the Full Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  HUMAN AUTHORING PHASE (Claude Desktop)                             │
│                                                                     │
│  1. Open Claude Desktop                                             │
│  2. Request spec for a game (e.g. "write a spec for Doubles")       │
│  3. Claude loads game-builder skill + warehouse                     │
│  4. Iterate: human reviews, refines, challenges                     │
│  5. Test logic via artifact builder (playable preview in chat)      │
│  6. Publish spec → warehouse/templates/{game-id}/spec.md            │
│                                                                     │
│  OUTPUT: A reviewed, iterated, human-approved spec.md               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RALPH (Automated Pipeline — runs in background)                    │
│                                                                     │
│  INPUT: spec.md + game directory path                               │
│                                                                     │
│  Step 1: Generate HTML from spec (claude -p, one-shot)              │
│  Step 2: Generate Playwright tests from spec + HTML (claude -p)     │
│  Step 3: Test → Fix loop (up to N iterations)                       │
│          - Run Playwright                                           │
│          - If fail: Claude fixes HTML (not tests)                   │
│          - If pass: Claude reviews against checklist                │
│          - If APPROVED: exit 0                                      │
│                                                                     │
│  OUTPUT: Validated index.html + passing test suite                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT (not yet built)                                         │
│                                                                     │
│  - Register artifact in template registry                           │
│  - Version and store (git or artifact store)                        │
│  - Generate inputSchema.json (POST_GEN: PART-034)                   │
│  - Content Generator (P3) can now fill this template                │
│  - Session Planner (P9) can now select this template                │
└─────────────────────────────────────────────────────────────────────┘
```

Ralph is the **automation layer for Power 2 (Template Builder)**. It replaces the current POC workflow (manual Claude conversation with game-builder skill) with a headless, repeatable pipeline. The architecture decision doc chose Option A (simple script) with smart retry — Ralph is the first implementation of that decision, using Claude CLI as the generation/fix engine instead of the Claude API directly.

---

## Current Constraints (What Ralph Cannot Do Today)

### C1 — No warehouse integration

Ralph passes the raw spec.md to `claude -p` and says "follow the template exactly." It does not run the warehouse's SPEC.md router, does not load parts via the capability matrix, does not resolve dependencies. The generation prompt is essentially "read the spec, write the HTML" — which means Claude is inferring the warehouse structure from whatever the spec references, rather than following the deterministic context assembly that the pipeline orchestration doc specifies as Stage 1.

**Impact:** Generation quality depends entirely on how self-contained the spec is. For the 13-section specs written against the warehouse template schema, this mostly works because the spec is designed to be self-contained. But it means Ralph can't enforce that the correct parts were loaded, can't verify dependency closure, and can't catch spec-warehouse mismatches.

### C2 — Tests are LLM-generated, not contract-derived

Ralph asks Claude to generate tests by reading the HTML + spec. The test generation prompt is thorough (8 mandatory categories), but the tests are still a Claude interpretation of what should be tested — not a deterministic derivation from the warehouse contracts.

The pipeline orchestration doc envisions a 3-layer validation: static checks (deterministic HTML structure), contract checks (JSON schema validation against `game-state.schema.json`, `metrics.schema.json`, etc.), and functional checks (Playwright). Ralph only does the third layer, and it's LLM-generated rather than contract-derived.

**Impact:** Tests may miss contract violations. Two runs of Ralph on the same spec may generate different test suites. There's no guarantee that the 7 warehouse contracts are actually enforced.

### C3 — No static or contract validation layers

Related to C2: the pipeline orchestration doc describes a `validate()` function with 3 sequential layers where each gates the next (static → contract → functional). Ralph skips straight to functional (Playwright), which is the most expensive and slowest layer. Many failures that could be caught in milliseconds by checking HTML structure or JSON schemas instead burn a full Playwright cycle.

### C4 — Single-game, sequential only

Ralph processes one game at a time. The orchestration doc identifies games as "embarrassingly parallel" (independent specs, no shared state), but Ralph has no parallelism. Running 47 templates through Ralph means 47 sequential executions.

### C5 — No structured output from pipeline

Ralph's exit codes are 0 (approved) or 1 (failed/exhausted). There's no structured report — no JSON summary of what passed, what failed, how many iterations it took, what the review found, cost estimate, or token usage. The log file is append-only prose.

### C6 — Claude CLI dependency

Ralph shells out to `claude -p` (Claude Code CLI). This works but is a different execution model from the pipeline orchestration doc's recommendation of direct Claude API calls. CLI invocations have overhead (process spawn, CLI initialization), can't easily pass structured parameters, and output is unstructured text. There's also no control over token limits, temperature, or system prompts beyond what `claude -p` exposes.

### C7 — Web server lifecycle is implicit

Ralph copies `playwright.config.js` into the test directory, which presumably configures a `baseURL` of `http://localhost:8787`. But Ralph never explicitly starts or stops a web server. It installs `serve` as a dev dependency but doesn't use it in the script. Either the Playwright config has a `webServer` block handling this, or there's a silent dependency on a server already running.

### C8 — No inputSchema.json generation

The warehouse's POST_GEN step (PART-034) serializes the inputSchema from the spec's Section 4. Ralph doesn't produce this. A generated game without its inputSchema can't receive content from the Content Generator (P3).

### C9 — No event schema validation

The warehouse readiness doc calls out that every game emits events per a defined schema (Section 9 of the template). Ralph doesn't verify that the generated HTML actually emits the correct events with the correct shapes. This is critical for P4 (Event Capture) — if the game emits malformed events, the entire measurement layer downstream breaks.

### C10 — Model configuration mismatch

The comment says "Use Sonnet for fast fix/review calls" but `FAST_MODEL` defaults to `claude-opus-4-6`. Either the comment is stale or the default is wrong. At 47 templates × 5 iterations × multiple fix calls, this cost difference is significant.

---

## TODOs — Minimum for Production Reliability

### T1 — Add static validation layer (pre-Playwright)

Before running Playwright, run deterministic checks against the generated HTML:

- Required DOM elements exist (`#gameContent`, `#gameArea`, buttons per `html-structure.json`)
- Required global functions exist (`initGame`, `checkAnswer`, `endGame`, etc.)
- Forbidden patterns absent (no `document.write`, no inline event handlers per warehouse rules)
- `<style>` and `<script>` blocks present (single-file constraint)
- CSS: no hardcoded colors that violate the design system

This is a Node.js script, not an LLM call. Runs in <1 second. Catches ~40% of failures before burning a Playwright cycle.

### T2 — Add contract validation layer

Parse the generated HTML's JavaScript and validate:

- `gameState` initialization matches `game-state.schema.json` (9 required fields)
- `recordAttempt()` output matches `attempt.schema.json`
- `endGame()` output matches `metrics.schema.json`
- `postMessage` payloads match `postmessage-out.schema.json`
- Star thresholds are 80/50/1/0 (not 90/70 or anything else)

This is JSON Schema validation on extracted code patterns. Deterministic, fast, high-signal.

### T3 — Start/stop web server explicitly

Add explicit server lifecycle to the test loop:

```bash
# Start server before tests
npx serve "$GAME_DIR" -l 8787 -s &
SERVER_PID=$!
sleep 1  # wait for startup

# ... run tests ...

# Kill server after tests
kill $SERVER_PID 2>/dev/null
```

Or confirm that the Playwright config's `webServer` block handles this and document the dependency.

### T4 — Produce structured output

Ralph should write a `ralph-report.json` alongside the log:

```json
{
  "spec": "templates/queens/spec.md",
  "status": "APPROVED",
  "iterations": 2,
  "generation_time_s": 45,
  "total_time_s": 180,
  "test_results": [
    {"iteration": 1, "passed": 18, "failed": 3, "failures": [...]},
    {"iteration": 2, "passed": 21, "failed": 0}
  ],
  "review_result": "APPROVED",
  "artifacts": ["index.html"],
  "missing_artifacts": ["inputSchema.json"]
}
```

### T5 — Fix the model default

Either change `FAST_MODEL` default to Sonnet or update the comment. For production runs across 47 templates, Sonnet for fix/review calls is the right cost tradeoff. Opus for generation is justified (the one-shot needs to be high quality).

### T6 — Add inputSchema.json generation

After HTML generation passes, run the POST_GEN step to serialize `inputSchema.json` from the spec's Section 4. This is what the Content Generator (P3) reads to know what content shape this template accepts.

### T7 — Add timeout guards

Claude CLI calls have no timeout. A hung `claude -p` call blocks the entire pipeline forever. Add:

```bash
timeout 300 claude -p "$PROMPT" $EXTRA_ARGS  # 5 min max per call
```

And for Playwright:

```bash
timeout 120 npx playwright test ...  # 2 min max per test run
```

### T8 — Clean up temp files on exit

Ralph creates `.ralph-claude-output-$$` files and doesn't clean them up on interrupted runs. Add a trap:

```bash
trap 'rm -f "$GAME_DIR"/.ralph-claude-output-*; kill $SERVER_PID 2>/dev/null' EXIT INT TERM
```

### T9 — Validate spec exists and has expected structure

Before doing anything, verify that the spec.md has the expected 13-section structure. A quick grep for `## 1.`, `## 2.`, ... `## 13.` catches truncated or malformed specs before burning an Opus generation call.

---

## Enhancements — Scalability and Intelligence

### E1 — Parallel batch runner

Wrap Ralph in a batch script that runs N games concurrently:

```bash
# batch-ralph.sh
MAX_PARALLEL=${MAX_PARALLEL:-4}
find warehouse/templates/*/spec.md | xargs -P $MAX_PARALLEL -I {} \
  ./ralph.sh "$(dirname {})/game" "{}"
```

Games are independent — no shared state, no coordination needed. This is the "embarrassingly parallel" property from the orchestration doc.

### E2 — Smart retry escalation (from orchestration doc)

Ralph currently uses the same fix strategy every iteration. The orchestration doc specifies escalating retry:

- **Attempt 1:** Re-generate (LLM non-determinism may fix it)
- **Attempt 2:** Append specific validation errors to prompt
- **Attempt 3:** Ask Claude to diagnose root cause, then fix

Ralph already does attempt 2 in every fix call but doesn't escalate. On iteration 3+, the fix prompt should include the full history of what's been tried and why it keeps failing — this is the "diagnosis" step.

### E3 — Migrate from CLI to API

Replace `claude -p` calls with direct Claude API calls (via Node.js SDK). Benefits:

- Structured input/output (no parsing text)
- Token counting and cost tracking
- Temperature control (0 for generation, 0.3 for fixes)
- System prompts (include warehouse rules as system context)
- Streaming (show progress in real-time)
- No process spawn overhead

This is the long-term path. The CLI works for now but doesn't scale to production monitoring.

### E4 — Warehouse-aware context assembly

Before calling Claude for generation, run the deterministic Stage 1 from the orchestration doc:

1. Read spec → extract capability requirements
2. Look up parts via capability matrix
3. Resolve dependency graph
4. Assemble prompt: selected parts + rules + contracts + spec
5. Pass assembled prompt to Claude (one-shot generation)

This removes the dependency on Claude "figuring out" what the warehouse contains and ensures the correct parts are loaded every time.

### E5 — Event schema validation via Playwright

Add a Playwright test category that:

1. Plays through a complete game (using fallback content)
2. Intercepts all `postMessage` calls
3. Validates each message against `postmessage-out.schema.json`
4. Validates that `game_complete` event has correct metrics shape
5. Validates that per-round events match the spec's Section 9

This closes the gap between "game looks right" and "game emits correct signals for the measurement layer."

### E6 — Caching and incremental runs

If a spec hasn't changed (checksum match), skip regeneration. If HTML hasn't changed but tests have, skip generation but re-run tests. Track hashes:

```
spec.md → sha256 → if unchanged, skip Step 1
index.html → sha256 → if unchanged, skip Step 3 re-run
```

At 47 templates, this saves significant time on re-runs where only a few specs changed.

### E7 — Failure pattern database

Track which types of failures occur across all 47 templates. Over time, this reveals systematic issues:

- "Content outside #gameContent" → warehouse PART-002 needs a stronger anti-pattern rule
- "Timer stuck at 00:00" → PART-010 timer initialization has a race condition
- "Grid exceeds 480px" → PART-004 CSS max-width rule is ambiguous

This feeds back into warehouse improvement — exactly the self-improving measurement layer pattern from the architecture docs.

### E8 — Diff-based fix prompts

Currently, Ralph sends the full HTML + full error output to Claude for fixing. For iteration 2+, send a targeted fix prompt:

- Only the failing test's code
- Only the relevant section of HTML (the function or CSS block that's wrong)
- The specific error message

Smaller context → faster response → cheaper → more accurate fixes.

### E9 — Spec validation against warehouse before generation

Add a pre-flight that validates the spec against the warehouse:

- Every part referenced in Section 2 exists in the warehouse manifest
- Dependencies of selected parts are also selected
- Conditional parts match the game's declared capabilities
- Contract references in Section 9 match actual contract schemas

Catches spec errors before burning a generation call.

### E10 — Deployment step

After APPROVED, Ralph should:

1. Copy `index.html` to the deployment target
2. Generate `inputSchema.json` (T6)
3. Register the template in the template registry with metadata (concept types, signal capture capabilities, pacing profile)
4. Version tag the artifacts (git tag or version file)
5. Emit a deployment event (for monitoring)

---

## Full Flow — End to End

### Phase 1: Spec Authoring (Human + Claude Desktop)

A game designer opens Claude Desktop and says: "I want a game where students find hidden chains of doubles in a 3×3 grid."

Claude loads the game-builder skill, which includes the warehouse. Through conversation, they iterate on the 13-section spec: game identity, parts selection, game state, input schema, screens, CSS, game flow, functions, event schema, scaffold points, feedback triggers, visual spec, and verification checklist.

The designer tests the game logic by having Claude build a playable artifact preview in the chat. They play it, find issues, refine.

When satisfied, the spec is published: `warehouse/templates/doubles/spec.md`.

### Phase 2: Automated Build (Ralph)

The designer (or a CI hook on spec commit) triggers Ralph:

```bash
./ralph.sh templates/doubles/game templates/doubles/spec.md
```

Ralph runs headless. No human in the loop. It generates HTML, generates tests, enters the fix loop. Either it produces a validated `index.html` or it fails with a structured report of what went wrong.

For the 47-template catalog, a batch runner processes all specs in parallel:

```bash
./batch-ralph.sh  # 4 parallel × 47 templates, ~12 batches
```

### Phase 3: Deployment (Not Yet Built)

Approved artifacts are registered. The Content Generator (P3) can now produce problem sets for any template. The Session Planner (P9) can select templates based on student needs.

### Phase 4: Runtime (Production)

A student opens the app. The Session Planner picks the Doubles template for this student based on their cognition model. The Content Generator fills it with content matched to the student's misconceptions and skill level. The generated HTML receives the content payload via `postMessage`, plays the session, and emits events that Event Capture (P4) processes.

### Where Ralph's Quality Gates Matter

If Ralph approves a game that emits malformed events, the entire measurement layer (P4-P8) gets garbage data. If Ralph approves a game where the timer doesn't work, engagement scoring (P6) computes wrong signals. If Ralph approves a game where star thresholds are wrong, the Progress Narrator (P15) tells parents incorrect information.

Ralph is the quality gate between "spec looks right to a human" and "artifact is mechanically correct for the system." Every downstream power trusts that Ralph-approved artifacts conform to contracts.

---

## Priority Order

| Priority | Item | Why |
|---|---|---|
| **P0** | T7 (timeouts) | A hung call blocks everything. Zero-effort fix. |
| **P0** | T5 (model default) | Cost multiplier across all runs. One-line fix. |
| **P0** | T3 (web server) | Tests may silently fail without it. |
| **P1** | T1 (static validation) | Catches 40% of failures in <1s, saves Playwright cycles. |
| **P1** | T4 (structured output) | Can't monitor or improve what you can't measure. |
| **P1** | T8 (cleanup trap) | Prevent disk fill on repeated runs. |
| **P2** | T2 (contract validation) | Enforces warehouse contracts deterministically. |
| **P2** | E2 (smart retry) | Directly from the orchestration doc you already wrote. |
| **P2** | T6 (inputSchema) | Blocks P3 integration without it. |
| **P2** | T9 (spec validation) | Prevent garbage-in before burning generation calls. |
| **P3** | E1 (parallel batch) | Required for 47-template scale. |
| **P3** | E5 (event schema tests) | Required for P4 integration. |
| **P3** | E3 (API migration) | Required for cost tracking and production monitoring. |
| **P4** | E4 (warehouse context) | Ideal correctness, not blocking. |
| **P4** | E6-E10 | Scalability and self-improvement. Nice-to-have. |
