# PART-038: InteractionManager

**Category:** CONDITIONAL | **Condition:** Game needs interaction suppression during audio feedback or evaluation | **Dependencies:** PART-002, PART-003

---

## Purpose

Controls pointer-events on the game play area. FeedbackManager automatically integrates with `window.interactionManager` to disable interaction during audio feedback (for audio > 1 second) and re-enable it when audio ends.

## Code

```javascript
const interactionManager = new InteractionManager({
  selector: '.game-play-area',          // CSS selector for the interactive area
  disableOnAudioFeedback: true,         // Auto-disable during audio feedback
  disableOnEvaluation: true             // Auto-disable during subjective evaluation
});
window.interactionManager = interactionManager;  // MUST be on window for FeedbackManager integration
```

## Placement

Inside DOMContentLoaded (PART-004), after `FeedbackManager.init()`.

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `selector` | string | `'.game-play-area'` | CSS selector for the primary interactive area |
| `disableOnAudioFeedback` | boolean | `true` | Disable interaction during audio feedback |
| `disableOnEvaluation` | boolean | `true` | Disable interaction during subjective evaluation |
| `settings` | object | `{}` | Additional settings |

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `enable(reason, options?)` | string, `{ fromAudio?: bool }` | Re-enable interaction |
| `disable(reason, options?)` | string, `{ fromAudio?: bool }` | Disable interaction |
| `isInteractive()` | — | Returns current interactive state |
| `shouldDisableOnAudioFeedback()` | — | Check if audio feedback should disable interaction |
| `shouldDisableOnEvaluation()` | — | Check if evaluation should disable interaction |
| `shouldAllowAudioControl()` | — | Check if audio system can control interaction |
| `updateSettings(settings)` | object | Update settings |
| `getState()` | — | Get full state object |
| `onStateChange(callback)` | function | Listen for interaction state changes |

## How FeedbackManager Uses It

FeedbackManager automatically:
1. Calls `interactionManager.disable('audio_feedback', { fromAudio: true })` when audio > 1s starts
2. Calls `interactionManager.enable('audio_feedback_end', { fromAudio: true })` when audio ends (+ 500ms buffer)
3. Re-enables on `sound.stopAll()` and on play errors

**You do NOT need to manually disable/enable for audio feedback.** Just initialize InteractionManager and assign to `window.interactionManager`.

## CSS Effects

When disabled, the component:
- Sets `pointer-events: none` on the selector element
- Adds `interaction-disabled` CSS class
- Dispatches `interactionStateChange` custom event

## Anti-Patterns

```javascript
// WRONG: Not assigning to window — FeedbackManager can't find it
const im = new InteractionManager({ selector: '.game-area' });

// CORRECT: Must be on window
window.interactionManager = new InteractionManager({ selector: '.game-area' });

// WRONG: Manually disabling/enabling around every sound.play() call
interactionManager.disable('audio');
await FeedbackManager.sound.play('correct_tap', { ... });
interactionManager.enable('audio');
// CORRECT: FeedbackManager does this automatically when interactionManager is on window
```

## Verification

- [ ] `InteractionManager` instantiated with correct selector
- [ ] Assigned to `window.interactionManager`
- [ ] `disableOnAudioFeedback` set appropriately
- [ ] Game play area element matches the selector

## Source Code

Full InteractionManager implementation: `warehouse/packages/helpers/interaction-manager/index.js`
