# PART-017: Feedback Integration

**Category:** EXTENSION | **Condition:** Added after initial HTML is approved | **Dependencies:** PART-003

---

This part is NOT included in initial HTML generation. It's added later via Edit.

## Code — Audio Preloading

```javascript
const feedbackAssets = {
  correct: 'https://storage.googleapis.com/...correct.mp3',
  incorrect: 'https://storage.googleapis.com/...incorrect.mp3',
  complete: 'https://storage.googleapis.com/...complete.mp3'
};

await FeedbackManager.sound.preload(
  Object.entries(feedbackAssets).map(([id, url]) => ({ id, url }))
);
```

## Code — Playing Audio with Subtitle

```javascript
await FeedbackManager.sound.play('correct', {
  subtitle: '**Great job!** That is correct!',
  sticker: {
    image: 'https://cdn.mathai.ai/mathai-assets/lottie/star.json',
    loop: false,
    duration: 2,
    type: 'IMAGE_GIF'
  },
  onComplete: () => { /* next action */ }
});
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
await FeedbackManager.sound.play('correct', {
  subtitle: 'Great job!',
  sticker: { image: '...', type: 'IMAGE_GIF' }
});
```
The first argument is a **registered sound ID** (from `preload()`). This plays a local audio file.

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
| Preload in Phase 1 | Preload added in Phase 3 only |

## Verification

- [ ] `feedbackAssets` object with valid URLs
- [ ] `preload()` called with all assets
- [ ] `play()` uses asset IDs (not raw URLs)
- [ ] Subtitles passed as props (not SubtitleComponent.show())
- [ ] No `new Audio()` anywhere

## Deep Reference

`mathai-game-builder/components/feedback-manager.md`
