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

Tests use Node.js built-in test runner (`node --test`). No external test framework.

```bash
node --test test/*.test.js           # All 219 tests
node --test test/db.test.js          # Single file
```

Tests mock external dependencies (Redis, fetch, filesystem) — no infrastructure needed.

**Test files:** db, games-learnings, gcp, llm, logger, mcp, metrics, sentry, server, slack, validate-static, validate-contract, worker, ralph-sh, e2e, proxy-contract, load, pipeline, failure-patterns.

## Key Files

| File | Purpose |
|------|---------|
| server.js | Express app: webhook + API + MCP + Slack Events routes |
| worker.js | BullMQ worker: job processing, Slack threading, GCP upload, learnings |
| ralph.sh | Bash pipeline: LLM generation + validation + deploy |
| lib/db.js | SQLite: builds, games, learnings, failure_patterns tables + CRUD |
| lib/metrics.js | Prometheus counters/gauges/histograms |
| lib/validate-static.js | T1 static HTML checks (CLI tool, 10 error checks + 2 warnings) |
| lib/validate-contract.js | T2 contract validation (gameState, postMessage, scoring contracts) |
| lib/slack.js | Dual-mode Slack (Web API threading + webhook fallback), Events API handler |
| lib/gcp.js | GCP Cloud Storage upload (optional dep, Application Default Credentials) |
| lib/mcp.js | MCP server with 5 tools (register_spec, get_build_status, list_games, add_learning, get_learnings) |
| lib/logger.js | Structured JSON logging (optional GCP) |
| lib/sentry.js | Error monitoring (optional Sentry, v8 API normalized) |
| lib/pipeline.js | Node.js pipeline (E3) + targeted fix: full pipeline + feedback-driven fix |
| lib/llm.js | Node.js LLM client (used by pipeline.js and tests) |
| nginx.conf | Nginx reverse proxy: TLS, rate limiting, security headers |
| Dockerfile | Multi-stage build: node:20-slim, non-root user, healthcheck |
| monitoring/alerts.yml | 6 Prometheus alert rules |
| monitoring/grafana-dashboard.json | 5-row Grafana dashboard |
| .eslintrc.js | ESLint config (strict mode, best practices, style rules) |
| .prettierrc.json | Prettier config (single quotes, trailing commas, 120 width) |

## Environment

Requires Node.js >=20, Redis for BullMQ. See `.env.example` for all config vars.

Optional: `@sentry/node` (SENTRY_DSN), `@google-cloud/logging` (GOOGLE_CLOUD_PROJECT), `@slack/web-api` (SLACK_BOT_TOKEN), `@google-cloud/storage` (RALPH_GCP_BUCKET). These are `optionalDependencies` — install failures won't block the app.

Required: `@modelcontextprotocol/sdk` and `zod` (in dependencies for MCP server).

**Critical:** `GITHUB_WEBHOOK_SECRET` is required when `NODE_ENV=production`.

**New env vars:**
- `RALPH_ENABLE_CACHE=1` — Enable E6 spec caching (sha256-based)
- `RALPH_CACHE_DIR` — Cache directory (default: `~/.ralph-cache`)
- `RALPH_WAREHOUSE_DIR` — Warehouse directory for E9 spec validation
- `RALPH_DEPLOY_ENABLED=1` — Enable E10 post-approval deployment
- `RALPH_DEPLOY_DIR` — Deployment artifact directory
- `RALPH_USE_NODE_PIPELINE=1` — Use Node.js pipeline (E3) instead of ralph.sh
- `SLACK_BOT_TOKEN` — Slack Bot User OAuth Token for Web API (threading, Block Kit)
- `SLACK_SIGNING_SECRET` — Slack signing secret for Events API signature verification
- `SLACK_CHANNEL_ID` — Default Slack channel for game build threads
- `RALPH_GCP_BUCKET` — GCP Cloud Storage bucket for game artifact uploads
- `RALPH_GCP_PROJECT` — GCP project ID (optional, uses Application Default Credentials)

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
| GET | /api/builds/:id | Build details |
| GET | /api/games/:gameId/builds | Builds for a game |
| GET/POST | /api/games | List/create games |
| GET | /api/games/:gameId | Game details |
| GET/POST | /api/learnings | List/create learnings |
| POST | /api/fix | Trigger targeted fix |
| POST/GET/DELETE | /mcp | MCP Streamable HTTP transport |
| POST | /slack/events | Slack Events API handler |
| GET | /api/failure-patterns | Failure patterns |
| GET | /metrics | Prometheus metrics |
| GET | /health | Health check |

## Code Style

- `'use strict'` in all modules
- CommonJS (`require`/`module.exports`)
- No TypeScript
- ESLint + Prettier configured (see `.eslintrc.js`, `.prettierrc.json`)
- Express 5.x — async errors caught automatically, no try/catch needed
- SQLite via better-sqlite3 (synchronous API)
- `lastInsertRowid` must be wrapped in `Number()` (BigInt issue)

## Known Constraints

- `llm.js` is used by `pipeline.js` (E3) and tests. ralph.sh still calls CLIProxyAPI via curl.
- validate-static.js checks `id="gameContent"` via regex (improved from bare string match).
- Worker supports dual-mode: bash (ralph.sh, default) or Node.js (pipeline.js, opt-in via `RALPH_USE_NODE_PIPELINE=1`).

## Server Operations (GCP: 34.93.153.206)

SSH key: `~/.ssh/google_compute_engine`, user: `the-hw-app`. Cannot SCP directly to `/opt/ralph` (permission denied) — use `/tmp` staging:

```bash
# Deploy a file
scp -i ~/.ssh/google_compute_engine lib/pipeline.js the-hw-app@34.93.153.206:/tmp/pipeline.js
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "sudo cp /tmp/pipeline.js /opt/ralph/lib/pipeline.js && sudo systemctl restart ralph-worker"

# Watch live logs
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "journalctl -u ralph-worker -f --no-pager"

# Queue a build
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "curl -s -X POST http://localhost:3000/api/build -H 'Content-Type: application/json' -d '{\"gameId\":\"doubles\"}'"

# Kill a stuck/useless build
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "
  sudo systemctl kill --signal=SIGKILL ralph-worker
  redis-cli DEL 'bull:ralph-builds:{jobId}:lock'
  sleep 2 && sudo systemctl start ralph-worker
"
# Then mark the build failed in DB via:
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"require('./lib/db').failBuild(199, 'reason')\""
```

**When to kill a build:** Kill immediately if:
- Tests fail due to infrastructure issues (e.g. `data-phase` attribute missing because new harness not deployed)
- The underlying pipeline code was wrong when the build started (redeploy first, then requeue)
- The build is on iteration 2+ with 0 pass rate and the HTML is clearly wrong
- The same test fails in iteration 1 and 2 with the same error — root cause is clear, don't wait for iteration 3
- Never let a broken build run 3 full iterations wasting tokens — kill early and fix the root cause first.

**Parallel work rule (CRITICAL):** Never sit idle waiting for a build. While a build runs:
- Analyze iteration-1 failures and diagnose root cause
- Fix code, commit, push, deploy the fix (worker will pick it up for the next build)
- Kill the running build if the root cause is now known and it can't recover
- Update docs, memory, or other tasks in parallel
- Queue the next fixed build before the broken one finishes

## Test Harness Architecture (Phase 1 — implemented)

Every generated HTML gets `<script id="ralph-test-harness">` injected by pipeline (not LLM):
- `window.__ralph` — interaction-type-specific shortcuts: `.answer()`, `.endGame()`, `.jumpToRound()`, `.setLives()`, `.getState()`, `.getLastPostMessage()`
- `syncDOMState()` — keeps `data-phase`/`data-lives`/`data-round`/`data-score` on `#app` current; runs every 500ms. Uses `gameState.phase` if present (CDN games track their own phase); falls back to computed value. NEVER overwrite if game uses `setPhase()`.
- postMessage capture — `window.__lastPostMessage` for contract tests

Shared boilerplate helpers (in every spec file, not LLM-generated):
- `waitForPhase(page, phase)` — reads `data-phase` on `#app`; use instead of `toBeVisible` for phase transitions
- `getLives(page)`, `getScore(page)`, `getRound(page)` — integers from `data-*`, not text/emoji
- `skipToEnd(page, reason)` — calls `window.__ralph.endGame(reason)` directly
- `answer(page, correct)` — calls `window.__ralph.answer()` and waits for `isProcessing` to clear

`extractSpecMetadata(specContent)` reads interaction type, rounds, lives, star logic from spec.
`injectTestHarness(html, specMeta)` appends the harness; idempotent (won't double-inject).
Both exported from `lib/pipeline.js`.

## Roadmap

See `ROADMAP.md` for full tracking across 6 pillars (52 items, 51 done, 1 planned).
