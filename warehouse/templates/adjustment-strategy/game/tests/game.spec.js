import { test, expect } from '@playwright/test';

// Base URL for the game
const BASE_URL = 'http://localhost:8787/';

// Dismiss FeedbackManager popup if present (appears in standalone mode)
async function dismissPopupIfPresent(page) {
    const backdrop = page.locator('#popup-backdrop');
    if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
        await backdrop.locator('button').first().click();
        await page.waitForTimeout(300);
    }
}

// Helper function to start the game from the initial screen
async function startGame(page) {
    await dismissPopupIfPresent(page);
    // Click the start screen "Let's go!" button
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(500); // allow transition animation
    // Click the Level 1 transition "Let's go!" button
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(500);
    // Verify game has started (round 1 is loaded)
    await expect(page.locator('#original-a')).toBeVisible({ timeout: 5000 });
}

// Click "Next Level" button in transition slot
async function clickNextLevel(page) {
    await expect(page.locator('#mathai-transition-slot button')).toBeVisible({ timeout: 10000 });
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(500);
}

// Wait for game to finish processing (FeedbackManager TTS + round transition)
// checkAnswer() is async — it awaits FeedbackManager.playDynamicFeedback before setting isProcessing=false
async function waitForReady(page) {
    await expect.poll(async () => await page.evaluate(() => !window.gameState.isProcessing), { timeout: 15000 }).toBe(true);
}

// Submit an answer and wait for processing to complete
async function submitAnswer(page, answer) {
    await page.locator('#answer-input').fill(answer.toString());
    await page.locator('#btn-check').click();
    await waitForReady(page);
}

// Test suite for "Adjustment Strategy"
test.describe('Adjustment Strategy Game', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for CDN packages to load and start screen to render
        await page.waitForFunction(
            (slotId) => {
                const slot = document.getElementById(slotId);
                return slot !== null && slot.querySelector('button') !== null;
            },
            'mathai-transition-slot',
            { timeout: 20000 }
        );
    });

    // Structural Tests
    test.describe('Structural Tests', () => {
        test('Game state initializes correctly', async ({ page }) => {
            const initialState = await page.evaluate(() => window.gameState);

            expect(initialState.currentRound).toBe(0);
            expect(initialState.totalRounds).toBe(9);
            expect(initialState.score).toBe(0);
            expect(initialState.lives).toBe(3);
            expect(initialState.totalLives).toBe(3);
            expect(initialState.level).toBe(1);
            expect(initialState.isActive).toBe(false);
            expect(initialState.isProcessing).toBe(false);
            expect(initialState.wrongAttempts).toBe(0);
            expect(initialState.numberA).toBe(0);
            expect(initialState.numberB).toBe(0);
            expect(initialState.deltaA).toBe(0);
            expect(initialState.deltaB).toBe(0);
            expect(initialState.content).not.toBeNull();
            expect(initialState.content.rounds.length).toBe(9);
        });

        test('Responsive layout fits within 480px width', async ({ page }) => {
            await page.setViewportSize({ width: 480, height: 800 });
            await startGame(page);

            const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
            expect(bodyScrollWidth).toBeLessThanOrEqual(480);
        });

        test('postMessage on game over has correct structure', async ({ page }) => {
            let receivedMessage = null;
            await page.exposeFunction('capturePostMessage', (msg) => {
                if (msg.type === 'game_complete') {
                    receivedMessage = msg;
                }
            });

            await page.evaluate(() => {
                const originalPostMessage = window.parent.postMessage;
                window.parent.postMessage = (...args) => {
                    window.capturePostMessage(args[0]);
                    originalPostMessage.apply(window.parent, args);
                };
            });

            await startGame(page);

            // Lose the game by answering incorrectly 3 times
            for (let i = 0; i < 3; i++) {
                await submitAnswer(page, '99');
                if (i < 2) {
                    await expect.poll(async () => await page.evaluate(() => window.gameState.lives)).toBe(3 - (i + 1), { timeout: 3000 });
                }
            }

            await expect(page.locator('#results-screen')).toBeVisible({ timeout: 5000 });
            // receivedMessage lives in Node scope — use expect.poll (not waitForFunction which runs in browser)
            await expect.poll(() => receivedMessage, { timeout: 5000 }).not.toBeNull();

            expect(receivedMessage.type).toBe('game_complete');
            const metrics = receivedMessage.data.metrics;

            expect(metrics).toHaveProperty('roundsCompleted');
            expect(typeof metrics.roundsCompleted).toBe('number');

            expect(metrics).toHaveProperty('stars');
            expect(typeof metrics.stars).toBe('number');
            expect(metrics.stars).toBe(0);

            const totalRounds = await page.evaluate(() => window.gameState.totalRounds);
            expect(totalRounds).toBeGreaterThanOrEqual(1);
        });
    });

    // Test Scenarios from Specification
    test.describe('Functional Scenarios from Spec', () => {
        const fallbackContent = {
            rounds: [
              { numberA: 47, numberB: 33, correctAnswer: 80 },
              { numberA: 28, numberB: 14, correctAnswer: 42 },
              { numberA: 56, numberB: 25, correctAnswer: 81 },
              { numberA: 36, numberB: 84, correctAnswer: 120 },
              { numberA: 67, numberB: 45, correctAnswer: 112 },
              { numberA: 49, numberB: 73, correctAnswer: 122 },
              { numberA: 78, numberB: 56, correctAnswer: 134 },
              { numberA: 83, numberB: 69, correctAnswer: 152 },
              { numberA: 95, numberB: 47, correctAnswer: 142 }
            ]
        };

        test('Scenario: Complete game with all correct answers', async ({ page }) => {
            await startGame(page);

            for (let i = 0; i < 9; i++) {
                await submitAnswer(page, fallbackContent.rounds[i].correctAnswer);

                if (i === 2 || i === 5) {
                    // Level transition appears after every 3 rounds
                    await clickNextLevel(page);
                } else if (i < 8) {
                    await expect(page.locator('#original-a')).toHaveText(
                        fallbackContent.rounds[i + 1].numberA.toString(),
                        { timeout: 3000 }
                    );
                }
            }

            await expect(page.locator('#results-screen')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#results-title')).toHaveText('Great Job!');

            const score = await page.locator('#result-rounds').textContent();
            expect(score).toBe('9/9');
        });

        test('Scenario: Use adjustment aid then answer correctly', async ({ page }) => {
            await startGame(page);

            // Adjust number A: 47 -> 50 (+3)
            for (let i = 0; i < 3; i++) await page.locator('#btn-a-plus').click();

            // Adjust number B: 33 -> 30 (-3)
            for (let i = 0; i < 3; i++) await page.locator('#btn-b-minus').click();

            // Assert UI changes
            await expect(page.locator('#delta-badge-a')).toHaveText('+3');
            await expect(page.locator('#delta-badge-a')).toHaveClass(/positive/);
            await expect(page.locator('#adj-a-bottom')).toContainText('50');

            await expect(page.locator('#delta-badge-b')).toHaveText('-3');
            await expect(page.locator('#delta-badge-b')).toHaveClass(/negative/);
            await expect(page.locator('#adj-b-top')).toContainText('30');

            // Answer correctly and wait for processing
            await submitAnswer(page, '80');

            // Assert game advances to round 2
            await expect(page.locator('#original-a')).toHaveText('28', { timeout: 5000 });
        });

        test('Scenario: Wrong answer loses a life and allows retry', async ({ page }) => {
            await startGame(page);

            await submitAnswer(page, '75');

            await expect.poll(async () => await page.evaluate(() => window.gameState.lives)).toBe(2, { timeout: 3000 });
            await expect(page.locator('#answer-input')).toBeEmpty();
            await expect(page.locator('#btn-check')).toBeHidden();

            expect(await page.evaluate(() => window.gameState.currentRound)).toBe(0);
            await expect(page.locator('#original-a')).toHaveText('47');
        });

        test('Scenario: Adjust numbers independently', async ({ page }) => {
            await startGame(page);

            await page.locator('#btn-a-minus').click();
            await page.locator('#btn-b-plus').click();

            await expect(page.locator('#delta-badge-a')).toHaveText('-1');
            await expect(page.locator('#adj-a-top')).toContainText('46');

            await expect(page.locator('#delta-badge-b')).toHaveText('+1');
            await expect(page.locator('#adj-b-bottom')).toContainText('34');
        });

        test('Scenario: Reset button clears adjustments and input', async ({ page }) => {
            await startGame(page);

            await page.locator('#btn-a-plus').click();
            await page.locator('#btn-b-minus').click();
            await page.locator('#answer-input').fill('80');

            await expect(page.locator('#delta-badge-a')).toBeVisible();
            await expect(page.locator('#btn-check')).toBeVisible();

            await page.locator('#btn-reset').click();

            await expect(page.locator('#delta-badge-a')).toBeHidden();
            await expect(page.locator('#delta-badge-b')).toBeHidden();
            await expect(page.locator('#btn-a-minus')).toBeVisible();
            await expect(page.locator('#btn-b-plus')).toBeVisible();
            await expect(page.locator('#answer-input')).toBeEmpty();
            await expect(page.locator('#btn-check')).toBeHidden();
        });

        test('Scenario: Level transitions appear every 3 rounds', async ({ page }) => {
            await startGame(page);

            for (let i = 0; i < 3; i++) {
                await submitAnswer(page, fallbackContent.rounds[i].correctAnswer);
            }

            await expect(page.locator('.mathai-transition-title')).toHaveText('Level 2', { timeout: 5000 });
            await clickNextLevel(page);
            await expect(page.locator('#original-a')).toHaveText('36', { timeout: 3000 });

            for (let i = 3; i < 6; i++) {
                await submitAnswer(page, fallbackContent.rounds[i].correctAnswer);
            }

            await expect(page.locator('.mathai-transition-title')).toHaveText('Level 3', { timeout: 5000 });
            await clickNextLevel(page);
            await expect(page.locator('#original-a')).toHaveText('78', { timeout: 3000 });
        });

        test('Scenario: Game over after 3 wrong answers', async ({ page }) => {
            await startGame(page);

            for (let i = 0; i < 3; i++) {
                await submitAnswer(page, '99');
                if (i < 2) {
                    await expect.poll(async () => await page.evaluate(() => window.gameState.lives)).toBe(3 - (i + 1), { timeout: 3000 });
                }
            }

            await expect(page.locator('#results-screen')).toBeVisible({ timeout: 3000 });
            await expect(page.locator('#results-title')).toHaveText('Game Over');
            await expect(page.locator('#stars-display')).toHaveText('☆☆☆');
        });

        test('Scenario: Check button visibility toggles with input', async ({ page }) => {
            await startGame(page);

            await expect(page.locator('#btn-check')).toBeHidden();
            await page.locator('#answer-input').fill('5');
            await expect(page.locator('#btn-check')).toBeVisible();
            await expect(page.locator('#btn-check')).not.toHaveClass(/hidden/);

            await page.locator('#answer-input').fill('');
            await expect(page.locator('#btn-check')).toBeHidden();
        });

        test('Scenario: Star rating is calculated correctly (3 stars)', async ({ page }) => {
            await page.clock.install({ time: new Date() });

            await startGame(page);

            for (let i = 0; i < 9; i++) {
                await page.locator('#answer-input').fill(fallbackContent.rounds[i].correctAnswer.toString());
                await page.clock.fastForward(1000);
                await page.locator('#btn-check').click();
                await page.clock.fastForward(500);
                // Wait for processing (isProcessing goes false after roundComplete / endGame)
                await expect.poll(async () => await page.evaluate(() => !window.gameState.isProcessing), { timeout: 15000 }).toBe(true);

                if (i === 2 || i === 5) {
                    await clickNextLevel(page);
                } else if (i < 8) {
                    await expect(page.locator('#original-a')).toHaveText(
                        fallbackContent.rounds[i + 1].numberA.toString(),
                        { timeout: 3000 }
                    );
                }
            }

            await expect(page.locator('#results-screen')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#stars-display')).toHaveText('⭐⭐⭐');

            const avgTimeText = await page.locator('#result-avg-time').textContent();
            const avgTimeValue = parseFloat(avgTimeText.replace('s', ''));
            expect(avgTimeValue).toBeLessThan(15);
        });

        test('Scenario: ProgressBar and timer update correctly', async ({ page }) => {
            await expect(page.locator('#mathai-progress-slot')).toContainText('0/9');
            // Lives are rendered as emoji inside .mathai-lives-display
            await expect(page.locator('.mathai-lives-display')).toContainText('❤️❤️❤️');
            await expect(page.locator('#timer-container')).toContainText('00:00');

            await startGame(page);
            // Timer may be paused by VisibilityTracker in headless mode — verify via gameState instead
            await page.waitForTimeout(1000);
            const timerStarted = await page.evaluate(() => window.gameState.isActive && window.gameState.startTime !== null);
            expect(timerStarted).toBe(true);

            await submitAnswer(page, '80');
            await expect(page.locator('#mathai-progress-slot')).toContainText('1/9', { timeout: 3000 });

            await submitAnswer(page, '99');
            await expect.poll(async () => await page.evaluate(() => window.gameState.lives)).toBe(2, { timeout: 3000 });
        });

        test('Scenario: Restart button resets the game state', async ({ page }) => {
            await startGame(page);

            await submitAnswer(page, '99'); // Wrong
            await expect.poll(async () => await page.evaluate(() => window.gameState.lives)).toBe(2, { timeout: 3000 });

            await submitAnswer(page, '80'); // Correct
            await expect.poll(async () => await page.evaluate(() => window.gameState.currentRound)).toBe(1, { timeout: 5000 });

            // Trigger game over to get to results screen
            await page.evaluate(() => window.endGame('game_over'));

            await expect(page.locator('#results-screen')).toBeVisible({ timeout: 3000 });
            await page.locator('#btn-restart').click();

            await expect(page.locator('.mathai-transition-title')).toHaveText('Adjustment Strategy', { timeout: 5000 });
            await expect(page.locator('#mathai-transition-slot button')).toBeVisible();

            const state = await page.evaluate(() => window.gameState);
            expect(state.currentRound).toBe(0);
            expect(state.lives).toBe(3);
            expect(state.isActive).toBe(false);
        });
    });
});
