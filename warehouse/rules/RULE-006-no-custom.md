# RULE-006: No Custom Implementations

**Severity:** CRITICAL

---

Use platform components. Never build custom versions.

| Need | WRONG | CORRECT |
|------|-------|---------|
| Audio playback | `new Audio('file.mp3')` | `FeedbackManager.sound.play(id)` |
| Timer | `setInterval(() => time--, 1000)` | `new TimerComponent(container, config)` |
| Subtitles | `SubtitleComponent.show('text')` | `subtitle` prop in `sound.play()` options |
| Pause/Resume | `document.addEventListener('visibilitychange')` | `new VisibilityTracker(config)` |

## Why

- Platform components handle edge cases (race conditions, cleanup, state management)
- Consistent behavior across all games
- Bug fixes propagate to all games automatically

## Verification

- [ ] No `new Audio()` anywhere
- [ ] No `setInterval`/`setTimeout` used for timing (except in waitForPackages)
- [ ] No `SubtitleComponent.show()` direct calls
- [ ] No custom `visibilitychange` listeners
