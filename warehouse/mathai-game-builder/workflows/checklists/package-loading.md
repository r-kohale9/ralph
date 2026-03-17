# Package Loading Checklist

## When to Use

**MANDATORY for ALL games** - Phase 1 requirement.

## Critical Rule

⚠️ **Loading packages in wrong order causes critical errors**

## Package Loading Order

**EXACT order required:**

```html
<!-- 1. FeedbackManager MUST load FIRST -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load SECOND -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load THIRD -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**Why this order?**
- FeedbackManager loads SubtitleComponent first
- If Components loads before FeedbackManager, it tries to load SubtitleComponent again
- Result: Duplicate registration errors

**Verification:**
- [ ] FeedbackManager script tag is FIRST
- [ ] Components script tag is SECOND
- [ ] Helpers script tag is THIRD
- [ ] No other scripts between these three

## Wait for Packages Function

**MANDATORY pattern:**

```javascript
// ✅ CRITICAL: Wait for ALL packages to load before initializing
async function waitForPackages() {
  // Wait for FeedbackManager (ALWAYS required)
  while (typeof FeedbackManager === "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Wait for Components (ALWAYS required - contains TimerComponent)
  while (typeof TimerComponent === "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Wait for Helpers (ALWAYS required - contains VisibilityTracker)
  while (typeof VisibilityTracker === "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log("✅ All packages loaded");
}
```

**Why this is critical:**
- Script tags with `src` load asynchronously
- Even with `DOMContentLoaded`, external packages might not be loaded yet
- `waitForPackages()` explicitly waits for each package to be available

**Verification:**
- [ ] waitForPackages() function defined
- [ ] Checks for FeedbackManager
- [ ] Checks for TimerComponent
- [ ] Checks for VisibilityTracker
- [ ] Uses async/await with while loops
- [ ] Logs success message

## DOMContentLoaded Pattern

**MANDATORY initialization:**

```javascript
window.addEventListener("DOMContentLoaded", async () => {
  // ✅ Wait for packages to load first
  await waitForPackages();

  // ✅ Initialize FeedbackManager (ALWAYS required)
  await FeedbackManager.init();
  console.log("✅ FeedbackManager initialized");

  // ✅ MANDATORY: Declare variables
  let visibilityTracker = null;
  let timer = null;

  // ⚠️ IF GAME NEEDS TIMER: Create TimerComponent
  timer = new TimerComponent("timer-container", {
    timerType: "increase",
    startTime: 0,
    endTime: 9999999,
    autoStart: true,
    onEnd: () => {
      endGame();
    },
  });

  // ✅ MANDATORY: Create VisibilityTracker (ALL GAMES)
  visibilityTracker = new VisibilityTracker({
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

  // Setup game (NO feedback integration yet in Phase 1)
  setupGame();
});

**⚠️ Timer Creation Timing:**

- If using dynamic HTML (innerHTML), create TimerComponent AFTER rendering HTML
- Pattern: `renderGame()` → `new TimerComponent()`
- See [timer-component.md](timer-component.md) for sequence details
```

**Verification:**
- [ ] Event listener on DOMContentLoaded
- [ ] async function
- [ ] await waitForPackages() called FIRST
- [ ] await FeedbackManager.init() called SECOND
- [ ] Variables declared before component creation
- [ ] Components created after packages loaded
- [ ] setupGame() called last

## Phase-Specific Requirements

### Phase 1 (Core Gameplay)

**Include:**
- [ ] All three package script tags in correct order
- [ ] waitForPackages() function
- [ ] FeedbackManager.init() call
- [ ] VisibilityTracker creation (MANDATORY)
- [ ] TimerComponent creation (if timer needed)

**Exclude (Phase 3 only):**
- [ ] VERIFY: No feedbackAssets object
- [ ] VERIFY: No FeedbackManager.sound.preload()
- [ ] VERIFY: No FeedbackManager.sound.play()
- [ ] VERIFY: No audio URLs

### Phase 3 (Feedback Integration)

**Add (after Phase 1 is approved):**
- [ ] feedbackAssets object with audio URLs
- [ ] FeedbackManager.sound.preload() calls
- [ ] FeedbackManager.sound.play() calls

## Anti-Patterns (DO NOT USE)

```html
<!-- ❌ WRONG - Wrong order -->
<script src=".../packages/components/index.js"></script>
<script src=".../packages/feedback-manager/index.js"></script>
<script src=".../packages/helpers/index.js"></script>

<!-- ❌ WRONG - Missing packages -->
<script src=".../packages/feedback-manager/index.js"></script>
<!-- Missing Components and Helpers -->
```

```javascript
// ❌ WRONG - No waitForPackages
window.addEventListener("DOMContentLoaded", async () => {
  // Packages might not be loaded yet!
  await FeedbackManager.init();
  const timer = new TimerComponent(...); // Might fail if not loaded
});

// ❌ WRONG - Not waiting for all packages
async function waitForPackages() {
  while (typeof FeedbackManager === "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // Missing checks for TimerComponent and VisibilityTracker
}
```

**Verification:**
- [ ] VERIFY: Packages in correct order
- [ ] VERIFY: waitForPackages() checks all three packages
- [ ] VERIFY: waitForPackages() called before any component usage

## Final Verification

**Code Search:**
- [ ] Search for `<script src=` - verify order matches exactly
- [ ] Search for `waitForPackages` - should exist
- [ ] Search for `FeedbackManager.init()` - should be called after waitForPackages
- [ ] Search for `DOMContentLoaded` - verify async and proper sequence

**Console Test:**

Open browser console during game load:

```
Expected output:
✅ All packages loaded
✅ FeedbackManager initialized
```

**Verification:**
- [ ] No "undefined" errors for FeedbackManager, TimerComponent, or VisibilityTracker
- [ ] No lottie-player registration errors
- [ ] Packages load and initialize successfully

## Reference

- Full component docs: [components/](../../components/)
- Package architecture: [reference/architecture.md](../../reference/architecture.md)
- Common errors: [reference/error-messages.md](../../reference/error-messages.md)
