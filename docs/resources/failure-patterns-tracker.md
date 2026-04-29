# Ralph Pipeline — Recurring Failure Patterns

Ranked by frequency. Populated from DB `failure_patterns` table + `builds` table + `journalctl` log
analysis + manual observation from `docs/lessons-learned.md`.

Use this as the **primary input for R&D slot selection**. Update after every build cycle.

**Last updated:** 2026-04-28 (added Rank 15: waitForPackages fail-open via `||` ScreenLayout — preview never mounts on cold load)

---

## How to read this document

- **Occurrences** = count from `failure_patterns` table (per-game deduplication) OR build-level count
  from the `builds` table error analysis. These two sources are noted separately.
- **Fix status** = `open` (no systemic fix), `partial` (mitigation shipped, root not eliminated),
  `resolved` (committed fix proven effective)
- **R&D leverage** = estimated % of recent failed builds this pattern caused; highest leverage = best
  R&D target

---

## Active Patterns (unresolved or partially resolved)

| Rank | Pattern | Category | Occurrences (builds) | Games Affected | Root Cause | Fix Status | Lesson |
|------|---------|----------|----------------------|----------------|------------|------------|--------|
| 1 | **Step 1d smoke-check: missing #gameContent (blank page)** | CDN init | 13 of last 50 failed builds | hide-unhide, keep-track, kakuro, associations, disappearing-numbers, kakuro, two-player-race, true-or-false + more | ScreenLayout.inject() never called — either waitForPackages checks wrong package (PART-017=NO → checked FeedbackManager), ScreenLayout missing `slots` wrapper, or from-scratch smoke-regen re-introduces same bug | partial — slots wrapper (L69), PART-017 package check (L72), smoke-regen prompt (L83) shipped; repeat-regen rate still 38.5% | 46, 69, 72, 83 |
| 2 | **Rendering/toBeVisible scatter (all categories fail)** | Rendering | 19 occurrences (`failure_patterns` table, game_id=adjustment-strategy) | adjustment-strategy | FeedbackManager.init() popup race (PART-017=NO game), or test-side visibility assumption mismatch — both surface as toBeVisible() failures across all categories | partial — gen prompt rule (L51) + pre-triage skip guard (L48) shipped; pre-triage fires at >3 toBeVisible failures | 48, 51 |
| 3 | **Step 1d smoke-check: CDN 404 (wrong URL or path)** | CDN URL | 4 of last 50 failed builds | memory-flip, hide-unhide, true-or-false + others | CDN script URLs have wrong domain (cdn.mathai.ai vs cdn.homeworkapp.ai) or wrong path — 404s cause silent package load failure | partial — post-gen fixup replaces cdn.mathai.ai (L38), gen prompt rule 18, CDN_CONSTRAINTS_BLOCK; CDN URL pre-validation shipped (commit e867f36, Lesson 85) — HEAD-checks all CDN script src tags and injects failing URL+status into smoke-regen prompt; wrong-path 404s visible to LLM now | 38, 26, 85 |
| 4 | **JS init error at smoke-check (ReferenceError / TypeError in initSentry)** | CDN init | 2 of last 50 failed builds + recurs across builds | light-up, face-memory, visual-memory, truth-tellers-liars | Sentry.captureConsoleIntegration (not in base bundle), TimerComponent not defined, or other undefined CDN component referenced before load | partial — captureConsoleIntegration banned (L76), TimerComponent banned (L87) + T1 error check; other undefined-ref patterns still possible | 76, 87 |
| 5 | **waitForPhase() timeout — phase not updated in data-phase** | Game state | 2 occurrences (`failure_patterns` table, category=scoring) + widespread in pre-fix builds | adjustment-strategy + CDN games generally | gameState.phase set but syncDOMState() not called immediately after; or window.gameState not on window (syncDOMState reads window.gameState only) | partial — rule 22 (syncDOMState after every phase assignment, L50) + T1 check 5b3 (window.gameState exposure, L40) shipped; still appears on games not regenerated since fix | 40, 50 |
| 6 | **Timing: locator.click timeout** | Timing | 1 occurrence (`failure_patterns` table, category=timing, game_id=adjustment-strategy) + recurring | adjustment-strategy + others | Multiple causes: #popup-backdrop overlay not hidden after VisibilityTracker.onResume() intercepts clicks; isProcessing flag never reset; beforeEach transition-slot timeout fires before game ready | partial — L58 (backdrop hide in onResume), L35/37 (conditional beforeEach), L64 (non-CDN startGame fallback) shipped | 58, 64, 35, 37 |
| 7 | **Smoke-regen repeat failure (38.5% rate)** | Infra / prompt | 5 of 13 smoke-regen events in builds ≥420 | loop-the-loop, bubbles-pairs, face-memory, visual-memory + others | Smoke-regen uses "regenerate from scratch" approach — LLM reintroduces same CDN init mistakes | partial — surgical CDN init fix prompt shipped (commit 8c645dc, Lesson 83); buildSmokeRegenFixPrompt() shows failing HTML and fixes ONLY init block; measuring repeat rate: 1 pass (loop-the-loop #429), 1 fail (visual-memory #439, investigating) | 83 |
| 8 | **Worker restart orphan (build lost mid-pipeline)** | Infra | 7 of last 50 failed builds | matrix-memory, hide-unhide, colour-coding-tool + others | Worker restarted (deploy or OOM kill) while LLM call in-progress; build marked orphaned; BullMQ terminal-state guard prevents resurrection (L73) but orphaned builds still require manual requeue | partial — L73 (terminal state guard), L47 (queue-sync auto-requeue at startup) shipped; OOM restarts still cause orphans | 43, 47, 73 |
| 9 | **Phase name mismatch: waitForPhase('playing') on custom-phase game** | Test gen | Recurring pre-Lesson-75 fix; 2-3 builds affected | matrix-memory + any game with non-standard phase | Test generator defaults to 'playing' even when DOM snapshot shows different active phase (e.g., 'memorize') | partial — post-processing fixup (L75) replaces 'playing' → actual phase from dom-snapshot.json; only fires when snapshot exists and phase is non-standard | 68, 75 |
| 10 | **skip_test singular vs skip_tests plural triage mismatch** | Fix loop | Pre-fix: all builds where skip was intended ran a spurious fix LLM call and often corrupted HTML | Widespread | Triage prompt described `skip_test` (singular) but code checked `skip_tests` (plural); LLM followed prompt description | resolved — normalization alias added (L63); however prompt/code parity is a recurring class of bug | 63 |
| 11 | **PART-017=YES: wrong domain for spec-provided audio/sticker asset URLs** | CDN URL | 1 build (colour-coding-tool #441) | colour-coding-tool | Gen prompt CDN domain rule too broad: LLM replaces spec-provided cdn.mathai.ai asset URLs with storage.googleapis.com/test-dynamic-assets | partial — CDN_CONSTRAINTS_BLOCK rule narrowed to package scripts only; spec-provided asset URLs now explicitly exempted | 89 |
| 12 | **`endGame()` does not set `gameState.phase = 'game_over'` before postMessage** | game-flow | 7 builds (#453,457,463,471,473,487,514), 5 games | memory-flip, count-and-tap, light-up, one-digit-doubles, match-the-cards | `endGame()` sends postMessage but skips `gameState.phase = 'game_over'; syncDOMState()` — `#app[data-phase]` stays `'playing'`, `waitForPhase('gameover')` times out | open — no T1 check for endGame phase assignment; gen prompt rule 8 is too vague to prevent | — |
| 13 | **postMessage returns null (game_complete not received by harness)** | contract | 4 builds (#465,479/480,509), 2 games | keep-track, disappearing-numbers | Three sub-causes: (A) async delay before postMessage fires, (B) wrong `type` field (e.g. `'game_over'`), (C) endGame() crashes before postMessage runs | open — fix loop cannot repair across 3 iterations; requires triage context improvement | — |
| 14 | **Results/victory screen hidden after endGame** | game-flow | 5 builds (#479,480,483,503,513), 3 games | disappearing-numbers, keep-track, associations | `gameState.phase = 'game_complete'` not in syncDOMState normalization map → data-phase never becomes 'results' → results screen CSS never triggers | open — syncDOMState harness missing 'game_complete'→'results' mapping; gen prompt doesn't mandate 'results' phase | 68 |
| 15 | **`waitForPackages` fail-open gate — preview never mounts on cold load** | CDN init | 3 of 3 audited games at fix time (sweep April 2026) | age-matters, spot-the-pairs, cross-logic | Two deviation modes from a stale skill template: (A) `(typeof PreviewScreenComponent !== 'undefined' \|\| typeof ScreenLayout !== 'undefined')` short-circuits as soon as `ScreenLayout` registers (which happens BEFORE `PreviewScreenComponent` in the same bundle's IIFE); (B) `if (typeof X !== 'undefined') new X(...)` silent-skip pattern with X never in waitForPackages at all. Both produce `previewScreen === null` on cold loads, masked by silent `try { ... } catch (e) {}` instantiation blocks. Invisible on warm reloads (bundle cached). | resolved — single source of truth at `alfred/skills/game-building/reference/mandatory-components.md`; validator rules `GEN-WAITFORPACKAGES-NO-OR` (5f3h), `GEN-WAITFORPACKAGES-MISSING` (5f3i), `GEN-SLOT-INSTANTIATION-MATCH` (5f3j) reject the bad shapes at T1; Step 6 Category 1.5 (cold-load init readiness) added as runtime backstop; standalone fallback now re-checks the gate and renders attributable error if any class is undefined; html-template + code-patterns + PART-003 templates rewritten with hard `&&` gate and attributable catches | L-INIT-001..005 |

---

## Resolved Patterns (shipped fix, confirmed effective)

| Pattern | Fix | Commit | Lesson | Date |
|---------|-----|--------|--------|------|
| CDN game: window.endGame not on window → harness endGame() fails silently | Added `window.endGame = endGame` exposure requirement; T1 check + gen rule | — | 5, 33 | 2026-03-19 |
| game_init handler missing `gameState.phase = 'playing'` → all waitForPhase() timeout | Gen prompt CRITICAL rule; T1 static check added | — | 34 | 2026-03-19 |
| window.gameState not on window → syncDOMState() reads undefined, data-phase never set | T1 check 5b3; gen/fix rule 21 | — | 40 | 2026-03-20 |
| Sequential batch ordering wasted fix iterations (batch A stuck while batch B fix would have resolved A) | Global fix loop Step 3c; Step 3b re-tests all batches | — | 18, 27 | 2026-03-19 |
| Cross-batch regressions: per-batch fix overwrites shared HTML, breaks prior-passing batches | detectCrossBatchRegression() with rollback | 76996c1 | 52 | 2026-03-20 |
| Cross-batch guard false rollbacks: 30s timeout returned 0/0, wrongly treated as regression | Skip rollback when nowTotal=0; raise timeout 30s→90s | 7d27432 | 56 | 2026-03-20 |
| HTML generation token truncation: maxTokens=16000 cut mid-script on large specs | All 4 gen call sites updated to maxTokens=32000 | a8392bc | 53 | 2026-03-20 |
| RALPH_LLM_TIMEOUT=1200 (config drift) let static-fix calls hang 20 min | Set RALPH_LLM_TIMEOUT=300; added RALPH_GEN_LLM_TIMEOUT=600 | 4eb1d29 | 54, 57 | 2026-03-20 |
| debug-function window exposure rule conflict (gen said NEVER, spec said MUST) | Flipped gen prompt rule to MUST; removed T1 error check | d827777 | 55, 74 | 2026-03-21 |
| BullMQ terminal-state guard: db.failBuild() didn't stop BullMQ job resurrection | Added terminal-state check before db.startBuild() in worker.js | b254482 | 73 | 2026-03-21 |
| Deleted batch spec files included in passRate → false FAILED before review | Subtract deleted batches' counts before Step 3b | dc20844 | 66 | 2026-03-21 |
| extractSpecRounds() parsed spec metadata tables (PART-001, YES/NO) as round data | Skip rows matching PART-\d+ or YES/NO/— column values | — | 44 | 2026-03-19 |
| extractPhaseNamesFromGame() injected raw phase names; syncDOMState() normalizes them | Apply normalization map before returning; CRITICAL mapping table in GF1 prompt | 32785d3 | 68 | 2026-03-21 |
| FeedbackManager.init() popup (PART-017=NO) → 100% non-deterministic test failure | Gen prompt rule: never call FeedbackManager.init() unless PART-017=YES; spec CRITICAL block | — | 51 | 2026-03-20 |
| Non-CDN games got CDN startGame() helper with transition-slot click → all categories skip | startGame()/clickNextLevel() conditional on hasTransitionSlot; fallback generic selectors | 3df4a3e | 64 | 2026-03-21 |
| `expect(await ...).resolves.toBe()` throws TypeError (already-awaited value) | Post-processing strips .resolves from awaited expressions; R7 rule in test-gen prompt | 576f3a2 | 77 | 2026-03-21 |
| Corrupt fallbackContent: SignalCollector API names captured as game round data | detectCorruptFallbackContent(); discard if >50% match CDN API name set | 668c087 | 81 | 2026-03-21 |
| Contract T1 re-check used errors.length on undefined (runStaticValidation returns {passed, output}) | Changed to !reStaticResult.passed; guarded .output with || '' | cc5fae7, 6e4f06b | 79, 84 | 2026-03-21 |
| Silent build failures: iterations=0, error_message=NULL (completeBuild() never wrote error_message) | completeBuild() now sets error_message from report.errors; report.iterations computed from test_results | 4131eca | 71 | 2026-03-21 |
| window.debugGame T1 false positive: validator rejected required spec pattern | Removed T1 error check; flipped gen rule from NEVER → MUST | d827777 | 74 | 2026-03-21 |
| waitForPackages checked FeedbackManager when PART-017=NO → 10s timeout, blank page | Gen prompt PART-003 section shows TWO variants based on PART-017 | fd7a36c | 72 | 2026-03-21 |
| Rate-limiter starvation: admin cancellations exhausted 10/hr BullMQ limit | Raised rate limit 10→20/hr | ac6588a | 60 | 2026-03-21 |

---

## R&D Recommendations

Ranked by frequency × cost (build time wasted) for the current build era:

### 1. Surgical smoke-regen prompt (**SHIPPED** commit 8c645dc, measuring)
**Pattern:** Smoke-regen repeat-failure rate is 38.5% (5 of 13 events). Every repeat failure wastes an entire build pipeline run (~30 min, ~$0.50).
**Fix shipped:** `buildSmokeRegenFixPrompt()` — shows LLM failing HTML, fixes ONLY CDN init sequence (waitForPackages → FeedbackManager.init() if PART-017=YES → initSentry → ScreenLayout.inject with slots).
**Measurement:** 2 passes (loop-the-loop #429, disappearing-numbers #442), 1 fail (visual-memory #439 — different failure class: ScreenLayout.inject() creates empty #gameContent at runtime, not a CDN URL/init-order issue; surgical prompt cannot fix this). Surgical fix works for CDN URL/init order failures. Need 5+ data points to confirm <10% target for addressable cases.
**Lesson:** 83

### 2. Step 1d improvement: expose CDN 404 path errors (**SHIPPED** commit e867f36, Lesson 85)
**Pattern:** 4 of 13 smoke failures are CDN 404 due to wrong path (not wrong domain — domain fixup already runs). The smoke-check captures `Failed to load resource: 404` but does not surface WHICH URL failed.
**Fix shipped:** `checkCdnScriptUrls()` HEAD-checks all CDN script src tags in parallel, injects failing URL + HTTP status into smoke-regen prompt as "BROKEN CDN SCRIPT URLS (HIGH PRIORITY)". LLM can now correct the exact path.
**Next:** Watch count-and-tap #440 — first live test of URL pre-validation in a CDN game smoke failure.
**Lesson:** 85

### 3. Per-game approval rate monitoring dashboard (open, MEDIUM leverage)
**Pattern:** adjustment-strategy ran 60 builds at 8% approval rate before root causes were systematically identified (Lesson 59). There is no automated alert when a game's approval rate drops below a threshold over N builds.
**Action:** Add a `getGameApprovalRate(gameId, lastNBuilds)` query to `lib/db.js`. Post to Slack when a game falls below 30% over 5 consecutive builds. This would have triggered a deep-dive on adjustment-strategy 50 builds earlier.

### 4. Fix-loop iteration count reduction via smarter triage (open, MEDIUM leverage)
**Pattern:** The R&D finding in `feedback_rnd_fix_loop_insight.md` shows every approved build has iterations=0 when the gen prompt produces correct output. The fix loop adds iterations but rarely rescues a fundamentally broken generation. The highest ROI is improving gen prompt quality, not fix loop mechanics.
**Action:** Audit the 10 most recent approved builds — check how many had iterations=0. Then audit the 10 most recent failures — check what iteration the fix loop failed at and whether the failures were gen-prompt addressable (new rule) vs. inherently non-fixable (wrong spec, CDN outage).

### 6. T1 validation after each fix iteration — prevents fix LLM from breaking CDN init (open, HIGH leverage)
**Pattern:** The fix loop at iteration 2+ sometimes patches an unrelated bug but corrupts `ScreenLayout.inject()` or `waitForPackages` in the process. T1 validation only runs at Step 1b (initial gen). Once the fix loop starts, any CDN init corruption introduced by the fix LLM goes undetected until the next test run returns `#mathai-transition-slot button` missing across ALL categories (8 builds, 5 games affected in builds 450–515).
**Action:** After applying each HTML fix and before running Playwright tests, re-run `runStaticValidation()` on the new HTML. Compare errors to pre-fix baseline: if any NEW errors appear (not in the pre-fix result), discard the fix and either retry with a more constrained prompt or fall back to the pre-fix HTML. This is the same principle as `detectCrossBatchRegression()` but applied to static validation, not test results.
**Estimated impact:** 8 of 65 builds (12%) would have avoided cascading transition-slot failures.

### 5. DOMContentLoaded init error surface improvement (partial, MEDIUM leverage)
**Pattern:** CDN package load timeouts crash DOMContentLoaded silently. Lesson 82 added `window.__initError` assignment to the CDN constraints block, but this only helps for future builds. Existing games without this pattern still produce silent 50s beforeEach timeouts.
**Action:** Add `window.__initError` check to the `beforeEach` template post-processing (guaranteed injection regardless of what LLM generates). This makes triage available for 100% of CDN package timeout failures, not just newly generated games.
**Lesson:** 82

---

## Data Sources

| Source | Query | Last run |
|--------|-------|----------|
| `failure_patterns` table | `SELECT pattern, category, occurrences, game_id FROM failure_patterns ORDER BY occurrences DESC LIMIT 30` | 2026-03-22 |
| `builds` table failures | `SELECT game_id, error_message, iterations FROM builds WHERE status IN ('failed','rejected') AND error_message IS NOT NULL ORDER BY id DESC LIMIT 50` | 2026-03-22 |
| `builds` table test_results JSON | Error signature extraction across builds 450–515 (error type regex matching per batch/iteration) | 2026-03-22 |
| `learnings` table | Build 450–503 learnings (10 records with failure details) | 2026-03-22 |
| Worker logs | `journalctl -u ralph-worker --since "2026-03-20" \| grep -E '(smoke-check-failed\|REJECTED\|FAILED\|Error:)' \| sort \| uniq -c \| sort -rn \| head -30` | 2026-03-21 |
| Manual observation | `docs/lessons-learned.md` Lessons 70–93 | 2026-03-22 |
| Full RCA | `docs/rnd-consistent-failures-rca.md` | 2026-03-22 |
