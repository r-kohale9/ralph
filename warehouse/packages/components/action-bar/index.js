/**
 * ActionBarComponent v1 — Persistent game header bar
 *
 * Owns the header inside `#mathai-preview-slot`:
 *   - Back button (fires WORKSHEET_BACK postMessage)
 *   - Avatar videos (speaking / silent)
 *   - Question label + score + star
 *
 * Does NOT own `#previewProgressBar` — that belongs to PreviewScreenComponent
 * (it is driven by preview-phase audio-sync).
 *
 * Populates itself from the `game_init` postMessage payload and exposes a
 * narrow setter API for PreviewScreenComponent to drive avatar speaking state
 * and for games to toggle the header star.
 *
 * @version 1.1.1
 * @license MIT
 */

(function (window) {
  "use strict";

  if (typeof window.ActionBarComponent !== "undefined") {
    console.log("[ActionBarComponent] Already loaded, skipping duplicate execution");
    return;
  }

  var VERSION = "1.1.1";
  var SPEAKING_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_speaking_avatar.mp4";
  var SILENT_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_silent_avatar.mp4";
  var STAR_CDN_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/images/star-full.png";

  // Sentry
  var SENTRY_CDN = "https://browser.sentry-cdn.com/10.23.0/bundle.min.js";
  var SENTRY_DSN_FALLBACK =
    "https://851dc3b10b3839ae377c888956a345aa@o503779.ingest.us.sentry.io/4510363214675968";

  /**
   * @param {object} config
   * @param {string} config.slotId - Preview slot ID (default: 'mathai-preview-slot')
   */
  function ActionBarComponent(config) {
    config = config || {};
    this.config = {
      slotId: config.slotId || "mathai-preview-slot",
    };

    this.container = null;
    this._header = null;
    this._headerLeft = null;
    this._headerRight = null;
    this._speakingVideo = null;
    this._silentVideo = null;
    this._questionLabelEl = null;
    this._scoreEl = null;
    this._starEl = null;

    // Initial population comes from game_init postMessage. Shallow-merged so a
    // partial payload (only score, say) does not wipe prior fields (R8).
    this._gameInitData = {};

    // Sentry
    this._sentryReady = false;
    this._sentryQueue = [];

    // Bound listener ref so destroy() can remove it
    var self = this;
    this._gameInitListener = function (event) {
      if (event && event.data && event.data.type === "game_init" && event.data.data) {
        // R8: shallow-merge so partial updates don't blank existing fields
        var payload = event.data.data;
        for (var k in payload) {
          if (Object.prototype.hasOwnProperty.call(payload, k)) {
            self._gameInitData[k] = payload[k];
          }
        }
        self._populateHeaderFromGameInit();
      }
    };
    window.addEventListener("message", this._gameInitListener);

    this.injectStyles();
    this.injectIntoSlot();
    this._initSentry();

    console.log("[ActionBar] Initialized v" + VERSION);
  }

  // ============================================================
  // Styles
  // ============================================================

  ActionBarComponent.prototype.injectStyles = function () {
    if (document.getElementById("mathai-action-bar-styles")) return;

    var style = document.createElement("style");
    style.id = "mathai-action-bar-styles";
    style.textContent =
      /* Header bar — fixed at top. Owned by ActionBar. */
      ".mathai-preview-header {" +
      "  position: fixed; top: 0; left: 0; right: 0;" +
      "  height: 56px; background: #fff; z-index: 20;" +
      "  display: flex; align-items: center;" +
      "  padding: 0 12px; box-sizing: border-box;" +
      "  overflow: hidden;" +
      "  max-width: var(--mathai-game-max-width, 480px); margin: 0 auto;" +
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
      ".mathai-preview-header-right {" +
      "  display: flex; align-items: center; gap: 6px;" +
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
      ".mathai-preview-score {" +
      "  font-weight: 700; font-size: 16px; line-height: 22px; color: #270F36;" +
      "  font-family: var(--mathai-font-family, sans-serif);" +
      "}" +
      ".mathai-preview-star {" +
      "  width: 32px; height: 32px;" +
      "}";

    document.head.appendChild(style);
    console.log("[ActionBar] Styles injected");
  };

  // ============================================================
  // DOM setup — populate the skeleton created by ScreenLayout
  // ============================================================

  ActionBarComponent.prototype.injectIntoSlot = function () {
    this.container = document.getElementById(this.config.slotId);
    if (!this.container) {
      throw new Error(
        "ActionBar: Slot #" + this.config.slotId + " not found. " +
        "ScreenLayout.inject() must be called with slots.previewScreen: true first."
      );
    }

    this._header = this.container.querySelector(".mathai-preview-header");
    this._headerLeft = this.container.querySelector(".mathai-preview-header-left");
    this._headerRight = this.container.querySelector(".mathai-preview-header-right");

    if (!this._header || !this._headerLeft || !this._headerRight) {
      throw new Error(
        "ActionBar: Header skeleton incomplete. " +
        "Ensure ScreenLayout v2.0+ is used with slots.previewScreen: true."
      );
    }

    // Populate header-left (back btn + avatar + question label)
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

    // Populate header-right (score + star)
    this._headerRight.innerHTML =
      '<span class="mathai-preview-score" id="previewScore"></span>' +
      '<img class="mathai-preview-star" id="previewStar" src="' + STAR_CDN_URL + '" alt="star" />';

    this._speakingVideo = this._headerLeft.querySelector("#previewAvatarSpeaking");
    this._silentVideo = this._headerLeft.querySelector("#previewAvatarSilent");
    this._questionLabelEl = this._headerLeft.querySelector("#previewQuestionLabel");
    this._scoreEl = this._headerRight.querySelector("#previewScore");
    this._starEl = this._headerRight.querySelector("#previewStar");

    var self = this;
    var backBtn = this._headerLeft.querySelector("#previewBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        try {
          window.parent.postMessage({ type: "WORKSHEET_BACK" }, "*");
        } catch (e) {
          self._captureError(e, { action: "back_button" });
        }
      });
    }

    // Render default labels synchronously so standalone / pre-game_init frames
    // show the header content immediately. When a `game_init` message later
    // arrives, its payload overwrites these defaults.
    this._populateHeaderFromGameInit();
  };

  ActionBarComponent.prototype._populateHeaderFromGameInit = function () {
    var d = this._gameInitData || {};
    if (this._questionLabelEl && d.questionLabel !== undefined) {
      this._questionLabelEl.textContent = d.questionLabel || "Q1";
    } else if (this._questionLabelEl && !this._questionLabelEl.textContent) {
      this._questionLabelEl.textContent = "Q1";
    }
    if (this._scoreEl && d.score !== undefined) {
      this._scoreEl.textContent = d.score || "0/3";
    } else if (this._scoreEl && !this._scoreEl.textContent) {
      this._scoreEl.textContent = "0/3";
    }
    if (this._starEl && d.showStar !== undefined) {
      this._starEl.style.display = d.showStar !== false ? "inline-block" : "none";
    }
  };

  // ============================================================
  // Public setters
  // ============================================================

  ActionBarComponent.prototype.setAvatarSpeaking = function (isSpeaking) {
    if (this._speakingVideo) {
      this._speakingVideo.style.display = isSpeaking ? "block" : "none";
    }
    if (this._silentVideo) {
      this._silentVideo.style.display = isSpeaking ? "none" : "block";
    }
  };

  ActionBarComponent.prototype.setStar = function (visible) {
    if (this._starEl) {
      this._starEl.style.display = visible ? "inline-block" : "none";
    }
  };

  // ============================================================
  // destroy
  // ============================================================

  ActionBarComponent.prototype.destroy = function () {
    if (this._gameInitListener) {
      window.removeEventListener("message", this._gameInitListener);
      this._gameInitListener = null;
    }

    console.log("[ActionBar] Destroyed");
  };

  // ============================================================
  // Sentry
  // ============================================================

  ActionBarComponent.prototype._initSentry = function () {
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
      console.warn("[ActionBar] Failed to load Sentry SDK from CDN");
    };
    (document.head || document.documentElement).appendChild(script);
  };

  ActionBarComponent.prototype._initSentrySDK = function () {
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
      console.warn("[ActionBar] Sentry init failed:", e);
    }
  };

  ActionBarComponent.prototype._onSentryReady = function () {
    this._sentryReady = true;

    try {
      Sentry.setTag("action_bar_version", VERSION);
    } catch (e) { /* ignore */ }

    for (var i = 0; i < this._sentryQueue.length; i++) {
      var q = this._sentryQueue[i];
      this._captureError(q.err, q.context);
    }
    this._sentryQueue = [];
  };

  ActionBarComponent.prototype._captureError = function (err, context) {
    if (!this._sentryReady) {
      this._sentryQueue.push({ err: err, context: context || {} });
      return;
    }
    try {
      Sentry.captureException(err, {
        tags: {
          component: "action_bar",
          action_bar: VERSION,
          game_id: (context && context.game_id) || "unknown",
          play_id: (context && context.play_id) || "unknown"
        },
        extra: {
          context: context || {}
        }
      });
    } catch (e) { /* ignore */ }
  };

  // ============================================================
  // Export
  // ============================================================

  window.ActionBarComponent = ActionBarComponent;
  window.ActionBar = ActionBarComponent;

  console.log("[MathAI] ActionBarComponent v" + VERSION + " loaded");
})(window);
