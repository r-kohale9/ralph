# PART-014: Validation — Function-Based

**Category:** CONDITIONAL | **Condition:** Game has rule-based answers | **Dependencies:** None

---

## Code

```javascript
function validateAnswer(userAnswer, validationFn) {
  try {
    return validationFn(userAnswer);
  } catch (error) {
    console.error('Validation error:', JSON.stringify({ error: error.message }, null, 2));
    return false;
  }
}
```

## When to Use

- "Name any even number" -> rule: `(n) => Number(n) % 2 === 0`
- "Find two numbers that sum to 10" -> rule: `(a, b) => Number(a) + Number(b) === 10`
- Any answer where multiple valid responses exist based on a rule

## Example Validation Functions

```javascript
const isEven = (n) => Number(n) % 2 === 0;
const sumsToTen = (pair) => pair[0] + pair[1] === 10;
const isPrime = (n) => {
  n = Number(n);
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
};
```

## Rules

- Validation function is defined per-round in content structure
- Always wrap in try/catch (RULE-003)
- Return `false` on error (not throw)

## Verification

- [ ] `validateAnswer` function exists
- [ ] Wrapped in try/catch
- [ ] Returns false on error
- [ ] Validation functions defined for each round/question

## Deep Reference

`mathai-game-builder/reference/validation-types.md`
