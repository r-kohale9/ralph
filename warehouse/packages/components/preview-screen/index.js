/**
 * PreviewScreenComponent
 * Shows a preview/instruction screen before the game starts.
 * Includes: header bar (back, avatar, question label, score, star),
 * timer progress bar, instruction text, preview content area,
 * and a "Skip & show options" button.
 *
 * @version 1.0.0
 * @license MIT
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.PreviewScreenComponent !== "undefined") {
    console.log(
      "[PreviewScreenComponent] Already loaded, skipping duplicate execution"
    );
    return;
  }

  // ============================================================
  // Constants
  // ============================================================

  var VERSION = "1.0.0";
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
  // Class: PreviewScreenComponent
  // ============================================================

  /**
   * @param {object} config
   * @param {boolean} config.autoInject - Auto-find and inject into slot (default: true)
   * @param {string} config.slotId - Slot ID (default: 'mathai-preview-slot')
   * @param {string} config.gameContentId - Game content ID to toggle (default: 'gameContent')
   * @param {object} config.signalCollector - Optional SignalCollector instance
   */
  function PreviewScreenComponent(config) {
    config = config || {};
    this.config = {
      autoInject: config.autoInject !== false,
      slotId: config.slotId || "mathai-preview-slot",
      gameContentId: config.gameContentId || "gameContent",
    };

    this.container = null;
    this.gameContent = null;
    this.signalCollector = config.signalCollector || window.signalCollector || null;

    // State
    this._isActive = false;
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

    // Play generation counter (prevents stale promise resolutions from affecting avatar)
    this._playGeneration = 0;

    // Sentry
    this._sentryReady = false;
    this._sentryQueue = [];

    // DOM refs
    this._progressBar = null;
    this._speakingVideo = null;
    this._silentVideo = null;
    this._instructionArea = null;
    this._previewContentArea = null;

    // game_init payload data (questionLabel, score, showStar come from here)
    this._gameInitData = null;

    // Listen for game_init to capture header data
    var self = this;
    this._gameInitListener = function (event) {
      if (event.data && event.data.type === "game_init" && event.data.data) {
        self._gameInitData = event.data.data;
      }
    };
    window.addEventListener("message", this._gameInitListener);

    // Self-managed visibility handling — safety net in case external code
    // (e.g. VisibilityTracker) doesn't call pause() on tab switch.
    this._visibilityListener = function () {
      if (document.hidden && self._isActive && !self._isPaused) {
        self.pause();
      }
    };
    document.addEventListener("visibilitychange", this._visibilityListener);

    // Init
    this.injectStyles();
    if (this.config.autoInject) {
      this.injectIntoSlot();
    }
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
      /* Header bar */
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
      ".mathai-preview-header-content {" +
      "  position: relative; z-index: 1;" +
      "  display: flex; align-items: center;" +
      "  width: 100%; justify-content: space-between;" +
      "}" +
      ".mathai-preview-header-left {" +
      "  display: flex; align-items: center; gap: 8px;" +
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

      /* Preview slot container — match game-wrapper sizing */
      "#mathai-preview-slot {" +
      "  max-width: var(--mathai-game-max-width, 480px);" +
      "  margin: 0 auto; background: #fff; min-height: 100dvh;" +
      "}" +

      /* Instruction area */
      ".mathai-preview-body {" +
      "  padding: 80px 32px 0 32px;" +
      "  text-align: left;" +
      "}" +
      ".mathai-preview-instruction {" +
      "  font-weight: 400; font-size: 16px; line-height: 21px; padding-bottom: 20px;" +
      "  color: #333333;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-instruction img { max-width: 100%; height: auto; }" +
      ".mathai-preview-instruction video { width: 100%; }" +

      /* Skip button — matches FlowButton from mathai-client */
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
  // DOM setup
  // ============================================================

  PreviewScreenComponent.prototype.injectIntoSlot = function () {
    this.container = document.getElementById(this.config.slotId);

    if (!this.container) {
      console.warn("[PreviewScreen] Slot #" + this.config.slotId + " not found");
      // Create as sibling of .game-wrapper inside .page-center
      var pageCenter = document.querySelector(".page-center");
      var gameWrapper = document.querySelector(".game-wrapper");
      if (pageCenter && gameWrapper) {
        this.container = document.createElement("div");
        this.container.id = this.config.slotId;
        this.container.style.display = "none";
        pageCenter.insertBefore(this.container, gameWrapper);
        console.log("[PreviewScreen] Created fallback slot in .page-center (before .game-wrapper)");
      } else {
        throw new Error(
          "PreviewScreen: No .page-center/.game-wrapper found. Call ScreenLayout.inject() first."
        );
      }
    }

    // Cache game-wrapper — we toggle the entire wrapper (not just gameContent)
    this.gameWrapper = document.querySelector(".game-wrapper");

    this._buildStructure();
  };

  PreviewScreenComponent.prototype._buildStructure = function () {
    this.container.innerHTML =
      '<div class="mathai-preview-header">' +
        '<div class="mathai-preview-header-progress" id="previewProgressBar"></div>' +
        '<div class="mathai-preview-header-content">' +
          '<div class="mathai-preview-header-left">' +
            '<button class="mathai-preview-back-btn" id="previewBackBtn">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#270F36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="15 18 9 12 15 6"></polyline>' +
              '</svg>' +
            '</button>' +
            '<div class="mathai-preview-avatar-wrap">' +
              '<video id="previewAvatarSpeaking" src="' + SPEAKING_AVATAR_URL + '" autoplay loop muted playsinline style="display:none;"></video>' +
              '<video id="previewAvatarSilent" src="' + SILENT_AVATAR_URL + '" autoplay loop muted playsinline></video>' +
            '</div>' +
            '<span class="mathai-preview-question-label" id="previewQuestionLabel"></span>' +
          '</div>' +
          '<div class="mathai-preview-header-right">' +
            '<span class="mathai-preview-score" id="previewScore"></span>' +
            '<img class="mathai-preview-star" id="previewStar" src="' + STAR_CDN_URL + '" alt="star" />' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mathai-preview-body">' +
        '<div class="mathai-preview-instruction" id="previewInstruction"></div>' +
        '<div class="mathai-preview-content-area" id="previewContentArea"></div>' +
      '</div>' +
      '<div class="mathai-preview-skip-wrap">' +
        '<button class="mathai-preview-skip-btn" id="previewSkipBtn">Skip &amp; show options</button>' +
      '</div>';

    // Cache DOM refs
    this._progressBar = document.getElementById("previewProgressBar");
    this._speakingVideo = document.getElementById("previewAvatarSpeaking");
    this._silentVideo = document.getElementById("previewAvatarSilent");
    this._instructionArea = document.getElementById("previewInstruction");
    this._previewContentArea = document.getElementById("previewContentArea");

    // Event delegation
    this._setupEventDelegation();
  };

  PreviewScreenComponent.prototype._setupEventDelegation = function () {
    var self = this;

    // Back button
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

    // Skip button
    var skipBtn = document.getElementById("previewSkipBtn");
    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        self.skip();
      });
    }
  };

  // ============================================================
  // show()
  // ============================================================

  /**
   * @param {object} config
   * @param {string} config.instruction - HTML string
   * @param {string} config.audioUrl
   * @param {string} config.previewContent - pre-rendered HTML string
   * @param {function} config.onComplete - callback(previewData)
   * @param {function} config.onPreviewInteraction - callback(interactionData)
   * Note: questionLabel, score, showStar are read from game_init payload automatically
   */
  PreviewScreenComponent.prototype.show = function (config) {
    var self = this;
    config = config || {};

    try {
      this._isActive = true;
      this._isPaused = false;
      this._elapsed = 0;
      this._totalPausedDuration = 0;
      this._previewData = {};
      this._showStartTime = Date.now();
      this._onCompleteCallback = config.onComplete || null;
      this._onPreviewInteractionCallback = config.onPreviewInteraction || null;
      this._hasAudio = !!config.audioUrl;

      // Hide entire game-wrapper (progress bar, game content, everything), show preview
      if (this.gameWrapper) this.gameWrapper.style.display = "none";
      this.container.style.display = "block";

      // Populate header from game_init payload (not from game code config)
      var d = this._gameInitData || {};
      var labelEl = document.getElementById("previewQuestionLabel");
      if (labelEl) labelEl.textContent = d.questionLabel || "Q1";

      var scoreEl = document.getElementById("previewScore");
      if (scoreEl) scoreEl.textContent = d.score || "0/3";

      var starEl = document.getElementById("previewStar");
      if (starEl) starEl.style.display = (d.showStar !== false) ? "inline-block" : "none";

      // Reset progress bar
      if (this._progressBar) {
        this._progressBar.style.transform = "scaleX(1)";
      }

      // Instruction
      if (this._instructionArea) {
        this._instructionArea.innerHTML = config.instruction || "";
      }

      // Preview content area
      if (this._previewContentArea) {
        if (config.previewContent) {
          this._previewContentArea.innerHTML = config.previewContent;
          this._previewContentArea.style.display = "block";
        } else {
          this._previewContentArea.innerHTML = "";
          this._previewContentArea.style.display = "none";
        }
      }

      // Avatar: start with silent
      this._setAvatarState(false);

      // Signal: screen transition
      this._recordViewEvent("screen_transition", { from: "init", to: "preview" });
      this._recordViewEvent("content_render", { instruction: !!config.instruction, previewContent: !!config.previewContent });

      // Audio / Timer flow
      this._instruction = config.instruction || "";
      if (config.audioUrl) {
        this._startWithAudio(config.audioUrl);
      } else {
        // No audio URL — try to generate one from instruction text at runtime
        this._tryRuntimeTTS(config.instruction);
      }
    } catch (err) {
      this._captureError(err, { method: "show", config: config });
    }
  };

  // ============================================================
  // Runtime TTS fallback — generate audio from instruction text
  // ============================================================

  var TTS_API_URL = "https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio";

  PreviewScreenComponent.prototype._tryRuntimeTTS = function (instruction) {
    var self = this;
    if (!instruction) {
      this._startWithTimer();
      return;
    }

    // Strip HTML tags to get plain text
    var text = instruction.replace(/<[^>]*>/g, "").trim();
    if (!text) {
      this._startWithTimer();
      return;
    }

    // Call TTS API to get audio URL — best effort, fall back to timer on failure
    try {
      fetch(TTS_API_URL + "?sendUrl=true&text=" + encodeURIComponent(text))
        .then(function (res) {
          if (!res.ok) throw new Error("TTS API returned " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data.audio_url && self._isActive) {
            self._hasAudio = true;
            self._startWithAudio(data.audio_url);
          } else {
            self._startWithTimer();
          }
        })
        .catch(function () {
          // TTS failed — use 5s timer
          if (self._isActive) self._startWithTimer();
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

    // Load FeedbackManager dynamically
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

    this._ensureFeedbackManager(function () {
      if (!FeedbackManager || !FeedbackManager.sound) {
        self._startWithTimer();
        return;
      }

      // Preload audio (async) AND wait for audio permission in parallel
      // Both must complete before playing
      var preloadDone = false;
      var permissionDone = false;

      function tryPlay() {
        if (preloadDone && permissionDone && self._isActive) {
          self._playPreviewAudio();
        }
      }

      // Start preload
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

      // Start permission check
      self._waitForAudioPermission(function () {
        permissionDone = true;
        tryPlay();
      });
    });
  };

  PreviewScreenComponent.prototype._startWithTimer = function () {
    var self = this;

    this._ensureFeedbackManager(function () {
      // Even with no audio, wait for audio permission (timer starts only when no popup visible)
      self._waitForAudioPermission(function () {
        self._isPaused = false; // Clear stale pause state from pre-permission pause/resume
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

    // If already unlocked, proceed immediately
    if (this._audioUnlockDone) {
      callback();
      return;
    }

    // Queue this callback — multiple callers share a single poll loop
    this._permissionCallbacks.push(callback);

    // If poll is already running, don't create a second one
    if (this._permissionPollId) {
      return;
    }

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

    // If no popup visible, fire all callbacks immediately
    if (!isPopupVisible()) {
      this._audioUnlockDone = true;
      this._flushPermissionCallbacks();
      return;
    }

    // Popup is visible — single shared poll loop until dismissed
    console.log("[PreviewScreen] Waiting for audio permission popup to be dismissed...");
    this._permissionPollId = setInterval(function () {
      if (!self._isActive) {
        clearInterval(self._permissionPollId);
        self._permissionPollId = null;
        return;
      }
      if (!isPopupVisible()) {
        clearInterval(self._permissionPollId);
        self._permissionPollId = null;
        self._audioUnlockDone = true;
        // Force FeedbackManager unlock state — popup was dismissed, audio context should be ready
        if (FeedbackManager.sound) {
          FeedbackManager.sound.unlocked = true;
          FeedbackManager.sound.unlockAttempted = true;
        }
        // Clean up backdrop just in case
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
    // Permission was just granted — clear any stale pause state.
    // This handles the case where pause()/resume() fired while waiting for
    // the audio permission popup, but resume() was never called (user dismissed
    // the permission popup directly, not the VisibilityTracker resume popup).
    this._isPaused = false;

    // Increment play generation — prevents stale .then() from resetting avatar
    this._playGeneration++;
    var gen = this._playGeneration;

    try {
      // Get duration BEFORE playing (available after preload)
      var duration = FeedbackManager.sound.getDuration(self._audioId);
      if (duration && duration > 0) {
        self._duration = duration * 1000; // seconds to ms
      } else {
        self._duration = DEFAULT_TIMER_DURATION;
      }

      var playResult = FeedbackManager.sound.play(this._audioId, {
        onplay: function () {
          if (gen !== self._playGeneration) return; // stale call
          self._isAudioPlaying = true;
          self._setAvatarState(true);
          self._beginProgressBar();
        },
        onerror: function (err) {
          if (gen !== self._playGeneration) return; // stale call
          console.warn("[PreviewScreen] Audio playback error:", err);
          self._isAudioPlaying = false;
          self._setAvatarState(false);
          if (!self._rafId) {
            self._duration = DEFAULT_TIMER_DURATION;
            self._beginProgressBar();
          }
        }
      });

      // Handle play() promise resolution (audio finished or interrupted)
      if (playResult && typeof playResult.then === "function") {
        playResult.then(function (res) {
          if (gen !== self._playGeneration) return; // stale — a newer play superseded this one
          self._isAudioPlaying = false;
          self._setAvatarState(false);
        }).catch(function (err) {
          console.warn("[PreviewScreen] play() rejected:", err);
        });
      }

      // If onplay didn't fire (audio failed silently), start progress bar as fallback
      if (!self._rafId) {
        self._beginProgressBar();
      }
    } catch (err) {
      this._captureError(err, { method: "_playPreviewAudio" });
      this._duration = DEFAULT_TIMER_DURATION;
      this._beginProgressBar();
    }
  };

  // ============================================================
  // Progress bar (rAF)
  // ============================================================

  PreviewScreenComponent.prototype._beginProgressBar = function () {
    var self = this;
    this._startTime = performance.now();
    this._elapsed = 0;
    this._totalPausedDuration = 0; // Reset stale pause time from any pre-start pause/resume cycle
    function tick(now) {
      if (!self._isActive || self._isPaused) return;

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
    if (!this._isActive) return;

    this._cancelRaf();
    if (this._progressBar) {
      this._progressBar.style.transform = "scaleX(0)";
    }

    this._complete();
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
    if (!this._isActive || this._isPaused) return;

    try {
      this._isPaused = true;
      this._pausedAt = performance.now();
      this._cancelRaf();

      // Pause audio — only if a voice is still actively playing.
      // If voice is already null (FM or handleInactive already paused it),
      // calling pause() again would call stopAll() which destroys the saved
      // voice state needed for resumeVoice().
      if (this._hasAudio && FeedbackManager && FeedbackManager.sound) {
        try {
          if (FeedbackManager.sound.audioKit.getCurrentlyPlaying()) {
            FeedbackManager.sound.pause();
          }
        } catch (e) { /* ignore */ }
        this._isAudioPlaying = false;
      }

      this._setAvatarState(false);
      this._recordViewEvent("component_state", { progressBar: "paused", elapsed: this._elapsed });

      console.log("[PreviewScreen] Paused at", Math.round(this._elapsed) + "ms");
    } catch (err) {
      this._captureError(err, { method: "pause" });
    }
  };

  PreviewScreenComponent.prototype.resume = function () {
    if (!this._isActive || !this._isPaused) return;

    try {
      var pauseDuration = performance.now() - this._pausedAt;
      this._totalPausedDuration += pauseDuration;
      this._isPaused = false;

      // Resume audio
      if (this._hasAudio && FeedbackManager && FeedbackManager.sound) {
        try {
          FeedbackManager.sound.resume(this._audioId);
          this._isAudioPlaying = true;
          this._setAvatarState(true);
        } catch (e) { /* ignore */ }
      }

      // Restart rAF
      this._beginResumedProgressBar();
      this._recordViewEvent("component_state", { progressBar: "resumed", pausedFor: Math.round(pauseDuration) });

      console.log("[PreviewScreen] Resumed after", Math.round(pauseDuration) + "ms pause");
    } catch (err) {
      this._captureError(err, { method: "resume" });
    }
  };

  PreviewScreenComponent.prototype._beginResumedProgressBar = function () {
    var self = this;

    // Guard: if progress bar was never started, nothing to resume
    if (this._startTime === 0) return;

    function tick(now) {
      if (!self._isActive || self._isPaused) return;

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
  // skip / hide / complete / destroy
  // ============================================================

  PreviewScreenComponent.prototype.skip = function () {
    if (!this._isActive) return;

    console.log("[PreviewScreen] Skipped");
    this._stopAudio();
    this._cancelRaf();
    this._complete();
  };

  PreviewScreenComponent.prototype._complete = function () {
    if (!this._isActive) return;
    this._isActive = false;

    var duration = Date.now() - this._showStartTime;
    this._previewData.duration = duration;

    this._recordViewEvent("screen_transition", { from: "preview", to: "game" });

    if (typeof this._onCompleteCallback === "function") {
      try {
        this._onCompleteCallback(this._previewData);
      } catch (err) {
        this._captureError(err, { method: "_complete", callback: "onComplete" });
      }
    }

    this.hide();
  };

  PreviewScreenComponent.prototype.hide = function () {
    this._stopAudio();
    this._cancelRaf();
    this._isActive = false;
    this._isAudioPlaying = false;

    if (this.container) this.container.style.display = "none";
    if (this.gameWrapper) this.gameWrapper.style.display = "";

    console.log("[PreviewScreen] Hidden");
  };

  PreviewScreenComponent.prototype.destroy = function () {
    this.hide();
    if (this.container) this.container.innerHTML = "";
    if (this._gameInitListener) {
      window.removeEventListener("message", this._gameInitListener);
      this._gameInitListener = null;
    }
    if (this._visibilityListener) {
      document.removeEventListener("visibilitychange", this._visibilityListener);
      this._visibilityListener = null;
    }
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
  // SignalCollector integration
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
  // Sentry Integration (same pattern as SignalCollector)
  // ============================================================

  PreviewScreenComponent.prototype._initSentry = function () {
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

    // Case 3: Sentry not loaded — inject script
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

    // Flush queued errors
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
          is_active: this._isActive,
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
  window.PreviewScreen = PreviewScreenComponent; // alias

  console.log("[MathAI] PreviewScreenComponent loaded");
})(window);
