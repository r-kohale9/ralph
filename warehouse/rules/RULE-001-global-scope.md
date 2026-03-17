# RULE-001: Global Scope for HTML Handlers

**Severity:** CRITICAL

---

Functions called from HTML attributes (`onclick`, `onchange`, `oninput`) MUST be defined in global scope — NOT inside `DOMContentLoaded`.

## Correct

```javascript
// Global scope — accessible from onclick
function handleClick() { /* ... */ }
function handleAnswer(value) { /* ... */ }
function nextRound() { /* ... */ }

// DOMContentLoaded — ONLY for initialization
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  // ... init code only
});
```

## Wrong

```javascript
// Functions inside DOMContentLoaded — NOT accessible from HTML onclick
window.addEventListener('DOMContentLoaded', () => {
  function handleClick() { /* ... */ }  // onclick="handleClick()" FAILS
});
```

## Verification

- [ ] Every function referenced in HTML `onclick`/`onchange`/`oninput` is defined at top-level of `<script>`
- [ ] DOMContentLoaded contains ONLY initialization code (PART-004)
