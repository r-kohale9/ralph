# CSS Variables Reference

All MathAI game styles use CSS custom properties loaded from `mathai-game-styles.css`.

---

## Automatic Loading

CSS variables load automatically when you include the components package:
```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

The components package loads `mathai-game-styles.css` before any components.

---

## Available Variables

### Layout Variables

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-game-max-width` | 480px | Maximum game width |
| `--mathai-stack-gap` | 10px | Spacing between elements |
| `--mathai-game-padding-top` | 54px | Top offset for game wrapper |

### Brand Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-primary` | #270f36 | Primary brand color, dark purple |
| `--mathai-level-text` | #270F63 | Level/round titles |
| `--mathai-purple` | #9B51E0 | Accent purple |

### Action Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-green` | #219653 | Primary buttons, success states |
| `--mathai-blue` | #667eea | Secondary buttons |
| `--mathai-red` | #E35757 | Error, danger states |
| `--mathai-orange` | #F2994A | Warning states |
| `--mathai-yellow` | #FFDE49 | Stars, highlights |

### Neutral Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-white` | #ffffff | Backgrounds, light elements |
| `--mathai-gray` | #666666 | Secondary text |
| `--mathai-light-gray` | #f5f5f5 | Light backgrounds |
| `--mathai-disabled-gray` | #E0E0E0 | Disabled states, inactive stars |
| `--mathai-text-primary` | #4a4a4a | Primary text color |
| `--mathai-border-gray` | #e0e0e0 | Borders, dividers |

### Gameplay Cell Colors (Backgrounds)

> **📋 Quick Reference:** Use `workflows/choices/gameplay-colors-options.md` for gameplay color variables and usage patterns.

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-cell-bg-green` | #D9F8D9 | Correct answer cells |
| `--mathai-cell-bg-yellow` | #FCF6D7 | Selected/active cells |
| `--mathai-cell-bg-red` | #FFD9D9 | Incorrect answer cells |
| `--mathai-cell-bg-grey` | #E0E0E0 | Disabled cells |

### Gameplay Cell Colors (Borders)

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-cell-border-green` | #27ae60 | Correct answer borders |
| `--mathai-cell-border-red` | #e74c3c | Incorrect answer borders |

### Component-Specific Colors

| Variable | Value | Used By |
|----------|-------|---------|
| `--mathai-progress-bg` | #f8f8f8 | ProgressBar background |
| `--mathai-progress-bar` | #2563eb | ProgressBar fill |
| `--mathai-progress-container-bg` | #e5e7eb | ProgressBar container |
| `--mathai-transition-bg` | #ffffff | TransitionScreen background |
| `--mathai-transition-title` | #270f36 | TransitionScreen title |
| `--mathai-transition-subtitle` | #666666 | TransitionScreen subtitle |

### Typography Variables

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-font-family` | 'Epilogue', -apple-system, 'Segoe UI', Roboto, sans-serif | Main font stack |
| `--mathai-font-size-title` | 32px | Transition screen titles |
| `--mathai-font-size-subtitle` | 18px | Transition screen subtitles |
| `--mathai-font-size-button` | 16px | Button text |
| `--mathai-font-size-progress` | 16px | Progress bar text |

### Spacing Variables

| Variable | Value | Usage |
|----------|-------|-------|
| `--mathai-padding-large` | 56px 40px | Transition screen content padding |
| `--mathai-padding-medium` | 16px 24px | Progress bar section padding |
| `--mathai-padding-small` | 10px | Game block padding |
| `--mathai-border-radius` | 24px | Large border radius (transition screens) |
| `--mathai-border-radius-small` | 8px | Small border radius (game blocks) |
| `--mathai-border-radius-button` | 10px | Button border radius |

---

## Usage Examples

### Using Variables in Game CSS

```css
/* Good - Uses variables for standard elements */
.game-button {
  background: var(--mathai-green);
  color: var(--mathai-white);
  font-family: var(--mathai-font-family);
  padding: var(--mathai-padding-small);
  border-radius: var(--mathai-border-radius-button);
}

.game-title {
  color: var(--mathai-primary);
  font-size: var(--mathai-font-size-title);
  font-family: var(--mathai-font-family);
}

/* MANDATORY - Gameplay feedback colors */
.correct-answer {
  background: var(--mathai-cell-bg-green);
  border: 2px solid var(--mathai-cell-border-green);
}

.incorrect-answer {
  background: var(--mathai-cell-bg-red);
  border: 2px solid var(--mathai-cell-border-red);
}

.selected-cell {
  background: var(--mathai-cell-bg-yellow);
}

.disabled-cell {
  background: var(--mathai-cell-bg-grey);
}
```

### Gameplay Color Usage (MANDATORY)

**For answer feedback, ALWAYS use these specific colors:**

| State | Background Variable | Background Color | Border Variable | Border Color |
|-------|-------------------|------------------|-----------------|--------------|
| Correct Answer | `--mathai-cell-bg-green` | #D9F8D9 | `--mathai-cell-border-green` | #27ae60 |
| Incorrect Answer | `--mathai-cell-bg-red` | #FFD9D9 | `--mathai-cell-border-red` | #e74c3c |
| Selected/Active | `--mathai-cell-bg-yellow` | #FCF6D7 | (none) | - |
| Disabled | `--mathai-cell-bg-grey` | #E0E0E0 | (none) | - |

**Example implementation:**
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

### When to Use Custom Values

**Use CSS variables when:**
- Styling standard game elements
- Creating buttons or text
- Setting backgrounds that match the theme

**Use custom values when:**
- Game-specific unique styling
- Branding requires different colors
- Special effects not in palette

**Example:**
```css
/* Good - Uses variables for standard elements */
.next-button {
  background: var(--mathai-green);
}

/* Also OK - Game-specific custom color */
.special-power-up {
  background: #FF6B9D;  /* Pink not in standard palette */
  border: 2px solid var(--mathai-yellow);  /* But use variable where possible */
}
```

---

## Overriding Variables

You can override variables in your game's CSS:

```css
:root {
  /* Override specific variable */
  --mathai-green: #28a745;  /* Different green */
  --mathai-font-family: 'Comic Sans MS', cursive;  /* Different font */
}
```

**Note:** Components will use the overridden values.

---

## Which Components Use Which Variables

### ScreenLayoutComponent
Uses: Layout variables only
- `--mathai-game-max-width`
- `--mathai-stack-gap`
- `--mathai-game-padding-top`

CSS classes: `.page-center`, `.game-wrapper`, `.game-stack`, `.game-block`

### ProgressBarComponent
Uses: Progress + typography + spacing
- `--mathai-progress-bg`
- `--mathai-progress-bar`
- `--mathai-progress-container-bg`
- `--mathai-text-primary`
- `--mathai-border-gray`
- `--mathai-font-family`
- `--mathai-font-size-progress`
- `--mathai-padding-medium`

### TransitionScreenComponent
Uses: Transition + colors + typography + spacing
- `--mathai-transition-bg`
- `--mathai-transition-title`
- `--mathai-transition-subtitle`
- `--mathai-green` (primary buttons)
- `--mathai-blue` (secondary buttons)
- `--mathai-yellow` (stars)
- `--mathai-white`
- `--mathai-font-family`
- `--mathai-font-size-title`
- `--mathai-font-size-subtitle`
- `--mathai-font-size-button`
- `--mathai-padding-large`
- `--mathai-border-radius`
- `--mathai-border-radius-button`

---

## See Also


