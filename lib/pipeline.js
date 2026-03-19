'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline.js — E3: Node.js implementation of the Ralph pipeline
//
// Replaces ralph.sh's curl-based LLM calls with the Node.js llm.js client.
// Enables: cost tracking, structured I/O, streaming, per-call metrics.
//
// Usage: Called by worker.js when RALPH_USE_NODE_PIPELINE=1
//   const { runPipeline } = require('./lib/pipeline');
//   const report = await runPipeline(gameDir, specPath, { metrics, logger });
//
// The bash pipeline (ralph.sh) remains the default for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { callLlm, callClaude } = require('./llm');
const { validateContract } = require('./validate-contract');
const metrics = require('./metrics');

const execFileAsync = promisify(execFile);

// ─── Configuration ──────────────────────────────────────────────────────────

const GEN_MODEL = process.env.RALPH_GEN_MODEL || 'claude-opus-4-6';
const TEST_MODEL = process.env.RALPH_TEST_MODEL || 'gemini-2.5-pro';
const FIX_MODEL = process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
const REVIEW_MODEL = process.env.RALPH_REVIEW_MODEL || 'gemini-2.5-pro';
const FALLBACK_MODEL = process.env.RALPH_FALLBACK_MODEL || 'gpt-4.1';
const MAX_ITERATIONS = parseInt(process.env.RALPH_MAX_ITERATIONS || '5', 10);
const CATEGORY_BATCH_SIZE = parseInt(process.env.RALPH_CATEGORY_BATCH_SIZE || '1', 10);
const SKIP_DOM_SNAPSHOT = process.env.RALPH_SKIP_DOM_SNAPSHOT === '1';
const TEST_TIMEOUT = parseInt(process.env.RALPH_TEST_TIMEOUT || '120', 10) * 1000;
const USE_CLAUDE_CLI = process.env.RALPH_USE_CLAUDE_CLI === '1';
const REPO_DIR = process.env.RALPH_REPO_DIR || '.';
const SKILL_DIR = path.join(REPO_DIR, 'warehouse', 'mathai-game-builder');

// ─── HTML extraction helpers ────────────────────────────────────────────────

function extractHtml(output) {
  // Try ```html code block
  let match = output.match(/```html\n([\s\S]*?)\n```/);
  if (match) return match[1];

  // Try generic code block with HTML content
  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /<!DOCTYPE|<html|<head|<body/.test(match[1])) return match[1];

  // Raw HTML
  if (/<!DOCTYPE|<html/.test(output)) return output;

  return null;
}

function extractTests(output) {
  let match = output.match(/```javascript\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```js\n([\s\S]*?)\n```/);
  if (match) return match[1];

  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /test|expect|describe/.test(match[1])) return match[1];

  return null;
}

// ─── LLM call wrapper with metrics ──────────────────────────────────────────

async function trackedLlmCall(stepName, prompt, model, options = {}) {
  const start = Date.now();
  try {
    const result = await callLlm(stepName, prompt, model, options);
    metrics.recordLlmCall(stepName, model, Date.now() - start, true);
    return result;
  } catch (err) {
    metrics.recordLlmCall(stepName, model, Date.now() - start, false);
    if (err.message.includes('Rate limited')) {
      metrics.recordLlmRateLimit(model);
    }
    throw err;
  }
}

// ─── DOM snapshot for test generation context ───────────────────────────────
// Launches a headless browser against the game, navigates to the start and game
// screens, and returns a formatted string of actual element IDs/classes/text.
// Injected into test-gen prompts so the LLM uses real selectors, not guesses.

async function captureGameDomSnapshot(gameDir, transitionSlotId, logger) {
  const info = logger ? (m) => logger.info(m) : console.log;
  const warn = logger ? (m) => logger.warn(m) : console.warn;
  const SNAPSHOT_PORT = 8786;
  let snapshotServer;

  try {
    snapshotServer = require('child_process').spawn(
      'npx',
      ['-y', 'serve', gameDir, '-l', String(SNAPSHOT_PORT), '-s', '--no-clipboard'],
      { stdio: 'ignore', detached: false },
    );
    await new Promise((r) => setTimeout(r, 2500));

    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    const page = await context.newPage();

    await page.goto(`http://localhost:${SNAPSHOT_PORT}`);

    // Dismiss FeedbackManager audio popup (blocks ScreenLayout.inject)
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
      await okayBtn.click();
      await page.waitForTimeout(300);
    } catch {
      /* no popup */
    }

    // Wait for game init: transition slot button must be present
    // eslint-disable-next-line no-undef
    await page.waitForFunction((slotId) => document.getElementById(slotId)?.querySelector('button') !== null, transitionSlotId, { timeout: 20000 });

    // Extract start screen DOM — page.evaluate() runs in browser scope (document/getComputedStyle are browser globals)
    /* eslint-disable no-undef */
    const extractDom = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[id]')).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.id,
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList).join(' '),
            visible: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none',
            text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80),
          };
        }),
      );
    /* eslint-enable no-undef */

    const startDom = await extractDom();

    // Navigate to game screen (two transition clicks)
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(600);
    try {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
    } catch {
      /* ignore */
    }
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(1000);

    const gameDom = await extractDom();

    // Capture game content for fallbackContent (game-agnostic round data)
    let gameContent = null;
    try {
      /* eslint-disable no-undef */
      gameContent = await page.evaluate(() => window.gameState?.content || null);
      /* eslint-enable no-undef */
    } catch {
      /* content not available */
    }

    await browser.close();

    // Format: show all elements with id; mark hidden ones so LLM knows they exist
    const fmt = (items) =>
      items
        .filter((e) => e.id)
        .map((e) => {
          const cls = e.classes ? ` (classes: ${e.classes})` : '';
          const txt = e.text ? ` — "${e.text}"` : '';
          const vis = e.visible ? '' : ' [hidden — conditionally shown]';
          return `  #${e.id} [${e.tag}]${cls}${vis}${txt}`;
        })
        .join('\n') || '  (none)';

    const snapshot = {
      startScreen: startDom.filter((e) => e.id),
      gameScreen: gameDom.filter((e) => e.id),
      capturedAt: new Date().toISOString(),
    };

    // Save for debugging
    fs.writeFileSync(path.join(gameDir, 'tests', 'dom-snapshot.json'), JSON.stringify(snapshot, null, 2));
    if (gameContent) {
      fs.writeFileSync(path.join(gameDir, 'tests', 'game-content.json'), JSON.stringify(gameContent, null, 2));
    }

    info(`[pipeline] DOM snapshot: ${snapshot.startScreen.length} start-screen elements, ${snapshot.gameScreen.length} game-screen elements`);

    return `ACTUAL RUNTIME DOM — captured from the running game (use THESE IDs/classes, not guesses from HTML source):

START SCREEN (after popup dismissed, waiting for game to begin):
${fmt(startDom)}

GAME SCREEN (after clicking through both transition buttons):
${fmt(gameDom)}`;
  } catch (err) {
    warn(`[pipeline] DOM snapshot failed: ${err.message} — continuing without context`);
    return null;
  } finally {
    if (snapshotServer) {
      try {
        snapshotServer.kill();
      } catch {
        /* ignore */
      }
    }
  }
}

// ─── Static validation ─────────────────────────────────────────────────────

function runStaticValidation(htmlPath) {
  const validatorPath = path.join(__dirname, 'validate-static.js');
  if (!fs.existsSync(validatorPath)) return { passed: true, output: '' };

  try {
    const { execFileSync } = require('child_process');
    const output = execFileSync('node', [validatorPath, htmlPath], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { passed: true, output };
  } catch (err) {
    return { passed: false, output: err.stdout || err.message };
  }
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function collectFailures(suites, parentFile, out) {
  for (const suite of suites || []) {
    const suiteFile = suite.file || parentFile || '';
    for (const spec of suite.specs || []) {
      if (!spec.ok) {
        const errMsg = spec.tests?.[0]?.results?.[0]?.error?.message?.split('\n')[0] || '';
        const fileLabel = suiteFile ? `[${path.basename(suiteFile)}] ` : '';
        out.push(errMsg ? `${fileLabel}${spec.title} — ${errMsg}` : `${fileLabel}${spec.title}`);
      }
    }
    if (suite.suites) collectFailures(suite.suites, suiteFile, out);
  }
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

async function runPipeline(gameDir, specPath, options = {}) {
  const { logger: log, onProgress } = options;
  const info = log ? (msg) => log.info(msg) : console.log;
  const warn = log ? (msg) => log.warn(msg) : console.warn;

  function progress(step, detail) {
    if (onProgress) {
      try {
        onProgress(step, detail);
      } catch {
        /* ignore callback errors */
      }
    }
  }

  const startTime = Date.now();
  const gameId = path.basename(path.dirname(specPath));
  const htmlFile = path.join(gameDir, 'index.html');
  const testsDir = path.join(gameDir, 'tests');
  const testCasesFile = path.join(testsDir, 'test-cases.json');
  const reportFile = path.join(gameDir, 'ralph-report.json');
  const llmCalls = [];

  fs.mkdirSync(path.join(gameDir, 'tests'), { recursive: true });

  const report = {
    game_id: gameId,
    spec: specPath,
    status: 'FAILED',
    iterations: 0,
    generation_time_s: 0,
    total_time_s: 0,
    test_results: [],
    category_results: {},
    review_result: null,
    errors: [],
    models: { generation: GEN_MODEL, test_gen: TEST_MODEL, fix: FIX_MODEL, review: REVIEW_MODEL },
    artifacts: [],
    llm_calls: 0,
    timestamp: new Date().toISOString(),
  };

  function writeReport() {
    report.total_time_s = Math.round((Date.now() - startTime) / 1000);
    report.llm_calls = llmCalls.length;
    report.artifacts = fs.existsSync(htmlFile) ? ['index.html'] : [];
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  // ─── Step 0: Validate spec ──────────────────────────────────────────────
  progress('validate-spec', { gameId });

  if (!fs.existsSync(specPath)) {
    report.errors.push('Spec file not found');
    writeReport();
    return report;
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');
  if (specContent.length < 500) {
    report.errors.push('Spec file too small — likely truncated');
    writeReport();
    return report;
  }

  // ─── Step 1: Generate HTML ──────────────────────────────────────────────

  const existingHtml = fs.existsSync(htmlFile) && fs.statSync(htmlFile).size > 5000;
  if (existingHtml) {
    info(`[pipeline] Step 1: Skipping HTML generation — index.html exists (${fs.statSync(htmlFile).size} bytes)`);
    report.generation_time_s = 0;
  }

  if (!existingHtml) {
  info(`[pipeline] Step 1: Generate HTML for ${gameId}`);
  progress('generate-html', { gameId, model: GEN_MODEL });
  const genStart = Date.now();

  const genPrompt = `You are an expert HTML game assembler. The following specification is a self-contained assembly book — it contains ALL code blocks, element IDs, function signatures, CSS, game logic, and verification checks needed to produce a working game.

INSTRUCTIONS:
- Follow the specification EXACTLY — do not invent new element IDs, function names, or game logic
- Assemble all sections into a single index.html file (all CSS in <style>, all JS in <script>)
- Copy code blocks from the spec verbatim, filling in only where placeholders exist
- Use the element IDs, class names, and function signatures defined in the spec
- Use the star calculation logic defined in the spec (Section 11 or Parts table), not a generic formula
- The spec's Section 15 (Verification Checklist) lists every requirement — ensure all items pass
- Output ONLY the complete HTML file content, wrapped in a \`\`\`html code block

15. DATA-TESTID ATTRIBUTES — required on all interactive and observable elements:
    - EVERY interactive element needs a data-testid attribute so Playwright tests can find it reliably
    - EVERY observable state element (displays, counters, timers) needs a data-testid attribute
    - Use descriptive kebab-case names. Required minimums:
      data-testid="answer-input"       ← the answer input field
      data-testid="btn-check"          ← the submit/check button
      data-testid="btn-restart"        ← the play again / restart button
      data-testid="score-display"      ← the score or points display element
      data-testid="stars-display"      ← the stars display element
      data-testid="lives-display"      ← the lives / hearts display (if separate from CDN slot)
      data-testid="btn-reset"          ← the reset button (if spec includes one)
    - For adjustment controls (+/- buttons), use: data-testid="btn-{which}-plus" and data-testid="btn-{which}-minus"
      where {which} is the identifier (e.g., "a", "b", "num1", "num2")
    - For multiple-choice options: data-testid="option-{index}" (0-indexed)
    - IDs in the spec take precedence — if the spec says id="btn-check", keep that AND add data-testid="btn-check"
    - Do NOT rely on class selectors for elements that tests need to interact with

CRITICAL MATHAI CDN RULES (runtime requirements — apply these even if the spec is silent):

1. FEEDBACKMANAGER AUDIO — fire-and-forget ONLY, NEVER await:
   FeedbackManager.playDynamicFeedback({...}).catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); });  ← CORRECT
   await FeedbackManager.playDynamicFeedback({...});            ← WRONG: hangs forever in tests/headless
   Audio is cosmetic — game logic must NEVER depend on it resolving.
   The .catch() MUST log the error (not swallow silently) to satisfy RULE-003 try/catch requirement.

2. isProcessing — clear in EVERY exit path of checkAnswer/roundComplete/endGame:
   - Set gameState.isProcessing = false at the START of endGame()
   - Set gameState.isProcessing = false BEFORE calling showLevelTransition() in roundComplete()
   - Set gameState.isProcessing = false in any game-over path (e.g. lives = 0 before setTimeout)
   Missing this causes subsequent answer clicks to be silently dropped.

3. GAME DOM — template pattern required for ScreenLayout:
   - <div id="app"></div> stays EMPTY in static HTML
   - ALL game elements go inside <template id="game-template"> placed OUTSIDE #app
   - After ScreenLayout.inject(), clone into #gameContent:
     const tpl = document.getElementById('game-template');
     if (tpl) document.getElementById('gameContent').appendChild(tpl.content.cloneNode(true));
   ScreenLayout.inject() replaces #app's entire content — anything inside #app is destroyed.

4. EVENT DELEGATION — no duplicate listeners:
   - Use ONE parent.addEventListener('click', e => { if (e.target.matches(...)) }) per container
   - NEVER call element.addEventListener() inside a function that sets innerHTML (fires twice per click)

5. CDN INIT ORDER — immutable sequence:
   await FeedbackManager.init();   // MUST await — shows audio permission popup
   ScreenLayout.inject(...);       // MUST run AFTER FeedbackManager.init() resolves
   // clone game-template + initGame() called after ScreenLayout

6. VISIBILITYTRACKER — expose as window.visibilityTracker for testability:
   window.visibilityTracker = new VisibilityTracker({ onInactive: ..., onResume: ... });
   Tests call window.visibilityTracker directly to simulate tab hide/show events.

7. STAR DISPLAY — use ONLY the star formula from the spec, no accuracy modifier:
   - On victory: use EXACTLY the star thresholds from the spec (e.g. avg time per level <15s = 3★, <25s = 2★, ≥25s = 1★)
   - On game over (lives=0): ALWAYS return 0 stars — game_over outcome = 0★ regardless of time or accuracy
   - calcStars() MUST have an explicit early return: if (outcome === 'game_over') return 0;
   - Show 0 stars as empty characters: ☆☆☆
   - NEVER add accuracy-based secondary checks (e.g. if accuracyRatio < 0.8 reduce stars) — the spec defines the star formula completely
   - The star display element MUST be updated in BOTH the victory path AND the game-over/lives-lost path
   - Do NOT skip star display in the game-over code path

8. LIVES DISPLAY — update DOM immediately when a life is lost:
   - After decrementing gameState.lives, update the lives counter DOM element immediately
   - The lives display must reflect the NEW value before any animation or FeedbackManager call
   - Tests check the DOM text AFTER the wrong answer is processed, not after animation completes

9. isProcessing GUARD — silently block, do NOT hide elements:
   - isProcessing = true means: ignore subsequent clicks, do NOT hide/show buttons
   - Check buttons and input remain VISIBLE while isProcessing=true — they just don't respond
   - Implementation: if (gameState.isProcessing) return; at the top of handleSubmit/checkAnswer
   - NEVER do: element.style.display = 'none' or element.classList.add('hidden') based on isProcessing

10. CDN COMPONENT CLEANUP — DELAYED destroy only, NEVER immediate:
    - NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() synchronously in endGame()
    - Destroying immediately removes CDN DOM elements (#mathai-progress-slot, #mathai-timer-slot) from the page
    - Tests check these elements AFTER game over — immediate destroy causes "element not found" failures
    - Spec REQUIRES destroy() to be called — satisfy this with a 10-second delay so tests finish first:
      setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
    - Put this setTimeout at the END of endGame(), after all DOM updates

11. TIMER INIT — startTime MUST be 0:
    - ALWAYS initialize TimerComponent with startTime: 0
    - NEVER use startTime: 1 (off-by-one error in timer display)
    - Example: const timer = new TimerComponent({ containerId: 'mathai-timer-slot', startTime: 0, ... });

12. LIVES DISPLAY — do NOT define updateLivesDisplay() manually:
    - NEVER define a custom updateLivesDisplay(n) function that manipulates lives DOM directly
    - The ProgressBarComponent handles all lives display — it reads gameState.lives and renders hearts
    - Only call progressBar.update(currentRound, currentLives) to sync the component
    - Manual updateLivesDisplay() conflicts with ProgressBarComponent's async rendering and causes test failures

13. ASYNC FUNCTIONS — always declare async if using await:
    - If endGame() contains ANY await calls, it MUST be declared: async function endGame() { ... }
    - Same rule applies to all other functions — never put await inside a non-async function

14. TRANSITIONSCREEN — use for ALL state transitions if spec includes it:
    - If the spec defines a TransitionScreen component, it MUST be used for: game start, level transitions, victory, game-over
    - Do NOT skip TransitionScreen and jump directly to showing game/result screens
    - Initialize with: const transitionScreen = new TransitionScreen({ containerId: 'mathai-transition-slot' })
    - Call transitionScreen.show({ type: 'victory'|'game-over'|'level-start', ... }) at each transition

16. POSTMESSAGE — always send to PARENT frame:
    - ALWAYS use window.parent.postMessage(payload, '*') for game_complete events
    - NEVER use window.postMessage(payload, '*') — this sends to the same window, parent never receives it
    - The MathAI platform is always an iframe parent; window.parent is always the correct target

17. MULTI-STEP CONTROLS — never hide the adjustment button after first click:
    - If a game has +/- adjustment buttons (spec terms: "adjusts by ±1", "increment/decrement"), keep BOTH buttons visible at all times after initial render
    - Showing a value display in the +/- button area is fine, but the button itself must remain visible and clickable for repeated adjustments
    - NEVER call btn.classList.add('hidden') on an adjustment button as a result of the user clicking it

SPECIFICATION:
${specContent}`;

  let genOutput;
  try {
    if (USE_CLAUDE_CLI) {
      info('[pipeline] Using claude -p for HTML generation (skill context auto-loaded)');
      const cliPrompt = `You are generating a MathAI game HTML file.

Read the game-specific template at: ${path.resolve(specPath)}

Generate the complete index.html file following the template exactly.
Write the output to: ${path.resolve(htmlFile)}

Rules:
- Single file, all CSS in one <style>, all JS in one <script>
- Follow every instruction in the template
- Include fallback content for standalone testing
- All game HTML must go inside #gameContent when using ScreenLayout

Write the file now.`;

      genOutput = await callClaude('generate-html', cliPrompt, {
        cwd: SKILL_DIR,
        model: process.env.RALPH_CLAUDE_MODEL || 'sonnet',
        timeout: parseInt(process.env.RALPH_LLM_TIMEOUT || '600', 10) * 1000,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
        addDirs: [path.resolve(REPO_DIR, 'warehouse'), path.resolve(gameDir)],
      });
    } else {
      genOutput = await trackedLlmCall('generate-html', genPrompt, GEN_MODEL);
    }
    llmCalls.push({ step: 'generate-html', model: USE_CLAUDE_CLI ? 'claude-cli' : GEN_MODEL });
  } catch (err) {
    report.errors.push(`HTML generation failed: ${err.message}`);
    writeReport();
    return report;
  }

  report.generation_time_s = Math.round((Date.now() - genStart) / 1000);

  // claude -p writes the file directly via Write tool; API mode returns HTML in response
  if (USE_CLAUDE_CLI && fs.existsSync(htmlFile)) {
    const size = fs.statSync(htmlFile).size;
    info(`[pipeline] HTML saved by claude -p (${size} bytes)`);
  } else if (USE_CLAUDE_CLI) {
    // claude -p didn't write the file — try extracting from output
    const html = extractHtml(genOutput || '');
    if (!html) {
      report.errors.push('claude -p did not generate index.html');
      writeReport();
      return report;
    }
    fs.writeFileSync(htmlFile, html + '\n');
    info(`[pipeline] HTML extracted from claude -p output (${html.length} bytes)`);
  } else {
    const html = extractHtml(genOutput);
    if (!html) {
      report.errors.push('Could not extract HTML from generation output');
      writeReport();
      return report;
    }
    fs.writeFileSync(htmlFile, html + '\n');
    info(`[pipeline] HTML saved (${html.length} bytes)`);
  }

  } // end if (!existingHtml)

  // Emit progress with htmlFile path so worker can upload preview
  const htmlSize = fs.existsSync(htmlFile) ? fs.statSync(htmlFile).size : 0;
  const htmlGenTimeS = report.generation_time_s || 0;
  progress('html-ready', { gameId, htmlFile, size: htmlSize, time: htmlGenTimeS });

  // ─── Step 1b: Static + contract validation ──────────────────────────────

  info('[pipeline] Step 1b: Static validation');
  progress('static-validation', { gameId });
  const staticResult = runStaticValidation(htmlFile);
  if (!staticResult.passed) {
    warn(`[pipeline] Static validation failed, attempting fix`);
    progress('static-validation-failed', { gameId, errors: staticResult.output, fixModel: FIX_MODEL });

    const fixPrompt = `The following HTML game file has structural issues that need fixing.

ERRORS:
${staticResult.output}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

SPECIFICATION (for reference — use exact element IDs, function names, and structure from this spec):
${specContent}

Fix ALL the listed structural issues while keeping the game aligned with the specification.

CRITICAL CONSTRAINTS — do NOT change these patterns:
1. CDN initialization order MUST be preserved exactly:
   await FeedbackManager.init();
   ScreenLayout.inject(...);
   // then initGame() is called from within ScreenLayout or explicitly after
   Breaking this order causes the game to not render at all.
2. Do NOT remove or reorder any CDN <script> tags (FeedbackManager, ScreenLayout, etc.)
3. Do NOT wrap the initialization block in try/catch or move it inside other functions
4. Make the smallest possible change that fixes only the listed errors

Output the complete corrected HTML wrapped in a \`\`\`html code block.`;

    try {
      const fixOutput = await trackedLlmCall('static-fix', fixPrompt, FIX_MODEL);
      llmCalls.push({ step: 'static-fix', model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (fixedHtml) {
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
        progress('static-validation-fixed', { gameId });
      }
    } catch {
      warn('[pipeline] Static fix LLM call failed');
      progress('static-validation-fix-failed', { gameId });
    }
  }

  // Contract validation (non-blocking)
  const contractErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
  if (contractErrors.length > 0) {
    warn(`[pipeline] Contract validation: ${contractErrors.length} issue(s)`);
    progress('contract-validation-issues', { gameId, count: contractErrors.length, errors: contractErrors });
  }

  // ─── Step 2a: Generate test cases from spec ─────────────────────────────

  const existingTestCases = fs.existsSync(testCasesFile);
  if (existingTestCases) {
    info(`[pipeline] Step 2a: Skipping test case generation — test-cases.json exists`);
  }

  let testCases = [];
  if (!existingTestCases) {
    info('[pipeline] Step 2a: Generate test cases from spec');
    progress('generate-test-cases', { gameId, model: TEST_MODEL });

    const testCasesPrompt = `You are a QA analyst. Analyze the following game specification and produce a structured list of test cases describing WHAT the game should do.

Categories to cover:
- "game-flow": screen transitions (start → game → level transition → end screen)
- "mechanics": core interactions (input, adjustment controls, check/submit, scoring)
- "level-progression": how levels change (difficulty, content, round structure)
- "edge-cases": boundary values, invalid input, rapid actions, final life/round
- "contract": gameOver postMessage event (type, score, stars, total fields)

Output a JSON array of test cases. Each test case has:
- "name": short test case name
- "category": one of game-flow | mechanics | level-progression | edge-cases | contract
- "description": what is being validated
- "steps": array of human-readable steps (be specific about what buttons, inputs, and assertions are involved)

Output ONLY valid JSON wrapped in a \`\`\`json code block. No prose.

SPECIFICATION:
${specContent}`;

    try {
      const testCasesOutput = await trackedLlmCall('generate-test-cases', testCasesPrompt, TEST_MODEL);
      llmCalls.push({ step: 'generate-test-cases', model: TEST_MODEL });
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
  // Launch a headless browser, navigate the running game, extract real element IDs.
  // Injected into test-gen prompts so LLM uses actual selectors, not HTML-inferred guesses.

  const transitionSlotId = 'mathai-transition-slot';
  let domSnapshot = null;

  if (!SKIP_DOM_SNAPSHOT) {
    info('[pipeline] Step 2.5: Capturing DOM snapshot');
    progress('dom-snapshot', { gameId });
    domSnapshot = await captureGameDomSnapshot(gameDir, transitionSlotId, log);
    if (domSnapshot) {
      progress('dom-snapshot-ready', { gameId });
    }
  }

  // ─── Step 2b: Generate Playwright tests per category ─────────────────────

  // The transition slot is always 'mathai-transition-slot' — CDN constant for all MathAI games.
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

  // Check if any spec files already exist in the tests directory
  const existingSpecFiles = fs.existsSync(testsDir)
    ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js'))
    : [];
  const existingTests = existingSpecFiles.length > 0;

  if (existingTests) {
    info(
      `[pipeline] Step 2b: Skipping test generation — ${existingSpecFiles.length} spec file(s) found: ${existingSpecFiles.join(', ')}`,
    );
  }

  if (!existingTests) {
    info('[pipeline] Step 2b: Generate Playwright tests (categorized)');
    progress('generate-tests', { gameId, model: TEST_MODEL });

    const CATEGORIES = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];

    const categoryDescriptions = {
      'game-flow':
        'Screen transitions: start screen → clicking through to game → level transition screens → game over/results screen. Test that correct screens appear in order and navigation works.',
      mechanics:
        'Core interactions: entering answers in the input field, adjustment controls (+/- buttons for numberA and numberB), submitting answers, correct/incorrect feedback, score tracking.',
      'level-progression':
        'Level structure: 3 rounds per level (levels 1→2→3, 9 rounds total), content changes between levels, clicking through level transition screens, round counter progression.',
      'edge-cases':
        'Boundary conditions: submitting empty input, losing all lives (game over early), rapid repeated clicks on +/- adjustment buttons, final round of the game.',
      contract:
        'postMessage contract: when the game ends window.parent.postMessage fires with { type: "gameOver", score, stars, total }. Verify star thresholds: >=80% = 3 stars, >=50% = 2 stars, else 1 star.',
    };

    // Shared boilerplate prepended verbatim to every category spec file.
    // The pipeline controls this — LLMs only generate the test.describe() body.
    // fallbackContent: use runtime-captured game content if available, else empty array
    const gameContentFile = path.join(testsDir, 'game-content.json');
    const capturedGameContent = fs.existsSync(gameContentFile) ? (() => { try { return JSON.parse(fs.readFileSync(gameContentFile, 'utf-8')); } catch { return null; } })() : null;
    const fallbackRoundsJs = capturedGameContent && Array.isArray(capturedGameContent.rounds)
      ? JSON.stringify(capturedGameContent.rounds, null, 4)
      : '[]';
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
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
  await dismissPopupIfPresent(page); // Audio popup may appear after first click
  await page.locator('#${transitionSlotId} button').first().click();
  // Wait for game screen: transition slot becomes hidden when game content is shown
  await page.waitForFunction(
    (slotId) => {
      const slot = document.getElementById(slotId);
      return slot && getComputedStyle(slot).display === 'none';
    },
    '${transitionSlotId}',
    { timeout: 10000 }
  );
}

async function clickNextLevel(page) {
  await expect(page.locator('#${transitionSlotId} button')).toBeVisible({ timeout: 10000 });
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
}

// Always use this to submit answers — waits for game state to advance after processing
async function submitAnswer(page, answer) {
  // Snapshot state before submitting
  const snap = await page.evaluate(() => ({
    round: window.gameState.currentRound,
    lives: window.gameState.lives,
  }));
  await page.locator('#answer-input').fill(answer.toString());
  await page.locator('#btn-check').click();
  // Wait until: not processing AND (round advanced, lives changed, or level transition slot visible)
  // Needed because checkAnswer() sets isProcessing=false BEFORE the 400ms roundComplete() timeout fires.
  await expect.poll(async () => {
    return await page.evaluate((s) => {
      if (window.gameState.isProcessing) return false;
      const slot = document.getElementById('mathai-transition-slot');
      const slotVisible = slot && getComputedStyle(slot).display !== 'none';
      return window.gameState.currentRound !== s.round || window.gameState.lives !== s.lives || slotVisible;
    }, snap);
  }, { timeout: 15000 }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // So we MUST dismiss the audio popup first — otherwise the transition slot never appears.
  try {
    const okayBtn = page.locator('button:has-text("Okay!")');
    await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
    await okayBtn.click();
    await page.waitForTimeout(300);
  } catch {
    // No audio popup appeared — game already initialized or popup already dismissed
  }
  await page.waitForFunction(
    (slotId) => {
      const slot = document.getElementById(slotId);
      return slot !== null && slot.querySelector('button') !== null;
    },
    '${transitionSlotId}',
    { timeout: 20000 }
  );
});`;

    for (const category of CATEGORIES) {
      const catTestCases = testCases.filter((tc) => tc.category === category);
      if (catTestCases.length === 0) {
        info(`[pipeline] Step 2b: No test cases for '${category}' — skipping`);
        continue;
      }

      const catFile = path.join(testsDir, `${category}.spec.js`);
      info(`[pipeline] Step 2b: Generating ${category} (${catTestCases.length} test cases)`);

      const catTestCasesText = catTestCases
        .map((tc, i) => `${i + 1}. ${tc.name}: ${tc.description}\n   Steps: ${tc.steps.join(' → ')}`)
        .join('\n');

      const catPrompt = `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

CATEGORY FOCUS: ${categoryDescriptions[category] || category}

IMPLEMENT ALL ${catTestCases.length} TEST CASES BELOW — one test() per case, no skipping, no merging:
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
  - Fills #answer-input, clicks #btn-check, waits for game state to advance (round++, lives--, or slot visible)
  - IMPORTANT: resolves ONLY after the game actually advances to the next state — safe to submit next answer immediately after
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

The following functions are already defined globally — DO NOT redefine them:
  dismissPopupIfPresent(page), startGame(page), clickNextLevel(page), submitAnswer(page, answer)
  test.beforeEach() — already navigates to page and waits for initialization
  fallbackContent — use for round data (numberA, numberB, correctAnswer)

OUTPUT INSTRUCTIONS:
- Output ONLY a single test.describe('${category}', () => { ... }); block
- Do NOT include import statements, beforeEach, helper function definitions, or fallbackContent
- Start directly with: test.describe('${category}', () => {
- Use test() for each test case — NOT nested test.describe() for sub-groups
- Pure JavaScript — no TypeScript type annotations (no : any[], no : string, etc.)
- Use double quotes for test() names: test("test name", async...) — never single quotes in names
- Do NOT access window.timer directly — only use gameState properties listed in the context
- Do NOT assert #timer-container visibility on start/transition screens — hidden until game starts
- For non-numeric input testing (e.g. typing "abc"), use page.evaluate() to set the value directly — page.fill() rejects non-numeric strings on type="number" inputs: await page.evaluate(() => { const el = document.querySelector('#answer-input'); el.value = 'abc'; el.dispatchEvent(new Event('input', { bubbles: true })); })
- Always use submitAnswer() for answer submission — NEVER click #btn-check directly
- NEVER access window.gameState.content — use fallbackContent.rounds[i] instead
- If evaluating JS state: expect(await page.evaluate(() => window.x)).toBe(v) — NOT await expect(page.evaluate(...))
- Slot IDs use '#' prefix; .mathai-rounds-display / .mathai-lives-display use '.' (they are CSS classes)
- DO NOT generate tests that require real wall-clock delays to simulate time-based scoring (e.g. playing slowly for 2-star vs 3-star). These always exceed the 30s timeout. Instead test endGame() postMessage payload for correct star value.
- Do NOT call window.visibilityTracker.onInactive() or window.visibilityTracker.onResume() directly — use document.dispatchEvent(new Event('visibilitychange')) with Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }) first
- Wrap output in a \`\`\`javascript code block
${domSnapshot ? `\n${domSnapshot}\n` : ''}
HTML:
${htmlContent}`;

      let catOutput;
      try {
        catOutput = await trackedLlmCall(`generate-tests-${category}`, catPrompt, TEST_MODEL);
        llmCalls.push({ step: `generate-tests-${category}`, model: TEST_MODEL });
      } catch (err) {
        warn(`[pipeline] Test generation for '${category}' failed: ${err.message} — skipping`);
        continue;
      }

      let catTests = extractTests(catOutput);
      if (!catTests) {
        warn(`[pipeline] Could not extract test.describe() for '${category}' — skipping`);
        continue;
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
    }

    progress('tests-generated', { gameId });
  } // end if (!existingTests)

  // ─── Always-applied test post-processing ────────────────────────────────
  // Critical fixes applied to EVERY spec file on EVERY iteration.
  // This ensures even files from previous iterations have correct infrastructure.
  {
    const allSpecFilePaths = fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : [];

    for (const specFilePath of allSpecFilePaths) {
      let tests = fs.readFileSync(specFilePath, 'utf-8');
      let changed = false;

      // Fix beforeEach: must dismiss audio popup BEFORE waiting for transition slot.
      // FeedbackManager.init() awaits the popup, blocking ScreenLayout.inject() → transition slot never appears.
      if (tests.includes('test.beforeEach') && !tests.includes('FeedbackManager.init() shows')) {
        const oldBeforeEach = /test\.beforeEach\s*\(async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{[\s\S]*?\}\s*\);/;
        const newBeforeEach = `test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // So we MUST dismiss the audio popup first — otherwise the transition slot never appears.
  try {
    const okayBtn = page.locator('button:has-text("Okay!")');
    await okayBtn.waitFor({ state: 'visible', timeout: 8000 });
    await okayBtn.click();
    await page.waitForTimeout(300);
  } catch {
    // No audio popup appeared — game already initialized or popup already dismissed
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

      // Fix #mathai-progress-slot used for button finding (buttons are in transition slot)
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

  // Copy Playwright config
  const pwConfig = path.join(__dirname, '..', 'playwright.config.js');
  if (fs.existsSync(pwConfig)) {
    fs.copyFileSync(pwConfig, path.join(gameDir, 'playwright.config.js'));
  }

  // ─── Step 3: Test → Fix loop (per-batch sequential) ────────────────────
  //
  // Categories run sequentially in batches of CATEGORY_BATCH_SIZE (default 1).
  // Each batch gets its own fix loop — failures in one batch drive targeted HTML fixes
  // before moving to the next batch. This keeps each Playwright run fast and focused.

  // Order spec files by category, then group into batches
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const orderedSpecFiles = [
    ...SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f)),
    // Any extra spec files not in the standard order
    ...(fs.existsSync(testsDir)
      ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.js')).map((f) => path.join(testsDir, f))
      : []
    ).filter((f) => !SPEC_ORDER.some((cat) => f.endsWith(`${cat}.spec.js`))),
  ];

  const batches = [];
  for (let i = 0; i < orderedSpecFiles.length; i += CATEGORY_BATCH_SIZE) {
    batches.push(orderedSpecFiles.slice(i, i + CATEGORY_BATCH_SIZE));
  }

  info(
    `[pipeline] Step 3: Test → Fix loop (${batches.length} batch(es), batch_size=${CATEGORY_BATCH_SIZE}, max_iterations=${MAX_ITERATIONS})`,
  );
  progress('test-fix-loop', { gameId, maxIterations: MAX_ITERATIONS, batches: batches.length });

  // Start local server
  let serverProc;
  try {
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', '8787', '-s', '--no-clipboard'], {
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {
    report.errors.push('Web server failed to start');
    writeReport();
    return report;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    for (const [batchIdx, batch] of batches.entries()) {
      const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
      info(`[pipeline] Batch ${batchIdx + 1}/${batches.length}: ${batchLabel}`);
      progress('batch-start', { gameId, batch: batchLabel, batchIdx, totalBatches: batches.length });

      let batchPassed = 0;
      let batchFailed = 0;
      let fixHistory = '';
      let bestPassed = 0;
      let bestHtmlSnapshot = null; // HTML snapshot at the best pass count so far

      for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        info(`[pipeline] [${batchLabel}] Iteration ${iteration}/${MAX_ITERATIONS}`);

        // Run Playwright tests for this batch only
        let testResult;
        try {
          const { stdout } = await execFileAsync(
            'npx',
            ['playwright', 'test', '--config', path.join(gameDir, 'playwright.config.js'), '--reporter=json', ...batch],
            { timeout: TEST_TIMEOUT, encoding: 'utf-8' },
          );
          testResult = JSON.parse(stdout);
        } catch (err) {
          const stdout = err.stdout || '{}';
          try {
            testResult = JSON.parse(stdout);
          } catch {
            testResult = { stats: { expected: 0, unexpected: 1 } };
          }
        }

        const passed = testResult?.stats?.expected || 0;
        const skipped = testResult?.stats?.skipped || 0;
        let failed = testResult?.stats?.unexpected || 0;
        // If ALL tests skipped with 0 passes: beforeEach timed out (HTML init failure) — treat as failures
        if (passed === 0 && failed === 0 && skipped > 0) {
          warn(`[pipeline] [${batchLabel}] All ${skipped} tests skipped — likely HTML init failure in beforeEach`);
          failed = skipped;
        }
        batchPassed = passed;
        batchFailed = failed;

        const failureDescs = [];
        try {
          collectFailures(testResult.suites, '', failureDescs);
          // If all tests were skipped (beforeEach failure → init problem), collect their names
          if (failureDescs.length === 0 && skipped > 0) {
            const collectSkipped = (suites, pFile) => {
              for (const s of suites || []) {
                const sf = s.file || pFile || '';
                for (const sp of s.specs || []) {
                  if (sp.tests?.some((t) => t.status === 'skipped')) {
                    const lbl = sf ? `[${path.basename(sf)}] ` : '';
                    failureDescs.push(`${lbl}${sp.title} — SKIPPED (beforeEach timed out — HTML init failed)`);
                  }
                }
                if (s.suites) collectSkipped(s.suites, sf);
              }
            };
            collectSkipped(testResult.suites, '');
          }
        } catch {
          /* ignore parse errors */
        }

        const failuresStr = failureDescs.join(', ') || 'unknown';
        report.test_results.push({ batch: batchLabel, iteration, passed, failed, failures: failuresStr });

        info(`[pipeline] [${batchLabel}] Results: ${passed} passed, ${failed} failed`);
        progress('test-result', { gameId, batch: batchLabel, batchIdx, iteration, passed, failed, failures: failureDescs, maxIterations: MAX_ITERATIONS });

        // Track best result and snapshot HTML at that point
        if (passed > bestPassed) {
          bestPassed = passed;
          bestHtmlSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          info(`[pipeline] [${batchLabel}] New best: ${passed} passed — snapshot saved`);
        }

        if (failed === 0 && passed > 0) {
          info(`[pipeline] [${batchLabel}] All tests pass!`);
          break;
        }

        if (iteration >= MAX_ITERATIONS) {
          info(`[pipeline] [${batchLabel}] Max iterations reached`);
          // Restore best snapshot if current result is worse
          if (bestHtmlSnapshot && passed < bestPassed) {
            info(`[pipeline] [${batchLabel}] Restoring best HTML (${bestPassed} passed > current ${passed})`);
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            batchPassed = bestPassed;
            batchFailed = failed - (bestPassed - passed); // approximate
          }
          break;
        }

        // Detect if all tests fail with the same error — likely an init problem in HTML
        const uniqueErrors = new Set(failureDescs.map((f) => f.replace(/.*— /, '').trim()));
        const allSameError = uniqueErrors.size === 1 && failed === failureDescs.length;

        let fixStrategy;
        if (iteration >= 3) {
          fixStrategy = `DIAGNOSIS MODE: This is attempt ${iteration} for the '${batchLabel}' category. Previous fixes have not resolved all issues.

Previous fix history:
${fixHistory}

Diagnose the ROOT CAUSE of the persistent failures before attempting a fix.`;
        } else if (allSameError) {
          fixStrategy = `ALL tests in '${batchLabel}' fail with the same error: "${[...uniqueErrors][0]}". This strongly indicates a game initialization problem in the HTML.

Common cause: external packages (CDN) have not loaded before the game tries to use them, or ScreenLayout.inject() throws because a dependency is not ready.

Fix the HTML so that initialization completes reliably.`;
        } else {
          fixStrategy = `Fix the '${batchLabel}' test failures by modifying the HTML. Do NOT modify the test files.`;
        }

        // ── LLM Triage: decide whether to fix HTML or skip bad tests ────────────
        const triagePrompt = `You are a test triage assistant for a browser-based math game.

CATEGORY: '${batchLabel}'
PASSING: ${passed} tests passed.
FAILING: ${failed} tests failed.

FAILING TEST DETAILS:
${failuresStr}

FAILING TEST FILE:
\`\`\`javascript
${batch.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf-8')).join('\n\n')}
\`\`\`

For each failing test, decide one of:
- "fix_html": The HTML game logic is genuinely broken. A targeted HTML fix will resolve it.
- "skip_test": The test has a wrong assumption, tests untestable behavior (e.g. headless tab visibility), or has a logic error. The HTML is correct.

Respond ONLY as valid JSON:
{
  "decision": "fix_html" | "skip_tests" | "mixed",
  "fix_hints": "Brief description of what specifically to fix in the HTML (only if fix_html or mixed)",
  "tests_to_skip": ["exact test name", ...],
  "rationale": "One sentence explanation"
}`;

        let triageDecision = 'fix_html';
        let triageFixHints = '';
        let triageSkipTests = [];
        try {
          const triageOutput = await trackedLlmCall(`triage-${batchLabel}-${iteration}`, triagePrompt, FIX_MODEL);
          llmCalls.push({ step: `triage-${batchLabel}-${iteration}`, model: FIX_MODEL });
          const jsonMatch = triageOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const triage = JSON.parse(jsonMatch[0]);
            triageDecision = triage.decision || 'fix_html';
            triageFixHints = triage.fix_hints || '';
            triageSkipTests = triage.tests_to_skip || [];
            info(`[pipeline] [${batchLabel}] Triage: ${triageDecision} — ${triage.rationale || ''}`);
          }
        } catch {
          info(`[pipeline] [${batchLabel}] Triage failed, defaulting to fix_html`);
        }

        // Remove skipped tests from spec file
        if (triageSkipTests.length > 0) {
          for (const specFile of batch.filter((f) => fs.existsSync(f))) {
            let specContent = fs.readFileSync(specFile, 'utf-8');
            let changed = false;
            for (const testName of triageSkipTests) {
              // Match test("name", async ...) blocks and replace with a skip comment
              const escaped = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const testBlockRe = new RegExp(`test\\s*\\(\\s*["'\`]${escaped}["'\`][\\s\\S]*?^\\}\\);`, 'gm');
              const replaced = specContent.replace(testBlockRe, `// SKIPPED (triage): ${testName}`);
              if (replaced !== specContent) {
                specContent = replaced;
                changed = true;
                info(`[pipeline] [${batchLabel}] Triage skipped test: "${testName}"`);
              }
            }
            if (changed) fs.writeFileSync(specFile, specContent);
          }
          // If all tests skipped, move to next batch
          if (triageDecision === 'skip_tests') {
            info(`[pipeline] [${batchLabel}] All failures are test logic issues — skipping fix iteration`);
            break;
          }
        }

        if (triageDecision === 'skip_tests') {
          info(`[pipeline] [${batchLabel}] Triage: no HTML fix needed`);
          // If current HTML is worse than best (e.g. broken by previous fix), restore best snapshot
          if (bestHtmlSnapshot && passed < bestPassed) {
            info(`[pipeline] [${batchLabel}] Restoring best HTML before exiting batch (${bestPassed} passed > current ${passed})`);
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            batchPassed = bestPassed;
          }
          break;
        }

        // ── Build fix prompt with passing test context ───────────────────────
        // Collect passing test names AND extract their full code bodies
        const passingTestNames = [];
        const passingTestBodies = [];
        try {
          const collectPassing = (suites) => {
            for (const suite of suites || []) {
              for (const spec of suite.specs || []) {
                if (spec.tests?.every((t) => t.status === 'expected')) {
                  passingTestNames.push(spec.title);
                }
              }
              collectPassing(suite.suites);
            }
          };
          collectPassing(testResult.suites);

          // Extract the full test() bodies from the spec files for passing tests
          if (passingTestNames.length > 0) {
            for (const specFile of batch.filter((f) => fs.existsSync(f))) {
              const specSrc = fs.readFileSync(specFile, 'utf-8');
              for (const name of passingTestNames) {
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Match test("name", async ({ page }) => { ... }); block
                const m = specSrc.match(new RegExp(`test\\s*\\(\\s*["'\`]${escaped}["'\`][\\s\\S]*?^\\}\\s*\\);`, 'm'));
                if (m) passingTestBodies.push(m[0]);
              }
            }
          }
        } catch { /* ignore */ }

        const currentHtml = fs.readFileSync(htmlFile, 'utf-8');
        const batchTests = batch
          .filter((f) => fs.existsSync(f))
          .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
          .join('\n\n');

        const passingContext = passingTestNames.length > 0
          ? `\nCURRENTLY PASSING TESTS — these MUST keep passing (full code included so you know exactly what they test):\n\`\`\`javascript\n${passingTestBodies.join('\n\n')}\n\`\`\`\n`
          : '';

        const fixHintContext = triageFixHints ? `\nTARGETED FIX HINT: ${triageFixHints}\n` : '';

        const fixPrompt = `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}
FAILING TESTS (${failed} failures):
${failuresStr}
${passingContext}
FAILING TEST FILE(S):
\`\`\`javascript
${batchTests}
\`\`\`

CURRENT HTML:
${currentHtml}

CRITICAL CDN CONSTRAINTS (do NOT violate these while fixing):
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget: .catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); }), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- isProcessing=true must SILENTLY BLOCK clicks (early return), NOT hide/show elements — buttons stay visible
- CDN init order is immutable: await FeedbackManager.init() → ScreenLayout.inject() → game template clone
- Do NOT add event listeners inside innerHTML setters — use event delegation on parent only
- Do NOT move CDN <script> tags or change their order
- Do NOT remove or rename elements in <template id="game-template"> — template corruption causes ALL tests to fail (0/0)
- Star display MUST update on game over: show ☆☆☆ for 0 stars in the game-over code path, not only on victory
- Lives display DOM element MUST update immediately when a life is lost, before any animation
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() IMMEDIATELY in endGame() — destroys CDN DOM elements; tests check them AFTER game over. Use 10s delay: setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
- TimerComponent MUST be initialized with startTime: 0 (never startTime: 1)
- NEVER define a custom updateLivesDisplay() function — let ProgressBarComponent handle lives display via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- Preserve ALL existing data-testid attributes — never remove them; add data-testid to any new elements you create

OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ONLY the failing tests — the passing tests listed above MUST continue to pass
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the failures`;

        fixHistory += `\nIteration ${iteration}: ${failed} failures — ${failuresStr}`;

        let fixOutput;
        try {
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-${iteration}`, fixPrompt, FIX_MODEL);
          llmCalls.push({ step: `fix-${batchLabel}-${iteration}`, model: FIX_MODEL });
        } catch {
          try {
            fixOutput = await trackedLlmCall(`fix-${batchLabel}-fallback-${iteration}`, fixPrompt, FALLBACK_MODEL);
            llmCalls.push({ step: `fix-${batchLabel}-fallback-${iteration}`, model: FALLBACK_MODEL });
          } catch {
            warn(`[pipeline] Both fix models failed for batch '${batchLabel}'`);
            continue;
          }
        }

        const fixedHtml = extractHtml(fixOutput);
        if (fixedHtml) {
          // Snapshot current HTML before applying fix — used for rollback if fix regresses
          const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          fs.writeFileSync(htmlFile, fixedHtml + '\n');
          progress('html-fixed', { gameId, htmlFile, batch: batchLabel, iteration, passed: batchPassed, failed: batchFailed, total: batchPassed + batchFailed });

          // Quick sanity: if fix shrank HTML dramatically (>30% smaller), it likely dropped game logic — rollback
          const shrinkRatio = fixedHtml.length / preFixSnapshot.length;
          if (shrinkRatio < 0.7) {
            warn(`[pipeline] [${batchLabel}] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, rolling back`);
            fs.writeFileSync(htmlFile, preFixSnapshot);
            progress('html-fix-rolled-back', { gameId, batch: batchLabel, iteration, reason: 'size-drop' });
            break;
          }
        }
      }

      totalPassed += batchPassed;
      totalFailed += batchFailed;
      report.category_results[batchLabel] = { passed: batchPassed, failed: batchFailed };
    }
  } finally {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* already dead */
      }
    }
  }

  const lastPassed = totalPassed;
  const lastFailed = totalFailed;

  // ─── Step 4: Review ─────────────────────────────────────────────────────

  const totalTests = lastPassed + lastFailed;
  const passRate = totalTests > 0 ? lastPassed / totalTests : 0;

  // Allow review if ≥70% of tests pass — reviewer evaluates functional quality
  // Skip review only when clearly broken: <50% pass rate or zero passing tests
  if (passRate < 0.5 || lastPassed === 0) {
    report.status = 'FAILED';
    report.review_result = 'SKIPPED';
    writeReport();
    return report;
  }

  info(`[pipeline] Step 4: Review (${lastPassed}/${totalTests} tests passing)`);
  progress('review', { gameId, model: REVIEW_MODEL });

  const reviewPrompt = `You are a game quality reviewer. Review the following HTML game against its specification.

The SPECIFICATION contains a 'Verification Checklist' section (Section 14 or 15) with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

## Important Guidance to Avoid False Positives

### RULE-001 (Global scope — all onclick handlers global)
RULE-001 is SATISFIED if ALL of the following are true:
1. All game functions (startGame, checkAnswer, adjustNumber, resetAdjustments, etc.) are declared at the top level of the script — NOT inside a module, class, or nested closure.
2. Event handlers (whether using onclick= attributes OR addEventListener) call only these globally-declared functions.
RULE-001 does NOT require onclick= attributes. addEventListener() calling a globally-declared function is equally compliant.
RULE-001 FAILS only if event handlers reference functions that are inside a closure and not accessible from global scope.

### Game-Specific delta badge items (Adjustment Strategy)
When reviewing "Delta > 0: adjusted value shown below (+ area), green badge with '+N'" and "Delta < 0: adjusted value shown above (− area), red badge with '-N'":
- "shown below (+ area)" means the adjusted value appears in the adj-bottom-area div (the area below the number box that normally holds the + button). It PASSES if the adjusted value display element appears anywhere inside adj-bottom-area, even alongside the + button.
- "shown above (− area)" means the adjusted value appears in the adj-top-area div (the area above the number box that normally holds the − button). It PASSES if the adjusted value display element appears anywhere inside adj-top-area, even alongside the − button.
- The + and − buttons MAY remain visible alongside the adjusted value (to allow multiple adjustments). This is correct behavior per the spec scenarios. Do NOT flag this as a failure.
- EXAMPLE of CORRECT delta > 0 bottom area: <div class="adjusted-value-display">...</div><button class="adj-btn adj-plus" id="btn-a-plus">+</button> — the value IS in the bottom area. APPROVED.
- EXAMPLE of CORRECT delta < 0 top area: <button class="adj-btn adj-minus" id="btn-a-minus">−</button><div class="adjusted-value-display">...</div> — the value IS in the top area. APPROVED.

### Game-Specific independent adjustment check (Adjustment Strategy)
When reviewing "Each click adjusts by ±1 (independent — adjusting A does NOT affect B)":
- To verify: find the adjustNumber function. It PASSES if:
  1. When which === 'a', only gameState.deltaA is modified (not deltaB)
  2. When which === 'b', only gameState.deltaB is modified (not deltaA)
  3. The direction is always ±1 (data-dir="-1" or data-dir="1" on buttons)
- Do NOT fail this item unless you can show a specific code path where clicking A modifies B or vice versa.
- The presence of both deltaA and deltaB in trackEvent payloads (for logging purposes) does NOT mean they are coupled — they are read-only in that context.

### Contract Compliance — gameState initialization
When reviewing "Contract Compliance > gameState, attempts, metrics, duration_data, postMessage schemas":
- window.gameState = { ... } IS the correct pattern — it exposes gameState on window as required. Do NOT require "let gameState" or "const gameState".
- window.parent.postMessage(...) is the correct postMessage call for game_complete events.
- Check that the postMessage payload has type: 'game_complete' and data: { metrics, events, completedAt }.
- Check that metrics includes: accuracy, stars, time, avgTimePerLevel, roundsCompleted, wrongAttempts, duration_data.
- Check that duration_data has: startTime, preview, attempts, evaluations, inActiveTime, totalInactiveTime.

### RULE-003 (try/catch on async calls)
When reviewing RULE-003 (try/catch on all async calls):
- FeedbackManager.playDynamicFeedback(...).catch((e) => { console.error(...) }) IS compliant. Promise .catch() is the correct try/catch equivalent for fire-and-forget calls. Do NOT require the archaic try { await } catch pattern for fire-and-forget audio calls.
- The .catch handler MUST log the error (not silently swallow). An empty .catch(() => {}) FAILS RULE-003.
- All other async calls (that are awaited) must use try/catch.

### RULE-005 (Cleanup in endGame)
When reviewing RULE-005 (cleanup in endGame):
- A 10-second delayed destroy via setTimeout IS compliant. The cleanup call originates from endGame() — it satisfies the requirement that cleanup is done in endGame.
- Immediate destroy (no setTimeout) is also correct per the spec, but causes tests to fail because CDN DOM elements are removed while tests are still running.
- Either pattern (immediate or 10s delay) PASSES RULE-005.

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

HTML:
${fs.readFileSync(htmlFile, 'utf-8')}`;

  let reviewResult;
  try {
    reviewResult = await trackedLlmCall('review', reviewPrompt, REVIEW_MODEL);
    llmCalls.push({ step: 'review', model: REVIEW_MODEL });
  } catch {
    warn('[pipeline] Review LLM call failed — treating as approved');
    report.status = 'APPROVED';
    report.review_result = 'SKIPPED_LLM_FAILURE';
    writeReport();
    return report;
  }

  report.review_result = reviewResult;

  if (/^APPROVED/i.test(reviewResult)) {
    report.status = 'APPROVED';
    info('[pipeline] APPROVED by review');
  } else {
    report.status = 'REJECTED';
    warn(`[pipeline] Review rejected: ${reviewResult}`);
  }

  progress('review-complete', { gameId, status: report.status, reviewResult, categoryResults: report.category_results });

  writeReport();
  return report;
}

// ─── Targeted fix: apply user feedback to existing HTML ─────────────────────

const TARGETED_FIX_MAX_ATTEMPTS = 2;

// Detect which test category is most relevant to the feedback
function detectFixCategory(feedbackPrompt) {
  const fp = feedbackPrompt.toLowerCase();
  if (/button|click|answer|submit|check|adjust|delta|reset|input/.test(fp)) return 'mechanics';
  if (/level|transition|next level|round 3|round 6|level-progression/.test(fp)) return 'level-progression';
  if (/start screen|game screen|restart|play again|game flow|game-flow/.test(fp)) return 'game-flow';
  if (/lives|game over|final round|edge|empty|invalid|edge-case/.test(fp)) return 'edge-cases';
  if (/postmessage|score|stars|contract|gameover|life_lost|event/.test(fp)) return 'contract';
  return null; // run all available spec files
}

async function runTargetedFix(gameDir, specPath, feedbackPrompt, options = {}) {
  const { logger: log, onProgress } = options;
  const info = log ? (msg) => log.info(msg) : console.log;
  const warn = log ? (msg) => log.warn(msg) : console.warn;

  function progress(step, detail) {
    if (onProgress) {
      try {
        onProgress(step, detail);
      } catch {
        /* ignore */
      }
    }
  }

  const startTime = Date.now();
  const gameId = path.basename(path.dirname(specPath));
  const htmlFile = path.join(gameDir, 'index.html');
  const testsDir = path.join(gameDir, 'tests');
  const reportFile = path.join(gameDir, 'ralph-report.json');
  const llmCalls = [];

  // Determine which spec files to run — prefer category-targeted files
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const detectedCategory = options.category || detectFixCategory(feedbackPrompt);
  const allSpecFiles = SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f));
  const targetSpecFiles = detectedCategory
    ? allSpecFiles.filter((f) => f.includes(detectedCategory))
    : allSpecFiles;
  // Fall back to all available specs if category-specific file doesn't exist
  const specFiles = targetSpecFiles.length > 0 ? targetSpecFiles : allSpecFiles;

  const report = {
    game_id: gameId,
    spec: specPath,
    status: 'FAILED',
    type: 'targeted-fix',
    iterations: 0,
    generation_time_s: 0,
    total_time_s: 0,
    test_results: [],
    review_result: null,
    errors: [],
    models: { fix: FIX_MODEL },
    artifacts: [],
    llm_calls: 0,
    feedback_prompt: feedbackPrompt,
    timestamp: new Date().toISOString(),
  };

  function writeReport() {
    report.total_time_s = Math.round((Date.now() - startTime) / 1000);
    report.llm_calls = llmCalls.length;
    report.artifacts = fs.existsSync(htmlFile) ? ['index.html'] : [];
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  if (!fs.existsSync(htmlFile)) {
    report.errors.push('No existing HTML file to fix');
    writeReport();
    return report;
  }

  if (!fs.existsSync(specPath)) {
    report.errors.push('Spec file not found');
    writeReport();
    return report;
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');

  const categoryLabel = detectedCategory || (specFiles.length === 1 ? path.basename(specFiles[0], '.spec.js') : 'all');
  progress('targeted-fix-start', { gameId, feedback: feedbackPrompt, category: categoryLabel, specFiles: specFiles.map((f) => path.basename(f)) });
  info(`[targeted-fix] Category: ${categoryLabel} | Test files: ${specFiles.map((f) => path.basename(f)).join(', ') || 'none'}`);

  // Helper: run playwright against specific spec files
  async function runSpecFiles(files) {
    if (files.length === 0) return { passed: 0, failed: 0, failures: [] };
    let testResult;
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['playwright', 'test', '--config', path.join(gameDir, 'playwright.config.js'), '--reporter=json', ...files],
        { timeout: TEST_TIMEOUT, encoding: 'utf-8' },
      );
      testResult = JSON.parse(stdout);
    } catch (err) {
      const stdout = err.stdout || '{}';
      try {
        testResult = JSON.parse(stdout);
      } catch {
        testResult = { stats: { expected: 0, unexpected: 1 } };
      }
    }
    const passed = testResult?.stats?.expected || 0;
    const failed = testResult?.stats?.unexpected || 0;
    const failureStrings = [];
    collectFailures(testResult?.suites || [], '', failureStrings);
    return { passed, failed, failures: failureStrings };
  }

  let bestPassed = 0;
  let bestHtml = null;

  // Start local server for testing
  let serverProc;
  try {
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', '8787', '-s', '--no-clipboard'], {
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {
    report.errors.push('Web server failed to start');
    writeReport();
    return report;
  }

  try {
    // Establish baseline before applying any fix
    if (specFiles.length > 0) {
      info('[targeted-fix] Running baseline tests before fix...');
      const baseline = await runSpecFiles(specFiles);
      bestPassed = baseline.passed;
      bestHtml = fs.readFileSync(htmlFile, 'utf-8');
      report.test_results.push({ attempt: 0, passed: baseline.passed, failed: baseline.failed, label: 'baseline' });
      info(`[targeted-fix] Baseline: ${baseline.passed} passed, ${baseline.failed} failed`);
      progress('targeted-fix-baseline', { gameId, passed: baseline.passed, failed: baseline.failed, failures: baseline.failures });
    }

    for (let attempt = 1; attempt <= TARGETED_FIX_MAX_ATTEMPTS; attempt++) {
      report.iterations = attempt;
      info(`[targeted-fix] Attempt ${attempt}/${TARGETED_FIX_MAX_ATTEMPTS}`);
      progress('targeted-fix-attempt', { gameId, attempt, category: categoryLabel });

      // Build context: failing tests from baseline (or previous attempt)
      const prevResult = report.test_results[report.test_results.length - 1];
      const failingContext = prevResult?.failures?.length > 0
        ? `\nFAILING TESTS:\n${prevResult.failures.slice(0, 5).map((f) => `• ${f}`).join('\n')}`
        : '';
      const passingContext = prevResult?.passed > 0
        ? `\nPASSING TESTS (do NOT break these — ${prevResult.passed} currently passing)`
        : '';

      const fixPrompt = `You are fixing an HTML game based on user feedback.

USER FEEDBACK:
${feedbackPrompt}
${failingContext}
${passingContext}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

SPECIFICATION (for reference):
${specContent}

CRITICAL CDN CONSTRAINTS:
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget (.catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); })), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- Do NOT destroy CDN components immediately in endGame() — use 10s setTimeout delay
- TimerComponent startTime MUST be 0; endGame() MUST be async if it uses await
- Do NOT define a custom updateLivesDisplay() — let ProgressBarComponent handle it

INSTRUCTIONS:
- Apply ONLY the changes needed to address the user's feedback and failing tests
- Maintain all existing functionality — especially the ${prevResult?.passed || 0} currently passing tests
- Keep element IDs, data-testid attributes, function names, and game logic aligned with the spec
- Make the SMALLEST possible change that fixes the problem
- Output the complete fixed HTML wrapped in a \`\`\`html code block`;

      let fixOutput;
      try {
        fixOutput = await trackedLlmCall(`targeted-fix-${attempt}`, fixPrompt, FIX_MODEL);
        llmCalls.push({ step: `targeted-fix-${attempt}`, model: FIX_MODEL });
      } catch (err) {
        report.errors.push(`Fix attempt ${attempt} failed: ${err.message}`);
        continue;
      }

      const fixedHtml = extractHtml(fixOutput);
      if (!fixedHtml) {
        report.errors.push(`Attempt ${attempt}: could not extract HTML`);
        continue;
      }

      // Snapshot current HTML for rollback
      const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
      fs.writeFileSync(htmlFile, fixedHtml + '\n');

      // Static validation gate
      const staticResult = runStaticValidation(htmlFile);
      if (!staticResult.passed) {
        warn(`[targeted-fix] Static validation failed on attempt ${attempt} — rolling back`);
        fs.writeFileSync(htmlFile, preFixSnapshot);
        report.errors.push(`Attempt ${attempt}: static validation failed`);
        continue;
      }

      if (specFiles.length === 0) {
        // No test files exist — approve based on static validation only
        report.status = 'APPROVED';
        report.review_result = 'Targeted fix applied (no test files found)';
        info('[targeted-fix] No test files found — approving based on static validation');
        break;
      }

      // Run target tests
      const testResult = await runSpecFiles(specFiles);
      report.test_results.push({ attempt, passed: testResult.passed, failed: testResult.failed, failures: testResult.failures });
      progress('targeted-fix-test', { gameId, attempt, category: categoryLabel, passed: testResult.passed, failed: testResult.failed, failures: testResult.failures });
      info(`[targeted-fix] Attempt ${attempt}: ${testResult.passed} passed, ${testResult.failed} failed`);

      // Rollback if fix regressed (fewer passing tests than best)
      if (testResult.passed < bestPassed) {
        warn(`[targeted-fix] Regression: ${testResult.passed} < best ${bestPassed} — rolling back to best HTML`);
        fs.writeFileSync(htmlFile, bestHtml);
        report.errors.push(`Attempt ${attempt}: fix caused regression (${testResult.passed} < ${bestPassed} passed) — rolled back`);
        continue;
      }

      // Track best result
      if (testResult.passed > bestPassed) {
        bestPassed = testResult.passed;
        bestHtml = fixedHtml + '\n';
      }

      if (testResult.failed === 0 && testResult.passed > 0) {
        report.status = 'APPROVED';
        report.review_result = `Targeted fix passed all ${testResult.passed} tests in category: ${categoryLabel}`;
        info(`[targeted-fix] All tests pass on attempt ${attempt}`);
        break;
      }
    }

    // If we didn't reach APPROVED but improved from baseline, report partial improvement
    if (report.status !== 'APPROVED' && bestHtml) {
      fs.writeFileSync(htmlFile, bestHtml);
      info(`[targeted-fix] Best result: ${bestPassed} passing — HTML restored to best snapshot`);
    }
  } finally {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* already dead */
      }
    }
  }

  progress('targeted-fix-complete', { gameId, status: report.status, category: detectedCategory, bestPassed });
  writeReport();
  return report;
}

module.exports = { runPipeline, runTargetedFix, extractHtml, extractTests };
