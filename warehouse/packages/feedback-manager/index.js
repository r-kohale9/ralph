/*! FeedbackManager: unified audio, subtitle, and sticker feedback system */
(function (window) {
  "use strict";

  // ----- Config: hosted package URLs -----
  var OGG_OPUS_DECODER_URL =
    "https://storage.googleapis.com/test-dynamic-assets/packages/ogg-opus-decoder/ogg-opus-decoder.min.js";
  var BUFFERED_READER_URL =
    "https://storage.googleapis.com/test-dynamic-assets/packages/buffered-stream-reader/bufferedStreamReader.js";
  var POPUP_LAYOUT_URL =
    "https://storage.googleapis.com/test-dynamic-assets/packages/popup-layout/index.js";
  var SUBTITLE_COMPONENT_URL =
    "https://storage.googleapis.com/test-dynamic-assets/packages/subtitle/index.js";
  var STICKER_COMPONENT_URL =
    "https://storage.googleapis.com/test-dynamic-assets/packages/sticker/index.js";
  var LOTTIE_PLAYER_URL =
    "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";

  // ----- Utilities -----
  var isAndroid = /Android/i.test(navigator.userAgent);
  var NoopSentry = { captureException: function () {} };
  var Sentry =
    window.Sentry && typeof window.Sentry.captureException === "function"
      ? window.Sentry
      : NoopSentry;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // ----- Timer State Management -----
  var TIMER_DURATION_THRESHOLD = 1.0;

  console.log(
    `[AudioKit] Timer state initialized: threshold=${TIMER_DURATION_THRESHOLD}s`
  );

  // Dynamic loader
  var _pkgCache = {};
  async function loadPackage(url, globalName) {
    // Skip if already loaded globally
    if (globalName && typeof window[globalName] !== "undefined") {
      return Promise.resolve({
        default: window[globalName],
        [globalName]: window[globalName],
      });
    }
    if (_pkgCache[url]) return _pkgCache[url];
    try {
      var mod = await import(/* @vite-ignore */ url);
      if (mod && (mod.default || Object.keys(mod).length)) {
        _pkgCache[url] = mod;
        return mod;
      }
    } catch (_) {}
    _pkgCache[url] = new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = url;
      tag.async = true;
      tag.onload = function () {
        if (globalName && window[globalName]) {
          resolve({
            default: window[globalName],
            [globalName]: window[globalName],
          });
        } else {
          resolve({});
        }
      };
      tag.onerror = function () {
        reject(new Error("Failed to load " + url));
      };
      document.head.appendChild(tag);
    });
    return _pkgCache[url];
  }

  // ----- Popup Manager -----
  var PopupManager = {
    isLoaded: false,
    isShowing: false,
    load: async function () {
      if (this.isLoaded) return true;
      try {
        await loadPackage(POPUP_LAYOUT_URL, "PopupComponent");
        this.isLoaded = !!window.PopupComponent;
        return this.isLoaded;
      } catch (e) {
        console.error("[AudioKit] Failed to load popup component:", e);
        return false;
      }
    },
    showAudioPermission: async function (config) {
      config = config || {};
      if (!this.isLoaded) {
        var loaded = await this.load();
        if (!loaded) {
          console.error("[AudioKit] Popup component not available");

          return false;
        }
      }
      if (!window.PopupComponent) return false;
      if (window.PopupComponent.isVisible && window.PopupComponent.isVisible())
        return false;
      if (this.isShowing) return false;

      this.isShowing = true;

      var defaultConfig = {
        icon:
          config.icon ||
          "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/audio.json",
        title: config.title || "Permission to play audio",
        description: config.description || "Please click okay to enable sound",
        primaryText: config.primaryText || "Okay!",
        hasSecondary: false,
      };

      return new Promise(function (resolve) {
        window.PopupComponent.show({
          icon: defaultConfig.icon,
          title: defaultConfig.title,
          description: defaultConfig.description,
          primaryText: defaultConfig.primaryText,
          hasSecondary: defaultConfig.hasSecondary,
          primaryClick: function () {
            window.PopupComponent.hide();
            PopupManager.isShowing = false;
            resolve(true);
          },
          onShow: function () {
            if (typeof config.onShow === "function") {
              config.onShow();
            }
          },
        });
      });
    },
    hide: function () {
      if (window.PopupComponent) window.PopupComponent.hide();
      this.isShowing = false;
    },
  };

  // ----- Feedback Components Manager -----
  var FeedbackComponentsManager = {
    subtitleLoaded: false,
    stickerLoaded: false,
    lottieLoaded: false,
    loadingPromises: {},

    loadLottie: async function () {
      if (this.lottieLoaded || this.loadingPromises.lottie)
        return this.loadingPromises.lottie || Promise.resolve(true);
      this.loadingPromises.lottie = loadPackage(LOTTIE_PLAYER_URL, null)
        .then(function () {
          FeedbackComponentsManager.lottieLoaded = true;
          return true;
        })
        .catch(function () {
          return false;
        });
      return this.loadingPromises.lottie;
    },
    loadSubtitle: async function () {
      if (this.subtitleLoaded || this.loadingPromises.subtitle)
        return this.loadingPromises.subtitle || Promise.resolve(true);
      this.loadingPromises.subtitle = loadPackage(
        SUBTITLE_COMPONENT_URL,
        "SubtitleComponent"
      )
        .then(function () {
          FeedbackComponentsManager.subtitleLoaded = !!window.SubtitleComponent;
          return FeedbackComponentsManager.subtitleLoaded;
        })
        .catch(function () {
          return false;
        });
      return this.loadingPromises.subtitle;
    },
    loadSticker: async function () {
      if (this.stickerLoaded || this.loadingPromises.sticker)
        return this.loadingPromises.sticker || Promise.resolve(true);
      await this.loadLottie();
      this.loadingPromises.sticker = loadPackage(
        STICKER_COMPONENT_URL,
        "StickerComponent"
      )
        .then(function () {
          FeedbackComponentsManager.stickerLoaded = !!window.StickerComponent;
          if (FeedbackComponentsManager.stickerLoaded) {
            console.log("[FeedbackManager] Sticker Component loaded");
          }
          return FeedbackComponentsManager.stickerLoaded;
        })
        .catch(function (e) {
          console.warn(
            "[FeedbackManager] Failed to load Sticker Component:",
            e
          );
          return false;
        });

      return this.loadingPromises.sticker;
    },
    loadAll: async function () {
      var results = await Promise.allSettled([
        this.loadSubtitle(),
        this.loadSticker(),
      ]);
      return {
        subtitle: results[0].status === "fulfilled" && results[0].value,
        sticker: results[1].status === "fulfilled" && results[1].value,
      };
    },
    showSubtitle: function (options) {
      if (!this.subtitleLoaded || !window.SubtitleComponent) {
        console.warn(
          "[FeedbackManager] Subtitle component not loaded, skipping"
        );
        return false;
      }

      try {
        window.SubtitleComponent.show(options);
        var subtitleText = (options && (options.text || options)) || "";
        console.log("[FeedbackManager:event] subtitle_shown", JSON.stringify({ text: subtitleText, duration: options.duration || null }));
        if (typeof FeedbackManager !== "undefined" && FeedbackManager._onSubtitleShown) {
          try { FeedbackManager._onSubtitleShown({ text: subtitleText, duration: options.duration || null }); } catch (_) {}
        }
        return true;
      } catch (e) {
        console.error("[FeedbackManager] Error showing subtitle:", e);
        return false;
      }
    },
    hideSubtitle: function () {
      if (!this.subtitleLoaded || !window.SubtitleComponent) {
        return false;
      }

      try {
        window.SubtitleComponent.hide();
        return true;
      } catch (e) {
        console.error("[FeedbackManager] Error hiding subtitle:", e);
        return false;
      }
    },
    showSticker: function (options) {
      if (!this.stickerLoaded || !window.StickerComponent) {
        console.warn(
          "[FeedbackManager] Sticker component not loaded, skipping"
        );
        return false;
      }

      try {
        window.StickerComponent.show(options);
        console.log("[FeedbackManager:event] sticker_shown", JSON.stringify({ type: options.type || null, sticker: options.sticker || options.name || null }));
        if (typeof FeedbackManager !== "undefined" && FeedbackManager._onStickerShown) {
          try { FeedbackManager._onStickerShown({ type: options.type || null, sticker: options.sticker || options.name || null }); } catch (_) {}
        }
        return true;
      } catch (e) {
        console.error("[FeedbackManager] Error showing sticker:", e);
        return false;
      }
    },
    hideSticker: function () {
      if (!this.stickerLoaded || !window.StickerComponent) {
        return false;
      }

      try {
        window.StickerComponent.hide();
        return true;
      } catch (e) {
        console.error("[FeedbackManager] Error hiding sticker:", e);
        return false;
      }
    },
    showFeedback: function (options, audioDuration) {
      // If audioDuration is Infinity or "stream", don't auto-hide — caller is responsible for hiding via hideAll()
      var isManualHide = audioDuration === Infinity || audioDuration === "stream";
      var feedbackDuration = isManualHide ? 86400 : Math.min(audioDuration || 10, 10);
      if (options.subtitle) {
        this.showSubtitle({
          text: options.subtitle.text || options.subtitle,
          duration: options.subtitle.duration || feedbackDuration,
          id: options.subtitle.id,
          title: options.subtitle.title,
        });
      }
      if (options.sticker) {
        var stickerOptions =
          typeof options.sticker === "string"
            ? { sticker: options.sticker }
            : options.sticker;
        stickerOptions.duration = stickerOptions.duration || feedbackDuration;
        this.showSticker(stickerOptions);
      }
      return { duration: feedbackDuration };
    },
    hideAll: function () {
      this.hideSubtitle();
      this.hideSticker();
    },
  };

  // ============================================================================
  // SOUND MANAGER - iOS Compatible + Caching + Memory Optimization
  // ============================================================================

  function createAudioKitCore(init) {
    init = init || {};
    var cacheName = init.cacheName || "audio-assets-v1";

    // Memory Management Config
    var MAX_MEMORY_BYTES = 32 * 1024 * 1024; // 32 MB Limit
    var store = new Map(); // Map<id, AudioBuffer>
    var order = []; // LRU tracking array
    var decodedBytes = 0;

    // Audio Context
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = null;
    var masterGain = null;
    var voice = null;
    var pausedVoice = null;

    // --- Utilities ---

    function ensureAudioContext() {
      if (!ctx) {
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.value = 1;
        masterGain.connect(ctx.destination);

        // iOS Fix: Resume on any interaction
        var resumeFunc = function () {
          if (ctx && ctx.state === "suspended") ctx.resume();
        };
        document.addEventListener("touchstart", resumeFunc, { once: true });
        document.addEventListener("click", resumeFunc, { once: true });
      }
      return ctx;
    }

    function sizeOf(buf) {
      return buf.length * buf.numberOfChannels * 4; // 4 bytes per sample (Float32)
    }

    // --- Memory Management (Restored) ---

    function touch(id) {
      // Move id to end of order list (mark as recently used)
      var idx = order.indexOf(id);
      if (idx >= 0) order.splice(idx, 1);
      order.push(id);
    }

    function evictIfNeeded() {
      while (decodedBytes > MAX_MEMORY_BYTES && order.length > 0) {
        var victimId = order.shift(); // Remove oldest
        var buf = store.get(victimId);
        if (buf) {
          decodedBytes -= sizeOf(buf);
          store.delete(victimId);
          console.log("[AudioKit] Evicted " + victimId + " to free memory");
        }
      }
    }

    function putInBufferStore(id, buf) {
      // Remove existing if replacing
      if (store.has(id)) {
        var old = store.get(id);
        decodedBytes -= sizeOf(old);
      }

      var sz = sizeOf(buf);
      decodedBytes += sz;
      store.set(id, buf);

      touch(id); // Mark used
      evictIfNeeded(); // Clean up if too big
    }

    // --- Caching Logic (Restored) ---

    async function fetchWithRetry(url, attempts) {
      attempts = attempts || 2;
      for (var i = 0; i <= attempts; i++) {
        try {
          var res = await fetch(url, { mode: "cors" });
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res;
        } catch (e) {
          if (i === attempts) throw e;
          await sleep(200 * Math.pow(2, i)); // Backoff
        }
      }
    }

    async function cacheFirstBytes(url) {
      // Try Cache API first
      if ("caches" in window) {
        try {
          var cache = await caches.open(cacheName);
          var req = new Request(url, { mode: "cors" });
          var match = await cache.match(req);
          if (match) {
            return await match.arrayBuffer();
          }

          // Fetch and cache
          var res = await fetchWithRetry(url);
          // Clone before reading/caching
          if (res.ok && (res.type === "basic" || res.type === "cors")) {
            cache.put(req, res.clone()).catch(function (e) {
              console.warn("Cache put failed", e);
            });
          }
          return await res.arrayBuffer();
        } catch (e) {
          console.warn(
            "[AudioKit] Cache API failed, falling back to network",
            e
          );
        }
      }

      // Fallback for no Cache API
      var res2 = await fetchWithRetry(url);
      return await res2.arrayBuffer();
    }

    // --- Decoding & Transformation (iOS Safe) ---

    async function decodeAudio(id, arrayBuffer) {
      var audioCtx = ensureAudioContext();
      return new Promise(function (resolve, reject) {
        var view = arrayBuffer.slice(0);
        audioCtx.decodeAudioData(
          view,
          function (decoded) {
            resolve(decoded);
          },
          function (err) {
            reject(err);
          }
        );
      });
    }

    async function transformToMono(buffer) {
      // iOS-compatible downmix using OfflineAudioContext
      if (buffer.numberOfChannels === 1) return buffer;

      var offline = new OfflineAudioContext(
        1,
        buffer.length,
        buffer.sampleRate
      );

      var src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(offline.destination);
      src.start(0);

      return await offline.startRendering();
    }

    // --- Preload Flow ---

    async function preloadOne(it) {
      if (store.has(it.id)) {
        touch(it.id); // It's used, so update LRU
        return;
      }

      var url = it.url;
      if (!url && it.base && init.cdnBase) {
        url = init.cdnBase.replace(/\/$/, "") + "/" + it.base + ".mp3";
      }

      try {
        // 1. Get Bytes (Cache -> Network)
        var arrayBuffer = await cacheFirstBytes(url);

        // 2. Decode
        var audioBuffer = await decodeAudio(it.id, arrayBuffer);

        // 3. Transform (Mono)
        if (init.transform && init.transform.downmixToMono !== false) {
          audioBuffer = await transformToMono(audioBuffer);
        }

        // 4. Store (Trigger Eviction)
        putInBufferStore(it.id, audioBuffer);
      } catch (e) {
        console.error("[AudioKit] Failed to preload " + it.id, e);
        throw e;
      }
    }

    async function preloadCritical(list, opts) {
      opts = opts || {};
      var loaded = 0;
      for (var i = 0; i < list.length; i++) {
        try {
          await preloadOne(list[i]);
          loaded++;
          if (opts.onProgress)
            opts.onProgress(loaded / list.length, list[i].id);
        } catch (e) {
          if (opts.onError) opts.onError(list[i].id, e);
        }
      }
    }

    // --- Playback Logic (Preserved from iOS Fix) ---

    function finalizeVoice(status, id, error) {
      if (!voice || voice.finalized) return;

      try {
        if (voice.timer) clearTimeout(voice.timer);
        voice.src.onended = null;
        voice.src.disconnect();
        voice.gain.disconnect();
      } catch (e) {}

      voice.finalized = true;

      if (
        window.timer?.shouldAllowAudioControl() &&
        FeedbackManager.shouldControlTimer()
      ) {
        console.log(`[AudioKit] Audio Ended (${status}) - Resuming timer`);
        window.timer.resume({ fromAudio: true });
      }

      // InteractionManager integration - re-enable interaction when audio ends (any status)
      if (
        window.interactionManager?.shouldDisableOnAudioFeedback() &&
        window.interactionManager?.shouldAllowAudioControl()
      ) {
        window.interactionManager.enable("audio_feedback_end", {
          fromAudio: true,
        });
      }

      if (voice.resolve) {
        voice.resolve({ status: status, id: id, error: error });
      }
      voice = null;
    }

    function preemptActive(newId) {
      if (pausedVoice && pausedVoice.resolve) {
        pausedVoice.resolve({ status: "preempted", id: pausedVoice.id });
        pausedVoice = null;
      }
      if (!voice) return;
      var prev = voice;
      finalizeVoice("preempted", prev.id);
      try {
        prev.src.stop(0);
      } catch (e) {}
    }

    function startVoice(id, buffer, opts, resolve) {
      var audioCtx = ensureAudioContext();

      var src = audioCtx.createBufferSource();
      src.buffer = buffer;

      var gain = audioCtx.createGain();
      gain.gain.value = opts.volume !== undefined ? opts.volume : 1.0;
      if (opts.rate) src.playbackRate.value = opts.rate;

      src.connect(gain);
      gain.connect(masterGain);

      var duration = buffer.duration / (opts.rate || 1);

      // Timer Logic
      var shouldSkipTimer =
        FeedbackManager.shouldSkipTimerForDuration(duration);
      if (
        window.timer?.shouldAllowAudioControl() &&
        FeedbackManager.shouldControlTimer() &&
        !shouldSkipTimer
      ) {
        console.log(`[AudioKit] Playing ${id} - Pausing Timer`);
        window.timer.pause({ fromAudio: true });
      }

      var ctrl = {
        id: id,
        src: src,
        gain: gain,
        buffer: buffer,
        opts: opts,
        resolve: resolve,
        finalized: false,
        startAt: audioCtx.currentTime,
        timer: null,
      };

      src.onended = function () {
        finalizeVoice("ok", id);
      };
      var guardMs = duration * 1000 + 1500;
      ctrl.timer = setTimeout(function () {
        finalizeVoice("timeout", id);
      }, guardMs);

      voice = ctrl;
      src.start(0);

      // Update usage for Memory Management
      touch(id);
    }

    function pauseVoice() {
      if (!voice || voice.finalized || !ctx) return null;

      var elapsed = ctx.currentTime - voice.startAt;
      var rate = voice.opts.rate || 1;
      var pausedOffset = elapsed * rate;

      pausedVoice = {
        id: voice.id,
        buffer: voice.buffer,
        opts: voice.opts,
        pausedOffset: Math.max(0, pausedOffset),
        resolve: voice.resolve,
      };

      try {
        voice.src.onended = null;
        voice.src.stop(0);
        if (voice.timer) clearTimeout(voice.timer);
      } catch (e) {}
      voice = null;
      return pausedVoice;
    }

    function resumeVoice() {
      if (!pausedVoice) return false;
      if (voice) return false;

      var pv = pausedVoice;
      var audioCtx = ensureAudioContext();
      if (audioCtx.state === "suspended") audioCtx.resume();

      var src = audioCtx.createBufferSource();
      src.buffer = pv.buffer;
      var gain = audioCtx.createGain();
      gain.gain.value = pv.opts.volume !== undefined ? pv.opts.volume : 1;
      if (pv.opts.rate) src.playbackRate.value = pv.opts.rate;

      src.connect(gain).connect(masterGain);

      var remaining =
        (pv.buffer.duration - pv.pausedOffset) / (pv.opts.rate || 1);

      var ctrl = {
        id: pv.id,
        src: src,
        gain: gain,
        buffer: pv.buffer,
        opts: pv.opts,
        resolve: pv.resolve,
        finalized: false,
        startAt: audioCtx.currentTime - pv.pausedOffset / (pv.opts.rate || 1),
        timer: null,
      };

      src.onended = function () {
        finalizeVoice("ok", pv.id);
      };
      var guardMs = remaining * 1000 + 1500;
      ctrl.timer = setTimeout(function () {
        finalizeVoice("timeout", pv.id);
      }, guardMs);

      voice = ctrl;
      src.start(0, pv.pausedOffset);
      pausedVoice = null;
      return true;
    }

    async function playAndWait(id, opts) {
      opts = opts || {};
      var audioCtx = ensureAudioContext();

      if (audioCtx.state !== "running") {
        try {
          await audioCtx.resume();
        } catch (e) {}
      }

      var buf = store.get(id);

      // JIT Load (Simple Check)
      if (!buf) {
        return { status: "missing", id: id };
      }

      preemptActive(id);
      return new Promise(function (resolve) {
        startVoice(id, buf, opts, resolve);
      });
    }

    function play(id, opts) {
      playAndWait(id, opts).catch(function (e) {
        console.error("Play error", e);
      });
    }

    function stopAll() {
      if (voice) preemptActive("stopAll");
      if (pausedVoice && pausedVoice.resolve) {
        pausedVoice.resolve({ status: "stopped", id: pausedVoice.id });
        pausedVoice = null;
      }
    }

    return {
      resume: async function () {
        if (ctx) await ctx.resume();
      },
      isReady: function () {
        return ctx && ctx.state === "running";
      },
      preloadCritical: preloadCritical,
      play: play,
      playAndWait: playAndWait,
      has: function (id) {
        return store.has(id);
      },
      getDuration: function (id) {
        var b = store.get(id);
        return b ? b.duration : 0;
      },
      stopAll: stopAll,
      pauseVoice: pauseVoice,
      resumeVoice: resumeVoice,
      clearCooldowns: function () {}, // No-op
      getCurrentlyPlaying: function () {
        return voice ? voice.id : null;
      },
    };
  }

  // ============================================================================
  // SOUND MANAGER (High-level API)
  // ============================================================================

  function SoundManager(config) {
    config = config || {};
    this.audioKit = null;
    this.sounds = {};
    this.pauseSound = false;
    this.pausedAudioId = null;
    this.pendingPlayQueue = [];
    this.config = {
      cacheName: config.cacheName || "mathai-audio-v1",
      enableLogs: config.enableLogs || false,
      autoShowPermissionPopup: config.autoShowPermissionPopup !== false,
      popupConfig: config.popupConfig || {},
    };
    this.unlocked = false;
    this.unlockAttempted = false;
    this._initializeAudioKit();
    this._handleAudioInterruption();
  }

  SoundManager.prototype._initializeAudioKit = function () {
    this.audioKit = createAudioKitCore({
      transform: { downmixToMono: true },
      cacheName: this.config.cacheName,
    });
  };

  SoundManager.prototype._handleAudioInterruption = function () {
    if (typeof window === "undefined") return;
    var self = this;
    var isIOS =
      /iPhone|iPod|iPad|MacIntel/.test(navigator.platform) &&
      navigator.maxTouchPoints > 1;

    if (isIOS) {
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) self.pause();
      });
      window.addEventListener("pagehide", function () {
        self.pause();
      });
    }
    if (/Android/i.test(navigator.userAgent)) {
      window.addEventListener("blur", function () {
        self.pause();
      });
    }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("pause", function () {
        self.pause();
      });
    }
  };

  SoundManager.prototype._transformUrlForCDN = function (url) {
    if (!url) return url;
    if (url.includes("sets-gamify-assets.s3.ap-south-1.amazonaws.com")) {
      return url.replace(
        "sets-gamify-assets.s3.ap-south-1.amazonaws.com",
        "cdn.mathai.ai/sets-gamify-assets"
      );
    }
    return url;
  };

  SoundManager.prototype.needsUnlock = function () {
    return !this.unlocked;
  };
  SoundManager.prototype.canPlayAudio = function () {
    if (this.unlocked) return true;
    if (!this.audioKit || !this.audioKit.isReady()) return false;
    return this.audioKit.isReady();
  };

  SoundManager.prototype.unlock = async function (options) {
    options = options || {};
    if (this.unlocked) return true;
    if (this.config.autoShowPermissionPopup && options.showPopup !== false) {
      var needsInteraction = !this.canPlayAudio();
      if (needsInteraction) {
        var popupConfig = Object.assign(
          {},
          this.config.popupConfig,
          options.popupConfig || {}
        );
        var userClicked = await PopupManager.showAudioPermission(popupConfig);
        if (!userClicked)
          throw new Error("User did not grant audio permission");
      }
    }
    try {
      await this.audioKit.resume();
      this.unlocked = this.audioKit.isReady();
      this.unlockAttempted = true;
      console.log("[AudioKit] Audio unlocked");
      return true;
    } catch (e) {
      this.unlockAttempted = true;
      console.error("[AudioKit] Failed to unlock audio:", e);
      throw e;
    }
  };

  SoundManager.prototype.requestPermission = async function (popupConfig) {
    return this.unlock({ showPopup: true, popupConfig: popupConfig });
  };

  SoundManager.prototype.preload = async function (list) {
    var self = this;
    var results = [];
    console.log("[AudioKit] Preloading " + list.length + " sounds");
    var items = list.map(function (item) {
      var url = self._transformUrlForCDN(item.url);
      self.sounds[item.id] = {
        path: url,
        url: url,
        loaded: false,
        duration: 5,
      };
      return { id: item.id, url: url };
    });

    try {
      await this.audioKit.preloadCritical(items, {
        onProgress: function (progress, id) {
          if (self.sounds[id]) {
            self.sounds[id].loaded = true;
            var duration = self.audioKit.getDuration(id) || 5;
            self.sounds[id].duration = duration;
          }
        },
        onError: function (id, error) {
          console.error("[AudioKit] Preload failed:", id, error);
          results.push({ id: id, status: "error", error: error.message });
        },
      });
      list.forEach(function (item) {
        if (self.audioKit.has(item.id))
          results.push({ id: item.id, status: "ok" });
      });
    } catch (e) {
      console.error("[AudioKit] Preload error:", e);
    }

    var success = results.filter(function (r) {
      return r.status === "ok";
    }).length;
    console.log(
      "[AudioKit] Preload complete: " +
        success +
        "/" +
        list.length +
        " successful"
    );
    return results;
  };

  SoundManager.prototype.play = async function (id, opts) {
    opts = opts || {};

    // Check if sound exists before attempting unlock — avoid showing popup for missing sounds
    if (!this.audioKit.has(id) && !this.sounds[id]) {
      console.warn("[AudioKit] Sound not preloaded: " + id + ". Call sound.preload() first.");
      return { status: "missing", id: id };
    }

    if (!this.unlocked) {
      try {
        // Only show popup if explicitly requested OR on first unlock attempt (not on every play call)
        var showPopup = opts.showPopup !== undefined ? opts.showPopup : !this.unlockAttempted;
        await this.unlock({ showPopup: showPopup });
      } catch (e) {
        return { status: "locked", id: id, error: e.message };
      }
    }

    // JIT Load Support
    if (!this.audioKit.has(id) && this.sounds[id]) {
      try {
        await this.audioKit.preloadCritical([
          { id: id, url: this.sounds[id].url },
        ]);
        this.sounds[id].loaded = true;
        this.sounds[id].duration = this.audioKit.getDuration(id);
      } catch (e) {
        return { status: "error", id: id, error: "JIT_LOAD_FAILED" };
      }
    }

    if (!this.audioKit.has(id)) return { status: "missing", id: id };

    var audioDuration = this.audioKit.getDuration(id) || 5;

    // InteractionManager integration - disable interaction for long audio feedback
    // Check optional parameter first, then fall back to settings
    var shouldDisableInteraction =
      opts.disableInteraction !== false &&
      window.interactionManager?.shouldDisableOnAudioFeedback();

    if (
      shouldDisableInteraction &&
      window.interactionManager?.shouldAllowAudioControl() &&
      audioDuration > 1
    ) {
      window.interactionManager.disable("audio_feedback", { fromAudio: true });
      // Schedule re-enable after audio duration plus small buffer
      setTimeout(() => {
        if (window.interactionManager?.shouldAllowAudioControl()) {
          window.interactionManager.enable("audio_feedback_end", {
            fromAudio: true,
          });
        }
      }, audioDuration * 1000 + 500);
    }

    var feedbackResult = null;
    if (opts.subtitle || opts.sticker) {
      try {
        feedbackResult = FeedbackComponentsManager.showFeedback(
          { subtitle: opts.subtitle, sticker: opts.sticker },
          audioDuration
        );
      } catch (e) {}
    }

    try {
      console.log("[FeedbackManager:event] audio_play", JSON.stringify({ id: id, type: "sound", volume: opts.volume !== undefined ? opts.volume : 1 }));
      if (typeof FeedbackManager !== "undefined" && FeedbackManager._onAudioPlayed) {
        try { FeedbackManager._onAudioPlayed({ id: id, type: "sound", volume: opts.volume !== undefined ? opts.volume : 1 }); } catch (_) {}
      }
      var result = await this.audioKit.playAndWait(id, {
        volume: opts.volume !== undefined ? opts.volume : 1,
        rate: opts.rate,
        priority: opts.priority || 0,
      });
      return result;
    } catch (e) {
      if (feedbackResult) FeedbackComponentsManager.hideAll();

      // InteractionManager integration - re-enable interaction on play error
      if (
        window.interactionManager?.shouldDisableOnAudioFeedback() &&
        audioDuration > 1 &&
        window.interactionManager?.shouldAllowAudioControl()
      ) {
        window.interactionManager.enable("audio_play_error", {
          fromAudio: true,
        });
      }

      return { status: "error", id: id, error: e };
    }
  };

  SoundManager.prototype.playAndWait = async function (id, opts) {
    try {
      return await this.play(id, opts);
    } catch (e) {
      if (
        window.timer?.shouldAllowAudioControl() &&
        FeedbackManager.shouldControlTimer()
      ) {
        window.timer.resume({ fromAudio: true });
      }
      throw e;
    }
  };

  SoundManager.prototype.stopAll = function () {
    this.audioKit.stopAll();
    this.pendingPlayQueue = [];
    if (
      window.timer?.shouldAllowAudioControl() &&
      FeedbackManager.shouldControlTimer()
    ) {
      window.timer.resume({ fromAudio: true });
    }

    // InteractionManager integration - re-enable interaction when all audio stops
    if (
      window.interactionManager?.shouldDisableOnAudioFeedback() &&
      window.interactionManager?.shouldAllowAudioControl()
    ) {
      window.interactionManager.enable("audio_stop_all", { fromAudio: true });
    }
  };

  SoundManager.prototype.pause = function () {
    console.log("[AudioKit] Pausing");
    this.pauseSound = true;
    var pausedState = this.audioKit.pauseVoice();
    if (pausedState) {
      this.pausedAudioId = pausedState.id;
    } else if (!this.pausedAudioId) {
      // Idempotency guard: only stopAll if there is neither an active voice
      // (pauseVoice returned null) NOR a previously-saved pausedVoice. This
      // prevents a second pause() call (e.g. from a redundant
      // handleInactive → previewScreen.pause() chain) from destroying the
      // pausedVoice saved by the first call.
      this.audioKit.stopAll();
    }
    return true;
  };

  SoundManager.prototype.resume = async function () {
    console.log("[AudioKit] Resuming");
    this.pauseSound = false;
    this.pendingPlayQueue = [];
    try {
      await this.audioKit.resume();
      this.audioKit.resumeVoice();
      this.pausedAudioId = null;
      return true;
    } catch (e) {
      return false;
    }
  };

  SoundManager.prototype.getDuration = function (id) {
    return this.audioKit.getDuration(id);
  };
  SoundManager.prototype.has = function (id) {
    return this.audioKit.has(id);
  };
  SoundManager.prototype.getCurrentlyPlaying = function () {
    return this.audioKit.getCurrentlyPlaying();
  };
  SoundManager.prototype.clearCooldowns = function () {
    this.audioKit.clearCooldowns();
  };
  SoundManager.prototype.getState = function () {
    var soundsList = Object.keys(this.sounds);
    return {
      unlocked: this.unlocked,
      unlockAttempted: this.unlockAttempted,
      playMode: "mono",
      currentlyPlaying: this.getCurrentlyPlaying(),
      soundsLoaded: soundsList.length,
      sounds: soundsList,
    };
  };

  // ============================================================================
  // STREAM MANAGER (Unchanged)
  // ============================================================================
  function StreamManager(options) {
    options = options || {};
    this.audioCtx = null;
    this.masterGainNode = null;
    this.volume = options.volume != null ? options.volume : 1.0;
    this.readBufferSize =
      options.readBufferSize != null ? options.readBufferSize : 1024;
    this.maxPoolSize = options.maxPoolSize != null ? options.maxPoolSize : 10;
    this.streams = new Map();
    this.decoderPool = [];
    this.isInitialized = false;
  }

  StreamManager.prototype._createAudioContext = function () {
    var contextOptions = isAndroid
      ? { latencyHint: "playback", sampleRate: 48000 }
      : { latencyHint: "interactive" };
    var Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx(contextOptions);
    this.masterGainNode = this.audioCtx.createGain();
    var effective = isAndroid ? this.volume * 2.0 : this.volume;
    this.masterGainNode.gain.setValueAtTime(
      effective,
      this.audioCtx.currentTime
    );
    this.masterGainNode.connect(this.audioCtx.destination);
  };

  StreamManager.prototype._ensureUserGestureResume = function () {
    var self = this;
    document.addEventListener(
      "click",
      function () {
        if (!self.audioCtx) self._createAudioContext();
        else if (self.audioCtx.state === "suspended") self.audioCtx.resume();
      },
      { once: true }
    );
  };

  StreamManager.prototype.initialize = async function () {
    if (this.isInitialized) return;
    var decoderMod = await loadPackage(
      OGG_OPUS_DECODER_URL,
      "OggOpusDecoderWebWorker"
    ).catch(function () {
      return {};
    });
    var readerMod = await loadPackage(
      BUFFERED_READER_URL,
      "BufferedStreamReader"
    ).catch(function () {
      return {};
    });

    if (!window["ogg-opus-decoder"] && decoderMod) {
      var ctor =
        decoderMod.OggOpusDecoderWebWorker ||
        decoderMod.OggOpusDecoder ||
        (typeof decoderMod.default === "function"
          ? decoderMod.default
          : null) ||
        Object.values(decoderMod).find(function (v) {
          return typeof v === "function";
        });
      if (ctor)
        window["ogg-opus-decoder"] = {
          OggOpusDecoderWebWorker: ctor,
          OggOpusDecoder: ctor,
        };
    }
    if (!window.BufferedStreamReader && readerMod) {
      window.BufferedStreamReader =
        readerMod.BufferedStreamReader ||
        readerMod.default ||
        window.BufferedStreamReader;
    }

    this._ensureUserGestureResume();
    this._createAudioContext();

    var ns = window["ogg-opus-decoder"];
    for (var i = 0; i < this.maxPoolSize; i++) {
      var DecoderCtor =
        (ns && (ns.OggOpusDecoderWebWorker || ns.OggOpusDecoder)) ||
        window.OggOpusDecoderWebWorker ||
        window.OggOpusDecoder ||
        window.OpusDecoder;
      if (!DecoderCtor)
        throw new Error("[AudioKit] Ogg Opus decoder not found.");
      var dec = new DecoderCtor();
      if (dec.ready && typeof dec.ready.then === "function") await dec.ready;
      if (typeof dec.decode === "function") await dec.decode(new Uint8Array());
      this.decoderPool.push(dec);
    }
    this.isInitialized = true;
  };

  StreamManager.prototype.setVolume = function (v) {
    this.volume = clamp01(v);
    if (this.masterGainNode && this.audioCtx) {
      var effective = isAndroid ? this.volume * 2.0 : this.volume;
      this.masterGainNode.gain.setTargetAtTime(
        effective,
        this.audioCtx.currentTime,
        0.1
      );
    }
  };
  StreamManager.prototype.getVolume = function () {
    return this.volume;
  };
  StreamManager.prototype._getDecoder = function () {
    return this.decoderPool.pop() || null;
  };
  StreamManager.prototype._returnDecoder = function (decoder) {
    if (this.decoderPool.length < this.maxPoolSize)
      this.decoderPool.push(decoder);
    else if (decoder && typeof decoder.free === "function")
      decoder.free().catch(function () {});
  };
  StreamManager.prototype._createAudioBuffer = function (decoded) {
    if (!this.audioCtx) return null;
    var channelData = decoded.channelData || [];
    var sampleRate = decoded.sampleRate || 48000;
    var numCh = channelData.length || 2;
    var len = channelData[0] ? channelData[0].length : 0;
    if (!len) return null;
    var buf = this.audioCtx.createBuffer(numCh, len, sampleRate);
    for (var c = 0; c < numCh; c++) {
      var ch = channelData[c] || new Float32Array(len);
      if (isAndroid)
        for (var i = 0; i < ch.length; i++)
          ch[i] = Math.max(-1, Math.min(1, ch[i] * 1.2));
      buf.copyToChannel(ch, c);
    }
    return buf;
  };
  function createStreamData(id, url, decoder) {
    return {
      id: id,
      url: url,
      reader: null,
      decoder: decoder,
      bufferQueue: [],
      isPlaying: false,
      playingNodes: [],
      startedAt: null,
      totalScheduled: 0,
      isStreamFinished: false,
      onComplete: null,
      onPlay: null,
      onError: null,
      timeout: 0,
      timeoutTimer: null,
      decodingQueue: [],
      isDecoding: false,
      isScheduling: false,
      chunkSequence: 0,
      lastScheduledSequence: -1,
    };
  }
  StreamManager.prototype._handleStreamError = function (stream, message) {
    try {
      console.error("Stream error for " + stream.id + ": " + message);
    } catch (_) {}
    try {
      if (typeof stream.onError === "function") stream.onError(message);
    } catch (_) {}
    try {
      this.remove(stream.id);
    } catch (_) {}
    if (
      window.timer?.shouldAllowAudioControl() &&
      FeedbackManager.shouldControlTimer()
    ) {
      window.timer.resume({ fromAudio: true });
    }
    try {
      Sentry.captureException(new Error(message), {
        extra: { streamId: stream.id, streamUrl: stream.url },
      });
    } catch (_) {}
  };
  StreamManager.prototype._startTimeout = function (stream) {
    if (stream.timeout <= 0 || stream.isStreamFinished) return;
    this._clearTimeout(stream);
    var self = this;
    stream.timeoutTimer = window.setTimeout(function () {
      self._handleStreamError(
        stream,
        "Stream timed out after " + stream.timeout + "ms"
      );
    }, stream.timeout);
  };
  StreamManager.prototype._clearTimeout = function (stream) {
    if (stream.timeoutTimer) {
      window.clearTimeout(stream.timeoutTimer);
      stream.timeoutTimer = null;
    }
  };
  StreamManager.prototype._processDecodingQueue = async function (stream) {
    if (stream.isDecoding || !stream.decoder) return;
    stream.isDecoding = true;
    try {
      while (stream.decodingQueue.length > 0) {
        var queueItem = stream.decodingQueue.shift();
        console.log(
          "[StreamManager] Decoding chunk seq:",
          queueItem.sequence,
          "bytes:",
          queueItem.bytes.length
        );
        var decoded = await stream.decoder.decode(queueItem.bytes);
        if (decoded && decoded.samplesDecoded > 0) {
          var ab = this._createAudioBuffer(decoded);
          if (ab) {
            console.log(
              "[StreamManager] Created audio buffer seq:",
              queueItem.sequence,
              "duration:",
              ab.duration.toFixed(3) + "s"
            );
            var bufferedChunk = { buffer: ab, sequence: queueItem.sequence };
            if (stream.isPlaying) {
              await this._scheduleBufferSequential(stream, bufferedChunk);
            } else {
              stream.bufferQueue.push(bufferedChunk);
              console.log(
                "[StreamManager] Buffered chunk seq:",
                queueItem.sequence,
                "queue size:",
                stream.bufferQueue.length
              );
            }
          }
        } else {
          console.warn(
            "[StreamManager] No samples decoded for seq:",
            queueItem.sequence
          );
        }
      }
      if (stream.isStreamFinished && stream.decodingQueue.length === 0) {
        console.log("[StreamManager] Flushing decoder for final chunk");
        var flushed = await stream.decoder.flush();
        if (flushed && flushed.samplesDecoded > 0) {
          var ab2 = this._createAudioBuffer(flushed);
          if (ab2) {
            var bufferedChunk2 = {
              buffer: ab2,
              sequence: stream.chunkSequence++,
            };
            console.log(
              "[StreamManager] Flushed final chunk seq:",
              bufferedChunk2.sequence,
              "duration:",
              ab2.duration.toFixed(3) + "s"
            );
            if (stream.isPlaying) {
              await this._scheduleBufferSequential(stream, bufferedChunk2);
            } else {
              stream.bufferQueue.push(bufferedChunk2);
            }
          }
        }
      }
    } catch (e) {
      this._handleStreamError(stream, "Decode error: " + e.message);
    } finally {
      stream.isDecoding = false;
    }
  };
  StreamManager.prototype._scheduleBufferSequential = async function (
    stream,
    bufferedChunk
  ) {
    // Wait until we can schedule this chunk in sequence
    var waitCount = 0;
    while (
      stream.isScheduling ||
      bufferedChunk.sequence !== stream.lastScheduledSequence + 1
    ) {
      if (waitCount === 0) {
        console.log(
          "[StreamManager] Waiting to schedule seq:",
          bufferedChunk.sequence,
          "last scheduled:",
          stream.lastScheduledSequence,
          "isScheduling:",
          stream.isScheduling
        );
      }
      await sleep(5); // Small delay to prevent busy-waiting
      if (!stream.isPlaying) {
        console.log(
          "[StreamManager] Stream stopped while waiting for seq:",
          bufferedChunk.sequence
        );
        return; // Stream was stopped
      }

      waitCount++;
      if (waitCount > 200) {
        // 1 second timeout (200 * 5ms)
        console.error(
          "[StreamManager] Chunk scheduling timeout! Expected sequence:",
          stream.lastScheduledSequence + 1,
          "Got:",
          bufferedChunk.sequence,
          "- CHUNK WILL BE SKIPPED"
        );
        return;
      }
    }

    stream.isScheduling = true;
    try {
      console.log(
        "[StreamManager] Scheduling chunk seq:",
        bufferedChunk.sequence,
        "duration:",
        bufferedChunk.buffer.duration.toFixed(3) + "s"
      );
      this._scheduleBuffer(stream, bufferedChunk.buffer);
      stream.lastScheduledSequence = bufferedChunk.sequence;
      console.log(
        "[StreamManager] Successfully scheduled seq:",
        bufferedChunk.sequence,
        "total scheduled time:",
        stream.totalScheduled.toFixed(3) + "s"
      );
    } finally {
      stream.isScheduling = false;
    }
  };

  StreamManager.prototype._scheduleBuffer = function (stream, buffer) {
    if (!this.audioCtx || !this.masterGainNode) return;

    // startedAt should be initialized in play() - if not, something went wrong
    if (stream.startedAt === null) {
      console.error(
        "[StreamManager] startedAt not initialized before scheduling"
      );
      stream.startedAt = this.audioCtx.currentTime + 0.15;
      stream.totalScheduled = 0;
    }

    var source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGainNode);

    var startAt = stream.startedAt + stream.totalScheduled;
    var currentTime = this.audioCtx.currentTime;

    // If we're trying to schedule in the past, adjust forward
    if (startAt < currentTime) {
      console.warn(
        "[StreamManager] Adjusting scheduled time from past:",
        startAt - currentTime,
        "seconds behind"
      );
      stream.startedAt = currentTime + 0.05; // Reset with small buffer
      stream.totalScheduled = 0;
      startAt = stream.startedAt;
    }

    var self = this;
    source.onended = function () {
      var idx = stream.playingNodes.indexOf(source);
      if (idx > -1) stream.playingNodes.splice(idx, 1);
      try {
        if (typeof stream.onPlay === "function") stream.onPlay();
      } catch (_) {}
      if (stream.playingNodes.length === 0 && stream.isStreamFinished) {
        self._clearTimeout(stream);
        stream.isPlaying = false;
        try {
          if (typeof stream.onComplete === "function") stream.onComplete();
        } catch (_) {}
        self.remove(stream.id);
      }
    };

    stream.playingNodes.push(source);
    source.start(startAt);
    stream.totalScheduled += buffer.duration;
  };
  StreamManager.prototype._addInternal = async function (id, source, loadedCb) {
    if (!this.isInitialized) await this.initialize();
    if (this.streams.has(id)) this.remove(id);
    var body =
      source instanceof Response ? source.body : new Request(source).body;
    if (!body) return false;
    var decoder = this._getDecoder();
    if (!decoder) {
      var ns = window["ogg-opus-decoder"];
      var DecoderCtor = ns && (ns.OggOpusDecoderWebWorker || ns.OggOpusDecoder);
      if (DecoderCtor) {
        try {
          decoder = new DecoderCtor();
          if (decoder.ready) await decoder.ready;
          if (decoder.decode) await decoder.decode(new Uint8Array());
        } catch (e) {
          decoder = null;
        }
      }
    }
    if (!decoder) return false;
    var stream = createStreamData(id, source.url, decoder);
    this.streams.set(id, stream);
    var ReaderCtor =
      window.BufferedStreamReader ||
      (typeof BufferedStreamReader !== "undefined"
        ? BufferedStreamReader
        : null);
    var reader = new ReaderCtor(body, this.readBufferSize);
    stream.reader = reader;
    var self = this;
    reader.onBufferFull = function (evt) {
      var bytes = evt.bytes || new Uint8Array();
      var done = !!evt.done;
      if (stream.isPlaying) {
        if (!done) self._startTimeout(stream);
        else self._clearTimeout(stream);
      }
      if (bytes.length > 0) {
        var seq = stream.chunkSequence++;
        console.log(
          "[StreamManager] Received chunk seq:",
          seq,
          "bytes:",
          bytes.length,
          "done:",
          done
        );
        stream.decodingQueue.push({
          bytes: bytes,
          sequence: seq,
        });
      }
      if (done) {
        console.log(
          "[StreamManager] Stream finished, total chunks:",
          stream.chunkSequence
        );
        stream.isStreamFinished = true;
      }
      self._processDecodingQueue(stream);
    };
    reader.read().catch(function (error) {
      if (!String((error && error.message) || "").includes("aborted")) {
        self._handleStreamError(
          stream,
          "Stream read failed: " + ((error && error.message) || "unknown")
        );
      }
    });
    if (typeof loadedCb === "function") {
      try {
        loadedCb();
      } catch (_) {}
    }
    return true;
  };
  StreamManager.prototype.add = async function (id, url, loaded) {
    return this._addInternal(id, new Request(url), loaded);
  };
  StreamManager.prototype.addFromResponse = async function (
    id,
    response,
    loaded
  ) {
    return this._addInternal(id, response, loaded);
  };
  StreamManager.prototype.play = function (id, callbacks, options) {
    callbacks = callbacks || {};
    options = options || {};
    try {
      var s = this.streams.get(id);
      if (!s) {
        callbacks.error && callbacks.error("Stream not found");
        return false;
      }
      if (
        window.timer?.shouldAllowAudioControl() &&
        FeedbackManager.shouldControlTimer()
      ) {
        window.timer.pause({ fromAudio: true });
      }

      // InteractionManager integration - disable interaction for streaming audio
      // Check optional parameter first, then fall back to settings
      var shouldDisableInteraction =
        options.disableInteraction !== false &&
        window.interactionManager?.shouldDisableOnAudioFeedback();

      if (
        shouldDisableInteraction &&
        window.interactionManager?.shouldAllowAudioControl()
      ) {
        window.interactionManager.disable("audio_feedback", {
          fromAudio: true,
        });
      }
      if (!this.audioCtx || !this.masterGainNode) {
        callbacks.error && callbacks.error("AudioContext not ready");
        return false;
      }
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      if (isAndroid && this.audioCtx.state !== "running")
        this.audioCtx.resume();
      if (s.isPlaying) this.stop(id);
      s.isPlaying = true;
      console.log("[FeedbackManager:event] audio_play", JSON.stringify({ id: id, type: "stream" }));
      if (typeof FeedbackManager !== "undefined" && FeedbackManager._onAudioPlayed) {
        try { FeedbackManager._onAudioPlayed({ id: id, type: "stream" }); } catch (_) {}
      }
      var originalComplete = callbacks.complete || null;
      var feedbackResult = null;
      if (options.subtitle || options.sticker) {
        try {
          // Pass Infinity — subtitle stays visible until stream onComplete/onError calls hideAll()
          feedbackResult = FeedbackComponentsManager.showFeedback(
            { subtitle: options.subtitle, sticker: options.sticker },
            Infinity
          );
        } catch (e) {}
      }
      s.onComplete = function () {
        if (
          window.timer?.shouldAllowAudioControl() &&
          FeedbackManager.shouldControlTimer()
        ) {
          window.timer.resume({ fromAudio: true });
        }

        // InteractionManager integration - re-enable interaction after stream completes
        if (
          window.interactionManager?.shouldDisableOnAudioFeedback() &&
          window.interactionManager?.shouldAllowAudioControl()
        ) {
          window.interactionManager.enable("audio_feedback_end", {
            fromAudio: true,
          });
        }

        if (feedbackResult) FeedbackComponentsManager.hideAll();
        if (originalComplete) originalComplete();
      };
      s.onPlay = callbacks.onPlay || null;
      var originalError = callbacks.error || null;
      s.onError = function (error) {
        if (
          window.timer?.shouldAllowAudioControl() &&
          FeedbackManager.shouldControlTimer()
        ) {
          window.timer.resume({ fromAudio: true });
        }

        // InteractionManager integration - re-enable interaction after stream error
        if (
          window.interactionManager?.shouldDisableOnAudioFeedback() &&
          window.interactionManager?.shouldAllowAudioControl()
        ) {
          window.interactionManager.enable("audio_feedback_end", {
            fromAudio: true,
          });
        }

        if (feedbackResult) FeedbackComponentsManager.hideAll();
        if (originalError) originalError(error);
      };
      s.timeout = options.timeout || 0;

      // Initialize start time with buffer before scheduling any chunks
      if (s.startedAt === null) {
        s.startedAt = this.audioCtx.currentTime + 0.15; // 150ms buffer for short streams
        s.totalScheduled = 0;
      }

      this._startTimeout(s);

      // Sort buffered chunks by sequence to ensure correct order
      s.bufferQueue.sort(function (a, b) {
        return a.sequence - b.sequence;
      });

      console.log(
        "[StreamManager] Starting playback with",
        s.bufferQueue.length,
        "buffered chunks. Sequences:",
        s.bufferQueue
          .map(function (c) {
            return c.sequence;
          })
          .join(", ")
      );

      // Schedule all queued buffers sequentially
      var self = this;
      var scheduleQueued = async function () {
        var queuedCount = s.bufferQueue.length;
        while (s.bufferQueue.length > 0) {
          var bufferedChunk = s.bufferQueue.shift();
          if (bufferedChunk) {
            await self._scheduleBufferSequential(s, bufferedChunk);
          }
        }
        console.log(
          "[StreamManager] Finished scheduling",
          queuedCount,
          "queued chunks"
        );
      };
      scheduleQueued().catch(function (e) {
        console.error("[StreamManager] Error scheduling queued buffers:", e);
      });

      return true;
    } catch (e) {
      try {
        Sentry.captureException(e);
      } catch (_) {}

      // InteractionManager integration - re-enable interaction on stream play error
      if (
        window.interactionManager?.shouldDisableOnAudioFeedback() &&
        window.interactionManager?.shouldAllowAudioControl()
      ) {
        window.interactionManager.enable("audio_stream_play_error", {
          fromAudio: true,
        });
      }

      callbacks &&
        callbacks.error &&
        callbacks.error(String((e && e.message) || e));
      return false;
    }
  };
  StreamManager.prototype.stop = function (id) {
    var s = this.streams.get(id);
    if (!s || !s.isPlaying) return false;
    this._clearTimeout(s);
    s.playingNodes.forEach(function (node) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
      } catch (_) {}
    });
    s.playingNodes = [];
    s.isPlaying = false;
    s.startedAt = null;
    s.totalScheduled = 0;
    if (
      window.timer?.shouldAllowAudioControl() &&
      FeedbackManager.shouldControlTimer()
    ) {
      window.timer.resume({ fromAudio: true });
    }

    // InteractionManager integration - re-enable interaction when stream is manually stopped
    if (
      window.interactionManager?.shouldDisableOnAudioFeedback() &&
      window.interactionManager?.shouldAllowAudioControl()
    ) {
      window.interactionManager.enable("audio_stream_stop", {
        fromAudio: true,
      });
    }

    return true;
  };
  StreamManager.prototype.remove = function (id) {
    var s = this.streams.get(id);
    if (!s) return false;
    this.stop(id);
    try {
      s.reader && s.reader.abort && s.reader.abort();
    } catch (_) {}
    try {
      s.decoder && this._returnDecoder(s.decoder);
    } catch (_) {}
    this.streams.delete(id);
    return true;
  };
  StreamManager.prototype.pause = function (id) {
    var s = this.streams.get(id);
    if (!s || !s.isPlaying) return false;
    if (this.audioCtx) this.audioCtx.suspend();
    return true;
  };
  StreamManager.prototype.resume = function (id) {
    var s = this.streams.get(id);
    if (!s) return false;
    if (this.audioCtx && this.audioCtx.state === "suspended")
      this.audioCtx.resume();
    return true;
  };
  StreamManager.prototype.pauseAll = function () {
    if (this.audioCtx && this.audioCtx.state === "running") {
      this.audioCtx.suspend();
      return true;
    }
    return false;
  };
  StreamManager.prototype.resumeAll = function () {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
      return true;
    }
    return false;
  };
  StreamManager.prototype.getAll = function () {
    return Array.from(this.streams.keys());
  };
  StreamManager.prototype.isPlaying = function (id) {
    var s = this.streams.get(id);
    return !!(s && s.isPlaying);
  };
  StreamManager.prototype.has = function (id) {
    return this.streams.has(id);
  };
  StreamManager.prototype.stopAll = function () {
    var self = this;
    this.getAll().forEach(function (id) {
      self.stop(id);
    });
    this.streams.clear();

    // InteractionManager integration - re-enable interaction when all streams stop
    if (
      window.interactionManager?.shouldDisableOnAudioFeedback() &&
      window.interactionManager?.shouldAllowAudioControl()
    ) {
      window.interactionManager.enable("audio_streams_stop_all", {
        fromAudio: true,
      });
    }
  };
  StreamManager.prototype.removeAll = function () {
    var self = this;
    this.getAll().forEach(function (id) {
      self.remove(id);
    });
    this.streams.clear();
  };
  StreamManager.prototype.getCurrentPlaying = function () {
    if (!this.audioCtx) return [];
    var t = this.audioCtx.currentTime;
    return Array.from(this.streams.values())
      .filter(function (s) {
        return s.isPlaying;
      })
      .map(function (s) {
        var remaining =
          s.totalScheduled > 0 && s.startedAt != null
            ? Math.max(0, s.totalScheduled - (t - s.startedAt))
            : undefined;
        return { id: s.id, remaining: remaining };
      });
  };
  StreamManager.prototype.dispose = async function () {
    this.stopAll();
    this.removeAll();
    await Promise.all(
      this.decoderPool.map(function (d) {
        return d && d.free ? d.free().catch(function () {}) : Promise.resolve();
      })
    );
    this.decoderPool = [];
    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch (_) {}
      this.masterGainNode = null;
    }
    if (this.audioCtx) {
      try {
        await this.audioCtx.suspend();
        await this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.isInitialized = false;
  };

  var _sound = new SoundManager({ autoShowPermissionPopup: true });
  var _stream = new StreamManager({
    readBufferSize: 1024 * 8, // Increased from 1024 to avoid splitting Opus frames
    maxPoolSize: 20,
    volume: 0.8,
  });

  var FeedbackManager = {
    _currentDynamicId: null,
    _currentDynamicType: null, // 'sound' or 'stream'
    _firstChunkTimeout: null,

    init: async function () {
      try {
        this.unlock({ showPopup: true });
        FeedbackComponentsManager.loadAll().catch(function (e) {
          console.warn(
            "[FeedbackManager] Failed to preload feedback components:",
            e
          );
        });
        await _stream.initialize();
      } catch (e) {
        console.warn("[FeedbackManager] init failed", e);
      }
    },
    unlock: async function (options) {
      try {
        return await _sound.unlock(options);
      } catch (e) {
        console.error("[FeedbackManager] unlock failed", e);
        return false;
      }
    },
    needsUnlock: function () {
      return _sound.needsUnlock();
    },
    shouldControlTimer: function () {
      const shouldControl = !!window.timer;
      console.log(
        `[AudioKit] shouldControlTimer(): window.timer=${!!window.timer}, shouldControl=${shouldControl}`
      );
      return shouldControl;
    },
    shouldSkipTimerForDuration: function (durationSeconds) {
      if (durationSeconds === null || durationSeconds === undefined)
        return false;
      return durationSeconds < TIMER_DURATION_THRESHOLD;
    },
    canPlayAudio: function () {
      return _sound.canPlayAudio();
    },
    requestPermission: async function (popupConfig) {
      try {
        return await _sound.requestPermission(popupConfig);
      } catch (e) {
        console.error("[FeedbackManager] requestPermission failed", e);
        return false;
      }
    },
    loadPopup: async function () {
      return await PopupManager.load();
    },

    /**
     * Stops any currently playing dynamic audio
     */
    _stopCurrentDynamic: function () {
      if (this._firstChunkTimeout) {
        clearTimeout(this._firstChunkTimeout);
        this._firstChunkTimeout = null;
      }

      if (this._currentDynamicId) {
        console.log(
          "[FeedbackManager] Stopping previous dynamic audio:",
          this._currentDynamicId,
          "type:",
          this._currentDynamicType
        );

        if (this._currentDynamicType === "stream") {
          _stream.remove(this._currentDynamicId);
        } else if (this._currentDynamicType === "sound") {
          _sound.stopAll();
        }

        this._currentDynamicId = null;
        this._currentDynamicType = null;
      }

      // Also stop all other streams to be safe
      _stream.stopAll();
      FeedbackComponentsManager.hideAll();
    },

    /**
     * Play dynamic feedback with audio, subtitle, and sticker
     * Automatically stops any previous dynamic audio
     * Has 3-second timeout for first chunk arrival
     *
     * @param {Object} params - Configuration object
     * @param {string} params.audio_content - Text to convert to speech
     * @param {string} [params.subtitle] - Subtitle text to display
     * @param {string} [params.sticker] - Sticker URL (gif/lottie)
     * @returns {Promise<void>}
     */
    playDynamicFeedback: async function (params) {
      var self = this;
      params = params || {};

      if (!params.audio_content) {
        console.warn("[FeedbackManager] No audio_content provided");
        // Show sticker only if provided
        if (params.sticker) {
          FeedbackComponentsManager.showFeedback(
            {
              subtitle: params.subtitle || null,
              sticker: params.sticker
                ? {
                    type: "IMAGE_GIF",
                    image: params.sticker,
                    alignment: "RIGHT",
                  }
                : null,
            },
            5
          );
        }
        return;
      }

      // Stop any currently playing dynamic audio
      this._stopCurrentDynamic();

      var encodedText = encodeURIComponent(params.audio_content);
      var apiUrl =
        "https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text=" +
        encodedText;

      var feedbackOptions = {
        subtitle: params.subtitle || null,
        sticker: params.sticker
          ? { type: "IMAGE_GIF", image: params.sticker, alignment: "RIGHT" }
          : null,
      };

      try {
        console.log(
          "[FeedbackManager] Fetching dynamic audio for:",
          params.audio_content
        );

        // Race the API fetch with a 3-second timeout
        var timeoutPromise = new Promise(function (_, reject) {
          self._firstChunkTimeout = setTimeout(function () {
            reject(new Error("API response timeout (3 seconds)"));
          }, 3000);
        });

        var fetchPromise = fetch(apiUrl);

        var response = await Promise.race([fetchPromise, timeoutPromise]);

        // Clear the timeout since we got a response
        if (self._firstChunkTimeout) {
          clearTimeout(self._firstChunkTimeout);
          self._firstChunkTimeout = null;
        }

        if (!response.ok) {
          throw new Error("API returned " + response.status);
        }

        var contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          // ===== CACHED AUDIO - Use sound manager =====
          console.log("[FeedbackManager] Cache HIT - using sound manager");
          var jsonData = await response.json();
          var audioId = "dynamic-" + Date.now();

          self._currentDynamicId = audioId;
          self._currentDynamicType = "sound";

          await _sound.preload([{ id: audioId, url: jsonData.audio_url }]);

          // Check if we were stopped while preloading
          if (self._currentDynamicId !== audioId) {
            console.log("[FeedbackManager] Stopped during preload");
            return;
          }

          await _sound.play(audioId, feedbackOptions);
        } else {
          // ===== STREAMING AUDIO - Use stream manager =====
          console.log("[FeedbackManager] Cache MISS - using stream manager");
          var streamId = "dynamic-stream-" + Date.now();

          self._currentDynamicId = streamId;
          self._currentDynamicType = "stream";

          // Add stream with response
          await _stream.addFromResponse(streamId, response);

          // Check if we were stopped while adding stream
          if (self._currentDynamicId !== streamId) {
            console.log("[FeedbackManager] Stopped during stream setup");
            return;
          }

          // Play the stream — wrap in Promise so await waits for audio to finish
          // Safety timeout: if stream breaks (network error, chunks stop arriving),
          // resolve after 60s to prevent hanging forever
          await new Promise(function (resolve, reject) {
            var settled = false;
            var safetyTimer = setTimeout(function () {
              if (!settled) {
                settled = true;
                console.warn("[FeedbackManager] Stream safety timeout (60s) — resolving to prevent hang");
                try { _stream.remove(streamId); } catch (_) {}
                if (self._currentDynamicId === streamId) {
                  self._currentDynamicId = null;
                  self._currentDynamicType = null;
                }
                FeedbackComponentsManager.hideAll();
                resolve();
              }
            }, 60000);

            var playSuccess = _stream.play(
              streamId,
              {
                complete: function () {
                  if (settled) return;
                  settled = true;
                  clearTimeout(safetyTimer);
                  console.log("[FeedbackManager] Dynamic stream completed");
                  _stream.remove(streamId);
                  if (self._currentDynamicId === streamId) {
                    self._currentDynamicId = null;
                    self._currentDynamicType = null;
                  }
                  resolve();
                },
                error: function (msg) {
                  if (settled) return;
                  settled = true;
                  clearTimeout(safetyTimer);
                  console.error("[FeedbackManager] Stream error:", msg);
                  if (self._currentDynamicId === streamId) {
                    self._currentDynamicId = null;
                    self._currentDynamicType = null;
                  }
                  reject(new Error(msg || "Stream playback error"));
                },
              },
              feedbackOptions
            );

            if (!playSuccess) {
              if (!settled) {
                settled = true;
                clearTimeout(safetyTimer);
                reject(new Error("Failed to start stream playback"));
              }
            }
          });
        }
      } catch (error) {
        console.error(
          "[FeedbackManager] Error playing dynamic feedback:",
          error
        );

        // Clean up
        self._stopCurrentDynamic();

        // Show sticker as fallback if provided
        if (params.sticker) {
          FeedbackComponentsManager.showFeedback(
            {
              subtitle: params.subtitle || null,
              sticker: {
                type: "IMAGE_GIF",
                image: params.sticker,
                alignment: "RIGHT",
              },
            },
            5
          );
        }
      }
    },

    sound: _sound,
    stream: _stream,
    popup: PopupManager,
    feedback: FeedbackComponentsManager,
    version: "3.2.0-ios-cache-restored",
  };

  window.testAudio = function (id) {
    if (!FeedbackManager || !FeedbackManager.sound)
      return console.error("FeedbackManager not ready");
    FeedbackManager.sound
      .play(id)
      .then(function (r) {
        console.log("Result:", r);
      })
      .catch(console.error);
  };
  window.testAllAudio = async function () {
    if (!FeedbackManager || !FeedbackManager.sound)
      return console.error("FeedbackManager not ready");
    var state = FeedbackManager.sound.getState();
    console.log("Testing sounds:", state.sounds);
    for (var i = 0; i < state.sounds.length; i++) {
      var id = state.sounds[i];
      console.log("Testing:", id);
      var res = await FeedbackManager.sound.playAndWait(id);
      console.log("Result:", res);
      await sleep(500);
    }
    console.log("All audio tests complete");
  };
  window.getAudioState = function () {
    return FeedbackManager && FeedbackManager.sound
      ? FeedbackManager.sound.getState()
      : null;
  };
  window.FeedbackManager = FeedbackManager;
  window.AudioKit = FeedbackManager;
})(window);
