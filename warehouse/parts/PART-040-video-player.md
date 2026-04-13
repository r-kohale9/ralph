# PART-040: Video Player

**Category:** CONDITIONAL | **Condition:** Game includes video content (instructional video, pattern video, story video, etc.) | **Dependencies:** PART-020, PART-025, PART-027

---

## Purpose

Provides a standardized video player pattern for games that embed video content. Styling matches the production `VideoPart.tsx` component from `mathai-client` — full-width, white background, native browser controls, no fullscreen button, inline playback on mobile.

---

## HTML Pattern

```html
<div class="video-wrapper" id="videoContainer">
  <video id="gameVideo" controls playsinline webkit-playsinline
         preload="auto" controlsList="nofullscreen">
    <source id="videoSource" src="" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
```

### Required Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `controls` | (boolean) | Shows native play/pause/progress/volume controls |
| `playsinline` | (boolean) | Prevents fullscreen takeover on iOS |
| `webkit-playsinline` | (boolean) | Fallback for older Safari |
| `preload` | `"auto"` | Preloads video for smoother playback |
| `controlsList` | `"nofullscreen"` | Hides the fullscreen button |

### Attributes to NEVER use

| Attribute | Why |
|-----------|-----|
| `autoplay` | Blocked by browser autoplay policies; causes silent failures |
| `muted autoplay` | Unexpected UX — user should explicitly tap play |
| `poster` | Not needed — native controls show first frame |
| `loop` | Games need to detect video end for flow control |

---

## CSS

```css
/* Video wrapper — matches VideoPart.tsx from mathai-client */
.video-wrapper {
  width: 100%;
  margin: 10px 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.video-wrapper video {
  width: 100%;
  display: block;
}
```

### Key Design Decisions

- **White background** (not black) — matches the production app's `VideoPart.tsx`
- **No fixed aspect-ratio** — the video element determines its own natural height from the source
- **No `object-fit`** — `width: 100%` with auto height lets the browser render at native ratio
- **`display: block`** — removes inline element gap below video
- **`border-radius: 12px`** with `overflow: hidden` — rounded corners clipping the video
- **`margin: 10px 0`** — breathing room above/below (matches `mb-[10px] mt-[10px]` from VideoPart.tsx)

---

## JavaScript — Setup & Event Handling

### Video Source Setup

```javascript
function loadVideo(videoUrl) {
  var videoSource = document.getElementById('videoSource');
  var gameVideo = document.getElementById('gameVideo');
  if (videoSource && gameVideo) {
    videoSource.src = videoUrl;
    gameVideo.load();
  }
}
```

### Event Listeners (attach in setupGame)

```javascript
var gameVideo = document.getElementById('gameVideo');
if (gameVideo) {
  // Track when video finishes playing
  gameVideo.addEventListener('ended', function() {
    gameState.videoPlayed = true;
    trackEvent('video_played', 'video', {});
    console.log('[Video] Playback completed');
  });

  // Error handling — log failures for debugging
  gameVideo.addEventListener('error', function(e) {
    var error = e.target.error;
    console.error('[Video Error] Code: ' + (error ? error.code : 'unknown') +
                  ', Message: ' + (error ? error.message : 'unknown'));
    trackEvent('video_error', 'video', { code: error ? error.code : -1 });
  });
}
```

### Game State Fields

Add to `window.gameState`:

```javascript
videoPlayed: false,  // Whether video has been played at least once
```

---

## Placement in ScreenLayout

The video player is **part of the instruction/question area**, NOT the interactive play area. Typical layout:

```
┌─────────────────────────┐
│  Instruction text        │  ← .instruction-area (or questionText section)
│  ┌───────────────────┐  │
│  │   Video Player     │  │  ← .video-wrapper
│  │   (with controls)  │  │
│  └───────────────────┘  │
├─────────────────────────┤
│  Prompt text             │  ← .game-play-area
│  [Option A] [B] [C]     │
│      [ Submit ]          │
└─────────────────────────┘
```

When the video is the "question" (e.g., pattern recognition), group it with the instruction text above the interactive play area.

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| `background: #000` on video container | `background: white` (matches production app) |
| `aspect-ratio: 9/16` or any forced ratio | Let video determine natural dimensions |
| `object-fit: contain` with fixed height | `width: 100%; display: block` — natural sizing |
| Missing `controls` attribute | Always include — user must be able to play/pause |
| `autoplay` or `muted autoplay` | Never — user taps play explicitly |
| `<video>` without error listener | Always attach error handler for debugging |
| Video inside `.game-play-area` as interaction | Video goes in instruction area; options go in play area |

---

## Verification

- [ ] Video element has `controls playsinline webkit-playsinline` attributes
- [ ] Video element has `controlsList="nofullscreen"`
- [ ] Video element has `preload="auto"`
- [ ] Video wrapper has `background: white` (not black)
- [ ] Video wrapper has `border-radius: 12px` with `overflow: hidden`
- [ ] Video CSS uses `width: 100%; display: block` — no forced aspect ratio
- [ ] Error event listener attached to video element
- [ ] Ended event listener tracks `gameState.videoPlayed`
- [ ] Video source updates via `src` change + `.load()` call
- [ ] No `autoplay`, `muted`, `poster`, or `loop` attributes
- [ ] Video placed in instruction/question area, not interactive play area
