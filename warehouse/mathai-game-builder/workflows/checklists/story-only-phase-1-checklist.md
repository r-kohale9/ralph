# Story-Only Game - Phase 1 Checklist

Checklist for Phase 1: Story Display (Story-Only Games)

## User Requirements

```
📋 Phase 1 - Story-Only User Requirements

[ ] Story block ID or story data source defined
[ ] Story flow understood (display → navigate → complete)
[ ] Story completion action defined
[ ] Tab visibility handling requirement (optional)
[ ] Any custom global context variables identified
```

## Pattern Requirements

```
📋 Phase 1 - Story-Only Pattern Requirements

[ ] Game directory path set to games/{gameId}
[ ] Game directory created with gameId as folder name
[ ] Game ID generated (game_timestamp_random)
[ ] index.html created
[ ] metadata.json created with:
    - game_id
    - version 0.0.1
    - current_phase: "phase-1"
    - game_type: "story-only"
    - files array
[ ] Files uploaded to CDN via upload_game_folder

Package Loading - CRITICAL:
[ ] FeedbackManager script tag present (loads first)
[ ] Components script tag present (loads second)
[ ] waitForPackages() function defined
[ ] waitForPackages() checks FeedbackManager
[ ] waitForPackages() checks window.MathAIComponents
[ ] waitForPackages() checks window.MathAIComponents.StoriesComponent
[ ] waitForPackages() has 10-second timeout
[ ] waitForPackages() throws error on timeout

StoriesComponent Initialization - CRITICAL:
[ ] await waitForPackages() called before using StoriesComponent
[ ] await FeedbackManager.init() called after waitForPackages()
[ ] StoriesComponent extracted from window.MathAIComponents
[ ] Container element exists (#story-container)
[ ] Container has dimensions (100vw x 100vh)
[ ] storyBlockId provided (from runtime content)
[ ] onComplete callback defined
[ ] onError callback defined
[ ] showProgress set to true
[ ] trackDuration set to true
[ ] pauseOnTabSwitch set to true (optional)

Error Handling:
[ ] try-catch wraps initialization
[ ] Error logged to console
[ ] User-friendly error message shown on failure
[ ] Loading screen displayed during initialization
[ ] Error screen available for failures

Platform Integration:
[ ] Listens for postMessage (GAME_CONTENT)
[ ] Posts GAME_LOADED on init
[ ] Posts GAME_READY when ready
[ ] Posts STORY_PROGRESS during navigation
[ ] Posts GAME_COMPLETE on finish
[ ] Posts GAME_ERROR on errors

NO Standard Game Features:
[ ] NO TimerComponent (unless specifically requested)
[ ] NO question/answer logic
[ ] NO validation code
[ ] NO feedback integration (audio preload/play for answers)
```

## Verification Steps

### 1. Check HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    #story-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="story-container"></div>

  <!-- VERIFY: Script order -->
  <script src=".../feedback-manager/index.js"></script>
  <script src=".../components/index.js"></script>

  <script>
    // VERIFY: waitForPackages() defined here
    async function waitForPackages() { /* ... */ }

    // VERIFY: DOMContentLoaded handler
    window.addEventListener('DOMContentLoaded', async () => {
      try {
        await waitForPackages(); // CRITICAL
        await FeedbackManager.init();

        const { StoriesComponent } = window.MathAIComponents;

        const stories = new StoriesComponent('story-container', {
          storyBlockId: content.story_block_id,
          onComplete: (data) => { /* ... */ }
        });
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    });
  </script>
</body>
</html>
```

### 2. Check metadata.json

```json
{
  "game_id": "game_1234567890_abc123",
  "version": "0.0.1",
  "current_phase": "phase-1",
  "game_type": "story-only",
  "files": [
    "/index.html",
    "/metadata.json"
  ]
}
```

### 3. Check Console Output

```
🎮 Initializing story game...
🆔 Game ID: game_1234567890_abc123
📦 Version: 0.0.1
✅ FeedbackManager loaded
✅ MathAIComponents namespace loaded
✅ StoriesComponent loaded
✅ All packages loaded successfully
✅ FeedbackManager initialized
✅ Content loaded: {story_block_id: 273291}
🎬 Initializing story with block ID: 273291
📖 Story changed: intro (index: 0, direction: initial)
✅ Story initialized successfully
```

### 4. Check Browser Behavior

- Loading screen shows initially
- Loading screen hides when story loads
- Story displays fullscreen
- Story navigation works (left/right taps)
- Story completes without errors
- Console shows no errors
- No "StoriesComponent is not defined" errors
- No "Cannot read property 'StoriesComponent' of undefined" errors

## Common Issues

### ❌ "StoriesComponent is not defined"

**Fix:** Add waitForPackages() and await it before using StoriesComponent

```javascript
// WRONG
window.addEventListener('DOMContentLoaded', async () => {
  await FeedbackManager.init();
  const stories = new StoriesComponent(...); // ERROR!
});

// CORRECT
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages(); // Wait first!
  await FeedbackManager.init();
  const { StoriesComponent } = window.MathAIComponents;
  const stories = new StoriesComponent(...);
});
```

### ❌ "Cannot read property 'StoriesComponent' of undefined"

**Fix:** Check for window.MathAIComponents before accessing StoriesComponent

```javascript
// WRONG
while (typeof StoriesComponent === 'undefined') { /* ... */ }

// CORRECT
while (typeof window.MathAIComponents === 'undefined' ||
       typeof window.MathAIComponents.StoriesComponent === 'undefined') {
  /* ... */
}
```

### ❌ Story doesn't render

**Fix:** Ensure container exists and has dimensions

```html
<!-- WRONG -->
<div id="story-container"></div>

<!-- CORRECT -->
<div id="story-container" style="width: 100vw; height: 100vh;"></div>
```

### ❌ Infinite loading

**Fix:** Add timeout to waitForPackages()

```javascript
// WRONG - infinite loop
while (typeof FeedbackManager === 'undefined') {
  await new Promise(r => setTimeout(r, 50));
}

// CORRECT - timeout after 10 seconds
const start = Date.now();
while (typeof FeedbackManager === 'undefined') {
  if (Date.now() - start > 10000) {
    throw new Error('FeedbackManager loading timeout');
  }
  await new Promise(r => setTimeout(r, 50));
}
```

## Phase Completion

When all items are ✅:

```
✅ Phase 1 complete!

🆔 Game ID: [gameId]
📦 Version: 0.0.1
🎮 Game Type: story-only

📁 Local: games/[gameId]/
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/[gameId]/index.html

Current Status:
1. [PENDING APPROVAL] Story Display ← Test and approve
2. [ ] Registration
3. [ ] Testing

Test the story and approve if working well.
```

## Next Steps

After approval:
- Skip Phase 2 (Validation) - not needed for story-only
- Skip Phase 3 (Feedback) - not needed for story-only
- Proceed directly to Phase 4 (Registration) → becomes Phase 2
- Then Phase 5 (Testing) → becomes Phase 3

## Reference

- [Story-Only Games Workflow](../story-only-games.md)
- [StoriesComponent Loading Checklist](story-component-loading.md)
- [Story-Only Game Example](../../examples/story-only-game-example.md)
- [StoriesComponent Documentation](../../components/stories-component.md)
