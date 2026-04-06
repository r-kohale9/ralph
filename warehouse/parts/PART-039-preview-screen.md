# PART-039: Preview Screen

**Category:** MANDATORY | **Condition:** Every game (preview/instruction screen before interaction starts) | **Dependencies:** PART-002, PART-017, PART-025

---

## Overview

The PreviewScreenComponent shows a preview/instruction screen before the game starts. It is loaded as a CDN package (not inline code) and injected into a ScreenLayout slot. Every game MUST include a preview screen.

The component handles:
- Header bar with back button, avatar video, question label, score, star
- Timer progress bar (synced to audio duration, or 5s default)
- Instruction text (HTML, left-aligned)
- Optional preview content area (game-specific)
- "Skip & show options" button

## ScreenLayout Configuration

```javascript
ScreenLayout.inject('app', {
  slots: { progressBar: true, previewScreen: true, transitionScreen: true }
});
```

## Instantiation (in DOMContentLoaded)

```javascript
const previewScreen = new PreviewScreenComponent({
  autoInject: true,
  slotId: 'mathai-preview-slot',
  gameContentId: 'gameContent'
});
```

## show() Options

| Option | Type | Description |
|--------|------|-------------|
| `instruction` | string | HTML string with rich content (bold, images, video) |
| `audioUrl` | string | URL of preview audio (optional — defaults to 5s timer) |
| `previewContent` | string | Pre-rendered HTML for preview area (optional) |
| `onComplete` | function | Callback(previewData) when preview ends |
| `onPreviewInteraction` | function | Callback(interactionData) on user interaction |

**Note:** `questionLabel`, `score`, and `showStar` are read automatically from the `game_init` postMessage payload — do NOT pass them in `show()` config.

## Game Flow Integration

In the `game_init` postMessage handler, show the preview screen instead of starting the game directly:

```javascript
// In game_init handler:
const content = gameState.content;

// NEVER hardcode instruction — always read from content with fallback
previewScreen.show({
  instruction: content.previewInstruction || fallbackContent.previewInstruction,
  audioUrl: content.previewAudio || fallbackContent.previewAudio || null,
  previewContent: content.previewContent || null,
  onComplete: function(previewData) {
    startGameAfterPreview(previewData);
  }
});
```

## Audio URL Sources (3 layers)

1. **Build time (pipeline):** After HTML is approved, the pipeline calls the TTS API and patches `fallbackContent.previewAudio` with a CDN URL. Standalone mode uses this.
2. **Content set (runtime):** `game_init` payload provides `content.previewAudio` from the content set, which overrides fallbackContent.
3. **Runtime fallback (component):** If no audio URL is provided at all, the component auto-generates audio from the instruction text by calling the TTS API directly from the browser. If TTS fails, falls back to a 5s silent timer.

## startGameAfterPreview()

**CRITICAL:** `gameState.startTime` must NOT be set until preview ends.

```javascript
function startGameAfterPreview(previewData) {
  // Store preview result for game_complete payload
  gameState.previewResult = previewData;

  // Track preview duration
  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  // NOW start the actual game
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (typeof timer !== 'undefined' && timer.start) timer.start();
  trackEvent('game_start', 'game');

  if (typeof signalCollector !== 'undefined') {
    signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });
  }

  renderRound(); // or setupRound() — start first question
}
```

## Content Fields in fallbackContent

```javascript
const fallbackContent = {
  // Preview screen defaults (from spec)
  previewInstruction: '<p>Instruction text here...</p>',
  previewAudioText: 'Narration text for TTS generation',
  previewAudio: 'https://cdn.mathai.ai/.../<generated-audio-hash>.mp3',
  previewContent: null, // Optional data for preview area

  // Game rounds
  rounds: [...]
};
```

- `previewAudioText` is read by the pipeline at build time and converted to audio via TTS API
- The resulting CDN URL is baked into `previewAudio` in the generated HTML
- At runtime, `game_init` payload can override these with content-set-specific values

## Preview Content Data Flow

The component receives a **pre-rendered HTML string** for the preview content area. The game code is responsible for merging content data with its HTML template:

1. Content set stores preview content **data** (e.g. `{ question: "...", options: ["Yes", "No"] }`)
2. Game HTML has the preview **template** (UI structure)
3. Game code merges data + template into HTML string
4. Passes merged HTML as `config.previewContent` to the component
5. `fallbackContent` provides default preview content data for standalone mode

### Capturing User Interaction

For interactive previews (e.g. yes/no buttons), use `setPreviewData()`:

```javascript
// In preview content HTML:
onclick="previewScreen.setPreviewData('userChoice', 'yes')"

// Data flows: setPreviewData → onComplete(previewData) → gameState.previewResult → game_complete
```

## VisibilityTracker Integration

Wire VisibilityTracker callbacks to pause/resume the preview when user leaves/returns:

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: function() {
    previewScreen.pause(); // Pauses audio + progress bar
  },
  onResume: function() {
    previewScreen.resume(); // Resumes audio + progress bar
  }
});
```

## DOMContentLoaded — No TransitionScreen Before Preview

**CRITICAL:** When PART-039 is used (mandatory for all games), DOMContentLoaded must call `setupGame()` directly at the end of initialization — do NOT show a start TransitionScreen ("I'm ready!", "Let's go!", etc.) before the preview. The preview screen IS the first screen the user sees.

```javascript
// WRONG — TransitionScreen flashes before preview
transitionScreen.show({ title: "Let's go!", buttons: [{ text: "Start", action: setupGame }] });

// RIGHT — go directly to setupGame which shows the preview
setupGame();
```

The TransitionScreen component is still used for between-round transitions, victory, and game-over screens — just not as the initial start screen.

## Audio Permission

The preview screen always waits for audio permission before starting the timer/audio, even when no audio is configured. This ensures the FeedbackManager permission popup is not covering the preview when the timer starts.

## Methods

| Method | Description |
|--------|-------------|
| `show(config)` | Show preview screen with config |
| `hide()` | Hide preview, show game content |
| `pause()` | Pause audio + progress bar (for VisibilityTracker) |
| `resume()` | Resume audio + progress bar |
| `skip()` | Skip preview, call onComplete, hide |
| `setPreviewData(key, value)` | Store user interaction data |
| `destroy()` | Hide + clear DOM |

## Verification Checklist

- [ ] PreviewScreenComponent instantiated in DOMContentLoaded
- [ ] ScreenLayout.inject() includes `previewScreen: true`
- [ ] previewScreen.show() called in game_init handler
- [ ] startGameAfterPreview() sets gameState.startTime AFTER preview ends
- [ ] gameState.duration_data.preview[] populated with { duration }
- [ ] VisibilityTracker wired to pause/resume
- [ ] No `new Audio()` for preview audio (must use FeedbackManager)
- [ ] Preview audio preloaded via FeedbackManager.sound.preload()
- [ ] gameState.previewResult included in game_complete payload if interactive
