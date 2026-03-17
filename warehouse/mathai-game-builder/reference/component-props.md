# Component Props Quick Reference

Quick lookup for component configuration options. For full documentation, see [types/](../types/).

## FeedbackManager.sound.play(id, options)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `subtitle` | `string \| SubtitleOptions` | - | Text to show (supports markdown) |
| `sticker` | `string \| StickerOptions` | - | Lottie animation URL or config |
| `priority` | `number` | `0` | Higher priority prevents interruption |
| `onStart` | `() => void` | - | Callback when audio starts |
| `onComplete` | `() => void` | - | Callback when audio completes |

### SubtitleOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `text` | `string` | - | Subtitle text (markdown supported) |
| `duration` | `number` | auto | Duration in seconds (auto-calculated) |

### StickerOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sticker` | `string` | - | Lottie animation URL |
| `duration` | `number` | auto | Duration in seconds (auto-calculated) |

**Example:**
```javascript
await FeedbackManager.sound.play("correct", {
  subtitle: "**Great!**",
  sticker: "https://cdn.mathai.com/stickers/star.json",
  priority: 10,
  onComplete: () => console.log("Done"),
});
```

**Full docs:** [feedback-manager.d.ts](../types/feedback-manager.d.ts)

---

## TimerComponent(containerId, config)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `timerType` | `'increase' \| 'decrease'` | `'decrease'` | Count up or count down |
| `format` | `'min' \| 'sec'` | `'min'` | MM:SS or SS only |
| `startTime` | `number` | `0` | Starting time in seconds |
| `endTime` | `number` | `0` | Ending time in seconds |
| `showInActionBar` | `boolean` | `false` | Position in action bar style |
| `autoStart` | `boolean` | `true` | Auto-start on creation |
| `onEnd` | `(timeTaken: number) => void` | - | Callback when timer ends |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `void` | Start the timer |
| `pause()` | `void` | Pause the timer |
| `resume()` | `void` | Resume the timer |
| `stop()` | `void` | Stop the timer |
| `reset()` | `void` | Reset to start time |
| `getCurrentTime()` | `number` | Current time in seconds |
| `getTimeTaken()` | `number` | Elapsed time in seconds |
| `getFormattedTime()` | `string` | Formatted time string |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isRunning` | `boolean` | Whether timer is running |
| `isPaused` | `boolean` | Whether timer is paused |
| `currentSeconds` | `number` | Current time value |

**Example:**
```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  format: "min",
  startTime: 60,
  endTime: 0,
  autoStart: true,
  onEnd: (timeTaken) => {
    console.log("Done in", timeTaken, "seconds");
  },
});

// Control
timer.pause();
timer.resume();

// State
console.log("Time:", timer.getCurrentTime());
console.log("Running:", timer.isRunning);
```

**Full docs:** [timer-component.d.ts](../types/timer-component.d.ts)

---

## VisibilityTracker(config)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onInactive` | `() => void` | - | Callback when user goes inactive |
| `onResume` | `() => void` | - | Callback when user clicks resume |
| `popupProps` | `PopupProps` | defaults | Popup configuration |

### PopupProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `icon` | `string` | default icon | Lottie animation URL |
| `title` | `string` | `"Activity Paused"` | Popup title |
| `description` | `string` | default text | Popup description |
| `primaryText` | `string` | `"Resume"` | Primary button text |
| `hasSecondary` | `boolean` | `false` | Show secondary button |
| `secondaryText` | `string` | - | Secondary button text |
| `secondaryClick` | `() => void` | - | Secondary button callback |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `triggerInactive()` | `void` | Manually trigger inactive |
| `triggerResume()` | `void` | Manually trigger resume |
| `isEnabled()` | `boolean` | Check if tracking enabled |
| `isUserInactive()` | `boolean` | Check if user inactive |
| `disable()` | `void` | Stop tracking |
| `enable()` | `void` | Start tracking |

**Example:**
```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  },
  popupProps: {
    icon: "https://cdn.mathai.com/animations/pause.json",
    title: "Quiz Paused",
    description: "Click Resume to continue.",
    primaryText: "Resume Quiz",
    hasSecondary: true,
    secondaryText: "End Quiz",
    secondaryClick: () => endQuiz(),
  },
});

// Testing
tracker.triggerInactive();  // Manual pause
tracker.triggerResume();    // Manual resume
console.log("Inactive?", tracker.isUserInactive());
```

**Full docs:** [visibility-tracker.d.ts](../types/visibility-tracker.d.ts)

---

## FeedbackManager.stream Methods

**⚠️ For dynamic audio, use `FeedbackManager.playDynamicFeedback()` instead** - it's simpler and handles both cached and streaming automatically. These low-level stream methods are only needed for advanced use cases.

| Method | Returns | Description |
|--------|---------|-------------|
| `addFromResponse(id, response)` | `Promise<boolean>` | Add streaming audio |
| `play(id, handlers, feedback)` | `void` | Play streaming audio |
| `pause(id)` | `void` | Pause specific stream |
| `pauseAll()` | `void` | Pause all streams |
| `resume(id)` | `void` | Resume specific stream |
| `resumeAll()` | `void` | Resume all streams |
| `stop(id)` | `void` | Stop specific stream |
| `stopAll()` | `void` | Stop all streams |

**Advanced Example (low-level API):**
```javascript
// Add and play stream
await FeedbackManager.stream.addFromResponse("q1", response);
FeedbackManager.stream.play(
  "q1",
  {
    start: () => console.log("Started"),
    progress: (percent) => console.log(percent),
    complete: () => console.log("Done"),
    error: (err) => console.error(err),
  },
  {
    subtitle: "Question 1",
    sticker: "https://cdn.mathai.com/stickers/listen.json",
  }
);

// Pause/resume with VisibilityTracker
FeedbackManager.stream.pauseAll();
FeedbackManager.stream.resumeAll();
```

**Full docs:** [feedback-manager.d.ts](../types/feedback-manager.d.ts)

---

## Quick Links

- [Components Overview](../components/README.md)
- [Full Type Definitions](../types/)
- [FeedbackManager](../components/feedback-manager.md)
- [TimerComponent](../components/timer-component.md)
- [SubtitleComponent](../components/subtitle-component.md)
- [VisibilityTracker](../components/visibility-tracker.md)
