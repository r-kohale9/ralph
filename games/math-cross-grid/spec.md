# Game Spec — Math Cross-Grid

---

## Section 1: Overview

| Field | Value |
|-------|-------|
| **Game ID** | `math-cross-grid` |
| **Title** | Math Cross-Grid |
| **Type** | Drag-and-Drop Puzzle |
| **Audience** | Kids 8–14 |
| **Platform** | Mobile-first (Web, 480px max-width) |
| **Rounds** | Driven by content (default 6) |
| **Timer** | None |
| **Lives** | 2 |
| **Validation** | Fixed answer (PART-013) |
| **Stories** | No |
| **Progress Bar** | Yes (PART-023 + PART-025) |
| **Transition Screen** | No |
| **Drag-and-Drop** | Yes (PART-033) |

---

## Section 2: Game Concept & Rules

A **5×5 cross-grid** puzzle where number equations run simultaneously **horizontally** (left → right) and **vertically** (top → bottom). The player drags number tiles from a bank at the bottom into blank drop-zone cells so that **every equation in the grid is true at once**.

### Grid Anatomy

```
 col:  0     1     2     3     4
row 0: [N]   [+]   [N]   [=]   [N]    ← horizontal: N op N = N
row 1: [op]  [██]  [op]  [██]  [op]   ← operator row (gray █ = structure cell)
row 2: [N]   [op]  [N]   [=]   [N]    ← horizontal: N op N = N
row 3: [=]   [██]  [=]   [██]  [=]    ← equals row  (gray █ = structure cell)
row 4: [N]   [op]  [N]   [=]   [N]    ← horizontal: N op N = N
```

- **Horizontal equations** run across rows 0, 2, 4: `col0 op col2 = col4`
- **Vertical equations** run down cols 0, 2, 4: `row0 op row2 = row4` (op from row 1)
- Gray structure cells at (row1,col1), (row1,col3), (row3,col1), (row3,col3) are non-interactive

### Cell Types

| Class | Visual | Behaviour |
|-------|--------|-----------|
| `.given` | Soft green background, solid border | Fixed — cannot be moved |
| `.operator` | Plain centered text | Fixed — not interactive |
| `.blank` | Gray dashed border | Drop zone — accepts tiles |
| `.structure` | Light gray fill | Non-interactive spacer |

### Gameplay Flow Per Round

1. Grid renders with some number cells pre-given; blank cells await tiles.
2. Player drags a tile from the bank onto a blank cell → tile snaps in, marked `.used`.
3. Dropping onto an already-filled cell swaps — old tile returns to bank.
4. **Next** button is disabled until every blank cell is filled.
5. Player presses **Next** → validation runs:
   - ✅ **All correct** → cells flash green → round advances.
   - ❌ **Any incorrect** → incorrect cells shake red → wrong tiles eject back to bank → life lost.
6. Losing both lives → game over → results screen.
7. Completing all rounds → results screen.

---

## Section 3: Parts Selected

| Part | Category | Reason |
|------|----------|--------|
| PART-001 | MANDATORY | HTML Shell |
| PART-002 | MANDATORY | Package Scripts |
| PART-003 | MANDATORY | waitForPackages |
| PART-004 | MANDATORY | Initialization Block |
| PART-005 | MANDATORY | VisibilityTracker |
| PART-007 | MANDATORY | Game State Object |
| PART-008 | MANDATORY | PostMessage Protocol |
| PART-009 | MANDATORY | Attempt Tracking |
| PART-010 | MANDATORY | Event Tracking & SignalCollector |
| PART-011 | MANDATORY | End Game & Metrics |
| PART-012 | MANDATORY | Debug Functions |
| PART-013 | CONDITIONAL | Validation — Fixed Answer |
| PART-019 | MANDATORY | Results Screen UI |
| PART-020 | MANDATORY | CSS Variables & Colors |
| PART-021 | MANDATORY | Screen Layout CSS |
| PART-022 | MANDATORY | Game Buttons |
| PART-023 | CONDITIONAL | ProgressBar Component |
| PART-025 | CONDITIONAL | ScreenLayout Component |
| PART-026 | REFERENCE | Anti-Patterns verification |
| PART-027 | MANDATORY | Play Area Construction |
| PART-028 | MANDATORY | InputSchema Patterns |
| PART-030 | MANDATORY | Sentry Error Tracking |
| PART-033 | CONDITIONAL | Interaction Patterns — Drag & Drop |
| PART-034 | POST_GEN | Variable Schema Serialization |
| PART-035 | POST_GEN | Test Plan Generation |
| PART-037 | POST_GEN | Playwright Testing & Ralph Loop |

---

## Section 4: InputSchema & Fallback Content

### Schema

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          // 5×5 grid. Values:
          //   number  → pre-given cell (.given)
          //   string  → operator or equals sign (.operator)
          //   null    → blank drop zone (.blank)
          //   ""      → gray structure spacer (.structure)
          grid: {
            type: 'array',
            items: { type: 'array', items: {} },
            description: '5 rows × 5 cols. null = blank drop zone. "" = gray structure cell.'
          },
          // Correct value for each blank, keyed "row,col"
          solution: {
            type: 'object',
            additionalProperties: { type: 'number' }
          },
          // Tile pool — may include duplicates
          bank: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        required: ['grid', 'solution', 'bank']
      }
    }
  },
  required: ['questions']
};
```

### Fallback Content (3 Puzzles)

```javascript
const fallbackContent = {
  questions: [
    {
      // Puzzle 1
      // Row 0: 9 + 8 = 17  |  Row 2: 8 – 6 = 2  |  Row 4: 17 + 2 = 19
      // Col 0: 9 + 8 = 17  |  Col 2: 8 – 6 = 2  |  Col 4: 17 + 2 = 19
      grid: [
        [null, '+',  null, '=', null],
        ['+',  '',   '-',  '',  '+' ],
        [null, '-',  null, '=', null],
        ['=',  '',   '=',  '',  '=' ],
        [null, '+',  null, '=', null]
      ],
      solution: {
        '0,0': 9,  '0,2': 8,  '0,4': 17,
        '2,0': 8,  '2,2': 6,  '2,4': 2,
        '4,0': 17, '4,2': 2,  '4,4': 19
      },
      bank: [2, 2, 6, 8, 8, 9, 17, 17, 19]
    },
    {
      // Puzzle 2 — all addition
      // Row 0: 3 + 4 = 7   |  Row 2: 1 + 5 = 6   |  Row 4: 4 + 9 = 13
      // Col 0: 3 + 1 = 4   |  Col 2: 4 + 5 = 9   |  Col 4: 7 + 6 = 13
      grid: [
        [null, '+', null, '=', null],
        ['+',  '',  '+',  '',  '+' ],
        [null, '+', null, '=', null],
        ['=',  '',  '=',  '',  '=' ],
        [null, '+', null, '=', null]
      ],
      solution: {
        '0,0': 3, '0,2': 4, '0,4': 7,
        '2,0': 1, '2,2': 5, '2,4': 6,
        '4,0': 4, '4,2': 9, '4,4': 13
      },
      bank: [1, 3, 4, 4, 5, 6, 7, 9, 13]
    },
    {
      // Puzzle 3 — partial blanks (some cells pre-given)
      // Row 0: 6 + 3 = 9   |  Row 2: 2 + 5 = 7   |  Row 4: 8 + 8 = 16
      // Col 0: 6 + 2 = 8   |  Col 2: 3 + 5 = 8   |  Col 4: 9 + 7 = 16
      grid: [
        [6,    '+', null, '=', null],
        ['+',  '',  '+',  '',  '+' ],
        [null, '+', 5,    '=', null],
        ['=',  '',  '=',  '',  '=' ],
        [null, '+', null, '=', 16  ]
      ],
      solution: {
        '0,2': 3, '0,4': 9,
        '2,0': 2,            '2,4': 7,
        '4,0': 8, '4,2': 8
      },
      bank: [2, 3, 7, 8, 8, 9]
    }
  ]
};
```

---

## Section 5: Game State

```javascript
window.gameState = {
  // ── Mandatory fields (PART-007) ──
  currentRound: 0,
  totalRounds: 6,        // overwritten by content length in setupGame()
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

  // ── Game-specific fields ──
  lives: 2,
  placedTiles: {},       // { "row,col": { value: number, tileId: string } }
  draggedTileId: null,
  isChecking: false,     // blocks interaction during validation animation
  incorrectCount: 0,     // total wrong submissions across all rounds
  pendingEndProblem: null  // deferred SignalCollector endProblem (PART-010)
};

// Module-scope component refs (let — not const, reassigned in restartGame)
let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
```

---

## Section 6: HTML Structure

> Uses `ScreenLayout.inject()` (PART-025). Game HTML is loaded via `<template>` into `#gameContent`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Math Cross-Grid</title>

  <!-- PART-030: Sentry — MUST load first -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>
  <script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>

  <style>
    /* ... all CSS (Section 8) ... */
  </style>
</head>
<body>
  <!-- PART-025: ScreenLayout target -->
  <div id="app"></div>

  <!-- PART-025: Game content template (cloned into #gameContent after inject) -->
  <template id="game-template">

    <!-- Game screen -->
    <div id="game-screen" class="game-block">
      <p class="instruction">
        Drag and drop <strong>the numbers</strong> to make the math statements true.
      </p>

      <!-- 5×5 cross-grid (dynamically populated) -->
      <div class="cross-grid" id="cross-grid" aria-label="Math cross-grid puzzle"></div>

      <!-- Number bank (dynamically populated) -->
      <div class="number-bank" id="number-bank" aria-label="Number tiles"></div>

      <!-- Next button -->
      <div class="btn-container">
        <button class="game-btn btn-primary"
                id="btn-next"
                onclick="handleNext()"
                disabled
                data-signal-id="btn-next">
          Next
        </button>
      </div>
    </div>

    <!-- Results screen (PART-019) -->
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
            <span class="metric-label">Correct</span>
            <span id="result-correct" class="metric-value">0/0</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Lives Left</span>
            <span id="result-lives" class="metric-value">0</span>
          </div>
        </div>
        <button class="game-btn btn-primary" onclick="location.reload()">Play Again</button>
      </div>
    </div>

  </template>

  <!-- PART-002: Packages (FeedbackManager → Components → Helpers) -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

  <script>
    /* ... all JavaScript (Sections 7–14) ... */
  </script>
</body>
</html>
```

---

## Section 7: Game Flow & End Conditions

```
DOMContentLoaded
  └─► waitForPackages()
  └─► FeedbackManager.init()
  └─► SignalCollector init
  └─► ScreenLayout.inject() + clone template → #gameContent
  └─► VisibilityTracker init
  └─► window.addEventListener('message', handlePostMessage)
  └─► setupGame(fallbackContent)

setupGame(content)
  └─► Reset gameState fields
  └─► progressBar.update(0, lives)
  └─► buildGrid(questions[0])
  └─► buildBank(questions[0].bank)
  └─► signalCollector.startProblem('round_0', …)
  └─► trackEvent('game_start', 'game')

── Player drags tiles → checkAllFilled() → enables Next ──

handleNext()   [global]
  └─► isChecking = true
  └─► Validate each blank cell vs solution
  └─► recordAttempt(…)
  └─► ALL CORRECT?
      ├─► YES → score++ → cells flash green → setTimeout(advanceRound, 700)
      └─► NO  → lives-- → shake red → eject wrong tiles → isChecking = false
                └─► lives <= 0? → setTimeout(endGame, 800)   ← END CONDITION A

advanceRound()
  └─► currentRound++
  └─► progressBar.update(currentRound, lives)
  └─► currentRound >= totalRounds? → endGame()             ← END CONDITION B
  └─► ELSE → reset placedTiles → buildGrid() → buildBank()
             └─► signalCollector.startProblem(…)

endGame()                                                    ← called from A or B
  └─► isActive guard
  └─► Flush pendingEndProblem
  └─► seal SignalCollector
  └─► showResults(metrics)
  └─► window.parent.postMessage('game_complete', …)
  └─► cleanup (visibilityTracker, audio)
```

**Every end condition has a path to `endGame()`.** No dead-end states exist.

---

## Section 8: CSS

```css
/* ═══════════════════════════════════════════
   PART-021: Screen Layout
═══════════════════════════════════════════ */
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
  max-width: var(--mathai-game-max-width, 480px);
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
  gap: var(--mathai-stack-gap, 10px);
  padding: 0 10px 20px 10px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

.game-block {
  padding: var(--mathai-stack-gap, 10px);
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

/* Progress bar pinned to absolute top (PART-023) */
#mathai-progress-slot,
.mathai-progress-slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

/* ═══════════════════════════════════════════
   PART-022: Buttons
═══════════════════════════════════════════ */
.btn-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: var(--mathai-padding-small, 10px);
}

.game-btn {
  padding: 14px 32px;
  font-size: var(--mathai-font-size-button, 16px);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  border: none;
  border-radius: var(--mathai-border-radius-button, 10px);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-white, #fff);
  min-width: 140px;
}

.game-btn:active { transform: translateY(0); }

.game-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary { background: var(--mathai-green, #219653); }
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33,150,83,0.4);
}

.btn-secondary { background: var(--mathai-blue, #667eea); }
.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102,126,234,0.4);
}

.hidden { display: none !important; }

/* ═══════════════════════════════════════════
   Instruction label
═══════════════════════════════════════════ */
.instruction {
  text-align: center;
  font-size: var(--mathai-font-size-body, 16px);
  color: var(--mathai-text-primary, #4a4a4a);
  margin: 12px 16px 8px;
  line-height: 1.4;
}

/* ═══════════════════════════════════════════
   PART-033 / PART-027: Cross-Grid
═══════════════════════════════════════════ */
.cross-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  max-width: 320px;     /* pixel cap — prevents huge cells on desktop */
  margin: 8px auto;
}

.grid-cell {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  font-family: var(--mathai-font-family);
  border-radius: 8px;
  user-select: none;
  box-sizing: border-box;
  overflow: hidden;     /* prevent pseudo-elements escaping */
}

/* Operator / equals cells */
.grid-cell.operator {
  background: transparent;
  color: var(--mathai-text-primary, #4a4a4a);
  font-size: 22px;
}

/* Non-interactive structure spacers */
.grid-cell.structure {
  background: var(--mathai-cell-bg-grey, #E0E0E0);
}

/* Pre-given number cells */
.grid-cell.given {
  background: var(--mathai-cell-bg-green, #D9F8D9);
  border: 2px solid var(--mathai-cell-border-green, #27ae60);
  color: var(--mathai-primary, #270f36);
}

/* Blank drop zones (PART-033) */
.grid-cell.blank {
  background: #f5f5f5;
  border: 2px dashed var(--mathai-border-gray, #E0E0E0);
  transition: border-color 0.15s, background 0.15s;
}

.grid-cell.blank.drag-over {
  border-color: var(--mathai-blue, #667eea);
  background: #EBF0FF;
  border-style: solid;
}

.grid-cell.blank.filled {
  border-style: solid;
  border-color: var(--mathai-cell-border-green, #27ae60);
  background: var(--mathai-cell-bg-green, #D9F8D9);
}

/* PART-020: Mandatory feedback state colors */
.grid-cell.blank.correct {
  background: var(--mathai-cell-bg-green, #D9F8D9);
  border: 2px solid var(--mathai-cell-border-green, #27ae60);
}

.grid-cell.blank.incorrect {
  background: var(--mathai-cell-bg-red, #FFD9D9);
  border: 2px solid var(--mathai-cell-border-red, #e74c3c);
  animation: shake 0.35s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-5px); }
  75%       { transform: translateX(5px); }
}

/* ═══════════════════════════════════════════
   PART-033: Number Bank tiles
═══════════════════════════════════════════ */
.number-bank {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  padding: 14px;
  background: var(--mathai-light-gray, #f5f5f5);
  border-radius: 14px;
  margin: 8px auto;
  max-width: 340px;
  min-height: 80px;
}

.tile {
  width: 64px;
  height: 64px;
  background: #fff;
  border: 2px solid var(--mathai-border-gray, #E0E0E0);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  font-family: var(--mathai-font-family);
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.15s;
  user-select: none;
}

.tile:active   { cursor: grabbing; }
.tile.dragging { opacity: 0.35; transform: scale(1.05); }
.tile.used     { opacity: 0.25; pointer-events: none; background: #eee; }

/* ═══════════════════════════════════════════
   PART-019: Results Screen
═══════════════════════════════════════════ */
.results-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 24px;
  text-align: center;
}

.results-container h2 {
  font-size: var(--mathai-font-size-title, 32px);
  color: var(--mathai-primary, #270f36);
  margin: 0;
}

.stars-display {
  font-size: 36px;
  letter-spacing: 4px;
}

.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 280px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--mathai-font-size-body, 16px);
  padding: 10px 16px;
  background: var(--mathai-light-gray, #f5f5f5);
  border-radius: 8px;
}

.metric-label { color: var(--mathai-gray, #666); font-weight: 500; }
.metric-value { color: var(--mathai-primary, #270f36); font-weight: 700; }
```

---

## Section 9: JavaScript Functions

### 9.1 — PART-003: waitForPackages

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
    console.log('[math-cross-grid] All packages loaded');
  } catch (error) {
    console.error('[math-cross-grid] Package loading failed:', JSON.stringify({ error: error.message }));
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Failed to load. Please refresh.</div>';
    throw error;
  }
}
```

### 9.2 — PART-007: Game State Object

*(Defined in Section 5 above — placed at top of `<script>` before any functions.)*

### 9.3 — PART-004: DOMContentLoaded Initialization

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // PART-010: SignalCollector
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: 'math-cross-grid'
    });
    window.signalCollector = signalCollector;

    // PART-025: ScreenLayout inject + clone template
    const layout = ScreenLayout.inject('app', {
      slots: { progressBar: true, transitionScreen: false }
    });
    const gameContent = document.getElementById('gameContent');
    const tmpl = document.getElementById('game-template');
    gameContent.appendChild(tmpl.content.cloneNode(true));

    // PART-023: ProgressBar
    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: gameState.totalRounds,
      totalLives: gameState.lives,
      slotId: 'mathai-progress-slot'
    });

    // PART-005: VisibilityTracker (after timer — no timer in this game)
    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        const inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
        trackEvent('game_paused', 'system');
      },
      onResume: () => {
        const last = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (last && !last.end) {
          last.end = Date.now();
          gameState.duration_data.totalInactiveTime += (last.end - last.start);
        }
        if (signalCollector) {
          signalCollector.resume();
          signalCollector.recordCustomEvent('visibility_visible', {});
        }
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

    // PART-008: PostMessage listener
    window.addEventListener('message', handlePostMessage);

    // Start with fallback content
    setupGame();

  } catch (error) {
    console.error('[math-cross-grid] Initialization failed:', JSON.stringify({ error: error.message }));
  }
});
```

### 9.4 — PART-008: PostMessage Handler & setupGame

```javascript
// Global scope (RULE-001)
function handlePostMessage(event) {
  try {
    if (event.data?.type === 'game_init') {
      const { gameId, content } = event.data.data;
      gameState.content = content;
      if (gameId) gameState.gameId = gameId;
      setupGame();
    }
  } catch (error) {
    console.error('[math-cross-grid] PostMessage error:', JSON.stringify({ error: error.message }));
  }
}

function setupGame() {
  if (!gameState.content) {
    gameState.content = fallbackContent;
  }

  // PART-004: Mandatory resets
  gameState.startTime       = Date.now();
  gameState.isActive        = true;
  gameState.currentRound    = 0;
  gameState.score           = 0;
  gameState.attempts        = [];
  gameState.events          = [];
  gameState.lives           = 2;
  gameState.placedTiles     = {};
  gameState.isChecking      = false;
  gameState.incorrectCount  = 0;
  gameState.pendingEndProblem = null;
  gameState.totalRounds     = gameState.content.questions.length;
  gameState.duration_data.startTime = new Date().toISOString();

  // Update progress bar for new round count
  if (progressBar) progressBar.update(0, gameState.lives);

  trackEvent('game_start', 'game');

  // Show game screen
  const gameScreen    = document.getElementById('game-screen');
  const resultsScreen = document.getElementById('results-screen');
  if (gameScreen)    gameScreen.style.display    = 'block';
  if (resultsScreen) resultsScreen.style.display = 'none';

  renderRound();
}
```

### 9.5 — Game-Specific: renderRound

```javascript
function renderRound() {
  const q = getCurrentQuestion();

  // Deferred endProblem flush (PART-010)
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(
      gameState.pendingEndProblem.id,
      gameState.pendingEndProblem.outcome
    );
    gameState.pendingEndProblem = null;
  }

  // Reset per-round state
  gameState.placedTiles = {};
  gameState.isChecking  = false;
  document.getElementById('btn-next').disabled = true;

  buildGrid(q);
  buildBank(q.bank);

  // PART-010: Start signal collection for this problem
  if (signalCollector) {
    signalCollector.startProblem('round_' + gameState.currentRound, {
      round_number: gameState.currentRound,
      question_text: 'Math cross-grid round ' + (gameState.currentRound + 1),
      correct_answer: q.solution
    });
  }

  trackEvent('question_shown', 'game', { round: gameState.currentRound });

  // PART-010: View event
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        round: gameState.currentRound,
        blanks: Object.keys(q.solution).length,
        bankSize: q.bank.length,
        trigger: 'round_start'
      },
      components: {
        progress: { current: gameState.currentRound, total: gameState.totalRounds }
      }
    });
  }
}
```

### 9.6 — Game-Specific: buildGrid

```javascript
function buildGrid(question) {
  const container = document.getElementById('cross-grid');
  container.innerHTML = '';

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const val  = question.grid[r][c];
      const cell = document.createElement('div');
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (val === null) {
        // Blank drop zone
        cell.className       = 'grid-cell blank';
        cell.dataset.key     = r + ',' + c;
        cell.setAttribute('data-signal-id', 'drop-zone-' + r + '-' + c);
        setupDropZone(cell);
      } else if (val === '') {
        // Gray structure spacer
        cell.className = 'grid-cell structure';
      } else if (typeof val === 'string') {
        // Operator (+, –, ×, ÷, =)
        cell.className   = 'grid-cell operator';
        cell.textContent = val;
      } else {
        // Pre-given number
        cell.className   = 'grid-cell given';
        cell.textContent = val;
        cell.setAttribute('data-signal-id', 'given-' + r + '-' + c);
      }

      container.appendChild(cell);
    }
  }
}
```

### 9.7 — Game-Specific: buildBank

```javascript
function buildBank(bank) {
  const container = document.getElementById('number-bank');
  container.innerHTML = '';

  bank.forEach((num, i) => {
    const tile = document.createElement('div');
    tile.className          = 'tile';
    tile.id                 = 'tile-' + i;
    tile.textContent        = num;
    tile.dataset.value      = num;
    tile.dataset.tileId     = 'tile-' + i;
    tile.draggable          = true;
    tile.setAttribute('data-signal-id', 'tile-' + num + '-' + i);

    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('tileId', tile.id);
      e.dataTransfer.setData('value',  String(num));
      tile.classList.add('dragging');
      gameState.draggedTileId = tile.id;
      trackEvent('drag_start', tile.id, { value: num });
    });

    tile.addEventListener('dragend', () => {
      tile.classList.remove('dragging');
      gameState.draggedTileId = null;
    });

    container.appendChild(tile);
  });
}
```

### 9.8 — Game-Specific: setupDropZone

```javascript
function setupDropZone(cell) {
  cell.addEventListener('dragover', (e) => {
    e.preventDefault();
    cell.classList.add('drag-over');
  });

  cell.addEventListener('dragleave', () => {
    cell.classList.remove('drag-over');
  });

  cell.addEventListener('drop', (e) => {
    e.preventDefault();
    cell.classList.remove('drag-over');
    if (gameState.isChecking) return;

    const tileId = e.dataTransfer.getData('tileId');
    const value  = parseInt(e.dataTransfer.getData('value'), 10);
    const key    = cell.dataset.key;

    // If cell already occupied, return previous tile to bank
    if (gameState.placedTiles[key]) {
      returnTileToBank(gameState.placedTiles[key].tileId);
    }

    // Place new tile
    gameState.placedTiles[key] = { value, tileId };
    cell.textContent = value;
    cell.classList.add('filled');
    cell.classList.remove('correct', 'incorrect');

    // Mark tile used
    const tile = document.getElementById(tileId);
    if (tile) tile.classList.add('used');

    // PART-010: update multi-input answer
    if (signalCollector) {
      signalCollector.updateCurrentAnswer(
        Object.fromEntries(Object.entries(gameState.placedTiles).map(([k, v]) => [k, v.value]))
      );
      signalCollector.recordViewEvent('visual_update', {
        screen: 'gameplay',
        content_snapshot: {
          type: 'tile_dropped',
          cell_key: key,
          value,
          cells_filled: Object.keys(gameState.placedTiles).length,
          trigger: 'user_action'
        }
      });
    }

    trackEvent('drag_end', tileId, { dropTarget: key, value });
    checkAllFilled();
  });
}
```

### 9.9 — Game-Specific: returnTileToBank

```javascript
function returnTileToBank(tileId) {
  const tile = document.getElementById(tileId);
  if (tile) tile.classList.remove('used');
}
```

### 9.10 — Game-Specific: checkAllFilled

```javascript
function checkAllFilled() {
  const blanks   = document.querySelectorAll('.grid-cell.blank');
  const allFilled = Array.from(blanks).every(c => c.classList.contains('filled'));
  document.getElementById('btn-next').disabled = !allFilled;
}
```

### 9.11 — PART-013 + PART-010: handleNext (GLOBAL — RULE-001)

```javascript
function handleNext() {
  if (gameState.isChecking) return;
  gameState.isChecking = true;
  document.getElementById('btn-next').disabled = true;

  const q        = getCurrentQuestion();
  const solution = q.solution;
  let   allCorrect = true;
  const userAnswers = {};

  // Validate each blank cell
  document.querySelectorAll('.grid-cell.blank').forEach(cell => {
    const key     = cell.dataset.key;
    const placed  = gameState.placedTiles[key];
    const correct = solution[key];
    userAnswers[key] = placed ? placed.value : null;

    const isRight = placed && placed.value === correct;
    cell.classList.remove('correct', 'incorrect');
    cell.classList.add(isRight ? 'correct' : 'incorrect');
    if (!isRight) allCorrect = false;
  });

  // PART-009: recordAttempt
  recordAttempt({
    userAnswer:    userAnswers,
    correct:       allCorrect,
    question:      'Math cross-grid round ' + (gameState.currentRound + 1),
    correctAnswer: solution,
    validationType: 'fixed'
  });

  // Defer SignalCollector endProblem (PART-010)
  gameState.pendingEndProblem = {
    id:      'round_' + gameState.currentRound,
    outcome: { correct: allCorrect, answer: userAnswers }
  };

  // PART-010: feedback view event
  if (signalCollector) {
    signalCollector.recordViewEvent('feedback_display', {
      screen: 'gameplay',
      content_snapshot: {
        feedback_type: allCorrect ? 'correct' : 'incorrect',
        round: gameState.currentRound
      }
    });
  }

  if (allCorrect) {
    gameState.score++;
    progressBar.update(gameState.currentRound + 1, gameState.lives);
    setTimeout(advanceRound, 700);
  } else {
    gameState.lives--;
    gameState.incorrectCount++;
    progressBar.update(gameState.currentRound, gameState.lives);

    if (gameState.lives <= 0) {
      setTimeout(endGame, 800);          // ← END CONDITION A
    } else {
      // Eject incorrect tiles back to bank, let player retry
      setTimeout(() => {
        document.querySelectorAll('.grid-cell.blank.incorrect').forEach(cell => {
          const key = cell.dataset.key;
          if (gameState.placedTiles[key]) {
            returnTileToBank(gameState.placedTiles[key].tileId);
            delete gameState.placedTiles[key];
          }
          cell.textContent = '';
          cell.classList.remove('filled', 'incorrect');
        });
        document.getElementById('btn-next').disabled = true;
        gameState.isChecking = false;
      }, 800);
    }
  }
}
```

### 9.12 — Game-Specific: advanceRound

```javascript
function advanceRound() {
  gameState.currentRound++;

  if (gameState.currentRound >= gameState.totalRounds) {
    endGame();                             // ← END CONDITION B
    return;
  }

  renderRound();
}
```

### 9.13 — Game-Specific: getCurrentQuestion

```javascript
function getCurrentQuestion() {
  const content = gameState.content || fallbackContent;
  return content.questions[gameState.currentRound % content.questions.length];
}
```

### 9.14 — PART-009: recordAttempt

```javascript
function recordAttempt(data) {
  const attempt = {
    attempt_timestamp:        new Date().toISOString(),
    time_since_start_of_game: (Date.now() - gameState.startTime) / 1000,
    input_of_user:            data.userAnswer,
    attempt_number:           gameState.attempts.length + 1,
    correct:                  data.correct,
    metadata: {
      round:          gameState.currentRound,
      question:       data.question,
      correctAnswer:  data.correctAnswer,
      validationType: data.validationType || 'fixed'
    }
  };

  gameState.attempts.push(attempt);
  gameState.duration_data.attempts.push({
    startTime:            new Date().toISOString(),
    time_to_first_attempt: (Date.now() - gameState.startTime) / 1000,
    duration: 0
  });

  console.log('[math-cross-grid] Attempt:', JSON.stringify(attempt, null, 2));
}
```

### 9.15 — PART-010: trackEvent

```javascript
function trackEvent(type, target, data = {}) {
  gameState.events.push({
    type,
    target,
    timestamp: Date.now(),
    ...data
  });
}
```

### 9.16 — PART-011: endGame

```javascript
function endGame() {
  if (!gameState.isActive) return;
  gameState.isActive = false;
  gameState.duration_data.currentTime = new Date().toISOString();

  const correct  = gameState.attempts.filter(a => a.correct).length;
  const total    = gameState.attempts.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeTaken = Math.round((Date.now() - gameState.startTime) / 1000);
  const stars     = accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy > 0 ? 1 : 0;

  const metrics = {
    accuracy,
    time:           timeTaken,
    stars,
    livesRemaining: gameState.lives,
    incorrectCount: gameState.incorrectCount,
    attempts:       gameState.attempts,
    duration_data:  gameState.duration_data
  };

  console.log('[math-cross-grid] Final Metrics:', JSON.stringify(metrics, null, 2));
  console.log('[math-cross-grid] Attempt History:', JSON.stringify(gameState.attempts, null, 2));

  trackEvent('game_end', 'game', { metrics });

  // Flush deferred endProblem (PART-010)
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(
      gameState.pendingEndProblem.id,
      gameState.pendingEndProblem.outcome
    );
    gameState.pendingEndProblem = null;
  }

  // Seal SignalCollector (PART-010)
  const signalPayload = signalCollector
    ? signalCollector.seal()
    : { events: [], signals: {}, metadata: {} };

  // PART-019: Show results
  showResults(metrics);

  // PART-008: PostMessage
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics,
      attempts: gameState.attempts,
      ...signalPayload,
      completedAt: Date.now()
    }
  }, '*');

  // RULE-005: Cleanup
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  if (progressBar)        { progressBar.destroy();       progressBar       = null; }
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

### 9.17 — PART-019: showResults

```javascript
function showResults(metrics) {
  const correct = gameState.attempts.filter(a => a.correct).length;
  const total   = gameState.attempts.length;

  document.getElementById('result-score').textContent   = metrics.accuracy + '%';
  document.getElementById('result-correct').textContent = correct + '/' + total;
  document.getElementById('result-lives').textContent   = metrics.livesRemaining;
  document.getElementById('stars-display').textContent  =
    '⭐'.repeat(metrics.stars) + '☆'.repeat(3 - metrics.stars);

  document.getElementById('game-screen').style.display    = 'none';
  document.getElementById('results-screen').style.display = 'block';

  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'results',
      metadata: { transition_from: 'gameplay' }
    });
  }
}
```

### 9.18 — PART-030: Sentry Init & Global Error Handlers

```javascript
// Sentry initialization (PART-030)
if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled) {
  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: SentryConfig.environment,
    release: 'math-cross-grid@1.0.0',
    tracesSampleRate: SentryConfig.tracesSampleRate,
    sampleRate: SentryConfig.sampleRate,
    maxBreadcrumbs: 50,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Script error.',
      'Load failed',
      'Failed to fetch'
    ]
  });
}

window.addEventListener('error', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.error || new Error(event.message), {
      tags: { errorType: 'unhandled', severity: 'critical' }
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.reason || new Error('Unhandled promise rejection'), {
      tags: { errorType: 'unhandled-promise', severity: 'critical' }
    });
  }
});
```

### 9.19 — PART-012: Debug Functions

```javascript
window.debugGame = function() {
  console.log('[math-cross-grid] Game State:', JSON.stringify(gameState, null, 2));
};

window.debugAudio = function() {
  console.log('[math-cross-grid] Audio State:', JSON.stringify({
    sound:  FeedbackManager.sound.getState(),
    stream: FeedbackManager.stream.getState()
  }, null, 2));
};

window.testAudio = async function(id) {
  console.log('[math-cross-grid] Testing audio:', id);
  try {
    await FeedbackManager.sound.play(id);
  } catch (e) {
    console.error('[math-cross-grid] Audio test failed:', JSON.stringify({ error: e.message }));
  }
};

window.testPause = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerInactive();
  } else {
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  }
  console.log(JSON.stringify({ event: 'testPause' }));
};

window.testResume = function() {
  if (visibilityTracker) {
    visibilityTracker.triggerResume();
  } else {
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
  console.log(JSON.stringify({ event: 'testResume' }));
};

window.debugSignals = function() {
  if (!signalCollector) { console.log('SignalCollector not initialized'); return; }
  signalCollector.debug();
  console.log('[math-cross-grid] Input events:', signalCollector.getInputEvents().length);
  console.log('[math-cross-grid] Problem signals:', JSON.stringify(signalCollector.getAllProblemSignals(), null, 2));
  console.log('[math-cross-grid] Current view:', JSON.stringify(signalCollector.getCurrentView(), null, 2));
  console.log('[math-cross-grid] Metadata:', JSON.stringify(signalCollector.getMetadata(), null, 2));
};

window.verifySentry = function() {
  const checks = {
    sdkLoaded:     typeof Sentry       !== 'undefined',
    configLoaded:  typeof SentryConfig !== 'undefined',
    initialized:   typeof Sentry       !== 'undefined' && Sentry.getClient() !== undefined,
    dsn:           typeof Sentry       !== 'undefined' ? Sentry.getClient()?.getDsn()?.toString() : null
  };
  console.log('[math-cross-grid] Sentry Status:', JSON.stringify(checks, null, 2));
  return checks;
};

window.testSentry = function() {
  try {
    throw new Error('Test error from testSentry()');
  } catch (error) {
    if (typeof Sentry !== 'undefined') Sentry.captureException(error, { tags: { test: true } });
    console.log('[math-cross-grid] Test error sent to Sentry.');
  }
};
```

---

## Section 10: PostMessage Contract

### Inbound — `game_init`

```json
{
  "type": "game_init",
  "data": {
    "gameId": "math-cross-grid",
    "content": {
      "questions": [
        {
          "grid": [
            [9,   "+", 8,    "=", 17  ],
            ["+", "",  "-",  "",  "+" ],
            [8,   "-", null, "=", null],
            ["=", "",  "=",  "",  "=" ],
            [17,  "+", null, "=", null]
          ],
          "solution": { "2,2": 6, "2,4": 2, "4,2": 3, "4,4": 20 },
          "bank": [2, 3, 6, 20]
        }
      ]
    }
  }
}
```

### Outbound — `game_complete`

```json
{
  "type": "game_complete",
  "data": {
    "metrics": {
      "accuracy": 83,
      "time": 145,
      "stars": 3,
      "livesRemaining": 1,
      "incorrectCount": 1
    },
    "attempts": [],
    "events": [],
    "signals": {},
    "metadata": {},
    "completedAt": 1700000000000
  }
}
```

---

## Section 11: End Game Triggers

| Condition | Where | Code Path |
|-----------|-------|-----------|
| All rounds completed | `advanceRound()` | `currentRound >= totalRounds → endGame()` |
| Lives exhausted | `handleNext()` | `lives <= 0 → setTimeout(endGame, 800)` |

Both paths confirmed. No dead-end states.

---

## Section 12: Verification Checklist (PART-026)

### Package Loading
- [ ] `window.gameState = {...}` — NOT `const gameState` (PART-007)
- [ ] Sentry scripts load BEFORE FeedbackManager/Components/Helpers (PART-030)
- [ ] Package order: FeedbackManager → Components → Helpers (PART-002)
- [ ] All 4 URLs use `storage.googleapis.com/test-dynamic-assets/…` exactly (PART-026 Anti-Pattern 0)
- [ ] `waitForPackages()` checks all 4 packages with 10s timeout (PART-003)
- [ ] No inline stub/polyfill for CDN packages (Anti-Pattern 20)

### Initialization
- [ ] DOMContentLoaded handler is `async` with try/catch (PART-004)
- [ ] `FeedbackManager.init()` called before SignalCollector (PART-004)
- [ ] `ScreenLayout.inject()` called before ProgressBar (PART-025)
- [ ] All game HTML inside `#gameContent` via `<template>` clone (PART-025)
- [ ] VisibilityTracker `onInactive` uses `sound.pause()` NOT `sound.stopAll()` (Anti-Pattern 19)
- [ ] `timer.pause/resume` pass `{ fromVisibilityTracker: true }` — N/A (no timer this game)
- [ ] `setupGame()` sets `startTime`, `isActive`, calls `trackEvent('game_start', 'game')` (PART-004)

### Global Scope (RULE-001)
- [ ] `handleNext`, `handlePostMessage`, `setupGame`, `renderRound`, `buildGrid`, `buildBank`, `setupDropZone`, `returnTileToBank`, `checkAllFilled`, `advanceRound`, `getCurrentQuestion`, `recordAttempt`, `trackEvent`, `endGame`, `showResults` — all defined at top-level

### CSS
- [ ] No hardcoded hex colors for feedback states (PART-020)
- [ ] `.correct` uses `var(--mathai-cell-bg-green)` + `var(--mathai-cell-border-green)` (PART-020)
- [ ] `.incorrect` uses `var(--mathai-cell-bg-red)` + `var(--mathai-cell-border-red)` (PART-020)
- [ ] `.cross-grid` has `max-width: 320px` pixel cap (Anti-Pattern 14)
- [ ] Grid cells have `overflow: hidden` (Anti-Pattern 17)
- [ ] Layout uses `100dvh` not `100vh` (Anti-Pattern 12)
- [ ] Single `<style>` block only (Anti-Pattern 11)

### Drag & Drop
- [ ] `drag-over` class removed on `dragleave` AND on successful `drop` (PART-033)
- [ ] Dropping on filled cell returns old tile to bank (Section 9.8)
- [ ] `updateCurrentAnswer()` called on each drop (PART-010)
- [ ] Next button disabled until all blanks filled (Section 9.10)

### SignalCollector (PART-010)
- [ ] `startProblem` called at each round via `renderRound()` (with deferred flush)
- [ ] Deferred `endProblem` pattern used (`gameState.pendingEndProblem`)
- [ ] `recordViewEvent` called in `renderRound`, `setupDropZone`, `showResults`, `handleNext`
- [ ] `updateCurrentAnswer` called on tile drop
- [ ] `data-signal-id` on tiles, drop zones, btn-next
- [ ] `seal()` called in `endGame` before postMessage

### End Game
- [ ] Both end conditions call `endGame()` (Section 11)
- [ ] `endGame` guard: `if (!gameState.isActive) return`
- [ ] `visibilityTracker.destroy()` + `progressBar.destroy()` called (RULE-005)
- [ ] `signalPayload` spread into postMessage data (PART-011)
- [ ] `showResults()` called before cleanup (PART-019)

### Debug
- [ ] All 8 debug functions on `window` (PART-012 + PART-030)
- [ ] `testPause`/`testResume` use `visibilityTracker.triggerInactive/triggerResume()` (Anti-Pattern, PART-012)
- [ ] `verifySentry()` uses `Sentry.getClient()` not `getCurrentHub()` (PART-030)
- [ ] `SentryConfig.enabled` checked before `Sentry.init()` (PART-030)

---

## Section 13: Test Scenarios (PART-035)

### 1. Page Load
- Game renders, grid visible, number bank visible
- ProgressBar shows 0 rounds completed, 2 hearts
- Next button is **disabled**
- Console: no errors

### 2. Drag-and-Drop — Basic
- Dragging a tile over a drop zone shows blue highlight (`.drag-over`)
- Dropping places the tile: cell shows number, tile becomes semi-transparent (`.used`)
- After filling ALL blanks: Next button **enables**

### 3. Drag-and-Drop — Swap
- Dropping a second tile onto a filled cell: old tile returns to bank (loses `.used`), new tile placed

### 4. Drag-and-Drop — Partial Fill
- After filling only some blanks: Next button remains **disabled**

### 5. Correct Submission
- All blanks correct → cells flash green → `score` increments
- After 700 ms: next round loads OR results screen if last round

### 6. Incorrect Submission
- At least one blank wrong → wrong cells shake red
- After 800 ms: wrong cells clear, wrong tiles return to bank; Next re-disables
- Lives decrement from 2 → 1

### 7. Game Over (Lives Exhausted)
- Second wrong submission: lives → 0 → `endGame()` fires → results screen shown
- `game_complete` postMessage fired

### 8. Round Advancement
- Round counter increments after correct round
- Progress bar updates correctly (rounds completed, not current)
- New puzzle grid and bank load for next round

### 9. Complete All Rounds
- Completing final round → results screen (not another round)
- Stars/accuracy calculated correctly

### 10. Results Screen
- Displays accuracy %, correct/total, lives remaining, star rating
- Play Again reloads page

### 11. PostMessage `game_init`
- Sending `game_init` resets game state and renders new content
- Invalid payload handled gracefully (falls back to fallbackContent)

### 12. Visibility / Pause
- `testPause()` → game pauses; `testResume()` → resumes
- Inactive time recorded in `duration_data`

### 13. Debug Functions
- `window.debugGame()` logs full state
- `window.debugSignals()` logs signal data
- `window.gameState` accessible in console

### 14. Layout Containment
- No game element extends beyond 480px wrapper on desktop viewport
- Grid cells do not overflow their cells

---

## Section 14: Playwright Test Scenarios (PART-037)

```
Scenario: Page loads without errors
  SETUP: Navigate to index.html
  ASSERT:
    No console errors
    #cross-grid has 25 child cells
    #number-bank has tiles
    #btn-next is disabled

Scenario: Fill all blanks enables Next
  SETUP: Count blank cells at round start
  ACTIONS:
    For each blank cell: drag a tile from bank onto it
  ASSERT:
    #btn-next is not disabled

Scenario: Correct answer advances round
  SETUP: Puzzle 2 loaded (all-addition, known solution)
  ACTIONS:
    Drag correct tiles to all blank cells
    Click #btn-next
  ASSERT:
    After 700ms: round counter incremented OR results screen shown
    .grid-cell.blank.correct visible briefly

Scenario: Incorrect answer decrements lives
  SETUP: Default puzzle
  ACTIONS:
    Drag wrong tiles to all blank cells
    Click #btn-next
  ASSERT:
    .grid-cell.blank.incorrect visible
    After 800ms: wrong cells cleared, tiles back in bank
    gameState.lives decremented

Scenario: game_complete postMessage fired on game end
  SETUP: Page with message listener
  ACTIONS:
    Play through all rounds OR lose all lives
  ASSERT:
    postMessage of type 'game_complete' received
    Payload contains metrics.accuracy (number), metrics.stars (0-3)

Scenario: game_init postMessage loads new content
  SETUP: Page loaded with fallback content
  ACTIONS:
    window.postMessage({ type: 'game_init', data: { content: {...} } }, '*')
  ASSERT:
    Grid re-renders with new content
    gameState.currentRound === 0
```

---

## Section 15: Post-Generation Steps (PART-034, PART-035, PART-037)

### PART-034 — Extract Variable Schema

After HTML generation, analyze the game code and produce:

```
math-cross-grid/inputSchema.json
```

Must include:
- Full JSON Schema for `inputSchema`
- 3 example content sets at different difficulties (easy: single-digit, medium: two-digit, hard: mixed operators)
- Field mapping showing where `grid`, `solution`, and `bank` are used in code
- Content constraints (bank length, blank cell count rules, equation validity requirements)

### PART-035 — Test Plan

After HTML generation, produce:

```
math-cross-grid/tests.md
```

15 test categories: page load, postMessage, game flow, drag-drop interactions, validation, button states, lives, visibility, metrics, results screen, layout containment, debug functions, error handling, CSS states, Sentry integration.

### PART-037 — Ralph Loop

```bash
./testing/ralph.sh math-cross-grid/ templates/math-cross-grid/spec.md
```

Final output structure:

```
math-cross-grid/
├── index.html
├── inputSchema.json
├── tests.md
└── tests/
    ├── game.spec.js
    ├── playwright.config.js
    ├── test-helpers.js
    ├── test-results.json
    └── test-output.txt
```