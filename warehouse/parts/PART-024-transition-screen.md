# PART-024: TransitionScreen Component

**Category:** CONDITIONAL | **Condition:** Game needs start/victory/game-over/level-transition screens | **Dependencies:** PART-002, PART-021

---

## Code

```javascript
const transitionScreen = new TransitionScreenComponent({
  autoInject: true  // Injects into #mathai-transition-slot
});
```

## show() Options

| Option | Type | Description |
|--------|------|-------------|
| `icons` | array/string | Emoji icons (e.g., `['🎮']`) |
| `iconSize` | string | `'small'` (48px), `'normal'` (72px), `'large'` (96px) |
| `stars` | number | Show SVG stars (1-3) instead of icons |
| `title` | string | Main title text (required) |
| `subtitle` | string | Subtitle text |
| `buttons` | array | `[{ text, type, action }]` |
| `duration` | number | Auto-hide after ms |
| `persist` | boolean | Never auto-hide |
| `titleStyles` | object | Custom CSS for title |
| `subtitleStyles` | object | Custom CSS for subtitle |

## Common Screen Patterns

### Start Screen
```javascript
transitionScreen.show({
  icons: ['🎮'],
  iconSize: 'large',
  title: 'Are you ready?',
  buttons: [{ text: "I'm ready!", type: 'primary', action: () => startGame() }]
});
```

### Victory (3 Stars)
```javascript
transitionScreen.show({
  stars: 3,
  title: 'Victory! 🎉',
  subtitle: 'Perfect score - Amazing work!',
  buttons: [{ text: 'Claim Stars', type: 'primary', action: () => claimStars() }]
});
```

### Game Over
```javascript
transitionScreen.show({
  icons: ['😔'],
  iconSize: 'large',
  title: 'Game Over!',
  subtitle: 'All lives lost!',
  buttons: [{ text: 'Try again!', type: 'primary', action: () => restartGame() }]
});
```

### Level Transition (auto-hide)
```javascript
transitionScreen.show({
  icons: ['🎯'],
  iconSize: 'normal',
  title: 'Level 3!',
  titleStyles: { color: '#270F63', fontSize: '36px' },
  duration: 2000
});
```

### Stars Claimed (persistent)
```javascript
transitionScreen.show({
  icons: ['🎉'],
  iconSize: 'large',
  title: 'Yay! Stars claimed!',
  persist: true
});
```

## Button Types

| Type | Color | Usage |
|------|-------|-------|
| `'primary'` | Green (`--mathai-green`) | Main action |
| `'secondary'` | Blue (`--mathai-blue`) | Alternative action |

## Requires ScreenLayout Slot

```javascript
ScreenLayout.inject('app', {
  slots: { progressBar: false, transitionScreen: true }
});
```

## Common Issue: Transition Button Stays Hidden on 2nd+ Round

When using `buttons` with a manual action (e.g., "Continue"), the transition screen must be fully visible before the user can interact. If you combine `duration` with `buttons`, the screen may auto-hide before the user clicks. Use **either** `duration` (auto-advance) **or** `buttons` (manual advance) — not both.

For level transitions with a "Continue" button:
```javascript
// CORRECT: buttons only, no duration — waits for user click
transitionScreen.show({
  icons: ['🎯'],
  title: 'Round 2!',
  buttons: [{ text: 'Continue', type: 'primary', action: () => nextRound() }]
});

// WRONG: duration + buttons — screen may auto-hide before click
transitionScreen.show({
  icons: ['🎯'],
  title: 'Round 2!',
  duration: 2000,
  buttons: [{ text: 'Continue', type: 'primary', action: () => nextRound() }]
});
```

Also ensure the game **hides the game screen** and **shows it again** when the transition completes — don't just overlay the transition on top of the game grid.

## Verification

- [ ] `TransitionScreenComponent` instantiated
- [ ] Start screen shown before gameplay begins
- [ ] Victory/game-over screen shown at end with correct star count
- [ ] Level transition screens between rounds (if multi-level)
- [ ] ScreenLayout has transitionScreen slot enabled
- [ ] Transition buttons work on ALL rounds, not just the first
- [ ] No mix of `duration` + `buttons` on the same screen
