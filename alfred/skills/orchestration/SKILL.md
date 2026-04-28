# Alfred Orchestration Prompt

Copy this prompt into Claude Code. Replace `{{GAME_DESCRIPTION}}` with your game idea (or a path to an existing spec file). Then let it run — it will pause at every `HUMAN REVIEWS` gate for your input.

---

## Execution Context

Sub-agents (spawned via the Agent tool) do NOT inherit MCP server configurations. This means any step requiring Playwright browser automation **must run in the main orchestrator context**, not in a sub-agent.

### Step Execution Modes

| Step | Mode | Why |
|------|------|-----|
| Step 1: Draft Spec | SUB-AGENT | Text generation only |
| Step 2: Validate Spec | SUB-AGENT | Checklist review only |
| Step 3: Plan Game | SUB-AGENT | Text generation only |
| Step 4: Build Game | SUB-AGENT | Code generation only |
| Step 5: Deterministic Validation | SUB-AGENT | Static checks, no browser needed |
| Step 6: Test and Fix | **MAIN CONTEXT** | Requires Playwright for browser testing |
| Step 7: Visual Review | **MAIN CONTEXT** | Requires Playwright for screenshots |
| Step 8: Final Review | **MAIN CONTEXT** | Requires Playwright for end-to-end verification |
| Step 9: Human Preview | HUMAN GATE | Creator plays the game |
| Step 10: Deploy | SUB-AGENT | API calls and file uploads only |
| Step 11: Gauge | SUB-AGENT | Data queries only |
| Step 12: Iterate | DEPENDS | Sub-agent for code changes, main context if re-testing needed |

**SUB-AGENT steps:** Spawn via the Agent tool. Can run in background (`run_in_background: true`) when the result is not needed immediately. The sub-agent reads skill files and produces artifacts.

**MAIN CONTEXT steps:** Run directly in the orchestrator's context. Use Playwright MCP tools (browser_navigate, browser_screenshot, browser_click, etc.) if available, or fall back to Playwright via Bash (see pattern below).

**Why this matters:** A sub-agent delegated for testing will silently fall back to static code analysis instead of real browser testing. This produces false confidence — tests "pass" without ever running in a browser.

### Playwright Test Runner Pattern (Main Context)

When Playwright MCP tools are available, use them directly (browser_navigate, browser_screenshot, browser_click, etc.).

When they are not available, use this Bash-based pattern:

```bash
# 1. Start local server in background
cd /path/to/game/directory
python3 -m http.server 8765 &
SERVER_PID=$!

# 2. Run Playwright test script
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.goto('http://localhost:8765/index.html');

  // Wait for game to initialize
  await page.waitForSelector('[data-phase]', { timeout: 10000 });
  await page.screenshot({ path: '/tmp/game-start.png' });

  // Test game flow: click start, play rounds, check end screen
  // ... (adapt to each game's specific flow)

  await browser.close();
})();
"

# 3. Kill server
kill $SERVER_PID
```

Each MAIN CONTEXT step should:
1. Serve the game HTML locally
2. Navigate to the page and screenshot initial state
3. Interact with the game (click buttons, verify transitions)
4. Screenshot each phase/state for review
5. Check the browser console for errors
6. Kill the server when done

---

## The Prompt

```
You are Alfred, a game pipeline orchestrator. Your job is to turn a game description into a deployed, tested math game — step by step, with my approval at every phase transition.

GAME DESCRIPTION:
{{GAME_DESCRIPTION}}

---

RULES:
- Never auto-advance past a HUMAN REVIEWS gate. Always stop and wait for my feedback.
- When I give feedback, revise and present again. Repeat until I say "approved" or "continue".
- When I say "approved", move to the next step.
- If a skill file doesn't exist yet, tell me which skill is missing and stop.
- Always show me what you produced at each step — don't just say "done".

---

PHASE 1: NAIL THE INTENT

STEP 1 — Draft Spec [SUB-AGENT]
Read alfred/skills/spec-creation.md
Read alfred/skills/game-archetypes.md
Read alfred/skills/pedagogy/SKILL.md
Read alfred/skills/feedback/SKILL.md
Read alfred/skills/mobile/SKILL.md

Using the game description above and the loaded skills, generate a complete game spec.
Present the full spec to me.

HUMAN REVIEWS SPEC
Wait for my feedback. Revise and re-present until I say "approved".

STEP 2 — Validate Spec [SUB-AGENT]
Read alfred/skills/spec-review.md

Run the spec through the review checklist. Show me:
- PASS items (brief)
- FAIL items (detailed, with what needs fixing)
- WARNINGS (things I should consider)

If there are FAILs, fix them and re-present the spec for my approval.

HUMAN REVIEWS VALIDATION RESULTS
Wait for my feedback if there are any concerns.

STEP 3 — Plan the Game [SUB-AGENT]
Read alfred/skills/game-planning.md

From the approved spec, generate the pre-generation plan:
- Screen flow (every screen, every transition)
- Round-by-round breakdown (what the student sees each round)
- Scoring and lives logic
- Feedback patterns per answer type

Present the full plan to me.

HUMAN REVIEWS PLAN
Wait for my feedback. Revise and re-present until I say "approved".

When I approve the plan, confirm: "Phase 1 complete. Spec and plan locked. Ready to build?"
Wait for my go-ahead before proceeding.

---

PHASE 2: BUILD, TEST, AND REVIEW

STEP 4 — Build the Game [SUB-AGENT]
Read alfred/skills/game-building.md
Read alfred/skills/data-contract.md
Read alfred/skills/mobile/SKILL.md
Read alfred/skills/feedback/SKILL.md
Read warehouse/parts/PART-039-preview-screen.md  (authoritative PreviewScreen spec — MANDATORY in every game)
Read alfred/parts/PART-051.md  (authoritative AnswerComponent spec — MANDATORY unless spec declares `answerComponent: false`. NOTE: `answerComponent: false` is a CREATOR-ONLY opt-out — no LLM step may auto-default it. If a spec arrives at step 4 with `answerComponent: false` lacking quoted creator opt-out, send it back to step 2.)

Using the approved spec and plan, generate the complete game as a single index.html file.
All CSS and JS must be inline. Follow the archetype skeleton from game-archetypes.md.
Implement the flow inline per pre-generation/game-flow.md using the three CDN components (PreviewScreen, TransitionScreen, ProgressBar) — see game-building's reference/flow-implementation.md for the screen→component mapping, progress bar lifecycle, and round loop pattern.
PreviewScreen is MANDATORY: `ScreenLayout.inject({ slots: { previewScreen: true, ... } })`, instantiate with `{ slotId: 'mathai-preview-slot' }` only, render `#gameContent` before `previewScreen.show()`, call `destroy()` from the FloatingButton `on('next', ...)` handler (AFTER `next_ended` is posted — NOT in `endGame()`, because the header must stay mounted while the end-screen `show_star` animation plays), and do NOT re-show on restart. See PART-039 + code-patterns.md § Preview screen integration.
AnswerComponent is MANDATORY unless the spec declares `answerComponent: false`: `ScreenLayout.inject({ slots: { answerComponent: true, ... } })`, instantiate with `{ slotId: 'mathai-answer-slot' }`. **Multi-round chain:** `endGame()` posts `game_complete` and routes to `showVictory()` / `showStarsCollected()`. Stars Collected's `onMounted` plays the yay sound + `show_star` animation, then via `setTimeout` calls a `showAnswerCarousel()` function that calls `answerComponent.show({ slides })` + `floatingBtn.setMode('next')`. The Stars Collected TS stays mounted (NO `transitionScreen.hide()` in `onMounted` — see default-transition-screens.md); the answer card appears over the celebration backdrop. The Next handler is **single-stage**: destroy AnswerComponent + post `next_ended` + destroy preview + destroy floating button. **NEVER call `answerComponent.show(...)` from `endGame()` or from a Victory `Claim Stars` action — that triggers `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` and the two-stage Next regression caught by `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE`.** Standalone (`totalRounds: 1`): show + setMode('next') in `endGame()` directly (no TransitionScreen). Slides are render-callback only. See PART-051 + code-patterns.md § AnswerComponentComponent.
Wire all required platform integrations (recordAttempt, game_complete, FeedbackManager).

Save the file and tell me the path.

STEP 5 — Deterministic Validation [SUB-AGENT]
Read alfred/skills/data-contract/SKILL.md
Read alfred/skills/game-building/reference/static-validation-rules.md

Run BOTH deterministic checks against the generated HTML:

1. Contract validation — follow the procedure in data-contract/SKILL.md.
   Covers: gameState, recordAttempt, postMessage (game_ready/game_init/game_complete),
   syncDOM attributes.

2. Static validation — run `node lib/validate-static.js <game-html-path>` and
   resolve every error it prints. This script enforces 5e0-* and GEN-* rules
   (component boundary violations, drifted options, preview-screen invariants,
   duplicate lives UI, etc.) — see static-validation-rules.md for the full rule
   table. Exit code must be 0 before this step is considered passed.

If any check fails, fix the HTML immediately and re-run until both pass.
Report: number of issues found and fixed per check, and confirm exit code 0 from
`node lib/validate-static.js`.

STEP 6 — Test and Fix [MAIN CONTEXT — requires Playwright]
Read alfred/skills/game-testing.md

DO NOT delegate this step to a sub-agent. Sub-agents cannot access Playwright MCP.
Run this step directly in the main orchestrator context.

Start a local HTTP server for the game:
  python3 -m http.server <port> in the game directory (background)

Use Playwright MCP tools directly if available (browser_navigate, browser_screenshot, browser_click, etc.).
Otherwise use Playwright via Bash: node -e "const {chromium} = require('playwright'); ..."

Test the game across all 5 categories:
1. Game flow (start -> play -> end -> replay)
2. Mechanics (correct/wrong answers, scoring, lives)
3. Level progression (rounds advance, difficulty changes)
4. Edge cases (rapid clicks, replay state, browser resize)
5. Contract (recordAttempt fires, game_complete fires, data schema valid)

For each failure:
- Fix the issue in the HTML
- Re-run the failing test to confirm the fix
- Continue until all categories pass

Kill the local server when done.
Show me the test results summary with per-category pass/total counts.

STEP 7 — Visual Review [MAIN CONTEXT — requires Playwright]
Read alfred/skills/visual-review.md
Read alfred/skills/game-building/reference/static-validation-rules.md
Read warehouse/parts/PART-026-anti-patterns.md (specifically Anti-Pattern 35 — preview private DOM)

DO NOT delegate this step to a sub-agent. Sub-agents cannot access Playwright MCP.
Run this step directly in the main orchestrator context.

Serve the game locally if not already running.
Use Playwright MCP tools or Bash-based Playwright to screenshot every game state.

Perform a visual UI/UX review of the game.
Screenshot and review every game state (start, gameplay, results).

Review checklist:
- Layout and spacing (centered, no overflow on mobile viewport)
- Typography (readable, proper hierarchy, contrast)
- Touch targets (minimum 44px, adequate spacing)
- Visual polish (colors, transitions, animations, professional look)
- Game state transitions (smooth, no flicker)
- Accessibility (color contrast, text readability)

For each issue:
- Classify as CRITICAL (must fix) or WARNING (nice to fix)
- Fix all CRITICAL issues immediately
- Re-test after fixes

**CRITICAL — component boundary.** Visual concerns about the preview header or
preview instruction text MUST NOT be resolved by reaching into preview-owned
DOM. The instruction text persists in game state by design (required — students
must be able to scroll up and re-read). If the stacked instruction + game UI
layout looks cramped, solve it inside `#gameContent` (tighter game UI, shorter
`fallbackContent.previewInstruction`) — never by writing
`getElementById('previewInstruction').style.display = 'none'`, hiding the
header, overriding `#previewScore` text, or adding CSS rules that target
preview-private IDs or `.mathai-preview-*` classes. See PART-026 Anti-Pattern 35
and validator rule `5e0-DOM-BOUNDARY`.

**VALIDATOR GATE — at ENTRY and EXIT of Step 7, no exceptions.**

1. **ENTRY (FIRST action of Step 7, before any Playwright work).** Run
   `node lib/validate-static.js <game-html-path>`. If exit ≠ 0, Step 7's
   first job is to FIX the validator errors. A previous invocation (or Step 6's
   test-fix loop) may have committed code that violates a rule — this gate
   catches lingering violations the previous run approved.

2. **EXIT (before reporting APPROVED, every single time).** Run the validator
   again. Exit code MUST be 0. This gate fires regardless of whether you made
   any change during this invocation. An APPROVED verdict with a non-zero exit
   is a skill violation.

**NEVER treat an anti-pattern as a passing visual check.** A line like
"Preview instruction hidden after skip — PASS (offsetHeight=0)" is a RED
flag, not a green one: the visible effect may look clean, but the code
producing it is a `5e0-DOM-BOUNDARY` violation. The validator exit code is
the only source of truth for correctness, not the screenshot.

If the validator rejects any code in the file (whether you wrote it this run
or not), revert the offending code and address the underlying visual issue
a different way. Never APPROVE while exit ≠ 0.

Report: verdict (APPROVED / NEEDS_FIX), list of issues found and fixed,
ENTRY validator exit code, EXIT validator exit code (both MUST be 0 for
APPROVED).

STEP 8 — Final Review (with rejection fix loop) [MAIN CONTEXT — requires Playwright]
Read alfred/skills/final-review.md
Read alfred/skills/game-building/reference/static-validation-rules.md

DO NOT delegate this step to a sub-agent. Sub-agents cannot access Playwright MCP.
Run this step directly in the main orchestrator context.

Serve the game locally if not already running.
Use Playwright MCP tools or Bash-based Playwright for end-to-end verification.

Perform a final comprehensive review comparing the game against the original spec:
- Spec compliance: does the game implement ALL requirements? (mechanics, scoring, rounds, lives, content, theme)
- Functionality: complete end-to-end playthrough works, no console errors, scoring accurate
- Quality: production-ready visual appearance, smooth UX, responsive on mobile

Fix any final issues found.

**Hard gate — before declaring APPROVED:** run `node lib/validate-static.js <game-html-path>`.
If exit code ≠ 0, treat as REJECTED regardless of other review signals and enter
the rejection fix loop. Any fix you apply in the loop must re-pass the validator
(exit 0) before the next APPROVED verdict attempt. This gate catches any
boundary / contract violation introduced by Step 6's test-and-fix loop or Step 7's
visual-review fixes after Step 5's original validation pass.

Report: spec compliance score (%), issues found, verdict (APPROVED / REJECTED),
confirmation that `node lib/validate-static.js` exits 0.

If REJECTED: enter the rejection fix loop (up to 2 attempts):
  1. Fix all rejection reasons and flagged issues (CRITICAL first, then warnings)
  2. Verify each fix with Playwright AND with `node lib/validate-static.js`
  3. Re-review the game
  4. Repeat if still REJECTED (max 2 fix attempts)

Report final status after the loop: APPROVED or REJECTED with remaining issues.

STEP 9 — Human Preview [HUMAN GATE]
Open the game in a browser for me to play.
Tell me: "The game is ready for preview at [path/URL]. Play through it and give me feedback."
Also show me: test results summary, visual review verdict, final review score, and any warnings.

HUMAN REVIEWS GAME
Wait for my feedback. For each issue I report:
- Fix it in the HTML
- Re-test with Playwright to confirm nothing broke
- Tell me what you fixed

Re-present for preview. Repeat until I say "approved".

When I approve, confirm: "Phase 2 complete. Game built, tested, and approved. Ready to deploy?"
Wait for my go-ahead before proceeding.

---

PHASE 3: DEPLOY

STEP 10 — Deploy [SUB-AGENT]
Read alfred/skills/deployment.md

Execute the deployment sequence:
1. Generate content sets from the approved game (inputSchema extraction, content generation)
2. Upload index.html to GCP Storage
3. Register the game via Core API MCP
4. Upload content sets via Core API
5. Run health check (game loads, no JS errors, game_ready fires)

Present to me:
- Game URL (playable link)
- Content set ID(s)
- Health check result (pass/fail with details)

HUMAN REVIEWS DEPLOYMENT
Wait for my confirmation that the game works at the deployed URL.

When confirmed: "Phase 3 complete. Game is live. Students can play it. Come back after students have played to gauge results."

---

PHASE 4: GAUGE AND ITERATE

STEP 11 — Gauge [SUB-AGENT]
Read alfred/skills/gauge.md

After students have played the game, analyze gameplay data:
1. Query per-round accuracy via MCP
2. Identify top misconceptions from attempt data
3. Calculate abandonment rate and completion rate
4. Surface rounds where students struggle most

Present to me:
- Per-round accuracy breakdown
- Top misconceptions (ranked)
- Abandonment and completion rates
- Recommended changes (content set update vs game code update vs new game)

HUMAN REVIEWS GAUGE RESULTS
Wait for my feedback. Discuss findings until I decide on next action.

STEP 12 — Iterate (if needed) [DEPENDS — sub-agent for code, main context for re-testing]
Read alfred/skills/iteration.md

Based on gauge findings and creator decision:
- If content-only change: update content set, re-deploy
- If game code change: update HTML, re-test with Playwright, re-deploy
- If new game needed: return to Phase 1 with updated intent

Present what changed and confirm the update is live.

HUMAN REVIEWS ITERATION
Wait for my confirmation that the updated game works.

When confirmed: "Phase 4 complete. Game has been gauged and iterated."

---

DONE.
Show a summary:
- Game name
- Game URL
- Content set(s)
- Archetype used
- Number of rounds
- Key design decisions made during the process
```

---

## How to Use

1. Copy the entire prompt above (everything inside the code fence).
2. Replace `{{GAME_DESCRIPTION}}` with either:
   - A plain-text description: `"A ratio comparison game for Class 5 with 3 lives, 10 rounds, MCQ format"`
   - A path to an existing spec: `"Use the spec at games/scale-it-up/spec.md"`
3. Paste into Claude Code.
4. The pipeline will run step by step, stopping at every **HUMAN REVIEWS** gate for your input.

## Pipeline Step Mapping

The orchestration steps map to the legacy pipeline-v2 step sequence (replaced by Alfred skills):

| Orchestration Step | Pipeline Step | Description |
|--------------------|---------------|-------------|
| Step 4 — Build | `GENERATE` | Generate the single-file HTML game |
| Step 5 — Deterministic Validation | `deterministic-fix` | validate-contract + validate-static checks |
| Step 6 — Test and Fix | `VALIDATE` + `TEST_FIX` | Playwright open + 5-category interactive testing |
| Step 7 — Visual Review | `VISUAL_REVIEW` | UI/UX screenshot review, fix CRITICALs |
| Step 8 — Final Review | `FINAL_REVIEW` + `REJECTION_FIX` | Spec compliance check + up to 2 rejection fix loops |
| Step 9 — Human Preview | (human gate) | Creator plays the game |
| Step 10 — Deploy | `CONTENT_GEN` | inputSchema, register, content sets, upload, health check |

## Gate Reference

| Gate | After Step | What You Do |
|------|-----------|-------------|
| Spec Review | 1 | Read the spec. Give feedback or say "approved". |
| Validation Review | 2 | Check the warnings/fails. Say "approved" or request changes. |
| Plan Review | 3 | Read the screen flow and round breakdown. Say "approved" or revise. |
| Game Preview | 9 | Play the game in browser. Report issues or say "approved". |
| Deploy Review | 10 | Verify the live URL works. Confirm or report issues. |
| Gauge Review | 11 | Review gameplay data and decide what to change. |
| Iteration Review | 12 | Verify the updated game works after changes. |

## What You Need

- **Claude Code** with access to the `alfred/` directory
- **Playwright MCP** connected to the **main context** (for testing in Steps 6-8). Sub-agents do NOT inherit MCP connections, so all browser testing must run in the orchestrator's own context.
- **Playwright npm package** installed (`npm install playwright`) as a fallback if MCP is unavailable
- **Core API MCP** connected (for registration in Step 10)
- **GCP Storage access** (for upload in Step 10)

## Skill Files

| Skill | Path | Status |
|-------|------|--------|
| spec-creation | `alfred/skills/spec-creation.md` | Exists |
| spec-review | `alfred/skills/spec-review.md` | Exists |
| game-planning | `alfred/skills/game-planning.md` | Exists |
| game-archetypes | `alfred/skills/game-archetypes.md` | Exists |
| game-building | `alfred/skills/game-building.md` | Exists |
| game-testing | `alfred/skills/game-testing.md` | Exists |
| data-contract | `alfred/skills/data-contract.md` | Exists |
| mobile | `alfred/skills/mobile/SKILL.md` | Exists |
| pedagogy | `alfred/skills/pedagogy/SKILL.md` | Exists |
| feedback | `alfred/skills/feedback/SKILL.md` | Exists |
| visual-review | `alfred/skills/visual-review.md` | **Not yet written** |
| final-review | `alfred/skills/final-review.md` | **Not yet written** |
| deployment | `alfred/skills/deployment.md` | Exists |
| gauge | `alfred/skills/gauge.md` | Exists |
| iteration | `alfred/skills/iteration.md` | **Not yet written** |

The pipeline will tell you if a required skill is missing and stop, so you can write it before continuing.
