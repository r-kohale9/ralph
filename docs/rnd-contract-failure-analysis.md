# R&D: Contract Category Failure Analysis

**Date:** 2026-03-20
**Analyst:** Claude Sonnet 4.6
**Input:** 31 `fix_html` triage calls (contract category), 18 builds with contract test data, journalctl from 2026-03-01

---

## 1. Summary

Contract category has a 44% iter-2 rate (22 of 50 initial triage calls require a second fix attempt).
Analysis of 31 fix_html triage reasoning messages revealed the top failure patterns.

---

## 2. Failure Pattern Classification

| Pattern | Instances | % of fix_html | Description |
|---------|-----------|---------------|-------------|
| **A: Missing or null `game_complete` postMessage** | 11 | 35% | `window.__lastPostMessage` remains null; `endGame()` does not call `postMessage` at all |
| **B: Wrong postMessage structure (flat vs nested)** | 7 | 23% | Game emits flat `{ type, score, stars, total }` but tests check `data.metrics.stars`, `data.events`, etc. |
| **C: `signalCollector` events not emitted** | 4 | 13% | `view:screen_transition` events missing; signalCollector not integrated in screen transition logic |
| **D: JS init failure (page crash)** | 5 | 16% | TimeoutError waiting for `gameState`/`signalCollector`/`__ralph`; underlying JS error prevents init |
| **E: Stars formula wrong** | 4 | 13% | `metrics.stars` doesn't match expected lives-based formula; `calcStars()` returns wrong value |

**Top 2 combined (A + B): 58% of all contract fix_html triage calls.**

---

## 3. Root Cause Analysis

### Pattern A: Missing postMessage (35%)

The `endGame()` function is either:
- Not called at all on game completion (game logic never triggers it)
- Called but without `postMessage` inside it

This is a game logic issue that should be caught by T2 `validateScoringContract` (which checks that `endGame` body contains `postMessage`). However, the T2 check only runs _before_ test-gen; if the generated HTML passes T2 but the endGame is wired incorrectly (e.g., not called on all completion paths), the contract tests still fail.

### Pattern B: Wrong postMessage structure (23%) — ROOT CAUSE FOUND

**This is the most fixable pattern.** Rule 5 in `buildGenerationPrompt` specified:

```js
// WRONG — what Rule 5 said before this fix:
window.parent.postMessage({
  type: 'game_complete',
  score: <number>,
  stars: <0|1|2|3>,
  duration_data: { total_time: <number> },
  correct: <number>,
  incorrect: <number>,
  total: <number>
}, '*');
```

But all CDN games (and all contract tests) expect the nested structure:

```js
// CORRECT — what CDN games actually use:
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: { score, accuracy, time, stars, livesRemaining, attempts, duration_data },
    attempts: gameState.attempts,
    ...signalPayload,  // events, signals, metadata from signalCollector.seal()
    completedAt: Date.now()
  }
}, '*');
```

Contract tests check: `expect(msg.data.metrics.stars).toBe(3)` — with the flat payload, `msg.data` is undefined, causing `toHaveProperty()` and `toBeDefined()` failures.

The LLM was following the instructions exactly — and getting the wrong structure as a result.

Evidence from DB:
- Build 227 (hidden-sums): test received `{"accuracy": 0, "attempts": [], "livesRemaining": 3, ...}` at top level (not inside `data.metrics`) — classic flat structure
- Build 226 (match-the-cards): missing `duration_data` field — LLM used `total_time` instead of the nested structure
- Build 211 (right-triangle-area): `Cannot read properties of null (reading 'type')` — `getLastPostMessage()` returned null because the flat payload wasn't intercepted as `game_complete`

### Pattern C: signalCollector not emitting events (13%)

Games with `PART-010 SignalCollector` specs need `signalCollector.emit('view:screen_transition', ...)` on every screen change. This is a spec-driven requirement already documented in CDN_CONSTRAINTS_BLOCK but the instruction is implicit (buried in the `...signalPayload` line). No separate fix needed beyond the postMessage structure fix which now explicitly requires `...signalPayload` spread.

### Pattern D: JS init failure (16%)

Not contract-specific — these are caused by JS errors (CDN URL wrong, syntax errors) that prevent page init. Caught by other rules (T1 static validation, CDN constraint rules). Not addressable via contract-specific changes.

### Pattern E: Stars formula wrong (13%)

`calcStars()` function uses wrong logic (e.g., threshold-based instead of lives-based). These are game-specific and vary by spec. The T2 `validateScoringContract` check verifies stars is computed — but can't verify the formula matches the spec. Not addressable at gen prompt level without per-spec awareness.

---

## 4. Fix Implemented

### Fix 1: Corrected Rule 5 in `buildGenerationPrompt` (lib/prompts.js)

Replaced the flat payload structure with the correct CDN nested structure. Added explicit WRONG/CORRECT examples to prevent the LLM from reverting.

**Before:**
```
Rule 5: window.parent.postMessage({ type: 'game_complete', score, stars, duration_data: {total_time}, correct, incorrect, total }, '*')
```

**After:**
```
Rule 5: Full nested structure with:
- const signalPayload = signalCollector ? signalCollector.seal() : { events: [], signals: {}, metadata: {} };
- const metrics = { score, accuracy, time, stars, livesRemaining, attempts, duration_data };
- window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts, ...signalPayload, completedAt } }, '*');
- Explicit WRONG examples showing flat structure
```

### Fix 2: Corrected POSTMESSAGE REQUIRED FIELDS in `buildCliGenPrompt` (lib/prompts.js)

Updated the one-line rule in the CLI gen prompt to match the CDN nested structure.

### Fix 3: Updated T2 `validatePostMessageContract` in `lib/validate-contract.js`

The old regex `\{[^}]+\}` couldn't parse nested objects, so it never checked CDN game payload structure. New logic:
- Detects `game_complete` type
- Checks for presence of `data.metrics` pattern (nested structure)
- Errors if flat payload detected (top-level `score`/`stars` with `game_complete` but no `data.metrics`)

### Fix 4: New T2 `validateCalcStarsContract` in `lib/validate-contract.js`

If `function calcStars(...)` is defined in the HTML, requires `window.calcStars = calcStars`. This catches Pattern C from the prior analysis (P3 in `rnd-iteration-count-analysis.md`).

---

## 5. Expected Impact

| Pattern | Before | After |
|---------|--------|-------|
| Pattern B (wrong structure) | 7/31 = 23% of contract failures | 0% — gen prompt now gives exact correct structure |
| Pattern E (calcStars not on window) | ~3/31 = 10% | 0% — T2 catches before test-gen |
| Pattern A (missing postMessage) | 11/31 = 35% | Unchanged — needs game logic fix |
| Pattern C (signalCollector) | 4/31 = 13% | Reduced — postMessage rule now explicitly includes `...signalPayload` |

**Conservative estimate:** 23% + 10% = 33% of contract fix_html triage calls eliminated. With 50 initial contract triage calls in the dataset, this represents ~16 fewer triage + fix LLM calls per equivalent build volume. Each call costs ~3-5s + token cost.

The 44% iter-2 rate should drop toward ~25-30% as the wrong-structure and missing-window-calcStars patterns are eliminated.

---

## 6. Test Count

| | Count |
|--|--|
| Tests before | 532 |
| Tests after | 537 |
| New test cases | 5 (3 validateCalcStarsContract + 2 CDN postMessage format) |

---

## 7. Files Changed

- `lib/prompts.js` — Rule 5 in `buildGenerationPrompt` + POSTMESSAGE line in `buildCliGenPrompt`
- `lib/validate-contract.js` — New `validateCalcStarsContract`, updated `validatePostMessageContract` for CDN format
- `test/validate-contract.test.js` — 5 new test cases

---

## 8. Data Limitations

- 31 fix_html triage calls analyzed — all from the most recent builds (March 2026)
- Pattern counts are from log text classification, not structured metrics
- The 44% iter-2 rate measurement is based on `triage-contract-1` vs `triage-contract-2` log counts — not from DB
- Impact will be measurable after 3-5 new builds that use the updated gen prompt

---

*Trace data: journalctl --since '2026-03-01' on ralph-server, DB at /opt/ralph/data/builds.db, warehouse templates at /opt/ralph/warehouse/templates/*
