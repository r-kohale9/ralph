/**
 * AnswerComponent v1 — Post-feedback "Correct Answers!" carousel
 *
 * A reusable card that reveals the evaluated answer view for one or more
 * slides AFTER the user has completed a question (single answer) or all
 * rounds (rounds games). Visibility is gated by the game: the component
 * starts hidden and is only revealed by the game in `endGame()` (or the
 * standalone `endGame(correct)` path), at the same moment the FloatingButton
 * flips to mode 'next'.
 *
 * Slide payload is render-callback only — `{ render(container) {...} }`. The
 * component is dumb about content; each game owns the answer-view DOM and
 * mounts it into the container the component provides. Validator rule
 * GEN-ANSWER-COMPONENT-SLIDE-SHAPE rejects `html` / `element` keys.
 *
 * Visual design mirrors the React generic-answer-renderer in mathai-client
 * (Correct Answers! header strip + prev/i-of-N/next pagination + mint body).
 *
 * See PART-051 for the full contract.
 *
 * @version 1.0.0
 * @license MIT
 */

(function (window) {
  "use strict";

  if (typeof window.AnswerComponentComponent !== "undefined") {
    console.log("[AnswerComponentComponent] Already loaded, skipping duplicate execution");
    return;
  }

  var VERSION = "1.0.0";
  var STYLE_ID = "mathai-answer-styles";

  var DEFAULT_HEADER_LABEL = "Correct Answers!";

  // Inline SVG data URIs — keep the component fully self-contained (no
  // network fetch for icons). The chevron points right naturally; the prev
  // button rotates 180° via CSS to render as a left-chevron, the next
  // button uses it unrotated. Mirrors the React reference's
  // `arrow-back-ios.svg` + `rotate-180` on prev pattern.
  var TICK_ICON_URL =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="11" viewBox="0 0 14 11" fill="none">' +
        '<path d="M1 5.5L5 9.5L13 1.5" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
    );
  var ARROW_ICON_URL =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">' +
        '<path d="M9 6l6 6-6 6" stroke="#333333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
    );

  /**
   * @param {object} config
   * @param {string} [config.slotId] - Slot ID to mount into (default: 'mathai-answer-slot').
   *                                   If the slot is missing, the component creates a sibling <div> on <body>.
   * @param {string} [config.headerLabel] - Header text override (default: 'Correct Answers!').
   */
  function AnswerComponentComponent(config) {
    config = config || {};
    this.config = {
      slotId: config.slotId || "mathai-answer-slot",
      headerLabel: typeof config.headerLabel === "string" ? config.headerLabel : DEFAULT_HEADER_LABEL
    };

    this._container = null; // mount slot
    this._root = null;      // .mathai-answer-root
    this._labelEl = null;
    this._counterEl = null;
    this._prevBtn = null;
    this._nextBtn = null;
    this._bodyEl = null;
    this._slideEl = null;   // inner container passed to render(container)

    this._slides = [];
    this._index = 0;

    this._init();
  }

  // ============================================================
  // Init
  // ============================================================

  AnswerComponentComponent.prototype._init = function () {
    this._injectStyles();
    this._resolveSlot();
    this._buildDom();
    console.log("[AnswerComponent] Initialized v" + VERSION);
  };

  AnswerComponentComponent.prototype._resolveSlot = function () {
    this._container = document.getElementById(this.config.slotId);
    if (!this._container) {
      // Graceful fallback: create the slot on <body> so games that forgot to
      // pass slots.answerComponent:true still get a working component. The
      // validator (GEN-ANSWER-COMPONENT-SLOT) flags the missing slot in source.
      var fallback = document.createElement("div");
      fallback.id = this.config.slotId;
      fallback.setAttribute("data-mathai-autocreated", "true");
      document.body.appendChild(fallback);
      this._container = fallback;
      console.warn(
        "[AnswerComponent] Slot #" + this.config.slotId + " not found. " +
        "Auto-created as a <body> child. Declare slots.answerComponent:true in ScreenLayout.inject() to silence this warning."
      );
    }
  };

  AnswerComponentComponent.prototype._buildDom = function () {
    var self = this;

    this._root = document.createElement("div");
    this._root.className = "mathai-answer-root";
    // Starts hidden — display:none keeps it out of layout until show() flips it.
    this._root.style.display = "none";

    // --- Header ----------------------------------------------------------
    var header = document.createElement("div");
    header.className = "mathai-answer-header";

    var headerLeft = document.createElement("div");
    headerLeft.className = "mathai-answer-header-left";

    var badge = document.createElement("div");
    badge.className = "mathai-answer-tick-badge";
    var tick = document.createElement("img");
    tick.className = "mathai-answer-tick-img";
    tick.src = TICK_ICON_URL;
    tick.alt = "";
    tick.setAttribute("aria-hidden", "true");
    badge.appendChild(tick);
    headerLeft.appendChild(badge);

    this._labelEl = document.createElement("div");
    this._labelEl.className = "mathai-answer-label";
    this._labelEl.textContent = this.config.headerLabel;
    headerLeft.appendChild(this._labelEl);

    var headerRight = document.createElement("div");
    headerRight.className = "mathai-answer-header-right";

    this._prevBtn = document.createElement("button");
    this._prevBtn.type = "button";
    this._prevBtn.className = "mathai-answer-nav-btn mathai-answer-prev-btn";
    this._prevBtn.setAttribute("aria-label", "Previous answer");
    var prevImg = document.createElement("img");
    prevImg.src = ARROW_ICON_URL;
    prevImg.alt = "";
    prevImg.setAttribute("aria-hidden", "true");
    this._prevBtn.appendChild(prevImg);
    this._prevBtn.addEventListener("click", function () {
      self._onPrev();
    });

    this._counterEl = document.createElement("div");
    this._counterEl.className = "mathai-answer-counter";

    this._nextBtn = document.createElement("button");
    this._nextBtn.type = "button";
    this._nextBtn.className = "mathai-answer-nav-btn mathai-answer-next-btn";
    this._nextBtn.setAttribute("aria-label", "Next answer");
    var nextImg = document.createElement("img");
    nextImg.src = ARROW_ICON_URL;
    nextImg.alt = "";
    nextImg.setAttribute("aria-hidden", "true");
    this._nextBtn.appendChild(nextImg);
    this._nextBtn.addEventListener("click", function () {
      self._onNext();
    });

    headerRight.appendChild(this._prevBtn);
    headerRight.appendChild(this._counterEl);
    headerRight.appendChild(this._nextBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // --- Body ------------------------------------------------------------
    this._bodyEl = document.createElement("div");
    this._bodyEl.className = "mathai-answer-body";

    this._slideEl = document.createElement("div");
    this._slideEl.className = "mathai-answer-slide";
    this._bodyEl.appendChild(this._slideEl);

    this._root.appendChild(header);
    this._root.appendChild(this._bodyEl);

    this._container.appendChild(this._root);
  };

  // ============================================================
  // Styles
  // ============================================================

  AnswerComponentComponent.prototype._injectStyles = function () {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    // Palette ported from the React generic-answer-renderer reference
    // (mathai-client .../generic-answer-renderer/index.tsx):
    //   bg-light-yellow header (#F9F8F8)   — Tailwind light-yellow resolves to
    //                                        rgb(249 248 248); the class name
    //                                        is misleading (off-white, not
    //                                        yellow). Solid, no alpha.
    //                                        Badge keeps a #FCF6D7CC tint so
    //                                        the tick has a subtle yellow
    //                                        nest distinct from the wrapper.
    //   bg-nyanza body         (#DAFEDC)   — pale mint
    //   #333                   label text
    //   12px 8px               header padding
    //   24px x 24px            arrow buttons
    //   400px                  card max width
    //   16px                   body padding around the slide container so
    //                          game-rendered DOM has breathing room from
    //                          the card edges
    style.textContent =
      ".mathai-answer-root {" +
      "  width: 100%;" +
      "  max-width: 400px;" +
      "  margin: 0 auto;" +
      "  font-family: var(--mathai-font-family, system-ui, -apple-system, 'Segoe UI', sans-serif);" +
      "  box-sizing: border-box;" +
      "}" +
      ".mathai-answer-header {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: space-between;" +
      "  padding: 12px 8px;" +
      "  background: rgb(249 248 248);" +
      "  box-sizing: border-box;" +
      "}" +
      ".mathai-answer-header-left {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  gap: 4px;" +
      "}" +
      ".mathai-answer-tick-badge {" +
      "  height: 21px;" +
      "  width: 24px;" +
      "  background: #FCF6D7CC;" +
      "  display: flex;" +
      "  justify-content: center;" +
      "  align-items: center;" +
      "  border-radius: 2px;" +
      "  flex-shrink: 0;" +
      "}" +
      ".mathai-answer-tick-img {" +
      "  height: 11px;" +
      "  width: 14px;" +
      "  display: block;" +
      "}" +
      ".mathai-answer-label {" +
      "  color: #333;" +
      "  font-size: 14px;" +
      "  font-weight: 600;" +
      "  line-height: 21px;" +
      "}" +
      ".mathai-answer-header-right {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  gap: 4px;" +
      "  margin-right: 8px;" +
      "}" +
      ".mathai-answer-nav-btn {" +
      "  height: 24px;" +
      "  width: 24px;" +
      "  padding: 0;" +
      "  border: none;" +
      "  background: transparent;" +
      "  cursor: pointer;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  -webkit-tap-highlight-color: transparent;" +
      "  -webkit-appearance: none;" +
      "  appearance: none;" +
      "}" +
      ".mathai-answer-nav-btn img {" +
      "  height: 24px;" +
      "  width: 24px;" +
      "  display: block;" +
      "}" +
      ".mathai-answer-prev-btn img {" +
      "  transform: rotate(180deg);" +
      "}" +
      ".mathai-answer-nav-btn[disabled]," +
      ".mathai-answer-nav-btn[aria-disabled='true'] {" +
      "  opacity: 0.3;" +
      "  cursor: not-allowed;" +
      "}" +
      ".mathai-answer-counter {" +
      "  color: #333;" +
      "  font-size: 14px;" +
      "  font-weight: 600;" +
      "  line-height: 21px;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  min-width: 28px;" +
      "  justify-content: center;" +
      "}" +
      ".mathai-answer-body {" +
      "  background: #DAFEDC;" +
      "  padding: 16px;" +
      "  box-sizing: border-box;" +
      "  width: 100%;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "}" +
      ".mathai-answer-slide {" +
      "  width: 100%;" +
      "  padding: 8px;" +
      "  box-sizing: border-box;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "}";

    document.head.appendChild(style);
    console.log("[AnswerComponent] Styles injected");
  };

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Reveal the component and render the provided slides.
   *
   * @param {object} opts
   * @param {Array<{render: function(HTMLElement): void}>} opts.slides
   *   One entry per evaluated answer. Each MUST be a `{ render }` object
   *   where `render(container)` mounts the answer view into `container`.
   *   The component clears the container before each invocation.
   *   `html` / `element` keys are not supported (validator rule
   *   GEN-ANSWER-COMPONENT-SLIDE-SHAPE).
   * @param {string} [opts.headerLabel] - Override header text for this show().
   */
  AnswerComponentComponent.prototype.show = function (opts) {
    opts = opts || {};
    var slides = Array.isArray(opts.slides) ? opts.slides : [];
    this._validateSlides(slides);
    this._slides = slides;
    this._index = 0;
    if (typeof opts.headerLabel === "string") {
      this._labelEl.textContent = opts.headerLabel;
    }
    this._renderActiveSlide();
    this._updateNav();
    this._root.style.display = "";
  };

  AnswerComponentComponent.prototype.hide = function () {
    this._root.style.display = "none";
  };

  /**
   * Replace slides without toggling visibility. No-op for the visible state.
   */
  AnswerComponentComponent.prototype.update = function (opts) {
    opts = opts || {};
    if (Array.isArray(opts.slides)) {
      this._validateSlides(opts.slides);
      this._slides = opts.slides;
      if (this._index >= this._slides.length) {
        this._index = Math.max(0, this._slides.length - 1);
      }
      this._renderActiveSlide();
      this._updateNav();
    }
    if (typeof opts.headerLabel === "string") {
      this._labelEl.textContent = opts.headerLabel;
    }
  };

  AnswerComponentComponent.prototype.setSlideIndex = function (i) {
    if (typeof i !== "number" || !this._slides.length) return;
    var clamped = Math.max(0, Math.min(this._slides.length - 1, i | 0));
    if (clamped === this._index) return;
    this._index = clamped;
    this._renderActiveSlide();
    this._updateNav();
  };

  AnswerComponentComponent.prototype.isVisible = function () {
    return !!this._root && this._root.style.display !== "none";
  };

  AnswerComponentComponent.prototype.destroy = function () {
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
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
    this._labelEl = null;
    this._counterEl = null;
    this._prevBtn = null;
    this._nextBtn = null;
    this._bodyEl = null;
    this._slideEl = null;
    this._slides = [];
    this._index = 0;
    console.log("[AnswerComponent] Destroyed");
  };

  // ============================================================
  // Internal — nav + render
  // ============================================================

  AnswerComponentComponent.prototype._onPrev = function () {
    if (this._index <= 0) return;
    this._index--;
    this._renderActiveSlide();
    this._updateNav();
  };

  AnswerComponentComponent.prototype._onNext = function () {
    if (this._index >= this._slides.length - 1) return;
    this._index++;
    this._renderActiveSlide();
    this._updateNav();
  };

  AnswerComponentComponent.prototype._renderActiveSlide = function () {
    if (!this._slideEl) return;
    // Clear previous slide content.
    while (this._slideEl.firstChild) {
      this._slideEl.removeChild(this._slideEl.firstChild);
    }
    var slide = this._slides[this._index];
    if (!slide || typeof slide.render !== "function") return;
    try {
      slide.render(this._slideEl);
    } catch (err) {
      console.error("[AnswerComponent] slide render() threw:", err);
    }
  };

  AnswerComponentComponent.prototype._updateNav = function () {
    var n = this._slides.length;
    var i = this._index;
    this._counterEl.textContent = (n === 0 ? 0 : i + 1) + "/" + n;

    var prevDisabled = i <= 0;
    var nextDisabled = i >= n - 1;
    this._prevBtn.disabled = prevDisabled;
    this._nextBtn.disabled = nextDisabled;
    this._prevBtn.setAttribute("aria-disabled", prevDisabled ? "true" : "false");
    this._nextBtn.setAttribute("aria-disabled", nextDisabled ? "true" : "false");
  };

  AnswerComponentComponent.prototype._validateSlides = function (slides) {
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s || typeof s.render !== "function") {
        throw new Error(
          "[AnswerComponent] slides[" + i + "] must be { render(container) }; " +
          "html / element keys are not supported (GEN-ANSWER-COMPONENT-SLIDE-SHAPE)."
        );
      }
    }
  };

  // ============================================================
  // Export
  // ============================================================

  window.AnswerComponentComponent = AnswerComponentComponent;
  window.AnswerComponent = AnswerComponentComponent;

  console.log("[MathAI] AnswerComponent v" + VERSION + " loaded");
})(window);
