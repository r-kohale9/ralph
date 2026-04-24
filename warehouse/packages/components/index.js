/**
 * MathAI Components Package
 *
 * Consolidates all UI components into a single import
 *
 * Usage:
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
 *
 * Available Components:
 * - ScreenLayoutComponent: Inject game wrapper structure with slots
 * - ProgressBarComponent: Round/level progress with lives (hearts)
 * - TransitionScreenComponent: Inline start/end/victory screens
 * - SubtitleComponent: Display subtitles with automatic positioning
 * - StickerComponent: Show animated stickers (Lottie or Images/GIFs)
 * - TimerComponent: Visual timer with progress indicators
 * - PopupComponent: Modal popups with customizable content
 * - StoriesComponent: Sequential story navigation with duration tracking
 * - VoiceInput: Voice/keyboard input with mic recording, transcription, and visual feedback
 * - FloatingButtonComponent: Fixed-bottom Submit/Retry/Next action button (PART-050)
 */

(function (window) {
  "use strict";

  // CSS URL
  var CSS_URL = "https://storage.googleapis.com/test-dynamic-assets/packages/components/styles/mathai-game-styles.css";

  // CDN URLs for all components
  var COMPONENT_URLS = {
    babel: "https://unpkg.com/@babel/standalone@7.24.0/babel.min.js",
    lottiePlayer: "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js",
    screenLayout: "https://storage.googleapis.com/test-dynamic-assets/packages/components/screen-layout/index.js",
    progressBar: "https://storage.googleapis.com/test-dynamic-assets/packages/components/progress-bar/index.js",
    transitionScreen: "https://storage.googleapis.com/test-dynamic-assets/packages/components/transition-screen/index.js",
    popupLayout: "https://storage.googleapis.com/test-dynamic-assets/packages/popup-layout/index.js",
    subtitle: "https://storage.googleapis.com/test-dynamic-assets/packages/subtitle/index.js",
    sticker: "https://storage.googleapis.com/test-dynamic-assets/packages/sticker/index.js",
    timer: "https://storage.googleapis.com/test-dynamic-assets/packages/timer/index.js",
    stories: "https://storage.googleapis.com/test-dynamic-assets/packages/components/stories/index.js",
    actionBar: "https://storage.googleapis.com/test-dynamic-assets/packages/components/action-bar/index.js",
    previewScreen: "https://storage.googleapis.com/test-dynamic-assets/packages/components/preview-screen/index.js",
    voiceInput: "https://storage.googleapis.com/test-dynamic-assets/packages/components/voice-input/index.js",
    floatingButton: "https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js"
  };

  // Load CSS file
  function loadCSS() {
    return new Promise(function (resolve) {
      if (document.querySelector('link[href*="mathai-game-styles.css"]')) {
        console.log("[MathAIComponents] CSS already loaded");
        resolve();
        return;
      }
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      link.onload = function () {
        console.log("[MathAIComponents] Loaded: CSS Variables");
        resolve();
      };
      link.onerror = function () {
        console.error("[MathAIComponents] Failed to load CSS");
        resolve(); // Continue anyway
      };
      document.head.appendChild(link);
    });
  }

  // Load a script dynamically
  function loadScript(url, name) {
    if (typeof window[name] != "undefined") return;
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.async = false; // Load in order

      script.onload = function () {
        console.log("[MathAIComponents] Loaded:", name);
        resolve();
      };

      script.onerror = function () {
        console.error("[MathAIComponents] Failed to load:", name);
        reject(new Error("Failed to load " + name));
      };

      document.head.appendChild(script);
    });
  }

  // Load all components in sequence
  async function loadAllComponents() {
    // 1. Load CSS first
    return (
      loadCSS()
        // 2. Load HTML components (ScreenLayout, ProgressBar, TransitionScreen)
        .then(() => loadScript(COMPONENT_URLS.screenLayout, "ScreenLayout"))
        .then(() => loadScript(COMPONENT_URLS.progressBar, "ProgressBar"))
        .then(() => loadScript(COMPONENT_URLS.transitionScreen, "TransitionScreen"))
        // ActionBar must load BEFORE PreviewScreen — PreviewScreen constructs ActionBar internally.
        .then(() => loadScript(COMPONENT_URLS.actionBar, "ActionBar"))
        .then(() => loadScript(COMPONENT_URLS.previewScreen, "PreviewScreen"))
        // FloatingButton loads SERIALLY here (not in the parallel block below)
        // so `typeof FloatingButtonComponent !== 'undefined'` is reliable for
        // games that check at DOMContentLoaded time. Moving this to the
        // parallel block was the bodmas-blitz regression (2026-04-23):
        // `new FloatingButtonComponent(...)` was silently skipped because the
        // class hadn't loaded yet by the time game init ran.
        .then(() => loadScript(COMPONENT_URLS.floatingButton, "FloatingButton"))
        // 3. Load dependencies
        .then(() => loadScript(COMPONENT_URLS.lottiePlayer, "LottiePlayer"))
        .then(() => loadScript(COMPONENT_URLS.popupLayout, "PopupComponent"))
        // 4. Load remaining components in parallel
        .then(() =>
          Promise.all([
            loadScript(COMPONENT_URLS.babel, "Babel"),
            loadScript(COMPONENT_URLS.subtitle, "SubtitleComponent"),
            loadScript(COMPONENT_URLS.sticker, "StickerComponent"),
            loadScript(COMPONENT_URLS.timer, "TimerComponent"),
            loadScript(COMPONENT_URLS.stories, "StoriesComponent"),
            loadScript(COMPONENT_URLS.voiceInput, "VoiceInput")
          ])
        )
    );
  }

  // Auto-load all components when this script loads
  loadAllComponents()
    .then(function () {
      console.log("[MathAIComponents] All components loaded successfully");

      // Expose components globally (they're already available via their own globals)
      window.MathAIComponents = {
        ScreenLayoutComponent: window.ScreenLayoutComponent,
        ScreenLayout: window.ScreenLayout, // Alias
        ProgressBarComponent: window.ProgressBarComponent,
        TransitionScreenComponent: window.TransitionScreenComponent,
        Babel: window.Babel,
        PopupComponent: window.PopupComponent,
        SubtitleComponent: window.SubtitleComponent,
        StickerComponent: window.StickerComponent,
        TimerComponent: window.TimerComponent,
        StoriesComponent: window.StoriesComponent,
        ActionBarComponent: window.ActionBarComponent,
        ActionBar: window.ActionBar,
        PreviewScreenComponent: window.PreviewScreenComponent,
        PreviewScreen: window.PreviewScreen,
        VoiceInput: window.VoiceInput,
        FloatingButtonComponent: window.FloatingButtonComponent,
        FloatingButton: window.FloatingButton,
        version: "1.5.1"
      };
    })
    .catch(function (error) {
      console.error("[MathAIComponents] Failed to load components:", error);
    });
})(window);

