# Skill: Data Contract

## Purpose

Defines the exact data schemas every game must implement for communication with the platform, analytics capture, and test harness compatibility.

## When to use

When building or validating a game's platform integration. Consult before writing gameState, recordAttempt, postMessage, or syncDOM code.

## Owner

**Maintainer:** Gen Quality slot (pipeline team).
**Deletion trigger:** Retire only if the platform replaces postMessage-based communication with a different protocol AND all games are migrated.

## Reads

- `skills-taxonomy.md` sections 4.4, 4.5, 9.1, 9.2 -- ALWAYS
- Validation rules are documented in `skills/game-building/reference/static-validation-rules.md` -- ON-DEMAND (when debugging validation failures)
- Gen rules that reference these schemas are documented in skill files -- ON-DEMAND (when updating gen rules)

## Input

A game's HTML source code.

## Output

A validation report with:
- Pass/fail verdict per schema
- Specific field-level violations with the corresponding validation rule ID (e.g., GEN-PHASE-INIT, GEN-PM-DUAL-PATH)
- Fix recommendation for each violation

### Lives-based game constraint

When gameState.lives > 0, the game MUST implement a `game_over` or `gameover` phase/screen that renders when lives reach 0.

## Reference Files

| File | Contents |
|------|----------|
| [gamestate-schema.md](schemas/gamestate-schema.md) | Full gameState schema with all required + conditional fields |
| [attempt-schema.md](schemas/attempt-schema.md) | recordAttempt with all 12 fields + implementation pattern |
| [postmessage-schema.md](schemas/postmessage-schema.md) | game_complete nested structure, game_ready, game_init, dual-path |
| [syncdom-events.md](schemas/syncdom-events.md) | syncDOM contract, trackEvent, debug functions, SignalCollector, FeedbackManager audio |
| [validation-rules.md](schemas/validation-rules.md) | Build-time + runtime validation rules with rule IDs |

## Quick-Reference Field List

**gameState required:** `gameId`, `phase`, `currentRound`, `totalRounds`, `score`, `attempts`, `events`, `startTime`, `isActive`, `content`, `duration_data`, `isProcessing`, `gameEnded`

**gameState conditional:** `lives`, `totalLives`, `correctAnswer`, `setIndex`

`setIndex` — multi-set games only. Integer ≥ 0. Rotates on each `restartGame()` call (modulo the number of available sets in `fallbackContent.rounds`). Session-scoped: initialized to 0 on every page load; NOT reset by `resetGameState()` (rotates independently).

**recordAttempt (12 fields):** `attempt_timestamp`, `time_since_start_of_game`, `input_of_user`, `correct`, `round_number`, `question_id`, `correct_answer`, `response_time_ms`, `misconception_tag`, `difficulty_level`, `is_retry`, `metadata`

**game_complete metrics:** `accuracy`, `time`, `stars`, `attempts`, `duration_data`, `totalLives`, `tries`

**Per-round optional `answer` field (PART-051):** every round in `content.rounds[i]` MAY carry a game-specific `answer` payload that the AnswerComponent renders into its slide. Standalone games with N evaluated answers use an `answers: [...]` array on the single round. Shape is per-spec — document it in `spec.md`'s content-schema section. Skipped when the spec declares `answerComponent: false` (creator-only opt-out — no LLM step may auto-default this flag; see PART-051 § Opt-out). See [postmessage-schema.md](schemas/postmessage-schema.md) § "Per-round answer field".

**syncDOM attributes:** `data-phase` (required), `data-score` (required), `data-lives` (conditional), `data-round` (recommended)

## Procedure

Validate each schema below in order. A single missing required field = contract violation. Cite the rule ID for each violation found.

**Deterministic validation gate:** Before running any Playwright tests, run contract validation against the generated HTML (see `skills/data-contract/schemas/validation-rules.md`). This is a hard gate -- if contract validation fails, do not proceed to browser-based testing.

### Step 1: Validate gameState schema

Check all required fields exist with correct types and initial values. See [gamestate-schema.md](schemas/gamestate-schema.md).

### Step 2: Validate recordAttempt

Check all 12 fields are present in the attempt object. See [attempt-schema.md](schemas/attempt-schema.md).

### Step 3: Validate postMessage schemas

Check `game_ready`, `game_init` handler, and `game_complete` with nested `data` structure. See [postmessage-schema.md](schemas/postmessage-schema.md).

### Step 4: Validate syncDOM

Check `#app` targeting, required attributes, and call sites. See [syncdom-events.md](schemas/syncdom-events.md).

### Step 5: Validate trackEvent and debug functions

Check canonical events and window-exposed functions. See [syncdom-events.md](schemas/syncdom-events.md).

### Step 6: Run validation rules

Apply build-time static checks and note rule IDs for failures. See [validation-rules.md](schemas/validation-rules.md).

## Constraints

- **CRITICAL:** Every field marked "Required" must be present. Omitting a required field = contract violation.
- **CRITICAL:** `gameState` must be assigned to `window.gameState` -- not a local variable.
- **CRITICAL:** `syncDOM` must target `#app` -- never `document.body`.
- **CRITICAL:** `gameState.phase = 'playing'` must be the FIRST line inside the `game_init` handler.
- **STANDARD:** Games may add extra fields (forward compatibility). Extra fields must not conflict with required field names.
- **STANDARD:** All timestamps are epoch milliseconds (`Date.now()`), never ISO strings, never seconds.
- **STANDARD:** `accuracy` in game_complete is an integer 0-100, not a decimal 0.0-1.0.
- **STANDARD:** `round_number` in recordAttempt is 1-indexed. `currentRound` in gameState is 0-indexed.
- **STANDARD:** `window.debugGame` and `window.debugAudio` must be exposed as functions. `window.testAudio`, `window.testPause`, and `window.testResume` also required.
- **STANDARD:** When `signalConfig` is provided in `game_init`, `game_complete` must include `signal_event_count` and `signal_metadata`.
- **STANDARD:** Audio preloading must use `FeedbackManager.sound.preload()`. `sound.register()` is forbidden.
- **ADVISORY:** Expose `window.loadRound` for debugging convenience.

## Defaults

- Star thresholds: 0 stars (score=0), 1 star (score>=1), 2 stars (score>=60%), 3 stars (score>=90%).
- If no lives specified: omit `lives`, `totalLives`, and `data-lives`.
- If no `question_id` format: use `'r' + roundNumber` (e.g., `'r1'`).
- If no misconception tags: set `misconception_tag: null` for all attempts.
- If no difficulty levels: set `difficulty_level: 1` for all rounds.

## Anti-patterns

1. **Sending game_ready before registering the message listener.** Platform sends `game_init` immediately -- content is lost.
2. **Setting gameState.phase after other logic in game_init handler.** Test harness times out.
3. **Guarding game_complete behind a victory check.** Game-over sessions must also send `game_complete`.
4. **Using `document.body` for data attributes instead of `#app`.** Test harness reads `#app[data-phase]`.
5. **Sending game_complete with flat structure instead of nested `data`.** Platform reads `event.data.data.metrics`.
6. **Omitting syncDOM after phase/score/lives changes.** Stale attributes = test failures.
7. **Using `attempt_number` instead of `round_number`.** Taxonomy requires `round_number` (1-indexed).
8. **Returning accuracy as a float (0.0-1.0) instead of integer (0-100).**
9. **Recording recordAttempt without `response_time_ms`.** Requires tracking `gameState.roundStartTime`.
