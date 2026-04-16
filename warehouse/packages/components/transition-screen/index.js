/**
 * TransitionScreenComponent
 * Card-based inline transition screens (start, level, victory, game over).
 * Toggles with game content — NOT a modal overlay.
 *
 * v2: Card UI matching reference designs. Supports primitives (title, subtitle,
 * icons, buttons, stars) AND arbitrary custom HTML content. Fully customizable styles.
 * Backwards compatible with v1 show() config.
 *
 * @version 2.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  if (typeof window.TransitionScreenComponent !== 'undefined') return;

  var STYLE_ID = 'mathai-transition-screen-styles';

  /**
   * Apply a styles object to an element
   */
  function applyStyles(el, obj) {
    if (!obj || typeof obj !== 'object') return;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      el.style[keys[i]] = obj[keys[i]];
    }
  }

  /**
   * Inject component CSS (once per page)
   */
  function injectDefaultStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      /* Screen wrapper — takes over the play-area space */
      '.mathai-ts-screen {',
      '  display: none;',
      '  width: 100%;',
      '  padding: 12px 16px;',
      '  box-sizing: border-box;',
      '}',
      '.mathai-ts-screen.active {',
      '  display: flex;',
      '  flex: 1;',
      '  align-items: center;',
      '  justify-content: center;',
      '  min-height: 300px;',
      '}',

      /* Card container — white rounded card with shadow */
      '.mathai-ts-card {',
      '  background: #ffffff;',
      '  border-radius: 12px;',
      '  padding: 64px 32px;',
      '  max-width: 480px;',
      '  min-height: fit-content;',
      '  width: 100%;',
      '  margin: 0 auto;',
      '  text-align: center;',
      '  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.06);',
      '}',

      /* Icons area */
      '.mathai-ts-icons {',
      '  margin-bottom: 24px;',
      '  display: flex;',
      '  justify-content: center;',
      '  align-items: center;',
      '  gap: 12px;',
      '}',
      '.mathai-ts-icons:empty { display: none; }',

      '.mathai-ts-icon {',
      '  font-size: 72px;',
      '  line-height: 1;',
      '}',
      '.mathai-ts-icon.small { font-size: 48px; }',
      '.mathai-ts-icon.large { font-size: 96px; }',

      /* Stars */
      '.mathai-ts-stars {',
      '  display: flex;',
      '  justify-content: center;',
      '  gap: 12px;',
      '  margin-bottom: 24px;',
      '}',
      '.mathai-ts-star {',
      '  width: 48px;',
      '  height: 48px;',
      '}',
      '.mathai-ts-star svg { width: 100%; height: 100%; }',

      /* Title */
      '.mathai-ts-title {',
      '  font-size: 32px;',
      '  font-weight: 700;',
      '  color: #270f36;',
      '  margin: 0 0 16px;',
      '  line-height: 1.2;',
      '  font-family: inherit;',
      '}',

      /* Subtitle */
      '.mathai-ts-subtitle {',
      '  font-size: 18px;',
      '  font-weight: 500;',
      '  color: #666666;',
      '  margin: 0 0 32px;',
      '  line-height: 1.5;',
      '  font-family: inherit;',
      '}',

      /* Custom content slot */
      '.mathai-ts-custom {',
      '  margin-bottom: 24px;',
      '}',
      '.mathai-ts-custom:empty { display: none; margin: 0; }',

      /* Buttons */
      '.mathai-ts-buttons {',
      '  display: flex;',
      '  justify-content: center;',
      '  gap: 16px;',
      '  flex-wrap: wrap;',
      '}',
      '.mathai-ts-buttons:empty { display: none; }',

      '.mathai-ts-btn {',
      '  padding: 14px 36px;',
      '  border: none;',
      '  border-radius: 12px;',
      '  font-size: 18px;',
      '  font-weight: 700;',
      '  font-family: inherit;',
      '  cursor: pointer;',
      '  min-width: 160px;',
      '  transition: transform 0.15s ease, box-shadow 0.15s ease;',
      '}',
      '.mathai-ts-btn:active { transform: scale(0.97); }',

      '.mathai-ts-btn.primary {',
      '  background: #219653;',
      '  color: #ffffff;',
      '}',
      '.mathai-ts-btn.primary:hover {',
      '  box-shadow: 0 4px 12px rgba(33, 150, 83, 0.3);',
      '}',

      '.mathai-ts-btn.secondary {',
      '  background: #2563eb;',
      '  color: #ffffff;',
      '}',
      '.mathai-ts-btn.secondary:hover {',
      '  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);',
      '}',

      '.mathai-ts-btn.outline {',
      '  background: transparent;',
      '  color: #219653;',
      '  border: 2px solid #219653;',
      '}',

      /* Responsive */
      '@media (max-width: 480px) {',
      '  .mathai-ts-card { padding: 36px 20px; border-radius: 12px; }',
      '  .mathai-ts-title { font-size: 26px; }',
      '  .mathai-ts-subtitle { font-size: 16px; }',
      '  .mathai-ts-btn { padding: 12px 28px; font-size: 16px; min-width: 140px; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * TransitionScreenComponent
   */
  class TransitionScreenComponent {
    /**
     * @param {object} config
     * @param {boolean} config.autoInject     - Auto-find slot (default: true)
     * @param {string}  config.slotId         - Slot ID (default: 'mathai-transition-slot')
     * @param {string}  config.gameContentId  - Game content ID to toggle (default: 'gameContent')
     */
    constructor(config) {
      if (config === undefined) config = {};

      this.config = {
        autoInject: true,
        slotId: 'mathai-transition-slot',
        gameContentId: 'gameContent'
      };
      var keys = Object.keys(config);
      for (var i = 0; i < keys.length; i++) {
        this.config[keys[i]] = config[keys[i]];
      }

      this.container = null;
      this.gameContent = null;
      this.currentButtons = [];
      this.currentPersist = false;
      this.currentConfig = null;

      this._onMountedQueue = [];

      // Element references
      this._cardEl = null;
      this._iconsEl = null;
      this._titleEl = null;
      this._subtitleEl = null;
      this._customEl = null;
      this._buttonsEl = null;

      injectDefaultStyles();

      if (this.config.autoInject) {
        this.injectIntoSlot();
      }
    }

    /**
     * Find and inject into slot
     */
    injectIntoSlot() {
      this.container = document.getElementById(this.config.slotId);

      if (!this.container) {
        console.warn('TransitionScreen: Slot #' + this.config.slotId + ' not found');

        // Fallback: Create in .mathai-layout-body (v2) or .game-stack (v1)
        var parent = document.querySelector('.mathai-layout-body') || document.querySelector('.game-stack');
        if (parent) {
          this.container = document.createElement('div');
          this.container.id = this.config.slotId;
          this.container.className = 'game-block';
          this.container.style.display = 'none';
          parent.appendChild(this.container);
        } else {
          throw new Error('TransitionScreen: No layout container found. Call ScreenLayout.inject() first.');
        }
      }

      this.gameContent = document.getElementById(this.config.gameContentId);
      this._buildStructure();
      this._setupEventDelegation();
    }

    /**
     * Build the card structure inside the container
     */
    _buildStructure() {
      this.container.className = 'mathai-ts-screen';

      var card = document.createElement('div');
      card.className = 'mathai-ts-card';

      var icons = document.createElement('div');
      icons.className = 'mathai-ts-icons';

      var title = document.createElement('h2');
      title.className = 'mathai-ts-title';

      var subtitle = document.createElement('p');
      subtitle.className = 'mathai-ts-subtitle';
      subtitle.style.display = 'none';

      var custom = document.createElement('div');
      custom.className = 'mathai-ts-custom';

      var buttons = document.createElement('div');
      buttons.className = 'mathai-ts-buttons';

      card.appendChild(icons);
      card.appendChild(title);
      card.appendChild(subtitle);
      card.appendChild(custom);
      card.appendChild(buttons);

      this.container.innerHTML = '';
      this.container.appendChild(card);

      this._cardEl = card;
      this._iconsEl = icons;
      this._titleEl = title;
      this._subtitleEl = subtitle;
      this._customEl = custom;
      this._buttonsEl = buttons;
    }

    /**
     * Event delegation for buttons
     */
    _setupEventDelegation() {
      var self = this;
      this._buttonsEl.addEventListener('click', function(e) {
        var target = e.target;
        if (target.matches && target.matches('.mathai-ts-btn')) {
          var idx = parseInt(target.getAttribute('data-index'), 10);
          var btn = self.currentButtons[idx];
          if (btn && btn.action) {
            btn.action();
            if (!self.currentPersist) {
              self.hide();
            }
          }
        }
      });
    }

    /**
     * Show the transition card.
     * @param {object} config
     * @param {Array|string}   [config.icons]       - Emoji icons
     * @param {string}         [config.iconSize]    - 'small' | 'normal' | 'large'
     * @param {number}         [config.stars]       - 0-3 stars
     * @param {string}         [config.title]
     * @param {string}         [config.subtitle]
     * @param {Array}          [config.buttons]     - [{text, type, action, styles}]
     * @param {string|HTMLElement} [config.content] - Custom HTML / element in card slot
     * @param {object}         [config.styles]      - Per-element style overrides
     * @param {Function}       [config.onMounted]   - Fired once after mount
     */
    show(config) {
      if (!config) config = {};
      var self = this;

      var icons = config.icons;
      var iconSize = config.iconSize;
      var stars = config.stars;
      var title = config.title;
      var subtitle = config.subtitle;
      var buttons = config.buttons;
      var content = config.content;
      var customStyles = config.styles || {};
      if (typeof config.onMounted === 'function') this._onMountedQueue.push(config.onMounted);

      var titleStyles = customStyles.title;
      var subtitleStyles = customStyles.subtitle;

      return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        // Hide game content
        if (self.gameContent) {
          self.gameContent.style.display = 'none';
        }

        // Reset previous state
        self._iconsEl.innerHTML = '';
        self._buttonsEl.innerHTML = '';
        self._customEl.innerHTML = '';
        self._titleEl.textContent = '';
        self._titleEl.style.cssText = '';
        self._subtitleEl.textContent = '';
        self._subtitleEl.style.cssText = '';
        self._subtitleEl.style.display = 'none';
        self._customEl.style.cssText = '';
        self._cardEl.style.cssText = '';

        // Apply custom styles
        if (customStyles.screen) applyStyles(self.container, customStyles.screen);
        if (customStyles.card) applyStyles(self._cardEl, customStyles.card);
        if (customStyles.icons) applyStyles(self._iconsEl, customStyles.icons);
        if (customStyles.buttons) applyStyles(self._buttonsEl, customStyles.buttons);
        if (customStyles.custom) applyStyles(self._customEl, customStyles.custom);

        // --- Icons / Stars ---
        if (stars !== undefined && stars !== null) {
          self._iconsEl.innerHTML = self._createStarsHTML(stars, 3);
        } else if (icons) {
          var iconArr = Array.isArray(icons) ? icons : [icons];
          for (var i = 0; i < iconArr.length; i++) {
            var iconEl = document.createElement('span');
            iconEl.className = 'mathai-ts-icon ' + (iconSize || 'normal');
            iconEl.textContent = iconArr[i];
            self._iconsEl.appendChild(iconEl);
          }
        }

        // --- Title ---
        if (title) {
          self._titleEl.textContent = title;
          self._titleEl.style.display = '';
          if (titleStyles) applyStyles(self._titleEl, titleStyles);
        } else {
          self._titleEl.style.display = 'none';
        }

        // --- Subtitle ---
        if (subtitle) {
          self._subtitleEl.textContent = subtitle;
          self._subtitleEl.style.display = '';
          if (subtitleStyles) applyStyles(self._subtitleEl, subtitleStyles);
        } else {
          self._subtitleEl.style.display = 'none';
        }

        // --- Custom content ---
        if (content) {
          if (typeof content === 'string') {
            self._customEl.innerHTML = content;
          } else if (content instanceof HTMLElement) {
            self._customEl.appendChild(content);
          }
        }

        // --- Buttons ---
        self.currentButtons = [];
        self.currentPersist = false;
        if (buttons && buttons.length > 0) {
          self.currentButtons = buttons.slice();
          for (var b = 0; b < buttons.length; b++) {
            var btn = buttons[b];
            var btnEl = document.createElement('button');
            btnEl.textContent = btn.text;
            btnEl.className = 'mathai-ts-btn ' + (btn.type || 'primary');
            btnEl.setAttribute('data-index', b);
            if (btn.styles) applyStyles(btnEl, btn.styles);
            self._buttonsEl.appendChild(btnEl);
          }
        }

        // Show
        self.container.classList.add('active');
        self.container.style.display = '';

        self.currentConfig = {};

        // Signal mounted after styles flush
        requestAnimationFrame(function() {
          var q = self._onMountedQueue;
          self._onMountedQueue = [];
          for (var i = 0; i < q.length; i++) {
            try { q[i](); } catch (e) { console.error('[TransitionScreen] onMounted cb error', e); }
          }
          resolve();
        });
      });
      });
    }

    /**
     * Register a one-shot callback fired when the next show() has fully mounted.
     * @param {Function} cb
     */
    onMounted(cb) {
      if (typeof cb === 'function') this._onMountedQueue.push(cb);
    }

    getCustomSlot() {
      return this._customEl || null;
    }

    getCard() {
      return this._cardEl || null;
    }


    _createStarsHTML(activeStars, totalStars) {
      if (totalStars === undefined) totalStars = 3;
      var html = '<div class="mathai-ts-stars">';
      for (var i = 0; i < totalStars; i++) {
        var isActive = i < activeStars;
        html += '<div class="mathai-ts-star">' + this._createSVGStar(isActive) + '</div>';
      }
      html += '</div>';
      return html;
    }

    /**
     * Create SVG star
     */
    _createSVGStar(isActive) {
      var color = isActive ? '#FFDE49' : '#E0E0E0';
      var highlight = isActive ? '#ffff8d' : '#E0E0E0';
      var shadow = isActive ? '#f4b400' : '#E0E0E0';

      return '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">'
        + '<path d="M68.05 7.23l13.46 30.7a7.047 7.047 0 0 0 5.82 4.19l32.79 2.94c3.71.54 5.19 5.09 2.5 7.71l-24.7 20.75c-2 1.68-2.91 4.32-2.36 6.87l7.18 33.61c.63 3.69-3.24 6.51-6.56 4.76L67.56 102a7.033 7.033 0 0 0-7.12 0l-28.62 16.75c-3.31 1.74-7.19-1.07-6.56-4.76l7.18-33.61c.54-2.55-.36-5.19-2.36-6.87L5.37 52.78c-2.68-2.61-1.2-7.17 2.5-7.71l32.79-2.94a7.047 7.047 0 0 0 5.82-4.19l13.46-30.7c1.67-3.36 6.45-3.36 8.11-.01z" fill="' + color + '"/>'
        + '<path d="M67.07 39.77l-2.28-22.62c-.09-1.26-.35-3.42 1.67-3.42c1.6 0 2.47 3.33 2.47 3.33l6.84 18.16c2.58 6.91 1.52 9.28-.97 10.68c-2.86 1.6-7.08.35-7.73-6.13z" fill="' + highlight + '"/>'
        + '<path d="M95.28 71.51L114.9 56.2c.97-.81 2.72-2.1 1.32-3.57c-1.11-1.16-4.11.51-4.11.51l-17.17 6.71c-5.12 1.77-8.52 4.39-8.82 7.69c-.39 4.4 3.56 7.79 9.16 3.97z" fill="' + shadow + '"/>'
        + '</svg>';
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
    }

    /**
     * Cleanup
     */
    destroy() {
      this.hide();
      if (this.container) {
        this.container.innerHTML = '';
      }
      this._cardEl = null;
      this._iconsEl = null;
      this._titleEl = null;
      this._subtitleEl = null;
      this._customEl = null;
      this._buttonsEl = null;
    }
  }

  window.TransitionScreenComponent = TransitionScreenComponent;
})(window);
