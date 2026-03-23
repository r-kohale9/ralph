# MCQ Addition Blitz — Game Spec v1

## 1. Game Overview

| Field | Value |
|---|---|
| **Game ID** | `mcq-addition-blitz` |
| **Title** | MCQ Addition Blitz |
| **Concept** | Player answers addition questions by selecting 1 of 4 multiple-choice options. Each question has a 30-second countdown timer. Wrong answers or timer expiry cost a life. The game ends when all questions are answered or all 3 lives are lost. |
| **Input Method** | Tap / click on option button |
| **Timer** | Countdown, 30 seconds per question |
| **Validation** | Fixed answer (single correct MCQ option) |
| **Lives** | 3 |
| **Win Condition** | All questions answered before lives run out |
| **Lose Condition** | All 3 lives lost |

---

## 2. Parts Used

| Part | Why |
|---|---|
| PART-001 | HTML Shell |
| PART-002 | Package Scripts |
| PART-003 | waitForPackages |
| PART-004 | Initialization Block |
| PART-005 | VisibilityTracker |
| PART-006 | TimerComponent (30s countdown per question) |
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
  isGameStarted: false,
  isGameEnded: false,
  currentRound: 0,          // 0-based index into questions array
  totalRounds: 0,           // set from content
  content: null,

  // Game-specific
  lives: 3,
  totalLives: 3,
  correctAnswers: 0,        // incremented each time the player selects the correct option
  currentQuestion: null,    // { question, answer, options }
  selectedOption: null,
  isAnswered: false,        // lock after selection or timer expiry
};
```

---

## 4. InputSchema

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },        // e.g. "12 + 7 = ?"
          answer:   { type: 'number' },        // e.g. 19
          options:  { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }
        },
        required: ['question', 'answer', 'options']
      },
      minItems: 1
    }
  },
  required: ['questions']
};

const fallbackContent = {
  questions: [
    { question: '3 + 5 = ?',   answer: 8,  options: [6, 7, 8, 9]   },
    { question: '12 + 7 = ?',  answer: 19, options: [17, 18, 19, 20] },
    { question: '25 + 14 = ?', answer: 39, options: [36, 37, 38, 39] },
    { question: '8 + 6 = ?',   answer: 14, options: [12, 13, 14, 15] },
    { question: '30 + 11 = ?', answer: 41, options: [39, 40, 41, 42] },
  ]
};
```

---

## 5. Screen Flow

```
[Start TransitionScreen] → [Question Screen] → (correct / wrong / timeout)
    ↓ all questions done or lives=0
[End TransitionScreen / Results]
```

### Start Screen
```javascript
transitionScreen.show({
  icons: ['➕'],
  iconSize: 'large',
  title: 'Addition Blitz!',
  subtitle: '3 lives · 30 seconds per question',
  buttons: [{ text: "Let's Go!", type: 'primary', action: () => startGame() }]
});
```

> **Note:** `startGame()` is a thin wrapper that calls `setupGame()` to initialise state and begin gameplay.

### Game Over Screen (lives exhausted)
```javascript
transitionScreen.show({
  icons: ['💔'],
  iconSize: 'large',
  title: 'Game Over!',
  subtitle: `You answered ${correct} out of ${total} correctly.`,
  buttons: [{ text: 'Try Again', type: 'primary', action: () => restartGame() }]
});
```

### Victory Screen (all questions answered with lives remaining)
```javascript
transitionScreen.show({
  stars: starsEarned,   // 1–3 based on lives remaining
  title: 'Well Done! 🎉',
  subtitle: `${correct}/${total} correct`,
  buttons: [{ text: 'Claim Stars', type: 'primary', action: () => claimStars() }]
});
```

**Star logic:**
- 3 lives remaining → 3 stars
- 2 lives remaining → 2 stars
- 1 life remaining  → 1 star
- 0 lives remaining → game over (no stars)

---

## 6. Play Area HTML

```html
<div id="question-area">
  <p id="question-text"></p>
</div>
<div id="options-grid">
  <button class="option-btn" data-index="0"></button>
  <button class="option-btn" data-index="1"></button>
  <button class="option-btn" data-index="2"></button>
  <button class="option-btn" data-index="3"></button>