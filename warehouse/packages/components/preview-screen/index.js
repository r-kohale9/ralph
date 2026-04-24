/**
 * PreviewScreenComponent v3 — Persistent game wrapper (split)
 *
 * The preview screen is a PERSISTENT WRAPPER for the entire game session.
 * It has two states:
 *   1. preview — instruction + non-interactable game overlay + skip button + audio
 *   2. game    — interactable game content; overlay removed
 *
 * v3 split: the action-bar (back, avatar, question label, score, star)
 * moved to ActionBarComponent. PreviewScreenComponent now owns:
 *   - preview body DOM (#previewInstruction, overlay, skip button)
 *   - #previewProgressBar (driven by preview-phase audio-sync rAF only)
 *   - audio lifecycle (preload, play, pause, resume, visibility gating)
 *
 * PreviewScreen instantiates ActionBar internally — game code continues to
 * see a single PreviewScreenComponent and its public API is unchanged.
 *
 * @version 3.1.0
 * @license MIT
 */

(function (window) {
  "use strict";

  if (typeof window.PreviewScreenComponent !== "undefined") {
    console.log("[PreviewScreenComponent] Already loaded, skipping duplicate execution");
    return;
  }

  // ============================================================
  // Constants
  // ============================================================

  var VERSION = "3.2.0";
  var DEFAULT_TIMER_DURATION = 5000;
  var FEEDBACK_MANAGER_CDN =
    "https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js";
  var FEEDBACK_MANAGER_LOAD_TIMEOUT_MS = 5000; // R7

  // R9: ActionBar lazy-load fallback. If the components bundle that loaded
  // preview-screen did not also load action-bar (cache drift, partial deploy,
  // out-of-order script tags), PreviewScreen lazy-loads it from CDN on first
  // construct. Header renders once the script resolves.
  var ACTION_BAR_CDN =
    "https://storage.googleapis.com/test-dynamic-assets/packages/components/action-bar/index.js";
  var ACTION_BAR_LOAD_TIMEOUT_MS = 5000;

  // R1: play() retry
  var PLAY_MAX_RETRIES = 2;
  var PLAY_RETRY_DELAY_MS = 250;

  // R2: preload retry
  var PRELOAD_MAX_RETRIES = 1;
  var PRELOAD_RETRY_DELAY_MS = 500;

  // R3: TTS retry
  var TTS_MAX_RETRIES = 2;
  var TTS_RETRY_DELAYS_MS = [250, 750];

  // R4: minimum valid duration
  var MIN_VALID_AUDIO_DURATION_MS = 500;

  // Sentry
  var SENTRY_CDN = "https://browser.sentry-cdn.com/10.23.0/bundle.min.js";
  var SENTRY_DSN_FALLBACK =
    "https://851dc3b10b3839ae377c888956a345aa@o503779.ingest.us.sentry.io/4510363214675968";

  // ============================================================
  // Class
  // ============================================================

  /**
   * @param {object} config
   * @param {string} config.slotId - Preview slot ID (default: 'mathai-preview-slot')
   * @param {object} config.signalCollector - Optional SignalCollector instance
   */
  function PreviewScreenComponent(config) {
    config = config || {};
    this.config = {
      slotId: config.slotId || "mathai-preview-slot",
    };

    this.container = null;
    this.signalCollector = config.signalCollector || window.signalCollector || null;

    // State machine
    this._state = "idle"; // 'idle' | 'preview' | 'game'
    this._hasBeenShown = false;

    // Audio / progress bar
    this._isAudioPlaying = false;
    this._isPaused = false;
    this._rafId = null;
    this._startTime = 0;
    this._duration = DEFAULT_TIMER_DURATION;
    this._elapsed = 0;
    this._pausedAt = 0;
    this._totalPausedDuration = 0;
    this._onCompleteCallback = null;
    this._onPreviewInteractionCallback = null;
    this._previewData = {};
    this._audioId = "preview_audio_" + Date.now();
    this._hasAudio = false;
    this._showStartTime = 0;

    // Audio permission tracking
    this._audioUnlockDone = false;
    this._permissionCallbacks = [];
    this._permissionPollId = null;

    // Play generation — R10: bump on switchToGame so stale retry callbacks abort
    this._playGeneration = 0;

    // Deferred-start flags
    this._audioPendingPlay = false;
    this._pendingAudioUrl = null;
    this._timerPendingStart = false;

    // PATH A offset restoration state
    this._pauseSavedOffset = false;

    // Sentry
    this._sentryReady = false;
    this._sentryQueue = [];

    // DOM refs (filled in injectIntoSlot)
    this._progressBar = null;
    this._instructionArea = null;
    this._gameContainer = null;
    this._gameStack = null;
    this._overlay = null;
    this._skipWrap = null;

    // ActionBar — internal child component. Instantiate synchronously if the
    // global is already present; otherwise lazy-load the CDN script and
    // instantiate when it resolves. Callbacks queued via _whenActionBarReady
    // fire once the instance exists.
    this._actionBar = null;
    this._actionBarReadyCallbacks = [];
    this._ensureActionBar();

    var self = this;

    // Visibility safety net — pause-only. NEVER auto-resume on visible.
    // (See README comment in v2 for the full rationale — unchanged.)
    this._visibilityListener = function () {
      if (document.hidden) {
        if (self._state !== "idle" && !self._isPaused) {
          self.pause();
        }
      }
    };
    document.addEventListener("visibilitychange", this._visibilityListener);

    this.injectStyles();
    this.injectIntoSlot();
    this._initSentry();

    console.log("[PreviewScreen] Initialized v" + VERSION);
  }

  // ============================================================
  // Styles
  // ============================================================

  PreviewScreenComponent.prototype.injectStyles = function () {
    if (document.getElementById("mathai-preview-screen-styles")) return;

    var style = document.createElement("style");
    style.id = "mathai-preview-screen-styles";
    style.textContent =
      /* Slot wrapper — owns scroll. */
      ".mathai-preview-slot {" +
      "  position: relative;" +
      "  max-width: var(--mathai-game-max-width, 480px);" +
      "  margin: 0 auto;" +
      "  background: #fff;" +
      "  min-height: 100dvh;" +
      "  height: 100dvh;" +
      "  width: 100%;" +
      "  box-sizing: border-box;" +
      "  overflow: hidden;" +
      "}" +

      /* Progress bar — owned by preview-screen (audio-sync only). */
      ".mathai-preview-header-progress {" +
      "  position: absolute; top: 0; left: 0; bottom: 0;" +
      "  background: #D7FFFF;" +
      "  width: 100%; transform-origin: left;" +
      "  transition: none;" +
      "}" +
      ".mathai-preview-header-progress.hidden {" +
      "  display: none;" +
      "}" +

      /* Body — single scroll area below fixed header. */
      ".mathai-preview-body {" +
      "  padding: 80px 16px 100px 16px;" +
      "  text-align: left;" +
      "  box-sizing: border-box;" +
      "  min-height: 100dvh;" +
      "  height: 100dvh;" +
      "  overflow-y: auto;" +
      "  overflow-x: hidden;" +
      "  -webkit-overflow-scrolling: touch;" +
      "}" +
      ".mathai-preview-instruction {" +
      "  font-weight: 400; font-size: 16px; line-height: 21px;" +
      "  padding: 0 16px 20px 16px;" +
      "  color: #333333;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-instruction:empty { display: none; }" +
      ".mathai-preview-instruction img { max-width: 100%; height: auto; }" +
      ".mathai-preview-instruction video { width: 100%; }" +

      /* Game container — holds .game-stack */
      ".mathai-preview-game-container {" +
      "  position: relative;" +
      "  width: 100%;" +
      "  box-sizing: border-box;" +
      "  overflow: visible;" +
      "}" +
      ".mathai-preview-game-container.game-hidden .game-stack {" +
      "  visibility: hidden;" +
      "}" +
      /* Kill nested scroll — preview body owns scrolling. */
      ".mathai-preview-game-container .game-stack {" +
      "  overflow: visible;" +
      "  height: auto;" +
      "}" +

      /* Overlay — non-interactable cover during preview state */
      ".mathai-preview-overlay {" +
      "  position: absolute; inset: 0;" +
      "  pointer-events: auto;" +
      "  background: transparent;" +
      "  z-index: 5;" +
      "  cursor: not-allowed;" +
      "}" +

      /* Skip button — fixed bottom (preview state only) */
      ".mathai-preview-skip-wrap {" +
      "  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);" +
      "  width: 100%; max-width: var(--mathai-game-max-width, 480px);" +
      "  padding: 8px 16px; padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));" +
      "  text-align: center; z-index: 20; box-sizing: border-box;" +
      "  background: transparent;" +
      "}" +
      ".mathai-preview-skip-btn {" +
      "  background: #fff; cursor: pointer;" +
      "  font-size: 16px; font-weight: 400; color: #270F36;" +
      "  height: 68px; padding: 20px 53px;" +
      "  border: 1px solid #ECECEC; border-radius: 8px;" +
      "  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.1);" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-skip-btn:active { border-color: #270F36; }";

    document.head.appendChild(style);
    console.log("[PreviewScreen] Styles injected");
  };

  // ============================================================
  // DOM setup — populate the skeleton created by ScreenLayout
  // ============================================================

  PreviewScreenComponent.prototype.injectIntoSlot = function () {
    this.container = document.getElementById(this.config.slotId);
    if (!this.container) {
      throw new Error(
        "PreviewScreen: Slot #" + this.config.slotId + " not found. " +
        "ScreenLayout.inject() must be called with slots.previewScreen: true first."
      );
    }

    this._progressBar = this.container.querySelector("#previewProgressBar");
    this._instructionArea = this.container.querySelector("#previewInstruction");
    this._gameContainer = this.container.querySelector("#previewGameContainer");
    this._gameStack = this._gameContainer && this._gameContainer.querySelector(".game-stack");

    if (!this._progressBar || !this._instructionArea || !this._gameContainer || !this._gameStack) {
      throw new Error(
        "PreviewScreen: Slot skeleton incomplete. " +
        "Ensure ScreenLayout v2.0+ is used with slots.previewScreen: true."
      );
    }
  };

  // ============================================================
  // show() — enter preview state
  // ============================================================

  /**
   * @param {object} config
   * @param {string} config.instruction - HTML string
   * @param {string} config.audioUrl - Audio URL (optional)
   * @param {boolean} config.showGameOnPreview - Show game underneath overlay (default false)
   * @param {function} config.onComplete - Called when preview transitions to game state
   * @param {function} config.onPreviewInteraction - Called when setPreviewData is invoked
   */
  PreviewScreenComponent.prototype.show = function (config) {
    var self = this;
    config = config || {};

    if (this._hasBeenShown) {
      // Auto-skip on restart — preserve current behavior
      this._state = "game";
      this._previewData = { duration: 0, skippedRepeat: true };
      if (this._gameContainer) this._gameContainer.classList.remove("game-hidden");
      this._removeOverlay();
      this._removeSkipButton();
      if (this._progressBar) this._progressBar.classList.add("hidden");
      if (typeof config.onComplete === "function") {
        try { config.onComplete(this._previewData); } catch (e) { this._captureError(e, { method: "show", autoSkip: true }); }
      }
      console.log("[PreviewScreen] Already shown — skipped to game state");
      return;
    }

    try {
      // Clean up any in-flight audio/timer from a prior show() call
      this._stopAudio();
      this._cancelRaf();
      this._removeOverlay();
      this._removeSkipButton();

      this._state = "preview";
      this._isPaused = false;
      this._elapsed = 0;
      this._totalPausedDuration = 0;
      this._previewData = {};
      this._showStartTime = Date.now();
      this._onCompleteCallback = config.onComplete || null;
      this._onPreviewInteractionCallback = config.onPreviewInteraction || null;
      this._hasAudio = !!config.audioUrl;

      // Reset progress bar to preview state (full, visible)
      if (this._progressBar) {
        this._progressBar.classList.remove("hidden");
        this._progressBar.style.transform = "scaleX(1)";
      }

      // Instruction
      if (this._instructionArea) {
        this._instructionArea.innerHTML = config.instruction || "";
      }

      // Game stack visibility
      if (config.showGameOnPreview) {
        this._gameContainer.classList.remove("game-hidden");
      } else {
        this._gameContainer.classList.add("game-hidden");
      }

      this._addOverlay();
      this._addSkipButton();

      // Avatar: start with silent. Null-safe because ActionBar may still be
      // in its lazy-load window — the silent video is the default anyway.
      if (this._actionBar) this._actionBar.setAvatarSpeaking(false);

      this._recordViewEvent("screen_transition", { from: "init", to: "preview" });
      this._recordViewEvent("content_render", { instruction: !!config.instruction, showGameOnPreview: !!config.showGameOnPreview });

      // If the tab is already hidden at show() time, pre-pause so the audio/
      // timer flow takes the deferred-start path.
      if (document.hidden) {
        this._isPaused = true;
        this._pausedAt = performance.now();
        console.log("[PreviewScreen] show() called with hidden tab — entering paused state");
      }

      this._instruction = config.instruction || "";
      if (config.audioUrl) {
        this._startWithAudio(config.audioUrl);
      } else {
        this._tryRuntimeTTS(config.instruction);
      }
    } catch (err) {
      this._captureError(err, { method: "show", config: config });
    }
  };

  PreviewScreenComponent.prototype._addOverlay = function () {
    if (this._overlay) return;
    this._overlay = document.createElement("div");
    this._overlay.className = "mathai-preview-overlay";
    this._gameContainer.appendChild(this._overlay);
  };

  PreviewScreenComponent.prototype._removeOverlay = function () {
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
  };

  PreviewScreenComponent.prototype._addSkipButton = function () {
    if (this._skipWrap) return;
    var self = this;
    this._skipWrap = document.createElement("div");
    this._skipWrap.className = "mathai-preview-skip-wrap";
    this._skipWrap.innerHTML = '<button class="mathai-preview-skip-btn" id="previewSkipBtn">Skip &amp; show options</button>';
    this.container.appendChild(this._skipWrap);
    var skipBtn = this._skipWrap.querySelector("#previewSkipBtn");
    if (skipBtn) {
      skipBtn.addEventListener("click", function () { self.skip(); });
    }
  };

  PreviewScreenComponent.prototype._removeSkipButton = function () {
    if (this._skipWrap && this._skipWrap.parentNode) {
      this._skipWrap.parentNode.removeChild(this._skipWrap);
    }
    this._skipWrap = null;
  };

  // ============================================================
  // Runtime TTS fallback — R3: retry on transient failure
  // ============================================================

  var TTS_API_URL = "https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio";

  PreviewScreenComponent.prototype._tryRuntimeTTS = function (instruction) {
    var self = this;
    if (!instruction) {
      this._startWithTimer();
      return;
    }

    var text = instruction.replace(/<[^>]*>/g, "").trim();
    if (!text) {
      this._startWithTimer();
      return;
    }

    function attempt(tryIndex) {
      if (self._state !== "preview") return;
      try {
        fetch(TTS_API_URL + "?sendUrl=true&text=" + encodeURIComponent(text))
          .then(function (res) {
            if (!res.ok) throw new Error("TTS API returned " + res.status);
            return res.json();
          })
          .then(function (data) {
            if (self._state !== "preview") return;
            if (data && data.audio_url) {
              self._hasAudio = true;
              self._startWithAudio(data.audio_url);
            } else {
              self._startWithTimer();
            }
          })
          .catch(function (err) {
            if (self._state !== "preview") return;
            if (tryIndex < TTS_MAX_RETRIES) {
              var delay = TTS_RETRY_DELAYS_MS[tryIndex] || 500;
              console.warn("[PreviewScreen] TTS fetch failed (attempt " + (tryIndex + 1) + "), retrying in " + delay + "ms:", err);
              setTimeout(function () { attempt(tryIndex + 1); }, delay);
            } else {
              console.warn("[PreviewScreen] TTS fetch failed after retries — falling back to timer");
              self._recordViewEvent("component_state", { tts_failed_final: true });
              self._startWithTimer();
            }
          });
      } catch (e) {
        if (tryIndex < TTS_MAX_RETRIES) {
          var delay2 = TTS_RETRY_DELAYS_MS[tryIndex] || 500;
          setTimeout(function () { attempt(tryIndex + 1); }, delay2);
        } else {
          self._startWithTimer();
        }
      }
    }

    attempt(0);
  };

  // ============================================================
  // ActionBar resolution (sync if present, lazy-load from CDN otherwise)
  // ============================================================

  PreviewScreenComponent.prototype._ensureActionBar = function () {
    var self = this;

    if (typeof window.ActionBarComponent === "function") {
      try {
        this._actionBar = new window.ActionBarComponent({ slotId: this.config.slotId });
      } catch (err) {
        this._captureError(err, { method: "_ensureActionBar.sync" });
        console.warn("[PreviewScreen] ActionBar construction failed — header will be blank:", err);
      }
      this._flushActionBarReadyCallbacks();
      return;
    }

    // Fallback: lazy-load from CDN. The components bundle may have shipped
    // before action-bar was added, or the bundle may be cached. Load the
    // current CDN copy now; on success, construct and flush queued callbacks.
    console.log("[PreviewScreen] ActionBarComponent not found — lazy-loading from CDN");

    var timedOut = false;
    var timeoutId = setTimeout(function () {
      timedOut = true;
      console.warn(
        "[PreviewScreen] ActionBar lazy-load timed out after " +
        ACTION_BAR_LOAD_TIMEOUT_MS + "ms — header will be blank for this session"
      );
      // Flush callbacks with no actionBar so callers don't hang indefinitely.
      self._flushActionBarReadyCallbacks();
    }, ACTION_BAR_LOAD_TIMEOUT_MS);

    var script = document.createElement("script");
    script.src = ACTION_BAR_CDN;
    script.async = false;
    script.onload = function () {
      clearTimeout(timeoutId);
      if (timedOut) return;
      if (typeof window.ActionBarComponent === "function") {
        try {
          self._actionBar = new window.ActionBarComponent({ slotId: self.config.slotId });
          console.log("[PreviewScreen] ActionBar lazy-loaded successfully");
        } catch (err) {
          self._captureError(err, { method: "_ensureActionBar.lazy" });
          console.warn("[PreviewScreen] ActionBar lazy-construct failed:", err);
        }
      } else {
        console.warn("[PreviewScreen] ActionBar script loaded but window.ActionBarComponent still undefined");
      }
      self._flushActionBarReadyCallbacks();
    };
    script.onerror = function () {
      clearTimeout(timeoutId);
      console.warn("[PreviewScreen] Failed to lazy-load ActionBar from CDN — header will be blank");
      self._flushActionBarReadyCallbacks();
    };
    document.head.appendChild(script);
  };

  PreviewScreenComponent.prototype._whenActionBarReady = function (callback) {
    if (this._actionBar || this._actionBarReadyCallbacks === null) {
      // ready (or permanently unavailable after timeout — callback still fires
      // so show() can proceed with a blank header rather than deadlock)
      try { callback(); } catch (e) { this._captureError(e, { method: "_whenActionBarReady.immediate" }); }
      return;
    }
    this._actionBarReadyCallbacks.push(callback);
  };

  PreviewScreenComponent.prototype._flushActionBarReadyCallbacks = function () {
    var cbs = this._actionBarReadyCallbacks || [];
    // Mark as "done" so future _whenActionBarReady calls fire inline.
    this._actionBarReadyCallbacks = null;
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](); } catch (e) { this._captureError(e, { method: "_flushActionBarReadyCallbacks" }); }
    }
  };

  // ============================================================
  // Audio flow
  // ============================================================

  /**
   * R7: Load FeedbackManager from CDN with a 5s timeout so a stuck network
   * doesn't leave us polling forever. On timeout → timer-only fallback.
   */
  PreviewScreenComponent.prototype._ensureFeedbackManager = function (callback) {
    if (typeof FeedbackManager !== "undefined" && FeedbackManager.sound) {
      callback();
      return;
    }

    var timedOut = false;
    var resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      callback();
    }

    var timeoutId = setTimeout(function () {
      timedOut = true;
      console.warn("[PreviewScreen] FeedbackManager load timed out after " + FEEDBACK_MANAGER_LOAD_TIMEOUT_MS + "ms — continuing without audio");
      done();
    }, FEEDBACK_MANAGER_LOAD_TIMEOUT_MS);

    var script = document.createElement("script");
    script.src = FEEDBACK_MANAGER_CDN;
    script.onload = function () {
      clearTimeout(timeoutId);
      if (timedOut) return; // already fell through to timer
      if (typeof FeedbackManager !== "undefined") {
        if (typeof FeedbackManager.init === "function") {
          FeedbackManager.init();
        }
      }
      done();
    };
    script.onerror = function () {
      clearTimeout(timeoutId);
      console.warn("[PreviewScreen] Failed to load FeedbackManager — falling back to timer");
      done();
    };
    document.head.appendChild(script);
  };

  PreviewScreenComponent.prototype._startWithAudio = function (audioUrl) {
    var self = this;
    this._pendingAudioUrl = audioUrl;

    this._ensureFeedbackManager(function () {
      if (typeof FeedbackManager === "undefined" || !FeedbackManager.sound) {
        self._startWithTimer();
        return;
      }

      var preloadDone = false;
      var permissionDone = false;

      function tryPlay() {
        if (preloadDone && permissionDone && self._state === "preview") {
          self._playPreviewAudio();
        }
      }

      function preloadAttempt(tryIndex) {
        try {
          var preloadPromise = FeedbackManager.sound.preload([{ id: self._audioId, url: audioUrl }]);
          if (preloadPromise && typeof preloadPromise.then === "function") {
            preloadPromise.then(function () {
              preloadDone = true;
              tryPlay();
            }).catch(function (err) {
              if (tryIndex < PRELOAD_MAX_RETRIES) {
                console.warn("[PreviewScreen] Audio preload failed (attempt " + (tryIndex + 1) + "), retrying in " + PRELOAD_RETRY_DELAY_MS + "ms:", err);
                setTimeout(function () { preloadAttempt(tryIndex + 1); }, PRELOAD_RETRY_DELAY_MS);
              } else {
                console.warn("[PreviewScreen] Audio preload failed after retries — falling back to timer:", err);
                self._recordViewEvent("component_state", { preload_failed_final: true });
                self._startWithTimer();
              }
            });
          } else {
            preloadDone = true;
            tryPlay();
          }
        } catch (err) {
          self._captureError(err, { method: "_startWithAudio.preload" });
          if (tryIndex < PRELOAD_MAX_RETRIES) {
            setTimeout(function () { preloadAttempt(tryIndex + 1); }, PRELOAD_RETRY_DELAY_MS);
          } else {
            self._startWithTimer();
          }
        }
      }

      preloadAttempt(0);

      self._waitForAudioPermission(function () {
        permissionDone = true;
        tryPlay();
      });
    });
  };

  PreviewScreenComponent.prototype._startWithTimer = function () {
    var self = this;

    this._ensureFeedbackManager(function () {
      self._waitForAudioPermission(function () {
        if (document.hidden || self._isPaused) {
          self._timerPendingStart = true;
          if (!self._isPaused) {
            self._isPaused = true;
            self._pausedAt = performance.now();
          }
          console.log("[PreviewScreen] Timer start deferred — tab hidden or paused");
          return;
        }
        self._isPaused = false;
        self._duration = DEFAULT_TIMER_DURATION;
        self._beginProgressBar();
        self._recordViewEvent("component_state", { progressBar: "started", duration: self._duration, hasAudio: false });
      });
    });
  };

  PreviewScreenComponent.prototype._waitForAudioPermission = function (callback) {
    var self = this;

    if (typeof FeedbackManager === "undefined" || !FeedbackManager.sound) {
      callback();
      return;
    }

    if (this._audioUnlockDone) {
      callback();
      return;
    }

    this._permissionCallbacks.push(callback);

    if (this._permissionPollId) return;

    function isPopupVisible() {
      if (typeof PopupComponent !== "undefined" && typeof PopupComponent.isVisible === "function" && PopupComponent.isVisible()) {
        return true;
      }
      var bd = document.getElementById("popup-backdrop");
      if (bd && bd.style.display !== "none" && bd.offsetParent !== null) {
        return true;
      }
      return false;
    }

    if (!isPopupVisible()) {
      this._audioUnlockDone = true;
      // If pause() was called while the permission popup was up (e.g., tab-
      // switch during a retry-backoff delay that made us arrive here late,
      // AFTER the popup was already dismissed), _isPaused is still true and
      // the caller's callback would take the deferred-start path. Clear it —
      // popup-dismissal is a user gesture, same semantics as the poll-
      // interval branch below.
      if (this._isPaused) {
        this._isPaused = false;
        this._pausedAt = 0;
        this._pauseSavedOffset = false;
      }
      this._flushPermissionCallbacks();
      return;
    }

    console.log("[PreviewScreen] Waiting for audio permission popup to be dismissed...");
    this._permissionPollId = setInterval(function () {
      if (self._state !== "preview") {
        clearInterval(self._permissionPollId);
        self._permissionPollId = null;
        return;
      }
      if (!isPopupVisible()) {
        clearInterval(self._permissionPollId);
        self._permissionPollId = null;
        self._audioUnlockDone = true;
        if (FeedbackManager.sound) {
          FeedbackManager.sound.unlocked = true;
          FeedbackManager.sound.unlockAttempted = true;
        }
        var bd = document.getElementById("popup-backdrop");
        if (bd) { bd.style.display = "none"; bd.style.pointerEvents = "none"; }
        console.log("[PreviewScreen] Audio permission granted, starting timer");
        // Permission-grant is a genuine user gesture. If pause() was called
        // while the permission popup was up (tab switch), clear the paused
        // state here so the deferred-start path isn't entered again. The
        // visibility listener never auto-resumes (see its header comment),
        // so without this inline clear the preview would stay frozen.
        if (self._isPaused) {
          console.log("[PreviewScreen] Clearing paused state on permission-grant");
          self._isPaused = false;
          self._pausedAt = 0;
          self._pauseSavedOffset = false;
        }
        self._flushPermissionCallbacks();
      }
    }, 150);
  };

  PreviewScreenComponent.prototype._flushPermissionCallbacks = function () {
    var cbs = this._permissionCallbacks.slice();
    this._permissionCallbacks = [];
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](); } catch (e) { this._captureError(e, { method: "_flushPermissionCallbacks" }); }
    }
  };

  /**
   * R1: play() retry with bounded attempts. On final failure, engage timer-
   *     only fallback — progress bar keeps advancing and onComplete fires at
   *     DEFAULT_TIMER_DURATION. Silent for the student (no visible error).
   * R10: retry callbacks check _playGeneration and abort on mismatch so a
   *     late retry doesn't flip avatar speaking AFTER switchToGame.
   */
  PreviewScreenComponent.prototype._playPreviewAudio = function () {
    var self = this;

    if (document.hidden || this._isPaused) {
      this._audioPendingPlay = true;
      if (!this._isPaused) {
        this._isPaused = true;
        this._pausedAt = performance.now();
      }
      console.log("[PreviewScreen] Audio start deferred — tab hidden or paused");
      return;
    }

    this._isPaused = false;
    this._playGeneration++;
    var gen = this._playGeneration;

    try {
      // R4: clamp suspicious durations.
      var rawDuration = FeedbackManager.sound.getDuration(self._audioId);
      var rawMs = (typeof rawDuration === "number" && !isNaN(rawDuration)) ? rawDuration * 1000 : NaN;
      if (!isNaN(rawMs) && rawMs >= MIN_VALID_AUDIO_DURATION_MS) {
        self._duration = rawMs;
      } else {
        self._duration = DEFAULT_TIMER_DURATION;
      }

      self._isAudioPlaying = true;
      if (self._actionBar) self._actionBar.setAvatarSpeaking(true);
      self._beginProgressBar();

      function attempt(tryIndex) {
        // R10: stale retry — switchToGame bumped _playGeneration.
        if (gen !== self._playGeneration) return;
        try {
          var playResult = FeedbackManager.sound.play(self._audioId, { volume: 1 });
          if (playResult && typeof playResult.then === "function") {
            playResult.then(function () {
              if (gen !== self._playGeneration) return;
              self._isAudioPlaying = false;
              if (self._actionBar) self._actionBar.setAvatarSpeaking(false);
            }).catch(function (err) {
              if (gen !== self._playGeneration) return;
              if (tryIndex < PLAY_MAX_RETRIES) {
                console.warn("[PreviewScreen] play() rejected (attempt " + (tryIndex + 1) + "), retrying in " + PLAY_RETRY_DELAY_MS + "ms:", err);
                setTimeout(function () { attempt(tryIndex + 1); }, PLAY_RETRY_DELAY_MS);
              } else {
                console.warn("[PreviewScreen] play() failed after retries — falling back silently (progress bar continues):", err);
                self._recordViewEvent("component_state", { audio_play_failed_final: true });
                self._isAudioPlaying = false;
                if (self._actionBar) self._actionBar.setAvatarSpeaking(false);
                // Progress bar already running — it'll complete at _duration
                // and trigger switchToGame(). No extra work needed.
              }
            });
          }
        } catch (err) {
          if (tryIndex < PLAY_MAX_RETRIES) {
            setTimeout(function () { attempt(tryIndex + 1); }, PLAY_RETRY_DELAY_MS);
          } else {
            self._captureError(err, { method: "_playPreviewAudio.attempt" });
            self._isAudioPlaying = false;
            if (self._actionBar) self._actionBar.setAvatarSpeaking(false);
          }
        }
      }

      attempt(0);
    } catch (err) {
      this._captureError(err, { method: "_playPreviewAudio" });
      this._duration = DEFAULT_TIMER_DURATION;
      this._beginProgressBar();
    }
  };

  // ============================================================
  // Preview-state progress bar (rAF) — R5 clamps elapsed overshoot
  // ============================================================

  PreviewScreenComponent.prototype._beginProgressBar = function () {
    var self = this;
    this._startTime = performance.now();
    this._elapsed = 0;
    this._totalPausedDuration = 0;

    function tick(now) {
      if (self._state !== "preview" || self._isPaused) return;

      // R5: clamp so a tab-wake spike never produces elapsed > duration.
      var elapsed = Math.min(self._duration, now - self._startTime - self._totalPausedDuration);
      self._elapsed = elapsed;
      var progress = Math.max(0, 1 - elapsed / self._duration);

      if (self._progressBar) {
        self._progressBar.style.transform = "scaleX(" + progress + ")";
      }

      if (elapsed >= self._duration) {
        self._onTimerComplete();
        return;
      }

      self._rafId = requestAnimationFrame(tick);
    }

    this._rafId = requestAnimationFrame(tick);
  };

  PreviewScreenComponent.prototype._beginResumedProgressBar = function () {
    var self = this;
    if (this._startTime === 0) return;

    function tick(now) {
      if (self._state !== "preview" || self._isPaused) return;

      var elapsed = Math.min(self._duration, now - self._startTime - self._totalPausedDuration);
      self._elapsed = elapsed;
      var progress = Math.max(0, 1 - elapsed / self._duration);

      if (self._progressBar) {
        self._progressBar.style.transform = "scaleX(" + progress + ")";
      }

      if (elapsed >= self._duration) {
        self._onTimerComplete();
        return;
      }

      self._rafId = requestAnimationFrame(tick);
    }

    this._rafId = requestAnimationFrame(tick);
  };

  PreviewScreenComponent.prototype._onTimerComplete = function () {
    if (this._state !== "preview") return;
    this._cancelRaf();
    if (this._progressBar) {
      this._progressBar.style.transform = "scaleX(0)";
    }
    this.switchToGame();
  };

  PreviewScreenComponent.prototype._cancelRaf = function () {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  };

  // ============================================================
  // pause / resume
  // ============================================================

  PreviewScreenComponent.prototype.pause = function () {
    if (this._state === "idle" || this._isPaused) return;

    try {
      this._isPaused = true;
      this._pausedAt = performance.now();

      if (this._state === "preview") {
        this._cancelRaf();
        if (this._hasAudio && typeof FeedbackManager !== "undefined" && FeedbackManager.sound) {
          try {
            if (FeedbackManager.sound.audioKit && FeedbackManager.sound.audioKit.getCurrentlyPlaying && FeedbackManager.sound.audioKit.getCurrentlyPlaying()) {
              FeedbackManager.sound.pause();
            }
            this._pauseSavedOffset = !!FeedbackManager.sound.pausedAudioId;
          } catch (e) {
            this._pauseSavedOffset = false;
          }
          this._isAudioPlaying = false;
        }
        if (this._actionBar) this._actionBar.setAvatarSpeaking(false);
      }

      this._recordViewEvent("component_state", { progressBar: "paused", elapsed: this._elapsed, state: this._state });
      console.log("[PreviewScreen] Paused (" + this._state + ")");
    } catch (err) {
      this._captureError(err, { method: "pause" });
    }
  };

  PreviewScreenComponent.prototype.resume = function () {
    if (this._state === "idle" || !this._isPaused) return;

    try {
      var pauseDuration = performance.now() - this._pausedAt;
      this._isPaused = false;

      if (this._state === "preview") {
        // Deferred-start paths — tab was hidden when start would have fired.
        if (this._audioPendingPlay) {
          this._audioPendingPlay = false;
          this._pausedAt = 0;
          console.log("[PreviewScreen] Deferred audio start — playing now");
          this._playPreviewAudio();
          this._recordViewEvent("component_state", { progressBar: "deferred-start", state: this._state });
          return;
        }
        if (this._timerPendingStart) {
          this._timerPendingStart = false;
          this._pausedAt = 0;
          this._duration = DEFAULT_TIMER_DURATION;
          console.log("[PreviewScreen] Deferred timer start — beginning now");
          this._beginProgressBar();
          this._recordViewEvent("component_state", { progressBar: "deferred-start", duration: this._duration, hasAudio: false });
          return;
        }

        this._totalPausedDuration += pauseDuration;
        if (this._hasAudio && typeof FeedbackManager !== "undefined" && FeedbackManager.sound) {
          var ak = FeedbackManager.sound.audioKit;
          var resumed = false;
          if (this._pauseSavedOffset && ak && typeof ak.resumeVoice === "function") {
            // PATH A: resume from offset
            try {
              if (typeof ak.resume === "function") {
                try { ak.resume(); } catch (e) { /* ignore */ }
              }
              resumed = ak.resumeVoice();
            } catch (e) { /* ignore */ }
          }
          if (resumed) {
            this._isAudioPlaying = true;
            if (this._actionBar) this._actionBar.setAvatarSpeaking(true);
            try { FeedbackManager.sound.pausedAudioId = null; } catch (e) {}
            console.log("[PreviewScreen] Audio resumed from offset");
          } else {
            // PATH B: fresh play synchronously (preserves gesture on mobile)
            console.log("[PreviewScreen] No paused offset — fresh play (mobile fallback)");
            try {
              this._playPreviewAudio();
            } catch (e) { /* ignore */ }
          }
          this._pauseSavedOffset = false;
        }
        this._beginResumedProgressBar();
      }

      this._recordViewEvent("component_state", { progressBar: "resumed", pausedFor: Math.round(pauseDuration), state: this._state });
      console.log("[PreviewScreen] Resumed after", Math.round(pauseDuration) + "ms pause");
    } catch (err) {
      this._captureError(err, { method: "resume" });
    }
  };

  // ============================================================
  // skip / switchToGame / destroy
  // ============================================================

  PreviewScreenComponent.prototype.isActive = function () {
    return this._state === "preview";
  };

  PreviewScreenComponent.prototype.skip = function () {
    if (this._state !== "preview") return;
    console.log("[PreviewScreen] Skipped");
    this._stopAudio();
    this._cancelRaf();
    this.switchToGame();
  };

  /**
   * Transition preview → game.
   *   - Overlay removed (game interactable)
   *   - Skip button removed
   *   - Progress bar hidden
   *   - onComplete callback fires (game code starts its logic)
   */
  PreviewScreenComponent.prototype.switchToGame = function () {
    if (this._state === "game") return;

    this._hasBeenShown = true;

    var prevState = this._state;
    this._state = "game";

    // R10: bump generation so any in-flight play-retry aborts.
    this._playGeneration++;

    var duration = Date.now() - this._showStartTime;
    this._previewData.duration = duration;

    if (this._gameContainer) {
      this._gameContainer.classList.remove("game-hidden");
    }

    this._removeOverlay();
    this._removeSkipButton();
    this._stopAudio();
    this._cancelRaf();

    // Progress bar is idle in game state.
    if (this._progressBar) {
      this._progressBar.classList.add("hidden");
      this._progressBar.style.transform = "scaleX(0)";
    }

    this._recordViewEvent("screen_transition", { from: prevState, to: "game" });

    // Fire callback (game code starts its logic)
    if (typeof this._onCompleteCallback === "function") {
      try {
        this._onCompleteCallback(this._previewData);
      } catch (err) {
        this._captureError(err, { method: "switchToGame", callback: "onComplete" });
      }
    }
  };

  PreviewScreenComponent.prototype.destroy = function () {
    this._stopAudio();
    this._cancelRaf();
    this._removeOverlay();
    this._removeSkipButton();

    if (this._visibilityListener) {
      document.removeEventListener("visibilitychange", this._visibilityListener);
      this._visibilityListener = null;
    }

    // Tear down the internal ActionBar — it owns its own listeners and rAF.
    if (this._actionBar) {
      try { this._actionBar.destroy(); } catch (e) { /* ignore */ }
      this._actionBar = null;
    }

    this._state = "idle";
    console.log("[PreviewScreen] Destroyed");
  };

  PreviewScreenComponent.prototype._stopAudio = function () {
    if (typeof FeedbackManager !== "undefined" && FeedbackManager.sound) {
      try {
        FeedbackManager.sound.stopAll();
      } catch (e) { /* ignore */ }
    }
    this._isAudioPlaying = false;
    if (this._actionBar) this._actionBar.setAvatarSpeaking(false);
  };

  // ============================================================
  // Public accessors / pass-throughs
  // ============================================================

  PreviewScreenComponent.prototype.getState = function () {
    return this._state;
  };

  PreviewScreenComponent.prototype.setPreviewData = function (key, value) {
    this._previewData[key] = value;

    if (typeof this._onPreviewInteractionCallback === "function") {
      try {
        this._onPreviewInteractionCallback({ key: key, value: value });
      } catch (e) { /* ignore */ }
    }
  };

  /**
   * Pass-through to ActionBar — runtime star visibility update.
   * Safe no-op after destroy().
   */
  PreviewScreenComponent.prototype.setStar = function (visible) {
    if (this._actionBar) this._actionBar.setStar(visible);
  };

  /**
   * Pass-through to ActionBar — runtime score-text update (e.g. "1/10").
   * Games MUST call this on correct-answer / round-advance instead of
   * re-posting `game_init`, because the game's own `message` listener
   * also processes `game_init` and would re-trigger `setupGame()`.
   */
  PreviewScreenComponent.prototype.setScore = function (text) {
    if (this._actionBar) this._actionBar.setScore(text);
  };

  /**
   * Pass-through to ActionBar — runtime question-label update (e.g. "Q2").
   * Same reasoning as setScore: call this instead of re-posting game_init.
   */
  PreviewScreenComponent.prototype.setQuestionLabel = function (text) {
    if (this._actionBar) this._actionBar.setQuestionLabel(text);
  };

  // ============================================================
  // SignalCollector
  // ============================================================

  PreviewScreenComponent.prototype._recordViewEvent = function (eventType, data) {
    var sc = this.signalCollector || window.signalCollector;
    if (sc && typeof sc.recordViewEvent === "function") {
      try {
        sc.recordViewEvent(eventType, data);
      } catch (e) { /* ignore */ }
    }
  };

  // ============================================================
  // Sentry
  // ============================================================

  PreviewScreenComponent.prototype._initSentry = function () {
    var self = this;

    if (typeof Sentry !== "undefined" && typeof Sentry.isInitialized === "function" && Sentry.isInitialized()) {
      this._onSentryReady();
      return;
    }

    if (typeof Sentry !== "undefined" && typeof Sentry.init === "function") {
      this._initSentrySDK();
      this._onSentryReady();
      return;
    }

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
      console.warn("[PreviewScreen] Failed to load Sentry SDK from CDN");
    };
    (document.head || document.documentElement).appendChild(script);
  };

  PreviewScreenComponent.prototype._initSentrySDK = function () {
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
      console.warn("[PreviewScreen] Sentry init failed:", e);
    }
  };

  PreviewScreenComponent.prototype._onSentryReady = function () {
    this._sentryReady = true;

    try {
      Sentry.setTag("preview_screen_version", VERSION);
    } catch (e) { /* ignore */ }

    for (var i = 0; i < this._sentryQueue.length; i++) {
      var q = this._sentryQueue[i];
      this._captureError(q.err, q.context);
    }
    this._sentryQueue = [];
  };

  PreviewScreenComponent.prototype._captureError = function (err, context) {
    if (!this._sentryReady) {
      this._sentryQueue.push({ err: err, context: context || {} });
      return;
    }
    try {
      Sentry.captureException(err, {
        tags: {
          component: "preview_screen",
          preview_screen: VERSION,
          game_id: (context && context.game_id) || "unknown",
          play_id: (context && context.play_id) || "unknown"
        },
        extra: {
          state: this._state,
          is_audio_playing: this._isAudioPlaying,
          is_paused: this._isPaused,
          elapsed: this._elapsed,
          duration: this._duration,
          context: context || {}
        }
      });
    } catch (e) { /* ignore */ }
  };

  // ============================================================
  // Export
  // ============================================================

  window.PreviewScreenComponent = PreviewScreenComponent;
  window.PreviewScreen = PreviewScreenComponent;

  console.log("[MathAI] PreviewScreenComponent v" + VERSION + " loaded");
})(window);
