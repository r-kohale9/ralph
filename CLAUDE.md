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
npm test               # Run all 385 tests (19 test files)
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

## Key Files

| File | Purpose |
|------|---------|
| server.js | Express app: webhook + API + MCP + Slack Events routes |
| worker.js | BullMQ worker: job processing, Slack threading, GCP upload, learnings |
| ralph.sh | Bash pipeline: LLM generation + validation + deploy |
| lib/db.js | SQLite: builds, games, learnings, failure_patterns tables + CRUD |
| lib/validate-static.js | T1 static HTML checks (CLI tool, 10 error checks + 2 warnings) |
| lib/validate-contract.js | T2 contract validation (gameState, postMessage, scoring contracts) |
| lib/slack.js | Dual-mode Slack (Web API threading + webhook fallback), Events API handler |
| lib/pipeline.js | Node.js pipeline (E3) + targeted fix: full pipeline + feedback-driven fix |
| lib/llm.js | Node.js LLM client (used by pipeline.js and tests) |
| nginx.conf | Nginx reverse proxy: TLS, rate limiting, security headers |
| Dockerfile | Multi-stage build: node:20-slim, non-root user, healthcheck |

## Environment

Requires Node.js >=20, Redis for BullMQ. See `.env.example` for all config vars. **Critical:** `GITHUB_WEBHOOK_SECRET` required when `NODE_ENV=production`.

Key env vars: `RALPH_ENABLE_CACHE=1`, `RALPH_USE_NODE_PIPELINE=1`, `RALPH_DEPLOY_ENABLED=1`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`, `RALPH_GCP_BUCKET`, `RALPH_WAREHOUSE_DIR`, `RALPH_DEPLOY_DIR`.

Optional deps (install failures won't block): `@sentry/node`, `@google-cloud/logging`, `@slack/web-api`, `@google-cloud/storage`.

## Database Tables

| Table | Purpose |
|-------|---------|
| builds | Build records: id, game_id, status, iterations, test_results, feedback_prompt, gcp_url |
| games | Game registry: game_id (PK), title, spec_content, spec_hash, status, slack_thread_ts, gcp_url |
| learnings | Accumulated insights: game_id, build_id, level, category, content, source, resolved |
| failure_patterns | E7 failure tracking: game_id, pattern, category, occurrences |

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | /webhook/github | GitHub push webhook |
| POST | /api/build | Manual build trigger |
| GET | /api/builds | Build list + stats |
| GET/POST | /api/games | List/create games |
| GET/POST | /api/learnings | List/create learnings |
| POST | /api/fix | Trigger targeted fix |
| POST/GET/DELETE | /mcp | MCP Streamable HTTP transport |
| POST | /slack/events | Slack Events API handler |
| GET | /metrics | Prometheus metrics |
| GET | /health | Health check |

## Code Style

- `'use strict'` in all modules, CommonJS (`require`/`module.exports`), no TypeScript
- ESLint + Prettier configured (see `.eslintrc.js`, `.prettierrc.json`)
- Express 5.x — async errors caught automatically; SQLite via better-sqlite3 (synchronous)
- `lastInsertRowid` must be wrapped in `Number()` (BigInt issue)

## Known Constraints

- `llm.js` used by `pipeline.js` (E3) and tests; `ralph.sh` still calls CLIProxyAPI via curl.
- Worker supports dual-mode: bash (`ralph.sh`, default) or Node.js (`pipeline.js`, opt-in via `RALPH_USE_NODE_PIPELINE=1`).
- `validate-static.js` checks `id="gameContent"` via regex.

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

**Kill a build immediately if:** infrastructure issues cause test failures, pipeline code was wrong at build start, iteration 2+ with 0 pass rate and clearly wrong HTML, or same test fails iterations 1 and 2 with same error.

**Parallel work rule (CRITICAL):** Never idle waiting for a build — diagnose failures, fix code, deploy, and queue the next build in parallel.

## Test Harness Architecture

Every generated HTML gets `<script id="ralph-test-harness">` injected by pipeline (not LLM). Key APIs:
- `window.__ralph` — `.answer()`, `.endGame()`, `.jumpToRound()`, `.setLives()`, `.getState()`, `.getLastPostMessage()`
- `syncDOMState()` — syncs `data-phase`/`data-lives`/`data-round`/`data-score` on `#app` every 500ms
- Shared test helpers: `waitForPhase(page, phase)`, `getLives/getScore/getRound(page)`, `skipToEnd(page, reason)`, `answer(page, correct)`
- Phase normalization: `game_over` → `gameover`, `game_complete` → `results`, `start_screen` → `start`
- `extractSpecMetadata(specContent)` and `injectTestHarness(html, specMeta)` exported from `lib/pipeline.js`

CDN games must expose:
- `window.endGame = endGame`, `window.restartGame = restartGame`, `window.nextRound = nextRound` — local functions defined in DOMContentLoaded are not on window
- `window.gameState = gameState` — syncDOMState() reads `window.gameState`; if not on window, `data-phase` is NEVER set and ALL `waitForPhase()` calls timeout

These are now checked by T1 static validator (sections 5b3, 5d) and enforced as rules 20/21 in the gen prompts.

## DOM Snapshot & Test Generation Context

`captureGameDomSnapshot()` (lib/pipeline.js Step 2.5) runs headless Playwright against the generated game and captures:
- Element IDs/classes/visibility from start screen and game screen — injected into test-gen prompts as "ACTUAL RUNTIME DOM"
- `window.gameState` shape — property names and value types (e.g. `pattern: Array(4) of number`, `lives: number 3`) injected as "WINDOW.GAMESTATE SHAPE" section, preventing test generators from guessing wrong data structures (Lesson 42)
- `window.gameState?.content` saved to `tests/game-content.json` for fallbackContent when DOM snapshot rounds are empty

If snapshot fails (timeout on CDN transition slot), falls back to static HTML element extraction (no runtime state shape).

## Pipeline Lessons

See `docs/lessons-learned.md` for accumulated build lessons and proof log. Read before diagnosing failures or modifying pipeline code.

## Build Management

See `docs/build-manager-agent.md` for kill criteria, lifecycle commands, and monitoring rules. Kill builds the moment they've served their purpose — never wait for a build running on old pipeline code or stuck at 0% pass rate.

## Roadmap

See `ROADMAP.md` for full tracking across all pillars.

## Agent Self-Improvement (REQUIRED)

After every build run, pipeline fix, new failure pattern, or architectural decision:

1. **Update `docs/lessons-learned.md`** — add any new failure pattern with the fix and proof
2. **Update `docs/build-manager-agent.md`** — refine kill criteria and lifecycle rules based on what was observed
3. **Update `CLAUDE.md`** — keep it accurate as the single source of truth for any new agent starting a session
4. **Update `ROADMAP.md`** — mark completed items done, add newly discovered improvements as planned

Goal: any future agent reading these docs should operate without rediscovering known patterns. Reliability, availability, consistency, and efficiency improve only if lessons are captured immediately — not after the fact.

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
6. One-line flag if anything needs attention

Delegate the send to a sub-agent — do not block the main context.

### 10. Always explain the value of a running build when reporting status
When reporting on any running build — in chat OR in Slack notifications — always include: (1) what we expect to learn or gain if it completes successfully, (2) why it has not been killed yet — what kill criteria it has NOT yet met. Always use the CURRENTLY running build (status=running in DB) — never reference a failed/orphaned build as "running". A build costs time and money; the manager must know whether to let it run or cut losses. Format: "Value if completes: <X>. Not killed because: <Y>."

### 11. You are a manager/orchestrator — never sit idle, never do implementation work yourself

**Never sit idle while async tasks are running.** Background agents are async — while they work, you must immediately identify and start the next highest-value task. After launching any sub-agent or after any user message, always ask: "What is the next thing I can do right now?" Then do it. Waiting for an agent to finish before acting is wasted time.

Delegate ALL implementation, research, and long-running tasks to sub-agents. The parent agent must remain available to the user at all times. Never get buried in code, file edits, or multi-step tasks directly — spawn an agent, give it a clear brief, and return to the user immediately. This applies to: writing/editing code, running tests, deploying files, investigating failures, reading large files. The only work done in the main context is short coordination tasks (reading a single file, queuing a build, checking status).

### 10. Always maintain one active R&D task — MANDATORY, NON-NEGOTIABLE, NEVER TOLERATED TO VIOLATE

**R&D is always running. This is not optional.** One sub-agent must ALWAYS be actively working on an R&D task. The moment a R&D task completes or ships, immediately — in the same response — pick the next task and launch a new R&D sub-agent. Do NOT wait for the user to ask. Do NOT let the slot go passive ("measure impact later"). A passive measurement task that requires no active work does NOT count.

One item must always be present in `ROADMAP.md` under `## R&D` with status `active`. Never leave the slot empty.

**How to pick the R&D task:** Target the single highest-leverage pain point visible in live build data. The best R&D starts with observation:
- Pull recent build traces: iteration counts, failure patterns, which test categories fail most, how long each step takes
- Read `docs/lessons-learned.md` for open hypotheses
- Ask: "If this one thing were fixed, how many of the last 10 builds would have gone differently?"
- Prioritise: test gen quality > fix loop accuracy > review false positives > infra reliability

**How to run R&D:** Don't just implement — experiment first:
1. **Trace** — gather real data from recent builds (DB queries, log analysis, GCP HTML inspection)
2. **Hypothesize** — write a one-line falsifiable hypothesis ("if we inject X into fix prompt at iter 1, avg iterations drop from 3 → 1.5")
3. **Prototype** — implement in a branch or inline, write tests
4. **Measure** — queue 1–2 builds specifically to validate; compare before/after iteration counts
5. **Ship or kill** — if hypothesis confirmed: commit + deploy + update ROADMAP; if not: document what was learned, pick next

**Non-negotiable constraints:**
- R&D never blocks critical work. If a build needs a kill, a pipeline bug needs a fix, or a deploy is needed — stop R&D immediately, handle it, then resume.
- R&D runs in a sub-agent so the main context stays free for the user and for monitoring.
- R&D must produce a measurable result (test count, iteration count, pass rate) — "made it cleaner" is not R&D, it's housekeeping.

### 12. At session start and after every context compaction — restore background task continuity

When starting a new session or resuming after context compaction:
1. **Check CronList** — verify the 15-minute Slack update cron is running. If missing, recreate it immediately using the prompt from Rule 10.
2. **Check running sub-agents** — review the conversation summary or task notifications to identify any agents that were mid-flight. If their results are pending, relaunch them with the same brief.
3. **Check build pipeline** — SSH to server and confirm worker is running and no build has been stuck >45 min.
4. **Check ROADMAP.md R&D slot** — confirm one R&D task is marked `active`. If the slot is empty or passive, pick the next highest-leverage item and launch a sub-agent immediately.

This rule exists because session compaction silently kills all crons, loses agent context, and can leave background work orphaned. Any future agent starting a session must run this checklist before doing anything else.
