# TimerComponent Usage Guide

Complete guide for using TimerComponent in MathAI games.

## Installation

Load TimerComponent via CDN (single script tag):

```html
<!-- REQUIRED: Load Components package (includes TimerComponent) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

That's it! The component is ready to use.

## Quick Start

### 1. Create Container Element

```html
<div id="timer-display"></div>
```

### 2. Initialize Timer

```javascript
const timer = new TimerComponent('timer-display', {
  timerType: 'decrease',
  format: 'min',
  startTime: 60,
  endTime: 0,
  autoStart: true,
  onEnd: (timeTaken) => {
    console.log('Timer finished! Took', timeTaken, 'seconds');
  }
});
window.timer = timer;  // Store globally for debugging and external access
```

### 3. Control Timer

```javascript
// Pause the timer
timer.pause();

// Resume the timer
timer.resume();

// Reset to start
timer.reset();

// Get current time
const current = timer.getCurrentTime();
console.log('Current time:', current, 'seconds');
```

## Complete Examples

### Example 1: Countdown Timer (60 seconds)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Countdown Timer</title>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
</head>
<body>
  <div id="countdown-timer"></div>
  <button onclick="timer.start()">Start</button>
  <button onclick="timer.pause()">Pause</button>
  <button onclick="timer.resume()">Resume</button>
  <button onclick="timer.reset()">Reset</button>

  <script>
    const timer = new TimerComponent('countdown-timer', {
      timerType: 'decrease',
      format: 'min',
      startTime: 60,
      endTime: 0,
      autoStart: false,
      onEnd: (timeTaken) => {
        alert('Time\'s up! Took ' + timeTaken + ' seconds');
      }
    });
    window.timer = timer;  // Store globally for debugging
  </script>
</body>
</html>
```

### Example 2: Stopwatch (Count Up)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stopwatch</title>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
</head>
<body>
  <div id="stopwatch-timer"></div>
  <button onclick="stopwatch.start()">Start</button>
  <button onclick="stopwatch.stop()">Stop</button>

  <script>
    const stopwatch = new TimerComponent('stopwatch-timer', {
      timerType: 'increase',
      format: 'min',
      startTime: 0,
      endTime: 300, // Stop at 5 minutes
      autoStart: false,
      onEnd: (timeTaken) => {
        console.log('Stopwatch reached 5 minutes!');
      }
    });
    window.timer = stopwatch;  // Store globally for debugging
  </script>
</body>
</html>
```

### Example 3: Action Bar Timer (Positioned)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Action Bar Timer</title>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <style>
    #game-area {
      position: relative;
      width: 100%;
      height: 400px;
      background: #f0f0f0;
      border: 2px solid #ccc;
    }
  </style>
</head>
<body>
  <div id="game-area">
    <div id="action-timer"></div>
  </div>

  <script>
    const timer = new TimerComponent('action-timer', {
      timerType: 'decrease',
      format: 'min',
      startTime: 120,
      endTime: 0,
      showInActionBar: true, // Positioned at top center
      autoStart: true,
      onEnd: () => {
        alert('Game over!');
      }
    });
    window.timer = timer;  // Store globally for debugging
  </script>
</body>
</html>
```

### Example 4: Seconds-Only Display

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Seconds Timer</title>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
</head>
<body>
  <div id="seconds-timer"></div>

  <script>
    const timer = new TimerComponent('seconds-timer', {
      timerType: 'decrease',
      format: 'sec', // Display seconds only
      startTime: 30,
      endTime: 0,
      autoStart: true,
      onEnd: () => {
        console.log('30 seconds elapsed!');
      }
    });
    window.timer = timer;  // Store globally for debugging
  </script>
</body>
</html>
```

### Example 5: Dynamic Timer Control

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dynamic Timer</title>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
</head>
<body>
  <div id="dynamic-timer"></div>
  <button onclick="addTime()">Add 10 Seconds</button>
  <button onclick="removeTime()">Remove 10 Seconds</button>
  <button onclick="toggleFormat()">Toggle Format</button>
  <button onclick="toggleDirection()">Toggle Direction</button>

  <script>
    const timer = new TimerComponent('dynamic-timer', {
      timerType: 'decrease',
      format: 'min',
      startTime: 60,
      endTime: 0,
      autoStart: true
    });
    window.timer = timer;  // Store globally for debugging

    function addTime() {
      const current = timer.getCurrentTime();
      timer.setTime(current + 10);
      console.log('Added 10 seconds');
    }

    function removeTime() {
      const current = timer.getCurrentTime();
      timer.setTime(Math.max(0, current - 10));
      console.log('Removed 10 seconds');
    }

    function toggleFormat() {
      const newFormat = timer.config.format === 'min' ? 'sec' : 'min';
      timer.updateConfig({ format: newFormat });
      console.log('Format changed to:', newFormat);
    }

    function toggleDirection() {
      const newType = timer.config.timerType === 'decrease' ? 'increase' : 'decrease';
      const newEnd = newType === 'increase' ? 120 : 0;
      timer.updateConfig({
        timerType: newType,
        endTime: newEnd
      });
      console.log('Timer type changed to:', newType);
    }
  </script>
</body>
</html>
```

## Configuration Options

### timerType

**Type:** `'increase' | 'decrease'`
**Default:** `'decrease'`

Direction of timer progression:
- `'decrease'`: Count down (e.g., 60 → 59 → 58...)
- `'increase'`: Count up (e.g., 0 → 1 → 2...)

```javascript
// Countdown timer
new TimerComponent('timer', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0
});

// Stopwatch
new TimerComponent('timer', {
  timerType: 'increase',
  startTime: 0,
  endTime: 300
});
```

### format

**Type:** `'min' | 'sec'`
**Default:** `'min'`

Display format:
- `'min'`: Show as MM:SS (e.g., "01:30")
- `'sec'`: Show seconds only (e.g., "90")

```javascript
// Minutes and seconds
new TimerComponent('timer', {
  format: 'min',
  startTime: 90
}); // Displays: "01:30"

// Seconds only
new TimerComponent('timer', {
  format: 'sec',
  startTime: 90
}); // Displays: "90"
```

### startTime

**Type:** `number`
**Default:** `0`

Initial time value in seconds.

```javascript
new TimerComponent('timer', {
  timerType: 'decrease',
  startTime: 120, // Start at 2 minutes
  endTime: 0
});
```

### endTime

**Type:** `number`
**Default:** `0`

Time value when timer stops in seconds.

```javascript
// Count down to zero
new TimerComponent('timer', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0
});

// Count up to 5 minutes
new TimerComponent('timer', {
  timerType: 'increase',
  startTime: 0,
  endTime: 300
});
```

### showInActionBar

**Type:** `boolean`
**Default:** `false`

Position timer at top center of container (action bar style).

```javascript
// Regular positioning
new TimerComponent('timer', {
  showInActionBar: false
});

// Action bar positioning (top center)
new TimerComponent('timer', {
  showInActionBar: true
});
```

### autoStart

**Type:** `boolean`
**Default:** `true`

Automatically start timer on creation.

```javascript
// Auto-start
const timer = new TimerComponent('timer', {
  autoStart: true
}); // Timer starts immediately

// Manual start
const timer = new TimerComponent('timer', {
  autoStart: false
}); // Call timer.start() when ready
```

### onEnd

**Type:** `((timeTaken: number) => void) | null`
**Default:** `null`

Callback function when timer reaches endTime. Receives elapsed time in seconds.

```javascript
new TimerComponent('timer', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0,
  onEnd: (timeTaken) => {
    console.log('Timer finished!');
    console.log('Time taken:', timeTaken, 'seconds');
    alert('Time\'s up!');
    // Proceed to next question, submit results, etc.
  }
});
```

## API Methods

### Control Methods

#### `start()`

Start the timer. Does nothing if already running and not paused.

```javascript
timer.start();
```

#### `pause()`

Pause the timer. Timer continues running but stops updating time.

```javascript
timer.pause();
```

#### `resume()`

Resume a paused timer.

```javascript
timer.resume();
```

#### `stop()`

Stop the timer completely and clear the interval.

```javascript
timer.stop();
```

#### `reset()`

Reset timer to start time and stop.

```javascript
timer.reset();
```

### State Methods

#### `getCurrentTime()`

Get current time value in seconds.

```javascript
const current = timer.getCurrentTime();
console.log('Current time:', current, 'seconds');
```

#### `getTimeTaken()`

Get time elapsed since start (absolute difference).

```javascript
const elapsed = timer.getTimeTaken();
console.log('Time elapsed:', elapsed, 'seconds');
```

#### `getFormattedTime()`

Get formatted time string based on current format setting.

```javascript
const formatted = timer.getFormattedTime();
console.log(formatted); // "01:30" or "90"
```

### Configuration Methods

#### `updateConfig(newConfig)`

Update timer configuration dynamically.

```javascript
// Change timer direction
timer.updateConfig({
  timerType: 'increase',
  endTime: 120
});

// Change display format
timer.updateConfig({ format: 'sec' });

// Change multiple settings
timer.updateConfig({
  timerType: 'decrease',
  format: 'min',
  startTime: 90,
  endTime: 0
});
```

#### `setTime(seconds)`

Set current time directly.

```javascript
timer.setTime(30); // Jump to 30 seconds
```

### Cleanup

#### `destroy()`

Destroy the timer and clean up resources.

```javascript
timer.destroy();
```

## Common Patterns

### Pattern 1: Quiz with Time Limit

```javascript
const quizTimer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'min',
  startTime: 300, // 5 minutes
  endTime: 0,
  autoStart: true,
  onEnd: (timeTaken) => {
    // Time's up - submit quiz
    submitQuiz();
    alert('Time is up! Your answers have been submitted.');
  }
});
window.timer = quizTimer;  // Store globally for debugging

// Pause timer when user pauses game
pauseButton.onclick = () => {
  quizTimer.pause();
};

// Resume timer
resumeButton.onclick = () => {
  quizTimer.resume();
};
```

### Pattern 2: Tracking Time Spent per Question

```javascript
let currentQuestion = 0;
const questionStartTimes = [];

// Create stopwatch for each question
const questionTimer = new TimerComponent('timer-container', {
  timerType: 'increase',
  format: 'sec',
  startTime: 0,
  endTime: 999, // Large value
  autoStart: false
});
window.timer = questionTimer;  // Store globally for debugging

function startQuestion(questionNumber) {
  currentQuestion = questionNumber;
  questionTimer.reset();
  questionTimer.start();
}

function submitAnswer() {
  const timeSpent = questionTimer.getCurrentTime();
  questionStartTimes.push({
    question: currentQuestion,
    timeSpent: timeSpent
  });

  console.log('Question', currentQuestion, 'took', timeSpent, 'seconds');

  // Move to next question
  nextQuestion();
}
```

### Pattern 3: Per-Round Timer with Reset

```javascript
const roundTimer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'sec',
  startTime: 30,
  endTime: 0,
  autoStart: false,
  onEnd: () => {
    // Round time expired
    skipToNextRound();
  }
});
window.timer = roundTimer;  // Store globally for debugging

function startRound(roundNumber) {
  roundTimer.reset();
  roundTimer.start();
  console.log('Round', roundNumber, 'started');
}

function nextRound() {
  currentRound++;
  startRound(currentRound);
}
```

### Pattern 4: Bonus Time Rewards

```javascript
const gameTimer = new TimerComponent('timer-container', {
  timerType: 'increase',
  format: 'min',
  startTime: 0,
  endTime: 600, // 10 minutes max
  autoStart: true
});
window.timer = gameTimer;  // Store globally for debugging

function checkAnswer(userAnswer, correctAnswer) {
  if (userAnswer === correctAnswer) {
    // Reward: add 10 seconds
    const current = gameTimer.getCurrentTime();
    const newTime = Math.max(0, current - 10); // Subtract from elapsed time
    gameTimer.setTime(newTime);

    console.log('Correct! Bonus: -10 seconds');
  }
}
```

### Pattern 5: Combined with Game State

```javascript
let gameState = {
  score: 0,
  questionsAnswered: 0,
  timeElapsed: 0
};

const gameTimer = new TimerComponent('timer-container', {
  timerType: 'increase',
  format: 'min',
  startTime: 0,
  endTime: 999,
  autoStart: true
});
window.timer = gameTimer;  // Store globally for debugging

// Update game state periodically
setInterval(() => {
  gameState.timeElapsed = gameTimer.getCurrentTime();
}, 1000);

function endGame() {
  gameTimer.stop();

  const finalResults = {
    ...gameState,
    timeElapsed: gameTimer.getCurrentTime()
  };

  console.log('Game Results:', JSON.stringify(finalResults, null, 2));
  submitResults(finalResults);
}
```

## Integration with Game Events

### With Event Tracking

```javascript
const eventTracker = {
  events: [],
  track(type, data) {
    this.events.push({
      type,
      timestamp: Date.now(),
      gameTime: timer.getCurrentTime(),
      ...data
    });
  }
};

const timer = new TimerComponent('timer-container', {
  timerType: 'increase',
  startTime: 0,
  endTime: 600,
  autoStart: true
});
window.timer = timer;  // Store globally for debugging

// Track events with timer context
document.getElementById('answer-btn').onclick = () => {
  eventTracker.track('answer_submitted', {
    timeElapsed: timer.getCurrentTime(),
    answer: userAnswer
  });
};
```

### With Results Submission

```javascript
const timer = new TimerComponent('timer-container', {
  timerType: 'increase',
  format: 'min',
  startTime: 0,
  endTime: 999,
  autoStart: true
});
window.timer = timer;  // Store globally for debugging

function submitGameResults() {
  const results = {
    gameId: 'multiplication-quiz',
    metrics: {
      accuracy: calculateAccuracy(),
      time: window.gameVariableState.timerElapsedTimes.reduce((a,b)=>a+b, 0), // Total time spent (sum of sessions)
      score: currentScore,
      timeBreakdown: window.gameVariableState.timerElapsedTimes // Individual session times
    },
    completedAt: Date.now()
  };

  console.log('Results:', JSON.stringify(results, null, 2));

  // Send to parent window
  window.parent.postMessage({
    type: 'game_complete',
    data: results
  }, '*');
}
```

## Styling

The timer renders with inline styles by default. To customize appearance:

### CSS Variables Approach

```html
<style>
  /* Override timer styles */
  .timer-display {
    font-size: 32px !important;
    font-weight: 700 !important;
    color: #ff0000 !important;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 10px 20px;
  }
</style>
```

### JavaScript Approach

```javascript
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0
});
window.timer = timer;  // Store globally for debugging

// Customize after creation
const timerDisplay = document.querySelector('#timer-container .timer-display');
timerDisplay.style.fontSize = '32px';
timerDisplay.style.color = '#ff0000';
timerDisplay.style.background = 'rgba(0, 0, 0, 0.1)';
```

## Best Practices

### 1. Always Create Container First

```javascript
// ✅ GOOD - Container exists
<div id="timer"></div>
<script>
  const timer = new TimerComponent('timer', { ... });
</script>

// ❌ BAD - Container not found
<script>
  const timer = new TimerComponent('timer', { ... }); // Error!
</script>
<div id="timer"></div>
```

### 2. Clean Up When Done

```javascript
// When game ends or component unmounts
timer.destroy();
```

### 3. Use Appropriate Format

```javascript
// For short durations (< 60s), use seconds
const shortTimer = new TimerComponent('timer', {
  format: 'sec',
  startTime: 30
});

// For longer durations, use minutes
const longTimer = new TimerComponent('timer', {
  format: 'min',
  startTime: 300
});
```

### 4. Provide onEnd Callback

```javascript
// Always handle timer completion
const timer = new TimerComponent('timer', {
  startTime: 60,
  endTime: 0,
  onEnd: (timeTaken) => {
    // Handle completion
    console.log('Timer finished after', timeTaken, 'seconds');
    showResults();
  }
});
```

### 5. Store Timer Instance

```javascript
// Store reference for later use
let gameTimer = null;

function startGame() {
  gameTimer = new TimerComponent('timer', {
    timerType: 'increase',
    startTime: 0,
    endTime: 600,
    autoStart: true
  });
  window.timer = gameTimer;  // Store globally for debugging
}

function pauseGame() {
  if (gameTimer) {
    gameTimer.pause();
  }
}

// Record attempt when round ends
function recordAttempt() {
  const endTime = Date.now();
  const duration = gameTimer.getCurrentTime() - roundStartTimerValue;
  const overallCorrectness = question.was_correct ? 1.0 : 0.0;

  attemptHistory.push({
    attempt_number: attemptNumber,
    start_timestamp: new Date(roundStartTime).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    duration: duration,
    overall_correctness: overallCorrectness,
    metadata: {
      round_number: roundNumber,
      level_number: levelNumber,
      content_visible: contentVisible,
      content_interactive: contentInteractive,
      content_interacted: contentInteracted,
      question: question
    }
  });
}

function endGame() {
  if (gameTimer) {
    // Record the completed attempt
    recordAttempt();

    // Calculate metrics only
    const metrics = {
      time: window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0),
      accuracy: overallCorrectness,
      stars: calculateStars(),
      retries: attemptNumber - 1,
      timeBreakdown: window.gameVariableState.timerElapsedTimes
    };

    // Submit with accumulated attemptHistory
    submitGame(attemptHistory);

    // Capture final elapsed times before destroying
    window.gameVariableState.timerElapsedTimes = gameTimer.getElapsedTimes();
    gameTimer.destroy();
    gameTimer = null;
  }
}
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Container not found" error | Container element doesn't exist | Ensure container element exists before creating timer |
| Timer not updating | Timer not started | Call `timer.start()` or set `autoStart: true` |
| Timer running after destroy | Not properly cleaned up | Call `timer.destroy()` when done |
| Multiple timers overlap | Multiple instances on same element | Use unique container IDs for each timer |
| Format not changing | Config update doesn't trigger re-render | Use `timer.updateConfig({ format: 'sec' })` |

## Advanced Usage

### Multiple Timers

```javascript
// Create multiple independent timers
const questionTimer = new TimerComponent('question-timer', {
  timerType: 'increase',
  format: 'sec',
  startTime: 0,
  endTime: 999,
  showInActionBar: false
});

const gameTimer = new TimerComponent('game-timer', {
  timerType: 'decrease',
  format: 'min',
  startTime: 600,
  endTime: 0,
  showInActionBar: true
});
```

### Dynamic Configuration Changes

```javascript
const timer = new TimerComponent('timer', {
  timerType: 'decrease',
  format: 'min',
  startTime: 60,
  endTime: 0
});
window.timer = timer;  // Store globally for debugging

// Change to stopwatch mode mid-game
function switchToStopwatch() {
  timer.updateConfig({
    timerType: 'increase',
    startTime: timer.getCurrentTime(),
    endTime: 999
  });
}

// Switch display format based on remaining time
setInterval(() => {
  const current = timer.getCurrentTime();
  if (current < 60 && timer.config.format === 'min') {
    timer.updateConfig({ format: 'sec' });
  }
}, 1000);
```

## See Also

- **AudioKit**: For game audio feedback
- **SubtitleComponent**: For displaying text feedback
- **Game Builder Skill**: Complete game creation guide
