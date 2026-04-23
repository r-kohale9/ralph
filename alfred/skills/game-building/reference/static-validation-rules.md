# Static Validation Rules Index

Complete index of every check in `validate-static.js` (T1 layer), mapped to the Alfred skill that covers its knowledge.

---

## HTML Structure

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 1-DOCTYPE | `<!DOCTYPE html>` present | error | game-building (html-template) | Covered |
| 1-HTML | `<html` root element present | error | game-building (html-template) | Covered |
| 1-HEAD | `<head` element present | error | game-building (html-template) | Covered |
| 1-BODY | `<body` element present | error | game-building (html-template) | Covered |
| 2-GAMECONTENT | `#gameContent` container or `ScreenLayout.inject()` call | error | game-building (html-template) | Covered |
| 10-TOO-SMALL | File < 1000 chars (incomplete generation) | error | -- | Linter-only |
| 10-TOO-LARGE | File > 500000 chars | warning | -- | Linter-only |
| 10-TRUNCATED | Missing `</html>` closing tag | error | -- | Linter-only |

## Global Functions

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 3-INITGAME | `initGame()` or CDN DOMContentLoaded or postMessage `setupGame()` | error | game-building (code-patterns) | Covered |
| 3-HANDLER | Interaction handler function (handle*/check*/select*/addEventListener) | error | game-building (code-patterns) | Covered |
| 3-ENDGAME | `endGame()` function declaration | error | game-building (code-patterns), data-contract | Covered |
| 3-ASYNC | endGame/handleGameOver/etc. using `await` but not declared `async` | error | game-building (code-patterns) | Covered |

## Single-File Constraint

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 4-STYLE | `<style>` block present | error | game-building (html-template) | Covered |
| 4-SCRIPT | `<script>` block present | error | game-building (html-template) | Covered |
| 4-EXT-CSS | External CSS `<link>` forbidden | error | game-building (html-template) | Covered |
| 4-EXT-SCRIPT | Local relative `<script src>` forbidden | error | game-building (html-template) | Covered |

## Forbidden Patterns / Hallucination Bans

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5-DOCWRITE | `document.write()` forbidden | error | -- | Linter-only |
| 5-ALERT | `alert()` forbidden (use aria-live div) | error | game-building, mobile | Covered |
| 5-INLINE-HANDLER | Inline `onclick=` etc. in HTML attributes | warning | game-building (code-patterns) | Covered |
| 5j-MIRA | `window.mira.components` namespace hallucination | error | game-building (code-patterns) | Covered |
| 5k-NAMESPACE | `window.cdn.*` / `window.mathai.*` / `window.Ralph.*` / `window.homeworkapp.*` hallucinations | error | game-building (code-patterns) | Covered |
| 5l-REQUIRE | `require()` used to load CDN packages | error | game-building (html-template) | Covered |
| 5l-IMPORT | ES module `import` for CDN packages | error | game-building (html-template) | Covered |
| GEN-LOCAL-ASSETS | Local asset paths (`assets/`, `images/`, `../`) will 404 in prod | error | game-building, mobile | Covered |

## CDN / Packages

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5c-TIMEOUT | `waitForPackages()` must throw on timeout | error | game-building (code-patterns) | Covered |
| 5c-SHORT-TIMEOUT | `waitForPackages()` timeout < 120000ms | error | game-building (code-patterns) | Covered |
| 5c2-NO-CDN-TAG | `waitForPackages()` present but no CDN `<script src>` tag | error | game-building (html-template) | Covered |
| 5c3-BANNED-NAMES | `waitForPackages()` checks hallucinated names (Components, Helpers, Utils, Module, Lib) | error | game-building (code-patterns) | Covered |
| 5fa-WRONG-CHECK | `while (!FeedbackManager)` instead of `typeof === 'undefined'` | error | game-building (code-patterns) | Covered |
| 5h2-SENTRYHELPER | `typeof SentryHelper` in waitForPackages (not a real CDN global) | error | game-building (code-patterns) | Covered |
| GEN-WAITFOR-MATCH-A | typeof FeedbackManager in waitForPackages but no feedback-manager script in `<head>` | error | game-building (html-template, code-patterns) | Covered |
| GEN-WAITFOR-MATCH-B | new TimerComponent() used but typeof not in waitForPackages | warning | game-building (code-patterns) | Covered |
| GEN-WAITFOR-MATCH-C | new ProgressBarComponent() used but typeof not in waitForPackages | warning | game-building (code-patterns) | Covered |
| GEN-WAITFOR-MATCH-D | new TransitionScreenComponent() used but typeof not in waitForPackages | warning | game-building (code-patterns) | Covered |
| 5f3-TIMER-TYPEOF | TimerComponent used but no typeof guard in waitForPackages | error | game-building (code-patterns) | Covered |
| 5f3-TRANSITION-TYPEOF | TransitionScreenComponent used but no typeof guard | error | game-building (code-patterns) | Covered |
| 5f3-PROGRESS-TYPEOF | ProgressBarComponent used but no typeof guard | error | game-building (code-patterns) | Covered |
| 5f3-SIGNAL-TYPEOF | SignalCollector used but no typeof guard | error | game-building (code-patterns) | Covered |

## FeedbackManager

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5b2-REGISTER | `sound.register()` forbidden (use `sound.preload`) | error | feedback | Covered |
| PART-011-SOUND | `FeedbackManager.sound.playDynamicFeedback()` does not exist; use top-level | error | feedback | Covered |

## TransitionScreen

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| PART-025-HIDE | `transitionScreen.show()` without `transitionScreen.hide()` | error | game-building (code-patterns) | Covered |
| 5h-AWAIT | Unawaited `transitionScreen.show()` calls | error | game-building (code-patterns) | Covered |
| GEN-TRANSITION-API | `transitionScreen.show()` called with string first arg (no string-mode API) | error | game-building (code-patterns) | Covered |
| GEN-TRANSITION-ICONS | SVG markup in `icons[]` array (use plain emoji) | error | game-building (code-patterns) | Covered |

## PreviewScreen

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5e0-SLOT | PreviewScreenComponent used but `previewScreen: true` not in ScreenLayout slots | error | game-building (html-template) | Covered |
| 5e0-SCROLL-OWNER | Preview-wrapper game lacks the compatibility CSS that makes `.mathai-preview-body` the vertical scroll owner | error | game-building (html-template), PART-039, mobile | Implemented in lib/validate-static.js |
| 5e0-SHOW | PreviewScreenComponent instantiated but `previewScreen.show()` not called | warning | game-building (code-patterns) | Covered |
| 5e0-AUDIOURL | `previewScreen.show()` missing `audioUrl` parameter | warning | game-building (code-patterns) | Covered |
| 5e0-HARDCODED | `previewScreen.show()` has hardcoded instruction string | warning | game-building (code-patterns) | Covered |
| 5e0-DUP-INSTRUCTION | `#gameContent` includes a how-to-play / prompt banner: any element with class/id containing `instruction`, `help-text`, `prompt-text`, `task-text`, `directions`, `how-to-play`; OR a banner sentence starting with an imperative verb already said by the preview (`Find`, `Tap`, `Select`, `Choose`, `Click`, `Drag`, `Match`). Per-round *question* text (e.g. "What is 3 × 4?") is allowed — only restated how-to-play is forbidden | error | game-building (code-patterns) | Implemented in lib/validate-static.js |
| 5e0-STARTAFTER | `startGameAfterPreview()` function not found | warning | game-building (code-patterns) | Covered |
| 5e0-DESTROY | `endGame()` does not call `previewScreen.destroy()` | warning | game-building (code-patterns) | Advisory (not yet in validate-static.js) |
| 5e0-HIDE | `previewScreen.hide()` present (method removed in current API) | error | game-building (code-patterns) | Advisory |
| 5e0-ORDER | `previewScreen.show()` called before `#gameContent` populated in `setupGame()` (heuristic: `.show(` precedes `injectGameHTML`/`renderInitialState`) | warning | game-building (code-patterns) | Advisory |
| 5e0-RESTART | `restartGame()` calls `setupGame()` or `previewScreen.show()` (preview is once per session) | warning | game-building (code-patterns) | Advisory |
| 5e0-DOMCL-TRANSITION | `transitionScreen.show()` invoked inside DOMContentLoaded before `setupGame()` (preview IS the first screen) | warning | game-building (html-template) | Advisory |
| 5e0-DURATION | `duration_data.preview` array never populated in `startGameAfterPreview()` | warning | game-building (code-patterns) | Advisory |
| 5e0-CTOR | `PreviewScreenComponent` constructed with `autoInject`, `gameContentId`, `questionLabel`, `score`, or `showStar` (drifted API) | error | game-building (code-patterns) | Advisory |
| 5e0-SLOT-HIDE | `mathai-preview-slot` styled with `display:none`, `visibility:hidden`, `.hidden` class, `hidden` attribute, or `style.display = 'none'` mutation (wrapper must stay visible) | error | game-building (code-patterns) | Advisory |
| 5e0-REPARENT | `appendChild`, `insertBefore`, `replaceWith`, or `remove` targeting `#gameContent` outside `injectGameHTML` / `buildFallbackLayout` init (wrapper DOM must not move at runtime). Heuristic allowlist: these two function bodies | error | game-building (code-patterns) | Advisory |
| 5e0-DESTROY-MISPLACED | `previewScreen.destroy()` appears anywhere other than `endGame()` — e.g. inside `showVictory`, `showGameOver`, `restartGame`, `resetGame`, or answer handler. `destroy()` token count > 1 anywhere in file | error | game-building (code-patterns) | Advisory |
| 5e0-DESTROY-MISSING | `endGame()` function has no `previewScreen.destroy()` call | error | game-building (code-patterns) | Advisory |
| 5e0-DUP-HEADER | `#gameContent` markup contains an element with class containing `header`, `score-display`, or `avatar` (duplicates preview header) | warning | game-building (html-template) | Advisory |
| 5e0-NEW-AUDIO | `new Audio(` appears anywhere in generated game code — preview/game audio must route through `FeedbackManager.sound` | error | game-building (code-patterns) | Advisory |
| 5e0-PREVIEWRESULT | `game_complete` postMessage payload does not reference `previewResult` field | warning | game-building (code-patterns) | Advisory |
| 5e0-DOM-BOUNDARY | Game code calling getElementById/querySelector on preview/action-bar-owned IDs (#previewInstruction, #previewProgressBar, #previewTimerText, #previewQuestionLabel, #previewScore, #previewStar, #previewSkipBtn, #previewBackBtn, #previewAvatarSpeaking, #previewAvatarSilent, #previewGameContainer, #popup-backdrop) or .mathai-preview-* class selectors / classList toggles — boundary violation (component owns its DOM). Gate: fires when either `PreviewScreenComponent` or `ActionBarComponent` is present. See PART-039, PART-040, PART-026 AP-35. | error | game-building (code-patterns) | Implemented in lib/validate-static.js |
| 5e0-DRIFTED-OPTIONS | `previewScreen.show(...)` passes `timerInstance:` or `timerConfig:`. Neither option exists on the component. | error | game-building (code-patterns) | Implemented in lib/validate-static.js |

## ScreenLayout

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5e-INJECT | ScreenLayout referenced but `ScreenLayout.inject()` never called | error | game-building (html-template) | Covered |
| 5e2-SLOTS-WRAPPER | `ScreenLayout.inject()` missing `slots: { ... }` wrapper | warning | game-building (html-template) | Covered |
| PART-026-GAMECONTENT | `transitionScreen.hide()` does not auto-show `#gameContent` | warning | game-building (code-patterns) | Covered |

## ProgressBar

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5f7-TIMER | `progressBar.timer` property does not exist | error | game-building (code-patterns) | Covered |
| 5f9-INIT | `progressBar.init()` method does not exist | error | game-building (code-patterns) | Covered |
| 5f10-HALLUCINATED | `progressBar.start/reset/setLives/pause/resume()` do not exist | error | game-building (code-patterns) | Covered |
| GEN-112-POSITIONAL | `new ProgressBarComponent('string', ...)` positional arg (use object API) | error | game-building (code-patterns) | Covered |
| GEN-UX-003 | ProgressBarComponent options object missing `slotId` key | error | game-building (code-patterns) | Covered |
| GEN-112-3ARGS | `progressBar.update()` called with 3 args (only 2 allowed) | error | game-building (code-patterns) | Covered |
| LP-1 | `progressBar.update()` 2nd arg must not be `totalRounds` | error | game-building (code-patterns) | Covered |
| GEN-PROGRESSBAR-LIVES | `totalLives: 0` or negative in ProgressBarComponent constructor | error | game-building (code-patterns) | Covered |
| W14/LP-PROGRESSBAR-CLAMP | `progressBar.update()` with unclamped `gameState.lives` (negative -> RangeError) | warning | game-building (code-patterns) | Covered |
| 5e0-PROGRESSBAR-START-ONE | `progressBar.update()` first arg is `<expr> + <positive-literal>` or a bare positive literal (e.g. `currentRound + 1`, `1`) — violates start-at-0 invariant, bar paints "Round 1/N" before round 1 is played | error | game-building (code-patterns, PART-023) | Covered |

## FloatingButton

**Per-game opt-out (`floatingButton: false` in spec.md):** if the spec declares a top-level `floatingButton: false` (e.g. `**Floating button:** false` or `floatingButton: false`), all FloatingButton rules below are auto-skipped for that game — the author hand-rolls buttons inline per PART-022. Same pattern as PART-039's `previewScreen: false`. The build step MUST NOT write this flag into `spec.md` to silence rules — spec mutations during build show up in `git diff` and are a visible scope violation the user can revert. Narrative comments inside the HTML cannot silence these rules.

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| GEN-FLOATING-BUTTON-CDN | `new FloatingButtonComponent(` referenced but neither `floating-button/index.js` nor `components/index.js` script tag is present | error | game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-SLOT | `new FloatingButtonComponent(` referenced but `ScreenLayout.inject(...)` does not pass `floatingButton: true` in its `slots` | error | game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-PREDICATE | `new FloatingButtonComponent(` referenced but `setSubmittable(` never called — catches the "show once, never hide" regression where the button stays visible after the player clears the answer | error | game-building (code-patterns, PART-050) | Covered |
| 5e0-FLOATING-BUTTON-DUP | `<button>` anywhere in source whose **id / class / data-testid / aria-label / inner text** matches `submit \| commit \| retry \| next \| check \| done \| cta` while FloatingButton is also in use. Known evasion: renaming id/class to innocuous names ("bb-go", "bbGoBtn") while keeping `data-testid="bb-submit-btn"` and inner text "Submit" — rule scans all 5 attributes and still fires. No escape hatch. | error | game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-MISSING | Hand-rolled Submit / Check / Done / Commit `<button>` in source but `FloatingButtonComponent` is NOT instantiated. NO escape hatch — narrative justification (sentinel comment, "submit-only flow", "standalone game", etc.) does NOT silence this rule. If the spec has no Submit CTA, the generator should not emit the button at all. If the button is a rare non-CTA use, rename the id/class/text to avoid the reserved words. | error | game-archetypes (constraint #8), game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-NEXT-MISSING | FloatingButton is used AND `game_complete` postMessage is fired somewhere, but no `setMode('next')` call AND no `on('next', ...)` handler — the Next button MUST be wired at every game end so the harness receives the `next_ended` teardown signal. | error | game-archetypes (constraint #8), game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE | `floatingBtn.on('next', ...)` handler body does NOT post `{ type: 'next_ended' }` — a silent Next handler breaks the harness teardown signal. The Next handler MUST emit `next_ended` (see postmessage-schema.md). | error | game-building (code-patterns, PART-050), data-contract (postmessage-schema) | Covered |
| GEN-FLOATING-BUTTON-NEXT-TIMING | `setMode('next')` is called within ~400 chars of a `game_complete` reference WITHOUT a `transitionScreen.hide()` / `transitionScreen.onDismiss(` / `await` / `.then(` separator between them. Catches the "show Next immediately in endGame" regression where Next appears during feedback audio, letting the player tap through and destroy the iframe mid-audio. `setMode('next')` MUST be inside a `transitionScreen.onDismiss(...)` callback or a post-feedback `.then(...)`. | error | game-building (code-patterns, PART-050), game-planning (Step 2c) | Covered |
| GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN | TransitionScreen button object with `text: 'Next' / 'Continue' / 'Done' / 'Finish' / 'Play Again'` found while FloatingButton is in use — the Next CTA is owned by FloatingButton, NOT by a button inside the TransitionScreen card. Victory / game_over screens must use `buttons: []` + tap-dismiss. Welcome / round-intro / motivation buttons (`I'm ready`, `Let's go`, `Skip`) are unaffected — not in the reserved-word list. | error | game-building (code-patterns, PART-050), game-planning (Step 2c) | Covered |
| GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN | Spec declares `totalRounds: 1` AND FloatingButton is used, but source references TransitionScreen (`new TransitionScreenComponent(` or `transitionScreen.show(`). Standalone games have a single question and a single end state — nothing to transition between. The inline feedback panel in `#gameContent` is the canonical end-of-game display. Multi-round games (`totalRounds > 1`) are unaffected. | error | game-building (code-patterns, PART-050), game-planning (Step 2c standalone variant) | Covered |
| GEN-FLOATING-BUTTON-RETRY-STANDALONE | Spec has `totalRounds: 1` AND `totalLives > 1` AND FloatingButton is used, but no `on('retry', ...)` handler — standalone games with multiple lives MUST wire the Try Again flow per PART-050. Multi-round games use TransitionScreen retry buttons (unaffected). | error | game-archetypes (constraint #8 sub-rule), game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-RETRY-LIVES-RESET | `on('retry', ...)` handler body contains a lives reset (`gameState.lives = gameState.totalLives` or `gameState.lives = <literal>`) — Try Again MUST preserve the already-decremented lives; a reset defeats the lives mechanic. | error | game-building (code-patterns, PART-050) | Covered |

## Timer

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5f5-NULL | `new TimerComponent(null, ...)` throws at runtime | error | game-building (code-patterns) | Covered |
| 5f4-CONSTRUCTOR | TimerComponent first arg must be string ID, not object or DOM element | error | game-building (code-patterns) | Covered |
| 5f8-SLOT | `new TimerComponent('mathai-timer-slot')` but `timer: true` not in ScreenLayout slots | error | game-building (code-patterns) | Covered |
| GEN-TIMER-GETTIME | `timer.getTime()` / `timer.getCurrentTime()` are hallucinated methods | error | game-building (code-patterns) | Covered |

## SignalCollector

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5-SEAL | signalCollector detected but `signalCollector.seal()` not called | error | data-contract | Covered |
| 5-SPREAD | `...signalPayload` spread in postMessage forbidden | error | data-contract | Covered |
| 5-WINDOW-SC | `new SignalCollector()` but not assigned to `window.signalCollector` | warning | data-contract | Covered |
| GEN-PM-SIGNALCONFIG | handlePostMessage + SignalCollector but missing property assignments (flushUrl, playId, etc.) | error | data-contract | Covered |
| 5h-TRACKEVENT | `signalCollector.trackEvent()` does not exist (hallucinated API) | error | data-contract | Covered |
| GEN-UX-005 | `new SignalCollector()` with no constructor args | error | data-contract | Covered |
| 5h3-INLINE-STUB | Inline `SignalCollector` class/function shadows CDN package | error | game-building (code-patterns) | Covered |

## Sentry

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5f-ORDER | `initSentry()` called before `waitForPackages()` resolves | error | game-building (html-template) | Covered |
| 5f0-UNDEF | `initSentry()` called but never defined | error | game-building (html-template) | Covered |
| 5f2-CAPTURECONSOLE | `new Sentry.Integrations.CaptureConsole()` does not exist in CDN bundle | warning | game-building (code-patterns) | Covered |
| 5f2-INTEGRATION | `Sentry.captureConsoleIntegration()` does not exist in CDN bundle | warning | game-building (code-patterns) | Covered |

## postMessage / Platform Communication

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 6-POSTMESSAGE | `postMessage` must exist for parent frame communication | error | data-contract | Covered |
| GEN-PM-001 | `type: 'game_complete'` string missing from postMessage | error | data-contract | Covered |
| GEN-PM-DUAL-PATH | `game_complete` postMessage inside victory-only if-guard | error | data-contract | Covered |
| GEN-PM-READY | `game_ready` postMessage not found | error | data-contract | Covered |
| 5b-GAME-INIT | handlePostMessage + game_init but `gameState.phase = 'playing'` missing | error | data-contract, game-building (code-patterns) | Covered |

## gameState

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 7-GAMESTATE | No `gameState` object initialization found | error | game-building (code-patterns), data-contract | Covered |
| 5b3-WINDOW-GS | `window.gameState` not assigned (const/let inside DOMContentLoaded scope) | error | game-building (code-patterns) | Covered |
| 5d-WINDOW-ENDGAME | `window.endGame = endGame` not assigned in CDN game | error | game-building (code-patterns) | Covered |
| 5d-WINDOW-RESTART | `window.restartGame = restartGame` not assigned in CDN game | error | game-building (code-patterns) | Covered |
| 5d2-LOADROUND | `window.loadRound` not exposed for multi-round CDN games | warning | game-building (code-patterns) | Covered |
| GEN-ROUND-INDEX | `rounds[currentRound - 1]` (0-based index off by one) | error | game-building (code-patterns) | Added |
| GEN-ROUND-INDEX-DBL | `loadRound()` calls `nextRound()` (double-increment) | error | game-building (code-patterns) | Added |
| 8-STARS | No star scoring pattern found (0.8/0.5 thresholds or calcStars) | error | data-contract | Covered |
| 12-GUARD | Click handlers without isActive/isProcessing guard | warning | game-building (code-patterns) | Covered |
| 12-GUARD-INIT | `gameState.isActive` used in handlers but not initialized | warning | game-building (code-patterns) | Covered |
| GEN-ISACTIVE-GUARD | `endGame()` uses `!gameState.isActive` as guard (should use `gameEnded`) | warning | game-building (code-patterns) | Added |
| GEN-ISPROCESSING-RESET | `isProcessing = true` found but never set to false | warning | game-building (code-patterns) | Added |

## Phase Transitions / syncDOMState

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| W4-SYNC | `gameState.phase` assignments without nearby `syncDOMState()` | warning | game-building (code-patterns), data-contract | Covered |
| GEN-PHASE-SEQUENCE | endGame() calls syncDOMState() without/before assigning gameState.phase | warning | game-building (code-patterns) | Covered |
| GEN-SHOWRESULTS-SYNC | showResults() sets phase but does not call syncDOMState() | warning | game-building (code-patterns) | Added |
| GEN-PHASE-MCQ | MCQ game has fewer than 3 syncDOMState() calls | warning | game-building (code-patterns) | Covered |
| GEN-PHASE-INIT | `#app` initial data-phase does not match `gameState.phase` init value | warning | game-building (code-patterns), data-contract | Covered |
| W15-DATA-LIVES | Lives game but syncDOMState() does not set `data-lives` | warning | data-contract | Covered |
| W16-SYNCDOM-ALLATTRS | syncDOMState() sets data-phase but not data-round or data-score | warning | data-contract | Covered |

## Restart / Game Lifecycle

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| GEN-RESTART-RESET | restartGame() missing state reset for required fields | warning | game-building (code-patterns) | Covered |
| 5i-STARTGAME-SYNC | startGame() contains setTimeout (must be synchronous) | error | game-building (code-patterns) | Covered |
| GEN-WORKED-EXAMPLE-TEARDOWN | Worked-example dismiss handler does not re-enable buttons | warning | game-building (code-patterns) | Added |
| GEN-CORRECT-ANSWER-EXPOSURE | Round uses correct-answer field but gameState.correctAnswer never set | warning | game-building (code-patterns), data-contract | Added |

## Mobile / CSS

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 9-RESPONSIVE | No 480px or max-width constraint found | error | mobile | Covered |
| 7b-OVERFLOW | `body { overflow: hidden }` blocks mobile scroll | warning | mobile | Covered |
| 7b-SCALABLE | `user-scalable=no` prevents mobile zoom | warning | mobile | Covered |
| GEN-MOBILE-STACK | MCQ option container uses `flex-direction:row` (must be column) | error | mobile | Covered |
| GEN-MOBILE-STACK-W | General game container uses `flex-direction:row` without wrap/media query | warning | mobile | Covered |
| GEN-MOBILE-STACK-WRAP | Option grid uses `flex-direction:row` without `flex-wrap:wrap` | warning | mobile | Covered |
| 5f6-CANVAS-CSS | Canvas API calls with `var(--color)` (Canvas2D cannot resolve CSS vars) | error | game-building (code-patterns) | Covered |

## CSS Quality

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| PART-028-CSS-STRIPPED | CSS style block contains only comments (entire stylesheet stripped) | error | game-building | Covered |
| PART-028-NO-CSS | No `<style>` block found at all | warning | game-building (html-template) | Covered |
| GEN-CSS-TOKENS | Banned CSS custom properties (--mathai-green, --color-red, etc.) | warning | game-building (css-reference) | Covered |
| GEN-SVG-CONTRAST | Low-contrast SVG stroke/fill colors fail WCAG AA | warning | mobile | Covered |
| GEN-RESULTS-FIXED | `#results-screen` missing `position:fixed` | warning | mobile, game-building (code-patterns) | Covered |
| GEN-RESULTS-ROUNDS | Multi-round game results screen missing `id="rounds-completed"` | warning | game-building (code-patterns) | Added |

## Accessibility

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| ARIA-001 | Dynamic feedback divs missing `aria-live` attribute | warning | mobile | Covered |
| ARIA-002 | `aria-live="assertive"` without `role="alert"` | warning | mobile | Covered |

## Test Harness Compatibility

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| W3-TESTID | Interactive elements (button/input/select) missing `data-testid` | error (>80%) / warning (>50%) | game-building (code-patterns) | Covered |
| GEN-TESTID-RESTART | Restart button uses wrong data-testid (must be `btn-restart`) | warning | game-building (code-patterns) | Covered |
| GEN-TESTID-MATCH | `id` and `data-testid` values diverge on same element | warning | game-building (code-patterns) | Covered |
| GEN-BTN-START | No `data-testid="btn-start"` on start button | warning | game-building (code-patterns) | Covered |
| 11-STAR-DISPLAY | game_over phase set but no star/rating display element found | warning | game-building (code-patterns) | Covered |
| GEN-DOM-CACHE | `getElementById`/`querySelector` inside per-round functions (should cache at init) | warning | game-building (code-patterns) | Added |

## ProgressBar slot

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5g-PROGRESS-SLOT-WRONG | `ProgressBarComponent` constructed with `slotId: 'previewProgressBar'` (internal audio countdown, not the ProgressBar slot) or any value other than `'mathai-progress-slot'` | error | game-building (code-patterns) | Advisory |

## Plan ↔ Build Contract

Rules enforcing that generated HTML matches `pre-generation/screens.md` from the game-planning skill.

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5f-SCREENS-COMPLETE | Every screen enumerated in `pre-generation/screens.md` must have at least one corresponding render call in generated HTML. For transition screens (welcome / round_intro / motivation / stars_collected / victory / game_over), match by `transitionScreen.show({ title: '<screen title>' })` — title string matches the wireframe title verbatim | warning | game-building (flow-implementation) | Advisory |
| 5f-BUTTONS-MATCH | For each transition screen in `screens.md`, the set of button `text:` values in the generated HTML must equal the set of CTA labels in the screen's Elements table. Count + case-sensitive match. Extra buttons (e.g. an invented Exit) and missing buttons both fail | warning | game-building (flow-implementation) | Advisory |
| 5f-PROGRESS-TOP | Game CSS or HTML places the progress bar (ProgressBarComponent / `#mathai-progress-slot`) at the bottom of the game body. ProgressBar lives at the top of `.game-stack`, under the preview header — owned by ScreenLayout | warning | game-building (code-patterns) | Advisory |
| 5f-CONTENT-MATCH | For every TransitionScreen-backed screen enumerated in `pre-generation/screens.md` (welcome, round_intro, section_intro, motivation, victory, game_over, stars_collected, etc.), the `transitionScreen.show({...})` call in the generated HTML MUST match the Elements table verbatim: `title` string, `subtitle` string (if declared), and button labels. Template variables (`'Round ' + n`, `'Section ' + n + ': ' + name`, `'you cleared ' + lives + ' lives remaining'`) are matched against placeholders in the plan (`N`, `M`, `[Title]`, numeric examples) via a concat-aware comparator | error | game-planning + game-building | Enforced by `test/content-match.test.js` |

## JS Syntax

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| PART-027-JS-SYNTAX | JavaScript syntax error in inline `<script>` block | error | -- | Linter-only |
