/* ============================================
   MathAI API Helper
   Handles communication with the MathAI Core API
   ============================================ */

const api = (function() {
    'use strict';

    // Default configuration - override via api.configure(...)
    const config = {
    };

    // Error callback
    let errorCallback = null;

    /**
     * Build a fully qualified URL from base + endpoint
     * @param {string} endpoint
     * @returns {string}
     */
    function buildUrl(endpoint) {
        const base = config.baseUrl.replace(/\/+$/, '');
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    /**
     * Make an API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - fetch options (method, body, headers)
     * @returns {Promise}
     */
    async function makeRequest(endpoint, { method = 'POST', body, headers = {} } = {}) {
        const url = buildUrl(endpoint);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    ...config.headers,
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
            console.error('API request failed:', error);
            if (errorCallback) {
                errorCallback(error);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Public API
    return {
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
            console.log('📤 Submitting game session payload:', payload);

            try {
                const response = await makeRequest(config.endpoint, {
                    method: 'POST',
                    body: payload
                });

                console.log('✅ Game session stored successfully:', response);
                return response;
            } catch (error) {
                console.error('❌ Failed to submit game session:', error);
                throw error;
            }
        },

        /**
         * Get student data from the backend
         * @returns {Promise}
         */
        async getStudentData() {
            console.log('📥 Fetching student data...');

            // TODO: Implement when backend endpoint is available
            console.warn('getStudentData is not implemented yet.');
            return null;
        },

        /**
         * Register an error callback
         * @param {Function} callback - Error handler function
         */
        onError(callback) {
            errorCallback = callback;
        },

        /**
         * Update API configuration
         * @param {Object} newConfig - New configuration options
         */
        configure(newConfig) {
            if (newConfig.headers) {
                config.headers = {
                    ...config.headers,
                    ...newConfig.headers
                };
            }

            Object.assign(config, { ...newConfig, headers: config.headers });
            console.log('⚙️ API configuration updated:', config);
        },

        /**
         * Get current API configuration
         * @returns {Object}
         */
        getConfig() {
            return {
                ...config,
                headers: { ...config.headers }
            };
        }
    };
})();

console.log('✅ API Helper loaded');
