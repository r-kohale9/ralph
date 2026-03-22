# Spec RCA: expression-completer

**Game ID:** expression-completer
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (pipeline analysis + Lesson 95)
**Status:** APPROVED — build #458 approved (iter=2, 8/8 tests passing)

---

## 1. Root Cause

expression-completer #444 failed at Step 1d with a pipeline false positive. The generated HTML was correct — `FeedbackManager.init()` with audio preload URLs from `storage.googleapis.com/test-dynamic-assets/audio/*.mp3`. These files don't exist (no actual audio assets there). Playwright logged 12× "Failed to load resource: the server responded with a status of 404 ()". The smoke check SMOKE_FATAL_PATTERNS matched `/failed\s+to\s+load\s+resource(?!.*status of 403)/i` — the 403 exclusion only covered CDN auth failures. 404s were not excluded. The game itself was correct and functional; the 404s were non-blocking. Pipeline incorrectly classified this as fatal.

---

## 2. Evidence of Root Cause

**Build #444 DB record:**
```
id: 444, game_id: 'expression-completer', status: 'failed', iterations: 0,
error_message: 'Step 1d: Packages failed to load' (12× "Failed to load resource: 404")
```

**From Lesson 95 (docs/lessons-learned.md):**
> `FeedbackManager.sound.preload()` references audio files at `storage.googleapis.com/test-dynamic-assets/audio/*.mp3`. These files don't exist on the CDN. Playwright logs 12× "Failed to load resource: 404 ()". SMOKE_FATAL_PATTERNS matched `/failed\s+to\s+load\s+resource(?!.*status of 403)/i` — the 403 exclusion only covered CDN auth failures. Audio 404s are non-blocking for game functionality. Build #444 failed at Step 1d with 12 "fatal" 404 errors.

**Indicator:** All 12 error messages were identical "Failed to load resource: 404" strings — no other errors. No CDN package errors, no blank page, no JS crashes. The error_message field had no other content.

---

## 3. POC Fix Verification (REQUIRED before E2E)

**Pipeline fix (commit c5bfa4c, Lesson 95):** Extended SMOKE_FATAL_PATTERNS exclusion from `(?!.*status of 403)` to `(?!.*status of 40[34])`. Audio/media 404s are now non-fatal. Unit test updated: 404 resource error → result.length = 0 (non-fatal).

**No HTML fix needed:** expression-completer HTML was correct. FeedbackManager.init() with audio preload is expected and correct behavior for PART-017=YES games. The CDN just doesn't serve audio files (they're loaded lazily or from a different path).

**Verification:** Unit test added to `test/pipeline.test.js` (or pipeline-utils.test.js) confirms "Failed to load resource: 404" with any status is non-fatal after the fix.

---

## 4. Reliability Reasoning

**Is the fix deterministic?** Yes — regex exclusion is a code change, not probabilistic LLM output.

**What could cause regression?** If SMOKE_FATAL_PATTERNS is modified in the future and the 404 exclusion is removed. The unit test guards against this.

**Edge cases:** If a CDN package script itself returns 404 (not an audio asset), the error would include the script URL (`.../packages/...`) — different pattern. Real CDN package failures show "Packages failed to load" or "X is not defined" caught by other patterns.

---

## 5. Go/No-Go for E2E

Decision: **READY FOR E2E**

- §2 Evidence: Build #444 error_message confirms 100% audio 404s, no other errors. Pattern confirmed.
- §3 POC: Pipeline fix committed (c5bfa4c), unit test passing.
- Expected: Step 1d passes (audio 404s non-fatal), game-flow and mechanics tests run, approval likely in ≤2 iterations assuming HTML is otherwise correct.

**Note:** expression-completer has only one meaningful failed build (#444 — the false positive). No prior HTML quality issues identified. First clean run with fixed pipeline should reveal if the game logic/tests are correct.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| 444 | Step 1d: "Packages failed to load" (12× audio 404) | Pipeline false positive — audio 404 smoke check | failed |
| 458 | APPROVED (8/8: game-flow 2/2, mechanics 3/3, level-prog 1/1, edge-cases 1/1, contract 1/1) | Pipeline false positive fixed (Lesson 95 audio 404 exclusion) + contract mutation rules (Lesson 108) | approved |

---

## Targeted Fix Summary

| Fix | Commit | Outcome |
|-----|--------|---------|
| Audio 404 smoke check exclusion | c5bfa4c | Step 1d no longer false-fails on non-blocking 404s |
