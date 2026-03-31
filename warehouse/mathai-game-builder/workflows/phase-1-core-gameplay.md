# Phase 1: Core Gameplay

Build functional game with interactions. NO feedback integration yet.

## Critical Rules

⚠️ **Phase 1 loads packages but does NOT integrate feedback:**

- ✅ Load packages (FeedbackManager → Components → Helpers)
- ✅ Call FeedbackManager.init()
- ✅ Implement VisibilityTracker (MANDATORY for all games)
- ✅ Implement TimerComponent (if timer needed)
- ❌ NO feedbackAssets, preload(), or play() calls

⚠️ **View Event Rule (MANDATORY for all games):**

Every function that modifies the DOM in a way that changes what is visible on screen must call `signalCollector.recordViewEvent()`. This includes:
- Screen transitions (showing/hiding screens)
- Content rendering (displaying questions, options, grids)
- Timer-driven content changes (auto-reshuffle, auto-advance)
- Cell/option selection highlights
- Number/answer entry visual updates
- Validation feedback (correct/incorrect cell colors, messages)
- Overlay/modal show/hide (transition screens, pause popups)
- Scaffold/hint visibility changes

**Rule: If the DOM changes and the user can see it → record a view event.**

```javascript
function anyFunctionThatChangesUI(params) {
  // ... DOM changes ...

  if (signalCollector) {
    signalCollector.recordViewEvent('viewType', {
      screen: 'current_screen',
      content_snapshot: { /* what is now visible */ },
      components: { /* timer, progress, lives, etc. */ },
      metadata: { trigger: 'user_action' | 'timer_reshuffle' | 'round_start' }
    });
  }
}
```

**View event types:** `screen_transition`, `content_render`, `feedback_display`, `component_state`, `overlay_toggle`, `visual_update`

**Trigger field values:**
- `'round_start'` — initial content render at round/problem start
- `'user_action'` — content changed because user did something
- `'timer_reshuffle'` — content changed by game timer (no user action, e.g., Bubbles Pairs grid reshuffle)

See [components/signal-collector.md](../components/signal-collector.md) for full API and [examples/signal-capture-patterns.md](../examples/signal-capture-patterns.md) Pattern 9 for copy-paste code.

## Workflow

**Phase Start Logging:**
```javascript
logMessage({
  intent: "START_OR_CONTINUE",
  phase: "phase-1",
  workflowStep: "phase_1_initiated",
  context: "Phase 1 workflow started - core gameplay development",
  userMessage: currentUserPrompt,
  response: "Presenting Phase 1 checklists and requirements"
});
```

### Step 0: Present Checklists

**Parse user prompt for ALL specific requirements (including images):**

**If user provides an image:**

1. **Analyze the image carefully** and extract ALL visible specifications
2. **Document everything you observe** as specific checklist items
3. **Don't assume or generalize** - capture exact visual details from the image

Extract and add as dynamic checklist items:

1. **Visual Specifications:**

   - Colors: Border colors (hex codes like `#000000`, named colors), background colors, text colors
   - Dimensions: Grid size (e.g., "5x5", "3x4"), cell sizes, spacing values
   - Border styles: Width in px (e.g., "3px"), color, conditional styling rules, which borders are visible
   - Font details: Sizes, weights, families (if specified or visible in image)
   - Cell shapes: Square, rectangular, rounded corners, etc.

2. **Layout Structure:**

   - Grid dimensions and arrangement (e.g., "5x5 grid", "3x4 table")
   - Exact wall/path pattern from image (e.g., "cell (0,0) has right and bottom walls", "cell (1,0) has bottom wall only")
   - Element positioning and alignment
   - Spacing/padding/margin requirements
   - Cell connections and pathways

3. **Content Requirements:**

   - Specific text labels (e.g., "Start" indicator, "Finish" text)
   - Emojis/icons (e.g., ⭐, 🏁, 🎯)
   - Visual markers and indicators
   - Numbers/values visible in cells
   - Position of start and end points

4. **Styling Rules:**

   - Conditional styling (e.g., "border width 3px if wall, 0px if no wall")
   - State-based appearance (hover, active, selected)
   - Visual feedback on interactions
   - Cell highlighting or background colors

5. **Custom Metrics:**
   - Performance tracking (WPM, accuracy, reaction time)
   - Score systems and point tracking
   - Combo/streak tracking

**Create specific checklist items for each extracted requirement:**

- Use exact values from user prompt (e.g., "Border color: #000000")
- Include all specified details (e.g., "Border width: 3px for walls, 0px for no wall")
- Preserve emojis and special characters (e.g., "Start indicator: 'Start' text with ⭐ emoji")

**IMPORTANT: Replace [DYNAMIC] placeholders before presenting to user:**

- If user specifies a requirement that matches a [DYNAMIC] category, replace the placeholder with the actual value
- If user doesn't specify something, REMOVE that [DYNAMIC] line entirely
- Only show checklist items that apply to this specific game

**Example transformation:**

- User says: "5x5 grid with border color #000000 and 3px borders for walls"
- Replace: `[ ] [DYNAMIC] Grid/layout structure (e.g., "5x5 grid", "3x4 table")`
- With: `[ ] Grid/layout structure: 5x5 grid`
- Replace: `[ ] [DYNAMIC] Border colors (e.g., "#000000 for walls", "blue for active")`
- With: `[ ] Border colors: #000000 for walls`
- Replace: `[ ] [DYNAMIC] Border widths (e.g., "3px for walls, 0px for no wall")`
- With: `[ ] Border widths: 3px for walls, 0px for no wall`
- Remove: All other [DYNAMIC] items not mentioned by user

**User Requirements:**

```
📋 Phase 1 - User Requirements

[ ] Game type defined
[ ] User interactions identified
[ ] Game flow defined (start → play → end)
[ ] Timer requirement confirmed
[ ] Number of rounds/questions defined
[ ] Win/lose conditions clear
[ ] [DYNAMIC] Grid/layout structure (e.g., "5x5 grid", "3x4 table")
[ ] [DYNAMIC] Wall/path pattern from image (e.g., "specific maze layout with walls on certain cell borders")
[ ] [DYNAMIC] Border colors (e.g., "#000000 for walls", "blue for active")
[ ] [DYNAMIC] Border widths (e.g., "3px for walls, 0px for no wall")
[ ] [DYNAMIC] Which borders visible (e.g., "top and right borders for wall cells, no borders for paths")
[ ] [DYNAMIC] Background colors (e.g., "#f0f0f0 for cells", "white for paths")
[ ] [DYNAMIC] Text colors (e.g., "#333333 for labels")
[ ] [DYNAMIC] Cell/element dimensions (e.g., "50px x 50px cells")
[ ] [DYNAMIC] Cell shapes (e.g., "square cells", "rounded corners with 5px radius")
[ ] [DYNAMIC] Spacing/padding (e.g., "10px padding", "5px gap")
[ ] [DYNAMIC] Visual indicators (e.g., "Start text with ⭐ emoji", "🏁 for finish")
[ ] [DYNAMIC] Text labels (e.g., "Start", "Finish", "Score: ")
[ ] [DYNAMIC] Numbers/values in cells (e.g., "display collected numbers", "show point values")
[ ] [DYNAMIC] Start/end point positions (e.g., "Start at top-left (0,0)", "End at bottom-right with ⭐")
[ ] [DYNAMIC] Conditional styling rules (e.g., "highlight selected cell with yellow background")
[ ] [DYNAMIC] State-based visuals (e.g., "hover effect on clickable cells")
[ ] [DYNAMIC] Font specifications (e.g., "18px bold for title", "14px for content")
[ ] [DYNAMIC] Custom metric 1 (e.g., WPM tracking, score system)
[ ] [DYNAMIC] Custom metric 2 (e.g., combo bonuses, accuracy)
[ ] [DYNAMIC] Custom metric N (e.g., reaction time, streak tracking)

Ready to start? (Reply "start")
```

**Pattern Requirements (Internal):**

```
📋 Phase 1 - Pattern Requirements

[ ] Game directory path set to games/{gameId}
[ ] Game directory created with gameId as folder name
[ ] Game ID generated (game_timestamp_random)
[ ] index.html file created with ScreenLayout component injected: ScreenLayout.inject('app', {slots: {progressBar: [true/false], transitionScreen: [true/false]}}) - see workflows/choices/screenlayout-options.md
[ ] ProgressBar component (if rounds/levels/lives in prompt): new ProgressBarComponent({autoInject: true, totalRounds: N, totalLives: N}) - see workflows/choices/progressbar-options.md
[ ] TransitionScreen component (if start/victory/game-over in prompt): new TransitionScreenComponent({autoInject: true}) - see workflows/choices/transitionscreen-options.md
[ ] Gameplay Colors: --mathai-cell-bg-green (#D9F8D9) + --mathai-cell-border-green (#27ae60) for correct, --mathai-cell-bg-red (#FFD9D9) + --mathai-cell-border-red (#e74c3c) for incorrect - see workflows/choices/gameplay-colors-options.md
[ ] NO font-family declared in HTML
[ ] Game content written to #gameContent slot: document.getElementById('gameContent').innerHTML
[ ] metadata.json created with game_id, version 0.0.1, current_phase, files array
[ ] Files uploaded to CDN via upload_game_folder
[ ] Packages loaded - VERIFY: Script order (FeedbackManager → Components → Helpers), waitForPackages() function exists (see checklists/package-loading.md)
[ ] **IF subjective evaluation needed:** SubjectiveEvaluation is included in Helpers package - use MathAIHelpers.SubjectiveEvaluation.evaluate() (see checklists/subjective-evaluation.md)
[ ] TimerComponent added if needed - VERIFY: Constructor params, start/pause/resume/destroy methods, HTML container created BEFORE component initialization (see checklists/timer-component.md)
[ ] VisibilityTracker added - VERIFY: Constructor params, onInactive/onResume callbacks, pause/resume methods (see checklists/visibility-tracker.md)
[ ] NO feedback integration
[ ] InteractionManager loaded from helpers package and initialized - see components/interaction-manager.md for setup details
[ ] SignalCollector initialized after waitForPackages() - VERIFY: `new SignalCollector({ containerSelector: '.game-play-area', sessionId, studentId })` called, `window.signalCollector` exposed globally (see components/signal-collector.md)
[ ] SignalCollector integrated with VisibilityTracker - VERIFY: pause()/resume() called in onInactive/onResume callbacks
[ ] `data-signal-id` attributes added to key interactive elements (options, inputs, submit button, scaffolds) for clear signal identification
[ ] `signalCollector.recordViewEvent('content_render', ...)` called when each round/question renders (before user can interact) — see components/signal-collector.md "View Events" section
[ ] View events emitted for ALL visual changes - VERIFY: Every function that modifies the DOM in a way that changes what is visible on screen calls `signalCollector.recordViewEvent()` with appropriate viewType (see components/signal-collector.md "View Events" section and examples/signal-capture-patterns.md Pattern 9)
[ ] View events include trigger field - VERIFY: `'user_action'`, `'timer_reshuffle'`, or `'round_start'` distinguishes cause of visual change
[ ] Timer-driven content changes emit view events - VERIFY: setInterval/setTimeout callbacks that change visible content call `recordViewEvent` with `trigger:'timer_reshuffle'`
[ ] Implement attempt history with this schema (see examples/attempt-history-examples.md for complete structure and examples)
[ ] Game retries never reload the page and properly update retry count (roundState.attemptNumber increments, metrics.retries = roundState.attemptNumber - 1)
[ ] Metrics and Attempt History submitted via window.api.submitResults() using window.registered_game_id: Id generated after registering the game. VERIFIED: API instance properly instantiated and exposed globally as window.api, registered game ID injected into game HTML by Phase 4 registration process as window.registered_game_id, error thrown if window.registered_game_id not available, then used in submitGame() function with error handling and logging. DO NOT create custom submitResults() functions - use the globally available window.api.submitResults() method only
[ ] Phase 1 Metrics Checklist verification (created and verified during Phase 1 execution)
[ ] Phase 1 Content Validation - VERIFY: Generated options produce correct answers, all fields populated (created and verified during Phase 1 execution)
[ ] Phase 1 Code Validation - VERIFY: All called functions defined, no undefined errors, methods exist on objects (created and verified during Phase 1 execution)
```

### Step 1: Load Phase 0 Metadata (IF EXISTS)

**Action:** If Phase 0 was completed, load metadata to inform Phase 1 development

**Check if Phase 0 metadata exists:**

```javascript
// Check if coming from Phase 0 (gameId exists and metadata.json exists)
if (gameIdFromPhase0) {
  const metadata = Read({
    file_path: `games/${gameId}/metadata.json`
  });

  const meta = JSON.parse(metadata);

  // Extract architecture decisions:
  const {
    title,
    description,
    concepts,
    minGrade,
    maxGrade,
    difficulty,
    estimatedTime,
    type,
    architecture
  } = meta;

  // Use architecture to inform Phase 1:
  // - timerType: "increase" | "decrease" | "none"
  // - lives.enabled, lives.startingCount
  // - retryAllowed
  // - starSystem.enabled, starSystem.thresholds

  // IMPORTANT: Metadata uses TimerComponent API terms:
  // - "decrease" = countdown timer
  // - "increase" = countup timer
  // - Use these values directly in TimerComponent constructor

  console.log('Phase 0 metadata loaded:', {
    title,
    timerType: architecture.timerType,
    lives: architecture.lives,
    retry: architecture.retryAllowed,
    stars: architecture.starSystem
  });
}
```

**Use metadata in Phase 1:**
- If `timerType` is "increase" or "decrease", include TimerComponent
- If `lives.enabled` is true, implement lives system
- If `retryAllowed` is true, add retry button/logic
- If `starSystem.enabled` is true, implement star calculation

**Timer Implementation:**
```javascript
// For "decrease" (countdown)
const timer = new TimerComponent("timer-container", {
  timerType: "decrease",
  format: "min",
  startTime: architecture.timerStart,  // e.g., 300
  endTime: 0,
  autoStart: true,
  onEnd: () => { /* handle timeout */ }
});
window.timer = timer;  // Store globally for debugging and external access

// For "increase" (countup)
const timer = new TimerComponent("timer-container", {
  timerType: "increase",
  format: "min",
  startTime: 0,
  endTime: 9999999,
  autoStart: true,
  onEnd: () => { /* handle completion */ }
});
window.timer = timer;  // Store globally for debugging and external access
```

**If NO Phase 0 metadata:** Continue without it (Phase 1 can still work standalone).

---

### Step 1.5: Check for Existing Game (IF GAMEID PROVIDED)

**Action:** If user provides an existing gameId, verify and load it instead of creating new

**Only run this step if user explicitly provides a gameId.**

```javascript
// If user said "continue with game_1234567890_abc123" or similar
if (gameIdProvided) {
  // Use game resumption workflow
  // See game-resumption.md for complete steps
  // After loading, user can:
  // - Regenerate current phase
  // - Continue to next phase
  // - Make modifications
}
```

**If NO gameId provided:** Skip to Step 2 (generate new gameId).

**See:** [workflows/game-resumption.md](game-resumption.md) for complete verification workflow

---

### Step 2: Generate Game ID & Create Directory

**Action:** Create NEW game (skip if loaded existing game in Step 1.5)

```javascript
// Generate unique game ID first
const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Create game directory using Bash
Bash({
  command: `mkdir -p games/${gameId} games/${gameId}/checklists`,
  description: 'Create game directory and checklists subdirectory'
});
```

Save full path and gameId for all future operations.

**Important:** Folder name is the gameId (e.g., `game_1234567890_abc123def`), not a descriptive name.

**Write Phase 1 Checklists to Disk:**

- Store the relative directory path (for example, `const gameDirectory = \`games/${gameId}\``)
- Update the checklist text with any dynamic metric rows you extracted
- Persist the main checklist using `Write`
- **MANDATORY:** Create all Phase 1 sub-checklist files during execution

```javascript
const gameDirectory = `games/${gameId}`; // reuse this path for future writes

Write({
  file_path: `${gameDirectory}/checklists/phase-1-checklists.md`,
  content: `📋 Phase 1 - User Requirements

[ ] Game type defined
[ ] User interactions identified
[ ] Game flow defined (start → play → end)
[ ] Timer requirement confirmed
[ ] Number of rounds/questions defined
[ ] Win/lose conditions clear
[ ] [DYNAMIC] Grid/layout structure (e.g., "5x5 grid", "3x4 table")
[ ] [DYNAMIC] Wall/path pattern from image (e.g., "specific maze layout with walls on certain cell borders")
[ ] [DYNAMIC] Border colors (e.g., "#000000 for walls", "blue for active")
[ ] [DYNAMIC] Border widths (e.g., "3px for walls, 0px for no wall")
[ ] [DYNAMIC] Which borders visible (e.g., "top and right borders for wall cells, no borders for paths")
[ ] [DYNAMIC] Background colors (e.g., "#f0f0f0 for cells", "white for paths")
[ ] [DYNAMIC] Text colors (e.g., "#333333 for labels")
[ ] [DYNAMIC] Cell/element dimensions (e.g., "50px x 50px cells")
[ ] [DYNAMIC] Cell shapes (e.g., "square cells", "rounded corners with 5px radius")
[ ] [DYNAMIC] Spacing/padding (e.g., "10px padding", "5px gap")
[ ] [DYNAMIC] Visual indicators (e.g., "Start text with ⭐ emoji", "🏁 for finish")
[ ] [DYNAMIC] Text labels (e.g., "Start", "Finish", "Score: ")
[ ] [DYNAMIC] Numbers/values in cells (e.g., "display collected numbers", "show point values")
[ ] [DYNAMIC] Start/end point positions (e.g., "Start at top-left (0,0)", "End at bottom-right with ⭐")
[ ] [DYNAMIC] Conditional styling rules (e.g., "highlight selected cell with yellow background")
[ ] [DYNAMIC] State-based visuals (e.g., "hover effect on clickable cells")
[ ] [DYNAMIC] Font specifications (e.g., "18px bold for title", "14px for content")
[ ] [DYNAMIC] Custom metric 1 (e.g., WPM tracking, score system)
[ ] [DYNAMIC] Custom metric 2 (e.g., combo bonuses, accuracy)
[ ] [DYNAMIC] Custom metric N (e.g., reaction time, streak tracking)

📋 Phase 1 - Pattern Requirements

[ ] Game directory path set to games/{gameId}
[ ] Game directory created with gameId as folder name
[ ] Game ID generated (game_timestamp_random)
[ ] index.html file created with ScreenLayout component injected: ScreenLayout.inject('app', {slots: {progressBar: [true/false], transitionScreen: [true/false]}}) - see workflows/choices/screenlayout-options.md
[ ] ProgressBar component (if rounds/levels/lives in prompt): new ProgressBarComponent({autoInject: true, totalRounds: N, totalLives: N}) - see workflows/choices/progressbar-options.md
[ ] TransitionScreen component (if start/victory/game-over in prompt): new TransitionScreenComponent({autoInject: true}) - see workflows/choices/transitionscreen-options.md
[ ] Gameplay Colors: --mathai-cell-bg-green (#D9F8D9) + --mathai-cell-border-green (#27ae60) for correct, --mathai-cell-bg-red (#FFD9D9) + --mathai-cell-border-red (#e74c3c) for incorrect - see workflows/choices/gameplay-colors-options.md
[ ] NO font-family declared in HTML
[ ] Game content written to #gameContent slot: document.getElementById('gameContent').innerHTML
[ ] metadata.json created with game_id, version 0.0.1, current_phase, files array
[ ] Files uploaded to CDN via upload_game_folder
[ ] Packages loaded - VERIFY: Script order (FeedbackManager → Components → Helpers), waitForPackages() function exists (see checklists/package-loading.md)
[ ] **IF subjective evaluation needed:** SubjectiveEvaluation is included in Helpers package - use MathAIHelpers.SubjectiveEvaluation.evaluate() (see checklists/subjective-evaluation.md)
[ ] TimerComponent added if needed - VERIFY: Constructor params, start/pause/resume/destroy methods, HTML container created BEFORE component initialization (see checklists/timer-component.md)
[ ] VisibilityTracker added - VERIFY: Constructor params, onInactive/onResume callbacks, pause/resume methods (see checklists/visibility-tracker.md)
[ ] NO feedback integration
[ ] Implement attempt history with this schema (see examples/attempt-history-examples.md for complete structure and examples)
[ ] Game retries never reload the page and properly update retry count (roundState.attemptNumber increments, metrics.retries = roundState.attemptNumber - 1)
[ ] InteractionManager loaded from helpers package and initialized - see components/interaction-manager.md for setup details
[ ] SignalCollector initialized after waitForPackages() - VERIFY: `new SignalCollector({ containerSelector: '.game-play-area', sessionId, studentId })` called, `window.signalCollector` exposed globally (see components/signal-collector.md)
[ ] SignalCollector integrated with VisibilityTracker - VERIFY: pause()/resume() called in onInactive/onResume callbacks
[ ] `data-signal-id` attributes added to key interactive elements (options, inputs, submit button, scaffolds)
[ ] `signalCollector.recordViewEvent('content_render', ...)` called when each round/question renders (before user can interact) — see components/signal-collector.md "View Events" section
[ ] View events emitted for ALL visual changes - VERIFY: Every function that modifies the DOM in a way that changes what is visible on screen calls `signalCollector.recordViewEvent()` (see components/signal-collector.md and examples/signal-capture-patterns.md Pattern 9)
[ ] View events include trigger field - VERIFY: `'user_action'`, `'timer_reshuffle'`, or `'round_start'` distinguishes cause
[ ] Timer-driven content changes emit view events - VERIFY: setInterval/setTimeout that change content call `recordViewEvent` with `trigger:'timer_reshuffle'`
[ ] Game session payload submitted via window.api.submitResults() using registered game ID from window.registered_game_id - VERIFIED: API instance properly instantiated and exposed globally as window.api, registered game ID injected into game HTML by Phase 4 registration process as window.registered_game_id, error thrown if window.registered_game_id not available, then used in submitGame() function with error handling and logging. DO NOT create custom submitResults() functions - use the globally available window.api.submitResults() method only
[ ] Phase 1 Metrics Checklist verification (created and verified during Phase 1 execution)
[ ] Phase 1 Content Validation - VERIFY: Generated options produce correct answers, all fields populated (created and verified during Phase 1 execution)
[ ] Phase 1 Code Validation - VERIFY: All called functions defined, no undefined errors, methods exist on objects (created and verified during Phase 1 execution)
`
});
```

> Make sure the string contains every dynamic checklist row you generated for the user before writing. Update this file with `Edit` as items flip to `[✅]` or `[❌]`.

**Create Phase 1 Sub-Checklist Files:**

**MANDATORY:** Create these 3 sub-checklist files immediately after the main checklist by reading templates and creating customized content:

```javascript
// 1. Read Phase 1 Metrics Checklist template
const metricsTemplate = Read({ file_path: "workflows/checklists/phase-1-metrics-checklist.md" });

// 2. Create customized metrics checklist content based on user requirements
// Read the template and add specific metric rows based on what was extracted from user prompt
// For example, if user mentioned "WPM tracking", "score system", add those specific rows
const metricsChecklistContent = metricsTemplate
  .replace('[DYNAMIC] Custom metric 1 properly logged to console (e.g., WPM tracking)', extractedMetrics.metric1 || '[ ] [DYNAMIC] Custom metric 1 properly logged to console')
  .replace('[DYNAMIC] Custom metric 2 properly logged to console (e.g., score system)', extractedMetrics.metric2 || '[ ] [DYNAMIC] Custom metric 2 properly logged to console')
  .replace('[DYNAMIC] Custom metric N properly logged to console (e.g., combo bonuses)', extractedMetrics.metricN || '[ ] [DYNAMIC] Custom metric N properly logged to console');

// 3. Write the customized metrics checklist
Write({
  file_path: `${gameDirectory}/checklists/phase-1-metrics-checklist.md`,
  content: metricsChecklistContent
});

// 4. Read Phase 1 Content Validation Checklist template
const contentTemplate = Read({ file_path: "workflows/checklists/phase-1-content-validation-checklist.md" });

// 5. Create customized content validation checklist
// Use the template as-is since content validation is generally standard
const contentChecklistContent = contentTemplate;

// 6. Write the content validation checklist
Write({
  file_path: `${gameDirectory}/checklists/phase-1-content-validation-checklist.md`,
  content: contentChecklistContent
});

// 7. Read Phase 1 Code Validation Checklist template
const codeTemplate = Read({ file_path: "workflows/checklists/phase-1-code-validation-checklist.md" });

// 8. Create customized code validation checklist
// Use the template as-is since code validation requirements are generally standard
const codeChecklistContent = codeTemplate;

// 9. Write the code validation checklist
Write({
  file_path: `${gameDirectory}/checklists/phase-1-code-validation-checklist.md`,
  content: codeChecklistContent
});
```

**CRITICAL:** These sub-checklist files MUST be created during Phase 1 execution by reading templates and customizing them for the specific game requirements. They will be verified and updated as the phase progresses.

### Step 3: Generate index.html

**Read choice files based on checklist requirements:**

```javascript
// Always read (all games use ScreenLayout)
Read: workflows/choices/screenlayout-options.md;

// Conditionally read based on checklist:
// If ProgressBar checklist item applies:
Read: workflows/choices/progressbar-options.md;

// If TransitionScreen checklist item applies:
Read: workflows/choices/transitionscreen-options.md;

// If Gameplay Colors checklist item applies:
Read: workflows/choices/gameplay-colors-options.md;
```

**Integration example:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Math Game</title>

  <!-- Load packages in EXACT order -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

  <style>
    /* Only if Gameplay Colors checklist item applies */
    .correct {
      background: var(--mathai-cell-bg-green);
      border: 2px solid var(--mathai-cell-border-green);
    }
    .incorrect {
      background: var(--mathai-cell-bg-red);
      border: 2px solid var(--mathai-cell-border-red);
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    let progressBar, transitionScreen;

    window.addEventListener('DOMContentLoaded', async () => {
      await waitForPackages();
      await FeedbackManager.init();

      const api = new window.APIHelper({timeout: 10000});
      window.api = api;

      // 1. Inject ScreenLayout (see choices/screenlayout-options.md)
      ScreenLayout.inject('app', {
        slots: {
          progressBar: true,      // If ProgressBar checklist item applies
          transitionScreen: true  // If TransitionScreen checklist item applies
        }
      });

      // 2. Create ProgressBar (if checklist applies - see choices/progressbar-options.md)
      progressBar = new ProgressBarComponent({
        autoInject: true,
        totalRounds: 5,   // From user prompt
        totalLives: 3     // From user prompt
      });

      // 3. Create TransitionScreen (if checklist applies - see choices/transitionscreen-options.md)
      transitionScreen = new TransitionScreenComponent({autoInject: true});

      // 4. Initialize VisibilityTracker (MANDATORY for all games)
      const visibilityTracker = new VisibilityTracker({
        onInactive: () => {
          FeedbackManager.sound.pause();
          FeedbackManager.stream.pauseAll();
        },
        onResume: () => {
          FeedbackManager.sound.resume();
          FeedbackManager.stream.resumeAll();
        },
        popupProps: {
          title: "Game Paused",
          description: "Click Resume to continue.",
          primaryText: "Resume"
        }
      });

      // 5. Write game-specific content
      document.getElementById('gameContent').innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <h2>Question 1</h2>
          <button onclick="checkAnswer(true)">Correct Answer</button>
          <button onclick="checkAnswer(false)">Wrong Answer</button>
        </div>
      `;

      // 6. Show start screen (if TransitionScreen created)
      transitionScreen.show({
        icons: ['🎮'],
        iconSize: 'large',
        title: 'Are you ready?',
        buttons: [{
          text: "I'm ready!",
          type: 'primary',
          action: () => startGame()
        }]
      });
    });

    function startGame() {
      console.log('Game started');
      // Your game logic here
    }

    function checkAnswer(correct) {
      if (correct) {
        progressBar.update(1, 3);
        // Apply gameplay colors if checklist applies
        // element.classList.add('correct');
      } else {
        progressBar.update(1, 2);
        // element.classList.add('incorrect');
      }
    }

    async function waitForPackages() {
      const timeout = 10000;
      const start = Date.now();
      try {
        while (typeof FeedbackManager === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package loading timeout: FeedbackManager');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof ScreenLayout === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package loading timeout: ScreenLayout');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof VisibilityTracker === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package loading timeout: VisibilityTracker');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof window.APIHelper === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package loading timeout: APIHelper');
          await new Promise(r => setTimeout(r, 50));
        }
        while (typeof SignalCollector === 'undefined') {
          if (Date.now() - start > timeout) throw new Error('Package loading timeout: SignalCollector');
          await new Promise(r => setTimeout(r, 50));
        }
        console.log('✅ All packages loaded');
      } catch (error) {
        console.error('❌ Package loading failed:', error);
        throw error;
      }
    }
  </script>
</body>
</html>
```

**Adapt this template based on your checklist requirements.** For component-specific configuration options, see the choice files referenced above.

**🚨 MANDATORY: Read Component Checklists**

Before writing ANY code, you MUST read these checklists to understand the correct methods and patterns:

```javascript
// 1. ALWAYS read package loading checklist
Read: workflows/checklists/package-loading.md;

// 2. ALWAYS read visibility tracker checklist (MANDATORY for all games)
Read: workflows/checklists/visibility-tracker.md;

// 3. IF timer needed, read timer checklist
Read: workflows/checklists/timer-component.md;
```

**After reading checklists, check timer requirement:**

- ✅ Timer required → Include TimerComponent using methods from checklist
- ❌ Timer not needed → Skip timer, but VisibilityTracker still MANDATORY

**Package Loading:**
Use exact patterns from [checklists/package-loading.md](checklists/package-loading.md)

**Quick reference:**

```html
<!-- Load game packages in EXACT order -->
<!-- 1. FeedbackManager (MANDATORY - loads SubtitleComponent automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components (for TimerComponent, PopupComponent) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers (MANDATORY for VisibilityTracker) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

<!-- 4. Analytics Package (MANDATORY - config loads automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**⚠️ CRITICAL: API Submission Implementation**

**DO NOT create custom `submitResults()` functions.** Always use the ApiHelper's `api.submitResults()` method that gets loaded from the helpers package.

**Correct Implementation:**
```javascript
// ✅ CORRECT - Initialize API Helper in DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  // ... package loading ...

  // Initialize API Helper instance
  const api = new window.APIHelper({
    timeout: 10000
  });

  // ... rest of initialization ...
});

// ✅ CORRECT - Use globally available API Helper with registered game ID
async function submitGame() {
  // ... game logic ...

  // Get registered game ID from global window property
  // This is injected into the HTML by Phase 4 registration process
  const registeredGameId = window.registered_game_id;

  if (!registeredGameId) {
    throw new Error('No registered game ID available. Game must be registered in Phase 4 before API submissions.');
  }

  const submissionPayload = {
    session_id: sessionId,
    game_id: registeredGameId, // Use registered game ID from window.registered_game_id
    metrics: metrics,
    attempts: attemptHistory,
    completed_at: Number(endTime) // Ensure it's a number
  };

  // Validate completed_at is a finite number
  if (!Number.isFinite(submissionPayload.completed_at)) {
    throw new Error(`completed_at must be a finite number, got: ${typeof submissionPayload.completed_at} ${submissionPayload.completed_at}`);
  }

  try {
    await window.api.submitResults(submissionPayload);
    console.log('✅ Game session submitted successfully');
  } catch (error) {
    console.error('❌ Failed to submit game session:', error);
    throw error; // Re-throw to prevent showing results if submission fails
  }

  showResults(results);
}
```

**❌ INCORRECT - Do NOT create custom submitResults functions:**
```javascript
// ❌ WRONG - Do not create custom submitResults functions
function submitResults(results) {
  console.log('Submitting to API:', results);
  // TODO: Actual API call will be implemented
  // fetch('/api/analytics/game-sessions', { ... });
}
```

**The ApiHelper (`api.submitResults()`) handles:**
- ✅ Real API calls to `/api/analytics/game-sessions`
- ✅ Proper error handling and logging
- ✅ Authentication and headers
- ✅ Response parsing

**Initialization:**

```javascript
async function waitForPackages() {
  const timeout = 10000; // 10 seconds
  const start = Date.now();

  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: TimerComponent');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: VisibilityTracker');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    // Wait for Analytics (MANDATORY)
    while (typeof AnalyticsManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: AnalyticsManager');
      }
    }
    while (typeof window.APIHelper === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: APIHelper');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof SignalCollector === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: SignalCollector');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    // ✅ ApiHelper class is automatically loaded from helpers package as window.APIHelper
    console.log('✅ All packages loaded');
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    throw error;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
    await FeedbackManager.init();

    // Initialize analytics (MANDATORY - tracks events automatically)
    const analytics = new AnalyticsManager();
    await analytics.init();

    // Set global instance (MANDATORY for StoriesComponent integration)
    window.analyticsManager = analytics;

    // Identify user from postMessage data (MANDATORY)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'GAME_DATA' && event.data.student) {
        const student = event.data.student;
        analytics.identify({
          id: student.id,
          mobile: student.mobile || student.phone,
          name: student.name,
          email: student.email
        });
      }
    });

    // 🎯 RUNTIME CONTENT INTEGRATION (MANDATORY)
    // Games receive content from platform via postMessage
    // Fallback data allows local testing without platform

    // Define fallback content for local testing
    const FALLBACK_CONTENT = {
      totalQuestions: 5,
      retryAllowed: true,
      timerType: "countup",
      startTime: 0,
      starThresholds: { 3: 100, 2: 70, 1: 50 },
      questions: [
        // Add sample questions matching your game structure
        // Example: { operand1: 2, operand2: 3, answer: 6 }
      ]
    };

    let gameContent = null;
    let gameInitialized = false;

    // Listen for runtime content from platform
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'game_init') {
        console.log('📨 Received game_init:', JSON.stringify(event.data, null, 2));

        // CRITICAL: Use safe content extraction with fallback chain
        // Platform format: event.data.data.content
        // Legacy format: event.data.content
        // Fallback: FALLBACK_CONTENT (for local testing)
        gameContent = event.data.data?.content || event.data.content || FALLBACK_CONTENT;

        // If game already started, you can restart with new content
        if (gameInitialized) {
          console.log('🔄 Restarting game with new content');
          restartWithNewContent(gameContent);
        }
      }
    });

    // Wait for content with timeout (3 seconds)
    async function waitForContent() {
      const timeout = 3000;
      const start = Date.now();

      while (!gameContent) {
        if (Date.now() - start > timeout) {
          console.warn('⚠️ No runtime content received, using fallback data for local testing');
          gameContent = FALLBACK_CONTENT;
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }

      return gameContent;
    }

    // Signal to platform that game is ready to receive content
    window.parent.postMessage({ type: 'game_ready' }, '*');
    console.log('✅ Game ready signal sent to platform');

    // Wait for content, then initialize game
    const content = await waitForContent();
    // Initialize API Helper instance
    const api = new window.APIHelper({
      timeout: 10000
    });

    // Make API instance globally available
    window.api = api;

    let timer = null;
    let visibilityTracker = null;

    // IF timer needed - see checklists/timer-component.md
    timer = new TimerComponent("timer-container", {...});
    window.timer = timer;  // Store globally for debugging and external access

    // ALWAYS required - see checklists/visibility-tracker.md
    visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        if (timer) timer.pause({ fromVisibilityTracker: true });
        FeedbackManager.sound.pause();
        FeedbackManager.stream.pauseAll();
      },
      onResume: () => {
        if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });
        FeedbackManager.sound.resume();
        FeedbackManager.stream.resumeAll();
      },
      popupProps: {
        title: "Game Paused",
        description: "Click Resume to continue.",
        primaryText: "Resume",
      },
    });

    // Initialize game with runtime content
    setupGame(content);
    gameInitialized = true;
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    // Show user-friendly error
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to initialize game. Please refresh the page.</div>';
  }
});
```

**🎯 Using Runtime Content in Your Game:**

Now create your `setupGame()` function that extracts and uses the runtime content:

```javascript
function setupGame(content) {
  // Extract configuration variables from runtime content
  const {
    totalQuestions,
    retryAllowed,
    timerType,
    startTime,
    starThresholds,
    questions
  } = content;

  // Initialize game state with runtime config
  gameState = {
    questions: questions,
    totalQuestions: totalQuestions || questions.length,
    retryAllowed: retryAllowed !== undefined ? retryAllowed : true,
    starThresholds: starThresholds || { 3: 100, 2: 70, 1: 50 },
    currentQuestion: 0,
    score: 0,
    correctAnswers: 0
  };

  // Use runtime timer config (if timer is part of your game)
  if (timer && timerType) {
    // Timer already created above, but you can reconfigure if needed
    timer.setTimerType(timerType);
    if (startTime !== undefined) {
      timer.setStartTime(startTime);
    }
  }

  console.log('✅ Game initialized with content:', {
    totalQuestions: gameState.totalQuestions,
    retryAllowed: gameState.retryAllowed,
    questionCount: questions.length
  });

  // Start displaying first question
  displayQuestion();
}

// Optional: Function to restart game with new content
function restartWithNewContent(newContent) {
  // Reset timer if exists
  if (timer) {
    timer.reset();
  }

  // Clear any existing UI state
  // ... your reset logic ...

  // Reinitialize with new content
  setupGame(newContent);
}
```

**Key Points:**
- ✅ Extract ALL config variables from content (not just questions)
- ✅ Use nullish coalescing for defaults
- ✅ Initialize timer with runtime config
- ✅ Log what content was received for debugging
- ✅ Start game logic after setup complete

### ⚠️ CRITICAL: Timer Creation Sequence

**MANDATORY ORDER:** HTML container MUST exist before TimerComponent creation

**✅ CORRECT Pattern:**

```javascript
function startRound() {
  // Step 1: FIRST - Render HTML (creates #timer-container in DOM)
  renderGame();

  // Step 2: THEN - Create TimerComponent (finds existing container)
  if (timer) {
    timer.destroy();
  }

  timer = new TimerComponent("timer-container", {
    timerType: "decrease",
    startTime: 20,
    endTime: 0,
    autoStart: true,
    onEnd: handleTimeout
  });
  window.timer = timer;  // Store globally for debugging and external access
}

function renderGame() {
  document.getElementById('gameContent').innerHTML = `
    <div id="timer-container"></div>
    <!-- other game elements -->
  `;
}
```

❌ WRONG Pattern (CAUSES ERRORS):

```javascript
function startRound() {
  // ❌ ERROR: Container doesn't exist yet!
  timer = new TimerComponent("timer-container", {...}); // FAILS!

  // Container created too late
  renderGame(); // Creates #timer-container
}
```

**Verification:**

 renderGame() or innerHTML called BEFORE new TimerComponent()
 HTML container exists in DOM before component initialization
 No "Cannot find element" errors in browser console

**Rule:** Always create DOM elements FIRST, then initialize components that target them.

**Use Write tool:**

```javascript
Write({
  file_path: `games/${gameId}/index.html`,
  content: '<!DOCTYPE html>...' // Full HTML inline
});
```

**Then create metadata.json:**

```javascript
Write({
  file_path: `games/${gameId}/metadata.json`,
  content: JSON.stringify(
    {
      game_id: gameId, // Generated in Step 2
      version: '0.0.1',
      current_phase: 'phase-1',
      files: [
        '/index.html',
        '/metadata.json',
        '/checklists/phase-1-checklists.md',
        '/checklists/phase-1-metrics-checklist.md',
        '/checklists/phase-1-content-validation-checklist.md',
        '/checklists/phase-1-code-validation-checklist.md'
      ]
    },
    null,
    2
  )
});
```

**Then upload ALL files to CDN:**

```javascript
// Step 1: Get absolute path for MCP tool
const GAME_DIR = `$(pwd)/games/${gameId}`;

// Step 2: List all files in directory using Glob
const allFiles = Glob({
  pattern: "**/*",
  path: `games/${gameId}`
});

// Step 3: Build files array for upload
const files = [
  { filePath: `${GAME_DIR}/index.html`, targetPath: "index.html" },
  { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },
  { filePath: `${GAME_DIR}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" },
  { filePath: `${GAME_DIR}/checklists/phase-1-metrics-checklist.md`, targetPath: "checklists/phase-1-metrics-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-1-content-validation-checklist.md`, targetPath: "checklists/phase-1-content-validation-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-1-code-validation-checklist.md`, targetPath: "checklists/phase-1-code-validation-checklist.md" }
];

// Step 4: Upload (requires absolute paths for MCP tool)
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**Verify if all files in game directory are uploaded to CDN (Including checklists and any other files)**

**IMPORTANT:** Upload happens automatically after file creation. Do NOT ask user permission.

**Component Integration:**

- **Error Tracking:** [checklists/error-tracking.md](checklists/error-tracking.md)
- **TimerComponent:** [checklists/timer-component.md](checklists/timer-component.md)
- **VisibilityTracker:** [checklists/visibility-tracker.md](checklists/visibility-tracker.md)
- **Package Loading:** [checklists/package-loading.md](checklists/package-loading.md)

### Step 4: Verify Checklists

**🚨 MANDATORY: Read ALL Sub-Checklists Before Verification**

Before marking ANY component as complete, you MUST:

```javascript
// 1. Read package loading checklist and verify exact methods used
Read: workflows / checklists / package - loading.md;
// Verify: Script tags in correct order, waitForPackages() function exists

// 2. Read visibility tracker checklist and verify exact methods used
Read: workflows / checklists / visibility - tracker.md;
// Verify: Constructor params, onInactive/onResume callbacks, pause/resume methods

// 3. IF timer added, read timer checklist and verify exact methods used
Read: workflows / checklists / timer - component.md;
// Verify: Constructor params, start/pause/resume/destroy methods

// 4. Create/read metrics checklist and verify structure
// Sub-checklist files are now created in Step 2.5, so they should exist for reading
Read: games / ${gameId} / checklists / phase - 1 - metrics - checklist.md;
// Verify: Exact metrics structure, attempt history format, timeBreakdown format

// 5. Create/read content validation checklist
// Sub-checklist files are now created in Step 2.5, so they should exist for reading
Read: games / ${gameId} / checklists / phase - 1 - content - validation - checklist.md;
// Verify: Generated content can produce valid answers

// 6. Create/read code validation checklist
// Sub-checklist files are now created in Step 2.5, so they should exist for reading
Read: games / ${gameId} / checklists / phase - 1 - code - validation - checklist.md;
// Verify: All called functions are defined
```

**After reading ALL checklists, UPDATE the checklist file with specific details:**

**🚨 MANDATORY: Use Edit to rewrite generic items with specific implementation:**

```javascript
// Example: Rewrite generic TimerComponent item with specific details
Edit({
  file_path: `games/${gameId}/checklists/phase-1-checklists.md`,
  old_string: '[ ] TimerComponent added if needed (see checklists/timer-component.md)',
  new_string:
    '[✅] TimerComponent: new TimerComponent("timer-container", {timerType:"increase", startTime:0, autoStart:true, onEnd:endGame}) - VERIFIED against timer-component.md'
});

Edit({
  file_path: `games/${gameId}/checklists/phase-1-checklists.md`,
  old_string: '[ ] VisibilityTracker added (see checklists/visibility-tracker.md)',
  new_string:
    '[✅] VisibilityTracker: onInactive calls timer.pause()+sound.pause()+stream.pauseAll(), onResume calls timer.resume()+sound.resume()+stream.resumeAll() - VERIFIED against visibility-tracker.md'
});
```

**Then verify items in your internal tracking:**

> 🚨 **Checklist Gate (BLOCKING):** Do **not** send any summary or request approval until you have:
> 1. Re-read every checklist file from disk using `filesystem:read_text_file` (never rely on memory or prior context).
> 2. Updated statuses with `filesystem:edit_file` and echoed BOTH the in-progress table and the VERIFIED table below.
> 3. Explicitly confirmed in your response that all checklists are `[✅]` (or call out any `[❌]` and fix before proceeding).
> 4. Loaded the Phase 1 sub-checklists (`phase-1-metrics-checklist.md`, `phase-1-content-validation-checklist.md`, `phase-1-code-validation-checklist.md`) and shown their VERIFIED blocks too—if a file is missing, recreate it before continuing.
>
> If the response would exceed context/window limits, split your reply, but still show the checklist verification before any other commentary. Skipping this gate is a workflow violation—restart Step 4 if it happens.

**Filesystem sequence (MANDATORY):**
1. `filesystem:read_text_file` → `games/${gameId}/checklists/phase-1-checklists.md`
2. **Sub-checklists already created in Step 2.5** - no need to create again
3. `filesystem:read_text_file` → `games/${gameId}/checklists/phase-1-metrics-checklist.md`
4. `filesystem:read_text_file` → `games/${gameId}/checklists/phase-1-content-validation-checklist.md`
5. `filesystem:read_text_file` → `games/${gameId}/checklists/phase-1-code-validation-checklist.md`
6. `filesystem:edit_file` → flip `[ ]` → `[✅]` as items verify on both main and sub-checklists
7. Echo **every** checklist (main + all sub-checklists, in-progress + VERIFIED) in the response before summaries or approvals.

**Before notifying user, verify ALL items:**

```
User Requirements:
[✅/❌] Game type implemented
[✅/❌] Interactions functional
[✅/❌] Game flow works
[✅/❌] Timer implemented (if needed) - VERIFIED against timer-component.md
[✅/❌] Correct number of rounds
[✅/❌] Win/lose conditions work
[✅/❌] [DYNAMIC] Grid/layout structure implemented (e.g., "5x5 grid with proper HTML structure")
[✅/❌] [DYNAMIC] Wall/path pattern matches image (e.g., "maze layout exactly matches provided image")
[✅/❌] [DYNAMIC] Border colors applied correctly (e.g., "#000000 for walls")
[✅/❌] [DYNAMIC] Border widths applied correctly (e.g., "3px for walls, 0px for no wall")
[✅/❌] [DYNAMIC] Correct borders visible (e.g., "only specified borders shown per cell")
[✅/❌] [DYNAMIC] Background colors applied (e.g., "#f0f0f0 for cells, white for paths")
[✅/❌] [DYNAMIC] Text colors applied (e.g., "#333333 for labels")
[✅/❌] [DYNAMIC] Cell/element dimensions correct (e.g., "50px x 50px cells")
[✅/❌] [DYNAMIC] Cell shapes correct (e.g., "square cells with no rounding")
[✅/❌] [DYNAMIC] Spacing/padding applied (e.g., "10px padding on cells")
[✅/❌] [DYNAMIC] Visual indicators displayed (e.g., "Start text with ⭐ emoji visible")
[✅/❌] [DYNAMIC] Text labels present (e.g., "Start", "Finish" labels shown")
[✅/❌] [DYNAMIC] Numbers/values displayed correctly (e.g., "point values shown in cells")
[✅/❌] [DYNAMIC] Start/end positions correct (e.g., "Start at (0,0), End at bottom-right")
[✅/❌] [DYNAMIC] Conditional styling rules working (e.g., "walls show 3px border, paths show 0px")
[✅/❌] [DYNAMIC] State-based visuals working (e.g., "hover effect on clickable cells")
[✅/❌] [DYNAMIC] Font specifications applied (e.g., "18px bold for title")
[✅/❌] [DYNAMIC] Custom metric 1 implemented and functional (e.g., WPM tracking)
[✅/❌] [DYNAMIC] Custom metric 2 implemented and functional (e.g., score system)
[✅/❌] [DYNAMIC] Custom metric N implemented and functional (e.g., combo bonuses)

Pattern Requirements:
[✅/❌] index.html file created with ScreenLayout component: ScreenLayout.inject() called with slots matching checklist requirements
[✅/❌] ProgressBar component (if checklist requires): Created and update() method called correctly
[✅/❌] TransitionScreen component (if checklist requires): Created and show() method used correctly
[✅/❌] Gameplay Colors (if checklist requires): CSS variables applied to answer feedback elements
[✅/❌] NO font-family declared in HTML
[✅/❌] Game content written to #gameContent slot
[✅/❌] Packages loaded in order - VERIFIED against package-loading.md
[✅/❌] FeedbackManager.init() called - VERIFIED against package-loading.md
[✅/❌] TimerComponent methods correct - VERIFIED against timer-component.md
[✅/❌] VisibilityTracker methods correct - VERIFIED against visibility-tracker.md
[✅/❌] NO feedback integration
[✅/❌] InteractionManager loaded from helpers package and initialized - VERIFIED against components/interaction-manager.md
[✅/❌] NO custom timer code
[✅/❌] Implement attempt history with this schema (see examples/attempt-history-examples.md for complete structure and examples)
[✅/❌] Metrics structure correct - VERIFIED against games/${gameId}/checklists/phase-1-metrics-checklist.md
[✅/❌] Content validation passed - VERIFIED against games/${gameId}/checklists/phase-1-content-validation-checklist.md
[✅/❌] Code validation passed - VERIFIED against games/${gameId}/checklists/phase-1-code-validation-checklist.md
[✅/❌] Game session payload submitted via window.api.submitResults() - VERIFIED: API instance properly instantiated and exposed globally as window.api, then used in submitGame() function with error handling and logging. DO NOT create custom submitResults() functions - use the globally available window.api.submitResults() method only
[✅/❌] Phase 1 Metrics Checklist verification
   - [✅/❌] [DYNAMIC] Custom metric 1 properly logged to console (e.g., WPM tracking)
   - [✅/❌] [DYNAMIC] Custom metric 2 properly logged to console (e.g., score system)
   - [✅/❌] [DYNAMIC] Custom metric N properly logged to console (e.g., combo bonuses)
[✅/❌] Phase 1 Content Validation Checklist verification
[✅/❌] Phase 1 Code Validation Checklist verification
```

**Output and verify metrics checklist:**

See detailed checklist: games/${gameId}/checklists/phase-1-metrics-checklist.md (created during Phase 1 execution)

```
📋 Phase 1 Metrics Checklist - End of Gameplay Logging:

[ ] Exact metrics object structure logged (console.log('Final Metrics:', {accuracy, time, stars, retries, timeBreakdown}))
[ ] Attempt history logged to console (e.g., console.log('Attempt History:', attempts))
[ ] All required metrics captured (accuracy, time, stars, retries, timeBreakdown)
[ ] Game session payload submitted via window.api.submitResults() using registered game ID from window.registered_game_id - VERIFIED: API instance properly instantiated and exposed globally as window.api, registered game ID injected into game HTML by Phase 4 registration process as window.registered_game_id, error thrown if window.registered_game_id not available, then used in submitGame() function with error handling and logging. DO NOT create custom submitResults() functions - use the globally available window.api.submitResults() method only
[ ] Console output readable and complete
[ ] **MANDATORY:** Attempt history structure validation (attempt_number, start_timestamp, end_timestamp, duration, overall_correctness, metadata with round/level data)
[ ] **MANDATORY:** timeBreakdown validation (array of numbers, sum equals total time)
```

**Process and verify metrics checklist, then output verified checklist:**

```
📋 Phase 1 Metrics Checklist - VERIFIED:

[✅/❌] Exact metrics object structure logged (console.log('Final Metrics:', {accuracy, time, stars, retries, timeBreakdown}))
[✅/❌] Attempt history logged to console (e.g., console.log('Attempt History:', attempts))
[✅/❌] All required metrics captured (accuracy, time, stars, retries, timeBreakdown)
[✅/❌] Game session payload submitted via window.api.submitResults() - VERIFIED: API instance properly instantiated and exposed globally as window.api, then used in submitGame() function with error handling and logging. DO NOT create custom submitResults() functions - use the globally available window.api.submitResults() method only
[✅/❌] Console output readable and complete
[✅/❌] **MANDATORY:** Attempt history structure validation (attempt_number, start_timestamp, end_timestamp, duration, overall_correctness, metadata with round/level data)
[✅/❌] **MANDATORY:** timeBreakdown validation (array of numbers, sum equals total time)
```

---

**Output and verify content validation checklist:**

See detailed checklist: [checklists/phase-1-content-validation-checklist.md](checklists/phase-1-content-validation-checklist.md)

```
📋 Phase 1 Content Validation Checklist - Game Data Integrity:

[ ] Game content validation (generated options and combinations can produce correct answers)
```

**Process and verify content validation checklist, then output verified checklist:**

```
📋 Phase 1 Content Validation Checklist - VERIFIED:

[✅/❌] Game content validation (generated options and combinations can produce correct answers)
```

---

**Output and verify code validation checklist:**

See detailed checklist: [checklists/phase-1-code-validation-checklist.md](checklists/phase-1-code-validation-checklist.md)

```
📋 Phase 1 Code Validation Checklist - Function and Code Integrity:

[ ] Function definition validation (all called functions are defined and exist)
[ ] Async/await validation (all functions using await have async keyword)
[ ] Function scope validation (HTML onclick handlers are in global scope)
```

**CRITICAL:** Functions called from HTML (`onclick`, `onchange`, etc.) MUST be in global scope (not inside DOMContentLoaded).

**Process and verify code validation checklist, then output verified checklist:**

```
📋 Phase 1 Code Validation Checklist - VERIFIED:

[✅/❌] Function definition validation (all called functions are defined and exist)
[✅/❌] Async/await validation (all functions using await have async keyword)
[✅/❌] Function scope validation (HTML onclick handlers are in global scope)
```

**If ANY ❌, fix immediately before Step 5.**

### Step 5: User Testing

```
📁 Game saved to: games/[gameId]/

🌐 Open in Chrome:
   file://$(pwd)/games/[gameId]/index.html

Test:
- All interactions clickable
- Visual layout correct
- Game progression works
- No console errors
```

### Step 6: Request Approval

```
✅ Phase 1 complete!

🆔 Game ID: [gameId]
📦 Version: 0.0.1

📁 Local: games/[gameId]/
🌐 Test: file://$(pwd)/games/[gameId]/index.html

Current Status:
1. [PENDING APPROVAL] Core Gameplay ← Test and approve
2. [ ] Validation
3. [ ] Feedback
4. [ ] Registration
5. [ ] Testing
```

**Wait for explicit approval before Phase 2.**

**Log phase completion:**
```javascript
logMessage({
  intent: "APPROVAL_AND_ADVANCE",
  phase: "phase-1",
  workflowStep: "phase_1_complete",
  context: "Phase 1 approved by user, advancing to Phase 2",
  userMessage: approvalMessage,
  response: "Phase 1 complete - proceeding to Phase 2 validation",
  checklistStatus: "All Phase 1 checklists [✅]"
});
```

### If the User Requests Changes After Approval

**MANDATORY WORKFLOW:**

1. **Analyze the new user prompt first.** If it asks for _any_ change after Phase 1 approval, treat it as a change request.
2. **STOP** – do **not** touch game files yet.
3. **Reset the checklist** using `Edit` tool so every `[✅]` becomes `[ ]`.
4. **Then** make the requested edits.
5. **Re-verify** all reset items until they are `[✅]` again.
6. **Request approval** only after verification passes.

Follow the full reset flow in [workflows/checklist-reset-strategy.md](checklist-reset-strategy.md) if later phases were already completed.

```javascript
Edit({
  file_path: `games/${gameId}/checklists/phase-1-checklists.md`,
  old_string: '[✅]',
  new_string: '[ ]',
  replace_all: true
});
```

> Skipping the reset step breaks the workflow. Only continue once the checklist shows all `[✅]` again.

## Component Checklists

- [Package Loading](checklists/package-loading.md) - **MANDATORY**
- [VisibilityTracker](checklists/visibility-tracker.md) - **MANDATORY**
- [TimerComponent](checklists/timer-component.md) - If timer needed

## Reference

- [File Operations](../reference/file-operations.md)
- [Component Props](../reference/component-props.md)
