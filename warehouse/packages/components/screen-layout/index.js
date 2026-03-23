/**
 * ScreenLayoutComponent
 * Injects MathAI game wrapper structure with named slots
 * 
 * @version 1.0.0
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
     * @param {boolean|string} config.slots.progressBar - Create progress bar slot (true = auto ID, string = custom ID)
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
        transitionSlot: typeof slots.transitionScreen === 'string'
          ? slots.transitionScreen
          : (slots.transitionScreen ? 'mathai-transition-slot' : null),
        gameContent: 'gameContent'
      };
      
      // Build HTML structure
      let html = '<div class="page-center"><section class="game-wrapper">';
      
      // Add progress bar slot if requested
      if (slotIds.progressSlot) {
        html += `<div id="${slotIds.progressSlot}"></div>`;
      }
      
      // Add game stack
      html += '<div class="game-stack">';
      
      // Add game content
      html += '<div id="gameContent" class="game-block"></div>';
      
      // Add transition screen slot if requested
      if (slotIds.transitionSlot) {
        html += `<div id="${slotIds.transitionSlot}" class="game-block" style="display:none;"></div>`;
      }
      
      html += '</div></section></div>';
      
      // Inject into container
      container.innerHTML = html;
      
      console.log('[ScreenLayout] Injected layout with slots:', slotIds);
      
      return slotIds;
    }
    
    /**
     * Check if layout exists
     * @returns {boolean}
     */
    static exists() {
      return !!document.querySelector('.page-center .game-wrapper .game-stack');
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


