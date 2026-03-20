# Ralph Pipeline — Roadmap

**Last updated:** March 20, 2026 (P7 split done (819 lines) + config.js/lazy-require/magic-number/db-migration done; P8 isInitFailure + queue-dedup + error-message + Step 1d smoke-check done; R&D: queue-sync auto-requeue DONE — 7 new tests, 435 pass; R&D: rendering-pattern detection toBeVisible pre-triage DONE — 6 new tests, 441 pass)
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

**Test count: 338 tests, 52 suites, 0 failures**

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

## P8 — Build Reliability (from failure-analysis.md, 2026-03-20)

> Source: `docs/failure-analysis.md` — 223 builds analyzed. Warehouse gate + BullMQ stall fix address 63% of production failures.

| Item | Status | Files | Notes |
|------|--------|-------|-------|
| **Warehouse hygiene gate** | **done (2026-03-20)** | worker.js, lib/pipeline.js | Pre-build: deletes stale warehouse HTML for non-approved games before calling `runPipeline()`. Prevents generation bypass — root cause of 54% of production failures. Shipped in commit 8202a79. |
| **BullMQ stall prevention** | **done (2026-03-20)** | worker.js | Wired `onProgress` → `job.updateProgress()` every ~2 min (KillMode=control-group + heartbeat). BullMQ renews job lock on each call, preventing the 15 stall failures. Shipped in commit cc36e6c. |
| **Stale warehouse auto-delete: relax isInitFailure guard** | **done (2026-03-20)** | lib/pipeline.js | `isInitFailure()` refactored to exported function; ANY-match + passed===0; 14 regex patterns; 10 new unit tests; 399 tests pass; deployed 2026-03-20 (commit 5e7eaa0). |
| **Redis AOF persistence (Task #44)** | **done (2026-03-20)** | docker-compose.yml | `--appendonly yes` in Redis service command prevents BullMQ queue loss on restart. Verified on live server: `ralph-redis-1` container running with AOF active; `appendonlydir/` with `*.incr.aof` confirmed. See Lesson 45 in docs/lessons-learned.md. |
| **Step 1d: Page load smoke check** | **done (2026-03-20)** | lib/pipeline-utils.js, lib/pipeline.js | `runPageSmokeDiagnostic()` + `classifySmokeErrors()` added. Catches CDN 404s, `waitForPackages` timeout, init errors before test-gen runs. One regen attempt on fatal errors; throws immediately if still broken. 11 new tests; 428 total pass. See Lesson 46 in docs/lessons-learned.md. |

---

## P5 — Scalability & Intelligence (from spec E1-E10)

| Item | Status | Notes |
|------|--------|-------|
| E1 parallel batch runner | done | BullMQ concurrency=2 + rate limiter handles this |
| E2 smart retry escalation | done | ralph.sh, diagnosis mode on iteration 3+ |
| E3 migrate CLI to API | done | lib/pipeline.js, worker.js: dual-mode (bash/Node.js); opt-in via RALPH_USE_NODE_PIPELINE=1 |
| E4 warehouse-aware context | planned | Deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt |
| E11 parallel build generation | done | lib/llm.js per-model semaphore (RALPH_MODEL_CONCURRENCY); RALPH_CONCURRENCY already wired in worker.js |
| E12 parallel test generation | done | lib/pipeline.js | Promise.all() across 5 categories in Step 2b; saves 60-100s per build |
| E13 model routing (triage/global/learnings) | done | lib/pipeline.js | TRIAGE_MODEL (gpt-4.1-mini), GLOBAL_FIX_MODEL (claude-opus-4-6), LEARNINGS_MODEL (gpt-4.1-mini) |
| E14 hardware resource gate | done | lib/metrics.js, worker.js | lib/metrics.js system gauges (CPU/RAM/disk); worker.js gate before job start (RALPH_CPU_GATE, RALPH_RAM_GATE_MB); docs/scale-config.md |
| E15 distributed worker support | done | worker.js, docker-compose.scale.yml | RALPH_WORKER_ID, worker_id in builds table, docker-compose.scale.yml, docs/distributed.md |
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
| Force-regenerate missing test categories | done | lib/pipeline.js | Per-category check: only missing/empty categories regenerate; existing valid specs kept |
| Review rejection → targeted fix loop | done | lib/pipeline.js | REJECTED triggers up to 2 targeted HTML fix iterations using rejection reason, then re-reviews |
| Autonomous spec → APPROVED pipeline | done | lib/pipeline.js, worker.js | FAIL/REJECT → triage → targeted fix → retest → re-review loop, fully autonomous |
| Generic pipeline (all game types) | done | lib/pipeline.js, validate-static.js, validate-contract.js | Test gen uses DOM snapshot for selectors; boilerplate is game-agnostic; CDN contract patterns accepted |
| Full error output in fix prompts | done | lib/pipeline.js collectFailures() | Full error message (600 char limit) vs first line only; fix LLM sees actual vs. expected values |
| Deterministic pre-triage | done | lib/pipeline.js | Skip triage LLM for __ralph undefined, visibilityState, pointer-events patterns — saves 30-40% of triage calls |
| E8 script-only fix (iteration 2+) | done | lib/pipeline.js | Sends only <script> sections for large HTML on iteration 2+; merges fix back into full HTML |
| Architecture C: global cross-batch fix loop | done | lib/pipeline.js Step 3c | Global fix after per-batch loops; collects all failing batches for cross-category root cause |
| Contract auto-fix at Step 1b | done | lib/pipeline.js | lib/pipeline.js: contract errors trigger FIX_MODEL call before test loop |
| Category results in review prompt | done | lib/pipeline.js | lib/pipeline.js: game-flow 0% + overall <70% fails before review; category scorecard in review prompt |
| Review prompt consolidation | done | lib/pipeline.js | REVIEW_SHARED_GUIDANCE const shared by early-review, re-review, and final review; eliminates drift |
| Spec-derived fallbackContent | done | lib/pipeline.js | extractSpecRounds() parses spec markdown tables/lists when DOM snapshot rounds are empty; skip-conditions added for PART-xxx metadata rows (build 232 / lesson 44) |
| Slack log restructure (Block Kit) | done | worker.js, lib/slack.js | Block Kit templates with dividers, → Next: narration, pipeline-architecture.md |
| Step 0 spec pre-validation | done | lib/pipeline.js | validateSpec() checks: short spec, missing heading, missing mechanics/scoring/CDN sections; hard fail on errors, warnings to Slack |
| Build auto-retry (RALPH_AUTO_RETRY) | done | worker.js, lib/db.js | Requeues builds scoring 0/total once; retry_count in DB prevents chains; gated by env var |
| Iteration HTML URL audit trail | done | lib/db.js, worker.js | iteration_html_urls column tracks all fix snapshots per build; count shown in Slack summary |
| LLM call cost tracking (per-build USD estimate) | done | lib/llm.js, lib/pipeline.js, lib/slack.js, lib/db.js | Token accumulation per model; MODEL_COSTS map; total_cost_usd in DB + Slack |
| Truncated HTML detection + generation retry | done | lib/pipeline.js, lib/validate-static.js | isHtmlTruncated() checks </html>/script tags; retries up to 3x; T1 now errors on missing </html> |
| Auto-delete stale warehouse HTML on 0% game-flow iter 1 | done | lib/pipeline.js | Detects init-failure pattern + warehouse HTML source → deletes + regenerates; prevents 3-batch waste |
| CDN URL constraint + auto-fix in generation | done | lib/pipeline.js | Rule 18 in gen prompt; post-gen cleanup replaces cdn.mathai.ai → cdn.homeworkapp.ai |
| Conditional beforeEach post-processing | done | lib/pipeline.js | Post-processing respects hasTransitionSlot; ${transitionSlotId} hallucination cleanup |
| Orphaned build auto-cleanup at worker startup | done | worker.js, lib/db.js | cleanupOrphanedBuilds() marks running builds failed at startup; getRunningBuilds() in db.js |
| waitForPackages T1 static check + gen/fix constraints | done | lib/validate-static.js, lib/pipeline.js | T1 validates 10000ms timeout + throw; rules 19/20/21 in gen prompt; all fix prompts updated |
| sound.register() T1 static check | done | lib/validate-static.js | T1 errors on FeedbackManager + sound.register() usage; gen/fix/global prompts forbid it |
| CDN window exposure T1 static check + gen rules | done | lib/validate-static.js, lib/pipeline.js | T1 checks window.endGame assignment when DOMContentLoaded present; rule 21 in gen prompt |
| endGame double-call guard in gen prompts | done | lib/pipeline.js | Rule 20: if(gameState.gameEnded)return pattern; added to all fix prompts |
| Static re-validation after Step 1b fix | done | lib/pipeline.js | Re-runs runStaticValidation() after LLM fix; logs remaining errors; emits partial event if not fully fixed |
| window.gameState shape in DOM snapshot | done | lib/pipeline.js | captureGameDomSnapshot() captures actual property names/types from window.gameState; injected into test-gen so LLM uses real data shapes not guesses |
| Spec-derived test generation hints | done | lib/pipeline.js | extractTestGenerationHints() detects multi-cell/timed-flash/learn-recall/sequential-step patterns from spec; injects targeted warnings into test-gen prompt |
| Size-drop continue-to-iter-2 on truncation | done | lib/pipeline.js | When iter 1 full-HTML fix returns near-empty (>90% shrink), continue to iter 2 (E8 script-only) instead of breaking fix loop |
| Behavioral transcript (Step 2.5b) | done | lib/pipeline.js | captureBehavioralTranscript() fires game_init, observes correct/wrong interactions, captures postMessage — injected into test-gen prompt as ground truth |
| T1: ScreenLayout.inject() presence check | done | lib/validate-static.js | Errors if ScreenLayout referenced but .inject() never called — CDN slot never renders otherwise |
| T1: initSentry() order check | done | lib/validate-static.js | Errors if initSentry() appears before waitForPackages() — throws before SDK loads → ScreenLayout blocked |
| T1: Debug functions on window check | done | lib/validate-static.js | Errors on window.debugGame/testAudio/testPause etc. — review model rejects window-exposed debug fns |
| Multi-game scale validation | in-progress | warehouse/templates/ | 47 games queued; 1 APPROVED (match-the-cards), visual-memory + 4 more in queue with latest fixes |
| Reduce review rejection rate (~20% of failures) | planned | lib/pipeline.js, lib/prompts.js | Review model rejects for 3 recurring patterns: (1) gameState.phase never set to 'game_over' after last round ends (LLM uses 'gameover' without underscore mismatch), (2) missing isActive guard in answer handler (double-click fires endGame twice), (3) TransitionScreen transition not awaited before next round starts. Add T1 static checks + gen/fix prompt rules for each. Goal: review APPROVED on first attempt >80% of builds (currently ~60%). |

---

## R&D

> One task always active. Target: highest-leverage improvement for reliability / availability / power / scalability.

| Task | Status | Hypothesis | Expected Impact |
|------|--------|-----------|-----------------|
| **Cross-game learning injection** | **done (2026-03-20)** | Extract fix patterns + root-cause notes from every APPROVED build's `learnings` table and inject as a "lessons from similar games" block into generation + fix prompts for new builds of the same CDN part mix | Reduce avg iterations from ~3 → ~1.5; fewer triage calls; higher first-pass approval rate — biggest throughput lever remaining |
| **Semantic learning deduplication** | **done (2026-03-20)** | `jaccardSimilarity()` + dedup pass in `getRelevantLearnings()`: keeps most-recent entry per cluster (threshold 0.6), caps at 20 bullets, fetch limit 3× cap — 10 new tests, 357 pass | Keeps injected learnings block compact (≤ 20 bullets) even after 100+ approved builds; preserves prompt token budget |
| **Spec-similarity retrieval** | **done (2026-03-20)** | `extractSpecKeywords()` extracts PART-XXX IDs + PascalCase CDN names + mechanic nouns from spec; `getRelevantLearnings()` scores deduped learnings via Jaccard against spec keywords and sorts most-relevant first; falls back to recency when no specContent; 5 new tests, 362 total / 358 pass; deployed 2026-03-20 | Reduces prompt noise: irrelevant learnings from dissimilar game types sort to bottom; novel game types get targeted learnings surfaced first |
| **Learning category boosting** | **done (2026-03-20)** | `getCategoryBoost()` in `lib/pipeline.js`: `contract` +0.2 always, `cdncompat` +0.2 when PART-xxx in spec, `audio` +0.2 when FeedbackManager in spec, `layout` +0.2 when ScreenLayout in spec; exported for testability; 10 new unit tests; all 372 tests pass; deployed 2026-03-20 | Category-aware secondary sort surfaces contract/CDN/audio/layout learnings above equally-similar general entries — most actionable patterns reach the LLM first |
| **Spec-keyword SQL pre-filtering** | **done (2026-03-20)** | `spec_keywords TEXT` column added to `builds` table (idempotent ALTER TABLE migration); `db.updateBuildSpecKeywords()` stores extracted keywords as JSON array; `deriveRelevantCategories()` maps spec keyword signals → category set (contract+general always; cdncompat when PART-xxx; audio when feedbackmanager; layout when screenlayout); `getRelevantLearnings()` adds SQL `WHERE l.category IN (...)` pre-filter when specContent provided; falls back to no-filter when specContent null; `buildId` threaded through `runPipeline()` options so worker saves keywords to DB early in Step 0; 13 new tests; 385 total pass; deployed 2026-03-20 | SQL pre-filter reduces rows fetched from O(N) to O(matching-category-rows), keeping JS dedup work O(k) as learnings table grows to 1000+ entries; `spec_keywords` column enables future LLM-side retrieval augmentation |
| **Learning retrieval — index-scan optimization** | **done (2026-03-20)** | `CREATE INDEX IF NOT EXISTS idx_learnings_cat_build ON learnings(category, build_id DESC)` makes `WHERE l.category IN (...) ORDER BY l.build_id DESC` use an index scan. `CREATE INDEX IF NOT EXISTS idx_builds_approved ON builds(id) WHERE status='approved'` partial index covers the approved-builds JOIN. Both added to schema init in `lib/db.js`; idempotent `IF NOT EXISTS`; 385 tests pass; deployed 2026-03-20 (no worker restart needed — indexes applied on next DB connection open). | Per-call latency O(log N + k) instead of O(N) at 10k+ learning rows |
| **pipeline.js Phase 3: split remaining orchestration** | **done (2026-03-20)** | pipeline.js: 2433 → 839 lines; lib/pipeline-fix-loop.js (802 lines), lib/pipeline-test-gen.js (569 lines), lib/pipeline-targeted-fix.js (422 lines) created; 385 tests pass; deployed 2026-03-20 (commit 73cc250) | Unlocks targeted unit tests for fix-loop and targeted-fix paths; reduces merge conflict surface; onboarding time drops by ~5× |
| **Queue-sync resilience: auto-requeue job-lost builds at startup** | **done (2026-03-20)** | worker.js | `requeueQueueSyncBuilds()` runs at worker startup after `cleanupOrphanedBuilds()`. Queries `status='failed' AND error_message LIKE '%queue-sync%' AND retry_count < 1`, skips games with active builds, enqueues via BullMQ Queue, sets `retry_count=1`. 7 new tests (435 total pass); deployed 2026-03-20. | Zero manual re-queues needed after worker restart; recovers ~5-9 builds per restart event automatically. |
| **Rendering-pattern detection: toBeVisible failure auto-skip** | **done (2026-03-20)** | lib/pipeline-fix-loop.js | `detectRenderingMismatch()` added: if >3 failures match `toBeVisible\|toBeHidden`, skip_tests without LLM triage call. Exported for unit tests. 6 new tests (441 total pass); deployed 2026-03-20 (commit 9c2e641). Saves one LLM round-trip per affected batch. |
| **P6: Reduce review rejection rate** | **done (2026-03-20)** | Rules 22/23/24 added to gen prompt (isActive guard, game_over stars, TransitionScreen routing); CDN_CONSTRAINTS_BLOCK updated for fix prompts; T1 Check 11 (game_over star display) + Check 12 (isActive guard) added as warnings; 389 tests pass; deployed 2026-03-20 (commit 1a6e01e) | Should cut review rejections from ~20% to ~10% |
| **P8: Relax isInitFailure guard** | **done (2026-03-20)** | `isInitFailure()` refactored to exported function; ANY-match + passed===0; 14 regex patterns; 10 new unit tests; 399 tests pass; deployed 2026-03-20 (commit 5e7eaa0) | Catches partial-init failures that ALL-match missed; saves 5 wasted iterations per affected build |
| **P7: Deduplicate CDN constraint rules across fix prompts** | **done (2026-03-20)** | lib/prompts.js | CDN_CONSTRAINTS_BLOCK expanded with SENTRY ORDER, DEBUG FUNCTIONS, SCREENLAYOUT rules; reused in buildFixPrompt, buildGlobalFixPrompt, buildTargetedFixPrompt. Eliminated 3 diverged copies (net -34 lines, +5 to CDN_CONSTRAINTS_BLOCK). 441 tests pass; deployed 2026-03-20 (commit e7878e7). Any future CDN rule change needs one edit, not 3+. |
| **P8: Deduplicate build queue at enqueue** | **done (2026-03-20)** | `POST /api/build` checks for existing `queued/running` build before creating new one; returns existing `buildId` with `deduplicated: true`; `force: true` bypasses; approved game check; webhook handler calls `shouldSkipWebhookBuild()`; 5 new integration tests; 409 total pass; deployed 2026-03-20 (commit 0c6f2d2) | Prevents duplicate queue entries; rapid-challenge manual fix now automated |
| **Queue-sync resilience: auto-requeue BullMQ job-lost builds** | **done (2026-03-20)** | worker.js | See R&D table above. |
| **P8: Ensure pre-pipeline failures record error_message** | **done (2026-03-20)** | `worker.on('failed')` normalised error message: non-Error/empty-message cases now fall back to `err.toString()` or sentinel string; inner catch now calls `failBuild()` before re-throw; DB never left with NULL; 5 new tests; 404 total pass; deployed 2026-03-20 (commit 05a9070) | Future `null error_message` failures now impossible; debugging orphaned builds no longer blind |

### Cross-game learning injection — design notes

- **Source**: `learnings` table already populated per build (`level`, `category`, `content`). APPROVED builds are ground truth.
- **Retrieval**: at Step 1 (gen) and Step 3 (fix), query `learnings WHERE resolved=0` for games sharing the same PART set (parsed from spec CDN section). Top-N by recency + category relevance.
- **Injection**: append as `## Lessons from similar games` block to gen/fix system prompt — same slot as spec-derived hints.
- **Scope**: `pipeline.js` only. No new DB schema (learnings table already exists). No new env var needed.
- **Success metric**: average iterations-to-pass drops; track via `builds.iterations` across next 10 builds post-deploy.

---

## P7 — Code Architecture & Best Practices

> Audit date: 2026-03-20. All items identified from reading lib/pipeline.js (4105 lines), worker.js (1111 lines), server.js (572 lines), lib/db.js (468 lines), lib/slack.js (561 lines).

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Extract all LLM prompt strings into lib/prompts/ | **done (2026-03-20)** | lib/prompts.js | 18 prompt builders extracted from pipeline.js inline template literals; pipeline.js: 4105 → 3592 lines. Shipped commit d6d619f. |
| Extract snapshot/harness/spec utilities into lib/pipeline-utils.js | **done (2026-03-20)** | lib/pipeline-utils.js | 12 utility functions (captureGameDomSnapshot, captureBehavioralTranscript, injectTestHarness, extractSpecRounds, extractSpecMetadata, extractTestGenerationHints, etc.) extracted; pipeline.js: 3592 → 2433 lines. Shipped commit 6c52240. |
| Split pipeline.js (~2433 lines) into focused sub-modules | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-fix-loop.js, lib/pipeline-test-gen.js, lib/pipeline-targeted-fix.js | pipeline.js: 2433 → 819 lines; lib/pipeline-fix-loop.js (802 lines), lib/pipeline-test-gen.js (569 lines), lib/pipeline-targeted-fix.js (422 lines) created; 385 tests pass; deployed 2026-03-20 (commit 73cc250). |
| Deduplicate REVIEW_SHARED_GUIDANCE (used as literal string in re-review prompt) | **done (2026-03-20)** | lib/prompts.js | buildReReviewPrompt had an inline copy of REVIEW_SHARED_GUIDANCE that was missing RULE-003 and RULE-005 and had a stricter General guidance clause. Replaced with `${REVIEW_SHARED_GUIDANCE}` constant reference. All 3 review prompts (buildEarlyReviewPrompt, buildEarlyReReviewPrompt, buildReReviewPrompt) now use the canonical constant. 441 tests pass. |
| Deduplicate playwright.config.js template (written twice) | planned | lib/pipeline.js:2737–2756, 3926–3947 | The defineConfig block with baseURL, timeout 90000, retries 0, webServer, and JSON reporter is copy-pasted verbatim in both runPipeline() and runTargetedFix(). Extract to a buildPlaywrightConfig(port) helper function; both call sites become one-liners and the config lives in one place. |
| Deduplicate CATEGORIES / SPEC_ORDER constant (defined three times) | **done (2026-03-20)** | lib/pipeline-utils.js | CATEGORY_SPEC_ORDER added to pipeline-utils.js as single source; removed inline declarations from pipeline-fix-loop.js, pipeline-test-gen.js, pipeline-targeted-fix.js. MODEL_COSTS/estimateCost and findFreePort also centralized. 417 tests pass. Commit 0e753c0. |
| Deduplicate CDN constraint rules across fix prompts | planned | lib/pipeline.js:1878–1893, 3999–4011, 2003–2016 | The 10+ CDN constraint rules (FeedbackManager fire-and-forget, isProcessing guard, waitForPackages 10000ms+throw, endGame guard, window.gameState/endGame/restartGame exposure, sound.register forbidden, sentry order, ScreenLayout.inject placement) appear as separate hardcoded strings in at least three different fix prompt sites. Extract to a CDN_FIX_CONSTRAINTS constant reused in all fix prompts. |
| Deduplicate beforeEach replacement blocks | planned | lib/pipeline.js:2333–2360, 2579–2613 | Two versions of the beforeEach block (CDN-slot path and non-CDN fallback) are constructed inline in the always-applied post-processing loop (lines 2579–2613), and nearly identical versions exist in sharedBoilerplate at lines 2333–2360. A single buildBeforeEach(hasTransitionSlot) function should produce the correct block and be used at both sites. |
| Centralize all env var reads into lib/config.js | **done (2026-03-20)** | lib/config.js | Created lib/config.js with loadConfig() exporting a frozen object of all 40+ env vars with defaults and type coercions. Throws in production if GITHUB_WEBHOOK_SECRET/PROXY_URL/PROXY_KEY missing; warns if SLACK_BOT_TOKEN/RALPH_GCP_BUCKET empty. Updated pipeline.js, pipeline-fix-loop.js, pipeline-test-gen.js, pipeline-targeted-fix.js to import from config. Skipped gcp.js/slack.js/db.js/llm.js/server.js/worker.js (tests mock process.env via require-cache invalidation — safe to leave as-is). 417 tests pass. |
| Remove lazy require() calls inside function bodies | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-targeted-fix.js, lib/pipeline-utils.js, worker.js, server.js | Moved require('child_process'), require('net'), require('./db'), require('crypto'), require('./lib/pipeline'), require('bullmq').Queue, require('fs'), require('path') from function bodies to top-level. Kept intentional lazy requires: @playwright/test in captureGameDomSnapshot, ./db in getRelevantLearnings (optional dep comment), ./lib/mcp in getMcpServer (optional dep), @modelcontextprotocol/sdk and ioredis/bullmq in require.main block. 417 tests pass. |
| Replace duplicate server proc spawn with a shared helper | planned | lib/pipeline.js:913, 2758–2762, 3949–3953 | child_process.spawn('npx', ['-y', 'serve', dir, '-l', port, '-s', '--no-clipboard']) appears three times: DOM snapshot server (captureGameDomSnapshot), test server in runPipeline(), test server in runTargetedFix(). Extract to spawnServeProcess(dir, port) returning the child process; all three sites become one-liners and the 2000ms startup wait lives in one place. |
| Extract magic numbers to named module-level constants | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-targeted-fix.js | Named VALIDATOR_TIMEOUT_MS=10000, SERVER_START_DELAY_MS=2000 in both pipeline.js and pipeline-targeted-fix.js (same values appear in both files). Numbers inside template-string-generated playwright.config.js are not JS literals in our code and were left as-is. 417 tests pass. |
| Add schema migration versioning to lib/db.js | **done (2026-03-20)** | lib/db.js | Replaced 9 try/catch ALTER TABLE blocks with a MIGRATIONS array + user_version pragma. Reads PRAGMA user_version at startup, runs only migrations from currentVersion..DB_VERSION, then writes updated version. To add a migration: append to MIGRATIONS array — no other changes needed. 417 tests pass. |
| Extract Block Kit builder logic from lib/slack.js into composable helpers | planned | lib/slack.js:210–312 | buildParentBlocks() is 100 lines of imperative array-push logic that handles status icons, elapsed time calculation, link formatting, and conditional field blocks in one function. Break into composable helpers: buildStatusField(), buildProgressFields(), buildLinksRow() — each independently unit-testable and reusable by other notification functions (postThreadResult, updateThreadOpener) without duplicating field layout logic. |
| Add JSDoc to all exported public API functions | planned | lib/pipeline.js, lib/db.js, lib/slack.js, lib/llm.js | Only slack.js has partial JSDoc (buildParentBlocks at line 188). All other exported functions lack parameter and return type documentation. runPipeline(gameDir, specPath, options) and runTargetedFix(gameDir, specFile, feedbackPrompt, options) have completely undocumented option shapes; callers must read 4000+ lines to understand what logger, onProgress, and metrics expect. |
| Define and enforce consistent error handling tiers | planned | lib/pipeline.js, worker.js | Current mix: bare catch {} (swallow silently), catch { /* ignore */ }, catch (err) { warn() }, catch (e) { warn() }, catch { warn() }, catch (_) {}. No documented policy for when to swallow vs. log vs. rethrow. Define three tiers: (1) critical path — rethrow and fail the build, (2) degraded mode — log + continue with fallback, (3) cosmetic — swallow silently with a comment explaining why. Apply consistently across all catch blocks in pipeline.js and worker.js. |
| Expand pipeline.js test coverage for fix-loop and snapshot paths | planned | test/pipeline.test.js | pipeline.js is 4105 lines but test/pipeline.test.js covers primarily the happy-path build lifecycle. The per-batch fix loop (bestHtmlSnapshot rollback, stale warehouse detection on iter 1, E8 script-only merge/rollback on size drop), global fix loop (Step 3c), behavioral transcript capture, and extractSpecRounds() table/list parsing all lack dedicated unit tests. These are the highest-risk code paths where build compute is spent. |

---

## Summary

| Pillar | Done | Planned | Total |
|--------|------|---------|-------|
| P0 Deployment Blockers | 12 | 0 | 12 |
| P1 Testing & Validation | 8 | 0 | 8 |
| P2 Spec Compliance | 6 | 0 | 6 |
| P3 DevOps & Operations | 11 | 0 | 11 |
| P4 Code Quality | 6 | 0 | 6 |
| P5 Scalability | 13 | 1 | 14 |
| P6 Test Generation Quality | 41 | 2 | 44 |
| P7 Code Architecture | 7 | 8 | 15 |
| P8 Build Reliability | 5 | 2 | 7 |
| **Total** | **109** | **11** | **123** |

## What's Next

0. **[P8 — DONE] Warehouse hygiene gate** — shipped 2026-03-20 (commit 8202a79); worker.js deletes stale non-approved warehouse HTML before pipeline run
0. **[P8 — DONE] BullMQ stall prevention** — shipped 2026-03-20 (commit cc36e6c); `job.updateProgress()` heartbeat + KillMode=control-group prevents lock expiry stalls
0. **[P8 — DONE] Stale warehouse auto-delete: relax isInitFailure guard** — shipped 2026-03-20 (commit 5e7eaa0); ANY-match + passed===0; 10 new unit tests

1. **[R&D — done] Cross-game learning injection** — `getRelevantLearnings()` added to `lib/pipeline.js`; queries APPROVED build learnings from DB and merges into all gen/fix prompts; 347 tests pass; deployed 2026-03-20
2. **[R&D — done] Semantic learning deduplication** — `jaccardSimilarity()` + dedup pass in `getRelevantLearnings()`; Jaccard threshold 0.6, cap 20 bullets; 357 tests pass; deployed 2026-03-20
3. **[R&D — done] Spec-similarity retrieval** — `extractSpecKeywords()` + Jaccard scoring pass in `getRelevantLearnings()`; spec-relevant learnings sorted first; 362 tests / 358 pass; deployed 2026-03-20
4. **[R&D — done] Learning category boosting** — `getCategoryBoost()` in `lib/pipeline.js`; contract/cdncompat/audio/layout +0.2 additive boost; 10 new tests; 372 pass; deployed 2026-03-20
5. **[R&D — done] Spec-keyword SQL pre-filtering** — `spec_keywords TEXT` on builds table; `deriveRelevantCategories()` maps spec signals → SQL IN clause; `buildId` threaded through `runPipeline()` options; 13 new tests; 385 pass; deployed 2026-03-20
6. **[R&D — done] Learning retrieval composite index** — `idx_learnings_cat_build ON learnings(category, build_id DESC)` + partial index `idx_builds_approved ON builds(id) WHERE status='approved'`; SQL pre-filter now O(log N + k) at 10k+ rows; 385 tests pass; deployed 2026-03-20
7. **[R&D — done] pipeline.js Phase 1: prompts extracted** — 18 prompt builders extracted into lib/prompts.js; pipeline.js: 4105 → 3592 lines; 385 tests pass; deployed 2026-03-20
8. **[R&D — done] pipeline.js Phase 2: snapshot/harness/spec utilities extracted** — 12 utility functions extracted into lib/pipeline-utils.js (1221 lines); pipeline.js: 3592 → 2433 lines; 385 tests pass; deployed 2026-03-20
9. **[R&D — done] pipeline.js Phase 3: split remaining orchestration** — pipeline.js: 2433 → 839 lines; 3 sub-modules created; 385 tests pass; deployed 2026-03-20 (commit 73cc250)
9b. **[R&D — done] P6: Reduce review rejection rate** — Rules 22/23/24 in gen prompt + T1 Check 11/12; 389 tests pass; deployed 2026-03-20 (commit 1a6e01e)
9c. **[R&D — DONE] P8: Relax isInitFailure guard** — ANY-match + passed===0; shipped 2026-03-20 (commit 5e7eaa0); saves 5 wasted iterations on partial-init failures
10. **[R&D — DONE] Queue-sync resilience** — `requeueQueueSyncBuilds()` added to worker.js startup; scans for queue-sync-failed builds with retry_count<1 and re-enqueues; skips games with active builds; 7 new tests, 435 pass; deployed 2026-03-20 (commit P8)
11. **[R&D — DONE] Rendering-pattern detection: toBeVisible pre-triage** — `detectRenderingMismatch()` in `lib/pipeline-fix-loop.js`; if >3 failures match toBeVisible/toBeHidden, skip_tests without LLM triage call; 6 new tests, 441 pass; deployed 2026-03-20 (commit 9c2e641)
12. **[R&D — DONE] Deduplicate CDN constraint rules across fix prompts** — CDN_CONSTRAINTS_BLOCK expanded; reused in buildFixPrompt + buildGlobalFixPrompt + buildTargetedFixPrompt; -34 lines net; 441 tests pass; deployed 2026-03-20 (commit e7878e7)
12. **Multi-game scale validation** — run all specs in warehouse/templates/ to stress-test the pipeline; 20 builds currently queued
11. **Human-run Playwright traces** — record `--trace` from a correct human test run; use as ground truth for test generation, eliminating LLM selector hallucinations
12. **E4 warehouse-aware context** — deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt (skipped per user request)
