/* ============================================
   MathAI Game Template - Game Logic
   ============================================ */

// Game Configuration
const QUESTIONS = [
    {
        question: "What is 5 + 3?",
        options: ["6", "7", "8", "9"],
        correct: 2 // Index of correct answer
    },
    {
        question: "What is 12 - 4?",
        options: ["6", "7", "8", "9"],
        correct: 2
    },
    {
        question: "What is 3 × 4?",
        options: ["10", "11", "12", "13"],
        correct: 2
    },
    {
        question: "What is 15 ÷ 3?",
        options: ["3", "4", "5", "6"],
        correct: 2
    },
    {
        question: "What is 7 + 8?",
        options: ["13", "14", "15", "16"],
        correct: 2
    }
];

// Game State
const gameState = {
    currentQuestion: 0,
    score: 0,
    startTime: null,
    selectedAnswer: null
};

// Global attempt history - accumulates across session
let attemptHistory = [];

// Round State (for attempt history tracking)
const roundState = {
    attemptNumber: 1,  // Retry attempt number
    roundNumber: 1,    // Which round in game sequence
    levelNumber: 1,    // Which level this belongs to
    roundStartTime: null,
    roundStartTimerValue: null,  // Timer value at round start
    livesLost: 0,
    helpTaken: 0,
    jumpStates: ["normal"],
    contentVisible: {
        goal: "Solve the math problem",
        pairs: [],
        adjustmentOptions: []
    },
    contentInteractive: {
        inputPairs: [],
        interactiveElements: ["input_1", "submit_btn"]
    },
    otherInteractiveContent: {
        hintButton: { enabled: false, used: false, hintCount: 0 },
        calculatorButton: { enabled: false, used: false },
        referenceMaterials: { opened: false, timeSpent: 0 }
    },
    contentInteracted: [],  // Will track all interactions except submit
    question: null  // Will store the current question data
};

// Session context (populated via postMessage when embedded)
const gameSessionContext = {
    gameId: 'standalone_mathai_game',
    contentSetId: null,
    userId: null
};

// DOM Elements
const elements = {
    questionText: document.getElementById('question-text'),
    answerContainer: document.getElementById('answer-container'),
    feedback: document.getElementById('feedback'),
    feedbackText: document.getElementById('feedback-text'),
    nextBtn: document.getElementById('next-btn'),
    submitBtn: document.getElementById('submit-btn'),
    scoreDisplay: document.getElementById('score'),
    questionNumber: document.getElementById('question-number'),
    totalQuestions: document.getElementById('total-questions'),
    resultsContainer: document.getElementById('results-container'),
    gameContent: document.querySelector('.game-content'),
    finalScore: document.getElementById('final-score'),
    accuracy: document.getElementById('accuracy'),
    totalTime: document.getElementById('total-time'),
    restartBtn: document.getElementById('restart-btn'),
    muteBtn: document.getElementById('mute-btn')
};

// Global API instance (initialized after packages load)
let api = null;

// Note: window.registered_game_id is set by Phase 4 registration process

// Wait for MathAI packages to load, then initialize API
function waitForPackages() {
    return new Promise((resolve) => {
        const checkPackages = () => {
            if (window.MathAIHelpers && window.APIHelper) {
                console.log('✅ MathAI packages loaded, initializing API and InteractionManager...');

                // Initialize API Helper
                api = new window.APIHelper({
                    timeout: 10000
                });

                // Make API instance globally available
                window.api = api;

                // Set up error handling
                api.onError((error) => {
                    console.error('🚨 API Error:', error);
                    // Could show user-friendly error message here
                });

                // IMPORTANT: InteractionManager Default Behavior
                // By default, InteractionManager disables interaction during:
                // - Audio feedback longer than 1 second
                // - Evaluation/answering phases
                // To disable this behavior, initialize with:
                // window.interactionManager = new InteractionManager({
                //   disableOnAudioFeedback: false,  // Don't disable during audio
                //   disableOnEvaluation: true       // Still disable during evaluation
                // });

                // Initialize InteractionManager with default settings
                window.interactionManager = new InteractionManager({
                    selector: '.game-content', // Target game area for pointer-events control
                    disableOnAudioFeedback: true, // Disable interaction during long audio feedback
                    disableOnEvaluation: true     // Disable interaction during evaluation
                });

                // Add event listeners for visual feedback
                if (window.interactionManager) {
                    window.interactionManager.onStateChange((event) => {
                        if (event.type === 'interactionDisabled') {
                            // Show visual feedback (overlay, gray out elements, etc.)
                            showInteractionDisabledUI(event.reason);
                        } else {
                            // Hide visual feedback
                            hideInteractionDisabledUI(event.reason);
                        }
                    });
                }

                console.log('✅ API Helper and InteractionManager initialized');
                console.log('✅ API Helper available as window.api');
                console.log('✅ InteractionManager available as window.interactionManager');
                resolve();
            } else {
                // Check again in 100ms
                setTimeout(checkPackages, 100);
            }
        };

        checkPackages();
    });
}

// Initialize Game
function initGame() {
    console.log('🎮 Initializing MathAI Game...');

    // Start tracking session
    tracker.startSession();

    // Initialize round state
    roundState.roundStartTime = Date.now();
    roundState.roundStartTimerValue = timer ? timer.getCurrentTime() : 0;

    // Set up event listeners
    elements.nextBtn.addEventListener('click', nextQuestion);
    elements.submitBtn.addEventListener('click', () => {
        // Disable interaction during evaluation
        if (window.interactionManager) {
            window.interactionManager.disable('evaluation');
        }

        // Record the completed attempt in attempt history
        recordAttempt();

        // Submit the game with accumulated attempt history
        submitGame(attemptHistory);
    });
    elements.restartBtn.addEventListener('click', () => {
        // Re-enable interaction when user chooses restart
        if (window.interactionManager) {
            window.interactionManager.enable('user_action');
        }
        restartGame();
    });
    elements.muteBtn.addEventListener('click', toggleMute);

    // Initialize UI
    elements.totalQuestions.textContent = QUESTIONS.length;
    gameState.startTime = Date.now();

    // Load first question
    loadQuestion();

    console.log('✅ Game initialized successfully');
}

// Load Question
function loadQuestion() {
    const question = QUESTIONS[gameState.currentQuestion];

    // Update question text
    elements.questionText.textContent = question.question;
    elements.questionNumber.textContent = gameState.currentQuestion + 1;

    // Clear previous answers
    elements.answerContainer.innerHTML = '';
    gameState.selectedAnswer = null;

    // Hide feedback and buttons
    elements.feedback.classList.add('hidden');
    elements.nextBtn.classList.add('hidden');
    elements.submitBtn.classList.add('hidden');

    // Set up content tracking for this question
    setupContentTracking(question);

    // Create answer buttons
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.addEventListener('click', () => selectAnswer(index));
        elements.answerContainer.appendChild(button);
    });

    console.log(`📝 Loaded question ${gameState.currentQuestion + 1}/${QUESTIONS.length}`);
}

// Set up content tracking for the current question
function setupContentTracking(question) {
    roundState.question = {
        question_number: gameState.currentQuestion + 1,
        question: question.question,
        correct_answer: question.options[question.correct],
        user_answer: null,
        was_correct: false,
        time_spent: 0,
        question_type: "multiple_interactions_single_correctness"
    };

    roundState.contentVisible.pairs = [{
        id: 1,
        left: question.question,
        right: "?"
    }];

    roundState.contentInteractive.inputPairs = [{
        id: 1,
        type: "multiple_choice",
        placeholder: null
    }];
}

// Track user interaction (excluding submit button)
function trackInteraction(elementId, inputValues, elementType, pairId = 1) {
    const interaction = {
        interaction_order: roundState.contentInteracted.length + 1,
        element_id: elementId,
        pair_id: pairId,
        input_values: inputValues,
        timestamp: new Date().toISOString(),
        correctness: null,  // Will be determined by context
        element_type: elementType
    };

    roundState.contentInteracted.push(interaction);
    console.log('📊 Interaction tracked:', interaction);
}

// Handle Answer Selection
function selectAnswer(answerIndex) {
    const question = QUESTIONS[gameState.currentQuestion];
    const isCorrect = answerIndex === question.correct;
    const buttons = elements.answerContainer.querySelectorAll('.answer-btn');

    // Store selected answer
    gameState.selectedAnswer = answerIndex;

    // Track the interaction (multiple choice selection)
    trackInteraction(
        `option_${answerIndex}`,
        ["select"],
        "multiple_choice_option",
        1
    );

    // Update question data
    roundState.question.user_answer = question.options[answerIndex];
    roundState.question.was_correct = isCorrect;
    roundState.question.time_spent = Date.now() - roundState.roundStartTime;

    // Record attempt (keeping for backward compatibility with tracker)
    tracker.recordAttempt({
        questionNumber: gameState.currentQuestion + 1,
        question: question.question,
        selectedAnswer: question.options[answerIndex],
        correctAnswer: question.options[question.correct],
        correct: isCorrect,
        timestamp: Date.now()
    });

    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);

    // Highlight selected answer
    buttons[answerIndex].classList.add(isCorrect ? 'correct' : 'incorrect');

    // Show correct answer if user was wrong
    if (!isCorrect) {
        buttons[question.correct].classList.add('correct');
    }

    // Update score
    if (isCorrect) {
        gameState.score += 10;
        elements.scoreDisplay.textContent = gameState.score;
    }

    // Show feedback
    showFeedback(isCorrect);

    // Play audio feedback
    audio.play(isCorrect ? 'correct' : 'incorrect');

    // Show next/submit button
    if (gameState.currentQuestion < QUESTIONS.length - 1) {
        elements.nextBtn.classList.remove('hidden');
    } else {
        elements.submitBtn.classList.remove('hidden');
    }
}

// Show Feedback
function showFeedback(isCorrect) {
    elements.feedback.classList.remove('hidden', 'success', 'error');

    if (isCorrect) {
        elements.feedbackText.textContent = '🎉 Correct! Great job!';
        elements.feedback.classList.add('success');
    } else {
        elements.feedbackText.textContent = '❌ Not quite. Try the next one!';
        elements.feedback.classList.add('error');
    }
}

// Next Question
function nextQuestion() {
    // Re-enable interaction when user chooses next
    if (window.interactionManager) {
        window.interactionManager.enable('user_action');
    }

    gameState.currentQuestion++;
    loadQuestion();
}

// Calculate attempt duration using timer
function calculateRoundDuration() {
    if (!timer) return 0;
    const currentTimerValue = timer.getCurrentTime();
    const attemptDuration = currentTimerValue - (roundState.roundStartTimerValue || 0);
    return Math.max(0, attemptDuration); // Ensure non-negative
}

// Record completed attempt in attempt history
function recordAttempt() {
    const endTime = Date.now();
    const duration = calculateRoundDuration();
    const overallCorrectness = roundState.question.was_correct ? 1.0 : 0.0;

    // Add this attempt to the accumulated attempt history
    attemptHistory.push({
        // Root level - attempt constants
        attempt_number: roundState.attemptNumber,
        start_timestamp: new Date(roundState.roundStartTime).toISOString(),
        end_timestamp: new Date(endTime).toISOString(),
        duration: duration,
        overall_correctness: overallCorrectness,
        lives_lost: roundState.livesLost,
        help_taken: roundState.helpTaken,

        // Metadata - all content and context data
        metadata: {
            round_number: roundState.roundNumber,
            level_number: roundState.levelNumber,
            jump_states: roundState.jumpStates,

            // Content visible to user
            content_visible: roundState.contentVisible,

            // Content user can interact with
            content_interactive: roundState.contentInteractive,

            // Other interactive content (helpers, not evaluated)
            other_interactive_content: roundState.otherInteractiveContent,

            // Content user interacted with (EXCLUDES submit button)
            content_interacted: roundState.contentInteracted,

            // Single question object (not array)
            question: roundState.question
        }
    });
}

// Submit Game - Only calculates metrics, receives attemptHistory as parameter
async function submitGame(attemptHistory) {
    const summary = tracker.getSummary();
    const rawAttempts = tracker.getAttempts();
    const sessionId = tracker.getSessionId();

    // Calculate overall correctness for metrics
    const overallCorrectness = roundState.question.was_correct ? 1.0 : 0.0;

    // Calculate stars based on overall correctness
    const stars = overallCorrectness >= 0.9 ? 3 : overallCorrectness >= 0.7 ? 2 : overallCorrectness > 0 ? 1 : 0;

    const metrics = {
        accuracy: Number(overallCorrectness.toFixed(4)),
        time: (window.gameVariableState && window.gameVariableState.timerElapsedTimes) ? window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0) : 0, // Overall game time
        stars,
        retries: roundState.attemptNumber - 1, // Retry count (0 = no retries, 1 = 1 retry, etc.)
        timeBreakdown: (window.gameVariableState && window.gameVariableState.timerElapsedTimes) ? window.gameVariableState.timerElapsedTimes : [] // Array of individual session times
    };

    console.log('Final Metrics:', metrics);
    console.log('Attempt History:', attemptHistory);

    // Get registered game ID from global window property
    // This is set by platform via game_init message or Phase 4 registration
    const registeredGameId = window.registered_game_id;

    if (!registeredGameId) {
        throw new Error('No registered game ID available. Game must be loaded from platform with game_init message or registered in Phase 4.');
    }

    const submissionPayload = {
        session_id: sessionId,
        game_id: registeredGameId,
        content_set_id: gameSessionContext.contentSetId,
        user_id: gameSessionContext.userId,
        metrics,
        attempts: attemptHistory,
        completed_at: Number(endTime) // Ensure it's a number
    };

    // Validate completed_at is a number
    if (!Number.isFinite(submissionPayload.completed_at)) {
        throw new Error(`completed_at must be a finite number, got: ${typeof submissionPayload.completed_at} ${submissionPayload.completed_at}`);
    }

    console.log('submissionPayload.completed_at type:', typeof submissionPayload.completed_at, 'value:', submissionPayload.completed_at);

    // Prepare UI results
    const results = {
        score: gameState.score,
        totalQuestions: QUESTIONS.length,
        correctAnswers: roundState.question.was_correct ? 1 : 0,
        accuracy: overallCorrectness,
        duration: Math.round(duration),
        attempts: attemptHistory,
        completedAt: endTime
    };

    console.log('📊 Game Results:', results);

    // Submit game session to API
    try {
        await api.submitResults(submissionPayload);
        console.log('✅ Game session submitted successfully');
    } catch (error) {
        console.error('❌ Failed to submit game session:', error);
        throw error; // Re-throw to prevent showing results if submission fails
    }

    // Show results screen
    showResults(results);
}


// End Game - Cleanup
function endGame() {
    if (timer) {
        // Capture elapsed times before destroying (timer will populate window.gameVariableState.timerElapsedTimes)
        window.gameVariableState = window.gameVariableState || {};
        window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
        timer.destroy();
        timer = null;
    }

    if (tracker) {
        tracker.destroy();
        tracker = null;
    }

    console.log('✅ Game ended and cleaned up');
}

// Show Results
function showResults(results) {
    // Hide game content
    elements.gameContent.classList.add('hidden');

    // Show results
    elements.resultsContainer.classList.remove('hidden');
    elements.finalScore.textContent = results.score;
    elements.accuracy.textContent = Math.round(results.accuracy * 100);
    elements.totalTime.textContent = results.duration;

    // Play completion sound
    audio.play('complete');
}

// Restart Game
function restartGame() {
    // Reset game state
    gameState.currentQuestion = 0;
    gameState.score = 0;
    gameState.selectedAnswer = null;
    gameState.startTime = Date.now();

    // Reset round state for retry
    roundState.attemptNumber++;  // Increment retry attempt number
    roundState.roundStartTime = Date.now();
    roundState.livesLost = 0;
    roundState.helpTaken = 0;
    roundState.jumpStates = ["retry"];  // Mark this as a retry
    roundState.contentInteracted = [];  // Clear previous interactions
    roundState.question = null;  // Will be set by loadQuestion

    // Hard reset timer for new attempt (clears all elapsed time history)
    if (timer) {
        // Capture elapsed times before hardReset (timer will populate window.gameVariableState.timerElapsedTimes)
        window.gameVariableState = window.gameVariableState || {};
        window.gameVariableState.timerElapsedTimes = timer.getElapsedTimes();
        timer.hardReset();
    }
    roundState.roundStartTimerValue = 0;  // Timer starts fresh at 0

    // Reset UI
    elements.scoreDisplay.textContent = '0';
    elements.gameContent.classList.remove('hidden');
    elements.resultsContainer.classList.add('hidden');

    // Reset tracker for retry (preserve attempt history)
    tracker.startSession(true);

    // Load first question
    loadQuestion();

    console.log('🔄 Game restarted (attempt #' + roundState.attemptNumber + ')');
}

// Toggle Mute
function toggleMute() {
    if (audio.isMuted()) {
        audio.unmute();
        elements.muteBtn.textContent = '🔊';
    } else {
        audio.mute();
        elements.muteBtn.textContent = '🔇';
    }
}

// Visual feedback functions for interaction state changes
function showInteractionDisabledUI(reason) {
    console.log('🎨 Showing interaction disabled UI - Reason:', reason);

    // Add a visual overlay to indicate interaction is disabled
    const overlay = document.createElement('div');
    overlay.id = 'interaction-disabled-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(1px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    `;

    // Add a message based on the reason
    let message = 'Please wait...';
    if (reason === 'evaluation') {
        message = 'Evaluating answer...';
    } else if (reason === 'audio_feedback') {
        message = 'Playing audio...';
    }

    overlay.innerHTML = `
        <div style="
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            text-align: center;
        ">
            ${message}
        </div>
    `;

    // Position relative to game content
    const gameContent = elements.gameContent;
    if (gameContent) {
        gameContent.style.position = 'relative';
        gameContent.appendChild(overlay);
    }
}

function hideInteractionDisabledUI(reason) {
    console.log('🎨 Hiding interaction disabled UI - Reason:', reason);

    const overlay = document.getElementById('interaction-disabled-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', initGame);

// Receive configuration from hosting platform
window.addEventListener('message', (event) => {
    if (!event?.data) {
        return;
    }

    if (event.data.type === 'game_init') {
        const payload = event.data.data || event.data.config || {};

        if (payload.gameId) {
            gameSessionContext.gameId = payload.gameId;
        }

        if (payload.contentSetId) {
            gameSessionContext.contentSetId = payload.contentSetId;
        }

        if (payload.userId || (payload.user && payload.user.id)) {
            gameSessionContext.userId = payload.userId || payload.user.id;
        }

        if (payload.apiConfig) {
            api.configure(payload.apiConfig);
        }
    }
});

// Initialize game when window loads (for standalone testing)
window.addEventListener('load', async () => {
    console.log('🚀 Window loaded, waiting for MathAI packages...');

    try {
        // Wait for packages to load
        await waitForPackages();

        // Now initialize the game
        initGame();

        console.log('✅ Game fully initialized and ready!');
    } catch (error) {
        console.error('❌ Failed to initialize game:', error);
    }
});
