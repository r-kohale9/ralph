# Story-Only Game Example

Complete working example of a story-only game that displays StoriesComponent.

## Complete HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Story</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }

    #story-container {
      width: 100vw;
      height: 100vh;
      position: relative;
    }

    .loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #667eea;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      z-index: 10000;
    }

    .loading-screen.hidden {
      display: none;
    }

    .error-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #f56565;
      display: none;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
      padding: 20px;
      z-index: 10001;
    }

    .error-screen.visible {
      display: flex;
    }

    .error-content {
      max-width: 400px;
    }

    .error-content h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }

    .error-content p {
      font-size: 16px;
      margin-bottom: 20px;
    }

    .error-content button {
      background: white;
      color: #f56565;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .error-content button:hover {
      background: #f7fafc;
    }
  </style>
</head>
<body>
  <div class="loading-screen" id="loading">Loading story...</div>
  <div class="error-screen" id="error">
    <div class="error-content">
      <h1>Story Loading Failed</h1>
      <p id="error-message">Please refresh the page and try again.</p>
      <button onclick="window.location.reload()">Refresh</button>
    </div>
  </div>

  <div id="story-container"></div>

  <!-- Load packages in correct order -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

  <script>
    // Game metadata
    const GAME_ID = 'game_1234567890_story123';
    const GAME_VERSION = '0.0.1';

    // Runtime content
    let gameContent = null;

    // Listen for runtime content from platform
    window.addEventListener('message', (event) => {
      if (event.data.type === 'GAME_CONTENT') {
        gameContent = event.data.content;
        console.log('📦 Received content:', gameContent);
      }
    });

    // MANDATORY: Wait for StoriesComponent to load
    async function waitForPackages() {
      const timeout = 10000; // 10 seconds
      const start = Date.now();

      try {
        // Wait for FeedbackManager
        while (typeof FeedbackManager === 'undefined') {
          if (Date.now() - start > timeout) {
            throw new Error('Package loading timeout: FeedbackManager not loaded');
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log('✅ FeedbackManager loaded');

        // Wait for MathAIComponents namespace
        while (typeof window.MathAIComponents === 'undefined') {
          if (Date.now() - start > timeout) {
            throw new Error('Package loading timeout: MathAIComponents namespace not found');
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log('✅ MathAIComponents namespace loaded');

        // Wait for StoriesComponent
        while (typeof window.MathAIComponents.StoriesComponent === 'undefined') {
          if (Date.now() - start > timeout) {
            throw new Error('Package loading timeout: StoriesComponent not loaded');
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log('✅ StoriesComponent loaded');

        console.log('✅ All packages loaded successfully');
      } catch (error) {
        console.error('❌ Package loading failed:', error);
        throw error;
      }
    }

    // Wait for runtime content
    async function waitForContent() {
      const timeout = 5000;
      const start = Date.now();

      while (!gameContent) {
        if (Date.now() - start > timeout) {
          console.warn('⚠️ No runtime content received, using default');
          // Use default story block ID for testing
          gameContent = { story_block_id: 273291 };
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return gameContent;
    }

    // Show error screen
    function showError(message) {
      const loadingScreen = document.getElementById('loading');
      const errorScreen = document.getElementById('error');
      const errorMessage = document.getElementById('error-message');

      loadingScreen.classList.add('hidden');
      errorScreen.classList.add('visible');
      errorMessage.textContent = message;
    }

    // Hide loading screen
    function hideLoading() {
      const loadingScreen = document.getElementById('loading');
      loadingScreen.classList.add('hidden');
    }

    // Handle story completion
    function handleStoryComplete(data) {
      console.log('🎉 Story complete!', data);

      // Log metrics
      console.log('Duration Data:', data.durations);
      console.log('History:', data.history);
      console.log('Global Context:', data.globalContext);

      // Post completion to parent window (platform)
      window.parent.postMessage({
        type: 'GAME_COMPLETE',
        game_id: GAME_ID,
        version: GAME_VERSION,
        data: {
          duration: data.durations.total,
          active_time: data.durations.active,
          inactive_time: data.durations.inactive,
          history: data.history,
          global_context: data.globalContext
        }
      }, '*');
    }

    // Initialize game
    window.addEventListener('DOMContentLoaded', async () => {
      try {
        console.log('🎮 Initializing story game...');
        console.log('🆔 Game ID:', GAME_ID);
        console.log('📦 Version:', GAME_VERSION);

        // STEP 1: Wait for packages to load
        await waitForPackages();

        // STEP 2: Initialize FeedbackManager
        await FeedbackManager.init();
        console.log('✅ FeedbackManager initialized');

        // STEP 3: Wait for runtime content
        const content = await waitForContent();
        console.log('✅ Content loaded:', content);

        // STEP 4: Extract StoriesComponent from MathAIComponents
        const { StoriesComponent } = window.MathAIComponents;

        // STEP 5: Validate story block ID
        if (!content.story_block_id) {
          throw new Error('Missing story_block_id in content');
        }

        // STEP 6: Hide loading screen
        hideLoading();

        // STEP 7: Initialize StoriesComponent
        console.log('🎬 Initializing story with block ID:', content.story_block_id);
        const stories = new StoriesComponent('story-container', {
          storyBlockId: content.story_block_id,
          showProgress: true,
          trackDuration: true,
          pauseOnTabSwitch: true,
          enableAudio: true,

          // Callbacks
          onStoryChange: (index, direction, story) => {
            console.log(`📖 Story changed: ${story.name} (index: ${index}, direction: ${direction})`);

            // Post progress to parent
            window.parent.postMessage({
              type: 'STORY_PROGRESS',
              game_id: GAME_ID,
              data: {
                story_index: index,
                story_name: story.name,
                direction: direction
              }
            }, '*');
          },

          onComplete: (data) => {
            handleStoryComplete(data);
          },

          onButtonClick: (name, action, storyIndex) => {
            console.log(`🔘 Button clicked: ${name} (story: ${storyIndex})`);
          },

          onInputChange: (name, value, storyIndex) => {
            console.log(`📝 Input changed: ${name} = ${value} (story: ${storyIndex})`);
          },

          onError: (error) => {
            console.error('❌ Story error:', error);

            // Post error to parent
            window.parent.postMessage({
              type: 'GAME_ERROR',
              game_id: GAME_ID,
              error: error.message
            }, '*');

            showError('Story failed to load. Please refresh and try again.');
          }
        });

        console.log('✅ Story initialized successfully');

        // Post ready event
        window.parent.postMessage({
          type: 'GAME_READY',
          game_id: GAME_ID,
          version: GAME_VERSION
        }, '*');

      } catch (error) {
        console.error('❌ Initialization failed:', error);
        showError(error.message);

        // Post error to parent
        window.parent.postMessage({
          type: 'GAME_ERROR',
          game_id: GAME_ID,
          error: error.message
        }, '*');
      }
    });

    // Handle visibility change (optional - built into StoriesComponent with pauseOnTabSwitch)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('⏸️ Tab hidden');
      } else {
        console.log('▶️ Tab visible');
      }
    });

    // Post initial message to request content
    window.parent.postMessage({
      type: 'GAME_LOADED',
      game_id: GAME_ID
    }, '*');
  </script>
</body>
</html>
```

## Key Features

1. **Package Loading**
   - Waits for FeedbackManager
   - Waits for MathAIComponents namespace
   - Waits for StoriesComponent
   - 10-second timeout with error handling

2. **Runtime Content**
   - Listens for postMessage from platform
   - Waits for story_block_id
   - Falls back to default for testing

3. **Error Handling**
   - Loading screen during initialization
   - Error screen with user-friendly message
   - Detailed console logging
   - Posts errors to parent window

4. **Story Callbacks**
   - onStoryChange: Logs progress
   - onComplete: Posts completion to parent
   - onButtonClick: Logs button interactions
   - onInputChange: Logs input changes
   - onError: Shows error screen

5. **Platform Integration**
   - Posts GAME_LOADED on init
   - Posts GAME_READY when ready
   - Posts STORY_PROGRESS during navigation
   - Posts GAME_COMPLETE on finish
   - Posts GAME_ERROR on errors

## Testing

**Local Testing:**
```bash
# Open in browser
open file://$(pwd)/games/game_1234567890_story123/index.html
```

**Expected Console Output:**
```
🎮 Initializing story game...
🆔 Game ID: game_1234567890_story123
📦 Version: 0.0.1
✅ FeedbackManager loaded
✅ MathAIComponents namespace loaded
✅ StoriesComponent loaded
✅ All packages loaded successfully
✅ FeedbackManager initialized
⚠️ No runtime content received, using default
✅ Content loaded: {story_block_id: 273291}
🎬 Initializing story with block ID: 273291
📖 Story changed: intro (index: 0, direction: initial)
✅ Story initialized successfully
```

## InputSchema

```json
{
  "story_block_id": {
    "type": "integer",
    "description": "ID of the story block to display from Hasura",
    "required": true,
    "example": 273291
  }
}
```

## Metadata

```json
{
  "game_id": "game_1234567890_story123",
  "version": "0.0.1",
  "current_phase": "phase-1",
  "game_type": "story-only",
  "files": [
    "/index.html",
    "/metadata.json"
  ]
}
```

## Common Issues

### StoriesComponent not defined

**Check:**
1. Console shows "✅ StoriesComponent loaded"
2. window.MathAIComponents exists
3. window.MathAIComponents.StoriesComponent exists

**Fix:** Ensure waitForPackages() completes before using StoriesComponent

### Story doesn't render

**Check:**
1. Container element exists (`<div id="story-container">`)
2. Container has dimensions (100vw x 100vh)
3. story_block_id is valid
4. No console errors

**Fix:** Check container styling and story_block_id validity

### Loading timeout

**Check:**
1. Script URLs are correct
2. Network connection is stable
3. CDN is accessible

**Fix:** Verify script URLs and network connectivity

## Reference

- [Story-Only Games Workflow](../workflows/story-only-games.md)
- [StoriesComponent Documentation](../components/stories-component.md)
- [StoriesComponent Loading Checklist](../workflows/checklists/story-component-loading.md)
