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
| PART-001 | HTML Shell                    | YES             | ---                                                                          |
| PART-002 | Package Scripts               | YES             | ---                                                                          |
| PART-003 | waitForPackages               | YES             | Checks: FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector, ScreenLayout, ProgressBarComponent, TransitionScreenComponent, PreviewScreenComponent, InteractionManager |
| PART-004 | Initialization Block          | YES             | ---                                                                          |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                          |
| PART-006 | TimerComponent                | YES             | timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false       |
| PART-007 | Game State Object             | YES             | Custom fields: lives, totalLives, chainIndex, currentChain, selectedCells    |
| PART-008 | PostMessage Protocol          | YES             | ---                                                                          |
| PART-009 | Attempt Tracking              | YES             | ---                                                                          |
| PART-010 | Event Tracking & SignalCollector | YES          | Custom events: cell_selected, chain_complete, life_lost, round_complete      |
| PART-011 | End Game & Metrics            | YES             | Stars = lives remaining (lives-based, not accuracy-based)                    |
| PART-012 | Debug Functions               | YES             | ---                                                                          |
| PART-013 | Validation Fixed              | NO              | ---                                                                          |
| PART-014 | Validation Function           | YES             | Rule: clicked value must equal currentChain[chainIndex]                      |
| PART-015 | Validation LLM                | NO              | ---                                                                          |
| PART-016 | StoriesComponent              | NO              | ---                                                                          |
| PART-017 | Feedback Integration          | YES             | Audio feedback for correct/incorrect taps and completion                      |
| PART-018 | Case Converter                | NO              | ---                                                                          |
| PART-019 | Results Screen UI             | YES             | Custom metrics: Rounds completed, Lives remaining                            |
| PART-020 | CSS Variables & Colors        | YES             | ---                                                                          |
| PART-021 | Screen Layout CSS             | YES             | CSS only (HTML auto-injected by PART-025)                                    |
| PART-022 | Game Buttons                  | YES             | No Submit/Retry -- direct cell tap validation. Reset + Next used.            |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 5, totalLives: 3                                                |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game-over, level                                    |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, previewScreen=true, transitionScreen=true           |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist, not code-generating                                  |
| PART-027 | Play Area Construction        | YES             | Layout: 3x3 grid                                                            |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with chain + grid + distractors                          |
| PART-029 | Story-Only Game               | NO              | ---                                                                          |
| PART-030 | Sentry Error Tracking         | YES             | Error monitoring for every game                                              |
| PART-031 | API Helper                    | NO              | ---                                                                          |
| PART-032 | AnalyticsManager              | NO              | ---                                                                          |
| PART-033 | Interaction Patterns          | YES             | Patterns: grid (3x3 clickable cells)                                         |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                     |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                       |
| PART-038 | InteractionManager            | YES             | selector: '.game-play-area', disableOnAudioFeedback: true                    |
| PART-039 | Preview Screen                | YES (MANDATORY) | Always included -- shows before game starts                                  |

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
  previewResult: null,   // Stores preview screen completion data
  gameId: 'doubles_chain',
  contentSetId: null
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
let previewScreen = null;
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
    },
    "previewInstruction": {
      "type": "string",
      "description": "HTML instruction text shown on the preview screen before game starts"
    },
    "previewAudioText": {
      "type": "string",
      "description": "Narration text for TTS generation (pipeline reads this at build time)"
    },
    "previewAudio": {
      "type": "string",
      "description": "CDN URL of generated preview audio (null if not yet generated)"
    },
    "previewContent": {
      "type": "object",
      "description": "Data for the interactive preview content area (yes/no challenge question)",
      "properties": {
        "question": { "type": "string", "description": "Challenge question text" },
        "options": { "type": "array", "items": { "type": "string" }, "description": "Answer options" }
      },
      "required": ["question", "options"]
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  // Preview screen defaults (PART-039)
  previewInstruction: '<p><b>Find the doubles chain!</b></p><p>Tap numbers in order -- each number is <b>double</b> the one before it. Start with the smallest number in the chain.</p>',
  previewAudioText: 'Find the doubles chain! Tap numbers in order. Each number is double the one before it. Start with the smallest number in the chain.',
  previewAudio: null,
  previewContent: {
    question: 'Can you do this in under 180 seconds?',
    options: ['Yes', 'No']
  },

  // Game rounds
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

Generate **3 content sets** at different difficulty levels. All sets must have exactly 5 rounds. Structure: rounds 1-2 = chain of 3, rounds 3-4 = chain of 4, round 5 = chain of 5.

| Dimension | Easy | Medium | Hard |
|---|---|---|---|
| Starting numbers (rounds 1-2) | 1-5 | 3-15 | 8-25 |
| Starting numbers (rounds 3-4) | 1-8 | 5-20 | 10-40 |
| Starting number (round 5) | 1-5 | 3-12 | 6-20 |
| Max value in chain | 64 | 320 | 1280 |

**Constraints all content sets must satisfy:**
- Each `chain` is an ascending sequence where `chain[i+1] === chain[i] * 2`
- Grid is always 3x3 (9 cells total)
- Grid must contain every number in the chain exactly once
- Remaining grid cells are distractors -- positive integers, no duplicates within the grid, and no distractor may equal any chain value
- Distractors should be plausible (similar magnitude to chain values) to avoid being trivially eliminated
- No duplicate numbers within a single grid (all 9 values unique)
- Chain numbers must not appear in positional order (left-to-right, top-to-bottom) -- they should be scattered across the grid
- Each content set should use different starting numbers (not just reorder the same chains)

**Distractor quality rules:**
- At least 2 distractors per grid should be within +/-50% of a chain value (near-misses)
- No distractor should be exactly double or half of any chain value (would create a false chain)
- Distractors must be positive integers >= 1

**Preview fields per content set:**
- `previewInstruction`: HTML string with bold/images describing the game task
- `previewAudioText`: Plain text narration for TTS generation
- `previewAudio`: null (pipeline generates audio URL at build time)
- `previewContent`: `{ question: "Can you do this in under 180 seconds?", options: ["Yes", "No"] }` — interactive yes/no challenge question shown below the instruction. Game code merges this data with `renderPreviewContent()` to produce HTML with clickable buttons. User's choice is captured via `previewScreen.setPreviewData('userChoice', choice)` and included in `gameState.previewResult` → `game_complete` payload.

---

## 5. Screens & HTML Structure

### Screen 0: Preview Screen -- PART-039 (MANDATORY)

The PreviewScreenComponent (loaded via CDN package) handles all preview UI.
No custom HTML needed -- the component creates its own DOM in the ScreenLayout preview slot.

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { progressBar: true, previewScreen: true, transitionScreen: true }
});
```

PreviewScreen instantiation (in DOMContentLoaded):
```javascript
previewScreen = new PreviewScreenComponent({
  autoInject: true,
  slotId: 'mathai-preview-slot',
  gameContentId: 'gameContent'
});
```

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

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() {
  try {
    if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled && typeof Sentry !== 'undefined') {
      Sentry.init({
        dsn: SentryConfig.dsn,
        environment: SentryConfig.environment,
        release: 'doubles-chain@1.0.0',
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
  } catch (e) {
    console.error('Sentry init error:', JSON.stringify({ error: e.message }, null, 2));
  }
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

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - `waitForPackages()` -- checks FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector, ScreenLayout, ProgressBarComponent, TransitionScreenComponent, PreviewScreenComponent, InteractionManager
   - `FeedbackManager.init()`
   - SignalCollector created and assigned to `window.signalCollector`
   - `ScreenLayout.inject('app', { slots: { progressBar: true, previewScreen: true, transitionScreen: true } })`
   - Clone `#game-template` into `#gameContent`
   - ProgressBarComponent created (totalRounds: 5, totalLives: 3)
   - TransitionScreenComponent created
   - PreviewScreenComponent created (autoInject: true, slotId: 'mathai-preview-slot', gameContentId: 'gameContent')
   - TimerComponent created (type: 'increase', startTime: 0, endTime: 100000, autoStart: false)
   - InteractionManager created (selector: '.game-play-area') and assigned to `window.interactionManager`
   - Audio preloaded: correct_tap, wrong_tap
   - VisibilityTracker created with onInactive/onResume (wires previewScreen.pause/resume)
   - Register postMessage listener: `window.addEventListener('message', handlePostMessage)`
   - Send `game_ready` postMessage to parent
   - Call `setupGame()` directly (NO start TransitionScreen — preview IS the first screen)

2. **Preview screen** (PART-039) -> shows instruction, audio, timer bar
   - `setupGame()` runs:
     - Load content from `gameState.content` or `fallbackContent`
     - Reset all game state: currentRound=0, score=0, lives=3, attempts=[], events=[], chainIndex=0, selectedCells=[], previewResult=null
     - IMPORTANT: Do NOT set `gameState.startTime` here -- it is set in `startGameAfterPreview()`
     - IMPORTANT: Do NOT set `gameState.isActive` here -- it is set in `startGameAfterPreview()`
     - Update progressBar: `progressBar.update(0, 3)`
     - Call `showPreviewScreen()`
   - `showPreviewScreen()` shows instruction, audio, timer bar
   - `showPreviewScreen()` calls `previewScreen.show({ instruction, audioUrl, previewContent, onComplete: startGameAfterPreview })` (questionLabel, score, showStar come from game_init automatically)
   - User watches/listens or clicks "Skip & show options"
   - On complete: `startGameAfterPreview(previewData)` runs:
     - Store `gameState.previewResult = previewData`
     - Track preview duration in `gameState.duration_data.preview`
     - NOW set `gameState.startTime = Date.now()`
     - NOW set `gameState.isActive = true`
     - Set `gameState.duration_data.startTime = new Date().toISOString()`
     - Start timer: `timer.start()`
     - `trackEvent('game_start', 'game')`
     - `signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })`
     - Call `renderRound()`

4. **renderRound()** -- renders the current round:
   - Get round data from `gameState.content.rounds[gameState.currentRound]`
   - Set `currentChain`, `gridData`, `chainLength`, reset `chainIndex=0`, `selectedCells=[]`
   - Update round title ("Round X"), instruction text ("Find the chain of N doubles!")
   - Update chain progress display (shows "? -> ? -> ?")
   - Create 3x3 grid cells via `createGrid(3, 3, gridData)` -- each cell has `data-row`, `data-col`, `data-value`, `data-signal-id` and a click listener calling `handleCellClick(row, col)`
   - Record `signalCollector.recordViewEvent('content_render', ...)` with round info
   - Show game screen, hide feedback, show Reset button, hide Next button

5. **User interaction loop -- handleCellClick(row, col):**
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

6. **handleNext() -- advance to next round:**
   - Increment `gameState.currentRound`
   - Update progressBar: `progressBar.update(currentRound, lives)`
   - **If currentRound >= totalRounds:** call `endGame()`
   - **Else:**
     - Show level transition screen ("Round X+1!" / "Chain of N doubles") with `duration: 2000` (auto-hide, no buttons)
     - After 2100ms: show game screen and call `renderRound()`

7. **End condition(s) -- EVERY path that calls endGame():**
   - **Trigger 1:** All 5 rounds completed -> `handleNext()` calls `endGame()` when `currentRound >= totalRounds`
   - **Trigger 2:** All lives lost -> `handleCellClick()` calls `endGame()` when `lives <= 0`
   - `endGame()` calculates metrics (lives-based stars), seals signalCollector, shows victory/game-over TransitionScreen, sends postMessage, cleans up
   - **There is NO dead-end game state.** Every wrong answer decrements lives toward endGame. Every correct chain completion leads to handleNext toward endGame.

---

## 9. Functions

### Global Scope (RULE-001)

**waitForPackages()**

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();
  const packages = [
    'FeedbackManager', 'TimerComponent', 'VisibilityTracker',
    'SignalCollector', 'ScreenLayout', 'ProgressBarComponent',
    'TransitionScreenComponent', 'PreviewScreenComponent', 'InteractionManager'
  ];
  try {
    for (var i = 0; i < packages.length; i++) {
      while (typeof window[packages[i]] === 'undefined') {
        if (Date.now() - start > timeout) throw new Error('Package timeout: ' + packages[i]);
        await new Promise(function(r) { setTimeout(r, 50); });
      }
    }
    console.log('All packages loaded');
  } catch (error) {
    console.error('Package loading failed:', JSON.stringify({ error: error.message }, null, 2));
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Failed to load. Please refresh.</div>';
    throw error;
  }
}
```

**showPreviewScreen()**

Called from `setupGame()` after resetting state. Shows the PART-039 preview screen with instruction and optional audio.

```javascript
function renderPreviewContent(data) {
  if (!data || !data.question || !data.options) return null;
  var html = '<div style="margin-top:24px;text-align:center;">';
  html += '<p style="font-size:18px;font-weight:600;color:#270F36;margin-bottom:16px;">' + data.question + '</p>';
  html += '<div style="display:flex;gap:12px;justify-content:center;">';
  for (var i = 0; i < data.options.length; i++) {
    var opt = data.options[i];
    var color = opt.toLowerCase() === 'yes' ? '#667eea' : '#e74c3c';
    var bg = opt.toLowerCase() === 'yes' ? '#f0f2ff' : '#fff5f5';
    html += '<button onclick="previewScreen.setPreviewData(\'userChoice\',\'' + opt + '\')" ' +
      'style="flex:1;max-width:120px;padding:14px 24px;font-size:16px;font-weight:600;' +
      'border:2px solid ' + color + ';border-radius:12px;background:' + bg + ';cursor:pointer;">' + opt + '</button>';
  }
  html += '</div></div>';
  return html;
}

function showPreviewScreen() {
  var content = gameState.content || fallbackContent;
  var previewData = content.previewContent || fallbackContent.previewContent;
  // questionLabel, score, showStar come from game_init payload automatically
  previewScreen.show({
    instruction: content.previewInstruction || fallbackContent.previewInstruction,
    audioUrl: content.previewAudio || null,
    previewContent: renderPreviewContent(previewData),
    onComplete: function(previewData) {
      startGameAfterPreview(previewData);
    }
  });
}
```

**startGameAfterPreview(previewData)**

CRITICAL: `gameState.startTime` must NOT be set until preview ends.

```javascript
function startGameAfterPreview(previewData) {
  // Store preview result for game_complete payload
  gameState.previewResult = previewData;

  // Track preview duration
  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  // NOW start the actual game
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (timer) timer.start();
  trackEvent('game_start', 'game');

  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });
  }

  renderRound();
}
```

**setupGame()**

```javascript
function setupGame() {
  if (!gameState.content) {
    gameState.content = fallbackContent;
  }

  // Reset all state
  // IMPORTANT: Do NOT set gameState.startTime here -- set in startGameAfterPreview()
  // IMPORTANT: Do NOT set gameState.isActive here -- set in startGameAfterPreview()
  gameState.startTime = null;
  gameState.isActive = false;
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.lives = 3;
  gameState.totalLives = 3;
  gameState.chainIndex = 0;
  gameState.selectedCells = [];
  gameState.currentChain = [];
  gameState.gridData = [];
  gameState.isProcessing = false;
  gameState.previewResult = null;
  gameState.attempts = [];
  gameState.events = [];
  gameState.duration_data.startTime = null;
  gameState.duration_data.preview = [];
  gameState.duration_data.attempts = [];
  gameState.duration_data.evaluations = [];
  gameState.duration_data.inActiveTime = [];
  gameState.duration_data.totalInactiveTime = 0;
  gameState.duration_data.currentTime = null;

  if (progressBar) progressBar.update(0, gameState.lives);

  // Show preview screen instead of starting game directly (PART-039)
  showPreviewScreen();
}
```

**renderRound()**

```javascript
function renderRound() {
  var roundData = gameState.content.rounds[gameState.currentRound];
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
  var grid = document.getElementById('game-grid');
  grid.style.setProperty('--cols', cols);
  grid.innerHTML = '';

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.dataset.value = data[r][c];
      cell.setAttribute('data-signal-id', 'cell-' + r + '-' + c);
      cell.textContent = data[r][c];
      (function(row, col) {
        cell.addEventListener('click', function() { handleCellClick(row, col); });
      })(r, c);
      grid.appendChild(cell);
    }
  }
}
```

**handleCellClick(row, col)** -- async, RULE-002

```javascript
async function handleCellClick(row, col) {
  if (!gameState.isActive || gameState.isProcessing) return;

  var cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
  if (!cell || cell.classList.contains('chain-found') || cell.classList.contains('disabled')) return;

  gameState.isProcessing = true;

  var value = Number(cell.dataset.value);
  var expected = gameState.currentChain[gameState.chainIndex];
  var isCorrect = (value === expected);

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
  var el = document.getElementById('chain-progress');
  if (!el) return;
  var parts = [];
  for (var i = 0; i < gameState.currentChain.length; i++) {
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
  var area = document.getElementById('feedback-area');
  var text = document.getElementById('feedback-text');
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

  // Reset grid visual state (does NOT restore lives)
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

  var correct = gameState.attempts.filter(function(a) { return a.correct; }).length;
  var total = gameState.attempts.length;
  var accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  var timeTaken = timer ? timer.getTimeTaken() : Math.round((Date.now() - gameState.startTime) / 1000);

  // Lives-based stars (NOT accuracy-based)
  var stars = gameState.lives >= 3 ? 3 : gameState.lives >= 2 ? 2 : gameState.lives >= 1 ? 1 : 0;

  var metrics = {
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
  var won = gameState.currentRound >= gameState.totalRounds;

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
      completedAt: Date.now(),
      previewResult: gameState.previewResult || null
    }
  }, '*');

  // Cleanup (RULE-005)
  if (timer) { timer.destroy(); timer = null; }
  if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
  if (progressBar) { progressBar.destroy(); progressBar = null; }
  if (previewScreen) { previewScreen.destroy(); previewScreen = null; }
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

  // Call setupGame which resets state and shows preview screen (PART-039)
  setupGame();
}
```

**recordAttempt(data)** -- from PART-009

```javascript
function recordAttempt(data) {
  var attempt = {
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
window.addEventListener("DOMContentLoaded", async function() {
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

    // ScreenLayout (PART-025) -- includes previewScreen slot
    var layout = ScreenLayout.inject('app', {
      slots: { progressBar: true, previewScreen: true, transitionScreen: true }
    });

    // Clone game template into gameContent
    var gameContent = document.getElementById('gameContent');
    var template = document.getElementById('game-template');
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

    // PreviewScreen (PART-039)
    previewScreen = new PreviewScreenComponent({
      autoInject: true,
      slotId: 'mathai-preview-slot',
      gameContentId: 'gameContent'
    });

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
    var interactionManager = new InteractionManager({
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

    // VisibilityTracker (PART-005) -- includes previewScreen pause/resume (PART-039)
    visibilityTracker = new VisibilityTracker({
      onInactive: function() {
        var inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        if (previewScreen) previewScreen.pause();
        if (timer) timer.pause({ fromVisibilityTracker: true });
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
        trackEvent('game_paused', 'system');
      },
      onResume: function() {
        var lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
        if (lastInactive && !lastInactive.end) {
          lastInactive.end = Date.now();
          gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
        }
        if (signalCollector) {
          signalCollector.resume();
          signalCollector.recordCustomEvent('visibility_visible', {});
        }
        if (previewScreen) previewScreen.resume();
        if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
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

    // Call setupGame() directly — preview screen IS the first screen (PART-039)
    // No start TransitionScreen — it would flash briefly before preview takes over
    setupGame();

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
    if (previewScreen) previewScreen.pause();
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
    if (previewScreen) previewScreen.resume();
    if (timer && timer.isPaused) timer.resume();
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

| Event        | Target | When Fired                        |
| ------------ | ------ | --------------------------------- |
| game_start   | game   | startGameAfterPreview() completes |
| game_end     | game   | endGame() fires                   |
| game_paused  | system | Tab loses focus                   |
| game_resumed | system | User resumes                      |

### Game-Specific Events

| Event          | Target | When Fired                         | Data                                                    |
| -------------- | ------ | ---------------------------------- | ------------------------------------------------------- |
| cell_selected  | grid   | User clicks any grid cell          | `{ row, col, value, correct, expectedValue }`           |
| chain_complete | game   | All chain numbers found in a round | `{ round, chain }`                                      |
| life_lost      | game   | User taps wrong number             | `{ livesRemaining }`                                    |
| round_reset    | game   | User clicks Reset                  | `{ round }`                                             |

---

## 11. Scaffold Points

| Point           | Function                 | When                        | What Can Be Injected                             |
| --------------- | ------------------------ | --------------------------- | ------------------------------------------------ |
| after_incorrect | handleCellClick()        | User taps wrong cell        | Hint: "Look for the smallest number first"       |
| before_round    | renderRound()            | New round starts            | Strategy tip: "Start with the smallest number"   |
| chain_stuck     | handleCellClick()        | No progress for 15 seconds  | Visual highlight of first chain number            |
| on_life_lost    | handleCellClick()        | Life decremented            | Show partial chain or worked example              |
| preview_phase   | showPreviewScreen()      | Before game starts          | Additional instruction content, worked example    |

### Scaffold Integration Notes

- Scaffolds are optional -- game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)
- The preview_phase scaffold can inject additional `previewContent` HTML into the preview screen

---

## 12. Feedback Triggers

> FeedbackManager (PART-017) is included -- audio feedback for correct/incorrect taps and game completion.

| Moment                    | Trigger Function           | Feedback Type               | Notes                            |
| ------------------------- | -------------------------- | --------------------------- | -------------------------------- |
| Correct cell tap          | handleCellClick()          | sound + sticker             | Play after marking cell green    |
| Incorrect cell tap        | handleCellClick()          | sound + sticker             | Play after flashing cell red     |
| Game complete (3 lives)   | endGame() via TransitionScreen | celebration (stars)     | Victory screen with stars        |
| Game complete (0 lives)   | endGame() via TransitionScreen | encouragement            | Game over screen                 |
| Round transition          | handleNext()               | subtle transition sound     | Via TransitionScreen auto-hide   |
| Preview instruction       | showPreviewScreen()        | preview audio (optional)    | Via PreviewScreenComponent audio |

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
// Preloaded in DOMContentLoaded via FeedbackManager.sound.preload()
// correct_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3
// wrong_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3
```

---

## 13. Visual Specifications

- **Layout:** ScreenLayout with progressBar + previewScreen + transitionScreen slots. 480px max-width, centered.
- **Color palette:** Primary=#270f36, Success=var(--mathai-green), Error=var(--mathai-red), Blue=var(--mathai-blue), Purple=var(--mathai-purple), Background=#f6f6f6, Content=#ffffff
- **Typography:** var(--mathai-font-family), title=32px, subtitle=18px, body=16px, grid-cells=32px bold
- **Spacing:** Container padding 10px, grid gap 8px, button gap 12px
- **Grid:** 3x3 grid, max-width 320px, cells square (aspect-ratio: 1), border-radius 12px
- **Interactive states:** default (white bg, gray border), hover (#f0f0f0), selected (blue border, light blue bg), correct (green border, light green bg), incorrect (red border, light red bg, 500ms flash), chain-found (green, disabled)
- **Transitions:** all 0.2s ease on cells and buttons, 0.5s on progress bar fill
- **Responsive:** 480px max-width container, grid auto-sizes within
- **Preview screen:** Managed by PreviewScreenComponent -- header bar, timer progress, instruction area, skip button

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Preview screen displays and transitions to game

```
SETUP: Page loaded, preview screen shown automatically
ACTIONS:
  wait for .mathai-preview-header to be visible (preview screen shown)
  assert .mathai-preview-instruction contains "Find the doubles chain"
  assert .mathai-preview-skip-btn is visible
  click .mathai-preview-skip-btn
  wait for #gameContent to be visible
  wait for #game-screen to be visible
ASSERT:
  .mathai-preview-header is not visible (preview hidden)
  gameState.isActive === true
  gameState.startTime is set (> 0)
  gameState.duration_data.preview.length >= 1
  gameState.duration_data.preview[0].duration is a number >= 0
```

### Scenario: Complete game with all correct answers (5 rounds, 0 mistakes)

```
SETUP: Page loaded, preview screen shown, skip preview screen
  wait for preview screen, click .mathai-preview-skip-btn to skip preview
  wait for gameState.isActive === true and #game-screen visible
ACTIONS:

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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true
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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true
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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true
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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true, Round 1 (chain [2, 4, 8])
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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true
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
SETUP: Page loaded, skip preview screen, wait for gameState.isActive === true
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
- [ ] Package scripts in correct order (PART-002): SentryConfig -> initSentry() -> Sentry SDK (3 scripts) -> load listener -> FeedbackManager -> Components -> Helpers
- [ ] All script `src` URLs use `storage.googleapis.com/test-dynamic-assets/...` or `browser.sentry-cdn.com` -- no relative paths, no `cdn.homeworkapp.ai`
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `#app` div exists (for ScreenLayout)
- [ ] `<template id="game-template">` exists with game content
- [ ] `#game-screen` element exists inside template
- [ ] `#results-screen` element exists inside template, hidden by default
- [ ] `#timer-container` div exists inside game-screen
- [ ] `#game-grid` div exists with `--cols: 3`
- [ ] `data-signal-id` attributes on important interactive elements

### Functional

- [ ] `waitForPackages()` defined and checks all 9 packages: FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector, ScreenLayout, ProgressBarComponent, TransitionScreenComponent, PreviewScreenComponent, InteractionManager (PART-003)
- [ ] DOMContentLoaded is `async` and wrapped in try/catch (PART-004)
- [ ] `waitForPackages()` called first, `FeedbackManager.init()` called second
- [ ] SignalCollector created and assigned to `window.signalCollector`
- [ ] `ScreenLayout.inject()` called with `previewScreen: true` in slots (PART-025, PART-039)
- [ ] Game template cloned into `#gameContent` after ScreenLayout.inject()
- [ ] ProgressBarComponent created with totalRounds: 5, totalLives: 3 (PART-023)
- [ ] TransitionScreenComponent created (PART-024)
- [ ] PreviewScreenComponent created with autoInject, slotId, gameContentId (PART-039)
- [ ] TimerComponent created with timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false (PART-006)
- [ ] InteractionManager created with selector '.game-play-area' and assigned to `window.interactionManager` (PART-038)
- [ ] Audio preloaded with `sound.preload([{id, url}])` -- NOT `sound.register()` (PART-017)
- [ ] VisibilityTracker created with onInactive + onResume callbacks (PART-005)
- [ ] onInactive pauses: signalCollector, previewScreen, timer (with `{ fromVisibilityTracker: true }`), sound (`pause()` NOT `stopAll()`), streams
- [ ] onResume resumes: signalCollector, previewScreen, timer (only if paused, with `{ fromVisibilityTracker: true }`), sound, streams
- [ ] onInactive/onResume record visibility_hidden/visibility_visible custom events on signalCollector
- [ ] onInactive/onResume fire trackEvent('game_paused'/'game_resumed', 'system')
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] `game_ready` postMessage sent AFTER message listener registered (PART-008)
- [ ] setupGame has fallback content for standalone testing (PART-008)
- [ ] **setupGame() does NOT set `gameState.startTime`** -- that is set in `startGameAfterPreview()` (PART-039)
- [ ] **setupGame() does NOT set `gameState.isActive`** -- that is set in `startGameAfterPreview()` (PART-039)
- [ ] **setupGame() calls `showPreviewScreen()`** instead of directly starting the game (PART-039)
- [ ] **showPreviewScreen() calls `previewScreen.show()` with instruction, audioUrl, onComplete** (PART-039)
- [ ] **startGameAfterPreview() sets `gameState.startTime = Date.now()`** (PART-039)
- [ ] **startGameAfterPreview() sets `gameState.isActive = true`** (PART-039)
- [ ] **startGameAfterPreview() calls `timer.start()`**
- [ ] **startGameAfterPreview() calls `trackEvent('game_start', 'game')`**
- [ ] **startGameAfterPreview() records preview duration in `duration_data.preview[]`** (PART-039)
- [ ] **startGameAfterPreview() records `screen_transition` view event** (PART-039)
- [ ] recordAttempt produces correct attempt shape with all mandatory fields (PART-009)
- [ ] trackEvent fires at all interaction points: cell_selected, chain_complete, life_lost, round_reset (PART-010)
- [ ] `signalCollector.recordViewEvent()` called on every DOM change (content_render, visual_update, feedback_display, overlay_toggle, screen_transition)
- [ ] endGame calculates metrics, logs with JSON.stringify, seals SignalCollector, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition calls endGame()** -- rounds complete (via handleNext) OR lives lost (via handleCellClick)
- [ ] Stars calculated from lives remaining: lives >= 3 -> 3, >= 2 -> 2, >= 1 -> 1, 0 -> 0
- [ ] `computeTriesPerRound` helper exists in global scope
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, debugSignals, loadRound (PART-012)
- [ ] `testPause`/`testResume` use `visibilityTracker.triggerInactive()`/`triggerResume()`
- [ ] `testPause`/`testResume` fallback includes `previewScreen.pause()`/`previewScreen.resume()`
- [ ] showResults populates all fields including rounds and lives (PART-019)
- [ ] InputSchema defined with fallback content of 5 rounds plus preview fields (PART-028)
- [ ] Play area has 3x3 grid with clear interactive/feedback sections (PART-027)
- [ ] No anti-patterns present (PART-026)
- [ ] No inline stub/polyfill/fallback classes for CDN packages
- [ ] `window.gameState = {...}` -- NOT `const gameState = {...}`
- [ ] `game_complete` postMessage includes `previewResult` field (PART-039)
- [ ] `endGame()` calls `previewScreen.destroy()` in cleanup (PART-039)

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
- [ ] RULE-005: Cleanup in endGame -- timer, visibilityTracker, progressBar, previewScreen destroyed; audio stopped
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
- [ ] Reset does NOT restore lives
- [ ] `isProcessing` flag prevents double-clicks during audio feedback
- [ ] `window.loadRound(n)` debug function jumps to round n
- [ ] No dead-end game states -- every state leads to either continued play or endGame

### PART-039 Preview Screen Compliance

- [ ] PreviewScreenComponent instantiated in DOMContentLoaded
- [ ] ScreenLayout.inject() includes `previewScreen: true`
- [ ] `showPreviewScreen()` function exists in global scope
- [ ] `startGameAfterPreview()` function exists in global scope
- [ ] `previewScreen.show()` called from `setupGame()` via `showPreviewScreen()`
- [ ] `startGameAfterPreview()` sets `gameState.startTime` AFTER preview ends
- [ ] `gameState.duration_data.preview[]` populated with `{ duration }`
- [ ] VisibilityTracker wired to `previewScreen.pause()`/`previewScreen.resume()`
- [ ] No `new Audio()` for preview audio (FeedbackManager handles all audio)
- [ ] `gameState.previewResult` included in `game_complete` postMessage payload
- [ ] `fallbackContent` includes `previewInstruction`, `previewAudioText`, `previewAudio` fields
- [ ] `previewScreen.destroy()` called in `endGame()` cleanup

### Contract Compliance

- [ ] gameState matches `contracts/game-state.schema.json`
- [ ] Attempts match `contracts/attempt.schema.json` (all required fields present)
- [ ] Metrics match `contracts/metrics.schema.json` (includes totalLives, tries)
- [ ] duration_data matches `contracts/duration-data.schema.json` (includes preview[])
- [ ] postMessage out matches `contracts/postmessage-out.schema.json` (type: 'game_complete', data.metrics, data.attempts, data.completedAt, data.previewResult)
