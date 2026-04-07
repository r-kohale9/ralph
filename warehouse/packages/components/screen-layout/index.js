/**
 * ScreenLayoutComponent
 * Injects MathAI game wrapper structure with named slots
 *
 * When `slots.previewScreen: true`, the preview screen becomes the persistent
 * wrapper for the entire game session. The game-stack is rendered INSIDE the
 * preview slot (not inside .game-wrapper). PreviewScreenComponent then manages
 * state transitions (preview → game) without any DOM reparenting.
 *
 * @version 2.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  // Skip if already loaded
  if (typeof window.ScreenLayoutComponent !== "undefined") {
    console.log("[ScreenLayoutComponent] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * ScreenLayoutComponent
   * Creates base game structure with optional component slots
   */
  class ScreenLayoutComponent {
    /**
     * Inject game layout into container
     * @param {string} containerId - DOM element ID to inject into
     * @param {object} config - Configuration
     * @param {object} config.slots - Which slots to create
     * @param {boolean|string} config.slots.progressBar - (ignored when previewScreen:true — preview header has the progress bar)
     * @param {boolean|string} config.slots.previewScreen - Create preview screen wrapper
     * @param {boolean|string} config.slots.transitionScreen - Create transition screen slot
     * @returns {object} Created slot IDs
     */
    static inject(containerId, config = {}) {
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`ScreenLayout: Container #${containerId} not found`);
      }

      const slots = config.slots || {};

      // Generate slot IDs
      const slotIds = {
        progressSlot: typeof slots.progressBar === 'string'
          ? slots.progressBar
          : (slots.progressBar ? 'mathai-progress-slot' : null),
        previewSlot: typeof slots.previewScreen === 'string'
          ? slots.previewScreen
          : (slots.previewScreen ? 'mathai-preview-slot' : null),
        transitionSlot: typeof slots.transitionScreen === 'string'
          ? slots.transitionScreen
          : (slots.transitionScreen ? 'mathai-transition-slot' : null),
        gameContent: 'gameContent'
      };

      let html = '<div class="page-center">';

      if (slotIds.previewSlot) {
        // ── Preview wrapper mode ──────────────────────────────────────────
        // Preview slot is the persistent wrapper. game-stack lives INSIDE it.
        // No .game-wrapper, no separate progress slot.
        //
        // Inline critical CSS — applied from first paint, BEFORE
        // PreviewScreenComponent's injectStyles() runs. Prevents a flash of
        // game UI between DOM creation and component initialization.
        html += '<style id="mathai-preview-critical-css">'
          +     '#' + slotIds.previewSlot + ' .mathai-preview-game-container.game-hidden{visibility:hidden!important;}'
          +     '#' + slotIds.previewSlot + ' .mathai-preview-header{position:fixed;top:0;left:0;right:0;height:56px;background:#fff;z-index:20;}'
          +     '#' + slotIds.previewSlot + '{min-height:100dvh;background:#fff;}'
          +   '</style>';
        html += `<div id="${slotIds.previewSlot}" class="mathai-preview-slot">`;

        // Header skeleton — PreviewScreenComponent populates content/avatar/etc.
        html += '<div class="mathai-preview-header">'
          +     '<div class="mathai-preview-header-progress" id="previewProgressBar"></div>'
          +     '<div class="mathai-preview-header-content">'
          +       '<div class="mathai-preview-header-left"></div>'
          +       '<div class="mathai-preview-header-center">'
          +         '<span class="mathai-preview-timer-text" id="previewTimerText"></span>'
          +       '</div>'
          +       '<div class="mathai-preview-header-right"></div>'
          +     '</div>'
          +   '</div>';

        // Body — single scroll area: instruction + game-container
        html += '<div class="mathai-preview-body">';
        html +=   '<div class="mathai-preview-instruction" id="previewInstruction"></div>';
        // Start with game-hidden so game DOM is invisible from first paint —
        // PreviewScreenComponent.show() removes this class only when
        // showGameOnPreview:true. Prevents a flash of game UI before show().
        html +=   '<div class="mathai-preview-game-container game-hidden" id="previewGameContainer">';

        // game-stack lives inside the preview wrapper
        html +=     '<div class="game-stack">';
        html +=       '<div id="gameContent" class="game-block"></div>';
        if (slotIds.transitionSlot) {
          html +=     `<div id="${slotIds.transitionSlot}" class="game-block" style="display:none;"></div>`;
        }
        html +=     '</div>';

        html +=   '</div>'; // game-container
        html += '</div>'; // body

        html += '</div>'; // preview-slot
      } else {
        // ── Legacy mode (no preview screen) ──────────────────────────────
        html += '<section class="game-wrapper">';

        if (slotIds.progressSlot) {
          html += `<div id="${slotIds.progressSlot}"></div>`;
        }

        html += '<div class="game-stack">';
        html += '<div id="gameContent" class="game-block"></div>';
        if (slotIds.transitionSlot) {
          html += `<div id="${slotIds.transitionSlot}" class="game-block" style="display:none;"></div>`;
        }
        html += '</div></section>';
      }

      html += '</div>'; // page-center

      container.innerHTML = html;

      console.log('[ScreenLayout] Injected layout with slots:', slotIds);

      return slotIds;
    }

    /**
     * Check if layout exists
     * @returns {boolean}
     */
    static exists() {
      return !!document.querySelector('.page-center .game-stack');
    }

    /**
     * Get game content element
     * @returns {HTMLElement|null}
     */
    static getGameContent() {
      return document.getElementById('gameContent');
    }
  }

  // Export globally
  window.ScreenLayoutComponent = ScreenLayoutComponent;
  window.ScreenLayout = ScreenLayoutComponent; // Alias for convenience

  console.log('[MathAI] ScreenLayoutComponent loaded');

})(window);
