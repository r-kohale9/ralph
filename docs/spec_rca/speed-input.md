# Spec RCA: speed-input

**Game ID:** speed-input
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (local diagnostic)
**Status:** READY FOR E2E — blocker was pipeline infra (smoke false positive), now fixed and deployed

---

## 1. Root Cause

Build #448 failed at Step 1d due to a **pipeline false positive in the smoke check classifier**, not a bug in the generated HTML. The old `SMOKE_FATAL_PATTERNS` regex only excluded HTTP 403 errors from being treated as fatal: `/failed\s+to\s+load\s+resource(?!.*status of 403)/i`. Audio and media assets at `storage.googleapis.com/test-dynamic-assets/mathai-assets/` return HTTP 404 when fetched from headless Playwright (confirmed: `correct_tap.mp3`, `wrong_tap.mp3`, sticker GIFs, `trophy.json` all 404 from curl). This produced 12 × "Failed to load resource: the server responded with a status of 404 ()" console errors, which the old pattern incorrectly classified as fatal. The smoke check triggered a regen attempt; the regen produced HTML with the same audio preloads (same assets, same 404s), so the re-smoke also failed and the build aborted. The fix (commit `c5bfa4c`) extended the exclusion to cover 40[34] and was deployed to the server — build #460 will not hit this issue.

A secondary issue exists in the generated HTML: `window.endGame` is never exported to `window`, only `window.restartGame` is. The T1 validator correctly flags this as an error. This will cause test harness failures if #460 generates the same pattern (test harness calls `window.endGame()` directly). The T1 validator also reports a false positive for `initSentry()` called before `waitForPackages()` — the check finds the function *definition* `function initSentry() {` at character 6621, before `waitForPackages(` at 10278, but the actual call is `window.addEventListener('load', initSentry)` (no parentheses, registered after all setup), which is safe.

---

## 2. Evidence of Root Cause

**GCP URL of failing HTML:** `https://storage.googleapis.com/mathai-temp-assets/games/speed-input/builds/448/index-generated.html`

**DB error_message (build #448):**
```
Step 1d: Page load failed after regeneration attempt:
  Failed to load resource: the server responded with a status of 404 () [× 12]
```

**Asset URLs that 404 (verified with curl):**
```
404 https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/home-explore/document/1757501597903.mp3  (correct_tap)
404 https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/home-explore/document/1757501956470.mp3  (wrong_tap)
404 https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif  (correct sticker)
404 https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif  (incorrect sticker)
404 https://storage.googleapis.com/test-dynamic-assets/mathai-assets/lottie/trophy.json  (results sticker)
```

**CDN script URLs (all 200 — packages loaded fine):**
```
200 https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js
200 https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js
200 https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js
200 https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js
200 https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js
```

**T1 static validator output (on index-generated.html):**
```
STATIC VALIDATION FAILED — 2 error(s):
  ✗ MISSING: window.endGame = endGame
  ✗ FORBIDDEN: initSentry() called before waitForPackages()  [FALSE POSITIVE — see §1]

WARNING: TransitionScreenComponent not in waitForPackages() check
WARNING: ProgressBarComponent not in waitForPackages() check
WARNING: Inline event handler found
```

**Old regex (pre-fix) that caused the failure:**
```js
/failed\s+to\s+load\s+resource(?!.*status of 403)/i   // only excludes 403, not 404
```

**New regex (post-fix, commit c5bfa4c, deployed):**
```js
/failed\s+to\s+load\s+resource(?!.*status of 40[34])/i  // excludes both 403 and 404
```

**Regex test confirming 404 errors are now non-fatal:**
```
node -e "const p = /failed\s+to\s+load\s+resource(?!.*status of 40[34])/i;
         console.log(p.test('Failed to load resource: the server responded with a status of 404 ()'));"
// Output: false  (correctly excluded — non-fatal)
```

**Timeline confirmation:**
- Build #448 started: `2026-03-21 07:47:29 UTC`
- Build #448 completed (failed): `2026-03-21 07:56:20 UTC`
- Fix commit c5bfa4c authored: `2026-03-21 13:19:50 +0530` = `07:49:50 UTC` (during the build run)
- Fix deployed to server: after build #448 was already running on old code

---

## 3. POC Fix Verification

**Pipeline fix (infra, already shipped):** Commit `c5bfa4c` changed the smoke pattern from `40[3]` to `40[34]`. Verified deployed on server:
```bash
ssh the-hw-app@34.93.153.206 'grep -n "status of 40" /opt/ralph/lib/pipeline-utils.js'
# 1695:  /failed\s+to\s+load\s+resource(?!.*status of 40[34])/i
```

**HTML fix needed for build #460 (gen prompt / T1 issue):** The `window.endGame` missing export is a real bug. The gen prompt already contains Rule 20 (`window.endGame = endGame` must be added). If build #460's generated HTML omits this, T1 will flag it and the test harness will fail. This is not a new issue — it was present in build #448's HTML.

**Verification that audio 404s are non-blocking:** The game's `waitForPackages()` correctly only waits for `FeedbackManager` and `TimerComponent` (both return 200 from CDN packages). Audio preloading is wrapped in a try/catch:
```js
try {
  await FeedbackManager.sound.preload([...]);
} catch(e) { console.error('Sound preload error:', ...); }
```
So audio 404s produce a console.error but do NOT abort initialization. The game will render and be playable.

---

## 4. Reliability Reasoning

**Why build #460 should pass the smoke check:** The 40[34] fix is deterministic. Any future build for speed-input (or any other game with audio preloads) will no longer be killed by audio/media 404s. This is a pipeline-level fix that benefits all games.

**What could still go wrong in build #460:**
1. **window.endGame missing** — if the LLM again omits `window.endGame = endGame`, T1 will flag it as an error. T1 errors currently do NOT block the pipeline (pipeline continues to test gen after T1). However, the test harness calls `window.endGame()` directly, causing test failures in the fix loop. The gen prompt rules (Rule 20/21) should prevent this, but LLM compliance is probabilistic.
2. **TransitionScreenComponent / ProgressBarComponent not in waitForPackages** — these are T1 warnings. If CDN loading is slow and these components aren't ready when the game inits, it could cause a blank page. Adding them to the waitForPackages condition would make it more robust.
3. **T1 false positive for initSentry** — the validator incorrectly flags the function definition as a "call before waitForPackages". This was present in build #448 and is a T1 validator bug that should be fixed separately.

**Regress risk:** Low. The pipeline fix is a simple regex extension. The window.endGame issue is a gen prompt compliance problem and depends on the LLM following Rule 20.

---

## 5. Go/No-Go for E2E

**Decision: READY FOR E2E**

Build #460 is already queued. The blocking issue (smoke check false positive on 404 audio errors) is fixed and deployed. The HTML quality issues (missing `window.endGame`) may cause test failures in the fix loop, but the smoke check will pass and the pipeline will reach test gen.

**What would need to be true for E2E to fully succeed (reach approval):**
1. LLM generates HTML that exports `window.endGame = endGame` (Rule 20 in gen prompt)
2. Game flow works correctly: expression display → numeric input → check button → lives/round tracking
3. Test harness correctly reads `window.gameState` (confirmed exposed in build #448 HTML)
4. No new CDN issues in regenerated HTML

No action needed before #460 runs — let it proceed.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #98–#179 | No GCP URL, unknown | Likely infra / early pipeline | No HTML artifact |
| #225 | Stalled (iterations=0) | BullMQ job stalled | Infra failure |
| #271 | BullMQ job lost | Worker restart mid-build | Infra failure |
| #317 | Unknown (no gcp_url) | Unknown | No artifact |
| #417 | Orphaned (iterations=0) | Worker restart mid-build | Infra failure |
| #434 | Cancelled | Duplicate queue entry | Infra (non-issue) |
| #448 | Step 1d: 12× 404 fatal errors | Pipeline false positive — old smoke regex excluded 403 only, not 404; audio assets at storage.googleapis.com 404 in headless Playwright | **Fixed** (commit c5bfa4c) |
| #460 | Queued | — | Pending |

---

## Manual Run Findings

- Downloaded `index-generated.html` from GCP (1250 lines). HTML is well-structured and loads all CDN packages correctly.
- All 5 CDN script URLs return HTTP 200 — packages load fine.
- Audio assets (`correct_tap.mp3`, `wrong_tap.mp3`), sticker GIFs, and `trophy.json` all return HTTP 404 from both local curl and headless Playwright. These are non-blocking due to try/catch wrapping.
- `waitForPackages()` checks `FeedbackManager` and `TimerComponent` — both load correctly. Missing `TransitionScreenComponent` and `ProgressBarComponent` from the check (T1 warnings).
- `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })` — correct `slots:` wrapper used.
- `window.gameState` exposed on window — syncDOMState() will work.
- `window.restartGame` exported — restartGame works.
- `window.endGame` NOT exported — test harness cannot call endGame directly.
- `initSentry()` T1 error is a false positive — function definition found before `waitForPackages(` in source, but actual call is `window.addEventListener('load', initSentry)` (safe).

---

## Targeted Fix Summary

| Fix | Type | Status |
|-----|------|--------|
| Extend smoke exclusion from 403-only to 40[34] | Pipeline infra | **Shipped** (commit c5bfa4c, deployed to server) |
| window.endGame export (Rule 20) | Gen prompt compliance | Existing rule — LLM compliance probabilistic; monitor #460 |
| T1 false positive: initSentry() detection finds function definition, not call | T1 validator bug | Not yet fixed — T1 check should look for standalone `initSentry()` call, not inside function definition |
| TransitionScreenComponent / ProgressBarComponent in waitForPackages | Gen prompt gap | Low priority — only needed if CDN timing is borderline |
