# Troubleshooting Guide

## Common Errors

### "ENOENT: no such file or directory"

**Cause:** File path is not in an MCP-accessible directory.

**Problem:**
```javascript
// ❌ Wrong - Not MCP-accessible
/tmp/game.html
/home/claude/game.html
```

**Solution:**
```javascript
// ✅ Correct - Use MCP-accessible directory
/Users/the-hw-app/Documents/claude/game.html

// 1. Call filesystem:list_allowed_directories first
// 2. Save to one of the allowed directories
// 3. Provide full absolute path to user
```

**Prevention:**
- Always call `filesystem:list_allowed_directories` before writing files
- Use only allowed directories
- Provide absolute paths to users

---

### "No valid content sets found"

**Cause:** Game registered but no content sets created.

**Problem:**
```javascript
// Game registered in core service
registerGame(gameData);

// ❌ Missing: Create content set
// Without content, game won't load
```

**Solution:**
```javascript
// 1. Register game
await mathai_core__register_game(...);

// 2. Create content set (REQUIRED)
await mathai_core__create_content_set({
  gameId: "math-quiz-001",
  name: "Easy Addition",
  difficulty: "easy",
  content: {
    rounds: [
      { operand1: 2, operand2: 3, answer: 5 },
      { operand1: 4, operand2: 1, answer: 5 }
    ]
  }
});
```

**Prevention:**
- Always create at least one content set after registration
- Validate content against game's inputSchema
- Test with `mathai_core__test_game_with_content_set`

---

### "Schema validation failed"

**Cause:** Content doesn't match game's inputSchema.

**Problem:**
```javascript
// Game expects:
inputSchema: {
  type: "object",
  properties: {
    rounds: { type: "array" }
  },
  required: ["rounds"]
}

// Content provided:
{
  questions: [...]  // ❌ Wrong key, should be "rounds"
}
```

**Solution:**
```javascript
// 1. Check game's inputSchema
const game = await mathai_core__get_game({ gameId });
console.log(game.inputSchema);

// 2. Match content structure exactly
const content = {
  rounds: [  // ✅ Matches "rounds" in schema
    { operand1: 5, operand2: 3, answer: 15 }
  ]
};

// 3. Validate before creating
await mathai_core__validate_content_against_schema({
  gameId: "math-quiz-001",
  content: content
});
```

**Prevention:**
- Always review inputSchema before creating content
- Use `validate_content_against_schema` before submission
- Test content with actual game

---

## Audio Issues

### "NotAllowedError: play() failed"

**Cause:** Audio context not unlocked. Browsers block autoplay until user interaction.

**Problem:**
```javascript
// ❌ Trying to play before user interaction
window.addEventListener('load', () => {
  audio.play();  // Blocked by browser!
});
```

**Solution:**
```javascript
// ✅ Unlock on first user interaction
let audioUnlocked = false;

async function unlockAudio() {
  if (!audioUnlocked) {
    await FeedbackManager.init();  // Unlocks audio context
    audioUnlocked = true;
    console.log('✅ Audio unlocked');
  }
}

// Call on first interaction
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });
```

**Prevention:**
- Always use FeedbackManager (handles unlock automatically)
- Call `FeedbackManager.init()` on first user interaction
- Never use `new Audio()` directly

---

### "CORS policy error"

**Cause:** Audio loaded without `crossorigin` attribute.

**Problem:**
```html
<!-- ❌ Missing crossorigin attribute -->
<audio src="https://storage.googleapis.com/audio.mp3"></audio>
```

**Solution:**
```html
<!-- ✅ Include crossorigin attribute -->
<audio crossorigin="anonymous" src="https://storage.googleapis.com/audio.mp3"></audio>
```

**Or better, use FeedbackManager:**
```javascript
// FeedbackManager handles CORS automatically
await FeedbackManager.sound.play('correct');
```

**Prevention:**
- Always use FeedbackManager for audio
- If using Audio directly, include `crossorigin="anonymous"`

---

### Audio URLs return 404

**Cause:** Incorrect feedback URLs or asset doesn't exist.

**Problem:**
```javascript
const feedbackAssets = {
  correct: {
    audioUrl: "https://storage.googleapis.com/wrong-path/audio.mp3"  // ❌ 404
  }
};
```

**Solution:**
```javascript
// 1. Use debug function to test URLs
function testAudioUrls() {
  Object.entries(feedbackAssets).forEach(([key, asset]) => {
    fetch(asset.audioUrl)
      .then(res => console.log(`${key}: ${res.status}`))
      .catch(err => console.error(`${key} failed:`, err));
  });
}

testAudioUrls();  // Run in console

// 2. Verify URLs from search_feedback or create_feedback
// These MCP tools return valid URLs

// 3. Copy-paste URL into browser to verify it loads
```

**Prevention:**
- Use `search_feedback` or `create_feedback` MCP tools (return valid URLs)
- Run `testAudioUrls()` before delivery
- Test in browser console before finalizing

---

### Audio delay on first play

**Cause:** Audio not preloaded.

**Problem:**
```javascript
// ❌ No preload, delay on first play
await FeedbackManager.sound.play('tap');  // Slow first time
```

**Solution:**
```javascript
// ✅ Preload all audio on page load
window.addEventListener('load', async () => {
  await FeedbackManager.init();

  // Preload sounds
  await FeedbackManager.sound.preload('tap');
  await FeedbackManager.sound.preload('correct');
  await FeedbackManager.sound.preload('incorrect');

  console.log('✅ All audio preloaded');
});
```

**Prevention:**
- Preload all feedback audio in `window.onload`
- Use `FeedbackManager.sound.preload()` for sounds
- Use `FeedbackManager.stream.preload()` for streams (optional)

---

### Streams don't play

**Cause:** FeedbackManager not loaded or initialized.

**Problem:**
```javascript
// ❌ FeedbackManager script not loaded
await FeedbackManager.stream.play('celebration');  // Error!
```

**Solution:**
```html
<!-- ✅ Load FeedbackManager script -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<script>
  // Initialize before use
  window.addEventListener('load', async () => {
    await FeedbackManager.init();

    // Now safe to use
    await FeedbackManager.stream.play('celebration', {
      subtitle: "Great job!",
      sticker: { url: "..." }
    });
  });
</script>
```

**Prevention:**
- Always include FeedbackManager script tag
- Call `FeedbackManager.init()` before any FeedbackManager usage
- Never use FeedbackManager before initialization

---

## Component Issues

### "FeedbackManager is not defined"

**Cause:** FeedbackManager script not loaded.

**Solution:**
```html
<!-- Add to HTML <head> or before closing </body> -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
```

**Prevention:**
- Include FeedbackManager in all games with audio/feedback
- Load before game scripts that use it

---

### "TimerComponent is not defined"

**Cause:** Components package not loaded.

**Solution:**
```html
<!-- Add Components package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

**Prevention:**
- Load Components package if using TimerComponent, PopupComponent, etc.
- Never create custom timer implementations - use TimerComponent

---

### "toSnakeCase is not defined"

**Cause:** Helpers package not loaded.

**Solution:**
```html
<!-- Add Helpers package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**Prevention:**
- Load Helpers package for case conversion utilities
- Include in all games that communicate with backend

---

### Timer doesn't pause when tab hidden

**Cause:** VisibilityTracker not implemented.

**Problem:**
```javascript
// ❌ Timer keeps running when user switches tabs
const timer = new TimerComponent(...);
timer.start();
```

**Solution:**
```javascript
// ✅ Use VisibilityTracker to pause/resume
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  }
});
```

**Prevention:**
- ALWAYS implement VisibilityTracker for games with timers or audio
- Pause/resume all time-sensitive elements
- See [Visibility Tracker Usage](../types/visibility-tracker-usage.md)

---

## MCP Errors

### "Feedback not found in library"

**Cause:** Searching for feedback that doesn't exist.

**Solution:**
```javascript
// 1. Search with broader criteria
const results = await search_feedback({
  category: "encouragement",
  // Don't specify exact tags, let it return options
});

// 2. If still not found, create new feedback
if (results.length === 0) {
  const newFeedback = await create_feedback({
    text: "Great work!",
    category: "encouragement",
    tags: ["correct", "positive"]
  });
}
```

**Prevention:**
- Search first with broad criteria
- Create only if search finds nothing suitable
- Get user approval before creating new feedback

---

### "Invalid inputSchema format"

**Cause:** Schema doesn't follow JSON Schema specification.

**Problem:**
```javascript
// ❌ Invalid schema
inputSchema: {
  rounds: "array"  // Wrong format
}
```

**Solution:**
```javascript
// ✅ Valid JSON Schema
inputSchema: {
  type: "object",
  properties: {
    rounds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          operand1: { type: "number" },
          operand2: { type: "number" }
        }
      }
    }
  },
  required: ["rounds"]
}
```

**Prevention:**
- Follow JSON Schema specification
- Use `type`, `properties`, `items`, `required` correctly
- Test with `validate_content_against_schema`

---

## Testing & Debugging

### Game shows blank screen

**Check:**
1. Browser console for JavaScript errors
2. All script tags loaded successfully
3. FeedbackManager initialized
4. Game initialization function called

**Debug:**
```javascript
// Add debug logging
window.addEventListener('load', () => {
  console.log('✅ Page loaded');
  console.log('FeedbackManager available?', typeof FeedbackManager !== 'undefined');
  console.log('TimerComponent available?', typeof TimerComponent !== 'undefined');

  // Initialize
  FeedbackManager.init()
    .then(() => console.log('✅ FeedbackManager initialized'))
    .catch(err => console.error('❌ FeedbackManager init failed:', err));
});
```

---

### Validation not working

**Check:**
1. Validation function called on submit
2. Correct answer comparison logic
3. Edge cases (whitespace, case sensitivity)
4. Attempt tracking after validation

**Debug:**
```javascript
function validateAnswer(userAnswer, correctAnswer) {
  console.log('Validating:', { userAnswer, correctAnswer });

  const normalized = userAnswer.trim().toLowerCase();
  const correct = normalized === correctAnswer.toLowerCase();

  console.log('Result:', correct);
  return correct;
}
```

---

### Events not tracking

**Check:**
1. EventTracker initialized
2. `track()` called on interactions
3. Event types match standard conventions
4. Events included in results submission

**Debug:**
```javascript
function debugGame() {
  console.log('Session:', tracker.getSessionId());
  console.log('Attempts:', tracker.getAttempts());
  console.log('Events:', eventTracker.getEvents());
  console.log('Summary:', tracker.getSummary());
}

// Call in console
debugGame();
```

---

## Debug Functions

Always include these in games:

### `testAudioUrls()`

Test all audio URLs for accessibility.

```javascript
async function testAudioUrls() {
  console.log('🔍 Testing audio URLs...');
  const results = [];

  for (const [name, asset] of Object.entries(feedbackAssets)) {
    try {
      const response = await fetch(asset.audioUrl);
      results.push({
        name,
        url: asset.audioUrl,
        status: response.status,
        ok: response.ok
      });
    } catch (error) {
      results.push({
        name,
        url: asset.audioUrl,
        error: error.message
      });
    }
  }

  console.table(results);
  return results;
}
```

### `testAudio()`

Test audio playback for each feedback type.

```javascript
async function testAudio() {
  console.log('🔊 Testing audio playback...');

  for (const key of Object.keys(feedbackAssets)) {
    console.log(`Testing: ${key}`);
    await FeedbackManager.sound.play(key);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('✅ All audio tested');
}
```

### `debugGame()`

Display complete game state.

```javascript
function debugGame() {
  console.log('🎮 Game Debug Info:', JSON.stringify({
    sessionId: tracker.getSessionId(),
    summary: tracker.getSummary(),
    attempts: tracker.getAttempts(),
    events: eventTracker.getEvents(),
    feedbackAssets: Object.keys(feedbackAssets)
  }, null, 2));
}
```

---

## Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| NotAllowedError | Call `FeedbackManager.init()` on first interaction |
| CORS error | Use FeedbackManager or add `crossorigin="anonymous"` |
| 404 on audio | Use MCP tools, run `testAudioUrls()` |
| Audio delay | Preload with `FeedbackManager.sound.preload()` |
| Streams don't play | Load FeedbackManager script, call `init()` |
| Component undefined | Load required package script |
| File not found | Use MCP-accessible directory |
| No content sets | Create content set after registration |
| Schema validation | Match content structure to inputSchema |
| Blank screen | Check console, verify scripts loaded |

---

## Getting Help

**Before asking for help:**
1. Check browser console for errors
2. Run debug functions (`testAudioUrls()`, `debugGame()`)
3. Verify all scripts loaded
4. Test in Chrome (recommended browser)
5. Hard refresh (Cmd+Shift+R)

**Include in bug reports:**
1. Error message (full text)
2. Browser console output
3. Code snippet causing issue
4. Steps to reproduce
5. Output from debug functions

## Sentry Error Tracking Issues

### Errors not appearing in Sentry

**Cause:** Sentry not initialized or DSN incorrect.

**Problem:**
```javascript
// ❌ Missing Sentry initialization
// OR wrong DSN
Sentry.init({
  dsn: 'WRONG_DSN_HERE'  // Invalid
});
```

**Solution:**
```javascript
// 1. Verify Sentry is loaded
console.log('Sentry loaded?', typeof Sentry !== 'undefined');

// 2. Check initialization
window.verifySentry = function() {
  const checks = {
    sdkLoaded: typeof Sentry !== 'undefined',
    initialized: Sentry.getCurrentHub().getClient() !== undefined,
    dsn: Sentry.getCurrentHub().getClient()?.getDsn()?.toString()
  };
  console.log('🔍 Sentry Status:', JSON.stringify(checks, null, 2));
  return checks;
};

verifySentry();

// 3. Test error capture
window.testSentry = function() {
  try {
    throw new Error('Test error from testSentry()');
  } catch (error) {
    Sentry.captureException(error, { tags: { test: true } });
    console.log('✅ Test error sent to Sentry. Check your dashboard.');
  }
};

testSentry();

// 4. Verify DSN format
// Correct: https://PUBLIC_KEY@o0.ingest.sentry.io/PROJECT_ID
```

**Prevention:**
- Load Sentry SDK BEFORE all other packages
- Get DSN from Sentry project settings
- Test with `verifySentry()` and `testSentry()`
- Check Sentry dashboard for test error

---

### Package loading timeout not captured

**Cause:** No timeout or try-catch in `waitForPackages()`.

**Problem:**
```javascript
// ❌ No timeout, hangs forever
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
  // Never throws error, Sentry never captures
}
```

**Solution:**
```javascript
// ✅ With timeout and Sentry capture
async function waitForPackages() {
  const timeout = 10000; // 10 seconds
  const start = Date.now();

  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    Sentry.addBreadcrumb({
      category: 'package-loading',
      message: 'All packages loaded',
      level: 'info',
      data: { loadTime: Date.now() - start }
    });
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    Sentry.captureException(error, {
      tags: { phase: 'package-loading', severity: 'critical' },
      contexts: {
        packages: {
          feedbackManager: typeof FeedbackManager !== 'undefined'
        }
      }
    });
    throw error;
  }
}
```

**Prevention:**
- Always add 10-second timeout
- Wrap in try-catch
- Capture exception with tags and contexts
- See [workflows/checklists/error-tracking.md](../workflows/checklists/error-tracking.md)

---

### Too many errors in Sentry

**Cause:** All errors being captured without sampling.

**Problem:**
```javascript
// ❌ Capturing every error (too many)
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE',
  sampleRate: 1.0  // 100% of errors
});
```

**Solution:**
```javascript
// ✅ Adjust sampling rates
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE',
  sampleRate: 0.5,  // Capture 50% of errors
  tracesSampleRate: 0.1,  // 10% of transactions

  // Or filter specific errors
  beforeSend(event, hint) {
    // Ignore known benign errors
    if (event.message?.includes('ResizeObserver loop')) {
      return null;  // Don't send this error
    }
    return event;
  },

  // Ignore specific errors by pattern
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured'
  ]
});
```

**Prevention:**
- Start with lower sample rates
- Use `beforeSend` to filter
- Add known benign errors to `ignoreErrors`
- Monitor Sentry quota usage

---

### Missing context in Sentry errors

**Cause:** User/game context not set after `game_init`.

**Problem:**
```javascript
// ❌ No context set
window.addEventListener('message', (event) => {
  if (event.data.type === 'game_init') {
    const config = fromSnakeCase(event.data.data);
    initializeGame(config);
    // Missing: Sentry context setting
  }
});
```

**Solution:**
```javascript
// ✅ Set context immediately after game_init
window.addEventListener('message', (event) => {
  try {
    if (event.data.type === 'game_init') {
      const config = fromSnakeCase(event.data.data);

      // Set user context
      Sentry.setUser({
        id: config.studentId,
        sessionId: config.sessionId
      });

      // Set game context
      Sentry.setContext('game', {
        gameId: config.gameId,
        sessionId: config.sessionId,
        contentSetId: config.contentSetId
      });

      Sentry.addBreadcrumb({
        category: 'postmessage',
        message: 'game_init received',
        level: 'info',
        data: { gameId: config.gameId }
      });

      initializeGame(config);
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { phase: 'message-handling', severity: 'high' }
    });
  }
});
```

**Prevention:**
- Set user context after `game_init`
- Set game context with relevant IDs
- Add breadcrumb for tracking
- See [reference/sentry-integration.md](./sentry-integration.md)

---

## Related Documentation

- [Sentry Integration](./sentry-integration.md) ⭐ **NEW** - Complete error tracking guide
- [Architecture](./architecture.md) - System overview
- [MCP Integration](./mcp-integration.md) - MCP tool usage
- [FeedbackManager Usage](../types/feedback-manager-usage.md) - Audio system
- [Component Usage](../types/README.md) - All components
