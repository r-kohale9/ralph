# UI/UX Audit — Word Pairs

**Build:** #529  **Date:** 2026-03-23  **Auditor:** UI/UX slot (full browser playthrough — Playwright MCP, GCP HTML download)

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

---

## Browser Playthrough — Build #529 (Full)

**Date:** 2026-03-23
**Method:** Playwright MCP — full end-to-end playthrough (start → 3 rounds → results → restart)
**Build URL:** `https://storage.googleapis.com/mathai-temp-assets/games/word-pairs/builds/529/index.html`
**Console errors:** 0 (across full playthrough)
**Console warnings:** 16 (all FeedbackManager subtitle + SignalCollector no-problem-state)

### Summary

**No P0 flow blockers.** Results screen is reachable. All 3 rounds completable. However, CSS strip (UI-WP-001) causes all buttons to render at browser-default 21.5px — far below the 44px minimum — which is a P0 touch target failure in production. Two additional HIGH issues found: `restartGame()` leaves stale `data-round`/`data-score` DOM attributes, and the results screen element lacks `data-phase`/`data-testid` attributes that tests rely on.

| Severity | Count | Action |
|----------|-------|--------|
| P0 | 1 | CSS-strip-caused touch target failure — same root cause as UI-WP-001 |
| HIGH | 2 | Test harness impact (stale DOM attrs, missing results-screen testid) |
| MEDIUM | 2 | SignalCollector warnings, waitForPackages 120s vs 180s |
| PASS | 8 | Full flow, endGame guard, score accuracy, restartGame visual reset, progress bar |

**Verdict: No new re-queue required.** Flow is intact. All existing static issues (UI-WP-001 through UI-WP-010) confirmed live. New findings are HIGH/MEDIUM test-engineering concerns.

---

### UI-WP-B-001 — All buttons render at 21.5px — CSS strip causes P0 touch target failure [P0] (a)

**Description:** Every button in the game (Submit, Play Again / btn-restart) renders at 21.5px height — the browser default. This is 51% below the 44px minimum required for touch targets. Live measurement: `btn-submit height=21.5px, minHeight=0px; btn-restart height=21.5px, minHeight=0px`. The input field is also 21.5px.

**Root cause:** Direct consequence of UI-WP-001 (CSS fully stripped). Without custom CSS, all sizing rules are absent.

**Evidence:** Live DOM measurement during recall phase: `getBoundingClientRect().height = 21.5` for both Submit and Play Again buttons.

**Classification:** (a) gen prompt rule — same fix as UI-WP-001. Once CSS strip is prevented, button `min-height: 44px` rules will apply. This is not a separate gen rule — it is a symptom of the CSS strip bug.

---

### UI-WP-B-002 — restartGame() leaves stale data-round / data-score on #app [HIGH] (a)

**Description:** After clicking Play Again, `#app[data-round]` retains the previous game's value ("3") and `#app[data-score]` retains "11". These are not reset by `restartGame()` before `syncDOMState()` is called with the new game state. The visual reset is correct (TransitionScreen covers the viewport), but the underlying DOM attributes are stale until the player clicks "I'm ready!" and the new game starts.

**Evidence:** Immediately after Play Again click: `app[data-round]="3"`, `app[data-score]="11"`, `gameState.currentRound=3`, `gameState.score=11`. The TransitionScreen component is overlaid so the user sees the correct start screen, but `#app` has stale data.

**Impact:** Any test that checks `data-round="0"` or `data-score="0"` immediately after the restart button click (before the player starts the new game) will fail.

**Classification:** (a) gen prompt rule — "In `restartGame()`, call `syncDOMState()` after resetting `gameState` fields to ensure `#app[data-round]`, `#app[data-score]`, and `#app[data-phase]` are immediately zeroed."

---

### UI-WP-B-003 — results-screen element missing data-phase="results" and data-testid [HIGH] (a)

**Description:** The `#results-screen` element has only `id="results-screen"`, `class="game-block"` — no `data-phase="results"` and no `data-testid="results-screen"`. Tests that assert `[data-phase="results"]` on the results screen element (not `#app`) will not find the attribute. `#app[data-phase]` correctly becomes `"results"` at game end — but the results screen element itself is untagged.

**Evidence:** `resultsScreen.attributes = { id: "results-screen", class: "game-block", style: "display:flex" }` — no data-phase, no data-testid.

**Classification:** (a) gen prompt rule — "The `#results-screen` element must have `data-phase=\"results\"` and `data-testid=\"results-screen\"`."

---

### UI-WP-B-004 — results-screen position:static, height 225px, does not cover 800px viewport [HIGH] (a)

**Description:** Confirmed live: `#results-screen` has `position: static`, height 225.8px against an 800px viewport. When results appear, the screen renders in document flow without covering prior content. If the user has scrolled during the recall phase, the results screen will be partially or fully off-screen.

**Evidence:** `resultsScreen.position="static"`, `viewportHeight=800`, `elementHeight=225.8`, `coversViewport=false`. Same as UI-WP-004 static finding — now live-confirmed.

**Classification:** (a) gen prompt rule — "Results screen must use `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999` to guarantee full-viewport coverage." (8th confirmed instance across audit batch — rule must ship now.)

---

### UI-WP-B-005 — SignalCollector "No problem state" warnings during gameplay [MEDIUM] (d)

**Description:** 3 `[SignalCollector] No problem state for: ...` warnings during the playthrough. Appears on wrong-answer submissions and at round boundary. This indicates `recordAttempt()` or `endProblem()` is being called for a problem ID that was not started with `startProblem()`. Non-fatal but indicates signal data integrity issues.

**Evidence:** Console warning events during rounds 1 and 2 recall phases.

**Classification:** (d) test gap — investigate which recall question paths skip `startProblem()`. May be a timing issue on the wrong-answer path where `endProblem()` is called before `startProblem()` fires for the next question.

---

### UI-WP-B-006 — waitForPackages timeout 120000ms, below 180000ms standard [MEDIUM] (a)

**Description:** `waitForPackages` uses `const timeout = 120000` (2 minutes). The pipeline standard is 180000ms (3 minutes). This build predates the 180000ms rule — it uses 120000ms which is above the 10000ms bug threshold (F1 in visual-memory #528). Non-critical for this build but inconsistent with the standard.

**Evidence:** Inline script: `const timeout = 120000; let elapsed = 0; if (elapsed >= timeout) { ... }`.

**Classification:** (a) gen prompt rule — "waitForPackages timeout must be exactly 180000ms." This is an existing rule that needs reinforcement.

---

### UI-WP-B-007 — FeedbackManager subtitle not rendered (CDN constraint, confirmed live) [LOW] (c)

**Description:** `[FeedbackManager] Subtitle component not loaded, skipping` warning fired 16 times during the playthrough (once per answer submission). Subtitles never appear. Confirmed live — same as static finding UI-WP-010 note.

**Evidence:** 16 console warnings of this type across full playthrough.

**Classification:** (c) CDN constraint — known limitation. No gen rule needed. SubtitleComponent initialization issue in CDN packages.

---

### Checklist Results

| Check | Result |
|-------|--------|
| Start screen visible, "I'm ready!" button renders | PASS (CSS stripped but button functional) |
| Learn phase: auto-advances through all pairs | PASS |
| Recall phase: text input accepts answers | PASS |
| Correct answer → FeedbackManager audio + advance | PASS |
| Wrong answer → FeedbackManager audio + advance (no life loss — no lives mechanic) | PASS |
| Round transition screen appears with Continue button | PASS |
| All 3 rounds completable end-to-end | PASS |
| Results screen reachable | PASS (3/3 rounds → results shown) |
| gameState.gameEnded = true at results | PASS |
| endGame() guard: only gameEnded check, no !isActive block | PASS |
| Score/accuracy correct: 11/12 = 92% | PASS |
| Progress bar updates 0/3 → 1/3 → 2/3 → 3/3 | PASS |
| restartGame() shows start screen visually | PASS |
| restartGame() resets DOM data-round/data-score immediately | FAIL (UI-WP-B-002) |
| Button touch targets ≥44px (Submit, Play Again) | FAIL (21.5px — UI-WP-B-001 / CSS strip) |
| Input field touch target ≥44px | FAIL (21.5px — CSS strip) |
| results-screen has data-phase="results" | FAIL (UI-WP-B-003) |
| results-screen has data-testid="results-screen" | FAIL (UI-WP-B-003) |
| results-screen position:fixed covers viewport | FAIL (UI-WP-B-004 / UI-WP-004) |
| feedback-area has aria-live="polite" | FAIL (UI-WP-003 — confirmed live) |
| Console PAGEERROR during full playthrough | PASS (0 errors) |
| SignalCollector clean (no problem state warnings) | FAIL (3 warnings — UI-WP-B-005) |
| waitForPackages timeout = 180000ms | FAIL (120000ms — UI-WP-B-006) |
| FeedbackManager subtitle renders | FAIL (CDN constraint — UI-WP-B-007) |

---

### Action Required

#### New Gen Quality routes (browser-confirmed)
- **UI-WP-B-002:** Add gen rule: "In `restartGame()`, call `syncDOMState()` immediately after resetting gameState fields so `#app[data-round]`, `#app[data-score]`, `#app[data-lives]` are zeroed before TransitionScreen overlay."
- **UI-WP-B-003:** Add gen rule: "`#results-screen` element must have `data-phase=\"results\"` attribute and `data-testid=\"results-screen\"`."
- **UI-WP-B-004:** Reinforce position:fixed rule for results screen — 8th confirmed instance. This rule must be in CDN_CONSTRAINTS_BLOCK as a hard mandatory rule.

#### Test Engineering routes
- **UI-WP-B-005:** Investigate `SignalCollector` "No problem state" warnings. Check whether wrong-answer path calls `endProblem()` before `startProblem()` on next question.
- **UI-WP-B-002 test impact:** Add guard to test assertions — do not assert `data-round="0"` on `#app` immediately post-restart; assert after "I'm ready!" click.
