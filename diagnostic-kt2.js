'use strict';
// diagnostic-kt2.js — Tests specifically the __ralph.answer() harness path used by actual tests
const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHOTDIR = '/tmp/keep-track/shots2';
fs.mkdirSync(SHOTDIR, { recursive: true });

async function serve(htmlFile, port) {
  const html = fs.readFileSync(htmlFile, 'utf-8');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    server.listen(port, (err) => { if (err) reject(err); else resolve(server); });
  });
}

(async () => {
  const htmlFile = '/tmp/keep-track/index.html';
  const port = 7780;
  const server = await serve(htmlFile, port);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
  const page = await context.newPage();

  let shotN = 0;
  const shot = async (name) => {
    shotN++;
    const file = path.join(SHOTDIR, `${String(shotN).padStart(2,'0')}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`[shot] ${file}`);
  };

  const errors = [];
  page.on('pageerror', e => { errors.push('[pageerror] ' + e.message); console.error('[pageerror]', e.message); });
  page.on('console', m => {
    if (m.type() === 'error') console.error('[browser error]', m.text());
  });

  // ── Exact replication of game-flow.spec.js helpers ──────────────────────

  async function dismissPopupIfPresent() {
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

  async function startGame() {
    await dismissPopupIfPresent();
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(400);
    await dismissPopupIfPresent();
    const innerDeadline = Date.now() + 8000;
    while (Date.now() < innerDeadline) {
      const hasButton = await page.locator('#mathai-transition-slot button').isVisible({ timeout: 600 }).catch(() => false);
      if (!hasButton) break;
      await page.locator('#mathai-transition-slot button').first().click();
      await page.waitForTimeout(400);
      await dismissPopupIfPresent();
    }
    // Match exact test: "Confirm game is active (no transition button visible)"
    // test uses: await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible({ timeout: 5000 })
    const stillVisible = await page.locator('#mathai-transition-slot button').isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[startGame] transition slot button still visible: ${stillVisible}`);
  }

  async function clickNextLevel() {
    const visible = await page.locator('#mathai-transition-slot button').isVisible({ timeout: 10000 }).catch(() => false);
    if (!visible) throw new Error('clickNextLevel: no transition button visible');
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(500);
  }

  async function waitForPhase(phase, timeout = 20000) {
    const { expect } = require('@playwright/test');
    await expect(page.locator('#app')).toHaveAttribute('data-phase', phase, { timeout });
  }

  // EXACT __ralph.answer() from test spec
  async function answer(correct) {
    correct = correct !== false;
    // Inspect what __ralph.answer does
    const debugBefore = await page.evaluate((c) => {
      const gs = window.gameState;
      const correctValue = gs?.correctAnswer ?? gs?.answer;
      const round = gs?.content?.rounds?.[gs?.currentRound] || gs?.rounds?.[gs?.currentRound];
      const correctIdx = round?.correctIndex ?? round?.correct ?? 0;
      const idx = c ? correctIdx : (correctIdx === 0 ? 1 : 0);
      const btn = document.querySelector('[data-testid="option-' + idx + '"]')
        || document.querySelector('[data-index="' + idx + '"]')
        || document.querySelector('.option-btn:nth-child(' + (idx + 1) + ')')
        || document.querySelector('[data-testid="cell-' + idx + '"]');
      return {
        correctValue,
        correctIdx,
        idx,
        btnFound: !!btn,
        btnTestId: btn?.getAttribute('data-testid'),
        phase: gs?.phase,
        isActive: gs?.isActive,
        isProcessing: gs?.isProcessing,
        lives: gs?.lives,
        cupsInDOM: document.querySelectorAll('[data-testid^="option-"]').length,
      };
    }, correct);
    console.log(`  [__ralph.answer(${correct}) debug]`, JSON.stringify(debugBefore));

    const result = await page.evaluate((c) => window.__ralph && window.__ralph.answer(c), correct);
    console.log(`  [__ralph.answer returned] ${result}`);

    // Same poll as test: expect.poll(() => !isProcessing, {timeout: 5000}).toBe(true)
    const pollStart = Date.now();
    let processingCleared = false;
    while (Date.now() - pollStart < 6000) {
      const notProcessing = await page.evaluate(() => !window.gameState?.isProcessing);
      if (notProcessing) { processingCleared = true; break; }
      await page.waitForTimeout(100);
    }
    console.log(`  [answer poll] isProcessing cleared: ${processingCleared} (${Date.now() - pollStart}ms)`);
    if (!processingCleared) {
      const stuck = await page.evaluate(() => ({
        isProcessing: window.gameState?.isProcessing,
        phase: window.gameState?.phase,
        isActive: window.gameState?.isActive,
      }));
      console.log(`  [answer poll STUCK] state: ${JSON.stringify(stuck)}`);
    }
    return processingCleared;
  }

  // ── beforeEach (exact replica of test) ──────────────────────────────────
  async function beforeEach() {
    await page.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { get: () => false });
    });
    await page.goto(`http://localhost:${port}`);
    await page.waitForTimeout(500);
    const initErr = await page.evaluate(() => window.__initError).catch(() => null);
    if (initErr) console.log(`[initErr] ${initErr}`);
    // Wait for CDN (matching test's 160s deadline)
    const deadline = Date.now() + 90000; // 90s locally (CDN should be cached after first load)
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
    console.log('[beforeEach] ready');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST: "Game Over on Zero Lives" — EXACT REPLICATION OF test spec
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n══════ EXACT REPLICATION: "Game Over on Zero Lives" ══════');
  try {
    await beforeEach();
    await shot('00-loaded');

    await startGame();
    await shot('01-game-started');

    // ── Round 1 ──────────────────────────────────────────────────────────
    console.log('\n── Round 1 ──');
    await waitForPhase('guess', 15000);
    await shot('02-r1-guess');
    const ans1ok = await answer(false);
    console.log(`  answer() result: ${ans1ok}`);
    await shot('03-r1-after-answer');

    console.log('  Waiting for transition phase (15s)...');
    const t1start = Date.now();
    try {
      await waitForPhase('transition', 15000);
      console.log(`  ✓ transition after ${Date.now() - t1start}ms`);
    } catch(e) {
      const gs = await page.evaluate(() => ({ phase: window.gameState?.phase, dataphase: document.getElementById('app')?.getAttribute('data-phase'), lives: window.gameState?.lives }));
      console.log(`  ✗ FAILED: ${e.message}`);
      console.log(`  current state: ${JSON.stringify(gs)}`);
      await shot('r1-transition-FAIL');
    }
    await shot('04-r1-transition');
    await clickNextLevel();
    console.log('  ✓ Clicked Next Round');

    // ── Round 2 ──────────────────────────────────────────────────────────
    console.log('\n── Round 2 ──');
    await waitForPhase('guess', 15000);
    await shot('05-r2-guess');
    const ans2ok = await answer(false);
    console.log(`  answer() result: ${ans2ok}`);
    await shot('06-r2-after-answer');

    console.log('  Waiting for transition phase (15s)...');
    try {
      await waitForPhase('transition', 15000);
      console.log('  ✓ transition reached');
    } catch(e) {
      console.log(`  ✗ FAILED: ${e.message}`);
      const gs = await page.evaluate(() => ({ phase: window.gameState?.phase, dataphase: document.getElementById('app')?.getAttribute('data-phase') }));
      console.log(`  current: ${JSON.stringify(gs)}`);
    }
    await shot('07-r2-transition');
    await clickNextLevel();

    // ── Round 3 (fatal) ───────────────────────────────────────────────────
    console.log('\n── Round 3 (FATAL) ──');
    await waitForPhase('guess', 15000);
    await shot('08-r3-guess');
    const ans3ok = await answer(false);
    console.log(`  answer() result: ${ans3ok}`);
    await shot('09-r3-after-answer');

    // Wait for gameover phase
    console.log('  Waiting for gameover phase (15s)...');
    const goStart = Date.now();
    try {
      await waitForPhase('gameover', 15000);
      console.log(`  ✓ gameover after ${Date.now() - goStart}ms`);
    } catch(e) {
      const gs = await page.evaluate(() => ({ phase: window.gameState?.phase, dataphase: document.getElementById('app')?.getAttribute('data-phase'), lives: window.gameState?.lives }));
      console.log(`  ✗ FAILED: ${e.message}`);
      console.log(`  current: ${JSON.stringify(gs)}`);
      await shot('gameover-FAIL');
    }
    await shot('10-gameover');

    // Check assertions
    const lives = await page.evaluate(() => window.gameState?.lives);
    console.log(`  lives=${lives} (expected 0)`);

    const transitionTitle = await page.locator('#transitionTitle').textContent({ timeout: 10000 }).catch(() => 'NOT FOUND');
    console.log(`  transitionTitle="${transitionTitle}" (expected "Game Over!")`);

    // Click "See Results"
    const seeResultsVisible = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`  "See Results" button visible: ${seeResultsVisible}`);
    if (seeResultsVisible) {
      await page.locator('#mathai-transition-slot button').first().click();
      console.log('  Clicked "See Results"');
    }

    await page.waitForTimeout(1500);
    await shot('11-final');

    const finalState = await page.evaluate(() => ({
      gameScreenDisplay: document.getElementById('game-screen')?.style.display,
      resultsScreenDisplay: document.getElementById('results-screen')?.style.display,
      dataphase: document.getElementById('app')?.getAttribute('data-phase'),
    }));
    console.log(`  Final state: ${JSON.stringify(finalState)}`);

    const gameScreenHidden = finalState.gameScreenDisplay === 'none';
    const resultsVisible = finalState.resultsScreenDisplay !== 'none';
    console.log(`\n  #game-screen hidden: ${gameScreenHidden} ✓/✗`);
    console.log(`  #results-screen visible: ${resultsVisible} ✓/✗`);

    if (gameScreenHidden && resultsVisible && lives === 0) {
      console.log('\n  ✓ TEST PASSED');
    } else {
      console.log('\n  ✗ TEST FAILED — mismatch');
    }

  } catch(e) {
    await shot('ERROR');
    console.log(`[DIAGNOSTIC ERROR] ${e.message}`);
    console.log(e.stack);
  }

  console.log('\n── Errors ──');
  errors.forEach(e => console.log(e));

  await browser.close();
  server.close();
  console.log('[done]');
})();
