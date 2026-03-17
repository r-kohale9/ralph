# PART-003: waitForPackages()

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-002

---

## Code

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();
  try {
    while (typeof FeedbackManager === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: FeedbackManager');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof TimerComponent === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: TimerComponent');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof VisibilityTracker === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: VisibilityTracker');
      await new Promise(r => setTimeout(r, 50));
    }
    while (typeof SignalCollector === 'undefined') {
      if (Date.now() - start > timeout) throw new Error('Package timeout: SignalCollector');
      await new Promise(r => setTimeout(r, 50));
    }
    console.log('All packages loaded');
  } catch (error) {
    console.error('Package loading failed:', error);
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Failed to load. Please refresh.</div>';
    throw error;
  }
}
```

## Placement

Top of the `<script>` block, before any other functions.

## Rules

- Must check all four: FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector
- Must have 10s timeout
- Must show fallback UI on failure
- Must throw error on failure (prevents further initialization)

## Anti-Patterns

```javascript
// WRONG: No waitForPackages
window.addEventListener('DOMContentLoaded', async () => {
  await FeedbackManager.init(); // May fail — not loaded yet
});

// WRONG: Only checks one package
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') { ... }
  // Missing TimerComponent and VisibilityTracker
}
```

## Verification

- [ ] Function named `waitForPackages` exists
- [ ] Checks FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector
- [ ] Has timeout (10000ms)
- [ ] Shows fallback UI on failure
- [ ] Throws error on failure
