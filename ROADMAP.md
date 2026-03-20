# Ralph Pipeline — Roadmap

**Last updated:** March 20, 2026 (screenshot-on-timeout fix loop dc0c72f; audio popup auto-dismiss 16cc686; passingContext regex fix 275d14f; popup-backdrop Rule 24 7428526; BullMQ lockDuration 30→90min 95ed7c7; debug-function window exposure rule dd7f170; KillMode=control-group bd871ab; 550 tests pass; R&D: adjustment-strategy chronic failure deep-dive active)
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
| KillMode=control-group: prevent orphaned Claude processes | done | systemd/ralph-worker.service | `KillMode=control-group` ensures all child processes (Claude subprocesses) are killed on worker stop/restart — prevents zombie LLM calls consuming API quota. Commit bd871ab. |
| Fix git pull branch: c_code → main | done | worker.js or deploy scripts | Auto-pull was targeting wrong branch `c_code`; fixed to `main`. Commit a8dc2d7. |

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
| E4 warehouse-aware context | **done (2026-03-20)** | `getGameLearnings()` in db.js; prior game learnings injected into gen + fix prompts at Step 1 and Step 3; `formatGameLearningsBlock()` in pipeline.js; 447 tests pass; commit 316f32a |
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
| Reduce review rejection rate (~20% of failures) | in-progress | lib/pipeline.js, lib/prompts.js | Review model rejects for 3 recurring patterns: (1) gameState.phase never set to 'game_over' after last round ends (LLM uses 'gameover' without underscore mismatch), (2) missing isActive guard in answer handler (double-click fires endGame twice), (3) TransitionScreen transition not awaited before next round starts. Add T1 static checks + gen/fix prompt rules for each. Goal: review APPROVED on first attempt >80% of builds (currently ~60%). Fix being implemented: change debug-function rule from MUST NOT expose on window to MUST expose on window (29% rejection root cause per R&D analysis). |
| HTML generation token truncation on large specs (Lesson 53) | **done (2026-03-20)** | lib/pipeline.js | All 4 HTML generation call sites updated to `{ maxTokens: 32000 }`. Root cause: large specs (bubbles-pairs 64KB, interactive-chat 59KB) exceeded 16K output token default, truncating mid-script. Commit a8392bc. |
| RALPH_LLM_TIMEOUT config drift → worker stall (Lesson 54) | **done (2026-03-20)** | /opt/ralph/.env (server config) | Production had RALPH_LLM_TIMEOUT=1200 (4× documented default). Static-fix calls hung 20+ min, stalling 40+ queued builds (futoshiki build 296 stalled 23 min). Fixed by setting RALPH_LLM_TIMEOUT=300 in production .env. AbortController in llm.js is correctly wired — pure config issue. |
| `logger is not defined` crash on pipeline init | **done (2026-03-20)** | lib/pipeline.js | `runPageSmokeDiagnostic()` was passed `logger` (undeclared) instead of `log` (local alias). Fixed commit 14e22e3. Affects free-the-key, crazy-maze, connect, colour-coding-tool — all requeued. |
| VisibilityTracker template wrong in CDN_CONSTRAINTS_BLOCK | **done (2026-03-20)** | lib/prompts.js | Replaced DOM-element API with correct options-object pattern: onInactive/onResume + `{ fromVisibilityTracker: true }` + popupProps. Propagates to buildFixPrompt/buildGlobalFixPrompt/buildTargetedFixPrompt. Commit 827f44d. |
| popup-backdrop teardown: Rule 24 + CDN constraint (Lesson 58) | **done (2026-03-20, commit 7428526)** | lib/prompts.js | VisibilityTracker's #popup-backdrop stays as full-screen overlay after popup dismissal — intercepts all pointer events, causing click timeouts at iter 2 (builds 306, 310). Fix: Rule 24 in buildGenerationPrompt requires explicit `bd.style.display='none'; bd.style.pointerEvents='none'` in onResume and restartGame(). POPUP-BACKDROP TEARDOWN constraint added to CDN_CONSTRAINTS_BLOCK for fix prompts. Lesson 58 documented. |
| Passing-test-protection regex fix in fix-loop prompt builder | **done (2026-03-20, commit 275d14f)** | lib/pipeline-fix-loop.js | `passingContext` and `priorBatchContext` were silently broken: regex `^\}` in multiline mode matched only top-level `}` but Playwright test blocks have indented `  });` — so `passingTestBodies` was always empty and the "MUST keep passing" LLM constraint was a no-op. Fix: drop body extraction entirely; switch to name-only lists (`"- test name\n"` per passing test; `"batchLabel: name1, name2"` per prior batch). Regression context now actually works — prevents class of iter-3 regressions (4 passing → 0 after fix). |
| extractGameFeatures() unit tests (non-standard lifecycle) | **done (2026-03-20, commit 14d5d7f)** | test/pipeline-utils-game-features.test.js | 34 unit tests covering unlimited-lives, timer scoring, multi-level, accuracy scoring, single-round, and learn/recall two-phase variants. Supports R&D measurement of non-standard lifecycle test gen. 584 total tests pass. |

---

## R&D

> One task always active. Target: highest-leverage improvement for reliability / availability / power / scalability.

| Task | Status | Hypothesis | Expected Impact |
|------|--------|-----------|-----------------|
| **Gen prompt T1 compliance — eliminate static-fix LLM call** | **done (2026-03-20)** | Trace finding: rules already existed at line 356–357 (end of 360-line prompt) but LLM makes structural decisions before reaching them. Root cause confirmed: initSentry() before waitForPackages() → ReferenceError → ScreenLayout.inject() skipped → #mathai-transition-slot absent → blank page, all tests fail. Fix: moved initSentry + debug-function constraints into rule 5 (CDN INIT ORDER) so LLM reads them before writing the init sequence. Also shipped blank-page detection in smoke check (cad2ca3) as backstop. 447 tests pass; deployed 2026-03-20 (commit 14ab33c). | Expected: 75–80% reduction in static-fix LLM calls. Measure: track `static-validation-passed` rate across next 10 builds. |
| **Cross-build failure pattern injection** | **done (2026-03-20)** | Trace result: DB sparse (73 patterns, 5 games, adjustment-strategy dominates). 80% of failures are iterations=0 (pre-fix-loop) so injection only helps 20% of builds. Scoped to current-game-only lookup at iteration 1. 45 lines across db.js + pipeline-fix-loop.js. Reuses existing `triageFixHints` + `fixHintContext` infrastructure. 3 new tests; 444 total pass; deployed 2026-03-20 (commit 26b21b0). | Modest: saves ~1 iteration for repeat-pattern games. Low-risk, low-effort — worth shipping but not the leverage point originally hypothesized. Real leverage is upstream (T1 gen compliance). |
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
| **require() cache bust after git pull** | **done (2026-03-20)** | worker.js self-patches lib/ require() cache when HEAD changes after git pull; prevents stale code running on new jobs after in-place deploys; commit f77b404 | Zero stale-code builds after hot-deploy; no worker restart needed for lib/ changes |
| **Gen prompt T1 compliance: initSentry + debug rules early** | **done (2026-03-20)** | Moved initSentry order + debug-function constraints into rule 5 (CDN INIT ORDER) so LLM reads them before writing the init sequence; blank-page detection in smoke check as backstop; 447 tests pass; commits 14ab33c + cad2ca3 | 75-80% reduction in static-fix LLM calls expected; ScreenLayout-blocked blank-page failures caught before test-gen |
| **E9 cross-build failure pattern injection** | **done (2026-03-20)** | `findMatchingPattern()` in db.js; injected at iteration 1 via triageFixHints + fixHintContext; scoped to current-game-only lookup; 3 new tests; 444 pass; commit 26b21b0 | Saves ~1 iteration for repeat-pattern games; low overhead |
| **First-pass failure root cause analysis** | **done (2026-03-20)** | Traced 65 triage events across builds 218–232: 58% HTML fatal init, 22% phase-transition missing syncDOMState(), 9% data-shape mismatch, 11% other. Shipped two fixes: (1) abort-on-snapshot-failure (pipeline-test-gen.js throws FatalSnapshotError on null snapshot; pipeline.js regen + retry; abort if retry fails) — eliminates test-gen LLM call on confirmed-broken pages (44% of fatal-init cases). (2) Rule 22 in lib/prompts.js: syncDOMState() required after every gameState.phase assignment — targets 22% of iter-1 failures. Full analysis at docs/rnd-first-pass-failure-analysis.md. | Committed 2026-03-20. Expected: ~44% reduction in wasted test-gen LLM calls; 22% reduction in phase-transition iter-1 failures. |
| **Reduce fatal CDN init failures (58% of iter-1 failures)** | **done (2026-03-20)** | Hypothesis confirmed. Critical finding: `transitionScreen.show()` MUST be called as the last step of `DOMContentLoaded` when using PART-025/ScreenLayout — a missing call leaves `#mathai-transition-slot` empty, causing 100% test failure on all waitForPhase() calls. Rule added to gen prompt (commit 316f32a). This addresses the 58% fatal-init class. Measurable: before/after iteration-1 game-flow pass rate across next 10 builds. | |
| **Review rejection root cause analysis** | **done (2026-03-20)** | Classified 28 rejection events (builds 50–295). Top causes: VisibilityTracker API misuse (39%), debug-function window-exposure rule conflict (29%), postMessage payload incomplete (18%). Critical finding: CDN_CONSTRAINTS_BLOCK says "debug functions MUST NOT be on window" but spec checklist requires them ON window — creates unfixable loop. Fix: change rule to MUST expose on window. Full analysis at docs/rnd-review-rejection-analysis.md. | Fixing rule conflict + adding VisibilityTracker template expected to eliminate ~50% of early-review rejections |
| **Cross-batch fix-loop regression detection** | **done (2026-03-20)** | `detectCrossBatchRegression()` added to pipeline-fix-loop.js. Smoke-checks all prior-passing batch spec files after each batch completes; rolls back to preBatchHtml and marks batch as rolled_back on regression. Empirical trace: 63% of 19 multi-batch builds had cross-batch regressions. 6 new unit tests; 453 total pass. Shipped commit 76996c1. | Eliminates the class of silent regressions where fixing batch N breaks batch N+1 — previously undetectable until Step 3b final re-test |
| **Iteration-1 pass rate analysis + gen prompt improvement** | **done (2026-03-20, commit 929c6ef)** | Shipped 3 gen prompt rules: Rule 20 ROUND LIFECYCLE RESET (isProcessing=false + isActive=true + syncDOMState() as first 3 lines of every loadRound()); Rule 21 SYNCDOMESTATE CALL SITES (enumerated all 6 required call-sites); Rule 22 inline POSTMESSAGE REQUIRED FIELDS (explicit payload schema). All 453 tests pass. | Expected: reduce avg iterations; fewer fix-loop LLM calls. Measure: per-category iter-1 pass rate across next 10 builds. |
| **Review rejection follow-up analysis** | **measuring** | Post-fix-1a6e01e measurement: classify rejection events from builds 296+ to measure whether top-3 fix (debug-function rule, VisibilityTracker template, postMessage schema) reduced rejection rate. Identify new top patterns. Awaiting 5+ post-fix builds. |
| **403 CDN non-fatal handling** | **done (2026-03-20, commits c775187 + d887043)** | Root cause: prompts.js CDN_CONSTRAINTS_BLOCK told LLM to use `cdn.homeworkapp.ai` — now returns 403. Correct domain: `storage.googleapis.com/test-dynamic-assets`. Fix: (1) updated CDN_CONSTRAINTS_BLOCK + buildCliGenPrompt with correct domain + canonical 3-package URL list; (2) pipeline.js + pipeline-test-gen.js post-gen CDN cleanup now also strips `cdn.homeworkapp.ai` script tags and injects canonical block; (3) d887043: `fixCdnDomainsInFile` applied after EVERY LLM HTML write (not just initial gen). 518 tests pass; deployed 2026-03-20. | Unblocks all CDN games in queue; eliminates 403-caused Step 1d failures |
| **T1 W3: data-testid enforcement** | **done (2026-03-20, commit c33f8cd)** | Mechanics category 75% iter-2 rate traced to missing data-testid attributes. Added W3 warning to validate-static.js: warns when >50% of button/input/select elements lack data-testid. Strengthened CLI gen prompt Rule 15 with explicit element-type enumeration. 522 tests pass; deployed 2026-03-20. | Surfaces missing data-testid before test-gen; saves ~54 triage+fix LLM calls per 121 builds |
| **T1 W4: syncDOMState call-site enforcement** | **done (2026-03-20, commit bdb1889)** | W4 warns when gameState.phase assignment lacks syncDOMState() in ±200-char window. 4 new tests; 532 total pass; deployed 2026-03-20. | Surfaces missing syncDOMState before test-gen; targets 22% of game-flow iter-1 failures |
| **Contract failure pattern analysis** | **done (2026-03-20, commit 9abfaa3)** | Top patterns: (1) wrong postMessage structure — Rule 5 specified flat payload but CDN needs nested `{data: {metrics,...}}` (23% of failures); (2) missing window.calcStars (10%). Fix: corrected Rule 5 in buildGenerationPrompt + buildCliGenPrompt; T2 check for flat payloads + missing window.calcStars. 537 tests pass. Expected: 33% reduction in contract iter-2 rate. Analysis: docs/rnd-contract-failure-analysis.md |
| **Fix loop improvement: reduce per-category iter-2 rates** | **measuring** | Three T1 checks shipped (W2/W3/W4) targeting mechanics 75% + game-flow 22% patterns. Contract fix shipped (9abfaa3). Awaiting 10 builds post-fix to measure iter-2 rate change per category. |
| **adjustment-strategy spec contradiction fix** | **done (2026-03-20)** | Root cause: spec said "DO NOT call FeedbackManager.init()" but code examples at lines 630+935 still called it — LLM followed executable code, causing blocking audio popup on every build (59 attempts total, 5 approvals but oscillating). Also fixed: postMessage CRITICAL comment, calcStars game_over=0 guard, adjuster button visibility (was replacing DOM instead of toggling class). Build #350 queued for first clean run. Analysis: docs/rnd-chronic-failures-diagnosis.md | |
| **Spec quality: proactive contradiction scan** | **done (2026-03-20)** | CRITICAL FINDING: 48/50 specs had `await FeedbackManager.init()` as executable code in DOMContentLoaded examples — the exact bug that caused adjustment-strategy's 59-build loop. Every CDN game in queue was generating a blocking audio popup on every build. Fix: replaced all instances with `// DO NOT call FeedbackManager.init() — PART-015 auto-inits on load` comment across 46 specs. Also fixed: simon-says + adjustment-strategy wrong CDN audio URLs (cdn.homeworkapp.ai → cdn.mathai.ai). Local + server specs updated. | Expected: dramatic throughput improvement — all 43 queued CDN games now generate without blocking audio popup; removes primary cause of test harness injection failures |
| **BullMQ lock renewal for long Opus calls** | **done (2026-03-20, commit 95ed7c7)** | worker.js: `lockDuration: 90 * 60 * 1000` (90min), `lockRenewTime: 10 * 60 * 1000` (10min). Initial value was 30min; raised to 90min in commit 95ed7c7 to cover Opus generation calls on large specs. Deployed. Eliminates lock-loss on long Opus calls. Task #59 complete. |
| **Auto-dismiss FeedbackManager audio popup in test harness** | **done (2026-03-20, commit 16cc686)** | lib/pipeline-utils.js (test harness injection) | `beforeEach` in injected harness now explicitly clicks the "Okay!" button from FeedbackManager audio permission popup with a 2s timeout and silent catch. Prevents non-deterministic test failures caused by the popup appearing after `startGame()` in headless Playwright when `FeedbackManager.init()` was called (Lesson 51 race condition). Complements gen-prompt fix (no `FeedbackManager.init()` if PART-017=NO) as a defence-in-depth backstop. |
| **Debug-function window exposure rule conflict fix (Lesson 55)** | **done (2026-03-20, commit dd7f170)** | lib/prompts.js (CDN_CONSTRAINTS_BLOCK) | `CDN_CONSTRAINTS_BLOCK` previously told the gen LLM "debug functions MUST NOT be on window", but the spec Verification Checklist requires them ON window. The contradictory rule caused 29% of early-review rejections — an unfixable loop. Fixed by changing the rule to: "Debug functions MUST be exposed on window — define as named functions inside DOMContentLoaded then assign: `window.debugGame = debugGame`". Queens build 285 was rejected 3 consecutive times for this before the fix. |
| **Mechanics test-gen failure root cause analysis** | **done (2026-03-20, commit e60dbb1)** | Traced 15 mechanics failures: #1 hardcoded wrong values (5+), #2 click timeout on isProcessing=true (4), #3 waitForPhase timeout (4), #4 toHaveText mismatch on nested cells (2), #5 invented gameState properties (2). Fix: 5 mechanics-specific rules M1-M5 in buildTestGenCategoryPrompt; W3 escalated to error when >80% missing. 537 tests pass. Deployed to server. Expected: reduce mechanics iter-2 from 75% toward 40%. |
| **Generation LLM timeout fix** | **done (2026-03-20, commit 4eb1d29)** | `RALPH_LLM_TIMEOUT=300` was killing large-spec HTML generation (interactive-chat 59KB, bubbles-pairs 64KB) at exactly 5 min with 0 iterations. Fix: added `RALPH_GEN_LLM_TIMEOUT` to config (default 600s); all 4 gen call sites use it. Triage/fix calls keep 300s. 537 tests pass. | Unblocks all large-spec games that were timing out before iteration 1 |
| **Cross-batch-guard false rollback fix** | **done (2026-03-20, commit 7d27432)** | `detectCrossBatchRegression()` was treating 0/0 test results (timeout/infra failure) as regression because `0 < prevPassed`. Queens build rolled back every batch due to 30s smoke timeout being too short for game-flow tests. Fix: skip regression when `nowTotal===0` (inconclusive); increase timeout from 30s → 90s. 537 tests pass. | Eliminates false rollbacks that were wasting all post-mechanics-fix batches in queens |
| **Game-flow iter-2 root cause + spec phase hints** | **done (2026-03-20, commit 83011a6)** | game-flow has 34% iter-2 rate. Root cause: waitForPhase() uses wrong phase strings ('playing' when game uses 'game', etc.). Fix: `extractPhaseNamesFromGame()` in prompts.js parses actual phase names from HTML (assignments, comparisons, data-phase attributes, gameState shape) and injects GF1 rule into game-flow test-gen: "use ONLY these exact phase names — never guess". GF2 rule handles init-only snapshot case. 8 unit tests; 545 total pass. Deployed 2026-03-20. Expected: significant reduction in game-flow iter-2 wrong-phase timeout failures. |
| **Measure cross-batch-guard + gen-timeout + phase-hints impact** | **measuring** | 4 fixes shipped this session: (1) cross-batch-guard false rollback fix, (2) gen LLM timeout 300→600s, (3) M1-M5 mechanics rules, (4) GF1/GF2 game-flow phase hints. Awaiting 5-10 builds on the new code to measure: (a) iteration-1 pass rates per category, (b) no more iterations=0 failures for large specs, (c) no more cross-batch false rollbacks. Track builds 374+ (first clean run with all 4 fixes). Next: if all 4 improvements confirmed, pivot to non-standard lifecycle test-gen measurement. |
| **Rendering failure prevention: R1-R5 rules in test-gen + gen-prompt** | **done (2026-03-20, commit 1645449)** | Top 3 patterns identified from 106 rendering learnings: (1) toBeVisible called before startGame(), (2) transition-slot button checked immediately after startGame(), (3) direct window.gameState.content access instead of fallbackContent. Added R1-R5 rules to buildTestGenCategoryPrompt + 2 gen-prompt rules. 545 tests pass. |
| **Queue-sync: detect orphaned DB-queued builds with no BullMQ job** | **done (2026-03-20, commit 924c9a5)** | `requeueOrphanedQueuedBuilds()` added to worker.js startup — compares DB `status='queued'` count against BullMQ waiting+active count; if BullMQ has fewer jobs than DB-queued builds (e.g. after crash-loop empties Redis), re-enqueues all orphaned builds using `jobId='build-{id}'` for idempotency. 5 new unit tests; 550 total pass. Recovers up to 37 builds per crash-loop incident automatically. | Zero manual re-queues needed after any future worker crash-loop; prevents silent queue loss |
| **Increase RALPH_GEN_LLM_TIMEOUT default 600s → 1200s** | **done (2026-03-20, commit 60bd7ae)** | `lib/config.js` | zip (56KB spec) timed out at exactly 600s. two-digit-doubles-aided took 373s for a smaller spec; interactive-chat (59KB) and bubbles-pairs (64KB) also in queue. 1200s gives headroom for large CDN game specs generating 32K output tokens via Claude CLI. | Unblocks large-spec games timing out at 600s boundary; prevents 0-iteration failures on specs >50KB |
| **Non-standard lifecycle test gen** | **measuring** | H1 (LIVES SYSTEM CHECK rule) + H2 (GAME FEATURE FLAGS block) shipped. Awaiting 10 builds to measure 0-iteration-kill rate on non-standard lifecycle games. Trace doc at docs/rnd-nonstandard-lifecycle-test-gen.md. |
| **Screenshot-on-timeout fix context** | **done (2026-03-20, commit dc0c72f)** | Playwright config: `screenshot: 'only-on-failure'`; `collectTimeoutScreenshots()` walks JSON result tree and returns base64 PNGs for failing timeout tests (max 2); fix prompt becomes a vision content array when screenshots exist. 550 tests pass. Expected: timeout-class failures diagnosed visually in first fix iteration — LLM sees what game looked like when test hung. |
| **adjustment-strategy chronic failure deep-dive** | **active** | 34 games queued; adjustment-strategy is last known chronic failure (59 builds, oscillating). H1: SSH to server, query DB for all adjustment-strategy builds (status, iterations, per-category failures), inspect GCP HTML from best-but-failed builds vs approved builds to identify structural differences. H2: identify which category+test case fails consistently across iterations 3-5. Goal: pinpoint root cause preventing reliable convergence — inform whether a spec fix, prompt rule, or HTML pattern change is needed. Measurement: adjustment-strategy next build should APPROVE in ≤3 iterations. |
| **Include full error messages in fix loop failure descriptions** | **done (2026-03-20, commit d436b2c)** | lib/pipeline-fix-loop.js | Fix loop failure descriptions now include full error messages instead of truncated summaries — LLM fix prompt has full context for root-cause diagnosis. Previously, error messages were being summarized, causing the fix LLM to diagnose based on partial information. |
| **Enforce test.describe() API in Playwright test gen** | **done (2026-03-20, commit 4a6314c)** | lib/pipeline-test-gen.js, lib/prompts.js | Test generation prompt now explicitly enforces `test.describe()` wrapper API — prevents LLM from generating flat `test()` calls at the top level, which Playwright rejects with "test() not expected here" when run outside a describe block. |
| **Show pipeline errors in Slack failure messages** | **done (2026-03-20, commit 948e455)** | worker.js, lib/slack.js | Worker now includes pipeline error details in Slack failure notifications — operators see the actual error reason (e.g., "Step 1d: Page load failed") in Slack instead of just "FAILED". Eliminates needing to SSH and check logs to know why a build failed. |
| **Fix CLI gen timeout: apply RALPH_GEN_LLM_TIMEOUT to Claude CLI path** | **done (2026-03-20, commit efd2bdc)** | lib/pipeline.js or ralph.sh | The separate `RALPH_GEN_LLM_TIMEOUT` (600s) was only applied to API path; CLI (`claude -p`) generation calls still used the shorter `RALPH_LLM_TIMEOUT`. Fixed to use the longer timeout for both paths — large-spec games no longer time out on the CLI gen path. |
| **Fix learning extraction: handle string failures from fix-loop** | **done (2026-03-20, commit c3511d5)** | worker.js or lib/pipeline.js | Learning extraction crashed when `failures` array contained string entries (from fix-loop error strings) instead of structured objects. Added guard: strings are skipped or normalized before extraction. Prevents learning-extraction from throwing on every build with string-format failures. |
| **Step 1d regen: #gameContent missing after regen (bubbles-pairs pattern)** | **planned** | lib/pipeline.js, lib/pipeline-utils.js | `runPageSmokeDiagnostic()` regenerates HTML once on fatal errors, then aborts if still broken. bubbles-pairs failed Step 1d with "Blank page: missing #gameContent element" after regen — the regen attempt did not fix the structural issue. Investigate: (1) does regen prompt include the specific missing-element error? (2) should Step 1d do 2 regen attempts for #gameContent-specific failures? (3) is the smoke-check detecting a CDN partial-load state that clears on retry? |

### Cross-game learning injection — design notes

- **Source**: `learnings` table already populated per build (`level`, `category`, `content`). APPROVED builds are ground truth.
- **Retrieval**: at Step 1 (gen) and Step 3 (fix), query `learnings WHERE resolved=0` for games sharing the same PART set (parsed from spec CDN section). Top-N by recency + category relevance.
- **Injection**: append as `## Lessons from similar games` block to gen/fix system prompt — same slot as spec-derived hints.
- **Scope**: `pipeline.js` only. No new DB schema (learnings table already exists). No new env var needed.
- **Success metric**: average iterations-to-pass drops; track via `builds.iterations` across next 10 builds post-deploy.

---

## P7 — Code Architecture & Best Practices

> Audit date: 2026-03-20. All items identified from reading lib/pipeline.js (4105 lines → now 1263 lines), pipeline-fix-loop.js (1036), pipeline-test-gen.js (627), pipeline-targeted-fix.js (392), worker.js (1111 lines), server.js (572 lines), lib/db.js (468 lines), lib/slack.js (561 lines). P7 split complete — no single file exceeds 2000 lines.

| Item | Status | File(s) | Notes |
|------|--------|---------|-------|
| Extract all LLM prompt strings into lib/prompts/ | **done (2026-03-20)** | lib/prompts.js | 18 prompt builders extracted from pipeline.js inline template literals; pipeline.js: 4105 → 3592 lines. Shipped commit d6d619f. |
| Extract snapshot/harness/spec utilities into lib/pipeline-utils.js | **done (2026-03-20)** | lib/pipeline-utils.js | 12 utility functions (captureGameDomSnapshot, captureBehavioralTranscript, injectTestHarness, extractSpecRounds, extractSpecMetadata, extractTestGenerationHints, etc.) extracted; pipeline.js: 3592 → 2433 lines. Shipped commit 6c52240. |
| Split pipeline.js (~2433 lines) into focused sub-modules | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-fix-loop.js, lib/pipeline-test-gen.js, lib/pipeline-targeted-fix.js | pipeline.js: 2433 → 819 lines; lib/pipeline-fix-loop.js (802 lines), lib/pipeline-test-gen.js (569 lines), lib/pipeline-targeted-fix.js (422 lines) created; 385 tests pass; deployed 2026-03-20 (commit 73cc250). |
| Deduplicate REVIEW_SHARED_GUIDANCE (used as literal string in re-review prompt) | **done (2026-03-20)** | lib/prompts.js | buildReReviewPrompt had an inline copy of REVIEW_SHARED_GUIDANCE that was missing RULE-003 and RULE-005 and had a stricter General guidance clause. Replaced with `${REVIEW_SHARED_GUIDANCE}` constant reference. All 3 review prompts (buildEarlyReviewPrompt, buildEarlyReReviewPrompt, buildReReviewPrompt) now use the canonical constant. 441 tests pass. |
| Deduplicate playwright.config.js template (written twice) | **done (2026-03-20)** | lib/pipeline.js | `buildPlaywrightConfig(port)` helper extracted; both runPipeline() and runTargetedFix() use it. Shipped commit a8392bc. |
| Deduplicate CATEGORIES / SPEC_ORDER constant (defined three times) | **done (2026-03-20)** | lib/pipeline-utils.js | CATEGORY_SPEC_ORDER added to pipeline-utils.js as single source; removed inline declarations from pipeline-fix-loop.js, pipeline-test-gen.js, pipeline-targeted-fix.js. MODEL_COSTS/estimateCost and findFreePort also centralized. 417 tests pass. Commit 0e753c0. |
| Deduplicate CDN constraint rules across fix prompts | **done (2026-03-20)** | lib/prompts.js | CDN_CONSTRAINTS_BLOCK expanded with SENTRY ORDER, DEBUG FUNCTIONS, SCREENLAYOUT rules; reused in buildFixPrompt, buildGlobalFixPrompt, buildTargetedFixPrompt. Net -34 lines. 441 tests pass; deployed 2026-03-20 (commit e7878e7). |
| Deduplicate beforeEach replacement blocks | **done (2026-03-20)** | lib/pipeline-test-gen.js | `buildBeforeEach(hasCdnSlot, slotId)` extracted; both sharedBoilerplate and newBeforeEach rewrite use it. 487 tests pass. Commit c164b67. |
| Centralize all env var reads into lib/config.js | **done (2026-03-20)** | lib/config.js | Created lib/config.js with loadConfig() exporting a frozen object of all 40+ env vars with defaults and type coercions. Throws in production if GITHUB_WEBHOOK_SECRET/PROXY_URL/PROXY_KEY missing; warns if SLACK_BOT_TOKEN/RALPH_GCP_BUCKET empty. Updated pipeline.js, pipeline-fix-loop.js, pipeline-test-gen.js, pipeline-targeted-fix.js to import from config. Skipped gcp.js/slack.js/db.js/llm.js/server.js/worker.js (tests mock process.env via require-cache invalidation — safe to leave as-is). 417 tests pass. |
| Remove lazy require() calls inside function bodies | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-targeted-fix.js, lib/pipeline-utils.js, worker.js, server.js | Moved require('child_process'), require('net'), require('./db'), require('crypto'), require('./lib/pipeline'), require('bullmq').Queue, require('fs'), require('path') from function bodies to top-level. Kept intentional lazy requires: @playwright/test in captureGameDomSnapshot, ./db in getRelevantLearnings (optional dep comment), ./lib/mcp in getMcpServer (optional dep), @modelcontextprotocol/sdk and ioredis/bullmq in require.main block. 417 tests pass. |
| Replace duplicate server proc spawn with a shared helper | **done (2026-03-20)** | lib/pipeline-utils.js | `spawnServeProcess(dir, port)` extracted; 3 call sites replaced. Commit aa14901. |
| (stale entry) | **done** | child_process.spawn('npx', ['-y', 'serve', dir, '-l', port, '-s', '--no-clipboard']) appears three times: DOM snapshot server (captureGameDomSnapshot), test server in runPipeline(), test server in runTargetedFix(). Extract to spawnServeProcess(dir, port) returning the child process; all three sites become one-liners and the 2000ms startup wait lives in one place. |
| Extract magic numbers to named module-level constants | **done (2026-03-20)** | lib/pipeline.js, lib/pipeline-targeted-fix.js | Named VALIDATOR_TIMEOUT_MS=10000, SERVER_START_DELAY_MS=2000 in both pipeline.js and pipeline-targeted-fix.js (same values appear in both files). Numbers inside template-string-generated playwright.config.js are not JS literals in our code and were left as-is. 417 tests pass. |
| Add schema migration versioning to lib/db.js | **done (2026-03-20)** | lib/db.js | Replaced 9 try/catch ALTER TABLE blocks with a MIGRATIONS array + user_version pragma. Reads PRAGMA user_version at startup, runs only migrations from currentVersion..DB_VERSION, then writes updated version. To add a migration: append to MIGRATIONS array — no other changes needed. 417 tests pass. |
| Extract Block Kit builder logic from lib/slack.js into composable helpers | **done (2026-03-20)** | lib/slack.js | `buildStatusField()`, `buildProgressFields()`, `buildLinksRow()` extracted; `buildParentBlocks()` 111→34 lines. 487 tests pass. Commit 89ab57e. |
| Add JSDoc to all exported public API functions | **done (2026-03-20)** | lib/pipeline.js, lib/db.js, lib/slack.js, lib/llm.js, lib/pipeline-fix-loop.js, lib/pipeline-utils.js, lib/pipeline-targeted-fix.js | 41 functions documented across 7 files. 487 tests pass. Commit 5d66c74. |
| Define and enforce consistent error handling tiers | **done (2026-03-20)** | lib/pipeline.js, worker.js | 5 real bugs fixed (bare catch {} silently swallowing static-fix, server-start, review LLM, learning-extraction errors); all 34 catch blocks tier-documented (critical/degraded/cosmetic). 487 tests pass. Commit 5929982. |
| Expand pipeline.js test coverage for fix-loop and snapshot paths | **done (2026-03-20)** | test/pipeline.test.js | +15 tests: extractSpecRounds (6), deterministicTriage (4), isInitFailure (3), detectCrossBatchRegression improvement case (1), buildBeforeEach (1). 502 total. Commit f505017. |
| injectTestHarness truncation on $ chars (Sentry) | **done (2026-03-20)** | lib/pipeline-utils.js | Latent bug: `String.replace('</body>', harnessScript)` — if harnessScript ever gained $&/$`/$' patterns, output would silently corrupt. Fixed to `replace('</body>', () => harnessScript)`. 16 new tests (518 total). Commit 351924b. |

---

## Summary

| Pillar | Done | Planned | Total |
|--------|------|---------|-------|
| P0 Deployment Blockers | 12 | 0 | 12 |
| P1 Testing & Validation | 8 | 0 | 8 |
| P2 Spec Compliance | 6 | 0 | 6 |
| P3 DevOps & Operations | 13 | 0 | 13 |
| P4 Code Quality | 6 | 0 | 6 |
| P5 Scalability | 13 | 1 | 14 |
| P6 Test Generation Quality | 53 | 5 | 58 |
| P7 Code Architecture | 9 | 6 | 15 |
| P8 Build Reliability | 5 | 2 | 7 |
| **Total** | **125** | **11** | **139** |

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
12. **Multi-game scale validation** — run all specs in warehouse/templates/ to stress-test the pipeline; 37 builds currently queued (5 recent approvals: aided-game, one-digit-doubles, position-maximizer, queens, sequence-builder; 5 orphaned builds requeued after worker restart)
13. **[R&D — DONE] require() cache bust** — worker.js self-patches require() cache on HEAD change; commit f77b404; hot-deploy without worker restart now safe for lib/ changes
14. **[R&D — DONE] Gen prompt T1 compliance** — initSentry + debug rules moved to rule 5 (early in prompt); blank-page smoke check backstop; 447 tests pass; commits 14ab33c + cad2ca3
15. **[R&D — DONE] E9 cross-build pattern injection** — findMatchingPattern() + iteration-1 injection; 444 tests pass; commit 26b21b0
16. **[R&D — DONE] First-pass failure root cause analysis** — 65 triage events classified: 58% HTML fatal init, 22% phase-transition syncDOMState(), 9% data-shape. Shipped abort-on-snapshot-failure + Rule 22 (syncDOMState after every phase assignment). See Lessons 49 and 50 in docs/lessons-learned.md.
17. **[R&D — DONE] Measure cross-batch-guard + gen-timeout + phase-hints impact** — 4 fixes shipped: cross-batch-guard false rollback fix, gen LLM timeout 300→600s, M1-M5 mechanics rules, GF1/GF2 phase hints. Measurement window: builds 374+.
18. **[R&D — DONE] Queue-sync: detect orphaned DB-queued builds** — `requeueOrphanedQueuedBuilds()` in worker.js; compares DB queued count vs BullMQ queue depth; re-enqueues orphans with idempotency key; 5 new tests; 550 pass; deployed 2026-03-20 (commit 924c9a5). Recovers up to 37 builds per crash-loop incident.
19. **[R&D — DONE] Increase RALPH_GEN_LLM_TIMEOUT 600s → 1200s** — zip (56KB) timed out at exactly 600s; raised default in lib/config.js; deployed 2026-03-20 (commit 60bd7ae). Unblocks large-spec games.
20. **[R&D — measuring] Non-standard lifecycle test gen measurement** — H2 shipped (GAME FEATURE FLAGS block); measuring 0-iteration-kill rate across next 10 builds for non-standard lifecycle games.
21. **[R&D — ACTIVE] adjustment-strategy chronic failure deep-dive** — 15/15 real pipeline failures are adjustment-strategy; root cause unknown post-spec-contradiction-fix; trace per-iteration failure breakdown to identify structural issue. See P6 table for full hypothesis set.
22. **[R&D — PLANNED] Measure abort-on-snapshot-failure impact** — add Prometheus counter for FatalSnapshotError regen triggers; track trigger rate over next 10 builds; if >20% investigate gen prompt improvements to reduce initial blank-page rate.
23. **[SHIPPED] popup-backdrop teardown Rule 24 + Lesson 58** — VisibilityTracker backdrop overlay intercepts clicks at iter 2; Rule 24 + CDN_CONSTRAINTS_BLOCK POPUP-BACKDROP TEARDOWN constraint deployed 2026-03-20 (commit 7428526); Lesson 58 in docs/lessons-learned.md.
24. **[SHIPPED] Passing-test-protection regex fix** — `passingContext` name extraction was always empty (regex `^\}` never matched indented `  });`); switched to name-only list format; "MUST keep passing" constraint now functional; prevents iter-3 regressions; deployed 2026-03-20 (commit 275d14f).
11. **Human-run Playwright traces** — record `--trace` from a correct human test run; use as ground truth for test generation, eliminating LLM selector hallucinations
12. **E4 warehouse-aware context** — deterministic Stage 1: spec → capability matrix → dependency graph → assembled prompt (skipped per user request)
