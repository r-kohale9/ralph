
# Game Spec: Math MCQ Quiz

**Game ID:** `math-mcq-quiz`
**Title:** Math Quiz Challenge

---

## Section 1 — Game Overview

| Field | Value |
|---|---|
| **Game ID** | `math-mcq-quiz` |
| **Title** | Math Quiz Challenge |
| **Audience** | Kids aged 5–10 |
| **Subject** | Elementary Math (addition, subtraction, basic multiplication) |
| **Input Method** | Tap / Click on answer option |
| **Rounds** | 3 |
| **Lives** | 3 |
| **Timer** | 30s countdown per question |
| **Validation** | Fixed answer (single correct option) |

---

## Section 2 — Game Flow

```
START SCREEN
  → "Let's Play! 🎉" button → startGame()

ROUND LOOP (repeat 3 rounds):
  → Show question + 4 MCQ option buttons
  → Start 30s countdown timer
  → On option tap:
      ✅ Correct → green flash → play correct_tap audio + sticker → next round
      ❌ Wrong   → red flash on choice → lose 1 life → play wrong_tap audio + sticker
                 → if lives > 0: stay on same question (wait for re-answer)
                    else: GAME OVER screen
  → Timer hits 0:
      → Treat as wrong answer → lose 1 life
      → if lives > 0: reset timer → allow retry
         else: GAME OVER screen
  → After correct answer OR after all lives lost on same Q:
      → If round < 3: ROUND TRANSITION screen ("Round X!" + Continue button) → next round
      → If round = 3: VICTORY screen

GAME OVER SCREEN: "Oh no! No lives left 😢" + Try Again button
VICTORY SCREEN: Stars (1–3 based on lives remaining) + "Amazing! 🎉" + results
```

**Lives → Stars:**
- 3 lives remaining → 3 stars
- 2 lives remaining → 2 stars
- 1 life remaining → 1 star

---

## Section 3 — Parts Used

| Part | ID | Reason |
|---|---|---|
| HTML Shell | PART-001 | Mandatory |
| Package Scripts | PART-002 | Mandatory |
| waitForPackages | PART-003 | Mandatory |
| Initialization | PART-004 | Mandatory |
| VisibilityTracker | PART-005 | Mandatory |
| TimerComponent | PART-006 | 30s countdown per question |
| Game State | PART-007 | Mandatory |
| PostMessage | PART-008 | Mandatory |
| Attempt Tracking | PART-009 | Mandatory |
| Event Tracking | PART-010 | Mandatory |
| End Game & Metrics | PART-011 | Mandatory |
| Debug Functions | PART-012 | Mandatory |
| Validation — Fixed | PART-013 | MCQ with single correct answer |
| Feedback Integration | PART-017 | Audio + sticker on correct/wrong |
| Results Screen | PART-019 | Mandatory |
| CSS Variables | PART-020 | Mandatory |
| Screen Layout CSS | PART-021 | Mandatory |
| Game Buttons | PART-022 | MCQ option buttons |
| ProgressBar | PART-023 | Show round + lives progress |
| TransitionScreen | PART-024 | Start / Round / Game-Over / Victory |
| ScreenLayout | PART-025 | Slots for progress + transition |
| Anti-Patterns | PART-026 | Verification checklist |
| Play Area Construction | PART-027 | Mandatory |
| InputSchema Patterns | PART-028 | Mandatory |
| Sentry Error Tracking | PART-030 | Mandatory |

---

## Section 4 — InputSchema

```json
{
  "type": "object",
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 3,
      "items": {
        "type": "object",
        "properties": {
          "question": { "type": "string" },
          "options": { "type": "array", "items": { "type": "string" }, "minItems": 4, "maxItems": 4 },
          "answer": { "type": "string" }
        },
        "required": ["question", "options", "answer"]
      }
    }
  },
  "required": ["questions"]
}
```

**Fallback Content (3 questions for kids 5–10):**

```javascript
const fallbackContent = {
  questions: [
    { question: "What is 3 + 4?",  options: ["5", "6", "7", "8"],    answer: "7" },
    { question: "What is 10 - 3?", options: ["6", "7", "8", "9"],    answer: "7" },
    { question: "What is 2 × 5?",  options: ["8", "10", "12", "15"], answer: "10" }
  ]
};
```

---

## Section 5 — Game State

```javascript
const gameState = {
  isStarted: false,
  isEnded: false,
  startTime: null,
  content: null,
  currentRound: 0,
  totalRounds: 3,
  lives: 3,
  totalLives: 3,
  score: 0,
  questions: [],
  selectedOption: null,
  isAnswering: true,
};
```

---

## Section 6 — UI Layout

```
┌─────────────────────────────────────┐
│  [ProgressBar: Round X/3 ❤️❤️❤️]   │  ← PART-023
├─────────────────────────────────────┤
│  [Timer: 00:30]                      │  ← PART-006, centered top
│                                      │
│  "What is 3 + 4?"                    │  ← Question text, large font
│                                      │
│  ┌────────┐  ┌────────┐             │
│  │   5    │  │   6    │             │  ← 4 MCQ option buttons (2×2 grid)
│  └────────┘  └────────┘             │
│  ┌────────┐  ┌────────┐             │
│  │   7    │  │   8    │             │
│  └────────┘  └────────┘             │
│                                      │
│  [TransitionScreen slot]             │  ← PART-024
└─────────────────────────────────────┘
```

- Option buttons: large, rounded, colorful (mathai palette), tap-friendly
- Correct flash: green border + background pulse
- Wrong flash: red shake animation on selected button
- Font size: ≥ 24px for question, ≥ 20px for options

---

## Section 7 — Key Functions

```
startGame()          → init timer, load round 0, show first question
loadRound(n)         → render question n, reset timer, enable options
handleAnswer(option) → validate, play feedback, update lives/score
onTimerEnd()         → treat as wrong answer, deduct life, retry or game over
nextRound()          → increment round counter, update progressBar, load next Q or end
endGame()            → stop timer, compute metrics, call endGame()
restartGame()        → reload page / reset state
```

---

## Section 8 — Feedback

| Event | Sound ID | Sticker |
|---|---|---|
| Correct answer | `correct_tap` | correct GIF |
| Wrong answer / timeout | `wrong_tap` | incorrect GIF |

```javascript
await FeedbackManager.sound.preload([
  { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
  { id: 'wrong_tap',   url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
]);

await FeedbackManager.sound.play('correct_tap', {
  subtitle: '**Great job!** That is correct!',
  sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif', duration: 2, type: 'IMAGE_GIF' }
});

await FeedbackManager.sound.play('wrong_tap', {
  subtitle: 'Oops! Try again!',
  sticker: { image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif', duration: 2, type: 'IMAGE_GIF' }
});
```

Timer paused via `timer.pause({ fromAudio: true })` during feedback; resumed after `await` via `timer.resume({ fromAudio: true })`.

---

## Section 9 — Metrics

```javascript
{
  score: gameState.score,
  totalRounds: 3,
  livesRemaining: gameState.lives,
  accuracy: Math.round((gameState.score / 3) * 100),
  timeTaken: timer.getTimeTaken(),
  attempts: gameState.attempts
}
```

---

## Section 10 — Transition Screens

| Screen | Trigger | Content |
|---|---|---|
| Start | Page load | Icon 🧮, "Math Quiz!", "I'm Ready!" button |
| Round transition | Correct answer on rounds 1–2 | Icon 🎯, "Round X!", Continue button (no duration) |
| Game Over | lives === 0 | Icon 😢, "Game Over!", Try Again button |
| Victory | Round 3 complete | Stars (1–3 based on livesRemaining), "You did it! 🎉", score subtitle |

---

## Section 11 — Timer Behaviour

- `timerType: 'decrease'`, `startTime: 30`, `endTime: 0`, `format: 'sec'`, `autoStart: false`
- Started via `timer.start()` at the beginning of each question
- On `onEnd`: deduct 1 life; if lives > 0 reset and restart; else show game over
- Destroyed in `endGame()` via `timer.destroy()`
- No `setInterval` or `setTimeout` used for timing

---

## Section 12 — Validation Logic

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
}
```

---

## Section 13 — VisibilityTracker Integration

```javascript
new VisibilityTracker({
  onInactive: () => {
    timer.pause({ fromVisibilityTracker: true });
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    timer.resume({ fromVisibilityTracker: true });
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
});
```

---

## Section 14 — Test Scenarios

1. **Page load** — start screen shown, game not yet started
2. **Start button** — clicking "I'm Ready!" starts game, loads round 0, timer begins
3. **Correct answer** — green flash, correct audio + sticker plays, score increments, round advances
4. **Wrong answer** — red shake, wrong audio + sticker plays, life decrements, same question reloads
5. **Timer expiry** — life decrements, same question reloads (or game over if lives = 0)
6. **All lives lost mid-game** — game over screen shown with Try Again button
7. **Round transition** — after correct answer on rounds 1–2, transition screen shows; Continue loads next round
8. **Victory** — after round 3 correct, victory screen with correct star count (= livesRemaining)
9. **Star count** — 3 lives remaining = 3 stars, 2 = 2 stars, 1 = 1 star
10. **Try Again** — restarts game, resets all state
11. **ProgressBar** — correct round count and heart count shown at all times
12. **Visibility change** — timer pauses when tab hidden, resumes when visible
13. **PostMessage game_init** — content injected correctly, fallback used if not provided
14. **endGame metrics** — score, accuracy, timeTaken, livesRemaining all present and correct
15. **Timer destroy** — `timer.destroy()` called in endGame, no lingering interval
