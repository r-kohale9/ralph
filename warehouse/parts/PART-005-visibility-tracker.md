# PART-005: VisibilityTracker

**Category:** MANDATORY | **Condition:** Every game, no exceptions | **Dependencies:** PART-003, PART-004

---

## Code

```javascript
visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    const inactiveStart = Date.now();
    gameState.duration_data.inActiveTime.push({ start: inactiveStart });
    if (signalCollector) {
      signalCollector.pause();
      signalCollector.recordCustomEvent('visibility_hidden', {});
    }
    if (timer) timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
    trackEvent('game_paused', 'system');
  },
  onResume: () => {
    const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
    if (lastInactive && !lastInactive.end) {
      lastInactive.end = Date.now();
      gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
    }
    if (signalCollector) {
      signalCollector.resume();
      signalCollector.recordCustomEvent('visibility_visible', {});
    }
    if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
    trackEvent('game_resumed', 'system');
  },
  popupProps: {
    title: 'Game Paused',
    description: 'Click Resume to continue.',
    primaryText: 'Resume'
  }
});
```

## Placement

Inside DOMContentLoaded (PART-004), AFTER TimerComponent (if any).

## What onInactive MUST Do

1. Record inactive start time in `duration_data.inActiveTime`
2. Pause SignalCollector + record visibility event: `signalCollector.pause()` + `recordCustomEvent('visibility_hidden', {})`
3. Pause timer (if exists): `if (timer) timer.pause({ fromVisibilityTracker: true })`
4. Pause sound: `FeedbackManager.sound.pause()`
5. Pause streams: `FeedbackManager.stream.pauseAll()`

## What onResume MUST Do

1. Record inactive end time, calculate duration, add to `totalInactiveTime`
2. Resume SignalCollector + record visibility event: `signalCollector.resume()` + `recordCustomEvent('visibility_visible', {})`
3. Resume timer ONLY if paused: `if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true })`
4. Resume sound: `FeedbackManager.sound.resume()`
5. Resume streams: `FeedbackManager.stream.resumeAll()`

## Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `onInactive` | `() => void` | Yes | Called when user leaves tab |
| `onResume` | `() => void` | Yes | Called when user clicks Resume |
| `popupProps.title` | `string` | No | Default: "Activity Paused" |
| `popupProps.description` | `string` | No | Popup body text |
| `popupProps.primaryText` | `string` | No | Default: "Resume" |
| `popupProps.hasSecondary` | `boolean` | No | Show secondary button |
| `popupProps.secondaryText` | `string` | No | Secondary button text |
| `popupProps.secondaryClick` | `() => void` | No | Secondary button callback |

## Methods

| Method | Description |
|--------|-------------|
| `triggerInactive()` | Manually trigger pause |
| `triggerResume()` | Manually trigger resume |
| `isUserInactive()` | Check if currently inactive |
| `destroy()` | Cleanup — call in endGame |

## Anti-Patterns

```javascript
// WRONG: Missing timer pause in onInactive
onInactive: () => {
  FeedbackManager.sound.pause();
  // Forgot timer.pause()!
}

// WRONG: Resuming timer unconditionally (crashes if null or not paused)
onResume: () => {
  timer.resume();
}

// WRONG: Missing fromVisibilityTracker flag — audio resume can unpause a visibility-paused timer
if (timer) timer.pause();
if (timer?.isPaused) timer.resume();

// CORRECT: Guard with optional chaining + cross-system flag
if (timer) timer.pause({ fromVisibilityTracker: true });
if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true });

// WRONG: Using stopAll() instead of pause() — destroys audio state, resume does nothing
onInactive: () => {
  FeedbackManager.sound.stopAll();  // Audio state destroyed!
}
onResume: () => {
  FeedbackManager.sound.resume();   // Nothing to resume — state was destroyed
}

// CORRECT: pause()/resume() preserves audio state across tab switches
onInactive: () => {
  FeedbackManager.sound.pause();
  FeedbackManager.stream.pauseAll();
}
onResume: () => {
  FeedbackManager.sound.resume();
  FeedbackManager.stream.resumeAll();
}
```

**Why `fromVisibilityTracker: true`?** FeedbackManager calls `timer.pause/resume({ fromAudio: true })` internally. The timer uses cross-system blocking: if paused by visibility tracker, an audio resume won't unpause it (and vice versa). Without the flag, this protection doesn't work.

**Why `pause()` not `stopAll()`?** `stopAll()` destroys all audio buffers and playback state. When the user returns to the tab, `resume()` has nothing to work with. `pause()` preserves the state so playback can continue from where it left off.

## Verification

- [ ] VisibilityTracker instantiated
- [ ] `onInactive` pauses: signalCollector, timer (if exists, with `{ fromVisibilityTracker: true }`), sound, streams
- [ ] `onInactive` uses `sound.pause()` NOT `sound.stopAll()`
- [ ] `onInactive` records `visibility_hidden` custom event on signalCollector
- [ ] `onInactive` records inactive start in `duration_data.inActiveTime`
- [ ] `onResume` resumes: signalCollector, timer (only if paused, with `{ fromVisibilityTracker: true }`), sound, streams
- [ ] `onResume` records `visibility_visible` custom event on signalCollector
- [ ] `onResume` records inactive end and updates `totalInactiveTime`
- [ ] `popupProps` configured with title, description, primaryText
- [ ] `destroy()` called in endGame cleanup

## Deep Reference

`mathai-game-builder/components/visibility-tracker.md`
