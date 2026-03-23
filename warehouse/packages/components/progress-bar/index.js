/**
 * ProgressBarComponent
 * Shows rounds completed and remaining lives with hearts
 * 
 * @version 1.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  // Skip if already loaded
  if (typeof window.ProgressBarComponent !== "undefined") {
    console.log("[ProgressBarComponent] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * ProgressBarComponent
   * Displays round progress and lives using hearts (❤️/🤍)
   */
  class ProgressBarComponent {
    /**
     * @param {object} config - Configuration
     * @param {boolean} config.autoInject - Auto-find and inject into slot (default: true)
     * @param {string} config.slotId - Slot ID to inject into (default: 'mathai-progress-slot')
     * @param {number} config.totalRounds - Total rounds/levels (required)
     * @param {number} config.totalLives - Total hearts (required)
     */
    constructor(config = {}) {
      this.config = {
        autoInject: true,
        slotId: 'mathai-progress-slot',
        totalRounds: 5,
        totalLives: 3,
        ...config
      };
      
      this.currentRound = 0;
      this.currentLives = this.config.totalLives;
      this.container = null;
      this.textEl = null;
      this.livesEl = null;
      this.barEl = null;
      this.uniqueId = 'pb-' + Date.now();
      
      // Inject component CSS first
      this.injectStyles();
      
      if (this.config.autoInject) {
        this.injectIntoSlot();
      }
      
      this.render();
    }
    
    /**
     * Inject component-specific CSS (only once per page)
     */
    injectStyles() {
      // Only inject once per page
      if (document.getElementById('mathai-progress-bar-styles')) {
        return;
      }
      
      const style = document.createElement('style');
      style.id = 'mathai-progress-bar-styles';
      style.textContent = `
        .mathai-progress-section {
          background: var(--mathai-progress-bg);
          padding: var(--mathai-padding-medium);
          border-bottom: 2px solid var(--mathai-border-gray);
        }
        
        .mathai-progress-container {
          max-width: 500px;
          margin: 0 auto;
          font-family: var(--mathai-font-family);
        }
        
        .mathai-progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .mathai-progress-text {
          font-size: var(--mathai-font-size-progress);
          color: var(--mathai-text-primary);
          font-weight: 500;
        }
        
        .mathai-lives-display {
          font-size: 20px;
        }
        
        .mathai-progress-bar-container {
          width: 100%;
          height: 12px;
          border-radius: 1rem;
          background: var(--mathai-progress-container-bg);
          overflow: hidden;
        }
        
        .mathai-progress-bar-fill {
          height: 100%;
          background: var(--mathai-progress-bar);
          transition: width 0.5s ease-in-out;
          border-radius: 1rem;
        }
      `;
      document.head.appendChild(style);
      console.log('[ProgressBar] Styles injected');
    }
    
    /**
     * Find and inject into slot
     */
    injectIntoSlot() {
      this.container = document.getElementById(this.config.slotId);
      
      if (!this.container) {
        console.warn(`ProgressBar: Slot #${this.config.slotId} not found`);
        
        // Fallback: Try to create at top of .game-wrapper
        const gameWrapper = document.querySelector('.game-wrapper');
        if (gameWrapper) {
          this.container = document.createElement('div');
          this.container.id = this.config.slotId;
          gameWrapper.insertBefore(this.container, gameWrapper.firstChild);
          console.log('[ProgressBar] Created fallback slot in .game-wrapper');
        } else {
          throw new Error('ProgressBar: No .game-wrapper found. Call ScreenLayout.inject() first.');
        }
      }
    }
    
    /**
     * Render the progress bar HTML
     */
    render() {
      if (!this.container) return;
      
      // Uses CSS classes from injected styles (NO inline styles)
      this.container.innerHTML = `
        <div class="mathai-progress-section">
          <div class="mathai-progress-container">
            <div class="mathai-progress-header">
              <span class="mathai-progress-text" id="${this.uniqueId}-text">0/${this.config.totalRounds} rounds completed</span>
              <span class="mathai-lives-display" id="${this.uniqueId}-lives">${'❤️'.repeat(this.config.totalLives)}</span>
            </div>
            <div class="mathai-progress-bar-container">
              <div class="mathai-progress-bar-fill" id="${this.uniqueId}-bar" style="width: 0%;"></div>
            </div>
          </div>
        </div>
      `;
      
      // Cache element references
      this.textEl = document.getElementById(`${this.uniqueId}-text`);
      this.livesEl = document.getElementById(`${this.uniqueId}-lives`);
      this.barEl = document.getElementById(`${this.uniqueId}-bar`);
      
      console.log('[ProgressBar] Rendered');
    }
    
    /**
     * Update progress display
     * @param {number} currentRound - Current round number
     * @param {number} currentLives - Remaining lives
     */
    update(currentRound, currentLives) {
      this.currentRound = currentRound;
      this.currentLives = currentLives;
      
      if (this.textEl) {
        this.textEl.textContent = `${currentRound}/${this.config.totalRounds} rounds completed`;
      }
      
      if (this.barEl) {
        const percentage = (currentRound / this.config.totalRounds) * 100;
        this.barEl.style.width = `${percentage}%`;
      }
      
      if (this.livesEl) {
        const filledHearts = '❤️'.repeat(currentLives);
        const emptyHearts = '🤍'.repeat(this.config.totalLives - currentLives);
        this.livesEl.textContent = filledHearts + emptyHearts;
      }
    }
    
    /**
     * Cleanup
     */
    destroy() {
      if (this.container) {
        this.container.innerHTML = '';
      }
      this.textEl = null;
      this.livesEl = null;
      this.barEl = null;
      console.log('[ProgressBar] Destroyed');
    }
  }

  // Export globally
  window.ProgressBarComponent = ProgressBarComponent;
  
  console.log('[MathAI] ProgressBarComponent loaded');

})(window);


