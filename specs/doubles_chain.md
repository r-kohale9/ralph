# Doubles Chain — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Doubles Chain
- **Game ID:** doubles_chain
- **Type:** standard
- **Description:** Puzzle game where students find a hidden chain of doubles in a 3x3 number grid. Players select numbers in ascending order where each is exactly double the previous. Chains grow longer across 5 rounds (3 to 5 numbers), 3 lives total, count-up timer. Stars = lives remaining.

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                 |
| -------- | ----------------------------- | --------------- | ---------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                            |
| PART-002 | Package Scripts               | YES             | —                                                                            |
| PART-003 | waitForPackages               | YES             | —                                                                            |
| PART-004 | Initialization Block          | YES             | —                                                                            |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                          |
| PART-006 | TimerComponent                | YES             | timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false       |
| PART-007 | Game State Object             | YES             | Custom fields: lives, totalLives, chainIndex, currentChain, selectedCells    |
| PART-008 | PostMessage Protocol          | YES             | —                                                                            |
| PART-009 | Attempt Tracking              | YES             | —                                                                            |
| PART-010 | Event Tracking                | YES             | Custom events: cell_selected, chain_complete, life_lost, round_complete      |
| PART-011 | End Game & Metrics            | YES             | Stars = lives remaining (lives-based, not accuracy-based)                    |
| PART-012 | Debug Functions               | YES             | —                                                                            |
| PART-013 | Validation Fixed              | NO              | —                                                                            |
| PART-014 | Validation Function           | YES             | Rule: clicked value must equal currentChain[chainIndex]                      |
| PART-015 | Validation LLM                | NO              | —                                                                            |
| PART-016 | StoriesComponent              | NO              | —                                                                            |
| PART-017 | Feedback Integration          | YES             | Audio feedback for correct/incorrect taps and completion                      |
| PART-018 | Case Converter                | NO              | —                                                                            |
| PART-019 | Results Screen UI             | YES             | Custom metrics: Rounds completed, Lives remaining                            |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                            |
| PART-021 | Screen Layout CSS             | YES             | CSS only (HTML auto-injected by PART-025)                                    |
| PART-022 | Game Buttons                  | YES             | No Submit/Retry — direct cell tap validation. Reset + Next used.             |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 5, totalLives: 3                                                |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over, level                                    |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                               |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating                                  |
| PART-027 | Play Area Construction        | YES             | Layout: 3x3 grid                                                            |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with chain + grid + distractors                          |
| PART-029 | Story-Only Game               | NO              | —                                                                            |
| PART-030 | Sentry Error Tracking         | YES             | Error monitoring for every game                                              |
| PART-031 | API Helper                    | NO              | —                                                                            |
| PART-032 | AnalyticsManager              | NO              | —                                                                            |
| PART-033 | Interaction Patterns          | YES             | Patterns: grid (3x3 clickable cells)                                         |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                     |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                       |
| PART-038 | Interaction Manager           | YES             | selector: '.game-play-area', disableOnAudioFeedback: true                    |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 5,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null
  },

  // GAME-SPECIFIC:
  lives: 3,              // Current remaining lives (starts at 3)
  totalLives: 3,         // Total lives at game start (for metrics)
  chainIndex: 0,         // Current position in the chain the player must select next
  currentChain: [],      // The ordered chain of doubles for the current round (e.g., [2, 4, 8])
  selectedCells: [],     // Array of {row, col, value} objects for cells selected this round
  gridData: [],          // 2D array [3][3] of numbers displayed in the grid
  chainLength: 3,        // Length of the chain for the current round (grows from 3 to 5)
  isProcessing: false,   // Prevents double-clicks during audio feedback
  gameId: 'doubles_chain',
  contentSetId: null
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
```

---

## 4. Input Schema

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chain": {
            "type": "array",
            "items": { "type": "number" },
            "description": "Ordered chain of doubles in ascending order (e.g., [3, 6, 12])"
          },
          "grid": {
            "type": "array",
            "items": {
              "type": "array",
              "items": { "type": "number" }
            },
            "description": "3x3 grid of numbers. Contains all chain numbers plus distractors."
          }
        },
        "required": ["chain", "grid"]
      }
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    {
      chain: [2, 4, 8],
      grid: [
        [5, 2, 9],
        [4, 7, 3],
        [1, 8, 6]
      ]
    },
    {
      chain: [3, 6, 12],
      grid: [
        [12, 8, 3],
        [5, 6, 11],
        [7, 10, 15]
      ]
    },
    {
      chain: [5, 10, 20, 40],
      grid: [
        [40, 5, 15],
        [25, 10, 7],
        [20, 30, 9]
      ]
    },
    {
      chain: [1, 2, 4, 8],
      grid: [
        [8, 3, 1],
        [6, 4, 9],
        [5, 2, 7]
      ]
    },
    {
      chain: [4, 8, 16, 32, 64],
      grid: [
        [16, 4, 50],
        [32, 10, 8],
        [64, 24, 48]
      ]
    }
  ]
};
```

### Content Set Generation Guidance

Generate **3 content sets** at different difficulty levels. All sets must have exactly 5 rounds. Structure: rounds 1–2 = chain of 3, rounds 3–4 = chain of 4, round 5 = chain of 5.

| Dimension | Easy | Medium | Hard |
|---|---|---|---|
| Starting numbers (rounds 1–2) | 1–5 | 3–15 | 8–25 |
| Starting numbers (rounds 3–4) | 1–8 | 5–20 | 10–40 |
| Starting number (round 5) | 1–5 | 3–12 | 6–20 |
| Max value in chain | 64 | 320 | 1280 |

**Constraints all content sets must satisfy:**
- Each `chain` is an ascending sequence where `chain[i+1] === chain[i] * 2`
- Grid is always 3×3 (9 cells total)
- Grid must contain every number in the chain exactly once
- Remaining grid cells are distractors — positive integers, no duplicates within the grid, and no distractor may equal any chain value
- Distractors should be plausible (similar magnitude to chain values) to avoid being trivially eliminated
- No duplicate numbers within a single grid (all 9 values unique)
- Chain numbers must not appear in positional order (left-to-right, top-to-bottom) — they should be scattered across the grid
- Each content set should use different starting numbers (not just reorder the same chains)

**Distractor quality rules:**
- At least 2 distractors per grid should be within ±50% of a chain value (near-misses)
- No distractor should be exactly double or half of any chain value (would create a false chain)
- Distractors must be positive integers ≥ 1

---

## 5. Screens & HTML Structure

### Screen 1: Game Content (inside `#gameContent` via ScreenLayout)

The body contains only `#app` (for ScreenLayout) and a `<template>` (cloned into `#gameContent` after inject). The results screen is also inside the template.

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Round Info -->
    <div class="round-info" id="round-info">
      <h2 id="round-title" data-signal-id="round-title">Round 1</h2>
      <p id="instruction-text" data-signal-id="instruction-text">Find the chain of doubles! Tap numbers in order: each is double the last.</p>
      <p id="chain-progress" data-signal-id="chain-progress" class="chain-progress"></p>
    </div>

    <!-- Timer Container -->
    <div id="timer-container"></div>

    <!-- Grid Play Area -->
    <div class="game-play-area" data-signal-id="play-area">
      <div class="game-grid" id="game-grid" style="--cols: 3;">
        <!-- 3x3 grid cells generated by JavaScript -->
      </div>
    </div>

    <!-- Feedback Area -->
    <div class="feedback-section hidden" id="feedback-area">
      <p id="feedback-text" data-signal-id="feedback-text"></p>
    </div>

    <!-- Buttons -->
    <div class="btn-container">
      <button class="game-btn btn-secondary" id="btn-reset" onclick="resetRound()">Reset</button>
      <button class="game-btn btn-primary hidden" id="btn-next" onclick="handleNext()">Next</button>
    </div>
  </div>

  <!-- Results Screen -->
  <div id="results-screen" style="display:none;">
    <div class="results-container">
      <h2 id="results-title">Game Complete!</h2>
      <div id="stars-display" class="stars-display"></div>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Score</span>
          <span id="result-score" class="metric-value">0%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Time</span>
          <span id="result-time" class="metric-value">0s</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Correct</span>
          <span id="result-correct" class="metric-value">0/0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Rounds</span>
          <span id="result-rounds" class="metric-value">0/5</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Lives Remaining</span>
          <span id="result-lives" class="metric-value">0</span>
        </div>
      </div>
      <button onclick="location.reload()">Play Again</button>
    </div>
  </div>
</template>
```

---

## 6. CSS

```css
:root {
  --mathai-game-max-width: 480px;
  --mathai-stack-gap: 10px;
}

html, body {
  height: 100%;
  margin: 0;
  background: #f6f6f6;
  font-family: var(--mathai-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
}

.page-center {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100dvh;
  box-sizing: border-box;
}

.game-wrapper {
  width: 100vw;
  max-width: var(--mathai-game-max-width);
  box-sizing: border-box;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 100dvh;
  padding-top: 54px;
  position: relative;
}

.game-stack {
  display: flex;
  flex-direction: column;
  gap: var(--mathai-stack-gap);
  padding: 0 10px 20px 10px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

.game-block {
  padding: var(--mathai-stack-gap);
  margin-bottom: var(--mathai-stack-gap);
  background: transparent;
  border-radius: 8px;
  box-sizing: border-box;
}

.content-fill {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - 54px);
  box-sizing: border-box;
}

#mathai-progress-slot,
.mathai-progress-slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

@media (min-width: 520px) {
  .game-wrapper { width: 100%; }
}

/* Round Info */
.round-info {
  text-align: center;
  padding: 10px;
}

.round-info h2 {
  font-size: var(--mathai-font-size-large, 24px);
  color: var(--mathai-primary, #270f36);
  margin: 0 0 8px 0;
}

.round-info p {
  font-size: var(--mathai-font-size-body, 16px);
  color: var(--mathai-gray, #666666);
  margin: 4px 0;
}

.chain-progress {
  font-size: var(--mathai-font-size-subtitle, 18px);
  font-weight: 600;
  color: var(--mathai-purple, #9B51E0);
  min-height: 28px;
}

.chain-found-number {
  color: var(--mathai-green, #219653);
  font-weight: 700;
}

.chain-unknown {
  color: var(--mathai-gray, #666666);
}

/* Grid */
.game-play-area {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 8px;
  max-width: 320px;
  width: 100%;
  margin: 0 auto;
}

.grid-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--mathai-border-gray, #e0e0e0);
  border-radius: var(--mathai-border-radius-card, 12px);
  cursor: pointer;
  font-size: var(--mathai-font-size-title, 32px);
  font-weight: 700;
  background: #fff;
  transition: all 0.2s ease;
  user-select: none;
  overflow: hidden;
  color: var(--mathai-text-primary, #4a4a4a);
}

.grid-cell:hover {
  background: #f0f0f0;
}

.grid-cell.selected {
  border-color: var(--mathai-blue, #667eea);
  background: #EBF0FF;
  color: var(--mathai-blue, #667eea);
}

.grid-cell.correct {
  border-color: var(--mathai-cell-border-green, #27ae60);
  background: var(--mathai-cell-bg-green, #D9F8D9);
  color: var(--mathai-green, #219653);
}

.grid-cell.incorrect {
  border-color: var(--mathai-cell-border-red, #e74c3c);
  background: var(--mathai-cell-bg-red, #FFD9D9);
  color: var(--mathai-red, #E35757);
}

.grid-cell.disabled {
  pointer-events: none;
  opacity: 0.5;
}

.grid-cell.chain-found {
  border-color: var(--mathai-cell-border-green, #27ae60);
  background: var(--mathai-cell-bg-green, #D9F8D9);
  color: var(--mathai-green, #219653);
  pointer-events: none;
}

/* Feedback */
.feedback-section {
  text-align: center;
  padding: 8px;
  min-height: 30px;
}

.feedback-section p {
  font-size: var(--mathai-font-size-body, 16px);
  font-weight: 600;
  margin: 0;
}

.feedback-correct {
  color: var(--mathai-green, #219653);
}

.feedback-incorrect {
  color: var(--mathai-red, #E35757);
}

/* Buttons */
.btn-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: var(--mathai-padding-small, 10px);
  flex-wrap: wrap;
}

.game-btn {
  padding: 14px 32px;
  font-size: var(--mathai-font-size-button, 16px);
  font-weight: 600;
  font-family: var(--mathai-font-family, system-ui);
  border: none;
  border-radius: var(--mathai-border-radius-button, 10px);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-white, #ffffff);
}

.game-btn:active {
  transform: translateY(0);
}

.game-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--mathai-green, #219653);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

.btn-secondary {
  background: var(--mathai-blue, #667eea);
}
.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.hidden { display: none !important; }

/* Results Screen */
.results-container {
  text-align: center;
  padding: 40px 20px;
}

.results-container h2 {
  font-size: var(--mathai-font-size-title, 32px);
  color: var(--mathai-primary, #270f36);
  margin-bottom: 16px;
}

.stars-display {
  font-size: 48px;
  margin: 16px 0;
}

.results-metrics {
  margin: 24px 0;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--mathai-border-gray, #e0e0e0);
}

.metric-label {
  color: var(--mathai-gray, #666666);
  font-size: var(--mathai-font-size-body, 16px);
}

.metric-value {
  font-weight: 700;
  color: var(--mathai-primary, #270f36);
  font-size: var(--mathai-font-size-body, 16px);
}
```

---

## 7. Script Loading (copy these EXACT tags -- never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: Sentry SDK v10.23.0 -->
<script
  src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js"
  crossorigin="anonymous"
></script>

<!-- STEP 3: Game packages (exact URLs, in this order) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - `waitForPackages()` -- checks FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector
   - `FeedbackManager.init()`
   - SignalCollector created and assigned to `window.signalCollector`
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `#game-template` into `#gameContent`
   - ProgressBarComponent created (totalRounds: 5, totalLives: 3)
   - TransitionScreenComponent created
   - TimerComponent created (type: 'increase', startTime: 0, endTime: 100000, autoStart: false)
   - InteractionManager created (selector: '.game-play-area') and assigned to `window.interactionManager`
   - Audio preloaded: correct_tap, wrong_tap
   - VisibilityTracker created with onInactive/onResume
   - Register postMessage listener: `window.addEventListener('message', handlePostMessage)`
   - Send `game_ready` postMessage to parent
   - Sentry initialized (if SentryConfig.enabled)
   - Show start transition screen: "Doubles Chain" / "Find the hidden chain of doubles!" / "I'm ready!" button

2. **Start screen** -> User clicks "I'm ready!"
   - `setupGame()` runs:
     - Load content from `gameState.content` or `fallbackContent`
     - Reset all game state: currentRound=0, score=0, lives=3, attempts=[], events=[], chainIndex=0, selectedCells=[]
     - Set `gameState.startTime = Date.now()`
     - Set `gameState.isActive = true`
     - Set `gameState.duration_data.startTime = new Date().toISOString()`
     - Start timer: `timer.start()`
     - `trackEvent('game_start', 'game')`
     - Update progressBar: `progressBar.update(0, 3)`
     - Call `renderRound()`

3. **renderRound()** -- renders the current round:
   - Get round data from `gameState.content.rounds[gameState.currentRound]`
   - Set `currentChain`, `gridData`, `chainLength`, reset `chainIndex=0`, `selectedCells=[]`
   - Update round title ("Round X"), instruction text ("Find the chain of N doubles!")
   - Update chain progress display (shows "? -> ? -> ?")
   - Create 3x3 grid cells via `createGrid(3, 3, gridData)` -- each cell has `data-row`, `data-col`, `data-value`, `data-signal-id` and a click listener calling `handleCellClick(row, col)`
   - Record `signalCollector.recordViewEvent('content_render', ...)` with round info
   - Show game screen, hide feedback, show Reset button, hide Next button

4. **User interaction loop -- handleCellClick(row, col):**
   - Guard: if `!gameState.isActive` or `gameState.isProcessing`, return
   - Guard: if cell already `chain-found` or `disabled`, return
   - Set `isProcessing = true`
   - Get value from `cell.dataset.value`, convert to Number
   - Expected value is `currentChain[chainIndex]`
   - Record attempt via `recordAttempt(...)` with `validationType: 'function'`
   - Track `cell_selected` event
   - **If correct (value === expected):**
     - Mark cell `chain-found` (green, unclickable)
     - Add to `selectedCells`, increment `chainIndex`
     - Update chain progress display
     - Record `signalCollector.recordViewEvent('visual_update', ...)`
     - Play `correct_tap` audio with sticker
     - **If chainIndex >= currentChain.length (entire chain found):**
       - Show feedback "Chain complete! Well done!"
       - Track `chain_complete` event
       - Increment `gameState.score`
       - Disable all grid cells
       - Show Next button, hide Reset button
   - **If incorrect (value !== expected):**
     - Flash cell `incorrect` class for 500ms then remove
     - Decrement `gameState.lives`
     - Update progressBar: `progressBar.update(currentRound, lives)`
     - Play `wrong_tap` audio with sticker
     - Track `life_lost` event
     - Show feedback "Wrong! X lives left"
     - Record `signalCollector.recordViewEvent('feedback_display', ...)`
     - **If lives <= 0:** call `endGame()` and return
   - Set `isProcessing = false`

5. **handleNext() -- advance to next round:**
   - Increment `gameState.currentRound`
   - Update progressBar: `progressBar.update(currentRound, lives)`
   - **If currentRound >= totalRounds:** call `endGame()`
   - **Else:**
     - Show level transition screen ("Round X+1!" / "Chain of N doubles") with `duration: 2000` (auto-hide, no buttons)
     - After 2100ms: show game screen and call `renderRound()`

6. **End condition(s) -- EVERY path that calls endGame():**
   - **Trigger 1:** All 5 rounds completed -> `handleNext()` calls `endGame()` when `currentRound >= totalRounds`
   - **Trigger 2:** All lives lost -> `handleCellClick()` calls `endGame()` when `lives <= 0`
   - `endGame()` calculates metrics (lives-based stars), shows victory/game-over TransitionScreen, sends postMessage, cleans up
   - **There is NO dead-end game state.** Every wrong answer decrements lives toward endGame. Every correct chain completion leads to handleNext toward endGame.

---

## 9. Functions

### Global Scope (RULE-001)

**waitForPackages()**

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();
  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: FeedbackManager');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: TimerComponent');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: VisibilityTracker');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof SignalCollector === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: SignalCollector');
      await new Promise(r => setTimeout(r, 50));
    }
    console.log('All packages loaded');
  } catch (error) {
    console.error('Package loading failed:', error);
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Failed to load. Please refresh.</div>';
    throw error;
  }
}
```

**setupGame()**

```javascript
function setupGame() {
  if (!gameState.content) {
    gameState.content = fallbackContent;
  }

  // Reset all state
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.totalLives = 3;
  gameState.chainIndex = 0;
  gameState.selectedCells = [];
  gameState.currentChain = [];
  gameState.gridData = [];
  gameState.isProcessing = false;
  gameState.attempts = [];
  gameState.events = [];
  gameState.duration_data.startTime = new Date().toISOString();

  if (timer) timer.start();

  trackEvent('game_start', 'game');

  if (progressBar) progressBar.update(0, gameState.lives);

  renderRound();
}
```

**renderRound()**

```javascript
function renderRound() {
  const roundData = gameState.content.rounds[gameState.currentRound];
  gameState.currentChain = roundData.chain;
  gameState.gridData = roundData.grid;
  gameState.chainLength = roundData.chain.length;
  gameState.chainIndex = 0;
  gameState.selectedCells = [];
  gameState.isProcessing = false;

  // Update UI
  document.getElementById('round-title').textContent = 'Round ' + (gameState.currentRound + 1);
  document.getElementById('instruction-text').textContent =
    'Find the chain of ' + gameState.chainLength + ' doubles! Tap numbers in order: each is double the last.';
  updateChainProgress();

  // Build grid
  createGrid(3, 3, gameState.gridData);

  // Show game screen elements
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('feedback-area').classList.add('hidden');
  document.getElementById('btn-reset').classList.remove('hidden');
  document.getElementById('btn-next').classList.add('hidden');

  // Signal
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        round: gameState.currentRound + 1,
        chain_length: gameState.chainLength,
        grid: gameState.gridData,
        trigger: 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: gameState.currentRound, total: gameState.totalRounds }
      }
    });
  }
}
```

**createGrid(rows, cols, data)**

```javascript
function createGrid(rows, cols, data) {
  const grid = document.getElementById('game-grid');
  grid.style.setProperty('--cols', cols);
  grid.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.dataset.value = data[r][c];
      cell.setAttribute('data-signal-id', 'cell-' + r + '-' + c);
      cell.textContent = data[r][c];
      cell.addEventListener('click', function() { handleCellClick(r, c); });
      grid.appendChild(cell);
    }
  }
}
```

**handleCellClick(row, col)** -- async, RULE-002

```javascript
async function handleCellClick(row, col) {
  if (!gameState.isActive || gameState.isProcessing) return;

  const cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
  if (!cell || cell.classList.contains('chain-found') || cell.classList.contains('disabled')) return;

  gameState.isProcessing = true;

  const value = Number(cell.dataset.value);
  const expected = gameState.currentChain[gameState.chainIndex];
  const isCorrect = (value === expected);

  // Record attempt
  recordAttempt({
    userAnswer: value,
    correct: isCorrect,
    question: 'chain[' + gameState.chainIndex + '] = ' + expected,
    correctAnswer: expected,
    validationType: 'function'
  });

  trackEvent('cell_selected', 'grid', { row: row, col: col, value: value, correct: isCorrect, expectedValue: expected });

  if (isCorrect) {
    cell.classList.add('chain-found');
    gameState.selectedCells.push({ row: row, col: col, value: value });
    gameState.chainIndex++;

    updateChainProgress();

    if (signalCollector) {
      signalCollector.recordViewEvent('visual_update', {
        screen: 'gameplay',
        content_snapshot: {
          type: 'cell_selected_correct',
          cell: { row: row, col: col },
          value: value,
          chain_index: gameState.chainIndex,
          chain_length: gameState.chainLength
        }
      });
    }

    try {
      await FeedbackManager.sound.play('correct_tap', {
        subtitle: 'Correct!',
        sticker: {
          image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif',
          duration: 1,
          type: 'IMAGE_GIF'
        }
      });
    } catch (e) {
      console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2));
    }

    // Check if entire chain found
    if (gameState.chainIndex >= gameState.currentChain.length) {
      showFeedback('Chain complete! Well done!', true);
      trackEvent('chain_complete', 'game', { round: gameState.currentRound + 1, chain: gameState.currentChain });
      gameState.score++;

      // Disable grid
      document.querySelectorAll('.grid-cell').forEach(function(c) { c.classList.add('disabled'); });
      document.getElementById('btn-next').classList.remove('hidden');
      document.getElementById('btn-reset').classList.add('hidden');

      if (signalCollector) {
        signalCollector.recordViewEvent('feedback_display', {
          screen: 'gameplay',
          content_snapshot: { feedback_type: 'chain_complete', message: 'Chain complete!' }
        });
      }
    }
  } else {
    // Incorrect
    cell.classList.add('incorrect');
    setTimeout(function() { cell.classList.remove('incorrect'); }, 500);

    gameState.lives--;
    if (progressBar) progressBar.update(gameState.currentRound, gameState.lives);

    trackEvent('life_lost', 'game', { livesRemaining: gameState.lives });

    showFeedback('Wrong! ' + gameState.lives + ' ' + (gameState.lives === 1 ? 'life' : 'lives') + ' left.', false);

    if (signalCollector) {
      signalCollector.recordViewEvent('feedback_display', {
        screen: 'gameplay',
        content_snapshot: {
          feedback_type: 'incorrect',
          message: 'Wrong!',
          lives_remaining: gameState.lives
        }
      });
    }

    try {
      await FeedbackManager.sound.play('wrong_tap', {
        subtitle: 'Not quite!',
        sticker: {
          image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif',
          duration: 1,
          type: 'IMAGE_GIF'
        }
      });
    } catch (e) {
      console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2));
    }

    if (gameState.lives <= 0) {
      gameState.isProcessing = false;
      endGame();
      return;
    }
  }

  gameState.isProcessing = false;
}
```

**updateChainProgress()**

```javascript
function updateChainProgress() {
  const el = document.getElementById('chain-progress');
  if (!el) return;
  const parts = [];
  for (let i = 0; i < gameState.currentChain.length; i++) {
    if (i < gameState.chainIndex) {
      parts.push('<span class="chain-found-number">' + gameState.currentChain[i] + '</span>');
    } else {
      parts.push('<span class="chain-unknown">?</span>');
    }
  }
  el.innerHTML = parts.join(' \u2192 ');
}
```

**showFeedback(message, isCorrect)**

```javascript
function showFeedback(message, isCorrect) {
  const area = document.getElementById('feedback-area');
  const text = document.getElementById('feedback-text');
  area.classList.remove('hidden');
  text.textContent = message;
  text.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
}
```

**resetRound()**

```javascript
function resetRound() {
  gameState.chainIndex = 0;
  gameState.selectedCells = [];
  gameState.isProcessing = false;

  // Reset grid visual state
  document.querySelectorAll('.grid-cell').forEach(function(cell) {
    cell.classList.remove('selected', 'correct', 'incorrect', 'chain-found', 'disabled');
  });

  updateChainProgress();
  document.getElementById('feedback-area').classList.add('hidden');

  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: { type: 'round_reset', round: gameState.currentRound + 1 }
    });
  }

  trackEvent('round_reset', 'game', { round: gameState.currentRound + 1 });
}
```

**handleNext()**

```javascript
function handleNext() {
  gameState.currentRound++;
  if (progressBar) progressBar.update(gameState.currentRound, gameState.lives);

  if (gameState.currentRound >= gameState.totalRounds) {
    endGame();
  } else {
    // Show level transition (duration only, no buttons -- auto-hides)
    if (transitionScreen) {
      document.getElementById('game-screen').style.display = 'none';
      transitionScreen.show({
        icons: ['\uD83D\uDD17'],
        iconSize: 'normal',
        title: 'Round ' + (gameState.currentRound + 1) + '!',
        subtitle: 'Chain of ' + gameState.content.rounds[gameState.currentRound].chain.length + ' doubles',
        titleStyles: { color: '#270F63', fontSize: '36px' },
        duration: 2000
      });

      if (signalCollector) {
        signalCollector.recordViewEvent('overlay_toggle', {
          screen: 'transition',
          content_snapshot: {
            overlay: 'transition_screen',
            visible: true,
            title: 'Round ' + (gameState.currentRound + 1)
          }
        });
      }

      setTimeout(function() {
        document.getElementById('game-screen').style.display = 'block';
        renderRound();
      }, 2100);
    } else {
      renderRound();
    }
  }
}
```

**validateAnswer(userAnswer, validationFn)** -- from PART-014

```javascript
function validateAnswer(userAnswer, validationFn) {
  try {
    return validationFn(userAnswer);
  } catch (error) {
    console.error('Validation error:', JSON.stringify({ error: error.message }, null, 2));
    return false;
  }
}
```

**computeTriesPerRound(attempts)** -- helper for metrics

```javascript
function computeTriesPerRound(attempts) {
  var rounds = {};
  attempts.forEach(function(a) {
    var r = a.metadata.round;
    rounds[r] = (rounds[r] || 0) + 1;
  });
  return Object.keys(rounds).map(function(r) {
    return { round: Number(r), triesCount: rounds[r] };
  });
}
```

**endGame()**

```javascript
function endGame() {
  if (!gameState.isActive) return;
  gameState.isActive = false;
  gameState.duration_data.currentTime = new Date().toISOString();

  const correct = gameState.attempts.filter(function(a) { return a.correct; }).length;
  const total = gameState.attempts.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeTaken = timer ? timer.getTimeTaken() : Math.round((Date.now() - gameState.startTime) / 1000);

  // Lives-based stars (NOT accuracy-based)
  const stars = gameState.lives >= 3 ? 3 : gameState.lives >= 2 ? 2 : gameState.lives >= 1 ? 1 : 0;

  const metrics = {
    accuracy: accuracy,
    time: timeTaken,
    stars: stars,
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: gameState.totalLives,
    tries: computeTriesPerRound(gameState.attempts)
  };

  console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
  console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

  trackEvent('game_end', 'game', { metrics: metrics });

  // Seal SignalCollector -- fires sendBeacon to flush all events to GCS
  if (signalCollector) signalCollector.seal();

  // Show transition screen for victory or game over
  const won = gameState.currentRound >= gameState.totalRounds;

  if (transitionScreen) {
    document.getElementById('game-screen').style.display = 'none';

    if (won) {
      transitionScreen.show({
        stars: stars,
        title: 'Victory!',
        subtitle: 'You found all the chains!',
        buttons: [{ text: 'Claim Stars', type: 'primary', action: function() { showResults(metrics); } }]
      });
    } else {
      transitionScreen.show({
        icons: ['\uD83D\uDE14'],
        iconSize: 'large',
        title: 'Game Over!',
        subtitle: 'All lives lost!',
        buttons: [{ text: 'See Results', type: 'primary', action: function() { showResults(metrics); } }]
      });
    }
  } else {
    showResults(metrics);
  }

  // Send to platform (PART-008)
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: metrics,
      attempts: gameState.attempts,
      completedAt: Date.now()
    }
  }, '*');

  // Cleanup (RULE-005)
  if (timer) { timer.destroy(); timer = null; }
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  if (progressBar) { progressBar.destroy(); progressBar = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

**showResults(metrics)** -- from PART-019

```javascript
function showResults(metrics) {
  document.getElementById('result-score').textContent = metrics.accuracy + '%';
  document.getElementById('result-time').textContent = metrics.time + 's';
  document.getElementById('result-correct').textContent =
    gameState.attempts.filter(function(a) { return a.correct; }).length + '/' + gameState.attempts.length;
  document.getElementById('result-rounds').textContent = gameState.score + '/' + gameState.totalRounds;
  document.getElementById('result-lives').textContent = gameState.lives;
  document.getElementById('stars-display').textContent =
    '\u2B50'.repeat(metrics.stars) + '\u2606'.repeat(3 - metrics.stars);
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'block';

  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'results',
      metadata: { transition_from: 'gameplay' }
    });
  }
}
```

**handlePostMessage(event)** -- from PART-008

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};

  if (d.gameId) gameState.gameId = d.gameId;

  // Configure SignalCollector with harness-provided metadata
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }

  setupGame();
}
```

**recordAttempt(data)** -- from PART-009

```javascript
function recordAttempt(data) {
  const attempt = {
    attempt_timestamp: new Date().toISOString(),
    time_since_start_of_game: (Date.now() - gameState.startTime) / 1000,
    input_of_user: data.userAnswer,
    attempt_number: gameState.attempts.length + 1,
    correct: data.correct,
    metadata: {
      round: gameState.currentRound,
      question: data.question,
      correctAnswer: data.correctAnswer,
      validationType: data.validationType || 'function'
    }
  };

  gameState.attempts.push(attempt);
  gameState.duration_data.attempts.push({
    startTime: new Date().toISOString(),
    time_to_first_attempt: (Date.now() - gameState.startTime) / 1000,
    duration: 0
  });

  console.log('Attempt:', JSON.stringify(attempt, null, 2));
}
```

**trackEvent(type, target, data)** -- from PART-010

```javascript
function trackEvent(type, target, data) {
  gameState.events.push({
    type: type,
    target: target,
    timestamp: Date.now(),
    ...(data || {})
  });
}
```

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // SignalCollector (PART-010)
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || "session_" + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      gameId: gameState.gameId,
      contentSetId: gameState.contentSetId
    });
    window.signalCollector = signalCollector;

    // ScreenLayout (PART-025)
    const layout = ScreenLayout.inject('app', {
      slots: { progressBar: true, transitionScreen: true }
    });

    // Clone game template into gameContent
    const gameContent = document.getElementById('gameContent');
    const template = document.getElementById('game-template');
    gameContent.appendChild(template.content.cloneNode(true));

    // ProgressBar (PART-023)
    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: 5,
      totalLives: 3,
      slotId: 'mathai-progress-slot'
    });

    // TransitionScreen (PART-024)
    transitionScreen = new TransitionScreenComponent({ autoInject: true });

    // Timer -- count-up, no time limit (PART-006)
    timer = new TimerComponent('timer-container', {
      timerType: 'increase',
      format: 'min',
      startTime: 0,
      endTime: 100000,
      autoStart: false,
      onEnd: function(timeTaken) { endGame(); }
    });

    // InteractionManager (PART-038)
    const interactionManager = new InteractionManager({
      selector: '.game-play-area',
      disableOnAudioFeedback: true,
      disableOnEvaluation: true
    });
    window.interactionManager = interactionManager;

    // Audio preload (PART-017)
    try {
      await FeedbackManager.sound.preload([
        { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
        { id: 'wrong_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
      ]);
    } catch(e) {
      console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2));
    }

    // VisibilityTracker (PART-005)
    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        const inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        if (timer) timer.pause({ fromVisibilityTracker: true });
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
        trackEvent('game_paused', 'system');
      },
      onResume: () => {
        const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (lastInactive && !lastInactive.end) {
          lastInactive.end = Date.now();
          gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
        }
        if (signalCollector) {
          signalCollector.resume();
          signalCollector.recordCustomEvent('visibility_visible', {});
        }
        if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true });
        FeedbackManager.sound.resume();
        FeedbackManager.stream.resumeAll();
        trackEvent('game_resumed', 'system');
      },
      popupProps: {
        title: 'Game Paused',
        description: 'Click Resume to continue.',
        primaryText: 'Resume'
      }
    });

    // PostMessage listener (PART-008)
    window.addEventListener("message", handlePostMessage);

    // Signal ready to parent (PART-008)
    window.parent.postMessage({ type: 'game_ready' }, '*');

    // Sentry initialization (PART-030)
    if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled) {
      Sentry.init({
        dsn: SentryConfig.dsn,
        environment: SentryConfig.environment,
        release: "doubles-chain@1.0.0",
        tracesSampleRate: SentryConfig.tracesSampleRate,
        sampleRate: SentryConfig.sampleRate,
        maxBreadcrumbs: 50,
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
          "Script error.",
          "Load failed",
          "Failed to fetch"
        ]
      });
    }

    // Show start transition screen
    if (transitionScreen) {
      transitionScreen.show({
        icons: ['\uD83D\uDD17'],
        iconSize: 'large',
        title: 'Doubles Chain',
        subtitle: 'Find the hidden chain of doubles!',
        buttons: [{ text: "I'm ready!", type: 'primary', action: function() { setupGame(); } }]
      });
    } else {
      setupGame();
    }

  } catch (error) {
    console.error("Initialization failed:", JSON.stringify({ error: error.message }, null, 2));
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = function() {
  console.log('Game State:', JSON.stringify(gameState, null, 2));
};

window.debugAudio = function() {
  console.log('Audio State:', JSON.stringify({
    sound: FeedbackManager.sound.getState(),
    stream: FeedbackManager.stream.getState()
  }, null, 2));
};

window.testAudio = async function(id) {
  console.log('Testing audio:', id);
  try {
    await FeedbackManager.sound.play(id);
  } catch (e) {
    console.error('Audio test failed:', JSON.stringify({ error: e.message }, null, 2));
  }
};

window.testPause = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerInactive();
  } else {
    if (timer) timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  }
  console.log(JSON.stringify({ event: 'testPause', timerPaused: true }));
};

window.testResume = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerResume();
  } else {
    if (timer?.isPaused) timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
  console.log(JSON.stringify({ event: 'testResume', timerResumed: true }));
};

window.debugSignals = function() {
  if (!signalCollector) {
    console.log('SignalCollector not initialized');
    return;
  }
  console.log('=== Signal Collector Debug ===');
  signalCollector.debug();
  console.log('Input events:', signalCollector.getInputEvents().length);
  console.log('Current view:', JSON.stringify(signalCollector.getCurrentView(), null, 2));
  console.log('Metadata:', JSON.stringify(signalCollector.getMetadata(), null, 2));
};

window.loadRound = function(n) {
  gameState.currentRound = n - 1;
  gameState.isProcessing = false;
  renderRound();
};
```

---

## 10. Event Schema

### Game Lifecycle Events (automatic -- from PART-010)

| Event        | Target | When Fired            |
| ------------ | ------ | --------------------- |
| game_start   | game   | setupGame() completes |
| game_end     | game   | endGame() fires       |
| game_paused  | system | Tab loses focus       |
| game_resumed | system | User resumes          |

### Game-Specific Events

| Event          | Target | When Fired                         | Data                                                    |
| -------------- | ------ | ---------------------------------- | ------------------------------------------------------- |
| cell_selected  | grid   | User clicks any grid cell          | `{ row, col, value, correct, expectedValue }`           |
| chain_complete | game   | All chain numbers found in a round | `{ round, chain }`                                      |
| life_lost      | game   | User taps wrong number             | `{ livesRemaining }`                                    |
| round_reset    | game   | User clicks Reset                  | `{ round }`                                             |

---

## 11. Scaffold Points

| Point           | Function          | When                        | What Can Be Injected                             |
| --------------- | ----------------- | --------------------------- | ------------------------------------------------ |
| after_incorrect | handleCellClick() | User taps wrong cell        | Hint: "Look for the smallest number first"       |
| before_round    | renderRound()     | New round starts            | Strategy tip: "Start with the smallest number"   |
| chain_stuck     | handleCellClick() | No progress for 15 seconds  | Visual highlight of first chain number            |
| on_life_lost    | handleCellClick() | Life decremented            | Show partial chain or worked example              |

### Scaffold Integration Notes

- Scaffolds are optional -- game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 12. Feedback Triggers

> FeedbackManager (PART-017) is included -- audio feedback for correct/incorrect taps and game completion.

| Moment                    | Trigger Function  | Feedback Type               | Notes                            |
| ------------------------- | ----------------- | --------------------------- | -------------------------------- |
| Correct cell tap          | handleCellClick() | sound + sticker             | Play after marking cell green    |
| Incorrect cell tap        | handleCellClick() | sound + sticker             | Play after flashing cell red     |
| Game complete (3 lives)   | endGame() via TransitionScreen | celebration (stars) | Victory screen with stars        |
| Game complete (0 lives)   | endGame() via TransitionScreen | encouragement | Game over screen                 |
| Round transition          | handleNext()      | subtle transition sound     | Via TransitionScreen auto-hide   |

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
// Preloaded in DOMContentLoaded via FeedbackManager.sound.preload()
// correct_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3
// wrong_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3
```

---

## 13. Visual Specifications

- **Layout:** ScreenLayout with progressBar + transitionScreen slots. 480px max-width, centered.
- **Color palette:** Primary=#270f36, Success=var(--mathai-green), Error=var(--mathai-red), Blue=var(--mathai-blue), Purple=var(--mathai-purple), Background=#f6f6f6, Content=#ffffff
- **Typography:** var(--mathai-font-family), title=32px, subtitle=18px, body=16px, grid-cells=32px bold
- **Spacing:** Container padding 10px, grid gap 8px, button gap 12px
- **Grid:** 3x3 grid, max-width 320px, cells square (aspect-ratio: 1), border-radius 12px
- **Interactive states:** default (white bg, gray border), hover (#f0f0f0), selected (blue border, light blue bg), correct (green border, light green bg), incorrect (red border, light red bg, 500ms flash), chain-found (green, disabled)
- **Transitions:** all 0.2s ease on cells and buttons, 0.5s on progress bar fill
- **Responsive:** 480px max-width container, grid auto-sizes within

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers (5 rounds, 0 mistakes)

```
SETUP: Page loaded, start transition screen shown, click "I'm ready!" button via transition screen
ACTIONS:
  wait for gameState.isActive === true and #game-screen visible

  // Round 1: chain [2, 4, 8] -- grid: [[5,2,9],[4,7,3],[1,8,6]]
  click .grid-cell[data-row="0"][data-col="1"]  // value=2
  wait 600ms for audio feedback to finish
  click .grid-cell[data-row="1"][data-col="0"]  // value=4
  wait 600ms
  click .grid-cell[data-row="2"][data-col="1"]  // value=8
  wait 600ms
  // Chain complete -- #btn-next visible
  click #btn-next
  wait 2200ms for transition screen

  // Round 2: chain [3, 6, 12] -- grid: [[12,8,3],[5,6,11],[7,10,15]]
  click .grid-cell[data-row="0"][data-col="2"]  // value=3
  wait 600ms
  click .grid-cell[data-row="1"][data-col="1"]  // value=6
  wait 600ms
  click .grid-cell[data-row="0"][data-col="0"]  // value=12
  wait 600ms
  click #btn-next
  wait 2200ms

  // Round 3: chain [5, 10, 20, 40] -- grid: [[40,5,15],[25,10,7],[20,30,9]]
  click .grid-cell[data-row="0"][data-col="1"]  // value=5
  wait 600ms
  click .grid-cell[data-row="1"][data-col="1"]  // value=10
  wait 600ms
  click .grid-cell[data-row="2"][data-col="0"]  // value=20
  wait 600ms
  click .grid-cell[data-row="0"][data-col="0"]  // value=40
  wait 600ms
  click #btn-next
  wait 2200ms

  // Round 4: chain [1, 2, 4, 8] -- grid: [[8,3,1],[6,4,9],[5,2,7]]
  click .grid-cell[data-row="0"][data-col="2"]  // value=1
  wait 600ms
  click .grid-cell[data-row="2"][data-col="1"]  // value=2
  wait 600ms
  click .grid-cell[data-row="1"][data-col="1"]  // value=4
  wait 600ms
  click .grid-cell[data-row="0"][data-col="0"]  // value=8
  wait 600ms
  click #btn-next
  wait 2200ms

  // Round 5: chain [4, 8, 16, 32, 64] -- grid: [[16,4,50],[32,10,8],[64,24,48]]
  click .grid-cell[data-row="0"][data-col="1"]  // value=4
  wait 600ms
  click .grid-cell[data-row="1"][data-col="2"]  // value=8
  wait 600ms
  click .grid-cell[data-row="0"][data-col="0"]  // value=16
  wait 600ms
  click .grid-cell[data-row="1"][data-col="0"]  // value=32
  wait 600ms
  click .grid-cell[data-row="2"][data-col="0"]  // value=64
  wait 600ms
  click #btn-next

ASSERT:
  gameState.score == 5
  gameState.lives == 3
  transition screen shows stars: 3 and "Victory!" title
  click "Claim Stars" button on transition screen
  #results-screen is visible
  #game-screen is hidden
  #result-score shows accuracy percentage
  #result-lives shows "3"
  #result-rounds shows "5/5"
  #stars-display shows 3 filled stars
```

### Scenario: Submit incorrect answer (lose a life)

```
SETUP: Page loaded, click "I'm ready!" on start transition, wait for gameState.isActive === true
ACTIONS:
  // Round 1: chain [2, 4, 8]. Click wrong cell (value=5)
  click .grid-cell[data-row="0"][data-col="0"]  // value=5 (wrong, expected=2)
  wait 600ms for feedback
ASSERT:
  .grid-cell[data-row="0"][data-col="0"] had 'incorrect' class briefly (flashed red, then removed)
  gameState.lives == 2
  #feedback-area is visible (not .hidden class)
  #feedback-text contains "Wrong"
  gameState.attempts.length >= 1
  last attempt in gameState.attempts has correct == false
  progressBar shows 2 lives (2 filled hearts)
```

### Scenario: Game over -- all lives lost

```
SETUP: Page loaded, click "I'm ready!", wait for gameState.isActive === true
ACTIONS:
  // Make 3 wrong taps to lose all lives
  // Round 1: chain [2, 4, 8], grid: [[5,2,9],[4,7,3],[1,8,6]]
  click .grid-cell[data-row="0"][data-col="0"]  // value=5 (wrong, expected=2)
  wait 600ms
  click .grid-cell[data-row="1"][data-col="1"]  // value=7 (wrong, expected=2)
  wait 600ms
  click .grid-cell[data-row="1"][data-col="2"]  // value=3 (wrong, expected=2)
  wait 600ms
ASSERT:
  gameState.lives == 0
  gameState.isActive == false
  transition screen shows "Game Over!" title and "All lives lost!" subtitle
  click "See Results" button on transition screen
  #results-screen is visible
  #result-lives shows "0"
  #stars-display shows 0 filled stars (3 empty stars)
```

### Scenario: Reset clears all selections within a round

```
SETUP: Page loaded, click "I'm ready!", wait for gameState.isActive === true
ACTIONS:
  // Round 1: chain [2, 4, 8]
  click .grid-cell[data-row="0"][data-col="1"]  // value=2 (correct, first in chain)
  wait 600ms
  // Cell should now have class 'chain-found'
  click #btn-reset
ASSERT:
  no .grid-cell elements have class 'chain-found'
  no .grid-cell elements have class 'selected'
  no .grid-cell elements have class 'correct'
  no .grid-cell elements have class 'incorrect'
  no .grid-cell elements have class 'disabled'
  gameState.chainIndex == 0
  gameState.selectedCells.length == 0
  #chain-progress shows all "?" placeholders (no found numbers)
  #feedback-area has class 'hidden'
```

### Scenario: Chain progress display updates correctly

```
SETUP: Page loaded, click "I'm ready!", wait for gameState.isActive === true, Round 1 (chain [2, 4, 8])
ACTIONS:
  // Initially all unknown
  assert #chain-progress innerHTML contains three "?" spans separated by arrows
  click .grid-cell[data-row="0"][data-col="1"]  // value=2 (correct)
  wait 600ms
ASSERT:
  #chain-progress innerHTML contains "2" in a span with class 'chain-found-number'
  #chain-progress innerHTML contains two remaining "?" spans
  gameState.chainIndex == 1
```

### Scenario: Correct cell becomes permanently marked and unclickable

```
SETUP: Page loaded, click "I'm ready!", wait for gameState.isActive === true
ACTIONS:
  click .grid-cell[data-row="0"][data-col="1"]  // value=2 (correct, first in chain)
  wait 600ms
  click .grid-cell[data-row="0"][data-col="1"]  // click same cell again
  wait 300ms
ASSERT:
  .grid-cell[data-row="0"][data-col="1"] has class 'chain-found'
  second click had no effect (cell check prevents action on chain-found cells)
  gameState.chainIndex == 1 (not incremented again)
  gameState.attempts.length == 1 (not 2)
```

### Scenario: Timer counts up during gameplay

```
SETUP: Page loaded, click "I'm ready!", wait for gameState.isActive === true
ACTIONS:
  wait 3000ms
ASSERT:
  timer.getCurrentTime() > 0 (evaluated via page.evaluate)
  #timer-container shows a time string greater than "00:00"
```

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002): SentryConfig -> Sentry SDK -> FeedbackManager -> Components -> Helpers
- [ ] All script `src` URLs use `storage.googleapis.com/test-dynamic-assets/...` -- no relative paths, no `cdn.homeworkapp.ai`
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `#app` div exists (for ScreenLayout)
- [ ] `<template id="game-template">` exists with game content
- [ ] `#game-screen` element exists inside template
- [ ] `#results-screen` element exists inside template, hidden by default
- [ ] `#timer-container` div exists inside game-screen
- [ ] `#game-grid` div exists with `--cols: 3`
- [ ] `data-signal-id` attributes on important interactive elements

### Functional

- [ ] `waitForPackages()` defined and checks FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector (PART-003)
- [ ] DOMContentLoaded is `async` and wrapped in try/catch (PART-004)
- [ ] `waitForPackages()` called first, `FeedbackManager.init()` called second
- [ ] SignalCollector created and assigned to `window.signalCollector`
- [ ] `ScreenLayout.inject()` called before ProgressBar/TransitionScreen (PART-025)
- [ ] Game template cloned into `#gameContent` after ScreenLayout.inject()
- [ ] ProgressBarComponent created with totalRounds: 5, totalLives: 3 (PART-023)
- [ ] TransitionScreenComponent created (PART-024)
- [ ] TimerComponent created with timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false (PART-006)
- [ ] InteractionManager created with selector '.game-play-area' and assigned to `window.interactionManager` (PART-038)
- [ ] Audio preloaded with `sound.preload([{id, url}])` -- NOT `sound.register()` (PART-017)
- [ ] VisibilityTracker created with onInactive + onResume callbacks (PART-005)
- [ ] onInactive pauses: signalCollector, timer (with `{ fromVisibilityTracker: true }`), sound (`pause()` NOT `stopAll()`), streams
- [ ] onResume resumes: signalCollector, timer (only if paused, with `{ fromVisibilityTracker: true }`), sound, streams
- [ ] onInactive/onResume record visibility_hidden/visibility_visible custom events on signalCollector
- [ ] onInactive/onResume fire trackEvent('game_paused'/'game_resumed', 'system')
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] `game_ready` postMessage sent AFTER message listener registered (PART-008)
- [ ] setupGame has fallback content for standalone testing (PART-008)
- [ ] **setupGame() sets `gameState.startTime = Date.now()`**
- [ ] **setupGame() sets `gameState.isActive = true`**
- [ ] **setupGame() calls `timer.start()`**
- [ ] **setupGame() calls `trackEvent('game_start', 'game')`**
- [ ] recordAttempt produces correct attempt shape with all mandatory fields (PART-009)
- [ ] trackEvent fires at all interaction points: cell_selected, chain_complete, life_lost, round_reset (PART-010)
- [ ] `signalCollector.recordViewEvent()` called on every DOM change (content_render, visual_update, feedback_display, overlay_toggle, screen_transition)
- [ ] endGame calculates metrics, logs with JSON.stringify, seals SignalCollector, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition calls endGame()** -- rounds complete (via handleNext) OR lives lost (via handleCellClick)
- [ ] Stars calculated from lives remaining: lives >= 3 -> 3, >= 2 -> 2, >= 1 -> 1, 0 -> 0
- [ ] `computeTriesPerRound` helper exists in global scope
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals (PART-012)
- [ ] `testPause`/`testResume` use `visibilityTracker.triggerInactive()`/`triggerResume()`
- [ ] showResults populates all fields including rounds and lives (PART-019)
- [ ] InputSchema defined with fallback content of 5 rounds (PART-028)
- [ ] Play area has 3x3 grid with clear interactive/feedback sections (PART-027)
- [ ] No anti-patterns present (PART-026)
- [ ] No inline stub/polyfill/fallback classes for CDN packages
- [ ] `window.gameState = {...}` -- NOT `const gameState = {...}`

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors for feedback (PART-020)
- [ ] Gameplay feedback: correct uses `--mathai-cell-bg-green` / `--mathai-cell-border-green`
- [ ] Gameplay feedback: incorrect uses `--mathai-cell-bg-red` / `--mathai-cell-border-red`
- [ ] `.page-center` / `.game-wrapper` / `.game-stack` layout structure (from ScreenLayout, PART-021/025)
- [ ] Do NOT write manual HTML from PART-021 (ScreenLayout handles it)
- [ ] Max-width 480px, uses 100dvh not 100vh (PART-021)
- [ ] Grid has pixel max-width (320px), not just max-width: 100%
- [ ] Grid cells have `overflow: hidden`
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` classes (PART-022)
- [ ] Reset button visible during gameplay, Next button appears after chain complete
- [ ] Progress bar slot uses `position: absolute; top: 0` (no gap above it)
- [ ] TransitionScreen shows start, victory, game-over, and level screens (PART-024)
- [ ] Level transitions use `duration` only (no buttons + duration conflict)
- [ ] Start / victory / game-over use `buttons` only (no duration)

### Rules Compliance

- [ ] RULE-001: All onclick handlers (resetRound, handleNext) and all game functions in global scope
- [ ] RULE-002: All async functions have `async` keyword (handleCellClick, testAudio, DOMContentLoaded handler)
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame -- timer, visibilityTracker, progressBar destroyed; audio stopped
- [ ] RULE-006: No `new Audio()`, no `setInterval` for timer, no `SubtitleComponent.show()`
- [ ] RULE-007: Single file, no external CSS/JS (except PART-002 CDN packages)

### Game-Specific

- [ ] Grid renders 3x3 with correct numbers from round data
- [ ] Cell click validates value against `currentChain[chainIndex]`
- [ ] Chain progress display shows found numbers (green) and unknown slots ("?") with arrows
- [ ] Correct cells get `chain-found` class and become unclickable
- [ ] Incorrect taps flash red briefly (500ms) then revert
- [ ] Lives decrement on wrong tap, progressBar updates
- [ ] Game ends when lives reach 0 (game-over path with TransitionScreen)
- [ ] Game ends when all 5 rounds complete (victory path with TransitionScreen + stars)
- [ ] Chain length grows from 3 (rounds 1-2) to 4 (rounds 3-4) to 5 (round 5) per fallback content
- [ ] Reset button resets chainIndex, selectedCells, and all cell classes within current round
- [ ] `isProcessing` flag prevents double-clicks during audio feedback
- [ ] `window.loadRound(n)` debug function jumps to round n
- [ ] No dead-end game states -- every state leads to either continued play or endGame

### Contract Compliance

- [ ] gameState matches `contracts/game-state.schema.json`
- [ ] Attempts match `contracts/attempt.schema.json` (all required fields present)
- [ ] Metrics match `contracts/metrics.schema.json` (includes totalLives, tries)
- [ ] duration_data matches `contracts/duration-data.schema.json`
- [ ] postMessage out matches `contracts/postmessage-out.schema.json` (type: 'game_complete', data.metrics, data.attempts, data.completedAt)
