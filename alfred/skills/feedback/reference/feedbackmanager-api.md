# FeedbackManager API (Production Reference)

FeedbackManager is the CDN package (PART-017) that handles all audio, stickers, and subtitles. Games call it — they never build their own audio or overlay systems.

## CDN Script Tag

Include this script tag in `<head>` to load the FeedbackManager package:

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
```

This is the **exact production URL** — do not modify it, do not use any other URL.

## Initialization

```javascript
// 1. Wait for all packages to load
await waitForPackages(); // polls for FeedbackManager, TimerComponent, etc.

// 2. Initialize FeedbackManager
await FeedbackManager.init();

// 3. Preload all static audio (use exact URLs from the Standard Audio URLs table below)
await FeedbackManager.sound.preload([
  { id: 'correct_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3' },
  { id: 'incorrect_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3' },
  { id: 'victory_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506672258.mp3' },
  // ... all SFX and VO for this game — see Standard Audio URLs table
]);
```

All three steps happen once during DOMContentLoaded, before the first screen appears.

## Audio Readiness Check

Before the first audio plays (typically on the first level/round screen), wait for audio permission:

```javascript
await new Promise(function(resolve) {
  if (FeedbackManager.canPlayAudio()) return resolve();
  var check = setInterval(function() {
    if (FeedbackManager.canPlayAudio()) { clearInterval(check); resolve(); }
  }, 200);
  setTimeout(function() { clearInterval(check); resolve(); }, 15000);
});
```

This only needs to run once — on the first transition screen. After that, audio is unlocked for the session.

## Two Audio APIs

### 1. Static Audio — `FeedbackManager.sound.play(id, options)`

Plays a pre-recorded, preloaded sound by ID. Used for SFX and voiceovers.

```javascript
await FeedbackManager.sound.play('correct_sound_effect', {
  sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-95.gif'
});
```

**Parameters:**
- `id` (string, required) — matches an `id` from the `preload()` call
- `options.sticker` (string, optional) — URL to animated GIF sticker. The FeedbackManager wraps this internally into the required object format.
- `options.subtitle` (string, optional) — on-screen text, under 60 characters

**Returns:** Promise that resolves when the audio finishes playing.

### 2. Dynamic TTS — `FeedbackManager.playDynamicFeedback(options)`

Generates text-to-speech on the fly. Used for content-specific narration that can't be pre-recorded.

```javascript
// Transition-screen / end-game context: awaited is OK (CTA visible, user can interrupt)
await FeedbackManager.playDynamicFeedback({
  audio_content: 'Make 90',
  subtitle: 'Make 90',
  sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1759297084426-234.gif'
});

// Submit/answer handler context: FIRE-AND-FORGET. Next-round advance MUST NOT block on TTS.
FeedbackManager.playDynamicFeedback({
  audio_content: 'Great! 5 in the thousands place gives 5000',
  subtitle: 'Great! 5 in the thousands place gives 5000',
  sticker: CORRECT_STICKER
}).catch(function(e) { console.error('TTS error:', e.message); });
```

**When to await vs fire-and-forget:**
- **Await (transition-screen VO, end-game VO):** CTA is visible, user can interrupt via `_stopCurrentDynamic()`. Screen lifecycle is tied to audio pacing by design.
- **Fire-and-forget (submit/answer handlers):** Next-round transition MUST NOT block on TTS. Use `.catch()` only, never `await`. Re-enabling inputs is handled by `renderRound()` / `loadRound()` — the single source of truth.

**Parameters:**
- `audio_content` (string, required) — text to speak
- `subtitle` (string, optional) — on-screen text, under 60 characters
- `sticker` (string, optional) — URL to sticker GIF

**Returns:** Promise. Can be stored and stopped later via `FeedbackManager._stopCurrentDynamic()`.

## Control Methods

| Method | When to use |
|--------|------------|
| `FeedbackManager.sound.stopAll()` | CTA tapped on transition/results screen; new transition appearing |
| `FeedbackManager.sound.pause()` | Visibility hidden (tab switch) |
| `FeedbackManager.sound.resume()` | Visibility restored |
| `FeedbackManager.stream.pauseAll()` | Visibility hidden |
| `FeedbackManager.stream.resumeAll()` | Visibility restored |
| `FeedbackManager.stream.stopAll()` | Game cleanup / restart |
| `FeedbackManager._stopCurrentDynamic()` | Student interacts during TTS; new transition screen |
| `FeedbackManager.canPlayAudio()` | Audio readiness check before first play |

## Sticker Durations

| Moment | Sticker duration |
|--------|-----------------|
| Correct answer | 2s |
| Wrong answer | 2s |
| Round/level transition | 5s |
| Victory / game complete | 3–5s |
| Game over | 3–5s |
| Restart | 2s |

## Preload Sound Categories

Every game preloads sounds from these categories:

| Category | Example IDs | Required? |
|----------|------------|-----------|
| Correct SFX | `correct_sound_effect` | Yes |
| Wrong SFX | `incorrect_sound_effect` | Yes |
| Life lost SFX | `sound_life_lost` | Yes |
| Micro-interaction | `sound_bubble_select`, `sound_bubble_deselect`, `tap_sound` | If game has select/deselect |
| Round transition SFX | `rounds_sound_effect` | Yes |
| Level transition SFX | `sound_level_transition` | If game has levels |
| Victory SFX | `victory_sound_effect` | Yes |
| Game complete SFX | `game_complete_sound_effect` | Yes |
| Game over SFX | `game_over_sound_effect` | Yes |
| All correct SFX | `all_correct` | If game has multi-match rounds |
| Ambient | `new_cards` | If game has card/tile refresh |
| Chain progress | `soundChainComplete`, `soundPartialCorrect` | If game has multi-chain rounds |

**Note:** All VO (victory VO, game-over VO, round VO, level VO, restart VO) is handled via `FeedbackManager.playDynamicFeedback()` — NOT preloaded. Only SFX are preloaded.

## Standard Audio URLs (Production CDN)

**AUTHORITATIVE — single source of truth for sound ids.** Every id used in `FeedbackManager.sound.preload([{id, url}])`, `FeedbackManager.sound.play('<id>', ...)`, or any wrapper helper (`safePlaySound`, `awaitedPlay`) MUST come from the canonical table below. Invented ids — names like `bubble_pop_sfx` / `tap_select_sfx` / `game_correct_sound` that look canonical but are not in this table — are forbidden. The (id, URL) pair is fixed: an id always points at the same URL across all games. Custom sounds (a creator-supplied audio asset not in this table) require a spec-level declaration with both the id and the URL the creator wants attached; spec-creation captures these in a `creatorSounds` block (see spec-creation/SKILL.md). The static validator `GEN-SOUND-ID-CANONICAL` enforces this contract at build time.

**CRITICAL: Use these exact URLs. Do NOT invent or modify audio URLs.**

### SFX (Sound Effects)

| ID | URL | Used for |
|----|-----|----------|
| `correct_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3` | Standard correct answer SFX |
| `incorrect_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3` | Standard wrong answer SFX |
| `sound_life_lost` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3` | Life lost (same as incorrect) |
| `rounds_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3` | Round transition SFX |
| `victory_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506672258.mp3` | Victory (3★) SFX |
| `game_complete_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506659491.mp3` | Game complete (1★/2★) SFX |
| `game_over_sound_effect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506638331.mp3` | Game over SFX |
| `tap_sound` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432016820.mp3` | Tile tap / micro-interaction |
| `sound_bubble_select` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1758162403784.mp3` | Bubble/tile select |
| `sound_bubble_deselect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1758712800721.mp3` | Bubble/tile deselect |
| `new_cards` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432104595.mp3` | New content appearing |
| `all_correct` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506764346.mp3` | All items matched / round complete |
| `soundChainComplete` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3` | Chain complete (multi-chain games) |
| `soundPartialCorrect` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501548938.mp3` | Partial progress (chain games) |
| `sound_level_transition` | `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1756742499143.mp3` | Level transition SFX |

### VO (Voiceover)

All VO is **dynamic** — use `FeedbackManager.playDynamicFeedback()` with game-appropriate `audio_content`. Do NOT hardcode VO URLs. VO content (victory, game over, round transitions, level transitions, restart) should be generated via dynamic TTS based on the game's context.

### Standard Sticker GIFs (default set — from position-maximizer)

| Role | URL |
|------|-----|
| Correct | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-95.gif` |
| Incorrect | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-99.gif` |
| Round transition | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-87.gif` |
| Level transition | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1759297084426-234.gif` |
| Victory (3★) | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1759297084426-230.gif` |
| Game complete (2★) | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-113.gif` |
| Game complete (1★) | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-110.gif` |
| Game complete (generic) | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-107.gif` |
| Game over | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-103.gif` |
| Restart | `https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757430772002-102.gif` |

**Never invent URLs.** Always use the exact SFX and sticker URLs from the tables above. VO is always dynamic TTS — no URLs needed.

## Error Handling

Every FeedbackManager call must be wrapped in try/catch:

```javascript
try {
  await FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER_URL });
} catch (e) {
  console.error('Audio error:', JSON.stringify({ error: e.message }, null, 2));
}
```

Audio failure never breaks gameplay. The game continues even if every audio call fails.

## Feedback Per Bloom Level (Subtitle Templates)

The subtitle text depth changes by Bloom level:

### L1 — Remember
- **Correct:** "That's right!" / "Yes!" / "Correct!" (rotate)
- **Wrong:** "Not quite. It's [answer]."
- No explanation — recall is binary.

### L2 — Understand
- **Correct:** "Right! [brief why]." → "Right! 3:6 simplifies to 1:2."
- **Wrong:** "[Answer]. [brief why]." → "It's 1:2. Divide both by 3."
- One sentence explaining why — CRITICAL.

### L3 — Apply
- **Correct:** "Correct approach!" / "Right method!"
- **Wrong:** "Try [method hint]. The answer is [answer]."
- Points toward the method, not just the answer.

### L4 — Analyze
- **Correct:** "Good analysis!" / "Sharp reasoning!"
- **Wrong:** "What could you check? The answer is [answer]."
- Asks a metacognitive question, then states the answer.
