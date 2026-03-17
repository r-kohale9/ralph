# StoriesComponent Loading Checklist

Verification checklist for proper StoriesComponent initialization in games.

## Package Loading

```
📋 StoriesComponent Loading Requirements

[ ] FeedbackManager script tag present (loads first)
[ ] Components script tag present (loads second, contains StoriesComponent)
[ ] waitForPackages() function defined
[ ] waitForPackages() checks for FeedbackManager
[ ] waitForPackages() checks for window.MathAIComponents
[ ] waitForPackages() checks for window.MathAIComponents.StoriesComponent
[ ] waitForPackages() has timeout (10 seconds recommended)
[ ] waitForPackages() throws error on timeout
[ ] DOMContentLoaded calls await waitForPackages()
[ ] FeedbackManager.init() called after waitForPackages()
```

## StoriesComponent Initialization

```
📋 StoriesComponent Initialization Requirements

[ ] StoriesComponent extracted from window.MathAIComponents
[ ] Container element exists in HTML (#story-container or similar)
[ ] Container has proper dimensions (100vw x 100vh for fullscreen)
[ ] storyBlockId or storyBlock provided
[ ] onComplete callback defined
[ ] onError callback defined
[ ] showProgress set (default: true)
[ ] trackDuration set (default: true)
```

## Correct Pattern

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();

  try {
    // Wait for FeedbackManager
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: FeedbackManager');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for MathAIComponents namespace
    while (typeof window.MathAIComponents === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: MathAIComponents');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for StoriesComponent
    while (typeof window.MathAIComponents.StoriesComponent === 'undefined') {
      if (Date.now() - start > timeout) {
        throw new Error('Package loading timeout: StoriesComponent');
      }
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('✅ All packages loaded');
  } catch (error) {
    console.error('❌ Package loading failed:', error);
    throw error;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // STEP 1: Wait for packages
    await waitForPackages();

    // STEP 2: Initialize FeedbackManager
    await FeedbackManager.init();

    // STEP 3: Extract StoriesComponent
    const { StoriesComponent } = window.MathAIComponents;

    // STEP 4: Initialize StoriesComponent
    const stories = new StoriesComponent('story-container', {
      storyBlockId: 273291, // or from runtime content
      showProgress: true,
      trackDuration: true,
      onComplete: (data) => {
        console.log('Story complete!', data);
        handleStoryComplete(data);
      },
      onError: (error) => {
        console.error('Story error:', error);
      }
    });
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to load story. Please refresh.</div>';
  }
});
```

## Anti-Patterns

### ❌ WRONG: Using StoriesComponent before checking if loaded

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  await FeedbackManager.init();

  // ERROR: StoriesComponent might not be loaded yet!
  const stories = new StoriesComponent('story-container', {...});
});
```

**Why wrong:** Script tags load asynchronously. StoriesComponent might not be available yet.

### ❌ WRONG: Not checking MathAIComponents namespace

```javascript
async function waitForPackages() {
  // Only checking StoriesComponent, not the namespace
  while (typeof StoriesComponent === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
}
```

**Why wrong:** StoriesComponent is under `window.MathAIComponents.StoriesComponent`, not global `StoriesComponent`.

### ❌ WRONG: No timeout in wait loop

```javascript
async function waitForPackages() {
  // Infinite loop if package fails to load!
  while (typeof window.MathAIComponents === 'undefined') {
    await new Promise(r => setTimeout(r, 50));
  }
}
```

**Why wrong:** If package fails to load, this loops forever. Always include timeout.

### ❌ WRONG: Not handling initialization errors

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  const { StoriesComponent } = window.MathAIComponents;
  const stories = new StoriesComponent('story-container', {...});
  // No error handling!
});
```

**Why wrong:** User sees blank page if initialization fails. Always wrap in try-catch and show user-friendly error.

## Verification Steps

1. **Check script tags:**
   - FeedbackManager script tag exists
   - Components script tag exists
   - Scripts in correct order

2. **Check waitForPackages():**
   - Function defined before DOMContentLoaded
   - Checks FeedbackManager
   - Checks window.MathAIComponents
   - Checks window.MathAIComponents.StoriesComponent
   - Has timeout with error throw
   - Logs success message

3. **Check initialization sequence:**
   - await waitForPackages() called first
   - await FeedbackManager.init() called second
   - StoriesComponent extracted from window.MathAIComponents
   - StoriesComponent initialized last

4. **Check error handling:**
   - try-catch wraps initialization
   - Error logged to console
   - User-friendly error message shown on failure

5. **Check container:**
   - HTML element exists with correct ID
   - Container has dimensions (100vw x 100vh for fullscreen)
   - Container visible in DOM

## Common Errors

### "StoriesComponent is not defined"

**Cause:** StoriesComponent accessed before packages loaded

**Fix:** Add waitForPackages() and wait for it before using StoriesComponent

### "Cannot read property 'StoriesComponent' of undefined"

**Cause:** MathAIComponents namespace not loaded

**Fix:** Check for window.MathAIComponents before accessing StoriesComponent

### Story doesn't render after loading

**Cause:** Container element missing or has no dimensions

**Fix:** Ensure container exists and has explicit width/height (100vw x 100vh for fullscreen)

### Infinite loading / timeout

**Cause:** Script URL wrong or network issue

**Fix:** Verify script URLs are correct and accessible

## Testing

1. Open browser DevTools Console
2. Check for "✅ All packages loaded" message
3. Check for no "Package loading timeout" errors
4. Verify story renders on screen
5. Check console for any StoriesComponent errors
6. Test story navigation and completion

## Reference

- [StoriesComponent Documentation](../../components/stories-component.md)
- [Package Loading Checklist](package-loading.md)
- [Story-Only Games Workflow](../story-only-games.md)
