# InteractionManager

Controls pointer-events on game areas during feedback and evaluation phases to prevent user interaction conflicts.

## Overview

The `InteractionManager` automatically manages the interactivity of game play areas, disabling pointer events during:
- Long audio feedback (>1 second)
- Evaluation and answering phases

This prevents users from accidentally interacting with the game while audio is playing or while answers are being evaluated.

## API Documentation

### Constructor

```javascript
new InteractionManager(options)
```

**Parameters:**
- `options` (Object): Configuration options
  - `selector` (string, default: '.game-play-area'): CSS selector for the game area element
  - `disableOnAudioFeedback` (boolean, default: true): Disable interaction during long audio feedback
  - `disableOnEvaluation` (boolean, default: true): Disable interaction during evaluation phases

### Methods

#### `enable(reason)`
Re-enables interaction on the game area.

**Parameters:**
- `reason` (string): Reason for enabling (for debugging/logging)

**Example:**
```javascript
interactionManager.enable('user_action');
```

#### `disable(reason)`
Disables interaction on the game area.

**Parameters:**
- `reason` (string): Reason for disabling (for debugging/logging)

**Example:**
```javascript
interactionManager.disable('evaluation');
```

#### `isInteractive()`
Checks if interaction is currently enabled.

**Returns:** boolean - True if interaction is enabled

**Example:**
```javascript
if (interactionManager.isInteractive()) {
    // Game area is interactive
}
```

#### `shouldDisableOnAudioFeedback()`
Checks if interaction should be disabled during audio feedback.

**Returns:** boolean

#### `shouldDisableOnEvaluation()`
Checks if interaction should be disabled during evaluation.

**Returns:** boolean

#### `updateSettings(newSettings)`
Updates settings at runtime.

**Parameters:**
- `newSettings` (Object): New settings to merge

**Example:**
```javascript
interactionManager.updateSettings({
    disableOnAudioFeedback: false
});
```

#### `getState()`
Returns current state for debugging.

**Returns:** Object with current state information

#### `onStateChange(callback)`
Adds event listener for interaction state changes.

**Parameters:**
- `callback` (Function): Callback function called when state changes

**Returns:** Function to remove the event listener

**Example:**
```javascript
const removeListener = interactionManager.onStateChange((event) => {
    if (event.type === 'interactionDisabled') {
        showOverlay(event.reason);
    } else {
        hideOverlay(event.reason);
    }
});

// Later, to remove the listener:
removeListener();
```

## Integration Examples

### Basic Usage

```javascript
// Initialize with default settings
const interaction = new InteractionManager({
    selector: '.game-area'
});

// Disable during evaluation
interaction.disable('evaluation');

// Re-enable after user action
interaction.enable('user_action');
```

### Event Handling for Visual Feedback

```javascript
// Listen for state changes to show/hide visual indicators
interaction.onStateChange((event) => {
    if (event.type === 'interactionDisabled') {
        // Show overlay or gray out elements
        showInteractionDisabledOverlay(event.reason);
    } else {
        // Hide overlay and restore normal appearance
        hideInteractionDisabledOverlay(event.reason);
    }
});
```

### Custom Settings Configuration

```javascript
// Disable only during evaluation, not during audio feedback
const interaction = new InteractionManager({
    selector: '.game-canvas',
    disableOnAudioFeedback: false,  // Don't disable during audio
    disableOnEvaluation: true       // Still disable during evaluation
});

// Runtime settings update
interaction.updateSettings({
    disableOnAudioFeedback: true   // Enable audio feedback disabling
});
```

## Default Behavior Documentation

By default, `InteractionManager` disables interaction during:

1. **Audio Feedback**: When audio feedback longer than 1 second is played through `FeedbackManager`
2. **Evaluation Phases**: When users submit answers or complete evaluation actions

### Automatic Integration with FeedbackManager

When `disableOnAudioFeedback: true` (default), the `InteractionManager` automatically:
- Monitors `FeedbackManager.sound.play()` calls
- Disables interaction for audio >1 second
- Re-enables interaction after audio completes

### Game Flow Integration

```javascript
// Submit button click - disable during evaluation
submitBtn.addEventListener('click', () => {
    interactionManager.disable('evaluation');
    // Process answer...
});

// Next/Restart button click - re-enable interaction
nextBtn.addEventListener('click', () => {
    interactionManager.enable('user_action');
    // Load next question...
});
```

## Visual Feedback Patterns

### Overlay Approach

```javascript
function showInteractionDisabledOverlay(reason) {
    const overlay = document.createElement('div');
    overlay.id = 'interaction-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(1px);
        z-index: 1000;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    let message = 'Please wait...';
    if (reason === 'evaluation') message = 'Evaluating...';
    if (reason === 'audio_feedback') message = 'Playing audio...';

    overlay.innerHTML = `<div style="background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 8px;">${message}</div>`;

    document.querySelector('.game-area').appendChild(overlay);
}

function hideInteractionDisabledOverlay() {
    const overlay = document.getElementById('interaction-overlay');
    if (overlay) overlay.remove();
}
```

### CSS Class Approach

```css
.game-area.interaction-disabled {
    opacity: 0.7;
    filter: grayscale(50%);
}

.game-area.interaction-disabled::after {
    content: "Interaction Disabled";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
}
```

```javascript
// The InteractionManager automatically adds/removes the 'interaction-disabled' class
// No additional JavaScript needed for basic CSS styling
```

### Loading Indicators

```javascript
interaction.onStateChange((event) => {
    const spinner = document.getElementById('loading-spinner');

    if (event.type === 'interactionDisabled') {
        spinner.style.display = 'block';
        // Position spinner appropriately
    } else {
        spinner.style.display = 'none';
    }
});
```

## Technical Details

### DOM Manipulation

The `InteractionManager` controls the `pointer-events` CSS property:
- `pointer-events: auto` - Interaction enabled (default)
- `pointer-events: none` - Interaction disabled

### Event System

Custom events are dispatched on the `window` object:
- Event type: `'interactionStateChange'`
- Event detail contains: `type`, `isEnabled`, `reason`, `timestamp`

### Fallback Selectors

Multiple selector strategies are tried in order:
1. Configured selector (e.g., '.game-play-area')
2. '.game-canvas'
3. '#game-canvas'
4. '.interactive-area'
5. '[data-interactive="true"]'

### Error Handling

- Graceful degradation if game area element not found
- Console warnings for debugging
- Optional nature - games work without InteractionManager

## Troubleshooting

### Game Area Not Found

```javascript
// Check console for warnings about selector matching
// Ensure your game area has one of these selectors:
// - .game-play-area
// - .game-canvas
// - #game-canvas
// - .interactive-area
// - [data-interactive="true"]
```

### Interaction Not Disabling

```javascript
// Check if InteractionManager is properly initialized
console.log(window.interactionManager.getState());

// Verify settings
console.log('Disable on audio:', interactionManager.shouldDisableOnAudioFeedback());
console.log('Disable on evaluation:', interactionManager.shouldDisableOnEvaluation());
```

### Event Listeners Not Firing

```javascript
// Ensure you're listening on the window object
window.interactionManager.onStateChange((event) => {
    console.log('State changed:', event);
});
```

## Best Practices

1. **Initialize Early**: Set up InteractionManager in your game initialization
2. **Consistent Selectors**: Use standard CSS selectors for game areas
3. **Visual Feedback**: Always provide visual indicators when interaction is disabled
4. **Error Handling**: Check if InteractionManager exists before calling methods
5. **Event Cleanup**: Remove event listeners when no longer needed

## Backward Compatibility

The `InteractionManager` is completely optional:
- Existing games continue to work without modification
- No breaking changes to existing APIs
- Graceful degradation if not initialized
