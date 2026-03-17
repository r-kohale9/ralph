# Sentry Integration Reference

Comprehensive error tracking for mathai games using Sentry.

## Quick Start

### 1. Add Sentry SDK (FIRST in load order)

```html
<!-- CRITICAL: Load Sentry BEFORE all other packages -->
<script
  src="https://browser.sentry-cdn.com/8.38.0/bundle.min.js"
  integrity="sha384-jW29+V2FUY5bMhDSCD5tKVOBD8tV8rfJ8XNnHvVN+kOdG4d6aGHKFZ3G/6g4J7yU"
  crossorigin="anonymous"
></script>

<!-- Then load game packages -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

### 2. Initialize Sentry

```javascript
// Initialize immediately after Sentry loads
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE', // Get from Sentry project settings
  environment: 'production', // or 'development', 'staging'
  release: 'game-name@1.0.0', // Track game version

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Error sampling
  sampleRate: 1.0, // Capture 100% of errors

  // Breadcrumbs
  maxBreadcrumbs: 50,

  // User context (set after game_init)
  beforeSend(event, hint) {
    // Add game-specific context
    return event;
  }
});
```

## Error Capture Patterns

### Package Loading

```javascript
async function waitForPackages() {
  const timeout = 10000; // 10 seconds
  const start = Date.now();
  const packages = ['FeedbackManager', 'TimerComponent', 'VisibilityTracker'];

  try {
    // Wait for FeedbackManager
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager not available after 10s');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for TimerComponent (if using)
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: TimerComponent not available after 10s');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for VisibilityTracker (if using)
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: VisibilityTracker not available after 10s');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ All packages loaded');
    Sentry.addBreadcrumb({
      category: 'package-loading',
      message: 'All packages loaded successfully',
      level: 'info',
      data: { loadTime: Date.now() - start }
    });
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'package-loading',
        severity: 'critical'
      },
      contexts: {
        packages: {
          feedbackManager: typeof FeedbackManager !== 'undefined',
          timerComponent: typeof TimerComponent !== 'undefined',
          visibilityTracker: typeof VisibilityTracker !== 'undefined',
          elapsedTime: Date.now() - start
        }
      }
    });
    throw error;
  }
}
```

### Component Initialization

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  Sentry.addBreadcrumb({
    category: 'initialization',
    message: 'DOMContentLoaded fired',
    level: 'info'
  });

  try {
    // Wait for packages
    await waitForPackages();

    // Initialize FeedbackManager
    await FeedbackManager.init();
    Sentry.addBreadcrumb({
      category: 'initialization',
      message: 'FeedbackManager initialized',
      level: 'info'
    });

    // Initialize game
    await setupGame();
    Sentry.addBreadcrumb({
      category: 'initialization',
      message: 'Game setup complete',
      level: 'info'
    });
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'initialization',
        severity: 'critical'
      }
    });

    // Show user-friendly error
    displayErrorMessage('Failed to initialize game. Please refresh the page.');
  }
});
```

### Audio/Feedback Operations

```javascript
// Audio preload
async function preloadAudio() {
  const feedbackAssets = {
    correct: 'https://example.com/correct.mp3',
    incorrect: 'https://example.com/incorrect.mp3'
  };

  try {
    await FeedbackManager.sound.preload(feedbackAssets);
    console.log('✅ Audio preloaded');
    Sentry.addBreadcrumb({
      category: 'audio',
      message: 'Audio assets preloaded',
      level: 'info',
      data: { assetCount: Object.keys(feedbackAssets).length }
    });
  } catch (error) {
    console.error('❌ Audio preload failed:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'audio-preload',
        component: 'FeedbackManager',
        severity: 'high'
      },
      contexts: {
        audio: {
          assetCount: Object.keys(feedbackAssets).length,
          assets: feedbackAssets
        }
      }
    });
    throw error;
  }
}

// Audio playback
async function playFeedback(key, options = {}) {
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
      },
      contexts: {
        audio: {
          key,
          options,
          errorName: error.name
        }
      }
    });

    // Fallback: show subtitle only
    if (options.subtitle) {
      SubtitleComponent.show({ text: options.subtitle });
    }
  }
}
```

### Validation Errors

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  try {
    const isCorrect = userAnswer === correctAnswer;

    Sentry.addBreadcrumb({
      category: 'validation',
      message: 'Answer validated',
      level: 'info',
      data: { correct: isCorrect }
    });

    return isCorrect;
  } catch (error) {
    console.error('❌ Validation error:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'validation',
        severity: 'high'
      },
      contexts: {
        validation: {
          userAnswer,
          correctAnswer
        }
      }
    });

    // Safe fallback
    return false;
  }
}
```

### PostMessage Communication

```javascript
// Receiving game_init
window.addEventListener('message', (event) => {
  try {
    if (event.data.type === 'game_init') {
      const config = fromSnakeCase(event.data.data);

      // Set user context in Sentry
      Sentry.setUser({
        id: config.studentId,
        sessionId: config.sessionId
      });

      // Set game context
      Sentry.setContext('game', {
        gameId: config.gameId,
        sessionId: config.sessionId,
        contentSetId: config.contentSetId
      });

      Sentry.addBreadcrumb({
        category: 'postmessage',
        message: 'game_init received',
        level: 'info',
        data: { gameId: config.gameId }
      });

      initializeGame(config);
    }
  } catch (error) {
    console.error('❌ Message handling error:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'message-handling',
        messageType: event.data?.type || 'unknown',
        severity: 'high'
      }
    });
  }
});

// Sending game_complete
function submitResults(results) {
  try {
    const resultsSnakeCase = toSnakeCase(results);

    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'game_complete',
        data: resultsSnakeCase
      }, '*');

      Sentry.addBreadcrumb({
        category: 'postmessage',
        message: 'game_complete sent',
        level: 'info',
        data: {
          resultSize: JSON.stringify(results).length,
          attemptCount: results.attempts?.length || 0
        }
      });
    }
  } catch (error) {
    console.error('❌ Result submission error:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'result-submission',
        severity: 'critical'
      },
      contexts: {
        results: {
          size: JSON.stringify(results).length,
          hasAttempts: !!results.attempts
        }
      }
    });
  }
}
```

### Global Error Handlers

```javascript
// Catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('❌ Unhandled error:', event.error);
  Sentry.captureException(event.error || new Error(event.message), {
    tags: {
      errorType: 'unhandled',
      severity: 'critical'
    },
    contexts: {
      errorEvent: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    }
  });
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
  Sentry.captureException(event.reason || new Error('Unhandled promise rejection'), {
    tags: {
      errorType: 'unhandled-promise',
      severity: 'critical'
    }
  });
});
```

## Tagging Strategy

### Phase Tags
```javascript
tags: {
  phase: 'package-loading' | 'initialization' | 'core-gameplay' |
         'validation' | 'feedback' | 'result-submission'
}
```

### Component Tags
```javascript
tags: {
  component: 'FeedbackManager' | 'TimerComponent' | 'VisibilityTracker' |
             'SubtitleComponent'
}
```

### Severity Tags
```javascript
tags: {
  severity: 'critical' | 'high' | 'medium' | 'low'
}
```

**Severity Guidelines:**
- **critical**: Package loading, initialization, result submission failures
- **high**: Audio playback, validation, message handling errors
- **medium**: Component edge cases, non-blocking errors
- **low**: Warnings, debug information

## Context Enrichment

### Game Context
```javascript
Sentry.setContext('game', {
  gameId: config.gameId,
  sessionId: config.sessionId,
  contentSetId: config.contentSetId,
  currentQuestion: currentQuestionIndex,
  totalQuestions: questions.length,
  totalAttempts: attempts.length
});
```

### User Context
```javascript
Sentry.setUser({
  id: config.studentId,
  sessionId: config.sessionId
});
```

### Browser Context (automatic)
Sentry automatically captures:
- User agent
- Browser version
- OS version
- Screen resolution
- Language

## Breadcrumbs

Use breadcrumbs to track user journey:

```javascript
// Package loading
Sentry.addBreadcrumb({
  category: 'package-loading',
  message: 'FeedbackManager loaded',
  level: 'info'
});

// User interactions
Sentry.addBreadcrumb({
  category: 'user-action',
  message: 'Answer submitted',
  level: 'info',
  data: { questionIndex: 0, correct: true }
});

// State changes
Sentry.addBreadcrumb({
  category: 'state',
  message: 'Game state updated',
  level: 'info',
  data: { state: 'playing', question: 1 }
});

// API calls
Sentry.addBreadcrumb({
  category: 'api',
  message: 'Audio preload started',
  level: 'info',
  data: { assetCount: 5 }
});
```

## Performance Monitoring

### Transactions

```javascript
// Track game load performance
const transaction = Sentry.startTransaction({
  name: 'game-load',
  op: 'pageload'
});

// Package loading span
const packageSpan = transaction.startChild({
  op: 'package-loading',
  description: 'Load game packages'
});
await waitForPackages();
packageSpan.finish();

// Initialization span
const initSpan = transaction.startChild({
  op: 'initialization',
  description: 'Initialize game components'
});
await setupGame();
initSpan.finish();

transaction.finish();
```

### Custom Metrics

```javascript
// Track audio load time
const audioStart = performance.now();
await FeedbackManager.sound.preload(feedbackAssets);
const audioLoadTime = performance.now() - audioStart;

Sentry.addBreadcrumb({
  category: 'performance',
  message: 'Audio preload time',
  level: 'info',
  data: { duration: audioLoadTime }
});
```

## User Feedback

Allow users to report issues:

```javascript
// Show feedback dialog after error
window.addEventListener('error', (event) => {
  const eventId = Sentry.captureException(event.error);

  // Optional: Show feedback form
  Sentry.showReportDialog({
    eventId,
    title: 'Game Error Occurred',
    subtitle: 'Help us improve by reporting what happened',
    subtitle2: 'Your progress has been saved.',
    labelName: 'Name (optional)',
    labelEmail: 'Email (optional)',
    labelComments: 'What happened?',
    labelSubmit: 'Submit Report',
    errorGeneric: 'An error occurred while submitting your report. Please try again.',
    successMessage: 'Thank you! Your feedback has been sent.'
  });
});
```

## Environment Configuration

### Development vs Production

```javascript
const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE',
  environment: isDevelopment ? 'development' : 'production',

  // Don't send errors in development (optional)
  enabled: !isDevelopment,

  // More verbose logging in development
  debug: isDevelopment,

  // Sample less in production
  tracesSampleRate: isDevelopment ? 1.0 : 0.1
});
```

## Integration with Existing Patterns

### Preserve Console Logging

```javascript
// ✅ CORRECT: Keep console logs + add Sentry
try {
  await operation();
  console.log('✅ Operation succeeded');
} catch (error) {
  // Local debugging
  console.error('❌ Operation failed:', JSON.stringify({
    error: error.message,
    name: error.name,
    stack: error.stack
  }, null, 2));

  // Production monitoring
  Sentry.captureException(error, {
    tags: { phase: 'operation' }
  });

  // Fallback behavior
  handleFallback();
}
```

### Preserve Debug Functions

```javascript
// Keep debug functions, enhance with Sentry context
window.debugGame = function() {
  const state = {
    currentQuestion: currentQuestionIndex,
    totalAttempts: attempts.length,
    timer: timer?.getTime(),
    visibility: tracker?.getData()
  };

  console.log('🐛 Game State:', JSON.stringify(state, null, 2));

  // Also log to Sentry
  Sentry.addBreadcrumb({
    category: 'debug',
    message: 'debugGame() called',
    level: 'debug',
    data: state
  });

  return state;
};
```

## DSN Configuration

### Getting Your DSN

1. Create project in Sentry: https://sentry.io/organizations/YOUR_ORG/projects/
2. Copy DSN from project settings
3. Replace `'YOUR_SENTRY_DSN_HERE'` in Sentry.init()

### DSN Format
```
https://PUBLIC_KEY@o0.ingest.sentry.io/PROJECT_ID
```

### Security Note
- DSN is public and safe to expose in frontend code
- It only allows sending errors, not reading them
- Use project settings to control data retention and PII

## Testing Sentry Integration

### Manual Test

```javascript
// Add to window for testing
window.testSentry = function() {
  try {
    // Test error capture
    throw new Error('Test error from testSentry()');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { test: true }
    });
    console.log('✅ Test error sent to Sentry. Check your Sentry dashboard.');
  }
};

// Test in console: testSentry()
```

### Verify Integration

```javascript
window.verifySentry = function() {
  const checks = {
    sdkLoaded: typeof Sentry !== 'undefined',
    initialized: Sentry.getCurrentHub().getClient() !== undefined,
    dsn: Sentry.getCurrentHub().getClient()?.getDsn()?.toString()
  };

  console.log('🔍 Sentry Status:', JSON.stringify(checks, null, 2));

  if (checks.sdkLoaded && checks.initialized) {
    console.log('✅ Sentry is properly configured');
  } else {
    console.error('❌ Sentry configuration issue');
  }

  return checks;
};
```

## Best Practices

### DO ✅
- Load Sentry SDK before all other packages
- Initialize Sentry immediately after SDK loads
- Use tags for filtering (phase, component, severity)
- Add breadcrumbs for user journey tracking
- Set user and game context after game_init
- Keep console logging for local debugging
- Use error boundaries with fallback behavior
- Test error capture in development

### DON'T ❌
- Don't capture sensitive data (passwords, PII)
- Don't log every event (use appropriate severity)
- Don't block game execution on Sentry errors
- Don't remove existing error handling patterns
- Don't use Sentry in place of validation logic
- Don't send test errors to production environment

## Troubleshooting

### Sentry SDK not loading
- Check network tab for 404/CORS errors
- Verify CDN URL and integrity hash
- Ensure script loads before game packages

### Errors not appearing in Sentry
- Check DSN is correct
- Verify `enabled: true` in config
- Check browser console for Sentry warnings
- Run `window.verifySentry()` to check status

### Too many errors
- Adjust `sampleRate` to sample fewer errors
- Add `beforeSend` filter to exclude known issues
- Use `ignoreErrors` config for benign errors

### Missing context
- Ensure `setUser()` called after game_init
- Verify `setContext()` called before errors occur
- Check breadcrumbs are added at key points

## Additional Resources

- Sentry JavaScript SDK: https://docs.sentry.io/platforms/javascript/
- Performance Monitoring: https://docs.sentry.io/platforms/javascript/performance/
- Source Maps: https://docs.sentry.io/platforms/javascript/sourcemaps/
- User Feedback: https://docs.sentry.io/platforms/javascript/user-feedback/
