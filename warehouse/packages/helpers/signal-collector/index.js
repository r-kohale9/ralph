/**
 * SignalCollector - Raw signal capture layer for MathAI games
 *
 * Captures every atomic user interaction (clicks, taps, drags, keystrokes)
 * and computes problem-level signals (process, engagement, context).
 *
 * Usage:
 * const collector = new SignalCollector({
 *   containerSelector: '.game-play-area',
 *   sessionId: 'ses_123',
 *   studentId: 'stu_456'
 * });
 * collector.startProblem('q1', { text: '5 + 3' });
 * // ... user interacts ...
 * const signals = collector.endProblem('q1', { correct: true, answer: '8' });
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.SignalCollector !== "undefined") {
    console.log("[SignalCollector] Already loaded, skipping duplicate execution");
    return;
  }

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

    // Capture visible text content (trimmed, capped at 100 chars)
    var textContent = null;
    if (element.textContent) {
      var trimmed = element.textContent.trim();
      if (trimmed.length > 0) {
        textContent = trimmed.length <= 100 ? trimmed : trimmed.substring(0, 100);
      }
    }

    // Capture data-* attributes (exclude signalId, already in event_target)
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
    var isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return {
      device_type: isTouch ? "tablet" : "desktop",
      screen_size: window.innerWidth + "x" + window.innerHeight,
      input_method: isTouch ? "touch" : "mouse",
      orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
      pixel_ratio: window.devicePixelRatio || 1
    };
  }

  // ============================================================
  // SignalCollector Constructor
  // ============================================================

  /**
   * @param {Object} options
   * @param {string} options.containerSelector - CSS selector for event delegation (default: '.game-play-area')
   * @param {number} options.maxBufferSize - Max input events in ring buffer (default: 5000)
   * @param {number} options.throttleMs - (deprecated, ignored) Throttle interval is hardcoded to 500ms.
   * @param {string} options.sessionId - Session identifier
   * @param {string} options.studentId - Student identifier
   * @param {string} options.templateId - Game template identifier
   * @param {number} options.hesitationThresholdMs - Pause duration to count as hesitation (default: 3000)
   * @param {number} options.frustrationClickMs - Window for detecting rapid repeated clicks (default: 1000)
   * @param {number} options.frustrationClickCount - Clicks in window to flag frustration (default: 3)
   * @param {number} options.flushIntervalMs - (deprecated, ignored) Flush interval is hardcoded to 5000ms.
   */
  function SignalCollector(options) {
    options = options || {};

    this.containerSelector = options.containerSelector || "body";
    this.maxBufferSize = options.maxBufferSize || 5000;
    this.throttleMs = 500;
    this.sessionId = options.sessionId || null;
    this.studentId = options.studentId || null;
    this.templateId = options.templateId || null;
    this.hesitationThresholdMs = options.hesitationThresholdMs || 3000;
    this.frustrationClickMs = options.frustrationClickMs || 1000;
    this.frustrationClickCount = options.frustrationClickCount || 3;
    this.flushIntervalMs = 5000;
    this.flushUrl = options.flushUrl || null;
    this.playId = options.playId || null;
    this.gameId = options.gameId || null;
    this.contentSetId = options.contentSetId || null;

    // State
    this._sessionStartMs = Date.now();
    this._inputEvents = [];
    this._eventsTruncated = false;
    this._lastFlushedIndex = 0;
    this._batchNumber = 0;
    this._flushTimer = null;
    this._currentProblemId = null;
    this._problemStates = {}; // problemId -> { startMs, firstInteractionMs, reviewingStartMs, state, events[], outcome, scratchWork, scaffoldInteractions }
    this._completedProblems = {}; // problemId -> computed signals
    this._problemCount = 0;
    this._errorsSinceLastCorrect = 0;
    this._problemsSinceLastScaffold = 0;
    this._recentAccuracy = []; // last 5 problem outcomes for flow_indicators
    this._lastPointerMoveMs = 0;
    this._paused = false;
    this._sealed = false;
    this._sealedPayload = null;
    this._currentView = null; // Updated by recordViewEvent, attached to input events as view_context
    this._deviceContext = getDeviceContext();
    this._boundHandlers = {};
    this._container = null;

    // Attach listeners
    this._attachListeners();

    console.log("[SignalCollector] Initialized", {
      container: this.containerSelector,
      maxBuffer: this.maxBufferSize,
      sessionId: this.sessionId
    });
  }

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
    }

    // Pointer events (covers mouse + touch)
    var pointerEvents = ["pointerdown", "pointerup"];
    for (var j = 0; j < pointerEvents.length; j++) {
      this._addListener(this._container, pointerEvents[j], function (e) {
        self._handlePointerEvent(e);
      }, { passive: true });
    }

    // Throttled pointermove
    this._addListener(this._container, "pointermove", function (e) {
      var now = Date.now();
      if (now - self._lastPointerMoveMs >= self.throttleMs) {
        self._lastPointerMoveMs = now;
        self._handlePointerEvent(e);
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

    var now = Date.now();
    var problemId = this._currentProblemId;
    var problemElapsed = 0;
    var stateLabel = "idle";
    var problemStateObj = null;

    if (problemId && this._problemStates[problemId]) {
      var ps = this._problemStates[problemId];
      problemElapsed = now - ps.startMs;
      stateLabel = ps.state;

      // Transition from reading to working on first interaction
      if (ps.state === "reading" && eventType !== "focus" && eventType !== "blur") {
        ps.firstInteractionMs = now;
        ps.state = "working";
        stateLabel = "working";
      }

      // Build problem_state object matching architecture spec
      // current_answer: try target element value, or stored answer
      var currentAnswer = null;
      if (targetEl && targetEl.value != null && targetEl.value !== "") {
        currentAnswer = targetEl.value;
      } else if (ps.currentAnswer != null) {
        currentAnswer = ps.currentAnswer;
      }

      problemStateObj = {
        state: stateLabel,
        problem_text: ps.problemData.text || ps.problemData.question_text || null,
        current_answer: currentAnswer,
        scaffolds_visible: ps.problemData.scaffolds_visible || [],
        difficulty_params: ps.problemData.difficulty_params || ps.problemData.difficulty || null
      };
    }

    var event = {
      event_id: uuid(),
      student_id: this.studentId,
      session_id: this.sessionId,
      problem_id: problemId,
      template_id: this.templateId,
      timestamp_ms: now,
      session_elapsed_ms: now - this._sessionStartMs,
      problem_elapsed_ms: problemElapsed,
      event_type: eventType,
      event_target: identifyTarget(targetEl),
      target_context: captureTargetContext(targetEl),
      event_data: eventData,
      problem_state: problemStateObj || { state: stateLabel },
      view_context: this._currentView,
      device_context: this._deviceContext
    };

    // Add to ring buffer
    if (this._inputEvents.length >= this.maxBufferSize) {
      this._inputEvents.shift();
      this._eventsTruncated = true;
      // Adjust flush index since we removed the oldest event
      if (this._lastFlushedIndex > 0) {
        this._lastFlushedIndex--;
      }
    }
    this._inputEvents.push(event);

  };

  // ============================================================
  // Problem Lifecycle
  // ============================================================

  /**
   * Start tracking a new problem/question/round
   * @param {string} problemId - Unique identifier for the problem
   * @param {Object} problemData - Problem metadata (text, correct_answer, etc.)
   */
  SignalCollector.prototype.startProblem = function (problemId, problemData) {
    if (this._sealed) { console.warn("[SignalCollector] Sealed — cannot startProblem"); return; }
    this._currentProblemId = problemId;
    this._problemCount++;

    this._problemStates[problemId] = {
      startMs: Date.now(),
      firstInteractionMs: null,
      reviewingStartMs: null,
      state: "reading",
      problemData: problemData || {},
      currentAnswer: null,
      previousAnswer: null, // for self-correction tracking
      answerHistory: [],
      position: this._problemCount,
      scratchWork: {
        entries: [],
        entry_timestamps_ms: [],
        erasures: [],
        spatial_layout: []
      },
      scaffoldInteractions: {
        available: (problemData && problemData.available_scaffolds) || [],
        used: [],
        time_of_use: [],
        help_requested: false
      }
    };

    console.log("[SignalCollector] Problem started:", problemId);
  };

  /**
   * Update the current answer for the active problem
   * Useful for multi-input games (e.g., Kakuro grid) where answer is not a single input value
   * @param {any} answer - Current answer state
   */
  SignalCollector.prototype.updateCurrentAnswer = function (answer) {
    if (this._sealed) return;
    var problemId = this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      var ps = this._problemStates[problemId];
      ps.previousAnswer = ps.currentAnswer;
      ps.currentAnswer = answer;
      // Track answer changes for self-correction detection
      var answerStr = typeof answer === "object" ? JSON.stringify(answer) : String(answer);
      if (ps.answerHistory.length === 0 || ps.answerHistory[ps.answerHistory.length - 1] !== answerStr) {
        ps.answerHistory.push(answerStr);
      }
    }
  };

  /**
   * Transition problem state to "reviewing" phase
   * Call this when the student has entered an answer but hasn't submitted yet
   * @param {string} [problemId] - Problem ID (defaults to current problem)
   */
  SignalCollector.prototype.markReviewing = function (problemId) {
    if (this._sealed) return;
    problemId = problemId || this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      var ps = this._problemStates[problemId];
      if (ps.state === "working") {
        ps.state = "reviewing";
        ps.reviewingStartMs = Date.now();
      }
    }
  };

  /**
   * Record scratch work entry (e.g., intermediate calculation, drawn number)
   * @param {string} value - The scratch work value
   * @param {Object} [position] - Optional { x, y } screen position
   */
  SignalCollector.prototype.recordScratchWork = function (value, position) {
    if (this._sealed) return;
    var problemId = this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      var sw = this._problemStates[problemId].scratchWork;
      sw.entries.push(value);
      sw.entry_timestamps_ms.push(Date.now() - this._problemStates[problemId].startMs);
      if (position) {
        sw.spatial_layout.push({ value: value, position: position });
      }
    }
  };

  /**
   * Record scratch work erasure
   * @param {string} value - The erased value
   */
  SignalCollector.prototype.recordScratchErasure = function (value) {
    if (this._sealed) return;
    var problemId = this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      this._problemStates[problemId].scratchWork.erasures.push(value);
    }
  };

  /**
   * Record scaffold/tool usage (e.g., number line, hint, step decomposition)
   * @param {string} scaffoldType - Type of scaffold used
   */
  SignalCollector.prototype.recordScaffoldUse = function (scaffoldType) {
    if (this._sealed) return;
    var problemId = this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      var si = this._problemStates[problemId].scaffoldInteractions;
      si.used.push(scaffoldType);
      si.time_of_use.push(Date.now() - this._problemStates[problemId].startMs);
      this._problemsSinceLastScaffold = 0;
      this._recordEvent("custom:scaffold_used", document.body, { scaffold_type: scaffoldType });
    }
  };

  /**
   * Record that help was requested
   */
  SignalCollector.prototype.requestHelp = function () {
    if (this._sealed) return;
    var problemId = this._currentProblemId;
    if (problemId && this._problemStates[problemId]) {
      this._problemStates[problemId].scaffoldInteractions.help_requested = true;
      this._recordEvent("custom:help_requested", document.body, {});
    }
  };

  /**
   * End tracking for a problem and compute signals
   * @param {string} problemId - The problem to end
   * @param {Object} outcome - { correct: boolean, answer: any, ... }
   * @returns {Object} Computed Tier 2-4 signals
   */
  SignalCollector.prototype.endProblem = function (problemId, outcome) {
    if (this._sealed) { console.warn("[SignalCollector] Sealed — cannot endProblem"); return null; }
    var ps = this._problemStates[problemId];
    if (!ps) {
      console.warn("[SignalCollector] No problem state for:", problemId);
      return null;
    }

    ps.state = "submitted";
    ps.endMs = Date.now();
    ps.outcome = outcome || {};
    this._currentProblemId = null;

    // Track error streak
    if (outcome && outcome.correct === false) {
      this._errorsSinceLastCorrect++;
    } else if (outcome && outcome.correct === true) {
      this._errorsSinceLastCorrect = 0;
    }

    // Track scaffold distance
    this._problemsSinceLastScaffold++;

    // Track recent accuracy for flow_indicators (last 5)
    if (outcome && typeof outcome.correct === "boolean") {
      this._recentAccuracy.push(outcome.correct ? 1 : 0);
      if (this._recentAccuracy.length > 5) this._recentAccuracy.shift();
    }

    // Compute signals
    var signals = this._computeProblemSignals(problemId);
    this._completedProblems[problemId] = signals;

    console.log("[SignalCollector] Problem ended:", problemId, signals);
    return signals;
  };

  // ============================================================
  // Signal Computation (Tier 2-4)
  // ============================================================

  SignalCollector.prototype._computeProblemSignals = function (problemId) {
    var ps = this._problemStates[problemId];
    if (!ps) return null;

    var events = this._inputEvents.filter(function (e) { return e.problem_id === problemId; });
    var endMs = ps.endMs || Date.now();
    var totalTime = endMs - ps.startMs;

    // ---- Tier 2: Process ----

    var timeToFirstInteraction = ps.firstInteractionMs
      ? ps.firstInteractionMs - ps.startMs
      : totalTime;

    // Phase times: reading → working → reviewing
    var readingMs = ps.firstInteractionMs ? ps.firstInteractionMs - ps.startMs : totalTime;
    var reviewingMs = 0;
    var workingMs = 0;
    if (ps.firstInteractionMs) {
      if (ps.reviewingStartMs) {
        workingMs = ps.reviewingStartMs - ps.firstInteractionMs;
        reviewingMs = endMs - ps.reviewingStartMs;
      } else {
        workingMs = endMs - ps.firstInteractionMs;
      }
    }

    // Build interaction sequence matching spec: { action, value, time_ms }
    var interactionSequence = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.event_type === "focus" || e.event_type === "blur" || e.event_type === "pointermove") continue;

      var action = this._classifyAction(e);
      var value = this._extractActionValue(e);
      var entry = {
        action: action,
        time_ms: e.timestamp_ms - ps.startMs
      };
      if (value !== null) entry.value = value;
      interactionSequence.push(entry);
    }

    // Self-corrections: detect answer changes (before/after pairs)
    var selfCorrections = [];
    for (var sc = 0; sc < ps.answerHistory.length - 1; sc++) {
      selfCorrections.push({
        before: ps.answerHistory[sc],
        after: ps.answerHistory[sc + 1],
        change_index: sc + 1
      });
    }

    // ---- Tier 3: Engagement ----

    // Hesitation points: gaps > threshold with phase and after_action context
    var hesitationPoints = [];
    var meaningfulEvents = interactionSequence;
    for (var h = 1; h < meaningfulEvents.length; h++) {
      var gap = meaningfulEvents[h].time_ms - meaningfulEvents[h - 1].time_ms;
      if (gap > this.hesitationThresholdMs) {
        // Determine phase at time of hesitation
        var hesitationTimeMs = meaningfulEvents[h - 1].time_ms;
        var phase = "working";
        if (hesitationTimeMs < readingMs) phase = "reading";
        else if (ps.reviewingStartMs && (ps.startMs + hesitationTimeMs) >= ps.reviewingStartMs) phase = "reviewing";

        hesitationPoints.push({
          phase: phase,
          duration_ms: gap,
          after_action: meaningfulEvents[h - 1].action + (meaningfulEvents[h - 1].value ? ":" + meaningfulEvents[h - 1].value : "")
        });
      }
    }

    // Interaction velocity: { mean_time_between_actions_ms, variance_ms, trend }
    var interactionVelocity = this._computeInteractionVelocity(meaningfulEvents);

    // Frustration indicators
    var rapidRepeatedClicks = this._detectRapidClicks(events);
    var deleteCycles = this._detectDeleteCycles(events);
    var longPauses = hesitationPoints.length;

    // response_time_relative_to_baseline: ratio of this problem's total time to session average
    var avgResponseTime = this._getAverageResponseTime();
    var responseTimeRelative = avgResponseTime > 0 ? Math.round((totalTime / avgResponseTime) * 100) / 100 : null;

    // ---- Tier 4: Context ----

    var now = new Date();
    var timeOfDay = now.getHours().toString().padStart(2, "0") + ":" +
                    now.getMinutes().toString().padStart(2, "0");
    var daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    var outcome = ps.outcome || {};
    var problemData = ps.problemData || {};

    return {
      // Identity
      problem_event_id: uuid(),
      student_id: this.studentId,
      session_id: this.sessionId,
      problem_id: problemId,

      // The Problem
      problem_definition: {
        text: problemData.text || problemData.question_text || null,
        correct_answer: problemData.correct_answer != null ? problemData.correct_answer : null,
        concept_target: problemData.concept_target || null,
        difficulty_params: problemData.difficulty_params || problemData.difficulty || null,
        misconception_targets: problemData.misconception_targets || [],
        representation: problemData.representation || null
      },

      // Tier 1: Response
      response: {
        final_answer: outcome.answer != null ? outcome.answer : null,
        is_correct: outcome.correct != null ? outcome.correct : null,
        answer_history: ps.answerHistory.slice(),
        answer_change_count: Math.max(0, ps.answerHistory.length - 1),
        submitted_or_timed_out: outcome.timed_out ? "timed_out" : "submitted"
      },

      // Tier 2: Process
      process: {
        time_to_first_interaction_ms: Math.round(timeToFirstInteraction),
        total_response_time_ms: Math.round(totalTime),
        time_at_each_phase: {
          reading: Math.round(readingMs),
          working: Math.round(workingMs),
          reviewing: Math.round(reviewingMs)
        },
        scratch_work: {
          entries: ps.scratchWork.entries.slice(),
          entry_timestamps_ms: ps.scratchWork.entry_timestamps_ms.slice(),
          erasures: ps.scratchWork.erasures.slice(),
          spatial_layout: ps.scratchWork.spatial_layout.slice()
        },
        scaffold_interactions: {
          available: ps.scaffoldInteractions.available.slice(),
          used: ps.scaffoldInteractions.used.slice(),
          time_of_use: ps.scaffoldInteractions.time_of_use.slice(),
          help_requested: ps.scaffoldInteractions.help_requested
        },
        interaction_sequence: interactionSequence,
        self_corrections: selfCorrections
      },

      // Tier 3: Engagement
      engagement: {
        hesitation_points: hesitationPoints,
        interaction_velocity: interactionVelocity,
        frustration_indicators: {
          rapid_repeated_clicks: rapidRepeatedClicks,
          delete_cycles: deleteCycles,
          long_pauses: longPauses
        },
        flow_indicators: {
          response_time_relative_to_baseline: responseTimeRelative,
          accuracy_trend_last_5: this._recentAccuracy.slice(),
          voluntary_continuation: null
        }
      },

      // Tier 4: Context
      context: {
        problem_position_in_session: ps.position,
        problems_since_last_error: this._errorsSinceLastCorrect === 0 ? ps.position : this._errorsSinceLastCorrect,
        problems_since_last_scaffold: this._problemsSinceLastScaffold,
        current_difficulty_level: problemData.difficulty_params || problemData.difficulty || null,
        session_time_elapsed_ms: Date.now() - this._sessionStartMs,
        time_of_day: timeOfDay,
        day_of_week: daysOfWeek[now.getDay()]
      }
    };
  };

  // ============================================================
  // Action Classification Helpers
  // ============================================================

  /**
   * Classify a raw event into a semantic action matching the spec format
   * e.g., "write_scratch", "type_answer", "submit", "click", "drag_start"
   */
  SignalCollector.prototype._classifyAction = function (event) {
    var type = event.event_type;
    var data = event.event_data || {};

    // Custom events pass through
    if (type.indexOf("custom:") === 0) return type.replace("custom:", "");

    // Keyboard events
    if (type === "keydown") {
      if (data.is_delete) return "delete";
      if (data.key === "Enter") return "submit";
      if (data.is_input_field) return "type_answer";
      return "keypress";
    }
    if (type === "keyup") return "key_release";

    // Input/change events
    if (type === "input" || type === "change") return "type_answer";

    // Pointer events
    if (type === "pointerdown") return "click";
    if (type === "pointerup") return "click_release";

    // Drag events
    if (type === "dragstart") return "drag_start";
    if (type === "dragend") return "drag_end";
    if (type === "drop") return "drop";

    return type;
  };

  /**
   * Extract meaningful value from an event for the interaction_sequence
   */
  SignalCollector.prototype._extractActionValue = function (event) {
    var data = event.event_data || {};

    // Key events: the key pressed
    if (data.key && !data.is_modifier) return data.key;

    // Input events: the current value
    if (data.value !== undefined && data.value !== "") return data.value;

    // Pointer events on identifiable targets: the target
    if (event.event_target && event.event_target !== "document") return event.event_target;

    return null;
  };

  /**
   * Compute interaction velocity matching spec: { mean_time_between_actions_ms, variance_ms, trend }
   */
  SignalCollector.prototype._computeInteractionVelocity = function (interactions) {
    if (interactions.length < 2) {
      return { mean_time_between_actions_ms: 0, variance_ms: 0, trend: "stable" };
    }

    var intervals = [];
    for (var i = 1; i < interactions.length; i++) {
      intervals.push(interactions[i].time_ms - interactions[i - 1].time_ms);
    }

    // Mean
    var sum = 0;
    for (var j = 0; j < intervals.length; j++) sum += intervals[j];
    var mean = sum / intervals.length;

    // Variance
    var varianceSum = 0;
    for (var k = 0; k < intervals.length; k++) {
      varianceSum += Math.pow(intervals[k] - mean, 2);
    }
    var variance = varianceSum / intervals.length;

    // Trend: compare first half mean to second half mean
    var trend = "stable";
    if (intervals.length >= 4) {
      var mid = Math.floor(intervals.length / 2);
      var firstHalfSum = 0, secondHalfSum = 0;
      for (var f = 0; f < mid; f++) firstHalfSum += intervals[f];
      for (var s = mid; s < intervals.length; s++) secondHalfSum += intervals[s];
      var firstHalfMean = firstHalfSum / mid;
      var secondHalfMean = secondHalfSum / (intervals.length - mid);

      // >20% change threshold for trend detection
      var ratio = secondHalfMean / firstHalfMean;
      if (ratio < 0.8) trend = "accelerating";
      else if (ratio > 1.2) trend = "decelerating";

      // High coefficient of variation = erratic
      var cv = Math.sqrt(variance) / mean;
      if (cv > 1.0) trend = "erratic";
    }

    return {
      mean_time_between_actions_ms: Math.round(mean),
      variance_ms: Math.round(variance),
      trend: trend
    };
  };

  /**
   * Get average response time across completed problems (for baseline comparison)
   */
  SignalCollector.prototype._getAverageResponseTime = function () {
    var keys = Object.keys(this._completedProblems);
    if (keys.length === 0) return 0;
    var total = 0;
    for (var i = 0; i < keys.length; i++) {
      total += this._completedProblems[keys[i]].total_response_time_ms || 0;
    }
    return total / keys.length;
  };

  // ============================================================
  // Frustration / Flow Detection Helpers
  // ============================================================

  /**
   * Detect rapid repeated clicks on the same target within a short window
   */
  SignalCollector.prototype._detectRapidClicks = function (events) {
    var count = 0;
    var clickEvents = [];

    for (var i = 0; i < events.length; i++) {
      if (events[i].event_type === "pointerdown") {
        clickEvents.push(events[i]);
      }
    }

    for (var j = 0; j < clickEvents.length; j++) {
      var windowEnd = clickEvents[j].timestamp_ms + this.frustrationClickMs;
      var clicksInWindow = 0;

      for (var k = j; k < clickEvents.length; k++) {
        if (clickEvents[k].timestamp_ms <= windowEnd &&
            clickEvents[k].event_target === clickEvents[j].event_target) {
          clicksInWindow++;
        } else if (clickEvents[k].timestamp_ms > windowEnd) {
          break;
        }
      }

      if (clicksInWindow >= this.frustrationClickCount) {
        count++;
        j += clicksInWindow - 1; // skip past this cluster
      }
    }

    return count;
  };

  /**
   * Detect delete cycles: 3+ consecutive delete keystrokes
   */
  SignalCollector.prototype._detectDeleteCycles = function (events) {
    var count = 0;
    var consecutive = 0;

    for (var i = 0; i < events.length; i++) {
      if (events[i].event_data && events[i].event_data.is_delete) {
        consecutive++;
        if (consecutive >= 3) {
          count++;
          consecutive = 0;
        }
      } else {
        consecutive = 0;
      }
    }

    return count;
  };

  /**
   * Detect consistent pacing: coefficient of variation of inter-event intervals < 0.5
   */
  SignalCollector.prototype._detectConsistentPace = function (events) {
    if (events.length < 4) return false;

    var intervals = [];
    for (var i = 1; i < events.length; i++) {
      intervals.push(events[i].timestamp_ms - events[i - 1].timestamp_ms);
    }

    var mean = 0;
    for (var j = 0; j < intervals.length; j++) mean += intervals[j];
    mean /= intervals.length;

    if (mean === 0) return false;

    var variance = 0;
    for (var k = 0; k < intervals.length; k++) {
      variance += Math.pow(intervals[k] - mean, 2);
    }
    variance /= intervals.length;

    var cv = Math.sqrt(variance) / mean;
    return cv < 0.5;
  };

  // ============================================================
  // Custom Events
  // ============================================================

  /**
   * Record a game-specific custom event
   * @param {string} type - Event type (e.g., 'hint_requested', 'scaffold_opened')
   * @param {Object} data - Event-specific data
   */
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
   * screen transitions, content renders, feedback display, cell selections,
   * timer-driven content changes, overlay show/hide, etc.
   *
   * @param {string} viewType - Category: 'screen_transition' | 'content_render' |
   *   'feedback_display' | 'component_state' | 'overlay_toggle' | 'visual_update'
   * @param {Object} viewData - View-specific data
   * @param {string} [viewData.screen] - Current visible screen (e.g., 'ready', 'gameplay', 'results')
   * @param {Object} [viewData.content_snapshot] - What content is currently displayed
   * @param {Object} [viewData.components] - State of UI components (timer, progress, etc.)
   * @param {Object} [viewData.metadata] - Additional context (e.g., { trigger: 'timer_reshuffle' })
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

  /**
   * Get the current view state (last recorded via recordViewEvent)
   * @returns {Object|null} Current view state or null if never set
   */
  SignalCollector.prototype.getCurrentView = function () {
    return this._currentView ? Object.assign({}, this._currentView) : null;
  };

  // ============================================================
  // Data Access
  // ============================================================

  /**
   * Get all raw input events in the buffer
   * @returns {Array} Copy of the input events buffer
   */
  SignalCollector.prototype.getInputEvents = function () {
    return this._inputEvents.slice();
  };

  /**
   * Get computed signals for a specific problem
   * @param {string} problemId
   * @returns {Object|null} Tier 2-4 signals
   */
  SignalCollector.prototype.getProblemSignals = function (problemId) {
    return this._completedProblems[problemId] || null;
  };

  /**
   * Get signals for all completed problems
   * @returns {Object} Map of problemId -> signals
   */
  SignalCollector.prototype.getAllProblemSignals = function () {
    var copy = {};
    var keys = Object.keys(this._completedProblems);
    for (var i = 0; i < keys.length; i++) {
      copy[keys[i]] = this._completedProblems[keys[i]];
    }
    return copy;
  };

  /**
   * Get signal collection metadata
   * @returns {Object} Metadata about the collection session
   */
  SignalCollector.prototype.getMetadata = function () {
    return {
      collector_version: "2.1.0",
      session_id: this.sessionId,
      student_id: this.studentId,
      template_id: this.templateId,
      session_start_ms: this._sessionStartMs,
      total_events_captured: this._inputEvents.length,
      events_truncated: this._eventsTruncated,
      buffer_max_size: this.maxBufferSize,
      problems_tracked: Object.keys(this._completedProblems).length,
      device_context: this._deviceContext
    };
  };

  // ============================================================
  // Batch Flushing
  // ============================================================

  /**
   * Start periodic flushing of new events to the parent window via postMessage.
   * Each flush sends only events accumulated since the last flush.
   */
  SignalCollector.prototype.startFlushing = function () {
    if (this._sealed || this._flushTimer) return;
    if (!this.flushIntervalMs || this.flushIntervalMs <= 0) return;
    if (!this.flushUrl) {
      console.warn("[SignalCollector] No flushUrl configured, flushing disabled");
      return;
    }

    var self = this;
    this._flushTimer = setInterval(function () {
      self._flush();
    }, this.flushIntervalMs);

    console.log("[SignalCollector] Flushing started — interval " + this.flushIntervalMs + "ms");
  };

  /**
   * Stop periodic flushing.
   */
  SignalCollector.prototype.stopFlushing = function () {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
      console.log("[SignalCollector] Flushing stopped");
    }
  };

  /**
   * Flush new events since last flush to parent via postMessage.
   * @returns {boolean} true if events were flushed
   */
  SignalCollector.prototype._flush = function () {
    var newEvents = this._inputEvents.slice(this._lastFlushedIndex);
    if (newEvents.length === 0) return false;
    if (!this.flushUrl) return false;

    this._batchNumber++;
    this._lastFlushedIndex = this._inputEvents.length;

    var batchData = {
      batch_number: this._batchNumber,
      session_id: this.sessionId,
      student_id: this.studentId,
      game_id: this.gameId,
      content_set_id: this.contentSetId,
      play_id: this.playId,
      events: newEvents,
      event_count: newEvents.length,
      flushed_at: Date.now()
    };

    var gcsPath = "signal-events/" +
      (this.studentId || "unknown") + "/" +
      (this.sessionId || "unknown") + "/" +
      (this.gameId || "unknown") + "/" +
      (this.contentSetId || "unknown") + "/" +
      (this.playId || "unknown") + "/" +
      "batch-" + this._batchNumber + ".json";

    var url = this.flushUrl;
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 10000);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: gcsPath, data: batchData }),
        signal: controller.signal
      }).then(function () {
        clearTimeout(timeoutId);
      }).catch(function () {
        clearTimeout(timeoutId);
      });
    } catch (e) {
      // fire-and-forget
    }

    console.log("[SignalCollector] Flushed batch #" + this._batchNumber + " — " + newEvents.length + " events to " + gcsPath);
    return true;
  };

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Seal the collector — finalize all data, detach listeners, return complete payload.
   * Idempotent: calling seal() again returns the same cached payload.
   * After seal, all read methods still work; all write methods warn and no-op.
   * @returns {Object} { events, signals, metadata }
   */
  SignalCollector.prototype.seal = function () {
    if (this._sealed) return this._sealedPayload;

    // Final flush before sealing
    this._flush();
    this.stopFlushing();

    this._sealed = true;
    this._removeAllListeners();

    // Compute signals for all completed problems from the flat event log
    var signals = {};
    var keys = Object.keys(this._completedProblems);
    for (var i = 0; i < keys.length; i++) {
      signals[keys[i]] = this._completedProblems[keys[i]];
    }

    this._sealedPayload = {
      events: this._inputEvents.slice(),
      signals: signals,
      metadata: this.getMetadata()
    };

    console.log("[SignalCollector] Sealed — " + this._inputEvents.length + " events, " + keys.length + " problems");
    return this._sealedPayload;
  };

  /** Pause signal collection (e.g., on tab switch) */
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

  /**
   * Get a debug summary of the current state
   * @returns {Object} Debug information
   */
  SignalCollector.prototype.debug = function () {
    var summary = {
      metadata: this.getMetadata(),
      current_problem: this._currentProblemId,
      active_problems: Object.keys(this._problemStates),
      completed_problems: Object.keys(this._completedProblems),
      paused: this._paused,
      last_5_events: this._inputEvents.slice(-5).map(function (e) {
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

  console.log("[SignalCollector] Loaded successfully (v2.1.0)");

})(window);
