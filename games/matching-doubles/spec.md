# Matching Doubles — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Matching Doubles
- **Game ID:** game_matching_doubles
- **Type:** standard
- **Description:** Match numbers with their doubles (number × 2). Left column shows numbers, right column shows shuffled doubles. Tap a number on the left, then tap its double on the right. 9 rounds with increasing grid size (3×3 → 4×4 → 5×5). 3 lives. Stars based on completion time.

---

## 2. Parts Selected

| Part ID  | Name                             | Included        | Config/Notes                                                                                                                                                                                                                   |
| -------- | -------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| PART-001 | HTML Shell                       | YES             | —                                                                                                                                                                                                                              |
| PART-002 | Package Scripts                  | YES             | —                                                                                                                                                                                                                              |
| PART-003 | waitForPackages                  | YES             | —                                                                                                                                                                                                                              |
| PART-004 | Initialization Block             | YES             | —                                                                                                                                                                                                                              |
| PART-005 | VisibilityTracker                | YES             | popupProps: default                                                                                                                                                                                                            |
| PART-006 | TimerComponent                   | YES             | timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false, format: 'min'                                                                                                                                          |
| PART-007 | Game State Object                | YES             | Custom fields: selectedLeftIndex, currentRoundData, matchedPairs, lives, totalLives                                                                                                                                            |
| PART-008 | PostMessage Protocol             | YES             | —                                                                                                                                                                                                                              |
| PART-009 | Attempt Tracking                 | YES             | —                                                                                                                                                                                                                              |
| PART-010 | Event Tracking & SignalCollector | YES             | v3 API — Custom events: select_number, correct_match, wrong_match, round_complete, life_lost. SignalCollector integrated: recordViewEvent on all DOM changes, recordCustomEvent for game logic, startFlushing + seal lifecycle, data-signal-id on interactive elements |
| PART-011 | End Game & Metrics               | YES             | Custom star logic: ≤60s = 3★, ≤90s = 2★, >90s = 1★                                                                                                                                                                             |
| PART-012 | Debug Functions                  | YES             | —                                                                                                                                                                                                                              |
| PART-013 | Validation Fixed                 | NO              | —                                                                                                                                                                                                                              |
| PART-014 | Validation Function              | YES             | Rule: doubles[j] === numbers[i] × 2                                                                                                                                                                                            |
| PART-015 | Validation LLM                   | NO              | —                                                                                                                                                                                                                              |
| PART-016 | StoriesComponent                 | NO              | —                                                                                                                                                                                                                              |
| PART-017 | Feedback Integration             | YES             | Extension — 20 preloaded sounds (levels, rounds, gameplay SFX, end-game) + 13 stickers via FeedbackManager.sound.preload(). No playDynamicFeedback — all audio is pre-recorded.                                                |
| PART-018 | Case Converter                   | NO              | —                                                                                                                                                                                                                              |
| PART-019 | Results Screen UI                | YES             | Custom metrics: time, rounds completed, accuracy                                                                                                                                                                               |
| PART-020 | CSS Variables & Colors           | YES             | —                                                                                                                                                                                                                              |
| PART-021 | Screen Layout CSS                | YES             | —                                                                                                                                                                                                                              |
| PART-022 | Game Buttons                     | YES             | —                                                                                                                                                                                                                              |
| PART-023 | ProgressBar Component            | YES             | totalRounds: 9, totalLives: 3                                                                                                                                                                                                  |
| PART-024 | TransitionScreen Component       | YES             | Screens: start, victory, game-over                                                                                                                                                                                             |
| PART-025 | ScreenLayout Component           | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                                                                 |
| PART-026 | Anti-Patterns                    | YES (REFERENCE) | Verification checklist, not code-generating                                                                                                                                                                                    |
| PART-030 | Sentry Error Tracking            | YES             | SentryConfig + Sentry SDK v10.23.0, global error handlers, breadcrumbs                                                                                                                                                         |
| PART-027 | Play Area Construction           | YES             | Layout: two-column matching (Number                                                                                                                                                                                            | Doubles) |
| PART-028 | InputSchema Patterns             | YES             | Schema type: rounds with number arrays                                                                                                                                                                                         |
| PART-033 | Interaction Patterns             | NO              | Custom left-right tap matching                                                                                                                                                                                                 |
| PART-034 | Variable Schema Serialization    | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                                                                       |
| PART-035 | Test Plan Generation             | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                                                                  |
| PART-037 | Playwright Testing               | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                                                                         |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'game_matching_doubles',
  contentSetId: null, // From game_init postMessage
  signalConfig: null, // From game_init postMessage — { flushUrl, playId }
  currentRound: 0,
  totalRounds: 9,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,
  isProcessing: false,
  phase: 'start',
  content: null,
  sessionHistory: [], // Array of session snapshots for restart tracking (PART-011 v3)
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null,
  },

  // GAME-SPECIFIC:
  lives: 3, // Current remaining lives
  totalLives: 3, // Starting lives
  selectedLeftIndex: null, // Index of selected left-side number (null if none)
  currentRoundData: null, // { numbers: [...], doubles: [...] } for current round
  matchedPairs: new Set(), // Set of left indices that have been correctly matched
  wrongAttempts: 0, // Total wrong attempts across all rounds
};

let timer = null;
let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
let signalCollector = null;
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
          "numbers": {
            "type": "array",
            "items": { "type": "integer" },
            "description": "Left column: the original numbers"
          },
          "doubles": {
            "type": "array",
            "items": { "type": "integer" },
            "description": "Right column: the doubles (number × 2), shuffled order"
          }
        },
        "required": ["numbers", "doubles"]
      },
      "minItems": 9,
      "description": "9 rounds. Rounds 1-3: 3 numbers each. Rounds 4-6: 4 numbers each. Rounds 7-9: 5 numbers each."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Difficulty progression:

- Rounds 1-3: 3 numbers (3×3 layout)
- Rounds 4-6: 4 numbers (4×4 layout)
- Rounds 7-9: 5 numbers (5×5 layout)

Numbers chosen to be age-appropriate (grades 6-8). Doubles are shuffled so they don't align with the left column.

```javascript
const fallbackContent = {
  rounds: [
    // Round 1: 3 numbers (easy)
    // Numbers: 2, 5, 6 → Doubles: 4, 10, 12 (shuffled: 10, 12, 4)
    { numbers: [2, 5, 6], doubles: [10, 12, 4] },

    // Round 2: 3 numbers
    // Numbers: 3, 7, 4 → Doubles: 6, 14, 8 (shuffled: 14, 8, 6)
    { numbers: [3, 7, 4], doubles: [14, 8, 6] },

    // Round 3: 3 numbers
    // Numbers: 8, 1, 9 → Doubles: 16, 2, 18 (shuffled: 2, 18, 16)
    { numbers: [8, 1, 9], doubles: [2, 18, 16] },

    // Round 4: 4 numbers (medium)
    // Numbers: 4, 8, 1, 6 → Doubles: 8, 16, 2, 12 (shuffled: 16, 2, 12, 8)
    { numbers: [4, 8, 1, 6], doubles: [16, 2, 12, 8] },

    // Round 5: 4 numbers
    // Numbers: 7, 3, 9, 5 → Doubles: 14, 6, 18, 10 (shuffled: 6, 18, 10, 14)
    { numbers: [7, 3, 9, 5], doubles: [6, 18, 10, 14] },

    // Round 6: 4 numbers
    // Numbers: 11, 2, 8, 15 → Doubles: 22, 4, 16, 30 (shuffled: 4, 30, 22, 16)
    { numbers: [11, 2, 8, 15], doubles: [4, 30, 22, 16] },

    // Round 7: 5 numbers (hard)
    // Numbers: 3, 9, 6, 12, 7 → Doubles: 6, 18, 12, 24, 14 (shuffled: 18, 14, 24, 6, 12)
    { numbers: [3, 9, 6, 12, 7], doubles: [18, 14, 24, 6, 12] },

    // Round 8: 5 numbers
    // Numbers: 5, 11, 4, 8, 13 → Doubles: 10, 22, 8, 16, 26 (shuffled: 22, 16, 26, 10, 8)
    { numbers: [5, 11, 4, 8, 13], doubles: [22, 16, 26, 10, 8] },

    // Round 9: 5 numbers
    // Numbers: 14, 2, 10, 6, 9 → Doubles: 28, 4, 20, 12, 18 (shuffled: 4, 20, 18, 28, 12)
    { numbers: [14, 2, 10, 6, 9], doubles: [4, 20, 18, 28, 12] },
  ],
};
```

**Verification — every double is correct and shuffled:**

| Round | Numbers     | True Doubles  | Shuffled Doubles | All present? |
| ----- | ----------- | ------------- | ---------------- | ------------ |
| 1     | 2,5,6       | 4,10,12       | 10,12,4          | ✓            |
| 2     | 3,7,4       | 6,14,8        | 14,8,6           | ✓            |
| 3     | 8,1,9       | 16,2,18       | 2,18,16          | ✓            |
| 4     | 4,8,1,6     | 8,16,2,12     | 16,2,12,8        | ✓            |
| 5     | 7,3,9,5     | 14,6,18,10    | 6,18,10,14       | ✓            |
| 6     | 11,2,8,15   | 22,4,16,30    | 4,30,22,16       | ✓            |
| 7     | 3,9,6,12,7  | 6,18,12,24,14 | 18,14,24,6,12    | ✓            |
| 8     | 5,11,4,8,13 | 10,22,8,16,26 | 22,16,26,10,8    | ✓            |
| 9     | 14,2,10,6,9 | 28,4,20,12,18 | 4,20,18,28,12    | ✓            |

### Content Set Generation Guidance

Generate **3 content sets** at different difficulty levels. All sets must have exactly 9 rounds (3 per level). Structure: rounds 1-3 = 3 pairs, rounds 4-6 = 4 pairs, rounds 7-9 = 5 pairs.

| Dimension | Easy | Medium | Hard |
|---|---|---|---|
| Number range (rounds 1-3) | 1–10 | 5–20 | 10–50 |
| Number range (rounds 4-6) | 1–15 | 10–30 | 15–75 |
| Number range (rounds 7-9) | 1–20 | 10–50 | 20–100 |

**Constraints all content sets must satisfy:**
- Every `doubles[j]` must equal exactly `numbers[i] × 2` for some `i` in the round
- Right column (`doubles`) must be shuffled so no double aligns positionally with its source number
- No duplicate numbers within a single round
- Numbers must be positive integers
- Each content set should use different numbers (not just reorder the same set)

---

## 5. Screens & HTML Structure

### Body HTML (uses `<template>` for ScreenLayout compatibility — PART-025)

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <div id="timer-container"></div>

    <div class="instruction-area">
      <p class="instruction-text">Match the numbers with their <strong>doubles</strong>!</p>
      <p class="instruction-text-sub">Complete all rounds within 1 minute to earn 3 stars!</p>
    </div>

    <div class="matching-area" id="matching-area">
      <div class="column-headers">
        <span class="column-header">Number</span>
        <span class="column-header">Doubles</span>
      </div>
      <div class="matching-grid" id="matching-grid" data-signal-id="matching-grid">
        <!-- Rows generated by JavaScript: each left cell gets data-signal-id="left-cell-{i}", each right cell gets data-signal-id="right-cell-{i}" -->
      </div>
    </div>
  </div>

  <div id="results-screen" class="game-block hidden">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title" id="results-title">Great Job!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Time</span>
          <span class="metric-value" id="result-time">0:00</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Rounds Completed</span>
          <span class="metric-value" id="result-rounds">0/9</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Wrong Attempts</span>
          <span class="metric-value" id="result-wrong">0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span class="metric-value" id="result-accuracy">0%</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="restart-button" onclick="restartGame()">
        Play Again
      </button>
    </div>
  </div>
</template>
```

---

## 6. CSS

```css
/* === CSS Variables (PART-020) === */
:root {
  --mathai-green: #219653;
  --mathai-light-green: #eafbf1;
  --mathai-red: #e35757;
  --mathai-light-red: #fdecec;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #ebf0ff;
  --mathai-gray: #828282;
  --mathai-light-gray: #f2f2f2;
  --mathai-white: #ffffff;
  --mathai-black: #1a1a2e;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 12px;
  --mathai-border-radius-card: 12px;
  --mathai-border-gray: #e0e0e0;
  --selected-bg: #fff9e0;
  --selected-border: #e8d98a;
}

/* === Reset === */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-white);
  color: var(--mathai-black);
  -webkit-font-smoothing: antialiased;
}

/* === Game Block === */
.game-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 12px;
}

/* === Instruction Area === */
.instruction-area {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  text-align: center;
}

.instruction-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  line-height: 1.5;
  margin-bottom: 8px;
}

.instruction-text strong {
  font-weight: 700;
}

.instruction-text-sub {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  line-height: 1.4;
  margin-bottom: 4px;
}

/* === Matching Area === */
.matching-area {
  width: 100%;
  max-width: 320px;
  margin: 8px auto;
}

.column-headers {
  display: flex;
  justify-content: space-around;
  margin-bottom: 12px;
}

.column-header {
  font-size: var(--mathai-font-size-label);
  font-weight: 600;
  color: var(--mathai-gray);
  width: 45%;
  text-align: center;
}

/* === Matching Grid (rows of left-right pairs) === */
.matching-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.matching-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 16px;
}

/* === Number Cell (shared for left and right) === */
.number-cell {
  width: 70px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--mathai-border-gray, #e0e0e0);
  border-radius: 10px;
  font-size: 20px;
  font-weight: 600;
  color: var(--mathai-black);
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  background: var(--mathai-white);
}

/* Left column — interactable by default */
.number-cell.left-cell:hover:not(.matched):not(.disabled) {
  border-color: var(--selected-border);
  background: rgba(255, 249, 224, 0.5);
}

/* Right column — disabled until a left cell is selected */
.number-cell.right-cell.disabled {
  color: var(--mathai-gray);
  cursor: default;
  pointer-events: none;
  opacity: 0.6;
}

.number-cell.right-cell:not(.disabled):not(.matched):hover {
  border-color: var(--mathai-blue);
  background: var(--mathai-light-blue);
}

/* Selected state (left cell tapped — yellow/cream highlight) */
.number-cell.selected {
  border-color: var(--selected-border);
  background: var(--selected-bg);
}

/* Correct match — green */
.number-cell.matched {
  border-color: var(--mathai-green);
  background: var(--mathai-light-green);
  color: var(--mathai-green);
  cursor: default;
  pointer-events: none;
}

/* Wrong match — red flash */
.number-cell.wrong {
  border-color: var(--mathai-red);
  background: var(--mathai-light-red);
  color: var(--mathai-red);
}

/* === Buttons (PART-022) === */
.game-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 12px;
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  width: 100%;
  max-width: 340px;
}

.btn-primary {
  background: var(--mathai-green);
  color: var(--mathai-white);
}
.btn-primary:hover {
  filter: brightness(0.9);
}

/* === Results Screen (PART-019) === */
.results-card {
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.results-title {
  font-size: var(--mathai-font-size-title);
  margin-bottom: 24px;
  color: var(--mathai-black);
}

.stars-display {
  font-size: 40px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-label {
  color: var(--mathai-gray);
  font-size: var(--mathai-font-size-label);
}

.metric-value {
  font-weight: 700;
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
}

/* === Utility === */
.hidden {
  display: none !important;
}
```

---

## 7. Game Flow

1. **Page loads** → DOMContentLoaded fires
   - Sentry initialized via `window.addEventListener('load', initSentry)` (PART-030)
   - Global error handlers registered for unhandled errors and promise rejections (PART-030)
   - `waitForPackages()` — **defined inline in the `<script>` block** (PART-003). Polls every 50ms (10s timeout) until all package globals exist: `ScreenLayout`, `ProgressBarComponent`, `TransitionScreenComponent`, `TimerComponent`, `FeedbackManager`, `VisibilityTracker`, `SignalCollector`. This function cannot come from an external package since its purpose is to wait for those packages to load.
   - FeedbackManager.init()
   - Preload sounds: `FeedbackManager.sound.preload([...])` — see Section 11 for full list (level_1-3, round_1-3, rounds_sound_effect, tap_sound, correct_sound_effect, incorrect_sound_effect, new_cards, all_correct, game_over_sound_effect, game_over, game_complete_sound_effect, game_complete_1_star, game_complete_2_star, victory_sound_effect, victory, restart)
   - SignalCollector created with gameId, contentSetId (PART-010 v3)
   - ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })
   - Clone `<template id="game-template">` into `#gameContent`
   - TimerComponent created (increase, startTime: 0, endTime: 100000, autoStart: false, format: 'min')
   - ProgressBarComponent created (totalRounds: 9, totalLives: 3)
   - TransitionScreen created
   - VisibilityTracker created (with SignalCollector pause/resume + custom events)
   - Register postMessage listener: `window.addEventListener('message', handlePostMessage)`
   - Send `window.parent.postMessage({ type: 'game_ready' }, '*')` (PART-008 — parent harness waits for this before sending game_init)
   - Show start transition screen

2. **startGame()** runs (from start screen button):
   - Set gameState.startTime = Date.now()
   - Set gameState.isActive = true
   - Set duration_data.startTime = new Date().toISOString()
   - progressBar.update(0, gameState.lives)
   - trackEvent('game_start', 'game')
   - showLevelTransition() → which shows "Level 1" screen, plays level_1 audio, user clicks "I'm ready" → showRoundTransition()
   - NOTE: timer.start() is deferred to loadRound() after transitions dismiss — timer only counts gameplay time

3. **showLevelTransition()** runs:
   - Determine current level: rounds 0-2 = Level 1, rounds 3-5 = Level 2, rounds 6-8 = Level 3
   - Show transition screen with "Level X" title, "I'm ready" button (visible immediately)
   - Play level audio (level_1/level_2/level_3) with sticker — fire-and-forget, store reference to cancel
   - On "I'm ready" click: stop level audio if still playing → showRoundTransition()

4. **showRoundTransition()** runs:
   - Determine round-within-level: position % 3 → round_1, round_2, or round_3
   - Show transition screen with "Round X" title (no button — auto-dismiss)
   - Play `rounds_sound_effect` (await) with round sticker and subtitle `Round N`
   - Then play `round_1`/`round_2`/`round_3` (await) with same round sticker and subtitle — SFX→announcement pattern, same as endGame
   - After both audios finish → auto-dismiss transition → loadRound()

5. **loadRound()** runs:
   - Get round data from gameState.content.rounds[gameState.currentRound]
   - Set gameState.currentRoundData = round
   - Set gameState.matchedPairs = new Set()
   - Set gameState.selectedLeftIndex = null
   - renderGrid(round)
   - Play `new_cards` sound (fire-and-forget)

4. **renderGrid(round)** runs:
   - Clear #matching-grid
   - For each index i in round.numbers:
     - Create a .matching-row div
     - Create left .number-cell.left-cell with number (data-left-index=i, data-value=round.numbers[i])
     - Create right .number-cell.right-cell.disabled with double (data-right-index=i, data-value=round.doubles[i])
     - Add click handler on left cell → handleLeftClick(i)
     - Add click handler on right cell → handleRightClick(i)
     - Append row to grid

5. **User interaction loop:**
   - User taps a left-side number → handleLeftClick(leftIndex)
     - If already matched → return
     - Play `tap_sound` (fire-and-forget)
     - Deselect any previously selected left cell
     - Highlight selected cell with .selected (yellow/cream)
     - Set gameState.selectedLeftIndex = leftIndex
     - Enable ALL unmatched right-side cells (remove .disabled)
   - User taps a right-side double → handleRightClick(rightIndex)
     - If no left selected → return
     - If right already matched → return
     - Check: round.doubles[rightIndex] === round.numbers[selectedLeftIndex] × 2
     - If CORRECT:
       - Add .matched (green) to both left and right cells
       - Add leftIndex to matchedPairs
       - Disable both cells
       - Play `correct_sound_effect` (fire-and-forget) with sticker `question_audio_correct_sound_effect`
       - recordAttempt with correct: true
       - trackEvent('correct_match')
       - Reset selectedLeftIndex = null
       - Disable all unmatched right cells again
       - If matchedPairs.size === round.numbers.length → roundComplete()
     - If WRONG:
       - Add .wrong (red) to the right cell only
       - gameState.lives--
       - gameState.wrongAttempts++
       - progressBar.update(gameState.currentRound, gameState.lives)
       - Play `incorrect_sound_effect` (fire-and-forget) with sticker `question_audio_incorrect_sound_effect`
       - recordAttempt with correct: false
       - trackEvent('wrong_match')
       - trackEvent('life_lost')
       - Immediately: deselect left cell, reset selectedLeftIndex, disable all unmatched right cells, release isProcessing
       - 600ms red flash is purely cosmetic (setTimeout to remove .wrong class) — does NOT block interaction
       - If lives <= 0 → endGame('game_over') called immediately (no delay)

7. **roundComplete():**
   - Play `all_correct` (await) with sticker `question_audio_all_correct` and subtitle `"Good job! All cards matched!"`
   - gameState.currentRound++
   - gameState.score++
   - progressBar.update(gameState.currentRound, gameState.lives)
   - trackEvent('round_complete', 'game', { round: gameState.currentRound })
   - If currentRound >= totalRounds → endGame('victory')
   - Else → check if new level (round 3→4 or 6→7): showLevelTransition(), otherwise showRoundTransition()

8. **endGame(reason):**
   - gameState.isActive = false
   - timer.pause()
   - Calculate metrics + stars based on time (including `totalLives`, `tries` from `computeTriesPerRound()`, `sessionHistory`)
   - Record `screen_transition` to results via `recordViewEvent` BEFORE sealing (PART-010 v3)
   - Seal SignalCollector (signals already streamed to GCS via batch flushing)
   - Show results screen
   - If game_over: play `game_over_sound_effect` (await) → play `game_over` (await, clear on retry click) with sticker `question_audio_game_over`
   - If victory with 3★: play `victory_sound_effect` (await) → play `victory` (await) with sticker `question_audio_victory`
   - If victory with 1★: play `game_complete_sound_effect` (await) → play `game_complete_1_star` (await) with sticker `question_audio_game_complete`
   - If victory with 2★: play `game_complete_sound_effect` (await) → play `game_complete_2_star` (await) with sticker `question_audio_game_complete`
   - Send postMessage `game_complete` with metrics (NO signal payload — signals stream via GCS)
   - **Component cleanup guarded by `gameState.gameEnded`:** Only destroy timer/progressBar/visibilityTracker and call `stopAll()` if `gameState.gameEnded` is still `true`. This prevents a race condition where `restartGame()` is called during end-game audio — `restartGame` sets `gameEnded = false` and recreates components, so the lingering async cleanup must not destroy them.
   - **IMPORTANT — showResults visibility:** Use `classList.add('hidden')` / `classList.remove('hidden')` to toggle screens, NOT `style.display`. The `.hidden` CSS class uses `display: none !important` which overrides inline styles.

---

## 8. Functions

### Global Scope (RULE-001)

**startGame()**

- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set duration_data.startTime = new Date().toISOString()
- // NOTE: timer.start() is NOT called here — it starts in loadRound() on the first round, after all transition screens have dismissed
- progressBar.update(0, gameState.lives)
- trackEvent('game_start', 'game')
- // Record screen transition from start to gameplay
- if (signalCollector) { signalCollector.recordViewEvent('screen_transition', { screen: 'gameplay', metadata: { transition_from: 'start' } }); }
- showLevelTransition()

**async showLevelTransition()**

- const levelIndex = Math.floor(gameState.currentRound / 3) // 0, 1, 2
- const levelNum = levelIndex + 1
- const levelAudioIds = ['level_1', 'level_2', 'level_3']
- const levelStickers = [
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif', type: 'IMAGE_GIF' },
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif', type: 'IMAGE_GIF' },
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif', type: 'IMAGE_GIF' },
  ]
- // Play level audio fire-and-forget (user can click "I'm ready" to skip)
- let levelAudioPlaying = true
- FeedbackManager.sound.play(levelAudioIds[levelIndex], { sticker: levelStickers[levelIndex], subtitle: `Level ${levelNum}` }).catch(e => console.error('Level audio error:', e.message)).finally(() => { levelAudioPlaying = false; })
- await transitionScreen.show({ title: `Level ${levelNum}`, buttons: [{ text: "I'm ready", type: 'primary', action: () => { if (levelAudioPlaying) { try { FeedbackManager.sound.stopAll(); } catch(e) {} } showRoundTransition(); } }] })

**async showRoundTransition()**

- const roundInLevel = (gameState.currentRound % 3) // 0, 1, 2
- const roundAudioIds = ['round_1', 'round_2', 'round_3']
- const roundStickers = [
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-44.gif', type: 'IMAGE_GIF' },
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-47.gif', type: 'IMAGE_GIF' },
    { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-52.gif', type: 'IMAGE_GIF' },
  ]
- // Show round transition screen (auto-dismiss after audio)
- transitionScreen.show({ title: `Round ${roundInLevel + 1}` })
- // Play rounds SFX (awaited) then round announcement (awaited) — SFX→announcement pattern, same as endGame
- try { await FeedbackManager.sound.play('rounds_sound_effect', { sticker: roundStickers[roundInLevel], subtitle: `Round ${roundInLevel + 1}` }); } catch(e) { console.error('Round SFX error:', e.message); }
- try { await FeedbackManager.sound.play(roundAudioIds[roundInLevel], { sticker: roundStickers[roundInLevel], subtitle: `Round ${roundInLevel + 1}` }); } catch(e) { console.error('Round announcement error:', e.message); }
- // Dismiss transition screen overlay before rendering grid
- try { transitionScreen.hide(); } catch(e) {}
- // Load round
- loadRound()

**loadRound()**

- const round = gameState.content.rounds[gameState.currentRound]
- gameState.currentRoundData = round
- gameState.matchedPairs = new Set()
- gameState.selectedLeftIndex = null
- renderGrid(round)
- // Start or resume the timer AFTER transitions are done and gameplay grid is visible
- if (gameState.currentRound === 0 && !timer.isRunning) { timer.start(); } else if (timer.isPaused) { timer.resume(); }
- // Play new cards appearing sound (fire-and-forget)
- FeedbackManager.sound.play('new_cards').catch(e => console.error('new_cards audio error:', e.message))

**renderGrid(round)**

- const grid = document.getElementById('matching-grid')
- grid.innerHTML = ''
- for (let i = 0; i < round.numbers.length; i++):
  - Create div.matching-row
  - Create div.number-cell.left-cell with:
    - data-left-index = i
    - data-value = round.numbers[i]
    - data-signal-id = `left-cell-${i}`
    - textContent = round.numbers[i]
    - onclick → handleLeftClick(i)
  - Create div.number-cell.right-cell.disabled with:
    - data-right-index = i
    - data-value = round.doubles[i]
    - data-signal-id = `right-cell-${i}`
    - textContent = round.doubles[i]
    - onclick → handleRightClick(i)
  - Append left + right cells to row
  - Append row to grid
- // Record view event for content render
- if (signalCollector) { signalCollector.recordViewEvent('content_render', { screen: 'gameplay', content_snapshot: { question_text: `Match ${round.numbers.length} numbers with their doubles`, numbers: round.numbers, doubles: round.doubles, round: gameState.currentRound + 1, trigger: 'round_start' }, components: { timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null, progress: { current: gameState.currentRound, total: gameState.totalRounds } } }); }

**handleLeftClick(leftIndex)**

- If !gameState.isActive → return
- If gameState.matchedPairs.has(leftIndex) → return
- // Play tap sound (fire-and-forget, no UI blocking)
- FeedbackManager.sound.play('tap_sound').catch(e => console.error('tap audio error:', e.message))
- // Deselect previous
- document.querySelectorAll('.left-cell.selected').forEach(el => el.classList.remove('selected'))
- // Select this one
- const leftEl = document.querySelector(`.left-cell[data-left-index="${leftIndex}"]`)
- leftEl.classList.add('selected')
- gameState.selectedLeftIndex = leftIndex
- // Enable unmatched right cells
- enableRightCells()
- trackEvent('select_number', 'left', { index: leftIndex, value: gameState.currentRoundData.numbers[leftIndex] })
- // Record visual update for cell selection
- if (signalCollector) { signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'number_selected', selected_index: leftIndex, selected_value: gameState.currentRoundData.numbers[leftIndex], matched_count: gameState.matchedPairs.size } }); }

**enableRightCells()**

- document.querySelectorAll('.right-cell').forEach(el => {
  const idx = parseInt(el.dataset.rightIndex)
  if (!el.classList.contains('matched')) {
  el.classList.remove('disabled')
  }
  })

**disableRightCells()**

- document.querySelectorAll('.right-cell').forEach(el => {
  if (!el.classList.contains('matched')) {
  el.classList.add('disabled')
  }
  })

**async handleRightClick(rightIndex)**

- If !gameState.isActive → return
- If gameState.isProcessing → return
- If gameState.selectedLeftIndex === null → return
- const rightEl = document.querySelector(`.right-cell[data-right-index="${rightIndex}"]`)
- If rightEl.classList.contains('matched') → return
- If rightEl.classList.contains('disabled') → return
- gameState.isProcessing = true
- const leftIndex = gameState.selectedLeftIndex
- const leftEl = document.querySelector(`.left-cell[data-left-index="${leftIndex}"]`)
- const round = gameState.currentRoundData
- const number = round.numbers[leftIndex]
- const double = round.doubles[rightIndex]
- const isCorrect = (double === number \* 2)

- If isCorrect:
  - leftEl.classList.remove('selected')
  - leftEl.classList.add('matched')
  - rightEl.classList.add('matched')
  - gameState.matchedPairs.add(leftIndex)
  - gameState.selectedLeftIndex = null
  - disableRightCells()
  - // Play correct sound effect (fire-and-forget) with sticker
  - FeedbackManager.sound.play('correct_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-20.gif', duration: 2, type: 'IMAGE_GIF' } }).catch(e => console.error('Audio error:', e.message))
  - trackEvent('correct_match', 'grid', { leftIndex, rightIndex, number, double })
  - recordAttempt({ input_of_user: { action: 'match', number, selectedDouble: double }, correct: true, metadata: { round: gameState.currentRound + 1, question: `What is the double of ${number}?`, correctAnswer: `${number * 2}`, validationType: 'function' } })
  - // Record feedback display
  - if (signalCollector) { signalCollector.recordViewEvent('feedback_display', { screen: 'gameplay', content_snapshot: { feedback_type: 'correct', message: 'Correct match!', number, double } }); }
  - // Record visual update for match
  - if (signalCollector) { signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'pair_matched', left_index: leftIndex, right_index: rightIndex, number, double, matched_count: gameState.matchedPairs.size, total_pairs: round.numbers.length } }); }
  - If gameState.matchedPairs.size >= round.numbers.length:
    - // Keep isProcessing = true during roundComplete to prevent taps during all_correct audio
    - await roundComplete()
    - gameState.isProcessing = false
  - Else:
    - gameState.isProcessing = false

- Else:
  - rightEl.classList.add('wrong')
  - gameState.lives--
  - gameState.wrongAttempts++
  - progressBar.update(gameState.currentRound, gameState.lives)
  - // Play incorrect sound effect (fire-and-forget) with sticker
  - FeedbackManager.sound.play('incorrect_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-28.gif', duration: 2, type: 'IMAGE_GIF' } }).catch(e => console.error('Audio error:', e.message))
  - trackEvent('wrong_match', 'grid', { leftIndex, rightIndex, number, selectedDouble: double, correctDouble: number \* 2 })
  - trackEvent('life_lost', 'game', { livesRemaining: gameState.lives })
  - recordAttempt({ input_of_user: { action: 'match', number, selectedDouble: double }, correct: false, metadata: { round: gameState.currentRound + 1, question: `What is the double of ${number}?`, correctAnswer: `${number * 2}`, validationType: 'function' } })
  - // Record feedback display
  - if (signalCollector) { signalCollector.recordViewEvent('feedback_display', { screen: 'gameplay', content_snapshot: { feedback_type: 'incorrect', message: 'Try again!', number, selectedDouble: double, correctDouble: number \* 2, lives_remaining: gameState.lives } }); }
  - // Record visual update for wrong flash
  - if (signalCollector) { signalCollector.recordViewEvent('visual_update', { screen: 'gameplay', content_snapshot: { type: 'wrong_flash', right_index: rightIndex, lives_remaining: gameState.lives } }); }
  - // Reset selection and release isProcessing IMMEDIATELY so user can keep tapping
  - leftEl.classList.remove('selected')
  - gameState.selectedLeftIndex = null
  - disableRightCells()
  - gameState.isProcessing = false
  - // 600ms red flash is purely cosmetic — does NOT block interaction
  - setTimeout(() => { rightEl.classList.remove('wrong'); }, 600)
  - If gameState.lives <= 0:
    - if (signalCollector) { signalCollector.recordCustomEvent('round_solved', { correct: false, reason: 'lives_exhausted' }); }
    - endGame('game_over')

**async roundComplete()**

- // Play all_correct audio (await — wait for it to finish before transitioning)
- try { await FeedbackManager.sound.play('all_correct', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-35.gif', duration: 2, type: 'IMAGE_GIF' }, subtitle: 'Good job! All cards matched!' }); } catch(e) { console.error('all_correct audio error:', e.message); }
- // Pause timer during transition screens — will resume in loadRound()
- if (timer) timer.pause()
- gameState.currentRound++
- gameState.score++
- progressBar.update(gameState.currentRound, gameState.lives)
- trackEvent('round_complete', 'game', { round: gameState.currentRound, livesRemaining: gameState.lives })
- if (signalCollector) { signalCollector.recordCustomEvent('round_solved', { correct: true, round: gameState.currentRound }); }
- If gameState.currentRound >= gameState.totalRounds → endGame('victory')
- Else if gameState.currentRound % 3 === 0 → showLevelTransition() // New level (round 3→4 or 6→7)
- Else → showRoundTransition() // Same level, next round

**async endGame(reason)**

- If gameState.gameEnded → return
- gameState.gameEnded = true
- gameState.isActive = false
- if (timer) timer.pause()
- // Use TimerComponent's gameplay-only elapsed time for star calculation (NOT wall-clock time)
- // Wall-clock time includes transition screens and audio waits which the student can't control
- const totalTime = timer ? Math.round(timer.getCurrentTime()) : Math.round((Date.now() - gameState.startTime) / 1000)
- const correctAttempts = gameState.attempts.filter(a => a.correct).length
- const totalAttempts = gameState.attempts.length
- const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) \* 100) : 0
- let stars = 0
- if (reason === 'victory'):
  - stars = totalTime <= 60 ? 3 : totalTime <= 90 ? 2 : 1
- else:
  - stars = 0
- const tries = computeTriesPerRound()
- const metrics = { accuracy, time: totalTime, stars, attempts: gameState.attempts, duration_data: { ...gameState.duration_data, currentTime: new Date().toISOString() }, totalLives: gameState.totalLives, tries, sessionHistory: gameState.sessionHistory, roundsCompleted: gameState.currentRound, wrongAttempts: gameState.wrongAttempts, livesRemaining: gameState.lives, reason }
- console.log('Final Metrics:', JSON.stringify(metrics, null, 2))
- console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2))
- trackEvent('game_end', 'game', { reason, roundsCompleted: gameState.currentRound, accuracy, stars, time: totalTime })
- if (typeof Sentry !== 'undefined') { Sentry.addBreadcrumb({ category: 'state', message: 'Game complete', level: 'info', data: { score: accuracy, stars, reason } }); }

- // Record screen transition to results BEFORE sealing (PART-010 v3 — cannot record after seal)
- if (signalCollector) { signalCollector.recordViewEvent('screen_transition', { screen: 'results', metadata: { transition_from: 'gameplay', reason } }); }
- // Seal SignalCollector — fires sendBeacon to flush remaining events to GCS, stops flush timer, detaches listeners (PART-010 v3)
- if (signalCollector) { signalCollector.seal(); }

- If reason === 'game_over':
  - showResults(metrics, reason)
  - // Play game over sounds back-to-back (both awaited)
  - try { await FeedbackManager.sound.play('game_over_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-95.gif', duration: 3, type: 'IMAGE_GIF' } }); } catch(e) { console.error('game_over_sfx error:', e.message); }
  - try { await FeedbackManager.sound.play('game_over'); } catch(e) { console.error('game_over audio error:', e.message); }
  - // game_over TTS clears on retry click (handled in restartGame)

- If reason === 'victory':
  - showResults(metrics, reason)
  - if stars === 3:
    - try { await FeedbackManager.sound.play('victory_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-98.gif', duration: 3, type: 'IMAGE_GIF' } }); } catch(e) { console.error('victory_sfx error:', e.message); }
    - try { await FeedbackManager.sound.play('victory'); } catch(e) { console.error('victory audio error:', e.message); }
  - else if stars === 2:
    - try { await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-25.gif', duration: 3, type: 'IMAGE_GIF' } }); } catch(e) { console.error('complete_sfx error:', e.message); }
    - try { await FeedbackManager.sound.play('game_complete_2_star'); } catch(e) { console.error('2star audio error:', e.message); }
  - else: // 1 star
    - try { await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-25.gif', duration: 3, type: 'IMAGE_GIF' } }); } catch(e) { console.error('complete_sfx error:', e.message); }
    - try { await FeedbackManager.sound.play('game_complete_1_star'); } catch(e) { console.error('1star audio error:', e.message); }
- window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts: gameState.attempts, completedAt: Date.now() } }, '\*')
- // Guard: only destroy components if restartGame() has NOT been called during audio playback
- // restartGame sets gameEnded = false and recreates components — must not destroy the new ones
- if (gameState.gameEnded) { if (timer) { timer.destroy(); timer = null; } if (progressBar) { progressBar.destroy(); progressBar = null; } if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; } try { FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll(); } catch(e) {} }

**showResults(metrics, reason)**

- // NOTE: recordViewEvent('screen_transition') for results is called in endGame() BEFORE seal()
- // IMPORTANT: use classList, NOT inline style.display — .hidden uses !important which overrides inline styles
- document.getElementById('game-screen').classList.add('hidden')
- const resultsScreen = document.getElementById('results-screen'); resultsScreen.classList.remove('hidden')
- document.getElementById('results-title').textContent = reason === 'victory' ? 'Great Job!' : 'Game Over'
- document.getElementById('result-time').textContent = formatTime(metrics.time)
- document.getElementById('result-rounds').textContent = `${gameState.currentRound}/${gameState.totalRounds}`
- document.getElementById('result-wrong').textContent = gameState.wrongAttempts
- document.getElementById('result-accuracy').textContent = `${metrics.accuracy}%`
- const starsDisplay = document.getElementById('stars-display')
- starsDisplay.innerHTML = ''
- for (let i = 0; i < 3; i++) { starsDisplay.innerHTML += i < metrics.stars ? '⭐' : '☆'; }

**formatTime(seconds)**

- const mins = Math.floor(seconds / 60)
- const secs = seconds % 60
- return `${mins}:${secs.toString().padStart(2, '0')}`

**restartGame()**

- // Stop any playing audio (clears game_over TTS on retry click)
- try { FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll(); } catch(e) {}
- // Play restart audio with sticker (fire-and-forget)
- FeedbackManager.sound.play('restart', { sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-102.gif', duration: 2, type: 'IMAGE_GIF' } }).catch(e => console.error('restart audio error:', e.message))
- // Push session snapshot to sessionHistory before resetting (PART-011 v3)
- gameState.sessionHistory.push({ totalLives: gameState.totalLives, tries: computeTriesPerRound() })
- // Preserve content, contentSetId, signalConfig, sessionHistory across restart
- const preserved = { content: gameState.content, contentSetId: gameState.contentSetId, signalConfig: gameState.signalConfig, sessionHistory: gameState.sessionHistory }
- gameState.currentRound = 0
- gameState.score = 0
- gameState.lives = 3
- gameState.wrongAttempts = 0
- gameState.selectedLeftIndex = null
- gameState.currentRoundData = null
- gameState.matchedPairs = new Set()
- gameState.attempts = []
- gameState.events = []
- gameState.startTime = null
- gameState.isActive = false
- gameState.gameEnded = false
- gameState.isProcessing = false
- gameState.phase = 'start'
- gameState.duration_data = { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null }
- // Restore preserved state
- gameState.content = preserved.content
- gameState.contentSetId = preserved.contentSetId
- gameState.signalConfig = preserved.signalConfig
- gameState.sessionHistory = preserved.sessionHistory
- // Recreate destroyed components (endGame nulls these)
- signalCollector = new SignalCollector({ gameId: gameState.gameId, contentSetId: gameState.contentSetId, flushUrl: gameState.signalConfig?.flushUrl, playId: gameState.signalConfig?.playId })
- window.signalCollector = signalCollector
- signalCollector.startFlushing()
- timer = new TimerComponent('timer-container', { timerType: 'increase', format: 'min', startTime: 0, endTime: 100000, autoStart: false })
- progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 9, totalLives: 3, slotId: 'mathai-progress-slot' })
- visibilityTracker = new VisibilityTracker({ onInactive: () => { const inactiveStart = Date.now(); gameState.duration_data.inActiveTime.push({ start: inactiveStart }); if (signalCollector) { signalCollector.pause(); signalCollector.recordCustomEvent('visibility_hidden', {}); } if (timer) timer.pause({ fromVisibilityTracker: true }); FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); trackEvent('game_paused', 'system'); }, onResume: () => { const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1]; if (lastInactive && !lastInactive.end) { lastInactive.end = Date.now(); gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start); } if (signalCollector) { signalCollector.resume(); signalCollector.recordCustomEvent('visibility_visible', {}); } if (timer?.isPaused) timer.resume({ fromVisibilityTracker: true }); FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); trackEvent('game_resumed', 'system'); }, popupProps: { title: 'Game Paused', description: 'Click Resume to continue.', primaryText: 'Resume' } })
- // IMPORTANT: use classList, NOT inline style.display — .hidden uses !important which overrides inline styles
- document.getElementById('results-screen').classList.add('hidden')
- document.getElementById('game-screen').classList.remove('hidden')
- transitionScreen.show({ icons: ['✖️', '2️⃣'], iconSize: 'large', title: 'Matching Doubles', subtitle: 'Match numbers with their doubles!', buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }] })

**computeTriesPerRound()**

- // Groups attempts by round and counts tries per round (PART-011 v3)
- const triesMap = {}
- gameState.attempts.forEach(a => {
  const round = a.metadata?.round || 1
  triesMap[round] = (triesMap[round] || 0) + 1
  })
- return Object.entries(triesMap).map(([round, triesCount]) => ({ round: Number(round), triesCount }))

**handlePostMessage(event)**

- if (!event.data || event.data.type !== 'game_init') return
- try:
  - const { gameId, content, contentSetId, signalConfig } = event.data.data
  - gameState.content = content
  - if (gameId) gameState.gameId = gameId
  - if (contentSetId) gameState.contentSetId = contentSetId
  - if (signalConfig) gameState.signalConfig = signalConfig
  - console.log('Content received:', JSON.stringify(gameState.content, null, 2))
  - // Configure SignalCollector with received signalConfig (PART-010 v3)
  - if (signalConfig && signalCollector) {
    signalCollector = new SignalCollector({ gameId: gameState.gameId, contentSetId: gameState.contentSetId, flushUrl: signalConfig.flushUrl, playId: signalConfig.playId });
    window.signalCollector = signalCollector;
    signalCollector.startFlushing();
    }
  - if (typeof Sentry !== 'undefined') { Sentry.addBreadcrumb({ category: 'postmessage', message: 'game_init received', level: 'info' }); }
- catch(e):
  - console.error('PostMessage error:', JSON.stringify({ error: e.message }, null, 2))
  - if (typeof Sentry !== 'undefined') { Sentry.captureException(e, { tags: { phase: 'initialization', severity: 'high' } }); }

**recordAttempt(data)**

- const attempt = { attempt_timestamp: new Date().toISOString(), time_since_start_of_game: gameState.startTime ? (Date.now() - gameState.startTime) / 1000 : 0, input_of_user: data.input_of_user, attempt_number: gameState.attempts.length + 1, correct: data.correct, metadata: data.metadata }
- gameState.attempts.push(attempt)

**trackEvent(type, target, data = {})**

- const event = { type, target, timestamp: Date.now(), data }
- gameState.events.push(event)
- console.log('Event:', JSON.stringify(event, null, 2))

### Window Exposure (RULE-001 / PART-026)

```javascript
window.endGame = endGame;
window.restartGame = restartGame;
window.loadRound = loadRound;
window.startGame = startGame;
```

### Package Script Order (PART-002 + PART-030)

```html
<!-- 1. Sentry Config + SDK FIRST (PART-030) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>
<script
  src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js"
  crossorigin="anonymous"
></script>

<!-- 2. Game Packages (PART-002) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

### Sentry Initialization (PART-030)

```javascript
function initSentry() {
  if (typeof Sentry === 'undefined' || typeof SentryConfig === 'undefined') return;
  if (!SentryConfig.enabled) return;

  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: SentryConfig.environment,
    release: 'matching-doubles@1.0.0',
    tracesSampleRate: SentryConfig.tracesSampleRate,
    sampleRate: SentryConfig.sampleRate,
    maxBreadcrumbs: 50,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Script error.',
      'Load failed',
      'Failed to fetch',
    ],
  });
}

window.addEventListener('load', initSentry);

// Global error handlers (PART-030)
window.addEventListener('error', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.error || new Error(event.message), {
      tags: { errorType: 'unhandled', severity: 'critical' },
      contexts: {
        errorEvent: { message: event.message, filename: event.filename, lineno: event.lineno },
      },
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.reason || new Error('Unhandled promise rejection'), {
      tags: { errorType: 'unhandled-promise', severity: 'critical' },
    });
  }
});
```

### waitForPackages (PART-003) — defined inline BEFORE DOMContentLoaded

```javascript
// MUST be defined inline in the <script> block — cannot come from external packages
// since its purpose is to wait for those packages to load.
async function waitForPackages() {
  const timeout = 10000;
  const interval = 50;
  let elapsed = 0;
  while (
    typeof ScreenLayout === 'undefined' ||
    typeof ProgressBarComponent === 'undefined' ||
    typeof TransitionScreenComponent === 'undefined' ||
    typeof TimerComponent === 'undefined' ||
    typeof FeedbackManager === 'undefined' ||
    typeof VisibilityTracker === 'undefined' ||
    typeof SignalCollector === 'undefined'
  ) {
    if (elapsed >= timeout) {
      throw new Error('Packages failed to load within 10s');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    elapsed += interval;
  }
  console.log('[matching-doubles] All packages loaded');
}
```

### Inside DOMContentLoaded (PART-004)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    if (typeof Sentry !== 'undefined') {
      Sentry.addBreadcrumb({ category: 'package-loading', message: 'All packages loaded', level: 'info' });
    }
    await FeedbackManager.init();

    // Preload all sound effects (PART-017) — see Section 11 for full URL list
    try {
      await FeedbackManager.sound.preload([
        { id: 'level_1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/daadc184-5a8a-4041-8c36-589dce11e9ad.mp3' },
        { id: 'level_2', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2ac37656-6559-4482-ad16-543b275c19da.mp3' },
        { id: 'level_3', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/dff10ee8-9019-43dc-90fb-9d3ee91208ba.mp3' },
        { id: 'rounds_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3' },
        { id: 'round_1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/ffef09bc-74ed-4814-bfad-79fdd5a5d5a2.mp3' },
        { id: 'round_2', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/97d60534-298b-4eba-8b8b-43a50f73cd81.mp3' },
        { id: 'round_3', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/f9f2cf9f-ceb2-406b-9c45-a43602959d81.mp3' },
        { id: 'tap_sound', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432016820.mp3' },
        { id: 'correct_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3' },
        { id: 'incorrect_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3' },
        { id: 'new_cards', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432104595.mp3' },
        { id: 'all_correct', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506764346.mp3' },
        { id: 'game_over_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506638331.mp3' },
        { id: 'game_over', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/5140e0b6-cada-4424-8e5d-f9cd06a0c83f.mp3' },
        { id: 'game_complete_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506659491.mp3' },
        { id: 'game_complete_1_star', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2ee85ea3-919b-4010-95a2-40bcd7d90d22.mp3' },
        { id: 'game_complete_2_star', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/84f4ff34-6e59-43d6-9663-4d9936cad002.mp3' },
        { id: 'victory_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506672258.mp3' },
        { id: 'victory', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/e252bcc4-bd5f-4195-ad04-a02582095b6d.mp3' },
        { id: 'restart', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/62109bc7-67bd-4e65-b06d-c760c144cd42.mp3' },
      ]);
    } catch (e) {
      console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2));
      if (typeof Sentry !== 'undefined') {
        Sentry.captureException(e, {
          tags: { phase: 'audio-playback', component: 'FeedbackManager', severity: 'medium' },
        });
      }
    }

    // SignalCollector (PART-010 v3) — initial creation with gameId only; flushUrl/playId/contentSetId configured in handlePostMessage after game_init
    signalCollector = new SignalCollector({
      gameId: gameState.gameId,
      contentSetId: gameState.contentSetId,
    });
    window.signalCollector = signalCollector;

    // ScreenLayout (PART-025)
    const layout = ScreenLayout.inject('app', {
      slots: { progressBar: true, transitionScreen: true },
    });

    // Clone template into gameContent
    const gameContent = document.getElementById('gameContent');
    const template = document.getElementById('game-template');
    gameContent.appendChild(template.content.cloneNode(true));

    // Timer (PART-006) — increasing, no auto-start, large endTime for unlimited count-up
    timer = new TimerComponent('timer-container', {
      timerType: 'increase',
      format: 'min',
      startTime: 0,
      endTime: 100000,
      autoStart: false,
    });

    // ProgressBar (PART-023)
    progressBar = new ProgressBarComponent({
      autoInject: true,
      totalRounds: 9,
      totalLives: 3,
      slotId: 'mathai-progress-slot',
    });

    // TransitionScreen (PART-024)
    transitionScreen = new TransitionScreenComponent({
      autoInject: true,
    });

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
          gameState.duration_data.totalInactiveTime += lastInactive.end - lastInactive.start;
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
        primaryText: 'Resume',
      },
    });

    // Fallback content for standalone testing
    if (!gameState.content) {
      gameState.content = fallbackContent;
    }

    // Listen for postMessage (PART-008)
    window.addEventListener('message', handlePostMessage);

    // Signal parent harness that game is ready to receive content (PART-008)
    window.parent.postMessage({ type: 'game_ready' }, '*');

    // Show start screen — "Let's go!" triggers startGame which shows Level 1 transition
    transitionScreen.show({
      icons: ['✖️', '2️⃣'],
      iconSize: 'large',
      title: 'Matching Doubles',
      subtitle: 'Match numbers with their doubles!',
      buttons: [
        {
          text: "Let's go!",
          type: 'primary',
          action: () => startGame(),
        },
      ],
    });
  } catch (e) {
    console.error('Init error:', JSON.stringify({ error: e.message }, null, 2));
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(e, { tags: { phase: 'initialization', severity: 'critical' } });
    }
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = () => {
  console.log(
    'Game State:',
    JSON.stringify(
      {
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        lives: gameState.lives,
        score: gameState.score,
        wrongAttempts: gameState.wrongAttempts,
        selectedLeftIndex: gameState.selectedLeftIndex,
        matchedPairs: [...gameState.matchedPairs],
        isActive: gameState.isActive,
      },
      null,
      2,
    ),
  );
};

window.debugAudio = () => {
  console.log('FeedbackManager available:', typeof FeedbackManager !== 'undefined');
};

window.testAudio = async (id) => {
  try {
    await FeedbackManager.sound.play(id || 'correct_sound_effect');
    console.log('Audio played successfully');
  } catch (e) {
    console.error('Audio test error:', JSON.stringify({ error: e.message }, null, 2));
  }
};

window.testPause = () => {
  if (timer) timer.pause();
};

window.testResume = () => {
  if (timer && gameState.isActive) timer.resume();
};

window.verifySentry = function () {
  const checks = {
    sdkLoaded: typeof Sentry !== 'undefined',
    initialized: typeof Sentry !== 'undefined' && Sentry.getClient() !== undefined,
    dsn: typeof Sentry !== 'undefined' && Sentry.getClient()?.getDsn()?.toString(),
  };
  console.log('Sentry Status:', JSON.stringify(checks, null, 2));
  return checks;
};

window.testSentry = function () {
  try {
    throw new Error('Test error from testSentry()');
  } catch (error) {
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, { tags: { test: true } });
      console.log('Test error sent to Sentry. Check dashboard.');
    } else {
      console.log('Sentry not loaded');
    }
  }
};
```

---

## 9. Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event      | Target | When Fired            |
| ---------- | ------ | --------------------- |
| game_start | game   | startGame() completes |
| game_end   | game   | endGame() fires       |

### Game-Specific Events

| Event          | Target | When Fired                                    | Data                                                             |
| -------------- | ------ | --------------------------------------------- | ---------------------------------------------------------------- |
| select_number  | left   | User taps a left-side number                  | { index, value }                                                 |
| correct_match  | grid   | User matches a number with its correct double | { leftIndex, rightIndex, number, double }                        |
| wrong_match    | grid   | User taps wrong double                        | { leftIndex, rightIndex, number, selectedDouble, correctDouble } |
| round_complete | game   | All pairs in round matched                    | { round, livesRemaining }                                        |
| life_lost      | game   | Wrong match costs a life                      | { livesRemaining }                                               |

### SignalCollector Events (PART-010 v3)

> **Note:** v3 uses `recordViewEvent()` and `recordCustomEvent()` only — no `startProblem()`/`endProblem()` lifecycle. Signals stream to GCS via batch flushing (`startFlushing()`), NOT included in `game_complete` postMessage.

**recordViewEvent types:**

| viewType            | When Emitted                                                   | Key Data                                                                           |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `screen_transition` | startGame() (start→gameplay), showResults() (gameplay→results) | screen, transition_from, reason                                                    |
| `content_render`    | renderGrid() — new round rendered                              | numbers, doubles, round, trigger: 'round_start', timer state, progress             |
| `visual_update`     | handleLeftClick() — number selected                            | type: 'number_selected', selected_index, selected_value, matched_count             |
| `visual_update`     | handleRightClick() correct — pair matched                      | type: 'pair_matched', left/right indices, number, double, matched_count            |
| `visual_update`     | handleRightClick() wrong — red flash                           | type: 'wrong_flash', right_index, lives_remaining                                  |
| `feedback_display`  | handleRightClick() correct                                     | feedback_type: 'correct', number, double                                           |
| `feedback_display`  | handleRightClick() wrong                                       | feedback_type: 'incorrect', number, selectedDouble, correctDouble, lives_remaining |

**recordCustomEvent calls:**

- `'visibility_hidden'` — VisibilityTracker onInactive
- `'visibility_visible'` — VisibilityTracker onResume
- `'round_solved'` — roundComplete(), with { correct: true, round }

**seal()** — called in endGame() AFTER `recordViewEvent('screen_transition')` to results and BEFORE postMessage. Fires sendBeacon to flush remaining events to GCS. Signal data is NOT included in postMessage.

---

## 10. Scaffold Points

| Point             | Function           | When                      | What Can Be Injected                          |
| ----------------- | ------------------ | ------------------------- | --------------------------------------------- |
| after_wrong_match | handleRightClick() | User selects wrong double | Hint showing correct double, visual highlight |
| before_round      | loadRound()        | New round starts          | Difficulty preview, strategy tip              |
| on_life_lost      | handleRightClick() | Life is lost              | Encouragement, remaining lives reminder       |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default
- Scaffold content is provided via postMessage

---

## 11. Feedback Triggers

> Note: All sounds are preloaded via `FeedbackManager.sound.preload()` (NOT `register()`). Stickers are passed in `sound.play()` options. No `playDynamicFeedback` is used — all audio is pre-recorded.

### Sound Preloading (PART-017)

```javascript
await FeedbackManager.sound.preload([
  // Level announcements
  { id: 'level_1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/daadc184-5a8a-4041-8c36-589dce11e9ad.mp3' },
  { id: 'level_2', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2ac37656-6559-4482-ad16-543b275c19da.mp3' },
  { id: 'level_3', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/dff10ee8-9019-43dc-90fb-9d3ee91208ba.mp3' },
  // Round transitions
  { id: 'rounds_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3' },
  { id: 'round_1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/ffef09bc-74ed-4814-bfad-79fdd5a5d5a2.mp3' },
  { id: 'round_2', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/97d60534-298b-4eba-8b8b-43a50f73cd81.mp3' },
  { id: 'round_3', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/f9f2cf9f-ceb2-406b-9c45-a43602959d81.mp3' },
  // Gameplay interactions
  { id: 'tap_sound', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432016820.mp3' },
  { id: 'correct_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3' },
  { id: 'incorrect_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3' },
  { id: 'new_cards', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432104595.mp3' },
  { id: 'all_correct', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506764346.mp3' },
  // Game over
  { id: 'game_over_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506638331.mp3' },
  { id: 'game_over', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/5140e0b6-cada-4424-8e5d-f9cd06a0c83f.mp3' },
  // Game complete (1-2 stars)
  { id: 'game_complete_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506659491.mp3' },
  { id: 'game_complete_1_star', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2ee85ea3-919b-4010-95a2-40bcd7d90d22.mp3' },
  { id: 'game_complete_2_star', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/84f4ff34-6e59-43d6-9663-4d9936cad002.mp3' },
  // Victory (3 stars)
  { id: 'victory_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506672258.mp3' },
  { id: 'victory', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/e252bcc4-bd5f-4195-ad04-a02582095b6d.mp3' },
  // Restart
  { id: 'restart', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/62109bc7-67bd-4e65-b06d-c760c144cd42.mp3' },
]);
```

### Sticker URLs

| Sticker trigger | Image URL | Type | Used when |
| --- | --- | --- | --- |
| question_audio_level_1 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif` | `IMAGE_GIF` | Level 1 transition |
| question_audio_level_2 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif` | `IMAGE_GIF` | Level 2 transition |
| question_audio_level_3 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-40.gif` | `IMAGE_GIF` | Level 3 transition |
| question_audio_round_1 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-44.gif` | `IMAGE_GIF` | Round 1 transition |
| question_audio_round_2 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-47.gif` | `IMAGE_GIF` | Round 2 transition |
| question_audio_round_3 | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1743761988949-52.gif` | `IMAGE_GIF` | Round 3 transition |
| question_audio_correct_sound_effect | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-20.gif` | `IMAGE_GIF` | Correct match |
| question_audio_incorrect_sound_effect | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-28.gif` | `IMAGE_GIF` | Wrong match |
| question_audio_all_correct | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-35.gif` | `IMAGE_GIF` | All pairs matched in round |
| question_audio_game_complete | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1754587201419-25.gif` | `IMAGE_GIF` | Game complete (1-2★) |
| question_audio_game_over | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-95.gif` | `IMAGE_GIF` | Game over |
| question_audio_victory | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-98.gif` | `IMAGE_GIF` | Victory (3★) |
| question_audio_restart | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-102.gif` | `IMAGE_GIF` | Restart |

### Audio Sequence by Game Phase

| Phase | Audio ID | Await? | Sticker |
| --- | --- | --- | --- |
| **Level transition** (rounds 0,3,6) | `level_1`/`level_2`/`level_3` | fire-and-forget (cancel on "I'm ready" click) | level sticker |
| **Round transition SFX** (every round) | `rounds_sound_effect` | await | round sticker + subtitle `Round N` |
| **Round transition announcement** (every round) | `round_1`/`round_2`/`round_3` | await (sequential after SFX) → auto-dismiss screen | round sticker + subtitle `Round N` |
| **Grid loaded** | `new_cards` | fire-and-forget | — |
| **Left cell tap** | `tap_sound` | fire-and-forget | — |
| **Correct match** | `correct_sound_effect` | fire-and-forget | question_audio_correct_sound_effect |
| **Wrong match** | `incorrect_sound_effect` | fire-and-forget | question_audio_incorrect_sound_effect |
| **All pairs matched** | `all_correct` | await | question_audio_all_correct + subtitle `"Good job! All cards matched!"` |
| **Game over** | `game_over_sound_effect` → `game_over` | both await, clear on retry | question_audio_game_over |
| **Complete 1★** | `game_complete_sound_effect` → `game_complete_1_star` | both await | question_audio_game_complete |
| **Complete 2★** | `game_complete_sound_effect` → `game_complete_2_star` | both await | question_audio_game_complete |
| **Victory 3★** | `victory_sound_effect` → `victory` | both await | question_audio_victory |
| **Restart** | `restart` | fire-and-forget | question_audio_restart |

---

## 12. Visual Specifications

- **Layout:** Two-column matching layout (Number | Doubles), max-width 320px, centered
- **Color palette:**
  - Default cells: white with var(--mathai-border-gray) border
  - Selected (left tap): cream/yellow bg (#FFF9E0) with gold border (#E8D98A)
  - Correct match: light green bg with green border
  - Wrong match: light red bg with red border (600ms flash)
  - Disabled right cells: grayed out, opacity 0.6
- **Typography:** Inter font, numbers 20px bold, instructions 16px, labels 14px
- **Cell size:** 70px × 56px, border-radius 10px
- **Spacing:** 10px gap between rows, 16px gap between left and right columns
- **Interactive states:**
  - Left cells: hoverable by default (unless matched)
  - Right cells: disabled by default, enabled after left selection
  - Matched cells: green bg, pointer-events: none
  - Wrong flash: red for 600ms
- **Transitions:** 0.15s ease for all state changes
- **Responsive:** Max-width 320px matching area within 480px game-wrapper

---

## 13. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.

### Scenario: Complete game with all correct answers (9 rounds)

```
SETUP: Page loaded, start transition screen visible
ACTIONS:
  click transition screen "Let's go!" button
  wait for #matching-grid to have children
  // Round 1: numbers=[2,5,6], doubles=[10,12,4]
  // 2×2=4 → doubles index 2, 5×2=10 → doubles index 0, 6×2=12 → doubles index 1
  click .left-cell[data-left-index="0"]  (number 2)
  wait for .left-cell[data-left-index="0"] to have class "selected"
  wait for .right-cell elements to NOT have class "disabled"
  click .right-cell[data-right-index="2"]  (double 4, correct: 2×2=4)
  wait for .left-cell[data-left-index="0"] to have class "matched"
  wait for .right-cell[data-right-index="2"] to have class "matched"
  click .left-cell[data-left-index="1"]  (number 5)
  click .right-cell[data-right-index="0"]  (double 10, correct: 5×2=10)
  click .left-cell[data-left-index="2"]  (number 6)
  click .right-cell[data-right-index="1"]  (double 12, correct: 6×2=12)
  wait for round to auto-advance (600ms)
  // Round 2: numbers=[3,7,4], doubles=[14,8,6]
  // 3×2=6 → index 2, 7×2=14 → index 0, 4×2=8 → index 1
  click .left-cell[data-left-index="0"] then .right-cell[data-right-index="2"]  (3→6)
  click .left-cell[data-left-index="1"] then .right-cell[data-right-index="0"]  (7→14)
  click .left-cell[data-left-index="2"] then .right-cell[data-right-index="1"]  (4→8)
  // Round 3: numbers=[8,1,9], doubles=[2,18,16]
  // 8×2=16 → index 2, 1×2=2 → index 0, 9×2=18 → index 1
  click .left-cell[data-left-index="0"] then .right-cell[data-right-index="2"]  (8→16)
  click .left-cell[data-left-index="1"] then .right-cell[data-right-index="0"]  (1→2)
  click .left-cell[data-left-index="2"] then .right-cell[data-right-index="1"]  (9→18)
  // Rounds 4-6: 4 numbers each (similar pattern)
  // Round 4: [4,8,1,6] → [16,2,12,8] → 4→8(idx3), 8→16(idx0), 1→2(idx1), 6→12(idx2)
  click (0→3), (1→0), (2→1), (3→2)
  // Round 5: [7,3,9,5] → [6,18,10,14] → 7→14(idx3), 3→6(idx0), 9→18(idx1), 5→10(idx2)
  click (0→3), (1→0), (2→1), (3→2)
  // Round 6: [11,2,8,15] → [4,30,22,16] → 11→22(idx2), 2→4(idx0), 8→16(idx3), 15→30(idx1)
  click (0→2), (1→0), (2→3), (3→1)
  // Rounds 7-9: 5 numbers each
  // Round 7: [3,9,6,12,7] → [18,14,24,6,12] → 3→6(idx3), 9→18(idx0), 6→12(idx4), 12→24(idx2), 7→14(idx1)
  click (0→3), (1→0), (2→4), (3→2), (4→1)
  // Round 8: [5,11,4,8,13] → [22,16,26,10,8] → 5→10(idx3), 11→22(idx0), 4→8(idx4), 8→16(idx1), 13→26(idx2)
  click (0→3), (1→0), (2→4), (3→1), (4→2)
  // Round 9: [14,2,10,6,9] → [4,20,18,28,12] → 14→28(idx3), 2→4(idx0), 10→20(idx1), 6→12(idx4), 9→18(idx2)
  click (0→3), (1→0), (2→1), (3→4), (4→2)
ASSERT:
  gameState.score == 9
  gameState.currentRound == 9
  #results-screen is visible
  #game-screen is hidden
  accuracy display shows "100%"
  gameState.lives == 3
```

### Scenario: Wrong match loses a life

```
SETUP: Page loaded, game started, round 1 visible
        numbers=[2,5,6], doubles=[10,12,4]
ACTIONS:
  click .left-cell[data-left-index="0"]  (number 2)
  wait for selected state
  click .right-cell[data-right-index="0"]  (double 10, WRONG: 2×2=4≠10)
ASSERT:
  .right-cell[data-right-index="0"] has class "wrong" (red flash — cosmetic, 600ms)
  gameState.lives == 2
  gameState.wrongAttempts == 1
  progressBar shows 2 hearts
  .left-cell[data-left-index="0"] no longer has "selected" class (deselected immediately)
  gameState.selectedLeftIndex == null (reset immediately)
  all unmatched .right-cell elements have "disabled" class (disabled immediately)
  gameState.isProcessing == false (released immediately — user can tap again without waiting)
  after 600ms, .right-cell[data-right-index="0"] "wrong" class removed (cosmetic only)
```

### Scenario: Game over when all lives lost

```
SETUP: Page loaded, game started, lives = 1
ACTIONS:
  click left number, then click wrong double (3 times total to lose all lives)
ASSERT:
  gameState.lives == 0
  endGame('game_over') called
  results-title shows "Game Over"
  stars display shows 0 stars
  game_over_sound_effect and game_over audio played sequentially
```

### Scenario: Right side disabled until left is clicked

```
SETUP: Page loaded, game started, round 1 visible
ASSERT:
  all .right-cell elements have class "disabled"
  .right-cell elements have pointer-events: none
ACTIONS:
  click .left-cell[data-left-index="0"]
ASSERT:
  all unmatched .right-cell elements no longer have "disabled" class
  .right-cell elements are clickable
```

### Scenario: Deselect left by clicking another left number

```
SETUP: Game started, round 1
ACTIONS:
  click .left-cell[data-left-index="0"]  (select number 2)
  click .left-cell[data-left-index="1"]  (select number 5 instead)
ASSERT:
  .left-cell[data-left-index="0"] does NOT have "selected" class
  .left-cell[data-left-index="1"] has "selected" class
  gameState.selectedLeftIndex == 1
```

### Scenario: Matched cells are not re-clickable

```
SETUP: Game started, matched pair (leftIndex=0, rightIndex=2) in round 1
ACTIONS:
  click .left-cell[data-left-index="0"]
ASSERT:
  no change (cell has pointer-events: none)
  gameState.selectedLeftIndex remains null
```

### Scenario: Grid size increases with rounds

```
SETUP: Game started
ASSERT:
  Round 1: #matching-grid has 3 .matching-row elements
  Round 4 (after completing rounds 1-3): #matching-grid has 4 .matching-row elements
  Round 7 (after completing rounds 1-6): #matching-grid has 5 .matching-row elements
```

### Scenario: Auto-advance between rounds (no transition screen)

```
SETUP: Game started, round 1
ACTIONS:
  complete all 3 pairs correctly
ASSERT:
  after 600ms delay, round 2 loads automatically
  NO transition screen shown between rounds
  progressBar updates to "1/9 rounds completed"
  new numbers appear in #matching-grid
```

### Scenario: Star rating based on time

```
SETUP: Complete all 9 rounds with no wrong answers
ASSERT:
  if totalTime <= 60: stars == 3
  if totalTime <= 90: stars == 2
  if totalTime > 90: stars == 1
  game over (lives lost) always: stars == 0
```

### Scenario: Timer pauses on tab switch

```
SETUP: Game started, timer running
ACTIONS:
  simulate tab hidden (visibilitychange event)
ASSERT:
  timer.pause({ fromVisibilityTracker: true }) called
  FeedbackManager.sound.pause() called
  FeedbackManager.stream.pauseAll() called
  signalCollector.pause() called
  signalCollector.recordCustomEvent('visibility_hidden', {}) called
  duration_data.inActiveTime has new entry
  simulate tab visible:
  timer.resume({ fromVisibilityTracker: true }) called (only if isPaused)
  FeedbackManager.sound.resume() called
  FeedbackManager.stream.resumeAll() called
  signalCollector.resume() called
  signalCollector.recordCustomEvent('visibility_visible', {}) called
  inActiveTime entry gets end timestamp
```

### Scenario: ProgressBar shows correct state

```
SETUP: Game started
ASSERT:
  progressBar shows "0/9 rounds completed" and 3 hearts
  after round 1: "1/9 rounds completed" and 3 hearts
  after wrong match: hearts reduced to 2
```

### Scenario: Restart game resets everything

```
SETUP: Game completed (victory or game over), results screen visible
ACTIONS:
  click #btn-restart
ASSERT:
  transition screen appears
  gameState.currentRound == 0
  gameState.lives == 3
  gameState.wrongAttempts == 0
  gameState.score == 0
  timer recreated
  progressBar recreated
  visibilityTracker recreated
```

### Scenario: PostMessage integration

```
SETUP: Page loaded
ACTIONS:
  window.postMessage({ type: 'game_init', data: { content: { rounds: [...] } } }, '*')
ASSERT:
  gameState.content is set with received rounds
```

### Scenario: Page load and initialization

```
SETUP: Fresh page load
ASSERT:
  waitForPackages() resolves
  FeedbackManager.init() called
  sound.preload() called with all 20 audio IDs (level_1-3, round_1-3, rounds_sound_effect, tap_sound, correct/incorrect_sound_effect, new_cards, all_correct, game_over/sfx, game_complete/sfx/1star/2star, victory/sfx, restart)
  ScreenLayout.inject() called with progressBar=true, transitionScreen=true
  template cloned into #gameContent
  TimerComponent created (increase, endTime: 100000, no autoStart)
  ProgressBarComponent created (totalRounds: 9, totalLives: 3)
  TransitionScreenComponent created
  VisibilityTracker created
  start transition screen shown
```

---

## 14. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] SentryConfig + Sentry SDK scripts loaded FIRST, before game packages (PART-030)
- [ ] Package scripts in correct order: FeedbackManager → Components → Helpers (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `#app` div exists in body
- [ ] `#game-screen` element exists inside template
- [ ] `#results-screen` element exists, hidden by default
- [ ] `#timer-container` element exists inside game-screen

### Functional

- [ ] waitForPackages() defined **inline** in the `<script>` block (NOT imported from a package) — polls for ScreenLayout, ProgressBarComponent, TransitionScreenComponent, TimerComponent, FeedbackManager, VisibilityTracker, SignalCollector with 10s timeout (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] VisibilityTracker created with onInactive (pause signalCollector + timer + sound + streams) + onResume (resume signalCollector + timer + sound + streams) (PART-005)
- [ ] TimerComponent created with timerType: 'increase', startTime: 0, endTime: 100000, autoStart: false (PART-006)
- [ ] handlePostMessage registered and handles game_init — extracts `gameId`, `content`, `contentSetId`, `signalConfig` (PART-008)
- [ ] `window.parent.postMessage({ type: 'game_ready' }, '*')` sent AFTER registering message listener (PART-008)
- [ ] Fallback content available for standalone testing (PART-008)
- [ ] recordAttempt produces correct attempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] endGame calculates metrics (including `totalLives`, `tries`, `sessionHistory`), logs, sends `game_complete` postMessage (no signal payload), cleans up (PART-011 v3)
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume, verifySentry, testSentry (PART-012, PART-030)
- [ ] showResults uses `classList.add('hidden')` / `classList.remove('hidden')` to toggle screens — NOT `style.display` (`.hidden` uses `!important`) (PART-019)
- [ ] InputSchema defined with 9 rounds of fallback content (PART-028)
- [ ] No anti-patterns present (PART-026)

### Feedback / Audio (PART-017)

- [ ] `sound.preload()` called with array of `{id, url}` objects — NOT `sound.register()`
- [ ] No `sound.register()` calls anywhere
- [ ] All 20 audio IDs preloaded with correct cdn.mathai.ai URLs
- [ ] `sound.play()` includes `sticker` option where specified (with correct GIF URLs, type: 'IMAGE_GIF')
- [ ] No `playDynamicFeedback()` calls — all audio is pre-recorded via `sound.play()`
- [ ] Level transition: plays level audio (fire-and-forget), cancels on "I'm ready" click
- [ ] Round transition: plays `rounds_sound_effect` (await) THEN `round_1`/`round_2`/`round_3` (await) — both with round sticker + subtitle — auto-dismisses after both finish
- [ ] `new_cards` plays fire-and-forget after grid renders
- [ ] `tap_sound` plays fire-and-forget on left cell tap
- [ ] `all_correct` plays await after all pairs matched, with subtitle `"Good job! All cards matched!"`
- [ ] Game over: `game_over_sound_effect` → `game_over` (both await, clear on retry)
- [ ] Victory 3★: `victory_sound_effect` → `victory` (both await)
- [ ] Complete 1-2★: `game_complete_sound_effect` → `game_complete_1_star`/`game_complete_2_star` (both await)
- [ ] No `new Audio()` anywhere
- [ ] VisibilityTracker uses `sound.pause()`/`sound.resume()` — NOT `sound.stopAll()`

### Design & Layout

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors (PART-020) — border uses `var(--mathai-border-gray)`
- [ ] `.page-center` / `.game-wrapper` / `.game-stack` layout via ScreenLayout (PART-021)
- [ ] Max-width 480px game-wrapper, uses 100dvh not 100vh (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` classes (PART-022)
- [ ] ProgressBar created with totalRounds: 9, totalLives: 3 (PART-023)
- [ ] ProgressBar.update() first param is rounds COMPLETED (0 at start) (PART-023)
- [ ] TransitionScreen shows start, victory, game-over screens (PART-024)
- [ ] ScreenLayout.inject() called before ProgressBar/TransitionScreen (PART-025)
- [ ] All game content rendered inside `#gameContent` via template cloneNode (PART-025)

### Rules Compliance

- [ ] RULE-001: All onclick handlers / functions in global scope
- [ ] RULE-002: All async functions have async keyword
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame guarded by `gameState.gameEnded` check — prevents race condition when restartGame() is called during end-game audio (timer, progressBar, visibilityTracker destroyed, sounds stopped)
- [ ] RULE-006: No new Audio(), no setInterval for timer, no SubtitleComponent.show(), no sound.register()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific

- [ ] Two-column layout: "Number" on left, "Doubles" on right
- [ ] Left column is interactable first; right column starts disabled
- [ ] Clicking left cell enables all unmatched right cells
- [ ] Correct match: both cells turn green (.matched), disabled
- [ ] Wrong match: right cell flashes red for 600ms, 1 life lost, selection resets
- [ ] All right cells re-disabled after match attempt (correct or wrong)
- [ ] Round auto-advances when all pairs matched (no transition screen between rounds)
- [ ] 9 rounds total: rounds 1-3 = 3 pairs, rounds 4-6 = 4 pairs, rounds 7-9 = 5 pairs
- [ ] 3 lives total — game over when all lost
- [ ] Timer is count-up (increasing), starts on game start
- [ ] Stars: ≤60s = 3★, ≤90s = 2★, >90s = 1★, game-over = 0★
- [ ] ProgressBar shows "X/9 rounds completed" and heart lives
- [ ] All doubles in fallback content are verified (number × 2) and shuffled
- [ ] Level transitions shown at rounds 0, 3, 6 (Level 1, 2, 3) with "I'm ready" button
- [ ] Round transitions shown before every round with auto-dismiss after audio
- [ ] 20 sounds preloaded, 13 stickers mapped — see Section 11 for full list
- [ ] `gameState` declared as `window.gameState = {...}`, NOT `const gameState = {...}`
- [ ] `gameState.gameId` set as first property (`'game_matching_doubles'`)
- [ ] `gameState.gameEnded` flag used as endGame guard (prevents double-call)
- [ ] `gameState.isProcessing` flag guards handleRightClick during async feedback
- [ ] `gameState.phase` tracks current game phase
- [ ] Window exposure block: `window.endGame`, `window.restartGame`, `window.loadRound`, `window.startGame`
- [ ] `restartGame()` recreates timer, progressBar, and visibilityTracker
- [ ] `testPause`/`testResume` call `timer.pause()`/`timer.resume()` directly
- [ ] Transition screens use `buttons` (not `duration`)
- [ ] Count-up timer uses `endTime: 100000` (large value for unlimited count-up)

### Sentry Error Tracking (PART-030)

- [ ] SentryConfig script tag loaded BEFORE Sentry SDK
- [ ] Sentry SDK version 10.23.0 (NOT 8.x)
- [ ] `initSentry()` function defined BEFORE SDK loads
- [ ] `SentryConfig.enabled` checked before initializing
- [ ] `SentryConfig.dsn` used (NOT hardcoded DSN)
- [ ] `window.addEventListener('load', initSentry)` triggers initialization
- [ ] All 6 ignore patterns included in `Sentry.init()`
- [ ] Global error handler registered (`window.addEventListener('error', ...)`)
- [ ] Unhandled promise rejection handler registered (`window.addEventListener('unhandledrejection', ...)`)
- [ ] Breadcrumbs added at key lifecycle points (package loading, game_init, game complete)
- [ ] `verifySentry()` uses `Sentry.getClient()` (NOT `getCurrentHub().getClient()`)
- [ ] `verifySentry()` and `testSentry()` debug functions on window

### SignalCollector (PART-010 v3)

- [ ] SignalCollector initialized with `gameId` + `contentSetId` (NOT `templateId`)
- [ ] `window.signalCollector` assigned
- [ ] `let signalCollector = null` declared globally
- [ ] `handlePostMessage` extracts `gameId`, `contentSetId`, `signalConfig` from `game_init` and reconfigures SignalCollector with `flushUrl` + `playId`
- [ ] `startFlushing()` called after SignalCollector receives `signalConfig` (in handlePostMessage)
- [ ] No `startProblem()` / `endProblem()` / `updateCurrentAnswer()` calls anywhere (v2 deprecated)
- [ ] `recordViewEvent` called in every DOM-modifying function (screen_transition, content_render, feedback_display, visual_update)
- [ ] `recordViewEvent('screen_transition', { screen: 'results' })` called BEFORE `seal()` in endGame
- [ ] `data-signal-id` attributes on important interactive elements (left-cell-{i}, right-cell-{i}, matching-grid, restart-button)
- [ ] `seal()` called in endGame before postMessage — fires sendBeacon, stops flush timer
- [ ] Signal data NOT spread into `game_complete` postMessage (signals stream to GCS)
- [ ] SignalCollector integrated with VisibilityTracker (pause/resume + custom events)
- [ ] Signals separate from attempt_history
- [ ] No inline stub/polyfill for SignalCollector (Anti-Pattern 18)
- [ ] Restart pattern recreates SignalCollector with v3 constructor + calls `startFlushing()`
- [ ] `computeTriesPerRound()` implemented for PART-011 v3 metrics
- [ ] `totalLives`, `tries`, `sessionHistory` included in metrics object
- [ ] `restartGame()` pushes session snapshot to `sessionHistory` before resetting
- [ ] `restartGame()` preserves `content`, `contentSetId`, `signalConfig`, `sessionHistory`

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
