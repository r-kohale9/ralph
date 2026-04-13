# Video Pattern MCQ — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Video Pattern MCQ
- **Game ID:** game_video_pattern_mcq
- **Type:** standard
- **Description:** Watch a short video showing a visual pattern with a missing piece (question mark), then tap the image option that correctly completes the pattern. Single-question MCQ with image-based options and a video-based question.

---

## 2. Parts Selected

| Part ID  | Name                            | Included        | Config/Notes                                                        |
| -------- | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| PART-001 | HTML Shell                      | YES             | —                                                                   |
| PART-002 | Package Scripts                 | YES             | —                                                                   |
| PART-003 | waitForPackages                 | YES             | —                                                                   |
| PART-004 | Initialization Block            | YES             | —                                                                   |
| PART-005 | VisibilityTracker               | YES             | popupProps: default. Uses sound.pause()/stream.pauseAll()           |
| PART-006 | TimerComponent                  | NO              | No time pressure — observation-based game                           |
| PART-007 | Game State Object               | YES             | Custom fields: selectedOption, videoPlayed, phase. Single question, no rounds. |
| PART-008 | PostMessage Protocol            | YES             | Full 6-property signalCollector pattern in handlePostMessage        |
| PART-009 | Attempt Tracking                | YES             | —                                                                   |
| PART-010 | Event Tracking                  | YES             | Custom events: video_played, option_selected, answer_submitted      |
| PART-011 | End Game & Metrics              | YES             | Single question: 3★ = correct, 0★ = incorrect. Binary outcome.     |
| PART-012 | Debug Functions                 | YES             | —                                                                   |
| PART-013 | Validation Fixed                | YES             | Each round has one correct image option (by index)                  |
| PART-014 | Validation Function             | NO              | —                                                                   |
| PART-015 | Validation LLM                  | NO              | —                                                                   |
| PART-016 | StoriesComponent                | NO              | —                                                                   |
| PART-017 | Feedback Integration            | YES             | Audio feedback on correct/incorrect + celebration on results        |
| PART-018 | Case Converter                  | NO              | —                                                                   |
| PART-019 | Results Screen (v2)             | YES             | Via TransitionScreen content slot — metrics: score, accuracy, stars |
| PART-020 | CSS Variables & Colors          | YES             | —                                                                   |
| PART-021 | Screen Layout CSS (v2)          | YES             | v2 CSS only                                                         |
| PART-022 | Game Buttons                    | YES             | Submit button only (no Next — single question)                      |
| PART-023 | ProgressBar Component (v2)      | NO              | Single question — no progress bar needed                            |
| PART-024 | TransitionScreen Component (v2) | YES             | welcome + results screens + audio                                   |
| PART-025 | ScreenLayout Component (v2)     | YES             | sections: questionText, progressBar, playArea, transitionScreen     |
| PART-026 | Anti-Patterns                   | YES (REFERENCE) | Verification checklist                                              |
| PART-027 | Play Area Construction          | YES             | #gameContent = game-play-area only (prompt + options + submit). Video in preview instruction. |
| PART-028 | InputSchema Patterns            | YES             | Schema type: rounds array with video + image options                |
| PART-029 | Story-Only Game                 | NO              | —                                                                   |
| PART-030 | Sentry Error Tracking           | YES             | —                                                                   |
| PART-031 | API Helper                      | NO              | —                                                                   |
| PART-032 | AnalyticsManager                | NO              | —                                                                   |
| PART-033 | Interaction Patterns            | NO              | —                                                                   |
| PART-034 | Variable Schema Serialization   | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                            |
| PART-035 | Test Plan Generation            | YES (POST_GEN)  | Generates tests.md after HTML                                       |
| PART-037 | Playwright Testing              | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                              |
| PART-038 | InteractionManager              | YES             | Suppress taps during feedback animations. selector: '.game-play-area' |
| PART-039 | Preview Screen                  | YES (MANDATORY) | Always included — shows before game starts                          |
| PART-040 | Video Player                    | YES             | White bg, native controls, no fullscreen. Matches VideoPart.tsx     |

---

## 3. Game State

```javascript
// CRITICAL: Use window.gameState (not const) — Playwright tests access via window
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'game_video_pattern_mcq',
  currentRound: 0,
  totalRounds: 1,
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
  selectedOption: null,     // Index of currently selected option (0, 1, 2, ...) or null
  videoPlayed: false,       // Whether video has been played at least once this round
  phase: 'idle',            // 'idle' | 'watching' | 'choosing' | 'feedback' | 'ended'
  gameEnded: false,         // Double-call guard for endGame
};
const gameState = window.gameState; // Convenience alias

let timer = null;
let visibilityTracker = null;
```

---

## 4. Input Schema

```json
{
  "type": "object",
  "properties": {
    "previewInstruction": { "type": "string", "description": "Instruction shown in preview area above the video, e.g. 'Watch the video and find the pattern! Can you figure out what replaces the question mark?'" },
    "previewAudioText": { "type": "string", "description": "Plain text version of previewInstruction for TTS audio" },
    "videoUrl": { "type": "string", "description": "URL of the video showing the pattern with a missing piece" },
    "prompt": { "type": "string", "description": "Prompt shown below video in game area, e.g. 'Tap and select the option that will replace the question mark in the video'" },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "imageUrl": { "type": "string", "description": "URL of the option image" },
          "label": { "type": "string", "description": "Accessibility label for the image" }
        },
        "required": ["imageUrl"]
      },
      "description": "Array of image options (typically 3-4)"
    },
    "correctIndex": { "type": "integer", "description": "0-based index of the correct option in the options array" }
  },
  "required": ["previewInstruction", "videoUrl", "prompt", "options", "correctIndex"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  previewInstruction: "Watch the video and find the <b>pattern</b>! Can you figure out what replaces the question mark?",
  previewAudioText: "Watch the video and find the pattern. Can you figure out what replaces the question mark?",
  videoUrl: "https://ik.imagekit.io/thehomeworkapp/Personalised_videos/Logic/Q1.mp4?updatedAt=1731901431160",
  prompt: "Tap and select the option that will replace the question mark in the video 👇",
  options: [
    { imageUrl: "https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1731766055285.png", label: "Option A" },
    { imageUrl: "https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1731766065591.png", label: "Option B" },
    { imageUrl: "https://cdn.homeworkapp.ai/sets-gamify-assets/dev/home-explore/document/1731766074368.png", label: "Option C" }
  ],
  correctIndex: 2
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

The video is part of the **preview instruction HTML**, NOT inside `#gameContent`.
The `.mathai-preview-instruction` element already has built-in CSS: `video { width: 100%; }`.

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { previewScreen: true, transitionScreen: true }
});
```

PreviewScreen instantiation (in DOMContentLoaded):
```javascript
const previewScreen = new PreviewScreenComponent({
  autoInject: true,
  slotId: 'mathai-preview-slot',
  gameContentId: 'gameContent'
});
```

Preview show — previewInstruction text + embedded video passed as HTML:
```javascript
// Build instruction HTML: previewInstruction + video + prompt (all in one scroll area)
var instructionHtml =
  '<p>' + gameState.content.previewInstruction + '</p>' +
  '<div class="video-wrapper">' +
    '<video id="patternVideo" controls playsinline webkit-playsinline ' +
           'preload="auto" controlsList="nofullscreen">' +
      '<source src="' + gameState.content.videoUrl + '" type="video/mp4">' +
    '</video>' +
  '</div>' +
  '<p>' + gameState.content.prompt + '</p>';

previewScreen.show({
  instruction: instructionHtml,
  audioUrl: null,            // No TTS audio for this game
  showGameOnPreview: true,   // Show options underneath (non-interactable until skip)
  onComplete: startGameAfterPreview
});
```

> **Key:** The video lives inside `.mathai-preview-instruction` — the preview component's scroll area.
> It persists after preview ends (the wrapper stays visible). The user can still play/replay the video during gameplay.
> The prompt text ("Tap and select...") sits below the video, directly above the option images.

### Screen 1: Game Content (#gameContent — ONLY interactive elements)

```html
<div id="app"></div>
```

#gameContent contains ONLY the interactive game area — NO video, NO instruction text:

```javascript
document.getElementById('gameContent').innerHTML = `
  <div class="game-play-area">
    <div class="options-container" id="optionsContainer">
      <!-- Image option buttons generated dynamically -->
    </div>

    <div class="button-row" id="buttonRow">
      <button class="game-btn btn-primary" id="btn-submit" disabled>Submit</button>
    </div>
  </div>
`;
```

### Results Screen (via TransitionScreen content slot — PART-019 v2)

```javascript
transitionScreen.show({
  stars: metrics.stars,
  title: metrics.stars === 3 ? 'Correct! Well Done!' : 'Not quite!',
  content: `
    <div class="results-metrics">
      <div class="metric"><span class="metric-label">Result</span><span class="metric-value">${gameState.score === 1 ? 'Correct' : 'Incorrect'}</span></div>
    </div>
  `,
  persist: true,
  buttons: [{ text: 'Play Again', type: 'primary', action: function() { restartGame(); } }]
});
```

> Do NOT create a separate `#results-screen` div — use TransitionScreen content slot.

---

## 6. CSS

```css
/* === Video Pattern MCQ === */

/* Video wrapper — inside .mathai-preview-instruction (preview component has video { width:100% } built in) */
.video-wrapper {
  width: 100%;
  margin: 10px 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.video-wrapper video {
  width: 100%;
  display: block;
}

/* ── Game play area: options + submit ONLY (inside #gameContent) ── */
.game-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 16px 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* Options grid */
.options-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.option-card {
  width: 100px;
  height: 100px;
  border: 3px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  background: #fff;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.option-card:hover {
  border-color: var(--mathai-primary, #6c5ce7);
  transform: scale(1.03);
}

.option-card.selected {
  border-color: var(--mathai-primary, #6c5ce7);
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.25);
  background: #f0edff;
}

.option-card.correct {
  border-color: var(--mathai-success, #27ae60);
  background: #eafaf1;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.25);
}

.option-card.incorrect {
  border-color: var(--mathai-error, #e74c3c);
  background: #fdf2f2;
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.25);
}

.option-card.disabled {
  pointer-events: none;
  opacity: 0.7;
}

/* Button row */
.button-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
  margin-top: 8px;
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

/* Responsive */
@media (max-width: 360px) {
  .option-card {
    width: 80px;
    height: 80px;
  }
  .options-container {
    gap: 8px;
  }
}
```

---

## 7. Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() {
  if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled && typeof Sentry !== 'undefined') {
    Sentry.init({
      dsn: SentryConfig.dsn,
      environment: SentryConfig.environment,
      release: 'game-video-pattern-mcq@1.0.0',
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
   - waitForPackages() — waits for ScreenLayout, TransitionScreen, FeedbackManager, SignalCollector, PreviewScreenComponent
   - FeedbackManager.init()
   - VisibilityTracker creation
   - PreviewScreenComponent creation
   - setupGame()

2. **setupGame()** runs:
   - Builds game play area HTML into #gameContent (ONLY prompt + options + submit — NO video)
   - Attaches click handler to #btn-submit
   - Calls showPreviewScreen()
   - Does NOT set startTime or isActive (preview handles that)

3. **showPreviewScreen()** runs:
   - Builds instruction HTML with embedded `<video>` tag from content
   - Calls previewScreen.show({ instruction: instructionHtml, showGameOnPreview: true, onComplete: startGameAfterPreview })
   - Video + instruction text render inside `.mathai-preview-instruction` (preview component's scroll area)
   - Game options visible underneath but non-interactable (overlay blocks pointer events)
   - When user skips/completes preview -> startGameAfterPreview()

4. **startGameAfterPreview()** runs:
   - Sets gameState.startTime, isActive, duration_data.startTime
   - trackEvent('game_start', 'game')
   - Calls renderQuestion()
   - Attaches video event listeners (ended, error) to #patternVideo (now in preview DOM)

5. **renderQuestion()** runs:
   - Instruction, video, and prompt already rendered in preview instruction area
   - Generates option cards with images in game-play-area
   - Resets selectedOption to null, videoPlayed to false
   - Sets phase to 'watching'
   - Disables submit button
   - Note: video + instruction are already rendered in preview instruction area

6. **User interaction:**
   - User watches the video (video 'ended' event sets videoPlayed = true)
   - User taps an option card -> selectOption(index)
     - Highlights selected card, removes highlight from others
     - Sets gameState.selectedOption = index
     - Enables submit button
     - Sets phase to 'choosing'
   - User taps Submit -> handleSubmit()
     - Validates: selectedOption === correctIndex (PART-013 fixed)
     - Records attempt via recordAttempt()
     - Shows correct/incorrect visual feedback on option cards
     - If correct: score++
     - Disables all option cards and submit button
     - Sets phase to 'feedback'
     - Plays feedback audio
     - After brief delay (1.5s) -> endGame()

7. **End conditions — EVERY path that calls endGame():**
   - **Answer submitted**: handleSubmit() calls endGame() after feedback delay
   - **There must be NO game state where the player is stuck with no path to endGame()**

---

## 9. Functions

### Global Scope (RULE-001)

**showPreviewScreen()**

- Called from setupGame() after building game play area into #gameContent
- Builds instruction HTML: previewInstruction + video + prompt (all in one block):
  ```javascript
  var instructionHtml =
    '<p>' + gameState.content.previewInstruction + '</p>' +
    '<div class="video-wrapper">' +
      '<video id="patternVideo" controls playsinline webkit-playsinline ' +
             'preload="auto" controlsList="nofullscreen">' +
        '<source src="' + gameState.content.videoUrl + '" type="video/mp4">' +
      '</video>' +
    '</div>' +
    '<p>' + gameState.content.prompt + '</p>';
  ```
- Calls previewScreen.show({ instruction: instructionHtml, audioUrl: null, showGameOnPreview: true, onComplete: startGameAfterPreview })
- Video renders in `.mathai-preview-instruction` (preview component handles scrolling + layout)
- Options are visible below but non-interactable until preview ends

**startGameAfterPreview(previewData)**

- gameState.previewResult = previewData
- gameState.duration_data.preview = gameState.duration_data.preview || []
- gameState.duration_data.preview.push({ duration: previewData.duration })
- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set gameState.duration_data.startTime = new Date().toISOString()
- trackEvent('game_start', 'game')
- signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })
- Attach video event listeners (video is now in preview DOM):
  ```javascript
  var patternVideo = document.getElementById('patternVideo');
  if (patternVideo) {
    patternVideo.addEventListener('ended', onVideoEnded);
    patternVideo.addEventListener('error', function(e) {
      console.error('[Video Error]', JSON.stringify(e.target.error));
    });
  }
  ```
- Call renderQuestion()

**setupGame()**

- Build game play area HTML into #gameContent (from Section 5 — ONLY prompt + options + submit)
- Attach event listener to #btn-submit -> handleSubmit()
- IMPORTANT: Do NOT set gameState.startTime here — it is set in startGameAfterPreview()
- IMPORTANT: Do NOT attach video listeners here — video is injected by previewScreen.show() later
- Call showPreviewScreen()

**renderQuestion()**

- Video, instruction text, and prompt are already rendered in preview instruction area — do NOT touch them here
- Generate option cards:
  ```javascript
  const optionsHtml = gameState.content.options.map((opt, i) =>
    `<div class="option-card" data-index="${i}" onclick="selectOption(${i})">
       <img src="${opt.imageUrl}" alt="${opt.label || 'Option ' + (i + 1)}" />
     </div>`
  ).join('');
  document.getElementById('optionsContainer').innerHTML = optionsHtml;
  ```
- Reset: gameState.selectedOption = null; gameState.videoPlayed = false; gameState.phase = 'watching'
- Disable submit: document.getElementById('btn-submit').disabled = true
- signalCollector.recordViewEvent('question_start', {})

**onVideoEnded()**

- gameState.videoPlayed = true
- trackEvent('video_played', 'video', {})

**selectOption(index)**

- If gameState.phase === 'feedback' return (no selection during feedback)
- gameState.selectedOption = index
- gameState.phase = 'choosing'
- Remove 'selected' class from all .option-card
- Add 'selected' class to .option-card[data-index="${index}"]
- Enable submit button
- trackEvent('option_selected', 'option', { index })

**handleSubmit()**

- If gameState.selectedOption === null return
- If gameState.phase === 'feedback' return
- gameState.phase = 'feedback'
- const content = gameState.content
- const isCorrect = gameState.selectedOption === content.correctIndex
- Record attempt:
  ```javascript
  const attemptStartTime = gameState.duration_data.attempts.length > 0
    ? gameState.duration_data.attempts[gameState.duration_data.attempts.length - 1].endTime
    : gameState.startTime;
  const now = Date.now();
  gameState.duration_data.attempts.push({ startTime: attemptStartTime, endTime: now, duration: now - attemptStartTime });

  recordAttempt({
    round: 1,
    input_of_user: gameState.selectedOption,
    correct_answer: content.correctIndex,
    correct: isCorrect,
  });
  ```
- If correct: gameState.score++
- Visual feedback:
  - Add 'correct' class to option-card[data-index="${content.correctIndex}"]
  - If not correct: add 'incorrect' class to option-card[data-index="${gameState.selectedOption}"]
  - Add 'disabled' class to all option cards
- Disable submit button
- Audio feedback:
  ```javascript
  try {
    if (isCorrect) {
      FeedbackManager.playDynamicFeedback({ type: 'correct' });
    } else {
      FeedbackManager.playDynamicFeedback({ type: 'incorrect' });
    }
  } catch (e) { console.log('Feedback error: ' + JSON.stringify(e.message)); }
  ```
- trackEvent('answer_submitted', 'game', { correct: isCorrect, selected: gameState.selectedOption, correctIndex: content.correctIndex })
- After 1.5s delay, call endGame():
  ```javascript
  setTimeout(function() { endGame(); }, 1500);
  ```

**endGame()**

- Guard: if (gameState.gameEnded) return; gameState.gameEnded = true;
- gameState.isActive = false
- const totalTime = (Date.now() - gameState.startTime) / 1000
- Calculate metrics:
  ```javascript
  const accuracy = gameState.score === 1 ? 100 : 0;
  const stars = gameState.score === 1 ? 3 : 0;  // Binary: correct = 3★, incorrect = 0★
  const metrics = {
    accuracy,
    time: parseFloat(totalTime.toFixed(1)),
    stars,
    star_thresholds: { 3: 100, 2: 100, 1: 100, 0: 0 },  // Single question: all-or-nothing
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: 1,
    tries: [{ round: 1, triesCount: gameState.attempts.length }],
  };
  ```
- trackEvent('game_end', 'game', { score: gameState.score, accuracy, stars })
- signalCollector.seal()
- Show results via TransitionScreen (from Section 5)
- Send postMessage:
  ```javascript
  window.parent.postMessage({
    type: 'game_complete',
    payload: metrics
  }, '*');
  ```
- Cleanup: remove event listeners if needed

**showResults(metrics)**

- From PART-019 — uses transitionScreen.show() with content slot

**restartGame()**

- Reset gameState fields: currentRound=0, score=0, attempts=[], events=[], selectedOption=null, videoPlayed=false, phase='idle', gameEnded=false, isActive=false, startTime=null
- Reset duration_data
- setupGame()

**handlePostMessage(event)**

- From PART-008 — handles game_init with content, sets gameState.content, totalRounds, etc.

**recordAttempt(data)**

- From PART-009 — pushes to gameState.attempts with timestamp fields

**trackEvent(type, target, data)**

- From PART-010 — pushes to gameState.events

### Inside DOMContentLoaded (PART-004)

- waitForPackages() — from PART-003
- FeedbackManager.init()
- VisibilityTracker — from PART-005
- PreviewScreenComponent creation
- ScreenLayout.inject('app', { ... })
- setupGame()
- window.addEventListener('message', handlePostMessage)

### Window-Attached Debug (PART-012)

- debugGame, debugAudio, testAudio, testPause, testResume

---

## 10. Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event      | Target | When Fired                   |
| ---------- | ------ | ---------------------------- |
| game_start | game   | startGameAfterPreview() runs |
| game_end   | game   | endGame() fires              |

### Game-Specific Events

| Event            | Target | When Fired                    | Data                                               |
| ---------------- | ------ | ----------------------------- | -------------------------------------------------- |
| video_played     | video  | Video 'ended' event fires     | {}                                                 |
| option_selected  | option | User taps an option card      | { index }                                          |
| answer_submitted | game   | User taps Submit              | { correct, selected, correctIndex }                |

---

## 11. Scaffold Points

| Point           | Function       | When                     | What Can Be Injected                              |
| --------------- | -------------- | ------------------------ | ------------------------------------------------- |
| after_incorrect | handleSubmit() | User answers incorrectly | Hint text overlay, replay video prompt             |
| before_round    | renderRound()  | New round starts         | Pattern-spotting tip, difficulty preview            |
| after_video     | onVideoEnded() | Video finishes playing   | "Did you notice...?" prompt, replay suggestion     |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point has a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)

---

## 12. Feedback Triggers

| Moment              | Trigger Function | Feedback Type               | Notes                            |
| ------------------- | ---------------- | --------------------------- | -------------------------------- |
| Correct answer      | handleSubmit()   | sound + visual highlight    | Green border on correct option   |
| Incorrect answer    | handleSubmit()   | sound + visual highlight    | Red border on selected, green on correct |
| Game complete (3 stars)  | showResults()    | celebration sound + sticker | Play on results screen show      |
| Game complete (<3 stars) | showResults()    | encouragement sound         | Gentle, not punishing            |

### Feedback IDs (for FeedbackManager.playDynamicFeedback)

```javascript
// Uses FeedbackManager.playDynamicFeedback({ type: '...' })
// Types: 'correct', 'incorrect', 'celebration', 'encouragement'
// No preloaded IDs needed — dynamic feedback handles audio automatically
```

---

## 13. Visual Specifications

- **Layout:** Two-zone vertical layout. **Zone 1 (preview instruction):** instruction text + video (rendered by PreviewScreenComponent in `.mathai-preview-instruction`). **Zone 2 (#gameContent):** prompt + option images + submit.
- **Color palette:** Uses `var(--mathai-*)` CSS variables. Success: #27ae60. Error: #e74c3c. Primary: #6c5ce7. Background: white. Text: #1a1a2e.
- **Typography:** System font stack (-apple-system, BlinkMacSystemFont, etc). Instruction: 16px semi-bold, left-aligned. Prompt: 14px semi-bold, left-aligned. Metric values: 24px bold.
- **Spacing:** Instruction area gap 12px, padding 8px 16px. Play area gap 16px, padding 8px 16px. Options gap 12px.
- **Option cards:** 100x100px with 3px border, 12px border-radius. Selected: purple border + shadow. Correct: green. Incorrect: red.
- **Video:** Full-width, white background, native controls visible, no fullscreen button (`controlsList="nofullscreen"`), border-radius 12px. Matches `VideoPart.tsx` styling from mathai-client.
- **Interactive states:** Hover: scale(1.03) + purple border. Selected: purple border + glow. Disabled: pointer-events none + opacity 0.7.
- **Transitions:** Border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease.
- **Responsive:** Option cards shrink to 80px on screens < 360px.

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Preview screen displays and transitions to game

SETUP: Page loaded
ACTIONS:
wait for .mathai-preview-header to be visible
assert .mathai-preview-instruction contains expected instruction text
assert .mathai-preview-skip-btn is visible
click .mathai-preview-skip-btn
wait for #gameContent to be visible
assert .mathai-preview-header is not visible (preview hidden)
assert gameState.isActive === true
assert gameState.startTime is set (> 0)
EXPECTED: Preview screen shows, skip advances to game, game starts normally

### Scenario: Video has controls and option selection works

SETUP: Page loaded, preview skipped, game active
ACTIONS:
wait for #patternVideo to be visible
assert #patternVideo has attribute 'controls' (video is inside .mathai-preview-instruction)
assert #patternVideo has attribute 'controlsList' equal to 'nofullscreen'
assert .mathai-preview-instruction contains #patternVideo (video in preview, not in gameContent)
assert .game-play-area is visible inside #gameContent (contains prompt + options only)
wait for .option-card to have count >= 3
click .option-card[data-index="0"]
assert .option-card[data-index="0"] has class 'selected'
assert .option-card[data-index="1"] does NOT have class 'selected'
assert #btn-submit is enabled (not disabled)
click .option-card[data-index="1"]
assert .option-card[data-index="1"] has class 'selected'
assert .option-card[data-index="0"] does NOT have class 'selected'
EXPECTED: Selecting an option highlights it, deselects others, enables submit

### Scenario: Correct answer — game completes with 3 stars

SETUP: Page loaded, preview skipped, game active
ACTIONS:
wait for .option-card to be visible
evaluate: correctIndex = window.gameState.content.correctIndex
click .option-card[data-index="${correctIndex}"]
click #btn-submit
wait for .option-card[data-index="${correctIndex}"] to have class 'correct'
wait 1.5s for endGame timeout
ASSERT:
gameState.score === 1
gameState.isActive === false
gameState.gameEnded === true
TransitionScreen is visible with results
title shows "Correct! Well Done!"
stars === 3
game_complete postMessage sent with accuracy: 100, stars: 3

### Scenario: Incorrect answer — game completes with 0 stars

SETUP: Page loaded, preview skipped, game active
ACTIONS:
evaluate: correctIndex = window.gameState.content.correctIndex
set wrongIndex = correctIndex === 0 ? 1 : 0
click .option-card[data-index="${wrongIndex}"]
click #btn-submit
ASSERT:
.option-card[data-index="${wrongIndex}"] has class 'incorrect'
.option-card[data-index="${correctIndex}"] has class 'correct'
all .option-card elements have class 'disabled'
#btn-submit is disabled
gameState.attempts.length === 1
gameState.attempts[0].correct === false
wait 1.5s for endGame timeout
gameState.isActive === false
stars === 0
title shows "Not quite!"

### Scenario: PostMessage game_init loads external content

SETUP: Page loaded
ACTIONS:
Send postMessage { type: 'game_init', payload: { content: { previewInstruction: '...', videoUrl: '...', prompt: '...', options: [...], correctIndex: 1 }, questionLabel: 'Q1', score: 0 } }
wait for preview screen
skip preview
ASSERT:
gameState.content is set to the posted content
gameState.totalRounds === 1
Video renders in preview instruction area, options render in #gameContent

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] Body contains only `<div id="app"></div>` — no manual layout divs
- [ ] No `#results-screen` div (use TransitionScreen content slot — PART-019 v2)
- [ ] No `.page-center` / `.game-wrapper` / `.game-stack` HTML (use ScreenLayout v2)

### Functional

- [ ] waitForPackages() defined and checks all required globals (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] VisibilityTracker created with onInactive + onResume (PART-005)
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] Fallback content for standalone testing (PART-008)
- [ ] recordAttempt produces correct attempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] endGame calculates metrics, logs, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition actually calls endGame()** — all rounds completed (PART-011)
- [ ] Debug functions on window (PART-012)
- [ ] showResults uses TransitionScreen content slot (PART-019 v2)
- [ ] InputSchema defined with fallback content (PART-028)
- [ ] Play area built inside #gameContent via JS (PART-027)
- [ ] No anti-patterns present (PART-026)
- [ ] SignalCollector: deferred endProblem pattern, seal() before postMessage
- [ ] PreviewScreen shows before game starts (PART-039)
- [ ] InteractionManager suppresses taps during feedback (PART-038)

### Design & Layout (v2)

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors (PART-020)
- [ ] Gameplay feedback uses correct colors — green/red/blue/gray (PART-020)
- [ ] ScreenLayout v2 with `config.slots` API: `{ previewScreen: true, transitionScreen: true }`
- [ ] No sections API used (preview screen provides the wrapper layout)
- [ ] `.mathai-layout-playarea` CSS overrides use `!important` (PART-025)
- [ ] CSS reset with `100dvh`, not `100vh` (PART-021 v2)
- [ ] Buttons use `.game-btn` with `.btn-primary` class (PART-022)
- [ ] No ProgressBar (single question — PART-023 excluded)
- [ ] TransitionScreen v2: welcome + results screens (PART-024)
- [ ] **Every transition screen plays audio** — no silent transitions (PART-024)
- [ ] Results shown via `transitionScreen.show({ content: metricsHTML })` (PART-019 v2)

### Rules Compliance

- [ ] RULE-001: All onclick handlers in global scope (selectOption, handleSubmit, nextRound)
- [ ] RULE-002: All async functions have async keyword
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame
- [ ] RULE-006: No new Audio(), setInterval for timer, SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific

- [ ] Video element has `controls playsinline webkit-playsinline controlsList="nofullscreen"` attributes
- [ ] Video wrapper has white background (not black) — matches VideoPart.tsx styling
- [ ] Instruction text + video passed as HTML to previewScreen.show({ instruction }), NOT in #gameContent
- [ ] Video source set correctly (src change + load())
- [ ] Video error handler attached for debugging
- [ ] Option cards render dynamically from content data with correct data-index
- [ ] Only one option can be selected at a time (single-select MCQ)
- [ ] Submit button disabled until an option is selected
- [ ] After submit: all options disabled, correct answer always highlighted green
- [ ] Wrong selection highlighted red only if user picked it
- [ ] Submit button disabled after submit (no Next button — single question)
- [ ] endGame() called after 1.5s feedback delay
- [ ] Instruction and prompt text support innerHTML (bold, emoji)
- [ ] Images in option cards use object-fit: contain
- [ ] Video renders at natural aspect ratio (no forced 9:16)

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
