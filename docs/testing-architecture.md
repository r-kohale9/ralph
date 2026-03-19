# Ralph Testing Architecture

**Goal:** Test generation should be trivially easy. The LLM writes assertions, not navigation. Tests that require understanding CDN timing, emoji formats, or async chains should not exist.

---

## The Core Problem (Current State)

The test LLM is doing too much work:

```
LLM must figure out:            What actually happens:
─────────────────────────────   ─────────────────────────────
"How do I start the game?"   →  click Start → CDN loads → audio popup → click Level 1 → 45-70s
"How many rounds to play?"   →  read spec, count, handle transitions every 3 rounds
"How do I check lives?"      →  toHaveText("❤️❤️") — but CDN renders internally
"How do I trigger end?"      →  play all 9 rounds including level transitions
"Did the timer reset?"       →  check text "00:00" but format is CDN-specific
"Is the game over?"          →  check if #results-screen is visible (not always correct)
```

Every one of these is a failure point. The LLM guesses, gets it wrong, and 3 fix iterations burn tokens.

---

## The Solution: Two-Layer Testing Contract

### Layer 1 — DOM State Attributes (LLM reads DOM, not JS)

Every game HTML must maintain `data-*` attributes that mirror game state. Tests read attributes, not visual text or internal state:

```html
<!-- Root element — reflects current game phase -->
<div id="app"
     data-testid="app-root"
     data-phase="start"          <!-- start | playing | transition | results | gameover -->
     data-round="0"              <!-- current round integer (0-indexed) -->
     data-level="1"              <!-- current level integer -->
     data-lives="3"              <!-- lives remaining integer -->
     data-score="0">             <!-- current score integer -->

<!-- Lives display (CDN ProgressBar manages visual, game manages data attr) -->
<span data-testid="display-lives" data-lives="3">❤️❤️❤️</span>

<!-- Score/progress display -->
<span data-testid="display-score" data-score="0" data-total="9">0/9</span>

<!-- Current round question -->
<div data-testid="expression-display" id="expression-display">10 - 7 = ?</div>

<!-- Answer options — always use data-index and data-value -->
<button data-testid="option-0" data-index="0" data-value="3" class="option-btn">3</button>
<button data-testid="option-1" data-index="1" data-value="7" class="option-btn">7</button>
<button data-testid="option-2" data-index="2" data-value="4" class="option-btn">4</button>
```

**How it works:** After every state change (roundComplete, endGame, loadRound), the game calls `syncDOMState()`:

```javascript
function syncDOMState() {
  const root = document.getElementById('app');
  if (!root) return;
  root.dataset.phase = gameState.completed ? 'results' :
                       !gameState.isActive ? 'start' : 'playing';
  root.dataset.round = gameState.currentRound;
  root.dataset.level = gameState.level || 1;
  root.dataset.lives = gameState.lives;
  root.dataset.score = gameState.score;
}
```

### Layer 2 — `window.__ralph` Test Interface (LLM calls shortcuts)

Every game HTML must expose:

```javascript
window.__ralph = {
  // Skip to results without playing all rounds
  endGame: (reason = 'victory') => window.endGame(reason),

  // Jump to a specific round (skips transitions)
  jumpToRound: (n) => {
    gameState.currentRound = n;
    gameState.isActive = true;
    loadRound(n);
    syncDOMState();
  },

  // Set lives directly (no animation)
  setLives: (n) => {
    gameState.lives = n;
    if (progressBar) progressBar.update(gameState.currentRound, n);
    syncDOMState();
  },

  // Get the last postMessage sent
  getLastPostMessage: () => window.__lastPostMessage || null,

  // Get normalized game state
  getState: () => ({
    phase: document.getElementById('app')?.dataset.phase,
    round: gameState.currentRound,
    totalRounds: gameState.totalRounds,
    lives: gameState.lives,
    score: gameState.score,
    level: gameState.level || 1,
    isActive: gameState.isActive,
  }),
};

// Capture postMessages for tests
window.__lastPostMessage = null;
const _origPostMessage = window.parent.postMessage.bind(window.parent);
window.parent.postMessage = (data, origin) => {
  window.__lastPostMessage = data;
  _origPostMessage(data, origin);
};
```

---

## New Test Generation Contract

### What the boilerplate provides (pre-written, not LLM-generated):

```javascript
// ─── Game phase helpers ────────────────────────────────────────────────
async function waitForPhase(page, phase, timeout = 15000) {
  await expect(page.locator('[data-testid="app-root"]'))
    .toHaveAttribute('data-phase', phase, { timeout });
}

async function getLives(page) {
  return parseInt(await page.locator('[data-lives]').first().getAttribute('data-lives'));
}

async function getScore(page) {
  return parseInt(await page.locator('[data-score]').first().getAttribute('data-score'));
}

async function getRound(page) {
  return parseInt(await page.locator('[data-testid="app-root"]').getAttribute('data-round'));
}

async function skipToEnd(page, reason = 'victory') {
  await page.evaluate((r) => window.__ralph.endGame(r), reason);
  await waitForPhase(page, reason === 'victory' ? 'results' : 'gameover');
}

async function jumpToRound(page, n) {
  await page.evaluate((n) => window.__ralph.jumpToRound(n), n);
}

async function clickCorrectOption(page) {
  // Click the option marked correct by data-correct="true" or by correctIndex from gameState
  const correctIndex = await page.evaluate(() => {
    const round = window.gameState.content?.rounds?.[window.gameState.currentRound];
    return round?.correctIndex ?? 0;
  });
  await page.locator(`[data-testid="option-${correctIndex}"]`).click();
}

async function clickWrongOption(page) {
  const correctIndex = await page.evaluate(() => {
    const round = window.gameState.content?.rounds?.[window.gameState.currentRound];
    return round?.correctIndex ?? 0;
  });
  // Click the first option that is NOT correct
  const wrongIndex = correctIndex === 0 ? 1 : 0;
  await page.locator(`[data-testid="option-${wrongIndex}"]`).click();
}
```

### What the LLM generates (assertions only):

```javascript
test.describe('game-flow', () => {

  test('Start Screen to Gameplay', async ({ page }) => {
    // Phase should start as 'start'
    await waitForPhase(page, 'start');
    // Title should show game name
    await expect(page.locator('#transitionTitle')).toHaveText('Rapid Challenge');
    // startGame handles all initial screens
    await startGame(page);
    // Now in playing phase
    await waitForPhase(page, 'playing');
    // Round starts at 0
    expect(await getRound(page)).toBe(0);
  });

  test('Victory gives 3 stars for fast play', async ({ page }) => {
    await startGame(page);
    // Set roundStartTime to simulate fast rounds (1s each)
    await page.evaluate(() => {
      window.gameState.roundStartTime = Date.now() - 1000;
      for (let i = 0; i < 9; i++) {
        window.gameState.roundTimes = [...(window.gameState.roundTimes || []), 1000];
      }
    });
    // Skip to end
    await skipToEnd(page, 'victory');
    // Results screen visible
    await expect(page.getByTestId('screen-results')).toBeVisible();
    // Stars displayed (check data attribute, not emoji text)
    const stars = await page.evaluate(() => window.gameState.stars || 0);
    expect(stars).toBe(3);
  });

  test('Game Over from losing all lives', async ({ page }) => {
    await startGame(page);
    // Set lives to 1 then trigger endGame
    await page.evaluate(() => window.__ralph.setLives(1));
    expect(await getLives(page)).toBe(1);
    await skipToEnd(page, 'game_over');
    await waitForPhase(page, 'gameover');
  });

});

test.describe('mechanics', () => {

  test('Correct answer advances round', async ({ page }) => {
    await startGame(page);
    const roundBefore = await getRound(page);
    await clickCorrectOption(page);
    // Wait for round to advance (600ms setTimeout in game)
    await expect(page.locator('[data-testid="app-root"]'))
      .toHaveAttribute('data-round', String(roundBefore + 1), { timeout: 3000 });
    expect(await getScore(page)).toBe(1);
  });

  test('Wrong answer reduces lives', async ({ page }) => {
    await startGame(page);
    expect(await getLives(page)).toBe(3);
    await clickWrongOption(page);
    // Lives decreased
    await expect(page.locator('[data-lives]').first())
      .toHaveAttribute('data-lives', '2', { timeout: 3000 });
    expect(await getLives(page)).toBe(2);
  });

});
```

---

## What Changes in the Pipeline

### Step 0 (new): Inject test harness into HTML after generation

After the HTML is generated (Step 1), the pipeline injects the `window.__ralph` interface and `syncDOMState()` as a `<script>` block. The LLM does NOT write this — the pipeline does, based on the spec's game state fields.

```javascript
// pipeline.js — after HTML generation, before validation
function injectTestHarness(html, spec) {
  const harness = buildHarness(spec); // reads gameState fields from spec
  return html.replace('</body>', `<script id="ralph-test-harness">\n${harness}\n</script>\n</body>`);
}
```

The harness injector reads the spec's game state fields and generates `syncDOMState()` appropriately. This is deterministic — no LLM needed.

### Step 2a: Add `data-testid` + `data-*` validation to validate-static.js

Validate that the generated HTML has:
- `data-testid="app-root"` on the root element
- `data-phase`, `data-lives`, `data-round`, `data-score` attributes
- `data-testid="option-N"` on interactive answer elements

### Step 2b: Test generation prompt is now trivially simple

```
Available helpers (pre-written, DO NOT redefine):
  waitForPhase(page, phase)    — waits for data-phase attribute
  getLives(page)               — reads data-lives integer
  getScore(page)               — reads data-score integer
  getRound(page)               — reads data-round integer
  skipToEnd(page, reason)      — calls window.__ralph.endGame() + waits for phase
  clickCorrectOption(page)     — clicks option with correct index from gameState.content
  clickWrongOption(page)       — clicks any wrong option
  startGame(page)              — already defined (clicks all initial transitions)

Game phases: 'start' | 'playing' | 'transition' | 'results' | 'gameover'

Your test only needs to:
1. Call startGame(page)
2. Optionally use skipToEnd/jumpToRound to reach a specific state
3. Assert the state you care about using getLives(), getScore(), etc.
```

The LLM task is reduced from "write 50 lines of navigation + timing logic" to "write 5 lines of assertions."

---

## Comparison: Before vs After

| Failure mode | Before | After |
|---|---|---|
| Navigation timing | `startGame` clicked 1-2 buttons non-deterministically | `waitForPhase('playing')` — pure attribute check |
| Lives display | `toHaveText("❤️❤️")` — CDN renders emoji opaquely | `data-lives="2"` integer attribute |
| Trigger end game | Play all 9 rounds with level transitions | `window.__ralph.endGame('victory')` |
| Timer text format | `toHaveText("00:00")` — CDN format-specific | `waitForPhase('playing')` — timer irrelevant |
| Star rating | Visual text check | `page.evaluate(() => window.gameState.stars)` |
| Round progression | Navigation + click 9 options | `jumpToRound(8)` + assert round=8 |
| isActive guard | Unknown, LLM guesses | `waitForPhase('playing')` checks isActive via DOM |
| Level transitions | clickNextLevel() timing issues | `waitForPhase('playing')` after each option click |

---

## Implementation Plan

### Phase 1 — High value, low effort (1-2 days)

1. **Add `syncDOMState()` to HTML generation prompt** — add it as a required rule in the spec template (ANTI-PATTERNS section). Every generated game must call it after state changes.

2. **Add `window.__ralph` stub to pipeline injection** — post-processing step in pipeline.js, deterministically built from the spec's gameState fields.

3. **Add `waitForPhase`, `getLives`, `getScore`, `clickCorrectOption`, `clickWrongOption` to sharedBoilerplate** — remove timing-dependent navigation patterns.

4. **Update test gen prompt** — "Use waitForPhase() instead of checking element visibility. Use getLives() instead of toHaveText on lives. Use skipToEnd() to trigger endGame."

### Phase 2 — Medium effort (2-3 days)

5. **Add `data-testid` and `data-*` attributes to CDN spec templates** — PART-027 (Play Area) must add `data-testid="option-N" data-index="N"` to all interactive elements.

6. **Add static validation** for `data-testid="app-root"` with `data-phase` attribute.

7. **Update global learnings** to reflect new patterns.

### Phase 3 — Stretch goals

8. **`page.exposeFunction` postMessage capture** in sharedBoilerplate for contract tests.

9. **Visual regression snapshots** for results screen (Playwright screenshot + comparison).

10. **`window.__cdnReady` flag** to replace timing-based CDN wait in beforeEach.

---

## Key Principle

> **The game is responsible for being testable. The test is responsible for asserting behavior.**

If a test needs to know how the CDN ProgressBar renders lives, that is a game-side responsibility. The game exposes `data-lives="2"` and the test reads it. The LLM never sees emoji.

If a test needs to reach the results screen, it calls `skipToEnd()`. The LLM never writes round-navigation loops.

The test LLM's only job: "Given this game state, what should be true?"
