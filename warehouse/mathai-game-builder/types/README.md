# Type Definitions & Documentation

This folder contains type definitions and usage documentation for external libraries used in MathAI games.

## Files

### 🆕 feedback-manager.d.ts (RECOMMENDED)

Complete TypeScript type definitions for FeedbackManager - the unified feedback system.

**What is FeedbackManager?**
- Unified feedback system for browser-based games
- Combines audio (regular + streaming), subtitles, and stickers in one API
- Auto-synchronized timing - feedback hides when audio ends
- Smart duration calculation from audio length
- Loaded via CDN: `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`

**Features:**
- 🎊 Audio + Subtitle + Sticker in one `play()` call
- ✨ Auto-sync - feedback hides when audio completes
- 🎨 Smart timing - duration calculated automatically
- 🔒 Auto-unlock with permission popup
- 🎯 Priority system for audio importance
- ⚡ Lazy loading of components

**Usage:**
- Include these types in your TypeScript project for full autocomplete and type safety
- No installation needed - types are provided for the CDN-hosted library
- Backward compatible with AudioKit (alias)

### feedback-manager-usage.md (RECOMMENDED)

Comprehensive usage guide for the unified feedback system.

**Includes:**
- Quick start guide with unified feedback examples
- Complete code examples (quiz games, dynamic feedback, timed challenges)
- Unified API documentation (audio + subtitle + sticker)
- Priority-based feedback system
- Permission management (auto-popup, custom popup, silent mode)
- Feedback components manager (manual control)
- Migration guide from AudioKit
- Best practices and troubleshooting

**For:**
- Game developers implementing complete feedback experiences
- Anyone wanting audio + visual feedback synchronized
- New projects (recommended approach)

### subtitle-component.d.ts

TypeScript type definitions for SubtitleComponent (internal to FeedbackManager).

**⚠️ IMPORTANT: Do NOT use SubtitleComponent directly**
- Subtitles are automatically managed by FeedbackManager
- Always pass subtitle options when playing audio via FeedbackManager
- Supports markdown formatting (**bold**, *italic*, etc.)
- Auto-synchronized with audio playback

**Usage:**
```javascript
// ✅ CORRECT - Subtitle with audio via FeedbackManager
await FeedbackManager.sound.play('correct', {
  subtitle: '**Great job!** You got it right!'
});

// ❌ WRONG - Never use SubtitleComponent directly
SubtitleComponent.show({ text: 'Hello' });  // Don't do this!
```

### subtitle-component-usage.md

Reference documentation for subtitle options and formatting.

**Note:** This file contains technical reference for subtitle configuration. Always use subtitles via FeedbackManager's unified API.

### timer-component.d.ts

Complete TypeScript type definitions for TimerComponent.

**What is TimerComponent?**
- Vanilla JavaScript timer component
- Supports countdown and countup timers
- Display formats: MM:SS or SS only
- Customizable positioning (regular or action bar)
- Loaded via Components package: `https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js`

**Usage:**
- Include these types in your TypeScript project for full autocomplete and type safety
- No installation needed - types are provided for the CDN-hosted library

### timer-component-usage.md

Comprehensive usage guide with examples, patterns, and best practices.

**Includes:**
- Quick start guide
- Complete code examples (countdown, stopwatch, action bar timer)
- Configuration options reference
- Control methods (start, pause, resume, stop, reset)
- Common patterns (quiz timers, per-question tracking, bonus time)
- API reference
- Integration with game events and results

**For:**
- Game developers implementing time-based mechanics
- Anyone adding timers to games
- Reference during development

### 🚨 api-helper.d.ts (MANDATORY)

Complete TypeScript type definitions for APIHelper.

**What is APIHelper?**
- Handles communication with the MathAI Core API
- Submits game session results to backend
- Configurable endpoints, headers, and error handling
- Loaded via Helpers package: `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js`

**Features:**
- 📤 Submit game session results
- ⚙️ Configurable API endpoints and headers
- 🚨 Error handling and timeout management
- 🔧 Dynamic configuration updates

**Usage:**
- 🚨 **MANDATORY for ALL games** - submit session data to backend
- Initialize after Helpers package loads
- Configure error callbacks for user-friendly error handling

### 🚨 visibility-tracker.d.ts (MANDATORY)

Complete TypeScript type definitions for VisibilityTracker.

**What is VisibilityTracker?**
- Tracks tab visibility changes to pause/resume activities
- Automatically shows resume popup when user returns
- Pauses timers, audio, and animations when user switches tabs
- Ensures fair gameplay and prevents cheating
- Loaded via Helpers package: `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js`

**Features:**
- 🔒 Automatic pause when user switches tabs
- 📱 Resume popup with customizable message
- ⏸️ Pause timers, audio, and animations
- ▶️ Resume everything when user clicks resume button
- 🧪 Manual testing with triggerInactive/triggerResume

**Usage:**
- 🚨 **MANDATORY for ALL games with timers or audio**
- Prevents users from gaining unfair advantages
- Maintains session integrity during timed activities
- Auto-loads PopupComponent for resume dialog

### visibility-tracker-usage.md (MANDATORY)

Comprehensive usage guide for pause/resume functionality.

**Includes:**
- Quick start guide with timer and audio examples
- Complete code examples (quiz games, timed challenges, animations)
- Configuration options for callbacks and popup
- Common patterns (conditional pause, state saving, analytics)
- Best practices and troubleshooting
- Integration checklist

**For:**
- ALL game developers (mandatory component)
- Anyone implementing timers or timed activities
- Anyone with audio playback in games
- Reference for pause/resume implementation

## Using These Files

### In TypeScript Projects

```typescript
/// <reference path="types/feedback-manager.d.ts" />
/// <reference path="types/timer-component.d.ts" />
/// <reference path="types/visibility-tracker.d.ts" />

// 🚨 MANDATORY: Initialize FeedbackManager first!
await FeedbackManager.init();

// FeedbackManager with full type support (RECOMMENDED)
const audioList: FeedbackManager.AudioItem[] = [
  { id: 'tap', url: 'https://example.com/tap.mp3' },
  { id: 'correct', url: 'https://example.com/correct.mp3' }
];
await FeedbackManager.sound.preload(audioList);

// ✅ CORRECT - Unified feedback: audio + subtitle + sticker
await FeedbackManager.sound.play('correct', {
  subtitle: '**Great job!** You got it right!',
  sticker: 'https://cdn.mathai.com/stickers/star.json',
  priority: 10
});

// TimerComponent with full type support
const config: TimerComponent.TimerConfig = {
  timerType: 'decrease',
  format: 'min',
  startTime: 60,
  endTime: 0,
  autoStart: true
};
const timer = new TimerComponent('timer-container', config);

// 🚨 MANDATORY - VisibilityTracker for pause/resume
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
  }
});
```

### In JavaScript Projects

Reference the unified feedback guide:

```javascript
// See types/feedback-manager-usage.md for complete examples

// 🚨 MANDATORY: Initialize FeedbackManager first!
await FeedbackManager.init();

// Quick start - Unified feedback
await FeedbackManager.sound.play('correct', {
  subtitle: '**Perfect!** You got it!',
  sticker: 'https://cdn.mathai.com/stickers/star.json'
});

// Quick start - Timer
const timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'min',
  startTime: 60,
  endTime: 0,
  autoStart: true,
  onEnd: (timeTaken) => {
    console.log('Timer finished!');
  }
});

// 🚨 MANDATORY - VisibilityTracker (see types/visibility-tracker-usage.md)
const tracker = new VisibilityTracker({
  onInactive: () => {
    timer.pause();
    FeedbackManager.sound.pause();   // Pause regular audio
    FeedbackManager.stream.pauseAll();  // Pause streaming audio
    console.log('All activities paused');
  },
  onResume: () => {
    timer.resume();
    FeedbackManager.sound.resume();   // Resume regular audio
    FeedbackManager.stream.resumeAll();  // Resume streaming audio
    console.log('All activities resumed');
  },
  popupProps: {
    title: 'Activity Paused',
    description: 'Click Resume to continue your activity.',
    primaryText: 'Resume'
  }
});
```

## Documentation Structure

```
types/
├── README.md                         (this file)
├── 🆕 feedback-manager.d.ts          (FeedbackManager unified system - RECOMMENDED)
├── 🆕 feedback-manager-usage.md      (Unified feedback guide - RECOMMENDED)
├── 🚨 api-helper.d.ts                (APIHelper TypeScript definitions - MANDATORY)
├── 🚨 api-helper-usage.md            (API communication guide - MANDATORY)
├── timer-component.d.ts              (TimerComponent TypeScript definitions)
├── timer-component-usage.md          (TimerComponent usage guide & examples)
├── 🚨 visibility-tracker.d.ts        (VisibilityTracker TypeScript definitions - MANDATORY)
├── 🚨 visibility-tracker-usage.md    (Pause/resume guide - MANDATORY)
├── subtitle-component.d.ts           (Internal - subtitle type reference only)
└── subtitle-component-usage.md       (Internal - subtitle formatting reference)
```

**Notes:**
- 🚨 **APIHelper is MANDATORY** for all games - handles backend communication
- 🚨 **VisibilityTracker is MANDATORY** for all games with timers or audio
- SubtitleComponent files are for reference only - always use subtitles via FeedbackManager

## External Libraries

All libraries are hosted externally and loaded via CDN. These type definitions describe the library interfaces but do NOT contain the implementations.

**📦 Consolidated Packages (Recommended):**

```html
<!-- FeedbackManager: Audio + Subtitle + Sticker management -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- Components: Timer + Popup + Subtitle + Sticker UI components -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- Helpers: VisibilityTracker and other utilities -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**What Each Package Includes:**

- **feedback-manager**: `FeedbackManager` (with audio, subtitle, sticker integration)
- **components**: `TimerComponent`, `PopupComponent`, `SubtitleComponent`, `StickerComponent`
- **helpers**: `VisibilityTracker`

**⚠️ Important Notes:**
- SubtitleComponent is loaded by BOTH FeedbackManager and Components packages - use via FeedbackManager.sound.play() with subtitle props
- All components are available globally (e.g., `TimerComponent`) and via namespaces (e.g., `MathAIComponents.TimerComponent`)
- All helpers are available globally (e.g., `VisibilityTracker`) and via namespaces (e.g., `MathAIHelpers.VisibilityTracker`)

## Backward Compatibility

**FeedbackManager maintains 100% backward compatibility with AudioKit:**

```javascript
// ✅ Old AudioKit audio code still works
await AudioKit.sound.play('tap');
await AudioKit.unlock();

// ✅ New FeedbackManager code (recommended) - with subtitle integrated
await FeedbackManager.sound.play('tap', {
  subtitle: 'Button clicked'
});
```

**⚠️ Important Note on Subtitles:**
- SubtitleComponent should NOT be used directly anymore
- Always pass subtitles as props when playing audio via FeedbackManager
- This ensures proper synchronization with audio playback

**Migration Benefits:**
- ✅ Less code - unified API
- ✅ Auto-synchronized timing - no manual duration management
- ✅ Auto-cleanup - feedback hides when audio ends
- ✅ Better DX - single system to learn

**AudioKit alias:**
- `AudioKit` is an alias for `FeedbackManager`
- All AudioKit code works without changes
- Recommended to use `FeedbackManager` for new code
- Both names will be supported indefinitely

## Related Documentation

- **Main Guide**: `../SKILL.md` - Complete game development workflow
- **Live Example**: `../assets/game-template/example-with-streaming.html`
