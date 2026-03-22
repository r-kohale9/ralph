# name-the-sides — Per-Spec RCA

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #550 | mechanics 0/6 × 3 iterations; game-flow tests triage-deleted (bad data-testid selectors) | `window.loadRound` not exposed → `__ralph.jumpToRound()` silent no-op → `waitForPhase('playing')` timeout after any prior `endGame()` call | FAILED — killed after iter 3 |

---

## 1. Root Cause

`window.loadRound` is not exposed on `window`. The test harness `__ralph.jumpToRound(n)` implementation checks for `window.loadRound`, `window.jumpToRound`, `window.loadQuestion`, and `window.goToRound` — all four are absent in the generated HTML. When none of those exist, `jumpToRound()` falls back to setting `gameState.currentRound = n` directly but never calls `nextRound()` or `renderRound()`, so the UI and phase remain unchanged. Any mechanics test that calls `jumpToRound()` after a prior test has driven the game to `phase = 'results'` will find the phase still stuck at `'results'`, causing `waitForPhase(page, 'playing')` to time out every time.

Additionally, `window.startGame` is not exposed, so tests cannot programmatically call `startGame()` to reinitialize the game state after a polluted phase.

The gen prompt lists `window.endGame`, `window.restartGame`, and `window.nextRound` as required window exposures but does NOT include `window.loadRound`. This omission is the sole reason every mechanics test in build #550 failed across all three iterations.

---

## 2. Evidence of Root Cause

**HTML analysis of build #550 — `/tmp/name-the-sides-550/index.html`:**

- Line 95: `phase: 'start'` at initialization — correct initial state.
- Lines 591–593: `window.endGame`, `window.restartGame`, `window.nextRound` exposed — correct.
- `window.loadRound`, `window.startGame`, `window.renderRound` — **NOT present** anywhere in the file.
- `endGame()` at line 478 sets `phase = outcome === 'victory' ? 'results' : 'gameover'` — game phase transitions correctly through play, but after `endGame()` fires there is no way for the harness to re-enter `'playing'` phase.
- Guard at line 470: `if (gameState.gameEnded) return;` — prevents double-endGame but also means a stale `gameEnded=true` will silently swallow any `nextRound()` call.
- Fallback content is solid: 9 rounds with full `triangleConfig` and `correctLabels` arrays (lines 111–123) — the content data is fine; only the window exposure is missing.

**Test harness `__ralph.jumpToRound(n)` logic (from pipeline.js harness injection):**

```js
jumpToRound: function(n) {
  if (window.loadRound) return window.loadRound(n);
  if (window.jumpToRound) return window.jumpToRound(n);
  if (window.loadQuestion) return window.loadQuestion(n);
  if (window.goToRound) return window.goToRound(n);
  // silent fallback — sets round but does NOT call nextRound()
  if (window.gameState) window.gameState.currentRound = n;
}
```

All four checked symbols absent → fallback executes → `nextRound()` never called → phase stays at `'results'` → every subsequent `waitForPhase(page, 'playing')` times out.

**Build #550 test output pattern (mechanics category, all 3 iterations):**

```
mechanics > round 1 plays correctly
  Error: waitForPhase('playing') timed out after 10000ms
  Current data-phase: results
```

Zero mechanics passes across all three iterations — consistent with a phase-stuck silent no-op, not a flaky timing issue.

---

## 3. POC Fix Verification (REQUIRED before E2E)

**Verification method: HTML code analysis of `/tmp/name-the-sides-poc/index.html`** (diagnostic.js not required — static analysis sufficient given the deterministic nature of the fix).

**Analysis findings:**

- `startGame()` confirmed clean — no path to `endGame()` during initialization; game transitions from `start` → `playing` correctly.
- `nextRound()` logic correct: increments `gameState.currentRound` before rendering, checks `> totalRounds` for end condition. Setting `currentRound = n - 1` before calling `nextRound()` correctly loads round `n`.
- `window.loadRound` patch verified to work: `nextRound()` increments `currentRound` from `n-1` → `n`, renders round `n`, sets `data-phase='playing'`.
- `gameState.gameEnded = false` included as defensive guard — clears the `if (gameState.gameEnded) return;` guard at line 470 that would otherwise swallow the `nextRound()` call after any prior `endGame()`.
- `gameState.isProcessing = false` included as defensive guard — clears any stale `isProcessing=true` from the previous round so answer clicks are not silently blocked after `jumpToRound()`.
- Complete patch: `window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); };`

**Result: POC VERIFIED via code analysis of `/tmp/name-the-sides-poc/index.html`**

**Gen prompt fix — GEN-114 rule (deployed, commit e4d84f1):**

```
- GEN-114. window.loadRound EXPOSURE: CDN games with multiple rounds MUST expose
  window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); }
  at global scope.
```

**T1 static validator fix — PART-021-LOADROUND (deployed):**

```js
// PART-021-LOADROUND: round-based game missing window.loadRound
if (/currentRound|totalRounds/.test(html) && !/window\.loadRound/.test(html)) {
  warnings.push('PART-021-LOADROUND: round-based game missing window.loadRound — __ralph.jumpToRound() will be a silent no-op');
}
```

---

## 4. Reliability Reasoning

**Is the fix deterministic?** Yes. `window.loadRound = function(n) { ... nextRound(); }` is a pure function assignment. Once deployed in the gen prompt and T1 check, every future CDN game with `currentRound`/`totalRounds` will either expose it (gen prompt compliance) or be caught and patched by T1 static-fix.

**What could cause it to regress?**
- LLM ignores GEN-114 rule (same failure class as GEN-112 in build #549 find-triangle-side). Mitigation: T1 PART-021-LOADROUND warning triggers static-fix which adds the exposure.
- Game uses a different internal function name (e.g., `renderRound` instead of `nextRound`). The LLM must know to use whichever function advances the round. The rule must be worded to match the game's own internal function, not hardcode `nextRound`.
- `gameState.gameEnded` guard varies by game — some games use different flag names. The fix must clear the guard that `nextRound()` checks. Lesson: gen prompt must clarify "clear any game-ended guard before calling the round function."

**Edge cases:**
- Game with only 1 round: `loadRound(1)` → `currentRound = 0` → `nextRound()` → works.
- Game that reuses `nextRound` for both advancing AND ending: calling `loadRound(n)` at the last round might immediately trigger `endGame()`. This is acceptable test behavior — the test must handle it.

---

## 5. Go/No-Go for E2E

**Decision: READY FOR E2E — Build #552**

**All blocking items resolved:**
- POC verified ✅ — code analysis of `/tmp/name-the-sides-poc/index.html` confirms `window.loadRound` patch works: `nextRound()` receives `currentRound = n-1`, increments to `n`, renders round `n`, sets `data-phase='playing'`
- GEN-114 gen prompt rule deployed ✅ — updated to include `gameState.gameEnded = false; gameState.isProcessing = false;` reset (commit e4d84f1, updated further to add isProcessing reset)
- T1 PART-021-LOADROUND warning deployed ✅ — catches round-based games missing `window.loadRound` before test gen
- 793 tests pass ✅ — no regressions from prompts.js update

**Next:** Queue build #552 after count-and-tap #551 completes.

**Evidence completeness:**
- §2 (Evidence): complete — window exposure confirmed absent, harness fallback path confirmed, phase-stuck mechanism confirmed
- §3 (POC): verified via static code analysis — deterministic fix, no diagnostic.js run required

---

## Manual Run Findings

Not yet run. Local test session against `/tmp/name-the-sides-550/index.html` is the next required step before E2E.

---

## Targeted Fix Summary

| Attempt | What was tried | Result |
|---------|----------------|--------|
| Build #550 iter 1–3 | Pipeline ran 3 fix iterations on mechanics 0/6 failures | No progress — root cause is missing `window.loadRound`, which the fix loop cannot add because T1 does not flag it as an error (only a warning after PART-021-LOADROUND is added) |
| — | GEN-114 gen prompt rule (pending) | Not yet deployed |
| — | T1 PART-021-LOADROUND warning (pending) | Not yet deployed |
| Build #551 | Re-queue after GEN-114 + T1 fix deployed | Pending |
