# R&D: Never-Approved Games Root Cause Analysis

**Date:** 2026-03-21
**Analyst:** Claude Sonnet 4.6 (R&D #65 follow-up)
**Context:** 10 games have had 4–8 build attempts each and have never been approved. R&D #65 established that the fix loop doesn't rescue bad generations — so the only lever is gen quality.

---

## Summary of Findings

**The never-approved games are not primarily a gen quality problem.** Most historical failures were caused by infrastructure issues (BullMQ stalls, worker restarts, LLM crashes). The 3 games that got far enough to be REJECTED reveal 3 specific policy contradictions in the pipeline that block approval regardless of gen quality.

---

## Category 1: Infrastructure Failures (Historical, Now Fixed)

**Games:** All 10
**Build range:** Builds 90–320 (before March 21, 2026)

All builds in this range have `tests=0, iterations=0, error_message` of:
- `"job stalled more than allowable limit"` — 5 builds
- `"queue-sync: BullMQ job lost after worker restart"` — 9 builds
- `"HTML generation failed: claude -p exited with code 1 for generate-html: "` — ~30+ builds (NULL error captures, identified from commit `4131eca`)
- `"logger is not defined"` — 1 build (code bug)

**Root cause:** None of these 10 games ever got past Step 1 (HTML generation) before March 21, 2026. They were silently failing due to infra instability, not game-specific complexity. The batch of builds 307–327 all failed with a 7-8 second turnaround — faster than any LLM call — indicating immediate LLM/process crash.

**Current status:** Builds 416+ (running as of this analysis) are getting past HTML generation for the first time. Simon-says build 416 progressed past T1 and T2 validation.

---

## Category 2: REJECTED Games — Three Shared Policy Contradictions

Three games reached the review stage and were rejected across 5 total builds:
- `expression-completer`: builds 309, 402 → REJECTED
- `crazy-maze`: build 399 → REJECTED
- `memory-flip`: build 415 → REJECTED

All three share the **same 3 rejection reasons** across every rejected build.

---

### Issue 1: Audio Asset URLs — Pipeline Actively Breaks Them (CRITICAL)

**Rejection message (appears in every rejected build):**
> "Audio preloading URLs use the `cdn.homeworkapp.ai` domain instead of the specifically required `cdn.mathai.ai` domain."

**Root cause:** `fixCdnDomainsInFile()` in `lib/pipeline.js` (lines 149–183) rewrites `cdn.mathai.ai` → `cdn.homeworkapp.ai` unconditionally:

```javascript
// Fix 1: cdn.mathai.ai → cdn.homeworkapp.ai (domain swap; same path structure)
if (fixed.includes('cdn.mathai.ai')) {
  fixed = fixed.replace(/cdn\.mathai\.ai/g, 'cdn.homeworkapp.ai');
}
```

This runs after every LLM HTML write. Then Fix 2 only removes `cdn.homeworkapp.ai` _script tags_ (not audio URLs). Net result: audio MP3 URLs always end up as `cdn.homeworkapp.ai`.

**Spec requirement (checklist item in expression-completer, memory-flip, speed-input, two-player-race, crazy-maze):**
```
- [ ] Audio URLs use `cdn.mathai.ai` domain (not `cdn.homeworkapp.ai`)
```

**The LLM cannot fix this** — even if it writes `cdn.mathai.ai` correctly (per spec), the pipeline immediately rewrites it to `cdn.homeworkapp.ai`.

**Gen prompt contradiction:** Line 367 says `NEVER cdn.homeworkapp.ai or cdn.mathai.ai` — but this intended restriction only applies to package script CDN URLs, not audio file assets. The LLM overapplies it and uses `cdn.homeworkapp.ai` as a fallback, which the pipeline then preserves.

**Fix required (pipeline, NOT gen prompt):** `fixCdnDomainsInFile()` Fix 1 must scope the rewrite to `<script>` tags only, leaving audio URLs (mp3, gif, json in `sound.preload` and `playDynamicFeedback`) untouched:
```javascript
// Only rewrite cdn.mathai.ai in script src attributes, not audio URLs
fixed = fixed.replace(/(<script[^>]*src=["'])https:\/\/cdn\.mathai\.ai/g, '$1https://cdn.homeworkapp.ai');
```

**Affected games:** All 5 with `PART-017=YES` and the explicit audio URL checklist item: `expression-completer`, `memory-flip`, `speed-input`, `two-player-race`, `crazy-maze`.

---

### Issue 2: `FeedbackManager.init()` Called When Spec Forbids It

**Rejection message (memory-flip build 415):**
> "`FeedbackManager.init()` is called inside the `DOMContentLoaded` event listener, directly violating the explicit spec instruction not to call it."

**Root cause — gen prompt vs. spec contradiction:**

Gen prompt (line 95):
> "ONLY call `FeedbackManager.init()` if spec explicitly says `PART-017 Feedback Integration: YES`"

But all specs with `PART-015=NO` (which is all current game specs) also contain this comment in the code template:
> `// DO NOT call FeedbackManager.init() — PART-015 auto-inits on load. Calling it shows a blocking audio popup that breaks all tests.`

memory-flip has `PART-017=YES` AND `PART-015=NO`. The gen prompt rule says "call init if PART-017=YES" — but the spec says explicitly DO NOT call it. The LLM follows the gen prompt rule and calls `FeedbackManager.init()`, which the reviewer correctly rejects.

**Correct behavior (from approved builds):** All approved games with `PART-017=YES` do NOT call `FeedbackManager.init()`. PART-015 auto-initializes the SDK. The gen prompt rule is wrong.

**Fix required (gen prompt):** Replace line 95 with:
> "NEVER call `FeedbackManager.init()` — PART-015 auto-inits on load regardless of PART-017 status. Calling it shows a blocking audio popup that causes 100% test failure."

Remove the conditional `PART-017=YES → call init()` rule entirely. The spec code templates already say DO NOT call it.

**Affected games:** All games with `PART-017=YES`: `expression-completer`, `memory-flip`, `speed-input`, `two-player-race`, `crazy-maze`, and `true-or-false`.

---

### Issue 3: Debug Functions — T1 Validator vs. Reviewer Direct Contradiction

**Rejection message (expression-completer build 309, memory-flip build 415):**
> "Debug functions (`debugGame`, `debugAudio`, etc.) are declared as local const variables inside the DOMContentLoaded closure rather than being attached to the `window` object."

**Root cause — three-way contradiction:**

| Component | Rule |
|-----------|------|
| Gen prompt (lines 104, 152, 364) | "NEVER assign debug functions to window — keep LOCAL inside DOMContentLoaded" |
| T1 static validator (`validate-static.js` line 298) | FAILS build with "FORBIDDEN: Debug functions assigned to window" |
| Spec verification checklist | Requires `window.debugGame = ...`, `window.debugAudio = ...` |
| Review model | Rejects if debug functions are NOT on window |

**Evidence that the gen prompt/T1 rule is wrong:** matrix-memory (build 413, APPROVED) has `window.debugGame`, `window.debugAudio`, `window.testAudio` in its final HTML, AND fails T1 validation when validated directly. It was approved because the review-fix step re-added them per the spec, and the final reviewer approved. The T1 check effectively never wins — if the LLM keeps them local, the review rejects; if the review-fix adds them to window, the final build is approved despite T1 failure.

**Fix required:**
1. Remove the `debugWindowPattern` check from `validate-static.js` (it's incorrect — causes T1 errors on correct code).
2. Update gen prompt: change "NEVER assign to window" → "MUST assign to window: `window.debugGame = debugGame; window.debugAudio = debugAudio; window.testAudio = testAudio;`"

**Affected games:** All with `PART-012=YES` (which is all 10 never-approved games).

---

### Issue 4: Missing Sentry.captureException in Audio Catch Blocks (crazy-maze only)

**Rejection message (crazy-maze build 399):**
> "Missing `Sentry.captureException` in the `catch` blocks for audio playback."

**Root cause:** The spec code template for audio catch blocks shows `console.error()` only. The gen prompt's Sentry rule ("ALL catch blocks MUST call Sentry.captureException(e)") is correct but the LLM follows the template pattern and omits Sentry in audio catch blocks.

**Fix required (gen prompt):** Add explicit example for PART-030+PART-017 games:
```javascript
// PART-030 + audio catch: MUST include Sentry.captureException
try { await FeedbackManager.sound.play('correct_tap'); }
catch(e) { Sentry.captureException(e); console.error('Audio error:', JSON.stringify({ error: e.message })); }
```

**Affected games:** Only `crazy-maze` among the never-approved set (only one with `PART-030=YES`).

---

## Priority Order for Gen Prompt Fixes

### Priority 1 (BLOCKER — pipeline code fix, not gen prompt):
**Fix `fixCdnDomainsInFile()` to preserve audio asset URLs on `cdn.mathai.ai`.**
This is a deterministic pipeline rewrite that makes approval impossible for 5 games regardless of LLM output quality. Must be fixed in `lib/pipeline.js` first.

### Priority 2 (HIGH — gen prompt fix):
**Remove `FeedbackManager.init()` conditional rule; replace with unconditional "NEVER call init".**
Affects 6 games. Simple one-line fix in gen prompt.

### Priority 3 (HIGH — gen prompt + T1 validator fix):
**Flip debug function rule: NEVER local → MUST be on window. Remove T1 debugWindowPattern check.**
Affects all 10 games. Resolves a 3-way contradiction that currently makes review rejection unavoidable when gen prompt is followed correctly.

### Priority 4 (MEDIUM — gen prompt fix):
**Add Sentry.captureException to audio catch block examples for PART-030 games.**
Affects only crazy-maze currently.

---

## Expected Impact

If the 3 pipeline/prompt fixes are applied:
- **5 games** (expression-completer, memory-flip, speed-input, two-player-race, crazy-maze) have a clear path to approval — their only rejection reason was the audio URL domain.
- **4 more games** (simon-says, visual-memory, truth-tellers-liars, totals-in-a-flash) were blocked entirely by infra issues. They're getting their first real shot in builds 416–444. Their rejection rate is unknown — they may have genuine game logic issues to discover.
- **1 game** (crazy-maze) additionally needs the Sentry fix.

Based on R&D #65's finding that every approved build had 0 fix iterations, fixing Issues 1–3 in the gen prompt and pipeline should result in first-pass approvals for at least 5 of the 10 games.

---

## What Was Not Analyzed

The 4 PART-017=NO games (simon-says, visual-memory, truth-tellers-liars, totals-in-a-flash) have custom game mechanics that have never been tested. Their failure modes are unknown — they need actual build runs with the new pipeline to diagnose. simon-says build 416 is running right now and will provide the first real failure data.

---

## Update: Deep Dive Analysis (2026-03-21 — Second Pass)

A second-pass analysis was performed querying builds 390–450 directly from the server DB and inspecting recent HTML artifacts. Key findings that supplement the above:

### Confirmed: ScreenLayout.inject missing `slots:` wrapper is a live, recurring failure

**New evidence:**
- associations build 405: `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })` — NO `slots:` wrapper
- disappearing-numbers build 400: same pattern → `Step 1d: Page load failed: Blank page: missing #gameContent element`
- The test harness learnings table shows `locator('#mathai-transition-slot button').first() — element(s) not found` for 8 distinct games × multiple build runs

**Mechanism confirmed:** Without `slots:`, `ScreenLayout.inject()` never creates `#mathai-transition-slot`. `TransitionScreenComponent({ containerId: 'mathai-transition-slot' })` still constructs successfully but `.show()` silently no-ops because the container div is absent. ALL tests fail on first assertion. Fix loop can't rescue this because both iterations 1 and 2 return identical 0% failure.

**There is no post-processor for this.** Priority 2 fix from the original analysis remains unimplemented.

### Confirmed: Audio CDN domain written by pipeline is `cdn.homeworkapp.ai` in audio preload URLs

**New evidence (builds 415 and 225 confirmed):**
- memory-flip build 415 line 929: `url: 'https://cdn.homeworkapp.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3'`
- speed-input build 225 line 819: identical pattern
- The pipeline's `fixCdnDomainsInFile()` Fix 1 rewrites `cdn.mathai.ai → cdn.homeworkapp.ai` globally, then Fix 2 only removes `cdn.homeworkapp.ai` from `<script>` tags — leaving audio MP3 URLs untouched with the wrong domain

**Note:** The gen prompt says "NEVER cdn.homeworkapp.ai" for CDN packages, and the LLM correctly generates `cdn.mathai.ai` for audio URLs, but `fixCdnDomainsInFile()` then silently corrupts these to `cdn.homeworkapp.ai`. The review LLM correctly rejects this. **This is a pipeline code bug, not a gen prompt bug.**

### New finding: true-or-false (build 224) used cdn.homeworkapp.ai for PACKAGE scripts (not just audio)

Build 224 HTML loads ALL CDN packages from `cdn.homeworkapp.ai/packages/...` (returns 403). This explains why true-or-false had blank page failures. Build 224 predates the `fixCdnDomainsInFile()` fix. The queued build 436 should use the correct URLs via the post-processor.

### New finding: FeedbackManager.init() popup may corrupt hasTransitionSlot detection

count-and-tap build 397 DOM snapshot is missing `mathai-transition-slot` despite the HTML correctly implementing it. Hypothesis: `FeedbackManager.init()` shows a blocking audio popup during DOM snapshot capture (Step 2.5). Since `ScreenLayout.inject()` runs AFTER `FeedbackManager.init()` in the init sequence, and the popup blocks execution, the DOM snapshot captures the pre-inject state. Result: `hasTransitionSlot` falls back to HTML content check, which DOES find `mathai-transition-slot` in the HTML — so this should still give the correct CDN startGame. But the actual generated test file shows "Non-CDN game" comment. **Further investigation needed** on why the HTML check isn't preventing the wrong boilerplate.

### Per-game status summary (builds 390–450 era)

| Game | Latest Meaningful Build | Root Cause | Fixable By |
|---|---|---|---|
| associations | 405 | ScreenLayout `slots:` missing | Post-processor P2 |
| count-and-tap | 397 | Wrong `startGame()` generated (Non-CDN path) | Investigate hasTransitionSlot logic |
| disappearing-numbers | 400 | ScreenLayout `slots:` missing → blank page | Post-processor P2 |
| face-memory | 403 | `Sentry.Integrations.CaptureConsole` TypeError | Post-processor (replace old Sentry API) |
| memory-flip | 415 | Audio CDN domain + FeedbackManager.init() | Pipeline fix P1 + P2 |
| speed-input | 225 | Audio CDN domain | Pipeline fix P1 |
| expression-completer | 160 | Audio CDN domain + debug window exposure | Pipeline fix P1 + gen prompt P3 |
| crazy-maze | 339 | Audio CDN domain + missing Sentry in catch | Pipeline fix P1 + gen prompt P4 |
| simon-says | 416 | Unknown (queued, awaiting run) | TBD |
| true-or-false | 318 | Old CDN domains (now fixed by post-processor) | Already fixed — needs clean run |
| visual-memory | 315 | Review rejected (reason unknown) | Needs analysis after clean run |
| light-up | 347 | Review rejected + net::ERR_FAILED load | CDN domain (old) — needs clean run |
| hide-unhide | 409 | Infrastructure orphan | Needs clean run |
| colour-coding-tool | 398 | Infrastructure orphan | Needs clean run |
| keep-track | 410 | Infrastructure orphan | Needs clean run |
| truth-tellers-liars | 311 | Infrastructure orphan | Needs clean run |
| two-player-race | 307 | Infrastructure orphan | Needs clean run |
| totals-in-a-flash | 327 | Review rejected (reason unknown) | Needs analysis |

### Recommended immediate pipeline code fixes (highest ROI)

**Fix A (pipeline.js `fixCdnDomainsInFile`, 5-line change):**
Change Fix 1 to only rewrite `cdn.mathai.ai` in `<script src=` attributes, NOT in audio URL strings:
```javascript
// Scope to <script> tags only — don't touch audio asset URLs
fixed = fixed.replace(/(<script[^>]*src=["'])https:\/\/cdn\.mathai\.ai/g, '$1https://cdn.homeworkapp.ai');
```
This unblocks ~6 games that are rejected solely for audio CDN domain.

**Fix B (pipeline.js `fixCdnDomainsInFile`, 3-line addition):**
Add a new fix to repair the remaining `cdn.homeworkapp.ai` in audio preload URL strings:
```javascript
// After Fix 2: if cdn.homeworkapp.ai remains in audio preload strings, fix to cdn.mathai.ai
fixed = fixed.replace(/(['"])https:\/\/cdn\.homeworkapp\.ai\/mathai-assets\//g, '$1https://cdn.mathai.ai/mathai-assets/');
```

**Fix C (pipeline.js, 3-line addition):**
Add Sentry constructor API auto-repair:
```javascript
// Fix old Sentry.Integrations.CaptureConsole constructor that throws TypeError
if (fixed.includes('Sentry.Integrations.CaptureConsole')) {
  fixed = fixed.replace(/new\s+Sentry\.Integrations\.CaptureConsole\([^)]*\)/g, 'Sentry.captureConsoleIntegration({levels:["error"]})');
}
```

**These 3 fixes are pure post-processors — safe, deterministic, no LLM involvement.**
