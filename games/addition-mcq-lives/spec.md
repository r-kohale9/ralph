# Addition MCQ Lives — Spec v1

## 1. Game Overview

**Game ID:** `addition-mcq-lives`
**Title:** Addition MCQ Lives
**Concept:** A multiple-choice quiz where players answer addition questions against a 30-second per-question countdown timer. Players have 3 lives. A wrong answer (or timeout) loses one life. Lose all 3 lives → Game Over. Answering all questions without losing all lives → Victory.
**Input Method:** Tap / Click one of 4 MCQ option buttons
**Timer:** Countdown, 30 seconds per question, resets each question
**Lives:** 3 lives total; lose 1 on wrong answer or timeout
**Validation:** Fixed answer (single correct option from 4 choices)
**Rounds:** Defined by content (default fallback: 10 questions)
**Win Condition:** Answer all questions before running out of lives
**Lose Condition:** Lives reach 0 at any point (wrong answer or timeout)

---

## 2. Parts Used

| Part | Name | Reason |
|------|------|--------|
| PART-001 | HTML Shell | Mandatory |
| PART-002 | Package Scripts | Mandatory |
| PART-003 | waitForPackages | Mandatory |
| PART-004 | Initialization Block | Mandatory |
| PART-005 | VisibilityTracker | Mandatory |
| PART-006 | TimerComponent | Countdown 30s per question |
| PART-007 | Game State Object | Mandatory |
| PART-008 | PostMessage Protocol | Mandatory |
| PART-009 | Attempt Tracking | Tracks each answer |
| PART-010 | Event Tracking & SignalCollector | Mandatory |
| PART-011 | End Game & Metrics | Mandatory |
| PART-012 | Debug Functions | Mandatory |
| PART-013 | Validation — Fixed Answer | MCQ single correct answer |
| PART-019 | Results Screen UI | Mandatory |
| PART-020 | CSS Variables & Colors | Mandatory |
| PART-021 | Screen Layout CSS | Mandatory |
| PART-022 | Game Buttons | MCQ option buttons |
| PART-023 | ProgressBar Component | Show question progress + lives |
| PART-024 | TransitionScreen Component | Start screen, Game Over, Victory |
| PART-025 | ScreenLayout Component | Hosts ProgressBar + TransitionScreen |
| PART-026 | Anti-Patterns | Verification checklist |
| PART-027 | Play Area Construction | Mandatory |
| PART-028 | InputSchema Patterns | MCQ schema |
| PART-030 | Sentry Error Tracking | Mandatory |

---

## 3. InputSchema

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'number' },
          options: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }
        },
        required: ['question', 'answer', 'options']
      },
      minItems: 1
    }
  },
  required: ['questions']
};
```

**Example Content Set:**
```javascript
const fallbackContent = {
  questions: [
    { question: '3 + 4', answer: 7, options: [5, 6, 7, 8] },
    { question: '8 + 5', answer: 13, options: [11, 12, 13, 14] },
    { question: '6 + 9', answer: 15, options: [13, 14, 15, 16] },
    { question: '7 + 7', answer: 14, options: [12, 13, 14, 15] },
    { question: '4 + 8', answer: 12, options: [10, 11, 12, 13] },
    { question: '9 + 6', answer: 15, options: [13, 14, 15, 16] },
    { question: '5 + 7', answer: 12, options: [10, 11, 12, 13] },
    { question: '8 + 8', answer: 16, options: [14, 15, 16, 17] },
    { question: '6 + 6', answer: 12, options: [10, 11, 12, 13] },
    { question: '9 + 9', answer: 18, options: [16, 17, 18, 19] }
  ]
};
```

---

## 4. Game State

```javascript
window.gameState = {
  currentRound: 0,
  totalRounds: 10,          // Set from content.questions.length
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
  // Game-specific
  lives: 3,
  totalLives: 3
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
let progressBar = null;
let transitionScreen = null;
```

---

## 5. HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Addition MCQ Lives</title>
  <!-- PART-002: Package Scripts -->
  <script src="...mathai-packages..."></script>
</head>
<body>
  <div id="app">
    <!-- ScreenLayout injects: progress bar slot, transition slot, game screen -->
    <!-- PART-025: ScreenLayout auto-injects into #app -->

    <!-- Game Play Area (shown during active gameplay) -->
    <div id="game-screen" style="display:none;">
      <div id="timer-container"></div>

      <div id="question-area">
        <div id="question-text"></div>
      </div>

      <div id="options-area">
        <button class="option-btn" id="option-0" onclick="handleAnswer(0)"></button>
        <button class="option-btn" id="option-1" onclick="handleAnswer(1)"></button>
        <button class="option-btn" id="option-2" onclick="handleAnswer(2)"></button>
        <button class="option-btn" id="option-3" onclick="handleAnswer(3)"></button>
      </div>
    </div>

    <!-- Results Screen (PART-019) -->
    <div id="results-screen" style="display:none;"></div>
  </div>

  <script>
    /* all game code */
  </script>
</body>
</html>
```

---

## 6. CSS

```css
/* PART-020 CSS variables applied */
:root {
  --mathai-green: #22c55e;
  --mathai-red: #ef4444;
  --mathai-blue: #2563eb;
  --mathai-yellow: #facc15;
  --correct-color: var(--mathai-green);
  --wrong-color: var(--mathai-red);
}

#game-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 20px;
  min-height: 100%;
  box-sizing: border-box;
}

#timer-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

#question-area {
  width: 100%;
  max-width: 480px;
  background: #f1f5f9;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

#question-text {
  font-size: 36px;
  font-weight: 700;
  color: #1e293b;
}

#options-area {
  width: 100%;
  max-width: 480px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option-btn {
  padding: 18px;
  font-size: 24px;
  font-weight: 600;
  border: 3px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s, border-color 0.2s;
  color: #1e293b;
}

.option-btn:hover:not(:disabled) {
  transform: scale(1.04);
  border-color: var(--mathai-blue);
}

.option-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.option-btn.correct {
  background: #dcfce7;
  border-color: var(--mathai-green);
  color: #166534;
}

.option-btn.wrong {
  background: #fee2e2;
  border-color: var(--mathai-red);
  color: #991b1b;
}
```

---

## 7. Game Flow

### Initialization (DOMContentLoaded)
1. `await waitForPackages()`
2. Setup `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
3. Init `progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 3 })`
4. Init `transitionScreen = new TransitionScreenComponent({ autoInject: true })`
5. Init `signalCollector`, `visibilityTracker`
6. Init `timer = new TimerComponent('timer-container', { timerType: 'decrease', format: 'sec', startTime: 30, endTime: 0, autoStart: false, onEnd: handleTimeout })`
7. Setup postMessage listener
8. Show start screen → `showStartScreen()`

### Start Screen (`showStartScreen`)
```javascript
transitionScreen.show({
  icons: ['➕'],
  iconSize: 'large',
  title: 'Addition Blitz!',
  subtitle: '3 lives · 30 seconds per question',
  buttons: [{ text: "Let's Go!", type: 'primary', action: () => startGame() }]
});
```

### Start Game (`startGame`)
1. `gameState.isActive = true`
2. `gameState.startTime = Date.now()`
3. `gameState.lives = 3`
4. Set `totalRounds` from `content.questions.length`
5. `progressBar.update(0, 3)`
6. Show `#game-screen`, hide transition screen
7. `renderQuestion()`

### Render Question (`renderQuestion`)
1. Get current question: `content.questions[gameState.currentRound]`
2. Set `#question-text` to `question.question`
3. Fill 4 option buttons with `question.options[0..3]`
4. Re-enable all option buttons
5. Remove any correct/wrong CSS classes
6. Reset & restart timer: `timer.reset(); timer.start()`
7. `signalCollector.startProblem(...)` for current question

### Handle Answer (`handleAnswer(optionIndex)`)  ← GLOBAL SCOPE
1. `if (!gameState.isActive) return`
2. `timer.pause()`
3. Disable all option buttons
4. Get chosen value: `questions[currentRound].options[optionIndex]`
5. Validate: `validateAnswer(chosen, question.answer)`
6. If **correct**:
   - Add `.correct` class to chosen button
   - `gameState.score++`
   - Record attempt as correct
   - After 600ms delay → `nextQuestion()`
7. If **wrong**:
   - Add `.wrong` class to chosen button
   - Highlight correct button with `.correct` class
   - `gameState.lives--`
   - Record attempt as incorrect
   - Update progressBar
   - After 800ms delay → check lives → if `lives <= 0` → `endGame()` else `nextQuestion()`

### Handle Timeout (`handleTimeout`)
1. `if (!gameState.isActive) return`
2. Disable all option buttons
3. Highlight correct button with `.correct`
4. `gameState.lives--`
5. Record attempt as timed-out (incorrect)
6. Update progressBar
7. After 800ms delay → check lives → if `lives <= 0` → `endGame()` else `nextQuestion()`

### Next Question (`nextQuestion`)  ← GLOBAL SCOPE
1. `gameState.currentRound++`
2. `progressBar.update(gameState.currentRound, gameState.lives)`
3. If `gameState.currentRound >= gameState.totalRounds` → all questions answered → `endGame()`
4. Else → `renderQuestion()`

### End Game (`endGame`)
1. Guard: `if (!gameState.isActive) return`
2. `gameState.isActive = false`
3. `timer.stop()`
4. Calculate metrics:
   - accuracy from attempts
   - stars: `lives >= 3 ? 3 : lives >= 2 ? 2 : lives >= 1 ? 1 : 0`
   - If lost all lives, stars = 0
5. Seal signalCollector, postMessage `game_complete`
6. `showResults(metrics)` (PART-019)
7. Cleanup timer, visibilityTracker, progressBar

---

## 8. Functions

| Function | Scope | Description |
|----------|-------|-------------|
| `showStartScreen()` | global | Shows transition start screen |
| `startGame()` | global | Initializes game state, shows first question |
| `renderQuestion()` | global | Renders current question + options + resets timer |
| `handleAnswer(optionIndex)` | **GLOBAL (onclick)** | Handles MCQ selection |
| `handleTimeout()` | global | Called by timer.onEnd |
| `nextQuestion()` | global | Advances to next question or ends game |
| `validateAnswer(user, correct)` | global | Fixed answer validation (PART-013) |
| `endGame()` | global | Calculates metrics, sends postMessage, shows results |
| `restartGame()` | global | Resets state, recreates timer, starts over |
| `setupGame(content)` | global | Loads content into gameState |
| `trackEvent(name, category, data)` | global | PART-010 |
| `showResults(metrics)` | global | PART-019 |

---

## 9. EndGame Triggers (ALL paths must call endGame)

| Trigger | Code Path |
|---------|-----------|
| All questions answered | `nextQuestion()` when `currentRound >= totalRounds` |
| All lives lost (wrong answer) | `handleAnswer()` when `lives <= 0` after decrement |
| All lives lost (timeout) | `handleTimeout()` when `lives <= 0` after decrement |

---

## 10. Star Calculation Override

This game uses **lives-based** star calculation (not accuracy-based):

```javascript
const livesAtEnd = gameState.lives;
const stars = livesAtEnd >= 3 ? 3 : livesAtEnd >= 2 ? 2 : livesAtEnd >= 1 ? 1 : 0;
// If lives === 0 (game over screen path) → stars = 0
```

---

## 11. Validation Logic

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  return String(userAnswer).trim() === String(correctAnswer).trim();
}
```

---

## 12. PostMessage Protocol (PART-008)

**Incoming `game_init`:**
```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'game_init') {
    gameState.content = event.data.data?.content || fallbackContent;
    setupGame(gameState.content);
  }
});
```

**Outgoing `game_complete`:**
```javascript
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics,           // accuracy, time, stars, attempts, duration_data
    attempts: gameState.attempts,
    ...signalPayload,  // events, signals, metadata
    completedAt: Date.now()
  }
}, '*');
```

---

## 13. Verification Checklist (PART-026)

### Mandatory Structure
- [ ] Single HTML file, no external dependencies beyond CDN packages
- [ ] `window.gameState` used (not `const gameState`)
- [ ] All onclick handlers in global scope (RULE-001)
- [ ] `waitForPackages()` awaited before init
- [ ] `endGame()` guarded with `if (!gameState.isActive) return`

### Timer
- [ ] `<div id="timer-container"></div>` exists
- [ ] TimerComponent initialized with `timerType: 'decrease'`, `startTime: 30`, `endTime: 0`
- [ ] `timer.reset()` + `timer.start()` called each question
- [ ] `timer.pause()` called on answer selection
- [ ] `timer.destroy()` called in endGame cleanup
- [ ] `onEnd: handleTimeout` wired up
- [ ] No custom setInterval/setTimeout for timing

### Lives
- [ ] `gameState.lives` starts at 3
- [ ] Decremented on wrong answer AND timeout
- [ ] `endGame()` called when `lives <= 0`
- [ ] Lives visible in progress bar hearts

### MCQ Options
- [ ] 4 option buttons rendered per question
- [ ] All buttons disabled after selection
- [ ] Correct button always highlighted green after answer
- [ ] Chosen wrong button highlighted red
- [ ] Buttons re-enabled on next question

### Progress Bar
- [ ] `ProgressBarComponent` initialized with `totalRounds` and `totalLives: 3`
- [ ] `progressBar.update(0, 3)` called at game start
- [ ] `progressBar.update(currentRound, lives)` called after each answer
- [ ] `progressBar.destroy()` called in endGame

### Transition Screens
- [ ] Start screen shown before gameplay
- [ ] Game over screen shown when lives = 0 (with restart option)
- [ ] Victory screen shown when all questions answered with lives remaining
- [ ] ScreenLayout has `transitionScreen: true` slot enabled

### EndGame
- [ ] All 3 paths to endGame verified (completion, wrong loss, timeout loss)
- [ ] Stars calculated from remaining lives
- [ ] `showResults(metrics)` called
- [ ] `game_complete` postMessage sent with correct shape
- [ ] timer, visibilityTracker, progressBar all destroyed

### Anti-Patterns
- [ ] No `setInterval` for timer
- [ ] No `const gameState` (must be `window.gameState`)
- [ ] No functions defined inside DOMContentLoaded that are called from HTML
- [ ] No `duration` + `buttons` on same transition screen

---

## 14. Test Scenarios

### 14.1 Start Screen
- **Action:** Load game
- **Expected:** Start screen visible with title, subtitle, "Let's Go!" button

### 14.2 First Question Render
- **Action:** Click "Let's Go!"
- **Expected:** Game screen visible with question text, 4 option buttons, 30s timer running

### 14.3 Correct Answer
- **Action:** Click correct answer button
- **Expected:** Button turns green, no life lost, progress advances, next question loads after ~600ms

### 14.4 Wrong Answer
- **Action:** Click wrong answer button
- **Expected:** Clicked button turns red, correct button turns green, one life lost in progress bar, next question loads after ~800ms

### 14.5 Timer Timeout
- **Action:** Let timer expire (30s)
- **Expected:** Correct button highlighted green, one life lost, next question loads after ~800ms

### 14.6 Game Over (Lives = 0)
- **Action:** Get 3 wrong/timeout answers
- **Expected:** Game Over transition screen shown with 0 stars, "Try again!" button

### 14.7 Victory (All Questions)
- **Action:** Answer all 10 questions with lives remaining
- **Expected:** Victory transition screen with star count matching lives remaining

### 14.8 Restart
- **Action:** Click "Try again!" on Game Over screen
- **Expected:** Lives reset to 3, question reset to 0, first question loads fresh, timer starts

### 14.9 PostMessage game_init
- **Action:** Send `{ type: 'game_init', data: { content: {...} } }` via postMessage
- **Expected:** Game loads with injected content instead of fallback

### 14.10 PostMessage game_complete
- **Action:** Complete game
- **Expected:** `game_complete` message sent with metrics, attempts, events, signals, metadata, completedAt

### 14.11 Progress Bar
- **Action:** Play through 3 questions
- **Expected:** Progress bar shows "3/10 rounds completed" and hearts reflect current lives

### 14.12 All Buttons Disabled During Feedback
- **Action:** Click an answer, immediately click another button
- **Expected:** Second click is ignored (buttons disabled during 600-800ms feedback window)

### 14.13 Timer Resets Per Question
- **Action:** Answer quickly, observe next question
- **Expected:** Timer resets to 30 on each new question

### 14.14 Debug Functions
- **Action:** Run `debugEndGame()` in console
- **Expected:** endGame is triggered, results screen appears with valid metrics

### 14.15 Visibility / Tab Switch
- **Action:** Switch tab during active game
- **Expected:** Timer pauses; resumes on return (VisibilityTracker)
