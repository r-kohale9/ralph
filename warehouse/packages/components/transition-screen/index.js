/**
 * TransitionScreenComponent
 * Inline content replacement for start/end/victory screens
 * CRITICAL: NOT a modal overlay - inline content that toggles with game
 * 
 * @version 1.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  // Skip if already loaded
  if (typeof window.TransitionScreenComponent !== "undefined") {
    console.log("[TransitionScreenComponent] Already loaded, skipping duplicate execution");
    return;
  }

  /**
   * TransitionScreenComponent
   * Manages inline transition screens (start, victory, game over, etc.)
   */
  class TransitionScreenComponent {
    /**
     * @param {object} config - Configuration
     * @param {boolean} config.autoInject - Auto-find and inject into slot (default: true)
     * @param {string} config.slotId - Slot ID (default: 'mathai-transition-slot')
     * @param {string} config.gameContentId - Game content ID to toggle (default: 'gameContent')
     */
    constructor(config = {}) {
      this.config = {
        autoInject: true,
        slotId: 'mathai-transition-slot',
        gameContentId: 'gameContent',
        ...config
      };
      
      this.container = null;
      this.gameContent = null;
      this.currentConfig = null;
      this.currentButtons = []; // Store button configs for event delegation
      this.currentPersist = false; // Store screen persist setting
      
      // Inject component CSS first
      this.injectStyles();
      
      if (this.config.autoInject) {
        this.injectIntoSlot();
      }
    }
    
    /**
     * Inject component-specific CSS (only once per page)
     */
    injectStyles() {
      // Only inject once per page
      if (document.getElementById('mathai-transition-screen-styles')) {
        return;
      }
      
      const style = document.createElement('style');
      style.id = 'mathai-transition-screen-styles';
      style.textContent = `
        /* CRITICAL: Inline content replacement (NOT modal overlay) */
        .mathai-transition-screen {
          display: none;
          width: 100%;
          min-height: 400px;
          padding: 40px 20px;
        }
        
        .mathai-transition-screen.active {
          display: block;
        }
        
        .mathai-transition-content {
          background: var(--mathai-transition-bg);
          border-radius: var(--mathai-border-radius);
          padding: var(--mathai-padding-large);
          max-width: 520px;
          margin: 0 auto;
          text-align: center;
        }
        
        .mathai-transition-icons {
          margin-bottom: 28px;
          min-height: 80px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
        }
        
        .mathai-transition-icon {
          font-size: 72px;
          line-height: 1;
        }
        
        .mathai-transition-icon.small {
          font-size: 48px;
        }
        
        .mathai-transition-icon.large {
          font-size: 96px;
        }
        
        .mathai-transition-title {
          font-size: var(--mathai-font-size-title);
          font-weight: 700;
          color: var(--mathai-transition-title);
          margin-bottom: 16px;
          line-height: 1.2;
          font-family: var(--mathai-font-family);
        }
        
        .mathai-transition-subtitle {
          font-size: var(--mathai-font-size-subtitle);
          font-weight: 500;
          color: var(--mathai-transition-subtitle);
          margin-bottom: 36px;
          line-height: 1.5;
          font-family: var(--mathai-font-family);
        }
        
        .mathai-transition-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        
        .mathai-transition-btn {
          padding: 14px 36px;
          border: none;
          border-radius: var(--mathai-border-radius-button);
          font-size: var(--mathai-font-size-button);
          font-weight: 600;
          font-family: var(--mathai-font-family);
          cursor: pointer;
          min-width: 140px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .mathai-transition-btn.primary {
          background: var(--mathai-green);
          color: var(--mathai-white);
        }
        
        .mathai-transition-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(33, 150, 83, 0.3);
        }
        
        .mathai-transition-btn.secondary {
          background: var(--mathai-blue);
          color: var(--mathai-white);
        }
        
        .mathai-transition-btn.secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .mathai-stars-container {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .mathai-star {
          width: 48px;
          height: 48px;
        }
        
        .mathai-star svg {
          width: 100%;
          height: 100%;
        }
      `;
      document.head.appendChild(style);
      console.log('[TransitionScreen] Styles injected');
    }
    
    /**
     * Find and inject into slot
     */
    injectIntoSlot() {
      this.container = document.getElementById(this.config.slotId);
      
      if (!this.container) {
        console.warn(`TransitionScreen: Slot #${this.config.slotId} not found`);
        
        // Fallback: Create in .game-stack
        const gameStack = document.querySelector('.game-stack');
        if (gameStack) {
          this.container = document.createElement('div');
          this.container.id = this.config.slotId;
          this.container.className = 'game-block';
          this.container.style.display = 'none';
          gameStack.appendChild(this.container);
          console.log('[TransitionScreen] Created fallback slot in .game-stack');
        } else {
          throw new Error('TransitionScreen: No .game-stack found. Call ScreenLayout.inject() first.');
        }
      }
      
      this.gameContent = document.getElementById(this.config.gameContentId);
      this.buildStructure();

      // Set up event delegation for buttons
      this.setupEventDelegation();
    }
    
    /**
     * Build transition screen HTML structure
     */
    buildStructure() {
      // Add mathai-transition-screen class for styling
      this.container.classList.add('mathai-transition-screen');
      
      // Uses CSS classes from injected styles (NO inline styles)
      this.container.innerHTML = `
        <div class="mathai-transition-content">
          <div class="mathai-transition-icons" id="transitionIcons"></div>
          <h2 class="mathai-transition-title" id="transitionTitle"></h2>
          <p class="mathai-transition-subtitle" id="transitionSubtitle"></p>
          <div class="mathai-transition-buttons" id="transitionButtons"></div>
        </div>
      `;
    }

    /**
     * Set up event delegation for button clicks
     */
    setupEventDelegation() {
      const buttonsContainer = document.getElementById('transitionButtons');
      if (buttonsContainer) {
        buttonsContainer.addEventListener('click', (e) => {
          const target = e.target;
          if (target.matches('.mathai-transition-btn')) {
            const buttonIndex = parseInt(target.getAttribute('data-index'), 10);
            const buttonConfig = this.currentButtons[buttonIndex];

            if (buttonConfig && buttonConfig.action) {
              buttonConfig.action();
              // Don't auto-hide if persist: true
              if (!this.currentPersist) {
                this.hide();
              }
            }
          }
        });
      }
    }

    /**
     * Show transition screen
     * @param {object} config - Screen configuration
     * @param {Array|string} config.icons - Emoji icons to display
     * @param {string} config.iconSize - Icon size: 'small' | 'normal' | 'large'
     * @param {number} config.stars - Number of stars to show (1-3)
     * @param {string} config.title - Main title text
     * @param {string} config.subtitle - Optional subtitle text
     * @param {Array} config.buttons - Button configurations [{text, type, action}]
     * @param {number} config.duration - Auto-hide after ms
     * @param {boolean} config.persist - Never hide (for Stars Claimed)
     * @param {object} config.titleStyles - Custom CSS styles for title
     * @param {object} config.subtitleStyles - Custom CSS styles for subtitle
     */
    show(config) {
      const {
        icons,
        iconSize,
        stars,
        title,
        subtitle,
        buttons,
        duration,
        persist,
        titleStyles,
        subtitleStyles
      } = config;

      // Use requestAnimationFrame to defer DOM updates when called synchronously
      requestAnimationFrame(() => {
        // Hide game content
        if (this.gameContent) {
          this.gameContent.style.display = 'none';
        }

        const iconsContainer = document.getElementById('transitionIcons');
        const titleElement = document.getElementById('transitionTitle');
        const subtitleElement = document.getElementById('transitionSubtitle');
        const buttonsContainer = document.getElementById('transitionButtons');

        // Clear previous
        iconsContainer.innerHTML = '';
        buttonsContainer.innerHTML = '';
        titleElement.style.color = '';
        titleElement.style.fontSize = '';
        titleElement.style.fontWeight = '';
        subtitleElement.style.fontWeight = '';

        // Handle icons (emoji or SVG stars)
        if (stars !== undefined) {
          iconsContainer.innerHTML = this.createStarsHTML(stars, 3);
        } else if (icons) {
          const iconArray = Array.isArray(icons) ? icons : [icons];
          iconArray.forEach(icon => {
            const iconEl = document.createElement('span');
            iconEl.className = 'mathai-transition-icon ' + (iconSize || 'normal');
            iconEl.textContent = icon;
            iconsContainer.appendChild(iconEl);
          });
        }

        // Set title
        titleElement.textContent = title || '';
        if (titleStyles) {
          Object.assign(titleElement.style, titleStyles);
        }

        // Set subtitle
        if (subtitle) {
          subtitleElement.textContent = subtitle;
          subtitleElement.style.display = 'block';
          if (subtitleStyles) {
            Object.assign(subtitleElement.style, subtitleStyles);
          }
        } else {
          subtitleElement.style.display = 'none';
        }

        // Build buttons
        if (buttons && buttons.length > 0) {
          this.buildButtons(buttons, persist);
        }

        // Show transition screen
        this.container.classList.add('active');
        this.container.style.display = 'block';

        // Store persist config
        this.currentConfig = { persist: persist || false };

        // Auto-hide after duration (unless persist is true)
        if (duration && !persist && (!buttons || buttons.length === 0)) {
          setTimeout(() => this.hide(), duration);
        }

        console.log('[TransitionScreen] Showing screen:', { title, stars, buttons: buttons?.length, persist });
      });
    }
    
    /**
     * Build buttons
     * @param {Array} buttons - Button configurations
     * @param {boolean} persist - Whether screen persists
     */
    buildButtons(buttons, persist) {
      if (!buttons || buttons.length === 0) return;

      const buttonsContainer = document.getElementById('transitionButtons');

      // Store screen persist setting
      this.currentPersist = persist || false;

      // Store button configs for event delegation
      this.currentButtons = buttons.map((btn, index) => ({ ...btn, index }));

      buttons.forEach((btn, index) => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        // Uses CSS classes from component's injected CSS
        button.className = 'mathai-transition-btn ' + (btn.type || 'primary');
        // Add data attribute for event delegation
        button.setAttribute('data-index', index);

        buttonsContainer.appendChild(button);
      });
    }
    
    /**
     * Create stars HTML container
     * @param {number} activeStars - Number of active stars
     * @param {number} totalStars - Total stars to display
     * @returns {string} HTML string
     */
    createStarsHTML(activeStars, totalStars = 3) {
      // Uses CSS classes from component's injected CSS
      let html = '<div class="mathai-stars-container">';
      for (let i = 0; i < totalStars; i++) {
        const isActive = i < activeStars;
        html += `<div class="mathai-star">${this.createSVGStar(isActive)}</div>`;
      }
      html += '</div>';
      return html;
    }
    
    /**
     * Create SVG star
     * @param {boolean} isActive - Whether star is active (colored)
     * @returns {string} SVG HTML string
     */
    createSVGStar(isActive) {
      const color = isActive ? '#FFDE49' : '#E0E0E0';
      const highlightColor = isActive ? '#ffff8d' : '#E0E0E0';
      const shadowColor = isActive ? '#f4b400' : '#E0E0E0';
      
      return `
        <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <path d="M68.05 7.23l13.46 30.7a7.047 7.047 0 0 0 5.82 4.19l32.79 2.94c3.71.54 5.19 5.09 2.5 7.71l-24.7 20.75c-2 1.68-2.91 4.32-2.36 6.87l7.18 33.61c.63 3.69-3.24 6.51-6.56 4.76L67.56 102a7.033 7.033 0 0 0-7.12 0l-28.62 16.75c-3.31 1.74-7.19-1.07-6.56-4.76l7.18-33.61c.54-2.55-.36-5.19-2.36-6.87L5.37 52.78c-2.68-2.61-1.2-7.17 2.5-7.71l32.79-2.94a7.047 7.047 0 0 0 5.82-4.19l13.46-30.7c1.67-3.36 6.45-3.36 8.11-.01z" fill="${color}"/>
          <path d="M67.07 39.77l-2.28-22.62c-.09-1.26-.35-3.42 1.67-3.42c1.6 0 2.47 3.33 2.47 3.33l6.84 18.16c2.58 6.91 1.52 9.28-.97 10.68c-2.86 1.6-7.08.35-7.73-6.13z" fill="${highlightColor}"/>
          <path d="M95.28 71.51L114.9 56.2c.97-.81 2.72-2.1 1.32-3.57c-1.11-1.16-4.11.51-4.11.51l-17.17 6.71c-5.12 1.77-8.52 4.39-8.82 7.69c-.39 4.4 3.56 7.79 9.16 3.97z" fill="${shadowColor}"/>
        </svg>
      `;
    }
    
    /**
     * Hide transition screen and show game content
     */
    hide() {
      if (this.container) {
        this.container.classList.remove('active');
        this.container.style.display = 'none';
      }
      if (this.gameContent) {
        this.gameContent.style.display = 'block';
      }
      this.currentConfig = null;
      this.currentPersist = false;
      console.log('[TransitionScreen] Hidden');
    }
    
    /**
     * Cleanup
     */
    destroy() {
      this.hide();
      if (this.container) {
        this.container.innerHTML = '';
      }
      console.log('[TransitionScreen] Destroyed');
    }
  }

  // Export globally
  window.TransitionScreenComponent = TransitionScreenComponent;
  
  console.log('[MathAI] TransitionScreenComponent loaded');

})(window);


