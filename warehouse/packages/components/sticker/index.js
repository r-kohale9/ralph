/**
 * StickerComponent - Vanilla JS Sticker/Feedback Display
 *
 * Displays animated stickers (Lottie or Images/GIFs) as feedback
 *
 * Usage:
 * <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
 * <script src="sticker-component.js"></script>
 *
 * StickerComponent.show({
 *   json: {...},  // Lottie JSON or URL
 *   type: "LOTTIE", // or "IMAGE_GIF"
 *   alignment: "RIGHT", // or "LEFT"
 *   duration: 3,
 *   bottom: "70px"
 * });
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.StickerComponent !== "undefined") {
    console.log("[StickerComponent] Already loaded, skipping duplicate execution");
    return;
  }

  const DEFAULT_DURATION = 3; // seconds

  // Helper function to parse JSON
  function getParsedJson(json) {
    try {
      if (typeof json === "string") {
        return JSON.parse(json);
      }
      return json;
    } catch (error) {
      return json;
    }
  }

  // StickerComponent Constructor
  function StickerComponent(config) {
    this.config = {
      evaluationArea: (config && config.evaluationArea) || null,
      onShow: (config && config.onShow) || null,
      onHide: (config && config.onHide) || null,
      stickersList: (config && config.stickersList) || [],
      defaultAlignment: (config && config.defaultAlignment) || "RIGHT",
      defaultBottom: (config && config.defaultBottom) || "70px",
      defaultDuration: (config && config.defaultDuration) || DEFAULT_DURATION,
    };

    this.container = null;
    this.currentSticker = null;
    this.timeoutId = null;
    this.isVisible = false;

    this._init();
  }

  StickerComponent.prototype._init = function () {
    // Create container element
    this.container = document.createElement("div");
    this.container.className = "sticker-component-container";
    this.container.style.cssText = `
      display: none;
      position: fixed;
      width: 100%;
      max-width: 280px;
      z-index: 9999;
      padding: 0 4px;
      box-sizing: border-box;
      pointer-events: none;
    `;

    document.body.appendChild(this.container);
  };

  StickerComponent.prototype._shouldSkip = function () {
    // Check if evaluation area is player_2
    if (typeof this.config.evaluationArea === "function") {
      return this.config.evaluationArea() === "player_2";
    }
    return false;
  };

  StickerComponent.prototype._updatePosition = function (options) {
    var alignment = options.alignment || this.config.defaultAlignment;
    var bottom = options.bottom || this.config.defaultBottom;
    var isWideScreen = window.innerWidth > 500;

    this.container.style.bottom = bottom;

    if (isWideScreen) {
      // Wide screen: Center with offset
      this.container.style.left = "50%";
      this.container.style.right = "unset";
      this.container.style.transform =
        "translateX(" + (alignment === "LEFT" ? "-120%" : "20%") + ")";
      this.container.style.justifyContent = "center";
    } else {
      // Mobile: Align to edges
      this.container.style.left = alignment === "LEFT" ? "0" : "auto";
      this.container.style.right = alignment === "RIGHT" ? "0" : "auto";
      this.container.style.transform = "none";
      this.container.style.justifyContent =
        alignment === "LEFT" ? "flex-start" : "flex-end";
    }

    this.container.style.display = "flex";
  };

  StickerComponent.prototype._renderLottie = function (json, options) {
    var parsedJson = getParsedJson(json);

    // Check if lottie-player is available
    if (typeof window.customElements === "undefined" || !window.customElements.get("lottie-player")) {
      console.warn(
        "StickerComponent: lottie-player not found. Please include: <script src='https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js'></script>"
      );
      return;
    }

    var lottiePlayer = document.createElement("lottie-player");
    lottiePlayer.setAttribute("autoplay", "");
    lottiePlayer.setAttribute("loop", "");
    lottiePlayer.setAttribute("mode", "normal");

    // Handle both JSON object and URL string
    if (typeof parsedJson === "string") {
      lottiePlayer.setAttribute("src", parsedJson);
    } else {
      // For JSON objects, we need to set it via property after creation
      lottiePlayer.addEventListener("ready", function() {
        lottiePlayer.load(parsedJson);
      });
    }

    lottiePlayer.style.cssText = `
      width: ${options.width || "100px"};
      height: ${options.height || "100px"};
    `;

    this.container.innerHTML = "";
    this.container.appendChild(lottiePlayer);
  };

  StickerComponent.prototype._renderImage = function (imageSrc, options) {
    var img = document.createElement("img");
    img.src = imageSrc;
    img.alt = "Sticker";
    img.className = "sticker-image";
    img.style.cssText = `
      width: ${options.width || "100px"};
      height: ${options.height || "100px"};
      object-fit: contain;
      opacity: 0.8;
      align-self: center;
      aspect-ratio: 1.2;
    `;

    this.container.innerHTML = "";
    this.container.appendChild(img);
  };

  StickerComponent.prototype.show = function (options) {
    if (this._shouldSkip()) return;

    options = options || {};

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Try to find sticker from list if 'sticker' name is provided
    var stickerData = null;
    if (options.sticker && this.config.stickersList.length > 0) {
      stickerData = this.config.stickersList.find(function (s) {
        return s.x === options.sticker || s.id === options.sticker || s.name === options.sticker;
      });
    }

    // Merge options with found sticker data
    var type = options.type || (stickerData && stickerData.type) || "LOTTIE";
    var json = options.json || (stickerData && stickerData.json);
    var image = options.image || (stickerData && stickerData.image);
    var alignment =
      options.alignment ||
      (stickerData && stickerData.alignment) ||
      this.config.defaultAlignment;
    var bottom =
      options.bottom || (stickerData && stickerData.bottom) || this.config.defaultBottom;
    var duration =
      options.duration !== undefined
        ? options.duration
        : this.config.defaultDuration;
    var width = options.width || "100px";
    var height = options.height || "100px";

    // Validate that we have content to show
    if (type === "LOTTIE" && !json) {
      console.error("StickerComponent: No JSON provided for LOTTIE sticker");
      return;
    }
    if (type === "IMAGE_GIF" && !image) {
      console.error("StickerComponent: No image provided for IMAGE_GIF sticker");
      return;
    }

    // Store current sticker info
    this.currentSticker = {
      type: type,
      json: json,
      image: image,
      alignment: alignment,
      bottom: bottom,
      duration: duration,
      width: width,
      height: height,
    };

    // Update position
    this._updatePosition({ alignment: alignment, bottom: bottom });

    // Render based on type
    switch (type) {
      case "LOTTIE":
        this._renderLottie(json, { width: width, height: height });
        break;
      case "IMAGE_GIF":
      case "IMAGE":
        this._renderImage(image, { width: width, height: height });
        break;
      default:
        console.error("StickerComponent: Unknown sticker type:", type);
        return;
    }

    this.isVisible = true;

    // Call onShow callback
    if (typeof this.config.onShow === "function") {
      this.config.onShow(this.currentSticker);
    }

    // Set timeout to hide
    var self = this;
    if (duration > 0) {
      this.timeoutId = setTimeout(function () {
        self.hide();
      }, duration * 1000);
    }
  };

  StickerComponent.prototype.hide = function () {
    if (this._shouldSkip()) return;

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Hide container
    this.container.style.display = "none";
    this.container.innerHTML = "";
    this.isVisible = false;

    // Call onHide callback
    if (typeof this.config.onHide === "function") {
      this.config.onHide(this.currentSticker);
    }

    this.currentSticker = null;
  };

  StickerComponent.prototype.clearTimeout = function () {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  };

  StickerComponent.prototype.extendDuration = function (additionalSeconds) {
    if (!this.isVisible || !this.currentSticker) return;

    // Clear existing timeout
    this.clearTimeout();

    // Set new timeout with extended duration
    var self = this;
    this.timeoutId = setTimeout(function () {
      self.hide();
    }, additionalSeconds * 1000);
  };

  StickerComponent.prototype.isShowing = function () {
    return this.isVisible;
  };

  StickerComponent.prototype.getState = function () {
    return {
      isVisible: this.isVisible,
      currentSticker: this.currentSticker ? { ...this.currentSticker } : null,
    };
  };

  StickerComponent.prototype.updateConfig = function (newConfig) {
    if (newConfig.stickersList) {
      this.config.stickersList = newConfig.stickersList;
    }
    if (newConfig.evaluationArea !== undefined) {
      this.config.evaluationArea = newConfig.evaluationArea;
    }
    if (newConfig.onShow) {
      this.config.onShow = newConfig.onShow;
    }
    if (newConfig.onHide) {
      this.config.onHide = newConfig.onHide;
    }
    if (newConfig.defaultAlignment) {
      this.config.defaultAlignment = newConfig.defaultAlignment;
    }
    if (newConfig.defaultBottom) {
      this.config.defaultBottom = newConfig.defaultBottom;
    }
    if (newConfig.defaultDuration !== undefined) {
      this.config.defaultDuration = newConfig.defaultDuration;
    }
  };

  StickerComponent.prototype.destroy = function () {
    this.hide();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  };

  // Global instance for convenience
  var globalInstance = null;

  var StickerComponentAPI = {
    // Create or get singleton instance
    getInstance: function (config) {
      if (!globalInstance) {
        globalInstance = new StickerComponent(config);
      }
      return globalInstance;
    },

    // Create new instance (non-singleton)
    create: function (config) {
      return new StickerComponent(config);
    },

    // Convenience methods that use global instance
    show: function (options) {
      var instance = this.getInstance();
      return instance.show(options);
    },

    hide: function () {
      if (globalInstance) {
        return globalInstance.hide();
      }
    },

    clearTimeout: function () {
      if (globalInstance) {
        return globalInstance.clearTimeout();
      }
    },

    extendDuration: function (seconds) {
      if (globalInstance) {
        return globalInstance.extendDuration(seconds);
      }
    },

    getState: function () {
      if (globalInstance) {
        return globalInstance.getState();
      }
      return null;
    },

    isShowing: function () {
      if (globalInstance) {
        return globalInstance.isShowing();
      }
      return false;
    },

    configure: function (config) {
      if (globalInstance) {
        globalInstance.updateConfig(config);
      } else {
        globalInstance = new StickerComponent(config);
      }
      return globalInstance;
    },

    destroy: function () {
      if (globalInstance) {
        globalInstance.destroy();
        globalInstance = null;
      }
    },

    // Constructor for advanced usage
    StickerComponent: StickerComponent,
  };

  // Expose to window
  window.StickerComponent = StickerComponentAPI;
})(window);
