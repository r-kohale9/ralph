# Ralph Pipeline — Documentation Index

## Areas (ongoing responsibilities)

| Doc | Contents |
|-----|----------|
| [Pipeline Architecture & Operations](areas/pipeline.md) | Architecture, pipeline steps, CDN components, test harness, API routes, DB schema, key files, env vars, code style, failure taxonomy, build artifacts |
| [Build Management](areas/build-management.md) | Kill criteria, when to let a build continue, lifecycle commands, git sync procedure, monitoring loop |
| [Education Slot](education/README.md) | Session Planner vision, trig session, interaction patterns |

## Resources (reference material)

| Doc | Contents |
|-----|----------|
| [Lessons Learned](lessons-learned.md) | Accumulated pipeline build lessons + proof log. Read before diagnosing failures. |
| [Failure Patterns Tracker](resources/failure-patterns-tracker.md) | Ranked active failure patterns by frequency — primary input for R&D slot selection |
| [Per-Spec RCAs](spec_rca/) | Per-game failure history — stubs redirect to `warehouse/templates/<game>/rca.md` for games with warehouse entries. Non-warehouse games have full RCA here. |
| [Per-Game Artifacts](../warehouse/templates/) | Primary home for per-game docs: `rca.md`, `ui-ux.md`, `spec.md`, `game/index.html`, `review-findings.md` |
| [Spec Creation Workflow](resources/spec-creation-workflow.md) | MCP-based spec creation using Claude Desktop + Ralph MCP tools |
| [Testing Architecture](resources/testing-architecture.md) | Test harness design, CORE tests (deterministic), supplementary LLM tests, game taxonomy |
| [Deployment Runbook](resources/deployment.md) | First-deploy setup, systemd services, Nginx, troubleshooting |

## Archive (completed analyses — preserved for reference)

### R&D analyses (`archive/rnd/`)

Completed R&D investigations. Not active reference — consult lessons-learned.md instead.

| File | Topic |
|------|-------|
| [first-attempt-rate.md](archive/rnd/first-attempt-rate.md) | First-attempt pass rate analysis |
| [smoke-regen-measurement.md](archive/rnd/smoke-regen-measurement.md) | Smoke-regen effectiveness measurement |
| [prompt-gap-analysis.md](archive/rnd/prompt-gap-analysis.md) | Generation prompt gap analysis |
| [fix-prompt-audit.md](archive/rnd/fix-prompt-audit.md) | Fix loop prompt audit |
| [linter-effectiveness.md](archive/rnd/linter-effectiveness.md) | T1 linter effectiveness study |
| [test-failure-analysis-global.md](archive/rnd/test-failure-analysis-global.md) | Global test failure analysis |
| [test-failure-analysis-per-spec.md](archive/rnd/test-failure-analysis-per-spec.md) | Per-spec test failure analysis |
| [never-approved-analysis.md](archive/rnd/never-approved-analysis.md) | Analysis of games that never got approved |
| [consistent-failures-rca.md](archive/rnd/consistent-failures-rca.md) | Root cause analysis of consistent failures |
| [educational-interactions.md](archive/rnd/educational-interactions.md) | Educational interaction types and pedagogy analysis |
| (others) | See `archive/rnd/` for full list |

### Historical docs (`archive/historical/`)

Superseded or completed one-time analyses.

| File | Notes |
|------|-------|
| [failure-analysis.md](archive/historical/failure-analysis.md) | Comprehensive build failure analysis (builds 1–285). Findings incorporated into lessons-learned.md. |
| [pipeline-learnings.md](archive/historical/pipeline-learnings.md) | CDN compatibility fix log (13 fixes). Findings in lessons-learned.md. |
| [behavioral-transcript.md](archive/historical/behavioral-transcript.md) | Design doc for Step 2.5b behavioral transcript feature |
| [session-bootstrap.md](archive/historical/session-bootstrap.md) | Superseded by CLAUDE.md Rule 12 (session continuity) |
| [local-testing.md](archive/historical/local-testing.md) | Superseded by CLAUDE.md Rule 13 (local test slot) + diagnostic.js |
| [scale-config.md](archive/historical/scale-config.md) | Scale configuration guide (resource gates, Prometheus metrics) |
| [distributed.md](archive/historical/distributed.md) | Distributed multi-worker architecture options |
