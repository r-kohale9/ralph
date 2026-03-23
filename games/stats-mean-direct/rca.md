# stats-mean-direct — Root Cause Analysis

## Build #575 — FAILED (iterations=2)

### Summary

Build #575 failed with "JS error on start — options not rendering." Diagnosis performed by static HTML analysis of GCP build artifact (40 KB confirmed) and direct execution of the static validator (`lib/validate-static.js`) against the downloaded HTML.

---

### Root Cause (PRIMARY — P0)

**T1 static validation fails with false positive: `GEN-112` "3-arg progressBar.update()" fires on `Math.max(0, gameState.lives)` pattern**

**What the validator reports:**
```
STATIC VALIDATION FAILED — 1 error(s):
  ✗ ERROR: progressBar.update() called with 3 args — correct signature is
    progressBar.update(currentRound, lives) (2 args only).
```

**What the generated code actually contains:**
```javascript
if (progressBar) progressBar.update(gameState.currentRound, Math.max(0, gameState.lives));
```

This is a **2-arg call** with the correct clamped lives pattern. However, the T1 check in `lib/validate-static.js` (rule 5f11/GEN-112) uses this regex:
```javascript
/progressBar\s*\.\s*update\s*\(\s*\S[^)]*,\s*\S[^)]*,\s*\S[^)]*\)/
```

The regex matches on the **comma inside `Math.max(0, gameState.lives)`** — treating it as a third argument separator. `Math.max(0, ...)` is logically a single argument but the regex sees `..., 0, gameState.lives` and fires.

**Confirmed by running the regex directly:**
- `progressBar.update(currentRound, Math.max(0, lives))` → regex matches → **FALSE POSITIVE**
- `progressBar.update(currentRound, lives)` → regex does not match → correct
- `progressBar.update(currentRound, totalRounds, lives)` → regex matches → correct detection

**Effect:** T1 exits with code 1 → pipeline kills the build / forces iteration without fixing the actual game logic → both iterations fail → build marked FAILED.

**The game logic itself is correct.** `progressBar.update(currentRound, Math.max(0, lives))` is the right clamped 2-arg call per W14/LP-PROGRESSBAR-CLAMP rule. The static validator is producing a false positive that prevents approval.

---

### Secondary Issues Found (P1 — would cause test failures if T1 passed)

#### Issue 2 — Phase value `'gameover'` instead of `'game_over'`

`endGame()` sets:
```javascript
gameState.phase = isVictory ? 'results' : 'gameover';
```

The spec mandates `'game_over'` (with underscore). Tests asserting `waitForPhase('game_over')` would fail. The test harness normalizes `game_over → gameover` but NOT the reverse.

**Classification:** Gen rule gap. Rule GEN-120 covers phase names but the generated code used `'gameover'`.

#### Issue 3 — `#gameContent` show/hide in place of `#game-area`

`startGame()` and `endGame()` reference `document.getElementById('gameContent')` to toggle game area visibility. The spec mandates using `document.getElementById('game-area')`. `#gameContent` is a ScreenLayout internal slot — its visibility is not the game's to manage.

**Classification:** Gen rule gap. The game HTML is in a `<template>` tag (correct — cloned into `#gameContent` on init), but the show/hide logic should target `#game-area`, not `#gameContent`.

#### Issue 4 — Two `progressBar.update()` calls without `Math.max` clamp (P2)

Lines 390 and 423 call:
```javascript
progressBar.update(gameState.currentRound, gameState.lives);
```
without `Math.max(0, ...)`. After lives reach 0, passing a negative value to `progressBar.update()` causes `String.prototype.repeat(-N)` → RangeError. These calls are in `startGame()` (safe — lives reset to 3) and `loadQuestion()` (safe if lives always ≥ 0 here). But W14 rule recommends clamping all calls.

#### Issue 5 — Missing `data-testid="btn-start"` (P2 warning)

Static validator warned: no `data-testid="btn-start"` on the start button. Tests use this to click the play button. The start button is rendered by `TransitionScreenComponent` (CDN) — but the game must pass `testId: 'btn-start'` in the `buttons` array of the start `transitionScreen.show()` call.

---

### Classification Table

| Issue | Classification | Severity | Root? |
|-------|----------------|----------|-------|
| GEN-112 false positive on `Math.max(0, lives)` | **Pipeline bug in validate-static.js** | P0 | YES — kills build |
| Phase `'gameover'` vs `'game_over'` | Gen rule gap | P1 | Secondary |
| `#gameContent` instead of `#game-area` show/hide | Gen rule gap | P1 | Secondary |
| Missing `Math.max` clamp on 2 update() calls | Gen rule gap / W14 | P2 | No |
| Missing `data-testid="btn-start"` | Gen rule gap | P2 warning | No |

---

### Recommended Fixes

#### Fix 1 (P0 — REQUIRED before any requeue) — Fix GEN-112 regex in validate-static.js

**File:** `/Users/the-hw-app/Projects/mathai/ralph/lib/validate-static.js`

The current regex for 3-arg detection:
```javascript
/progressBar\s*\.\s*update\s*\(\s*\S[^)]*,\s*\S[^)]*,\s*\S[^)]*\)/
```
fires false positives on `Math.max(0, lives)` because it counts the comma inside the nested function call.

**Fix approach:** Exclude matches where `Math.max(` appears between the matched commas. One option is to check that the match doesn't contain `Math.max`:
```javascript
const match = html.match(/progressBar\s*\.\s*update\s*\([^)]*\)/g) || [];
const threeArgCalls = match.filter(m => {
  // Count top-level commas (ignoring commas inside nested parens)
  let depth = 0, commas = 0;
  for (const ch of m.slice(m.indexOf('(') + 1, m.lastIndexOf(')'))) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) commas++;
  }
  return commas >= 2;
});
if (threeArgCalls.length > 0) { errors.push('ERROR: ...')); }
```

#### Fix 2 (P1) — Add gen rule for `game_over` phase name

Add to gen prompt: `endGame(false)` must set `gameState.phase = 'game_over'` (underscore, not `'gameover'`).

#### Fix 3 (P1) — Add gen rule: use `#game-area` not `#gameContent`

Add gen rule: never reference `#gameContent` in game logic. Show/hide the game's own `#game-area` element. `#gameContent` belongs to ScreenLayout.

---

### Next Actions

1. **Deploy Fix 1** to server (`lib/validate-static.js`) — this unblocks all future builds that correctly use `Math.max(0, lives)` clamping.
2. **Run `npm test`** after the fix to confirm no regressions in the validate-static test suite.
3. Update the spec Section 7.2 to use `progressBar.update(roundNumber, gameState.lives)` (matching the actual CDN API) instead of the incorrectly documented `progressBar.setRound(roundNumber)`.
4. Queue build #576 after deploying the validator fix.

---

*Diagnosis performed: 2026-03-23. Source: static HTML analysis of GCP build #575 artifact (40 KB) + direct `node lib/validate-static.js` execution. Primary root cause: false positive in GEN-112 T1 check. Classification: pipeline bug (validate-static.js regex) + 2 gen rule gaps.*
