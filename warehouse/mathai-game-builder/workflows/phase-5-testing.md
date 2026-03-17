# Phase 5: Testing & Polish

This phase verifies all functionality works correctly.

## Prerequisites

- Phases 1-4 completed and approved
- Game accessible via URL (local or platform)

## Workflow Steps

### Step 0: Present Phase 5 Checklist (MANDATORY FIRST)

**Action:** Display Checklist 1 to the user BEFORE starting testing. Checklist 2 is internal only (for Claude's verification).

**Checklist 1 - User Requirements (Present to user):**

```
📋 Phase 5 Checklist - User Requirements

Testing Requirements:
[ ] Phases 1-4 approved
[ ] All game mechanics tested
[ ] Visual layout verified
[ ] User interactions verified
[ ] Audio playback tested
[ ] Complete gameplay tested (2-3 rounds)
[ ] Platform URLs tested (if registered)

Ready to start testing? (Reply "start" to proceed)
```

**Checklist 2 - Skill Pattern Requirements (Internal - DO NOT show to user):**

```
📋 Phase 5 Checklist - Skill Pattern Requirements (Internal)

Production Readiness (MANDATORY):
[ ] 🚨 Sentry Config Package loaded FIRST - VERIFY: <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script> appears before SDK scripts (see error-tracking.md → "1. Load Sentry Config Package FIRST")
[ ] 🚨 Sentry SDK scripts loaded - VERIFY: Three scripts (bundle.tracing.replay.feedback.min.js, captureconsole.min.js, browserprofiling.min.js) with crossorigin="anonymous" (see error-tracking.md → "2. Load Sentry SDK and Integrations")
[ ] 🚨 initSentry() function defined - VERIFY: Uses SentryConfig.dsn, SentryConfig.environment, beforeSend() filter (see error-tracking.md → "1. Load Sentry Config Package FIRST")
[ ] 🚨 trackAssetError() function added - VERIFY: function trackAssetError(assetType, assetUrl, error) { Sentry.captureException(new Error(\`\${assetType} loading failed: \${assetUrl}\`), {...}) } (see error-tracking.md → "6. Add Automatic Asset Error Tracking")
[ ] 🚨 Asset error handlers - VERIFY: document.querySelectorAll('img').forEach(img => img.addEventListener('error', e => trackAssetError('image', img.src, e))) pattern for img/video/audio (see error-tracking.md → "6. Add Automatic Asset Error Tracking")
[ ] 🚨 Global error handlers - VERIFY: window.addEventListener('error', event => Sentry.captureException(event.error)) and 'unhandledrejection' (see error-tracking.md → "5. Add Global Error Handlers")

During testing:
[ ] Test in Chrome - VERIFY: Use file:// URL, hard refresh with Cmd+Shift+R
[ ] Run testAudioUrls() - VERIFY: All URLs return 200 OK, accessible (see reference/debug-functions.md)
[ ] Run testAudio() - VERIFY: Each audio ID plays successfully (see reference/debug-functions.md)
[ ] Run debugAudio() - VERIFY: AudioKit state shows unlocked:true, preloaded array populated (see reference/debug-functions.md)
[ ] Run debugGame() - VERIFY: Game state shows current round, score, metrics (see reference/debug-functions.md)
[ ] **IF subjective evaluation used:** Test evaluation flow - VERIFY: Loading states work, evaluation completes, feedback plays with subtitle (see checklists/subjective-evaluation.md verification section)
[ ] Browser console - VERIFY: No errors, no warnings, only expected logs
[ ] Event tracking - VERIFY: Metrics logged at game end, attempt history captured
[ ] Complete gameplay - VERIFY: 2-3 rounds tested, all interactions working
[ ] Platform testing - VERIFY: Both Learn and Standalone URLs tested if registered
```

**Wait for user "start" confirmation before proceeding to Step 0.5.**

---

### Step 0.5: Verify Local Files (AUTOMATIC)

**Action:** Verify local game files are up-to-date with CDN before testing

**This step is MANDATORY when continuing work in a different chat session.**

```javascript
// 1. Read local metadata to get gameId
const localMeta = Read({
  file_path: `games/${gameId}/metadata.json`
});

// 2. Fetch CDN metadata
const cdnMeta = mathai-core:resource_manifest({
  gameId: gameId
});

// 3. Compare versions
if (cdnMeta.version > localMeta.version) {
  // CDN has newer version - download it
  // See game-resumption.md for download steps
}
```

**Status Messages:**

✅ **Local up-to-date:**

```
✅ Local files verified (v${localVersion})
Proceeding with Phase 5 testing...
```

📥 **Downloading from CDN:**

```
📥 Updating from CDN (v${cdnVersion} > v${localVersion})
Downloaded ${fileCount} files
Proceeding with Phase 5 testing...
```

**See:** [workflows/game-resumption.md](game-resumption.md) for complete verification workflow

**Write Phase 5 Checklists to Disk:**

- Continue using the stored `gameDirectory` path from previous phases (for example, `const gameDirectory = \`/Users/username/Documents/claude/${gameId}\``)
- Capture any user-specific testing requirements before writing
- Persist BOTH checklists exactly as presented using `Write` tool

```javascript
const gameDirectory = `games/${gameId}`; // maintained across phases

Bash({
  command: `mkdir -p ${gameDirectory}/checklists`,
  description: "Create checklists directory if needed"
});

Write({
  file_path: `${gameDirectory}/checklists/phase-5-checklist.md`,
  content: `📋 Phase 5 Checklist - User Requirements

Testing Requirements:
[ ] Phases 1-4 approved
[ ] All game mechanics tested
[ ] Visual layout verified
[ ] User interactions verified
[ ] Audio playback tested
[ ] Complete gameplay tested (2-3 rounds)
[ ] Platform URLs tested (if registered)

📋 Phase 5 Checklist - Skill Pattern Requirements (Internal)

Production Readiness (MANDATORY):
[ ] 🚨 Sentry Config Package loaded FIRST - VERIFY: <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script> appears before SDK scripts (see error-tracking.md → "1. Load Sentry Config Package FIRST")
[ ] 🚨 Sentry SDK scripts loaded - VERIFY: Three scripts (bundle.tracing.replay.feedback.min.js, captureconsole.min.js, browserprofiling.min.js) with crossorigin="anonymous" (see error-tracking.md → "2. Load Sentry SDK and Integrations")
[ ] 🚨 initSentry() function defined - VERIFY: Uses SentryConfig.dsn, SentryConfig.environment, beforeSend() filter (see error-tracking.md → "1. Load Sentry Config Package FIRST")
[ ] 🚨 trackAssetError() function added - VERIFY: function trackAssetError(assetType, assetUrl, error) { Sentry.captureException(new Error(\`\${assetType} loading failed: \${assetUrl}\`), {...}) } (see error-tracking.md → "6. Add Automatic Asset Error Tracking")
[ ] 🚨 Asset error handlers - VERIFY: document.querySelectorAll('img').forEach(img => img.addEventListener('error', e => trackAssetError('image', img.src, e))) pattern for img/video/audio (see error-tracking.md → "6. Add Automatic Asset Error Tracking")
[ ] 🚨 Global error handlers - VERIFY: window.addEventListener('error', event => Sentry.captureException(event.error)) and 'unhandledrejection' (see error-tracking.md → "5. Add Global Error Handlers")

During testing:
[ ] Test in Chrome - VERIFY: Use file:// URL, hard refresh with Cmd+Shift+R
[ ] Run testAudioUrls() - VERIFY: All URLs return 200 OK, accessible (see reference/debug-functions.md)
[ ] Run testAudio() - VERIFY: Each audio ID plays successfully (see reference/debug-functions.md)
[ ] Run debugAudio() - VERIFY: AudioKit state shows unlocked:true, preloaded array populated (see reference/debug-functions.md)
[ ] Run debugGame() - VERIFY: Game state shows current round, score, metrics (see reference/debug-functions.md)
[ ] **IF subjective evaluation used:** Test evaluation flow - VERIFY: Loading states work, evaluation completes, feedback plays with subtitle (see checklists/subjective-evaluation.md verification section)
[ ] Browser console - VERIFY: No errors, no warnings, only expected logs
[ ] Event tracking - VERIFY: Metrics logged at game end, attempt history captured
[ ] Complete gameplay - VERIFY: 2-3 rounds tested, all interactions working
[ ] Platform testing - VERIFY: Both Learn and Standalone URLs tested if registered
`
});
```

> Include any additional testing rows you added for the user, and keep this file updated via `Edit` tool as items move to `[✅]` or `[❌]`.

**Checklist Communication Pattern:**

**TO USER (Simple status only):**

- ✅ "All checklist items completed" (when all ✅)
- ⏳ "Some checklist items remaining" (when any ❌ or [ ])

**INTERNAL (Detailed tracking with SPECIFIC details):**

- Create checklist file locally with `Write` tool
- Update with `Edit` tool as items complete
- Mark items: `[ ]` → `[✅]` (done) or `[❌]` (needs fix)
- **CRITICAL: When marking [✅], add SPECIFIC implementation details:**

**❌ BAD (Ambiguous):**

```
[✅] Audio tested
[✅] Debug functions work
```

**✅ GOOD (Specific, Verifiable):**

```
[✅] Audio URLs tested: window.testAudioUrls() returned 200 OK for all 3 URLs (tap.mp3, correct.mp3, incorrect.mp3) - VERIFIED accessible
[✅] Audio playback tested: window.testAudio("tap"), testAudio("correct"), testAudio("incorrect") all played successfully - VERIFIED in browser
[✅] Debug functions: window.debugAudio() shows {unlocked:true, preloaded:["tap","correct","incorrect"], currentlyPlaying:null} - VERIFIED state correct
[✅] Dynamic audio: FeedbackManager.playDynamicFeedback({audio_content:"test"}) played successfully - VERIFIED simplified method works
```

**Template for marking testing complete:**

```
[✅] Test type: specific function/method called with result - VERIFIED outcome
[✅] Debug function: functionName() returned {expected:values} - VERIFIED output
[✅] URL test: endpoint returned status code - VERIFIED accessible
```

- Verify ALL items `[✅]` before user notification
- Fix ALL `[❌]` items immediately

**NEVER show checklist marks to user. Only show simple status.**

---

### Step 0.55: Read Sentry Integration Checklist (MANDATORY)

**🚨 MANDATORY: Read Sentry Integration Checklist First**

Before adding ANY Sentry code, you MUST read the complete integration pattern:

```javascript
// Read complete Sentry integration checklist
Read: workflows / checklists / error - tracking.md;
// Focus on sections:
//  - "1. Load Sentry Config Package FIRST"
//  - "2. Load Sentry SDK and Integrations"
//  - "5. Add Global Error Handlers"
//  - "6. Add Automatic Asset Error Tracking"
```

**This document contains:**

- **"SDK Loading & Initialization"** - Sentry Config Package setup
- **"1. Load Sentry Config Package FIRST"** - initSentry() function signature
- **"6. Add Automatic Asset Error Tracking"** - trackAssetError() helper function
- **"6. Add Automatic Asset Error Tracking"** - Asset error handlers for img/video/audio
- **"5. Add Global Error Handlers"** - window error/unhandledrejection handlers

**After reading, proceed to Step 0.6 for implementation.**

---

### Step 0.6: Add Production Error Tracking (MANDATORY)

**Action:** Add Sentry integration for production error monitoring BEFORE testing begins.

**Why MANDATORY:** Captures production errors, asset loading failures, and provides session replay for debugging.

**Quick Summary:**

Phase 5 requires adding Sentry error tracking with these critical components:

1. **Sentry Config Package** (centralized configuration)

   - Provides hardcoded DSN, environment, sampling rates
   - Pre-configured ignored error patterns
   - Load FIRST (before Sentry SDK scripts)

2. **Sentry SDK Scripts** (3 required scripts)

   - bundle.tracing.replay.feedback.min.js
   - captureconsole.min.js
   - browserprofiling.min.js

3. **initSentry() Function**

   - Uses centralized config from SentryConfig
   - Configured with replay, profiling, console capture
   - Called on window.load event

4. **trackAssetError() Helper** **CRITICAL**

   - Logs image/video/audio loading failures
   - Reports failures to Sentry with metadata
   - Must be added for ALL games

5. **Asset Error Handlers** **CRITICAL**

   - `querySelectorAll('img')` with error listeners
   - `querySelectorAll('video')` with error listeners
   - `querySelectorAll('audio')` with error listeners
   - Hides broken assets, captures errors

6. **Global Error Handlers**
   - `window.addEventListener('error')` for unhandled errors
   - `window.addEventListener('unhandledrejection')` for promise rejections

**Implementation Pattern (Abbreviated):**

```html
<head>
  <!-- 1. Sentry Config Package FIRST -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

  <!-- 2. initSentry() function -->
  <script>
    function initSentry() {
      if (!SentryConfig.enabled) return;
      Sentry.init({
        dsn: SentryConfig.dsn,
        environment: SentryConfig.environment
        /* ... uses SentryConfig for all settings ... */
      });
    }
  </script>

  <!-- 3. Sentry SDK scripts -->
  <script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js"></script>
  <script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js"></script>
  <script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js"></script>

  <!-- 4. Call initSentry on load -->
  <script>
    window.addEventListener('load', initSentry);
  </script>

  <!-- 5. Game packages (after Sentry) -->
  <script src="...packages/feedback-manager/index.js"></script>
  <script src="...packages/components/index.js"></script>
  <script src="...packages/helpers/index.js"></script>
</head>

<script>
  // 6. trackAssetError() helper function (MANDATORY)
  function trackAssetError(assetType, assetUrl, error) {
    console.error(`❌ ${assetType} loading failed:`, assetUrl, error);
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(new Error(`${assetType} loading failed: ${assetUrl}`), {
        tags: { errorType: 'asset-loading', assetType, severity: 'medium' },
        extra: { assetUrl, errorMessage: error?.message || 'Unknown error' }
      });
    }
  }

  // 7. Asset error handlers (MANDATORY)
  document.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('onerror')) {
      img.addEventListener('error', e => {
        trackAssetError('image', img.src, e);
        img.style.display = 'none';
      });
    }
  });

  document.querySelectorAll('video').forEach(video => {
    video.addEventListener('error', e => {
      // Get src from video.src or from failed source element
      const src = video.currentSrc || video.src;
      trackAssetError('video', src, e);
      video.style.display = 'none';
    });

    // Also handle source element errors (thrown before video error)
    video.querySelectorAll('source').forEach(source => {
      source.addEventListener('error', e => {
        trackAssetError('video-source', source.src, e);
      });
    });
  });

  document.querySelectorAll('audio').forEach(audio => {
    audio.addEventListener('error', e => {
      trackAssetError('audio', audio.src, e);
    });
  });

  // 8. Global error handlers
  window.addEventListener('error', event => {
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(event.error, {
        tags: { errorType: 'unhandled', severity: 'critical' }
      });
    }
  });

  window.addEventListener('unhandledrejection', event => {
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(event.reason, {
        tags: { errorType: 'unhandled-promise', severity: 'critical' }
      });
    }
  });
</script>
```

**See Step 6.5 below for complete implementation code with all integration patterns.**

**Internal Verification (Before Step 1):**

Before proceeding to Step 1, verify Sentry integration against internal checklist (Step 0, Production Readiness section):

- [ ] Sentry Config Package loaded FIRST - See error-tracking.md → "1. Load Sentry Config Package FIRST"
- [ ] Three Sentry SDK scripts loaded - See error-tracking.md → "2. Load Sentry SDK and Integrations"
- [ ] initSentry() function defined - See error-tracking.md → "1. Load Sentry Config Package FIRST"
- [ ] trackAssetError() function added (CRITICAL) - See error-tracking.md → "6. Add Automatic Asset Error Tracking"
- [ ] Asset error handlers added for img/video/audio (CRITICAL) - See error-tracking.md → "6. Add Automatic Asset Error Tracking"
- [ ] Global error handlers added - See error-tracking.md → "5. Add Global Error Handlers"

**All items must be ✅ before proceeding to Step 1.**

**No user confirmation needed** - this is internal technical verification.

---

## Step 1: Testing By Phase

**Action:** Test games systematically by revisiting each development phase.

**IMPORTANT:** This step can ONLY be reached after completing Step 0.55 (read checklist) and Step 0.6 (Sentry integration).

### Change Requests After Phase Approval

**MANDATORY WORKFLOW:** (Triggered automatically by [prompt-dispatch.md](prompt-dispatch.md) before you reach this section.)

1. **Analyze the latest user prompt.** If it asks for _any_ change after Phase 5 (or earlier phases) was approved, treat it as a change request.
2. **STOP** – do **not** modify gameplay or testing code yet.
3. **Reset every checklist through Phase 5** (including support docs like `feedback-plan.md`) so all `[✅]` become `[ ]` using `replace_all: true` edits.
4. **Then** perform the requested updates.
5. **Re-verify** every reset checklist until each returns to `[✅]`.
6. **Request approval** only after verification passes.

Execute the full flow in [checklist-reset-strategy.md](checklist-reset-strategy.md) before changing files.

```javascript
const gameDirectory = `games/${gameId}`;

for (const file of [
  'phase-1-checklists.md',
  'phase-2-checklist.md',
  'phase-3-checklist.md',
  'feedback-plan.md',
  'phase-4-checklist.md',
  'phase-5-checklist.md'
]) {
  Edit({
    file_path: `${gameDirectory}/checklists/${file}`,
    old_string: "[✅]",
    new_string: "[ ]",
    replace_all: true
  });
}
```

> Skipping the reset step breaks the workflow. Run testing again only after every reset checklist shows `[✅]`.

Test games systematically by revisiting each development phase:

### Phase 1: Core Gameplay Testing

**What to Test:**

- Game mechanics work as intended
- Visual layout displays correctly
- Basic game flow progresses properly
- User interactions are responsive
- Event tracking captures all actions

**How to Test:**

```javascript
// Open browser console
window.debugGame();
// Should show: currentRound, attempts, events

// Play through one complete round
// Check console for event logs
```

### Phase 2: Validation Testing

**What to Test:**

- Answer validation type works correctly (fixed/function/LLM)
- Correct/incorrect detection is accurate
- Edge cases are handled properly
- Attempts are tracked correctly

**How to Test:**

```javascript
// Test with correct answers
// Test with incorrect answers
// Test with edge cases (empty input, special characters, etc.)
// Verify attempts counter updates

window.debugGame();
// Check attempts count matches your inputs
```

### Phase 3: Feedback Testing

**What to Test:**

- Audio system is properly initialized
- Static feedback plays correctly (tap, correct, incorrect)
- Dynamic feedback works (completion, achievements)
- Subtitles display with audio
- Stickers animate properly
- Debug functions work

**How to Test:**

```javascript
// Test audio URLs are accessible
window.testAudioUrls();
// Should show 200 OK for all URLs

// Test individual audio files
window.testAudio('tap');
window.testAudio('correct');
window.testAudio('incorrect');

// Check AudioKit state
window.debugAudio();
// Should show unlocked: true, preloaded audio

// Play through game and verify:
// - Audio plays on tap
// - Correct/incorrect audio plays
// - Subtitles appear with audio
// - Stickers animate on key moments
```

### Phase 4: Integration Testing

**What to Test:**

- Game loads from learn.mathai.ai URL
- Content is received via postMessage
- Game responds to platform messages
- Results are submitted correctly

**How to Test:**

```javascript
// Test integrated mode (learn.mathai.ai URL)
// Should receive content from platform

// Check console logs for:
console.log('📦 Content received:', JSON.stringify(content, null, 2));
console.log('📤 Submitting results:', JSON.stringify(results, null, 2));
```

### Phase 5: Final Testing

**Comprehensive Checklist:**

**Audio:**

- [ ] All audio URLs return 200 OK (`testAudioUrls()`)
- [ ] Each audio type plays correctly (`testAudio()`)
- [ ] Audio unlocks on first interaction
- [ ] No "NotAllowedError: play() failed" errors
- [ ] No CORS errors
- [ ] Audio doesn't overlap or break
- [ ] Sequential playback works correctly

**Subtitles:**

- [ ] Subtitles display with all audio
- [ ] Markdown formatting renders correctly
- [ ] Duration matches audio length
- [ ] No manual subtitle creation in code

**Timers (if applicable):**

- [ ] Timer displays correctly
- [ ] Countdown/stopwatch works properly
- [ ] Timer format is correct (MM:SS or seconds)
- [ ] `onEnd` callback fires when timer completes
- [ ] Timer cleans up with `timer.destroy()`

**VisibilityTracker (if applicable):**

- [ ] Pauses timer when tab inactive
- [ ] Pauses audio when tab inactive
- [ ] Resumes timer when tab active
- [ ] Resumes audio when tab active
- [ ] Custom popup displays correctly
- [ ] Cleans up with `tracker.destroy()`

**Stickers (if applicable):**

- [ ] Lottie library loaded
- [ ] Stickers animate on key moments
- [ ] Animations complete properly

**General:**

- [ ] No errors in browser console
- [ ] All console logs use `JSON.stringify`
- [ ] Debug functions work
- [ ] Event tracking captures all actions
- [ ] Results submit correctly
- [ ] Game works in integrated mode (learn.mathai.ai)

## Debug Functions Reference

Always include these debug functions in your game. See [Debug Functions Guide](../reference/debug-functions.md) for complete implementations.

**Quick Reference:**

```javascript
// Test individual audio
window.testAudio('tap'); // Test specific feedback type
window.testAudio('correct'); // Test correct answer audio
window.testAudio('incorrect'); // Test incorrect answer audio

// Test URL accessibility
window.testAudioUrls(); // Check all audio URLs return 200 OK

// Debug AudioKit state
window.debugAudio(); // Show audio system state

// Debug game state
window.debugGame(); // Show game state (round, attempts, events)
```

**Expected Output:**

```javascript
// testAudioUrls() should show:
📊 URL Test Results: [
  { name: "tap", url: "https://...", status: 200, ok: true },
  { name: "correct", url: "https://...", status: 200, ok: true },
  { name: "incorrect", url: "https://...", status: 200, ok: true }
]

// debugAudio() should show:
🎵 AudioKit State: {
  sound: { unlocked: true, preloaded: ["tap", "correct", "incorrect"] },
  stream: { initialized: true }
}

// debugGame() should show:
🎮 Game State: {
  currentRound: 1,
  retries: 3,
  events: 12
}
```

## Common Issues & Fixes

| Issue                            | Cause                        | Fix                                                                        |
| -------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| "NotAllowedError: play() failed" | Audio context not unlocked   | Call `AudioKit.unlock()` on first interaction                              |
| "CORS policy error"              | Missing crossorigin          | AudioKit handles this automatically                                        |
| Audio URLs return 404            | Incorrect URLs               | Run `testAudioUrls()` to verify                                            |
| Audio delay on first play        | Not preloaded                | Use `AudioKit.sound.preload()` in `window.onload`                          |
| Streams don't play               | FeedbackManager not loaded   | Add script: `https://storage.googleapis.com/.../feedback-manager/index.js` |
| Audio overlaps/breaks            | Using `new Audio()` directly | Use AudioKit (VERIFY: No new Audio() usage)                                |
| Sequential playback broken       | Not using AudioKit methods   | Use `AudioKit.sound.play()` for ALL audio                                  |
| Can't debug issues               | No console logs              | Add `JSON.stringify` logs + use `debugAudio()`                             |

## Feedback Implementation Checklist

Before delivering a game with feedback, verify:

**Audio:**

- [ ] **MANDATORY**: FeedbackManager loaded in HTML (`<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>`)
- [ ] **MANDATORY**: `FeedbackManager.init()` called once when DOM is ready (before ANY FeedbackManager usage)
- [ ] **MANDATORY**: ALL audio uses AudioKit methods - NO `new Audio()` anywhere in code
- [ ] **MANDATORY**: Regular audio uses `AudioKit.sound.preload()` and `AudioKit.sound.play()`
- [ ] **MANDATORY**: Dynamic cached audio uses `AudioKit.sound.preload()` and `AudioKit.sound.play()`
- [ ] **MANDATORY**: Dynamic streamed audio uses `AudioKit.stream.addFromResponse()` and `AudioKit.stream.play()`
- [ ] `AudioKit.unlock()` called on every user interaction
- [ ] Audio preloaded via `AudioKit.sound.preload()` in `window.onload`
- [ ] All feedback assets are configured
- [ ] **Verified NO direct `new Audio()` calls in entire codebase**

**Subtitles:**

- [ ] **MANDATORY**: Subtitles passed as props with audio via FeedbackManager
- [ ] **MANDATORY**: ALL subtitles use `FeedbackManager.sound.play(id, { subtitle: 'text' })` - NO SubtitleComponent.show() calls
- [ ] **MANDATORY**: SubtitleComponent is NOT loaded separately (auto-loaded by FeedbackManager)
- [ ] Subtitles configured for all feedback that has text
- [ ] Markdown formatting used where appropriate (`**bold**`, `*italic*`)
- [ ] Subtitle durations auto-calculated from audio lengths
- [ ] **Verified NO SubtitleComponent.show() calls in entire codebase**
- [ ] **Verified NO manual subtitle element creation in entire codebase**

**Timers:**

- [ ] **MANDATORY**: Components package loaded in HTML if timer is needed (`<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>`)
- [ ] **MANDATORY**: ALL timers use `new TimerComponent()` - NO manual timer implementations
- [ ] Timer type configured correctly (`decrease` for countdown, `increase` for stopwatch)
- [ ] Timer format matches game needs (`min` for MM:SS, `sec` for seconds only)
- [ ] `onEnd` callback implemented for timer completion handling
- [ ] Timer cleanup with `timer.destroy()` when game ends
- [ ] **Verified NO manual setInterval/setTimeout timer implementations in entire codebase**

**VisibilityTracker (Pause/Resume):**

- [ ] **MANDATORY**: Helpers package loaded in HTML (`<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>`)
- [ ] **MANDATORY**: VisibilityTracker instance created with onInactive and onResume callbacks
- [ ] **MANDATORY**: `onInactive` callback pauses timer (if timer exists)
- [ ] **MANDATORY**: `onInactive` callback pauses regular audio (`FeedbackManager.sound.pause()`)
- [ ] **MANDATORY**: `onInactive` callback pauses streaming audio (`FeedbackManager.stream.pauseAll()`)
- [ ] **MANDATORY**: `onResume` callback resumes timer (if timer exists)
- [ ] **MANDATORY**: `onResume` callback resumes regular audio (`FeedbackManager.sound.resume()`)
- [ ] **MANDATORY**: `onResume` callback resumes streaming audio (`FeedbackManager.stream.resumeAll()`)
- [ ] Custom popup configuration with appropriate title and description
- [ ] Tested with tab switching - verify pause/resume works correctly
- [ ] Tested with manual triggers (`triggerInactive()` and `triggerResume()`)
- [ ] Cleanup with `tracker.destroy()` when game ends

**Stickers:**

- [ ] Lottie library loaded if stickers are used
- [ ] Sticker container element exists in HTML
- [ ] Stickers configured for key feedback moments
- [ ] Sticker animations tested

**General:**

- [ ] Error handling in place for all feedback operations
- [ ] Debug functions included: `testAudio()`, `testAudioUrls()`, `debugAudio()`, `debugGame()`
- [ ] All console logs use `JSON.stringify(data, null, 2)`
- [ ] Initialization logs in `window.onload`
- [ ] Tested with browser console open - no errors
- [ ] Ran `testAudioUrls()` - all URLs accessible
- [ ] Ran `testAudio()` for each feedback type - all play correctly

---

## Update Metadata

**Action:** Update metadata.json to reflect Phase 5 completion

```javascript
// Read current metadata
Read({
  file_path: `games/${gameId}/metadata.json`
});

// Update version and phase
Edit({
  file_path: `games/${gameId}/metadata.json`,
  old_string: '"version": "0.0.4"',
  new_string: '"version": "0.0.5"'
});
Edit({
  file_path: `games/${gameId}/metadata.json`,
  old_string: '"current_phase": "phase-4"',
  new_string: '"current_phase": "phase-5"'
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
const GAME_DIR = `$(pwd)/games/${gameId}`;
const allFiles = Glob({
  pattern: "**/*",
  path: `games/${gameId}`
});

// Build files array for upload (use absolute paths for MCP tool)
const files = [
  { filePath: `${GAME_DIR}/index.html`, targetPath: "index.html" },
  { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },
  { filePath: `${GAME_DIR}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" },
  { filePath: `${GAME_DIR}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-3-checklist.md`, targetPath: "checklists/phase-3-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" },
  { filePath: `${GAME_DIR}/checklists/phase-4-checklist.md`, targetPath: "checklists/phase-4-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-5-checklist.md`, targetPath: "checklists/phase-5-checklist.md" }
];

// Upload to CDN
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**Verify if all files in game directory are uploaded to CDN (Including checklists and any other files)**

## Step 6.5: Sentry Integration Reference

**Note:** This is reference documentation only. Sentry integration should already be complete from Step 0.6.

**If you haven't implemented Sentry yet, go back to Step 0.55 (read checklist) and Step 0.6 (implement).**

---

### Complete Implementation Documentation

For complete Sentry integration patterns, see:

**📖 [workflows/checklists/error-tracking.md](checklists/error-tracking.md)**

This document contains:

1. **"SDK Loading & Initialization"** section

   - "1. Load Sentry Config Package FIRST" - Loading order, initSentry() pattern, SentryConfig usage
   - "2. Load Sentry SDK and Integrations" - Three required scripts, crossorigin attribute, window.load

2. **"Asset Loading Error Handlers"** section

   - "6. Add Automatic Asset Error Tracking" - trackAssetError() function signature
   - "6. Add Automatic Asset Error Tracking" - Asset error handler patterns for img/video/audio

3. **"Global Error Handlers"** section

   - "5. Add Global Error Handlers" - window.addEventListener('error' and 'unhandledrejection')
   - DOMContentLoaded integration

4. **"Package Loading Error Tracking"** section

   - "3. Add Timeout & Error Capture to waitForPackages()" - Sentry breadcrumbs, timeout handling

5. **"Audio/Feedback Error Tracking"** section

   - "6. Add Error Tracking to Audio Operations" - FeedbackManager integration, preload errors

6. **"Verification Checklist"** section
   - Console verification steps
   - Test error capture
   - Sentry dashboard verification

---

### Quick Checklist

Verify these items were completed in Step 0.6:

- [ ] Sentry Config Package loaded FIRST
- [ ] Three Sentry SDK scripts loaded (bundle, captureconsole, browserprofiling)
- [ ] initSentry() function defined
- [ ] trackAssetError() function added
- [ ] Asset error handlers for img/video/audio
- [ ] Global error handlers for window events
- [ ] Console shows "✅ Sentry initialized with centralized config vX.X.X"

---

### Common Issues

**Issue: "Sentry is not defined"**

- **Cause:** SDK scripts didn't load
- **Fix:** Check crossorigin="anonymous" attribute, verify CDN URLs

**Issue:** "IntegrationError: lottie-player already used"\*\*

- **Cause:** Package loading race condition (known issue)
- **Fix:** This is expected, will be fixed in packages

**Issue:** Too many errors captured

- **Cause:** Noisy errors not filtered
- **Fix:** Verify SentryConfig.shouldIgnoreError() is being used

See error-tracking.md for complete troubleshooting guide.

---

## Verify Checklists (MANDATORY BEFORE APPROVAL)

**Action:** Verify BOTH checklists are complete BEFORE requesting final approval.

**Verification Process:**

1. Review all testing against both checklists
2. Update checklist status (✅ for complete, ❌ for missing)
3. If ANY item is ❌, fix immediately
4. Only proceed to approval when ALL items are ✅

**Checklist 1 Verification - User Requirements:**

```
[✅/❌] All game mechanics tested
[✅/❌] Visual layout verified
[✅/❌] User interactions verified
[✅/❌] Audio playback tested
[✅/❌] Complete gameplay tested (2-3 rounds)
[✅/❌] Platform URLs tested (if registered)
```

**Checklist 2 Verification - Skill Pattern Requirements:**

```
Production Readiness (MANDATORY):
[✅/❌] Sentry Config Package loaded FIRST (Step 0.6)
[✅/❌] Sentry SDK scripts loaded (bundle, captureconsole, browserprofiling)
[✅/❌] initSentry() function defined with SentryConfig
[✅/❌] trackAssetError() function added (CRITICAL)
[✅/❌] Asset error handlers added for img/video/audio (CRITICAL)
[✅/❌] Global error handlers added (error, unhandledrejection)
[✅/❌] Sentry initializes correctly (console log shows version)
[✅/❌] Error tracking tested (test error sent to Sentry)

Testing:
[✅/❌] Tested in Chrome (file://)
[✅/❌] testAudioUrls() run - URLs accessible
[✅/❌] testAudio() run - audio plays
[✅/❌] debugAudio() run - AudioKit state checked
[✅/❌] debugGame() run - game state checked
[✅/❌] Browser console clean (no errors)
[✅/❌] Event tracking logs verified
[✅/❌] 2-3 gameplay rounds completed
[✅/❌] Platform testing completed (if registered)
```

**If any item is ❌:**

```
Fix Checklist:
[ ] Fix issue immediately
[ ] Re-test after fix
[ ] Re-verify both checklists
[ ] Confirm all items are ✅ before proceeding
```

---

## Request Final Approval

**Show ONLY checklist status and test URLs:**

```
✅ All checklist items completed

🌐 Test URLs:
   Local: file://$(pwd)/games/[gameId]/index.html
   Learn: https://learn.mathai.ai/game/[gameId]/[contentSetId]

Game is ready for production!
```

**Wait for explicit approval before marking complete.**
