/**
 * Centralized Sentry Configuration Package
 * Version: 1.0.0
 *
 * Purpose: Provides consistent Sentry configuration across all games.
 * Update this file to update ignore lists for ALL games (old and new).
 *
 * Usage:
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/sentry-config/index.js"></script>
 * <script src="https://browser.sentry-cdn.com/8.38.0/bundle.min.js" onload="initSentry()"></script>
 */

(function () {
  'use strict';

  // Skip if already loaded
  if (typeof window.SentryConfig !== "undefined") {
    console.log("[SentryConfig] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * Centralized Sentry Configuration
   * This object is globally available as window.SentryConfig
   */
  window.SentryConfig = {
    /**
     * Package version
     * Increment when updating ignore lists or configuration
     */
    version: '1.0.0',

    /**
     * Hardcoded Sentry DSN
     * All games use this same DSN
     */
    dsn: 'https://c1b3e2cdf3a24bfba22373d9dbb871d7@o503779.ingest.us.sentry.io/4505480900771840',

    /**
     * Feature Flags
     * Control what gets captured and sent to Sentry
     */
    enabled: false, // Master switch - set to false to disable all Sentry tracking
    captureErrors: true, // Capture JavaScript errors
    captureConsoleErrors: true, // Capture console.error() calls
    captureReplay: true, // Enable session replay on errors
    captureProfiling: true, // Enable browser performance profiling

    /**
     * Sampling Rates (0.0 to 1.0)
     * Control what percentage of events are captured
     */
    sampleRate: 1.0, // 1.0 = 100% of errors captured
    replaySampleRate: 1.0, // 1.0 = 100% of error sessions get replay
    tracesSampleRate: 0.1, // 0.1 = 10% of transactions for performance monitoring

    /**
     * Environment Configuration
     */
    environment: 'production', // 'development', 'staging', 'production'

    /**
     * Network Detail Capture
     * Allowed domains for detailed network request/response capture in replays
     */
    networkDetailAllowUrls: [
      // Dynamically added: window.location.origin (current game domain)
      'https://(?:[a-zA-Z0-9-]+.)*mathai.ai/',
      'https://(?:[a-zA-Z0-9-]+.)*homeworkapp.ai/'
    ],

    /**
     * Ignored Error Patterns (Pre-configured)
     * These errors will NOT be sent to Sentry
     *
     * To add new patterns: Add to this array and re-upload to CDN
     * Browser will cache for 1 year, so changes apply on next page load
     */
    ignoredErrors: [
      // Common benign browser errors (pre-configured)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Script error.',
      'Load failed',
      'Failed to fetch'

      // Add new patterns below as needed
      // Example: 'Custom error pattern',
    ],

    /**
     * Ignored Replay Patterns (Pre-configured)
     * Session replays will NOT be captured for these error types
     *
     * To add new patterns: Add to this array and re-upload to CDN
     */
    ignoreReplay: [
      // Common errors that don't need replay (pre-configured)
      'Audio autoplay prevented',
      'ResizeObserver',
      'Network request failed'

      // Add new patterns below as needed
      // Example: 'Network timeout',
    ],

    /**
     * Check if error should be ignored
     * @param {string} errorMessage - The error message to check
     * @returns {boolean} - True if error should be ignored
     */
    shouldIgnoreError(errorMessage) {
      if (!errorMessage) return false;
      return this.ignoredErrors.some(pattern => errorMessage.includes(pattern));
    },

    /**
     * Check if replay should be skipped for this error
     * @param {string} errorMessage - The error message to check
     * @returns {boolean} - True if replay should be skipped
     */
    shouldIgnoreReplay(errorMessage) {
      if (!errorMessage) return false;
      return this.ignoreReplay.some(pattern => errorMessage.includes(pattern));
    },

    /**
     * Get network detail allow URLs with dynamic origin
     * @returns {array} - Array of URL patterns
     */
    getNetworkDetailAllowUrls() {
      return [window.location.origin, ...this.networkDetailAllowUrls];
    },

    /**
     * Get configuration summary
     * Useful for debugging
     * @returns {object} - Configuration summary
     */
    getConfig() {
      return {
        version: this.version,
        dsn: this.dsn,

        // Feature flags
        enabled: this.enabled,
        captureErrors: this.captureErrors,
        captureConsoleErrors: this.captureConsoleErrors,
        captureReplay: this.captureReplay,
        captureProfiling: this.captureProfiling,

        // Sampling rates
        sampleRate: this.sampleRate,
        replaySampleRate: this.replaySampleRate,
        tracesSampleRate: this.tracesSampleRate,

        // Environment
        environment: this.environment,

        // Network detail URLs
        networkDetailAllowUrls: this.getNetworkDetailAllowUrls(),

        // Ignore lists
        ignoredErrorCount: this.ignoredErrors.length,
        ignoreReplayCount: this.ignoreReplay.length,
        ignoredErrors: [...this.ignoredErrors],
        ignoreReplay: [...this.ignoreReplay]
      };
    },

    /**
     * Log configuration to console
     * Useful for debugging
     */
    logConfig() {
      console.group('🔧 Sentry Config Package v' + this.version);
      console.log('Enabled:', this.enabled);
      console.log('DSN:', this.dsn);
      console.log('Environment:', this.environment);

      console.group('Feature Flags');
      console.log('Capture Errors:', this.captureErrors);
      console.log('Capture Console Errors:', this.captureConsoleErrors);
      console.log('Capture Replay:', this.captureReplay);
      console.log('Capture Profiling:', this.captureProfiling);
      console.groupEnd();

      console.group('Sampling Rates');
      console.log('Sample Rate:', this.sampleRate);
      console.log('Replay Sample Rate:', this.replaySampleRate);
      console.log('Traces Sample Rate:', this.tracesSampleRate);
      console.groupEnd();

      console.group('Network Detail Allowed URLs');
      console.log(this.getNetworkDetailAllowUrls());
      console.groupEnd();

      console.group('Ignored Error Patterns (' + this.ignoredErrors.length + ')');
      console.log(this.ignoredErrors);
      console.groupEnd();

      console.group('Ignore Replay Patterns (' + this.ignoreReplay.length + ')');
      console.log(this.ignoreReplay);
      console.groupEnd();

      console.groupEnd();
    }
  };

  // Log successful loading
  console.log(`✅ Sentry Config Package v${window.SentryConfig.version} loaded`);
})();
