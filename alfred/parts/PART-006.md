### PART-006: TimerComponent
**Purpose:** Countdown or count-up timer with pause/resume support.
**Condition:** Game has time pressure.
**API:** `new TimerComponent('timer-container', { timerType, format, startTime, endTime, autoStart, onEnd })`
**Key rules:**
- `timerType`: `'decrease'` (countdown) or `'increase'` (count-up)
- `format`: `'min'` (MM:SS) or `'sec'` (SS)
- Methods: `.start()`, `.pause({ fromVisibilityTracker })`, `.resume({ fromVisibilityTracker })`, `.getTimeTaken()`, `.reset()`
- Create BEFORE VisibilityTracker so tracker can reference `timer`
- `autoStart: false` — start manually after game begins

**Mount + layout (MANDATORY — same in every game, required because PreviewScreen does NOT mirror `timerInstance` into the header):**

- HTML: append `<div id="timer-container"></div>` as a direct child of `#mathai-preview-slot` (positioned ancestor). NOT inside `.mathai-preview-header` / `.mathai-preview-header-center`.
- CSS: set `#mathai-preview-slot { position: relative; }` and absolute-center the timer top-center:
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
- Override TimerComponent's hard-coded 320×41 / 24px / `#000FFF` `.timer-display` styles so it fits the header:
  ```css
  #timer-container .timer-wrapper { padding: 0 !important; margin: 0 !important; }
  #timer-container .timer-display {
    width: auto !important; height: auto !important; padding: 0 !important;
    font-size: 16px !important; font-weight: 700 !important;
    color: var(--mathai-primary) !important;
    font-family: var(--mathai-font-family) !important;
  }
  #previewTimerText { display: none !important; }
  ```

This matches the canonical React `TimerComponent`'s `showInActionBar: true` layout (`src/modules/home/view/activity/Components/Blocks/AllInOne/ComponentV2/components/timer/index.tsx`).

**Per-round reset vs. cumulative timer (MANDATORY):**

Decide once per spec whether the timer is **per-round** (resets every round) or **cumulative** (runs continuously across rounds/levels), then follow the matching rule:

- **Per-round reset:** Call `timer.reset()` (and `timer.start()` if needed) **before** `transitionScreen.show(...)` for the round-complete transition. The transition screen must already display the fresh `00:00` so the player never sees the previous round's final value flash through the transition. Resetting after the transition closes causes a visible jump.
- **Cumulative across rounds/levels:** Do **NOT** reset between rounds. The timer keeps ticking through the round-complete transition (or is paused via `timer.pause()` if you want the transition to freeze it, then resumed on the next round). It only resets on Play Again / Try Again, per the end-of-game rules below.

Picking the wrong mode is a spec bug, not a timing bug — confirm the intent in `spec.md` before wiring round-complete handlers.

**End-of-game cleanup (MANDATORY):**

The timer must stop ticking the moment the player can no longer interact with the game — i.e. the moment a Victory or Game Over screen appears, or any screen where the core gameplay is complete. The "core game" is over once one of these screens is shown; continuing to tick after `game_complete` is misleading because the player isn't playing any more. Post-game screens (Stars Collected, AnswerComponent carousel, end-of-game transition stack) inherit the same paused state — they are review states, not gameplay.

Apply at every terminal handler (typical names: `showVictory`, `showGameOver`, `endGame`):

```js
try { if (timer && timer.pause) timer.pause(); } catch (e) {}
```

Rules:

- Stop the timer **before** calling `transitionScreen.show(...)` for Victory / Game Over.
- It is NOT enough to put the stop call inside a function literally named `endGame()` if your terminal phase transitions (`showVictory()` / `showGameOver()`) don't route through it. Stop on **every** path that posts `game_complete` or sets `gameState.phase` to `'results'` / `'game_over'`.
- On **Play Again / Try Again / Replay**, the restart path (`restartGame()` or equivalent) MUST treat the timer like a fresh page load: re-mount or `reset()` + `start()` so the stopwatch begins at 0 again. The whole game restarts — that includes the timer.
- Pause is also the right method when the visibility tracker fires (background tab); this rule is specifically about end-of-gameplay, not the visibility case.

**Verification:**

- [ ] Timer value visibly stops on the Victory screen (screenshot, wait 3 s, screenshot — value unchanged).
- [ ] Timer value visibly stops on the Game Over screen (same check).
- [ ] After Play Again / Try Again, timer resets to `00:00` and resumes ticking on the first round.
- [ ] Every code path that posts `game_complete` (or sets `gameState.phase` to `'results'` / `'game_over'`) invokes `timer.pause()` first — confirmed by reading the source, not just by checking that a function named `endGame()` contains the call.
