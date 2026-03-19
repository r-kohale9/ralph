#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// scripts/test-gen.js — Targeted test generation validation
//
// Exercises Steps 2.5 (DOM snapshot) and 2b (categorized spec generation)
// in isolation, keeping HTML and test-cases.json constant.
//
// Usage:
//   node scripts/test-gen.js [gameDir] [--step=snapshot|context|cases|tests|all] [--category=<name>]
//
// Examples:
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=snapshot
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=context
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=all
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=tests --category=game-flow
//
// Steps:
//   snapshot  — Run DOM snapshot only (no LLM needed)
//   context   — Extract runtime test context: screen texts, gameState API, timer API, lives format
//   cases     — Generate test-cases.json from spec (needs LLM proxy)
//   tests     — Generate category spec files from existing test-cases.json (needs LLM proxy)
//   all       — Run all steps in sequence
// ─────────────────────────────────────────────────────────────────────────────

try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch { /* dotenv optional */ }

const fs = require('fs');
const path = require('path');

const gameDir = process.argv[2] || 'warehouse/templates/adjustment-strategy/game';
const stepArg = (process.argv.find((a) => a.startsWith('--step=')) || '--step=all').replace('--step=', '');
// --category=game-flow  (only generate that one category in step=tests)
const categoryArg = (process.argv.find((a) => a.startsWith('--category=')) || '').replace('--category=', '') || null;

const absGameDir = path.resolve(gameDir);
const gameId = path.basename(absGameDir);
const testsDir = path.join(absGameDir, 'tests');
const htmlFile = path.join(absGameDir, 'index.html');
const testCasesFile = path.join(testsDir, 'test-cases.json');
const transitionSlotId = 'mathai-transition-slot';

// Spec can be alongside gameDir (warehouse/templates/<id>/spec.md)
// or derived from RALPH_REPO_DIR warehouse path (data/games/<id> → warehouse/templates/<id>/spec.md)
const REPO_DIR = process.env.RALPH_REPO_DIR || '.';
const specFile =
  fs.existsSync(path.join(absGameDir, '..', 'spec.md'))
    ? path.join(absGameDir, '..', 'spec.md')
    : path.join(path.resolve(REPO_DIR), 'warehouse', 'templates', gameId, 'spec.md');

// ─── Helpers ────────────────────────────────────────────────────────────────

const { callLlm } = require('../lib/llm');

function log(msg) {
  console.log(`[test-gen] ${msg}`);
}

function extractTests(output) {
  let match = output.match(/```javascript\n([\s\S]*?)\n```/);
  if (match) return match[1];
  match = output.match(/```js\n([\s\S]*?)\n```/);
  if (match) return match[1];
  return null;
}

// ─── Step 2.5: DOM snapshot ──────────────────────────────────────────────────

async function runSnapshot() {
  log('=== Step 2.5: DOM Snapshot ===');

  if (!fs.existsSync(htmlFile)) {
    log(`ERROR: ${htmlFile} not found`);
    process.exit(1);
  }

    const { chromium } = require('@playwright/test');
  const { spawn } = require('child_process');

  const SNAPSHOT_PORT = 8786;
  log(`Starting serve on port ${SNAPSHOT_PORT}...`);

  const server = spawn('npx', ['-y', 'serve', absGameDir, '-l', String(SNAPSHOT_PORT), '-s', '--no-clipboard'], {
    stdio: 'ignore',
    detached: false,
  });

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    const page = await context.newPage();

    log(`Navigating to http://localhost:${SNAPSHOT_PORT}`);
    await page.goto(`http://localhost:${SNAPSHOT_PORT}`);

    // Dismiss audio popup
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
      await okayBtn.click();
      await page.waitForTimeout(300);
      log('Dismissed FeedbackManager audio popup');
    } catch {
      log('No audio popup (or already dismissed)');
    }

    // Wait for game init
    log(`Waiting for #${transitionSlotId} button...`);
    // eslint-disable-next-line no-undef
    await page.waitForFunction((slotId) => document.getElementById(slotId)?.querySelector('button') !== null, transitionSlotId, {
      timeout: 20000,
    });

    // eslint-disable-next-line no-undef
    const extractDom = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[id]')).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.id,
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList).join(' '),
            // eslint-disable-next-line no-undef
            visible: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none',
            text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80),
          };
        }),
      );

    const startDom = await extractDom();
    const visibleStart = startDom.filter((e) => e.id && e.visible);
    log(`Start screen: ${visibleStart.length} visible elements with IDs`);
    visibleStart.forEach((e) => console.log(`  #${e.id} [${e.tag}]${e.classes ? ` .${e.classes}` : ''}: "${e.text}"`));

    // Navigate to game screen
    log('\nClicking through to game screen...');
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(600);
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
    } catch { /* ignore */ }
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(1000);

    const gameDom = await extractDom();
    const visibleGame = gameDom.filter((e) => e.id && e.visible);
    log(`Game screen: ${visibleGame.length} visible elements with IDs`);
    visibleGame.forEach((e) => console.log(`  #${e.id} [${e.tag}]${e.classes ? ` .${e.classes}` : ''}: "${e.text}"`));

    // Save snapshot
    fs.mkdirSync(testsDir, { recursive: true });
    const snapshot = { startScreen: visibleStart, gameScreen: visibleGame, capturedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(testsDir, 'dom-snapshot.json'), JSON.stringify(snapshot, null, 2));
    log(`\nSaved dom-snapshot.json (${visibleStart.length} start + ${visibleGame.length} game elements)`);

    await browser.close();
  } finally {
    server.kill();
  }
}

// ─── Step 2.4: Extract runtime test context ───────────────────────────────────

async function runExtractContext() {
  log('=== Step 2.4: Extract Runtime Test Context ===');

  if (!fs.existsSync(htmlFile)) {
    log(`ERROR: ${htmlFile} not found`);
    process.exit(1);
  }

  const { chromium } = require('@playwright/test');
  const { spawn } = require('child_process');

  const CONTEXT_PORT = 8787;
  log(`Starting serve on port ${CONTEXT_PORT}...`);

  const server = spawn('npx', ['-y', 'serve', absGameDir, '-l', String(CONTEXT_PORT), '-s', '--no-clipboard'], {
    stdio: 'ignore',
    detached: false,
  });

  await new Promise((r) => setTimeout(r, 2500));

  const ctx = {
    screens: {},
    gameStateKeys: [],
    timerKeys: [],
    livesFormat: { full: null, empty: null, one: null, two: null, three: null },
    roundsFormat: { zero: null, one: null },
    gameFlow: {},
  };

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    const page = await context.newPage();

    await page.goto(`http://localhost:${CONTEXT_PORT}`);

    // Dismiss audio popup
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
      await okayBtn.click();
      await page.waitForTimeout(300);
    } catch { /* no popup */ }

    // Wait for game init
    // eslint-disable-next-line no-undef
    await page.waitForFunction((slotId) => document.getElementById(slotId)?.querySelector('button') !== null, transitionSlotId, { timeout: 20000 });

    // Capture start screen transition text
    const captureTransition = async (label) => {
      const title = await page.locator('#transitionTitle').textContent().catch(() => null);
      const subtitle = await page.locator('#transitionSubtitle').textContent().catch(() => null);
      const button = await page.locator(`#${transitionSlotId} button`).first().textContent().catch(() => null);
      ctx.screens[label] = { title, subtitle, button };
      log(`  [${label}] title="${title}" subtitle="${subtitle}" button="${button}"`);
    };

    await captureTransition('start');

    // Capture gameState API (before clicking anything)
    // eslint-disable-next-line no-undef
    ctx.gameStateKeys = await page.evaluate(() => typeof window.gameState === 'object' ? Object.keys(window.gameState) : []);
    log(`  gameState keys: ${ctx.gameStateKeys.join(', ')}`);

    // eslint-disable-next-line no-undef
    ctx.timerKeys = await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      if (typeof window.timer === 'object' && window.timer !== null) return Object.keys(window.timer).filter((k) => typeof window.timer[k] !== 'function').concat(Object.getOwnPropertyNames(Object.getPrototypeOf(window.timer) || {}).filter((k) => k !== 'constructor' && typeof window.timer[k] === 'function'));
      return [];
    });
    log(`  timer API: ${ctx.timerKeys.join(', ')}`);

    // Capture initial lives and rounds display format
    ctx.livesFormat.three = await page.locator('#mathai-progress-slot .mathai-lives-display').textContent().catch(() => null);
    ctx.roundsFormat.zero = await page.locator('#mathai-progress-slot .mathai-progress-text').textContent().catch(() => null);
    log(`  lives (3): "${ctx.livesFormat.three}"`);
    log(`  rounds (0): "${ctx.roundsFormat.zero}"`);

    // Click through to Level 1 transition
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(500);
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) { await okayBtn.click(); await page.waitForTimeout(300); }
    } catch { /* ignore */ }
    await captureTransition('level1');

    // Click through to game screen
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(500);
    // Generic check: wait for transition slot to be hidden (game screen is active)
    // eslint-disable-next-line no-undef
    await page.waitForFunction((slotId) => { const s = document.getElementById(slotId); return s && getComputedStyle(s).display === 'none'; }, transitionSlotId, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);

    // Capture game content (generic — extracts whatever the game stores in gameState.content)
    // eslint-disable-next-line no-undef
    const gameContent = await page.evaluate(() => window.gameState?.content || null).catch(() => null);
    if (gameContent) {
      fs.writeFileSync(path.join(testsDir, 'game-content.json'), JSON.stringify(gameContent, null, 2));
      log(`  Saved game-content.json (${JSON.stringify(gameContent).length} bytes)`);
    }

    // Submit wrong answer to see lives decrement
    await page.locator('#answer-input').fill('1');
    await page.locator('#btn-check').click();
    await page.waitForTimeout(2000); // wait for feedback
    ctx.livesFormat.two = await page.locator('#mathai-progress-slot .mathai-lives-display').textContent().catch(() => null);
    log(`  lives after 1 wrong: "${ctx.livesFormat.two}"`);

    // Derive empty heart character
    if (ctx.livesFormat.three && ctx.livesFormat.two) {
      const threeChars = [...ctx.livesFormat.three];
      const twoChars = [...ctx.livesFormat.two];
      // Find chars in two not in three (empty heart is an addition) or just show the diff
      ctx.livesFormat.emptyHeart = twoChars.find((c) => !threeChars.includes(c)) || null;
      ctx.livesFormat.fullHeart = threeChars.find((c) => !twoChars.includes(c) || twoChars.filter((x) => x === c).length < threeChars.filter((x) => x === c).length) || null;
      log(`  full heart: "${ctx.livesFormat.fullHeart}"  empty heart: "${ctx.livesFormat.emptyHeart}"`);
    }

    // Capture rounds format (wait a bit longer for ProgressBar to render)
    await page.waitForTimeout(500);
    ctx.roundsFormat.zero = await page.locator('#mathai-progress-slot .mathai-progress-text').textContent().catch(() => null);
    log(`  rounds (0): "${ctx.roundsFormat.zero}"`);

    // Navigate to Level 2 transition by submitting 2 more wrong + 3 correct answers
    // (1 wrong already done; submit 2 correct for round 1 and 2, then round 3 correct triggers L2)
    // eslint-disable-next-line no-undef
    const fallbackAnswers = [80, 42, 81, 120, 112, 122, 134, 152, 142]; // correctAnswer values
    // First, submit 2 more correct answers (rounds 1-2, we already used round 0 for wrong answer)
    // Actually: we submitted wrong for round 0 — it's still round 0 (wrong doesn't advance round)
    // Submit correct for rounds 0, 1, 2 to trigger Level 2 transition
    for (let i = 0; i < 3; i++) {
      await page.locator('#answer-input').fill(String(fallbackAnswers[i]));
      await page.locator('#btn-check').click();
      // eslint-disable-next-line no-undef
      await page.waitForFunction(() => !window.gameState.isProcessing, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    // Check if Level 2 transition appeared
    try {
      await page.waitForFunction(
        // eslint-disable-next-line no-undef
        (slotId) => document.getElementById(slotId)?.querySelector('button') !== null && document.getElementById('transitionTitle')?.textContent?.includes('Level 2'),
        transitionSlotId, { timeout: 5000 }
      );
      await captureTransition('level2');
      // Click to game screen for level 2
      await page.locator(`#${transitionSlotId} button`).first().click();
      await page.waitForTimeout(500);
      // Capture rounds after completing 3 rounds
      ctx.roundsFormat.three = await page.locator('#mathai-progress-slot .mathai-rounds-display').textContent().catch(() => null);
      log(`  rounds (3): "${ctx.roundsFormat.three}"`);
    } catch {
      log('  Could not navigate to Level 2 transition');
    }

    // Capture results screen texts for victory (need to complete all rounds — skip for now, note the IDs)
    // eslint-disable-next-line no-undef
    ctx.gameFlow.resultsIds = await page.evaluate(() => {
      const ids = ['results-screen', 'results-title', 'result-time', 'result-rounds', 'result-wrong', 'result-accuracy', 'stars-display', 'btn-restart'];
      // eslint-disable-next-line no-undef
      return ids.filter((id) => document.getElementById(id) !== null);
    });
    log(`  results screen IDs in DOM: ${ctx.gameFlow.resultsIds.join(', ')}`);

    await browser.close();
  } finally {
    server.kill();
  }

  // Save context
  fs.mkdirSync(testsDir, { recursive: true });
  const contextFile = path.join(testsDir, 'test-context.json');
  fs.writeFileSync(contextFile, JSON.stringify(ctx, null, 2));
  log(`\nSaved test-context.json`);
  log(`Screen texts:`);
  Object.entries(ctx.screens).forEach(([k, v]) => log(`  ${k}: title="${v.title}" button="${v.button}"`));
}

// ─── Step 2a: Generate test cases ───────────────────────────────────────────

async function runGenerateCases() {
  log('\n=== Step 2a: Generate Test Cases ===');

  if (!fs.existsSync(specFile)) {
    log(`ERROR: ${specFile} not found`);
    return;
  }

  const specContent = fs.readFileSync(specFile, 'utf-8');
  const prompt = `You are a QA analyst. Analyze the following game specification and produce a structured list of test cases.

Categories:
- "game-flow": screen transitions (start → game → level transition → end screen)
- "mechanics": core interactions (input, adjustment controls, check/submit, scoring)
- "level-progression": how levels change (difficulty, content, round structure)
- "edge-cases": boundary values, invalid input, rapid actions, final life/round
- "contract": gameOver postMessage event (type, score, stars, total fields)

Output a JSON array. Each item:
- "name": short test case name
- "category": one of game-flow | mechanics | level-progression | edge-cases | contract
- "description": what is being validated
- "steps": array of human-readable steps (specific buttons, inputs, assertions)

Output ONLY valid JSON in a \`\`\`json code block.

SPECIFICATION:
${specContent}`;

  const output = await callLlm('generate-test-cases', prompt, process.env.RALPH_TEST_MODEL || 'gemini-2.5-flash');
  const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    log('ERROR: Could not extract JSON from output');
    return;
  }

  const testCases = JSON.parse(jsonMatch[1]);
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(testCasesFile, JSON.stringify(testCases, null, 2));

  const byCat = {};
  testCases.forEach((tc) => {
    byCat[tc.category] = (byCat[tc.category] || 0) + 1;
  });

  log(`Generated ${testCases.length} test cases:`);
  Object.entries(byCat).forEach(([cat, n]) => log(`  ${cat}: ${n}`));
  log(`Saved test-cases.json`);
}

// ─── Step 2b: Generate category spec files ──────────────────────────────────

async function runGenerateTests() {
  log('\n=== Step 2b: Generate Category Spec Files ===');

  if (!fs.existsSync(testCasesFile)) {
    log(`ERROR: ${testCasesFile} not found — run --step=cases first`);
    return;
  }
  if (!fs.existsSync(htmlFile)) {
    log(`ERROR: ${htmlFile} not found`);
    return;
  }

  const testCases = JSON.parse(fs.readFileSync(testCasesFile, 'utf-8'));
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

  // Load test context if available
  const contextFile = path.join(testsDir, 'test-context.json');
  let testContextText = null;
  if (fs.existsSync(contextFile)) {
    const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
    const screenLines = Object.entries(ctx.screens || {})
      .map(([k, v]) => `  ${k}: title="${v.title}" subtitle="${v.subtitle}" button="${v.button}"`)
      .join('\n');
    testContextText = `RUNTIME TEST CONTEXT — authoritative values extracted from running game:

Transition screen texts:
${screenLines}

gameState available keys: ${(ctx.gameStateKeys || []).join(', ')}
timer API (methods/props): ${(ctx.timerKeys || []).join(', ')}

Lives display format:
  3 lives: "${ctx.livesFormat?.three}"
  2 lives: "${ctx.livesFormat?.two}"
  Full heart char: "${ctx.livesFormat?.fullHeart}"  Empty heart char: "${ctx.livesFormat?.emptyHeart}"

Rounds display format: "${ctx.roundsFormat?.zero}"`;
    log(`Using test-context.json (${Object.keys(ctx.screens || {}).length} screens captured)`);
  } else {
    log('No test-context.json found — run --step=context for better selector accuracy');
  }

  // Load DOM snapshot if available
  const snapshotFile = path.join(testsDir, 'dom-snapshot.json');
  let domSnapshotText = null;
  if (fs.existsSync(snapshotFile)) {
    const snap = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
    const fmt = (items) =>
      items.map((e) => `  #${e.id} [${e.tag}]${e.classes ? ` (classes: ${e.classes})` : ''}: "${e.text}"`).join('\n');
    domSnapshotText = `ACTUAL RUNTIME DOM — captured from the running game:

START SCREEN:
${fmt(snap.startScreen)}

GAME SCREEN:
${fmt(snap.gameScreen)}`;
    log(`Using DOM snapshot (${snap.startScreen.length} start + ${snap.gameScreen.length} game elements)`);
  } else {
    log('No dom-snapshot.json found — generating without DOM context (run --step=snapshot first for better results)');
  }

  const CATEGORIES = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];

  // Shared boilerplate — mirrors pipeline.js exactly
  const sharedBoilerplate = `import { test, expect } from '@playwright/test';

// Hardcoded fallback values — use these instead of window.gameState.content
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

async function dismissPopupIfPresent(page) {
  const backdrop = page.locator('#popup-backdrop');
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.locator('button').first().click();
    await page.waitForTimeout(300);
  }
  const okayBtn = page.locator('button:has-text("Okay!")');
  if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await okayBtn.click();
    await page.waitForTimeout(300);
  }
}

async function startGame(page) {
  await dismissPopupIfPresent(page);
  await page.locator('#mathai-transition-slot button').first().click();
  await page.waitForTimeout(500);
  await dismissPopupIfPresent(page);
  await page.locator('#mathai-transition-slot button').first().click();
  // Wait for game screen: transition slot hidden means game content is shown
  await page.waitForFunction(
    (slotId) => {
      const slot = document.getElementById(slotId);
      return slot && getComputedStyle(slot).display === 'none';
    },
    'mathai-transition-slot',
    { timeout: 10000 }
  );
}

async function clickNextLevel(page) {
  await expect(page.locator('#mathai-transition-slot button')).toBeVisible({ timeout: 10000 });
  await page.locator('#mathai-transition-slot button').first().click();
  await page.waitForTimeout(500);
}

async function submitAnswer(page, answer) {
  await page.locator('#answer-input').fill(answer.toString());
  await page.locator('#btn-check').click();
  await expect.poll(async () => await page.evaluate(() => !window.gameState.isProcessing), { timeout: 15000 }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  try {
    const okayBtn = page.locator('button:has-text("Okay!")');
    await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
    await okayBtn.click();
    await page.waitForTimeout(300);
  } catch {
    // No audio popup
  }
  await page.waitForFunction(
    (slotId) => {
      const slot = document.getElementById(slotId);
      return slot !== null && slot.querySelector('button') !== null;
    },
    'mathai-transition-slot',
    { timeout: 20000 }
  );
});`;

  // Determine which categories to generate
  const categoriesToRun = categoryArg
    ? CATEGORIES.filter((c) => c === categoryArg)
    : CATEGORIES;

  if (categoryArg && categoriesToRun.length === 0) {
    log(`ERROR: Unknown category '${categoryArg}'. Valid: ${CATEGORIES.join(', ')}`);
    return;
  }

  if (categoryArg) {
    // Single-category mode: only delete that category's spec file
    const specFile = path.join(testsDir, `${categoryArg}.spec.js`);
    if (fs.existsSync(specFile)) {
      fs.unlinkSync(specFile);
      log(`Deleted ${categoryArg}.spec.js`);
    }
  } else {
    // All-categories mode: delete all spec files
    const existingSpecs = fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js'));
    existingSpecs.forEach((f) => {
      fs.unlinkSync(path.join(testsDir, f));
      log(`Deleted ${f}`);
    });
  }

  for (const category of categoriesToRun) {
    const catTestCases = testCases.filter((tc) => tc.category === category);
    if (catTestCases.length === 0) {
      log(`Skipping ${category} — no test cases`);
      continue;
    }

    const catTestCasesText = catTestCases
      .map((tc, i) => `${i + 1}. ${tc.name}: ${tc.description}\n   Steps: ${tc.steps.join(' → ')}`)
      .join('\n');

    log(`Generating ${category} (${catTestCases.length} test cases)...`);

    const catPrompt = `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

IMPLEMENT ALL ${catTestCases.length} TEST CASES — one test() per case, no skipping, no merging:
${catTestCasesText}

Your test.describe() block MUST contain exactly ${catTestCases.length} test() calls.

CRITICAL — Helper function behavior (read carefully before writing any test):

startGame(page):
  - Clicks the transition slot button TWICE: start screen → Level 1 transition → GAME SCREEN
  - After startGame() resolves, you are on the GAME SCREEN (transition slot is hidden)
  - DO NOT call clickNextLevel() immediately after startGame() — you are already past Level 1 transition
  - Use startGame() at the beginning of every test

clickNextLevel(page):
  - Waits for #mathai-transition-slot button to be visible, then clicks it
  - Use this ONLY after completing 3 rounds (Level 1→2) or 6 rounds (Level 2→3)
  - Never use it right after startGame() — there is no transition button visible on game screen

submitAnswer(page, answer):
  - Fills #answer-input, clicks #btn-check, waits for !gameState.isProcessing
  - Always use this — never interact with #answer-input or #btn-check directly

Transition slot selectors (all valid — use these):
  - Button: page.locator('#mathai-transition-slot button').first()  ← PREFERRED for clicking
  - Title: page.locator('#transitionTitle')  ← h2 element
  - Subtitle: page.locator('#transitionSubtitle')  ← p element
  - Button container: page.locator('#transitionButtons')
  - WRONG class: '.game-btn', '.btn-primary' — these do NOT exist on buttons; button class is 'mathai-transition-btn'

Progress slot selectors — ONLY use these (never use #pb-{timestamp} IDs — they change every session):
  - Rounds: page.locator('#mathai-progress-slot .mathai-progress-text')   ← class is mathai-progress-text NOT mathai-rounds-display
  - Lives: page.locator('#mathai-progress-slot .mathai-lives-display')

Screen visibility rules:
  - On start/transition screen: #mathai-transition-slot is visible; game elements (#timer-container, #adjuster-container, #answer-area, #game-screen) are HIDDEN
  - On game screen (after startGame()): game elements are visible; #mathai-transition-slot is hidden
  - Do NOT assert #timer-container.toBeVisible() on the start screen — it is hidden until the game starts

Available globals (DO NOT redefine): dismissPopupIfPresent, startGame, clickNextLevel, submitAnswer, fallbackContent, test.beforeEach

OUTPUT: Only test.describe('${category}', () => { ... }); — no imports, no helpers, no beforeEach, no TypeScript types.
Start with: test.describe('${category}', () => {

Rules:
- Use EXACT element IDs from the DOM snapshot below (not guessed from HTML)
- submitAnswer() for all answer submission — never #btn-check directly
- fallbackContent.rounds[i].numberA/.numberB/.correctAnswer for round data
- expect(await page.evaluate(() => x)).toBe(v) — NOT await expect(page.evaluate(...))
- Pure JavaScript only — no TypeScript type annotations (no : any[], no : string, etc.)
- Use double quotes for test() names: test("test name", async...) — never single quotes in names
- Do NOT access window.timer directly — only use gameState properties from the context below
- Do NOT assert #timer-container visibility on start/transition screens — it is hidden there (only visible on game screen)
- For non-numeric input testing (e.g. typing "abc"), use page.evaluate() to set the value directly — page.fill() rejects non-numeric strings on type="number" inputs: await page.evaluate(() => { const el = document.querySelector('#answer-input'); el.value = 'abc'; el.dispatchEvent(new Event('input', { bubbles: true })); })
- DO NOT generate tests that require real wall-clock delays to simulate time-based scoring (e.g. playing slowly for 2-star). These always exceed the 30s timeout. Test endGame() postMessage payload for star value instead.
- Do NOT call window.visibilityTracker.onInactive() or window.visibilityTracker.onResume() directly — use document.dispatchEvent(new Event('visibilitychange')) with Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }) first
- Wrap in \`\`\`javascript code block
${testContextText ? `\n${testContextText}\n` : ''}
${domSnapshotText ? `\n${domSnapshotText}\n` : ''}
HTML:
${htmlContent}`;

    const output = await callLlm(`generate-tests-${category}`, catPrompt, process.env.RALPH_TEST_MODEL || 'gemini-2.5-flash');
    let catTests = extractTests(output);
    if (!catTests) {
      log(`  ERROR: Could not extract test.describe() — skipping`);
      continue;
    }

    // Strip any preamble before test.describe
    const describeStart = catTests.indexOf('test.describe(');
    if (describeStart > 0) catTests = catTests.substring(describeStart);

    // Post-processing fixes (mirrors pipeline.js)
    catTests = catTests.replace(/let\s+\w+\s*:\s*\w+(\[\])?\s*=\s*/g, 'let $1 = ').replace(/:\s*\w+(\[\])?\s*=/g, ' =');
    catTests = catTests.replace(/await\s+expect\s*\(\s*page\.evaluate\s*\(/g, 'expect(await page.evaluate(');
    // Fix wrong button classes that LLMs hallucinate
    catTests = catTests.replace(/\.game-btn\.btn-primary/g, '');
    catTests = catTests.replace(/\.btn-primary/g, '');
    // Fix dynamically-generated progress bar IDs → stable class selectors
    catTests = catTests.replace(/#pb-\d+-text/g, '#mathai-progress-slot .mathai-progress-text');
    catTests = catTests.replace(/#pb-\d+-lives/g, '#mathai-progress-slot .mathai-lives-display');
    // Fix wrong rounds display class (.mathai-rounds-display doesn't exist — it's .mathai-progress-text)
    catTests = catTests.replace(/\.mathai-rounds-display/g, '.mathai-progress-text');

    // Count test() calls
    const testCount = (catTests.match(/\btest\s*\(/g) || []).length;
    log(`  Generated ${testCount} test() calls (expected ${catTestCases.length})`);

    const fullSpec = sharedBoilerplate + '\n\n' + catTests;
    fs.writeFileSync(path.join(testsDir, `${category}.spec.js`), fullSpec + '\n');
    log(`  Wrote ${category}.spec.js`);
  }

  log('\nGeneration complete. Inspect tests/ directory for quality check.');
  log('Run: npx playwright test --config warehouse/templates/adjustment-strategy/game/playwright.config.js --list');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const steps = stepArg === 'all' ? ['snapshot', 'context', 'cases', 'tests'] : [stepArg];

  for (const step of steps) {
    if (step === 'snapshot') await runSnapshot();
    else if (step === 'context') await runExtractContext();
    else if (step === 'cases') await runGenerateCases();
    else if (step === 'tests') await runGenerateTests();
    else {
      console.error(`Unknown step: ${step}. Use: snapshot | context | cases | tests | all`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
