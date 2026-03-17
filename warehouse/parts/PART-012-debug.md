# PART-012: Debug Functions

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-007

---

## Code

```javascript
window.debugGame = function() {
  console.log('Game State:', JSON.stringify(gameState, null, 2));
};

window.debugAudio = function() {
  console.log('Audio State:', JSON.stringify({
    sound: FeedbackManager.sound.getState(),
    stream: FeedbackManager.stream.getState()
  }, null, 2));
};

window.testAudio = async function(id) {
  console.log('Testing audio:', id);
  try {
    await FeedbackManager.sound.play(id);
  } catch (e) {
    console.error('Audio test failed:', JSON.stringify({ error: e.message }, null, 2));
  }
};

window.testPause = function() {
  // Simulate what happens when user switches tabs
  // Call the same callbacks that VisibilityTracker fires on inactive
  if (timer) timer.pause();
  FeedbackManager.sound.stopAll();
  FeedbackManager.stream.stopAll();
  console.log(JSON.stringify({ event: 'testPause', timerPaused: true }));
};

window.testResume = function() {
  // Simulate what happens when user returns to tab
  if (timer) timer.resume();
  console.log(JSON.stringify({ event: 'testResume', timerResumed: true }));
};

window.debugSignals = function() {
  if (!signalCollector) {
    console.log('SignalCollector not initialized');
    return;
  }
  console.log('=== Signal Collector Debug ===');
  signalCollector.debug();
  console.log('Input events:', signalCollector.getInputEvents().length);
  console.log('Problem signals:', JSON.stringify(signalCollector.getAllProblemSignals(), null, 2));
  console.log('Current view:', JSON.stringify(signalCollector.getCurrentView(), null, 2));
  console.log('Metadata:', JSON.stringify(signalCollector.getMetadata(), null, 2));
};
```

## Placement

Global scope, at end of `<script>` block (after all game functions).

## Rules

- All debug functions attached to `window` (accessible from browser console)
- All object logging uses `JSON.stringify(obj, null, 2)`
- Must include all six: `debugGame`, `debugAudio`, `testAudio`, `testPause`, `testResume`, `debugSignals`

## Verification

- [ ] `window.debugGame` exists
- [ ] `window.debugAudio` exists
- [ ] `window.testAudio` exists (async, with try/catch)
- [ ] `window.testPause` exists
- [ ] `window.testResume` exists
- [ ] `window.debugSignals` exists (shows input events, problem signals, current view, metadata)
- [ ] All use JSON.stringify for object output
