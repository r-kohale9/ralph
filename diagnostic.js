'use strict';
const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal test harness (mimics what pipeline injects)
const HARNESS = `
<script id="ralph-test-harness">
(function() {
  window.__postMessageLog = [];
  const _orig = window.postMessage.bind(window);
  window.postMessage = function(data, origin, transfer) {
    if (data && typeof data === 'object') window.__postMessageLog.push(data);
    return _orig(data, origin, transfer);
  };
  window.__ralph = {
    answer: async function(correct) {
      const gs = window.gameState;
      if (!gs || !gs.correctAnswer) return;
      const val = correct ? gs.correctAnswer : gs.options ? gs.options.find(o => o !== gs.correctAnswer) : gs.correctAnswer + 1;
      const btn = document.querySelector('.option-btn[data-value="' + val + '"]');
      if (btn) btn.click();
      return new Promise(r => setTimeout(r, 600));
    },
    getState: function() { return window.gameState; },
    endGame: function() { if (window.endGame) window.endGame(); }
  };
  function syncDOMState() {
    const app = document.getElementById('app');
    if (!app || !window.gameState) return;
    app.dataset.phase = window.gameState.phase;
    app.dataset.lives = window.gameState.lives;
    app.dataset.round = window.gameState.currentRound;
    app.dataset.score = window.gameState.score;
  }
  setInterval(syncDOMState, 300);
  window.__syncDOMState = syncDOMState;
  // Send game_init with fallback content
  setTimeout(function() {
    window.postMessage({ type: 'game_init', content: window.gameState?.content || null }, '*');
  }, 500);
})();
</script>
`;

async function serve(htmlContent, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(htmlContent);
    });
    server.listen(port, () => resolve(server));
  });
}

(async () => {
  // Inject harness before </body>
  let html = fs.readFileSync('/tmp/count-and-tap-debug/index.html', 'utf-8');
  html = html.replace('</body>', HARNESS + '</body>');
  
  const server = await serve(html, 7778);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
  const page = await context.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console error] ' + m.text()); });

  const SHOTDIR = '/tmp/count-and-tap-debug';
  let shotN = 0;
  const shot = async (name) => {
    shotN++;
    const file = path.join(SHOTDIR, `${String(shotN).padStart(2,'0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`📸 ${file}`);
  };

  // ─── beforeEach simulation ───────────────────────────────────────────
  const beforeEach = async () => {
    await page.goto('http://localhost:7778');
    
    // Wait up to 50s for transition slot
    const deadline = Date.now() + 50000;
    while (Date.now() < deadline) {
      const popup = page.locator('button:has-text("Okay!")');
      if (await popup.isVisible({ timeout: 300 }).catch(() => false)) {
        await popup.click();
        await page.waitForTimeout(300);
      }
      const slotReady = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 300 }).catch(() => false);
      if (slotReady) break;
      await page.waitForTimeout(500);
    }
    const elapsed = (50000 - (deadline - Date.now())) / 1000;
    console.log(`  beforeEach: transition slot ready after ${elapsed.toFixed(1)}s`);
    
    // Final assertion (this is where test fails if not visible)
    const visible = await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) throw new Error('beforeEach FAILED: #mathai-transition-slot button not visible after 5s');
    
    // Click to start game
    await page.locator('#mathai-transition-slot button').first().click();
    await page.waitForTimeout(600);
    const popup2 = page.locator('button:has-text("Okay!")');
    if (await popup2.isVisible({ timeout: 500 }).catch(() => false)) await popup2.click();
    if (await page.locator('#mathai-transition-slot button').first().isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.locator('#mathai-transition-slot button').first().click();
    }
    await page.waitForTimeout(1000);
  };

  // ─── Test 1: Start Screen to Game Transition ─────────────────────────
  console.log('\n=== TEST 1: Start Screen to Game Transition ===');
  try {
    await beforeEach();
    await shot('test1-after-beforeeach');
    
    const phase = await page.locator('#app').getAttribute('data-phase');
    const lives = await page.locator('#app').getAttribute('data-lives');
    console.log(`  data-phase=${phase}, data-lives=${lives}`);
    
    const gameContentVisible = await page.locator('#gameContent').isVisible().catch(() => false);
    console.log(`  #gameContent visible: ${gameContentVisible}`);
    
    // Check option buttons exist
    const optionBtns = await page.locator('.option-btn').count();
    console.log(`  .option-btn count: ${optionBtns}`);
    
    await shot('test1-game-screen');
    console.log('TEST 1: PASS');
  } catch (e) {
    await shot('test1-FAILED');
    console.log(`TEST 1 FAILED: ${e.message}`);
  }

  // ─── Test 2: Game Over on Zero Lives ─────────────────────────────────
  console.log('\n=== TEST 2: Game Over on Zero Lives ===');
  try {
    await beforeEach();
    await shot('test2-after-beforeeach');
    
    // Wait for option buttons to be visible
    await page.locator('.option-btn').first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('  Option buttons visible');
    await shot('test2-options-visible');
    
    // Check initial lives
    let lives = parseInt(await page.locator('#app').getAttribute('data-lives') || '3');
    console.log(`  Initial lives: ${lives}`);
    
    // Wrong answer 3 times to lose all lives
    for (let i = 0; i < 3; i++) {
      console.log(`  Answering wrong (attempt ${i+1})...`);
      const gs = await page.evaluate(() => ({ 
        correctAnswer: window.gameState?.correctAnswer,
        options: window.gameState?.options,
        phase: window.gameState?.phase,
        isProcessing: window.gameState?.isProcessing,
        isActive: window.gameState?.isActive
      }));
      console.log(`    gameState: ${JSON.stringify(gs)}`);
      
      // Find a wrong option button
      const allBtns = await page.locator('.option-btn').all();
      let clicked = false;
      for (const btn of allBtns) {
        const val = await btn.getAttribute('data-value');
        if (val && parseInt(val) !== gs.correctAnswer) {
          await btn.click();
          console.log(`    Clicked wrong answer: ${val}`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        console.log('    Could not find wrong option button!');
        await shot(`test2-no-btn-attempt-${i+1}`);
        
        // Log what buttons exist
        const allBtnTexts = await page.locator('button:visible').allTextContents();
        console.log('    Visible buttons:', allBtnTexts);
        break;
      }
      
      await page.waitForTimeout(2000); // wait for feedback + next round
      await shot(`test2-after-wrong-${i+1}`);
      
      lives = parseInt(await page.locator('#app').getAttribute('data-lives') || '?');
      const phase = await page.locator('#app').getAttribute('data-phase');
      console.log(`    After attempt ${i+1}: lives=${lives}, phase=${phase}`);
      
      if (phase === 'gameover') break;
      
      // Wait for next round's options
      await page.locator('.option-btn').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    }
    
    await shot('test2-final-state');
    const finalPhase = await page.locator('#app').getAttribute('data-phase');
    const finalLives = parseInt(await page.locator('#app').getAttribute('data-lives') || '-1');
    console.log(`  Final: phase=${finalPhase}, lives=${finalLives}`);
    
    if (finalPhase === 'gameover' && finalLives === 0) {
      console.log('TEST 2: PASS');
    } else {
      console.log(`TEST 2 FAILED: expected gameover+0lives, got ${finalPhase}+${finalLives}`);
    }
  } catch (e) {
    await shot('test2-FAILED');
    console.log(`TEST 2 FAILED: ${e.message}`);
  }

  console.log('\n=== JS Errors ===');
  errors.forEach(e => console.log(e));

  await browser.close();
  server.close();
})();
