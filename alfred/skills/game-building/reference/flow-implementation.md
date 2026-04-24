# Flow Implementation

## Purpose

This file tells you how to implement the flow from `pre-generation/game-flow.md` inline in the HTML using the three CDN components. Read this alongside `pre-generation/game-flow.md` and `alfred/skills/game-planning/reference/default-flow.md`.

## Plan → build contract (CRITICAL)

`pre-generation/screens.md` is the enumeration + content contract. Before writing any flow code:

1. **Screen completeness.** For every screen enumerated in `screens.md`, produce a function that mounts it. Do NOT skip short-lived motivation / celebration transitions (e.g. `game_over_motivation`, `victory_motivation`, `stars_collected`) — they are required render targets, not optional.
2. **Content comes from `screens.md`, not from this file.** The code snippets below show **structure**; every user-visible string in a `transitionScreen.show({...})` call (title, subtitle, button labels, sticker/icon emoji, audio id) comes from the corresponding "Elements" table in `screens.md`. Do NOT invent additional buttons (e.g. an `Exit` button if screens.md lists only `Try Again`). Do NOT rename listed buttons. Do NOT alter titles or subtitles. `test/content-match.test.js` enforces this — any drift fails the build.
3. **Persistent fixtures.** Preview wrapper stays mounted through every phase (see PART-039 Wrapper persistence). Progress bar is visible on every screen except Preview; position is top of game body — never at the bottom.

## Screen → component mapping

| Screen | Component | Key call |
|---|---|---|
| Preview | PreviewScreenComponent | `previewScreen.show({ instruction, audioUrl, showGameOnPreview, onComplete, onPreviewInteraction? })` — ctor is `new PreviewScreenComponent({ slotId: 'mathai-preview-slot' })`. `onComplete(previewData)` invokes `startGameAfterPreview(previewData)` (callback, not awaited). Render `#gameContent` BEFORE calling `show()`. See PART-039. |
| Welcome | TransitionScreenComponent | `ts.show({ title, buttons:[{text:"I'm ready"}], onMounted: () => FeedbackManager.sound.play(vo, {sticker}) })` |
| Round N intro | TransitionScreenComponent | `ts.show({ title:"Round N", onMounted: () => sound.play(round_n) })` — await sound, then `ts.hide()` |
| Ready to improve your score? | TransitionScreenComponent | tap-dismiss, onMounted fires motivation VO |
| Yay stars collected! | TransitionScreenComponent | auto-dismiss, onMounted fires stars sound + animation, await → hide |
| Victory / Game Over | TransitionScreenComponent | with `stars` + `buttons` |
| Submit / Retry / Next | FloatingButtonComponent | Define `isSubmittable()` over `gameState`; every input/state-change handler calls `floatingBtn.setSubmittable(isSubmittable())`. `floatingBtn.on('submit', async () => { await feedback; floatingBtn.setMode(correct ? 'next' : 'retry'); })`. Ctor: `new FloatingButtonComponent({ slotId: 'mathai-floating-button-slot' })`. Requires `slots.floatingButton: true` in `ScreenLayout.inject()`. See PART-050. |
| Gameplay | bare DOM | inject into `.game-stack` |

## Component invariants

- **Preview body owns scrolling.** In preview-wrapper mode, `.mathai-preview-body` is the explicit vertical scroll container and root/page scrolling is locked to the viewport. Game CSS MUST NOT override this by restoring root scroll or by adding `overflow-y:auto` / `overflow:scroll` / fixed `height` on `.game-stack` or any of its descendants. Instruction body + `#gameContent` + `#mathai-transition-slot` share ONE scroll container: `.mathai-preview-body`. A game that introduces a second scroll surface breaks iOS momentum scrolling and causes gameplay surfaces to stop panning the page.

- **CRITICAL: `show()` Promise resolves IMMEDIATELY** (next `requestAnimationFrame` after `onMounted` fires) — it does NOT block until a button is tapped, and it does NOT block for a `duration`. Code after `await transitionScreen.show(...)` runs before the student interacts. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. If you put continuation code after `await show()`, the welcome / victory / game-over screen will flash for one frame then immediately get replaced by the next screen.
- `duration` and `persist` are documented in the options table but the CDN `TransitionScreenComponent` does NOT implement either — `show()` never reads `config.duration` and never auto-hides. Always call `hide()` explicitly (from button `action` or after awaited audio).
- TransitionScreen does not own sound or sticker — always fire `FeedbackManager.sound.play(id, {sticker})` from the `onMounted` callback.
- For auto-dismiss (round intro, yay stars), fire audio inside `onMounted`, and in the code after `await show()` call `ts.hide()` + then proceed. The `show()` resolves instantly, so audio and post-show code run concurrently — the `onMounted` audio starts, then `hide()` is called. To wait for audio to finish before hiding: move `await FeedbackManager.sound.play(...)` + `ts.hide()` into the `onMounted` callback (as an IIFE) and do NOT put continuation code after `await show()`.
- For tap-dismiss (welcome, ready-to-improve, victory, game over), the button `action` callback drives `ts.hide()` AND all game-flow continuation (next phase, `showRoundIntro(1)`, `restartGame()`, etc.).

## Progress bar lifecycle

**Visibility rule:** The progress bar is visible on every screen of the flow **except Preview** (Preview owns its own layout). For the standalone shape (`totalRounds: 1`) the bar is hidden for the entire session via `progressBar.hide()`.

**Invariant — start at 0:** The first `progressBar.update()` call on the initial flow path MUST be `update(0, totalLives)`. The progression counter starts at 0 when the game begins, never at 1. Validator rule `5e0-PROGRESSBAR-START-ONE` blocks any first-call whose first arg is not literal `0`.

**Increment policy is game-specific.** The first arg to `update()` is a progression counter. What it counts — rounds completed, correct answers, points earned, section progress — is defined per game. Pick the metric that matches the spec and increment it when that metric changes. The "rounds completed, incremented on correct feedback" policy shown in the round loop below is ONE example; swap the increment condition to match your progression metric.

| Moment | Runtime call |
|---|---|
| Runtime start, `totalRounds >= 2` | `progressBar.show()` + `update(0, totalLives)` — **mandatory, literal 0** |
| Runtime start, `totalRounds === 1` | `progressBar.hide()` (standalone) |
| After Preview → Welcome mount | no new call needed (already at 0 from start) |
| Entering Round-i intro / body | `update(progress, livesLeft)` — reflects current progression state, **not** `i` or `i-1`. Idempotent no-op if state hasn't changed since last update. |
| Feedback wrong, lives remaining > 0 | `update(progress, livesLeft)` — hearts decrement; `progress` changes only if the game's metric includes wrong answers |
| Feedback / round-complete — metric increments | Bump the counter in state FIRST, then `update(progress, livesLeft)` BEFORE any awaited SFX / transition. See "Round-complete handler — progress bar bumps FIRST" in code-patterns.md. |
| Victory entry | `update(totalRounds, livesLeft)` — bar shows full (game complete, regardless of metric) |
| Game Over entry | **no call** — state preserved (bar shows prior value + 0 hearts so the student sees their final state) |
| **Restart-path entry** (after Game Over `Try Again`, or after <3★ Victory `Play Again`) | `update(0, totalLives)` — **reset to the start-at-0 invariant** so a fresh start is visibly signaled before Round 1 begins. *Placement depends on flow shape — see below.* |

### Restart-path reset — placement by flow shape

The reset itself is universal; *where* you place the `update(0, totalLives)` call depends on whether the game's flow has a transition screen between the Game-Over / Victory end-state and the first new Round-1 intro. Two cases, one safety net:

| Flow shape | Where to place the reset call | Visible effect |
|---|---|---|
| **Default flow** — Motivation ("Ready to improve your score?") exists between Try Again / Play Again and Round 1 | Inside Motivation's `transitionScreen.show({ onMounted: ... })`, alongside the motivation VO: `progressBar.update(0, totalLives)` | Bar visibly resets the instant Motivation mounts, so the student sees `0/N` + full hearts while reading "Ready to improve your score?" → reinforces the "fresh start, are you ready?" signal |
| **Custom flow** — no Motivation screen (spec overrides it, or Try Again / Play Again routes directly to Round 1) | First line of `restartGame()`, before `renderRound()` / `showRoundIntro(1)` | Bar resets as Round 1 loads — no intermediate screen to show it on, but the invariant still holds |
| **Universal safety net** — both shapes | `restartGame()` should ALSO call `progressBar.update(0, totalLives)` as its first runtime action | Idempotent when Motivation already reset; authoritative when it didn't. Guarantees the invariant regardless of how the restart path is entered (including future flow customizations, host-triggered restarts via `game_init`, etc.) |

**Rule of thumb:** the reset is an attribute of the **restart action**, not of any specific screen. Attach it to the earliest visible moment of the restart path (Motivation's `onMounted` when it exists), AND guarantee it inside `restartGame()` as a safety net. The two calls are idempotent — `update(0, ...)` twice in a row produces the same visual state as one call.

### Shape-specific progress-bar behavior

| Shape | Template | Scope |
|---|---|---|
| **Standalone** (`totalRounds: 1`) | — (component hidden via `hide()`) | Not rendered. Lives UI placement deferred. |
| **Multi-round** (`N ≥ 2`, no sections) | `"Round {current}/{total}"` | Track fills from 0 → N across the whole game. |
| **Sectioned** | `"{sectionLabel} · {inSection}/{sectionTotal}"` | Track resets at each section boundary (scoped fill). Optional sticky badge for overall `{current}/{total}`. |

## Round loop pattern

**This example uses a "rounds completed, incremented on correct feedback" policy.** The invariant (start at 0) is universal; the increment condition is not — swap the `if (verdict.correct)` check for whatever matches your game's progression metric (e.g. `if (verdict.correct && !verdict.retry)`, `state.progress += verdict.points`, `if (allCardsPlaced)`, etc.).

```js
async function startGame() {
  // Preview resolves via callback, not promise — wrap it:
  await new Promise(resolve => {
    previewScreen.show({
      instruction, audioUrl, showGameOnPreview: false,
      onComplete: (previewData) => { startGameAfterPreview(previewData); resolve(); }
    });
  });
  await showWelcome();  // transition, tap "I'm ready"
  progressBar.show(); progressBar.update(0, totalLives);  // ← start-at-0 invariant
  // Seed the ActionBar header — PART-040 expects direct method calls,
  // NOT re-posting game_init (which would re-trigger setupGame()).
  previewScreen.setQuestionLabel('Q1');
  previewScreen.setScore('0/' + totalRounds);
  for (let i = 1; i <= totalRounds; i++) {
    state.round = i;
    previewScreen.setQuestionLabel('Q' + i);
    await showRoundIntro(i);                // transition, auto-advance on sound end
    progressBar.update(state.progress, state.livesLeft);
    const verdict = await renderRoundAndWaitForSubmit(i);
    await runFeedbackWindow(verdict);       // 2000ms, sound + sticker
    if (verdict.correct) {
      state.progress++;                     // game-specific policy — swap the condition to match your metric
      progressBar.update(state.progress, state.livesLeft);
      previewScreen.setScore(state.progress + '/' + totalRounds);  // header count tracks progress
    } else {
      state.livesLeft--;
      if (state.livesLeft === 0) return showGameOver();
      progressBar.update(state.progress, state.livesLeft);
      i--;  // retry same round
    }
  }
  await showVictory();
}
```

## ActionBar header state updates — MANDATORY

The header's `#previewScore` and `#previewQuestionLabel` text are state-driven — games MUST refresh them on every progression change. Mid-round updates use direct `previewScreen.setScore(...)` / `previewScreen.setQuestionLabel(...)` (no animation). The `show_star` flying-star animation is reserved for the ONE end-of-game celebration beat — firing it per round plays the animation 10 times in a row and spams the player (equivalent-ratio-quest regression).

| Moment | Call | Animation? |
|---|---|---|
| After `previewScreen` is instantiated (in `startGameAfterPreview`) | `previewScreen.setQuestionLabel('Q1')` + `previewScreen.setScore('0/' + totalRounds)` | No |
| Round advance (new round begins, multi-round) | `previewScreen.setQuestionLabel('Q' + gameState.currentRound)` | No |
| Correct answer evaluated mid-round (score bumps) | `previewScreen.setScore(gameState.score + '/' + totalRounds)` | No |
| Non-award score mutation (penalty, undo) | `previewScreen.setScore(gameState.score + '/' + totalRounds)` | No |
| **End-of-game celebration (once per session)** | `window.postMessage({type:'show_star', data:{count, variant:'yellow', score: gameState.score + '/' + totalRounds}}, '*')` | **Yes** — the `score` is applied AFTER the 1 s flying-star animation |

**Never fire `game_init` from game code to update these fields.** Games already have a `handlePostMessage` listener that processes `game_init` by calling `setupGame()` — a re-fire would reset state with fallback content. The direct methods + end-of-game show_star mutate header DOM in-process and bypass the message bus. See PART-040 "Updating header state from game code" and code-patterns.md "ActionBar header refresh".

**Never fire `show_star` per round.** It is a one-time end-of-game celebration, not a per-correct-answer effect. If you need a per-round score bump, use `previewScreen.setScore(...)` directly.

**Validator gate:** `GEN-HEADER-REFRESH` errors if a FloatingButton-using, PreviewScreen-using game never updates the header. A separate check flags show_star usage inside a per-round handler.

## End-of-game star-award animation (`show_star`) — MANDATORY

Every game MUST fire `show_star` at the end-of-game moment so the ActionBar flies a celebratory star into the header (PART-040).

**Target is `window`, NOT `window.parent`.** ActionBar listens in the same frame. `window.parent.postMessage(...)` goes to the host and the animation never fires.

**Destroy ordering (critical).** `previewScreen.destroy()` MUST NOT be called in `endGame()`. The preview wrapper owns the ActionBar header + `#previewStar`, which are the animation's DOM target. If destroy runs before the 1 s animation finishes, the target vanishes mid-flight. Destroys move into the `floatingBtn.on('next', ...)` handler — after `next_ended` is posted — so the header survives the entire end-screen view (PART-039 destroy mandate).

Fire location by shape:

- **Standalone** (`totalRounds: 1`): INSIDE `endGame`, AFTER `postGameComplete()`. Then reveal Next via `setTimeout(function(){ floatingBtn.setMode('next'); }, 300)` — the setTimeout also satisfies `GEN-FLOATING-BUTTON-NEXT-TIMING` (Next must not appear synchronously with `game_complete`). No destroys here.
- **Multi-round** (`N ≥ 2`): INSIDE `transitionScreen.onDismiss(...)`, immediately after `transitionScreen.hide()`. Then `floatingBtn.setMode('next')`. No destroys here.

End-of-game sequencing — MANDATORY serial order:

```
Beat 1: SFX + sticker (await, min 1500 ms)
Beat 2: render inline feedback panel + post game_complete (SYNC — never
        block on TTS for this, host harness relies on it)
Beat 3: await dynamic TTS (if the game uses playDynamicFeedback)
Beat 4: fire show_star (animation takes ~1 s; score applied at END)
Beat 5: setTimeout(1100) → setMode('next')   ← Next appears AFTER animation
```

Do NOT overlap these. User-visible order: SFX → feedback panel renders → TTS audio → star animation → Next button. The GEN-FLOATING-BUTTON-NEXT-TIMING validator accepts `await` and `setTimeout(` as separators, so Beat 3's await and Beat 5's setTimeout both satisfy it.

Canonical snippet — standalone:

```js
async function endGame(correct) {
  // ... existing phase / sync / trackEvent updates ...

  // Beat 1 — SFX + sticker.
  await FeedbackManager.sound.play(correct ? 'sound_correct' : 'sound_incorrect', { sticker });

  // Beat 2 — render feedback panel, post game_complete (SYNC).
  renderInlineFeedbackPanel(correct);
  postGameComplete();

  // Beat 3 — dynamic TTS (awaited, never fire-and-forget at end-of-game).
  // Omit the block entirely if the game has no TTS.
  try {
    await FeedbackManager.playDynamicFeedback({
      audio_content: ttsText,
      subtitle: subtitle,
      sticker: sticker
    });
  } catch (e) { /* TTS failures must not block the end sequence */ }

  // Beat 4 — star-award animation (applied to header at animation end).
  if (correct) {
    try {
      window.postMessage({
        type: 'show_star',
        data: {
          count: gameState.stars || 1,
          variant: 'yellow',
          score: gameState.score + '/' + gameState.totalRounds
        }
      }, '*');
    } catch (e) {}
  }

  // Beat 5 — reveal Next AFTER the 1 s animation. (Shorten to 300 ms if
  // spec.autoShowStar === false.)
  setTimeout(function () {
    if (floatingBtn) {
      try { floatingBtn.setMode('next'); } catch (e) {}
    }
  }, 1100);
}

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  try { if (previewScreen) previewScreen.destroy(); } catch (e) {}
  floatingBtn.destroy();
});
```

Canonical snippet — multi-round:

```js
transitionScreen.onDismiss(() => {
  transitionScreen.hide();
  // Star-award animation AFTER the transition dismisses.
  try {
    window.postMessage({
      type: 'show_star',
      data: {
        count: gameState.stars || 1,
        variant: 'yellow',
        score: gameState.score + '/' + gameState.totalRounds
      }
    }, '*');
  } catch (e) {}
  // Reveal Next AFTER the 1 s animation.
  setTimeout(function () { floatingBtn.setMode('next'); }, 1100);
});

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  try { if (previewScreen) previewScreen.destroy(); } catch (e) {}
  floatingBtn.destroy();
});
```

Spec opt-out: if `spec.autoShowStar === false`, omit the `show_star` postMessage. The destroy-in-Next-handler rule still applies — do not move destroys back into `endGame()`. The author fires `show_star` themselves at a custom beat. See PART-050 "Next flow" for the full canonical wirings.

## Star computation

| starModel | Input | Formula |
|---|---|---|
| `lives` | `livesLeft`, `totalLives` | 3 if `livesLeft === totalLives`; 2 if `livesLeft ≥ ceil(totalLives/2)`; 1 if `livesLeft ≥ 1`; else 0 |
| `firstAttempt` | `firstAttemptCorrect / totalRounds` | 3 if ≥ 0.9; 2 if ≥ 0.6; 1 if ≥ 0.3; else 0 |
| `accuracy` | `correct / attempts` | 3 if ≥ 0.9; 2 if ≥ 0.6; 1 if > 0; else 0 |
| `speed` | `elapsedMs`, spec thresholds | 3 if under fast threshold; 2 if under medium; 1 if finished; else 0 |
| `custom` | per spec | Follow spec's explicit rule (e.g., section completion count) |
