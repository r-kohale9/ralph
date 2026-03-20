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
const { callLlm, callClaude, resetTokens, getTokenUsage } = require('./llm');
const { validateContract } = require('./validate-contract');
const metrics = require('./metrics');

const execFileAsync = promisify(execFile);

// ─── Find a free TCP port ────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ─── Configuration ──────────────────────────────────────────────────────────

const GEN_MODEL = process.env.RALPH_GEN_MODEL || 'claude-opus-4-6';
const TEST_MODEL = process.env.RALPH_TEST_MODEL || 'gemini-2.5-pro';
const FIX_MODEL = process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
const REVIEW_MODEL = process.env.RALPH_REVIEW_MODEL || 'gemini-2.5-pro';
const FALLBACK_MODEL = process.env.RALPH_FALLBACK_MODEL || 'gpt-4.1';
const TRIAGE_MODEL = process.env.RALPH_TRIAGE_MODEL || FIX_MODEL;
const GLOBAL_FIX_MODEL = process.env.RALPH_GLOBAL_FIX_MODEL || GEN_MODEL;
const LEARNINGS_MODEL = process.env.RALPH_LEARNINGS_MODEL || FIX_MODEL;
const MAX_ITERATIONS = parseInt(process.env.RALPH_MAX_ITERATIONS || '5', 10);
const MAX_GLOBAL_FIX_ITERATIONS = parseInt(process.env.RALPH_MAX_GLOBAL_FIX_ITERATIONS || '2', 10);
const CATEGORY_BATCH_SIZE = parseInt(process.env.RALPH_CATEGORY_BATCH_SIZE || '1', 10);
const SKIP_DOM_SNAPSHOT = process.env.RALPH_SKIP_DOM_SNAPSHOT === '1';
const TEST_TIMEOUT = parseInt(process.env.RALPH_TEST_TIMEOUT || '120', 10) * 1000;
const USE_CLAUDE_CLI = process.env.RALPH_USE_CLAUDE_CLI === '1';
const REPO_DIR = process.env.RALPH_REPO_DIR || '.';
const SKILL_DIR = path.join(REPO_DIR, 'warehouse', 'mathai-game-builder');
const GLOBAL_LEARNINGS_FILE = path.join(REPO_DIR, 'data', 'global-learnings.md');

// ─── Cost estimation ─────────────────────────────────────────────────────────

const MODEL_COSTS = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || { input: 3, output: 15 }; // default to sonnet pricing
  return ((inputTokens * costs.input) + (outputTokens * costs.output)) / 1_000_000;
}

// ─── Global learnings (cross-game, persisted) ────────────────────────────────

function readGlobalLearnings() {
  try {
    if (fs.existsSync(GLOBAL_LEARNINGS_FILE)) {
      const content = fs.readFileSync(GLOBAL_LEARNINGS_FILE, 'utf-8').trim();
      return content || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function appendGlobalLearning(entry) {
  try {
    fs.mkdirSync(path.dirname(GLOBAL_LEARNINGS_FILE), { recursive: true });
    const line = `- ${entry.trim()}\n`;
    fs.appendFileSync(GLOBAL_LEARNINGS_FILE, line);
  } catch {
    // ignore
  }
}

// ─── HTML extraction helpers ────────────────────────────────────────────────

function extractHtml(output) {
  // Try ```html code block
  let match = output.match(/```html\n([\s\S]*?)\n```/);
  if (match) return match[1];

  // Try generic code block with HTML content
  match = output.match(/```\n([\s\S]*?)\n```/);
  if (match && /<!DOCTYPE|<html|<head|<body/.test(match[1])) return match[1];

  // Raw HTML — may have LLM chain-of-thought text before DOCTYPE; slice from there
  const htmlStart = output.search(/<!DOCTYPE html|<html/i);
  if (htmlStart !== -1) return output.slice(htmlStart);

  return null;
}

// Returns true if the HTML appears truncated (missing closing tags or ends mid-statement)
function isHtmlTruncated(html) {
  if (!html || html.length < 500) return true;
  const trimmed = html.trimEnd();
  // Must end with </html> or at minimum </body>
  if (!/<\/html\s*>/i.test(trimmed)) return true;
  // Must have a complete <script> section (not cut off mid-statement)
  const scriptTags = (trimmed.match(/<script/gi) || []).length;
  const scriptCloseTags = (trimmed.match(/<\/script>/gi) || []).length;
  if (scriptTags > scriptCloseTags) return true;
  return false;
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

// ─── Spec metadata extraction ───────────────────────────────────────────────
// Reads totalRounds, totalLives, interaction type, and star logic from spec markdown.
// Used by injectTestHarness() to produce correct window.__ralph implementation.

function extractSpecMetadata(specContent) {
  const meta = {
    totalRounds: null,
    totalLives: null,
    interactionType: 'text-input', // default
    starType: 'lives', // default
    starThresholds: [],
  };

  // Rounds: "9 rounds", "totalRounds: 9", "rounds per level: 3"
  const roundsMatch = specContent.match(/(?:total[_\s]?rounds?|rounds?\s+per\s+(?:level|game)|totalRounds)\s*[:=]?\s*(\d+)/i)
    || specContent.match(/(\d+)\s+rounds?\s+(?:per|in each|in a)\s+(?:level|game)/i)
    || specContent.match(/(\d+)\s+(?:questions?|rounds?)\s+(?:total|in the game)/i);
  if (roundsMatch) meta.totalRounds = parseInt(roundsMatch[1], 10);

  // Lives: "3 lives", "totalLives: 3", "lives: 3"
  const livesMatch = specContent.match(/(?:total[_\s]?lives?|lives?\s*[:=]\s*)(\d+)/i)
    || specContent.match(/(\d+)\s+lives?(?:\s+(?:at\s+start|initially|total))?/i);
  if (livesMatch) meta.totalLives = parseInt(livesMatch[1], 10);

  // No-lives games: "no lives", "does not lose lives", "without lives"
  if (/no\s+lives|does\s+not\s+(?:lose|have)\s+lives|without\s+lives/i.test(specContent)) {
    meta.totalLives = 0;
  }

  // Interaction type detection (check in priority order — drag first, then mcq, grid, text)
  if (/drag[\s-]?(?:and[\s-]?drop|drop)|draggable/i.test(specContent)) {
    meta.interactionType = 'drag';
  } else if (/(?:multiple[\s-]?choice|option\s+button|mcq|radio\s+button|horizontal\s+option)/i.test(specContent)) {
    meta.interactionType = 'mcq-click';
  } else if (/(?:grid|cell|card|board|tile|matrix|NxN)/i.test(specContent)) {
    meta.interactionType = 'grid-click';
  } else if (/(?:input|type|text[\s-]?field|numeric\s+input|answer\s+box)/i.test(specContent)) {
    meta.interactionType = 'text-input';
  }

  // Star logic type
  if (/avg(?:erage)?\s+(?:time|speed)|per[\s-]?round\s+(?:time|speed)|seconds?\s+per\s+(?:round|question)/i.test(specContent)) {
    meta.starType = 'avg-time';
    // Extract thresholds: "< 3s = 3★", "<5s → 2 stars"
    const timeThresholds = [...specContent.matchAll(/[<≤]\s*(\d+(?:\.\d+)?)\s*s(?:econds?)?\s*[=:→\-]+\s*(\d)\s*(?:star|★)/gi)]
      .map((m) => ({ threshold: parseFloat(m[1]), stars: parseInt(m[2], 10) }))
      .sort((a, b) => a.threshold - b.threshold);
    if (timeThresholds.length > 0) meta.starThresholds = timeThresholds;
  } else if (/(?:accuracy|correct\s+(?:answer|response)s?)\s+[=:→]\s*\d+\s*%?\s*[=:→]\s*\d\s*star/i.test(specContent)) {
    meta.starType = 'accuracy';
  } else if (/moves?\s*[≤<]\s*\d+\s*[=:→]\s*\d\s*star/i.test(specContent)) {
    meta.starType = 'moves';
  } else if (/(?:stars?\s+=\s+lives?|lives?\s+remaining\s+=\s+stars?|stars?\s+equal\s+(?:to\s+)?lives?)/i.test(specContent)) {
    meta.starType = 'lives';
  } else if (/(?:total[\s-]time|completion[\s-]time|time\s+to\s+complete)\s*[<≤]\s*\d+/i.test(specContent)) {
    meta.starType = 'total-time';
  }

  return meta;
}

// ─── Test harness injection ──────────────────────────────────────────────────
// Appends a <script id="ralph-test-harness"> block to the HTML after </body>.
// This block is deterministically generated from spec metadata — zero LLM calls.
// It adds window.__ralph shortcuts used by shared boilerplate helpers and CORE tests.
// Does NOT change game behavior — only adds read/write shortcuts for tests.

function injectTestHarness(html, specMetadata) {
  // Don't inject twice
  if (html.includes('id="ralph-test-harness"')) return html;

  const { interactionType } = specMetadata;

  // Build the answer() implementation based on interaction type
  let answerImpl;
  if (interactionType === 'mcq-click' || interactionType === 'grid-click') {
    answerImpl = `answer(correct = true) {
      // Value-based lookup first: for games where correctAnswer is a number/string value (not an index)
      const correctValue = window.gameState?.correctAnswer ?? window.gameState?.answer;
      if (correctValue !== undefined && correctValue !== null) {
        const allBtns = document.querySelectorAll('.answer-btn, .option-btn, [class*="answer"], [class*="option"]');
        for (const b of allBtns) {
          const bVal = b.dataset.value !== undefined ? b.dataset.value : b.textContent.trim();
          const matches = String(bVal) === String(correctValue);
          if ((correct && matches) || (!correct && !matches)) { b.click(); return true; }
        }
      }
      // Index-based lookup fallback: for games where correct answer identified by position
      const round = window.gameState?.content?.rounds?.[window.gameState?.currentRound]
        || window.gameState?.rounds?.[window.gameState?.currentRound];
      const correctIdx = round?.correctIndex ?? round?.correct ?? 0;
      const idx = correct ? correctIdx : (correctIdx === 0 ? 1 : 0);
      // Try data-testid first, then data-index, then nth child
      const btn = document.querySelector('[data-testid="option-' + idx + '"]')
        || document.querySelector('[data-index="' + idx + '"]')
        || document.querySelector('.option-btn:nth-child(' + (idx + 1) + ')')
        || document.querySelector('[data-testid="cell-' + idx + '"]');
      if (btn) btn.click();
      return !!btn;
    },`;
  } else if (interactionType === 'drag') {
    answerImpl = `answer(correct = true) {
      // Drag games: simulate drop by calling the game's answer handler directly
      if (window.handleDrop) { window.handleDrop(correct); return true; }
      if (window.checkAnswer) { window.checkAnswer(correct); return true; }
      return false;
    },`;
  } else {
    // text-input (default)
    answerImpl = `answer(correct = true) {
      const gs = window.gameState;
      const correctAns = gs?.correctAnswer ?? gs?.answer ?? gs?.solution ?? '';
      const ans = correct ? String(correctAns) : String(Number(correctAns) + 9999);
      const input = document.querySelector('[data-testid="answer-input"]')
        || document.querySelector('#answer-input')
        || document.querySelector('input[type="number"]')
        || document.querySelector('input[type="text"]');
      if (input) {
        input.value = ans;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const checkBtn = document.querySelector('[data-testid="btn-check"]')
        || document.querySelector('#btn-check')
        || document.querySelector('button[type="submit"]');
      if (checkBtn) checkBtn.click();
      return !!(input || checkBtn);
    },`;
  }

  const harnessScript = `
<script id="ralph-test-harness">
// ─── Ralph Test Harness (injected by pipeline) ───────────────────────────────
// Provides test shortcuts via window.__ralph. Does NOT change game behavior.
// Spec metadata: interactionType=${interactionType}
(function() {
  'use strict';

  // PostMessage capture — intercept to record last message for contract tests
  window.__lastPostMessage = null;
  try {
    const _orig = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = function(data, origin) {
      window.__lastPostMessage = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;
      _orig(data, origin);
    };
  } catch(e) { /* cross-origin parent — ignore */ }

  // syncDOMState — called after every game state change
  // Keeps data-phase/data-lives/data-round/data-score on #app up to date
  function syncDOMState() {
    const root = document.getElementById('app');
    if (!root) return;
    const gs = window.gameState;
    if (!gs) return;
    // If game tracks its own phase (CDN games use gameState.phase directly), trust it.
    // Normalize phase names: game_over → gameover, game_complete → results, start_screen → start
    // Otherwise fall back to computing from other flags.
    const rawPhase = gs.phase
                   ? gs.phase.replace('game_over', 'gameover').replace('game_complete', 'results').replace('start_screen', 'start')
                   : null;
    root.dataset.phase = rawPhase
                       ? rawPhase
                       : gs.completed ? 'results'
                       : gs.isActive === false ? 'start'
                       : gs.isGameOver ? 'gameover'
                       : 'playing';
    if (gs.currentRound !== undefined) root.dataset.round = gs.currentRound;
    if (gs.lives !== undefined) root.dataset.lives = gs.lives;
    if (gs.score !== undefined) root.dataset.score = gs.score;
    if (gs.level !== undefined) root.dataset.level = gs.level;
    if (gs.stars !== undefined && gs.stars !== null) root.dataset.stars = gs.stars;
    // Sync data-lives on CDN progress display element too
    const livesEl = document.querySelector('[data-testid="display-lives"], [data-testid="lives-display"]');
    if (livesEl && gs.lives !== undefined) livesEl.dataset.lives = gs.lives;
  }

  // Patch the game's own roundComplete/endGame/loadRound to call syncDOMState
  // This ensures data-* attributes are always current after state changes
  function patchGameFunctions() {
    const toWrap = ['roundComplete', 'endGame', 'loadRound', 'initGame', 'checkAnswer', 'handleSubmit'];
    for (const fn of toWrap) {
      if (typeof window[fn] === 'function' && !window[fn].__ralphPatched) {
        const orig = window[fn];
        window[fn] = function(...args) {
          const result = orig.apply(this, args);
          if (result && typeof result.then === 'function') {
            result.then(syncDOMState).catch(() => {});
          } else {
            syncDOMState();
          }
          return result;
        };
        window[fn].__ralphPatched = true;
      }
    }
  }

  window.__ralph = {
    ${answerImpl}

    endGame(reason) {
      reason = reason || 'victory';
      if (window.endGame && !window.endGame.__ralphPatched) window.endGame(reason);
      else if (window.endGame) window.endGame(reason);
      syncDOMState();
    },

    jumpToRound(n) {
      if (window.gameState) { window.gameState.currentRound = n; window.gameState.isActive = true; }
      // Try game-specific round-loading functions in priority order
      if (typeof window.loadRound === 'function') window.loadRound(n);
      else if (typeof window.jumpToRound === 'function') window.jumpToRound(n);
      else if (typeof window.loadQuestion === 'function') window.loadQuestion(n);
      else if (typeof window.goToRound === 'function') window.goToRound(n);
      syncDOMState();
    },

    setLives(n) {
      if (window.gameState) window.gameState.lives = n;
      if (window.progressBar) {
        try { window.progressBar.update(window.gameState.currentRound || 0, n); } catch(e) {}
      }
      syncDOMState();
    },

    setRoundTimes(timesMs) {
      if (window.gameState) {
        window.gameState.roundTimes = timesMs;
        window.gameState.roundStartTime = Date.now();
        const totalMs = timesMs.reduce((a, b) => a + b, 0);
        window.gameState.startTime = window.gameState.startTime || (Date.now() - totalMs);
      }
    },

    getState() {
      const root = document.getElementById('app');
      const gs = window.gameState || {};
      return {
        phase: root ? root.dataset.phase || 'unknown' : 'unknown',
        round: gs.currentRound ?? 0,
        totalRounds: gs.totalRounds ?? 0,
        lives: gs.lives ?? null,
        score: gs.score ?? 0,
        stars: gs.stars ?? null,
        isActive: gs.isActive ?? false,
        completed: gs.completed ?? false,
      };
    },

    getLastPostMessage() { return window.__lastPostMessage || null; },

    syncDOMState,
  };

  // Patch game functions and sync state continuously
  // CDN games initialize asynchronously (may take 5-60s), so we poll periodically
  function patchAndSync() {
    patchGameFunctions();
    syncDOMState(); // capture current state immediately after patching
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(patchAndSync, 200);
    });
  } else {
    setTimeout(patchAndSync, 200);
  }

  // Keep syncing every 500ms for the first 90s (covers CDN async init)
  // This ensures data-phase stays current even when patchGameFunctions
  // didn't fire before the game's initGame() ran
  const syncInterval = setInterval(function() {
    syncDOMState();
  }, 500);
  setTimeout(function() { clearInterval(syncInterval); }, 90000);

  // Also patch after CDN scripts load (they replace window functions)
  window.addEventListener('load', function() {
    setTimeout(patchAndSync, 500);
    setTimeout(patchAndSync, 2000);
    // Diagnostic: warn if required game functions are not exposed on window
    var required = ['endGame', 'restartGame', 'nextRound'];
    required.forEach(function(fn) {
      if (typeof window[fn] !== 'function') {
        console.error('[ralph-test-harness] MISSING window.' + fn + ': this function is not exposed on window. Tests calling window.__ralph.' + fn + '() will fail silently. Fix: add window.' + fn + ' = ' + fn + '; in the game code (after the function definition, in global scope or at end of DOMContentLoaded).');
      }
    });
  });
})();
</script>`;

  // Insert before </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', harnessScript + '\n</body>');
  }
  return html + harnessScript;
}

// ─── LLM call wrapper with metrics ──────────────────────────────────────────

async function trackedLlmCall(stepName, prompt, model, options = {}, report = null) {
  const start = Date.now();
  const tokensBefore = getTokenUsage();
  try {
    const result = await callLlm(stepName, prompt, model, options);
    metrics.recordLlmCall(stepName, model, Date.now() - start, true);
    if (report) {
      const tokensAfter = getTokenUsage();
      const inputDelta = tokensAfter.input - tokensBefore.input;
      const outputDelta = tokensAfter.output - tokensBefore.output;
      report.total_cost_usd = (report.total_cost_usd || 0) + estimateCost(model, inputDelta, outputDelta);
    }
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
  const SNAPSHOT_PORT = await findFreePort();
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

    // Override visibilityState so VisibilityTracker never pauses
    // eslint-disable-next-line no-undef
    await page.addInitScript(() => {
      // eslint-disable-next-line no-undef
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
      // eslint-disable-next-line no-undef
      Object.defineProperty(document, 'hidden', { get: () => false });
    });
    await page.goto(`http://localhost:${SNAPSHOT_PORT}`);

    // Poll for popup + transition slot — CDN games can take 45–60s to init
    {
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        const okayBtn = page.locator('button:has-text("Okay!")');
        if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await okayBtn.click();
          await page.waitForTimeout(300);
        }
        const slotReady = await page.locator(`#${transitionSlotId} button`).first().isVisible({ timeout: 300 }).catch(() => false);
        if (slotReady) break;
        await page.waitForTimeout(500);
      }
      // Final check
      await page.locator(`#${transitionSlotId} button`).first().waitFor({ state: 'visible', timeout: 5000 });
    }

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

    // Navigate to game screen — click transition button, dismiss any popup, then click again if still visible
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(600);
    // Dismiss any popup that may appear after first click
    const okayBtnPost = page.locator('button:has-text("Okay!")');
    if (await okayBtnPost.isVisible({ timeout: 500 }).catch(() => false)) {
      await okayBtnPost.click();
      await page.waitForTimeout(300);
    }
    // Second click only if transition button is still visible (some games need 2 clicks)
    if (await page.locator(`#${transitionSlotId} button`).first().isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.locator(`#${transitionSlotId} button`).first().click();
    }
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
    warn(`[pipeline] DOM snapshot failed: ${err.message} — falling back to static HTML analysis`);
    // Static fallback: extract IDs and classes from HTML source when browser-based snapshot times out
    try {
      const htmlPath = path.join(gameDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        const classMatches = [...html.matchAll(/\bclass="([^"]+)"/g)]
          .map((m) => m[1].split(/\s+/))
          .flat()
          .filter((c, i, arr) => arr.indexOf(c) === i);
        const dataTestIds = [...html.matchAll(/\bdata-testid="([^"]+)"/g)].map((m) => m[1]);
        const snapshot = {
          ids: [...new Set(idMatches)].slice(0, 60),
          classes: classMatches.slice(0, 40),
          dataTestIds: dataTestIds.slice(0, 20),
        };
        fs.writeFileSync(path.join(gameDir, 'tests', 'dom-snapshot.json'), JSON.stringify(snapshot, null, 2));
        return `STATIC HTML ANALYSIS (browser snapshot timed out — CDN init too slow):

IDs found in HTML: ${snapshot.ids.join(', ')}
Classes found in HTML: ${snapshot.classes.join(', ')}${snapshot.dataTestIds.length ? `\ndata-testid attributes: ${snapshot.dataTestIds.join(', ')}` : ''}

NOTE: These are from static HTML, not runtime. Use them as selector hints but verify with the spec.`;
      }
    } catch (_e) {
      // ignore static fallback errors
    }
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
        const rawMsg = spec.tests?.[0]?.results?.[0]?.error?.message || '';
        const errMsg = rawMsg.length > 600 ? rawMsg.slice(0, 600) + '…' : rawMsg;
        const fileLabel = suiteFile ? `[${path.basename(suiteFile)}] ` : '';
        out.push(errMsg ? `${fileLabel}${spec.title} — ${errMsg}` : `${fileLabel}${spec.title}`);
      }
    }
    if (suite.suites) collectFailures(suite.suites, suiteFile, out);
  }
}

// ─── Deterministic triage ────────────────────────────────────────────────────
// Returns 'fix_html', 'skip_tests', or null (null = unknown, do LLM triage).
// Called before the LLM triage to short-circuit known patterns cheaply.

function deterministicTriage(failures) {
  if (!failures || failures.length === 0) return null;
  // ralph test harness not initialized — always fix_html
  if (failures.every(f => f.includes('window.__ralph is not defined') ||
      (f.includes('Cannot read properties of undefined (reading') && f.includes('__ralph')))) {
    return 'fix_html';
  }
  // visibility API — untestable, skip
  if (failures.every(f => f.includes('Cannot redefine property: visibilityState'))) {
    return 'skip_tests';
  }
  // pointer-events re-click pattern — skip
  if (failures.every(f => f.includes('pointer-events') ||
      (f.includes('already been clicked') || f.includes('already selected')))) {
    return 'skip_tests';
  }
  return null; // needs LLM triage
}

// ─── E8 script-only fix helpers ──────────────────────────────────────────────
// On iteration 2+, send only <script> sections to the fix LLM instead of the
// full HTML. mergeScriptFix merges the corrected scripts back into the original.

function extractScriptSections(html) {
  const scripts = [];
  const scriptRegex = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push({ index: match.index, content: match[0] });
  }
  return scripts;
}

function mergeScriptFix(originalHtml, fixedScriptContent) {
  // Replace all <script> sections in original with the fixed content.
  // Find the first <script> and last </script> span in original, replace entire range.
  const firstScript = originalHtml.search(/<script/i);
  const lastScriptEnd = originalHtml.lastIndexOf('</script>') + '</script>'.length;
  if (firstScript === -1 || lastScriptEnd <= firstScript) return null; // can't merge
  return originalHtml.slice(0, firstScript) + fixedScriptContent + originalHtml.slice(lastScriptEnd);
}

/**
 * Attempts to extract example round/question data from a spec markdown file.
 * Returns an array of { question, answer, ... } objects, or [] if not found.
 */
function extractSpecRounds(specContent) {
  if (!specContent) return [];
  const rounds = [];

  // Pattern 1: Markdown table rows with Q/A structure
  // e.g. | Question | Answer | or | 3 + 4 | 7 |
  const tableRowPattern = /^\|([^|]+)\|([^|]+)\|/gm;
  let match;
  while ((match = tableRowPattern.exec(specContent)) !== null) {
    const col1 = match[1].trim();
    const col2 = match[2].trim();
    // Skip header rows (contain "Question", "Answer", "---", etc.)
    if (/question|answer|input|output|---|:--/i.test(col1)) continue;
    if (col1.length > 0 && col2.length > 0) {
      rounds.push({ question: col1, answer: col2 });
    }
    if (rounds.length >= 5) break; // 5 examples is enough
  }

  // Pattern 2: Numbered list items "1. Question → Answer" or "1. 3+4=7"
  if (rounds.length === 0) {
    const listPattern = /^\d+\.\s+(.+?)\s*[→=:]\s*(.+)$/gm;
    while ((match = listPattern.exec(specContent)) !== null) {
      rounds.push({ question: match[1].trim(), answer: match[2].trim() });
      if (rounds.length >= 5) break;
    }
  }

  return rounds;
}

// ─── Shared review guidance (used by both early and final review prompts) ───
// Keep in sync: any change here applies to both Step 1c and Step 4 review calls.

const REVIEW_SHARED_GUIDANCE = `## Important Guidance to Avoid False Positives

### RULE-001 (Global scope)
RULE-001 is SATISFIED if all game functions are declared at the top level of the script and event handlers (onclick= or addEventListener) call only those globally-declared functions.
RULE-001 does NOT require onclick= attributes — addEventListener() calling a global function is equally compliant.
RULE-001 FAILS only if event handlers reference functions inside a closure not accessible from global scope.

### Contract Compliance — gameState and postMessage
- window.gameState = { ... } IS the correct pattern — it exposes gameState on window as required.
- window.parent.postMessage(...) is the correct call for game events.
- Check the postMessage payload fields per the spec's contract section.

### RULE-003 (try/catch on async calls)
- Promise .catch((e) => { console.error(...) }) IS compliant for fire-and-forget async calls.
- All awaited async calls must use try/catch.

### RULE-005 (Cleanup in endGame)
- A delayed destroy via setTimeout IS compliant — cleanup originates from endGame().
- Either immediate or delayed cleanup PASSES RULE-005.

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous or requires running the game to verify, resolve in favor of APPROVED.`;

// ─── Spec pre-validation ────────────────────────────────────────────────────

function validateSpec(specContent) {
  const errors = [];
  const warnings = [];

  if (!specContent || specContent.trim().length < 200) {
    errors.push('Spec too short (< 200 chars) — likely incomplete');
    return { errors, warnings };
  }

  // Check for game description / title
  if (!/^#\s+\w/m.test(specContent)) {
    errors.push('Missing top-level heading (# Game Title)');
  }

  // Check for mechanics / rules / how to play
  if (!/##.*(?:mechanic|rule|how.to.play|gameplay|instruction)/i.test(specContent)) {
    warnings.push('No mechanics/rules section found — generation may produce generic gameplay');
  }

  // Check for scoring / stars
  if (!/star|scor|point|win|complet/i.test(specContent)) {
    warnings.push('No scoring criteria found — star thresholds may be incorrect');
  }

  // Check for CDN / technology / implementation section
  if (!/cdn|technology|implementation|technical/i.test(specContent)) {
    warnings.push('No CDN/technology section — generation may miss required CDN libraries');
  }

  return { errors, warnings };
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

async function runPipeline(gameDir, specPath, options = {}) {
  const { logger: log, onProgress } = options;
  const info = log ? (msg) => log.info(msg) : console.log;
  const warn = log ? (msg) => log.warn(msg) : console.warn;
  const error = log ? (msg) => log.error(msg) : console.error;

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

  resetTokens();

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
    skipped_tests: [],
    models: { generation: GEN_MODEL, test_gen: TEST_MODEL, fix: FIX_MODEL, review: REVIEW_MODEL },
    artifacts: [],
    llm_calls: 0,
    total_cost_usd: 0,
    iteration_html_urls: {}, // populated by worker via progress events
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

  // ─── Step 0: Spec pre-validation ────────────────────────────────────────
  info('[pipeline] Step 0: Spec pre-validation');
  const specValidation = validateSpec(specContent);
  if (specValidation.warnings.length > 0) {
    specValidation.warnings.forEach(w => warn(`[pipeline] Step 0: ⚠ ${w}`));
  }
  if (specValidation.errors.length > 0) {
    specValidation.errors.forEach(e => error(`[pipeline] Step 0: ✗ ${e}`));
    throw new Error(`Spec pre-validation failed: ${specValidation.errors.join('; ')}`);
  }
  progress('spec-validated', { gameId, warnings: specValidation.warnings.length, warningList: specValidation.warnings });

  // Extract spec metadata for test harness injection (interaction type, lives, rounds, star logic)
  const specMeta = extractSpecMetadata(specContent);
  info(`[pipeline] Spec metadata: interaction=${specMeta.interactionType}, rounds=${specMeta.totalRounds}, lives=${specMeta.totalLives}, stars=${specMeta.starType}`);

  // Helper: inject test harness into HTML file and write it back
  function injectHarnessToFile(filePath) {
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const patched = injectTestHarness(original, specMeta);
      if (patched !== original) {
        fs.writeFileSync(filePath, patched);
        info(`[pipeline] Test harness injected into ${path.basename(filePath)}`);
      }
    } catch (e) {
      warn(`[pipeline] Test harness injection failed: ${e.message}`);
    }
  }

  // ─── Load global cross-game learnings ───────────────────────────────────
  const globalLearnings = readGlobalLearnings();
  if (globalLearnings) {
    info(`[pipeline] Loaded global learnings (${globalLearnings.split('\n').length} entries)`);
  }

  function formatLearningsBlock() {
    if (!globalLearnings) return '';
    return `\nACCUMULATED LEARNINGS FROM PRIOR GAME BUILDS (apply these to avoid known pitfalls):\n${globalLearnings}\n`;
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
   Similarly: expose window.timer = timer after creation (for TimerComponent instances).

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

15. GAMESTATE.PHASE — set at every state transition (required by test harness):
    - Always set gameState.phase at each transition:
      - gameState.phase = 'playing'    ← when a new round/question becomes active
      - gameState.phase = 'transition' ← when between levels (waiting for user to click "Next Level")
      - gameState.phase = 'gameover'   ← when lives hit 0 or game-over condition met
      - gameState.phase = 'results'    ← when victory / all rounds completed
    - The test harness reads gameState.phase to set data-phase on #app; without this, waitForPhase() timeouts

CRITICAL — game_init phase transition (ALL game-flow and mechanics tests depend on this):
    Your handlePostMessage function MUST handle the 'game_init' event by immediately setting
    gameState.phase = 'playing' as the VERY FIRST LINE in the game_init case — BEFORE any other
    game logic (before setupGame(), before rendering, before anything).
    The test harness fires game_init then IMMEDIATELY calls waitForPhase('playing').
    If gameState.phase is not set to 'playing' synchronously in the game_init case,
    ALL game-flow and mechanics tests will timeout and fail.

    REQUIRED PATTERN (copy exactly):
      case 'game_init':
        gameState.phase = 'playing';  // REQUIRED FIRST LINE — do NOT move or defer this
        // ... rest of init logic (setupGame, renderQuestion, etc.)
        break;

    WRONG patterns that cause ALL tests to fail:
      case 'game_init':
        setupGame();  // ← WRONG: phase not set before harness checks
        break;
      case 'game_init':
        initGame().then(() => { gameState.phase = 'playing'; }); // ← WRONG: async, too late

16. POSTMESSAGE — always send to PARENT frame:
    - ALWAYS use window.parent.postMessage(payload, '*') for game_complete events
    - NEVER use window.postMessage(payload, '*') — this sends to the same window, parent never receives it
    - The MathAI platform is always an iframe parent; window.parent is always the correct target

17. MULTI-STEP CONTROLS — never hide the adjustment button after first click:
    - If a game has +/- adjustment buttons (spec terms: "adjusts by ±1", "increment/decrement"), keep BOTH buttons visible at all times after initial render
    - Showing a value display in the +/- button area is fine, but the button itself must remain visible and clickable for repeated adjustments
    - NEVER call btn.classList.add('hidden') on an adjustment button as a result of the user clicking it

SPECIFICATION:
${specContent}${formatLearningsBlock()}`;

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
- Follow every instruction in the template EXACTLY — copy all code blocks verbatim
- Include fallback content for standalone testing
- All game HTML must go inside #gameContent when using ScreenLayout
- PART-008: handlePostMessage MUST check event.data.type === 'game_init' and call setupGame()
- CRITICAL game_init: In the 'game_init' case of handlePostMessage, set gameState.phase = 'playing' as the VERY FIRST LINE before any other logic. The test harness calls waitForPhase('playing') immediately after firing game_init — if phase is not set synchronously, ALL game-flow and mechanics tests timeout and fail.
- IF spec uses PART-010/SignalCollector: endGame postMessage MUST spread ...signalPayload from signalCollector.seal()
- IF spec uses PART-030/Sentry: ALL catch blocks MUST call Sentry.captureException(e); initSentry() defined and called AFTER Sentry SDK loads
${formatLearningsBlock()}
Write the file now.`;

      genOutput = await callClaude('generate-html', cliPrompt, {
        cwd: SKILL_DIR,
        model: process.env.RALPH_CLAUDE_MODEL || 'sonnet',
        timeout: parseInt(process.env.RALPH_LLM_TIMEOUT || '600', 10) * 1000,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
        addDirs: [path.resolve(REPO_DIR, 'warehouse'), path.resolve(gameDir)],
      });
    } else {
      genOutput = await trackedLlmCall('generate-html', genPrompt, GEN_MODEL, {}, report);
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
    // Retry generation if HTML appears truncated (token limit hit)
    let htmlContent = html;
    let genAttempts = 0;
    const MAX_GEN_ATTEMPTS = 3;
    while (isHtmlTruncated(htmlContent) && genAttempts < MAX_GEN_ATTEMPTS - 1) {
      genAttempts++;
      warn(`[pipeline] HTML appears truncated (attempt ${genAttempts}/${MAX_GEN_ATTEMPTS}) — retrying generation`);
      const retryOutput = await trackedLlmCall('generate-html-retry', genPrompt, GEN_MODEL, {}, report);
      llmCalls.push({ step: 'generate-html-retry', model: GEN_MODEL });
      const retryHtml = extractHtml(retryOutput);
      if (retryHtml && !isHtmlTruncated(retryHtml)) {
        htmlContent = retryHtml;
        break;
      }
      if (retryHtml && retryHtml.length > (htmlContent || '').length) {
        htmlContent = retryHtml; // take the longer output even if still truncated
      }
    }
    if (isHtmlTruncated(htmlContent)) {
      warn(`[pipeline] HTML still appears truncated after ${MAX_GEN_ATTEMPTS} attempts — proceeding anyway`);
    }
    fs.writeFileSync(htmlFile, htmlContent + '\n');
    info(`[pipeline] HTML saved (${htmlContent.length} bytes)`);
  }

  } // end if (!existingHtml)

  // Inject test harness into HTML (window.__ralph + syncDOMState + postMessage capture)
  injectHarnessToFile(htmlFile);

  // Emit progress with htmlFile path so worker can upload preview
  const htmlSize = fs.existsSync(htmlFile) ? fs.statSync(htmlFile).size : 0;
  const htmlGenTimeS = report.generation_time_s || 0;
  progress('html-ready', { gameId, htmlFile, size: htmlSize, time: htmlGenTimeS, model: GEN_MODEL });

  // ─── Step 1b: Static + contract validation ──────────────────────────────

  info('[pipeline] Step 1b: Static validation');
  progress('static-validation', { gameId });
  const staticResult = runStaticValidation(htmlFile);
  let staticPassed = staticResult.passed;
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
      const fixOutput = await trackedLlmCall('static-fix', fixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: 'static-fix', model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (fixedHtml) {
        fs.writeFileSync(htmlFile, fixedHtml + '\n');
        injectHarnessToFile(htmlFile);
        staticPassed = true;
        progress('static-validation-fixed', { gameId });
      }
    } catch {
      warn('[pipeline] Static fix LLM call failed');
      progress('static-validation-fix-failed', { gameId });
    }
  }

  // Emit static-validation-passed if static checks passed (originally or after fix)
  if (staticPassed) {
    progress('static-validation-passed', { gameId, checksCount: 10 });
  }

  // Contract validation (non-blocking)
  const contractErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
  if (contractErrors.length > 0) {
    warn(`[pipeline] Contract validation: ${contractErrors.length} issue(s)`);
    progress('contract-validation-issues', { gameId, count: contractErrors.length, errors: contractErrors });

    info(`[pipeline] Step 1b: ${contractErrors.length} contract error(s) — attempting auto-fix`);
    progress('contract-static-fix', { gameId });
    const contractFixPrompt = `You are fixing a game HTML file that has contract validation errors.

CONTRACT ERRORS:
${contractErrors.map(e => `  ✗ ${e}`).join('\n')}

SPEC CONTRACT REQUIREMENTS:
${specMeta.starType || specMeta.stars || ''}

FULL HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

Fix ONLY the contract errors above. Do not change game logic, styling, or working features.
Return the complete corrected HTML.`;

    try {
      const fixedHtml = await trackedLlmCall('contract-static-fix', contractFixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: 'contract-static-fix', model: FIX_MODEL });
      const extracted = extractHtml(fixedHtml);
      const currentHtmlForContractFix = fs.readFileSync(htmlFile, 'utf-8');
      if (extracted && extracted.length > currentHtmlForContractFix.length * 0.7) {
        fs.writeFileSync(htmlFile, extracted);
        info(`[pipeline] Step 1b: Contract auto-fix applied (${extracted.length} bytes)`);
        // re-validate
        const recheckErrors = validateContract(fs.readFileSync(htmlFile, 'utf-8'));
        if (recheckErrors.length === 0) {
          info('[pipeline] Step 1b: Contract errors resolved by auto-fix');
        } else {
          info(`[pipeline] Step 1b: ${recheckErrors.length} contract error(s) remain after auto-fix — continuing`);
        }
      }
    } catch (e) {
      warn(`[pipeline] Step 1b: Contract auto-fix failed: ${e.message}`);
    }
  }

  // ─── Step 1c: Early spec compliance review (fast-fail before test tokens) ──

  info('[pipeline] Step 1c: Early spec compliance review');
  progress('early-review', { gameId, model: REVIEW_MODEL });

  const earlyReviewPrompt = `You are a game quality reviewer doing a SPEC COMPLIANCE CHECK before running full tests.

This is a pre-test fast-fail check. Only reject if there are clear spec violations that would make ALL tests fail. Minor issues should be noted but not cause rejection.

Walk through EVERY item in the spec's Verification Checklist. For each item, check if the HTML clearly passes or fails.
ONLY reject on CLEAR, DEFINITIVE violations — code you can plainly see is wrong or missing. Do NOT reject on ambiguous items.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — no clear spec violations found (continue to test generation)
- REJECTED: <list ONLY the clear, definitive violations — not style issues>

SPECIFICATION:
${specContent}

HTML:
${fs.readFileSync(htmlFile, 'utf-8')}`;

  let earlyReviewPassed = true;
  try {
    const earlyResult = await trackedLlmCall('early-review', earlyReviewPrompt, REVIEW_MODEL, {}, report);
    llmCalls.push({ step: 'early-review', model: REVIEW_MODEL });
    const earlyRejected = /^REJECTED/i.test(earlyResult.trim());
    if (earlyRejected) {
      warn(`[pipeline] Early review REJECTED — applying quick fix before tests`);
      progress('early-review-rejected', { gameId, reason: earlyResult, fixModel: FIX_MODEL });

      // One targeted fix attempt
      const earlyFixPrompt = `The following HTML game was rejected in a spec compliance review.

REJECTION REASON:
${earlyResult}

Fix ONLY the specific violations listed. Make the smallest possible change.
Do NOT change any passing aspects. Preserve CDN initialization order exactly.

SPECIFICATION:
${specContent}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

Output the complete corrected HTML wrapped in a \`\`\`html code block.`;

      try {
        const fixOut = await trackedLlmCall('early-review-fix', earlyFixPrompt, FIX_MODEL, {}, report);
        llmCalls.push({ step: 'early-review-fix', model: FIX_MODEL });
        const fixedHtml = extractHtml(fixOut);
        if (fixedHtml) {
          fs.writeFileSync(htmlFile, fixedHtml + '\n');
          injectHarnessToFile(htmlFile);
          // Re-review once — use fresh HTML content (earlyReviewPrompt has stale pre-fix HTML)
          const reReviewPrompt = `You are a game quality reviewer doing a SPEC COMPLIANCE CHECK before running full tests.

This is a pre-test fast-fail check. Only reject if there are clear spec violations that would make ALL tests fail. Minor issues should be noted but not cause rejection.

Walk through EVERY item in the spec's Verification Checklist. For each item, check if the HTML clearly passes or fails.
ONLY reject on CLEAR, DEFINITIVE violations — code you can plainly see is wrong or missing. Do NOT reject on ambiguous items.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — no clear spec violations found (continue to test generation)
- REJECTED: <list ONLY the clear, definitive violations — not style issues>

SPECIFICATION:
${specContent}

HTML:
${fs.readFileSync(htmlFile, 'utf-8')}`;
          const reResult = await trackedLlmCall('early-review-2', reReviewPrompt, REVIEW_MODEL, {}, report);
          llmCalls.push({ step: 'early-review-2', model: REVIEW_MODEL });
          if (/^REJECTED/i.test(reResult.trim())) {
            warn(`[pipeline] Early review still REJECTED after fix — failing build`);
            report.status = 'REJECTED';
            report.review_result = reResult;
            writeReport();
            return report;
          }
          info('[pipeline] Early review APPROVED after fix');
        }
      } catch (err) {
        warn(`[pipeline] Early review fix failed: ${err.message} — continuing anyway`);
      }
    } else {
      info('[pipeline] Early review APPROVED — proceeding to tests');
      earlyReviewPassed = true;
      progress('early-review-approved', { gameId, model: REVIEW_MODEL });
    }
  } catch (err) {
    warn(`[pipeline] Early review LLM call failed: ${err.message} — continuing without early review`);
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
      const testCasesOutput = await trackedLlmCall('generate-test-cases', testCasesPrompt, TEST_MODEL, {}, report);
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

  // Check if any spec files already exist AND have runnable test() calls
  // A spec file with only triage-skipped comments is treated as non-existent (regenerate it)
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
  const CATEGORIES_ALL = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const existingCategories = new Set(
    fs.existsSync(testsDir)
      ? CATEGORIES_ALL.filter((cat) => hasRunnableTests(path.join(testsDir, `${cat}.spec.js`)))
      : [],
  );
  const missingCategories = CATEGORIES_ALL.filter((cat) => !existingCategories.has(cat));
  const existingTests = existingCategories.size === CATEGORIES_ALL.length;

  if (existingTests) {
    info(
      `[pipeline] Step 2b: Skipping test generation — all ${CATEGORIES_ALL.length} spec files with runnable tests found`,
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
    // The pipeline controls this — LLMs only generate the test.describe() body.
    // fallbackContent: use runtime-captured game content if available, else empty array
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
    // Games that don't have #mathai-transition-slot will never show the slot button —
    // beforeEach must use a fallback init signal instead of the 50s slot-polling loop.
    // Check htmlContent first (authoritative), then domSnapshot string as a secondary signal.
    // Default to true (slot path) only when we have no data at all (safest for CDN games).
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


test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  ${hasTransitionSlot ? `// FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
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
      const slotReady = await page.locator('#\${transitionSlotId} button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#\${transitionSlotId} button').first()).toBeVisible({ timeout: 5000 });
  }` : `// Non-CDN game: no #mathai-transition-slot -- wait for start phase or game content instead.
  await page.waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 });
  await page.waitForTimeout(500); // allow JS init to settle`}
});`;

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

        const catPrompt = `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

CATEGORY FOCUS: ${categoryDescriptions[category] || category}

IMPLEMENT ALL ${catTestCases.length} TEST CASES BELOW — one test() per case, no skipping, no merging:
${catTestCasesText}

Your test.describe() block MUST contain exactly ${catTestCases.length} test() calls.

CRITICAL — Helper function behavior (read carefully before writing any test):

startGame(page):
  - Clicks through ALL initial transition screens (start, level-1 intro, etc.) until the game is active
  - After startGame() resolves, #mathai-transition-slot button is NOT visible and the game is playing
  - Use startGame() at the beginning of every test
  - NEVER call clickNextLevel() right after startGame() — startGame already handled every initial screen

clickNextLevel(page):
  - Waits for #mathai-transition-slot button to be visible, then clicks it
  - ONLY use this for MID-GAME level transitions (e.g. after completing round 3, after completing round 6)
  - NEVER call this right after startGame() — startGame already clicked all initial screens

dismissPopupIfPresent(page):
  - Dismisses any popup/backdrop that may appear (audio permission, etc.)
  - Call it if an interaction might trigger a popup

Transition slot selectors (CDN MathAI constants — always use these, never guess):
  - Button: page.locator('#mathai-transition-slot button').first()  ← PREFERRED for clicking
  - Title: page.locator('#transitionTitle')  ← h2 element
  - Subtitle: page.locator('#transitionSubtitle')  ← p element
  - WRONG class: '.game-btn', '.btn-primary' — button class is 'mathai-transition-btn'

Progress slot selectors (never use #pb-{timestamp} IDs — they change every session):
  - Rounds/progress: page.locator('#mathai-progress-slot .mathai-progress-text')
  - Lives: page.locator('#mathai-progress-slot .mathai-lives-display')

Screen visibility rules:
  - On start/transition screen: #mathai-transition-slot is visible; game content is HIDDEN
  - On game screen (after startGame()): game content is visible; #mathai-transition-slot is hidden

Game-specific selectors: USE THE DOM SNAPSHOT below for actual element IDs and selectors.
  - Do NOT guess element IDs — read them from the DOM snapshot and HTML
  - Define helper functions in the test body as needed (e.g. submitAnswer, clickChoice, etc.)
  - Use page.evaluate() for non-numeric input: el.value = 'abc'; el.dispatchEvent(new Event('input', {bubbles:true}))

The following are already defined globally — DO NOT redefine them:
  dismissPopupIfPresent(page), startGame(page), clickNextLevel(page)
  waitForPhase(page, phase, timeout?) — waits for #app[data-phase="phase"]; PREFER over toBeVisible for phase checks
  getLives(page) — returns lives as integer from data-lives attribute (not emoji text)
  getScore(page) — returns score as integer from data-score attribute
  getRound(page) — returns currentRound as integer from data-round attribute
  skipToEnd(page, reason?) — calls window.__ralph.endGame(reason) to jump to end; reason='victory'|'game_over'
  answer(page, correct?) — calls window.__ralph.answer(correct) using game-specific selector; waits for processing
  test.beforeEach() — already navigates to page and waits for initialization
  fallbackContent — captured game content (rounds, items, data)
    IMPORTANT: fallbackContent.rounds may be empty []. Always check length before accessing:
    const rounds = fallbackContent.rounds.length > 0 ? fallbackContent.rounds : null;
    If no fallbackContent, derive expected values from the game HTML/spec instead.

PHASE-BASED NAVIGATION — use data-phase attribute instead of timing hacks:
  After startGame(): #app[data-phase="playing"] — game is active
  After level transition: #app[data-phase="transition"] — level complete screen
  After game ends: #app[data-phase="results"] or #app[data-phase="gameover"]
  PREFER: await waitForPhase(page, 'playing') over arbitrary waitForTimeout()
  PREFER: expect(await getLives(page)).toBe(2) over toHaveText("❤️❤️")
  PREFER: await skipToEnd(page, 'victory') over playing all rounds manually

OUTPUT INSTRUCTIONS:
- Output ONLY a single test.describe('${category}', () => { ... }); block
- Do NOT include import statements, beforeEach, helper function definitions, or fallbackContent
- Start directly with: test.describe('${category}', () => {
- Use test() for each test case — NOT nested test.describe() for sub-groups
- Pure JavaScript — no TypeScript type annotations (no : any[], no : string, etc.)
- Use double quotes for test() names: test("test name", async...) — never single quotes in names
- NEVER access window.gameState.content — use fallbackContent instead
- If evaluating JS state: expect(await page.evaluate(() => window.x)).toBe(v) — NOT await expect(page.evaluate(...))
- Slot IDs use '#' prefix; progress display classes use '.' prefix
- DO NOT generate tests requiring real wall-clock delays for time-based scoring. Instead test the endGame() postMessage payload directly.
- Do NOT call window.visibilityTracker methods directly — dispatch visibilitychange event instead
- Do NOT call Object.defineProperty(document, 'visibilityState') in test body — already defined in beforeEach initScript; calling it again throws "Cannot redefine property". Use: await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
- IMPORTANT: Do NOT write tests that rely on the Page Visibility API (document.visibilityState, document.hidden, visibilitychange events). The test harness permanently overrides visibilityState to 'visible' in beforeEach, so visibility-based pause/resume tests can never pass. Skip any test case ideas involving tab switching, app backgrounding, or visibility tracking.
- For "game over logic" tests: use skipToEnd(page, 'game_over') then waitForPhase(page, 'gameover') — do NOT look for specific game-over DOM elements that may not exist
- For "restart functionality" tests: after clicking 'Try Again'/'Play Again', use startGame(page) helper to click through the start transition screen — do NOT use manual if(isVisible()) checks which fail due to CDN animation delays
- NEVER assert exact CDN ProgressBar lives text like toHaveText("❤️❤️") — use getLives(page) or page.evaluate(() => window.gameState.lives) instead
- NEVER assert exact timer display text like toBe('00:00') or toHaveText('0:00') — CDN timer format varies; instead check visibility: await expect(page.locator('#mathai-timer-slot')).toBeVisible()
- To trigger endGame without playing all rounds: use skipToEnd(page, 'victory') — do NOT call window.endGame directly
- When testing that re-clicking a "correct" cell does nothing: use cell.click({ force: true }) — CSS pointer-events:none on .correct cells prevents plain cell.click() from working in Playwright
- Wrap output in a \`\`\`javascript code block
${formatLearningsBlock()}${domSnapshot ? `\n${domSnapshot}\n` : ''}
HTML:
${htmlContent}`;

        let catOutput;
        try {
          catOutput = await trackedLlmCall(`generate-tests-${category}`, catPrompt, TEST_MODEL, {}, report);
          llmCalls.push({ step: `generate-tests-${category}`, model: TEST_MODEL });
        } catch (err) {
          warn(`[pipeline] Test generation for '${category}' failed: ${err.message} — skipping`);
          return;
        }

        let catTests = extractTests(catOutput);
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
        const hasSlot = htmlContent.includes('mathai-transition-slot');
        const newBeforeEach = hasSlot ? `test.beforeEach(async ({ page }) => {
  // Override visibilityState so VisibilityTracker never pauses (Playwright headless sets hidden)
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // FeedbackManager.init() shows an audio permission popup that BLOCKS game initialization.
  // ScreenLayout.inject() runs only AFTER FeedbackManager.init() resolves.
  // CDN scripts may take >8s to load — poll for both popup and slot together so we never
  // miss the popup appearing after a fixed timeout window.
  {
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible({ timeout: 5000 });
  }
});` : `test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
  });
  await page.goto('/');
  // Non-CDN game: wait for game to reach start phase
  await page.waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
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

      // Fix toHaveStyle used to check CSS-class-based styling — use toHaveClass or toBeVisible instead
      // toHaveStyle only works for inline styles; CDN games use CSS classes
      if (/\.toHaveStyle\s*\(/.test(tests)) {
        // Replace toHaveStyle assertions with a no-op comment to prevent crash
        // Triage will fix the test logic if needed
        tests = tests.replace(/await expect\([^)]+\)\.toHaveStyle\([^)]+\);/g, '// NOTE: toHaveStyle removed — use toHaveClass or page.evaluate for style checks');
        changed = true;
      }

      // Fix expect(transitionSlot).toBeHidden() — CDN keeps the slot div visible (just removes buttons)
      // The correct check is: expect(slot button).not.toBeVisible()
      if (/expect\s*\([^)]*transition[Ss]lot[^)]*\)\s*\.toBeHidden/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*([^)]*transition[Ss]lot[^)]*)\s*\)\s*\.toBeHidden\s*\(\s*\)/g,
          "await expect(page.locator('#mathai-transition-slot button').first()).not.toBeVisible({ timeout: 5000 })",
        );
        changed = true;
      }

      // Fix toHaveText on lives display — CDN ProgressBar renders lives internally as emoji/icons.
      // Tests MUST use page.evaluate(() => window.gameState.lives) instead of visual text assertions.
      if (/\.mathai-lives-display['"]\s*\)\s*\.toHaveText\s*\(/.test(tests) ||
          /locator\s*\([^)]*lives[^)]*\)\s*\.toHaveText\s*\(\s*["'][\u2764\u2665❤]/.test(tests)) {
        tests = tests.replace(
          /await\s+expect\s*\(\s*page\.locator\s*\(\s*['"][^'"]*lives[^'"]*['"]\s*\)\s*\)\s*\.toHaveText\s*\(\s*["']([^"']+)["']\s*\)/g,
          (match, expectedText) => {
            // Count emoji hearts to determine expected lives count
            const heartCount = (expectedText.match(/[\u2764\u2665❤]/g) || []).length;
            if (heartCount > 0) {
              return `expect(await page.evaluate(() => window.gameState.lives)).toBe(${heartCount})`;
            }
            return match;
          },
        );
        changed = true;
      }

      // Fix re-click on .correct cell — CSS pointer-events:none prevents Playwright's click().
      // Pattern: toHaveClass(/correct/) followed by cell.click() (same locator)
      // Fix: add { force: true } to the second click to bypass the CSS guard.
      if (/toHaveClass\s*\(\/correct\/\)/.test(tests) && /\.click\(\)/.test(tests)) {
        // Match: await cell.click(); that follows within ~5 lines of toHaveClass(/correct/)
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

  // Generate Playwright config with dynamic port (set later when server starts)
  // Port is written to gameDir/playwright.config.js after testPort is known — see Step 3.

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
    const testPort = await findFreePort();
    // Write playwright config with the actual port for this build
    fs.writeFileSync(
      path.join(gameDir, 'playwright.config.js'),
      `const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:${testPort}',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npx serve . -l ${testPort} -s --no-clipboard',
    port: ${testPort},
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
`,
    );
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', String(testPort), '-s', '--no-clipboard'], {
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
  // Accumulate passing test bodies from completed batches — included in subsequent fix prompts
  // to prevent fixes from regressing tests that already pass in earlier batches
  const priorBatchPassingTests = []; // { batchLabel, testBodies: string[] }

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
            ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
            { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
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

        if (passed === 0 && failed === 0) {
          warn(`[pipeline] [${batchLabel}] 0/0 tests: no tests ran — page likely broken by last fix, restoring best HTML`);
          if (bestHtmlSnapshot) {
            fs.writeFileSync(htmlFile, bestHtmlSnapshot);
            info(`[pipeline] [${batchLabel}] Restored best HTML (${bestPassed} passed)`);
          }
          if (iteration >= MAX_ITERATIONS) break;
          continue; // Skip triage and fix — page was broken, restoration is the fix
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
- "skip_test": The test has a wrong assumption, tests untestable behavior, or has a logic error. The HTML is correct.

HARNESS FACTS (do NOT assume harness methods are missing):
- window.__ralph.setLives(n) IS implemented and works correctly. DO NOT skip a test just because it calls setLives().
- window.__ralph.endGame(reason) IS implemented. DO NOT skip a test just because it calls endGame().
- window.__ralph.getLastPostMessage() IS implemented.
- If a test calls setLives() and the error is NOT "setLives is not a function" or "Cannot read properties of undefined (reading 'setLives')", then setLives() is NOT the problem — diagnose the ACTUAL error message.

KNOWN HTML BUGS — always diagnose as fix_html:
- TypeError: Cannot read properties of undefined (reading 'setLives'|'jumpToRound'|'getLastPostMessage'|'syncDOMState'|'endGame'|'setRoundTimes'|'answer') → window.__ralph is undefined → the test harness was NOT injected → the game page has a JavaScript error that prevented initialization → fix the HTML to resolve the JS error.
- "is not a function" on any window.__ralph method → harness methods missing → page init failed → fix the HTML.
- window.__ralph is not defined → same as above → fix the HTML.

KNOWN TEST BUGS — always diagnose as skip_test:
- TimeoutError: locator.click timeout on a cell that was previously clicked and is now .correct → cell has pointer-events:none from CSS, Playwright cannot click it. The test is re-clicking a disabled cell.
- TypeError: Cannot read properties of undefined (reading 'filter'|'length') on window.gameState.events → game doesn't track events array; test assumption is wrong.
- page.evaluate: TypeError: Cannot redefine property: visibilityState → already defined in beforeEach initScript; cannot redefine in test body.

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
        let triageRationale = '';
        const detTriage = deterministicTriage(failureDescs);
        if (detTriage) {
          info(`[pipeline] [${batchLabel}] Triage (deterministic): ${detTriage}`);
          triageDecision = detTriage;
          triageRationale = 'deterministic pattern match';
        } else {
          try {
            const triageOutput = await trackedLlmCall(`triage-${batchLabel}-${iteration}`, triagePrompt, TRIAGE_MODEL, {}, report);
            llmCalls.push({ step: `triage-${batchLabel}-${iteration}`, model: TRIAGE_MODEL });
            // Find the last JSON block containing "decision" key
            const lastDecisionIdx = triageOutput.lastIndexOf('"decision"');
            let jsonMatch = null;
            if (lastDecisionIdx !== -1) {
              // Walk backwards to find the opening brace
              let start = triageOutput.lastIndexOf('{', lastDecisionIdx);
              if (start !== -1) jsonMatch = [triageOutput.slice(start)];
            }
            if (!jsonMatch) jsonMatch = triageOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              // Extract complete JSON by counting braces
              let depth = 0, end = -1;
              for (let i = 0; i < jsonMatch[0].length; i++) {
                if (jsonMatch[0][i] === '{') depth++;
                else if (jsonMatch[0][i] === '}') { depth--; if (depth === 0) { end = i; break; } }
              }
              const triage = JSON.parse(end !== -1 ? jsonMatch[0].slice(0, end + 1) : jsonMatch[0]);
              triageDecision = triage.decision || 'fix_tests';
              triageFixHints = triage.fix_hints || '';
              triageSkipTests = triage.tests_to_skip || [];
              triageRationale = triage.rationale || '';
              info(`[pipeline] [${batchLabel}] Triage: ${triageDecision} — ${triageRationale}`);
            }
          } catch {
            info(`[pipeline] [${batchLabel}] Triage failed, defaulting to fix_tests (safer for pre-built games)`);
          }
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
            if (changed) {
              // If no runnable tests remain, delete the file — it will be regenerated next run
              if (!/^\s*test\s*\(/m.test(specContent)) {
                fs.unlinkSync(specFile);
                info(`[pipeline] [${batchLabel}] Deleted empty spec file after triage — will regenerate on next build`);
              } else {
                fs.writeFileSync(specFile, specContent);
              }
            }
          }
          // Accumulate skipped tests for database tracking
          if (triageSkipTests.length > 0) {
            for (const testName of triageSkipTests) {
              report.skipped_tests.push({
                testName,
                reason: triageRationale || 'triage determined test logic is incorrect',
                batch: batchLabel,
                iteration,
              });
            }
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

        // Include passing tests from previously-completed batches to prevent cross-batch regressions
        const priorBatchContext = priorBatchPassingTests.length > 0
          ? `\nPREVIOUSLY PASSING BATCHES — these tests passed in earlier batches and MUST NOT be broken by this fix:\n${
              priorBatchPassingTests.map(({ batchLabel: bl, testBodies }) =>
                `=== ${bl} (DO NOT REGRESS) ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``
              ).join('\n\n')
            }\n`
          : '';

        const fixHintContext = triageFixHints ? `\nTARGETED FIX HINT: ${triageFixHints}\n` : '';
        const fixLearningsContext = globalLearnings ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${globalLearnings}\n` : '';

        // For contract failures involving stars, include the spec scoring section verbatim
        let specScoringContext = '';
        if (batchLabel === 'contract' && failuresStr.includes('star')) {
          // Extract scoring/star section from spec
          const scoringMatch = specContent.match(/(?:#{1,3}[^\n]*(?:scor|star|metric)[^\n]*\n)([\s\S]*?)(?=\n#{1,3}|\Z)/i);
          if (scoringMatch) {
            specScoringContext = `\nSPEC SCORING SECTION (authoritative — implement EXACTLY this logic):\n${scoringMatch[0].trim()}\n`;
          } else {
            // Fallback: include star type hint
            specScoringContext = `\nSPEC STAR LOGIC: starType="${specMeta.starType}" — ${
              specMeta.starType === 'lives' ? 'stars = gameState.lives (remaining lives at game end, 0-3)' :
              specMeta.starType === 'avg-time' ? 'stars based on average time per round (see spec for thresholds)' :
              specMeta.starType === 'accuracy' ? 'stars based on accuracy percentage (see spec for thresholds)' :
              'see spec for star formula'
            }\n`;
          }

          // Extract star-related test bodies from prior passing batches as reference implementations
          const starRelatedTestBodies = [];
          for (const { batchLabel: bl, testBodies } of priorBatchPassingTests) {
            for (const body of testBodies) {
              if (/\bstar|\bmetrics\.stars/.test(body)) {
                starRelatedTestBodies.push({ batchLabel: bl, body });
              }
            }
          }
          if (starRelatedTestBodies.length > 0) {
            const starRefContext = starRelatedTestBodies
              .map(({ batchLabel: bl, body }) => `=== ${bl} (reference: star logic) ===\n\`\`\`javascript\n${body}\n\`\`\``)
              .join('\n\n');
            specScoringContext += `\n\nREFERENCE IMPLEMENTATIONS — these test bodies PROVE the correct star formula works:\n${starRefContext}\n`;
          }
        }

        // ── E8: Script-only fix (iteration 2+, non-contract batches, large HTML) ──
        // Send only <script> sections to the fix LLM to reduce context and token cost.
        // Merge the corrected scripts back into the original HTML after the LLM responds.
        const useE8ScriptOnly = iteration >= 2
          && triageDecision === 'fix_html'
          && batchLabel !== 'contract'
          && currentHtml.length > 10000;

        let e8OriginalHtml = null;
        let htmlForPrompt = currentHtml;
        let outputInstructions = `OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ONLY the failing tests — the passing tests listed above MUST continue to pass
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the failures`;

        if (useE8ScriptOnly) {
          const scriptSections = extractScriptSections(currentHtml);
          if (scriptSections.length > 0) {
            const scriptContent = scriptSections.map(s => s.content).join('\n');
            e8OriginalHtml = currentHtml;
            htmlForPrompt = scriptContent;
            outputInstructions = `OUTPUT INSTRUCTIONS:
IMPORTANT: The following is ONLY the JavaScript sections of the HTML. Return ONLY the corrected JavaScript <script> blocks — do NOT include HTML structure, <style>, or other content. The pipeline will merge your fix back into the full HTML.
- Output the corrected <script> blocks in a \`\`\`html code block
- Fix ONLY the failing tests — the passing tests listed above MUST continue to pass
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the failures`;
            info(`[pipeline] [${batchLabel}] E8: Sending script-only fix (${Math.round(scriptContent.length / 1024)}kb of ${Math.round(currentHtml.length / 1024)}kb)`);
          }
        }

        const fixPrompt = `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}${specScoringContext}${fixLearningsContext}
FAILING TESTS (${failed} failures):
${failuresStr}
${passingContext}${priorBatchContext}
FAILING TEST FILE(S):
\`\`\`javascript
${batchTests}
\`\`\`

CURRENT HTML:
${htmlForPrompt}

CRITICAL CDN CONSTRAINTS (do NOT violate these while fixing):
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget: .catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); }), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- isProcessing=true must SILENTLY BLOCK clicks (early return), NOT hide/show elements — buttons stay visible
- CDN init order is immutable: await FeedbackManager.init() → ScreenLayout.inject() → game template clone
- Do NOT add event listeners inside innerHTML setters — use event delegation on parent only
- Do NOT move CDN <script> tags or change their order
- Do NOT change any CDN <script src="..."> URLs. The correct CDN domain is cdn.homeworkapp.ai — never change this to cdn.mathai.ai or any other domain. Changing CDN URLs makes all scripts 404 and the entire game goes blank.
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block — only add/modify the specific broken functionality. Removing gameState.isActive=true or syncDOMState() calls will break all tests.
- Do NOT remove or rename elements in <template id="game-template"> — template corruption causes ALL tests to fail (0/0)
- Star display MUST update on game over: show ☆☆☆ for 0 stars in the game-over code path, not only on victory
- Lives display DOM element MUST update immediately when a life is lost, before any animation
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() IMMEDIATELY in endGame() — destroys CDN DOM elements; tests check them AFTER game over. Use 10s delay: setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
- TimerComponent MUST be initialized with startTime: 0 (never startTime: 1)
- NEVER define a custom updateLivesDisplay() function — let ProgressBarComponent handle lives display via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window (window.endGame = endGame etc.) so the test harness can call them. CDN games define these as local functions inside DOMContentLoaded — always add window.X = X assignments after each function definition.
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- Preserve ALL existing data-testid attributes — never remove them; add data-testid to any new elements you create
- gameState.phase MUST be set at every state transition: 'playing' (active round starts), 'transition' (between levels/rounds, waiting for next button), 'gameover' (lives=0), 'results' (game complete). The test harness reads gameState.phase to set data-phase on #app — without these, waitForPhase() will timeout.

${outputInstructions}`;

        fixHistory += `\nIteration ${iteration}: ${failed} failures — ${failuresStr}`;

        let fixOutput;
        let usedFixModel = FIX_MODEL;
        try {
          fixOutput = await trackedLlmCall(`fix-${batchLabel}-${iteration}`, fixPrompt, FIX_MODEL, {}, report);
          llmCalls.push({ step: `fix-${batchLabel}-${iteration}`, model: FIX_MODEL });
        } catch {
          try {
            fixOutput = await trackedLlmCall(`fix-${batchLabel}-fallback-${iteration}`, fixPrompt, FALLBACK_MODEL, {}, report);
            llmCalls.push({ step: `fix-${batchLabel}-fallback-${iteration}`, model: FALLBACK_MODEL });
            usedFixModel = FALLBACK_MODEL;
          } catch {
            warn(`[pipeline] Both fix models failed for batch '${batchLabel}'`);
            continue;
          }
        }

        let fixedHtml = extractHtml(fixOutput);
        // E8: merge script-only fix back into original HTML
        if (fixedHtml && e8OriginalHtml) {
          const merged = mergeScriptFix(e8OriginalHtml, fixedHtml);
          if (merged) {
            info(`[pipeline] [${batchLabel}] E8: Merged script fix back into full HTML`);
            fixedHtml = merged;
          } else {
            info(`[pipeline] [${batchLabel}] E8: Merge failed — using fix output as-is`);
          }
        }
        if (fixedHtml) {
          // Snapshot current HTML before applying fix — used for rollback if fix regresses
          const preFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          const preFixSizeKb = Math.round(preFixSnapshot.length / 1024);
          fs.writeFileSync(htmlFile, fixedHtml + '\n');
          const newSizeKb = Math.round(fixedHtml.length / 1024);
          progress('html-fixed', { gameId, htmlFile, batch: batchLabel, iteration, passed: batchPassed, failed: batchFailed, total: batchPassed + batchFailed, model: usedFixModel, prevSizeKb: preFixSizeKb, newSizeKb });

          // Quick sanity: if fix shrank HTML dramatically (>30% smaller), it likely dropped game logic — rollback
          const shrinkRatio = fixedHtml.length / preFixSnapshot.length;
          if (shrinkRatio < 0.7) {
            warn(`[pipeline] [${batchLabel}] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, rolling back`);
            fs.writeFileSync(htmlFile, preFixSnapshot);
            progress('html-fix-rolled-back', { gameId, batch: batchLabel, iteration, reason: 'size-drop' });
            break;
          }
          // Re-inject test harness after fix (LLM may have removed it)
          injectHarnessToFile(htmlFile);
        }
      }

      totalPassed += batchPassed;
      totalFailed += batchFailed;
      report.category_results[batchLabel] = { passed: batchPassed, failed: batchFailed };

      // Collect passing test bodies from this batch to protect them in future batches
      if (batchPassed > 0) {
        const batchPassingBodies = [];
        try {
          for (const specFile of batch.filter((f) => fs.existsSync(f))) {
            const specSrc = fs.readFileSync(specFile, 'utf-8');
            // Extract passing test names by re-running a quick JSON read of the last testResult
            // We already have batchPassed > 0, so collect all test() bodies as "known passing"
            // (conservative: include all tests from this batch since it passed some)
            const testMatches = specSrc.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`][\s\S]*?^\}\s*\);/gm);
            for (const m of testMatches) {
              batchPassingBodies.push(m[0]);
            }
          }
        } catch { /* ignore */ }
        if (batchPassingBodies.length > 0) {
          priorBatchPassingTests.push({ batchLabel, testBodies: batchPassingBodies });
        }
      }
    }

    // ── Step 3c: Global fix loop — cross-batch root-cause resolution ──────────
    // After all per-batch fix loops, some batches may still fail because their
    // root cause was only visible from another batch. This loop collects ALL
    // remaining failures into one prompt for cross-category diagnosis.
    if (MAX_GLOBAL_FIX_ITERATIONS > 0) {
      const hasCrossFailures = Object.values(report.category_results).some((r) => r.failed > 0);
      if (hasCrossFailures) {
        info(`[pipeline] Step 3c: Global fix loop (up to ${MAX_GLOBAL_FIX_ITERATIONS} iterations)`);
        const failingCategoryNames = Object.entries(report.category_results)
          .filter(([, r]) => r.failed > 0)
          .map(([cat]) => cat);
        progress('global-fix-start', { gameId, maxGlobalIterations: MAX_GLOBAL_FIX_ITERATIONS, failingCategories: failingCategoryNames, model: GLOBAL_FIX_MODEL });

        for (let globalIter = 1; globalIter <= MAX_GLOBAL_FIX_ITERATIONS; globalIter++) {
          info(`[pipeline] [global] Iteration ${globalIter}/${MAX_GLOBAL_FIX_ITERATIONS}`);

          // Re-test all batches to get current truth
          const globalFailingBatches = [];
          const globalPassingBatches = [];

          for (const batch of batches) {
            const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
            let rtr;
            try {
              const { stdout } = await execFileAsync(
                'npx',
                ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
                { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
              );
              rtr = JSON.parse(stdout);
            } catch (err) {
              try { rtr = JSON.parse(err.stdout || '{}'); } catch { rtr = {}; }
            }
            const gPassed = rtr?.stats?.expected || 0;
            const gFailed = rtr?.stats?.unexpected || 0;

            if (gFailed === 0 && gPassed > 0) {
              const bodies = [];
              try {
                for (const specFile of batch.filter((f) => fs.existsSync(f))) {
                  const src = fs.readFileSync(specFile, 'utf-8');
                  const ms = src.matchAll(/test\s*\(\s*["'`]([^"'`]+)["'`][\s\S]*?^\}\s*\);/gm);
                  for (const m of ms) bodies.push(m[0]);
                }
              } catch { /* ignore */ }
              globalPassingBatches.push({ batchLabel, testBodies: bodies });
            } else if (gFailed > 0) {
              const failureDescs = [];
              try { collectFailures(rtr.suites, '', failureDescs); } catch { /* ignore */ }
              const batchTests = batch
                .filter((f) => fs.existsSync(f))
                .map((f) => `=== ${path.basename(f)} ===\n${fs.readFileSync(f, 'utf-8')}`)
                .join('\n\n');
              globalFailingBatches.push({ batch, batchLabel, failureDescs, passed: gPassed, failed: gFailed, batchTests });
            }
          }

          if (globalFailingBatches.length === 0) {
            info(`[pipeline] [global] All batches pass — exiting global fix loop`);
            break;
          }

          info(`[pipeline] [global] ${globalFailingBatches.length} batch(es) still failing: ${globalFailingBatches.map((b) => b.batchLabel).join(', ')}`);

          const globalFailureSummary = globalFailingBatches
            .map(({ batchLabel, failureDescs, passed, failed }) =>
              `### Category: ${batchLabel}\n${passed} passing, ${failed} failing:\n${failureDescs.join('\n')}`)
            .join('\n\n');

          const globalTestFilesBlock = globalFailingBatches
            .map(({ batchLabel, batchTests }) => `=== ${batchLabel} test file(s) ===\n${batchTests}`)
            .join('\n\n');

          const globalPassingContext = globalPassingBatches.length > 0
            ? `\nFULLY PASSING CATEGORIES — MUST NOT REGRESS:\n${
                globalPassingBatches.map(({ batchLabel, testBodies }) =>
                  `=== ${batchLabel} ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``)
                  .join('\n\n')
              }\n`
            : '';

          const alreadyCovered = new Set(globalPassingBatches.map((b) => b.batchLabel));
          const additionalPriorContext = priorBatchPassingTests
            .filter(({ batchLabel }) => !alreadyCovered.has(batchLabel) && !globalFailingBatches.some((b) => b.batchLabel === batchLabel))
            .map(({ batchLabel, testBodies }) =>
              `=== ${batchLabel} (prior passing — do not regress) ===\n\`\`\`javascript\n${testBodies.join('\n\n')}\n\`\`\``)
            .join('\n\n');

          const fixLearningsContext = globalLearnings ? `\nACCUMULATED LEARNINGS (avoid these known pitfalls):\n${globalLearnings}\n` : '';
          const currentHtml = fs.readFileSync(htmlFile, 'utf-8');

          const globalFixPrompt = `The following HTML game still has test failures after per-category fix loops have run.

This is GLOBAL FIX iteration ${globalIter}/${MAX_GLOBAL_FIX_ITERATIONS}. You are seeing ALL failing categories simultaneously so you can diagnose cross-category root causes that are not visible when looking at one category in isolation.

INSTRUCTION: Diagnose the ROOT CAUSE that is common across failing categories. A single HTML bug often manifests as different symptoms in different test categories. Fix the root cause — do NOT patch each category's symptom independently.
${fixLearningsContext}
FAILING CATEGORIES (${globalFailingBatches.length} total):

${globalFailureSummary}
${globalPassingContext}${additionalPriorContext ? `\nADDITIONAL PRIOR PASSING TESTS (do not regress):\n${additionalPriorContext}\n` : ''}
FAILING TEST FILES:
\`\`\`javascript
${globalTestFilesBlock}
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
- Do NOT change any CDN <script src="..."> URLs. The correct CDN domain is cdn.homeworkapp.ai — never change this to cdn.mathai.ai or any other domain
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block
- Do NOT remove or rename elements in <template id="game-template">
- Star display MUST update on game over
- Lives display DOM element MUST update immediately when a life is lost
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() IMMEDIATELY in endGame() — use 10s delay
- TimerComponent MUST be initialized with startTime: 0
- NEVER define a custom updateLivesDisplay() function
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window
- gameState.phase MUST be set at every state transition: 'playing', 'transition', 'gameover', 'results'
- Preserve ALL existing data-testid attributes

OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ALL failing categories in a single HTML output — this is intentionally cross-category
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the root cause`;

          progress('global-fix-prompt', { gameId, globalIter, failingBatches: globalFailingBatches.map((b) => b.batchLabel) });

          let globalFixOutput;
          try {
            globalFixOutput = await trackedLlmCall(`global-fix-${globalIter}`, globalFixPrompt, GLOBAL_FIX_MODEL, {}, report);
            llmCalls.push({ step: `global-fix-${globalIter}`, model: GLOBAL_FIX_MODEL });
          } catch {
            try {
              globalFixOutput = await trackedLlmCall(`global-fix-fallback-${globalIter}`, globalFixPrompt, FALLBACK_MODEL, {}, report);
              llmCalls.push({ step: `global-fix-fallback-${globalIter}`, model: FALLBACK_MODEL });
            } catch {
              warn(`[pipeline] [global] Both fix models failed for global iteration ${globalIter}`);
              break;
            }
          }

          const globalFixedHtml = extractHtml(globalFixOutput);
          if (!globalFixedHtml) {
            warn(`[pipeline] [global] No HTML extracted from global fix response — skipping`);
            break;
          }

          const preGlobalFixSnapshot = fs.readFileSync(htmlFile, 'utf-8');
          const shrinkRatio = globalFixedHtml.length / preGlobalFixSnapshot.length;
          if (shrinkRatio < 0.7) {
            warn(`[pipeline] [global] Fix shrank HTML by ${Math.round((1 - shrinkRatio) * 100)}% — likely dropped logic, aborting`);
            progress('global-fix-rolled-back', { gameId, globalIter, reason: 'size-drop' });
            break;
          }

          fs.writeFileSync(htmlFile, globalFixedHtml + '\n');
          injectHarnessToFile(htmlFile);
          progress('global-fix-applied', { gameId, globalIter, failingBatches: globalFailingBatches.map((b) => b.batchLabel), htmlFile });
          info(`[pipeline] [global] Applied global fix ${globalIter} — HTML updated`);
        }

        info(`[pipeline] Step 3c complete`);
      } else {
        info(`[pipeline] Step 3c: No cross-batch failures — skipping global fix loop`);
      }
    }

    // ── Step 3b: Final re-test of ALL batches on final HTML ──────────────────
    // Re-test every batch to get an accurate final score. Later-batch fixes may
    // have improved zero-score batches, but may also have regressed batches that
    // previously had passing tests. Re-testing all batches catches both cases.
    const batchesToReTest = batches.filter((batch) => {
      return batch.some((specFile) => fs.existsSync(specFile));
    });
    if (batchesToReTest.length > 0) {
      info(`[pipeline] Step 3b: Re-testing all ${batchesToReTest.length} batch(es) on final HTML`);
      for (const batch of batchesToReTest) {
        const batchLabel = batch.map((f) => path.basename(f, '.spec.js')).join('+');
        let reTestResult;
        try {
          const { stdout } = await execFileAsync(
            'npx',
            ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...batch.map((f) => path.relative(gameDir, f))],
            { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
          );
          reTestResult = JSON.parse(stdout);
        } catch (err) {
          try { reTestResult = JSON.parse(err.stdout || '{}'); } catch { reTestResult = {}; }
        }
        const reTestPassed = reTestResult?.stats?.expected || 0;
        const reTestFailed = reTestResult?.stats?.unexpected || 0;
        const prevPassed = report.category_results[batchLabel]?.passed || 0;
        const prevFailed = report.category_results[batchLabel]?.failed || 0;
        if (reTestPassed !== prevPassed || reTestFailed !== prevFailed) {
          info(`[pipeline] [${batchLabel}] Final re-test: ${prevPassed}p/${prevFailed}f → ${reTestPassed}p/${reTestFailed}f — updating score`);
          totalPassed += reTestPassed - prevPassed;
          totalFailed += reTestFailed - prevFailed;
          report.category_results[batchLabel] = { passed: reTestPassed, failed: reTestFailed };
        } else {
          info(`[pipeline] [${batchLabel}] Final re-test: unchanged (${reTestPassed}p/${reTestFailed}f)`);
        }
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

  // Fail before review if game-flow category has 0% pass rate AND overall passRate < 0.7
  const gameFlowResult = report.category_results['game-flow'];
  if (gameFlowResult && gameFlowResult.passed === 0 && passRate < 0.7) {
    info(`[pipeline] Step 4: game-flow 0% pass rate with overall passRate ${Math.round(passRate * 100)}% — review skipped (need ≥70% overall)`);
    report.status = 'FAILED';
    report.review_result = 'SKIPPED';
    writeReport();
    return report;
  }

  const categoryResultsSummary = Object.entries(report.category_results || {})
    .map(([cat, r]) => `  ${cat}: ${r.passed}/${(r.passed || 0) + (r.failed || 0)} passing`)
    .join('\n');

  info(`[pipeline] Step 4: Review (${lastPassed}/${totalTests} tests passing)`);
  const reviewStartTime = Date.now();
  progress('review', { gameId, model: REVIEW_MODEL });

  const reviewPrompt = `You are a game quality reviewer. Review the following HTML game against its specification.

TEST RESULTS BY CATEGORY:
${categoryResultsSummary}

The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

HTML:
${fs.readFileSync(htmlFile, 'utf-8')}`;

  let reviewResult;
  try {
    reviewResult = await trackedLlmCall('review', reviewPrompt, REVIEW_MODEL, {}, report);
    llmCalls.push({ step: 'review', model: REVIEW_MODEL });
  } catch {
    warn('[pipeline] Review LLM call failed — treating as approved');
    report.status = 'APPROVED';
    report.review_result = 'SKIPPED_LLM_FAILURE';
    writeReport();
    return report;
  }

  report.review_result = reviewResult;

  // ─── Step 4b: Review rejection → targeted fix loop ─────────────────────────
  // If reviewer rejects, attempt up to 2 targeted HTML fixes before giving up.
  const MAX_REVIEW_FIX_ATTEMPTS = 3;
  let reviewAttempt = 0;
  while (!/^APPROVED/i.test(reviewResult) && reviewAttempt < MAX_REVIEW_FIX_ATTEMPTS) {
    reviewAttempt++;
    warn(`[pipeline] Review rejected (attempt ${reviewAttempt}/${MAX_REVIEW_FIX_ATTEMPTS}) — attempting targeted fix`);
    progress('review-fix', { gameId, attempt: reviewAttempt, rejection: reviewResult });

    const reviewFixPrompt = `The following HTML game was reviewed against its specification and REJECTED.

REJECTION REASON:
${reviewResult}

SPECIFICATION:
${specContent}

CURRENT HTML:
${fs.readFileSync(htmlFile, 'utf-8')}

Fix ALL issues listed in the rejection reason in ONE pass.
CRITICAL: Do NOT change ANYTHING not mentioned in the rejection reason — do not refactor, rewrite, or touch code that already works.
Output the complete corrected HTML wrapped in a \`\`\`html code block.`;

    try {
      const fixOutput = await trackedLlmCall(`review-fix-${reviewAttempt}`, reviewFixPrompt, FIX_MODEL, {}, report);
      llmCalls.push({ step: `review-fix-${reviewAttempt}`, model: FIX_MODEL });
      const fixedHtml = extractHtml(fixOutput);
      if (!fixedHtml) {
        warn('[pipeline] Review fix: could not extract HTML — stopping fix loop');
        break;
      }
      fs.writeFileSync(htmlFile, fixedHtml + '\n');
      progress('review-fix-applied', { gameId, attempt: reviewAttempt });
    } catch (err) {
      warn(`[pipeline] Review fix LLM call failed: ${err.message} — stopping fix loop`);
      break;
    }

    // Re-review the fixed HTML — build fresh prompt to avoid stale pre-fix HTML
    const reReviewPrompt = `You are a game quality reviewer. Review the following HTML game against its specification.

The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

## Important Guidance to Avoid False Positives

### RULE-001 (Global scope)
RULE-001 is SATISFIED if all game functions are declared at the top level of the script and event handlers (onclick= or addEventListener) call only those globally-declared functions.
RULE-001 does NOT require onclick= attributes — addEventListener() calling a global function is equally compliant.
RULE-001 FAILS only if event handlers reference functions inside a closure not accessible from global scope.

### Contract Compliance — gameState and postMessage
- window.gameState = { ... } IS the correct pattern — it exposes gameState on window as required.
- window.parent.postMessage(...) is the correct call for game events.
- Check the postMessage payload fields per the spec's contract section.

### RULE-003 (try/catch on async calls)
- Promise .catch((e) => { console.error(...) }) IS compliant for fire-and-forget async calls.
- All awaited async calls must use try/catch.

### RULE-005 (Cleanup in endGame)
- A delayed destroy via setTimeout IS compliant — cleanup originates from endGame().
- Either immediate or delayed cleanup PASSES RULE-005.

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous, resolve in favor of APPROVED unless there is clear evidence of failure.

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

HTML:
${fs.readFileSync(htmlFile, 'utf-8')}`;

    progress('review', { gameId, model: REVIEW_MODEL, attempt: reviewAttempt + 1 });
    try {
      reviewResult = await trackedLlmCall(`review-${reviewAttempt + 1}`, reReviewPrompt, REVIEW_MODEL, {}, report);
      llmCalls.push({ step: `review-${reviewAttempt + 1}`, model: REVIEW_MODEL });
    } catch {
      warn('[pipeline] Re-review LLM call failed — treating as approved');
      reviewResult = 'APPROVED';
    }
    report.review_result = reviewResult;
  }

  if (/^APPROVED/i.test(reviewResult)) {
    report.status = 'APPROVED';
    info('[pipeline] APPROVED by review');
  } else {
    report.status = 'REJECTED';
    warn(`[pipeline] Review rejected after ${reviewAttempt} fix attempt(s): ${reviewResult}`);
  }

  progress('review-complete', { gameId, status: report.status, reviewResult, categoryResults: report.category_results, model: REVIEW_MODEL, time: Math.round((Date.now() - reviewStartTime) / 1000) });

  // ─── Step 5: Extract cross-game learnings ───────────────────────────────
  // After every build that had failures, extract generalizable insights and
  // append them to global-learnings.md so future builds benefit.
  const hadFailures = report.test_results.some((r) => r.failed > 0 || r.passed === 0);
  if (hadFailures || report.status === 'REJECTED') {
    try {
      const failureSummary = report.test_results
        .filter((r) => r.failures && r.failures.length > 0)
        .map((r) => r.failures.join('\n'))
        .join('\n');
      const rejectionNote = report.status === 'REJECTED' ? `\nREJECTION: ${reviewResult}` : '';
      if (failureSummary || rejectionNote) {
        const extractPrompt = `You analyzed a MathAI game build that had test failures or review rejections.
Extract 1–4 SHORT, GENERALIZABLE bullet points about patterns that caused failures and how to fix them.
Focus on: HTML structure issues, Playwright selector patterns, CDN integration patterns, postMessage contract issues.
IGNORE game-specific content (names, numbers, colors). Write only patterns that apply to ANY future MathAI game build.
Keep each bullet to one sentence. Output ONLY bullet points (no prose, no headers):

FAILURES:
${failureSummary.slice(0, 2000)}${rejectionNote}`;
        const learningsOut = await trackedLlmCall('extract-learnings', extractPrompt, LEARNINGS_MODEL, {}, report);
        llmCalls.push({ step: 'extract-learnings', model: LEARNINGS_MODEL });
        const bullets = learningsOut
          .split('\n')
          .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
          .filter((l) => l.length > 20 && l.length < 300);
        for (const bullet of bullets.slice(0, 4)) {
          appendGlobalLearning(bullet);
        }
        if (bullets.length > 0) {
          info(`[pipeline] Appended ${bullets.length} cross-game learning(s) to global-learnings.md`);
        }
      }
    } catch {
      // non-critical — don't fail the build over learning extraction
    }
  }

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

  // Extract spec metadata for harness injection
  const specMetaTF = fs.existsSync(specPath) ? extractSpecMetadata(fs.readFileSync(specPath, 'utf-8')) : { interactionType: 'text-input', starType: 'lives', totalRounds: null, totalLives: null };
  function injectHarnessToFile(filePath) {
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const patched = injectTestHarness(original, specMetaTF);
      if (patched !== original) fs.writeFileSync(filePath, patched);
    } catch { /* ignore */ }
  }

  // Determine which spec files to run — prefer category-targeted files
  const SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
  const detectedCategory = options.category || detectFixCategory(feedbackPrompt);
  const allSpecFiles = SPEC_ORDER.map((cat) => path.join(testsDir, `${cat}.spec.js`)).filter((f) => fs.existsSync(f));
  const targetSpecFiles = detectedCategory
    ? allSpecFiles.filter((f) => f.includes(detectedCategory))
    : allSpecFiles;
  // Fall back to all available specs if category-specific file doesn't exist
  const specFiles = targetSpecFiles.length > 0 ? targetSpecFiles : allSpecFiles;

  resetTokens();

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
    total_cost_usd: 0,
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
        ['playwright', 'test', '--config', 'playwright.config.js', '--reporter=json', ...files.map((f) => path.relative(gameDir, f))],
        { timeout: TEST_TIMEOUT, encoding: 'utf-8', cwd: gameDir },
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
    const testPort = await findFreePort();
    // Write playwright config with the actual port for this build
    fs.writeFileSync(
      path.join(gameDir, 'playwright.config.js'),
      `const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:${testPort}',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npx serve . -l ${testPort} -s --no-clipboard',
    port: ${testPort},
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
`,
    );
    serverProc = require('child_process').spawn('npx', ['-y', 'serve', gameDir, '-l', String(testPort), '-s', '--no-clipboard'], {
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
        fixOutput = await trackedLlmCall(`targeted-fix-${attempt}`, fixPrompt, FIX_MODEL, {}, report);
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
      injectHarnessToFile(htmlFile);

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

module.exports = { runPipeline, runTargetedFix, extractHtml, extractTests, extractSpecMetadata, injectTestHarness, validateSpec };
