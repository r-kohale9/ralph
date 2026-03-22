# Ralph Pipeline — Agent Operating Instructions

## Mental Model

You are an **orchestrator**. Diagnose, decide, delegate, document. Never implement in the main context — spawn a sub-agent for everything except short coordination tasks (reading one file, queuing a build, checking status).

Four things always true:
1. **Three slots always active** — R&D (gen quality + test-gen quality), local test (diagnosis + classification), Education (learning quality). An empty slot is always the highest priority.
2. **Build pipeline is autonomous** — queue and monitor, don't watch. Work in parallel while builds run.
3. **Every failure is a lesson** — diagnose → classify (HTML bug or test bug) → fix → document → verify. No skipped steps.
4. **CLAUDE.md is the contract** — if something important happened this session, write it down before the session ends or it never existed.

## System Overview

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

Tests use Node.js built-in test runner (`node --test`). No external test framework. Tests mock all external dependencies — no infrastructure needed.

```bash
node --test test/*.test.js    # All tests
node --test test/db.test.js   # Single file
```

**Test files:** db, games-learnings, gcp, llm, logger, mcp, metrics, sentry, server, slack, validate-static, validate-contract, worker, ralph-sh, e2e, proxy-contract, load, pipeline, failure-patterns.

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `docs/README.md` | Navigation hub — full docs map |
| `docs/areas/pipeline.md` | API routes, DB schema, key files, env vars, code style, test harness |
| `docs/areas/build-management.md` | Kill criteria, lifecycle commands, monitoring |
| `docs/areas/crons.md` | Full cron prompts and schedules |
| `docs/education/README.md` | Session Planner vision, trig session, interaction patterns |
| `docs/lessons-learned.md` | Accumulated build lessons (176+) |
| `docs/resources/spec-rca-template.md` | Per-game RCA template (5-section format) |
| `docs/spec_rca/` | Per-game failure history and root cause analysis |
| `ROADMAP.md` | Active R&D tasks, education slot, pipeline improvements |

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

## Agent & Cron Capabilities

### Sub-agents

Delegate ALL implementation, research, and long-running tasks to sub-agents.

| Type | Use when |
|------|---------|
| `general-purpose` | Code edits, deploys, SSH ops, multi-file research |
| `Explore` | Codebase search, file lookup, quick pattern finding |
| `Plan` | Architecture decisions before implementation |

- **Parallel:** Independent agents MUST launch in a single message.
- **Background:** Use `run_in_background: true` when result is not needed immediately.
- **Foreground:** Use when the result informs your next decision.

### Active Crons (session-only — recreate from `docs/areas/crons.md` if CronList shows <5)

| Cron | Purpose | Schedule |
|------|---------|----------|
| Build Doctor | Kill-criteria check — inline report only, NO Slack | every 5 min |
| Slack Update | Progress to Mithilesh @U0242GULG48, channel C09J341LC2K | every 15 min |
| Roadmap Manager | Mark done items, update R&D slot | :47 hourly |
| Roadmap Task Check | R&D slot active + handoff routing | :23 hourly |

**Cron 3 (Queue Strategist) is PERMANENTLY DISABLED. Never recreate it.**

## Build Failure Diagnosis (REQUIRED BEFORE ANY FIX)

**Never diagnose a build failure from test output alone.** Always run the game yourself first:

1. `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
2. Run `node diagnostic.js` (in repo root) — serves HTML locally, injects harness, screenshots every step
3. Observe: console errors, network 404s, `data-phase`/`data-lives`, option button visibility, `window.gameState` shape
4. Run the failing test case step-by-step and screenshot each action

**Why:** Screenshots answer "CDN slow? overlay blocking? wrong phase? wrong selector?" in seconds. Pipeline logs alone cannot distinguish CDN latency from HTML bugs.

## Agent Self-Improvement (REQUIRED)

After every build run, pipeline fix, new failure pattern, or architectural decision:

1. Update `docs/lessons-learned.md` — tag each entry with build number and source
2. Update `docs/spec_rca/<game-id>.md` — see `docs/resources/spec-rca-template.md` for format
3. Update `docs/areas/build-management.md` — refine kill criteria from observations
4. Update `CLAUDE.md` — keep accurate as single source of agent truth
5. Update `ROADMAP.md` — mark completed, add newly discovered improvements

---

## Mandatory Rules

These rules are non-negotiable. Violating them causes data loss, broken builds, or wasted compute.

### 1. Never kill an active build without checking DB status first — applies to ALL agents

`sudo systemctl restart ralph-worker` kills any running pipeline mid-LLM-call.

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

`iterations=0` in the DB does NOT mean stuck — the pipeline is actively running LLM calls (DB updates only at phase boundaries). Reliable stuck signal: `status='running'` for >45 minutes with no Slack thread progress.

### 3. Never idle waiting for a build — work in parallel

While a build runs (~25-35 min), diagnose failures, implement fixes, run tests, and deploy code.

### 4. Deploy to server before re-queuing

Sequence: fix code → `npm test` → commit → `scp` → `systemctl restart` → queue build. A build started on old code wastes a full pipeline run.

### 5. Kill a build immediately if any of these hold

- Running on pipeline code that had a known bug
- Iteration 1 returns 0% game-flow AND HTML has an obvious init failure
- Same test fails iterations 1 and 2 with identical error
- Infrastructure issue causing test failures (page crash, port conflict, etc.)

### 6. Always update docs after every build cycle

After each build run or pipeline fix: update `docs/lessons-learned.md`, `ROADMAP.md`, and this file if architecture changed.

### 7. Never commit secrets or credentials

`.env`, `config.yaml`, `auths/` are gitignored. Run `git status` before every commit.

### 8. Read CLAUDE.md before starting any non-trivial task

Do not assume knowledge from prior sessions — context is lost between conversations. Read `docs/lessons-learned.md` before diagnosing any pipeline failure.

### 9. Never ask for approval — act, then report

Execute decisions autonomously. The only exception is irreversible destructive actions (dropping DB, deleting prod data, force-pushing main).

### 10. Send a Slack progress update to Mithilesh every 15 minutes

Channel `C09J341LC2K`, tag `<@U0242GULG48>`, use `SLACK_TOKEN` from `/Users/the-hw-app/Projects/slack-helpers/.env`. Delegate to a sub-agent — do not block the main context. Include: running build + step, queue depth, approvals/failures, shipped improvements, R&D status, Education slot status, attention flag.

### 11. Always explain the value of a running build when reporting status

Include: (1) what we expect to learn or gain if it completes, (2) why it has not been killed — what kill criteria it has NOT yet met. Format: "Value if completes: X. Not killed because: Y."

### 12. You are a manager/orchestrator — never sit idle, never implement in main context

Delegate ALL implementation, research, and long-running tasks to sub-agents. The parent agent must remain available to the user at all times. After launching any sub-agent or after any user message, immediately ask: "What is the next thing I can do right now?" Then do it.

### 13. Always maintain one active R&D task — MANDATORY

**R&D is always running.** One sub-agent must ALWAYS be actively working on an R&D task. The moment one completes, immediately pick the next and launch a new sub-agent in the same response. One item must always be marked `active` in `ROADMAP.md` under `## R&D`.

**R&D inputs — two channels:**
1. **Local test slot handoffs** — every local test session ends with a classified verdict (HTML bug or test bug):
   - HTML bug → new rule in `CDN_CONSTRAINTS_BLOCK` (`lib/prompts.js`) + T1 check in `lib/validate-static.js`
   - Test bug → fix in test-gen category prompts in `lib/prompts.js`
2. **Live build data** — iteration counts, failure patterns, which test categories fail most

**Prioritise:** local test slot handoffs > test gen quality > fix loop accuracy > review false positives > infra reliability

**R&D process:** Trace → Hypothesize (one falsifiable line) → Prototype → Measure (queue 1-2 builds) → Ship or kill

**Build verification required:** Every hypothesis touching game quality MUST be verified with at least one real build showing a before/after metric.

**Constraints:** R&D never blocks critical work. Must produce a measurable result — "made it cleaner" is not R&D.

**Never sit idle waiting for a build.** While a verification build runs, the R&D sub-agent must be doing real work: analysing prior build logs, drafting the next hypothesis, writing the prompt rule, updating docs, or pre-staging the next fix. "Waiting for results" is not a task — it is idling. If there is nothing to implement yet, analyse the next failure pattern in the backlog and draft the hypothesis.

### 14. Always maintain one active local test slot — MANDATORY

**Local testing is always running.** One sub-agent must ALWAYS be running `diagnostic.js` against a recently failed build.

**How to pick:** Query DB for recent failures → skip cancelled/approved/queued → prioritise games with incomplete RCA §2/§3.

**Required output per session:** Update `docs/spec_rca/<game-id>.md` with §2 (evidence) and §3 (POC). Classify as:

| Verdict | Meaning | Next action |
|---------|---------|-------------|
| **HTML bug** | Game broken in browser | POC fix → hand to R&D as gen prompt rule + T1 check |
| **Test bug** | Game correct, tests wrong | Test-gen prompt fix hypothesis → hand to R&D |

"Reading the HTML" does not count — must run the browser. "Game passes locally" is a valid finding only if classified as a test bug with a specific assertion identified.

**Never sit idle waiting for a build.** While a build runs, the local test slot sub-agent must be running `diagnostic.js` against a different recently failed game, or — if all recent failures are fully diagnosed — drafting the RCA doc, writing the T1 check, or preparing the gen prompt fix for handoff to R&D. "Waiting for build results" is not work.

### 15. Always maintain one active Education Implementation Slot — MANDATORY

**Education implementation is always running.** One sub-agent must ALWAYS be actively implementing educational improvements. R&D targets pipeline reliability; Education targets learning science and content quality.

**Priorities:** (1) Next unbuilt game in active session sequence, (2) New interaction patterns at apply/analyze/create Bloom's level, (3) New session plan for a different curriculum area.

**Process:** Research → Spec draft (check CDN compliance) → Build verification → Measure learning quality → Ship or iterate.

**Documentation mandate — after every Education build result, update ALL of:**
1. `docs/education/trig-session.md` (or relevant session file)
2. `docs/education/interaction-patterns.md`
3. `docs/education/README.md`
4. `ROADMAP.md` Education section
5. `docs/spec_rca/<game-id>.md`

**Constraints:** Must produce a measurable artifact per session. Education slot never blocks critical pipeline work.

**Never sit idle waiting for a build.** While a build runs, the Education sub-agent must be working on the next deliverable: spec-drafting the next game in the session sequence, updating interaction-patterns.md, researching Bloom level design for an upcoming game, or preparing the which-ratio/compute-it/real-world spec. "Waiting for build results" is not work. Always have the next game's spec at least 50% drafted before the current build completes.

### 16. Always maintain one active UI/UX Slot — MANDATORY

**UI/UX review is always running.** One sub-agent must ALWAYS be actively auditing the visual and interaction quality of approved games. R&D targets pipeline reliability; Education targets learning science; UI/UX targets the learner's sensory and interaction experience.

**What UI/UX covers:** visual layout and spacing, mobile responsiveness (480px), colour contrast and accessibility, feedback clarity (correct/incorrect states), animation and transition quality, progress indicators, button affordance, error states, loading states, and consistency across games in a session.

**How to pick the target game:** Start with the most recently approved game that has not had a UI/UX audit. Then work backwards through the approved game library. Record audit status in `docs/ui-ux/audit-log.md`.

**Required output per session:**
1. Screenshot audit — run `diagnostic.js` against the approved HTML, capture screenshots at every phase
2. Issue list — categorise as: (a) gen prompt rule (fix at generation time), (b) spec addition (add visual requirement to spec), or (c) CDN constraint (not fixable without CDN changes)
3. For each (a) issue: propose a gen prompt rule addition; hand to R&D
4. For each (b) issue: open a spec revision PR or note in the spec_rca doc
5. Update `docs/ui-ux/audit-log.md` with game, date, issues found, and resolution path

**Never sit idle waiting for a build.** While a build runs, the UI/UX sub-agent must be running a visual audit on an already-approved game, drafting prompt rules from prior audit findings, or updating `docs/ui-ux/audit-log.md`. "Waiting for results" is not work.

**Constraints:** UI/UX never blocks critical pipeline work. Must produce a documented issue list per session — "looks fine" is not an audit.

### 17. Session restore — run this checklist at every session start or after context compaction

1. **CronList** — if <5 crons (excluding disabled Cron 3), recreate all from `docs/areas/crons.md`.
2. **Running agents** — relaunch any mid-flight agents from the conversation summary.
3. **Build pipeline** — SSH, confirm worker running, no build stuck >45 min.
4. **R&D slot** — confirm one task marked `active` in `ROADMAP.md`. If empty, launch immediately.
5. **Local test slot** — confirm active + previous session produced HTML/test-bug classification + R&D handoff.
6. **Education slot** — confirm active task; read `docs/education/trig-session.md` for current state.
7. **UI/UX slot** — confirm active audit target; read `docs/ui-ux/audit-log.md` for current state. If doc doesn't exist yet, create it and start with the most recently approved game.
