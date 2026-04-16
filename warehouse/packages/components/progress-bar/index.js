/**
 * ProgressBarComponent
 * Shows round progress label, lives (hearts), and a slim progress track.
 *
 * v2: Clean minimal UI matching reference designs. Fully customizable styles.
 * Backwards compatible with v1 constructor config.
 *
 * @version 2.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  if (typeof window.ProgressBarComponent !== 'undefined') return;

  var STYLE_ID = 'mathai-progress-bar-styles';

  /**
   * Inject component CSS (once per page)
   */
  function injectDefaultStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      /* Container — no background/border by default (game controls that) */
      '.mathai-pb-root {',
      '  width: 100%;',
      '  font-family: var(--mathai-font-family, "Inter", -apple-system, BlinkMacSystemFont, sans-serif);',
      '}',

      /* Header row: label left, lives right */
      '.mathai-pb-header {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  margin-bottom: 10px;',
      '}',

      /* Round label */
      '.mathai-pb-label {',
      '  font-size: 16px;',
      '  font-weight: 700;',
      '  color: #3A3A3A;',
      '}',

      /* Lives display */
      '.mathai-pb-lives {',
      '  display: flex;',
      '  gap: 4px;',
      '  align-items: center;',
      '  font-size: 20px;',
      '  line-height: 1;',
      '}',

      /* Track */
      '.mathai-pb-track {',
      '  width: 100%;',
      '  height: 6px;',
      '  background: #E4E6ED;',
      '  border-radius: 3px;',
      '  overflow: hidden;',
      '}',

      /* Fill */
      '.mathai-pb-fill {',
      '  height: 100%;',
      '  background: #2F66E6;',
      '  border-radius: 3px;',
      '  transition: width 0.3s ease;',
      '  width: 0%;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Apply a styles object to an element
   */
  function applyStyles(el, stylesObj) {
    if (!stylesObj || typeof stylesObj !== 'object') return;
    var keys = Object.keys(stylesObj);
    for (var i = 0; i < keys.length; i++) {
      el.style[keys[i]] = stylesObj[keys[i]];
    }
  }

  /**
   * ProgressBarComponent
   * Displays round progress and lives using hearts
   */
  class ProgressBarComponent {
    /**
     * @param {object} config
     * @param {boolean}  config.autoInject  - Auto-find slot and inject (default: true)
     * @param {string}   config.slotId      - Slot ID to inject into (default: 'mathai-progress-slot')
     * @param {number}   config.totalRounds  - Total rounds (required)
     * @param {number}   config.totalLives   - Total lives/hearts (required)
     * @param {string}   config.labelFormat  - Label template. Use {current} and {total} placeholders.
     *                                         Default: 'Round {current}/{total}'
     * @param {string}   config.filledHeart  - Emoji for filled heart (default: '❤️')
     * @param {string}   config.emptyHeart   - Emoji for empty heart (default: '🤍')
     * @param {boolean}  config.showLives    - Show lives display (default: true)
     * @param {boolean}  config.showTrack    - Show progress bar track (default: true)
     * @param {boolean}  config.showLabel    - Show round label (default: true)
     * @param {object}   config.styles       - Custom styles per sub-element
     * @param {object}   config.styles.root     - Styles for root container
     * @param {object}   config.styles.header   - Styles for header row
     * @param {object}   config.styles.label    - Styles for round label
     * @param {object}   config.styles.lives    - Styles for lives display
     * @param {object}   config.styles.track    - Styles for progress track
     * @param {object}   config.styles.fill     - Styles for progress fill bar
     */
    constructor(config) {
      if (config === undefined) config = {};

      this.config = {
        autoInject: true,
        slotId: 'mathai-progress-slot',
        totalRounds: 5,
        totalLives: 3,
        labelFormat: null, // resolved below once sections known
        sections: null,    // optional [{label, rounds}]
        filledHeart: '\u2764\uFE0F',   // ❤️
        emptyHeart: '\uD83E\uDD0D',     // 🤍
        showLives: true,
        showTrack: true,
        showLabel: true,
        styles: {}
      };

      // Merge config (shallow for top-level, shallow for styles)
      var keys = Object.keys(config);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i] === 'styles') {
          this.config.styles = config.styles || {};
        } else {
          this.config[keys[i]] = config[keys[i]];
        }
      }

      // Derive totalRounds from sections if not explicitly set
      if (this.config.sections && Array.isArray(this.config.sections) && config.totalRounds == null) {
        var sum = 0;
        for (var si = 0; si < this.config.sections.length; si++) {
          sum += (this.config.sections[si].rounds || 0);
        }
        this.config.totalRounds = sum;
      }

      // Resolve default label format based on sections presence
      if (!this.config.labelFormat) {
        this.config.labelFormat = this.config.sections
          ? '{sectionLabel} \u00B7 {inSection}/{sectionTotal}'
          : 'Round {current}/{total}';
      }

      this.currentRound = 0;
      this.currentLives = this.config.totalLives;
      this._currentSectionIndex = undefined;
      this.container = null;
      this.uniqueId = 'pb-' + Date.now();

      // Element references
      this._labelEl = null;
      this._livesEl = null;
      this._trackEl = null;
      this._fillEl = null;

      // Inject CSS
      injectDefaultStyles();

      if (this.config.autoInject) {
        this.injectIntoSlot();
      }

      this.render();
    }

    /**
     * Find and inject into slot
     */
    injectIntoSlot() {
      this.container = document.getElementById(this.config.slotId);

      if (!this.container) {
        console.warn('ProgressBar: Slot #' + this.config.slotId + ' not found');

        // Fallback: top of .mathai-layout-body (v2) or .game-wrapper (v1)
        var parent = document.querySelector('.mathai-layout-body') || document.querySelector('.game-wrapper');
        if (parent) {
          this.container = document.createElement('div');
          this.container.id = this.config.slotId;
          parent.insertBefore(this.container, parent.firstChild);
        } else {
          throw new Error('ProgressBar: No layout container found. Call ScreenLayout.inject() first.');
        }
      }
    }

    /**
     * Resolve current section from currentRound (or explicit index).
     * Returns null when no sections are configured.
     */
    _resolveSection(currentRound, explicitIndex) {
      var secs = this.config.sections;
      if (!secs || !secs.length) return null;
      if (explicitIndex != null) {
        var before = 0;
        for (var i = 0; i < explicitIndex && i < secs.length; i++) before += (secs[i].rounds || 0);
        var s = secs[explicitIndex] || secs[secs.length - 1];
        var rTotal = s.rounds || 0;
        return {
          index: explicitIndex,
          label: s.label,
          total: rTotal,
          inSection: Math.max(0, Math.min(rTotal, currentRound - before))
        };
      }
      var acc = 0;
      for (var j = 0; j < secs.length; j++) {
        var r = secs[j].rounds || 0;
        if (currentRound <= acc + r || j === secs.length - 1) {
          return {
            index: j,
            label: secs[j].label,
            total: r,
            inSection: Math.max(0, Math.min(r, currentRound - acc))
          };
        }
        acc += r;
      }
      return null;
    }

    /**
     * Format the label. Tokens: {current} {total} {sectionLabel} {sectionIndex} {inSection} {sectionTotal}
     */
    _formatLabel(current, sectionIndex) {
      var total = this.config.totalRounds;
      var sec = this._resolveSection(current, sectionIndex);
      return this.config.labelFormat
        .replace(/\{current\}/g, current)
        .replace(/\{total\}/g, total)
        .replace(/\{sectionLabel\}/g, sec ? sec.label : '')
        .replace(/\{sectionIndex\}/g, sec ? (sec.index + 1) : '')
        .replace(/\{inSection\}/g, sec ? sec.inSection : current)
        .replace(/\{sectionTotal\}/g, sec ? sec.total : total);
    }

    /**
     * Build hearts string
     */
    _buildHearts(currentLives) {
      var filled = '';
      var empty = '';
      for (var i = 0; i < this.config.totalLives; i++) {
        if (i < currentLives) {
          filled += this.config.filledHeart;
        } else {
          empty += this.config.emptyHeart;
        }
      }
      return filled + empty;
    }

    /**
     * Render the progress bar HTML
     */
    render() {
      if (!this.container) return;

      var uid = this.uniqueId;
      var cfg = this.config;
      var customStyles = cfg.styles || {};

      // Root
      var root = document.createElement('div');
      root.className = 'mathai-pb-root';
      if (customStyles.root) applyStyles(root, customStyles.root);

      // Header row (label + lives)
      var showHeader = cfg.showLabel || cfg.showLives;
      if (showHeader) {
        var header = document.createElement('div');
        header.className = 'mathai-pb-header';
        if (customStyles.header) applyStyles(header, customStyles.header);

        // Label
        if (cfg.showLabel) {
          var label = document.createElement('span');
          label.className = 'mathai-pb-label';
          label.id = uid + '-label';
          label.textContent = this._formatLabel(0);
          if (customStyles.label) applyStyles(label, customStyles.label);
          header.appendChild(label);
          this._labelEl = label;
        }

        // Lives
        if (cfg.showLives) {
          var lives = document.createElement('span');
          lives.className = 'mathai-pb-lives';
          lives.id = uid + '-lives';
          lives.setAttribute('aria-label', 'Lives remaining');
          lives.textContent = this._buildHearts(cfg.totalLives);
          if (customStyles.lives) applyStyles(lives, customStyles.lives);
          header.appendChild(lives);
          this._livesEl = lives;
        }

        root.appendChild(header);
      }

      // Track
      if (cfg.showTrack) {
        var track = document.createElement('div');
        track.className = 'mathai-pb-track';
        if (customStyles.track) applyStyles(track, customStyles.track);

        var fill = document.createElement('div');
        fill.className = 'mathai-pb-fill';
        fill.id = uid + '-fill';
        fill.style.width = '0%';
        if (customStyles.fill) applyStyles(fill, customStyles.fill);

        track.appendChild(fill);
        root.appendChild(track);

        this._trackEl = track;
        this._fillEl = fill;
      }

      this.container.innerHTML = '';
      this.container.appendChild(root);
    }

    /**
     * Update progress display
     * @param {number} currentRound - Current round number (rounds COMPLETED)
     * @param {number} currentLives - Remaining lives
     * @param {object} [opts]
     * @param {number} [opts.sectionIndex] - Override computed section index
     */
    update(currentRound, currentLives, opts) {
      opts = opts || {};
      this.currentRound = currentRound;
      this.currentLives = currentLives;
      this._currentSectionIndex = opts.sectionIndex;

      if (this._labelEl) {
        this._labelEl.textContent = this._formatLabel(currentRound, opts.sectionIndex);
      }

      if (this._fillEl) {
        var pct = 0;
        var sec = this._resolveSection(currentRound, opts.sectionIndex);
        if (sec && sec.total > 0) {
          pct = sec.inSection / sec.total * 100;
        } else if (this.config.totalRounds > 0) {
          pct = currentRound / this.config.totalRounds * 100;
        }
        this._fillEl.style.width = pct + '%';
      }

      if (this._livesEl) {
        this._livesEl.textContent = this._buildHearts(currentLives);
      }
    }

    /**
     * Replace the label template at runtime and re-render label with current state.
     */
    setLabel(template) {
      this.config.labelFormat = template;
      if (this._labelEl) {
        this._labelEl.textContent = this._formatLabel(this.currentRound, this._currentSectionIndex);
      }
    }

    /**
     * Toggle lives display visibility without destroying the element.
     */
    setLivesVisible(visible) {
      if (this._livesEl) {
        this._livesEl.style.display = visible ? '' : 'none';
      }
    }

    /**
     * Show the progress bar (restores display). No layout space when hidden.
     */
    show() {
      if (this.container) this.container.style.display = '';
    }

    /**
     * Hide the progress bar (display:none — takes no layout space).
     */
    hide() {
      if (this.container) this.container.style.display = 'none';
    }

    /**
     * Cleanup
     */
    destroy() {
      if (this.container) {
        this.container.innerHTML = '';
      }
      this._labelEl = null;
      this._livesEl = null;
      this._trackEl = null;
      this._fillEl = null;
    }
  }

  window.ProgressBarComponent = ProgressBarComponent;
})(window);
