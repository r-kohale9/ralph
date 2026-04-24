# Required Code Patterns

Every game MUST implement all patterns below. Each section either references a PART (for full API details) or defines a game-building-specific rule not covered by any PART.

**Convention:** "Per PART-NNN" means the full code, constructor options, methods, and verification checklist live in `parts/PART-NNN.md`. This file only adds game-building-specific usage rules.

---

## Standalone fallback pattern (CRITICAL)

Every game listens for `game_init` from a parent window. When running standalone (local server, Playwright tests, preview), there is no parent — `game_init` never arrives — and the game stays on a blank start screen forever.

**Required pattern:** Add a fallback timer that runs **independently of `waitForPackages()`**. The fallback must be able to fire even if CDN packages never load.

```javascript
// Inside DOMContentLoaded, AFTER registering the message listener and sending game_ready:

// 1. Start waitForPackages (may take up to 180s if CDN is down)
waitForPackages().then(function(loaded) {
  // ... init CDN components ...
  setupGame();
});

// 2. Standalone fallback — runs INDEPENDENTLY, not nested inside waitForPackages
//    Builds fallback layout if ScreenLayout didn't load, then starts the game.
setTimeout(function() {
  if (!gameState.isActive && !gameState.gameEnded) {
    if (!document.getElementById('gameContent')) {
      buildFallbackLayout();
      // ... populate slots with innerHTML ...
    }
    gameState.content = fallbackContent;
    gameState.totalRounds = fallbackContent.rounds.length;
    setupGame();
    startGame();
  }
}, 2000);
```

**Why CRITICAL:** Without this, the game is untestable locally and unrenderable in standalone preview. This bug appeared in THREE Alfred-built games before being corrected.

**Anti-pattern (CRITICAL):** Never nest the standalone fallback inside `waitForPackages().then(...)`. If CDN packages fail to load, `waitForPackages` blocks for 180s — the standalone fallback never fires, and Playwright tests time out waiting for the game to start. The fallback MUST be a top-level `setTimeout` that runs regardless of CDN availability.

---

---

## Component References (WHAT lives in PARTs)

### gameState
Per PART-007. Game-building rules:
- Every field in data-contract.md Section 1 marked Required MUST be present.
- `window.gameState = gameState;` -- test harness reads this global.
- Lives games add `lives` and `totalLives` fields.
- See `parts/PART-007.md` for full field list and code.

### waitForPackages
Per PART-003. Game-building rules:
- Must resolve before any CDN component is used (FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector).
- Game MUST NOT block on missing packages after timeout -- proceed gracefully.
- See `parts/PART-003.md` for full implementation.

### handlePostMessage
Per PART-008. Game-building rules:
- `gameState.phase = 'playing'` MUST be the FIRST assignment inside `game_init` case. No logic before it.
- The `message` listener MUST be registered BEFORE `game_ready` is sent.
- See `parts/PART-008.md` for full protocol.

### recordAttempt
Per PART-009. Game-building rules:
- All 12 fields from data-contract.md Section 2 must be present in every attempt.
- Track `gameState.roundStartTime = Date.now()` when each round renders so `response_time_ms` is accurate.
- See `parts/PART-009.md` for field list and code.

### trackEvent
Per PART-010. Game-building rules:
- Canonical events that MUST fire: `game_start`, `game_end`, `answer_submitted`, `round_complete`.
- See `parts/PART-010.md` for event schemas.

### endGame
Per PART-011. Game-building rules:
- `gameState.phase` assignment BEFORE `syncDOM()` call (GEN-PHASE-SEQUENCE).
- `game_complete` postMessage fires on BOTH victory and game-over paths (GEN-PM-DUAL-PATH).
- `accuracy` is integer 0-100, not float 0.0-1.0.
- `completedAt` is sibling of `metrics`, not nested inside.
- `gameState.gameEnded` guard prevents double-fire.
- See `parts/PART-011.md` for full code and metrics fields.

### ActionBar header refresh (score + question label) — MANDATORY

The header's `#previewScore` text (e.g. `"1/10"`) and `#previewQuestionLabel` (e.g. `"Q3"`) reflect the game's progression. They update ONLY when the game tells them to, via ONE of two paths:

**Path 1 — Direct pass-through methods (per-round / state-change moments).**

Use for everything EXCEPT the single end-of-game celebration. No animation, just a value bump.

```javascript
// Initial seed — call once from startGameAfterPreview() after previewScreen exists.
previewScreen.setQuestionLabel('Q1');
previewScreen.setScore('0/' + gameState.totalRounds);

// Correct answer mid-round — immediate score bump, NO star-flying animation.
previewScreen.setScore(gameState.score + '/' + gameState.totalRounds);

// Round advance (new round begins — multi-round games).
previewScreen.setQuestionLabel('Q' + (gameState.currentRound + 1));

// Any non-award score mutation (partial credit, penalty, undo).
previewScreen.setScore(gameState.score + '/' + gameState.totalRounds);
```

**Path 2 — `show_star` payload (end-of-game celebration only).**

`show_star` fires the big flying-star animation into the header. It is a ONE-TIME celebration triggered at the end of the game — NOT per round. Firing it on every correct answer in a 10-round game plays 10 animations and spams the user.

Fire `show_star` exactly ONCE per game session, at the end-of-game celebration beat:
- **Standalone** (`totalRounds: 1`): inside `endGame` / feedback sequence, after all feedback audio completes.
- **Multi-round** (`totalRounds > 1`): inside the victory / stars-collected TransitionScreen's `onMounted` (or `onDismiss`), after celebration audio — NOT inside the per-round correct handler.

```javascript
// End-of-game victory — the one place show_star belongs.
window.postMessage({
  type: 'show_star',
  data: {
    count: gameState.stars || 1,         // 1-3 stars earned overall
    variant: 'yellow',
    score: gameState.score + '/' + gameState.totalRounds
  }
}, '*');
```

**`count` and `score` must agree.** Whatever number your `count` visually communicates, the `score` text should express the same quantity as a fraction. If the player sees ×2 stars fly, the header should read `X+2/Y` not `X+1/Y`. Mis-matched games have been rejected in QA (solve-for-x-speed-round — ×2 animation, `/1` score).

| Game shape | `count` source | `score` string to send |
|---|---|---|
| Multi-round, 1 star per correct round (cumulative rating) | `gameState.stars || 1` | `gameState.score + '/' + gameState.totalRounds` |
| Standalone, 1 round awards up to N stars (e.g. lives-based rating) | `Math.max(1, Math.min(N, stars))` | `stars + '/' + N` |
| Cumulative star points (multi-round, varying per-round awards) | stars awarded this game | `(gameState.totalStars) + '/' + gameState.maxStars` |

**Do NOT fire `show_star` per round.** Regression from equivalent-ratio-quest: mid-round correct handlers fired `show_star`, so players saw the flying-star animation ten times in a row. Use `previewScreen.setScore(...)` for per-round bumps; `show_star` is reserved for the one end-of-game celebration.

**Do NOT re-post `game_init` from the game.** The game's own `handlePostMessage` listener catches `game_init` and runs `setupGame()` — a re-fire with just `{data:{score:'1/10'}}` triggers `setupGame()` with fallback content and resets everything. Use the direct methods / end-of-game show_star only; they mutate header DOM in-process and bypass the message bus entirely.

**Validator gate:** `GEN-HEADER-REFRESH` errors if a FloatingButton-using, PreviewScreen-using game contains neither `previewScreen.setScore(` nor a show_star payload with a `score:` field. Step 5 rejects the build until one is present. A separate check flags show_star used more than once per session.

### Star-award animation (`show_star`)
Per PART-040 + PART-050. Intra-frame postMessage that animates a flying star into the ActionBar header, plays an award chime, upgrades the header's static star image to match the awarded tier, and (optionally) updates the header score text at animation end.

- **Target is `window`, NOT `window.parent`.** ActionBar listens in the same frame as the game. `window.parent.postMessage(...)` goes to the host and ActionBar never sees it.
- **Default trigger spots (generator-emitted).** Fired automatically at PART-050's end-of-game spot — before `floatingBtn.setMode('next')` in standalone, inside `transitionScreen.onDismiss` in multi-round. Spec opt-out: `spec.autoShowStar: false`.
- **Serial ordering (MANDATORY).** At end-of-game, fire `show_star` ONLY after ALL feedback audio (SFX + dynamic TTS) has finished awaiting. The flying star is a visual follow-on to the spoken feedback, not a parallel effect. User-visible order is SFX → feedback panel → TTS (awaited) → star animation → Next.
  - **Beat 1: `await FeedbackManager.sound.play(...)`** — SFX + sticker, min 1500 ms.
  - **Beat 2: render feedback panel + `postGameComplete()`** — SYNC; never block on TTS.
  - **Beat 3: `await FeedbackManager.playDynamicFeedback({...})`** — dynamic TTS, if the game uses it. AWAIT IT; fire-and-forget here causes the star animation and Next button to overlap with TTS audio, which is a regression (bodmas-blitz 2026-04-24).
  - **Beat 4: fire `show_star` postMessage** — animation plays ~1 s, score applied at animation end.
  - **Beat 5: `setTimeout(function(){ floatingBtn.setMode('next'); }, 1100)`** — Next appears AFTER the animation finishes. Shorten to 300 ms only if `spec.autoShowStar === false`.
- **Claim-Stars button (opt-in).** TransitionScreen has no knowledge of the star protocol — authors fire `show_star` from the button's own `action()`. Fully customizable; pair with `spec.autoShowStar: false` to avoid the generator-emitted default firing as well.
- **Score bump is part of the celebration.** Pass `score: gameState.score + '/' + gameState.totalRounds` in the payload — ActionBar updates `#previewScore` AFTER the 1 s animation finishes, so the celebration visibly precedes the number change (matches mathai-client UX).
- **Dedupe + queue.** ActionBar swallows identical payloads within 500 ms; distinct payloads in flight are queued (max 3). Over-firing identical payloads is safe, but distinct double-fires WILL play twice — turn off the generator default when you want full control.

```javascript
// Correct-answer path — MANDATORY includes score so the header count bumps
// after the animation finishes (GEN-HEADER-REFRESH).
window.postMessage({
  type: 'show_star',
  data: {
    count: gameState.stars || 1,
    variant: 'yellow',
    score: gameState.score + '/' + gameState.totalRounds
  }
}, '*');

// Claim-Stars pattern: author fires from the button's own action().
// Remember to set spec.autoShowStar: false so the generator default
// doesn't also emit a show_star in onDismiss.
transitionScreen.show({
  stars: 3,
  buttons: [{
    text: 'Claim Stars',
    type: 'primary',
    action: () => {
      window.postMessage({
        type: 'show_star',
        data: {
          count: 3,
          variant: 'yellow',
          score: gameState.score + '/' + gameState.totalRounds
        }
      }, '*');
      transitionScreen.hide();
      floatingBtn.setMode('next');
    }
  }]
});
```

Payload fields: `count` ∈ {1,2,3} default 1; `variant` ∈ {'yellow','blue'} default 'yellow'; `silent: boolean` default false; `score: string` optional (applied to `#previewScore` at animation end); `questionLabel: string` optional (same timing for `#previewQuestionLabel`). See PART-040's "show_star payload contract" for the full table.

### FeedbackManager Integration
Per PART-017 and `skills/feedback/SKILL.md`. Game-building rules:
- **CDN script:** `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`
- **Init:** `await FeedbackManager.init()` in DOMContentLoaded
- **Preload:** `await FeedbackManager.sound.preload([...])` with exact SFX URLs from `feedback/reference/feedbackmanager-api.md`
- **Static SFX:** `await FeedbackManager.sound.play(id, {sticker: STICKER_URL})` — sticker is a string URL. Awaited for terminal moments, fire-and-forget for mid-round
- **CRITICAL — Minimum Feedback Duration:** `sound.play()` can resolve BEFORE audio finishes. ALL answer-feedback calls (`sound_life_lost`, `sound_correct`, `wrong_tap`, `correct_tap`, `sound_incorrect`, `all_correct`, `all_incorrect_*`, `partial_correct_*`) MUST use `Promise.all` with a 1500ms floor: `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ]);` — guarantees audio fully plays before round advance / tile reset / game-over. Does NOT apply to VO or transition audio. Validator rule `5e0-FEEDBACK-MIN-DURATION`. See PART-026 Anti-Pattern 34.
- **Dynamic VO:** `await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` — all VO is dynamic TTS, never preloaded
- **Sequential audio (transitions, end-game, SFX+TTS):** Always `await` first audio before starting second. Never fire both simultaneously. Use `audioStopped` flag to prevent second audio if CTA tapped during first:
  ```javascript
  var audioStopped = false;
  ctaButton.onclick = function() { audioStopped = true; FeedbackManager.sound.stopAll(); FeedbackManager._stopCurrentDynamic(); proceed(); };
  try {
    await FeedbackManager.sound.play('rounds_sound_effect', {sticker});
    if (audioStopped) return;
    await FeedbackManager.playDynamicFeedback({audio_content: 'Round 3', subtitle: 'Round 3', sticker});
  } catch(e) {}
  ```
- **Stop:** `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()` on CTA taps
- **Pause/Resume:** `FeedbackManager.sound.pause()/resume()` + `FeedbackManager.stream.pauseAll()/resumeAll()` on visibility change
- Subtitle under 60 chars. Never use "wrong" -- use "Not quite," "Close," "Almost."
- **No `Promise.race` on FeedbackManager calls (CRITICAL).** Package already bounds resolution (`sound.play` → audio-duration + 1.5s guard; `playDynamicFeedback` → 60s streaming / 3s TTS API). Plain `await FeedbackManager.sound.play(...)` / `await FeedbackManager.playDynamicFeedback(...)` inside `try/catch` is the only correct pattern — "non-blocking" means `try/catch`, NOT `Promise.race`. A helper like `audioRace(p) => Promise.race([p, setTimeout(r, 800)])` truncates normal TTS (1–3s) and causes phase/round transitions to fire before audio ends. Validator rule `5e0-FEEDBACK-RACE-FORBIDDEN` blocks any such race. See PART-017 + PART-026 Anti-Pattern 32.
- See `skills/feedback/SKILL.md` for all 17 behavioral cases and `feedback/reference/feedbackmanager-api.md` for CDN URLs.

### ScreenLayout.inject
Per PART-025. Game-building rules:
- MUST be called to create the layout scaffold. Without it, `#gameContent` never exists.
- Use the `slots` API with `previewScreen: true` (default). The `sections` API is NOT valid.
- See `parts/PART-025.md` for full options.

### TransitionScreen
Per PART-024. Game-building rules:
- `transitionScreen.show()` takes ONE argument -- an options object (GEN-TRANSITION-API).
- `icons` array must contain emoji strings only, never SVG/HTML/paths (GEN-TRANSITION-ICONS).
- ALL `transitionScreen.show()` calls MUST be awaited (returns a Promise).
- **Every transition screen MUST play audio** (SFX ± dynamic VO). No silent transitions. Fire via the `onMounted` callback: `onMounted: () => FeedbackManager.sound.play('<id>', { sticker })`. Approved IDs per PART-024: `vo_game_start`, `sound_game_complete`, `sound_game_over`, `vo_level_start_N`, `vo_motivation`.
- **`stars:` and `icons:` are mutually exclusive.** TransitionScreenComponent renders them into the same `.mathai-ts-icons` DOM element — `stars:` always wins, so any `icons: [...]` emoji silently disappears. Pick one per screen: Victory passes `stars: N`; Game Over / Round Intro / Motivation / Stars Collected pass `icons: ['<emoji>']`. Do NOT pass both. `test/content-match.test.js` fails the build if you do.
- **CRITICAL: `show()` Promise resolves IMMEDIATELY (next rAF after `onMounted` fires) — NOT when a button is tapped, NOT after a `duration`.** `duration` and `persist` are documented in the options table but the CDN component does NOT implement either — `show()` never reads them. Code after `await transitionScreen.show(...)` runs before the student interacts with the screen. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. If you put continuation code after `await show()`, the screen flashes for one frame then gets replaced. For auto-dismiss screens (round intro), fire audio + `hide()` + continuation inside the `onMounted` IIFE. Validator rule `5e2-TS-PERSIST-FALLTHROUGH` blocks the anti-pattern.
- **Audio + render sequence for Victory / Game Over:** `await transitionScreen.show({ content: metricsHTML, buttons: [...], onMounted: () => FeedbackManager.sound.play(...) })`. The `onMounted` fires the audio after DOM mounts. If a button click should interrupt audio, call `FeedbackManager.sound.stopAll()` in the `action` handler. The button `action` callback MUST contain `transitionScreen.hide()` AND all game-flow continuation (`restartGame()`, `showMotivation()`, etc.).
- Button labels come from `pre-generation/screens.md` verbatim. See "Plan → build contract" in `flow-implementation.md`.
- See `parts/PART-024.md` for full API.

### ProgressBarComponent
Per PART-023. Game-building rules:
- CDN ProgressBarComponent renders round counter + lives. Do NOT render these yourself.
- **CRITICAL: No custom lives/hearts DOM or renderer.** When `totalLives >= 1`, ProgressBar already paints the hearts strip inside `#mathai-progress-slot`. Any game-owned element with `class`/`id` matching `lives-row`, `lives-strip`, `lives-container`, `lives-display`, `hearts-row`, `hearts-strip`, `hearts-container`, `livesRow`, `heartsRow`, or a single-class `heart` — or any function named `renderLivesRow`, `renderLives`, `renderHearts`, `updateLivesDisplay`, `updateLivesRow`, `updateHearts`, `buildLives`, `injectLives` — paints a **second** hearts row on top of the CDN strip (symptom: two rows of hearts visible on-screen). Validator rule `5e0-LIVES-DUP-FORBIDDEN` blocks this. Emit heart glyphs (❤️ 🤍 🩷 ♡ ♥) ONLY through the CDN ProgressBar, never via your own `innerHTML` strings or `<span class="heart">` loops. For a heart-break animation, target the CDN-rendered heart class with a one-shot CSS class — do NOT replicate the hearts in your own DOM. See PART-023 and PART-026 Anti-Pattern 33.
- `totalLives` must be >= 1 (GEN-PROGRESSBAR-LIVES). Passing 0 causes division-by-zero.
- `slotId` must be exactly `'mathai-progress-slot'` (GEN-UX-003). **Do NOT use `'previewProgressBar'`** or `'progress-bar-container'` — those are different things (see ID disambiguation below).
- **ID disambiguation.** `#previewProgressBar` is the audio countdown strip **inside the preview header** (~4px tall, populated by PreviewScreenComponent during preview state — it animates full → empty as preview audio plays). `#mathai-progress-slot` is a **separate** element ScreenLayout creates at the top of `.game-stack` for the round counter + lives bar. Two different elements, two different purposes. If you instantiate ProgressBarComponent with `slotId: 'previewProgressBar'`, the round bar mounts into the countdown strip and crushes the whole header row.
- `ScreenLayout.inject` slots MUST include `progressBar: true` for the slot to be created in preview-wrapper mode (`slots: { previewScreen: true, progressBar: true, transitionScreen: true }`).
- **`update(progress, livesRemaining)` — INVARIANT: `progress` starts at `0` when the game begins, never at `1`.** The first `progressBar.update()` call on the initial flow path (inside `startGame` / `startGameAfterPreview` / the `DOMContentLoaded` init path) MUST be `update(0, totalLives)`. Validator rule `5e0-PROGRESSBAR-START-ONE` blocks any first-call whose first arg is not literal `0` (e.g. `update(currentRound + 1, …)`, `update(1, …)`). On restart (before the first new round): `update(0, totalLives)`.
- **Increment policy is game-specific.** What `progress` counts — rounds completed, correct answers, points earned, section progress, etc. — is defined per game. The skill does NOT prescribe a single policy. Pick the metric that matches your spec and increment it when that metric changes. The canonical "rounds completed, incremented on correct feedback" loop in `flow-implementation.md` is ONE example of the invariant; swap the increment condition to match your progression metric.
- `livesRemaining` MUST be clamped: `progressBar.update(progress, Math.max(0, lives))` (LP-PROGRESSBAR-CLAMP). Passing a negative value (e.g. after the last wrong answer decrements to -1) throws a RangeError inside the CDN component.
- First arg to `update()` is a **progression counter**, never `totalRounds` (GEN-112) — the component computes `progress / totalRounds` internally from the constructor's `totalRounds`.
- Never wrap `destroy()` in `setTimeout` -- synchronous only (GEN-PROGRESSBAR-DESTROY).
- See `parts/PART-023.md` for constructor options and createProgressBar helper.

### FloatingButtonComponent
Per PART-050. Game-building rules:
- **Required when the spec has a Submit CTA.** If the flow evaluates the player's answer on demand (text input, DnD completion, option commit), instantiate `FloatingButtonComponent` and do NOT hand-roll a submit button inside `#gameContent`.
- **Per-game opt-out (`floatingButton: false` in spec.md):** mirrors PART-039's `previewScreen: false` pattern. When the spec declares a top-level `floatingButton: false` (e.g. `**Floating button:** false`), the validator auto-skips all FloatingButton rules and the author hand-rolls Submit / Retry / Next inline per PART-022. Two reasons this flag is set: (1) the flow has no Submit CTA at all (timer-driven auto-advance, drag-to-commit), (2) the spec author deliberately prefers inline buttons for this specific game. **CRITICAL: step 4 (Build) MUST NOT write `floatingButton: false` into `spec.md` to silence a validator error.** Spec mutations during build show up in `git diff` and are a scope violation the user can revert. If you cannot make the game pass with FloatingButton, report the blocker — do not silence the rule by editing the spec.
- **No narrative opt-out. Validator rule `GEN-FLOATING-BUTTON-MISSING` has no escape hatch.** Do NOT reason yourself out of using FloatingButton with any of these (all WRONG):
  - "Standalone totalRounds:1 game, no retry/next lifecycle needed" — FloatingButton works in submit-only mode; retry/next are optional modes, not required.
  - "Submit sits inside the form next to the input, it's an in-form button" — inputs stay in `#gameContent`, only the button moves to the floating slot.
  - "Archetype profile doesn't list PART-050" — the archetype row is a default starting point; the spec's flow (presence of a Submit CTA) overrides it per game-archetypes constraint #8.
  - "Speed Blitz / Lives Challenge / [any archetype] doesn't need it" — if the spec mentions a Submit button, PART-050 applies, period.

  If the spec genuinely has no Submit CTA, do NOT emit any `<button>` whose id / class / data-testid / aria-label / text contains `submit` / `check` / `done` / `commit` — the flow should auto-evaluate on interaction instead.
- **CDN:** include `https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js` OR the bundled `components/index.js` (which loads it automatically). Missing tag → `GEN-FLOATING-BUTTON-CDN`.
- **Slot:** `ScreenLayout.inject(...)` MUST include `slots: { floatingButton: true, ... }`. Missing slot → `GEN-FLOATING-BUTTON-SLOT`.
- **Constructor:** `const floatingBtn = new FloatingButtonComponent({ slotId: 'mathai-floating-button-slot' });` — do NOT pass a different slotId; the slot is fixed-position and lives as a sibling of the layout root.
- **Visibility is game-state-driven, NOT interaction-driven.** Component starts hidden. Define an `isSubmittable()` predicate over `gameState` (e.g. `return gameState.userInput.trim() !== '';`, or `return gameState.placedTiles.length === gameState.expectedTiles;`). Call `floatingBtn.setSubmittable(isSubmittable())` from EVERY handler that can change the predicate's value: `input`, `change`, `keyup` on inputs; `click` on option chips; `drop` / `dragend` on DnD targets; any programmatic state mutation (undo, reset, clear). Never show-once and rely on a single flip — the button must disappear again when the player clears their input. Missing predicate wiring → `GEN-FLOATING-BUTTON-PREDICATE`.
- **Submit handler (auto-hide on click):** when the player taps Submit, the component **auto-hides the button immediately** (internal `setMode(null)` before the handler runs). No need to return a Promise or manually call `setDisabled` — the hide is automatic, regardless of whether the handler is sync or async. The handler's job is to evaluate, await feedback, and then re-show the button in the NEXT mode: `setMode('retry')` (standalone + lives remaining), `setMode(null)` (multi-round mid-game — predicate re-drives on the next interaction), or continue to end-game flow. Register as `floatingBtn.on('submit', async () => { /* evaluate, await feedback, setMode('retry' | null) */ });`. Sync fire-and-forget is also safe: `floatingBtn.on('submit', () => { handleSubmit(...); })` — the button hides immediately and the async `handleSubmit` flips mode when done. Do NOT directly flip `setMode('next')` from the submit handler — Next appears AFTER the end TransitionScreen dismisses (multi-round) or AFTER the inline-feedback renders (standalone), not as a reaction to submit.
- **Next flow — Next is the LAST thing the player sees.** Every FloatingButton-using game MUST wire the Next button, AND `setMode('next')` MUST happen only AFTER feedback audio has completed. The sequence differs by shape:

  **Standalone (`totalRounds: 1`) — NO TransitionScreen.** The inline feedback panel in `#gameContent` IS the end-of-game display. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks TransitionScreen usage in standalone.
  ```js
  async function endGame(correct) {
    await FeedbackManager.play(correct ? 'correct' : 'incorrect');   // 1. await feedback
    renderInlineFeedbackPanel(correct);                               // 2. update #gameContent
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');  // 3. post
    floatingBtn.setMode('next');                                      // 4. Next appears
  }

  floatingBtn.on('next', function () {
    window.parent.postMessage({ type: 'next_ended' }, '*');
    floatingBtn.destroy();
  });
  ```
  ScreenLayout.inject() for standalone omits `transitionScreen`: `slots: { floatingButton: true, previewScreen: true }` (no `transitionScreen` key).

  **Multi-round (`totalRounds > 1`) — TransitionScreen with `buttons: []` + onDismiss.**
  ```js
  async function endRound(correct) {
    await FeedbackManager.play(correct ? 'correct' : 'incorrect');   // 1. await feedback
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');  // 2. post
    transitionScreen.show({ stars: correct?3:0, content: resultsHtml, buttons: [] });  // 3. no buttons
    transitionScreen.onDismiss(() => {                                // 4. dismiss callback
      transitionScreen.hide();
      floatingBtn.setMode('next');                                    // 5. Next appears
    });
  }

  floatingBtn.on('next', function () {
    window.parent.postMessage({ type: 'next_ended' }, '*');
    floatingBtn.destroy();
  });
  ```
  **BANNED patterns (validator `GEN-FLOATING-BUTTON-NEXT-TIMING` / `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` / `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` will block these):**
  - ❌ `postGameComplete(...); floatingBtn.setMode('next');` in the body of `endGame()` — Next appears during feedback audio (bodmas-blitz regression 2026-04-23).
  - ❌ `setMode('next')` in the same function as a `game_complete` postMessage without any `await` / `transitionScreen.onDismiss(` / `transitionScreen.hide()` separating them.
  - ❌ Fire-and-forget end-of-game feedback (`FeedbackManager.play(...).catch(...)` without `await`) — end-of-game feedback MUST be awaited so the TransitionScreen and Next button appear AFTER audio completes, not simultaneously.
  - ❌ **`transitionScreen.show({ buttons: [{ text: 'Next', action: function() { floatingBtn.setMode('next'); } }] })` — WRONG.** This produces a confusing double-Next UX (the card has a Next button whose click reveals ANOTHER Next button at the bottom). Victory / game_over TransitionScreens MUST use `buttons: []` (empty array). The player tap-dismisses the card; the FloatingButton Next appears only then. Any `text: 'Next' / 'Continue' / 'Done' / 'Finish' / 'Play Again'` inside a TransitionScreen's `buttons:` array fires `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`. Welcome / round-intro / motivation screens may still have buttons (`I'm ready`, `Let's go`, `Skip`) — those labels are not reserved.
  - ❌ **`transitionScreen.show(...)` OR `new TransitionScreenComponent(...)` in a standalone (`totalRounds: 1`) game — WRONG.** Standalone games have a single question, single submit, single end state — nothing to transition between. The inline feedback panel in `#gameContent` IS the end-of-game display. TransitionScreen in standalone is architecturally redundant AND invites the double-Next regression. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks this. Omit the `transitionScreen: true` slot from `ScreenLayout.inject()` and do NOT instantiate the component.

  Validator rules: `GEN-FLOATING-BUTTON-NEXT-MISSING`, `GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE`, `GEN-FLOATING-BUTTON-NEXT-TIMING`.
- **Try Again flow — standalone + `totalLives > 1` ONLY.** When the spec declares `totalRounds: 1` AND `totalLives > 1`, the Try Again path MUST be wired. Multi-round games use TransitionScreen retry buttons (out of scope). Canonical sequence:
  ```js
  // Inside the wrong-answer branch of on('submit'):
  gameState.lives -= 1;
  gameState.attempts.push({
    correct: false,
    is_retry: (gameState.retryCount || 0) > 0,
    /* other required fields */
  });
  await FeedbackManager.play('incorrect');

  if (gameState.lives > 0) {
    gameState.retryCount = (gameState.retryCount || 0) + 1;
    if (!RETRY_PRESERVES_INPUT) {
      inputEl.value = '';
      gameState.userInput = '';
    }
    gameState.isProcessing = false;            // re-enable interaction
    floatingBtn.setMode('retry');              // label: "Try again"
  } else {
    endGame(false);                            // out of lives — feeds into Next flow
  }

  floatingBtn.on('retry', function () {
    floatingBtn.setMode(null);                 // predicate takes over again
    if (inputEl && !RETRY_PRESERVES_INPUT) inputEl.focus();
  });
  ```
  `RETRY_PRESERVES_INPUT` is a game-scope const set from `spec.retryPreservesInput` (default `false` = clear input). The retry handler MUST preserve `gameState.lives`, `gameState.attempts`, `gameState.score`, and `gameState.retryCount` — NEVER reset them. Validator rules: `GEN-FLOATING-BUTTON-RETRY-STANDALONE`, `GEN-FLOATING-BUTTON-RETRY-LIVES-RESET`.
- **No duplicate buttons — DELETE, don't rename.** When FloatingButton is instantiated, NO other `<button>` in the source may carry a Submit / Check / Done / Commit / Retry / Next / CTA word in its **id, class, data-testid, aria-label, OR inner text**. Validator `5e0-FLOATING-BUTTON-DUP` scans all 5 attributes. **Known evasion pattern (do NOT attempt):** renaming `id="bbSubmitBtn" class="bb-submit"` to `id="bbGoBtn" class="bb-go"` while keeping `data-testid="bb-submit-btn"` and inner text `Submit` — rule still fires and the build fails. The correct fix is to DELETE the hand-rolled button entirely and wire its handler via `floatingBtn.on('submit', ...)`. If tests reference a `data-testid`, point them at the FloatingButton DOM (`.mathai-fb-btn-primary`), or add a `data-testid` via the FloatingButton API — do not keep a parallel button to satisfy tests. Reset remains inline per PART-022 — FloatingButton does NOT absorb Reset.
- **endGame:** call `floatingBtn.destroy()`.
- See `alfred/parts/PART-050.md` for the full API, dual-button variant, styling variables, and validator rule list.

### Debug Functions
Per PART-012. See `parts/PART-012.md`.

### SignalCollector
Per PART-042. Game-building rules:
- `restartGame` must call `signalCollector.reset()` — do NOT seal + re-instantiate (GEN-SIGNAL-RESET).
- See `parts/PART-042.md` for full API.

### PreviewScreen
Per PART-039. Game-building rules:
- **Default ON, opt-out via spec.** Every game includes the preview UNLESS the spec declares top-level `previewScreen: false`. When enabled (the default), `ScreenLayout.inject` must include `slots: { previewScreen: true, ... }` and the rules below apply. When opted out: OMIT the `previewScreen` key from `slots` entirely, do NOT instantiate `PreviewScreenComponent`, do NOT emit any `#mathai-preview-slot` / `.mathai-preview-body` references, and have `DOMContentLoaded` call the first TransitionScreen (level/round intro) directly — no `setupGame()` / `showPreviewScreen()`. Existing pre-PART-039 templates (`make-x`, `estimate-it`, `keep-track`) show the no-preview initial-screen pattern. The rest of this section applies only to the enabled case.
- **Single source of instructions — STRICT.** The how-to-play copy is delivered ONCE via `content.previewInstruction` + `content.previewAudioText`. Gameplay screens (the DOM inside `#gameContent`) MUST NOT render ANY of the following:
  - A static instruction / prompt banner repeating or paraphrasing the preview instruction (e.g. "Find the two tiles...", "Tap two tiles...", "Select the correct answer").
  - Any element with a class/id containing `instruction`, `help-text`, `prompt-text`, `task-text`, `directions`, `how-to-play`.
  - Verbs like "Find", "Tap", "Select", "Choose", "Click", "Drag" as a heading/banner inside `#gameContent`. The preview already said it.
  A per-round *prompt* is allowed ONLY when it carries round-specific information that is NOT in the preview (e.g. "What is 3 × 4?" — the question itself; "Match the shapes below" after a round-type change screen). Generic how-to-play restated in different words is NOT distinct — it duplicates.
  When in doubt: omit the gameplay banner. Players already heard/read the preview. If the round-type change is material, convey it via a Round-N-intro TransitionScreen, not a banner.
- Instantiated in DOMContentLoaded with `{ slotId: 'mathai-preview-slot' }` only. Do NOT pass `autoInject`, `gameContentId`, `previewContent`, `questionLabel`, `score`, or `showStar`.
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview, onComplete })` is called as the LAST step of `setupGame()` — after `#gameContent` has been rendered. The `show()` option list is **exactly** those four keys plus optional `onPreviewInteraction`; no other options are accepted.
- Preview audio URL sourced from `content.previewAudio || fallbackContent.previewAudio || null`. Never hardcode.
- **Audio URL source hierarchy** (PART-039 layer order): `content.previewAudio` → `fallbackContent.previewAudio` → runtime TTS fallback using `previewAudioText` → 5s silent timer. The component handles the TTS fallback internally when `audioUrl` is null; you do NOT need to generate TTS yourself at runtime. Deploy step patches `fallbackContent.previewAudio` with a CDN URL from `previewAudioText` TTS.
- **`previewScreen.isActive()`** returns `true` while the preview overlay is mounted (between `show()` and `switchToGame()`). Use this in any timed fallback (setTimeout, requestIdleCallback, race-guards) that might otherwise fire during a live preview. Preview does NOT mutate `gameState.phase`, so `phase === 'start_screen'` stays true for the entire preview — `isActive()` is the authoritative signal. See `html-template.md` rule 11 (standalone-fallback gate).
- `onComplete` callback receives `previewData` and must call `startGameAfterPreview(previewData)` — see pattern below.
- `endGame()` calls `previewScreen.destroy()`.
- `restartGame()` must NOT call `previewScreen.show()` or `setupGame()` — preview is once per session.
- `hide()` does NOT exist. Do not call it.
- VisibilityTracker's `onInactive`/`onResume` must also invoke `previewScreen.pause()`/`previewScreen.resume()`. The pause popup itself is rendered by `VisibilityTracker`'s built-in `PopupComponent` — leave `autoShowPopup` at its default (`true`) and customize copy via `popupProps`. **Never** build a game-local pause overlay. Canonical wiring:
  ```javascript
  visibilityTracker = new VisibilityTracker({
    // autoShowPopup defaults to true — do NOT set to false
    popupProps: {
      // Optional copy overrides; defaults are "Resume Activity" / "Resume"
      // title: 'Paused',
      // description: 'Tap Resume to continue.',
      // primaryText: 'Resume',
    },
    onInactive: function() {
      try { FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); } catch(e) {}
      try { if (timer) timer.pause({ fromVisibilityTracker: true }); } catch(e) {}
      try { if (previewScreen) previewScreen.pause(); } catch(e) {}
    },
    onResume: function() {
      try { FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); } catch(e) {}
      try { if (timer) timer.resume({ fromVisibilityTracker: true }); } catch(e) {}
      try { if (previewScreen) previewScreen.resume(); } catch(e) {}
    }
  });
  ```
- **Header star runtime toggle.** `previewScreen.setStar(visible: boolean)` hides or shows the header star at runtime (use-case: clear the star indicator after a wrong answer, re-show on next round).
- **Instruction persists in game state — do NOT hide it.** After `switchToGame()`, `#previewInstruction` stays rendered above `#gameContent` in the shared scroll container. This is a product requirement: students must be able to scroll up to re-read the instruction at any time. Do not write code that toggles `#previewInstruction`, `.mathai-preview-header`, `#mathai-preview-slot` visibility, or any `.mathai-preview-*` class. If the stacked preview-text + game layout feels cramped in your game, fix it inside `#gameContent` (tighter game UI, shorter `fallbackContent.previewInstruction`) — never by reaching into preview DOM. Validator rule `5e0-DOM-BOUNDARY` enforces the ban.
- See `parts/PART-039.md` for full API and `warehouse/parts/PART-039-preview-screen.md` for the authoritative spec.

---

## Game-Building Procedures (HOW to wire components together)

### syncDOM

```javascript
function syncDOM() {
  var app = document.getElementById('app');
  if (!app) return;
  app.setAttribute('data-phase', gameState.phase);
  app.setAttribute('data-score', gameState.score);
  // Lives games: app.setAttribute('data-lives', gameState.lives);
  // Recommended: app.setAttribute('data-round', gameState.currentRound);
}
```

**Mandatory call sites -- syncDOM MUST be called immediately after every gameState change:**
phase change, score change, lives change, round advance. At minimum 3 calls (GEN-PHASE-MCQ).
**Target:** Always `#app`. Never `document.body`. Test harness reads `#app[data-phase]`.

### Initialization Sequence

```javascript
// 1. Register listener FIRST (so game_init is not missed)
window.addEventListener('message', handlePostMessage);
// 2. Signal ready AFTER listener
window.parent.postMessage({ type: 'game_ready' }, '*');
// 3. Wait for CDN packages, then init
waitForPackages().then(function() {
  initVisibilityTracker();
  syncDOM();
  render();
});
```

### startGame

```javascript
function startGame() {
  if (gameState.isActive) return;
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.duration_data.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.isProcessing = false;
  gameState.gameEnded = false;
  gameState.phase = 'gameplay';
  // Lives games: gameState.lives = gameState.totalLives;
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  syncDOM();
  render();
}
window.startGame = startGame;
```

### Answer Handler Sequence

The core game loop MUST follow this order:
1. Guard: `if (gameState.isProcessing || gameState.gameEnded) return;` then `isProcessing = true`
2. Evaluate correctness
3. `recordAttempt()` (per PART-009 -- all 12 fields)
4. `trackEvent('answer_submitted', ...)` (per PART-010)
5. Update score/lives, `syncDOM()`, AND **refresh the ActionBar header** via `previewScreen.setScore(gameState.score + '/' + gameState.totalRounds)`. Call `previewScreen.setQuestionLabel('Q' + (gameState.currentRound + 1))` on round advance. Use the direct methods — NEVER re-post `game_init`, because the game's own `handlePostMessage` listens on the same window and would re-run `setupGame()` with fallback content. See PART-040 "Updating header state from game code".
6. Visual feedback (selected-wrong/selected-correct classes, correct-reveal)
7. FeedbackManager audio (per `skills/feedback/SKILL.md`):
   - **Single-step correct/wrong (DEFAULT):** `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ])` → `await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})` ��� SFX wrapped in Promise.all for minimum duration, then dynamic TTS awaited sequentially. Dynamic TTS ALWAYS plays with context-aware explanation.
   - **Multi-step mid-round match:** `FeedbackManager.sound.play(id, {sticker}).catch(...)` — fire-and-forget. NO dynamic TTS, NO subtitle. SFX + sticker only.
   - Last-life wrong: ALWAYS play wrong SFX (awaited, Promise.all 1500ms min) BEFORE endGame(false) — never skip
8. `isProcessing = false`, `trackEvent('round_complete')`, check end conditions, advance round

### resetGame (restartGame)

Must reset ALL mutable state: `phase`, `currentRound`, `score`, `attempts`, `events`, `duration_data`, `isActive`, `isProcessing`, `gameEnded`, plus game-specific fields (GEN-RESTART-RESET). Lives games reset `lives`. Then `syncDOM()` + `render()`.

```javascript
window.restartGame = resetGame;  // REQUIRED -- replay tests call this
```

**Do NOT call `previewScreen.show()` or `setupGame()` from `restartGame()`.** Preview is shown once per session. Split the reset portion from the preview portion of `setupGame()` — `restartGame` reruns only the reset + first-round entry.

### Preview screen integration (setupGame + startGameAfterPreview)

Canonical trio per PART-039. Game DOM MUST be rendered into `#gameContent` BEFORE `previewScreen.show()` is called; `gameState.startTime` is set in `startGameAfterPreview`, NOT in `setupGame`.

```javascript
function setupGame() {
  var content = gameState.content || fallbackContent;
  // 1. Render initial round UI into #gameContent FIRST
  injectGameHTML();
  renderInitialState();

  // 2. Show preview LAST
  previewScreen.show({
    instruction: content.previewInstruction || fallbackContent.previewInstruction,
    audioUrl: content.previewAudio || fallbackContent.previewAudio || null,
    showGameOnPreview: content.showGameOnPreview === true,
    onComplete: function(previewData) { startGameAfterPreview(previewData); }
  });
}

function startGameAfterPreview(previewData) {
  gameState.previewResult = previewData;
  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (timer && timer.start) timer.start();
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  if (signalCollector) signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });

  renderRound(); // first gameplay entry
}
```

**Restart path** (no preview):
```javascript
function restartGame() {
  resetGameState();               // reset all fields per GEN-RESTART-RESET
  if (signalCollector) signalCollector.reset();
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();
  // Progress bar reset — universal safety net.
  // Idempotent if Motivation's onMounted already reset it; authoritative if the
  // flow has no Motivation screen (spec override, or Try Again / Play Again routed
  // directly here). See flow-implementation.md § "Restart-path reset — placement by flow shape".
  if (progressBar) progressBar.update(0, gameState.totalLives);
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  renderRound();  // or showLevelTransition() for sectioned games
}
```

`endGame()` must call `previewScreen.destroy()` as part of cleanup.

### Wrapper persistence — showVictory / showGameOver pattern (CRITICAL)

Victory, Game Over, Play Again, and Try Again render **inside** the preview wrapper. The header (avatar, score, star) stays visible; the preview slot is never hidden or detached. Mount results via `TransitionScreenComponent.show(...)` into `mathai-transition-slot` (a sibling of `#gameContent` inside `.game-stack`). Do NOT create a top-level `#results-screen` overlay, do NOT call `previewScreen.destroy()` at this point, do NOT set `style.display='none'` on `mathai-preview-slot`, and do NOT re-parent `#gameContent`.

**Results mounting rule (PART-024):** pass the results metrics HTML via `transitionScreen.show({ content: metricsHTML, persist: true, buttons: [...] })`. `content` is rendered inside the transition card; `persist: true` keeps it visible until a button is tapped. Never create a sibling `<div id="results-screen">` overlay and never hide the preview wrapper to make room for it.

**All user-visible strings come from `pre-generation/screens.md`, not from this file.** The snippets below show *structure*; **title, subtitle, button labels (count + order), sticker/icon emoji, and audio id** for each transition are copied verbatim from the corresponding Elements table in `screens.md`. Do NOT invent extra buttons, do NOT rename buttons, do NOT alter titles/subtitles. Template variables in screens.md (`N`, `M`, `[Title]`, numeric examples like `"Round 1"`) are matched via placeholder — your HTML can concatenate `'Round ' + roundNum` and still match. `test/content-match.test.js` enforces this and fails the build on drift.

**Default transition screens** — `game_over`, `motivation`, `victory`, `stars_collected` have canonical templates in `alfred/skills/game-planning/reference/default-transition-screens.md`. The planner copies those verbatim into `screens.md`; game-building reads screens.md and emits the matching `transitionScreen.show(...)`. Short summary of the structural defaults (strings live in the planning doc):
- **Game Over** → `icons: ['😔']`, title "Game Over", subtitle "You ran out of lives!", single `Try Again` button.
- **Motivation** → no icons, title "Ready to improve your score? ⚡", single `I'm ready! 🙌` button.
- **Victory** → `stars: gameState.stars`, title "Victory 🎉", per-game subtitle, buttons depend on stars: `Claim Stars` alone for 3★, `Play Again` + `Claim Stars` (horizontal) otherwise.
- **Stars Collected** → no icons/stars/subtitle/buttons, two-line title via `styles: { title: { whiteSpace: 'pre-line' } }`, auto-dismiss via `duration: 2500`.

```javascript
async function showVictory() {
  gameState.phase = 'results';
  gameState.isActive = false;
  syncDOM();
  progressBar.update(totalRounds, gameState.livesLeft);
  await transitionScreen.show({
    title: /* from screens.md */ 'Victory!',
    stars: getStars(),
    // Buttons: copy verbatim from screens.md Elements table for the victory screen.
    // Include conditional rules (e.g. "Play Again only if stars < 3") if screens.md states them.
    buttons: [
      // { text: '<exact label from screens.md>', type: 'primary', action: () => { transitionScreen.hide(); /* route per screens.md exit condition */ } }
    ],
    onMounted: () => FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })
  });
}

async function showGameOver() {
  gameState.phase = 'game_over';
  gameState.isActive = false;
  syncDOM();
  await transitionScreen.show({
    title: /* from screens.md */ 'Game Over',
    // Buttons: copy verbatim from screens.md. Do NOT add an Exit/Cancel/Skip unless screens.md lists one.
    buttons: [
      // { text: '<exact label from screens.md>', type: 'primary', action: () => { transitionScreen.hide(); /* route per screens.md exit condition */ } }
    ],
    onMounted: () => FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })
  });
}

// ONE endGame — the only place destroy() fires.
function endGame(won) {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  trackEvent('game_end', { won: won, score: gameState.score, stars: getStars() });
  postGameComplete(won);          // includes previewResult: gameState.previewResult || null
  previewScreen.destroy();        // EXACTLY ONCE, HERE
}
```

### Game timer

When the game has a `TimerComponent`, instantiate it into a container inside `#gameContent` and own its full lifecycle:
- `timer.start()` in `startGameAfterPreview()`
- `timer.pause()` / `timer.resume()` from VisibilityTracker's `onInactive` / `onResume` callbacks, so the countdown freezes while the tab is hidden
- `timer.reset()` on restart

### Round-complete handler — progress bar bumps FIRST (ordering rule)

Every round-complete handler (the code path that fires when the round's progression metric changes) **MUST** bump the progress bar BEFORE any awaited SFX / VO / transition:

```javascript
if (progressBar) {
  // gameState.progress is whatever counter this game tracks (rounds completed,
  // correct answers, points earned, section progress, …). Increment the counter
  // in state FIRST, then pass the new value here.
  try { progressBar.update(gameState.progress, Math.max(0, gameState.lives)); } catch (e) {}
}
```

BEFORE any of: awaited round-complete SFX, sticker, subtitle, VO, `trackEvent('round_complete', ...)`, `nextRound()`, `endGame('victory')`.

Why: round-complete SFX is typically awaited (1–2s) and the final round hands off directly to `endGame('victory')` → Victory transition. If the bar is updated after the await, the Victory screen renders with the bar still at the previous value. Bumping first makes the bar paint the new value the instant the metric changes, in sync with the visual "green / locked" state. Same ordering principle as `recordAttempt`-before-audio — data/UI first, audio/transitions second. PART-023 + feedback/SKILL.md ordering priority 0.

Note: the counter itself is game-specific (see the ProgressBarComponent section above). Only the **ordering** rule — bump before await — is universal. The *start-at-0* invariant still applies: the very first `progressBar.update()` on the init path is `update(0, totalLives)`, regardless of what increment policy this handler uses later.

**Anti-pattern — bar updated after the await:**

```javascript
// WRONG — Victory renders with the pre-bump value on the final round
async function onRoundComplete() {
  await FeedbackManager.sound.play('all_correct', { ... });
  progressBar.update(gameState.progress, gameState.lives);   // too late
  if (lastRound) endGame('victory');
}
```

**Correct — bar updated first:**

```javascript
async function onRoundComplete() {
  gameState.progress++;                                                        // bump state first
  progressBar.update(gameState.progress, Math.max(0, gameState.lives));        // then UI
  await FeedbackManager.sound.play('all_correct', { ... });                    // then SFX
  if (lastRound) endGame('victory');                                           // then transition
}
```

### Preview timer sync — the game must render its own timer; do NOT rely on PreviewScreen mirroring

`timerConfig` and `timerInstance` on `previewScreen.show(...)` drive PreviewScreen's **internal** preview-phase countdown only. The current PreviewScreen CDN (`packages/components/preview-screen/index.js`) does **NOT** mirror `timerInstance` into `#previewTimerText` or any other header element during gameplay — earlier skill text claiming "PreviewScreen mirrors the TimerComponent each frame" is wrong and must not be followed.

To render the game's TimerComponent during gameplay:

1. **Mount `<div id="timer-container">` as a direct child of `#mathai-preview-slot`**, NOT inside `.mathai-preview-header` or `.mathai-preview-header-center`. Keeping it out of the header's flex flow is what makes centering stable regardless of left/right slot widths.
2. **Make `#mathai-preview-slot` a positioning context** — add `#mathai-preview-slot { position: relative; }` in game CSS.
3. **Absolute-center the timer at top** — matches the canonical React `TimerComponent`'s `showInActionBar: true` styles verbatim:
   ```css
   #timer-container {
     position: absolute;
     top: 1rem;
     left: 50%;
     transform: translateX(-50%);
     z-index: 50;
     pointer-events: none;
   }
   #timer-container > * { pointer-events: auto; }
   ```
4. **Override the TimerComponent's hard-coded inline styles.** Its `render()` sets `.timer-display { width: 320px; height: 41px; font-size: 24px; color: #000FFF }` which is too wide for the header and uses the wrong colour. In game CSS:
   ```css
   #timer-container .timer-wrapper { padding: 0 !important; margin: 0 !important; }
   #timer-container .timer-display {
     width: auto !important;
     height: auto !important;
     padding: 0 !important;
     font-size: 16px !important;
     font-weight: 700 !important;
     color: var(--mathai-primary) !important;
     font-family: var(--mathai-font-family) !important;
   }
   ```
5. **Hide the CDN's empty `#previewTimerText` span** so it doesn't occupy header space:
   ```css
   #previewTimerText { display: none !important; }
   ```
6. `new TimerComponent('timer-container', { timerType, format, startTime, endTime, autoStart: false })` per PART-006. Call `timer.start()` in `startGameAfterPreview`. Pause/resume from the VisibilityTracker `onInactive` / `onResume` callbacks with `{ fromVisibilityTracker: true }`.

**Anti-patterns (all seen in matching-doubles build, April 2026):**

- ❌ Mounting `#timer-container` with `display: none` expecting PreviewScreen to mirror text into the header — it doesn't; the timer runs invisibly.
- ❌ Mounting `#timer-container` inside `.mathai-preview-header-center` — the TimerComponent's hardcoded 320px width fights the flex slot sizing and pushes `.mathai-preview-header-right` (score/star) off-screen on 375-480px viewports.
- ❌ Omitting the `.timer-display` width/height/colour overrides — timer renders as a huge blue block.

### Audio permission gate

The preview's internal timer does not start until `FeedbackManager.init()` resolves and audio permission is granted. `gameState.startTime` MUST remain `null` while `previewScreen.getState() === 'preview'`; it is set only in `startGameAfterPreview()` after `onComplete` fires.

### Preview audio — no `new Audio()`

All preview audio flows through `FeedbackManager.sound.preload([{id, url}])` at init and `FeedbackManager.sound.play(id)` at runtime. `new Audio(` anywhere in game code is a fail — preview audio specifically, and game audio generally, must route through FeedbackManager.

### onPreviewInteraction

Only needed for interactive preview content (e.g. video, tap-to-reveal). Default omit. If used, callback receives `(key, value)` from `setPreviewData()` and the resulting data is available on `previewData` in `onComplete`.

### game_complete payload — previewResult

When building the `game_complete` postMessage payload, include `previewResult: gameState.previewResult || null`. Required when preview was interactive. See `data-contract.md` for full schema.

### Window Exposures

```javascript
window.gameState = gameState;       // test harness reads state
window.endGame = endGame;           // test harness calls this
window.restartGame = resetGame;     // replay tests
window.startGame = startGame;       // test harness triggers start
window.nextRound = nextRound;       // test harness advances rounds (GEN-WINDOW-NEXTROUNDEXPOSED)
```

All five MUST be assigned (GEN-WINDOW-EXPOSE).

### getRounds with Fallback

```javascript
function getRounds() {
  if (gameState.content && gameState.content.rounds &&
      gameState.content.rounds.length >= gameState.totalRounds) {
    return gameState.content.rounds;
  }
  return fallbackContent.rounds;
}
```

`fallbackContent` MUST contain a complete set of rounds matching the spec schema. Never empty.

### getStars

```javascript
function getStars(score) {
  var total = gameState.totalRounds;
  if (score >= Math.ceil(total * 0.9)) return 3;
  if (score >= Math.ceil(total * 0.6)) return 2;
  if (score >= 1) return 1;
  return 0;
}
```

### Keyboard Handling (Input-Based Games)

If the game uses text/number input instead of MCQ:
- Use `inputmode="numeric" pattern="[0-9]*"` and `font-size: 16px` (prevents iOS zoom).
- Enter key submits via `keydown` listener.
- Keep question visible on keyboard open via `visualViewport` resize listener.
- Blur input after answer processed to dismiss keyboard.

---

## Gen Rules (pipeline-enforced, not in any PART)

### State Management

| Rule | Requirement |
|------|-------------|
| GEN-ENDGAME-GUARD | endGame guard must check `gameState.gameEnded`, NOT `!gameState.isActive` |
| GEN-RESTART-PHASE | restartGame sets phase to `'start_screen'`, not `'playing'` |
| GEN-RESTART-RESET | restartGame resets ALL mutable fields including game-specific ones |
| GEN-ROUND-INDEX | `currentRound` is 0-based in logic, 1-based in display only |
| GEN-FLIP-RESET | Per-round counters reset at start of each round |
| GEN-GAMEID | `gameState.gameId` must be the FIRST field in the object literal |
| GEN-CORRECT-ANSWER-EXPOSURE | `gameState.correctAnswer` set BEFORE `syncDOM()` in each round |

### Round Lifecycle

Every `loadRound` must begin with: (1) `isProcessing = false`, (2) `isActive = true`, (3) `syncDOM()`.

### DOM / CSS

| Rule | Requirement |
|------|-------------|
| GEN-RESULTS-FIXED | Results screen uses `position: fixed` full-viewport overlay with `z-index: 100` |
| GEN-RESULTS-DOM | `#results-screen` element must exist in DOM (test harness queries it) |
| GEN-RESULTS-ROUNDS | Results screen displays rounds completed count |
| RULE-RESULTS-1 | `showResults()` populates `#results-screen` directly, never via `transitionScreen.show()` |
| GEN-HIDDEN-CLASS | `.hidden { display: none !important; }` must be defined if `.hidden` is used |
| GEN-HIDE-SHOW | `hide()`/`show()` helpers take DOM elements, NOT selector strings |
| GEN-MOBILE-STACK | Main layout uses `flex-direction: column` (portrait mobile) |
| GEN-DOM-CACHE | Cache DOM refs at init. No `getElementById` inside per-round render |
| GEN-CANVAS-001 | Canvas uses `max-width: 100%; height: auto` for responsive sizing |
| GEN-CSS-TOKENS | Feedback colors use `--mathai-success`, `--mathai-error`, `--mathai-warning` only |
| GEN-UX-004 | Never use `alert()`, `confirm()`, or `prompt()` |
