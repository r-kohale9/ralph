# Anti-Patterns (DO NOT USE)

⚠️ **These are WRONG implementations - DO NOT COPY these examples!**

**Note:** Error tracking (Sentry) is added in **Phase 5 - Production Readiness**, not during development (Phases 1-4).

## ❌ Anti-Pattern 0: Missing Error Tracking (Phase 5)

**Problem:** No centralized error tracking means silent failures in production, making debugging impossible and user issues undetected.

**Bad Code:**

```javascript
// ❌ WRONG - No Sentry, no error tracking
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
  console.log('✅ Packages loaded');
}

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();
  setupGame();
});

// ❌ No global error handlers
// ❌ No try-catch blocks
// ❌ No timeout on package loading
// ❌ Errors silently disappear
```

**Why This Fails:**

- ❌ Package loading hangs forever if CDN is down (no timeout)
- ❌ Initialization errors are lost (no try-catch)
- ❌ Unhandled errors crash the game silently
- ❌ No way to track errors in production
- ❌ Can't debug user-reported issues
- ❌ No breadcrumb trail to understand user journey
- ❌ Audio/feedback failures go unnoticed

**✅ Correct Approach:**

```html
<!-- ✅ CORRECT - Define Sentry init function FIRST -->
<script>
function initSentry() {
  Sentry.init({
    dsn: 'YOUR_SENTRY_DSN_HERE',
    environment: 'production',
    tracesSampleRate: 0.1
  });
  console.log('✅ Sentry initialized');
}
</script>

<!-- ✅ CORRECT - Load Sentry SDK with onload callback -->
<script
  src="https://browser.sentry-cdn.com/8.38.0/bundle.min.js"
  crossorigin="anonymous"
  onload="initSentry()"
  onerror="console.error('❌ Sentry SDK failed to load')"
></script>

<!-- Then load game packages -->
<script src=".../feedback-manager/index.js"></script>
<script src=".../components/index.js"></script>
<script src=".../helpers/index.js"></script>
```

```javascript
// ✅ CORRECT - With error tracking
async function waitForPackages() {
  const timeout = 10000; // 10 seconds
  const start = Date.now();

  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('✅ Packages loaded');
    Sentry.addBreadcrumb({
      category: 'package-loading',
      message: 'All packages loaded',
      level: 'info',
      data: { loadTime: Date.now() - start }
    });
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    Sentry.captureException(error, {
      tags: { phase: 'package-loading', severity: 'critical' },
      contexts: {
        packages: {
          feedbackManager: typeof FeedbackManager !== 'undefined'
        }
      }
    });
    throw error;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  Sentry.addBreadcrumb({
    category: 'initialization',
    message: 'DOMContentLoaded fired',
    level: 'info'
  });

  try {
    await waitForPackages();
    await FeedbackManager.init();
    Sentry.addBreadcrumb({
      category: 'initialization',
      message: 'FeedbackManager initialized',
      level: 'info'
    });
    setupGame();
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    Sentry.captureException(error, {
      tags: { phase: 'initialization', severity: 'critical' }
    });
    // Show user-friendly error
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to initialize game. Please refresh the page.</div>';
  }
});

// ✅ Global error handlers
window.addEventListener('error', (event) => {
  console.error('❌ Unhandled error:', event.error);
  Sentry.captureException(event.error, {
    tags: { errorType: 'unhandled', severity: 'critical' }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
  Sentry.captureException(event.reason, {
    tags: { errorType: 'unhandled-promise', severity: 'critical' }
  });
});

// ✅ Audio with error tracking
async function playFeedback(key, options) {
  try {
    await FeedbackManager.sound.play(key, options);
    console.log(`✅ Played feedback: ${key}`);
  } catch (error) {
    console.error(`❌ Feedback playback failed: ${key}`, error);
    Sentry.captureException(error, {
      tags: {
        phase: 'audio-playback',
        component: 'FeedbackManager',
        feedbackType: key,
        severity: 'medium'
      }
    });
    // Fallback: show subtitle only
    if (options.subtitle) {
      SubtitleComponent.show({ text: options.subtitle });
    }
  }
}
```

**Benefits:**
- ✅ All errors captured and tracked in Sentry dashboard
- ✅ Timeout prevents infinite hangs
- ✅ Breadcrumbs show user journey before error
- ✅ Tags and contexts provide debugging info
- ✅ Fallback behavior prevents broken UI
- ✅ User-friendly error messages
- ✅ Can debug production issues remotely

**Reference:** [reference/sentry-integration.md](../reference/sentry-integration.md)

---

## ❌ Anti-Pattern 1: Manual Timer Creation

**Problem:** Creating timers with setInterval/setTimeout bypasses TimerComponent features like pause/resume, proper cleanup, and formatting.

**Bad Code:**

```javascript
// ❌ WRONG - Manual timer implementation
let timeLeft = 60;
let timerInterval = null;

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = `Time: ${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
}

function resumeTimer() {
  startTimer(); // ❌ This resets the timer!
}
```

**Why This Fails:**

- ❌ No proper pause/resume - clearing interval loses state
- ❌ No formatted time display (MM:SS)
- ❌ Manual DOM manipulation causes re-render issues
- ❌ No built-in cleanup method
- ❌ Doesn't work with VisibilityTracker
- ❌ Can't get elapsed time easily
- ❌ Prone to memory leaks if not cleared properly

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Use TimerComponent
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'min',
  startTime: 60,
  endTime: 0,
  autoStart: true,
  onEnd: (timeTaken) => {
    console.log("⏰ Time is up!");
    endGame();
  }
});

// ✅ Proper pause/resume
function pauseTimer() {
  timer.pause();
}

function resumeTimer() {
  timer.resume();
}

// Record attempt when round ends
function recordAttempt() {
  const endTime = Date.now();
  const duration = timer.getCurrentTime() - roundStartTimerValue;
  const overallCorrectness = question.was_correct ? 1.0 : 0.0;

  attemptHistory.push({
    attempt_number: attemptNumber,
    start_timestamp: new Date(roundStartTime).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    duration: duration,
    overall_correctness: overallCorrectness,
    metadata: { /* complete metadata */ }
  });
}

// ✅ Proper cleanup - record attempt first, then calculate metrics
function endGame() {
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

  // Cleanup components
  if (timer) {
    window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
    timer.destroy();
  }
}

// ✅ Get current state
const currentTime = timer.getCurrentTime();
const elapsed = timer.getTimeTaken();
const formatted = timer.getFormattedTime();
```

---

## ❌ Anti-Pattern 2: Direct Audio Creation

**Problem:** Creating Audio objects directly bypasses FeedbackManager's queue system, streaming support, and subtitle synchronization.

**Bad Code:**

```javascript
// ❌ WRONG - Direct Audio creation
const correctAudio = new Audio('https://storage.googleapis.com/.../correct.mp3');
correctAudio.crossOrigin = 'anonymous';

function playCorrectSound() {
  correctAudio.play().catch(error => {
    console.error("Audio failed:", error);
  });

  // ❌ Manual subtitle management
  showSubtitle("Great job!");
  setTimeout(() => hideSubtitle(), 2000);
}

function showSubtitle(text) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  document.body.appendChild(div);
}
```

**Why This Fails:**

- ❌ Audio can overlap - no queue management
- ❌ Can't handle streaming audio
- ❌ Manual subtitle timing is error-prone
- ❌ No subtitle/audio synchronization
- ❌ Browser autoplay blocks not handled
- ❌ No preloading support
- ❌ Can't pause/resume properly
- ❌ Memory leaks from DOM elements

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Use FeedbackManager
window.onload = async () => {
  // Initialize FeedbackManager
  await FeedbackManager.init();

  // Preload audio
  await FeedbackManager.sound.preload([
    { id: 'correct', url: 'https://storage.googleapis.com/.../correct.mp3' }
  ]);
};

async function playCorrectSound() {
  // ✅ Play with subtitle in one call
  await FeedbackManager.sound.play('correct', {
    subtitle: '**Great job!** You got it right! ✨',
    sticker: {
      image: 'https://cdn.mathai.ai/mathai-assets/lottie/star-sparkle.json',
      loop: false,
      duration: 2,
      type: 'IMAGE_GIF'
    }
  });
  // Subtitle automatically hides when audio ends
}

// ✅ Proper pause/resume
function pauseGame() {
  FeedbackManager.sound.pause();
  FeedbackManager.stream.pauseAll();
}

function resumeGame() {
  FeedbackManager.sound.resume();
  FeedbackManager.stream.resumeAll();
}
```

---

## ❌ Anti-Pattern 2.5: Manual Dynamic Audio Management (DEPRECATED)

**Problem:** Manually managing dynamic audio with fetch/preload/play is error-prone and complex. The simplified `playDynamicFeedback()` method handles everything automatically.

**❌ DEPRECATED - Manual Management:**

```javascript
// ❌ OLD WAY - Too complex, error-prone
async function playDynamicFeedback(message) {
  const apiUrl = `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text=${encodeURIComponent(message)}`;
  const response = await fetch(apiUrl);
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    const { audio_url } = await response.json();
    const audioId = `dynamic-${Date.now()}`;
    await FeedbackManager.sound.preload([{ id: audioId, url: audio_url }]);
    await FeedbackManager.sound.play(audioId, { subtitle: message });
  } else {
    const streamId = `stream-${Date.now()}`;
    await FeedbackManager.stream.addFromResponse(streamId, response);
    FeedbackManager.stream.play(streamId, callbacks, { subtitle: message });
  }
}
```

**Why Manual Management Is Bad:**

- ❌ Too much boilerplate code
- ❌ Easy to make ID consistency errors
- ❌ Must manually check content-type
- ❌ Must manually handle cached vs streaming
- ❌ Must manually manage cleanup
- ❌ Error-prone and hard to maintain

**✅ CORRECT - Use Simplified Method:**

```javascript
// ✅ NEW WAY - Simple and automatic
async function playDynamicFeedback(message, stickerUrl = null) {
  await FeedbackManager.playDynamicFeedback({
    audio_content: message,
    subtitle: message,
    sticker: stickerUrl
  });
}

// That's it! Handles everything automatically:
// - Detects cached vs streaming
// - Manages IDs consistently
// - Auto-cleanup
// - Integrated subtitle/sticker display
```

**Key Takeaways:**

- ✅ **ALWAYS use `FeedbackManager.playDynamicFeedback()`** for dynamic audio
- ❌ **NEVER manually fetch/preload/play** - it's deprecated and error-prone
- ✅ Let the framework handle complexity for you
- ✅ Never call `Date.now()` twice for the same audio
- ✅ Test dynamic audio to verify it actually plays
- ✅ Check browser console for "Audio not found" warnings

---

## ❌ Anti-Pattern 3: Separate Component Loading

**Problem:** Loading SubtitleComponent separately causes conflicts and duplicate initialization.

**Bad Code:**

```html
<!-- ❌ WRONG - Loading SubtitleComponent separately -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<script>
  // ❌ WRONG - Using SubtitleComponent directly
  function showFeedback(text) {
    SubtitleComponent.show({
      text: text,
      duration: 3
    });
  }

  // ❌ WRONG - Audio and subtitles are not synchronized
  async function playCorrect() {
    await FeedbackManager.sound.play('correct');
    SubtitleComponent.show({ text: "Great!", duration: 2 });
  }
</script>
```

**Why This Fails:**

- ❌ SubtitleComponent loaded twice (in components + FeedbackManager)
- ❌ Subtitle timing not synchronized with audio
- ❌ Manual duration management required
- ❌ No auto-hide when audio is preempted
- ❌ Increased bundle size
- ❌ Potential conflicts between instances

**✅ Correct Approach:**

```html
<!-- ✅ CORRECT - FeedbackManager includes SubtitleComponent -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<script>
  window.onload = async () => {
    // ✅ Initialize FeedbackManager (loads subtitle component internally)
    await FeedbackManager.init();
  };

  // ✅ CORRECT - Subtitle passed as prop with audio
  async function playCorrect() {
    await FeedbackManager.sound.play('correct', {
      subtitle: '**Great job!** You got it right! ✨'
    });
    // Subtitle automatically synchronized with audio duration
    // Subtitle automatically hides when audio ends
  }
</script>
```

---

## ❌ Anti-Pattern 4: Missing VisibilityTracker

**Problem:** Not implementing VisibilityTracker allows users to cheat by switching tabs, and doesn't pause activities properly.

**Bad Code:**

```javascript
// ❌ WRONG - No VisibilityTracker
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0,
  autoStart: true
});

// ❌ Timer keeps running when user switches tabs
// ❌ Audio keeps playing when user is not present
// ❌ No way to pause game when user leaves

function startGame() {
  timer.start();
  playBackgroundMusic();
}
```

**Why This Fails:**

- ❌ Timer continues when user switches tabs (unfair)
- ❌ Audio plays when user isn't present (bad UX)
- ❌ No automatic pause functionality
- ❌ Users can cheat by leaving tab open
- ❌ Battery waste on inactive tabs
- ❌ No resume prompt when user returns

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Implement VisibilityTracker
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0,
  autoStart: true
});

// ✅ MANDATORY: Setup VisibilityTracker
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    console.log("⏸️  User went inactive - pausing");

    // ✅ Pause timer
    if (timer) {
      timer.pause();
    }

    // ✅ Pause regular audio
    FeedbackManager.sound.pause();

    // ✅ Pause streaming audio
    FeedbackManager.stream.pauseAll();

    // ✅ Pause any other activities
    pauseBackgroundMusic();
  },
  onResume: () => {
    console.log("▶️  User resumed - resuming");

    // ✅ Resume timer
    if (timer && timer.isPaused) {
      timer.resume();
    }

    // ✅ Resume regular audio
    FeedbackManager.sound.resume();

    // ✅ Resume streaming audio
    FeedbackManager.stream.resumeAll();

    // ✅ Resume other activities
    resumeBackgroundMusic();
  },
  popupProps: {
    title: "Game Paused",
    description: "Your game has been paused. Click Resume to continue.",
    primaryText: "Resume Game"
  }
});

// Record attempt when round ends
function recordAttempt() {
  const endTime = Date.now();
  const duration = timer.getCurrentTime() - roundStartTimerValue;

  attemptHistory.push({
    attempt_number: attemptNumber,
    start_timestamp: new Date(roundStartTime).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    duration: duration,
    overall_correctness: overallCorrectness,
    metadata: { /* complete metadata */ }
  });
}

// ✅ Cleanup when game ends - record attempt first
function endGame() {
  // Record the completed attempt
  recordAttempt();

  // Calculate metrics only
  const metrics = {
    time: window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0),
    accuracy: calculateAccuracy(),
    stars: calculateStars(),
    retries: attemptNumber - 1,
    timeBreakdown: window.gameVariableState.timerElapsedTimes
  };

  // Submit with accumulated attemptHistory
  submitGame(attemptHistory);

  // Cleanup components
  if (timer) {
    window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
    timer.destroy();
  }
  visibilityTracker.destroy();
}
```

---

## ❌ Anti-Pattern 5: Skipping FeedbackManager Initialization

**Problem:** Using FeedbackManager without calling init() first causes initialization errors.

**Bad Code:**

```javascript
// ❌ WRONG - No initialization
window.onload = async () => {
  // ❌ Skipped FeedbackManager.init()

  // Try to preload audio
  await FeedbackManager.sound.preload([
    { id: 'tap', url: 'https://...' }
  ]);
  // ❌ ERROR: FeedbackManager not initialized!
};

button.onclick = async () => {
  // ❌ Try to play audio
  await FeedbackManager.sound.play('tap');
  // ❌ ERROR: FeedbackManager not initialized!
};
```

**Why This Fails:**

- ❌ FeedbackManager components not loaded
- ❌ Audio streaming decoder not initialized
- ❌ Subtitle component not available
- ❌ Sticker component not available
- ❌ Throws errors when trying to use features

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Always initialize first
window.onload = async () => {
  console.log("🎮 Game initializing...");

  // ✅ MANDATORY: Initialize FeedbackManager FIRST
  await FeedbackManager.init();
  console.log("✅ FeedbackManager initialized");

  // ✅ Now safe to preload audio
  await FeedbackManager.sound.preload([
    { id: 'tap', url: 'https://storage.googleapis.com/.../tap.mp3' }
  ]);
  console.log("✅ Audio preloaded");

  // ✅ Setup game
  setupGame();
};

button.onclick = async () => {
  // ✅ Now safe to play audio
  await FeedbackManager.sound.play('tap', {
    subtitle: 'Button clicked'
  });
};
```

---

## ❌ Anti-Pattern 6: Missing Error Handling

**Problem:** Not handling errors properly makes debugging impossible and causes silent failures.

**Bad Code:**

```javascript
// ❌ WRONG - No error handling
async function playFeedback(key) {
  await FeedbackManager.sound.play(key);
  // ❌ If this fails, no way to know why
}

async function preloadAudio() {
  const audioList = [...];
  await FeedbackManager.sound.preload(audioList);
  // ❌ If preload fails, game continues with broken audio
}

async function generateDynamicAudio(text) {
  const response = await fetch(apiUrl);
  const data = await response.json();
  await FeedbackManager.sound.play('dynamic');
  // ❌ Multiple failure points, no error handling
}
```

**Why This Fails:**

- ❌ Silent failures - no error messages
- ❌ Can't debug issues
- ❌ Game continues in broken state
- ❌ User doesn't know what went wrong
- ❌ No fallback behavior

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Comprehensive error handling
async function playFeedback(key) {
  try {
    await FeedbackManager.sound.play(key, {
      subtitle: 'Playing audio...'
    });
    console.log(`✅ Played feedback: ${key}`);
  } catch (error) {
    console.error(`❌ Feedback failed: ${key}`, JSON.stringify({
      error: error.message,
      name: error.name,
      stack: error.stack
    }, null, 2));
  }
}

async function preloadAudio() {
  console.log("🔄 Preloading audio assets...");

  try {
    const audioList = Object.entries(feedbackAssets).map(([id, url]) => ({
      id,
      url
    }));

    await FeedbackManager.sound.preload(audioList);
    console.log("✅ All audio preloaded:", JSON.stringify(audioList, null, 2));
  } catch (error) {
    console.error("❌ Audio preload failed:", JSON.stringify({
      error: error.message,
      name: error.name
    }, null, 2));

    // ✅ Fallback: Try to continue without audio
    alert("Audio failed to load. Continuing without sound.");
  }
}

async function generateDynamicAudio(text) {
  console.log("🔄 Generating dynamic audio:", text);

  try {
    // ✅ Use simplified method
    await FeedbackManager.playDynamicFeedback({
      audio_content: text,
      subtitle: text
    });

    console.log("✅ Dynamic audio played successfully");
  } catch (error) {
    console.error("❌ Dynamic audio generation failed:", JSON.stringify({
      error: error.message,
      name: error.name,
      text: text
    }, null, 2));

    // ✅ Fallback: Show subtitle only (manual - rare case)
    alert(`Audio failed: ${text}`);
  }
}
```

---

## ❌ Anti-Pattern 7: Missing Cleanup Methods

**Problem:** Not cleaning up components causes memory leaks and prevents proper reinitialization.

**Bad Code:**

```javascript
// ❌ WRONG - No cleanup
function startGame() {
  timer = new TimerComponent('timer-container', {
    timerType: 'decrease',
    startTime: 60
  });

  visibilityTracker = new VisibilityTracker({
    onInactive: () => { /* ... */ }
  });
}

function endGame() {
  // ❌ Just reset variables, no cleanup
  timer = null;
  visibilityTracker = null;

  // ❌ Components still running in background!
  // ❌ Event listeners still attached!
  // ❌ Memory leaks!
}

function restartGame() {
  // ❌ Creating new components without destroying old ones
  startGame();
}
```

**Why This Fails:**

- ❌ Memory leaks from undestroyed components
- ❌ Event listeners remain attached
- ❌ Timers continue running in background
- ❌ Can't restart game properly
- ❌ Multiple instances conflict with each other
- ❌ DOM elements not removed

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Proper cleanup
function startGame() {
  console.log("🎮 Starting game...");

  timer = new TimerComponent('timer-container', {
    timerType: 'decrease',
    startTime: 60,
    endTime: 0,
    autoStart: true
  });

  visibilityTracker = new VisibilityTracker({
    onInactive: () => {
      if (timer) timer.pause();
      FeedbackManager.sound.pause();
      FeedbackManager.stream.pauseAll();
    },
    onResume: () => {
      if (timer && timer.isPaused) timer.resume();
      FeedbackManager.sound.resume();
      FeedbackManager.stream.resumeAll();
    }
  });

  console.log("✅ Game started");
}

// Record attempt when round ends
function recordAttempt() {
  const endTime = Date.now();
  const duration = timer.getCurrentTime() - roundStartTimerValue;
  const overallCorrectness = question.was_correct ? 1.0 : 0.0;

  attemptHistory.push({
    attempt_number: attemptNumber,
    start_timestamp: new Date(roundStartTime).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    duration: duration,
    overall_correctness: overallCorrectness,
    metadata: { /* complete metadata */ }
  });
}

function endGame() {
  console.log("🏁 Ending game...");

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

  // ✅ Proper cleanup of timer
  if (timer) {
    window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
    timer.destroy();
    timer = null;
    console.log("✅ Timer destroyed");
  }

  // ✅ Proper cleanup of visibility tracker
  if (visibilityTracker) {
    visibilityTracker.destroy();
    visibilityTracker = null;
    console.log("✅ VisibilityTracker destroyed");
  }

  // ✅ Stop all audio
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();

  console.log("✅ Game ended and cleaned up");
}

function restartGame() {
  console.log("🔄 Restarting game...");

  // ✅ Clean up first
  endGame();

  // ✅ Wait a moment for cleanup to complete
  setTimeout(() => {
    startGame();
  }, 100);
}
```

---

## ❌ Anti-Pattern 8: Poor Logging Practices

**Problem:** Not using JSON.stringify makes debugging impossible and logs are unreadable.

**Bad Code:**

```javascript
// ❌ WRONG - Poor logging
function trackAttempt(attempt) {
  console.log("Attempt:", attempt);
  // Output: Attempt: [object Object]
  // ❌ Can't see what's inside!
}

function debugGame() {
  console.log("Game state:", gameState);
  // Output: Game state: [object Object]
  // ❌ Useless for debugging!
}

function submitResults(results) {
  console.log("Submitting:", results);
  // ❌ Can't verify data structure

  window.parent.postMessage({
    type: 'game_complete',
    data: results
  }, '*');
}
```

**Why This Fails:**

- ❌ Objects show as "[object Object]"
- ❌ Can't inspect nested data
- ❌ Impossible to debug issues
- ❌ Can't verify data structure
- ❌ Can't copy/paste for testing

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Proper logging with JSON.stringify
function trackAttempt(attempt) {
  console.log("✅ Attempt tracked:", JSON.stringify(attempt, null, 2));
  // Output: Full object with proper indentation
  /*
  ✅ Attempt tracked: {
    "questionNumber": 1,
    "question": "5 × 3 = ?",
    "userAnswer": 15,
    "correctAnswer": 15,
    "correct": true,
    "validationType": "fixed",
    "timestamp": 1699027200000,
    "responseTime": 3500
  }
  */
}

function debugGame() {
  console.log("🎮 Game State:", JSON.stringify({
    currentQuestion: currentQuestionIndex,
    score: score,
    attempts: attempts.length,
    events: events.length,
    timerRunning: timer?.isPaused === false
  }, null, 2));
  // ✅ Clear, readable, can copy/paste
}

function submitResults(results) {
  console.log("📊 Results (camelCase):", JSON.stringify(results, null, 2));

  const resultsSnakeCase = toSnakeCase(results);
  console.log("📊 Results (snake_case for backend):", JSON.stringify(resultsSnakeCase, null, 2));

  window.parent.postMessage({
    type: 'game_complete',
    data: resultsSnakeCase
  }, '*');

  console.log("✅ Results submitted");
}

// ✅ Debug function with comprehensive logging
window.debugGame = function() {
  console.log("🔍 Complete Game Debug Info:", JSON.stringify({
    gameConfig: {
      gameId: gameConfig?.gameId,
      sessionId: gameConfig?.sessionId
    },
    gameState: {
      currentQuestion: currentQuestionIndex + 1,
      totalQuestions: gameConfig?.content?.questions?.length,
      score: score
    },
    tracking: {
      totalAttempts: attempts.length,
      totalEvents: events.length
    },
    components: {
      timerExists: timer !== null,
      timerPaused: timer?.isPaused,
      trackerExists: visibilityTracker !== null
    }
  }, null, 2));
};
```

---

## ❌ Anti-Pattern 9: Missing Debug Functions

**Problem:** No debug functions makes testing and troubleshooting impossible.

**Bad Code:**

```javascript
// ❌ WRONG - No debug functions
const feedbackAssets = {
  tap: "https://...",
  correct: "https://..."
};

// ❌ No way to test audio
// ❌ No way to verify URLs
// ❌ No way to check game state
// ❌ No way to test individual features

// When something breaks, you can't figure out why!
```

**Why This Fails:**

- ❌ Can't test audio playback
- ❌ Can't verify URL accessibility
- ❌ Can't inspect game state
- ❌ Can't test individual components
- ❌ Debugging takes hours instead of minutes

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Comprehensive debug functions
const feedbackAssets = {
  tap: "https://storage.googleapis.com/.../tap.mp3",
  correct: "https://storage.googleapis.com/.../correct.mp3",
  incorrect: "https://storage.googleapis.com/.../incorrect.mp3"
};

// ✅ Test individual audio
window.testAudio = async function(feedbackType = 'tap') {
  console.log('🧪 Testing audio:', feedbackType);

  if (feedbackAssets[feedbackType]) {
    await FeedbackManager.sound.play(feedbackType);
    console.log('✅ Playing:', feedbackType);
  } else {
    console.error('❌ Unknown feedback type');
    console.log('Available types:', Object.keys(feedbackAssets));
  }
};

// ✅ Test URL accessibility
window.testAudioUrls = async function() {
  console.log('🔍 Testing URL accessibility...');
  const results = [];

  for (const [name, url] of Object.entries(feedbackAssets)) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      results.push({
        name,
        url,
        status: response.status,
        ok: response.ok
      });
    } catch (error) {
      results.push({
        name,
        url,
        error: error.message
      });
    }
  }

  console.log('📊 URL Test Results:', JSON.stringify(results, null, 2));
};

// ✅ Debug FeedbackManager state
window.debugAudio = function() {
  const soundState = FeedbackManager.sound.getState();
  const streamState = FeedbackManager.stream.getState();
  console.log('🎵 FeedbackManager State:', JSON.stringify({
    sound: soundState,
    stream: streamState
  }, null, 2));
};

// ✅ Debug game state
window.debugGame = function() {
  console.log('🎮 Game State:', JSON.stringify({
    gameId: gameConfig?.gameId,
    sessionId: gameConfig?.sessionId,
    currentQuestion: currentQuestionIndex,
    score: score,
    attempts: attempts.length,
    events: events.length,
    timerState: timer ? {
      currentTime: timer.getCurrentTime(),
      isPaused: timer.isPaused
    } : null
  }, null, 2));
};

// ✅ Test pause/resume
window.testPause = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerInactive();
    console.log("🧪 Manually triggered pause");
  }
};

window.testResume = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerResume();
    console.log("🧪 Manually triggered resume");
  }
};

// ✅ Test dynamic audio
window.testDynamicAudio = async function(text = "Test message") {
  console.log("🧪 Testing dynamic audio:", text);
  await generateDynamicFeedback(text);
};
```

---

## ❌ Anti-Pattern 10: Using Absolute Paths

**Problem:** Using absolute paths breaks portability and makes code environment-specific.

**Bad Code:**

```javascript
// ❌ WRONG - Absolute paths
Write({
  file_path: "/Users/username/Documents/claude/game-123/index.html",
  content: htmlContent
});

Read({
  file_path: "/Users/username/Documents/claude/game-123/metadata.json"
});

// ❌ Also wrong - Desktop-specific patterns
const gamePath = `${allowedDirs[0]}/game-123/index.html`;
```

**Why This Fails:**

- ❌ Breaks when directory structure changes
- ❌ Not portable across different environments
- ❌ Hardcoded paths are brittle
- ❌ Won't work for other users
- ❌ Fails in CI/CD environments
- ❌ Difficult to maintain

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Relative paths (Claude Code working directory)
Write({
  file_path: "games/game-123/index.html",
  content: htmlContent
});

Read({
  file_path: "games/game-123/metadata.json"
});

// ✅ Create directory structure
Bash({
  command: "mkdir -p games/game-123/checklists"
});

// ✅ EXCEPTION: MCP tools require absolute paths
// Resolve using pwd for MCP tools
Bash({
  command: "GAME_DIR=$(pwd)/games/game-123 && echo $GAME_DIR"
});

// Then use in MCP call:
mathai-core:upload_game_folder({
  gameId: "game-123",
  files: [
    {
      filePath: "${GAME_DIR}/index.html", // Absolute path for MCP
      targetPath: "index.html"
    }
  ]
});
```

---

## ❌ Anti-Pattern 11: Incorrect postMessage Content Access

**Problem:** Accessing `event.data.content` directly without checking the nested structure causes games to silently fail to load platform-sent content, always falling back to hardcoded defaults.

**Bad Code:**

```javascript
// ❌ WRONG - Single access path, no fallbacks
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'game_init') {
    const content = event.data.content;  // Misses platform format!
    setupGame(content);
  }
});

// ❌ Also wrong - Only checking nested path
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'game_init') {
    const content = event.data.data.content;  // No fallback!
    setupGame(content);
  }
});
```

**Why This Fails:**

- ❌ Platform sends `event.data.data.content` (nested structure)
- ❌ First example expects `event.data.content` (flat structure)
- ❌ Second example has no fallback for legacy format
- ❌ Game always falls back to FALLBACK_CONTENT
- ❌ Content sets from platform never load
- ❌ No error thrown - **silent failure**
- ❌ Game appears to work but uses wrong content
- ❌ Teachers can't customize difficulty
- ❌ Wastes content set creation effort

**Real-World Impact:**

```javascript
// Platform sends this structure:
{
  "type": "game_init",
  "data": {
    "gameId": "game_123",
    "content": {
      "questions": [...],  // 5 questions, 90 seconds
      "timerStart": 90,
      "lives": 2
    }
  }
}

// Game extracts: event.data.content = undefined
// Game falls back to: FALLBACK_CONTENT = { questions: [...10 questions...], timerStart: 60 }
// Result: Wrong content loaded, no error!
```

**✅ Correct Approach:**

```javascript
// ✅ CORRECT - Safe extraction with proper fallbacks
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'game_init') {
    console.log('📨 Received game_init:', JSON.stringify(event.data, null, 2));
    contentReceived = true;

    // Support all formats with fallback chain:
    // 1. Platform format: event.data.data.content
    // 2. Legacy format: event.data.content
    // 3. Local testing: FALLBACK_CONTENT
    const content = event.data.data?.content || event.data.content || FALLBACK_CONTENT;

    setupGame(content);
  }
});
```

**Why This Works:**

- ✅ Handles current platform format (`event.data.data.content`)
- ✅ Handles legacy format (`event.data.content`)
- ✅ Falls back to local testing content (`FALLBACK_CONTENT`)
- ✅ Uses optional chaining (`?.`) for safety
- ✅ Logs full structure for debugging
- ✅ Never silently fails

**Debug Function:**

Add this to your game for troubleshooting:

```javascript
// Debug function to test postMessage structure
window.debugPostMessage = function() {
  console.log('🔍 Listening for postMessage...');

  window.addEventListener('message', (event) => {
    console.group('📨 postMessage Received');
    console.log('Raw event.data:', JSON.stringify(event.data, null, 2));
    console.log('event.data.data:', JSON.stringify(event.data.data, null, 2));
    console.log('event.data.data?.content:', event.data.data?.content);
    console.log('event.data.content:', event.data.content);
    console.log('Extracted content:', event.data.data?.content || event.data.content);
    console.groupEnd();
  });

  console.log('✅ Debug listener attached. Send a postMessage to test.');
};

// Test in console: window.debugPostMessage()
```

**Testing Checklist:**

```
[ ] Game loads with platform-sent content sets
[ ] Content matches what was created (not fallback)
[ ] Timer starts with correct duration from content set
[ ] Questions match content set (count and values)
[ ] Console shows "Received game_init" with full structure
[ ] No "Content timeout - using fallback" message
```

**Common Mistakes:**

1. **Only testing locally** - Local testing uses FALLBACK_CONTENT, hiding the bug
2. **Not logging the structure** - Can't see what's actually received
3. **Assuming flat structure** - Platform uses nested format
4. **No fallback chain** - Single point of failure
5. **Ignoring console warnings** - Silent failures go unnoticed

---

## Summary of Anti-Patterns

**Never do these:**

1. ❌ Create timers with setInterval/setTimeout
2. ❌ Create Audio objects directly with `new Audio()`
3. ❌ Load SubtitleComponent separately
4. ❌ Use SubtitleComponent.show() directly
5. ❌ Skip VisibilityTracker integration
6. ❌ Skip FeedbackManager.init()
7. ❌ Skip error handling
8. ❌ Skip cleanup methods
9. ❌ Log objects without JSON.stringify
10. ❌ Skip debug functions
11. ❌ Use absolute paths (use relative paths instead)
12. ❌ Access postMessage content without fallback chain

**Always do these:**

1. ✅ Use TimerComponent for all timers
2. ✅ Use FeedbackManager for all audio
3. ✅ Let FeedbackManager load SubtitleComponent
4. ✅ Pass subtitles as props with audio
5. ✅ Implement VisibilityTracker for pause/resume
6. ✅ Call FeedbackManager.init() first
7. ✅ Wrap everything in try/catch
8. ✅ Call destroy() on all components
9. ✅ Use JSON.stringify(data, null, 2) for logs
10. ✅ Include comprehensive debug functions
11. ✅ Use relative paths (games/{gameId}/...)
12. ✅ Use safe content extraction: `event.data.data?.content || event.data.content || FALLBACK`

**Quick Reference:**

| Feature | ❌ Wrong | ✅ Correct |
|---------|----------|-----------|
| Timer | `setInterval()` | `new TimerComponent()` |
| Audio | `new Audio()` | `FeedbackManager.sound.play()` |
| Subtitles | `SubtitleComponent.show()` | `FeedbackManager.sound.play(id, { subtitle })` |
| Pause/Resume | Manual implementation | `new VisibilityTracker()` |
| Initialization | Skip init | `await FeedbackManager.init()` |
| Errors | No try/catch | `try/catch` with detailed logging |
| Cleanup | Skip destroy | Call `.destroy()` on all components |
| Logging | `console.log(obj)` | `console.log(JSON.stringify(obj, null, 2))` |
| Debug | No debug functions | Include test*/debug* functions |
| Paths | Absolute paths | Relative paths: `games/{gameId}/...` |
| postMessage | `event.data.content` | `event.data.data?.content \|\| event.data.content \|\| FALLBACK` |

## Anti-Pattern: Component Before Container (DOM Timing Error)

### Problem: TimerComponent Created Before HTML Container Exists

**❌ WRONG:**

```javascript
function startRound() {
  // Destroy old timer
  if (timer) {
    timer.destroy();
  }

  // ❌ ERROR: #timer-container doesn't exist in DOM yet
  timer = new TimerComponent("timer-container", {
    timerType: "decrease",
    startTime: 20,
    endTime: 0,
    autoStart: true,
    onEnd: handleTimeout
  });

  // Container created too late
  renderGame(); // document.getElementById('gameContent').innerHTML = `<div id="timer-container">...`
}
```

**Error Message:**
```
Uncaught Error: Cannot find element with id 'timer-container'
```

**Why It Fails:**
- `new TimerComponent()` tries to find #timer-container in DOM
- Container doesn't exist yet (created later in renderGame())
- Component initialization fails
- Game stops working

**✅ CORRECT:**

```javascript
function startRound() {
  // Step 1: Create HTML container FIRST
  renderGame(); // Creates #timer-container in DOM

  // Step 2: Destroy old timer (if exists)
  if (timer) {
    timer.destroy();
  }

  // Step 3: Create new TimerComponent (container now exists)
  timer = new TimerComponent("timer-container", {
    timerType: "decrease",
    startTime: 20,
    endTime: 0,
    autoStart: true,
    onEnd: handleTimeout
  });
}

function renderGame() {
  document.getElementById('gameContent').innerHTML = `
    <div class="game-container">
      <div id="timer-container"></div>
      <!-- other game elements -->
    </div>
  `;
}
```

**Why It Works:**
- `renderGame()` creates #timer-container in DOM
- Container now exists before component initialization
- `new TimerComponent()` finds the container successfully
- Timer displays and functions correctly

**General Rule:**
DOM-First, Component-Second: Always render HTML elements BEFORE creating JavaScript components that target those elements.

**Applies To:**
- TimerComponent (needs #timer-container)
- Any component that targets a specific DOM element by ID
- Custom components that manipulate the DOM

**Verification Checklist:**
- DOM element created BEFORE component initialization
- If using innerHTML, component created AFTER assignment
- Order: renderDOM() → new Component()
- No "Cannot find element" errors in console
