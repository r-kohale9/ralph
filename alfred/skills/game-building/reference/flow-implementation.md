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
| Preview | PreviewScreenComponent | `previewScreen.show({ instruction, audioUrl, showGameOnPreview, timerConfig, timerInstance, onComplete })` — ctor is `new PreviewScreenComponent({ slotId: 'mathai-preview-slot' })`. `onComplete(previewData)` invokes `startGameAfterPreview(previewData)` (callback, not awaited). Render `#gameContent` BEFORE calling `show()`. See PART-039. |
| Welcome | TransitionScreenComponent | `ts.show({ title, buttons:[{text:"I'm ready"}], onMounted: () => FeedbackManager.sound.play(vo, {sticker}) })` |
| Round N intro | TransitionScreenComponent | `ts.show({ title:"Round N", onMounted: () => sound.play(round_n) })` — await sound, then `ts.hide()` |
| Ready to improve your score? | TransitionScreenComponent | tap-dismiss, onMounted fires motivation VO |
| Yay stars collected! | TransitionScreenComponent | auto-dismiss, onMounted fires stars sound + animation, await → hide |
| Victory / Game Over | TransitionScreenComponent | with `stars` + `buttons` |
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

**State (runtime-driven updates):** The counter is "rounds completed", incremented on correct feedback. Round intros do not increment — they reflect the state already set by the previous round's correct feedback.

| Moment | Runtime call |
|---|---|
| Runtime start, `totalRounds >= 2` | `progressBar.show()` + `update(0, totalLives)` |
| Runtime start, `totalRounds === 1` | `progressBar.hide()` (standalone) |
| After Preview → Welcome mount | `update(0, totalLives)` (already satisfied by start call) |
| Entering Round-i intro / body | `update(roundsCompleted, livesLeft)` (typically equals i-1 but driven by runtime state, not computed from i — idempotent no-op after a correct feedback update) |
| Feedback wrong, lives remaining > 0 | `update(roundsCompleted, livesLeft)` — hearts decrement only; `roundsCompleted` unchanged |
| Feedback correct | `update(roundsCompleted+1, livesLeft)` — bar animates up during feedback window, BEFORE next round intro. `roundsCompleted` is bumped in state first, so the call reads the new value |
| Victory entry | `update(totalRounds, livesLeft)` |
| Game Over entry | **no call** — state preserved (bar shows prior value + 0 hearts) |
| `onRestart` branch entry (before first new Round-1 intro) | `update(0, totalLives)` — reset |

### Shape-specific progress-bar behavior

| Shape | Template | Scope |
|---|---|---|
| **Standalone** (`totalRounds: 1`) | — (component hidden via `hide()`) | Not rendered. Lives UI placement deferred. |
| **Multi-round** (`N ≥ 2`, no sections) | `"Round {current}/{total}"` | Track fills from 0 → N across the whole game. |
| **Sectioned** | `"{sectionLabel} · {inSection}/{sectionTotal}"` | Track resets at each section boundary (scoped fill). Optional sticky badge for overall `{current}/{total}`. |

## Round loop pattern

```js
async function startGame() {
  // Preview resolves via callback, not promise — wrap it:
  await new Promise(resolve => {
    previewScreen.show({
      instruction, audioUrl, showGameOnPreview: false,
      timerConfig: null, timerInstance: null,
      onComplete: (previewData) => { startGameAfterPreview(previewData); resolve(); }
    });
  });
  await showWelcome();  // transition, tap "I'm ready"
  progressBar.show(); progressBar.update(0, totalLives);
  for (let i = 1; i <= totalRounds; i++) {
    state.round = i;
    await showRoundIntro(i);                // transition, auto-advance on sound end
    progressBar.update(state.roundsCompleted, state.livesLeft);
    const verdict = await renderRoundAndWaitForSubmit(i);
    await runFeedbackWindow(verdict);       // 2000ms, sound + sticker
    if (verdict.correct) {
      state.roundsCompleted++;
      progressBar.update(state.roundsCompleted, state.livesLeft);
    } else {
      state.livesLeft--;
      if (state.livesLeft === 0) return showGameOver();
      progressBar.update(state.roundsCompleted, state.livesLeft);
      i--;  // retry same round
    }
  }
  await showVictory();
}
```

## Star computation

| starModel | Input | Formula |
|---|---|---|
| `lives` | `livesLeft`, `totalLives` | 3 if `livesLeft === totalLives`; 2 if `livesLeft ≥ ceil(totalLives/2)`; 1 if `livesLeft ≥ 1`; else 0 |
| `firstAttempt` | `firstAttemptCorrect / totalRounds` | 3 if ≥ 0.9; 2 if ≥ 0.6; 1 if ≥ 0.3; else 0 |
| `accuracy` | `correct / attempts` | 3 if ≥ 0.9; 2 if ≥ 0.6; 1 if > 0; else 0 |
| `speed` | `elapsedMs`, spec thresholds | 3 if under fast threshold; 2 if under medium; 1 if finished; else 0 |
| `custom` | per spec | Follow spec's explicit rule (e.g., section completion count) |
