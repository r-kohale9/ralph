#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// scripts/test-gen.js — Targeted test generation validation
//
// Exercises Steps 2.5 (DOM snapshot) and 2b (categorized spec generation)
// in isolation, keeping HTML and test-cases.json constant.
//
// Usage:
//   node scripts/test-gen.js [gameDir] [--step=snapshot|cases|tests|all] [--category=<name>]
//
// Examples:
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=snapshot
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=all
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=tests --category=game-flow
//   node scripts/test-gen.js warehouse/templates/adjustment-strategy/game --step=tests --category=mechanics
//
// Steps:
//   snapshot  — Run DOM snapshot only (no LLM needed)
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
  await page.waitForTimeout(500);
  await expect(page.locator('#original-a')).toBeVisible({ timeout: 5000 });
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
  - After startGame() resolves, you are on the GAME SCREEN (#original-a is visible)
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
  - Rounds: page.locator('#mathai-progress-slot .mathai-rounds-display')
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
- Wrap in \`\`\`javascript code block
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
    catTests = catTests.replace(/#pb-\d+-text/g, '#mathai-progress-slot .mathai-rounds-display');
    catTests = catTests.replace(/#pb-\d+-lives/g, '#mathai-progress-slot .mathai-lives-display');

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
  const steps = stepArg === 'all' ? ['snapshot', 'cases', 'tests'] : [stepArg];

  for (const step of steps) {
    if (step === 'snapshot') await runSnapshot();
    else if (step === 'cases') await runGenerateCases();
    else if (step === 'tests') await runGenerateTests();
    else {
      console.error(`Unknown step: ${step}. Use: snapshot | cases | tests | all`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
