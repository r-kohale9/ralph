/**
 * FloatingButtonComponent v1 — Fixed-bottom Submit / Retry / Next button
 *
 * A reusable floating action button that owns the Submit → Retry / Next
 * lifecycle for every MathAI game whose flow includes a Submit CTA.
 *
 * Visibility is **game-state-driven, NOT interaction-driven**. The component
 * starts hidden. Game code calls setSubmittable(true) only when the current
 * game state is valid to evaluate (e.g. input non-empty, all tiles placed,
 * option selected) and setSubmittable(false) whenever the state becomes
 * invalid again. See PART-050 for the full contract.
 *
 * Supersedes PART-022's action-button state machine for any game that sets
 * spec.floatingButton !== false.
 *
 * @version 1.0.0
 * @license MIT
 */

(function (window) {
  "use strict";

  if (typeof window.FloatingButtonComponent !== "undefined") {
    console.log("[FloatingButtonComponent] Already loaded, skipping duplicate execution");
    return;
  }

  var VERSION = "1.2.1";
  var STYLE_ID = "mathai-floating-button-styles";

  var DEFAULT_LABELS = {
    submit: "Submit and check",
    retry: "Try again",
    next: "Next",
    submitting: "Submitting…"
  };

  /**
   * @param {object} config
   * @param {string} [config.slotId]    - Slot ID to mount into (default: 'mathai-floating-button-slot').
   *                                      If the slot is missing, the component creates a sibling <div> on <body>.
   * @param {boolean} [config.addDelay] - DEPRECATED / no-op. Earlier versions delayed the first reveal
   *                                      by 1500ms to mirror framer-motion's React FlowButton entrance,
   *                                      but in our model the button becomes visible on user interaction
   *                                      (not on component mount), so a 1.5s delay made the button feel
   *                                      broken. Retained for back-compat but ignored — every reveal uses
   *                                      the short spring animation (~260ms) with no delay.
   * @param {object}  [config.labels]   - { submit, retry, next, submitting } label overrides.
   */
  function FloatingButtonComponent(config) {
    config = config || {};
    this.config = {
      slotId: config.slotId || "mathai-floating-button-slot",
      addDelay: config.addDelay !== false
    };

    this._labels = assign({}, DEFAULT_LABELS, config.labels || {});
    this._secondaryLabel = null; // set via setLabels({ secondary: '...' }) — enables dual-button variant

    this._container = null;     // the mount slot
    this._root = null;          // the floating bar wrapper
    this._errorEl = null;
    this._btn = null;           // primary button
    this._btn2 = null;          // secondary button (dual variant)

    this._mode = null;          // 'submit' | 'retry' | 'next' | null (hidden)
    this._isSubmitting = false;
    this._disabled = false;
    this._hasAnimatedOnce = false;

    this._handlers = { submit: null, retry: null, next: null, secondary: null };

    this._init();
  }

  // ============================================================
  // Init
  // ============================================================

  FloatingButtonComponent.prototype._init = function () {
    this._injectStyles();
    this._resolveSlot();
    this._buildDom();
    console.log("[FloatingButton] Initialized v" + VERSION);
  };

  FloatingButtonComponent.prototype._resolveSlot = function () {
    this._container = document.getElementById(this.config.slotId);
    if (!this._container) {
      // Graceful fallback: create the slot on <body> so games that forgot to
      // pass slots.floatingButton:true still get a working button. The
      // validator (GEN-FLOATING-BUTTON-SLOT) flags the missing slot in source.
      var fallback = document.createElement("div");
      fallback.id = this.config.slotId;
      fallback.setAttribute("data-mathai-autocreated", "true");
      document.body.appendChild(fallback);
      this._container = fallback;
      console.warn(
        "[FloatingButton] Slot #" + this.config.slotId + " not found. " +
        "Auto-created as a <body> child. Declare slots.floatingButton:true in ScreenLayout.inject() to silence this warning."
      );
    }
  };

  FloatingButtonComponent.prototype._buildDom = function () {
    var self = this;

    this._root = document.createElement("div");
    this._root.className = "mathai-fb-root";
    this._root.setAttribute("data-mathai-fb-mode", "hidden");
    // Starts hidden — display:none keeps it out of layout until setMode flips it.
    this._root.style.display = "none";

    this._errorEl = document.createElement("div");
    this._errorEl.className = "mathai-fb-error";
    this._errorEl.style.display = "none";
    this._root.appendChild(this._errorEl);

    var btnRow = document.createElement("div");
    btnRow.className = "mathai-fb-btn-row";

    this._btn = document.createElement("button");
    this._btn.type = "button";
    this._btn.className = "mathai-fb-btn mathai-fb-btn-primary";
    this._btn.textContent = this._labels.submit;
    this._btn.addEventListener("click", function () {
      self._onPrimaryClick();
    });
    btnRow.appendChild(this._btn);

    this._btn2 = document.createElement("button");
    this._btn2.type = "button";
    this._btn2.className = "mathai-fb-btn mathai-fb-btn-secondary";
    this._btn2.style.display = "none";
    this._btn2.addEventListener("click", function () {
      self._onSecondaryClick();
    });
    btnRow.appendChild(this._btn2);

    this._root.appendChild(btnRow);
    this._container.appendChild(this._root);
  };

  // ============================================================
  // Styles
  // ============================================================

  FloatingButtonComponent.prototype._injectStyles = function () {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    // Tokens ported from the React FlowButton reference
    // (mathai-client/src/modules/flow/components/FlowButton.tsx) + Tailwind
    // theme (tailwind.config.js):
    //   #FFDE49  gargoyle-gas  (primary CTA bg)
    //   #FFFFFF  white         (secondary CTA bg, dual-button variant)
    //   #DDDDDD  disabled bg
    //   #333333  dark-charcoal (text colour)
    //   #ECECEC  idle border
    //   #270F36  active/tap border
    //   #FB7D7D  congo-pink    (error text)
    //   8px      rounded-lg
    //   68px     button height
    //   20px 53px  button padding
    //   4px      gap between dual buttons
    //   z-index: 3
    //   box-shadow: 0px 2px 1px rgba(0,0,0,0.1)
    style.textContent =
      "@keyframes mathai-fb-spring-in {" +
      "  0%   { transform: translateX(-50%) scale(0);    opacity: 0; }" +
      "  60%  { transform: translateX(-50%) scale(1.04); opacity: 1; }" +
      "  100% { transform: translateX(-50%) scale(1);    opacity: 1; }" +
      "}" +
      ".mathai-fb-root {" +
      "  position: fixed; left: 50%; bottom: 0;" +
      "  transform: translateX(-50%);" +
      "  width: 100%; max-width: var(--mathai-game-max-width, 480px);" +
      "  padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px)) 0;" +
      "  box-sizing: border-box;" +
      "  background: transparent;" +
      "  z-index: 3;" +
      "  font-family: var(--mathai-font-family, system-ui, -apple-system, 'Segoe UI', sans-serif);" +
      "  pointer-events: auto;" +
      "}" +
      /* Single entrance animation — no delay. The 1500ms "first reveal" delay
       * from the React framer-motion reference was measured from component
       * mount; in our model the button becomes visible on user interaction, so
       * 1.5s of invisibility makes the game feel broken. Single ~280ms spring. */
      ".mathai-fb-root[data-mathai-fb-animating='in'] {" +
      "  animation: mathai-fb-spring-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;" +
      "}" +
      ".mathai-fb-error {" +
      "  padding: 0 0 8px 0;" + /* pb-2, no horizontal padding — match React */
      "  text-align: center;" +
      "  font-size: 14px; line-height: 20px;" + /* text-sm → 0.875rem / 1.25rem */
      "  color: #FB7D7D;" + /* text-congo-pink */
      "  font-weight: 400;" +
      "}" +
      ".mathai-fb-btn-row {" +
      "  display: flex; justify-content: space-around;" +
      "  gap: 4px; padding: 0 4px;" +
      "}" +
      ".mathai-fb-btn {" +
      "  flex: 1 1 auto;" +
      "  height: 68px;" +
      "  padding: 20px 53px;" +
      "  font-size: 1.125rem;" + /* text-base */
      "  line-height: 1.75rem;" +
      "  font-family: inherit;" +
      "  font-weight: 600;" + /* font-normal */
      "  color: rgb(51, 51, 51);" + /* text-dark-charcoal */
      "  background: #FFDE49;" + /* gargoyle-gas (primary) */
      "  border: none;" +
      "  border-radius: 8px;" + /* rounded-lg */
      "  box-shadow: rgba(0, 0, 0, 0.16) 2px 2px 16px;" +
      "  cursor: pointer;" +
      "  transition: opacity 150ms ease, border-color 150ms ease;" +
      "  -webkit-tap-highlight-color: transparent;" +
      "  -webkit-appearance: none; appearance: none;" +
      "  white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" +
      "}" +
      ".mathai-fb-btn:hover:not(:disabled) { opacity: 0.9; }" +
      ".mathai-fb-btn:active:not(:disabled) { opacity: 0.9; border-color: #270F36; }" +
      ".mathai-fb-btn[data-mathai-fb-pressed='true']:not(:disabled) { border-color: #270F36; }" +
      ".mathai-fb-btn:disabled {" +
      "  background: #DDDDDD;" + /* disabled grey per reference */
      "  cursor: not-allowed;" +
      "  box-shadow: none;" +
      "}" +
      /* Dual-button variant: match React reference. When the component is in
       * single-button mode (secondary hidden), the primary is yellow — the
       * canonical "Submit" CTA. When dual mode is active (secondary shown,
       * indicated by the `data-mathai-fb-dual="true"` attribute on the root),
       * BOTH buttons are white with dark text — matching how ContentBlock.tsx
       * in mathai-client renders option A / option B (no isPrimary on either).
       * Keeping one yellow in dual mode would imply one is "primary" when
       * both are equal parallel choices. */
      ".mathai-fb-btn-secondary { background: #FFFFFF; }" +
      ".mathai-fb-root[data-mathai-fb-dual='true'] .mathai-fb-btn-primary { background: #FFFFFF; }" +
      /* Narrow-viewport fallback: the 20px 53px padding overflows below ~340px.
       * Drop horizontal padding to keep the button inside the viewport. */
      "@media (max-width: 360px) {" +
      "  .mathai-fb-btn { padding: 20px 16px; }" +
      "}";

    document.head.appendChild(style);
    console.log("[FloatingButton] Styles injected (React-reference palette)");
  };

  // ============================================================
  // Public API — visibility
  // ============================================================

  /**
   * Set the current mode. 'submit' / 'retry' / 'next' show the button with
   * the mode-appropriate colour + label; null / 'hidden' hides the component
   * entirely (display:none — no floating bar visible).
   */
  FloatingButtonComponent.prototype.setMode = function (mode) {
    if (mode !== "submit" && mode !== "retry" && mode !== "next" && mode !== null && mode !== "hidden") {
      console.warn("[FloatingButton] setMode: unknown mode '" + mode + "' — coercing to null (hidden)");
      mode = null;
    }
    if (mode === "hidden") mode = null;

    var prevMode = this._mode;
    this._mode = mode;

    if (mode === null) {
      this._root.style.display = "none";
      this._root.setAttribute("data-mathai-fb-mode", "hidden");
      this._root.removeAttribute("data-mathai-fb-animating");
      return;
    }

    this._root.setAttribute("data-mathai-fb-mode", mode);
    this._btn.textContent = this._isSubmitting ? this._labels.submitting : this._labels[mode];
    this._btn.disabled = this._disabled || this._isSubmitting;

    // Secondary button is only visible in 'submit' mode AND when a secondary
    // label has been explicitly set via setLabels({ secondary: '...' }).
    // When the dual-button variant is active, set `data-mathai-fb-dual="true"`
    // on the root so the stylesheet can flip the primary button to white —
    // matching ContentBlock.tsx in mathai-client (parallel options = both
    // white, no "primary" yellow among equal choices).
    if (mode === "submit" && this._secondaryLabel) {
      this._btn2.textContent = this._isSubmitting ? this._labels.submitting : this._secondaryLabel;
      this._btn2.style.display = "";
      this._btn2.disabled = this._disabled || this._isSubmitting;
      this._root.setAttribute("data-mathai-fb-dual", "true");
    } else {
      this._btn2.style.display = "none";
      this._root.setAttribute("data-mathai-fb-dual", "false");
    }

    // Reveal + animate when transitioning from hidden.
    var wasHidden = prevMode === null;
    if (wasHidden) {
      this._root.style.display = "";
      // Single entrance animation — no delay. (addDelay config is deprecated
      // and ignored: the React-reference 1500ms delay was measured from
      // component mount, which doesn't map to our interaction-triggered model.)
      var animKind = "in";
      this._root.removeAttribute("data-mathai-fb-animating");
      // Force a reflow so the animation replays on every hidden→visible flip.
      void this._root.offsetWidth;
      this._root.setAttribute("data-mathai-fb-animating", animKind);
    }
  };

  /**
   * Convenience: true => setMode('submit'); false => setMode(null). Call this
   * from every input/state-change handler that can affect submittability.
   * Does nothing if the current mode is 'retry' or 'next' — those modes are
   * driven by submit-result state, not by input validity.
   */
  FloatingButtonComponent.prototype.setSubmittable = function (bool) {
    if (this._mode === "retry" || this._mode === "next") return;
    this.setMode(bool ? "submit" : null);
  };

  FloatingButtonComponent.prototype.show = function () {
    this.setMode("submit");
  };

  FloatingButtonComponent.prototype.hide = function () {
    this.setMode(null);
  };

  // ============================================================
  // Public API — state
  // ============================================================

  FloatingButtonComponent.prototype.setDisabled = function (isDisabled) {
    this._disabled = !!isDisabled;
    if (this._mode !== null) {
      this._btn.disabled = this._disabled || this._isSubmitting;
      if (this._btn2.style.display !== "none") {
        this._btn2.disabled = this._disabled || this._isSubmitting;
      }
    }
  };

  /**
   * @param {object} labels - Any subset of { submit, retry, next, submitting, secondary }.
   *                          Passing `secondary` enables the dual-button variant (only rendered in mode='submit').
   *                          Passing `secondary: null` disables the dual-button variant.
   */
  FloatingButtonComponent.prototype.setLabels = function (labels) {
    if (!labels || typeof labels !== "object") return;
    if ("secondary" in labels) {
      this._secondaryLabel = labels.secondary || null;
    }
    ["submit", "retry", "next", "submitting"].forEach(function (k) {
      if (k in labels && typeof labels[k] === "string") this._labels[k] = labels[k];
    }, this);
    // Re-render current mode with new labels.
    if (this._mode !== null) this.setMode(this._mode);
  };

  FloatingButtonComponent.prototype.setError = function (text) {
    if (text) {
      // Match React reference: `*{errorText}` — the component prefixes with
      // an asterisk so callers don't need to include it. If the caller has
      // already passed a leading `*`, don't double it up.
      this._errorEl.textContent =
        text.charAt(0) === "*" ? text : ("*" + text);
      this._errorEl.style.display = "";
    } else {
      this._errorEl.textContent = "";
      this._errorEl.style.display = "none";
    }
  };

  /**
   * Register an event handler. Supported events: 'submit', 'retry', 'next', 'secondary'.
   * The 'submit' handler can be async — while its promise is pending the button
   * shows the 'submitting' label and ignores further clicks.
   */
  FloatingButtonComponent.prototype.on = function (event, handler) {
    if (!(event in this._handlers)) {
      console.warn("[FloatingButton] on: unknown event '" + event + "'");
      return;
    }
    this._handlers[event] = typeof handler === "function" ? handler : null;
  };

  // ============================================================
  // Internal — click handling
  // ============================================================

  FloatingButtonComponent.prototype._onPrimaryClick = function () {
    var self = this;
    if (this._isSubmitting || this._disabled || this._mode === null) return;

    // Mirror React reference isClick / isClick2: tapped button gets the dark
    // border, the other loses it. Pure visual state.
    this._btn.setAttribute("data-mathai-fb-pressed", "true");
    if (this._btn2) this._btn2.setAttribute("data-mathai-fb-pressed", "false");

    var currentMode = this._mode;
    var handler = this._handlers[currentMode];
    if (!handler) return;

    // AUTO-HIDE ON SUBMIT CLICK. After tapping Submit, the button must
    // disappear immediately — the player is now watching feedback audio /
    // inline results, not the button. Keeping Submit visible (or greyed with
    // "Submitting…") during the async feedback leaves a tappable CTA on
    // screen that invites double-submit and confuses the eye away from the
    // feedback panel. The handler is responsible for flipping mode to retry
    // / next when its async work completes; until then the button stays
    // hidden. Retry / Next click paths keep their existing behaviour — their
    // handlers typically call destroy() or setMode(null) themselves.
    //
    // This also fixes the sync-fire-and-forget mis-pattern:
    //   floatingBtn.on('submit', function () {
    //     handleSubmit(...);   // returns undefined — no Promise tracking
    //   });
    // Previously the button stayed in 'submit' mode during handleSubmit's
    // async work because no Promise flowed back here to trigger the
    // Submitting state. Now the button hides regardless.
    if (currentMode === "submit") {
      this.setMode(null);
    }

    var result;
    try {
      result = handler();
    } catch (err) {
      console.error("[FloatingButton] Handler threw:", err);
      return;
    }

    if (result && typeof result.then === "function") {
      result.catch(function (err) {
        console.error("[FloatingButton] Async handler rejected:", err);
      });
    }
  };

  FloatingButtonComponent.prototype._onSecondaryClick = function () {
    var self = this;
    if (this._isSubmitting || this._disabled) return;

    // Mirror React reference isClick2: tapped secondary gets dark border.
    this._btn2.setAttribute("data-mathai-fb-pressed", "true");
    this._btn.setAttribute("data-mathai-fb-pressed", "false");

    var handler = this._handlers.secondary;
    if (!handler) return;

    var result;
    try {
      result = handler();
    } catch (err) {
      console.error("[FloatingButton] Secondary handler threw:", err);
      return;
    }
    if (result && typeof result.then === "function") {
      this._enterSubmittingState();
      result
        .catch(function (err) {
          console.error("[FloatingButton] Secondary async handler rejected:", err);
        })
        .then(function () {
          self._exitSubmittingState();
        });
    }
  };

  FloatingButtonComponent.prototype._enterSubmittingState = function () {
    this._isSubmitting = true;
    this._btn.textContent = this._labels.submitting;
    this._btn.disabled = true;
    if (this._btn2.style.display !== "none") {
      this._btn2.textContent = this._labels.submitting;
      this._btn2.disabled = true;
    }
  };

  FloatingButtonComponent.prototype._exitSubmittingState = function () {
    this._isSubmitting = false;
    if (this._mode !== null) {
      this._btn.textContent = this._labels[this._mode];
      this._btn.disabled = this._disabled;
      if (this._btn2.style.display !== "none" && this._secondaryLabel) {
        this._btn2.textContent = this._secondaryLabel;
        this._btn2.disabled = this._disabled;
      }
    }
  };

  // ============================================================
  // destroy
  // ============================================================

  FloatingButtonComponent.prototype.destroy = function () {
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    // Remove auto-created fallback slot if we made it.
    if (
      this._container &&
      this._container.getAttribute &&
      this._container.getAttribute("data-mathai-autocreated") === "true" &&
      this._container.parentNode
    ) {
      this._container.parentNode.removeChild(this._container);
    }
    this._root = null;
    this._container = null;
    this._btn = null;
    this._btn2 = null;
    this._errorEl = null;
    this._handlers = { submit: null, retry: null, next: null, secondary: null };
    console.log("[FloatingButton] Destroyed");
  };

  // ============================================================
  // utils
  // ============================================================

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
      }
    }
    return target;
  }

  // ============================================================
  // Export
  // ============================================================

  window.FloatingButtonComponent = FloatingButtonComponent;
  window.FloatingButton = FloatingButtonComponent;

  console.log("[MathAI] FloatingButton v" + VERSION + " loaded");
})(window);
