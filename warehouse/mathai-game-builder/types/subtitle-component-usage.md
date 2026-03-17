# SubtitleComponent Usage Guide

Complete guide for displaying feedback and subtitles in MathAI games.

## Installation

Load SubtitleComponent via CDN (single script tag):

```html
<!-- REQUIRED: Load Components package (includes SubtitleComponent) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

That's it! SubtitleComponent is ready to use globally.

## Quick Start

### Basic Usage

```javascript
// Show a simple subtitle
SubtitleComponent.show({
  text: "Great job!",
  duration: 3  // seconds
});

// Hide manually
SubtitleComponent.hide();
```

### With Markdown Formatting

SubtitleComponent supports markdown-style formatting:

```javascript
SubtitleComponent.show({
  text: "**Great job!** You got it *right* ✨",
  duration: 3
});

// Supported markdown:
// **bold** or __bold__
// *italic* or _italic_
// [link text](url)
// \n for line breaks
```

## Complete Examples

### Example 1: Basic Feedback in Games

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Game with Feedback</title>

  <!-- Load Components package -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
</head>
<body>
  <button id="answer-btn">Submit Answer</button>
  <div id="subtitle"></div>

  <script>
    function checkAnswer(userAnswer, correctAnswer) {
      const correct = userAnswer === correctAnswer;

      if (correct) {
        SubtitleComponent.show({
          text: "**Excellent!** That's correct ✓",
          duration: 2
        });
      } else {
        SubtitleComponent.show({
          text: "Not quite. Try again!",
          duration: 2
        });
      }

      return correct;
    }

    document.getElementById('answer-btn').onclick = () => {
      const correct = checkAnswer(userInput, 42);
      if (correct) {
        // Move to next question
      }
    };
  </script>
</body>
</html>
```

### Example 2: With Audio Feedback

Combine SubtitleComponent with AudioKit:

```javascript
async function showFeedback(feedbackKey) {
  const feedback = feedbackAssets[feedbackKey];
  if (!feedback) return;

  // Play audio
  AudioKit.sound.play(feedbackKey);

  // Show subtitle
  if (feedback.subtitle) {
    SubtitleComponent.show({
      text: feedback.subtitle,
      duration: 2
    });
  }

  // Show sticker if present
  if (feedback.sticker) {
    lottie.loadAnimation({
      container: document.getElementById('sticker-container'),
      path: feedback.sticker.url,
      loop: false,
      autoplay: true
    });
  }
}

// Usage
showFeedback('correct');  // Plays audio + shows subtitle + shows sticker
showFeedback('tap');      // Just plays audio (no subtitle configured)
```

### Example 3: Dynamic Feedback with Variables

```javascript
async function showGameCompletion(score, total, timeSeconds) {
  const accuracy = Math.round((score / total) * 100);

  // Generate dynamic audio with subtitle and sticker
  const text = `**Congratulations!** You got ${score} out of ${total} correct with ${accuracy}% accuracy!`;

  // ✅ Use simplified method - handles everything automatically
  await FeedbackManager.playDynamicFeedback({
    audio_content: text,
    subtitle: text,
    sticker: "https://cdn.mathai.com/stickers/trophy-shine.json",
  });

  // Navigate to next screen after feedback completes
  showResultsScreen();
}

// Usage
showGameCompletion(8, 10, 125);
```

### Example 4: Sequential Subtitles

```javascript
async function showInstructions() {
  SubtitleComponent.show({
    text: "Welcome to the game!",
    duration: 2
  });

  await sleep(2500);

  SubtitleComponent.show({
    text: "Tap the correct answer",
    duration: 2
  });

  await sleep(2500);

  SubtitleComponent.show({
    text: "Let's begin! ✨",
    duration: 2,
    onHide: () => {
      startGame();
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Example 5: Update Subtitle Dynamically

```javascript
function showProgressFeedback(current, total) {
  SubtitleComponent.show({
    text: `Question ${current} of ${total}`,
    duration: 10  // Long duration
  });
}

function updateProgress(current, total) {
  if (SubtitleComponent.isShowing()) {
    SubtitleComponent.updateText(`Question ${current} of ${total}`);
  }
}

// Usage
showProgressFeedback(1, 10);
// User answers question
updateProgress(2, 10);  // Updates text without hiding/re-showing
```

## Advanced Configuration

### Configure with Callbacks

```javascript
// Configure once at game initialization
SubtitleComponent.configure({
  // Custom text renderer
  renderer: (text) => {
    // Add custom formatting
    return text
      .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  // Logging callback
  dumpLogs: (data) => {
    console.log('Subtitle log:', data);
  },

  // Mixpanel tracking
  mixpanelTrack: (event, props) => {
    if (window.mixpanel) {
      mixpanel.track(event, props);
    }
  },

  // Global onShow callback
  onShow: (feedback) => {
    console.log('Subtitle shown:', feedback.text);
  },

  // Global onHide callback
  onHide: (feedback) => {
    console.log('Subtitle hidden:', feedback?.text);
  },

  // Custom positioning
  position: {
    bottom: '80px',    // Distance from bottom
    maxWidth: '320px'  // Maximum width
  }
});

// Now use normally
SubtitleComponent.show({
  text: "Hello world!"
});
```

### Multiple Independent Instances

```javascript
// Create separate instances for different purposes
const hintSubtitle = SubtitleComponent.create({
  position: { bottom: '20px', maxWidth: '200px' }
});

const feedbackSubtitle = SubtitleComponent.create({
  position: { bottom: '80px', maxWidth: '300px' }
});

// Use independently
hintSubtitle.show({ text: "Hint: Think about addition", duration: 3 });
feedbackSubtitle.show({ text: "**Correct!**", duration: 2 });
```

## API Reference

### Global Methods (Singleton)

| Method | Description |
|--------|-------------|
| `show(options)` | Show a subtitle |
| `hide()` | Hide the subtitle |
| `clearTimeout()` | Clear auto-hide timeout |
| `extendDuration(seconds)` | Extend display duration |
| `updateText(text)` | Update subtitle text |
| `getState()` | Get current state |
| `isShowing()` | Check if visible |
| `configure(config)` | Configure instance |
| `destroy()` | Destroy instance |

### Show Options

```typescript
{
  text: string;          // Subtitle text (supports markdown)
  duration?: number;     // Duration in seconds (default: 3)
  onHide?: () => void;   // Callback when hidden
  id?: string;           // Activity ID (for analytics)
  title?: string;        // Activity title (for analytics)
}
```

### Configuration Options

```typescript
{
  renderer?: (text: string) => string;  // Custom text renderer
  dumpLogs?: (data) => void;            // Logging callback
  mixpanelTrack?: (event, props) => void; // Analytics tracking
  evaluationArea?: () => string;        // Skip player_2 in multiplayer
  onShow?: (feedback) => void;          // Global show callback
  onHide?: (feedback) => void;          // Global hide callback
  position?: {
    bottom?: string;    // CSS bottom value (default: "60px")
    maxWidth?: string;  // CSS max-width (default: "280px")
  }
}
```

### State Object

```typescript
{
  isVisible: boolean;           // Whether subtitle is visible
  currentFeedback: {            // Current feedback data (null if not visible)
    text: string;
    duration: number;
    onHide: (() => void) | null;
    id: string | null;
    title: string | null;
  } | null;
  timeElapsed: number;          // Milliseconds since shown
}
```

## Common Patterns

### Pattern 1: Simple Feedback

```javascript
// Correct answer
SubtitleComponent.show({
  text: "**Excellent!** ✨",
  duration: 2
});

// Incorrect answer
SubtitleComponent.show({
  text: "Try again!",
  duration: 2
});
```

### Pattern 2: Feedback with Callback

```javascript
SubtitleComponent.show({
  text: "Loading next question...",
  duration: 2,
  onHide: () => {
    loadNextQuestion();
  }
});
```

### Pattern 3: Long Message with Extension

```javascript
// Show initial message
SubtitleComponent.show({
  text: "Reading question...",
  duration: 5
});

// User needs more time
setTimeout(() => {
  if (SubtitleComponent.isShowing()) {
    SubtitleComponent.extendDuration(3);  // Add 3 more seconds
  }
}, 4000);
```

### Pattern 4: Progress Updates

```javascript
function showProgress(current, total) {
  const text = `Question ${current} of ${total}`;

  if (SubtitleComponent.isShowing()) {
    SubtitleComponent.updateText(text);
  } else {
    SubtitleComponent.show({
      text: text,
      duration: 999  // Keep showing
    });
  }
}
```

### Pattern 5: Unified Feedback Function

```javascript
/**
 * Unified feedback function for games
 * Handles audio, subtitle, and sticker
 */
function showFeedback(feedbackKey) {
  const feedback = feedbackAssets[feedbackKey];
  if (!feedback) {
    console.error(`Unknown feedback: ${feedbackKey}`);
    return;
  }

  // Play audio using AudioKit
  AudioKit.sound.play(feedbackKey);

  // Show subtitle
  if (feedback.subtitle) {
    SubtitleComponent.show({
      text: feedback.subtitle,
      duration: 2
    });
  }

  // Show sticker
  if (feedback.sticker) {
    lottie.loadAnimation({
      container: document.getElementById('sticker-container'),
      path: feedback.sticker.url,
      loop: false,
      autoplay: true
    });
  }
}

// Define feedback assets
const feedbackAssets = {
  tap: {
    audio: 'https://storage.googleapis.com/.../tap.mp3'
    // No subtitle for tap sounds
  },
  correct: {
    audio: 'https://storage.googleapis.com/.../correct.mp3',
    subtitle: '**Great job!** ✨',
    sticker: {
      url: 'https://cdn.mathai.com/stickers/sparkle-star.json'
    }
  },
  incorrect: {
    audio: 'https://storage.googleapis.com/.../incorrect.mp3',
    subtitle: 'Try again!',
    sticker: null
  }
};

// Usage
showFeedback('correct');
```

## Markdown Formatting

SubtitleComponent supports these markdown styles:

```javascript
// Bold
"**bold text**"
"__bold text__"

// Italic
"*italic text*"
"_italic text_"

// Combined
"**Bold** and *italic* text"

// Links
"[Click here](https://example.com)"

// Line breaks
"Line 1\nLine 2"

// Emojis (just use directly)
"Great job! ✨🎉"
```

## Special Features

### Anomaly Detection

SubtitleComponent logs when subtitles are hidden too quickly (< 2 seconds):

```javascript
SubtitleComponent.configure({
  dumpLogs: (data) => {
    if (data.action === 'hide_feedback_anomaly') {
      console.warn('Subtitle hidden too quickly:', data.elapsed + 'ms');
    }
  }
});
```

### Mixpanel Integration

Auto-tracks "Taking longer than expected" messages:

```javascript
SubtitleComponent.configure({
  mixpanelTrack: (event, props) => {
    mixpanel.track(event, props);
  }
});

// This will trigger Mixpanel event automatically
SubtitleComponent.show({
  text: "Taking longer than expected. Please wait...",
  duration: 5,
  id: "activity_123",
  title: "Math Problem"
});
```

### Multiplayer Support

Skip player_2 in multiplayer games:

```javascript
SubtitleComponent.configure({
  evaluationArea: () => {
    return getCurrentPlayer();  // 'player_1' or 'player_2'
  }
});

// Subtitles will only show for player_1
```

## Debugging

### Check Current State

```javascript
const state = SubtitleComponent.getState();
console.log('Is visible:', state.isVisible);
console.log('Current text:', state.currentFeedback?.text);
console.log('Time elapsed:', state.timeElapsed + 'ms');
```

### Test Subtitle Display

```javascript
// Test basic display
SubtitleComponent.show({
  text: "Test subtitle",
  duration: 2
});

// Test with callback
SubtitleComponent.show({
  text: "Test with callback",
  duration: 2,
  onHide: () => console.log('Hidden!')
});

// Test markdown
SubtitleComponent.show({
  text: "**Bold** and *italic* with ✨",
  duration: 3
});
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Subtitle not showing | Script not loaded | Verify `<script>` tag in HTML |
| Formatting not working | Text not using markdown | Use `**bold**` and `*italic*` syntax |
| Subtitle disappears too quickly | Duration too short | Increase `duration` value |
| Multiple subtitles overlap | Using multiple instances | Use singleton or coordinate timing |
| Callback not firing | Using wrong callback | Use per-subtitle `onHide` or global `onHide` |

## Best Practices

1. **Keep messages short** - 1-2 sentences maximum
2. **Use appropriate durations** - 2-3 seconds for simple messages, 4-5 for longer
3. **Use markdown sparingly** - Bold for emphasis only
4. **Coordinate with audio** - Match subtitle duration to audio length
5. **Handle edge cases** - Check `isShowing()` before updating
6. **Use callbacks wisely** - For navigation after feedback
7. **Test on devices** - Verify positioning on different screen sizes

## Integration with AudioKit

Combined example showing audio + subtitle:

```javascript
// 1. Configure both systems
SubtitleComponent.configure({
  position: { bottom: '60px', maxWidth: '280px' }
});

// 2. Define unified feedback
const feedbackAssets = {
  correct: {
    audio: 'url-to-audio.mp3',
    subtitle: '**Excellent!** ✨',
    sticker: { url: 'sticker-url.json' }
  }
};

// 3. Preload audio
window.onload = async () => {
  const audioList = Object.entries(feedbackAssets).map(([id, config]) => ({
    id,
    url: config.audio
  }));
  await AudioKit.sound.preload(audioList);
};

// 4. Unified feedback function
function showFeedback(key) {
  const feedback = feedbackAssets[key];

  // Play audio
  AudioKit.sound.play(key);

  // Show subtitle
  if (feedback.subtitle) {
    SubtitleComponent.show({
      text: feedback.subtitle,
      duration: 2
    });
  }

  // Show sticker
  if (feedback.sticker) {
    lottie.loadAnimation({
      container: document.getElementById('sticker-container'),
      path: feedback.sticker.url,
      loop: false,
      autoplay: true
    });
  }
}

// 5. Usage
button.onclick = async () => {
  await AudioKit.unlock();
  showFeedback('correct');
};
```

## TypeScript Support

SubtitleComponent includes full TypeScript definitions:

```typescript
// Type definitions available in:
// types/subtitle-component.d.ts

// Example with types
const options: SubtitleComponent.ShowOptions = {
  text: "**Great job!**",
  duration: 3,
  onHide: () => console.log('Hidden')
};

SubtitleComponent.show(options);

const state: SubtitleComponent.State | null = SubtitleComponent.getState();
if (state?.isVisible) {
  console.log('Showing:', state.currentFeedback?.text);
}
```

## Further Resources

- **Type Definitions**: `types/subtitle-component.d.ts`
- **SKILL.md**: Complete game development guide
- **AudioKit Usage**: `types/audio-kit-usage.md`
- **Live Demo**: Included in package (see demo HTML)
