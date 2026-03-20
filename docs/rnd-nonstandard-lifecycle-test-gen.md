# R&D: Non-Standard Lifecycle Test Generation

**Date:** 2026-03-20
**Status:** active — H1 fix shipped (b27e010), `extractGameFeatures()` prototype implemented, measurement pending (builds 345/346 still queued)
**Hypothesis:** Test-gen prompt generates lives-decrement, per-round-reset, and timer assertions for games that don't support them. Adding a spec-derived `gameFeatures` block to the test-gen prompt (unlimited_lives, timed_scoring, sequential_steps) eliminates 0-iteration kills caused by structurally wrong tests.

---

## Trace

### Builds killed at 0 iterations for wrong tests

| Build | Game | Kill Reason | Spec Feature |
|-------|------|-------------|--------------|
| 321 | rapid-challenge | "lives on unlimited-lives game" | `totalLives: 3` (has lives — kill reason was operator error; see below) |
| 328 | associations | "lives on unlimited-lives game" | `totalLives: 0` + unlimited lives, accuracy-scored |

### Root cause for associations (build 328)

**Spec:** `PART-023 totalLives: 0 (no lives display)`, `Custom star logic: accuracy-based (100%->3, >=60%->2, >=30%->1, <30%->0)`

**What happened:** Test-gen produced mechanics tests like:
- "lives decrease on wrong answer"
- "game ends when lives reach 0"
- "lives display shows correct count"

These always fail because `gameState.lives` is not a tracked field and hearts never decrement. They are structurally wrong tests — no fix loop iteration can make them pass.

**Fix shipped (b27e010, 2026-03-20):** Added LIVES SYSTEM CHECK rule to `buildTestCasesPrompt` (Step 2a) and `buildTestGenCategoryPrompt` (Step 2b): if spec has `totalLives: 0`, `livesEnabled: false`, or no lives system, test generator must not produce lives-decrement assertions.

### Rapid-challenge (build 321) — misclassified kill

Rapid-challenge has `totalLives: 3` (lives ARE enabled). The kill reason "lives on unlimited-lives game" was a manual operator error — the game is not unlimited-lives. The real issue for rapid-challenge was different. Build 346 (re-queued with latest pipeline code) will reveal the actual failure. This R&D should track the outcome.

### Other non-standard lifecycle variants not yet covered by b27e010

Beyond `totalLives: 0`, there are other lifecycle variants where test-gen generates wrong assertions:

| Pattern | Example Games | Wrong Tests Generated | Detection Signal |
|---------|--------------|----------------------|-----------------|
| Timer-only scoring (no lives) | associations | lives-decrement assertions | `totalLives: 0` in spec |
| Timed-flash / sequential-reveal | totals-in-a-flash | click during animation, expect immediate feedback | `timerType: 'flash'` or `timed-flash` spec hint |
| Sequential-step (1 logical round, many steps) | free-the-key, crazy-maze | jump-to-round, lives-per-round assertions | `rounds: 1` or `interaction: grid-click` + no round-counter |
| Accuracy-not-lives scoring | associations, face-memory | `setLives()` calls in test | `Custom star logic: accuracy-based` in spec |

---

## Hypothesis (precise, falsifiable)

**H1 (shipped):** Adding `totalLives: 0` signal to test-gen prompt prevents lives tests on unlimited-lives games. Measure: associations build 345 passes mechanics batch without lives assertions.

**H2 (pending):** Adding a `gameFeatures` block (parsed from spec metadata: totalLives, timerType, roundCount, scoringType) to the test-gen prompt (Step 2a + 2b) reduces "structurally wrong test" kills from 2/10 builds to 0/10.

Structurally wrong tests are a class of test failures where:
1. The test itself is the bug (not the HTML)
2. Triage correctly identifies `skip_tests` but the test is already baked into the spec file
3. The fix loop can never pass the test because the feature doesn't exist in the game

---

## Measurement Plan

1. Watch builds 345 (associations) and 346 (rapid-challenge) with `b27e010` fix active.
2. If associations passes mechanics on first iteration → H1 confirmed.
3. If any other build gets killed for structurally wrong tests (timer, sequential-step patterns) → evidence for H2 scope.
4. After next 5 scale-run builds, classify any kills for wrong-test patterns.

---

## Prototype Shipped (2026-03-20, pre-H1-confirmation)

`extractGameFeatures(specContent, domSnapshot)` implemented in `lib/pipeline-utils.js` and exported.

### Function signature

```js
extractGameFeatures(specContent, domSnapshot='') → {
  unlimitedLives  : bool,   // totalLives===0 or "unlimited lives" / "no lives"
  hasLives        : bool,   // totalLives > 0 (explicit finite lives)
  totalLives      : number|null,
  totalRounds     : number|null,
  hasLevels       : bool,   // multi-level structure (levels > 1)
  totalLevels     : number|null,
  timerScoring    : bool,   // stars from avg-time or total-time
  accuracyScoring : bool,   // stars from accuracy % (broader regex than extractSpecMetadata)
  singleRound     : bool,   // only 1 round
  hasTwoPhases    : bool,   // learn+recall or study+quiz structure
  hasLearnPhase   : bool,   // explicit learn/study/preview phase detected
}
```

### Validated against real specs
- **associations** spec → `unlimitedLives: true`, `accuracyScoring: true`, `hasLearnPhase: true`, `hasTwoPhases: true` ✓
- **rapid-challenge** spec → `hasLives: true`, `totalLives: 3`, `hasLevels: true`, `totalLevels: 3`, `timerScoring: true` ✓
- Empty spec → all booleans false, numbers null (safe defaults) ✓

Unit tests: `test/pipeline-utils-game-features.test.js` — 34 tests, 487 total suite passes.

### Where to inject into prompts (next step)

The `gameFeatures` block should be injected into:
1. `buildTestCasesPrompt` in `lib/prompts.js` (Step 2a) — before the spec text, as a constraints block
2. `buildTestGenCategoryPrompt` in `lib/prompts.js` (Step 2b) — same position

Format for prompt injection (draft):
```
GAME FEATURE FLAGS (derived from spec — these MUST constrain test generation):
- unlimitedLives: true → DO NOT generate lives-decrement tests, lives-display tests, or game-over-from-lives-loss tests
- accuracyScoring: true → Stars are based on accuracy %, not lives remaining. Use correct/wrong answer counts.
- hasLevels: true (3 levels) → Level-transition tests ARE valid. Test level 1→2→3 progression.
- timerScoring: true → Stars based on avg time/round. Use window.__ralph.setRoundTimes() for star tests.
- hasTwoPhases: true → Game has learn + recall phases. Wait for recall phase before answering.
- singleRound: true → No round-progression tests. All content is in one round.
```

## Next Steps (if H1 confirmed by builds 345/346)

1. Inject `gameFeatures` block into `buildTestCasesPrompt` and `buildTestGenCategoryPrompt` in `lib/prompts.js`

2. Only emit flags that are `true` (false flags add noise, not value)

3. Measure: zero structurally-wrong-test kills across next 10 builds after injection.

---

## Build Evidence

**Build 298 (jelly-doods) — not a lifecycle issue, but relevant context:**
- edge-cases iter 1: 7/9 — triage correctly identified `endGame not updating data-phase='results'` and `swipe moves not counted`
- iter 2: 7/9 — same failures, fix LLM did not resolve them
- iter 3 (E8 script-only): 0/9 — E8 fix caused total collapse
- Pipeline correctly restored best HTML (7/9) after iter 3 collapse
- This is fix-loop accuracy issue, NOT a test-gen structural issue — separate R&D candidate

**Key insight from jelly-doods:** The 2 remaining edge-cases failures (endGame data-phase, swipe counter) were not `isProcessing` blocking clicks — they were genuine HTML logic bugs that the fix LLM could not resolve in 3 iterations. The `isProcessing` hypothesis from the R&D candidates list is less supported by live data than the lifecycle mismatch hypothesis.
