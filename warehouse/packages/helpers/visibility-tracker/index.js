/**
 * Visibility Tracker Component
 * Tracks tab visibility changes and shows popup when user goes inactive
 * Automatically loads PopupComponent from CDN
 */
(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.VisibilityTracker !== "undefined") {
    console.log("[VisibilityTracker] Already loaded, skipping duplicate execution");
    return;
  }

  class VisibilityTracker {
    constructor(config = {}) {
      // Default popup configuration
      this.defaultPopupConfig = {
        icon: "https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/assets/animations/loading.json",
        title: "Resume Activity",
        description:
          "Session with MathAI coach is paused, to continue please press resume",
        hasSecondary: false,
        primaryText: "Resume",
        zIndex: 9999,
      };

      // User configuration
      this.config = {
        onInactive: config.onInactive || (() => {}),
        onResume: config.onResume || (() => {}),
        popupProps: {
          ...this.defaultPopupConfig,
          ...(config.popupProps || {}),
        },
        autoShowPopup: config.autoShowPopup !== false, // Show popup by default
        enabled: config.enabled !== false, // Enable by default
      };

      // State
      this.isTracking = false;
      this.isInactive = false;
      this.visibilityHandler = null;
      this.popupLoaded = false;
      this.popupLoadingPromise = null;

      // Load PopupComponent if needed
      if (this.config.autoShowPopup) {
        this._loadPopupComponent();
      }

      // Auto-start if enabled
      if (this.config.enabled) {
        this.start();
      }
    }

    /**
     * Load PopupComponent from CDN
     * @private
     */
    _loadPopupComponent() {
      // If already loaded, return resolved promise
      if (window.PopupComponent) {
        this.popupLoaded = true;
        this.popupLoadingPromise = Promise.resolve();
        return this.popupLoadingPromise;
      }

      // If already loading, return existing promise
      if (this.popupLoadingPromise) {
        return this.popupLoadingPromise;
      }

      // Load the script
      this.popupLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://storage.googleapis.com/test-dynamic-assets/packages/popup-layout/index.js";
        script.async = true;

        script.onload = () => {
          this.popupLoaded = true;
          console.log("VisibilityTracker: PopupComponent loaded successfully");
          resolve();
        };

        script.onerror = () => {
          console.error(
            "VisibilityTracker: Failed to load PopupComponent from CDN"
          );
          this.config.autoShowPopup = false;
          reject(new Error("Failed to load PopupComponent"));
        };

        document.head.appendChild(script);
      });

      return this.popupLoadingPromise;
    }

    /**
     * Start tracking visibility changes
     */
    start() {
      if (this.isTracking) {
        console.warn("VisibilityTracker: Already tracking");
        return;
      }

      this.visibilityHandler = () => this._handleVisibilityChange();
      document.addEventListener("visibilitychange", this.visibilityHandler);
      this.isTracking = true;

      console.log("VisibilityTracker: Started tracking");

      // Self-bootstrap: if the tab is ALREADY hidden when start() is called
      // (e.g. user switched tabs during page load before this listener was
      // registered), synthesize the inactive transition so a subsequent
      // visibilitychange → visible event will correctly trigger the resume
      // popup. Without this, the very first hide-while-loading is missed
      // and the user has to switch tabs a second time to get the popup.
      if (document.hidden) {
        console.log("VisibilityTracker: tab already hidden at start() — bootstrapping inactive state");
        this._handleInactive();
      }
    }

    /**
     * Stop tracking visibility changes
     */
    stop() {
      if (!this.isTracking) {
        console.warn("VisibilityTracker: Not currently tracking");
        return;
      }

      if (this.visibilityHandler) {
        document.removeEventListener(
          "visibilitychange",
          this.visibilityHandler
        );
        this.visibilityHandler = null;
      }

      // Hide popup if visible
      if (
        this.config.autoShowPopup &&
        window.PopupComponent &&
        window.PopupComponent.isVisible()
      ) {
        window.PopupComponent.hide();
      }

      this.isTracking = false;
      this.isInactive = false;

      console.log("VisibilityTracker: Stopped tracking");
    }

    /**
     * Handle visibility change event
     * @private
     */
    _handleVisibilityChange() {
      if (document.hidden) {
        // User went inactive (switched tab or minimized)
        this._handleInactive();
      } else {
        // User returned to tab
        console.log("VisibilityTracker: User returned to tab");

        // If user is inactive and popup should show, try to show it
        // This handles the case where popup was blocked earlier due to another popup
        if (
          this.isInactive &&
          this.config.autoShowPopup &&
          window.PopupComponent &&
          !window.PopupComponent.isVisible()
        ) {
          // Small delay to ensure any other popup has finished hiding
          setTimeout(() => {
            if (this.isInactive) {
              // Still inactive, show popup now
              this._showResumePopup();
            }
          }, 100);
        }
      }
    }

    /**
     * Handle inactive state
     * @private
     */
    _handleInactive() {
      if (this.isInactive) {
        return; // Already inactive
      }

      this.isInactive = true;
      console.log("VisibilityTracker: User went inactive");

      // Call user's onInactive callback
      if (typeof this.config.onInactive === "function") {
        this.config.onInactive();
      }

      // Show popup if enabled
      if (this.config.autoShowPopup && window.PopupComponent) {
        this._showResumePopup();
      }
    }

    /**
     * Handle resume action
     * @private
     */
    _handleResume() {
      console.log("VisibilityTracker: User resumed activity");

      // Hide popup
      if (this.config.autoShowPopup && window.PopupComponent) {
        window.PopupComponent.hide();
      }

      // Reset inactive state
      this.isInactive = false;

      // Call user's onResume callback
      if (typeof this.config.onResume === "function") {
        this.config.onResume();
      }
    }

    /**
     * Show resume popup
     * @private
     */
    _showResumePopup() {
      // Check if popup is already visible (could be from another package)
      if (window.PopupComponent && window.PopupComponent.isVisible()) {
        console.warn(
          "VisibilityTracker: Popup already visible, skipping resume popup"
        );
        return;
      }

      // Ensure popup is loaded before showing
      if (this.popupLoadingPromise) {
        this.popupLoadingPromise
          .then(() => {
            this._displayPopup();
          })
          .catch((error) => {
            console.error("VisibilityTracker: Cannot show popup", error);
          });
      } else {
        this._displayPopup();
      }
    }

    /**
     * Display the popup (internal method)
     * @private
     */
    _displayPopup() {
      if (!window.PopupComponent) {
        console.warn(
          "VisibilityTracker: PopupComponent not available, cannot show popup"
        );
        return;
      }

      const popupConfig = {
        ...this.config.popupProps,
        primaryClick: (e) => {
          // Call user's custom primary click if provided
          if (this.config.popupProps.primaryClick) {
            this.config.popupProps.primaryClick(e);
          }
          // Handle resume
          this._handleResume();
        },
      };

      // Add secondary click handler if needed
      if (
        this.config.popupProps.hasSecondary &&
        this.config.popupProps.secondaryClick
      ) {
        popupConfig.secondaryClick = (e) => {
          this.config.popupProps.secondaryClick(e);
          // Still hide popup and resume
          this._handleResume();
        };
      }

      window.PopupComponent.show(popupConfig);
    }

    /**
     * Check if user is currently inactive
     */
    isUserInactive() {
      return this.isInactive;
    }

    /**
     * Check if tracking is enabled
     */
    isEnabled() {
      return this.isTracking;
    }

    /**
     * Manually trigger inactive state (useful for testing)
     */
    triggerInactive() {
      this._handleInactive();
    }

    /**
     * Manually trigger resume (useful for testing or custom resume buttons)
     */
    triggerResume() {
      this._handleResume();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      if (newConfig.onInactive) {
        this.config.onInactive = newConfig.onInactive;
      }
      if (newConfig.onResume) {
        this.config.onResume = newConfig.onResume;
      }
      if (newConfig.popupProps) {
        this.config.popupProps = {
          ...this.config.popupProps,
          ...newConfig.popupProps,
        };
      }
      if (newConfig.autoShowPopup !== undefined) {
        this.config.autoShowPopup = newConfig.autoShowPopup;
      }
      if (newConfig.enabled !== undefined) {
        this.config.enabled = newConfig.enabled;
        if (newConfig.enabled && !this.isTracking) {
          this.start();
        } else if (!newConfig.enabled && this.isTracking) {
          this.stop();
        }
      }
    }

    /**
     * Destroy the tracker and clean up
     */
    destroy() {
      this.stop();
      this.config = null;
      console.log("VisibilityTracker: Destroyed");
    }
  }

  // Export for use in modules or make globally available
  if (typeof module !== "undefined" && module.exports) {
    module.exports = VisibilityTracker;
  } else {
    window.VisibilityTracker = VisibilityTracker;
  }
})(window);
