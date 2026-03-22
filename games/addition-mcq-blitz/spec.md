# Addition MCQ Blitz — Game Spec v1

## Section 1 — Overview

| Field | Value |
|-------|-------|
| **Game ID** | `addition-mcq-blitz` |
| **Title** | Addition MCQ Blitz |
| **Description** | Multiple-choice addition quiz. Players answer addition questions by choosing 1 of 4 options. Each question has a 30-second countdown. Players start with 3 lives — a wrong answer or timer expiry each costs one life. Game ends when all lives are lost or all questions are answered. |
| **Input Method** | Tap / Click |
| **Validation Type** | Fixed answer |
| **Has Timer** | Yes — 30-second countdown per question (resets between questions) |
| **Has Lives** | Yes — 3 lives |
| **Has Stories** | No |
| **Has Progress Bar** | No |
| **Has Transition Screen** | Yes — start screen, game-over screen, victory screen |
| **Total Rounds** | Dynamic (driven by content, fallback = 5) |

---

## Section 2 — Parts Selected

| Part | Name | Reason |
|------|------|--------|
| PART-001 | HTML Shell | Mandatory |
| PART-002 | Package Scripts | Mandatory |
| PART-003 | waitForPackages | Mandatory |
| PART-004 | Initialization Block | Mandatory |
| PART-005 | VisibilityTracker | Mandatory |
| PART-006 | TimerComponent | 30-sec per-question countdown |
| PART-007 | Game State Object | Mandatory |
| PART-008 | PostMessage Protocol | Mandatory |
| PART-009 | Attempt Tracking | Mandatory |
| PART-010 | Event Tracking & SignalCollector | Mandatory |
| PART-011 | End Game & Metrics | Mandatory |
| PART-012 | Debug Functions | Mandatory |
| PART-013 | Validation — Fixed Answer | MCQ with single correct option |
| PART-017 | Feedback Integration | correct_tap + wrong_tap audio + stickers |
| PART-019 | Results Screen UI | Mandatory |
| PART-020 | CSS Variables & Colors | Mandatory |
| PART-021 | Screen Layout CSS | Mandatory |
| PART-022 | Game Buttons | Option buttons + action buttons |
| PART-024 | TransitionScreen Component | Start / Game-Over / Victory screens |
| PART-025 | ScreenLayout Component | Required by PART-024 |
| PART-026 | Anti-Patterns | Verification checklist |
| PART-027 | Play Area Construction | Mandatory |
| PART-028 | InputSchema Patterns | Mandatory |
| PART-030 | Sentry Error Tracking | Mandatory |

---

## Section 3 — InputSchema

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question:  { type: 'string' },
          answer:    { type: 'number' },
          options:   { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }
        },
        required: ['question', 'answer', 'options']
      },
      minItems: 1
    }
  },
  required: ['questions']
};
```

### Fallback Content (5 questions)

```javascript
const fallbackContent = {
  questions: [
    { question: '3 + 4 = ?',  answer: 7,  options: [5,  6,  7,  8]  },
    { question: '8 + 6 = ?',  answer: 14, options: [12, 13, 14, 15] },
    { question: '9 + 7 = ?',  answer: 16, options: [14, 15, 16, 17] },
    { question: '5 + 5 = ?',  answer: 10, options: [8,  9, 10, 11]  },
    { question: '12 + 8 = ?', answer: 20, options: [18, 19, 20, 21] }
  ]
};
```

---

## Section 4 — Game State

```javascript
window.gameState = {
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
  lives: 3,
  maxLives: 3
};

let currentQ = null;  // set at top of renderRound()
```

---

## Section 5 — HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Addition MCQ Blitz</title>
  <style></style>
</head>
<body>
  <div id="app"></div>
  <template id="gameContent">
    <div id="mathai-transition-slot"></div>
    <div id="game-screen">
      <div id="action-bar">
        <div id="lives-display"></div>
        <div id="timer-container"></div>
      </div>
      <div id="question-display" class="question-display"></div>
      <div id="options-grid" class="options-grid">
        <button id="option-0" class="option-btn" onclick="handleOptionClick(0)"></button>
        <button id="option-1" class="option-btn" onclick="handleOptionClick(1)"></button>
        <button id="option-2" class="option-btn" onclick="handleOptionClick(2)"></button>
        <button id="option-3" class="option-btn" onclick="handleOptionClick(3)"></button>
      </div>
      <div id="round-indicator" class="round-indicator"></div>
    </div>
    <div id="results-screen" style="display:none;">
      <div class="results-container">
        <h2 id="results-title">Game Complete!</h2>
        <div id="stars-display" class="stars-display"></div>
        <div class="results-metrics">
          <div class="metric-row"><span class="metric-label">Score</span><span id="result-score" class="metric-value">0%</span></div>
          <div class="metric-row"><span class="metric-label">Time</span><span id="result-time" class="metric-value">0s</span></div>
          <div class="metric-row"><span class="metric-label">Correct</span><span id="result-correct" class="metric-value">0/0</span></div>
        </div>
        <button onclick="location.reload()">Play Again</button>
      </div>
    </div>
  </template>
  <script></script>
</body>
</html>
```

---

## Section 6 — CSS (Game-Specific)

```css
#game-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; gap: 20px; }
#action-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 480px; }
#lives-display { font-size: 28px; letter-spacing: 4px; }
.question-display { font-size: 32px; font-weight: 700; color: var(--mathai-dark); text-align: center; padding: 16px 24px; background: var(--mathai-light-purple, #f3eeff); border-radius: 16px; width: 100%; max-width: 480px; }
.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 480px; }
.option-btn { padding: 20px; font-size: 24px; font-weight: 700; border-radius: 14px; border: 3px solid var(--mathai-blue, #3b7dd8); background: #fff; color: var(--mathai-dark, #1a1a2e); cursor: pointer; transition: background 0.15s, transform 0.1s; min-height: 72px; }
.option-btn:hover { background: var(--mathai-blue, #3b7dd8); color: #fff; }
.option-btn:active { transform: scale(0.96); }
.option-btn.correct { background: var(--mathai-green, #2dc653); color: #fff; border-color: var(--mathai-green, #2dc653); }
.option-btn.wrong { background: var(--mathai-red, #e63946); color: #fff; border-color: var(--mathai-red, #e63946); }
.option-btn.disabled { opacity: 0.55; cursor: not-allowed; pointer-events: none; }
.round-indicator { font-size: 14px; color: var(--mathai-grey, #888); margin-top: 4px; }
```

---

## Section 7 — Game Flow

### 7.1 Initialization (DOMContentLoaded)

```
waitForPackages()
  // DO NOT CALL FeedbackManager.init() — causes blocking audio popup in iframe context
  → new SignalCollector(...)
  → ScreenLayout.inject('app', { slots: { progressBar: false, transitionScreen: true } })
  → FeedbackManager.sound.preload([
        { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
        { id: 'wrong_tap',   url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
    ])  ← wrapped in try/catch
  → new TimerComponent('timer-container', {
        timerType: 'decrease', format: 'sec', startTime: 30, endTime: 0, autoStart: false,
        onEnd: () => handleTimerExpiry()
    })
  → new VisibilityTracker({
        onInactive: () => { timer?.pause({ fromVisibilityTracker: true }); FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); },
        onResume:   () => { timer?.resume({ fromVisibilityTracker: true }); FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); }
    })
  → window.addEventListener('message', handlePostMessage)
  → setupGame()
```

### 7.2 setupGame()

```
gameState.content = content || fallbackContent
gameState.totalRounds = gameState.content.questions.length
gameState.currentRound = 0
gameState.score = 0
gameState.lives = 3
gameState.attempts = []
gameState.events = []
gameState.startTime = Date.now()
gameState.isActive = true
gameState.duration_data.startTime = new Date().toISOString()
trackEvent('game_start', 'game')

NOTE: timer.start() is NOT called here — timer only starts inside renderRound()
      so it cannot expire while the user sits on the start screen.

→ transitionScreen.show({
    icons: ['➕'], iconSize: 'large',
    title: 'Addition Blitz!',
    subtitle: '3 lives · 30 seconds per question',
    buttons: [{ text: "Let's go!", type: 'primary', action: () => renderRound() }]
  })
```

### 7.3 renderRound()

```
currentQ = gameState.content.questions[gameState.currentRound]  ← set module-scope currentQ

timer.stop()
timer.reset()
timer.start()

document.getElementById('question-display').textContent = currentQ.question
render 4 option buttons with currentQ.options values (clear .correct/.wrong/.disabled from previous round)
update round indicator: "Question N / total"
updateLivesDisplay()
```

### 7.4 handleOptionClick(index)

```
if (!gameState.isActive) return

timer.stop()   ← FIRST: stop timer immediately — prevents expiry firing during ~2s feedback audio

selectedValue = currentQ.options[index]
isCorrect = validateAnswer(selectedValue, currentQ.answer)

highlight selected button: .correct or .wrong
disable all 4 option buttons (.disabled)

recordAttempt({
  userAnswer: selectedValue,
  correct: isCorrect,
  question: currentQ.question,
  correctAnswer: currentQ.answer,
  validationType: 'fixed'
})

if (isCorrect):
  gameState.score++
  trackEvent('correct_answer', 'answer', { round: gameState.currentRound })
  await FeedbackManager.sound.play('correct_tap', {
    subtitle: '**Correct!** Great job!',
    sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif', duration: 2, type: 'IMAGE_GIF' }
  })
else:
  await FeedbackManager.sound.play('wrong_tap', {
    subtitle: 'Not quite — keep going!',
    sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif', duration: 2, type: 'IMAGE_GIF' }
  })
  decrementLife()

nextRound()   ← called AFTER await resolves
```

### 7.5 handleTimerExpiry()

```
if (!gameState.isActive) return

highlight all 4 buttons as .disabled
recordAttempt({
  userAnswer: null, correct: false,
  question: currentQ.question, correctAnswer: currentQ.answer,
  validationType: 'fixed', metadata: { timedOut: true }
})
decrementLife()
setTimeout(800ms) → nextRound()
```

### 7.6 decrementLife()

```
gameState.lives--
updateLivesDisplay()
if (gameState.lives <= 0):
  setTimeout(600ms) → triggerGameOver()
```

### 7.7 nextRound()

```
gameState.currentRound++
if (gameState.lives <= 0) return   ← GUARD: triggerGameOver() already scheduled — do NOT render next question
if (gameState.currentRound >= gameState.totalRounds):
  endGame()
  return
renderRound()
```

### 7.8 triggerGameOver()

```
timer.stop()
transitionScreen.show({
  icons: ['💔'], iconSize: 'large',
  title: 'Game Over!',
  subtitle: 'You ran out of lives.',
  buttons: [
    { text: 'Try Again!',  type: 'primary',   action: () => restartGame() },
    { text: 'See Results', type: 'secondary', action: () => endGame() }
  ]
})
```

### 7.9 endGame()

```
if (!gameState.isActive) return

gameState.isActive = false
gameState.duration_data.currentTime = new Date().toISOString()
accuracy = correct attempts / total attempts * 100
timeTaken = timer ? timer.getTimeTaken() : (Date.now() - gameState.startTime) / 1000
stars = lives >= 3 ? 3 : lives >= 2 ? 2 : lives >= 1 ? 1 : 0   (lives-based)

log metrics + attempt history
trackEvent('game_end', 'game', { metrics })
flush pendingEndProblem if any
signalCollector.seal()
showResults(metrics)
postMessage game_complete with metrics + ...signalPayload
cleanup: timer.destroy(); timer = null; visibilityTracker.destroy(); visibilityTracker = null;
         FeedbackManager.sound.stopAll(); FeedbackManager.stream.stopAll()
```

### endGame() Call Sites

| Condition | Code Path |
|-----------|-----------|
| All questions answered | `nextRound()` → `currentRound >= totalRounds` → `endGame()` |
| All lives lost | `decrementLife()` → `lives <= 0` → `triggerGameOver()` → "See Results" → `endGame()` |
| Timer expires + last life | `handleTimerExpiry()` → `decrementLife()` → `lives <= 0` → same path |

---

## Section 8 — Functions

### validateAnswer

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  return String(userAnswer).trim() === String(correctAnswer).trim();
}
```

### Stars — Lives-Based Formula

```javascript
// Lives-based (overrides accuracy default per PART-011)
const stars = gameState.lives >= 3 ? 3 : gameState.lives >= 2 ? 2 : gameState.lives >= 1 ? 1 : 0;
```

### updateLivesDisplay

```javascript
function updateLivesDisplay() {
  document.getElementById('lives-display').textContent =
    '❤️'.repeat(gameState.lives) + '🖤'.repeat(gameState.maxLives - gameState.lives);
}
```

### restartGame

```javascript
function restartGame() {
  gameState.currentRound = 0; gameState.score = 0; gameState.lives = 3;
  gameState.attempts = []; gameState.events = [];
  gameState.isActive = true; gameState.startTime = Date.now();
  gameState.duration_data = { startTime: new Date().toISOString(), preview: [], attempts: [],
    evaluations: [], inActiveTime: [], totalInactiveTime: 0, currentTime: null };

  trackEvent('game_start', 'game');   ← track restart as new game session for analytics

  signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null });
  window.signalCollector = signalCollector;

  timer = new TimerComponent('timer-container', { timerType: 'decrease', format: 'sec',
    startTime: 30, endTime: 0, autoStart: false, onEnd: () => handleTimerExpiry() });

  visibilityTracker = new VisibilityTracker({
    onInactive: () => { timer?.pause({ fromVisibilityTracker: true }); FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); },
    onResume:   () => { timer?.resume({ fromVisibilityTracker: true }); FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); }
  });

  document.getElementById('results-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  renderRound();
}
```

---

## Section 9 — Timer Behaviour

| Situation | Timer Action |
|-----------|-------------|
| `setupGame()` | Timer NOT started — only starts inside `renderRound()` |
| New question rendered | `timer.stop()` → `timer.reset()` → `timer.start()` |
| Option clicked | `timer.stop()` immediately (first line of handleOptionClick) |
| Timer expires | `handleTimerExpiry()` — lose a life, advance question |
| Tab hidden | `timer.pause({ fromVisibilityTracker: true })` + audio pause |
| Tab visible | `timer.resume({ fromVisibilityTracker: true })` + audio resume |
| endGame() | `timer.destroy(); timer = null` |

---

## Section 10 — Transition Screens

| Screen | Trigger | Config |
|--------|---------|--------|
| Start screen | `setupGame()` | icon ➕, "Let's go!" → `renderRound()` |
| Game-over | `triggerGameOver()` | icon 💔, ["Try Again!", "See Results"] |
| Results | `endGame()` → `showResults()` | results screen shown directly |

---

## Section 11 — Content Example

```json
{
  "questions": [
    { "question": "3 + 4 = ?",  "answer": 7,  "options": [5, 6, 7, 8]    },
    { "question": "8 + 6 = ?",  "answer": 14, "options": [12, 13, 14, 15] },
    { "question": "9 + 7 = ?",  "answer": 16, "options": [14, 15, 16, 17] },
    { "question": "5 + 5 = ?",  "answer": 10, "options": [8, 9, 10, 11]   },
    { "question": "12 + 8 = ?", "answer": 20, "options": [18, 19, 20, 21] }
  ]
}
```
Constraints: exactly 4 options; answer must appear in options exactly once.

---

## Section 12 — Anti-Patterns Checklist

**Anti-pattern #1: FeedbackManager.init() — DO NOT CALL**
Calling FeedbackManager.init() triggers a blocking audio permission popup that freezes the game in an iframe context. This function is globally banned. Do not include it anywhere in the generated HTML.

- [ ] No `setInterval`/`setTimeout` for timer — `TimerComponent` only
- [ ] All game logic in global scope, not inside `DOMContentLoaded`
- [ ] `window.gameState` not `const gameState`
- [ ] `let currentQ = null` declared at module scope; assigned in `renderRound()`
- [ ] `timer.destroy(); timer = null` in `endGame()`
- [ ] `restartGame()` recreates timer, visibilityTracker, signalCollector
- [ ] `restartGame()` calls `trackEvent('game_start', 'game')` for analytics
- [ ] `setupGame()` sets `startTime`, `isActive = true` — does NOT call `timer.start()`
- [ ] `renderRound()` calls `timer.stop()` → `timer.reset()` → `timer.start()`
- [ ] `handleOptionClick()` calls `timer.stop()` as its FIRST line
- [ ] `nextRound()` returns early if `gameState.lives <= 0`
- [ ] Option buttons disabled immediately after click
- [ ] No `duration` + `buttons` on same TransitionScreen call
- [ ] `FeedbackManager.sound.preload([...])` — NOT `register()`
- [ ] `await FeedbackManager.sound.play(...)` — `nextRound()` after await, no setTimeout
- [ ] VisibilityTracker uses `sound.pause()`/`sound.resume()` — NOT `sound.stopAll()`
- [ ] `handleTimerExpiry()` calls `recordAttempt()` with `userAnswer: null, correct: false`
- [ ] Fallback content matches inputSchema exactly

---

## Section 13 — Debug Functions

```javascript
window.debugGame = {
  getState:    () => JSON.parse(JSON.stringify(gameState)),
  endGame:     () => endGame(),
  setLives:    (n) => { gameState.lives = n; updateLivesDisplay(); },
  skipRound:   () => nextRound(),
  expireTimer: () => handleTimerExpiry()
};
```

---

## Section 14 — Test Scenarios

### T1 — Page Load
- Loads without errors; start screen shows ➕ icon and "Addition Blitz!"
- Timer does NOT start counting on start screen

### T2 — Game Start
- "Let's go!" → `renderRound()` fires; question + 4 options render; timer counts from 30

### T3 — Correct Answer
- Click correct option → timer stops immediately; green highlight; `correct_tap` audio + sticker
- After audio: next question loads, timer resets to 30

### T4 — Wrong Answer
- Click wrong option → timer stops immediately; red highlight; `wrong_tap` audio + sticker; lives -1
- After audio: next question loads

### T5 — Timer Expiry
- 30s passes → `handleTimerExpiry()`: attempt recorded (null, wrong), lives -1, next question

### T6 — Last Life Lost → Game Over
- `window.debugGame.setLives(1)` → wrong answer → game-over screen with 💔
- No question renders behind the overlay

### T7 — Try Again
- "Try Again!" → lives 3, round 0, fresh timer, first question; `game_start` event fired

### T8 — All Questions Done → Results
- Finish 5 questions → `#results-screen` shown, `game_complete` postMessage sent

### T9 — Stars
- 3 lives left → ⭐⭐⭐ | 1 life left → ⭐☆☆ | 0 lives → ☆☆☆

### T10 — Tab Visibility
- Hide tab → timer + audio pause; restore → both resume

### T11 — postMessage Init
- `game_init` with custom questions → game resets and uses them

### T12 — Debug
- `getState()`, `expireTimer()`, `skipRound()` all work correctly

### T13 — Audio
- Correct: `correct_tap` + ✅ sticker; Wrong: `wrong_tap` + ❌ sticker
- Next question only after audio finishes

### T14 — No Double Life Loss / No Ghost Question
- Wrong answer with <2s on clock → only 1 life lost; no new question appears until audio resolves
- Lives = 0 after wrong answer → game-over screen appears, NOT a new question
