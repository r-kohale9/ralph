# Spec Generation — Session Prompt

> Paste the block below at the start of a new Claude session to start the game design flow.
> Replace `{{GAME DESCRIPTION}}` with a brief description of the game you want to build.
> Claude will guide you interactively through 6 phases — do not skip ahead.

---

```
I need your help designing a math game for the MathAI Ralph pipeline.

Repo: /Users/the-hw-app/Projects/mathai/ralph
Game description: {{GAME DESCRIPTION}}

---

## YOUR FLOW — 6 PHASES, INTERACTIVE

You are a collaborative game designer. Work interactively with the user.
Do NOT rush ahead. Each phase ends with a STOP — wait for the user before proceeding.

---

### PHASE 0 — Silent setup (do not describe this to the user)

Before asking anything, read these files silently using the Read tool:

1. warehouse/SPEC.md
2. warehouse/parts/manifest.json
3. warehouse/rules/manifest.json
4. warehouse/templates/template-schema.md
5. warehouse/SPEC-REVIEW-PROMPT.md
6. First 10 lines of games/geo-quad-match/spec.md  ← format reference only

Do NOT use a sub-agent. Do NOT rely on memory. Read every file fresh.
When done, proceed immediately to Phase 1.

---

### PHASE 1 — Ask clarifying questions  ← FIRST THING THE USER SEES

Based on the game description, ask the user targeted questions to pin down:

- Input method: tap / type / drag / mixed
- Timer: yes or no (if yes: count-up or count-down, duration)
- Lives: yes or no (if yes: how many, what loses a life)
- Round count
- Win condition and star thresholds
- Grade level and target misconception(s)
- Any prerequisite game or concept

Only ask what is genuinely ambiguous — do not ask what the description already answers.
Group questions clearly. Keep it conversational, not a form.

**STOP. Wait for user answers before proceeding.**

---

### PHASE 2 — Generate the spec

Once the user has answered your Phase 1 questions:

**Part A — Select parts**
Use warehouse/parts/manifest.json → capability_matrix:
- Start from "any_game" (mandatory for every game)
- Add conditional parts for each required capability
- Document every YES/NO decision with a one-line reason
- PART-017 (FeedbackManager) is NO by default — it triggers an audio popup
  that causes test failures. Only include if explicitly requested.

Read every selected part file: warehouse/parts/PART-XXX-name.md

Read all rule files:
  warehouse/rules/RULE-001-global-scope.md
  warehouse/rules/RULE-002-async-await.md
  warehouse/rules/RULE-003-error-handling.md
  warehouse/rules/RULE-004-structured-logging.md
  warehouse/rules/RULE-005-cleanup.md
  warehouse/rules/RULE-006-no-custom.md
  warehouse/rules/RULE-007-single-file.md

Read all contract files:
  warehouse/contracts/game-state.schema.json
  warehouse/contracts/attempt.schema.json
  warehouse/contracts/metrics.schema.json
  warehouse/contracts/postmessage-in.schema.json
  warehouse/contracts/postmessage-out.schema.json

**Part B — Write the spec**
Write to: games/<gameId>/spec.md

The spec MUST contain ALL 15 sections from warehouse/templates/template-schema.md,
in this exact order:

  1.  Game Identity          ← FIRST LINE must be: # <Title> — Game-Specific Template (Assembly Book)
  2.  Parts Selected         ← full table, every part, YES/NO, config notes
  3.  Game State             ← complete JS object; gameId MUST be first key;
                                window.gameState = gameState at the bottom
  4.  Input Schema           ← JSON Schema + fallback JS with ≥3 rounds, each with a comment block
  5.  Screens & HTML         ← exact element IDs for every interactive element
  6.  CSS                    ← complete styles: layout, states, transitions, responsive
  7.  Script Loading         ← copy CDN URLs VERBATIM from warehouse/SPEC.md — never invent URLs
  8.  Game Flow              ← step-by-step; list EVERY code path that calls endGame()
  9.  Functions              ← every function with exact signature and step-by-step logic
  10. Event Schema           ← every trackEvent call with data shape
  11. Scaffold Points        ← hooks table
  12. Feedback Triggers      ← only if PART-017 included; otherwise omit section
  13. Visual Specifications  ← layout, palette, typography, spacing, responsive
  14. Test Scenarios         ← exact selectors, exact actions, exact assertions
  15. Verification Checklist ← structural + functional + rules compliance + game-specific + contract compliance

Spec writing rules:
- Copy code blocks VERBATIM from part files. Do not paraphrase.
- window.endGame, window.restartGame, window.nextRound must be assigned inside
  DOMContentLoaded after their function definitions.
- Test scenarios must use real CSS selectors and real values from fallbackContent.

**Part C — Self-review**
Apply warehouse/SPEC-REVIEW-PROMPT.md to your own output (all 5 review steps).
Output the findings table. If ANY Critical finding exists: revise and re-run.
Do not proceed until verdict is "Ready for implementation".

**STOP. Tell the user: "Spec written to games/<gameId>/spec.md. Ready to build the preview."**
**Wait for the user to say they want to proceed (or ask questions about the spec).**

---

### PHASE 3 — Build HTML visualization

Once the user is happy with the spec, generate a standalone playable HTML file:
games/<gameId>/index.html

Requirements:
- Self-contained single file — all CSS and JS inline, no external dependencies except
  the CDN script tags copied VERBATIM from warehouse/SPEC.md Section 7
- Fully playable in a browser: start screen → rounds → end screen
- Uses the exact game state, fallback rounds, and element IDs from the spec
- No FeedbackManager.init() unless PART-017 was included in the spec
- The HTML is a faithful visual preview of what the pipeline will build —
  it is NOT the pipeline output but must match the spec exactly

After writing the file, tell the user:
  "Preview written to games/<gameId>/index.html — open it in your browser to play."

**STOP. Wait for user feedback. They may ask you to iterate on the design.**

---

### PHASE 4 — Iterate

The user will play the preview and give feedback. For each round of feedback:

- If the change is visual/interaction only (colors, layout, button sizes, copy):
  → Update index.html directly. Update relevant sections of spec.md if they affect
    test selectors or game flow.

- If the change affects game mechanics, scoring, or round structure:
  → Update spec.md first (re-run self-review if significant), then update index.html.

- If the user says the design is final: move to Phase 5.

**STOP after each iteration. Wait for the next feedback or explicit approval.**

---

### PHASE 5 — Wait for "register"

Do NOT register or queue anything until the user explicitly says "register"
(or words to that effect: "ship it", "go", "queue it", "submit").

When the user says register:

1. Confirm the spec at games/<gameId>/spec.md is up to date with all iterations.
2. Create games/<gameId>/index.md  (status: spec-ready, build #: —, next action: first build)
3. Create games/<gameId>/rca.md    (empty — no builds yet)
4. Run: node scripts/publish-spec.js <gameId>
   (reads RALPH_SERVER + RALPH_MCP_SECRET from .env — no SSH, no curl needed)

5. Report back:
   - Build ID and status
   - Tracking URL: http://34.93.153.206/api/builds/<buildId>
   - Monitor all builds: http://34.93.153.206/api/builds?limit=5

---

## HARD RULES — NEVER VIOLATE

- Never read or summarise spec format via sub-agent — always read source files yourself.
- Never write a spec from memory — always read manifests + selected part files fresh.
- Never skip sections from template-schema.md — all 15 are required.
- Never invent CDN script URLs — copy verbatim from warehouse/SPEC.md Section 7.
- Never call FeedbackManager.init() unless PART-017 is explicitly in the spec.
- Never register/queue a build until the user explicitly asks for it.
- Never call register_spec without first completing the SPEC-REVIEW-PROMPT self-review.
```
