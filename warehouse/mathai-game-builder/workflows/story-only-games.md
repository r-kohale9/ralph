# Story-Only Games Workflow

Games that only display StoriesComponent without questions, validation, or feedback.

## Overview

**Story-only games** are games where:
- **Only StoriesComponent** is displayed
- **No questions or answers** - just narrative content
- **No validation** - skip Phase 2 entirely
- **No feedback** - skip Phase 3 entirely
- **Auto-complete** when story ends

## Detection

Game type is story-only when user requests:
- "Show a story"
- "Display interactive story"
- "Story-based game without questions"
- "Just show StoriesComponent"
- Any game description that mentions ONLY story display

## Key Differences

| Feature | Regular Game | Story-Only Game |
|---------|-------------|-----------------|
| StoriesComponent | Optional | MANDATORY |
| Questions | Yes | No |
| Validation | Phase 2 | SKIPPED |
| Feedback | Phase 3 | SKIPPED |
| Registration | Phase 4 | Phase 2 (renumbered) |
| Testing | Phase 5 | Phase 3 (renumbered) |

## Phase Workflow

### Phase 1: Story Display (Core)

**Goal:** Display StoriesComponent with proper loading

**Critical Pattern:**
```javascript
// MANDATORY: Wait for StoriesComponent to load
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();

  try {
    // Wait for FeedbackManager
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for StoriesComponent from MathAIComponents
    while (typeof window.MathAIComponents === 'undefined' || typeof window.MathAIComponents.StoriesComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: StoriesComponent');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('✅ All packages loaded');
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    throw error;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // CRITICAL: Wait for packages first
    await waitForPackages();
    await FeedbackManager.init();

    // Extract StoriesComponent from MathAIComponents
    const { StoriesComponent } = window.MathAIComponents;

    // Initialize story
    const stories = new StoriesComponent('story-container', {
      storyBlockId: 273291, // From runtime content
      showProgress: true,
      trackDuration: true,
      onComplete: (data) => {
        console.log('Story complete!', data);
        handleStoryComplete(data);
      },
      onError: (error) => {
        console.error('Story error:', error);
      }
    });
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to load story. Please refresh.</div>';
  }
});
```

**Checklist:**
```
📋 Phase 1 - Story-Only Game Requirements

User Requirements:
[ ] Story block ID or story data defined
[ ] Story flow understood (start → display → end)
[ ] VisibilityTracker requirement confirmed (optional for story-only)
[ ] Story completion action defined

Pattern Requirements:
[ ] Game directory created
[ ] Game ID generated
[ ] index.html created
[ ] metadata.json created with game_type: "story-only"
[ ] Files uploaded to CDN
[ ] Packages loaded - CRITICAL: waitForPackages() checks StoriesComponent
[ ] StoriesComponent initialized with storyBlockId
[ ] onComplete handler defined
[ ] onError handler defined
[ ] VisibilityTracker added (optional - only if pause/resume needed)
[ ] Story displays when packages load
[ ] Story completes without errors
```

### Phase 2: Registration (Renumbered from Phase 4)

Same as regular Phase 4, but:
- No InputSchema for questions
- No validation rules
- Just metadata registration

### Phase 3: Testing (Renumbered from Phase 5)

Same as regular Phase 5, but:
- Test story display
- Test story navigation
- Test story completion
- No validation testing
- No feedback testing

## Package Loading Pattern

**CRITICAL: StoriesComponent Loading**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Story Game</title>
  <style>
    body { margin: 0; padding: 0; }
    #story-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="story-container"></div>

  <!-- Load packages in correct order -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

  <script>
    // MANDATORY: Wait for StoriesComponent to load
    async function waitForPackages() {
      const timeout = 10000;
      const start = Date.now();

      try {
        while (typeof FeedbackManager === 'undefined') {
          if (Date.now() - start > timeout) {
            throw new Error('FeedbackManager not loaded');
          }
          await new Promise(r => setTimeout(r, 50));
        }

        // CRITICAL: Check MathAIComponents.StoriesComponent
        while (typeof window.MathAIComponents === 'undefined' ||
               typeof window.MathAIComponents.StoriesComponent === 'undefined') {
          if (Date.now() - start > timeout) {
            throw new Error('StoriesComponent not loaded');
          }
          await new Promise(r => setTimeout(r, 50));
        }

        console.log('✅ All packages loaded');
      } catch (error) {
        console.error('❌ Package loading failed:', error);
        throw error;
      }
    }

    let gameContent = null;

    // Listen for runtime content
    window.addEventListener('message', (event) => {
      if (event.data.type === 'GAME_CONTENT') {
        gameContent = event.data.content;
        console.log('Received content:', gameContent);
      }
    });

    window.addEventListener('DOMContentLoaded', async () => {
      try {
        await waitForPackages();
        await FeedbackManager.init();

        // Extract StoriesComponent
        const { StoriesComponent } = window.MathAIComponents;

        // Wait for content
        while (!gameContent) {
          await new Promise(r => setTimeout(r, 100));
        }

        // Initialize story
        const stories = new StoriesComponent('story-container', {
          storyBlockId: gameContent.story_block_id,
          showProgress: true,
          trackDuration: true,
          onComplete: (data) => {
            console.log('Story complete!', data);

            // Post completion to parent
            window.parent.postMessage({
              type: 'GAME_COMPLETE',
              data: {
                duration: data.durations.total,
                history: data.history
              }
            }, '*');
          },
          onError: (error) => {
            console.error('Story error:', error);
            window.parent.postMessage({
              type: 'GAME_ERROR',
              error: error.message
            }, '*');
          }
        });
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to load story. Please refresh.</div>';
      }
    });
  </script>
</body>
</html>
```

## InputSchema Pattern

Story-only games have minimal InputSchema:

```json
{
  "story_block_id": {
    "type": "integer",
    "description": "ID of the story block to display",
    "required": true
  }
}
```

## Metadata Pattern

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

## Common Issues

### Issue: StoriesComponent not defined

**Cause:** Script hasn't loaded yet or wrong path

**Solution:**
```javascript
// Check if MathAIComponents namespace exists
if (typeof window.MathAIComponents === 'undefined') {
  console.error('MathAIComponents not loaded');
}

// Check if StoriesComponent is available
if (typeof window.MathAIComponents.StoriesComponent === 'undefined') {
  console.error('StoriesComponent not loaded');
}
```

### Issue: Story doesn't render after load

**Cause:** StoriesComponent initialized before packages loaded

**Solution:** Always use `waitForPackages()` before initializing:
```javascript
await waitForPackages(); // MANDATORY
const { StoriesComponent } = window.MathAIComponents;
const stories = new StoriesComponent(...);
```

### Issue: Story displays but doesn't auto-advance

**Cause:** Missing duration settings in story data

**Solution:** Ensure story block has proper duration settings in GraphQL

## Testing Checklist

```
📋 Story-Only Game Testing

[ ] Story loads without errors
[ ] Story displays fullscreen
[ ] Story navigation works (left/right taps)
[ ] Story completes and triggers onComplete
[ ] Duration tracking works
[ ] Tab visibility handling works (if VisibilityTracker added)
[ ] Console shows no errors
[ ] Story content displays correctly
```

## Migration from Regular Game

To convert a regular game to story-only:

1. Remove all question/answer logic
2. Remove validation code (Phase 2)
3. Remove feedback integration (Phase 3)
4. Add `waitForPackages()` with StoriesComponent check
5. Initialize StoriesComponent
6. Update metadata.json with `"game_type": "story-only"`
7. Skip Phase 2 and Phase 3 in workflow
8. Go directly to Registration (now Phase 2)

## Reference

- [StoriesComponent Documentation](../components/stories-component.md)
- [Package Loading Checklist](checklists/package-loading.md)
- [Phase 1 Core Gameplay](phase-1-core-gameplay.md)
