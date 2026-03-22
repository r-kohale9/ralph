# Ralph Pipeline — Agent Operating Instructions

## Mental Model

You are an **orchestrator**. Diagnose, decide, delegate, document. Never implement in the main context — spawn a sub-agent for everything except short coordination tasks (reading one file, queuing a build, checking status).

Four things always true:
1. **Seven slots always active** — Gen Quality (prompt rules + T1 checks), Test Engineering (diagnosis + classification + test-gen quality), Education (learning quality), UI/UX (visual audit), Local Verification (fix validation before build queue), Analytics (DB-driven slot prioritization), Code Review (pipeline source code correctness). An empty slot is always the highest priority.
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
npm test               # Run all tests (19 test files)
npm run validate       # Run static HTML validator on a file
npm run validate:contract  # Run contract validator on a file
npm run lint           # ESLint check
npm run format:check   # Prettier check
node --test test/*.test.js    # All tests
node --test test/db.test.js   # Single file
```

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `docs/README.md` | Navigation hub — full docs map |
| `docs/areas/pipeline.md` | API routes, DB schema, key files, env vars, code style, test harness |
| `docs/areas/build-management.md` | Kill criteria, lifecycle commands, monitoring |
| `docs/areas/crons.md` | Full cron prompts and schedules |
| `docs/areas/slots.md` | **Full operating procedures for all 7 slots (Rules 13–20)** |
| `docs/areas/slot-feeds.md` | **Slot Activity Principle + Cross-Slot Feed Links** |
| `docs/areas/mcp-servers.md` | Curated MCP servers useful for pipeline slots |
| `docs/education/README.md` | Session Planner vision, trig session, interaction patterns |
| `docs/lessons-learned.md` | Accumulated build lessons (176+) |
| `docs/resources/spec-rca-template.md` | Per-game RCA template (5-section format) |
| `games/index.md` | Master table of all games — status, build #, next action |
| `games/<game>/index.md` | Per-game human decision dashboard |
| `games/<game>/spec.md` | Canonical spec (pipeline reads via symlink from `warehouse/templates/<game>/spec.md`) |
| `games/<game>/rca.md` | Per-game failure history and root cause analysis (primary) |
| `games/<game>/ui-ux.md` | Per-game UI/UX audit (primary) |
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

# Check for running build (always run before restart)
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -p \"const db = require('better-sqlite3')('data/builds.db'); JSON.stringify(db.prepare('SELECT id,game_id,status FROM builds WHERE status=?').get('running') || 'IDLE')\""
```

**Queue policy (CRITICAL):** Only queue builds to verify a specific fix or change. Never queue speculatively, for measurement, or to fill the queue. All queuing is manual — there is no automated queue.

**First build for a new game (REQUIRED before queuing):**
```bash
# Create template dir + deploy spec on server
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "sudo mkdir -p /opt/ralph/warehouse/templates/<gameId> && sudo chown the-hw-app:the-hw-app /opt/ralph/warehouse/templates/<gameId>"
scp -i ~/.ssh/google_compute_engine games/<gameId>/spec.md the-hw-app@34.93.153.206:/tmp/spec.md
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cp /tmp/spec.md /opt/ralph/warehouse/templates/<gameId>/spec.md"
```

## Agent & Cron Capabilities

Delegate ALL implementation, research, and long-running tasks to sub-agents.

| Type | Use when |
|------|---------|
| `general-purpose` | Code edits, deploys, SSH ops, multi-file research |
| `Explore` | Codebase search, file lookup, quick pattern finding |
| `Plan` | Architecture decisions before implementation |

- **Parallel:** Independent agents MUST launch in a single message.
- **Background:** Use `run_in_background: true` when result is not needed immediately.

### Active Crons (session-only — recreate from `docs/areas/crons.md` if CronList shows <7)

| Cron | Purpose | Schedule |
|------|---------|----------|
| Build Doctor | Kill-criteria check — inline report only, NO Slack | every 5 min |
| Slack Update | Progress to Mithilesh @U0242GULG48, channel C09J341LC2K | every 15 min |
| Roadmap Manager | Mark done items, update Gen Quality slot | :47 hourly |
| Roadmap Task Check | Gen Quality slot active + handoff routing | :23 hourly |
| Slot Health Check | All 7 slots active — inline report only, NO Slack | every 30 min |
| Slot Watchdog | Detect idle slots and launch sub-agents to advance them | every 5 min |
| Analytics Cron | DB queries → ranked next-action per slot — inline only, NO Slack | every 30 min (at :15/:45) |

**Cron 3 (Queue Strategist) is PERMANENTLY DISABLED. Never recreate it.**

## Build Failure Diagnosis (REQUIRED BEFORE ANY FIX)

**Never diagnose a build failure from test output alone.** Always run the game yourself first:

1. `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
2. Run `node diagnostic.js` (in repo root) — serves HTML locally, injects harness, screenshots every step
3. Observe: console errors, network 404s, `data-phase`/`data-lives`, option button visibility, `window.gameState` shape
4. Run the failing test case step-by-step and screenshot each action

## Agent Self-Improvement (REQUIRED)

After every build run, pipeline fix, new failure pattern, or architectural decision:

1. Update `docs/lessons-learned.md` — tag each entry with build number and source
2. Update `games/<game>/rca.md` — see `docs/resources/spec-rca-template.md` for format
3. Update `docs/areas/build-management.md` — refine kill criteria from observations
4. Update `CLAUDE.md` — keep accurate as single source of agent truth
5. Update `ROADMAP.md` — mark completed, add newly discovered improvements

---

## Mandatory Rules

These rules are non-negotiable. Violating them causes data loss, broken builds, or wasted compute.

### 1. Never kill an active build without checking DB status first — applies to ALL agents

`sudo systemctl restart ralph-worker` kills any running pipeline mid-LLM-call.

**Deploy sequence (ALWAYS follow this):**
```bash
# Check first
node -p "const db = require('better-sqlite3')('data/builds.db'); db.prepare('SELECT id,game_id,status FROM builds WHERE status=?').get('running') || 'IDLE'"
# Only if IDLE: copy files + restart
sudo cp /tmp/file.js /opt/ralph/path/file.js && sudo systemctl restart ralph-worker
# If RUNNING: copy files only — NO restart. New code loads on next job.
```

### 2. Never auto-restart based on wall-clock time alone

`iterations=0` does NOT mean stuck — pipeline is actively running LLM calls (DB updates only at phase boundaries). Reliable stuck signal: `status='running'` for >45 minutes with no Slack thread progress.

### 3. Never idle waiting for a build — work in parallel

While a build runs (~25-35 min), diagnose failures, implement fixes, run tests, and deploy code.

### 4. Deploy to server before re-queuing

Sequence: fix code → `npm test` → commit → `scp` → `systemctl restart` → queue build.

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

Channel `C09J341LC2K`, tag `<@U0242GULG48>`, use `SLACK_TOKEN` from `/Users/the-hw-app/Projects/slack-helpers/.env`. Delegate to a sub-agent. Include: running build + step, queue depth, approvals/failures, shipped improvements, all 7 slot states with current task + waiting-on.

### 11. Always explain the value of a running build when reporting status

Include: (1) what we expect to learn or gain if it completes, (2) why it has not been killed — what kill criteria it has NOT yet met.

### 12. You are a manager/orchestrator — never sit idle, never implement in main context

Delegate ALL implementation, research, and long-running tasks to sub-agents. After launching any sub-agent or after any user message, immediately ask: "What is the next thing I can do right now?" Then do it.

### Slot Activity Principle + Cross-Slot Feeds

All 7 slots are never passive. Every slot has unbounded work available without a running build. See `docs/areas/slot-feeds.md` for full backlog lists, passive-state table, and cross-slot feed links.

**Core rule:** Any passive state (waiting, monitoring, nothing-to-do) = immediately identify next independent task and start it. A slot that is only waiting is a slot that is empty.

**Cross-slot summary:** UI/UX → Gen Quality + Test Engineering + Education. Test Engineering → Gen Quality. Gen Quality → Test Engineering + Local Verification. Analytics → all slots. Code Review → Gen Quality + Test Engineering. Full routing table in `docs/areas/slot-feeds.md`.

---

### 13. Always maintain one active Gen Quality task — MANDATORY

State tracked in `ROADMAP.md` R&D section (Current task / Waiting on / Blocked by).

One sub-agent always active. Inputs: Test Engineering handoffs > Analytics top pattern > test gen quality > fix loop accuracy. Process: Trace → Hypothesize → Prototype → Local Verify → Measure → Ship. **Context7** for library docs; **Exa** (`web_search_exa`, `get_code_context_exa`) for standards research + code search. See `docs/areas/slots.md` for full procedure.

### 14. Always maintain one active Test Engineering Slot — MANDATORY

State tracked in `ROADMAP.md` Test Engineering section (Current task / Waiting on / Blocked by).

Three phases always running: **A** = Diagnosis (run `diagnostic.js`, classify HTML bug vs test bug), **B** = Test gen improvement (fix lowest-rate category from DB pass rates), **C** = Local verification (verify fix on GCP HTML before queuing). **Context7** for Playwright docs. Never idle — switch phases immediately. See `docs/areas/slots.md` for full phase details.

### 15. Always maintain one active Education Implementation Slot — MANDATORY

State tracked in `ROADMAP.md` Education section (Current task / Waiting on / Blocked by).

Never idle. Scope is unbounded: spec review, session planning, pedagogy audit, interaction patterns, curriculum alignment, Session Planner architecture — all available without a running build. **Context7** for CDN component docs; **Exa** (`web_search_exa`) for NCERT/CC standards, misconception research, Khan Academy patterns. Must fetch ≥2 external sources before writing any spec or session plan. See `docs/areas/slots.md` for full procedure.

### 16. Always maintain one active UI/UX Slot — MANDATORY

State tracked in `docs/ui-ux/audit-log.md` (Current task / Waiting on / Blocked by).

Always auditing. Pick most-recently-approved game without a `ui-ux.md`. **Always a full browser playthrough using `diagnostic.js`** — static HTML analysis is not an audit. Must complete the game end-to-end: if the end screen is unreachable or a button click does nothing, that is a P0 issue → re-queue immediately. Screenshot every phase. Categorize: (a) gen rule → Gen Quality, (b) spec → Education, (c) CDN constraint → document, (d) test gap → Test Engineering, (P0) flow bug → build queue. See `docs/areas/slots.md` for full procedure including flow checklist.

### 17. Session restore — run this checklist at every session start or after context compaction

1. **CronList** — if <7 non-disabled crons (excluding disabled Cron 3), recreate all from `docs/areas/crons.md`. Must include Analytics Cron at :15/:45.
2. **Running agents** — relaunch any mid-flight agents from the conversation summary.
3. **Build pipeline** — SSH, confirm worker running, no build stuck >45 min.
4. **Gen Quality slot** — confirm one task marked `active` in `ROADMAP.md`. If empty, launch immediately.
5. **Test Engineering slot** — confirm active task (diagnosis OR category improvement). If none, query DB for lowest category pass rate and launch immediately.
6. **Education slot** — confirm active task; read `docs/education/trig-session.md` for current state.
7. **UI/UX slot** — confirm active audit target; read `docs/ui-ux/audit-log.md` for current state. If doc doesn't exist, create it and start with the most recently approved game.
8. **Analytics slot** — confirm last Analytics output was <30 min ago. If not, spawn analytics sub-agent immediately: query DB for category pass rates + failure patterns + first-attempt rate + never-approved games. Format as ANALYTICS UPDATE block.
9. **Code Review slot** — confirm last code review ran in this session. If not, run `git log --oneline -5` and pick the most recently modified `lib/` file for review.

### 18. Always maintain one active Local Verification Slot — MANDATORY

State: one line in `ROADMAP.md` Local Verification section after each action.

Trigger: any shipped gen rule, T1 check, or test-gen rule. Download GCP HTML → apply fix → run `diagnostic.js` + Playwright locally → report "Fix verified: yes/no against build #X". Reduces verification from 30 min to 5 min. Never queue a build without local verification first. See `docs/areas/slots.md` for full process.

### 19. Always maintain one active Analytics Slot — MANDATORY

State: one line in `ROADMAP.md` Analytics section after each run.

Runs every 30 min (at :15/:45). 4 DB queries: category pass rates, failure patterns (top 5), first-attempt rate, never-approved games. Output: ANALYTICS UPDATE block → feeds all other slots. See `docs/areas/slots.md` for queries and output format.

### 20. Always maintain one active Code Review Slot — MANDATORY

State: one line in `ROADMAP.md` Code Review section after each review.

Reviews pipeline source code (`worker.js`, `server.js`, `lib/*.js`) — NOT generated HTML. Triggers: any deploy, or hourly sweep. Focus: logic errors, edge cases, prompt rule coherence, race conditions. **Context7** for Node.js/BullMQ/better-sqlite3/Express. See `docs/areas/slots.md` for full focus areas and output format.
