# Components Overview

Quick reference for MathAI Game Builder components. For complete API documentation, see [types/](../types/).

## Loading Order (CRITICAL)

Load scripts in this exact order:

```html
<!-- 1. MANDATORY: FeedbackManager (includes SubtitleComponent automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. TimerComponent (if needed) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. VisibilityTracker (if using timers or audio) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## Available Components

### [FeedbackManager](./feedback-manager.md)
Unified feedback system - handles audio, subtitles, and stickers.
- **Package**: `feedback-manager`
- **Includes**: SubtitleComponent, StickerComponent
- **Initialization**: MANDATORY `await FeedbackManager.init()`

### [StoriesComponent](./stories-component.md)
Interactive story sequences with branching logic and GraphQL integration.
- **Package**: `components` (via `window.MathAIComponents.StoriesComponent`)
- **Use case**: Story-only games, narrative content, tutorials
- **Loading**: Requires [waitForPackages() pattern](../workflows/checklists/story-component-loading.md)

### [SubtitleComponent](./subtitle-component.md)
Text overlays with markdown support.
- **Package**: Auto-loaded by FeedbackManager (VERIFY: No separate loading)

### [TimerComponent](./timer-component.md)
Countdown/countup timers with MM:SS or SS format.
- **Package**: `components`
- **Must integrate with**: VisibilityTracker

### [VisibilityTracker](./visibility-tracker.md)
Pause/resume when users switch tabs.
- **Package**: `helpers`
- **MANDATORY for**: Games with timers or audio

## Quick Links

- [Full Type Definitions](../types/)
- [Component Props Reference](../reference/component-props.md)
- [FeedbackManager Full Docs](../types/feedback-manager-usage.md)
- [TimerComponent Full Docs](../types/timer-component-usage.md)
- [VisibilityTracker Full Docs](../types/visibility-tracker-usage.md)
