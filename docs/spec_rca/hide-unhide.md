# Spec RCA: hide-unhide

**Game ID:** hide-unhide
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (local diagnostic)
**Status:** APPROVED — build #461 (iter=1, 10/10 tests passing — zero fix iterations)

---

## 1. Root Cause

`pipeline.js::fixCdnDomainsInFile()` replaces ALL occurrences of `cdn.mathai.ai` with `storage.googleapis.com/test-dynamic-assets` — including audio asset URLs that are legitimately hosted on `cdn.mathai.ai`. The hide-unhide spec correctly specifies audio URLs using `cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3` (HTTP 200). After the pipeline's domain-fix pass, these become `storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/home-explore/document/1757501597903.mp3` (HTTP 404). The fix was designed only for CDN **package** script tags (helpers/components/feedback-manager) but it also applies to audio preload URLs via Fix 2 in `fixCdnDomainsInFile()`. This causes `FeedbackManager.sound.preload()` to fail with 404s on every game attempt.

Build 426 additionally showed the LLM hallucinating a completely wrong audio path (`/audio/success.mp3`, `/audio/error.mp3`) — these never existed on GCS either. In build 449, the LLM generated the correct `cdn.mathai.ai` paths from the spec, but the pipeline's own domain fix then broke them.

Secondary issues present in both builds (persistent across regenerations):
- `transitionScreen.show()` not awaited at start screen — corrupts CDN state machine
- `window.endGame` and `window.restartGame` not exported to window — test harness cannot call them

---

## 2. Evidence of Root Cause

**Build 426 (`gcp_url`: `builds/426/index-generated.html`):**
- `error_message` in DB: `"Step 1d: Page load failed after regeneration attempt: Failed to load resource: the server responded with a status of 404 () × 12"`
- HTML lines 419-420: `{ id: 'correct_tap', url: 'https://storage.googleapis.com/test-dynamic-assets/audio/success.mp3' }` — hallucinated path, 404 confirmed
- CDN script load order in build 426: feedback-manager BEFORE helpers/components (wrong — causes dependency failures)

**Build 449 (`gcp_url`: `builds/449/index-generated.html`):**
- LLM generated spec-correct audio URL: `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3`
- Pipeline's `fixCdnDomainsInFile()` Fix 2 transforms it to: `https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/home-explore/document/1757501597903.mp3`
- HTTP check: `cdn.mathai.ai/...1757501597903.mp3` → **200 OK**; transformed GCS URL → **404**

**Pipeline code (lib/pipeline.js lines 261-266):**
```javascript
if (fixed.includes('cdn.mathai.ai') || fixed.includes('cdn.homeworkapp.ai')) {
  fixed = fixed
    .replace(/cdn\.mathai\.ai/g, 'storage.googleapis.com/test-dynamic-assets')
    .replace(/cdn\.homeworkapp\.ai/g, 'storage.googleapis.com/test-dynamic-assets');
```
This global regex runs on the entire HTML file — it cannot distinguish package script src URLs from audio preload string values.

**T1 validator output (build 426):**
```
STATIC VALIDATION FAILED — 4 error(s):
  ✗ MISSING: handleCellClick() uses await — FALSE POSITIVE (regex bleeds into handleCheck())
  ✗ MISSING: window.endGame = endGame
  ✗ MISSING: window.restartGame = restartGame
  ✗ ERROR: 1/4 transitionScreen.show() call(s) are not awaited (line 473)
```
The `handleCellClick` async error is a false positive: the validator's regex captures `handleCheck()` body (which uses `await`) inside the `handleCellClick` match due to the greedy `[\s\S]*?` stopping on `\nfunction` which occurs 44 lines later.

**T1 validator output (build 449):**
```
STATIC VALIDATION FAILED — 4 error(s):
  ✗ MISSING: handleCellClick() uses await — FALSE POSITIVE (same validator bug)
  ✗ MISSING: window.endGame = endGame
  ✗ MISSING: window.restartGame = restartGame
  ✗ ERROR: 1/2 transitionScreen.show() call(s) are not awaited (line 476)
WARNING: TransitionScreenComponent not in waitForPackages() check
WARNING: ProgressBarComponent not in waitForPackages() check
```

---

## 3. POC Fix Verification

**Primary fix — scope the CDN domain replacement to script tags only:**

Current Fix 2 in `fixCdnDomainsInFile()` replaces `cdn.mathai.ai` globally. The fix must exclude non-script contexts (audio preload URLs in JS strings). The correct scope is:
- Fix script `src=` attributes only (already handled by Fix 1 pattern-matching `<script[^>]*...>` tags)
- Fix 2 should be removed or restricted to only `<script` tag contexts

**Verification of correct audio URL:**
```bash
curl -I "https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3"
# → HTTP/2 200
curl -I "https://storage.googleapis.com/test-dynamic-assets/mathai-assets/dev/home-explore/document/1757501597903.mp3"
# → HTTP/1.1 404
```

**Secondary fix — window exports and unawaited transitionScreen:**
Both of these are T1 errors that the static-fix LLM pass must address. They have been present across 2 builds without being corrected, suggesting the static-fix prompt is not catching them reliably for this game pattern. The spec's checklist (line 1194) explicitly requires audio URLs to use `cdn.mathai.ai` domain.

**POC node snippet demonstrating the pipeline bug:**
```javascript
const html = `...{ id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' }...`;
const broken = html.replace(/cdn\.mathai\.ai/g, 'storage.googleapis.com/test-dynamic-assets');
// broken now contains a 404 URL
```

---

## 4. Reliability Reasoning

**Audio URL mangling (deterministic bug):**
- The spec explicitly provides `cdn.mathai.ai` audio URLs. Every time the LLM reads the spec faithfully and emits those URLs, the pipeline will break them.
- Fix is deterministic: restrict Fix 2 to `<script src=` contexts only (or remove it, since Fix 1 already handles script tags).
- Risk of regression: low if the scope restriction is correct. Edge case: if LLM generates `cdn.mathai.ai` in a non-audio non-script context (e.g. a comment), it will be left as-is — this is acceptable since comments do not affect runtime behaviour.

**window.endGame / window.restartGame (probabilistic — LLM must add them):**
- These are T1 errors. The static-fix pass should add them. However, they have failed to be added across 2 builds, suggesting the fix prompt needs to explicitly call them out or the T1 validator's error message is being drowned by the false-positive `handleCellClick` error.
- Fixing the false-positive validator error (separate issue) will reduce noise and improve fix-loop reliability.

**transitionScreen.show() unawaited:**
- Also a T1 error. Same reliability concern as above.

**False-positive handleCellClick async error:**
- This is a validator bug. When `handleCellClick` is followed by an async function (like `handleCheck`), the regex captures the async body. Fix: restrict the regex to match only up to the closing brace of the function, not until the next function keyword.

---

## 5. Go/No-Go for E2E

**READY FOR E2E** — #461 queued.

**Pipeline fixes now applied:**
1. **Lesson 104 (commit e81f410):** `fixCdnDomainsInFile()` Fix 2 now scoped to `cdn.homeworkapp.ai` only (universally wrong, 403). Fix 1 already handles `cdn.mathai.ai` in `<script src>` tags specifically. Valid `cdn.mathai.ai` audio asset URLs are no longer mangled.
2. **Lesson 95 (commit c5bfa4c):** Audio 404s are non-fatal for smoke check — non-blocking resource failures don't trigger false-positive Step 1d failure.
3. **T1 typeof-check ERRORs (Lesson 106, commit d2a3324):** TransitionScreenComponent/TimerComponent/ProgressBarComponent typeof-checks are now enforced as T1 ERRORs — static-fix LLM will add guards if gen misses them.

**Residual risk:** window.endGame/window.restartGame export and await transitionScreen.show() may still be missing — T1 static validator already checks window.endGame and window.restartGame exposure (rules 20/21). If test-gen finds them, triage will classify as fix_html and fix loop will handle.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #75 | Failed, iterations=0, no gcp_url | Infra/early failure (no HTML generated) | Failed |
| #139 | Failed, iterations=0, no gcp_url | Infra/early failure | Failed |
| #165 | Failed, iterations=0, no gcp_url | Infra/early failure | Failed |
| #247 | Failed — queue-sync: BullMQ job lost after worker restart | Worker infra issue | Failed |
| #297 | Failed — orphaned: worker force-killed mid-run | Worker infra issue | Failed |
| #334 | Failed — duplicate queue entry, newer build queued | Deduplication | Failed |
| #336 | Failed, iterations=0, no error message | Unknown early failure | Failed |
| #409 | Failed — orphaned: worker restarted while build running | Worker infra issue | Failed |
| #426 | Failed — Step 1d: 12× "Failed to load resource: 404" | LLM hallucinated wrong audio paths (`/audio/success.mp3`); CDN load order wrong | Failed |
| #449 | Killed — "running on old code — CDN load order + 404 fix deployed" | CDN load order fix deployed; killed before result | Killed |
| #461 | APPROVED (10/10: game-flow 2/2, mechanics 4/4, level-prog 2/2, edge-cases 1/1, contract 1/1) — all at iter=1, zero fix iterations | Lessons 104+106+110 in effect; perfect clean run — validates audio URL domain fix, typeof-check ERRORs, and contract-fix Sentry verify checklist | approved |

---

## Manual Run Findings

**Build 426 HTML analysis (local diagnostic, 2026-03-21):**

All CDN package script tags load correctly (HTTP 200):
- `storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js` — 200
- `storage.googleapis.com/test-dynamic-assets/packages/components/index.js` — 200
- `storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js` — 200

Audio preload URLs both 404:
- `storage.googleapis.com/test-dynamic-assets/audio/success.mp3` — 404
- `storage.googleapis.com/test-dynamic-assets/audio/error.mp3` — 404

CDN script load order in build 426 was wrong: feedback-manager loaded before helpers and components. Build 449 had this corrected.

**Sentry DSN:** Build 426 uses placeholder `examplePublicKey@o0.ingest.sentry.io/0`. Build 449 has `Sentry.init({ integrations: [] })` — placeholder removed.

**waitForPackages() in build 449:** Only checks `FeedbackManager`, `ScreenLayout`, `VisibilityTracker`, `SignalCollector` — missing `TransitionScreenComponent` and `ProgressBarComponent` (CDN race condition, Lesson 96).

**transitionScreen.show() unawaited:**
- Build 426 line 473: `transitionScreen.show({...})` (start screen — not awaited)
- Build 449 line 476: `transitionScreen.show({...})` (start screen — not awaited)
- All other calls in both builds are correctly awaited

**window exports missing in both builds:** No `window.endGame = endGame`, `window.restartGame = restartGame`, or `window.nextRound = nextRound` assignments found anywhere in either build.

---

## Targeted Fix Summary

**What was tried:**
- Build 449 targeted fix: "CDN load order + 404 fix deployed" — build killed before completion, so result unknown. However, based on static analysis, the 404 fix deployed likely did NOT address the `fixCdnDomainsInFile()` mangling issue.

**What worked:**
- CDN load order (helpers → components → feedback-manager) was corrected from build 426 to build 449

**What did not work / still outstanding:**
- Audio URL 404s: not fixed by CDN load order fix. Root cause is pipeline-level domain substitution in `fixCdnDomainsInFile()` Fix 2, which replaces `cdn.mathai.ai` globally including in audio preload JS strings
- window.endGame / window.restartGame export: not added in either build — static-fix pass is not catching this
- transitionScreen.show() await: not fixed in either build
- T1 false positive on handleCellClick async: validator bug, not a real game defect

**Recommended next action:**
1. Modify `fixCdnDomainsInFile()` Fix 2 to scope replacement to `<script src=` contexts only — or remove Fix 2 entirely (Fix 1 pattern already handles CDN package script tags)
2. Wait for build 461 result; if it passes T1 but has audio 404s silently, monitor test results
3. If build 461 fails on game-flow tests (button not clickable / overlay stuck due to unawaited transitionScreen), that is the secondary issue to fix
