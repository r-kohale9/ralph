# Per-Spec Test Failure Analysis

Date: 2026-03-21
Author: R&D analysis agent (claude-sonnet-4-6)

---

## Overview

This document maps every game in the Ralph warehouse to its current test status, the root cause of any failures, and what would need to change for the next build to succeed. Status is based on the most recent completed build for each game.

All 29 games currently queued will run fresh builds. This document predicts which should succeed and which need pipeline or spec changes first.

---

## Per-Game Status Table

| Game | Build | PART-017 | Star Type | Status | Diagnosed Root Cause |
|------|-------|----------|-----------|--------|----------------------|
| adjustment-strategy | 385 | NO | lives | APPROVED | — |
| aided-game | 290 | YES | unknown | APPROVED | — |
| bubbles-pairs | 386 | YES | unknown | APPROVED | — |
| connect | 406 | NO | lives | APPROVED (1 fail skipped) | Test assumes reset deducts life; game disagrees |
| doubles | 212 | YES | unknown | APPROVED | — |
| explain-the-pattern | 401 | YES | unknown | APPROVED | — |
| free-the-key | 404 | NO | move-count vs par | APPROVED (1 fail skipped) | Test directly mutates state without triggering game logic |
| futoshiki | 407 | NO | lives | APPROVED (needed 1 fix iter) | Life-decrement timing off on first try |
| hidden-sums | 408 | NO | lives | APPROVED (game-flow 0/0) | game-flow test had wrong .resolves.toBe() call; skipped |
| interactive-chat | 390 | YES | unknown | APPROVED | — |
| jelly-doods | 298 | NO | unknown | APPROVED | — |
| kakuro | 391 | YES | unknown | APPROVED (game-flow+mechanics 0/0) | Likely CSS selector or phase name issues in those categories |
| killer-sudoku | 300 | NO | unknown | APPROVED | — |
| listen-and-add | 302 | NO | unknown | APPROVED | — |
| loop-the-loop | 412 | NO | time | APPROVED (3 cats 0/0) | Tests used `#edge-el-0,0-0,1` (commas in CSS selector) — 4 tests skipped, entire categories voided |
| make-x | 304 | YES | unknown | APPROVED | — |
| matching-doubles | 384 | YES | unknown | APPROVED | — |
| matrix-memory | 413 | NO | lives | APPROVED (edge-cases 0/0) | edge-cases tests assumed 'playing' phase; game uses 'memorize'/'question' |
| mcq-multi-select | 414 | YES | lives | APPROVED | — |
| number-pattern | 215 | YES | unknown | APPROVED | — |
| queens | 356 | NO | unknown | APPROVED | — |
| rapid-challenge | 394 | YES | unknown | APPROVED | — |
| sequence-builder | 228 | YES | unknown | APPROVED | — |
| simon-says | 416 | NO | lives | APPROVED | — |
| speedy-taps | 310 | YES | unknown | APPROVED | — |
| two-digit-doubles-aided | 306 | YES | unknown | APPROVED | — |
| word-pairs | 395 | YES | unknown | APPROVED | — |
| zip | 388 | NO | unknown | APPROVED | — |
| associations | 405 | NO | accuracy | FAILED | CDN init race: `#mathai-transition-slot button` not found (5s timeout exhausted before slot renders) |
| count-and-tap | 397 | NO | lives | FAILED | Non-CDN startGame() used for CDN game; game stays at 'start' phase; all tests fail |
| light-up | 411 | NO | time | FAILED | CDN init race: `#mathai-transition-slot button` not found; puzzle-only game with no standard flow |
| match-the-cards | 365 | YES | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results — likely Step 1d page load failure) |
| position-maximizer | 367 | YES | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results) |
| true-or-false | 318 | YES | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results) |
| truth-tellers-liars | 311 | NO | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results) |
| two-player-race | 307 | YES | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results) |
| visual-memory | 315 | NO | unknown | FAILED (0/0 all cats) | Pre-pipeline failure (no test results) |
| crazy-maze | 399 | YES | unknown | REJECTED | Audio URLs use wrong CDN domain (`cdn.homeworkapp.ai` instead of `storage.googleapis.com`) |
| expression-completer | 402 | YES | unknown | REJECTED | Audio URLs use wrong CDN domain |
| memory-flip | 415 | YES | unknown | REJECTED | `FeedbackManager.init()` called inside DOMContentLoaded — init sequencing error |
| colour-coding-tool | 398 | YES | unknown | ORPHANED | Worker restarted mid-build; no report |
| disappearing-numbers | 400 | NO | unknown | ORPHANED | Worker orphaned; no report |
| face-memory | 403 | NO | unknown | ORPHANED | Sentry init error (CaptureConsole is not a constructor) caused Step 1d failure |
| hide-unhide | 409 | YES | unknown | ORPHANED | Worker restarted mid-build |
| identify-pairs-list | 351 | YES | unknown | ORPHANED | No report |
| keep-track | 410 | NO | unknown | ORPHANED | Step 1d: Blank page — missing #gameContent element |
| one-digit-doubles | 354 | YES | unknown | ORPHANED | No report |
| right-triangle-area | 218 | NO | unknown | ORPHANED | No report |
| speed-input | 417 | YES | unknown | RUNNING/QUEUED | Build 418 (totals-in-a-flash) currently running |
| totals-in-a-flash | 418 | NO | unknown | RUNNING | Currently running as of analysis time |

---

## Detailed Root Cause Analysis for Failed/Rejected Games

### associations (Build 405) — FAILED, root cause: CDN init race

**What happened:** All game-flow, mechanics, and edge-cases tests fail with:
```
locator('#mathai-transition-slot button').first()
Expected: visible — Timeout: 5000ms — Error: element(s) not found
```

The `beforeEach` waited 50 seconds polling for the slot button (correct CDN boilerplate). Despite this, the slot button never appeared. This means the FeedbackManager audio popup or ScreenLayout.inject() is not completing within the 50-second window on the test server.

Evidence: Iteration 3 shows a new symptom — `TimeoutError: locator.click: Timeout 15000ms exceeded — waiting for button:has-text("Okay!")` — the "Okay!" popup was visible but detached from the DOM before the click could complete. This is a CDN timing race: FeedbackManager shows the popup, the test finds it, but the popup disappears (perhaps due to ScreenLayout.inject() running in the background) before the click registers.

**PART-017:** NO (FeedbackManager not included) — but the game STILL loads FeedbackManager from CDN (PART-002 loads all CDN packages). The absence of PART-017 means FeedbackManager.init() is not explicitly awaited, so the CDN startup may not proceed in the correct order.

**Diagnosis:** The game may not be calling `FeedbackManager.init()` in the correct init sequence. Since PART-017 is NO, there may be no explicit `await FeedbackManager.init()` before `ScreenLayout.inject()`. If the game calls `ScreenLayout.inject()` before `FeedbackManager.init()` resolves, the transition slot is created but the audio popup appears later and blocks the start button.

**What would fix it:** Verify the generation prompt enforces: `await FeedbackManager.init()` MUST precede `ScreenLayout.inject()`, even when PART-017 is NO. The pipeline already warns about this in the gen prompt (rules 20/21), but the LLM may have generated incorrect order.

**Next build prediction:** Likely to fail again for the same reason unless the gen prompt change is deployed.

---

### count-and-tap (Build 397) — FAILED, root cause: non-CDN startGame path selected for CDN game

**What happened:** The game IS a CDN game (has `ScreenLayout.inject`, `mathai-transition-slot`, `waitForPackages`). However, the test boilerplate used the non-CDN `startGame()` which does:
```javascript
const startBtn = page.locator('button:has-text("Start"), ...');
if (await startBtn.isVisible()) { await startBtn.click(); }
await waitForPhase(page, 'playing', 15000);
```

The CDN game renders its start button inside `#mathai-transition-slot` (a CDN-injected slot), not as a standalone button matching the text selectors. So `startBtn.isVisible()` returns false, no click happens, and the game stays at `data-phase="start"`. All subsequent tests that require `waitForPhase('playing')` time out.

Additionally, `fallbackContent.rounds` was populated with the spec's Markdown table (question/answer pairs from the table's first row: "Field"/"Value", etc.) rather than real game round data. This is because the DOM snapshot was missing — the build directory has no `tests/dom-snapshot.json`.

**Why the non-CDN path was selected:** This build is from an older pipeline version (build 397 vs current 416). The CDN detection logic may have been different at that time.

**What would fix it:** The new pipeline version (build 416+) has better CDN detection. A fresh build should generate CDN boilerplate. Verify by checking that `hasTransitionSlot === true` during test gen.

**Next build prediction:** Likely to pass if the new pipeline runs it. The game itself works (CDN init succeeds, `data-phase` is set to `start`). The only issue was the test harness.

---

### light-up (Build 411) — FAILED, root cause: CDN init race + single-puzzle game

**What happened:** All game-flow, mechanics, and edge-cases fail with the same pattern as associations: `#mathai-transition-slot button` not found in 5 seconds. However, light-up has no ProgressBar (single puzzle — the spec says `PART-023 | NO`), no lives (unlimited), and a different start structure.

The contract category had 0/0 — the contract test depended on completing the game, which required the start transition to work, which failed.

**Key difference from associations:** light-up uses time-based stars with no lives. Tests that try to set lives (`setLives(0)`) would not work. The mechanics tests all failed because `startGame()` could not get past the CDN init stage.

**Why it consistently fails:** light-up is a puzzle game with a single continuous session (no rounds). The CDN game structure may not follow the same `start → game → results` flow that the test harness assumes. If ScreenLayout doesn't get a "next" button on the start screen (perhaps because there's only one puzzle and the start screen shows a "Play" button in a different slot), the test's 50-second slot button search would fail.

**What would fix it:** Check the actual DOM snapshot for light-up — is `#mathai-transition-slot button` visible at startup? If the game uses a custom start button outside the slot, the test gen boilerplate needs to detect this and use the appropriate selector.

**Next build prediction:** Will likely fail again for CDN init reasons unless the generation is fixed to ensure ScreenLayout properly injects a slot button. The new queued build #428 will test this.

---

### crazy-maze, expression-completer (Builds 399, 402) — REJECTED: wrong CDN domain

**Root cause:** Audio/sticker URLs hardcoded to `cdn.homeworkapp.ai` instead of `storage.googleapis.com`. This is a generation quality failure — the gen prompt rules specify the correct domain. Both games include PART-017 (FeedbackManager with audio). The LLM used an incorrect domain.

**What would fix it:** The gen prompt rules already specify this. This is a random generation failure — the LLM followed the wrong example. A fresh build should fix it if the gen prompt is correct.

**Next build prediction:** High probability of passing on next build. This is not a systematic failure.

---

### memory-flip (Build 415) — REJECTED: FeedbackManager init sequencing

**Root cause:** `FeedbackManager.init()` called inside `DOMContentLoaded` callback instead of being awaited before `ScreenLayout.inject()`. The reviewer caught this: "FeedbackManager.init() is called inside the DOMContentLoaded event — init sequencing error."

**What would fix it:** Gen prompt enforces this rule (mandatory CDN init order). Fresh build should fix it.

**Next build prediction:** High probability of passing on next build.

---

### keep-track (Build 410) — ORPHANED, Step 1d failure: missing #gameContent

**Root cause:** The HTML lacked `id="gameContent"` on the main game container, causing the static validator to reject it at Step 1d before any tests ran. The T1 validator checks for this element.

**What would fix it:** Gen prompt rule requires `id="gameContent"`. This is a generation quality failure.

---

### face-memory (Build 403) — ORPHANED, Sentry init error

**Root cause:** `TypeError: Sentry.Integrations.CaptureConsole is not a constructor` at Step 1d. The generated HTML used an incorrect Sentry API for version 10.23.0 (the correct integration API changed in Sentry v8+). The game includes PART-030 (Sentry Error Tracking).

**What would fix it:** The gen prompt specifies Sentry SDK v10.23.0 with the correct init pattern. This is a generation quality failure where the LLM used an older Sentry API.

---

## PART-017 Correlation Analysis

PART-017 (FeedbackManager Integration) controls whether the game explicitly awaits FeedbackManager before proceeding. The correlation with test failure:

| PART-017 Status | Approved games | Failed/Rejected games |
|-----------------|---------------|----------------------|
| YES (included) | 15 | 5 (crazy-maze, expression-completer, memory-flip, match-the-cards, position-maximizer) |
| NO (excluded) | 13 | 6 (associations, count-and-tap, light-up, truth-tellers-liars, visual-memory, disappearing-numbers) |

**Finding:** PART-017 is NOT a reliable predictor of test success. Many games with PART-017=NO pass cleanly (simon-says, futoshiki, connect, etc.), and many with PART-017=YES fail for unrelated reasons (wrong domain, wrong API). The CDN init sequence failure that plagues associations and light-up could still occur even with PART-017=YES if the init order is wrong.

**However:** The three REJECTED builds all have PART-017=YES, and two were rejected for CDN-related audio URL errors. This suggests that PART-017=YES games are more likely to have CDN audio calls, making audio URL correctness a critical failure point for those games.

---

## Mechanic Complexity Correlation

Examining whether game mechanic complexity correlates with test failure:

**Simple mechanics (button tap → answer):** simon-says, mcq-multi-select, futoshiki, hidden-sums — all APPROVED with low iteration counts.

**Medium mechanics (state manipulation + grid):** matrix-memory, connect, explain-the-pattern — all APPROVED.

**Complex mechanics (spatial/drag/path, puzzle-only):** free-the-key (APPROVED), loop-the-loop (APPROVED but with 3 zero-coverage categories), light-up (FAILED), crazy-maze (REJECTED).

**Pattern:** Puzzle-only games (light-up, loop-the-loop, free-the-key, queens) are disproportionately represented in the 0/0 category problem. These games often have custom IDs for their interactive elements (edge IDs with commas, cell IDs with position coordinates), which the test generator can't CSS-escape correctly. They also have time-based stars and single-session flows that don't map cleanly to the standard round/lives test harness.

---

## Games Likely to Pass Next Build (queued batch)

Based on the root cause analysis, these games in the current queue have high probability of passing:

1. **simon-says** — Was approved at build 416; queued at 433. Assuming no code changes, should approve again.
2. **mcq-multi-select** — Was approved at build 414; queued at 431. Should approve again.
3. **matrix-memory** — Was approved at build 413; queued at 430. Should approve again (edge-cases may still have 0/0 due to phase name issue).
4. **futoshiki** — Was approved at build 407; queued at 424. Should approve again.
5. **hidden-sums** — Was approved at build 408; queued at 425. Should approve again (game-flow may still have 0/0).
6. **connect** — Was approved at build 406; queued at 423. Should approve again.
7. **loop-the-loop** — Was approved at build 412; queued at 429. Will likely approve again but with same 0/0 categories — the comma-in-ID CSS selector issue is not fixed.
8. **crazy-maze** — Was rejected for wrong CDN domain. Fresh generation likely fixes it.
9. **memory-flip** — Was rejected for FeedbackManager init order. Fresh generation likely fixes it.
10. **expression-completer** — Was rejected for wrong CDN domain. Fresh generation likely fixes it.

### Likely to fail again

1. **associations** (queued at 447) — CDN init race is systematic. Needs investigation of whether `FeedbackManager.init()` is properly awaited.
2. **light-up** (queued at 428) — CDN init race with puzzle-only game structure. The test harness may not match the actual game UI.
3. **count-and-tap** (queued at 440) — If the new pipeline generates CDN boilerplate correctly, should now pass. If still on old CDN detection, will fail again.

---

## Games Needing Gen Prompt or Pipeline Changes

### 1. loop-the-loop (and all games with special-character element IDs)

**Issue:** CSS selector `#edge-el-0,0-0,1` fails to parse. Test generator uses element IDs verbatim from DOM snapshot.

**Specific change needed:** Add CSS selector escaping in `pipeline-test-gen.js` post-processing:
```javascript
// Convert #id-with,commas → [id="id-with,commas"]
catTests = catTests.replace(/locator\(['"]#([^'"]*,[^'"]+)['"]\)/g,
  (m, id) => `locator('[id="${id}"]')`);
```

**Games affected:** loop-the-loop, any future puzzle game with coordinate-based element IDs.

### 2. matrix-memory (and games with non-standard phase names)

**Issue:** Tests use `waitForPhase(page, 'playing')` but game uses `memorize`/`question`.

**Specific change needed:** Extract actual phase names from DOM snapshot and inject into test-gen prompt as a constraint. The DOM snapshot already captures `data-phase` values — add logic to include them:
```
OBSERVED RUNTIME PHASES: ['start', 'memorize', 'question', 'gameover', 'results']
USE ONLY THESE PHASE NAMES — do NOT use 'playing' if it is not in this list.
```

**Games affected:** matrix-memory, associations (uses `learn`/`recall` phases), any game with custom phase enum.

### 3. associations and light-up (CDN init race)

**Issue:** `#mathai-transition-slot button` not visible within 50 seconds — game never completes CDN startup.

**Specific change needed:** The gen prompt's mandatory init sequence must be stricter. Add to the gen prompt:
```
CRITICAL (CDN INIT ANTI-PATTERN — DO NOT DO THIS):
  // WRONG: ScreenLayout.inject() before FeedbackManager resolves
  ScreenLayout.inject(...);
  await FeedbackManager.init();

CORRECT:
  await FeedbackManager.init({ ... });
  ScreenLayout.inject(...);
```

Also: the DOM snapshot Step 2.5 should detect if `#mathai-transition-slot` is NOT visible at runtime (even after 50 seconds) and report this as a fatal init failure, triggering HTML regen before test gen.

**Games affected:** Any CDN game where PART-017=NO and FeedbackManager is still loaded but not explicitly awaited.

### 4. hidden-sums and similar: wrong `.resolves.toBe()` on non-promise

**Issue:** Test generator wraps already-awaited values in `.resolves.toBe()`, causing a Playwright matcher error.

**Specific change needed:** Add post-processing fixup in `pipeline-test-gen.js`:
```javascript
// Fix .resolves.toBe() on await-ed values
catTests = catTests.replace(/expect\(await page\.evaluate\([^)]+\)\)\.resolves\./g,
  match => match.replace('.resolves.', '.'));
```

**Frequency:** 1 confirmed instance (hidden-sums game-flow). Likely appears in other builds too.

---

## Summary Statistics

| Status | Count |
|--------|-------|
| APPROVED | 28 |
| FAILED (with test evidence) | 3 |
| FAILED (no test evidence — pre-test failure) | 6 |
| REJECTED (post-test quality gate) | 3 |
| ORPHANED/no report | 10 |
| Currently running/queued | 29 |

Of the 28 approved games, **4 have one or more zero-coverage categories (0/0)**: loop-the-loop (3 cats), hidden-sums (1 cat), matrix-memory (1 cat), kakuro (2 cats), doubles (1 cat). These approvals passed the gate but have untested functionality.
