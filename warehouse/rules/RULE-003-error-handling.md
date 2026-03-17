# RULE-003: Error Handling

**Severity:** CRITICAL

---

All async operations MUST be wrapped in try/catch.

## Correct

```javascript
try {
  await someAsyncOperation();
} catch (error) {
  console.error('Failed:', JSON.stringify({ error: error.message, name: error.name }, null, 2));
}
```

## Wrong

```javascript
await someAsyncOperation(); // Unhandled rejection if it fails
```

## Verification

- [ ] Every `await` call is inside a try/catch block
- [ ] Catch blocks log structured errors (RULE-004)
