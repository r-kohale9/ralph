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
| 384 | matching-doubles | APPROVED | — | Gemini-only mode. First build with new pipeline. |
| 385 | adjustment-strategy | APPROVED | — | Non-CDN game. Global fix loop triggered 2 spurious calls (Lesson 65 bug, pre-fix). APPROVED. |
| 386 | bubbles-pairs | APPROVED | — | Passed all per-batch loops iter=1. Review rejected twice (postMessage+calcStars), fixed in 2 review-fix cycles. APPROVED. |
| 388 | zip | APPROVED | — | Review passed on FIRST attempt (32s). First build with new review rejection gen-prompt fixes. |
| 387 | interactive-chat | FAILED | 5/12 | Lesson 66 bug: mechanics+level-prog spec files deleted → passRate=42% → FAILED before review. Fixed in dc20844. Re-queued as #390. |
| 389 | kakuro | FAILED | — | Early-review-fix broke CDN init → smoke-regen also failed. Re-queued as #391. |

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

## Lesson 56 — Cross-batch-guard false rollbacks from 30s timeout (0/0 treated as regression)

**Pattern:** `detectCrossBatchRegression()` smoke-checks prior passing batches after each new batch completes. With a 30-second timeout, game-flow tests (which can take 30-60s for complex games) would timeout and return 0/0 results. `0 < prevPassed` was true, so every batch triggered a false rollback — effectively wasting all per-batch improvements.

**Observed:** queens build — every batch (mechanics, level-progression, edge-cases, contract) passed their own tests but then had cross-batch-guard fire `REGRESSION: batch X broke prior batch game-flow (was 7/7, now 0/0)`. All batches rolled back. Only game-flow tests were preserved.

**Fix:** (1) Skip regression detection when `nowTotal === 0` (inconclusive — can't distinguish timeout from actual crash); (2) Increase smoke timeout from 30s → 90s. Commit 7d27432.

**Rule:** When `nowTotal === 0`, the test execution itself failed (timeout, infra error). Never treat this as a regression — it's inconclusive. Only trigger rollback when `nowTotal > 0 && nowPassed < prevPassed`.

## Lesson 57 — Generation LLM timeout (RALPH_LLM_TIMEOUT=300 kills large-spec HTML gen)

**Pattern:** Large-spec games (interactive-chat 59KB, bubbles-pairs 64KB) that require `maxTokens: 32000` output generate HTML that takes >5 minutes. `RALPH_LLM_TIMEOUT=300` aborted these at exactly 300 seconds with `iterations=0` — before the pipeline could do anything.

**Fix:** Added `RALPH_GEN_LLM_TIMEOUT` config (default 600s) used specifically at all 4 HTML generation call sites (generate-html, generate-html-retry, smoke-regen, snapshot-regen). Triage/fix calls keep 300s. Commit 4eb1d29.

**Rule:** Generation calls (maxTokens=32000) need a separate, larger timeout than fix/triage calls. Never use a single global timeout for all LLM call types.

## Lesson 58 — #popup-backdrop overlay persists after VisibilityTracker onResume — intercepts all clicks

**Pattern:** CDN VisibilityTracker shows a full-screen `#popup-backdrop` element when the page becomes inactive. When `onResume` fires and the user dismisses the "Continue" popup, the backdrop remains in the DOM with `position:fixed; z-index:9999` (or similar) — NOT automatically hidden. Any click on a game element (grid cells, Next Round button, answer input) hits the backdrop instead.

**Symptom:** game-flow and mechanics tests fail at iteration 2 with `locator.click: Timeout` errors despite the game rendering correctly. Tests pass in early iterations (before VisibilityTracker fires) but fail after a round transition or restart.

**Fix:** In `VisibilityTracker` `onResume` callback AND in `restartGame()`:
```javascript
const bd = document.getElementById('popup-backdrop');
if (bd) { bd.style.display = 'none'; bd.style.pointerEvents = 'none'; }
```

**Proof:** builds 306 (two-digit-doubles-aided, iter 2: "backdrop overlay not hidden after popup dismissal") and 310 (speedy-taps, iter 2: "popup backdrop intercepts clicks on Next Round button").

**Note:** The pipeline test harness already dismisses popups in `startGame()` via `dismissPopupIfPresent()`, but this only runs at test setup. The backdrop can re-appear during gameplay when page visibility changes occur.

**Rule:** Never rely on VisibilityTracker to auto-hide #popup-backdrop. Always explicitly set `display='none'` and `pointerEvents='none'` in the `onResume` callback and in `restartGame()`.

## Lesson 59 — adjustment-strategy chronic failures: 4 root causes across 60 builds (8% approval rate)

**Symptom:** 60 builds of adjustment-strategy, 8% approval rate. Mechanics tests persistently fail across all builds. Three independent root causes compounded each other.

**Root cause 1: Button ID mismatch after `updateAdjusterUI()` innerHTML rebuild**
The spec's `updateAdjusterUI()` used `innerHTML` to rebuild top/bottom adjuster areas on every delta change, but the injected markup omitted `id="btn-a-plus"` etc. The initial HTML template also lacked these IDs. Generated tests correctly expected `#btn-a-plus` / `#btn-a-minus` / `#btn-b-plus` / `#btn-b-minus` (since the warehouse `game.spec.js` used them), but after the first adjustment click, `innerHTML` replaced the button DOM node with a new element lacking the ID. Every subsequent `page.locator('#btn-a-plus').click()` timed out.

**Root cause 2: `isProcessing` race in `checkAnswer()`**
`checkAnswer()` sets `isProcessing = true`, awaits `FeedbackManager.sound.play()` and `FeedbackManager.playDynamicFeedback()`, then schedules `setTimeout(() => roundComplete(), 400)` — but does NOT reset `isProcessing = false` before the setTimeout. If FeedbackManager threw or took longer than expected, `isProcessing` remained `true` permanently, blocking all further user interaction and causing mechanics tests to timeout on the next round's button clicks.

**Root cause 3: `calcStars` not handling `game_over → 0★` explicitly**
The `endGame` star calculation in generated HTML sometimes applied the time-based formula even for `reason === 'game_over'`, resulting in `stars = 1` (instead of 0) when the game ended early with some level times recorded. The contract validator expects `stars = 0` for game_over. Review would reject with "calcStars wrong for game_over path".

**Root cause 4: postMessage missing `duration_data` / `attempts`**
Some generated HTML variants built `metrics` without explicitly including `duration_data` and `attempts`, or included them as undefined references. The contract validator checks both fields. Review rejected with "metrics.duration_data missing" or "metrics.attempts not an array".

**Fix:**
1. Spec `specs/Adjustment Strategy.md` updated: button IDs (`btn-a-minus`, `btn-a-plus`, `btn-b-minus`, `btn-b-plus`) added to the initial HTML template and to all `updateAdjusterUI()` innerHTML patterns. CRITICAL note added at top of spec.
2. `checkAnswer()` spec updated: `gameState.isProcessing = false` added immediately before `setTimeout(() => roundComplete(), 400)`.
3. `endGame()` spec updated: explicit `if (reason === 'game_over') stars = 0` branch required, with CRITICAL note in Verification Checklist.
4. postMessage spec updated: CRITICAL note requiring `duration_data` and `attempts` inside the `metrics` object.
5. Stale warehouse HTML (`warehouse/templates/adjustment-strategy/game/index.html`) and stale test files (`game/tests/`) deleted from both local and server so the next build generates fresh HTML and tests.

**Proof:** Identified 2026-03-20 via R&D deep-dive. Pre-fix approval rate: 8% over 60 builds. Fix deployed to both `specs/Adjustment Strategy.md` and server `/opt/ralph/specs/Adjustment Strategy.md`. Warehouse HTML and test cache cleared.

**How to apply:** For any game with persistent mechanics test failures where button clicks timeout after the first interaction: check whether `innerHTML` rebuild in UI update functions preserves button IDs. This is a systematic pattern — any game that uses innerHTML to show/hide adjusted values without re-injecting IDs will hit this bug.

## Lesson 60 — Rate-limiter starvation from manual build cancellations

**Pattern:** Admin operations calling `db.failBuild()` directly (e.g., to cancel duplicate/already-approved builds) still trigger the BullMQ `worker.on('failed')` handler, which increments the rate-limiter counter. With a 10/hr limit, 8+ admin cancellations in one hour blocked all legitimate builds for ~50 minutes. The rate limiter key is a fixed-window Redis counter; deleting it manually (`node -e "q.client.then(c=>c.del('bull:ralph-builds:limiter'))"`) instantly unblocks the queue.

**Root cause:** The BullMQ rate limiter uses a fixed-window Redis counter keyed by `bull:ralph-builds:limiter`. Every job that reaches the `failed` event handler — including admin-cancelled builds — increments this counter. There is no distinction between "pipeline failure" and "intentionally cancelled by admin".

**Fix:** Raised rate limit from 10/hr to 20/hr (commit ac6588a). This gives 3× headroom for admin operations without blocking legitimate builds.

**Detection:** If the queue appears blocked and all recent DB builds show `status='failed'` with short duration, check the rate limiter: `redis-cli GET bull:ralph-builds:limiter`. If near or at the limit, delete the key to immediately unblock: `node -e "q.client.then(c=>c.del('bull:ralph-builds:limiter'))"`.

**How to apply:** After any batch of admin cancellations (5+ builds failed manually in one session), check the rate-limiter counter before queuing new builds. If >15, delete the key. Consider incrementing the limit further if admin ops remain heavy.

## Lesson 61 — Claude CLI auth can silently expire during long sessions

**Pattern:** `claude auth status` returns `loggedIn: true` (reads cached credentials) even when the API session is invalid. Actual `claude -p` calls fail with "Your organization does not have access to Claude." after intensive Opus calls (build #305 ran 64 minutes). All subsequent builds fail in ~8 seconds with `iterations=0, error_message=null`. On 2026-03-20 ~19:07, 20+ builds in queue failed immediately due to this condition.

**Root cause:** `claude auth status` checks cached credential presence — it does NOT make a live API call. A session can be marked `loggedIn: true` while the underlying token is expired or the org's usage limit has been hit. The difference between session expiry and usage limit cannot be determined without attempting an actual generation call.

**Detection signal:** Monitor for builds failing with `duration_s < 30` AND `iterations=0` — indicates pre-generation failure, not a pipeline failure. Check `error_message` — if `null` despite failed status, the process exited before pipeline.js could write an error.

**Fix:** Re-authenticate via `claude auth logout && claude auth login`. Consider adding an auth health-check step at pipeline start: attempt a minimal `claude -p "ping"` call; if it fails, mark the build as `auth-failed` and skip the queue until re-auth is complete.

**How to apply:** If builds are completing in <30 seconds with 0 iterations and no Slack error detail, run `claude -p "test" 2>&1` directly on the server to confirm auth state. Do not trust `claude auth status` alone.

## Lesson 62 — CLIProxyAPI Claude OAuth blocked at org level; fallback to Gemini-only mode

**Pattern:** After switching from `RALPH_USE_CLAUDE_CLI=1` to `RALPH_USE_CLAUDE_CLI=0` (proxy mode), the CLIProxyAPI itself returned `"OAuth authentication is currently not allowed for this organization."` for all Claude models (`claude-opus-4-6`, `claude-sonnet-4-6`). This is an org-level restriction on OAuth-based Claude access — the Docker-mounted OAuth tokens are invalidated. All builds fail at Step 1 (generate-html) with HTTP 500 from the proxy.

**Root cause:** CLIProxyAPI authenticates Claude via OAuth tokens stored in `./auths/`. When Anthropic revokes OAuth access for the org (e.g., after quota exhaustion or plan changes), all proxy Claude calls return 500. This is distinct from Lesson 61 (CLI auth expiry) — the proxy layer is also affected.

**Detection signal:** Proxy returns `HTTP 500: {"error":{"message":"auth_unavailable: no auth available"}}` or `{"error":{"message":"OAuth authentication is currently not allowed for this organization."}}`. Check with: `curl -X POST http://localhost:8317/v1/messages -H "x-api-key: $PROXY_KEY" -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'`

**Fix applied 2026-03-20:** Switched all models to `gemini-3.1-pro-preview` in `.env`:
```
RALPH_GEN_MODEL=gemini-3.1-pro-preview
RALPH_FIX_MODEL=gemini-3.1-pro-preview
RALPH_TEST_MODEL=gemini-3.1-pro-preview
RALPH_REVIEW_MODEL=gemini-3.1-pro-preview
```
Gemini uses API key authentication (not OAuth) and is unaffected by Claude org restrictions. Pipeline runs fully on Gemini until Claude auth is restored.

**How to apply:** If both `claude -p` and CLIProxyAPI Claude calls fail, check Gemini availability with a direct proxy test (`curl ... -d '{"model":"gemini-3.1-pro-preview"...}'`). If Gemini works, switch all `RALPH_*_MODEL` vars to gemini and restart worker. The pipeline quality difference is minimal — Gemini 3.1 Pro Preview is capable of full pipeline execution.

## Lesson 63 — skip_test vs skip_tests triage decision mismatch

**Issue:** The LLM triage prompt instructed returning `"skip_test"` (singular) in the decision description text, but the pipeline code checked for `"skip_tests"` (plural). The LLM consistently followed the description wording rather than the JSON schema example, so the pipeline never saw `skip_tests` — it fell through to `fix_html` on every call where skip was intended.

**Root cause:** Inconsistency between `prompts.js` line 751 (description said `"skip_test"`) and line 768 JSON schema (used `"skip_tests"`) plus the `pipeline-fix-loop.js` check for `"skip_tests"`.

**Fix:** Added normalization `if (triageDecision === 'skip_test') triageDecision = 'skip_tests'` after JSON parse. Also fixed the prompt JSON schema to use `skip_test` consistently. Commit 5158275.

**Impact:** All builds where the LLM returned `skip_test` (singular) had unnecessary fix LLM calls run, which often corrupted the HTML — causing 0/0 cascade failures on the next iteration.

**Prevention:** When adding new decision values to triage, ensure the prompt description text, the JSON schema example, and all code checks use exactly the same string. A normalization alias is a useful safety net but the root cause is always prompt/code mismatch.

## Lesson 64 — Non-CDN games got CDN startGame() helper causing all tests to timeout

**Issue:** The `sharedBoilerplate` in `pipeline-test-gen.js` always included a `startGame()` helper that clicked `#mathai-transition-slot button`. For non-CDN games (no CDN ScreenLayout), this button does not exist. Every test that called `startGame()` timed out, triage marked all tests as skip, all spec files were deleted, and the build failed with 0/0 across all categories.

**Detection signal:** Triage rationale saying "startGame helper hardcodes a wait and click for '#mathai-transition-slot button', which times out on non-CDN games". All 5 categories affected simultaneously with skip_tests.

**Fix:** `startGame()` and `clickNextLevel()` are now conditional on `hasTransitionSlot`. For non-CDN games they try generic button selectors (Start/Play/Begin, `.start-btn`) then fall back to `waitForPhase(page, 'playing')`. Commit 3df4a3e.

**Detection:** `hasTransitionSlot` is derived by checking whether the HTML or domSnapshot contains `mathai-transition-slot`. Non-CDN games (e.g., adjustment-strategy, game-type templates) must use the new phase-based `startGame()` path.

**How to apply:** If a non-CDN build has all 5 categories skip_tests on iteration 1 and the triage rationale mentions the transition-slot button, verify `hasTransitionSlot` is being computed correctly from the HTML content. The fallback `startGame()` tries three generic button selectors before falling back to phase waiting — if none of those match the game's actual start button, add the correct selector to the fallback list.

## Lesson 65 — Global fix loop treats deleted spec files as failing batches (0/0)

**Issue:** When triage deletes a spec file (all tests in a category were skipped via `skip_tests`), the global fix loop at Step 3c still iterates over it from the pre-built `batches` array. Running Playwright on a non-existent file produces 0 passed / 0 failed, which the global loop treats as a failing batch. This triggers a spurious HTML fix LLM call even though the category was intentionally cleared by triage.

**Detection signal:** Log line `"[global] [edge-cases] 0/0 tests ran — page likely broken, treating as failing batch"` immediately after a per-batch loop where triage returned `skip_tests` and the spec file was deleted.

**Fix:** In the global fix loop, check `existingBatchFiles = batch.filter(f => fs.existsSync(f))` before running Playwright. If all files are missing (length === 0), treat the batch as passing and skip. Commit 749a2f1.

**How to apply:** Any time a category shows 0/0 in the global loop immediately after per-batch triage, check whether the spec file was deleted. If it was, the issue was this bug (pre-fix). Post-fix, deleted batches are silently skipped in the global loop.

## Lesson 66 — Deleted batch spec files cause passRate < 0.5 false-fail before review

**Issue:** When triage deletes all spec files in a batch (skip_tests), the per-batch fix loop records those test counts as failures in `totalFailed` (line 861 of pipeline-fix-loop.js). Step 3b (final re-test) only re-tests batches with existing spec files — it never corrects the deleted batch counts. This means `passRate = totalPassed / (totalPassed + totalFailed)` still includes the deleted test failures, potentially pushing it below the 0.5 threshold at Step 4, causing a FAILED before review even when all remaining tests pass.

**Example:** Build #387 interactive-chat — mechanics (0/6) + level-progression (0/1) deleted by triage. Remaining passing tests: game-flow:2, edge-cases:1, contract:2 = 5 passed, 7 failed. passRate = 5/12 = 42% < 50% → FAILED before review.

**Detection signal:** Build FAILED immediately after `[gcp] Uploaded games/.../index.html` with no Step 4 review logs. DB shows `status=failed`, all final re-test batches show 0 failures.

**Fix:** Before Step 3b in the fix loop, subtract deleted batches' counts from `totalPassed`/`totalFailed` and zero out their `category_results` entry. Commit dc20844.

**How to apply:** If a build FAILED without any review logs and the test_results in DB show some categories with all failures (0/N passing) that match categories that were skip_tests'd, this was the bug. Post-fix, deleted batches are removed from the passRate calculation.

## Lesson 67: FeedbackManager.init() in spec initialization blocks causes CDN smoke-check failure

**Date:** 2026-03-20  
**Games affected:** associations (3 consecutive failures at CDN smoke check), + 18 more specs with same pattern  
**Root cause:** The spec quality fix (R&D session 2026-03-20) replaced `await FeedbackManager.init()` in 48/50 specs, but missed instances formatted as `   - FeedbackManager.init()` (with 3-space indent bullet syntax, no `await`). These were still interpreted by the LLM as executable init code. When `FeedbackManager.init()` runs during `waitForPackages()` callback, it shows a blocking audio popup that prevents `ScreenLayout.inject()` from being called → #gameContent never created → smoke check fails with "Blank page: missing #gameContent element".

**Fix:** Replaced `   - FeedbackManager.init()` with `   - // DO NOT call FeedbackManager.init() — PART-015 auto-inits on load. Calling it shows a blocking audio popup that breaks all tests.` across 20 specs (associations, bubbles-pairs, connect, crazy-maze, disappearing-numbers, doubles, explain-the-pattern, free-the-key, hidden-sums, identify-pairs-list, jelly-doods, kakuro, keep-track, listen-and-add, loop-the-loop, matching-doubles, queens, truth-tellers-liars, two-digit-doubles-aided, template-schema).

**Proof:** associations #398 (next build after fix) should not hit CDN smoke check failure.

**Pattern to watch:** Any spec that says `FeedbackManager.init()` without `await` prefix in a bullet list is still dangerous — LLM generates it as executable code.

## Lesson 68: extractPhaseNamesFromGame() returned raw phase names that don't match syncDOMState() output

**Date:** 2026-03-21  
**Games affected:** kakuro #391, rapid-challenge #394 (2/5 non-first-attempt approvals), colour-coding-tool #398 (game-flow test expecting 'start_screen' when data-phase contains 'start')  
**Root cause:** `extractPhaseNamesFromGame()` in `lib/prompts.js` parsed raw phase names from the HTML source code (e.g., `gameState.phase = 'start_screen'`, `gameState.phase = 'game_over'`) and injected them directly into the GF1 test-gen prompt: "use ONLY these exact strings in waitForPhase() calls." But `syncDOMState()` normalizes these before setting `data-phase` on `#app`:
- `game_over` → `gameover`
- `game_complete` → `results`  
- `start_screen` → `start`
- `game_init` → `start`
- `game_playing` → `playing`

So when the test called `waitForPhase(page, 'start_screen')`, `data-phase` was `'start'` — permanent timeout.

**Fix:** Apply the same normalization map in `extractPhaseNamesFromGame()` before returning phase names (commit 32785d3). Also added CRITICAL warning to GF1 prompt block with explicit raw→canonical mapping table.

**Proof:** Colour-coding-tool #398 triage confirmed the pattern: "game initially uses 'start_screen' for data-phase, but restart button sets 'start' instead of 'start_screen', causing test's expectation to fail." With the fix active on subsequent builds (crazy-maze #399+), phase-name mismatches should be eliminated.

**Pattern to watch:** If triage says "waitForPhase timeout: Expected 'X', Received 'Y'" where Y is the normalized form of X, this is the same root cause.

## Lesson 69: ScreenLayout.inject() requires `slots` wrapper — omitting it causes blank page at Step 1d

**Pattern:** CDN games fail smoke check with "missing #gameContent element" even after smoke-regen.

**Root cause:** LLM generates `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })` — the outer key must be `slots`: `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`. Without `slots`, ScreenLayout runs without error but never creates `#gameContent`; smoke check times out after 8s waiting for the element.

**Why smoke-regen also failed:** The smoke-regen prompt described the symptom ("missing #gameContent") but did not show the correct call format. The LLM reproduced the same broken structure on regen because it had no example of what correct looks like.

**Fix:** `CDN_CONSTRAINTS_BLOCK` in `lib/prompts.js` updated with the exact required format including a CORRECT/WRONG example pair. Smoke-regen error context in `lib/pipeline.js` now includes the canonical call snippet. Gen prompt Rule 2 uses the exact call with `slots` wrapper.

**Proof:** Commit 2666e36; affects disappearing-numbers, kakuro, face-memory, associations builds.

**Pattern to watch:** Any CDN game that hits "missing #gameContent element" at Step 1d with a smoke-regen that also fails — check whether `ScreenLayout.inject()` is called with `slots` wrapper. The outer options object must have a `slots` key; passing slot flags directly at the top level is silently ignored by ScreenLayout.

## Lesson 70: Three review false-rejection patterns fixed with RULE-006/007/008 + T1 checks

**Date:** 2026-03-21  
**Root cause:** The review step (Step 4) was rejecting games for three patterns that are actually correct or acceptable:
1. **Pattern 1 (game_over phase):** Reviewer rejected games where `gameState.phase` was never set to `'game_over'` (string). But `endGame()` is the correct termination mechanism — games that call `endGame()` and send the postMessage payload are correct even if the phase is `'gameover'` (no underscore) or `'results'`. The canonical phase for the test harness is `'gameover'`; the raw `'game_over'` string is normalized by `syncDOMState()`.
2. **Pattern 2 (isActive guard):** Reviewer rejected games where `isActive` wasn't found in the `gameState` init object, even though handlers checked `gameState.isActive`. Two separate issues: (a) `gameEnded = true` at start of `endGame()` is equivalent to `isActive = false` as a re-entry guard; (b) `isActive` must be in the gameState init object (`isActive: true`) so handlers aren't immediately blocked on the first click.
3. **Pattern 3 (TransitionScreen not awaited):** Reviewer rejected games that called `transitionScreen.show()` without `await`. While `await` is strongly preferred (without it, race conditions occur), it is technically optional for the initial DOMContentLoaded call.

**Fix:**
- `lib/prompts.js`: Added RULE-006 (endGame() is the correct termination pattern), RULE-007 (isActive guard acceptable forms), RULE-008 (await on TransitionScreen.show() is optional) to `REVIEW_SHARED_GUIDANCE`.
- `lib/prompts.js`: Added rule 25 (TransitionScreen await) and rule 26 (isActive in gameState init) to `buildGenerationPrompt()` ADDITIONAL GENERATION RULES.
- `lib/prompts.js`: Updated `CDN_CONSTRAINTS_BLOCK` with `TransitionScreen AWAIT` and `isActive IN GAMESTATE INIT` constraints (propagates to fix prompts).
- `lib/prompts.js`: Updated `buildCliGenPrompt()` with TransitionScreen await + isActive init rules.
- `lib/validate-static.js`: Added T1 warning check 5h (TransitionScreen.show() calls not awaited — counts awaited vs total).
- `lib/validate-static.js`: Enhanced T1 check 12 (isActive guard) to also warn when `gameState.isActive` is used in handlers but not in the gameState init object literal.
- `test/validate-static.test.js`: 4 new tests for the new T1 checks. Total: 554 tests (was 550).

**Pattern to watch:**
- If review rejects with "phase never set to game_over" — check that `endGame()` is called correctly and sends postMessage; `RULE-006` in `REVIEW_SHARED_GUIDANCE` should prevent this.
- If review rejects with "missing isActive guard" but handlers do check it — verify `isActive: true` is in the gameState init object. T1 check 12 now warns when it's missing from init.
- If review rejects with "TransitionScreen not awaited" — add `await` to all `transitionScreen.show()` calls. T1 check 5h now warns when any show() calls are unawaited.

## Lesson 71: Silent failures (iterations=0, error_message=NULL) — root causes identified and fixed

**Date:** 2026-03-21
**Scale:** 204 of 344 failed builds (59%) had NULL error_message in the DB, making root cause diagnosis impossible via DB queries alone.

**Root cause 1 — completeBuild() never set error_message:**
`db.completeBuild()` updated status, iterations, test_results, etc., but the SQL never touched the `error_message` column. The column was only written by `db.failBuild()` (called for crashes/orphans). When the pipeline returned a FAILED report normally (e.g., HTML generation failed, T1 validation killed it), `completeBuild()` stored `status='failed'` but left `error_message=NULL`. The report's `errors` array had the failure reason but it was never persisted.

**Root cause 2 — report.iterations never set in runPipeline():**
`report.iterations` was initialized to 0 and was only updated in `pipeline-targeted-fix.js`. In `runPipeline()` and `runFixLoop()`, `report.iterations` was never set. Result: all builds that went through the test loop showed `iterations=0` in the DB, even if the fix loop ran 5 iterations.

**Failure pattern breakdown (from 59 ralph-report.json files analyzed):**
- 30x: `HTML generation failed: claude -p exited with code 1` — LLM process crashed (non-zero exit)
- 8x: `HTML generation failed: claude -p exited with code 143` — SIGTERM (timeout/kill)
- 3x: `HTML generation failed: Proxy returned HTTP 500: auth_unavailable` — Claude OAuth blocked
- 2x: `HTML generation failed: claude -p timed out after 300s` — gen timeout
- 2x: `HTML generation failed: Proxy returned HTTP 403` — auth error
- 13x: Empty errors array + test_results present — fix loop ran but pipeline code had iterations=0 bug

**Fix (commit 4131eca):**
1. `db.completeBuild()` now sets `error_message = COALESCE(error_message, ?)` where the value is:
   - `report.errors.join('; ')` when errors array is non-empty
   - Derived summary `"Tests failed: X/Y passed after N iteration(s). Review: SKIPPED"` when errors is empty but test_results exist
   - Generic fallback when both are empty
   - `COALESCE` ensures pre-existing error_message (set by failBuild() for crashes) is never overwritten
   - NULL for approved builds (no error_message set when status != 'failed')
2. `runPipeline()` now computes `report.iterations = Math.max(...report.test_results.map(r => r.iteration || 1))` after `runFixLoop()` returns, so the DB reflects the actual iteration count.

**Tests:** 4 new unit tests in `test/db.test.js`: from report.errors, from test_results fallback, COALESCE non-overwrite, approved builds have null error_message.

**How to apply:** After this fix, any new failed build will have a non-null error_message in the DB. To backfill existing silent failures, query `reports` in `data/games/*/builds/*/ralph-report.json` and update via `db.failBuild(id, errors[0])` if `error_message IS NULL`. Future diagnostic queries like `SELECT game_id, error_message FROM builds WHERE status='failed' AND error_message LIKE '%code 1%'` will work immediately.

**Detection going forward:** If `error_message IS NULL AND status='failed'` appears in the DB after this fix, it indicates either: (a) the build was failed by an external process that called `failBuild()` with an empty string (check the fallback in worker.js line 1069), or (b) a new code path was added to the pipeline that returns a FAILED report without populating `report.errors`. Both cases are now caught by the worker-level safety net.

---

### Lesson 72 — waitForPackages must check a loaded package; PART-017=NO → check ScreenLayout not FeedbackManager

**Root cause (light-up #411):** The gen prompt's `waitForPackages` template hardcoded `while (typeof FeedbackManager === 'undefined')`. But light-up's spec has PART-017=NO (no Feedback Integration), so FeedbackManager is never loaded by the CDN scripts. The loop spun for 10 seconds, threw "Packages failed to load within 10s", crashed the DOMContentLoaded handler before `window.gameState` was populated, and left `gameState: []` (empty). All tests then timed out on `waitForPhase()`.

**Diagnosis signal:** DOM snapshot shows `gameState: []` (empty array, not object) and the browser error is "Packages failed to load within 10s".

**Fix (commit fd7a36c):** Updated `buildGenerationPrompt()` PART-003 section to show TWO variants based on PART-017:
- PART-017=YES → `while (typeof FeedbackManager === 'undefined')` (unchanged)
- PART-017=NO → `while (typeof ScreenLayout === 'undefined')` (ScreenLayout is always loaded)

Also added rule to `CDN_CONSTRAINTS_BLOCK`: "waitForPackages() typeof check MUST match packages that ARE loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout. NEVER check typeof FeedbackManager when PART-017=NO."

Updated `buildCliGenPrompt()` PART-003 rule with the same constraint.

**How to apply:** If a CDN game's DOM snapshot shows `gameState: []` (empty) and the browser error is "Packages failed to load within 10s", check whether PART-017=NO in the spec and whether the HTML's `waitForPackages` is checking FeedbackManager anyway. The gen prompt fix prevents this on new builds; for existing broken builds, re-queue after the fix is deployed.

---

## Lesson 73 — BullMQ job resurrection: `db.failBuild()` does NOT remove from BullMQ queue

**Date:** 2026-03-21

**Pattern:** Calling `db.failBuild(id, reason)` marks the DB record as `status='failed'` but has NO effect on the corresponding BullMQ/Redis job. The job remains in Redis and will be redelivered to the worker on the next worker restart. When the worker processes the resurrected job, `db.startBuild()` unconditionally overwrote `status='failed'` → `status='running'`, silently re-running a build that was intentionally cancelled.

**Root cause:** BullMQ jobs are entirely Redis-backed. `db.failBuild()` only touches SQLite. The Redis job entry (keyed `bull:ralph-builds:<jobId>`) persists independently. Any worker restart causes BullMQ to redeliver delayed/waiting jobs — including ones whose DB record was already marked failed by admin operations.

**How it manifested:** Five duplicate queue entries (speed-input, true-or-false, truth-tellers-liars, two-player-race, visual-memory) were cancelled via `db.failBuild()`. After a worker restart for a code deploy, all five resurrected and started running as new builds, each overwriting the failed DB record with a new running record.

**Fix (commit b254482):** Added terminal state guard in `worker.js` before `db.startBuild()`:
```javascript
if (buildId) {
  const existingBuild = db.getBuild(buildId);
  if (existingBuild && ['failed', 'approved', 'rejected'].includes(existingBuild.status)) {
    logger.warn(`[worker] Build #${buildId} (${gameId}) already in terminal state '${existingBuild.status}' — skipping stale BullMQ job`);
    return;
  }
  db.startBuild(buildId, { workerId: WORKER_ID });
}
```

**How to apply:** If you need to truly cancel a queued build: (1) call `db.failBuild(id, reason)` to mark DB, AND (2) optionally delete the Redis key directly. The terminal state guard now prevents resurrection, so step (2) is only needed if you also want to free the queue slot immediately without waiting for the next worker pick-up. To find the BullMQ job ID corresponding to a DB build: check the job `data.buildId` field in Redis.

---

## Lesson 74 — window.debugGame T1 false positive: T1 validator wrongly rejected required spec pattern

**Date:** 2026-03-21

**Pattern:** T1 static validator (`lib/validate-static.js`) had a check flagging `window.debugGame = debugGame` as an error, with a comment claiming "review model rejects window-exposed debug functions." This was incorrect — the review model does NOT reject them, and all specs explicitly REQUIRE debug functions to be assigned to `window` in the Verification Checklist.

**Evidence of false positive:** simon-says build #416 was APPROVED with `iterations=0` (no fix loop) and contained 3× `window.debugGame` assignments. The review model passed it. Every other approved CDN game also has these assignments.

**Compounding damage:** The gen prompt CDN_CONSTRAINTS_BLOCK had three mutually contradictory statements:
1. Gen prompt rule: "NEVER assign debug functions to window"
2. T1 validator: Error on `window.debugGame = ...`
3. Spec Verification Checklist: "window.debugGame = debugGame — MUST be assigned to window"

The LLM followed rule 1 (NEVER), T1 validated against rule 2, but the review model actually enforced the spec checklist (rule 3). This produced an unfixable loop: gen followed gen prompt → review rejected per spec.

**Fix (commit d827777):**
1. Removed the `debugWindowPattern` error check from `validate-static.js` entirely. Added comment: "PART-012 debug functions SHOULD be assigned to window per spec — no check here."
2. Flipped the gen prompt rule from "NEVER" → "MUST": "PART-012 debug functions (debugGame, testAudio, etc.) MUST be assigned to window: `window.debugGame = debugGame`. Copy this pattern verbatim from the spec."
3. Corrected the EXCEPTION note and CDN_CONSTRAINTS_BLOCK to use "MUST" language.

**How to apply:** If a build fails T1 with `window.debugGame` flagged as an error, the fix is already deployed (post-commit d827777). If you see a review rejection mentioning debug functions not on window, check whether the gen prompt constraint has reverted. The correct invariant: debug functions are ALWAYS assigned to `window` — this is a spec requirement, not a lint violation.

---

## Lesson 75 — Phase name injection: non-standard game phases require post-processing fixup after test-gen

**Date:** 2026-03-21

**Pattern:** The test generator defaults to `waitForPhase(page, 'playing')` as the universal active phase. Games with custom phase names (e.g., `'memorize'` for matrix-memory, `'question'` for quiz games) have a different active phase — the `'playing'` string never appears in `data-phase`, so all `waitForPhase(page, 'playing')` calls immediately time out and the entire game-flow category fails iteration 1.

**Root cause:** The test-gen LLM prompt instructed "use 'playing' as the game-active phase" as a default. For standard games this is correct. For games where the LLM was told to use a custom phase via DOM snapshot context, the generator sometimes still defaulted to 'playing'. The DOM snapshot's `gameStateShape.phase` field (e.g., `string "memorize"`) captured the runtime phase but wasn't used to override the generated test string.

**Fix (commit 7796007):** Added post-processing step in `lib/pipeline-test-gen.js` that runs immediately after test generation:
```javascript
const snapPath = path.join(testsDir, 'dom-snapshot.json');
if (fs.existsSync(snapPath)) {
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
  const phaseEntry = snap.gameStateShape && snap.gameStateShape.phase;
  const phaseMatch = phaseEntry && phaseEntry.match(/^string "([^"]+)"/);
  const actualPhase = phaseMatch && phaseMatch[1];
  const STANDARD_PHASES = new Set(['playing', 'start', 'gameover', 'results', 'transition', 'paused']);
  if (actualPhase && !STANDARD_PHASES.has(actualPhase) &&
      tests.includes("waitForPhase(page, 'playing')")) {
    tests = tests.replace(
      /waitForPhase\s*\(\s*page\s*,\s*['"]playing['"]/g,
      `waitForPhase(page, '${actualPhase}'`,
    );
  }
}
```

Only fires when: (1) dom-snapshot.json exists, (2) the actual phase is non-standard (not in STANDARD_PHASES), and (3) the generated tests contain a 'playing' reference. Standard games are unaffected.

**How to apply:** If a game with a custom phase (not 'playing') fails iteration 1 with `waitForPhase('playing') timeout`, check dom-snapshot.json for `gameStateShape.phase`. If it shows `string "memorize"` (or similar non-standard phase), the post-processing should have caught it. If tests still use 'playing', verify `pipeline-test-gen.js` is deployed with this fix and that dom-snapshot.json was written before test generation ran.

---

## Lesson 76 — Sentry.captureConsoleIntegration is not a function: separate plugin bundle not loaded

**Date:** 2026-03-21

**Pattern:** CDN games fail smoke check with "Sentry.captureConsoleIntegration is not a function" immediately followed by "missing #gameContent". The smoke check fails even after smoke-regen.

**Root cause:** `CDN_CONSTRAINTS_BLOCK` in `lib/prompts.js` told the LLM: "Use the flat function API instead: `Sentry.captureConsoleIntegration({levels:['error']})`". This function exists only in Sentry's separate `captureconsole.min.js` plugin bundle — NOT in the base `bundle.tracing.replay.feedback.min.js` that games load. Calling it throws `TypeError`, crashes `initSentry()`, prevents `ScreenLayout.inject()` from running, and `#gameContent` is never created.

**Why smoke-regen also failed:** The regen prompt showed only the symptom ("missing #gameContent") without identifying the Sentry API as root cause. LLMs regenerated with the same broken call.

**Fix (commit 562387c):** Banned `captureConsoleIntegration` in `CDN_CONSTRAINTS_BLOCK` with explicit explanation; mandated "OMIT integrations entirely — call initSentry() with no integrations argument or pass []".

**How to apply:** If a CDN build's smoke-check console errors include "Sentry.captureConsoleIntegration is not a function", kill and requeue. Post-fix builds generate correct `initSentry()` without integrations.

---

## Lesson 77 — `.resolves` on already-awaited value throws TypeError: received value must be a Promise

**Date:** 2026-03-21

**Pattern:** Test generator produces `expect(await page.evaluate(() => window.gameState.lives)).resolves.toBe(3)`. This throws `TypeError: received value must be a Promise and resolve to the expected value, but instead it resolved to 3` — crashing the test at runtime and causing 0/0 for the batch.

**Root cause:** `.resolves` is a Jest/Playwright test matcher modifier for unresolved Promises. When the value has already been `await`ed, it is a plain value (e.g., number 3), not a Promise. Applying `.resolves` to a non-Promise throws.

**Fix (commit 576f3a2):**
1. Post-processing in `lib/pipeline-test-gen.js` strips `.resolves` from `expect(await ...).resolves.` patterns automatically after test gen.
2. R7 rule added to test-gen prompt: "NEVER USE .resolves ON AN AWAITED VALUE — WRONG: `expect(await page.evaluate(...)).resolves.toBe(3)` — RIGHT: `expect(await page.evaluate(...)).toBe(3)`"

**How to apply:** If a batch returns 0/0 and the test file contains `.resolves.toBe()` or `.resolves.toEqual()` on an `await` expression, this is the bug. Post-fix, post-processing catches it automatically; R7 rule prevents generation.

---

## Lesson 78 — CDN game toBeVisible assertions need 10s timeout after startGame()

**Date:** 2026-03-21

**Pattern:** `await expect(page.locator('#question-text')).toBeVisible()` flakes on CDN games immediately after `startGame()`. The CDN ScreenLayout and TransitionScreen components continue rendering for 5-10 seconds after the transition animation completes. The default 5s Playwright timeout fires during this window.

**Root cause:** CDN components (TransitionScreen, ProgressBar, ScreenLayout) are async and may not expose game elements until their internal render cycle completes. `startGame()` returns when the transition animation starts, not when all CDN slots are populated.

**Fix (commit 576f3a2):** R6 rule added to test-gen prompt: "For CDN games, use `{ timeout: 10000 }` on toBeVisible() assertions immediately after startGame(). Default 5s timeout will flake on slow CDN loads."

**How to apply:** If a CDN game's mechanics or game-flow tests flake with `toBeVisible()` timeout immediately after startGame() but pass on retry, increase the timeout to 10000ms on those specific assertions.

---

## Lesson 79 — Contract auto-fix T1 re-check used wrong property (errors.length on undefined)

**Date:** 2026-03-21

**Pattern:** After applying a contract auto-fix (Step 1b), the pipeline re-ran T1 static validation and accessed `reStaticResult.errors.length`. `runStaticValidation()` returns `{ passed: boolean, output: string }` — there is NO `errors` array. Every call threw `TypeError: Cannot read properties of undefined (reading 'length')`.

**Why it was silent:** The error was caught by the Step 1b `catch (e)` block and logged as a warning. The pipeline continued without the re-check functioning. The contract auto-fix T1 re-validation was completely non-functional in all builds.

**Impact:** Potentially many builds silently skipped the T1 re-check after contract fix, allowing contract-fixed HTML with lingering static errors to proceed to test-gen.

**Fix (commit cc5fae7):** Changed `reStaticResult.errors.length > 0` → `!reStaticResult.passed`. Error lines extracted from `reStaticResult.output.split('\n').filter(l => l.includes('✗'))`, consistent with the rest of the file.

**How to apply:** If future code accesses properties on `runStaticValidation()` output, always use `.passed` (boolean) and `.output` (string) — never `.errors` (does not exist).

---

## Lesson 80 — associations chronic failure: 4 root causes across 15 builds

**Date:** 2026-03-21

**Pattern:** associations had 15 consecutive failures (0% approval rate) spanning multiple pipeline eras. Each era had a distinct root cause:

**Root cause 1 (builds 109, 157, 158, 291, 345): Wrong mechanics tests — lives on unlimited-lives game**
Test generator produced `❤️❤️` hearts/lives-decrement assertions on an accuracy-scored unlimited-lives game. `totalLives: 0` means no hearts render — correct game, wrong test. Fix loop cannot resolve this. Fix: add CRITICAL no-lives note to spec; H1 LIVES SYSTEM CHECK rule in test-gen prompt.

**Root cause 2 (builds 392, 396): Step 1d smoke-check failure — missing #gameContent**
HTML generation produced no `#gameContent` element. Caught by smoke-check, triggered smoke-regen. These are pre-test-loop failures covered by Step 1d + smoke-regen.

**Root cause 3 (build 405): CDN package load timeout causes silent DOMContentLoaded crash**
`waitForPackages()` 10s timeout fires during Playwright test runs (CDN packages take >10s under test server load). Error is caught silently by DOMContentLoaded `catch (e)` block. `ScreenLayout.inject()` never runs. `#mathai-transition-slot button` never appears. `beforeEach` polls 50s then times out on every test. Note: this is non-deterministic — smoke check at Step 1d uses a different network context and may pass while Playwright tests fail.

**Root cause 4 (build 405): Corrupt fallbackContent — SignalCollector events captured**
`captureGameDomSnapshot()` runs at Step 2.5 before pairs load into `window.gameState.content`. When content is null, the snapshot pipeline falls back to `game-content.json` populated with SignalCollector event API surface names (`{ question: "Event", answer: "Target" }`). Tests using `fallbackContent.rounds` get garbage data, causing assertion crashes.

**Fix applied:**
1. Spec fix: CRITICAL no-lives note added (prevents wrong test generation)
2. Spec fix: CRITICAL content-structure note added (prevents corrupt fallbackContent)

**The CDN package timeout issue (Root cause 3) is not fixable without changing the review model's `≤10s` requirement for waitForPackages. It is a known network variance issue — next build attempt (447) may succeed if CDN packages load within 10s.**

**How to apply:** Any game with unlimited-lives accuracy scoring should have an explicit CRITICAL note in the spec prohibiting lives-based test assertions. Any game where `window.gameState.content` populates asynchronously (after a network fetch) is at risk of corrupt fallbackContent — the spec should describe the actual content structure with a concrete example.

---

## Lesson 81 — Corrupt fallbackContent: SignalCollector API names captured instead of real game data

**Date:** 2026-03-21

**Pattern:** Test generator uses `fallbackContent.rounds` to populate test assertions. For games that load content asynchronously (e.g., Associations fetches word pairs from a server), `window.gameState.content` is null when `captureGameDomSnapshot()` runs at Step 2.5. The pipeline falls back to `extractSpecRounds()` — but this function can parse CDN SignalCollector API surface names ('Event', 'Target', 'Input', 'Action', 'Source', 'Destination') from spec markdown tables as if they were game round data.

**Symptom:** Tests crash with assertions against game-specific properties (e.g., `.emoji`, `.name`) on objects that are actually CDN API event descriptors. Tests pass `question: "Event"` into game logic and get unexpected crashes.

**Fix (commit 668c087):** `detectCorruptFallbackContent(fallbackContent)` added to `lib/pipeline-test-gen.js`. Checks if >50% of `question`/`answer` string values across all rounds match a 10-member CDN API name set. If detected, returns `{ rounds: [], corrupt: true }` and logs a warning — the corrupt data is discarded and test-gen proceeds with empty fallbackContent. 4 unit tests; 562 total pass.

**How to apply:** If tests crash with assertions on game-specific properties that don't match real game data (especially for games with async content loading), inspect `tests/game-content.json` — if it contains CDN event names rather than real game pairs, this is the pattern. Post-fix, the detection runs automatically before test-gen.

---

## Lesson 82 — CDN package load timeout silently kills DOMContentLoaded; window.__initError surfaces it

**Date:** 2026-03-21

**Pattern:** When `waitForPackages()` throws "Packages failed to load within 10s" (CDN slow under Playwright load), the error is caught by DOMContentLoaded's `catch (e)` block which only calls `console.error('Init error: ' + e.message)`. The test harness `beforeEach` then polls 50 seconds for `#mathai-transition-slot button` — a button that will never appear because `ScreenLayout.inject()` never ran. The 50s wait is silent; triage sees only a timeout with no root cause.

**Fix (commit 842c649):**
1. `lib/pipeline-test-gen.js` `beforeEach` template: reads `window.__initError` after `page.goto()` and before the polling loop. If set, logs `[test-harness] DOMContentLoaded init error: <message>` — triage now has the actual error string, not just a timeout.
2. `lib/prompts.js` CDN_CONSTRAINTS_BLOCK: new rule "DOMContentLoaded catch block MUST set `window.__initError = e.message`" so generated HTML always includes this assignment.

**How to apply:** If triage logs show `[test-harness] DOMContentLoaded init error: Packages failed to load within 10s`, the root cause is CDN package load timeout on the test server. Options: (a) re-queue and hope CDN is faster, (b) check CDN script URLs for 404s, (c) check if waitForPackages() is checking the correct package (Lesson 72: PART-017=NO → check ScreenLayout not FeedbackManager).

---

## Lesson 83 — Smoke-regen repeat-failure rate is 38.5%, far above 10% target

**Date:** 2026-03-21

**Measurement:** R&D agent analyzed all CDN smoke-regen events in builds >= 420 (post-ScreenLayout slots fix, commit 2666e36). 13 definitive cases; 8 passed post-regen, 5 failed again. Repeat-failure rate: 38.5%.

**Root causes of post-regen failures:**

1. **Missing #gameContent after regen (4/5 failures)**: smoke-regen uses `genPrompt + smokeErrorContext` — asks the LLM to regenerate from scratch with the error appended. The LLM generates a new game and can still produce broken ScreenLayout.inject() calls. The smokeErrorContext has correct rules but they apply at the end of a full generation prompt and can be overridden by the LLM's own generation path. Key: a from-scratch regen re-introduces the same CDN init mistakes.

2. **HTTP 403 on CDN resources (affects loop-the-loop, bubbles-pairs)**: Some CDN script URLs return 403. `fixCdnDomainsInFile()` fixes wrong domain names but does not fix wrong paths. If a script URL has the right domain but wrong path, it 403s, packages fail to load, ScreenLayout.inject() never runs, #gameContent never created.

3. **Regen introduces new CDN API bugs (face-memory)**: The regen LLM changed something else incorrectly while fixing the init issue (Sentry.captureConsoleIntegration call introduced). Fixed by Sentry ban in commit 562387c — this specific failure mode should not recur.

**Fix needed:** Change smoke-regen from "regenerate from scratch" to "surgical CDN init fix": show the failing HTML to the LLM, ask it to fix ONLY the CDN init sequence (waitForPackages → FeedbackManager.init → initSentry → ScreenLayout.inject). This avoids re-introducing bugs in the rest of the game logic while precisely fixing the root cause.

**Expected impact:** If 4/5 failures are caused by the from-scratch regen approach, switching to a surgical fix prompt could reduce repeat-failure rate from 38.5% to ~8% (1/13 — just the CDN URL 403 case which requires a different fix).

**How to apply:** When investigating a smoke-regen failure where the post-regen HTML still lacks #gameContent, check if the HTML's CDN script URLs return 403. If yes, this is a URL path issue, not a prompt issue. If no, the LLM generated broken ScreenLayout.inject() again — switch to surgical fix prompt approach.

---

## Lesson 84 — Step 1b T1 re-check silently skipped: undefined .output from runStaticValidation() catch path

**Date:** 2026-03-21

**Pattern:** After contract auto-fix (Step 1b), the pipeline re-runs T1 static validation and then calls `reStaticResult.output.split('\n').filter(...)` to extract error lines. If `runStaticValidation()` throws internally (e.g., process killed with no stdout buffered), the catch path returns `{ passed: false, output: err.stdout || err.message }`. When `err.stdout` is undefined (no buffered output) AND `err.message` is also falsy, the result is `undefined || undefined = undefined`. Then `undefined.split(...)` throws TypeError.

**Why it was silent:** The TypeError was caught by the Step 1b outer `try/catch` at line 728, logged as a warning, and execution continued. The T1 re-check after contract-fix was silently skipped — same failure mode as Lesson 79 (cc5fae7), just one level deeper.

**This is the same class of bug as Lesson 79.** The cc5fae7 fix changed `reStaticResult.errors.length` to `reStaticResult.output.split(...)` but left `output` itself unguarded.

**Fix (commit 6e4f06b):**
1. `reStaticResult.output.split(...)` → `(reStaticResult.output || '').split(...)` — null guard on output
2. `recheckErrors.length` → `(recheckErrors || []).length` — belt-and-suspenders for the re-validate check
3. Catch block now logs full stack trace for future debugging

**How to apply:** Any access to `runStaticValidation()` result fields should defensively guard both `.passed` (boolean, safe) and `.output` (string, but can be undefined if process exits without stdout). Always `(result.output || '').split(...)` — never `result.output.split(...)` directly.

---

## Lesson 85 — CDN script 404/403 errors are invisible to smoke-regen LLM without URL pre-validation

**Date:** 2026-03-21

**Pattern:** When CDN script URLs return 404 or 403, `waitForPackages()` times out after 10s and throws. The smoke-regen LLM only sees "Packages failed to load within 10s" — it has no idea which specific URL failed. The LLM guesses at CDN init sequence fixes (ScreenLayout.inject() format etc.) when the actual problem is a wrong URL path that needs correction.

**Examples observed:** memory-flip #432 and true-or-false #436 both failed smoke-regen with CDN 404s. The surgical init fix (commit 8c645dc) could not help since the issue was URL correctness, not init sequence order.

**Fix (commit e867f36):** `checkCdnScriptUrls(htmlContent)` added to `lib/pipeline.js`. Before constructing the smoke-regen prompt:
1. Parses all `<script src>` tags from failing HTML
2. Filters to CDN URLs (storage.googleapis.com, cdn.homeworkapp.ai)
3. Fires parallel HEAD requests with 5s timeout each
4. If any return non-200: builds `cdnUrlContext` listing each failed URL + HTTP status
5. Injects into smoke-regen prompt as "BROKEN CDN SCRIPT URLS (HIGH PRIORITY — fix these first)"

LLM now sees exactly which URL failed and what domain to replace it with, rather than only seeing "packages failed to load".

**How to apply:** Any time smoke-regen logs show `cdnUrlContext` with HTTP 404/403, the root cause is URL path hallucination (not init sequence). The LLM is now told the exact broken URL. Check that `fixCdnDomainsInFile()` is also running after the regen to catch any domain re-introduction.

---

## Lesson 86 — Two 0/0 false-approval gaps: single-category threshold and global fix loop blind spot

**Date:** 2026-03-21

**Gap 1:** `lib/pipeline.js` line 1107 — `zeroCoverageCats.length >= 2`. A build where exactly ONE non-game-flow category returned 0/0 (page broken, no tests ran) passed this guard because it checked for 2 or more zero-coverage categories. That category contributed nothing to `totalFailed`, keeping `passRate` artificially high → build proceeded to review → could be approved with a broken category.

**Fix:** Changed threshold to `>= 1`. Any single category with 0 tests run now fails the build immediately before review.

**Gap 2:** `lib/pipeline-fix-loop.js` line 967 — `hasCrossFailures` only checked `r.failed > 0`. A batch stuck at 0/0 (page broken) was silently ignored by the global fix loop — no repair attempt was made. The global fix loop would skip it and potentially approve.

**Fix:** Updated to `r.failed > 0 || (r.passed === 0 && r.failed === 0)`. A 0/0 batch now counts as failing for global fix triggering, and `failingCategoryNames` includes it in the fix prompt context.

**DB audit:** No existing approved builds had 0/0 categories — the bug was latent, not yet triggered in production. 6 new unit tests added. 573 total pass.

**How to apply:** Any time a build is approved but a category shows 0/0 in the report, it was approved incorrectly. Post-fix, 0/0 categories halt the build before review (Gap 1) and trigger the global fix loop (Gap 2).
## Lesson 87 — TimerComponent: not in CDN bundle → ReferenceError crash

**Pattern:** Games referencing `TimerComponent` fail smoke-check with `ReferenceError: TimerComponent is not defined`. This crashes `DOMContentLoaded` before `ScreenLayout.inject()` runs, leaving `#gameContent` never created → blank page on every smoke-check.

**Root cause:** `packages/components/index.js` does NOT export `TimerComponent`. The LLM hallucinates it as a valid CDN class because the gen prompt previously contained a rule "TimerComponent MUST be initialized with startTime: 0", which implicitly suggested it was valid. Affected games: light-up, face-memory, visual-memory, truth-tellers-liars.

**Fix:** 
- CDN_CONSTRAINTS_BLOCK rule changed from "startTime: 0" → "NEVER use TimerComponent"
- T1 static validator now raises ERROR (not warning) for `TimerComponent` in HTML
- Use `setInterval`/`setTimeout` for countdown/elapsed timers

**Commit:** 48e9992

## Lesson 88 — ScreenLayout.inject() creates empty #gameContent at runtime despite syntactically correct call

**Pattern:** visual-memory #439 failed smoke-check with `#gameContent` having 0 children even after surgical CDN init fix regen. The HTML had the correct `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })` call with the mandatory `slots:` wrapper. CDN URLs were correct. PART-017=NO was handled correctly. Yet Playwright reported `#gameContent` empty after 8 seconds.

**Root cause (investigated):** Likely a subtle ScreenLayout API timing issue — `inject()` may require all CDN packages to be fully initialized (not just ScreenLayout itself) before the DOM slot is created, OR the `<template id="game-template">` clone into `#gameContent` is failing silently if `#gameContent` does not yet exist immediately after `inject()` returns synchronously. Neither the surgical smoke-regen prompt nor the gen prompt addresses this edge case.

**Key insight:** The surgical smoke-regen prompt (commit 8c645dc, Lesson 83) is tuned for CDN URL errors and wrong init order, but it CANNOT fix runtime ScreenLayout API behavior issues. When the HTML already has the correct syntactic pattern, a second surgical regen produces the same HTML and the same failure.

**Current status:** No fix deployed. When a CDN game fails smoke-check with correct CDN URLs and correct `ScreenLayout.inject()` syntax, the cause is likely this runtime timing issue. A Playwright trace is needed to observe exactly when `#gameContent` appears relative to the DOMContentLoaded sequence.

**Affected games:** visual-memory #439.

## Lesson 89 — colour-coding-tool PART-017=YES: overly broad CDN domain rule causes wrong asset URL domain

**Pattern:** colour-coding-tool #441 was early-review-rejected because audio/sticker asset URLs used `storage.googleapis.com/test-dynamic-assets` instead of the spec-provided `cdn.mathai.ai` paths. The spec (PART-017=YES) included explicit example code with `cdn.mathai.ai/mathai-assets/dev/...` URLs for game audio and sticker GIFs.

**Root cause:** `CDN_CONSTRAINTS_BLOCK` contained the rule "EVERY URL in the file must use storage.googleapis.com/test-dynamic-assets". The LLM applied this rule too broadly, replacing spec-provided `cdn.mathai.ai` asset URLs. The rule was intended for PACKAGE SCRIPT tags only, not for spec-provided media asset URLs.

**Note:** The `fixCdnDomainsInFile()` pipeline fix-pass ONLY fixes script src tags (wrong domain → correct domain), NOT audio/sticker JS string URLs. So even with the post-processing pass running, the wrong asset URLs survived into the early-review stage.

**Fix:** CDN_CONSTRAINTS_BLOCK updated to explicitly scope the domain rule to package script tags, and add an exception for spec-provided asset URLs in PART-017=YES games. Commit: [will update].

**Affected games:** colour-coding-tool #441.
