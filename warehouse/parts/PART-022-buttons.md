# PART-022: Game Buttons

**Category:** MANDATORY | **Condition:** Every game with user interactions | **Dependencies:** PART-020

---

## Required Buttons

Every game must include these contextual buttons:

| Button | Position | Visibility | Style | Function |
|--------|----------|-----------|-------|----------|
| **Reset** | Below play area | Always visible during gameplay | Secondary (gray/blue) | Resets all inputs to initial state |
| **Submit** | Bottom-center | After at least 1 interaction | Primary (green) | Validates current answer |
| **Retry** | Bottom-center | After incorrect submission | Secondary (blue) | Allows retry on same question |
| **Next** | Bottom-center | After correct or round complete | Primary (green) | Advances to next round |

## Rules

- **Mutual exclusivity:** Only one action button visible at a time (Submit OR Retry OR Next)
- **Reset** is separate — always visible during gameplay
- Buttons stack vertically on narrow screens, stay centered on wide screens

## CSS

```css
.btn-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: var(--mathai-padding-small);
  flex-wrap: wrap;
}

.game-btn {
  padding: 14px 32px;
  font-size: var(--mathai-font-size-button);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  border: none;
  border-radius: var(--mathai-border-radius-button);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--mathai-white);
}

.game-btn:active {
  transform: translateY(0);
}

.game-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Primary — Submit, Next, Confirm */
.btn-primary {
  background: var(--mathai-green);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

/* Secondary — Retry, Reset */
.btn-secondary {
  background: var(--mathai-blue);
}
.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* Danger */
.btn-danger {
  background: var(--mathai-red);
}
.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(227, 87, 87, 0.4);
}

/* Hidden utility */
.hidden { display: none !important; }
```

## HTML Pattern

```html
<div class="btn-container">
  <button class="game-btn btn-secondary" onclick="resetInputs()">Reset</button>
  <button class="game-btn btn-primary" id="btn-submit" onclick="handleSubmit()">Submit</button>
  <button class="game-btn btn-secondary hidden" id="btn-retry" onclick="handleRetry()">Retry</button>
  <button class="game-btn btn-primary hidden" id="btn-next" onclick="nextRound()">Next</button>
</div>
```

## JavaScript — Button State Management

```javascript
function showButton(buttonId) {
  ['btn-submit', 'btn-retry', 'btn-next'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(buttonId).classList.remove('hidden');
}

// After correct answer:
showButton('btn-next');

// After incorrect answer:
showButton('btn-retry');

// After retry/reset:
showButton('btn-submit');
```

## Verification

- [ ] Submit, Retry, Next buttons exist
- [ ] Only one action button visible at a time
- [ ] Buttons use `var(--mathai-green)` / `var(--mathai-blue)` colors
- [ ] Hover effects with `translateY(-2px)` and box-shadow
- [ ] Disabled state with reduced opacity
- [ ] All button onclick handlers in global scope (RULE-001)
