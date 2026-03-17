# ScreenLayout Options

Quick reference for ScreenLayout component configuration.

---

## Slots Configuration

| Option | Type | Values | Description |
|--------|------|--------|-------------|
| `slots.progressBar` | Boolean | `true` / `false` | Creates `#mathai-progress-slot` for ProgressBar |
| `slots.transitionScreen` | Boolean | `true` / `false` | Creates `#mathai-transition-slot` for TransitionScreen |

---

## Usage

**No optional components (minimal game):**
```javascript
ScreenLayout.inject('app', {
  slots: {
    progressBar: false,
    transitionScreen: false
  }
});
```

**With rounds/lives (ProgressBar needed):**
```javascript
ScreenLayout.inject('app', {
  slots: {
    progressBar: true,
    transitionScreen: false
  }
});
```

**Full-featured (both components):**
```javascript
ScreenLayout.inject('app', {
  slots: {
    progressBar: true,
    transitionScreen: true
  }
});
```

---

## Returns

```javascript
{
  progressSlot: 'mathai-progress-slot' | null,
  transitionSlot: 'mathai-transition-slot' | null,
  gameContent: 'gameContent'  // Always present
}
```

---
