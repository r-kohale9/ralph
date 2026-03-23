/**
 * Subjective Evaluation API Wrapper
 * Provides an easy-to-use interface for evaluating components with loading states and callbacks
 */

// Skip if already loaded
if (typeof window.subjectiveEvaluation === "undefined") {

// Hardcoded API URL
const API_URL =
  "https://asia-south1-mathai-449208.cloudfunctions.net/subjective-evaluation"; // Replace with your actual API URL

/**
 * Evaluate components using the subjective evaluation API
 * @param {Object} options - Configuration options
 * @param {Array} options.components - Array of component objects to evaluate
 *   Each component should have:
 *   - component_id: string (required)
 *   - evaluation_prompt: string (required)
 *   - feedback_prompt: string (optional) - If provided, generates feedback based on evaluation
 *     You can use {{evaluation}} variable in feedback_prompt to reference the evaluation result
 *     Example: "Based on {{evaluation}}, provide constructive feedback"
 * @param {Function} options.onStart - Callback when request starts
 * @param {Function} options.onProgress - Callback for progress updates (called with each component result)
 * @param {Function} options.onComplete - Callback when request completes successfully (called with full response)
 * @param {Function} options.onError - Callback when an error occurs (called with error object)
 * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
 * @returns {Promise} Promise that resolves with the evaluation results
 */
async function subjectiveEvaluation(options) {
  const {
    components,
    onStart,
    onProgress,
    onComplete,
    onError,
    timeout = 30000,
  } = options;

  // Validation
  if (!components || !Array.isArray(components)) {
    const error = new Error("Components array is required");
    if (onError) onError(error);
    throw error;
  }

  if (components.length === 0) {
    const error = new Error("Components array cannot be empty");
    if (onError) onError(error);
    throw error;
  }

  // Validate component structure
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    if (!component.component_id) {
      const error = new Error(
        `Component at index ${i} is missing 'component_id'`
      );
      if (onError) onError(error);
      throw error;
    }
    if (!component.evaluation_prompt) {
      const error = new Error(
        `Component '${component.component_id}' is missing 'evaluation_prompt'`
      );
      if (onError) onError(error);
      throw error;
    }
    // feedback_prompt is optional - no validation needed
  }

  // Call onStart callback
  if (onStart) {
    onStart();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Transform components to match API format
    const apiComponents = components.map((comp) => {
      const apiComponent = {
        id: comp.component_id,
        evaluationPrompt: comp.evaluation_prompt,
      };

      // Only include feedbackPrompt if provided
      if (comp.feedback_prompt) {
        apiComponent.feedbackPrompt = comp.feedback_prompt;
      }

      return apiComponent;
    });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ components: apiComponents }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();

    // Call onProgress for each component result if provided
    if (onProgress && result.data) {
      result.data.forEach((componentResult) => {
        onProgress(componentResult);
      });
    }

    // Call onComplete callback
    if (onComplete) {
      onComplete(result);
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Request timeout");
      if (onError) onError(timeoutError);
      throw timeoutError;
    }

    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Hook-like function for managing loading state
 * Returns an object with evaluate function and reactive state
 * @returns {Object} Object with evaluate function and state management
 */
function createEvaluator() {
  const state = {
    loading: false,
    error: null,
    data: null,
  };

  const listeners = {
    onLoadingChange: [],
    onErrorChange: [],
    onDataChange: [],
  };

  const notify = (type, value) => {
    listeners[type].forEach((callback) => callback(value));
  };

  const evaluate = async (components, callbacks = {}) => {
    state.loading = true;
    state.error = null;
    state.data = null;
    notify("onLoadingChange", true);
    notify("onErrorChange", null);
    notify("onDataChange", null);

    try {
      const result = await subjectiveEvaluation({
        components,
        onStart: callbacks.onStart,
        onProgress: callbacks.onProgress,
        onComplete: (response) => {
          state.loading = false;
          state.data = response;
          notify("onLoadingChange", false);
          notify("onDataChange", response);
          if (callbacks.onComplete) callbacks.onComplete(response);
        },
        onError: (error) => {
          state.loading = false;
          state.error = error;
          notify("onLoadingChange", false);
          notify("onErrorChange", error);
          if (callbacks.onError) callbacks.onError(error);
          throw error;
        },
      });

      return result;
    } catch (error) {
      state.loading = false;
      state.error = error;
      notify("onLoadingChange", false);
      notify("onErrorChange", error);
      throw error;
    }
  };

  return {
    evaluate,
    get loading() {
      return state.loading;
    },
    get error() {
      return state.error;
    },
    get data() {
      return state.data;
    },
    onLoadingChange: (callback) => {
      listeners.onLoadingChange.push(callback);
      return () => {
        const index = listeners.onLoadingChange.indexOf(callback);
        if (index > -1) listeners.onLoadingChange.splice(index, 1);
      };
    },
    onErrorChange: (callback) => {
      listeners.onErrorChange.push(callback);
      return () => {
        const index = listeners.onErrorChange.indexOf(callback);
        if (index > -1) listeners.onErrorChange.splice(index, 1);
      };
    },
    onDataChange: (callback) => {
      listeners.onDataChange.push(callback);
      return () => {
        const index = listeners.onDataChange.indexOf(callback);
        if (index > -1) listeners.onDataChange.splice(index, 1);
      };
    },
  };
}

// Export for different module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    subjectiveEvaluation,
    createEvaluator,
    API_URL,
  };
}

// Export for browser
if (typeof window !== "undefined") {
  window.subjectiveEvaluation = subjectiveEvaluation;
  window.createEvaluator = createEvaluator;
}

} else {
  console.log("[SubjectiveEvaluation] Already loaded, skipping duplicate execution");
}
