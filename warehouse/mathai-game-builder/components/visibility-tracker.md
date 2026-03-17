# VisibilityTracker

Automatically pause/resume activities when users switch tabs.

## Overview

VisibilityTracker provides:
- Detects tab switching and window minimization
- Calls `onInactive` callback to pause activities
- Shows resume popup when user returns
- Calls `onResume` callback when user clicks resume
- Auto-loads PopupComponent for resume dialog

## Installation

```html
<!-- Load Helpers package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## Basic Usage

### With Timer

```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 60,
  autoStart: true,
});

// MANDATORY: VisibilityTracker
const tracker = new VisibilityTracker({
  onInactive: () => {
    // User switched tab - pause everything
    timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();         // Pause regular audio
    FeedbackManager.stream.pauseAll();     // Pause streaming audio
  },
  onResume: () => {
    // User clicked resume - resume everything
    timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();        // Resume regular audio
    FeedbackManager.stream.resumeAll();    // Resume streaming audio
  },
});
```

### With Timer + Audio

```javascript
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  startTime: 120,
  autoStart: true,
});

await FeedbackManager.sound.preload([
  { id: "tap", url: "https://..." },
  { id: "correct", url: "https://..." },
]);

const tracker = new VisibilityTracker({
  onInactive: () => {
    // Pause ALL activities
    timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
    console.log("All activities paused");
  },
  onResume: () => {
    // Resume ALL activities
    timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
    console.log("All activities resumed");
  },
  popupProps: {
    title: "Activity Paused",
    description: "Your activity has been paused. Click Resume to continue.",
    primaryText: "Resume",
  },
});
```

## What to Pause

Always pause ALL activities in `onInactive`:

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    // Pause timer (if exists)
    if (timer) timer.pause({ fromVisibilityTracker: true });

    // Pause all audio (BOTH regular and streaming)
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();

    // Stop animations (if using requestAnimationFrame)
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Pause intervals/timeouts (if any)
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
  },
  onResume: () => {
    // Resume timer
    if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });

    // Resume all audio
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();

    // Restart animations
    if (!animationFrameId) gameLoop();

    // Restart intervals
    if (!gameInterval) {
      gameInterval = setInterval(updateGame, 100);
    }
  },
});
```

## Custom Popup

Customize the resume popup appearance and behavior:

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  },
  popupProps: {
    icon: "https://cdn.mathai.com/animations/pause.json",
    title: "Quiz Paused",
    description: "Your quiz has been paused. Would you like to continue or end the quiz?",
    primaryText: "Resume Quiz",
    hasSecondary: true,
    secondaryText: "End Quiz",
    secondaryClick: () => {
      // User chose to end quiz
      timer.stop();
      timer.reset();
      endQuiz();
    },
  },
});
```

## Critical Rules

### MANDATORY for Timers and Audio

VisibilityTracker is REQUIRED for:
- All games with timers
- All games with audio playback
- Any timed activities

**Why?**
- Fair gameplay - prevents tab-switching advantages
- Better UX - auto-pauses when distracted
- Audio management - prevents audio playing when user isn't present
- Session integrity - maintains engagement

### Common Mistakes

```javascript
// WRONG - Not pausing audio
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    // Forgot to pause audio!
  },
});

// WRONG - Only pausing regular audio
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();
    // Forgot FeedbackManager.stream.pauseAll()!
  },
});

// WRONG - No onResume callback
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  // Forgot onResume!
});

// CORRECT - Pause ALL activities
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();         // Regular audio
    FeedbackManager.stream.pauseAll();     // Streaming audio
  },
  onResume: () => {
    if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  },
});
```

## Testing

### Test with Tab Switching

1. Start your game/activity
2. Switch to another tab
3. Wait a moment
4. Return to your game tab
5. Verify popup appears
6. Click "Resume"
7. Verify timer and audio resume correctly

### Manual Testing

```javascript
// Manually trigger inactive state (debugging)
window.testPause = function() {
  tracker.triggerInactive();
  console.log("Manually triggered pause");
};

// Manually trigger resume (debugging)
window.testResume = function() {
  tracker.triggerResume();
  console.log("Manually triggered resume");
};

// Check tracker status
console.log("Is tracking?", tracker.isEnabled());
console.log("Is inactive?", tracker.isUserInactive());
```

## Full Documentation

For complete API reference, type definitions, and advanced usage:
- [VisibilityTracker Type Definitions](../types/visibility-tracker.d.ts)
- [VisibilityTracker Full Usage Guide](../types/visibility-tracker-usage.md)
- [Component Props Reference](../reference/component-props.md)

## Related Components

- [TimerComponent](./timer-component.md) - MANDATORY integration
- [FeedbackManager](./feedback-manager.md) - Audio pause/resume
