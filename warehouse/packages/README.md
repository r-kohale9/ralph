# MathAI Game Packages — Source Reference

> **Purpose:** This directory contains the actual source code for all CDN-hosted packages used by MathAI games. During fix iterations, the LLM can read these files to understand real implementation details — method signatures, return values, error handling, internal state — rather than relying on documentation summaries alone.

---

## Script Tags (required in every game, in this exact order)

```html
<!-- 1. FeedbackManager MUST load FIRST -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load SECOND -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load THIRD -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**Order is non-negotiable.** FeedbackManager loads SubtitleComponent internally. If Components loads first, SubtitleComponent gets registered twice → duplicate registration errors.

### Styles (required in `<head>`)

```html
<link rel="stylesheet" href="https://storage.googleapis.com/test-dynamic-assets/packages/components/styles/mathai-game-styles.css">
```

All CDN URLs share the base: `https://storage.googleapis.com/test-dynamic-assets/packages/`

---

## Package Index

| Global Name | Source Path (relative to this dir) | Loaded Via |
|---|---|---|
| **FeedbackManager** | `feedback-manager/index.js` | Direct script tag (1st) |
| **ScreenLayoutComponent** / **ScreenLayout** | `components/screen-layout/index.js` | components/index.js |
| **ProgressBarComponent** | `components/progress-bar/index.js` | components/index.js |
| **TransitionScreenComponent** | `components/transition-screen/index.js` | components/index.js |
| **TimerComponent** | `components/timer/index.js` | components/index.js |
| **SubtitleComponent** | `components/subtitle/index.js` | FeedbackManager (internal — do NOT call directly) |
| **StickerComponent** | `components/sticker/index.js` | FeedbackManager (internal — do NOT call directly) |
| **PopupComponent** | `components/popup-layout/index.js` | FeedbackManager / VisibilityTracker (internal) |
| **StoriesComponent** | `components/stories/index.js` | components/index.js |
| **VisibilityTracker** | `helpers/visibility-tracker/index.js` | helpers/index.js |
| **InteractionManager** | `helpers/interaction-manager/index.js` | helpers/index.js |
| **SignalCollector** | `helpers/signal-collector/index.js` | helpers/index.js |
| **APIHelper** | `helpers/api-helper/index.js` | helpers/index.js |
| **subjectiveEvaluation** / **createEvaluator** | `helpers/subjective-evaluation/index.js` | helpers/index.js |
| **AnalyticsManager** | `helpers/analytics/index.js` | helpers/index.js |
| **SentryConfig** | `helpers/sentry/index.js` | Direct script tag (before all others) |

### Bundle Entry Points

| Bundle | Source | What it loads |
|---|---|---|
| `components/index.js` | `components/index.js` | ScreenLayout, ProgressBar, TransitionScreen, Timer, Stories. Exposes `window.MathAIComponents`. |
| `helpers/index.js` | `helpers/index.js` | VisibilityTracker, InteractionManager, SignalCollector, APIHelper, SubjectiveEvaluation, Analytics. Exposes `window.MathAIHelpers`. |
| `feedback-manager/index.js` | `feedback-manager/index.js` | SoundManager, StreamManager, PopupManager, FeedbackComponentsManager (Subtitle + Sticker). Exposes `window.FeedbackManager`. |

---

## Quick API Reference

### FeedbackManager

```javascript
await FeedbackManager.init();
// REQUIRED before any feedback. Loads SubtitleComponent + StickerComponent internally.
// Without this, subtitles/stickers silently skip ("Subtitle component not loaded, skipping").

await FeedbackManager.sound.preload([{ id: 'correct', url: '...' }, { id: 'wrong', url: '...' }]);
// Preload audio files. Returns array of { id, status }.
// There is NO register() method. Only preload().

await FeedbackManager.sound.play('correct', {
  subtitle: 'Great job!',
  sticker: { image: 'https://...gif', duration: 2, type: 'IMAGE_GIF' }
});
// Play preloaded audio by ID. Subtitle + sticker are objects.
// Returns a Promise — await it, then do next action. There is NO onComplete callback.

await FeedbackManager.playDynamicFeedback({
  audio_content: 'You scored 80%!',
  subtitle: 'You scored 80%!',
  sticker: 'https://...gif'       // URL string — NOT an object (unlike sound.play)
});
// TTS: generates audio from text. Top-level method, NOT on .sound.

FeedbackManager.sound.pause();     // Use in VisibilityTracker onInactive
FeedbackManager.sound.resume();    // Use in VisibilityTracker onResume
// NEVER use stopAll() in VisibilityTracker — it destroys state and can't resume.
```

### ScreenLayout

```javascript
ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
// MUST use { slots: {...} } wrapper. Passing flags directly causes blank page (#gameContent not created).
// Returns: { progressSlot, transitionSlot, gameContent }
```

### ProgressBarComponent

```javascript
const progressBar = new ProgressBarComponent({
  autoInject: true,
  slotId: 'mathai-progress-slot',  // or the ID from ScreenLayout.inject()
  totalRounds: 3,
  totalLives: 3
});

progressBar.update(roundsCompleted, livesRemaining);
// 2 positional args. roundsCompleted=0 on first round (0 completed yet).

progressBar.destroy();
```

### TransitionScreenComponent

```javascript
const transitionScreen = new TransitionScreenComponent({
  autoInject: true,
  slotId: 'mathai-transition-slot',
  gameContentId: 'gameContent'
});

transitionScreen.show({
  title: 'Round Complete!',
  subtitle: 'Next round starting...',
  buttons: [{ text: 'Continue', onClick: () => { transitionScreen.hide(); }, primary: true }]
});

transitionScreen.hide();
// Inline content replacement — NOT a modal overlay. Toggles with game content.
```

### TimerComponent

```javascript
const timer = new TimerComponent('containerId', {
  timerType: 'decrease',    // 'increase' or 'decrease'
  format: 'min',            // 'sec' or 'min'
  startTime: 300,           // seconds
  endTime: 0,
  autoStart: true,
  onEnd: () => { /* time's up */ }
});

timer.start() / timer.pause({ fromAudio: true }) / timer.resume({ fromAudio: true }) / timer.stop();
timer.getCurrentTime();     // current seconds
timer.getTimeTaken();       // elapsed seconds
timer.destroy();
```

### VisibilityTracker

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    FeedbackManager.sound.pause();        // NOT stopAll()
    FeedbackManager.stream.pauseAll();
    if (timer) timer.pause();
  },
  onResume: () => {
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
    if (timer) timer.resume();
  },
  autoShowPopup: true
});
// Auto-starts on construction. Shows "Resume Activity" popup on tab switch.

visibilityTracker.destroy();
```

### SignalCollector

```javascript
const signalCollector = new SignalCollector({ gameId: 'game_my_game' });

signalCollector.recordViewEvent('content_render', { screen: 'gameplay', content_snapshot: { question_text: 'Solve...', round: 1 } });
signalCollector.recordCustomEvent('round_solved', { correct: true, answer: 42 });
// Captures raw input events (clicks, taps, drags, touch gestures), flushes batches to GCS.
```

### InteractionManager

```javascript
const interactionManager = new InteractionManager({
  selector: '.game-play-area',
  disableOnAudioFeedback: true,
  disableOnEvaluation: true
});

interactionManager.disable('evaluation');
interactionManager.enable('user_action');
interactionManager.isInteractive();
// Controls pointer-events CSS on the game area.
```

---

## Directory Structure

```
packages/
├── components/
│   ├── index.js              ← Bundle loader (loads all components below)
│   ├── screen-layout/index.js
│   ├── progress-bar/index.js
│   ├── transition-screen/index.js
│   ├── timer/index.js
│   ├── subtitle/index.js     ← Loaded internally by FeedbackManager
│   ├── sticker/index.js      ← Loaded internally by FeedbackManager
│   ├── popup-layout/index.js ← Loaded internally by FeedbackManager/VisibilityTracker
│   ├── stories/index.js
│   └── usage.html
│
├── helpers/
│   ├── index.js              ← Bundle loader (loads all helpers below)
│   ├── visibility-tracker/index.js
│   ├── interaction-manager/index.js
│   ├── signal-collector/index.js
│   ├── api-helper/index.js
│   ├── subjective-evaluation/index.js
│   ├── analytics/index.js + config.js
│   ├── sentry/index.js
│   └── usage.html
│
├── feedback-manager/
│   ├── index.js              ← FeedbackManager (SoundManager + StreamManager + Subtitle/Sticker integration)
│   ├── bufferedStreamReader.js
│   └── usage.html
│
├── styles/
│   └── mathai-game-styles.css ← CSS variables + base layout classes
│
└── README.md                  ← This file
```

---

## When to Read Source Code

During fix iterations, read the actual source file when:
- A test fails due to wrong method signature, missing return value, or unexpected behavior
- Console errors reference package internals (e.g., "Subtitle component not loaded, skipping")
- You need to understand callback timing, promise resolution, or internal state
- The parts documentation (PART-002, PART-017, etc.) doesn't cover the specific detail you need
- You're debugging audio playback, preload, or permission flow issues

**Source paths in this directory match the CDN path structure**, so `feedback-manager/index.js` here is the same code served from `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`.
