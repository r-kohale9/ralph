/* ============================================
   MathAI Tracker Helper - POC Version
   Replace with your actual tracking implementation
   ============================================ */

const tracker = (function() {
    'use strict';

    // Session data
    let sessionId = null;
    let sessionStartTime = null;
    let attempts = [];

    /**
     * Generate a unique session ID
     * @returns {string}
     */
    function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API
    return {
        /**
         * Start a new tracking session
         * Call this at the beginning of the game
         * @param {boolean} preserveAttempts - If true, keep existing attempts (for retries)
         */
        startSession(preserveAttempts = false) {
            sessionId = generateSessionId();
            sessionStartTime = Date.now();

            if (!preserveAttempts) {
                attempts = [];  // Only clear attempts if not preserving
            }

            console.log(`📊 Tracking session started: ${sessionId} ${preserveAttempts ? '(preserving attempts)' : '(fresh start)'}`);

            // TODO: In production, send session start event to backend
            // api.post('/sessions/start', { sessionId, startTime: sessionStartTime });
        },

        /**
         * Record a single attempt/interaction
         * @param {Object} attemptData - Data about the attempt
         * @param {number} attemptData.questionNumber - Question number
         * @param {string} attemptData.question - Question text
         * @param {string} attemptData.selectedAnswer - User's answer
         * @param {string} attemptData.correctAnswer - Correct answer
         * @param {boolean} attemptData.correct - Whether the answer was correct
         * @param {number} attemptData.timestamp - When the attempt was made
         */
        recordAttempt(attemptData) {
            if (!sessionId) {
                console.error('❌ Cannot record attempt: Session not started. Call tracker.startSession() first.');
                return;
            }

            const attempt = {
                sessionId,
                attemptNumber: attempts.length + 1,
                ...attemptData
            };

            attempts.push(attempt);
            console.log(`📝 Attempt recorded:`, attempt);

            // TODO: In production, send attempt to backend immediately or batch
            // api.post('/attempts/record', attempt);
        },

        /**
         * Get all attempts for the current session
         * @returns {Array}
         */
        getAttempts() {
            return [...attempts]; // Return copy to prevent external modification
        },

        /**
         * Get session summary statistics
         * @returns {Object}
         */
        getSummary() {
            const totalAttempts = attempts.length;
            const correctAttempts = attempts.filter(a => a.correct).length;
            const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
            const duration = sessionStartTime ? Date.now() - sessionStartTime : 0;

            return {
                sessionId,
                totalAttempts,
                correctAttempts,
                incorrectAttempts: totalAttempts - correctAttempts,
                accuracy,
                duration,
                startTime: sessionStartTime
            };
        },

        /**
         * Get the current session ID
         * @returns {string|null}
         */
        getSessionId() {
            return sessionId;
        },

        /**
         * Clear session data (useful for testing)
         */
        clearSession() {
            sessionId = null;
            sessionStartTime = null;
            attempts = [];
            console.log('🗑️ Session data cleared');
        }
    };
})();

console.log('✅ Tracker Helper loaded (POC version)');
