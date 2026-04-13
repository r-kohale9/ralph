# PART-041: Audio Player

**Category:** CONDITIONAL | **Condition:** Game includes content audio with a visible player UI (instruction audio, listening exercises, etc.) | **Dependencies:** PART-020, PART-025, PART-027

---

## Purpose

Provides a standardized audio player with custom UI for games that embed content audio the user can play, pause, and replay. Styling matches the production `RenderAudioBlock.tsx` component from `mathai-client` — white card with play/pause icon + thin progress bar. Uses a hidden HTML5 `<audio>` element with custom controls (NOT native browser controls).

**This is NOT for feedback sounds.** FeedbackManager (PART-017) handles background audio (correct/incorrect beeps, celebration sounds, TTS). PART-041 is for visible, user-controlled content audio. Both can coexist in the same game.

---

## HTML Pattern

```html
<div class="audio-player-wrapper" id="audioPlayerWrapper">
  <div class="audio-player" id="audioPlayer">
    <img class="audio-play-btn" id="audioPlayBtn"
         src="https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg"
         alt="Play audio" />
    <div class="audio-progress-track" id="audioProgressTrack">
      <div class="audio-progress-fill" id="audioProgressFill"></div>
    </div>
    <audio id="gameAudio" preload="auto">
      <source id="audioSource" src="" type="audio/mpeg">
    </audio>
  </div>
</div>
```

### Required Setup

| Element | Purpose |
|---------|---------|
| `.audio-player` | 56px white card container with shadow |
| `#audioPlayBtn` | 40x40 play/pause toggle icon (CDN SVGs) |
| `.audio-progress-track` | 4px background track |
| `.audio-progress-fill` | 4px animated fill showing playback progress |
| `#gameAudio` | Hidden `<audio>` element — NO `controls` attribute |

### Icon URLs (from production RenderAudioBlock.tsx)

```
Play:  https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg
Pause: https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/pause-icon-yellow.svg
```

### Attributes to NEVER use on `<audio>`

| Attribute | Why |
|-----------|-----|
| `controls` | Custom UI replaces native controls — native controls break the design |
| `autoplay` | Blocked by browser policies; causes silent failures |
| `loop` | Games need to detect audio end for flow control |

---

## CSS

```css
/* Audio player — matches RenderAudioBlock.tsx from mathai-client */
.audio-player-wrapper {
  width: 100%;
  min-width: 200px;
}

.audio-player {
  width: 100%;
  height: 56px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.audio-play-btn {
  height: 40px;
  width: 40px;
  cursor: pointer;
  flex-shrink: 0;
}

.audio-progress-track {
  width: 100%;
  height: 4px;
  background: #FFF8DC; /* corn-silk — matches RenderAudioBlock */
  border-radius: 2px;
  overflow: hidden;
}

.audio-progress-fill {
  width: 0%;
  height: 4px;
  background: #FFDF00; /* gargoyle-gas yellow — matches RenderAudioBlock */
  border-radius: 2px;
  transition: width 0.1s linear;
}
```

### Key Design Decisions

- **White card with shadow** — matches production app, visually distinct from game content
- **56px fixed height** — consistent touch-friendly size
- **40x40 icon** — meets 44px touch target with padding
- **4px progress bar** — subtle, non-intrusive, yellow on cream
- **No native controls** — custom UI matches the app; native controls look different per browser

---

## JavaScript — Setup & Event Handling

### Audio Player Setup (call in setupGame)

```javascript
var gameAudio = document.getElementById('gameAudio');
var audioSource = document.getElementById('audioSource');
var audioPlayBtn = document.getElementById('audioPlayBtn');
var audioProgressFill = document.getElementById('audioProgressFill');
var audioIsPlaying = false;
var audioDuration = 1;

function loadAudio(audioUrl) {
  if (audioSource && gameAudio) {
    audioSource.src = audioUrl;
    gameAudio.load();
  }
}

function toggleAudioPlayback() {
  if (!gameAudio) return;
  if (audioIsPlaying) {
    gameAudio.pause();
  } else {
    gameAudio.play().catch(function(e) {
      console.log('[Audio] Play failed: ' + JSON.stringify(e.message));
    });
  }
}
```

### Event Listeners (attach in setupGame)

```javascript
if (gameAudio) {
  gameAudio.addEventListener('play', function() {
    audioIsPlaying = true;
    audioPlayBtn.src = 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/pause-icon-yellow.svg';
    audioPlayBtn.alt = 'Pause audio';
  });

  gameAudio.addEventListener('pause', function() {
    audioIsPlaying = false;
    audioPlayBtn.src = 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg';
    audioPlayBtn.alt = 'Play audio';
  });

  gameAudio.addEventListener('timeupdate', function() {
    if (audioDuration > 0 && audioProgressFill) {
      var pct = (gameAudio.currentTime / audioDuration) * 100;
      audioProgressFill.style.width = pct + '%';
    }
  });

  gameAudio.addEventListener('loadeddata', function() {
    audioDuration = gameAudio.duration || 1;
  });

  gameAudio.addEventListener('ended', function() {
    audioIsPlaying = false;
    audioPlayBtn.src = 'https://cdn.homeworkapp.ai/sets-gamify-assets/math-ai-assets/icons/play-icon-yellow.svg';
    audioPlayBtn.alt = 'Play audio';
    audioProgressFill.style.width = '100%';
    gameState.audioPlayed = true;
    trackEvent('audio_played', 'audio', {});
    console.log('[Audio] Playback completed');
  });

  gameAudio.addEventListener('error', function(e) {
    var error = e.target.error;
    console.error('[Audio Error] Code: ' + (error ? error.code : 'unknown'));
    trackEvent('audio_error', 'audio', { code: error ? error.code : -1 });
  });
}

// Play/pause button click
if (audioPlayBtn) {
  audioPlayBtn.addEventListener('click', toggleAudioPlayback);
}
```

### Game State Fields

Add to `window.gameState`:

```javascript
audioPlayed: false,  // Whether content audio has been played at least once
```

### Cleanup (in endGame)

```javascript
if (gameAudio) {
  gameAudio.pause();
  gameAudio.removeAttribute('src');
  gameAudio.load(); // Release resources
}
```

---

## Placement in ScreenLayout

The audio player is **part of the instruction/question area**, same as video (PART-040). Typical layout:

```
+---------------------------+
|  Instruction text          |  <- .instruction-area
|  [>  ====------  ]        |  <- .audio-player (play btn + progress)
|  [Video if also present]   |  <- .video-wrapper (optional)
+---------------------------+
|  Prompt text               |  <- .game-play-area
|  [Option A] [B] [C]       |
|      [ Submit ]            |
+---------------------------+
```

Audio and video can coexist in the same instruction area.

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| `new Audio('url.mp3')` | `<audio>` element in DOM with `<source>` tag |
| `<audio controls>` (native controls) | Hidden `<audio>` + custom play/pause icon + progress bar |
| `autoplay` attribute | User must tap play explicitly |
| `FeedbackManager.sound.play()` for content audio | FeedbackManager is for feedback sounds only; use `<audio>` element for content |
| Audio player inside `.game-play-area` | Place in `.instruction-area` above the interactive zone |
| Hardcoded icon paths | Use exact CDN URLs from this part |
| No error listener | Always attach error handler for debugging |

---

## Verification

- [ ] `<audio>` element present in DOM (NOT `new Audio()`)
- [ ] `<audio>` has NO `controls` attribute (custom UI used instead)
- [ ] `<audio>` has NO `autoplay` attribute
- [ ] `<audio>` has `preload="auto"`
- [ ] Play/pause icon uses CDN SVG URLs (play-icon-yellow.svg / pause-icon-yellow.svg)
- [ ] Play icon is 40x40px (meets touch target requirements)
- [ ] Progress bar track and fill elements exist
- [ ] `timeupdate` listener updates progress bar width
- [ ] `ended` listener resets icon and tracks `gameState.audioPlayed`
- [ ] `error` listener attached for debugging
- [ ] Audio player in instruction/question area, NOT in interactive play area
- [ ] Audio cleaned up in endGame (pause + release)
- [ ] `.audio-player` has white background + box-shadow + border-radius: 8px
