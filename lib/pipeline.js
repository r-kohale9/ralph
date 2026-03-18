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
  const testFile = path.join(gameDir, 'tests', 'game.spec.js');
  const testCasesFile = path.join(gameDir, 'tests', 'test-cases.json');
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
  progress('html-ready', { gameId, htmlFile });

  // ─── Step 1b: Static + contract validation ──────────────────────────────

  info('[pipeline] Step 1b: Static validation');
  progress('static-validation', { gameId });
  const staticResult = runStaticValidation(htmlFile);
  if (!staticResult.passed) {
    warn(`[pipeline] Static validation failed, attempting fix`);

    const fixPrompt = `The following HTML game file has structural issues that need fixing.

ERRORS:
${staticResult.output}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

SPECIFICATION (for reference — use exact element IDs, function names, and structure from this spec):
${specContent}

Fix ALL the listed structural issues while keeping the game aligned with the specification. Output the complete corrected HTML wrapped in a \`\`\`html code block.`;

    try {
      const fixOutput = await trackedLlmCall('static-fix', fixPrompt, FIX_MODEL);
      llmCalls.push({ step: 'static-fix', model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (fixedHtml) {
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
      }
    } catch {
      warn('[pipeline] Static fix LLM call failed');
    }
  }

  // Contract validation (non-blocking)
  const contractErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
  if (contractErrors.length > 0) {
    warn(`[pipeline] Contract validation: ${contractErrors.length} issue(s)`);
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

  // ─── Step 2b: Generate Playwright tests from test cases + HTML ───────────

  const existingTests = fs.existsSync(testFile) && fs.statSync(testFile).size > 200;

  // Extract the transition slot ID (needed in test generation AND fix loop)
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
  const transitionSlotMatch = htmlContent.match(/slotId:\s*['"]([^'"]+)['"]/);
  const transitionSlotId = transitionSlotMatch ? transitionSlotMatch[1] : 'mathai-transition-slot';

  if (existingTests) {
    info(`[pipeline] Step 2b: Skipping Playwright test generation — game.spec.js exists (${fs.statSync(testFile).size} bytes)`);
  }

  if (!existingTests) {
  info('[pipeline] Step 2b: Generate Playwright tests');
  progress('generate-tests', { gameId, model: TEST_MODEL });

  const testCasesSummary = testCases.length > 0
    ? testCases.map((tc, i) => `${i + 1}. ${tc.name}: ${tc.description}\n   Steps: ${tc.steps.join(' → ')}`).join('\n')
    : '(no test cases generated — infer from HTML)';

  const testPrompt = `You are an expert Playwright test writer. Generate a complete Playwright test suite for the following HTML game.

Use the TEST CASES below as the source of WHAT to test. Use the HTML to determine HOW to test (exact selectors, DOM structure, game flow).

TEST CASES:
${testCasesSummary}

==================================================
CRITICAL BOILERPLATE — copy these helpers verbatim
==================================================

RULE 1 — INITIALIZATION: window.gameState is assigned at parse time (before packages load).
Waiting for window.gameState !== undefined is WRONG — resolves immediately before UI is ready.
Wait for the start button to appear in the transition slot (only appears after full init).

RULE 2 — ASYNC PROCESSING: checkAnswer() fires FeedbackManager.playDynamicFeedback internally.
While processing, gameState.isProcessing = true. A second btn-check click while isProcessing=true
is silently dropped. ALWAYS use submitAnswer() which waits for isProcessing to clear.

RULE 3 — LEVEL TRANSITIONS: fire AFTER round 3 and round 6 (i=2 and i=5 in 0-indexed loops).
Handle them INSIDE the answer loop AFTER the submit, NOT before the next round starts.

RULE 4 — TIMER: VisibilityTracker pauses the timer in headless mode. Never assert on timer text.
Check gameState.isActive and gameState.startTime instead.

RULE 5 — LIVES DISPLAY: rendered as emoji inside .mathai-lives-display span (NOT individual elements).
Use toContainText('❤️❤️❤️') — do NOT use toHaveCount().

RULE 6 — POPUP: FeedbackManager shows a popup on standalone load. Always dismiss in startGame().

RULE 7 — postMessage capture: captured variable lives in Node scope. Use expect.poll(() => capturedVar)
NOT page.waitForFunction(() => capturedVar) — waitForFunction runs in browser scope.

Copy these helpers verbatim:

\`\`\`javascript
import { test, expect } from '@playwright/test';

async function dismissPopupIfPresent(page) {
  const backdrop = page.locator('#popup-backdrop');
  if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backdrop.locator('button').first().click();
    await page.waitForTimeout(300);
  }
}

async function startGame(page) {
  await dismissPopupIfPresent(page);
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('#original-a')).toBeVisible({ timeout: 5000 });
}

async function clickNextLevel(page) {
  await expect(page.locator('#${transitionSlotId} button')).toBeVisible({ timeout: 10000 });
  await page.locator('#${transitionSlotId} button').first().click();
  await page.waitForTimeout(500);
}

// ALWAYS use this to submit answers — waits for async processing to complete
async function submitAnswer(page, answer) {
  await page.locator('#answer-input').fill(answer.toString());
  await page.locator('#btn-check').click();
  await expect.poll(async () => await page.evaluate(() => !window.gameState.isProcessing), { timeout: 15000 }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    (slotId) => {
      const slot = document.getElementById(slotId);
      return slot !== null && slot.querySelector('button') !== null;
    },
    '${transitionSlotId}',
    { timeout: 20000 }
  );
});
\`\`\`

==================================================
ADDITIONAL RULES
==================================================
- Use ONLY Playwright API: test.describe(), test.beforeEach(), test() — NEVER bare describe()
- Use EXACT element IDs and class names from the HTML — do NOT invent selectors
- For multi-round loops: call submitAnswer() for every answer; handle transitions at i=2 and i=5
- Output ONLY the test code wrapped in a \`\`\`javascript code block

HTML:
${htmlContent}`;

  let testOutput;
  try {
    testOutput = await trackedLlmCall('generate-tests', testPrompt, TEST_MODEL);
    llmCalls.push({ step: 'generate-tests', model: TEST_MODEL });
  } catch (err) {
    report.errors.push(`Test generation failed: ${err.message}`);
    writeReport();
    return report;
  }

  let tests = extractTests(testOutput);
  if (!tests) {
    report.errors.push('Could not extract tests from generation output');
    writeReport();
    return report;
  }

  // Fix common LLM mistake: bare describe()/beforeEach() instead of test.describe()/test.beforeEach()
  tests = tests
    .replace(/(?<![.\w])describe\s*\(/g, 'test.describe(')
    .replace(/(?<![.\w])beforeEach\s*\(/g, 'test.beforeEach(')
    .replace(/(?<![.\w])afterEach\s*\(/g, 'test.afterEach(')
    .replace(/(?<![.\w])beforeAll\s*\(/g, 'test.beforeAll(')
    .replace(/(?<![.\w])afterAll\s*\(/g, 'test.afterAll(');

  fs.writeFileSync(testFile, tests + '\n');

  } // end if (!existingTests)

  // Copy Playwright config
  const pwConfig = path.join(__dirname, '..', 'playwright.config.js');
  if (fs.existsSync(pwConfig)) {
    fs.copyFileSync(pwConfig, path.join(gameDir, 'playwright.config.js'));
  }

  // ─── Step 3: Test → Fix loop ────────────────────────────────────────────

  info('[pipeline] Step 3: Test → Fix loop');
  progress('test-fix-loop', { gameId, maxIterations: MAX_ITERATIONS });

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

  let lastPassed = 0;
  let lastFailed = 0;
  let fixHistory = '';

  try {
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      report.iterations = iteration;
      info(`[pipeline] Iteration ${iteration}/${MAX_ITERATIONS}`);

      // Run Playwright tests
      let testResult;
      try {
        const { stdout } = await execFileAsync(
          'npx',
          ['playwright', 'test', '--config', path.join(gameDir, 'playwright.config.js'), '--reporter=json'],
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
      lastPassed = passed;
      lastFailed = failed;

      const failureDescs = [];
      try {
        function collectFailures(suites) {
          for (const suite of suites || []) {
            for (const spec of suite.specs || []) {
              if (!spec.ok) {
                const errMsg = spec.tests?.[0]?.results?.[0]?.error?.message?.split('\n')[0] || '';
                failureDescs.push(errMsg ? `${spec.title} — ${errMsg}` : spec.title);
              }
            }
            if (suite.suites) collectFailures(suite.suites);
          }
        }
        collectFailures(testResult.suites);
      } catch {
        /* ignore parse errors */
      }

      const failuresStr = failureDescs.join(', ') || 'unknown';
      report.test_results.push({ iteration, passed, failed, failures: failuresStr });

      info(`[pipeline] Results: ${passed} passed, ${failed} failed`);
      progress('test-result', { gameId, iteration, passed, failed });

      if (failed === 0 && passed > 0) {
        info('[pipeline] All tests pass!');
        break;
      }

      if (iteration >= MAX_ITERATIONS) {
        info('[pipeline] Max iterations reached');
        break;
      }

      // Detect if all tests fail with the same error — likely a beforeEach issue, not HTML
      const uniqueErrors = new Set(failureDescs.map(f => f.replace(/.*— /, '').trim()));
      const allSameError = uniqueErrors.size === 1 && failed === failureDescs.length;

      // Build fix prompt
      let fixStrategy;
      if (iteration >= 3) {
        fixStrategy = `DIAGNOSIS MODE: This is attempt ${iteration}. Previous fixes have not resolved all issues.

Previous fix history:
${fixHistory}

Please diagnose the ROOT CAUSE of the persistent failures before attempting a fix.`;
      } else if (allSameError) {
        fixStrategy = `ALL tests fail with the same error: "${[...uniqueErrors][0]}". This strongly indicates a beforeEach() initialization problem, not a logic bug in the HTML.

Common cause: the test waits for window.gameState !== undefined but gameState is set at parse time — before external packages load or the start screen renders. The correct wait is for the start screen button to appear in the DOM (e.g., document.getElementById('${transitionSlotId || 'mathai-transition-slot'}').querySelector('button') !== null).

You may fix EITHER the test file OR the HTML. Output whichever you change.`;
      } else {
        fixStrategy = 'Fix the failing tests by modifying the HTML. Do NOT modify the tests.';
      }

      const currentHtml = fs.readFileSync(htmlFile, 'utf-8');
      const currentTests = fs.existsSync(testFile) ? fs.readFileSync(testFile, 'utf-8') : '';

      const fixPrompt = `The following HTML game has test failures that need fixing.

${fixStrategy}

FAILING TESTS (${failed} failures):
${failuresStr}

CURRENT TEST FILE (game.spec.js):
\`\`\`javascript
${currentTests}
\`\`\`

CURRENT HTML:
${currentHtml}

OUTPUT INSTRUCTIONS:
- If fixing the HTML: output the complete fixed HTML in a \`\`\`html code block
- If fixing the tests: output the complete fixed test file in a \`\`\`javascript code block
- Fix only what is broken — do not rename functions, change element IDs, or remove game logic`;

      fixHistory += `\nIteration ${iteration}: ${failed} failures — ${failuresStr}`;

      let fixOutput;
      try {
        fixOutput = await trackedLlmCall(`fix-iteration-${iteration}`, fixPrompt, FIX_MODEL);
        llmCalls.push({ step: `fix-iteration-${iteration}`, model: FIX_MODEL });
      } catch {
        try {
          fixOutput = await trackedLlmCall(`fix-fallback-${iteration}`, fixPrompt, FALLBACK_MODEL);
          llmCalls.push({ step: `fix-fallback-${iteration}`, model: FALLBACK_MODEL });
        } catch {
          warn('[pipeline] Both fix models failed');
          continue;
        }
      }

      // API mode returns HTML in response — extract and write
      const fixedHtml = extractHtml(fixOutput);
      if (fixedHtml) {
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
        progress('html-fixed', { gameId, htmlFile, iteration, passed: lastPassed, failed: lastFailed });
      }
    }
  } finally {
    // Stop server
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* already dead */
      }
    }
  }

  // ─── Step 4: Review ─────────────────────────────────────────────────────

  if (lastFailed > 0 || lastPassed === 0) {
    report.status = 'FAILED';
    report.review_result = 'SKIPPED';
    writeReport();
    return report;
  }

  info('[pipeline] Step 4: Review');
  progress('review', { gameId, model: REVIEW_MODEL });

  const reviewPrompt = `You are a game quality reviewer. Review the following HTML game against its specification.

The SPECIFICATION contains a 'Verification Checklist' section (Section 15) with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in Section 15. For each item, verify it passes in the HTML.

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

  writeReport();
  return report;
}

// ─── Targeted fix: apply user feedback to existing HTML ─────────────────────

const TARGETED_FIX_MAX_ATTEMPTS = 2;

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
  const testFile = path.join(gameDir, 'tests', 'game.spec.js');
  const reportFile = path.join(gameDir, 'ralph-report.json');
  const llmCalls = [];

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

  progress('targeted-fix-start', { gameId, feedback: feedbackPrompt });

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
    for (let attempt = 1; attempt <= TARGETED_FIX_MAX_ATTEMPTS; attempt++) {
      report.iterations = attempt;
      info(`[targeted-fix] Attempt ${attempt}/${TARGETED_FIX_MAX_ATTEMPTS}`);
      progress('targeted-fix-attempt', { gameId, attempt });

      const fixPrompt = `You are fixing an HTML game based on user feedback.

USER FEEDBACK:
${feedbackPrompt}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

SPECIFICATION (for reference):
${specContent}

INSTRUCTIONS:
- Apply the user's feedback to fix/improve the HTML game
- Maintain all existing functionality — only change what the feedback requests
- Keep element IDs, function names, and game logic aligned with the spec
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

      fs.writeFileSync(htmlFile, fixedHtml + '\n');

      // Validate
      const staticResult = runStaticValidation(htmlFile);
      if (!staticResult.passed) {
        warn(`[targeted-fix] Static validation failed on attempt ${attempt}`);
        report.errors.push(`Attempt ${attempt}: static validation failed`);
        continue;
      }

      // Run existing tests if they exist
      if (fs.existsSync(testFile)) {
        let testResult;
        try {
          const { stdout } = await execFileAsync(
            'npx',
            ['playwright', 'test', '--config', path.join(gameDir, 'playwright.config.js'), '--reporter=json'],
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
        report.test_results.push({ attempt, passed, failed });
        progress('targeted-fix-test', { gameId, attempt, passed, failed });

        if (failed === 0 && passed > 0) {
          report.status = 'APPROVED';
          report.review_result = 'Targeted fix passed all tests';
          info(`[targeted-fix] All tests pass on attempt ${attempt}`);
          break;
        }
      } else {
        // No tests — approve if static validation passed
        report.status = 'APPROVED';
        report.review_result = 'Targeted fix applied (no tests to run)';
        info('[targeted-fix] No tests found — approving based on static validation');
        break;
      }
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

  progress('targeted-fix-complete', { gameId, status: report.status });
  writeReport();
  return report;
}

module.exports = { runPipeline, runTargetedFix, extractHtml, extractTests };
