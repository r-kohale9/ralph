# Eval: Signal Collector

Tests for `skills/signal-collector/SKILL.md` — the skill that defines when and how games integrate SignalCollector for raw interaction capture and analytics.

## Version

v1 — 2026-04-09 — initial cases based on production validation rules and common generation errors

## Setup

Context files that must be loaded before running:

- `skills/signal-collector/SKILL.md` (integration points, constraints, anti-patterns)
- `skills/signal-collector/reference/signalcollector-api.md` (actual API surface)
- `skills/signal-collector/reference/lifecycle-and-flushing.md` (init sequence, seal, restart)
- `skills/data-contract/SKILL.md` (game_complete schema, postMessage protocol)

## Success Criteria

A SignalCollector integration passes when ALL of the following are true:

1. **Constructor has all required args.** `new SignalCollector({ sessionId, studentId, gameId, contentSetId })` — never empty.
2. **typeof guard in waitForPackages.** `while (typeof SignalCollector === 'undefined')` present.
3. **All 6 signalConfig properties assigned.** `flushUrl`, `playId`, `gameId`, `sessionId`, `contentSetId`, `studentId` set from game_init.
4. **recordViewEvent on every screen transition and content render.** At minimum: start screen, gameplay, results.
5. **seal() before game_complete.** `signalCollector.seal()` called before `postMessage({ type: 'game_complete' })`.
6. **restartGame re-instantiates.** New `SignalCollector` instance, not `.reset()`.
7. **No forbidden patterns.** No inline stub, no `trackEvent()`, no empty constructor.

## Ship-Readiness Gate

All P0 cases must PASS. All P1 cases must PASS or PARTIAL.

---

## Cases

### Case 1: Constructor with required args

**Priority:** P0
**Type:** happy-path
**Judge:** auto

**Input:**

```
Any game archetype.
Generated HTML game code.
```

**Expect:**

- [ ] `new SignalCollector({ sessionId: ..., studentId: ..., gameId: ..., contentSetId: ... })` present
- [ ] `window.signalCollector = signalCollector` assignment present
- [ ] NOT `new SignalCollector()` with empty parentheses
- [ ] `typeof SignalCollector === 'undefined'` check in `waitForPackages()`

**Why:** Tests GEN-UX-005 — the most common generation error is empty constructor or missing window assignment.

---

### Case 2: signalConfig handling in game_init

**Priority:** P0
**Type:** happy-path
**Judge:** auto

**Input:**

```
Any game with handlePostMessage function.
Parent sends game_init with signalConfig.
```

**Expect:**

- [ ] `handlePostMessage` extracts `signalConfig` from `event.data.data`
- [ ] `signalCollector.flushUrl` assigned from `signalConfig.flushUrl`
- [ ] `signalCollector.playId` assigned from `signalConfig.playId`
- [ ] `signalCollector.gameId` assigned with `|| signalCollector.gameId` fallback
- [ ] `signalCollector.sessionId` assigned with `|| signalCollector.sessionId` fallback
- [ ] `signalCollector.contentSetId` assigned with `|| signalCollector.contentSetId` fallback
- [ ] `signalCollector.studentId` assigned with `|| signalCollector.studentId` fallback
- [ ] `signalCollector.startFlushing()` called after `flushUrl` set

**Why:** Tests GEN-PM-SIGNALCONFIG — missing property assignments produce incomplete GCS paths.

---

### Case 3: seal() ordering at game end

**Priority:** P0
**Type:** happy-path
**Judge:** auto

**Input:**

```
Any game with endGame function.
Both victory and game-over paths.
```

**Expect:**

- [ ] `signalCollector.seal()` called in endGame
- [ ] `seal()` call appears BEFORE `postMessage({ type: 'game_complete' })`
- [ ] `seal()` result destructured: `const result = signalCollector.seal()`
- [ ] `signal_event_count: result.event_count` included in game_complete data
- [ ] `signal_metadata: result.metadata` included in game_complete data
- [ ] seal + game_complete fires on BOTH victory AND game-over paths

**Why:** Tests ordering rule — if game_complete fires before seal, parent may destroy iframe before sendBeacon.

---

### Case 4: restartGame re-instantiation

**Priority:** P0
**Type:** edge-case
**Judge:** auto

**Input:**

```
Any game with restart/try-again button.
```

**Expect:**

- [ ] `restartGame` creates new `SignalCollector` instance with same 4 constructor args
- [ ] `window.signalCollector` reassigned to new instance
- [ ] `.reset()` is NOT called anywhere in the code
- [ ] Re-instantiation happens BEFORE `showStartScreen()` or equivalent

**Why:** Tests GEN-SIGNAL-RESET — sealed collector silently ignores all recording. Without re-instantiation, replay of second play is empty.

---

### Case 5: recordViewEvent on DOM changes

**Priority:** P1
**Type:** happy-path
**Judge:** llm

**Input:**

```
Archetype: MCQ Quiz
Bloom: L2 Understand
Game has: start screen, gameplay (rounds), results screen.
```

**Expect:**

- [ ] `recordViewEvent('screen_transition', ...)` on ready -> gameplay transition
- [ ] `recordViewEvent('content_render', ...)` on each round start with question content
- [ ] `recordViewEvent('screen_transition', ...)` on gameplay -> results transition
- [ ] `recordViewEvent('feedback_display', ...)` on correct/wrong visual feedback
- [ ] [LLM] No function that modifies visible DOM is missing a `recordViewEvent` call

**Why:** Tests that view event coverage is complete — every screen and content change is captured for replay narration.

---

### Case 6: Visibility pause/resume integration

**Priority:** P1
**Type:** happy-path
**Judge:** llm

**Input:**

```
Any game with VisibilityTracker.
Student switches tabs mid-game.
```

**Expect:**

- [ ] `signalCollector.pause()` called in `onInactive` callback
- [ ] `signalCollector.resume()` called in `onResume` callback
- [ ] `recordCustomEvent('visibility_hidden', {})` called in `onInactive`
- [ ] `recordCustomEvent('visibility_visible', {})` called in `onResume`
- [ ] [LLM] Pause/resume are paired — no orphan calls

**Why:** Tests that tab switches properly pause/resume signal collection and log visibility events.

---

### Case 7: data-signal-id markup

**Priority:** P1
**Type:** happy-path
**Judge:** auto

**Input:**

```
MCQ game with 4 options, submit button.
```

**Expect:**

- [ ] `data-signal-id` present on answer option buttons
- [ ] `data-signal-id` present on text inputs (if game has them)
- [ ] `data-signal-id` present on submit button
- [ ] `data-signal-id` present on scaffold/hint elements (if game has them)

**Why:** Tests that interactive elements are identifiable in signal events for replay analysis.

---

### Case 8: No forbidden patterns

**Priority:** P0
**Type:** negative
**Judge:** auto

**Input:**

```
Any generated game code.
```

**Expect:**

- [ ] No `signalCollector.trackEvent()` calls (method does not exist)
- [ ] No `signalCollector.reset()` calls (method does not exist)
- [ ] No `new SignalCollector()` with empty parentheses
- [ ] No `window.SignalCollector = class` or `window.SignalCollector = function` definitions
- [ ] No `class SignalCollector {` inline definition

**Why:** Tests that none of the 5 forbidden patterns appear — each one causes a runtime crash or shadows the CDN package.

---

## Eval Scoring

| Result | Meaning |
|--------|---------|
| PASS | All assertions in Expect checklist pass |
| PARTIAL | Some assertions fail — note which ones |
| FAIL | Critical assertions fail or output is fundamentally wrong |

## Ship Gate Check

| Case | Priority | Required result |
|------|----------|----------------|
| Case 1: Constructor with required args | P0 | PASS |
| Case 2: signalConfig handling | P0 | PASS |
| Case 3: seal() ordering | P0 | PASS |
| Case 4: restartGame re-instantiation | P0 | PASS |
| Case 5: recordViewEvent coverage | P1 | PASS or PARTIAL |
| Case 6: Visibility pause/resume | P1 | PASS or PARTIAL |
| Case 7: data-signal-id markup | P1 | PASS or PARTIAL |
| Case 8: No forbidden patterns | P0 | PASS |
