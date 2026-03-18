# PART-016: StoriesComponent

**Category:** CONDITIONAL | **Condition:** Game has narrative/story elements | **Dependencies:** PART-003

---

## HTML Required

```html
<div id="story-container"></div>
```

## Code — Basic Usage

```javascript
const stories = new StoriesComponent('story-container', {
  storyBlockId: 273291,  // Required — GraphQL block ID that fetches story data
  onComplete: (data) => {
    // data: { history, inputs, globalContext, durations }
    // Story finished — start gameplay or show next screen
    document.getElementById('story-container').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
  },
  onStoryChange: (index, direction, storyData) => {
    trackEvent('story_slide', 'story', { slideIndex: index, direction });
  },
  onError: (error) => {
    console.error('Story error:', JSON.stringify({ error: error.message }, null, 2));
  }
});
```

## Constructor Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `storyBlockId` | number/string | Yes | GraphQL block ID — the component fetches story data internally |
| `onComplete` | function | No | Called with `{ history, inputs, globalContext, durations }` when story ends |
| `onStoryChange` | function | No | Called with `(index, direction, storyData)` on slide change |
| `onButtonClick` | function | No | Called with `(name, action, storyIndex)` on story button click |
| `onInputChange` | function | No | Called with `(name, value, storyIndex)` on story input change |
| `onError` | function | No | Called with error object |
| `globalContext` | object | No | `{ value_map: {} }` for dynamic text replacement (`@@variable@@`) |
| `trackDuration` | boolean | No | Track time spent per slide |
| `pauseOnTabSwitch` | boolean | No | Pause on tab visibility change |
| `preloadAssets` | boolean | No | Preload story images/assets |
| `enableAudio` | boolean | No | Enable audio playback |
| `showProgress` | boolean | No | Show story progress indicator |
| `analytics` | object | No | AnalyticsManager instance for event tracking |

## CRITICAL: Stories are fetched, NOT passed in

The component fetches story data internally via GraphQL using `storyBlockId`. You do **NOT** pass story content directly.

```javascript
// WRONG — there is no `stories` config option
new StoriesComponent('container', {
  stories: [{ type: 'v2_story', data: { children: [...] } }]
});

// CORRECT — pass a storyBlockId, component fetches data itself
new StoriesComponent('container', {
  storyBlockId: 273291
});
```

## When to Use

- Intro narrative before gameplay
- Story between rounds
- Branching narrative games
- Story-only games (no questions)

## Important

This is a complex component with extensive API. When this part is selected, the LLM **MUST** read the deep reference before generating code.

## Verification

- [ ] `<div id="story-container"></div>` exists
- [ ] Constructor uses `storyBlockId` (NOT a `stories` array)
- [ ] `onComplete` callback handles transition to gameplay — receives `{ history, inputs, globalContext, durations }`
- [ ] `onStoryChange` uses correct 3-param signature: `(index, direction, storyData)`
- [ ] `onError` callback provided for error handling

## Deep Reference (MUST READ when selected)

`mathai-game-builder/components/stories-component.md` (2340 lines)
