# Debug Functions

Always include these debug functions in your game for testing and troubleshooting.

## Overview

Debug functions help you:
- Test individual audio files
- Verify URL accessibility
- Check AudioKit state
- Debug game state
- Troubleshoot issues quickly

**Quick Access:**
All functions are available in browser console via `window.functionName()`.

## testAudio()

Test individual audio feedback.

**Usage:**
```javascript
window.testAudio(feedbackType = "tap")
```

**Parameters:**
- `feedbackType` (string) - The feedback type to test (default: "tap")

**Examples:**
```javascript
// Test tap sound
testAudio("tap");

// Test correct answer sound
testAudio("correct");

// Test incorrect answer sound
testAudio("incorrect");

// Test custom feedback
testAudio("celebration");
```

**Complete Implementation:**
```javascript
window.testAudio = async function (feedbackType = "tap") {
  console.log("🧪 Testing audio:", feedbackType);
  await AudioKit.unlock();

  if (feedbackAssets[feedbackType]) {
    AudioKit.sound.play(feedbackType);
    console.log("✅ Playing:", feedbackType);
  } else {
    console.error("❌ Unknown feedback type");
    console.log("Available types:", Object.keys(feedbackAssets));
  }
};
```

**Expected Output:**
```
🧪 Testing audio: tap
✅ Playing: tap
```

**Error Output:**
```
🧪 Testing audio: invalid
❌ Unknown feedback type
Available types: ["tap", "correct", "incorrect", "celebration"]
```

## testAudioUrls()

Test URL accessibility for all audio files.

**Usage:**
```javascript
window.testAudioUrls()
```

**Parameters:**
None

**Example:**
```javascript
testAudioUrls();
```

**Complete Implementation:**
```javascript
window.testAudioUrls = async function () {
  console.log("🔍 Testing URL accessibility...");
  const results = [];

  for (const [name, config] of Object.entries(feedbackAssets)) {
    const url = typeof config === "string" ? config : config.audio;
    try {
      const response = await fetch(url, { method: "HEAD" });
      results.push({
        name,
        url,
        status: response.status,
        ok: response.ok,
      });
    } catch (error) {
      results.push({
        name,
        url,
        error: error.message,
      });
    }
  }

  console.log("📊 URL Test Results:", JSON.stringify(results, null, 2));
};
```

**Expected Output:**
```json
🔍 Testing URL accessibility...
📊 URL Test Results: [
  {
    "name": "tap",
    "url": "https://storage.googleapis.com/.../tap.mp3",
    "status": 200,
    "ok": true
  },
  {
    "name": "correct",
    "url": "https://storage.googleapis.com/.../correct.mp3",
    "status": 200,
    "ok": true
  },
  {
    "name": "incorrect",
    "url": "https://storage.googleapis.com/.../incorrect.mp3",
    "status": 200,
    "ok": true
  }
]
```

**Error Output:**
```json
📊 URL Test Results: [
  {
    "name": "tap",
    "url": "https://invalid-url.com/tap.mp3",
    "error": "Failed to fetch"
  }
]
```

## debugAudio()

Debug AudioKit state for sound and stream systems.

**Usage:**
```javascript
window.debugAudio()
```

**Parameters:**
None

**Example:**
```javascript
debugAudio();
```

**Complete Implementation:**
```javascript
window.debugAudio = function () {
  const soundState = AudioKit.sound.getState();
  const streamState = AudioKit.stream.getState();
  console.log(
    "🎵 AudioKit State:",
    JSON.stringify(
      {
        sound: soundState,
        stream: streamState,
      },
      null,
      2
    )
  );
};
```

**Expected Output:**
```json
🎵 AudioKit State: {
  "sound": {
    "unlocked": true,
    "preloaded": ["tap", "correct", "incorrect"],
    "playing": null,
    "volume": 1
  },
  "stream": {
    "initialized": true,
    "cached": ["celebration_1", "celebration_2"],
    "playing": null
  }
}
```

**When Audio Not Unlocked:**
```json
🎵 AudioKit State: {
  "sound": {
    "unlocked": false,
    "preloaded": [],
    "playing": null,
    "volume": 1
  },
  "stream": {
    "initialized": false,
    "cached": [],
    "playing": null
  }
}
```

## debugGame()

Debug current game state.

**Usage:**
```javascript
window.debugGame()
```

**Parameters:**
None

**Example:**
```javascript
debugGame();
```

**Complete Implementation:**
```javascript
window.debugGame = function () {
  console.log(
    "🎮 Game State:",
    JSON.stringify(
      {
        currentRound,
        attempts: attempts.length,
        events: events.length,
      },
      null,
      2
    )
  );
};
```

**Expected Output:**
```json
🎮 Game State: {
  "currentRound": 3,
  "attempts": 5,
  "events": 18
}
```

**Note:** Customize this function based on your game's state variables. Include relevant data like:
- Current round/level
- Score
- Time remaining
- Attempts count
- Events count
- Any game-specific state

## Usage Examples

### Basic Testing Workflow

```javascript
// 1. Test all audio URLs are accessible
testAudioUrls();
// Should show 200 OK for all URLs

// 2. Test each audio file plays
testAudio("tap");
testAudio("correct");
testAudio("incorrect");

// 3. Check AudioKit state
debugAudio();
// Should show unlocked: true, preloaded audio

// 4. Check game state
debugGame();
// Should show current game variables
```

### Troubleshooting Audio Issues

```javascript
// Audio not playing?

// Step 1: Check URLs are accessible
testAudioUrls();
// Look for any 404 errors or failed fetches

// Step 2: Check AudioKit is unlocked
debugAudio();
// If unlocked: false, audio won't play (user must interact first)

// Step 3: Test specific audio
testAudio("tap");
// If this works, your audio setup is correct
```

### Debugging Game State

```javascript
// Game behaving unexpectedly?

// Check current state
debugGame();

// After each interaction, check again
// Click button...
debugGame();

// Compare before/after to see what changed
```

### Monitoring During Gameplay

```javascript
// Add debug calls at key points

function handleAnswer(answer) {
  console.log("🔍 Before answer:", debugGame());

  // Process answer...

  console.log("🔍 After answer:", debugGame());
}
```

## Integration Tips

### Where to Add Debug Functions

Place debug functions after your main game code but before closing `</script>`:

```html
<script>
  // Main game code
  let currentRound = 0;
  let attempts = [];
  let events = [];

  // ... rest of game code ...

  // Debug functions (at end)
  window.testAudio = async function (feedbackType = "tap") {
    // ... implementation ...
  };

  window.testAudioUrls = async function () {
    // ... implementation ...
  };

  window.debugAudio = function () {
    // ... implementation ...
  };

  window.debugGame = function () {
    // ... implementation ...
  };
</script>
```

### Console Logging Standards

**ALWAYS use JSON.stringify with proper formatting:**

```javascript
// ✅ GOOD
console.log("🎮 Game State:", JSON.stringify(gameState, null, 2));

// ❌ BAD
console.log("Game State:", gameState);
```

**Why?**
- Proper formatting makes objects readable
- Prevents `[object Object]` in console
- Shows nested structures clearly
- Makes debugging faster

### Initialization Logs

Add logs in `window.onload` to verify setup:

```javascript
window.onload = async () => {
  console.log("🎮 Game Initialized");
  console.log("📦 Feedback Assets:", JSON.stringify(Object.keys(feedbackAssets), null, 2));

  // Preload audio
  await AudioKit.sound.preload(feedbackAssets);
  console.log("✅ Audio preloaded");

  // Start game...
};
```

## Common Issues & Fixes

| Issue | Debug Command | What to Look For | Fix |
|-------|---------------|------------------|-----|
| Audio not playing | `debugAudio()` | `unlocked: false` | Call `AudioKit.unlock()` on first interaction |
| Audio URLs failing | `testAudioUrls()` | `status: 404` or `error` | Check URLs are correct and accessible |
| Specific audio broken | `testAudio('type')` | Console errors | Verify audio file exists and format is correct |
| Game state incorrect | `debugGame()` | Unexpected values | Check state updates in your code |
| Events not tracking | `debugGame()` | `events: 0` | Verify EventTracker.track() is called |

## Best Practices

1. **Test early** - Run `testAudioUrls()` as soon as you integrate feedback
2. **Test often** - Use `testAudio()` after any audio changes
3. **Monitor state** - Call `debugGame()` when behavior is unexpected
4. **Check console** - Keep browser console open during development
5. **Use JSON.stringify** - Always format object logs properly
6. **Document custom state** - Update `debugGame()` to include your game's specific variables
7. **Include in all games** - These functions are essential for testing and support
