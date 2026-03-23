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
const { buildTestCasesPrompt, buildTestGenCategoryPrompt, extractUserScenarios } = require('./prompts');
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
  } else if (!features.hasLives) {
    // Spec mentions no lives at all (neither finite nor explicit "no lives") — treat as non-lives game
    lines.push('- noLivesMentioned: true → Spec does not configure a lives system; DO NOT generate getLives() assertions or lives-exhaustion tests; if wrong-answer path must be tested, assert score/accuracy instead');
  }
  if (features.accuracyScoring) {
    lines.push('- accuracyScoring: true → Stars derived from accuracy %; do NOT use setLives() for star threshold tests');
  }
  if (features.timerScoring) {
    lines.push('- timerScoring: true → Stars derived from avg time per round; use setRoundTimes() helper for star threshold tests');
  }
  if (features.hasTwoPhases) {
    lines.push('- hasTwoPhases: true → Game has learn + recall phases; do NOT answer during the learn/study phase; CRITICAL for contract tests: skipToEnd(page, \'victory\') transitions to the RECALL phase first, NOT directly to \'results\' — for contract/postMessage tests use skipToEnd(page, \'game_over\') to reach gameover directly without going through recall phase; CRITICAL for level-progression tests: hasTwoPhases describes the learn→recall PHASE transition ONLY — round transitions WITHIN the recall phase are game-specific (game may auto-advance, or use a game-internal button); do NOT assume a #mathai-transition-slot button appears between rounds within the recall phase');
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

    // LLM failures (auth, network, 500) must throw — silently continuing with empty
    // test cases produces a 0-iteration FAILED build with no error message.
    const testCasesOutput = await trackedLlmCall('generate-test-cases', testCasesPrompt, TEST_CASES_MODEL, {}, report);
    llmCalls.push({ step: 'generate-test-cases', model: TEST_CASES_MODEL });
    const jsonMatch = testCasesOutput.match(/```json\n([\s\S]*?)\n```/) || testCasesOutput.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        testCases = JSON.parse(jsonMatch[1]);
        fs.writeFileSync(testCasesFile, JSON.stringify(testCases, null, 2));
        info(`[pipeline] Generated ${testCases.length} test cases`);
        progress('test-cases-ready', { gameId, testCases });
      } catch (err) {
        warn('[pipeline-test-gen] failed to parse testCases JSON: ' + err.message);
      }
    }
  } else {
    try {
      testCases = JSON.parse(fs.readFileSync(testCasesFile, 'utf-8'));
      progress('test-cases-ready', { gameId, testCases });
    } catch (err) {
      warn('[pipeline-test-gen] failed to parse testCases JSON: ' + err.message);
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

  // CR-087: gameFeatures must be declared here (outer scope) so Step 2c lint can use it
  // even when existingTests=true (tests already present, Step 2b block skipped entirely).
  // Bug: prior declaration was inside if(!existingTests) — ReferenceError on reused builds.
  let gameFeatures = null;

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
    let capturedGameContent = fs.existsSync(gameContentFile) ? (() => { try { return JSON.parse(fs.readFileSync(gameContentFile, 'utf-8')); } catch { return null; } })() : null;
    if (capturedGameContent) {
      const checked = detectCorruptFallbackContent(capturedGameContent);
      if (checked.corrupt) {
        warn('[pipeline] Step 2b: Corrupt fallbackContent detected (SignalCollector CDN API names) — discarding and falling back to spec rounds');
        capturedGameContent = null;
      }
    }
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
    // CDN games inject #mathai-transition-slot at RUNTIME via ScreenLayout.inject() —
    // the slot ID may NOT appear in the raw HTML source. We detect CDN games by checking:
    //   1. Slot ID appears in raw HTML (non-CDN games that manually create the slot)
    //   2. Slot ID appears in the DOM snapshot (runtime evidence — most reliable)
    //   3. HTML contains ScreenLayout.inject (the canonical CDN init call — used in validate-contract.js)
    //   4. HTML loads the CDN components package (storage.googleapis.com/.../components/index.js)
    //   5. HTML contains TransitionScreenComponent (CDN component reference)
    //   6. No HTML and no snapshot (conservative fallback — treat as CDN to avoid 2s timeout failure)
    const hasTransitionSlot =
      htmlContent.includes('mathai-transition-slot') ||
      (domSnapshot != null && domSnapshot.includes('mathai-transition-slot')) ||
      /ScreenLayout\.inject/.test(htmlContent) ||
      htmlContent.includes('test-dynamic-assets/packages/components') ||
      htmlContent.includes('TransitionScreenComponent') ||
      (!htmlContent && domSnapshot == null);

    // Load runtime media URLs for page.route() mocking (reduces requestfailed noise)
    let runtimeMediaUrls = [];
    try {
      const rtDepsPath = path.join(testsDir, 'runtime-dependencies.json');
      const rtDeps = JSON.parse(fs.readFileSync(rtDepsPath, 'utf-8'));
      runtimeMediaUrls = rtDeps.media || [];
    } catch { /* no runtime-dependencies.json — skip mocking */ }

    // Detect canvas presence for GEN-CANVAS-001 runtime assertion injection.
    // Check raw HTML and DOM snapshot — canvas may be injected dynamically (runtime-only).
    const hasCanvas =
      /<canvas[\s>]/i.test(htmlContent) ||
      (domSnapshot != null && /<canvas[\s>]/i.test(domSnapshot));

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

${hasTransitionSlot ? `async function startGame(page) {
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
}` : `async function startGame(page) {
  await dismissPopupIfPresent(page);
  // Non-CDN game: no #mathai-transition-slot. Try clicking a start button if visible,
  // then wait for the game to reach 'playing' phase via data-phase on #app.
  const startBtn = page.locator('button:has-text("Start"), button:has-text("Play"), button:has-text("Begin"), #start-button, .start-btn, .btn-start').first();
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(400);
  }
  // Wait for playing phase (syncDOMState sets data-phase on #app)
  await waitForPhase(page, 'playing', 15000);
}

async function clickNextLevel(page) {
  // Non-CDN game: click the most likely "next level" / "continue" button, then wait for playing phase
  const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Next Level"), .next-btn, .btn-next').first();
  if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(500);
  }
  await waitForPhase(page, 'playing', 10000);
}`}

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

// TE-RES-001: Viewport coverage assertion for results screen
// Call this after game ends (skipToEnd() or natural completion) and data-phase='results'.
// Fails clearly with position and rectTop values when results screen is off-viewport.
// Catches the P0 pattern: position:static pushed off-screen by CDN body flex-row layout
// (observed: rectTop=144.5px, width=208px in quadratic-formula #546, soh-cah-toa #544,
//  find-triangle-side #549, name-the-sides — GEN-UX-001 shipped to prevent new occurrences).
async function checkResultsScreenViewport(page) {
  // CR-049: Internal waitForSelector guard — data-phase may update before the results
  // screen element is fully rendered/visible. Wait up to 5s for a visible results element.
  // If no specific results element is found, proceed with the evaluate() check against #app.
  const resultsSelector = '#results-screen, .results-screen, [data-phase="results"], [class*="results"]';
  try {
    await page.waitForSelector(resultsSelector, { state: 'visible', timeout: 5000 });
  } catch {
    // No specific results element visible within timeout — proceed with viewport check.
    // The evaluate() below will return { found: false } and the assertion will be skipped.
  }

  const coverageCheck = await page.evaluate(() => {
    const sel = '#results-screen, .results-screen, [class*="results"]';
    const el = document.querySelector('[data-phase="results"]')
      || document.querySelector(sel);
    if (!el) return { found: false };
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || (rect.height === 0 || rect.width === 0)) {
      return { found: true, skipped: true, reason: 'element not visible yet' };
    }
    // coversViewport: height covers the full viewport AND top is at/near viewport origin
    // rectTop <= 10 guard: prevents false-pass when a position:relative element is tall enough
    // but scrolled below the fold (e.g. rectTop=200px — button at bottom is off-screen).
    // Observed: 6 UI/UX audit instances where results screen was not position:fixed and was
    // clipped because the CDN body flex-row layout pushed the screen down (TE-RES-002).
    const coversViewport = rect.top <= 10 && rect.height >= window.innerHeight;
    return {
      found: true,
      position: style.position,
      zIndex: style.zIndex,
      rectTop: Math.round(rect.top),
      rectHeight: Math.round(rect.height),
      coversViewport
    };
  });
  if (!coverageCheck.found) {
    // Results element not found — skip coverage check (game may not have a dedicated results element)
    return;
  }
  if (coverageCheck.skipped) {
    // Element exists but is not visible yet (display:none or zero-size) — skip assertion
    return;
  }
  // Assert: position must be 'fixed' OR results screen must cover full viewport from top
  // coversViewport already enforces rectTop <= 10, so this catches scrolled-down relative screens.
  expect(
    coverageCheck.position === 'fixed' || coverageCheck.coversViewport,
    \`Results screen must be position:fixed or cover full viewport. Got: position=\${coverageCheck.position}, top=\${coverageCheck.rectTop}px, height=\${coverageCheck.rectHeight}px, coversViewport=\${coverageCheck.coversViewport}\`
  ).toBe(true);
}


// TE-TRANSITION-001: Victory/results TransitionScreen content assertion
// Call this after skipToEnd('victory') when data-phase='results' and the CDN transition slot is active.
// Catches BROWSER-P0-001: transitionScreen.show('victory', ...) called with string mode instead of
// object API — renders a blank white screen with no title, score, or Play Again button.
// (observed: which-ratio #561 UI/UX audit — blank victory screen, unreachable Play Again).
async function checkTransitionScreenContent(page) {
  const contentCheck = await page.evaluate(() => {
    const slot = document.querySelector('#mathai-transition-slot');
    const screen = slot?.querySelector('.mathai-transition-screen');
    if (!screen || !screen.classList.contains('mathai-transition-screen--active')) {
      return { found: false };
    }
    const buttons = Array.from(screen.querySelectorAll('button')).filter(b => {
      const style = window.getComputedStyle(b);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
    const title = screen.querySelector('.mathai-transition-title, h1, h2, [class*="title"]');
    return {
      found: true,
      buttonCount: buttons.length,
      hasTitle: !!title,
      titleText: title?.textContent?.trim()?.slice(0, 50),
      firstButtonText: buttons[0]?.textContent?.trim()
    };
  });
  if (!contentCheck.found) return; // transition screen not active — skip
  expect(
    contentCheck.buttonCount > 0,
    \`Victory/results TransitionScreen must have at least 1 visible button. Got: \${JSON.stringify(contentCheck)}. Check transitionScreen.show() — must use object API with buttons array, not string mode.\`
  ).toBe(true);
}

// TE-CANVAS-001: Canvas responsive overflow assertion (GEN-CANVAS-001 runtime enforcement)
// Call this after the game renders its canvas (e.g. in afterEach or after startGame).
// Fails clearly with offsetWidth and viewport values when any canvas overflows the viewport.
// Catches UI-RTA-002 pattern: canvas hardcoded at width="500" overflows 375-480px viewports by 125px.
// (observed: right-triangle-area #543 — canvas 500px on 375px viewport → overflow 125px).
async function checkCanvasResponsive(page) {
  const result = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (canvases.length === 0) return { found: false };
    const viewport = window.innerWidth;
    const overflowing = canvases.filter(c => c.offsetWidth > viewport);
    if (overflowing.length === 0) return { found: true, passed: true };
    return {
      found: true,
      passed: false,
      canvasWidths: overflowing.map(c => ({ offsetWidth: c.offsetWidth, viewport }))
    };
  });
  if (!result.found || result.passed) return; // no canvas, or all fit — skip
  throw new Error(
    \`Canvas overflow: \${JSON.stringify(result.canvasWidths)} — canvas must have max-width:100%; height:auto (GEN-CANVAS-001)\`
  );
}

// Collected JS errors from page.on('pageerror') — reset each test, checked in afterEach
let pageErrors = [];

${buildBeforeEach(hasTransitionSlot, transitionSlotId, runtimeMediaUrls)}

// Fail any test that recorded a JS error during gameplay
test.afterEach(async () => {
  if (pageErrors.length > 0) {
    const errors = pageErrors.splice(0); // clear for next test
    throw new Error('Page threw JS error(s) during test:\\n' + errors.join('\\n'));
  }
});

${hasCanvas ? `// GEN-CANVAS-001: Assert canvas elements do not overflow viewport (mobile-equivalent widths).
// Runs after every test for canvas-based games only (hasCanvas=true detected from HTML/DOM snapshot).
// Source: UI-RTA-002 right-triangle-area #543 — canvas 500px on 375px viewport → overflow 125px.
test.afterEach(async ({ page }) => {
  await checkCanvasResponsive(page);
});` : ''}`;

    // Build GAME FEATURE FLAGS block once — shared across all categories.
    // domSnapshot is available here (post-Step 2.5); pass it for DOM-derived flags.
    gameFeatures = extractGameFeatures(specContent, domSnapshot || '');
    const gameFeaturesBlock = buildGameFeaturesBlock(specContent, domSnapshot || '');
    if (gameFeaturesBlock) {
      info(`[pipeline] Step 2b: Injecting game feature flags into test-gen prompts:\n${gameFeaturesBlock}`);
    }

    // Extract user scenarios from spec once — injected as required coverage matrix into
    // game-flow, mechanics, and edge-cases prompts so spec-defined paths are never missed.
    // Pass gameFeatures so lives detection uses the authoritative extractGameFeatures result
    // rather than the less-reliable spec-text heuristic (fixes unlimited-lives false positives).
    const specScenarios = extractUserScenarios(specContent, gameFeatures);
    if (specScenarios.length > 0) {
      info(`[pipeline] Step 2b: Extracted ${specScenarios.length} user scenarios from spec:\n${specScenarios.map(s => `  - ${s}`).join('\n')}`);
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
          specScenarios,
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

        // ─── Banned selector enforcement: #mathai-transition-slot button ──────────
        // The CDN empties #mathai-transition-slot after startGame(). Direct assertions
        // on '#mathai-transition-slot button' outside clickNextLevel() cause 100% batch
        // failure (GF5/GF9/CT3/LP4). Substitute them in generated test code rather than
        // stripping — stripping leaves vacuous passing tests (LP-2 fix).
        // Only clickNextLevel() is safe to use this selector — it is in the boilerplate.
        if (/#mathai-transition-slot\s+button/.test(catTests)) {
          const linesBefore = catTests.split('\n').length;
          // Substitute bare direct clicks → clickNextLevel() (LP-2: substitute, not strip)
          // CR-052: explicit (?:\.first\(\))? group handles both button.click() and button.first().click()
          catTests = catTests.replace(
            /^(\s*)await\s+page\.locator\s*\(\s*['"]#mathai-transition-slot\s+button['"]\s*\)\s*(?:\.first\s*\(\s*\))?\s*\.click\s*\([^)]*\)\s*;?\s*$/gm,
            '$1await clickNextLevel(page); // LP-2: substituted banned selector click → clickNextLevel()',
          );
          // Substitute .toBeVisible() → waitForPhase(page, 'playing') (LP-2: real assertion)
          catTests = catTests.replace(
            /^(\s*)await\s+expect\s*\(\s*page\.locator\s*\(\s*['"]#mathai-transition-slot\s+button['"]\s*\)[^)]*\)\s*\.\s*(?:first\s*\(\s*\)\s*\.\s*)?toBeVisible\s*\([^)]*\)\s*;?\s*$/gm,
            '$1await waitForPhase(page, \'playing\', 10000); // LP-2: substituted banned selector toBeVisible → waitForPhase',
          );
          // .not.toBeVisible() and toBeHidden() — semantics unclear post-CDN-clear; keep as comment
          catTests = catTests.replace(
            /^(\s*)await\s+expect\s*\(\s*page\.locator\s*\(\s*['"]#mathai-transition-slot\s+button['"]\s*\)[^)]*\)\s*\.\s*(?:first\s*\(\s*\)\s*\.\s*)?(?:not\.toBeVisible|toBeHidden)\s*\([^)]*\)\s*;?\s*$/gm,
            '$1// REMOVED: #mathai-transition-slot button not.toBeVisible/toBeHidden (banned — CDN clears slot between rounds)',
          );
          // .toHaveText() — text content check doesn't translate; keep as comment
          catTests = catTests.replace(
            /^(\s*)await\s+expect\s*\(\s*page\.locator\s*\(\s*['"]#mathai-transition-slot\s+button['"]\s*\)[^)]*\)\s*\.\s*(?:first\s*\(\s*\)\s*\.\s*)?toHaveText\s*\([^)]*\)\s*;?\s*$/gm,
            '$1// REMOVED: #mathai-transition-slot button toHaveText (banned — text content check has no safe substitute)',
          );
          // Remove expect.poll() wrappers targeting the banned selector (no clean substitute)
          catTests = catTests.replace(
            /^\s*await\s+expect\.poll\s*\([^)]*page\.locator\s*\(\s*['"]#mathai-transition-slot\s+button['"]\s*\)[^)]*\)[^)]*\)\s*\.[^;]+;\s*$/gm,
            '// REMOVED: #mathai-transition-slot button poll assertion (banned — CDN clears slot after startGame)',
          );
          const linesAfter = catTests.split('\n').length;
          if (linesAfter !== linesBefore) {
            warn(`[pipeline] Step 2b: LP-2 substituted/removed banned '#mathai-transition-slot button' assertion(s) from ${category} (${linesBefore - linesAfter} lines changed — GF9/CT3/LP4)`);
          }

          // ─── Zero-test guard ──────────────────────────────────────────────────
          // If every test() in this category used the banned selector, the strip
          // above will have replaced them all with comments — leaving zero runnable
          // tests. A spec file with no test() calls is worse than no file: the
          // pipeline treats it as a valid (passing) run rather than triggering regen.
          // Delete the file so the per-category regen logic can regenerate it.
          const hasRunnableTests = hasRunnableTestCalls(catTests);
          if (!hasRunnableTests) {
            warn(`[pipeline] Step 2b: BANNED-SELECTOR-STRIP: all tests removed from ${category} — deleting ${catFile} for regen`);
            if (fs.existsSync(catFile)) {
              fs.unlinkSync(catFile);
            }
            return; // skip writeFileSync for this category
          }
        }

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
        // Use the same CDN detection logic as hasTransitionSlot above (runtime slot, ScreenLayout.inject, components package)
        const hasSlot =
          htmlContent.includes('mathai-transition-slot') ||
          /ScreenLayout\.inject/.test(htmlContent) ||
          htmlContent.includes('test-dynamic-assets/packages/components') ||
          htmlContent.includes('TransitionScreenComponent');
        const newBeforeEach = buildBeforeEach(hasSlot, undefined, []);
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

      // Fix expect(await ...).resolves.toBe() — .resolves is only valid on promises, not resolved values.
      // When the value is already awaited, drop .resolves to prevent "received value must be a Promise" error.
      // Example: expect(await page.evaluate(() => lives)).resolves.toBe(3) → expect(await page.evaluate(() => lives)).toBe(3)
      if (/expect\s*\(\s*await\s+[^)]+\)\s*\.resolves\./.test(tests)) {
        tests = tests.replace(
          /(\bexpect\s*\(\s*await\s+[^)]+\))\s*\.resolves\./g,
          '$1.',
        );
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

      // Fix CSS selectors with commas in IDs — e.g. locator('#edge-el-0,0-0,1') is an invalid CSS
      // selector (comma = list separator). Replace with attribute selector: locator('[id="edge-el-0,0-0,1"]')
      if (/locator\s*\(\s*['"]#[^'"]*,[^'"]*['"]\s*\)/.test(tests)) {
        tests = tests.replace(
          /locator\s*\(\s*(['"])#([\w][\w,.\-[\] ]*(?:,[\w,.\-[\] ]*)+)\1\s*\)/g,
          (match, quote, id) => `locator('[id="${id}"]')`,
        );
        changed = true;
      }

      // Fix 'playing' phase assumption when game uses a custom phase name.
      // Load dom-snapshot.json to find the actual runtime phase (captured at game-screen time).
      // Example: matrix-memory uses 'memorize'/'question' — NOT 'playing'.
      // Replace waitForPhase(page, 'playing') with the actual phase so tests don't immediately timeout.
      {
        const snapPath = path.join(testsDir, 'dom-snapshot.json');
        if (fs.existsSync(snapPath)) {
          try {
            const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
            const phaseEntry = snap.gameStateShape && snap.gameStateShape.phase;
            // phaseEntry looks like: 'string "memorize"' — extract the phase name
            const phaseMatch = phaseEntry && phaseEntry.match(/^string "([^"]+)"/);
            const actualPhase = phaseMatch && phaseMatch[1];
            const STANDARD_PHASES = new Set(['playing', 'start', 'gameover', 'results', 'transition', 'paused']);
            if (actualPhase && !STANDARD_PHASES.has(actualPhase) &&
                (tests.includes("waitForPhase(page, 'playing')") || tests.includes('waitForPhase(page, "playing")'))) {
              tests = tests.replace(
                /waitForPhase\s*\(\s*page\s*,\s*['"]playing['"]/g,
                `waitForPhase(page, '${actualPhase}'`,
              );
              changed = true;
            }
          } catch {
            /* dom-snapshot.json parse failure — skip phase fixup */
          }
        }
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

  // ─── Step 2c: Lint generated test files ──────────────────────────────────
  // Read all spec files written in this run and lint against known failure patterns.
  // Violations are surfaced as WARN entries — they do NOT abort the build.
  {
    const allSpecFilePaths = fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : [];

    if (allSpecFilePaths.length > 0) {
      const testFileMap = {};
      for (const specFilePath of allSpecFilePaths) {
        const cat = path.basename(specFilePath, '.spec.js');
        try {
          testFileMap[cat] = fs.readFileSync(specFilePath, 'utf-8');
        } catch {
          /* skip unreadable files */
        }
      }

      const { violations, warningCount } = lintGeneratedTests(testFileMap, (msg) => warn(msg), gameFeatures);
      if (warningCount > 0) {
        warn(`[pipeline] Step 2c: Test lint found ${warningCount} violation(s) — see WARN entries above`);
        progress('test-lint-violations', { gameId, warningCount, violations });
      } else {
        info('[pipeline] Step 2c: Test lint passed — no violations found');
        progress('test-lint-ok', { gameId });
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

function buildBeforeEach(hasCdnSlot, slotId, routedMediaUrls) {
  slotId = slotId || 'mathai-transition-slot';
  routedMediaUrls = Array.isArray(routedMediaUrls) ? routedMediaUrls : [];
  const mediaRouteBlock = routedMediaUrls.length > 0
    ? `\n  // Mock non-critical external media URLs (audio, images captured at DOM snapshot time)
  // Prevents requestfailed console noise from 404 audio/image resources
  {
    const _mediaUrlSet = new Set(${JSON.stringify(routedMediaUrls)});
    await page.route((url) => _mediaUrlSet.has(url.toString()), route => route.fulfill({ status: 204, body: '' }));
  }`
    : '';
  const sharedPreamble = `test.beforeEach(async ({ page }) => {
  pageErrors = []; // reset for this test
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
    pageErrors.push(err.message);
  });
  page.on('requestfailed', req => {
    console.error('[NET FAIL]', req.url(), req.failure()?.errorText || 'unknown');
  });${mediaRouteBlock}
  await page.goto('/');`;

  if (hasCdnSlot) {
    return `${sharedPreamble}
  // Check for DOMContentLoaded init errors (e.g. CDN package load timeout) before polling.
  // window.__initError is set by the catch block in DOMContentLoaded when init fails.
  // Surface it early so failures are visible instead of producing a silent 50s timeout.
  await page.waitForTimeout(500); // allow DOMContentLoaded to fire and set __initError if present
  {
    const initErr = await page.evaluate(() => window.__initError).catch(() => null);
    if (initErr) {
      console.error('[test-harness] DOMContentLoaded init error: ' + initErr);
      // Still attempt the test (don't throw) -- let the test itself fail with context
    }
  }
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // CDN scripts may take 60-150s to load on cold start (Lesson 91: count-and-tap, Lesson 106: keep-track).
  // GCP server CDN cold-start measured at ~150s (Lesson 106). 160s poll + 5s final check = 165s max.
  // Test timeout set to 240s in playwright.config.js (160s CDN + 75s test execution margin).
  {
    const deadline = Date.now() + 160000;
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

// ─── detectCorruptFallbackContent ────────────────────────────────────────────
// CDN games that load content asynchronously (e.g., Associations fetches word
// pairs from a server) may have window.gameState.content === null when the DOM
// snapshot runs. In that case, extractSpecRounds() falls back to parsing the
// spec, which may inadvertently capture SignalCollector CDN API surface names
// ('Event', 'Target', 'Input', etc.) as fake round data.
//
// Detection: if >50% of question/answer values across all rounds match the
// known CDN API name set, the content is corrupt and must NOT be injected into
// the test-gen prompt.
//
// Returns { rounds: [], corrupt: true } when corrupt, otherwise returns the
// original fallbackContent unchanged.

const CDN_API_NAMES = new Set([
  'Event', 'Target', 'Input', 'Action', 'Source',
  'Destination', 'Signal', 'Payload', 'Context', 'Handler',
]);

function detectCorruptFallbackContent(fallbackContent) {
  if (!fallbackContent || !Array.isArray(fallbackContent.rounds) || fallbackContent.rounds.length === 0) {
    return fallbackContent || { rounds: [] };
  }

  const rounds = fallbackContent.rounds;
  let total = 0;
  let cdnMatches = 0;

  for (const round of rounds) {
    for (const field of ['question', 'answer']) {
      const val = round[field];
      if (typeof val === 'string' && val.trim().length > 0) {
        total++;
        if (CDN_API_NAMES.has(val.trim())) {
          cdnMatches++;
        }
      }
    }
  }

  if (total > 0 && cdnMatches / total > 0.5) {
    return { rounds: [], corrupt: true };
  }

  return fallbackContent;
}

// ─── lintGeneratedTests ───────────────────────────────────────────────────────
// Validates generated test files against known failure patterns.
// Called after generateAllTestCategories() returns, before the fix loop.
// Does NOT throw — violations are surfaced as WARN log entries only.
//
// @param {Object} testFiles    Map of { category -> fileContent } strings
// @param {Function} log        Logger function (called with WARN level strings)
// @param {Object} [gameFeatures]  Optional gameFeatures from extractGameFeatures() —
//   when provided and game has no lives system, NO_LIVES_ASSERT rule is enabled
// @returns {{ violations: Array<{category, rule, line, snippet}>, warningCount: number }}

const LINT_RULES = [
  {
    id: 'M13',
    pattern: /(?:getLives|getScore|getRound)\s*\(\s*page\s*\)\s*[;,\s]*\)?\s*\.(toBe|toEqual|toBeGreaterThan)/,
    message: 'Immediate getLives/getScore/getRound assertion — use expect.poll() (M13)',
  },
  {
    id: 'M15',
    pattern: /expect\s*\(\s*await\s+page\.locator\s*\([^)]+\)\s*\)\s*\.toHaveClass\s*\(/,
    message: 'Immediate .toHaveClass on await page.locator() — use expect.poll() to avoid race conditions (M15)',
  },
  {
    id: 'HARDCODED_TIMEOUT',
    pattern: /page\.waitForTimeout\s*\(\s*\d+\s*\)/,
    message: 'HARDCODED_TIMEOUT: page.waitForTimeout(N) — use waitForPhase() or expect.poll() instead of fixed delays',
  },
  {
    id: 'CT6_NULL',
    pattern: /getLastPostMessage\s*\([^)]*\)\s*\.[a-zA-Z]/,
    message: 'getLastPostMessage() result used without null-guard — use ?. or check for null first (CT6)',
  },
  {
    id: 'GF8',
    pattern: /\.toBeVisible\(\s*(?:\{[^}]*\}\s*)?\)(?!.*waitForPhase)/,
    message: 'toBeVisible() without prior waitForPhase() — screen visibility race (GF8). Always call waitForPhase() before asserting element visibility.',
  },
  {
    id: 'TRANSITION_SLOT',
    pattern: /#mathai-transition-slot\s+button/,
    message: 'Never wait on #mathai-transition-slot button — type=level-transition auto-advances (GF5/CT3/LP4)',
  },
  {
    id: 'RAW_CLICK',
    pattern: /await\s+page\.click\s*\(/,
    message: 'RAW_CLICK: Use page.locator(\'...\').click() not page.click() — old API causes flakiness',
  },
  {
    id: 'CT8_POLL_CAPTURE',
    pattern: /(?:const|let|var)\s+\w+\s*=\s*await\s+expect\.poll\s*\(/,
    message:
      'CT8_POLL_CAPTURE: expect.poll() returns an Expect object, NOT the callback return value — assigning it to a variable always gives undefined. Use Pattern A (capture inside poll callback), Pattern B (waitForFunction), or Pattern C (evaluate + null-guard). See CT8 in contract test gen rules. (build #546)',
  },
  {
    id: 'CT_WRONG_PHASE',
    // Matches waitForPhase(page, 'gameover' | 'recall' | 'playing' | 'transition' | 'start') in contract files —
    // contract tests must ONLY use waitForPhase(page, 'results', ...) for the completion check.
    // Note: 'gameover' is the most common wrong phase (word-pairs #529), 'recall' next (soh-cah-toa #531).
    pattern: /waitForPhase\s*\(\s*page\s*,\s*['"](?:gameover|recall|playing|transition|start)['"]/,
    categories: ['contract'], // Only enforce in contract test files — other categories legitimately use these phases
    message:
      "CT_WRONG_PHASE: In contract tests, waitForPhase() must use phase 'results' — NOT 'gameover', 'recall', 'playing', etc. The CDN postMessage only fires when data-phase=\"results\" is set on #app. Using any other phase means getLastPostMessage() returns null. See CT-NEW-1. (word-pairs #529, soh-cah-toa-worked-example #531)",
  },
  {
    id: 'CT_STAR_EXACT',
    // Matches .toBe(<integer>) on a metrics.stars assertion — exact star counts are fragile in contract tests.
    // Stars depend on accuracy/lives/speed; skipToEnd() does not guarantee a specific value.
    pattern: /\.data\.metrics\.stars\s*\)\s*\.toBe\s*\(\s*[0-9]+\s*\)/,
    categories: ['contract'], // Only enforce in contract test files
    message:
      'CT_STAR_EXACT: Never use .toBe(N) to assert an exact star count in contract tests — use toBeGreaterThanOrEqual(0) or toBeGreaterThanOrEqual(1). Stars depend on accuracy/speed/lives which skipToEnd() does not control. See CT-NEW-3. (memory-flip #453, kakuro #391, match-the-cards #514)',
  },
];

// Rules that are suppressed when the linter is processing lines inside
// boilerplate sections: helper functions (startGame, clickNextLevel,
// dismissPopupIfPresent) and the beforeEach/beforeAll block.
// These sections legitimately use #mathai-transition-slot, waitForTimeout(),
// and toBeVisible() as part of the generated test harness setup.
const HELPER_SUPPRESSED_RULES = new Set(['TRANSITION_SLOT', 'HARDCODED_TIMEOUT', 'GF8']);

// Regex that marks the start of a boilerplate helper function definition line.
const HELPER_FUNC_START =
  /^async function (startGame|clickNextLevel|dismissPopupIfPresent)\(page\)/;

function lintGeneratedTests(testFiles, log, gameFeatures) {
  const violations = [];

  // NO_LIVES_ASSERT: enabled when game has no lives system (explicit unlimited or spec doesn't mention lives)
  // Detects getLives() calls inside test bodies for non-lives games — these always return 0 and fail silently.
  const isNonLivesGame = gameFeatures &&
    (gameFeatures.unlimitedLives === true || gameFeatures.hasLives === false);
  const noLivesRule = isNonLivesGame ? {
    id: 'NO_LIVES_ASSERT',
    pattern: /getLives\s*\(\s*page\s*\)/,
    message: 'NO_LIVES_ASSERT: getLives() called in a non-lives game — totalLives=0, returns 0 always; remove this assertion (M14/GF7)',
  } : null;

  for (const [category, content] of Object.entries(testFiles)) {
    if (!content || typeof content !== 'string') continue;

    const lines = content.split('\n');

    // Find the line index of the first test.describe( call — everything before
    // this line is boilerplate (helper functions, beforeEach, imports, etc.)
    // and should suppress selected lint rules.
    let firstDescribeLine = lines.length; // default: no describe found → suppress nothing
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('test.describe(')) {
        firstDescribeLine = i;
        break;
      }
    }

    // Pre-compute per-line boilerplate flag so rule scanning can use it.
    // insideBoilerplate[i] === true means line i is in boilerplate (before
    // test.describe) OR inside a named boilerplate helper function body.
    const insideBoilerplate = new Array(lines.length).fill(false);

    // Mark all lines before the first test.describe() as boilerplate.
    for (let i = 0; i < firstDescribeLine; i++) {
      insideBoilerplate[i] = true;
    }

    // Also mark named helper function bodies that appear AFTER test.describe()
    // (uncommon but possible if helpers are declared after tests).
    let helperDepth = 0;
    let inHelper = false;
    for (let i = firstDescribeLine; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!inHelper && HELPER_FUNC_START.test(trimmed)) {
        inHelper = true;
        helperDepth = 0;
      }
      if (inHelper) {
        insideBoilerplate[i] = true;
        for (const ch of lines[i]) {
          if (ch === '{') helperDepth++;
          else if (ch === '}') {
            helperDepth--;
            if (helperDepth <= 0) {
              inHelper = false;
              break;
            }
          }
        }
      }
    }

    for (const rule of LINT_RULES) {
      // Skip rules that are scoped to specific categories (e.g. CT_WRONG_PHASE, CT_STAR_EXACT
      // only apply to contract tests, not game-flow or mechanics where the same patterns are valid).
      if (rule.categories && !rule.categories.includes(category)) continue;

      // Line-by-line scan for single-line patterns
      for (let i = 0; i < lines.length; i++) {
        // Suppress selected rules when inside boilerplate sections
        if (insideBoilerplate[i] && HELPER_SUPPRESSED_RULES.has(rule.id)) continue;
        const line = lines[i];
        if (rule.pattern.test(line)) {
          const snippet = line.trim().slice(0, 120);
          violations.push({ category, rule: rule.id, line: i + 1, snippet });
          log(`[lint] WARN [${rule.id}] in ${category}.spec.js line ${i + 1}: ${rule.message}\n  ${snippet}`);
        }
      }

      // Also test multiline patterns against the full content
      // (some rules like CT6_NULL span two lines — the line-by-line scan won't catch them
      //  with the newline in the pattern, so we do a separate full-content test)
      if (rule.pattern.source.includes('\\n')) {
        const fullMatch = content.match(rule.pattern);
        if (fullMatch) {
          // Find approximate line number
          const matchIndex = content.indexOf(fullMatch[0]);
          const lineNum = content.slice(0, matchIndex).split('\n').length;
          const snippet = fullMatch[0].replace(/\n/g, ' ').trim().slice(0, 120);
          // Avoid double-reporting if already caught by line scan
          const alreadyReported = violations.some(
            (v) => v.category === category && v.rule === rule.id && Math.abs(v.line - lineNum) <= 2,
          );
          if (!alreadyReported) {
            violations.push({ category, rule: rule.id, line: lineNum, snippet });
            log(`[lint] WARN [${rule.id}] in ${category}.spec.js line ~${lineNum}: ${rule.message}\n  ${snippet}`);
          }
        }
      }
    }

    // NO_LIVES_ASSERT: scan test bodies only (not boilerplate) for getLives() calls in non-lives games
    if (noLivesRule) {
      for (let i = 0; i < lines.length; i++) {
        // Skip boilerplate (the getLives function definition itself lives here)
        if (insideBoilerplate[i]) continue;
        const line = lines[i];
        if (noLivesRule.pattern.test(line)) {
          const snippet = line.trim().slice(0, 120);
          violations.push({ category, rule: noLivesRule.id, line: i + 1, snippet });
          log(`[lint] WARN [${noLivesRule.id}] in ${category}.spec.js line ${i + 1}: ${noLivesRule.message}\n  ${snippet}`);
        }
      }
    }
  }

  // RULE-DUP: detect data-testid values used in 3+ different category files (cross-file DOM contamination).
  // Two categories referencing the same game element is normal (e.g. answer-input in game-flow AND mechanics).
  // Three or more is a signal that the test LLM invented a generic testid shared by all categories instead of
  // using the exact values from the DOM snapshot.
  const testidPattern = /data-testid=['"]([^'"]+)['"]/g;
  const seenTestIds = new Map(); // testid → Set of category names
  for (const [category, content] of Object.entries(testFiles)) {
    if (!content || typeof content !== 'string') continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let m;
      const re = new RegExp(testidPattern.source, 'g');
      while ((m = re.exec(lines[i])) !== null) {
        const testid = m[1];
        if (!seenTestIds.has(testid)) {
          seenTestIds.set(testid, new Map()); // category → first line number
        }
        const catMap = seenTestIds.get(testid);
        if (!catMap.has(category)) {
          catMap.set(category, i + 1);
        }
      }
    }
  }
  // Testids that intentionally appear in all categories — results screen + end-state checks required by gen prompt
  const RULE_DUP_ALLOWLIST = new Set([
    'btn-restart', 'score-display', 'stars-display', 'lives-display',
    'answer-input', 'result-rounds', 'result-steps', 'result-score', 'result-accuracy',
  ]);

  // Report only testids that appear in 3+ distinct category files
  for (const [testid, catMap] of seenTestIds) {
    if (catMap.size >= 3 && !RULE_DUP_ALLOWLIST.has(testid)) {
      const cats = [...catMap.keys()];
      for (const [category, lineNum] of catMap) {
        const snippet = `data-testid="${testid}" appears in ${catMap.size} category files: ${cats.join(', ')}`;
        violations.push({ category, rule: 'RULE-DUP', line: lineNum, snippet });
        log(
          `[lint] WARN [RULE-DUP] data-testid="${testid}" used in ${catMap.size} categories (${cats.join(', ')}) — likely invented generic testid, not from DOM snapshot`,
        );
      }
    }
  }

  return { violations, warningCount: violations.length };
}

// ─── hasRunnableTestCalls ─────────────────────────────────────────────────────
// Returns true if `content` contains at least one runnable test() call.
// Used by the banned-selector strip guard to detect zero-test spec files.
// Exported for unit testing.
function hasRunnableTestCalls(content) {
  return /^\s*test\s*\(/m.test(content) || /\btest\s*\(/.test(content);
}

// ─── checkCanvasResponsive ────────────────────────────────────────────────────
// Pure assertion function mirroring the page.evaluate() shape used in the
// Playwright boilerplate (injected into generated test files for canvas games).
// Accepts the evaluate() return value and throws on overflow — or returns
// silently when no canvas is present or all canvases fit within the viewport.
//
// Exported for unit testing. The Playwright runtime version (with page.evaluate)
// is emitted inline into the shared boilerplate string for canvas-based games.
//
// @param {{ found: boolean, passed?: boolean, canvasWidths?: Array }} result
//   — shape matches the page.evaluate() return in the boilerplate
function checkCanvasResponsive(result) {
  if (!result.found || result.passed) return; // no canvas, or all fit — skip
  throw new Error(
    `Canvas overflow: ${JSON.stringify(result.canvasWidths)} — canvas must have max-width:100%; height:auto (GEN-CANVAS-001)`
  );
}

module.exports = { generateTests, detectCorruptFallbackContent, lintGeneratedTests, hasRunnableTestCalls, checkCanvasResponsive };
