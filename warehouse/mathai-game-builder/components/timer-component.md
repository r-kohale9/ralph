# TimerComponent

Countdown/countup timer with MM:SS or SS format.

## Overview

TimerComponent provides:
- Count down (decrease) or count up (increase)
- Display formats: MM:SS or SS only
- Auto-start capability
- Control methods: start, pause, resume, stop, reset
- State access: getCurrentTime(), getTimeTaken()

## Installation

```html
<!-- Load Components package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

## Usage

### Countdown Timer

```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  format: "min",        // MM:SS format
  startTime: 60,        // Start at 60 seconds
  endTime: 0,           // Stop at 0
  autoStart: true,
  onEnd: (timeTaken) => {
    alert("Time is up!");
    submitGame();
  },
});
window.timer = timer;  // Store globally for debugging and external access
```

### Countup Timer

```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "increase",
  format: "min",
  startTime: 0,
  endTime: 9999999,  // Large number for unlimited counting
  autoStart: true,
  onEnd: (timeTaken) => {
    console.log("Game finished in", timeTaken, "seconds");
  },
});
window.timer = timer;  // Store globally for debugging and external access
```

### Control Methods

```javascript
// Control timer
timer.start();
timer.pause();
timer.resume();
timer.stop();
timer.reset();

// Get state
const current = timer.getCurrentTime();     // seconds
const elapsed = timer.getTimeTaken();       // seconds
const formatted = timer.getFormattedTime(); // "MM:SS" or "SS"
```

## Critical Rules

### TimerComponent Usage Checklist

```
[ ] Use TimerComponent for all timers
[ ] VERIFY: No custom timer implementations
```

```javascript
// CORRECT - Use TimerComponent
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 60,
});
window.timer = timer;  // Store globally for debugging

// WRONG - Never create manual timers
let timeLeft = 60;
setInterval(() => {
  timeLeft--;
  document.getElementById("timer").textContent = timeLeft;  // VERIFY: No custom timers!
}, 1000);
```

### MUST Integrate with VisibilityTracker

For games with timers, you MUST use VisibilityTracker to pause/resume when users switch tabs:

```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 60,
  autoStart: true,
});
window.timer = timer;  // Store globally for debugging

// MANDATORY: VisibilityTracker integration
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause({ fromVisibilityTracker: true }); // Pause timer
    FeedbackManager.sound.pause();         // Pause audio
    FeedbackManager.stream.pauseAll();     // Pause streaming
  },
  onResume: () => {
    timer.resume({ fromVisibilityTracker: true }); // Resume timer
    FeedbackManager.sound.resume();        // Resume audio
    FeedbackManager.stream.resumeAll();    // Resume streaming
  },
});
```

## Integration with VisibilityTracker

**Why it's mandatory:**
- Fair gameplay - prevents users from gaming the system by switching tabs
- Better UX - auto-pauses when user is distracted
- Session integrity - maintains engagement

**What to pause:**
- Timer (always)
- Audio (both sound and stream)
- Animations (if any)
- Intervals/timeouts (if any)

See [VisibilityTracker](./visibility-tracker.md) for details.

## Full Documentation

For complete API reference, type definitions, and advanced usage:
- [TimerComponent Type Definitions](../types/timer-component.d.ts)
- [TimerComponent Full Usage Guide](../types/timer-component-usage.md)
- [Component Props Reference](../reference/component-props.md)

## Related Components

- [VisibilityTracker](./visibility-tracker.md) - MANDATORY integration
- [FeedbackManager](./feedback-manager.md) - Audio feedback
