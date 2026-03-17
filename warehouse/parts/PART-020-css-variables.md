# PART-020: CSS Variables & Color System

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-002 (variables auto-load with Components package)

---

## How Variables Load

CSS variables load automatically when the Components package (PART-002) is included. The package loads `mathai-game-styles.css` which defines all `:root` variables. You don't need a separate `<link>` tag.

## CSS Variables — Full Reference

```css
:root {
  /* ===================== LAYOUT ===================== */
  --mathai-game-max-width: 480px;
  --mathai-stack-gap: 10px;
  --mathai-game-padding-top: 54px;

  /* ===================== BRAND COLORS ===================== */
  --mathai-primary: #270f36;        /* Dark purple — titles, headings */
  --mathai-level-text: #270F63;     /* Purple — level/round titles */
  --mathai-purple: #9B51E0;         /* Light purple — accents, badges */

  /* ===================== ACTION COLORS ===================== */
  --mathai-green: #219653;          /* Primary buttons, success */
  --mathai-blue: #667eea;           /* Secondary buttons */
  --mathai-red: #E35757;            /* Error, danger */
  --mathai-orange: #F2994A;         /* Warning */
  --mathai-yellow: #FFDE49;         /* Stars, highlights */

  /* ===================== NEUTRAL COLORS ===================== */
  --mathai-white: #ffffff;
  --mathai-gray: #666666;           /* Secondary text */
  --mathai-light-gray: #f5f5f5;     /* Light backgrounds */
  --mathai-disabled-gray: #E0E0E0;  /* Disabled states, inactive stars */
  --mathai-text-primary: #4a4a4a;   /* Primary text */
  --mathai-border-gray: #e0e0e0;    /* Borders, dividers */

  /* ===================== GAMEPLAY CELL COLORS ===================== */
  /* Backgrounds */
  --mathai-cell-bg-green: #D9F8D9;  /* Correct answer */
  --mathai-cell-bg-yellow: #FCF6D7; /* Selected/active */
  --mathai-cell-bg-red: #FFD9D9;    /* Incorrect answer */
  --mathai-cell-bg-grey: #E0E0E0;   /* Disabled */

  /* Borders */
  --mathai-cell-border-green: #27ae60; /* Correct answer border */
  --mathai-cell-border-red: #e74c3c;   /* Incorrect answer border */

  /* ===================== COMPONENT COLORS ===================== */
  --mathai-progress-bg: #f8f8f8;
  --mathai-progress-bar: #2563eb;
  --mathai-progress-container-bg: #e5e7eb;
  --mathai-transition-bg: #ffffff;
  --mathai-transition-title: #270f36;
  --mathai-transition-subtitle: #666666;

  /* ===================== TYPOGRAPHY ===================== */
  --mathai-font-family: 'Epilogue', -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mathai-font-size-title: 32px;
  --mathai-font-size-subtitle: 18px;
  --mathai-font-size-button: 16px;
  --mathai-font-size-progress: 16px;

  /* ===================== SPACING ===================== */
  --mathai-padding-large: 56px 40px;
  --mathai-padding-medium: 16px 24px;
  --mathai-padding-small: 10px;
  --mathai-border-radius: 24px;
  --mathai-border-radius-small: 8px;
  --mathai-border-radius-button: 10px;
}
```

## Gameplay Feedback Colors (MANDATORY)

Every game with correct/incorrect answers MUST use these specific colors:

| State | Background | Border | CSS Class Pattern |
|-------|-----------|--------|-------------------|
| Correct | `var(--mathai-cell-bg-green)` | `2px solid var(--mathai-cell-border-green)` | `.correct` |
| Incorrect | `var(--mathai-cell-bg-red)` | `2px solid var(--mathai-cell-border-red)` | `.incorrect` |
| Selected | `var(--mathai-cell-bg-yellow)` | — | `.selected` |
| Disabled | `var(--mathai-cell-bg-grey)` | — | `.disabled` |

```css
.correct { background: var(--mathai-cell-bg-green); border: 2px solid var(--mathai-cell-border-green); }
.incorrect { background: var(--mathai-cell-bg-red); border: 2px solid var(--mathai-cell-border-red); }
.selected { background: var(--mathai-cell-bg-yellow); }
.disabled { background: var(--mathai-cell-bg-grey); pointer-events: none; opacity: 0.6; }
```

```javascript
// JavaScript pattern for marking answers
function markAnswer(element, isCorrect) {
  element.classList.remove('correct', 'incorrect');
  element.classList.add(isCorrect ? 'correct' : 'incorrect');
}
```

## Button Colors

| Button Type | Background | Hover Shadow | Usage |
|-------------|-----------|-------------|-------|
| Primary | `var(--mathai-green)` | `0 6px 20px rgba(33,150,83,0.4)` | Submit, Start, Confirm, Claim |
| Secondary | `var(--mathai-blue)` | `0 6px 20px rgba(102,126,234,0.4)` | Retry, Alternative actions |
| Danger | `var(--mathai-red)` | `0 6px 20px rgba(227,87,87,0.4)` | Destructive actions |
| Warning | `var(--mathai-orange)` | `0 6px 20px rgba(242,153,74,0.4)` | Warning states |

## Star Colors

| State | Color | Variable |
|-------|-------|----------|
| Active star | `#FFDE49` | `--mathai-yellow` |
| Inactive star | `#E0E0E0` | `--mathai-disabled-gray` |
| Star highlight (SVG) | `#ffff8d` | — |
| Star shadow (SVG) | `#f4b400` | — |

## Gradients

```css
/* Page/action bar background */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Brand buttons */
background: linear-gradient(135deg, #270f36 0%, #9B51E0 100%);
```

## Overriding Variables

Games can override variables for custom theming:
```css
:root {
  --mathai-green: #28a745;  /* Custom green */
  --mathai-font-family: 'Comic Sans MS', cursive;
}
```

## Anti-Patterns

```css
/* WRONG: Hardcoded colors for feedback */
.correct { background: #4caf50; }

/* CORRECT: Use variables */
.correct { background: var(--mathai-cell-bg-green); border: 2px solid var(--mathai-cell-border-green); }

/* WRONG: Custom font without fallback */
font-family: 'Epilogue';

/* CORRECT: Use variable (has fallback chain) */
font-family: var(--mathai-font-family);
```

## Verification

- [ ] No hardcoded hex colors for feedback states (correct/incorrect/selected/disabled)
- [ ] Gameplay feedback uses `--mathai-cell-bg-*` and `--mathai-cell-border-*` variables
- [ ] Buttons use `--mathai-green`, `--mathai-blue`, `--mathai-red` for action colors
- [ ] Text uses `--mathai-primary` or `--mathai-text-primary`
- [ ] Font uses `var(--mathai-font-family)` or system font stack
