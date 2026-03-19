# Ralph Pipeline — Roadmap

**Last updated:** March 19, 2026 (post E2E validation #57)
**Status legend:** done | in-progress | planned | blocked

---

## P0 — Deployment Blockers

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| HMAC-SHA256 webhook verification | done | server.js:35-70 | Length-safe `timingSafeEqual` |
| BigInt serialization crash | done | db.js:48 | `Number(result.lastInsertRowid)` |
| Async Express error handling | done | server.js:122,174 | try/catch in all async routes |
| LLM infinite recursion on 429 | done | llm.js:19-50 | Max 5 retries with exponential backoff |
| Metrics NaN corruption guard | done | metrics.js:observeHistogram | Rejects null/undefined/NaN |
| Health endpoint crash (Redis down) | done | server.js:243-247 | `getJobCounts` inside try/catch |
| Server reference for graceful shutdown | done | server.js:261 | `const server = app.listen(...)` |
| Refuse to start without webhook secret | done | server.js:23-26 | `process.exit(1)` in production mode |
| Dockerfile for Node.js app | done | Dockerfile | Multi-stage: builder (native addons) → runtime (node:20-slim) |
| .dockerignore | done | .dockerignore | Excludes node_modules, .git, data, .env, test/ |
| CI/CD pipeline (lint + test) | done | .github/workflows/ci.yml | `node --check`, `bash -n ralph.sh`, `npm test` |
| CI/CD deploy workflow | done | .github/workflows/deploy.yml | SSH deploy, manual trigger, requires CI pass |

## P1 — Testing & Validation

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Unit tests (101 cases) | done | test/*.test.js | db, metrics, slack, llm, logger, sentry, server, worker, validate-static |
| ralph.sh smoke tests (31→45 cases) | done | test/ralph-sh.test.js | Syntax, structure, extract_html, extract_tests, validate_spec, config defaults, report format, E6/E8/E9/E10/T6/T2/E5 |
| E2E integration test | done | test/e2e.test.js | Full build lifecycle, HMAC signatures, concurrent builds, failure paths |
| T1 validator: warnings → errors | done | lib/validate-static.js | answer handler, gameState, star thresholds, 480px — all now errors |
| T1 validator: fix pattern matching | done | lib/validate-static.js | `id="gameContent"` regex; star thresholds use `/0\.8\b/`, `/80\s*%/` |
| Contract tests (CLIProxyAPI) | done | test/proxy-contract.test.js | Validates request format, Claude/OpenAI response parsing, 429 retry, error handling |
| T2 contract validation layer | done | lib/validate-contract.js | Validates gameState shape, postMessage contracts, scoring/init contracts |
| Load/stress tests | done | test/load.test.js | 47-template bulk creates, rapid cycles, 100+ record performance, metrics throughput |

**Test count: 219 tests, 52 suites, 0 failures**

## P2 — Spec Compliance & Feature Completeness

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| `all: true` bulk rebuild API | done | server.js:184-210 | Discovers templates from filesystem, schedules overnight |
| Slack format: show call count | done | lib/slack.js:29-33 | `"N calls"` instead of `gen=model` |
| Column name: `duration_s` alias | done | lib/db.js:93 | `SELECT total_time_s AS duration_s` |
| `commit.removed` handling | done | server.js:82 | Deleted spec files now trigger builds |
| T6 inputSchema.json generation | done | ralph.sh (Step 5) | LLM-generated JSON Schema with fallback; runs post-approval |
| E5 event schema validation | done | ralph.sh, test prompt | Test generation prompt includes postMessage payload schema validation |

## P3 — DevOps & Operations

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| systemd service units | done | systemd/*.service | Server + worker |
| Docker Compose (Redis + proxy) | done | docker-compose.yml | |
| .env.example | done | .env.example | 39 env vars documented |
| Dockerfile (app) | done | Dockerfile | Multi-stage with non-root user, healthcheck, volume for SQLite |
| CI/CD: lint + test | done | .github/workflows/ci.yml | JS syntax check, bash syntax check, npm test |
| CI/CD: deploy | done | .github/workflows/deploy.yml | SSH deploy with secrets, manual trigger |
| Prometheus alert rules | done | monitoring/alerts.yml | 6 rules: failure rate, stuck builds, backlog, rate limits, worker down, high duration |
| Grafana dashboard | done | monitoring/grafana-dashboard.json | 5 rows: overview, duration, LLM, queue, per-game table |
| Deployment runbook | done | docs/deployment.md | First deploy, updates, troubleshooting (6 scenarios) |
| Log rotation | done | systemd/ralph-logrotate.conf | Daily rotation, 14 days retention, compress |
| Nginx reverse proxy config | done | nginx.conf | TLS, rate limiting, security headers, metrics restricted to internal IPs |

## P4 — Code Quality & Architecture

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Sentry v8 API alignment | done | lib/sentry.js:93-115 | Wrapper normalizes v8 Span to v7-compatible interface |
| Optional dependencies | done | package.json | `@google-cloud/logging` and `@sentry/node` moved to `optionalDependencies` |
| CLAUDE.md project context | done | CLAUDE.md | Architecture, commands, key files, code style, known constraints |
| llm.js status: kept for E3 | done | lib/llm.js | Documented as E3 migration target; used by contract/proxy tests |
| Express 5 migration | done | server.js, package.json | Express 5 handles async rejections natively; removed try/catch wrappers |
| ESLint + Prettier | done | .eslintrc.js, .prettierrc.json | Rules aligned with code style; devDependencies added |

## P5 — Scalability & Intelligence (from spec E1-E10)

| Item | Status | Notes |
|------|--------|-------|
| E1 parallel batch runner | done | BullMQ concurrency=2 + rate limiter handles this |
| E2 smart retry escalation | done | ralph.sh, diagnosis mode on iteration 3+ |
| E3 migrate CLI to API | done | lib/pipeline.js, worker.js: dual-mode (bash/Node.js); opt-in via RALPH_USE_NODE_PIPELINE=1 |
| E4 warehouse-aware context | planned | Deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt |
| E6 caching / incremental runs | done | ralph.sh: check_cache/update_cache with sha256sum; gated by RALPH_ENABLE_CACHE=1 |
| E7 failure pattern database | done | lib/db.js, worker.js, server.js: failure_patterns table, categorization, /api/failure-patterns endpoint |
| E8 diff-based fix prompts | done | ralph.sh: sends only `<script>` section for HTML >20KB on iteration 2+ |
| E9 spec validation against warehouse | done | ralph.sh: validate_spec_against_warehouse checks part references exist |
| E10 deployment step | done | ralph.sh: versioned artifact dirs, latest symlink, manifest.json; gated by RALPH_DEPLOY_ENABLED=1 |

## P6 — Test Generation Quality

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Categorized spec files (per category) | done | lib/pipeline.js | game-flow, mechanics, level-progression, edge-cases, contract — each with own fix loop |
| Pipeline-controlled boilerplate | done | lib/pipeline.js | LLM generates only test.describe() body; pipeline prepends sharedBoilerplate |
| Per-batch progressive fix loop | done | lib/pipeline.js | RALPH_CATEGORY_BATCH_SIZE=1 sequential; each batch up to MAX_ITERATIONS |
| Test case coverage enforcement | done | lib/pipeline.js | Prompt enforces exact N test() calls matching Step 2a output |
| DOM snapshot for test generation context | done | lib/pipeline.js | Headless Playwright captures actual element IDs/classes from running game; injected into test-gen prompts |
| Per-category pass rate tracking | done | lib/pipeline.js, ralph-report.json | category_results in report; identifies which category consistently fails |
| Human-run Playwright traces as gold standard | planned | — | Record --trace from a correct human test run; use trace viewer output as ground truth for test generation |
| `data-testid` attributes in gen prompt | done | lib/pipeline.js | Rule 15: LLM adds data-testid to all interactive/observable elements; test gen uses them as primary selectors |
| Force-regenerate missing test categories | planned | lib/pipeline.js, server.js | Pipeline skips test gen when ≥1 spec file exists; add per-category regeneration check so missing categories are always generated, not silently skipped |
| Review rejection → targeted fix loop | planned | lib/pipeline.js | REJECTED verdict currently ends the build; parse rejection reason and feed into a targeted HTML fix iteration before final failure, enabling autonomous recovery |
| Autonomous spec → APPROVED pipeline | planned | lib/pipeline.js, worker.js | Full end-to-end loop: FAIL/REJECT → extract specific failing checks → targeted fix → retest → re-review, with no manual intervention required |
| Multi-game scale validation | planned | — | Run pipeline against all specs in warehouse/templates/ to build confidence, surface new failure patterns, and stress-test the fix loop across game types |

---

## Summary

| Pillar | Done | Planned | Total |
|--------|------|---------|-------|
| P0 Deployment Blockers | 12 | 0 | 12 |
| P1 Testing & Validation | 8 | 0 | 8 |
| P2 Spec Compliance | 6 | 0 | 6 |
| P3 DevOps & Operations | 11 | 0 | 11 |
| P4 Code Quality | 6 | 0 | 6 |
| P5 Scalability | 8 | 1 | 9 |
| P6 Test Generation Quality | 7 | 5 | 12 |
| **Total** | **58** | **6** | **64** |

## What's Next

1. **Force-regenerate missing test categories** — pipeline silently skips categories when ≥1 spec file exists; fix so missing categories are always regenerated
3. **Review rejection → targeted fix loop** — parse REJECTED reason and attempt an autonomous HTML fix before giving up
4. **Autonomous spec → APPROVED pipeline** — full self-healing loop with no manual intervention
5. **Multi-game scale validation** — run all specs in warehouse/templates/ to stress-test the pipeline
6. **E4 warehouse-aware context** — deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt (skipped per user request)
7. **Human-run Playwright traces** — record `--trace` from a correct human test run; use as ground truth for test generation, eliminating LLM selector hallucinations
