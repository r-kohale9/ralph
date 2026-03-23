/**
 * SubtitleComponent - Vanilla JS Feedback/Subtitle Display
 *
 * Usage:
 * <script src="subtitle-component.js"></script>
 *
 * SubtitleComponent.show({
 *   text: "Great job!",
 *   duration: 3,
 *   onHide: () => console.log('Hidden')
 * });
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.SubtitleComponent !== "undefined") {
    console.log("[SubtitleComponent] Already loaded, skipping duplicate execution");
    return;
  }

  const THRESHOLD_TIME = 2000;

  // Simple text renderer with basic markdown support
  function defaultRenderer(text) {
    if (!text) return "";

    // Convert markdown-style formatting to HTML
    var html = text
      // Bold: **text** or __text__
      .replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      // Italic: *text* or _text_
      .replace(/\*([^\*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      // Line breaks
      .replace(/\n/g, "<br>")
      // Links: [text](url)
      .replace(
        /\[([^\]]+)\]\(([^\)]+)\)/g,
        '<a href="$2" target="_blank">$1</a>'
      );

    return html;
  }

  // Subtitle Component Constructor
  function SubtitleComponent(config) {
    this.config = {
      renderer: (config && config.renderer) || defaultRenderer,
      dumpLogs: (config && config.dumpLogs) || null,
      mixpanelTrack: (config && config.mixpanelTrack) || null,
      evaluationArea: (config && config.evaluationArea) || null,
      onShow: (config && config.onShow) || null,
      onHide: (config && config.onHide) || null,
      position: {
        bottom: (config && config.position && config.position.bottom) || "60px",
        maxWidth:
          (config && config.position && config.position.maxWidth) || "280px",
      },
    };

    this.container = null;
    this.feedbackBox = null;
    this.currentFeedback = null;
    this.timeoutId = null;
    this.timeStart = null;
    this.isVisible = false;

    this._init();
  }

  SubtitleComponent.prototype._init = function () {
    // Create container
    this.container = document.createElement("div");
    this.container.className = "subtitle-component-container";
    this.container.style.cssText = `
      display: none;
      position: fixed;
      bottom: ${this.config.position.bottom};
      width: 100%;
      max-width: ${this.config.position.maxWidth};
      left: 50%;
      transform: translateX(-50%);
      justify-content: center;
      z-index: 999;
      pointer-events: none;
      margin: 0 8px;
    `;

    // Create feedback box
    this.feedbackBox = document.createElement("div");
    this.feedbackBox.className = "subtitle-feedback-box";
    this.feedbackBox.style.cssText = `
      padding: 10px;
      background: rgba(242, 242, 242, 0.80);
      border-radius: 0px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #000;
      text-align: center;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;

    this.container.appendChild(this.feedbackBox);
    document.body.appendChild(this.container);
  };

  SubtitleComponent.prototype._shouldSkip = function () {
    // Check if evaluation area is player_2
    if (typeof this.config.evaluationArea === "function") {
      return this.config.evaluationArea() === "player_2";
    }
    return false;
  };

  SubtitleComponent.prototype._logAnomaly = function () {
    if (this.currentFeedback && this.timeStart) {
      var elapsed = Date.now() - this.timeStart;
      if (elapsed < THRESHOLD_TIME) {
        if (typeof this.config.dumpLogs === "function") {
          this.config.dumpLogs({
            action: "hide_feedback_anomaly",
            feedback: this.currentFeedback,
            elapsed: elapsed,
          });
        }
      }
    }
  };

  SubtitleComponent.prototype._trackMixpanel = function (feedback) {
    if (!feedback || !feedback.text) return;

    if (feedback.text.includes("Taking longer than expected")) {
      if (typeof this.config.mixpanelTrack === "function") {
        // Get country from subdomain
        var country = window.location.hostname.split(".")[0];

        // Get personalized student from localStorage
        var personalizedStudent = null;
        try {
          personalizedStudent = localStorage.getItem("personalized_student");
        } catch (e) {
          // localStorage might not be available
        }

        this.config.mixpanelTrack("taking_longer_than_expected", {
          id_of_activity: feedback.id,
          name_of_activity: feedback.title,
          country: country,
          personalized_student: personalizedStudent,
        });
      }
    }
  };

  SubtitleComponent.prototype.show = function (options) {
    if (this._shouldSkip()) return;

    options = options || {};
    var text = options.text || "";
    var duration = options.duration != null ? options.duration : 3;
    var onHide = options.onHide || null;
    var id = options.id || null;
    var title = options.title || null;

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (text.length > 0) {
      // Store feedback data
      this.currentFeedback = {
        text: text,
        duration: duration,
        onHide: onHide,
        id: id,
        title: title,
      };

      // Render text
      var html = this.config.renderer(text);
      this.feedbackBox.innerHTML = html;

      // Show container
      this.container.style.display = "flex";
      this.isVisible = true;
      this.timeStart = Date.now();

      // Track Mixpanel event if applicable
      this._trackMixpanel(this.currentFeedback);

      // Call onShow callback
      if (typeof this.config.onShow === "function") {
        this.config.onShow(this.currentFeedback);
      }

      // Set timeout to hide
      var self = this;
      this.timeoutId = setTimeout(function () {
        self.hide();
      }, duration * 1000);
    } else {
      // No text, hide immediately
      this.hide();
    }
  };

  SubtitleComponent.prototype.hide = function () {
    if (this._shouldSkip()) return;

    // Log anomaly if hidden too quickly
    this._logAnomaly();

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Hide container
    this.container.style.display = "none";
    this.isVisible = false;

    // Call onHide callback
    if (
      this.currentFeedback &&
      typeof this.currentFeedback.onHide === "function"
    ) {
      try {
        this.currentFeedback.onHide();
      } catch (e) {
        console.error("Error in onHide callback:", e);
      }
    }

    // Call global onHide
    if (typeof this.config.onHide === "function") {
      try {
        this.config.onHide(this.currentFeedback);
      } catch (e) {
        console.error("Error in config.onHide:", e);
      }
    }

    // Clear feedback
    this.currentFeedback = null;
    this.timeStart = null;
  };

  SubtitleComponent.prototype.clearTimeout = function () {
    if (this._shouldSkip()) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  };

  SubtitleComponent.prototype.extendDuration = function (additionalSeconds) {
    if (this._shouldSkip()) return;
    if (!this.isVisible || !this.currentFeedback) return;

    // Clear existing timeout
    this.clearTimeout();

    // Set new timeout with extended duration
    var self = this;
    this.timeoutId = setTimeout(function () {
      self.hide();
    }, additionalSeconds * 1000);
  };

  SubtitleComponent.prototype.updateText = function (newText) {
    if (this._shouldSkip()) return;
    if (!this.isVisible) return;

    // Update feedback text
    if (this.currentFeedback) {
      this.currentFeedback.text = newText;
    }

    // Re-render
    var html = this.config.renderer(newText);
    this.feedbackBox.innerHTML = html;
  };

  SubtitleComponent.prototype.getState = function () {
    return {
      isVisible: this.isVisible,
      currentFeedback: this.currentFeedback
        ? { ...this.currentFeedback }
        : null,
      timeElapsed: this.timeStart ? Date.now() - this.timeStart : 0,
    };
  };

  SubtitleComponent.prototype.isShowing = function () {
    return this.isVisible;
  };

  SubtitleComponent.prototype.destroy = function () {
    this.hide();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.feedbackBox = null;
  };

  // Global instance for convenience
  var globalInstance = null;

  var SubtitleComponentAPI = {
    // Create or get singleton instance
    getInstance: function (config) {
      if (!globalInstance) {
        globalInstance = new SubtitleComponent(config);
      }
      return globalInstance;
    },

    // Create new instance (non-singleton)
    create: function (config) {
      return new SubtitleComponent(config);
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

    updateText: function (text) {
      if (globalInstance) {
        return globalInstance.updateText(text);
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
        globalInstance.config = Object.assign(globalInstance.config, config);
      } else {
        globalInstance = new SubtitleComponent(config);
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
    SubtitleComponent: SubtitleComponent,
  };

  // Expose to window
  window.SubtitleComponent = SubtitleComponentAPI;
})(window);
