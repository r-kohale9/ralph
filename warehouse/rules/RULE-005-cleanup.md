# RULE-005: Cleanup on End

**Severity:** REQUIRED

---

Always destroy components and stop audio when game ends.

## Required Cleanup

```javascript
// In endGame():
if (timer) { timer.destroy(); timer = null; }
if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
FeedbackManager.sound.stopAll();
FeedbackManager.stream.stopAll();
```

## Rules

- Destroy timer BEFORE nulling reference
- Destroy visibilityTracker BEFORE nulling reference
- Stop all audio (sounds + streams)
- Set references to null after destroy (prevents stale references)

## Verification

- [ ] `timer.destroy()` called in endGame (if timer exists)
- [ ] `visibilityTracker.destroy()` called in endGame
- [ ] `FeedbackManager.sound.stopAll()` called
- [ ] `FeedbackManager.stream.stopAll()` called
- [ ] References set to null after destroy
