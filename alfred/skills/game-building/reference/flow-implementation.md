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
| Yay stars collected! | TransitionScreenComponent | **Celebration backdrop — stays mounted, auto-hands-off to AnswerComponent (PART-051 default flow).** `buttons: []`, `persist: true`. `onMounted` awaits the yay sound, fires `show_star` (star animation), then via `setTimeout` (~1500 ms) calls `showAnswerCarousel()`. **Does NOT call `transitionScreen.hide()` in `onMounted`** (per default-transition-screens.md). AnswerComponent + FloatingButton('next') appear OVER the still-mounted celebration card. The Stars Collected screen is never user-dismissed; tapping Next on the FloatingButton tears down everything (AnswerComponent + TS + preview + floating) and posts `next_ended`. When `answerComponent: false`, the legacy chain applies — `onMounted` schedules `setMode('next')` directly, FloatingButton `next` handler hides the screen + destroys preview + posts `next_ended`. |
| Victory / Game Over | TransitionScreenComponent | with `stars` + `buttons` |
| Submit / Retry / Next | FloatingButtonComponent | Define `isSubmittable()` over `gameState`; every input/state-change handler calls `floatingBtn.setSubmittable(isSubmittable())`. `floatingBtn.on('submit', async () => { await feedback; floatingBtn.setMode(correct ? 'next' : 'retry'); })`. Ctor: `new FloatingButtonComponent({ slotId: 'mathai-floating-button-slot' })`. Requires `slots.floatingButton: true` in `ScreenLayout.inject()`. See PART-050. |
| Correct Answers panel | AnswerComponentComponent | Multi-round: revealed by `showAnswerCarousel()` — called from inside the Stars Collected `onMounted` setTimeout. The Stars Collected TS stays mounted (NO `transitionScreen.hide()` in the hand-off); the answer card appears OVER the still-visible celebration backdrop. `showAnswerCarousel()` calls `answerComponent.show({ slides: rounds.map(r => ({ render: c => renderAnswerForRound(r, c) })) })` then `floatingBtn.setMode('next')`. **NEVER call `answerComponent.show(...)` from `endGame()` or from a Victory `Claim Stars` action — that skips the celebration and triggers the two-stage Next regression** (`GEN-ANSWER-COMPONENT-AFTER-CELEBRATION`, `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE`). The `next` handler is single-stage: destroy AnswerComponent + post `next_ended` + destroy preview + destroy floating button (the still-mounted Stars Collected TS tears down with the iframe). Standalone (`totalRounds: 1`): show + setMode('next') happens in `endGame()` directly (no TransitionScreen). Ctor: `new AnswerComponentComponent({ slotId: 'mathai-answer-slot' })`. Requires `slots.answerComponent: true` in `ScreenLayout.inject()`. Slides are render-callbacks only. Single-slide path disables nav. Skipped entirely when spec has `answerComponent: false`. See PART-051. |
| Gameplay | bare DOM | inject into `.game-stack` |

## Component invariants

- **Preview body owns scrolling.** In preview-wrapper mode, `.mathai-preview-body` is the explicit vertical scroll container and root/page scrolling is locked to the viewport. Game CSS MUST NOT override this by restoring root scroll or by adding `overflow-y:auto` / `overflow:scroll` / fixed `height` on `.game-stack` or any of its descendants. Instruction body + `#gameContent` + `#mathai-transition-slot` share ONE scroll container: `.mathai-preview-body`. A game that introduces a second scroll surface breaks iOS momentum scrolling and causes gameplay surfaces to stop panning the page.

- **CRITICAL: `show()` Promise resolves IMMEDIATELY** (next `requestAnimationFrame` after `onMounted` fires) — it does NOT block until a button is tapped, and it does NOT block for a `duration`. Code after `await transitionScreen.show(...)` runs before the student interacts. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. If you put continuation code after `await show()`, the welcome / victory / game-over screen will flash for one frame then immediately get replaced by the next screen.
- `duration` and `persist` are documented in the options table but the CDN `TransitionScreenComponent` does NOT implement either — `show()` never reads `config.duration` and never auto-hides. Always call `hide()` explicitly (from button `action`, after awaited audio, or from the FloatingButton `next` handler — see Stars Collected exception below).
- TransitionScreen does not own sound or sticker — always fire `FeedbackManager.sound.play(id, {sticker})` from the `onMounted` callback.
- For auto-dismiss (round intro), fire audio inside `onMounted`, and in the code after `await show()` call `ts.hide()` + then proceed. The `show()` resolves instantly, so audio and post-show code run concurrently — the `onMounted` audio starts, then `hide()` is called. To wait for audio to finish before hiding: move `await FeedbackManager.sound.play(...)` + `ts.hide()` into the `onMounted` callback (as an IIFE) and do NOT put continuation code after `await show()`.
- **Stars Collected is an exception to the no-button auto-dismiss rule.** It is the terminal end-of-game surface and must stay visible while the star animation fires and the Next button appears. Its `onMounted` awaits the sound, fires `show_star`, and schedules `floatingBtn.setMode('next')` — but MUST NOT call `transitionScreen.hide()`. The FloatingButton `on('next', ...)` handler owns the eventual `transitionScreen.hide()` + `previewScreen.destroy()` + `window.parent.postMessage({ type: 'game_exit' }, '*')`. See `alfred/skills/game-planning/reference/default-transition-screens.md` § 4 for the canonical pattern.
- For tap-dismiss (welcome, ready-to-improve, victory, game over), the button `action` callback drives `ts.hide()` AND all game-flow continuation (next phase, `showRoundIntro(1)`, `restartGame()`, etc.).

## Progress bar lifecycle

**Visibility rule:** The progress bar is visible on every screen of the flow **except Preview** (Preview owns its own layout). For the standalone shape (`totalRounds: 1`) the bar is hidden for the entire session via `progressBar.hide()`.

**Invariant — start at 0:** The first `progressBar.update()` call on the initial flow path MUST be `update(0, totalLives)`. The progression counter starts at 0 when the game begins, never at 1. Validator rule `5e0-PROGRESSBAR-START-ONE` blocks any first-call whose first arg is not literal `0`.

**Increment policy — DEFAULT is "rounds attempted" (NOT "rounds correct").** The first arg to `update()` is a progression counter. **For the canonical multi-round shape, this MUST count rounds the student has played through (correct OR wrong) — i.e., it tracks position in the round sequence, not score.** Why: in a 10-round game, if the student gets rounds 3 and 7 wrong but doesn't lose all lives, they still finish with 10/10 on the bar — the bar reflects "where am I in the game", which is what the student intuitively reads. A "correct-only" counter would show 8/10 on the final round, making the last round feel mis-numbered.

The counter increments AFTER feedback completes, regardless of correct/wrong (provided lives remain). Wrong answers do NOT retry the same round — they advance to the next round AND lose a life. Game ends early via Game Over only if `lives === 0`.

| Moment | Runtime call |
|---|---|
| Runtime start, `totalRounds >= 2` | `progressBar.show()` + `update(0, totalLives)` — **mandatory, literal 0** |
| Runtime start, `totalRounds === 1` | `progressBar.hide()` (standalone) |
| After Preview → Welcome mount | no new call needed (already at 0 from start) |
| Entering Round-i intro / body | `update(progress, livesLeft)` — reflects current progression state, **not** `i` or `i-1`. Idempotent no-op if state hasn't changed since last update. |
| AFTER feedback audio resolves, BEFORE the next round renders / Victory / Game Over fires | Bump `progress` (counts rounds attempted) — correct OR wrong — then `update(progress, livesLeft)`. **Timing: just before the round changes, NOT immediately after submit.** The student sees feedback for the round they just played with the bar still showing the round they're on, and the bar advances as the round changes. The bump MUST still happen BEFORE the awaited round-change UI (`nextRound()` render, `transitionScreen.show(...)` for Victory, `showGameOver()`) — that's what guarantees Victory paints `N/N` and Game Over preserves the post-bump value. Wrong answers also decrement `livesLeft` — single `update(progress, livesLeft)` reflects both. See "Round-complete handler — bump just before round change" in code-patterns.md. |
| Wrong answer, `livesLeft === 0` after decrement | Bump progress (the failed round still counts as attempted) → `update(progress, 0)` → then `showGameOver()`. The bar shows the post-bump value + 0 hearts; Game Over preserves that state. |
| Victory entry | `update(totalRounds, livesLeft)` — bar shows full. (With the rounds-attempted counter, `progress` already equals `totalRounds` here; this call is idempotent but explicit.) |
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

**Default progression policy — "rounds attempted", bump just before round change.** `state.progress` increments after the round's feedback completes, regardless of correct/wrong, **immediately before the round-change UI fires** (next `showRoundIntro` render, Victory transition, or Game Over transition). The bar visibly advances *as the round changes*, not as the student submits. Wrong answers also decrement `livesLeft`; if lives hit 0 the game ends via `showGameOver()` BEFORE the next round renders. `state.score` (correct count) is tracked separately and feeds `getStars()` at end-of-game — it does NOT update the ActionBar header mid-round (the header is end-of-game-only).

**Visual sequence per round:**
1. Student submits → feedback plays (sound + sticker, ~1.5–2 s) → bar still shows previous progress
2. Feedback resolves → bump `state.progress` → `progressBar.update(progress, livesLeft)` → bar visibly advances
3. Next round intro renders / Victory / Game Over fires (whichever applies)

The bump still respects the "before the awaited round-change UI" ordering rule — what changes is *when within the round* it fires. Bump after feedback await, before transition await.

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
  // ActionBar header is locked at boot via game_init.data.score / .questionLabel.
  // Games MUST NOT call previewScreen.setScore(...) / .setQuestionLabel(...) —
  // these methods are not part of the public API. Stars in the header are an
  // end-of-game performance representation, not a running counter.
  for (let i = 1; i <= totalRounds; i++) {
    state.round = i;
    await showRoundIntro(i);                // transition, auto-advance on sound end
    progressBar.update(state.progress, state.livesLeft);
    const verdict = await renderRoundAndWaitForSubmit(i);
    // 1. State mutations (score / lives) — internal counters only, no header refresh
    if (verdict.correct) {
      state.score++;                        // score = correct count, feeds getStars() at end
    } else {
      state.livesLeft--;
    }
    // 2. Feedback FIRST — bar still at previous progress while feedback plays
    await runFeedbackWindow(verdict);       // ~2000ms sound + sticker
    // 3. Bump progress + update bar JUST BEFORE the round-change UI fires
    state.progress++;
    progressBar.update(state.progress, state.livesLeft);
    // 4. Round-change UI
    if (state.livesLeft === 0) return showGameOver();   // exits with bumped progress + 0 hearts
    // (loop continues — next iteration's showRoundIntro is the round-change UI)
  }
  await showVictory();   // bar already at totalRounds/totalRounds from the last bump above
  // End-of-game: fire show_star ONCE with count = getStars() — increments
  // ActionBar numerator from 0 → final star tier.
  window.postMessage({ type: 'show_star', data: { count: getStars(), variant: 'yellow' } }, '*');
}
```

**Two counters, two update sites:**
- `state.progress` — rounds attempted (0 → totalRounds) — drives `progressBar.update()`
- `state.score` — rounds correct (0 → totalRounds) — feeds `getStars()` at end-of-game

Do NOT collapse these. The progress bar is "where am I"; the ActionBar stars are "how did I do overall". A student on round 10 with 7 correct sees `Round 10/10` on the progress bar mid-game; the ActionBar stays at `0/3` until the final `show_star` celebration awards the earned stars.

**Alternative policies (only when spec explicitly opts in):** "rounds correct", "points earned", "section progress", "tiles cleared". Document the chosen metric in the spec's `## Flow` section and adjust the increment site accordingly. **The default for any rounds-based game is "rounds attempted" — never invent a custom policy without spec authorization.**

## ActionBar header state updates — STARS-IMMUTABLE CONTRACT

The header `#previewScore` and `#previewQuestionLabel` are **locked at boot** by `game_init`. Games MUST NOT mutate them at runtime — `setScore` and `setQuestionLabel` are not part of the public API. Stars in the ActionBar represent overall game performance, not running progress.

| Moment | Path | Animation? |
|---|---|---|
| Boot (host fires `game_init`, or fallback) | `data.score: '0/3'` or `{ x: 0, y: 3 }` + `data.questionLabel: 'Q1'` | No (sets baseline) |
| Mid-round | **No header update.** `state.score` accumulates internally. ActionBar shows `0/y` throughout gameplay. | — |
| **End-of-game celebration (once per session)** | `window.postMessage({type:'show_star', data:{count: getStars(), variant:'yellow'}}, '*')` | **Yes** — numerator increments by `count` AFTER the 1 s animation |

**Never fire `game_init` from game code to update these fields.** Games already have a `handlePostMessage` listener that processes `game_init` by calling `setupGame()` — a re-fire would reset state with fallback content.

**Never fire `show_star` per round.** It is a one-time end-of-game celebration; the numerator increments automatically by `count`. Multi-fire stacks the flying-star animation N times and over-counts the displayed stars.

**Question label format is `Q + N`.** Game-internal vocabulary like "Level N" / "Round N" / "Stage N" goes in `#gameContent`, never in the platform header.

**Validator gates:**
- `GEN-ACTIONBAR-STARS-IMMUTABLE` — fails on any `.setScore(` call.
- `GEN-QUESTION-LABEL-IMMUTABLE` — fails on any `.setQuestionLabel(` call.
- `GEN-QUESTION-LABEL-FORMAT` — fails if a `questionLabel:` literal doesn't match `/^Q\d+$/`.
- `GEN-SHOW-STAR-ONCE` — fails if `show_star` fires more than once.
- `GEN-SHOW-STAR-REQUIRED` — fails if a PreviewScreen+FloatingButton game has no `show_star` with `count`.
- `5e0-DOM-BOUNDARY` — fails on direct DOM access to `#previewScore` / `#previewStar` / `#previewQuestionLabel`.

## End-of-game star-award animation (`show_star`) — MANDATORY

Every game MUST fire `show_star` at the end-of-game moment so the ActionBar flies a celebratory star into the header (PART-040).

**Target is `window`, NOT `window.parent`.** ActionBar listens in the same frame. `window.parent.postMessage(...)` goes to the host and the animation never fires.

**Destroy ordering (critical).** `previewScreen.destroy()` MUST NOT be called in `endGame()`. The preview wrapper owns the ActionBar header + `#previewStar`, which are the animation's DOM target. If destroy runs before the 1 s animation finishes, the target vanishes mid-flight. Destroys move into the `floatingBtn.on('next', ...)` handler — after `next_ended` is posted — so the header survives the entire end-screen view (PART-039 destroy mandate).

Fire location by shape:

- **Standalone** (`totalRounds: 1`): INSIDE `endGame`, AFTER `postGameComplete()`. Then reveal Next via `setTimeout(function(){ floatingBtn.setMode('next'); }, 300)` — the setTimeout also satisfies `GEN-FLOATING-BUTTON-NEXT-TIMING` (Next must not appear synchronously with `game_complete`). No destroys here.
- **Multi-round** (`N ≥ 2`): Fire `show_star` INSIDE the Stars Collected `onMounted`, AFTER the awaited `sound.play(...)` — **while the Stars Collected screen is still visible** (NOT after its hide). Then `setTimeout → floatingBtn.setMode('next')` reveals Next on top of the still-visible Stars Collected. Stars Collected hides on the Next tap, NOT on audio end (exception to the no-button auto-dismiss rule). No destroys here — they move into the FloatingButton `next` handler.

End-of-game sequencing — MANDATORY serial order:

```
Beat 1: SFX + sticker (await, min 1500 ms)
Beat 2: render inline feedback panel + post game_complete (SYNC — never
        block on TTS for this, host harness relies on it)
Beat 3: await dynamic TTS (if the game uses playDynamicFeedback)
Beat 4: fire show_star (animation takes ~1 s; score applied at END)
        — for multi-round, this fires WHILE Stars Collected is still visible
          (NOT after its hide); animation lands on the celebration screen
Beat 5: setTimeout(1100) → setMode('next')   ← Next appears AFTER animation,
        on top of the still-visible Stars Collected (multi-round). Stars
        Collected hides on the Next tap, NOT on audio end (exception to the
        no-button auto-dismiss rule).
```

Do NOT overlap these. User-visible order: SFX → feedback panel renders → TTS audio → star animation → Next button. The GEN-FLOATING-BUTTON-NEXT-TIMING validator accepts `await` and `setTimeout(` as separators, so Beat 3's await and Beat 5's setTimeout both satisfy it.

**STANDALONE only (`totalRounds: 1`):** `endGame()` is the SINGLE orchestrator — all 5 beats live inside it. The submit handler is one line: `await endGame(correct);`. Do NOT split the beats across multiple async helpers (`runFeedbackSequence`, `finalizeAfterDwell`, etc.) — that fires `game_complete` + Next while TTS is still playing (bodmas-blitz regression). TTS MUST be awaited BEFORE `endGame()` returns.

**Multi-round (`totalRounds > 1`):** round-N feedback awaits SFX (~1.5 s floor) AND awaits dynamic TTS in the submit handler before advancing — the explanation must finish attached to the answer it explains. End-of-game audio lives in the Stars Collected `onMounted` callback (`sound_stars_collected` awaited → `show_star` → `setTimeout → setMode('next')`) — the round-N submit handler just transitions into Stars Collected after its own SFX + TTS complete. The 5-beat block below applies ONLY when there's no Stars Collected screen, i.e. standalone games.

**Round-boundary audio cleanup — MANDATORY (multi-round, defensive).** With awaited TTS, the explanation normally finishes before `showRoundIntro(N+1)` runs, so there's no audio to bleed. But the cleanup remains mandatory as defense-in-depth: TTS streaming can hit its 60 s upper bound, the API can throw mid-stream (caught by the `try/catch`, advancing the flow), or a tail of `sound_round_n` from a previous transition can linger. The first lines of `showRoundIntro(n)` MUST still stop in-flight audio:

```js
async function showRoundIntro(n) {
  // Round-boundary cleanup — defensive stop for any in-flight audio left
  // over from the previous round (TTS is awaited per GEN-FEEDBACK-TTS-AWAIT,
  // but a streaming timeout, swallowed try/catch rejection, or lingering
  // sound_round_n tail can still leave audio playing).
  try { FeedbackManager.sound.stopAll(); } catch (e) {}
  try { FeedbackManager.stream.stopAll(); } catch (e) {}
  try { FeedbackManager._stopCurrentDynamic && FeedbackManager._stopCurrentDynamic(); } catch (e) {}
  // ... rest of intro (transitionScreen.show + sound_round_n) ...
}
```

This is the "new transition screen appearing" rule from the feedback skill (timing-and-blocking.md row 89). Validator gate: `GEN-ROUND-BOUNDARY-STOP`.

```js
// ❌ WRONG — endGame() called after only SFX, TTS plays after game_complete + Next
async function runFeedbackSequence(sfx, tts, ...) {
  await playSfxMinDuration(sfx, 1500);
  finalizeAfterDwell();           // calls endGame() → posts game_complete + Next
  await playDynamicFeedback(tts); // TTS now plays AFTER game ended
}

// ✅ RIGHT — single endGame() owns all 5 beats end-to-end
async function endGame(correct) {
  await FeedbackManager.sound.play(sfxId, { sticker });    // Beat 1
  renderInlineFeedbackPanel(correct);                       // Beat 2 (SYNC)
  postGameComplete();                                       // Beat 2 (SYNC)
  await FeedbackManager.playDynamicFeedback({...});         // Beat 3
  if (correct) window.postMessage({ type: 'show_star', data: {...} }, '*');  // Beat 4
  setTimeout(() => floatingBtn.setMode('next'), 1100);      // Beat 5
}
```

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
