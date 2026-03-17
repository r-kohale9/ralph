# AnalyticsManager

Unified analytics tracking system supporting Mixpanel, Amplitude, and CleverTap with automatic platform filtering and Sentry error tracking.

## Overview

**AnalyticsManager** provides:
- **Multi-platform tracking** (Mixpanel, Amplitude, CleverTap)
- **User identification** with profile data
- **Automatic harness detection** (all events include `harness: true`)
- **Platform filtering** controlled by CDN config (no game changes needed)
- **Error tracking** via Sentry integration
- **distinct_id** automatically generated from student data

## Package Loading

```html
<!-- 4. Analytics Package (MANDATORY - config loads automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**Note:**
- Analytics package is **MANDATORY** for all games. Event tracking is required.
- **Config loads automatically** - no need to load config.js separately
- Analytics must be loaded AFTER FeedbackManager, Components, and Helpers

## Initialization

```javascript
async function waitForPackages() {
  // ... other packages ...

  // Wait for AnalyticsManager if using tracking (optional)
  while (typeof AnalyticsManager === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Initialize analytics
  const analytics = new AnalyticsManager();
  await analytics.init();

  // Set global instance (for StoriesComponent integration)
  window.analyticsManager = analytics;

  // Identify user if data available
  analytics.identify({
    id: 1554,
    mobile: '9876543210',
    name: 'John Doe',
    email: 'john@example.com'
  });

  // Start tracking events
  analytics.track('page_opened', { page: 'game' });
});
```

## API Reference

### `init()`

Initialize analytics system. Must be called before tracking events.

```javascript
await analytics.init();
```

### `identify(traits)`

Identify user with profile data.

**Parameters:**
- `traits` (object): User profile data (**id is required**)
  - `id` (number): Student ID (student.id) - **REQUIRED**
  - `mobile` (string): Phone number
  - `name` (string): Full name
  - `email` (string): Email address

```javascript
analytics.identify({
  id: student.id,  // Required
  mobile: student.mobile,
  name: student.name,
  email: student.email
});
```

**distinct_id generation:**
1. If `traits.distinct_id` provided → use it
2. If mobile + name + id present → `{mobile}_{name_lowercase}_{id}` (e.g., `9876543210_john_doe_1554`)
3. Otherwise → `{id}_{region}` (e.g., `1554_IN`)

### `track(eventName, properties)`

Track custom event.

**Parameters:**
- `eventName` (string): Event name
- `properties` (object): Event properties (optional)

**Note:** All events automatically include `harness: true`

```javascript
// Track page opened
analytics.track('page_opened', { page: 'game' });

// Track game started
analytics.track('game_started', {
  difficulty: 'easy',
  level: 1
});

// Track question answered
analytics.track('question_answered', {
  correct: true,
  time: 3.5,
  question_number: 1
});

// Track game completed
analytics.track('game_completed', {
  score: 85,
  total_questions: 20,
  time_taken: 120
});
```

## Common Events

### Game Events

```javascript
// Game lifecycle
analytics.track('page_opened', { page: 'game' });
analytics.track('game_started', { difficulty: 'easy', level: 1 });
analytics.track('game_paused', { time_elapsed: 45 });
analytics.track('game_resumed', { time_elapsed: 45 });
analytics.track('game_completed', { score: 85, stars: 3 });

// Question/Round events
analytics.track('question_shown', { question_number: 1 });
analytics.track('question_answered', { correct: true, time: 3.5 });
analytics.track('round_completed', { round_number: 1, score: 10 });

// User actions
analytics.track('hint_used', { question_number: 5 });
analytics.track('retry_clicked', { attempt_number: 2 });
analytics.track('help_requested', { topic: 'multiplication' });
```

### UI Events

```javascript
// Button clicks
analytics.track('button_clicked', { button_name: 'start', screen: 'home' });
analytics.track('option_selected', { option: 'A', question_number: 3 });

// Navigation
analytics.track('screen_changed', { from: 'home', to: 'game' });
analytics.track('popup_opened', { popup_type: 'pause' });
analytics.track('popup_closed', { popup_type: 'pause' });
```

## Key Features

### Automatic harness Detection

All events automatically include `harness: true`, `mathai_platform`, `region`, and `current_href`:

```javascript
// You write:
analytics.track('game_started', { difficulty: 'easy' });

// Platforms receive:
{
  event: 'game_started',
  properties: {
    difficulty: 'easy',
    harness: true,              // ✅ Automatically added
    mathai_platform: 'web',     // ✅ Auto-detected (web/ios/android)
    region: 'IN',               // ✅ From config
    current_href: 'https://...' // ✅ Current page URL
  }
}
```

### Platform Filtering (CDN Config)

Event filtering is controlled by `config.js` on CDN - no game code changes needed.

**Example: Skip `page_opened` on Mixpanel and CleverTap**

Edit `config.js`:
```javascript
shouldSendToPlatform: function(event, platform) {
  var skipAllPlatforms = [];

  if (platform === 'MIXPANEL') {
    var skipEvents = skipAllPlatforms.concat(['page_opened', 'page_closed']);
    return skipEvents.indexOf(event) === -1;
  }

  if (platform === 'CLEVERTAP') {
    var skipEvents = skipAllPlatforms.concat(['page_opened']);
    return skipEvents.indexOf(event) === -1;
  }

  return true;  // AMPLITUDE gets all events
}
```

Upload to CDN → All games (old and new) automatically respect the new rules!

**Platform Control:**

```javascript
// Enable/disable entire platforms
platforms: ['MIXPANEL', 'AMPLITUDE', 'CLEVERTAP']  // All enabled
platforms: ['AMPLITUDE']  // Only Amplitude enabled
```

### Credentials Configuration

All API credentials are centralized in `config.js`:

```javascript
credentials: {
  mixpanel: {
    token: 'YOUR_MIXPANEL_TOKEN',
    proxyUrl: 'YOUR_PROXY_URL'  // optional
  },
  amplitude: {
    apiKey: 'YOUR_AMPLITUDE_KEY'
  },
  clevertap: {
    accountId: 'YOUR_CLEVERTAP_ACCOUNT_ID',
    region: 'eu1'
  }
}
```

**Update credentials:** Edit `config.js` → upload to CDN → all games use new credentials!

### Error Tracking

Analytics automatically integrates with Sentry:

```javascript
// Errors are automatically captured
try {
  analytics.track('game_event', invalidData);
} catch (error) {
  // ✅ Error sent to Sentry automatically
}
```

## Example: Complete Game Analytics

```javascript
// ========== INITIALIZATION ==========
let analytics = null;

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Initialize analytics
  analytics = new AnalyticsManager();
  await analytics.init();

  // Identify user if available
  if (window.userData) {
    analytics.identify({
      id: window.userData.id,
      mobile: window.userData.phone,
      name: window.userData.name,
      email: window.userData.email
    });
  }

  // Track page opened
  analytics.track('page_opened', { page: 'game' });

  setupGame();
});

// ========== GAME LIFECYCLE ==========
function startGame() {
  analytics.track('game_started', {
    difficulty: currentDifficulty,
    level: currentLevel,
    total_questions: questions.length
  });

  showQuestion();
}

function pauseGame() {
  analytics.track('game_paused', {
    time_elapsed: timer.getTimeTaken(),
    question_number: currentQuestionIndex + 1
  });
}

function resumeGame() {
  analytics.track('game_resumed', {
    time_elapsed: timer.getTimeTaken(),
    question_number: currentQuestionIndex + 1
  });
}

// ========== QUESTION HANDLING ==========
function showQuestion() {
  analytics.track('question_shown', {
    question_number: currentQuestionIndex + 1,
    difficulty: currentQuestion.difficulty
  });
}

function handleAnswer(userAnswer, correctAnswer) {
  const correct = userAnswer === correctAnswer;
  const responseTime = timer.getTimeTaken();

  analytics.track('question_answered', {
    question_number: currentQuestionIndex + 1,
    correct: correct,
    response_time: responseTime,
    user_answer: userAnswer,
    correct_answer: correctAnswer
  });

  if (correct) {
    score++;
  }

  nextQuestion();
}

// ========== GAME COMPLETION ==========
function completeGame() {
  const finalScore = (score / totalQuestions) * 100;
  const stars = calculateStars(finalScore);
  const totalTime = timer.getTimeTaken();

  analytics.track('game_completed', {
    score: finalScore,
    stars: stars,
    correct_answers: score,
    total_questions: totalQuestions,
    time_taken: totalTime,
    accuracy: score / totalQuestions
  });

  showResults();
}
```

## Best Practices

### 1. Track Meaningful Events

```javascript
// ✅ Good - specific and actionable
analytics.track('question_answered', {
  correct: true,
  time: 3.5,
  question_number: 1,
  difficulty: 'medium'
});

// ❌ Bad - too generic
analytics.track('click', { button: 'something' });
```

### 2. Include Relevant Context

```javascript
// ✅ Good - includes context
analytics.track('game_completed', {
  score: 85,
  stars: 3,
  difficulty: 'hard',
  total_time: 120,
  retry_count: 2
});

// ❌ Bad - missing context
analytics.track('game_completed', { score: 85 });
```

### 3. Use Consistent Event Names

```javascript
// ✅ Good - consistent naming
analytics.track('game_started', { ... });
analytics.track('game_paused', { ... });
analytics.track('game_completed', { ... });

// ❌ Bad - inconsistent
analytics.track('start_game', { ... });
analytics.track('pauseGame', { ... });
analytics.track('GameComplete', { ... });
```

### 4. Don't Over-Track

```javascript
// ✅ Good - meaningful events
analytics.track('question_answered', { correct: true });

// ❌ Bad - too granular
analytics.track('mouse_moved', { x: 100, y: 200 });
analytics.track('key_pressed', { key: 'A' });
```

## Troubleshooting

### Analytics Not Initializing

```javascript
// Check if packages loaded
console.log('AnalyticsConfig:', typeof AnalyticsConfig);
console.log('AnalyticsManager:', typeof AnalyticsManager);

// Check initialization
if (!analytics) {
  console.error('❌ Analytics not initialized');
}
```

### Events Not Sending

```javascript
// Verify analytics is initialized
if (analytics) {
  analytics.track('test_event', { test: true });
  console.log('✅ Test event sent');
} else {
  console.error('❌ Analytics not available');
}
```

### User Not Identified

```javascript
// Check if identify was called
console.log('User identified:', analytics.userId);

// Re-identify if needed
analytics.identify({
  id: 1554,
  name: 'John Doe',
  email: 'john@example.com'
});
```

## Game Events

For games created with mathai-game-builder, track these **7 mandatory events** in Phase 2:

1. **question_submitted** - User submits answer
2. **question_evaluation_complete** - Validation completes
3. **question_timed_out** - Timer expires (for timed questions)
4. **show_submit_button** - Submit button shown/enabled
5. **hide_submit_button** - Submit button hidden/disabled
6. **next_btn_clicked** - Next button clicked
7. **show_image_not_loaded_popup** - Images fail to load

**See**: [game-analytics-events.md](game-analytics-events.md) for complete integration guide

## Notes

- **MANDATORY Package**: Analytics is required for all games. Event tracking is mandatory.
- **Automatic harness**: All events include `harness: true` automatically.
- **Multi-Platform**: Supports Mixpanel, Amplitude, and CleverTap simultaneously.
- **Platform Filtering**: Controlled by CDN config - update once, affects all games.
- **Sentry Integration**: Errors automatically sent to Sentry if enabled.
- **Centralized Config**: All credentials and filtering rules in `config.js` on CDN.
