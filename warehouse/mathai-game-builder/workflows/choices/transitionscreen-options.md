# TransitionScreen Options

Quick reference for TransitionScreen component configuration.

---

## Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `autoInject` | Boolean | No | `true` | Auto-inject into `#mathai-transition-slot` |

---

## show() Method Options

| Option | Type | Description |
|--------|------|-------------|
| `icons` | Array/String | Emoji icons to display (e.g., `['🎮']`) |
| `iconSize` | String | Icon size: `'small'` (48px), `'normal'` (72px), `'large'` (96px) |
| `stars` | Number | Show SVG stars instead of icons (1-3) |
| `title` | String | Main title text (required) |
| `subtitle` | String | Optional subtitle text |
| `buttons` | Array | Button configurations: `[{text, type, action}]` |
| `duration` | Number | Auto-hide after milliseconds |
| `persist` | Boolean | Never hide (for "Stars Claimed" screen) |
| `titleStyles` | Object | Custom CSS styles for title |
| `subtitleStyles` | Object | Custom CSS styles for subtitle |

### Button Configuration

| Option | Type | Description |
|--------|------|-------------|
| `text` | String | Button label |
| `type` | String | `'primary'` (green) or `'secondary'` (blue) |
| `action` | Function | Click handler function |

---

## Common Screen Types

### 1. Start Screen
```javascript
transitionScreen.show({
  icons: ['🎮'],
  iconSize: 'large',
  title: 'Are you ready?',
  buttons: [{
    text: "I'm ready!",
    type: 'primary',
    action: () => startGame()
  }]
});
```

### 2. Victory Screen (3 stars)
```javascript
transitionScreen.show({
  stars: 3,
  title: 'Victory! 🎉',
  subtitle: 'Perfect score - Amazing work!',
  buttons: [{
    text: 'Claim Stars',
    type: 'primary',
    action: () => claimStars()
  }]
});
```

### 3. Game Over Screen
```javascript
transitionScreen.show({
  icons: ['😔'],
  iconSize: 'large',
  title: 'Game Over!',
  subtitle: 'All lives lost!',
  buttons: [{
    text: 'Try again!',
    type: 'primary',
    action: () => restartGame()
  }]
});
```

### 4. Level Transition (auto-hide)
```javascript
transitionScreen.show({
  icons: ['🎯'],
  iconSize: 'normal',
  title: 'Level 3!',
  titleStyles: {
    color: '#270F63',
    fontSize: '36px'
  },
  duration: 2000  // Auto-hide after 2 seconds
});
```

### 5. Stars Claimed (persistent)
```javascript
transitionScreen.show({
  icons: ['🎉'],
  iconSize: 'large',
  title: 'Yay! Stars claimed!',
  persist: true  // Never hides
});
```

---
