# Mental Math Audio — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

---

## 1. Game Identity

- **Title:** Mental Math Audio
- **Game ID:** game_mental_math_audio
- **Type:** standard
- **Description:** Listen to numbers read one by one in a voice note, add them mentally as you hear them, then type the total. Audio has a play limit (default 2 plays). Multi-round game with numeric input validation.

---

## 2. Parts Selected

| Part ID  | Name                            | Included        | Config/Notes                                                        |
| -------- | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| PART-001 | HTML Shell                      | YES             | —                                                                   |
| PART-002 | Package Scripts                 | YES             | —                                                                   |
| PART-003 | waitForPackages                 | YES             | —                                                                   |
| PART-004 | Initialization Block            | YES             | —                                                                   |
| PART-005 | VisibilityTracker               | YES             | popupProps: default. Uses sound.pause()/stream.pauseAll()           |
| PART-006 | TimerComponent                  | NO              | No time pressure — listen and think                                 |
| PART-007 | Game State Object               | YES             | Custom fields: userAnswer, audioPlayed, audioPlaysRemaining, phase  |
| PART-008 | PostMessage Protocol            | YES             | Full 6-property signalCollector pattern in handlePostMessage        |
| PART-009 | Attempt Tracking                | YES             | —                                                                   |
| PART-010 | Event Tracking                  | YES             | Custom events: audio_played, answer_submitted                       |
| PART-011 | End Game & Metrics              | YES             | Default star logic: 3★ >= 80%, 2★ >= 50%, 1★ >= 1%                 |
| PART-012 | Debug Functions                 | YES             | —                                                                   |
| PART-013 | Validation Fixed                | YES             | Each round has one correct numeric answer                           |
| PART-014 | Validation Function             | NO              | —                                                                   |
| PART-015 | Validation LLM                  | NO              | —                                                                   |
| PART-016 | StoriesComponent                | NO              | —                                                                   |
| PART-017 | Feedback Integration            | YES             | Audio feedback on correct/incorrect + celebration on results        |
| PART-018 | Case Converter                  | NO              | —                                                                   |
| PART-019 | Results Screen (v2)             | YES             | Via TransitionScreen content slot — metrics: score, accuracy, stars |
| PART-020 | CSS Variables & Colors          | YES             | —                                                                   |
| PART-021 | Screen Layout CSS (v2)          | YES             | v2 CSS only                                                         |
| PART-022 | Game Buttons                    | YES             | Submit + Next buttons                                               |
| PART-023 | ProgressBar Component (v2)      | YES             | totalRounds: 10, totalLives: 0 (no lives)                          |
| PART-024 | TransitionScreen Component (v2) | YES             | welcome + results screens + audio                                   |
| PART-025 | ScreenLayout Component (v2)     | YES             | slots: previewScreen, transitionScreen                              |
| PART-026 | Anti-Patterns                   | YES (REFERENCE) | Verification checklist                                              |
| PART-027 | Play Area Construction          | YES             | #gameContent = input field + submit only. Audio in preview instruction. |
| PART-028 | InputSchema Patterns            | YES             | Schema type: rounds with audioUrl + correctAnswer                   |
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
| PART-041 | Audio Player                    | YES             | Custom play/pause + progress bar. Play limit: 2. Matches RenderAudioBlock.tsx |

---

## 3. Game State

```javascript
// CRITICAL: Use window.gameState (not const) — Playwright tests access via window
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'game_mental_math_audio',
  currentRound: 0,
  totalRounds: 10,
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
  userAnswer: '',                // Current typed answer
  audioPlayed: false,            // Whether audio has been played at least once this round
  audioPlaysRemaining: 2,        // Plays left for current round (resets each round)
  maxPlays: 2,                   // Max plays per round (from content or default)
  phase: 'idle',                 // 'idle' | 'listening' | 'answering' | 'feedback' | 'ended'
  gameEnded: false,              // Double-call guard for endGame
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
    "previewInstruction": { "type": "string", "description": "Instruction shown in preview area, e.g. 'Numbers will be read one by one...'" },
    "previewAudioText": { "type": "string", "description": "Plain text version of previewInstruction for TTS" },
    "maxPlays": { "type": "integer", "description": "Max times user can play audio per round (default 2)" },
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "audioUrl": { "type": "string", "description": "URL of the audio clip with numbers to add" },
          "correctAnswer": { "type": "integer", "description": "The correct sum" },
          "prompt": { "type": "string", "description": "Prompt shown below audio player, e.g. 'Write the total here'" }
        },
        "required": ["audioUrl", "correctAnswer"]
      }
    }
  },
  "required": ["previewInstruction", "rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  previewInstruction: "Numbers will be read one by one in the voice note.<br><br>Add them <b>mentally</b> and as you hear them.<br><br>You can play the voice note only <b>2 times.</b>",
  previewAudioText: "Numbers will be read one by one in the voice note. Add them mentally and as you hear them. You can play the voice note only 2 times.",
  maxPlays: 2,
  rounds: [
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" },
    { audioUrl: "https://ik.imagekit.io/thehomeworkapp/Mental%20maths/Add%20a%20list/Level%203/Q14_u3txtSa9b.mp3?updatedAt=1730791948029", correctAnswer: 42, prompt: "Write the total here 👇" }
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

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { previewScreen: true, transitionScreen: true }
});
// MUST NOT add progressBar: true here — progressBar renders into a local div inside #gameContent
```

PreviewScreen instantiation:
```javascript
const previewScreen = new PreviewScreenComponent({
  autoInject: true,
  slotId: 'mathai-preview-slot',
  gameContentId: 'gameContent'
});
```

Preview show — previewInstruction text + **disabled audio player** (visible but non-interactive):
```javascript
// Build preview instruction: text + disabled audio player
var firstRound = gameState.content.rounds[0];
var previewHtml =
  '<p>' + gameState.content.previewInstruction + '</p>' +
  '<div class="audio-player-wrapper">' +
    '<div class="audio-player disabled" id="audioPlayer">' +
      '<img class="audio-play-btn disabled" id="audioPlayBtn" ' +
           'src="https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg" ' +
           'alt="Play audio" />' +
      '<div class="audio-progress-track" id="audioProgressTrack">' +
        '<div class="audio-progress-fill" id="audioProgressFill"></div>' +
      '</div>' +
      '<audio id="gameAudio" preload="auto">' +
        '<source id="audioSource" src="' + firstRound.audioUrl + '" type="audio/mpeg">' +
      '</audio>' +
    '</div>' +
  '</div>' +
  '<p class="prompt-text">' + (firstRound.prompt || 'Write the total here 👇') + '</p>';

previewScreen.show({
  instruction: previewHtml,
  audioUrl: null,
  showGameOnPreview: false,   // Input + buttons NOT visible during preview
  onComplete: startGameAfterPreview
});
```

> **Preview state:** User sees instruction text + disabled audio player + prompt. Input field and buttons are hidden.
> **Game state (after skip):** Audio player becomes enabled (plays allowed). Input + buttons appear in #gameContent.

### Round instruction update — audio player + prompt in `.mathai-preview-instruction`

**CRITICAL:** The audio player and prompt MUST be injected into `.mathai-preview-instruction` (the preview component's instruction area). Do NOT create a separate instruction zone, game-area wrapper, or custom layout container. The preview wrapper is persistent — it stays visible during gameplay.

Each round, update `.mathai-preview-instruction` with an **enabled** audio player + prompt:
```javascript
function updateInstructionArea() {
  var round = gameState.content.rounds[gameState.currentRound];
  var prompt = round.prompt || 'Write the total here 👇';

  var instructionHtml =
    '<div class="audio-player-wrapper">' +
      '<div class="audio-player" id="audioPlayer">' +
        '<img class="audio-play-btn" id="audioPlayBtn" ' +
             'src="https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg" ' +
             'alt="Play audio" />' +
        '<div class="audio-progress-track" id="audioProgressTrack">' +
          '<div class="audio-progress-fill" id="audioProgressFill"></div>' +
        '</div>' +
        '<audio id="gameAudio" preload="auto">' +
          '<source id="audioSource" src="' + round.audioUrl + '" type="audio/mpeg">' +
        '</audio>' +
      '</div>' +
    '</div>' +
    '<p class="prompt-text">' + prompt + '</p>';

  var instrEl = document.querySelector('.mathai-preview-instruction');
  if (instrEl) instrEl.innerHTML = instructionHtml;

  // Attach audio event listeners after DOM update
  setupAudioListeners();
}
```

### Screen 1: Game Content (#gameContent — ONLY interactive elements)

```html
<div id="app"></div>
```

**CRITICAL:** #gameContent contains ONLY the input field + buttons. NOT visible during preview (`showGameOnPreview: false`). Appears only after preview ends. NO audio player, NO instruction text, NO prompt, NO custom layout wrappers inside #gameContent.

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

> Do NOT create a separate `#results-screen` div — use TransitionScreen content slot.

---

## 6. CSS

```css
/* === Mental Math Audio === */

/* Audio player — matches RenderAudioBlock.tsx from mathai-client (PART-041) */
.audio-player-wrapper {
  width: 100%;
  min-width: 200px;
  display: flex;
  justify-content: center;
}

.audio-player {
  width: 100%;
  max-width: 320px;
  height: 56px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.audio-play-btn {
  height: 40px;
  width: 40px;
  cursor: pointer;
  flex-shrink: 0;
}

.audio-play-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.audio-player.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.audio-progress-track {
  width: 100%;
  height: 4px;
  background: #FFF8DC; /* corn-silk */
  border-radius: 2px;
  overflow: hidden;
}

.audio-progress-fill {
  width: 0%;
  height: 4px;
  background: #FFDF00; /* gargoyle-gas yellow */
  border-radius: 2px;
  transition: width 0.1s linear;
}

/* Prompt text — inside preview instruction, below audio */
.prompt-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--mathai-text-primary, #1a1a2e);
  text-align: left;
  line-height: 1.5;
  margin-top: 8px;
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
  -moz-appearance: textfield; /* hide spin buttons */
}

.answer-input::-webkit-outer-spin-button,
.answer-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.answer-input:focus {
  border-color: var(--mathai-primary, #6c5ce7);
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
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
  opacity: 0.7;
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

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() {
  if (typeof SentryConfig !== 'undefined' && SentryConfig.enabled && typeof Sentry !== 'undefined') {
    Sentry.init({
      dsn: SentryConfig.dsn,
      environment: SentryConfig.environment,
      release: 'game-mental-math-audio@1.0.0',
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
   - Builds game play area HTML into #gameContent (ONLY input + buttons — NO audio)
   - Attaches click handler to #btn-submit -> handleSubmit()
   - Attaches click handler to #btn-next -> nextRound()
   - Attaches input handler to #answerInput -> enables submit when non-empty
   - Calls showPreviewScreen()
   - Does NOT set startTime or isActive

3. **showPreviewScreen()** runs:
   - Builds instruction HTML: previewInstruction text + **disabled** audio player + prompt
   - showGameOnPreview: false (input + buttons hidden during preview)
   - Audio player is visible but grayed out (`.disabled` class) — user can see it but can't interact
   - When user skips/completes preview -> startGameAfterPreview()

4. **startGameAfterPreview()** runs:
   - Sets gameState.startTime, isActive, duration_data.startTime
   - trackEvent('game_start', 'game')
   - Calls renderRound() (which enables audio player + shows input)

5. **renderRound()** runs:
   - Gets round data from gameState.content.rounds[currentRound]
   - Updates preview instruction area with **enabled** audio player + prompt via updateInstructionArea()
   - Attaches audio event listeners via setupAudioListeners()
   - Resets: audioPlaysRemaining = maxPlays, audioPlayed = false, userAnswer = ''
   - Clears input field, enables it
   - Hides Next, shows Submit (disabled)
   - Updates progress bar

6. **User interaction:**
   - User taps play icon -> toggleAudioPlayback()
     - If audioPlaysRemaining <= 0: ignore (button visually disabled)
     - Decrements audioPlaysRemaining on play
     - Progress bar animates during playback
     - On ended: audioPlayed = true, icon resets, disable play if no plays left
   - User types in input -> enables Submit button
   - User taps Submit -> handleSubmit()
     - Validates: parseInt(userAnswer) === correctAnswer (PART-013 fixed)
     - Records attempt
     - Shows correct/incorrect visual feedback on input
     - If correct: score++
     - Disables input + Submit, shows Next
     - Plays feedback audio
   - User taps Next -> nextRound()

7. **End conditions — EVERY path that calls endGame():**
   - **All rounds completed**: nextRound() detects currentRound >= totalRounds -> endGame()

---

## 9. Functions

### Global Scope (RULE-001)

**showPreviewScreen()**

- Called from setupGame()
- Builds preview HTML: previewInstruction text + disabled audio player (with `.disabled` class) + prompt
- Audio player visible but grayed out — user can see the player shape but cannot tap play
- Calls previewScreen.show({ instruction: previewHtml, audioUrl: null, showGameOnPreview: false, onComplete: startGameAfterPreview })
- showGameOnPreview: false — input + buttons NOT visible during preview

**startGameAfterPreview(previewData)**

- gameState.previewResult = previewData
- gameState.duration_data.preview = gameState.duration_data.preview || []
- gameState.duration_data.preview.push({ duration: previewData.duration })
- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set gameState.duration_data.startTime = new Date().toISOString()
- gameState.maxPlays = gameState.content.maxPlays || 2
- trackEvent('game_start', 'game')
- signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })
- Call renderRound()

**setupGame()**

- Build game play area HTML into #gameContent (from Section 5 — input + buttons only)
- Attach event listener to #btn-submit -> handleSubmit()
- Attach event listener to #btn-next -> nextRound()
- Attach input event to #answerInput:
  ```javascript
  document.getElementById('answerInput').addEventListener('input', function(e) {
    gameState.userAnswer = e.target.value;
    document.getElementById('btn-submit').disabled = !e.target.value.trim();
  });
  ```
- IMPORTANT: Do NOT set gameState.startTime here
- Call showPreviewScreen()

**updateInstructionArea()**

- Builds audio player + prompt HTML (from Section 5)
- Injects into .mathai-preview-instruction
- Calls setupAudioListeners() after DOM update

**setupAudioListeners()**

- Get references: #gameAudio, #audioPlayBtn, #audioProgressFill
- Attach play/pause/timeupdate/loadeddata/ended/error listeners (from PART-041)
- Play button click -> toggleAudioPlayback()

**toggleAudioPlayback()**

- If audioPlaysRemaining <= 0: return
- If playing: pause; else: play
- On play: decrement audioPlaysRemaining, update play icon to pause
- On pause: update pause icon to play
- If audioPlaysRemaining <= 0 after play: add 'disabled' class to play button

**renderRound()**

- Get round = gameState.content.rounds[gameState.currentRound]
- Reset: gameState.audioPlaysRemaining = gameState.maxPlays; gameState.audioPlayed = false; gameState.userAnswer = ''
- Clear input: answerInput.value = ''; answerInput.disabled = false; remove correct/incorrect classes
- Buttons: show submit (disabled), hide next
- Update progress bar: progressBar.update(gameState.currentRound)
- Call updateInstructionArea()
- signalCollector.recordViewEvent('round_start', { round: gameState.currentRound + 1 })

**handleSubmit()**

- If gameState.userAnswer.trim() === '' return
- const round = gameState.content.rounds[gameState.currentRound]
- const userNum = parseInt(gameState.userAnswer.trim(), 10)
- const isCorrect = userNum === round.correctAnswer
- Record attempt:
  ```javascript
  recordAttempt({
    round: gameState.currentRound + 1,
    input_of_user: userNum,
    correct_answer: round.correctAnswer,
    correct: isCorrect,
  });
  ```
- If correct: gameState.score++
- Visual feedback: add 'correct' or 'incorrect' class to #answerInput
- Disable input + submit
- Show next button
- Audio feedback via FeedbackManager.playDynamicFeedback()
- trackEvent('answer_submitted', 'game', { round: gameState.currentRound + 1, correct: isCorrect, userAnswer: userNum, correctAnswer: round.correctAnswer })

**nextRound()**

- gameState.currentRound++
- If gameState.currentRound >= gameState.totalRounds -> endGame()
- Else -> renderRound()

**endGame()**

- Guard: if (gameState.gameEnded) return; gameState.gameEnded = true;
- gameState.isActive = false
- Pause audio if playing
- const totalTime = (Date.now() - gameState.startTime) / 1000
- Calculate metrics:
  ```javascript
  const accuracy = gameState.totalRounds > 0
    ? Math.round((gameState.score / gameState.totalRounds) * 100) : 0;
  const stars = accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy >= 1 ? 1 : 0;
  const metrics = {
    accuracy,
    time: parseFloat(totalTime.toFixed(1)),
    stars,
    star_thresholds: { 3: 80, 2: 50, 1: 1, 0: 0 },
    attempts: gameState.attempts,
    duration_data: gameState.duration_data,
    totalLives: 1,
    tries: computeTriesPerRound(),
  };
  ```
- trackEvent('game_end', 'game', { score: gameState.score, accuracy, stars })
- signalCollector.seal()
- Show results via TransitionScreen
- Send postMessage: window.parent.postMessage({ type: 'game_complete', payload: metrics }, '*')
- Cleanup: pause audio, remove listeners

**computeTriesPerRound()**

- Deduplicate attempts by round:
  ```javascript
  const roundMap = {};
  gameState.attempts.forEach(a => { roundMap[a.round] = (roundMap[a.round] || 0) + 1; });
  return Object.entries(roundMap).map(([r, c]) => ({ round: parseInt(r), triesCount: c }));
  ```

**restartGame()**

- Reset all gameState fields
- Reset duration_data
- Do NOT call showPreviewScreen again (preview is one-time)
- Call renderRound() directly

**handlePostMessage(event)** — From PART-008

**recordAttempt(data)** — From PART-009

**trackEvent(type, target, data)** — From PART-010

### Inside DOMContentLoaded (PART-004)

- waitForPackages()
- FeedbackManager.init()
- VisibilityTracker — from PART-005
- PreviewScreenComponent creation
- ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true } })
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
| audio_played     | audio  | Audio 'ended' event fires     | { round, playsRemaining }                          |
| answer_submitted | game   | User taps Submit              | { round, correct, userAnswer, correctAnswer }      |

---

## 11. Scaffold Points

| Point           | Function       | When                     | What Can Be Injected                              |
| --------------- | -------------- | ------------------------ | ------------------------------------------------- |
| after_incorrect | handleSubmit() | User answers incorrectly | Hint showing partial sum, replay prompt            |
| before_round    | renderRound()  | New round starts         | Difficulty tip, mental math strategy               |
| after_audio     | onAudioEnded() | Audio finishes playing   | "Think carefully..." prompt                        |

---

## 12. Feedback Triggers

| Moment              | Trigger Function | Feedback Type               | Notes                            |
| ------------------- | ---------------- | --------------------------- | -------------------------------- |
| Correct answer      | handleSubmit()   | sound + visual (green input)| Play after green border shown    |
| Incorrect answer    | handleSubmit()   | sound + visual (red input)  | Short negative sound             |
| Game complete (3 stars) | showResults() | celebration sound + sticker | Play on results screen show      |
| Game complete (<3 stars)| showResults() | encouragement sound         | Gentle, not punishing            |

---

## 13. Visual Specifications

- **Layout:** Two-zone layout. **Zone 1 (preview instruction):** instruction text (first time only), then audio player + prompt per round (in `.mathai-preview-instruction`). **Zone 2 (#gameContent):** number input + submit/next.
- **Color palette:** Uses `var(--mathai-*)` CSS variables. Success: #27ae60. Error: #e74c3c. Primary: #6c5ce7. Audio: #FFDF00 yellow on #FFF8DC cream.
- **Typography:** System font stack. Instruction: 15px. Input: 20px bold, centered. Metric values: 24px bold.
- **Audio player:** White 56px card, box-shadow, border-radius 8px. Yellow play/pause icon 40x40. 4px progress bar. Max-width 320px, centered.
- **Input field:** 160px wide, 52px tall, centered, 20px bold font, 2px border, 8px border-radius. No spin buttons.
- **Responsive:** Audio player and input both centered, work on 320px+ screens.

---

## 14. Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.

### Scenario: Preview screen shows disabled audio player, hides input

SETUP: Page loaded
ACTIONS:
wait for .mathai-preview-header to be visible
assert .mathai-preview-instruction contains instruction text about voice note
assert .audio-player.disabled is visible (grayed out, non-interactive)
assert #gameContent is NOT visible (showGameOnPreview: false)
click .mathai-preview-skip-btn
wait for #gameContent to be visible
assert .audio-player does NOT have class 'disabled' (now enabled)
assert #answerInput is visible
assert gameState.isActive === true
EXPECTED: Preview shows text + disabled audio player. After skip, audio enabled + input appears

### Scenario: Audio player works with play limit

SETUP: Page loaded, preview skipped, game active
ACTIONS:
wait for #audioPlayBtn to be visible
assert gameState.audioPlaysRemaining === 2
click #audioPlayBtn (first play)
assert gameState.audioPlaysRemaining === 1
wait for audio ended OR click pause
click #audioPlayBtn (second play)
assert gameState.audioPlaysRemaining === 0
assert #audioPlayBtn has class 'disabled'
EXPECTED: Audio plays twice, then play button disabled

### Scenario: Submit correct answer and advance

SETUP: Page loaded, preview skipped, round 1 active
ACTIONS:
evaluate: correctAnswer = window.gameState.content.rounds[0].correctAnswer
fill #answerInput with correctAnswer
assert #btn-submit is enabled
click #btn-submit
assert #answerInput has class 'correct'
assert #btn-next is visible
assert #btn-submit is hidden or disabled
click #btn-next
assert gameState.currentRound === 1
EXPECTED: Correct answer shows green, Next advances to round 2

### Scenario: Submit incorrect answer

SETUP: Page loaded, preview skipped, round 1 active
ACTIONS:
fill #answerInput with "999"
click #btn-submit
ASSERT:
#answerInput has class 'incorrect'
#btn-next is visible
gameState.attempts.length === 1
gameState.attempts[0].correct === false
gameState.score === 0

### Scenario: Complete all 10 rounds

SETUP: Page loaded, preview skipped
ACTIONS:
For each round (0 to 9):
  evaluate correctAnswer from gameState.content.rounds[currentRound]
  fill #answerInput with correctAnswer
  click #btn-submit
  click #btn-next
ASSERT:
gameState.score === 10
gameState.isActive === false
gameState.gameEnded === true
TransitionScreen visible with results
accuracy === 100, stars === 3

### Scenario: Progress bar updates each round

SETUP: Page loaded, preview skipped
ACTIONS:
assert progress bar shows round 0 of 10
complete round 1 (enter correct, submit, next)
assert progress bar shows round 1 of 10
complete round 2
assert progress bar shows round 2 of 10
EXPECTED: Progress bar increments after each round

### Scenario: Input enables submit only when non-empty

SETUP: Page loaded, preview skipped, round active
ACTIONS:
assert #btn-submit is disabled
fill #answerInput with "5"
assert #btn-submit is enabled
clear #answerInput
assert #btn-submit is disabled
EXPECTED: Submit button disabled when input is empty

---

## 15. Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002)
- [ ] Single `<style>` in `<head>`, single `<script>` in `<body>` (RULE-007)
- [ ] Body contains only `<div id="app"></div>` — no manual layout divs
- [ ] No `#results-screen` div (use TransitionScreen content slot — PART-019 v2)
- [ ] **No custom layout divs** — no `.mathai-instruction-zone`, `.mathai-game-area`, `.instruction-zone`, or any manually created layout wrappers. ScreenLayout + PreviewScreenComponent provide the page structure.
- [ ] ScreenLayout.inject() uses `slots: { previewScreen: true, transitionScreen: true }` — NOT the `sections` API

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

- [ ] CSS uses `var(--mathai-*)` variables (PART-020)
- [ ] ScreenLayout v2 with `config.slots` API: `{ previewScreen: true, transitionScreen: true }`
- [ ] Buttons use `.game-btn` with `.btn-primary` class (PART-022)
- [ ] ProgressBar v2: update(currentRound) each round (PART-023)
- [ ] TransitionScreen v2: results screen with audio (PART-024)
- [ ] Results shown via `transitionScreen.show({ content: metricsHTML })` (PART-019 v2)

### Audio Player (PART-041)

- [ ] Audio player rendered inside `.mathai-preview-instruction` via `updateInstructionArea()` — NOT inside `#gameContent`
- [ ] `<audio>` element in DOM — NO `new Audio()`
- [ ] `<audio>` has NO `controls` attribute (custom UI)
- [ ] `<audio>` has NO `autoplay` attribute
- [ ] `<audio>` has `preload="auto"`
- [ ] Play/pause icon uses CDN SVGs (play-icon-yellow.svg / pause-icon-yellow.svg)
- [ ] Play icon is 40x40px (meets touch target)
- [ ] Progress bar updates via timeupdate listener
- [ ] ended listener resets icon and tracks audioPlayed
- [ ] error listener attached for debugging
- [ ] Play limit enforced: button disabled after maxPlays reached
- [ ] Audio plays remaining resets each round
- [ ] Audio player in preview instruction area, NOT in #gameContent
- [ ] `.audio-player` has white background + box-shadow + border-radius: 8px
- [ ] Audio paused in endGame cleanup

### Game-Specific

- [ ] Input field type="number" with inputmode="numeric"
- [ ] Spin buttons hidden (webkit appearance none)
- [ ] Submit disabled until input non-empty
- [ ] Correct answer: green border on input
- [ ] Incorrect answer: red border on input
- [ ] Next button appears after submit, input disabled during feedback
- [ ] Audio player + prompt update each round in preview instruction area
- [ ] 10 rounds with progress bar tracking

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
