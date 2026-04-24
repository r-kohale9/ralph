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
 * @version 1.2.0
 * @license MIT
 */

(function (window) {
  "use strict";

  if (typeof window.ActionBarComponent !== "undefined") {
    console.log("[ActionBarComponent] Already loaded, skipping duplicate execution");
    return;
  }

  var VERSION = "1.2.0";
  var SPEAKING_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_speaking_avatar.mp4";
  var SILENT_AVATAR_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/videos/optimized_silent_avatar.mp4";
  var STAR_CDN_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/images/star-full.png";
  var STAR_IMAGE_BASE =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/images/";
  var STAR_IMAGES = {
    yellow: {
      1: STAR_CDN_URL,
      2: STAR_IMAGE_BASE + "yellow_star_x2.png",
      3: STAR_IMAGE_BASE + "yellow_star_x3.png"
    },
    blue: {
      1: STAR_IMAGE_BASE + "blue_star_x1.png",
      2: STAR_IMAGE_BASE + "blue_star_x2.png",
      3: STAR_IMAGE_BASE + "blue_star_x3.png"
    }
  };
  var AWARD_SOUND_URL =
    "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/sounds/Correct Answer_happy-award-achievement-SBA-300418984.mp3";
  var STAR_DEDUPE_MS = 500;
  var STAR_QUEUE_MAX = 3;
  var STAR_FLIGHT_MS = 1000;

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

    // Star animation state
    this._starQueue = [];
    this._starAnimating = false;
    this._starLastFiredAt = 0;
    this._starLastKey = "";
    this._starAudio = null;
    this._audioUnlocked = false;
    this._activeAnimations = [];

    // Bound listener ref so destroy() can remove it
    var self = this;
    this._messageListener = function (event) {
      if (!event || !event.data) return;
      var t = event.data.type;
      if (t === "game_init" && event.data.data) {
        // R8: shallow-merge so partial updates don't blank existing fields
        var payload = event.data.data;
        for (var k in payload) {
          if (Object.prototype.hasOwnProperty.call(payload, k)) {
            self._gameInitData[k] = payload[k];
          }
        }
        self._populateHeaderFromGameInit();
      } else if (t === "show_star") {
        self._animateStarAward(event.data.data || {});
      }
    };
    window.addEventListener("message", this._messageListener);

    // First user gesture unlocks audio playback on mobile browsers.
    this._unlockAudioListener = function () {
      self._audioUnlocked = true;
      window.removeEventListener("pointerdown", self._unlockAudioListener, true);
      window.removeEventListener("touchstart", self._unlockAudioListener, true);
      window.removeEventListener("keydown", self._unlockAudioListener, true);
    };
    window.addEventListener("pointerdown", this._unlockAudioListener, true);
    window.addEventListener("touchstart", this._unlockAudioListener, true);
    window.addEventListener("keydown", this._unlockAudioListener, true);

    this.injectStyles();
    this.injectIntoSlot();
    this._preloadStarAssets();
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
      "  transition: none;" +
      "}" +
      ".mathai-star-flying {" +
      "  position: fixed; z-index: 100;" +
      "  pointer-events: none;" +
      "  will-change: transform, opacity, transform-origin;" +
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

  /**
   * Runtime score-text update. Preferred over re-posting game_init because
   * games share the `message` listener with their own game_init handler;
   * direct method calls avoid that collision.
   */
  ActionBarComponent.prototype.setScore = function (text) {
    if (this._scoreEl) this._scoreEl.textContent = text == null ? "" : String(text);
    this._gameInitData.score = text;
  };

  ActionBarComponent.prototype.setQuestionLabel = function (text) {
    if (this._questionLabelEl) this._questionLabelEl.textContent = text == null ? "" : String(text);
    this._gameInitData.questionLabel = text;
  };

  // ============================================================
  // Star award animation
  // ============================================================

  ActionBarComponent.prototype._preloadStarAssets = function () {
    try {
      var urls = [];
      for (var v in STAR_IMAGES) {
        for (var c in STAR_IMAGES[v]) urls.push(STAR_IMAGES[v][c]);
      }
      for (var i = 0; i < urls.length; i++) {
        var im = new Image();
        im.src = urls[i];
      }
      this._starAudio = new Audio(AWARD_SOUND_URL);
      this._starAudio.preload = "auto";
    } catch (e) { /* ignore */ }
  };

  ActionBarComponent.prototype._resolveStarImage = function (variant, count) {
    var v = variant === "blue" ? "blue" : "yellow";
    var c = parseInt(count, 10);
    if (!(c === 1 || c === 2 || c === 3)) c = 1;
    return { url: STAR_IMAGES[v][c], variant: v, count: c };
  };

  ActionBarComponent.prototype._animateStarAward = function (payload) {
    payload = payload || {};
    var resolved = this._resolveStarImage(payload.variant, payload.count);
    var key = resolved.variant + ":" + resolved.count + ":" + (payload.silent ? "1" : "0");
    var now = Date.now();

    // Dedupe identical rapid-fire triggers.
    if (key === this._starLastKey && now - this._starLastFiredAt < STAR_DEDUPE_MS) {
      return;
    }
    this._starLastKey = key;
    this._starLastFiredAt = now;

    var job = {
      url: resolved.url,
      variant: resolved.variant,
      count: resolved.count,
      silent: payload.silent === true,
      fromRect: payload.fromRect || null,
      // Optional header text updates applied AT ANIMATION END so the
      // celebration visibly precedes the number change (PART-040 v1.2.0+).
      score: typeof payload.score === "string" || typeof payload.score === "number" ? payload.score : null,
      questionLabel: typeof payload.questionLabel === "string" ? payload.questionLabel : null
    };

    if (this._starAnimating) {
      if (this._starQueue.length < STAR_QUEUE_MAX) this._starQueue.push(job);
      return;
    }
    this._runStarAnimation(job);
  };

  ActionBarComponent.prototype._runStarAnimation = function (job) {
    var self = this;
    if (!this._starEl) return;

    this._starAnimating = true;

    if (!job.silent) this._playAwardSound();

    var fly = document.createElement("img");
    fly.className = "mathai-star-flying";
    fly.alt = "star";
    fly.style.left = "-10000px"; // off-screen until we know the intrinsic size
    fly.style.top = "0px";
    document.body.appendChild(fly);

    var startAnimation = function () {
      // Measure AFTER the image has decoded so we know its intrinsic size;
      // otherwise offsetWidth/Height return 0 and the anchor is wrong, which
      // is why earlier runs landed below the header star.
      var flyW = fly.offsetWidth || fly.naturalWidth || 96;
      var flyH = fly.offsetHeight || fly.naturalHeight || 96;

      var targetRect = self._starEl.getBoundingClientRect();
      var targetX = targetRect.left + targetRect.width / 2;
      var targetY = targetRect.top + targetRect.height / 2;

      var frameRect = self._header
        ? self._header.getBoundingClientRect()
        : { left: 0, right: window.innerWidth };
      var frameCenterX = (frameRect.left + frameRect.right) / 2;
      var frameCenterY = window.innerHeight / 2;

      // Place the star so its own center sits at the frame center. Scale(0.1)
      // from the default transform-origin (50% 50%) keeps the visual center
      // on the translate target, so the scaled star lands exactly on the
      // header star cell.
      fly.style.left = (frameCenterX - flyW / 2) + "px";
      fly.style.top = (frameCenterY - flyH / 2) + "px";

      var dx = targetX - frameCenterX;
      var dy = targetY - frameCenterY;

      var keyframes = [
        {
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
          offset: 0
        },
        {
          transform: "translate(" + dx + "px, " + dy + "px) scale(0.1)",
          opacity: 0.7,
          offset: 1
        }
      ];

      var animation;
      var finish = function () {
        if (fly.parentNode) fly.parentNode.removeChild(fly);
        if (self._activeAnimations) {
          var idx = self._activeAnimations.indexOf(animation);
          if (idx !== -1) self._activeAnimations.splice(idx, 1);
        }
        // Upgrade the header's static star to the awarded tier so the count
        // stays visible after the flying overlay is gone.
        if (self._starEl) {
          try { self._starEl.src = job.url; } catch (e) { /* ignore */ }
          if (self._starEl.style.display === "none") self._starEl.style.display = "inline-block";
        }
        // Apply optional header text updates AFTER the animation ends so the
        // celebration visibly precedes the number change.
        if (job.score !== null) self.setScore(job.score);
        if (job.questionLabel !== null) self.setQuestionLabel(job.questionLabel);
        self._starAnimating = false;
        var next = self._starQueue.shift();
        if (next) self._runStarAnimation(next);
      };

      if (typeof fly.animate === "function") {
        try {
          animation = fly.animate(keyframes, {
            duration: STAR_FLIGHT_MS,
            easing: "ease",
            fill: "forwards"
          });
          self._activeAnimations.push(animation);
          animation.onfinish = finish;
          animation.oncancel = finish;
        } catch (e) {
          self._captureError(e, { action: "star_animate" });
          finish();
        }
      } else {
        fly.style.transform = "translate(" + dx + "px, " + dy + "px) scale(0.1)";
        fly.style.opacity = "0.7";
        fly.style.transition =
          "transform " + STAR_FLIGHT_MS + "ms ease, " +
          "opacity " + STAR_FLIGHT_MS + "ms ease";
        setTimeout(finish, STAR_FLIGHT_MS + 20);
      }
    };

    // Prefer decode() (returns a promise resolved when the image is ready to
    // render); fall back to the load event, and fall back again to a short
    // timeout so a broken CDN never hangs the animation.
    fly.src = job.url;
    var started = false;
    var kickOff = function () {
      if (started) return;
      started = true;
      startAnimation();
    };
    if (typeof fly.decode === "function") {
      fly.decode().then(kickOff, kickOff);
    } else {
      fly.addEventListener("load", kickOff);
      fly.addEventListener("error", kickOff);
    }
    // Safety net: even if decode + load never fire, kick off after 150 ms
    // with the fallback 96x96 size so the animation never hangs.
    setTimeout(kickOff, 150);
  };

  ActionBarComponent.prototype._playAwardSound = function () {
    if (!this._starAudio) return;
    try {
      this._starAudio.currentTime = 0;
      var p = this._starAudio.play();
      if (p && typeof p.catch === "function") p.catch(function () { /* autoplay blocked */ });
    } catch (e) { /* ignore */ }
  };

  // ============================================================
  // destroy
  // ============================================================

  ActionBarComponent.prototype.destroy = function () {
    if (this._messageListener) {
      window.removeEventListener("message", this._messageListener);
      this._messageListener = null;
    }
    if (this._unlockAudioListener) {
      window.removeEventListener("pointerdown", this._unlockAudioListener, true);
      window.removeEventListener("touchstart", this._unlockAudioListener, true);
      window.removeEventListener("keydown", this._unlockAudioListener, true);
      this._unlockAudioListener = null;
    }
    if (this._activeAnimations) {
      for (var i = 0; i < this._activeAnimations.length; i++) {
        try { this._activeAnimations[i].cancel(); } catch (e) { /* ignore */ }
      }
      this._activeAnimations = [];
    }
    this._starQueue = [];
    this._starAnimating = false;
    if (this._starAudio) {
      try { this._starAudio.pause(); } catch (e) { /* ignore */ }
      this._starAudio = null;
    }
    var strays = document.getElementsByClassName("mathai-star-flying");
    while (strays.length) {
      if (strays[0].parentNode) strays[0].parentNode.removeChild(strays[0]);
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
