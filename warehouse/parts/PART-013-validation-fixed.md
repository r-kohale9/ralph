# PART-013: Validation — Fixed Answer

**Category:** CONDITIONAL | **Condition:** Game has single correct answers | **Dependencies:** None

---

## Code

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  if (Array.isArray(correctAnswer)) {
    const userSorted = [...userAnswer].map(String).sort();
    const correctSorted = [...correctAnswer].map(String).sort();
    return JSON.stringify(userSorted) === JSON.stringify(correctSorted);
  }
  return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
}
```

## When to Use

- "What is 5 + 3?" -> 8 (single value)
- "List prime numbers under 10" -> [2, 3, 5, 7] (array, order-independent)
- Multiple choice with one correct option

## Rules

- String comparison is case-insensitive and trimmed
- Array comparison is order-independent
- Type-coerces to String for comparison (handles number vs string mismatches)

## Verification

- [ ] `validateAnswer` function exists
- [ ] Handles single values (string comparison)
- [ ] Handles arrays (order-independent comparison)
- [ ] Case-insensitive comparison
- [ ] Trims whitespace

## Deep Reference

`mathai-game-builder/reference/validation-types.md`
