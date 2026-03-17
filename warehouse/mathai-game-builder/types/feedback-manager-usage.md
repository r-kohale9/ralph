# FeedbackManager Usage Guide

Complete guide for using FeedbackManager v3.0 - the unified feedback system for MathAI games.

## What is FeedbackManager?

**FeedbackManager** is a comprehensive feedback system that unifies:

- 🔊 **Audio** (regular + streaming)
- 📝 **Subtitles** (text feedback with markdown support)
- ✨ **Stickers** (Lottie animations)

All in one cohesive API with automatic timing and synchronization.

## Installation

Load FeedbackManager via CDN (single script tag):

```html
<!-- REQUIRED: Load FeedbackManager (includes all dependencies) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
```

FeedbackManager automatically loads:

- ogg-opus-decoder (for streaming audio)
- BufferedStreamReader (for stream handling)
- SubtitleComponent (for text feedback)
- StickerComponent (for Lottie stickers)
- PopupComponent (for audio permissions)

**⚠️ IMPORTANT: Do NOT load SubtitleComponent or StickerComponent separately!**

- SubtitleComponent and StickerComponent are internal dependencies loaded automatically
- Always pass subtitles and stickers as props when playing audio
- Never use `SubtitleComponent.show()` or `StickerComponent.show()` directly
- This ensures proper synchronization with audio playback

## 🚨 MANDATORY: Initialize FeedbackManager

**You MUST call `FeedbackManager.init()` once as soon as the DOM is rendered, before using any FeedbackManager features.**

```javascript
// Option 1: DOMContentLoaded event
document.addEventListener("DOMContentLoaded", async () => {
  await FeedbackManager.init();
  console.log("FeedbackManager initialized!");
});

// Option 2: In your game initialization
async function initGame() {
  await FeedbackManager.init();
  // Now you can preload audio, play sounds, etc.
}

// Option 3: Simple script at end of body
window.onload = async () => {
  await FeedbackManager.init();
};
```

**What does `init()` do?**

- Loads audio streaming components
- Loads subtitle component
- Loads sticker component
- Prepares the feedback system for use

**❌ Wrong - Will NOT work:**

```javascript
// Don't use FeedbackManager before init()!
await FeedbackManager.sound.play("tap"); // ❌ ERROR: Not initialized
```

**✅ Correct:**

```javascript
// Always init first!
await FeedbackManager.init();
await FeedbackManager.sound.play("tap"); // ✅ Works!
```

## What's New in v3.0

- 🎉 **Unified Feedback API**: Audio, subtitle, and sticker in one `play()` call
- ✨ **Auto-sync**: Subtitles and stickers automatically hide when audio ends
- 🎨 **Smart timing**: Feedback duration calculated from audio length
- 🔒 **Auto-unlock**: Shows permission popup when needed
- 🎯 **Priority system**: Control which audio is more important
- ⚡ **Lazy loading**: Subtitle and sticker components load on-demand

## Quick Start

### 1. Initialize FeedbackManager (MANDATORY)

```javascript
// First, initialize as soon as DOM is ready
await FeedbackManager.init();
```

### 2. Simple Feedback (Audio + Subtitle)

```javascript
// Just add subtitle to any audio play!
await FeedbackManager.sound.play("correct", {
  subtitle: "Great job!",
});
```

### 3. Full Feedback (Audio + Subtitle + Sticker)

```javascript
await FeedbackManager.sound.play("correct", {
  subtitle: "**Excellent!** You got it right!",
  sticker: "https://cdn.mathai.com/stickers/star.json",
});
```

That's it! FeedbackManager handles:

- Audio unlocking (with popup if needed)
- Subtitle display
- Sticker animation
- Auto-hiding when audio completes

## Complete Examples

### Example 1: Button Click with Feedback

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Button Feedback</title>
    <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  </head>
  <body>
    <button id="answer-btn">Submit Answer</button>

    <script>
      // Initialize and preload audio
      window.onload = async () => {
        // 🚨 MANDATORY: Initialize first!
        await FeedbackManager.init();

        // Then preload audio
        await FeedbackManager.sound.preload([
          { id: "tap", url: "https://example.com/tap.mp3" },
          { id: "correct", url: "https://example.com/correct.mp3" },
        ]);
      };

      // Play with feedback - NO manual unlock needed!
      document.getElementById("answer-btn").onclick = async () => {
        // Tap sound with simple subtitle
        await FeedbackManager.sound.play("tap", {
          subtitle: "Checking answer...",
        });

        // Simulate answer check
        const isCorrect = Math.random() > 0.5;

        if (isCorrect) {
          // Correct answer with full feedback
          await FeedbackManager.sound.play("correct", {
            subtitle: {
              text: "**Perfect!** You got it right!",
              duration: 3,
            },
            sticker: {
              image:
                "https://cdn.mathai.ai/mathai-assets/lottie/star-sparkle.json",
              loop: false,
              duration: 3,
              type: "IMAGE_GIF",
            },
            priority: 10, // High priority - won't be interrupted
          });
        }
      };
    </script>
  </body>
</html>
```

### Example 2: Quiz Game with Detailed Feedback

```javascript
// Game state
let currentQuestion = 0;
let score = 0;

// Preload feedback assets
const feedbackAssets = [
  { id: "tap", url: "https://cdn.mathai.com/audio/tap.mp3" },
  { id: "correct", url: "https://cdn.mathai.com/audio/correct.mp3" },
  { id: "incorrect", url: "https://cdn.mathai.com/audio/incorrect.mp3" },
  { id: "completion", url: "https://cdn.mathai.com/audio/completion.mp3" },
];

window.onload = async () => {
  // 🚨 MANDATORY: Initialize first!
  await FeedbackManager.init();

  // Then preload audio
  await FeedbackManager.sound.preload(feedbackAssets);
  console.log("Feedback system ready!");
};

function submitAnswer(userAnswer, correctAnswer) {
  // Play tap feedback immediately
  FeedbackManager.sound.play("tap", {
    subtitle: "Checking...",
    priority: 5,
  });

  // Check answer after short delay
  setTimeout(async () => {
    if (userAnswer === correctAnswer) {
      score++;

      // Correct answer with celebration
      await FeedbackManager.sound.play("correct", {
        subtitle: {
          text: "**Correct!** Well done! 🎉",
          duration: 3,
        },
        sticker: {
          image: "https://cdn.mathai.ai/mathai-assets/lottie/trophy.json",
          duration: 3,
          loop: false,
          type: "IMAGE_GIF",
        },
        priority: 10,
      });

      nextQuestion();
    } else {
      // Incorrect answer with encouragement
      await FeedbackManager.sound.play("incorrect", {
        subtitle: {
          text: `Not quite. The answer was **${correctAnswer}**`,
          duration: 4,
        },
        sticker: {
          image: "https://cdn.mathai.ai/mathai-assets/lottie/thinking.json",
          duration: 4,
          loop: false,
          type: "IMAGE_GIF",
        },
        priority: 10,
      });

      nextQuestion();
    }
  }, 500);
}

function nextQuestion() {
  currentQuestion++;
  if (currentQuestion >= 10) {
    showGameComplete();
  } else {
    loadQuestion(currentQuestion);
  }
}

async function showGameComplete() {
  const accuracy = Math.round((score / 10) * 100);

  // Dynamic completion feedback
  const text = `Congratulations! You scored ${score}/10 with ${accuracy}% accuracy!`;

  await FeedbackManager.sound.play("completion", {
    subtitle: {
      text: `**Game Complete!**\n${text}`,
      duration: 5,
    },
    sticker: {
      image: "https://cdn.mathai.ai/mathai-assets/lottie/trophy-shine.json",
      duration: 5,
      loop: false,
      type: "IMAGE_GIF",
    },
    priority: 100, // Critical - never interrupt
  });

  // Submit results after feedback
  setTimeout(() => {
    submitResults({ score, total: 10, accuracy });
  }, 5000);
}
```

### Example 3: Dynamic Audio with Feedback

```javascript
/**
 * Generate dynamic audio using MathAI API with integrated feedback
 * Uses the simplified playDynamicFeedback method
 */
async function showDynamicFeedback(text, sticker = null, subtitle = null) {
  try {
    // ✅ NEW SIMPLIFIED METHOD - Handles both cached and streaming automatically
    await FeedbackManager.playDynamicFeedback({
      audio_content: text,
      subtitle: subtitle || text, // Use custom subtitle or fallback to text
      sticker: sticker,
    });

    console.log("✅ Dynamic feedback played successfully");
  } catch (error) {
    console.error("❌ Failed to play dynamic feedback:", error);
  }
}

// Usage examples

// Audio only
showDynamicFeedback("Great job! You completed that in 3.5 seconds!");

// Audio + Sticker
showDynamicFeedback(
  "Congratulations! You got all 10 problems correct!",
  "https://cdn.mathai.com/stickers/trophy-shine.json"
);

// Audio + Subtitle + Sticker (with custom subtitle)
showDynamicFeedback(
  "You scored 95 percent!",
  "https://cdn.mathai.com/stickers/trophy.json",
  "Amazing! You scored 95%!"
);
```

### Example 4: Timed Challenge with Multiple Feedback Types

```javascript
let gameTimer;
let currentScore = 0;

async function startTimedChallenge() {
  // Start game announcement
  await FeedbackManager.sound.play("start-sound", {
    subtitle: {
      text: "**Ready?** Answer as many as you can in 60 seconds!",
      duration: 3,
    },
    sticker: {
      image: "https://cdn.mathai.ai/mathai-assets/lottie/countdown.json",
      duration: 3,
      loop: false,
      type: "IMAGE_GIF",
    },
    priority: 100,
  });

  // Start timer after announcement
  setTimeout(() => {
    startTimer(60);
    loadQuestion();
  }, 3000);
}

async function checkAnswer(userAnswer, correctAnswer, timeSpent) {
  if (userAnswer === correctAnswer) {
    currentScore++;

    // Fast answer bonus
    if (timeSpent < 5) {
      await FeedbackManager.sound.play("excellent", {
        subtitle: {
          text: `**Lightning fast!** +2 points! ⚡`,
          duration: 2,
        },
        sticker: {
          image: "https://cdn.mathai.ai/mathai-assets/lottie/lightning.json",
          duration: 2,
          loop: false,
          type: "IMAGE_GIF",
        },
        priority: 10,
      });
      currentScore++; // Bonus point
    } else {
      await FeedbackManager.sound.play("correct", {
        subtitle: "Correct! +1 point",
        priority: 10,
      });
    }
  } else {
    await FeedbackManager.sound.play("incorrect", {
      subtitle: {
        text: `The answer was **${correctAnswer}**`,
        duration: 2,
      },
      priority: 10,
    });
  }

  loadQuestion();
}

async function endTimedChallenge() {
  clearInterval(gameTimer);

  // Calculate performance
  const performance =
    currentScore >= 15
      ? "Amazing!"
      : currentScore >= 10
      ? "Great!"
      : "Good effort!";

  await FeedbackManager.sound.play("completion", {
    subtitle: {
      text: `**Time's up!**\n${performance}\nYou scored ${currentScore} points!`,
      duration: 5,
    },
    sticker: {
      image:
        currentScore >= 15
          ? "https://cdn.mathai.ai/mathai-assets/lottie/trophy-gold.json"
          : "https://cdn.mathai.ai/mathai-assets/lottie/trophy.json",
      duration: 5,
      loop: false,
      type: "IMAGE_GIF",
    },
    priority: 100,
  });
}
```

## Unified Feedback API

### Audio + Subtitle

```javascript
// Simple text subtitle
await FeedbackManager.sound.play("correct", {
  subtitle: "Great job!",
});

// Markdown subtitle with custom duration
await FeedbackManager.sound.play("correct", {
  subtitle: {
    text: "**Excellent!** You got it *perfectly* right!",
    duration: 4, // Override auto-calculated duration
  },
});

// Subtitle with analytics
await FeedbackManager.sound.play("correct", {
  subtitle: {
    text: "Question complete!",
    id: "q5",
    title: "Multiplication Level 1",
  },
});
```

### Audio + Sticker

```javascript
// Simple sticker
await FeedbackManager.sound.play("correct", {
  sticker: "https://cdn.mathai.com/stickers/star.json",
});

// Sticker with custom options
await FeedbackManager.sound.play("correct", {
  sticker: {
    image: "https://cdn.mathai.ai/mathai-assets/lottie/confetti.json",
    loop: false,
    duration: 3,
    type: "IMAGE_GIF",
  },
});
```

### Audio + Subtitle + Sticker

```javascript
// Complete feedback experience
await FeedbackManager.sound.play("achievement", {
  subtitle: {
    text: "**Level Up!** You reached Level 5! 🎉",
    duration: 4,
  },
  sticker: {
    image: "https://cdn.mathai.ai/mathai-assets/lottie/level-up.json",
    loop: false,
    duration: 4,
    type: "IMAGE_GIF",
  },
  volume: 0.9,
  priority: 50,
});
```

## Priority-Based Feedback

Control which feedback is more important:

```javascript
// Low priority - can be interrupted
await FeedbackManager.sound.play("ambient", {
  subtitle: "Background music playing",
  priority: 0,
});

// Medium priority - UI feedback
await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked",
  priority: 5,
});

// High priority - answer feedback
await FeedbackManager.sound.play("correct", {
  subtitle: "**Correct!**",
  sticker: "https://cdn.mathai.com/stickers/checkmark.json",
  priority: 10,
});

// Critical priority - game completion
await FeedbackManager.sound.play("game-complete", {
  subtitle: {
    text: "**Game Complete!** Amazing work!",
    duration: 5,
  },
  sticker: {
    image: "https://cdn.mathai.ai/mathai-assets/lottie/trophy-shine.json",
    duration: 5,
    loop: false,
    type: "IMAGE_GIF",
  },
  priority: 100, // Never interrupted
});
```

## Streaming Audio with Feedback

```javascript
// Add stream
await FeedbackManager.stream.addFromResponse("dynamic-feedback", response);

// Play with subtitle and sticker
FeedbackManager.stream.play(
  "dynamic-feedback",
  {
    complete: () => {
      console.log("Feedback complete");
    },
    error: (msg) => console.error("Error:", msg),
  },
  {
    subtitle: {
      text: "Congratulations on completing the game!",
      duration: 10, // For streams, explicitly set duration
    },
    sticker: {
      image: "https://cdn.mathai.ai/mathai-assets/lottie/celebration.json",
      duration: 10,
      loop: false,
      type: "IMAGE_GIF",
    },
    timeout: 30000,
  }
);
```

## Permission Management

### Auto-Popup (Default)

```javascript
// Just play - popup shows automatically if needed!
await FeedbackManager.sound.play("tap", {
  subtitle: "Welcome!",
});
```

### Custom Popup

```javascript
// Show custom popup before game starts
if (FeedbackManager.needsUnlock()) {
  await FeedbackManager.requestPermission({
    title: "Enable Game Audio & Effects",
    description: "This game includes sound effects and visual feedback",
    primaryText: "Let's Play!",
    icon: "https://cdn.mathai.com/icons/game-audio.json",
  });
}

// Now play feedback
await FeedbackManager.sound.play("start", {
  subtitle: "Game starting!",
  sticker: "https://cdn.mathai.com/stickers/start.json",
});
```

### Silent Mode

```javascript
// Disable popup for specific play
await FeedbackManager.sound.play("background-music", {
  subtitle: "Music playing",
  showPopup: false, // Never show popup for this
});
```

## Feedback Components Manager

### Manual Component Control

```javascript
// Pre-load feedback components during game initialization
await FeedbackManager.feedback.loadAll();

// Check what's loaded
console.log("Subtitle loaded:", FeedbackManager.feedback.subtitleLoaded);
console.log("Sticker loaded:", FeedbackManager.feedback.stickerLoaded);

// Show subtitle directly (without audio)
FeedbackManager.feedback.showSubtitle({
  text: "Loading game...",
  duration: 3,
});

// Show sticker directly (without audio)
FeedbackManager.feedback.showSticker({
  sticker: "https://cdn.mathai.com/stickers/loading.json",
  duration: 3,
  loop: true,
});

// Hide all feedback
FeedbackManager.feedback.hideAll();
```

### Combined Manual Feedback

```javascript
// Show subtitle + sticker without audio
const result = FeedbackManager.feedback.showFeedback(
  {
    subtitle: "Game paused",
    sticker: "https://cdn.mathai.com/stickers/pause.json",
  },
  5
); // 5 second duration

console.log("Feedback shown:", result);
// { subtitle: true, sticker: true, duration: 5 }

// Hide after some time
setTimeout(() => {
  FeedbackManager.feedback.hideAll();
}, 5000);
```

## Best Practices

### 1. Always Initialize and Preload Audio

```javascript
// ✅ GOOD - Initialize and preload during page load
window.onload = async () => {
  // Initialize first!
  await FeedbackManager.init();

  // Then preload audio
  await FeedbackManager.sound.preload([
    { id: "tap", url: "https://cdn.mathai.com/audio/tap.mp3" },
    { id: "correct", url: "https://cdn.mathai.com/audio/correct.mp3" },
  ]);
};

// ❌ BAD - Load on demand (causes delays)
button.onclick = async () => {
  await FeedbackManager.sound.preload([{ id: "tap", url: "..." }]);
  await FeedbackManager.sound.play("tap");
};
```

### 2. Use Appropriate Priorities

```javascript
// ✅ GOOD - Important feedback has higher priority
await FeedbackManager.sound.play("correct", {
  subtitle: "Correct!",
  priority: 10, // Won't be interrupted by tap sounds
});

// ❌ BAD - All feedback same priority
await FeedbackManager.sound.play("correct", {
  subtitle: "Correct!",
  // priority: 0 (default) - can be interrupted
});
```

### 3. Keep Subtitles Concise

```javascript
// ✅ GOOD - Short, clear subtitle
await FeedbackManager.sound.play("correct", {
  subtitle: "**Correct!** +10 points",
});

// ❌ BAD - Too long, users won't read it
await FeedbackManager.sound.play("correct", {
  subtitle:
    "Congratulations! You have answered this question correctly and earned 10 points. Great job! Keep up the good work!",
});
```

### 4. Match Feedback to Context

```javascript
// ✅ GOOD - Sticker matches the feedback type
await FeedbackManager.sound.play("excellent", {
  subtitle: "**Perfect!** 100% accuracy!",
  sticker: "https://cdn.mathai.com/stickers/trophy-gold.json",
});

// ❌ BAD - Confusing sticker choice
await FeedbackManager.sound.play("incorrect", {
  subtitle: "Wrong answer",
  sticker: "https://cdn.mathai.com/stickers/party.json", // ❌ Celebratory for wrong answer?
});
```

### 5. Handle Errors Gracefully

```javascript
// ✅ GOOD - Check result status
const result = await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked",
});

if (result.status !== "ok") {
  console.warn("Feedback failed:", result);
  // Continue game anyway - don't block on feedback failure
}

// ❌ BAD - Assume success
await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked",
});
// No error handling - game might break if feedback fails
```

## Backward Compatibility

FeedbackManager maintains backward compatibility with AudioKit:

```javascript
// ✅ Old code still works
await AudioKit.sound.play("tap");
await AudioKit.unlock();

// ✅ New code recommended
await FeedbackManager.sound.play("tap", {
  subtitle: "Button clicked",
});
await FeedbackManager.unlock();
```

**Both work!** But FeedbackManager is the recommended name going forward.

## Migration from AudioKit

### ❌ Before (AudioKit only - DEPRECATED)

```javascript
// ❌ OLD WAY - separate systems (NOT RECOMMENDED)
await AudioKit.sound.play("correct");

// ❌ WRONG - VERIFY: No direct SubtitleComponent.show() usage
SubtitleComponent.show({
  text: "Great job!",
  duration: 3,
});

// ❌ WRONG - Manual sticker management
StickerComponent.show({
  sticker: "https://cdn.mathai.com/stickers/star.json",
  duration: 3,
});
```

**⚠️ Problems with the old approach:**

- No synchronization between audio, subtitle, and sticker
- Manual duration management required
- Subtitle/sticker don't auto-hide when audio completes
- More code to write and maintain

### ✅ After (FeedbackManager unified - RECOMMENDED)

```javascript
// ✅ NEW WAY - unified API (RECOMMENDED)
await FeedbackManager.sound.play("correct", {
  subtitle: "Great job!",
  sticker: "https://cdn.mathai.com/stickers/star.json",
  // Duration auto-calculated from audio!
  // Everything synchronized automatically!
});
```

**✅ Benefits of the new approach:**

- Auto-synchronized - subtitle and sticker hide when audio completes
- Smart duration - calculated from audio length automatically
- Less code - one API call does everything
- Better UX - everything perfectly timed
- Auto-cleanup when audio ends
- Single API to learn

## Troubleshooting

| Issue                | Cause                           | Fix                                                            |
| -------------------- | ------------------------------- | -------------------------------------------------------------- |
| Subtitle not showing | Component not loaded            | Call `FeedbackManager.feedback.loadSubtitle()` or use `init()` |
| Sticker not showing  | Lottie player not loaded        | Call `FeedbackManager.feedback.loadSticker()` or use `init()`  |
| Audio locked error   | User hasn't interacted          | FeedbackManager auto-shows popup - or call `unlock()` manually |
| Feedback not hiding  | Audio error/timeout             | FeedbackManager auto-hides on errors                           |
| Wrong duration       | Subtitle/sticker too short/long | Set explicit `duration` in options                             |

## Advanced Usage

### Pre-load All Components

```javascript
// During game initialization - load everything
await FeedbackManager.init();

// Now all components are ready
await FeedbackManager.sound.play("start", {
  subtitle: "Game starting!",
  sticker: "https://cdn.mathai.com/stickers/start.json",
});
```

### Custom Feedback Timing

```javascript
// Override auto-calculated duration
await FeedbackManager.sound.play("short-sound", {
  subtitle: {
    text: "This stays longer than the audio",
    duration: 10, // Explicit 10 seconds
  },
  sticker: {
    image: "https://cdn.mathai.ai/mathai-assets/lottie/thinking.json",
    duration: 10, // Match subtitle duration
    loop: false,
    type: "IMAGE_GIF",
  },
});
```

### Feedback-Only (No Audio)

```javascript
// Show feedback without playing audio
FeedbackManager.feedback.showFeedback(
  {
    subtitle: "Game paused",
    sticker: "https://cdn.mathai.com/stickers/pause.json",
  },
  5
); // 5 second duration
```

## See Also

- **Timer Component**: For time-based game mechanics
- **Game Builder Skill**: Complete game creation guide
- **Type Definitions**: `types/feedback-manager.d.ts` for TypeScript support
