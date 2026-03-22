# Associations — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Associations
- **Game ID:** game_associations
- **Type:** standard
- **Description:** Paired-recall memory game. Phase 1: learn emoji-name pairs shown sequentially. Phase 2: match emojis to names from multiple choices. Unlimited lives, scored by accuracy percentage. 3 rounds of increasing difficulty.

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | — |
| PART-002 | Package Scripts | YES | — |
| PART-003 | waitForPackages | YES | — |
| PART-004 | Initialization Block | YES | — |
| PART-005 | VisibilityTracker | YES | popupProps: default |
| PART-006 | TimerComponent | YES | timerType: 'increase', startTime: 0, autoStart: false, format: 'min' |
| PART-007 | Game State Object | YES | Custom fields: phase, pairs, distractors, currentPairIndex, recallOrder, recallIndex, correctCount, totalQuestions, roundCorrect, roundTotal |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | — |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: learn_pair, learn_complete, match_correct, match_wrong, round_complete. SignalCollector integrated for input capture & problem-level signals. |
| PART-011 | End Game & Metrics | YES | Custom star logic: accuracy-based (100%->3, >=60%->2, >=30%->1, <30%->0) |
| PART-012 | Debug Functions | YES | — |
| PART-013 | Validation Fixed | YES | Rule: selected name must match correct name for displayed emoji |
| PART-014 | Validation Function | NO | — |
| PART-015 | Validation LLM | NO | — |
| PART-016 | StoriesComponent | NO | — |
| PART-017 | Feedback Integration | NO | Not needed for this game |
| PART-018 | Case Converter | NO | — |
| PART-019 | Results Screen UI | YES | Custom metrics: total correct, total questions, accuracy |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | — |
| PART-022 | Game Buttons | YES | — |
| PART-023 | ProgressBar Component | YES | totalRounds: 3, totalLives: 0 (no lives display) |
| PART-024 | TransitionScreen Component | YES | Screens: start, level-transition, victory, game-over |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | Verification checklist, not code-generating |
| PART-027 | Play Area Construction | YES | Layout: centered emoji + 4 choice buttons |
| PART-028 | InputSchema Patterns | YES | Schema type: rounds with pairs and distractors |
| PART-029 | Story-Only Game | NO | — |
| PART-030 | Sentry Error Tracking | YES | SentryConfig-based centralized pattern, SDK v10.23.0, replay/profiling/console integrations |
| PART-031 | API Helper | NO | — |
| PART-032 | AnalyticsManager | NO | — |
| PART-033 | Interaction Patterns | NO | — |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | Serializes Section 4 to inputSchema.json |
| PART-035 | Test Plan Generation | YES (POST_GEN) | Generates tests.md after HTML |
| PART-037 | Playwright Testing | YES (POST_GEN) | Ralph loop generates tests + fix cycle |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 3,
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
  phase: 'idle',                // 'idle' | 'learn' | 'recall' | 'feedback'
  pairs: [],                    // Array of { emoji, name } for current round
  distractors: [],              // Array of distractor names for choices
  exposureDuration: 3000,       // Ms to show each pair during learn phase
  currentPairIndex: 0,          // Index of pair being shown during learn phase
  recallOrder: [],              // Shuffled order for recall phase (indices into pairs)
  recallIndex: 0,               // Current recall question index
  correctCount: 0,              // Total correct across all rounds
  totalQuestions: 0,            // Total questions asked across all rounds
  roundCorrect: 0,              // Correct in current round
  roundTotal: 0,                // Total in current round
  roundStartTime: null,
  roundTimes: [],
  pendingEndProblem: null
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
          "pairs": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "emoji": { "type": "string", "description": "Emoji character for avatar" },
                "name": { "type": "string", "description": "Name associated with this emoji" }
              },
              "required": ["emoji", "name"]
            },
            "minItems": 3,
            "maxItems": 5,
            "description": "Emoji-name pairs to learn"
          },
          "distractors": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1,
            "description": "Extra names used as wrong choices (combined with correct name + other round names to make 4 choices)"
          },
          "exposureDuration": {
            "type": "integer",
            "description": "Milliseconds to show each pair during learn phase"
          }
        },
        "required": ["pairs", "distractors", "exposureDuration"]
      }
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

> **CRITICAL: Each round item is a pair object with shape `{ emoji: string, name: string }`. Round data lives in `content.rounds[n].pairs[]`. `window.gameState.content` contains the actual game rounds — NOT `window.gameState.pairs` (that is the loaded-for-current-round slice). Do NOT use SignalCollector API surface names ('Event', 'Target', 'Input', 'Action', etc.) as fallback content values — those are CDN SignalCollector class names, not game content. If `window.gameState.content` is null when the DOM snapshot runs, the pipeline's fallbackContent must use realistic human names (e.g., 'Emma', 'Liam') and emoji characters, matching exactly the structure below.**

All 3 rounds verified — each pair has unique emoji and name, distractors do not overlap with correct names, 4 choices always available.

```javascript
const fallbackContent = {
  rounds: [
    // Round 1: 3 pairs, 3s exposure
    // Pairs: Emma, Liam, Sofia
    // Distractors: Noah (ensures 4 choices per question)
    // Verification: 3 unique emojis ✓, 3 unique names ✓, 1 distractor ✓
    // Choice generation: for each emoji, choices = [correctName, ...3 others from remaining names + distractors]
    {
      pairs: [
        { emoji: '👩', name: 'Emma' },
        { emoji: '👨', name: 'Liam' },
        { emoji: '👧', name: 'Sofia' }
      ],
      distractors: ['Noah'],
      exposureDuration: 3000
    },
    // Round 2: 4 pairs, 2.5s exposure
    // Pairs: Mia, James, Zoe, Leo
    // Distractors: Aria (ensures 4 choices even for last pair)
    // Verification: 4 unique emojis ✓, 4 unique names ✓, 1 distractor ✓
    {
      pairs: [
        { emoji: '👵', name: 'Mia' },
        { emoji: '👦', name: 'James' },
        { emoji: '🧑', name: 'Zoe' },
        { emoji: '👴', name: 'Leo' }
      ],
      distractors: ['Aria'],
      exposureDuration: 2500
    },
    // Round 3: 5 pairs, 2s exposure
    // Pairs: Lily, Max, Ruby, Finn, Ivy
    // Distractors: (none needed — 5 names means 4 wrong choices always available from other pairs)
    // Verification: 5 unique emojis ✓, 5 unique names ✓
    {
      pairs: [
        { emoji: '👩', name: 'Lily' },
        { emoji: '👨', name: 'Max' },
        { emoji: '👧', name: 'Ruby' },
        { emoji: '👦', name: 'Finn' },
        { emoji: '🧑', name: 'Ivy' }
      ],
      distractors: [],
      exposureDuration: 2000
    }
  ]
};
```

---

## 5. Screens & HTML Structure

### Body HTML (uses `<template>` for ScreenLayout compatibility — PART-025)

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <div id="timer-container"></div>

    <div class="instruction-area">
      <p class="instruction-text" id="instruction-text">Remember each face and name!</p>
    </div>

    <!-- Learn Phase Display -->
    <div class="learn-area" id="learn-area">
      <div class="learn-emoji" id="learn-emoji" data-signal-id="learn-emoji"></div>
      <div class="learn-name" id="learn-name" data-signal-id="learn-name"></div>
      <div class="learn-progress" id="learn-progress"></div>
    </div>

    <!-- Recall Phase Display -->
    <div class="recall-area" id="recall-area" style="display: none;">
      <div class="recall-emoji" id="recall-emoji" data-signal-id="recall-emoji"></div>
      <p class="recall-prompt" id="recall-prompt">Who is this?</p>
      <div class="choices-grid" id="choices-grid" data-signal-id="choices-grid">
        <!-- 4 choice buttons generated by JavaScript (each gets data-signal-id="choice-N") -->
      </div>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display: none;">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title">Game Complete!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Score</span>
          <span class="metric-value" id="result-score">0/0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Time</span>
          <span class="metric-value" id="result-time">0:00</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Correct</span>
          <span class="metric-value" id="result-correct">0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Total Questions</span>
          <span class="metric-value" id="result-total">0</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy</span>
          <span class="metric-value" id="result-accuracy">0%</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="restart-button" onclick="restartGame()">Play Again</button>
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
  --mathai-light-green: #EAFBF1;
  --mathai-red: #E35757;
  --mathai-light-red: #FDECEC;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #EBF0FF;
  --mathai-gray: #828282;
  --mathai-light-gray: #F2F2F2;
  --mathai-white: #FFFFFF;
  --mathai-black: #1A1A2E;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 12px;
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-light-gray);
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
  gap: 16px;
}

/* === Instruction Area === */
.instruction-area {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 0 4px;
  text-align: center;
}

.instruction-text {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
  line-height: 1.5;
  margin-bottom: 4px;
  font-weight: 600;
}

/* === Learn Phase === */
.learn-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 24px 0;
}

.learn-emoji {
  font-size: 80px;
  line-height: 1;
  animation: fadeInUp 0.3s ease;
}

.learn-name {
  font-size: var(--mathai-font-size-title);
  font-weight: 700;
  color: var(--mathai-black);
  animation: fadeInUp 0.3s ease 0.1s both;
}

.learn-progress {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  margin-top: 8px;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === Recall Phase === */
.recall-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 16px 0;
}

.recall-emoji {
  font-size: 72px;
  line-height: 1;
}

.recall-prompt {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-gray);
  font-weight: 600;
}

/* === Choices Grid === */
.choices-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
  max-width: 300px;
}

.choice-btn {
  padding: 14px 8px;
  border: 2px solid #E0E0E0;
  border-radius: 12px;
  background: var(--mathai-white);
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  color: var(--mathai-black);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  text-align: center;
}

.choice-btn:hover {
  background: #F8F8F8;
  border-color: var(--mathai-blue);
}

.choice-btn:active {
  transform: scale(0.97);
}

.choice-btn.correct {
  background: var(--mathai-light-green);
  border-color: var(--mathai-green);
  color: var(--mathai-green);
  pointer-events: none;
}

.choice-btn.wrong {
  background: var(--mathai-light-red);
  border-color: var(--mathai-red);
  color: var(--mathai-red);
  pointer-events: none;
}

.choice-btn:disabled {
  pointer-events: none;
  opacity: 0.6;
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
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.game-btn:active { transform: scale(0.97); }

.btn-primary {
  background: var(--mathai-blue);
  color: var(--mathai-white);
}

.btn-primary:hover { background: #1d4ed8; }

/* === Results Card (PART-019) === */
.results-card {
  width: 100%;
  max-width: 340px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.stars-display { font-size: 36px; margin-bottom: 12px; }

.results-title {
  font-size: var(--mathai-font-size-title);
  font-weight: 700;
  margin-bottom: 20px;
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
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-label { font-size: var(--mathai-font-size-label); color: var(--mathai-gray); }
.metric-value { font-size: var(--mathai-font-size-body); font-weight: 600; color: var(--mathai-black); }
```

---

## 7. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - waitForPackages() with 10s timeout
   - // DO NOT call FeedbackManager.init() — PART-015 auto-inits on load. Calling it shows a blocking audio popup that breaks all tests.
   - SignalCollector creation (sessionId, studentId, templateId) + assign to window.signalCollector
   - TimerComponent creation (increase, startTime: 0, autoStart: false, format: 'min')
   - VisibilityTracker creation (with SignalCollector pause/resume integration)
   - ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })
   - Clone `#game-template` into `#app`
   - TransitionScreen.show('start') with title "Associations" and subtitle "Remember the faces!"

2. **setupGame()** runs (after start transition dismissed):
   - Load content from gameState.content or fallbackContent
   - Reset state: currentRound=0, score=0, correctCount=0, totalQuestions=0, phase='idle'
   - Set gameState.startTime = Date.now(), isActive = true
   - timer.start()
   - progressBar.update(0, 0) — 0 rounds completed, no lives display
   - trackEvent('game_start', 'game')
   - Call startRound()

3. **startRound()** — begins learn phase:
   - Get round data from content.rounds[currentRound]
   - Set pairs, distractors, exposureDuration
   - Reset roundCorrect=0, roundTotal=0, currentPairIndex=0
   - Show learn-area, hide recall-area
   - Update instruction: "Remember each face and name!"
   - phase = 'learn'
   - Call showNextPair()

4. **showNextPair()** — shows one emoji+name pair:
   - If currentPairIndex >= pairs.length:
     - Learn phase complete, trackEvent('learn_complete')
     - transition to recall phase: startRecallPhase()
     - return
   - Display pairs[currentPairIndex].emoji and .name
   - Show progress "Pair X of Y"
   - trackEvent('learn_pair', 'game', { index, emoji, name })
   - After exposureDuration, increment currentPairIndex, call showNextPair()

5. **startRecallPhase()** — shows emojis in shuffled order with choices:
   - phase = 'recall'
   - Generate recallOrder (shuffled indices of pairs)
   - recallIndex = 0
   - Hide learn-area, show recall-area
   - Update instruction: "Who is this?"
   - roundStartTime = Date.now()
   - showRecallQuestion()

6. **showRecallQuestion()** — displays current emoji with 4 name choices:
   - Get pair at recallOrder[recallIndex]
   - Show emoji
   - Generate 4 choices: correct name + 3 from other pair names + distractors (shuffled)
   - Render choice buttons with onclick="handleChoice('name')"

7. **handleChoice(selectedName)** — player picks a name:
   - phase = 'feedback'
   - Determine isCorrect
   - Show correct/wrong styling on buttons
   - recordAttempt
   - If correct:
     - correctCount++, roundCorrect++
     - FeedbackManager.playDynamicFeedback correct
   - If wrong:
     - FeedbackManager.playDynamicFeedback with correct name
   - totalQuestions++, roundTotal++
   - After delay, advance to next recall question or next round

8. **End condition:**
   - All 3 rounds completed -> endGame()
   - No game-over since unlimited lives — always completes all rounds

> **CRITICAL: This is an ACCURACY-SCORED game with NO lives system. `totalLives: 0`, `livesEnabled: false`. DO NOT generate tests that check for heart (❤️) display, lives count, or lives decrement. This game has no lives. Hearts never render. Use `correctCount`/`totalQuestions` for scoring assertions only. The ProgressBar is configured with `totalLives: 0` which disables all lives UI.**

---

## 8. Functions

### Global Scope (RULE-001)

**setupGame()**
- `const content = gameState.content || fallbackContent`
- Reset: `gameState.currentRound = 0`, `gameState.score = 0`, `gameState.correctCount = 0`, `gameState.totalQuestions = 0`, `gameState.attempts = []`, `gameState.events = []`, `gameState.roundTimes = []`, `gameState.phase = 'idle'`
- `gameState.startTime = Date.now()`, `gameState.isActive = true`
- `timer.start()`
- `progressBar.update(0, 0)`
- `trackEvent('game_start', 'game')`
- Record screen transition:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'gameplay',
      metadata: { transition_from: 'ready' }
    });
  }
  ```
- `startRound()`

**async startRound()**
- Flush deferred endProblem from previous round:
  ```javascript
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }
  ```
- `const content = gameState.content || fallbackContent`
- `const round = content.rounds[gameState.currentRound]`
- Start signal collection for this round:
  ```javascript
  if (signalCollector) {
    signalCollector.startProblem('round_' + (gameState.currentRound + 1), {
      round_number: gameState.currentRound + 1,
      question_text: round.pairs.map(p => p.emoji + '=' + p.name).join(', '),
      correct_answer: round.pairs.map(p => p.name),
      difficulty: round.pairs.length
    });
  }
  ```
- `gameState.pairs = round.pairs`
- `gameState.distractors = round.distractors`
- `gameState.exposureDuration = round.exposureDuration`
- `gameState.currentPairIndex = 0`
- `gameState.roundCorrect = 0`
- `gameState.roundTotal = 0`
- Show learn-area, hide recall-area
- `document.getElementById('instruction-text').textContent = 'Remember each face and name!'`
- `gameState.phase = 'learn'`
- `showNextPair()`

**async showNextPair()**
- If `gameState.currentPairIndex >= gameState.pairs.length`:
  - `trackEvent('learn_complete', 'game', { round: gameState.currentRound + 1 })`
  - `await delay(500)`
  - `startRecallPhase()`
  - return
- `const pair = gameState.pairs[gameState.currentPairIndex]`
- `document.getElementById('learn-emoji').textContent = pair.emoji`
- `document.getElementById('learn-name').textContent = pair.name`
- `document.getElementById('learn-progress').textContent = 'Pair ' + (gameState.currentPairIndex + 1) + ' of ' + gameState.pairs.length`
- `trackEvent('learn_pair', 'game', { round: gameState.currentRound + 1, index: gameState.currentPairIndex, emoji: pair.emoji, name: pair.name })`
- Record view event for pair display:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        phase: 'learn',
        emoji: pair.emoji,
        name: pair.name,
        pair_index: gameState.currentPairIndex + 1,
        total_pairs: gameState.pairs.length,
        trigger: 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: gameState.currentRound + 1, total: gameState.totalRounds }
      }
    });
  }
  ```
- `await delay(gameState.exposureDuration)`
- `gameState.currentPairIndex++`
- `showNextPair()`

**startRecallPhase()**
- `gameState.phase = 'recall'`
- Generate shuffled recall order: `gameState.recallOrder = shuffleArray([...Array(gameState.pairs.length).keys()])`
- `gameState.recallIndex = 0`
- `document.getElementById('learn-area').style.display = 'none'`
- `document.getElementById('recall-area').style.display = 'flex'`
- `document.getElementById('instruction-text').textContent = 'Who is this?'`
- `gameState.roundStartTime = Date.now()`
- Record visual update for phase switch:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'phase_switch',
        from_phase: 'learn',
        to_phase: 'recall',
        round: gameState.currentRound + 1,
        recall_count: gameState.recallOrder.length,
        trigger: 'user_action'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: gameState.currentRound + 1, total: gameState.totalRounds }
      }
    });
  }
  ```
- `showRecallQuestion()`

**showRecallQuestion()**
- If `gameState.recallIndex >= gameState.recallOrder.length`:
  - Round complete
  - `const roundTime = (Date.now() - gameState.roundStartTime) / 1000`
  - `gameState.roundTimes.push(roundTime)`
  - `trackEvent('round_complete', 'game', { round: gameState.currentRound + 1, correct: gameState.roundCorrect, total: gameState.roundTotal })`
  - If perfect round: try { `FeedbackManager.playDynamicFeedback({ audio_content: 'amazing memory!', subtitle: 'Amazing memory!' })` } catch(e) { console.error(JSON.stringify(e)) }
  - `nextRound()`
  - return
- `const pairIndex = gameState.recallOrder[gameState.recallIndex]`
- `const pair = gameState.pairs[pairIndex]`
- `document.getElementById('recall-emoji').textContent = pair.emoji`
- Generate 4 choices:
  ```javascript
  const correctName = pair.name;
  const otherNames = gameState.pairs
    .filter((_, i) => i !== pairIndex)
    .map(p => p.name)
    .concat(gameState.distractors);
  const wrongChoices = shuffleArray(otherNames).slice(0, 3);
  const allChoices = shuffleArray([correctName, ...wrongChoices]);
  ```
- Render choices in #choices-grid:
  ```javascript
  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  allChoices.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.setAttribute('data-signal-id', 'choice-' + i);
    btn.textContent = name;
    btn.onclick = () => handleChoice(name);
    grid.appendChild(btn);
  });
  ```
- Record view event for content render:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        emoji: pair.emoji,
        correct_name: pair.name,
        choices: allChoices,
        recall_index: gameState.recallIndex + 1,
        recall_total: gameState.recallOrder.length,
        trigger: 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: gameState.currentRound + 1, total: gameState.totalRounds }
      }
    });
  }
  ```

**async handleChoice(selectedName)** (via onclick on choice buttons — function in global scope)
- If `gameState.phase !== 'recall' || !gameState.isActive` return
- `gameState.phase = 'feedback'`
- `const pairIndex = gameState.recallOrder[gameState.recallIndex]`
- `const correctName = gameState.pairs[pairIndex].name`
- `const isCorrect = selectedName === correctName`
- Highlight buttons:
  ```javascript
  const buttons = document.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correctName) btn.classList.add('correct');
    if (btn.textContent === selectedName && !isCorrect) btn.classList.add('wrong');
  });
  ```
- Record attempt:
  ```javascript
  recordAttempt({
    round: gameState.currentRound + 1,
    emoji: gameState.pairs[pairIndex].emoji,
    expected: correctName,
    actual: selectedName,
    correct: isCorrect
  });
  ```
- If isCorrect:
  - `gameState.correctCount++`
  - `gameState.roundCorrect++`
  - `trackEvent('match_correct', 'game', { round: gameState.currentRound + 1, emoji: gameState.pairs[pairIndex].emoji, name: correctName })`
- If !isCorrect:
  - `trackEvent('match_wrong', 'game', { round: gameState.currentRound + 1, emoji: gameState.pairs[pairIndex].emoji, expected: correctName, actual: selectedName })`
  - try { `FeedbackManager.playDynamicFeedback({ audio_content: 'oh no, that was ' + correctName + '!', subtitle: 'That was ' + correctName + '!' })` } catch(e) { console.error(JSON.stringify(e)) }
- `gameState.totalQuestions++`
- `gameState.roundTotal++`
- Defer endProblem (flushed at next startRound or endGame):
  ```javascript
  gameState.pendingEndProblem = {
    id: 'round_' + (gameState.currentRound + 1),
    outcome: { correct: isCorrect, answer: selectedName }
  };
  ```
- Record feedback view event:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('feedback_display', {
      screen: 'gameplay',
      content_snapshot: {
        feedback_type: isCorrect ? 'correct' : 'incorrect',
        message: isCorrect ? 'Correct!' : 'That was ' + correctName + '!',
        emoji: gameState.pairs[pairIndex].emoji,
        selected: selectedName,
        expected: correctName
      }
    });
  }
  ```
- `await delay(1200)`
- `gameState.recallIndex++`
- `gameState.phase = 'recall'`
- `showRecallQuestion()`

**nextRound()**
- `gameState.currentRound++`
- `gameState.score = gameState.correctCount`
- `progressBar.update(gameState.currentRound, 0)`
- If `gameState.currentRound >= gameState.totalRounds`:
  - `endGame()`
- Else:
  - Show TransitionScreen 'level-transition', then `startRound()`

**shuffleArray(arr)**
- Fisher-Yates shuffle, returns new array
- ```javascript
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
  ```

**delay(ms)**
- `return new Promise(resolve => setTimeout(resolve, ms))`

**endGame()**
- `gameState.isActive = false`
- `gameState.phase = 'idle'`
- `timer.stop()`
- `const totalTime = timer.getTime()`
- `const accuracy = gameState.totalQuestions > 0 ? Math.round((gameState.correctCount / gameState.totalQuestions) * 100) : 0`
- `const stars = accuracy === 100 ? 3 : accuracy >= 60 ? 2 : accuracy >= 30 ? 1 : 0`
- Build metrics:
  ```javascript
  const metrics = {
    score: gameState.correctCount,
    totalRounds: gameState.totalRounds,
    stars,
    accuracy,
    timeTaken: totalTime,
    correctCount: gameState.correctCount,
    totalQuestions: gameState.totalQuestions,
    roundTimes: gameState.roundTimes,
    attempts: gameState.attempts,
    events: gameState.events,
    duration_data: gameState.duration_data
  };
  ```
- `console.log('GAME_METRICS: ' + JSON.stringify(metrics))`
- `trackEvent('game_end', 'game', { stars, accuracy })`
- Flush deferred endProblem before sealing (PART-010):
  ```javascript
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }
  ```
- Seal SignalCollector (PART-010):
  ```javascript
  const signalPayload = signalCollector ? signalCollector.seal() : { events: [], signals: {}, metadata: {} };
  ```
- `showResults(metrics)`
- Send to platform with signalPayload:
  ```javascript
  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics,
      attempts: gameState.attempts,
      ...signalPayload,
      completedAt: Date.now()
    }
  }, '*');
  ```
- Cleanup: `timer?.destroy(); visibilityTracker?.destroy(); FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll();`

**showResults(metrics)**
- `document.getElementById('game-screen').style.display = 'none'`
- `document.getElementById('results-screen').style.display = 'flex'`
- Record screen transition:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'results',
      metadata: { transition_from: 'gameplay' }
    });
  }
  ```
- `document.getElementById('result-score').textContent = metrics.correctCount + '/' + metrics.totalQuestions`
- `document.getElementById('result-time').textContent = formatTime(metrics.timeTaken)`
- `document.getElementById('result-correct').textContent = metrics.correctCount`
- `document.getElementById('result-total').textContent = metrics.totalQuestions`
- `document.getElementById('result-accuracy').textContent = metrics.accuracy + '%'`
- `document.getElementById('stars-display').textContent = getStarsText(metrics.stars)`

**getStarsText(stars)**
- `return stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : ''`

**formatTime(seconds)**
- `const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return m + ':' + String(s).padStart(2, '0')`

**restartGame()** (onclick handler — global scope)
- `document.getElementById('results-screen').style.display = 'none'`
- `document.getElementById('game-screen').style.display = 'flex'`
- Recreate SignalCollector (endGame destroys it via seal):
  ```javascript
  signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    templateId: gameState.gameId || null
  });
  window.signalCollector = signalCollector;
  ```
- Record screen transition:
  ```javascript
  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'gameplay',
      metadata: { transition_from: 'results' }
    });
  }
  ```
- `setupGame()`

**handlePostMessage(event)** (from PART-008)
- `if (!event.data || event.data.type !== 'game_init') return`
- `gameState.content = event.data.payload`
- `setupGame()`

**recordAttempt(data)** (from PART-009)
- ```javascript
  gameState.attempts.push({
    attempt_number: gameState.attempts.length + 1,
    attempt_timestamp: Date.now(),
    time_since_start: (Date.now() - gameState.startTime) / 1000,
    input_of_user: data.actual,
    correct_answer: data.expected,
    correct: data.correct,
    round: data.round,
    emoji: data.emoji
  });
  ```

**trackEvent(type, target, data)** (from PART-010)
- ```javascript
  gameState.events.push({
    type,
    target,
    timestamp: Date.now(),
    time_since_start: gameState.startTime ? (Date.now() - gameState.startTime) / 1000 : 0,
    data: data || {}
  });
  ```

### Inside DOMContentLoaded (PART-004)

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await waitForPackages();
    // DO NOT call FeedbackManager.init() — PART-015 auto-inits on load. Calling it shows a blocking audio popup that breaks all tests.

    // SignalCollector (PART-010)
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null
    });
    window.signalCollector = signalCollector;

    timer = new TimerComponent({
      container: document.getElementById('timer-container'),
      timerType: 'increase',
      startTime: 0,
      autoStart: false,
      format: 'min'
    });

    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        const inactiveStart = Date.now();
        gameState.duration_data.inActiveTime.push({ start: inactiveStart });
        if (signalCollector) {
          signalCollector.pause();
          signalCollector.recordCustomEvent('visibility_hidden', {});
        }
        if (timer) timer.pause();
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
        if (timer?.isPaused) timer.resume();
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

    ScreenLayout.inject('app', { progressBar: true, transitionScreen: true });
    const tpl = document.getElementById('game-template');
    document.getElementById('app').appendChild(tpl.content.cloneNode(true));

    progressBar = new ProgressBar({ totalRounds: 3, totalLives: 0 });
    transitionScreen = new TransitionScreen();
    transitionScreen.show('start', {
      title: 'Associations',
      subtitle: 'Remember the faces!',
      onStart: () => { setupGame(); }
    });

    window.addEventListener('message', handlePostMessage);
  } catch (e) {
    console.error('Init error: ' + JSON.stringify(e));
  }
});
```

### Window-Attached Debug (PART-012)

```javascript
window.debugGame = function() { console.log(JSON.stringify(gameState, null, 2)); };
window.debugAudio = function() { console.log(JSON.stringify(FeedbackManager.getState())); };
window.testAudio = function() {
  try { FeedbackManager.playDynamicFeedback({ audio_content: 'test audio', subtitle: 'Test' }); }
  catch(e) { console.error(JSON.stringify(e)); }
};
window.testPause = function() { timer.pause(); };
window.testResume = function() { timer.resume(); };
```

---

## 9. Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event | Target | When Fired |
|-------|--------|------------|
| game_start | game | setupGame() completes |
| game_end | game | endGame() fires |

### Game-Specific Events

| Event | Target | When Fired | Data |
|-------|--------|------------|------|
| learn_pair | game | Each pair shown during learn phase | `{ round, index, emoji, name }` |
| learn_complete | game | All pairs shown, transitioning to recall | `{ round }` |
| match_correct | game | Player selects correct name | `{ round, emoji, name }` |
| match_wrong | game | Player selects wrong name | `{ round, emoji, expected, actual }` |
| round_complete | game | All recall questions answered for round | `{ round, correct, total }` |

### SignalCollector Events (PART-010)

**Problem Lifecycle (per round):**
- `startProblem('round_N', { round_number, question_text, correct_answer, difficulty })` — called at start of each round in `startRound()`
- `endProblem('round_N', { correct, answer })` — deferred via `gameState.pendingEndProblem`, flushed at next `startRound()` or in `endGame()`

**recordViewEvent calls:**

| viewType | Function | Trigger | Content |
|----------|----------|---------|---------|
| `content_render` | `showNextPair()` | Learn pair displayed | emoji, name, pair_index, total_pairs |
| `content_render` | `showRecallQuestion()` | Recall question displayed | emoji, correct_name, choices, recall_index |
| `feedback_display` | `handleChoice()` | Correct/incorrect feedback shown | feedback_type, message, emoji, selected, expected |
| `screen_transition` | `showResults()` | Gameplay → results screen | screen: 'results', transition_from: 'gameplay' |

**recordCustomEvent calls:**

| Event | Function | Data |
|-------|----------|------|
| `visibility_hidden` | VisibilityTracker onInactive | `{}` |
| `visibility_visible` | VisibilityTracker onResume | `{}` |

---

## 10. Scaffold Points

| Point | Function | When | What Can Be Injected |
|-------|----------|------|---------------------|
| after_incorrect | handleChoice() | Player picks wrong name | Hint: show correct pairing again briefly |
| before_learn | startRound() | Learn phase about to begin | Memory strategy tip |
| during_learn | showNextPair() | Each pair display | Extended exposure time, repetition |
| before_recall | startRecallPhase() | Recall phase about to begin | Reduce choices from 4 to 3 |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 11. Feedback Triggers

> This section documents the trigger points so feedback can be wired in later.

| Moment | Trigger Function | Feedback Type | Notes |
|--------|-----------------|---------------|-------|
| Correct match | handleChoice() | sound + visual | Green highlight on correct button |
| Wrong match | handleChoice() | sound + visual | Dynamic audio "oh no, that was [name]!" |
| Perfect round | showRecallQuestion() | celebration sound | Dynamic audio "amazing memory!" |
| Game complete (3 stars) | showResults() | celebration sound + sticker | All correct |
| Game complete (<3 stars) | showResults() | encouragement sound | Gentle |

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
const FEEDBACK_IDS = {
  correct: 'associations_correct',
  incorrect: 'associations_incorrect',
  celebration: 'associations_celebration',
  encouragement: 'associations_encouragement'
};
```

---

## 12. Visual Specifications

- **Layout:** Centered emoji (80px learn, 72px recall) + 2x2 choice grid below, max-width 340px
- **Color palette:** White choice buttons with gray border, green correct, red wrong, blue hover
- **Typography:** var(--mathai-font-family), emoji 72-80px, names 24px bold, choices 16px, labels 14px
- **Spacing:** Container padding 16px, choice grid gap 10px, section gap 16px
- **Interactive states:** Choice buttons hover blue border, correct green bg+border, wrong red bg+border, disabled opacity 0.6
- **Transitions:** Pair display fadeInUp 0.3s, choice feedback 0.15s
- **Responsive:** Max-width 480px wrapper, 100dvh, choice grid scales within container

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Complete game with all correct answers (perfect run)

```
SETUP: Page loaded, TransitionScreen start dismissed, gameState.isActive === true
ACTIONS:
  Round 1 (3 pairs): Wait for recall phase (#recall-area visible)
    For each recall question, click the .choice-btn matching the correct name for the shown emoji
    (Emma for 👩, Liam for 👨, Sofia for 👧 — order shuffled but match by emoji)
  Wait for transition, Round 2 (4 pairs): Same — match Mia/👵, James/👦, Zoe/🧑, Leo/👴
  Wait for transition, Round 3 (5 pairs): Same — match Lily/👩, Max/👨, Ruby/👧, Finn/👦, Ivy/🧑
ASSERT:
  gameState.correctCount == 12 (3 + 4 + 5)
  gameState.totalQuestions == 12
  #results-screen is visible
  #result-accuracy text is "100%"
  stars display shows 3 stars
```

### Scenario: Wrong match shows correct name

```
SETUP: Page loaded, game started, round 1 recall phase
ACTIONS:
  Emoji shown is 👩 (Emma), click .choice-btn with text "Liam" (wrong)
ASSERT:
  .choice-btn with text "Liam" has .wrong class
  .choice-btn with text "Emma" has .correct class
  All .choice-btn elements disabled
  gameState.attempts[0].correct == false
  gameState.attempts[0].input_of_user == "Liam"
  gameState.attempts[0].correct_answer == "Emma"
```

### Scenario: All wrong answers gives 0 stars

```
SETUP: Complete all rounds selecting only wrong answers
ASSERT:
  gameState.correctCount == 0
  accuracy == 0
  stars display shows 0 stars (accuracy < 30%)
```

### Scenario: Learn phase shows pairs sequentially

```
SETUP: Page loaded, game started, round 1
ASSERT:
  #learn-area is visible
  #recall-area is hidden
  #learn-emoji shows first emoji (👩)
  #learn-name shows "Emma"
  #learn-progress shows "Pair 1 of 3"
  After 3s: emoji changes to 👨, name to "Liam", progress "Pair 2 of 3"
  After 3s: emoji changes to 👧, name to "Sofia", progress "Pair 3 of 3"
  After 3s: transition to recall phase
```

### Scenario: Recall order is shuffled

```
SETUP: Round 1, recall phase starts
ASSERT:
  gameState.recallOrder is a permutation of [0, 1, 2]
  Not necessarily [0, 1, 2] (shuffled)
```

### Scenario: 4 choices always present per question

```
SETUP: Any recall question
ASSERT:
  #choices-grid has exactly 4 .choice-btn elements
  One of the buttons contains the correct name
  No duplicate names in choices
```

### Scenario: Game always completes all 3 rounds (unlimited lives)

```
SETUP: Answer everything wrong
ASSERT:
  Game does not end early
  All 3 rounds played
  gameState.currentRound reaches 3
  #results-screen shown after round 3
```

### Scenario: Star rating based on accuracy

```
SETUP: Various completion scenarios
ASSERT:
  100% accuracy -> 3 stars
  75% accuracy -> 2 stars (>= 60%)
  50% accuracy -> 1 star (>= 30%)
  20% accuracy -> 0 stars (< 30%)
```

### Scenario: Restart resets all state

```
SETUP: Game completed, results screen visible
ACTIONS:
  Click #btn-restart
ASSERT:
  #results-screen is hidden
  #game-screen is visible
  gameState.currentRound == 0
  gameState.correctCount == 0
  gameState.totalQuestions == 0
  gameState.isActive == true
```

### Scenario: PostMessage game_init loads custom content

```
SETUP: Page loaded
ACTIONS:
  Send postMessage { type: 'game_init', payload: { rounds: [{ pairs: [{ emoji: '😀', name: 'Test' }], distractors: ['A','B','C'], exposureDuration: 1000 }] } }
ASSERT:
  gameState.content.rounds[0].pairs[0].name == "Test"
  gameState.isActive == true
```

---

## 15. Verification Checklist

### Structural
- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order: FeedbackManager -> Components -> Helpers (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] `#game-screen` element exists
- [ ] `#results-screen` element exists, hidden by default
- [ ] `#timer-container` div exists inside game-screen
- [ ] `#app` div exists as root container
- [ ] `<template id="game-template">` wraps game content

### Functional
- [ ] waitForPackages() defined and checks all three packages (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] VisibilityTracker created with onInactive + onResume (PART-005)
- [ ] TimerComponent created with timerType 'increase', startTime 0, autoStart false (PART-006)
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] setupGame has fallback content for standalone testing (PART-008)
- [ ] recordAttempt produces correct attempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] endGame calculates metrics, logs, sends postMessage, cleans up (PART-011)
- [ ] Debug functions on window: debugGame, debugAudio, testAudio, testPause, testResume (PART-012)
- [ ] showResults populates all fields (PART-019)
- [ ] InputSchema defined with fallback content (PART-028)
- [ ] Play area has clear interactive/feedback sections (PART-027)
- [ ] No anti-patterns present (PART-026)

### Design & Layout
- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors for theme elements (PART-020)
- [ ] Gameplay feedback uses correct colors — green/red/blue/gray (PART-020)
- [ ] `.game-block` layout structure (PART-021)
- [ ] Max-width 480px wrapper, uses 100dvh not 100vh (PART-021)
- [ ] Buttons use `.game-btn` with `.btn-primary` classes (PART-022)
- [ ] Choice buttons styled distinctly from game-btn (PART-022)
- [ ] ProgressBar created with totalRounds: 3, totalLives: 0 (PART-023)
- [ ] TransitionScreen shows start/level-transition/victory screens (PART-024)
- [ ] ScreenLayout.inject() called before ProgressBar/TransitionScreen (PART-025)

### Rules Compliance
- [ ] RULE-001: All onclick handlers (handleChoice, restartGame) in global scope
- [ ] RULE-002: All async functions have async keyword (startRound, showNextPair, handleChoice)
- [ ] RULE-003: All async calls in try/catch (FeedbackManager calls, init)
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame: timer?.destroy(), visibilityTracker?.destroy(), FeedbackManager.sound.stopAll(), FeedbackManager.stream.stopAll()
- [ ] RULE-006: No new Audio(), no setInterval for timer, no SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### SignalCollector (PART-010)
- [ ] SignalCollector initialized after FeedbackManager.init() with sessionId, studentId, templateId
- [ ] `window.signalCollector` assigned
- [ ] `let signalCollector = null` declared globally
- [ ] `startProblem` called at each round start in `startRound()`
- [ ] Deferred `endProblem` pattern used (via `gameState.pendingEndProblem`)
- [ ] `recordViewEvent` called in every DOM-modifying function (screen_transition, content_render, feedback_display, visual_update)
- [ ] `data-signal-id` attributes on important interactive elements (learn-emoji, learn-name, recall-emoji, choices-grid, choice buttons, restart-button)
- [ ] `updateCurrentAnswer` used for multi-input games (if applicable)
- [ ] `seal()` called in endGame before postMessage
- [ ] Deferred endProblem flushed in endGame before seal
- [ ] SignalCollector integrated with VisibilityTracker (pause/resume + custom events)
- [ ] Signals separate from attempt_history
- [ ] No inline stub/polyfill for SignalCollector (Anti-Pattern 18)
- [ ] SignalCollector recreated in `restartGame()`

### Game-Specific
- [ ] Learn phase shows emoji+name pairs sequentially with correct exposure duration (3s, 2.5s, 2s)
- [ ] Pair count increases per round (3, 4, 5)
- [ ] Recall phase shows emojis in shuffled order
- [ ] 4 unique name choices per question (1 correct + 3 from others/distractors)
- [ ] Correct choice shows green, wrong shows red, correct also highlighted
- [ ] No lives system — game always completes all 3 rounds
- [ ] Star rating based on accuracy: 100%->3, >=60%->2, >=30%->1, <30%->0
- [ ] progressBar.update called with (roundsCompleted, 0) — no lives param
- [ ] Perfect round triggers "amazing memory!" dynamic audio
- [ ] Wrong match feedback includes correct name: "oh no, that was [name]!"
- [ ] Learn progress text shows "Pair X of Y"

### Contract Compliance
- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
