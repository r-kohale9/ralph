# Gameplay Colors Options

Quick reference for gameplay answer feedback color variables.

---

## Available CSS Variables

### Correct Answer Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-cell-bg-green` | `#D9F8D9` | Light green background for correct answers |
| `--mathai-cell-border-green` | `#27ae60` | Dark green border for correct answers |

### Incorrect Answer Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-cell-bg-red` | `#FFD9D9` | Light red background for incorrect answers |
| `--mathai-cell-border-red` | `#e74c3c` | Dark red border for incorrect answers |

### Other State Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-cell-bg-yellow` | `#FCF6D7` | Selected/active cell background |
| `--mathai-cell-bg-grey` | `#E0E0E0` | Disabled cell background |

---

## Usage Patterns

### CSS Classes
```css
.correct {
  background: var(--mathai-cell-bg-green);
  border: 2px solid var(--mathai-cell-border-green);
}

.incorrect {
  background: var(--mathai-cell-bg-red);
  border: 2px solid var(--mathai-cell-border-red);
}
```

### JavaScript (Inline Styles)
```javascript
function markAnswer(element, isCorrect) {
  if (isCorrect) {
    element.style.background = 'var(--mathai-cell-bg-green)';
    element.style.border = '2px solid var(--mathai-cell-border-green)';
  } else {
    element.style.background = 'var(--mathai-cell-bg-red)';
    element.style.border = '2px solid var(--mathai-cell-border-red)';
  }
}
```

### JavaScript (Class Toggle)
```javascript
function markAnswer(element, isCorrect) {
  element.classList.remove('correct', 'incorrect');
  element.classList.add(isCorrect ? 'correct' : 'incorrect');
}
```

---

## When to Use

**Use these colors when:**
- Game provides immediate answer feedback (correct/incorrect)
- Visual feedback enhances learning experience
- Game has right/wrong answers

**Skip these colors when:**
- Pure practice without validation
- No right/wrong answers exist
- Custom color scheme required by design

---

