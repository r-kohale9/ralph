# PART-029: Story-Only Game Variant

**Category:** CONDITIONAL | **Condition:** Game only displays stories without questions/validation | **Dependencies:** PART-002, PART-016

---

## Purpose

Simplified game variant that only displays `StoriesComponent`. No questions, no validation, no feedback — just narrative content that auto-completes when the story ends.

## Key Differences from Standard Games

| Feature | Standard Game | Story-Only Game |
|---------|--------------|-----------------|
| StoriesComponent | Optional | MANDATORY |
| Questions | Yes | No |
| Validation | Yes | SKIPPED |
| Feedback | Yes | SKIPPED |
| Attempt tracking | Yes | No |
| VisibilityTracker | Mandatory | Optional |

## Package Loading

Story-only games need FeedbackManager and Components (for StoriesComponent), but NOT Helpers:

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

### waitForPackages (Story-Only)

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();

  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // CRITICAL: Check for StoriesComponent specifically
    while (typeof window.MathAIComponents === 'undefined' ||
           typeof window.MathAIComponents.StoriesComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: StoriesComponent');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('All packages loaded');
  } catch (error) {
    console.error('Package loading failed:', error);
    throw error;
  }
}
```

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Story Game</title>
  <style>
    body { margin: 0; padding: 0; }
    #story-container { width: 100vw; height: 100dvh; }
  </style>
</head>
<body>
  <div id="story-container"></div>

  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

  <script>
    // ... waitForPackages() defined above ...

    let gameContent = null;

    window.addEventListener('message', (event) => {
      try {
        if (event.data && event.data.type === 'game_init') {
          gameContent = event.data.data;
          console.log('Received content:', JSON.stringify(gameContent, null, 2));
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    });

    window.addEventListener('DOMContentLoaded', async () => {
      try {
        await waitForPackages();
        await FeedbackManager.init();

        const { StoriesComponent } = window.MathAIComponents;

        // Use runtime content or fallback
        const storyBlockId = gameContent?.story_block_id || 273291;

        const stories = new StoriesComponent('story-container', {
          storyBlockId: storyBlockId,
          showProgress: true,
          trackDuration: true,
          onComplete: (data) => {
            console.log('Story complete!', JSON.stringify(data, null, 2));
            handleStoryComplete(data);
          },
          onError: (error) => {
            console.error('Story error:', error);
          }
        });
      } catch (error) {
        console.error('Initialization failed:', error);
        document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to load story. Please refresh.</div>';
      }
    });

    function handleStoryComplete(data) {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'game_complete',
          data: {
            duration: data.durations?.total || 0,
            history: data.history || []
          }
        }, '*');
      }
      console.log('Story game complete');
    }
  </script>
</body>
</html>
```

## InputSchema

```json
{
  "type": "object",
  "properties": {
    "story_block_id": {
      "type": "integer",
      "description": "ID of the story block to display"
    }
  },
  "required": ["story_block_id"]
}
```

## Detection

Game is story-only when user requests:
- "Show a story"
- "Display interactive story"
- "Story-based game without questions"
- Any game that mentions ONLY story display

## Verification

- [ ] Only FeedbackManager and Components packages loaded
- [ ] `waitForPackages()` checks `MathAIComponents.StoriesComponent`
- [ ] StoriesComponent initialized with `storyBlockId`
- [ ] `onComplete` handler sends `game_complete` postMessage
- [ ] `onError` handler defined
- [ ] Fallback storyBlockId for standalone testing
- [ ] No validation, attempt tracking, or feedback code
