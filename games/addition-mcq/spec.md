# Addition Quest — MCQ Game Spec v1

## 1. Overview

| Field | Value |
|---|---|
| **Game ID** | `addition-mcq` |
| **Title** | Addition Quest |
| **Concept** | Multiple-choice addition game. A math question appears with 4 answer options. The player selects the correct sum. |
| **Input Method** | Tap / click MCQ buttons |
| **Timer** | Countdown, 30 seconds per question |
| **Lives** | 3 (lost on wrong answer OR timeout) |
| **Validation** | Fixed answer (single correct option) |
| **Win Condition** | Answer all questions without losing all lives |
| **Lose Condition** | Lose all 3 lives (wrong answer or timeout) |
| **Stories** | No |
| **Rounds** | Determined by content set (default 10 questions) |

---

## 2. Parts Used

| Part | Reason |
|---|---|
| PART-001 | HTML Shell |
| PART-002 | Package Scripts |
| PART-003 | waitForPackages |
| PART-004 | Initialization Block |
| PART-005 | VisibilityTracker |
| PART-006 | TimerComponent (30s countdown) |
| PART-007 | Game State Object |
| PART-008 | PostMessage Protocol |
| PART-009 | Attempt Tracking |
| PART-010 | Event Tracking & SignalCollector |
| PART-011 | End Game & Metrics |
| PART-012 | Debug Functions |
| PART-013 | Validation — Fixed Answer |
| PART-019 | Results Screen UI |
| PART-020 | CSS Variables & Colors |
| PART-021 | Screen Layout CSS |
| PART-022 | Game Buttons |
| PART-023 | ProgressBar Component |
| PART-024 | TransitionScreen Component |
| PART-025 | ScreenLayout Component |
| PART-026 | Anti-Patterns (verification) |
| PART-027 | Play Area Construction |
| PART-028 | InputSchema Patterns |
| PART-030 | Sentry Error Tracking |

---

## 3. Game State

```javascript
const gameState = {
  // Standard fields
  isGameActive: false,
  isGameOver: false,
  currentRound: 0,           // 0-based index into questions array
  totalRounds: 0,            // set from content
  score: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,

  // Lives system
  lives: 3,
  totalLives: 3,

  // Current question
  currentQuestion: null,     // { question, options: [str,str,str,str], correctAnswer, id }
  selectedOption: null,      // index 0-3 of chosen option
  isAnswered: false,         // true after player selects or timer expires

  // Tracking
  attempts: [],
  startTime: null,
};
```

---

## 4. InputSchema (Content Structure)

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "12 + 7 = ?",
      "options": ["17", "18", "19", "20"],
      "correctAnswer": "19"
    },
    {
      "id": "q2",
      "question": "25 + 13 = ?",
      "options": ["36", "37", "38", "39"],
      "correctAnswer": "38"
    },
    {
      "id": "q3",
      "question": "8 + 6 = ?",
      "options": ["12", "13", "14", "15"],
      "correctAnswer": "14"
    },
    {
      "id": "q4",
      "question": "45 + 30 = ?",
      "options": ["73", "74", "75", "76"],
      "correctAnswer": "75"
    },
    {
      "id": "q5",
      "question": "17 + 9 = ?",
      "options": ["24", "25", "26", "27"],
      "correctAnswer": "26"
    }
  ]
}
```

**Field mapping:**
- `questions[i].question` → displayed in `#question-text`
- `questions[i].options` → rendered as 4 MCQ buttons in `#options-grid`
- `questions[i].correctAnswer` → used in `validateAnswer()`
- `questions[i].id` → used in attempt tracking

---

## 5. HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Addition Quest</title>
  <!-- Package scripts (PART-002) -->
  <script src="..."></script>
</head>
<body>
  <div id="app">
    <!-- ScreenLayout injects: progress bar slot + transition screen slot + game screen -->

    <!-- Game Screen -->
    <div id="game-screen" class="screen" style="display:none;">
      <!-- Timer -->
      <div id="timer-container"></div>

      <!-- Question Card -->
      <div id="question-card">
        <p id="question-text"></p>
      </div>

      <!-- 4 MCQ Option Buttons -->
      <div id="options-grid">
        <button class="option-btn" data-index="0"></button>
        <button class="option-btn" data-index="1"></button>
        <button class="option-btn" data-index="2"></button>
        <button class="option-btn" data-index="3"></button>
      </div>
    </div>

    <!-- Results Screen (PART-019) -->
    <div id="results-screen" class="screen" style="display:none;"></div>
  </div>
</body>
</html>
```

---

## 6. Screen Flow

```
PostMessage (content) received
        ↓
TransitionScreen: Start Screen
  [icon: ➕, title: "Addition Quest!", subtitle: "3 lives · 30 seconds per question"]
  [Button: "Start!" → startGame()]
        ↓
Game Screen: Show question + 4 options + 30s timer
        ↓
  Player taps option OR timer reaches 0
        ↓
  ┌── Correct Answer ──┐         ┌── Wrong / Timeout ──┐
  │  Highlight green   │         │  Highlight red       │
  │  score++           │         │  lives--             │
  │  correctAnswers++  │         │  incorrectAnswers++  │
  └────────────────────┘         └──────────────────────┘
        ↓                                 ↓
  [Check: more questions?]        [Check: lives == 0?]
  Yes → next question             Yes → TransitionScreen: Game Over
  No  → endGame() → Results            [Button: "Try Again" → restartGame()]
                                  No → next question
        ↓
  endGame() → Results Screen
```

---

## 7. Core Logic

### 7a. startGame()

```javascript
function startGame() {
  transitionScreen.hide();
  gameState.isGameActive = true;
  gameState.currentRound = 0;
  gameState.lives = gameState.totalLives;
  gameState.score = 0;
  gameState.correctAnswers = 0;
  gameState.incorrectAnswers = 0;
  gameState.attempts = [];
  gameState.startTime = Date.now();
  showScreen('game-screen');
  progressBar.update(0, gameState.lives);
  loadQuestion(0);
}
```

### 7b. loadQuestion(index)

```javascript
function loadQuestion(index) {
  const q = gameState.questions[index];
  gameState.currentQuestion = q;
  gameState.isAnswered = false;
  gameState.selectedOption = null;

  // Render question
  document.getElementById('question-text').textContent = q.question;

  // Render 4 options
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.className = 'option-btn'; // reset styles
    btn.disabled = false;
  });

  // Reset and start 30s timer
  timer.reset();
  timer.start();
}
```

### 7c. handleOptionSelect(index)

```javascript
function handleOptionSelect(index) {
  if (gameState.isAnswered || !gameState.isGameActive) return;
  gameState.isAnswered = true;
  gameState.selectedOption = index;
  timer.pause();

  const q = gameState.currentQuestion;
  const chosen = q.options[index];
  const isCorrect = validateAnswer(chosen, q.correctAnswer);

  // Visual feedback
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(btn => btn.disabled = true);
  buttons[index].classList.add(isCorrect ? 'correct' : 'incorrect');
  if (!isCorrect) {
    // Reveal correct answer
    const correctIndex = q.options.indexOf(q.correctAnswer);
    if (correctIndex >= 0) buttons[correctIndex].classList.add('correct');
  }

  // Track attempt
  recordAttempt({
    questionId: q.id,
    userAnswer: chosen,
    correctAnswer: q.correctAnswer,
    isCorrect,
    timeTaken: timer.getTimeTaken()
  });

  if (isCorrect) {
    gameState.score += 10;
    gameState.correctAnswers++;
  } else {
    gameState.lives--;
    gameState.incorrectAnswers++;
  }

  setTimeout(() => advanceGame(), 900);
}
```

### 7d. handleTimeout() — called by timer's onEnd

```javascript
function handleTimeout() {
  if (gameState.isAnswered || !gameState.isGameActive) return;
  gameState.isAnswered = true;
  gameState.lives--;
  gameState.incorrectAnswers++;

  const q = gameState.currentQuestion;
  recordAttempt({
    questionId: q.id,
    userAnswer: null,
    correctAnswer: q.correctAnswer,
    isCorrect: false,
    timeTaken: 30
  });

  // Reveal correct answer
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(btn => btn.disabled = true);
  const correctIndex = q.options.indexOf(q.correctAnswer);
  if (correctIndex >= 0) buttons[correctIndex].classList.add('correct');

  setTimeout(() => advanceGame(), 900);
}
```

### 7e. advanceGame()

```javascript
function advanceGame() {
  // Check lives
  if (gameState.lives <= 0) {
    gameState.isGameActive = false;
    showGameOver();
    return;
  }

  gameState.currentRound++;
  progressBar.update(gameState.currentRound, gameState.lives);

  // Check if more questions
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame();
    return;
  }

  loadQuestion(gameState.currentRound);
}
```

### 7f. showGameOver()

```javascript
function showGameOver() {
  showScreen('game-screen'); // keep game screen hidden behind transition
  transitionScreen.show({
    icons: ['💔'],
    iconSize: 'large',
    title: 'Game Over!',
    subtitle: `You answered ${gameState.correctAnswers} correctly`,
    buttons: [
      { text: 'Try Again', type: 'primary', action: () => restartGame() }
    ]
  });
}
```

### 7g. restartGame()

```javascript
function restartGame() {
  transitionScreen.hide();
  startGame();
}
```

### 7h. Timer Config

```javascript
timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'sec',
  startTime: 30,
  endTime: 0,
  autoStart: false,
  onEnd: (timeTaken) => {
    handleTimeout();
  }
});
```

---

## 8. Validation

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
}
```

---

## 9. EndGame Metrics

```javascript
function endGame() {
  gameState.isGameActive = false;
  gameState.isGameOver = true;
  timer.stop();
  timer.destroy();
  progressBar.destroy();

  const metrics = {
    score: gameState.score,
    correctAnswers: gameState.correctAnswers,
    incorrectAnswers: gameState.incorrectAnswers,
    totalRounds: gameState.totalRounds,
    livesRemaining: gameState.lives,
    totalLives: gameState.totalLives,
    timeTaken: Math.round((Date.now() - gameState.startTime) / 1000),
    attempts: gameState.attempts
  };

  signalCollector.send('game_end', metrics);
  showResultsScreen(metrics);
}
```

---

## 10. CSS / Styling

- **Background:** `--mathai-background` (white/light)
- **Question card:** Centered, large font (2rem+), rounded card with shadow, `--mathai-card-bg`
- **Options grid:** 2×2 grid layout, full-width buttons
- **Option buttons:**
  - Default: white bg, `--mathai-blue` border, rounded, 1rem font
  - Hover: light blue bg
  - `.correct`: green bg (`--mathai-green`), white text
  - `.incorrect`: red bg (`--mathai-red`), white text
  - `disabled`: reduced opacity, no pointer events
- **Timer:** Bold, centered above question card. Turns red when ≤ 10 seconds.
- **Lives:** Shown as heart icons ❤️ in progress bar (filled = remaining, empty = lost)

---

## 11. PostMessage Integration (PART-008)

### Incoming: `game_init`
```json
{
  "type": "game_init",
  "data": {
    "questions": [ ... ]
  }
}
```
Handler sets `gameState.questions`, `gameState.totalRounds`, then shows start TransitionScreen.

### Outgoing: `game_end`
```json
{
  "type": "game_end",
  "score": 70,
  "correctAnswers": 7,
  "incorrectAnswers": 2,
  "totalRounds": 10,
  "livesRemaining": 1,
  "timeTaken": 143,
  "attempts": [ ... ]
}
```

---

## 12. ScreenLayout Configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    progressBar: true,
    transitionScreen: true
  }
});
```

---

## 13. ProgressBar Configuration

```javascript
const progressBar = new ProgressBarComponent({
  autoInject: true,
  totalRounds: gameState.totalRounds,
  totalLives: 3
});
```

---

## 14. Test Scenarios

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Page load | Open index.html | Start transition screen shown |
| 2 | Start button | Click "Start!" | Game screen shown, first question loaded, timer starts |
| 3 | Correct answer | Select correct option | Button turns green, score +10, next question loads |
| 4 | Wrong answer | Select wrong option | Button turns red, correct highlighted green, lives -1 |
| 5 | Timer expires | Let 30s run out | Lives -1, correct answer revealed, next question |
| 6 | Lives depleted | Lose 3 lives | Game Over transition screen shown |
| 7 | Try again | Click "Try Again" | Game resets, first question reloads |
| 8 | All questions answered | Complete all Qs with lives | endGame called, results screen shown |
| 9 | Progress bar | After each answer | Lives hearts and round count update correctly |
| 10 | PostMessage | Send game_init | Game initializes with provided questions |
| 11 | Timer color | ≤10s remaining | Timer text turns red |
| 12 | Disabled after answer | After selecting option | All 4 buttons disabled, no double-click |
| 13 | Score tracking | 5 correct answers | Score shows 50 |
| 14 | Visibility pause | Tab away | Timer pauses |
| 15 | Metrics output | On game end | game_end postMessage fired with all fields |

---

## 15. Anti-Pattern Checklist (PART-026)

- [ ] No `setInterval` / `setTimeout` used for timer (using TimerComponent)
- [ ] No custom validation regex (using validateAnswer from PART-013)
- [ ] No hardcoded question content (loaded via postMessage)
- [ ] Global event handlers attached via `window.handleOptionSelect` pattern
- [ ] `timer.destroy()` called in endGame
- [ ] `progressBar.destroy()` called in endGame
- [ ] No mix of `duration` + `buttons` on same transitionScreen
- [ ] VisibilityTracker passes `fromVisibilityTracker` flag to timer pause/resume
