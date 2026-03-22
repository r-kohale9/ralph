# RCA: quadratic-formula-worked-example

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #545 | game-flow 3/4 → 0/4 in final retest; mechanics 5/5 → 4/5; level-progression 1/1 → 0/1; edge-cases 1/2; contract 0/2 (both deleted by triage); FAILED 41.7% overall | CDN cold-start timing: fix-loop and final retest ran on different CDN warmth states. Also: postMessage field name mismatch (livesRemaining vs rounds_completed, time vs duration_ms). | FAILED — needs local diagnostic + CDN timing characterisation |

---

## 1. Root Cause

**Primary: CDN cold-start timing regression between fix-loop and final retest.**

Build #545 produced HTML that reached 10/12 passing tests during the per-category fix loop (game-flow 3/4, mechanics 5/5, level-progression 1/1, edge-cases 1/2). The global fix loop's best HTML was restored before final retest. In final retest, the same HTML scored only 5/12 (game-flow 0/4, mechanics 4/5, level-progression 0/1, edge-cases 1/2).

The regression on same HTML from 10/12 → 5/12 is not an HTML logic bug. It matches the CDN cold-start pattern documented in count-and-tap Lesson 91: between the fix-loop test runs and the final retest, the CDN server went cold. WorkedExampleComponent, FeedbackManager, and ScreenLayout — loaded from `storage.googleapis.com` — take 2–3 minutes to warm up on a cold GCP server. The final retest browser has no CDN cache and times out inside the 50s `beforeEach` window.

The fact that game-flow went from 3/4 to 0/4, and level-progression from 1/1 to 0/1, is consistent with CDN cold-start: these tests exercise the game's start flow (TransitionScreen, WorkedExampleComponent rendering) which requires CDN package availability. Mechanics 5/5 → 4/5 is likely a flaky assertion rather than a CDN issue.

**Secondary: postMessage contract field name mismatch.**

The behavioral transcript revealed that the game sends:
```json
{ "type": "game_complete", "data": { "metrics": { "livesRemaining": N, "score": N, "time": N, "stars": N } } }
```

But the spec for PART-036 worked-example games requires:
```json
{ "type": "game_complete", "data": { "metrics": { "rounds_completed": N, "wrong_in_practice": N, "duration_ms": N, "stars": N, "accuracy": N } } }
```

Both contract tests were deleted by triage (0/2 evidence), so they were not attempted in the fix loop. The postMessage field mismatch is a genuine spec compliance issue — the gen prompt does not enforce the correct schema for worked-example postMessage payloads.

---

## 2. Evidence of Root Cause

| Artifact | Finding |
|----------|---------|
| Fix-loop results (per-category) | game-flow 3/4 (iter 2), mechanics 5/5, level-progression 1/1, edge-cases 1/2 — best HTML scored 10/12 in warm conditions |
| Final retest on same HTML | game-flow 0/4, mechanics 4/5, level-progression 0/1, edge-cases 1/2 = 5/12 — same HTML, different CDN warmth |
| Pattern match: count-and-tap Lesson 91 | Identical regression: tests pass in fix loop, fail in final retest on same HTML. Root cause there was CDN cold-start (2.5 min CDN load on cold GCP VM exceeding 50s beforeEach timeout). |
| Behavioral transcript (pipeline log) | postMessage sends `livesRemaining`, `time` — wrong field names vs spec requirement for `rounds_completed`, `duration_ms` |
| Contract test deletion | Both contract tests deleted by triage (0/2 evidence) — they were never attempted, so no fix-loop iterations targeted the postMessage schema |
| 33 GF8 lint warnings | `toBeVisible()` without `waitForPhase()` in level-progression and mechanics spec files — indicates test gen quality issue independently of CDN |
| Smoke check | PASSED in 13s — game HTML is structurally correct, CDN loads fine on warm server |
| T1 static validation | PASSED — no structural HTML errors |
| Gemini-2.5-pro gen | 52,259 bytes in 116s — large game, algebra MCQ with 3 rounds × 3 sub-phases (example → faded → practice) |

**NOT YET DONE — local diagnostic.js run needed to confirm:**
- Whether CDN actually cold-starts in the final retest window
- Whether game-flow tests pass locally (confirming game logic is correct)
- Console errors, network 404s, data-phase at each step

---

## 3. POC Fix Verification

**Status: NOT READY — CDN timing hypothesis not yet confirmed by local diagnostic.**

Required steps before marking ready:
1. Download final retest HTML: `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/quadratic-formula-worked-example/builds/545/index.html" -o /tmp/qfwe-545/index.html`
2. Run `node diagnostic.js` locally — confirms CDN loads in < 0.1s (cached), all game-flow tests pass
3. If local tests pass → CDN cold-start confirmed as root cause (same pattern as count-and-tap #440)
4. Document console output, screenshots, and `window.gameState` shape in §2 above

**Secondary fix (postMessage schema) — NOT YET VERIFIED:**
- Gen prompt must be updated to enforce correct PART-036 postMessage schema for worked-example games
- Fields required: `rounds_completed`, `wrong_in_practice`, `duration_ms`, `stars`, `accuracy`
- Fields wrong: `livesRemaining`, `score`, `time`
- No POC verification done yet — this requires a gen prompt update and a new build

---

## 4. Reliability Reasoning

**CDN cold-start (primary):**
This is a systemic pipeline infrastructure issue, not an HTML bug. The final retest always runs after all per-category fix loops complete — by then, the CDN cache on the test browser may have expired. CDN cold-start is non-deterministic (depends on GCP CDN warmth state at the moment the final retest executes). The fix is not in the HTML — it requires either: (a) a CDN local proxy during test runs (serving CDN scripts from disk, eliminating network latency), or (b) a pre-warm step before final retest (loading the HTML once before the timed test run). Neither is implemented.

Until one of these is implemented, any game that passes per-category fix loop at >80% but fails final retest on same HTML should be treated as a CDN timing casualty, not an HTML regression.

**PostMessage schema mismatch (secondary):**
This is a deterministic gen prompt quality issue. The gen prompt for PART-036 worked-example games does not specify the correct postMessage field names. Every build will generate the wrong schema until the prompt is corrected. Regression risk: zero once the prompt rule is added (the LLM follows explicit field name requirements reliably).

**Edge cases remaining unhandled:**
- GF8 lint warnings (33 × `toBeVisible` without `waitForPhase`) — test gen quality issue, separate from CDN timing
- Cross-batch guard regression in edge-cases (1/2 despite fix loop) — indicates the global fix loop may have regressed one edge-case test while fixing another

---

## 5. Go/No-Go for E2E

**Status: NOT READY**

Blocking items:
1. **§2 Evidence incomplete** — local diagnostic.js run not yet performed. CDN cold-start hypothesis is inferred from pattern match with Lesson 91, not confirmed by browser screenshots or console output from this build's HTML.
2. **§3 POC incomplete** — no local diagnostic confirming game-flow tests pass on warm CDN.
3. **PostMessage fix not implemented** — contract tests will continue to be deleted by triage (0/2 evidence) until gen prompt is updated with correct PART-036 postMessage schema.
4. **GF8 lint warnings** — 33 `toBeVisible` without `waitForPhase` violations in test gen output. This is a test gen prompt issue that may cause false failures independent of CDN timing.

**Required before next E2E:**
1. Run local diagnostic.js against build #545 HTML → confirm game-flow passes locally (§2 + §3)
2. Update gen prompt to enforce correct PART-036 postMessage schema: `rounds_completed`, `wrong_in_practice`, `duration_ms`, `stars`, `accuracy`
3. Fix GF8 lint warnings in test gen prompt (add `waitForPhase` requirement before `toBeVisible` assertions)

---

## Manual Run Findings (browser screenshots, console, network)

**NOT YET DONE.** No local diagnostic.js run has been performed against build #545 HTML. See §3 for required steps.

---

## Targeted Fix Summary

| Fix | Status | What Changed |
|-----|--------|-------------|
| CDN cold-start root cause confirmation | PENDING | Run local diagnostic.js against build #545 HTML |
| PostMessage schema fix | PENDING | Gen prompt update: PART-036 worked-example postMessage must use `rounds_completed`, `wrong_in_practice`, `duration_ms`, `stars`, `accuracy` |
| GF8 lint warning fix | PENDING | Test gen prompt: require `waitForPhase` before `toBeVisible` assertions |
| CDN pre-warm / local proxy | ROADMAP | Pipeline infrastructure: pre-warm CDN before final retest, or serve CDN from disk during tests |
