'use strict';
const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHOTDIR = '/tmp/keep-track/shots';
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
  const port = 7779;
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
    if (m.type() === 'error') { errors.push('[console.error] ' + m.text()); console.error('[browser error]', m.text()); }
    if (m.text().startsWith('GAME_METRICS:') || m.text().includes('phase') || m.text().includes('lives')) {
      console.log('[browser log]', m.text().substring(0, 200));
    }
  });

  // ── Helper: wait for phase on #app ──────────────────────────────────────
  async function waitForPhase(phase, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const val = await page.locator('#app').getAttribute('data-phase').catch(() => null);
      if (val === phase) return val;
      await page.waitForTimeout(200);
    }
    const current = await page.locator('#app').getAttribute('data-phase').catch(() => 'unknown');
    throw new Error(`waitForPhase('${phase}') timed out after ${timeoutMs}ms — current: ${current}`);
  }

  // ── Helper: click wrong cup ──────────────────────────────────────────────
  async function clickWrongCup() {
    const gs = await page.evaluate(() => ({
      correctCup: window.gameState?.correctCup,
      phase: window.gameState?.phase,
      isActive: window.gameState?.isActive,
      isProcessing: window.gameState?.isProcessing,
      lives: window.gameState?.lives,
      cupCount: window.gameState?.cupCount,
      currentRound: window.gameState?.currentRound,
    }));
    console.log(`  [state before click] phase=${gs.phase} isActive=${gs.isActive} isProcessing=${gs.isProcessing} lives=${gs.lives} correctCup=${gs.correctCup} cupCount=${gs.cupCount}`);

    if (gs.phase !== 'guess') {
      console.log(`  WARNING: phase is ${gs.phase}, not guess — cup click will be ignored`);
    }

    // Click a WRONG cup (not correctCup)
    const wrongIdx = gs.correctCup === 0 ? 1 : 0;
    console.log(`  Clicking cup index ${wrongIdx} (wrong, correct is ${gs.correctCup})`);
    const cups = await page.locator('[data-testid^="option-"]').all();
    console.log(`  Total cups rendered: ${cups.length}`);
    if (wrongIdx >= cups.length) {
      console.log(`  ERROR: wrongIdx ${wrongIdx} >= cups.length ${cups.length}`);
      return false;
    }
    await cups[wrongIdx].click();
    return true;
  }

  // ── Helper: answer via __ralph harness ──────────────────────────────────
  async function answerViaHarness(correct) {
    const result = await page.evaluate((c) => window.__ralph && window.__ralph.answer(c), correct);
    console.log(`  [harness.answer(${correct})] returned: ${result}`);
    return result;
  }

  // ── Helper: wait for isProcessing=false ─────────────────────────────────
  async function waitForProcessingDone(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const processing = await page.evaluate(() => window.gameState?.isProcessing);
      if (!processing) return true;
      await page.waitForTimeout(100);
    }
    return false;
  }

  // ── beforeEach: load page, wait for CDN, dismiss audio popup ────────────
  async function beforeEach() {
    await page.goto(`http://localhost:${port}`);
    console.log('[beforeEach] page loaded, waiting for CDN...');
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const okayBtn = page.locator('button:has-text("Okay!")');
      if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log('[beforeEach] dismissing audio popup');
        await okayBtn.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) { console.log(`[beforeEach] ready after ${((Date.now() - (deadline - 90000)) / 1000).toFixed(1)}s`); break; }
      await page.waitForTimeout(500);
    }
    const visible = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) throw new Error('beforeEach FAILED: transition slot button never appeared');
  }

  // ── startGame: click through all initial transition screens ─────────────
  async function startGame() {
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(400);
    // Dismiss audio popup if it appeared
    const okayBtn = page.locator('button:has-text("Okay!")');
    if (await okayBtn.isVisible({ timeout: 500 }).catch(() => false)) { await okayBtn.click(); await page.waitForTimeout(300); }
    // Click any remaining transition buttons
    const innerDeadline = Date.now() + 8000;
    while (Date.now() < innerDeadline) {
      const hasButton = await page.locator('#mathai-transition-slot button').isVisible({ timeout: 600 }).catch(() => false);
      if (!hasButton) break;
      await page.locator('#mathai-transition-slot button').first().click();
      await page.waitForTimeout(400);
    }
    // Wait for transition slot to clear (game active)
    const slotGone = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 5000 }).catch(() => true);
    if (!slotGone) console.log('[startGame] WARNING: transition slot button still visible after 5s');
    const phase = await page.locator('#app').getAttribute('data-phase').catch(() => 'unknown');
    console.log(`[startGame] done. phase=${phase}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVESTIGATION: Game Over on Zero Lives
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n══════ INVESTIGATION: Game Over on Zero Lives ══════');
  try {
    await beforeEach();
    await shot('01-loaded');

    await startGame();
    await shot('02-game-started');

    // ── Check initial state ──────────────────────────────────────────────
    const initState = await page.evaluate(() => ({
      phase: window.gameState?.phase,
      lives: window.gameState?.lives,
      currentRound: window.gameState?.currentRound,
      totalRounds: window.gameState?.totalRounds,
      correctCup: window.gameState?.correctCup,
      isActive: window.gameState?.isActive,
      hasHarness: !!window.__ralph,
    }));
    console.log('[initial state]', JSON.stringify(initState));

    // ── Round 1: wrong answer ────────────────────────────────────────────
    console.log('\n── Round 1: wrong answer ──');
    console.log('Waiting for guess phase...');
    await waitForPhase('guess', 30000);
    await shot('03-round1-guess');

    // Test method 1: Direct cup click
    const clicked1 = await clickWrongCup();
    if (!clicked1) throw new Error('Could not click wrong cup in round 1');

    const t1start = Date.now();
    const proc1done = await waitForProcessingDone(8000);
    console.log(`  isProcessing cleared: ${proc1done} (${Date.now() - t1start}ms)`);

    const state1 = await page.evaluate(() => ({
      phase: window.gameState?.phase,
      lives: window.gameState?.lives,
      isProcessing: window.gameState?.isProcessing,
    }));
    console.log(`  After click: ${JSON.stringify(state1)}`);
    await shot('04-round1-after-wrong');

    // Now wait for transition phase (game needs delay(2000) then nextRound())
    console.log('  Waiting for transition phase (up to 15s)...');
    const tPhaseStart = Date.now();
    try {
      await waitForPhase('transition', 15000);
      console.log(`  transition phase reached after ${Date.now() - tPhaseStart}ms`);
    } catch(e) {
      const curPhase = await page.evaluate(() => window.gameState?.phase);
      console.log(`  FAILED to reach transition: ${e.message}`);
      console.log(`  Current gameState.phase: ${curPhase}`);
      await shot('04b-transition-timeout');
    }
    await shot('05-round1-transition');

    // Click "Next Round" button
    const hasBtn1 = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Transition button visible: ${hasBtn1}`);
    if (hasBtn1) {
      await page.locator('#mathai-transition-slot button').first().click();
      console.log('  Clicked Next Round');
    }
    await page.waitForTimeout(500);

    // ── Round 2: wrong answer ────────────────────────────────────────────
    console.log('\n── Round 2: wrong answer ──');
    await waitForPhase('guess', 15000);
    await shot('06-round2-guess');

    const clicked2 = await clickWrongCup();
    if (!clicked2) throw new Error('Could not click wrong cup in round 2');

    const proc2done = await waitForProcessingDone(8000);
    console.log(`  isProcessing cleared: ${proc2done}`);

    const state2 = await page.evaluate(() => ({
      phase: window.gameState?.phase,
      lives: window.gameState?.lives,
      isProcessing: window.gameState?.isProcessing,
    }));
    console.log(`  After click: ${JSON.stringify(state2)}`);
    await shot('07-round2-after-wrong');

    console.log('  Waiting for transition phase (up to 15s)...');
    try {
      await waitForPhase('transition', 15000);
      console.log('  transition phase reached');
    } catch(e) {
      const curPhase = await page.evaluate(() => window.gameState?.phase);
      console.log(`  FAILED: ${e.message}, gameState.phase=${curPhase}`);
    }
    await shot('08-round2-transition');

    const hasBtn2 = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasBtn2) {
      await page.locator('#mathai-transition-slot button').first().click();
      console.log('  Clicked Next Round');
    }
    await page.waitForTimeout(500);

    // ── Round 3: fatal wrong answer ──────────────────────────────────────
    console.log('\n── Round 3: FATAL wrong answer (lives should hit 0) ──');
    await waitForPhase('guess', 15000);
    await shot('09-round3-guess');

    const stateBeforeFatal = await page.evaluate(() => ({
      lives: window.gameState?.lives,
      phase: window.gameState?.phase,
      correctCup: window.gameState?.correctCup,
      gameEnded: window.gameState?.gameEnded,
    }));
    console.log(`  State before fatal click: ${JSON.stringify(stateBeforeFatal)}`);

    const clicked3 = await clickWrongCup();
    if (!clicked3) throw new Error('Could not click wrong cup in round 3');

    // Track processing state in real time
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const snap = await page.evaluate(() => ({
        phase: window.gameState?.phase,
        lives: window.gameState?.lives,
        isProcessing: window.gameState?.isProcessing,
        isActive: window.gameState?.isActive,
        gameEnded: window.gameState?.gameEnded,
        dataphase: document.getElementById('app')?.getAttribute('data-phase'),
      }));
      console.log(`  t+${((i+1)*200)}ms: gameState.phase=${snap.phase} dataphase=${snap.dataphase} lives=${snap.lives} processing=${snap.isProcessing}`);
      if (snap.phase === 'gameover' || snap.dataphase === 'gameover') {
        console.log(`  ** gameover reached at t+${((i+1)*200)}ms **`);
        break;
      }
    }

    await shot('10-round3-after-fatal');
    const stateAfterFatal = await page.evaluate(() => ({
      phase: window.gameState?.phase,
      dataphase: document.getElementById('app')?.getAttribute('data-phase'),
      lives: window.gameState?.lives,
      isProcessing: window.gameState?.isProcessing,
      gameEnded: window.gameState?.gameEnded,
    }));
    console.log(`  State after fatal: ${JSON.stringify(stateAfterFatal)}`);

    // Wait for gameover phase
    console.log('  Waiting for gameover phase (up to 15s)...');
    const goStart = Date.now();
    try {
      await waitForPhase('gameover', 15000);
      console.log(`  gameover phase reached after ${Date.now() - goStart}ms`);
    } catch(e) {
      const curPhase = await page.evaluate(() => ({
        gameStatephase: window.gameState?.phase,
        dataphase: document.getElementById('app')?.getAttribute('data-phase'),
        lives: window.gameState?.lives,
      }));
      console.log(`  FAILED to reach gameover: ${e.message}`);
      console.log(`  Current state: ${JSON.stringify(curPhase)}`);
      await shot('10b-gameover-timeout');
    }

    await shot('11-gameover-screen');
    const gameoverState = await page.evaluate(() => ({
      lives: window.gameState?.lives,
      dataphase: document.getElementById('app')?.getAttribute('data-phase'),
      transitionSlotVisible: !!document.querySelector('#mathai-transition-slot button'),
      transitionTitle: document.getElementById('transitionTitle')?.textContent,
    }));
    console.log(`  Gameover state: ${JSON.stringify(gameoverState)}`);

    // Check lives=0
    if (gameoverState.lives !== 0) {
      console.log(`  WARNING: lives=${gameoverState.lives}, expected 0`);
    }

    // Check "Game Over!" title
    if (gameoverState.transitionTitle !== 'Game Over!') {
      console.log(`  WARNING: transitionTitle="${gameoverState.transitionTitle}", expected "Game Over!"`);
    }

    // Click "See Results"
    const hasResultsBtn = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`  "See Results" button visible: ${hasResultsBtn}`);
    if (hasResultsBtn) {
      await page.locator('#mathai-transition-slot button').first().click();
      console.log('  Clicked "See Results"');
    }
    await page.waitForTimeout(2000);

    await shot('12-after-see-results');
    const finalState = await page.evaluate(() => ({
      gameScreenVisible: document.getElementById('game-screen')?.style.display,
      resultsScreenVisible: document.getElementById('results-screen')?.style.display,
      dataphase: document.getElementById('app')?.getAttribute('data-phase'),
      isActive: window.gameState?.isActive,
      gameEnded: window.gameState?.gameEnded,
    }));
    console.log(`  Final state: ${JSON.stringify(finalState)}`);

    const gameScreenHidden = finalState.gameScreenVisible === 'none';
    const resultsVisible = finalState.resultsScreenVisible !== 'none';
    console.log(`\n  #game-screen hidden: ${gameScreenHidden} (display="${finalState.gameScreenVisible}")`);
    console.log(`  #results-screen visible: ${resultsVisible} (display="${finalState.resultsScreenVisible}")`);
    console.log(`  isActive: ${finalState.isActive}`);

    if (gameScreenHidden && resultsVisible) {
      console.log('\n  ✓ GAME OVER FLOW: PASS');
    } else {
      console.log('\n  ✗ GAME OVER FLOW: FAIL — results screen not shown');
    }

  } catch(e) {
    await shot('ERROR');
    console.log(`[DIAGNOSTIC ERROR] ${e.message}`);
    console.log(e.stack);
  }

  console.log('\n── Errors captured ──');
  errors.forEach(e => console.log(e));

  await browser.close();
  server.close();
  console.log('\n[done]');
})();
