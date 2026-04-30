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
| 5f3-TIMER-TYPEOF (5f3a) | TimerComponent used but no typeof guard in waitForPackages | error | game-building (mandatory-components) | Covered |
| 5f3-TRANSITION-TYPEOF (5f3b) | TransitionScreenComponent used but no typeof guard | error | game-building (mandatory-components) | Covered |
| 5f3-PROGRESS-TYPEOF (5f3c) | ProgressBarComponent used but no typeof guard | error | game-building (mandatory-components) | Covered |
| 5f3-SIGNAL-TYPEOF (5f3d) | SignalCollector used but no typeof guard | error | game-building (mandatory-components) | Covered |
| 5f3-PREVIEW-TYPEOF (5f3e) | PreviewScreenComponent used but no typeof guard | error | game-building (mandatory-components) | Covered |
| 5f3-FLOATING-TYPEOF (5f3f) | FloatingButtonComponent used but no typeof guard | error | game-building (mandatory-components) | Covered |
| 5f3-ANSWER-TYPEOF (5f3g) | AnswerComponentComponent used but no typeof guard | error | game-building (mandatory-components) | Covered |
| GEN-WAITFORPACKAGES-NO-OR (5f3h) | `waitForPackages` body contains `\|\|` — readiness expression must use only `&&`. The `\|\| ScreenLayout` fail-open shape was the age-matters bug. | error | game-building (mandatory-components, code-patterns) | Covered |
| GEN-WAITFORPACKAGES-MISSING (5f3i) | `new XComponent(...)` constructed but `typeof XComponent` missing from the `waitForPackages` body — silent-skip pattern (typeof guard at instantiation time) is NOT a substitute. | error | game-building (mandatory-components) | Covered |
| GEN-SLOT-INSTANTIATION-MATCH (5f3j) | `ScreenLayout.inject({ slots: { X: true } })` declared but `new XComponent(...)` never called. Slot↔class map: previewScreen→PreviewScreenComponent, transitionScreen→TransitionScreenComponent, progressBar→ProgressBarComponent, floatingButton→FloatingButtonComponent, answerComponent→AnswerComponentComponent. | error | game-building (mandatory-components) | Covered |

## FeedbackManager

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5b2-REGISTER | `sound.register()` forbidden (use `sound.preload`) | error | feedback | Covered |
| GEN-SOUND-ID-CANONICAL | Every `{id, url}` entry in `FeedbackManager.sound.preload([...])` MUST come from the canonical table at `feedback/reference/feedbackmanager-api.md` § Standard Audio URLs OR from the spec's optional `creatorSounds` block. Two failure modes flagged: (a) **invented id** — id not in canonical table or aliases (e.g. `bubble_pop_sfx`, `tap_select_sfx`); (b) **URL drift** — id is canonical but URL doesn't match (e.g. builder copied a URL from the previous preload row). The cross-logic 2026-04-29 regression hit both: planner invented `bubble_pop_sfx`, builder paired it with `rounds_sound_effect`'s URL, cell taps played the round-intro sting. Skill-doc aliases (`sound_motivation`, `sound_stars_collected`, `sound_game_over`, `sound_game_victory`, `sound_game_complete`) are allowed by id but URL is not enforced (documentation drift to be cleaned up). Auto-skips: dynamic id expressions like `safePlaySound(stars >= 3 ? 'A' : 'B', ...)` (validator only checks string literals). | error | feedback (reference/feedbackmanager-api.md AUTHORITATIVE), spec-creation (creatorSounds block), game-planning (canonical-only rule), game-building (preload match rule + code-patterns example) | NEW |
| PART-011-SOUND | `FeedbackManager.sound.playDynamicFeedback()` does not exist; use top-level | error | feedback | Covered |
| GEN-FEEDBACK-TTS-AWAIT | `playDynamicFeedback(...)` not awaited in submit / finish-round / round-complete handlers — TTS bleeds into next round (equivalent-ratios regression). Carve-outs: `showRoundIntro`, `onMounted`, chain-progress, ambient | error | feedback | Implemented in alfred/scripts/validate-static.js |
| GEN-ROUND-BOUNDARY-STOP | Multi-round game with `playDynamicFeedback` but `showRoundIntro(n)` does not call `FeedbackManager.sound.stopAll()` + `stream.stopAll()` at entry — defensive cleanup against streaming timeouts | error | feedback | Implemented in alfred/scripts/validate-static.js |
| GEN-FEEDBACK-CUSTOM-DIALOGUE | Custom feedback overlay (id matching `(fail\|wrong\|correct\|incorrect\|feedback)Dialogue` or class matching `fd-\|fail-\|wrong-feedback-\|feedback-card`) is present alongside `FeedbackManager` / `TransitionScreenComponent` — duplicates the platform feedback layer. Fix: use `TransitionScreen.show({title, subtitle, sticker, persist: true})` for persistent feedback messages. See feedback/SKILL.md § Composition with screen primitives and feedback/reference/composition-anti-patterns.md #1. | error | feedback | Implemented in alfred/scripts/validate-static.js |
| GEN-INLINE-CTA-WITH-FLOATING-BUTTON | An inline `<button>` outside the FloatingButton / TransitionScreen subtree has visible text matching `move on\|continue\|onward\|proceed\|got it\|okay\|next\|advance` (or `aria-label` matching `move forward\|advance\|next`) while `FloatingButtonComponent` is in use — common rename-evasion of `5e0-FLOATING-BUTTON-DUP`. Fix: use `floatingBtn.setMode('next')` and `floatingBtn.once('next', handler)`. See feedback/SKILL.md § Composition with screen primitives and composition-anti-patterns.md #2-#3. | error | feedback | Implemented in alfred/scripts/validate-static.js |
| GEN-CUSTOM-SUBTITLE-RENDER | `playDynamicFeedback({subtitle: ...})` is called AND a custom DOM element has `class=`/`id=` matching `subtitle\|caption\|message-line\|fd-msg` (excluding canonical `mathai-subtitle-*` CDN classes) — duplicates FeedbackManager's auto-rendered subtitle. Fix: remove the custom element. See feedback/SKILL.md § Composition with screen primitives and composition-anti-patterns.md #4. | error | feedback | Implemented in alfred/scripts/validate-static.js |
| GEN-TS-TTS-MISSING | A `transitionScreen.show({...})` call whose `title` matches a prescribed TS (Welcome / Round / Puzzle / Victory / Game Over / Ready to improve) lacks a `playDynamicFeedback(` (or `safeDynamic` / `safePlayDynamic`) call inside its body. Every prescribed TS plays SFX → TTS, both awaited inside `onMounted`, per feedback/SKILL.md § Composition with screen primitives and default-transition-screens.md § Default narration strings. The SFX-only shape was the cross-logic / spot-the-pairs regression (2026-04-29). Auto-skips Stars Collected (silent by canon — title `Yay!\nStars collected!`) and standalone games (no TS). The `ttsText` content comes from `pre-generation/screens.md` § Screen Audio (game-planning resolves it; build inlines verbatim). | error | game-planning (default-transition-screens), feedback (composition table), game-building (code-patterns Canonical Round Intro / Welcome / Victory snippets) | NEW |
| GEN-TS-AUDIO-AWAITED | A `transitionScreen.show({...})` body contains BOTH `safePlaySound`/`sound.play` AND `playDynamicFeedback`, but at least one is fire-and-forget (no `await` keyword within the preceding 60 chars of the call). Sequential ordering rule (CASE 1/2/11/12) requires both awaited so the second never starts until the first finishes — fire-and-forget breaks the SFX → TTS guarantee, the screen dismisses before audio finishes, or SFX overlaps TTS. Fix: `try { await safePlaySound(...) } catch(e){}` then `try { await playDynamicFeedback(...) } catch(e){}`. | error | feedback (rule 9 line 267), game-building (code-patterns) | NEW |

## TransitionScreen

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| PART-025-HIDE | `transitionScreen.show()` without `transitionScreen.hide()` | error | game-building (code-patterns) | Covered |
| 5h-AWAIT | Unawaited `transitionScreen.show()` calls | error | game-building (code-patterns) | Covered |
| GEN-TRANSITION-API | `transitionScreen.show()` called with string first arg (no string-mode API) | error | game-building (code-patterns) | Covered |
| GEN-TRANSITION-ICONS | SVG markup in `icons[]` array (use plain emoji) | error | game-building (code-patterns) | Covered |
| TRANSITION-ICONS-NO-URL | An `icons:` array entry in any `transitionScreen.show({...})` call (literal or via a variable) is a URL — matches `^\s*['"]?https?://` OR is an identifier that resolves at file-scope to a `https?://` literal (e.g. `STICKER_ROUNDS = 'https://...gif'`). The component renders icons[] as text, so URLs leak as giant on-screen text. Sticker URLs belong on `safePlaySound(..., { sticker: URL })` only. See PART-024 / code-patterns.md § TransitionScreen. | error | game-building (code-patterns) | NEW |
| TRANSITION-ICONS-EMOJI-ONLY | An `icons:` entry is a multi-character non-emoji string (e.g. `'star'`, `'check mark'`, `'puzzle piece'`). icons[] expects a single emoji glyph; descriptive text leaks as on-screen label text. Allowed: emoji (any unicode codepoint with Emoji property), single ASCII glyph used as art (e.g. `'✓'`, `'✖'`, `'?'`). | error | game-building (code-patterns) | NEW |
| TRANSITION-IMG-FALLBACK-NO-URL-ALT | Any `<img>` in the rendered HTML has both `src="https://..."` AND a non-empty `alt=` matching the URL (or substring of it). If the image fails to load, the alt becomes visible text — including a URL leaks as user-visible text. Either provide a descriptive alt that is NOT the URL, or set `alt=""`. Defense-in-depth for cases beyond `icons:[]`. | warning | game-building (code-patterns), mobile | NEW |

## PreviewScreen

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5e0-SLOT | PreviewScreenComponent used but `previewScreen: true` not in ScreenLayout slots | error | game-building (html-template) | Covered |
| 5e0-SCROLL-OWNER | Preview-wrapper game lacks the compatibility CSS that makes `.mathai-preview-body` the vertical scroll owner | error | game-building (html-template), PART-039, mobile | Implemented in alfred/scripts/validate-static.js |
| 5e0-SHOW | PreviewScreenComponent instantiated but `previewScreen.show()` not called | warning | game-building (code-patterns) | Covered |
| 5e0-AUDIOURL | `previewScreen.show()` missing `audioUrl` parameter | warning | game-building (code-patterns) | Covered |
| 5e0-HARDCODED | `previewScreen.show()` has hardcoded instruction string | warning | game-building (code-patterns) | Covered |
| 5e0-DUP-INSTRUCTION | `#gameContent` includes a how-to-play / prompt banner: any element with class/id containing `instruction`, `help-text`, `prompt-text`, `task-text`, `directions`, `how-to-play`; OR a banner sentence starting with an imperative verb already said by the preview (`Find`, `Tap`, `Select`, `Choose`, `Click`, `Drag`, `Match`). Per-round *question* text (e.g. "What is 3 × 4?") is allowed — only restated how-to-play is forbidden | error | game-building (code-patterns) | Implemented in alfred/scripts/validate-static.js |
| 5e0-STARTAFTER | `startGameAfterPreview()` function not found | warning | game-building (code-patterns) | Covered |
| 5e0-DESTROY | FloatingButton `on('next', ...)` handler does not call `previewScreen.destroy()` (destroy must run on Next-tap teardown after `next_ended`, NOT in `endGame()` — calling destroy in `endGame()` synchronously kills the async `show_star` animation) | warning | game-building (code-patterns) | Advisory (not yet in validate-static.js) |
| 5e0-HIDE | `previewScreen.hide()` present (method removed in current API) | error | game-building (code-patterns) | Advisory |
| 5e0-ORDER | `previewScreen.show()` called before `#gameContent` populated in `setupGame()` (heuristic: `.show(` precedes `injectGameHTML`/`renderInitialState`) | warning | game-building (code-patterns) | Advisory |
| 5e0-RESTART | `restartGame()` calls `setupGame()` or `previewScreen.show()` (preview is once per session) | warning | game-building (code-patterns) | Advisory |
| 5e0-DOMCL-TRANSITION | `transitionScreen.show()` invoked inside DOMContentLoaded before `setupGame()` (preview IS the first screen) | warning | game-building (html-template) | Advisory |
| 5e0-DURATION | `duration_data.preview` array never populated in `startGameAfterPreview()` | warning | game-building (code-patterns) | Advisory |
| 5e0-CTOR | `PreviewScreenComponent` constructed with `autoInject`, `gameContentId`, `questionLabel`, `score`, or `showStar` (drifted API) | error | game-building (code-patterns) | Advisory |
| 5e0-SLOT-HIDE | `mathai-preview-slot` styled with `display:none`, `visibility:hidden`, `.hidden` class, `hidden` attribute, or `style.display = 'none'` mutation (wrapper must stay visible) | error | game-building (code-patterns) | Advisory |
| 5e0-REPARENT | `appendChild`, `insertBefore`, `replaceWith`, or `remove` targeting `#gameContent` outside `injectGameHTML` / `buildFallbackLayout` init (wrapper DOM must not move at runtime). Heuristic allowlist: these two function bodies | error | game-building (code-patterns) | Advisory |
| 5e0-DESTROY-MISPLACED | `previewScreen.destroy()` appears anywhere other than the FloatingButton `on('next', ...)` handler — e.g. inside `endGame()`, `showVictory`, `showGameOver`, `restartGame`, `resetGame`, or answer handler. Calling destroy in `endGame()` synchronously kills the async `show_star` animation before it lands. `destroy()` token count > 1 anywhere in file | error | game-building (code-patterns) | Advisory |
| 5e0-DESTROY-MISSING | FloatingButton `on('next', ...)` handler has no `previewScreen.destroy()` call (destroy must run on Next-tap teardown after `next_ended` is posted) | error | game-building (code-patterns) | Advisory |
| 5e0-DUP-HEADER | `#gameContent` markup contains an element with class containing `header`, `score-display`, or `avatar` (duplicates preview header) | warning | game-building (html-template) | Advisory |
| 5e0-NEW-AUDIO | `new Audio(` appears anywhere in generated game code — preview/game audio must route through `FeedbackManager.sound` | error | game-building (code-patterns) | Advisory |
| 5e0-PREVIEWRESULT | `game_complete` postMessage payload does not reference `previewResult` field | warning | game-building (code-patterns) | Advisory |
| 5e0-DOM-BOUNDARY | Game code calling getElementById/querySelector on preview/action-bar-owned IDs (#previewInstruction, #previewProgressBar, #previewTimerText, #previewQuestionLabel, #previewScore, #previewStar, #previewSkipBtn, #previewBackBtn, #previewAvatarSpeaking, #previewAvatarSilent, #previewGameContainer, #popup-backdrop) or .mathai-preview-* class selectors / classList toggles — boundary violation (component owns its DOM). Gate: fires when either `PreviewScreenComponent` or `ActionBarComponent` is present. See PART-039, PART-040, PART-026 AP-35. | error | game-building (code-patterns) | Implemented in alfred/scripts/validate-static.js |
| 5e0-DRIFTED-OPTIONS | `previewScreen.show(...)` passes `timerInstance:` or `timerConfig:`. Neither option exists on the component. | error | game-building (code-patterns) | Implemented in alfred/scripts/validate-static.js |

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
| GEN-PROGRESSBAR-LIVES | `totalLives` is negative in ProgressBarComponent constructor. `totalLives: 0` is now ALLOWED iff `showLives: false` is also passed (no-lives game). See PROGRESSBAR-NO-LIVES-MUST-HIDE. | error | game-building (code-patterns) | UPDATED |
| PROGRESSBAR-NO-LIVES-MUST-HIDE | A no-lives game (defined as: `gameState.totalLives` literal is `0`, OR `gameState.lives` is never decremented anywhere in source, OR archetype's "Lives default" is 0 per game-archetypes/SKILL.md) instantiates ProgressBarComponent without `showLives: false`. Renders empty hearts that never decrement, confusing the player. The "lives default 0" archetypes today are Board Puzzle (#6), Worked Example (#8), No-Penalty Explorer (#9, by default), Tracking/Attention (#10). Sort/Classify (#4) and Memory Match (#5) also commonly run no-lives. | error | game-building (code-patterns, PART-023), game-archetypes | NEW |
| PROGRESSBAR-NO-LIVES-PLACEHOLDER-FORBIDDEN | ProgressBarComponent instantiated with `totalLives: gameState.totalRounds` (or any non-zero value that is NOT `gameState.totalLives` / `gameState.lives` / a numeric literal matching declared lives count). This is the "use rounds as a placeholder" hack — fails the build because the hearts strip then visualizes round count instead of actual lives, and never decrements. If the game has no lives, use `totalLives: 0` + `showLives: false`. | error | game-building (code-patterns, PART-023) | NEW |
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
| GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN | TransitionScreen button object with a NAVIGATION-VERB text (`Next` / `Continue` / `Done` / `Finish` / `Go to Next` / `Skip Forward`) while FloatingButton is in use. Navigation verbs belong on FloatingButton. SEMANTIC end-game ACTIONS — `Play Again`, `Claim Stars`, `Try Again`, `I'm ready`, `Let's go`, `Skip` — are ALLOWED on TS cards (Victory / Game Over / Motivation / Welcome). Do NOT strip Victory's `[Play Again, Claim Stars]` buttons to silence this rule — those labels are not reserved. See GEN-VICTORY-BUTTONS-REQUIRED for positive enforcement. | error | game-building (code-patterns, PART-050), game-planning (default-transition-screens § 3) | Updated |
| GEN-VICTORY-BUTTONS-REQUIRED | A `transitionScreen.show({...})` call whose `title:` matches `/Victory/i` MUST contain a `text: "Claim Stars"` button. If the surrounding code branches on `gameState.stars` or `showMotivation` exists (implying a <3★ path), it MUST also contain `text: "Play Again"`. Catches the "strip Victory buttons + onDismiss workaround" regression (cross-logic, bodmas-blitz 2026-04-23). Auto-skips standalone games (covered by GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN). | error | game-planning (default-transition-screens § 3), game-building (code-patterns) | NEW |
| GEN-FLOATING-BUTTON-LIFECYCLE | Each `transitionScreen.show({...title: "Victory" \| "Game Over" \| "Ready to improve"...})` call site MUST have a `floatingBtn.setMode('hidden')` (or `floatingBtn.destroy()`) within ±25 lines. Victory / Game Over / Motivation render their own in-card buttons; a stale floating button competes with the in-card CTA. `setMode('next')` is reserved for AnswerComponent reveal (or Stars Collected onMounted when `answerComponent: false`). | error | game-planning (default-transition-screens FloatingButton ownership table), game-building (code-patterns) | NEW |
| FLOATING-BUTTON-ELIMINATION-PREDICATE | The game's submittable predicate (any function whose body calls `floatingBtn.setSubmittable(`) reads a tri-state grid value (`'cross'\|'check'\|'empty'`, `'❌'\|'✓'`, etc.) AND ONLY counts `'check'`-equivalents (no `'cross'`-counting branch). Logic-grid / elimination archetypes must accept BOTH paths: explicit ✓ in every required cell OR exactly N-1 ✖ in a row (uniquely implying the remaining cell). See PART-050 § "Predicate semantics — match the player's solving model". | error | game-building (code-patterns, PART-050), game-archetypes (Logic Grid) | NEW |
| GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN | Spec declares `totalRounds: 1` AND FloatingButton is used, but source references TransitionScreen (`new TransitionScreenComponent(` or `transitionScreen.show(`). Standalone games have a single question and a single end state — nothing to transition between. The inline feedback panel in `#gameContent` is the canonical end-of-game display. Multi-round games (`totalRounds > 1`) are unaffected. | error | game-building (code-patterns, PART-050), game-planning (Step 2c standalone variant) | Covered |
| GEN-FLOATING-BUTTON-RETRY-STANDALONE | Spec has `totalRounds: 1` AND `totalLives > 1` AND FloatingButton is used, but no `on('retry', ...)` handler — standalone games with multiple lives MUST wire the Try Again flow per PART-050. Multi-round games use TransitionScreen retry buttons (unaffected). | error | game-archetypes (constraint #8 sub-rule), game-building (code-patterns, PART-050) | Covered |
| GEN-FLOATING-BUTTON-RETRY-LIVES-RESET | `on('retry', ...)` handler body contains a lives reset (`gameState.lives = gameState.totalLives` or `gameState.lives = <literal>`) — Try Again MUST preserve the already-decremented lives; a reset defeats the lives mechanic. | error | game-building (code-patterns, PART-050) | Covered |

## AnswerComponent

All rules in this block auto-skip when the spec declares `answerComponent: false` (PART-051 opt-out). **CREATOR-ONLY trust model:** unlike `floatingButton: false` / `previewScreen: false` (which the spec author may set when the spec describes a flow without that surface), `answerComponent: false` MUST come from the human creator's explicit prompt — quoted creator opt-out language must be present in the spec body. Spec-creation (step 1) MUST NOT auto-default `false`; spec-review (step 2) FAILs any spec missing the quoted justification (check H5); build (step 4) MUST NOT mutate spec.md to silence these rules.

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| GEN-ANSWER-COMPONENT-INSTANTIATE | Spec does NOT declare `answerComponent: false` but source never instantiates `new AnswerComponentComponent(...)`. Catches the "forgot to wire AnswerComponent" regression for new games. Skipped when no spec is found alongside the HTML (ad-hoc validator runs). | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-CDN | `new AnswerComponentComponent(` referenced but neither `answer-component/index.js` nor `components/index.js` script tag is present | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-SLOT | `new AnswerComponentComponent(` referenced but `ScreenLayout.inject(...)` does not pass `answerComponent: true` in its `slots` | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK | AnswerComponent is instantiated but no `answerComponent.show({ slides })` call is found, OR all `.show(...)` calls appear in source BEFORE any `await FeedbackManager.play(...)`. Reveal must follow feedback completion. | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-AFTER-CELEBRATION | Multi-round games (`totalRounds > 1`) that use TransitionScreen call `answerComponent.show(...)` inside `endGame()`. The reveal must be reached only via the Stars Collected `onMounted` setTimeout calling a `showAnswerCarousel()`-style function — NOT directly from `endGame()` and NOT from a Victory `Claim Stars` action that skips Stars Collected. The Stars Collected TS stays mounted (no `transitionScreen.hide()` in `onMounted` — see default-transition-screens.md). Calling AnswerComponent.show earlier steals the celebration moment AND forces a multi-stage Next handler. | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE | The `floatingBtn.on('next', ...)` handler is a two-stage exit — body invokes a celebration screen (`showStarsCollected(`, `transitionScreen.show(`) AND either hides the button mid-handler (`setMode(null)`) or branches on a flag (`if (!gameState.starsCollectedShown) {...}`). Next must be single-stage: destroy AnswerComponent + post `next_ended` + destroy floating button (and preview if applicable). | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW | `answerComponent.show(...)` is called inside an `if (previewScreen.isActive())` / `state === 'preview'` true-branch. The component must never appear during preview state. | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-DESTROY | AnswerComponent is instantiated but `.destroy()` is never called. Wire it from `floatingBtn.on('next', ...)` (and from `restartGame()` if the game supports restart). | error | game-building (code-patterns, PART-051) | Covered |
| GEN-ANSWER-COMPONENT-SLIDE-SHAPE | `answerComponent.show({ slides: [...] })` contains a slide entry with a `html:` or `element:` key. Slides MUST use the `render(container)` callback shape ONLY. | error | game-building (code-patterns, PART-051) | Covered |

## Timer

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| 5f5-NULL | `new TimerComponent(null, ...)` throws at runtime | error | game-building (code-patterns) | Covered |
| 5f4-CONSTRUCTOR | TimerComponent first arg must be string ID, not object or DOM element | error | game-building (code-patterns) | Covered |
| 5f8-SLOT | `new TimerComponent('mathai-timer-slot')` but `timer: true` not in ScreenLayout slots | error | game-building (code-patterns) | Covered |
| GEN-TIMER-GETTIME | `timer.getTime()` / `timer.getCurrentTime()` are hallucinated methods | error | game-building (code-patterns) | Covered |
| TIMER-MANDATORY-WHEN-DURATION-VISIBLE | `getStars()` (or any function that mutates score / lives / feedback / end-game) reads `responseTimes`, `gameStartTime`, `levelStartTime`, `roundStartTime`, `Date.now()`, `performance.now()`, `elapsedMs`, `avgResponseMs` AND `new TimerComponent(` is not present in the file. Tests every duration read inside the bodies of `getStars`, `computeScore`, `selectFeedback`, `handleSubmit`, `handleCorrectOutcome`, `handleWrongOutcome`, `endGame`, `showVictory`. Telemetry carve-out: a `Date.now()` read whose result flows directly into `recordAttempt({ response_time_ms: ... })` is allowed. See PART-006 § "When PART-006 is mandatory". | error | game-building (code-patterns), spec-review | NEW |
| TIMER-NO-HANDROLLED-LATENCY-IN-VISIBLE-LOGIC | `gameState.responseTimes`, `gameState.gameStartTime`, `gameState.levelStartTime`, or any `Date.now() - <var>` expression appears inside `getStars`, score-mutation, lives-mutation, feedback-selection, or end-game branch. Even if `new TimerComponent(...)` is present, these visible-logic functions MUST read from `timer.getTimeTaken()` / `timer.getElapsedTimes()` only. Allowed only inside the `recordAttempt` payload. | error | game-building (code-patterns) | NEW |
| TIMER-SPEC-TRIGGER-MUST-INCLUDE-TIMER | The spec text contains any of `timer\|seconds\|duration\|"time pressure"\|"time limit"\|speed\|fast\|"how quickly"\|"how fast"\|"under N second"\|"in N second"\|"within N second"\|"under N minute"\|"in N minute"\|within\|"response time"\|countdown\|"speed round"\|"race against"` AND the rendered HTML does not contain `<div id="timer-container">` and `new TimerComponent(`. See PART-006 § "Spec-side trigger". | error | spec-review, game-building | NEW |

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
| GEN-LOADROUND-SHADOW | top-level `function loadRound(...)` declaration coexists with `window.loadRound = ...` harness assignment — auto-attach + overwrite causes internal `loadRound(n)` calls to recurse via the harness helper, hammering the TTS API. Rename the internal function to `renderRound`. | error | game-building (code-patterns) | Added |
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

## P7 Text/Number Input Behaviors

| Rule ID | Check | Severity | Alfred Skill | Status |
|---------|-------|----------|--------------|--------|
| P7-SCROLL-BLOCK-ADAPTIVE | An `<input id="answer-input">` (or any `inputmode="numeric"` / `inputmode="decimal"` input that is the primary game input) exists AND `scrollIntoView({ ..., block: 'center' })` is called from a focus / click handler, but no `pickScrollBlock` / `block:` branch / `getBoundingClientRect().height` viewport-half check is present. Tall-question games (any game whose question element has rendered height > 50% of a 667px viewport) MUST use `block: 'end'` for that case. See p07-input-behaviors.md § "Adaptive `block:` rule". | error | game-building (interaction/p07) | NEW |
| P7-VV-RESIZE-USER-SCROLL-GUARD | A `visualViewport.resize` listener calls `scrollIntoView` without a recent-user-scroll guard. The handler MUST check that the user has not scrolled in the last ~600ms (`Date.now() - userScrolledAt < 600` or equivalent) before re-scrolling, else it fights the player's attempt to read a tall question. See p07-input-behaviors.md § "`visualViewport.resize` re-scroll guard". | error | game-building (interaction/p07) | NEW |
| P7-NO-OVERFLOW-HIDDEN-ON-QUESTION-ANCESTOR | A `<input id="answer-input">` exists AND any ancestor of the question element (the element matched by `#question-block`, `.question-block`, `.question`, `.game-question`, `[data-role="question"]`) has `overflow: hidden` and no scroll affordance. Tall questions need either body-level scroll or an explicit scroll container — silent overflow:hidden hides part of the question forever. | warning | game-building (interaction/p07, mobile) | NEW |

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
