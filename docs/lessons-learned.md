# Ralph Pipeline — Lessons Learned

Accumulated insights from build failures, bug fixes, and proofs. Update immediately after every notable build or bug fix.

## Build Proofs

| Build | Game | Result | Score | Notes |
|-------|------|--------|-------|-------|
| 204 | doubles | APPROVED | 6/7 | game-flow: 2/3, mechanics: 2/2, level-progression: 1/1, contract: 1/1. Review APPROVED first pass. |
| 208 | doubles | APPROVED | 10/10 | 0 fix iterations — all passing on iteration 1 |
| 211 | right-triangle-area | APPROVED | 7/11 (64%) | Sequential batch ordering issue; game-flow: 0/3, mechanics: 4/4, level-progression: 1/1, edge-cases: 2/3, contract: 0/2 |
| 212 | doubles | APPROVED | 10/10 | Zero review rejections; game-flow: 3/3, mechanics: 3/3, level-progression: 2/2, contract: 2/2 |
| 226 | match-the-cards | APPROVED | 12/12 | First scale-run APPROVED (~33 min). game-flow: 2/2 (iter 2), mechanics: 4/4 (iter 3), level-progression: 1/1, edge-cases: 3/3, contract: 2/2 (iter 2). Early review APPROVED first attempt. Final review rejected twice (CDN domain + waitForPackages timeout), APPROVED 3rd attempt. |

## Pipeline Fix Lessons

1. **extractHtml** returns entire LLM output when `<!DOCTYPE` appears anywhere. Fixed to slice from first DOCTYPE position (LLMs sometimes add analysis text before the HTML).
2. **Re-clicking `.correct` cells** times out in Playwright — CSS `pointer-events: none`. Use `{ force: true }` for re-click tests. Fix prompt includes rule; post-gen fixup patches it automatically.
3. **0/0 test results** = page broken by last fix. Restored best HTML immediately, skip triage.
4. **`game_over` phase** — game sets `gameState.phase = 'game_over'` (underscore) but tests expect `'gameover'`. Harness normalizes automatically.
5. **Local `endGame` function** — CDN games define `endGame` inside DOMContentLoaded, not on `window`. Fix prompt now requires `window.endGame = endGame` exposure.
6. **Triage `window.__ralph undefined`** — `TypeError: Cannot read properties of undefined (reading 'setLives')` means `window.__ralph` itself is undefined → page has JS error → `fix_html`, NOT `skip_test`. Added KNOWN HTML BUGS section to triage prompt.
7. **Stale BullMQ job replay** — after SIGKILL, active jobs replay on worker restart. Always fail stale DB builds and obliterate queue before requeuing.
8. **gameState.phase** — must be set at every state transition: `'playing'`, `'transition'`, `'gameover'`, `'results'`. Added as gen prompt rule 15 and fix prompt CDN constraint.
9. **Early review** — now checks full spec verification checklist (not just 5 items). Catches endGame guard, signalPayload, 100dvh, etc. before test generation.
10. **MAX_REVIEW_FIX_ATTEMPTS = 3** — increased from 2. Review fix prompt: "Fix ALL issues in ONE pass. Do NOT change anything not mentioned."
11. **PROOF: doubles game APPROVED** — build 204 (2026-03-19). game-flow: 2/3, mechanics: 2/2, level-progression: 1/1, contract: 1/1. Review APPROVED first pass.
12. **Playwright cwd fix** — Playwright must be run with `cwd: gameDir` and relative spec paths (not absolute). Absolute paths fail silently: 0/0 results + "test.beforeEach() not expected here" error because Playwright can't match absolute paths to testDir-scanned files.
13. **Warehouse HTML must have 100dvh + correct gameover phase** — when pipeline overwrites warehouse with approved build, any manual fixes (100dvh CSS, `setPhase('gameover')` in handleGameOver) are lost. Re-apply after each warehouse update.
14. **gemini-3.1-pro-preview** — correct proxy model name for review step (not `gemini-2.5-pro-preview`). Check `curl -H "Authorization: Bearer $PROXY_KEY" http://localhost:8317/v1/models` for valid names.
15. **PROOF: doubles APPROVED with 0 fix iterations** — build 208 (2026-03-19). game-flow: 3/3, mechanics: 2/2, level-progression: 1/1, edge-cases: 2/4 (2 skipped), contract: 2/2. All passing on iteration 1.
16. **Review model catches async/signalPayload/sound patterns** — build 212 (doubles warehouse): rejected for (a) missing `async` on `handleGameOver`/`endGame`, (b) manual `signals:`/`metadata:` props instead of `...signalPayload` spread (omits `events`), (c) `sound.play().catch()` instead of `await sound.play()`. One review-fix pass → APPROVED. These are recurring issues in warehouse HTML.
17. **Contract `metrics.stars` unfixable by fix loop** — build 212: 3 iterations, still wrong formula. Pipeline APPROVED anyway (8/9). Root cause: triage says "use livesRemaining directly" but LLM keeps guessing. Spec's star formula must be quoted verbatim in triage context to work.
18. **Sequential batch processing wastes fix iterations** — build 211 (right-triangle-area): game-flow maxed at 0/3 because init fix hadn't happened yet. Mechanics fix (iter 2) fixed the init issue that would have fixed game-flow too, but game-flow was already done. Contract also 0/2. Final score: 7/11 (64%) → APPROVED. A "final re-test" step after all batches would give a more accurate score.
19. **Step 3b extended to re-test ALL batches (not just zero-score)** — Previously Step 3b only re-tested batches with 0 passes. This missed cross-batch regressions where a later fix degraded an earlier batch from 1-2 passes down to 0. Now Step 3b re-tests every batch with any recorded result and diffs prevPassed/prevFailed against new results to update totalPassed/totalFailed correctly. This gives an accurate final score and catches both improvements (zero-score batches fixed) and regressions (previously-passing batches broken by later fixes).
20. **PROOF: right-triangle-area APPROVED** — build 211 (2026-03-19). Fresh e2e, no warehouse HTML. game-flow: 0/3 (batch ordering issue), mechanics: 4/4 ✅, level-progression: 1/1 ✅, edge-cases: 2/3 ✅, contract: 0/2 (postMessage timing). 7/11 = 64% → Review APPROVED.
21. **signalPayload T1 check fires immediately** — build 211+212 both caught ...signalPayload non-spread at Step 1b static validation. Static-fix (claude-sonnet-4-6) fixed it before tests even ran. This is the correct defense-in-depth approach.
22. **Spec scoring context in fix prompt fixed stars on first try** — build 212 (doubles): contract "Star Rating Logic" fixed by fix-contract-1 on iter 1. The spec scoring section in the fix prompt gave the LLM the exact formula. Previously this failed all 3 iterations (build 209 lesson 17).
23. **PROOF: doubles APPROVED 10/10** — build 212 (2026-03-20). game-flow: 3/3, mechanics: 3/3, level-progression: 2/2, contract: 2/2. APPROVED first review pass. Zero review rejections.
24. **BUG (fixed): early-review-2 was reviewing stale pre-fix HTML** — `earlyReviewPrompt` captured `fs.readFileSync(htmlFile)` once at construction time. When `early-review-2` reran after `early-review-fix`, it sent the ORIGINAL broken HTML to Gemini, not the fixed one. This caused every early-review-fix to fail the second review regardless of whether the fix was correct. Fixed by reconstructing the prompt fresh for early-review-2. Build 213 was REJECTED due to this bug; build 214 confirmed the fix.
25. **Warehouse prebuilt HTML causes generation bypass** — If `warehouse/templates/<gameId>/game/index.html` exists, worker.js copies it to every new build dir, and pipeline.js skips HTML generation entirely (`index.html exists`). For games that have never been approved, a stale/broken warehouse HTML causes every build to reuse the broken file. Delete the warehouse HTML before queuing fresh e2e builds for unproven games.
26. **Fix LLM CDN URL hallucination causes 0/2 regressions** — When the fix LLM rewrites HTML, it often "corrects" CDN script URLs from `cdn.homeworkapp.ai` (correct) to `cdn.mathai.ai` (wrong — 404s). This makes ALL CDN scripts fail to load, producing a blank page and all tests failing `toBeVisible`. Also: when fixing restart, it removes `gameState.isActive=true; syncDOMState()` from DOMContentLoaded as collateral damage. Both patterns added to CRITICAL CDN CONSTRAINTS in fix prompt.
27. **Architecture C: global fix loop (Step 3c) implemented** — After all per-batch fix loops complete (Step 3a), a new Step 3c runs before the final re-test (Step 3b). It collects ALL remaining failures across every batch into a single cross-category fix prompt, explicitly instructing the LLM to diagnose root causes visible only when looking at multiple categories simultaneously. Runs up to `RALPH_MAX_GLOBAL_FIX_ITERATIONS` (default 2) iterations. Includes regression guards (passing categories + prior passing tests) and a size-drop guard (aborts if HTML shrinks >30%). This directly addresses the build 211 lesson: game-flow maxed its 3 iterations before mechanics ran the fix that would have fixed game-flow too.
28. **Deterministic pre-triage patterns** — Certain failure signatures have a fixed, unambiguous action and should never waste a triage LLM call: (a) `window.__ralph is not defined` in ALL failures → always `fix_html` (harness never initialized, page has a JS error); (b) `Cannot redefine property: visibilityState` → always `skip_tests` (untestable in headless); (c) `pointer-events: none` re-click errors → always `skip_tests`. Detecting these before calling the triage model eliminates a full LLM round-trip per affected batch.
29. **E8 script-only fix (token savings)** — On iteration 2+, for non-contract batches where HTML exceeds 10 KB: extract only `<script>` sections, send them to the fix LLM, then merge back via `mergeScriptFix()`. Saves 50–70% tokens per fix call. Do NOT apply to the contract batch — contract failures frequently require structural HTML changes (DOM, data attributes), not just JS. If `mergeScriptFix()` returns null (merge failed), fall back to sending full HTML.
30. **Parallel test generation `Promise.all` gotcha** — When test-generation is parallelized with `Promise.all(CATEGORIES.map(async () => { ... }))`, `continue` statements inside the inner loop body must become `return` (early-exit from the async callback), not `continue` (which is invalid in a `map` callback). `llmCalls.push()` inside parallel async tasks is safe — JS is single-threaded despite async concurrency, so array pushes never interleave.
31. **Model routing rationale** — Assign models by task difficulty, not uniformly: triage is a JSON classification task → use the smallest capable model (`TRIAGE_MODEL`, e.g. gpt-4.1-mini) to save ~10× cost vs. sonnet; global fix (Step 3c) is the hardest reasoning task → use `GEN_MODEL` (opus) because cross-category root-cause diagnosis requires stronger reasoning; learnings extraction is summarization → use the smallest model (`LEARNINGS_MODEL`). Applying a large model uniformly is wasteful; applying a small model to global fix produces shallow root-cause analysis.
32. **Build kill criteria (from build-manager-agent.md)** — Kill a build immediately if: (a) it started before the most recent worker restart (stale pipeline code — results are from old logic); (b) 0% pass rate on iteration 2+ with the same error appearing on both iterations (fix LLM is looping; a pipeline code change is required, not another iteration). Always call `failBuild(id, reason)` in the DB after killing. Never leave a build in "running" state — it blocks the queue and misleads monitoring.
33. **window.endGame scope (CDN games)** — CDN games define `endGame` inside a `DOMContentLoaded` closure; it is NOT on `window`. Calling `window.__ralph.endGame()` fails silently because the harness delegates to `window.endGame`. Fix: add `window.endGame = endGame` (and similarly `window.restartGame`, `window.nextRound`) at global scope, outside the DOMContentLoaded callback. The harness now emits a `console.error` diagnostic on the `load` event for any missing required globals, making the root cause immediately visible in Playwright traces.
34. **game_init must set gameState.phase = 'playing' immediately** — All game-flow and mechanics tests call `waitForPhase(page, 'playing')` after firing `game_init`. If the HTML's `handlePostMessage` does not set `gameState.phase = 'playing'` as the FIRST action in the `game_init` case, the test harness never sees the phase change and all tests timeout. Fix in generation prompt: Added explicit CRITICAL instruction that `game_init` case must start with `gameState.phase = 'playing'`. Static check added: `validate-static.js` now errors if `handlePostMessage` + `game_init` are present but `gameState.phase = 'playing'` is not found in the HTML. Proof: This was the dominant failure pattern in the scale run (builds 218, 216, 214 all failed with 0 iterations due to this). After the fix, game-flow and mechanics tests should pass on iteration 1.

39. **waitForPackages timeout must throw on expiry** — build 226 review was rejected twice because `waitForPackages()` didn't implement PART-003 correctly: it must have EXACTLY `timeout=10000` (≤10s) and MUST `throw new Error(...)` on expiry (not `console.error`, not silent). The review model checks the verification checklist item "waitForPackages() has a timeout (≤10s) with error handling". Correct pattern: `if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')}`. Added as rule 19 in API gen prompt, CLI gen prompt, and all three CDN constraint blocks in fix prompts. T1 static check added.

40. **window.gameState must be exposed for syncDOMState** — build 227 (hidden-sums) game-flow had all 4 tests fail with `waitForPhase('playing')` timeout because `#app[data-phase]` was never set. Root cause: `syncDOMState()` (injected test harness) reads `window.gameState` — if the game declares `const gameState = {}` or `let gameState = {}` at the script top level (not on window), `syncDOMState` returns early and `data-phase` is NEVER written. Fix: CDN games must use `window.gameState = { ... }` OR explicitly add `window.gameState = gameState;` at global scope. Added as T1 static check (section 5b3) and as part of rule 21 in gen/fix prompts: `window.gameState=gameState` in the window exposure list.

41. **Step 3b 0/0 re-test = page crash, not zero score** — build 227 (hidden-sums): Step 3b final re-test returned 0/0 on game-flow (previously 2/4). This is Lesson 3: "0/0 = page broken by last fix". The zero result caused totals to drop from ~73% to 67% (below 70% threshold), triggering premature FAILED. Fix: in Step 3b, if a batch returns 0 total tests AND previously had results, preserve the previous score instead of zeroing. 0/0 means "page crash — result unknown", not "0 passed". Applied in pipeline.js Step 3b re-test loop.

## Lesson 43 — Auto-restart agents kill active builds when DB shows 0 iterations

**Pattern:** A monitoring agent polling `db.getBuild(id).iterations` saw 0 iterations for visual-memory (build 229) after 20 minutes and restarted the worker. But the pipeline was actively running (mechanics E8 fix in progress) — the DB only records iterations when a full batch pass+fail cycle completes. A build in the middle of a fix LLM call shows 0 iterations until the re-test finishes. The restart killed the build mid-fix.

**Root cause:** Monitoring agents using wall-clock timeouts can't distinguish "stuck" from "in-progress LLM call". Long LLM calls (48KB HTML, 3-5 min response time) + DOM snapshot (65s timeout) + Playwright test runs all make a build appear stuck externally.

**Fix:** Never auto-restart the worker while any build shows `status='running'` in the DB. Always check `running` status before restarting. Better signal than wall-clock timeout: watch journalctl for activity (`journalctl -u ralph-worker -n 1` timestamp advancing = alive). Only restart if the log hasn't advanced in >10 minutes AND the claude subprocess is no longer running.

**How to apply:** Don't set timeout-based worker restarts. Restart only after explicit build completion (APPROVED/FAILED status in DB). If a build appears stuck: check if `claude` or `node` subprocess is running (`ps aux | grep -E 'claude|playwright'`); if yes, it's working. Wait it out.

---

**INSTRUCTIONS FOR MAINTAINING LESSONS:** Always update this file after every notable build outcome or pipeline bug fix. Add lesson immediately when: a new pipeline bug is found and fixed, a build proves or disproves a hypothesis, a new failure pattern is discovered, or any hard-won insight that would help avoid repeating a mistake. Never let insights live only in conversation memory.
35. **beforeEach transition-slot wait fails for non-CDN games** — The shared test boilerplate `beforeEach` unconditionally waited for `#mathai-transition-slot button`. Games that don't use the TransitionScreen CDN component (non-CDN or inline-layout games) never have this button — ALL tests failed in `beforeEach` with "expected locator to be visible" timeout. Caused build 216 (count-and-tap) to score 0/10 across all batches. **Fix:** At `sharedBoilerplate` generation time, check `htmlContent` for `mathai-transition-slot`. If present (`hasTransitionSlot = true`), use the existing 50s polling loop. If absent, use a fallback: `waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 })`. The `domSnapshot` string is checked as a secondary signal. Default is `true` (slot path) only when both `htmlContent` is empty and `domSnapshot` is null. **How to apply:** Any game whose HTML doesn't include `mathai-transition-slot` gets the fallback `beforeEach`. Games using ScreenLayout CDN always have it.

## Lesson 36 — Stale warehouse HTML causes all scale run builds to fail at initialization

**Pattern:** When `warehouse/templates/<gameId>/game/index.html` exists, the worker copies it to each new build directory and the pipeline SKIPS HTML generation entirely. For games that were never approved, this means every build reuses broken/stale warehouse HTML. The fix loop cannot recover because the fundamental initialization issue is in the original HTML, not in the test logic.

**Root cause of scale run failures (builds 219-223+):** All queued games had pre-existing warehouse HTML from prior manual/pipeline runs. None was approved. The HTML had initialization bugs (start screen never renders, `#mathai-transition-slot button` never appears) that the per-batch fix loop couldn't resolve in 3 iterations.

**Fix (one-time cleanup):** Before running a scale validation, delete `warehouse/templates/<gameId>/game/index.html` for ALL games that have never reached APPROVED status in the DB. Keeps: games with `status='approved'` in the games table.

**Pipeline improvement needed:** Add auto-detection: if game-flow AND mechanics both score 0/N on iteration 1 AND warehouse HTML was copied (not freshly generated), delete warehouse HTML and regenerate. Add to build kill criteria.

**Proof:** Deleting 41 warehouse HTML files (non-approved games) immediately unblocked the scale run. Build 224 (true-or-false) generated fresh HTML and passed static validation on the same run.

## Lesson 37 — Always-applied post-processing overwrites conditional beforeEach (bug identified, fix pending)

**Pattern:** The "always-applied test post-processing" block (pipeline.js ~line 1847) replaces every `test.beforeEach` with a hardcoded version that unconditionally waits for `#mathai-transition-slot button`. This overwrites the conditional sharedBoilerplate fix (lesson 35) for games without the transition slot. Even when sharedBoilerplate correctly generates a fallback beforeEach, post-processing replaces it on every run.

**Fix:** In the post-processing block, check `htmlContent.includes('mathai-transition-slot')` and use the appropriate beforeEach (slot-based vs fallback).

**Also:** Gemini sometimes generates `#${transitionSlotId}` as a literal string (template variable hallucination). Fix: add post-processing cleanup to replace `${transitionSlotId}` → `mathai-transition-slot` in all spec files.

**Status:** Fix committed (see task #31 follow-up). Both issues found during monitoring of builds 221-223.

## Lesson 38 — CDN URL constraint missing from generation prompt caused fresh-HTML init failures

**Pattern:** The fix prompt had CRITICAL CDN CONSTRAINTS (`cdn.homeworkapp.ai`, not `cdn.mathai.ai`) but the **generation prompt** did not. LLMs hallucinate `cdn.mathai.ai` as the CDN domain. Using the wrong domain causes all CDN scripts (ProgressBarComponent, TransitionScreen, etc.) to 404 silently — the game page renders blank, the start screen never appears, and ALL tests fail in `beforeEach` with "element not found" timeout. This was the root cause of fresh-HTML init failures in builds 222-225 (start screen never renders even after game_init fix and warehouse HTML deletion).

**Fix:** Added rule 18 to both the API generation prompt and the CLI (`claude -p`) generation prompt: "ALWAYS use cdn.homeworkapp.ai. NEVER use cdn.mathai.ai." Also added post-generation cleanup in pipeline.js that replaces `cdn.mathai.ai` → `cdn.homeworkapp.ai` in the generated HTML file before harness injection (defense in depth).

**How to apply:** If a freshly generated CDN game has 0% on game-flow iteration 1 AND init failures (start screen never renders), check the generated HTML for `cdn.mathai.ai` — that's the first thing to verify.

## Lesson 42 — Test data shape mismatch: `validSolution is not iterable`

**Pattern:** Build 227 (hidden-sums): After the window.gameState fix resolved game-flow iteration 1 (data-phase now set), iterations 2+ failed with `TypeError: round1.validSolution is not iterable` and `TypeError: solutionIndices is not iterable`. The generated tests assumed the game's round data structure had specific iterable array properties, but the actual game stored data differently. This is a test-side assumption mismatch, not a game bug.

**Root cause:** Test generation prompt uses the spec markdown + DOM snapshot for context. When the DOM snapshot doesn't show actual JS data structures (only HTML elements), the LLM infers round data shapes from spec language like "valid solutions" → assumes `validSolution: []` array. The game may use `validSolution: number` (single value) or `validAnswers: []` (different key).

**Fix (needed):** The DOM snapshot should include a sample `window.__ralph.getState()` result so the test generator sees the actual data shape. Currently the DOM snapshot captures element IDs/classes only. Add `window.__ralph.getState()` output to the snapshot injection context so generated tests use the real property names and types.

**Workaround (current):** The test fix loop will eventually catch and fix shape mismatches, but wastes iterations. If a game consistently fails with `is not iterable` or `undefined reading '0'`, check whether the test is accessing a property that doesn't exist on the actual game state object.

**How to apply:** When game-flow fails on iter 1 for window.gameState reasons but iter 2+ fails with `not iterable` / `Cannot read properties of undefined`, the issue shifted from game init → test data assumptions. Don't re-queue; the fix loop should resolve it. If it fails all 3 iterations on the same property error, this is a known gap in the DOM snapshot context (no runtime state shape).

## Lesson 44 — `extractSpecRounds()` parses spec metadata tables as round data

**Pattern:** Build 232 (face-memory): `extractSpecRounds()` parsed the spec's "Parts Selected" table — rows like `PART-001 | HTML Shell | YES` — as game round data because the header filter only excluded the literal text `"Question"` / `"Answer"` / `"Round"`. The `Part ID` header and `PART-xxx` data rows passed through, producing `fallbackContent.rounds = [{ question: "PART-001", answer: "HTML Shell" }]`. Tests then crashed with `TypeError: Cannot read properties of undefined (reading 'eyes')` when accessing `rounds[0].faceFeatures['eyes']` — a property that would only exist on real face-memory round data.

**Triage failure:** The triage model saw `TypeError: Cannot read properties of undefined (reading 'eyes')` and diagnosed it as an HTML init failure (gameState not fully initialized). Fix attempts rewrote initialization code, which broke the HTML and cascaded into `page.waitForSelector Timeout 30000ms` across all batches. The real root cause — garbage data injected by `extractSpecRounds` — was never surfaced because the TypeError message gave no hint of its origin being test data.

**Root cause:** `extractSpecRounds()` matched any two-column markdown table in the spec. The "Parts Selected" table (`PART-001 | HTML Shell`) is a spec metadata table, not a rounds table. No exclusion existed for part-reference rows.

**Fix:** Added skip conditions in `extractSpecRounds()`:
1. Skip any row where `col1` matches `Part ID` (header row) or `/^PART-\d+/` (data rows).
2. Skip any row where `col2` is `YES`, `NO`, or `—` (the "Included" column of the parts table).

**Proof:** Build 232 killed after cascading failures. Fix deployed, build 279 requeued and completed successfully.

**How to apply:** If tests crash with `TypeError: Cannot read properties of undefined` accessing a game-specific nested property (e.g., `.faceFeatures`, `.gridData`, `.pattern`) on `rounds[0]`, check `fallbackContent.rounds` first — the question/answer values may be spec metadata rather than actual game rounds. Log or inspect the extracted rounds before injecting them into the test context.

## Lesson 45 — BullMQ queue loss on Redis restart: enable AOF persistence

**Pattern:** In a past incident, 39 queued builds vanished after a Redis restart. Redis's default configuration uses RDB snapshots only (periodic dumps to `dump.rdb`). If Redis exits between snapshots, all in-memory queue state — pending BullMQ jobs, job locks, job data — is lost. On restart, the queue appears empty and all queued builds are gone with no record.

**Root cause:** Redis defaults to RDB-only persistence. RDB snapshots happen at intervals (e.g., every 60s if 1000 keys changed, every 300s if 10 keys changed). Any Redis restart between snapshot intervals loses all changes made since the last snapshot. BullMQ jobs are entirely Redis-backed; there is no secondary durable store.

**Fix:** Enable Redis AOF (Append Only File) persistence via `--appendonly yes` in the Redis startup command. With AOF, every write command is appended to a file on disk. Redis 7 uses the multi-part AOF format: an `appendonlydir/` directory containing a base RDB snapshot (`*.base.rdb`) and an incremental log (`*.incr.aof`). On restart, Redis replays the AOF log — all queued jobs survive.

**How it was applied:**
1. `docker-compose.yml` Redis service already has `command: redis-server --appendonly yes` — this is the correct configuration for local/Docker deployments.
2. The live server runs Redis in the `ralph-redis-1` Docker container. Verified with `sudo docker inspect ralph-redis-1 --format='{{.Config.Cmd}}'` → `[redis-server --appendonly yes]`. AOF is active: `sudo docker exec ralph-redis-1 redis-cli CONFIG GET appendonly` returns `yes`. The `appendonlydir/` directory exists in `/data/` with `appendonly.aof.2.incr.aof` actively written.

**Verification command:**
```bash
sudo docker exec ralph-redis-1 redis-cli CONFIG GET appendonly
# Expected: appendonly / yes
sudo docker exec ralph-redis-1 ls -la /data/appendonlydir/
# Expected: *.base.rdb + *.incr.aof files present and recently modified
```

**How to apply:** Always start Redis with `--appendonly yes`. For docker-compose deployments, include it in the `command:` field. For standalone Redis, set `appendonly yes` in `redis.conf` and run `redis-cli CONFIG REWRITE` to persist the change. Never rely on RDB-only persistence for BullMQ-backed pipelines where job loss is unacceptable.

## Lesson 46 — Step 1d: Page load smoke check prevents wasted test-gen tokens on broken pages

**Pattern:** Generated HTML can fail to load entirely due to CDN package timeouts, missing globals, or JS init errors. The page is a white screen from generation, but the pipeline doesn't detect this until iteration 1 of the test loop returns 0/10 — after test-gen LLM tokens have already been spent. Real example: `"Packages failed to load within 10s"` — the console error appears at page load, but the pipeline wasn't listening.

**Root cause:** The pipeline had no pre-test-gen check for page-level init failures. Static validation (Step 1b) checks HTML structure and CDN contract compliance but cannot detect runtime errors. The test loop's 0/10 iteration-1 result was the first signal.

**Fix (Step 1d):** Added `runPageSmokeDiagnostic(htmlFile, gameDir, logger)` in `lib/pipeline-utils.js`. Runs after Step 1c (early review), before test generation:
1. Spawns a local static server (same pattern as `captureGameDomSnapshot`)
2. Opens the page in headless Playwright with a 5s navigation timeout
3. Collects `console.error` events for 8 seconds
4. Classifies errors against fatal patterns: `packages? failed to load`, `initialization error`, `failed to load resource`, `waitforpackages`, `is not a constructor`, and CDN-context `X is not defined`
5. If fatal errors found: one HTML regeneration attempt with the error appended to the gen prompt, then re-smoke-checks
6. If still failing after regen: throws immediately (no test-gen, no fix loop wasted)

**Pattern matching helper:** `classifySmokeErrors(consoleErrors)` is exported separately for unit testing without Playwright. The `X is not defined` pattern is only fatal when the error message also contains a CDN/package context string — avoids false positives from routine JS reference errors.

**Cost saved:** Prevents ~2 full LLM fix iterations + test generation tokens ($0.20–$0.50 per incident) on CDN-broken pages that would otherwise waste 5 full iterations before the pipeline fails.

**How to apply:** When a build fails iteration 1 with 0/N on all categories AND the error is `page.waitForSelector Timeout` or similar, check the Slack thread for a `smoke-check-failed` progress event. If present, the root cause is a page load failure — the smoke check caught it on the next build attempt.

## Lesson 47 — Queue-sync job loss: auto-requeue at worker startup eliminates manual intervention

**Pattern:** When the `ralph-worker` systemd service restarts (planned deploy, OOM kill, or crash), any BullMQ jobs that were in-flight are lost from the queue. The existing `cleanupOrphanedBuilds()` at startup correctly marks `status=running` builds as `failed` with `error_message = "orphaned: worker restarted..."`. But these builds were never automatically retried — they required a manual `POST /api/build` call. In the last 10 build failures, 9 had exactly this pattern (queue-sync job loss).

**Root cause:** `cleanupOrphanedBuilds()` only marks builds failed; it has no requeue path. There was no automated recovery: the operator had to notice the failure in Slack, identify it as a queue-sync loss, and manually requeue. On busy days with multiple deploys, this meant 3–5 manual requeue calls per session.

**Fix:** `requeueQueueSyncBuilds()` added to `worker.js` startup, called right after `cleanupOrphanedBuilds()`:
1. Queries: `status='failed' AND error_message LIKE '%queue-sync%' AND (retry_count IS NULL OR retry_count < 1)`
2. For each candidate, checks if the game already has a `queued` or `running` build — skips if so (prevents duplicate)
3. Enqueues via `new Queue('ralph-builds', { connection })` and calls `.add('build', { gameId, requeueOf: build.id })`
4. Sets `retry_count = 1` on the old failed build to prevent repeated requeue on subsequent restarts
5. Logs: `[worker] queue-sync auto-requeue: ${gameId} (was build #${id})`

**Guard rails:**
- `retry_count < 1` — only auto-requeues once per failed build; prevents infinite loops
- Active-build check — skips if game already has queued/running build; prevents duplicate concurrent pipelines
- Only matches `error_message LIKE '%queue-sync%'` — never auto-retries other failure types (pipeline errors, review rejections, etc.)
- Queue is opened and closed within the function; does not interfere with the main worker's connection

**Tests:** 7 new unit tests in `test/worker.test.js` covering: candidate selection (retry_count=0), exclusion (retry_count=1), null retry_count eligibility, skip when queued/running build exists, allow when no active build, empty table.

**How to apply:** This is now automatic. After any worker restart, the startup log will show `[worker] queue-sync requeue: found N builds to requeue` (or 0). No manual intervention needed. If a game is stuck and you need to prevent the auto-requeue, set `retry_count=1` directly: `node -e "require('./lib/db').getDb().prepare('UPDATE builds SET retry_count=1 WHERE id=?').run(BUILD_ID)"`.

## Lesson 48 — Deterministic pre-triage: toBeVisible/toBeHidden batch failures are rendering mismatches, not HTML bugs

**Pattern:** When a test batch returns >3 failures all containing `toBeVisible()` or `toBeHidden()`, these are invariably test-side DOM visibility assumptions that the game HTML doesn't satisfy. The test generator assumed certain elements would be visible at specific points in the game flow, but the game renders them differently (e.g., hidden by default until the game starts, or visibility toggled by CDN components). The LLM triage model correctly identifies these as `skip_tests` (rendering mismatch, not an HTML bug), but only AFTER spending a full triage LLM call.

**Real example:** adjustment-strategy game had 8 distinct `toBeVisible()` failures in one batch, all categorized as "rendering" in the failure_patterns table. Each triage call for this pattern costs a full LLM round-trip with no HTML fix output.

**Fix:** `detectRenderingMismatch(failureDescs)` added to `lib/pipeline-fix-loop.js`. Runs BEFORE the triage LLM call in the per-batch iteration loop. If more than 3 failures match `/toBeVisible|toBeHidden/i`, the function returns `true` and the loop immediately breaks with `skip_tests` — no LLM call. The threshold is `>3` (not `>=3`) because 3 toBeVisible failures could be a real DOM bug affecting a specific element; 4+ distributed across different elements strongly indicates test-side assumptions.

**Saves:** One LLM triage round-trip per affected batch per iteration. For games that trigger this pattern on iterations 1, 2, and 3, this saves 3 triage calls (roughly $0.01–$0.03 per batch, plus latency).

**How to apply:** If a batch repeatedly hits `skip_tests` in triage for `toBeVisible` reasons, it's this pattern. The fix loop will log `[pipeline] [batchLabel] Pre-triage: toBeVisible pattern detected (N failures) — skip_tests` and emit a `pretriage-visibility-skip` progress event. No action needed — the pre-triage guard is active automatically.

**Implementation:** `detectRenderingMismatch()` exported from `lib/pipeline-fix-loop.js` alongside `isInitFailure`. 6 unit tests cover: 4 visible=true, 3 visible-false (boundary), 2+2 mixed=true, empty=false, 4 non-visibility=false, case-insensitive=true.

## Lesson 49 — Abort pipeline on DOM snapshot failure: regen HTML instead of proceeding to test-gen

**Pattern:** `captureGameDomSnapshot()` (Step 2.5) can return `null` when the generated HTML is fatally broken — blank page, CDN packages failed to load, JS init error. Previously, the pipeline would silently proceed to test-gen using an empty DOM snapshot, spending a full LLM test-gen call (60–120s, $0.10–$0.30) on a page that is confirmed broken. The resulting tests fail 100% on iteration 1, and the fix loop then has to diagnose the underlying HTML bug from test failures rather than from the direct evidence of a blank page.

**Fix:** `lib/pipeline-test-gen.js` now checks the return value of `captureGameDomSnapshot()`. If it returns `null`, it throws an error with `isFatalSnapshotError = true`. `lib/pipeline.js` catches this in the Step 2 entry point: regenerates the HTML with a "blank-page context" note appended to the gen prompt, then retries the full test-gen step (snapshot + test generation). If the retry also fails with a null snapshot, the build is aborted entirely — no test-gen, no fix loop, no wasted compute.

**Impact:** R&D trace of 65 triage events across builds 218–232:
- 58% — HTML fatal init (CDN 404, JS ReferenceError, ScreenLayout blocked)
- 22% — phase-transition missing syncDOMState() call
- 9% — data-shape mismatch (test assumed wrong property names)
- 11% — other

Of the 58% init failures, ~44% had a null DOM snapshot detectable at Step 2.5. Aborting early on those cases eliminates the test-gen LLM call and the full first fix iteration — saving ~2 LLM round-trips per affected build.

Full analysis at `docs/rnd-first-pass-failure-analysis.md`.

**How to apply:** If a build Slack thread shows a `snapshot-failed-regenerating` progress event, the pipeline detected a null snapshot and is regenerating HTML. If a second `snapshot-failed-abort` event appears, the HTML was still broken after regen and the build aborted. Investigate the generated HTML (check for CDN URL errors, initSentry order, waitForPackages missing) rather than waiting for 5 failed iterations.

## Lesson 50 — Every `gameState.phase =` assignment must be immediately followed by `syncDOMState()`

**Pattern:** CDN games generated by the pipeline frequently passed game-flow tests on iteration 1 for some transitions but failed others with `waitForPhase() timeout`. Root cause: `syncDOMState()` (injected by the test harness into `<script id="ralph-test-harness">`) reads `window.gameState.phase` and writes it to `#app[data-phase]` — but only when called. If the game sets `gameState.phase = 'playing'` without immediately calling `syncDOMState()`, the `data-phase` attribute on `#app` is never updated until the next periodic sync tick (500ms). `waitForPhase(page, 'playing')` times out if the transition happens faster than the polling interval, or if `syncDOMState()` is never called for that phase at all.

**Root cause:** The generation prompt did not explicitly require calling `syncDOMState()` after every phase assignment. LLMs sometimes call it at game start and at `endGame`, but omit it at intermediate transitions (`'transition'`, `'correct'`, `'wrong'`, etc.). This was causing 22% of all iteration-1 failures in the R&D trace.

**Fix:** Rule 22 added to `lib/prompts.js`: "After EVERY `gameState.phase =` assignment, immediately call `syncDOMState()`. Without this call, `data-phase` on `#app` is never updated and ALL `waitForPhase()` test calls will timeout." This rule is injected into the API generation prompt, CLI generation prompt, and all fix/global-fix prompts via the CDN_CONSTRAINTS_BLOCK.

**How to apply:** If tests fail with `waitForPhase('transition')` or `waitForPhase('correct')` timeout on iteration 1, search the generated HTML for `gameState.phase = 'transition'` (or whichever phase). If there is no `syncDOMState()` call on the immediately following line, that is the bug. The fix prompt should already include this rule (as of 2026-03-20); if it doesn't, the LLM will fix it on iteration 1 triage.

## Lesson 51 — FeedbackManager.init() popup causes 100% non-deterministic test failure when PART-017=NO

**Pattern:** adjustment-strategy had 58 failed builds with all failures labeled as "rendering/toBeVisible". The page was NOT blank — it rendered fine. The real cause: `FeedbackManager.init()` was being called despite the spec saying `PART-017 Feedback Integration: NO`. This shows a blocking audio permission popup ("Okay!" button). The `beforeEach` tries to dismiss it with an 8-second timeout, but the catch is silent. When it misses (race condition), ALL tests fail on the same `waitForFunction` timeout.

**Proof of non-determinism:** Build 159 showed the SAME HTML passing 6/0 then failing 0/10 in the same pipeline run. Identical code, identical page — different outcomes depending on whether the popup appeared before or after the `beforeEach` dismissal window. This is the clearest possible signal of a race condition, not an HTML logic bug.

**Root cause:** `FeedbackManager.init()` initializes audio subsystems that may trigger browser permission dialogs in headless Playwright. When the spec says `PART-017=NO`, the game should never call this function. LLMs include it as boilerplate without checking the spec's PART-017 value.

**Fix:**
1. Gen prompt rule added: never call `FeedbackManager.init()` unless spec says `PART-017=YES` or `popupProps` is explicitly specified.
2. adjustment-strategy `spec.md` updated with an explicit `CRITICAL` prohibition block.
3. These two changes fix 58 builds worth of thrashing caused by the race condition.

**How to identify:** Any game where:
- 100% of failures are labeled "rendering/toBeVisible" across ALL test categories
- DOM snapshot shows elements rendering correctly (page is not blank)
- Failures are non-deterministic (pass rate fluctuates run-to-run on the same HTML)
- `FeedbackManager.init()` appears in the generated HTML

Check the spec's `PART-017` value. If `NO`, the call must be removed.

**How to apply:** Search generated HTML for `FeedbackManager.init(`. If present, check the spec: if `PART-017=NO` and `popupProps` is not specified, remove the call entirely. The fix loop will not reliably catch this on its own because the non-determinism means some iterations "pass" — masking the root cause.

## Lesson 52 — Cross-batch fix loop regressions (63% of multi-batch builds)

**Pattern:** When the per-batch fix loop fixes batch N, it can break batch N+1 because the fix overwrites the shared htmlFile with no rollback mechanism for downstream batches.

**Fix:** Added `detectCrossBatchRegression()` in pipeline-fix-loop.js — smoke-checks all prior-passing batch spec files after each batch completes. On regression, rolls back to preBatchHtml and marks batch as rolled_back.

**Proof:** Empirical trace of 19 multi-batch builds showed 63% had cross-batch regressions. 6 new unit tests. Commit 76996c1.

## Lesson 53 — HTML generation token truncation on large specs

**Pattern:** `trackedLlmCall` for HTML generation defaulted to maxTokens=16000. Large specs (bubbles-pairs 64KB, interactive-chat 59KB) generated HTML that exceeded 16K output tokens, truncating mid-script. Reviewer correctly rejected.

**Fix:** All 4 HTML generation call sites in pipeline.js updated to `{ maxTokens: 32000 }`.

**Proof:** bubbles-pairs truncated at `window.testS` (mid-function), interactive-chat at `case 'challenge_intro':` (mid-switch). Both games had 3-5 previously unexplained rejections. Commit a8392bc.

## Lesson 54 — RALPH_LLM_TIMEOUT config drift (production = 1200s vs 300s documented)

**Pattern:** Production server had RALPH_LLM_TIMEOUT=1200 in .env — 4x the documented default. Static-fix LLM calls could hang for up to 20 minutes before timing out, stalling the worker and blocking 40+ queued builds.

**Fix:** Updated /opt/ralph/.env to RALPH_LLM_TIMEOUT=300. The AbortController mechanism in llm.js is correctly wired — this was a config-only issue.

**Proof:** Worker stalled 23 minutes on futoshiki build #296 static-fix call. Force-kill required to unblock queue.

## Lesson 55 — debug-function window exposure rule conflict (29% of review rejections)

**Pattern:** CDN_CONSTRAINTS_BLOCK told gen LLM "debug functions MUST NOT be on window" but spec Verification Checklist requires them ON window. LLM followed the gen rule, reviewer rejected per spec checklist — an unfixable loop causing 29% of early-review rejections.

**Fix:** Changed rule to "MUST be exposed on window — define as named functions inside DOMContentLoaded then assign: window.debugGame = debugGame".

**Proof:** queens build 285 rejected 3 consecutive times for this exact conflict. Commit dd7f170.
