# UI/UX Audit — Word Pairs

**Build:** #529  **Date:** 2026-03-23  **Auditor:** UI/UX slot (static analysis)

---

## Summary

**CRITICAL: CSS is fully stripped.** Both `<style>` blocks contain only `/* [CSS stripped — 57 chars, not relevant to JS fix] */`. Word-pairs is the oldest build in this batch (#529 vs #543 right-triangle-area) and predates the FIX-001 fix. The game has zero custom styling. This is the same pattern as count-and-tap #551, right-triangle-area #543, and name-the-sides #557.

Secondary structural observations: the game has a learn/recall architecture rather than MCQ-click. It uses a text input field (`<input type="text">`) for recall, which introduces unique accessibility concerns around keyboard handling and mobile input behaviour. The ProgressBarComponent uses the correct `slotId: 'mathai-progress-slot'` format — a positive data point (this build is older but got the slot ID right).

---

## Issues Found

### High Priority

**UI-WP-001 — CSS fully stripped — CRITICAL (PART-028 / FIX-001 pattern — 5th confirmed instance)**
Two separate `<style>` blocks, both stripped to the same comment. The pipeline performed a JS-only surgical fix and stripped ALL CSS in the process. Without CSS: learn/recall layout is undefined, word pair display is unstyled, the answer input and submit button have browser-default appearance, the results card has no card styling. Classification: **(a) gen prompt rule** — FIX-001 shipped (dc03155); PART-028 T1 check deployed 2026-03-22; this build (#529) predates both. This is the 5th confirmed instance.

**UI-WP-002 — Text input field: no autocapitalize protection on recall answers**
`<input type="text" autocapitalize="off" autocomplete="off">` — both attributes are set correctly. `autocapitalize="off"` prevents iOS from capitalising the first letter. `autocomplete="off"` prevents browser-saved suggestions. This is **good** practice. Observation: the `answer-input` class has no CSS (stripped), so the input renders as browser-default. On mobile, default input styling may be too small or conflict with virtual keyboard. *Requires browser verification.* Classification: **low priority / observation**.

**UI-WP-003 — Feedback area missing aria-live (WCAG SC 4.1.3 / ARIA-001 pattern)**
`<div class="feedback-area" id="feedback-area" style="display: none;">` — no `aria-live="polite"` or `role="status"`. The recall phase shows feedback after text submission. Screen reader users will not hear correct/wrong feedback. Also: `<p class="feedback-text" id="feedback-text">` is inside `feedback-area` — the live region should be on the container. Classification: **(a) gen prompt rule** — ARIA-001, 7th confirmed instance across audit batch.

**UI-WP-004 — Results screen uses `style.display = 'flex'` — no position:fixed (known pattern)**
`document.getElementById('results-screen').style.display = 'flex'` — inline style, no position:fixed. Results screen will render in document flow. If user has scrolled during the learn phase, results screen will not cover the full viewport. Classification: **(a) gen prompt rule** — 6th confirmed instance of position:fixed missing on results screen.

**UI-WP-005 — `data-lives` hardcoded to 0 in syncDOMState**
```js
app.setAttribute('data-lives', 0);
```
`data-lives` is always set to 0 regardless of game state. Word-pairs does not use a lives mechanic, so this is technically correct for this game, but the test harness may rely on `data-lives` to assess game state. If pipeline tests assert `data-lives > 0` at game start, they will fail. The field should either be omitted or correctly reflect the lives count. Classification: **(d) test coverage gap** — verify test harness assertions on `data-lives` for non-lives games.

### Medium Priority

**UI-WP-006 — Submit button `data-testid="btn-check"` does not match element id `btn-submit`**
```html
<button class="game-btn btn-primary" id="btn-submit" data-testid="btn-check" data-signal-id="btn-submit">Submit</button>
```
The `data-testid` is `btn-check` but the id and signal-id are `btn-submit`. Tests using `data-testid` selectors will use `btn-check`, but the signal collector and other references use `btn-submit`. Inconsistency between testid and functional id may cause test confusion. Classification: **(a) gen prompt rule** — `data-testid` should match element `id` (or be consistently prefixed); no divergence between testid and signal-id.

**UI-WP-007 — Learn phase has no explicit timer display or countdown**
The learn phase uses `await delay(gameState.exposureDuration)` to auto-advance between word pairs. There is no visible countdown or timer for the learner during the learn phase. The learner sees a word pair and then it disappears after 2–3 seconds with no indication of how long they have. Classification: **(b) spec addition** — word-pairs spec should specify whether a visible countdown during the learn phase is required for the learning UX.

**UI-WP-008 — `lives-display` element is hidden by default with no lives mechanic**
`<div id="lives-display" data-testid="lives-display" style="display:none;">` — the element exists but is never shown (no lives mechanic). Pipeline tests may assert on `lives-display` visibility. Classification: **(d) test coverage gap** — verify test assertions don't expect `lives-display` to be visible in word-pairs.

**UI-WP-009 — Older Sentry SDK version (7.105.0 vs 10.23.0 in newer builds)**
```html
<script src="https://browser.sentry-cdn.com/7.105.0/bundle.min.js"></script>
```
Newer games (quadratic-formula, soh-cah-toa) use Sentry 10.23.0 with the three-script split (bundle + captureconsole + browserprofiling). Word-pairs uses the older 7.x single-bundle. This is a CDN version inconsistency — older Sentry API may not support `getCurrentHub().getClient()` correctly in all environments. Classification: **(a) gen prompt rule** — standardise Sentry SDK version to 10.23.0 with the correct three-script pattern (already in CDN_CONSTRAINTS_BLOCK for newer games; verify word-pairs spec).

**UI-WP-010 — ProgressBarComponent called with `autoInject: true` AND explicit `slotId`**
```js
progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 3, totalLives: 0, slotId: 'mathai-progress-slot' });
```
`slotId: 'mathai-progress-slot'` is **correct** — positive finding. `autoInject: true` may conflict with ScreenLayout.inject() already having injected the slot container. *Requires browser verification of whether double-injection causes issues.* Classification: **(c) CDN constraint** — document that `autoInject: true` + `slotId` together may be redundant or conflicting after ScreenLayout.inject().

### Low Priority / Observations

- `waitForPackages()` timeout is 120000ms (2 min) — within T1 requirement (≥10000ms). Good.
- The game has robust SignalCollector integration — every phase transition, pair display, and recall question is tracked with `recordViewEvent`. This is exemplary telemetry usage.
- `restartGame()` re-instantiates SignalCollector, Timer, ProgressBar, and VisibilityTracker — correct cleanup pattern.
- `hidePopupBackdrop()` is called in onResume and restartGame — correct popup-backdrop teardown (Rule 24 compliant).
- `data-round`, `data-score`, and `data-lives` are all set in `syncDOMState()` — complete DOM state sync.
- The learn phase uses `async/await` with `await delay(exposureDuration)` — natural auto-advance without setTimeout soup. Good pattern.
- `gameState.data-lives = 0` always — see UI-WP-005.

---

## Routing

- **Gen Quality tasks:**
  - UI-WP-001: CSS strip prevention — already in FIX-001 + PART-028; confirm T1 catches dual-block strip pattern (two `<style>` blocks both stripped)
  - UI-WP-003: ARIA-001 — `aria-live="polite"` on `#feedback-area` (7th confirmed instance — ARIA-001 must ship as hard rule now)
  - UI-WP-004: Results screen position:fixed — 6th confirmed instance — this rule must ship now
  - UI-WP-006: `data-testid` must match element `id` or use consistent naming convention — add gen rule
  - UI-WP-009: Standardise Sentry SDK to 10.23.0 three-script pattern in gen prompts (word-pairs spec predates the update)

- **Test Engineering tasks:**
  - UI-WP-005 test gap: Verify pipeline tests don't assert `data-lives > 0` for word-pairs (non-lives game); add conditional assertion or skip lives assertion for games with `totalLives: 0`
  - UI-WP-008 test gap: Verify `lives-display` is not tested for visibility in word-pairs test suite; guard lives-related assertions with lives-mechanic detection
  - UI-WP-004 test gap: Add Playwright assertion verifying results-screen covers full viewport at data-phase='results'

- **Education tasks:**
  - UI-WP-007: Word-pairs spec should clarify whether a visible exposure countdown is required during the learn phase — update `games/word-pairs/spec.md` if it exists

- **CDN-blocked (no action):** UI-WP-010 (autoInject + slotId interaction depends on ScreenLayout runtime behaviour)
