/**
 * API Helper Component
 * Handles communication with the MathAI Core API
 */
(function (window) {
  "use strict";

  // Skip if already loaded
  if (typeof window.APIHelper !== "undefined") {
    console.log("[APIHelper] Already loaded, skipping duplicate execution");
    return;
  }

  class APIHelper {
    constructor(config = {}) {
      // Default configuration
      this.config = {
        baseUrl: 'https://c.c.mathai.ai',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        ...config
      };

      // Error callback
      this.errorCallback = null;

      console.log('[APIHelper] Initialized with config:', this.config);
    }

    /**
     * Build a fully qualified URL from base + endpoint
     * @param {string} endpoint
     * @returns {string}
     */
    buildUrl(endpoint) {
      const base = this.config.baseUrl.replace(/\/+$/, '');
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return `${base}${path}`;
    }

    /**
     * Make an API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - fetch options (method, body, headers)
     * @returns {Promise}
     */
    async makeRequest(endpoint, { method = 'POST', body, headers = {} } = {}) {
      const url = this.buildUrl(endpoint);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            ...this.config.headers,
            ...headers
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }

        return null;
      } catch (error) {
        console.error('[APIHelper] Request failed:', error);
        if (this.errorCallback) {
          this.errorCallback(error);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    /**
     * Submit a completed game session to the backend
     * @param {Object} payload - Game session payload
     * @param {string} payload.session_id - Unique session identifier
     * @param {string} payload.game_id - Game identifier
     * @param {Object} payload.metrics - Final metrics object
     * @param {Array} payload.attempts - Attempt history array
     * @param {number} payload.completed_at - Completion timestamp (ms)
     * @returns {Promise}
     */
    async submitResults(payload) {
      const endpoint = '/api/analytics/game-sessions';

      console.log('[APIHelper] 📤 Submitting game session payload:', payload);
      console.log('[APIHelper] 📍 Using endpoint:', endpoint);

      payload.user_id = '123';

      try {
        const response = await this.makeRequest(endpoint, {
          method: 'POST',
          body: payload
        });

        console.log('[APIHelper] ✅ Game session stored successfully:', response);
        return response;
      } catch (error) {
        console.error('[APIHelper] ❌ Failed to submit game session:', error);
        throw error;
      }
    }


    /**
     * Get student data from the backend
     * @param {string} [userId] - Optional user ID to fetch specific student data
     * @returns {Promise}
     */
    async getStudentData(userId = null) {
      const endpoint = userId
        ? `/api/students/${userId}`
        : '/api/students/me';

      console.log('[APIHelper] 📥 Fetching student data from:', endpoint);

      try {
        const response = await this.makeRequest(endpoint, {
          method: 'GET'
        });

        console.log('[APIHelper] ✅ Student data retrieved successfully:', response);
        return response;
      } catch (error) {
        console.error('[APIHelper] ❌ Failed to fetch student data:', error);
        throw error;
      }
    }

    /**
     * Register an error callback
     * @param {Function} callback - Error handler function
     */
    onError(callback) {
      this.errorCallback = callback;
      console.log('[APIHelper] Error callback registered');
    }

    /**
     * Update API configuration
     * @param {Object} newConfig - New configuration options
     */
    configure(newConfig) {
      if (newConfig.headers) {
        this.config.headers = {
          ...this.config.headers,
          ...newConfig.headers
        };
      }

      Object.assign(this.config, { ...newConfig, headers: this.config.headers });
      console.log('[APIHelper] ⚙️ Configuration updated:', this.config);
    }

    /**
     * Get current API configuration
     * @returns {Object}
     */
    getConfig() {
      return {
        ...this.config,
        headers: { ...this.config.headers }
      };
    }
  }

  // Export for use in modules or make globally available
  if (typeof module !== "undefined" && module.exports) {
    module.exports = APIHelper;
  } else {
    window.APIHelper = APIHelper;
  }

  console.log('[APIHelper] Loaded successfully');
})(window);
