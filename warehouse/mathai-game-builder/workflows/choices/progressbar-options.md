# ProgressBar Options

Quick reference for ProgressBar component configuration.

---

## Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `autoInject` | Boolean | No | `true` | Auto-inject into `#mathai-progress-slot` |
| `totalRounds` | Number | Yes | - | Total rounds/levels in game |
| `totalLives` | Number | Yes | - | Total hearts/lives to display |
| `slotId` | String | No | `'mathai-progress-slot'` | Custom slot ID |

---

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `update(round, lives)` | `Number, Number` | Update progress display |
| `destroy()` | None | Cleanup when game ends |

---

## Usage Examples

**Basic (5 rounds, 3 lives):**
```javascript
const progressBar = new ProgressBarComponent({
  autoInject: true,
  totalRounds: 5,
  totalLives: 3
});

// Update during gameplay
progressBar.update(1, 3);  // Round 1, 3 lives remaining
progressBar.update(2, 2);  // Round 2, 2 lives remaining

// Cleanup on game end
progressBar.destroy();
```

**Custom slot ID:**
```javascript
const progressBar = new ProgressBarComponent({
  autoInject: true,
  slotId: 'custom-progress-slot',
  totalRounds: 10,
  totalLives: 5
});
```

---

## Display Behavior

- **Text:** `"X/Y rounds completed"` (e.g., "3/5 rounds completed")
- **Lives:** ❤️❤️🤍 (filled = remaining, empty = lost)
- **Progress bar:** 0-100% width, blue (#2563eb), smooth animation (0.5s)

---
