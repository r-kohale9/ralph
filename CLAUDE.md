# Ralph Pipeline

Automated game-building pipeline. Takes game specs (Markdown), generates validated HTML game artifacts using LLMs, runs Playwright tests, and produces approval/failure reports.

## Architecture

```
GitHub webhook → server.js (Express) → BullMQ queue → worker.js → ralph.sh (bash pipeline)
                                                                      ↓
                                                              CLIProxyAPI → Claude/Gemini/Codex
```

- **server.js** — Webhook receiver + REST API. Verifies HMAC-SHA256, extracts changed specs, queues jobs.
- **worker.js** — BullMQ consumer. Runs ralph.sh via `execFile`, reads ralph-report.json, updates DB + Slack.
- **ralph.sh** — Core 677-line bash pipeline: generate HTML → static validation → generate tests → test/fix loop → review.
- **lib/** — Shared modules: db (SQLite), metrics (Prometheus), slack, logger, sentry, validate-static, llm.

## Commands

```bash
npm start          # Start webhook server (port 3000)
npm run worker     # Start BullMQ worker
npm test           # Run all 96 unit tests
npm run validate   # Run static HTML validator on a file
```

## Testing

Tests use Node.js built-in test runner (`node --test`). No external test framework.

```bash
node --test test/*.test.js           # All tests
node --test test/db.test.js          # Single file
```

Tests mock external dependencies (Redis, fetch, filesystem) — no infrastructure needed.

## Key Files

| File | Purpose |
|------|---------|
| server.js | Express app: webhook + API routes |
| worker.js | BullMQ worker: job processing |
| ralph.sh | Bash pipeline: LLM generation + validation |
| lib/db.js | SQLite: builds table, CRUD, stats |
| lib/metrics.js | Prometheus counters/gauges/histograms |
| lib/validate-static.js | T1 static HTML checks (CLI tool) |
| lib/slack.js | Slack webhook notifications |
| lib/logger.js | Structured JSON logging (optional GCP) |
| lib/sentry.js | Error monitoring (optional Sentry) |
| lib/llm.js | Node.js LLM client (currently unused — ralph.sh uses curl) |

## Environment

Requires Node.js >=20, Redis for BullMQ. See `.env.example` for all 39 config vars.

Optional: `@sentry/node` (SENTRY_DSN), `@google-cloud/logging` (GOOGLE_CLOUD_PROJECT), Slack (SLACK_WEBHOOK_URL).

## Code Style

- `'use strict'` in all modules
- CommonJS (`require`/`module.exports`)
- No TypeScript, no ESLint configured
- Express 4.x (not 5) — async routes need manual try/catch
- SQLite via better-sqlite3 (synchronous API)
- `lastInsertRowid` must be wrapped in `Number()` (BigInt issue)

## Known Constraints

- `llm.js` is dead code — ralph.sh calls CLIProxyAPI via curl directly
- Sentry v8 span API doesn't match v7 transaction calls in worker.js (guarded with `&&`)
- validate-static.js has weak pattern matching (`includes('gameContent')` matches comments too)
- Star threshold checks (`includes('80')`) have high false-positive rate
