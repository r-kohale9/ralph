'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline-visual-review.js — Step 3.5: Visual UI/UX Review
//
// Architecture (LLM-generated screenshot tests):
//
// Step 3.5a: LLM generates Playwright screenshot tests
//   Input: HTML source + spec + DOM snapshot + spec metadata
//   Output: _visual-screenshots.spec.js (independent test() blocks)
//
// Step 3.5b: Run screenshot tests via Playwright
//   Output: visual-screenshots/*.png + viewport metadata JSON
//
// Step 3.5c: LLM validates screenshots are correct
//   Input: captured screenshots + expected screenshot list from 3.5a
//   If screenshots are wrong/missing → LLM fixes the test → re-run (max 2 retries)
//
// Step 3.5d: Visual UI/UX review (LLM, vision-capable model)
//   Input: validated screenshots + spec + HTML
//   Output: APPROVED or NEEDS_FIX with issues
//
// Step 3.5e: Fix UI/UX issues (LLM, max 2 iterations)
//   Input: issues + HTML
//   Output: fixed HTML
//
// Key design decisions:
// - Each screenshot is an independent test() with its own page.goto('/') — no cascading failures
// - Shared boilerplate helpers (safeClick, navigateToGameplay, etc.) are hardcoded
// - Only the test() blocks are LLM-generated (from HTML + spec analysis)
// - Validation step catches incorrect screenshots (wrong game state, blank screens, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const MAX_VISUAL_FIX_ITERATIONS = 3;
const MAX_SCREENSHOT_FIX_ITERATIONS = 2;
const SCREENSHOT_TIMEOUT = 240000; // 4 min

// ─── Shared boilerplate for screenshot tests ────────────────────────────────
// This is always injected at the top of the generated spec file. The LLM only
// generates the test() blocks that use these helpers.

const SCREENSHOT_BOILERPLATE = `
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'visual-screenshots');

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers — shared across all independent tests (DO NOT modify)
// ═══════════════════════════════════════════════════════════════════════════════

async function safeClick(page, locator, opts = {}) {
  const maxAttempts = opts.attempts || 3;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await locator.click({ force: true, timeout: opts.timeout || 5000 });
      return true;
    } catch (err) {
      const msg = (err.message || '');
      if (msg.includes('detached') || msg.includes('not stable') || msg.includes('intercept')) {
        await page.waitForTimeout(300);
        continue;
      }
      if (i === maxAttempts - 1) return false;
      await page.waitForTimeout(300);
    }
  }
  return false;
}

async function dismissPopups(page) {
  try {
    const okayBtn = page.locator('button:has-text("Okay!")');
    if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await safeClick(page, okayBtn);
      await page.waitForTimeout(300);
    }
  } catch { /* best-effort */ }
}

async function waitForReady(page) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await dismissPopups(page);
    const hasTransitionBtn = await page.locator('#mathai-transition-slot button').first()
      .isVisible({ timeout: 300 }).catch(() => false);
    if (hasTransitionBtn) return;
    const hasGameContent = await page.locator('#gameContent').first()
      .isVisible({ timeout: 300 }).catch(() => false);
    if (hasGameContent) return;
    const phase = await page.locator('#app').getAttribute('data-phase').catch(() => null);
    if (phase && phase !== 'loading') return;
    await page.waitForTimeout(500);
  }
  throw new Error('Game did not reach ready state within 60s');
}

async function saveScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function saveFullPageScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function saveViewportMeta(name, data) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, name + '.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function clickThroughTransitions(page, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await dismissPopups(page);
    const btn = page.locator('#mathai-transition-slot button').first();
    const hasBtn = await btn.isVisible({ timeout: 600 }).catch(() => false);
    if (!hasBtn) break;
    const clicked = await safeClick(page, btn);
    if (!clicked) break;
    await page.waitForTimeout(500);
  }
}

async function waitForPlaying(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await dismissPopups(page);
    const phase = await page.locator('#app').getAttribute('data-phase').catch(() => null);
    if (phase === 'playing') return true;
    const hasContent = await page.locator('#gameContent').isVisible({ timeout: 300 }).catch(() => false);
    if (hasContent && phase !== 'transition' && phase !== 'loading') return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function waitForRoundChange(page, fromRound, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentRound = await page.locator('#app').getAttribute('data-round').catch(() => null);
    if (currentRound !== null && currentRound !== String(fromRound)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function checkViewportOverflow(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollHeight = Math.max(body.scrollHeight, html.scrollHeight);
    const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
    return {
      viewportWidth, viewportHeight,
      scrollWidth, scrollHeight,
      overflowX: scrollWidth > viewportWidth + 5,
      overflowY: scrollHeight > viewportHeight + 5,
      canScrollY: body.scrollHeight > viewportHeight || html.scrollHeight > viewportHeight,
      canScrollX: body.scrollWidth > viewportWidth || html.scrollWidth > viewportWidth,
    };
  });
}

async function navigateToGameplay(page) {
  await page.goto('/');
  await waitForReady(page);
  const startBtn = page.locator('#mathai-transition-slot button').first();
  const hasStart = await startBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasStart) {
    await safeClick(page, startBtn);
    await page.waitForTimeout(500);
  }
  await dismissPopups(page);
  await clickThroughTransitions(page);
  await waitForPlaying(page);
}

async function tryInteraction(page, correct = true) {
  const beforeRound = await page.locator('#app').getAttribute('data-round').catch(() => '0');

  // Strategy A: __ralph.answer()
  const strategyA = await page.evaluate((c) => {
    try {
      if (window.__ralph && typeof window.__ralph.answer === 'function') {
        window.__ralph.answer(c);
        return true;
      }
    } catch { /* */ }
    return false;
  }, correct).catch(() => false);

  if (strategyA) {
    await page.waitForTimeout(1500);
    const afterRound = await page.locator('#app').getAttribute('data-round').catch(() => '0');
    if (afterRound !== beforeRound) return true;
    const hasFeedback = await page.locator('[class*="feedback"], [class*="correct"], [class*="wrong"], [class*="result"], .sticker-overlay').first()
      .isVisible({ timeout: 1000 }).catch(() => false);
    if (hasFeedback) return true;
  }

  // Strategy B: Click visible interactive elements
  const interactiveSelectors = [
    '[data-testid*="option"]', '.option-btn', '.option', '.answer-option',
    '.choice-btn', 'button[data-value]', '.options-container button',
    '[data-testid*="cell"]', '.grid-cell', '.card', '.tile', '.cell',
    '#gameContent button', '#gameContent [role="button"]',
  ];
  for (const sel of interactiveSelectors) {
    const els = page.locator(sel);
    const count = await els.count().catch(() => 0);
    if (count >= 2) {
      const idx = correct ? 0 : count - 1;
      await safeClick(page, els.nth(idx));
      await page.waitForTimeout(1500);
      return true;
    }
  }

  // Strategy C: Click any visible button in game area
  const fallbackBtn = page.locator('#gameContent button, .game-area button').first();
  if (await fallbackBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await safeClick(page, fallbackBtn);
    await page.waitForTimeout(1500);
    return true;
  }

  return false;
}

function setupPage(page) {
  page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  page.on('pageerror', () => {});
}
`;

// ─── LLM prompt for generating screenshot test blocks ───────────────────────

function buildScreenshotTestGenPrompt(htmlContent, specContent, specMetadata, domSnapshot) {
  const { interactionType = 'mcq-click', totalRounds = 9, totalLives, starType } = specMetadata || {};

  const domSnapshotBlock = domSnapshot
    ? `\n## DOM Snapshot (runtime state)\n\`\`\`json\n${typeof domSnapshot === 'string' ? domSnapshot : JSON.stringify(domSnapshot, null, 2)}\n\`\`\`\n`
    : '';

  return `You are generating Playwright screenshot test blocks for a MathAI educational game.
Your job is to generate ONLY the test() blocks. The shared boilerplate helpers are already provided above your code.

## Available helpers (already imported — use them directly)
- \`safeClick(page, locator, opts?)\` — retry-safe click
- \`dismissPopups(page)\` — dismiss any "Okay!" popups
- \`waitForReady(page)\` — wait for game to be interactive
- \`saveScreenshot(page, name)\` — saves viewport screenshot to visual-screenshots/<name>.png
- \`saveFullPageScreenshot(page, name)\` — saves full-page screenshot
- \`saveViewportMeta(name, data)\` — saves JSON metadata file
- \`clickThroughTransitions(page, timeoutMs?)\` — clicks through transition buttons
- \`waitForPlaying(page, timeoutMs?)\` — waits for data-phase="playing"
- \`waitForRoundChange(page, fromRound, timeoutMs?)\` — waits for round to change
- \`checkViewportOverflow(page)\` — returns { overflowX, overflowY, scrollWidth, scrollHeight, ... }
- \`navigateToGameplay(page)\` — load page → click through start transitions → wait for playing
- \`tryInteraction(page, correct?)\` — multi-strategy answer attempt (returns true if succeeded)
- \`setupPage(page)\` — adds visibility override + error suppression
- \`test\`, \`expect\` from @playwright/test

## Game Harness API (injected at runtime)
- \`window.__ralph.answer(correct: boolean)\` — trigger a correct/wrong answer
- \`window.__ralph.jumpToRound(roundIndex)\` — jump to a specific round (0-indexed)
- \`window.__ralph.endGame(type)\` — force end game: type = 'victory' | 'game_over'
- \`window.__ralph.getState()\` — returns { round, phase, score, lives, ... }
- \`window.__ralph.syncDOMState()\` — force DOM sync after state change
- \`window.gameState\` — raw game state object

## Game Metadata
- Interaction type: \`${interactionType}\`
- Total rounds: \`${totalRounds}\`
${totalLives !== undefined ? `- Total lives: \`${totalLives === 0 ? 'unlimited' : totalLives}\`` : '- Total lives: unknown'}
${starType ? `- Star scoring type: \`${starType}\`` : ''}
${domSnapshotBlock}

## Game Spec
\`\`\`markdown
${specContent.length > 6000 ? specContent.slice(0, 6000) + '\n... [spec truncated]' : specContent}
\`\`\`

## HTML Source (key sections)
\`\`\`html
${htmlContent.length > 12000 ? htmlContent.slice(0, 12000) + '\n... [HTML truncated]' : htmlContent}
\`\`\`

## Required Screenshots

Generate independent test() blocks to capture screenshots for the following categories. Each test MUST:
1. Call \`setupPage(page)\` first
2. Use its own \`page.goto('/')\` or \`navigateToGameplay(page)\` — no shared state between tests
3. Save screenshots with descriptive names using \`saveScreenshot()\` or \`saveFullPageScreenshot()\`
4. Handle failures gracefully (try/catch) — a failed interaction should still save the screenshot

### Screenshot Categories (generate one test per category):

1. **Start/intro screen** — Capture the game's initial state before any interaction (start screen, intro transition)
2. **Gameplay round 1 (clean)** — Navigate to gameplay, capture round 1 before any interaction. Also run checkViewportOverflow() and save the metadata
3. **Correct answer feedback** — Navigate to gameplay, trigger a correct answer, capture the feedback state
4. **Between-rounds transition + Round 2** — Complete round 1, capture any transition screen, then capture round 2 (verifies attempt reset on level change). Use checkViewportOverflow() on round 2
5. **Wrong answer feedback** — Navigate to gameplay, trigger a wrong answer, capture the feedback state
6. **Later round (layout stress test)** — Jump to a round in the last third of the game (use __ralph.jumpToRound). Capture to verify layout handles more content. Check viewport overflow
7. **Victory/results screen** — Force victory via __ralph.endGame('victory'), click through transitions (but NOT "Play Again"), capture results
8. **Game over screen** — Force game over via __ralph.endGame('game_over'), click through transitions (but NOT "Play Again"), capture
9. **Scroll fallback** — Jump to the last round, check viewport overflow. If overflowing, scroll to bottom and capture, scroll to top and capture
10. **Responsive — larger phone (414×896)** — Resize viewport to 414×896 (page.setViewportSize), navigate to gameplay, capture round 1 and a later round. Check viewport overflow at this size

### Game-specific considerations

Based on the HTML and spec above, look for:
- **Custom interaction patterns**: If the game uses drag-and-drop, grid clicks, text input, or other non-MCQ interactions, adapt the tryInteraction calls or add game-specific DOM interactions
- **Special UI elements**: If the game has unique UI elements (timers, progress bars, special animations), capture them in relevant screenshots
- **Phase transitions**: If the game has learn/recall phases or multi-step rounds, handle the phase transitions properly
- **Content density**: If later rounds have significantly more content (more options, longer questions), ensure the "later round" test jumps far enough to capture this

## Output format

Return ONLY the test() blocks inside a single code block. Do NOT include imports, boilerplate helpers, or test.describe wrappers.

\`\`\`javascript
// Test 1: Start screen
test('screenshot 01 — start screen', async ({ page }) => {
  setupPage(page);
  // ... your code
});

// Test 2: Gameplay round 1
test('screenshot 02 — gameplay round 1 clean', async ({ page }) => {
  setupPage(page);
  // ... your code
});

// ... etc for all 10 categories
\`\`\`

IMPORTANT:
- Name screenshots with numeric prefix for ordering: '01-start-screen', '02-gameplay-round1-clean', etc.
- Each test is INDEPENDENT — if test 3 fails, tests 4-10 must still work
- Use page.evaluate() for any window.__ralph calls
- Wrap risky operations in try/catch — always save a screenshot even if interaction failed
- For "between-rounds transition", the transition may not exist for all games — handle gracefully
- DO NOT use fixed sleep waits > 2000ms — use DOM-state polling helpers instead`;
}

// ─── LLM prompt for validating captured screenshots ─────────────────────────

function buildScreenshotValidationPrompt(screenshots, expectedTests, specContent) {
  const content = [];

  content.push({
    type: 'text',
    text: `You are validating screenshots captured from a MathAI educational game's Playwright tests.

## Expected screenshots
The test was supposed to capture these game states:
${expectedTests.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Actually captured screenshots
${screenshots.length === 0 ? '⚠️ NO SCREENSHOTS WERE CAPTURED' : `${screenshots.length} screenshots captured: ${screenshots.map((s) => s.name).join(', ')}`}

## Task
Review each captured screenshot and answer:
1. Does the screenshot actually show the intended game state? (e.g., "start screen" should show an intro, not gameplay)
2. Are any screenshots blank/white/broken?
3. Are any critical screenshots missing?
4. Did interactions actually trigger? (correct/wrong feedback should look different from clean gameplay)

## Game spec (for reference)
${specContent.length > 3000 ? specContent.slice(0, 3000) + '\n...[truncated]' : specContent}

## Response format
For each screenshot, one line:
- ✅ <name>: <brief description of what it shows>
- ❌ <name>: <what's wrong — e.g., "shows gameplay instead of start screen", "blank white screen">

Then:
MISSING: <list any expected screenshots that weren't captured>

Then:
VERDICT: SCREENSHOTS_VALID — all screenshots show correct game states
or
VERDICT: SCREENSHOTS_INVALID — <brief summary of what's wrong>

FIX_INSTRUCTIONS: <if INVALID, describe what the Playwright test needs to do differently to capture the correct states. Be specific about which test blocks need changes and what DOM interactions/waits are needed>

Screenshots follow:`,
  });

  for (const ss of screenshots) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: ss.base64 },
    });
    content.push({
      type: 'text',
      text: `Screenshot: ${ss.name}`,
    });
  }

  return content;
}

// ─── LLM prompt for fixing screenshot tests ─────────────────────────────────

function buildScreenshotTestFixPrompt(currentTestBlocks, validationFeedback, htmlContent, specContent) {
  return `You are fixing Playwright screenshot tests for a MathAI educational game.

The screenshot validation step found these issues:

${validationFeedback}

## Current test blocks (that need fixing)
\`\`\`javascript
${currentTestBlocks}
\`\`\`

## Available helpers (already imported — use them directly)
- safeClick(page, locator, opts?) — retry-safe click
- dismissPopups(page) — dismiss any "Okay!" popups
- waitForReady(page) — wait for game to be interactive
- saveScreenshot(page, name) — saves viewport screenshot
- saveFullPageScreenshot(page, name) — saves full-page screenshot
- saveViewportMeta(name, data) — saves JSON metadata file
- clickThroughTransitions(page, timeoutMs?) — clicks through transition buttons
- waitForPlaying(page, timeoutMs?) — waits for data-phase="playing"
- waitForRoundChange(page, fromRound, timeoutMs?) — waits for round to change
- checkViewportOverflow(page) — returns overflow measurements
- navigateToGameplay(page) — full navigation from load to playing state
- tryInteraction(page, correct?) — multi-strategy answer attempt
- setupPage(page) — visibility override + error suppression
- test, expect from @playwright/test

## Game harness API
- window.__ralph.answer(correct: boolean)
- window.__ralph.jumpToRound(roundIndex)
- window.__ralph.endGame(type) — 'victory' | 'game_over'
- window.__ralph.getState() — { round, phase, score, lives, ... }
- window.__ralph.syncDOMState()

## HTML Source
\`\`\`html
${htmlContent.length > 8000 ? htmlContent.slice(0, 8000) + '\n... [truncated]' : htmlContent}
\`\`\`

## Spec (for reference)
\`\`\`markdown
${specContent.length > 3000 ? specContent.slice(0, 3000) + '\n...[truncated]' : specContent}
\`\`\`

Fix the test blocks based on the validation feedback. Return ONLY the corrected test() blocks in a code block:

\`\`\`javascript
// Fixed test blocks here
\`\`\`

Rules:
- Keep each test independent (own page.goto, no shared state)
- Fix only the tests that have issues — don't rewrite working ones
- Always call setupPage(page) first
- Handle failures gracefully with try/catch
- Use DOM-state waits (waitForPlaying, waitForRoundChange) instead of fixed sleeps`;
}

// ─── Extract test blocks from LLM output ────────────────────────────────────

function extractTestBlocks(output) {
  let match = output.match(/```javascript\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```js\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /test\s*\(/.test(match[1])) return match[1];

  return null;
}

// ─── Post-process LLM-generated test blocks ─────────────────────────────────

function postProcessTestBlocks(testBlocks) {
  let code = testBlocks;

  // Fix bare describe() → test.describe()
  code = code
    .replace(/(?<![.\w])describe\s*\(/g, 'test.describe(')
    .replace(/(?<![.\w])beforeEach\s*\(/g, 'test.beforeEach(')
    .replace(/(?<![.\w])afterEach\s*\(/g, 'test.afterEach(');

  // Fix slot class vs ID
  code = code.replace(/locator\s*\(\s*['"]\.mathai-transition-slot/g, "locator('#mathai-transition-slot");
  code = code.replace(/locator\s*\(\s*['"]\.mathai-progress-slot/g, "locator('#mathai-progress-slot");

  // Remove any imports the LLM may have added (boilerplate handles these)
  code = code.replace(/^import\s+.*?;\s*$/gm, '');
  code = code.replace(/^const\s+\{.*?\}\s*=\s*require\(.*?\);\s*$/gm, '');

  // Remove any re-declarations of helper functions
  const helperNames = [
    'safeClick',
    'dismissPopups',
    'waitForReady',
    'saveScreenshot',
    'saveFullPageScreenshot',
    'saveViewportMeta',
    'clickThroughTransitions',
    'waitForPlaying',
    'waitForRoundChange',
    'checkViewportOverflow',
    'navigateToGameplay',
    'tryInteraction',
    'setupPage',
  ];
  for (const name of helperNames) {
    // Remove "async function name(" or "function name(" declarations
    const fnRegex = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'g');
    code = code.replace(fnRegex, `// (helper ${name} already defined in boilerplate)`);
  }

  // Remove SCREENSHOT_DIR re-declarations
  code = code.replace(/const\s+SCREENSHOT_DIR\s*=.*?;\s*$/gm, '');

  return code.trim();
}

// ─── Assemble full spec file from boilerplate + test blocks ─────────────────

function assembleSpecFile(testBlocks) {
  return `${SCREENSHOT_BOILERPLATE}\n\n// ═══════════════════════════════════════════════════════════════════════════════\n// LLM-generated screenshot tests (each independent with own page load)\n// ═══════════════════════════════════════════════════════════════════════════════\n\n${testBlocks}\n`;
}

// ─── Write spec file to disk ────────────────────────────────────────────────

function writeSpecFile(gameDir, testBlocks) {
  const testsDir = path.join(gameDir, 'tests');
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });

  const scriptPath = path.join(testsDir, '_visual-screenshots.spec.js');
  const fullScript = assembleSpecFile(testBlocks);
  fs.writeFileSync(scriptPath, fullScript);
  return scriptPath;
}

// ─── Extract expected test descriptions from test blocks ────────────────────

function extractExpectedTests(testBlocks) {
  const tests = [];
  const regex = /test\s*\(\s*['"`](.*?)['"`]/g;
  let m;
  while ((m = regex.exec(testBlocks)) !== null) {
    tests.push(m[1]);
  }
  return tests;
}

// ─── Run screenshot Playwright tests ────────────────────────────────────────

async function runScreenshotTests(gameDir, scriptPath, info, iteration = 0) {
  const screenshotDir = path.join(gameDir, 'visual-screenshots');

  // Archive previous screenshots into an iteration subfolder before clearing
  if (fs.existsSync(screenshotDir)) {
    const prevFiles = fs.readdirSync(screenshotDir).filter(
      (f) => !f.startsWith('iteration-') && (f.endsWith('.png') || f.endsWith('.json')),
    );
    if (prevFiles.length > 0) {
      const archiveDir = path.join(gameDir, 'visual-screenshots', `iteration-${iteration}`);
      fs.mkdirSync(archiveDir, { recursive: true });
      for (const file of prevFiles) {
        fs.copyFileSync(path.join(screenshotDir, file), path.join(archiveDir, file));
        fs.unlinkSync(path.join(screenshotDir, file));
      }
      if (info) {
        info(`[visual-review] Archived ${prevFiles.length} files to visual-screenshots/iteration-${iteration}/`);
      }
    }
  }

  try {
    await execFileAsync(
      'npx',
      ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=list', path.relative(gameDir, scriptPath)],
      { timeout: SCREENSHOT_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
    );
  } catch (err) {
    // Independent tests: some may fail but others capture screenshots — by design
    if (info) info(`[visual-review] Screenshot capture had warnings: ${(err.message || '').slice(0, 200)}`);
  }

  // Collect results
  const screenshots = [];
  const viewportMeta = {};
  if (fs.existsSync(screenshotDir)) {
    const files = fs.readdirSync(screenshotDir).sort();

    for (const file of files.filter((f) => f.endsWith('.png'))) {
      const filePath = path.join(screenshotDir, file);
      const base64 = fs.readFileSync(filePath).toString('base64');
      const name = file.replace('.png', '').replace(/^\d+-/, '');
      screenshots.push({ name, base64 });
    }

    for (const file of files.filter((f) => f.endsWith('.json'))) {
      try {
        const filePath = path.join(screenshotDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const name = file.replace('.json', '');
        viewportMeta[name] = data;
      } catch {
        /* skip malformed JSON */
      }
    }
  }

  return { screenshots, viewportMeta };
}

// ─── Visual review prompt ───────────────────────────────────────────────────

function buildVisualReviewPrompt(screenshots, specContent, htmlContent, viewportMeta = {}) {
  const content = [];

  // Build viewport metadata summary
  let viewportSummary = '';
  if (Object.keys(viewportMeta).length > 0) {
    viewportSummary = '\n\n## Viewport Overflow Measurements (programmatic)\n';
    for (const [key, meta] of Object.entries(viewportMeta)) {
      if (meta.success === false) {
        viewportSummary += `- **${key}**: ⚠️ Interaction may have failed (${meta.interactionType}): ${meta.note}\n`;
        continue;
      }
      if (meta.viewportWidth === undefined) continue;
      const overflowStatus =
        meta.overflowX || meta.overflowY
          ? `⚠️ OVERFLOW DETECTED (scrollW=${meta.scrollWidth} vs viewW=${meta.viewportWidth}, scrollH=${meta.scrollHeight} vs viewH=${meta.viewportHeight})`
          : `✅ No overflow (scrollW=${meta.scrollWidth} vs viewW=${meta.viewportWidth}, scrollH=${meta.scrollHeight} vs viewH=${meta.viewportHeight})`;
      viewportSummary += `- **${key}**: ${overflowStatus}\n`;
      if (meta.scrollTested === true) viewportSummary += `  - Scroll fallback tested: YES\n`;
      if (meta.scrollTested === false)
        viewportSummary += `  - Scroll fallback not tested: ${meta.reason || 'no overflow'}\n`;
    }
  }

  content.push({
    type: 'text',
    text: `You are reviewing the UI/UX of a MathAI educational game running on a mobile viewport (375×667). Below are screenshots captured at different game states.

## Screenshot inventory

The following screenshots were captured. Review each one:

**Preview Screen:**
- \`preview-screen\` — Preview/instruction screen shown before game starts (header bar with avatar, question label, score, star; instruction text; progress bar; skip button)

**Transition Screens:**
- \`start-screen\` — Game intro / start transition
- \`between-rounds-transition\` — Transition shown between rounds (if captured)

**Gameplay (per-round):**
- \`gameplay-round1-clean\` — Round 1 before any interaction
- \`gameplay-round2-attempt-reset\` — Round 2 after completing round 1 (verifies UI resets cleanly)
- \`gameplay-later-round\` — A later round (verifies layout scales with more content)

**Interactions:**
- \`correct-feedback\` — After a correct answer
- \`wrong-feedback\` — After a wrong answer

**End Screens:**
- \`victory-results\` — Victory / results screen
- \`gameover\` — Game over screen

**Responsive (larger phone 414×896):**
- \`responsive-large-phone-round1\` — Round 1 at 414×896 (iPhone 14 Pro Max)
- \`responsive-large-phone-later-round\` — Later round at 414×896

**Overflow (if detected):**
- \`*-fullpage-overflow\` — Full-page capture when content overflows viewport
- \`scroll-fallback-top/bottom\` — Scroll test screenshots
${viewportSummary}

## Review checklist

**MOBILE IS THE #1 PRIORITY.** These games are played on phones. Every issue below is evaluated from a mobile-first perspective.

For EACH screenshot, check:

### Mobile viewport (375×667 — iPhone SE, smallest common phone)
1. **Viewport containment (CRITICAL)**: ALL game content — question text, answer options, score, lives, timer — MUST be fully visible within 375×667 WITHOUT scrolling. If a player needs to scroll to see answers or tap controls, that's a **CRITICAL** blocker
2. **Touch targets (CRITICAL)**: ALL interactive elements (buttons, cards, options, inputs) must be at least **44×44px**. On mobile, fingers are imprecise — tiny targets cause misclicks
3. **Text readability on mobile**: Font sizes must be at least 14px for body text, 18px+ for question/prompt text. Check that text is not too small to read on a phone screen
4. **Finger-friendly spacing**: Interactive elements must have at least 8px gap between them to prevent accidental taps on adjacent items

### Rendering & layout
5. **Rendering issues**: Any blank areas, overlapping elements, cut-off text, broken layout, missing images/icons
6. **Scroll fallback**: If content overflows, verify scroll works (check scroll-fallback screenshots). Overflow is critical, but working scroll is an acceptable mitigation
7. **Attempt reset on level change**: Compare round 1 vs round 2 screenshots. When a new round loads, all interactive elements must be in their default/reset state (no lingering selections, highlights, or feedback from the previous round)
8. **Layout consistency across rounds**: Compare round 1 vs later-round screenshots. More content items should not break the layout (e.g., grid should adapt, cards should not overflow)

### Responsive scaling (375 → 414)
9. **Responsive scaling**: Compare the 375×667 screenshots with the 414×896 ones. The game should scale proportionally — no wasted dead space, no layout breaks, no stretched/squished elements. Content should use available space well at both sizes

### Visual quality
10. **Visual Feedback**: Correct (green) and wrong (red) states are clearly distinguishable
11. **Screen Coverage**: Transition/results/game-over screens cover the full viewport with proper centering
12. **Visual Hierarchy**: Score, lives, prompt/question are prominently displayed — the question should be the most visually prominent element
13. **Readability**: Good contrast ratios (at least 4.5:1 for text)
14. **Consistency**: Colors, fonts, spacing consistent across all screens

### Preview screen (if captured)
15. **Preview layout**: Header bar visible with back button, avatar video (40x40px), question label, score, and star icon
16. **Progress bar**: Timer progress bar spans full width of header and is visible/animating
17. **Instruction text**: Renders correctly, left-aligned, readable on mobile
18. **Skip button**: "Skip & show options" button visible and accessible at bottom

## Response format

For each issue found:

ISSUE: [severity: critical|warning] [brief description]
FIX: [describe the CSS/HTML change needed — be specific about selectors and properties]

Severity guide:
- **critical**: Content overflows 375×667 viewport, scroll needed to play, touch targets < 44px, blank/white screens, cut-off content, controls not visible or unreachable, text too small to read on phone (< 14px), lingering state from previous round, layout breaks at different phone sizes
- **warning**: Minor spacing issues, could-be-better contrast, slight alignment off, small dead space at larger viewport

After all issues:
VERDICT: [APPROVED — no critical issues | NEEDS_FIX — list critical issues that must be fixed]

If there are NO issues:
VERDICT: APPROVED

Screenshots follow:
`,
  });

  for (const ss of screenshots) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: ss.base64 },
    });
    content.push({
      type: 'text',
      text: `Screenshot: ${ss.name}`,
    });
  }

  const specExcerpt = specContent.length > 8000 ? specContent.slice(0, 8000) + '\n... [spec truncated]' : specContent;

  content.push({
    type: 'text',
    text: `\n--- GAME SPEC (for reference) ---\n${specExcerpt}\n\n--- HTML CODE ---\n${htmlContent}`,
  });

  return content;
}

function buildVisualFixPrompt(reviewFeedback, htmlContent, specContent, specMetadata, viewportMeta) {
  const { interactionType, totalRounds, totalLives, starType } = specMetadata || {};

  // Build viewport overflow summary for the fix prompt
  let viewportBlock = '';
  if (viewportMeta && Object.keys(viewportMeta).length > 0) {
    const overflowEntries = [];
    for (const [key, meta] of Object.entries(viewportMeta)) {
      if (meta.viewportWidth === undefined) continue;
      if (meta.overflowX || meta.overflowY) {
        overflowEntries.push(
          `- ${key}: scrollW=${meta.scrollWidth} vs viewW=${meta.viewportWidth}, scrollH=${meta.scrollHeight} vs viewH=${meta.viewportHeight}`,
        );
      }
    }
    if (overflowEntries.length > 0) {
      viewportBlock = `\n## Measured viewport overflow\nThese measurements were taken programmatically — they are facts, not estimates:\n${overflowEntries.join('\n')}\n`;
    }
  }

  const specExcerpt = specContent
    ? specContent.length > 6000
      ? specContent.slice(0, 6000) + '\n... [spec truncated]'
      : specContent
    : '';

  return `You are fixing UI/UX issues in a MathAI educational game HTML file.
This game runs on **mobile phones** — the primary viewport is **375×667** (iPhone SE).

## Game metadata
- Interaction type: ${interactionType || 'unknown'}
- Total rounds: ${totalRounds || 'unknown'}
${totalLives !== undefined ? `- Lives: ${totalLives === 0 ? 'unlimited' : totalLives}` : ''}
${starType ? `- Star scoring: ${starType}` : ''}

## Visual review found these issues

${reviewFeedback}
${viewportBlock}

## Mobile-first design constraints (MUST follow)

1. **Viewport containment**: ALL game content MUST fit within 375×667 WITHOUT scrolling. This means:
   - Use \`max-height: 100vh\` or \`height: 100dvh\` on the game container
   - Use \`overflow: hidden\` on body/html (with \`overflow-y: auto\` as scroll fallback)
   - Use relative units (%, vh, vw) instead of fixed px for layout dimensions
   - Use \`box-sizing: border-box\` everywhere

2. **Touch targets**: ALL buttons, options, cards must be at least **44×44px** with **8px** gap between them
   - \`min-height: 44px; min-width: 44px; padding: 10px 16px;\`

3. **Text readability**: Body text ≥ 14px, question/prompt text ≥ 18px
   - Use \`clamp()\` for responsive font sizes: \`font-size: clamp(14px, 3.5vw, 18px)\`

4. **Flex/grid layout**: Use flexbox with \`flex-shrink\` to allow elements to compress rather than overflow
   - Options grid: \`display: grid; grid-template-columns: 1fr 1fr; gap: 8px;\`
   - Stack layout: \`display: flex; flex-direction: column; gap: 8px; max-height: 100vh;\`

5. **Responsive scaling**: Use \`vw\`/\`vh\`/\`%\` units so the game scales from 375px to 414px+ without breaking

${specExcerpt ? `## Game spec (for reference)\n\`\`\`markdown\n${specExcerpt}\n\`\`\`\n` : ''}

## Rules
- Only modify CSS styles and HTML structure — do NOT change game logic or JavaScript behavior
- Preserve all data-testid attributes exactly as-is
- Preserve all window.__ralph harness code exactly as-is
- Preserve all CDN script tags exactly as-is
- Do not remove any existing functionality
- When fixing overflow: prefer shrinking/reflowing content over adding scroll. Scroll is a last-resort fallback

Fix ALL the issues listed above. Return the COMPLETE corrected HTML file wrapped in:
\`\`\`html
... full HTML here ...
\`\`\`

Current HTML:
${htmlContent}`;
}

/**
 * Parse the visual review response to extract verdict and issues.
 */
function parseVisualReview(response) {
  const verdictMatch = response.match(/VERDICT:\s*(APPROVED|NEEDS_FIX)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'APPROVED';

  const issues = [];
  // Match ISSUE + optional FIX pairs
  const pairRegex = /ISSUE:\s*\[?(critical|warning)\]?\s*(.+?)(?:\nFIX:\s*(.+?))?(?=\nISSUE:|\nVERDICT:|$)/gis;
  let match;
  while ((match = pairRegex.exec(response)) !== null) {
    issues.push({
      severity: match[1].toLowerCase(),
      description: match[2].trim(),
      fix: match[3] ? match[3].trim() : '',
    });
  }

  return { verdict, issues, rawResponse: response };
}

/**
 * Parse screenshot validation response.
 */
function parseScreenshotValidation(response) {
  const verdictMatch = response.match(/VERDICT:\s*(SCREENSHOTS_VALID|SCREENSHOTS_INVALID)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'SCREENSHOTS_VALID';

  const fixInstructions = response.match(/FIX_INSTRUCTIONS:\s*([\s\S]*?)(?=$)/i);

  return {
    verdict,
    fixInstructions: fixInstructions ? fixInstructions[1].trim() : '',
    rawResponse: response,
  };
}

// ─── Main visual review function ────────────────────────────────────────────

/**
 * Runs the visual UI/UX review step with LLM-generated screenshot tests.
 *
 * @param {object} opts
 * @param {string} opts.gameDir - Path to game build directory
 * @param {string} opts.htmlFile - Path to index.html
 * @param {string} opts.specContent - Game spec markdown content
 * @param {object} [opts.specMetadata] - Spec metadata (interactionType, totalRounds, etc.)
 * @param {object} [opts.domSnapshot] - DOM snapshot from Step 2.5 (optional)
 * @param {Function} opts.trackedLlmCall - LLM call function with cost tracking
 * @param {string} opts.model - Vision-capable model to use
 * @param {Function} opts.info - Logger
 * @param {Function} opts.warn - Logger
 * @param {Function} opts.progress - Progress callback
 * @param {object} opts.report - Pipeline report object
 * @param {Function} opts.extractHtml - HTML extraction function
 * @param {Function} opts.injectHarnessToFile - Harness injection function
 * @param {string} opts.gameId - Game identifier
 * @returns {object} { verdict, issues, iterations }
 */
async function runVisualReview(opts) {
  const {
    gameDir,
    htmlFile,
    specContent,
    specMetadata,
    domSnapshot,
    trackedLlmCall,
    model,
    info,
    warn,
    progress,
    report,
    extractHtml,
    injectHarnessToFile,
    gameId,
  } = opts;

  info('[pipeline] Step 3.5: Visual UI/UX Review (LLM-generated screenshot tests)');
  if (specMetadata) {
    info(
      `[visual-review] Spec metadata: interaction=${specMetadata.interactionType}, rounds=${specMetadata.totalRounds}`,
    );
  }
  progress('visual-review', { gameId, model });

  // ══════════════════════════════════════════════════════════════════════════
  // Step 3.5a: LLM generates screenshot Playwright tests
  // ══════════════════════════════════════════════════════════════════════════

  info('[visual-review] Step 3.5a: Generating screenshot tests via LLM...');
  progress('visual-review-testgen', { gameId });

  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

  // Load DOM snapshot from Step 2.5 if not provided directly
  let resolvedDomSnapshot = domSnapshot;
  if (!resolvedDomSnapshot) {
    const snapPath = path.join(gameDir, 'tests', 'dom-snapshot.json');
    if (fs.existsSync(snapPath)) {
      try {
        resolvedDomSnapshot = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
        info('[visual-review] Loaded DOM snapshot from tests/dom-snapshot.json');
      } catch {
        /* skip */
      }
    }
  }

  const testGenPrompt = buildScreenshotTestGenPrompt(htmlContent, specContent, specMetadata, resolvedDomSnapshot);

  let testBlocks;
  try {
    const testGenResponse = await trackedLlmCall(
      'visual-screenshot-testgen',
      testGenPrompt,
      model,
      { maxTokens: 64000 },
      report,
    );

    testBlocks = extractTestBlocks(testGenResponse);
    if (!testBlocks) {
      warn('[visual-review] Could not extract test blocks from LLM response — falling back to minimal tests');
      testBlocks = buildFallbackTestBlocks(specMetadata);
    } else {
      testBlocks = postProcessTestBlocks(testBlocks);
    }
  } catch (err) {
    warn(`[visual-review] Screenshot test generation failed: ${err.message} — using fallback tests`);
    testBlocks = buildFallbackTestBlocks(specMetadata);
  }

  const expectedTests = extractExpectedTests(testBlocks);
  info(`[visual-review] Generated ${expectedTests.length} screenshot tests: ${expectedTests.join(', ')}`);

  // ══════════════════════════════════════════════════════════════════════════
  // Step 3.5b + 3.5c: Run tests → validate screenshots → fix loop
  // ══════════════════════════════════════════════════════════════════════════

  let screenshots = [];
  let viewportMeta = {};
  let scriptPath;
  let currentTestBlocks = testBlocks;

  for (let fixIter = 0; fixIter <= MAX_SCREENSHOT_FIX_ITERATIONS; fixIter++) {
    // ── 3.5b: Run screenshot tests ────────────────────────────────────────
    info(`[visual-review] Step 3.5b: Running screenshot tests (attempt ${fixIter + 1})...`);
    progress('visual-review-capture', { gameId, attempt: fixIter + 1 });

    scriptPath = writeSpecFile(gameDir, currentTestBlocks);
    const result = await runScreenshotTests(gameDir, scriptPath, info, fixIter);
    screenshots = result.screenshots;
    viewportMeta = result.viewportMeta;

    if (screenshots.length === 0) {
      warn('[visual-review] No screenshots captured — skipping visual review');
      cleanupSpecFile(scriptPath);
      return { verdict: 'SKIPPED', issues: [], iterations: 0 };
    }

    info(`[visual-review] Captured ${screenshots.length} screenshots: ${screenshots.map((s) => s.name).join(', ')}`);

    // ── 3.5c: Validate screenshots ────────────────────────────────────────
    // Skip validation on last iteration (no more chances to fix)
    if (fixIter >= MAX_SCREENSHOT_FIX_ITERATIONS) {
      info('[visual-review] Max screenshot fix iterations reached — proceeding with current screenshots');
      break;
    }

    info('[visual-review] Step 3.5c: Validating screenshots via LLM...');
    progress('visual-review-validate', { gameId, attempt: fixIter + 1 });

    const validationContent = buildScreenshotValidationPrompt(screenshots, expectedTests, specContent);

    let validationResponse;
    try {
      validationResponse = await trackedLlmCall(
        `visual-screenshot-validate-${fixIter}`,
        validationContent,
        model,
        { maxTokens: 4000 },
        report,
      );
    } catch (err) {
      warn(`[visual-review] Screenshot validation failed: ${err.message} — proceeding with current screenshots`);
      break;
    }

    const validation = parseScreenshotValidation(validationResponse);
    info(`[visual-review] Screenshot validation: ${validation.verdict}`);

    if (validation.verdict === 'SCREENSHOTS_VALID') {
      info('[visual-review] Screenshots validated — proceeding to UI/UX review');
      break;
    }

    // ── Fix the tests ──────────────────────────────────────────────────────
    info(`[visual-review] Screenshots invalid — fixing tests (iteration ${fixIter + 1})...`);
    progress('visual-review-testfix', { gameId, iteration: fixIter + 1 });

    const currentHtmlContent = fs.readFileSync(htmlFile, 'utf-8');
    const fixPrompt = buildScreenshotTestFixPrompt(
      currentTestBlocks,
      validation.rawResponse,
      currentHtmlContent,
      specContent,
    );

    let fixResponse;
    try {
      fixResponse = await trackedLlmCall(
        `visual-screenshot-testfix-${fixIter}`,
        fixPrompt,
        model,
        { maxTokens: 64000 },
        report,
      );
    } catch (err) {
      warn(`[visual-review] Screenshot test fix failed: ${err.message} — proceeding with current screenshots`);
      break;
    }

    const fixedBlocks = extractTestBlocks(fixResponse);
    if (!fixedBlocks) {
      warn('[visual-review] Could not extract fixed test blocks — proceeding with current screenshots');
      break;
    }

    currentTestBlocks = postProcessTestBlocks(fixedBlocks);
    info('[visual-review] Test blocks updated — re-running screenshot capture');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Step 3.5d + 3.5e: Visual UI/UX review + fix loop (existing logic)
  // ══════════════════════════════════════════════════════════════════════════

  let lastVerdict = 'APPROVED';
  let allIssues = [];
  let uiFixIteration = 0;

  for (uiFixIteration = 0; uiFixIteration < MAX_VISUAL_FIX_ITERATIONS + 1; uiFixIteration++) {
    // On subsequent iterations, re-capture screenshots with the fixed HTML
    if (uiFixIteration > 0) {
      info(`[visual-review] Re-capturing screenshots after UI fix (iteration ${uiFixIteration})...`);
      // Use offset iteration number: screenshot fix iterations + current UI fix iteration
      const iterNum = MAX_SCREENSHOT_FIX_ITERATIONS + 1 + uiFixIteration;
      const result = await runScreenshotTests(gameDir, scriptPath, info, iterNum);
      screenshots = result.screenshots;
      viewportMeta = result.viewportMeta;

      if (screenshots.length === 0) {
        warn('[visual-review] No screenshots after fix — stopping');
        break;
      }
      info(`[visual-review] Re-captured ${screenshots.length} screenshots`);
    }

    // ── 3.5d: Visual UI/UX review ─────────────────────────────────────────
    info(`[visual-review] Step 3.5d: Visual UI/UX review (iteration ${uiFixIteration})...`);
    progress('visual-review-review', { gameId, iteration: uiFixIteration });

    const currentHtmlContent = fs.readFileSync(htmlFile, 'utf-8');
    const reviewContent = buildVisualReviewPrompt(screenshots, specContent, currentHtmlContent, viewportMeta);

    let reviewResponse;
    try {
      reviewResponse = await trackedLlmCall(
        `visual-review-${uiFixIteration}`,
        reviewContent,
        model,
        { maxTokens: 64000 },
        report,
      );
    } catch (err) {
      warn(`[visual-review] LLM review call failed: ${err.message} — skipping visual review`);
      cleanupSpecFile(scriptPath);
      return { verdict: 'SKIPPED', issues: [], iterations: uiFixIteration };
    }

    const parsed = parseVisualReview(reviewResponse);
    lastVerdict = parsed.verdict;
    allIssues = parsed.issues;

    info(
      `[visual-review] Verdict: ${parsed.verdict} | Issues: ${parsed.issues.length} (${parsed.issues.filter((i) => i.severity === 'critical').length} critical)`,
    );

    for (const issue of parsed.issues) {
      const prefix = issue.severity === 'critical' ? '🔴' : '⚠️';
      info(`[visual-review]   ${prefix} ${issue.description}`);
    }

    // ── If approved or no more iterations, stop ──────────────────────────
    if (parsed.verdict === 'APPROVED') {
      info('[visual-review] APPROVED — no critical UI/UX issues');
      break;
    }

    if (uiFixIteration >= MAX_VISUAL_FIX_ITERATIONS) {
      warn(
        `[visual-review] Max UI fix iterations (${MAX_VISUAL_FIX_ITERATIONS}) reached — proceeding with current state`,
      );
      break;
    }

    // ── 3.5e: Fix the UI/UX issues ──────────────────────────────────────
    info(`[visual-review] Step 3.5e: Fixing ${parsed.issues.length} UI/UX issues (iteration ${uiFixIteration + 1})...`);
    progress('visual-fix', { gameId, iteration: uiFixIteration + 1, issues: parsed.issues.length });

    const fixHtmlContent = fs.readFileSync(htmlFile, 'utf-8');
    const fixPrompt = buildVisualFixPrompt(reviewResponse, fixHtmlContent, specContent, specMetadata, viewportMeta);

    let fixResponse;
    try {
      fixResponse = await trackedLlmCall(
        `visual-fix-${uiFixIteration + 1}`,
        fixPrompt,
        model,
        { maxTokens: 128000 },
        report,
      );
    } catch (err) {
      warn(`[visual-review] Fix LLM call failed: ${err.message} — proceeding with current state`);
      break;
    }

    const fixedHtml = extractHtml(fixResponse);
    if (!fixedHtml) {
      warn('[visual-review] Could not extract HTML from fix response — proceeding with current state');
      break;
    }

    // Size guard: reject if fix shrank HTML by more than 20%
    const origSize = fixHtmlContent.length;
    const fixedSize = fixedHtml.length;
    if (fixedSize < origSize * 0.8) {
      warn(`[visual-review] Fix shrank HTML by ${Math.round((1 - fixedSize / origSize) * 100)}% — rejecting fix`);
      break;
    }

    fs.writeFileSync(htmlFile, fixedHtml + '\n');

    // Re-inject harness after modifying HTML
    if (injectHarnessToFile) {
      try {
        injectHarnessToFile(htmlFile);
      } catch (e) {
        warn(`[visual-review] Harness re-injection failed: ${e.message}`);
      }
    }

    info(`[visual-review] Fix applied (${origSize} → ${fixedSize} bytes)`);
  }

  // Cleanup
  cleanupSpecFile(scriptPath);

  // Store results in report
  report.visual_review = {
    verdict: lastVerdict,
    issues_count: allIssues.length,
    critical_count: allIssues.filter((i) => i.severity === 'critical').length,
    iterations: uiFixIteration,
    model,
  };

  return {
    verdict: lastVerdict,
    issues: allIssues,
    iterations: uiFixIteration,
  };
}

// ─── Fallback test blocks (used when LLM generation fails) ──────────────────
// Minimal hardcoded tests to ensure we always get some screenshots.

function buildFallbackTestBlocks(specMetadata = {}) {
  const totalRounds = specMetadata?.totalRounds || 9;

  return `// Fallback: minimal screenshot tests (LLM generation failed)

test('screenshot 01 — start screen', async ({ page }) => {
  setupPage(page);
  await page.goto('/');
  await waitForReady(page);
  await saveScreenshot(page, '01-start-screen');
});

test('screenshot 02 — gameplay round 1 clean', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  await saveScreenshot(page, '02-gameplay-round1-clean');
  const overflow = await checkViewportOverflow(page);
  saveViewportMeta('viewport-round1', overflow);
});

test('screenshot 03 — correct answer feedback', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  await tryInteraction(page, true);
  await saveScreenshot(page, '03-correct-feedback');
});

test('screenshot 04 — wrong answer feedback', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  await tryInteraction(page, false);
  await saveScreenshot(page, '04-wrong-feedback');
});

test('screenshot 05 — later round', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  const targetRound = Math.max(2, Math.floor(${totalRounds} * 0.7));
  await page.evaluate((r) => window.__ralph?.jumpToRound?.(r), targetRound);
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await clickThroughTransitions(page);
  await waitForPlaying(page, 8000);
  await saveScreenshot(page, '05-gameplay-later-round');
  const overflow = await checkViewportOverflow(page);
  saveViewportMeta('viewport-later-round', overflow);
});

test('screenshot 06 — victory results', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  await page.evaluate(() => {
    if (window.__ralph?.endGame) window.__ralph.endGame('victory');
    else if (window.endGame) window.endGame('victory');
  });
  await page.evaluate(() => window.__ralph?.syncDOMState?.());
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const btn = page.locator('#mathai-transition-slot button').first();
    const hasBtn = await btn.isVisible({ timeout: 500 }).catch(() => false);
    if (!hasBtn) break;
    const btnText = await btn.textContent().catch(() => '');
    if (/play again|restart|try again/i.test(btnText)) break;
    await safeClick(page, btn);
    await page.waitForTimeout(500);
  }
  await saveScreenshot(page, '06-victory-results');
});

test('screenshot 07 — game over', async ({ page }) => {
  setupPage(page);
  await navigateToGameplay(page);
  await page.evaluate(() => {
    if (window.__ralph?.endGame) window.__ralph.endGame('game_over');
    else if (window.endGame) window.endGame('game_over');
  });
  await page.evaluate(() => window.__ralph?.syncDOMState?.());
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const btn = page.locator('#mathai-transition-slot button').first();
    const hasBtn = await btn.isVisible({ timeout: 500 }).catch(() => false);
    if (!hasBtn) break;
    const btnText = await btn.textContent().catch(() => '');
    if (/play again|restart|try again/i.test(btnText)) break;
    await safeClick(page, btn);
    await page.waitForTimeout(500);
  }
  await saveScreenshot(page, '07-gameover');
});

test('screenshot 08 — responsive large phone', async ({ page }) => {
  setupPage(page);
  await page.setViewportSize({ width: 414, height: 896 });
  await navigateToGameplay(page);
  await saveScreenshot(page, '08-responsive-large-phone');
  const overflow = await checkViewportOverflow(page);
  saveViewportMeta('viewport-large-phone', overflow);
});`;
}

// ─── Cleanup helper ─────────────────────────────────────────────────────────

function cleanupSpecFile(scriptPath) {
  try {
    if (scriptPath) fs.unlinkSync(scriptPath);
  } catch {
    /* */
  }
}

module.exports = { runVisualReview };
