/**
 * MathAI Helpers Package
 *
 * Consolidates all helper utilities into a single import
 *
 * Usage:
 * <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
 *
 * Available Helpers:
 * - VisibilityTracker: Track tab visibility and show popup on inactivity
 * - SubjectiveEvaluation: Evaluate student responses with AI-powered feedback
 * - InteractionManager: Control pointer-events on game areas during feedback/evaluation
 * - SignalCollector: Raw input event capture and problem-level signal computation
 */

(function (window) {
  "use strict";

  // Prevent multiple executions
  if (window.__MATHAI_HELPERS_LOADING__) {
    console.log(
      "[MathAIHelpers] Already loading, skipping duplicate execution"
    );
    return;
  }
  if (window.MathAIHelpers) {
    console.log("[MathAIHelpers] Already loaded, skipping duplicate execution");
    return;
  }
  window.__MATHAI_HELPERS_LOADING__ = true;

  // CDN URLs for all helpers
  var HELPER_URLS = {
    visibilityTracker:
      "https://storage.googleapis.com/test-dynamic-assets/packages/visibility-tracker/index.js",
    apiHelper:
      "https://storage.googleapis.com/test-dynamic-assets/packages/api-helper/index.js",
    subjectiveEvaluation:
      "https://storage.googleapis.com/test-dynamic-assets/packages/subjective-evaluation/index.js",
    interactionManager: "https://storage.googleapis.com/test-dynamic-assets/packages/interaction-manager/index.js",
    signalCollector: "https://storage.googleapis.com/test-dynamic-assets/packages/helpers/signal-collector/index.js",
  };

  // Load a script dynamically
  function loadScript(url, name) {
    // Skip if already loaded globally
    if (typeof window[name] !== "undefined") {
      console.log("[MathAIHelpers] Already loaded:", name);
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.async = false; // Load in order

      script.onload = function () {
        console.log("[MathAIHelpers] Loaded:", name);
        resolve();
      };

      script.onerror = function () {
        console.error("[MathAIHelpers] Failed to load:", name);
        reject(new Error("Failed to load " + name));
      };

      document.head.appendChild(script);
    });
  }

  // Load all helpers sequentially
  function loadAllHelpers() {
    return Promise.all([
      loadScript(HELPER_URLS.visibilityTracker, "VisibilityTracker"),
      loadScript(HELPER_URLS.apiHelper, "APIHelper"),
      loadScript(HELPER_URLS.subjectiveEvaluation, "SubjectiveEvaluation"),
      loadScript(HELPER_URLS.interactionManager, "InteractionManager"),
      loadScript(HELPER_URLS.signalCollector, "SignalCollector")
    ]);
  }

  // Auto-load all helpers when this script loads
  loadAllHelpers()
    .then(function () {
      console.log("[MathAIHelpers] All helpers loaded successfully");

      // Expose helpers globally (they're already available via their own globals)
      window.MathAIHelpers = {
        VisibilityTracker: window.VisibilityTracker,
        APIHelper: window.APIHelper,
        SubjectiveEvaluation: {
          evaluate: window.subjectiveEvaluation,
          createEvaluator: window.createEvaluator,
        },
        version: "1.0.0",
        InteractionManager: window.InteractionManager,
        SignalCollector: window.SignalCollector,
        version: "1.1.0"
      };

      // Clear loading flag
      delete window.__MATHAI_HELPERS_LOADING__;
    })
    .catch(function (error) {
      console.error("[MathAIHelpers] Failed to load helpers:", error);
      // Clear loading flag even on error
      delete window.__MATHAI_HELPERS_LOADING__;
    });
})(window);
