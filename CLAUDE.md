# Ralph Pipeline

Automated game-building pipeline. Takes game specs (Markdown), generates validated HTML game artifacts using LLMs, runs Playwright tests, and produces approval/failure reports.

## Architecture

```
GitHub webhook → server.js (Express) → BullMQ queue → worker.js → ralph.sh (bash pipeline)
                                                                      ↓
                                                              CLIProxyAPI → Claude/Gemini/Codex
```

- **server.js** — Webhook receiver + REST API. Verifies HMAC-SHA256, extracts changed specs, queues jobs. Refuses to start without webhook secret in production.
- **worker.js** — BullMQ consumer. Runs ralph.sh via `execFile`, reads ralph-report.json, updates DB + Slack.
- **ralph.sh** — Core bash pipeline: generate HTML → static + contract validation → generate tests → test/fix loop (up to 5 iterations with smart retry escalation) → review → post-approval (inputSchema, deploy).
- **lib/** — Shared modules: db (SQLite), metrics (Prometheus), slack, logger, sentry, validate-static, validate-contract, llm.

## Commands

```bash
npm start              # Start webhook server (port 3000)
npm run worker         # Start BullMQ worker
npm test               # Run all 219 tests (16 test files)
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

**Test files:** db, llm, logger, metrics, sentry, server, slack, validate-static, validate-contract, worker, ralph-sh, e2e, proxy-contract, load, pipeline, failure-patterns.

## Key Files

| File | Purpose |
|------|---------|
| server.js | Express app: webhook + API routes |
| worker.js | BullMQ worker: job processing |
| ralph.sh | Bash pipeline: LLM generation + validation + deploy |
| lib/db.js | SQLite: builds table, CRUD, stats |
| lib/metrics.js | Prometheus counters/gauges/histograms |
| lib/validate-static.js | T1 static HTML checks (CLI tool, 10 error checks + 2 warnings) |
| lib/validate-contract.js | T2 contract validation (gameState, postMessage, scoring contracts) |
| lib/slack.js | Slack webhook notifications |
| lib/logger.js | Structured JSON logging (optional GCP) |
| lib/sentry.js | Error monitoring (optional Sentry, v8 API normalized) |
| lib/pipeline.js | Node.js pipeline (E3): full pipeline replacement for ralph.sh |
| lib/llm.js | Node.js LLM client (used by pipeline.js and tests) |
| nginx.conf | Nginx reverse proxy: TLS, rate limiting, security headers |
| Dockerfile | Multi-stage build: node:20-slim, non-root user, healthcheck |
| monitoring/alerts.yml | 6 Prometheus alert rules |
| monitoring/grafana-dashboard.json | 5-row Grafana dashboard |
| .eslintrc.js | ESLint config (strict mode, best practices, style rules) |
| .prettierrc.json | Prettier config (single quotes, trailing commas, 120 width) |

## Environment

Requires Node.js >=20, Redis for BullMQ. See `.env.example` for all 39 config vars.

Optional: `@sentry/node` (SENTRY_DSN), `@google-cloud/logging` (GOOGLE_CLOUD_PROJECT), Slack (SLACK_WEBHOOK_URL). These are `optionalDependencies` — install failures won't block the app.

**Critical:** `GITHUB_WEBHOOK_SECRET` is required when `NODE_ENV=production`.

**New env vars:**
- `RALPH_ENABLE_CACHE=1` — Enable E6 spec caching (sha256-based)
- `RALPH_CACHE_DIR` — Cache directory (default: `~/.ralph-cache`)
- `RALPH_WAREHOUSE_DIR` — Warehouse directory for E9 spec validation
- `RALPH_DEPLOY_ENABLED=1` — Enable E10 post-approval deployment
- `RALPH_DEPLOY_DIR` — Deployment artifact directory
- `RALPH_USE_NODE_PIPELINE=1` — Use Node.js pipeline (E3) instead of ralph.sh

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

## Roadmap

See `ROADMAP.md` for full tracking across 6 pillars (52 items, 51 done, 1 planned).
