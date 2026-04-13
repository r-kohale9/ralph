# Template Schema — Assembly Book Format

> When generating a game-specific template (assembly book), output a file that follows this exact structure. Every section is REQUIRED unless marked optional. The template must be self-contained — an LLM reading ONLY this template should be able to produce a working HTML file.

---

## Required Sections

### 1. Game Identity

```markdown
## Game Identity

- **Title:** {{game title}}
- **Game ID:** game*{{timestamp}}*{{random9chars}}
- **Type:** {{standard | story-only}}
- **Description:** {{1-2 sentence description}}
```

### 2. Parts Selected

A table showing which warehouse parts are included. This tells the LLM exactly what to assemble.

```markdown
## Parts Selected

| Part ID  | Name                            | Included        | Config/Notes                                                        |
| -------- | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| PART-001 | HTML Shell                      | YES             | —                                                                   |
| PART-002 | Package Scripts                 | YES             | —                                                                   |
| PART-003 | waitForPackages                 | YES             | —                                                                   |
| PART-004 | Initialization Block            | YES             | —                                                                   |
| PART-005 | VisibilityTracker               | YES             | popupProps: {{custom or default}}                                   |
| PART-006 | TimerComponent                  | {{YES/NO}}      | {{timerType, startTime, endTime, autoStart}}                        |
| PART-007 | Game State Object               | YES             | Custom fields: {{list}}                                             |
| PART-008 | PostMessage Protocol            | YES             | —                                                                   |
| PART-009 | Attempt Tracking                | YES             | —                                                                   |
| PART-010 | Event Tracking                  | YES             | Custom events: {{list}}                                             |
| PART-011 | End Game & Metrics              | YES             | {{custom star logic if any}}                                        |
| PART-012 | Debug Functions                 | YES             | —                                                                   |
| PART-013 | Validation Fixed                | {{YES/NO}}      | —                                                                   |
| PART-014 | Validation Function             | {{YES/NO}}      | Rules: {{describe}}                                                 |
| PART-015 | Validation LLM                  | {{YES/NO}}      | —                                                                   |
| PART-016 | StoriesComponent                | {{YES/NO}}      | —                                                                   |
| PART-017 | Feedback Integration            | {{YES/NO}}      | Audio feedback and sticker moments                                  |
| PART-018 | Case Converter                  | {{YES/NO}}      | —                                                                   |
| PART-019 | Results Screen (v2)             | YES             | Via TransitionScreen content slot — custom metrics: {{list}}        |
| PART-020 | CSS Variables & Colors          | YES             | —                                                                   |
| PART-021 | Screen Layout CSS (v2)          | YES             | ⛔ Manual HTML deprecated — v2 CSS only                             |
| PART-022 | Game Buttons                    | YES             | —                                                                   |
| PART-023 | ProgressBar Component (v2)      | YES             | totalRounds: {{N}}, totalLives: {{N}}                               |
| PART-024 | TransitionScreen Component (v2) | YES             | Screens: welcome/level/victory/game-over + AUDIO                    |
| PART-025 | ScreenLayout Component (v2)     | YES             | sections: header/questionText/progressBar/playArea/transitionScreen |
| PART-026 | Anti-Patterns                   | YES (REFERENCE) | Verification checklist, not code-generating                         |
| PART-027 | Play Area Construction          | YES             | Layout: {{grid/options/input/custom}}                               |
| PART-028 | InputSchema Patterns            | YES             | Schema type: {{questions/grid/levels}}                              |
| PART-029 | Story-Only Game                 | {{YES/NO}}      | storyBlockId: {{ID}}                                                |
| PART-030 | Sentry Error Tracking           | YES             | Error monitoring for every game                                     |
| PART-031 | API Helper                      | {{YES/NO}}      | —                                                                   |
| PART-032 | AnalyticsManager                | {{YES/NO}}      | —                                                                   |
| PART-033 | Interaction Patterns            | {{YES/NO}}      | Patterns: {{drag-drop/grid/tag-input}}                              |
| PART-034 | Variable Schema Serialization   | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                            |
| PART-035 | Test Plan Generation            | YES (POST_GEN)  | Generates tests.md after HTML                                       |
| PART-037 | Playwright Testing              | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                              |
| PART-039 | Preview Screen                  | YES (MANDATORY) | Always included — shows before game starts                          |
| PART-040 | Video Player                    | {{YES/NO}}      | Video content: white bg, native controls, no fullscreen             |
| PART-041 | Audio Player                    | {{YES/NO}}      | Content audio: custom play/pause UI + progress bar, no native controls |
```

### 3. Game State

The exact `gameState` object for this game, with mandatory fields + game-specific additions.

````markdown
## Game State

```javascript
const gameState = {
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: {{N}},
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
  {{field}}: {{initialValue}},  // {{description}}
  {{field}}: {{initialValue}},  // {{description}}
};

let timer = null;
let visibilityTracker = null;
```
````

````

### 4. Input Schema (External Variables)

The shape of content this game expects via postMessage. This is the interface between the game template and the content delivery system.

```markdown
## Input Schema

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "{{field}}": { "type": "{{type}}" },
          "{{field}}": { "type": "{{type}}" }
        },
        "required": [{{list}}]
      }
    }
  },
  "required": ["rounds"]
}
````

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    { {{field}}: {{value}}, {{field}}: {{value}} },
    { {{field}}: {{value}}, {{field}}: {{value}} },
    // At least 3 rounds of test data
  ]
};
```

````

### 5. Screens & HTML Structure (v2)

ScreenLayout v2 injects the page structure automatically. Only `<div id="app"></div>` goes in the body. Game content, timer, and results are injected via JS.

```markdown
## Screens

### Screen 0: Preview Screen — PART-039 (MANDATORY)

The PreviewScreenComponent (loaded via CDN package) handles all preview UI.
No custom HTML needed — the component creates its own DOM in the ScreenLayout preview slot.

ScreenLayout configuration:
```javascript
ScreenLayout.inject('app', {
  slots: { progressBar: true, previewScreen: true, transitionScreen: true }
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

### Screen 1: Game Screen (#game-screen)

```html
<div id="app"></div>
```

### ScreenLayout v2 Init (injected via JS)

```javascript
ScreenLayout.inject('app', {
  sections: {
    header: {{true/false}},     // true only if timer/HUD
    questionText: true,          // ALWAYS
    progressBar: true,           // ALWAYS
    playArea: true,              // ALWAYS
    transitionScreen: true       // ALWAYS
  },
  styles: { /* per-section styles */ }
});
```

### Play Area Content (injected into #gameContent via JS)

```javascript
document.getElementById('gameContent').innerHTML =
  '{{Exact HTML with all element IDs, classes, and structure}}';
```

### Results Screen (via TransitionScreen content slot — PART-019 v2)

```javascript
transitionScreen.show({
  stars: metrics.stars,
  title: '{{title}}',
  content: '{{metrics HTML from PART-019}}',
  persist: true,
  buttons: [{ text: 'Play Again', type: 'primary', action: function() { restartGame(); } }]
});
```

> ⛔ Do NOT create a separate `#results-screen` div — use TransitionScreen content slot.

````

### 6. CSS

Complete styles for the game. Must include styles for all screens, states, and interactions.

````markdown
## CSS

```css
{{Complete CSS for:
  - Base layout
  - Game screen elements
  - Results screen
  - Interactive states (hover, active, selected, disabled)
  - Timer styling (if PART-006)
  - Responsive considerations
  - Animations/transitions
}}
```
````

````

### 7. Script Loading

Exact `<script>` tags to copy verbatim. This section makes the template self-contained — do not reference PART-002 without including the actual URLs here.

```markdown
## Script Loading (copy these EXACT tags — never invent URLs)

```html
<!-- STEP 1: SentryConfig package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

<!-- STEP 2: initSentry() function definition (see PART-030 for full code) -->
<script>
function initSentry() { /* ... */ }
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
````

````

### 8. Game Flow

Step-by-step description of how the game works, from load to completion.

```markdown
## Game Flow

1. **Page loads** → DOMContentLoaded fires
   - waitForPackages()
   - FeedbackManager.init()
   - {{TimerComponent creation if PART-006}}
   - VisibilityTracker creation
   - setupGame()

2. **setupGame()** runs:
   - {{Step 1: what happens}}
   - {{Step 2: what happens}}
   - Sets gameState.startTime and isActive
   - Fires 'game_start' event

3. **User interaction loop:**
   - {{What the user does (click, drag, type)}}
   - {{How answer is captured}}
   - {{How validation works — which PART-013/014/015}}
   - {{What happens on correct answer}}
   - {{What happens on incorrect answer}}
   - {{How to advance to next round}}

4. **End condition(s) — EVERY path that calls endGame():**
   - {{Trigger 1: e.g., "All rounds completed → nextRound() calls endGame() when currentRound >= totalRounds"}}
   - {{Trigger 2: e.g., "Timer expires → timer.onEnd callback calls endGame()"}}
   - {{Trigger 3: e.g., "All lives lost → life-decrement logic calls endGame() when lives <= 0"}}
   - endGame() calculates metrics, shows results, sends postMessage, cleans up
   - **There must be NO game state where the player is stuck with no path to endGame()**
````

### 9. Functions

Every function the game needs, with exact signatures and step-by-step logic.

```markdown
## Functions

### Global Scope (RULE-001)

**showPreviewScreen()**

- Called from game_init handler after setting gameState.content
- Calls previewScreen.show({ instruction, audioUrl, previewContent, onComplete: startGameAfterPreview })
- Note: questionLabel, score, showStar are read automatically from game_init payload
- Preview data comes from game_init payload → content set → fallbackContent

**startGameAfterPreview(previewData)**

- gameState.previewResult = previewData
- gameState.duration_data.preview = gameState.duration_data.preview || []
- gameState.duration_data.preview.push({ duration: previewData.duration })
- Set gameState.startTime = Date.now()
- Set gameState.isActive = true
- Set gameState.duration_data.startTime = new Date().toISOString()
- If timer exists: timer.start()
- trackEvent('game_start', 'game')
- signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })
- Call renderRound() or setupRound()

**setupGame()**

- {{Step 1}}
- {{Step 2}}
- IMPORTANT: Do NOT set gameState.startTime here — it is set in startGameAfterPreview()
- Call showPreviewScreen() instead of directly starting the game

**handleAnswer({{params}})**

- {{Get user answer}}
- {{Validate using PART-013/014/015}}
- recordAttempt({...})
- {{Update UI for correct/incorrect}}
- {{Call nextRound() or show retry}}

**nextRound()**

- Increment gameState.currentRound
- If currentRound >= totalRounds → endGame()
- Else → render next round

**endGame()**

- From PART-011 (copy exact code)
- {{Any custom star calculation}}
- {{Any custom metrics}}

**showResults(metrics)**

- From PART-019

**handlePostMessage(event)**

- From PART-008

**recordAttempt(data)**

- From PART-009

**trackEvent(type, target, data)**

- From PART-010

{{Additional game-specific functions as needed}}

### Inside DOMContentLoaded (PART-004)

- waitForPackages() — from PART-003
- FeedbackManager.init()
- {{TimerComponent if PART-006}}
- VisibilityTracker — from PART-005
- setupGame()

### Window-Attached Debug (PART-012)

- debugGame, debugAudio, testAudio, testPause, testResume
```

### 10. Event Schema

Which events this game emits and when. Maps to PART-010 (trackEvent).

```markdown
## Event Schema

### Game Lifecycle Events (automatic — from PART-010)

| Event      | Target | When Fired            |
| ---------- | ------ | --------------------- |
| game_start | game   | setupGame() completes |
| game_end   | game   | endGame() fires       |

### Game-Specific Events

| Event          | Target     | When Fired            | Data                  |
| -------------- | ---------- | --------------------- | --------------------- |
| {{event_name}} | {{target}} | {{trigger condition}} | {{data object shape}} |
| {{event_name}} | {{target}} | {{trigger condition}} | {{data object shape}} |
```

### 11. Scaffold Points

Where learning scaffolds can be injected. These are hooks in the game flow where hints, explanations, or progressive difficulty adjustments can be triggered.

```markdown
## Scaffold Points

| Point            | Function       | When                     | What Can Be Injected                        |
| ---------------- | -------------- | ------------------------ | ------------------------------------------- |
| after_incorrect  | handleAnswer() | User answers incorrectly | Hint text, visual highlight, worked example |
| before_round     | nextRound()    | New round starts         | Difficulty preview, strategy tip            |
| on_timeout       | timer.onEnd    | Timer expires            | Partial credit prompt, time extension offer |
| {{custom_point}} | {{function}}   | {{condition}}            | {{scaffold_type}}                           |

### Scaffold Integration Notes

- Scaffolds are optional — game works without them
- Each scaffold point must have a no-op default (game continues normally if no scaffold is provided)
- Scaffold content is provided via postMessage (same channel as game content)
```

### 12. Feedback Triggers

Which moments in the game trigger audio/visual feedback. Maps to PART-017 (FeedbackManager).

````markdown
## Feedback Triggers

> FeedbackManager (PART-017) is CONDITIONAL — include when the game has audio feedback or sticker moments.

| Moment              | Trigger Function | Feedback Type               | Notes                            |
| ------------------- | ---------------- | --------------------------- | -------------------------------- |
| Correct answer      | handleAnswer()   | sound + sticker             | Play after visual feedback shown |
| Incorrect answer    | handleAnswer()   | sound only                  | Short negative sound             |
| Game complete (3★)  | showResults()    | celebration sound + sticker | Play on results screen show      |
| Game complete (<3★) | showResults()    | encouragement sound         | Gentle, not punishing            |
| Round transition    | nextRound()      | subtle transition sound     | Optional                         |
| {{custom_moment}}   | {{function}}     | {{feedback_type}}           | {{notes}}                        |

### Feedback IDs (for FeedbackManager.sound.play)

```javascript
// These IDs will be registered in FeedbackManager.init()
// Audio URLs registered in FeedbackManager.init()
const FEEDBACK_IDS = {
  correct: '{{audio_id}}',
  incorrect: '{{audio_id}}',
  celebration: '{{audio_id}}',
  encouragement: '{{audio_id}}',
};
```
````

````

### 13. Visual Specifications

```markdown
## Visual Specifications

- **Layout:** {{grid/flex/absolute, dimensions, max-width}}
- **Color palette:** {{primary, secondary, success, error, background, text}}
- **Typography:** {{font family, title size, body size, label size}}
- **Spacing:** {{container padding, element gaps, margins}}
- **Interactive states:** {{hover, active, selected, disabled styles}}
- **Transitions:** {{what animates, duration, easing}}
- **Responsive:** {{mobile breakpoints, scaling behavior}}
````

### 14. Test Scenarios (for Playwright)

Structured test scenarios that the ralph loop (PART-037) uses to generate Playwright tests. Each scenario must have EXACT user actions — not vague descriptions. These scenarios are authored in Stage 1 because the template author knows the game mechanics best.

```markdown
## Test Scenarios

> These scenarios are consumed by the ralph loop to generate `tests/game.spec.js`.
> Every scenario must specify exact selectors, exact actions, and exact assertions.

### Scenario: Preview screen displays and transitions to game

SETUP: Page loaded
ACTIONS:
wait for .mathai-preview-header to be visible
assert #previewQuestionLabel text matches expected question label
assert #previewScore text matches expected score
assert .mathai-preview-instruction contains expected instruction text
assert .mathai-preview-skip-btn is visible
click .mathai-preview-skip-btn
wait for #gameContent to be visible
assert .mathai-preview-header is not visible (preview hidden)
assert gameState.isActive === true
assert gameState.startTime is set (> 0)
EXPECTED: Preview screen shows, skip advances to game, game starts normally

### Scenario: Complete game with all correct answers
```

SETUP: Page loaded, game ready (gameState.isActive === true)
ACTIONS:
{{exact action 1 — e.g., "click .grid-cell[data-row='0'][data-col='2']"}}
{{exact action 2 — e.g., "click #btn-submit"}}
wait for .correct class on submitted element
click #btn-next
{{repeat for each round with EXACT correct answers from fallbackContent}}
ASSERT:
gameState.score == {{totalRounds}}
#results-screen is visible
#game-screen is hidden
accuracy display shows "100%"
stars display shows 3 stars

```

### Scenario: Submit incorrect answer
```

SETUP: Page loaded, game ready
ACTIONS:
{{exact WRONG action — e.g., "click .grid-cell[data-row='0'][data-col='0']"}}
click #btn-submit
ASSERT:
.incorrect class visible on wrong element
#btn-retry is visible
#btn-submit is hidden
#btn-next is hidden
gameState.attempts.length == 1
gameState.attempts[0].correct == false

```

### Scenario: Reset clears all input
```

SETUP: Page loaded, user has made some selections
ACTIONS:
{{make some selections/input}}
click Reset button
ASSERT:
all .selected classes removed
all input fields empty
no .correct or .incorrect classes

```

### Scenario: Game ends after all rounds
```

SETUP: Complete all rounds correctly (use actions from Scenario 1)
ASSERT:
gameState.isActive == false
game_complete postMessage sent
metrics.accuracy == 100
metrics.stars == 3
metrics.attempts.length == {{totalRounds}}
each attempt has: attempt_timestamp, time_since_start, input_of_user, correct, attempt_number

```

### Scenario: {{Game-specific scenario 1}}
```

SETUP: {{specific state}}
ACTIONS:
{{exact steps using real selectors}}
ASSERT:
{{exact expected outcomes}}

```

### Scenario: {{Game-specific scenario 2}}
```

SETUP: {{specific state}}
ACTIONS:
{{exact steps}}
ASSERT:
{{exact expected outcomes}}

```

```

### 15. Verification Checklist

Game-specific checklist combining mandatory part checks + game-specific checks.

```markdown
## Verification Checklist

### Structural

- [ ] HTML has DOCTYPE, meta charset, meta viewport
- [ ] Package scripts in correct order (PART-002)
- [ ] Single <style> in <head>, single <script> in <body> (RULE-007)
- [ ] Body contains only `<div id="app"></div>` — no manual layout divs
- [ ] ⛔ No `#results-screen` div (use TransitionScreen content slot — PART-019 v2)
- [ ] ⛔ No `.page-center` / `.game-wrapper` / `.game-stack` HTML (use ScreenLayout v2)
- [ ] {{#timer-container injected into header slot if PART-006}}
- [ ] {{#story-container if PART-016}}

### Functional

- [ ] waitForPackages() defined and checks all required globals (PART-003)
- [ ] DOMContentLoaded calls init sequence in order (PART-004)
- [ ] VisibilityTracker created with onInactive + onResume (PART-005)
- [ ] {{TimerComponent created with correct config (PART-006)}}
- [ ] handlePostMessage registered and handles game_init (PART-008)
- [ ] Fallback content for standalone testing (PART-008)
- [ ] recordAttempt produces correct attempt shape (PART-009)
- [ ] trackEvent fires at all interaction points (PART-010)
- [ ] endGame calculates metrics, logs, sends postMessage, cleans up (PART-011)
- [ ] **Every end condition actually calls endGame()** — rounds complete, timer expires, lives lost (PART-011)
- [ ] Debug functions on window (PART-012)
- [ ] showResults uses TransitionScreen content slot (PART-019 v2)
- [ ] InputSchema defined with fallback content (PART-028)
- [ ] Play area built inside #gameContent via JS (PART-027)
- [ ] No anti-patterns present (PART-026)
- [ ] SignalCollector: deferred endProblem pattern, seal() before postMessage
- [ ] {{AnalyticsManager initialized with 7 mandatory events (PART-032)}}
- [ ] {{Interaction patterns initialized and resetable (PART-033)}}

### Design & Layout (v2)

- [ ] CSS uses `var(--mathai-*)` variables, no hardcoded colors (PART-020)
- [ ] Gameplay feedback uses correct colors — green/red/blue/gray (PART-020)
- [ ] ScreenLayout v2 with `config.sections` API (PART-025) — NOT v1 `config.slots`
- [ ] Sections: questionText + progressBar + playArea + transitionScreen always true
- [ ] Header section only if game has timer/HUD
- [ ] `.mathai-layout-playarea` CSS overrides use `!important` (PART-025)
- [ ] CSS reset with `100dvh`, not `100vh` (PART-021 v2)
- [ ] Buttons use `.game-btn` with `.btn-primary` / `.btn-secondary` classes (PART-022)
- [ ] ProgressBar v2: `createProgressBar()` helper, update(0, lives) at init (PART-023)
- [ ] TransitionScreen v2: welcome + results + game-over screens (PART-024)
- [ ] **Every transition screen plays audio** — no silent transitions (PART-024)
- [ ] Results shown via `transitionScreen.show({ content: metricsHTML })` (PART-019 v2)
- [ ] Question text hidden during gameplay, visible on welcome (PART-025)

### Rules Compliance

- [ ] RULE-001: All onclick handlers in global scope
- [ ] RULE-002: All async functions have async keyword
- [ ] RULE-003: All async calls in try/catch
- [ ] RULE-004: All logging uses JSON.stringify
- [ ] RULE-005: Cleanup in endGame
- [ ] RULE-006: No new Audio(), setInterval for timer, SubtitleComponent.show()
- [ ] RULE-007: Single file, no external CSS/JS

### Game-Specific

- [ ] {{Check 1 — specific to this game's mechanics}}
- [ ] {{Check 2 — specific to this game's UI}}
- [ ] {{Check N}}

### Contract Compliance

- [ ] gameState matches contracts/game-state.schema.json
- [ ] Attempts match contracts/attempt.schema.json
- [ ] Metrics match contracts/metrics.schema.json
- [ ] duration_data matches contracts/duration-data.schema.json
- [ ] postMessage out matches contracts/postmessage-out.schema.json
```

---

## Notes for Template Generation

1. **Be explicit.** Every function, every element ID, every CSS property. The assembly book should leave zero decisions for the HTML generation stage.

2. **Copy code from parts.** Don't paraphrase — copy the exact code blocks from the part files, with game-specific placeholders filled in.

3. **Include test content.** The fallback content in Section 4 should have at least 3 rounds of realistic data so the game works standalone.

4. **Verification is mandatory.** Section 15 must list every check. If it's not in the checklist, it won't be verified.

5. **Test scenarios must be exact.** Section 14 test scenarios are consumed by the ralph loop to generate Playwright tests. Use real selectors (e.g., `.grid-cell[data-row='0'][data-col='2']`), not vague descriptions (e.g., "click the correct cell"). The test generator needs exact actions to produce working tests.
