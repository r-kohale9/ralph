# R&D: Smoke-Regen Fix Effectiveness Measurement

**Measurement date:** 2026-03-21
**Status:** IN PROGRESS — post-fix data accumulating (1 event so far)
**Author:** R&D measurement agent

---

## Background

The smoke-regen path (Step 1d) triggers when a freshly-generated CDN game fails to load in
the headless browser. The pipeline regenerates the HTML using either:

- **Old path (genPrompt + smokeErrorContext):** Full regen from scratch with context about the
  error. LLM can introduce new bugs unrelated to the CDN init sequence.
- **Surgical path (buildSmokeRegenFixPrompt):** Shows the LLM the failing HTML and asks it to
  fix ONLY the CDN init sequence (waitForPackages → FeedbackManager.init → initSentry →
  ScreenLayout.inject). Does not allow full regen.

### Timeline of Changes

| Date | Commit | Change |
|------|--------|--------|
| ~2026-03-19 | 2666e36 | Add ScreenLayout.inject() slots format to smoke-regen prompt (old path) |
| 2026-03-21 | 8c645dc | Introduce surgical CDN init fix prompt (`buildSmokeRegenFixPrompt`) |
| 2026-03-21 | 8c645dc | **BUG:** Gate guarded by `if (specMeta.isCdnGame)` — dead code, always false |
| 2026-03-21 | c4d24f2 | Fix dead code: detect CDN from HTML content instead of `specMeta.isCdnGame` |
| 2026-03-21 | c4d24f2 | Deployed to server via scp (server git log doesn't show this commit) |

---

## Pre-Fix Baseline (Lesson 83 Measurement)

**Source:** Commit 6064891 (2026-03-21 10:57 IST), ROADMAP surgical fix entry, Lesson 83.

**Measured window:** Builds post-commit 2666e36 (ScreenLayout slots fix) using the old genPrompt
approach. Approximately builds 301–419.

**Result:** 13 smoke-regen events analyzed. 5/13 failed again after regen = **38.5% repeat-failure
rate**.

**Root causes of the 5 pre-fix failures:**
- Missing `#gameContent` (ScreenLayout.inject() broken in regenerated HTML) — 4/5 cases
- CDN URL issues (net::ERR_FAILED) — 1/5 cases

**Step 1d repeat failures identified in DB (builds 301–419):**

| Build | Game | Error Class |
|-------|------|-------------|
| 301 | light-up | CDN ERR_FAILED + blank page |
| 303 | loop-the-loop | Blank page (missing #gameContent) |
| 359 | bubbles-pairs | Blank page (missing #gameContent) |
| 389 | kakuro | Blank page (missing #gameContent) |
| 392 | associations | Blank page (missing #gameContent) |
| 396 | associations | Blank page (missing #gameContent) |
| 400 | disappearing-numbers | Blank page (missing #gameContent) |
| 403 | face-memory | Sentry init error + blank page |
| 410 | keep-track | Blank page (missing #gameContent) |
| 419 | true-or-false | CDN 404s |

Note: 10 repeat-fails visible in DB (all status=failed). Lesson 83 counted 13 total events
(10 failed + 3 that passed smoke-regen and continued to the test loop — passes don't leave a
Step 1d error_message footprint).

---

## Dead Code Era (Builds 420–439) — Worst Case

After 8c645dc was deployed (surgical path introduced) but BEFORE c4d24f2 fixed the dead code,
every smoke-regen event fell through to the old genPrompt path because `specMeta.isCdnGame` was
always `false`.

**Step 1d repeat failures in this window:**

| Build | Game | Error Class |
|-------|------|-------------|
| 420 | truth-tellers-liars | TimerComponent not defined |
| 421 | two-player-race | Blank page (missing #gameContent) |
| 422 | visual-memory | TimerComponent not defined |
| 426 | hide-unhide | CDN 404s |
| 427 | keep-track | Blank page (missing #gameContent) |
| 428 | light-up | Sentry captureConsoleIntegration + blank page |
| 432 | memory-flip | CDN 404s |
| 436 | true-or-false | Blank page (missing #gameContent) |
| 438 | two-player-race | CDN 404s |
| 439 | visual-memory | Blank page (missing #gameContent) |

**Repeat-failure rate:** Cannot calculate precisely (unknown how many passed), but all 10 smoke-
regen events in this window that we can observe FAILED — 100% visible failures. The dead code bug
made the surgical path completely inactive.

**New failure class in dead code era:** TimerComponent hallucination (builds 420, 422) — a new
error type added by the gen prompt changes around this time (Lesson 87 subsequently banned it).

---

## Post-Fix Results (Builds 440+ using c4d24f2)

After c4d24f2 was deployed to the server via scp, builds >= ~440 use the working surgical path.

**CDN detection logic in c4d24f2:**
```javascript
const failingHtml = fs.readFileSync(htmlFile, 'utf-8');
const isCdnGame =
  failingHtml.includes('storage.googleapis.com/test-dynamic-assets') ||
  failingHtml.includes('cdn.homeworkapp.ai');

if (isCdnGame) {
  smokeRegenPrompt = buildSmokeRegenFixPrompt(failingHtml, smokeResult.fatalErrors[0], specMeta, cdnUrlContext);
}
```

**Post-fix smoke-regen events observed:**

| Build | Game | Result | Notes |
|-------|------|--------|-------|
| 442 | disappearing-numbers | PASSED smoke-check | Surgical path ran; build continued to test loop (currently running). Confirmed by commit 0ea28a2. |
| 444 | expression-completer | FAILED (CDN 404s) | Repeat-failure. 12× CDN 404 errors. Surgical prompt cannot fix wrong CDN URL paths — this is a different failure class. |

**Post-fix repeat-failure rate (to date):** 1/2 events = **50%** — but this is a very small sample
(n=2). The expression-completer failure is a CDN 404 class, which the surgical prompt cannot
address (wrong script URLs, not broken init sequence). The `cdnUrlContext` injected into the
surgical prompt should help but didn't for this case.

**Builds currently in queue that may trigger smoke-regen:**
- #446 face-memory (running) — previously hit Step 1d with Sentry error
- #447 associations (queued) — hit Step 1d blank page 2× before
- #449 hide-unhide (queued) — hit Step 1d CDN 404s
- #451 light-up (queued) — hit Step 1d Sentry + blank page
- #452 keep-track (queued) — hit Step 1d blank page 2×
- #453 memory-flip (queued) — hit Step 1d CDN 404s
- #454 truth-tellers-liars (queued) — previously hit TimerComponent
- #456 visual-memory (queued) — hit Step 1d 2× (TimerComponent, blank page)

These 8 builds represent the next wave of measurement data.

---

## Failure Category Breakdown (All Time, n=21 repeat-fails)

| Category | Count | Notes |
|----------|-------|-------|
| Blank page / missing #gameContent | 12 | ScreenLayout.inject() broken — surgical prompt targets this |
| CDN 404s | 5 | Wrong script URLs — surgical prompt + cdnUrlContext targets this |
| Sentry init error | 2 | Wrong Sentry API call — surgical prompt targets this |
| TimerComponent not defined | 2 | Hallucinated component — Lesson 87 bans it in gen prompts |

The surgical prompt directly addresses 12+5+2 = 19 of 21 cases. TimerComponent cases (2) are
now prevented upstream by the T1 static validator ban (Lesson 87).

---

## Hypothesis and Confidence

**Hypothesis:** Surgical CDN init fix prompt (c4d24f2) will reduce repeat-failure rate from 38.5%
(Lesson 83 baseline) to <20%, because:
1. It shows the LLM the ACTUAL failing HTML rather than regenerating from scratch
2. It restricts scope to the CDN init sequence only — no opportunity to introduce unrelated bugs
3. It explicitly includes the 6-step correct CDN init order and ScreenLayout.inject slots format
4. For 404 cases, it also includes `cdnUrlContext` listing the specific failing URLs

**Current confidence level:** LOW (n=2 post-fix events, 1 pass / 1 fail = 50%).

**Expected sample needed:** 8–10 CDN smoke-regen events to reach statistical significance.

**Next update trigger:** When builds 447–456 complete (8 games known to have CDN issues in queue).

---

## What to Watch For

1. **Blank page cases:** These should now reliably pass with the surgical prompt. If visual-memory
   or keep-track hit blank-page again, the surgical prompt is still failing to fix ScreenLayout.inject.

2. **CDN 404 cases:** expression-completer shows these are still a problem. The `cdnUrlContext`
   lists the failing URLs but the LLM must replace them correctly.

3. **TimerComponent:** Should no longer appear (banned by Lesson 87 T1 check).

4. **New failure class:** Any new error type appearing in Step 1d results = new pattern to track.

---

## Action Needed After Next Wave

Once builds 447–456 complete, re-run this query to update the post-fix table:

```bash
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -p \"
const Database = require('better-sqlite3');
const db = new Database('data/builds.db');
const postFix = db.prepare(\\\"SELECT id, game_id, status, error_message FROM builds WHERE id >= 440 ORDER BY id\\\").all();
JSON.stringify(postFix.filter(b => b.error_message && b.error_message.includes('Step 1d')).map(b => ({id: b.id, game: b.game_id, err: b.error_message.slice(0,120)})), null, 2)
\""
```
