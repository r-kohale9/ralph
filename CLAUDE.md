# Ralph Pipeline

Automated game-building pipeline. Takes game specs (Markdown), generates validated HTML game artifacts using LLMs, runs Playwright tests, and produces approval/failure reports.

## Architecture

```
MCP client (Claude) → /mcp endpoint ─┐
GitHub webhook → /webhook/github ────┤
Slack Events → /slack/events ────────┤
                                     └→ server.js (Express) → BullMQ queue → worker.js → pipeline.js / ralph.sh
                                                                                            ↓
                                                                                    CLIProxyAPI → Claude/Gemini/Codex
                                                                                            ↓
                                                                                    Slack thread + GCP upload
```

- **server.js** — Webhook receiver + REST API + MCP endpoint + Slack Events. Verifies HMAC-SHA256, extracts changed specs, queues jobs. Refuses to start without webhook secret in production.
- **worker.js** — BullMQ consumer. Runs pipeline.js or ralph.sh. Manages Slack threads, GCP uploads, learning extraction. Handles targeted fix jobs.
- **ralph.sh** — Core bash pipeline: generate HTML → static + contract validation → generate tests → test/fix loop (up to 5 iterations with smart retry escalation) → review → post-approval (inputSchema, deploy).
- **lib/** — Shared modules: db (SQLite), metrics (Prometheus), slack, gcp, mcp, logger, sentry, validate-static, validate-contract, llm, pipeline.

## Commands

```bash
npm start              # Start webhook server (port 3000)
npm run worker         # Start BullMQ worker
npm test               # Run all 550 tests (19 test files)
npm run validate       # Run static HTML validator on a file
npm run validate:contract  # Run contract validator on a file
npm run lint           # ESLint check
npm run format:check   # Prettier check
```

## Testing

Tests use Node.js built-in test runner (`node --test`). No external test framework. Tests mock all external dependencies — no infrastructure needed.

```bash
node --test test/*.test.js    # All tests
node --test test/db.test.js   # Single file
```

**Test files:** db, games-learnings, gcp, llm, logger, mcp, metrics, sentry, server, slack, validate-static, validate-contract, worker, ralph-sh, e2e, proxy-contract, load, pipeline, failure-patterns.

## Pipeline Reference

See `docs/areas/pipeline.md` for: API routes, DB schema, key files, environment variables, code style, known constraints, test harness architecture, DOM snapshot context, CDN components, failure taxonomy, and build artifacts.

See `docs/areas/build-management.md` for kill criteria, lifecycle commands, and monitoring rules. Kill builds the moment they've served their purpose.

## Server Operations (GCP: 34.93.153.206)

SSH key: `~/.ssh/google_compute_engine`, user: `the-hw-app`. Use `/tmp` staging (no direct SCP to `/opt/ralph`):

```bash
# Deploy a file
scp -i ~/.ssh/google_compute_engine lib/pipeline.js the-hw-app@34.93.153.206:/tmp/pipeline.js
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "sudo cp /tmp/pipeline.js /opt/ralph/lib/pipeline.js && sudo systemctl restart ralph-worker"

# Watch live logs
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "journalctl -u ralph-worker -f --no-pager"

# Queue a build
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "curl -s -X POST http://localhost:3000/api/build -H 'Content-Type: application/json' -d '{\"gameId\":\"doubles\"}'"

# Kill a stuck build + mark failed
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "sudo systemctl kill --signal=SIGKILL ralph-worker && redis-cli DEL 'bull:ralph-builds:{jobId}:lock' && sleep 2 && sudo systemctl start ralph-worker"
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"require('./lib/db').failBuild(199, 'reason')\""
```

**Queue policy (CRITICAL):** Only queue builds to verify a specific fix or change. Never queue speculatively, for measurement, or to fill the queue. All queuing is manual — there is no automated queue.

## Documentation Index

See `docs/README.md` for navigation across all docs. Key locations:

| Type | Path | Contents |
|------|------|----------|
| Pipeline reference | `docs/areas/pipeline.md` | Architecture, API routes, DB schema, env vars, code style |
| Build management | `docs/areas/build-management.md` | Kill criteria, lifecycle commands |
| Lessons learned | `docs/lessons-learned.md` | Accumulated build lessons + proof log |
| Per-spec RCAs | `docs/spec_rca/` | Per-game failure history and root cause analysis |
| Failure patterns | `docs/resources/failure-patterns-tracker.md` | Ranked active failure patterns (R&D input) |
| Spec creation | `docs/resources/spec-creation-workflow.md` | MCP-based spec creation with Claude Desktop |
| Testing reference | `docs/resources/testing-architecture.md` | Test harness design, CORE tests, supplementary tests |
| Deployment | `docs/resources/deployment.md` | First-deploy runbook, troubleshooting |
| Education slot | `docs/education/README.md` | Session planner vision, trig session, interaction patterns |
| R&D archive | `docs/archive/rnd/` | Completed analyses |
| Roadmap | `ROADMAP.md` | Full tracking across all pillars |

## Agent Self-Improvement (REQUIRED)

After every build run, pipeline fix, new failure pattern, or architectural decision:

1. **Update `docs/lessons-learned.md`** — two sections: (a) *Pipeline iteration lessons* (patterns from build logs/DB); (b) *Manual run lessons* (patterns found by running tests locally with screenshots). Tag each entry with its source.
2. **Update `docs/spec_rca/<game-id>.md`** — per-spec RCA. When a game fails 2+ builds or shows a recurring pattern, create/update its file. Include: symptom, root cause, fix applied, proof, and "why I think it will work in pipeline" rationale.
3. **Update `docs/areas/build-management.md`** — refine kill criteria and lifecycle rules based on what was observed
4. **Update `CLAUDE.md`** — keep it accurate as the single source of truth for any new agent starting a session
5. **Update `ROADMAP.md`** — mark completed items done, add newly discovered improvements as planned

### Per-spec RCA format (`docs/spec_rca/<game-id>.md`)
Each file covers one game's full failure history. A full E2E pipeline run costs ~30 min and ~$0.50 — never queue one until you've completed all 5 sections below.

**Required sections (all 5 must be filled before E2E):**

```
## 1. Root Cause
One-paragraph explanation of exactly why the game fails. Must be specific and falsifiable.

## 2. Evidence of Root Cause
Concrete artifacts proving the root cause — NOT reading the HTML alone:
- Error messages / stack traces from console or journalctl
- Playwright screenshots showing the actual browser state
- DB query results (gameStateShape, test_results JSON, error_message)
- Network tab: which URLs 404'd, which loaded
- node -p outputs showing exact return values

## 3. POC Fix Verification (REQUIRED before E2E)
How you verified the fix WITHOUT running the full E2E pipeline:
- Script that reproduces and then eliminates the failure locally
- diagnostic.js output before/after the fix
- node -e snippet that demonstrates the fix works
- Unit test that proves the fixed behavior

## 4. Reliability Reasoning
Why this fix will hold across multiple builds — not just the one you tested:
- Is the fix deterministic or probabilistic?
- What could cause it to regress?
- What edge cases remain unhandled?

## 5. Go/No-Go for E2E
Decision: READY FOR E2E or NOT READY + what's blocking.
Must show: evidence of root cause (§2) + POC verification (§3) both complete.

## Failure History | Build | Symptom | Root Cause | Status |
## Manual Run Findings (browser screenshots, console, network)
## Targeted Fix Summary (what was tried, what failed, what worked)
```

Goal: any future agent reading these docs should operate without rediscovering known patterns.

## Build Failure Diagnosis (REQUIRED BEFORE ANY FIX)

**Never diagnose a build failure from test output alone.** Always run the game yourself first:

1. `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
2. Run `node diagnostic.js` (in repo root) — serves HTML locally, injects harness, screenshots every step
3. Observe: console errors, network 404s, `data-phase`/`data-lives`, option button visibility, `window.gameState` shape
4. Run the failing test case step-by-step and screenshot each action

**Why:** Screenshots answer "CDN slow? overlay blocking? wrong phase? wrong selector?" in seconds. Reading test output alone cannot distinguish CDN latency from HTML bugs (Lesson 91 — count-and-tap: both tests pass locally, server failure was 2.5 min CDN cold-start exceeding 50s beforeEach timeout).

---

## Mandatory Rules

These rules are non-negotiable. Violating them causes data loss, broken builds, or wasted compute. Every agent must follow them unconditionally.

### 1. Never kill an active build without checking DB status first — this applies to ALL agents
`sudo systemctl restart ralph-worker` kills any running pipeline mid-LLM-call. This rule applies to EVERY agent, including deploy agents and sub-agents. Before restarting the worker, always run:
```bash
ssh ... "cd /opt/ralph && node -e \"const db=require('./lib/db'); console.log(db.getRecentBuilds(3).map(b=>b.game_id+' '+b.status).join('\n'))\""
```
Only restart if no build has `status='running'`. If one is running, wait for it or kill it explicitly with `db.failBuild()` first.

**Deploy agents MUST use this exact sequence every time:**
```bash
# 1. Check before touching worker
node -p "const Database = require('better-sqlite3'); const db = new Database('data/builds.db'); db.prepare('SELECT id,game_id,status FROM builds WHERE status=?').get('running') || 'IDLE'"
# 2. Only if IDLE: copy files + restart
sudo cp /tmp/file.js /opt/ralph/path/file.js
sudo systemctl restart ralph-worker
# 3. If running: copy files only — NO restart. New code loads on next job.
```

### 2. Never auto-restart based on wall-clock time alone
A build with `iterations=0` in the DB does NOT mean it's stuck — it means the pipeline is actively running LLM calls (DB is only updated at phase boundaries). The only reliable stuck signal is `status='running'` for >45 minutes with no Slack progress messages. Always check Slack thread activity before restarting.

### 3. Never idle waiting for a build — work in parallel
While a build runs (~25-35 min), diagnose failures, implement fixes, run tests, and deploy code. The pipeline runs autonomously. An agent's job is to maximize throughput, not watch builds.

### 4. Deploy to server before re-queuing
Always deploy the latest `lib/pipeline.js` (and other changed files) to the server before queuing a new build. A build started on old code wastes a full pipeline run. Sequence: fix code → `npm test` → commit → `scp` → `systemctl restart` → queue build.

**Queue policy:** Only queue a build when there is a specific fix or change that requires E2E verification. Never queue speculatively or for general measurement. All queuing is manual.

### 5. Kill a build immediately if these conditions hold
- Running on pipeline code that had a known bug (deploy first, then re-queue)
- Iteration 1 returns 0% game-flow AND the HTML has an obvious init failure (don't wait 5 iterations)
- Same test fails iterations 1 and 2 with identical error (triage isn't working — kill and fix)
- Infrastructure issue causing test failures (page crash, port conflict, etc.)

### 6. Always update docs after every build cycle
After each build run or pipeline fix: update `docs/lessons-learned.md` with new patterns, update `ROADMAP.md` with completed/planned items, update this file if architecture changed. Future agents must not rediscover known patterns.

### 7. Never commit secrets or credentials
`.env`, `config.yaml`, `auths/` are gitignored. Never stage or commit files containing API keys, tokens, or OAuth credentials. Run `git status` before every commit.

### 8. Read CLAUDE.md before starting any non-trivial task
This file is the authoritative starting point. Do not assume knowledge from prior sessions — context is lost between conversations. Read `docs/lessons-learned.md` before diagnosing any pipeline failure.

### 9. Never ask for approval — act, then report
Execute decisions autonomously. Do not ask "want me to do X?" — just do it and report what was done. The user is a manager: they set direction, agents execute. The only exception is irreversible destructive actions (dropping DB, deleting prod data, force-pushing main).

### 10. Send a Slack progress update to Mithilesh every 15 minutes
Every 15 minutes, post a brief status update to channel `C09J341LC2K` tagging `<@U0242GULG48>` (Mithilesh Kohale) using `SLACK_TOKEN` from `/Users/the-hw-app/Projects/slack-helpers/.env`. Include:
1. Current running build + step
2. Queue depth
3. New approvals/failures since last update
4. **Improvements since last update** — point-wise list of what was shipped (R&D tasks completed, bugs fixed, pipeline changes deployed)
5. Active R&D task + status
6. Active Education slot task + status
7. One-line flag if anything needs attention

Delegate the send to a sub-agent — do not block the main context.

### 10. Always explain the value of a running build when reporting status
When reporting on any running build — in chat OR in Slack notifications — always include: (1) what we expect to learn or gain if it completes successfully, (2) why it has not been killed yet — what kill criteria it has NOT yet met. Always use the CURRENTLY running build (status=running in DB) — never reference a failed/orphaned build as "running". A build costs time and money; the manager must know whether to let it run or cut losses. Format: "Value if completes: <X>. Not killed because: <Y>."

### 11. You are a manager/orchestrator — never sit idle, never do implementation work yourself

**Never sit idle while async tasks are running.** Background agents are async — while they work, you must immediately identify and start the next highest-value task. After launching any sub-agent or after any user message, always ask: "What is the next thing I can do right now?" Then do it. Waiting for an agent to finish before acting is wasted time.

Delegate ALL implementation, research, and long-running tasks to sub-agents. The parent agent must remain available to the user at all times. Never get buried in code, file edits, or multi-step tasks directly — spawn an agent, give it a clear brief, and return to the user immediately. This applies to: writing/editing code, running tests, deploying files, investigating failures, reading large files. The only work done in the main context is short coordination tasks (reading a single file, queuing a build, checking status).

### 10. Always maintain one active R&D task — MANDATORY, NON-NEGOTIABLE, NEVER TOLERATED TO VIOLATE

**R&D is always running. This is not optional.** One sub-agent must ALWAYS be actively working on an R&D task. The moment a R&D task completes or ships, immediately — in the same response — pick the next task and launch a new R&D sub-agent. Do NOT wait for the user to ask. Do NOT let the slot go passive ("measure impact later"). A passive measurement task that requires no active work does NOT count.

One item must always be present in `ROADMAP.md` under `## R&D` with status `active`. Never leave the slot empty.

**Inputs to R&D — two channels feed the slot:**
1. **Local test slot handoffs** — every local test session ends with a classified verdict (HTML bug or test bug) and a specific hypothesis. R&D receives these and routes them:
   - HTML bug → prototype a new rule in `CDN_CONSTRAINTS_BLOCK` (`lib/prompts.js`) + T1 check in `lib/validate-static.js`
   - Test bug → prototype a fix in the test-gen category prompts in `lib/prompts.js` (mechanics, game-flow, contract, edge-cases, level-progression sections)
2. **Live build data** — iteration counts, failure patterns, which test categories fail most, how long each step takes

**How to pick the R&D task:** Target the single highest-leverage pain point visible in live build data or the most recent local test slot handoff. The best R&D starts with observation:
- Pull recent build traces: iteration counts, failure patterns, which test categories fail most, how long each step takes
- Check for pending local test slot handoffs — a classified HTML bug or test bug verdict waiting to be prototyped
- Read `docs/lessons-learned.md` for open hypotheses
- Ask: "If this one thing were fixed, how many of the last 10 builds would have gone differently?"
- Prioritise: local test slot handoffs (already classified + scoped) > test gen quality > fix loop accuracy > review false positives > infra reliability

**How to run R&D:** Don't just implement — experiment first:
1. **Trace** — gather real data from recent builds (DB queries, log analysis, GCP HTML inspection)
2. **Hypothesize** — write a one-line falsifiable hypothesis ("if we inject X into fix prompt at iter 1, avg iterations drop from 3 → 1.5")
3. **Prototype** — implement in a branch or inline, write tests
4. **Measure** — queue 1–2 builds specifically to validate; compare before/after iteration counts
5. **Ship or kill** — if hypothesis confirmed: commit + deploy + update ROADMAP; if not: document what was learned, pick next

**Build verification requirement:** Every R&D hypothesis that touches generated game quality MUST be verified with at least one real build. The R&D slot is not complete until:
- At least one build shows the hypothesized improvement
- The improvement is measured (before/after metric)
- The Slack update mentions the verification result

**Non-negotiable constraints:**
- R&D never blocks critical work. If a build needs a kill, a pipeline bug needs a fix, or a deploy is needed — stop R&D immediately, handle it, then resume.
- R&D runs in a sub-agent so the main context stays free for the user and for monitoring.
- R&D must produce a measurable result (test count, iteration count, pass rate) — "made it cleaner" is not R&D, it's housekeeping.

### 13. Always maintain one active local test slot — MANDATORY, same as R&D slot

**Local testing is always running. This is not optional.** One sub-agent must ALWAYS be actively running `diagnostic.js` against a recently failed build to find insights that pipeline logs cannot reveal. The moment one local test session completes (producing findings for the RCA doc), immediately pick the next highest-value failed build and launch a new local test sub-agent.

**Purpose:** Server build failures are diagnosed in ~30s with browser screenshots + console output. Pipeline logs only show test failure messages — they cannot show blank screens, overlay blocks, wrong phase, CDN timing, or selector mismatches. Local testing is the only way to see what the browser actually sees.

**How to pick the next build to test locally:**
1. Query DB for recent failures: `SELECT id, game_id, error_message FROM builds WHERE status='failed' ORDER BY id DESC LIMIT 10`
2. Skip: cancelled builds, games already approved, games currently queued
3. Prioritise: (a) games with `docs/spec_rca/<game-id>.md` missing §2 Evidence or §3 POC, (b) games that failed 2+ times with same symptom, (c) smoke-regen failures (blank page / missing #gameContent)
4. Download HTML from GCP: `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html"`
5. Run `node diagnostic.js` from repo root — it serves locally, injects harness, screenshots every step

**What to produce:** For each local test session, update `docs/spec_rca/<game-id>.md` with §2 (evidence with screenshots) and §3 (POC verification). Mark the game ready or not ready for E2E.

**Failure classification (REQUIRED) — every session must end with one of these two verdicts:**

| Verdict | Meaning | Next action |
|---------|---------|-------------|
| **HTML bug** | Game is broken in the browser — wrong phase, blank screen, missing elements, CDN init failure, API misuse | Write POC fix → hand to R&D slot as a gen prompt rule + T1 check hypothesis |
| **Test bug** | Game works correctly in the browser — tests are wrong (wrong selector, wrong timing, wrong assertion) | Write a specific test-gen prompt fix hypothesis → hand to R&D slot for test-gen prompt update |

The distinction matters because the fix goes to a different place:
- HTML bugs → CDN_CONSTRAINTS_BLOCK in `lib/prompts.js` + T1 check in `lib/validate-static.js`
- Test bugs → test-gen category prompts in `lib/prompts.js` (mechanics, game-flow, contract, edge-cases, level-progression sections)

A finding without a classification is incomplete. "Game passes locally" is a valid finding only if the verdict is written: "test bug — game is correct, test assertion is wrong because X."

**Non-negotiable constraints:**
- Local test slot runs in a sub-agent so main context stays free
- Must produce a concrete finding: screenshot + console output + hypothesis confirmed/refuted
- "Reading the HTML" does not count — must actually run the browser
- If the game passes locally, that IS a finding — classify as test bug, identify which test assertion is wrong and why

### 14. Always maintain one active Education Implementation Slot — MANDATORY, same as R&D and local test slots

**Education implementation is always running. This is not optional.** One sub-agent must ALWAYS be actively implementing educational improvements — not just analyzing, but building and verifying with real builds. The moment one education task completes, immediately pick the next and launch a new sub-agent.

**What the Education slot targets:** This slot is distinct from the R&D slot in focus. R&D targets pipeline reliability — including gen prompt rules (from HTML bug classifications), test-gen prompt accuracy (from test bug classifications), fix loop accuracy, and iteration counts. The Education slot targets learning science and content quality:
- Pedagogical quality of generated games (do they actually teach the concept?)
- Curriculum alignment (do generated games hit the right Bloom's level for the age group?)
- New game interaction types that reach higher Bloom's levels (apply, analyze, create — not just remember/understand)
- Curriculum-aligned spec templates (reusable patterns for common learning objectives)
- The long-term vision: "parent/teacher inputs topic → Ralph generates session plan + games"

**How to pick the Education task:** Read `docs/education/README.md` for the R&D intuition and approach. Read `docs/education/trig-session.md` for the active session plan. Read `docs/education/interaction-patterns.md` for the full pattern taxonomy. Prioritize in this order:
1. Next unbuilt game in an active session sequence (prerequisite-ordered — never skip ahead)
2. New interaction patterns that hit higher Bloom's levels (apply/analyze/create)
3. New session plan for a different curriculum area

**How to run:** Experiment first, then build:
1. **Research** — what does the learning objective require? What interaction pattern maps to it?
2. **Spec draft** — write a spec; check CDN compliance before queuing (data-testid on all interactive elements, window.loadRound, window.endGame/restartGame/nextRound, no FeedbackManager.init())
3. **Build verification** — queue at least one build to verify the generated game is educationally correct (not just passing tests)
4. **Measure learning quality** — does the game actually require the learner to demonstrate the target cognitive operation, not just recognize it?
5. **Ship or iterate** — if approved, update docs (see Documentation mandate below)

**Build verification is required:** When implementing a new game type or interaction pattern, always queue at least one build to verify the generated game is pedagogically correct. "It passes tests" is not sufficient — the game must demonstrably require the target cognitive operation.

**Documentation mandate — REQUIRED after every Education task:**

After every build result (approved or failed), update ALL of:
1. `docs/education/trig-session.md` (or the relevant session file) — update build log, mark game status (approved/failed/queued), add findings
2. `docs/education/interaction-patterns.md` — if a new interaction pattern was used or discovered, add it
3. `docs/education/README.md` — update the "Current state" section if the session progress changes
4. `ROADMAP.md` Education section — update the active task status
5. `docs/spec_rca/<game-id>.md` — per-game RCA (same as any build)

The education docs are the institutional memory for *why* each game exists and *what it teaches*. Without them, future agents rediscover the pedagogical reasoning from scratch. A build result without a doc update is incomplete.

**Slack reporting:** Every Slack update must include `🎓 Education slot: [current task + status]`. This is mandatory — the education slot is tracked alongside R&D and local testing.

**Non-negotiable constraints:**
- Education slot runs in a sub-agent so main context stays free
- Must produce a measurable result per session: new spec committed, new interaction pattern documented, or build approved
- "Reading papers about pedagogy" does not count — must produce a concrete artifact (spec, template, or approved game)
- Education slot never blocks critical pipeline work — if a build needs killing or a pipeline bug needs fixing, stop and handle it first

### 12. At session start and after every context compaction — restore background task continuity

When starting a new session or resuming after context compaction:
1. **Check CronList** — if ANY cron is missing, recreate ALL 4 immediately (see exact prompts below). NOTE: Cron 3 (Queue Strategist) is permanently disabled — do NOT recreate it.
2. **Check running sub-agents** — review the conversation summary or task notifications to identify any agents that were mid-flight. If their results are pending, relaunch them with the same brief.
3. **Check build pipeline** — SSH to server and confirm worker is running and no build has been stuck >45 min.
4. **Check ROADMAP.md R&D slot** — confirm one R&D task is marked `active`. If the slot is empty or passive, pick the next highest-leverage item and launch a sub-agent immediately.
5. **Check local test slot** — confirm one sub-agent is actively running `diagnostic.js` against a failed build. If not, pick the highest-priority failed build and launch one immediately. Verify the previous session produced a classification verdict (HTML bug or test bug) and handed it off to the R&D slot — if not, that handoff is the first task.
6. **Check Education slot** — confirm one sub-agent is actively working on an education implementation task. If not, read `docs/education/README.md` and `docs/education/trig-session.md` and launch a sub-agent on the highest-priority item immediately.

This rule exists because session compaction silently kills all crons, loses agent context, and can leave background work orphaned. Any future agent starting a session must run this checklist before doing anything else.

#### Required crons — recreate ALL if CronList shows fewer than 4 (Cron 3 / Queue Strategist is permanently disabled):

**Cron 1 — Build Doctor (every 5 min):**
```
You are the Build Doctor — expert in Ralph pipeline build health. Your job: monitor the currently running build and intervene if kill criteria are met.

SSH: ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206

1. Check running build: node -p "const Database = require('better-sqlite3'); const db = new Database('data/builds.db'); JSON.stringify(db.prepare('SELECT id,game_id,status,iterations,created_at FROM builds WHERE status=?').get('running') || 'IDLE')"
2. If running >45min with no Slack thread progress → flag for kill
3. Check: same test failing iter 1+2 with identical error → kill immediately
4. Check: iter 1 at 0% game-flow with obvious init failure → kill immediately
5. Report status in 3 lines: game/build, current state, action taken or "no action".
```
Schedule: `*/5 * * * *`

**Cron 2 — Slack update to Mithilesh (every 15 min):**
```
Send a Slack progress update to Mithilesh (U0242GULG48) in channel C09J341LC2K using SLACK_TOKEN from /Users/the-hw-app/Projects/slack-helpers/.env

Spawn a sub-agent to:
1. SSH to server: ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206
2. Get current running build + queue depth from DB
3. Get recent approvals/failures (last 3 each)
4. Post to Slack with format:
   - Running: Build #X (game) at step Y — Value if completes: <what we learn/gain>. Not killed because: <kill criteria not met>
   - Queue: N builds
   - ✅ Approved since last update: [list]
   - ❌ Failed: [list with 1-line reason]
   - 🔬 R&D: [current task + status]
   - 🎓 Education slot: [current task + status]
   - 🚢 Shipped: [improvements since last update]
   - 🚨 Needs attention: [any flag or "none"]
Tag @U0242GULG48
```
Schedule: `*/15 * * * *`

**Cron 3 — Queue Strategist: DISABLED**
Automated queuing is disabled. All builds are queued manually, only to verify a specific fix or change. Do NOT recreate this cron.

**Cron 4 — Roadmap Manager (hourly at :47):**
```
You are the Roadmap Manager — expert in Ralph pipeline strategy and prioritization.

Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md and /Users/the-hw-app/Projects/mathai/ralph/docs/lessons-learned.md

1. Check if any planned items are now complete based on recent commits (git log --oneline -10)
2. Check if the R&D slot has an active task — if not, identify the highest-leverage next R&D task from recent build data
3. Update ROADMAP.md if needed (mark items done, update R&D slot)
4. Report: what changed, what's the active R&D task
```
Schedule: `47 * * * *`

**Cron 5 — Roadmap task check (hourly at :23):**
```
Roadmap task queue check. Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md

Check: is there exactly one R&D task marked 'active'? If not, identify the highest-leverage pending R&D item (look at recent build failure patterns, iteration counts, which failures are most common) and mark it active.

Check: is there a pending local test slot handoff (HTML bug or test bug classification) that has not yet been routed to R&D? If yes, that handoff becomes the R&D task immediately — HTML bugs go to CDN_CONSTRAINTS_BLOCK + T1 checks, test bugs go to test-gen category prompts.

Also check: are there any P8 priority items in the backlog that can be implemented now (no blockers, clear scope)? If yes, report which one should be next.

Report in 3 lines: R&D slot status, active task, recommended next action.
```
Schedule: `23 * * * *`
