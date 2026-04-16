# PART-017: Feedback Integration

**Category:** EXTENSION | **Condition:** Added after initial HTML is approved | **Dependencies:** PART-003

---

This part is NOT included in initial HTML generation. It's added later via Edit.

## Standard Assets

### Audio URLs

| Sound ID | URL | When to Use |
|----------|-----|-------------|
| `correct_tap` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3` | Simple correct answer feedback |
| `wrong_tap` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3` | Simple incorrect answer feedback |
| `all_correct` | `https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/ab12c9db-1f0c-4ce3-a215-afc86e385df8.mp3` | All parts of answer correct |
| `partial_correct_attempt1` | `https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/45389c85-82d1-47af-ab9c-37327f9df527.mp3` | Partially correct, retries remaining |
| `partial_correct_last_attempt` | `https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2061b06a-12ee-4edf-a850-7b86ee9cdabd.mp3` | Partially correct, no retries left |
| `all_incorrect_attempt1` | `https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/b3faaea8-4fc0-4169-ab5e-6699097b8257.mp3` | All wrong, retries remaining |
| `all_incorrect_last_attempt` | `https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/6420e861-2213-4855-8992-e3e964fabb29.mp3` | All wrong, no retries left |

**When to use which:** Use `correct_tap`/`wrong_tap` for simple right/wrong games. Use the detailed variants (`all_correct`, `partial_correct_*`, `all_incorrect_*`) for games with multi-part answers or multiple attempts per question.

### Sticker URLs

| Sticker ID | URL | Type | When to Use |
|------------|-----|------|-------------|
| `correct` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif` | `IMAGE_GIF` | Correct answer |
| `incorrect` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif` | `IMAGE_GIF` | Incorrect answer |
| `checking` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-47.gif` | `IMAGE_GIF` | While evaluating (e.g., subjective eval loading) |
| `all_correct` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-91.gif` | `IMAGE_GIF` | All parts correct |
| `partial_correct` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-51.gif` | `IMAGE_GIF` | Partially correct (any attempt) |
| `try_again` | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1742961316441-80.gif` | `IMAGE_GIF` | Encouraging retry |

## Code — Audio Preloading

**MUST use `preload()` with an array of `{id, url}` objects. There is NO `register()` method.**

```javascript
// Simple games — preload just correct/wrong
try {
  await FeedbackManager.sound.preload([
    { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
    { id: 'wrong_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
  ]);
} catch(e) { console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2)); }

// Multi-part / multi-attempt games — preload all feedback variants
try {
  await FeedbackManager.sound.preload([
    { id: 'all_correct', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/ab12c9db-1f0c-4ce3-a215-afc86e385df8.mp3' },
    { id: 'partial_correct_attempt1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/45389c85-82d1-47af-ab9c-37327f9df527.mp3' },
    { id: 'partial_correct_last_attempt', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/2061b06a-12ee-4edf-a850-7b86ee9cdabd.mp3' },
    { id: 'all_incorrect_attempt1', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/b3faaea8-4fc0-4169-ab5e-6699097b8257.mp3' },
    { id: 'all_incorrect_last_attempt', url: 'https://cdn.mathai.ai/mathai-assets/dev/worksheet/audio/6420e861-2213-4855-8992-e3e964fabb29.mp3' }
  ]);
} catch(e) { console.error('Sound preload error:', JSON.stringify({ error: e.message }, null, 2)); }
```

## Code — Playing Audio with Sticker

```javascript
// Correct answer — play audio + show correct sticker
await FeedbackManager.sound.play('correct_tap', {
  subtitle: '**Great job!** That is correct!',
  sticker: {
    image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif',
    duration: 2,
    type: 'IMAGE_GIF'
  }
});
// Next action goes here (after await resolves)

// Incorrect answer — play audio + show incorrect sticker
await FeedbackManager.sound.play('wrong_tap', {
  subtitle: 'Not quite. Try again!',
  sticker: {
    image: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif',
    duration: 2,
    type: 'IMAGE_GIF'
  }
});
// Next action goes here (after await resolves)
```

## Code — Dynamic Audio (TTS for completion)

```javascript
const text = `You scored ${accuracy}% in ${time} seconds!`;
await FeedbackManager.playDynamicFeedback({
  audio_content: text,
  subtitle: text,
  sticker: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json'
});
```

## Two Distinct APIs — Do NOT Confuse Them

### 1. Registered Sound (pre-loaded audio file)
```javascript
// Play a REGISTERED sound by its preloaded ID
// sound.play() is async — await it, then continue with next action
await FeedbackManager.sound.play('correct', {
  subtitle: 'Great job!',
  sticker: { image: '...', type: 'IMAGE_GIF' }
});
// Code here runs after audio finishes
```
The first argument is a **registered sound ID** (from `preload()`). This plays a local audio file.
`sound.play()` returns a Promise — use `await` and put your next action after it. There is NO `onComplete` callback.

### 2. Dynamic Feedback (TTS — generates audio from text)
```javascript
// Generate and play audio from TEXT (TTS streaming)
await FeedbackManager.playDynamicFeedback({
  audio_content: 'You scored 80% in 45 seconds!',
  subtitle: 'You scored 80% in 45 seconds!',
  sticker: '...'
});
```
This calls `playDynamicFeedback()` — a **top-level method** on FeedbackManager, NOT on `sound`.

### CRITICAL Anti-Pattern: Mixing the Two

```javascript
// WRONG — 'dynamic' is not a registered sound ID, this plays nothing
// and triggers a browser permission popup with no valid audio source
await FeedbackManager.sound.play('dynamic', { text: 'Great job!' });

// WRONG — sound.play() does not accept text/audio_content params
await FeedbackManager.sound.play('some-id', { audio_content: 'text' });

// CORRECT — use playDynamicFeedback for TTS
await FeedbackManager.playDynamicFeedback({
  audio_content: 'Great job!',
  subtitle: 'Great job!'
});
```

## Other Anti-Patterns

| Wrong | Correct |
|-------|---------|
| `new Audio('sound.mp3')` | `FeedbackManager.sound.play(id)` |
| `SubtitleComponent.show('text')` | `subtitle` prop in `sound.play()` |
| `FeedbackManager.sound.play('dynamic', {text})` | `FeedbackManager.playDynamicFeedback({audio_content, subtitle})` |
| `sound.play(id, { onComplete: fn })` | `await sound.play(id, {...}); fn();` — no `onComplete` callback exists |
| `sound.register('id', 'url')` | `sound.preload([{id, url}])` — `register()` does NOT exist |
| `sound.register('a', url1); sound.register('b', url2)` | `sound.preload([{id:'a', url:url1}, {id:'b', url:url2}])` — single batch call |
| `sound.stopAll()` in VisibilityTracker onInactive | `sound.pause()` — stopAll destroys state and can't resume |
| Preload in Phase 1 | Preload added in Phase 3 only |

## CRITICAL: `register()` Does NOT Exist

Many older templates incorrectly use `sound.register()`. This method **does not exist** on FeedbackManager.

```javascript
// WRONG — register() is not a real method, audio will silently fail
await FeedbackManager.sound.register('correct_tap', 'https://cdn.mathai.ai/.../1757501597903.mp3');
await FeedbackManager.sound.register('wrong_tap', 'https://cdn.mathai.ai/.../1757501956470.mp3');

// CORRECT — preload() takes an ARRAY of {id, url} objects (single batch call)
await FeedbackManager.sound.preload([
  { id: 'correct_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3' },
  { id: 'wrong_tap', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3' }
  // Add all_correct, partial_correct_*, all_incorrect_* for multi-attempt games
]);
```

## CRITICAL: VisibilityTracker Must Use `pause()` Not `stopAll()`

In VisibilityTracker `onInactive`, use `sound.pause()` — NOT `sound.stopAll()`. `stopAll()` destroys the audio state entirely and audio cannot be resumed when the user returns.

```javascript
// WRONG — destroys audio state, resume does nothing
onInactive: () => { FeedbackManager.sound.stopAll(); }
onResume: () => { /* nothing to resume */ }

// CORRECT — pause/resume preserves audio state
onInactive: () => { FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); }
onResume: () => { FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); }
```

## CRITICAL: No `Promise.race` on FeedbackManager Calls

FeedbackManager already bounds resolution internally:

| Method | Worst-case resolution time | Mechanism |
|---|---|---|
| `sound.play(id, opts)` | audio duration + 1.5s | Guard timeout → `finalizeVoice("timeout")` |
| `playDynamicFeedback({...})` | 60s streaming / 3s TTS API dead | Stream safety timeout + fetch timeout |

**Templates MUST NOT wrap these calls in `Promise.race`.** Phase/round transitions await audio completion directly.

**Anti-pattern** (truncates normal TTS, causes round to advance while audio still plays):

```javascript
// WRONG — 800ms ceiling wins over normal 1–3s TTS; round advances before audio ends
function audioRace(p) {
  return Promise.race([ p, new Promise(r => setTimeout(r, 800)) ]);
}
await audioRace(FeedbackManager.sound.play('correct_sound_effect', { sticker }));
```

**Correct:**

```javascript
// RIGHT — full audio plays before transition
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker });
  await FeedbackManager.playDynamicFeedback({ audio_content, subtitle, sticker });
} catch (e) { /* non-blocking — see feedback SKILL Rule 8 */ }
```

"Non-blocking" means `try/catch`, not `Promise.race`. Validator rule: `5e0-FEEDBACK-RACE-FORBIDDEN`.

## Verification

- [ ] `preload()` called with array of `{id, url}` objects — NOT `register()`
- [ ] No `sound.register()` calls anywhere
- [ ] `play()` uses asset IDs (not raw URLs)
- [ ] Subtitles passed as props (not SubtitleComponent.show())
- [ ] No `new Audio()` anywhere
- [ ] VisibilityTracker uses `sound.pause()`/`sound.resume()` — NOT `sound.stopAll()`
- [ ] No `Promise.race(...)` wrapping `FeedbackManager.sound.play` / `playDynamicFeedback` / `audioRace` helper; templates await FeedbackManager calls directly inside `try/catch`

## Source Code

Full FeedbackManager implementation: `warehouse/packages/feedback-manager/index.js`
- Contains SoundManager, StreamManager, AudioKitCore, PopupManager, FeedbackComponentsManager
- Read this source to understand: preload internals, play() promise behavior, subtitle/sticker timing, permission flow, iOS quirks

## Deep Reference

`mathai-game-builder/components/feedback-manager.md`
