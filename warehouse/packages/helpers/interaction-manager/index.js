/**
 * InteractionManager - Controls pointer-events on game play areas
 *
 * Manages interaction state for MathAI games, allowing automatic disabling
 * during feedback and evaluation phases with configurable behavior.
 *
 * Usage:
 * const interaction = new InteractionManager({ selector: '.game-play-area' });
 * interaction.disable('evaluation'); // Disable during evaluation
 * interaction.enable('user_action'); // Re-enable after user action
 */

(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.InteractionManager !== "undefined") {
    console.log("[InteractionManager] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * InteractionManager - Controls pointer-events on game play areas
   * @param {Object} options - Configuration options
   * @param {string} options.selector - CSS selector for the game play area (default: '.game-play-area')
   * @param {boolean} options.disableOnAudioFeedback - Disable interaction during long audio feedback (default: true)
   * @param {boolean} options.disableOnEvaluation - Disable interaction during evaluation phases (default: true)
   */
  function InteractionManager(options = {}) {
    // Default selector for game play area with fallbacks
    this.gamePlayAreaSelector = options.selector || '.game-play-area';

    // Configuration settings
    this.settings = {
      disableOnAudioFeedback: options.disableOnAudioFeedback ?? true, // Default: disable interaction during audio feedback
      disableOnEvaluation: options.disableOnEvaluation ?? true,       // Default: disable interaction during evaluation
      ...options.settings
    };

    this.isEnabled = true; // Start enabled
    this.isExternallyControlled = false; // Start not externally controlled
    this.updatePointerEvents(); // Set initial state

    console.log('[InteractionManager] Initialized with settings:', this.settings);
  }

  /**
   * Enable interaction on the game play area
   * @param {string} reason - Reason for enabling (for debugging/logging)
   * @param {Object} options - Additional options
   * @param {boolean} options.fromAudio - Whether this call is from audio feedback system
   */
  InteractionManager.prototype.enable = function(reason = 'manual', options = {}) {
    if (!options.fromAudio) {
      this.isExternallyControlled = false;
    }
    this.isEnabled = true;
    this.updatePointerEvents();
    this.publishEvent('interactionEnabled', { reason, previousState: false });
    console.log('[InteractionManager] ENABLED - Reason:', reason);
  };

  /**
   * Disable interaction on the game play area
   * @param {string} reason - Reason for disabling (for debugging/logging)
   * @param {Object} options - Additional options
   * @param {boolean} options.fromAudio - Whether this call is from audio feedback system
   */
  InteractionManager.prototype.disable = function(reason = 'manual', options = {}) {
    if (!options.fromAudio) {
      this.isExternallyControlled = true;
    }
    this.isEnabled = false;
    this.updatePointerEvents();
    this.publishEvent('interactionDisabled', { reason, previousState: true });
    console.log('[InteractionManager] DISABLED - Reason:', reason);
  };

  /**
   * Check if interaction is currently enabled
   * @returns {boolean} True if interaction is enabled
   */
  InteractionManager.prototype.isInteractive = function() {
    return this.isEnabled;
  };

  /**
   * Check if interaction should be disabled during audio feedback
   * @returns {boolean} True if interaction should be disabled during audio feedback
   */
  InteractionManager.prototype.shouldDisableOnAudioFeedback = function() {
    return this.settings.disableOnAudioFeedback;
  };

  /**
   * Check if interaction should be disabled during evaluation
   * @returns {boolean} True if interaction should be disabled during evaluation
   */
  InteractionManager.prototype.shouldDisableOnEvaluation = function() {
    return this.settings.disableOnEvaluation;
  };

  /**
   * Check if audio should be allowed to control interaction
   * @returns {boolean} True if audio can control interaction state
   */
  InteractionManager.prototype.shouldAllowAudioControl = function() {
    return !this.isExternallyControlled;
  };

  /**
   * Update settings at runtime
   * @param {Object} newSettings - New settings to merge
   */
  InteractionManager.prototype.updateSettings = function(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('[InteractionManager] Settings updated:', this.settings);
  };

  /**
   * Get current state for debugging
   * @returns {Object} Current state information
   */
  InteractionManager.prototype.getState = function() {
    return {
      isEnabled: this.isEnabled,
      isExternallyControlled: this.isExternallyControlled,
      settings: this.settings,
      selector: this.gamePlayAreaSelector
    };
  };

  /**
   * Publish a custom event for interaction state changes
   * @param {string} eventType - Type of event ('interactionEnabled' or 'interactionDisabled')
   * @param {Object} data - Additional event data
   */
  InteractionManager.prototype.publishEvent = function(eventType, data = {}) {
    const event = new CustomEvent('interactionStateChange', {
      detail: {
        type: eventType,
        isEnabled: this.isEnabled,
        reason: data.reason,
        previousState: data.previousState,
        timestamp: Date.now(),
        ...data
      },
      bubbles: true
    });
    window.dispatchEvent(event);
  };

  /**
   * Add event listener for interaction state changes
   * @param {Function} callback - Callback function to handle state changes
   * @returns {Function} Function to remove the event listener
   */
  InteractionManager.prototype.onStateChange = function(callback) {
    const handler = (event) => callback(event.detail);
    window.addEventListener('interactionStateChange', handler);
    return () => window.removeEventListener('interactionStateChange', handler);
  };

  /**
   * Update pointer-events CSS property on the game play area
   * Uses fallback selectors if primary selector doesn't match
   */
  InteractionManager.prototype.updatePointerEvents = function() {
    // Fallback selectors for game play area
    const selectors = [
      this.gamePlayAreaSelector,
      '.game-canvas',
      '#game-canvas',
      '.interactive-area',
      '[data-interactive="true"]'
    ];

    let gamePlayArea = null;

    // Try each selector until we find an element
    for (const selector of selectors) {
      gamePlayArea = document.querySelector(selector);
      if (gamePlayArea) {
        console.log('[InteractionManager] Found game area with selector:', selector);
        break;
      }
    }

    if (!gamePlayArea) {
      console.warn('[InteractionManager] Game play area not found. Tried selectors:', selectors);
      return;
    }

    // Apply pointer-events based on state
    gamePlayArea.style.pointerEvents = this.isEnabled ? 'auto' : 'none';

    // Add/remove CSS class for additional styling
    if (this.isEnabled) {
      gamePlayArea.classList.remove('interaction-disabled');
    } else {
      gamePlayArea.classList.add('interaction-disabled');
    }
  };

  // Expose InteractionManager globally
  window.InteractionManager = InteractionManager;

  console.log('[InteractionManager] Loaded successfully');

})(window);
