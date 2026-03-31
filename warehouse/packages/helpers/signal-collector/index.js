/**
 * SignalCollector v3.0.0 - Raw signal capture layer for MathAI games
 *
 * Captures every atomic user interaction (clicks, taps, drags, keystrokes, touch)
 * and flushes them reliably to GCS via a cloud function.
 *
 * Designed for iframe deployment: seal() is synchronous-first (sendBeacon),
 * pagehide handles iframe destruction safety net.
 *
 * Usage:
 * const collector = new SignalCollector({
 *   containerSelector: '.game-play-area',
 *   sessionId: 'ses_123',
 *   studentId: 'stu_456',
 *   flushUrl: 'https://your-cloud-function/flush'
 * });
 * collector.startFlushing();
 * // ... user interacts ...
 * const result = collector.seal();
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.SignalCollector !== "undefined") {
    console.log("[SignalCollector] Already loaded, skipping duplicate execution");
    return;
  }

  // ============================================================
  // Flush thresholds
  // ============================================================
  var MIN_FLUSH_SIZE = 10;      // Don't flush fewer than this many events...
  var MAX_FLUSH_AGE_MS = 30000; // ...unless the oldest event is older than 30s

  // ============================================================
  // Utility: Generate UUID v4
  // ============================================================
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============================================================
  // Utility: Identify event target
  // ============================================================
  function identifyTarget(element) {
    if (!element || element === document || element === window) return "document";
    if (element.dataset && element.dataset.signalId) return element.dataset.signalId;
    if (element.id) return "#" + element.id;
    if (element.className && typeof element.className === "string") {
      var cls = element.className.trim().split(/\s+/).slice(0, 2).join(".");
      var tag = element.tagName ? element.tagName.toLowerCase() : "unknown";
      return tag + (cls ? "." + cls : "");
    }
    return element.tagName ? element.tagName.toLowerCase() : "unknown";
  }

  // ============================================================
  // Utility: Capture element context (text content + data attributes)
  // ============================================================
  function captureTargetContext(element) {
    if (!element || element === document || element === window) return null;

    var textContent = null;
    if (element.textContent) {
      var trimmed = element.textContent.trim();
      if (trimmed.length > 0) {
        textContent = trimmed.length <= 100 ? trimmed : trimmed.substring(0, 100);
      }
    }

    var dataAttrs = null;
    if (element.dataset) {
      var keys = Object.keys(element.dataset);
      if (keys.length > 0) {
        dataAttrs = {};
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] !== "signalId") {
            dataAttrs[keys[i]] = element.dataset[keys[i]];
          }
        }
        if (Object.keys(dataAttrs).length === 0) dataAttrs = null;
      }
    }

    if (!textContent && !dataAttrs) return null;
    return { text_content: textContent, data_attrs: dataAttrs };
  }

  // ============================================================
  // Utility: Get device context (computed once)
  // ============================================================
  function getDeviceContext() {
    var touchPoints = navigator.maxTouchPoints || 0;
    var isTouch = "ontouchstart" in window || touchPoints > 0;
    var isMobile = isTouch && window.innerWidth <= 1024;
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || "unknown";
    return {
      device_type: isMobile ? "mobile" : (isTouch ? "tablet" : "desktop"),
      is_mobile: isMobile,
      screen_size: window.innerWidth + "x" + window.innerHeight,
      input_method: isTouch ? "touch" : "mouse",
      orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
      pixel_ratio: window.devicePixelRatio || 1,
      touch_points: touchPoints,
      platform: platform
    };
  }

  // ============================================================
  // SignalCollector Constructor
  // ============================================================

  /**
   * @param {Object} options
   * @param {string} options.containerSelector - CSS selector for event delegation (default: 'body')
   * @param {string} options.sessionId - Session identifier
   * @param {string} options.studentId - Student identifier
   * @param {string} options.flushUrl - Cloud function URL to POST event batches to
   * @param {string} options.playId - Unique play session identifier (used for GCS deduplication)
   * @param {string} options.gameId - Game identifier
   * @param {string} options.contentSetId - Content set identifier
   */
  function SignalCollector(options) {
    options = options || {};

    this.containerSelector = options.containerSelector || "body";
    this.throttleMs = 500;
    this.sessionId = options.sessionId || null;
    this.studentId = options.studentId || null;
    this.flushIntervalMs = 5000;
    this.flushUrl = options.flushUrl || "https://asia-south1-mathai-449208.cloudfunctions.net/write-to-gcs";
    this.playId = options.playId || null;
    this.gameId = options.gameId || options.templateId || null;
    this.contentSetId = options.contentSetId || null;

    // State
    this._sessionStartMs = Date.now();
    this._events = [];             // flat array — spliced after confirmed upload
    this._batchNumber = 0;
    this._flushTimer = null;       // single setInterval handle
    this._flushInProgress = false; // prevents re-entrant concurrent flushes
    this._lastPointerMoveMs = 0;
    this._lastTouchMoveMs = 0;
    this._paused = false;
    this._sealed = false;
    this._currentView = null;
    this._deviceContext = getDeviceContext();
    this._boundHandlers = {};
    this._container = null;

    // Sentry state
    this._sentryReady = false;
    this._sentryQueue = [];
    this._emergencyCapReported = false;

    // Register unload safety handlers before attaching container listeners
    this._registerUnloadHandlers();

    // Attach container listeners
    this._attachListeners();

    // Bootstrap Sentry (async if SDK needs to be loaded)
    this._initSentry();

    console.log("[SignalCollector] Initialized v3.0.0", {
      container: this.containerSelector,
      sessionId: this.sessionId
    });
  }

  // ============================================================
  // Sentry Integration
  // ============================================================

  var SENTRY_CDN = "https://browser.sentry-cdn.com/10.23.0/bundle.min.js";
  var SENTRY_DSN_FALLBACK = "https://851dc3b10b3839ae377c888956a345aa@o503779.ingest.us.sentry.io/4510363214675968";

  SignalCollector.prototype._initSentry = function () {
    var self = this;

    // Case 1: Sentry already loaded and initialized
    if (typeof Sentry !== "undefined" && typeof Sentry.isInitialized === "function" && Sentry.isInitialized()) {
      this._onSentryReady();
      return;
    }

    // Case 2: Sentry loaded but not initialized
    if (typeof Sentry !== "undefined" && typeof Sentry.init === "function") {
      this._initSentrySDK();
      this._onSentryReady();
      return;
    }

    // Case 3: Sentry not loaded — inject script dynamically
    var script = document.createElement("script");
    script.src = SENTRY_CDN;
    script.crossOrigin = "anonymous";
    script.onload = function () {
      if (typeof Sentry !== "undefined") {
        self._initSentrySDK();
        self._onSentryReady();
      }
    };
    script.onerror = function () {
      console.warn("[SignalCollector] Failed to load Sentry SDK from CDN");
    };
    (document.head || document.documentElement).appendChild(script);
  };

  SignalCollector.prototype._initSentrySDK = function () {
    var cfg = typeof SentryConfig !== "undefined" ? SentryConfig : {};
    var dsn = cfg.dsn || SENTRY_DSN_FALLBACK;

    try {
      Sentry.init({
        dsn: dsn,
        sampleRate: cfg.sampleRate || 1.0,
        tracesSampleRate: cfg.tracesSampleRate || 0.1,
        environment: cfg.environment || "production",
        beforeSend: function (event) {
          if (typeof SentryConfig !== "undefined" && !SentryConfig.enabled) return null;
          return event;
        }
      });
    } catch (e) {
      console.warn("[SignalCollector] Sentry init failed:", e);
    }
  };

  SignalCollector.prototype._onSentryReady = function () {
    this._sentryReady = true;

    // Set scope tags
    try {
      Sentry.setTag("signal_collector_version", "3.0.0");
      if (this.gameId) Sentry.setTag("game_id", this.gameId);
      if (this.playId) Sentry.setTag("play_id", this.playId);
    } catch (e) { /* ignore */ }

    // Flush queued errors
    for (var i = 0; i < this._sentryQueue.length; i++) {
      var q = this._sentryQueue[i];
      this._captureError(q.err, q.context);
    }
    this._sentryQueue = [];
  };

  SignalCollector.prototype._captureError = function (err, context) {
    if (!this._sentryReady) {
      this._sentryQueue.push({ err: err, context: context || {} });
      return;
    }
    try {
      Sentry.captureException(err, {
        tags: { signal_collector: "3.0.0", game_id: this.gameId || "unknown", play_id: this.playId || "unknown" },
        extra: {
          session_id: this.sessionId,
          student_id: this.studentId,
          events_buffered: this._events.length,
          batch_number: this._batchNumber,
          context: context || {}
        }
      });
    } catch (e) { /* ignore */ }
  };

  SignalCollector.prototype._captureMessage = function (message, level, context) {
    if (!this._sentryReady) return;
    try {
      Sentry.captureMessage(message, {
        level: level || "warning",
        tags: { signal_collector: "3.0.0", game_id: this.gameId || "unknown", play_id: this.playId || "unknown" },
        extra: {
          session_id: this.sessionId,
          student_id: this.studentId,
          events_buffered: this._events.length,
          context: context || {}
        }
      });
    } catch (e) { /* ignore */ }
  };

  SignalCollector.prototype._addBreadcrumb = function (message, data) {
    if (!this._sentryReady) return;
    try {
      Sentry.addBreadcrumb({ category: "signal-collector", message: message, data: data || {}, level: "info" });
    } catch (e) { /* ignore */ }
  };

  // ============================================================
  // Unload Safety Handlers (registered in constructor)
  // ============================================================

  SignalCollector.prototype._registerUnloadHandlers = function () {
    var self = this;

    // pagehide: primary safety net — fires when iframe is removed from DOM,
    // tab closed, or navigate away. Works on iOS Safari + Android Chrome.
    this._addListener(window, "pagehide", function () {
      self._sendBeaconAll();
    });

    // beforeunload: desktop fallback (unreliable on mobile)
    this._addListener(window, "beforeunload", function () {
      self._sendBeaconAll();
    });

    // visibilitychange: page backgrounded but not destroyed — network still alive,
    // trigger a fetch-based flush. Does NOT fire on iframe DOM removal (pagehide handles that).
    this._addListener(document, "visibilitychange", function () {
      if (document.hidden && !self._sealed) {
        self._flush();
      }
    });
  };

  /**
   * Split all unflushed events into 50-event chunks and sendBeacon each chunk.
   * Called synchronously from pagehide/beforeunload — must be fast and synchronous.
   * sendBeacon survives iframe destruction; fetch does not.
   */
  SignalCollector.prototype._sendBeaconAll = function () {
    if (!this.flushUrl || this._events.length === 0) return;

    var CHUNK = 50;
    var i = 0;
    while (i < this._events.length) {
      var chunk = this._events.slice(i, i + CHUNK);
      i += CHUNK;
      this._batchNumber++;

      var payload = this._buildPayload(chunk);
      var body = JSON.stringify(payload);

      var sent = false;
      try {
        sent = navigator.sendBeacon(this.flushUrl, new Blob([body], { type: "application/json" }));
      } catch (e) {
        sent = false;
      }

      if (!sent) {
        // sendBeacon rejected (quota exceeded, browser policy) — fall back to postMessage
        this._captureMessage("[SignalCollector] sendBeacon rejected", "warning", {
          chunk_events: chunk.length,
          total_events: this._events.length
        });
        try {
          window.parent.postMessage({
            type: "signal_collector_fallback",
            payload: payload
          }, "*");
        } catch (e2) {
          // postMessage also failed — data may be lost
          this._captureError(e2, { reason: "sendBeacon and postMessage both failed", chunk_events: chunk.length });
        }
      }
    }
  };

  // ============================================================
  // Event Listener Management
  // ============================================================

  SignalCollector.prototype._attachListeners = function () {
    var self = this;

    // Find container (retry with fallbacks)
    var selectors = [this.containerSelector, "#app", ".game-canvas", "body"];
    for (var i = 0; i < selectors.length; i++) {
      this._container = document.querySelector(selectors[i]);
      if (this._container) break;
    }

    if (!this._container) {
      console.warn("[SignalCollector] No container found, using document.body");
      this._container = document.body;
      this._captureMessage("[SignalCollector] No container found", "warning", { selectors: selectors });
    }

    // Pointer events (covers mouse + stylus)
    var pointerEvents = ["pointerdown", "pointerup"];
    for (var j = 0; j < pointerEvents.length; j++) {
      (function (evtType) {
        self._addListener(self._container, evtType, function (e) {
          self._handlePointerEvent(e);
        }, { passive: true });
      })(pointerEvents[j]);
    }

    // Throttled pointermove
    this._addListener(this._container, "pointermove", function (e) {
      var now = Date.now();
      if (now - self._lastPointerMoveMs >= self.throttleMs) {
        self._lastPointerMoveMs = now;
        self._handlePointerEvent(e);
      }
    }, { passive: true });

    // Touch events — raw multi-touch data (complements pointer events)
    var touchEvents = ["touchstart", "touchend", "touchcancel"];
    for (var t = 0; t < touchEvents.length; t++) {
      (function (evtType) {
        self._addListener(self._container, evtType, function (e) {
          self._handleTouchEvent(e);
        }, { passive: true });
      })(touchEvents[t]);
    }

    // Throttled touchmove
    this._addListener(this._container, "touchmove", function (e) {
      var now = Date.now();
      if (now - self._lastTouchMoveMs >= self.throttleMs) {
        self._lastTouchMoveMs = now;
        self._handleTouchEvent(e);
      }
    }, { passive: true });

    // Keyboard events (on document for inputs anywhere)
    this._addListener(document, "keydown", function (e) {
      self._handleKeyboardEvent(e);
    }, { passive: true });

    this._addListener(document, "keyup", function (e) {
      self._handleKeyboardEvent(e);
    }, { passive: true });

    // Input/change events (value changes)
    this._addListener(this._container, "input", function (e) {
      self._handleInputEvent(e);
    }, { passive: true });

    this._addListener(this._container, "change", function (e) {
      self._handleInputEvent(e);
    }, { passive: true });

    // Focus/blur
    this._addListener(this._container, "focusin", function (e) {
      self._recordEvent("focus", e.target, {});
    }, { passive: true });

    this._addListener(this._container, "focusout", function (e) {
      self._recordEvent("blur", e.target, {});
    }, { passive: true });

    // Drag events
    var dragEvents = ["dragstart", "dragend", "drop"];
    for (var k = 0; k < dragEvents.length; k++) {
      (function (evtType) {
        self._addListener(self._container, evtType, function (e) {
          self._recordEvent(evtType, e.target, {
            x: e.clientX,
            y: e.clientY
          });
        }, { passive: true });
      })(dragEvents[k]);
    }
  };

  SignalCollector.prototype._addListener = function (el, type, handler, options) {
    el.addEventListener(type, handler, options);
    if (!this._boundHandlers[type]) this._boundHandlers[type] = [];
    this._boundHandlers[type].push({ el: el, handler: handler, options: options });
  };

  SignalCollector.prototype._removeAllListeners = function () {
    var types = Object.keys(this._boundHandlers);
    for (var i = 0; i < types.length; i++) {
      var entries = this._boundHandlers[types[i]];
      for (var j = 0; j < entries.length; j++) {
        entries[j].el.removeEventListener(types[i], entries[j].handler, entries[j].options);
      }
    }
    this._boundHandlers = {};
  };

  // ============================================================
  // Event Handlers
  // ============================================================

  SignalCollector.prototype._handlePointerEvent = function (e) {
    this._recordEvent(e.type, e.target, {
      x: e.clientX,
      y: e.clientY,
      pointer_type: e.pointerType || "unknown",
      pressure: e.pressure || 0,
      button: e.button,
      scroll_x: window.scrollX || window.pageXOffset || 0,
      scroll_y: window.scrollY || window.pageYOffset || 0
    });
  };

  SignalCollector.prototype._handleTouchEvent = function (e) {
    var changedTouches = [];
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      changedTouches.push({ x: t.clientX, y: t.clientY, id: t.identifier });
    }
    this._recordEvent(e.type, e.target, {
      touches_count: e.touches.length,
      changed_touches: changedTouches,
      target_touches_count: e.targetTouches.length
    });
  };

  SignalCollector.prototype._handleKeyboardEvent = function (e) {
    var isInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    this._recordEvent(e.type, e.target, {
      key: e.key,
      key_code: e.code,
      is_modifier: e.altKey || e.ctrlKey || e.metaKey || e.shiftKey,
      is_input_field: isInput,
      is_delete: e.code === "Backspace" || e.code === "Delete"
    });
  };

  SignalCollector.prototype._handleInputEvent = function (e) {
    this._recordEvent(e.type, e.target, {
      value: e.target.value != null ? e.target.value : "",
      value_length: e.target.value ? e.target.value.length : 0,
      input_type: e.target.type || "text"
    });
  };

  // ============================================================
  // Core: Record Event
  // ============================================================

  SignalCollector.prototype._recordEvent = function (eventType, targetEl, eventData) {
    if (this._paused || this._sealed) return;

    // Emergency cap: prevent OOM during prolonged network failure
    if (this._events.length >= 10000) {
      this._events.splice(0, 1); // drop oldest
      console.warn("[SignalCollector] Emergency cap hit — dropping oldest event");
      if (!this._emergencyCapReported) {
        this._emergencyCapReported = true;
        this._captureMessage("[SignalCollector] Emergency cap hit — 10,000 events buffered, dropping oldest", "warning");
      }
    }

    var now = Date.now();
    var event = {
      event_id: uuid(),
      student_id: this.studentId,
      session_id: this.sessionId,
      template_id: this.gameId,
      timestamp_ms: now,
      session_elapsed_ms: now - this._sessionStartMs,
      event_type: eventType,
      event_target: identifyTarget(targetEl),
      target_context: captureTargetContext(targetEl),
      event_data: eventData,
      view_context: this._currentView,
      device_context: this._deviceContext
    };

    this._events.push(event);
  };

  // ============================================================
  // Backward Compatibility Stubs (no-ops — legacy callers safe)
  // ============================================================

  SignalCollector.prototype.startProblem = function () {};
  SignalCollector.prototype.endProblem = function () { return null; };
  SignalCollector.prototype.updateCurrentAnswer = function () {};
  SignalCollector.prototype.markReviewing = function () {};
  SignalCollector.prototype.recordScratchWork = function () {};
  SignalCollector.prototype.recordScratchErasure = function () {};
  SignalCollector.prototype.recordScaffoldUse = function () {};
  SignalCollector.prototype.requestHelp = function () {};
  SignalCollector.prototype.getProblemSignals = function () { return null; };
  SignalCollector.prototype.getAllProblemSignals = function () { return {}; };

  // ============================================================
  // Custom Events
  // ============================================================

  SignalCollector.prototype.recordCustomEvent = function (type, data) {
    if (this._sealed) return;
    this._recordEvent("custom:" + type, document.body, data || {});
  };

  // ============================================================
  // View Events — record what the student SEES
  // ============================================================

  /**
   * Record a visual state change event.
   * Call this every time the UI changes what the student sees:
   * screen transitions, content renders, feedback display, etc.
   *
   * @param {string} viewType - Category: 'screen_transition' | 'content_render' |
   *   'feedback_display' | 'component_state' | 'overlay_toggle' | 'visual_update'
   * @param {Object} viewData - View-specific data
   */
  SignalCollector.prototype.recordViewEvent = function (viewType, viewData) {
    if (this._sealed) { console.warn("[SignalCollector] Sealed — cannot recordViewEvent"); return; }
    viewData = viewData || {};
    this._currentView = {
      screen: viewData.screen || null,
      content_snapshot: viewData.content_snapshot || null,
      components: viewData.components || null,
      timestamp_ms: Date.now()
    };
    this._recordEvent("view:" + viewType, document.body, viewData);
  };

  SignalCollector.prototype.getCurrentView = function () {
    return this._currentView ? Object.assign({}, this._currentView) : null;
  };

  // ============================================================
  // Data Access
  // ============================================================

  SignalCollector.prototype.getInputEvents = function () {
    return this._events.slice();
  };

  SignalCollector.prototype.getMetadata = function () {
    return {
      collector_version: "3.0.0",
      session_id: this.sessionId,
      student_id: this.studentId,
      play_id: this.playId,
      game_id: this.gameId,
      content_set_id: this.contentSetId,
      session_start_ms: this._sessionStartMs,
      total_events_captured: this._events.length,
      batch_number: this._batchNumber,
      device_context: this._deviceContext
    };
  };

  // ============================================================
  // Batch Flushing
  // ============================================================

  SignalCollector.prototype.startFlushing = function () {
    if (this._flushTimer) return; // single interval guarantee
    if (this._sealed) return;
    if (!this.flushUrl) {
      console.warn("[SignalCollector] No flushUrl configured, flushing disabled");
      return;
    }

    var self = this;
    this._flushTimer = setInterval(function () {
      self._flush();
    }, this.flushIntervalMs);

    this._addBreadcrumb("flush_started", { interval_ms: this.flushIntervalMs });
    console.log("[SignalCollector] Flushing started — interval " + this.flushIntervalMs + "ms");
  };

  SignalCollector.prototype.stopFlushing = function () {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
      console.log("[SignalCollector] Flushing stopped");
    }
  };

  /**
   * Build a batch payload from an array of events.
   */
  SignalCollector.prototype._buildPayload = function (events) {
    this._batchNumber++;
    var gcsPath = "signal-events/" +
      (this.studentId || "unknown") + "/" +
      (this.sessionId || "unknown") + "/" +
      (this.gameId || "unknown") + "/" +
      (this.contentSetId || "unknown") + "/" +
      (this.playId || "unknown") + "/" +
      "batch-" + this._batchNumber + ".json";

    return {
      path: gcsPath,
      data: {
        batch_number: this._batchNumber,
        session_id: this.sessionId,
        student_id: this.studentId,
        game_id: this.gameId,
        content_set_id: this.contentSetId,
        play_id: this.playId,
        events: events,
        event_count: events.length,
        flushed_at: Date.now()
      }
    };
  };

  /**
   * Flush up to 200 events to GCS with retry and splice-on-success.
   * _flushInProgress prevents re-entrant concurrent calls.
   * After a successful chunk, calls itself directly to drain remaining backlog.
   */
  SignalCollector.prototype._flush = function () {
    if (this._flushInProgress) return;
    if (!this.flushUrl) return;

    var CHUNK = 200;
    var chunk = this._events.slice(0, CHUNK);
    if (chunk.length === 0) return;

    // Skip flush if below minimum batch size and oldest event is recent
    if (chunk.length < MIN_FLUSH_SIZE) {
      var oldestAge = Date.now() - this._events[0].timestamp_ms;
      if (oldestAge < MAX_FLUSH_AGE_MS) {
        return;
      }
    }

    this._flushInProgress = true;
    var self = this;
    var chunkSize = chunk.length;
    var payload = this._buildPayload(chunk);

    function attempt(retryCount) {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 10000);

      fetch(self.flushUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).then(function (response) {
        clearTimeout(timeoutId);
        if (response.ok) {
          // Success — remove uploaded events from memory
          self._events.splice(0, chunkSize);
          self._flushInProgress = false;
          self._addBreadcrumb("flush_success", { batch_number: payload.data.batch_number, event_count: chunkSize });
          console.log("[SignalCollector] Flushed batch #" + payload.data.batch_number + " — " + chunkSize + " events");
          // Drain remaining backlog without waiting for next interval
          if (self._events.length > 0) {
            self._flush();
          }
        } else {
          handleFailure(retryCount, "HTTP " + response.status);
        }
      }).catch(function (err) {
        clearTimeout(timeoutId);
        handleFailure(retryCount, err && err.message ? err.message : "network error");
      });
    }

    function handleFailure(retryCount, reason) {
      if (retryCount < 3) {
        var delay = 1000 * Math.pow(2, retryCount);
        console.warn("[SignalCollector] Flush failed (" + reason + "), retry " + (retryCount + 1) + " in " + delay + "ms");
        setTimeout(function () { attempt(retryCount + 1); }, delay);
      } else {
        console.error("[SignalCollector] Flush failed after 3 retries — will retry on next interval");
        self._captureError(new Error("Flush failed after 3 retries: " + reason), {
          batch_number: payload.data.batch_number,
          chunk_size: chunkSize,
          events_remaining: self._events.length
        });
        self._flushInProgress = false;
      }
    }

    attempt(0);
  };

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Seal the collector — synchronous-first dual-track flush.
   *
   * 1. Stops interval, sets _sealed = true
   * 2. Immediately calls sendBeacon in 50-event chunks (survives iframe destruction)
   * 3. Also attempts fetch with retry in background (bonus path if iframe survives)
   * 4. Detaches all listeners
   * 5. Returns synchronously: { event_count, metadata }
   *
   * Idempotent: second call is a no-op.
   */
  SignalCollector.prototype.seal = function () {
    if (this._sealed) return { event_count: this._events.length, metadata: this.getMetadata() };

    this.stopFlushing();
    this._sealed = true;

    var eventCount = this._events.length;
    this._addBreadcrumb("seal", { event_count: eventCount });

    // Synchronous path: sendBeacon chunked (50 events, ~30KB each)
    // Fires immediately — survives iframe destruction
    this._sendBeaconAll();

    // Async bonus path: fetch with retry (confirmed delivery if iframe survives)
    if (this._events.length > 0 && this.flushUrl) {
      this._sealed = false; // temporarily re-open to allow _flush to run
      this._flush();
      this._sealed = true;
    }

    this._removeAllListeners();

    console.log("[SignalCollector] Sealed — " + eventCount + " events");
    return { event_count: eventCount, metadata: this.getMetadata() };
  };

  /** Pause signal collection */
  SignalCollector.prototype.pause = function () {
    this._paused = true;
    console.log("[SignalCollector] Paused");
  };

  /** Resume signal collection */
  SignalCollector.prototype.resume = function () {
    this._paused = false;
    console.log("[SignalCollector] Resumed");
  };

  // ============================================================
  // Debug Helpers
  // ============================================================

  SignalCollector.prototype.debug = function () {
    var summary = {
      metadata: this.getMetadata(),
      paused: this._paused,
      sealed: this._sealed,
      flush_in_progress: this._flushInProgress,
      last_5_events: this._events.slice(-5).map(function (e) {
        return {
          type: e.event_type,
          target: e.event_target,
          time: new Date(e.timestamp_ms).toISOString()
        };
      })
    };
    console.log("[SignalCollector] Debug:", JSON.stringify(summary, null, 2));
    return summary;
  };

  // ============================================================
  // Expose globally
  // ============================================================
  window.SignalCollector = SignalCollector;

  console.log("[SignalCollector] Loaded successfully (v3.0.0)");

})(window);
