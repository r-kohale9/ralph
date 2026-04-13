/**
 * PreviewScreenComponent v2 — Persistent game wrapper
 *
 * The preview screen is a PERSISTENT WRAPPER for the entire game session.
 * It has two states:
 *   1. preview — instruction + non-interactable game overlay + skip button + audio
 *   2. game    — interactable game content + optional timer in header
 *
 * The header bar (avatar, stars, back, label) persists in BOTH states.
 *
 * DOM structure is created by ScreenLayoutComponent. PreviewScreenComponent
 * populates content, manages state transitions, and syncs the header timer
 * with the game's TimerComponent.
 *
 * @version 2.0.0
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

  var VERSION = "2.0.0";
  var SPEAKING_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_speaking_avatar.mp4";
  var SILENT_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_silent_avatar.mp4";
  var STAR_CDN_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/images/star-full.png";
  var DEFAULT_TIMER_DURATION = 5000;
  var FEEDBACK_MANAGER_CDN =
    "https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js";

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

    // Show-once guard: preview is shown only on first show() call per session.
    // Subsequent show() calls (e.g. from restartGame → setupGame) auto-skip
    // to game state and fire onComplete synchronously.
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

    // Play generation counter (prevents stale promise resolutions)
    this._playGeneration = 0;

    // Deferred-start flags: if the tab goes hidden between permission grant
    // and the moment audio/timer would start, we mark the start as pending
    // and let resume() actually kick it off when the tab is visible again.
    this._audioPendingPlay = false;
    this._pendingAudioUrl = null;
    this._timerPendingStart = false;

    // Game-state timer sync
    this._timerConfig = null;       // { type: 'decrease'|'increase', startTime, endTime }
    this._timerInstance = null;     // TimerComponent reference
    this._timerSyncRafId = null;

    // Sentry
    this._sentryReady = false;
    this._sentryQueue = [];

    // DOM refs (filled in injectIntoSlot)
    this._header = null;
    this._headerLeft = null;
    this._headerRight = null;
    this._progressBar = null;
    this._timerTextEl = null;
    this._instructionArea = null;
    this._gameContainer = null;
    this._gameStack = null;
    this._overlay = null;
    this._skipWrap = null;
    this._speakingVideo = null;
    this._silentVideo = null;
    this._questionLabelEl = null;
    this._scoreEl = null;
    this._starEl = null;

    // game_init payload data
    this._gameInitData = null;

    var self = this;
    this._gameInitListener = function (event) {
      if (event.data && event.data.type === "game_init" && event.data.data) {
        self._gameInitData = event.data.data;
        self._populateHeaderFromGameInit();
      }
    };
    window.addEventListener("message", this._gameInitListener);

    // Visibility safety net
    this._visibilityListener = function () {
      if (document.hidden && self._state === "preview" && !self._isPaused) {
        self.pause();
      }
    };
    document.addEventListener("visibilitychange", this._visibilityListener);

    // Init
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
      /* Preview slot — the persistent wrapper. NO height cap, NO overflow hidden.
         Content flows naturally and the page scrolls as one unit. */
      ".mathai-preview-slot {" +
      "  position: relative;" +
      "  max-width: var(--mathai-game-max-width, 480px);" +
      "  margin: 0 auto;" +
      "  background: #fff;" +
      "  min-height: 100dvh;" +
      "  width: 100%;" +
      "  box-sizing: border-box;" +
      "  overflow: visible;" +
      "}" +

      /* Header bar — fixed at top */
      ".mathai-preview-header {" +
      "  position: fixed; top: 0; left: 0; right: 0;" +
      "  height: 56px; background: #fff; z-index: 20;" +
      "  display: flex; align-items: center;" +
      "  padding: 0 12px; box-sizing: border-box;" +
      "  overflow: hidden;" +
      "  max-width: var(--mathai-game-max-width, 480px); margin: 0 auto;" +
      "}" +
      ".mathai-preview-header-progress {" +
      "  position: absolute; top: 0; left: 0; bottom: 0;" +
      "  background: #D7FFFF;" +
      "  width: 100%; transform-origin: left;" +
      "  transition: none;" +
      "}" +
      ".mathai-preview-header-progress.game-decrease {" +
      "  background: rgba(255, 246, 0, 0.2);" + /* cadmium yellow @ 20% opacity */
      "}" +
      ".mathai-preview-header-progress.hidden {" +
      "  display: none;" +
      "}" +
      ".mathai-preview-header-content {" +
      "  position: relative; z-index: 1;" +
      "  display: flex; align-items: center;" +
      "  width: 100%; justify-content: space-between;" +
      "  gap: 8px;" +
      "}" +
      ".mathai-preview-header-left {" +
      "  display: flex; align-items: center; gap: 8px;" +
      "}" +
      ".mathai-preview-header-center {" +
      "  flex: 1; display: flex; align-items: center; justify-content: center;" +
      "}" +
      ".mathai-preview-timer-text {" +
      "  display: none;" +
      "  font-weight: 700; font-size: 18px; color: #270F36;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "  font-variant-numeric: tabular-nums;" +
      "}" +
      ".mathai-preview-timer-text.visible {" +
      "  display: inline-block;" +
      "}" +
      ".mathai-preview-back-btn {" +
      "  background: none; border: none; cursor: pointer;" +
      "  padding: 4px; display: flex; align-items: center;" +
      "}" +
      ".mathai-preview-avatar-wrap {" +
      "  width: 40px; height: 40px; border-radius: 20%;" +
      "  overflow: hidden; position: relative; flex-shrink: 0;" +
      "}" +
      ".mathai-preview-avatar-wrap video {" +
      "  width: 100%; height: 100%;" +
      "  object-fit: cover; object-position: 10% 25%;" +
      "  position: absolute; top: 0; left: 0;" +
      "}" +
      ".mathai-preview-question-label {" +
      "  font-weight: 700; font-size: 16px; color: #270F36;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-header-right {" +
      "  display: flex; align-items: center; gap: 6px;" +
      "}" +
      ".mathai-preview-score {" +
      "  font-weight: 700; font-size: 16px; line-height: 22px; color: #270F36;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-star {" +
      "  width: 32px; height: 32px;" +
      "}" +

      /* Body — single scroll area below fixed header */
      ".mathai-preview-body {" +
      "  padding: 80px 16px 100px 16px;" +
      "  text-align: left;" +
      "  box-sizing: border-box;" +
      "  min-height: 100dvh;" +
      "}" +
      ".mathai-preview-instruction {" +
      "  font-weight: 400; font-size: 16px; line-height: 21px;" +
      "  padding: 0 16px 20px 16px;" +
      "  color: #333333;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-instruction:empty {" +
      "  display: none;" +
      "}" +
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

      /* CRITICAL: kill nested scroll — .game-stack's base CSS sets overflow-y:auto
         which creates its own scroll container inside the preview body. Inside the
         preview wrapper, everything must flow as ONE scroll area (instruction +
         game content). Override to let content size naturally. */
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
      ".mathai-preview-skip-btn:active {" +
      "  border-color: #270F36;" +
      "}";

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

    // Find skeleton elements (created by ScreenLayout)
    this._header = this.container.querySelector(".mathai-preview-header");
    this._progressBar = this.container.querySelector("#previewProgressBar");
    this._timerTextEl = this.container.querySelector("#previewTimerText");
    this._headerLeft = this.container.querySelector(".mathai-preview-header-left");
    this._headerRight = this.container.querySelector(".mathai-preview-header-right");
    this._instructionArea = this.container.querySelector("#previewInstruction");
    this._gameContainer = this.container.querySelector("#previewGameContainer");
    this._gameStack = this._gameContainer && this._gameContainer.querySelector(".game-stack");

    if (!this._header || !this._gameContainer || !this._gameStack) {
      throw new Error(
        "PreviewScreen: Slot skeleton incomplete. " +
        "Ensure ScreenLayout v2.0+ is used with slots.previewScreen: true."
      );
    }

    // Populate header left (back btn + avatar + question label)
    this._headerLeft.innerHTML =
      '<button class="mathai-preview-back-btn" id="previewBackBtn">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#270F36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="15 18 9 12 15 6"></polyline>' +
        '</svg>' +
      '</button>' +
      '<div class="mathai-preview-avatar-wrap">' +
        '<video id="previewAvatarSpeaking" src="' + SPEAKING_AVATAR_URL + '" autoplay loop muted playsinline style="display:none;"></video>' +
        '<video id="previewAvatarSilent" src="' + SILENT_AVATAR_URL + '" autoplay loop muted playsinline></video>' +
      '</div>' +
      '<span class="mathai-preview-question-label" id="previewQuestionLabel"></span>';

    // Populate header right (score + star)
    this._headerRight.innerHTML =
      '<span class="mathai-preview-score" id="previewScore"></span>' +
      '<img class="mathai-preview-star" id="previewStar" src="' + STAR_CDN_URL + '" alt="star" />';

    // Cache video/label refs
    this._speakingVideo = document.getElementById("previewAvatarSpeaking");
    this._silentVideo = document.getElementById("previewAvatarSilent");
    this._questionLabelEl = document.getElementById("previewQuestionLabel");
    this._scoreEl = document.getElementById("previewScore");
    this._starEl = document.getElementById("previewStar");

    // Wire back button
    var self = this;
    var backBtn = document.getElementById("previewBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        try {
          window.parent.postMessage({ type: "WORKSHEET_BACK" }, "*");
        } catch (e) {
          self._captureError(e, { action: "back_button" });
        }
      });
    }
  };

  PreviewScreenComponent.prototype._populateHeaderFromGameInit = function () {
    var d = this._gameInitData || {};
    if (this._questionLabelEl) this._questionLabelEl.textContent = d.questionLabel || "Q1";
    if (this._scoreEl) this._scoreEl.textContent = d.score || "0/3";
    if (this._starEl) this._starEl.style.display = d.showStar !== false ? "inline-block" : "none";
  };

  // ============================================================
  // show() — enter preview state
  // ============================================================

  /**
   * @param {object} config
   * @param {string} config.instruction - HTML string
   * @param {string} config.audioUrl - Audio URL (optional)
   * @param {boolean} config.showGameOnPreview - Show game underneath overlay (default false)
   * @param {object} config.timerConfig - { type: 'decrease'|'increase', startTime, endTime }
   * @param {object} config.timerInstance - Reference to game's TimerComponent
   * @param {function} config.onComplete - Called when preview transitions to game state
   * @param {function} config.onPreviewInteraction - Called when setPreviewData is invoked
   */
  PreviewScreenComponent.prototype.show = function (config) {
    var self = this;
    config = config || {};

    // Show-once guard: if the preview has already been COMPLETED (user saw it
    // and either skipped or waited for timer), skip directly to game state.
    // This handles restartGame() → setupGame() → showPreviewScreen() without
    // forcing the player through the preview again.
    //
    // NOTE: _hasBeenShown is set in switchToGame(), NOT here. This means:
    //   - First show() with fallback content → enters preview state (flag is false)
    //   - game_init arrives, calls show() again before user finished preview →
    //     flag is still false → re-enters preview with real content (correct!)
    //   - User skips/timer completes → switchToGame() sets flag to true
    //   - restartGame calls show() → flag is true → auto-skips (correct!)
    if (this._hasBeenShown) {
      this._state = "game";
      this._timerConfig = config.timerConfig || null;
      this._timerInstance = config.timerInstance || null;
      this._previewData = { duration: 0, skippedRepeat: true };
      if (this._gameContainer) this._gameContainer.classList.remove("game-hidden");
      this._removeOverlay();
      this._removeSkipButton();
      this._configureGameStateHeader();
      if (this._timerInstance && this._timerConfig) this._startGameTimerSync();
      if (typeof config.onComplete === "function") {
        try { config.onComplete(this._previewData); } catch (e) { this._captureError(e, { method: "show", autoSkip: true }); }
      }
      console.log("[PreviewScreen] Already shown — skipped to game state");
      return;
    }

    try {
      // Clean up any in-flight audio/timer from a prior show() call
      // (e.g. game_init arrived with real content while fallback preview was playing)
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
      this._timerConfig = config.timerConfig || null;
      this._timerInstance = config.timerInstance || null;

      // Populate header from any prior game_init payload
      this._populateHeaderFromGameInit();

      // Reset progress bar to preview state (blue, full)
      if (this._progressBar) {
        this._progressBar.classList.remove("game-decrease", "hidden");
        this._progressBar.style.transform = "scaleX(1)";
      }

      // Hide timer text in preview state
      if (this._timerTextEl) {
        this._timerTextEl.classList.remove("visible");
        this._timerTextEl.textContent = "";
      }

      // Instruction
      if (this._instructionArea) {
        this._instructionArea.innerHTML = config.instruction || "";
      }

      // Game stack visibility — hidden by default unless showGameOnPreview
      if (config.showGameOnPreview) {
        this._gameContainer.classList.remove("game-hidden");
      } else {
        this._gameContainer.classList.add("game-hidden");
      }

      // Add overlay (non-interactable)
      this._addOverlay();

      // Add skip button
      this._addSkipButton();

      // Avatar: start with silent
      this._setAvatarState(false);

      // Signal: screen transition
      this._recordViewEvent("screen_transition", { from: "init", to: "preview" });
      this._recordViewEvent("content_render", { instruction: !!config.instruction, showGameOnPreview: !!config.showGameOnPreview });

      // BUG FIX: if the tab is already hidden when show() is called (e.g.,
      // game opened in a background tab), pre-pause so the audio/timer flow
      // takes the deferred-start path.
      if (document.hidden) {
        this._isPaused = true;
        this._pausedAt = performance.now();
        console.log("[PreviewScreen] show() called with hidden tab — entering paused state");
      }

      // Audio / Timer flow
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
    var skipBtn = document.getElementById("previewSkipBtn");
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
  // Runtime TTS fallback
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

    try {
      fetch(TTS_API_URL + "?sendUrl=true&text=" + encodeURIComponent(text))
        .then(function (res) {
          if (!res.ok) throw new Error("TTS API returned " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data.audio_url && self._state === "preview") {
            self._hasAudio = true;
            self._startWithAudio(data.audio_url);
          } else {
            self._startWithTimer();
          }
        })
        .catch(function () {
          if (self._state === "preview") self._startWithTimer();
        });
    } catch (e) {
      this._startWithTimer();
    }
  };

  // ============================================================
  // Audio flow
  // ============================================================

  PreviewScreenComponent.prototype._ensureFeedbackManager = function (callback) {
    if (typeof FeedbackManager !== "undefined" && FeedbackManager.sound) {
      callback();
      return;
    }

    var script = document.createElement("script");
    script.src = FEEDBACK_MANAGER_CDN;
    script.onload = function () {
      if (typeof FeedbackManager !== "undefined") {
        if (typeof FeedbackManager.init === "function") {
          FeedbackManager.init();
        }
        callback();
      }
    };
    script.onerror = function () {
      console.warn("[PreviewScreen] Failed to load FeedbackManager — falling back to timer");
      callback();
    };
    document.head.appendChild(script);
  };

  PreviewScreenComponent.prototype._startWithAudio = function (audioUrl) {
    var self = this;
    this._pendingAudioUrl = audioUrl; // remembered for deferred-start path

    this._ensureFeedbackManager(function () {
      if (!FeedbackManager || !FeedbackManager.sound) {
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

      try {
        var preloadPromise = FeedbackManager.sound.preload([{ id: self._audioId, url: audioUrl }]);
        if (preloadPromise && typeof preloadPromise.then === "function") {
          preloadPromise.then(function () {
            preloadDone = true;
            tryPlay();
          }).catch(function (err) {
            console.warn("[PreviewScreen] Audio preload failed:", err);
            self._startWithTimer();
          });
        } else {
          preloadDone = true;
        }
      } catch (err) {
        self._captureError(err, { method: "_startWithAudio", audioUrl: audioUrl });
        self._startWithTimer();
        return;
      }

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
        // BUG FIX: defer if tab is hidden so the timer doesn't tick down in background
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

    if (!FeedbackManager || !FeedbackManager.sound) {
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

  PreviewScreenComponent.prototype._playPreviewAudio = function () {
    var self = this;

    // BUG FIX: Defer audio start if the tab is hidden or we are already in
    // a paused state (e.g. visibility listener fired between permission grant
    // and this call). resume() will pick this up and start the audio.
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
      var duration = FeedbackManager.sound.getDuration(self._audioId);
      if (duration && duration > 0) {
        self._duration = duration * 1000;
      } else {
        self._duration = DEFAULT_TIMER_DURATION;
      }

      // FeedbackManager.SoundManager.play() does NOT forward onplay/onerror
      // callbacks to the underlying audioKit, so we cannot rely on them.
      // Set the avatar to speaking state synchronously and start the progress
      // bar immediately. Then watch the playAndWait promise to detect when
      // audio finishes, so we can flip the avatar back to silent.
      self._isAudioPlaying = true;
      self._setAvatarState(true);
      self._beginProgressBar();

      var playResult = FeedbackManager.sound.play(this._audioId, {
        volume: 1,
      });

      if (playResult && typeof playResult.then === "function") {
        playResult.then(function () {
          if (gen !== self._playGeneration) return;
          // Audio finished naturally — flip avatar back to silent.
          // Progress bar continues independently and triggers switchToGame.
          self._isAudioPlaying = false;
          self._setAvatarState(false);
        }).catch(function (err) {
          if (gen !== self._playGeneration) return;
          console.warn("[PreviewScreen] play() rejected:", err);
          self._isAudioPlaying = false;
          self._setAvatarState(false);
        });
      }
    } catch (err) {
      this._captureError(err, { method: "_playPreviewAudio" });
      this._duration = DEFAULT_TIMER_DURATION;
      this._beginProgressBar();
    }
  };

  // ============================================================
  // Preview-state progress bar (rAF)
  // ============================================================

  PreviewScreenComponent.prototype._beginProgressBar = function () {
    var self = this;
    this._startTime = performance.now();
    this._elapsed = 0;
    this._totalPausedDuration = 0;

    function tick(now) {
      if (self._state !== "preview" || self._isPaused) return;

      var elapsed = now - self._startTime - self._totalPausedDuration;
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
  // Avatar
  // ============================================================

  PreviewScreenComponent.prototype._setAvatarState = function (isSpeaking) {
    if (this._speakingVideo) {
      this._speakingVideo.style.display = isSpeaking ? "block" : "none";
    }
    if (this._silentVideo) {
      this._silentVideo.style.display = isSpeaking ? "none" : "block";
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
        if (this._hasAudio && FeedbackManager && FeedbackManager.sound) {
          // Pause the active voice — internally calls audioKit.pauseVoice()
          // which saves pausedOffset and stops the BufferSource. Resume will
          // restart playback from that exact offset.
          //
          // We track whether a pausedVoice was actually saved. On mobile, the
          // browser may auto-finalize the BufferSource when audioCtx suspends
          // BEFORE this listener runs, leaving voice=null. In that case
          // pauseVoice() returns null, no pausedVoice is saved, and resume
          // can't restore. We detect this by checking pausedAudioId AFTER
          // calling pause, and fall back to deferred-fresh-play if saving
          // the offset failed.
          try {
            if (FeedbackManager.sound.audioKit.getCurrentlyPlaying()) {
              FeedbackManager.sound.pause();
            }
            // Did the underlying pauseVoice() actually save a pausedVoice?
            // SoundManager.pause() sets pausedAudioId only if pausedVoice
            // was successfully saved.
            this._pauseSavedOffset = !!FeedbackManager.sound.pausedAudioId;
          } catch (e) {
            this._pauseSavedOffset = false;
          }
          this._isAudioPlaying = false;
        }
        this._setAvatarState(false);
      } else if (this._state === "game") {
        // In game state, just stop syncing — game owns the timer
        this._stopGameTimerSync();
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
        // BUG FIX: deferred-start path — audio/timer never began because the
        // tab was hidden when permission was granted. Start it now (no pause
        // duration accumulation since nothing was playing).
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
        if (this._hasAudio && FeedbackManager && FeedbackManager.sound) {
          // Two paths depending on whether pause() actually saved a paused
          // voice with offset:
          //
          //   PATH A — offset was saved: bypass SoundManager.sound.resume()
          //   (its internal `await audioKit.resume()` consumes the user
          //   gesture on mobile) and call audioKit.resumeVoice() directly,
          //   fully synchronously inside the click handler. This restarts
          //   playback from the saved offset.
          //
          //   PATH B — no offset saved (mobile auto-finalized the
          //   BufferSource when audioCtx suspended, OR the audio was already
          //   finished): fall back to a fresh play() of the same audio from
          //   the beginning. We use the deferred-start path which calls
          //   _playPreviewAudio() synchronously inside this resume() call,
          //   preserving the user gesture for mobile.
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
            this._setAvatarState(true);
            // Clear FeedbackManager's pausedAudioId since we just consumed
            // the pausedVoice — keeps SoundManager state consistent for any
            // subsequent pause/resume cycles.
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
      } else if (this._state === "game") {
        this._startGameTimerSync();
      }

      this._recordViewEvent("component_state", { progressBar: "resumed", pausedFor: Math.round(pauseDuration), state: this._state });
      console.log("[PreviewScreen] Resumed after", Math.round(pauseDuration) + "ms pause");
    } catch (err) {
      this._captureError(err, { method: "resume" });
    }
  };

  PreviewScreenComponent.prototype._beginResumedProgressBar = function () {
    var self = this;
    if (this._startTime === 0) return;

    function tick(now) {
      if (self._state !== "preview" || self._isPaused) return;

      var elapsed = now - self._startTime - self._totalPausedDuration;
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

  // ============================================================
  // skip / switchToGame / destroy
  // ============================================================

  PreviewScreenComponent.prototype.skip = function () {
    if (this._state !== "preview") return;
    console.log("[PreviewScreen] Skipped");
    this._stopAudio();
    this._cancelRaf();
    this.switchToGame();
  };

  /**
   * Transition from preview state to game state.
   * - Removes overlay (game becomes interactable)
   * - Hides skip button
   * - Configures progress bar / timer text based on timerConfig
   * - Fires onComplete callback (game code starts its logic)
   */
  PreviewScreenComponent.prototype.switchToGame = function () {
    if (this._state === "game") return;

    // Mark preview as completed — subsequent show() calls will auto-skip.
    this._hasBeenShown = true;

    var prevState = this._state;
    this._state = "game";

    var duration = Date.now() - this._showStartTime;
    this._previewData.duration = duration;

    // Reveal game stack if it was hidden
    if (this._gameContainer) {
      this._gameContainer.classList.remove("game-hidden");
    }

    // Remove preview-state UI
    this._removeOverlay();
    this._removeSkipButton();
    this._stopAudio();
    this._cancelRaf();

    // Configure header for game state
    this._configureGameStateHeader();

    this._recordViewEvent("screen_transition", { from: prevState, to: "game" });

    // Fire callback (game code starts its logic, including timer.start())
    if (typeof this._onCompleteCallback === "function") {
      try {
        this._onCompleteCallback(this._previewData);
      } catch (err) {
        this._captureError(err, { method: "switchToGame", callback: "onComplete" });
      }
    }

    // Start timer sync after callback (so game has started its timer)
    if (this._timerInstance && this._timerConfig) {
      this._startGameTimerSync();
    }
  };

  PreviewScreenComponent.prototype._configureGameStateHeader = function () {
    if (!this._progressBar || !this._timerTextEl) return;

    if (!this._timerConfig) {
      // No timer — hide progress bar entirely, no timer text
      this._progressBar.classList.add("hidden");
      this._timerTextEl.classList.remove("visible");
      return;
    }

    if (this._timerConfig.type === "decrease") {
      // Orange progress bar + timer text overlay
      this._progressBar.classList.remove("hidden");
      this._progressBar.classList.add("game-decrease");
      this._progressBar.style.transform = "scaleX(1)";
      this._timerTextEl.classList.add("visible");
    } else if (this._timerConfig.type === "increase") {
      // No progress bar fill, just timer text
      this._progressBar.classList.add("hidden");
      this._timerTextEl.classList.add("visible");
    } else {
      this._progressBar.classList.add("hidden");
      this._timerTextEl.classList.remove("visible");
    }
  };

  PreviewScreenComponent.prototype._startGameTimerSync = function () {
    var self = this;
    if (!this._timerInstance || !this._timerConfig) return;
    this._stopGameTimerSync();

    function sync() {
      if (self._state !== "game" || self._isPaused) {
        self._timerSyncRafId = null;
        return;
      }

      var timer = self._timerInstance;
      if (!timer) { self._timerSyncRafId = null; return; }

      // Update timer text
      if (self._timerTextEl && typeof timer.getFormattedTime === "function") {
        self._timerTextEl.textContent = timer.getFormattedTime();
      }

      // Update progress bar (decreasing only)
      if (self._timerConfig.type === "decrease" && self._progressBar) {
        var start = (typeof self._timerConfig.startTime === "number")
          ? self._timerConfig.startTime
          : (timer.config && timer.config.startTime) || 0;
        var end = (typeof self._timerConfig.endTime === "number")
          ? self._timerConfig.endTime
          : (timer.config && timer.config.endTime) || 0;
        var current = (typeof timer.getCurrentTime === "function") ? timer.getCurrentTime() : start;
        var total = Math.max(1, start - end);
        var elapsed = Math.max(0, start - current);
        var progress = Math.max(0, Math.min(1, 1 - elapsed / total));
        self._progressBar.style.transform = "scaleX(" + progress + ")";
      }

      self._timerSyncRafId = requestAnimationFrame(sync);
    }

    this._timerSyncRafId = requestAnimationFrame(sync);
  };

  PreviewScreenComponent.prototype._stopGameTimerSync = function () {
    if (this._timerSyncRafId) {
      cancelAnimationFrame(this._timerSyncRafId);
      this._timerSyncRafId = null;
    }
  };

  PreviewScreenComponent.prototype.destroy = function () {
    this._stopAudio();
    this._cancelRaf();
    this._stopGameTimerSync();
    this._removeOverlay();
    this._removeSkipButton();

    if (this._gameInitListener) {
      window.removeEventListener("message", this._gameInitListener);
      this._gameInitListener = null;
    }
    if (this._visibilityListener) {
      document.removeEventListener("visibilitychange", this._visibilityListener);
      this._visibilityListener = null;
    }

    this._state = "idle";
    console.log("[PreviewScreen] Destroyed");
  };

  PreviewScreenComponent.prototype._stopAudio = function () {
    if (FeedbackManager && FeedbackManager.sound) {
      try {
        FeedbackManager.sound.stopAll();
      } catch (e) { /* ignore */ }
    }
    this._isAudioPlaying = false;
    this._setAvatarState(false);
  };

  // ============================================================
  // Public state accessor
  // ============================================================

  PreviewScreenComponent.prototype.getState = function () {
    return this._state;
  };

  // ============================================================
  // setPreviewData — for preview content interaction capture
  // ============================================================

  PreviewScreenComponent.prototype.setPreviewData = function (key, value) {
    this._previewData[key] = value;

    if (typeof this._onPreviewInteractionCallback === "function") {
      try {
        this._onPreviewInteractionCallback({ key: key, value: value });
      } catch (e) { /* ignore */ }
    }
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
  // Sentry Integration
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
