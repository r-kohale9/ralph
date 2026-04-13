# Addition Grid

## Game Identity

- **Title:** Addition Grid
- **Game ID:** addition-grid
- **Type:** standard
- **Description:** A 5-column, 4-row grid where the first 3 rows show addition equations (a + b = ?) and the user fills in the answers. The 4th row asks the user to calculate the column totals (sum of all a's, sum of all b's, sum of all c's).

---

## Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                         |
| -------- | ----------------------------- | --------------- | ---------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                    |
| PART-002 | Package Scripts               | YES             | —                                                    |
| PART-003 | waitForPackages               | YES             | —                                                    |
| PART-004 | Initialization Block          | YES             | —                                                    |
| PART-005 | VisibilityTracker             | YES             | default popupProps                                   |
| PART-006 | TimerComponent                | NO              | No timer needed                                      |
| PART-007 | Game State Object             | YES             | Custom fields: grid, userAnswers, currentCell        |
| PART-008 | PostMessage Protocol          | YES             | —                                                    |
| PART-009 | Attempt Tracking              | YES             | —                                                    |
| PART-010 | Event Tracking                | YES             | Custom events: cell_answered, row_complete, grid_complete |
| PART-011 | End Game & Metrics            | YES             | Stars: 3 = 6/6, 2 = >=4/6, 1 = >=1, 0 = 0            |
| PART-012 | Debug Functions               | YES             | —                                                    |
| PART-013 | Validation Fixed              | YES             | Each cell has one correct numeric answer              |
| PART-014 | Validation Function           | NO              | —                                                    |
| PART-015 | Validation LLM                | NO              | —                                                    |
| PART-016 | StoriesComponent              | NO              | —                                                    |
| PART-017 | Feedback Integration          | YES             | Audio feedback on correct/incorrect                  |
| PART-018 | Case Converter                | NO              | —                                                    |
| PART-019 | Results Screen UI             | YES             | Custom metrics: correctCells, totalCells             |
| PART-020 | CSS Variables & Colors        | YES             | —                                                    |
| PART-021 | Screen Layout CSS             | YES             | —                                                    |
| PART-022 | Game Buttons                  | YES             | Submit button per cell or global submit              |
| PART-023 | ProgressBar Component         | NO              | Grid is self-contained, no round progress needed     |
| PART-024 | TransitionScreen Component    | NO              | —                                                    |
| PART-025 | ScreenLayout Component        | YES             | slots: previewScreen=true, transitionScreen=false (preview wrapper owns layout) |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating          |
| PART-027 | Play Area Construction        | YES             | Layout: grid (5 columns x 4 rows)                   |
| PART-028 | InputSchema Patterns          | YES             | Schema type: grid equations                          |
| PART-029 | Story-Only Game               | NO              | —                                                    |
| PART-030 | Sentry Error Tracking         | YES             | —                                                    |
| PART-031 | API Helper                    | NO              | —                                                    |
| PART-032 | AnalyticsManager              | NO              | —                                                    |
| PART-033 | Interaction Patterns          | NO              | —                                                    |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json             |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                        |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle               |
| PART-038 | Interaction Manager           | NO              | —                                                    |
| PART-039 | Preview Screen                | YES (MANDATORY) | Always included — shows before game starts           |

---

## Game State

```javascript
// CRITICAL: Use window.gameState (not const) — Playwright tests access via window
window.gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 1,  // Single-round grid game
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
  grid: [],                // 4x5 grid data: [{a, op, b, eq, c}, ...] (3 equation rows + 1 totals row)
  userAnswers: {},         // Map of "row-col" → user's numeric answer (for answer cells only)
  cellStatus: {},          // Map of "row-col" → 'correct' | 'incorrect' | null
  totalAnswerCells: 6,     // 3 equation answers (rows 0-2, col 4) + 3 totals cells (row 3, cols 0, 2, 4)
  correctCells: 0,         // Count of cells answered correctly on first attempt
  allSubmitted: false,     // True when user clicks global Submit
};
const gameState = window.gameState; // Convenience alias

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let previewScreen = null;
```

---

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "previewInstruction": { "type": "string", "description": "HTML instruction shown on preview screen (PART-039 v2 mandatory)" },
    "previewAudioText": { "type": "string", "description": "Plain text for TTS audio generation (PART-039 v2 mandatory)" },
    "previewAudio": { "type": ["string", "null"], "description": "CDN URL of preview audio (PART-039 v2 mandatory; pipeline patches at build time)" },
    "showGameOnPreview": { "type": "boolean", "description": "If true, show real grid (non-interactable) under preview overlay; default false (blank space). For this game: true." },
    "equations": {
      "type": "array",
      "description": "Exactly 3 equations for rows 0-2",
      "items": {
        "type": "object",
        "properties": {
          "a": { "type": "number", "description": "First operand" },
          "b": { "type": "number", "description": "Second operand" }
        },
        "required": ["a", "b"]
      },
      "minItems": 3,
      "maxItems": 3
    }
  },
  "required": ["previewInstruction", "previewAudioText", "previewAudio", "showGameOnPreview", "equations"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  // PART-039 v2 mandatory preview fields
  previewInstruction: '<p>Fill in the missing values. Each row: <b>a + b = c</b>. The last row shows <b>column totals</b>.</p>',
  previewAudioText: 'Fill in the missing values. Each row is an equation: a plus b equals c. The last row shows the column totals.',
  previewAudio: null, // pipeline patches this with TTS-generated CDN URL post-approval
  showGameOnPreview: true, // show real grid (non-interactable) under the preview overlay
  equations: [
    { a: 12, b: 15 },  // c = 27
    { a: 23, b: 14 },  // c = 37
    { a: 31, b: 22 },  // c = 53
  ]
  // Row 4 (totals): sumA = 12+23+31 = 66, sumB = 15+14+22 = 51, sumC = 27+37+53 = 117
  // Total answer cells: 6 (3 equation answers + 3 column totals)
  // row 3 col 0 = 66, row 3 col 2 = 51, row 3 col 4 = 117
};
```

### Content Set Generation

Generate 3 content sets at different difficulty levels. Each set has exactly 3 equations.

| Difficulty | Operand Range | Carrying Required | Example |
|-----------|--------------|-------------------|---------|
| Easy | 1–9 (single digit) | No | { a: 3, b: 5 } |
| Medium | 10–50 (two digit) | Some | { a: 24, b: 33 } |
| Hard | 10–999 (two/three digit) | Yes, most require carrying | { a: 187, b: 465 } |

**Constraints for all content sets:**
- Exactly 3 equations per set
- All operands (`a`, `b`) must be positive integers
- Column totals (sumA, sumB, sumC) must be computable as simple addition — no overflow concerns for the target age group
- Avoid trivially easy patterns (e.g., all zeros, all identical equations)
- Vary the operands within each set (don't repeat the same equation)

---

## Screens

### Screen 0: Preview Screen — PART-039 v2 (MANDATORY persistent wrapper)

The PreviewScreenComponent v2 is a **persistent wrapper** for the entire game session. It is NOT a transient screen — the header bar (avatar, question label, score, star) stays fixed at the top throughout gameplay. It has two states:

1. **`preview` state** — blue progress bar (audio/5s timer), instruction text, the real game grid is visible underneath but covered by a non-interactable overlay, "Skip & show options" button at the bottom
2. **`game` state** — overlay removed (grid becomes interactable), skip button removed, header persists. Since this game has NO timer, the header progress bar is hidden and no timer text is shown

Use `showGameOnPreview: true` so the actual grid (rendered by `injectGameHTML()` before `previewScreen.show()`) shows through the overlay. Do NOT build a fake placeholder preview.

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { previewScreen: true, transitionScreen: false }
});
```

PreviewScreen instantiation (in DOMContentLoaded):
```javascript
const previewScreen = new PreviewScreenComponent({
  slotId: 'mathai-preview-slot'
});
```

**CRITICAL:** ScreenLayout v2 with `previewScreen: true` does NOT create `.game-wrapper` — the preview slot IS the wrapper, and `.game-stack` (containing `#gameContent`) lives directly inside it. Do not write CSS for `.game-wrapper`. Do not toggle its visibility.

### HTML Body Structure (PART-025)

The `<body>` contains only `<div id="app"></div>`. ScreenLayout.inject('app') with `previewScreen: true` generates the persistent preview wrapper containing `.mathai-preview-header`, `.mathai-preview-body`, `.mathai-preview-instruction`, `.mathai-preview-game-container`, and `.game-stack > #gameContent` inside it. All game screens are injected into `#gameContent` via JavaScript (innerHTML or template cloneNode) after ScreenLayout.inject() completes — and BEFORE `previewScreen.show()` is called (otherwise the preview overlay covers an empty area).

```html
<body>
  <div id="app"></div>
  <!-- game HTML injected into #gameContent by JS after ScreenLayout.inject() -->
</body>
```

### Screen 1: Game Screen (#game-screen)

```html
<!-- This HTML is injected into #gameContent -->
<!-- NOTE: NO custom .game-header — the preview wrapper's fixed header (avatar, label, score, star) is the only header -->
<!-- NOTE: NOT hidden by default — preview overlay handles non-interactability in preview state -->
<div id="game-screen">
  <div class="grid-container" id="grid-container">
    <!-- Row 0: equation row -->
    <div class="grid-cell static" data-row="0" data-col="0" id="cell-0-0"></div>
    <div class="grid-cell operator" data-row="0" data-col="1">+</div>
    <div class="grid-cell static" data-row="0" data-col="2" id="cell-0-2"></div>
    <div class="grid-cell operator" data-row="0" data-col="3">=</div>
    <div class="grid-cell answer" data-row="0" data-col="4" id="cell-0-4">
      <input type="number" class="cell-input" data-row="0" data-col="4" id="input-0-4" inputmode="numeric" />
    </div>

    <!-- Row 1: equation row -->
    <div class="grid-cell static" data-row="1" data-col="0" id="cell-1-0"></div>
    <div class="grid-cell operator" data-row="1" data-col="1">+</div>
    <div class="grid-cell static" data-row="1" data-col="2" id="cell-1-2"></div>
    <div class="grid-cell operator" data-row="1" data-col="3">=</div>
    <div class="grid-cell answer" data-row="1" data-col="4" id="cell-1-4">
      <input type="number" class="cell-input" data-row="1" data-col="4" id="input-1-4" inputmode="numeric" />
    </div>

    <!-- Row 2: equation row -->
    <div class="grid-cell static" data-row="2" data-col="0" id="cell-2-0"></div>
    <div class="grid-cell operator" data-row="2" data-col="1">+</div>
    <div class="grid-cell static" data-row="2" data-col="2" id="cell-2-2"></div>
    <div class="grid-cell operator" data-row="2" data-col="3">=</div>
    <div class="grid-cell answer" data-row="2" data-col="4" id="cell-2-4">
      <input type="number" class="cell-input" data-row="2" data-col="4" id="input-2-4" inputmode="numeric" />
    </div>

    <!-- Row 3: totals row -->
    <div class="grid-cell answer totals" data-row="3" data-col="0" id="cell-3-0">
      <input type="number" class="cell-input" data-row="3" data-col="0" id="input-3-0" inputmode="numeric" />
    </div>
    <div class="grid-cell operator totals" data-row="3" data-col="1">+</div>
    <div class="grid-cell answer totals" data-row="3" data-col="2" id="cell-3-2">
      <input type="number" class="cell-input" data-row="3" data-col="2" id="input-3-2" inputmode="numeric" />
    </div>
    <div class="grid-cell operator totals" data-row="3" data-col="3">=</div>
    <div class="grid-cell answer totals" data-row="3" data-col="4" id="cell-3-4">
      <input type="number" class="cell-input" data-row="3" data-col="4" id="input-3-4" inputmode="numeric" />
    </div>
  </div>

  <!-- Column labels for row 3 -->
  <div class="totals-label">Totals Row: Add each column</div>

  <div class="button-row">
    <button class="game-btn btn-primary" id="btn-submit" data-signal-id="submit-btn" onclick="handleSubmit()">Submit</button>
    <button class="game-btn btn-secondary" id="btn-reset" data-signal-id="reset-btn" onclick="handleReset()">Reset</button>
  </div>
</div>
```

### Screen 2: Results Screen (#results-screen)

```html
<div id="results-screen" style="display: none;">
  <!-- From PART-019 with custom metric rows -->
  <div class="results-container">
    <div class="results-stars" id="results-stars"></div>
    <div class="results-score" id="results-score"></div>
    <div class="results-metrics">
      <div class="metric-row">
        <span class="metric-label">Correct Cells</span>
        <span class="metric-value" id="metric-correct-cells"></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Total Cells</span>
        <span class="metric-value" id="metric-total-cells"></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Accuracy</span>
        <span class="metric-value" id="metric-accuracy"></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Time</span>
        <span class="metric-value" id="metric-time"></span>
      </div>
    </div>
  </div>
</div>
```

---

## CSS

```css
/* Grid layout */
.grid-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 8px;
  max-width: 420px;
  margin: 0 auto;
  padding: 16px;
}

.grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  border-radius: 8px;
  font-size: var(--mathai-font-size-xl, 1.25rem);
  font-weight: 600;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.grid-cell.static {
  background: var(--mathai-surface, #f0f4ff);
  color: var(--mathai-text, #1a1a2e);
  border: 2px solid var(--mathai-border, #d0d8e8);
}

.grid-cell.operator {
  background: transparent;
  color: var(--mathai-text-secondary, #666);
  font-size: var(--mathai-font-size-lg, 1.1rem);
  min-height: auto;
}

.grid-cell.answer {
  background: var(--mathai-white, #fff);
  border: 2px solid var(--mathai-primary, #4a90d9);
}

.grid-cell.answer.correct {
  border-color: var(--mathai-green, #4caf50);
  background: var(--mathai-green-light, #e8f5e9);
}

.grid-cell.answer.incorrect {
  border-color: var(--mathai-red, #f44336);
  background: var(--mathai-red-light, #ffebee);
}

.grid-cell.totals {
  border-style: dashed;
}

.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  text-align: center;
  font-size: var(--mathai-font-size-xl, 1.25rem);
  font-weight: 600;
  color: var(--mathai-text, #1a1a2e);
  outline: none;
  -moz-appearance: textfield;
}

.cell-input::-webkit-outer-spin-button,
.cell-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.cell-input:focus {
  outline: none;
}

.grid-cell.answer:hover {
  border-color: var(--mathai-primary-dark, #357abd);
}

.grid-cell.answer:focus-within {
  border-color: var(--mathai-primary-dark, #357abd);
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.2);
}

.grid-cell.answer.empty {
  border-color: var(--mathai-red, #f44336);
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* Totals label */
.totals-label {
  text-align: center;
  font-size: var(--mathai-font-size-sm, 0.85rem);
  color: var(--mathai-text-secondary, #666);
  margin-top: -4px;
  margin-bottom: 16px;
}

/* Correct answer reveal (shown in cell after submit) */
.correct-value {
  font-size: var(--mathai-font-size-sm, 0.8rem);
  color: var(--mathai-green, #4caf50);
  margin-top: 2px;
}

/* NOTE: No .game-header / .game-title / .game-instruction — the preview wrapper's fixed header is the only header */

/* Button row */
.button-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 16px;
}

/* Row 3 separator — visual line between equations and totals */
.grid-cell[data-row="3"] {
  margin-top: 8px;
}

/* NOTE: No .preview-placeholder needed — showGameOnPreview:true shows the real grid under the overlay */
```

---

## Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (PART-030) -->
<script>
function initSentry() {
  if (typeof SentryConfig === 'undefined' || !SentryConfig.enabled) return;
  if (typeof Sentry === 'undefined') return;
  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: SentryConfig.environment,
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
  window.addEventListener('error', function(e) {
    Sentry.captureException(e.error || new Error(e.message));
  });
  window.addEventListener('unhandledrejection', function(e) {
    Sentry.captureException(e.reason || new Error('Unhandled rejection'));
  });
  Sentry.addBreadcrumb({ message: 'Sentry initialized', level: 'info' });
}
</script>

<!-- STEP 3: Sentry SDK v10.23.0 (3 scripts, NO integrity attribute) -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- STEP 4: Initialize on load -->
<script>window.addEventListener('load', initSentry);</script>

<!-- STEP 5-7: Game packages (exact URLs, in this order) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## Game Flow

1. **Page loads** → DOMContentLoaded fires
   - waitForPackages()
   - FeedbackManager.init()
   - VisibilityTracker creation
   - ScreenLayout.inject() with previewScreen slot
   - PreviewScreenComponent creation
   - setupGame()

2. **setupGame()** runs:
   - Parse content (from postMessage or fallbackContent)
   - Build grid data: 3 equation rows + compute totals row
   - Render static cells (a values, b values) into the grid
   - Clear all input fields
   - Call showPreviewScreen()

3. **Preview screen shows:**
   - User sees game title, instruction, and content preview
   - On skip/complete → startGameAfterPreview()
   - Sets gameState.startTime, isActive = true
   - Fires 'game_start' event
   - First input field gets focus

4. **User interaction:**
   - User types numeric answers in the 6 input cells:
     - Row 0 col 4: a0 + b0 = ?
     - Row 1 col 4: a1 + b1 = ?
     - Row 2 col 4: a2 + b2 = ?
     - Row 3 col 0: a0 + a1 + a2 = ?
     - Row 3 col 2: b0 + b1 + b2 = ?
     - Row 3 col 4: c0 + c1 + c2 = ? (or equivalently sumA + sumB)
   - Tab/Enter moves focus to next input
   - User clicks "Submit" when done

5. **handleSubmit():**
   - If any input is empty, highlight empty cells with a shake animation and return (do not submit)
   - Validates all 6 cells against correct answers
   - Marks each cell as correct (green) or incorrect (red)
   - For incorrect cells: shows the correct answer below the input
   - Records one attempt per cell via recordAttempt() (empty values stored as `null`)
   - Calculates score: number of correct cells
   - Fires 'grid_complete' event
   - Disables all inputs, hides Reset button, disables Submit button
   - **This is a one-shot game — no retry after submit**
   - Calls endGame() after 500ms delay for visual feedback

6. **End condition(s) — EVERY path that calls endGame():**
   - **Submit clicked** → handleSubmit() validates all cells → endGame()
   - **There is only one end path — the Submit button**
   - endGame() calculates metrics, shows results, sends postMessage, cleans up

---

## Functions

### Global Scope (RULE-001)

**showPreviewScreen()** (PART-039 v2)

- Called from setupGame() **AFTER** `injectGameHTML()` and static cell rendering. The game DOM must already exist before show() is called, so the preview overlay covers the real grid.
- Calls:
  ```javascript
  // questionLabel, score, showStar come from game_init payload automatically
  // showGameOnPreview:true makes the real grid (already rendered into #gameContent) visible under the non-interactable overlay
  // No timerInstance/timerConfig — this game has no timer
  previewScreen.show({
    instruction: gameState.content.previewInstruction || fallbackContent.previewInstruction,
    audioUrl: gameState.content.previewAudio || fallbackContent.previewAudio || null,
    showGameOnPreview: true,
    onComplete: startGameAfterPreview
  });
  ```
- There is NO `buildPreviewGridHtml()` function in v2 — the real game grid IS the preview content.

**startGameAfterPreview(previewData)** (PART-039 v2)

- gameState.previewResult = previewData
- gameState.duration_data.preview = gameState.duration_data.preview || []
- gameState.duration_data.preview.push({ duration: previewData.duration })
- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set gameState.duration_data.startTime = new Date().toISOString()
- trackEvent('game_start', 'game')
- signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })
- Focus first input (input-0-4)
- DO NOT set `#game-screen.style.display = 'block'` — the game screen is already visible (overlay removal in switchToGame() makes it interactable)

**setupGame()**

- Parse content: gameState.content = received content or fallbackContent
- Build grid data from equations:
  ```javascript
  const eqs = gameState.content.equations;
  gameState.grid = eqs.map(eq => ({
    a: eq.a,
    b: eq.b,
    c: eq.a + eq.b
  }));
  // Compute totals
  gameState.totals = {
    sumA: eqs.reduce((s, eq) => s + eq.a, 0),
    sumB: eqs.reduce((s, eq) => s + eq.b, 0),
    sumC: eqs.reduce((s, eq) => s + eq.a + eq.b, 0)
  };
  ```
- Call `injectGameHTML()` to populate `#gameContent` with the grid markup (BEFORE showPreviewScreen — so the preview overlay covers the real grid)
- Render static cells: set text content of cell-0-0, cell-0-2, cell-1-0, cell-1-2, cell-2-0, cell-2-2
- signalCollector.recordViewEvent('content_render', { trigger: 'round_start', equations: 3 })
- Clear all inputs and reset cellStatus
- IMPORTANT: Do NOT set gameState.startTime here — it is set in startGameAfterPreview()
- Call showPreviewScreen() as the LAST step of setupGame()

**buildCorrectAnswers()**

Returns a map of answer-cell keys to correct values:
```javascript
function buildCorrectAnswers() {
  const answers = {};
  // Equation answers (col 4 for rows 0-2)
  for (let r = 0; r < 3; r++) {
    answers[`${r}-4`] = gameState.grid[r].c;
  }
  // Totals row (row 3)
  answers['3-0'] = gameState.totals.sumA;
  answers['3-2'] = gameState.totals.sumB;
  answers['3-4'] = gameState.totals.sumC;
  return answers;
}
```

**handleSubmit()**

- If !gameState.isActive, return
- Check all 6 inputs: if any is empty, highlight empty cells (add `empty` class + shake animation) and return without submitting
- Collect user answers from all 6 input fields
- Build correct answers via buildCorrectAnswers()
- For each answer cell:
  - Get user value: parseInt(input.value, 10) (if empty, treat as `null`)
  - Compare to correct value
  - Mark cell as correct or incorrect (add CSS class to parent .grid-cell)
  - If incorrect, show correct answer below input
  - Record attempt: recordAttempt({ row, col, userAnswer, correctAnswer, correct: boolean })
- Count correct cells → gameState.correctCells
- gameState.score = gameState.correctCells
- trackEvent('grid_complete', 'game', { correctCells: gameState.correctCells, totalCells: 6 })
- Disable all inputs, disable Submit button, hide Reset button
- signalCollector.recordViewEvent('feedback_display', { correctCells: gameState.correctCells, totalCells: 6 })
- Play feedback audio: if all correct → `await FeedbackManager.sound.play('celebration')`, else → `await FeedbackManager.sound.play('encouragement')`
- Call endGame() after a short delay (500ms) for visual feedback

**handleReset()**

- Only available before submit (button is hidden after submit)
- Clear all input values
- Remove all correct/incorrect/empty classes from grid cells
- Remove any correct-value labels
- Reset gameState.userAnswers = {}
- Reset gameState.cellStatus = {}
- Focus first input

**computeTriesPerRound(attempts)** (PART-011 helper)

```javascript
function computeTriesPerRound(attempts) {
  // For this grid game, all attempts are in round 0
  return [{ round: 0, triesCount: attempts.length }];
}
```

**endGame()** (PART-011)

```javascript
function endGame() {
  if (!gameState.isActive) return;
  gameState.isActive = false;
  gameState.duration_data.currentTime = new Date().toISOString();

  // Star calculation (game-specific)
  const stars = gameState.correctCells === 6 ? 3
    : gameState.correctCells >= 4 ? 2
    : gameState.correctCells >= 1 ? 1 : 0;

  const accuracy = Math.round((gameState.correctCells / 6) * 100);
  const time = (Date.now() - gameState.startTime) / 1000;

  const metrics = {
    accuracy,
    time: parseFloat(time.toFixed(1)),
    stars,
    score: gameState.correctCells,
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: 1,
    tries: computeTriesPerRound(gameState.attempts),
    correctCells: gameState.correctCells,
    totalCells: 6,
    gridEquations: 3
  };

  console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
  console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

  trackEvent('game_end', 'game', { metrics });

  // Seal SignalCollector (final flush to GCS) BEFORE postMessage
  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', { from: 'game', to: 'results' });
    signalCollector.seal();
  }

  showResults(metrics);

  // Send game_complete to parent
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics,
      attempts: gameState.attempts,
      completedAt: new Date().toISOString()
    }
  }, '*');

  // Cleanup
  if (visibilityTracker) visibilityTracker.destroy();
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
}
```

**showResults(metrics)**

- From PART-019
- Populate: #metric-correct-cells, #metric-total-cells, #metric-accuracy, #metric-time

**handleInactive()** (PART-005 — VisibilityTracker onInactive)

```javascript
function handleInactive() {
  // Record inactive start
  gameState.duration_data.inActiveTime.push({ start: Date.now() });
  // Pause SignalCollector
  if (signalCollector) {
    signalCollector.pause();
    signalCollector.recordCustomEvent('visibility_hidden', {});
  }
  // Pause audio
  FeedbackManager.sound.pause();
  FeedbackManager.stream.pauseAll();
  // Pause preview if showing
  if (previewScreen) previewScreen.pause();
  // Track event
  trackEvent('game_paused', 'system');
}
```

**handleResume()** (PART-005 — VisibilityTracker onResume)

```javascript
function handleResume() {
  // Record inactive end + accumulate total
  const inactive = gameState.duration_data.inActiveTime;
  const last = inactive[inactive.length - 1];
  if (last && !last.end) {
    last.end = Date.now();
    gameState.duration_data.totalInactiveTime += (last.end - last.start);
  }
  // Resume SignalCollector
  if (signalCollector) {
    signalCollector.resume();
    signalCollector.recordCustomEvent('visibility_visible', {});
  }
  // Resume audio
  FeedbackManager.sound.resume();
  FeedbackManager.stream.resumeAll();
  // Resume preview if showing
  if (previewScreen) previewScreen.resume();
  // Track event
  trackEvent('game_resumed', 'system');
}
```

**handlePostMessage(event)** (PART-008)

```javascript
function handlePostMessage(event) {
  if (!event.data || event.data.type !== 'game_init') return;
  var d = event.data.data;

  // Set content
  gameState.content = d.content;
  gameState.signalConfig = d.signalConfig || {};

  // Configure SignalCollector with signal config (PART-010)
  if (signalCollector && gameState.signalConfig.flushUrl) {
    signalCollector.flushUrl = gameState.signalConfig.flushUrl;
    signalCollector.playId = gameState.signalConfig.playId || null;
    signalCollector.gameId = gameState.signalConfig.gameId || signalCollector.gameId;
    signalCollector.sessionId = gameState.signalConfig.sessionId || signalCollector.sessionId;
    signalCollector.contentSetId = gameState.signalConfig.contentSetId || signalCollector.contentSetId;
    signalCollector.studentId = gameState.signalConfig.studentId || signalCollector.studentId;
    signalCollector.startFlushing();
  }

  // Re-run setupGame with real content
  setupGame();
}
```

**recordAttempt(data)** (PART-009)

```javascript
function recordAttempt({ row, col, userAnswer, correctAnswer, correct }) {
  const attempt = {
    attempt_timestamp: new Date().toISOString(),
    time_since_start_of_game: (Date.now() - gameState.startTime) / 1000,
    input_of_user: userAnswer,
    attempt_number: gameState.attempts.length + 1,
    correct: correct,
    metadata: {
      round: gameState.currentRound,
      question: `cell-${row}-${col}`,
      correctAnswer: correctAnswer,
      validationType: 'fixed'
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

**trackEvent(type, target, data)** (PART-010)

```javascript
function trackEvent(type, target, data = {}) {
  gameState.events.push({ type, target, timestamp: Date.now(), ...data });
}
```

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Wait for CDN packages (PART-003)
    await waitForPackages();

    // 2. Init FeedbackManager (PART-017)
    await FeedbackManager.init();

    // 3. Preload audio (PART-017)
    await FeedbackManager.sound.preload([
      { id: 'celebration', url: 'https://cdn.mathai.ai/audio/celebration.mp3' },
      { id: 'encouragement', url: 'https://cdn.mathai.ai/audio/encouragement.mp3' }
    ]);

    // 4. Create SignalCollector (PART-010)
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      gameId: 'addition-grid',
      contentSetId: null
    });
    window.signalCollector = signalCollector;

    // 5. ScreenLayout (PART-025) — previewScreen:true creates the persistent wrapper containing .game-stack
    ScreenLayout.inject('app', {
      slots: { previewScreen: true, transitionScreen: false }
    });

    // 6. Create VisibilityTracker (PART-005) — AFTER SignalCollector
    visibilityTracker = new VisibilityTracker({
      onInactive: handleInactive,
      onResume: handleResume,
      popupProps: {
        title: 'Game Paused',
        description: 'Click Resume to continue.',
        primaryText: 'Resume'
      }
    });
    window.visibilityTracker = visibilityTracker;

    // 7. Create PreviewScreen (PART-039 v2 — persistent wrapper)
    previewScreen = new PreviewScreenComponent({
      slotId: 'mathai-preview-slot'
    });

    // 8. Register postMessage listener (PART-008) + send game_ready
    window.addEventListener('message', handlePostMessage);
    window.parent.postMessage({ type: 'game_ready' }, '*');

    // 9. Setup game with fallback content
    setupGame();

  } catch (err) {
    console.error('Init failed:', JSON.stringify(err.message));
    if (typeof Sentry !== 'undefined') Sentry.captureException(err);
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = () => console.log('gameState:', JSON.stringify(gameState, null, 2));
window.debugAudio = () => {
  console.log('Sound:', JSON.stringify(FeedbackManager.sound.getState()));
  console.log('Stream:', JSON.stringify(FeedbackManager.stream.getState()));
};
window.testAudio = async (id) => {
  try { await FeedbackManager.sound.play(id); console.log('Played:', id); }
  catch (e) { console.error('Audio error:', e.message); }
};
window.testPause = () => visibilityTracker?.triggerInactive();
window.testResume = () => visibilityTracker?.triggerResume();
window.debugSignals = () => {
  if (signalCollector) {
    signalCollector.debug();
    console.log('Signal events:', JSON.stringify(signalCollector.getInputEventsCount?.() || 'n/a'));
  }
};
window.verifySentry = () => {
  const client = typeof Sentry !== 'undefined' ? Sentry.getClient() : null;
  console.log('Sentry loaded:', typeof Sentry !== 'undefined');
  console.log('Sentry initialized:', !!client);
  console.log('DSN:', client?.getDsn?.()?.toString() || 'none');
};
window.testSentry = () => { throw new Error('Test Sentry error from addition-grid'); };
```

---

## Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event      | Target | When Fired                  |
| ---------- | ------ | --------------------------- |
| game_start | game   | startGameAfterPreview() runs |
| game_end   | game   | endGame() fires             |

### Game-Specific Events

| Event         | Target | When Fired              | Data                                        |
| ------------- | ------ | ----------------------- | ------------------------------------------- |
| cell_focus    | grid   | User focuses an input   | { row, col }                                |
| grid_complete | game   | Submit button clicked   | { correctCells, totalCells, accuracy }      |

---

## Scaffold Points

| Point            | Function       | When                     | What Can Be Injected                        |
| ---------------- | -------------- | ------------------------ | ------------------------------------------- |
| after_incorrect  | handleSubmit() | A cell is marked wrong   | Hint showing the addition, visual highlight |
| before_game      | setupGame()    | Grid is rendered         | Strategy tip for column addition            |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default

---

## Feedback Triggers

| Moment              | Trigger Function | Feedback Type               | Notes                            |
| ------------------- | ---------------- | --------------------------- | -------------------------------- |
| All cells correct   | handleSubmit()   | celebration sound + sticker | All 6 cells correct — only audio moment |
| Some incorrect      | handleSubmit()   | encouragement sound         | At least 1 cell wrong — only audio moment |

> **Note:** Audio plays only once in handleSubmit(). showResults() does NOT play audio — avoids duplicate sounds since endGame is called 500ms after handleSubmit feedback.

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
const FEEDBACK_IDS = {
  correct: 'correct_answer',
  incorrect: 'incorrect_answer',
  celebration: 'celebration',
  encouragement: 'encouragement',
};
```

---

## Visual Specifications

- **Layout:** CSS Grid, 5 columns (1fr auto 1fr auto 1fr), max-width 420px centered
- **Color palette:** primary (#4a90d9), success green (#4caf50), error red (#f44336), surface (#f0f4ff), white (#fff)
- **Typography:** system font stack, title 1.5rem, cell values 1.25rem bold, labels 0.85rem
- **Spacing:** grid gap 8px, container padding 16px, button row gap 12px
- **Interactive states:** focus ring on inputs (blue shadow), correct (green border + bg), incorrect (red border + bg)
- **Transitions:** border-color and background 0.2s ease
- **Responsive:** max-width 420px, grid cells flex with 1fr columns, inputs use full cell width
- **Row 3 distinction:** dashed border on totals row cells to visually separate from equations

---

## Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Preview wrapper displays and transitions to game state (PART-039 v2)

SETUP: Page loaded
ACTIONS:
wait for .mathai-preview-header to be visible
assert .mathai-preview-instruction is visible
assert .mathai-preview-skip-btn is visible
assert .mathai-preview-overlay exists (game is non-interactable)
assert #game-screen exists in DOM and is visible (real grid is showing under overlay since showGameOnPreview:true)
try to click #input-0-4 → should NOT receive focus (overlay blocks pointer events)
click .mathai-preview-skip-btn
ASSERT:
.mathai-preview-header is STILL visible (header persists in game state)
.mathai-preview-skip-btn is no longer in DOM (removed in game state)
.mathai-preview-overlay is no longer in DOM (removed → game becomes interactable)
.mathai-preview-header-progress has class "hidden" (no timer in this game)
gameState.isActive === true
gameState.startTime is set (> 0)
previewScreen.getState() === 'game'
click #input-0-4 → input receives focus
EXPECTED: Preview wrapper persists, skip transitions to game state, header stays visible, game becomes interactable

### Scenario: Grid renders with correct static values

SETUP: Page loaded, click .mathai-preview-skip-btn to enter game state
ACTIONS:
wait for #game-screen to be visible
ASSERT:
#cell-0-0 text content is "12" (fallback a0)
#cell-0-2 text content is "15" (fallback b0)
#cell-1-0 text content is "23" (fallback a1)
#cell-1-2 text content is "14" (fallback b1)
#cell-2-0 text content is "31" (fallback a2)
#cell-2-2 text content is "22" (fallback b2)
all 6 input fields (#input-0-4, #input-1-4, #input-2-4, #input-3-0, #input-3-2, #input-3-4) are empty
EXPECTED: Static cells show equation operands, input cells are empty

### Scenario: Complete game with all correct answers

SETUP: Page loaded, click .mathai-preview-skip-btn to enter game state
ACTIONS:
fill #input-0-4 with "27"
fill #input-1-4 with "37"
fill #input-2-4 with "53"
fill #input-3-0 with "66"
fill #input-3-2 with "51"
fill #input-3-4 with "117"
click #btn-submit
wait for #results-screen to be visible
ASSERT:
all .grid-cell.answer elements have class "correct"
no .grid-cell.answer elements have class "incorrect"
gameState.correctCells === 6
#results-screen is visible
#game-screen is hidden or results overlay visible
stars display shows 3 stars
#metric-accuracy text contains "100%"

### Scenario: Submit with some incorrect answers

SETUP: Page loaded, click .mathai-preview-skip-btn to enter game state
ACTIONS:
fill #input-0-4 with "27"   (correct)
fill #input-1-4 with "99"   (incorrect — correct is 37)
fill #input-2-4 with "53"   (correct)
fill #input-3-0 with "66"   (correct)
fill #input-3-2 with "51"   (correct)
fill #input-3-4 with "100"  (incorrect — correct is 117)
click #btn-submit
ASSERT:
#cell-0-4 has class "correct"
#cell-1-4 has class "incorrect"
#cell-2-4 has class "correct"
#cell-3-0 has class "correct"
#cell-3-2 has class "correct"
#cell-3-4 has class "incorrect"
gameState.correctCells === 4
gameState.attempts.length === 6
results screen shows 1 or 2 stars (not 3)

### Scenario: Submit with all incorrect answers

SETUP: Page loaded, click .mathai-preview-skip-btn to enter game state
ACTIONS:
fill #input-0-4 with "1"
fill #input-1-4 with "1"
fill #input-2-4 with "1"
fill #input-3-0 with "1"
fill #input-3-2 with "1"
fill #input-3-4 with "1"
click #btn-submit
ASSERT:
all .grid-cell.answer elements have class "incorrect"
gameState.correctCells === 0
stars display shows 0 stars

### Scenario: Reset clears all input

SETUP: Page loaded, game started, user has typed values
ACTIONS:
fill #input-0-4 with "27"
fill #input-1-4 with "37"
click #btn-reset
ASSERT:
all .cell-input values are empty ("")
no .grid-cell.answer elements have class "correct" or "incorrect"
#input-0-4 has focus

### Scenario: Submit button disabled after submission

SETUP: Complete game (submit all answers)
ACTIONS:
fill all inputs with correct answers
click #btn-submit
ASSERT:
#btn-submit is disabled
all .cell-input elements are disabled (readonly)
cannot type in any input field

### Scenario: Game ends and sends postMessage

SETUP: Complete game with all correct answers
ACTIONS:
fill all inputs correctly, click #btn-submit
ASSERT:
gameState.isActive === false
game_complete postMessage sent with:
  metrics.accuracy === 100
  metrics.stars === 3
  metrics.score === 6
  metrics.attempts.length === 6
  each attempt has: attempt_timestamp, time_since_start, input_of_user, correct, attempt_number

### Scenario: Preview header persists through results screen (PART-039 v2)

SETUP: Page loaded, click .mathai-preview-skip-btn to enter game state
ACTIONS:
fill all 6 inputs with correct answers
click #btn-submit
wait for #results-screen to be visible
ASSERT:
.mathai-preview-header is STILL visible (the preview wrapper persists through the entire game including results)
.mathai-preview-skip-btn is NOT in DOM
.mathai-preview-overlay is NOT in DOM
#results-screen is visible inside the persistent wrapper
EXPECTED: The preview wrapper persists from page load → preview → game → results. Header is fixed at top throughout.

### Scenario: Tab navigation between input cells

SETUP: Page loaded, game started
ACTIONS:
click #input-0-4
press Tab
ASSERT: #input-1-4 has focus
press Tab
ASSERT: #input-2-4 has focus
press Tab
ASSERT: #input-3-0 has focus
press Tab
ASSERT: #input-3-2 has focus
press Tab
ASSERT: #input-3-4 has focus

---

## Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Body contains only `<div id="app"></div>` — game HTML injected into #gameContent by JS (PART-025)
- [ ] Package scripts in correct order: SentryConfig → initSentry → Sentry SDK → FeedbackManager → Components → Helpers (PART-002, PART-030)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] #game-screen element exists
- [ ] #results-screen element exists, hidden by default
- [ ] Grid has exactly 20 cells (5 columns x 4 rows)
- [ ] 6 input fields exist: #input-0-4, #input-1-4, #input-2-4, #input-3-0, #input-3-2, #input-3-4
- [ ] Interactive elements have `data-signal-id` attributes (PART-010)

### Functional

- [ ] `window.gameState` (not const) with all mandatory + game-specific fields (PART-007)
- [ ] waitForPackages() checks FeedbackManager, PreviewScreenComponent, VisibilityTracker, SignalCollector with 10s timeout (PART-003) — NO TimerComponent (this game has no timer)
- [ ] DOMContentLoaded async with try/catch, calls: waitForPackages → FeedbackManager.init → sound.preload → SignalCollector → ScreenLayout.inject → VisibilityTracker → PreviewScreen → postMessage listener → game_ready → setupGame (PART-004)
- [ ] VisibilityTracker onInactive: records inActiveTime, pauses SignalCollector + audio + streams (PART-005)
- [ ] VisibilityTracker onResume: records end time + totalInactiveTime, resumes SignalCollector + audio + streams (PART-005)
- [ ] VisibilityTracker uses `FeedbackManager.sound.pause()/resume()` NOT `stopAll()` (PART-005)
- [ ] SignalCollector instantiated with sessionId, studentId, gameId, contentSetId (PART-010)
- [ ] handlePostMessage sets SignalCollector config (all 6 properties) + calls startFlushing() (PART-008)
- [ ] `game_ready` postMessage sent AFTER listener registered (PART-008)
- [ ] setupGame has fallback content for standalone testing (PART-008)
- [ ] recordAttempt pushes to both gameState.attempts AND duration_data.attempts (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] signalCollector.recordViewEvent called in: setupGame (content_render), startGameAfterPreview (screen_transition), handleSubmit (feedback_display), endGame (screen_transition) (PART-010)
- [ ] endGame: guard isActive, seal SignalCollector BEFORE postMessage, send game_complete, destroy visibilityTracker, stopAll audio/streams (PART-011)
- [ ] computeTriesPerRound returns array of { round, triesCount } (PART-011)
- [ ] **Submit is the only end path — and it always calls endGame()**
- [ ] Debug functions: debugGame, debugAudio, testAudio, testPause (triggerInactive), testResume (triggerResume), debugSignals, verifySentry, testSentry (PART-012)
- [ ] FeedbackManager.sound.preload() with array of {id, url} objects — NOT register() (PART-017)
- [ ] showResults populates all fields (PART-019)
- [ ] InputSchema defined with fallback content (PART-028)
- [ ] Sentry init checks SentryConfig.enabled, uses v10+ SDK, adds error handlers + breadcrumbs (PART-030)
- [ ] No anti-patterns present (PART-026): no new Audio(), no sound.register(), no stopAll in VisibilityTracker, no inline SignalCollector stub, no 100vh, no hardcoded colors, no functions inside DOMContentLoaded

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors (PART-020)
- [ ] Gameplay feedback uses correct colors — green for correct, red for incorrect (PART-020)
- [ ] `.page-center` / `#mathai-preview-slot` (preview wrapper) / `.game-stack` layout structure (PART-021 + PART-039 v2) — NO `.game-wrapper`
- [ ] Max-width 480px, uses 100dvh not 100vh (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` classes (PART-022)
- [ ] ScreenLayout.inject() called before PreviewScreen (PART-025)

### Rules Compliance

- [ ] RULE-001: All onclick handlers in global scope (handleSubmit, handleReset)
- [ ] RULE-002: All async functions have async keyword
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame
- [ ] RULE-006: No new Audio(), setInterval for timer, SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific

- [ ] Static cells (col 0, col 2 for rows 0-2) display correct operand values
- [ ] Operator cells (col 1 = "+", col 3 = "=") are static text, not editable
- [ ] Row 3 (totals) has dashed border styling to distinguish from equation rows
- [ ] Correct answers computed: col 4 = a + b, row 3 col 0 = sum of a's, row 3 col 2 = sum of b's, row 3 col 4 = sum of c's
- [ ] All 6 answer cells validated on submit
- [ ] Incorrect cells show the correct answer after submit
- [ ] Inputs accept only numeric values (type="number", inputmode="numeric")
- [ ] Tab order flows naturally: input-0-4 → input-1-4 → input-2-4 → input-3-0 → input-3-2 → input-3-4
- [ ] Reset clears all inputs and removes all correct/incorrect styling
- [ ] Reset button is hidden after Submit (one-shot game, no retry)
- [ ] Empty inputs are highlighted with shake animation on submit attempt
- [ ] Submit is blocked if any input is empty
- [ ] Audio plays only in handleSubmit, NOT again in showResults

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
