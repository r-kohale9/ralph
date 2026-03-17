# Feedback Integration Checklist

## When to Use

**Phase 3 only** - add audio, subtitles, and stickers after Phase 1 & 2 approved.

## Prerequisites

- [ ] Phase 1 completed (FeedbackManager loaded and initialized)
- [ ] Phase 2 completed (validation working)
- [ ] Feedback plan approved by user

## Critical Rules

⚠️ **Static Audio:** `FeedbackManager.sound.play(id, { subtitle, sticker })`

⚠️ **Dynamic Audio API (ONLY THIS):** `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text=YOUR_MESSAGE`

⚠️ **API Returns 2 Types:**

- **JSON (cached):** Use `FeedbackManager.sound` (preload + play)
- **Audio stream:** Use `FeedbackManager.stream` (addFromResponse + play)

🚨 **URL Sources (CRITICAL - NO EXCEPTIONS):**

URLs for audio and stickers can ONLY come from these sources:
- **`mathai-feedback:search_feedback`** - Search feedback library and use returned URLs
- **`mathai-feedback:create_feedback`** - Generate new audio and use returned URL
- **`mathai-feedback:upload_feedback`** - Upload user-provided files and use returned URL
- **User-provided URLs** - Explicit URLs given by the user

❌ **NEVER GENERATE ARBITRARY URLs:**
- NO fabricated URLs (e.g., `https://cdn.mathai.ai/audio/tap.mp3` without MCP confirmation)
- NO placeholder URLs (e.g., `https://example.com/...`, `https://.../file.mp3`)
- NO assumed CDN paths
- NO guessed file locations
- **Every URL must be explicitly returned by an MCP tool or provided by the user**

❌ **NEVER:**

- Use `new Audio()` directly
- Use wrong APIs: `/api/generate-audio`, OpenAI, localhost, custom endpoints
- Call `SubtitleComponent.show()` or `StickerComponent.show()` directly
- Use string for sticker (must be object)
- Generate or fabricate audio/sticker URLs

## Quick Start (Static Audio)

```javascript
// 1. Define and preload assets
const feedbackAssets = [
  { id: "tap", url: "https://.../tap.mp3" },
  { id: "correct", url: "https://.../correct.mp3" },
];

window.addEventListener("DOMContentLoaded", async () => {
  await FeedbackManager.init();
  await FeedbackManager.sound.preload(feedbackAssets);
});

// 2. Play with feedback
await FeedbackManager.sound.play("correct", {
  subtitle: "Great job!",
  sticker: {
    type: "IMAGE_GIF",
    image: "https://example.com/sticker.gif",
    alignment: "RIGHT",
  },
});
```

## Dynamic Audio (Runtime Messages)

### ✅ RECOMMENDED: Simplified Method

**Use `FeedbackManager.playDynamicFeedback()` - handles everything automatically:**

```javascript
async function playDynamicFeedback(message, stickerUrl = null, subtitleText = null) {
  try {
    // ✅ NEW SIMPLIFIED METHOD - Handles both cached and streaming automatically
    await FeedbackManager.playDynamicFeedback({
      audio_content: message,
      subtitle: subtitleText || message,
      sticker: stickerUrl
    });

    console.log("✅ Dynamic feedback played successfully");
  } catch (error) {
    console.error("Error playing dynamic feedback:", error);
  }
}

// Usage examples

// Audio only
await playDynamicFeedback("You scored 95 points!");

// Audio + Sticker
await playDynamicFeedback(
  "You scored 95 points!",
  "https://example.com/trophy.gif"
);

// Audio + Custom Subtitle + Sticker
await playDynamicFeedback(
  "You scored ninety five points!",  // Audio content
  "https://example.com/trophy.gif",   // Sticker
  "You scored 95 points!"             // Custom subtitle
);
```

**What it does:**
- Automatically detects cached vs streaming audio
- Handles ID generation and consistency
- Auto-cleanup when audio completes
- Integrated subtitle and sticker display
- No need to check content-type headers
- No manual stream management

### Advanced: Manual Implementation

**Only use this if you need custom control over the audio lifecycle:**

<details>
<summary>Click to expand manual implementation</summary>

**🚨 CRITICAL: Audio ID Consistency**

When using dynamic audio manually, the ID used in `preload()` MUST match the ID used in `play()`. Using `Date.now()` in both places generates different timestamps, causing the audio to not play.

**❌ WRONG - Different IDs:**
```javascript
// This will NOT work - IDs are different!
await FeedbackManager.sound.preload([
  { id: `dynamic-${Date.now()}`, url: audio_url },
]);
await FeedbackManager.sound.play(`dynamic-${Date.now()}`, feedbackOptions); // Different timestamp!
```

**✅ CORRECT - Same ID:**
```javascript
// Store the ID in a variable and reuse it
const audioId = `dynamic-${Date.now()}`;
await FeedbackManager.sound.preload([
  { id: audioId, url: audio_url },
]);
await FeedbackManager.sound.play(audioId, feedbackOptions); // Same ID!
```

**Complete Manual Implementation:**

```javascript
async function playDynamicFeedbackManual(message, stickerUrl = null) {
  try {
    const encodedText = encodeURIComponent(message);
    const response = await fetch(
      `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio?text=${encodedText}`
    );

    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const contentType = response.headers.get("content-type");
    const feedbackOptions = {
      subtitle: message,
      sticker: stickerUrl
        ? {
            type: "IMAGE_GIF",
            image: stickerUrl,
            alignment: "CENTER",
          }
        : null,
    };

    if (contentType?.includes("application/json")) {
      // ✅ CACHED - Use FeedbackManager.sound
      const { audio_url } = await response.json();

      // 🚨 CRITICAL: Store ID in variable to ensure consistency
      const audioId = `dynamic-${Date.now()}`;

      await FeedbackManager.sound.preload([
        { id: audioId, url: audio_url },
      ]);
      await FeedbackManager.sound.play(audioId, feedbackOptions); // Use SAME ID
      console.log("✅ Cache HIT");
    } else {
      // ✅ STREAMING - Use FeedbackManager.stream
      const streamId = `stream-${Date.now()}`;
      await FeedbackManager.stream.addFromResponse(streamId, response);
      FeedbackManager.stream.play(
        streamId,
        {
          complete: () => FeedbackManager.stream.remove(streamId),
          error: (msg) => console.error("Stream error:", msg),
        },
        feedbackOptions
      );
      console.log("⚡ Cache MISS");
    }
  } catch (error) {
    console.error("Error playing dynamic feedback:", error);
  }
}
```

</details>

## VisibilityTracker Integration

```javascript
const visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    if (timer) timer.pause();
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    if (timer && timer.isPaused) timer.resume();
    FeedbackManager.sound.resume();
    FeedbackManager.stream.resumeAll();
  },
  popupProps: {
    title: "Game Paused",
    description: "Click Resume to continue.",
    primaryText: "Resume",
  },
});
```

## Anti-Patterns

```javascript
// ❌ WRONG - Using new Audio()
const audio = new Audio(url);
audio.play();

// ❌ WRONG - Different IDs in preload and play (MOST COMMON ERROR)
await FeedbackManager.sound.preload([
  { id: `dynamic-${Date.now()}`, url: audio_url },
]);
await FeedbackManager.sound.play(`dynamic-${Date.now()}`, feedbackOptions); // Different ID!

// ❌ WRONG - Only handling streaming (ignores cached responses)
await FeedbackManager.stream.addFromResponse("id", response); // Will fail for JSON

// ❌ WRONG - Wrong API
fetch("/api/generate-audio"); // Use exact API only

// ❌ WRONG - String sticker
FeedbackManager.sound.play("id", { sticker: "sparkle" }); // Must be object
```

## Verification Checklist

### URL Source Verification (MUST CHECK FIRST)

- [ ] **Every audio URL** came from `mathai-feedback:search_feedback`, `create_feedback`, or `upload_feedback` MCP tool
- [ ] **Every sticker URL** came from `mathai-feedback:upload_feedback` MCP tool or user-provided URL
- [ ] **NO fabricated URLs** (e.g., NO `https://cdn.mathai.ai/audio/tap.mp3` without MCP confirmation)
- [ ] **NO placeholder URLs** (e.g., NO `https://example.com/...` or `https://.../file.mp3`)
- [ ] **NO guessed CDN paths** - every URL explicitly returned by MCP or user
- [ ] If audio not found in DB, marked as "not found" (NOT replaced with fake URL)

### Setup

- [ ] feedbackAssets defined and preloaded after `FeedbackManager.init()`
- [ ] VisibilityTracker pauses/resumes both sound AND stream

### Static Audio

- [ ] Use `FeedbackManager.sound.play(id, { subtitle, sticker })`
- [ ] Options object always present
- [ ] Sticker is object with `type: "IMAGE_GIF"`, `image`, `alignment`

### Dynamic Audio

- [ ] Use EXACT API: `https://asia-south1-mathai-449208.cloudfunctions.net/generate-audio`
- [ ] Check `Content-Type` header to detect cached vs streaming
- [ ] **Cached (JSON):** Extract `audio_url`, preload, play with `FeedbackManager.sound`
- [ ] **🚨 CRITICAL: Store audio ID in variable** - Same ID used in both `preload()` and `play()`
- [ ] VERIFY: ID is NOT generated twice (e.g., NOT using `Date.now()` twice)
- [ ] **Streaming (audio):** Use `FeedbackManager.stream.addFromResponse()` + `play()`
- [ ] Include `stream.remove()` in complete callback
- [ ] NO `new Audio()`, NO wrong APIs

### Testing

- [ ] Audio plays correctly (both static and dynamic)
- [ ] Subtitles appear/disappear
- [ ] Stickers animate
- [ ] Tab switch pauses/resumes
- [ ] No console errors

## Reference

- Full API: [components/feedback-manager.md](../../components/feedback-manager.md)
- Correct patterns: [examples/correct-patterns.md](../../examples/correct-patterns.md)
- Quick reference: [examples/QUICK-REFERENCE.md](../../examples/QUICK-REFERENCE.md)
