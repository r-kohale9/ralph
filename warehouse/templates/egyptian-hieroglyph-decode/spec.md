# Egyptian Hieroglyph Decode — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Egyptian Hieroglyph Decode
- **Game ID:** game_egyptian_hieroglyph_decode
- **Type:** standard
- **Description:** Use a reference key image showing Egyptian hieroglyph symbols and their numeric values, then decode a hieroglyph image by adding up the symbol values and typing the total. Multi-round game with image-based questions and numeric input. Dark theme.

---

## 2. Parts Selected

| Part ID  | Name                            | Included        | Config/Notes                                                        |
| -------- | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| PART-001 | HTML Shell                      | YES             | —                                                                   |
| PART-002 | Package Scripts                 | YES             | —                                                                   |
| PART-003 | waitForPackages                 | YES             | —                                                                   |
| PART-004 | Initialization Block            | YES             | —                                                                   |
| PART-005 | VisibilityTracker               | YES             | popupProps: default                                                 |
| PART-006 | TimerComponent                  | NO              | No time pressure                                                    |
| PART-007 | Game State Object               | YES             | Custom fields: userAnswer, phase                                    |
| PART-008 | PostMessage Protocol            | YES             | Full signalCollector pattern                                        |
| PART-009 | Attempt Tracking                | YES             | —                                                                   |
| PART-010 | Event Tracking                  | YES             | Custom events: answer_submitted                                     |
| PART-011 | End Game & Metrics              | YES             | Default stars: 3★ >= 80%, 2★ >= 50%, 1★ >= 1%. Lives: 2.           |
| PART-012 | Debug Functions                 | YES             | —                                                                   |
| PART-013 | Validation Fixed                | YES             | Each round has one correct numeric answer                           |
| PART-014 | Validation Function             | NO              | —                                                                   |
| PART-015 | Validation LLM                  | NO              | —                                                                   |
| PART-016 | StoriesComponent                | NO              | —                                                                   |
| PART-017 | Feedback Integration            | YES             | Audio feedback on correct/incorrect + celebration                   |
| PART-018 | Case Converter                  | NO              | —                                                                   |
| PART-019 | Results Screen (v2)             | YES             | Via TransitionScreen content slot                                   |
| PART-020 | CSS Variables & Colors          | YES             | Standard theme — no custom overrides                                |
| PART-021 | Screen Layout CSS (v2)          | YES             | v2 CSS only                                                         |
| PART-022 | Game Buttons                    | YES             | Submit + Next buttons                                               |
| PART-023 | ProgressBar Component (v2)      | YES             | totalRounds: 10, totalLives: 2                                      |
| PART-024 | TransitionScreen Component (v2) | YES             | welcome + results + game-over screens + audio                       |
| PART-025 | ScreenLayout Component (v2)     | YES             | slots: previewScreen, transitionScreen                              |
| PART-026 | Anti-Patterns                   | YES (REFERENCE) | Verification checklist                                              |
| PART-027 | Play Area Construction          | YES             | #gameContent = input + submit. Images in preview instruction.       |
| PART-028 | InputSchema Patterns            | YES             | Schema type: rounds with imageUrl + correctAnswer                   |
| PART-029 | Story-Only Game                 | NO              | —                                                                   |
| PART-030 | Sentry Error Tracking           | YES             | —                                                                   |
| PART-031 | API Helper                      | NO              | —                                                                   |
| PART-032 | AnalyticsManager                | NO              | —                                                                   |
| PART-033 | Interaction Patterns            | NO              | —                                                                   |
| PART-034 | Variable Schema Serialization   | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                            |
| PART-035 | Test Plan Generation            | YES (POST_GEN)  | Generates tests.md after HTML                                       |
| PART-037 | Playwright Testing              | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                              |
| PART-038 | InteractionManager              | YES             | Suppress taps during feedback. selector: '.game-play-area'          |
| PART-039 | Preview Screen                  | YES (MANDATORY) | Always included                                                     |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'game_egyptian_hieroglyph_decode',
  currentRound: 0,
  totalRounds: 10,
  lives: 2,
  totalLives: 2,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  contentSetId: null,
  signalConfig: null,
  sessionHistory: [],
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
  userAnswer: '',          // Current typed answer
  phase: 'idle',           // 'idle' | 'playing' | 'feedback' | 'ended'
  gameEnded: false,        // Double-call guard for endGame
};
const gameState = window.gameState;

let timer = null;
let visibilityTracker = null;
```

---

## 4. Input Schema

```json
{
  "type": "object",
  "properties": {
    "previewInstruction": { "type": "string", "description": "Instruction shown in preview area with key image" },
    "previewAudioText": { "type": "string", "description": "Plain text for TTS" },
    "keyImageUrl": { "type": "string", "description": "URL of the reference key image showing hieroglyph symbols and their values" },
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "imageUrl": { "type": "string", "description": "URL of the hieroglyph image to decode" },
          "correctAnswer": { "type": "integer", "description": "The correct decoded number" },
          "prompt": { "type": "string", "description": "Prompt shown between images, e.g. 'Decode this hieroglyph!'" }
        },
        "required": ["imageUrl", "correctAnswer"]
      }
    }
  },
  "required": ["previewInstruction", "keyImageUrl", "rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  previewInstruction: "Key to <b>Egyptian Hieroglyphs</b> 👇",
  previewAudioText: "Key to Egyptian Hieroglyphs",
  keyImageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/Key_A0dI1GZKT.png?updatedAt=1712989567593",
  rounds: [
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" },
    { imageUrl: "https://ik.imagekit.io/thehomeworkapp/Egyptian%20Numbers/27_-v1Ik7IUdT.png?updatedAt=1712997989238", correctAnswer: 27, prompt: "Decode this 👇 hieroglyph!" }
  ]
};
```

---

## 5. Screens & HTML Structure (v2)

### Screen 0: Preview Screen — PART-039 (MANDATORY)

**CRITICAL ARCHITECTURE:** This game uses the PreviewScreenComponent's **persistent wrapper**.
- ScreenLayout.inject() MUST use `slots` API with `previewScreen: true` — this creates the wrapper with `.mathai-preview-instruction`, `.game-stack`, `#gameContent`, etc.
- Do NOT create custom layout divs like `.mathai-instruction-zone`, `.mathai-game-area`, or any manual layout. The PreviewScreenComponent owns the page structure.
- Do NOT use the `sections` API (header/questionText/progressBar/playArea) — that API does NOT exist when `previewScreen: true`.
- The ONLY slot IDs that exist are: `#mathai-preview-slot`, `#gameContent`, `#mathai-transition-slot`.

On the first show, it displays the previewInstruction + key image. On each round, the instruction HTML is updated with: key image + prompt + hieroglyph image to decode.

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { previewScreen: true, transitionScreen: true }
});
```

PreviewScreen instantiation:
```javascript
const previewScreen = new PreviewScreenComponent({
  autoInject: true,
  slotId: 'mathai-preview-slot',
  gameContentId: 'gameContent'
});
```

Preview show — first time shows key image with instruction:
```javascript
var firstInstructionHtml =
  '<p>' + gameState.content.previewInstruction + '</p>' +
  '<img class="key-image" src="' + gameState.content.keyImageUrl + '" alt="Hieroglyph key" />';

previewScreen.show({
  instruction: firstInstructionHtml,
  audioUrl: null,
  showGameOnPreview: true,
  onComplete: startGameAfterPreview
});
```

### Round instruction update — key image + prompt + question image

Each round, update `.mathai-preview-instruction` with key image, prompt, and hieroglyph to decode:
```javascript
function updateInstructionArea() {
  var round = gameState.content.rounds[gameState.currentRound];
  var prompt = round.prompt || 'Decode this 👇 hieroglyph!';

  var instructionHtml =
    '<p>' + gameState.content.previewInstruction + '</p>' +
    '<img class="key-image" src="' + gameState.content.keyImageUrl + '" alt="Hieroglyph key" />' +
    '<p class="prompt-text">' + prompt + '</p>' +
    '<img class="question-image" src="' + round.imageUrl + '" alt="Hieroglyph to decode" />';

  var instrEl = document.querySelector('.mathai-preview-instruction');
  if (instrEl) instrEl.innerHTML = instructionHtml;
}
```

### Screen 1: Game Content (#gameContent — ONLY interactive elements)

```html
<div id="app"></div>
```

#gameContent contains ONLY the input field + buttons — NO images, NO instruction text:

```javascript
document.getElementById('gameContent').innerHTML = `
  <div class="game-play-area">
    <div class="input-wrapper">
      <input type="number" id="answerInput" class="answer-input"
             placeholder="Type here" inputmode="numeric" pattern="[0-9]*" />
    </div>

    <div class="button-row" id="buttonRow">
      <button class="game-btn btn-primary" id="btn-submit" disabled>Submit</button>
      <button class="game-btn btn-primary" id="btn-next" style="display:none;">Next</button>
    </div>
  </div>
`;
```

### Results Screen (via TransitionScreen content slot — PART-019 v2)

```javascript
transitionScreen.show({
  stars: metrics.stars,
  title: metrics.stars >= 2 ? 'Great Work!' : 'Keep Practicing!',
  content: `
    <div class="results-metrics">
      <div class="metric"><span class="metric-label">Score</span><span class="metric-value">${gameState.score}/${gameState.totalRounds}</span></div>
      <div class="metric"><span class="metric-label">Accuracy</span><span class="metric-value">${metrics.accuracy}%</span></div>
    </div>
  `,
  persist: true,
  buttons: [{ text: 'Play Again', type: 'primary', action: function() { restartGame(); } }]
});
```

---

## 6. CSS

```css
/* === Egyptian Hieroglyph Decode === */

/* Images inside preview instruction area */
.key-image {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  display: block;
  margin: 8px auto;
}

.question-image {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  display: block;
  margin: 8px auto;
}

.prompt-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--mathai-text-primary, #1a1a2e);
  text-align: left;
  line-height: 1.5;
  margin: 12px 0 4px;
}

/* ── Game play area: input + submit ONLY (inside #gameContent) ── */
.game-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* Answer input */
.input-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
}

.answer-input {
  width: 160px;
  height: 52px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: var(--mathai-text-primary, #1a1a2e);
  transition: border-color 0.2s ease;
  -moz-appearance: textfield;
}

.answer-input::-webkit-outer-spin-button,
.answer-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.answer-input::placeholder {
  color: #999;
}

.answer-input:focus {
  border-color: var(--mathai-primary, #6c5ce7);
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.25);
}

.answer-input.correct {
  border-color: var(--mathai-success, #27ae60);
  background: #eafaf1;
}

.answer-input.incorrect {
  border-color: var(--mathai-error, #e74c3c);
  background: #fdf2f2;
}

.answer-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Button row */
.button-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
}

/* Results metrics */
.results-metrics {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 16px 0;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.metric-label {
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--mathai-text-primary, #1a1a2e);
}
```

---

## 7. Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition -->
<script>
function initSentry() {
  if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled && typeof Sentry !== 'undefined') {
    Sentry.init({
      dsn: SentryConfig.dsn,
      environment: SentryConfig.environment,
      release: 'game-egyptian-hieroglyph-decode@1.0.0',
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
}

window.addEventListener('error', function(event) {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.error || new Error(event.message), {
      tags: { errorType: 'unhandled', severity: 'critical' },
      contexts: { errorEvent: { message: event.message, filename: event.filename, lineno: event.lineno } }
    });
  }
});

window.addEventListener('unhandledrejection', function(event) {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.reason || new Error('Unhandled promise rejection'), {
      tags: { errorType: 'unhandled-promise', severity: 'critical' }
    });
  }
});
</script>

<!-- STEP 3: Sentry SDK v10.23.0 -->
<script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
<script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

<!-- STEP 4: Initialize on load -->
<script>window.addEventListener('load', initSentry);</script>

<!-- STEP 5-7: Game packages -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

---

## 8. Game Flow

1. **Page loads** -> DOMContentLoaded fires
   - waitForPackages()
   - FeedbackManager.init()
   - VisibilityTracker creation
   - PreviewScreenComponent creation
   - setupGame()

2. **setupGame()** runs:
   - Builds game play area HTML into #gameContent (ONLY input + buttons)
   - Attaches handlers: #btn-submit -> handleSubmit(), #btn-next -> nextRound(), #answerInput -> enables submit
   - Calls showPreviewScreen()

3. **showPreviewScreen()** runs:
   - Passes previewInstruction + key image as HTML to previewScreen.show()
   - showGameOnPreview: true (input visible underneath but non-interactable)
   - When user skips/completes preview -> startGameAfterPreview()

4. **startGameAfterPreview()** runs:
   - Sets gameState.startTime, isActive, duration_data.startTime
   - trackEvent('game_start', 'game')
   - Calls renderRound()

5. **renderRound()** runs:
   - Updates preview instruction area with: key image + prompt + hieroglyph question image
   - Resets: userAnswer = '', input cleared, enabled, remove feedback classes
   - Hides Next, shows Submit (disabled)
   - Updates progress bar

6. **User interaction:**
   - User studies key image and hieroglyph question image (both in preview area above)
   - User types answer in input -> enables Submit
   - User taps Submit -> handleSubmit()
     - Validates: parseInt(userAnswer) === correctAnswer
     - Records attempt
     - If correct: score++, green input
     - If incorrect: lives--, red input. If lives <= 0 -> endGame()
     - Disables input + submit, shows Next
     - Plays feedback audio
   - User taps Next -> nextRound()

7. **End conditions — EVERY path that calls endGame():**
   - **All rounds completed**: nextRound() detects currentRound >= totalRounds -> endGame()
   - **Lives exhausted**: handleSubmit() detects lives <= 0 -> endGame()

---

## 9. Functions

### Global Scope (RULE-001)

**showPreviewScreen()**

- Called from setupGame()
- Builds HTML: previewInstruction text + key image
- Calls previewScreen.show({ instruction: html, audioUrl: null, showGameOnPreview: true, onComplete: startGameAfterPreview })

**startGameAfterPreview(previewData)**

- gameState.previewResult = previewData
- gameState.duration_data.preview.push({ duration: previewData.duration })
- Set gameState.startTime = Date.now(), isActive = true, duration_data.startTime
- trackEvent('game_start', 'game')
- signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })
- Call renderRound()

**setupGame()**

- Build game play area HTML into #gameContent (input + buttons only)
- Attach event listeners: #btn-submit, #btn-next, #answerInput input event
- Call showPreviewScreen()

**updateInstructionArea()**

- Builds HTML: key image + prompt + question image (from Section 5)
- Injects into .mathai-preview-instruction

**renderRound()**

- Reset: gameState.userAnswer = ''; answerInput.value = ''; remove correct/incorrect classes; enable input
- Buttons: show submit (disabled), hide next
- progressBar.update(gameState.currentRound, gameState.lives)
- Call updateInstructionArea()
- signalCollector.recordViewEvent('round_start', { round: gameState.currentRound + 1 })

**handleSubmit()**

- If userAnswer.trim() === '' return
- const round = gameState.content.rounds[gameState.currentRound]
- const userNum = parseInt(gameState.userAnswer.trim(), 10)
- const isCorrect = userNum === round.correctAnswer
- recordAttempt({ round: gameState.currentRound + 1, input_of_user: userNum, correct_answer: round.correctAnswer, correct: isCorrect })
- If correct: gameState.score++
- If incorrect: gameState.lives--
- Visual feedback: add 'correct' or 'incorrect' class to #answerInput
- Disable input + submit, show next
- Update progress bar (for lives display): progressBar.update(gameState.currentRound, gameState.lives)
- Audio feedback via FeedbackManager.playDynamicFeedback()
- trackEvent('answer_submitted', 'game', { round: gameState.currentRound + 1, correct: isCorrect, userAnswer: userNum, correctAnswer: round.correctAnswer })
- If incorrect AND gameState.lives <= 0: call endGame() after feedback delay (1.5s)

**nextRound()**

- gameState.currentRound++
- If gameState.currentRound >= gameState.totalRounds -> endGame()
- Else -> renderRound()

**endGame()**

- Guard: if (gameState.gameEnded) return; gameState.gameEnded = true
- gameState.isActive = false
- const totalTime = (Date.now() - gameState.startTime) / 1000
- Calculate metrics:
  ```javascript
  const accuracy = gameState.totalRounds > 0
    ? Math.round((gameState.score / gameState.totalRounds) * 100) : 0;
  const stars = gameState.lives <= 0 ? 0
    : accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy >= 1 ? 1 : 0;
  const metrics = {
    accuracy,
    time: parseFloat(totalTime.toFixed(1)),
    stars,
    star_thresholds: { 3: 80, 2: 50, 1: 1, 0: 0 },
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: gameState.totalLives,
    tries: computeTriesPerRound(),
  };
  ```
- trackEvent('game_end', 'game', { score: gameState.score, accuracy, stars })
- signalCollector.seal()
- Show results via TransitionScreen (game-over if lives=0, victory otherwise)
- Send postMessage
- Cleanup

**computeTriesPerRound()**

- Deduplicate attempts by round

**restartGame()**

- Reset all gameState fields including lives = totalLives
- Do NOT call showPreviewScreen again
- Call renderRound() directly

**handlePostMessage(event)** — From PART-008

**recordAttempt(data)** — From PART-009

**trackEvent(type, target, data)** — From PART-010

### Inside DOMContentLoaded (PART-004)

- waitForPackages()
- FeedbackManager.init()
- VisibilityTracker
- PreviewScreenComponent creation
- ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true } })
- setupGame()
- window.addEventListener('message', handlePostMessage)

### Window-Attached Debug (PART-012)

- debugGame, debugAudio, testAudio, testPause, testResume

---

## 10. Event Schema

### Game Lifecycle Events

| Event      | Target | When Fired                   |
| ---------- | ------ | ---------------------------- |
| game_start | game   | startGameAfterPreview() runs |
| game_end   | game   | endGame() fires              |

### Game-Specific Events

| Event            | Target | When Fired       | Data                                               |
| ---------------- | ------ | ---------------- | -------------------------------------------------- |
| answer_submitted | game   | User taps Submit | { round, correct, userAnswer, correctAnswer }      |

---

## 11. Scaffold Points

| Point           | Function       | When                     | What Can Be Injected                              |
| --------------- | -------------- | ------------------------ | ------------------------------------------------- |
| after_incorrect | handleSubmit() | User answers incorrectly | Hint highlighting specific symbols in the image    |
| before_round    | renderRound()  | New round starts         | Tip about reading hieroglyphs left-to-right        |

---

## 12. Feedback Triggers

| Moment                  | Trigger Function | Feedback Type               | Notes                     |
| ----------------------- | ---------------- | --------------------------- | ------------------------- |
| Correct answer          | handleSubmit()   | sound + visual (green)      | Green border on input     |
| Incorrect answer        | handleSubmit()   | sound + visual (red)        | Red border, life lost     |
| Game complete (3 stars) | showResults()    | celebration sound + sticker | On results screen         |
| Game over (0 lives)     | showResults()    | encouragement sound         | Gentle                    |

---

## 13. Visual Specifications

- **Layout:** Two-zone. **Zone 1 (preview instruction):** key image + prompt + hieroglyph question image. **Zone 2 (#gameContent):** number input + submit/next.
- **Theme:** Standard — uses `var(--mathai-*)` CSS variables from PART-020. No custom theme overrides.
- **Images:** Full-width (max 420px), border-radius 12px, centered. Key image persists every round. Question image changes per round.
- **Input field:** 160px wide, 52px tall, dark bg, light text, centered. No spin buttons.
- **Color palette:** Uses `var(--mathai-*)` variables. Success: #27ae60. Error: #e74c3c. Primary: #6c5ce7.
- **Lives:** Displayed in progress bar via hearts (totalLives: 2). Pink heart icon in header.

---

## 14. Test Scenarios

### Scenario: Preview screen displays key image

SETUP: Page loaded
ACTIONS:
wait for .mathai-preview-header to be visible
assert .mathai-preview-instruction contains <img> with key image URL
click .mathai-preview-skip-btn
wait for #gameContent to be visible
assert gameState.isActive === true
EXPECTED: Preview shows key image, skip advances to game

### Scenario: Round shows key image + question image + prompt

SETUP: Page loaded, preview skipped, game active
ACTIONS:
assert .mathai-preview-instruction contains .key-image (key reference)
assert .mathai-preview-instruction contains .question-image (hieroglyph to decode)
assert .mathai-preview-instruction contains prompt text "Decode this"
EXPECTED: Both images visible in instruction area above input

### Scenario: Submit correct answer and advance

SETUP: Round 1 active
ACTIONS:
evaluate: correctAnswer = window.gameState.content.rounds[0].correctAnswer
fill #answerInput with correctAnswer
click #btn-submit
assert #answerInput has class 'correct'
assert #btn-next is visible
click #btn-next
assert gameState.currentRound === 1
EXPECTED: Correct answer, score increments, next round loads

### Scenario: Submit incorrect answer loses life

SETUP: Round 1 active, lives = 2
ACTIONS:
fill #answerInput with "999"
click #btn-submit
ASSERT:
#answerInput has class 'incorrect'
gameState.lives === 1
gameState.attempts[0].correct === false
#btn-next is visible

### Scenario: Game over when lives reach 0

SETUP: Lives = 1 (already lost 1)
ACTIONS:
fill #answerInput with "999"
click #btn-submit
ASSERT:
gameState.lives === 0
wait for endGame
gameState.isActive === false
gameState.gameEnded === true
TransitionScreen visible (game over)
stars === 0

### Scenario: Complete all 10 rounds

SETUP: Preview skipped
ACTIONS:
For each round (0 to 9):
  evaluate correctAnswer
  fill #answerInput with correctAnswer
  click #btn-submit
  click #btn-next
ASSERT:
gameState.score === 10
accuracy === 100, stars === 3

### Scenario: Progress bar and lives update

SETUP: Preview skipped
ACTIONS:
assert progress bar shows round 0, lives 2
submit wrong answer
assert lives display shows 1
submit correct on next round
assert progress bar shows round 2
EXPECTED: Progress bar and lives track correctly

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] Body contains only `<div id="app"></div>`
- [ ] No `#results-screen` div

### Functional

- [ ] waitForPackages() with 180s timeout (PART-003)
- [ ] DOMContentLoaded calls init sequence (PART-004)
- [ ] VisibilityTracker with onInactive + onResume (PART-005)
- [ ] handlePostMessage handles game_init (PART-008)
- [ ] Fallback content for standalone testing (PART-008)
- [ ] recordAttempt correct shape (PART-009)
- [ ] trackEvent fires at all points (PART-010)
- [ ] endGame on ALL paths: rounds complete + lives exhausted (PART-011)
- [ ] Debug functions on window (PART-012)
- [ ] Results via TransitionScreen (PART-019 v2)
- [ ] PreviewScreen shows before game (PART-039)

### Design & Layout

- [ ] Uses `var(--mathai-*)` CSS variables — no hardcoded theme overrides on html/body
- [ ] ScreenLayout with slots API: { previewScreen: true, transitionScreen: true }
- [ ] ProgressBar with totalRounds: 10, totalLives: 2
- [ ] Lives display (hearts) in progress bar
- [ ] Images (key + question) in preview instruction area, NOT in #gameContent
- [ ] Key image persists across all rounds
- [ ] Question image updates each round
- [ ] Images full-width, max 420px, border-radius 12px

### Game-Specific

- [ ] Input type="number" with inputmode="numeric", no spin buttons
- [ ] Submit disabled until input non-empty
- [ ] Correct: green input, score++
- [ ] Incorrect: red input, lives--
- [ ] Game over when lives reach 0 (stars = 0)
- [ ] Next button after feedback, input disabled
- [ ] 10 rounds with progress bar
- [ ] Images + prompt update each round in preview instruction area
- [ ] Key image always visible alongside question image

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
