# Quick Reference Card

**NOTE:** This reference shows Claude Code patterns (Read, Write, Edit, Bash). See CLAUDE.md for full context.

## 🎯 Pattern Selection (30 Second Guide)

| What You Need | Use This | Lines | Time |
|---------------|----------|-------|------|
| **Receive runtime content** | Pattern 0 | ~80 | 3 min |
| **Just audio feedback** | Pattern 1 | ~100 | 5 min |
| **Timer that pauses** | Pattern 2 | ~150 | 10 min |
| **Dynamic completion audio** | Pattern 3 | ~100 | 5 min |
| **Track and submit results** | Pattern 4 | ~150 | 10 min |
| **Complete working game** | Pattern 5 | ~350 | 15 min |
| **Raw signal capture** | Pattern 6 | ~30 | 3 min |

## ✅ Mandatory Checklist (Copy/Paste for Code Review)

```
[ ] postMessage listener for 'game_init' (receives runtime content)
[ ] postMessage uses safe content extraction (event.data.data?.content || event.data.content || FALLBACK)
[ ] Sends 'game_ready' signal after packages load
[ ] Fallback content defined for local testing
[ ] waitForContent() with 3-second timeout
[ ] Extracts ALL config variables (not just questions)
[ ] FeedbackManager.init() called in window.onload
[ ] All packages loaded (FeedbackManager, Components, Helpers)
[ ] Audio preloaded before use
[ ] Subtitles passed as props (not SubtitleComponent.show())
[ ] Timer uses TimerComponent (not setInterval)
[ ] VisibilityTracker created with callbacks
[ ] onInactive pauses timer + audio
[ ] onResume resumes timer + audio
[ ] All async wrapped in try/catch with detailed logging
[ ] All logs use JSON.stringify(data, null, 2)
[ ] destroy() called on cleanup
[ ] Debug functions included
[ ] Sentry added in Phase 5 (not Phases 1-4)
```

## 🚫 Anti-Pattern Quick Check

```javascript
// ❌ If you see ANY of these, it's WRONG:

Hardcoded questions              // Use runtime content from postMessage
No game_ready signal             // Must notify platform when ready
No postMessage listener          // Must listen for game_init
Only questions in content        // Must include ALL config variables
new Audio()                      // Use FeedbackManager.sound.play()
setInterval()                    // Use new TimerComponent()
SubtitleComponent.show()         // Pass subtitle as prop with audio
Missing FeedbackManager.init()   // Call in window.onload
No try/catch                     // Wrap all async operations
console.log(object)              // Use JSON.stringify(object, null, 2)
No destroy() calls               // Memory leaks!
No debug functions               // Can't test or debug
Sentry in Phase 1-4              // Sentry added in Phase 5 only
```

## 📦 Required Packages (HTML)

```html
<!-- ✅ ALWAYS LOAD THESE (order matters - CRITICAL): -->

<!-- 1. FeedbackManager (MANDATORY - loads SubtitleComponent automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components (for TimerComponent, PopupComponent) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers (MANDATORY for VisibilityTracker) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

<!-- 4. Analytics Config (optional - load before Analytics) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/config.js"></script>

<!-- 5. Analytics Package (optional - reads config) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**Note:** Error tracking (Sentry) is added in Phase 5, not during development (Phases 1-4).

## 🎮 Minimal Complete Game (Copy/Paste)

```html
<!DOCTYPE html>
<html>
<head>
  <!-- CRITICAL: Load in this exact order -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
</head>
<body>
  <div id="timer-container"></div>
  <button onclick="handleClick()">Click Me</button>

  <script>
    let timer = null;
    let tracker = null;

    // ✅ CRITICAL: Wait for ALL packages to load before initializing
    async function waitForPackages() {
      const timeout = 10000;
      const start = Date.now();
      try {
        while (typeof FeedbackManager === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package timeout: FeedbackManager');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof TimerComponent === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package timeout: TimerComponent');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof VisibilityTracker === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package timeout: VisibilityTracker');
          await new Promise(r => setTimeout(r, 50));
        }
        // Wait for Analytics if using tracking (optional)
        while (typeof AnalyticsConfig === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package timeout: AnalyticsConfig');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof AnalyticsManager === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package timeout: AnalyticsManager');
          await new Promise(r => setTimeout(r, 50));
        }
        console.log('✅ All packages loaded');
        Sentry.addBreadcrumb({ category: 'package-loading', message: 'Packages loaded', level: 'info' });
      } catch (error) {
        console.error('❌ Package loading failed:', error);
        Sentry.captureException(error, { tags: { phase: 'package-loading', severity: 'critical' } });
        throw error;
      }
    }

    window.addEventListener('DOMContentLoaded', async () => {
      Sentry.addBreadcrumb({ category: 'initialization', message: 'DOMContentLoaded', level: 'info' });
      try {
        await waitForPackages();
        await FeedbackManager.init();
        await FeedbackManager.sound.preload([
          { id: 'tap', url: 'https://storage.googleapis.com/.../tap.mp3' }
        ]);

        // ✅ Initialize analytics (optional)
        const analytics = new AnalyticsManager();
        await analytics.init();
        analytics.track('page_opened', { page: 'game' });

        // Create timer
        timer = new TimerComponent('timer-container', {
          timerType: 'decrease',
          startTime: 60,
          endTime: 0,
          autoStart: true
        });
        window.timer = timer;  // Store globally for debugging and external access

      // ✅ MANDATORY: VisibilityTracker
      tracker = new VisibilityTracker({
        onInactive: () => {
          if (timer) timer.pause({ fromVisibilityTracker: true });
          FeedbackManager.sound.pause();
          FeedbackManager.stream.pauseAll();
        },
        onResume: () => {
          if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true });
          FeedbackManager.sound.resume();
          FeedbackManager.stream.resumeAll();
        }
      });
    });

    // ✅ With error handling
    async function handleClick() {
      try {
        await FeedbackManager.sound.play('tap', {
          subtitle: 'Button clicked!'
        });
      } catch (error) {
        console.error("Failed:", JSON.stringify(error, null, 2));
      }
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

    // ✅ Cleanup - only calculates metrics
    function endGame() {
      // Record attempt when round ends
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
    }
  </script>
</body>
</html>
```

## 🎯 Pattern 0: Receive Runtime Content (3 minutes)

**Use when:** Game should receive questions/config from platform (ALL games)

```javascript
// Define fallback content for local testing
const FALLBACK_CONTENT = {
  totalQuestions: 5,
  retryAllowed: true,
  timerType: "increase",
  startTime: 0,
  starThresholds: { 3: 100, 2: 70, 1: 50 },
  questions: [
    { operand1: 2, operand2: 3, answer: 6 },
    { operand1: 3, operand2: 4, answer: 12 },
    // ... more questions
  ]
};

let gameContent = null;

// Listen for runtime content from platform
window.addEventListener('message', (event) => {
  if (event.data.type === 'game_init') {
    console.log('📨 Received content:', event.data.data);
    gameContent = event.data.data.content;
  }
});

// Wait for content with 3-second timeout
async function waitForContent() {
  const timeout = 3000;
  const start = Date.now();

  while (!gameContent) {
    if (Date.now() - start > timeout) {
      console.warn('⚠️ Using fallback content for local testing');
      gameContent = FALLBACK_CONTENT;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return gameContent;
}

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Signal platform game is ready
  window.parent.postMessage({ type: 'game_ready' }, '*');

  // Wait for content, then start
  const content = await waitForContent();

  // Extract config and questions
  const {
    totalQuestions,
    retryAllowed,
    timerType,
    startTime,
    starThresholds,
    questions
  } = content;

  // Initialize game with runtime config
  gameState = {
    questions: questions,
    totalQuestions: totalQuestions || questions.length,
    retryAllowed: retryAllowed !== undefined ? retryAllowed : true,
    starThresholds: starThresholds || { 3: 100, 2: 70, 1: 50 }
  };

  startGame();
});
```

**Key Points:**
- ✅ Sends `game_ready` to notify platform
- ✅ Listens for `game_init` with content
- ✅ Falls back to hardcoded data after 3s timeout
- ✅ Extracts ALL config variables (not just questions)
- ✅ Works locally AND on platform

## 🔧 Debug Functions (Copy/Paste)

```javascript
// ✅ Add these to every game:

window.testAudio = async function(type = 'tap') {
  console.log('🧪 Testing:', type);
  await FeedbackManager.sound.play(type);
};

window.testAudioUrls = async function() {
  console.log('🔍 Testing URLs...');
  for (const [name, url] of Object.entries(feedbackAssets)) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      console.log(`✅ ${name}: ${r.status}`);
    } catch (e) {
      console.error(`❌ ${name}: ${e.message}`);
    }
  }
};

window.debugAudio = function() {
  console.log('🎵 Audio State:', JSON.stringify({
    sound: FeedbackManager.sound.getState(),
    stream: FeedbackManager.stream.getState()
  }, null, 2));
};

window.debugGame = function() {
  console.log('🎮 Game State:', JSON.stringify({
    /* your game state here */
  }, null, 2));
};
```

## 📝 Common Tasks (30 Second Snippets)

### Play Audio with Subtitle
```javascript
await FeedbackManager.sound.play('correct', {
  subtitle: '**Great!** You got it right! ✨'
});
```

### Play Audio with Sticker
```javascript
await FeedbackManager.sound.play('correct', {
  subtitle: 'Correct!',
  sticker: {
    image: 'https://cdn.mathai.ai/mathai-assets/lottie/star-sparkle.json',
    loop: false,
    duration: 2,
    type: 'IMAGE_GIF'
  }
});
```

### Create Timer
```javascript
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  startTime: 60,
  endTime: 0,
  autoStart: true,
  onEnd: () => endGame()
});
window.timer = timer;  // Store globally for debugging
```

### Pause/Resume Timer
```javascript
timer.pause();
timer.resume();
```

### Get Timer State
```javascript
const current = timer.getCurrentTime();
const elapsed = timer.getTimeTaken();
const formatted = timer.getFormattedTime();
```

### Dynamic Audio (Completion)
```javascript
// ✅ RECOMMENDED: Use simplified method
const text = `You scored ${score}% in ${time} seconds!`;
await FeedbackManager.playDynamicFeedback({
  audio_content: text,
  subtitle: text,
  sticker: "https://cdn.mathai.com/stickers/trophy.json" // Optional
});
```

### Track Attempt
```javascript
attempts.push({
  questionNumber: currentQuestion,
  question: "5 × 3 = ?",
  userAnswer: 15,
  correctAnswer: 15,
  correct: true,
  validationType: 'fixed',
  timestamp: Date.now(),
  responseTime: 3500
});

// Also track with analytics
analytics.track('question_answered', {
  correct: true,
  time: 3.5,
  question_number: currentQuestion
});
```

### Submit Results
```javascript
const results = {
  gameId: gameConfig.gameId,
  sessionId: gameConfig.sessionId,
  capabilities: GAME_CAPABILITIES,
  metrics: { accuracy: 0.85, time: 245, stars: 2 },
  attempts: attempts,
  events: events,
  completedAt: Date.now()
};

// Convert to snake_case for backend
const resultsSnakeCase = toSnakeCase(results);

window.parent.postMessage({
  type: 'game_complete',
  data: resultsSnakeCase
}, '*');
```

## 🐛 Troubleshooting (1 Minute Fixes)

### Audio Not Playing
```javascript
// 1. Check initialization
debugAudio(); // Should show loaded assets

// 2. Check URLs
testAudioUrls(); // Should show 200 status

// 3. Test individual
testAudio('tap'); // Should play sound
```

### Timer Not Working
```javascript
// Check if timer exists
console.log('Timer exists:', timer !== null);

// Check state
console.log('Timer state:', JSON.stringify({
  current: timer?.getCurrentTime(),
  isPaused: timer?.isPaused
}, null, 2));
```

### Pause Not Working
```javascript
// Check VisibilityTracker
console.log('Tracker exists:', tracker !== null);

// Manually trigger
testPause();  // Should pause
testResume(); // Should resume
```

### Memory Leaks
```javascript
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

// Always cleanup - record attempt first, then calculate metrics
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
    timer = null;
  }
  if (tracker) { tracker.destroy(); tracker = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

## 📚 Full Documentation

- **Complete examples:** `correct-patterns.md`
- **What NOT to do:** `anti-patterns.md`
- **Audit details:** `AUDIT-SUMMARY.md`
- **Overview:** `README.md`

## 🎯 30-Second Decision Tree

```
Need audio? → Yes → Pattern 1 (Feedback)
Need timer? → Yes → Pattern 2 (Timer + Tracker)
Need dynamic audio? → Yes → Pattern 3 (Dynamic)
Need to submit results? → Yes → Pattern 4 (Results)
Need complete game? → Yes → Pattern 5 (Full Template)
```

## ⚡ Copy/Paste Snippets

### Error Handler
```javascript
try {
  // your code
} catch (error) {
  console.error("Failed:", JSON.stringify({
    error: error.message,
    name: error.name
  }, null, 2));
}
```

### Log Object
```javascript
console.log("Data:", JSON.stringify(yourObject, null, 2));
```

### Cleanup Pattern
```javascript
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

// Cleanup - record attempt first, then calculate metrics
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
}

function cleanup() {
  if (timer) {
    window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
    timer.destroy();
    timer = null;
  }
  if (tracker) { tracker.destroy(); tracker = null; }
}
```

---

---

## Pattern 6: Raw Signal Capture (Minimal)

```javascript
// In waitForPackages(), add:
while (typeof SignalCollector === 'undefined') {
  if (Date.now() - start > timeout) throw new Error('Package loading timeout: SignalCollector');
  await new Promise(r => setTimeout(r, 50));
}

// After waitForPackages():
const signalCollector = new SignalCollector({
  containerSelector: '.game-play-area',
  sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
  studentId: window.gameVariableState?.studentId || null,
  gameId: gameState.gameId || null
});
window.signalCollector = signalCollector;

// MANDATORY: Record view events for ALL visual changes
// Screen transitions:
signalCollector.recordViewEvent('screen_transition', { screen: 'gameplay', metadata: { transition_from: 'ready' } });
// Content renders (including timer-driven):
signalCollector.recordViewEvent('content_render', { screen: 'gameplay', content_snapshot: { question_text, round, trigger: 'round_start' }, components: { timer: { value, state } } });
// Feedback display:
signalCollector.recordViewEvent('feedback_display', { screen: 'gameplay', content_snapshot: { feedback_type: 'correct', message: 'Great job!' } });
// Cell/option visual updates:
signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'cell_selected', selected_cell, user_values } });

// On game complete — seal() flushes to GCS via sendBeacon, returns { event_count, metadata }:
const result = signalCollector.seal();
window.parent.postMessage({
  type: 'game_complete',
  data: { metrics, attempts: attemptHistory, signal_event_count: result.event_count, signal_metadata: result.metadata }
}, '*');
```

**View event checklist:**
```
[ ] Every function that modifies the DOM (changing visible content) calls signalCollector.recordViewEvent()
[ ] Screen transitions emit 'screen_transition'
[ ] Content renders emit 'content_render' with trigger field
[ ] Timer-driven changes use trigger:'timer_reshuffle'
[ ] Feedback display emits 'feedback_display'
[ ] Cell/option selections emit 'visual_update'
```

See [signal-capture-patterns.md](signal-capture-patterns.md) Pattern 9 for full view event examples (Kakuro, Bubbles Pairs, MCQ).

---

**Remember:** When in doubt, copy Pattern 5 and remove what you don't need!
