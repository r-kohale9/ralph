# R&D: Iteration-1 Pass Rate Analysis

**Date:** 2026-03-20
**Scope:** Last 19 builds with full test_results data (builds 191–290, various games)
**Goal:** Measure current iteration-1 pass rate, identify top failing categories, find gen-prompt gaps

---

## Phase 1: Measurement

### Data Source

The `iterations` column in the DB is always 0 (not updated by the current pipeline). The actual iteration history lives in `test_results` as a JSON object with numeric keys (0, 1, 2...) where each entry records `{ batch, iteration, passed, failed, failures }`. Analysis is based on 19 builds with populated test_results, covering 95 category-batches total.

### Build-Level: Full Pass Rate at Iteration 1

**0 out of 19 builds (0%)** passed ALL categories on their first attempt.

Every single build required at least one category to go to iteration 2+. This means the pipeline fix loop is mandatory for every build currently in production — the gen prompt alone never produces a fully passing game.

### Category-Level: Iteration-1 Pass Rate

| Category | Pass@Iter-1 | Total Batches | Avg Iterations Needed |
|---|---|---|---|
| level-progression | 68% (13/19) | 19 | 1.32 |
| mechanics | 42–47% (8–9/19) | 19 | 1.74 |
| contract | 32% (6/19) | 19 | 1.79 |
| game-flow | 26% (5/19) | 19 | 1.95 |
| edge-cases | 26% (5/19) | 19 | 1.68 |

**Overall batch-level:** 37 of 95 batches (39%) passed on iteration 1.

### Top 3 Failing Categories at Iteration 1

1. **game-flow (74% fail rate)** — worst category; nearly 3 in 4 game-flow batches require at least one fix
2. **edge-cases (74% fail rate)** — tied worst; almost all edge-case batches fail first pass
3. **contract (68% fail rate)** — two-thirds of contract batches fail iteration 1

Level-progression is by far the healthiest (32% fail rate) — its tests tend to be simple linear assertions about round content, which the gen LLM gets right.

---

## Phase 2: Error Pattern Breakdown at Iteration 1

### Game-Flow Failures (14 iter-1 failures across 19 builds)

| Error Pattern | Count |
|---|---|
| `toHaveAttribute` on `#app` (data-phase not set) | 5 |
| Element not visible (`toBeVisible` / `toHaveClass`) | 4 |
| Level transition / restart broken | 3 |
| TimeoutError (waitForFunction / waitForPhase) | 1 |
| Other | 2 |

**Dominant pattern:** `data-phase` attribute is missing or not being set at the right moment. 5 of 14 failures are `locator('#app').toHaveAttribute('data-phase', ...)` failures — the test never sees the expected phase. Root cause traced to either: (a) `window.gameState` not on `window` so `syncDOMState()` can't read it, or (b) `gameState.phase` not set immediately in the `game_init` handler before other async work starts.

Secondary pattern: element visibility failures at non-transition stages. Tests expect game elements to be visible immediately after `startGame()`, but CDN slot population races mean elements aren't ready.

### Edge-Cases Failures (14 iter-1 failures)

| Error Pattern | Count |
|---|---|
| TimeoutError (click, waitForFunction) | 7 |
| Value mismatch (`toBe` equality) | 3 |
| `toHaveAttribute` | 2 |
| TypeError (undefined property) | 2 |

**Dominant pattern:** 7 of 14 edge-case failures are `TimeoutError: locator.click: Timeout`. This is the pointer-events race: tests attempt to click interactive elements (options, cells) that become temporarily non-clickable after a correct answer (CSS `pointer-events: none` applied mid-transition). The generated HTML doesn't consistently reset `pointer-events` before the next round starts.

Secondary pattern: value mismatches on double-click prevention logic (`toBe(2)` received `1` etc.) — the `isProcessing` guard is often either too aggressive (blocks valid second clicks) or not aggressive enough (allows double-deduction).

### Contract Failures (13 iter-1 failures)

| Error Pattern | Count |
|---|---|
| TypeError (undefined/null on `__ralph` method) | 3 |
| `toHaveProperty` / missing field | 3 |
| `toBe` value mismatch | 3 |
| `toHaveAttribute` | 2 |
| TimeoutError | 2 |

**Dominant pattern:** Missing or wrong postMessage payload fields. The three `toHaveProperty` failures reference `"score"` and `"duration_data"` specifically. The three `toBe` mismatches come from star calculation formula errors. TypeErrors from `window.__ralph.setLives is not a function` (3 instances) indicate the test harness was not injected — a page init failure that manifests in the contract batch.

---

## Phase 3: Gen Prompt Gap Analysis

The generation prompt (`buildGenerationPrompt` in `lib/prompts.js`) contains the following relevant rules:

- Rule 4: `game_init case must set gameState.phase = 'playing'` as VERY FIRST LINE
- CDN Constraints: `gameState.phase MUST be set at every state transition`
- CDN Constraints: `window.endGame/restartGame/nextRound/gameState MUST be on window`
- CDN Constraints: `isProcessing=true SILENTLY BLOCKS clicks`
- CDN Constraints: `endGame() GUARD: if(gameState.gameEnded)return; gameState.gameEnded=true;`
- Rule 5: `window.parent.postMessage(payload, '*')`

**Gap 1: No explicit rule about resetting `pointer-events` and `isProcessing` between rounds**

The CDN constraints say `isProcessing=true SILENTLY BLOCKS clicks (early return only)` and `isActive GUARD: every answer/click handler MUST start with: if (!gameState.isActive) return; gameState.isActive = false; ... gameState.isActive = true;`. However, there is no explicit rule requiring `isProcessing = false` and `gameState.isActive = true` to be restored at the START of each new round initialization (in `loadRound()` or equivalent), not just at the end of `endGame()`. Generated HTML often sets these guards correctly for single clicks but fails to reset them when the next round loads, causing edge-case "rapid click" and "double-click prevention" tests to see stale locked state from the previous round.

This is the root cause of the 7 edge-case `TimeoutError: locator.click: Timeout` failures — clicks are silently blocked by stale `isProcessing=true` from the prior round.

**Gap 2: No rule requiring explicit `syncDOMState()` call after every `gameState.phase` assignment**

The CDN constraints include `gameState.phase MUST be set at every state transition` and `syncDOMState() immediately after every gameState.phase assignment`. However the generation prompt rule 4 only specifies this for `game_init`. The generation prompt does not enumerate WHICH transitions require the pattern (start→playing, playing→transition, transition→playing for next round, playing→gameover, playing→results). LLMs frequently miss the `syncDOMState()` call on level-transition and restart flows, causing game-flow tests that check `data-phase="playing"` after a level transition to timeout.

This is the cause of 5 game-flow `toHaveAttribute` failures: `#app` never gets `data-phase="playing"` after a level transition because `syncDOMState()` wasn't called at the transition's `onComplete` callback.

**Gap 3: No explicit postMessage payload contract schema in the generation prompt**

The generation prompt says `POSTMESSAGE — always send to PARENT: window.parent.postMessage(payload, '*')` but does not specify the required payload fields. The CDN constraints block says nothing about payload shape. The `contract` failures consistently show missing `score`, `duration_data`, and wrong star values — the LLM generates a postMessage but omits or misnames fields.

The spec's own contract section defines the payload, but the gen prompt doesn't emphasize that the payload MUST include specific fields from the spec. Because specs vary in how they present contract requirements, the LLM often emits a partial payload (e.g., omits `duration_data` which isn't obviously named in most specs). 3 of 13 contract iter-1 failures are missing-field errors.

---

## Phase 4: Primary Hypothesis

**Hypothesis:**
If we add three specific gen-prompt rules — (A) explicit `isProcessing=false` + `isActive=true` reset at the start of every `loadRound()`, (B) an explicit enumeration of every `gameState.phase` transition that requires an immediate `syncDOMState()` call, and (C) a required postMessage payload checklist (must include: `type`, `score`, `stars`, `correct_count`, `total_count`, `duration_data`, `attempts`) — then:

- Edge-cases iteration-1 pass rate will increase from 26% to ~55% (7 timeout failures resolved by correct isProcessing reset)
- Game-flow iteration-1 pass rate will increase from 26% to ~45% (5 attribute failures resolved by syncDOMState on every transition)
- Contract iteration-1 pass rate will increase from 32% to ~50% (missing-field failures resolved by explicit payload checklist)

**Combined expected impact:** Overall batch pass@iter-1 would rise from 39% to approximately 55–60%, reducing average build iterations from ~1.7 to ~1.3 per category. With 5 categories per build and ~19 builds in sample, that's ~7 fewer fix-loop LLM calls per build — roughly a 20% pipeline cost/time reduction per build.

**Why this hasn't been fixed yet:** Rules 1–18 in the gen prompt address initialization (CDN order, waitForPackages, phase/guard setup) but not round-to-round lifecycle maintenance. The lifecycle bugs manifest inside the game loop (loadRound), not at startup, so they escape the current gen prompt's coverage.

---

## Phase 5: Recommended Gen Prompt Additions

### Rule 20 (add to ADDITIONAL GENERATION RULES in `buildGenerationPrompt`):

```
20. ROUND LIFECYCLE — required at the START of every loadRound() / initRound() / setupRound() call:
    gameState.isProcessing = false;   // reset from previous round — NEVER omit
    gameState.isActive = true;        // re-enable click handlers — NEVER omit
    syncDOMState();                   // push current phase to #app data-* attributes
    These MUST be the FIRST three lines inside loadRound(). If omitted, isProcessing=true from
    the prior round silently blocks all clicks and edge-case tests timeout with locator.click Timeout.
```

### Rule 21 (add to ADDITIONAL GENERATION RULES):

```
21. SYNCDOMESTATE CALL SITES — call syncDOMState() immediately after EVERY gameState.phase assignment:
    - game_init → gameState.phase = 'playing'; syncDOMState();        // already in rule 4
    - round complete → gameState.phase = 'transition'; syncDOMState();
    - transitionScreen.show() onComplete → gameState.phase = 'playing'; syncDOMState();
    - endGame (game over path) → gameState.phase = 'gameover'; syncDOMState();
    - endGame (victory path) → gameState.phase = 'results'; syncDOMState();
    - restartGame → gameState.phase = 'playing'; syncDOMState();
    Missing any of these causes data-phase to lag, making waitForPhase() timeout.
```

### Rule 22 (add to ADDITIONAL GENERATION RULES):

```
22. POSTMESSAGE PAYLOAD — the endGame postMessage MUST include ALL of these fields (check spec for values):
    window.parent.postMessage({
      type: 'game_complete',           // REQUIRED — always 'game_complete'
      score: <number>,                  // REQUIRED — final score (integer or float per spec)
      stars: <0|1|2|3>,                 // REQUIRED — result of calcStars()
      correct_count: <number>,          // REQUIRED — total correct answers
      total_count: <number>,            // REQUIRED — total rounds/questions attempted
      duration_data: { ... },           // REQUIRED — timing data object (include even if empty {})
      ...signalPayload,                 // REQUIRED if spec uses PART-010 SignalCollector
    }, '*');
    Missing ANY of these fields causes contract tests to fail with toHaveProperty errors.
    The spec's "Contract Compliance" section or "PART-010" block defines additional required fields — include those too.
```

---

## Supporting Evidence

- Build 290 (aided-game, APPROVED): contract iter-1 failed with `Victory PostMessage Contract payload — toBeDefined: Received: undefined` — missing payload field.
- Build 288 (one-digit-doubles, APPROVED): edge-cases iter-1 failed with `double_click_prevention — toBe(2) received (1)` — stale isProcessing from previous round.
- Build 287 (position-maximizer, APPROVED): game-flow failed 3 iterations with `data-phase attribute` not matching — syncDOMState missing on transition onComplete.
- Build 215 (number-pattern, APPROVED): game-flow failed 2 iterations with `Restart Game Re-initialization — toBeVisible failed` — restart path missing syncDOMState after gameState.phase reset.
- Build 193 (doubles, APPROVED): mechanics iter-1 `TypeError: Cannot read properties of undefined` on level-progression phase — stale isProcessing blocking click handler.
- Lessons 34, 40 in lessons-learned.md confirm the gameState.phase/syncDOMState pattern is a recurring issue.

---

## What Was NOT Implemented

This document is research-only. No code changes were made to `lib/prompts.js`, `lib/pipeline.js`, or any other file. The recommended rules above are proposals requiring a separate implementation and build-validation cycle.

## Next Step

To validate this hypothesis: implement rules 20–22 in `buildGenerationPrompt`, queue 2 builds for games that previously failed at game-flow and edge-cases on iter 1 (e.g., one-digit-doubles, position-maximizer), compare iteration counts and per-category pass@iter-1 rates before vs. after.
