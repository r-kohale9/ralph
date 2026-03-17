# FeedbackManager Component

Unified feedback system for audio, subtitles, and stickers.

## Overview

FeedbackManager v3.0 provides a single API for all feedback types:
- Audio (regular + streaming)
- Subtitles with markdown
- Stickers (Lottie animations)
- Auto-sync between all feedback types
- Sequential playback (mono mode)

## Installation

```html
<!-- MANDATORY: Single script tag loads everything -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
```

This automatically includes:
- Audio streaming components
- SubtitleComponent
- StickerComponent
- All dependencies

## MANDATORY: Initialize First

**You MUST call `init()` before using any FeedbackManager features:**

```javascript
// When DOM is ready
window.onload = async () => {
  await FeedbackManager.init();
  // Now you can use FeedbackManager
};
```

**Why?**
- Loads audio streaming components
- Initializes subtitle and sticker systems
- Prepares feedback system for use

**VERIFY: No FeedbackManager usage before init() - it will fail!**

## Usage

### Basic Audio + Subtitle

```javascript
// Play audio with subtitle
await FeedbackManager.sound.play("correct", {
  subtitle: "**Great job!** You got it right!",
});
```

### Audio + Subtitle + Sticker

```javascript
// Full unified feedback
await FeedbackManager.sound.play("correct", {
  subtitle: "**Excellent!** You got it *right*",
  sticker: "https://cdn.mathai.com/stickers/star.json",
  priority: 10,
});
```

### Streaming Audio + Feedback

```javascript
// Dynamic audio with feedback
await FeedbackManager.stream.addFromResponse("dynamic", response);
FeedbackManager.stream.play(
  "dynamic",
  {
    complete: () => console.log("Done"),
  },
  {
    subtitle: "Congratulations!",
    sticker: "https://cdn.mathai.com/stickers/celebration.json",
  }
);
```

### Dynamic Audio (Simplified Method)

**Method for dynamic audio generation**

```javascript
// ✅ RECOMMENDED: Use the simplified playDynamicFeedback method
await FeedbackManager.playDynamicFeedback({
  audio_content: "Great job! You scored 95 percent!",
  subtitle: "Amazing! You scored 95%!",
  sticker: "https://cdn.mathai.com/stickers/star.json"
});
```

**Parameters:**
- `audio_content` (required): Text to convert to speech
- `subtitle` (optional): Subtitle text to display during audio
- `sticker` (optional): Sticker URL to show during audio

**What it does:**
- Automatically handles both cached and streaming audio
- No need to check content-type or manage stream IDs
- Auto-cleanup when audio completes
- Integrated subtitle and sticker display

## Critical Rules Checklist

### FeedbackManager Usage

```
[ ] Use FeedbackManager for all audio and feedback
[ ] VERIFY: No manual Audio() creation
```

```javascript
// CORRECT - Use FeedbackManager
await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked",
});

// WRONG - Never create manual audio
const audio = new Audio("https://...");  // VERIFY: No manual audio!
audio.play();
```

### SubtitleComponent Integration

```
[ ] Pass subtitle to FeedbackManager
[ ] VERIFY: No direct SubtitleComponent calls
```

```javascript
// CORRECT - Pass subtitle to FeedbackManager
await FeedbackManager.sound.play("correct", {
  subtitle: "Great!",
});

// WRONG - Never call SubtitleComponent directly
SubtitleComponent.show({ text: "Great!" });  // VERIFY: No direct calls!
```

### Sequential Playback (Mono Mode)

Only one audio plays at a time. New audio automatically stops current audio:

```javascript
// User clicks button
await FeedbackManager.sound.play("tap", { subtitle: "Clicked" });

// User answers correctly - tap stops, correct plays
await FeedbackManager.sound.play("correct", { subtitle: "Correct!" });
```

### Pause/Resume with VisibilityTracker

```javascript
const tracker = new VisibilityTracker({
  onInactive: () => {
    FeedbackManager.sound.pause();     // Pause regular audio
    FeedbackManager.stream.pauseAll(); // Pause streaming audio
  },
  onResume: () => {
    FeedbackManager.sound.resume();      // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
  },
});
```

## Full Documentation

For complete API reference, type definitions, and advanced usage:
- [FeedbackManager Type Definitions](../types/feedback-manager.d.ts)
- [FeedbackManager Full Usage Guide](../types/feedback-manager-usage.md)
- [Component Props Reference](../reference/component-props.md)

## Related Components

- [SubtitleComponent](./subtitle-component.md) - Auto-loaded by FeedbackManager
- [VisibilityTracker](./visibility-tracker.md) - Pause/resume integration
