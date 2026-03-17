# VisibilityTracker Usage Guide

Complete guide for using VisibilityTracker - automatic pause/resume system for MathAI games.

## What is VisibilityTracker?

**VisibilityTracker** monitors tab visibility and automatically pauses all activities (timers, audio, animations) when users switch tabs or minimize the window. When users return, a popup prompts them to resume.

## Why Use VisibilityTracker?

- **Fair gameplay**: Prevents users from gaining advantages by switching tabs
- **Better UX**: Automatically pauses timers so users don't lose progress
- **Audio management**: Prevents audio from playing when user isn't present
- **Session integrity**: Maintains engagement during timed activities

## 🚨 MANDATORY Usage

**VisibilityTracker is MANDATORY for ALL games and activities.** It must be present in every HTML file.

## Installation

Load Helpers package via CDN (includes VisibilityTracker):

```html
<!-- MANDATORY: Load Helpers package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**What's included in Helpers package:**
- VisibilityTracker
- Automatic PopupComponent loading (for resume popup)
- Tab visibility detection
- Event management

**Available globally:**
- `VisibilityTracker` - Direct access
- `MathAIHelpers.VisibilityTracker` - Namespaced access

## Quick Start

### Basic Usage with Timer

```javascript
// Create timer
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0,
  autoStart: true
});

// ✅ MANDATORY: Create VisibilityTracker with pause/resume callbacks
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
    console.log('Timer and audio paused - user switched tab');
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
    console.log('Timer and audio resumed - user clicked resume');
  }
});
```

### Usage with FeedbackManager Audio

```javascript
// ✅ CORRECT: Pause/resume audio with VisibilityTracker
const tracker = new VisibilityTracker({
  onInactive: () => {
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
    console.log('Audio paused - user switched tab');
  },
  onResume: () => {
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
    console.log('Audio resumed - user clicked resume');
  }
});
```

### Combined: Timer + Audio

```javascript
// Timer instance
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 120,
  autoStart: true
});

// ✅ MANDATORY: Pause/resume BOTH timer and audio
const tracker = new VisibilityTracker({
  onInactive: () => {
    // Pause all activities
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
    console.log('All activities paused');
  },
  onResume: () => {
    // Resume all activities
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
    console.log('All activities resumed');
  }
});
```

## Complete Examples

### Example 1: Quiz Game with Timer

```html
<!DOCTYPE html>
<html>
<head>
  <title>Quiz Game</title>
</head>
<body>
  <div id="timer-container"></div>
  <div id="quiz-container">
    <!-- Quiz content -->
  </div>

  <!-- MANDATORY: Load required packages -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

  <script>
    // Timer setup
    const timer = new TimerComponent('timer-container', {
      timerType: 'decrease',
      format: 'min',
      startTime: 180, // 3 minutes
      endTime: 0,
      autoStart: false,
      onEnd: (timeTaken) => {
        submitQuiz();
      }
    });

    // Audio setup
    await FeedbackManager.sound.preload([
      { id: 'tap', url: 'https://...' },
      { id: 'correct', url: 'https://...' },
      { id: 'incorrect', url: 'https://...' }
    ]);

    // ✅ MANDATORY: VisibilityTracker setup
    const tracker = new VisibilityTracker({
      onInactive: () => {
        // Pause timer
        timer.pause();

        // Pause any playing audio
        FeedbackManager.sound.pause();   // Pause regular audio
        FeedbackManager.stream.pauseAll();  // Pause streaming audio

        console.log('Quiz paused - user switched tab');
      },
      onResume: () => {
        // Resume timer
        timer.resume();

        // Resume audio (if it was playing)
        FeedbackManager.sound.resume();   // Resume regular audio
        FeedbackManager.stream.resumeAll();  // Resume streaming audio

        console.log('Quiz resumed - user returned');
      },
      popupProps: {
        title: 'Quiz Paused',
        description: 'Your quiz has been paused. Click Resume to continue.',
        primaryText: 'Resume Quiz'
      }
    });

    // Start quiz
    function startQuiz() {
      timer.start();
      showQuestion(1);
    }

    // Handle answers
    function checkAnswer(isCorrect) {
      if (isCorrect) {
        FeedbackManager.sound.play('correct', {
          subtitle: '**Correct!** Great job!'
        });
      } else {
        FeedbackManager.sound.play('incorrect', {
          subtitle: 'Try again!'
        });
      }
    }
  </script>
</body>
</html>
```

### Example 2: Timed Challenge with Animation

```javascript
// Game state
let gameActive = false;
let animationFrameId = null;

// Timer
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  autoStart: false
});

// Animation loop
function gameLoop() {
  if (!gameActive) return;

  // Update game state
  updateGameLogic();
  renderGame();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// ✅ MANDATORY: VisibilityTracker with animation pause
const tracker = new VisibilityTracker({
  onInactive: () => {
    // Pause timer
    timer.pause();

    // Pause audio
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio

    // Stop animation loop
    gameActive = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    console.log('Game paused - all activities stopped');
  },
  onResume: () => {
    // Resume timer
    timer.resume();

    // Resume audio
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio

    // Restart animation loop
    gameActive = true;
    gameLoop();

    console.log('Game resumed - all activities restarted');
  },
  popupProps: {
    title: 'Game Paused',
    description: 'Your game is paused. Ready to continue?',
    primaryText: 'Continue Playing'
  }
});

// Start game
function startGame() {
  timer.start();
  gameActive = true;
  gameLoop();
}
```

### Example 3: Custom Popup with Secondary Action

```javascript
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 300,
  autoStart: true
});

// ✅ Custom popup with "End Session" option
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
  },
  popupProps: {
    icon: 'https://cdn.mathai.com/animations/pause.json',
    title: 'Session Paused',
    description: 'Your learning session is paused. Would you like to continue or end the session?',
    primaryText: 'Resume Session',
    hasSecondary: true,
    secondaryText: 'End Session',
    secondaryClick: () => {
      // User chose to end session
      timer.stop();
      timer.reset();
      endSession();
      console.log('Session ended by user');
    }
  }
});
```

## Configuration Options

### VisibilityTracker Config

```typescript
interface Config {
  // Callback when user goes inactive
  onInactive?: () => void;

  // Callback when user clicks resume
  onResume?: () => void;

  // Popup configuration
  popupProps?: PopupConfig;

  // Auto-show popup (default: true)
  autoShowPopup?: boolean;

  // Enable tracking on init (default: true)
  enabled?: boolean;
}
```

### Popup Config

```typescript
interface PopupConfig {
  // Lottie animation URL for icon
  icon?: string;

  // Popup title
  title?: string;

  // Popup description/message
  description?: string;

  // Primary button text
  primaryText?: string;

  // Show secondary button?
  hasSecondary?: boolean;

  // Secondary button text
  secondaryText?: string;

  // Z-index for popup
  zIndex?: number;

  // Primary button callback (before onResume)
  primaryClick?: (event: Event) => void;

  // Secondary button callback
  secondaryClick?: (event: Event) => void;
}
```

## Methods

### start()

Start tracking visibility changes. Automatically called if `enabled: true`.

```javascript
tracker.start();
```

### stop()

Stop tracking and hide popup if visible.

```javascript
tracker.stop();
```

### isUserInactive()

Check if user is currently inactive.

```javascript
if (tracker.isUserInactive()) {
  console.log('User is inactive');
}
```

### isEnabled()

Check if tracking is enabled.

```javascript
if (tracker.isEnabled()) {
  console.log('Tracking is active');
}
```

### triggerInactive()

Manually trigger inactive state (useful for testing).

```javascript
// Test pause behavior
tracker.triggerInactive();
```

### triggerResume()

Manually trigger resume (useful for testing).

```javascript
// Test resume behavior
tracker.triggerResume();
```

### updateConfig()

Update configuration dynamically.

```javascript
tracker.updateConfig({
  onInactive: () => {
    console.log('New inactive handler');
    timer.pause();
  },
  popupProps: {
    title: 'New Title'
  }
});
```

### destroy()

Clean up and remove event listeners.

```javascript
// When game/activity ends
tracker.destroy();
```

## Common Patterns

### Pattern 1: Basic Timer Pause/Resume

```javascript
const timer = new TimerComponent('timer', { startTime: 60 });

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
  }
});
```

### Pattern 2: Multiple Timers

```javascript
const mainTimer = new TimerComponent('main-timer', { startTime: 120 });
const bonusTimer = new TimerComponent('bonus-timer', { startTime: 30 });

const tracker = new VisibilityTracker({
  onInactive: () => {
    mainTimer.pause();
    bonusTimer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    mainTimer.resume();
    bonusTimer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
});
```

### Pattern 3: Conditional Pause (Only if Timer Running)

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    // Only pause if timer is actually running
    if (timer.isRunning && !timer.isPaused) {
      timer.pause();
      console.log('Timer paused');
    }
    // Always pause audio
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    // Only resume if timer was paused by us
    if (timer.isPaused) {
      timer.resume();
      console.log('Timer resumed');
    }
    // Always resume audio
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
});
```

### Pattern 4: Save State Before Pause

```javascript
let gameState = {};

const tracker = new VisibilityTracker({
  onInactive: () => {
    // Save current state
    gameState = {
      timerValue: timer.getCurrentTime(),
      score: currentScore,
      questionIndex: currentQuestion
    };

    // Pause activities
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio

    // Save to localStorage
    localStorage.setItem('gameState', JSON.stringify(gameState));
  },
  onResume: () => {
    // Resume activities
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
  }
});
```

### Pattern 5: Analytics Tracking

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio

    // Track pause event
    mixpanel.track('Activity Paused', {
      activity: 'quiz',
      remainingTime: timer.getCurrentTime(),
      timestamp: Date.now()
    });
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio

    // Track resume event
    mixpanel.track('Activity Resumed', {
      activity: 'quiz',
      remainingTime: timer.getCurrentTime(),
      timestamp: Date.now()
    });
  }
});
```

## Best Practices Checklist

```
Required Actions:
[ ] Include VisibilityTracker in games with timers or audio
[ ] Pause ALL activities in onInactive (timer, audio, animations)
[ ] Resume ALL activities in onResume
[ ] Test with manual triggers using triggerInactive() and triggerResume()
[ ] Use clear popup messages explaining why activity is paused
[ ] Log pause/resume events for debugging
[ ] Clean up with destroy() when activity ends

Prohibited Actions:
[ ] VERIFY: No forgetting to resume activities in onResume callback
[ ] VERIFY: No permanent pauses (always provide way to resume)
[ ] VERIFY: No tracking in non-timed activities (optional for reading)
[ ] VERIFY: No relying on automatic resume (popup requires user action)
[ ] VERIFY: No skipping PopupComponent (it's auto-loaded, no manual loading)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Timer doesn't pause | Missing onInactive callback | Add `onInactive: () => timer.pause()` |
| Audio keeps playing | Not pausing audio | Add `FeedbackManager.sound.pause()` in onInactive |
| Popup doesn't show | autoShowPopup is false | Set `autoShowPopup: true` or omit (default) |
| Timer doesn't resume | Missing onResume callback | Add `onResume: () => timer.resume()` |
| Popup loads slowly | PopupComponent loading | Normal - it loads on first inactive event |
| Multiple popups | Multiple trackers created | Use only ONE tracker per page |

## Debugging

### Check Tracker Status

```javascript
console.log('Is tracking?', tracker.isEnabled());
console.log('Is inactive?', tracker.isUserInactive());
```

### Test Without Switching Tabs

```javascript
// Manually trigger inactive
tracker.triggerInactive();

// Wait and check state
setTimeout(() => {
  console.log('Timer paused?', timer.isPaused);
}, 1000);

// Manually trigger resume
tracker.triggerResume();
```

### Log All Events

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    console.log('=== INACTIVE EVENT ===');
    console.log('Timer state:', timer.isPaused);
    console.log('Time:', new Date().toLocaleTimeString());
    timer.pause();
  },
  onResume: () => {
    console.log('=== RESUME EVENT ===');
    console.log('Timer state:', timer.isPaused);
    console.log('Time:', new Date().toLocaleTimeString());
    timer.resume();
  }
});
```

## Integration Checklist

When implementing VisibilityTracker in a game:

- [ ] **Load Helpers package** from CDN (includes VisibilityTracker)
- [ ] **Create tracker instance** in `window.onload` or after timer/audio setup
- [ ] **Implement onInactive callback** that pauses timer, audio, and animations
- [ ] **Implement onResume callback** that resumes timer, audio, and animations
- [ ] **Configure custom popup** with appropriate title and description
- [ ] **Test with tab switching** to verify pause/resume works
- [ ] **Test with manual triggers** using `triggerInactive()` and `triggerResume()`
- [ ] **Verify popup appears** when user returns to tab
- [ ] **Verify resume button works** and all activities resume properly
- [ ] **Add console logs** for debugging pause/resume events
- [ ] **Clean up with destroy()** when game/activity ends

## Related Documentation

- **TimerComponent**: `timer-component-usage.md` - For timer implementation
- **FeedbackManager**: `feedback-manager-usage.md` - For audio management
- **Main Guide**: `../SKILL.md` - Complete game development workflow
