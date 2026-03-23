(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.AnalyticsManager !== "undefined") {
    console.log("[AnalyticsManager] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * Load analytics config if not already loaded
   * Returns a Promise that resolves when config is loaded
   */
  function loadConfig() {
    if (window.AnalyticsConfig) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      var configPath = (function () {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
          var src = scripts[i].src;
          if (src && src.includes("analytics") && src.includes("index.js")) {
            return src.replace("index.js", "config.js");
          }
        }
        return "./config.js";
      })();

      script.src = configPath;
      script.async = false;

      script.onload = function () {
        if (window.AnalyticsConfig) {
          console.log("[AnalyticsManager] Config loaded from:", configPath);
          resolve();
        } else {
          var err = new Error("[AnalyticsManager] config.js loaded but AnalyticsConfig not set");
          console.error(err.message);
          reject(err);
        }
      };

      script.onerror = function () {
        var err = new Error("[AnalyticsManager] Failed to load config from: " + configPath);
        console.error(err.message);
        reject(err);
      };

      document.head.appendChild(script);
      console.log("[AnalyticsManager] Loading config from:", configPath);
    });
  }

  // Start config loading (AnalyticsManager constructor will wait for it if needed)
  var configLoadPromise = loadConfig();

  /**
   * AnalyticsManager - Universal Analytics Integration
   * Supports Mixpanel, Amplitude, and CleverTap with Sentry error tracking
   */
  class AnalyticsManager {
    constructor() {
      // Read configuration from window.AnalyticsConfig
      const config = window.AnalyticsConfig || {};

      this.credentials = config.credentials || {};
      this.platforms = config.platforms || [];
      this.shouldSendToPlatform = config.shouldSendToPlatform || (() => true);
      this.region = config.region || "unknown";
      this.sentryEnabled = (config.sentry && config.sentry.enabled) || false;

      // Platform detection
      this.mathai_platform = this._detectPlatform();

      // SDK loaded flags
      this.mixpanelLoaded = false;
      this.amplitudeLoaded = false;
      this.cleverTapLoaded = false;

      // Fallback mode — when all SDKs fail, use server-side API
      this.fallbackMode = false;
      this.fallbackUrl = config.fallbackUrl || "https://asia-south1-mathai-449208.cloudfunctions.net/analyticsFallback";

      // Store current user context
      this.currentUserId = null;
      this.currentTraits = null;

      console.log("[AnalyticsManager] Initialized", {
        platforms: this.platforms,
        region: this.region,
        mathai_platform: this.mathai_platform
      });
    }

    /**
     * Initialize all enabled SDKs
     * Waits for config to load, then initializes each SDK with retry logic
     */
    async init() {
      console.log("[AnalyticsManager] Starting SDK initialization...");

      // Wait for config to finish loading if it hasn't yet
      try {
        await configLoadPromise;
        // Re-read config now that it's loaded
        var config = window.AnalyticsConfig || {};
        this.credentials = config.credentials || {};
        this.platforms = config.platforms || [];
        this.shouldSendToPlatform =
          config.shouldSendToPlatform ||
          function () {
            return true;
          };
        this.region = config.region || "unknown";
        this.sentryEnabled = (config.sentry && config.sentry.enabled) || false;
        this.fallbackUrl = config.fallbackUrl || this.fallbackUrl;
        console.log("[AnalyticsManager] Config applied:", { platforms: this.platforms, region: this.region });
      } catch (configError) {
        console.error("[AnalyticsManager] Config load failed, using defaults:", configError);
        this._captureError(configError, "init_config", {});
      }

      const loadPromises = [];

      if (this._isPlatformEnabled("MIXPANEL")) {
        loadPromises.push(this._loadWithRetry(() => this._loadMixpanel(), "Mixpanel"));
      }

      if (this._isPlatformEnabled("AMPLITUDE")) {
        loadPromises.push(this._loadWithRetry(() => this._loadAmplitude(), "Amplitude"));
      }

      if (this._isPlatformEnabled("CLEVERTAP")) {
        loadPromises.push(this._loadWithRetry(() => this._loadCleverTap(), "CleverTap"));
      }

      try {
        const results = await Promise.allSettled(loadPromises);

        const successful = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;

        if (successful > 0) {
          console.log(`[AnalyticsManager] ${successful} SDK(s) loaded successfully`);
          if (failed > 0) {
            console.warn(`[AnalyticsManager] ${failed} SDK(s) failed to load`);
          }
        } else if (loadPromises.length > 0) {
          var allFailedError = new Error("[AnalyticsManager] All SDKs failed to load");
          console.error(allFailedError.message);
          this._captureError(allFailedError, "init_all_failed", {
            platforms: this.platforms,
            results: results.map(function (r) {
              return { status: r.status, reason: r.reason ? r.reason.message : undefined };
            })
          });

          // Enable server-side fallback
          if (this.fallbackUrl) {
            this.fallbackMode = true;
            console.log("[AnalyticsManager] Fallback mode enabled — events will be sent via server API");
          }
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error loading SDKs:", error);
        this._captureError(error, "init", { platforms: this.platforms });
      }
    }

    /**
     * Retry wrapper — attempts loadFn up to 3 times with exponential backoff
     * @param {Function} loadFn - Async function that loads an SDK
     * @param {string} sdkName - SDK name for logging
     * @returns {Promise}
     */
    async _loadWithRetry(loadFn, sdkName) {
      var maxAttempts = 3;
      var lastError = null;

      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await loadFn();
          return; // Success
        } catch (error) {
          lastError = error;
          console.warn("[AnalyticsManager] " + sdkName + " load attempt " + attempt + "/" + maxAttempts + " failed:", error.message);

          if (attempt < maxAttempts) {
            // Exponential backoff: 1s, 2s
            var delay = attempt * 1000;
            await new Promise(function (resolve) {
              setTimeout(resolve, delay);
            });
          }
        }
      }

      // All retries exhausted
      this._captureError(lastError, "_loadWithRetry", { sdkName: sdkName, attempts: maxAttempts });
      throw lastError;
    }

    /**
     * Identify user across all platforms
     * @param {object} traits - User traits (must include id)
     */
    identify(traits = {}) {
      console.log("[AnalyticsManager] Identifying user:", traits);

      if (!traits.id) {
        console.error("[AnalyticsManager] Error: id is required for identify");
        return;
      }

      this.currentTraits = traits;

      const distinctId = this._getDistinctId(traits);

      // Add profile_id_with_region to all identify calls
      const enrichedTraits = {
        profile_id: traits.id,
        profile_id_with_region: `${traits.id}_${this.region}`,
        region: this.region,
        mathai_platform: this.mathai_platform,
        ...traits
      };

      // Use server-side fallback if all client SDKs failed
      if (this.fallbackMode) {
        this._sendFallback("identify", { distinct_id: distinctId, traits: enrichedTraits });
        return;
      }

      try {
        if (this.mixpanelLoaded && this._isPlatformEnabled("MIXPANEL")) {
          this._identifyMixpanel(distinctId, enrichedTraits);
        }

        if (this.amplitudeLoaded && this._isPlatformEnabled("AMPLITUDE")) {
          this._identifyAmplitude(distinctId, enrichedTraits);
        }

        if (this.cleverTapLoaded && this._isPlatformEnabled("CLEVERTAP")) {
          this._identifyCleverTap(distinctId, enrichedTraits);
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error identifying user:", error);
        this._captureError(error, "identify", { traits });
      }
    }

    /**
     * Track event across all platforms
     * @param {string} event - Event name
     * @param {object} properties - Event properties
     */
    track(event, properties = {}) {
      console.log("[AnalyticsManager] Tracking event:", event, properties);

      // Auto-enrichment
      const enrichedProps = {
        harness: true,
        mathai_platform: this.mathai_platform,
        region: this.region,
        current_href: window.location.href,
        ...properties
      };

      // Use server-side fallback if all client SDKs failed
      if (this.fallbackMode) {
        var distinctId = this.currentTraits ? this._getDistinctId(this.currentTraits) : null;
        this._sendFallback("track", { event: event, properties: enrichedProps, distinct_id: distinctId });
        return;
      }

      try {
        if (this.mixpanelLoaded && this._isPlatformEnabled("MIXPANEL") && this._shouldSendTo("MIXPANEL", event)) {
          this._trackMixpanel(event, enrichedProps);
        }

        if (this.amplitudeLoaded && this._isPlatformEnabled("AMPLITUDE") && this._shouldSendTo("AMPLITUDE", event)) {
          this._trackAmplitude(event, enrichedProps);
        }

        if (this.cleverTapLoaded && this._isPlatformEnabled("CLEVERTAP") && this._shouldSendTo("CLEVERTAP", event)) {
          this._trackCleverTap(event, enrichedProps);
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error tracking event:", error);
        this._captureError(error, "track", { event, properties });
      }
    }

    /**
     * Reset all platforms (logout)
     */
    reset() {
      console.log("[AnalyticsManager] Resetting all platforms");

      this.currentUserId = null;
      this.currentTraits = null;

      try {
        if (this.mixpanelLoaded && window.mixpanel) {
          window.mixpanel.reset();
          console.log("[AnalyticsManager] Mixpanel reset");
        }

        if (this.amplitudeLoaded && window.amplitude) {
          window.amplitude.reset();
          console.log("[AnalyticsManager] Amplitude reset");
        }

        if (this.cleverTapLoaded && window.clevertap) {
          window.clevertap.logout();
          console.log("[AnalyticsManager] CleverTap logout");
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error resetting platforms:", error);
        this._captureError(error, "reset", {});
      }
    }

    /**
     * Append value to user trait array across all platforms
     * @param {string} key - Property key to append to
     * @param {any} value - Value to append
     */
    appendToUserTraits(key, value) {
      console.log("[AnalyticsManager] Appending to user traits:", key, value);

      if (!key) {
        console.error("[AnalyticsManager] Error: key is required for appendToUserTraits");
        return;
      }

      try {
        // Mixpanel append
        if (this.mixpanelLoaded && window.mixpanel && window.mixpanel.people) {
          window.mixpanel.people.append(key, value);
          console.log("[AnalyticsManager] Mixpanel append:", key, value);
        }

        // Amplitude append
        if (this.amplitudeLoaded && window.amplitude && this._isPlatformEnabled("AMPLITUDE")) {
          const identifyObj = new window.amplitude.Identify().append(key, value);
          window.amplitude.identify(identifyObj);
          console.log("[AnalyticsManager] Amplitude append:", key, value);
        }

        // CleverTap append (addMultiValueForKey)
        if (this.cleverTapLoaded && window.clevertap && this._isPlatformEnabled("CLEVERTAP")) {
          // Use addMultiValueForKey to append without overwriting
          if (typeof window.clevertap.addMultiValueForKey === "function") {
            window.clevertap.addMultiValueForKey(key, value);
            console.log("[AnalyticsManager] CleverTap append:", key, value);
          } else {
            console.warn("[AnalyticsManager] CleverTap addMultiValueForKey not available");
          }
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error appending to user traits:", error);
        this._captureError(error, "appendToUserTraits", { key, value });
      }
    }

    /**
     * Check if event should be sent to platform (skip list logic)
     * @param {string} platform - Platform name
     * @param {string} event - Event name
     * @returns {boolean}
     */
    _shouldSendTo(platform, event) {
      try {
        return this.shouldSendToPlatform(platform, event);
      } catch (error) {
        console.error("[AnalyticsManager] Error in shouldSendToPlatform:", error);
        return true; // Default to sending if check fails
      }
    }

    /**
     * Check if platform is enabled
     * @param {string} platform - Platform name
     * @returns {boolean}
     */
    _isPlatformEnabled(platform) {
      return this.platforms.includes(platform);
    }

    /**
     * Generate distinct_id with three fallback levels
     * @param {object} traits - User traits (must include id)
     * @returns {string}
     */
    _getDistinctId(traits = {}) {
      // Priority 1: traits.distinct_id (if provided)
      if (traits.distinct_id) {
        return traits.distinct_id;
      }

      // Priority 2: {mobile}_{name_lowercase}_{id} (if all present)
      if (traits.mobile && traits.name && traits.id) {
        const nameLowercase = String(traits.name).toLowerCase().replace(/\s+/g, "_");
        return `${traits.mobile}_${nameLowercase}_${traits.id}`;
      }

      // Priority 3: {id}_{region} (default - id is required)
      return `${traits.id}_${this.region}`;
    }

    /**
     * Detect platform (web/ios/android) from user agent
     * @returns {string}
     */
    _detectPlatform() {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;

      if (/android/i.test(userAgent)) {
        return "android";
      }

      if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "ios";
      }

      return "web";
    }

    /**
     * Capture error to Sentry (noop if disabled)
     * @param {Error} error - Error object
     * @param {string} context - Error context
     * @param {object} extra - Extra data
     */
    _captureError(error, context, extra = {}) {
      // Always try Sentry if available — sentryEnabled may be false
      // only because config itself failed to load
      if (typeof window.Sentry === "undefined") {
        return;
      }

      try {
        window.Sentry.captureException(error, {
          tags: {
            component: "AnalyticsManager",
            context: context
          },
          extra: extra
        });
      } catch (sentryError) {
        console.error("[AnalyticsManager] Failed to capture error to Sentry:", sentryError);
      }
    }

    /**
     * Load Mixpanel SDK using official loader snippet
     */
    async _loadMixpanel() {
      const creds = this.credentials.mixpanel || {};
      const token = creds.token;

      if (!token) {
        throw new Error("[AnalyticsManager] Mixpanel token not found");
      }

      try {
        // Use Mixpanel's official loader snippet pattern
        (function (f, b) {
          if (!b.__SV) {
            var e, g, i, h;
            window.mixpanel = b;
            b._i = [];
            b.init = function (e, f, c) {
              function g(a, d) {
                var b = d.split(".");
                2 == b.length && ((a = a[b[0]]), (d = b[1]));
                a[d] = function () {
                  a.push([d].concat(Array.prototype.slice.call(arguments, 0)));
                };
              }
              var a = b;
              "undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel");
              a.people = a.people || [];
              a.toString = function (a) {
                var d = "mixpanel";
                "mixpanel" !== c && (d += "." + c);
                a || (d += " (stub)");
                return d;
              };
              a.people.toString = function () {
                return a.toString(1) + ".people (stub)";
              };
              i =
                "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(
                  " "
                );
              for (h = 0; h < i.length; h++) g(a, i[h]);
              var j = "set set_once union unset remove delete".split(" ");
              a.get_group = function () {
                function b(c) {
                  d[c] = function () {
                    call2_args = arguments;
                    call2 = [c].concat(Array.prototype.slice.call(call2_args, 0));
                    a.push([e, call2]);
                  };
                }
                for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]);
                return d;
              };
              b._i.push([e, f, c]);
            };
            b.__SV = 1.2;
          }
        })(document, window.mixpanel || []);

        // Initialize Mixpanel
        window.mixpanel.init(token, {
          debug: false,
          track_pageview: false,
          persistence: "localStorage",
          api_host: creds.proxyUrl || undefined,
          loaded: (mixpanel) => {
            console.log("[AnalyticsManager] Mixpanel initialized via callback");
          }
        });

        // Load the full SDK
        await this._loadScript("https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js");

        // Wait a bit for SDK to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (typeof window.mixpanel !== "undefined" && window.mixpanel.__loaded !== false) {
          this.mixpanelLoaded = true;
          console.log("[AnalyticsManager] Mixpanel loaded successfully");
        } else {
          // Even if not fully loaded, the stub will queue calls
          this.mixpanelLoaded = true;
          console.log("[AnalyticsManager] Mixpanel stub ready (calls will be queued)");
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error loading Mixpanel:", error);
        throw error; // Propagate to _loadWithRetry
      }
    }

    /**
     * Load Amplitude SDK
     */
    async _loadAmplitude() {
      const creds = this.credentials.amplitude || {};
      const apiKey = creds.apiKey;

      if (!apiKey) {
        throw new Error("[AnalyticsManager] Amplitude API key not found");
      }

      try {
        await this._loadScript("https://cdn.amplitude.com/libs/analytics-browser-2.0.0-min.js.gz");
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });

        if (typeof window.amplitude !== "undefined") {
          window.amplitude.init(apiKey, {
            defaultTracking: false
          });

          this.amplitudeLoaded = true;
          console.log("[AnalyticsManager] Amplitude loaded successfully");
        } else {
          throw new Error("Amplitude SDK failed to load");
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error loading Amplitude:", error);
        throw error; // Propagate to _loadWithRetry
      }
    }

    /**
     * Load CleverTap SDK (dynamic import)
     */
    async _loadCleverTap() {
      const creds = this.credentials.clevertap || {};
      const accountId = creds.accountId;

      if (!accountId) {
        throw new Error("[AnalyticsManager] CleverTap account ID not found");
      }

      try {
        // Dynamic import for CleverTap
        if (typeof require !== "undefined") {
          const clevertap = require("clevertap-web-sdk");
          window.clevertap = clevertap;
        } else {
          // Fallback to script loading
          await this._loadScript("https://d2r1yp2w7bby2u.cloudfront.net/js/clevertap.min.js");
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });

        if (typeof window.clevertap !== "undefined") {
          window.clevertap.init(accountId, creds.region || "eu1");
          window.clevertap.privacy.push({ optOut: false });
          window.clevertap.privacy.push({ useIP: true });

          this.cleverTapLoaded = true;
          console.log("[AnalyticsManager] CleverTap loaded successfully");
        } else {
          throw new Error("CleverTap SDK failed to load");
        }
      } catch (error) {
        console.error("[AnalyticsManager] Error loading CleverTap:", error);
        throw error; // Propagate to _loadWithRetry
      }
    }

    /**
     * Identify user in Mixpanel
     */
    _identifyMixpanel(distinctId, traits) {
      try {
        window.mixpanel.identify(distinctId);
        window.mixpanel.people.set(traits);
        console.log("[AnalyticsManager] Mixpanel identify:", distinctId);
      } catch (error) {
        console.error("[AnalyticsManager] Mixpanel identify error:", error);
        this._captureError(error, "_identifyMixpanel", { distinctId, traits });
      }
    }

    /**
     * Identify user in Amplitude
     */
    _identifyAmplitude(distinctId, traits) {
      try {
        const identifyEvent = new window.amplitude.Identify();

        Object.keys(traits).forEach((key) => {
          identifyEvent.set(key, traits[key]);
        });

        window.amplitude.setUserId(distinctId);
        window.amplitude.identify(identifyEvent);

        console.log("[AnalyticsManager] Amplitude identify:", distinctId);
      } catch (error) {
        console.error("[AnalyticsManager] Amplitude identify error:", error);
        this._captureError(error, "_identifyAmplitude", { distinctId, traits });
      }
    }

    /**
     * Identify user in CleverTap
     */
    _identifyCleverTap(distinctId, traits) {
      try {
        // Format phone number (auto-prepend +91 for 10-digit numbers)
        const profile = { ...traits };

        if (profile.mobile && /^\d{10}$/.test(String(profile.mobile))) {
          profile.Phone = "+91" + profile.mobile;
        } else if (profile.mobile) {
          profile.Phone = String(profile.mobile);
        }

        // Add Identity
        profile.Identity = distinctId;

        // Flatten nested objects
        const flatProfile = this._flattenObject(profile);

        window.clevertap.onUserLogin.push({
          Site: flatProfile
        });

        console.log("[AnalyticsManager] CleverTap identify:", distinctId);
      } catch (error) {
        console.error("[AnalyticsManager] CleverTap identify error:", error);
        this._captureError(error, "_identifyCleverTap", { distinctId, traits });
      }
    }

    /**
     * Track event in Mixpanel
     */
    _trackMixpanel(event, properties) {
      try {
        window.mixpanel.track(event, properties);
        console.log("[AnalyticsManager] Mixpanel track:", event);
      } catch (error) {
        console.error("[AnalyticsManager] Mixpanel track error:", error);
        this._captureError(error, "_trackMixpanel", { event, properties });
      }
    }

    /**
     * Track event in Amplitude
     */
    _trackAmplitude(event, properties) {
      try {
        window.amplitude.track(event, properties);
        console.log("[AnalyticsManager] Amplitude track:", event);
      } catch (error) {
        console.error("[AnalyticsManager] Amplitude track error:", error);
        this._captureError(error, "_trackAmplitude", { event, properties });
      }
    }

    /**
     * Track event in CleverTap
     */
    _trackCleverTap(event, properties) {
      try {
        // Flatten nested objects for CleverTap
        const flatProps = this._flattenObject(properties);

        window.clevertap.event.push(event, flatProps);
        console.log("[AnalyticsManager] CleverTap track:", event);
      } catch (error) {
        console.error("[AnalyticsManager] CleverTap track error:", error);
        this._captureError(error, "_trackCleverTap", { event, properties });
      }
    }

    /**
     * Flatten nested objects (for CleverTap)
     * Converts nested objects to JSON strings
     * @param {object} obj - Object to flatten
     * @returns {object}
     */
    _flattenObject(obj) {
      const flattened = {};

      Object.keys(obj).forEach((key) => {
        const value = obj[key];

        if (value === null || value === undefined) {
          flattened[key] = value;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          // Convert nested object to JSON string
          try {
            flattened[key] = JSON.stringify(value);
          } catch (error) {
            flattened[key] = String(value);
          }
        } else if (Array.isArray(value)) {
          // Convert array to JSON string
          try {
            flattened[key] = JSON.stringify(value);
          } catch (error) {
            flattened[key] = String(value);
          }
        } else {
          flattened[key] = value;
        }
      });

      return flattened;
    }

    /**
     * Send analytics data via server-side fallback API
     * Uses navigator.sendBeacon for fire-and-forget, falls back to fetch
     * @param {string} action - "track" or "identify"
     * @param {object} data - Action payload
     */
    _sendFallback(action, data) {
      if (!this.fallbackUrl) return;

      var payload = JSON.stringify({ action: action, data: data });

      try {
        // Prefer sendBeacon — non-blocking, works even on page unload
        if (navigator.sendBeacon) {
          var blob = new Blob([payload], { type: "application/json" });
          var sent = navigator.sendBeacon(this.fallbackUrl, blob);
          if (sent) {
            console.log("[AnalyticsManager] Fallback sent via beacon:", action);
            return;
          }
        }

        // Fallback to fetch
        fetch(this.fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        })
          .then(function () {
            console.log("[AnalyticsManager] Fallback sent via fetch:", action);
          })
          .catch(function (err) {
            console.error("[AnalyticsManager] Fallback fetch failed:", err);
            this._captureError(err, "fallback_fetch_failed", { action: action });
          }.bind(this));
      } catch (error) {
        console.error("[AnalyticsManager] Fallback send failed:", error);
        this._captureError(error, "fallback_send_failed", { action: action });
      }
    }

    /**
     * Load external script
     * @param {string} url - Script URL
     * @returns {Promise}
     */
    _loadScript(url) {
      return new Promise((resolve, reject) => {
        // Check if script already exists and loaded successfully
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript) {
          // If it was a failed previous attempt, remove it so we can retry
          if (existingScript.dataset.failed) {
            existingScript.remove();
          } else {
            resolve();
            return;
          }
        }

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = url;
        script.async = true;

        script.onload = () => {
          console.log(`[AnalyticsManager] Script loaded: ${url}`);
          resolve();
        };

        script.onerror = (error) => {
          script.dataset.failed = "true";
          console.error(`[AnalyticsManager] Script load error: ${url}`, error);
          reject(new Error(`Failed to load script: ${url}`));
        };

        document.head.appendChild(script);
      });
    }
  }

  // Expose AnalyticsManager globally
  window.AnalyticsManager = AnalyticsManager;

  console.log("[AnalyticsManager] Class registered globally");
})(window);
