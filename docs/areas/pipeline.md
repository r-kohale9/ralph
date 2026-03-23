# Ralph Pipeline Architecture

## What Is Ralph?

Ralph is an automated game-building pipeline that converts Markdown game specifications into validated, deployable HTML5 educational games. It orchestrates a sequence of LLM calls, static analysis passes, browser-based Playwright tests, and a review step — all coordinated by a BullMQ worker and reported in real-time to a Slack thread. The pipeline is deterministic in structure (same steps every build) but adaptive in execution (fix loops, rollbacks, global cross-category repair).

---

## Pipeline Steps at a Glance

| Step | Label | Description | Model |
|------|-------|-------------|-------|
| 1 | HTML Generation | Generate a complete single-file HTML5 game from spec | `RALPH_GEN_MODEL` (claude-opus-4-6) |
| 1a | Static Validation | Check required structural elements; auto-fix on failure | `RALPH_FIX_MODEL` (claude-sonnet-4-6) |
| 1b | Contract Validation | Runtime contract checks (gameState, postMessage); auto-fix | `RALPH_FIX_MODEL` |
| 1c | Early Review | Fast spec-compliance review before spending test tokens | `RALPH_REVIEW_MODEL` (gemini-2.5-pro) |
| 2a | Test Case Generation | Produce structured test case list from spec | `RALPH_TEST_MODEL` (gemini-2.5-pro) |
| 2.5 | DOM Snapshot | Headless browser capture of real element IDs | — |
| 2b | Test Generation | Generate Playwright `.spec.js` files per category | `RALPH_TEST_MODEL` |
| 3 | Test → Fix Loop | Per-category iterative fix (max 5 iterations each) | `RALPH_FIX_MODEL` / `RALPH_FALLBACK_MODEL` |
| 3c | Global Fix Loop | Cross-category root-cause fix (max 2 iterations) | `RALPH_GLOBAL_FIX_MODEL` (claude-opus-4-6) |
| 4 | Review | Final spec compliance + test score review | `RALPH_REVIEW_MODEL` |
| 4b | Review Fix Loop | Targeted HTML fix on rejection (max 3 attempts) | `RALPH_FIX_MODEL` |
| 5 | Learning Extraction | Extract generalizable lessons to global-learnings.md | `RALPH_LEARNINGS_MODEL` |

---

## Step-by-Step Description

### Step 1: HTML Generation

The pipeline calls the generation LLM with the full game spec and any accumulated global learnings. The LLM produces a single `.html` file containing:

- MatHai CDN script tags (FeedbackManager, ScreenLayout, ProgressBar, Timer, VisibilityTracker)
- CDN init sequence in the required order: `await FeedbackManager.init()` → `ScreenLayout.inject()` → `initGame()`
- A `window.gameState` object exposed globally
- `window.parent.postMessage()` calls at game-over
- All game functions in global scope (`window.endGame = endGame` etc.)
- DOM elements with stable `data-testid` attributes

If a pre-built HTML exists in the warehouse directory, generation is skipped and the existing file is used as the starting point.

After generation, the test harness (`<script id="ralph-test-harness">`) is injected deterministically by the pipeline — not by the LLM — using spec metadata extracted from the Markdown.

### Step 1a: Static Validation

The static validator (`lib/validate-static.js`) runs 10 structural checks on the HTML. These are regex-based and fast (no browser). Common checks include: presence of `id="gameContent"`, `initGame()` function, star threshold logic (80%/50%), absence of inline `onclick=` handlers on dynamic elements, and correct CDN script order.

On failure, the pipeline calls `FIX_MODEL` with the exact error output and the current HTML. If the fix call succeeds and produces valid HTML, the file is overwritten. The pipeline always emits `static-validation-passed` once static checks are satisfied (whether originally or after a fix).

### Step 1b: Contract Validation

The contract validator (`lib/validate-contract.js`) checks runtime contracts:
- `window.gameState` is defined and has required fields
- `window.parent.postMessage` is called with `{ type: 'gameOver', score, stars, total }`
- Scoring logic is consistent with the spec

Contract validation is non-blocking — failures produce a Slack warning and trigger an auto-fix attempt, but a contract failure does not abort the build.

### Step 1c: Early Review

Before spending tokens on test generation and execution, the pipeline runs a fast spec compliance review. The reviewer LLM walks through every item in the spec's Verification Checklist. It only rejects on clear, definitive violations — not on ambiguous items or style issues.

On REJECTED: one fix attempt with `FIX_MODEL` is applied, then re-reviewed. If still rejected, the build fails early. On APPROVED: the `early-review-approved` progress event fires and the build continues to test generation.

### Step 2a: Test Case Generation

The test model generates a structured JSON list of test cases from the game spec. Each test case has a name, category, description, and human-readable steps. Categories are:

- `game-flow` — screen transitions (start → game → level transition → end screen)
- `mechanics` — core interactions (input, submit, feedback, score)
- `level-progression` — how levels change (difficulty, round structure)
- `edge-cases` — boundary values, invalid input, rapid actions
- `contract` — gameOver postMessage event (type, score, stars, total)

Test cases are saved to `test-cases.json` and used both to inform test generation and to populate the `tests-generated` progress event with per-category counts.

### Step 2.5: DOM Snapshot

A headless browser launches the game and captures real element IDs and selectors. This snapshot is injected into test generation prompts so the LLM uses actual DOM selectors rather than guessing from HTML source. The snapshot is optional (controlled by `RALPH_SKIP_DOM_SNAPSHOT`).

### Step 2b: Test Generation

For each missing category, the pipeline calls the test model with the spec, DOM snapshot, shared boilerplate, and category-specific instructions. The LLM generates the body of a `test.describe()` block. The pipeline wraps it in boilerplate that includes:

- `dismissPopupIfPresent()` — handles FeedbackManager audio permission popup
- `startGame()` — clicks through all initial transition screens
- Shared helpers: `waitForPhase()`, `getLives()`, `getScore()`, `getRound()`, `answer()`, `skipToEnd()`

After generation, a series of post-processing fixes are applied to every spec file: correct `beforeEach` order (dismiss popup before waiting for transition slot), fix wrong selectors (transition slot, progress bar IDs), and fix `await expect(page.evaluate(...))` → `expect(await page.evaluate(...))`.

### Step 3: Test → Fix Loop

Tests are grouped into batches (default batch size = 1 category each). The pipeline runs Playwright against each batch iteratively, up to `MAX_ITERATIONS` (default 5) per batch. On each iteration:

1. **Run** — Execute `npx playwright test` for the batch. Parse JSON results.
2. **Track** — If pass count improves, snapshot the HTML as `bestHtml`.
3. **Triage** — Ask `TRIAGE_MODEL` whether to fix the HTML, skip bad tests, or add assertions.
4. **Fix** — Call `FIX_MODEL` with the failing test output, current HTML, and fix strategy. If FIX_MODEL fails, fall back to `FALLBACK_MODEL`.
5. **Rollback** — If the fix shrinks the HTML by more than 30%, immediately restore the previous snapshot and break.
6. **Re-inject** — Re-inject the test harness after every fix (the LLM may have removed it).

On iterations 3+, "DIAGNOSIS MODE" is engaged: the fix prompt prepends the full fix history and asks the LLM to diagnose the root cause before fixing.

At the end of each batch, if the current HTML is worse than the best snapshot, the best snapshot is restored.

### Step 3c: Global Fix Loop

After all per-category fix loops, if any categories still have failing tests, the global fix loop runs. It re-tests all categories simultaneously, collects all failures, and calls `GLOBAL_FIX_MODEL` with a cross-category prompt that can see failures from all categories at once. This catches root causes that are only visible when looking at the full picture (e.g., a shared state mutation that breaks multiple categories).

The global fix loop runs up to `MAX_GLOBAL_FIX_ITERATIONS` times (default 2). After each global fix, all categories are re-tested. The same 30% shrink rollback protection applies.

### Step 4: Review

After the fix loops, if overall pass rate is at least 70% and game-flow has at least 1 passing test, the pipeline proceeds to a final LLM review. The reviewer gets the spec, the test category scorecard, and the final HTML. It walks through every Verification Checklist item.

On REJECTED, up to 3 targeted HTML fix attempts are made (Step 4b). Each fix targets the specific rejection reasons. The build status becomes APPROVED or REJECTED based on the final review outcome.

### Step 5: Learning Extraction

For any build with test failures or a review rejection, the pipeline calls `LEARNINGS_MODEL` to extract 1–4 short, generalizable bullet points about what went wrong and how to fix it. These are appended to `data/global-learnings.md` and injected into future generation prompts.

---

## Test Harness APIs

The test harness (`<script id="ralph-test-harness">`) is injected by the pipeline (not the LLM) after HTML generation and after every fix. It provides:

| API | Description |
|-----|-------------|
| `window.__ralph.answer(correct)` | Simulate a correct or incorrect answer |
| `window.__ralph.endGame()` | Call the game's `endGame()` function directly |
| `window.__ralph.jumpToRound(n)` | Set the round counter to n |
| `window.__ralph.setLives(n)` | Set the lives counter to n |
| `window.__ralph.getState()` | Return a snapshot of `window.gameState` |
| `window.__ralph.getLastPostMessage()` | Return the last `postMessage` payload fired |
| `syncDOMState()` | Sync `data-phase`/`data-lives`/`data-round`/`data-score` on `#app` every 500ms |

Phase normalization applied by `syncDOMState()`:

| Raw value | Normalized |
|-----------|-----------|
| `game_over` | `gameover` |
| `game_complete` | `results` |
| `start_screen` | `start` |

Shared test helper functions (injected via `sharedBoilerplate` in test generation):

- `waitForPhase(page, phase)` — wait for `#app[data-phase="phase"]`
- `getLives(page)` — read `data-lives` from `#app`
- `getScore(page)` — read `data-score` from `#app`
- `getRound(page)` — read `data-round` from `#app`
- `skipToEnd(page, reason)` — jump directly to the end state
- `answer(page, correct)` — call `window.__ralph.answer(correct)`

---

## CDN Components (MatHai)

All MathAI games use the MatHai CDN. The pipeline enforces the correct initialization order.

| Component | DOM Slot | Purpose |
|-----------|----------|---------|
| FeedbackManager | — | Audio feedback for correct/incorrect answers. Shows an audio permission popup on init. |
| ScreenLayout | — | Responsive layout injection; provides transition screen infrastructure |
| ProgressBar | `#mathai-progress-slot` | Lives/progress display |
| Timer | `#mathai-timer-slot` | Countdown timer |
| VisibilityTracker | — | Pauses game on tab blur (Playwright sets `visibilityState = 'hidden'` — tests override this) |

**Init order (immutable):**
```js
await FeedbackManager.init();   // 1st — blocks until audio popup dismissed
ScreenLayout.inject(...);       // 2nd — injects layout + transition slot
initGame();                     // 3rd — game logic starts
```

Breaking this order causes the game to not render at all. The `beforeEach` in every test file dismisses the FeedbackManager audio popup before waiting for any game elements.

---

## Key Constraints

| Constraint | Detail |
|-----------|--------|
| Single file | The entire game must live in one `index.html` — no external JS/CSS files |
| CDN-only scripts | Only MatHai CDN scripts allowed; no other external dependencies |
| Global scope | All game functions must be declared at top level or explicitly assigned to `window` |
| postMessage contract | `window.parent.postMessage({ type: 'gameOver', score, stars, total }, '*')` |
| FeedbackManager | Must be fire-and-forget: `.catch(() => {})` — never `await` in an event handler |
| No destroy in endGame | `progressBar.destroy()` / `timer.destroy()` must NOT be called from `endGame()` — tests check slots after game over |
| isProcessing flag | When `isProcessing = true`, clicks are silently blocked (early return) — do NOT hide/show elements |
| Star display | Must update in BOTH the victory path AND the game-over path |
| data-phase | `gameState.phase` must be set at every state transition so `waitForPhase()` works |

---

## Failure Taxonomy

| Category | Description | Common Cause |
|----------|-------------|-------------|
| `rendering` | DOM elements not visible or not present | Missing `id="gameContent"`, layout not injected |
| `state` | gameState not initialized or wrong fields | `initGame()` never called, CDN init order broken |
| `scoring` | Wrong score/stars at end | Star formula mismatch with spec |
| `timing` | `waitForPhase()` times out | `gameState.phase` not set on state transitions |
| `interaction` | Clicks not registering | `isProcessing` not cleared, wrong selectors |
| `messaging` | postMessage payload wrong or not fired | `endGame()` not calling `postMessage`, wrong field names |
| `layout` | Viewport/responsive issues | 480px viewport not respected |
| `completion` | Game-over path not reachable | `endGame()` never called on lives=0 |

---

## Artifacts Produced Per Build

| Artifact | Path | Description |
|----------|------|-------------|
| `index.html` | `data/games/{gameId}/builds/{buildId}/index.html` | Final game HTML (with test harness injected) |
| `ralph-report.json` | same dir | Full build report: status, iterations, test results, review result |
| `test-cases.json` | same dir | Structured test case list from spec |
| `tests/` | same dir | Generated Playwright spec files (one per category) |
| `test-results.json` | same dir | Last Playwright JSON output |
| `playwright.config.js` | same dir | Per-build playwright config with dynamic port |
| GCP: `spec.md` | `games/{gameId}/builds/{buildId}/spec.md` | Game spec uploaded for reference |
| GCP: `pipeline-docs.md` | same dir | Build plan summary |
| GCP: `review-report.md` | same dir | Final review LLM output |
| GCP: `test-cases/{cat}.md` | same dir | Per-category test cases as markdown |
| GCP: `index.html` (generated) | `games/{gameId}/{buildId}-generated.html` | HTML snapshot at generation time |
| GCP: `index.html` (fixN) | `games/{gameId}/{buildId}-fixN.html` | HTML snapshots after each fix iteration |

---

## Progress Events (Slack Narration)

The pipeline emits `progress(step, detail)` calls throughout execution. The worker listens and posts Block Kit messages to the Slack thread:

| Event | Slack Step | Message |
|-------|-----------|---------|
| `html-ready` | Step 1 | HTML generated — model, size, link |
| `static-validation-failed` | Step 1a | Static issues list + auto-fix notice |
| `static-validation-fixed` | Step 1a | Fixed + elapsed |
| `early-review-approved` | Step 1c | Early review APPROVED |
| `early-review-rejected` | Step 1c | Early review REJECTED + fix model |
| `tests-generated` | Step 2 | Model + total tests + per-category counts |
| `test-result` | Step 3 | Per-iteration pass/fail + full failure messages |
| `html-fixed` | Step 3 | Fix model + before/after size + link |
| `global-fix-start` | Step 3c | Failing categories + global fix model |
| `global-fix-applied` | Step 3c | Fix applied + link |
| `review-complete` | Step 4 | Status + model + per-category scorecard + link |

---

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

---

## Database Tables

| Table | Purpose |
|-------|---------|
| builds | Build records: id, game_id, status, iterations, test_results, feedback_prompt, gcp_url |
| games | Game registry: game_id (PK), title, spec_content, spec_hash, status, slack_thread_ts, gcp_url |
| learnings | Accumulated insights: game_id, build_id, level, category, content, source, resolved |
| failure_patterns | E7 failure tracking: game_id, pattern, category, occurrences |

---

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

---

## Environment Variables

Requires Node.js >=20, Redis for BullMQ. See `.env.example` for all config vars. **Critical:** `GITHUB_WEBHOOK_SECRET` required when `NODE_ENV=production`.

Key vars: `RALPH_ENABLE_CACHE=1`, `RALPH_USE_NODE_PIPELINE=1`, `RALPH_DEPLOY_ENABLED=1`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`, `RALPH_GCP_BUCKET`, `RALPH_WAREHOUSE_DIR`, `RALPH_DEPLOY_DIR`.

Optional deps (install failures won't block): `@sentry/node`, `@google-cloud/logging`, `@slack/web-api`, `@google-cloud/storage`.

For scale/resource gate settings, see `docs/archive/historical/scale-config.md`. For distributed multi-worker setup, see `docs/archive/historical/distributed.md`.

---

## Code Style

- `'use strict'` in all modules, CommonJS (`require`/`module.exports`), no TypeScript
- ESLint + Prettier configured (see `.eslintrc.js`, `.prettierrc.json`)
- Express 5.x — async errors caught automatically; SQLite via better-sqlite3 (synchronous)
- `lastInsertRowid` must be wrapped in `Number()` (BigInt issue)

---

## Known Constraints

- `llm.js` used by `pipeline.js` (E3) and tests; `ralph.sh` still calls CLIProxyAPI via curl.
- Worker supports dual-mode: bash (`ralph.sh`, default) or Node.js (`pipeline.js`, opt-in via `RALPH_USE_NODE_PIPELINE=1`).
- `validate-static.js` checks `id="gameContent"` via regex.

---

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

These are checked by T1 static validator (sections 5b3, 5d) and enforced as rules 20/21 in the gen prompts.

For full test harness implementation details, see `docs/resources/testing-architecture.md`.

---

## DOM Snapshot & Test Generation Context

`captureGameDomSnapshot()` (lib/pipeline.js Step 2.5) runs headless Playwright against the generated game and captures:
- Element IDs/classes/visibility from start screen and game screen — injected into test-gen prompts as "ACTUAL RUNTIME DOM"
- `window.gameState` shape — property names and value types — injected as "WINDOW.GAMESTATE SHAPE" section, preventing test generators from guessing wrong data structures
- `window.gameState?.content` saved to `tests/game-content.json` for fallbackContent when DOM snapshot rounds are empty

If snapshot fails (timeout on CDN transition slot), falls back to static HTML element extraction (no runtime state shape).
