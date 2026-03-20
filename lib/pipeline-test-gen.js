'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline-test-gen.js — Steps 2a, 2.5, 2b: test case + Playwright test generation
//
// Extracted from pipeline.js (P7 Phase 3).
// Handles: test case generation, DOM snapshot capture, per-category test code
// generation, and post-processing fixups on all spec files.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { buildTestCasesPrompt, buildTestGenCategoryPrompt } = require('./prompts');
const { captureGameDomSnapshot, extractSpecRounds, extractTestGenerationHints, extractGameFeatures, CATEGORY_SPEC_ORDER } = require('./pipeline-utils');

const config = require('./config');

const TEST_MODEL = config.RALPH_TEST_MODEL;
const TEST_CASES_MODEL = config.RALPH_TEST_CASES_MODEL;
const SKIP_DOM_SNAPSHOT = config.RALPH_SKIP_DOM_SNAPSHOT;

// ─── buildGameFeaturesBlock ───────────────────────────────────────────────────
// Derives a GAME FEATURE FLAGS block from specContent + domSnapshot.
// Only truthy flags are emitted — false flags are omitted so the LLM sees a
// concise, non-contradictory block.  Returns '' when no flags are truthy.
function buildGameFeaturesBlock(specContent, domSnapshotText) {
  const features = extractGameFeatures(specContent, domSnapshotText || '');
  const lines = [];

  if (features.unlimitedLives) {
    lines.push('- unlimitedLives: true → DO NOT generate lives-decrement or lives-display tests; game has no lives system');
  }
  if (features.accuracyScoring) {
    lines.push('- accuracyScoring: true → Stars derived from accuracy %; do NOT use setLives() for star threshold tests');
  }
  if (features.timerScoring) {
    lines.push('- timerScoring: true → Stars derived from avg time per round; use setRoundTimes() helper for star threshold tests');
  }
  if (features.hasTwoPhases) {
    lines.push('- hasTwoPhases: true → Game has learn + recall phases; do NOT answer during the learn/study phase');
  }
  if (features.hasLevels && features.totalLevels) {
    lines.push(`- hasLevels: true (${features.totalLevels} levels) → Level-transition tests are valid; expect ${features.totalLevels} distinct levels`);
  }
  if (features.singleRound) {
    lines.push('- singleRound: true → Game ends after one round; do NOT test multi-round progression');
  }

  if (lines.length === 0) return '';
  return `GAME FEATURE FLAGS (derived from spec — do not contradict these):\n${lines.join('\n')}`;
}

/**
 * Runs Steps 2a (test case generation), 2.5 (DOM snapshot capture), and 2b (per-category
 * Playwright test code generation), then applies post-processing fixups to all spec files.
 * @param {object} ctx - Pipeline context with gameDir, htmlFile, testsDir, testCasesFile,
 *   specContent, specMeta, htmlContent, transitionSlotId, formatLearningsBlock,
 *   info, warn, progress, llmCalls, report, trackedLlmCall, gameId, log
 * @returns {Promise<{testCases: Array, domSnapshot: object|null}>}
 */
async function generateTests(ctx) {
  const {
    gameDir, htmlFile, testsDir, testCasesFile,
    specContent, specMeta, htmlContent,
    transitionSlotId, formatLearningsBlock,
    info, warn, progress,
    llmCalls, report, trackedLlmCall,
    gameId, log,
  } = ctx;

  // ─── Step 2a: Generate test cases from spec ─────────────────────────────

  const existingTestCases = fs.existsSync(testCasesFile);
  if (existingTestCases) {
    info(`[pipeline] Step 2a: Skipping test case generation — test-cases.json exists`);
  }

  let testCases = [];
  if (!existingTestCases) {
    info('[pipeline] Step 2a: Generate test cases from spec');
    progress('generate-test-cases', { gameId, model: TEST_CASES_MODEL });

    const testCasesPrompt = buildTestCasesPrompt(specContent, buildGameFeaturesBlock(specContent, ''));

    try {
      const testCasesOutput = await trackedLlmCall('generate-test-cases', testCasesPrompt, TEST_CASES_MODEL, {}, report);
      llmCalls.push({ step: 'generate-test-cases', model: TEST_CASES_MODEL });
      const jsonMatch = testCasesOutput.match(/```json\n([\s\S]*?)\n```/) || testCasesOutput.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          testCases = JSON.parse(jsonMatch[1]);
          fs.writeFileSync(testCasesFile, JSON.stringify(testCases, null, 2));
          info(`[pipeline] Generated ${testCases.length} test cases`);
          progress('test-cases-ready', { gameId, testCases });
        } catch {
          warn('[pipeline] Could not parse test cases JSON — continuing');
        }
      }
    } catch (err) {
      warn(`[pipeline] Test case generation failed: ${err.message} — continuing`);
    }
  } else {
    try {
      testCases = JSON.parse(fs.readFileSync(testCasesFile, 'utf-8'));
      progress('test-cases-ready', { gameId, testCases });
    } catch {
      /* ignore parse errors */
    }
  }

  // ─── Step 2.5: DOM snapshot for test generation context ─────────────────

  let domSnapshot = null;

  if (!SKIP_DOM_SNAPSHOT) {
    info('[pipeline] Step 2.5: Capturing DOM snapshot');
    progress('dom-snapshot', { gameId });
    domSnapshot = await captureGameDomSnapshot(gameDir, transitionSlotId, specMeta, log);
    if (domSnapshot) {
      progress('dom-snapshot-ready', { gameId });
    } else {
      // captureGameDomSnapshot returns null only when both the browser snapshot AND
      // the static HTML fallback both fail — this means the page is fatally broken
      // (e.g. game did not render at all, blank #gameContent, or no HTML file).
      // Aborting now prevents burning a 2-minute test-gen LLM call on broken HTML.
      warn('[pipeline] Step 2.5: DOM snapshot returned null — fatal page init failure detected');
      progress('dom-snapshot-fatal', { gameId });
      const err = new Error('Step 2.5: DOM snapshot failed — game page did not render; aborting test generation to retry HTML');
      err.isFatalSnapshotError = true;
      throw err;
    }
  }

  // ─── Step 2b: Generate Playwright tests per category ─────────────────────

  // Check if any spec files already exist AND have runnable test() calls
  const hasRunnableTests = (specFilePath) => {
    if (!fs.existsSync(specFilePath)) return false;
    const content = fs.readFileSync(specFilePath, 'utf-8');
    return /^\s*test\s*\(/m.test(content);
  };
  // Remove spec files with no runnable tests so they get regenerated
  if (fs.existsSync(testsDir)) {
    for (const f of fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js'))) {
      if (!hasRunnableTests(path.join(testsDir, f))) {
        fs.unlinkSync(path.join(testsDir, f));
        info(`[pipeline] Step 2b: Deleted empty spec file ${f} (no runnable tests — will regenerate)`);
      }
    }
  }
  // Check which categories already have valid spec files — only regenerate missing ones
  const existingCategories = new Set(
    fs.existsSync(testsDir)
      ? CATEGORY_SPEC_ORDER.filter((cat) => hasRunnableTests(path.join(testsDir, `${cat}.spec.js`)))
      : [],
  );
  const missingCategories = CATEGORY_SPEC_ORDER.filter((cat) => !existingCategories.has(cat));
  const existingTests = existingCategories.size === CATEGORY_SPEC_ORDER.length;

  if (existingTests) {
    info(
      `[pipeline] Step 2b: Skipping test generation — all ${CATEGORY_SPEC_ORDER.length} spec files with runnable tests found`,
    );
  } else if (existingCategories.size > 0) {
    info(
      `[pipeline] Step 2b: Partial test generation — missing categories: ${missingCategories.join(', ')}`,
    );
  }

  if (!existingTests) {
    info('[pipeline] Step 2b: Generate Playwright tests (categorized)');
    progress('generate-tests', { gameId, model: TEST_MODEL });

    // Iterate only missing categories (per-category regeneration — existing valid specs are kept)
    const CATEGORIES = missingCategories;

    const categoryDescriptions = {
      'game-flow':
        'Screen transitions: start screen → clicking through to game → level/round transition screens → game over/results screen. Test that correct screens appear in order and navigation works. Use DOM snapshot selectors for actual element IDs.',
      mechanics:
        'Core game interactions: clicking or interacting with game elements, submitting/checking answers, receiving correct/incorrect feedback, score tracking. Derive selectors from DOM snapshot.',
      'level-progression':
        'Level/round structure: how content changes between levels or rounds, clicking through transition screens, counter/progress indicator progression. Derive specifics from the spec and DOM snapshot.',
      'edge-cases':
        'Boundary conditions: invalid or empty input, losing all lives (game over early), rapid repeated actions, final round/level of the game. Derive selectors from DOM snapshot.',
      contract:
        `postMessage contract: when the game ends, window.parent.postMessage fires with { type: "gameOver", score, stars, total }. Verify the ACTUAL star formula from this spec (starType: "${specMeta.starType}"): ${
          specMeta.starType === 'lives'
            ? 'stars = lives remaining (3 lives → 3★, 2 lives → 2★, 1 life → 1★, 0 lives (game over) → 0★). Test multiple scenarios using window.__ralph.setLives() to verify each star value.'
            : specMeta.starType === 'avg-time'
            ? 'stars = based on average time per round/level (see spec for thresholds). Use window.__ralph.setRoundTimes() to set specific times before skipToEnd.'
            : specMeta.starType === 'accuracy'
            ? 'stars = based on accuracy percentage (see spec for thresholds). Verify by controlling correct/incorrect answers.'
            : 'stars = based on spec criteria. Verify the postMessage payload has correct star value for a completed game.'
        }`,
    };

    // Shared boilerplate prepended verbatim to every category spec file.
    const gameContentFile = path.join(testsDir, 'game-content.json');
    const capturedGameContent = fs.existsSync(gameContentFile) ? (() => { try { return JSON.parse(fs.readFileSync(gameContentFile, 'utf-8')); } catch { return null; } })() : null;
    let fallbackRounds = capturedGameContent && Array.isArray(capturedGameContent.rounds)
      ? capturedGameContent.rounds
      : [];
    if (!fallbackRounds || fallbackRounds.length === 0) {
      warn(`[pipeline] Step 2b: fallbackContent.rounds is empty — test gen may invent wrong expected values. Consider exposing window.gameState.content.rounds in the game.`);
      const specRounds = extractSpecRounds(specContent);
      if (specRounds.length > 0) {
        fallbackRounds = specRounds;
        info(`[pipeline] Step 2b: Using ${specRounds.length} spec-derived rounds as fallbackContent (DOM snapshot had none)`);
      }
    }
    const fallbackRoundsJs = fallbackRounds.length > 0
      ? JSON.stringify(fallbackRounds, null, 4)
      : '[]';

    // Determine whether this game uses the CDN TransitionScreen/ScreenLayout component.
    const hasTransitionSlot =
      htmlContent.includes('mathai-transition-slot') ||
      (domSnapshot != null && domSnapshot.includes('mathai-transition-slot')) ||
      (!htmlContent && domSnapshot == null);

    const sharedBoilerplate = `import { test, expect } from '@playwright/test';

// Game round data captured from runtime — use instead of window.gameState.content
const fallbackContent = {
  rounds: ${fallbackRoundsJs}
};

async function dismissPopupIfPresent(page) {
  const backdrop = page.locator('#popup-backdrop');
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.locator('button').first().click();
    await page.waitForTimeout(300);
  }
  // Dismiss CDN audio permission popup (FeedbackManager.init() shows "Okay!" button)
  const okayBtn = page.locator('button:has-text("Okay!")');
  if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await okayBtn.click();
    await page.waitForTimeout(300);
  }
}

async function startGame(page) {
  await dismissPopupIfPresent(page);
  // Click through ALL initial transition screens (start screen, level-1 intro, etc.)
  // until no more transition buttons remain — game is then active.
  // Some games have 1 screen (start → game), others have 2+ (start → level-1 → game).
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(400);
  await dismissPopupIfPresent(page);
  const innerDeadline = Date.now() + 8000;
  while (Date.now() < innerDeadline) {
    const hasButton = await page.locator('#${transitionSlotId} button').isVisible({ timeout: 600 }).catch(() => false);
    if (!hasButton) break;
    await page.locator('#${transitionSlotId} button').first().click();
    await page.waitForTimeout(400);
    await dismissPopupIfPresent(page);
  }
  // Confirm game is active (no transition button visible)
  await expect(page.locator('#${transitionSlotId} button')).not.toBeVisible({ timeout: 5000 });
}

async function clickNextLevel(page) {
  await expect(page.locator('#${transitionSlotId} button')).toBeVisible({ timeout: 10000 });
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
}

// ─── Data-phase helpers (use these instead of timing-based visibility checks) ───

// Wait for game to reach a specific phase (reads data-phase attribute on #app)
// Immune to CDN animation timing — data-phase changes atomically with game state
async function waitForPhase(page, phase, timeout) {
  timeout = timeout || 20000;
  await expect(page.locator('#app')).toHaveAttribute('data-phase', phase, { timeout });
}

// Read game state as integers from data-* attributes on #app (not text/emoji)
async function getLives(page) {
  const val = await page.locator('#app').getAttribute('data-lives');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.lives ?? null);
}
async function getScore(page) {
  const val = await page.locator('#app').getAttribute('data-score');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.score ?? 0);
}
async function getRound(page) {
  const val = await page.locator('#app').getAttribute('data-round');
  return val !== null ? parseInt(val, 10) : await page.evaluate(() => window.gameState?.currentRound ?? 0);
}

// Skip to end of game without playing all rounds
// 'victory' → results screen, 'game_over' → game-over screen
async function skipToEnd(page, reason) {
  reason = reason || 'victory';
  await page.evaluate((r) => window.__ralph && window.__ralph.endGame(r), reason);
  // Sync DOM state in case __ralph.endGame didn't trigger syncDOMState
  await page.evaluate(() => window.__ralph && window.__ralph.syncDOMState && window.__ralph.syncDOMState());
}

// Answer a question using the spec-derived window.__ralph.answer() (correct or wrong)
// Waits for isProcessing to clear before returning
async function answer(page, correct) {
  correct = correct !== false;
  await page.evaluate((c) => window.__ralph && window.__ralph.answer(c), correct);
  // Wait for processing to complete
  await expect.poll(
    async () => await page.evaluate(() => !window.gameState?.isProcessing),
    { timeout: 5000 }
  ).toBe(true);
}


${buildBeforeEach(hasTransitionSlot, transitionSlotId)}`;

    // Build GAME FEATURE FLAGS block once — shared across all categories.
    // domSnapshot is available here (post-Step 2.5); pass it for DOM-derived flags.
    const gameFeaturesBlock = buildGameFeaturesBlock(specContent, domSnapshot || '');
    if (gameFeaturesBlock) {
      info(`[pipeline] Step 2b: Injecting game feature flags into test-gen prompts:\n${gameFeaturesBlock}`);
    }

    await Promise.all(
      CATEGORIES.map(async (category) => {
        const catTestCases = testCases.filter((tc) => tc.category === category);
        if (catTestCases.length === 0) {
          info(`[pipeline] Step 2b: No test cases for '${category}' — skipping`);
          return;
        }

        const catFile = path.join(testsDir, `${category}.spec.js`);
        info(`[pipeline] Step 2b: Generating ${category} (${catTestCases.length} test cases)`);

        const catTestCasesText = catTestCases
          .map((tc, i) => `${i + 1}. ${tc.name}: ${tc.description}\n   Steps: ${tc.steps.join(' → ')}`)
          .join('\n');

        const testHintsBlock = (() => {
          const hints = extractTestGenerationHints(specContent, htmlContent);
          return hints.length > 0
            ? `\nGAME-SPECIFIC TEST WARNINGS (detected from spec — follow exactly):\n${hints.map(h => `⚠ ${h}`).join('\n')}\n`
            : '';
        })();
        const catPrompt = buildTestGenCategoryPrompt({
          category,
          categoryDescription: categoryDescriptions[category] || category,
          testCaseCount: catTestCases.length,
          testCasesText: catTestCasesText,
          learningsBlock: formatLearningsBlock(),
          testHintsBlock,
          gameFeaturesBlock,
          domSnapshot,
          htmlContent,
        });

        let catOutput;
        try {
          catOutput = await trackedLlmCall(`generate-tests-${category}`, catPrompt, TEST_MODEL, {}, report);
          llmCalls.push({ step: `generate-tests-${category}`, model: TEST_MODEL });
        } catch (err) {
          warn(`[pipeline] Test generation for '${category}' failed: ${err.message} — skipping`);
          return;
        }

        let catTests = extractTestsBlock(catOutput);
        if (!catTests) {
          warn(`[pipeline] Could not extract test.describe() for '${category}' — skipping`);
          return;
        }

        // If LLM added boilerplate before the describe block, strip it
        const describeStart = catTests.indexOf('test.describe(');
        if (describeStart > 0) {
          catTests = catTests.substring(describeStart);
        }

        // Fix bare describe() → test.describe() in case LLM used wrong API
        catTests = catTests
          .replace(/(?<![.\w])describe\s*\(/g, 'test.describe(')
          .replace(/(?<![.\w])beforeEach\s*\(/g, 'test.beforeEach(')
          .replace(/(?<![.\w])afterEach\s*\(/g, 'test.afterEach(')
          .replace(/(?<![.\w])beforeAll\s*\(/g, 'test.beforeAll(')
          .replace(/(?<![.\w])afterAll\s*\(/g, 'test.afterAll(');

        // Fix slot class vs ID prefix
        catTests = catTests.replace(/locator\s*\(\s*['"]\.mathai-transition-slot/g, "locator('#mathai-transition-slot");
        catTests = catTests.replace(/locator\s*\(\s*['"]\.mathai-progress-slot/g, "locator('#mathai-progress-slot");

        // Fix buttons in wrong slot (progress slot has no buttons)
        catTests = catTests.replace(
          /(locator\s*\(['"]#mathai-progress-slot['"]\))\s*\.locator\s*\(\s*['"]button['"]/g,
          "locator('#mathai-transition-slot').locator('button'",
        );
        catTests = catTests.replace(
          /locator\s*\(\s*['"]#mathai-progress-slot\s+button['"]/g,
          "locator('#mathai-transition-slot button'",
        );

        // Fix wrong button classes (.game-btn → real mathai-transition-btn)
        catTests = catTests.replace(/\.game-btn\.btn-primary/g, '');
        catTests = catTests.replace(/\.btn-primary/g, '');
        // Fix dynamically-generated progress bar IDs → stable class selectors
        catTests = catTests.replace(/#pb-\d+-text/g, '#mathai-progress-slot .mathai-progress-text');
        catTests = catTests.replace(/#pb-\d+-lives/g, '#mathai-progress-slot .mathai-lives-display');
        // Fix wrong rounds display class (.mathai-rounds-display doesn't exist — it's .mathai-progress-text)
        catTests = catTests.replace(/\.mathai-rounds-display/g, '.mathai-progress-text');

        // Fix await expect(page.evaluate(...)) → expect(await page.evaluate(...))
        catTests = catTests.replace(/await\s+expect\s*\(\s*page\.evaluate\s*\(/g, 'expect(await page.evaluate(');

        const fullSpec = sharedBoilerplate + '\n\n' + catTests;
        fs.writeFileSync(catFile, fullSpec + '\n');
        info(`[pipeline] Step 2b: Wrote ${category}.spec.js (${fullSpec.length} bytes)`);
      }),
    );

    // Build per-category test count from testCases (generated earlier in step 2a)
    const categoryCounts = {};
    for (const tc of testCases) {
      const cat = tc.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    progress('tests-generated', { gameId, totalTests: testCases.length, model: TEST_MODEL, categories: categoryCounts });
  } // end if (!existingTests)

  // ─── Always-applied HTML cleanup ─────────────────────────────────────────
  {
    let rawHtml = fs.readFileSync(htmlFile, 'utf-8');
    let htmlChanged = false;
    if (rawHtml.includes('cdn.mathai.ai')) {
      rawHtml = rawHtml.replace(/cdn\.mathai\.ai/g, 'cdn.homeworkapp.ai');
      htmlChanged = true;
      warn(`[pipeline] Fixed CDN domain in HTML (cdn.mathai.ai → cdn.homeworkapp.ai)`);
    }
    // cdn.homeworkapp.ai returns 403 for all game packages — replace with canonical GCS URLs
    if (rawHtml.includes('cdn.homeworkapp.ai')) {
      const CANONICAL_PACKAGES = [
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>',
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>',
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>',
      ].join('\n');
      rawHtml = rawHtml.replace(/<script[^>]*cdn\.homeworkapp\.ai[^>]*><\/script>/g, '');
      if (!rawHtml.includes('storage.googleapis.com/test-dynamic-assets/packages/feedback-manager')) {
        rawHtml = rawHtml.replace('</body>', `${CANONICAL_PACKAGES}\n</body>`);
      }
      htmlChanged = true;
      warn(`[pipeline] Fixed CDN domain in HTML (cdn.homeworkapp.ai → storage.googleapis.com/test-dynamic-assets)`);
    }
    if (htmlChanged) {
      fs.writeFileSync(htmlFile, rawHtml);
      ctx.injectHarnessToFile(htmlFile);
    }
  }

  // ─── Always-applied test post-processing ─────────────────────────────────
  {
    const allSpecFilePaths = fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : [];

    for (const specFilePath of allSpecFilePaths) {
      let tests = fs.readFileSync(specFilePath, 'utf-8');
      let changed = false;

      // Fix beforeEach: must dismiss audio popup BEFORE waiting for transition slot.
      if (tests.includes('test.beforeEach') && !tests.includes('FeedbackManager.init() shows')) {
        const oldBeforeEach = /test\.beforeEach\s*\(async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{[\s\S]*?\}\s*\);/;
        const hasSlot = htmlContent.includes('mathai-transition-slot');
        const newBeforeEach = buildBeforeEach(hasSlot);
        if (oldBeforeEach.test(tests)) {
          tests = tests.replace(oldBeforeEach, newBeforeEach);
          changed = true;
        }
      }

      // Fix await expect(page.evaluate(...)).toBe() — must await evaluate FIRST
      if (tests.includes('await expect(page.evaluate(')) {
        tests = tests.replace(/await\s+expect\s*\(\s*page\.evaluate\s*\(/g, 'expect(await page.evaluate(');
        changed = true;
      }

      // Fix toHaveStyle used to check CSS-class-based styling
      if (/\.toHaveStyle\s*\(/.test(tests)) {
        tests = tests.replace(/await expect\([^)]+\)\.toHaveStyle\([^)]+\);/g, '// NOTE: toHaveStyle removed — use toHaveClass or page.evaluate for style checks');
        changed = true;
      }

      // Fix expect(transitionSlot).toBeHidden() — CDN keeps the slot div visible
      if (/expect\s*\([^)]*transition[Ss]lot[^)]*\)\s*\.toBeHidden/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*([^)]*transition[Ss]lot[^)]*)\s*\)\s*\.toBeHidden\s*\(\s*\)/g,
          "await expect(page.locator('#mathai-transition-slot button').first()).not.toBeVisible({ timeout: 5000 })",
        );
        changed = true;
      }

      // Fix toHaveText on lives display
      if (/\.mathai-lives-display['"]\s*\)\s*\.toHaveText\s*\(/.test(tests) ||
          /locator\s*\([^)]*lives[^)]*\)\s*\.toHaveText\s*\(\s*["'][\u2764\u2665❤]/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*page\.locator\s*\(\s*['"][^'"]*lives[^'"]*['"]\s*\)\s*\)\s*\.toHaveText\s*\(\s*["']([^"']+)["']\s*\)/g,
          (match, expectedText) => {
            const heartCount = (expectedText.match(/[\u2764\u2665❤]/g) || []).length;
            if (heartCount > 0) {
              return `expect(await page.evaluate(() => window.gameState.lives)).toBe(${heartCount})`;
            }
            return match;
          },
        );
        changed = true;
      }

      // Fix re-click on .correct cell
      if (/toHaveClass\s*\(\/correct\/\)/.test(tests) && /\.click\(\)/.test(tests)) {
        tests = tests.replace(
          /(await expect\([^)]+\)\.toHaveClass\(\/correct\/\);[\s\S]{0,400}?)(await \w+\.click\(\);)/g,
          (match, before, clickLine) => before + clickLine.replace('.click();', '.click({ force: true });'),
        );
        changed = true;
      }

      // Fix Gemini hallucinating '${transitionSlotId}' as a literal variable name
      if (tests.includes('${transitionSlotId}')) {
        tests = tests.replace(/\$\{transitionSlotId\}/g, 'mathai-transition-slot');
        changed = true;
      }

      // Fix #mathai-progress-slot used for button finding
      if (tests.includes('#mathai-progress-slot button') || tests.includes("'#mathai-progress-slot').locator('button'")) {
        tests = tests.replace(
          /locator\s*\(\s*['"]#mathai-progress-slot\s+button['"]/g,
          "locator('#mathai-transition-slot button'",
        );
        tests = tests.replace(
          /(locator\s*\(['"]#mathai-progress-slot['"]\))\s*\.locator\s*\(\s*['"]button['"]/g,
          "locator('#mathai-transition-slot').locator('button'",
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(specFilePath, tests + '\n');
      }
    }
  }

  return { testCases, domSnapshot };
}

// ─── buildBeforeEach ─────────────────────────────────────────────────────────
// Returns the complete test.beforeEach(...) string.
// hasCdnSlot  — true when the game uses #mathai-transition-slot (CDN ScreenLayout)
// slotId      — the transition slot element ID (default: 'mathai-transition-slot')
//
// Shared body: addInitScript visibility override + console/pageerror/requestfailed
//   capture + page.goto('/').
// CDN branch:  50 s poll loop that dismisses audio popup and waits for slot button.
// Non-CDN branch: waitForSelector on start-phase sentinel elements + 500 ms settle.

function buildBeforeEach(hasCdnSlot, slotId) {
  slotId = slotId || 'mathai-transition-slot';
  const sharedPreamble = `test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  // Capture browser-side errors before navigation so load-time failures are visible in test output
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[BROWSER ERROR]', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message);
  });
  page.on('requestfailed', req => {
    console.error('[NET FAIL]', req.url(), req.failure()?.errorText || 'unknown');
  });
  await page.goto('/');`;

  if (hasCdnSlot) {
    return `${sharedPreamble}
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // CDN scripts may take 45-60s to load -- poll for both popup and slot together.
  // 50s loop + 5s final check = 55s max, leaving 5s for test logic within 60s timeout.
  {
    const deadline = Date.now() + 50000;
    while (Date.now() < deadline) {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#${slotId} button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#${slotId} button').first()).toBeVisible({ timeout: 5000 });
  }
});`;
  } else {
    return `${sharedPreamble}
  // Non-CDN game: no #mathai-transition-slot -- wait for start phase or game content instead.
  await page.waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500); // allow JS init to settle
});`;
  }
}

// ─── extractTestsBlock (local helper, mirrors extractTests in pipeline.js) ───

function extractTestsBlock(output) {
  let match = output.match(/```javascript\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```js\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /test|expect|describe/.test(match[1])) return match[1];

  return null;
}

module.exports = { generateTests };
