# Correct Implementation Patterns

⚠️ **ALL examples follow MANDATORY workflow rules from SKILL.md**

**NOTE:** Code examples show game patterns. For file operations in Claude Code, use Read, Write, Edit, and Bash tools with relative paths (e.g., `games/{gameId}/index.html`).

## Pattern 1: Complete Feedback Integration with FeedbackManager

**Workflow Steps:**

- ✅ Load FeedbackManager package
- ✅ Call `FeedbackManager.init()` before any usage
- ✅ Preload audio assets
- ✅ Play audio with subtitle/sticker props
- ✅ Handle errors properly

**Full Code:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Complete Feedback Example</title>
    <!-- ✅ MANDATORY: Load FeedbackManager -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  </head>
  <body>
    <button id="correctBtn">Test Correct Feedback</button>
    <button id="incorrectBtn">Test Incorrect Feedback</button>

    <script>
      // ========== FEEDBACK ASSETS ==========
      const feedbackAssets = {
        tap: 'https://storage.googleapis.com/test-dynamic-assets/audio/tap.mp3',
        correct: 'https://storage.googleapis.com/test-dynamic-assets/audio/correct.mp3',
        incorrect: 'https://storage.googleapis.com/test-dynamic-assets/audio/incorrect.mp3'
      };

      // ========== PACKAGE LOADING ==========
      // ✅ CRITICAL: Wait for ALL packages to load before initializing
      async function waitForPackages() {
        const timeout = 10000; // 10 seconds
        const start = Date.now();

        try {
          // Wait for FeedbackManager
          while (typeof FeedbackManager === 'undefined') {
            if (Date.now() - start > timeout) {
              throw new Error('Package loading timeout: FeedbackManager');
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          console.log('✅ All packages loaded');
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

      // ========== INITIALIZATION ==========
      window.addEventListener('DOMContentLoaded', async () => {
        console.log('🎮 Game initializing...');
        Sentry.addBreadcrumb({ category: 'initialization', message: 'DOMContentLoaded fired', level: 'info' });

        // ✅ Wait for packages to load first
        await waitForPackages();

        // ✅ MANDATORY: Initialize FeedbackManager
        await FeedbackManager.init();
        console.log('✅ FeedbackManager initialized');

        // ✅ Preload all audio
        await preloadAudio();

        // ✅ Setup event listeners
        setupButtons();
      });

      // ========== AUDIO PRELOADING ==========
      async function preloadAudio() {
        console.log('🔄 Preloading audio assets...');

        try {
          const audioList = Object.entries(feedbackAssets).map(([id, url]) => ({
            id,
            url
          }));

          await FeedbackManager.sound.preload(audioList);
          console.log('✅ All audio preloaded:', JSON.stringify(audioList, null, 2));
        } catch (error) {
          console.error(
            '❌ Audio preload failed:',
            JSON.stringify(
              {
                error: error.message,
                name: error.name
              },
              null,
              2
            )
          );
        }
      }

      // ========== FEEDBACK PLAYBACK ==========
      async function playFeedback(feedbackKey, subtitle = null, sticker = null) {
        try {
          // ✅ CORRECT: Use FeedbackManager with subtitle/sticker props
          await FeedbackManager.sound.play(feedbackKey, {
            subtitle: subtitle,
            sticker: sticker
              ? {
                  sticker: sticker,
                  loop: false,
                  duration: 2
                }
              : null
          });

          console.log(
            `✅ Played feedback: ${feedbackKey}`,
            JSON.stringify(
              {
                subtitle,
                sticker
              },
              null,
              2
            )
          );
        } catch (error) {
          console.error(
            `❌ Feedback failed: ${feedbackKey}`,
            JSON.stringify(
              {
                error: error.message,
                name: error.name
              },
              null,
              2
            )
          );
          Sentry.captureException(error, {
            tags: {
              phase: 'audio-playback',
              component: 'FeedbackManager',
              feedbackType: feedbackKey,
              severity: 'medium'
            },
            contexts: {
              audio: {
                key: feedbackKey,
                hasSubtitle: !!subtitle,
                hasSticker: !!sticker
              }
            }
          });
        }
      }

      // ========== EVENT HANDLERS ==========
      function setupButtons() {
        document.getElementById('correctBtn').onclick = async () => {
          await playFeedback('correct', '**Great job!** You got it right! ✨', 'https://cdn.mathai.com/stickers/star.json');
        };

        document.getElementById('incorrectBtn').onclick = async () => {
          await playFeedback('incorrect', 'Not quite! Try again.');
        };
      }

      // ========== DEBUG FUNCTIONS ==========
      window.testAudio = async function (feedbackType = 'tap') {
        console.log('🧪 Testing audio:', feedbackType);

        if (feedbackAssets[feedbackType]) {
          await FeedbackManager.sound.play(feedbackType);
          console.log('✅ Playing:', feedbackType);
        } else {
          console.error('❌ Unknown feedback type');
          console.log('Available types:', Object.keys(feedbackAssets));
        }
      };

      window.testAudioUrls = async function () {
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

      window.debugAudio = function () {
        const soundState = FeedbackManager.sound.getState();
        const streamState = FeedbackManager.stream.getState();
        console.log(
          '🎵 FeedbackManager State:',
          JSON.stringify(
            {
              sound: soundState,
              stream: streamState
            },
            null,
            2
          )
        );
      };
    </script>
  </body>
</html>
```

**Checklist:**

- [x] Sentry SDK loaded and initialized
- [x] Global error handlers added
- [x] FeedbackManager package loaded
- [x] `FeedbackManager.init()` called first
- [x] Audio preloaded with proper error handling
- [x] Subtitles passed as props with audio
- [x] Error handling in place with Sentry capture
- [x] Breadcrumbs for user journey tracking
- [x] Debug functions included
- [x] All logs use JSON.stringify

---

## Pattern 2: Timer with VisibilityTracker (Complete)

**Workflow Steps:**

- ✅ Load Components package (for Timer)
- ✅ Load FeedbackManager package (for audio)
- ✅ Load Helpers package (for VisibilityTracker)
- ✅ Initialize FeedbackManager
- ✅ Create timer with proper configuration
- ✅ Setup VisibilityTracker with pause/resume callbacks
- ✅ Cleanup on game end

**Full Code:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Timer with VisibilityTracker</title>
    <!-- ✅ MANDATORY: Load all required packages IN CORRECT ORDER -->
    <!-- 1. FeedbackManager (loads SubtitleComponent automatically) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
    <!-- 2. Components package (TimerComponent, PopupComponent) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
    <!-- 3. Helpers package (VisibilityTracker) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
  </head>
  <body>
    <div id="timer-container"></div>
    <button id="startBtn">Start Game</button>
    <button id="endBtn">End Game</button>

    <script>
      let timer = null;
      let visibilityTracker = null;

      // ========== PACKAGE LOADING ==========
      // ✅ CRITICAL: Wait for ALL packages to load before initializing
      async function waitForPackages() {
        // Wait for FeedbackManager
        while (typeof FeedbackManager === 'undefined') {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        // Wait for Components (TimerComponent)
        while (typeof TimerComponent === 'undefined') {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        // Wait for Helpers (VisibilityTracker)
        while (typeof VisibilityTracker === 'undefined') {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log('✅ All packages loaded');
      }

      // ========== INITIALIZATION ==========
      window.addEventListener('DOMContentLoaded', async () => {
        console.log('🎮 Game initializing...');

        // ✅ Wait for packages to load first
        await waitForPackages();

        // ✅ MANDATORY: Initialize FeedbackManager
        await FeedbackManager.init();
        console.log('✅ FeedbackManager initialized');

        setupButtons();
      });

      // ========== TIMER SETUP ==========
      function startGame() {
        console.log('🎮 Starting game...');

        // ✅ CORRECT: Create timer with TimerComponent
        timer = new TimerComponent('timer-container', {
          timerType: 'decrease',
          format: 'min',
          startTime: 60,
          endTime: 0,
          autoStart: true,
          onEnd: timeTaken => {
            console.log(
              '⏰ Time is up!',
              JSON.stringify(
                {
                  timeTaken
                },
                null,
                2
              )
            );
            endGame();
          }
        });
        window.timer = timer;  // Store globally for debugging and external access

        console.log('✅ Timer created and started');

        // ✅ MANDATORY: Setup VisibilityTracker
        setupVisibilityTracker();
      }

      // ========== VISIBILITY TRACKER SETUP ==========
      function setupVisibilityTracker() {
        // ✅ MANDATORY: VisibilityTracker with pause/resume callbacks
        visibilityTracker = new VisibilityTracker({
          onInactive: () => {
            console.log('⏸️  User went inactive - pausing activities');

            // ✅ MANDATORY: Pause timer
            if (timer) {
              timer.pause({ fromVisibilityTracker: true });
              console.log('✅ Timer paused');
            }

            // ✅ MANDATORY: Pause regular audio
            FeedbackManager.sound.pause();
            console.log('✅ Regular audio paused');

            // ✅ MANDATORY: Pause streaming audio
            FeedbackManager.stream.pauseAll();
            console.log('✅ Streaming audio paused');
          },
          onResume: () => {
            console.log('▶️  User resumed - resuming activities');

            // ✅ MANDATORY: Resume timer
            if (timer && timer.isPaused) {
              timer.resume({ fromVisibilityTracker: true });
              console.log('✅ Timer resumed');
            }

            // ✅ MANDATORY: Resume regular audio
            FeedbackManager.sound.resume();
            console.log('✅ Regular audio resumed');

            // ✅ MANDATORY: Resume streaming audio
            FeedbackManager.stream.resumeAll();
            console.log('✅ Streaming audio resumed');
          },
          popupProps: {
            icon: 'https://cdn.mathai.com/animations/pause.json',
            title: 'Game Paused',
            description: 'Your game has been paused. Click Resume to continue.',
            primaryText: 'Resume Game'
          }
        });

        console.log('✅ VisibilityTracker setup complete');
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
          lives_lost: livesLost,
          help_taken: helpTaken,
          metadata: {
            round_number: roundNumber,
            level_number: levelNumber,
            jump_states: jumpStates,
            content_visible: contentVisible,
            content_interactive: contentInteractive,
            other_interactive_content: otherInteractiveContent,
            content_interacted: contentInteracted,
            question: question
          }
        });
      }

      // ========== GAME END & CLEANUP ==========
      function endGame() {
        console.log('🏁 Ending game...');

        // Record the completed attempt
        recordAttempt();

        // Calculate metrics only
        const overallCorrectness = question.was_correct ? 1.0 : 0.0;
        const stars = overallCorrectness >= 0.9 ? 3 : overallCorrectness >= 0.7 ? 2 : overallCorrectness > 0 ? 1 : 0;
        const metrics = {
          accuracy: Number(overallCorrectness.toFixed(4)),
          time: window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0),
          stars,
          retries: attemptNumber - 1,
          timeBreakdown: window.gameVariableState.timerElapsedTimes
        };

        // Submit with accumulated attemptHistory
        submitGame(attemptHistory);

        // ✅ Cleanup timer
        if (timer) {
          window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
          timer.destroy();
          timer = null;
          console.log('✅ Timer destroyed');
        }

        // ✅ Cleanup visibility tracker
        if (visibilityTracker) {
          visibilityTracker.destroy();
          visibilityTracker = null;
          console.log('✅ VisibilityTracker destroyed');
        }

        console.log('✅ Game ended and cleaned up');
      }

      // ========== EVENT HANDLERS ==========
      function setupButtons() {
        document.getElementById('startBtn').onclick = startGame;
        document.getElementById('endBtn').onclick = endGame;
      }

      // ========== DEBUG FUNCTIONS ==========
      window.testPause = function () {
        if (visibilityTracker) {
          visibilityTracker.triggerInactive();
          console.log('🧪 Manually triggered pause');
        }
      };

      window.testResume = function () {
        if (visibilityTracker) {
          visibilityTracker.triggerResume();
          console.log('🧪 Manually triggered resume');
        }
      };

      window.debugTimer = function () {
        if (timer) {
          console.log(
            '⏱️  Timer State:',
            JSON.stringify(
              {
                currentTime: timer.getCurrentTime(),
                timeTaken: timer.getTimeTaken(),
                formattedTime: timer.getFormattedTime(),
                isPaused: timer.isPaused
              },
              null,
              2
            )
          );
        }
      };
    </script>
  </body>
</html>
```

**Checklist:**

- [x] Components package loaded
- [x] FeedbackManager package loaded
- [x] Helpers package loaded
- [x] FeedbackManager.init() called
- [x] Timer created with TimerComponent
- [x] VisibilityTracker setup with callbacks
- [x] onInactive pauses timer + audio
- [x] onResume resumes timer + audio
- [x] Cleanup methods called on end
- [x] Debug functions for testing

---

## Pattern 3: Dynamic Audio Generation (Complete)

**Workflow Steps:**

- ✅ Load FeedbackManager package
- ✅ Initialize FeedbackManager
- ✅ Fetch audio from API
- ✅ Use FeedbackManager for both cached and streaming audio
- ✅ Pass subtitles as props
- ✅ Handle errors properly

**Full Code:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Dynamic Audio Generation</title>
    <!-- ✅ MANDATORY: Load FeedbackManager -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  </head>
  <body>
    <button id="dynamicBtn">Generate Dynamic Audio</button>
    <input type="text" id="scoreInput" placeholder="Score (e.g., 85)" value="85" />
    <input type="text" id="timeInput" placeholder="Time (e.g., 45)" value="45" />

    <script>
      // ========== INITIALIZATION ==========
      window.onload = async () => {
        console.log('🎮 Game initializing...');

        // ✅ MANDATORY: Initialize FeedbackManager first
        await FeedbackManager.init();
        console.log('✅ FeedbackManager initialized');

        setupButtons();
      };

      // ========== DYNAMIC AUDIO GENERATION ==========
      async function generateDynamicFeedback(text, stickerUrl = null, subtitleText = null) {
        console.log('🔄 Generating dynamic audio:', text);

        try {
          // ✅ NEW SIMPLIFIED METHOD - Handles both cached and streaming automatically
          await FeedbackManager.playDynamicFeedback({
            audio_content: text,
            subtitle: subtitleText || text,
            sticker: stickerUrl
          });

          console.log('✅ Dynamic feedback played successfully');
        } catch (error) {
          console.error(
            '❌ Dynamic audio generation failed:',
            JSON.stringify(
              {
                error: error.message,
                name: error.name,
                text
              },
              null,
              2
            )
          );
        }
      }

      // ========== COMPLETION FEEDBACK ==========
      async function showCompletionFeedback() {
        const score = document.getElementById('scoreInput').value;
        const time = document.getElementById('timeInput').value;

        const text = `Congratulations! You completed the game with ${score}% accuracy in ${time} seconds!`;
        const stickerUrl = 'https://cdn.mathai.com/stickers/trophy.json';

        await generateDynamicFeedback(text, stickerUrl);
      }

      // ========== EVENT HANDLERS ==========
      function setupButtons() {
        document.getElementById('dynamicBtn').onclick = showCompletionFeedback;
      }

      // ========== DEBUG FUNCTIONS ==========
      window.testDynamicAudio = async function (text = 'Test message') {
        console.log('🧪 Testing dynamic audio:', text);
        await generateDynamicFeedback(text);
      };

      window.testCachedDynamic = async function () {
        console.log('🧪 Testing cached dynamic audio');
        await generateDynamicFeedback('This is a cached test message');
      };

      window.testStreamDynamic = async function () {
        console.log('🧪 Testing streaming dynamic audio');
        const longText =
          'This is a very long message that will trigger streaming audio generation instead of cached audio. ' +
          'It contains multiple sentences to ensure it exceeds the cache threshold and forces real-time streaming.';
        await generateDynamicFeedback(longText);
      };
    </script>
  </body>
</html>
```

**Checklist:**

- [x] FeedbackManager package loaded
- [x] FeedbackManager.init() called
- [x] API call for dynamic audio
- [x] Cached audio uses FeedbackManager.sound
- [x] Streaming audio uses FeedbackManager.stream
- [x] Subtitles passed as props
- [x] Stickers passed as props
- [x] Error handling in place
- [x] Debug functions for testing

---

## Pattern 4: Results Submission (Complete)

**Workflow Steps:**

- ✅ Track attempts with proper validation types
- ✅ Track low-level events
- ✅ Calculate metrics
- ✅ Convert to snake_case for backend
- ✅ Submit via postMessage

**Full Code:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Results Submission Example</title>
    <!-- ✅ MANDATORY: Load Helpers package for case converter -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
  </head>
  <body>
    <div id="game">
      <button id="answerBtn">Submit Answer</button>
      <button id="completeBtn">Complete Game</button>
    </div>

    <script>
      // ========== GAME CONFIGURATION ==========
      const GAME_CAPABILITIES = {
        tracks: ['accuracy', 'time', 'stars'],
        provides: ['score', 'stars'],
        type: 'practice',
        metadata: {
          title: 'Math Quiz',
          concepts: ['multiplication'],
          difficulty: 'medium',
          estimatedTime: 300,
          minGrade: 3,
          maxGrade: 5
        }
      };

      let gameConfig = null;
      let attempts = [];
      let events = [];
      let gameStartTime = null;

      // ========== EVENT TRACKER ==========
      const eventTracker = {
        track(type, target, data = {}) {
          const event = {
            type,
            target,
            timestamp: Date.now(),
            ...data
          };
          events.push(event);
          console.log('📝 Event tracked:', JSON.stringify(event, null, 2));
        }
      };

      // ========== INITIALIZATION ==========
      window.onload = () => {
        console.log('🎮 Game initializing...');

        // Listen for game_init message
        window.addEventListener('message', handleGameInit);
        setupButtons();
      };

      // ========== MESSAGE HANDLER ==========
      function handleGameInit(event) {
        if (event.data.type === 'game_init') {
          console.log('📨 Received game_init:', JSON.stringify(event.data.data, null, 2));
          gameConfig = event.data.data;
          startGame();
        }
      }

      // ========== GAME START ==========
      function startGame() {
        gameStartTime = Date.now();
        console.log('🎮 Game started');

        eventTracker.track('game_start', 'game', {
          gameId: gameConfig.gameId,
          sessionId: gameConfig.sessionId
        });
      }

      // ========== ANSWER SUBMISSION ==========
      function submitAnswer(userAnswer, correctAnswer) {
        const correct = userAnswer === correctAnswer;
        const responseTime = Date.now() - gameStartTime;

        // ✅ Track attempt with complete data
        const attempt = {
          questionNumber: attempts.length + 1,
          question: '5 × 3 = ?',
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          correct: correct,
          validationType: 'fixed',
          timestamp: Date.now(),
          responseTime: responseTime
        };

        attempts.push(attempt);
        console.log('✅ Attempt tracked:', JSON.stringify(attempt, null, 2));

        // ✅ Track low-level event
        eventTracker.track('answer_submitted', 'answer-button', {
          questionNumber: attempt.questionNumber,
          correct: correct,
          responseTime: responseTime
        });
      }

      // ========== RESULTS SUBMISSION ==========
      function completeGame() {
        console.log('🏁 Completing game...');

        // ✅ Calculate metrics
        const correctCount = attempts.filter(a => a.correct).length;
        const accuracy = attempts.length > 0 ? correctCount / attempts.length : 0;
        const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);
        const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;

        // ✅ Build results in camelCase
        const results = {
          gameId: gameConfig.gameId,
          sessionId: gameConfig.sessionId,
          capabilities: GAME_CAPABILITIES,

          metrics: {
            accuracy: accuracy,
            time: totalTime,
            stars: stars
          },

          attempts: attempts,
          events: events,
          completedAt: Date.now()
        };

        console.log('📊 Results (camelCase):', JSON.stringify(results, null, 2));

        // ✅ CRITICAL: Convert to snake_case for backend
        const resultsSnakeCase = toSnakeCase(results);
        console.log('📊 Results (snake_case for backend):', JSON.stringify(resultsSnakeCase, null, 2));

        // ✅ Send to parent container
        window.parent.postMessage(
          {
            type: 'game_complete',
            data: resultsSnakeCase
          },
          '*'
        );
        console.log('✅ Results sent to parent');
      }

      // ========== EVENT HANDLERS ==========
      function setupButtons() {
        document.getElementById('answerBtn').onclick = () => {
          submitAnswer(15, 15);
        };

        document.getElementById('completeBtn').onclick = () => {
          completeGame();
        };
      }

      // ========== DEBUG FUNCTIONS ==========
      window.debugGame = function () {
        console.log(
          '🎮 Game State:',
          JSON.stringify(
            {
              gameId: gameConfig?.gameId,
              sessionId: gameConfig?.sessionId,
              attempts: attempts.length,
              events: events.length,
              gameStartTime: gameStartTime
            },
            null,
            2
          )
        );
      };

      window.debugResults = function () {
        const correctCount = attempts.filter(a => a.correct).length;
        const accuracy = attempts.length > 0 ? correctCount / attempts.length : 0;

        console.log(
          '📊 Current Metrics:',
          JSON.stringify(
            {
              totalAttempts: attempts.length,
              correctCount: correctCount,
              accuracy: accuracy,
              totalEvents: events.length
            },
            null,
            2
          )
        );
      };
    </script>
  </body>
</html>
```

**Checklist:**

- [x] Helpers package loaded (for toSnakeCase)
- [x] GAME_CAPABILITIES declared
- [x] Attempts tracked with all required fields
- [x] Events tracked with timestamps
- [x] Metrics calculated correctly
- [x] Results built in camelCase
- [x] Results converted to snake_case
- [x] Submitted via postMessage
- [x] Debug functions included

---

## Pattern 5: Full Game Template (Complete)

**Complete game with all features integrated:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Complete Math Quiz Game</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- ✅ MANDATORY: Load all required packages IN CORRECT ORDER -->
    <!-- 1. FeedbackManager (loads SubtitleComponent automatically) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
    <!-- 2. Components package (TimerComponent, PopupComponent) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
    <!-- 3. Helpers package (VisibilityTracker) -->
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background: #f5f5f5;
      }

      #game-container {
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .question {
        font-size: 24px;
        margin-bottom: 20px;
        text-align: center;
      }

      .options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 20px;
      }

      .option-btn {
        padding: 15px;
        font-size: 18px;
        border: 2px solid #ddd;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }

      .option-btn:hover {
        background: #f0f0f0;
        transform: translateY(-2px);
      }

      .option-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        padding: 10px;
        background: #f9f9f9;
        border-radius: 5px;
      }
    </style>
  </head>
  <body>
    <div id="game-container">
      <div id="timer-container"></div>

      <div class="stats">
        <div>Question: <span id="current-question">1</span>/<span id="total-questions">10</span></div>
        <div>Score: <span id="score">0</span></div>
      </div>

      <div class="question" id="question-text">Loading...</div>

      <div class="options" id="options-container"></div>
    </div>

    <script>
      // ========== GAME CONFIGURATION ==========
      const GAME_CAPABILITIES = {
        tracks: ['accuracy', 'time', 'stars'],
        provides: ['score', 'stars'],
        type: 'practice',
        metadata: {
          title: 'Multiplication Quiz',
          concepts: ['multiplication', 'times-tables'],
          difficulty: 'medium',
          estimatedTime: 300,
          minGrade: 3,
          maxGrade: 5
        },
        inputSchema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  operand1: { type: 'number' },
                  operand2: { type: 'number' },
                  answer: { type: 'number' }
                },
                required: ['operand1', 'operand2', 'answer']
              }
            }
          },
          required: ['questions']
        }
      };

      // ========== FEEDBACK ASSETS ==========
      const feedbackAssets = {
        tap: 'https://storage.googleapis.com/test-dynamic-assets/audio/tap.mp3',
        correct: 'https://storage.googleapis.com/test-dynamic-assets/audio/correct.mp3',
        incorrect: 'https://storage.googleapis.com/test-dynamic-assets/audio/incorrect.mp3'
      };

      // ========== GAME STATE ==========
      let gameConfig = null;
      let currentQuestionIndex = 0;
      let score = 0;
      let attempts = [];
      let events = [];
      let gameStartTime = null;
      let timer = null;
      let visibilityTracker = null;

      // ========== EVENT TRACKER ==========
      const eventTracker = {
        track(type, target, data = {}) {
          events.push({
            type,
            target,
            timestamp: Date.now(),
            ...data
          });
        }
      };

      // ========== INITIALIZATION ==========
      window.onload = async () => {
        console.log('🎮 Game initializing...');

        // ✅ MANDATORY: Initialize FeedbackManager first
        await FeedbackManager.init();
        console.log('✅ FeedbackManager initialized');

        // ✅ Preload audio
        await preloadAudio();

        // Listen for game_init message
        window.addEventListener('message', handleGameInit);
      };

      // ========== AUDIO PRELOADING ==========
      async function preloadAudio() {
        console.log('🔄 Preloading audio assets...');

        try {
          const audioList = Object.entries(feedbackAssets).map(([id, url]) => ({
            id,
            url
          }));

          await FeedbackManager.sound.preload(audioList);
          console.log('✅ All audio preloaded');
        } catch (error) {
          console.error(
            '❌ Audio preload failed:',
            JSON.stringify(
              {
                error: error.message
              },
              null,
              2
            )
          );
        }
      }

      // ========== MESSAGE HANDLER ==========
      function handleGameInit(event) {
        if (event.data.type === 'game_init') {
          console.log('📨 Received game_init:', JSON.stringify(event.data.data, null, 2));
          gameConfig = event.data.data;
          startGame();
        }
      }

      // ========== GAME START ==========
      function startGame() {
        gameStartTime = Date.now();
        console.log('🎮 Game started');

        // ✅ Setup timer
        timer = new TimerComponent('timer-container', {
          timerType: 'decrease',
          format: 'min',
          startTime: 120,
          endTime: 0,
          autoStart: true,
          onEnd: timeTaken => {
            console.log('⏰ Time is up!');
            completeGame();
          }
        });
        window.timer = timer;  // Store globally for debugging and external access

        // ✅ MANDATORY: Setup VisibilityTracker
        visibilityTracker = new VisibilityTracker({
          onInactive: () => {
            if (timer) timer.pause({ fromVisibilityTracker: true });
            FeedbackManager.sound.pause();
            FeedbackManager.stream.pauseAll();
            console.log('⏸️  Game paused');
          },
          onResume: () => {
            if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
            FeedbackManager.sound.resume();
            FeedbackManager.stream.resumeAll();
            console.log('▶️  Game resumed');
          },
          popupProps: {
            title: 'Quiz Paused',
            description: 'Your quiz has been paused. Click Resume to continue.',
            primaryText: 'Resume Quiz'
          }
        });

        // Track game start
        eventTracker.track('game_start', 'game', {
          gameId: gameConfig.gameId
        });

        // Show first question
        showQuestion();
      }

      // ========== QUESTION DISPLAY ==========
      function showQuestion() {
        const question = gameConfig.content.questions[currentQuestionIndex];
        document.getElementById('total-questions').textContent = gameConfig.content.questions.length;
        document.getElementById('current-question').textContent = currentQuestionIndex + 1;
        document.getElementById('score').textContent = score;

        // Display question
        document.getElementById('question-text').textContent = `${question.operand1} × ${question.operand2} = ?`;

        // Generate options (correct + 3 wrong)
        const options = generateOptions(question.answer);
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        options.forEach((option, index) => {
          const btn = document.createElement('button');
          btn.className = 'option-btn';
          btn.textContent = option;
          btn.onclick = () => handleAnswer(option, question.answer, btn);
          optionsContainer.appendChild(btn);
        });

        eventTracker.track('question_shown', 'question', {
          questionNumber: currentQuestionIndex + 1,
          question: `${question.operand1} × ${question.operand2}`
        });

        console.log(`📋 Showing question ${currentQuestionIndex + 1}`);
      }

      // ========== GENERATE OPTIONS ==========
      function generateOptions(correctAnswer) {
        const options = [correctAnswer];

        while (options.length < 4) {
          const wrong = correctAnswer + Math.floor(Math.random() * 20) - 10;
          if (wrong > 0 && !options.includes(wrong)) {
            options.push(wrong);
          }
        }

        return options.sort(() => Math.random() - 0.5);
      }

      // ========== ANSWER HANDLING ==========
      async function handleAnswer(userAnswer, correctAnswer, button) {
        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = true;
        });

        // Play tap sound
        await FeedbackManager.sound.play('tap');

        const correct = userAnswer === correctAnswer;
        const responseTime = Date.now() - gameStartTime;

        // Track attempt
        const attempt = {
          questionNumber: currentQuestionIndex + 1,
          question: document.getElementById('question-text').textContent,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          correct: correct,
          validationType: 'fixed',
          timestamp: Date.now(),
          responseTime: responseTime
        };

        attempts.push(attempt);
        console.log('✅ Attempt tracked:', JSON.stringify(attempt, null, 2));

        // Track event
        eventTracker.track('answer_submitted', 'option-button', {
          questionNumber: currentQuestionIndex + 1,
          correct: correct
        });

        // Show feedback
        if (correct) {
          score++;
          document.getElementById('score').textContent = score;
          await FeedbackManager.sound.play('correct', {
            subtitle: '**Great job!** You got it right! ✨',
            sticker: {
              image: 'https://cdn.mathai.ai/mathai-assets/lottie/star-sparkle.json',
              loop: false,
              duration: 2,
              type: 'IMAGE_GIF'
            }
          });
        } else {
          await FeedbackManager.sound.play('incorrect', {
            subtitle: 'Not quite! Try the next one.'
          });
        }

        // Move to next question or complete
        setTimeout(() => {
          currentQuestionIndex++;

          if (currentQuestionIndex < gameConfig.content.questions.length) {
            showQuestion();
          } else {
            completeGame();
          }
        }, 2000);
      }

      // ========== GAME COMPLETION ==========
      async function completeGame() {
        console.log('🏁 Completing game...');

        // Stop timer
        if (timer) {
          // Capture elapsed times before destroying
          if (typeof timer.getElapsedTimes === 'function') {
            window.gameVariableState = window.gameVariableState || {};
            window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
          }
          timer.destroy();
          timer = null;
        }

        // Stop visibility tracker
        if (visibilityTracker) {
          visibilityTracker.destroy();
          visibilityTracker = null;
        }

        // Calculate metrics
        const correctCount = attempts.filter(a => a.correct).length;
        const accuracy = attempts.length > 0 ? correctCount / attempts.length : 0;
        const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);
        const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;

        // Show dynamic completion feedback
        const completionText = `Congratulations! You scored ${Math.round(
          accuracy * 100
        )}% with ${stars} stars in ${totalTime} seconds!`;
        await generateDynamicFeedback(completionText, 'https://cdn.mathai.com/stickers/trophy.json');

        // Build results
        const results = {
          gameId: gameConfig.gameId,
          sessionId: gameConfig.sessionId,
          capabilities: GAME_CAPABILITIES,
          metrics: {
            accuracy: accuracy,
            time: totalTime,
            stars: stars
          },
          attempts: attempts,
          events: events,
          completedAt: Date.now()
        };

        console.log('📊 Results (camelCase):', JSON.stringify(results, null, 2));

        // Convert to snake_case for backend
        const resultsSnakeCase = toSnakeCase(results);

        // Submit results
        window.parent.postMessage(
          {
            type: 'game_complete',
            data: resultsSnakeCase
          },
          '*'
        );
        console.log('✅ Results sent to parent');
      }

      // ========== DYNAMIC AUDIO GENERATION ==========
      async function generateDynamicFeedback(text, stickerUrl = null, subtitleText = null) {
        try {
          // ✅ NEW SIMPLIFIED METHOD - Handles both cached and streaming automatically
          await FeedbackManager.playDynamicFeedback({
            audio_content: text,
            subtitle: subtitleText || text,
            sticker: stickerUrl
          });

          console.log('✅ Dynamic feedback played successfully');
        } catch (error) {
          console.error(
            '❌ Dynamic audio failed:',
            JSON.stringify(
              {
                error: error.message
              },
              null,
              2
            )
          );
        }
      }

      // ========== DEBUG FUNCTIONS ==========
      window.testAudio = async function (feedbackType = 'tap') {
        console.log('🧪 Testing audio:', feedbackType);
        if (feedbackAssets[feedbackType]) {
          await FeedbackManager.sound.play(feedbackType);
        }
      };

      window.testAudioUrls = async function () {
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
            results.push({ name, url, error: error.message });
          }
        }
        console.log('📊 URL Test Results:', JSON.stringify(results, null, 2));
      };

      window.debugAudio = function () {
        console.log(
          '🎵 FeedbackManager State:',
          JSON.stringify(
            {
              sound: FeedbackManager.sound.getState(),
              stream: FeedbackManager.stream.getState()
            },
            null,
            2
          )
        );
      };

      window.debugGame = function () {
        console.log(
          '🎮 Game State:',
          JSON.stringify(
            {
              currentQuestion: currentQuestionIndex + 1,
              totalQuestions: gameConfig?.content.questions.length,
              score: score,
              attempts: attempts.length,
              events: events.length
            },
            null,
            2
          )
        );
      };
    </script>
  </body>
</html>
```

**Checklist:**

- [x] All packages loaded (Components, FeedbackManager, Helpers)
- [x] FeedbackManager.init() called first
- [x] Audio preloaded with error handling
- [x] Timer created with TimerComponent
- [x] VisibilityTracker setup with full callbacks
- [x] Feedback uses FeedbackManager with props
- [x] Dynamic audio for completion
- [x] Attempts and events tracked
- [x] Results converted to snake_case
- [x] Cleanup on game end
- [x] Debug functions included
- [x] All logs use JSON.stringify
- [x] No font-family declared in HTML

---

## Summary

All patterns follow these **MANDATORY** rules:

1. ✅ **FeedbackManager**: Always load and initialize before ANY audio usage
2. ✅ **TimerComponent**: Always use for timers - NEVER manual setInterval
3. ✅ **VisibilityTracker**: Always integrate for pause/resume functionality
4. ✅ **Subtitles as Props**: Always pass with audio - NEVER use SubtitleComponent.show()
5. ✅ **Error Handling**: Always include try/catch with detailed logging
6. ✅ **Cleanup**: Always call destroy() methods on game end
7. ✅ **Debug Functions**: Always include test and debug utilities
8. ✅ **JSON Logging**: Always use JSON.stringify(data, null, 2)
9. ✅ **Font Styling**: NEVER declare font-family in index.html
