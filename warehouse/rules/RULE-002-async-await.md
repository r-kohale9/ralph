# RULE-002: Async/Await

**Severity:** CRITICAL

---

Every function that uses `await` MUST be declared `async`.

## Correct

```javascript
async function handleAnswer() {
  await FeedbackManager.sound.play('correct');
}
```

## Wrong

```javascript
function handleAnswer() {
  await FeedbackManager.sound.play('correct'); // SyntaxError!
}
```

## Verification

- [ ] Every function containing `await` has `async` keyword
- [ ] No bare `await` outside async functions
