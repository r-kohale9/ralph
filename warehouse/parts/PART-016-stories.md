# PART-016: StoriesComponent

**Category:** CONDITIONAL | **Condition:** Game has narrative/story elements | **Dependencies:** PART-003

---

## HTML Required

```html
<div id="story-container"></div>
```

## Code — Basic Usage

```javascript
const storyData = {
  type: 'v2_story',
  data: {
    children: [
      // Story slides — see deep reference for element types
    ]
  }
};

const stories = new StoriesComponent('story-container', {
  stories: [storyData],
  onComplete: () => {
    // Story finished — start gameplay or show next screen
    document.getElementById('story-container').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
  },
  onStoryChange: (index) => {
    trackEvent('story_slide', 'story', { slideIndex: index });
  }
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
- [ ] Story data uses `v2_story` format
- [ ] `onComplete` callback handles transition to gameplay
- [ ] `onStoryChange` tracks story events

## Deep Reference (MUST READ when selected)

`mathai-game-builder/components/stories-component.md` (2340 lines)
