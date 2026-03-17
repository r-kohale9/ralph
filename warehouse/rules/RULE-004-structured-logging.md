# RULE-004: Structured Logging

**Severity:** REQUIRED

---

Never log raw objects. Always use `JSON.stringify`.

## Correct

```javascript
console.log('State:', JSON.stringify(gameState, null, 2));
console.error('Error:', JSON.stringify({ error: err.message }, null, 2));
```

## Wrong

```javascript
console.log('State:', gameState);        // Shows [object Object]
console.log(someObject);                 // Unreadable in many contexts
```

## Verification

- [ ] No `console.log(object)` without JSON.stringify
- [ ] All structured data logged with `JSON.stringify(data, null, 2)`
