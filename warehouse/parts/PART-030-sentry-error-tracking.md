# PART-030: Sentry Error Tracking

**Category:** EXTENSION | **Condition:** Production error monitoring (added after initial game is approved) | **Dependencies:** PART-002, PART-003

---

## Purpose

Add production error monitoring via Sentry. Captures package loading failures, initialization errors, audio issues, and unhandled exceptions.

**A centralized `SentryConfig` package exists** at `packages/helpers/sentry/index.js`. It provides the DSN, ignore lists, sampling rates, and feature flags. Games should use this config rather than hardcoding values.

## Script Loading (FIRST in order)

```html
<!-- CRITICAL: Load Sentry config + SDK BEFORE all other packages -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>
<script
  src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js"
  crossorigin="anonymous"
></script>

<!-- Then game packages in normal order -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## SentryConfig API

The `SentryConfig` package (loaded via the first script tag above) exposes `window.SentryConfig` with:

| Method / Property | Returns | Description |
|---|---|---|
| `SentryConfig.dsn` | string | Production DSN |
| `SentryConfig.environment` | string | `'production'` |
| `SentryConfig.enabled` | boolean | Master switch (currently `false` — check before init) |
| `SentryConfig.captureReplay` | boolean | Whether to capture session replay |
| `SentryConfig.captureProfiling` | boolean | Whether to enable profiling |
| `SentryConfig.sampleRate` | number | Error sample rate (1.0) |
| `SentryConfig.replaySampleRate` | number | Replay sample rate (1.0) |
| `SentryConfig.tracesSampleRate` | number | Performance trace sample rate (0.1) |
| `SentryConfig.shouldIgnoreError(msg)` | boolean | Check if error should be ignored |
| `SentryConfig.shouldIgnoreReplay(msg)` | boolean | Check if replay should be skipped |
| `SentryConfig.getNetworkDetailAllowUrls()` | array | Allowed URLs for network detail capture |
| `SentryConfig.getConfig()` | object | Full configuration summary |

## Initialization

```javascript
// Initialize using SentryConfig values
if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled) {
  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: SentryConfig.environment,
    release: "game-name@1.0.0",
    tracesSampleRate: SentryConfig.tracesSampleRate,
    sampleRate: SentryConfig.sampleRate,
    maxBreadcrumbs: 50,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "Script error.",
      "Load failed",
      "Failed to fetch",
    ],
  });
}
```

## Global Error Handlers

```javascript
window.addEventListener("error", (event) => {
  Sentry.captureException(event.error || new Error(event.message), {
    tags: { errorType: "unhandled", severity: "critical" },
    contexts: {
      errorEvent: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      },
    },
  });
});

window.addEventListener("unhandledrejection", (event) => {
  Sentry.captureException(
    event.reason || new Error("Unhandled promise rejection"),
    {
      tags: { errorType: "unhandled-promise", severity: "critical" },
    },
  );
});
```

## Breadcrumb Patterns

```javascript
// In waitForPackages (after success):
Sentry.addBreadcrumb({
  category: "package-loading",
  message: "All packages loaded",
  level: "info",
  data: { loadTime: Date.now() - start },
});

// In game_init handler:
Sentry.setUser({ id: config.studentId, sessionId: config.sessionId });
Sentry.setContext("game", {
  gameId: config.gameId,
  sessionId: config.sessionId,
  contentSetId: config.contentSetId,
});
Sentry.addBreadcrumb({
  category: "postmessage",
  message: "game_init received",
  level: "info",
});

// In endGame:
Sentry.addBreadcrumb({
  category: "state",
  message: "Game complete",
  level: "info",
  data: { score: metrics.accuracy, stars: metrics.stars },
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

| Tag         | Values                                                                                              | Use                  |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------- |
| `phase`     | `package-loading`, `initialization`, `core-gameplay`, `validation`, `feedback`, `result-submission` | Where error occurred |
| `component` | `FeedbackManager`, `TimerComponent`, `VisibilityTracker`                                            | Which component      |
| `severity`  | `critical`, `high`, `medium`, `low`                                                                 | Impact level         |

## Anti-Patterns

```javascript
// WRONG — Placeholder DSN
Sentry.init({ dsn: "YOUR_SENTRY_DSN_HERE" });

// CORRECT — Use SentryConfig
Sentry.init({ dsn: SentryConfig.dsn });

// WRONG — Only 2 ignore patterns (misses common noise)
ignoreErrors: ["ResizeObserver loop limit exceeded", "Non-Error promise rejection captured"]

// CORRECT — All 6 patterns from SentryConfig
ignoreErrors: [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "Script error.",
  "Load failed",
  "Failed to fetch",
]

// WRONG — Deprecated Sentry v7 API
Sentry.getCurrentHub().getClient()

// CORRECT — Sentry v8+ API
Sentry.getClient()
```

## Debug Functions (Enhanced)

```javascript
// ⚠️ SDK v10+: use Sentry.getClient() — Sentry.getCurrentHub() was removed in v8
window.verifySentry = function () {
  const checks = {
    sdkLoaded: typeof Sentry !== 'undefined',
    configLoaded: typeof SentryConfig !== 'undefined',
    initialized: typeof Sentry !== 'undefined' && Sentry.getClient() !== undefined,
    dsn: typeof Sentry !== 'undefined' ? Sentry.getClient()?.getDsn()?.toString() : null,
    configVersion: typeof SentryConfig !== 'undefined' ? SentryConfig.version : null,
    replayEnabled: typeof SentryConfig !== 'undefined' ? SentryConfig.captureReplay : null
  };
  console.log("Sentry Status:", JSON.stringify(checks, null, 2));
  return checks;
};

window.testSentry = function () {
  try {
    throw new Error("Test error from testSentry()");
  } catch (error) {
    Sentry.captureException(error, { tags: { test: true } });
    console.log("Test error sent to Sentry. Check dashboard.");
  }
};
```

## Playwright Test Scenarios (PART-037)

Generated `game.spec.js` MUST include these Sentry-specific tests. Use the `verifySentryIntegration` helper from `test-helpers.js`.

### Scenario: Sentry integration fully configured

```
SETUP: Page loaded, game ready
ACTIONS:
  (none — check on load)
ASSERT (via verifySentryIntegration helper):
  SentryConfig package loaded (window.SentryConfig !== undefined)
  Sentry SDK loaded (window.Sentry !== undefined)
  initSentry() function defined
  Sentry initialized (verifySentry().initialized === true)
  DSN present (verifySentry().dsn is truthy)
  Script order: SentryConfig → SDK → game packages
  No integrity attribute on SDK scripts
  All 3 SDK scripts loaded (bundle.tracing.replay.feedback, captureconsole, browserprofiling)
  verifySentry() debug function exists
  testSentry() debug function exists
```

### Scenario: No console errors on load

```
SETUP: Collect console errors from page load
ACTIONS:
  Load page, wait for game ready
ASSERT:
  No "Sentry initialization failed" in console errors
  No "SentryConfig is not defined" in console errors
  No "Sentry is not defined" in console errors
```

### Scenario: Global error handlers registered

```
SETUP: Page loaded
ACTIONS:
  Trigger a test error via page.evaluate(() => window.testSentry())
ASSERT:
  testSentry() executes without throwing
  Console shows "Test error sent to Sentry"
```

### Test Code Pattern

```javascript
const { test, expect } = require('@playwright/test');
const { verifySentryIntegration, collectConsoleErrors } = require('./test-helpers');

test.describe('Sentry Integration (PART-030)', () => {
  test('Sentry is fully configured', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    // Wait for Sentry to initialize (window load event)
    await page.waitForTimeout(2000);
    await verifySentryIntegration(page);
    // No Sentry-related errors
    const sentryErrors = errors.filter(e =>
      e.includes('Sentry') || e.includes('SentryConfig')
    );
    expect(sentryErrors, 'No Sentry errors on load').toHaveLength(0);
  });

  test('testSentry() sends test error', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => {
      if (typeof window.testSentry === 'function') {
        window.testSentry();
        return true;
      }
      return false;
    });
    expect(result, 'testSentry() should execute').toBe(true);
  });
});
```

---

## Verification

- [ ] SentryConfig script loaded BEFORE Sentry SDK
- [ ] Sentry SDK version 10.x loaded (NOT 8.x)
- [ ] `Sentry.init()` uses `SentryConfig.dsn` (NOT placeholder)
- [ ] `SentryConfig.enabled` checked before initializing
- [ ] All 6 ignore patterns included
- [ ] Global error handlers registered (error + unhandledrejection)
- [ ] Breadcrumbs added at key lifecycle points
- [ ] User/game context set after `game_init`
- [ ] All catch blocks include `Sentry.captureException`
- [ ] `verifySentry()` uses `Sentry.getClient()` (NOT `getCurrentHub()`)
- [ ] `verifySentry()` and `testSentry()` debug functions added
