# Error Tracking Checklist (Sentry)

**Applied in Phase 5 - Production Readiness**

**MANDATORY for all production games**

## Problems Solved by Sentry

### 1. Error Capturing

**Loading Failures:**
- [ ] Package loading failures (FeedbackManager, Components, Helpers)
- [ ] Package loading timeouts (10s timeout)
- [ ] Sentry SDK failed to load
- [ ] Script loading errors

**UI Failures:**
- [ ] Blank screen (initialization failure)
- [ ] Infinite loading (non-interactive UI)
- [ ] DOM rendering failures
- [ ] Component mounting errors

**Asset Failures:**
- [ ] Audio preload failures
- [ ] Audio playback errors
- [ ] Lottie sticker loading failures
- [ ] Image loading errors (img onerror)
- [ ] Video loading errors (video onerror)
- [ ] Background image loading failures (CSS)
- [ ] SVG loading failures

**Code Failures:**
- [ ] Function execution errors (validation, feedback, game logic)
- [ ] Unhandled JavaScript errors
- [ ] Unhandled promise rejections
- [ ] Syntax errors at runtime

**API Failures:**
- [ ] postMessage failures (game_init, game_complete)
- [ ] Result submission errors
- [ ] Backend communication failures
- [ ] Network request errors

**Component Failures:**
- [ ] FeedbackManager initialization errors
- [ ] TimerComponent errors
- [ ] VisibilityTracker errors
- [ ] All component lifecycle failures

### 2. Session Replay Capturing
- [ ] Video replay of error sessions (100% by default)
- [ ] User interaction timeline
- [ ] Visual UI state before error
- [ ] Configurable sampling rate

### 3. Noise Filtering
- [ ] Skip common benign browser errors (ResizeObserver, etc.)
- [ ] Skip replays for non-critical errors
- [ ] Customizable error patterns (ignoredErrors array)
- [ ] Customizable replay patterns (ignoreReplay array)
- [ ] Pre-configured common error filters in generated code

### 4. SDK Download Optimization
- [ ] Browser caches SDK automatically (1 year)
- [ ] One download per browser session
- [ ] Reused across all games
- [ ] CDN delivery (browser.sentry-cdn.com)

### 5. User Journey Tracking
- [ ] Breadcrumbs show step-by-step actions
- [ ] Package loading timeline
- [ ] Initialization sequence
- [ ] User context (studentId, sessionId, gameId)
- [ ] Game state snapshots

### 6. Production Debugging
- [ ] Remote error monitoring (no console access needed)
- [ ] Tagged by phase/component/severity
- [ ] Contextual data (package states, timing)
- [ ] Centralized dashboard for all games
- [ ] Error grouping and deduplication

---

## SDK Loading & Initialization

### 1. Load Sentry Config Package FIRST (Centralized Configuration)

```html
<!-- ✅ STEP 1: Load Sentry Config Package (provides centralized ignore lists) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- ✅ STEP 2: Define Sentry Init Function -->
<script>
function initSentry() {
  // Check if Sentry is enabled via centralized config
  if (!SentryConfig.enabled) {
    console.log('⚠️ Sentry disabled via centralized config');
    return;
  }

  try {
    Sentry.init({
      // Use centralized DSN
      dsn: SentryConfig.dsn,

      // Use centralized environment and sampling rates
      environment: SentryConfig.environment,
      sampleRate: SentryConfig.sampleRate,
      tracesSampleRate: SentryConfig.tracesSampleRate,

      // Use centralized error filtering
      beforeSend(event, hint) {
        if (!SentryConfig.captureErrors) {
          return null; // Don't send if error capture disabled
        }

        const error = hint.originalException;
        const errorMessage = error?.message || event.message || '';

        // Use centralized ignore list
        if (SentryConfig.shouldIgnoreError(errorMessage)) {
          console.log('🔇 Sentry: Ignoring benign error:', errorMessage);
          return null;
        }

        return event;
      },

      integrations: [
        // Browser profiling (optional)
        SentryConfig.captureProfiling ? Sentry.browserProfilingIntegration() : null,

        // Console error capture (optional)
        SentryConfig.captureConsoleErrors ? Sentry.captureConsoleIntegration({ levels: ["error"] }) : null,

        // Session replay (optional)
        SentryConfig.captureReplay ? Sentry.replayIntegration({
          beforeErrorSampling(event) {
            const errorMessage = event.message || '';

            // Use centralized replay ignore list
            if (SentryConfig.shouldIgnoreReplay(errorMessage)) {
              console.log('🔇 Sentry: Skipping replay for:', errorMessage);
              return false;
            }

            return true;
          },
          maskAllText: false,
          blockAllMedia: false,
          maskAllInputs: true,

          // Use centralized network detail URLs
          networkDetailAllowUrls: SentryConfig.getNetworkDetailAllowUrls(),
        }) : null
      ].filter(Boolean),

      // Use centralized replay sample rate
      replaysOnErrorSampleRate: SentryConfig.captureReplay
        ? SentryConfig.replaySampleRate
        : 0.0,
    });

    console.log('✅ Sentry initialized with centralized config v' + SentryConfig.version);
    Sentry.addBreadcrumb({
      category: 'initialization',
      message: 'Sentry initialized successfully',
      level: 'info'
    });
  } catch (error) {
    console.error('❌ Sentry initialization failed:', error);
  }
}
</script>
```

### 2. Load Sentry SDK and Integrations

```html
<!-- ✅ STEP 3: Load Sentry SDK and integrations -->
<!-- Base Sentry bundle with tracing, replay, and feedback -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>

<!-- Console capture integration -->
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>

<!-- Browser profiling integration -->
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- Initialize Sentry after all scripts load -->
<script>
  // Wait for all Sentry scripts to load
  window.addEventListener('load', initSentry);
</script>
```

**Load Order:**
1. ✅ Load Sentry Config Package (centralized ignore lists)
2. ✅ Define initSentry() function
3. ✅ Load Sentry SDK base bundle (tracing, replay, feedback)
4. ✅ Load console capture integration
5. ✅ Load browser profiling integration
6. ✅ Initialize Sentry on window load event
7. ✅ FeedbackManager package
8. ✅ Components package
9. ✅ Helpers package

**Configuration:**
- [ ] Sentry Config Package loaded first (provides SentryConfig object)
- [ ] initSentry() function defined before SDK script tags
- [ ] initSentry() uses SentryConfig methods (shouldIgnoreError, getNetworkDetailAllowUrls, etc.)
- [ ] Three Sentry script tags loaded (bundle.tracing.replay.feedback, captureconsole, browserprofiling)
- [ ] window.addEventListener('load', initSentry) called after script tags
- [ ] Centralized DSN and config used (no user configuration needed)
- [ ] Environment set in SENTRY_CONFIG (default: 'production')
- [ ] Traces sample rate configured (0.1 = 10% performance monitoring)
- [ ] Replay sample rate configured (1.0 = 100% of error sessions)
- [ ] Error filtering placeholder section present (beforeSend)
- [ ] Replay filtering placeholder section present (beforeErrorSampling)
- [ ] Master switch for disabling tracking (SENTRY_CONFIG.enabled)
- [ ] Replay toggle (SENTRY_CONFIG.enableReplay)

## Package Loading Error Tracking

### 3. Add Timeout & Error Capture to waitForPackages()

```javascript
async function waitForPackages() {
  const timeout = 10000; // 10 seconds
  const start = Date.now();

  try {
    // Wait for FeedbackManager
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for TimerComponent (if using timer)
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: TimerComponent');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for VisibilityTracker
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: VisibilityTracker');
      }
      await new Promise(r => setTimeout(r, 50));
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

**Checklist:**
- [ ] Timeout added (10 seconds)
- [ ] Try-catch block wraps all package checks
- [ ] Specific error messages for each package
- [ ] Breadcrumb added on success
- [ ] Exception captured with tags and contexts
- [ ] Error re-thrown for proper handling

## Initialization Error Tracking

### 4. Wrap DOMContentLoaded in Try-Catch

```javascript
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

    // Initialize components...
    setupGame();
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    Sentry.captureException(error, {
      tags: {
        phase: 'initialization',
        severity: 'critical'
      }
    });
    // Show user-friendly error
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to initialize game. Please refresh the page.</div>';
  }
});
```

**Checklist:**
- [ ] Breadcrumb added on DOMContentLoaded
- [ ] Try-catch wraps all initialization
- [ ] Breadcrumb after FeedbackManager.init()
- [ ] Exception captured with tags
- [ ] User-friendly error message shown on failure

## Global Error Handlers

### 5. Add Global Error Handlers

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

**Checklist:**
- [ ] 'error' event listener added
- [ ] 'unhandledrejection' event listener added
- [ ] Both handlers capture exceptions to Sentry
- [ ] Both handlers log to console

## Asset Loading Error Handlers

### 6. Add Automatic Asset Error Tracking

**IMPORTANT:** Added automatically in Phase 5. No user specification required.

```javascript
// Helper function to track asset loading failures
function trackAssetError(assetType, assetUrl, error) {
  console.error(`❌ ${assetType} loading failed:`, assetUrl, error);

  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(new Error(`${assetType} loading failed: ${assetUrl}`), {
      tags: {
        errorType: 'asset-loading',
        assetType: assetType,
        severity: 'medium'
      },
      extra: {
        assetUrl: assetUrl,
        errorMessage: error?.message || 'Unknown error'
      }
    });
  }
}

// Add error handlers to all images
document.querySelectorAll('img').forEach(img => {
  if (!img.hasAttribute('onerror')) {
    img.addEventListener('error', (e) => {
      trackAssetError('image', img.src, e);
      img.style.display = 'none'; // Hide broken image
    });
  }
});

// Add error handlers to all videos
document.querySelectorAll('video').forEach(video => {
  video.addEventListener('error', (e) => {
    // Get src from video.src or from failed source element
    const src = video.currentSrc || video.src;
    trackAssetError('video', src, e);
    video.style.display = 'none'; // Hide broken video
  });

  // Also handle source element errors (thrown before video error)
  video.querySelectorAll('source').forEach(source => {
    source.addEventListener('error', (e) => {
      trackAssetError('video-source', source.src, e);
    });
  });
});

// Add error handlers to all audio (if not using FeedbackManager)
document.querySelectorAll('audio').forEach(audio => {
  audio.addEventListener('error', (e) => {
    trackAssetError('audio', audio.src, e);
  });
});

// Audio preload error tracking (FeedbackManager)
try {
  await FeedbackManager.sound.preload();
} catch (error) {
  console.error('❌ Audio preload failed:', error);
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(error, {
      tags: { errorType: 'audio-preload', severity: 'medium' }
    });
  }
}
```

**Checklist:**
- [ ] trackAssetError() helper function added
- [ ] All existing images have error handlers (querySelectorAll('img'))
- [ ] All existing videos have error handlers (querySelectorAll('video') + source elements)
- [ ] All existing audio have error handlers (querySelectorAll('audio'))
- [ ] Dynamically created assets get error handlers on creation
- [ ] FeedbackManager audio preload wrapped in try-catch
- [ ] Failed assets hidden (display: none) to prevent broken UI
- [ ] Asset URLs included in error context (use video.currentSrc for videos)
- [ ] Error contexts included

## Audio/Feedback Error Tracking

### 6. Add Error Tracking to Audio Operations

**Preload:**
```javascript
async function preloadAudio() {
  try {
    await FeedbackManager.sound.preload(audioList);
    console.log('✅ Audio preloaded');
    Sentry.addBreadcrumb({
      category: 'audio',
      message: 'Audio assets preloaded',
      level: 'info',
      data: { assetCount: audioList.length }
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
          assetCount: audioList.length,
          assets: feedbackAssets
        }
      }
    });
    throw error;
  }
}
```

**Playback:**
```javascript
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
      },
      contexts: {
        audio: {
          key,
          hasSubtitle: !!options.subtitle,
          hasSticker: !!options.sticker
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

**Checklist:**
- [ ] Preload errors captured with asset info
- [ ] Playback errors captured with feedback type
- [ ] Breadcrumb on successful preload
- [ ] Fallback behavior on playback error
- [ ] Console logs preserved

## Validation Error Tracking

### 7. Add Error Tracking to Validation

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
    return false; // Safe fallback
  }
}
```

**Checklist:**
- [ ] Try-catch wraps validation logic
- [ ] Breadcrumb on successful validation
- [ ] Exception captured with context
- [ ] Safe fallback (return false)

## PostMessage Error Tracking

### 8. Add Error Tracking to Message Handling

**Receiving game_init:**
```javascript
window.addEventListener('message', (event) => {
  try {
    if (event.data.type === 'game_init') {
      const config = fromSnakeCase(event.data.data);

      // Set user context
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
```

**Sending game_complete:**
```javascript
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
      }
    });
  }
}
```

**Checklist:**
- [ ] game_init handler wrapped in try-catch
- [ ] User context set after game_init
- [ ] Game context set after game_init
- [ ] Breadcrumb on successful message
- [ ] game_complete handler wrapped in try-catch
- [ ] Exception captured with appropriate tags

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
  component: 'FeedbackManager' | 'TimerComponent' | 'VisibilityTracker'
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

## Verification Checklist

**Before completing Phase 5, verify:**

**Configuration & Loading:**
- [ ] SENTRY_CONFIG object defined with all feature flags
- [ ] initSentry() function defined before SDK script tag
- [ ] Sentry SDK loaded with onload callback
- [ ] Hardcoded DSN present (no user config required)
- [ ] Error filtering placeholder section present (beforeSend)
- [ ] Replay filtering placeholder section present (beforeErrorSampling)
- [ ] Feature flags configured correctly (enabled, enableReplay, tracesSampleRate)

**Error Tracking:**
- [ ] Timeout added to waitForPackages() (10s)
- [ ] Package loading errors captured with contexts
- [ ] DOMContentLoaded wrapped in try-catch
- [ ] Global error handlers added (error + unhandledrejection)
- [ ] Audio preload errors captured
- [ ] Audio playback errors captured with fallback
- [ ] Validation errors captured
- [ ] game_init handler captures errors
- [ ] game_complete handler captures errors

**Context & Breadcrumbs:**
- [ ] User context set after game_init (studentId, sessionId)
- [ ] Game context set after game_init (gameId, contentSetId)
- [ ] Breadcrumbs added at key points (package loading, initialization, messages)
- [ ] All tags use correct phase/component/severity
- [ ] Console logs preserved for local debugging

**Testing:**
- [ ] Sentry initializes without errors (check console)
- [ ] Test error sent to Sentry dashboard (testSentry())
- [ ] Breadcrumbs visible in Sentry dashboard
- [ ] Error contexts captured correctly
- [ ] Session replay enabled (if SENTRY_CONFIG.enableReplay = true)

## Testing

**Manual test in browser console:**
```javascript
// Test Sentry integration
window.testSentry = function() {
  try {
    throw new Error('Test error from testSentry()');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { test: true }
    });
    console.log('✅ Test error sent to Sentry. Check your dashboard.');
  }
};

// Verify Sentry status
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

// Run tests
verifySentry();
testSentry();
```

**Check Sentry dashboard:**
1. Open your Sentry project dashboard
2. Verify test error appears in Issues
3. Check breadcrumbs are captured
4. Verify tags and contexts are present

---

## Final Verification Checklist

**CRITICAL: Verify ALL items before marking Phase 5 complete**

### Configuration & Setup
- [ ] **🚨 MANDATORY**: Sentry Config Package loaded FIRST
- [ ] **🚨 MANDATORY**: `initSentry()` function defined BEFORE SDK script tags
- [ ] **🚨 MANDATORY**: Three Sentry scripts loaded (bundle.tracing.replay.feedback, captureconsole, browserprofiling)
- [ ] **🚨 MANDATORY**: `window.addEventListener('load', initSentry)` called after script tags
- [ ] **🚨 MANDATORY**: `Sentry.browserProfilingIntegration()` added to integrations array
- [ ] **🚨 MANDATORY**: `captureConsoleIntegration({ levels: ["error"] })` added to integrations array
- [ ] **🚨 MANDATORY**: `networkDetailAllowUrls` configured in replayIntegration (mathai.ai, homeworkapp.ai)
- [ ] Feature flags set: `enabled: true`, `enableReplay: true`, `replaySampleRate: 1.0`

### DSN Configuration
- [ ] **🚨 MANDATORY**: DSN is EXACTLY: `https://c1b3e2cdf3a24bfba22373d9dbb871d7@o503779.ingest.us.sentry.io/4505480900771840`
- [ ] **🚨 MANDATORY**: NOT using placeholder DSN containing `examplePublicKey`
- [ ] **🚨 MANDATORY**: NOT using placeholder DSN containing `o0.ingest`
- [ ] DSN is hardcoded (not from user input or config file)

### Noise Filtering
- [ ] **🚨 MANDATORY**: `ignoredErrors` array includes pre-filled values:
  - `'ResizeObserver loop limit exceeded'`
  - `'ResizeObserver loop completed with undelivered notifications'`
  - `'Non-Error promise rejection captured'`
  - `'Script error.'`
  - `'Load failed'`
- [ ] **🚨 MANDATORY**: `ignoreReplay` array includes pre-filled values:
  - `'Audio autoplay prevented'`
  - `'ResizeObserver'`
  - `'Network request failed'`
- [ ] `beforeSend()` hook filters errors using `ignoredErrors` array
- [ ] `beforeErrorSampling()` hook filters replays using `ignoreReplay` array

### Asset Error Tracking
- [ ] **🚨 MANDATORY**: `trackAssetError()` helper function defined
- [ ] **🚨 MANDATORY**: `document.querySelectorAll('img')` with error handlers
- [ ] **🚨 MANDATORY**: `document.querySelectorAll('video')` with error handlers (both video and source elements)
- [ ] **🚨 MANDATORY**: `document.querySelectorAll('audio')` with error handlers
- [ ] Failed assets hidden (`display: none`) to prevent broken UI
- [ ] Asset URLs included in error extra data (use `video.currentSrc` for videos)
- [ ] FeedbackManager audio preload wrapped in try-catch

### Error Handlers
- [ ] Global `window.addEventListener('error')` handler added
- [ ] Global `window.addEventListener('unhandledrejection')` handler added
- [ ] Both handlers call `Sentry.captureException()`
- [ ] Both handlers include appropriate tags

### Package Loading
- [ ] `waitForPackages()` includes timeout (10 seconds)
- [ ] `waitForPackages()` wrapped in try-catch
- [ ] Package loading timeout errors captured
- [ ] Breadcrumb added on successful package load
- [ ] Package states included in error context

### Initialization
- [ ] DOMContentLoaded callback is `async`
- [ ] `await waitForPackages()` called before other code
- [ ] Breadcrumb added on DOMContentLoaded
- [ ] `FeedbackManager.init()` wrapped in try-catch
- [ ] Breadcrumb added after FeedbackManager initialization
- [ ] Initialization failures captured with tags

### Testing
- [ ] Sentry initializes without errors in console
- [ ] Console shows: `✅ Sentry initialized`
- [ ] Console shows: `✅ All packages loaded`
- [ ] No `❌ Sentry SDK failed to load` error
- [ ] No placeholder DSN warnings
- [ ] Test error appears in Sentry dashboard
- [ ] Console errors captured in Sentry (test: `console.error('Test error')` → appears in dashboard)
- [ ] Node profiling active (check Sentry Performance tab)

### Common Mistakes to Avoid
- [ ] **✅ VERIFIED**: No `integrity` attribute on SDK script tag (causes loading failures)
- [ ] **✅ VERIFIED**: Not using `Sentry.init()` directly in script (must use `initSentry()` function)
- [ ] **✅ VERIFIED**: Not calling Sentry functions before SDK loads (must wait for `onload`)
- [ ] **✅ VERIFIED**: Not using placeholder DSN (must use hardcoded production DSN)
- [ ] **✅ VERIFIED**: `ignoredErrors` and `ignoreReplay` have actual values (not just comments)

## Reference

For detailed documentation, see: [../../reference/sentry-integration.md](../../reference/sentry-integration.md)
