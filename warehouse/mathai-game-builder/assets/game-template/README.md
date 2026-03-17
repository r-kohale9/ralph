# MathAI Game Template

This is a complete, working template for building educational mini games for the MathAI platform.

## What's Included

- **index.html** - Complete HTML structure with all required elements
- **styles.css** - Responsive styles and animations
- **game.js** - Example quiz game with full game loop
- **helpers/** - Platform helper libraries (audio, API, tracking)

## Quick Start

1. **Copy this entire folder** to start a new game
2. **Customize the content** in `game.js`:
   - Update the `QUESTIONS` array with your content
   - Modify game logic as needed
   - Keep the helper API calls (tracker, audio, api)
3. **Test locally** by opening `index.html` in a browser
4. **Deploy** to your platform

## File Structure

```
game-template/
├── index.html              # Main HTML file
├── styles.css              # Styles (customize colors, layout)
├── game.js                 # Game logic (customize this!)
└── helpers/
    ├── audio-helper.js     # Audio utilities
    ├── api-helper.js       # API integration
    └── tracker-helper.js   # Attempt tracking
```

## How to Customize

### 1. Change the Questions

Edit the `QUESTIONS` array in `game.js`:

```javascript
const QUESTIONS = [
    {
        question: "Your question here?",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correct: 2 // Index of correct answer (0-3)
    },
    // Add more questions...
];
```

### 2. Customize Styling

Edit `styles.css` to match your brand:
- Change colors in the gradient background
- Update button colors
- Modify fonts and spacing

### 3. Add Different Game Mechanics

The current template is a multiple-choice quiz, but you can modify it for:
- Fill in the blank
- Drag and drop
- Matching games
- Sorting activities
- etc.

Just keep the required helper calls:
- `tracker.startSession()` at game start
- `tracker.recordAttempt()` for each interaction
- `window.api.submitResults()` at game end (uses registered game ID injected into HTML by Phase 4)

## Helper Libraries

**✅ PRODUCTION READY**: All helper libraries make real API calls and provide full functionality.

### audio-helper.js
Web Audio API utilities for sound effects and audio feedback.

### api-helper.js
**✅ MAKES REAL API CALLS** to the MathAI backend:
- `window.api.submitResults(payload)` - Submits game session data (after initialization)
- Proper error handling and logging
- Configurable endpoints and authentication
- Available globally as `window.api` after package initialization

### tracker-helper.js
**✅ MAKES REAL API CALLS** for attempt tracking:
- `tracker.startSession()` - Initializes tracking session
- `tracker.recordAttempt()` - Records each user interaction
- `tracker.getSummary()` - Returns complete session data

## Testing

Open `index.html` in a browser and check the console for:
- Game initialization messages
- Attempt tracking logs
- API submission logs (simulated)

## Required Elements Checklist

- ✅ `<div id="game-container">` wrapper
- ✅ `<div id="feedback">` for feedback messages
- ✅ Helper scripts loaded in correct order
- ✅ `tracker.startSession()` called at game start
- ✅ `tracker.recordAttempt()` called for each attempt
- ✅ `api.submitResults()` called at game end
- ✅ Audio feedback for user actions

## Next Steps

1. Copy this template folder
2. Rename it to your game name
3. Replace POC helpers with your real implementations
4. Customize the game logic
5. Test thoroughly
6. Deploy!

For more information, see the skill's `references/` folder for detailed documentation.
