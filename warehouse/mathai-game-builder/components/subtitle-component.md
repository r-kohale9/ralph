# SubtitleComponent

Text overlays with markdown support, auto-synchronized with audio.

## Overview

SubtitleComponent provides:
- Markdown support: `**bold**`, `*italic*`, `[links](url)`
- Auto-synchronized with audio playback
- Smart duration (calculated from audio length)
- Automatic show/hide management

## Auto-loaded by FeedbackManager

**CRITICAL: SubtitleComponent is loaded automatically by FeedbackManager.**

```html
<!-- CORRECT - FeedbackManager loads SubtitleComponent -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- WRONG - Do NOT load separately -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

## Usage (via FeedbackManager props)

**Important:** Always pass subtitle options to FeedbackManager (VERIFY: No direct SubtitleComponent method calls):

### Simple String

```javascript
await FeedbackManager.sound.play("correct", {
  subtitle: "**Great job!** You got it right!",
});
```

### With Markdown

```javascript
await FeedbackManager.sound.play("correct", {
  subtitle: "**Excellent!** You got it *right* ✨",
});
```

### Subtitle Object (Advanced)

```javascript
await FeedbackManager.sound.play("correct", {
  subtitle: {
    text: "**Congratulations!**",
    duration: 3,  // Optional: override auto-calculated duration
  },
});
```

## Critical Rules Checklist

### SubtitleComponent Usage

```
[ ] VERIFY: No direct SubtitleComponent usage
[ ] Pass subtitle to FeedbackManager instead
```

```javascript
// CORRECT - Pass subtitle to FeedbackManager
await FeedbackManager.sound.play("correct", {
  subtitle: "Great!",
});

// WRONG - Never call SubtitleComponent methods
SubtitleComponent.show({ text: "Great!" });      // NOT synchronized!
SubtitleComponent.updateText("New message");     // NOT managed!
SubtitleComponent.hide();                        // Auto-managed!
```

### Why Use FeedbackManager?

- **Auto-sync**: Subtitles hide when audio completes
- **Smart timing**: Duration calculated from audio length
- **Sequential playback**: Subtitles update when new audio plays
- **Unified API**: One call for audio + subtitle + sticker

## Auto-synchronization

Subtitles automatically:
- Show when audio starts
- Update text if new audio plays
- Hide when audio completes
- Hide when audio is preempted by new audio

```javascript
// Play audio with subtitle
await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked"
});

// New audio preempts previous - subtitle auto-updates
await FeedbackManager.sound.play("correct", {
  subtitle: "Correct!"
});
// "Button clicked" subtitle auto-hides
// "Correct!" subtitle shows
```

## Full Documentation

For complete API reference, type definitions, and advanced usage:
- [SubtitleComponent Type Definitions](../types/subtitle-component.d.ts)
- [SubtitleComponent Full Usage Guide](../types/subtitle-component-usage.md)
- [FeedbackManager Integration](../types/feedback-manager-usage.md)

## Related Components

- [FeedbackManager](./feedback-manager.md) - Use this to show subtitles
