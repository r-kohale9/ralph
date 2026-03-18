# PART-018: Case Converter

**Category:** CONDITIONAL | **Condition:** Game sends/receives data to/from backend | **Dependencies:** PART-003

---

## Code

```javascript
// JavaScript (camelCase) -> Backend (snake_case)
const snakeData = MathAIHelpers.CaseConverter.toSnakeCase(camelData);

// Backend (snake_case) -> JavaScript (camelCase)
const camelData = MathAIHelpers.CaseConverter.toCamelCase(snakeData);
```

## When to Use

- Before sending data via postMessage to platform
- After receiving data from platform
- Any backend communication

## Rules

- **Note:** CaseConverter is NOT currently included in the Helpers package. If your game needs it, implement inline conversion functions or verify CaseConverter has been added to the helpers bundle before using `MathAIHelpers.CaseConverter`.
- Handles nested objects, arrays, primitives, Date objects
- Recursive — converts all levels deep

## Verification

- [ ] Uses `MathAIHelpers.CaseConverter` (not custom implementation)
- [ ] `toSnakeCase` used before sending data
- [ ] `toCamelCase` used after receiving data

## Deep Reference

`mathai-game-builder/helpers/case-converter.md`
