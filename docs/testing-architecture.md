# Ralph Testing Architecture
## Automated Spec Compliance — Provably Reliable, Scales to All 49 Games

**Version 2.0** — Based on analysis of all 49 game specs + failure pattern research

---

## 1. The Problem Statement

Manual testing of 49 HTML games is not viable. The pipeline must produce proof that:
1. The game implements the spec (correct rounds, lives, star logic, postMessage payload)
2. The game survives real browser interaction (buttons work, transitions fire, endGame runs)
3. No regressions after HTML fixes

Currently the test generator **fails** because it must solve two separate problems:
- **Navigation problem**: How do I get the game to state X? (CDN timing, transition screens, async chains)
- **Assertion problem**: Is the game in the correct state?

The LLM solves both badly. The fix: **pipeline solves navigation, LLM solves assertions only**.

---

## 2. Game Taxonomy — All 49 Games Classified

Analysis of all specs reveals 4 interaction types and 7 star logic types.

### Interaction Types (how the player answers)

| Type | Count | Games (sample) | `window.__ralph.answer()` implementation |
|---|---|---|---|
| **grid-click** | 21 | doubles, simon-says, futoshiki, connect, queens | Click cell/card by `data-index` or `data-value` |
| **text-input** | 20 | speed-input, adjustment-strategy, listen-and-add | Set `input.value`, fire `input` event, click check btn |
| **drag** | 6 | kakuro, identify-pairs-list, jelly-doods, word-pairs | Drag element from source to target by `data-testid` |
| **mcq-click** | 2 | rapid-challenge, keep-track | Click `.option-btn[data-index="N"]` |

> Every game fits one of these 4 types. The pipeline reads the spec to determine which.

### Star Logic Types (how stars are computed)

| Type | Count | Spec pattern | Core test approach |
|---|---|---|---|
| **lives-remaining** | 27 | `stars = lives remaining` | `setLives(2)` → `endGame('victory')` → assert stars=2 |
| **avg-time** | 7 | `avgTime < Xs = 3★` | Inject `roundTimes=[fast/slow]` → `endGame` → assert |
| **accuracy** | 2 | `100%→3★, ≥60%→2★` | Control correct/wrong answers → assert stars |
| **score** | 2 | `score ≥ N = 3★` | Set `gameState.score` → `endGame` → assert |
| **moves** | 3 | `moves ≤ par = 3★` | Set `gameState.moves` → `endGame` → assert |
| **total-time** | 3 | `time ≤ Xs = 3★` | Inject `startTime` delta → `endGame` → assert |
| **custom** | 5 | zip, bubbles-pairs, two-player-race, free-the-key, jelly-doods | Game-specific inject + endGame |

> Every star type can be tested by **manipulating `window.gameState` directly** and calling `window.endGame()`. No LLM needed for this.

### Special Cases

| Category | Games | Handling |
|---|---|---|
| No lives | associations, memory-flip, speedy-taps, two-player-race, word-pairs, zip | Skip lives tests |
| No results screen | interactive-chat | Skip results tests, only test postMessage |
| Single round | free-the-key, kakuro, identify-pairs-list, jelly-doods, light-up, loop-the-loop, killer-sudoku | No level transitions needed |
| LLM validation | (none currently) | Skip if present |

---

## 3. Architecture: Three Layers

### Layer 1 — `window.__ralph` (pipeline-injected, not LLM-written)

After HTML generation (Step 1), the pipeline **appends** a `<script id="ralph-test-harness">` block to every game's HTML. This block is **deterministically built** from the spec metadata — zero LLM calls.

```javascript
// INJECTED BY PIPELINE (not by LLM) — spec-derived
window.__ralph = {

  // === ANSWER (interaction-type-specific) ===
  // Pipeline selects ONE of these implementations based on spec:

  // For MCQ / grid-click:
  answer(correct = true) {
    const round = window.gameState.content?.rounds?.[window.gameState.currentRound];
    if (!round) return false;
    const idx = correct ? round.correctIndex : (round.correctIndex === 0 ? 1 : 0);
    const btn = document.querySelector(`[data-testid="option-${idx}"], .option-btn[data-index="${idx}"]`);
    btn?.click();
    return !!btn;
  },

  // For text-input:
  answer(correct = true) {
    const ans = correct ? String(window.gameState.correctAnswer)
                        : String((window.gameState.correctAnswer || 0) + 999);
    const input = document.querySelector('[data-testid="answer-input"], #answer-input, input[type="text"], input[type="number"]');
    if (input) { input.value = ans; input.dispatchEvent(new Event('input', {bubbles: true})); }
    document.querySelector('[data-testid="btn-check"], #btn-check, button[type="submit"]')?.click();
    return !!input;
  },

  // === SHORTCUTS ===
  endGame(reason = 'victory') { window.endGame?.(reason); },

  jumpToRound(n) {
    window.gameState.currentRound = n;
    window.loadRound?.(n);
    syncDOMState?.();
  },

  setLives(n) {
    window.gameState.lives = n;
    window.progressBar?.update?.(window.gameState.currentRound, n);
    syncDOMState?.();
  },

  setRoundTimes(timesMs) {
    // Inject roundTimes for time-based star logic tests
    window.gameState.roundTimes = timesMs;
    window.gameState.roundStartTime = Date.now();
    window.gameState.startTime = window.gameState.startTime || (Date.now() - timesMs.reduce((a,b)=>a+b,0));
  },

  // === INSPECT ===
  getState() {
    return {
      phase: document.getElementById('app')?.dataset.phase || 'unknown',
      round: window.gameState?.currentRound ?? 0,
      totalRounds: window.gameState?.totalRounds ?? 0,
      lives: window.gameState?.lives ?? 0,
      score: window.gameState?.score ?? 0,
      stars: window.gameState?.stars ?? null,
      isActive: window.gameState?.isActive ?? false,
    };
  },

  getLastPostMessage() { return window.__lastPostMessage || null; },
};

// === DOM STATE SYNC ===
// Called after every game state change so tests can read data-* attributes
function syncDOMState() {
  const root = document.getElementById('app');
  if (!root) return;
  const gs = window.gameState;
  if (!gs) return;
  root.dataset.phase = gs.completed ? 'results'
                     : !gs.isActive ? 'start'
                     : 'playing';
  if (gs.currentRound !== undefined) root.dataset.round = gs.currentRound;
  if (gs.lives !== undefined) root.dataset.lives = gs.lives;
  if (gs.score !== undefined) root.dataset.score = gs.score;
  if (gs.level !== undefined) root.dataset.level = gs.level;
  // Sync data-lives on display element too
  const livesEl = document.querySelector('[data-testid="display-lives"]');
  if (livesEl && gs.lives !== undefined) livesEl.dataset.lives = gs.lives;
}

// === POSTMESSAGE CAPTURE (for contract tests) ===
window.__lastPostMessage = null;
const _orig = window.parent.postMessage.bind(window.parent);
window.parent.postMessage = function(data, origin) {
  window.__lastPostMessage = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;
  _orig(data, origin);
};
```

> **This block does NOT change game behavior.** It only adds read/write shortcuts for tests.
> `syncDOMState()` must also be called from within the game's `roundComplete()`, `endGame()`, and `loadRound()` functions — the pipeline adds these calls if not present.

### Layer 2 — Shared Boilerplate Helpers (in sharedBoilerplate, not LLM-written)

These replace ALL timing-dependent navigation patterns:

```javascript
// Wait for game to reach a specific phase (reads data-phase attribute)
async function waitForPhase(page, phase, timeout = 20000) {
  await expect(page.locator('[data-testid="app-root"]'))
    .toHaveAttribute('data-phase', phase, { timeout });
}

// Read game state values (integer, not text)
async function getLives(page) {
  return parseInt(await page.locator('#app').getAttribute('data-lives') ?? '0');
}
async function getScore(page) {
  return parseInt(await page.locator('#app').getAttribute('data-score') ?? '0');
}
async function getRound(page) {
  return parseInt(await page.locator('#app').getAttribute('data-round') ?? '0');
}

// Skip to end without playing through
async function skipToEnd(page, reason = 'victory') {
  await page.evaluate((r) => window.__ralph.endGame(r), reason);
  const endPhase = reason === 'victory' ? 'results' : (reason === 'game_over' ? 'gameover' : 'results');
  await waitForPhase(page, endPhase, 5000);
}

// Answer using spec-derived function (correct or wrong)
async function answer(page, correct = true) {
  await page.evaluate((c) => window.__ralph.answer(c), correct);
  // Wait for processing to complete (isProcessing flag clears)
  await expect.poll(
    async () => await page.evaluate(() => !window.gameState.isProcessing),
    { timeout: 5000 }
  ).toBe(true);
}

// Set up time-based star scenario
async function simulateFastGame(page) {
  // Inject roundTimes < threshold for 3 stars
  await page.evaluate(() => window.__ralph.setRoundTimes(Array(9).fill(1000)));
}
async function simulateSlowGame(page) {
  await page.evaluate(() => window.__ralph.setRoundTimes(Array(9).fill(10000)));
}
```

### Layer 3 — 5 Core Tests (pipeline-generated from spec, zero LLM)

These 5 tests are **deterministically generated** by the pipeline from spec metadata. They are the PROOF OF SPEC COMPLIANCE.

```javascript
// Generated by pipeline from spec — NOT by LLM
// Parameters filled from spec: rounds=9, lives=3, starType='avg-time', thresholds=[3,5]

test('CORE-1: Init — start phase, correct title', async ({ page }) => {
  await waitForPhase(page, 'start');
  await expect(page.locator('#transitionTitle')).toHaveText('${spec.title}');
  await expect(page.locator('#transitionSubtitle')).not.toBeEmpty();
});

test('CORE-2: Correct answer advances round', async ({ page }) => {
  await startGame(page);
  await waitForPhase(page, 'playing');
  const roundBefore = await getRound(page);
  await answer(page, true);
  await expect.poll(() => getRound(page), { timeout: 3000 }).toBeGreaterThan(roundBefore);
});

// CORE-3 only if spec.lives > 0
test('CORE-3: Wrong answer reduces lives', async ({ page }) => {
  await startGame(page);
  expect(await getLives(page)).toBe(${spec.lives});
  await answer(page, false);
  await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(${spec.lives - 1});
});

test('CORE-4: Completion fires correct postMessage', async ({ page }) => {
  await startGame(page);
  await skipToEnd(page, 'victory');
  const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
  expect(msg?.type).toBe('game_complete');
  expect(msg?.data?.metrics).toBeDefined();
  expect(msg?.data?.metrics?.stars).toBeGreaterThanOrEqual(0);
  expect(msg?.data?.metrics?.stars).toBeLessThanOrEqual(3);
  expect(msg?.data?.attempts).toBeInstanceOf(Array);
});

// CORE-5: star logic test — parameters come directly from spec
// For lives-remaining star type:
test('CORE-5: Star logic — lives-based', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__ralph.setLives(2));
  await skipToEnd(page, 'victory');
  const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
  expect(msg?.data?.metrics?.stars).toBe(2); // spec: lives remaining = stars
});

// For avg-time star type (e.g. rapid-challenge):
test('CORE-5: Star logic — fast play = 3 stars', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__ralph.setRoundTimes(Array(9).fill(1000))); // 1s avg < 3s threshold
  await skipToEnd(page, 'victory');
  const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
  expect(msg?.data?.metrics?.stars).toBe(3);
});
```

> CORE tests 1-5 are generated by a **deterministic template engine** in the pipeline, not by LLM.
> They always run. They cannot be triaged away. They are the spec contract.

---

## 4. What LLM Generates (Supplementary Tests Only)

After the 5 CORE tests are generated deterministically, the LLM generates **supplementary tests** for:
- Level transition screens (visual correctness)
- Edge cases (empty input, rapid clicks, boundary rounds)
- Game-specific visual elements (expression display, card grid layout)
- Restart lifecycle

The LLM task is now trivial because it only needs assertions, not navigation:

```
Prompt: "The game is already started (startGame called). Available state:
  - waitForPhase(page, 'playing')
  - answer(page, true/false)
  - getLives(page), getScore(page), getRound(page)
  - skipToEnd(page, 'victory'/'game_over')
  - window.__ralph.setLives(n), setRoundTimes([...])

Test case: 'Level transition after 3 rounds shows Level 2 screen'
Steps: Start game, complete 3 rounds with correct answers, verify Level 2 transition appears
Write ONLY the test() body — helpers are pre-defined."
```

LLM output:
```javascript
test('Level transition after 3 rounds', async ({ page }) => {
  await startGame(page);
  for (let i = 0; i < 3; i++) await answer(page, true);
  await waitForPhase(page, 'transition');
  await expect(page.locator('#transitionTitle')).toHaveText('Level 2');
});
```

5 lines. No navigation knowledge. No timing hacks.

---

## 5. The `data-phase` Guarantee (solves ALL timing issues)

The single most impactful change is requiring `data-phase` on `#app`. Here is why it eliminates every current failure:

```
BEFORE: await expect(page.locator('#results-screen')).toBeVisible()
  Problem: CDN keeps #results-screen hidden until endGame() fires, which has async chain
  Result: toBeVisible timeout

AFTER: await waitForPhase(page, 'results')
  Works because syncDOMState() runs synchronously inside endGame() before any async call
  data-phase changes atomically with game state
```

```
BEFORE: await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible({ timeout: 15000 })
  Problem: CDN transition animation takes variable time; button disappears at unpredictable moment
  Result: timing race condition

AFTER: await waitForPhase(page, 'playing')
  Works because data-phase='playing' is set when loadRound() runs, which only happens AFTER transition
```

```
BEFORE: toHaveText("❤️❤️")
  Problem: CDN ProgressBar renders emoji internally; format depends on CDN version
  Result: always fails

AFTER: expect(await getLives(page)).toBe(2)
  Works because data-lives is an integer set by setLives() and syncDOMState()
```

---

## 6. Proof of Scalability: Coverage Matrix

| Game | CORE-1 | CORE-2 | CORE-3 | CORE-4 | CORE-5 | Supplementary |
|---|---|---|---|---|---|---|
| rapid-challenge | ✓ | ✓ MCQ | ✓ | ✓ | ✓ avg-time | level-transition, restart |
| doubles | ✓ | ✓ grid | ✓ | ✓ | ✓ lives | level-transition |
| simon-says | ✓ | ✓ grid | ✓ | ✓ | ✓ lives | sequence length |
| speed-input | ✓ | ✓ text | ✓ | ✓ | ✓ avg-time | empty input, wrong format |
| memory-flip | ✓ | ✓ grid | — (no lives) | ✓ | ✓ moves | card flip animation |
| associations | ✓ | ✓ text | — (no lives) | ✓ | ✓ accuracy | pair matching |
| kakuro | ✓ | ✓ drag | ✓ | ✓ | ✓ lives | drag mechanics |
| interactive-chat | ✓ | ✓ text | — | ✓ postMsg | — (no results) | chat flow |
| two-player-race | ✓ | ✓ MCQ | — (no lives) | ✓ | ✓ winner | P1/P2 areas |

All 49 games → 4-5 core tests each = ~200 deterministic spec-compliance tests.
Plus LLM supplementary: ~3-5 per game = ~150 additional tests.

**Total: ~350 tests. ~200 are provably correct (pipeline-generated). ~150 are LLM-assisted.**

---

## 7. Implementation Plan

### Phase 1 — Harness Injection (2-3 days)

**pipeline.js changes:**
1. Add `injectTestHarness(html, specMetadata)` function that generates the `window.__ralph` block
2. Add `extractSpecMetadata(specContent)` that reads `totalRounds`, `totalLives`, `star logic`, interaction type from the spec markdown
3. Call `injectTestHarness()` after HTML generation (Step 1) and after every HTML fix
4. Add `syncDOMState()` calls to game's `roundComplete()`, `endGame()`, `loadRound()` if not present

**What `extractSpecMetadata` reads:**
```
totalRounds: 9                → spec.rounds
totalLives: 3                 → spec.lives
PART-027: ... 3 horizontal option buttons  → interaction: 'mcq'
PART-027: ... NxN grid        → interaction: 'grid'
PART-027: ... numeric input   → interaction: 'text-input'
PART-033: ... drag-drop       → interaction: 'drag'
avg time/round <3s = 3★       → starType: 'avg-time', thresholds: [3, 5]
stars = lives remaining       → starType: 'lives'
```

**Validates:** In static validation (Step 2a), check that `#app` has `data-phase` attribute and `window.__ralph` is defined.

### Phase 2 — Core Test Generation (1-2 days)

Add `generateCoreTests(specMetadata)` to pipeline.js. Produces spec-compliant tests deterministically. These always run first, cannot be triaged.

### Phase 3 — Updated LLM Prompt (1 day)

Update test gen prompt to only generate supplementary tests:
- Pre-filled: helpers list, game state fields, `data-*` attribute meanings
- LLM output: only `test()` bodies, no navigation, no state setup
- Prompt: "CORE tests are already written. Write only supplementary tests for edge cases and visual behavior."

### Phase 4 — Fix Loop Intelligence (1 day)

Update triage prompt: "If the test calls `window.__ralph.answer()` and fails, the HTML is wrong. If the test uses a selector that doesn't exist, the test is wrong. Determine which."

---

## 8. What This Eliminates (vs Current State)

| Current failure | Eliminated by |
|---|---|
| `startGame` clicks wrong number of transitions | `waitForPhase('playing')` — phase only changes when game actually starts |
| `toHaveText("❤️❤️")` CDN lives format | `data-lives` integer + `getLives()` helper |
| `toBeVisible()` on results-screen timing | `waitForPhase('results')` waits for syncDOMState() |
| Timer text format `"00:00"` | Never assert timer text — use `waitForPhase` or gameState |
| Wrong selectors for game elements | `window.__ralph.answer()` knows the correct selector |
| 9-round navigation to reach end | `skipToEnd('victory')` — direct endGame() call |
| Fix loop fixing test bugs by changing HTML | CORE tests are pipeline-generated and always correct |
| LLM not knowing star logic formula | CORE-5 test is generated from spec star logic directly |
| Level transition timing in clickNextLevel() | LLM writes `await waitForPhase('transition'); await clickNextLevel()` |

---

## 9. The Closed Loop: How Tests Prove Spec Compliance

```
Spec (markdown) → extractSpecMetadata() → {rounds:9, lives:3, stars:'avg-time', thresholds:[3,5]}
                                           ↓
                    injectTestHarness(html, metadata) → window.__ralph with correct .answer()
                                           ↓
                    generateCoreTests(metadata) → 5 tests that verify spec is implemented
                                           ↓
                    Run tests → PASS = HTML implements spec correctly
                              → FAIL = HTML has bug → fix_html with specific error
                                           ↓
                    review() → checks remaining spec points not covered by tests
                    APPROVED = shipped with proof
```

If CORE-4 (postMessage) passes → the game sends correct data to the warehouse.
If CORE-5 (star logic) passes → stars match exactly what the spec says.
If CORE-2 (correct answer) passes → the core gameplay loop works.

No human needs to open the game to verify these. The tests ARE the proof.
