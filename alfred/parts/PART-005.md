### PART-005: VisibilityTracker
**Purpose:** Pauses game (timer, audio, signals) when tab loses focus, resumes on return.
**API:** `new VisibilityTracker({ onInactive, onResume, popupProps })`
**Key rules:**
- `onInactive`: pause timer, pause `FeedbackManager.sound`/`stream`, record inactive time
- `onResume`: resume timer (only if `isPaused`), resume audio, record inactive end time
- Shows a "Game Paused" popup via `popupProps`
- Use `visibilityTracker.triggerInactive()` for testing (NOT `simulatePause()`)

**Respect intentional pauses on resume (MANDATORY):**

When the timer is intentionally paused by the game (awaited feedback, between-round transition screen, victory / game over screen, any modal/overlay that blocks gameplay), the player switching tabs and returning **must not** resume the timer. Only the gameplay flow that paused it (feedback complete, next round start, restart, etc.) is allowed to resume it.

Track an `intentionallyPaused` flag in the game and gate `onResume`:

```js
// Wherever the game pauses the timer for a non-visibility reason:
gameState.timerIntentionallyPaused = true;
timer.pause();
// ... show feedback / transition / victory ...

// When that flow finishes and the game wants the timer back:
gameState.timerIntentionallyPaused = false;
timer.resume();

// VisibilityTracker config:
new VisibilityTracker({
  onInactive: () => {
    if (!gameState.timerIntentionallyPaused) timer.pause({ fromVisibilityTracker: true });
    // audio/signals can still be paused unconditionally
  },
  onResume: () => {
    if (!gameState.timerIntentionallyPaused) timer.resume({ fromVisibilityTracker: true });
    // audio/signals resume unconditionally
  },
  popupProps: { ... },
});
```

The flag is owned by the game, not the tracker — the tracker has no way to know *why* the timer was paused, so the game must tell it. Forgetting this gate causes the timer to silently restart mid-feedback / on the victory screen the moment the player tabs back in.
