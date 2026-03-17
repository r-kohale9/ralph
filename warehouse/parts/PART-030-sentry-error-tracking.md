# PART-030: Sentry Error Tracking

**Category:** EXTENSION | **Condition:** Production error monitoring (added after initial game is approved) | **Dependencies:** PART-002, PART-003

---

## Purpose

Add production error monitoring via Sentry. Captures package loading failures, initialization errors, audio issues, and unhandled exceptions.

## Script Loading (FIRST in order)

```html
<!-- CRITICAL: Load Sentry BEFORE all other packages -->
<script
  src="https://browser.sentry-cdn.com/8.38.0/bundle.min.js"
  integrity="sha384-jW29+V2FUY5bMhDSCD5tKVOBD8tV8rfJ8XNnHvVN+kOdG4d6aGHKFZ3G/6g4J7yU"
  crossorigin="anonymous"
></script>

<!-- Then game packages in normal order -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## Initialization

```javascript
// Initialize immediately in script block
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE',
  environment: 'production',
  release: 'game-name@1.0.0',
  tracesSampleRate: 0.1,
  sampleRate: 1.0,
  maxBreadcrumbs: 50,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured'
  ]
});
```

## Global Error Handlers

```javascript
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error || new Error(event.message), {
    tags: { errorType: 'unhandled', severity: 'critical' },
    contexts: {
      errorEvent: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
      }
    }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason || new Error('Unhandled promise rejection'), {
    tags: { errorType: 'unhandled-promise', severity: 'critical' }
  });
});
```

## Breadcrumb Patterns

```javascript
// In waitForPackages (after success):
Sentry.addBreadcrumb({
  category: 'package-loading',
  message: 'All packages loaded',
  level: 'info',
  data: { loadTime: Date.now() - start }
});

// In game_init handler:
Sentry.setUser({ id: config.studentId, sessionId: config.sessionId });
Sentry.setContext('game', {
  gameId: config.gameId,
  sessionId: config.sessionId,
  contentSetId: config.contentSetId
});
Sentry.addBreadcrumb({
  category: 'postmessage',
  message: 'game_init received',
  level: 'info'
});

// In endGame:
Sentry.addBreadcrumb({
  category: 'state',
  message: 'Game complete',
  level: 'info',
  data: { score: metrics.accuracy, stars: metrics.stars }
});
```

## Error Capture in catch Blocks

```javascript
// Package loading failure
catch (error) {
  Sentry.captureException(error, {
    tags: { phase: 'package-loading', severity: 'critical' },
    contexts: {
      packages: {
        feedbackManager: typeof FeedbackManager !== 'undefined',
        timerComponent: typeof TimerComponent !== 'undefined'
      }
    }
  });
  throw error;
}

// Audio playback failure
catch (error) {
  Sentry.captureException(error, {
    tags: { phase: 'audio-playback', component: 'FeedbackManager', severity: 'medium' }
  });
}
```

## Tagging Strategy

| Tag | Values | Use |
|-----|--------|-----|
| `phase` | `package-loading`, `initialization`, `core-gameplay`, `validation`, `feedback`, `result-submission` | Where error occurred |
| `component` | `FeedbackManager`, `TimerComponent`, `VisibilityTracker` | Which component |
| `severity` | `critical`, `high`, `medium`, `low` | Impact level |

## Debug Functions (Enhanced)

```javascript
window.verifySentry = function() {
  const checks = {
    sdkLoaded: typeof Sentry !== 'undefined',
    initialized: Sentry.getCurrentHub().getClient() !== undefined,
    dsn: Sentry.getCurrentHub().getClient()?.getDsn()?.toString()
  };
  console.log('Sentry Status:', JSON.stringify(checks, null, 2));
  return checks;
};

window.testSentry = function() {
  try {
    throw new Error('Test error from testSentry()');
  } catch (error) {
    Sentry.captureException(error, { tags: { test: true } });
    console.log('Test error sent to Sentry. Check dashboard.');
  }
};
```

## Verification

- [ ] Sentry SDK loaded BEFORE all other packages
- [ ] `Sentry.init()` called with DSN, environment, release
- [ ] Global error handlers registered (error + unhandledrejection)
- [ ] Breadcrumbs added at key lifecycle points
- [ ] User/game context set after `game_init`
- [ ] All catch blocks include `Sentry.captureException`
- [ ] `verifySentry()` and `testSentry()` debug functions added
