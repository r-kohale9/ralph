# Pipeline Learnings — Genericity & CDN Game Compatibility

Accumulated learnings from making the Ralph pipeline work across all 48 game types.
Each section describes a problem, root cause, and the fix applied.

---

## 1. CDN Game Init Pattern (validate-static.js)

**Problem:** All 46 pre-built CDN games failed static validation.

**Root cause:** Validator assumed `initGame()` function, `checkAnswer()` interaction handler, and `0.8/0.5` star thresholds — all specific to the simple (non-CDN) game pattern. CDN games use:
- `DOMContentLoaded` + `ScreenLayout.inject()` instead of `initGame()`
- `handleXxx()` or `addEventListener('click', ...)` instead of `checkAnswer()`
- `var stars = ... ? 3 : 2 : 1` or `calcStars()` instead of raw thresholds

**Fix:** Broadened all three checks in `validate-static.js`:
- `initGame`: accept `ScreenLayout.inject + DOMContentLoaded` as equivalent
- Interaction handler: accept `handle*`, `check*`, `select*`, `tap*`, `press*`, `on[A-Z]*`, or click `addEventListener`
- Star scoring: accept `calcStars`, `var stars`, `stars = N`, `? 3` ternary pattern

---

## 2. CDN Contract Pattern (validate-contract.js)

**Problem:** CDN games use `window.gameState = {...}` and `type: 'game_complete'` instead of `let gameState = {}` and `type: 'gameOver'`.

**Fix:** Accept both patterns:
- `window.gameState = {...}` added alongside `let/var/const gameState`
- `game_complete` accepted as alternative to `gameOver` (without field-level validation since CDN payload is richer)

---

## 3. beforeEach Popup Race Condition (pipeline.js shared boilerplate)

**Problem:** CDN games take >8s to load. The old sequential approach:
1. Wait 8s for the audio popup → give up if not seen
2. Wait 20s for transition slot button

When CDN takes >8s, step 1 gives up, popup appears during step 2, `FeedbackManager.init()` awaits the popup, blocking `ScreenLayout.inject()` → transition slot never appears.

**Fix:** Single polling loop for 40s total:
```javascript
const deadline = Date.now() + 40000;
while (Date.now() < deadline) {
  if (await okayBtn.isVisible({timeout:300}).catch(()=>false)) {
    await okayBtn.click();
  }
  const slotReady = await page.locator('#mathai-transition-slot button').first().isVisible({timeout:300}).catch(()=>false);
  if (slotReady) break;
  await page.waitForTimeout(500);
}
await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible({timeout:5000});
```

---

## 4. DOM Presence vs Visibility (waitForFunction)

**Problem:** `waitForFunction((slotId) => document.getElementById(slotId)?.querySelector('button') !== null)` checks DOM presence only. Button in slot may be present but `display:none`.

**Fix:** Use `locator.waitFor({state:'visible', timeout:20000})` which checks computed style visibility.

---

## 5. Per-Category Test Regeneration

**Problem:** If any spec file exists, ALL test generation is skipped — even if some categories are missing. Triage also deleted test() blocks and left empty spec files (which then prevented regeneration).

**Fix:**
1. Check each category file independently — only regenerate missing/empty ones
2. After triage: if resulting spec has no `test(` calls, delete the file entirely so it regenerates next build

---

## 6. Test Generation Genericity

**Problem:** Test gen prompt and shared boilerplate were hardcoded for adjustment-strategy:
- `submitAnswer(#answer-input, #btn-check)` in boilerplate
- Category descriptions mentioning "3 rounds per level", "adjustment controls (+/-)"
- Instructions referencing `#original-a`, `#timer-container`, `#adjuster-container`

**Fix:**
- Remove `submitAnswer` from shared boilerplate — LLM derives game-specific interaction helpers from DOM snapshot
- Category descriptions now generic (abstract, no game-specific IDs)
- Prompt tells LLM: "Use DOM snapshot for actual selectors — do NOT guess IDs"

---

## 7. Review Rejection → Targeted Fix Loop

**Problem:** REJECTED verdict ended the build with no recovery path.

**Fix:** After rejection, pipeline now:
1. Extracts rejection reason
2. Generates targeted HTML fix using rejection as guidance
3. Re-reviews (up to 2 attempts)
4. Only marks REJECTED if all attempts fail

---

## 8. BullMQ Lock Expiry (stuck jobs)

**Problem:** Playwright test run killed mid-flight (SIGKILL on worker) leaves the BullMQ job lock unreleased. New worker can't pick up the job.

**Fix:** Manually delete the lock key: `redis-cli DEL 'bull:ralph-builds:{jobId}:lock'`

The lock expires automatically after 30 minutes (KillMode=control-group in systemd service prevents orphaned Claude/Playwright processes from keeping the lock held).

---

## 9. Pre-built HTML Copy (worker.js)

**Problem:** Pipeline always runs LLM generation step, wasting tokens for games with pre-built HTML in `warehouse/templates/{gameId}/game/index.html`.

**Fix:** Worker copies pre-built HTML to build directory before `runPipeline()`:
```javascript
const prebuiltHtml = path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game', 'index.html');
if (fs.existsSync(prebuiltHtml) && !fs.existsSync(path.join(gameDir, 'index.html'))) {
  fs.copyFileSync(prebuiltHtml, path.join(gameDir, 'index.html'));
}
```
Pipeline detects existing HTML and skips generation (Step 1).

---

## 10. Worker SIGTERM Hang (Playwright)

**Problem:** `systemctl restart ralph-worker` can hang for minutes because Playwright's chromium subprocess ignores SIGTERM.

**Fix:** Use `systemctl kill --signal=SIGKILL ralph-worker` then `systemctl start ralph-worker`. The systemd service has `KillMode=control-group` to kill all child processes.

---

## 11. Orphaned "queued" DB Records After Queue Obliteration

**Problem:** Obliterating BullMQ queue leaves DB records in "queued" state with no corresponding jobs. These never get processed.

**Fix:** After obliterating queue, loop and re-queue via `POST /api/build` for each orphaned game.

---

## 12. 0/0 Test Results (Triage Skipping All Tests)

**Problem:** Triage replaced `test()` blocks with `// SKIPPED (triage): TestName` comments, leaving spec files with 0 runnable tests. Next iteration ran those files and got 0 passed / 0 failed, which confused the pipeline.

**Fix:** Two-part:
1. `hasRunnableTests()` check: spec files with no `test(` calls are treated as non-existent
2. After triage: if resulting spec has no `test(` calls, delete the file so it regenerates

---

## 13. Static Validator DOCTYPE Case

**Problem:** CDN games emit `<!DOCTYPE html>` (lowercase), validator expected `<!DOCTYPE HTML>`.

**Fix:** Changed regex to case-insensitive: `/<!doctype\s+html>/i`
