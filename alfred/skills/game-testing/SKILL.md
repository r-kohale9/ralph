# Skill: Game Testing

## Purpose

Test a generated HTML game using Playwright MCP tools, fix every issue found immediately in the HTML, and report structured per-category results.

## When to use

After game-building produces index.html. Tests with Playwright MCP, fixes issues, reports results.

## Owner

**Maintainer:** Test Engineering slot
**Deletion trigger:** When testing is fully automated via a headless CI runner that replaces interactive Playwright MCP testing.

## Reads

- `data-contract.md` -- gameState schema, recordAttempt schema, game_complete postMessage schema, syncDOM contract, trackEvent schema — **ALWAYS**
- `skills/feedback/SKILL.md` -- FeedbackManager integration, timing rules, input blocking — **ON-DEMAND** (only for Category 2 mechanics checks)
- The game's `spec.md` -- round count, lives, scoring thresholds, interaction type — **ALWAYS**
- The game's `pre-generation/` directory (if it exists) -- game-flow.md, screens.md, round-flow.md, feedback.md, scoring.md — **ON-DEMAND** (only when verifying expected behavior)

## Input

- Path to the game's `index.html` file
- The game's spec (for expected round count, lives, scoring, interaction type)

## Output

Structured test results in three blocks: `TEST_RESULTS`, `CATEGORY_DETAIL` (one per category), and `ISSUES_FIXED`. The pipeline parses these blocks -- the format is not optional. See **Output Format** section below.

## Procedure

Use the Playwright MCP tools directly (`browser_navigate`, `browser_screenshot`, `browser_click`, `browser_console_messages`, `browser_type`, `browser_evaluate`, etc.) to interact with the game in the browser. Do NOT write Playwright test script files.

### Phase 1: Load and Observe

1. Navigate to the game: `file://<path-to-index.html>`
2. Take a screenshot of the initial state
3. Check the browser console for JS errors -- any error on load is a Category 1 failure
4. Verify `window.gameState` exists via `browser_evaluate`

### Phase 2: Test All 5 Categories

Execute categories in this order: game-flow → init-readiness → mechanics → level-progression → edge-cases → contract. Fix game-flow failures first — downstream categories depend on it.

Test every category in order. For EVERY issue found, fix it immediately in the HTML file, reload the page, and re-test. Do not defer fixes.

### Phase 3: Produce Output

After all testing and fixing is complete, emit the three output blocks in the exact format specified below.

---

## Category 1: game-flow

Test the full user journey from start to finish.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 1.1 | Page loads without JS errors | `browser_console_messages` after navigate | Zero error-level messages |
| 1.2 | Start screen renders | Screenshot after load | Title, instructions, and a start button are visible |
| 1.3 | Start button works | `browser_click` the start button, screenshot | Game transitions to gameplay phase (`data-phase` changes to `playing` or `gameplay`) |
| 1.4 | Round transitions | Play through at least 2 rounds via correct answers | Round counter increments, new content appears, previous round content is gone |
| 1.5 | Results screen | Play through all rounds (or trigger game end) | Results screen shows score, stars, and a Play Again button |
| 1.6 | Replay | Click Play Again, screenshot | Game resets to start screen, score is 0, `gameState.currentRound` is 0, `gameState.attempts` is empty |
| 1.7 | Timer (if applicable) | Observe timer element during gameplay and after game end | Timer starts on gameplay, stops on results/gameover |
| 1.8 | Preview screen appears | Screenshot after load, before clicking start | Preview screen is visible before gameplay begins |
| 1.9 | Preview header bar | Screenshot the preview screen header | Back button, avatar, question label, score, and star are visible in the header bar |
| 1.10 | Preview timer bar animates | Observe the timer bar on the preview screen | Timer bar animates from 100% to 0% width |
| 1.11 | Preview auto-advances | Wait for the preview timer to expire | Game auto-advances to gameplay when the timer ends |
| 1.12 | Preview skip button | Click the skip button on the preview screen | Preview is dismissed and game starts normally |
| 1.13 | Game starts after preview | Screenshot after preview ends (auto-advance or skip) | Game transitions to gameplay phase normally, no errors in console |

**Procedure:**

1. Load the page. Screenshot. Check console for errors.
2. Click the start button (or send `game_init` postMessage if the game waits for it).
3. Play through the entire game by clicking correct answers. Use `browser_evaluate(() => window.gameState.correctAnswer)` to find the correct answer each round.
4. Screenshot the results screen.
5. Click Play Again. Screenshot. Verify fresh state.

---

## Category 1.5: init-readiness (cold load)

The fail-open-gate bug class is invisible on warm reloads — the CDN bundle is in cache, every component class is defined synchronously, and the silently-swallowed `ReferenceError` from a missing class never fires. The bug only manifests on cold loads where `ScreenLayout` registers on `window` before `PreviewScreenComponent` (or any other late-loading component) does. This category catches that race.

**Run this category twice: once with cache enabled (warm), once with cache disabled (cold).** Compare results. A discrepancy is a cold-load bug.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 1.5.1 | Cold load — disable cache | `browser_navigate` with `Cache-Control: no-store`, OR Playwright `context.setExtraHTTPHeaders({ 'Cache-Control': 'no-store' })` + `route('**/*', r => r.continue({ headers: { ...r.request().headers(), 'Cache-Control': 'no-store' }}))`, OR start fresh Chromium with `--disable-cache`. Reload. | Page reloads with all CDN scripts re-fetched (verify via Network tab: 200 OK, not 304). |
| 1.5.2 | All required components instantiated | Within 5s of `DOMContentLoaded`, `browser_evaluate(() => ({ previewScreen: !!window.previewScreen, transitionScreen: !!window.transitionScreen, progressBar: !!window.progressBar, floatingBtn: !!window.floatingBtn, answerComponent: !!window.answerComponent }))`. Drop fields that the spec opted out of (`previewScreen: false`, `floatingButton: false`, `answerComponent: false`). | Every kept field is `true`. A `false` value means `waitForPackages` resolved before that class was defined → fail-open gate. |
| 1.5.3 | `data-phase` is not `gameplay` while preview is enabled | `browser_evaluate(() => document.getElementById('app').getAttribute('data-phase'))` immediately after load. Spec keeps preview unless `previewScreen: false`. | If preview is enabled: `data-phase` is `start_screen` or `preview`, NOT `gameplay`. The standalone fallback should NOT have run if `waitForPackages` succeeded. |
| 1.5.4 | No console errors during init | `browser_console_messages()` after the 5s readiness window. | Zero `error`-level messages. An `[XComponent ctor failed]` log indicates a missing class — re-check the readiness gate (`mandatory-components.md`). |
| 1.5.5 | Standalone fallback does not silently boot with missing components | `browser_evaluate(() => window.gameState.isActive)` immediately after fallback timer (2s). | If fallback fired with any required class undefined, the visible error UI is rendered and `gameState.isActive === false`. The fallback MUST NOT call `setupGame()` with a partial component graph (see `code-patterns.md` § Standalone fallback). |

**Procedure:**

1. Start the local server.
2. Open the page with cache disabled. Take a screenshot at `+0ms`, `+500ms`, `+2s`, `+5s` after `DOMContentLoaded`.
3. Run the 5 checks above.
4. If 1.5.2 fails (any expected component is `null` after 5s): the readiness gate is fail-open. Check `waitForPackages` body for `||` (validator: `GEN-WAITFORPACKAGES-NO-OR`) and missing typeof terms (`GEN-WAITFORPACKAGES-MISSING`). The validator should already have caught it — if it didn't, file a regression.
5. Run the same checks with cache enabled (warm). If results differ between cold and warm, the bug is a script-load race; the fix is in the readiness gate, not in init logic.

**Why this category exists:** age-matters, spot-the-pairs, and cross-logic all passed Categories 1–5 on warm reloads but shipped fail-open gates that only manifest on cold loads. This category is the runtime backstop for the validator's static checks.

---

## Category 2: mechanics

Test the core game interaction -- both correct and wrong answer paths.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 2.1 | Correct answer path | Click the correct answer, screenshot | Visual feedback fires (green highlight or FeedbackManager overlay), score increments by expected amount |
| 2.2 | Wrong answer path | Click a wrong answer, screenshot | Visual feedback fires (red highlight or FeedbackManager overlay), correct answer is revealed, life decrements (if lives game) |
| 2.3 | Score updates in real-time | `browser_evaluate(() => window.gameState.score)` before and after correct answer | Score value increments; displayed score matches `gameState.score` |
| 2.4 | Difficulty changes | Compare content between early and late rounds | If spec defines stages/difficulty progression, later rounds have harder content (larger numbers, more complex expressions, etc.) |
| 2.5 | Fallback content loads | `browser_evaluate(() => window.gameState.content)` | If no `game_init` was sent, fallbackContent rounds are used and display correctly |
| 2.6 | Game elements render | Screenshot during gameplay | All interactive elements (buttons, cards, grids, inputs) are visible and correctly sized |
| 2.7 | FeedbackManager integration | `browser_evaluate(() => typeof FeedbackManager !== 'undefined' && typeof FeedbackManager.sound.play === 'function')` | FeedbackManager loaded and initialized; `sound.play` and `playDynamicFeedback` methods exist |
| 2.8 | `isProcessing` blocks ALL inputs during awaited feedback | After clicking / dropping / submitting the round's answer, immediately poll `browser_evaluate(() => window.gameState.isProcessing)` while feedback audio is playing. Then attempt a second interaction via the game's active input channel (tap another option / start a new drag / submit again / trigger voice). Verify the second interaction is rejected: no new entry in `gameState.attempts`, no additional score change, no extra `answer_submitted` event. | `gameState.isProcessing === true` for the entire awaited SFX→TTS duration. Second interaction recorded 0 attempts. After audio resolves, `gameState.isProcessing === false` and input is accepted again. |
| 2.9 | Input block covers the game's actual input modality | Identify the game's pattern from its code (tap / drag path / DnD / directional drag / text input / voice). Verify the block applies to THAT modality, not just tap. For P6: attempt `dragstart` on a placed tag during feedback → rejected. For P7: attempt Enter keypress on the input during feedback → rejected. For P17: `browser_evaluate(() => window.voiceInput.isRecording)` during feedback → `false`, and attempt to trigger mic recording → rejected. For P5/P13: attempt `pointerdown` during feedback → no drag starts. | The pattern-specific input channel rejects input during `gameState.isProcessing === true`. No state mutation from the blocked interaction. |

**Procedure:**

1. Start a new game.
2. On round 1, click the CORRECT answer. Verify score increments. Screenshot.
3. On round 2, click a WRONG answer. Verify feedback, correct answer reveal, and life/score behavior. Screenshot.
4. Continue playing. Observe whether content changes between rounds.
5. After game ends, restart and verify fallback content is present without sending `game_init`.
6. **Input-during-feedback test (checks 2.8 and 2.9):** After submitting a round's answer, within the feedback window (awaited SFX→TTS, typically 2–4s):
   - Capture `attempts.length` immediately after the submit fires (call it N).
   - Poll `gameState.isProcessing` — must be `true`.
   - Trigger a second interaction via the game's pattern (tap another option / start a drag / press Enter / start mic).
   - Wait for the feedback audio to finish, then verify `attempts.length === N` (not N+1) and `events` contains no extra `answer_submitted` between the two measurements.
   - Verify `gameState.isProcessing === false` after audio resolves and a fresh interaction is now accepted.
   - If the game uses P17 (voice): also verify `voiceInput.isRecording === false` during the feedback window.
   - If the game uses P6 (DnD): also verify the board / draggable tags have `pointer-events: none` (either via `.dnd-disabled` class or direct style) during the feedback window.

---

## Category 3: level-progression

Test the round/level/progression system.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 3.1 | Round counter increments | `browser_evaluate(() => window.gameState.currentRound)` after each round | Value increments by 1 after each answer |
| 3.2 | Lives system (if applicable) | `browser_evaluate(() => window.gameState.lives)` after wrong answer | Lives decrement by 1; display (hearts/icons) matches `gameState.lives` |
| 3.3 | Game Over trigger | Answer wrong until lives reach 0 | Game transitions to `gameover` phase; `game_complete` postMessage fires |
| 3.4 | Star calculation | `browser_evaluate` on results screen to read stars | Stars match spec thresholds. Default: 0 (score=0), 1 (score>=1), 2 (score>=60%), 3 (score>=90%) |
| 3.5 | Total rounds match spec | `browser_evaluate(() => window.gameState.totalRounds)` | Value matches spec (e.g., 10) |
| 3.6 | Content changes between rounds | Compare question text or options across rounds 1, 2, and 3 | Content is different each round (not identical repeated content) |
| 3.7 | Game ends after all rounds | Play through every round correctly | Game transitions to `results` phase after the last round |

**Procedure:**

1. Start a game and play all rounds correctly. Verify round counter increments and game ends properly.
2. Restart. Intentionally answer wrong on every round. Verify lives decrement and game-over triggers at 0 lives.
3. Restart. Play a mixed game (some right, some wrong) to verify star calculation on the results screen.

---

## Category 4: edge-cases

Test boundary conditions and error handling.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 4.1 | Rapid clicking | Click the same answer button 5 times quickly | Only one attempt is recorded (`gameState.attempts.length` increments by 1, not 5). `gameState.isProcessing` guard works. |
| 4.2 | Disabled elements | Click an already-answered option or a disabled element | No effect -- no error, no extra attempt recorded |
| 4.3 | Viewport 320px | `browser_evaluate` to resize to 320px width, screenshot | Game content is visible, no horizontal scroll, no overlapping elements |
| 4.4 | Viewport 414px | `browser_evaluate` to resize to 414px width, screenshot | Game content is visible, properly laid out |
| 4.5 | No JS errors during full playthrough | `browser_console_messages` after completing the entire game | Zero error-level messages from start to finish |
| 4.6 | Clicks during transitions | Click rapidly during round transitions and feedback | No crash, no double-advance, no skipped rounds |
| 4.7 | No runaway intervals after game end | After game completes: `browser_evaluate(() => { let count = 0; const orig = clearInterval; return 'check manual'; })` -- instead, wait 5 seconds after game end and check for console errors or performance issues | No console errors accumulating after game end. Alternatively, verify `setInterval` IDs are cleared in `endGame`. |

**Procedure:**

1. During gameplay, rapidly click the same answer 5 times. Check `gameState.attempts.length`.
2. After answering, click the disabled/answered option again. Check nothing changes.
3. Resize the viewport to 320px and 414px, screenshot each.
4. Play through the full game. Check console messages at the end.
5. After the game ends (results screen), wait a few seconds and check console for new errors.

---

## Category 5: contract

Test the platform integration contract. This is the most critical category -- every field matters.

### 5.1 gameState existence and required fields

Run `browser_evaluate(() => window.gameState)` and verify every required field exists with the correct type and initial value.

| Field | Expected type | Expected initial value |
|-------|---------------|------------------------|
| `gameId` | `string` | Non-empty string matching the game slug |
| `phase` | `string` | `'start_screen'` or `'start'` |
| `currentRound` | `number` | `0` |
| `totalRounds` | `number` | Matches spec (e.g., `10`) |
| `score` | `number` | `0` |
| `attempts` | `Array` | `[]` (length 0) |
| `events` | `Array` | `[]` (length 0) |
| `startTime` | `number` or `null` | `null` |
| `isActive` | `boolean` | `false` |
| `content` | `object` or `null` | `null` |
| `duration_data` | `object` | Has sub-fields: `startTime`, `preview`, `attempts`, `evaluations`, `inActiveTime`, `totalInactiveTime`, `currentTime` |
| `isProcessing` | `boolean` | `false` |
| `gameEnded` | `boolean` | `false` |

**Conditional fields (verify only when applicable):**

| Field | Expected type | When required |
|-------|---------------|---------------|
| `lives` | `number` | Lives-based games (spec defines totalLives > 0) |
| `totalLives` | `number` | Lives-based games |
| `correctAnswer` | `any` | Set each round (not at init) |

### 5.2 Window-exposed functions

Run `browser_evaluate` to check each function exists:

| Function | Check |
|----------|-------|
| `window.gameState` | `typeof window.gameState === 'object'` |
| `window.endGame` | `typeof window.endGame === 'function'` |
| `window.restartGame` | `typeof window.restartGame === 'function'` |
| `window.startGame` | `typeof window.startGame === 'function'` |

### 5.3 syncDOM attributes on #app

Verify `#app` element has the correct `data-*` attributes at each phase:

| Phase | Required attributes | How to verify |
|-------|---------------------|---------------|
| Start screen | `data-phase="start_screen"` (or `"start"`), `data-score="0"` | `browser_evaluate(() => document.getElementById('app').dataset)` |
| Playing | `data-phase="playing"` (or `"gameplay"`), `data-score` updated on correct answer | Check after answering correctly |
| Results | `data-phase="results"`, `data-score` matches final score | Check on results screen |
| Game Over | `data-phase="gameover"` (or `"game_over"`), `data-lives="0"` | Check after lives exhaustion |

For lives games, also verify `data-lives` decrements on wrong answers.
For all games, verify `data-round` updates each round (recommended attribute).

### 5.4 game_complete postMessage

This is the most critical contract check. Listen for the postMessage and verify the exact structure.

**Setup listener before triggering game end:**

```javascript
// Via browser_evaluate:
window.__gameCompleteCapture = null;
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'game_complete') {
    window.__gameCompleteCapture = e.data;
  }
});
```

**After game ends, verify the captured message:**

```javascript
// Via browser_evaluate:
const msg = window.__gameCompleteCapture;
```

**Required structure:**

```
{
  type: 'game_complete',          // exact string
  data: {
    metrics: {
      accuracy: <number 0-100>,   // integer, not float 0.0-1.0
      time: <number>,             // seconds (not ms)
      stars: <number 0-3>,        // integer
      attempts: <Array>,          // full gameState.attempts array
      duration_data: <object>,    // full gameState.duration_data object
      totalLives: <number>,       // lives remaining (or null/omitted for non-lives games)
      tries: <Array>,             // [{round: 1, correct: true}, ...]
    },
    completedAt: <number>         // epoch ms -- SIBLING of metrics, not inside metrics
  }
}
```

**Field-by-field checks:**

| Field path | Type | Validation |
|------------|------|------------|
| `type` | `string` | Exactly `'game_complete'` |
| `data` | `object` | Exists, is not null |
| `data.metrics` | `object` | Exists, is not null |
| `data.metrics.accuracy` | `number` | Integer 0-100 (not a float like 0.7) |
| `data.metrics.time` | `number` | Positive integer, in seconds |
| `data.metrics.stars` | `number` | Integer 0-3 |
| `data.metrics.attempts` | `Array` | Length > 0, each element has recordAttempt fields |
| `data.metrics.duration_data` | `object` | Has `startTime`, `attempts`, `inActiveTime`, `totalInactiveTime` |
| `data.metrics.totalLives` | `number` or `null` | Lives remaining at end (for lives games) |
| `data.metrics.tries` | `Array` | Each element has `round` (number) and `correct` (boolean) |
| `data.completedAt` | `number` | Epoch ms (>1600000000000), is a sibling of `data.metrics` (NOT nested inside metrics) |

**Verify game_complete fires on BOTH paths:**

1. Play to victory (all rounds correct) -- verify postMessage fires
2. Play to game over (all rounds wrong, lives reach 0) -- verify postMessage fires

If `game_complete` only fires on one path, that is a contract violation (GEN-PM-DUAL-PATH).

### 5.5 recordAttempt fields

After playing at least one round, inspect `gameState.attempts[0]` and verify every required field:

| Field | Type | Validation |
|-------|------|------------|
| `attempt_timestamp` | `number` | Epoch ms (>1600000000000) |
| `time_since_start_of_game` | `number` | Positive number (ms since game start) |
| `input_of_user` | `any` | Not undefined, not null -- represents what the student selected |
| `correct` | `boolean` | `true` or `false` |
| `round_number` | `number` | 1-indexed (first round = 1, not 0) |
| `question_id` | `string` | Non-empty string |
| `correct_answer` | `any` | Not undefined |
| `response_time_ms` | `number` | Positive number (ms from question display to submission) |
| `misconception_tag` | `string` or `null` | `null` if correct; string if wrong and spec defines misconceptions |
| `difficulty_level` | `number` | Positive integer |
| `is_retry` | `boolean` | `true` or `false` |
| `metadata` | `object` | Exists, is an object |

### 5.6 trackEvent calls

After playing through the game, inspect `gameState.events` and verify:

| Event | When | Required fields in event object |
|-------|------|---------------------------------|
| `game_start` | After start button clicked | `event: 'game_start'`, `timestamp: <number>`, `totalRounds: <number>` |
| `game_end` | After endGame fires | `event: 'game_end'`, `timestamp: <number>`, `score: <number>`, `lives: <number>`, `stars: <number>`, `rounds_played: <number>` |
| `answer_submitted` | After each answer | `event: 'answer_submitted'`, `timestamp: <number>`, `round: <number>`, `correct: <boolean>`, `response_time_ms: <number>` |

Verify at minimum: one `game_start` event, one `game_end` event, and at least one `answer_submitted` event exist in the array.

### 5.7 game_init postMessage handling

Verify the game handles inbound `game_init` messages:

```javascript
// Via browser_evaluate -- send a game_init message:
window.postMessage({
  type: 'game_init',
  data: {
    content: { rounds: [] },
    config: {}
  }
}, '*');
```

After sending, verify `gameState.phase` changes to `'playing'` as the FIRST action (the test harness depends on this).

### 5.8 PreviewScreen contract

Verify the PreviewScreen SDK component is correctly integrated.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 5.8.1 | ScreenLayout.inject includes previewScreen | `browser_evaluate(() => document.querySelector('[data-preview-screen]') !== null)` or inspect inject call in source | `previewScreen: true` is passed to `ScreenLayout.inject` |
| 5.8.2 | PreviewScreenComponent instantiated | `browser_evaluate(() => typeof window.previewScreen !== 'undefined')` | PreviewScreenComponent is instantiated after `ScreenLayout.inject` |
| 5.8.3 | Preview → game transition fires | Wait for preview, skip via `window.previewScreen.skip()` or click the skip button, observe `gameState.phase`/`gameState.isActive` | Transition completes; `gameState.isActive === true` and a gameplay round renders (function names are per-game; no specific `showPreviewScreen` global required) |
| 5.8.4 | previewScreen.show() receives correct params | Inspect source for the `previewScreen.show(...)` call | `instruction` and `audioUrl` are passed from content. Drifted names (`previewContent`, `autoInject`, `gameContentId`, `timerConfig`, `timerInstance`) must NOT appear. |
| 5.8.5 | startTime not set until preview ends | `browser_evaluate(() => window.gameState.startTime)` immediately after preview appears | `gameState.startTime` is `null` during preview; set only after preview ends |
| 5.8.6 | duration_data.preview populated | `browser_evaluate(() => window.gameState.duration_data.preview)` after preview ends | `duration_data.preview` is an array with at least one entry |
| 5.8.7 | fallbackContent includes preview fields | `browser_evaluate` to inspect fallbackContent in source | `previewInstruction` and `previewAudioText` are present in fallbackContent |
| 5.8.8 | Next-tap destroys preview | `browser_evaluate(() => window.previewScreen)` after the player taps Next on the end screen | The FloatingButton `on('next', ...)` handler calls `previewScreen.destroy()` — reference is cleaned up or component is removed from DOM. (Destroy MUST NOT run inside `endGame()` — that kills the async `show_star` animation before it lands.) |
| 5.8.9 | Game DOM rendered before preview mounts | At preview mount time, `browser_evaluate(() => document.querySelector('#gameContent').children.length > 0)` | `#gameContent` is populated BEFORE `previewScreen.show()` — preview overlay covers real content, not empty space |
| 5.8.10 | restartGame does not re-mount preview | Complete a game, click Play Again / Try Again, observe | Preview overlay is NOT shown on restart; gameplay round renders directly. `restartGame()` source contains no `previewScreen.show` and no `setupGame()` call |
| 5.8.11 | Wrapper persists through Victory / Game Over | After Victory and after Game Over transitions mount (wait for `transitionScreen.show` Promise to resolve → stable DOM), `browser_evaluate(() => { const s = document.getElementById('mathai-preview-slot'); const h = s && s.querySelector('.mathai-preview-header'); return s && getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden' && !s.hasAttribute('hidden') && s.querySelector('.game-stack > #gameContent') !== null && h && h.offsetHeight > 0; })` | Preview slot still in DOM; `display`, `visibility`, `hidden` attr all clean; `.game-stack > #gameContent` parent chain intact; `.mathai-preview-header` rendering with `offsetHeight > 0` (header not collapsed). Catches the "hide header only" hack |
| 5.8.12 | `#gameContent` parent unchanged | At `setupGame` exit capture `window.__gcParent = document.getElementById('gameContent').parentElement;` then on every phase transition `browser_evaluate(() => document.getElementById('gameContent').parentElement === window.__gcParent)` | Parent reference is identical across every phase (Preview, Round N, Feedback, Victory, Game Over, Play Again). No re-parenting at runtime |
| 5.8.13 | `destroy()` only at Next-tap | After Victory + before tapping Next: `browser_evaluate(() => typeof window.previewScreen.pause === 'function' && window.previewScreen.getState() !== 'destroyed')` returns true. Then tap Next, wait for `next_ended` postMessage, then re-check — state should be unresponsive. | PreviewScreen component still responsive through the entire end-screen viewing period (header + `#previewStar` mounted while `show_star` animation lands). Only after the player taps Next does `previewScreen.destroy()` run inside the FloatingButton `on('next', ...)` handler |
| 5.8.14 | `startTime` gated on preview end | While `previewScreen.getState() === 'preview'`: `browser_evaluate(() => window.gameState.startTime)` | `null`. Becomes a timestamp only after `onComplete` fires and `startGameAfterPreview` runs |
| 5.8.15 | VisibilityTracker pauses/resumes preview | Before load, inject a spy: `window.__pauseCalls = 0; ...`. Fire `document.dispatchEvent(new Event('visibilitychange'))` with `document.hidden = true`, then `false`. | `previewScreen.pause()` and `previewScreen.resume()` both invoked; during hidden phase preview timer does not advance |

### 5.9 SignalCollector contract

Verify the SignalCollector integration for analytics event flushing.

| # | Check | How to verify | Pass criteria |
|---|-------|---------------|---------------|
| 5.9.1 | signalCollector accessible | `browser_evaluate(() => typeof window.signalCollector !== 'undefined')` | `window.signalCollector` exists and is an object |
| 5.9.2 | startFlushing called after game_init | `browser_evaluate(() => window.signalCollector._flushing)` or inspect source for `startFlushing()` call | `signalCollector.startFlushing()` is called after `game_init` sets `flushUrl` |
| 5.9.3 | recordViewEvent on transitions | `browser_evaluate(() => window.signalCollector._events)` after screen transitions | `signalCollector.recordViewEvent()` is called on screen transitions (start → playing, playing → results) |
| 5.9.4 | seal called in endGame | Inspect source or `browser_evaluate` after game ends | `signalCollector.seal()` is called in `endGame` before `postMessage` |
| 5.9.5 | game_complete includes signal data | Inspect captured `game_complete` message | `data` includes `signal_event_count` (number) and `signal_metadata` (object) |

---

## Fix Procedure

When any check fails:

1. **Identify the root cause** in the HTML/JS source
2. **Fix it immediately** -- edit the `index.html` file directly
3. **Reload the page** in the browser
4. **Re-test the specific check** that failed
5. **Record the fix** in the ISSUES_FIXED block

Do not move to the next category until all fixable issues in the current category are resolved.

If an issue cannot be fixed without changing the spec (e.g., the spec says 10 rounds but only 5 rounds of fallback content exist), note it as `[FAIL]` with the reason and move on.

---

## Output Format

After ALL testing and fixing is complete, emit results in EXACTLY this format. The pipeline parser reads these blocks -- do not alter the structure.

### Block 1: TEST_RESULTS

```
TEST_RESULTS:
game-flow: <passed>/<total>
mechanics: <passed>/<total>
level-progression: <passed>/<total>
edge-cases: <passed>/<total>
contract: <passed>/<total>
```

### Block 2: CATEGORY_DETAIL (one per category)

```
CATEGORY_DETAIL: game-flow
- [PASS] Page loads without JS errors
- [PASS] Start screen renders with title and start button
- [FAIL] Replay does not reset attempts array (FIXED)
- [PASS] Results screen shows score and stars

CATEGORY_DETAIL: mechanics
- [PASS] Correct answer highlights green and increments score
- [PASS] Wrong answer reveals correct answer
...

CATEGORY_DETAIL: level-progression
- [PASS] Round counter increments correctly
- [SKIP] Lives system -- not a lives game
...

CATEGORY_DETAIL: edge-cases
- [PASS] Rapid clicking records only one attempt
- [PASS] No JS errors in console during playthrough
...

CATEGORY_DETAIL: contract
- [PASS] window.gameState exists with all required fields
- [PASS] game_complete postMessage has correct nested structure
- [FAIL] recordAttempt missing response_time_ms (FIXED)
...
```

Each line starts with `- [PASS]`, `- [FAIL]`, or `- [SKIP]` followed by a description. Append `(FIXED)` to any `[FAIL]` that was fixed during testing -- the pipeline counts these.

### Block 3: ISSUES_FIXED

```
ISSUES_FIXED:
- Replay did not reset gameState.attempts to empty array -- added attempts=[] in restartGame
- recordAttempt was missing response_time_ms -- added roundStartTime tracking and calculation
- game_complete postMessage had accuracy as float 0.7 instead of integer 70 -- changed to Math.round((score/totalRounds)*100)
```

Each line is a plain-English description of what was wrong and what was changed. If no issues were found, output:

```
ISSUES_FIXED:
- None
```

---

## Constraints

1. **CRITICAL — Use Playwright MCP tools directly.** Do not write `.spec.js` test files. Interact with the browser via `browser_navigate`, `browser_click`, `browser_evaluate`, `browser_screenshot`, `browser_console_messages`, etc.
2. **CRITICAL — Test ALL 5 categories.** Every category must appear in the output. Skipping a category is not allowed.
3. **STANDARD — Fix immediately.** When a test fails, fix it in the HTML before continuing. Do not collect issues and fix them later.
4. **STANDARD — Verify the fix.** After every fix, reload and re-test. A fix that is not re-verified does not count.
5. **CRITICAL — Use correctAnswer to drive testing.** Read `window.gameState.correctAnswer` each round to find the right answer. Do not guess or hardcode clicks.
6. **CRITICAL — Play the full game.** Do not stop at round 2. Play through to the results screen at least once. Play to game over at least once (if lives game).
7. **CRITICAL — game_complete must fire on both paths.** Test victory AND game-over. If the game has no lives system, test only the victory path but verify the results screen triggers the postMessage.
8. **CRITICAL — Output format is not optional.** The pipeline parser (`_parseCategoryResults`) reads `TEST_RESULTS:`, `CATEGORY_DETAIL:`, and `ISSUES_FIXED:` blocks with regex. Malformed output means the pipeline cannot score the build.

## Defaults

- If the spec does not define star thresholds, use: 0 stars (score=0), 1 star (score>=1), 2 stars (score>=60%), 3 stars (score>=90%).
- If the spec does not define lives, skip lives-related checks in Categories 3 and 5. Mark them `[SKIP]`.
- If the spec does not define difficulty progression, skip check 2.4 (difficulty changes). Mark it `[SKIP]`.
- If `pre-generation/` does not exist, rely on the spec alone for expected behavior.
- If the game has no timer, skip check 1.7. Mark it `[SKIP]`.

## Anti-patterns

1. **Writing Playwright test scripts.**

   **Bad:** Creating a file `tests/game.spec.js` with `test('game loads', async ({ page }) => { ... })` and running it with `npx playwright test`.

   **Good:** Using `browser_navigate('file:///tmp/game/index.html')` followed by `browser_screenshot()` and `browser_evaluate(() => window.gameState)` interactively via MCP tools.

2. **Testing visual quality.** Visual polish, color choices, animation smoothness, and layout aesthetics are the review skill's job, not this one. This skill tests functionality and contract compliance only.

3. **Stopping after the first failure.**

   **Bad:** Category 1 check 1.3 (start button) fails. Tester reports "game-flow failed" and stops without testing Categories 2-5.

   **Good:** Category 1 check 1.3 fails. Tester fixes the start button, reloads, re-tests 1.3, then continues through all 5 categories.

4. **Guessing correct answers.**

   **Bad:** Clicking the first option button every round and hoping it is correct.

   **Good:** Running `browser_evaluate(() => window.gameState.correctAnswer)` each round, then clicking the matching option.

5. **Skipping the game-over path.** Many contract bugs only manifest on game-over (e.g., `game_complete` not firing, `gameover` phase not set). Always test both victory and game-over if the game has lives.

6. **Reporting issues without fixing them.** If an issue is fixable in the HTML (code bug, missing field, wrong value), fix it. Only report as `[FAIL]` without `(FIXED)` when the fix requires spec changes or is outside the HTML scope.

7. **Flat game_complete payload.**

   **Bad:** Seeing `postMessage({ type: 'game_complete', score: 7, stars: 2 })` and marking contract check as PASS because the message exists.

   **Good:** Verifying the message has `data.metrics.accuracy`, `data.metrics.stars`, `data.metrics.attempts`, and `data.completedAt` at the correct nesting depth.

8. **Accepting accuracy as a float.**

   **Bad:** `accuracy: 0.7` in the game_complete payload. Marking PASS because "the accuracy value is present."

   **Good:** Checking that `accuracy` is an integer 0-100 (e.g., `70`), not a decimal 0.0-1.0. Fixing the HTML to use `Math.round((score/totalRounds)*100)`.
