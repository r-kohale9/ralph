# VisibilityTracker Checklist

## When to Use

**MANDATORY for ALL games** - no exceptions.

## Prerequisites

- [ ] Helpers package loaded in HTML
- [ ] FeedbackManager initialized
- [ ] Timer created (if game uses timer)

## Integration Steps

### 1. JavaScript Implementation

```javascript
// Declare visibilityTracker variable
let visibilityTracker = null;

// Create VisibilityTracker (MANDATORY for all games)
visibilityTracker = new VisibilityTracker({
  onInactive: () => {
    // Pause timer if it exists
    if (timer) timer.pause({ fromVisibilityTracker: true });

    // ALWAYS pause audio (even if no timer)
    FeedbackManager.sound.pause();
    FeedbackManager.stream.pauseAll();
  },
  onResume: () => {
    // Resume timer if it exists and was paused
    if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });

    // ALWAYS resume audio
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

**Verification:**
- [ ] visibilityTracker variable declared at top scope
- [ ] Created with `new VisibilityTracker({})`
- [ ] onInactive callback defined
- [ ] onResume callback defined
- [ ] popupProps configured

### 2. onInactive Callback

**Must pause all active elements:**

```javascript
onInactive: () => {
  // Timer (if exists)
  if (timer) timer.pause({ fromVisibilityTracker: true });

  // Audio (ALWAYS required)
  FeedbackManager.sound.pause();
  FeedbackManager.stream.pauseAll();

  // Any other game-specific logic
  // Examples: pause animations, stop counters, etc.
}
```

**Verification:**
- [ ] Timer paused (if timer exists)
- [ ] FeedbackManager.sound.pause() called
- [ ] FeedbackManager.stream.pauseAll() called
- [ ] Game-specific elements paused

### 3. onResume Callback

**Must resume all paused elements:**

```javascript
onResume: () => {
  // Timer (if exists and was paused)
  if (timer && timer.isPaused) timer.resume({ fromVisibilityTracker: true });

  // Audio (ALWAYS required)
  FeedbackManager.sound.resume();
  FeedbackManager.stream.resumeAll();

  // Any other game-specific logic
  // Examples: resume animations, restart counters, etc.
}
```

**Verification:**
- [ ] Timer resumed with isPaused check (if timer exists)
- [ ] FeedbackManager.sound.resume() called
- [ ] FeedbackManager.stream.resumeAll() called
- [ ] Game-specific elements resumed

### 4. Popup Configuration

```javascript
popupProps: {
  title: "Game Paused",           // Popup title
  description: "Click Resume to continue.",  // Popup description
  primaryText: "Resume",          // Primary button text
}
```

**Verification:**
- [ ] title is clear and game-appropriate
- [ ] description provides helpful instruction
- [ ] primaryText is action-oriented

### 5. Cleanup (Optional)

If game needs to destroy tracker:

```javascript
visibilityTracker.destroy();
```

**Verification:**
- [ ] destroy() called when game ends (if needed)

## Anti-Patterns (DO NOT USE)

```javascript
// ❌ WRONG - This API does not exist!
VisibilityTracker.init({ ... });

// ❌ WRONG - These callbacks don't exist!
onVisibilityChange: (isVisible) => { ... }
onVisible: () => { ... }
onHidden: () => { ... }

// ❌ WRONG - Manual visibility detection
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Manual pause logic
  }
});
```

**Verification:**
- [ ] VERIFY: No VisibilityTracker.init() usage
- [ ] VERIFY: No manual visibilitychange listeners
- [ ] VERIFY: Only uses onInactive and onResume callbacks

## Final Verification

**Code Search:**
- [ ] Search code for `new VisibilityTracker` - should exist (MANDATORY)
- [ ] Search code for `onInactive:` - should exist
- [ ] Search code for `onResume:` - should exist
- [ ] Search code for `VisibilityTracker.init` - should NOT exist
- [ ] Search code for `visibilitychange` - should NOT exist (except in VisibilityTracker itself)

**Functional Test:**
- [ ] Open game in browser
- [ ] Switch to another tab
- [ ] Verify popup appears with configured text
- [ ] Verify timer paused (if timer exists)
- [ ] Verify audio paused
- [ ] Switch back to game tab
- [ ] Click Resume button
- [ ] Verify timer resumed (if timer exists)
- [ ] Verify audio resumed

**Console Test:**

```javascript
// Manually trigger inactive
visibilityTracker.triggerInactive();

// Manually trigger resume
visibilityTracker.triggerResume();
```

**Verification:**
- [ ] Manual triggers work correctly
- [ ] Popup appears/disappears as expected

## Reference

- Full API: [components/visibility-tracker.md](../../components/visibility-tracker.md)
- Quick reference: [reference/component-props.md](../../reference/component-props.md)
