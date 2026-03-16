# Ralph Pipeline — Roadmap

**Last updated:** March 16, 2026
**Status legend:** done | in-progress | planned | blocked

---

## P0 — Deployment Blockers (must fix before first production run)

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| HMAC-SHA256 webhook verification | done | server.js:35-70 | Length-safe `timingSafeEqual` |
| BigInt serialization crash | done | db.js:48 | `Number(result.lastInsertRowid)` |
| Async Express error handling | done | server.js:122,174 | try/catch in all async routes |
| LLM infinite recursion on 429 | done | llm.js:19-50 | Max 5 retries with exponential backoff |
| Metrics NaN corruption guard | done | metrics.js:observeHistogram | Rejects null/undefined/NaN |
| Health endpoint crash (Redis down) | done | server.js:243-247 | `getJobCounts` inside try/catch |
| Server reference for graceful shutdown | done | server.js:261 | `const server = app.listen(...)` |
| Refuse to start without webhook secret | planned | server.js | Env guard in production mode |
| Dockerfile for Node.js app | planned | Dockerfile | Containerize server + worker |
| CI/CD pipeline | planned | .github/workflows/ | Lint, test, build, deploy |

## P1 — Testing & Validation Gaps

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Unit tests (96 cases) | done | test/*.test.js | db, metrics, slack, llm, logger, sentry, server, worker, validate-static |
| ralph.sh test coverage | planned | test/ralph-sh.test.js | Bash pipeline has 0 tests; it's the most critical 677 lines |
| End-to-end integration test | planned | test/e2e.test.js | Spin up Express + Redis + worker, send webhook, verify build lifecycle |
| Contract tests (CLIProxyAPI) | planned | test/proxy-contract.test.js | Validate request/response format against proxy |
| T1 validator severity fix | planned | lib/validate-static.js | Promote answer handler, gameState, star thresholds, 480px from warning to error |
| T1 validator pattern matching | planned | lib/validate-static.js | Use `id="gameContent"` regex instead of bare `includes('gameContent')` |
| T2 contract validation layer | planned | lib/validate-contract.js | JSON Schema validation of gameState, postMessage, metrics against warehouse schemas |
| Load/stress tests | planned | test/load/ | Verify queue behavior under 47-template bulk runs |

## P2 — Spec Compliance & Feature Completeness

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| `all: true` bulk rebuild API | planned | server.js:177-182 | Currently returns 501; spec documents it as functional |
| Slack format: show call count | planned | lib/slack.js:31 | Shows `gen=model` instead of spec's `N calls` |
| Column name: `duration_s` alias | done | lib/db.js:93 | `SELECT total_time_s AS duration_s` |
| T6 inputSchema.json generation | planned | ralph.sh | POST_GEN step; blocks P3 (Content Generator) integration |
| E5 event schema validation | planned | Playwright tests | Validate postMessage payloads against warehouse schemas |

## P3 — DevOps & Operations

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| systemd service units | done | systemd/*.service | Server + worker |
| Docker Compose (Redis + proxy) | done | docker-compose.yml | |
| .env.example | done | .env.example | 39 env vars documented |
| Dockerfile (app) | planned | Dockerfile | Multi-stage: build deps → runtime |
| CI/CD: GitHub Actions | planned | .github/workflows/ci.yml | `npm test`, syntax check ralph.sh, lint |
| CI/CD: deploy workflow | planned | .github/workflows/deploy.yml | SSH to VPS, pull, restart services |
| Prometheus alert rules | planned | monitoring/alerts.yml | Build failure rate > 50%, queue depth > 20, active builds stuck |
| Grafana dashboard | planned | monitoring/grafana.json | Build success rate, duration p50/p99, queue depth, LLM call rate |
| Deployment runbook | planned | docs/deployment.md | Step-by-step first deploy + troubleshooting |
| Log rotation config | planned | systemd/ or logrotate.d/ | Prevent disk fill from structured JSON logs |

## P4 — Code Quality & Architecture

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Remove dead code: llm.js | planned | lib/llm.js | Never imported; ralph.sh has its own `call_llm()` via curl. Keep if Node.js migration planned (E3), otherwise remove |
| Sentry v8 API alignment | planned | lib/sentry.js:93-100 | `startInactiveSpan` returns Span without `.setStatus()`/`.finish()`; transaction tracking silently drops |
| Optional dependencies | planned | package.json | Move `@google-cloud/logging` and `@sentry/node` to `optionalDependencies` |
| `commit.removed` handling | planned | server.js:79 | Deleted spec files are silently ignored |

## P5 — Scalability & Intelligence (from spec E1-E10)

| Item | Status | Notes |
|------|--------|-------|
| E1 parallel batch runner | done | BullMQ concurrency=2 + rate limiter handles this |
| E2 smart retry escalation | done | ralph.sh:295-300, diagnosis mode on iteration 3+ |
| E3 migrate CLI to API | planned | Replace `claude -p` with direct API calls; enables cost tracking, streaming, structured I/O |
| E4 warehouse-aware context | planned | Deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt |
| E6 caching / incremental runs | planned | Skip regeneration when spec checksum unchanged |
| E7 failure pattern database | planned | Track systematic failures across 47 templates to improve warehouse |
| E8 diff-based fix prompts | planned | Send only failing test + relevant HTML section instead of full context |
| E9 spec validation against warehouse | planned | Pre-flight: verify referenced parts exist, deps resolved |
| E10 deployment step | planned | After APPROVED: register artifact, generate inputSchema, version tag |

---

## What's Next (suggested sprint order)

1. **Dockerfile + CI/CD** — can't ship without it
2. **Refuse to start without webhook secret** — 5-line security fix
3. **T1 validator severity fix** — promote critical warnings to errors
4. **ralph.sh smoke tests** — even basic happy-path coverage helps
5. **E2E integration test** — prove the system works end-to-end
6. **Prometheus alerts + Grafana dashboard** — metrics exist but nobody sees them
