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
npm test               # Run all 334 tests (19 test files)
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

CDN games must expose `window.endGame = endGame` (local functions defined in DOMContentLoaded are not on window).

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
